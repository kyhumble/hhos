'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { getStoredUser, type SessionUser } from '@/lib/auth';
import { NavIcon } from '@/lib/nav-icons';

const MODULES = [
  {
    title: 'Intake',
    desc: 'Referrals, checklists, consents, and SOC readiness in one worklist.',
    href: '/intake',
    tone: 'brand' as const,
    tag: 'Clinical',
    icon: 'intake',
  },
  {
    title: 'Orders / 485',
    desc: 'Physician signatures — the biggest billing hangup, closed HITL.',
    href: '/orders',
    tone: 'warn' as const,
    tag: 'Compliance',
    icon: 'orders',
  },
  {
    title: 'Hospice',
    desc: 'Elections, levels of care, benefit periods, and cert packages.',
    href: '/hospice',
    tone: 'brand' as const,
    tag: 'Hospice',
    icon: 'hospice',
  },
  {
    title: 'Billing',
    desc: 'Readiness gaps and claim export packages — never auto-submit.',
    href: '/billing',
    tone: 'success' as const,
    tag: 'Revenue',
    icon: 'billing',
  },
  {
    title: 'Routing',
    desc: 'Explainable clinician suggestions. Accept is always required.',
    href: '/routing',
    tone: 'neutral' as const,
    tag: 'Ops',
    icon: 'routing',
  },
  {
    title: 'OASIS',
    desc: 'E2 subset assessments and advisory PDGM / LUPA flags.',
    href: '/oasis',
    tone: 'neutral' as const,
    tag: 'Clinical',
    icon: 'oasis',
  },
  {
    title: 'Field tasks',
    desc: 'Visit tasks and hospitalization alerts for field ops.',
    href: '/field-tasks',
    tone: 'neutral' as const,
    tag: 'Ops',
    icon: 'field',
  },
  {
    title: 'Org admin',
    desc: 'Members, invites, and per-tenant module flags.',
    href: '/admin',
    tone: 'neutral' as const,
    tag: 'Platform',
    icon: 'admin',
  },
];

const QUICK = [
  { href: '/patients/new', label: 'New patient', icon: 'onboard' },
  { href: '/intake', label: 'Intake queue', icon: 'intake' },
  { href: '/orders', label: 'Chase signatures', icon: 'orders' },
  { href: '/billing', label: 'Billing readiness', icon: 'billing' },
];

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const first = user?.fullName.split(' ')[0] ?? null;

  return (
    <div className="ui-page">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-800/20 bg-sidebar-lux px-6 py-8 text-white shadow-lift sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-hero-shine" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Operations console
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {first ? `Welcome back, ${first}` : 'Home Health & Hospice OS'}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-brand-100/80">
              Coordinate intake, clinical docs, physician signatures, hospice, and billing readiness —
              designed for agencies that cannot afford hung claims or missing signatures.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {user ? (
                <>
                  <Link href="/intake" className="ui-btn-primary !bg-white !text-brand-800 hover:!bg-brand-50">
                    Open intake
                  </Link>
                  <Link
                    href="/orders"
                    className="ui-btn border border-white/25 bg-white/10 text-white hover:bg-white/15"
                  >
                    Orders / 485
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="ui-btn-primary !bg-white !text-brand-800 hover:!bg-brand-50">
                    Sign in
                  </Link>
                  <Link
                    href="/onboard"
                    className="ui-btn border border-white/25 bg-white/10 text-white hover:bg-white/15"
                  >
                    Create agency
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Scope</div>
              <div className="mt-1 font-display text-lg font-semibold">HH + Hospice</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Platform</div>
              <div className="mt-1 font-display text-lg font-semibold">Phases 0–9</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                Session
              </div>
              <div className="mt-1 truncate text-sm font-semibold">
                {user ? `${user.email} · ${user.roles[0]?.replace(/_/g, ' ')}` : 'Not signed in'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Alert tone="warn">
        <strong className="font-semibold">Compliance notice:</strong> No real ePHI in this
        environment. Consent templates are placeholder (NOT LEGAL FINAL). BAAs required before
        production PHI.
      </Alert>

      {!user && (
        <Card className="border-brand-200/80 bg-gradient-to-br from-brand-50 via-white to-emerald-50/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-glow">
                <NavIcon name="admin" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-ink-950">
                  Dev login ready
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">
                  Try{' '}
                  <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm ring-1 ring-ink-100">
                    coord@demo.local
                  </code>{' '}
                  or{' '}
                  <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm ring-1 ring-ink-100">
                    admin@demo.local
                  </code>{' '}
                  — no password.
                </p>
              </div>
            </div>
            <Link href="/login">
              <Button variant="secondary">Go to login</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Modules online" value="8+" hint="Intake through billing" tone="brand" />
        <StatCard label="HITL required" value="Always" hint="No auto-sign / auto-claim" tone="warn" />
        <StatCard label="Tenant model" value="org_id" hint="RLS ready for stage/prod" tone="success" />
        <StatCard label="Data mode" value="Synthetic" hint="Demo environment only" tone="neutral" />
      </div>

      {/* Quick actions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink-900">Quick actions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center gap-3 rounded-2xl border border-ink-200/80 bg-white px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
                <NavIcon name={q.icon} className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-ink-800 group-hover:text-brand-800">
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Modules */}
      <div>
        <PageHeader
          title="Workspace modules"
          description="Jump into clinical, operations, compliance, and revenue workflows."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group ui-card-interactive flex flex-col">
              <div className="mb-4 flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-ink-50 text-brand-700 ring-1 ring-ink-100 transition group-hover:from-brand-600 group-hover:to-brand-700 group-hover:text-white group-hover:ring-brand-600 group-hover:shadow-glow">
                  <NavIcon name={m.icon} className="h-[18px] w-[18px]" />
                </span>
                <Badge tone={m.tone}>{m.tag}</Badge>
              </div>
              <h3 className="font-display text-[15px] font-semibold text-ink-950 group-hover:text-brand-800">
                {m.title}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-500">{m.desc}</p>
              <div className="mt-4 flex items-center text-xs font-bold uppercase tracking-wide text-brand-600 opacity-0 transition group-hover:opacity-100">
                Open
                <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-white to-brand-50/40">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">API</div>
          <a
            href="http://localhost:3001/docs"
            className="mt-2 block font-display text-sm font-semibold text-brand-700 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            OpenAPI · /docs →
          </a>
          <p className="mt-1 text-xs text-ink-500">NestJS on :3001 · readiness /ready</p>
        </Card>
        <Card className="bg-gradient-to-br from-white to-emerald-50/30">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            Security
          </div>
          <p className="mt-2 font-display text-sm font-semibold text-ink-900">
            RLS · audit · HITL
          </p>
          <p className="mt-1 text-xs text-ink-500">Tenant isolation + privileged MFA path</p>
        </Card>
        <Card className="bg-gradient-to-br from-white to-amber-50/30">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            Onboarding
          </div>
          <Link href="/onboard" className="mt-2 block font-display text-sm font-semibold text-brand-700 hover:underline">
            Agency setup wizard →
          </Link>
          <p className="mt-1 text-xs text-ink-500">Org · modules · invites · first patient</p>
        </Card>
      </div>
    </div>
  );
}
