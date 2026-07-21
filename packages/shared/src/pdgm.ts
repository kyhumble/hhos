/**
 * PDGM / LUPA **advisory** helpers for Phase 3 / AetherCare.
 *
 * NOT a CMS grouper, official HIPPS engine, or payment determination.
 * Always surface as non-authoritative. Human review + override required.
 *
 * CY 2026 readiness notes:
 * - Official case-mix weights, functional impairment levels, comorbidity
 *   subgroups, and LUPA thresholds were recalibrated using CY 2024 claims.
 * - Future: replace proxy logic with loaded CMS weight tables via
 *   loadPdgmWeights(jsonOrCsv) once validated files are available.
 * - Re-validate every threshold and mapping against current CMS final rule
 *   and the agency MAC before any production use.
 */

import {
  DEFAULT_LUPA_VISIT_THRESHOLD,
  type OasisFlagCode,
} from './enums';
import { OASIS_E2_ITEMS, type OasisItemDef } from './oasis-e2-items';

export type OasisAnswerMap = Record<string, string | number | boolean | null | undefined>;

export type OasisFlag = {
  code: OasisFlagCode;
  severity: 'error' | 'warn' | 'info';
  message: string;
  advisory: true;
};

export type LupaRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type LupaRiskScore = {
  score: number; // 0-100
  level: LupaRiskLevel;
  drivers: string[];
  recommendedActions: string[];
  plannedVisits: number | null;
  completedVisits: number | null;
  threshold: number;
  daysIntoPeriod: number | null;
  disclaimer: string;
  advisory: true;
};

export type CaseMixPreview = {
  primaryDxIcd10: string | null;
  comorbidityCount: number;
  functionalCompleteness: number; // 0-1
  functionalImpairmentProxy: 'low' | 'medium' | 'high' | 'unknown';
  clinicalGroupingProxy: string | null;
  /** Placeholder only — replace with real CY 2026 relative weight once tables loaded */
  relativeWeightPlaceholder: number | null;
  disclaimer: string;
  advisory: true;
};

export type PdgmHint = {
  primaryDxIcd10: string | null;
  comorbidityCount: number;
  functionalItemsAnswered: number;
  functionalItemsRequired: number;
  skinItemsAnswered: number;
  plannedVisits: number | null;
  lupaThreshold: number;
  lupaRisk: boolean;
  /** Optional richer fields (populated by newer callers) */
  lupaScore?: LupaRiskScore;
  caseMix?: CaseMixPreview;
  disclaimer: string;
};

const DISCLAIMER =
  'Advisory only — not a CMS payment determination or official HIPPS grouper result. Human review required. Validate against current CMS guidance and MAC before use.';

function isAnswered(v: string | number | boolean | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

function parseNumber(v: string | number | boolean | null | undefined): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return Number.isNaN(n) ? null : n;
}

function levelFromScore(score: number): LupaRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

/**
 * Compute a 0-100 advisory LUPA risk score with transparent drivers.
 * This is NOT the official PDGM LUPA threshold logic.
 */
