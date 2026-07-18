import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  clinicalHistoryItems,
  consentRecords,
  consentTemplates,
  coverages,
  episodes,
  intakeChecklistItems,
  organizations,
  patientAddresses,
  patientContacts,
  patients,
  referrals,
  type HhosDb,
} from '@hhos/db';
import type { ChecklistCode } from '@hhos/shared';
import { DB } from './db.module';

/** Completeness score weights (MVP) — docs/domain/intake-checklist.md */
const SCORE_WEIGHTS: Partial<Record<ChecklistCode, number>> = {
  DEMOGRAPHICS_COMPLETE: 8,
  SERVICE_ADDRESS: 7,
  PRIMARY_COVERAGE: 10,
  COVERAGE_VERIFIED: 5,
  NPP_ACK: 8,
  ADMISSION_CONSENT: 9,
  PHOTO_CONSENT: 10,
  ROI: 0,
  FINANCIAL: 8,
  F2F_STATUS_KNOWN: 10,
  ORDERS_STATUS_KNOWN: 10,
  PRIMARY_DX_PRESENT: 5,
  HISTORY_STARTED: 10,
  SURROGATE_DOCUMENTED: 0,
};

const CONSENT_TYPE_TO_CHECKLIST: Record<string, ChecklistCode> = {
  HIPAA_NPP: 'NPP_ACK',
  ADMISSION: 'ADMISSION_CONSENT',
  WOUND_PHOTO: 'PHOTO_CONSENT',
  ROI: 'ROI',
  FINANCIAL: 'FINANCIAL',
};

/** Open episode statuses that still participate in intake recompute. */
const OPEN_EPISODE_STATUSES = ['pre_admit', 'scheduled_soc', 'active'] as const;

export type ChecklistSeedItem = {
  code: ChecklistCode;
  required: boolean;
};

/** DB or transaction handle used for multi-write flows. */
export type ChecklistExecutor = HhosDb;

@Injectable()
export class ChecklistService {
  constructor(@Inject(DB) private readonly db: HhosDb) {}

