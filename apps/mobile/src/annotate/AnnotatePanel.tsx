/**
 * Online-only annotation tools (child DEK side-cars).
 * Blocked when offline or parent photo is not available.
 * No annotation_outbox — upload is immediate while online.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import {
  listPhotoAnnotations,
  type AnnotationMetadata,
} from '../api/wound-photos';
import {
  ANNOTATE_OFFLINE_MESSAGE,
  ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE,
  probeOnline,
} from './online';
import { uploadVectorAnnotationOnline } from './upload-annotation';
import type { VectorMarker } from './vector-payload';

type Props = {
  woundPhotoId: string;
  /** Parent must be status === 'available'. */
  parentAvailable: boolean;
};

export function AnnotatePanel({ woundPhotoId, parentAvailable }: Props) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [markers, setMarkers] = useState<VectorMarker[]>([]);
  const [box, setBox] = useState({ w: 1, h: 1 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existing, setExisting] = useState<AnnotationMetadata[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const refreshOnline = useCallback(async () => {
    const r = await probeOnline();
    setOnline(r.online);
    return r.online;
  }, []);

  const refreshList = useCallback(async () => {
    if (!parentAvailable) {
      setExisting([]);
      return;
    }
    setLoadingList(true);
    try {
      const isOn = await refreshOnline();
      if (!isOn) {
        setExisting([]);
        return;
      }
      const rows = await listPhotoAnnotations(woundPhotoId);
      setExisting(rows.filter((a) => a.status === 'available'));
    } catch {
      // non-fatal
    } finally {
      setLoadingList(false);
    }
  }, [parentAvailable, woundPhotoId, refreshOnline]);

  useEffect(() => {
    void refreshOnline();
    void refreshList();
  }, [refreshOnline, refreshList]);

  const annotateAllowed = parentAvailable && online === true;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setBox({ w: width, h: height });
  };

  const onTapCanvas = (evt: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    if (!annotateAllowed || uploading) return;
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.min(1, Math.max(0, locationX / box.w));
    const y = Math.min(1, Math.max(0, locationY / box.h));
    setMarkers((prev) => [
      ...prev,
      { x, y, label: String(prev.length + 1) },
    ]);
    setSuccess(null);
    setError(null);
  };

  const onClear = () => {
    setMarkers([]);
    setError(null);
    setSuccess(null);
  };

  const onUpload = async () => {
    setError(null);
    setSuccess(null);

    if (!parentAvailable) {
      setError(ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE);
      return;
    }

    const isOn = await refreshOnline();
    if (!isOn) {
      setError(ANNOTATE_OFFLINE_MESSAGE);
      return;
    }

    if (markers.length === 0) {
      setError('Add at least one marker before uploading.');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadVectorAnnotationOnline({
        woundPhotoId,
        markers,
        strokes: [],
      });
      setMarkers([]);
      setSuccess(
        `Annotation uploaded · ${res.clientAnnotationId.slice(0, 8)}… · ${res.status}`,
      );
      await refreshList();
    } catch (e) {
      if (e instanceof Error && (e as Error & { code?: string }).code === 'ANNOTATE_OFFLINE') {
        setOnline(false);
        setError(ANNOTATE_OFFLINE_MESSAGE);
      } else if (e instanceof ApiError) {
        if (e.code === 'PARENT_NOT_AVAILABLE') {
          setError(ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE);
        } else {
          setError(e.message || e.code);
        }
      } else if (e instanceof Error) {
        setError(e.message === 'ANNOTATION_EMPTY' ? 'Add markers first.' : e.message);
      } else {
        setError('Annotation upload failed.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Annotations (online only)</Text>
      <Text style={styles.hint}>
        Child DEK side-car · no annotation_outbox · parent must be available ·
        parent DEK not required on device.
      </Text>

      {!parentAvailable ? (
        <View style={styles.blockBanner}>
          <Text style={styles.blockTitle}>Annotate disabled</Text>
          <Text style={styles.blockBody}>
            {ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE}
          </Text>
        </View>
      ) : online === false ? (
        <View style={styles.blockBanner}>
          <Text style={styles.blockTitle}>Annotate disabled offline</Text>
          <Text style={styles.blockBody}>{ANNOTATE_OFFLINE_MESSAGE}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refreshOnline()}>
            <Text style={styles.retryText}>Retry connectivity</Text>
          </Pressable>
        </View>
      ) : online === null ? (
        <ActivityIndicator color="#0369a1" />
      ) : (
        <>
          <Text style={styles.sub}>
            Tap canvas to place markers, then upload (encrypt → wrap → PUT →
            complete).
          </Text>
          <Pressable
            style={[styles.canvas, !annotateAllowed && styles.canvasDisabled]}
            onLayout={onLayout}
            onPress={onTapCanvas}
            disabled={!annotateAllowed || uploading}
          >
            {markers.map((m, i) => (
              <View
                key={`${m.label}-${i}`}
                style={[
                  styles.marker,
                  {
                    left: m.x * box.w - 12,
                    top: m.y * box.h - 12,
                  },
                ]}
              >
                <Text style={styles.markerText}>{m.label}</Text>
              </View>
            ))}
            {markers.length === 0 ? (
              <Text style={styles.canvasHint}>Tap to place marker</Text>
            ) : null}
          </Pressable>
          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={onClear}
              disabled={uploading || markers.length === 0}
            >
              <Text style={styles.secondaryText}>Clear</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primary,
                (uploading || markers.length === 0) && styles.primaryDisabled,
              ]}
              onPress={() => void onUpload()}
              disabled={uploading || markers.length === 0}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  Upload annotation ({markers.length})
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.ok}>{success}</Text> : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Server annotations</Text>
        {loadingList ? <ActivityIndicator size="small" color="#0369a1" /> : null}
      </View>
      {existing.length === 0 ? (
        <Text style={styles.meta}>None (or offline / unavailable).</Text>
      ) : (
        existing.map((a) => (
          <Text key={a.id} style={styles.meta}>
            {a.annotationType} · {a.status} · {a.clientAnnotationId.slice(0, 8)}…
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 16 },
  sub: { fontSize: 12, color: '#334155' },
  blockBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  blockTitle: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
  blockBody: { fontSize: 12, color: '#7f1d1d', lineHeight: 17 },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  retryText: { color: '#991b1b', fontWeight: '600', fontSize: 12 },
  canvas: {
    height: 200,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasDisabled: { opacity: 0.5 },
  canvasHint: { color: '#94a3b8', fontSize: 13 },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  secondaryText: { color: '#334155', fontWeight: '600' },
  primary: {
    flex: 2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0369a1',
  },
  primaryDisabled: { backgroundColor: '#94a3b8' },
  primaryText: { color: '#fff', fontWeight: '700' },
  error: { fontSize: 12, color: '#b91c1c' },
  ok: { fontSize: 12, color: '#047857' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  listTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  meta: { fontSize: 11, color: '#64748b', fontFamily: 'Courier' },
});
