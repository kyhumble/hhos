import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  consentRecords,
  consentRevocations,
  consentSignatures,
  consentTemplatePurposes,
  consentTemplates,
  episodeTimelineEvents,
  episodes,
  patients,
  type HhosDb,
} from '@hhos/db';
import type {
  CaptureConsentInput,
  PurposeCode,
  RevokeConsentInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import { ChecklistService } from '../common/checklist.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import {
  fieldRnCanAccessEpisode,
  fieldRnCanAccessPatient,
} from '../common/caseload';
import { isUniqueViolation } from '../common/db-errors';

@Injectable()
export class ConsentsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly checklist: ChecklistService,
    private readonly audit: AuditService,
  ) {}

  private async assertPatientAccess(user: AuthUser, patientId: string) {
    const ok = await fieldRnCanAccessPatient(this.db, user, patientId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Patient not on your caseload' },
      });
    }
  }

  async listActiveTemplates(orgId: string, locale?: string) {
    const rows = await this.db
      .select()
      .from(consentTemplates)
      .where(
        and(eq(consentTemplates.orgId, orgId), eq(consentTemplates.status, 'active')),
      );

    const filtered = locale ? rows.filter((r) => r.locale === locale) : rows;

    const withPurposes = await Promise.all(
      filtered.map(async (t) => {
        const purposes = await this.db
          .select()
          .from(consentTemplatePurposes)
          .where(eq(consentTemplatePurposes.templateId, t.id));
        return {
          id: t.id,
          consentType: t.consentType,
          version: t.version,
          title: t.title,
          locale: t.locale,
          isRequiredForAdmission: t.isRequiredForAdmission,
          isRequiredForWoundPhoto: t.isRequiredForWoundPhoto,
          allowsSurrogate: t.allowsSurrogate,
          purposes: purposes.map((p) => p.purposeCode),
        };
      }),
    );

    return { data: withPurposes };
  }

  async getTemplate(orgId: string, id: string) {
    const [t] = await this.db
      .select()
      .from(consentTemplates)
      .where(and(eq(consentTemplates.orgId, orgId), eq(consentTemplates.id, id)))
      .limit(1);
    if (!t) return null;

    const purposes = await this.db
      .select()
      .from(consentTemplatePurposes)
      .where(eq(consentTemplatePurposes.templateId, t.id));

    return {
      ...t,
      purposes: purposes.map((p) => p.purposeCode),
      legalNotice: 'NOT LEGAL FINAL — placeholder for counsel review',
    };
  }

  async listPatientConsents(user: AuthUser, patientId: string) {
    await this.assertPatientAccess(user, patientId);

    const [pat] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.orgId, user.orgId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);
    if (!pat) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    const rows = await this.db
      .select({
        id: consentRecords.id,
        status: consentRecords.status,
        templateId: consentRecords.templateId,
        templateVersion: consentRecords.templateVersion,
        templateBodySha256: consentRecords.templateBodySha256,
        capturedAt: consentRecords.capturedAt,
        captureMethod: consentRecords.captureMethod,
        signerType: consentRecords.signerType,
        signerName: consentRecords.signerName,
        signerRelationship: consentRecords.signerRelationship,
        patientPresent: consentRecords.patientPresent,
        localeUsed: consentRecords.localeUsed,
        expiresAt: consentRecords.expiresAt,
        episodeId: consentRecords.episodeId,
        consentType: consentTemplates.consentType,
        title: consentTemplates.title,
      })
      .from(consentRecords)
      .innerJoin(consentTemplates, eq(consentRecords.templateId, consentTemplates.id))
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.orgId, user.orgId),
        ),
      )
      .orderBy(desc(consentRecords.createdAt));

    return { data: rows };
  }

  private async findByIdempotencyKey(orgId: string, key: string) {
    const [existing] = await this.db
      .select()
      .from(consentRecords)
      .where(
        and(eq(consentRecords.orgId, orgId), eq(consentRecords.idempotencyKey, key)),
      )
      .limit(1);
    return existing ?? null;
  }

  async capture(
    user: AuthUser,
    patientId: string,
    input: CaptureConsentInput,
    opts?: {
      idempotencyKey?: string;
      requestId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    await this.assertPatientAccess(user, patientId);

    if (opts?.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(user.orgId, opts.idempotencyKey);
      if (existing) {
        return { ...existing, _idempotentReplay: true as const };
      }
    }

    const [patient] = await this.db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.orgId, user.orgId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (!patient) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    // Validate episode belongs to this patient + org; apply caseload on episode
    if (input.episodeId) {
      const [ep] = await this.db
        .select()
        .from(episodes)
        .where(
          and(
            eq(episodes.id, input.episodeId),
            eq(episodes.orgId, user.orgId),
            eq(episodes.patientId, patientId),
            isNull(episodes.deletedAt),
          ),
        )
        .limit(1);
      if (!ep) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'episodeId must reference an episode for this patient in your org',
          },
        });
      }
      const epOk = await fieldRnCanAccessEpisode(this.db, user, input.episodeId);
      if (!epOk) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Episode not on your caseload' },
        });
      }
    }

    const [template] = await this.db
      .select()
      .from(consentTemplates)
      .where(
        and(
          eq(consentTemplates.id, input.templateId),
          eq(consentTemplates.orgId, user.orgId),
          eq(consentTemplates.status, 'active'),
        ),
      )
      .limit(1);

    if (!template) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Active consent template not found' },
      });
    }

    if (patient.capacityStatus === 'impaired' && input.signerType === 'patient') {
      throw new BadRequestException({
        error: {
          code: 'SURROGATE_REQUIRED',
          message:
            'Patient capacity is impaired; consent must be signed by a surrogate',
        },
      });
    }

    if (input.signerType === 'surrogate') {
      if (!template.allowsSurrogate) {
        throw new BadRequestException({
          error: {
            code: 'SURROGATE_NOT_ALLOWED',
            message: 'This template does not allow surrogate signature',
          },
        });
      }
      if (!input.signerRelationship) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'signerRelationship required for surrogate',
          },
        });
      }
    }

    if (
      input.signature.type === 'typed' &&
      !input.signature.typedName &&
      !input.signature.dataBase64
    ) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'typedName required for typed signature',
        },
      });
    }

    try {
      return await this.db.transaction(async (tx) => {
        const capturedAt = new Date();

        const [record] = await tx
          .insert(consentRecords)
          .values({
            orgId: user.orgId,
            patientId,
            episodeId: input.episodeId ?? null,
            templateId: template.id,
            templateVersion: template.version,
            templateBodySha256: template.bodySha256,
            status: 'signed',
            capturedAt,
            capturedByUserId: user.id,
            captureMethod: input.captureMethod,
            signerType: input.signerType,
            signerName: input.signerName,
            signerRelationship: input.signerRelationship ?? null,
            patientPresent: input.patientPresent ?? true,
            localeUsed: input.localeUsed ?? 'en',
            ipAddress: opts?.ip ?? null,
            idempotencyKey: opts?.idempotencyKey ?? null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            notes: input.notes ?? null,
          })
          .returning();

        await tx.insert(consentSignatures).values({
          consentRecordId: record!.id,
          signatureType: input.signature.type,
          signatureBlobKey:
            input.signature.type !== 'typed' && input.signature.dataBase64
              ? `inline:${record!.id}`
              : null,
          typedName:
            input.signature.typedName ??
            (input.signature.type === 'typed' ? input.signerName : null),
          attestedStatement: `I have read and understand the ${template.title}`,
        });

        if (input.episodeId) {
          await tx.insert(episodeTimelineEvents).values({
            orgId: user.orgId,
            episodeId: input.episodeId,
            eventType: 'consent_captured',
            summary: `Consent signed: ${template.consentType}`,
            actorUserId: user.id,
            metadata: JSON.stringify({
              consentRecordId: record!.id,
              consentType: template.consentType,
            }),
          });
          await this.checklist.recomputeForEpisode(
            input.episodeId,
            user.id,
            tx as unknown as HhosDb,
          );
        } else {
          await this.checklist.recomputeForPatient(
            patientId,
            user.id,
            tx as unknown as HhosDb,
          );
        }

        await this.audit.writeFromUser(
          user,
          {
            action: 'consent.capture',
            resourceType: 'consent_record',
            resourceId: record!.id,
            patientId,
            episodeId: input.episodeId ?? null,
            after: {
              id: record!.id,
              consentType: template.consentType,
              templateVersion: template.version,
              templateBodySha256: template.bodySha256,
              status: 'signed',
              signerType: input.signerType,
            },
            requestId: opts?.requestId,
            ip: opts?.ip,
            userAgent: opts?.userAgent,
          },
          tx,
        );

        return {
          ...record,
          consentType: template.consentType,
          title: template.title,
          legalNotice: 'NOT LEGAL FINAL — placeholder for counsel review',
        };
      });
    } catch (err) {
      if (opts?.idempotencyKey && isUniqueViolation(err)) {
        const existing = await this.findByIdempotencyKey(user.orgId, opts.idempotencyKey);
        if (existing) {
          return { ...existing, _idempotentReplay: true as const };
        }
      }
      throw err;
    }
  }

  async revoke(
    user: AuthUser,
    consentId: string,
    input: RevokeConsentInput,
    meta?: { requestId?: string },
  ) {
    const [record] = await this.db
      .select()
      .from(consentRecords)
      .where(
        and(eq(consentRecords.id, consentId), eq(consentRecords.orgId, user.orgId)),
      )
      .limit(1);

    if (!record) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Consent record not found' },
      });
    }

    await this.assertPatientAccess(user, record.patientId);

    if (record.status === 'revoked') {
      return { ...record, _alreadyRevoked: true as const };
    }

    if (record.status !== 'signed') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATE',
          message: `Cannot revoke consent in status ${record.status}`,
        },
      });
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(consentRecords)
        .set({ status: 'revoked' })
        .where(eq(consentRecords.id, consentId))
        .returning();

      await tx.insert(consentRevocations).values({
        consentRecordId: consentId,
        revokedByUserId: user.id,
        revokedByParty: input.revokedByParty,
        reason: input.reason,
        method: input.method ?? null,
      });

      if (record.episodeId) {
        await this.checklist.recomputeForEpisode(
          record.episodeId,
          user.id,
          tx as unknown as HhosDb,
        );
      } else {
        await this.checklist.recomputeForPatient(
          record.patientId,
          user.id,
          tx as unknown as HhosDb,
        );
      }

      await this.audit.writeFromUser(
        user,
        {
          action: 'consent.revoke',
          resourceType: 'consent_record',
          resourceId: consentId,
          patientId: record.patientId,
          episodeId: record.episodeId,
          before: { status: record.status },
          after: { status: 'revoked' },
          reason: input.reason,
          requestId: meta?.requestId,
        },
        tx,
      );

      return updated;
    });
  }

  async activePurposes(user: AuthUser, patientId: string) {
    await this.assertPatientAccess(user, patientId);

    const [pat] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.orgId, user.orgId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (!pat) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    const signed = await this.db
      .select({
        recordId: consentRecords.id,
        templateId: consentRecords.templateId,
        expiresAt: consentRecords.expiresAt,
        consentType: consentTemplates.consentType,
      })
      .from(consentRecords)
      .innerJoin(consentTemplates, eq(consentRecords.templateId, consentTemplates.id))
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.orgId, user.orgId),
          eq(consentRecords.status, 'signed'),
        ),
      );

    const now = new Date();
    const purposeSet = new Set<PurposeCode>();
    const grants: {
      purposeCode: PurposeCode;
      consentRecordId: string;
      consentType: string;
    }[] = [];

    for (const s of signed) {
      if (s.expiresAt && s.expiresAt <= now) continue;
      const purposes = await this.db
        .select()
        .from(consentTemplatePurposes)
        .where(eq(consentTemplatePurposes.templateId, s.templateId));
      for (const p of purposes) {
        const code = p.purposeCode as PurposeCode;
        if (!purposeSet.has(code)) {
          purposeSet.add(code);
          grants.push({
            purposeCode: code,
            consentRecordId: s.recordId,
            consentType: s.consentType,
          });
        }
      }
    }

    return {
      patientId,
      purposes: [...purposeSet],
      grants,
    };
  }

  /**
   * Server-side purpose gate for a specific consent record (Phase 2 wound photos).
   * Ordered checks (locked): caseload → load → revoked → not-signed → expired →
   * patient/episode match → purpose on template.
   */
  async assertConsentPurpose(
    user: AuthUser,
    args: {
      patientId: string;
      consentRecordId: string;
      purpose: PurposeCode;
      episodeId?: string;
    },
  ): Promise<{ consentRecordId: string; templateId: string }> {
    await this.assertPatientAccess(user, args.patientId);

    const [record] = await this.db
      .select({
        id: consentRecords.id,
        status: consentRecords.status,
        patientId: consentRecords.patientId,
        episodeId: consentRecords.episodeId,
        templateId: consentRecords.templateId,
        expiresAt: consentRecords.expiresAt,
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.id, args.consentRecordId),
          eq(consentRecords.orgId, user.orgId),
        ),
      )
      .limit(1);

    if (!record) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Consent record not found' },
      });
    }

    const purposes = await this.db
      .select({ purposeCode: consentTemplatePurposes.purposeCode })
      .from(consentTemplatePurposes)
      .where(eq(consentTemplatePurposes.templateId, record.templateId));

    return evaluateConsentPurposeRecord(
      record,
      args,
      purposes.map((p) => p.purposeCode),
    );
  }
}

