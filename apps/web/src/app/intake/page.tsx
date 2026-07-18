'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type WorklistItem = {
  id: string;
  mrn: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  status: string;
  intakeStatus: string;
  socDueAt: string | null;
  flags: string[];
};

export default function IntakePage() {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('hhos_token') : null;
    if (!token) {
      setError('Not logged in. Use /login with a demo account first.');
      return;
    }

    fetch(`${API_URL}/v1/worklists/intake`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? 'Failed to load worklist');
          return;
        }
        setItems(data.data ?? []);
      })
      .catch(() => setError('API unreachable'));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Intake worklist</h1>
          <p className="text-sm text-slate-600">
            Sorted by SOC risk. Open an episode to review checklist and capture consents.
          </p>
        </div>
        <Link
          href="/patients/new"
          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          New patient
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">MRN</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">SOC due</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !error && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No episodes yet. Run <code>pnpm db:seed</code> after migrate.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <Link className="text-brand-700 hover:underline" href={`/episodes/${item.id}`}>
                    {item.patientLastName}, {item.patientFirstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.mrn}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {item.intakeStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.socDueAt ? new Date(item.socDueAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.flags.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
