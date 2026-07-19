/**
 * OASIS-E2 **PDGM-critical subset** for HHOS Phase 3.
 *
 * NOT a complete CMS item set. Codes are illustrative/common OASIS identifiers
 * used for capture structure. Re-validate labels/coding against official CMS
 * OASIS-E2 guidance before production lock (effective Apr 2026).
 */

import { OASIS_ITEM_SET_VERSION } from './enums';

export type OasisItemValueType = 'text' | 'code' | 'number' | 'boolean' | 'date' | 'scale';

export type OasisItemDef = {
  id: string;
  /** CMS-style item code (subset) */
  code: string;
  section: string;
  label: string;
  helpText?: string;
  valueType: OasisItemValueType;
  requiredForSoc: boolean;
  pdgmRelevant: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export const OASIS_E2_SUBSET_VERSION = OASIS_ITEM_SET_VERSION;

export const OASIS_E2_ITEMS: OasisItemDef[] = [
  {
    id: 'm0100',
    code: 'M0100',
    section: 'admin',
    label: 'Assessment reason / timepoint context',
    valueType: 'code',
    requiredForSoc: true,
    pdgmRelevant: true,
    options: [
      { value: '1', label: 'Start of care' },
      { value: '3', label: 'Resumption of care' },
      { value: '4', label: 'Recertification' },
      { value: '9', label: 'Discharge' },
    ],
  },
  {
    id: 'm1000',
    code: 'M1000',
    section: 'patient_history',
    label: 'Inpatient facilities discharged from (admission source)',
    helpText: 'PDGM timing/source input — capture known discharge sources.',
    valueType: 'text',
    requiredForSoc: true,
    pdgmRelevant: true,
  },
  {
    id: 'm1021',
    code: 'M1021',
    section: 'diagnoses',
    label: 'Primary diagnosis (ICD-10 code)',
    helpText: 'Primary diagnosis driving skilled need / clinical grouping.',
    valueType: 'text',
    requiredForSoc: true,
    pdgmRelevant: true,
  },
  {
    id: 'm1021_desc',
    code: 'M1021_DESC',
    section: 'diagnoses',
    label: 'Primary diagnosis description',
    valueType: 'text',
    requiredForSoc: true,
    pdgmRelevant: true,
  },
  {
    id: 'm1023',
    code: 'M1023',
    section: 'diagnoses',
    label: 'Other diagnoses / comorbidities (comma-separated ICD-10)',
    valueType: 'text',
    requiredForSoc: false,
    pdgmRelevant: true,
  },
  {
    id: 'gg0130a',
    code: 'GG0130A',
    section: 'functional',
    label: 'Self-care: Eating (admission performance)',
    valueType: 'scale',
    requiredForSoc: true,
    pdgmRelevant: true,
    min: 1,
    max: 6,
    options: [
      { value: '6', label: 'Independent' },
      { value: '5', label: 'Setup or clean-up assistance' },
      { value: '4', label: 'Supervision or touching assistance' },
      { value: '3', label: 'Partial/moderate assistance' },
      { value: '2', label: 'Substantial/maximal assistance' },
      { value: '1', label: 'Dependent' },
    ],
  },
  {
    id: 'gg0130b',
    code: 'GG0130B',
    section: 'functional',
    label: 'Self-care: Oral hygiene (admission performance)',
    valueType: 'scale',
    requiredForSoc: true,
    pdgmRelevant: true,
    min: 1,
    max: 6,
    options: [
      { value: '6', label: 'Independent' },
      { value: '5', label: 'Setup or clean-up assistance' },
      { value: '4', label: 'Supervision or touching assistance' },
      { value: '3', label: 'Partial/moderate assistance' },
      { value: '2', label: 'Substantial/maximal assistance' },
      { value: '1', label: 'Dependent' },
    ],
  },
  {
    id: 'gg0170c',
    code: 'GG0170C',
    section: 'functional',
    label: 'Mobility: Lying to sitting on side of bed',
    valueType: 'scale',
    requiredForSoc: true,
    pdgmRelevant: true,
    min: 1,
    max: 6,
    options: [
      { value: '6', label: 'Independent' },
      { value: '5', label: 'Setup or clean-up assistance' },
      { value: '4', label: 'Supervision or touching assistance' },
      { value: '3', label: 'Partial/moderate assistance' },
      { value: '2', label: 'Substantial/maximal assistance' },
      { value: '1', label: 'Dependent' },
    ],
  },
  {
    id: 'gg0170d',
    code: 'GG0170D',
    section: 'functional',
    label: 'Mobility: Sit to stand',
    valueType: 'scale',
    requiredForSoc: true,
    pdgmRelevant: true,
    min: 1,
    max: 6,
    options: [
      { value: '6', label: 'Independent' },
      { value: '5', label: 'Setup or clean-up assistance' },
      { value: '4', label: 'Supervision or touching assistance' },
      { value: '3', label: 'Partial/moderate assistance' },
      { value: '2', label: 'Substantial/maximal assistance' },
      { value: '1', label: 'Dependent' },
    ],
  },
  {
    id: 'm1306',
    code: 'M1306',
    section: 'skin',
    label: 'Unhealed pressure ulcer/injury at stage 2 or higher',
    valueType: 'code',
    requiredForSoc: true,
    pdgmRelevant: true,
    options: [
      { value: '0', label: 'No' },
      { value: '1', label: 'Yes' },
    ],
  },
  {
    id: 'm1322',
    code: 'M1322',
    section: 'skin',
    label: 'Current number of stage 1 pressure injuries',
    valueType: 'number',
    requiredForSoc: false,
    pdgmRelevant: true,
    min: 0,
    max: 99,
  },
  {
    id: 'm1340',
    code: 'M1340',
    section: 'skin',
    label: 'Surgical wound present',
    valueType: 'code',
    requiredForSoc: true,
    pdgmRelevant: true,
    options: [
      { value: '0', label: 'No' },
      { value: '1', label: 'Yes' },
      { value: '2', label: 'Patient has Observable surgical wound' },
    ],
  },
  {
    id: 'm2200',
    code: 'M2200',
    section: 'care_plan',
    label: 'Therapy need (total therapy visits projected in episode)',
    helpText: 'Used with visit planning for LUPA risk advisory.',
    valueType: 'number',
    requiredForSoc: false,
    pdgmRelevant: true,
    min: 0,
    max: 999,
  },
  {
    id: 'skilled_visits_planned',
    code: 'HHOS_VISITS_PLANNED',
    section: 'care_plan',
    label: 'Total skilled visits planned this 30-day period (agency)',
    helpText: 'HHOS field for LUPA advisory — not a CMS OASIS item.',
    valueType: 'number',
    requiredForSoc: true,
    pdgmRelevant: true,
    min: 0,
    max: 999,
  },
];

export function getOasisItem(id: string): OasisItemDef | undefined {
  return OASIS_E2_ITEMS.find((i) => i.id === id);
}

export function oasisItemsBySection(): Record<string, OasisItemDef[]> {
  const map: Record<string, OasisItemDef[]> = {};
  for (const item of OASIS_E2_ITEMS) {
    const list = map[item.section] ?? [];
    list.push(item);
    map[item.section] = list;
  }
  return map;
}
