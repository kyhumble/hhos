import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { episodes, wounds, type HhosDb } from '@hhos/db';
import type { CreateWoundInput, UpdateWoundInput } from '@hhos/shared';
import { DB } from '../common/db.module';
import {
  fieldRnCanAccessEpisode,
  fieldRnCanAccessPatient,
} from '../common/caseload';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';

const CLOSED_STATUSES = new Set(['healed', 'transferred', 'void']);

@Injectable()
export class WoundsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  private async assertEpisodeAccess(user: AuthUser, episodeId: string) {
    const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Episode not on your caseload' },
      });
    }
  }

  private async assertPatientAccess(user: AuthUser, patientId: string) {
    const ok = await fieldRnCanAccessPatient(this.db, user, patientId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Patient not on your caseload' },
      });
    }
  }

  private async loadEpisode(
    orgId: string,
    episodeId: string,
  ): Promise<{ id: string; patientId: string } | null> {
    const [ep] = await this.db
      .select({ id: episodes.id, patientId: episodes.patientId })
      .from(episodes)
      .where(
        and(
          eq(episodes.orgId, orgId),
          eq(episodes.id, episodeId),
          isNull(episodes.deletedAt),
        ),
      )
      .limit(1);
    return ep ?? null;
  }

  async listForEpisode(user: AuthUser, episodeId: string) {
    await this.assertEpisodeAccess(user, episodeId);

    const ep = await this.loadEpisode(user.orgId, episodeId);
    if (!ep) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }

    const rows = await this.db
      .select()
      .from(wounds)
      .where(
        and(
          eq(wounds.orgId, user.orgId),
          eq(wounds.episodeId, episodeId),
          isNull(wounds.deletedAt),
        ),
      )
      .limit(200);

    return { data: rows };
  }

  async create(
    user: AuthUser,
    episodeId: string,
    input: CreateWoundInput,
    meta?: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    if (input.episodeId !== episodeId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Body episodeId must match path episodeId',
        },
      });
    }

    await this.assertEpisodeAccess(user, episodeId);
    await this.assertPatientAccess(user, input.patientId);

    const ep = await this.loadEpisode(user.orgId, episodeId);
    if (!ep) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }

    if (ep.patientId !== input.patientId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'patientId does not match episode patient',
        },
      });
    }

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(wounds)
        .values({
          orgId: user.orgId,
          patientId: input.patientId,
          episodeId,
          label: input.label,
          bodySiteCode: input.bodySiteCode ?? null,
          laterality: input.laterality,
          woundType: input.woundType ?? null,
          openedAt: input.openedAt ? new Date(input.openedAt) : new Date(),
          status: 'active',
          createdBy: user.id,
        })
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'wound.create',
          resourceType: 'wound',
          resourceId: row?.id,
          patientId: input.patientId,
          episodeId,
          after: row,
          requestId: meta?.requestId,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return row;
    });
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateWoundInput,
    meta?: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    const [before] = await this.db
      .select()
      .from(wounds)
      .where(
        and(eq(wounds.orgId, user.orgId), eq(wounds.id, id), isNull(wounds.deletedAt)),
      )
      .limit(1);

    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Wound not found' },
      });
    }

    await this.assertEpisodeAccess(user, before.episodeId);

    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.label !== undefined) patch.label = input.label;
      if (input.bodySiteCode !== undefined) patch.bodySiteCode = input.bodySiteCode;
      if (input.laterality !== undefined) patch.laterality = input.laterality;
      if (input.woundType !== undefined) patch.woundType = input.woundType;
      if (input.status !== undefined) patch.status = input.status;

      if (input.closedAt !== undefined) {
        patch.closedAt = input.closedAt ? new Date(input.closedAt) : null;
      } else if (input.status && CLOSED_STATUSES.has(input.status) && !before.closedAt) {
        patch.closedAt = new Date();
      } else if (input.status === 'active' && before.status !== 'active') {
        patch.closedAt = null;
      }

      const [updated] = await tx
        .update(wounds)
        .set(patch)
        .where(eq(wounds.id, id))
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'wound.update',
          resourceType: 'wound',
          resourceId: id,
          patientId: before.patientId,
          episodeId: before.episodeId,
          before,
          after: updated,
          requestId: meta?.requestId,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }
}
