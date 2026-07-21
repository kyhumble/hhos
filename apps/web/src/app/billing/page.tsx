'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

function gapLabel(code: string, message: string) {
  const map: Record<string, string> = {
    ORDERS_UNSIGNED: 'Physician orders not signed yet',
    POC_UNSIGNED: 'Plan of care (485) not signed yet',
    HOSPICE_CERT_UNSIGNED: 'Hospice certification not signed yet',
    MISSING_PRIMARY_DX: 'Primary diagnosis missing',
    COVERAGE_MISSING: 'No insurance coverage on file',
    COVERAGE_UNVERIFIED: 'Coverage not verified',
    F2F_INCOMPLETE: 'Face-to-face documentation incomplete',
    OASIS_NOT_LOCKED: 'Assessment not locked',
    INTAKE_INCOMPLETE: 'Intake checklist incomplete',
    EPISODE_NOT_ACTIVE: 'Episode not active for billing',
    HOSPICE_ELECTION_INACTIVE: 'Hospice election not active',
    HOSPICE_TERMINAL_DX_MISSING: 'Terminal diagnosis missing',
  };
  return map[code] ?? message;
}

function isSignatureGap(code: string) {
  return (
    code === 'ORDERS_UNSIGNED' ||
    code === 'POC_UNSIGNED' ||
    code === 'HOSPICE_CERT_UNSIGNED'
  );
}

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
      setError('Sign in to view billing readiness.');
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
      setError(wData.error?.message ?? 'Could not load billing worklist.');
      return;
    }
    setWork(wData.data ?? []);
    if (cRes.ok) setClaims(cData.data ?? []);
    setError(null);
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
      setError(data.error?.message ?? 'Readiness check failed');
      return;
    }
    const lines = (data.gaps ?? []).map(
      (g: { code: string; severity: string; message: string }) =>
        `${g.severity === 'hard' ? 'Must fix' : 'Note'}: ${gapLabel(g.code, g.message)}`,
    );
    setDetail(
      [
        data.ready ? 'Ready to bill' : `${data.hardGapCount} item(s) block billing`,
        ...lines,
      ].join('\n'),
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
      setError(data.error?.message ?? 'Could not create claim package');
      return;
    }
    setMsg(`Claim package created · ${data.status}`);
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
      setError('Export blocked — resolve signature and coverage issues first.');
      if (data.error?.gaps) {
        setDetail(
          data.error.gaps
            .map(
              (g: { code: string; message: string }) =>
                gapLabel(g.code, g.message),
            )
            .join('\n'),
        );
      }
      return;
    }
    setMsg(`Exported as ${data.export?.format}`);
    setDetail(JSON.stringify(data.export, null, 2));
    await load();
  }

  const signatureBlocked = work.filter((w) =>
    (w.topGaps ?? []).some((g) => isSignatureGap(g.code)),
  ).length;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Records"
        title="Billing readiness"
        description="See what’s blocking clean claims. Unsigned orders and plans of care are usually the first place to look."
        actions={
          <Link href="/orders">
            <Button size="sm">Physician signatures</Button>
          </Link>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      {signatureBlocked > 0 && (
        <Alert tone="warn">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong className="font-semibold">{signatureBlocked} episode(s)</strong> are blocked
              by unsigned orders, plans of care, or certifications.
            </span>
            <Link href="/orders">
              <Button size="sm" variant="secondary">
                Open signature queue
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      <Card>
        <h2 className="ui-section-title mb-4">Check an episode</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Episode">
            <Input
              className="font-mono text-xs"
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
            />
          </Field>
          <Field label="Claim type">
            <Select value={claimType} onChange={(e) => setClaimType(e.target.value)}>
              <option value="hh_rap">Home health RAP</option>
              <option value="hh_final">Home health final</option>
              <option value="hospice_noe">Hospice NOE</option>
              <option value="hospice_claim">Hospice claim</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => void checkReadiness()}>
              Check readiness
            </Button>
            <Button type="button" onClick={() => void createClaim()}>
              Create claim package
            </Button>
          </div>
        </div>
      </Card>

      <div className="ui-table-wrap">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="ui-section-title">Episodes</h2>
        </div>
        <table className="ui-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Care</th>
              <th>Status</th>
              <th>What’s blocking</th>
            </tr>
          </thead>
          <tbody>
            {work.map((w) => {
              const hasSigGap = (w.topGaps ?? []).some((g) => isSignatureGap(g.code));
              return (
                <tr key={w.episodeId}>
                  <td>
                    <div className="font-medium">{w.patientName}</div>
                  </td>
                  <td>
                    <span className="text-sm capitalize text-ink-600">
                      {w.careType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {w.ready ? (
                      <Badge tone="success">Ready</Badge>
                    ) : (
                      <Badge tone={hasSigGap ? 'danger' : 'warn'}>
                        {w.hardGapCount} to fix
                      </Badge>
                    )}
                  </td>
                  <td className="text-sm text-ink-600">
                    {(w.topGaps ?? []).length === 0 ? (
                      '—'
                    ) : (
                      <ul className="space-y-0.5">
                        {(w.topGaps ?? []).map((g) => (
                          <li key={g.code}>
                            {gapLabel(g.code, g.message)}
                            {isSignatureGap(g.code) && (
                              <>
                                {' '}
                                <Link href="/orders" className="ui-link text-xs">
                                  Chase signature
                                </Link>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
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
                <td className="font-medium">{c.claimType.replace(/_/g, ' ')}</td>
                <td>{c.patientName ?? '—'}</td>
                <td>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  {c.hardGapCount > 0 && (
                    <span className="ml-2 text-xs text-amber-700">{c.hardGapCount} blocking</span>
                  )}
                </td>
                <td className="text-right">
                  {(c.status === 'ready' || c.status === 'exported') && (
                    <Button size="sm" variant="secondary" onClick={() => void exportClaim(c.id)}>
                      Export
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title="No claim packages yet"
                    body="Check readiness first, then create a package when gaps are clear."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <Card>
          <div className="ui-kicker">Readiness detail</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{detail}</pre>
        </Card>
      )}
    </div>
  );
}
