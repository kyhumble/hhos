import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  careTeamMembers,
  clinicianProfiles,
  episodes,
  hospitalizationAlerts,
  patientAddresses,
  patients,
  routeSuggestions,
  users,
  visitTasks,
  type HhosDb,
} from '@hhos/db';
import type {
  CreateHospitalizationAlertInput,
  CreateVisitTaskInput,
  DecideRouteSuggestionInput,
  GenerateRouteSuggestionsInput,
  UpdateHospitalizationAlertInput,
  UpdateVisitTaskInput,
  UpsertClinicianProfileInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { fieldRnCanAccessEpisode, isFieldRnScoped } from '../common/caseload';
import { isServiceAiEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';
import { scoreClinicianForEpisode } from './routing.scorer';

const ENGINE = 'rules-v1';

@Injectable()
export class OpsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  private ensureFeature(): void {
    if (!isServiceAiEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_SERVICE_AI is not enabled',
        },
      });
    }
  }

  private async assertEpisode(user: AuthUser, episodeId: string) {
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
    if (isFieldRnScoped(user)) {
      const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
      if (!ok) {
        throw new ForbiddenException({
          error: { code: 'NOT_ASSIGNED', message: 'Not on care team' },
        });
      }
    }
    return ep;
  }

  // ── Clinician profiles ───────────────────────────────────────────────────

  async upsertProfile(
    user: AuthUser,
    input: UpsertClinicianProfileInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    // Only self or admin/lead
    if (
      input.userId !== user.id &&
      !user.roles.some((r) => ['admin', 'clinical_lead', 'intake_coordinator'].includes(r))
    ) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Cannot edit other clinician profiles' },
      });
    }

    const [target] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, user.orgId)))
      .limit(1);
    if (!target) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const [row] = await this.db
      .insert(clinicianProfiles)
      .values({
        orgId: user.orgId,
        userId: input.userId,
        skillsJson: input.skills,
        languagesJson: input.languages,
        homeBaseCity: input.homeBaseCity ?? null,
        homeBaseState: input.homeBaseState ?? null,
        homeBasePostal: input.homeBasePostal ?? null,
        maxDailyVisits: input.maxDailyVisits,
        activeForRouting: input.activeForRouting,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: clinicianProfiles.userId,
        set: {
          skillsJson: input.skills,
          languagesJson: input.languages,
          homeBaseCity: input.homeBaseCity ?? null,
          homeBaseState: input.homeBaseState ?? null,
          homeBasePostal: input.homeBasePostal ?? null,
          maxDailyVisits: input.maxDailyVisits,
          activeForRouting: input.activeForRouting,
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'clinician_profile.upsert',
      resourceType: 'clinician_profile',
      resourceId: row!.id,
      after: { userId: input.userId, skills: input.skills },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async listProfiles(user: AuthUser) {
    this.ensureFeature();
    const rows = await this.db
      .select({
        id: clinicianProfiles.id,
        userId: clinicianProfiles.userId,
        fullName: users.fullName,
        email: users.email,
        skillsJson: clinicianProfiles.skillsJson,
        languagesJson: clinicianProfiles.languagesJson,
        homeBaseCity: clinicianProfiles.homeBaseCity,
        homeBaseState: clinicianProfiles.homeBaseState,
        homeBasePostal: clinicianProfiles.homeBasePostal,
        maxDailyVisits: clinicianProfiles.maxDailyVisits,
        activeForRouting: clinicianProfiles.activeForRouting,
      })
      .from(clinicianProfiles)
      .innerJoin(users, eq(clinicianProfiles.userId, users.id))
      .where(eq(clinicianProfiles.orgId, user.orgId));
    return { data: rows };
  }

  // ── Route suggestions (HITL) ─────────────────────────────────────────────

  async generateSuggestions(
    user: AuthUser,
    input: GenerateRouteSuggestionsInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const ep = await this.assertEpisode(user, input.episodeId);

    const [patient] = await this.db
      .select()
      .from(patients)
      .where(eq(patients.id, ep.patientId))
      .limit(1);

    const [addr] = await this.db
      .select()
      .from(patientAddresses)
      .where(
        and(
          eq(patientAddresses.patientId, ep.patientId),
          eq(patientAddresses.type, 'service'),
          isNull(patientAddresses.deletedAt),
        ),
      )
      .limit(1);

    // Supersede prior pending
    await this.db
      .update(routeSuggestions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(routeSuggestions.episodeId, ep.id),
          eq(routeSuggestions.status, 'pending'),
        ),
      );

    const profiles = await this.db
      .select({
        profile: clinicianProfiles,
        fullName: users.fullName,
        userId: users.id,
      })
      .from(clinicianProfiles)
      .innerJoin(users, eq(clinicianProfiles.userId, users.id))
      .where(
        and(
          eq(clinicianProfiles.orgId, user.orgId),
          eq(clinicianProfiles.activeForRouting, true),
          eq(users.status, 'active'),
        ),
      );

    // Caseload counts: active care team memberships
    const caseloadRows = await this.db
      .select({
        userId: careTeamMembers.userId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(careTeamMembers)
      .innerJoin(episodes, eq(careTeamMembers.episodeId, episodes.id))
      .where(
        and(
          eq(careTeamMembers.active, true),
          eq(episodes.orgId, user.orgId),
          inArray(episodes.status, ['pre_admit', 'scheduled_soc', 'active']),
        ),
      )
      .groupBy(careTeamMembers.userId);

    const caseloadMap = new Map(caseloadRows.map((r) => [r.userId, Number(r.cnt)]));

    const scored = profiles.map((p) => {
      const breakdown = scoreClinicianForEpisode(
        {
          userId: p.userId,
          fullName: p.fullName,
          skills: (p.profile.skillsJson as string[]) ?? [],
          languages: (p.profile.languagesJson as string[]) ?? ['en'],
          homeBaseCity: p.profile.homeBaseCity,
          homeBaseState: p.profile.homeBaseState,
          homeBasePostal: p.profile.homeBasePostal,
          maxDailyVisits: p.profile.maxDailyVisits,
          activeCaseload: caseloadMap.get(p.userId) ?? 0,
        },
        {
          patientLanguage: patient?.preferredLanguage ?? 'en',
          serviceCity: addr?.city ?? null,
          serviceState: addr?.state ?? null,
          servicePostal: addr?.postalCode ?? null,
          requiredSkills: input.requiredSkills,
        },
      );
      return { userId: p.userId, fullName: p.fullName, breakdown };
    });

    scored.sort((a, b) => b.breakdown.total - a.breakdown.total);
    const top = scored.slice(0, input.limit);

    const inserted = [];
    for (const s of top) {
      const [row] = await this.db
        .insert(routeSuggestions)
        .values({
          orgId: user.orgId,
          episodeId: ep.id,
          patientId: ep.patientId,
          suggestedUserId: s.userId,
          status: 'pending',
          scoreTotal: s.breakdown.total,
          scoreBreakdownJson: s.breakdown,
          requiredSkillsJson: input.requiredSkills,
          engineVersion: ENGINE,
          createdBy: user.id,
        })
        .returning();
      inserted.push({ ...row, suggestedFullName: s.fullName });
    }

    await this.audit.writeFromUser(user, {
      action: 'routing.suggest',
      resourceType: 'episode',
      resourceId: ep.id,
      patientId: ep.patientId,
      episodeId: ep.id,
      after: {
        count: inserted.length,
        engine: ENGINE,
        topUserId: inserted[0]?.suggestedUserId,
      },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      data: inserted,
      engineVersion: ENGINE,
      hitlRequired: true,
      disclaimer:
        'Suggestions are advisory. A human must accept before care-team assignment. Not autonomous clinical routing.',
    };
  }

  async listSuggestions(user: AuthUser, episodeId?: string) {
    this.ensureFeature();
    const conditions = [
      eq(routeSuggestions.orgId, user.orgId),
    ];
    if (episodeId) conditions.push(eq(routeSuggestions.episodeId, episodeId));

    const rows = await this.db
      .select({
        suggestion: routeSuggestions,
        suggestedName: users.fullName,
      })
      .from(routeSuggestions)
      .innerJoin(users, eq(routeSuggestions.suggestedUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(routeSuggestions.createdAt))
      .limit(100);

    return {
      data: rows.map((r) => ({
        ...r.suggestion,
        suggestedFullName: r.suggestedName,
      })),
      hitlRequired: true,
    };
  }

  async decide(
    user: AuthUser,
    suggestionId: string,
    input: DecideRouteSuggestionInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const [row] = await this.db
      .select()
      .from(routeSuggestions)
      .where(
        and(
          eq(routeSuggestions.id, suggestionId),
          eq(routeSuggestions.orgId, user.orgId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Suggestion not found' },
      });
    }
    if (row.status !== 'pending') {
      throw new ForbiddenException({
        error: { code: 'INVALID_STATUS', message: 'Suggestion already decided' },
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(routeSuggestions)
        .set({
          status: input.decision,
          decidedAt: new Date(),
          decidedBy: user.id,
          decisionReasonCode: input.reasonCode,
          decisionNote: input.note ?? null,
        })
        .where(eq(routeSuggestions.id, suggestionId));

      if (input.decision === 'accepted' && input.assignToCareTeam) {
        // deactivate other primary_rn then assign
        await tx
          .update(careTeamMembers)
          .set({ active: false })
          .where(
            and(
              eq(careTeamMembers.episodeId, row.episodeId),
              eq(careTeamMembers.teamRole, 'primary_rn'),
            ),
          );

        await tx.insert(careTeamMembers).values({
          orgId: user.orgId,
          episodeId: row.episodeId,
          userId: row.suggestedUserId,
          teamRole: 'primary_rn',
          active: true,
          assignedBy: user.id,
        });

        await tx
          .update(episodes)
          .set({
            socClinicianId: row.suggestedUserId,
            updatedAt: new Date(),
            updatedBy: user.id,
          })
          .where(eq(episodes.id, row.episodeId));
      }

      await this.audit.writeFromUser(
        user,
        {
          action:
            input.decision === 'accepted' ? 'routing.accept' : 'routing.reject',
          resourceType: 'route_suggestion',
          resourceId: suggestionId,
          patientId: row.patientId,
          episodeId: row.episodeId,
          after: {
            decision: input.decision,
            reasonCode: input.reasonCode,
            suggestedUserId: row.suggestedUserId,
            assignToCareTeam: input.assignToCareTeam,
          },
          reason: input.note,
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    return this.listSuggestions(user, row.episodeId);
  }

  // ── Visit tasks ──────────────────────────────────────────────────────────

  async createVisitTask(
    user: AuthUser,
    input: CreateVisitTaskInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const ep = await this.assertEpisode(user, input.episodeId);
    const patientId = input.patientId ?? ep.patientId;

    const [row] = await this.db
      .insert(visitTasks)
      .values({
        orgId: user.orgId,
        episodeId: ep.id,
        patientId,
        taskType: input.taskType,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        assigneeUserId: input.assigneeUserId ?? null,
        status: input.scheduledAt ? 'scheduled' : 'open',
        createdBy: user.id,
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'visit_task.create',
      resourceType: 'visit_task',
      resourceId: row!.id,
      patientId,
      episodeId: ep.id,
      after: { taskType: input.taskType, title: input.title },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async listVisitTasks(
    user: AuthUser,
    query: { status?: string; assigneeUserId?: string },
  ) {
    this.ensureFeature();
    const conditions = [
      eq(visitTasks.orgId, user.orgId),
      isNull(visitTasks.deletedAt),
    ];
    if (query.status) {
      conditions.push(eq(visitTasks.status, query.status as never));
    }
    if (query.assigneeUserId) {
      conditions.push(eq(visitTasks.assigneeUserId, query.assigneeUserId));
    }
    if (isFieldRnScoped(user)) {
      conditions.push(eq(visitTasks.assigneeUserId, user.id));
    }

    const rows = await this.db
      .select()
      .from(visitTasks)
      .where(and(...conditions))
      .orderBy(desc(visitTasks.updatedAt))
      .limit(100);
    return { data: rows };
  }

  async updateVisitTask(
    user: AuthUser,
    id: string,
    input: UpdateVisitTaskInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const [row] = await this.db
      .select()
      .from(visitTasks)
      .where(
        and(
          eq(visitTasks.id, id),
          eq(visitTasks.orgId, user.orgId),
          isNull(visitTasks.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Visit task not found' },
      });
    }
    if (isFieldRnScoped(user) && row.assigneeUserId !== user.id) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Not assigned to this task' },
      });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.status !== undefined) patch.status = input.status;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.dueAt !== undefined) {
      patch.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    }
    if (input.scheduledAt !== undefined) {
      patch.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    if (input.assigneeUserId !== undefined) {
      patch.assigneeUserId = input.assigneeUserId;
    }
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.status === 'completed') {
      patch.completedAt = new Date();
      patch.completedBy = user.id;
      patch.completionNote = input.completionNote ?? null;
    }

    const [updated] = await this.db
      .update(visitTasks)
      .set(patch)
      .where(eq(visitTasks.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'visit_task.update',
      resourceType: 'visit_task',
      resourceId: id,
      patientId: row.patientId,
      episodeId: row.episodeId,
      after: { status: updated!.status },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Hospitalization alerts ───────────────────────────────────────────────

  async createAlert(
    user: AuthUser,
    input: CreateHospitalizationAlertInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const [patient] = await this.db
      .select()
      .from(patients)
      .where(
        and(eq(patients.id, input.patientId), eq(patients.orgId, user.orgId)),
      )
      .limit(1);
    if (!patient) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    const [row] = await this.db
      .insert(hospitalizationAlerts)
      .values({
        orgId: user.orgId,
        patientId: input.patientId,
        episodeId: input.episodeId ?? null,
        facilityName: input.facilityName,
        admittedAt: input.admittedAt ? new Date(input.admittedAt) : null,
        source: input.source,
        notes: input.notes ?? null,
        externalRef: input.externalRef ?? null,
        createdBy: user.id,
      })
      .returning();

    // Auto-create follow-up visit task when episode known
    if (input.episodeId) {
      await this.db.insert(visitTasks).values({
        orgId: user.orgId,
        episodeId: input.episodeId,
        patientId: input.patientId,
        taskType: 'hospitalization_followup',
        title: `Hospitalization follow-up: ${input.facilityName}`,
        description: 'Auto-created from hospitalization alert (HITL).',
        priority: 'urgent',
        status: 'open',
        createdBy: user.id,
      });
    }

    await this.audit.writeFromUser(user, {
      action: 'hospitalization_alert.create',
      resourceType: 'hospitalization_alert',
      resourceId: row!.id,
      patientId: input.patientId,
      episodeId: input.episodeId,
      after: { facilityName: input.facilityName, source: input.source },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async listAlerts(user: AuthUser, status?: string) {
    this.ensureFeature();
    const conditions = [eq(hospitalizationAlerts.orgId, user.orgId)];
    if (status) {
      conditions.push(eq(hospitalizationAlerts.status, status as never));
    }
    const rows = await this.db
      .select()
      .from(hospitalizationAlerts)
      .where(and(...conditions))
      .orderBy(desc(hospitalizationAlerts.createdAt))
      .limit(100);
    return { data: rows };
  }

  async updateAlert(
    user: AuthUser,
    id: string,
    input: UpdateHospitalizationAlertInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    this.ensureFeature();
    const [row] = await this.db
      .select()
      .from(hospitalizationAlerts)
      .where(
        and(
          eq(hospitalizationAlerts.id, id),
          eq(hospitalizationAlerts.orgId, user.orgId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      updatedAt: new Date(),
    };
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status === 'acknowledged' || input.status === 'in_progress') {
      patch.acknowledgedAt = new Date();
      patch.acknowledgedBy = user.id;
    }

    const [updated] = await this.db
      .update(hospitalizationAlerts)
      .set(patch)
      .where(eq(hospitalizationAlerts.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'hospitalization_alert.update',
      resourceType: 'hospitalization_alert',
      resourceId: id,
      patientId: row.patientId,
      episodeId: row.episodeId,
      after: { status: input.status },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
