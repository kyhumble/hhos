'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import { getToken } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const STEPS = [
  'Create org',
  'Modules',
  'Invite staff',
  'First patient',
] as const;

export default function OnboardPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: 'Northside Wound Care LLC',
    slug: 'northside-wound',
    timezone: 'America/Chicago',
    adminEmail: 'admin@northside.demo',
    adminFullName: 'Nora Northside',
  });
  const [modules, setModules] = useState({
    woundPhotos: true,
    oasis: true,
    serviceAi: true,
    ordersEsign: true,
    hospice: true,
    billing: true,
  });
  const [invite, setInvite] = useState({
    email: '',
    fullName: '',
    roleCode: 'intake_coordinator',
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [orgCreated, setOrgCreated] = useState(false);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${API_URL}/v1/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.message ?? 'Create failed');
        return;
      }
      storeSession(data.accessToken as string, data.user as SessionUser);
      setOrgCreated(true);
      setOk(`Created ${data.organization?.name}. Signed in as admin.`);
      setStep(1);
    } catch {
      setError('Could not reach API on :3001');
    } finally {
      setLoading(false);
    }
  }

  async function saveModules(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session missing — create org first.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/orgs/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features: modules,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Save modules failed');
        return;
      }
      setOk('Module flags saved for this tenant.');
      setStep(2);
    } catch {
      setError('API unreachable');
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteToken(null);
    const token = getToken();
    if (!token) {
      setError('Session missing — create org first.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/orgs/me/invites`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invite),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Invite failed');
        return;
      }
      if (data.inviteToken) setInviteToken(data.inviteToken);
      setOk(
        data.delivery
          ? `Invite ${data.delivery.status} for ${data.invite?.email}`
          : `Invited ${data.invite?.email}`,
      );
      setStep(3);
    } catch {
      setError('API unreachable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-page mx-auto max-w-xl">
      <PageHeader
        eyebrow="Onboarding"
        title="Agency setup wizard"
        description="Create your tenant, enable modules, invite staff, and open the first patient path."
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <Badge key={label} tone={i === step ? 'brand' : i < step ? 'success' : 'neutral'}>
              {i + 1}. {label}
            </Badge>
          ))}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}

      {step === 0 && (
        <Card>
          <h2 className="ui-section-title mb-4">1. Create organization</h2>
          <form onSubmit={(e) => void createOrg(e)} className="space-y-3">
            {(
              [
                ['name', 'Agency name'],
                ['slug', 'Slug (kebab-case)'],
                ['timezone', 'Timezone'],
                ['adminEmail', 'Admin email'],
                ['adminFullName', 'Admin full name'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required
                />
              </Field>
            ))}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create org & sign in'}
            </Button>
          </form>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="ui-section-title mb-4">2. Enable modules</h2>
          <p className="mb-3 text-sm text-ink-500">
            Platform env flags remain kill switches. These are per-tenant overrides.
          </p>
          <form onSubmit={(e) => void saveModules(e)} className="space-y-3">
            {(
              [
                ['woundPhotos', 'Wound photos'],
                ['oasis', 'OASIS / PDGM'],
                ['serviceAi', 'Service AI routing'],
                ['ordersEsign', 'Orders / 485 e-sign'],
                ['hospice', 'Hospice'],
                ['billing', 'Billing readiness'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  className="rounded border-ink-300"
                  checked={modules[key]}
                  onChange={() => setModules((m) => ({ ...m, [key]: !m[key] }))}
                />
                {label}
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit" disabled={loading || !orgCreated && !getToken()}>
                {loading ? 'Saving…' : 'Save & continue'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h2 className="ui-section-title mb-4">3. Invite staff</h2>
          <form onSubmit={(e) => void sendInvite(e)} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                required
                value={invite.email}
                onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
              />
            </Field>
            <Field label="Full name">
              <Input
                required
                value={invite.fullName}
                onChange={(e) => setInvite((i) => ({ ...i, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Role">
              <Select
                value={invite.roleCode}
                onChange={(e) => setInvite((i) => ({ ...i, roleCode: e.target.value }))}
              >
                <option value="intake_coordinator">intake_coordinator</option>
                <option value="field_rn">field_rn</option>
                <option value="clinical_lead">clinical_lead</option>
                <option value="billing">billing</option>
                <option value="compliance">compliance</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send invite'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
            </div>
          </form>
          {inviteToken && (
            <Alert tone="info">
              Dev invite token:{' '}
              <code className="break-all text-xs">{inviteToken}</code>
              <div className="mt-1">
                <Link className="ui-link" href={`/invite?token=${encodeURIComponent(inviteToken)}`}>
                  Open accept page
                </Link>
              </div>
            </Alert>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h2 className="ui-section-title mb-2">4. First patient path</h2>
          <p className="mb-4 text-sm text-ink-500">
            Create a synthetic patient, open intake, and start an episode checklist. Never use real
            ePHI in local/staging.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/patients/new">
              <Button>Create patient</Button>
            </Link>
            <Link href="/intake">
              <Button variant="secondary">Intake worklist</Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost">Org admin</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          </div>
          <div className="mt-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
