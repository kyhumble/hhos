import * as SecureStore from 'expo-secure-store';
import { SecureKeys } from './keys';

/**
 * JWT access token in expo-secure-store (`hhos.accessToken`).
 * Never log the token value.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SecureKeys.accessToken);
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SecureKeys.accessToken, token);
}

export async function clearAccessToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SecureKeys.accessToken);
  } catch {
    // ignore missing keys / store unavailable
  }
}
