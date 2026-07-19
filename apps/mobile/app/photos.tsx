import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, isTransportFailure } from '../src/api/client';
import {
  listEpisodeWoundPhotos,
  type WoundPhotoMetadata,
} from '../src/api/wound-photos';

/**
 * Episode wound photo metadata list (no image bodies).
 * Navigate to review for measurements + online-only annotations.
 */
export default function PhotosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    episodeId?: string;
    patientId?: string;
  }>();
  const episodeId = first(params.episodeId);
  const patientId = first(params.patientId);

  const [rows, setRows] = useState<WoundPhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!episodeId) {
        setMessage('Episode required.');
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMessage(null);
      try {
        const data = await listEpisodeWoundPhotos(episodeId);
        setRows(data);
        if (data.length === 0) {
          setMessage('No wound photos for this episode yet.');
        }
      } catch (e) {
        setRows([]);
        if (isTransportFailure(e)) {
          setMessage('Offline — cannot load server photo list.');
        } else if (e instanceof ApiError) {
          setMessage(e.message || e.code);
        } else {
          setMessage('Failed to load photos.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [episodeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!episodeId) {
    return (
      <View style={styles.container}>
        <Text style={styles.help}>Open photos from an episode card.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Metadata only · measure & annotate on available photos (online).
      </Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {loading && !refreshing ? <ActivityIndicator color="#0369a1" /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#0369a1"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/photo-review',
                params: {
                  photoId: item.id,
                  episodeId,
                  ...(patientId ? { patientId } : {}),
                },
              })
            }
          >
            <Text style={styles.status}>
              {item.status}
              {item.isLargeWound ? ' · LARGE' : ''}
            </Text>
            <Text style={styles.meta}>
              id: {item.id.slice(0, 8)}… · client: {item.clientPhotoId.slice(0, 8)}…
            </Text>
            <Text style={styles.meta}>
              L{fmt(item.lengthCm)} × W{fmt(item.widthCm)} × D{fmt(item.depthCm)} cm
            </Text>
            <Text style={styles.action}>
              {item.status === 'available'
                ? 'Open · measure / annotate'
                : 'Open · wait for available to measure/annotate'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return String(n);
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  help: { fontSize: 13, color: '#475569', marginBottom: 8, lineHeight: 18 },
  msg: { fontSize: 13, color: '#b45309', marginBottom: 8 },
  link: { color: '#0369a1', fontWeight: '600', marginTop: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    gap: 4,
  },
  status: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', fontFamily: 'Courier' },
  action: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#0369a1' },
});
