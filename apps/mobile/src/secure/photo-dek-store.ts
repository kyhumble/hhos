import * as SecureStore from 'expo-secure-store';
import { SecureKeys } from './keys';

/**
 * Per-photo DEK in Secure Store.
 * Key: `hhos.photo-dek.{clientPhotoId}` — base64 32-byte DEK.
 * Never store DEKs in sqlite or under a shared key.
 * Wipe on complete ack, abandon, revoke, or dead-letter purge (PR 10).
 */

export async function setPhotoDek(
  clientPhotoId: string,
  dekBase64: string,
): Promise<void> {
  await SecureStore.setItemAsync(SecureKeys.photoDek(clientPhotoId), dekBase64);
}

export async function getPhotoDek(
  clientPhotoId: string,
): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SecureKeys.photoDek(clientPhotoId));
  } catch {
    return null;
  }
}

export async function clearPhotoDek(clientPhotoId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SecureKeys.photoDek(clientPhotoId));
  } catch {
    // ignore missing keys / store unavailable
  }
}
