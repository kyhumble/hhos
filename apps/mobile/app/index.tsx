import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Phase 0 mobile shell.
 * Phase 2: app-controlled camera only for clinical photos; gallery disabled.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HHOS Field</Text>
      <Text style={styles.sub}>
        Phase 0 shell · iOS-first · Synthetic data only
      </Text>
      <Text style={styles.note}>
        Clinical photos (Phase 2): in-app camera only, consent-linked, offline encrypted
        queue. Geotag off by default.
      </Text>
      <Link href="/episodes" style={styles.link}>
        View assigned episodes
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  sub: {
    fontSize: 14,
    color: '#475569',
  },
  note: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 10,
  },
  link: {
    marginTop: 16,
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '600',
  },
});
