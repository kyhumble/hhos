'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  statusTone,
} from '@/components/ui';
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

type HospAlert = {
  id: string;
  facilityName: string;
  status: string;
  patientId: string;
  source: string;
  createdAt: string;
};

export default function FieldTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<HospAlert[]>([]);
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
    <div className="ui-page">
      <PageHeader
        eyebrow="Operations"
        title="Field tasks & alerts"
        description="Visit tasks and hospitalization alerts for field operations."
      />

      {error && <Alert tone="warn">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="ui-section-title mb-4">New visit task</h2>
          <form onSubmit={(e) => void createTask(e)} className="space-y-3">
            <Field label="Episode ID">
              <Input
                className="font-mono text-xs"
                placeholder="episodeId"
                value={form.episodeId}
                onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                required
              />
            </Field>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Button type="submit" className="w-full">
              Create task
            </Button>
          </form>
        </Card>

        <div className="ui-table-wrap lg:col-span-3">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="ui-section-title">Visit tasks</h2>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium text-ink-900">{t.title}</td>
                  <td className="text-xs text-ink-500">{t.taskType}</td>
                  <td>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="text-right">
                    {t.status !== 'completed' && t.status !== 'cancelled' && (
                      <Button size="sm" variant="ghost" onClick={() => void completeTask(t.id)}>
                        Complete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="No visit tasks" body="Create a task for an episode above." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="ui-section-title mb-4">Hospitalization alert</h2>
          <form onSubmit={(e) => void createAlert(e)} className="space-y-3">
            <Field label="Patient ID">
              <Input
                className="font-mono text-xs"
                placeholder="patientId"
                value={alertForm.patientId}
                onChange={(e) => setAlertForm((f) => ({ ...f, patientId: e.target.value }))}
                required
              />
            </Field>
            <Field label="Episode ID" hint="Optional — creates follow-up task">
              <Input
                className="font-mono text-xs"
                placeholder="episodeId (optional)"
                value={alertForm.episodeId}
                onChange={(e) => setAlertForm((f) => ({ ...f, episodeId: e.target.value }))}
              />
            </Field>
            <Field label="Facility">
              <Input
                value={alertForm.facilityName}
                onChange={(e) => setAlertForm((f) => ({ ...f, facilityName: e.target.value }))}
              />
            </Field>
            <Button type="submit" variant="danger" className="w-full">
              File alert
            </Button>
          </form>
        </Card>

        <div className="space-y-3 lg:col-span-3">
          <h2 className="ui-section-title">Active alerts</h2>
          {alerts.length === 0 && (
            <Card>
              <EmptyState title="No hospitalization alerts" body="Filed alerts appear here." />
            </Card>
          )}
          {alerts.map((a) => (
            <Card key={a.id} className="border-red-100 bg-red-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-ink-900">{a.facilityName}</div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {a.source} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone="danger">{a.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
