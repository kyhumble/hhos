import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ClinicalCamera } from '../src/camera/ClinicalCamera';
import { captureEncryptAndEnqueue } from '../src/camera/capture-and-enqueue';
import { requireWoundPhotoClinical } from '../src/consent/require-wound-photo-clinical';
import type { ConsentGrantCache } from '../src/secure/consent-cache';
import type { CaptureAndEnqueueResult } from '../src/camera/capture-and-enqueue';

/**
 * Clinical capture — consent-gated, app camera only, encrypt + outbox enqueue.
 * Never offers gallery import.
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

  const onCaptured = useCallback(
    async (localUri: string) => {
      if (!patientId || !episodeId || !grant) {
        setCaptureError('Missing patient, episode, or consent grant.');
        return;
      }
      setProcessing(true);
      setCaptureError(null);
      try {
        // Re-check gate at shutter (cached grant may expire; online refresh preferred)
        const gate = await requireWoundPhotoClinical(patientId, {
          refreshOnline: true,
        });
        if (!gate.allowed) {
          setBlockedMessage(gate.message);
          setGrant(null);
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
        setResult(enqueued);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Encrypt / outbox failed';
        // User-facing: no PHI, map known codes
        if (msg === 'GALLERY_IMPORT_FORBIDDEN') {
          setCaptureError(
            'Gallery import is not allowed for clinical wound photos.',
          );
        } else if (msg === 'PHOTO_PLAINTEXT_TOO_LARGE') {
          setCaptureError(
            'Photo too large after normalize (max 12 MB). Move closer and recapture.',
          );
        } else {
          setCaptureError(msg);
        }
      } finally {
        setProcessing(false);
      }
    },
    [patientId, episodeId, grant, woundId, visitId],
  );

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
});
