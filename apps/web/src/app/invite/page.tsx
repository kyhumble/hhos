'use client';

import { useState } from 'react';
import { storeSession, type SessionUser } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function AcceptInvitePage() {
  const [token, setToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [peek, setPeek] = useState<{
    email?: string;
    organization?: { name: string; slug: string };
    roleCode?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function doPeek() {
    setError(null);
    const res = await fetch(`${API_URL}/v1/invites/peek?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Invalid invite');
      setPeek(null);
      return;
    }
    setPeek(data);
    setFullName(data.fullName ?? '');
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/v1/invites/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, fullName: fullName || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Accept failed');
      return;
    }
    storeSession(data.accessToken as string, data.user as SessionUser);
    setOk(`Joined as ${data.user?.fullName}. Token stored.`);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Accept invite</h1>
      <p className="text-sm text-slate-600">
        Paste the invite token from org admin (email delivery not wired yet).
      </p>
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <label className="block text-sm font-medium">
          Invite token
          <textarea
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void doPeek()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Preview invite
        </button>
        {peek && (
          <div className="rounded bg-slate-50 p-2 text-sm">
            {peek.organization?.name} ({peek.organization?.slug}) · {peek.email} · {peek.roleCode}
          </div>
        )}
        <form onSubmit={(e) => void accept(e)} className="space-y-2">
          <label className="block text-sm font-medium">
            Full name
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <button type="submit" className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
            Accept & sign in
          </button>
        </form>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {ok}{' '}
          <a className="underline" href="/">
            Dashboard
          </a>
        </div>
      )}
    </div>
  );
}
