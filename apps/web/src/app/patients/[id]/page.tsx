'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Badge, Card, EmptyState, PageHeader, statusTone } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  const id = params.id as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('hhos_token');
    if (!token) {
      setError('Not logged in.');
      return;
    }
    fetch(`${API_URL}/v1/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? 'Failed to load patient');
          return;
        }
        setPatient(data);
      })
      .catch(() => setError('API unreachable'));
  }, [id]);

  return (
    <div className="ui-page">
      <div>
        <Link href="/intake" className="ui-link text-sm">
          ← Intake
        </Link>
      </div>

      {error && <Alert tone="warn">{error}</Alert>}

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
