import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from '@hhos/shared';
import type { AuthUser } from './auth.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Not authenticated' },
      });
    }

    const ok = required.some((p) => user.permissions.includes(p));
    if (!ok) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of: ${required.join(', ')}`,
        },
      });
    }
    return true;
  }
}
