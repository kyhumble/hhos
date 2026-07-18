import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@hhos/shared';

export const PERMISSIONS_KEY = 'required_permissions';

/** Require any of the listed permissions (OR). Empty = auth only. */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
