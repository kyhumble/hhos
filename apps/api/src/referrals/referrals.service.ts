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
  type UpdateReferralInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import { ChecklistService } from '../common/checklist.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { isUniqueViolation } from '../common/db-errors';
import { insertPatientWithMrnRetry } from '../common/insert-patient';

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
      .where(
        and(eq(referrals.orgId, orgId), eq(referrals.id, id), isNull(referrals.deletedAt)),
      )
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
      if (existing) {
        return { ...existing, _idempotentReplay: true as const };
      }
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
              after: {
                mrn: p.mrn,
                firstName: input.patient.firstName,
                lastName: input.patient.lastName,
              },
              requestId: opts?.requestId,
              ip: opts?.ip,
            },
            tx,
          );
        }

        if (!patientId) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'patientId or patient required',
            },
          });
        }

        const [pat] = await tx
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
            requestedServices: JSON.stringify(input.requestedServices ?? ['wound']),
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
            resourceId: created!.id,
            patientId,
            after: created,
            requestId: opts?.requestId,
            ip: opts?.ip,
          },
          tx,
        );

        return created;
      });
    } catch (err) {
      // Concurrent same Idempotency-Key → replay existing row
      if (opts?.idempotencyKey && isUniqueViolation(err)) {
        const existing = await this.findByIdempotencyKey(user.orgId, opts.idempotencyKey);
        if (existing) {
          return { ...existing, _idempotentReplay: true as const };
        }
      }
      throw err;
    }
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateReferralInput,
    meta?: { requestId?: string },
  ) {
    const before = await this.getById(user.orgId, id);
    if (!before) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Referral not found' },
      });
    }

    // Terminal / workflow statuses cannot be set via PATCH
    if (
      before.status === 'accepted' ||
      before.status === 'declined' ||
      before.status === 'converted' ||
      before.status === 'cancelled'
    ) {
      if (input.status !== undefined) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_STATE',
            message: `Cannot change status of referral in ${before.status}; use accept/decline endpoints`,
          },
        });
      }
    }

    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: user.id,
      };
      // Only allow new ↔ in_review transitions
      if (input.status !== undefined) {
        if (before.status !== 'new' && before.status !== 'in_review') {
          throw new BadRequestException({
            error: {
              code: 'INVALID_STATE',
              message: `Cannot set status from ${before.status} via PATCH`,
            },
          });
        }
        patch.status = input.status;
      }
      if (input.acuity !== undefined) patch.acuity = input.acuity;
      if (input.reasonForReferral !== undefined) {
        patch.reasonForReferral = input.reasonForReferral;
      }
      if (input.primaryDiagnosisText !== undefined) {
        patch.primaryDiagnosisText = input.primaryDiagnosisText;
      }
      if (input.primaryDiagnosisIcd10 !== undefined) {
        patch.primaryDiagnosisIcd10 = input.primaryDiagnosisIcd10;
      }
      if (input.intakeOwnerId !== undefined) patch.intakeOwnerId = input.intakeOwnerId;

      const [updated] = await tx
        .update(referrals)
        .set(patch)
        .where(eq(referrals.id, id))
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'referral.update',
          resourceType: 'referral',
          resourceId: id,
          patientId: before.patientId,
          before,
          after: updated,
          requestId: meta?.requestId,
        },
        tx,
      );

      return updated;
    });
  }

  private async alreadyAcceptedResult(orgId: string, referralId: string) {
    const referral = await this.getById(orgId, referralId);
    const [existingEp] = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.referralId, referralId))
      .limit(1);
    if (referral && existingEp) {
      return {
        referral,
        episode: existingEp,
        _alreadyAccepted: true as const,
      };
    }
    return null;
  }

  async accept(user: AuthUser, id: string, meta?: { requestId?: string; ip?: string }) {
    const referral = await this.getById(user.orgId, id);
    if (!referral) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Referral not found' },
      });
    }

    if (referral.status === 'accepted' || referral.status === 'converted') {
      const replay = await this.alreadyAcceptedResult(user.orgId, id);
      if (replay) return replay;
    }

    if (referral.status === 'declined' || referral.status === 'cancelled') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATE',
          message: `Cannot accept referral in status ${referral.status}`,
        },
      });
    }

    try {
      return await this.db.transaction(async (tx) => {
        // Re-check inside TX to reduce races with concurrent accept
        const [current] = await tx
          .select()
          .from(referrals)
          .where(and(eq(referrals.id, id), eq(referrals.orgId, user.orgId)))
          .limit(1);

        if (!current) {
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Referral not found' },
          });
        }

        if (current.status === 'accepted' || current.status === 'converted') {
          const [existingEp] = await tx
            .select()
            .from(episodes)
            .where(eq(episodes.referralId, id))
            .limit(1);
          if (existingEp) {
            return {
              referral: current,
              episode: existingEp,
              _alreadyAccepted: true as const,
            };
          }
        }

        if (current.status === 'declined' || current.status === 'cancelled') {
          throw new BadRequestException({
            error: {
              code: 'INVALID_STATE',
              message: `Cannot accept referral in status ${current.status}`,
            },
          });
        }

        const [org] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, user.orgId))
          .limit(1);

        const socHours =
          org?.settings?.socDueHours ??
          Number(process.env.SOC_DUE_HOURS ?? DEFAULT_SOC_DUE_HOURS);

        const receivedAt = current.receivedAt;
        const socDueAt = new Date(receivedAt.getTime() + socHours * 60 * 60 * 1000);

        const [patient] = await tx
          .select()
          .from(patients)
          .where(eq(patients.id, current.patientId))
          .limit(1);

        const [episode] = await tx
          .insert(episodes)
          .values({
            orgId: user.orgId,
            patientId: current.patientId,
            referralId: current.id,
            episodeNumber: 1,
            careType:
              org?.settings?.woundPathwayDefault === false ? 'home_health' : 'wound_only',
            status: 'pre_admit',
            referralReceivedAt: receivedAt,
            socDueAt,
            primaryDxIcd10: current.primaryDiagnosisIcd10,
            f2fStatus: 'unknown',
            ordersStatus: 'missing',
            intakeStatus: 'incomplete',
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();

        const [updatedReferral] = await tx
          .update(referrals)
          .set({
            status: 'accepted',
            updatedAt: new Date(),
            updatedBy: user.id,
            intakeOwnerId: current.intakeOwnerId ?? user.id,
          })
          .where(eq(referrals.id, id))
          .returning();

        await this.checklist.seedForEpisode(
          user.orgId,
          episode!.id,
          {
            woundPathway: org?.settings?.woundPathwayDefault !== false,
            capacityImpaired: patient?.capacityStatus === 'impaired',
          },
          tx as unknown as HhosDb,
        );

        await tx.insert(episodeTimelineEvents).values({
          orgId: user.orgId,
          episodeId: episode!.id,
          eventType: 'episode_accepted',
          summary: 'Referral accepted; pre-admit episode created',
          actorUserId: user.id,
        });

        await this.checklist.recomputeForEpisode(
          episode!.id,
          user.id,
          tx as unknown as HhosDb,
        );

        await this.audit.writeFromUser(
          user,
          {
            action: 'referral.accept',
            resourceType: 'referral',
            resourceId: id,
            patientId: current.patientId,
            episodeId: episode!.id,
            before: { status: current.status },
            after: { status: 'accepted', episodeId: episode!.id },
            requestId: meta?.requestId,
            ip: meta?.ip,
          },
          tx,
        );

        const [freshEpisode] = await tx
          .select()
          .from(episodes)
          .where(eq(episodes.id, episode!.id))
          .limit(1);

        return {
          referral: updatedReferral,
          episode: freshEpisode,
        };
      });
    } catch (err) {
      // Concurrent accept: second insert hits unique episodes.referralId
      if (isUniqueViolation(err)) {
        const replay = await this.alreadyAcceptedResult(user.orgId, id);
        if (replay) return replay;
      }
      throw err;
    }
  }

  async decline(
    user: AuthUser,
    id: string,
    input: DeclineReferralInput,
    meta?: { requestId?: string },
  ) {
    const referral = await this.getById(user.orgId, id);
    if (!referral) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Referral not found' },
      });
    }

    if (referral.status === 'accepted' || referral.status === 'converted') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATE',
          message: 'Cannot decline an accepted referral',
        },
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
}
