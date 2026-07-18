/**
 * Ciphertext files on app sandbox FS (expo-file-system).
 * Never put ciphertext in AsyncStorage; never put DEKs on FS.
 */
import * as FileSystem from 'expo-file-system';

const CIPHER_DIR = 'photo-cipher';

function requireDocDir(): string {
  const root = FileSystem.documentDirectory;
  if (!root) {
    throw new Error('FILE_SYSTEM_UNAVAILABLE');
  }
  return root;
}

export function cipherFileUri(clientPhotoId: string): string {
  return `${requireDocDir()}${CIPHER_DIR}/${clientPhotoId}.bin`;
}

async function ensureCipherDir(): Promise<string> {
  const dir = `${requireDocDir()}${CIPHER_DIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/** Write framed ciphertext as base64 file contents. */
export async function writeCipherFile(
  clientPhotoId: string,
  framedBase64: string,
): Promise<string> {
  await ensureCipherDir();
  const uri = cipherFileUri(clientPhotoId);
  await FileSystem.writeAsStringAsync(uri, framedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export async function readCipherFileBase64(
  clientPhotoId: string,
): Promise<string> {
  const uri = cipherFileUri(clientPhotoId);
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function deleteCipherFile(clientPhotoId: string): Promise<void> {
  const uri = cipherFileUri(clientPhotoId);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // ignore missing
  }
}
