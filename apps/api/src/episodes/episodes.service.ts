import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  careTeamMembers,
  episodeTimelineEvents,
  episodes,
  intakeChecklistItems,
  patients,
  users,
  type HhosDb,
} from '@hhos/db';
import type {
  AssignCareTeamInput,
  EpisodeFlag,
  UpdateEpisodeInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import { ChecklistService } from '../common/checklist.service';
import {
  caseloadEpisodeIdSet,
  fieldRnCanAccessEpisode,
  isFieldRnScoped,
} from '../common/caseload';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';

@Injectable()
export class EpisodesService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly checklist: ChecklistService,
    private readonly audit: AuditService,
  ) {}

  private computeFlags(ep: {
    socDueAt: Date | null;
    socCompletedAt: Date | null;
    intakeStatus: string;
    f2fStatus: string;
    ordersStatus: string;
  }): EpisodeFlag[] {
    const flags: EpisodeFlag[] = [];
    const now = Date.now();
    if (!ep.socCompletedAt && ep.socDueAt) {
      const due = ep.socDueAt.getTime();
      if (now > due) flags.push('SOC_OVERDUE');
      else if (due - now <= 24 * 60 * 60 * 1000) flags.push('SOC_DUE_SOON');
    }
    if (ep.intakeStatus === 'incomplete') flags.push('INTAKE_INCOMPLETE');
    if (ep.f2fStatus === 'unknown' || ep.f2fStatus === 'missing') {
      flags.push('F2F_MISSING');
    }
    if (ep.ordersStatus === 'missing') flags.push('ORDERS_MISSING');
    return flags;
  }

  private async assertEpisodeAccess(user: AuthUser, episodeId: string) {
    const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Episode not on your caseload' },
      });
    }
  }

  async list(user: AuthUser) {
    // Caseload constrains SQL before limit so assigned episodes are never omitted
    if (isFieldRnScoped(user)) {
      const allowed = await caseloadEpisodeIdSet(this.db, user.id);
      if (allowed.size === 0) return { data: [] };

      const rows = await this.db
        .select({
          id: episodes.id,
          status: episodes.status,
          intakeStatus: episodes.intakeStatus,
          careType: episodes.careType,
          socDueAt: episodes.socDueAt,
          socScheduledAt: episodes.socScheduledAt,
          socCompletedAt: episodes.socCompletedAt,
          f2fStatus: episodes.f2fStatus,
          ordersStatus: episodes.ordersStatus,
          patientId: episodes.patientId,
          referralId: episodes.referralId,
          primaryDxIcd10: episodes.primaryDxIcd10,
          patientFirstName: patients.firstName,
          patientLastName: patients.lastName,
          mrn: patients.mrn,
        })
        .from(episodes)
        .innerJoin(patients, eq(episodes.patientId, patients.id))
        .where(
          and(
            eq(episodes.orgId, user.orgId),
            isNull(episodes.deletedAt),
            inArray(episodes.id, [...allowed]),
          ),
        )
        .limit(50);

      return {
        data: rows.map((r) => ({
          ...r,
          flags: this.computeFlags(r),
        })),
      };
    }

    const rows = await this.db
      .select({
        id: episodes.id,
        status: episodes.status,
        intakeStatus: episodes.intakeStatus,
        careType: episodes.careType,
        socDueAt: episodes.socDueAt,
        socScheduledAt: episodes.socScheduledAt,
        socCompletedAt: episodes.socCompletedAt,
        f2fStatus: episodes.f2fStatus,
        ordersStatus: episodes.ordersStatus,
        patientId: episodes.patientId,
        referralId: episodes.referralId,
        primaryDxIcd10: episodes.primaryDxIcd10,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        mrn: patients.mrn,
      })
      .from(episodes)
      .innerJoin(patients, eq(episodes.patientId, patients.id))
      .where(and(eq(episodes.orgId, user.orgId), isNull(episodes.deletedAt)))
      .limit(50);

    return {
      data: rows.map((r) => ({
        ...r,
        flags: this.computeFlags(r),
      })),
    };
  }

  /**
   * Load episode detail. Uses executor when provided (same TX as mutation).
   * Sensitive-read audit only for explicit GET, not update response assembly.
   */
  private async loadEpisodeDetail(
    orgId: string,
    id: string,
    opts?: {
      executor?: HhosDb;
      auditRead?: boolean;
      user?: AuthUser;
    },
  ) {
    const db = opts?.executor ?? this.db;
    const [row] = await db
      .select()
      .from(episodes)
      .where(
        and(eq(episodes.orgId, orgId), eq(episodes.id, id), isNull(episodes.deletedAt)),
      )
      .limit(1);
    if (!row) return null;

    const checklist = await db
      .select()
      .from(intakeChecklistItems)
      .where(eq(intakeChecklistItems.episodeId, id));

    const team = await db
      .select()
      .from(careTeamMembers)
      .where(eq(careTeamMembers.episodeId, id));

    const timeline = await db
      .select()
      .from(episodeTimelineEvents)
      .where(eq(episodeTimelineEvents.episodeId, id));

    const [patient] = await db
      .select({
        id: patients.id,
        mrn: patients.mrn,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dob: patients.dob,
        capacityStatus: patients.capacityStatus,
        preferredLanguage: patients.preferredLanguage,
      })
      .from(patients)
      .where(eq(patients.id, row.patientId))
      .limit(1);

    if (opts?.auditRead && opts.user) {
      await this.audit.writeFromUser(opts.user, {
        action: 'episode.read',
        resourceType: 'episode',
        resourceId: id,
        patientId: row.patientId,
        episodeId: id,
      });
    }

    return {
      ...row,
      flags: this.computeFlags(row),
      checklist,
      careTeam: team,
      timeline,
      patient,
    };
  }

  async getById(user: AuthUser, id: string) {
    await this.assertEpisodeAccess(user, id);
    return this.loadEpisodeDetail(user.orgId, id, { auditRead: true, user });
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateEpisodeInput,
    meta?: { requestId?: string },
  ) {
    await this.assertEpisodeAccess(user, id);

    const [before] = await this.db
      .select()
      .from(episodes)
      .where(
        and(eq(episodes.orgId, user.orgId), eq(episodes.id, id), isNull(episodes.deletedAt)),
      )
      .limit(1);

    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }

    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      if (input.status !== undefined) patch.status = input.status;
      if (input.careType !== undefined) patch.careType = input.careType;
      if (input.socScheduledAt !== undefined) {
        patch.socScheduledAt = input.socScheduledAt
          ? new Date(input.socScheduledAt)
          : null;
      }
      if (input.socCompletedAt !== undefined) {
        patch.socCompletedAt = input.socCompletedAt
          ? new Date(input.socCompletedAt)
          : null;
      }
      if (input.socClinicianId !== undefined) patch.socClinicianId = input.socClinicianId;
      if (input.primaryDxIcd10 !== undefined) patch.primaryDxIcd10 = input.primaryDxIcd10;
      if (input.admissionSource !== undefined) {
        patch.admissionSource = input.admissionSource;
      }
      if (input.f2fStatus !== undefined) patch.f2fStatus = input.f2fStatus;
      if (input.f2fDate !== undefined) patch.f2fDate = input.f2fDate;
      if (input.ordersStatus !== undefined) patch.ordersStatus = input.ordersStatus;
      if (input.pocStatus !== undefined) patch.pocStatus = input.pocStatus;
      if (input.nonAdmitReason !== undefined) patch.nonAdmitReason = input.nonAdmitReason;

      // intakeStatus is derived-only via checklist recompute

      if (input.socScheduledAt && !input.status && before.status === 'pre_admit') {
        patch.status = 'scheduled_soc';
      }

      const [updated] = await tx
        .update(episodes)
        .set(patch)
        .where(eq(episodes.id, id))
        .returning();

      if (input.socScheduledAt) {
        await tx.insert(episodeTimelineEvents).values({
          orgId: user.orgId,
          episodeId: id,
          eventType: 'soc_scheduled',
          summary: 'SOC scheduled',
          actorUserId: user.id,
        });
      }

      await this.checklist.recomputeForEpisode(id, user.id, tx as unknown as HhosDb);

      await this.audit.writeFromUser(
        user,
        {
          action: 'episode.update',
          resourceType: 'episode',
          resourceId: id,
          patientId: before.patientId,
          episodeId: id,
          before,
          after: updated,
          requestId: meta?.requestId,
        },
        tx,
      );

      // Load via tx so response includes recompute results; no read audit on update
      return this.loadEpisodeDetail(user.orgId, id, {
        executor: tx as unknown as HhosDb,
        auditRead: false,
      });
    });
  }

  async assignCareTeam(
    user: AuthUser,
    episodeId: string,
    input: AssignCareTeamInput,
    meta?: { requestId?: string },
  ) {
    await this.assertEpisodeAccess(user, episodeId);

    const [ep] = await this.db
      .select()
      .from(episodes)
      .where(
        and(
          eq(episodes.id, episodeId),
          eq(episodes.orgId, user.orgId),
          isNull(episodes.deletedAt),
        ),
      )
      .limit(1);

    if (!ep) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }

    const [targetUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, user.orgId)))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Target user not found in organization',
        },
      });
    }

    return this.db.transaction(async (tx) => {
      if (input.teamRole === 'primary_rn' && input.active !== false) {
        await tx
          .update(careTeamMembers)
          .set({ active: false })
          .where(
            and(
              eq(careTeamMembers.episodeId, episodeId),
              eq(careTeamMembers.teamRole, 'primary_rn'),
              eq(careTeamMembers.active, true),
            ),
          );
      }

      const [member] = await tx
        .insert(careTeamMembers)
        .values({
          orgId: user.orgId,
          episodeId,
          userId: input.userId,
          teamRole: input.teamRole,
          active: input.active ?? true,
          assignedBy: user.id,
        })
        .returning();

      await tx.insert(episodeTimelineEvents).values({
        orgId: user.orgId,
        episodeId,
        eventType: 'owner_changed',
        summary: `Care team assigned: ${input.teamRole}`,
        actorUserId: user.id,
        metadata: JSON.stringify({ userId: input.userId, teamRole: input.teamRole }),
      });

      await this.audit.writeFromUser(
        user,
        {
          action: 'episode.care_team.assign',
          resourceType: 'care_team_member',
          resourceId: member?.id,
          patientId: ep.patientId,
          episodeId,
          after: member,
          requestId: meta?.requestId,
        },
        tx,
      );

      return member;
    });
  }

  async intakeWorklist(user: AuthUser) {
    const { data } = await this.list(user);
    const rank = (flags: EpisodeFlag[]) => {
      if (flags.includes('SOC_OVERDUE')) return 0;
      if (flags.includes('SOC_DUE_SOON')) return 1;
      if (flags.includes('INTAKE_INCOMPLETE')) return 2;
      return 3;
    };
    return {
      data: [...data].sort((a, b) => rank(a.flags) - rank(b.flags)),
    };
  }
}
