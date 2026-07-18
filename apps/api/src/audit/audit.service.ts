import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { auditEvents, type HhosDb } from '@hhos/db';
import { DB } from '../common/db.module';
import { redactForAudit } from '../common/redact';
import type { AuthUser } from '../common/auth.types';

export type AuditWriteInput = {
  orgId: string;
  actorUserId?: string | null;
  actorType?: 'user' | 'system' | 'break_glass';
  action: string;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  episodeId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Client device id for mobile / field capture audit trails. */
  deviceId?: string | null;
};

/** DB or transaction handle (same insert surface). */
export type AuditExecutor = Pick<HhosDb, 'insert'>;

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: HhosDb) {}

  async write(input: AuditWriteInput, executor?: AuditExecutor): Promise<void> {
    const db = executor ?? this.db;
    await db.insert(auditEvents).values({
      orgId: input.orgId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? 'user',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      patientId: input.patientId ?? null,
      episodeId: input.episodeId ?? null,
      before: input.before !== undefined ? (redactForAudit(input.before) as object) : null,
      after: input.after !== undefined ? (redactForAudit(input.after) as object) : null,
      reason: input.reason ?? null,
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      deviceId: input.deviceId ?? null,
    });
  }

  async writeFromUser(
    user: AuthUser,
    input: Omit<AuditWriteInput, 'orgId' | 'actorUserId' | 'actorType'> & {
      requestId?: string | null;
      ip?: string | null;
      userAgent?: string | null;
    },
    executor?: AuditExecutor,
  ): Promise<void> {
    await this.write(
      {
        ...input,
        orgId: user.orgId,
        actorUserId: user.id,
        actorType: 'user',
      },
      executor,
    );
  }

  async list(orgId: string, opts?: { limit?: number; patientId?: string }) {
    const limit = opts?.limit ?? 50;
    const conditions = [eq(auditEvents.orgId, orgId)];
    if (opts?.patientId) {
      conditions.push(eq(auditEvents.patientId, opts.patientId));
    }

    const rows = await this.db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        actorUserId: auditEvents.actorUserId,
        actorType: auditEvents.actorType,
        action: auditEvents.action,
        resourceType: auditEvents.resourceType,
        resourceId: auditEvents.resourceId,
        patientId: auditEvents.patientId,
        episodeId: auditEvents.episodeId,
        reason: auditEvents.reason,
        requestId: auditEvents.requestId,
        ip: auditEvents.ip,
        userAgent: auditEvents.userAgent,
        deviceId: auditEvents.deviceId,
        before: auditEvents.before,
        after: auditEvents.after,
      })
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);

    return { data: rows };
  }
}
