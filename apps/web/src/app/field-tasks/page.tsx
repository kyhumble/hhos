'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Task = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  episodeId: string;
  dueAt: string | null;
  scheduledAt: string | null;
};

type Alert = {
  id: string;
  facilityName: string;
  status: string;
  patientId: string;
  source: string;
  createdAt: string;
};

export default function FieldTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    episodeId: '',
    patientId: '',
    title: 'Wound reassessment',
    taskType: 'wound_reassessment',
  });
  const [alertForm, setAlertForm] = useState({
    patientId: '',
    episodeId: '',
    facilityName: 'Demo Memorial Hospital',
  });

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function load() {
    if (!token) {
      setError('Login first');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const [tRes, aRes] = await Promise.all([
      fetch(`${API_URL}/v1/visit-tasks`, { headers }),
      fetch(`${API_URL}/v1/hospitalization-alerts`, { headers }),
    ]);
    const tData = await tRes.json();
    const aData = await aRes.json();
    if (!tRes.ok) {
      setError(tData.error?.message ?? 'Tasks load failed (FEATURE_SERVICE_AI?)');
      return;
    }
    setTasks(tData.data ?? []);
    if (aRes.ok) setAlerts(aData.data ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/visit-tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        episodeId: form.episodeId,
        patientId: form.patientId || undefined,
        taskType: form.taskType,
        title: form.title,
        priority: 'routine',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Create failed');
      return;
    }
    await load();
  }

  async function completeTask(id: string) {
    if (!token) return;
    await fetch(`${API_URL}/v1/visit-tasks/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'completed', completionNote: 'Done in ops console' }),
    });
    await load();
  }

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API_URL}/v1/hospitalization-alerts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientId: alertForm.patientId,
        episodeId: alertForm.episodeId || undefined,
        facilityName: alertForm.facilityName,
        source: 'manual',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Alert failed');
      return;
    }
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Field tasks & alerts</h1>
        <p className="text-sm text-slate-600">Phase 4 operations — visit tasks and hospitalization alerts.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}

      <form onSubmit={(e) => void createTask(e)} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">New visit task</h2>
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          placeholder="episodeId"
          value={form.episodeId}
          onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
          required
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
          Create task
        </button>
      </form>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2">{t.title}</td>
                <td className="px-4 py-2">{t.taskType}</td>
                <td className="px-4 py-2">{t.status}</td>
                <td className="px-4 py-2 text-right">
                  {t.status !== 'completed' && t.status !== 'cancelled' && (
                    <button
                      type="button"
                      className="text-brand-700 text-xs underline"
                      onClick={() => void completeTask(t.id)}
                    >
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  No visit tasks
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={(e) => void createAlert(e)} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">Hospitalization alert</h2>
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          placeholder="patientId"
          value={alertForm.patientId}
          onChange={(e) => setAlertForm((f) => ({ ...f, patientId: e.target.value }))}
          required
        />
        <input
          className="w-full rounded border px-3 py-2 text-xs font-mono"
          placeholder="episodeId (optional — creates follow-up task)"
          value={alertForm.episodeId}
          onChange={(e) => setAlertForm((f) => ({ ...f, episodeId: e.target.value }))}
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={alertForm.facilityName}
          onChange={(e) => setAlertForm((f) => ({ ...f, facilityName: e.target.value }))}
        />
        <button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white">
          File alert
        </button>
      </form>

      <ul className="space-y-2 text-sm">
        {alerts.map((a) => (
          <li key={a.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <strong>{a.facilityName}</strong> · {a.status} · {a.source}
          </li>
        ))}
      </ul>
    </div>
  );
}
