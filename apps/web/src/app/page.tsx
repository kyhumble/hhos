'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, PageHeader } from '@/components/ui';
import { getStoredUser, type SessionUser } from '@/lib/auth';
import { NavIcon } from '@/lib/nav-icons';

const QUEUES = [
  {
    title: 'Referrals',
    desc: 'Take new referrals and start intake',
    href: '/referrals',
    icon: 'referrals',
    featured: true,
  },
  {
    title: 'Intake',
    desc: 'Start-of-care readiness and checklists',
    href: '/intake',
    icon: 'intake',
  },
  {
    title: 'Orders',
    desc: 'Chase physician signatures on 485s and orders',
    href: '/orders',
    icon: 'orders',
  },
  {
    title: 'Revenue integrity',
    desc: 'Signatures, OASIS QA, and billing gaps',
    href: '/revenue',
    icon: 'billing',
    featured: true,
  },
  {
    title: 'Assessments',
    desc: 'OASIS QA worklist and scrub flags',
    href: '/oasis',
    icon: 'oasis',
  },
  {
    title: 'Billing',
    desc: 'Claim readiness and export packages',
    href: '/billing',
    icon: 'billing',
  },
  {
    title: 'AI Assist',
    desc: 'Draft notes and assessment help to review',
    href: '/ai-assist',
    icon: 'ai',
  },
  {
    title: 'Schedule',
    desc: 'Routes and visit assignments',
    href: '/routing',
    icon: 'routing',
  },
  {
    title: 'Integrations',
    desc: 'Hospitals, e-sign, clearinghouse, EVV',
    href: '/integrations',
    icon: 'admin',
  },
];

function roleLabel(role?: string) {
  if (!role) return 'Team member';
  const map: Record<string, string> = {
    intake_coordinator: 'Intake coordinator',
    field_rn: 'Field clinician',
    clinical_lead: 'Clinical lead',
    billing: 'Billing',
    compliance: 'Compliance',
    admin: 'Administrator',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const first = user?.fullName.split(' ')[0] ?? null;

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Home"
        title={first ? `Welcome back, ${first}` : 'Welcome to Lumina'}
        description="From referral to claim — take work in, clear signatures, protect revenue."
        actions={
          user ? (
            <div className="flex gap-2">
              <Link href="/referrals">
                <Button>New referral</Button>
              </Link>
              <Link href="/patients/new">
                <Button variant="secondary">Add patient</Button>
              </Link>
            </div>
          ) : (
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          )
        }
      />

      <Alert tone="info">
        <span>
          <strong className="font-semibold">Demo only.</strong> Sample data — not real patients.
        </span>
      </Alert>

      {!user && (
        <Card className="border-teal-100 bg-teal-50/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-ink-900">Sign in to get started</div>
              <p className="mt-0.5 text-sm text-ink-600">
                Try{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs ring-1 ring-ink-200">
                  coord@demo.local
                </code>{' '}
                — no password needed.
              </p>
            </div>
            <Link href="/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </div>
        </Card>
      )}

      {user && (
        <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft">
          <p className="text-sm text-ink-600">
            Signed in as <span className="font-semibold text-ink-900">{user.fullName}</span>
            <span className="text-ink-400"> · </span>
            <span className="text-ink-700">{roleLabel(user.roles[0])}</span>
          </p>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Where to next</h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {QUEUES.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={`group flex items-start gap-3.5 rounded-xl border bg-white p-4 shadow-soft transition hover:shadow-card ${
                q.featured
                  ? 'border-teal-200 hover:border-teal-300'
                  : 'border-ink-200/90 hover:border-teal-200'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  q.featured
                    ? 'bg-teal-50 text-teal-700 ring-teal-100 group-hover:bg-teal-100'
                    : 'bg-ink-50 text-ink-600 ring-ink-100 group-hover:bg-teal-50 group-hover:text-teal-700 group-hover:ring-teal-100'
                }`}
              >
                <NavIcon name={q.icon} className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-sm font-semibold text-ink-900 group-hover:text-teal-800">
                  {q.title}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-500">{q.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
