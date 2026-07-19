'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">{error}</div>
    );
  }
  if (!assessment) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  const sections = Array.from(new Set(items.map((i) => i.section)));
  const editable = assessment.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/oasis" className="text-sm text-brand-700 hover:underline">
            ← Assessments
          </a>
          <h1 className="mt-1 text-xl font-semibold">
            OASIS {assessment.timepoint} · {assessment.status}
          </h1>
          <p className="text-sm text-slate-600">
            Completeness {assessment.completenessScore}% · Episode{' '}
            <a className="text-brand-700 underline" href={`/episodes/${assessment.episodeId}`}>
              open
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <button
                type="button"
                onClick={() => void saveAnswers()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Save answers
              </button>
              <button
                type="button"
                onClick={() => void validate()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Validate / PDGM flags
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white"
              >
                Submit for review
              </button>
            </>
          )}
          {assessment.status === 'in_review' && (
            <>
              <button
                type="button"
                onClick={() => void review('approve_lock')}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                Approve & lock
              </button>
              <button
                type="button"
                onClick={() => void review('return_draft')}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Return to draft
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      {assessment.pdgmHintJson && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
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
        </div>
      )}

      {(assessment.flagsJson?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium text-amber-950">Flags</div>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {assessment.flagsJson.map((f) => (
              <li key={f.code}>
                <strong>{f.code}</strong> ({f.severity}): {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((section) => (
        <section key={section} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {section.replace(/_/g, ' ')}
          </h2>
          <div className="mt-3 space-y-4">
            {items
              .filter((i) => i.section === section)
              .map((item) => (
                <label key={item.id} className="block text-sm">
                  <span className="font-medium text-slate-800">
                    {item.code} — {item.label}
                    {item.requiredForSoc ? (
                      <span className="text-red-600"> *</span>
                    ) : null}
                  </span>
                  {item.helpText && (
                    <span className="mt-0.5 block text-xs text-slate-500">{item.helpText}</span>
                  )}
                  {item.options ? (
                    <select
                      disabled={!editable}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={draft[item.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [item.id]: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      {item.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled={!editable}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={draft[item.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [item.id]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
