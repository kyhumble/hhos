'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function NewPatientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    preferredLanguage: 'en',
    line1: '',
    city: '',
    state: 'OK',
    postalCode: '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = window.localStorage.getItem('hhos_token');
    if (!token) {
      setError('Not logged in. Use /login first.');
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        dob: form.dob,
        preferredLanguage: form.preferredLanguage,
      };
      if (form.line1 && form.city && form.postalCode) {
        body.serviceAddress = {
          line1: form.line1,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
        };
      }

      const res = await fetch(`${API_URL}/v1/patients`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Create failed');
        return;
      }
      router.push(`/patients/${data.id}`);
    } catch {
      setError('API unreachable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-page mx-auto max-w-lg">
      <PageHeader
        eyebrow="Intake"
        title="Create patient"
        description="Synthetic data only — no real ePHI."
      />
      <div className="-mt-2">
        <Link href="/intake" className="ui-link text-sm">
          ← Intake worklist
        </Link>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name">
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Date of birth">
            <Input
              required
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </Field>
          <fieldset className="space-y-2 rounded-xl border border-ink-100 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Service address (optional)
            </legend>
            <Input
              placeholder="Line 1"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <Input
                placeholder="ST"
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              />
              <Input
                placeholder="ZIP"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
          </fieldset>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Create patient'}
          </Button>
        </form>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
