/**
 * Photo outbox sync worker.
 *
 * Gate: device register 200 before any initiate.
 * State machine: initiate → wrap-dek → PUT presigned (URL as returned) → complete → wipe DEK + cipher.
 * Recovery: kill mid-sync resumes via idempotent initiate + status-driven steps.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { ApiError, isTransportFailure } from '../api/client';
import {
  completeWoundPhotoUpload,
  initiateWoundPhotoUpload,
  putPresignedCipher,
  wrapWoundPhotoDek,
} from '../api/wound-photos';
import { base64ToBuffer } from '../crypto/aes-gcm';
import { buildDeviceInfo } from '../device/device-info';
import {
  clearDeviceRegisterCache,
  ensureDeviceRegistered,
} from '../device/register';
import { getPhotoDek } from '../secure/photo-dek-store';
import { getAccessToken } from '../secure/token-store';
import { patchSyncProgress } from '../sync/sync-state';
import {
  computeNextAttemptAt,
  isConsentFreezeCode,
  isDeadLetter,
  isRetryableSyncError,
} from './backoff';
import { readCipherFileBase64 } from './cipher-fs';
import {
  abandonLocalPhoto,
  purgeSecretsForDead,
  wipeAfterSynced,
  wipeLocalOnDeviceRevoke,
} from './local-wipe';
import {
  countPendingOutbox,
  listDueOutbox,
  OutboxStatus,
  updateOutboxRow,
} from './repository';
import type { OutboxMetaJson, PhotoOutboxRow } from './types';

const PERIODIC_MS = 30_000;

let running = false;
let cyclePromise: Promise<void> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let stopped = true;

function parseMeta(metaJson: string): OutboxMetaJson {
  return JSON.parse(metaJson) as OutboxMetaJson;
}

function errorFields(err: unknown): {
  status?: number;
  code: string;
  message: string;
} {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  if (err && typeof err === 'object') {
    const e = err as { status?: number; code?: string; message?: string };
    if (typeof e.code === 'string' || typeof e.status === 'number') {
      return {
        status: e.status,
        code: e.code ?? 'UNKNOWN',
        message: e.message ?? 'error',
      };
    }
  }
  if (isTransportFailure(err)) {
    return { status: 0, code: 'NETWORK_ERROR', message: 'network' };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: 'unknown' };
}

async function refreshPendingCount(): Promise<number> {
  try {
    const n = await countPendingOutbox();
    patchSyncProgress({ pendingCount: n });
    return n;
  } catch {
    return 0;
  }
}

async function handleItemFailure(
  row: PhotoOutboxRow,
  err: unknown,
): Promise<'continue' | 'stop_cycle'> {
  const { status, code } = errorFields(err);

  if (code === 'DEVICE_REVOKED') {
    clearDeviceRegisterCache();
    await wipeLocalOnDeviceRevoke();
    patchSyncProgress({
      status: 'device_revoked',
      deviceRegistered: false,
      lastErrorCode: 'DEVICE_REVOKED',
      lastMessage: 'Device revoked — local queue wiped',
      inFlightClientPhotoId: null,
    });
    return 'stop_cycle';
  }

  if (code === 'DEVICE_NOT_REGISTERED') {
    clearDeviceRegisterCache();
    const attemptCount = row.attemptCount + 1;
    if (isDeadLetter(attemptCount, row.createdAt)) {
      await updateOutboxRow(row.clientPhotoId, {
        status: OutboxStatus.dead,
        attemptCount,
        lastErrorCode: code,
        nextAttemptAt: null,
      });
      await purgeSecretsForDead(row.clientPhotoId);
    } else {
      await updateOutboxRow(row.clientPhotoId, {
        status: OutboxStatus.failed,
        attemptCount,
        lastErrorCode: code,
        nextAttemptAt: computeNextAttemptAt(attemptCount),
      });
    }
    patchSyncProgress({
      status: 'error',
      deviceRegistered: false,
      lastErrorCode: code,
      lastMessage: 'Device not registered — will re-register',
      inFlightClientPhotoId: null,
    });
    return 'stop_cycle';
  }

  if (status === 410 || code === 'GONE' || code === 'PHOTO_GONE') {
    await abandonLocalPhoto(row.clientPhotoId);
    return 'continue';
  }

  if (isConsentFreezeCode(code)) {
    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.failed,
      lastErrorCode: code,
      nextAttemptAt: Date.now() + 60 * 60 * 1000,
      attemptCount: row.attemptCount + 1,
    });
    patchSyncProgress({
      lastErrorCode: code,
      lastMessage: 'Consent or caseload blocked this photo',
    });
    return 'continue';
  }

  const attemptCount = row.attemptCount + 1;
  if (isDeadLetter(attemptCount, row.createdAt)) {
    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.dead,
      attemptCount,
      lastErrorCode: code,
      nextAttemptAt: null,
    });
    await purgeSecretsForDead(row.clientPhotoId);
    return 'continue';
  }

  const retryable =
    isRetryableSyncError({ status, code }) || isTransportFailure(err);

  let resumeStatus = row.status;
  if (row.status === OutboxStatus.uploading) {
    resumeStatus = OutboxStatus.pending_upload;
  } else if (row.status === OutboxStatus.failed) {
    resumeStatus = row.serverPhotoId
      ? OutboxStatus.pending_upload
      : OutboxStatus.pending_wrap;
  }

  await updateOutboxRow(row.clientPhotoId, {
    status: retryable || !status ? resumeStatus : OutboxStatus.failed,
    attemptCount,
    lastErrorCode: code,
    nextAttemptAt: computeNextAttemptAt(attemptCount),
  });
  return 'continue';
}

type InitiateResult = {
  serverPhotoId: string;
  serverStatus: string;
  presignedPutUrl?: string;
};

async function callInitiate(
  row: PhotoOutboxRow,
  deviceId: string,
): Promise<InitiateResult> {
  if (!row.woundId) {
    throw new ApiError(400, 'MISSING_WOUND_ID', 'woundId required for upload');
  }
  const meta = parseMeta(row.metaJson);
  const device = buildDeviceInfo(deviceId);
  const initiated = await initiateWoundPhotoUpload({
    clientPhotoId: row.clientPhotoId,
    patientId: row.patientId,
    episodeId: row.episodeId,
    woundId: row.woundId,
    visitId: row.visitId,
    consentRecordId: row.consentRecordId,
    capturedAt: meta.capturedAt,
    byteSize: row.byteSize,
    plaintextSha256: row.plaintextSha256,
    widthPx: meta.widthPx,
    heightPx: meta.heightPx,
    device,
  });
  return {
    serverPhotoId: initiated.id,
    serverStatus: initiated.status,
    presignedPutUrl: initiated.presignedPutUrl,
  };
}

async function stepWrap(
  serverPhotoId: string,
  clientPhotoId: string,
): Promise<void> {
  const dekBase64 = await getPhotoDek(clientPhotoId);
  if (!dekBase64) {
    throw new ApiError(
      409,
      'DEK_MISSING',
      'Photo DEK missing from Secure Store',
    );
  }
  try {
    await wrapWoundPhotoDek(serverPhotoId, { dekBase64 });
  } catch (err) {
    const { code } = errorFields(err);
    // Kill mid-sync recovery: second wrap is expected if wrap already committed
    if (code !== 'DEK_ALREADY_WRAPPED') throw err;
  }
}

async function stepPut(
  presignedPutUrl: string,
  clientPhotoId: string,
  byteSize: number,
): Promise<void> {
  const cipherB64 = await readCipherFileBase64(clientPhotoId);
  const cipherBuf = base64ToBuffer(cipherB64);
  // Use URL as returned — do not rewrite host (K25)
  await putPresignedCipher(presignedPutUrl, cipherBuf, byteSize);
}

/**
 * Process one outbox row through as many steps as possible this cycle.
 *
 * Local status mapping:
 * - pending_wrap / failed(no server id): initiate → wrap → pending_upload → PUT
 * - pending_upload / uploading: initiate (fresh presign) → PUT → pending_complete
 * - pending_complete: complete → wipe
 */