export function computeLupaRiskScore(
  answers: OasisAnswerMap,
  ctx?: {
    lupaThreshold?: number;
    completedVisits?: number;
    daysIntoPeriod?: number;
    clinicalGroupingProxy?: string;
  },
): LupaRiskScore {
  const threshold = ctx?.lupaThreshold ?? DEFAULT_LUPA_VISIT_THRESHOLD;
  const plannedVisits = parseNumber(answers.skilled_visits_planned);
  const completedVisits = ctx?.completedVisits ?? null;
  const daysIntoPeriod = ctx?.daysIntoPeriod ?? null;

  const drivers: string[] = [];
  let score = 0;

  // Primary signal: planned visits vs threshold
  if (plannedVisits !== null) {
    if (plannedVisits < threshold) {
      const deficit = threshold - plannedVisits;
      score += Math.min(55, 25 + deficit * 12);
      drivers.push(`Planned skilled visits (${plannedVisits}) below advisory threshold (${threshold})`);
    } else if (plannedVisits === threshold) {
      score += 18;
      drivers.push(`Planned visits exactly at threshold — limited buffer`);
    }
  } else {
    score += 30;
    drivers.push('Planned skilled visit count not documented');
  }

  // Completed visits trajectory (if available)
  if (completedVisits !== null && daysIntoPeriod !== null && daysIntoPeriod > 0) {
    const expectedPace = (threshold / 30) * daysIntoPeriod;
    if (completedVisits < expectedPace * 0.7) {
      score += 20;
      drivers.push(`Visit pace lagging (completed ${completedVisits} by day ${daysIntoPeriod})`);
    }
  }

  // Functional / diagnosis completeness as secondary risk amplifier
  const functionalItems = OASIS_E2_ITEMS.filter((i) => i.section === 'functional');
  const functionalAnswered = functionalItems.filter((i) => isAnswered(answers[i.id])).length;
  if (functionalAnswered < Math.ceil(functionalItems.length * 0.6)) {
    score += 12;
    drivers.push('Functional GG items incomplete — may affect clinical grouping accuracy');
  }

  if (!isAnswered(answers.m1021)) {
    score += 10;
    drivers.push('Primary diagnosis missing — clinical grouping uncertain');
  }

  // Cap and finalize
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelFromScore(score);

  const recommendedActions: string[] = [];
  if (level === 'critical' || level === 'high') {
    recommendedActions.push('Review and increase planned skilled visits if clinically appropriate');
    recommendedActions.push('Schedule priority follow-up visits within the next 3–5 days');
    recommendedActions.push('Flag for clinical manager LUPA rescue review');
  } else if (level === 'moderate') {
    recommendedActions.push('Confirm visit schedule has buffer above threshold');
    recommendedActions.push('Monitor no-show risk and weather impact');
  } else {
    recommendedActions.push('Continue current plan; re-evaluate if visits are missed');
  }

  return {
    score,
    level,
    drivers,
    recommendedActions,
    plannedVisits,
    completedVisits,
    threshold,
    daysIntoPeriod,
    disclaimer: DISCLAIMER,
    advisory: true,
  };
}

/**
 * Lightweight advisory CaseMix preview.
 * Proxies only — replace with official CY 2026 weights when available.
 */
export function computeCaseMixPreview(answers: OasisAnswerMap): CaseMixPreview {
  const primaryDx = String(answers.m1021 ?? '').trim() || null;
  const comorbidRaw = String(answers.m1023 ?? '').trim();
  const comorbidityCount = comorbidRaw
    ? comorbidRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean).length
    : 0;

  const functionalItems = OASIS_E2_ITEMS.filter((i) => i.section === 'functional');
  const functionalAnswered = functionalItems.filter((i) => isAnswered(answers[i.id])).length;
  const functionalCompleteness =
    functionalItems.length === 0 ? 0 : functionalAnswered / functionalItems.length;

  // Very rough impairment proxy from GG scale values (lower = more dependent)
  let impairmentSum = 0;
  let impairmentCount = 0;
  for (const item of functionalItems) {
    const v = parseNumber(answers[item.id]);
    if (v !== null) {
      impairmentSum += v;
      impairmentCount += 1;
    }
  }
  let functionalImpairmentProxy: CaseMixPreview['functionalImpairmentProxy'] = 'unknown';
  if (impairmentCount >= 2) {
    const avg = impairmentSum / impairmentCount;
    if (avg <= 2.5) functionalImpairmentProxy = 'high';
    else if (avg <= 4) functionalImpairmentProxy = 'medium';
    else functionalImpairmentProxy = 'low';
  }

  // Placeholder grouping — real implementation needs full clinical grouping logic + CY 2026 tables
  let clinicalGroupingProxy: string | null = null;
  if (primaryDx) {
    // Extremely simplistic illustration only
    if (/^I50|^I48|^J44|^N18/i.test(primaryDx)) clinicalGroupingProxy = 'MMTA-like (proxy)';
    else if (/^S|^T|^L89/i.test(primaryDx)) clinicalGroupingProxy = 'Wounds / Injury (proxy)';
    else clinicalGroupingProxy = 'Other (proxy)';
  }

  return {
    primaryDxIcd10: primaryDx,
    comorbidityCount,
    functionalCompleteness: Math.round(functionalCompleteness * 100) / 100,
    functionalImpairmentProxy,
    clinicalGroupingProxy,
    relativeWeightPlaceholder: null, // populate after loadPdgmWeights()
    disclaimer: DISCLAIMER,
    advisory: true,
  };
}

