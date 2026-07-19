'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('token');
    if (q) setToken(q);
  }, []);

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
    <div className="ui-page mx-auto max-w-md">
      <PageHeader
        eyebrow="Onboarding"
        title="Accept invite"
        description="Paste the invite token from org admin (email delivery not wired yet)."
      />

      <Card>
        <div className="space-y-3">
          <Field label="Invite token">
            <textarea
              className="ui-input min-h-[5rem] font-mono text-xs"
              rows={3}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          <Button type="button" variant="secondary" onClick={() => void doPeek()}>
            Preview invite
          </Button>
          {peek && (
            <div className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {peek.organization?.name} ({peek.organization?.slug}) · {peek.email} · {peek.roleCode}
            </div>
          )}
          <form onSubmit={(e) => void accept(e)} className="space-y-3 border-t border-ink-100 pt-3">
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full">
              Accept & sign in
            </Button>
          </form>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {ok && (
        <Alert tone="success">
          {ok}{' '}
          <Link className="ui-link" href="/">
            Dashboard
          </Link>
        </Alert>
      )}
    </div>
  );
}
