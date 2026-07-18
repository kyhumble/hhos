import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { episodes, visits, type HhosDb } from '@hhos/db';
import type { CreateVisitInput, UpdateVisitInput } from '@hhos/shared';
import { DB } from '../common/db.module';
import {
  fieldRnCanAccessEpisode,
  fieldRnCanAccessPatient,
} from '../common/caseload';
import { isUniqueViolation } from '../common/db-errors';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';

@Injectable()
export class VisitsService {
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
      .from(visits)
      .where(
        and(
          eq(visits.orgId, user.orgId),
          eq(visits.episodeId, episodeId),
          isNull(visits.deletedAt),
        ),
      )
      .limit(200);

    return { data: rows };
  }

  async create(
    user: AuthUser,
    episodeId: string,
    input: CreateVisitInput,
    meta?: { requestId?: string; ip?: string },
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

    // Idempotent create when clientVisitId is supplied.
    if (input.clientVisitId) {
      const [existing] = await this.db
        .select()
        .from(visits)
        .where(
          and(
            eq(visits.orgId, user.orgId),
            eq(visits.clientVisitId, input.clientVisitId),
            isNull(visits.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        if (
          existing.episodeId !== episodeId ||
          existing.patientId !== input.patientId
        ) {
          throw new ConflictException({
            error: {
              code: 'CONFLICT',
              message: 'clientVisitId already used for a different episode/patient',
            },
          });
        }
        return existing;
      }
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(visits)
          .values({
            orgId: user.orgId,
            patientId: input.patientId,
            episodeId,
            clinicianUserId: user.id,
            startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
            visitType: input.visitType,
            status: 'in_progress',
            clientVisitId: input.clientVisitId ?? null,
          })
          .returning();

        await this.audit.writeFromUser(
          user,
          {
            action: 'visit.create',
            resourceType: 'visit',
            resourceId: row?.id,
            patientId: input.patientId,
            episodeId,
            after: row,
            requestId: meta?.requestId,
            ip: meta?.ip,
          },
          tx,
        );

        return row;
      });
    } catch (err) {
      if (!isUniqueViolation(err) || !input.clientVisitId) throw err;

      const [existing] = await this.db
        .select()
        .from(visits)
        .where(
          and(
            eq(visits.orgId, user.orgId),
            eq(visits.clientVisitId, input.clientVisitId),
            isNull(visits.deletedAt),
          ),
        )
        .limit(1);

      if (
        existing &&
        existing.episodeId === episodeId &&
        existing.patientId === input.patientId
      ) {
        return existing;
      }

      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'clientVisitId already used for a different episode/patient',
        },
      });
    }
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateVisitInput,
    meta?: { requestId?: string; ip?: string },
  ) {
    const [before] = await this.db
      .select()
      .from(visits)
      .where(
        and(eq(visits.orgId, user.orgId), eq(visits.id, id), isNull(visits.deletedAt)),
      )
      .limit(1);

    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Visit not found' },
      });
    }

    await this.assertEpisodeAccess(user, before.episodeId);

    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};

      if (input.status !== undefined) patch.status = input.status;
      if (input.visitType !== undefined) patch.visitType = input.visitType;

      if (input.endedAt !== undefined) {
        patch.endedAt = input.endedAt ? new Date(input.endedAt) : null;
      } else if (
        input.status &&
        (input.status === 'completed' || input.status === 'cancelled') &&
        !before.endedAt
      ) {
        patch.endedAt = new Date();
      } else if (input.status === 'in_progress' && before.status !== 'in_progress') {
        patch.endedAt = null;
      }

      const [updated] = await tx
        .update(visits)
        .set(patch)
        .where(eq(visits.id, id))
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'visit.update',
          resourceType: 'visit',
          resourceId: id,
          patientId: before.patientId,
          episodeId: before.episodeId,
          before,
          after: updated,
          requestId: meta?.requestId,
          ip: meta?.ip,
        },
        tx,
      );

      return updated;
    });
  }
}
