/**
 * Clinical tasks (PR 7 / K29).
 * Sole owner of clinical_tasks row creation for large-wound reviews.
 * Never auto-cancels open tasks when measurements fall below threshold.
 */
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { clinicalTasks, woundPhotos, type HhosDb } from '@hhos/db';
import type {
  CompleteClinicalTaskInput,
  ListClinicalTasksQuery,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import {
  fieldRnCanAccessEpisode,
  isFieldRnScoped,
  caseloadEpisodeIdSet,
} from '../common/caseload';
import { isWoundPhotosEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';

/** Minimal photo shape for large-wound task creation (avoids circular runtime import). */
export type LargeWoundPhotoRef = {
  id: string;
  orgId: string;
  episodeId: string;
  patientId: string;
  isLargeWound: boolean;
  capturedByUserId: string;
  lengthCm?: unknown;
  widthCm?: unknown;
};

export type ClinicalTaskRow = typeof clinicalTasks.$inferSelect;

export type RequestMeta = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

const OPEN_STATUSES = ['open', 'in_progress'] as const;

@Injectable()
export class ClinicalTasksService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  assertFeatureEnabled(): void {
    if (!isWoundPhotosEnabled()) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    }
  }

  /**
   * Ensure an open/in_progress large_wound_review exists for the photo.
   * Idempotent: second call returns existing open task (no duplicate).
   * Does nothing when isLargeWound is false (never auto-cancels).
   */
  async ensureOpenLargeWoundReview(
    photo: LargeWoundPhotoRef,
    opts?: {
      actorUserId?: string | null;
      meta?: RequestMeta;
      /** When true, skip isLargeWound check (caller already verified). */
      force?: boolean;
    },
  ): Promise<ClinicalTaskRow | null> {
    if (!opts?.force && !photo.isLargeWound) {
      return null;
    }

    const existing = await this.findOpenLargeWoundForPhoto(
      photo.orgId,
      photo.id,
    );
    if (existing) {
      return existing;
    }

    const createdBy = opts?.actorUserId ?? photo.capturedByUserId;
    const lengthCm = photo.lengthCm != null ? String(photo.lengthCm) : null;
    const widthCm = photo.widthCm != null ? String(photo.widthCm) : null;
    const detailsParts = [
      lengthCm != null ? `lengthCm=${lengthCm}` : null,
      widthCm != null ? `widthCm=${widthCm}` : null,
    ].filter(Boolean);

    const [created] = await this.db
      .insert(clinicalTasks)
      .values({
        orgId: photo.orgId,
        episodeId: photo.episodeId,
        patientId: photo.patientId,
        woundPhotoId: photo.id,
        taskType: 'large_wound_review',
        status: 'open',
        priority: 'urgent',
        title: 'Large wound review',
        details:
          detailsParts.length > 0
            ? `Auto-created from measurements (${detailsParts.join(', ')})`
            : 'Auto-created from large-wound flag',
        createdBy,
      })
      .returning();

    if (!created) {
      // Race: re-read
      return this.findOpenLargeWoundForPhoto(photo.orgId, photo.id);
    }

    await this.audit.write({
      orgId: photo.orgId,
      actorUserId: createdBy,
      actorType: opts?.actorUserId ? 'user' : 'system',
      action: 'clinical_task.created',
      resourceType: 'clinical_task',
      resourceId: created.id,
      patientId: created.patientId,
      episodeId: created.episodeId,
      after: this.safeTask(created),
      requestId: opts?.meta?.requestId,
      ip: opts?.meta?.ip,
      userAgent: opts?.meta?.userAgent,
    });

    return created;
  }

  /**
   * Backfill open large_wound_review tasks for available photos with
   * is_large_wound=true and no open task (idempotent).
   */
  async backfillLargeWoundTasks(limit = 100): Promise<number> {
    const candidates = await this.db
      .select({
        id: woundPhotos.id,
        orgId: woundPhotos.orgId,
        episodeId: woundPhotos.episodeId,
        patientId: woundPhotos.patientId,
        isLargeWound: woundPhotos.isLargeWound,
        capturedByUserId: woundPhotos.capturedByUserId,
        lengthCm: woundPhotos.lengthCm,
        widthCm: woundPhotos.widthCm,
      })
      .from(woundPhotos)
      .where(
        and(
          eq(woundPhotos.isLargeWound, true),
          eq(woundPhotos.status, 'available'),
          isNull(woundPhotos.deletedAt),
        ),
      )
      .orderBy(woundPhotos.createdAt)
      .limit(limit);

    let created = 0;
    for (const r of candidates) {
      const existing = await this.findOpenLargeWoundForPhoto(r.orgId, r.id);
      if (existing) continue;
      const task = await this.ensureOpenLargeWoundReview(
        {
          id: r.id,
          orgId: r.orgId,
          episodeId: r.episodeId,
          patientId: r.patientId,
          isLargeWound: true,
          capturedByUserId: r.capturedByUserId,
          lengthCm: r.lengthCm,
          widthCm: r.widthCm,
        },
        { force: true },
      );
      if (task) created += 1;
    }
    return created;
  }

  /**
   * GET /v1/clinical-tasks — clinical lead / compliance / admin.
   * Field RN with only capture perms cannot list (no clinical_task:read).
   */
  async list(user: AuthUser, query: ListClinicalTasksQuery) {
    this.assertFeatureEnabled();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(clinicalTasks.orgId, user.orgId)];
    if (query.status) {
      conditions.push(eq(clinicalTasks.status, query.status));
    }
    if (query.taskType) {
      conditions.push(eq(clinicalTasks.taskType, query.taskType));
    }
    if (query.priority) {
      conditions.push(eq(clinicalTasks.priority, query.priority));
    }
    if (query.episodeId) {
      await this.assertEpisodeAccess(user, query.episodeId);
      conditions.push(eq(clinicalTasks.episodeId, query.episodeId));
    }

    // field_rn is not expected to have clinical_task:read; if they do somehow, scope
    if (isFieldRnScoped(user)) {
      const episodeIds = await caseloadEpisodeIdSet(this.db, user.id);
      if (episodeIds.size === 0) {
        return { data: [], page, pageSize, total: 0 };
      }
      conditions.push(inArray(clinicalTasks.episodeId, [...episodeIds]));
    }

    const rows = await this.db
      .select()
      .from(clinicalTasks)
      .where(and(...conditions))
      .orderBy(desc(clinicalTasks.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: rows.map((r) => this.toApi(r)),
      page,
      pageSize,
    };
  }

  /**
   * POST /v1/clinical-tasks/:id/complete
   * Clinical lead closes task (HITL). Never auto-cancel from measurements.
   */
  async complete(
    user: AuthUser,
    taskId: string,
    input: CompleteClinicalTaskInput,
    meta?: RequestMeta,
  ) {
    this.assertFeatureEnabled();

    const task = await this.loadTaskOrThrow(user.orgId, taskId);
    await this.assertEpisodeAccess(user, task.episodeId);

    if (task.status === 'done') {
      return this.toApi(task);
    }

    if (task.status === 'cancelled') {
      throw new ConflictException({
        error: {
          code: 'INVALID_TASK_STATE',
          message: 'Cancelled task cannot be completed',
        },
      });
    }

    const now = new Date();
    const details =
      input.notes && input.notes.trim().length > 0
        ? [task.details, `Completion notes: ${input.notes.trim()}`]
            .filter(Boolean)
            .join('\n')
        : task.details;

    const [updated] = await this.db
      .update(clinicalTasks)
      .set({
        status: 'done',
        details,
        updatedAt: now,
        assigneeUserId: task.assigneeUserId ?? user.id,
      })
      .where(
        and(
          eq(clinicalTasks.id, task.id),
          eq(clinicalTasks.orgId, user.orgId),
          inArray(clinicalTasks.status, ['open', 'in_progress']),
        ),
      )
      .returning();

    if (!updated) {
      const again = await this.loadTaskOrThrow(user.orgId, taskId);
      if (again.status === 'done') return this.toApi(again);
      throw new ConflictException({
        error: {
          code: 'INVALID_TASK_STATE',
          message: 'Task could not be completed (state changed)',
        },
      });
    }

    await this.audit.writeFromUser(user, {
      action: 'clinical_task.completed',
      resourceType: 'clinical_task',
      resourceId: updated.id,
      patientId: updated.patientId,
      episodeId: updated.episodeId,
      before: this.safeTask(task),
      after: this.safeTask(updated),
      requestId: meta?.requestId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.toApi(updated);
  }

  private async findOpenLargeWoundForPhoto(
    orgId: string,
    woundPhotoId: string,
  ): Promise<ClinicalTaskRow | null> {
    const [row] = await this.db
      .select()
      .from(clinicalTasks)
      .where(
        and(
          eq(clinicalTasks.orgId, orgId),
          eq(clinicalTasks.woundPhotoId, woundPhotoId),
          eq(clinicalTasks.taskType, 'large_wound_review'),
          inArray(clinicalTasks.status, [...OPEN_STATUSES]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async loadTaskOrThrow(
    orgId: string,
    taskId: string,
  ): Promise<ClinicalTaskRow> {
    const [row] = await this.db
      .select()
      .from(clinicalTasks)
      .where(and(eq(clinicalTasks.orgId, orgId), eq(clinicalTasks.id, taskId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Clinical task not found' },
      });
    }
    return row;
  }

  private async assertEpisodeAccess(user: AuthUser, episodeId: string) {
    const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Episode not on your caseload' },
      });
    }
  }

  private safeTask(row: ClinicalTaskRow) {
    return {
      id: row.id,
      orgId: row.orgId,
      episodeId: row.episodeId,
      patientId: row.patientId,
      woundPhotoId: row.woundPhotoId,
      taskType: row.taskType,
      status: row.status,
      priority: row.priority,
      title: row.title,
      // details may contain non-name measurement text — ok for audit; no patient name
      hasDetails: Boolean(row.details),
      assigneeUserId: row.assigneeUserId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toApi(row: ClinicalTaskRow) {
    return {
      id: row.id,
      orgId: row.orgId,
      episodeId: row.episodeId,
      patientId: row.patientId,
      woundPhotoId: row.woundPhotoId,
      taskType: row.taskType,
      status: row.status,
      priority: row.priority,
      title: row.title,
      details: row.details,
      assigneeUserId: row.assigneeUserId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
