import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateBootConfig } from './boot-guards';

describe('validateBootConfig', () => {
  it('allows local defaults', () => {
    const r = validateBootConfig({
      HHOS_ENV: 'local',
      AUTH_PROVIDER: 'local',
      FEATURE_RLS: 'false',
      JWT_SECRET: 'dev-only-change-me-not-for-prod',
    });
    assert.equal(r.ok, true);
    assert.equal(r.env, 'local');
  });

  it('fails staging without RLS and cognito', () => {
    const r = validateBootConfig({
      HHOS_ENV: 'staging',
      AUTH_PROVIDER: 'local',
      FEATURE_RLS: 'false',
      JWT_SECRET: 'a'.repeat(40),
      COGNITO_USER_POOL_ID: '',
      COGNITO_CLIENT_ID: '',
      COGNITO_REGION: '',
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.includes('FEATURE_RLS')));
      assert.ok(r.errors.some((e) => e.includes('AUTH_PROVIDER')));
    }
  });

  it('passes staging with required platform config', () => {
    const r = validateBootConfig({
      HHOS_ENV: 'staging',
      AUTH_PROVIDER: 'cognito',
      FEATURE_RLS: 'true',
      JWT_SECRET: 'staging-secret-at-least-32-chars-long!!',
      COGNITO_USER_POOL_ID: 'us-east-1_abc',
      COGNITO_CLIENT_ID: 'client123',
      COGNITO_REGION: 'us-east-1',
      EMAIL_PROVIDER: 'ses',
      EMAIL_FROM: 'noreply@example.com',
      PHOTO_KEK: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    assert.equal(r.ok, true);
  });

  it('requires EMAIL_FROM when provider is ses in production', () => {
    const r = validateBootConfig({
      HHOS_ENV: 'production',
      AUTH_PROVIDER: 'cognito',
      FEATURE_RLS: 'true',
      JWT_SECRET: 'prod-secret-at-least-32-characters-xx',
      COGNITO_USER_POOL_ID: 'us-east-1_abc',
      COGNITO_CLIENT_ID: 'client123',
      COGNITO_REGION: 'us-east-1',
      EMAIL_PROVIDER: 'ses',
      EMAIL_FROM: '',
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.includes('EMAIL_FROM')));
    }
  });
});
