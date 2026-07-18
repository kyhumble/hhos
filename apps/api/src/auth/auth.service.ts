import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import {
  permissionsForRoles,
  type RoleCode,
} from '@hhos/shared';
import {
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
   * DEV ONLY — exchange demo email for local JWT.
   * Disabled when AUTH_PROVIDER=cognito.
   */
  async devLogin(email: string) {
    if (process.env.AUTH_PROVIDER === 'cognito') {
      throw new UnauthorizedException({
        error: {
          code: 'DEV_LOGIN_DISABLED',
          message: 'Dev login disabled when AUTH_PROVIDER=cognito',
        },
      });
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Unknown demo user' },
      });
    }

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
    };
  }
}
