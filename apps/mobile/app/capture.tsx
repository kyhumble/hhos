import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ClinicalCamera } from '../src/camera/ClinicalCamera';
import {
  captureEncryptAndEnqueue,
  cleanupPlaintextUri,
  type CaptureAndEnqueueResult,
} from '../src/camera/capture-and-enqueue';
import { requireWoundPhotoClinical } from '../src/consent/require-wound-photo-clinical';
import { requestSync } from '../src/outbox/syncWorker';
import type { ConsentGrantCache } from '../src/secure/consent-cache';

/**
 * Clinical capture — consent-gated, app camera only, encrypt + outbox enqueue.
 * Flow: shutter → review (keep/retake) → encrypt. Never offers gallery import.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    patientId?: string;
    episodeId?: string;
    woundId?: string;
    visitId?: string;
  }>();
  const patientId = first(params.patientId);
  const episodeId = first(params.episodeId);
  const woundId = first(params.woundId);
  const visitId = first(params.visitId);

  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [grant, setGrant] = useState<ConsentGrantCache | null>(null);
  const [source, setSource] = useState<'cache' | 'network' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CaptureAndEnqueueResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  /** Pending review URI after shutter, before encrypt (retake/keep). */
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    setLoading(true);
    setBlockedMessage(null);
    setGrant(null);
    setSource(null);
    const gate = await requireWoundPhotoClinical(patientId, {
      refreshOnline: true,
    });
    if (!gate.allowed) {
      setBlockedMessage(gate.message);
    } else {
      setGrant(gate.grant);
      setSource(gate.source);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  const discardPending = useCallback(async () => {
    const uri = pendingUri;
    setPendingUri(null);
    await cleanupPlaintextUri(uri);
  }, [pendingUri]);

  const onCaptured = useCallback((localUri: string) => {
    setCaptureError(null);
    setPendingUri(localUri);
  }, []);

  const onRetake = useCallback(() => {
    void discardPending();
  }, [discardPending]);

  const onKeep = useCallback(async () => {
    if (!patientId || !episodeId || !grant || !pendingUri) {
      setCaptureError('Missing patient, episode, consent grant, or photo.');
      await cleanupPlaintextUri(pendingUri);
      setPendingUri(null);
      return;
    }

    setProcessing(true);
    setCaptureError(null);
    const localUri = pendingUri;

    try {
      // Re-check gate at keep (cached grant may expire; online refresh preferred)
      const gate = await requireWoundPhotoClinical(patientId, {
        refreshOnline: true,
      });
      if (!gate.allowed) {
        setBlockedMessage(gate.message);
        setGrant(null);
        await cleanupPlaintextUri(localUri);
        setPendingUri(null);
        return;
      }

      const enqueued = await captureEncryptAndEnqueue({
        cameraImageUri: localUri,
        patientId,
        episodeId,
        consentRecordId: gate.grant.consentRecordId,
        woundId: woundId ?? null,
        visitId: visitId ?? null,
      });
      setPendingUri(null);
      setResult(enqueued);
      // Kick sync worker (register gate inside worker; no initiate until register 200)
      requestSync('after-enqueue');
    } catch (e) {
      const code = e instanceof Error ? e.message : 'ENCRYPT_OUTBOX_FAILED';
      setCaptureError(mapCaptureError(code));
      // captureEncryptAndEnqueue cleans temps in finally; still scrub pending
      await cleanupPlaintextUri(localUri);
      setPendingUri(null);
    } finally {
      setProcessing(false);
    }
  }, [patientId, episodeId, grant, pendingUri, woundId, visitId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
        <Text style={styles.muted}>Checking clinical photo consent…</Text>
      </View>
    );
  }

  if (blockedMessage) {
    return (
      <View style={styles.container}>
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>Capture blocked</Text>
          <Text style={styles.blockBody}>{blockedMessage}</Text>
          <Text style={styles.policy}>
            Policy: clinical wound photos require purpose WOUND_PHOTO_CLINICAL.
            Offline capture is only allowed with a cached grant (≤ 7 days).
            Gallery import is never a clinical path.
          </Text>
        </View>
        <Pressable style={styles.secondary} onPress={() => void evaluate()}>
          <Text style={styles.secondaryText}>Retry / refresh purposes</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (result) {
    return (
      <View style={styles.container}>
        <View style={styles.okCard}>
          <Text style={styles.okTitle}>Saved offline · pending sync</Text>
          <Text style={styles.meta}>
            clientPhotoId: {result.clientPhotoId}
            {'\n'}
            status: {result.outbox.status}
            {'\n'}
            cipher bytes: {result.byteSize}
            {'\n'}
            cipherSha256: {result.cipherSha256.slice(0, 16)}…
            {'\n'}
            size: {result.widthPx}×{result.heightPx}
          </Text>
          <Text style={styles.note}>
            Image encrypted on-device (AES-256-GCM). DEK is in Secure Store under
            hhos.photo-dek.{'{clientPhotoId}'}; ciphertext is on device FS.
            Sync worker uploads in a later PR.
          </Text>
        </View>
        <Pressable
          style={styles.secondary}
          onPress={() => {
            setResult(null);
            setCaptureError(null);
          }}
        >
          <Text style={styles.secondaryText}>Capture another</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Back to episodes</Text>
        </Pressable>
      </View>
    );
  }

  if (!episodeId) {
    return (
      <View style={styles.container}>
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>Episode required</Text>
          <Text style={styles.blockBody}>
            Open capture from an episode so the photo can be linked correctly.
          </Text>
        </View>
        <Pressable style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Review step: keep / retake before encrypt
  if (pendingUri && !processing) {
    return (
      <View style={styles.cameraRoot}>
        <View style={styles.grantBar}>
          <Text style={styles.grantBarText}>Review capture · keep or retake</Text>
        </View>
        <Image source={{ uri: pendingUri }} style={styles.preview} resizeMode="contain" />
        {captureError ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorBarText}>{captureError}</Text>
          </View>
        ) : null}
        <View style={styles.reviewActions}>
          <Pressable style={styles.retakeBtn} onPress={onRetake}>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.keepBtn} onPress={() => void onKeep()}>
            <Text style={styles.keepText}>Keep & encrypt</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <View style={styles.grantBar}>
        <Text style={styles.grantBarText}>
          Consent OK · {source} · {grant?.consentRecordId.slice(0, 8)}…
        </Text>
      </View>
      {processing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0369a1" />
          <Text style={styles.muted}>Encrypting and saving to outbox…</Text>
        </View>
      ) : (
        <ClinicalCamera
          onCaptured={onCaptured}
          onCancel={() => router.back()}
          disabled={processing}
        />
      )}
      {captureError ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorBarText}>{captureError}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Map internal codes to user-safe copy (no raw native/URI strings). */
function mapCaptureError(code: string): string {
  switch (code) {
    case 'GALLERY_IMPORT_FORBIDDEN':
      return 'Gallery import is not allowed for clinical wound photos.';
    case 'PHOTO_PLAINTEXT_TOO_LARGE':
      return 'Photo too large after normalize (max 12 MB). Move closer and recapture.';
    case 'CAMERA_URI_REQUIRED':
    case 'CAMERA_NOT_READY':
    case 'CAPTURE_EMPTY':
      return 'Camera capture failed. Please try again.';
    case 'JPEG_NORMALIZE_NO_BASE64':
    case 'IMAGE_SIZE_FAILED':
      return 'Could not process the photo. Please retake.';
    case 'OUTBOX_META_UNEXPECTED_KEY':
    case 'OUTBOX_META_INVALID_CONTENT_TYPE':
    case 'OUTBOX_META_INVALID_CAPTURE_SOURCE':
    case 'OUTBOX_META_INVALID_PURPOSE':
      return 'Could not save photo metadata. Please retake.';
    case 'FILE_SYSTEM_UNAVAILABLE':
      return 'Device storage unavailable. Please try again.';
    default:
      return 'Encrypt / outbox failed. Please retake the photo.';
  }
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
    padding: 24,
  },
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc', gap: 12 },
  cameraRoot: { flex: 1, backgroundColor: '#0f172a' },
  grantBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#064e3b',
  },
  grantBarText: { color: '#a7f3d0', fontSize: 12 },
  muted: { color: '#64748b', fontSize: 14 },
  blockCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  blockTitle: { fontSize: 18, fontWeight: '700', color: '#991b1b' },
  blockBody: { fontSize: 14, color: '#7f1d1d', lineHeight: 20 },
  policy: {
    marginTop: 4,
    fontSize: 12,
    color: '#9f1239',
    lineHeight: 17,
  },
  okCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  okTitle: { fontSize: 18, fontWeight: '700', color: '#065f46' },
  meta: {
    fontSize: 12,
    color: '#047857',
    fontFamily: 'Courier',
    lineHeight: 18,
  },
  note: { fontSize: 13, color: '#064e3b', lineHeight: 18 },
  secondary: {
    backgroundColor: '#0369a1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#fff', fontWeight: '600' },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: '#0369a1', fontWeight: '600', fontSize: 15 },
  errorBar: {
    padding: 12,
    backgroundColor: '#7f1d1d',
  },
  errorBarText: { color: '#fecaca', fontSize: 13, textAlign: 'center' },
  preview: { flex: 1, width: '100%', backgroundColor: '#000' },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  retakeBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  retakeText: { color: '#e2e8f0', fontWeight: '700', fontSize: 16 },
  keepBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#0369a1',
  },
  keepText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
