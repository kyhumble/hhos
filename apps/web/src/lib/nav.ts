import { Permission, type PermissionCode } from '@hhos/shared';
import type { SessionUser } from './auth';

export type NavItem = {
  href: string;
  label: string;
  group: string;
  /** If set, user must have at least one of these permissions. Empty = always show when logged in. */
  anyOf?: PermissionCode[];
  /** Show even when logged out */
  public?: boolean;
};

export const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', group: 'Overview' },
  {
    href: '/ai-assist',
    label: 'AI Assist',
    group: 'Clinical',
    anyOf: [Permission.OASIS_READ, Permission.VISIT_TASK_READ, Permission.EPISODE_READ],
  },
  {
    href: '/intake',
    label: 'Intake',
    group: 'Clinical',
    anyOf: [Permission.EPISODE_READ, Permission.PATIENT_READ, Permission.REFERRAL_CREATE],
  },
  {
    href: '/oasis',
    label: 'OASIS',
    group: 'Clinical',
    anyOf: [Permission.OASIS_READ, Permission.EPISODE_READ],
  },
  {
    href: '/tasks',
    label: 'Clinical tasks',
    group: 'Clinical',
    anyOf: [Permission.CLINICAL_TASK_READ],
  },
  {
    href: '/routing',
    label: 'Routing',
    group: 'Operations',
    anyOf: [Permission.ROUTING_READ, Permission.ROUTING_SUGGEST, Permission.ROUTING_DECIDE],
  },
  {
    href: '/field-tasks',
    label: 'Field tasks',
    group: 'Operations',
    anyOf: [Permission.VISIT_TASK_READ, Permission.VISIT_TASK_WRITE, Permission.EPISODE_READ],
  },
  {
    href: '/orders',
    label: 'Orders / 485',
    group: 'Compliance',
    anyOf: [Permission.ORDER_READ, Permission.ORDER_WRITE, Permission.ORDER_SEND],
  },
  {
    href: '/hospice',
    label: 'Hospice',
    group: 'Compliance',
    anyOf: [Permission.HOSPICE_READ, Permission.HOSPICE_WRITE],
  },
  {
    href: '/billing',
    label: 'Billing',
    group: 'Revenue',
    anyOf: [Permission.BILLING_READ, Permission.BILLING_WRITE],
  },
  {
    href: '/admin',
    label: 'Org admin',
    group: 'Platform',
    anyOf: [Permission.USER_ADMIN, Permission.ORG_SETTINGS],
  },
  { href: '/onboard', label: 'New agency', group: 'Platform', public: true },
];

function hasAny(user: SessionUser | null, anyOf?: PermissionCode[]): boolean {
  if (!anyOf || anyOf.length === 0) return true;
  if (!user?.permissions?.length) return false;
  return anyOf.some((p) => user.permissions.includes(p));
}

/** Filter nav by session permissions. Logged-out users see public items + dashboard. */
export function navForUser(user: SessionUser | null): NavItem[] {
  return NAV.filter((item) => {
    if (item.public) return true;
    if (!user) return item.href === '/';
    return hasAny(user, item.anyOf);
  });
}
