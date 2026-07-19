/**
 * Device metadata for register + initiate bodies.
 * Field name `os` matches shared DeviceInfoSchema / RegisterDeviceSchema.
 */
import { Platform } from 'react-native';
import type { DeviceInfo, DevicePlatform } from '@hhos/shared';

/** Keep in sync with app.json expo.version */
export const APP_VERSION = '0.1.0';

export function getDevicePlatform(): DevicePlatform {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/**
 * Best-effort model / OS strings — never PHI.
 * Secure Store deviceId is separate (passed by caller).
 */
export function buildDeviceInfo(deviceId: string): DeviceInfo {
  const platform = getDevicePlatform();
  const version = Platform.Version;
  const os =
    platform === 'ios'
      ? `iOS ${String(version)}`
      : `Android ${String(version)}`;

  const constants = Platform.constants as
    | { Model?: string; model?: string; Brand?: string }
    | undefined;
  const model =
    constants?.Model ??
    constants?.model ??
    constants?.Brand ??
    (platform === 'ios' ? 'iPhone' : 'Android');

  return {
    deviceId,
    model: String(model).slice(0, 100) || 'unknown',
    os: os.slice(0, 50) || platform,
    appVersion: APP_VERSION,
  };
}

export function buildRegisterPayload(deviceId: string) {
  const info = buildDeviceInfo(deviceId);
  return {
    deviceId: info.deviceId,
    platform: getDevicePlatform(),
    model: info.model,
    os: info.os,
    appVersion: info.appVersion,
  };
}