  /** Default checklist seeded on referral accept. */
  async seedForEpisode(
    orgId: string,
    episodeId: string,
    opts?: { woundPathway?: boolean; capacityImpaired?: boolean },
    executor?: ChecklistExecutor,
  ): Promise<void> {
    const db = executor ?? this.db;
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const coverageVerifiedRequired = org?.settings?.coverageVerifiedRequired ?? false;
    const woundPathway =
      opts?.woundPathway ?? org?.settings?.woundPathwayDefault ?? true;
    const capacityImpaired = opts?.capacityImpaired ?? false;

    const items: ChecklistSeedItem[] = [
      { code: 'DEMOGRAPHICS_COMPLETE', required: true },
      { code: 'SERVICE_ADDRESS', required: true },
      { code: 'PRIMARY_COVERAGE', required: true },
      { code: 'COVERAGE_VERIFIED', required: coverageVerifiedRequired },
      { code: 'NPP_ACK', required: true },
      { code: 'ADMISSION_CONSENT', required: true },
      { code: 'PHOTO_CONSENT', required: woundPathway },
      { code: 'ROI', required: false },
      { code: 'FINANCIAL', required: true },
      { code: 'F2F_STATUS_KNOWN', required: true },
      { code: 'ORDERS_STATUS_KNOWN', required: true },
      { code: 'PRIMARY_DX_PRESENT', required: false },
      { code: 'HISTORY_STARTED', required: false },
      { code: 'SURROGATE_DOCUMENTED', required: capacityImpaired },
    ];

    for (const item of items) {
      await db
        .insert(intakeChecklistItems)
        .values({
          orgId,
          episodeId,
          code: item.code,
          required: item.required,
          status: 'pending',
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Recompute checklist item statuses from source data for an episode.
   * Updates completeness on linked referral and intake_status on episode.
   */
  async recomputeForEpisode(
    episodeId: string,
    actorUserId?: string,
    executor?: ChecklistExecutor,
  ): Promise<void> {
    const db = executor ?? this.db;
    const [episode] = await db
      .select()
      .from(episodes)
      .where(and(eq(episodes.id, episodeId), isNull(episodes.deletedAt)))
      .limit(1);
    if (!episode) return;

    const patientId = episode.patientId;

    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)))
      .limit(1);

    const addresses = await db
      .select()
      .from(patientAddresses)
      .where(
        and(
          eq(patientAddresses.patientId, patientId),
          isNull(patientAddresses.deletedAt),
        ),
      );

    const contacts = await db
      .select()
      .from(patientContacts)
      .where(
        and(
          eq(patientContacts.patientId, patientId),
          isNull(patientContacts.deletedAt),
        ),
      );

    const covs = await db
      .select()
      .from(coverages)
      .where(and(eq(coverages.patientId, patientId), isNull(coverages.deletedAt)));

    const history = await db
      .select()
      .from(clinicalHistoryItems)
      .where(
        and(
          eq(clinicalHistoryItems.patientId, patientId),
          isNull(clinicalHistoryItems.deletedAt),
        ),
      );

    const signedConsents = await db
      .select({
        consentType: consentTemplates.consentType,
        status: consentRecords.status,
        expiresAt: consentRecords.expiresAt,
      })
      .from(consentRecords)
      .innerJoin(consentTemplates, eq(consentRecords.templateId, consentTemplates.id))
      .where(
        and(eq(consentRecords.patientId, patientId), eq(consentRecords.status, 'signed')),
      );

    const now = new Date();
    const activeConsentTypes = new Set(
      signedConsents
        .filter((c) => !c.expiresAt || c.expiresAt > now)
        .map((c) => c.consentType),
    );

    const primaryCoverage = covs.find((c) => c.rank === 1) ?? covs[0];
    const hasServiceAddress = addresses.some((a) => a.type === 'service');
    const demographicsOk = Boolean(
      patient?.firstName && patient?.lastName && patient?.dob,
    );
    const hasSurrogate = contacts.some((c) => c.type === 'surrogate');
    const historyStarted = history.length > 0;
    const f2fKnown = episode.f2fStatus !== 'unknown';
    const ordersKnown = episode.ordersStatus !== 'missing';
    const hasPrimaryDx = Boolean(episode.primaryDxIcd10);

    // Always sync required from current capacity (clears when no longer impaired)
    const surrogateRequired = patient?.capacityStatus === 'impaired';
    await db
      .update(intakeChecklistItems)
      .set({ required: surrogateRequired, updatedAt: now })
      .where(
        and(
          eq(intakeChecklistItems.episodeId, episodeId),
          eq(intakeChecklistItems.code, 'SURROGATE_DOCUMENTED'),
        ),
      );

    const derived: Record<ChecklistCode, boolean> = {
      DEMOGRAPHICS_COMPLETE: demographicsOk,
      SERVICE_ADDRESS: hasServiceAddress,
      PRIMARY_COVERAGE: Boolean(primaryCoverage),
      COVERAGE_VERIFIED: primaryCoverage?.verificationStatus === 'active',
      NPP_ACK: activeConsentTypes.has('HIPAA_NPP'),
      ADMISSION_CONSENT: activeConsentTypes.has('ADMISSION'),
      PHOTO_CONSENT: activeConsentTypes.has('WOUND_PHOTO'),
      ROI: activeConsentTypes.has('ROI'),
      FINANCIAL: activeConsentTypes.has('FINANCIAL'),
      F2F_STATUS_KNOWN: f2fKnown,
      ORDERS_STATUS_KNOWN: ordersKnown,
      PRIMARY_DX_PRESENT: hasPrimaryDx,
      HISTORY_STARTED: historyStarted,
      SURROGATE_DOCUMENTED: hasSurrogate,
    };

    const existing = await db
      .select()
      .from(intakeChecklistItems)
      .where(eq(intakeChecklistItems.episodeId, episodeId));

    for (const item of existing) {
      const done = derived[item.code as ChecklistCode] ?? false;
      if (item.status === 'waived' || item.status === 'blocked') continue;

      const nextStatus = done ? 'complete' : 'pending';
      if (item.status !== nextStatus) {
        await db
          .update(intakeChecklistItems)
          .set({
            status: nextStatus,
            completedAt: done ? now : null,
            completedBy: done ? (actorUserId ?? null) : null,
            updatedAt: now,
          })
          .where(eq(intakeChecklistItems.id, item.id));
      }
    }

    const refreshed = await db
      .select()
      .from(intakeChecklistItems)
      .where(eq(intakeChecklistItems.episodeId, episodeId));

    let score = 0;
    for (const item of refreshed) {
      if (item.status === 'complete' || item.status === 'waived') {
        score += SCORE_WEIGHTS[item.code as ChecklistCode] ?? 0;
      }
    }
    score = Math.min(100, Math.round(score));

    const requiredIncomplete = refreshed.some(
      (i) => i.required && i.status !== 'complete' && i.status !== 'waived',
    );
    const intakeStatus = requiredIncomplete ? 'incomplete' : 'ready_for_soc';

    await db
      .update(episodes)
      .set({ intakeStatus, updatedAt: now, updatedBy: actorUserId ?? null })
      .where(eq(episodes.id, episodeId));

    if (episode.referralId) {
      await db
        .update(referrals)
        .set({ completenessScore: score, updatedAt: now })
        .where(eq(referrals.id, episode.referralId));
    }
  }

  /** Recompute open intake episodes for a patient (after patient-level mutations). */
  async recomputeForPatient(
    patientId: string,
    actorUserId?: string,
    executor?: ChecklistExecutor,
  ): Promise<void> {
    const db = executor ?? this.db;
    const eps = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.patientId, patientId),
          isNull(episodes.deletedAt),
          inArray(episodes.status, [...OPEN_EPISODE_STATUSES]),
        ),
      );

    for (const ep of eps) {
      await this.recomputeForEpisode(ep.id, actorUserId, db);
    }
  }

  checklistCodeForConsentType(consentType: string): ChecklistCode | null {
    return CONSENT_TYPE_TO_CHECKLIST[consentType] ?? null;
  }
}
