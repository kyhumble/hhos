import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeOasisGapsAndFlags } from './pdgm';

describe('computeOasisGapsAndFlags', () => {
  it('flags missing primary dx and LUPA risk', () => {
    const { flags, pdgmHint } = computeOasisGapsAndFlags({
      skilled_visits_planned: 2,
    });
    assert.ok(flags.some((f) => f.code === 'MISSING_PRIMARY_DX'));
    assert.ok(flags.some((f) => f.code === 'LUPA_RISK'));
    assert.equal(pdgmHint.lupaRisk, true);
    assert.ok(pdgmHint.disclaimer.includes('Advisory'));
  });

  it('clears primary dx flag when M1021 present', () => {
    const { flags, pdgmHint } = computeOasisGapsAndFlags({
      m1021: 'L97.909',
      m1021_desc: 'Ulcer',
      m0100: '1',
      m1000: 'Hospital',
      gg0130a: '3',
      gg0130b: '3',
      gg0170c: '4',
      gg0170d: '4',
      m1306: '0',
      m1340: '0',
      skilled_visits_planned: 8,
    });
    assert.ok(!flags.some((f) => f.code === 'MISSING_PRIMARY_DX'));
    assert.ok(!flags.some((f) => f.code === 'LUPA_RISK'));
    assert.equal(pdgmHint.primaryDxIcd10, 'L97.909');
  });
});
