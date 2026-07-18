import type { PermissionCode, RoleCode } from '@hhos/shared';

export type AuthUser = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
};
