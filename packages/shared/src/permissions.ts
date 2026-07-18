import type { RoleCode } from './enums';

export const Permission = {
  PATIENT_READ: 'patient:read',
  PATIENT_WRITE: 'patient:write',
  REFERRAL_CREATE: 'referral:create',
  REFERRAL_WRITE: 'referral:write',
  EPISODE_READ: 'episode:read',
  EPISODE_WRITE: 'episode:write',
  EPISODE_ASSIGN: 'episode:assign',
  CONSENT_CAPTURE: 'consent:capture',
  CONSENT_REVOKE: 'consent:revoke',
  CONSENT_READ: 'consent:read',
  COVERAGE_WRITE: 'coverage:write',
  CHECKLIST_WRITE: 'checklist:write',
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_READ: 'document:read',
  AUDIT_READ: 'audit:read',
  USER_ADMIN: 'user:admin',
  ORG_SETTINGS: 'org:settings',
  BREAK_GLASS_PHI: 'break_glass:phi',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(Permission);

const R = Permission;

/** Role → permission map (Phase 1 RBAC v1) */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  field_rn: [
    R.PATIENT_READ,
    R.PATIENT_WRITE, // limited in service layer
    R.EPISODE_READ,
    R.EPISODE_WRITE, // limited
    R.CONSENT_CAPTURE,
    R.CONSENT_READ,
    R.DOCUMENT_UPLOAD,
    R.DOCUMENT_READ,
  ],
  intake_coordinator: [
    R.PATIENT_READ,
    R.PATIENT_WRITE,
    R.REFERRAL_CREATE,
    R.REFERRAL_WRITE,
    R.EPISODE_READ,
    R.EPISODE_WRITE,
    R.EPISODE_ASSIGN,
    R.CONSENT_CAPTURE,
    R.CONSENT_REVOKE,
    R.CONSENT_READ,
    R.COVERAGE_WRITE,
    R.CHECKLIST_WRITE,
    R.DOCUMENT_UPLOAD,
    R.DOCUMENT_READ,
  ],
  clinical_lead: [
    R.PATIENT_READ,
    R.PATIENT_WRITE,
    R.REFERRAL_CREATE,
    R.REFERRAL_WRITE,
    R.EPISODE_READ,
    R.EPISODE_WRITE,
    R.EPISODE_ASSIGN,
    R.CONSENT_CAPTURE,
    R.CONSENT_REVOKE,
    R.CONSENT_READ,
    R.COVERAGE_WRITE,
    R.CHECKLIST_WRITE,
    R.DOCUMENT_UPLOAD,
    R.DOCUMENT_READ,
    R.AUDIT_READ, // limited in service layer
  ],
  billing: [
    R.PATIENT_READ,
    R.EPISODE_READ,
    R.CONSENT_READ,
    R.COVERAGE_WRITE,
    R.DOCUMENT_READ,
  ],
  compliance: [
    R.PATIENT_READ,
    R.EPISODE_READ,
    R.CONSENT_READ,
    R.CONSENT_REVOKE,
    R.DOCUMENT_READ,
    R.AUDIT_READ,
    R.BREAK_GLASS_PHI,
  ],
  admin: [...ALL_PERMISSIONS],
};

export function permissionsForRoles(roles: RoleCode[]): Set<PermissionCode> {
  const set = new Set<PermissionCode>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) {
      set.add(p);
    }
  }
  return set;
}

export function hasPermission(
  roles: RoleCode[],
  permission: PermissionCode,
): boolean {
  return permissionsForRoles(roles).has(permission);
}
