import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cognitoTokenSatisfiesMfa, resolveMfaRequiredRoles } from './cognito-jwks';

describe('cognito MFA helpers', () => {
  it('detects mfa in amr', () => {
    assert.equal(cognitoTokenSatisfiesMfa({ sub: 'x', amr: ['pwd', 'mfa'] }), true);
    assert.equal(cognitoTokenSatisfiesMfa({ sub: 'x', amr: ['pwd'] }), false);
    assert.equal(cognitoTokenSatisfiesMfa({ sub: 'x' }), false);
  });

  it('defaults MFA required roles', () => {
    const prev = process.env.MFA_REQUIRED_ROLES;
    delete process.env.MFA_REQUIRED_ROLES;
    assert.deepEqual(resolveMfaRequiredRoles(), ['admin', 'compliance']);
    if (prev === undefined) delete process.env.MFA_REQUIRED_ROLES;
    else process.env.MFA_REQUIRED_ROLES = prev;
  });
});
