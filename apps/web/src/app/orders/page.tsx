'use client';

import { useEffect, useState } from 'react';
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
    // Dev: mark ready without PDF so send works without S3 PUT dance
    const readyRes = await fetch(`${API_URL}/v1/order-packages/${data.id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!readyRes.ok) {
      const r = await readyRes.json();
      setError(r.error?.message ?? 'mark-ready failed');
      return;
    }
    setMsg(`Created package ${data.id.slice(0, 8)}… — marked ready (stub PDF for demo).`);
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
    setMsg('Sent for signature — copy link to provider (email delivery TBD).');
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
    setMsg('External signature recorded (wet-ink / fax path).');
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Orders & 485 signatures</h1>
        <p className="text-sm text-slate-600">
          Phase 5 — get physician signatures so episodes stay billing-compliant. HITL only; never
          auto-sign.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}
      {signUrl && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm break-all">
          Provider sign link:{' '}
          <a className="underline text-brand-700" href={signUrl} target="_blank" rel="noreferrer">
            {signUrl}
          </a>
        </div>
      )}

      <form onSubmit={(e) => void createPackage(e)} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">New order / 485 package</h2>
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          value={form.episodeId}
          onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
          placeholder="episodeId"
          required
        />
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.docType}
          onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}
        >
          <option value="plan_of_care_485">plan_of_care_485 (CMS-485)</option>
          <option value="physician_order">physician_order</option>
          <option value="verbal_order">verbal_order</option>
          <option value="f2f_encounter">f2f_encounter</option>
          <option value="hospice_cert">hospice_cert</option>
          <option value="hospice_recert">hospice_recert</option>
        </select>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.physicianName}
          onChange={(e) => setForm((f) => ({ ...f, physicianName: e.target.value }))}
          placeholder="Physician name"
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.physicianEmail}
          onChange={(e) => setForm((f) => ({ ...f, physicianEmail: e.target.value }))}
          placeholder="Physician email"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
          Create & mark ready
        </button>
      </form>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Physician</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  {p.title}
                  {p.overdue && (
                    <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{p.docType}</td>
                <td className="px-3 py-2">{p.physicianName}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  {['ready', 'sent', 'viewed', 'rejected'].includes(p.status) && (
                    <button
                      type="button"
                      className="text-brand-700 text-xs underline"
                      onClick={() => void send(p.id)}
                    >
                      Send for sign
                    </button>
                  )}
                  {!['signed', 'void'].includes(p.status) && (
                    <button
                      type="button"
                      className="text-slate-600 text-xs underline"
                      onClick={() => void externalSign(p.id)}
                    >
                      Record wet-ink
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  No open order packages — create a 485 above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