/**
 * What-if sensitivity: apply proposed answer changes and compare advisory scores.
 */
export function computeWhatIf(
  current: OasisAnswerMap,
  proposed: Partial<OasisAnswerMap>,
  ctx?: {
    lupaThreshold?: number;
    completedVisits?: number;
    daysIntoPeriod?: number;
  },
): {
  before: { lupa: LupaRiskScore; caseMix: CaseMixPreview };
  after: { lupa: LupaRiskScore; caseMix: CaseMixPreview };
  deltas: {
    lupaScoreDelta: number;
    functionalCompletenessDelta: number;
  };
  disclaimer: string;
} {
  const merged: OasisAnswerMap = { ...current, ...proposed };
  const beforeLupa = computeLupaRiskScore(current, ctx);
  const afterLupa = computeLupaRiskScore(merged, ctx);
  const beforeCase = computeCaseMixPreview(current);
  const afterCase = computeCaseMixPreview(merged);

  return {
    before: { lupa: beforeLupa, caseMix: beforeCase },
    after: { lupa: afterLupa, caseMix: afterCase },
    deltas: {
      lupaScoreDelta: afterLupa.score - beforeLupa.score,
      functionalCompletenessDelta:
        afterCase.functionalCompleteness - beforeCase.functionalCompleteness,
    },
    disclaimer: DISCLAIMER,
  };
}