async function processRow(
  row: PhotoOutboxRow,
  deviceId: string,
): Promise<void> {
  patchSyncProgress({
    inFlightClientPhotoId: row.clientPhotoId,
    status: 'syncing',
  });

  if (!row.woundId) {
    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.failed,
      lastErrorCode: 'MISSING_WOUND_ID',
      nextAttemptAt: Date.now() + 60 * 60 * 1000,
    });
    return;
  }

  let status = row.status;
  let serverPhotoId = row.serverPhotoId;

  if (status === OutboxStatus.failed) {
    status = serverPhotoId
      ? OutboxStatus.pending_upload
      : OutboxStatus.pending_wrap;
  }

  // ── Stage A: initiate + wrap (pending_wrap) ──────────────────────────────
  if (status === OutboxStatus.pending_wrap) {
    const initiated = await callInitiate(row, deviceId);
    serverPhotoId = initiated.serverPhotoId;
    await updateOutboxRow(row.clientPhotoId, {
      serverPhotoId,
      lastErrorCode: null,
    });

    if (initiated.serverStatus === 'available') {
      await wipeAfterSynced(row.clientPhotoId);
      patchSyncProgress({ lastSyncedAt: Date.now() });
      return;
    }

    if (initiated.serverStatus === 'pending_upload') {
      await stepWrap(serverPhotoId, row.clientPhotoId);
    }

    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.pending_upload,
      serverPhotoId,
    });
    status = OutboxStatus.pending_upload;

    if (initiated.presignedPutUrl) {
      await updateOutboxRow(row.clientPhotoId, {
        status: OutboxStatus.uploading,
      });
      await stepPut(
        initiated.presignedPutUrl,
        row.clientPhotoId,
        row.byteSize,
      );
      await updateOutboxRow(row.clientPhotoId, {
        status: OutboxStatus.pending_complete,
      });
      status = OutboxStatus.pending_complete;
    }
  }

  // ── Stage B: PUT (pending_upload / uploading) ────────────────────────────
  if (
    status === OutboxStatus.pending_upload ||
    status === OutboxStatus.uploading
  ) {
    const initiated = await callInitiate(row, deviceId);
    serverPhotoId = initiated.serverPhotoId;
    await updateOutboxRow(row.clientPhotoId, { serverPhotoId });

    if (initiated.serverStatus === 'available') {
      await wipeAfterSynced(row.clientPhotoId);
      patchSyncProgress({ lastSyncedAt: Date.now() });
      return;
    }

    if (initiated.serverStatus === 'pending_upload') {
      await stepWrap(serverPhotoId, row.clientPhotoId);
    }

    if (!initiated.presignedPutUrl) {
      throw new ApiError(
        500,
        'PRESIGN_MISSING',
        'Initiate did not return presignedPutUrl',
      );
    }

    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.uploading,
    });
    await stepPut(initiated.presignedPutUrl, row.clientPhotoId, row.byteSize);
    await updateOutboxRow(row.clientPhotoId, {
      status: OutboxStatus.pending_complete,
    });
    status = OutboxStatus.pending_complete;
  }

  // ── Stage C: complete + wipe ─────────────────────────────────────────────
  if (status === OutboxStatus.pending_complete) {
    if (!serverPhotoId) {
      const initiated = await callInitiate(row, deviceId);
      serverPhotoId = initiated.serverPhotoId;
      await updateOutboxRow(row.clientPhotoId, { serverPhotoId });
      if (initiated.serverStatus === 'available') {
        await wipeAfterSynced(row.clientPhotoId);
        patchSyncProgress({ lastSyncedAt: Date.now() });
        return;
      }
    }

    await completeWoundPhotoUpload(serverPhotoId, {
      clientPhotoId: row.clientPhotoId,
      cipherSha256: row.cipherSha256,
      byteSize: row.byteSize,
    });
    await wipeAfterSynced(row.clientPhotoId);
    patchSyncProgress({ lastSyncedAt: Date.now() });
  }
}

