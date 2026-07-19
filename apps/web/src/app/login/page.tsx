'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';
import { Alert, Button, Field, Input, Select } from '@/components/ui';

type OrgChoice = { id: string; name: string; slug: string };

const DEMO = [
  { email: 'admin@demo.local', role: 'Admin' },
  { email: 'coord@demo.local', role: 'Intake' },
  { email: 'lead@demo.local', role: 'Clinical lead' },
  { email: 'billing@demo.local', role: 'Billing' },
  { email: 'rn@demo.local', role: 'Field RN' },
  { email: 'compliance@demo.local', role: 'Compliance' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('coord@demo.local');
  const [orgId, setOrgId] = useState('');
  const [orgChoices, setOrgChoices] = useState<OrgChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(orgId ? { orgId } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error?.code === 'ORG_SELECTION_REQUIRED') {
        setOrgChoices(data.error.organizations ?? []);
        setError('This email is in multiple orgs — pick one.');
        return;
      }
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Login failed');
        return;
      }
      storeSession(data.accessToken as string, data.user as SessionUser);
      window.location.href = '/';
    } catch {
      setError('Could not reach API on :3001. Is @hhos/api running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-950 via-ink-950 to-brand-900" />
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-bold text-white shadow-xl shadow-brand-900/40">
            HH
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in to HHOS</h1>
          <p className="mt-2 text-sm text-brand-100/70">
            Dev JWT only · disabled when AUTH_PROVIDER=cognito
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/30 sm:p-8"
        >
          <Field label="Demo email" hint="No password in local mode">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              list="demo-users"
              autoComplete="username"
              required
            />
            <datalist id="demo-users">
              {DEMO.map((d) => (
                <option key={d.email} value={d.email} />
              ))}
            </datalist>
          </Field>

          {orgChoices.length > 0 && (
            <div className="mt-4">
              <Field label="Organization">
                <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
                  <option value="">Select…</option>
                  {orgChoices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.slug})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <Button type="submit" className="mt-6 w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="mt-6 border-t border-ink-100 pt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
              Quick pick
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => setEmail(d.email)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    email === d.email
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                  }`}
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-brand-100/50">
          New agency?{' '}
          <Link href="/onboard" className="font-semibold text-brand-200 hover:text-white">
            Create organization
          </Link>
          {' · '}
          <Link href="/invite" className="font-semibold text-brand-200 hover:text-white">
            Accept invite
          </Link>
        </p>
      </div>
    </div>
  );
}
