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

type Pkg = {
  id: string;
  title: string;
  docType: string;
  status: string;
  physicianName: string;
  episodeId: string;
  dueAt: string | null;
  overdue?: boolean;
  patientLabel?: string;
};

export default function OrdersPage() {
  const [items, setItems] = useState<Pkg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    episodeId: EPISODE_DEMO,
    docType: 'plan_of_care_485',
    title: 'Plan of Care / CMS-485 — demo',
    physicianName: 'Dr. Pat Provider',
    physicianNpi: '1234567893',
    physicianEmail: 'physician@demo.local',
  });

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function load() {
    if (!token) {
      setError('Login as coord or lead (order:read).');
      return;
    }
    const res = await fetch(`${API_URL}/v1/worklists/orders-signatures`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Load failed (FEATURE_ORDERS_ESIGN?)');
      return;
    }
    setItems(data.data ?? []);
    setError(null);
    if (data.disclaimer) setMsg(data.disclaimer);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSignUrl(null);
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
      setError(data.error?.message ?? 'Create failed');
      return;
    }
    const readyRes = await fetch(`${API_URL}/v1/order-packages/${data.id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!readyRes.ok) {
      const r = await readyRes.json();
      setError(r.error?.message ?? 'mark-ready failed');
      return;
    }
    setMsg(`Created package — marked ready (demo stub PDF).`);
    await load();
  }

  async function send(id: string) {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/order-packages/${id}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiresInHours: 168,
        noteToPhysician: 'Please review and sign the attached plan of care / orders.',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Send failed');
      return;
    }
    setSignUrl(data.signUrl ?? null);
    setMsg('Sent for signature — share the link with the physician (email TBD).');
    await load();
  }

  async function externalSign(id: string) {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/order-packages/${id}/record-external-sign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'external_attested',
        signerTypedName: 'Dr. Pat Provider',
        note: 'Wet-ink signed fax received (demo)',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'External sign failed');
      return;
    }
    setMsg('External signature recorded.');
    await load();
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Compliance"
        title="Orders & 485 signatures"
        description="Create packages, send secure sign links, or record wet-ink. Never auto-sign."
      />

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}
      {signUrl && (
        <Alert tone="success">
          Provider sign link:{' '}
          <a className="ui-link break-all" href={signUrl} target="_blank" rel="noreferrer">
            {signUrl}
          </a>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="ui-section-title mb-4">New package</h2>
          <form onSubmit={(e) => void createPackage(e)} className="space-y-3">
            <Field label="Episode ID">
              <Input
                className="font-mono text-xs"
                value={form.episodeId}
                onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                required
              />
            </Field>
            <Field label="Document type">
              <Select
                value={form.docType}
                onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}
              >
                <option value="plan_of_care_485">CMS-485 / Plan of care</option>
                <option value="physician_order">Physician order</option>
                <option value="verbal_order">Verbal order</option>
                <option value="f2f_encounter">Face-to-face</option>
                <option value="hospice_cert">Hospice cert</option>
                <option value="hospice_recert">Hospice recert</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Physician">
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
              Create & mark ready
            </Button>
          </form>
        </Card>

        <div className="ui-table-wrap lg:col-span-3">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="ui-section-title">Open packages</h2>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Physician</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-ink-900">{p.title}</div>
                    {p.overdue && (
                      <span className="text-[11px] font-semibold text-red-600">OVERDUE</span>
                    )}
                  </td>
                  <td className="text-xs text-ink-500">{p.docType}</td>
                  <td className="text-sm">{p.physicianName}</td>
                  <td>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {['ready', 'sent', 'viewed', 'rejected'].includes(p.status) && (
                        <Button size="sm" variant="secondary" onClick={() => void send(p.id)}>
                          Send
                        </Button>
                      )}
                      {!['signed', 'void'].includes(p.status) && (
                        <Button size="sm" variant="ghost" onClick={() => void externalSign(p.id)}>
                          Wet-ink
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="No open packages"
                      body="Create a 485 or order package to chase physician signatures."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
