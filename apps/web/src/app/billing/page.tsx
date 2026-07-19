'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const EPISODE_DEMO = '00000000-0000-4000-8000-000000000041';

type WorkItem = {
  episodeId: string;
  careType: string;
  patientName: string;
  ready: boolean;
  hardGapCount: number;
  softGapCount: number;
  claimTypeHint: string;
  topGaps: { code: string; severity: string; message: string }[];
};

type Claim = {
  id: string;
  claimType: string;
  status: string;
  hardGapCount: number;
  patientName?: string;
  episodeId: string;
};

export default function BillingPage() {
  const [work, setWork] = useState<WorkItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [episodeId, setEpisodeId] = useState(EPISODE_DEMO);
  const [claimType, setClaimType] = useState('hh_rap');

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function load() {
    if (!token) {
      setError('Login as admin or billing@… (billing:read). Use admin@demo.local.');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const [wRes, cRes] = await Promise.all([
      fetch(`${API_URL}/v1/worklists/billing`, { headers }),
      fetch(`${API_URL}/v1/billing/claims`, { headers }),
    ]);
    const wData = await wRes.json();
    const cData = await cRes.json();
    if (!wRes.ok) {
      setError(wData.error?.message ?? 'Worklist failed (FEATURE_BILLING?)');
      return;
    }
    setWork(wData.data ?? []);
    if (cRes.ok) setClaims(cData.data ?? []);
    setError(null);
    if (wData.disclaimer) setMsg(wData.disclaimer);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function checkReadiness() {
    if (!token) return;
    const res = await fetch(
      `${API_URL}/v1/billing/readiness/${episodeId}?claimType=${claimType}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Readiness failed');
      return;
    }
    setDetail(
      JSON.stringify(
        {
          ready: data.ready,
          hard: data.hardGapCount,
          soft: data.softGapCount,
          gaps: data.gaps,
          snapshot: data.snapshot,
        },
        null,
        2,
      ),
    );
  }

  async function createClaim() {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/billing/claims`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ episodeId, claimType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Create claim failed (need billing:write)');
      return;
    }
    setMsg(`Claim package ${data.id.slice(0, 8)}… status=${data.status}`);
    await load();
  }

  async function exportClaim(id: string) {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/billing/claims/${id}/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(
        data.error?.message ??
          (data.message as string) ??
          'Export blocked — resolve hard gaps (signatures)',
      );
      setDetail(JSON.stringify(data.error ?? data, null, 2));
      return;
    }
    setMsg(`Exported as ${data.export?.format}`);
    setDetail(JSON.stringify(data.export, null, 2));
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Billing readiness</h1>
        <p className="text-sm text-slate-600">
          Phase 7 — what blocks clean claims, then JSON export for external billing. No live EDI
          submit.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      <section className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">Check episode</h2>
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          value={episodeId}
          onChange={(e) => setEpisodeId(e.target.value)}
        />
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={claimType}
          onChange={(e) => setClaimType(e.target.value)}
        >
          <option value="hh_rap">hh_rap</option>
          <option value="hh_final">hh_final</option>
          <option value="hospice_noe">hospice_noe</option>
          <option value="hospice_claim">hospice_claim</option>
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => void checkReadiness()}
          >
            Run readiness
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white"
            onClick={() => void createClaim()}
          >
            Create claim package
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="text-sm font-semibold px-4 py-3 border-b">Episode worklist</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Care</th>
              <th className="px-3 py-2 text-left">Ready</th>
              <th className="px-3 py-2 text-left">Gaps</th>
            </tr>
          </thead>
          <tbody>
            {work.map((w) => (
              <tr key={w.episodeId} className="border-t">
                <td className="px-3 py-2">
                  {w.patientName}
                  <div className="text-xs font-mono text-slate-500">{w.episodeId.slice(0, 8)}…</div>
                </td>
                <td className="px-3 py-2">{w.careType}</td>
                <td className="px-3 py-2">
                  {w.ready ? (
                    <span className="text-emerald-700">Yes</span>
                  ) : (
                    <span className="text-amber-700">No ({w.hardGapCount} hard)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {(w.topGaps ?? []).map((g) => g.code).join(', ') || '—'}
                </td>
              </tr>
            ))}
            {work.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-slate-500">
                  No open episodes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="text-sm font-semibold px-4 py-3 border-b">Claim packages</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">{c.claimType}</td>
                <td className="px-3 py-2">{c.patientName ?? c.episodeId.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  {c.status}
                  {c.hardGapCount > 0 && (
                    <span className="text-xs text-amber-700"> · {c.hardGapCount} hard</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {(c.status === 'ready' || c.status === 'exported') && (
                    <button
                      type="button"
                      className="text-brand-700 text-xs underline"
                      onClick={() => void exportClaim(c.id)}
                    >
                      Export JSON
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-slate-500">
                  No claim packages yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {detail && (
        <pre className="rounded-xl border bg-slate-900 text-slate-100 text-xs p-4 overflow-auto max-h-96">
          {detail}
        </pre>
      )}
    </div>
  );
}
