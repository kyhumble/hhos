'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, EmptyState, PageHeader, statusTone } from '@/components/ui';
import { API_URL, getToken } from '@/lib/api';

type WorklistItem = {
  id: string;
  mrn: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  status: string;
  intakeStatus: string;
  socDueAt: string | null;
  flags: string[];
};

export default function IntakePage() {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Not logged in. Use Login with a demo account first.');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/v1/worklists/intake`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? 'Failed to load worklist');
          return;
        }
        setItems(data.data ?? []);
      })
      .catch(() => setError('API unreachable on :3001'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Clinical"
        title="Intake worklist"
        description="Sorted by SOC risk. Open an episode to review checklist and capture consents."
        actions={
          <Link href="/patients/new" className="ui-btn-primary">
            New patient
          </Link>
        }
      />

      {error && <Alert tone="warn">{error}</Alert>}

      <div className="ui-table-wrap">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-ink-500">Loading worklist…</div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>MRN</th>
                <th>Episode</th>
                <th>Intake</th>
                <th>SOC due</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/episodes/${item.id}`} className="ui-link font-semibold">
                      {item.patientLastName}, {item.patientFirstName}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-ink-500">{item.mrn}</td>
                  <td>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(item.intakeStatus)}>{item.intakeStatus}</Badge>
                  </td>
                  <td className="text-xs text-ink-600">
                    {item.socDueAt ? new Date(item.socDueAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(item.flags ?? []).length === 0 && (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                      {(item.flags ?? []).map((f) => (
                        <Badge key={f} tone="warn">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !error && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No intake episodes"
                      body="Create a patient, then use Start intake episode on their chart (referral + accept)."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
