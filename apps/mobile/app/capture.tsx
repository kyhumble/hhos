import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { requireWoundPhotoClinical } from '../src/consent/require-wound-photo-clinical';
import type { ConsentGrantCache } from '../src/secure/consent-cache';

/**
 * Clinical capture entry — camera lands in PR 9.
 * Hard-blocks without a WOUND_PHOTO_CLINICAL grant (cached or live).
 * Never offers gallery import.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    patientId?: string;
    episodeId?: string;
  }>();
  const patientId = Array.isArray(params.patientId)
    ? params.patientId[0]
    : params.patientId;
  const episodeId = Array.isArray(params.episodeId)
    ? params.episodeId[0]
    : params.episodeId;

  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [grant, setGrant] = useState<ConsentGrantCache | null>(null);
  const [source, setSource] = useState<'cache' | 'network' | null>(null);

  const evaluate = useCallback(async () => {
    setLoading(true);
    setBlockedMessage(null);
    setGrant(null);
    setSource(null);
    const result = await requireWoundPhotoClinical(patientId, {
      refreshOnline: true,
    });
    if (!result.allowed) {
      setBlockedMessage(result.message);
    } else {
      setGrant(result.grant);
      setSource(result.source);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

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

  return (
    <View style={styles.container}>
      <View style={styles.okCard}>
        <Text style={styles.okTitle}>Consent grant OK</Text>
        <Text style={styles.meta}>
          Purpose: {grant?.purpose}
          {'\n'}
          Source: {source}
          {'\n'}
          Consent record: {grant?.consentRecordId}
          {'\n'}
          Patient: {patientId}
          {episodeId ? `\nEpisode: ${episodeId}` : ''}
        </Text>
        <Text style={styles.note}>
          Camera + encrypt + outbox land in the next mobile PR. This shell only
          gates the route so capture cannot open without a clinical purpose
          grant.
        </Text>
      </View>
      <Pressable style={styles.linkBtn} onPress={() => router.back()}>
        <Text style={styles.linkText}>Back to episodes</Text>
      </Pressable>
    </View>
  );
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
});
