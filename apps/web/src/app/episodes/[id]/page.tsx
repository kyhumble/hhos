'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  statusTone,
} from '@/components/ui';
import { API_URL, authHeaders, getToken } from '@/lib/api';
import { EpisodePhotoGallery } from '@/components/episode-photo-gallery';

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

const PATHWAY = [
  { key: 'referral', label: 'Referral' },
  { key: 'screening', label: 'Screening' },
  { key: 'f2f_consents', label: 'F2F / Consents' },
  { key: 'ready_soc', label: 'Ready for SOC' },
  { key: 'active', label: 'Active' },
] as const;

function checklistLabel(code: string) {
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isDone(item: ChecklistItem) {
  return item.status === 'complete' || item.status === 'done' || item.status === 'signed';
}

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
  const [consentIdempotencyKey] = useState(
    () =>
      `web-${id}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)}`,
  );
  const [episodePatch, setEpisodePatch] = useState({
    f2fStatus: '',
    ordersStatus: '',
    primaryDxIcd10: '',
  });

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setError('Sign in to view this episode.');
      return;
    }
    try {
      const [epRes, tplRes] = await Promise.all([
        fetch(`${API_URL}/v1/episodes/${id}`, { headers: authHeaders(t) }),
        fetch(`${API_URL}/v1/consent-templates?locale=en`, { headers: authHeaders(t) }),
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
        }));
      }
      if (tplRes.ok) {
        setTemplates(tplData.data ?? []);
        if (!consentForm.templateId && tplData.data?.[0]) {
          setConsentForm((f) => ({ ...f, templateId: tplData.data[0].id }));
        }
      }
      setError(null);
    } catch {
      setError('Could not reach the server.');
    }
  }, [id, consentForm.templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checklist = episode?.checklist ?? [];
  const required = checklist.filter((c) => c.required);
  const requiredDone = required.filter(isDone).length;
  const complianceScore =
    required.length === 0 ? 0 : Math.round((requiredDone / required.length) * 100);

  const gates = useMemo(() => {
    if (!episode) return [];
    const items = checklist;
    const has = (code: string) => items.some((i) => i.code === code && isDone(i));
    return [
      {
        id: 'demographics',
        label: 'Demographics & contacts complete',
        ok: has('DEMOGRAPHICS_COMPLETE') || has('SERVICE_ADDRESS'),
      },
      {
        id: 'coverage',
        label: 'Insurance on file (eligibility noted)',
        ok: has('PRIMARY_COVERAGE'),
      },
      {
        id: 'dx',
        label: 'Primary diagnosis (PDGM) present',
        ok: Boolean(episode.primaryDxIcd10) || has('PRIMARY_DX_PRESENT'),
      },
      {
        id: 'homebound',
        label: 'Homebound / skilled need screening',
        ok: has('HISTORY_STARTED') || episode.intakeStatus === 'complete',
      },
      {
        id: 'f2f',
        label: 'F2F encounter valid or plan in window',
        ok:
          episode.f2fStatus === 'completed' ||
          episode.f2fStatus === 'scheduled' ||
          has('F2F_STATUS_KNOWN'),
      },
      {
        id: 'consents',
        label: 'Required consents prepared / signed',
        ok: has('ADMISSION_CONSENT') || has('NPP_ACK'),
      },
      {
        id: 'orders',
        label: 'Orders / 485 path known',
        ok:
          episode.ordersStatus === 'signed' ||
          episode.ordersStatus === 'verbal' ||
          has('ORDERS_STATUS_KNOWN'),
      },
    ];
  }, [episode, checklist]);

  const gatesOk = gates.filter((g) => g.ok).length;
  const readyForSoc = complianceScore >= 70 && gatesOk >= 5;

  const stageIndex = useMemo(() => {
    if (!episode) return 0;
    if (episode.status === 'active') return 4;
    if (readyForSoc || episode.status === 'scheduled_soc') return 3;
    if (episode.f2fStatus !== 'unknown' && episode.f2fStatus !== 'missing') return 2;
    if (episode.intakeStatus !== 'incomplete' || checklist.some(isDone)) return 1;
    return 0;
  }, [episode, readyForSoc, checklist]);

  const socOverdue =
    Boolean(episode?.socDueAt) && new Date(episode!.socDueAt!).getTime() < Date.now();

  async function saveEpisodePatch() {
    const t = getToken();
    if (!t || !episode) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/episodes/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          f2fStatus: episodePatch.f2fStatus || undefined,
          ordersStatus: episodePatch.ordersStatus || undefined,
          primaryDxIcd10: episodePatch.primaryDxIcd10 || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Update failed');
        return;
      }
      setMsg('Episode updated — checklist recomputed.');
      await load();
    } catch {
      setError('Could not save episode.');
    } finally {
      setSaving(false);
    }
  }

  async function captureConsent(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t || !episode) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/patients/${episode.patientId}/consents`, {
        method: 'POST',
        headers: {
          ...authHeaders(t),
          'Content-Type': 'application/json',
          'Idempotency-Key': `${consentIdempotencyKey}-${consentForm.templateId}`,
        },
        body: JSON.stringify({
          templateId: consentForm.templateId,
          episodeId: id,
          captureMethod: 'onscreen',
          signerType: consentForm.signerType,
          signerName: consentForm.signerName,
          signerRelationship:
            consentForm.signerType === 'surrogate'
              ? consentForm.signerRelationship || 'surrogate'
              : undefined,
          signature: {
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
      setError('Could not capture consent.');
    } finally {
      setSaving(false);
    }
  }

  async function startOasis() {
    const t = getToken();
    if (!t) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/oasis/assessments`, {
        method: 'POST',
        headers: { ...authHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: id, timepoint: 'SOC' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not start OASIS');
        return;
      }
      if (data.id) window.location.href = `/oasis/${data.id}`;
      else setMsg('OASIS started.');
    } catch {
      setError('Could not start OASIS.');
    } finally {
      setSaving(false);
    }
  }

  if (!episode && !error) {
    return (
      <div className="ui-page">
        <p className="text-sm text-ink-500">Loading episode…</p>
      </div>
    );
  }

  const name = episode?.patient
    ? `${episode.patient.lastName}, ${episode.patient.firstName}`
    : 'Episode';

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Care · Admission pathway"
        title={name}
        description={
          episode
            ? `MRN ${episode.patient?.mrn ?? '—'} · ${episode.careType.replace(/_/g, ' ')}${
                episode.socDueAt
                  ? ` · SOC due ${new Date(episode.socDueAt).toLocaleString()}`
                  : ''
              }`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/intake">
              <Button size="sm" variant="secondary">
                Intake queue
              </Button>
            </Link>
            <Button size="sm" onClick={() => void startOasis()} disabled={saving}>
              Start SOC OASIS
            </Button>
          </div>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}
      {socOverdue && (
        <Alert tone="error">
          <strong className="font-semibold">SOC overdue.</strong> Start-of-care clock has passed —
          prioritize this episode.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {PATHWAY.map((step, i) => {
          const active = i === stageIndex;
          const done = i < stageIndex;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? 'bg-teal-600 text-white'
                  : done
                    ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-100'
                    : 'bg-ink-50 text-ink-400 ring-1 ring-ink-100'
              }`}
            >
              <span className="tabular-nums opacity-80">{i + 1}</span>
              {step.label}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            Compliance score
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-ink-900">
            {complianceScore}%
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {requiredDone} of {required.length} required checklist items
          </p>
        </Card>
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            Episode status
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={statusTone(episode?.status ?? '')}>
              {(episode?.status ?? '—').replace(/_/g, ' ')}
            </Badge>
            <Badge tone={statusTone(episode?.intakeStatus ?? '')}>
              intake {(episode?.intakeStatus ?? '').replace(/_/g, ' ')}
            </Badge>
          </div>
        </Card>
        <Card className={`!p-4 ${readyForSoc ? 'border-teal-200 bg-teal-50/40' : ''}`}>
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            SOC readiness
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-900">
            {readyForSoc ? 'Ready for SOC' : 'Still screening'}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {gatesOk}/{gates.length} screening gates clear
          </p>
        </Card>
      </div>

      <Card>
        <div className="ui-kicker">Screening gates</div>
        <h2 className="mt-1 text-sm font-semibold text-ink-900">Admission checklist</h2>
        <ul className="mt-3 space-y-2">
          {gates.map((g) => (
            <li key={g.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  g.ok ? 'bg-teal-100 text-teal-800' : 'bg-ink-100 text-ink-400'
                }`}
              >
                {g.ok ? '✓' : '·'}
              </span>
              <span className={g.ok ? 'text-ink-700' : 'text-ink-500'}>{g.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      {episode && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="ui-section-title mb-3">Intake checklist</h2>
              <ul className="space-y-2">
                {episode.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2"
                  >
                    <span className="text-sm text-ink-800">
                      {checklistLabel(item.code)}
                      {item.required && (
                        <span className="ml-1 text-2xs text-ink-400">required</span>
                      )}
                    </span>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </li>
                ))}
                {episode.checklist.length === 0 && (
                  <p className="text-sm text-ink-500">No checklist items yet.</p>
                )}
              </ul>
            </Card>

            <Card>
              <h2 className="ui-section-title mb-3">Clinical / F2F / orders</h2>
              <div className="space-y-3">
                <Field label="F2F status">
                  <Select
                    value={episodePatch.f2fStatus}
                    onChange={(e) =>
                      setEpisodePatch({ ...episodePatch, f2fStatus: e.target.value })
                    }
                  >
                    <option value="unknown">Unknown</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="missing">Missing</option>
                    <option value="waived_review">Waived (review)</option>
                  </Select>
                </Field>
                <Field label="Orders status">
                  <Select
                    value={episodePatch.ordersStatus}
                    onChange={(e) =>
                      setEpisodePatch({ ...episodePatch, ordersStatus: e.target.value })
                    }
                  >
                    <option value="missing">Missing</option>
                    <option value="verbal">Verbal</option>
                    <option value="signed">Signed</option>
                    <option value="expired">Expired</option>
                  </Select>
                </Field>
                <Field label="Primary ICD-10 (PDGM)">
                  <Input
                    className="font-mono"
                    value={episodePatch.primaryDxIcd10}
                    onChange={(e) =>
                      setEpisodePatch({ ...episodePatch, primaryDxIcd10: e.target.value })
                    }
                    placeholder="e.g. I50.9"
                  />
                </Field>
                <Button onClick={() => void saveEpisodePatch()} disabled={saving}>
                  Save & recompute checklist
                </Button>
              </div>
              <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
                <strong>LUPA risk:</strong> delayed SOC and short stays increase LUPA exposure.
                Keep SOC on time and document ongoing skilled need.
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="ui-section-title mb-1">Capture consent</h2>
            <p className="mb-3 text-sm text-ink-500">
              Consent to treat, HIPAA NPP, ROI — tracked for the compliance gate.
            </p>
            <form onSubmit={(e) => void captureConsent(e)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Template">
                <Select
                  value={consentForm.templateId}
                  onChange={(e) => setConsentForm({ ...consentForm, templateId: e.target.value })}
                  required
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} (v{tpl.version})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Signer type">
                <Select
                  value={consentForm.signerType}
                  onChange={(e) =>
                    setConsentForm({
                      ...consentForm,
                      signerType: e.target.value as 'patient' | 'surrogate',
                    })
                  }
                >
                  <option value="patient">Patient</option>
                  <option value="surrogate">Surrogate / decision-maker</option>
                </Select>
              </Field>
              <Field label="Signer name">
                <Input
                  value={consentForm.signerName}
                  onChange={(e) => setConsentForm({ ...consentForm, signerName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Typed signature">
                <Input
                  value={consentForm.typedName}
                  onChange={(e) => setConsentForm({ ...consentForm, typedName: e.target.value })}
                  required
                />
              </Field>
              {consentForm.signerType === 'surrogate' && (
                <Field label="Relationship">
                  <Input
                    value={consentForm.signerRelationship}
                    onChange={(e) =>
                      setConsentForm({ ...consentForm, signerRelationship: e.target.value })
                    }
                  />
                </Field>
              )}
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>
                  Sign consent
                </Button>
              </div>
            </form>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/orders">
              <Button variant="secondary" size="sm">
                Physician signatures
              </Button>
            </Link>
            <Link href="/revenue">
              <Button variant="secondary" size="sm">
                Revenue integrity
              </Button>
            </Link>
            <Link href={`/patients/${episode.patientId}`}>
              <Button variant="ghost" size="sm">
                Patient chart
              </Button>
            </Link>
          </div>

          <EpisodePhotoGallery episodeId={id} patientId={episode.patientId} />
        </>
      )}
    </div>
  );
}
