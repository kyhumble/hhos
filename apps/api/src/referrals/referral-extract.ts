/**
 * Deterministic referral extraction from free text (email body, discharge summary, PDF text).
 * HITL: confidence + factors always returned; never auto-admits.
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

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = r.exec(text))) {
    if (m[1]?.trim()) out.push(m[1].trim());
  }
  return out;
}

function parseDob(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const us = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const named = t.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})$/i,
  );
  if (named) {
    const months: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', september: '09', oct: '10', october: '10',
      nov: '11', november: '11', dec: '12', december: '12',
    };
    const mm = months[named[1].toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${named[2].padStart(2, '0')}`;
  }
  return undefined;
}

function detectSourceType(text: string): ReferralSourceType | undefined {
  const t = text.toLowerCase();
  if (/\b(hospital|discharge|case management|emergency department|\bed\b|inpatient)\b/.test(t))
    return 'hospital';
  if (/\b(snf|skilled nursing|nursing facility|rehab facility)\b/.test(t)) return 'snf';
  if (/\b(self[- ]?referral|patient called|family request)\b/.test(t)) return 'self';
  if (/\b(dr\.|doctor|physician|md\b|np\b|clinic)\b/.test(t)) return 'physician';
  return undefined;
}

function detectAcuity(text: string): ReferralAcuity | undefined {
  const t = text.toLowerCase();
  if (/\b(stat|expedited|same[- ]day|urgent discharge)\b/.test(t)) return 'expedited';
  if (/\b(urgent|asap|priority)\b/.test(t)) return 'urgent';
  return 'routine';
}

function parseName(text: string): { firstName?: string; lastName?: string; middleName?: string } {
  const labeled =
    match1(text, /(?:patient\s*name|patient|pt\.?)\s*[:\-]\s*([^\n]{3,80})/i) ||
    match1(text, /(?:name)\s*[:\-]\s*([A-Z][a-zA-Z'\-]+,\s*[A-Z][a-zA-Z'\-]+)/);
  if (labeled) {
    const cleaned = labeled.replace(/\s+/g, ' ').trim();
    if (cleaned.includes(',')) {
      const [last, rest] = cleaned.split(',').map((s) => s.trim());
      const parts = (rest ?? '').split(/\s+/).filter(Boolean);
      return { firstName: parts[0], middleName: parts[1], lastName: last };
    }
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
        lastName: parts[parts.length - 1],
      };
    }
  }
  const reLine = match1(text, /(?:referral|home health).*?[–\-:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (reLine) {
    const parts = reLine.split(/\s+/);
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
  }
  return {};
}

function detectServices(text: string): string[] {
  const t = text.toLowerCase();
  const services: string[] = [];
  if (/skilled nursing|\bsn\b|nursing visits/.test(t)) services.push('skilled_nursing');
  if (/physical therapy|\bpt\b/.test(t)) services.push('physical_therapy');
  if (/occupational therapy|\bot\b/.test(t)) services.push('occupational_therapy');
  if (/speech|\bst\b|slp/.test(t)) services.push('speech_therapy');
  if (/home health aide|\bhha\b|aide services/.test(t)) services.push('home_health_aide');
  if (/medical social|\bmsw\b|social work/.test(t)) services.push('medical_social_work');
  if (/wound care|wound/.test(t)) services.push('wound_care');
  if (/iv therapy|infusion/.test(t)) services.push('infusion');
  return [...new Set(services)];
}

export function extractReferralFromText(
  raw: string,
  opts?: { fileName?: string; subject?: string; from?: string },
): ExtractedReferral {
  const text = normalizeWs(raw);
  const factors: string[] = [];
  let confidence = 0.3;

  const name = parseName(text);
  if (name.firstName && name.lastName) {
    factors.push('patient name');
    confidence += 0.15;
  }

  const dobRaw =
    match1(text, /(?:dob|date of birth|birth\s*date)\s*[:\-]\s*([^\n,]{6,28})/i) ||
    match1(text, /\bDOB\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/i);
  const dob = parseDob(dobRaw);
  if (dob) {
    factors.push('date of birth');
    confidence += 0.12;
  }

  const sex =
    match1(text, /(?:sex|gender)\s*[:\-]\s*(male|female|m|f|other|unknown)/i) ||
    match1(text, /\b(male|female)\b/i);
  if (sex) {
    factors.push('sex');
    confidence += 0.03;
  }

  const phone =
    match1(text, /(?:patient\s*)?(?:phone|mobile|cell|tel)\s*[:\-]\s*([\d\-(). +]{7,20})/i) ||
    match1(text, /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]\d{4}/);
  if (phone) {
    factors.push('phone');
    confidence += 0.03;
  }

  const email = match1(text, /([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/);
  const preferredLanguage = match1(
    text,
    /(?:preferred\s*)?language\s*[:\-]\s*([A-Za-z ]{2,30})/i,
  );

  const addressLine1 =
    match1(text, /(?:address|street|service address)\s*[:\-]\s*([^\n]{5,100})/i);
  const city = match1(text, /(?:city)\s*[:\-]\s*([A-Za-z .'-]{2,40})/i);
  const state = match1(text, /(?:state)\s*[:\-]\s*([A-Z]{2})\b/) ||
    match1(text, /\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  const postalCode = match1(text, /(?:zip|postal)\s*[:\-]?\s*(\d{5}(?:-\d{4})?)/i) ||
    match1(text, /\b(\d{5})(?:-\d{4})?\b/);
  if (addressLine1 || city) {
    factors.push('address');
    confidence += 0.05;
  }

  const emergencyContactName = match1(
    text,
    /(?:emergency contact|next of kin|caregiver)\s*[:\-]\s*([^\n,]{3,60})/i,
  );
  const emergencyContactPhone = match1(
    text,
    /(?:emergency(?: contact)?(?: phone)?|contact phone)\s*[:\-]\s*([\d\-(). +]{7,20})/i,
  );
  const emergencyContactRelationship = match1(
    text,
    /(?:relationship)\s*[:\-]\s*([A-Za-z ]{2,30})/i,
  );
  if (emergencyContactName) factors.push('emergency contact');

  const icdCodes = matchAll(
    text,
    /\b([A-TV-Z][0-9][0-9AB](?:\.?[0-9A-TV-Z]{1,4})?)\b/,
  );
  const primaryIcd =
    match1(text, /(?:ICD[- ]?10|primary\s*dx|primary\s*icd)\s*[:\-]?\s*([A-TV-Z][0-9][0-9AB]\.?[0-9A-TV-Z]{0,4})/i) ||
    icdCodes[0];
  if (primaryIcd) {
    factors.push('ICD-10');
    confidence += 0.08;
  }

  const dx =
    match1(text, /(?:primary\s*diagnosis|diagnosis|dx|admitting diagnosis)\s*[:\-]\s*([^\n]{3,160})/i);
  if (dx) {
    factors.push('diagnosis text');
    confidence += 0.08;
  }

  const secondaryDiagnoses = matchAll(
    text,
    /(?:secondary(?: diagnosis)?|additional dx|comorbidit(?:y|ies))\s*[:\-]\s*([^\n]{3,120})/i,
  );

  const reason =
    match1(text, /(?:reason for referral|skilled need|home health need|reason)\s*[:\-]\s*([^\n]{5,500})/i) ||
    match1(text, /(?:please evaluate for|requesting)\s*([^\n]{5,400})/i) ||
    (dx ? `Skilled home health for ${dx}` : undefined);
  if (reason) {
    factors.push('reason for referral');
    confidence += 0.06;
  }

  let sourceType = detectSourceType(text);
  if (sourceType) {
    factors.push(`source type:${sourceType}`);
    confidence += 0.04;
  }

  const sourceName =
    match1(text, /(?:facility|hospital|referring facility|from|discharge facility)\s*[:\-]\s*([^\n]{3,100})/i) ||
    (opts?.from ? opts.from.replace(/<.*>/, '').trim() : undefined);
  if (sourceName) {
    factors.push('source name');
    confidence += 0.04;
  }

  const sourcePhone =
    match1(text, /(?:facility phone|case manager phone|source phone)\s*[:\-]\s*([\d\-(). +]{7,20})/i);
  const sourceContact =
    match1(text, /(?:case manager|contact person|discharge planner)\s*[:\-]\s*([^\n]{3,60})/i) ||
    email;

  const referringPhysicianName =
    match1(text, /(?:referring physician|physician|attending|dr\.)\s*[:\-]\s*([^\n]{3,80})/i);
  const referringPhysicianNpi = match1(text, /(?:npi)\s*[:#]?\s*(\d{10})\b/i);
  const certifyingPhysicianName =
    match1(text, /(?:certifying physician|certifying practitioner)\s*[:\-]\s*([^\n]{3,80})/i);
  const certifyingPhysicianNpi =
    match1(text, /(?:certifying\s*)?(?:physician\s*)?npi\s*[:#]?\s*(\d{10})\b/i) ||
    referringPhysicianNpi;
  if (referringPhysicianName || referringPhysicianNpi) {
    factors.push('physician');
    confidence += 0.05;
  }

  const externalRef =
    match1(text, /(?:MRN|medical record|account #|acct)\s*[:#]?\s*([A-Za-z0-9\-]{4,30})/i) ||
    match1(text, /(?:referral id|ref #)\s*[:#]?\s*([A-Za-z0-9\-]{4,30})/i);
  if (externalRef) factors.push('MRN/ref');

  const insuranceName =
    match1(text, /(?:primary insurance|insurance|payer|plan name)\s*[:\-]\s*([^\n]{3,80})/i);
  const insuranceMemberId =
    match1(text, /(?:member id|subscriber id|policy #|policy number)\s*[:#]?\s*([A-Za-z0-9\-]{4,30})/i);
  const insuranceGroupNumber =
    match1(text, /(?:group #|group number|grp)\s*[:#]?\s*([A-Za-z0-9\-]{2,30})/i);
  const medicareNumber =
    match1(text, /(?:medicare|mbi)\s*[:#]?\s*([A-Za-z0-9\-]{8,15})/i);
  const medicaidNumber =
    match1(text, /(?:medicaid)\s*[:#]?\s*([A-Za-z0-9\-]{4,20})/i);
  if (insuranceName || medicareNumber) {
    factors.push('insurance');
    confidence += 0.06;
  }

  const requestedServices = detectServices(text);
  if (requestedServices.length) {
    factors.push('services');
    confidence += 0.04;
  }

  const homeboundStatus = match1(
    text,
    /(?:homebound)\s*[:\-]?\s*(yes|no|true|false|homebound)/i,
  );
  const homeboundNarrative = match1(
    text,
    /(?:homebound (?:status|narrative|reason)|criteria for homebound)\s*[:\-]\s*([^\n]{10,400})/i,
  );
  if (homeboundStatus || homeboundNarrative) factors.push('homebound');

  const medicationsSummary = match1(
    text,
    /(?:medications?|med list|current meds)\s*[:\-]\s*([^\n]{5,500})/i,
  );
  const allergies = match1(text, /(?:allergies|nkda|nka)\s*[:\-]\s*([^\n]{2,200})/i);
  if (medicationsSummary) factors.push('medications');
  if (allergies) factors.push('allergies');

  const dischargeDateRaw = match1(
    text,
    /(?:discharge date|discharged)\s*[:\-]\s*([^\n,]{6,28})/i,
  );
  const dischargeDate = parseDob(dischargeDateRaw) ?? dischargeDateRaw;
  const requestedSocRaw = match1(
    text,
    /(?:requested soc|soc date|start of care|preferred soc)\s*[:\-]\s*([^\n,]{6,28})/i,
  );
  const requestedSocDate = parseDob(requestedSocRaw) ?? requestedSocRaw;
  if (dischargeDate || requestedSocDate) factors.push('dates');

  const admissionSource = match1(
    text,
    /(?:admission source|admitted from)\s*[:\-]\s*([^\n]{3,80})/i,
  );

  const clinicalNotes = match1(
    text,
    /(?:clinical (?:notes?|summary)|hospital course|assessment)\s*[:\-]\s*([^\n]{20,800})/i,
  );

  const acuity = detectAcuity(`${opts?.subject ?? ''} ${text}`);
  if (acuity && acuity !== 'routine') factors.push(`acuity:${acuity}`);

  if (opts?.fileName) factors.push(`file:${opts.fileName}`);
  if (opts?.subject) factors.push('email subject');

  confidence = Math.min(0.95, Math.max(0.2, confidence));

  return {
    patient: {
      firstName: name.firstName,
      lastName: name.lastName,
      middleName: name.middleName,
      dob,
      sex: sex ? sex.charAt(0).toUpperCase() + sex.slice(1).toLowerCase() : undefined,
      phone,
      email,
      preferredLanguage,
      mrn: externalRef,
      addressLine1,
      city,
      state,
      postalCode,
    },
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship,
    sourceType,
    sourceName,
    sourceContact,
    sourcePhone,
    referringPhysicianName,
    referringPhysicianNpi,
    certifyingPhysicianName,
    certifyingPhysicianNpi,
    acuity,
    reasonForReferral: reason,
    primaryDiagnosisText: dx?.replace(/\s*\([A-TV-Z][0-9].*$/, '').trim(),
    primaryDiagnosisIcd10: primaryIcd?.replace('.', ''),
    secondaryDiagnoses: secondaryDiagnoses.length ? secondaryDiagnoses : undefined,
    externalRef,
    insuranceName,
    insuranceMemberId,
    insuranceGroupNumber,
    medicareNumber,
    medicaidNumber,
    requestedServices: requestedServices.length ? requestedServices : undefined,
    homeboundStatus,
    homeboundNarrative,
    medicationsSummary,
    allergies,
    dischargeDate,
    requestedSocDate,
    admissionSource,
    clinicalNotes,
    confidence,
    factors,
  };
}

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
