'use client';

import { useCallback, useState } from 'react';
import type { AISuggestion } from '@hhos/shared';
import { SuggestionCard } from '@/components/SuggestionCard';
import { Alert, Badge, Button, Card, Input, PageHeader } from '@/components/ui';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

/** Local fallback so the UI is always demonstrable even if API flag is off. */
function mockSuggestions(): AISuggestion[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      type: 'note_section',
      targetPath: 'note.assessment',
      title: 'Assessment draft',
      content:
        'Patient reports improved mobility since last visit. Gait steady with rolling walker. No new falls. Mild residual edema bilateral lower extremities; elevation teaching reinforced.',
      provenance: {
        modelVersion: 'mock-v0.1',
        confidence: 0.78,
        factors: ['prior visit narrative', 'stated functional status', 'edema observation'],
        evidence: ['previous assessment delta', 'patient self-report'],
        generatedAt: now,
      },
      status: 'pending',
    },
    {
      id: crypto.randomUUID(),
      type: 'oasis_item',
      targetPath: 'oasis.M1800',
      title: 'M1800 Grooming',
      content: '1 — Grooming utensils must be placed within reach',
      structured: { code: '1' },
      provenance: {
        modelVersion: 'mock-v0.1',
        confidence: 0.71,
        factors: ['stated need for setup', 'prior M1800'],
        generatedAt: now,
      },
      status: 'pending',
    },
    {
      id: crypto.randomUUID(),
      type: 'risk_flag',
      title: 'Elevated fall risk',
      content:
        'Recent gait change + residual edema + age band. Consider focused balance assessment and home safety review this visit.',
      provenance: {
        modelVersion: 'mock-v0.1',
        confidence: 0.82,
        factors: ['gait change', 'edema', 'age band'],
        generatedAt: now,
      },
      status: 'pending',
    },
  ];
}

export default function AiAssistPage() {
  const [visitId, setVisitId] = useState('demo-visit-001');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'api' | 'local' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const token = getToken();
    if (!token) {
      setSuggestions(mockSuggestions());
      setSource('local');
      setMsg('Showing local demo suggestions (sign in to call the live API and write audit events).');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/v1/ai/visits/${encodeURIComponent(visitId)}/suggestions`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await readApiError(res);
        // Fall back gracefully so the interface still teaches the HITL flow
        setSuggestions(mockSuggestions());
        setSource('local');
        setMsg(
          `API unavailable (${err.message}). Showing local demo suggestions — Accept/Edit/Reject still work offline.`,
        );
        setLoading(false);
        return;
      }

      const data = (await res.json()) as {
        suggestions?: AISuggestion[];
        enabled?: boolean;
      };

      if (!data.enabled || !data.suggestions?.length) {
        setSuggestions(mockSuggestions());
        setSource('local');
        setMsg(
          'AI suggestions feature is off or returned empty. Showing local demo. Enable FEATURE_AI_SUGGESTIONS or FEATURE_SERVICE_AI on the API.',
        );
      } else {
        setSuggestions(data.suggestions);
        setSource('api');
        setMsg(`Generated ${data.suggestions.length} suggestions · audited as ai.suggestion.generated`);
      }
    } catch {
      setSuggestions(mockSuggestions());
      setSource('local');
      setMsg('Network error — showing local demo suggestions.');
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  async function decide(
    s: AISuggestion,
    decision: 'accepted' | 'edited' | 'rejected',
    humanEdit?: string,
  ) {
    // Optimistic local update
    setSuggestions((prev) =>
      prev.map((x) =>
        x.id === s.id
          ? {
              ...x,
              status: decision,
              humanEdit: humanEdit,
              actedAt: new Date().toISOString(),
            }
          : x,
      ),
    );

    const token = getToken();
    if (!token || source !== 'api') {
      setMsg(`${decision} (local only — sign in + live API to persist audit)`);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/v1/ai/suggestions/${s.id}/decision`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          humanEdit,
          targetResourceType: 'Visit',
          targetResourceId: visitId,
        }),
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setError(`Decision recorded locally; audit call failed: ${err.message}`);
        return;
      }
      setMsg(`${decision} · audited as ai.suggestion.${decision}`);
    } catch {
      setError('Decision saved locally; could not reach API for audit.');
    }
  }

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const pending = suggestions.filter((s) => s.status === 'pending').length;
  const acted = suggestions.length - pending;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Lumina"
        title="AI Assist"
        description="Human-in-the-loop suggestions for notes, OASIS items, and risk flags. Nothing is applied until you Accept, Edit, or Reject."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {source && (
              <Badge tone={source === 'api' ? 'success' : 'neutral'}>
                {source === 'api' ? 'Live API' : 'Local demo'}
              </Badge>
            )}
            <Button size="sm" onClick={() => void generate()} disabled={loading}>
              {loading ? 'Generating…' : 'Generate suggestions'}
            </Button>
          </div>
        }
      />

      <Alert tone="info">
        <div>
          <strong className="font-semibold">Always human-in-the-loop.</strong> AI never
          auto-finalizes clinical content. Every generation and decision is audited when the live
          API is available.
        </div>
      </Alert>

      <Card className="border-teal-100 bg-gradient-to-br from-teal-50/60 via-white to-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className="ui-label" htmlFor="visit-id">
              Visit ID
            </label>
            <Input
              id="visit-id"
              value={visitId}
              onChange={(e) => setVisitId(e.target.value)}
              placeholder="visit uuid or demo id"
              className="max-w-md font-mono text-xs"
            />
            <p className="mt-1.5 text-xs text-ink-500">
              {user
                ? `Signed in as ${user.fullName} · suggestions call POST /v1/ai/visits/:id/suggestions`
                : 'Not signed in — Generate will use local demo suggestions'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg bg-white px-3 py-2 shadow-soft ring-1 ring-ink-100">
              <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
                Pending
              </div>
              <div className="font-display text-lg font-semibold text-ink-900">{pending}</div>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 shadow-soft ring-1 ring-ink-100">
              <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
                Acted
              </div>
              <div className="font-display text-lg font-semibold text-teal-700">{acted}</div>
            </div>
          </div>
        </div>
      </Card>

      {msg && <Alert tone="info">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {suggestions.length === 0 ? (
        <Card className="border-dashed border-ink-200 bg-ink-50/40 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink-900">No suggestions yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            Generate AI assists for this visit. You will review each one — nothing applies without
            your action.
          </p>
          <div className="mt-5">
            <Button onClick={() => void generate()} disabled={loading}>
              {loading ? 'Generating…' : 'Generate suggestions'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Suggestions for review</h2>
            <Button size="sm" variant="ghost" onClick={() => void generate()} disabled={loading}>
              Regenerate
            </Button>
          </div>
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAccept={(sug) => void decide(sug, 'accepted')}
              onEdit={(sug, text) => void decide(sug, 'edited', text)}
              onReject={(sug) => void decide(sug, 'rejected')}
            />
          ))}
        </div>
      )}

      <Card>
        <div className="ui-kicker">How this works</div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
          <li>• Confidence and rationale are always visible before you act.</li>
          <li>• Accept / Edit / Reject are the only paths — no silent apply.</li>
          <li>• Live API writes audit events: generated, accepted, edited, rejected.</li>
          <li>• Real models replace the mock later; the HITL contract stays the same.</li>
        </ul>
      </Card>
    </div>
  );
}
