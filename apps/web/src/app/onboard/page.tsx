'use client';

import { useState } from 'react';
import { storeSession, type SessionUser } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function OnboardPage() {
  const [form, setForm] = useState({
    name: 'Northside Wound Care LLC',
    slug: 'northside-wound',
    timezone: 'America/Chicago',
    adminEmail: 'admin@northside.demo',
    adminFullName: 'Nora Northside',
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${API_URL}/v1/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Create failed');
        return;
      }
      storeSession(data.accessToken as string, data.user as SessionUser);
      setOk(
        `Created org ${data.organization?.name} (${data.organization?.slug}). Signed in as admin. Open Admin.`,
      );
    } catch {
      setError('Could not reach API on :3001');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Create organization</h1>
      <p className="text-sm text-slate-600">
        Self-serve multi-tenant bootstrap: org + default roles + first admin (synthetic / demo).
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-xl border bg-white p-5">
        {(
          [
            ['name', 'Agency name'],
            ['slug', 'Slug (kebab-case)'],
            ['timezone', 'Timezone'],
            ['adminEmail', 'Admin email'],
            ['adminFullName', 'Admin full name'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium">
            {label}
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              required
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create org & sign in'}
        </button>
      </form>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {ok}{' '}
          <a className="underline" href="/admin">
            Admin
          </a>
        </div>
      )}
    </div>
  );
}
