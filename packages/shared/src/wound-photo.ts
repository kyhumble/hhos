import { z } from 'zod';
import {
  AnnotationType,
  CaptureSource,
  ClinicalTaskPriority,
  ClinicalTaskStatus,
  ClinicalTaskType,
  DevicePlatform,
  MeasurementMethod,
  VisitStatus,
  VisitType,
  WoundLaterality,
  WoundStatus,
  WoundType,
} from './enums';

// ─── Shared nested objects ──────────────────────────────────────────────────

export const DeviceInfoSchema = z.object({
  deviceId: z.string().min(8).max(128),
  model: z.string().max(100),
  os: z.string().max(50),
  appVersion: z.string().max(50),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().positive().optional(),
});

export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const WoundMeasurementsSchema = z.object({
  lengthCm: z.number().positive().max(100).optional(),
  widthCm: z.number().positive().max(100).optional(),
  depthCm: z.number().nonnegative().max(50).optional(),
  measurementMethod: z.enum(MeasurementMethod).optional(),
});

export type WoundMeasurements = z.infer<typeof WoundMeasurementsSchema>;

// ─── Wounds ─────────────────────────────────────────────────────────────────

export const CreateWoundSchema = z.object({
  patientId: z.string().uuid(),
  episodeId: z.string().uuid(),
  label: z.string().min(1).max(200),
  bodySiteCode: z.string().max(50).optional().nullable(),
  laterality: z.enum(WoundLaterality),
  woundType: z.enum(WoundType).optional().nullable(),
  openedAt: z.string().datetime().optional(),
});

export type CreateWoundInput = z.infer<typeof CreateWoundSchema>;

export const UpdateWoundSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  bodySiteCode: z.string().max(50).optional().nullable(),
  laterality: z.enum(WoundLaterality).optional(),
  woundType: z.enum(WoundType).optional().nullable(),
  status: z.enum(WoundStatus).optional(),
  closedAt: z.string().datetime().optional().nullable(),
});

export type UpdateWoundInput = z.infer<typeof UpdateWoundSchema>;

// ─── Visits ─────────────────────────────────────────────────────────────────

export const CreateVisitSchema = z.object({
  patientId: z.string().uuid(),
  episodeId: z.string().uuid(),
  startedAt: z.string().datetime().optional(),
  visitType: z.enum(VisitType),
  clientVisitId: z.string().min(1).max(128).optional(),
});

export type CreateVisitInput = z.infer<typeof CreateVisitSchema>;

export const UpdateVisitSchema = z.object({
  status: z.enum(VisitStatus).optional(),
  endedAt: z.string().datetime().optional().nullable(),
  visitType: z.enum(VisitType).optional(),
});

export type UpdateVisitInput = z.infer<typeof UpdateVisitSchema>;

// ─── Wound photo upload control plane ───────────────────────────────────────

export const InitiateWoundPhotoUploadSchema = z.object({
  clientPhotoId: z.string().uuid(),
  patientId: z.string().uuid(),
  episodeId: z.string().uuid(),
  woundId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  consentRecordId: z.string().uuid(),
  capturedAt: z.string().datetime(),
  contentType: z.literal('image/jpeg'),
  byteSize: z.number().int().positive().max(15_000_000),
  plaintextSha256: z.string().length(64).regex(/^[0-9a-fA-F]{64}$/),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  device: DeviceInfoSchema,
  geo: GeoPointSchema.optional(),
  captureSource: z.literal(CaptureSource[0]),
  purposeCode: z.literal('WOUND_PHOTO_CLINICAL'),
});

export type InitiateWoundPhotoUploadInput = z.infer<
  typeof InitiateWoundPhotoUploadSchema
>;

/** 32-byte DEK as standard base64 (not URL-safe). Never log this body. */
export const WrapDekSchema = z.object({
  dekBase64: z
    .string()
    .min(40)
    .max(64)
    .regex(/^[A-Za-z0-9+/]+=*$/),
});

export type WrapDekInput = z.infer<typeof WrapDekSchema>;

export const CompleteWoundPhotoUploadSchema = z
  .object({
    clientPhotoId: z.string().uuid(),
    cipherSha256: z.string().length(64).regex(/^[0-9a-fA-F]{64}$/),
    byteSize: z.number().int().positive().max(15_000_000),
  })
  .merge(WoundMeasurementsSchema);

export type CompleteWoundPhotoUploadInput = z.infer<
  typeof CompleteWoundPhotoUploadSchema
>;

export const PatchWoundPhotoMeasurementsSchema = WoundMeasurementsSchema.refine(
  (d) =>
    d.lengthCm !== undefined ||
    d.widthCm !== undefined ||
    d.depthCm !== undefined ||
    d.measurementMethod !== undefined,
  { message: 'At least one measurement field is required' },
);

export type PatchWoundPhotoMeasurementsInput = z.infer<
  typeof PatchWoundPhotoMeasurementsSchema
>;

// ─── Annotations (child DEK, online-only) ───────────────────────────────────

export const InitiateAnnotationUploadSchema = z.object({
  clientAnnotationId: z.string().uuid(),
  annotationType: z.enum(AnnotationType),
  contentType: z.enum(['application/json', 'image/png']),
  byteSize: z.number().int().positive().max(15_000_000),
  device: DeviceInfoSchema,
});

export type InitiateAnnotationUploadInput = z.infer<
  typeof InitiateAnnotationUploadSchema
>;

export const CompleteAnnotationUploadSchema = z.object({
  clientAnnotationId: z.string().uuid(),
  cipherSha256: z.string().length(64).regex(/^[0-9a-fA-F]{64}$/),
  byteSize: z.number().int().positive().max(15_000_000),
});

export type CompleteAnnotationUploadInput = z.infer<
  typeof CompleteAnnotationUploadSchema
>;

// ─── Devices ────────────────────────────────────────────────────────────────

export const RegisterDeviceSchema = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(DevicePlatform),
  model: z.string().max(100).optional(),
  osVersion: z.string().max(50).optional(),
  appVersion: z.string().max(50),
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

export const RevokeDeviceSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type RevokeDeviceInput = z.infer<typeof RevokeDeviceSchema>;

// ─── Clinical tasks ─────────────────────────────────────────────────────────

export const CompleteClinicalTaskSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type CompleteClinicalTaskInput = z.infer<typeof CompleteClinicalTaskSchema>;

export const ListClinicalTasksQuerySchema = z.object({
  status: z.enum(ClinicalTaskStatus).optional(),
  taskType: z.enum(ClinicalTaskType).optional(),
  priority: z.enum(ClinicalTaskPriority).optional(),
  episodeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListClinicalTasksQuery = z.infer<typeof ListClinicalTasksQuerySchema>;
