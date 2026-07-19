import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, isTransportFailure } from '../src/api/client';
import {
  fetchWoundPhotoContentBase64,
  getWoundPhoto,
  type WoundPhotoMetadata,
} from '../src/api/wound-photos';
import { AnnotatePanel } from '../src/annotate/AnnotatePanel';
import { MeasurementsForm } from '../src/annotate/MeasurementsForm';
import {
  ANNOTATE_OFFLINE_MESSAGE,
  probeOnline,
} from '../src/annotate/online';
import { LARGE_WOUND_NOTICE } from '../src/annotate/large-wound';

/**
 * Review flow for a server wound photo:
 * - Measurements PATCH when available (online)
 * - Annotation tools (child DEK) online-only; blocked offline / parent not available
 * - Large-wound non-blocking notice
 */
export default function PhotoReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photoId?: string }>();
  const photoId = first(params.photoId);

  const [photo, setPhoto] = useState<WoundPhotoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!photoId) {
      setError('photoId required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const probe = await probeOnline();
      setOnline(probe.online);
      if (!probe.online) {
        setError(ANNOTATE_OFFLINE_MESSAGE);
        setPhoto(null);
        return;
      }
      const meta = await getWoundPhoto(photoId);
      setPhoto(meta);
    } catch (e) {
      setPhoto(null);
      if (isTransportFailure(e)) {
        setOnline(false);
        setError(ANNOTATE_OFFLINE_MESSAGE);
      } else if (e instanceof ApiError) {
        setError(e.message || e.code);
      } else {
        setError('Failed to load photo metadata.');
      }
    } finally {
      setLoading(false);
    }
  }, [photoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!photo || photo.status !== 'available' || online !== true) {
        setPreviewUri(null);
        return;
      }
      setPreviewLoading(true);
      try {
        const { base64, contentType } = await fetchWoundPhotoContentBase64(
          photo.id,
        );
        if (!cancelled) {
          setPreviewUri(`data:${contentType};base64,${base64}`);
        }
      } catch {
        if (!cancelled) setPreviewUri(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [photo, online]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
        <Text style={styles.muted}>Loading photo metadata…</Text>
      </View>
    );
  }

  if (!photoId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Missing photoId.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (error && !photo) {
    return (
      <View style={styles.container}>
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>Cannot open review</Text>
          <Text style={styles.blockBody}>{error}</Text>
        </View>
        <Pressable style={styles.secondary} onPress={() => void load()}>
          <Text style={styles.secondaryText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Photo not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const available = photo.status === 'available';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerCard}>
        <Text style={styles.status}>
          {photo.status}
          {photo.isLargeWound ? ' · large wound' : ''}
        </Text>
        <Text style={styles.meta}>
          photo {photo.id.slice(0, 8)}… · client {photo.clientPhotoId.slice(0, 8)}…
        </Text>
        <Text style={styles.meta}>
          connectivity: {online === null ? '…' : online ? 'online' : 'offline'}
        </Text>
        {photo.isLargeWound ? (
          <View style={styles.largeBanner}>
            <Text style={styles.largeTitle}>Large wound notice</Text>
            <Text style={styles.largeBody}>{LARGE_WOUND_NOTICE}</Text>
          </View>
        ) : null}
      </View>

      {previewLoading ? (
        <ActivityIndicator color="#0369a1" />
      ) : previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={styles.preview}
          resizeMode="contain"
          accessibilityLabel="Wound photo preview"
        />
      ) : (
        <View style={styles.previewPlaceholder}>
          <Text style={styles.muted}>
            {available
              ? 'Preview unavailable (decrypt proxy failed or still loading).'
              : 'Preview after photo is available (online decrypt proxy).'}
          </Text>
        </View>
      )}

      <MeasurementsForm
        photo={photo}
        enabled={available && online === true}
        onSaved={(res) => {
          setPhoto((p) =>
            p
              ? {
                  ...p,
                  lengthCm: res.lengthCm,
                  widthCm: res.widthCm,
                  depthCm: res.depthCm,
                  measurementMethod: res.measurementMethod,
                  isLargeWound: res.isLargeWound,
                }
              : p,
          );
        }}
      />

      <AnnotatePanel
        woundPhotoId={photo.id}
        parentAvailable={available}
      />

      <Pressable style={styles.linkBtn} onPress={() => router.back()}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  muted: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  status: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 11, color: '#64748b', fontFamily: 'Courier' },
  largeBanner: {
    marginTop: 8,
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  largeTitle: { fontSize: 13, fontWeight: '700', color: '#9a3412' },
  largeBody: { fontSize: 12, color: '#9a3412', lineHeight: 17 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  previewPlaceholder: {
    height: 120,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  blockCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  blockTitle: { fontSize: 16, fontWeight: '700', color: '#991b1b' },
  blockBody: { fontSize: 13, color: '#7f1d1d', lineHeight: 18 },
  error: { color: '#b91c1c', fontSize: 14 },
  secondary: {
    backgroundColor: '#0369a1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0369a1', fontWeight: '600', fontSize: 15 },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
});
