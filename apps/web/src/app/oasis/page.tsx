'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Row = {
  id: string;
  episodeId: string;
  patientId: string;
  timepoint: string;
  status: string;
  completenessScore: number;
  flagsJson?: { code: string; severity: string; message: string }[];
  submittedAt?: string | null;
};

export default function OasisReviewPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'review' | 'all'>('review');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Not logged in. Use /login first.');
      return;
    }
    const path =
      mode === 'review' ? '/v1/worklists/oasis-review' : '/v1/oasis/assessments';
    fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? data.message ?? 'Failed to load');
          return;
        }
        setRows(data.data ?? []);
        setError(null);
      })
      .catch(() => setError('API unreachable — is FEATURE_OASIS=true and API running?'));
  }, [mode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">OASIS assessments</h1>
          <p className="text-sm text-slate-600">
            Phase 3 — PDGM-critical subset. Flags are advisory only.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${mode === 'review' ? 'bg-brand-700 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('review')}
          >
            In review
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${mode === 'all' ? 'bg-brand-700 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('all')}
          >
            All
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Timepoint</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Complete</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !error && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No assessments. Open an episode and create an SOC assessment.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{r.timepoint}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{r.status}</span>
                </td>
                <td className="px-4 py-3">{r.completenessScore}%</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.flagsJson ?? []).slice(0, 4).map((f) => (
                      <span
                        key={f.code}
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900"
                        title={f.message}
                      >
                        {f.code}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <a className="text-brand-700 hover:underline" href={`/oasis/${r.id}`}>
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
