import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  BILLING_EXPORT_FORMAT,
  type BillingClaimType,
  type CreateBillingClaimInput,
  type MarkClaimSubmittedInput,
} from '@hhos/shared';
import {
  billingClaimPackages,
  coverages,
  episodes,
  hospiceElections,
  oasisAssessments,
  orderPackages,
  organizations,
  patients,
  type HhosDb,
} from '@hhos/db';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { fieldRnCanAccessEpisode, isFieldRnScoped } from '../common/caseload';
import { isBillingEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';
import {
  defaultClaimTypeForCare,
  evaluateBillingReadiness,
  type ReadinessContext,
} from './billing-readiness';

@Injectable()
export class BillingService {
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
    if (!isBillingEnabled(org?.settings as never)) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_BILLING is not enabled for this organization',
        },
      });
    }
  }

  private async loadReadinessContext(
    user: AuthUser,
    episodeId: string,
    claimType: BillingClaimType,
  ): Promise<{ ctx: ReadinessContext; ep: typeof episodes.$inferSelect; patient: typeof patients.$inferSelect }> {
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

    const [patient] = await this.db
      .select()
      .from(patients)
      .where(eq(patients.id, ep.patientId))
      .limit(1);
    if (!patient) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    const coverageVerifiedRequired =
      (org?.settings as { coverageVerifiedRequired?: boolean } | null)
        ?.coverageVerifiedRequired ?? false;

    const covRows = await this.db
      .select()
      .from(coverages)
      .where(
        and(eq(coverages.patientId, ep.patientId), isNull(coverages.deletedAt)),
      );
    const hasCoverage = covRows.length > 0;
    const hasVerifiedCoverage = covRows.some(
      (c) => c.verificationStatus === 'active',
    );

    const oasisRows = await this.db
      .select({ status: oasisAssessments.status })
      .from(oasisAssessments)
      .where(
        and(
          eq(oasisAssessments.episodeId, episodeId),
          eq(oasisAssessments.orgId, user.orgId),
        ),
      )
      .limit(20);
    const oasisPresent = oasisRows.length > 0;
    const oasisLocked = oasisRows.some((r) => r.status === 'locked');

    const [election] = await this.db
      .select()
      .from(hospiceElections)
      .where(
        and(
          eq(hospiceElections.episodeId, episodeId),
          eq(hospiceElections.orgId, user.orgId),
        ),
      )
      .orderBy(desc(hospiceElections.createdAt))
      .limit(1);

    let hospiceCertSigned = false;
    if (election?.latestCertPackageId) {
      const [pkg] = await this.db
        .select({ status: orderPackages.status })
        .from(orderPackages)
        .where(eq(orderPackages.id, election.latestCertPackageId))
        .limit(1);
      hospiceCertSigned = pkg?.status === 'signed';
    } else {
      const [signedCert] = await this.db
        .select({ id: orderPackages.id })
        .from(orderPackages)
        .where(
          and(
            eq(orderPackages.episodeId, episodeId),
            eq(orderPackages.orgId, user.orgId),
            inArray(orderPackages.docType, ['hospice_cert', 'hospice_recert']),
            eq(orderPackages.status, 'signed'),
          ),
        )
        .limit(1);
      hospiceCertSigned = Boolean(signedCert);
    }

    const ctx: ReadinessContext = {
      careType: ep.careType,
      claimType,
      episodeStatus: ep.status,
      primaryDxIcd10: ep.primaryDxIcd10,
      ordersStatus: ep.ordersStatus,
      pocStatus: ep.pocStatus,
      f2fStatus: ep.f2fStatus,
      intakeStatus: ep.intakeStatus,
      coverageVerifiedRequired,
      hasCoverage,
      hasVerifiedCoverage,
      oasisLocked,
      oasisPresent,
      hospiceElectionStatus: election?.status ?? null,
      hospiceTerminalDx: election?.terminalDxIcd10 ?? null,
      hospiceCertSigned,
      hospiceHasElection: Boolean(election),
    };

    return { ctx, ep, patient };
  }

  async readiness(
    user: AuthUser,
    episodeId: string,
    claimType?: BillingClaimType,
  ) {
    await this.ensureFeature(user);
    const type =
      claimType ??
      defaultClaimTypeForCare(
        (
          await this.db
            .select({ careType: episodes.careType })
            .from(episodes)
            .where(eq(episodes.id, episodeId))
            .limit(1)
        )[0]?.careType ?? 'home_health',
      );
    const { ctx, ep } = await this.loadReadinessContext(user, episodeId, type);
    const result = evaluateBillingReadiness(ctx);
    return {
      episodeId,
      careType: ep.careType,
      claimTypeHint: type,
      ready: result.ready,
      hardGapCount: result.hardGapCount,
      softGapCount: result.softGapCount,
      gaps: result.gaps,
      snapshot: {
        ordersStatus: ep.ordersStatus,
        pocStatus: ep.pocStatus,
        f2fStatus: ep.f2fStatus,
        intakeStatus: ep.intakeStatus,
        primaryDxIcd10: ep.primaryDxIcd10,
        episodeStatus: ep.status,
        hospiceElectionStatus: ctx.hospiceElectionStatus,
        hospiceCertSigned: ctx.hospiceCertSigned,
      },
      disclaimer:
        'Readiness is advisory for export prep. Human billing staff must review before payer submission.',
    };
  }

  async createClaim(
    user: AuthUser,
    input: CreateBillingClaimInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const { ctx, ep } = await this.loadReadinessContext(
      user,
      input.episodeId,
      input.claimType,
    );
    const result = evaluateBillingReadiness(ctx);
    const status = result.ready ? 'ready' : 'blocked';

    const [row] = await this.db
      .insert(billingClaimPackages)
      .values({
        orgId: user.orgId,
        episodeId: ep.id,
        patientId: ep.patientId,
        claimType: input.claimType,
        status,
        serviceFrom: input.serviceFrom ?? null,
        serviceTo: input.serviceTo ?? null,
        notes: input.notes ?? null,
        gapsJson: result.gaps,
        readinessSnapshotJson: {
          ordersStatus: ep.ordersStatus,
          pocStatus: ep.pocStatus,
          careType: ep.careType,
          episodeStatus: ep.status,
        },
        hardGapCount: result.hardGapCount,
        createdBy: user.id,
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'billing.claim.create',
      resourceType: 'billing_claim_package',
      resourceId: row!.id,
      patientId: ep.patientId,
      episodeId: ep.id,
      after: { claimType: input.claimType, status, hardGapCount: result.hardGapCount },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async listClaims(user: AuthUser, status?: string) {
    await this.ensureFeature(user);
    const conditions = [eq(billingClaimPackages.orgId, user.orgId)];
    if (status) {
      conditions.push(eq(billingClaimPackages.status, status as never));
    }
    const rows = await this.db
      .select({
        claim: billingClaimPackages,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        mrn: patients.mrn,
      })
      .from(billingClaimPackages)
      .innerJoin(patients, eq(patients.id, billingClaimPackages.patientId))
      .where(and(...conditions))
      .orderBy(desc(billingClaimPackages.updatedAt))
      .limit(100);

    return {
      data: rows.map((r) => ({
        ...r.claim,
        patientName: `${r.patientFirst} ${r.patientLast}`,
        mrn: r.mrn,
      })),
    };
  }

  async getClaim(user: AuthUser, id: string) {
    await this.ensureFeature(user);
    const [row] = await this.db
      .select()
      .from(billingClaimPackages)
      .where(
        and(
          eq(billingClaimPackages.id, id),
          eq(billingClaimPackages.orgId, user.orgId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Claim package not found' },
      });
    }
    return row;
  }

  async refresh(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const claim = await this.getClaim(user, id);
    if (['void', 'submitted_external'].includes(claim.status)) {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Cannot refresh closed claim' },
      });
    }
    const { ctx, ep } = await this.loadReadinessContext(
      user,
      claim.episodeId,
      claim.claimType as BillingClaimType,
    );
    const result = evaluateBillingReadiness(ctx);
    const nextStatus =
      claim.status === 'exported'
        ? claim.status
        : result.ready
          ? 'ready'
          : 'blocked';

    const [updated] = await this.db
      .update(billingClaimPackages)
      .set({
        status: nextStatus as never,
        gapsJson: result.gaps,
        hardGapCount: result.hardGapCount,
        readinessSnapshotJson: {
          ordersStatus: ep.ordersStatus,
          pocStatus: ep.pocStatus,
          careType: ep.careType,
          episodeStatus: ep.status,
          refreshedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(billingClaimPackages.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'billing.claim.refresh',
      resourceType: 'billing_claim_package',
      resourceId: id,
      patientId: claim.patientId,
      episodeId: claim.episodeId,
      after: { status: nextStatus, hardGapCount: result.hardGapCount },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async exportClaim(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const claim = await this.getClaim(user, id);
    const refreshed = await this.refresh(user, id, meta);
    if (refreshed!.hardGapCount > 0) {
      throw new BadRequestException({
        error: {
          code: 'NOT_READY',
          message: 'Hard billing gaps remain — resolve signatures/coverage before export',
          gaps: refreshed!.gapsJson,
        },
      });
    }

    const { ep, patient } = await this.loadReadinessContext(
      user,
      claim.episodeId,
      claim.claimType as BillingClaimType,
    ).then((r) => ({ ep: r.ep, patient: r.patient }));

    const payload = {
      format: BILLING_EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      organizationId: user.orgId,
      claim: {
        id: claim.id,
        claimType: claim.claimType,
        serviceFrom: claim.serviceFrom,
        serviceTo: claim.serviceTo,
      },
      episode: {
        id: ep.id,
        careType: ep.careType,
        status: ep.status,
        primaryDxIcd10: ep.primaryDxIcd10,
        ordersStatus: ep.ordersStatus,
        pocStatus: ep.pocStatus,
      },
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        // initials only in export log-friendly form; full name for billing staff download
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
      },
      readiness: refreshed!.gapsJson,
      note: 'Not an X12 837. Hand off to clearinghouse / billing vendor. HITL submission required.',
    };

    const [updated] = await this.db
      .update(billingClaimPackages)
      .set({
        status: 'exported',
        exportFormat: BILLING_EXPORT_FORMAT,
        exportPayloadJson: payload,
        exportedAt: new Date(),
        exportedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(billingClaimPackages.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'billing.claim.export',
      resourceType: 'billing_claim_package',
      resourceId: id,
      patientId: claim.patientId,
      episodeId: claim.episodeId,
      after: { format: BILLING_EXPORT_FORMAT },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { claim: updated, export: payload };
  }

  async markSubmitted(
    user: AuthUser,
    id: string,
    input: MarkClaimSubmittedInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const claim = await this.getClaim(user, id);
    if (claim.status !== 'exported' && claim.status !== 'submitted_external') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: 'Export claim before marking external submission',
        },
      });
    }
    const [updated] = await this.db
      .update(billingClaimPackages)
      .set({
        status: 'submitted_external',
        externalRef: input.externalRef,
        submittedAt: new Date(),
        submittedBy: user.id,
        notes: input.note
          ? `${claim.notes ? claim.notes + '\n' : ''}${input.note}`
          : claim.notes,
        updatedAt: new Date(),
      })
      .where(eq(billingClaimPackages.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'billing.claim.submitted_external',
      resourceType: 'billing_claim_package',
      resourceId: id,
      patientId: claim.patientId,
      episodeId: claim.episodeId,
      after: { externalRef: input.externalRef },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async voidClaim(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const claim = await this.getClaim(user, id);
    if (claim.status === 'void') return claim;
    const [updated] = await this.db
      .update(billingClaimPackages)
      .set({
        status: 'void',
        voidedAt: new Date(),
        voidedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(billingClaimPackages.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'billing.claim.void',
      resourceType: 'billing_claim_package',
      resourceId: id,
      patientId: claim.patientId,
      episodeId: claim.episodeId,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async worklist(user: AuthUser) {
    await this.ensureFeature(user);
    const eps = await this.db
      .select({
        id: episodes.id,
        careType: episodes.careType,
        status: episodes.status,
        ordersStatus: episodes.ordersStatus,
        pocStatus: episodes.pocStatus,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        mrn: patients.mrn,
      })
      .from(episodes)
      .innerJoin(patients, eq(patients.id, episodes.patientId))
      .where(
        and(
          eq(episodes.orgId, user.orgId),
          isNull(episodes.deletedAt),
          inArray(episodes.status, ['pre_admit', 'scheduled_soc', 'active', 'hold']),
        ),
      )
      .limit(50);

    const data = [];
    for (const ep of eps) {
      const claimType = defaultClaimTypeForCare(ep.careType);
      const readiness = await this.readiness(user, ep.id, claimType);
      data.push({
        episodeId: ep.id,
        careType: ep.careType,
        episodeStatus: ep.status,
        patientName: `${ep.patientFirst} ${ep.patientLast}`,
        mrn: ep.mrn,
        claimTypeHint: claimType,
        ready: readiness.ready,
        hardGapCount: readiness.hardGapCount,
        softGapCount: readiness.softGapCount,
        topGaps: readiness.gaps.slice(0, 3),
      });
    }

    data.sort((a, b) => b.hardGapCount - a.hardGapCount);

    return {
      data,
      disclaimer:
        'Unsigned orders/485/certs are the top billing hangups. Fix Phase 5 signatures first.',
    };
  }
}
