/**
 * Online measurements PATCH form for available wound photos.
 * Large-wound notice is non-blocking (does not prevent save or navigation).
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MeasurementMethod, PatchWoundPhotoMeasurementsInput } from '@hhos/shared';
import { ApiError, isTransportFailure } from '../api/client';
import {
  patchWoundPhotoMeasurements,
  type PatchMeasurementsResponse,
  type WoundPhotoMetadata,
} from '../api/wound-photos';
import {
  computeIsLargeWoundClient,
  LARGE_WOUND_NOTICE,
} from './large-wound';

const METHODS: MeasurementMethod[] = [
  'manual_ruler',
  'app_overlay',
  'unknown',
];

type Props = {
  photo: WoundPhotoMetadata;
  /** Parent must be available; form disabled otherwise. */
  enabled: boolean;
  onSaved?: (res: PatchMeasurementsResponse) => void;
};

function numOrEmpty(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function parseOptionalPositive(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function parseOptionalNonNeg(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function MeasurementsForm({ photo, enabled, onSaved }: Props) {
  const [lengthCm, setLengthCm] = useState(numOrEmpty(photo.lengthCm));
  const [widthCm, setWidthCm] = useState(numOrEmpty(photo.widthCm));
  const [depthCm, setDepthCm] = useState(numOrEmpty(photo.depthCm));
  const [method, setMethod] = useState<MeasurementMethod | ''>(
    (photo.measurementMethod as MeasurementMethod) || 'manual_ruler',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverLarge, setServerLarge] = useState<boolean | null>(
    photo.isLargeWound ?? null,
  );
  const [savedOk, setSavedOk] = useState(false);

  const previewLarge = computeIsLargeWoundClient(
    parseOptionalPositive(lengthCm) ?? null,
    parseOptionalPositive(widthCm) ?? null,
  );
  const showLargeNotice =
    serverLarge === true || (serverLarge === null && previewLarge);

  const onSave = useCallback(async () => {
    if (!enabled) {
      setError('Measurements can only be saved when the photo is available online.');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedOk(false);

    const body: PatchWoundPhotoMeasurementsInput = {};
    const L = parseOptionalPositive(lengthCm);
    const W = parseOptionalPositive(widthCm);
    const D = parseOptionalNonNeg(depthCm);
    if (L !== undefined) body.lengthCm = L;
    if (W !== undefined) body.widthCm = W;
    if (D !== undefined) body.depthCm = D;
    if (method) body.measurementMethod = method as MeasurementMethod;

    if (
      body.lengthCm === undefined &&
      body.widthCm === undefined &&
      body.depthCm === undefined &&
      body.measurementMethod === undefined
    ) {
      setError('Enter at least one measurement field.');
      setSaving(false);
      return;
    }

    try {
      const res = await patchWoundPhotoMeasurements(photo.id, body);
      setServerLarge(res.isLargeWound);
      setLengthCm(numOrEmpty(res.lengthCm));
      setWidthCm(numOrEmpty(res.widthCm));
      setDepthCm(numOrEmpty(res.depthCm));
      if (res.measurementMethod) {
        setMethod(res.measurementMethod as MeasurementMethod);
      }
      setSavedOk(true);
      onSaved?.(res);
    } catch (e) {
      if (isTransportFailure(e)) {
        setError('Network unavailable. Measurements require connectivity.');
      } else if (e instanceof ApiError) {
        if (e.code === 'INVALID_PHOTO_STATE') {
          setError('Photo is not available yet. Wait for sync, then retry.');
        } else {
          setError(e.message || e.code);
        }
      } else {
        setError('Failed to save measurements.');
      }
    } finally {
      setSaving(false);
    }
  }, [enabled, lengthCm, widthCm, depthCm, method, photo.id, onSaved]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Measurements</Text>
      {!enabled ? (
        <Text style={styles.hint}>
          Available after the photo is synced (status available). Online PATCH
          only.
        </Text>
      ) : (
        <Text style={styles.hint}>
          PATCH /v1/wound-photos/:id/measurements · re-evaluates large-wound
          flag (non-blocking).
        </Text>
      )}

      {showLargeNotice ? (
        <View style={styles.largeBanner} accessibilityRole="text">
          <Text style={styles.largeBannerTitle}>Large wound notice</Text>
          <Text style={styles.largeBannerBody}>{LARGE_WOUND_NOTICE}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Field
          label="Length (cm)"
          value={lengthCm}
          onChange={setLengthCm}
          editable={enabled && !saving}
        />
        <Field
          label="Width (cm)"
          value={widthCm}
          onChange={setWidthCm}
          editable={enabled && !saving}
        />
      </View>
      <View style={styles.row}>
        <Field
          label="Depth (cm)"
          value={depthCm}
          onChange={setDepthCm}
          editable={enabled && !saving}
        />
      </View>

      <Text style={styles.label}>Method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m}
            style={[
              styles.methodChip,
              method === m && styles.methodChipOn,
              (!enabled || saving) && styles.methodDisabled,
            ]}
            disabled={!enabled || saving}
            onPress={() => setMethod(m)}
          >
            <Text
              style={[
                styles.methodText,
                method === m && styles.methodTextOn,
              ]}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {savedOk ? <Text style={styles.ok}>Measurements saved.</Text> : null}

      <Pressable
        style={[styles.saveBtn, (!enabled || saving) && styles.saveDisabled]}
        disabled={!enabled || saving}
        onPress={() => void onSave()}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save measurements</Text>
        )}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  editable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChange}
        editable={editable}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor="#94a3b8"
      />
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
  largeBanner: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  largeBannerTitle: { fontSize: 13, fontWeight: '700', color: '#9a3412' },
  largeBannerBody: { fontSize: 12, color: '#9a3412', lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  methodChipOn: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0369a1',
  },
  methodDisabled: { opacity: 0.5 },
  methodText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  methodTextOn: { color: '#0369a1' },
  error: { fontSize: 12, color: '#b91c1c' },
  ok: { fontSize: 12, color: '#047857' },
  saveBtn: {
    marginTop: 4,
    backgroundColor: '#0369a1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveDisabled: { backgroundColor: '#94a3b8' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
