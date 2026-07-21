'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@/components/ui';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';

type Referral = {
  id: string;
  status: string;
  sourceType: string;
  sourceName: string;
  receivedAt: string;
  acuity: string | null;
  completenessScore: number;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  mrn: string;
  reasonForReferral: string;
};

function statusMeta(status: string): {
  label: string;
  tone: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
} {
  switch (status) {
    case 'new':
      return { label: 'New', tone: 'brand' };
    case 'in_review':
      return { label: 'In review', tone: 'warn' };
    case 'accepted':
      return { label: 'Accepted', tone: 'success' };
    case 'converted':
      return { label: 'In intake', tone: 'success' };
    case 'declined':
      return { label: 'Declined', tone: 'danger' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

function sourceLabel(t: string) {
  const map: Record<string, string> = {
    hospital: 'Hospital',
    physician: 'Physician',
    snf: 'SNF / facility',
    self: 'Self / family',
    other: 'Other',
  };
  return map[t] ?? t;
}

function acuityLabel(a: string | null) {
  if (!a || a === 'routine') return null;
  if (a === 'urgent') return 'Urgent';
  if (a === 'expedited') return 'Expedited';
  return a;
}

export default function ReferralsPage() {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    sourceType: 'hospital',
    sourceName: '',
    sourceContact: '',
    acuity: 'routine',
    reasonForReferral: '',
    primaryDiagnosisText: '',
    primaryDiagnosisIcd10: '',
  });

  const token = typeof window !== 'undefined' ? getToken() : null;

  const load = useCallback(async () => {
    if (!token) {
      setError('Sign in to manage referrals.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/referrals`, {
        headers: { ...authHeaders(token) },
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setItems(data.data ?? []);
      setError(null);
    } catch {
      setError('Could not reach the server. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openItems = useMemo(
    () => items.filter((r) => r.status === 'new' || r.status === 'in_review'),
    [items],
  );
  const visible = filter === 'open' ? openItems : items;

  async function createReferral(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setMsg(null);
    const body = {
      patient: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        preferredLanguage: 'en',
      },
      sourceType: form.sourceType,
      sourceName: form.sourceName.trim(),
      sourceContact: form.sourceContact.trim() || undefined,
      acuity: form.acuity,
      reasonForReferral: form.reasonForReferral.trim(),
      primaryDiagnosisText: form.primaryDiagnosisText.trim() || undefined,
      primaryDiagnosisIcd10: form.primaryDiagnosisIcd10.trim() || undefined,
      requestedServices: ['skilled_nursing'],
    };
    try {
      const res = await fetch(`${API_URL}/v1/referrals`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        return;
      }
      setMsg('Referral received. Review and accept to start intake.');
      setShowForm(false);
      setForm({
        firstName: '',
        lastName: '',
        dob: '',
        sourceType: 'hospital',
        sourceName: '',
        sourceContact: '',
        acuity: 'routine',
        reasonForReferral: '',
        primaryDiagnosisText: '',
        primaryDiagnosisIcd10: '',
      });
      setFilter('open');
      await load();
    } catch {
      setError('Could not create referral.');
    }
  }

  async function accept(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/${id}/accept`, {
        method: 'POST',
        headers: { ...authHeaders(token) },
      });
      const data = await res.json();
      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        return;
      }
      const episodeId = data.episode?.id;
      setMsg(
        episodeId
          ? 'Accepted — intake episode started. SOC clock is running.'
          : 'Referral accepted.',
      );
      await load();
      if (episodeId) {
        // Soft navigate hint via message; user can open intake
      }
    } catch {
      setError('Could not accept referral.');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(id: string) {
    if (!token) return;
    const reason = window.prompt('Reason for declining this referral?');
    if (!reason?.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/${id}/decline`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        return;
      }
      setMsg('Referral declined.');
      await load();
    } catch {
      setError('Could not decline referral.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Care"
        title="Referrals"
        description="Take new referrals, review them, and accept to start intake. Declining requires a reason."
        actions={
          <div className="flex gap-2">
            <Link href="/intake">
              <Button variant="secondary" size="sm">
                Intake worklist
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close form' : 'New referral'}
            </Button>
          </div>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter('open')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft ${
            filter === 'open' ? 'border-teal-300 ring-2 ring-teal-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-teal-700">
            Needs decision
          </div>
          <div className="font-display text-2xl font-semibold text-ink-900">{openItems.length}</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft ${
            filter === 'all' ? 'border-ink-300 ring-2 ring-ink-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-500">All</div>
          <div className="font-display text-2xl font-semibold text-ink-900">{items.length}</div>
        </button>
        <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Flow</div>
          <p className="mt-1 text-sm text-ink-600">
            Receive → Accept → Intake → SOC → Orders → Bill
          </p>
        </div>
      </div>

      {showForm && (
        <Card className="border-teal-100">
          <h2 className="ui-section-title mb-1">New referral</h2>
          <p className="mb-4 text-sm text-ink-500">
            Enter the patient and who sent them. Accepting later starts the intake episode and SOC
            clock.
          </p>
          <form onSubmit={(e) => void createReferral(e)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="First name">
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </Field>
              <Field label="Last name">
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Field>
              <Field label="Date of birth">
                <Input
                  required
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Source type">
                <Select
                  value={form.sourceType}
                  onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                >
                  <option value="hospital">Hospital</option>
                  <option value="physician">Physician</option>
                  <option value="snf">SNF / facility</option>
                  <option value="self">Self / family</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Source name">
                <Input
                  required
                  placeholder="e.g. Mercy Hospital case management"
                  value={form.sourceName}
                  onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
                />
              </Field>
              <Field label="Priority">
                <Select
                  value={form.acuity}
                  onChange={(e) => setForm((f) => ({ ...f, acuity: e.target.value }))}
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="expedited">Expedited</option>
                </Select>
              </Field>
            </div>
            <Field label="Source contact (optional)">
              <Input
                placeholder="Phone or email"
                value={form.sourceContact}
                onChange={(e) => setForm((f) => ({ ...f, sourceContact: e.target.value }))}
              />
            </Field>
            <Field label="Reason for referral">
              <Input
                required
                placeholder="Why is home health needed?"
                value={form.reasonForReferral}
                onChange={(e) => setForm((f) => ({ ...f, reasonForReferral: e.target.value }))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary diagnosis (optional)">
                <Input
                  value={form.primaryDiagnosisText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, primaryDiagnosisText: e.target.value }))
                  }
                />
              </Field>
              <Field label="ICD-10 (optional)">
                <Input
                  className="font-mono"
                  placeholder="e.g. I50.9"
                  value={form.primaryDiagnosisIcd10}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, primaryDiagnosisIcd10: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save referral</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">
            {filter === 'open' ? 'Needs a decision' : 'All referrals'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <Card>
            <p className="py-8 text-center text-sm text-ink-500">Loading referrals…</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              title={filter === 'open' ? 'No open referrals' : 'No referrals yet'}
              body="Add a referral to start the intake process, or accept one when it arrives."
              action={
                <Button size="sm" onClick={() => setShowForm(true)}>
                  New referral
                </Button>
              }
            />
          </Card>
        ) : (
          visible.map((r) => {
            const st = statusMeta(r.status);
            const ac = acuityLabel(r.acuity);
            const canDecide = r.status === 'new' || r.status === 'in_review';
            const name = `${r.patientLastName}, ${r.patientFirstName}`;
            return (
              <div
                key={r.id}
                className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900">{name}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {ac && <Badge tone="warn">{ac}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {sourceLabel(r.sourceType)} · {r.sourceName}
                      <span className="text-ink-300"> · </span>
                      MRN {r.mrn}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">{r.reasonForReferral}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      Received{' '}
                      {new Date(r.receivedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canDecide && (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => void accept(r.id)}
                        >
                          Accept & start intake
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void decline(r.id)}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                    <Link href={`/patients/${r.patientId}`}>
                      <Button size="sm" variant="ghost">
                        Patient chart
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Card className="bg-ink-50/40">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-800">How this works.</span> Save a referral when
          it arrives. Accept creates a pre-admit episode and starts the start-of-care clock. From
          there, complete intake, assessments, orders, and billing readiness.
        </p>
      </Card>
    </div>
  );
}
