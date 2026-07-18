import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { devLogin } from '../src/api/auth';
import { ApiError } from '../src/api/client';

const DEMO_RN = 'rn@demo.local';

/**
 * Dev-only login. Token lands in expo-secure-store (`hhos.accessToken`).
 * Disabled server-side when AUTH_PROVIDER=cognito.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_RN);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await devLogin(email.trim().toLowerCase());
      router.replace('/');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Login failed. Is the API running?');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dev sign-in</Text>
      <Text style={styles.help}>
        Local JWT only. Access token is stored in the device secure store — never
        log it. Use a synthetic demo user (e.g. field RN).
      </Text>
      <Text style={styles.label}>Demo email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />
      <Text style={styles.hint}>
        rn@demo.local · lead@demo.local · coord@demo.local
      </Text>
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc', gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  help: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#0f172a',
  },
  hint: { fontSize: 12, color: '#94a3b8' },
  button: {
    marginTop: 8,
    backgroundColor: '#0369a1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  errorBox: {
    marginTop: 8,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#991b1b', fontSize: 13 },
});
