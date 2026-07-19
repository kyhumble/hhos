'use client';

import { useCallback, useEffect, useState } from 'react';
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
      setError('Not logged in. Use /login first.');
      return;
    }
    try {
      const [epRes, tplRes] = await Promise.all([
        fetch(`${API_URL}/v1/episodes/${id}`, {
          headers: authHeaders(t),
        }),
        fetch(`${API_URL}/v1/consent-templates?locale=en`, {
          headers: authHeaders(t),
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
    const t = getToken();
    if (!t || !episode) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/episodes/${id}`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(t),
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
    const t = getToken();
    if (!t || !episode) return;
    setSaving(true);
    setMsg(null);
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

  async function startOasis() {
    const t = getToken();
    if (!t) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/oasis/assessments`, {
        method: 'POST',
        headers: {
          ...authHeaders(t),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ episodeId: id, timepoint: 'SOC' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error?.message ?? 'OASIS create failed (is FEATURE_OASIS=true?)');
        return;
      }
      window.location.href = `/oasis/${data.id}`;
    } catch {
      setMsg('API unreachable');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="ui-page">
        <Link href="/intake" className="ui-link text-sm">
          ← Intake
        </Link>
        <Alert tone="warn">{error}</Alert>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="ui-page">
        <p className="text-sm text-ink-500">Loading episode…</p>
      </div>
    );
  }

  const p = episode.patient;

  return (
    <div className="ui-page">
      <div>
        <Link href="/intake" className="ui-link text-sm">
          ← Intake worklist
        </Link>
      </div>

      <PageHeader
        eyebrow="Episode"
        title={p ? `${p.lastName}, ${p.firstName}` : 'Episode'}
        description={`${p?.mrn ?? ''} · ${episode.status} · intake ${episode.intakeStatus} · ${episode.careType}${
          episode.socDueAt ? ` · SOC due ${new Date(episode.socDueAt).toLocaleString()}` : ''
        }`}
        actions={
          <Button size="sm" onClick={() => void startOasis()} disabled={saving}>
            Start SOC OASIS
          </Button>
        }
      />

      {(episode.flags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {episode.flags.map((f) => (
            <Badge key={f} tone="danger">
              {f}
            </Badge>
          ))}
        </div>
      )}

      {msg && <Alert tone="info">{msg}</Alert>}

      <EpisodePhotoGallery episodeId={episode.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="ui-section-title mb-3">Intake checklist</h2>
          <ul className="divide-y divide-ink-100">
            {episode.checklist.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-800">
                  {item.code}
                  {item.required && (
                    <span className="ml-1 text-[10px] uppercase text-ink-400">required</span>
                  )}
                </span>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="ui-section-title mb-3">Episode clinical fields</h2>
          <form onSubmit={saveEpisodePatch} className="space-y-3">
            <Field label="F2F status">
              <Select
                value={episodePatch.f2fStatus}
                onChange={(e) => setEpisodePatch({ ...episodePatch, f2fStatus: e.target.value })}
              >
                <option value="unknown">unknown</option>
                <option value="scheduled">scheduled</option>
                <option value="completed">completed</option>
                <option value="missing">missing</option>
                <option value="waived_review">waived_review</option>
              </Select>
            </Field>
            <Field label="Orders status">
              <Select
                value={episodePatch.ordersStatus}
                onChange={(e) => setEpisodePatch({ ...episodePatch, ordersStatus: e.target.value })}
              >
                <option value="missing">missing</option>
                <option value="verbal">verbal</option>
                <option value="signed">signed</option>
                <option value="expired">expired</option>
              </Select>
            </Field>
            <Field label="Primary DX ICD-10">
              <Input
                value={episodePatch.primaryDxIcd10}
                onChange={(e) =>
                  setEpisodePatch({ ...episodePatch, primaryDxIcd10: e.target.value })
                }
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={saving}>
              Save & recompute checklist
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="ui-section-title mb-1">Capture consent</h2>
        <p className="mb-4 text-xs text-amber-800">
          Template body text is NOT LEGAL FINAL. Typed signature is acceptable for demo.
        </p>
        <form onSubmit={captureConsent} className="space-y-3">
          <Field label="Template">
            <Select
              required
              value={consentForm.templateId}
              onChange={(e) => setConsentForm({ ...consentForm, templateId: e.target.value })}
            >
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.consentType} — {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
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
                <option value="patient">patient</option>
                <option value="surrogate">surrogate</option>
              </Select>
            </Field>
            <Field label="Signer name">
              <Input
                required
                value={consentForm.signerName}
                onChange={(e) => setConsentForm({ ...consentForm, signerName: e.target.value })}
              />
            </Field>
          </div>
          {consentForm.signerType === 'surrogate' && (
            <Field label="Relationship">
              <Input
                required
                value={consentForm.signerRelationship}
                onChange={(e) =>
                  setConsentForm({ ...consentForm, signerRelationship: e.target.value })
                }
              />
            </Field>
          )}
          <Field label="Typed signature">
            <Input
              required
              value={consentForm.typedName}
              onChange={(e) => setConsentForm({ ...consentForm, typedName: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Sign consent'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
