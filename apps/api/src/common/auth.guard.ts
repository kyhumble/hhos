import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { AuthUser } from './auth.types';
import type { PermissionCode, RoleCode } from '@hhos/shared';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      });
    }

    const token = header.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET ?? 'dev-only-change-me-not-for-prod';

    if (process.env.AUTH_PROVIDER === 'cognito') {
      // Phase 1+: validate Cognito JWT / JWKS
      throw new UnauthorizedException({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Cognito validation not implemented in Phase 0',
        },
      });
    }

    try {
      const payload = jwt.verify(token, secret) as {
        sub: string;
        orgId: string;
        email: string;
        fullName: string;
        roles: RoleCode[];
        permissions: PermissionCode[];
      };
      req.user = {
        id: payload.sub,
        orgId: payload.orgId,
        email: payload.email,
        fullName: payload.fullName,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      });
    }
  }
}
