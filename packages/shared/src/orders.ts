import { z } from 'zod';
import { OrderDocType, OrderPackageStatus } from './enums';

export const CreateOrderPackageSchema = z.object({
  episodeId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  docType: z.enum(OrderDocType),
  title: z.string().min(1).max(200),
  physicianName: z.string().min(1).max(200),
  physicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  physicianEmail: z.string().email().max(320).optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateOrderPackageInput = z.infer<typeof CreateOrderPackageSchema>;

export const CompleteOrderUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .regex(/^application\/pdf$/i, 'Only application/pdf is allowed for order packages'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  byteSize: z.number().int().positive().max(25_000_000).optional(),
});
export type CompleteOrderUploadInput = z.infer<typeof CompleteOrderUploadSchema>;

export const SendOrderPackageSchema = z.object({
  /** Hours until signature link expires (default 168 = 7 days). */
  expiresInHours: z.number().int().min(1).max(720).default(168),
  noteToPhysician: z.string().max(1000).optional(),
});
export type SendOrderPackageInput = z.infer<typeof SendOrderPackageSchema>;

export const ProviderSignSchema = z.object({
  decision: z.enum(['signed', 'rejected']),
  signerTypedName: z.string().min(1).max(200),
  signerCredentials: z.string().max(100).optional(),
  attestation: z
    .literal(true)
    .describe('Must attest that signer is the named provider or authorized NPP'),
  rejectReason: z.string().max(2000).optional(),
});
export type ProviderSignInput = z.infer<typeof ProviderSignSchema>;

export const RecordExternalSignSchema = z.object({
  method: z.enum(['wet_ink_scan', 'external_attested']),
  signerTypedName: z.string().min(1).max(200),
  signedAt: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
});
export type RecordExternalSignInput = z.infer<typeof RecordExternalSignSchema>;

export const ListOrderPackagesQuerySchema = z.object({
  status: z.enum(OrderPackageStatus).optional(),
  episodeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
