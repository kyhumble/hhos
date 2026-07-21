'use client';

import { Alert, Badge, Button, Card, PageHeader } from '@/components/ui';
import Link from 'next/link';

const CONNECTORS = [
  {
    name: 'Hospital / referral feed',
    status: 'ready',
    desc: 'Accept referrals via API (POST /v1/referrals) with idempotency keys. Map discharge packets into intake.',
    action: { label: 'Open referrals', href: '/referrals' },
  },
  {
    name: 'Physician e-sign',
    status: 'live',
    desc: 'Secure magic-link signing for 485s, orders, and certs. Wet-ink recording supported.',
    action: { label: 'Signature queue', href: '/orders' },
  },
  {
    name: 'Clearinghouse / claims',
    status: 'export',
    desc: 'Billing readiness gates + JSON claim package export. Wire your clearinghouse to the export payload.',
    action: { label: 'Billing readiness', href: '/billing' },
  },
  {
    name: 'OASIS / iQIES',
    status: 'planned',
    desc: 'Import OASIS export files and push locked assessments. Scrubber + QA worklist are in-app today.',
    action: { label: 'OASIS review', href: '/oasis' },
  },
  {
    name: 'EVV / scheduling',
    status: 'partial',
    desc: 'Visit tasks and routing suggestions exist. Connect your EVV vendor for clock-in compliance.',
    action: { label: 'Visits', href: '/field-tasks' },
  },
  {
    name: 'Webhooks outbound',
    status: 'planned',
    desc: 'Episode status, signature completed, claim ready — notify your CRM or RCM stack.',
    action: null,
  },
];

function statusBadge(s: string) {
  switch (s) {
    case 'live':
      return <Badge tone="success">Live in Lumina</Badge>;
    case 'ready':
      return <Badge tone="brand">API ready</Badge>;
    case 'export':
      return <Badge tone="brand">Export ready</Badge>;
    case 'partial':
      return <Badge tone="warn">Partial</Badge>;
    default:
      return <Badge tone="neutral">Planned</Badge>;
  }
}

export default function IntegrationsPage() {
  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Agency"
        title="Integrations"
        description="Connect hospitals, physicians, clearinghouses, and EVV without leaving the operating system."
      />

      <Alert tone="info">
        <span>
          <strong className="font-semibold">Day-one path.</strong> Referrals and physician sign links
          work now. Point external systems at the API; use this page as your integration map.
        </span>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        {CONNECTORS.map((c) => (
          <Card key={c.name}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900">{c.name}</h3>
              {statusBadge(c.status)}
            </div>
            <p className="mt-2 text-sm leading-snug text-ink-600">{c.desc}</p>
            {c.action && (
              <div className="mt-3">
                <Link href={c.action.href}>
                  <Button size="sm" variant="secondary">
                    {c.action.label}
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="bg-ink-50/40">
        <div className="ui-kicker">API</div>
        <p className="mt-1 text-sm text-ink-700">
          OpenAPI docs when the API is running:{' '}
          <a
            className="ui-link"
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
          >
            localhost:3001/docs
          </a>
        </p>
        <p className="mt-2 text-sm text-ink-500">
          Auth: Bearer token from demo login. Multi-tenant by organization. Idempotency-Key supported
          on referral create.
        </p>
      </Card>
    </div>
  );
}
