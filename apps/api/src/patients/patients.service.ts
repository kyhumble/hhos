import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  clinicalHistoryItems,
  coverages,
  patientAddresses,
  patientContacts,
  patients,
  type HhosDb,
} from '@hhos/db';
import type {
  CreateClinicalHistoryInput,
  CreateCoverageInput,
  CreatePatientInput,
  PutPatientAddressesInput,
  PutPatientContactsInput,
  UpdatePatientInput,
  VerifyCoverageInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import {
  fieldEncrypt,
  isFieldEncryptionConfigured,
  last4Digits,
} from '../common/field-crypto';
import {
  caseloadPatientIdSet,
  fieldRnCanAccessPatient,
  isFieldRnScoped,
} from '../common/caseload';
import { ChecklistService } from '../common/checklist.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { insertPatientWithMrnRetry } from '../common/insert-patient';

/**
 * Strip ciphertext from API responses.
 * ssnLast4 / memberIdLast4 are intentional Phase 1 fields for matching/billing UI
 * (not full identifiers). Full SSN/member id never leave the field-crypto layer.
 */
function stripPatientSecrets<T extends { encryptedSsn?: Buffer | null }>(
  row: T,
): Omit<T, 'encryptedSsn'> {
  const { encryptedSsn: _ssn, ...safe } = row;
  return safe;
}

function stripCoverageSecrets<T extends { memberIdEncrypted?: Buffer | null }>(
  row: T,
): Omit<T, 'memberIdEncrypted'> {
  const { memberIdEncrypted: _m, ...safe } = row;
  return safe;
}

function requireFieldEncryption(value: string, label: string): Buffer {
  const enc = fieldEncrypt(value);
  if (!enc) {
    throw new ServiceUnavailableException({
      error: {
        code: 'ENCRYPTION_NOT_CONFIGURED',
        message: `FIELD_ENCRYPTION_KEY required to store ${label}`,
      },
    });
  }
  return enc;
}

@Injectable()
export class PatientsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly checklist: ChecklistService,
    private readonly audit: AuditService,
  ) {}

  private async assertPatientAccess(user: AuthUser, patientId: string) {
    const ok = await fieldRnCanAccessPatient(this.db, user, patientId);
    if (!ok) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Patient not on your caseload',
        },
      });
    }
  }

  async list(user: AuthUser) {
    // Caseload must constrain the query *before* limit so field_rn never
    // loses assigned patients that fall outside an arbitrary org page.
    if (isFieldRnScoped(user)) {
      const allowed = await caseloadPatientIdSet(this.db, user.id);
      if (allowed.size === 0) return { data: [] };

      const rows = await this.db
        .select({
          id: patients.id,
          mrn: patients.mrn,
          firstName: patients.firstName,
          lastName: patients.lastName,
          dob: patients.dob,
          status: patients.status,
          preferredLanguage: patients.preferredLanguage,
          capacityStatus: patients.capacityStatus,
        })
        .from(patients)
        .where(
          and(
            eq(patients.orgId, user.orgId),
            isNull(patients.deletedAt),
            inArray(patients.id, [...allowed]),
          ),
        )
        .limit(100);

      return { data: rows };
    }

    const rows = await this.db
      .select({
        id: patients.id,
        mrn: patients.mrn,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dob: patients.dob,
        status: patients.status,
        preferredLanguage: patients.preferredLanguage,
        capacityStatus: patients.capacityStatus,
      })
      .from(patients)
      .where(and(eq(patients.orgId, user.orgId), isNull(patients.deletedAt)))
      .limit(100);

    return { data: rows };
  }

  /**
   * Load patient detail. Uses executor when provided (same TX as mutation).
   * Sensitive-read audit only when auditRead is true (explicit GET, not update assembly).
   */
  private async loadPatientDetail(
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
      .from(patients)
      .where(
        and(eq(patients.orgId, orgId), eq(patients.id, id), isNull(patients.deletedAt)),
      )
      .limit(1);

    if (!row) return null;

    const addresses = await db
      .select()
      .from(patientAddresses)
      .where(
        and(eq(patientAddresses.patientId, id), isNull(patientAddresses.deletedAt)),
      );

    const contacts = await db
      .select()
      .from(patientContacts)
      .where(
        and(eq(patientContacts.patientId, id), isNull(patientContacts.deletedAt)),
      );

    if (opts?.auditRead && opts.user) {
      await this.audit.writeFromUser(opts.user, {
        action: 'patient.read',
        resourceType: 'patient',
        resourceId: id,
        patientId: id,
      });
    }

    return {
      ...stripPatientSecrets(row),
      addresses,
      contacts,
    };
  }

  async getById(user: AuthUser, id: string) {
    await this.assertPatientAccess(user, id);
    return this.loadPatientDetail(user.orgId, id, { auditRead: true, user });
  }

  async create(
    user: AuthUser,
    input: CreatePatientInput,
    meta?: { requestId?: string; ip?: string },
  ) {
    if (input.ssn && !isFieldEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ENCRYPTION_NOT_CONFIGURED',
          message: 'FIELD_ENCRYPTION_KEY required to store SSN',
        },
      });
    }

    return this.db.transaction(async (tx) => {
      const encryptedSsn = input.ssn ? requireFieldEncryption(input.ssn, 'SSN') : null;
      const ssnLast4 = input.ssn ? last4Digits(input.ssn) : null;

      const created = await insertPatientWithMrnRetry(tx, {
        orgId: user.orgId,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        preferredName: input.preferredName ?? null,
        dob: input.dob,
        sexAtBirth: input.sexAtBirth ?? null,
        preferredLanguage: input.preferredLanguage ?? 'en',
        interpreterNeeded: input.interpreterNeeded ?? false,
        capacityStatus: input.capacityStatus ?? 'assumed_capacity',
        encryptedSsn,
        ssnLast4,
        status: 'prospect',
        createdBy: user.id,
        updatedBy: user.id,
      });

      let addresses: (typeof patientAddresses.$inferSelect)[] = [];
      if (input.serviceAddress) {
        const [addr] = await tx
          .insert(patientAddresses)
          .values({
            orgId: user.orgId,
            patientId: created.id,
            type: 'service',
            line1: input.serviceAddress.line1,
            line2: input.serviceAddress.line2 ?? null,
            city: input.serviceAddress.city,
            state: input.serviceAddress.state,
            postalCode: input.serviceAddress.postalCode,
            county: input.serviceAddress.county ?? null,
            ruralFlag: input.serviceAddress.ruralFlag ?? false,
          })
          .returning();
        if (addr) addresses = [addr];
      }

      await this.audit.writeFromUser(
        user,
        {
          action: 'patient.create',
          resourceType: 'patient',
          resourceId: created.id,
          patientId: created.id,
          after: stripPatientSecrets(created),
          requestId: meta?.requestId,
          ip: meta?.ip,
        },
        tx,
      );

      return {
        ...stripPatientSecrets(created),
        addresses,
        contacts: [] as const,
      };
    });
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdatePatientInput,
    meta?: { requestId?: string; ip?: string },
  ) {
    await this.assertPatientAccess(user, id);

    const [before] = await this.db
      .select()
      .from(patients)
      .where(
        and(eq(patients.orgId, user.orgId), eq(patients.id, id), isNull(patients.deletedAt)),
      )
      .limit(1);

    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    if (input.ssn !== undefined && !isFieldEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ENCRYPTION_NOT_CONFIGURED',
          message: 'FIELD_ENCRYPTION_KEY required to store SSN',
        },
      });
    }

    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      if (input.firstName !== undefined) patch.firstName = input.firstName;
      if (input.middleName !== undefined) patch.middleName = input.middleName;
      if (input.lastName !== undefined) patch.lastName = input.lastName;
      if (input.preferredName !== undefined) patch.preferredName = input.preferredName;
      if (input.dob !== undefined) patch.dob = input.dob;
      if (input.sexAtBirth !== undefined) patch.sexAtBirth = input.sexAtBirth;
      if (input.preferredLanguage !== undefined) {
        patch.preferredLanguage = input.preferredLanguage;
      }
      if (input.interpreterNeeded !== undefined) {
        patch.interpreterNeeded = input.interpreterNeeded;
      }
      if (input.capacityStatus !== undefined) patch.capacityStatus = input.capacityStatus;
      if (input.status !== undefined) patch.status = input.status;
      if (input.maritalStatus !== undefined) patch.maritalStatus = input.maritalStatus;
      if (input.advancedDirectiveOnFile !== undefined) {
        patch.advancedDirectiveOnFile = input.advancedDirectiveOnFile;
      }
      if (input.ssn !== undefined) {
        // Fail-closed: never overwrite encryptedSsn with null
        patch.encryptedSsn = requireFieldEncryption(input.ssn, 'SSN');
        patch.ssnLast4 = last4Digits(input.ssn);
      }

      const [updated] = await tx
        .update(patients)
        .set(patch)
        .where(eq(patients.id, id))
        .returning();

      if (input.serviceAddress) {
        await tx
          .update(patientAddresses)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(patientAddresses.patientId, id),
              eq(patientAddresses.type, 'service'),
              isNull(patientAddresses.deletedAt),
            ),
          );
        await tx.insert(patientAddresses).values({
          orgId: user.orgId,
          patientId: id,
          type: 'service',
          line1: input.serviceAddress.line1,
          line2: input.serviceAddress.line2 ?? null,
          city: input.serviceAddress.city,
          state: input.serviceAddress.state,
          postalCode: input.serviceAddress.postalCode,
          county: input.serviceAddress.county ?? null,
          ruralFlag: input.serviceAddress.ruralFlag ?? false,
        });
      }

      await this.checklist.recomputeForPatient(id, user.id, tx as unknown as HhosDb);

      await this.audit.writeFromUser(
        user,
        {
          action: 'patient.update',
          resourceType: 'patient',
          resourceId: id,
          patientId: id,
          before: stripPatientSecrets(before),
          after: updated ? stripPatientSecrets(updated) : undefined,
          requestId: meta?.requestId,
          ip: meta?.ip,
        },
        tx,
      );

      // Load via tx so response sees uncommitted writes; no read audit on update
      return this.loadPatientDetail(user.orgId, id, {
        executor: tx as unknown as HhosDb,
        auditRead: false,
      });
    });
  }

  async putAddresses(
    user: AuthUser,
    patientId: string,
    input: PutPatientAddressesInput,
    meta?: { requestId?: string },
  ) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    return this.db.transaction(async (tx) => {
      await tx
        .update(patientAddresses)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(patientAddresses.patientId, patientId),
            isNull(patientAddresses.deletedAt),
          ),
        );

      for (const a of input.addresses) {
        await tx.insert(patientAddresses).values({
          orgId: user.orgId,
          patientId,
          type: a.type,
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          county: a.county ?? null,
          ruralFlag: a.ruralFlag ?? false,
        });
      }

      await this.checklist.recomputeForPatient(
        patientId,
        user.id,
        tx as unknown as HhosDb,
      );

      const addresses = await tx
        .select()
        .from(patientAddresses)
        .where(
          and(
            eq(patientAddresses.patientId, patientId),
            isNull(patientAddresses.deletedAt),
          ),
        );

      await this.audit.writeFromUser(
        user,
        {
          action: 'patient.addresses.put',
          resourceType: 'patient',
          resourceId: patientId,
          patientId,
          after: { addressCount: addresses.length },
          requestId: meta?.requestId,
        },
        tx,
      );

      return { data: addresses };
    });
  }

  async putContacts(
    user: AuthUser,
    patientId: string,
    input: PutPatientContactsInput,
    meta?: { requestId?: string },
  ) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    return this.db.transaction(async (tx) => {
      await tx
        .update(patientContacts)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(patientContacts.patientId, patientId),
            isNull(patientContacts.deletedAt),
          ),
        );

      for (const c of input.contacts) {
        await tx.insert(patientContacts).values({
          orgId: user.orgId,
          patientId,
          type: c.type,
          fullName: c.fullName,
          relationship: c.relationship ?? null,
          phone: c.phone ?? null,
          email: c.email ?? null,
          legalAuthority: c.legalAuthority ?? 'none',
        });
      }

      await this.checklist.recomputeForPatient(
        patientId,
        user.id,
        tx as unknown as HhosDb,
      );

      const contacts = await tx
        .select()
        .from(patientContacts)
        .where(
          and(
            eq(patientContacts.patientId, patientId),
            isNull(patientContacts.deletedAt),
          ),
        );

      await this.audit.writeFromUser(
        user,
        {
          action: 'patient.contacts.put',
          resourceType: 'patient',
          resourceId: patientId,
          patientId,
          after: { contactCount: contacts.length },
          requestId: meta?.requestId,
        },
        tx,
      );

      return { data: contacts };
    });
  }

  async listHistory(user: AuthUser, patientId: string) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    const rows = await this.db
      .select()
      .from(clinicalHistoryItems)
      .where(
        and(
          eq(clinicalHistoryItems.patientId, patientId),
          isNull(clinicalHistoryItems.deletedAt),
        ),
      );

    return { data: rows };
  }

  async addHistory(
    user: AuthUser,
    patientId: string,
    input: CreateClinicalHistoryInput,
    meta?: { requestId?: string },
  ) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clinicalHistoryItems)
        .values({
          orgId: user.orgId,
          patientId,
          category: input.category,
          codeSystem: input.codeSystem ?? null,
          code: input.code ?? null,
          displayText: input.displayText,
          onsetDate: input.onsetDate ?? null,
          active: input.active ?? true,
          notes: input.notes ?? null,
          createdBy: user.id,
        })
        .returning();

      await this.checklist.recomputeForPatient(
        patientId,
        user.id,
        tx as unknown as HhosDb,
      );

      await this.audit.writeFromUser(
        user,
        {
          action: 'patient.history.create',
          resourceType: 'clinical_history_item',
          resourceId: row?.id,
          patientId,
          after: row,
          requestId: meta?.requestId,
        },
        tx,
      );

      return row;
    });
  }

  async listCoverages(user: AuthUser, patientId: string) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    const rows = await this.db
      .select()
      .from(coverages)
      .where(and(eq(coverages.patientId, patientId), isNull(coverages.deletedAt)));

    return { data: rows.map(stripCoverageSecrets) };
  }

  async addCoverage(
    user: AuthUser,
    patientId: string,
    input: CreateCoverageInput,
    meta?: { requestId?: string },
  ) {
    await this.assertPatientAccess(user, patientId);
    await this.ensurePatient(user.orgId, patientId);

    if (input.memberId && !isFieldEncryptionConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ENCRYPTION_NOT_CONFIGURED',
          message: 'FIELD_ENCRYPTION_KEY required to store member id',
        },
      });
    }

    return this.db.transaction(async (tx) => {
      const memberIdEncrypted = input.memberId
        ? requireFieldEncryption(input.memberId, 'member id')
        : null;
      const memberIdLast4 = input.memberId ? last4Digits(input.memberId) : null;

      const [row] = await tx
        .insert(coverages)
        .values({
          orgId: user.orgId,
          patientId,
          rank: input.rank ?? 1,
          payerType: input.payerType,
          payerName: input.payerName,
          memberIdEncrypted,
          memberIdLast4,
          groupNumber: input.groupNumber ?? null,
          subscriberName: input.subscriberName ?? null,
          relationshipToSubscriber: input.relationshipToSubscriber ?? null,
          effectiveFrom: input.effectiveFrom ?? null,
          effectiveTo: input.effectiveTo ?? null,
          dualEligible: input.dualEligible ?? false,
          verificationStatus: 'unverified',
        })
        .returning();

      await this.checklist.recomputeForPatient(
        patientId,
        user.id,
        tx as unknown as HhosDb,
      );

      const safe = row ? stripCoverageSecrets(row) : null;

      await this.audit.writeFromUser(
        user,
        {
          action: 'coverage.create',
          resourceType: 'coverage',
          resourceId: row?.id,
          patientId,
          after: safe,
          requestId: meta?.requestId,
        },
        tx,
      );

      return safe;
    });
  }

  async verifyCoverage(
    user: AuthUser,
    patientId: string,
    coverageId: string,
    input: VerifyCoverageInput,
    meta?: { requestId?: string },
  ) {
    await this.assertPatientAccess(user, patientId);

    const [before] = await this.db
      .select()
      .from(coverages)
      .where(
        and(
          eq(coverages.id, coverageId),
          eq(coverages.patientId, patientId),
          eq(coverages.orgId, user.orgId),
          isNull(coverages.deletedAt),
        ),
      )
      .limit(1);

    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Coverage not found' },
      });
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(coverages)
        .set({
          verificationStatus: input.verificationStatus,
          verifiedAt: new Date(),
          verifiedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(coverages.id, coverageId))
        .returning();

      await this.checklist.recomputeForPatient(
        patientId,
        user.id,
        tx as unknown as HhosDb,
      );

      const safe = updated ? stripCoverageSecrets(updated) : null;

      await this.audit.writeFromUser(
        user,
        {
          action: 'coverage.verify',
          resourceType: 'coverage',
          resourceId: coverageId,
          patientId,
          before: stripCoverageSecrets(before),
          after: safe,
          requestId: meta?.requestId,
        },
        tx,
      );

      return safe;
    });
  }

  private async ensurePatient(orgId: string, id: string) {
    const [row] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(eq(patients.orgId, orgId), eq(patients.id, id), isNull(patients.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }
  }
}
