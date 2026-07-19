'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  statusTone,
} from '@/components/ui';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Suggestion = {
  id: string;
  episodeId: string;
  patientId: string;
  suggestedUserId: string;
  suggestedFullName?: string;
  status: string;
  scoreTotal: number;
  scoreBreakdownJson: {
    total: number;
    geography: number;
    skills: number;
    language: number;
    caseload: number;
    explanations: string[];
  };
};

type Profile = {
  userId: string;
  fullName: string;
  skillsJson: string[];
  languagesJson: string[];
  homeBaseCity: string | null;
  homeBaseState: string | null;
  activeForRouting: boolean;
};

export default function RoutingPage() {
  const [episodeId, setEpisodeId] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function loadProfiles() {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/clinician-profiles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setProfiles(data.data ?? []);
  }

  useEffect(() => {
    if (!token) {
      setError('Login first (coord or lead).');
      return;
    }
    void loadProfiles();
  }, [token]);

  async function generate() {
    if (!token || !episodeId) return;
    setMsg(null);
    const res = await fetch(`${API_URL}/v1/routing/suggestions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        episodeId,
        requiredSkills: ['wound_care'],
        limit: 5,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Generate failed (FEATURE_SERVICE_AI?)');
      return;
    }
    setSuggestions(data.data ?? []);
    setMsg(data.disclaimer ?? 'Suggestions ready — human must accept.');
  }

  async function decide(id: string, decision: 'accepted' | 'rejected') {
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/routing/suggestions/${id}/decide`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decision,
        reasonCode: decision === 'accepted' ? 'best_match' : 'clinical_judgment',
        assignToCareTeam: decision === 'accepted',
        note: decision === 'accepted' ? 'Accepted via ops console' : 'Rejected via ops console',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Decide failed');
      return;
    }
    setSuggestions(data.data ?? []);
    setMsg(decision === 'accepted' ? 'Assigned to care team (HITL).' : 'Rejected.');
  }

  async function seedMyProfile() {
    if (!token) return;
    const meRes = await fetch(`${API_URL}/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json();
    const userId = me.user?.id;
    if (!userId) {
      setMsg('Could not resolve user id');
      return;
    }
    const res = await fetch(`${API_URL}/v1/clinician-profiles`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        skills: ['wound_care', 'ostomy', 'rural_travel'],
        languages: ['en'],
        homeBaseCity: 'Tulsa',
        homeBaseState: 'OK',
        homeBasePostal: '74103',
        maxDailyVisits: 6,
        activeForRouting: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Profile upsert failed');
      return;
    }
    setMsg('Clinician profile saved for current user');
    await loadProfiles();
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Service AI"
        title="Clinician routing"
        description="Explainable suggestions only. Accept or reject is required before assignment."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void seedMyProfile()}>
            Seed my demo profile
          </Button>
        }
      />

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="ui-section-title mb-4">Generate suggestions</h2>
          <div className="space-y-3">
            <Field label="Episode ID" hint="UUID from intake or episode page">
              <Input
                className="font-mono text-xs"
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
                placeholder="uuid from intake / episode page"
              />
            </Field>
            <Button className="w-full" onClick={() => void generate()} disabled={!episodeId}>
              Generate HITL suggestions
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="ui-section-title mb-3">Clinician profiles</h2>
          {profiles.length === 0 ? (
            <EmptyState
              title="No profiles yet"
              body="Seed your demo profile, then generate suggestions for an episode."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {profiles.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-medium text-ink-900">{p.fullName}</div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      {(p.skillsJson ?? []).join(', ') || 'no skills'} · {p.homeBaseCity ?? '—'},{' '}
                      {p.homeBaseState ?? '—'}
                    </div>
                  </div>
                  <Badge tone={p.activeForRouting ? 'success' : 'neutral'}>
                    {p.activeForRouting ? 'active' : 'inactive'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="ui-section-title">Suggestions</h2>
        {suggestions.length === 0 && (
          <Card>
            <EmptyState
              title="No suggestions yet"
              body="Enter an episode ID and generate explainable routing matches."
            />
          </Card>
        )}
        {suggestions.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-900">
                    {s.suggestedFullName ?? s.suggestedUserId}
                  </span>
                  <Badge tone="brand">score {s.scoreTotal}</Badge>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-400">
                  episode {s.episodeId.slice(0, 8)}…
                </div>
                <ul className="mt-2 list-inside list-disc text-xs text-ink-600">
                  {(s.scoreBreakdownJson?.explanations ?? []).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
              {s.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => void decide(s.id, 'accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void decide(s.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
