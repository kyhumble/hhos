import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  startSyncWorker,
  stopSyncWorker,
} from '../src/outbox/syncWorker';

export default function RootLayout() {
  useEffect(() => {
    // Foreground + periodic outbox drain (register gate inside worker).
    startSyncWorker();
    return () => {
      stopSyncWorker();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0369a1' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'HHOS Field' }} />
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="episodes" options={{ title: 'My episodes' }} />
        <Stack.Screen
          name="capture"
          options={{ title: 'Wound photo capture' }}
        />
        <Stack.Screen name="photos" options={{ title: 'Wound photos' }} />
        <Stack.Screen
          name="photo-review"
          options={{ title: 'Measure & annotate' }}
        />
      </Stack>
    </>
  );
}
