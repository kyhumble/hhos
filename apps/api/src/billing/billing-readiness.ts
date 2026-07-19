/**
 * Deterministic billing readiness rules (HITL).
 * Hard gaps block export; soft gaps are warnings only.
 */
import type { BillingGap, BillingClaimType } from '@hhos/shared';

export type ReadinessContext = {
  careType: string;
  claimType: BillingClaimType;
  episodeStatus: string;
  primaryDxIcd10: string | null;
  ordersStatus: string;
  pocStatus: string;
  f2fStatus: string;
  intakeStatus: string;
  coverageVerifiedRequired: boolean;
  hasCoverage: boolean;
  hasVerifiedCoverage: boolean;
  oasisLocked: boolean;
  oasisPresent: boolean;
  /** Hospice */
  hospiceElectionStatus: string | null;
  hospiceTerminalDx: string | null;
  hospiceCertSigned: boolean;
  hospiceHasElection: boolean;
};

export function defaultClaimTypeForCare(careType: string): BillingClaimType {
  if (careType === 'hospice') return 'hospice_claim';
  return 'hh_rap';
}

export function evaluateBillingReadiness(ctx: ReadinessContext): {
  ready: boolean;
  gaps: BillingGap[];
  hardGapCount: number;
  softGapCount: number;
} {
  const gaps: BillingGap[] = [];
  const hard = (code: BillingGap['code'], message: string) =>
    gaps.push({ code, severity: 'hard', message });
  const soft = (code: BillingGap['code'], message: string) =>
    gaps.push({ code, severity: 'soft', message });

  if (ctx.episodeStatus === 'non_admit') {
    hard('EPISODE_NOT_ACTIVE', 'Non-admit episodes cannot be billed');
  } else if (ctx.episodeStatus === 'pre_admit') {
    soft(
      'EPISODE_NOT_ACTIVE',
      'Episode still pre-admit — confirm SOC/admission before payer submit',
    );
  }

  if (!ctx.primaryDxIcd10?.trim()) {
    hard('MISSING_PRIMARY_DX', 'Primary diagnosis ICD-10 is missing');
  }

  if (ctx.careType === 'hospice') {
    if (!ctx.hospiceHasElection) {
      hard('HOSPICE_ELECTION_INACTIVE', 'No hospice election on file');
    } else if (ctx.hospiceElectionStatus !== 'active') {
      hard(
        'HOSPICE_ELECTION_INACTIVE',
        `Hospice election status is "${ctx.hospiceElectionStatus ?? 'none'}"`,
      );
    }
    if (!ctx.hospiceTerminalDx?.trim() && !ctx.primaryDxIcd10?.trim()) {
      hard('HOSPICE_TERMINAL_DX_MISSING', 'Terminal / primary diagnosis required');
    }
    if (
      ctx.claimType === 'hospice_claim' ||
      ctx.claimType === 'hospice_noe'
    ) {
      if (!ctx.hospiceCertSigned) {
        hard(
          'HOSPICE_CERT_UNSIGNED',
          'Physician hospice certification package not signed (Phase 5 e-sign)',
        );
      }
    }
  } else {
    // Home health / wound / other
    if (ctx.ordersStatus !== 'signed') {
      hard(
        'ORDERS_UNSIGNED',
        `Orders status is "${ctx.ordersStatus}" — need signed physician orders`,
      );
    }
    if (
      (ctx.claimType === 'hh_rap' || ctx.claimType === 'hh_final') &&
      ctx.pocStatus !== 'signed'
    ) {
      hard(
        'POC_UNSIGNED',
        `Plan of care / 485 status is "${ctx.pocStatus}" — signature required`,
      );
    }
    if (ctx.f2fStatus === 'unknown' || ctx.f2fStatus === 'missing') {
      soft('F2F_INCOMPLETE', `Face-to-face status is "${ctx.f2fStatus}"`);
    }
    if (ctx.careType === 'home_health' && ctx.oasisPresent && !ctx.oasisLocked) {
      soft('OASIS_NOT_LOCKED', 'OASIS assessment present but not locked');
    }
  }

  if (!ctx.hasCoverage) {
    hard('COVERAGE_MISSING', 'No coverage record on patient');
  } else if (ctx.coverageVerifiedRequired && !ctx.hasVerifiedCoverage) {
    hard('COVERAGE_UNVERIFIED', 'Org requires verified coverage before billing');
  } else if (!ctx.hasVerifiedCoverage) {
    soft('COVERAGE_UNVERIFIED', 'Coverage not verified (advisory)');
  }

  if (ctx.intakeStatus === 'incomplete') {
    soft('INTAKE_INCOMPLETE', 'Intake checklist incomplete');
  }

  const hardGapCount = gaps.filter((g) => g.severity === 'hard').length;
  const softGapCount = gaps.filter((g) => g.severity === 'soft').length;
  return {
    ready: hardGapCount === 0,
    gaps,
    hardGapCount,
    softGapCount,
  };
}
