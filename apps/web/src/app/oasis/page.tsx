'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  statusTone,
} from '@/components/ui';
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

function flagLabel(code: string) {
  return code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function OasisReviewPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'review' | 'all'>('review');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Sign in to review assessments.');
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
      .catch(() => setError('Could not reach the server.'));
  }, [mode]);

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Care"
        title="OASIS QA worklist"
        description="Review and scrub assessments before they lock. Flags are guidance — clinical judgment stays with you."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'review' ? 'primary' : 'secondary'}
              onClick={() => setMode('review')}
            >
              Needs review
            </Button>
            <Button
              size="sm"
              variant={mode === 'all' ? 'primary' : 'secondary'}
              onClick={() => setMode('all')}
            >
              All assessments
            </Button>
            <Link href="/revenue">
              <Button size="sm" variant="ghost">
                Revenue integrity
              </Button>
            </Link>
          </div>
        }
      />

      {error && <Alert tone="warn">{error}</Alert>}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">In queue</div>
          <div className="mt-1 font-display text-2xl font-semibold text-ink-900">{rows.length}</div>
        </div>
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            With flags
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-700">
            {rows.filter((r) => (r.flagsJson ?? []).length > 0).length}
          </div>
        </div>
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            Avg completeness
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {rows.length
              ? Math.round(
                  rows.reduce((s, r) => s + (r.completenessScore ?? 0), 0) / rows.length,
                )
              : 0}
            %
          </div>
        </div>
      </div>

      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Timepoint</th>
              <th>Status</th>
              <th>Complete</th>
              <th>Scrub flags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title="No assessments in this view"
                    body="Open an episode and start an SOC assessment to populate the QA queue."
                  />
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-ink-900">{r.timepoint}</td>
                <td>
                  <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="text-sm tabular-nums text-ink-700">{r.completenessScore}%</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(r.flagsJson ?? []).length === 0 && (
                      <span className="text-xs text-ink-300">Clear</span>
                    )}
                    {(r.flagsJson ?? []).slice(0, 4).map((f) => (
                      <Badge key={f.code} tone="warn">
                        {flagLabel(f.code)}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="text-right">
                  <Link className="ui-btn-secondary ui-btn-sm" href={`/oasis/${r.id}`}>
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
