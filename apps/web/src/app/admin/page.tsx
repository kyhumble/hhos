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
  Select,
  statusTone,
} from '@/components/ui';
import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Org = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  npi: string | null;
  settings: {
    socDueHours?: number;
    photoGeotagEnabled?: boolean;
    features?: {
      woundPhotos?: boolean;
      oasis?: boolean;
      serviceAi?: boolean;
    };
  };
};

type Member = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
};

type Invite = {
  id: string;
  email: string;
  fullName: string;
  roleCode: string;
  status: string;
  expiresAt: string;
};

export default function AdminOrgPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    roleCode: 'field_rn',
  });
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? getToken() : null;

  async function load() {
    if (!token) {
      setError('Login as admin@demo.local (or any USER_ADMIN).');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const orgRes = await fetch(`${API_URL}/v1/orgs/me`, { headers });
    const orgData = await orgRes.json();
    if (!orgRes.ok) {
      setError(orgData.error?.message ?? 'Failed to load org');
      return;
    }
    setOrg(orgData);

    const memRes = await fetch(`${API_URL}/v1/orgs/me/members`, { headers });
    if (memRes.ok) {
      const memData = await memRes.json();
      setMembers(memData.data ?? []);
    }

    const invRes = await fetch(`${API_URL}/v1/orgs/me/invites`, { headers });
    if (invRes.ok) {
      const invData = await invRes.json();
      setInvites(invData.data ?? []);
    }
    setError(null);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !org) return;
    setMsg(null);
    const res = await fetch(`${API_URL}/v1/orgs/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: org.name,
        timezone: org.timezone,
        socDueHours: org.settings.socDueHours ?? 48,
        photoGeotagEnabled: org.settings.photoGeotagEnabled ?? false,
        features: {
          woundPhotos: org.settings.features?.woundPhotos !== false,
          oasis: org.settings.features?.oasis !== false,
          serviceAi: org.settings.features?.serviceAi !== false,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Save failed (need org:settings)');
      return;
    }
    setOrg((o) => (o ? { ...o, ...data, settings: data.settings } : data));
    setMsg('Organization settings saved (tenant-scoped).');
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLastInviteToken(null);
    const res = await fetch(`${API_URL}/v1/orgs/me/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inviteForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error?.message ?? 'Invite failed (need user:admin)');
      return;
    }
    setLastInviteToken(data.inviteToken ?? null);
    setMsg(`Invited ${data.invite?.email} as ${data.invite?.roleCode}`);
    setInviteForm({ email: '', fullName: '', roleCode: 'field_rn' });
    await load();
  }

  function toggleFeature(key: 'woundPhotos' | 'oasis' | 'serviceAi') {
    setOrg((o) => {
      if (!o) return o;
      const cur = o.settings.features?.[key] !== false;
      return {
        ...o,
        settings: {
          ...o.settings,
          features: { ...o.settings.features, [key]: !cur },
        },
      };
    });
  }

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Tenant"
        title="Organization admin"
        description="Multi-tenant settings, members, and invites. All data is scoped by org_id."
      />

      {error && <Alert tone="warn">{error}</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}

      {org && (
        <form onSubmit={(e) => void saveSettings(e)}>
          <Card>
            <h2 className="ui-section-title mb-1">Tenant profile</h2>
            <p className="mb-4 font-mono text-[11px] text-ink-400">
              {org.id} · slug <strong className="text-ink-600">{org.slug}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value })}
                />
              </Field>
              <Field label="Timezone">
                <Input
                  value={org.timezone}
                  onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                />
              </Field>
              <Field label="SOC due hours">
                <Input
                  type="number"
                  value={org.settings.socDueHours ?? 48}
                  onChange={(e) =>
                    setOrg({
                      ...org,
                      settings: { ...org.settings, socDueHours: Number(e.target.value) },
                    })
                  }
                />
              </Field>
            </div>
            <fieldset className="mt-4 space-y-2">
              <legend className="ui-label">
                Module flags (per-tenant; platform env is kill switch)
              </legend>
              {(
                [
                  ['woundPhotos', 'Wound photos'],
                  ['oasis', 'OASIS / PDGM'],
                  ['serviceAi', 'Service AI routing'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="rounded border-ink-300"
                    checked={org.settings.features?.[key] !== false}
                    onChange={() => toggleFeature(key)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="mt-4">
              <Button type="submit">Save settings</Button>
            </div>
          </Card>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ui-table-wrap">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="ui-section-title">Members</h2>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium text-ink-900">{m.fullName}</td>
                  <td className="text-sm text-ink-600">{m.email}</td>
                  <td className="text-xs text-ink-500">
                    {(m.roles ?? []).join(', ') || '—'}
                  </td>
                  <td>
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title="No members"
                      body="Missing user:admin permission, or org has no members yet."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Card>
          <h2 className="ui-section-title mb-4">Invite user</h2>
          <form onSubmit={(e) => void sendInvite(e)} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                placeholder="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </Field>
            <Field label="Full name">
              <Input
                placeholder="full name"
                value={inviteForm.fullName}
                onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
                required
              />
            </Field>
            <Field label="Role">
              <Select
                value={inviteForm.roleCode}
                onChange={(e) => setInviteForm((f) => ({ ...f, roleCode: e.target.value }))}
              >
                <option value="field_rn">field_rn</option>
                <option value="intake_coordinator">intake_coordinator</option>
                <option value="clinical_lead">clinical_lead</option>
                <option value="billing">billing</option>
                <option value="compliance">compliance</option>
                <option value="admin">admin</option>
              </Select>
            </Field>
            <Button type="submit" className="w-full">
              Create invite
            </Button>
            {lastInviteToken && (
              <Alert tone="success">
                Dev invite token (copy to Accept invite page):{' '}
                <code className="break-all text-xs">{lastInviteToken}</code>
              </Alert>
            )}
          </form>

          <div className="mt-6 border-t border-ink-100 pt-4">
            <h3 className="ui-section-title mb-3">Recent invites</h3>
            {invites.length === 0 ? (
              <p className="text-sm text-ink-400">None yet</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {i.email} · {i.roleCode}
                    </span>
                    <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
