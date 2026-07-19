'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Peek = {
  organizationName: string;
  docType: string;
  title: string;
  physicianName: string;
  patientInitials: string;
  patientDobYear: string | null;
  noteToPhysician: string | null;
  status: string;
  expiresAt: string;
  alreadyDecided: boolean;
  disclaimer: string;
};

export default function ProviderSignPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState('MD');
  const [attestation, setAttestation] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const res = await fetch(`${API_URL}/v1/sign/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Invalid link');
        return;
      }
      setPeek(data);
      setName(data.physicianName ?? '');
    })();
  }, [token]);

  async function decide(decision: 'signed' | 'rejected') {
    setError(null);
    if (!attestation) {
      setError('You must check the attestation box.');
      return;
    }
    const res = await fetch(`${API_URL}/v1/sign/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        signerTypedName: name,
        signerCredentials: credentials,
        attestation: true,
        rejectReason: decision === 'rejected' ? 'Declined via portal' : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Sign failed');
      return;
    }
    setDone(data.message ?? 'Recorded');
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm">
        <h1 className="text-lg font-semibold text-emerald-900">Done</h1>
        <p className="mt-2 text-emerald-800">{done}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Provider signature</h1>
      <p className="text-sm text-slate-600">
        Secure link for home health / hospice orders and plan of care. Limited patient identifiers
        only.
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {peek && (
        <div className="rounded-xl border bg-white p-5 space-y-3 text-sm">
          <div>
            <div className="text-xs uppercase text-slate-500">Agency</div>
            <div className="font-medium">{peek.organizationName}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Document</div>
            <div className="font-medium">{peek.title}</div>
            <div className="text-xs text-slate-500">{peek.docType}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Patient (minimal)</div>
            <div>
              Initials {peek.patientInitials}
              {peek.patientDobYear ? ` · YOB ${peek.patientDobYear}` : ''}
            </div>
          </div>
          {peek.noteToPhysician && (
            <div className="rounded bg-slate-50 p-2 text-slate-700">{peek.noteToPhysician}</div>
          )}
          <p className="text-xs text-slate-500">{peek.disclaimer}</p>
          {!peek.alreadyDecided && (
            <>
              <label className="block">
                Typed legal name
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                Credentials
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                />
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={attestation}
                  onChange={(e) => setAttestation(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I attest I am the named physician/NPP (or authorized to sign) and that this
                  electronic signature is intended to be legally binding for this order / plan of
                  care.
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-white"
                  onClick={() => void decide('signed')}
                >
                  Sign
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  onClick={() => void decide('rejected')}
                >
                  Reject
                </button>
              </div>
            </>
          )}
          {peek.alreadyDecided && (
            <div className="text-slate-600">This request was already {peek.status}.</div>
          )}
        </div>
      )}
    </div>
  );
}
