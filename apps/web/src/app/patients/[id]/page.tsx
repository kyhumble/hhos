'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  statusTone,
} from '@/components/ui';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';
import { forceReLogin } from '@/lib/auth';

type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  status: string;
  capacityStatus: string;
  preferredLanguage: string;
  addresses?: { type: string; line1: string; city: string; state: string }[];
  contacts?: { type: string; fullName: string; relationship: string | null }[];
};

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [reason, setReason] = useState('Home health / wound care referral (demo)');
  const [dx, setDx] = useState('L97.909');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Not logged in.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/patients/${id}`, {
        headers: authHeaders(token),
      });
      if (res.status === 401) {
        forceReLogin('session');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to load patient');
        return;
      }
      setPatient(data);
      setError(null);
    } catch {
      setError('API unreachable');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Create referral for this patient and accept it → pre-admit episode on intake worklist.
   */
  async function startIntake() {
    const token = getToken();
    if (!token) {
      forceReLogin('required');
      return;
    }
    setStarting(true);
    setMsg(null);
    setError(null);
    try {
      const createRes = await fetch(`${API_URL}/v1/referrals`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
          'Idempotency-Key': `web-start-intake-${id}-${Date.now()}`,
        },
        body: JSON.stringify({
          patientId: id,
          sourceType: 'hospital',
          sourceName: 'Demo Hospital Discharge',
          acuity: 'routine',
          reasonForReferral: reason.trim() || 'Wound care / home health referral',
          primaryDiagnosisIcd10: dx.trim() || undefined,
          primaryDiagnosisText: 'Demo primary diagnosis',
          requestedServices: ['wound', 'skilled_nursing'],
        }),
      });

      if (createRes.status === 401) {
        forceReLogin('session');
        return;
      }
      if (!createRes.ok) {
        const err = await readApiError(createRes);
        setError(err.message);
        return;
      }
      const referral = (await createRes.json()) as { id: string };

      const acceptRes = await fetch(`${API_URL}/v1/referrals/${referral.id}/accept`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      if (acceptRes.status === 401) {
        forceReLogin('session');
        return;
      }
      if (!acceptRes.ok) {
        const err = await readApiError(acceptRes);
        setError(err.message);
        return;
      }
      const accepted = (await acceptRes.json()) as {
        episode?: { id: string };
        referral?: { id: string };
      };
      const episodeId = accepted.episode?.id;
      setMsg('Referral accepted — episode created on intake worklist.');
      if (episodeId) {
        router.push(`/episodes/${episodeId}`);
        return;
      }
      router.push('/intake');
    } catch {
      setError('API unreachable');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="ui-page">
      <div>
        <Link href="/intake" className="ui-link text-sm">
          ← Intake
        </Link>
      </div>

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      {patient && (
        <>
          <PageHeader
            eyebrow="Patient"
            title={`${patient.lastName}, ${patient.firstName}`}
            description={`MRN ${patient.mrn} · DOB ${patient.dob} · lang ${patient.preferredLanguage}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <Badge tone={statusTone(patient.status)}>{patient.status}</Badge>
                <Badge tone="neutral">capacity {patient.capacityStatus}</Badge>
              </div>
            }
          />

          <Card className="border-brand-200/70 bg-gradient-to-br from-brand-50/80 to-white">
            <h2 className="ui-section-title mb-1">Start intake episode</h2>
            <p className="mb-4 text-sm text-ink-500">
              Creates a referral for this patient and accepts it into a pre-admit episode (checklist,
              consents, SOC tracking).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Reason for referral">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Field label="Primary DX ICD-10 (optional)">
                <Input
                  className="font-mono"
                  value={dx}
                  onChange={(e) => setDx(e.target.value)}
                  placeholder="L97.909"
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void startIntake()} disabled={starting}>
                {starting ? 'Starting…' : 'Create referral & open episode'}
              </Button>
              <Link href="/intake">
                <Button variant="secondary" type="button">
                  Intake worklist
                </Button>
              </Link>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="ui-section-title mb-3">Addresses</h2>
              {(patient.addresses ?? []).length === 0 ? (
                <EmptyState title="None on file" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(patient.addresses ?? []).map((a, i) => (
                    <li key={i} className="rounded-lg bg-ink-50 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                        {a.type}
                      </span>
                      <div className="text-ink-800">
                        {a.line1}, {a.city} {a.state}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="ui-section-title mb-3">Contacts</h2>
              {(patient.contacts ?? []).length === 0 ? (
                <EmptyState title="None on file" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(patient.contacts ?? []).map((c, i) => (
                    <li key={i} className="rounded-lg bg-ink-50 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                        {c.type}
                      </span>
                      <div className="text-ink-800">
                        {c.fullName}
                        {c.relationship ? ` · ${c.relationship}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
