import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  episodes,
  oasisAssessments,
  oasisItemResponses,
  organizations,
  type HhosDb,
} from '@hhos/db';
import {
  DEFAULT_LUPA_VISIT_THRESHOLD,
  OASIS_E2_ITEMS,
  OASIS_ITEM_SET_VERSION,
  computeOasisGapsAndFlags,
  getOasisItem,
  oasisItemsBySection,
  validateAnswerValue,
  type CreateOasisAssessmentInput,
  type OasisAssessmentStatus,
  type OasisTimepoint,
  type ReviewOasisSchema,
  type UpsertOasisAnswersInput,
} from '@hhos/shared';
import { z } from 'zod';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { fieldRnCanAccessEpisode, isFieldRnScoped } from '../common/caseload';
import { isOasisEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';

type ReviewInput = z.infer<typeof ReviewOasisSchema>;

@Injectable()
export class OasisService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  private async ensureFeature(user: AuthUser): Promise<void> {
    const [org] = await this.db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    if (!isOasisEnabled(org?.settings as never)) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_OASIS is not enabled for this organization',
        },
      });
    }
  }

  private async assertEpisodeAccess(user: AuthUser, episodeId: string) {
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
          error: { code: 'NOT_ASSIGNED', message: 'Not on care team for episode' },
        });
      }
    }
    return ep;
  }

  itemLibrary() {
    // Item catalog is not PHI; gate only on platform FEATURE_OASIS.
    if (!isOasisEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_OASIS is not enabled',
        },
      });
    }
    return {
      itemSetVersion: OASIS_ITEM_SET_VERSION,
      disclaimer:
        'Subset for PDGM-critical capture. Re-validate against CMS OASIS-E2 before production lock.',
      sections: oasisItemsBySection(),
      items: OASIS_E2_ITEMS,
    };
  }

  async create(
    user: AuthUser,
    input: CreateOasisAssessmentInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const ep = await this.assertEpisodeAccess(user, input.episodeId);

    const [row] = await this.db
      .insert(oasisAssessments)
      .values({
        orgId: user.orgId,
        patientId: ep.patientId,
        episodeId: ep.id,
        timepoint: (input.timepoint ?? 'SOC') as OasisTimepoint,
        itemSetVersion: OASIS_ITEM_SET_VERSION,
        status: 'draft',
        assessmentDate: input.assessmentDate ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'oasis.create',
      resourceType: 'oasis_assessment',
      resourceId: row!.id,
      patientId: ep.patientId,
      episodeId: ep.id,
      after: { id: row!.id, timepoint: row!.timepoint, status: row!.status },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.getById(user, row!.id);
  }

  async list(
    user: AuthUser,
    query: { status?: OasisAssessmentStatus; episodeId?: string; page: number; pageSize: number },
  ) {
    await this.ensureFeature(user);
    const conditions = [
      eq(oasisAssessments.orgId, user.orgId),
      isNull(oasisAssessments.deletedAt),
    ];
    if (query.status) conditions.push(eq(oasisAssessments.status, query.status));
    if (query.episodeId) conditions.push(eq(oasisAssessments.episodeId, query.episodeId));

    let rows = await this.db
      .select({
        id: oasisAssessments.id,
        episodeId: oasisAssessments.episodeId,
        patientId: oasisAssessments.patientId,
        timepoint: oasisAssessments.timepoint,
        status: oasisAssessments.status,
        completenessScore: oasisAssessments.completenessScore,
        assessmentDate: oasisAssessments.assessmentDate,
        submittedAt: oasisAssessments.submittedAt,
        lockedAt: oasisAssessments.lockedAt,
        flagsJson: oasisAssessments.flagsJson,
        updatedAt: oasisAssessments.updatedAt,
      })
      .from(oasisAssessments)
      .where(and(...conditions))
      .orderBy(desc(oasisAssessments.updatedAt))
      .limit(200);

    if (isFieldRnScoped(user)) {
      const filtered = [];
      for (const r of rows) {
        if (await fieldRnCanAccessEpisode(this.db, user, r.episodeId)) {
          filtered.push(r);
        }
      }
      rows = filtered;
    }

    const start = (query.page - 1) * query.pageSize;
    return {
      data: rows.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: rows.length,
    };
  }

  async reviewQueue(user: AuthUser) {
    return this.list(user, { status: 'in_review', page: 1, pageSize: 50 });
  }

  async getById(user: AuthUser, id: string) {
    await this.ensureFeature(user);
    const [row] = await this.db
      .select()
      .from(oasisAssessments)
      .where(
        and(
          eq(oasisAssessments.id, id),
          eq(oasisAssessments.orgId, user.orgId),
          isNull(oasisAssessments.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      });
    }
    await this.assertEpisodeAccess(user, row.episodeId);

    const answers = await this.db
      .select()
      .from(oasisItemResponses)
      .where(eq(oasisItemResponses.assessmentId, id));

    const answerMap: Record<string, string | number | boolean | null> = {};
    for (const a of answers) {
      answerMap[a.itemId] = a.valueJson as string | number | boolean | null;
    }

    return {
      ...row,
      answers: answerMap,
      answerRows: answers,
      itemSetVersion: row.itemSetVersion,
      disclaimer:
        'PDGM/LUPA outputs are advisory only — not a CMS payment determination.',
    };
  }

  async upsertAnswers(
    user: AuthUser,
    id: string,
    input: UpsertOasisAnswersInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const assessment = await this.getById(user, id);
    if (assessment.status === 'locked' || assessment.status === 'void') {
      throw new ForbiddenException({
        error: { code: 'ASSESSMENT_LOCKED', message: 'Cannot edit locked/void assessment' },
      });
    }
    if (assessment.status === 'in_review' && !user.permissions.includes('oasis:review')) {
      throw new ForbiddenException({
        error: {
          code: 'IN_REVIEW',
          message: 'Assessment in review — only clinical lead can edit or return',
        },
      });
    }

    const validationErrors: Record<string, string> = {};
    for (const ans of input.answers) {
      const item = getOasisItem(ans.itemId);
      if (!item) {
        validationErrors[ans.itemId] = 'Unknown item';
        continue;
      }
      const err = validateAnswerValue(item, ans.value);
      if (err) validationErrors[ans.itemId] = err;
    }
    if (Object.keys(validationErrors).length) {
      return { ok: false as const, validationErrors };
    }

    await this.db.transaction(async (tx) => {
      for (const ans of input.answers) {
        const item = getOasisItem(ans.itemId)!;
        await tx
          .insert(oasisItemResponses)
          .values({
            orgId: user.orgId,
            assessmentId: id,
            itemId: ans.itemId,
            itemCode: item.code,
            valueJson: ans.value,
            answeredBy: user.id,
            answeredAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [oasisItemResponses.assessmentId, oasisItemResponses.itemId],
            set: {
              valueJson: ans.value,
              itemCode: item.code,
              answeredBy: user.id,
              answeredAt: new Date(),
            },
          });
      }

      const recomputed = await this.recompute(tx as unknown as HhosDb, id, user.id);
      await this.audit.writeFromUser(
        user,
        {
          action: 'oasis.answers_upsert',
          resourceType: 'oasis_assessment',
          resourceId: id,
          patientId: assessment.patientId,
          episodeId: assessment.episodeId,
          after: {
            answerCount: input.answers.length,
            completenessScore: recomputed.completenessScore,
          },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    return { ok: true as const, assessment: await this.getById(user, id) };
  }

  private async loadAnswerMap(
    db: HhosDb,
    assessmentId: string,
  ): Promise<Record<string, string | number | boolean | null>> {
    const rows = await db
      .select()
      .from(oasisItemResponses)
      .where(eq(oasisItemResponses.assessmentId, assessmentId));
    const map: Record<string, string | number | boolean | null> = {};
    for (const r of rows) {
      map[r.itemId] = r.valueJson as string | number | boolean | null;
    }
    return map;
  }

  private async recompute(db: HhosDb, assessmentId: string, userId: string) {
    const answers = await this.loadAnswerMap(db, assessmentId);
    const lupaThreshold = Number(process.env.LUPA_VISIT_THRESHOLD ?? DEFAULT_LUPA_VISIT_THRESHOLD);
    const { flags, gaps, pdgmHint } = computeOasisGapsAndFlags(answers, { lupaThreshold });
    const required = OASIS_E2_ITEMS.filter((i) => i.requiredForSoc).length;
    const answeredRequired = OASIS_E2_ITEMS.filter(
      (i) => i.requiredForSoc && answers[i.id] !== null && answers[i.id] !== undefined && answers[i.id] !== '',
    ).length;
    const completenessScore =
      required === 0 ? 100 : Math.round((answeredRequired / required) * 100);

    await db
      .update(oasisAssessments)
      .set({
        flagsJson: flags,
        gapsJson: gaps,
        pdgmHintJson: pdgmHint,
        completenessScore,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(oasisAssessments.id, assessmentId));

    return { flags, gaps, pdgmHint, completenessScore };
  }

  async validate(user: AuthUser, id: string) {
    await this.ensureFeature(user);
    const assessment = await this.getById(user, id);
    const result = await this.recompute(this.db, id, user.id);
    return {
      assessmentId: id,
      status: assessment.status,
      ...result,
      canSubmit: result.gaps.length === 0,
      disclaimer: result.pdgmHint.disclaimer,
    };
  }

  async submit(
    user: AuthUser,
    id: string,
    note: string | undefined,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const assessment = await this.getById(user, id);
    if (assessment.status !== 'draft') {
      throw new ForbiddenException({
        error: { code: 'INVALID_STATUS', message: 'Only draft assessments can be submitted' },
      });
    }
    const result = await this.recompute(this.db, id, user.id);
    if (result.gaps.length > 0) {
      return {
        ok: false as const,
        code: 'CHECKLIST_INCOMPLETE',
        gaps: result.gaps,
        flags: result.flags,
      };
    }

    await this.db
      .update(oasisAssessments)
      .set({
        status: 'in_review',
        submittedAt: new Date(),
        submittedBy: user.id,
        reviewNote: note ?? null,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(oasisAssessments.id, id));

    await this.audit.writeFromUser(user, {
      action: 'oasis.submit',
      resourceType: 'oasis_assessment',
      resourceId: id,
      patientId: assessment.patientId,
      episodeId: assessment.episodeId,
      after: { status: 'in_review' },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true as const, assessment: await this.getById(user, id) };
  }

  async review(
    user: AuthUser,
    id: string,
    input: ReviewInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const assessment = await this.getById(user, id);
    if (assessment.status !== 'in_review') {
      throw new ForbiddenException({
        error: { code: 'INVALID_STATUS', message: 'Assessment is not in review' },
      });
    }

    if (input.action === 'return_draft') {
      await this.db
        .update(oasisAssessments)
        .set({
          status: 'draft',
          reviewedAt: new Date(),
          reviewedBy: user.id,
          reviewNote: input.note ?? null,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(oasisAssessments.id, id));
      await this.audit.writeFromUser(user, {
        action: 'oasis.return_draft',
        resourceType: 'oasis_assessment',
        resourceId: id,
        patientId: assessment.patientId,
        episodeId: assessment.episodeId,
        reason: input.note,
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return this.getById(user, id);
    }

    // approve_lock
    const result = await this.recompute(this.db, id, user.id);
    if (result.gaps.length > 0) {
      return {
        ok: false as const,
        code: 'CHECKLIST_INCOMPLETE',
        gaps: result.gaps,
      };
    }

    await this.db
      .update(oasisAssessments)
      .set({
        status: 'locked',
        reviewedAt: new Date(),
        reviewedBy: user.id,
        lockedAt: new Date(),
        lockedBy: user.id,
        reviewNote: input.note ?? null,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(oasisAssessments.id, id));

    // Sync primary dx onto episode if present (advisory clinical linkage)
    const dx = result.pdgmHint.primaryDxIcd10;
    if (dx) {
      await this.db
        .update(episodes)
        .set({ primaryDxIcd10: dx, updatedAt: new Date(), updatedBy: user.id })
        .where(eq(episodes.id, assessment.episodeId));
    }

    await this.audit.writeFromUser(user, {
      action: 'oasis.lock',
      resourceType: 'oasis_assessment',
      resourceId: id,
      patientId: assessment.patientId,
      episodeId: assessment.episodeId,
      after: { status: 'locked', primaryDx: dx },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true as const, assessment: await this.getById(user, id) };
  }
}
