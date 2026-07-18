'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ChecklistItem = {
  id: string;
  code: string;
  required: boolean;
  status: string;
};

type Template = {
  id: string;
  consentType: string;
  title: string;
  version: number;
  locale: string;
};

type Episode = {
  id: string;
  status: string;
  intakeStatus: string;
  careType: string;
  socDueAt: string | null;
  f2fStatus: string;
  ordersStatus: string;
  primaryDxIcd10: string | null;
  patientId: string;
  flags: string[];
  checklist: ChecklistItem[];
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    capacityStatus: string;
  };
};

export default function EpisodeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [consentForm, setConsentForm] = useState({
    templateId: '',
    signerName: '',
    typedName: '',
    signerType: 'patient' as 'patient' | 'surrogate',
    signerRelationship: '',
  });
  const [saving, setSaving] = useState(false);
  /** Stable per form session so retries replay instead of duplicating consents */
  const [consentIdempotencyKey] = useState(
    () =>
      `web-${id}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)}`,
  );
  const [episodePatch, setEpisodePatch] = useState({
    f2fStatus: '',
    ordersStatus: '',
    primaryDxIcd10: '',
  });

  const token = () =>
    typeof window !== 'undefined' ? window.localStorage.getItem('hhos_token') : null;

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      setError('Not logged in. Use /login first.');
      return;
    }
    try {
      const [epRes, tplRes] = await Promise.all([
        fetch(`${API_URL}/v1/episodes/${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
        fetch(`${API_URL}/v1/consent-templates?locale=en`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
      ]);
      const epData = await epRes.json();
      const tplData = await tplRes.json();
      if (!epRes.ok) {
        setError(epData.error?.message ?? 'Failed to load episode');
        return;
      }
      setEpisode(epData);
      setEpisodePatch({
        f2fStatus: epData.f2fStatus ?? '',
        ordersStatus: epData.ordersStatus ?? '',
        primaryDxIcd10: epData.primaryDxIcd10 ?? '',
      });
      if (epData.patient) {
        setConsentForm((f) => ({
          ...f,
          signerName: `${epData.patient.firstName} ${epData.patient.lastName}`,
          typedName: `${epData.patient.firstName} ${epData.patient.lastName}`,
          signerType:
            epData.patient.capacityStatus === 'impaired' ? 'surrogate' : 'patient',
        }));
      }
      setTemplates(tplData.data ?? []);
      if (!consentForm.templateId && tplData.data?.[0]) {
        setConsentForm((f) => ({ ...f, templateId: tplData.data[0].id }));
      }
    } catch {
      setError('API unreachable');
    }
  }, [id, consentForm.templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEpisodePatch(e: React.FormEvent) {
    e.preventDefault();
    const t = token();
    if (!t || !episode) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/episodes/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          f2fStatus: episodePatch.f2fStatus || undefined,
          ordersStatus: episodePatch.ordersStatus || undefined,
          primaryDxIcd10: episodePatch.primaryDxIcd10 || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error?.message ?? 'Update failed');
        return;
      }
      setEpisode(data);
      setMsg('Episode updated; checklist recomputed.');
    } catch {
      setMsg('API unreachable');
    } finally {
      setSaving(false);
    }
  }

  async function captureConsent(e: React.FormEvent) {
    e.preventDefault();
    const t = token();
    if (!t || !episode) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/patients/${episode.patientId}/consents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${consentIdempotencyKey}-${consentForm.templateId}`,
        },
        body: JSON.stringify({
          templateId: consentForm.templateId,
          episodeId: episode.id,
          captureMethod: 'onscreen',
          signerType: consentForm.signerType,
          signerName: consentForm.signerName,
          signerRelationship:
            consentForm.signerType === 'surrogate'
              ? consentForm.signerRelationship || 'surrogate'
              : undefined,
          patientPresent: true,
          localeUsed: 'en',
          signature: {
            type: 'typed',
            typedName: consentForm.typedName || consentForm.signerName,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error?.message ?? 'Consent capture failed');
        return;
      }
      setMsg(`Consent signed: ${data.consentType ?? 'ok'}`);
      await load();
    } catch {
      setMsg('API unreachable');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Link href="/intake" className="text-sm text-brand-700 hover:underline">
          ← Intake
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      </div>
    );
  }

  if (!episode) {
    return <p className="text-sm text-slate-500">Loading episode…</p>;
  }

  const p = episode.patient;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/intake" className="text-sm text-brand-700 hover:underline">
          ← Intake worklist
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          {p ? `${p.lastName}, ${p.firstName}` : 'Episode'} · {p?.mrn}
        </h1>
        <p className="text-sm text-slate-600">
          {episode.status} · intake {episode.intakeStatus} · {episode.careType}
          {episode.socDueAt && ` · SOC due ${new Date(episode.socDueAt).toLocaleString()}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {episode.flags.map((f) => (
            <span key={f} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800">
              {f}
            </span>
          ))}
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Intake checklist</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {episode.checklist.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.code}
                {item.required && <span className="ml-1 text-xs text-slate-400">required</span>}
              </span>
              <span
                className={
                  item.status === 'complete'
                    ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800'
                    : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900'
                }
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Episode clinical fields</h2>
        <form onSubmit={saveEpisodePatch} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            F2F status
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={episodePatch.f2fStatus}
              onChange={(e) => setEpisodePatch({ ...episodePatch, f2fStatus: e.target.value })}
            >
              <option value="unknown">unknown</option>
              <option value="scheduled">scheduled</option>
              <option value="completed">completed</option>
              <option value="missing">missing</option>
              <option value="waived_review">waived_review</option>
            </select>
          </label>
          <label className="text-sm">
            Orders status
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={episodePatch.ordersStatus}
              onChange={(e) => setEpisodePatch({ ...episodePatch, ordersStatus: e.target.value })}
            >
              <option value="missing">missing</option>
              <option value="verbal">verbal</option>
              <option value="signed">signed</option>
              <option value="expired">expired</option>
            </select>
          </label>
          <label className="text-sm">
            Primary DX ICD-10
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={episodePatch.primaryDxIcd10}
              onChange={(e) =>
                setEpisodePatch({ ...episodePatch, primaryDxIcd10: e.target.value })
              }
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save & recompute checklist
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Capture consent</h2>
        <p className="mt-1 text-xs text-amber-800">
          Template body text is NOT LEGAL FINAL. Typed signature is acceptable for demo.
        </p>
        <form onSubmit={captureConsent} className="mt-3 space-y-3">
          <label className="block text-sm">
            Template
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={consentForm.templateId}
              onChange={(e) => setConsentForm({ ...consentForm, templateId: e.target.value })}
            >
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.consentType} — {t.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              Signer type
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={consentForm.signerType}
                onChange={(e) =>
                  setConsentForm({
                    ...consentForm,
                    signerType: e.target.value as 'patient' | 'surrogate',
                  })
                }
              >
                <option value="patient">patient</option>
                <option value="surrogate">surrogate</option>
              </select>
            </label>
            <label className="block text-sm">
              Signer name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={consentForm.signerName}
                onChange={(e) => setConsentForm({ ...consentForm, signerName: e.target.value })}
              />
            </label>
          </div>
          {consentForm.signerType === 'surrogate' && (
            <label className="block text-sm">
              Relationship
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={consentForm.signerRelationship}
                onChange={(e) =>
                  setConsentForm({ ...consentForm, signerRelationship: e.target.value })
                }
              />
            </label>
          )}
          <label className="block text-sm">
            Typed signature
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={consentForm.typedName}
              onChange={(e) => setConsentForm({ ...consentForm, typedName: e.target.value })}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Sign consent'}
          </button>
        </form>
      </section>
    </div>
  );
}
