'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';
import { Alert, Button, Field, Input, Select } from '@/components/ui';

type OrgChoice = { id: string; name: string; slug: string };

const DEMO = [
  { email: 'admin@demo.local', role: 'Admin' },
  { email: 'coord@demo.local', role: 'Intake' },
  { email: 'lead@demo.local', role: 'Clinical' },
  { email: 'billing@demo.local', role: 'Billing' },
  { email: 'rn@demo.local', role: 'Field RN' },
  { email: 'compliance@demo.local', role: 'Compliance' },
];

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? 'local';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export default function LoginPage() {
  const cognitoMode = AUTH_MODE === 'cognito';
  const [email, setEmail] = useState('coord@demo.local');
  const [idToken, setIdToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgChoices, setOrgChoices] = useState<OrgChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(q.get('next')));
    const reason = q.get('reason');
    if (reason === 'session') {
      setNotice('Your session expired or was invalid. Sign in again to continue.');
    } else if (reason === 'required') {
      setNotice('Sign in required to access that page.');
    }
  }, []);

  async function finishLogin(res: Response, data: Record<string, unknown>) {
    const err = data.error as
      | { code?: string; message?: string; organizations?: OrgChoice[] }
      | undefined;
    if (res.status === 409 && err?.code === 'ORG_SELECTION_REQUIRED') {
      setOrgChoices(err.organizations ?? []);
      setError('This identity is in multiple orgs — pick one.');
      return;
    }
    if (res.status === 403 && err?.code === 'MFA_REQUIRED') {
      setError(err.message ?? 'MFA required — complete MFA in Cognito and retry.');
      return;
    }
    if (!res.ok || err) {
      setError(err?.message ?? 'Login failed');
      return;
    }
    const token = data.accessToken as string;
    if (!token || typeof token !== 'string') {
      setError('Login response missing access token');
      return;
    }
    storeSession(token, data.user as SessionUser);
    window.location.href = nextPath || '/';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (cognitoMode) {
        const res = await fetch(`${API_URL}/v1/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: idToken.trim(),
            ...(orgId ? { orgId } : {}),
          }),
        });
        const data = await res.json();
        await finishLogin(res, data);
        return;
      }

      const res = await fetch(`${API_URL}/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(orgId ? { orgId } : {}),
        }),
      });
      const data = await res.json();
      await finishLogin(res, data);
    } catch (err) {
      const hint =
        typeof window !== 'undefined' && window.location.port === '3100'
          ? ' API must allow Origin http://localhost:3100 (restart API after .env CORS change).'
          : '';
      setError(
        `Could not reach API on :3001.${hint} Check http://localhost:3001/health — is @hhos/api running?`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[42%] flex-col justify-between bg-side p-10 text-white lg:flex xl:p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold">
            HH
          </div>
          <div>
            <div className="text-sm font-semibold">HHOS</div>
            <div className="text-[11px] text-side-muted">Home Health · Hospice</div>
          </div>
        </div>

        <div className="max-w-sm">
          <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight">
            Agency operations for intake, signatures, and billing readiness.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Human-in-the-loop by design. Synthetic data only in this environment.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            {['Physician 485 e-sign', 'SOC intake worklists', 'Claim readiness export'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="ui-dot bg-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-side-muted">Phases 0–9 · HIPAA-by-design</p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-canvas px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-6 lg:hidden">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              HH
            </div>
          </div>

          <h1 className="font-display text-xl font-semibold tracking-tight text-ink-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {cognitoMode
              ? 'Exchange a Cognito ID token for an HHOS session.'
              : 'Local demo — pick a persona. No password.'}
          </p>

          {notice && (
            <div className="mt-4">
              <Alert tone="warn">{notice}</Alert>
            </div>
          )}

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-6 rounded-xl border border-ink-200 bg-white p-5 shadow-panel sm:p-6"
          >
            {cognitoMode ? (
              <Field label="Cognito ID token">
                <textarea
                  className="ui-input min-h-[6rem] font-mono text-xs"
                  value={idToken}
                  onChange={(e) => setIdToken(e.target.value)}
                  required
                  placeholder="eyJraWQiOiJ..."
                />
              </Field>
            ) : (
              <Field label="Demo email">
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
            )}

            {orgChoices.length > 0 && (
              <div className="mt-3">
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
              <div className="mt-3">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            <Button type="submit" className="mt-5 w-full" disabled={loading}>
              {loading ? 'Signing in…' : cognitoMode ? 'Exchange session' : 'Continue'}
            </Button>

            {!cognitoMode && (
              <div className="mt-5 border-t border-ink-100 pt-4">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">
                  Personas
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEMO.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => setEmail(d.email)}
                      className={`rounded-lg border px-2 py-2 text-left text-xs font-medium transition ${
                        email === d.email
                          ? 'border-brand-300 bg-brand-50 text-brand-800'
                          : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {d.role}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            <Link href="/onboard" className="font-medium text-brand-700 hover:underline">
              Create organization
            </Link>
            {' · '}
            <Link href="/invite" className="font-medium text-brand-700 hover:underline">
              Accept invite
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
