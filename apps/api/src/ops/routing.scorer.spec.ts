import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreClinicianForEpisode } from './routing.scorer';

describe('scoreClinicianForEpisode', () => {
  it('prefers skill + geography + language match', () => {
    const good = scoreClinicianForEpisode(
      {
        userId: 'a',
        fullName: 'A',
        skills: ['wound_care', 'ostomy'],
        languages: ['en', 'es'],
        homeBaseCity: 'Tulsa',
        homeBaseState: 'OK',
        homeBasePostal: '74103',
        maxDailyVisits: 6,
        activeCaseload: 1,
      },
      {
        patientLanguage: 'es',
        serviceCity: 'Tulsa',
        serviceState: 'OK',
        servicePostal: '74105',
        requiredSkills: ['wound_care'],
      },
    );
    const weak = scoreClinicianForEpisode(
      {
        userId: 'b',
        fullName: 'B',
        skills: [],
        languages: ['en'],
        homeBaseCity: 'Dallas',
        homeBaseState: 'TX',
        homeBasePostal: '75001',
        maxDailyVisits: 6,
        activeCaseload: 6,
      },
      {
        patientLanguage: 'es',
        serviceCity: 'Tulsa',
        serviceState: 'OK',
        servicePostal: '74105',
        requiredSkills: ['wound_care'],
      },
    );
    assert.ok(good.total > weak.total);
    assert.ok(good.explanations.length > 0);
  });
});
