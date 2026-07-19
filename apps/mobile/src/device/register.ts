/**
 * Device register bootstrap — required before sync worker uploads.
 */
import { registerDevice } from '../api/devices';
import { ApiError } from '../api/client';
import { getOrCreateDeviceId } from '../secure/device-id';
import { buildRegisterPayload } from './device-info';

export type DeviceRegisterState = {
  deviceId: string;
  registered: boolean;
  status: 'active' | 'revoked' | 'unknown';
  lastErrorCode: string | null;
};

let cached: DeviceRegisterState | null = null;

export function getCachedDeviceRegisterState(): DeviceRegisterState | null {
  return cached;
}

export function clearDeviceRegisterCache(): void {
  cached = null;
}

/**
 * Ensure device is registered with the API (200).
 * On DEVICE_REVOKED throws ApiError — caller must wipe local PHI.
 * Does not start the sync worker; caller gates on success.
 */
export async function ensureDeviceRegistered(): Promise<DeviceRegisterState> {
  if (cached?.registered && cached.status === 'active') {
    return cached;
  }

  const deviceId = await getOrCreateDeviceId();
  const payload = buildRegisterPayload(deviceId);

  try {
    const row = await registerDevice(payload);
    if (row.status === 'revoked') {
      const err = new ApiError(
        403,
        'DEVICE_REVOKED',
        'Device has been revoked',
      );
      cached = {
        deviceId,
        registered: false,
        status: 'revoked',
        lastErrorCode: 'DEVICE_REVOKED',
      };
      throw err;
    }

    cached = {
      deviceId,
      registered: true,
      status: 'active',
      lastErrorCode: null,
    };
    return cached;
  } catch (err) {
    if (err instanceof ApiError) {
      cached = {
        deviceId,
        registered: false,
        status: err.code === 'DEVICE_REVOKED' ? 'revoked' : 'unknown',
        lastErrorCode: err.code,
      };
    }
    throw err;
  }
}
