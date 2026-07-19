'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL, authHeaders, getToken, readApiError } from '@/lib/api';
import {
  canReadClinicalTasks,
  canWriteClinicalTasks,
  loadSessionUser,
  type SessionUser,
} from '@/lib/auth';

type ClinicalTask = {
  id: string;
  orgId: string;
  episodeId: string;
  patientId: string;
  woundPhotoId: string | null;
  taskType: string;
  status: string;
  priority: string;
  title: string;
  details: string | null;
  assigneeUserId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeatureState = 'loading' | 'ready' | 'disabled' | 'forbidden' | 'error';

export default function ClinicalTasksPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [featureState, setFeatureState] = useState<FeatureState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Not logged in. Use /login first.');
      setFeatureState('error');
      return;
    }

    const session = await loadSessionUser();
    setUser(session);

    if (!canReadClinicalTasks(session)) {
      setFeatureState('forbidden');
      setTasks([]);
      setError(null);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('pageSize', '50');

      const res = await fetch(`${API_URL}/v1/clinical-tasks?${params}`, {
        headers: authHeaders(token),
      });

      if (res.status === 404) {
        setFeatureState('disabled');
        setTasks([]);
        setError(null);
        return;
      }

      if (res.status === 403) {
        setFeatureState('forbidden');
        setTasks([]);
        setError(null);
        return;
      }

      if (!res.ok) {
        const err = await readApiError(res);
        setError(err.message);
        setFeatureState('error');
        return;
      }

      const data = (await res.json()) as { data?: ClinicalTask[] };
      setTasks(data.data ?? []);
      setFeatureState('ready');
      setError(null);
    } catch {
      setError('API unreachable');
      setFeatureState('error');
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(taskId: string) {
    const token = getToken();
    if (!token || !canWriteClinicalTasks(user)) return;
    setCompletingId(taskId);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/v1/clinical-tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notes[taskId]?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setMsg(err.message);
        return;
      }
      setMsg('Task completed.');
      await load();
    } catch {
      setMsg('API unreachable');
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Clinical task queue</h1>
          <p className="text-sm text-slate-600">
            HITL large-wound reviews and other clinical tasks. Completing a task never auto-cancels
            from measurement changes.
          </p>
        </div>
        <label className="text-sm">
          Status
          <select
            className="ml-2 rounded-lg border border-slate-300 px-2 py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
            <option value="">all</option>
          </select>
        </label>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      {featureState === 'loading' && (
        <p className="text-sm text-slate-500">Loading clinical tasks…</p>
      )}

      {featureState === 'disabled' && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
          <p className="font-medium">Wound photo / clinical tasks feature is not enabled</p>
          <p className="mt-1 text-slate-600">
            Set <code className="rounded bg-white px-1">FEATURE_WOUND_PHOTOS=true</code> on the API
            to enable the clinical task queue.
          </p>
        </div>
      )}

      {featureState === 'forbidden' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <p className="font-medium">No access to clinical tasks</p>
          <p className="mt-1">
            Your role lacks <code className="rounded bg-white px-1">clinical_task:read</code>. Use a
            clinical lead, compliance, or admin demo account (e.g. lead@demo.local).
          </p>
          <Link href="/login" className="mt-2 inline-block text-brand-700 hover:underline">
            Switch account
          </Link>
        </div>
      )}

      {error && featureState === 'error' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {error}{' '}
          {!getToken() && (
            <Link href="/login" className="underline">
              Login
            </Link>
          )}
        </div>
      )}

      {featureState === 'ready' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Episode</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No clinical tasks match this filter. Large-wound reviews appear after photos with
                    measurements above threshold are completed.
                  </td>
                </tr>
              )}
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{task.title}</div>
                    {task.details && (
                      <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-slate-600">
                        {task.details}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task.taskType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        task.priority === 'urgent'
                          ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700'
                      }
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-brand-700 hover:underline"
                      href={`/episodes/${task.episodeId}`}
                    >
                      Open episode
                    </Link>
                    {task.woundPhotoId && (
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        photo {task.woundPhotoId.slice(0, 8)}…
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(task.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {(task.status === 'open' || task.status === 'in_progress') &&
                      canWriteClinicalTasks(user) && (
                        <div className="space-y-2">
                          <input
                            className="w-full min-w-[10rem] rounded border border-slate-300 px-2 py-1 text-xs"
                            placeholder="Completion notes (optional)"
                            value={notes[task.id] ?? ''}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [task.id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            disabled={completingId === task.id}
                            onClick={() => void completeTask(task.id)}
                            className="rounded-lg bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                          >
                            {completingId === task.id ? 'Completing…' : 'Complete'}
                          </button>
                        </div>
                      )}
                    {(task.status === 'open' || task.status === 'in_progress') &&
                      !canWriteClinicalTasks(user) && (
                        <span className="text-xs text-slate-500">Read-only</span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
