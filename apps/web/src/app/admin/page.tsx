'use client';

import { useEffect, useState } from 'react';
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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Organization admin</h1>
        <p className="text-sm text-slate-600">
          Multi-tenant settings, members, and invites. Data is always scoped by{' '}
          <code className="rounded bg-slate-100 px-1">org_id</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{error}</div>
      )}
      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{msg}</div>
      )}

      {org && (
        <form onSubmit={(e) => void saveSettings(e)} className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Tenant profile</h2>
          <div className="text-xs text-slate-500 font-mono">
            {org.id} · slug <strong>{org.slug}</strong>
          </div>
          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={org.name}
              onChange={(e) => setOrg({ ...org, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Timezone
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={org.timezone}
              onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            SOC due hours
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={org.settings.socDueHours ?? 48}
              onChange={(e) =>
                setOrg({
                  ...org,
                  settings: { ...org.settings, socDueHours: Number(e.target.value) },
                })
              }
            />
          </label>
          <fieldset className="space-y-1 text-sm">
            <legend className="font-medium">Module flags (per-tenant; platform env is kill switch)</legend>
            {(
              [
                ['woundPhotos', 'Wound photos'],
                ['oasis', 'OASIS / PDGM'],
                ['serviceAi', 'Service AI routing'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={org.settings.features?.[key] !== false}
                  onChange={() => toggleFeature(key)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
            Save settings
          </button>
        </form>
      )}

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="text-sm space-y-1">
          {members.map((m) => (
            <li key={m.id}>
              <strong>{m.fullName}</strong> · {m.email} · {m.status} ·{' '}
              {(m.roles ?? []).join(', ') || 'no role'}
            </li>
          ))}
          {members.length === 0 && <li className="text-slate-500">No members (or missing user:admin)</li>}
        </ul>
      </section>

      <form onSubmit={(e) => void sendInvite(e)} className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold">Invite user</h2>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="email"
          type="email"
          value={inviteForm.email}
          onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="full name"
          value={inviteForm.fullName}
          onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
          required
        />
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={inviteForm.roleCode}
          onChange={(e) => setInviteForm((f) => ({ ...f, roleCode: e.target.value }))}
        >
          <option value="field_rn">field_rn</option>
          <option value="intake_coordinator">intake_coordinator</option>
          <option value="clinical_lead">clinical_lead</option>
          <option value="billing">billing</option>
          <option value="compliance">compliance</option>
          <option value="admin">admin</option>
        </select>
        <button type="submit" className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
          Create invite
        </button>
        {lastInviteToken && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs break-all">
            Dev invite token (copy to Accept invite page):{' '}
            <code>{lastInviteToken}</code>
          </div>
        )}
      </form>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold mb-2">Recent invites</h2>
        <ul className="text-sm space-y-1">
          {invites.map((i) => (
            <li key={i.id}>
              {i.email} · {i.roleCode} · {i.status}
            </li>
          ))}
          {invites.length === 0 && <li className="text-slate-500">None yet</li>}
        </ul>
      </section>
    </div>
  );
}
