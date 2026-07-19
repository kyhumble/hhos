import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import {
  permissionsForRoles,
  type DevLoginInput,
  type RoleCode,
} from '@hhos/shared';
import {
  organizations,
  roles,
  userRoles,
  users,
  type HhosDb,
} from '@hhos/db';
import { DB } from '../common/db.module';

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: HhosDb) {}

  /**
   * DEV ONLY — exchange demo email (+ optional orgId) for local JWT.
   * Disabled when AUTH_PROVIDER=cognito.
   * Multi-tenant: if email matches multiple orgs, returns ORG_SELECTION_REQUIRED.
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

    const user = active[0]!.user;

    const roleRows = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const roleCodes = roleRows.map((r) => r.code as RoleCode);
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
        name: active[0]!.orgName,
        slug: active[0]!.orgSlug,
      },
    };
  }
}
