import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuditService, type AuditExecutor } from './audit.service';
import type { HhosDb } from '@hhos/db';
import type { AuthUser } from '../common/auth.types';

function mockExecutor(capture: Record<string, unknown>[]) {
  return {
    insert() {
      return {
        values(row: Record<string, unknown>) {
          capture.push(row);
          return Promise.resolve();
        },
      };
    },
  } as unknown as AuditExecutor;
}

describe('AuditService deviceId', () => {
  it('write includes deviceId in insert values', async () => {
    const rows: Record<string, unknown>[] = [];
    const svc = new AuditService({} as HhosDb);
    await svc.write(
      {
        orgId: 'org-1',
        action: 'wound_photo.initiate',
        resourceType: 'wound_photo',
        resourceId: 'photo-1',
        patientId: 'patient-1',
        deviceId: 'device-abc-12345',
        after: { dekBase64: 'secret', status: 'pending' },
      },
      mockExecutor(rows),
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.deviceId, 'device-abc-12345');
    assert.equal(rows[0]!.action, 'wound_photo.initiate');
    const after = rows[0]!.after as Record<string, unknown>;
    assert.equal(after.dekBase64, '[REDACTED]');
    assert.equal(after.status, 'pending');
  });

  it('writeFromUser forwards deviceId', async () => {
    const rows: Record<string, unknown>[] = [];
    const svc = new AuditService({} as HhosDb);
    const user: AuthUser = {
      id: 'user-1',
      orgId: 'org-1',
      email: 'rn@example.com',
      fullName: 'Field RN',
      roles: ['field_rn'],
      permissions: [],
    };

    await svc.writeFromUser(
      user,
      {
        action: 'wound_photo.view',
        resourceType: 'wound_photo',
        resourceId: 'photo-1',
        deviceId: 'device-from-user',
      },
      mockExecutor(rows),
    );

    assert.equal(rows[0]!.deviceId, 'device-from-user');
    assert.equal(rows[0]!.orgId, 'org-1');
    assert.equal(rows[0]!.actorUserId, 'user-1');
    assert.equal(rows[0]!.actorType, 'user');
  });

  it('write defaults missing deviceId to null', async () => {
    const rows: Record<string, unknown>[] = [];
    const svc = new AuditService({} as HhosDb);
    await svc.write(
      {
        orgId: 'org-1',
        action: 'consent.capture',
        resourceType: 'consent_record',
      },
      mockExecutor(rows),
    );
    assert.equal(rows[0]!.deviceId, null);
  });
});
