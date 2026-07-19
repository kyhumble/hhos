import type { RegisterDeviceInput } from '@hhos/shared';
import { apiRequest } from './client';

export type RegisteredDevice = {
  id: string;
  deviceId: string;
  platform: string;
  model: string | null;
  osVersion: string | null;
  appVersion: string;
  status: 'active' | 'revoked' | string;
  lastSeenAt?: string | null;
  createdAt?: string;
};

/**
 * POST /v1/devices/register — must succeed before photo sync starts.
 */
export async function registerDevice(
  input: RegisterDeviceInput,
): Promise<RegisteredDevice> {
  return apiRequest<RegisteredDevice>('/v1/devices/register', {
    method: 'POST',
    body: input,
  });
}
