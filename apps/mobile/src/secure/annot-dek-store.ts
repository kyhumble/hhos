import * as SecureStore from 'expo-secure-store';
import { SecureKeys } from './keys';

/**
 * Per-annotation child DEK in Secure Store (online-only annotation flow).
 * Key: `hhos.annot-dek.{clientAnnotationId}` — base64 32-byte DEK.
 * Never store DEKs in sqlite. Wipe on complete ack, abandon, or error rollback.
 * No annotation_outbox — DEK is ephemeral for the single online upload.
 */

export async function setAnnotDek(
  clientAnnotationId: string,
  dekBase64: string,
): Promise<void> {
  await SecureStore.setItemAsync(
    SecureKeys.annotDek(clientAnnotationId),
    dekBase64,
  );
}

export async function getAnnotDek(
  clientAnnotationId: string,
): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      SecureKeys.annotDek(clientAnnotationId),
    );
  } catch {
    return null;
  }
}

export async function clearAnnotDek(clientAnnotationId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SecureKeys.annotDek(clientAnnotationId));
  } catch {
    // ignore missing keys / store unavailable
  }
}
