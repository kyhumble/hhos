/**
 * Compact sync progress badge — counts + status codes only (no PHI).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requestSync } from '../outbox/syncWorker';
import {
  getSyncProgress,
  subscribeSyncProgress,
  type SyncProgress,
} from './sync-state';

function labelFor(p: SyncProgress): string {
  if (p.status === 'device_revoked') return 'Device revoked';
  if (p.status === 'registering') return 'Registering device…';
  if (p.status === 'syncing') {
    const n = p.pendingCount;
    return n > 0 ? `Syncing photos (${n})…` : 'Syncing…';
  }
  if (p.status === 'error') {
    return p.lastErrorCode
      ? `Sync error: ${p.lastErrorCode}`
      : 'Sync error';
  }
  if (p.pendingCount > 0) {
    return `${p.pendingCount} photo${p.pendingCount === 1 ? '' : 's'} pending sync`;
  }
  if (p.lastSyncedAt) return 'Photos synced';
  return 'Sync idle';
}

function tone(p: SyncProgress): 'ok' | 'warn' | 'err' | 'busy' {
  if (p.status === 'device_revoked' || p.status === 'error') return 'err';
  if (p.status === 'registering' || p.status === 'syncing') return 'busy';
  if (p.pendingCount > 0) return 'warn';
  return 'ok';
}

export function SyncBadge() {
  const [progress, setProgress] = useState<SyncProgress>(getSyncProgress());

  useEffect(() => subscribeSyncProgress(setProgress), []);

  const t = tone(progress);
  const bg =
    t === 'err'
      ? styles.err
      : t === 'busy'
        ? styles.busy
        : t === 'warn'
          ? styles.warn
          : styles.ok;

  return (
    <Pressable
      onPress={() => requestSync('badge')}
      accessibilityRole="button"
      accessibilityLabel="Photo sync status. Tap to retry."
      style={[styles.wrap, bg]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            t === 'err'
              ? styles.dotErr
              : t === 'busy'
                ? styles.dotBusy
                : t === 'warn'
                  ? styles.dotWarn
                  : styles.dotOk,
          ]}
        />
        <Text style={styles.text}>{labelFor(progress)}</Text>
      </View>
      {progress.lastMessage && progress.status !== 'idle' ? (
        <Text style={styles.sub} numberOfLines={2}>
          {progress.lastMessage}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  sub: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ok: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  warn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  busy: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  err: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  dotOk: { backgroundColor: '#16a34a' },
  dotWarn: { backgroundColor: '#d97706' },
  dotBusy: { backgroundColor: '#2563eb' },
  dotErr: { backgroundColor: '#dc2626' },
});
