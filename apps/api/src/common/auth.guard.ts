import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { AuthUser } from './auth.types';
import type { PermissionCode, RoleCode } from '@hhos/shared';

/**
 * Validates HHOS app JWT (HS256 / JWT_SECRET) only.
 * Cognito ID tokens are never accepted on domain routes — exchange via POST /v1/auth/session.
 */
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

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      });
    }

    const secret = process.env.JWT_SECRET ?? 'dev-only-change-me-not-for-prod';

    try {
      const payload = jwt.verify(token, secret) as {
        sub: string;
        orgId: string;
        email: string;
        fullName: string;
        roles: RoleCode[];
        permissions: PermissionCode[];
      };
      if (!payload.sub || !payload.orgId) {
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token claims — sign in again',
          },
        });
      }
      req.user = {
        id: payload.sub,
        orgId: payload.orgId,
        email: payload.email,
        fullName: payload.fullName,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      const name = e instanceof Error ? e.name : '';
      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Session expired — please sign in again',
          },
        });
      }
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session — please sign in again',
        },
      });
    }
  }
}
