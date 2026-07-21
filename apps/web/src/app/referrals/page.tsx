'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Textarea,
  statusTone,
} from '@/components/ui';
import { API_URL, authHeaders, getToken } from '@/lib/api';

type ReferralRow = {
  id: string;
  status: string;
  sourceType: string;
  sourceName: string;
  receivedAt: string;
  acuity?: string | null;
  completenessScore: number;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  mrn: string;
  reasonForReferral: string;
};

type Extracted = {
  patient?: { firstName?: string; lastName?: string; dob?: string };
  sourceType?: string;
  sourceName?: string;
  sourceContact?: string;
  acuity?: string;
  reasonForReferral?: string;
  primaryDiagnosisText?: string;
  primaryDiagnosisIcd10?: string;
  externalRef?: string;
  confidence: number;
  factors: string[];
};

const SAMPLE_DOC = `HOME HEALTH REFERRAL
Facility: Memorial Hospital Case Management
Patient Name: Jane Doe
DOB: 03/15/1948
MRN: MH-48291
Primary Diagnosis: Congestive heart failure (I50.9)
Reason for referral: Skilled nursing for medication teaching and home safety after discharge
Referring physician: Dr. Smith
Phone: 405-555-0142
Urgent discharge — please evaluate for home health SOC within 48 hours`;

