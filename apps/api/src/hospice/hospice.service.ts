import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  episodes,
  hospiceBenefitPeriods,
  hospiceElections,
  hospiceLocStays,
  orderPackages,
  organizations,
  patients,
  type HhosDb,
} from '@hhos/db';
import type {
  ActivateHospiceElectionInput,
  ChangeHospiceLocInput,
  CreateHospiceElectionInput,
  RequestHospiceCertInput,
  RevokeHospiceElectionInput,
  UpdateHospiceElectionInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { fieldRnCanAccessEpisode, isFieldRnScoped } from '../common/caseload';
import { isHospiceEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Medicare hospice: periods 1–2 = 90 days; subsequent = 60 days. */
function benefitPeriodLengthDays(periodNumber: number): number {
  return periodNumber <= 2 ? 90 : 60;
}

@Injectable()
export class HospiceService {
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
    if (!isHospiceEnabled(org?.settings as never)) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_HOSPICE is not enabled for this organization',
        },
      });
    }
  }

  private async assertPatient(user: AuthUser, patientId: string) {
    const [p] = await this.db
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
    if (!p) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }
    return p;
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

  private async getElectionOrThrow(user: AuthUser, id: string) {
    const [row] = await this.db
      .select()
      .from(hospiceElections)
      .where(and(eq(hospiceElections.id, id), eq(hospiceElections.orgId, user.orgId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Hospice election not found' },
      });
    }
    if (isFieldRnScoped(user)) {
      const ok = await fieldRnCanAccessEpisode(this.db, user, row.episodeId);
      if (!ok) {
        throw new ForbiddenException({
          error: { code: 'NOT_ASSIGNED', message: 'Not on care team' },
        });
      }
    }
    return row;
  }

  async create(
    user: AuthUser,
    input: CreateHospiceElectionInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const patient = await this.assertPatient(user, input.patientId);

    let episodeId = input.episodeId;
    if (episodeId) {
      const ep = await this.assertEpisode(user, episodeId);
      if (ep.patientId !== patient.id) {
        throw new BadRequestException({
          error: { code: 'PATIENT_MISMATCH', message: 'Episode is for another patient' },
        });
      }
    } else if (input.createEpisode) {
      const [maxEp] = await this.db
        .select({ n: sql<number>`coalesce(max(${episodes.episodeNumber}), 0)::int` })
        .from(episodes)
        .where(
          and(eq(episodes.patientId, patient.id), eq(episodes.orgId, user.orgId)),
        );
      const nextNum = Number(maxEp?.n ?? 0) + 1;
      const [ep] = await this.db
        .insert(episodes)
        .values({
          orgId: user.orgId,
          patientId: patient.id,
          episodeNumber: nextNum,
          careType: 'hospice',
          status: 'pre_admit',
          referralReceivedAt: new Date(),
          primaryDxIcd10: input.terminalDxIcd10 ?? null,
          intakeStatus: 'incomplete',
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      episodeId = ep!.id;
    } else {
      throw new BadRequestException({
        error: {
          code: 'EPISODE_REQUIRED',
          message: 'episodeId required when createEpisode is false',
        },
      });
    }

    // Ensure episode is marked hospice
    await this.db
      .update(episodes)
      .set({ careType: 'hospice', updatedAt: new Date(), updatedBy: user.id })
      .where(eq(episodes.id, episodeId!));

    const [row] = await this.db
      .insert(hospiceElections)
      .values({
        orgId: user.orgId,
        patientId: patient.id,
        episodeId: episodeId!,
        status: 'draft',
        electionDate: input.electionDate,
        effectiveDate: input.effectiveDate,
        attendingPhysicianName: input.attendingPhysicianName,
        attendingPhysicianNpi: input.attendingPhysicianNpi ?? null,
        certifyingPhysicianName: input.certifyingPhysicianName ?? null,
        certifyingPhysicianNpi: input.certifyingPhysicianNpi ?? null,
        terminalDxIcd10: input.terminalDxIcd10 ?? null,
        terminalDxText: input.terminalDxText ?? null,
        placeOfService: input.placeOfService,
        notes: input.notes ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'hospice.election.create',
      resourceType: 'hospice_election',
      resourceId: row!.id,
      patientId: patient.id,
      episodeId: episodeId!,
      after: {
        electionDate: input.electionDate,
        status: 'draft',
      },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async list(
    user: AuthUser,
    query: { status?: string; patientId?: string },
  ) {
    await this.ensureFeature(user);
    const conditions = [eq(hospiceElections.orgId, user.orgId)];
    if (query.status) {
      conditions.push(eq(hospiceElections.status, query.status as never));
    }
    if (query.patientId) {
      conditions.push(eq(hospiceElections.patientId, query.patientId));
    }
    const rows = await this.db
      .select({
        election: hospiceElections,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
      })
      .from(hospiceElections)
      .innerJoin(patients, eq(patients.id, hospiceElections.patientId))
      .where(and(...conditions))
      .orderBy(desc(hospiceElections.updatedAt))
      .limit(100);

    return {
      data: rows.map((r) => ({
        ...r.election,
        patientName: `${r.patientFirst} ${r.patientLast}`,
      })),
    };
  }

  async getById(user: AuthUser, id: string) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    const periods = await this.db
      .select()
      .from(hospiceBenefitPeriods)
      .where(eq(hospiceBenefitPeriods.electionId, id))
      .orderBy(hospiceBenefitPeriods.periodNumber);
    const locStays = await this.db
      .select()
      .from(hospiceLocStays)
      .where(eq(hospiceLocStays.electionId, id))
      .orderBy(desc(hospiceLocStays.startedAt));
    const currentLoc = locStays.find((s) => s.endedAt == null) ?? null;

    return {
      ...election,
      benefitPeriods: periods,
      locStays,
      currentLoc,
    };
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateHospiceElectionInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    if (election.status === 'revoked' || election.status === 'discharged') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Cannot update closed election' },
      });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: user.id,
    };
    if (input.attendingPhysicianName !== undefined) {
      patch.attendingPhysicianName = input.attendingPhysicianName;
    }
    if (input.attendingPhysicianNpi !== undefined) {
      patch.attendingPhysicianNpi = input.attendingPhysicianNpi;
    }
    if (input.certifyingPhysicianName !== undefined) {
      patch.certifyingPhysicianName = input.certifyingPhysicianName;
    }
    if (input.certifyingPhysicianNpi !== undefined) {
      patch.certifyingPhysicianNpi = input.certifyingPhysicianNpi;
    }
    if (input.terminalDxIcd10 !== undefined) patch.terminalDxIcd10 = input.terminalDxIcd10;
    if (input.terminalDxText !== undefined) patch.terminalDxText = input.terminalDxText;
    if (input.placeOfService !== undefined) patch.placeOfService = input.placeOfService;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.electionDate !== undefined) patch.electionDate = input.electionDate;
    if (input.effectiveDate !== undefined) patch.effectiveDate = input.effectiveDate;

    const [updated] = await this.db
      .update(hospiceElections)
      .set(patch)
      .where(eq(hospiceElections.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'hospice.election.update',
      resourceType: 'hospice_election',
      resourceId: id,
      patientId: election.patientId,
      episodeId: election.episodeId,
      after: { fields: Object.keys(input) },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async activate(
    user: AuthUser,
    id: string,
    input: ActivateHospiceElectionInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    if (election.status !== 'draft') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Only draft elections can be activated' },
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(hospiceElections)
        .set({
          status: 'active',
          activatedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(hospiceElections.id, id));

      await tx
        .update(episodes)
        .set({
          careType: 'hospice',
          status: 'active',
          updatedAt: new Date(),
          updatedBy: user.id,
          primaryDxIcd10: election.terminalDxIcd10 ?? undefined,
        })
        .where(eq(episodes.id, election.episodeId));

      if (input.openBenefitPeriod) {
        const days = benefitPeriodLengthDays(1);
        const endDate = addDaysIso(election.effectiveDate, days - 1);
        await tx.insert(hospiceBenefitPeriods).values({
          orgId: user.orgId,
          electionId: id,
          episodeId: election.episodeId,
          periodNumber: 1,
          status: 'open',
          startDate: election.effectiveDate,
          endDate,
        });
      }

      await tx.insert(hospiceLocStays).values({
        orgId: user.orgId,
        electionId: id,
        episodeId: election.episodeId,
        levelOfCare: input.initialLoc,
        startedAt: new Date(`${election.effectiveDate}T12:00:00.000Z`),
        createdBy: user.id,
      });

      await this.audit.writeFromUser(
        user,
        {
          action: 'hospice.election.activate',
          resourceType: 'hospice_election',
          resourceId: id,
          patientId: election.patientId,
          episodeId: election.episodeId,
          after: {
            status: 'active',
            initialLoc: input.initialLoc,
            openBenefitPeriod: input.openBenefitPeriod,
          },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    return this.getById(user, id);
  }

  async revoke(
    user: AuthUser,
    id: string,
    input: RevokeHospiceElectionInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    if (election.status !== 'active') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Only active elections can be revoked' },
      });
    }
    const revokedAt = input.revokedAt ? new Date(input.revokedAt) : new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(hospiceElections)
        .set({
          status: 'revoked',
          revokedAt,
          revokeReason: input.reason,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(hospiceElections.id, id));

      await tx
        .update(hospiceBenefitPeriods)
        .set({ status: 'closed', closedAt: revokedAt })
        .where(
          and(
            eq(hospiceBenefitPeriods.electionId, id),
            eq(hospiceBenefitPeriods.status, 'open'),
          ),
        );

      await tx
        .update(hospiceLocStays)
        .set({ endedAt: revokedAt })
        .where(
          and(eq(hospiceLocStays.electionId, id), isNull(hospiceLocStays.endedAt)),
        );

      await tx
        .update(episodes)
        .set({
          status: 'discharged',
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(episodes.id, election.episodeId));

      await this.audit.writeFromUser(
        user,
        {
          action: 'hospice.election.revoke',
          resourceType: 'hospice_election',
          resourceId: id,
          patientId: election.patientId,
          episodeId: election.episodeId,
          after: { reason: input.reason },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    return this.getById(user, id);
  }

  async changeLoc(
    user: AuthUser,
    id: string,
    input: ChangeHospiceLocInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    if (election.status !== 'active') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'LOC changes require active election' },
      });
    }
    if (
      (input.levelOfCare === 'gip' || input.levelOfCare === 'respite') &&
      !input.facilityName
    ) {
      throw new BadRequestException({
        error: {
          code: 'FACILITY_REQUIRED',
          message: 'facilityName required for GIP/respite',
        },
      });
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();

    const [stay] = await this.db.transaction(async (tx) => {
      await tx
        .update(hospiceLocStays)
        .set({ endedAt: startedAt })
        .where(
          and(eq(hospiceLocStays.electionId, id), isNull(hospiceLocStays.endedAt)),
        );

      const [created] = await tx
        .insert(hospiceLocStays)
        .values({
          orgId: user.orgId,
          electionId: id,
          episodeId: election.episodeId,
          levelOfCare: input.levelOfCare,
          startedAt,
          reason: input.reason ?? null,
          facilityName: input.facilityName ?? null,
          createdBy: user.id,
        })
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'hospice.loc.change',
          resourceType: 'hospice_loc_stay',
          resourceId: created!.id,
          patientId: election.patientId,
          episodeId: election.episodeId,
          after: { levelOfCare: input.levelOfCare },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );

      return [created];
    });

    return { stay, election: await this.getById(user, id) };
  }

  /**
   * Creates a Phase 5 order package (hospice_cert / hospice_recert) for physician e-sign.
   */
  async requestCert(
    user: AuthUser,
    id: string,
    input: RequestHospiceCertInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const election = await this.getElectionOrThrow(user, id);
    if (election.status !== 'active' && election.status !== 'draft') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: 'Cert request needs draft or active election',
        },
      });
    }

    const physicianName =
      input.physicianName ??
      election.certifyingPhysicianName ??
      election.attendingPhysicianName;
    const physicianNpi =
      input.physicianNpi ??
      election.certifyingPhysicianNpi ??
      election.attendingPhysicianNpi ??
      null;

    const title =
      input.title ??
      (input.docType === 'hospice_recert'
        ? 'Hospice recertification of terminal illness'
        : 'Hospice certification of terminal illness');

    const [pkg] = await this.db
      .insert(orderPackages)
      .values({
        orgId: user.orgId,
        episodeId: election.episodeId,
        patientId: election.patientId,
        docType: input.docType,
        title,
        physicianName,
        physicianNpi,
        physicianEmail: input.physicianEmail ?? null,
        status: input.markReady ? 'ready' : 'draft',
        notes: `Linked hospice election ${id}`,
        createdBy: user.id,
      })
      .returning();

    await this.db
      .update(hospiceElections)
      .set({
        latestCertPackageId: pkg!.id,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(hospiceElections.id, id));

    await this.audit.writeFromUser(user, {
      action: 'hospice.cert.request',
      resourceType: 'order_package',
      resourceId: pkg!.id,
      patientId: election.patientId,
      episodeId: election.episodeId,
      after: { docType: input.docType, electionId: id, markReady: input.markReady },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      electionId: id,
      orderPackage: pkg,
      nextStep:
        'Send package for physician signature via POST /v1/order-packages/:id/send (FEATURE_ORDERS_ESIGN).',
    };
  }

  async worklist(user: AuthUser) {
    await this.ensureFeature(user);
    const rows = await this.db
      .select({
        election: hospiceElections,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
      })
      .from(hospiceElections)
      .innerJoin(patients, eq(patients.id, hospiceElections.patientId))
      .where(
        and(
          eq(hospiceElections.orgId, user.orgId),
          sql`${hospiceElections.status} IN ('draft', 'active')`,
        ),
      )
      .orderBy(desc(hospiceElections.updatedAt))
      .limit(100);

    const data = [];
    for (const r of rows) {
      let certGap = !r.election.latestCertPackageId;
      if (r.election.latestCertPackageId) {
        const [pkg] = await this.db
          .select({ status: orderPackages.status })
          .from(orderPackages)
          .where(eq(orderPackages.id, r.election.latestCertPackageId))
          .limit(1);
        certGap = !pkg || pkg.status !== 'signed';
      }
      const [loc] = await this.db
        .select()
        .from(hospiceLocStays)
        .where(
          and(
            eq(hospiceLocStays.electionId, r.election.id),
            isNull(hospiceLocStays.endedAt),
          ),
        )
        .limit(1);

      data.push({
        ...r.election,
        patientName: `${r.patientFirst} ${r.patientLast}`,
        currentLoc: loc?.levelOfCare ?? null,
        certUnsigned: certGap,
      });
    }

    return {
      data,
      disclaimer:
        'Hospice billing readiness requires election + signed physician cert/recert (HITL e-sign).',
    };
  }
}
