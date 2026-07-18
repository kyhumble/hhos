'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
    <div className="space-y-4">
      <Link href="/intake" className="text-sm text-brand-700 hover:underline">
        ← Intake
      </Link>
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {patient && (
        <>
          <div>
            <h1 className="text-xl font-semibold">
              {patient.lastName}, {patient.firstName}
            </h1>
            <p className="text-sm text-slate-600">
              MRN {patient.mrn} · DOB {patient.dob} · {patient.status} · capacity{' '}
              {patient.capacityStatus}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-700">Addresses</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(patient.addresses ?? []).map((a, i) => (
                <li key={i}>
                  <span className="text-xs uppercase text-slate-400">{a.type}</span> {a.line1},{' '}
                  {a.city} {a.state}
                </li>
              ))}
              {(patient.addresses ?? []).length === 0 && (
                <li className="text-slate-500">None on file</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
