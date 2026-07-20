'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { API_URL, authHeaders, getToken, isAuthError, readApiError } from '@/lib/api';
import { forceReLogin, getStoredUser, loadSessionUser } from '@/lib/auth';

export default function NewPatientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
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

  useEffect(() => {
    void (async () => {
      const user = await loadSessionUser();
      if (!user || !getToken()) {
        setError('You need to sign in before creating a patient.');
        setSessionReady(false);
        return;
      }
      setSessionReady(true);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = getToken();
    if (!token) {
      forceReLogin('required');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        preferredLanguage: form.preferredLanguage,
      };
      if (form.line1 && form.city && form.postalCode) {
        body.serviceAddress = {
          line1: form.line1.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          postalCode: form.postalCode.trim(),
        };
      }

      const res = await fetch(`${API_URL}/v1/patients`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        forceReLogin('session');
        return;
      }

      if (!res.ok) {
        const err = await readApiError(res);
        if (isAuthError(err.status, err.code)) {
          forceReLogin('session');
          return;
        }
        setError(err.message);
        return;
      }

      const data = (await res.json()) as { id?: string; error?: { message?: string } };
      if (data.error?.message) {
        setError(data.error.message);
        return;
      }
      if (!data.id) {
        setError('Create succeeded but no patient id returned');
        return;
      }
      // Land on patient chart — user can start intake episode there
      router.push(`/patients/${data.id}?created=1`);
    } catch {
      setError('API unreachable — is the API running on :3001?');
    } finally {
      setLoading(false);
    }
  }

  const user = typeof window !== 'undefined' ? getStoredUser() : null;

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

      {!sessionReady && (
        <Alert tone="warn">
          Session missing or expired.{' '}
          <Link href="/login?reason=required&next=/patients/new" className="ui-link">
            Sign in
          </Link>{' '}
          (try coord@demo.local), then return here.
        </Alert>
      )}

      {sessionReady && user && (
        <p className="text-xs text-ink-500">
          Creating as <span className="font-semibold text-ink-700">{user.email}</span>
        </p>
      )}

      <Card>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                disabled={!sessionReady}
              />
            </Field>
            <Field label="Last name">
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                disabled={!sessionReady}
              />
            </Field>
          </div>
          <Field label="Date of birth" hint="YYYY-MM-DD via date picker">
            <Input
              required
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              disabled={!sessionReady}
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
              disabled={!sessionReady}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                disabled={!sessionReady}
              />
              <Input
                placeholder="ST"
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                disabled={!sessionReady}
              />
              <Input
                placeholder="ZIP"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                disabled={!sessionReady}
              />
            </div>
          </fieldset>
          <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
            {loading ? 'Saving…' : 'Create patient'}
          </Button>
        </form>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
