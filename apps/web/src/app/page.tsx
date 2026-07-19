'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, PageHeader } from '@/components/ui';
import { getStoredUser, type SessionUser } from '@/lib/auth';

const MODULES = [
  {
    title: 'Intake',
    desc: 'Referrals, checklists, consents, and SOC readiness.',
    href: '/intake',
    tone: 'brand' as const,
    tag: 'Clinical',
  },
  {
    title: 'Orders / 485',
    desc: 'Physician signatures — the biggest billing hangup, closed HITL.',
    href: '/orders',
    tone: 'warn' as const,
    tag: 'Compliance',
  },
  {
    title: 'Hospice',
    desc: 'Elections, levels of care, and cert packages.',
    href: '/hospice',
    tone: 'brand' as const,
    tag: 'Hospice',
  },
  {
    title: 'Billing',
    desc: 'Readiness gaps and claim export packages.',
    href: '/billing',
    tone: 'success' as const,
    tag: 'Revenue',
  },
  {
    title: 'Routing',
    desc: 'Explainable clinician suggestions — accept required.',
    href: '/routing',
    tone: 'neutral' as const,
    tag: 'Ops',
  },
  {
    title: 'OASIS',
    desc: 'E2 subset assessments and PDGM advisory flags.',
    href: '/oasis',
    tone: 'neutral' as const,
    tag: 'Clinical',
  },
  {
    title: 'Field tasks',
    desc: 'Visit tasks and hospitalization alerts.',
    href: '/field-tasks',
    tone: 'neutral' as const,
    tag: 'Ops',
  },
  {
    title: 'Org admin',
    desc: 'Members, invites, and per-tenant feature flags.',
    href: '/admin',
    tone: 'neutral' as const,
    tag: 'Platform',
  },
];

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Operations console"
        title={user ? `Welcome, ${user.fullName.split(' ')[0]}` : 'Home Health & Hospice OS'}
        description="Coordinate intake, clinical docs, physician signatures, hospice, and billing readiness — synthetic demo data only."
        actions={
          !user ? (
            <Link href="/login" className="ui-btn-primary">
              Sign in
            </Link>
          ) : (
            <Link href="/intake" className="ui-btn-primary">
              Open intake
            </Link>
          )
        }
      />

      <Alert tone="warn">
        <strong className="font-semibold">Compliance:</strong> No real ePHI in this environment.
        Consent templates are placeholder (NOT LEGAL FINAL). BAAs required before production PHI.
      </Alert>

      {!user && (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Dev login ready</h2>
              <p className="mt-1 text-sm text-ink-600">
                Try <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">coord@demo.local</code>{' '}
                or <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">admin@demo.local</code> —
                no password.
              </p>
            </div>
            <Link href="/login" className="ui-btn-secondary shrink-0">
              Go to login
            </Link>
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group ui-card-pad transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge tone={m.tone}>{m.tag}</Badge>
                <span className="text-ink-300 transition group-hover:text-brand-600">→</span>
              </div>
              <h3 className="text-base font-semibold text-ink-950 group-hover:text-brand-800">
                {m.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-ink-400">API</div>
          <a
            href="http://localhost:3001/docs"
            className="mt-1 block text-sm font-semibold text-brand-700 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            OpenAPI /docs →
          </a>
          <p className="mt-1 text-xs text-ink-500">NestJS on :3001</p>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-ink-400">Phases</div>
          <p className="mt-1 text-sm font-semibold text-ink-900">0–8 on main</p>
          <p className="mt-1 text-xs text-ink-500">Intake through RLS hardening</p>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-ink-400">Scope</div>
          <p className="mt-1 text-sm font-semibold text-ink-900">HH + Hospice</p>
          <p className="mt-1 text-xs text-ink-500">No longevity modules</p>
        </Card>
      </div>
    </div>
  );
}
