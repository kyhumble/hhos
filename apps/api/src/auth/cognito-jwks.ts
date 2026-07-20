/**
 * Cognito ID token verification via JWKS (Phase 9).
 * Domain routes use HHOS app JWTs only; Cognito tokens are accepted only at /v1/auth/session.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type CognitoIdClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  token_use?: string;
  client_id?: string;
  aud?: string | string[];
  iss?: string;
  /** Authentication methods reference (may include MFA indicators). */
  amr?: string[];
  /** Cognito often uses cognito:groups; MFA satisfaction varies by pool config. */
  auth_time?: number;
  [key: string]: unknown;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksIssuer: string | null = null;

export function cognitoIssuer(): string {
  if (process.env.COGNITO_ISSUER) {
    return process.env.COGNITO_ISSUER.replace(/\/$/, '');
  }
  const region = process.env.COGNITO_REGION;
  const pool = process.env.COGNITO_USER_POOL_ID;
  if (!region || !pool) {
    throw new Error('COGNITO_REGION and COGNITO_USER_POOL_ID required for Cognito auth');
  }
  return `https://cognito-idp.${region}.amazonaws.com/${pool}`;
}

function getJwks() {
  const issuer = cognitoIssuer();
  if (!jwks || jwksIssuer !== issuer) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksIssuer = issuer;
  }
  return jwks;
}

/** Reset JWKS cache (tests). */
export function resetCognitoJwksCache(): void {
  jwks = null;
  jwksIssuer = null;
}

export async function verifyCognitoIdToken(idToken: string): Promise<CognitoIdClaims> {
  const issuer = cognitoIssuer();
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!clientId) {
    throw new Error('COGNITO_CLIENT_ID required');
  }

  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer,
    // Cognito ID tokens use `aud` = app client id
    audience: clientId,
  });

  const claims = payload as JWTPayload & CognitoIdClaims;
  if (claims.token_use && claims.token_use !== 'id') {
    throw new Error('token_use must be id');
  }
  if (!claims.sub) {
    throw new Error('missing sub');
  }

  return claims as CognitoIdClaims;
}

/**
 * Whether Cognito claims indicate MFA was satisfied.
 * Cognito Hosted UI with MFA typically includes `amr` containing "mfa" or
 * challenge claims; also honor explicit env bypass for synthetic tests only.
 */
export function cognitoTokenSatisfiesMfa(claims: CognitoIdClaims): boolean {
  if (process.env.MFA_CHECK_BYPASS === 'true') return true;

  const amr = claims.amr;
  if (Array.isArray(amr)) {
    const joined = amr.map(String).join(' ').toLowerCase();
    if (joined.includes('mfa') || joined.includes('otp') || joined.includes('totp')) {
      return true;
    }
  }

  // Cognito access tokens sometimes use cognito:username only; ID tokens after MFA
  // may set `identities` or custom claims. Prefer explicit amr when present.
  // If pool enforces MFA at sign-in, presence of a fresh auth_time is not enough —
  // require amr or env COGNITO_MFA_CLAIM.
  const claimName = process.env.COGNITO_MFA_CLAIM;
  if (claimName && claims[claimName]) {
    return true;
  }

  // Fail closed when MFA is required by caller — return false unless proven.
  return false;
}

export function resolveMfaRequiredRoles(): string[] {
  const raw = process.env.MFA_REQUIRED_ROLES ?? 'admin,compliance';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
