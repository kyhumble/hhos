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
  statusTone,
} from '@/components/ui';
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
    setMsg('Draft election created with hospice episode.');
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
    setMsg('Cert package ready — open Orders / 485 to send for e-sign.');
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
    <div className="ui-page">
      <PageHeader
        eyebrow="Hospice"
        title="Elections & levels of care"
        description="Benefit elections, LOC changes, and cert packages via physician e-sign."
      />

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="ui-section-title mb-4">New election</h2>
          <form onSubmit={(e) => void createElection(e)} className="space-y-3">
            <Field label="Patient ID">
              <Input
                className="font-mono text-xs"
                value={form.patientId}
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Election date">
                <Input
                  type="date"
                  value={form.electionDate}
                  onChange={(e) => setForm((f) => ({ ...f, electionDate: e.target.value }))}
                />
              </Field>
              <Field label="Effective">
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Attending physician">
              <Input
                value={form.attendingPhysicianName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, attendingPhysicianName: e.target.value }))
                }
              />
            </Field>
            <Field label="Terminal DX (ICD-10)">
              <Input
                value={form.terminalDxIcd10}
                onChange={(e) => setForm((f) => ({ ...f, terminalDxIcd10: e.target.value }))}
              />
            </Field>
            <Button type="submit" className="w-full">
              Create draft election
            </Button>
          </form>
        </Card>

        <div className="ui-table-wrap lg:col-span-3">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="ui-section-title">Open elections</h2>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Status</th>
                <th>LOC</th>
                <th>Cert</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="font-medium">{e.patientName ?? e.id.slice(0, 8)}</div>
                    <div className="text-xs text-ink-500">{e.attendingPhysicianName}</div>
                  </td>
                  <td>
                    <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                  </td>
                  <td className="text-sm">{e.currentLoc ?? '—'}</td>
                  <td>
                    {e.certUnsigned ? (
                      <Badge tone="warn">Unsigned</Badge>
                    ) : (
                      <Badge tone="success">Linked</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {e.status === 'draft' && (
                        <Button size="sm" onClick={() => void activate(e.id)}>
                          Activate
                        </Button>
                      )}
                      {(e.status === 'draft' || e.status === 'active') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void requestCert(e.id)}
                        >
                          Cert
                        </Button>
                      )}
                      {e.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void changeLoc(e.id, 'continuous')}
                          >
                            Continuous
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void changeLoc(e.id, 'routine')}
                          >
                            Routine
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No open hospice elections" />
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
