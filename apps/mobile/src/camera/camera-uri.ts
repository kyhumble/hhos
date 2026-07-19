/**
 * Strict allowlist for clinical capture image URIs.
 *
 * Only app-sandbox file:// paths (cache or document directory) are accepted.
 * All gallery / media-provider / remote schemes are rejected — fail closed.
 *
 * @see docs/architecture/phase-2-secure-wound-photos.md (app-camera only)
 */
import * as FileSystem from 'expo-file-system';

/** Error code when URI is not an app-camera sandbox path. */
export const GALLERY_IMPORT_FORBIDDEN = 'GALLERY_IMPORT_FORBIDDEN';

/**
 * Pure allowlist check (inject sandbox roots for unit tests).
 * Accepts only file:// or absolute paths under one of the sandbox roots.
 */
export function isAllowedCameraCaptureUri(
  uri: string,
  sandboxRoots: readonly string[],
): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;

  // Reject path traversal
  if (trimmed.includes('..')) return false;

  // Scheme must be file or bare absolute path (no scheme)
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (scheme !== 'file') return false;
  } else if (!trimmed.startsWith('/')) {
    return false;
  }

  // Hard-reject known gallery / remote forms even if scheme parsing missed them
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('content://') ||
    lower.startsWith('ph://') ||
    lower.startsWith('assets-library://') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:')
  ) {
    return false;
  }

  const roots = sandboxRoots.map(normalizeUri).filter((r) => r.length > 0);
  if (roots.length === 0) {
    // Fail closed when sandbox roots are unavailable
    return false;
  }

  const candidates = expandUriForms(trimmed);
  for (const root of roots) {
    const rootForms = expandUriForms(root);
    for (const r of rootForms) {
      if (!r) continue;
      for (const c of candidates) {
        if (c.startsWith(r)) return true;
      }
    }
  }
  return false;
}

/** Runtime sandbox roots: cache + document (where expo-camera / manipulator write). */
export function getAppSandboxRoots(): string[] {
  const roots: string[] = [];
  if (FileSystem.cacheDirectory) roots.push(FileSystem.cacheDirectory);
  if (FileSystem.documentDirectory) roots.push(FileSystem.documentDirectory);
  return roots;
}

/**
 * Assert URI is an app-camera capture path under the app sandbox.
 * Throws GALLERY_IMPORT_FORBIDDEN otherwise.
 */
export function assertCameraCaptureUri(uri: string): void {
  if (!isAllowedCameraCaptureUri(uri, getAppSandboxRoots())) {
    throw new Error(GALLERY_IMPORT_FORBIDDEN);
  }
}

/** Best-effort delete of a local plaintext image URI (camera / manipulator temps). */
export async function cleanupPlaintextUri(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    if (!uri.startsWith('file://') && !uri.startsWith('/')) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // non-fatal — never block capture flow on cleanup
  }
}

function normalizeUri(s: string): string {
  return s.trim();
}

/** Expand file:// vs absolute path forms for prefix comparison. */
export function expandUriForms(s: string): string[] {
  const out = new Set<string>();
  out.add(s);
  try {
    out.add(decodeURIComponent(s));
  } catch {
    // ignore malformed encoding
  }

  if (s.startsWith('file://')) {
    const without = s.slice('file://'.length);
    out.add(without);
    try {
      out.add(decodeURIComponent(without));
    } catch {
      // ignore
    }
  } else if (s.startsWith('/')) {
    out.add(`file://${s}`);
    out.add(`file://${s}`); // duplicate ok via Set
  }

  return [...out];
}
