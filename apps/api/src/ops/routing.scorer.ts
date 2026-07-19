/**
 * Deterministic, explainable assignment scorer (Service AI v1).
 * Not an LLM — transparent rules only. Future LLM can only *explain*, never auto-assign.
 */
import type { RouteScoreBreakdown } from '@hhos/shared';

export type ScoreCandidate = {
  userId: string;
  fullName: string;
  skills: string[];
  languages: string[];
  homeBaseCity: string | null;
  homeBaseState: string | null;
  homeBasePostal: string | null;
  maxDailyVisits: number;
  activeCaseload: number;
};

export type ScoreContext = {
  patientLanguage: string;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostal: string | null;
  requiredSkills: string[];
};

export function scoreClinicianForEpisode(
  candidate: ScoreCandidate,
  ctx: ScoreContext,
): RouteScoreBreakdown {
  const explanations: string[] = [];
  let geography = 0;
  let skills = 0;
  let language = 0;
  let caseload = 0;

  // Geography (0–40): postal > city > state
  if (
    ctx.servicePostal &&
    candidate.homeBasePostal &&
    ctx.servicePostal.slice(0, 3) === candidate.homeBasePostal.slice(0, 3)
  ) {
    geography = 40;
    explanations.push('Home base postal prefix matches service address (3-digit)');
  } else if (
    ctx.serviceCity &&
    candidate.homeBaseCity &&
    ctx.serviceCity.toLowerCase() === candidate.homeBaseCity.toLowerCase()
  ) {
    geography = 30;
    explanations.push('Home base city matches service city');
  } else if (
    ctx.serviceState &&
    candidate.homeBaseState &&
    ctx.serviceState.toUpperCase() === candidate.homeBaseState.toUpperCase()
  ) {
    geography = 15;
    explanations.push('Home base state matches service state');
  } else {
    explanations.push('No strong geography match');
  }

  // Skills (0–35)
  const required = ctx.requiredSkills.length ? ctx.requiredSkills : ['wound_care'];
  const matched = required.filter((s) => candidate.skills.includes(s));
  if (required.length === 0) {
    skills = 20;
  } else {
    skills = Math.round((matched.length / required.length) * 35);
    explanations.push(
      matched.length
        ? `Skills match: ${matched.join(', ')} (${matched.length}/${required.length})`
        : `Missing required skills: ${required.join(', ')}`,
    );
  }

  // Language (0–15)
  const lang = (ctx.patientLanguage || 'en').toLowerCase();
  if (candidate.languages.map((l) => l.toLowerCase()).includes(lang)) {
    language = 15;
    explanations.push(`Speaks patient language (${lang})`);
  } else if (candidate.languages.some((l) => l.toLowerCase() === 'en')) {
    language = 5;
    explanations.push('English available; patient language not listed on profile');
  } else {
    explanations.push('Language mismatch risk');
  }

  // Caseload (0–10): prefer under max
  const loadRatio = candidate.activeCaseload / Math.max(1, candidate.maxDailyVisits);
  if (loadRatio < 0.5) {
    caseload = 10;
    explanations.push(`Low caseload (${candidate.activeCaseload}/${candidate.maxDailyVisits})`);
  } else if (loadRatio < 0.85) {
    caseload = 6;
    explanations.push(`Moderate caseload (${candidate.activeCaseload}/${candidate.maxDailyVisits})`);
  } else if (loadRatio < 1) {
    caseload = 2;
    explanations.push(`Near capacity (${candidate.activeCaseload}/${candidate.maxDailyVisits})`);
  } else {
    caseload = 0;
    explanations.push(`At/over capacity (${candidate.activeCaseload}/${candidate.maxDailyVisits})`);
  }

  const total = geography + skills + language + caseload;
  return { total, geography, skills, language, caseload, explanations };
}
