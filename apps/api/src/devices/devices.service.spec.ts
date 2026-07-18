import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { HhosDb } from '@hhos/db';
import { DevicesService, type DeviceRow } from './devices.service';
import type { AuthUser } from '../common/auth.types';
import type { AuditService } from '../audit/audit.service';

const user: AuthUser = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'rn@example.com',
  fullName: 'Field RN',
  roles: ['field_rn'],
  permissions: [],
};

function baseDevice(over: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'row-1',
    orgId: 'org-1',
    userId: 'user-1',
    deviceId: 'device-abc-12345',
    platform: 'ios',
    model: 'iPhone',
    osVersion: '17',
    appVersion: '1.0.0',
    status: 'active',
    lastSeenAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  } as DeviceRow;
}

type MockOpts = {
  /** Results returned by successive find (select) calls. */
  finds: Array<DeviceRow | null>;
  /** Rows returned by UPDATE … RETURNING (empty = concurrent revoke). */
  updateReturning: DeviceRow[];
  /** Capture last update where predicate for assertions. */
  onUpdateWhere?: (where: unknown) => void;
};

/**
 * Minimal chainable mock for select/update used by register + assertActiveDevice.
 * Does not exercise real SQL — verifies fail-closed behavior when RETURNING is empty.
 */
function mockDb(opts: MockOpts): HhosDb {
  let findIdx = 0;
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  const row = opts.finds[findIdx++] ?? null;
                  return Promise.resolve(row ? [row] : []);
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return {
            where(where: unknown) {
              opts.onUpdateWhere?.(where);
              return {
                returning() {
                  return Promise.resolve(opts.updateReturning);
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            returning() {
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  } as unknown as HhosDb;
}

function silentAudit(): AuditService {
  return {
    writeFromUser: async () => undefined,
    write: async () => undefined,
    list: async () => ({ data: [] }),
  } as unknown as AuditService;
}

function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ForbiddenException)) return undefined;
  const body = err.getResponse() as { error?: { code?: string } };
  return body?.error?.code;
}

describe('DevicesService concurrent revoke races', () => {
  it('register throws DEVICE_REVOKED when UPDATE returns zero rows (concurrent revoke)', async () => {
    const active = baseDevice({ status: 'active' });
    const revoked = baseDevice({ status: 'revoked' });
    const svc = new DevicesService(
      mockDb({
        finds: [active, revoked],
        updateReturning: [],
      }),
      silentAudit(),
    );

    await assert.rejects(
      () =>
        svc.register(user, {
          deviceId: 'device-abc-12345',
          platform: 'ios',
          appVersion: '1.0.1',
        }),
      (err: unknown) => {
        assert.equal(errorCode(err), 'DEVICE_REVOKED');
        return true;
      },
    );
  });

  it('register sequential revoked row throws DEVICE_REVOKED without update', async () => {
    const revoked = baseDevice({ status: 'revoked' });
    let updated = false;
    const db = mockDb({
      finds: [revoked],
      updateReturning: [],
      onUpdateWhere: () => {
        updated = true;
      },
    });
    const svc = new DevicesService(db, silentAudit());

    await assert.rejects(
      () =>
        svc.register(user, {
          deviceId: 'device-abc-12345',
          platform: 'ios',
          appVersion: '1.0.1',
        }),
      (err: unknown) => {
        assert.equal(errorCode(err), 'DEVICE_REVOKED');
        return true;
      },
    );
    assert.equal(updated, false);
  });

  it('assertActiveDevice throws DEVICE_REVOKED when touch UPDATE returns empty', async () => {
    const active = baseDevice({ status: 'active' });
    const svc = new DevicesService(
      mockDb({
        finds: [active],
        updateReturning: [],
      }),
      silentAudit(),
    );

    await assert.rejects(
      () => svc.assertActiveDevice('org-1', 'device-abc-12345'),
      (err: unknown) => {
        assert.equal(errorCode(err), 'DEVICE_REVOKED');
        return true;
      },
    );
  });

  it('assertActiveDevice throws DEVICE_REVOKED if RETURNING row is revoked', async () => {
    const active = baseDevice({ status: 'active' });
    const revoked = baseDevice({ status: 'revoked' });
    const svc = new DevicesService(
      mockDb({
        finds: [active],
        updateReturning: [revoked],
      }),
      silentAudit(),
    );

    await assert.rejects(
      () => svc.assertActiveDevice('org-1', 'device-abc-12345'),
      (err: unknown) => {
        assert.equal(errorCode(err), 'DEVICE_REVOKED');
        return true;
      },
    );
  });

  it('assertActiveDevice returns active touched row', async () => {
    const active = baseDevice({ status: 'active' });
    const touched = baseDevice({
      status: 'active',
      lastSeenAt: new Date('2026-06-01T00:00:00Z'),
    });
    const svc = new DevicesService(
      mockDb({
        finds: [active],
        updateReturning: [touched],
      }),
      silentAudit(),
    );

    const row = await svc.assertActiveDevice('org-1', 'device-abc-12345');
    assert.equal(row.status, 'active');
    assert.equal(row.lastSeenAt.toISOString(), '2026-06-01T00:00:00.000Z');
  });

  it('assertActiveDevice missing device → DEVICE_NOT_REGISTERED', async () => {
    const svc = new DevicesService(
      mockDb({ finds: [null], updateReturning: [] }),
      silentAudit(),
    );

    await assert.rejects(
      () => svc.assertActiveDevice('org-1', 'missing-device-id'),
      (err: unknown) => {
        assert.equal(errorCode(err), 'DEVICE_NOT_REGISTERED');
        return true;
      },
    );
  });
});
