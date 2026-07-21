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
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const EPISODE_DEMO = '00000000-0000-4000-8000-000000000041';

type Pkg = {
  id: string;
  title: string;
  docType: string;
  status: string;
  physicianName: string;
  physicianEmail?: string | null;
  episodeId: string;
  dueAt: string | null;
  overdue?: boolean;
  patientLabel?: string;
  updatedAt?: string;
  sentAt?: string | null;
};

function docTypeLabel(t: string) {
  const map: Record<string, string> = {
    plan_of_care_485: 'Plan of care (485)',
    physician_order: 'Physician order',
    verbal_order: 'Verbal order',
    f2f_encounter: 'Face-to-face',
    hospice_cert: 'Hospice certification',
    hospice_recert: 'Hospice recertification',
    other: 'Other',
  };
  return map[t] ?? t.replace(/_/g, ' ');
}

function statusLabel(status: string): { label: string; tone: 'neutral' | 'brand' | 'success' | 'warn' | 'danger' } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'ready':
      return { label: 'Ready to send', tone: 'brand' };
    case 'sent':
      return { label: 'Waiting on physician', tone: 'warn' };
    case 'viewed':
      return { label: 'Physician opened', tone: 'warn' };
    case 'signed':
      return { label: 'Signed', tone: 'success' };
    case 'rejected':
      return { label: 'Returned by physician', tone: 'danger' };
    case 'expired':
      return { label: 'Link expired', tone: 'danger' };
    case 'void':
      return { label: 'Voided', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

function daysWaiting(pkg: Pkg): number | null {
  const raw = pkg.sentAt || pkg.updatedAt || pkg.dueAt;
  if (!raw) return null;
  const ms = Date.now() - new Date(raw).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function agingLabel(pkg: Pkg): string | null {
  if (pkg.overdue) return 'Overdue — blocks billing';
  const d = daysWaiting(pkg);
  if (d == null) return null;
  if (pkg.status === 'sent' || pkg.status === 'viewed') {
    if (d === 0) return 'Sent today';
    if (d === 1) return 'Waiting 1 day';
    return `Waiting ${d} days`;
  }
  if (pkg.status === 'ready') return 'Not sent yet';
  if (pkg.status === 'rejected') return 'Needs a new send';
  return null;
}

export default function OrdersPage() {
  const [items, setItems] = useState<Pkg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'chase' | 'ready' | 'overdue'>('chase');
  const [form, setForm] = useState({
    episodeId: EPISODE_DEMO,
    docType: 'plan_of_care_485',
    title: 'Plan of care / 485',
    physicianName: 'Dr. Pat Provider',
    physicianNpi: '1234567893',
    physicianEmail: 'physician@demo.local',
  });

  const token = typeof window !== 'undefined' ? getToken() : null;

  const load = useCallback(async () => {
    if (!token) {
      setError('Sign in to manage physician signatures.');
      return;
    }
    const res = await fetch(`${API_URL}/v1/worklists/orders-signatures`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not load signature queue.');
      return;
    }
    setItems(data.data ?? []);
    setError(null);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const overdue = items.filter((p) => p.overdue).length;
    const waiting = items.filter((p) => p.status === 'sent' || p.status === 'viewed').length;
    const ready = items.filter((p) => p.status === 'ready' || p.status === 'rejected').length;
    const draft = items.filter((p) => p.status === 'draft').length;
    return { overdue, waiting, ready, draft, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    let list = [...items];
    if (filter === 'overdue') list = list.filter((p) => p.overdue);
    else if (filter === 'ready') list = list.filter((p) => p.status === 'ready' || p.status === 'rejected' || p.status === 'draft');
    else if (filter === 'chase')
      list = list.filter((p) =>
        ['ready', 'sent', 'viewed', 'rejected', 'draft'].includes(p.status),
      );
    // Urgency sort: overdue first, then viewed, sent, ready, rejected, draft
    const rank = (p: Pkg) => {
      if (p.overdue) return 0;
      if (p.status === 'viewed') return 1;
      if (p.status === 'sent') return 2;
      if (p.status === 'rejected') return 3;
      if (p.status === 'ready') return 4;
      if (p.status === 'draft') return 5;
      return 6;
    };
    list.sort((a, b) => rank(a) - rank(b));
    return list;
  }, [items, filter]);

  async function createPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSignUrl(null);
    setError(null);
    const res = await fetch(`${API_URL}/v1/order-packages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not create package.');
      return;
    }
    const readyRes = await fetch(`${API_URL}/v1/order-packages/${data.id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!readyRes.ok) {
      const r = await readyRes.json();
      setError(r.error?.message ?? 'Could not mark ready.');
      return;
    }
    setMsg('Package created and ready to send to the physician.');
    setFilter('ready');
    await load();
  }

  async function send(id: string) {
    if (!token) return;
    setError(null);
    const res = await fetch(`${API_URL}/v1/order-packages/${id}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiresInHours: 168,
        noteToPhysician: 'Please review and sign at your earliest convenience. Thank you.',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not send for signature.');
      return;
    }
    setSignUrl(data.signUrl ?? null);
    setMsg('Signature link ready — share it with the physician.');
    await load();
  }

  async function externalSign(id: string) {
    if (!token) return;
    setError(null);
    const res = await fetch(`${API_URL}/v1/order-packages/${id}/record-external-sign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'external_attested',
        signerTypedName: 'Dr. Pat Provider',
        note: 'Signed copy received (fax / in person)',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not record signature.');
      return;
    }
    setMsg('Signature recorded. This package no longer blocks billing.');
    await load();
  }

  async function copyLink() {
    if (!signUrl) return;
    try {
      await navigator.clipboard.writeText(signUrl);
      setMsg('Link copied — paste it into email or text to the physician.');
    } catch {
      setMsg('Copy the link from the box below and send it to the physician.');
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Records"
        title="Physician signatures"
        description="Unsigned orders, plans of care, and certifications are the top reason claims get stuck. Chase what’s waiting, send what’s ready."
        actions={
          <Link href="/billing">
            <Button variant="secondary" size="sm">
              Billing readiness
            </Button>
          </Link>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      {signUrl && (
        <Alert tone="success">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold">Signature link ready</div>
              <a className="ui-link break-all text-xs" href={signUrl} target="_blank" rel="noreferrer">
                {signUrl}
              </a>
            </div>
            <Button size="sm" onClick={() => void copyLink()}>
              Copy link
            </Button>
          </div>
        </Alert>
      )}

      {/* Urgency summary */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft transition hover:shadow-card ${
            filter === 'overdue' ? 'border-red-300 ring-2 ring-red-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-red-600">Overdue</div>
          <div className="font-display text-2xl font-semibold text-ink-900">{counts.overdue}</div>
          <div className="text-xs text-ink-500">Past due — blocks billing</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('chase')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft transition hover:shadow-card ${
            filter === 'chase' ? 'border-teal-300 ring-2 ring-teal-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-amber-700">
            Waiting on physician
          </div>
          <div className="font-display text-2xl font-semibold text-ink-900">{counts.waiting}</div>
          <div className="text-xs text-ink-500">Sent or opened, not signed</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('ready')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft transition hover:shadow-card ${
            filter === 'ready' ? 'border-teal-300 ring-2 ring-teal-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-teal-700">
            Ready to send
          </div>
          <div className="font-display text-2xl font-semibold text-ink-900">{counts.ready}</div>
          <div className="text-xs text-ink-500">Prepared — not yet with physician</div>
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-xl border bg-white px-4 py-3 text-left shadow-soft transition hover:shadow-card ${
            filter === 'all' ? 'border-ink-300 ring-2 ring-ink-100' : 'border-ink-100'
          }`}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Open total</div>
          <div className="font-display text-2xl font-semibold text-ink-900">{counts.total}</div>
          <div className="text-xs text-ink-500">Everything still unsigned</div>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chase list */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              {filter === 'overdue'
                ? 'Overdue — chase first'
                : filter === 'ready'
                  ? 'Ready to send'
                  : filter === 'chase'
                    ? 'Needs attention'
                    : 'All open packages'}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing in this queue"
                body="When orders or plans of care need a signature, they’ll show up here."
              />
            </Card>
          ) : (
            visible.map((p) => {
              const st = statusLabel(p.status);
              const aging = agingLabel(p);
              const canSend = ['ready', 'sent', 'viewed', 'rejected'].includes(p.status);
              const canWetInk = !['signed', 'void'].includes(p.status);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border bg-white p-4 shadow-soft ${
                    p.overdue ? 'border-red-200 ring-1 ring-red-50' : 'border-ink-100'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{p.title}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {p.overdue && <Badge tone="danger">Overdue</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-ink-600">
                        {docTypeLabel(p.docType)}
                        <span className="text-ink-300"> · </span>
                        {p.physicianName}
                        {p.patientLabel ? (
                          <>
                            <span className="text-ink-300"> · </span>
                            Patient {p.patientLabel}
                          </>
                        ) : null}
                      </p>
                      {aging && (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            p.overdue ? 'text-red-600' : 'text-ink-500'
                          }`}
                        >
                          {aging}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSend && (
                        <Button size="sm" onClick={() => void send(p.id)}>
                          {p.status === 'ready' || p.status === 'rejected' ? 'Send' : 'Resend'}
                        </Button>
                      )}
                      {canWetInk && (
                        <Button size="sm" variant="secondary" onClick={() => void externalSign(p.id)}>
                          Record signed copy
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create */}
        <Card className="lg:col-span-2 h-fit">
          <h2 className="ui-section-title mb-1">New signature request</h2>
          <p className="mb-4 text-sm text-ink-500">
            Prepare a plan of care, order, or cert, then send it to the physician.
          </p>
          <form onSubmit={(e) => void createPackage(e)} className="space-y-3">
            <Field label="Episode" hint="Demo episode is pre-filled">
              <Input
                className="font-mono text-xs"
                value={form.episodeId}
                onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                required
              />
            </Field>
            <Field label="Document">
              <Select
                value={form.docType}
                onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}
              >
                <option value="plan_of_care_485">Plan of care (485)</option>
                <option value="physician_order">Physician order</option>
                <option value="verbal_order">Verbal order</option>
                <option value="f2f_encounter">Face-to-face</option>
                <option value="hospice_cert">Hospice certification</option>
                <option value="hospice_recert">Hospice recertification</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Physician name">
              <Input
                value={form.physicianName}
                onChange={(e) => setForm((f) => ({ ...f, physicianName: e.target.value }))}
              />
            </Field>
            <Field label="Physician email">
              <Input
                type="email"
                value={form.physicianEmail}
                onChange={(e) => setForm((f) => ({ ...f, physicianEmail: e.target.value }))}
              />
            </Field>
            <Button type="submit" className="w-full">
              Create & prepare to send
            </Button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-ink-400">
            Lumina never signs for a physician. You send a secure link or record a signed copy you
            already received.
          </p>
        </Card>
      </div>
    </div>
  );
}
