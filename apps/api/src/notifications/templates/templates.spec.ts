import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOrgInviteEmail } from './invite';
import { buildPhysicianSignEmail } from './physician-sign';

const FORBIDDEN = [
  /\bMRN\b/i,
  /\bssn\b/i,
  /\bdiagnosis\b/i,
  /\bICD-?10\b/i,
];

describe('notification templates', () => {
  it('invite template has no forbidden clinical markers', () => {
    const { subject, textBody } = buildOrgInviteEmail({
      orgName: 'Demo Home Health',
      roleLabel: 'Field RN',
      acceptUrl: 'http://localhost:3000/invite?token=abc',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    const blob = `${subject}\n${textBody}`;
    for (const re of FORBIDDEN) {
      assert.equal(re.test(blob), false, `matched ${re}`);
    }
    assert.match(textBody, /Accept your invite/);
    assert.match(textBody, /invite\?token=/);
  });

  it('physician sign uses initials only, not full name', () => {
    const { subject, textBody } = buildPhysicianSignEmail({
      orgName: 'Demo HH',
      docTypeLabel: 'Plan of Care / CMS-485',
      signUrl: 'http://localhost:3000/sign/tok',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      physicianName: 'Dr. Pat Provider',
      patientInitials: 'JS',
      dobYear: 1942,
    });
    assert.match(subject, /Signature requested/);
    assert.match(textBody, /Patient reference: JS, DOB year 1942/);
    assert.doesNotMatch(textBody, /John Smith/);
  });
});
