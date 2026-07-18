import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type EpisodeRow = {
  id: string;
  mrn: string;
  patientFirstName: string;
  patientLastName: string;
  flags: string[];
  intakeStatus: string;
};

/**
 * Lists episodes when a token is available.
 * Full auth + consent capture: Phase 1 stretch / Phase 2 field workflows.
 */
export default function EpisodesScreen() {
  const [rows, setRows] = useState<EpisodeRow[]>([]);
  const [message, setMessage] = useState('Connect API + set EXPO_PUBLIC_API_URL for live data.');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Phase 0: no secure token store yet — show shell guidance
    setLoading(false);
    setMessage(
      'Phase 0 shell: use web login to obtain a token. Phase 1 wires secure storage + consent capture.',
    );
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.help}>{message}</Text>
      {loading && <ActivityIndicator />}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No episodes loaded. API: {API_URL}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>
              {item.patientLastName}, {item.patientFirstName}
            </Text>
            <Text style={styles.meta}>
              {item.mrn} · {item.intakeStatus}
            </Text>
            <Text style={styles.flags}>{item.flags?.join(', ')}</Text>
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
  empty: { color: '#64748b', marginTop: 24, textAlign: 'center' },
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
});
