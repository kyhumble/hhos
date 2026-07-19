'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';

type OrgChoice = { id: string; name: string; slug: string };

export default function LoginPage() {
  const [email, setEmail] = useState('admin@demo.local');
  const [orgId, setOrgId] = useState<string>('');
  const [orgChoices, setOrgChoices] = useState<OrgChoice[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [orgLabel, setOrgLabel] = useState<string | null>(null);
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
        setError('Select an organization for this email.');
        setToken(null);
        setUser(null);
        return;
      }
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Login failed');
        setToken(null);
        setUser(null);
        return;
      }
      const accessToken = data.accessToken as string;
      const sessionUser = data.user as SessionUser;
      setToken(accessToken);
      setUser(sessionUser);
      setOrgLabel(
        data.organization
          ? `${data.organization.name} (${data.organization.slug})`
          : sessionUser.orgId,
      );
      setOrgChoices([]);
      storeSession(accessToken, sessionUser);
    } catch {
      setError('Could not reach API. Is @hhos/api running on :3001?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Dev login</h1>
      <p className="text-sm text-slate-600">
        Multi-tenant local JWT. Pass org when the same email exists in multiple agencies.
        Disabled when <code className="rounded bg-slate-100 px-1">AUTH_PROVIDER=cognito</code>.
      </p>
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium">
          Demo email
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            list="demo-users"
          />
        </label>
        <datalist id="demo-users">
          <option value="admin@demo.local" />
          <option value="coord@demo.local" />
          <option value="rn@demo.local" />
          <option value="lead@demo.local" />
          <option value="compliance@demo.local" />
        </datalist>
        {orgChoices.length > 0 && (
          <label className="block text-sm font-medium">
            Organization
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {orgChoices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.slug})
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        New agency?{' '}
        <a className="underline" href="/onboard">
          Create organization
        </a>
        {' · '}
        <a className="underline" href="/invite">
          Accept invite
        </a>
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {token && user && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Signed in as <strong>{user.fullName}</strong> ({user.roles.join(', ')})
          {orgLabel && (
            <>
              {' '}
              · <strong>{orgLabel}</strong>
            </>
          )}
          . Open{' '}
          <a className="underline" href="/admin">
            Admin
          </a>
          ,{' '}
          <a className="underline" href="/intake">
            Intake
          </a>
          .
        </div>
      )}
    </div>
  );
}
