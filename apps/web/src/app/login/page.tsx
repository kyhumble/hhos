'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('coord@demo.local');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
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
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
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
        Local JWT only. Disabled when <code className="rounded bg-slate-100 px-1">AUTH_PROVIDER=cognito</code>.
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
          <option value="coord@demo.local" />
          <option value="rn@demo.local" />
          <option value="lead@demo.local" />
          <option value="compliance@demo.local" />
        </datalist>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {token && user && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Signed in as <strong>{user.fullName}</strong> ({user.roles.join(', ')}). Token stored
          as <code>hhos_token</code>. Open{' '}
          <a className="underline" href="/intake">
            Intake
          </a>{' '}
          or{' '}
          <a className="underline" href="/tasks">
            Clinical tasks
          </a>
          .
        </div>
      )}
    </div>
  );
}
