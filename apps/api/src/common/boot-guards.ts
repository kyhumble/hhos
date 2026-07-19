/**
 * Phase 9 platform boot guards.
 * Local remains permissive; staging/production fail closed.
 */

import { featureEnabled } from './features';
import { log } from './logger';

export type HhosEnv = 'local' | 'staging' | 'production' | 'development' | 'test';

export function resolveHhosEnv(): HhosEnv {
  const raw = (process.env.HHOS_ENV ?? process.env.NODE_ENV ?? 'local').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'staging' || raw === 'stage') return 'staging';
  if (raw === 'test') return 'test';
  if (raw === 'development' || raw === 'dev') return 'development';
  return 'local';
}

export function isStrictEnv(env: HhosEnv = resolveHhosEnv()): boolean {
  return env === 'staging' || env === 'production';
}

export type BootCheckResult =
  | { ok: true; env: HhosEnv; warnings: string[] }
  | { ok: false; env: HhosEnv; errors: string[]; warnings: string[] };

/**
 * Validate platform config. Does not throw — caller decides fail vs warn.
 */
export function validateBootConfig(
  envOverride?: Partial<NodeJS.ProcessEnv>,
): BootCheckResult {
  const env = { ...process.env, ...envOverride };
  const hhosEnv = (() => {
    const raw = (env.HHOS_ENV ?? env.NODE_ENV ?? 'local').toLowerCase();
    if (raw === 'production' || raw === 'prod') return 'production' as const;
    if (raw === 'staging' || raw === 'stage') return 'staging' as const;
    if (raw === 'test') return 'test' as const;
    if (raw === 'development' || raw === 'dev') return 'development' as const;
    return 'local' as const;
  })();

  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = hhosEnv === 'staging' || hhosEnv === 'production';

  const authProvider = (env.AUTH_PROVIDER ?? 'local').toLowerCase();
  const rlsOn =
    env.FEATURE_RLS === '1' ||
    env.FEATURE_RLS?.toLowerCase() === 'true' ||
    env.FEATURE_RLS?.toLowerCase() === 'yes';
  const jwtSecret = env.JWT_SECRET ?? '';
  const emailProvider = (env.EMAIL_PROVIDER ?? 'console').toLowerCase();

  if (strict) {
    if (!rlsOn) {
      errors.push('FEATURE_RLS must be true in staging/production');
    }
    if (authProvider !== 'cognito') {
      errors.push('AUTH_PROVIDER must be cognito in staging/production');
    }
    if (!jwtSecret || jwtSecret.includes('dev-only') || jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be a strong secret (not the local default)');
    }
    if (!env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID || !env.COGNITO_REGION) {
      errors.push('COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, and COGNITO_REGION are required');
    }
    if (!env.PHOTO_KEK || env.PHOTO_KEK.startsWith('00112233')) {
      warnings.push('PHOTO_KEK looks like the local synthetic default — rotate for real PHI envs');
    }
    if (emailProvider === 'console') {
      warnings.push('EMAIL_PROVIDER=console will not deliver real invite/sign emails');
    }
    if (emailProvider !== 'console' && !env.EMAIL_FROM) {
      errors.push('EMAIL_FROM is required when EMAIL_PROVIDER is not console');
    }
    if (env.DATABASE_URL?.includes('hhos:hhos_dev') || env.DATABASE_URL?.includes('@hhos:')) {
      warnings.push('DATABASE_URL may still use owner/superuser credentials — prefer hhos_app');
    }
  } else {
    if (!jwtSecret) {
      warnings.push('JWT_SECRET unset — set before any multi-user dogfood');
    }
  }

  if (errors.length > 0) {
    return { ok: false, env: hhosEnv, errors, warnings };
  }
  return { ok: true, env: hhosEnv, warnings };
}

/** Run at process start; exits process on hard failure in strict envs. */
export function assertBootGuards(): void {
  const result = validateBootConfig();
  for (const w of result.warnings) {
    log.warn('boot_guard_warning', { warning: w });
  }
  if (!result.ok) {
    for (const e of result.errors) {
      log.error('boot_guard_failed', { error: e });
    }
    throw new Error(
      `HHOS boot guards failed (${result.env}): ${result.errors.join('; ')}`,
    );
  }
  log.info('boot_guards_ok', {
    env: result.env,
    authProvider: process.env.AUTH_PROVIDER ?? 'local',
    rls: featureEnabled('FEATURE_RLS', false),
    emailProvider: process.env.EMAIL_PROVIDER ?? 'console',
  });
}
