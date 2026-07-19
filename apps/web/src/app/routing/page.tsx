'use client';

import { useEffect, useState } from 'react';
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
    // Resolve self from /v1/me
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Service AI — routing</h1>
        <p className="text-sm text-slate-600">
          Explainable suggestions only. Accept/reject required before assignment.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Clinician profiles</h2>
        <button
          type="button"
          onClick={() => void seedMyProfile()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Save demo profile for me (Tulsa / wound_care)
        </button>
        <ul className="text-sm text-slate-700 space-y-1">
          {profiles.map((p) => (
            <li key={p.userId}>
              <strong>{p.fullName}</strong> · {(p.skillsJson ?? []).join(', ') || 'no skills'} ·{' '}
              {p.homeBaseCity ?? '—'}, {p.homeBaseState ?? '—'}
              {!p.activeForRouting && ' (inactive)'}
            </li>
          ))}
          {profiles.length === 0 && (
            <li className="text-slate-500">No profiles yet — save yours above, then generate.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Generate suggestions</h2>
        <label className="block text-sm">
          Episode ID
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            placeholder="uuid from intake / episode page"
          />
        </label>
        <button
          type="button"
          onClick={() => void generate()}
          className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white"
        >
          Generate HITL suggestions
        </button>
      </section>

      <section className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {s.suggestedFullName ?? s.suggestedUserId} · score {s.scoreTotal}
                </div>
                <div className="text-xs text-slate-500">
                  {s.status} · episode {s.episodeId.slice(0, 8)}…
                </div>
                <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                  {(s.scoreBreakdownJson?.explanations ?? []).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
              {s.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white"
                    onClick={() => void decide(s.id, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    onClick={() => void decide(s.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
