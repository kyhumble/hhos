'use client';

import { useCallback, useState } from 'react';
import type { AISuggestion } from '@hhos/shared';
import { SuggestionCard } from '@/components/SuggestionCard';
import { Alert, Button, Card, PageHeader } from '@/components/ui';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';

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
        factors: ['prior visit notes', 'what the patient reported', 'edema observation'],
        evidence: ['change since last assessment', 'patient self-report'],
        generatedAt: now,
      },
      status: 'pending',
    },
    {
      id: crypto.randomUUID(),
      type: 'oasis_item',
      targetPath: 'oasis.M1800',
      title: 'Grooming',
      content: 'Needs setup — grooming items must be placed within reach',
      structured: { code: '1' },
      provenance: {
        modelVersion: 'mock-v0.1',
        confidence: 0.71,
        factors: ['stated need for setup', 'prior assessment'],
        generatedAt: now,
      },
      status: 'pending',
    },
    {
      id: crypto.randomUUID(),
      type: 'risk_flag',
      title: 'Elevated fall risk',
      content:
        'Recent change in gait, residual edema, and age. Consider a focused balance check and home safety review this visit.',
      provenance: {
        modelVersion: 'mock-v0.1',
        confidence: 0.82,
        factors: ['gait change', 'edema', 'age'],
        generatedAt: now,
      },
      status: 'pending',
    },
  ];
}

export default function AiAssistPage() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'api' | 'local' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    const token = getToken();
    const visitId = 'demo-visit-001';

    if (!token) {
      setSuggestions(mockSuggestions());
      setSource('local');
      setMsg('Demo suggestions — sign in for live assists on real visits.');
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
        await readApiError(res);
        setSuggestions(mockSuggestions());
        setSource('local');
        setMsg('Showing demo suggestions. You can still Accept, Edit, or Reject each one.');
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
        setMsg('Showing demo suggestions for this session.');
      } else {
        setSuggestions(data.suggestions);
        setSource('api');
        setMsg(`${data.suggestions.length} suggestions ready for your review.`);
      }
    } catch {
      setSuggestions(mockSuggestions());
      setSource('local');
      setMsg('Showing demo suggestions for this session.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function decide(
    s: AISuggestion,
    decision: 'accepted' | 'edited' | 'rejected',
    humanEdit?: string,
  ) {
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

    const labels = {
      accepted: 'Accepted',
      edited: 'Saved your edit',
      rejected: 'Dismissed',
    } as const;
    setMsg(labels[decision]);

    const token = getToken();
    if (!token || source !== 'api') return;

    try {
      await fetch(`${API_URL}/v1/ai/suggestions/${s.id}/decision`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          humanEdit,
          targetResourceType: 'Visit',
          targetResourceId: 'demo-visit-001',
        }),
      });
    } catch {
      // Decision already shown in UI; silent on network failure for product calm
    }
  }

  const pending = suggestions.filter((s) => s.status === 'pending').length;
  const acted = suggestions.length - pending;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Care"
        title="AI Assist"
        description="Suggestions for notes, assessments, and risks. Nothing is applied until you approve it."
        actions={
          <Button size="sm" onClick={() => void generate()} disabled={loading}>
            {loading ? 'Working…' : suggestions.length ? 'Refresh suggestions' : 'Get suggestions'}
          </Button>
        }
      />

      <Alert tone="info">
        <span>
          <strong className="font-semibold">You’re in control.</strong> Review each suggestion.
          Accept, edit, or dismiss — AI never writes to the chart on its own.
        </span>
      </Alert>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-white px-4 py-2.5 shadow-soft ring-1 ring-ink-100">
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">To review</div>
            <div className="font-display text-xl font-semibold text-ink-900">{pending}</div>
          </div>
          <div className="rounded-xl bg-white px-4 py-2.5 shadow-soft ring-1 ring-ink-100">
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">Done</div>
            <div className="font-display text-xl font-semibold text-teal-700">{acted}</div>
          </div>
        </div>
      )}

      {msg && <Alert tone="info">{msg}</Alert>}

      {suggestions.length === 0 ? (
        <Card className="border-dashed border-ink-200 bg-ink-50/30 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-ink-900">No suggestions yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">
            Get draft help for notes, assessments, and risk flags. You’ll review every item before
            anything is kept.
          </p>
          <div className="mt-6">
            <Button onClick={() => void generate()} disabled={loading}>
              {loading ? 'Working…' : 'Get suggestions'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-900">For your review</h2>
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

      <Card className="bg-ink-50/40">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-800">How it works.</span> Each card shows why it
          was suggested. Accept to keep it, edit to change it, or dismiss if it’s not right. Nothing
          reaches the patient record without you.
        </p>
      </Card>
    </div>
  );
}
