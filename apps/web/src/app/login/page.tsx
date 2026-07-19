'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';
import { Alert, Button, Field, Input, Select } from '@/components/ui';

type OrgChoice = { id: string; name: string; slug: string };

const DEMO = [
  { email: 'admin@demo.local', role: 'Admin', color: 'from-violet-500 to-brand-600' },
  { email: 'coord@demo.local', role: 'Intake', color: 'from-brand-500 to-sky-500' },
  { email: 'lead@demo.local', role: 'Clinical', color: 'from-emerald-500 to-teal-600' },
  { email: 'billing@demo.local', role: 'Billing', color: 'from-amber-500 to-orange-600' },
  { email: 'rn@demo.local', role: 'Field RN', color: 'from-rose-500 to-pink-600' },
  { email: 'compliance@demo.local', role: 'Compliance', color: 'from-slate-500 to-ink-700' },
];

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? 'local';

export default function LoginPage() {
  const cognitoMode = AUTH_MODE === 'cognito';
  const [email, setEmail] = useState('coord@demo.local');
  const [idToken, setIdToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgChoices, setOrgChoices] = useState<OrgChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    storeSession(data.accessToken as string, data.user as SessionUser);
    window.location.href = '/';
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
    } catch {
      setError('Could not reach API on :3001. Is @hhos/api running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] overflow-hidden bg-sidebar-lux lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div className="pointer-events-none absolute inset-0 bg-hero-shine" />
        <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 left-10 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-base font-bold text-white ring-1 ring-white/25 shadow-glow">
              HH
            </div>
            <div>
              <div className="font-display text-lg font-bold text-white">HHOS</div>
              <div className="text-xs text-brand-100/70">Home Health · Hospice OS</div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            The operating system for agencies that live on signatures and SOC readiness.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100/75">
            Intake, OASIS, 485 e-sign, hospice certs, and billing readiness — human-in-the-loop by
            design. Synthetic data only in this environment.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'HITL physician signatures',
              'Multi-tenant org isolation',
              'Billing readiness without auto-submit',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-white/85">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/35">Phases 0–9 · HIPAA-by-design platform</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col justify-center px-5 py-12 sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-mesh-light opacity-80" />

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white shadow-glow">
              HH
            </div>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[1.75rem]">
              Sign in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {cognitoMode
                ? 'Exchange a Cognito ID token for an HHOS app session.'
                : 'Local demo mode — pick a persona. No password required.'}
            </p>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-lift sm:p-8"
          >
            {cognitoMode ? (
              <Field
                label="Cognito ID token"
                hint="From Hosted UI / Amplify Auth. MFA may be required for admin/compliance."
              >
                <textarea
                  className="ui-input min-h-[7rem] font-mono text-xs"
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

            <Button type="submit" className="mt-6 w-full !py-3" disabled={loading}>
              {loading ? 'Signing in…' : cognitoMode ? 'Exchange session' : 'Continue to console'}
            </Button>

            {!cognitoMode && (
              <div className="mt-7 border-t border-ink-100 pt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
                  Quick persona
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DEMO.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => setEmail(d.email)}
                      className={`rounded-xl border px-2.5 py-2.5 text-left transition ${
                        email === d.email
                          ? 'border-brand-300 bg-brand-50 shadow-soft ring-2 ring-brand-500/20'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      <span
                        className={`mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${d.color} text-[9px] font-bold text-white`}
                      >
                        {d.role.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="text-xs font-semibold text-ink-900">{d.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-ink-500">
            New agency?{' '}
            <Link href="/onboard" className="font-semibold text-brand-700 hover:underline">
              Create organization
            </Link>
            {' · '}
            <Link href="/invite" className="font-semibold text-brand-700 hover:underline">
              Accept invite
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
