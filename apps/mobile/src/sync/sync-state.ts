/**
 * In-memory sync progress for badge / home UI.
 * No PHI — counts and error codes only.
 */

export type SyncUiStatus =
  | 'idle'
  | 'registering'
  | 'syncing'
  | 'paused'
  | 'error'
  | 'device_revoked';

export type SyncProgress = {
  status: SyncUiStatus;
  pendingCount: number;
  inFlightClientPhotoId: string | null;
  deviceRegistered: boolean;
  lastErrorCode: string | null;
  lastMessage: string | null;
  lastSyncedAt: number | null;
  cycleStartedAt: number | null;
};

const INITIAL: SyncProgress = {
  status: 'idle',
  pendingCount: 0,
  inFlightClientPhotoId: null,
  deviceRegistered: false,
  lastErrorCode: null,
  lastMessage: null,
  lastSyncedAt: null,
  cycleStartedAt: null,
};

let state: SyncProgress = { ...INITIAL };
const listeners = new Set<(p: SyncProgress) => void>();

export function getSyncProgress(): SyncProgress {
  return state;
}

export function subscribeSyncProgress(
  listener: (p: SyncProgress) => void,
): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function patchSyncProgress(patch: Partial<SyncProgress>): void {
  state = { ...state, ...patch };
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      // never break worker for UI listeners
    }
  }
}

export function resetSyncProgress(): void {
  state = { ...INITIAL };
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      // ignore
    }
  }
}