/**
 * One foreground sync cycle: register (required) then drain due outbox rows.
 * No initiate until register returns 200.
 */
export async function runSyncCycle(): Promise<void> {
  if (cyclePromise) return cyclePromise;

  cyclePromise = (async () => {
    const token = await getAccessToken();
    if (!token) {
      patchSyncProgress({
        status: 'idle',
        lastMessage: 'Not signed in',
        deviceRegistered: false,
      });
      await refreshPendingCount();
      return;
    }

    patchSyncProgress({
      status: 'registering',
      cycleStartedAt: Date.now(),
      lastMessage: 'Registering device…',
    });

    let deviceId: string;
    try {
      const reg = await ensureDeviceRegistered();
      deviceId = reg.deviceId;
      patchSyncProgress({
        deviceRegistered: true,
        lastErrorCode: null,
        lastMessage: null,
      });
    } catch (err) {
      const { code } = errorFields(err);
      if (code === 'DEVICE_REVOKED') {
        await wipeLocalOnDeviceRevoke();
        patchSyncProgress({
          status: 'device_revoked',
          deviceRegistered: false,
          lastErrorCode: 'DEVICE_REVOKED',
          lastMessage: 'Device revoked — local queue wiped',
        });
        await refreshPendingCount();
        return;
      }
      patchSyncProgress({
        status: 'error',
        deviceRegistered: false,
        lastErrorCode: code,
        lastMessage: 'Device registration required before sync',
      });
      await refreshPendingCount();
      return;
    }

    // Register succeeded — only now process outbox
    const due = await listDueOutbox();
    await refreshPendingCount();

    if (due.length === 0) {
      patchSyncProgress({
        status: 'idle',
        inFlightClientPhotoId: null,
        lastMessage: null,
      });
      return;
    }

    patchSyncProgress({ status: 'syncing' });

    for (const row of due) {
      if (stopped) break;
      try {
        await processRow(row, deviceId);
      } catch (err) {
        const action = await handleItemFailure(row, err);
        if (action === 'stop_cycle') break;
      }
    }

    await refreshPendingCount();
    const pending = await countPendingOutbox();
    patchSyncProgress({
      status: pending > 0 ? 'paused' : 'idle',
      inFlightClientPhotoId: null,
      pendingCount: pending,
    });
  })().finally(() => {
    cyclePromise = null;
  });

  return cyclePromise;
}

/** Kick a cycle if not already running (safe to call often). */
export function requestSync(reason = 'manual'): void {
  if (stopped) return;
  void runSyncCycle().catch(() => {
    void reason;
  });
}

/**
 * Start background triggers: AppState active + ~30s periodic while active.
 * Call once from root layout when app mounts.
 */
export function startSyncWorker(): void {
  if (running) {
    requestSync('already-running');
    return;
  }
  running = true;
  stopped = false;

  const onAppState = (next: AppStateStatus) => {
    if (next === 'active') {
      requestSync('foreground');
    }
  };

  appStateSub = AppState.addEventListener('change', onAppState);

  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    if (AppState.currentState === 'active') {
      requestSync('periodic');
    }
  }, PERIODIC_MS);

  requestSync('start');
}

export function stopSyncWorker(): void {
  stopped = true;
  running = false;
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

/** Test helper */
export function __resetSyncWorkerForTests(): void {
  stopSyncWorker();
  cyclePromise = null;
  clearDeviceRegisterCache();
}
