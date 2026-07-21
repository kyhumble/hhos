/**
 * Deterministic referral extraction from free text (email body, discharge summary).
 * HITL: confidence + factors always returned; never auto-admits.
 * Replace internals later with document AI while keeping the same contract.
 */
import type { ExtractedReferral } from '@hhos/shared';
import type { ReferralAcuity, ReferralSourceType } from '@hhos/shared';

function normalizeWs(s: string) {
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function match1(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim() || undefined;
}

function parseDob(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // MM/DD/YYYY or M/D/YYYY
  const us = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (us) {
    const mm = us[1].padStart(2, '0');
    const dd = us[2].padStart(2, '0');
    return `${us[3]}-${mm}-${dd}`;
  }
  // Month DD, YYYY
  const named = t.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})$/i,
  );
  if (named) {
    const months: Record<string, string> = {
      jan: '01',
      january: '01',
      feb: '02',
      february: '02',
      mar: '03',
      march: '03',
      apr: '04',
      april: '04',
      may: '05',
      jun: '06',
      june: '06',
      jul: '07',
      july: '07',
      aug: '08',
      august: '08',
      sep: '09',
      september: '09',
      oct: '10',
      october: '10',
      nov: '11',
      november: '11',
      dec: '12',
      december: '12',
    };
    const key = named[1].toLowerCase();
    const mm = months[key];
    if (mm) return `${named[3]}-${mm}-${named[2].padStart(2, '0')}`;
  }
  return undefined;
}

function detectSourceType(text: string): ReferralSourceType | undefined {
  const t = text.toLowerCase();
  if (/\b(hospital|discharge|case management|ed |emergency department|inpatient)\b/.test(t))
    return 'hospital';
  if (/\b(snf|skilled nursing|nursing facility|rehab facility)\b/.test(t)) return 'snf';
  if (/\b(self[- ]?referral|patient called|family request)\b/.test(t)) return 'self';
  if (/\b(dr\.|doctor|physician|md |np |clinic)\b/.test(t)) return 'physician';
  return undefined;
}

function detectAcuity(text: string): ReferralAcuity | undefined {
  const t = text.toLowerCase();
  if (/\b(stat|expedited|same[- ]day|urgent discharge)\b/.test(t)) return 'expedited';
  if (/\b(urgent|asap|priority)\b/.test(t)) return 'urgent';
  return 'routine';
}

function parseName(text: string): { firstName?: string; lastName?: string } {
  // Patient Name: Jane Doe / Patient: Doe, Jane
  const labeled =
    match1(text, /(?:patient\s*name|patient|pt\.?)\s*[:\-]\s*([^\n]{3,80})/i) ||
    match1(text, /(?:name)\s*[:\-]\s*([A-Z][a-zA-Z'\-]+,\s*[A-Z][a-zA-Z'\-]+)/);
  if (labeled) {
    const cleaned = labeled.replace(/\s+/g, ' ').trim();
    if (cleaned.includes(',')) {
      const [last, first] = cleaned.split(',').map((s) => s.trim());
      return { firstName: first?.split(' ')[0], lastName: last };
    }
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts[parts.length - 1] };
    }
  }
  // RE: Referral – Jane Doe
  const reLine = match1(text, /(?:referral|home health).*?[–\-:]\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  if (reLine) {
    const parts = reLine.split(/\s+/);
    return { firstName: parts[0], lastName: parts[1] };
  }
  return {};
}

export function extractReferralFromText(
  raw: string,
  opts?: { fileName?: string; subject?: string; from?: string },
): ExtractedReferral {
  const text = normalizeWs(raw);
  const factors: string[] = [];
  let confidence = 0.35;

  const name = parseName(text);
  if (name.firstName && name.lastName) {
    factors.push('patient name');
    confidence += 0.2;
  }

  const dobRaw =
    match1(text, /(?:dob|date of birth|birth\s*date)\s*[:\-]\s*([^\n,]{6,28})/i) ||
    match1(text, /\bDOB\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/i);
  const dob = parseDob(dobRaw);
  if (dob) {
    factors.push('date of birth');
    confidence += 0.15;
  }

  const icd =
    match1(text, /\b([A-TV-Z][0-9][0-9AB]\.?[0-9A-TV-Z]{0,4})\b/) ||
    match1(text, /(?:ICD[- ]?10)\s*[:\-]?\s*([A-TV-Z][0-9][0-9AB]\.?[0-9A-TV-Z]{0,4})/i);
  if (icd) {
    factors.push('ICD-10');
    confidence += 0.1;
  }

  const dx =
    match1(text, /(?:primary\s*diagnosis|diagnosis|dx)\s*[:\-]\s*([^\n]{3,120})/i) ||
    match1(text, /(?:admitting diagnosis)\s*[:\-]\s*([^\n]{3,120})/i);
  if (dx) {
    factors.push('diagnosis text');
    confidence += 0.1;
  }

  const reason =
    match1(text, /(?:reason for referral|skilled need|home health need)\s*[:\-]\s*([^\n]{5,400})/i) ||
    match1(text, /(?:please evaluate for|requesting)\s*([^\n]{5,400})/i) ||
    (dx ? `Skilled home health for ${dx}` : undefined);
  if (reason) {
    factors.push('reason for referral');
    confidence += 0.08;
  }

  let sourceType = detectSourceType(text);
  if (sourceType) {
    factors.push(`source type:${sourceType}`);
    confidence += 0.05;
  }

  const sourceName =
    match1(text, /(?:facility|hospital|referring facility|from)\s*[:\-]\s*([^\n]{3,100})/i) ||
    match1(text, /(?:referring physician|physician)\s*[:\-]\s*([^\n]{3,80})/i) ||
    (opts?.from ? opts.from.replace(/<.*>/, '').trim() : undefined);
  if (sourceName) {
    factors.push('source name');
    confidence += 0.05;
  }

  const sourceContact =
    match1(text, /(?:phone|tel|contact)\s*[:\-]\s*([\d\-(). +]{7,20})/i) ||
    match1(text, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);

  const externalRef =
    match1(text, /(?:MRN|medical record|account #|acct)\s*[:#]?\s*([A-Za-z0-9\-]{4,30})/i) ||
    match1(text, /(?:referral id|ref #)\s*[:#]?\s*([A-Za-z0-9\-]{4,30})/i);

  const acuity = detectAcuity(`${opts?.subject ?? ''} ${text}`);
  if (acuity && acuity !== 'routine') factors.push(`acuity:${acuity}`);

  if (opts?.fileName) factors.push(`file:${opts.fileName}`);
  if (opts?.subject) factors.push('email subject');

  confidence = Math.min(0.95, Math.max(0.2, confidence));

  return {
    patient: {
      firstName: name.firstName,
      lastName: name.lastName,
      dob,
    },
    sourceType,
    sourceName,
    sourceContact,
    acuity,
    reasonForReferral: reason,
    primaryDiagnosisText: dx?.replace(/\s*\([A-TV-Z][0-9].*$/, '').trim(),
    primaryDiagnosisIcd10: icd?.replace('.', ''),
    externalRef,
    confidence,
    factors,
  };
}

/** Heuristic: does this email/text look like a home-health referral? */
export function looksLikeReferral(text: string, subject?: string): boolean {
  const blob = `${subject ?? ''} ${text}`.toLowerCase();
  const hits = [
    /home health/,
    /home care/,
    /referral/,
    /skilled nursing/,
    /discharge.*home/,
    /oasis/,
    /soc\b/,
    /start of care/,
    /please evaluate/,
    /hhah/,
  ].filter((re) => re.test(blob)).length;
  return hits >= 1;
}
