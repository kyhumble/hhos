'use client';

/**
 * Episode wound-photo metadata strip + on-demand decrypt-proxy viewer.
 * List never loads image bodies (K22). Content is fetched only when the user
 * opens a photo. Billing / roles without wound_photo:read never see content.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';
import {
  canBreakGlass,
  canReadWoundPhotos,
  canUseClinicalContentPath,
  loadSessionUser,
  type SessionUser,
} from '@/lib/auth';

export type PhotoMetadata = {
  id: string;
  woundId: string;
  visitId: string | null;
  status: string;
  capturedAt: string;
  contentType: string | null;
  byteSize: number | null;
  widthPx: number | null;
  heightPx: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  measurementMethod: string | null;
  isLargeWound: boolean;
  deviceModel: string | null;
  captureSource: string | null;
  hasWrappedDek: boolean;
};

type GalleryState = 'loading' | 'ready' | 'disabled' | 'forbidden' | 'error';

type Props = {
  episodeId: string;
};

export function EpisodePhotoGallery({ episodeId }: Props) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [state, setState] = useState<GalleryState>('loading');
  const [error, setError] = useState<string | null>(null);

  const [viewerPhoto, setViewerPhoto] = useState<PhotoMetadata | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setViewerUrl(null);
  }, []);

  const loadPhotos = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState('error');
      setError('Not logged in');
      return;
    }

    const session = await loadSessionUser();
    setUser(session);

    // K15: billing and other roles without wound_photo:read never list or view content
    if (!canReadWoundPhotos(session)) {
      setState('forbidden');
      setPhotos([]);
      setError(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/v1/episodes/${episodeId}/wound-photos`, {
        headers: authHeaders(token),
      });

      if (res.status === 404) {
        // FEATURE_WOUND_PHOTOS off → feature-flag empty state
        setState('disabled');
        setPhotos([]);
        setError(null);
        return;
      }

      if (res.status === 403) {
        setState('forbidden');
        setPhotos([]);
        setError(null);
        return;
      }

      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        setState('error');
        return;
      }

      const data = (await res.json()) as { data?: PhotoMetadata[] };
      setPhotos(data.data ?? []);
      setState('ready');
      setError(null);
    } catch {
      setError('API unreachable');
      setState('error');
    }
  }, [episodeId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  async function openViewer(photo: PhotoMetadata) {
    setViewerPhoto(photo);
    setViewerError(null);
    revokeObjectUrl();

    if (photo.status !== 'available') {
      setViewerError(`Photo is not viewable (status=${photo.status}).`);
      return;
    }

    // Compliance must supply break-glass reason before we fetch content
    if (!canUseClinicalContentPath(user) && canBreakGlass(user)) {
      if (!breakGlassReason.trim()) {
        setViewerError('Enter a break-glass reason, then open again.');
        return;
      }
    }

    await fetchContent(photo);
  }

  async function fetchContent(photo: PhotoMetadata) {
    const token = getToken();
    if (!token) {
      setViewerError('Not logged in');
      return;
    }

    // Never request content without permission (billing UI hide)
    if (!canReadWoundPhotos(user)) {
      setViewerError('You do not have permission to view photo content.');
      return;
    }

    setViewerLoading(true);
    setViewerError(null);
    revokeObjectUrl();

    try {
      const headers: Record<string, string> = {
        ...(authHeaders(token) as Record<string, string>),
      };
      if (
        !canUseClinicalContentPath(user) &&
        canBreakGlass(user) &&
        breakGlassReason.trim()
      ) {
        headers['X-Break-Glass-Reason'] = breakGlassReason.trim();
      }

      // Single on-demand decrypt — not used for thumbnails in the grid
      const res = await fetch(`${API_URL}/v1/wound-photos/${photo.id}/content`, {
        headers,
      });

      if (!res.ok) {
        let message = `Failed to load content (${res.status})`;
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const err = await readApiError(res);
          message = err.message;
        }
        setViewerError(message);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setViewerUrl(url);
    } catch {
      setViewerError('Failed to load photo content');
    } finally {
      setViewerLoading(false);
    }
  }

  function closeViewer() {
    setViewerPhoto(null);
    setViewerError(null);
    revokeObjectUrl();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Wound photos</h2>
          <p className="mt-1 text-xs text-slate-500">
            Metadata only until you open a photo. Thumbnails are not pre-decrypted (no N content
            fetches).
          </p>
        </div>
        {state === 'ready' && (
          <button
            type="button"
            onClick={() => void loadPhotos()}
            className="text-xs text-brand-700 hover:underline"
          >
            Refresh
          </button>
        )}
      </div>

      {state === 'loading' && (
        <p className="mt-4 text-sm text-slate-500">Loading photo metadata…</p>
      )}

      {state === 'disabled' && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium">Wound photos feature is not enabled</p>
          <p className="mt-1 text-slate-600">
            Empty state while <code className="rounded bg-white px-1">FEATURE_WOUND_PHOTOS</code> is
            off. Enable the flag on the API to list episode photos.
          </p>
        </div>
      )}

      {state === 'forbidden' && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Photo content is restricted for your role</p>
          <p className="mt-1">
            Clinical images require <code className="rounded bg-white px-1">wound_photo:read</code>.
            Billing and other non-clinical roles cannot list or view photo content (document:read
            does not grant access).
          </p>
        </div>
      )}

      {state === 'error' && error && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          {error}
        </div>
      )}

      {state === 'ready' && photos.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No wound photos for this episode yet. Field capture uses the mobile app with consent{' '}
          <code className="rounded bg-white px-1">WOUND_PHOTO_CLINICAL</code>.
        </div>
      )}

      {state === 'ready' && photos.length > 0 && (
        <>
          {!canUseClinicalContentPath(user) && canBreakGlass(user) && (
            <label className="mt-3 block text-xs text-slate-600">
              Break-glass reason (required for compliance view)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
                placeholder="Clinical review / surveyor request / …"
              />
            </label>
          )}

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                {/* Placeholder tile — never fetches /content for gallery cards */}
                <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                  {photo.status === 'available' ? 'Encrypted · open to view' : photo.status}
                </div>

                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-white px-1.5 py-0.5 font-medium ring-1 ring-slate-200">
                      {photo.status}
                    </span>
                    {photo.isLargeWound && (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-800 ring-1 ring-red-100">
                        large wound
                      </span>
                    )}
                  </div>
                  <p>
                    Captured{' '}
                    {photo.capturedAt
                      ? new Date(photo.capturedAt).toLocaleString()
                      : '—'}
                  </p>
                  <p className="text-slate-500">
                    {formatMeasurements(photo)}
                    {photo.measurementMethod ? ` · ${photo.measurementMethod}` : ''}
                  </p>
                  {(photo.widthPx || photo.heightPx) && (
                    <p className="text-slate-500">
                      {photo.widthPx ?? '?'}×{photo.heightPx ?? '?'}px
                      {photo.byteSize != null ? ` · ${formatBytes(photo.byteSize)}` : ''}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-slate-400">
                    {photo.id.slice(0, 8)}… · wound {photo.woundId.slice(0, 8)}…
                  </p>
                </div>

                <button
                  type="button"
                  disabled={photo.status !== 'available'}
                  onClick={() => void openViewer(photo)}
                  className="mt-3 rounded-lg bg-slate-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {photo.status === 'available' ? 'View photo' : 'Unavailable'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Wound photo viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewer();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">Photo viewer</h3>
                <p className="text-xs text-slate-500">
                  On-demand decrypt proxy · {viewerPhoto.id.slice(0, 8)}…
                </p>
              </div>
              <button
                type="button"
                onClick={closeViewer}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              {formatMeasurements(viewerPhoto)}
              {viewerPhoto.isLargeWound && (
                <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-red-800">
                  large wound
                </span>
              )}
            </div>

            {viewerLoading && (
              <p className="mt-6 text-center text-sm text-slate-500">Decrypting photo…</p>
            )}
            {viewerError && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {viewerError}
                {!canUseClinicalContentPath(user) && canBreakGlass(user) && (
                  <div className="mt-3 space-y-2">
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={breakGlassReason}
                      onChange={(e) => setBreakGlassReason(e.target.value)}
                      placeholder="Break-glass reason"
                    />
                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      onClick={() => void fetchContent(viewerPhoto)}
                    >
                      Retry with break-glass
                    </button>
                  </div>
                )}
              </div>
            )}
            {viewerUrl && !viewerLoading && (
              // eslint-disable-next-line @next/next/no-img-element -- blob: object URL from decrypt proxy
              <img
                src={viewerUrl}
                alt="Wound photograph (clinical)"
                className="mt-4 max-h-[70vh] w-full rounded-lg object-contain bg-slate-100"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function formatMeasurements(photo: PhotoMetadata): string {
  const parts: string[] = [];
  if (photo.lengthCm != null) parts.push(`L ${photo.lengthCm} cm`);
  if (photo.widthCm != null) parts.push(`W ${photo.widthCm} cm`);
  if (photo.depthCm != null) parts.push(`D ${photo.depthCm} cm`);
  return parts.length > 0 ? parts.join(' · ') : 'No measurements';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
