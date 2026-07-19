/**
 * Normalize clinical capture to JPEG before encrypt.
 * Cap: max edge 2048px, quality ~0.8, plaintext ≤ 12 MB (architecture K / PR 9).
 */
import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export const PHOTO_MAX_EDGE_PX = 2048;
export const PHOTO_JPEG_QUALITY = 0.8;
/** Max plaintext bytes after normalize (org default photoMaxBytes). */
export const PHOTO_MAX_PLAINTEXT_BYTES = 12_000_000;

export type NormalizedJpeg = {
  uri: string;
  width: number;
  height: number;
  /** Decoded JPEG byte length */
  byteSize: number;
  /** JPEG as base64 (no data-URI prefix) */
  base64: string;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) =>
        reject(
          err instanceof Error
            ? err
            : new Error('IMAGE_SIZE_FAILED'),
        ),
    );
  });
}

function base64ByteLength(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Resize (max edge 2048) + re-encode JPEG quality 0.8.
 * Throws PHOTO_PLAINTEXT_TOO_LARGE if still over 12 MB.
 */
export async function normalizeJpeg(sourceUri: string): Promise<NormalizedJpeg> {
  const { width: origW, height: origH } = await getImageSize(sourceUri);
  const actions: ImageManipulator.Action[] = [];
  const maxEdge = Math.max(origW, origH);
  if (maxEdge > PHOTO_MAX_EDGE_PX) {
    if (origW >= origH) {
      actions.push({ resize: { width: PHOTO_MAX_EDGE_PX } });
    } else {
      actions.push({ resize: { height: PHOTO_MAX_EDGE_PX } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress: PHOTO_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('JPEG_NORMALIZE_NO_BASE64');
  }

  let byteSize = base64ByteLength(result.base64);
  // Prefer FS size when available (more accurate than base64 length estimate)
  try {
    const info = await FileSystem.getInfoAsync(result.uri, { size: true });
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      byteSize = info.size;
    }
  } catch {
    // keep base64-derived size
  }

  if (byteSize > PHOTO_MAX_PLAINTEXT_BYTES) {
    throw new Error('PHOTO_PLAINTEXT_TOO_LARGE');
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    byteSize,
    base64: result.base64,
  };
}
