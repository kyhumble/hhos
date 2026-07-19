/**
 * Minimal vector_json annotation payload (encrypted client-side).
 * Stored as AES-GCM framed ciphertext only — never as plaintext payload_json.
 */

export type VectorStroke = {
  color: string;
  width: number;
  /** Normalized 0–1 coordinates relative to image bounds. */
  points: Array<[number, number]>;
};

export type VectorMarker = {
  /** Normalized 0–1 coordinates. */
  x: number;
  y: number;
  label: string;
};

export type VectorAnnotationPayload = {
  version: 1;
  type: 'vector_json';
  strokes: VectorStroke[];
  markers: VectorMarker[];
};

export function buildVectorJsonBytes(
  payload: Omit<VectorAnnotationPayload, 'version' | 'type'> & {
    strokes?: VectorStroke[];
    markers?: VectorMarker[];
  },
): Uint8Array {
  const body: VectorAnnotationPayload = {
    version: 1,
    type: 'vector_json',
    strokes: payload.strokes ?? [],
    markers: payload.markers ?? [],
  };
  const json = JSON.stringify(body);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json);
  }
  const out = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i++) out[i] = json.charCodeAt(i) & 0xff;
  return out;
}

export function isNonEmptyAnnotation(
  strokes: VectorStroke[],
  markers: VectorMarker[],
): boolean {
  return markers.length > 0 || strokes.some((s) => s.points.length >= 2);
}
