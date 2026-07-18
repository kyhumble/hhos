import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { deviceRevocations, devices, type HhosDb } from '@hhos/db';
import type { RegisterDeviceInput, RevokeDeviceInput } from '@hhos/shared';
import { DB } from '../common/db.module';
import { isUniqueViolation } from '../common/db-errors';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';

export type DeviceRow = typeof devices.$inferSelect;

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  /**
   * List devices registered by the current user (ids/metadata only — no PHI).
   */
  async listMine(user: AuthUser) {
    const rows = await this.db
      .select({
        id: devices.id,
        deviceId: devices.deviceId,
        platform: devices.platform,
        model: devices.model,
        osVersion: devices.osVersion,
        appVersion: devices.appVersion,
        status: devices.status,
        lastSeenAt: devices.lastSeenAt,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(and(eq(devices.orgId, user.orgId), eq(devices.userId, user.id)))
      .limit(50);

    return { data: rows };
  }

  /**
   * Upsert register on (org_id, device_id).
   * Active → refresh last_seen_at / metadata; revoked → 403 DEVICE_REVOKED.
   */
  async register(
    user: AuthUser,
    input: RegisterDeviceInput,
    meta?: { requestId?: string; ip?: string; userAgent?: string },
  ): Promise<DeviceRow> {
    const existing = await this.findByOrgDevice(user.orgId, input.deviceId);

    if (existing?.status === 'revoked') {
      throw new ForbiddenException({
        error: {
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked and cannot re-register',
        },
      });
    }

    if (existing) {
      const [updated] = await this.db
        .update(devices)
        .set({
          userId: user.id,
          platform: input.platform,
          model: input.model ?? existing.model,
          osVersion: input.os ?? existing.osVersion,
          appVersion: input.appVersion,
          status: 'active',
          lastSeenAt: new Date(),
        })
        .where(eq(devices.id, existing.id))
        .returning();

      await this.audit.writeFromUser(user, {
        action: 'device.register',
        resourceType: 'device',
        resourceId: existing.id,
        after: this.safeDevice(updated ?? existing),
        requestId: meta?.requestId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: input.deviceId,
      });

      return updated ?? existing;
    }

    try {
      const [created] = await this.db
        .insert(devices)
        .values({
          orgId: user.orgId,
          userId: user.id,
          deviceId: input.deviceId,
          platform: input.platform,
          model: input.model ?? null,
          osVersion: input.os ?? null,
          appVersion: input.appVersion,
          status: 'active',
          lastSeenAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new Error('device insert returned no row');
      }

      await this.audit.writeFromUser(user, {
        action: 'device.register',
        resourceType: 'device',
        resourceId: created.id,
        after: this.safeDevice(created),
        requestId: meta?.requestId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: input.deviceId,
      });

      return created;
    } catch (err) {
      // Concurrent register: re-read and apply revoked / refresh rules once.
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.findByOrgDevice(user.orgId, input.deviceId);
      if (!raced) throw err;
      if (raced.status === 'revoked') {
        throw new ForbiddenException({
          error: {
            code: 'DEVICE_REVOKED',
            message: 'Device has been revoked and cannot re-register',
          },
        });
      }

      const [updated] = await this.db
        .update(devices)
        .set({
          userId: user.id,
          platform: input.platform,
          model: input.model ?? raced.model,
          osVersion: input.os ?? raced.osVersion,
          appVersion: input.appVersion,
          status: 'active',
          lastSeenAt: new Date(),
        })
        .where(eq(devices.id, raced.id))
        .returning();

      await this.audit.writeFromUser(user, {
        action: 'device.register',
        resourceType: 'device',
        resourceId: raced.id,
        after: this.safeDevice(updated ?? raced),
        requestId: meta?.requestId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: input.deviceId,
      });

      return updated ?? raced;
    }
  }

  /**
   * Revoke by app-generated deviceId (text). Idempotent if already revoked.
   */
  async revoke(
    user: AuthUser,
    deviceId: string,
    input: RevokeDeviceInput,
    meta?: { requestId?: string; ip?: string; userAgent?: string },
  ): Promise<DeviceRow> {
    const existing = await this.findByOrgDevice(user.orgId, deviceId);

    if (!existing) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    if (existing.status === 'revoked') {
      return existing;
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(devices)
        .set({ status: 'revoked' })
        .where(eq(devices.id, existing.id))
        .returning();

      await tx.insert(deviceRevocations).values({
        deviceRowId: existing.id,
        revokedByUserId: user.id,
        reason: input.reason,
      });

      const row = updated ?? { ...existing, status: 'revoked' as const };

      await this.audit.writeFromUser(
        user,
        {
          action: 'device.revoke',
          resourceType: 'device',
          resourceId: existing.id,
          before: this.safeDevice(existing),
          after: this.safeDevice(row),
          reason: input.reason,
          requestId: meta?.requestId,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceId,
        },
        tx,
      );

      return row;
    });
  }

  /**
   * Gate for photo/annotation ops (PR 5b+). Touches last_seen_at when active.
   */
  async assertActiveDevice(
    orgId: string,
    deviceId: string,
  ): Promise<DeviceRow> {
    const row = await this.findByOrgDevice(orgId, deviceId);

    if (!row) {
      throw new ForbiddenException({
        error: {
          code: 'DEVICE_NOT_REGISTERED',
          message: 'Device must be registered before this operation',
        },
      });
    }

    if (row.status === 'revoked') {
      throw new ForbiddenException({
        error: {
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked',
        },
      });
    }

    const [touched] = await this.db
      .update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, row.id))
      .returning();

    return touched ?? row;
  }

  private async findByOrgDevice(
    orgId: string,
    deviceId: string,
  ): Promise<DeviceRow | null> {
    const [row] = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.orgId, orgId), eq(devices.deviceId, deviceId)))
      .limit(1);
    return row ?? null;
  }

  /** Safe audit projection — never include secrets (none on device rows today). */
  private safeDevice(row: DeviceRow) {
    return {
      id: row.id,
      deviceId: row.deviceId,
      platform: row.platform,
      model: row.model,
      osVersion: row.osVersion,
      appVersion: row.appVersion,
      status: row.status,
      userId: row.userId,
      lastSeenAt: row.lastSeenAt,
    };
  }
}