export function computeOasisGapsAndFlags(
  answers: OasisAnswerMap,
  opts?: {
    lupaThreshold?: number;
    timepoint?: string;
    completedVisits?: number;
    daysIntoPeriod?: number;
  },
): { flags: OasisFlag[]; gaps: string[]; pdgmHint: PdgmHint } {
  const lupaThreshold = opts?.lupaThreshold ?? DEFAULT_LUPA_VISIT_THRESHOLD;
  const flags: OasisFlag[] = [];
  const gaps: string[] = [];

  const required = OASIS_E2_ITEMS.filter((i) => i.requiredForSoc);
  for (const item of required) {
    if (!isAnswered(answers[item.id])) {
      gaps.push(`${item.code}: ${item.label}`);
    }
  }

  const primaryDx = String(answers.m1021 ?? '').trim();
  if (!primaryDx) {
    flags.push({
      code: 'MISSING_PRIMARY_DX',
      severity: 'error',
      message: 'Primary diagnosis (M1021) is required for PDGM clinical grouping.',
      advisory: true,
    });
  }

  const functionalItems = OASIS_E2_ITEMS.filter((i) => i.section === 'functional');
  const functionalAnswered = functionalItems.filter((i) => isAnswered(answers[i.id])).length;
  if (functionalAnswered < Math.ceil(functionalItems.length * 0.75)) {
    flags.push({
      code: 'THIN_FUNCTIONAL',
      severity: 'warn',
      message: 'Functional GG items incomplete — may understate impairment for PDGM.',
      advisory: true,
    });
  }

  const skinRequired = OASIS_E2_ITEMS.filter((i) => i.section === 'skin' && i.requiredForSoc);
  const skinMissing = skinRequired.filter((i) => !isAnswered(answers[i.id]));
  if (skinMissing.length > 0) {
    flags.push({
      code: 'SKIN_INCOMPLETE',
      severity: 'warn',
      message: `Skin/wound status incomplete: ${skinMissing.map((i) => i.code).join(', ')}.`,
      advisory: true,
    });
  }

  const comorbid = String(answers.m1023 ?? '').trim();
  if (!comorbid) {
    flags.push({
      code: 'COMORBIDITY_SPARSE',
      severity: 'info',
      message: 'No secondary diagnoses captured — review comorbidity coding for grouping.',
      advisory: true,
    });
  }

  if (!isAnswered(answers.m1000)) {
    flags.push({
      code: 'ADMISSION_SOURCE_UNKNOWN',
      severity: 'warn',
      message: 'Admission source / prior inpatient (M1000) not documented.',
      advisory: true,
    });
  }

  const plannedVisits = parseNumber(answers.skilled_visits_planned);
  let lupaRisk = false;
  if (plannedVisits !== null && plannedVisits < lupaThreshold) {
    lupaRisk = true;
    flags.push({
      code: 'LUPA_RISK',
      severity: 'warn',
      message: `Planned skilled visits (${plannedVisits}) below advisory LUPA threshold (${lupaThreshold}).`,
      advisory: true,
    });
  }

  if (gaps.length > 0) {
    flags.push({
      code: 'DOC_GAP',
      severity: 'error',
      message: `${gaps.length} required item(s) incomplete for SOC completeness.`,
      advisory: true,
    });
  }

  // Richer advisory scores
  const lupaScore = computeLupaRiskScore(answers, {
    lupaThreshold,
    completedVisits: opts?.completedVisits,
    daysIntoPeriod: opts?.daysIntoPeriod,
  });
  const caseMix = computeCaseMixPreview(answers);

  // Elevate flag severity if richer score is high
  if (lupaScore.level === 'critical' || lupaScore.level === 'high') {
    lupaRisk = true;
    if (!flags.some((f) => f.code === 'LUPA_RISK')) {
      flags.push({
        code: 'LUPA_RISK',
        severity: lupaScore.level === 'critical' ? 'error' : 'warn',
        message: `Elevated advisory LUPA risk score ${lupaScore.score}/100 (${lupaScore.level}). Drivers: ${lupaScore.drivers.slice(0, 2).join('; ')}`,
        advisory: true,
      });
    }
  }

  const pdgmHint: PdgmHint = {
    primaryDxIcd10: primaryDx || null,
    comorbidityCount: caseMix.comorbidityCount,
    functionalItemsAnswered: functionalAnswered,
    functionalItemsRequired: functionalItems.length,
    skinItemsAnswered: OASIS_E2_ITEMS.filter(
      (i) => i.section === 'skin' && isAnswered(answers[i.id]),
    ).length,
    plannedVisits,
    lupaThreshold,
    lupaRisk,
    lupaScore,
    caseMix,
    disclaimer: DISCLAIMER,
  };

  return { flags, gaps, pdgmHint };
}

export function validateAnswerValue(
  item: OasisItemDef,
  value: string | number | boolean | null,
): string | null {
  if (value === null || value === undefined || value === '') {
    return item.requiredForSoc ? 'Required' : null;
  }
  if (item.valueType === 'number' || item.valueType === 'scale') {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return 'Must be a number';
    if (item.min !== undefined && n < item.min) return `Min ${item.min}`;
    if (item.max !== undefined && n > item.max) return `Max ${item.max}`;
  }
  if (item.options?.length) {
    const s = String(value);
    if (!item.options.some((o) => o.value === s)) return 'Invalid option';
  }
  return null;
}

/**
 * Stub for future official CY 2026 weight table ingestion.
 * Call after validating the CMS file with compliance.
 */
export function loadPdgmWeights(_source: unknown): {
  loaded: boolean;
  message: string;
} {
  return {
    loaded: false,
    message:
      'CMS weight table loader not yet implemented. Keep using advisory proxies. Validate any future tables against the official CY 2026 final rule before enabling.',
  };
}
