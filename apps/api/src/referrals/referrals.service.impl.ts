import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  episodeTimelineEvents,
  episodes,
  organizations,
  patients,
  referrals,
  type HhosDb,
} from '@hhos/db';
import {
  DEFAULT_SOC_DUE_HOURS,
  type CreateReferralInput,
  type DeclineReferralInput,
  type InboundReferralEmailInput,
  type IngestReferralDocumentInput,
  type UpdateReferralInput,
} from '@hhos/shared';
import { extractReferralFromText, looksLikeReferral } from './referral-extract';
import { DB } from '../common/db.module';
import { ChecklistService } from '../common/checklist.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { isUniqueViolation } from '../common/db-errors';
import { insertPatientWithMrnRetry } from '../common/insert-patient';

function clip(s: string | undefined | null, max: number): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function sanitizeIcd10(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 10);
  return cleaned || undefined;
}

@Injectable()
export class ReferralsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly checklist: ChecklistService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string) {
    const rows = await this.db
      .select({
        id: referrals.id,
        status: referrals.status,
        sourceType: referrals.sourceType,
        sourceName: referrals.sourceName,
        receivedAt: referrals.receivedAt,
        acuity: referrals.acuity,
        completenessScore: referrals.completenessScore,
        patientId: referrals.patientId,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        mrn: patients.mrn,
        reasonForReferral: referrals.reasonForReferral,
      })
      .from(referrals)
      .innerJoin(patients, eq(referrals.patientId, patients.id))
      .where(and(eq(referrals.orgId, orgId), isNull(referrals.deletedAt)))
      .orderBy(desc(referrals.receivedAt))
      .limit(50);
    return { data: rows };
  }

  async getById(orgId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.orgId, orgId), eq(referrals.id, id), isNull(referrals.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  private async findByIdempotencyKey(orgId: string, key: string) {
    const [existing] = await this.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.orgId, orgId), eq(referrals.idempotencyKey, key)))
      .limit(1);
    return existing ?? null;
  }

  async create(
    user: AuthUser,
    input: CreateReferralInput,
    opts?: { idempotencyKey?: string; requestId?: string; ip?: string },
  ) {
    if (opts?.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(user.orgId, opts.idempotencyKey);
      if (existing) return { ...existing, _idempotentReplay: true as const };
    }
    try {
      return await this.db.transaction(async (tx) => {
        let patientId = input.patientId;
        if (!patientId && input.patient) {
          const p = await insertPatientWithMrnRetry(tx, {
            orgId: user.orgId,
            firstName: input.patient.firstName,
            lastName: input.patient.lastName,
            dob: input.patient.dob,
            preferredLanguage: input.patient.preferredLanguage ?? 'en',
            status: 'prospect',
            createdBy: user.id,
            updatedBy: user.id,
          });
          patientId = p.id;
          await this.audit.writeFromUser(
            user,
            {
              action: 'patient.create',
              resourceType: 'patient',
              resourceId: patientId,
              patientId,
              after: { mrn: p.mrn, firstName: input.patient.firstName, lastName: input.patient.lastName },
              requestId: opts?.requestId,
              ip: opts?.ip,
            },
            tx,
          );
        }
        if (!patientId) {
          throw new BadRequestException({
            error: { code: 'VALIDATION_FAILED', message: 'patientId or patient required' },
          });
        }
        const [pat] = await tx
          .select({ id: patients.id })
          .from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.orgId, user.orgId), isNull(patients.deletedAt)))
          .limit(1);
        if (!pat) {
          throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Patient not found' } });
        }
        const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
        const [created] = await tx
          .insert(referrals)
          .values({
            orgId: user.orgId,
            patientId,
            externalRef: input.externalRef ?? null,
            sourceType: input.sourceType,
            sourceName: input.sourceName,
            sourceContact: input.sourceContact ?? null,
            receivedAt,
            acuity: input.acuity ?? 'routine',
            reasonForReferral: input.reasonForReferral,
            primaryDiagnosisText: input.primaryDiagnosisText ?? null,
            primaryDiagnosisIcd10: input.primaryDiagnosisIcd10 ?? null,
            requestedServices: JSON.stringify(input.requestedServices ?? ['skilled_nursing']),
            status: 'new',
            completenessScore: 0,
            idempotencyKey: opts?.idempotencyKey ?? null,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        await this.audit.writeFromUser(
          user,
          {
            action: 'referral.create',
            resourceType: 'referral',
            resourceId: created.id,
            patientId,
            after: { status: created.status, sourceType: created.sourceType, sourceName: created.sourceName },
            requestId: opts?.requestId,
            ip: opts?.ip,
          },
          tx,
        );
        return created;
      });
    } catch (err) {
      if (opts?.idempotencyKey && isUniqueViolation(err)) {
        const existing = await this.findByIdempotencyKey(user.orgId, opts.idempotencyKey);
        if (existing) return { ...existing, _idempotentReplay: true as const };
      }
      throw err;
    }
  }

  async update(user: AuthUser, id: string, input: UpdateReferralInput, meta?: { requestId?: string }) {
    const before = await this.getById(user.orgId, id);
    if (!before) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Referral not found' } });
    }
    const [updated] = await this.db
      .update(referrals)
      .set({
        ...(input.status ? { status: input.status } : {}),
        ...(input.acuity !== undefined ? { acuity: input.acuity } : {}),
        ...(input.reasonForReferral !== undefined ? { reasonForReferral: input.reasonForReferral } : {}),
        ...(input.primaryDiagnosisText !== undefined
          ? { primaryDiagnosisText: input.primaryDiagnosisText }
          : {}),
        ...(input.primaryDiagnosisIcd10 !== undefined
          ? { primaryDiagnosisIcd10: input.primaryDiagnosisIcd10 }
          : {}),
        ...(input.intakeOwnerId !== undefined ? { intakeOwnerId: input.intakeOwnerId } : {}),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(and(eq(referrals.id, id), eq(referrals.orgId, user.orgId)))
      .returning();
    await this.audit.writeFromUser(user, {
      action: 'referral.update',
      resourceType: 'referral',
      resourceId: id,
      patientId: before.patientId,
      before: { status: before.status },
      after: { status: updated.status },
      requestId: meta?.requestId,
    });
    return updated;
  }

  private async alreadyAcceptedResult(orgId: string, referralId: string) {
    const [referral] = await this.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.id, referralId), eq(referrals.orgId, orgId)))
      .limit(1);
    const [episode] = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.referralId, referralId))
      .limit(1);
    if (referral && episode) return { referral, episode, _alreadyAccepted: true as const };
    return null;
  }

  async accept(user: AuthUser, id: string, meta?: { requestId?: string; ip?: string }) {
    const referral = await this.getById(user.orgId, id);
    if (!referral) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Referral not found' } });
    }
    if (referral.status === 'declined' || referral.status === 'cancelled') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATE', message: `Cannot accept referral in status ${referral.status}` },
      });
    }
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(referrals)
          .where(and(eq(referrals.id, id), eq(referrals.orgId, user.orgId)))
          .limit(1);
        if (!current) {
          throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Referral not found' } });
        }
        if (current.status === 'accepted' || current.status === 'converted') {
          const [existingEp] = await tx.select().from(episodes).where(eq(episodes.referralId, id)).limit(1);
          if (existingEp) return { referral: current, episode: existingEp, _alreadyAccepted: true as const };
        }
        const [org] = await tx.select().from(organizations).where(eq(organizations.id, user.orgId)).limit(1);
        const socHours =
          (org?.settings as { socDueHours?: number } | null)?.socDueHours ??
          Number(process.env.SOC_DUE_HOURS ?? DEFAULT_SOC_DUE_HOURS);
        const socDueAt = new Date(current.receivedAt.getTime() + socHours * 60 * 60 * 1000);
        const [episode] = await tx
          .insert(episodes)
          .values({
            orgId: user.orgId,
            patientId: current.patientId,
            referralId: current.id,
            episodeNumber: 1,
            careType: 'home_health',
            status: 'pre_admit',
            referralReceivedAt: current.receivedAt,
            socDueAt,
            primaryDxIcd10: current.primaryDiagnosisIcd10,
            primaryDxText: current.primaryDiagnosisText,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        const [updatedReferral] = await tx
          .update(referrals)
          .set({ status: 'accepted', updatedAt: new Date(), updatedBy: user.id })
          .where(eq(referrals.id, id))
          .returning();
        await tx.insert(episodeTimelineEvents).values({
          orgId: user.orgId,
          episodeId: episode.id,
          eventType: 'referral_accepted',
          summary: 'Referral accepted — intake started',
          createdBy: user.id,
        });
        try {
          await this.checklist.seedForEpisode(user.orgId, episode.id, {}, tx as never);
        } catch {
          /* best-effort */
        }
        await this.audit.writeFromUser(
          user,
          {
            action: 'referral.accept',
            resourceType: 'referral',
            resourceId: id,
            patientId: current.patientId,
            episodeId: episode.id,
            after: { status: 'accepted', episodeId: episode.id, socDueAt },
            requestId: meta?.requestId,
            ip: meta?.ip,
          },
          tx,
        );
        return { referral: updatedReferral, episode };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const replay = await this.alreadyAcceptedResult(user.orgId, id);
        if (replay) return replay;
      }
      throw err;
    }
  }

  async decline(user: AuthUser, id: string, input: DeclineReferralInput, meta?: { requestId?: string }) {
    const referral = await this.getById(user.orgId, id);
    if (!referral) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Referral not found' } });
    }
    if (referral.status === 'accepted' || referral.status === 'converted') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATE', message: 'Cannot decline an accepted referral' },
      });
    }
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(referrals)
        .set({
          status: 'declined',
          declineReason: input.reason,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(referrals.id, id))
        .returning();
      await this.audit.writeFromUser(
        user,
        {
          action: 'referral.decline',
          resourceType: 'referral',
          resourceId: id,
          patientId: referral.patientId,
          before: { status: referral.status },
          after: { status: 'declined' },
          reason: input.reason,
          requestId: meta?.requestId,
        },
        tx,
      );
      return updated;
    });
  }

  async ingestDocument(
    user: AuthUser,
    input: IngestReferralDocumentInput,
    meta?: { requestId?: string; ip?: string },
  ) {
    const extracted = extractReferralFromText(input.text, { fileName: input.fileName });
    if (input.sourceHint && !extracted.sourceType) extracted.sourceType = input.sourceHint;

    // Sanitize for create schema limits
    extracted.primaryDiagnosisIcd10 = sanitizeIcd10(extracted.primaryDiagnosisIcd10);
    extracted.primaryDiagnosisText = clip(extracted.primaryDiagnosisText, 500);
    extracted.reasonForReferral = clip(extracted.reasonForReferral, 2000);
    extracted.sourceName = clip(extracted.sourceName, 200);
    extracted.sourceContact = clip(extracted.sourceContact, 200);
    extracted.externalRef = clip(extracted.externalRef, 100);

    const canDraft =
      input.createDraft !== false &&
      Boolean(extracted.patient?.firstName && extracted.patient?.lastName && extracted.patient?.dob);

    let referral: unknown = null;
    let draftError: string | undefined;

    if (canDraft) {
      try {
        referral = await this.create(
          user,
          {
            patient: {
              firstName: extracted.patient!.firstName!,
              lastName: extracted.patient!.lastName!,
              dob: extracted.patient!.dob!,
              preferredLanguage: 'en',
            },
            sourceType: extracted.sourceType ?? 'other',
            sourceName: extracted.sourceName ?? clip(input.fileName, 200) ?? 'Document upload',
            sourceContact: extracted.sourceContact,
            acuity: extracted.acuity ?? 'routine',
            reasonForReferral:
              extracted.reasonForReferral ??
              'Referral received via document — coordinator review required',
            primaryDiagnosisText: extracted.primaryDiagnosisText,
            primaryDiagnosisIcd10: extracted.primaryDiagnosisIcd10,
            externalRef: extracted.externalRef,
            requestedServices: ['skilled_nursing'],
          },
          meta,
        );
        if (referral && typeof referral === 'object' && referral !== null && 'id' in referral) {
          const rid = (referral as { id: string }).id;
          try {
            await this.update(user, rid, { status: 'in_review' }, meta);
          } catch {
            /* status update optional */
          }
          referral = await this.getById(user.orgId, rid);
        }
        await this.audit.writeFromUser(user, {
          action: 'referral.ingest_document',
          resourceType: 'referral',
          resourceId: (referral as { id?: string } | null)?.id,
          after: {
            fileName: input.fileName,
            confidence: extracted.confidence,
            factors: extracted.factors,
          },
          requestId: meta?.requestId,
          ip: meta?.ip,
        });
      } catch (err) {
        draftError =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Draft create failed';
        // Nest HTTP exceptions often nest message
        if (err && typeof err === 'object' && 'response' in err) {
          const r = (err as { response?: { error?: { message?: string }; message?: string } })
            .response;
          draftError = r?.error?.message ?? r?.message ?? draftError;
        }
      }
    }

    const missing: string[] = [];
    if (!extracted.patient?.firstName || !extracted.patient?.lastName) missing.push('patient name');
    if (!extracted.patient?.dob) missing.push('date of birth');

    return {
      extracted,
      draftCreated: Boolean(referral),
      referral,
      needsReview: true,
      draftError,
      missingFields: missing,
      message: referral
        ? 'Draft referral created for review. Accept to start intake.'
        : missing.length
          ? `Extraction complete — still need: ${missing.join(', ')}. Fill them below and Save referral.`
          : draftError
            ? `Extracted fields, but could not auto-create draft: ${draftError}. Use the form to save.`
            : 'Extraction complete — review and save.',
    };
  }

  async ingestEmail(
    user: AuthUser,
    input: InboundReferralEmailInput,
    meta?: { requestId?: string; ip?: string },
  ) {
    const detected = looksLikeReferral(input.text, input.subject);
    const extracted = extractReferralFromText(input.text, {
      subject: input.subject,
      from: input.from,
    });
    if (!detected && extracted.confidence < 0.45) {
      await this.audit.writeFromUser(user, {
        action: 'referral.email_skipped',
        resourceType: 'referral',
        after: { from: input.from, subject: input.subject, reason: 'does_not_look_like_referral' },
        requestId: meta?.requestId,
        ip: meta?.ip,
      });
      return {
        detected: false,
        extracted,
        draftCreated: false,
        referral: null,
        message: 'Message did not look like a home health referral — no draft created.',
      };
    }
    const combined = ['Subject: ' + (input.subject ?? ''), 'From: ' + input.from, '', input.text].join(
      '\n',
    );
    const result = await this.ingestDocument(
      user,
      {
        text: combined,
        fileName: input.messageId ? 'email:' + input.messageId : 'email:' + input.from,
        createDraft: true,
      },
      meta,
    );
    await this.audit.writeFromUser(user, {
      action: 'referral.email_inbound',
      resourceType: 'referral',
      resourceId: (result.referral as { id?: string } | null)?.id,
      after: {
        from: input.from,
        subject: input.subject,
        detected: true,
        confidence: extracted.confidence,
      },
      requestId: meta?.requestId,
      ip: meta?.ip,
    });
    return {
      detected: true,
      ...result,
      message: result.draftCreated
        ? 'Referral email processed — draft waiting for coordinator review.'
        : result.message,
    };
  }
}
