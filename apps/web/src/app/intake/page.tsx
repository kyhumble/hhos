'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  socUrgency,
  statusTone,
} from '@/components/ui';
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
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Not logged in. Sign in with a demo account first.');
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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter && item.intakeStatus !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const hay = `${item.patientLastName} ${item.patientFirstName} ${item.mrn}`.toLowerCase();
      return hay.includes(query);
    });
  }, [items, q, statusFilter]);

  const overdue = items.filter((i) => {
    if (!i.socDueAt) return false;
    return new Date(i.socDueAt).getTime() < Date.now();
  }).length;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Clinical"
        title="Intake worklist"
        description="Prioritized by SOC risk. Open an episode for checklist, consents, and OASIS."
        actions={
          <Link href="/patients/new">
            <Button>New patient</Button>
          </Link>
        }
      />

      {error && <Alert tone="warn">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">Open</div>
          <div className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {loading ? '—' : items.length}
          </div>
        </div>
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            SOC overdue
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-red-700">
            {loading ? '—' : overdue}
          </div>
        </div>
        <div className="ui-card-pad">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            Showing
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {loading ? '—' : filtered.length}
          </div>
        </div>
      </div>

      <div className="ui-toolbar">
        <Input
          className="max-w-xs"
          placeholder="Search name or MRN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          className="w-auto min-w-[9rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pre_admit">pre_admit</option>
          <option value="active">active</option>
          <option value="incomplete">incomplete</option>
          <option value="complete">complete</option>
        </Select>
        <div className="ml-auto text-xs text-ink-400">
          {filtered.length} of {items.length}
        </div>
      </div>

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
                <th>SOC</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const name = `${item.patientLastName}, ${item.patientFirstName}`;
                const urg = socUrgency(item.socDueAt);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} />
                        <div className="min-w-0">
                          <Link
                            href={`/episodes/${item.id}`}
                            className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
                          >
                            {name}
                          </Link>
                          <Link
                            href={`/patients/${item.patientId}`}
                            className="text-2xs text-ink-400 hover:text-brand-600"
                          >
                            Chart
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-ink-500">{item.mrn}</td>
                    <td>
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(item.intakeStatus)}>{item.intakeStatus}</Badge>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        <Badge tone={urg.tone}>{urg.label}</Badge>
                        <div className="text-2xs text-ink-500">
                          {item.socDueAt
                            ? new Date(item.socDueAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : '—'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex max-w-[10rem] flex-wrap gap-1">
                        {(item.flags ?? []).length === 0 && (
                          <span className="text-xs text-ink-300">—</span>
                        )}
                        {(item.flags ?? []).slice(0, 3).map((f) => (
                          <Badge key={f} tone="warn">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <Link href={`/episodes/${item.id}`} className="ui-btn-secondary ui-btn-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !error && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title={items.length === 0 ? 'No intake episodes' : 'No matches'}
                      body={
                        items.length === 0
                          ? 'Create a patient, then start intake from their chart.'
                          : 'Try a different search or filter.'
                      }
                      action={
                        items.length === 0 ? (
                          <Link href="/patients/new">
                            <Button size="sm">New patient</Button>
                          </Link>
                        ) : undefined
                      }
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
