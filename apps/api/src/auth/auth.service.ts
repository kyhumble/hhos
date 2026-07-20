import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import {
  permissionsForRoles,
  type DevLoginInput,
  type RoleCode,
  type SessionExchangeInput,
} from '@hhos/shared';
import {
  organizations,
  roles,
  userRoles,
  users,
  type HhosDb,
} from '@hhos/db';
import { DB } from '../common/db.module';
import { log } from '../common/logger';
import { AuditService } from '../audit/audit.service';
import {
  cognitoTokenSatisfiesMfa,
  resolveMfaRequiredRoles,
  verifyCognitoIdToken,
} from './cognito-jwks';

type SessionUserRow = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  status: string;
  cognitoSub: string | null;
  mfaRequired: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
  ) {}

  /**
   * DEV ONLY — exchange demo email (+ optional orgId) for local JWT.
   * Disabled when AUTH_PROVIDER=cognito.
   */
  async devLogin(input: DevLoginInput) {
    if (process.env.AUTH_PROVIDER === 'cognito') {
      throw new UnauthorizedException({
        error: {
          code: 'DEV_LOGIN_DISABLED',
          message: 'Dev login disabled when AUTH_PROVIDER=cognito',
        },
      });
    }

    const email = input.email.toLowerCase().trim();

    const matches = await this.db
      .select({
        user: users,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(
        input.orgId
          ? and(eq(users.email, email), eq(users.orgId, input.orgId))
          : eq(users.email, email),
      );

    const active = matches.filter((m) => m.user.status === 'active');

    if (active.length === 0) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Unknown demo user' },
      });
    }

    if (active.length > 1 && !input.orgId) {
      throw new ConflictException({
        error: {
          code: 'ORG_SELECTION_REQUIRED',
          message: 'Email belongs to multiple organizations; pass orgId',
          organizations: active.map((m) => ({
            id: m.user.orgId,
            name: m.orgName,
            slug: m.orgSlug,
          })),
        },
      });
    }

    return this.issueSession(active[0]!.user, active[0]!.orgName, active[0]!.orgSlug);
  }

  /**
   * Production path: verify Cognito ID token → map to org user(s) → issue app JWT.
   */
  async exchangeSession(input: SessionExchangeInput) {
    let claims;
    try {
      claims = await verifyCognitoIdToken(input.idToken);
    } catch (e) {
      log.warn('cognito_id_token_invalid', {
        message: e instanceof Error ? e.message.slice(0, 200) : 'verify_failed',
      });
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_ID_TOKEN',
          message: 'Cognito ID token validation failed',
        },
      });
    }

    const email = String(claims.email ?? '')
      .toLowerCase()
      .trim();
    const sub = claims.sub;

    // Find candidates: cognitoSub match OR (email match with invite/local placeholder sub)
    const conditions = [eq(users.cognitoSub, sub)];
    if (email) {
      conditions.push(eq(users.email, email));
    }

    const matches = await this.db
      .select({
        user: users,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(or(...conditions));

    // Prefer exact cognitoSub; also allow email match for first-time link
    const eligible = matches.filter((m) => {
      if (m.user.status === 'disabled') return false;
      if (m.user.cognitoSub === sub) return true;
      if (email && m.user.email === email) {
        // Allow link when sub is null, local-*, or invite-*
        const cs = m.user.cognitoSub ?? '';
        return (
          !cs ||
          cs.startsWith('local-') ||
          cs.startsWith('invite-') ||
          cs === sub
        );
      }
      return false;
    });

    const activeOrInvited = eligible.filter(
      (m) => m.user.status === 'active' || m.user.status === 'invited',
    );

    if (activeOrInvited.length === 0) {
      throw new UnauthorizedException({
        error: {
          code: 'USER_NOT_PROVISIONED',
          message: 'No active HHOS user for this Cognito identity — accept an invite first',
        },
      });
    }

    let chosen = activeOrInvited;
    if (input.orgId) {
      chosen = activeOrInvited.filter((m) => m.user.orgId === input.orgId);
      if (chosen.length === 0) {
        throw new UnauthorizedException({
          error: {
            code: 'USER_NOT_PROVISIONED',
            message: 'No membership for the selected organization',
          },
        });
      }
    }

    if (chosen.length > 1) {
      throw new ConflictException({
        error: {
          code: 'ORG_SELECTION_REQUIRED',
          message: 'Identity maps to multiple organizations; pass orgId',
          organizations: chosen.map((m) => ({
            id: m.user.orgId,
            name: m.orgName,
            slug: m.orgSlug,
          })),
        },
      });
    }

    const row = chosen[0]!;
    let user = row.user;

    if (user.status === 'disabled') {
      throw new UnauthorizedException({
        error: { code: 'USER_DISABLED', message: 'User account is disabled' },
      });
    }

    // Bind cognitoSub on first login
    if (user.cognitoSub !== sub) {
      await this.db
        .update(users)
        .set({
          cognitoSub: sub,
          status: user.status === 'invited' ? 'active' : user.status,
        })
        .where(eq(users.id, user.id));
      user = {
        ...user,
        cognitoSub: sub,
        status: user.status === 'invited' ? 'active' : user.status,
      };
      await this.audit.write({
        orgId: user.orgId,
        actorUserId: user.id,
        action: 'user.cognito_link',
        resourceType: 'user',
        resourceId: user.id,
        after: { cognitoLinked: true },
      });
    } else if (user.status === 'invited') {
      await this.db
        .update(users)
        .set({ status: 'active' })
        .where(eq(users.id, user.id));
      user = { ...user, status: 'active' };
    }

    const roleCodes = await this.loadRoles(user.id);
    this.assertMfaIfRequired(user, roleCodes, claims);

    return this.issueSession(user, row.orgName, row.orgSlug, roleCodes);
  }

  private assertMfaIfRequired(
    user: SessionUserRow,
    roleCodes: RoleCode[],
    claims: { amr?: string[]; sub: string; [k: string]: unknown },
  ) {
    const requiredRoles = resolveMfaRequiredRoles();
    const roleNeeds = roleCodes.some((r) => requiredRoles.includes(r));
    if (!user.mfaRequired && !roleNeeds) return;

    if (!cognitoTokenSatisfiesMfa(claims as never)) {
      throw new ForbiddenException({
        error: {
          code: 'MFA_REQUIRED',
          message:
            'MFA is required for this role. Complete MFA in Cognito Hosted UI and try again.',
        },
      });
    }
  }

  private async loadRoles(userId: string): Promise<RoleCode[]> {
    const roleRows = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return roleRows.map((r) => r.code as RoleCode);
  }

  private async issueSession(
    user: {
      id: string;
      orgId: string;
      email: string;
      fullName: string;
      status?: string;
    },
    orgName: string,
    orgSlug: string,
    roleCodesPrefetched?: RoleCode[],
  ) {
    const roleCodes = roleCodesPrefetched ?? (await this.loadRoles(user.id));
    const permissions = [...permissionsForRoles(roleCodes)];

    const secret = process.env.JWT_SECRET ?? 'dev-only-change-me-not-for-prod';
    const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';

    const accessToken = jwt.sign(
      {
        sub: user.id,
        orgId: user.orgId,
        email: user.email,
        fullName: user.fullName,
        roles: roleCodes,
        permissions,
      },
      secret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] },
    );

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        fullName: user.fullName,
        roles: roleCodes,
        permissions,
      },
      organization: {
        id: user.orgId,
        name: orgName,
        slug: orgSlug,
      },
    };
  }
}
