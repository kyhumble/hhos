/**
 * App-controlled clinical camera only — no gallery / image-picker.
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export type ClinicalCameraProps = {
  onCaptured: (localUri: string) => void | Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
};

export function ClinicalCamera({
  onCaptured,
  onCancel,
  disabled,
}: ClinicalCameraProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0369a1" />
        <Text style={styles.muted}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera permission required</Text>
        <Text style={styles.muted}>
          Clinical wound photos use the app-controlled camera only. Gallery
          import is not allowed.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.primaryText}>Grant camera access</Text>
        </Pressable>
        {onCancel ? (
          <Pressable style={styles.linkBtn} onPress={onCancel}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const takePicture = async () => {
    if (busy || disabled) return;
    setError(null);
    setBusy(true);
    try {
      const cam = cameraRef.current;
      if (!cam) {
        throw new Error('CAMERA_NOT_READY');
      }
      const photo = await cam.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        exif: false,
      });
      if (!photo?.uri) {
        throw new Error('CAPTURE_EMPTY');
      }
      await onCaptured(photo.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Capture failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
        // No barcode / no recording — clinical stills only
      />
      <View style={styles.controls}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.hint}>
          Clinical capture only · no gallery · encrypts on device before save
        </Text>
        <Pressable
          style={[styles.shutter, (busy || disabled) && styles.shutterDisabled]}
          onPress={() => void takePicture()}
          disabled={busy || disabled}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.shutterText}>Capture wound photo</Text>
          )}
        </Pressable>
        {onCancel ? (
          <Pressable style={styles.linkBtn} onPress={onCancel} disabled={busy}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0f172a' },
  camera: { flex: 1 },
  controls: {
    padding: 16,
    gap: 10,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  muted: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  primary: {
    backgroundColor: '#0369a1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  hint: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  error: { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
  shutter: {
    backgroundColor: '#0369a1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: '#7dd3fc', fontWeight: '600', fontSize: 15 },
});
