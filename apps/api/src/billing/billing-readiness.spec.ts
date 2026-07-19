import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateBillingReadiness } from './billing-readiness';

describe('evaluateBillingReadiness', () => {
  it('blocks home health when orders/POC unsigned', () => {
    const r = evaluateBillingReadiness({
      careType: 'home_health',
      claimType: 'hh_rap',
      episodeStatus: 'active',
      primaryDxIcd10: 'L97.909',
      ordersStatus: 'missing',
      pocStatus: 'not_started',
      f2fStatus: 'completed',
      intakeStatus: 'complete',
      coverageVerifiedRequired: false,
      hasCoverage: true,
      hasVerifiedCoverage: true,
      oasisLocked: false,
      oasisPresent: false,
      hospiceElectionStatus: null,
      hospiceTerminalDx: null,
      hospiceCertSigned: false,
      hospiceHasElection: false,
    });
    assert.equal(r.ready, false);
    assert.ok(r.gaps.some((g) => g.code === 'ORDERS_UNSIGNED'));
    assert.ok(r.gaps.some((g) => g.code === 'POC_UNSIGNED'));
  });

  it('is ready when HH signed + coverage present', () => {
    const r = evaluateBillingReadiness({
      careType: 'wound_only',
      claimType: 'hh_rap',
      episodeStatus: 'active',
      primaryDxIcd10: 'L97.909',
      ordersStatus: 'signed',
      pocStatus: 'signed',
      f2fStatus: 'completed',
      intakeStatus: 'ready_for_soc',
      coverageVerifiedRequired: false,
      hasCoverage: true,
      hasVerifiedCoverage: false,
      oasisLocked: false,
      oasisPresent: false,
      hospiceElectionStatus: null,
      hospiceTerminalDx: null,
      hospiceCertSigned: false,
      hospiceHasElection: false,
    });
    assert.equal(r.ready, true);
    assert.equal(r.hardGapCount, 0);
  });

  it('treats pre_admit as soft only when docs signed', () => {
    const r = evaluateBillingReadiness({
      careType: 'wound_only',
      claimType: 'hh_rap',
      episodeStatus: 'pre_admit',
      primaryDxIcd10: 'L97.909',
      ordersStatus: 'signed',
      pocStatus: 'signed',
      f2fStatus: 'unknown',
      intakeStatus: 'incomplete',
      coverageVerifiedRequired: false,
      hasCoverage: true,
      hasVerifiedCoverage: true,
      oasisLocked: false,
      oasisPresent: false,
      hospiceElectionStatus: null,
      hospiceTerminalDx: null,
      hospiceCertSigned: false,
      hospiceHasElection: false,
    });
    assert.equal(r.ready, true);
    assert.equal(r.hardGapCount, 0);
    assert.ok(r.gaps.some((g) => g.code === 'EPISODE_NOT_ACTIVE' && g.severity === 'soft'));
  });

  it('blocks hospice without signed cert', () => {
    const r = evaluateBillingReadiness({
      careType: 'hospice',
      claimType: 'hospice_claim',
      episodeStatus: 'active',
      primaryDxIcd10: 'C34.90',
      ordersStatus: 'signed',
      pocStatus: 'signed',
      f2fStatus: 'completed',
      intakeStatus: 'complete',
      coverageVerifiedRequired: false,
      hasCoverage: true,
      hasVerifiedCoverage: true,
      oasisLocked: false,
      oasisPresent: false,
      hospiceElectionStatus: 'active',
      hospiceTerminalDx: 'C34.90',
      hospiceCertSigned: false,
      hospiceHasElection: true,
    });
    assert.equal(r.ready, false);
    assert.ok(r.gaps.some((g) => g.code === 'HOSPICE_CERT_UNSIGNED'));
  });
});
