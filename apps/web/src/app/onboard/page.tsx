'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
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
        `Created org ${data.organization?.name} (${data.organization?.slug}). Signed in as admin.`,
      );
    } catch {
      setError('Could not reach API on :3001');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-page mx-auto max-w-lg">
      <PageHeader
        eyebrow="Onboarding"
        title="Create organization"
        description="Self-serve multi-tenant bootstrap: org + default roles + first admin (synthetic / demo)."
      />

      <Card>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {(
            [
              ['name', 'Agency name'],
              ['slug', 'Slug (kebab-case)'],
              ['timezone', 'Timezone'],
              ['adminEmail', 'Admin email'],
              ['adminFullName', 'Admin full name'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required
              />
            </Field>
          ))}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create org & sign in'}
          </Button>
        </form>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {ok && (
        <Alert tone="success">
          {ok}{' '}
          <Link className="ui-link" href="/admin">
            Open Admin
          </Link>
        </Alert>
      )}
    </div>
  );
}
