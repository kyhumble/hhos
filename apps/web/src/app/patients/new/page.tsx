'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link href="/intake" className="text-sm text-brand-700 hover:underline">
          ← Intake
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Create patient</h1>
        <p className="text-sm text-slate-600">Synthetic data only — no real ePHI.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            First name
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Last name
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Date of birth
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
        </label>
        <fieldset className="space-y-2 rounded-lg border border-slate-100 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Service address (optional)</legend>
          <input
            placeholder="Line 1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.line1}
            onChange={(e) => setForm({ ...form, line1: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="City"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <input
              placeholder="ST"
              maxLength={2}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
            />
            <input
              placeholder="ZIP"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            />
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Create patient'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
