/** Normalize Nest / HHOS error bodies into a single human message. */
export function formatApiError(data: unknown, fallback: string, status?: number): string {
  if (!data || typeof data !== 'object') {
    return status ? `${fallback} (${status})` : fallback;
  }
  const d = data as Record<string, unknown>;
  const err = d.error as Record<string, unknown> | undefined;

  let msg =
    (err?.message && typeof err.message === 'string' && err.message) ||
    (typeof d.message === 'string' && d.message) ||
    fallback;

  const details = err?.details as { issues?: { path?: string; message?: string }[] } | undefined;
  if (details?.issues?.length) {
    const bits = details.issues
      .slice(0, 6)
      .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
      .filter(Boolean);
    if (bits.length) msg = `${msg} — ${bits.join('; ')}`;
  }

  if (Array.isArray(d.message)) {
    msg = d.message.map(String).join('; ');
  }

  if (status && status >= 400 && !msg.includes(String(status))) {
    msg = `${msg} (HTTP ${status})`;
  }
  return msg;
}