export default function ReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [docText, setDocText] = useState('');
  const [fileName, setFileName] = useState<string | undefined>();
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [emailSim, setEmailSim] = useState({
    from: 'casemanager@hospital.example',
    subject: 'Home health referral — Jane Doe',
    text: SAMPLE_DOC,
  });

  const [manual, setManual] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    sourceType: 'hospital',
    sourceName: '',
    reasonForReferral: '',
    primaryDiagnosisText: '',
    primaryDiagnosisIcd10: '',
    acuity: 'routine',
  });

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setError('Sign in to manage referrals.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/referrals`, { headers: authHeaders(t) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to load referrals');
        return;
      }
      setRows(data.data ?? []);
      setError(null);
    } catch {
      setError('Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ingestDocument(createDraft = true) {
    const t = getToken();
    if (!t || !docText.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/ingest`, {
        method: 'POST',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: docText,
          fileName: fileName ?? 'pasted-referral.txt',
          createDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Ingest failed');
        return;
      }
      setExtracted(data.extracted ?? null);
      setMsg(data.message ?? 'Extracted');
      if (data.draftCreated) {
        setDocText('');
        await load();
      } else if (data.extracted?.patient) {
        setManual((m) => ({
          ...m,
          firstName: data.extracted.patient.firstName ?? m.firstName,
          lastName: data.extracted.patient.lastName ?? m.lastName,
          dob: data.extracted.patient.dob ?? m.dob,
          sourceType: data.extracted.sourceType ?? m.sourceType,
          sourceName: data.extracted.sourceName ?? m.sourceName,
          reasonForReferral: data.extracted.reasonForReferral ?? m.reasonForReferral,
          primaryDiagnosisText: data.extracted.primaryDiagnosisText ?? m.primaryDiagnosisText,
          primaryDiagnosisIcd10: data.extracted.primaryDiagnosisIcd10 ?? m.primaryDiagnosisIcd10,
          acuity: data.extracted.acuity ?? m.acuity,
        }));
        setShowManual(true);
      }
    } catch {
      setError('Could not ingest document.');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setDocText(text);
  }

  async function runEmailInbound() {
    const t = getToken();
    if (!t) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/email-inbound`, {
        method: 'POST',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSim),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Email ingest failed');
        return;
      }
      setExtracted(data.extracted ?? null);
      setMsg(data.message ?? 'Processed');
      if (data.draftCreated) await load();
    } catch {
      setError('Could not process email.');
    } finally {
      setBusy(false);
    }
  }

  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/referrals`, {
        method: 'POST',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: {
            firstName: manual.firstName,
            lastName: manual.lastName,
            dob: manual.dob,
            preferredLanguage: 'en',
          },
          sourceType: manual.sourceType,
          sourceName: manual.sourceName || 'Manual entry',
          acuity: manual.acuity,
          reasonForReferral: manual.reasonForReferral || 'Referral intake',
          primaryDiagnosisText: manual.primaryDiagnosisText || undefined,
          primaryDiagnosisIcd10: manual.primaryDiagnosisIcd10 || undefined,
          requestedServices: ['skilled_nursing'],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Create failed');
        return;
      }
      setMsg('Referral created');
      setShowManual(false);
      await load();
    } catch {
      setError('Could not create referral.');
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    const t = getToken();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/${id}/accept`, {
        method: 'POST',
        headers: authHeaders(t),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Accept failed');
        return;
      }
      setMsg('Accepted — intake started (SOC clock running)');
      await load();
      if (data.episode?.id) {
        window.location.href = `/episodes/${data.episode.id}`;
      }
    } catch {
      setError('Could not accept referral.');
    } finally {
      setBusy(false);
    }
  }

  async function decline(id: string) {
    const reason = window.prompt('Reason for decline?') || 'Declined by coordinator';
    const t = getToken();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/referrals/${id}/decline`, {
        method: 'POST',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? 'Decline failed');
        return;
      }
      setMsg('Referral declined');
      await load();
    } catch {
      setError('Could not decline.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Care"
        title="Referrals"
        description="Upload or email a referral, extract the details, review, then accept to start intake."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowManual((v) => !v)}>
              {showManual ? 'Hide form' : 'Manual entry'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="ui-kicker">Document upload</div>
          <h2 className="mt-1 text-sm font-semibold text-ink-900">Paste or upload referral text</h2>
          <p className="mt-1 text-sm text-ink-500">
            Discharge summary, fax text, or .txt / .eml body. We extract patient, diagnosis, and source
            for your review — nothing auto-admits.
          </p>
          <div className="mt-3 space-y-3">
            <input
              type="file"
              accept=".txt,.csv,.eml,.md,text/*"
              className="block w-full text-sm text-ink-600"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <Textarea
              rows={8}
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste referral email or discharge summary here…"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || !docText.trim()}
                onClick={() => void ingestDocument(true)}
              >
                Extract & create draft
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !docText.trim()}
                onClick={() => void ingestDocument(false)}
              >
                Extract only
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDocText(SAMPLE_DOC);
                  setFileName('sample-referral.txt');
                }}
              >
                Load sample
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="ui-kicker">Email integration</div>
          <h2 className="mt-1 text-sm font-semibold text-ink-900">Inbound referral email</h2>
          <p className="mt-1 text-sm text-ink-500">
            Forward hospital referral mail to your agency inbox, then POST the body to{' '}
            <code className="rounded bg-ink-50 px-1 text-xs">/v1/referrals/email-inbound</code>.
            Demo simulator below.
          </p>
          <div className="mt-3 space-y-2">
            <Field label="From">
              <Input
                value={emailSim.from}
                onChange={(e) => setEmailSim({ ...emailSim, from: e.target.value })}
              />
            </Field>
            <Field label="Subject">
              <Input
                value={emailSim.subject}
                onChange={(e) => setEmailSim({ ...emailSim, subject: e.target.value })}
              />
            </Field>
            <Field label="Body">
              <Textarea
                rows={5}
                value={emailSim.text}
                onChange={(e) => setEmailSim({ ...emailSim, text: e.target.value })}
              />
            </Field>
            <Button size="sm" disabled={busy} onClick={() => void runEmailInbound()}>
              Simulate inbound email
            </Button>
          </div>
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            Production: point Mailgun/SendGrid inbound parse or Microsoft Graph subscription at this
            endpoint with a service account token. See{' '}
            <Link href="/integrations" className="ui-link">
              Integrations
            </Link>
            .
          </div>
        </Card>
      </div>

      {extracted && (
        <Card className="border-teal-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="ui-kicker">Extraction result</div>
              <p className="mt-0.5 text-sm text-ink-700">
                Confidence {Math.round((extracted.confidence ?? 0) * 100)}% ·{' '}
                {(extracted.factors ?? []).join(', ') || 'no factors'}
              </p>
            </div>
            <Badge tone={extracted.confidence >= 0.6 ? 'success' : 'warn'}>
              {extracted.confidence >= 0.6 ? 'Strong extract' : 'Review carefully'}
            </Badge>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-2xs uppercase text-ink-400">Patient</dt>
              <dd className="font-medium text-ink-900">
                {extracted.patient?.lastName ?? '—'}, {extracted.patient?.firstName ?? '—'} · DOB{' '}
                {extracted.patient?.dob ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase text-ink-400">Source</dt>
              <dd className="font-medium text-ink-900">
                {extracted.sourceName ?? '—'} ({extracted.sourceType ?? '—'})
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase text-ink-400">Diagnosis</dt>
              <dd className="font-medium text-ink-900">
                {extracted.primaryDiagnosisText ?? '—'}{' '}
                {extracted.primaryDiagnosisIcd10 ? (
                  <span className="font-mono text-xs">{extracted.primaryDiagnosisIcd10}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase text-ink-400">Reason</dt>
              <dd className="text-ink-800">{extracted.reasonForReferral ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      )}

      {showManual && (
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Manual referral</h2>
          <form onSubmit={(e) => void createManual(e)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <Input
                required
                value={manual.firstName}
                onChange={(e) => setManual({ ...manual, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name">
              <Input
                required
                value={manual.lastName}
                onChange={(e) => setManual({ ...manual, lastName: e.target.value })}
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                required
                value={manual.dob}
                onChange={(e) => setManual({ ...manual, dob: e.target.value })}
              />
            </Field>
            <Field label="Source type">
              <Select
                value={manual.sourceType}
                onChange={(e) => setManual({ ...manual, sourceType: e.target.value })}
              >
                <option value="hospital">Hospital</option>
                <option value="physician">Physician</option>
                <option value="snf">SNF</option>
                <option value="self">Self</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Source name">
              <Input
                value={manual.sourceName}
                onChange={(e) => setManual({ ...manual, sourceName: e.target.value })}
              />
            </Field>
            <Field label="Acuity">
              <Select
                value={manual.acuity}
                onChange={(e) => setManual({ ...manual, acuity: e.target.value })}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="expedited">Expedited</option>
              </Select>
            </Field>
            <Field label="Reason for referral" className="sm:col-span-2">
              <Textarea
                required
                rows={2}
                value={manual.reasonForReferral}
                onChange={(e) => setManual({ ...manual, reasonForReferral: e.target.value })}
              />
            </Field>
            <Field label="Diagnosis text">
              <Input
                value={manual.primaryDiagnosisText}
                onChange={(e) => setManual({ ...manual, primaryDiagnosisText: e.target.value })}
              />
            </Field>
            <Field label="ICD-10">
              <Input
                className="font-mono"
                value={manual.primaryDiagnosisIcd10}
                onChange={(e) => setManual({ ...manual, primaryDiagnosisIcd10: e.target.value })}
              />
            </Field>
            <div>
              <Button type="submit" disabled={busy}>
                Save referral
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Referral queue</h2>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Source</th>
                <th>Status</th>
                <th>Acuity</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No referrals yet"
                      body="Upload a document, simulate an email, or use manual entry."
                    />
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-ink-900">
                    {r.patientLastName}, {r.patientFirstName}
                    <div className="text-xs font-normal text-ink-400">{r.mrn}</div>
                  </td>
                  <td className="text-sm text-ink-700">
                    {r.sourceName}
                    <div className="text-xs text-ink-400">{r.sourceType}</div>
                  </td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="text-sm capitalize text-ink-600">{r.acuity ?? '—'}</td>
                  <td className="text-sm tabular-nums text-ink-600">
                    {new Date(r.receivedAt).toLocaleString()}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {(r.status === 'new' || r.status === 'in_review') && (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => void accept(r.id)}>
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void decline(r.id)}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {r.status === 'accepted' && (
                        <Link href="/intake" className="ui-link text-sm font-medium">
                          Intake
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
