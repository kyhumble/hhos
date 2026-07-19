'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const PATIENT_DEMO = '00000000-0000-4000-8000-000000000021';

type Election = {
  id: string;
  status: string;
  patientName?: string;
  attendingPhysicianName: string;
  terminalDxIcd10: string | null;
  effectiveDate: string;
  currentLoc?: string | null;
  certUnsigned?: boolean;
  episodeId: string;
  latestCertPackageId?: string | null;
};

export default function HospicePage() {
  const [items, setItems] = useState<Election[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: PATIENT_DEMO,
    electionDate: new Date().toISOString().slice(0, 10),
    effectiveDate: new Date().toISOString().slice(0, 10),
    attendingPhysicianName: 'Dr. Pat Provider',
    certifyingPhysicianName: 'Dr. Cert Hospice',
    terminalDxIcd10: 'C34.90',
    terminalDxText: 'Malignant neoplasm of lung (demo)',
    placeOfService: 'home',
  });

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function load() {
    if (!token) {
      setError('Login as coord/lead (hospice:read).');
      return;
    }
    const res = await fetch(`${API_URL}/v1/worklists/hospice`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Load failed (FEATURE_HOSPICE?)');
      return;
    }
    setItems(data.data ?? []);
    setError(null);
    if (data.disclaimer) setMsg(data.disclaimer);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createElection(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/hospice/elections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...form, createEpisode: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Create failed');
      return;
    }
    setMsg(`Draft election ${data.id.slice(0, 8)}… created (hospice episode linked).`);
    await load();
  }

  async function activate(id: string) {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/hospice/elections/${id}/activate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ openBenefitPeriod: true, initialLoc: 'routine' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Activate failed');
      return;
    }
    setMsg('Election activated — benefit period 1 open, LOC routine.');
    await load();
  }

  async function requestCert(id: string) {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/hospice/elections/${id}/request-cert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docType: 'hospice_cert',
        markReady: true,
        physicianEmail: 'physician@demo.local',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Cert request failed');
      return;
    }
    setMsg(
      `Cert package ${data.orderPackage?.id?.slice(0, 8)}… ready — open Orders / 485 to send for e-sign.`,
    );
    await load();
  }

  async function changeLoc(id: string, levelOfCare: string) {
    if (!token) return;
    const body: Record<string, string> = { levelOfCare, reason: 'Clinical need (demo)' };
    if (levelOfCare === 'gip' || levelOfCare === 'respite') {
      body.facilityName = 'Demo Inpatient Unit';
    }
    const res = await fetch(`${API_URL}/v1/hospice/elections/${id}/loc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'LOC change failed');
      return;
    }
    setMsg(`LOC → ${levelOfCare}`);
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Hospice</h1>
        <p className="text-sm text-slate-600">
          Phase 6 — elections, benefit periods, levels of care. Physician cert uses Phase 5 e-sign.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      <form onSubmit={(e) => void createElection(e)} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">New hospice election</h2>
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          value={form.patientId}
          onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
          placeholder="patientId"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Election date
            <input
              type="date"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.electionDate}
              onChange={(e) => setForm((f) => ({ ...f, electionDate: e.target.value }))}
            />
          </label>
          <label className="text-xs">
            Effective date
            <input
              type="date"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </label>
        </div>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.attendingPhysicianName}
          onChange={(e) => setForm((f) => ({ ...f, attendingPhysicianName: e.target.value }))}
          placeholder="Attending physician"
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={form.terminalDxIcd10}
          onChange={(e) => setForm((f) => ({ ...f, terminalDxIcd10: e.target.value }))}
          placeholder="Terminal DX ICD-10"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
          Create draft election
        </button>
      </form>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">LOC</th>
              <th className="px-3 py-2 text-left">Cert</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2">
                  {e.patientName ?? e.id.slice(0, 8)}
                  <div className="text-xs text-slate-500">{e.attendingPhysicianName}</div>
                </td>
                <td className="px-3 py-2">{e.status}</td>
                <td className="px-3 py-2">{e.currentLoc ?? '—'}</td>
                <td className="px-3 py-2">
                  {e.certUnsigned ? (
                    <span className="text-amber-700 text-xs font-medium">Unsigned / missing</span>
                  ) : (
                    <span className="text-emerald-700 text-xs">OK / linked</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  {e.status === 'draft' && (
                    <button
                      type="button"
                      className="text-brand-700 text-xs underline"
                      onClick={() => void activate(e.id)}
                    >
                      Activate
                    </button>
                  )}
                  {(e.status === 'draft' || e.status === 'active') && (
                    <button
                      type="button"
                      className="text-brand-700 text-xs underline"
                      onClick={() => void requestCert(e.id)}
                    >
                      Request cert
                    </button>
                  )}
                  {e.status === 'active' && (
                    <>
                      <button
                        type="button"
                        className="text-slate-600 text-xs underline"
                        onClick={() => void changeLoc(e.id, 'continuous')}
                      >
                        → continuous
                      </button>
                      <button
                        type="button"
                        className="text-slate-600 text-xs underline"
                        onClick={() => void changeLoc(e.id, 'routine')}
                      >
                        → routine
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  No open hospice elections
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
