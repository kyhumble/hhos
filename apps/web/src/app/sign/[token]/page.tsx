'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Button, Field, Input } from '@/components/ui';

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

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ink-100 via-white to-brand-50" />
      <div className="relative w-full max-w-lg space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-sm font-bold text-white">
            HH
          </div>
          <h1 className="text-xl font-semibold text-ink-950">Provider signature</h1>
          <p className="mt-1 text-sm text-ink-500">
            Secure link for orders and plan of care. Limited patient identifiers only.
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {done && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-soft">
            <div className="text-lg font-semibold text-emerald-900">Thank you</div>
            <p className="mt-2 text-sm text-emerald-800">{done}</p>
          </div>
        )}

        {peek && !done && (
          <div className="ui-card-pad space-y-4 shadow-card">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="ui-label">Agency</div>
                <div className="font-semibold text-ink-900">{peek.organizationName}</div>
              </div>
              <div>
                <div className="ui-label">Patient (minimal)</div>
                <div className="font-semibold text-ink-900">
                  Initials {peek.patientInitials}
                  {peek.patientDobYear ? ` · YOB ${peek.patientDobYear}` : ''}
                </div>
              </div>
            </div>
            <div>
              <div className="ui-label">Document</div>
              <div className="font-semibold text-ink-900">{peek.title}</div>
              <div className="text-xs text-ink-500">{peek.docType}</div>
            </div>
            {peek.noteToPhysician && (
              <div className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
                {peek.noteToPhysician}
              </div>
            )}
            <p className="text-xs leading-relaxed text-ink-500">{peek.disclaimer}</p>

            {!peek.alreadyDecided ? (
              <>
                <Field label="Typed legal name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Credentials">
                  <Input value={credentials} onChange={(e) => setCredentials(e.target.value)} />
                </Field>
                <label className="flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50/50 p-3 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={attestation}
                    onChange={(e) => setAttestation(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-700"
                  />
                  <span>
                    I attest I am the named physician/NPP (or authorized to sign) and that this
                    electronic signature is legally binding for this order / plan of care.
                  </span>
                </label>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => void decide('signed')}>
                    Sign
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => void decide('rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <Alert tone="info">This request was already {peek.status}.</Alert>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
