import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
    assert.fail(`expected throw ${code}`);
  } catch (err) {
    assert.equal(errorCode(err), code);
  }
}

describe('evaluateConsentPurposeRecord', () => {
  it('returns ids on happy path', () => {
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
  });

  it('allows any episode when record.episodeId is null', () => {
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
  });

  it('returns CONSENT_REVOKED for revoked (before not-signed)', () => {
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          { ...BASE, status: 'revoked' },
          { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
          PURPOSES,
        ),
      'CONSENT_REVOKED',
    );
  });

  it('returns CONSENT_REQUIRED for draft/void', () => {
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          { ...BASE, status: 'draft' },
          { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
          PURPOSES,
        ),
      'CONSENT_REQUIRED',
    );
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          { ...BASE, status: 'void' },
          { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
          PURPOSES,
        ),
      'CONSENT_REQUIRED',
    );
  });

  it('returns CONSENT_EXPIRED when past expiresAt', () => {
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
    );
  });

  it('returns CONSENT_MISMATCH for wrong patient/episode', () => {
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          BASE,
          { patientId: 'patient-b', purpose: 'WOUND_PHOTO_CLINICAL' },
          PURPOSES,
        ),
      'CONSENT_MISMATCH',
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
    );
  });

  it('returns CONSENT_REQUIRED when purpose missing on template', () => {
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          BASE,
          { patientId: 'patient-a', purpose: 'WOUND_PHOTO_QA' },
          PURPOSES,
        ),
      'CONSENT_REQUIRED',
    );
  });

  it('prefers CONSENT_REVOKED over mismatch (ordered checks)', () => {
    expectCode(
      () =>
        evaluateConsentPurposeRecord(
          { ...BASE, status: 'revoked', patientId: 'patient-other' },
          { patientId: 'patient-a', purpose: 'WOUND_PHOTO_CLINICAL' },
          PURPOSES,
        ),
      'CONSENT_REVOKED',
    );
  });
});
