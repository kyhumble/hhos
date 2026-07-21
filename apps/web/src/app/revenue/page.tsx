'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { API_URL, authHeaders, getToken } from '@/lib/api';

type OrderPkg = {
  id: string;
  title: string;
  status: string;
  physicianName: string;
  overdue?: boolean;
  patientLabel?: string;
  docType?: string;
};

type BillingItem = {
  episodeId: string;
  patientName: string;
  ready: boolean;
  hardGapCount: number;
  topGaps: { code: string; severity: string; message: string }[];
};

type OasisRow = {
  id: string;
  timepoint: string;
  status: string;
  completenessScore: number;
  flagsJson?: { code: string; severity: string; message: string }[];
};

function gapLabel(code: string, message: string) {
  const map: Record<string, string> = {
    ORDERS_UNSIGNED: 'Orders not signed',
    POC_UNSIGNED: 'Plan of care not signed',
    HOSPICE_CERT_UNSIGNED: 'Hospice cert not signed',
    MISSING_PRIMARY_DX: 'Primary diagnosis missing',
    COVERAGE_MISSING: 'Coverage missing',
    COVERAGE_UNVERIFIED: 'Coverage unverified',
    OASIS_NOT_LOCKED: 'Assessment not locked',
    F2F_INCOMPLETE: 'Face-to-face incomplete',
  };
  return map[code] ?? message;
}

export default function RevenueIntegrityPage() {
  const [orders, setOrders] = useState<OrderPkg[]>([]);
  const [billing, setBilling] = useState<BillingItem[]>([]);
  const [oasis, setOasis] = useState<OasisRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Sign in to view revenue integrity.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const headers = authHeaders(token);
    try {
      const [oRes, bRes, aRes] = await Promise.all([
        fetch(`${API_URL}/v1/worklists/orders-signatures`, { headers }),
        fetch(`${API_URL}/v1/worklists/billing`, { headers }),
        fetch(`${API_URL}/v1/worklists/oasis-review`, { headers }),
      ]);

      if (oRes.ok) {
        const d = await oRes.json();
        setOrders(d.data ?? []);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBilling(d.data ?? []);
      }
      if (aRes.ok) {
        const d = await aRes.json();
        setOasis(d.data ?? []);
      }

      if (!oRes.ok && !bRes.ok && !aRes.ok) {
        setError('Could not load revenue queues. Check API and feature flags.');
      } else {
        setError(null);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overdueSigs = orders.filter((o) => o.overdue).length;
  const waitingSigs = orders.filter((o) => o.status === 'sent' || o.status === 'viewed').length;
  const blockedEpisodes = billing.filter((b) => !b.ready).length;
  const chartsInReview = oasis.length;
  const signatureGaps = billing.filter((b) =>
    (b.topGaps ?? []).some((g) =>
      ['ORDERS_UNSIGNED', 'POC_UNSIGNED', 'HOSPICE_CERT_UNSIGNED'].includes(g.code),
    ),
  ).length;

  const auditScore = (() => {
    // Simple defensibility score inspired by ClearBill: fewer open risks → higher score
    const risk =
      overdueSigs * 12 + waitingSigs * 4 + blockedEpisodes * 8 + chartsInReview * 3;
    return Math.max(0, Math.min(100, 100 - risk));
  })();

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="Records"
        title="Revenue integrity"
        description="See what puts reimbursement at risk — unsigned orders, open OASIS review, and billing gaps — in one place."
        actions={
          <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">
            Audit-defensibility
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-ink-900">{auditScore}</div>
          <p className="mt-1 text-xs text-ink-500">Higher is healthier (demo score)</p>
        </Card>
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-red-600">
            Overdue signatures
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-ink-900">{overdueSigs}</div>
          <Link href="/orders" className="mt-1 inline-block text-xs font-medium text-teal-700 hover:underline">
            Chase now →
          </Link>
        </Card>
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-amber-700">
            Episodes blocked
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-ink-900">
            {blockedEpisodes}
          </div>
          <Link href="/billing" className="mt-1 inline-block text-xs font-medium text-teal-700 hover:underline">
            Billing readiness →
          </Link>
        </Card>
        <Card className="!p-4">
          <div className="text-2xs font-semibold uppercase tracking-wide text-teal-700">
            Charts in QA
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-ink-900">
            {chartsInReview}
          </div>
          <Link href="/oasis" className="mt-1 inline-block text-xs font-medium text-teal-700 hover:underline">
            OASIS review →
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Priority: physician signatures</h2>
            <Badge tone="warn">{waitingSigs + overdueSigs} open</Badge>
          </div>
          {orders.length === 0 ? (
            <Card>
              <EmptyState
                title="No open signature packages"
                body="When 485s or orders need a physician signature, they appear here."
              />
            </Card>
          ) : (
            orders.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className={`rounded-xl border bg-white p-3.5 shadow-soft ${
                  o.overdue ? 'border-red-200' : 'border-ink-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{o.title}</div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {o.physicianName}
                      {o.patientLabel ? ` · Patient ${o.patientLabel}` : ''}
                    </p>
                  </div>
                  <Badge tone={o.overdue ? 'danger' : 'warn'}>
                    {o.overdue ? 'Overdue' : o.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
          <Link href="/orders">
            <Button variant="secondary" size="sm">
              Open signature queue
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Revenue at risk by cause</h2>
            <Badge tone="neutral">{signatureGaps} signature-related</Badge>
          </div>
          {billing.filter((b) => !b.ready).length === 0 ? (
            <Card>
              <EmptyState
                title="No hard billing gaps"
                body="Episodes look clear for claim packaging, or billing worklist is empty."
              />
            </Card>
          ) : (
            billing
              .filter((b) => !b.ready)
              .slice(0, 6)
              .map((b) => (
                <div
                  key={b.episodeId}
                  className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{b.patientName}</div>
                      <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
                        {(b.topGaps ?? []).slice(0, 3).map((g) => (
                          <li key={g.code}>• {gapLabel(g.code, g.message)}</li>
                        ))}
                      </ul>
                    </div>
                    <Badge tone="danger">{b.hardGapCount} hard</Badge>
                  </div>
                </div>
              ))
          )}
          <Link href="/billing">
            <Button variant="secondary" size="sm">
              Open billing readiness
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-teal-100 bg-gradient-to-br from-teal-50/50 to-white">
        <div className="ui-kicker">From ClearBill HH</div>
        <h3 className="mt-1 text-sm font-semibold text-ink-900">Audit posture</h3>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          ClearBill focused on OASIS chart review, PDGM optimization, and ADR defense. Lumina folds
          that into the same system that runs intake, orders, and billing — so QA and revenue teams
          work from live episode data, not a separate silo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/oasis">
            <Button size="sm">OASIS QA worklist</Button>
          </Link>
          <Link href="/integrations">
            <Button size="sm" variant="secondary">
              EHR & integrations
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
