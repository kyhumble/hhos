/**
 * PDGM / LUPA **advisory** helpers for Phase 3.
 * Not a CMS grouper or payment engine. Always surface as non-authoritative.
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

export type PdgmHint = {
  primaryDxIcd10: string | null;
  comorbidityCount: number;
  functionalItemsAnswered: number;
  functionalItemsRequired: number;
  skinItemsAnswered: number;
  plannedVisits: number | null;
  lupaThreshold: number;
  lupaRisk: boolean;
  disclaimer: string;
};

const DISCLAIMER =
  'Advisory only — not a CMS payment determination or official HIPPS grouper result.';

function isAnswered(v: string | number | boolean | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

export function computeOasisGapsAndFlags(
  answers: OasisAnswerMap,
  opts?: { lupaThreshold?: number; timepoint?: string },
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

  const plannedRaw = answers.skilled_visits_planned;
  const plannedVisits =
    typeof plannedRaw === 'number'
      ? plannedRaw
      : plannedRaw !== null && plannedRaw !== undefined && String(plannedRaw).trim() !== ''
        ? Number(plannedRaw)
        : null;

  let lupaRisk = false;
  if (plannedVisits !== null && !Number.isNaN(plannedVisits) && plannedVisits < lupaThreshold) {
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

  const pdgmHint: PdgmHint = {
    primaryDxIcd10: primaryDx || null,
    comorbidityCount: comorbid ? comorbid.split(/[,;]/).filter((s) => s.trim()).length : 0,
    functionalItemsAnswered: functionalAnswered,
    functionalItemsRequired: functionalItems.length,
    skinItemsAnswered: OASIS_E2_ITEMS.filter(
      (i) => i.section === 'skin' && isAnswered(answers[i.id]),
    ).length,
    plannedVisits: plannedVisits !== null && !Number.isNaN(plannedVisits) ? plannedVisits : null,
    lupaThreshold,
    lupaRisk,
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
