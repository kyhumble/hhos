'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  statusTone,
} from '@/components/ui';
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
      setError('Login as admin or billing@demo.local (billing:read).');
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
      setError(data.error?.message ?? 'Create claim failed');
      return;
    }
    setMsg(`Claim package created · status ${data.status}`);
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
      setError(data.error?.message ?? 'Export blocked — resolve hard gaps first');
      setDetail(JSON.stringify(data.error ?? data, null, 2));
      return;
    }
    setMsg(`Exported as ${data.export?.format}`);
    setDetail(JSON.stringify(data.export, null, 2));
    await load();
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Revenue"
        title="Billing readiness"
        description="See what blocks clean claims, then export JSON for your clearinghouse. No live EDI submit."
      />

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      <Card>
        <h2 className="ui-section-title mb-4">Check episode</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Episode ID">
            <Input
              className="font-mono text-xs"
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
            />
          </Field>
          <Field label="Claim type">
            <Select value={claimType} onChange={(e) => setClaimType(e.target.value)}>
              <option value="hh_rap">HH RAP</option>
              <option value="hh_final">HH Final</option>
              <option value="hospice_noe">Hospice NOE</option>
              <option value="hospice_claim">Hospice claim</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => void checkReadiness()}>
              Run readiness
            </Button>
            <Button type="button" onClick={() => void createClaim()}>
              Create claim package
            </Button>
          </div>
        </div>
      </Card>

      <div className="ui-table-wrap">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="ui-section-title">Episode worklist</h2>
        </div>
        <table className="ui-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Care</th>
              <th>Ready</th>
              <th>Top gaps</th>
            </tr>
          </thead>
          <tbody>
            {work.map((w) => (
              <tr key={w.episodeId}>
                <td>
                  <div className="font-medium">{w.patientName}</div>
                  <div className="font-mono text-[11px] text-ink-400">
                    {w.episodeId.slice(0, 8)}…
                  </div>
                </td>
                <td>
                  <Badge tone="neutral">{w.careType}</Badge>
                </td>
                <td>
                  {w.ready ? (
                    <Badge tone="success">Ready</Badge>
                  ) : (
                    <Badge tone="warn">{w.hardGapCount} hard</Badge>
                  )}
                </td>
                <td className="text-xs text-ink-500">
                  {(w.topGaps ?? []).map((g) => g.code).join(', ') || '—'}
                </td>
              </tr>
            ))}
            {work.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState title="No open episodes" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ui-table-wrap">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="ui-section-title">Claim packages</h2>
        </div>
        <table className="ui-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Patient</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.claimType}</td>
                <td>{c.patientName ?? c.episodeId.slice(0, 8)}</td>
                <td>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  {c.hardGapCount > 0 && (
                    <span className="ml-2 text-xs text-amber-700">{c.hardGapCount} hard</span>
                  )}
                </td>
                <td className="text-right">
                  {(c.status === 'ready' || c.status === 'exported') && (
                    <Button size="sm" variant="secondary" onClick={() => void exportClaim(c.id)}>
                      Export JSON
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState title="No claim packages yet" body="Create one from the form above." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <pre className="overflow-auto rounded-2xl border border-ink-800 bg-ink-950 p-4 text-xs leading-relaxed text-brand-100 shadow-card max-h-96">
          {detail}
        </pre>
      )}
    </div>
  );
}
