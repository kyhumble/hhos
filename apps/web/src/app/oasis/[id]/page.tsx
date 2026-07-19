'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ItemDef = {
  id: string;
  code: string;
  section: string;
  label: string;
  helpText?: string;
  valueType: string;
  requiredForSoc: boolean;
  options?: { value: string; label: string }[];
};

type Assessment = {
  id: string;
  status: string;
  timepoint: string;
  completenessScore: number;
  answers: Record<string, string | number | boolean | null>;
  flagsJson: { code: string; severity: string; message: string }[];
  gapsJson: string[];
  pdgmHintJson: {
    primaryDxIcd10: string | null;
    lupaRisk: boolean;
    plannedVisits: number | null;
    lupaThreshold: number;
    disclaimer: string;
  } | null;
  episodeId: string;
};

export default function OasisDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [items, setItems] = useState<ItemDef[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? getToken() : null;

  const load = useCallback(async () => {
    if (!token) {
      setError('Not logged in');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const [libRes, aRes] = await Promise.all([
      fetch(`${API_URL}/v1/oasis/items`, { headers }),
      fetch(`${API_URL}/v1/oasis/assessments/${id}`, { headers }),
    ]);
    const lib = await libRes.json();
    const a = await aRes.json();
    if (!libRes.ok || !aRes.ok) {
      setError(lib.error?.message ?? a.error?.message ?? 'Load failed');
      return;
    }
    setItems(lib.items ?? []);
    setAssessment(a);
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.answers ?? {})) {
      d[k] = v === null || v === undefined ? '' : String(v);
    }
    setDraft(d);
    setError(null);
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAnswers() {
    if (!token || !assessment) return;
    setMsg(null);
    const answers = Object.entries(draft)
      .filter(([, v]) => v !== '')
      .map(([itemId, value]) => {
        const item = items.find((i) => i.id === itemId);
        let parsed: string | number | boolean = value;
        if (item?.valueType === 'number' || item?.valueType === 'scale') {
          parsed = Number(value);
        }
        return { itemId, value: parsed };
      });
    const res = await fetch(`${API_URL}/v1/oasis/assessments/${id}/answers`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setMsg(data.error?.message ?? JSON.stringify(data.validationErrors ?? data));
      return;
    }
    setMsg('Saved');
    await load();
  }

  async function validate() {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/oasis/assessments/${id}/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Validate failed');
      return;
    }
    setMsg(
      `Validate: ${data.canSubmit ? 'ready to submit' : 'gaps remain'} · flags ${data.flags?.length ?? 0}`,
    );
    await load();
  }

  async function submit() {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/oasis/assessments/${id}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setMsg(data.code ?? data.error?.message ?? 'Submit failed');
      return;
    }
    setMsg('Submitted for clinical lead review');
    await load();
  }

  async function review(action: 'approve_lock' | 'return_draft') {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/oasis/assessments/${id}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setMsg(data.code ?? data.error?.message ?? 'Review failed');
      return;
    }
    setMsg(action === 'approve_lock' ? 'Locked' : 'Returned to draft');
    await load();
  }

  if (error) {
    return (
      <div className="ui-page">
        <Link href="/oasis" className="ui-link text-sm">
          ← Assessments
        </Link>
        <Alert tone="warn">{error}</Alert>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="ui-page">
        <p className="text-sm text-ink-500">Loading…</p>
      </div>
    );
  }

  const sections = Array.from(new Set(items.map((i) => i.section)));
  const editable = assessment.status === 'draft';

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="OASIS"
        title={`${assessment.timepoint} assessment`}
        description={`Completeness ${assessment.completenessScore}% · Status ${assessment.status}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(assessment.status)}>{assessment.status}</Badge>
            {editable && (
              <>
                <Button size="sm" variant="secondary" onClick={() => void saveAnswers()}>
                  Save answers
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void validate()}>
                  Validate / PDGM
                </Button>
                <Button size="sm" onClick={() => void submit()}>
                  Submit for review
                </Button>
              </>
            )}
            {assessment.status === 'in_review' && (
              <>
                <Button size="sm" onClick={() => void review('approve_lock')}>
                  Approve & lock
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void review('return_draft')}>
                  Return to draft
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="-mt-2 flex flex-wrap gap-3 text-sm">
        <Link href="/oasis" className="ui-link">
          ← All assessments
        </Link>
        <Link href={`/episodes/${assessment.episodeId}`} className="ui-link">
          Open episode
        </Link>
      </div>

      {msg && <Alert tone="info">{msg}</Alert>}

      {assessment.pdgmHintJson && (
        <Alert tone="info">
          <div className="font-medium">PDGM hint (advisory)</div>
          <ul className="mt-2 list-inside list-disc text-xs">
            <li>Primary dx: {assessment.pdgmHintJson.primaryDxIcd10 ?? '—'}</li>
            <li>
              Planned visits: {assessment.pdgmHintJson.plannedVisits ?? '—'} (LUPA threshold{' '}
              {assessment.pdgmHintJson.lupaThreshold})
            </li>
            <li>LUPA risk: {assessment.pdgmHintJson.lupaRisk ? 'yes' : 'no'}</li>
          </ul>
          <p className="mt-2 text-xs opacity-80">{assessment.pdgmHintJson.disclaimer}</p>
        </Alert>
      )}

      {(assessment.flagsJson?.length ?? 0) > 0 && (
        <Alert tone="warn">
          <div className="font-medium">Flags</div>
          <ul className="mt-2 space-y-1 text-xs">
            {assessment.flagsJson.map((f) => (
              <li key={f.code}>
                <strong>{f.code}</strong> ({f.severity}): {f.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {sections.map((section) => (
        <Card key={section}>
          <h2 className="ui-section-title mb-4 capitalize">{section.replace(/_/g, ' ')}</h2>
          <div className="space-y-4">
            {items
              .filter((i) => i.section === section)
              .map((item) => (
                <Field
                  key={item.id}
                  label={`${item.code} — ${item.label}${item.requiredForSoc ? ' *' : ''}`}
                  hint={item.helpText}
                >
                  {item.options ? (
                    <Select
                      disabled={!editable}
                      value={draft[item.id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {item.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      disabled={!editable}
                      value={draft[item.id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
