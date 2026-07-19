import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logout } from '../src/api/auth';
import { requestSync } from '../src/outbox/syncWorker';
import { getAccessToken } from '../src/secure/token-store';
import { SyncBadge } from '../src/sync/SyncBadge';

/**
 * Field home shell.
 * Phase 2: app-controlled camera only for clinical photos; gallery disabled.
 * Crypto/camera require a dev client — Expo Go is unsupported (see README).
 */
export default function HomeScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getAccessToken().then((t) => {
        if (active) {
          setSignedIn(!!t);
          if (t) requestSync('home-focus');
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function onLogout() {
    await logout();
    setSignedIn(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HHOS Field</Text>
      <Text style={styles.sub}>
        Phase 2 shell · iOS-first · Synthetic data only
      </Text>
      <Text style={styles.note}>
        Clinical photos: in-app camera only (PR 9), consent-linked
        (WOUND_PHOTO_CLINICAL), offline encrypted queue. Requires prebuild / dev
        client — Expo Go is not supported for Phase 2 crypto.
      </Text>

      <View style={styles.authRow}>
        <Text style={styles.authLabel}>
          {signedIn ? 'Signed in (secure store token)' : 'Not signed in'}
        </Text>
        {signedIn ? (
          <Pressable onPress={() => void onLogout()}>
            <Text style={styles.authAction}>Sign out</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.authAction}>Sign in</Text>
          </Pressable>
        )}
      </View>

      {signedIn ? <SyncBadge /> : null}

      <Link href="/episodes" style={styles.link}>
        View assigned episodes
      </Link>
      {!signedIn ? (
        <Link href="/login" style={styles.linkSecondary}>
          Dev login
        </Link>
      ) : null}
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
  authRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authLabel: { fontSize: 13, color: '#334155', flex: 1 },
  authAction: { fontSize: 14, fontWeight: '600', color: '#0369a1' },
  link: {
    marginTop: 8,
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '600',
  },
  linkSecondary: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
});
