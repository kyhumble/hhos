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
    <div className="ui-page">
      <PageHeader
        eyebrow="Clinical"
        title="OASIS assessments"
        description="PDGM-critical subset. Flags are advisory only — clinician judgment required."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'review' ? 'primary' : 'secondary'}
              onClick={() => setMode('review')}
            >
              In review
            </Button>
            <Button
              size="sm"
              variant={mode === 'all' ? 'primary' : 'secondary'}
              onClick={() => setMode('all')}
            >
              All
            </Button>
          </div>
        }
      />

      {error && <Alert tone="warn">{error}</Alert>}

      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Timepoint</th>
              <th>Status</th>
              <th>Complete</th>
              <th>Flags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title="No assessments"
                    body="Open an episode and create an SOC assessment."
                  />
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-ink-900">{r.timepoint}</td>
                <td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
                <td className="text-sm tabular-nums text-ink-700">{r.completenessScore}%</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(r.flagsJson ?? []).slice(0, 4).map((f) => (
                      <Badge key={f.code} tone="warn">
                        {f.code}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="text-right">
                  <Link className="ui-link text-sm font-medium" href={`/oasis/${r.id}`}>
                    Open
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
