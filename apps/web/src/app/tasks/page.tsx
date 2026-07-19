'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  statusTone,
} from '@/components/ui';
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
    <div className="ui-page">
      <PageHeader
        eyebrow="Clinical"
        title="Clinical task queue"
        description="HITL large-wound reviews and other clinical tasks. Completing a task never auto-cancels from measurement changes."
        actions={
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status filter"
          >
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
            <option value="">all</option>
          </Select>
        }
      />

      {msg && <Alert tone="success">{msg}</Alert>}

      {featureState === 'loading' && (
        <p className="text-sm text-ink-500">Loading clinical tasks…</p>
      )}

      {featureState === 'disabled' && (
        <Alert tone="info">
          Wound photo / clinical tasks feature is not enabled. Set{' '}
          <code className="rounded bg-white/80 px-1">FEATURE_WOUND_PHOTOS=true</code> on the API.
        </Alert>
      )}

      {featureState === 'forbidden' && (
        <Alert tone="warn">
          No access to clinical tasks — needs <code className="rounded bg-white/80 px-1">clinical_task:read</code>.
          Use lead@demo.local or similar.{' '}
          <Link href="/login" className="ui-link">
            Switch account
          </Link>
        </Alert>
      )}

      {error && featureState === 'error' && (
        <Alert tone="warn">
          {error}{' '}
          {!getToken() && (
            <Link href="/login" className="ui-link">
              Login
            </Link>
          )}
        </Alert>
      )}

      {featureState === 'ready' && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Episode</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No clinical tasks match this filter"
                      body="Large-wound reviews appear after photos with measurements above threshold are completed."
                    />
                  </td>
                </tr>
              )}
              {tasks.map((task) => (
                <tr key={task.id} className="align-top">
                  <td>
                    <div className="font-medium text-ink-900">{task.title}</div>
                    {task.details && (
                      <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-ink-500">
                        {task.details}
                      </p>
                    )}
                  </td>
                  <td className="text-xs text-ink-500">{task.taskType}</td>
                  <td>
                    <Badge tone={task.priority === 'urgent' ? 'danger' : 'neutral'}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(task.status)}>{task.status}</Badge>
                  </td>
                  <td>
                    <Link className="ui-link" href={`/episodes/${task.episodeId}`}>
                      Open episode
                    </Link>
                    {task.woundPhotoId && (
                      <div className="mt-1 font-mono text-[10px] text-ink-400">
                        photo {task.woundPhotoId.slice(0, 8)}…
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-ink-500">
                    {new Date(task.createdAt).toLocaleString()}
                  </td>
                  <td>
                    {(task.status === 'open' || task.status === 'in_progress') &&
                      canWriteClinicalTasks(user) && (
                        <div className="space-y-2">
                          <Input
                            className="min-w-[10rem] text-xs"
                            placeholder="Completion notes (optional)"
                            value={notes[task.id] ?? ''}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [task.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={completingId === task.id}
                            onClick={() => void completeTask(task.id)}
                          >
                            {completingId === task.id ? 'Completing…' : 'Complete'}
                          </Button>
                        </div>
                      )}
                    {(task.status === 'open' || task.status === 'in_progress') &&
                      !canWriteClinicalTasks(user) && (
                        <span className="text-xs text-ink-400">Read-only</span>
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
