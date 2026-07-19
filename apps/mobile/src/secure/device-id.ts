import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { SecureKeys } from './keys';

/**
 * App-generated install UUID in Secure Store (`hhos.deviceId`).
 * Never regenerate on normal launch — only factory reset / local wipe.
 */

export async function getDeviceId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SecureKeys.deviceId);
  } catch {
    return null;
  }
}

/**
 * Return existing deviceId or create and persist a new UUID.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getDeviceId();
  if (existing && existing.length >= 8) {
    return existing;
  }
  const id = ExpoCrypto.randomUUID();
  await SecureStore.setItemAsync(SecureKeys.deviceId, id);
  return id;
}
