import { z } from 'zod';
import { RoleCode } from './enums';

/** Per-tenant feature toggles (platform FEATURE_* env remains a hard kill switch). */
export const OrgFeatureFlagsSchema = z.object({
  woundPhotos: z.boolean().optional(),
  oasis: z.boolean().optional(),
  serviceAi: z.boolean().optional(),
  ordersEsign: z.boolean().optional(),
  hospice: z.boolean().optional(),
  billing: z.boolean().optional(),
});
export type OrgFeatureFlags = z.infer<typeof OrgFeatureFlagsSchema>;

export const OrgSettingsSchema = z.object({
  socDueHours: z.number().int().min(1).max(168).optional(),
  photoGeotagEnabled: z.boolean().optional(),
  coverageVerifiedRequired: z.boolean().optional(),
  woundPathwayDefault: z.boolean().optional(),
  largeWoundLengthCm: z.number().positive().optional(),
  largeWoundWidthCm: z.number().positive().optional(),
  largeWoundAreaCm2: z.number().positive().optional(),
  photoMaxBytes: z.number().int().positive().optional(),
  photoPendingTtlHours: z.number().int().min(1).max(168).optional(),
  features: OrgFeatureFlagsSchema.optional(),
});
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  timezone: z.string().min(2).max(64).default('America/Chicago'),
  npi: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  adminEmail: z.string().email().max(320),
  adminFullName: z.string().min(1).max(200),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrgSettingsSchema = OrgSettingsSchema.partial().extend({
  name: z.string().min(2).max(200).optional(),
  timezone: z.string().min(2).max(64).optional(),
  npi: z
    .string()
    .regex(/^\d{10}$/)
    .nullable()
    .optional(),
  features: OrgFeatureFlagsSchema.optional(),
});
export type UpdateOrgSettingsInput = z.infer<typeof UpdateOrgSettingsSchema>;

export const InviteUserSchema = z.object({
  email: z.string().email().max(320),
  fullName: z.string().min(1).max(200),
  roleCode: z.enum(RoleCode),
  /** Hours until invite expires (default 72). */
  expiresInHours: z.number().int().min(1).max(720).default(72),
});
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().min(16).max(200),
  fullName: z.string().min(1).max(200).optional(),
});
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

export const DevLoginSchema = z.object({
  email: z.string().email().max(320),
  /** Required when the email exists in more than one org. */
  orgId: z.string().uuid().optional(),
});
export type DevLoginInput = z.infer<typeof DevLoginSchema>;

/** Exchange Cognito ID token for HHOS app JWT (Phase 9). */
export const SessionExchangeSchema = z.object({
  idToken: z.string().min(20).max(8192),
  /** Required when cognitoSub/email maps to multiple orgs. */
  orgId: z.string().uuid().optional(),
});
export type SessionExchangeInput = z.infer<typeof SessionExchangeSchema>;

export const DEFAULT_ORG_SETTINGS: Required<
  Pick<
    OrgSettings,
    | 'socDueHours'
    | 'photoGeotagEnabled'
    | 'coverageVerifiedRequired'
    | 'woundPathwayDefault'
    | 'largeWoundLengthCm'
    | 'largeWoundWidthCm'
    | 'largeWoundAreaCm2'
    | 'photoMaxBytes'
    | 'photoPendingTtlHours'
  >
> & { features: Required<OrgFeatureFlags> } = {
  socDueHours: 48,
  photoGeotagEnabled: false,
  coverageVerifiedRequired: false,
  woundPathwayDefault: true,
  largeWoundLengthCm: 10,
  largeWoundWidthCm: 10,
  largeWoundAreaCm2: 50,
  photoMaxBytes: 12_000_000,
  photoPendingTtlHours: 24,
  features: {
    woundPhotos: true,
    oasis: true,
    serviceAi: true,
    ordersEsign: true,
    hospice: true,
    billing: true,
  },
};
