'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { getStoredUser, type SessionUser } from '@/lib/auth';
import { NavIcon } from '@/lib/nav-icons';

const QUEUES = [
  {
    title: 'AI Assist',
    desc: 'HITL notes, OASIS & risk suggestions',
    href: '/ai-assist',
    icon: 'ai',
    meta: 'Lumina',
  },
  {
    title: 'Intake worklist',
    desc: 'SOC risk, checklists, consents',
    href: '/intake',
    icon: 'intake',
    meta: 'Clinical',
  },
  {
    title: 'Orders / 485',
    desc: 'Physician signatures outstanding',
    href: '/orders',
    icon: 'orders',
    meta: 'Compliance',
  },
  {
    title: 'OASIS review',
    desc: 'Assessments awaiting lead review',
    href: '/oasis',
    icon: 'oasis',
    meta: 'Clinical',
  },
  {
    title: 'Billing readiness',
    desc: 'Gaps before claim export',
    href: '/billing',
    icon: 'billing',
    meta: 'Revenue',
  },
  {
    title: 'Routing HITL',
    desc: 'Accept / reject suggestions',
    href: '/routing',
    icon: 'routing',
    meta: 'Ops',
  },
  {
    title: 'Hospice',
    desc: 'Elections, LOC, cert packages',
    href: '/hospice',
    icon: 'hospice',
    meta: 'Compliance',
  },
  {
    title: 'Field tasks',
    desc: 'Visit tasks & hospital alerts',
    href: '/field-tasks',
    icon: 'field',
    meta: 'Ops',
  },
  {
    title: 'Org admin',
    desc: 'Members, invites, modules',
    href: '/admin',
    icon: 'admin',
    meta: 'Platform',
  },
];

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const first = user?.fullName.split(' ')[0] ?? null;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Lumina · Command center"
        title={first ? `Good to see you, ${first}` : 'Home Health Operating System'}
        description="Clarity for every visit. Intelligence for every decision. Work queues for intake, AI assist, signatures, OASIS, and billing."
        actions={
          user ? (
            <div className="flex gap-2">
              <Link href="/ai-assist">
                <Button>AI Assist</Button>
              </Link>
              <Link href="/patients/new">
                <Button variant="secondary">New patient</Button>
              </Link>
            </div>
          ) : (
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          )
        }
      />

      <Alert tone="warn">
        <span>
          <strong className="font-semibold">Demo environment</strong> — no real ePHI. Consent
          language is NOT LEGAL FINAL.
        </span>
      </Alert>

      {!user && (
        <Card className="border-teal-100 bg-teal-50/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-ink-900">Sign in to load worklists</div>
              <p className="mt-0.5 text-sm text-ink-600">
                Use{' '}
                <code className="rounded bg-white px-1 font-mono text-xs ring-1 ring-ink-200">
                  coord@demo.local
                </code>{' '}
                or{' '}
                <code className="rounded bg-white px-1 font-mono text-xs ring-1 ring-ink-200">
                  lead@demo.local
                </code>{' '}
                — no password.
              </p>
            </div>
            <Link href="/login">
              <Button variant="secondary">Open login</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Session" value={user ? 'Signed in' : 'Guest'} hint={user?.email ?? '—'} />
        <StatCard
          label="Role"
          value={user?.roles[0]?.replace(/_/g, ' ') ?? '—'}
          hint="Permission-scoped nav"
          tone="brand"
        />
        <StatCard label="HITL" value="Required" hint="No auto-sign / auto-claim" tone="warn" />
        <StatCard label="Tenant" value="org_id" hint="RLS ready for stage/prod" tone="success" />
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Work queues</h2>
          <span className="text-2xs text-ink-400">Open a queue to act</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {QUEUES.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={`group flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-soft transition hover:shadow-card ${
                q.href === '/ai-assist'
                  ? 'border-teal-200 hover:border-teal-300'
                  : 'border-ink-200 hover:border-brand-300'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
                  q.href === '/ai-assist'
                    ? 'bg-teal-50 text-teal-700 ring-teal-100 group-hover:bg-teal-100'
                    : 'bg-ink-50 text-ink-600 ring-ink-100 group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:ring-brand-100'
                }`}
              >
                <NavIcon name={q.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm font-semibold text-ink-900 ${
                      q.href === '/ai-assist' ? 'group-hover:text-teal-800' : 'group-hover:text-brand-800'
                    }`}
                  >
                    {q.title}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">{q.desc}</span>
                <span className="mt-1.5 inline-block">
                  <Badge tone={q.meta === 'Lumina' ? 'brand' : 'neutral'}>{q.meta}</Badge>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="ui-kicker">API</div>
          <a
            href="http://localhost:3001/docs"
            className="mt-1 block text-sm font-semibold text-brand-700 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            OpenAPI /docs
          </a>
          <p className="mt-1 text-xs text-ink-500">:3001 · /ready</p>
        </Card>
        <Card>
          <div className="ui-kicker">Onboarding</div>
          <Link href="/onboard" className="mt-1 block text-sm font-semibold text-brand-700 hover:underline">
            Agency wizard
          </Link>
          <p className="mt-1 text-xs text-ink-500">Org · modules · invites</p>
        </Card>
        <Card>
          <div className="ui-kicker">Security</div>
          <p className="mt-1 text-sm font-semibold text-ink-900">RLS · audit · HITL</p>
          <p className="mt-1 text-xs text-ink-500">MFA path for admin / compliance</p>
        </Card>
      </div>
    </div>
  );
}
