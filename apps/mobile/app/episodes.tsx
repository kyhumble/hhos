import { Link, useRouter } from 'expo-router';
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
import { ApiError } from '../src/api/client';
import { listEpisodes, type EpisodeRow } from '../src/api/episodes';
import { getAccessToken } from '../src/secure/token-store';
import { API_URL } from '../src/config';

/**
 * Caseload episodes when a secure-store token is present.
 * field_rn sees only assigned episodes (API enforces caseload).
 */
export default function EpisodesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EpisodeRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);

    const token = await getAccessToken();
    if (!token) {
      setRows([]);
      setMessage('Sign in to load your caseload episodes.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await listEpisodes();
      setRows(data);
      if (data.length === 0) {
        setMessage('No episodes on your caseload (or none in org).');
      }
    } catch (e) {
      setRows([]);
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Session expired. Sign in again.');
      } else if (e instanceof Error) {
        setMessage(e.message);
      } else {
        setMessage('Failed to load episodes.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {message ? <Text style={styles.help}>{message}</Text> : null}
      {!message && !loading ? (
        <Text style={styles.help}>
          Assigned episodes · API {API_URL} · Open capture only with clinical
          consent grant.
        </Text>
      ) : null}
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
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>No episodes loaded.</Text>
              <Link href="/login" style={styles.link}>
                Sign in
              </Link>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>
              {item.patientLastName}, {item.patientFirstName}
            </Text>
            <Text style={styles.meta}>
              {item.mrn} · {item.intakeStatus}
              {item.status ? ` · ${item.status}` : ''}
            </Text>
            {item.flags?.length ? (
              <Text style={styles.flags}>{item.flags.join(', ')}</Text>
            ) : null}
            <Pressable
              style={styles.captureBtn}
              onPress={() =>
                router.push({
                  pathname: '/capture',
                  params: {
                    patientId: item.patientId,
                    episodeId: item.id,
                  },
                })
              }
            >
              <Text style={styles.captureBtnText}>
                Wound photo capture (consent-gated)
              </Text>
            </Pressable>
            <Pressable
              style={styles.photosBtn}
              onPress={() =>
                router.push({
                  pathname: '/photos',
                  params: {
                    patientId: item.patientId,
                    episodeId: item.id,
                  },
                })
              }
            >
              <Text style={styles.photosBtnText}>
                Photos · measure & annotate
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  help: {
    marginBottom: 12,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  emptyBox: { marginTop: 24, alignItems: 'center', gap: 8 },
  empty: { color: '#64748b', textAlign: 'center' },
  link: { color: '#0369a1', fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { marginTop: 4, fontSize: 13, color: '#64748b' },
  flags: { marginTop: 6, fontSize: 12, color: '#b91c1c' },
  captureBtn: {
    marginTop: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  captureBtnText: { color: '#0369a1', fontWeight: '600', fontSize: 13 },
  photosBtn: {
    marginTop: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  photosBtnText: { color: '#047857', fontWeight: '600', fontSize: 13 },
});