/** Shape loaded from DB for post-load consent purpose checks. */
export type ConsentPurposeRecord = {
  id: string;
  status: string;
  patientId: string;
  episodeId: string | null;
  templateId: string;
  expiresAt: Date | null;
};

/**
 * Ordered post-load checks for assertConsentPurpose (steps 3–8).
 * Exported for unit tests without Nest DI / DB.
 *
 * Order (locked): revoked → not signed → expired → patient → episode → purpose.
 */
export function evaluateConsentPurposeRecord(
  record: ConsentPurposeRecord,
  args: {
    patientId: string;
    purpose: PurposeCode;
    episodeId?: string;
  },
  templatePurposeCodes: string[],
  now: Date = new Date(),
): { consentRecordId: string; templateId: string } {
  // 3. Revoked before generic not-signed
  if (record.status === 'revoked') {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_REVOKED',
        message: 'Consent has been revoked',
      },
    });
  }

  // 4. Not signed (draft / void / other)
  if (record.status !== 'signed') {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_REQUIRED',
        message: `Consent is not signed (status=${record.status})`,
      },
    });
  }

  // 5. Expired while still signed
  if (record.expiresAt && record.expiresAt <= now) {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_EXPIRED',
        message: 'Consent has expired',
      },
    });
  }

  // 6. Patient bind
  if (record.patientId !== args.patientId) {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_MISMATCH',
        message: 'Consent does not belong to this patient',
      },
    });
  }

  // 7. Optional episode: both set and differ → mismatch
  if (
    args.episodeId &&
    record.episodeId &&
    record.episodeId !== args.episodeId
  ) {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_MISMATCH',
        message: 'Consent does not match this episode',
      },
    });
  }

  // 8. Purpose must be on template
  if (!templatePurposeCodes.includes(args.purpose)) {
    throw new ForbiddenException({
      error: {
        code: 'CONSENT_REQUIRED',
        message: `Consent does not grant purpose ${args.purpose}`,
      },
    });
  }

  return { consentRecordId: record.id, templateId: record.templateId };
}

