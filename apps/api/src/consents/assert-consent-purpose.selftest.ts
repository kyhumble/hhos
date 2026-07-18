/**
 * Simple node selftest for evaluateConsentPurposeRecord (no jest).
 * Run: compile with tsc then `node dist/consents/assert-consent-purpose.selftest.js`
 */
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import {
  evaluateConsentPurposeRecord,
  type ConsentPurposeRecord,
} from './consents.service';

const BASE: ConsentPurposeRecord = {
  id: 'consent-1',
  status: 'signed',
  patientId: 'patient-a',
  episodeId: 'episode-1',
  templateId: 'template-1',
  expiresAt: null,
};

const PURPOSES = ['WOUND_PHOTO_CLINICAL', 'TREATMENT'];

function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ForbiddenException)) return undefined;
  const body = err.getResponse() as { error?: { code?: string } };
  return body?.error?.code;
}

function expectCode(fn: () => unknown, code: string, label: string) {
  try {
    fn();
    assert.fail(`${label}: expected throw ${code}`);
  } catch (err) {
    assert.equal(errorCode(err), code, `${label}: wrong code`);
  }
}

function main() {
  const ok = evaluateConsentPurposeRecord(
    BASE,
    {
      patientId: 'patient-a',
      purpose: 'WOUND_PHOTO_CLINICAL',
      episodeId: 'episode-1',
    },
    PURPOSES,
  );
  assert.deepEqual(ok, {
    consentRecordId: 'consent-1',
    templateId: 'template-1',
  });

  // Consent with null episodeId may be used for any episode
  const anyEp = evaluateConsentPurposeRecord(
    { ...BASE, episodeId: null },
    {
      patientId: 'patient-a',
      purpose: 'WOUND_PHOTO_CLINICAL',
      episodeId: 'episode-other',
    },
    PURPOSES,
  );
  assert.equal(anyEp.consentRecordId, 'consent-1');

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        { ...BASE, status: 'revoked' },
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
      ),
    'CONSENT_REVOKED',
    'revoked',
  );

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        { ...BASE, status: 'draft' },
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
      ),
    'CONSENT_REQUIRED',
    'draft',
  );

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        { ...BASE, status: 'void' },
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
      ),
    'CONSENT_REQUIRED',
    'void',
  );

  const past = new Date('2020-01-01T00:00:00.000Z');
  const now = new Date('2024-06-01T00:00:00.000Z');
  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        { ...BASE, expiresAt: past },
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
        now,
      ),
    'CONSENT_EXPIRED',
    'expired',
  );

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        BASE,
        { patientId: 'patient-b', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
      ),
    'CONSENT_MISMATCH',
    'wrong patient',
  );

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        BASE,
        {
          patientId: 'patient-a',
          purpose: 'WOUND_PHOTO_CLINICAL',
          episodeId: 'episode-other',
        },
        PURPOSES,
      ),
    'CONSENT_MISMATCH',
    'wrong episode',
  );

  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        BASE,
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_QA' },
        PURPOSES,
      ),
    'CONSENT_REQUIRED',
    'purpose missing',
  );

  // Order: revoked wins even if mismatch would also apply
  expectCode(
    () =>
      evaluateConsentPurposeRecord(
        { ...BASE, status: 'revoked', patientId: 'patient-other' },
        { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
        PURPOSES,
      ),
    'CONSENT_REVOKED',
    'revoked before mismatch',
  );

  console.log('assert-consent-purpose.selftest: ok');
}

main();
