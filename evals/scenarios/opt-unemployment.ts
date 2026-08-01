/**
 * Adversarial eval scenarios: OPT unemployment caps (90-day and 150-day STEM).
 *
 * Key boundary facts (from rule source code + regulatory text):
 *   opt-unemployment-90:  violation at daysUsed > 90 (NOT >= 90)
 *                         warning   at daysUsed >= 61
 *   opt-unemployment-150: violation at totalDays > 150
 *                         warning   at totalDays >= 121
 *
 * "More than 90 days" (8 CFR § 214.2(f)(10)(ii)(A)) means day 90 itself
 * is the last warning day; day 91 is the first violation day.
 */

import type { EvalScenario } from '../types';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const BASE_STUDENT = {
  id: 'eval-stu',
  fullName: 'Eval Student',
  sevisId: 'N0099900000',
  programLevel: 'masters' as const,
  major: 'Computer Science',
  isStemDesignated: false,
  programStartDate: '2022-09-01',
  programEndDate: '2024-05-01',
  admissionType: 'D/S' as const,
  i94AdmissionDate: '2022-08-28',
  i94ExpiryDate: null,
};

const STEM_STUDENT = { ...BASE_STUDENT, isStemDesignated: true };

const OPT_AUTH = {
  id: 'auth-opt',
  authType: 'OPT' as const,
  startDate: '2024-05-01',
  endDate: '2025-04-30',
};

const STEM_AUTH = {
  id: 'auth-stem',
  authType: 'STEM-OPT' as const,
  startDate: '2025-05-01',
  endDate: '2027-04-30',
};

// ── Scenarios ─────────────────────────────────────────────────────────────────

export const OPT_UNEMPLOYMENT_SCENARIOS: EvalScenario[] = [
  {
    id: 'e01-opt90/60-day-gap-is-pass',
    description:
      'Exactly 60 OPT unemployment days = pass (warning threshold is 61, not 60)',
    today: '2025-04-30',
    student: BASE_STUDENT,
    context: {
      authorizations: [OPT_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 60 unemployed days: May 1–June 29 (31+29=60). Employment starts June 30.
          startDate: '2024-06-30',
          endDate: '2025-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-90': 'pass' },
    expectOutputs: { 'opt-unemployment-90': { unemploymentDaysUsed: 60 } },
  },

  {
    id: 'e02-opt90/61-day-gap-is-warning',
    description:
      'Exactly 61 OPT unemployment days = warning (first day warning fires)',
    today: '2025-04-30',
    student: BASE_STUDENT,
    context: {
      authorizations: [OPT_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 61 unemployed days: May 1–June 30 (31+30=61). Employment starts July 1.
          startDate: '2024-07-01',
          endDate: '2025-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-90': 'warning' },
    expectOutputs: { 'opt-unemployment-90': { unemploymentDaysUsed: 61 } },
  },

  {
    id: 'e03-opt90/90-day-cap-is-still-warning',
    description:
      'Exactly 90 OPT unemployment days = WARNING, not violation. ' +
      '8 CFR § 214.2(f)(10)(ii)(A) says "more than 90 days" — day 91 is the first violation.',
    today: '2025-04-30',
    student: BASE_STUDENT,
    context: {
      authorizations: [OPT_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 90 unemployed days: May 1–July 29 (31+30+29=90). Employment starts July 30.
          startDate: '2024-07-30',
          endDate: '2025-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-90': 'warning' },
    expectOutputs: { 'opt-unemployment-90': { unemploymentDaysUsed: 90, daysRemainingBeforeCap: 0 } },
  },

  {
    id: 'e04-opt90/91-day-is-violation',
    description:
      'Exactly 91 OPT unemployment days = violation (exceeded "more than 90" threshold)',
    today: '2025-04-30',
    student: BASE_STUDENT,
    context: {
      authorizations: [OPT_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 91 unemployed days: May 1–July 30 (31+30+30=91). Employment starts July 31.
          startDate: '2024-07-31',
          endDate: '2025-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-90': 'violation' },
    expectOutputs: { 'opt-unemployment-90': { unemploymentDaysUsed: 91 } },
  },

  {
    id: 'e05-stem150/150-cumulative-is-warning',
    description:
      'Exactly 150 cumulative OPT+STEM unemployment days = warning (cap is > 150, not >= 150)',
    today: '2027-04-30',
    student: STEM_STUDENT,
    context: {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-opt',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 89 OPT unemployed days: May 1–July 28 (31+30+28=89). Employment starts July 29.
          startDate: '2024-07-29',
          endDate: '2025-04-30',
        },
        {
          id: 'ep-stem',
          authType: 'STEM-OPT',
          employer: 'Beta Inc',
          hoursPerWeek: 40,
          // 61 STEM unemployed days: May 1–June 30 (31+30=61). Employment starts July 1.
          startDate: '2025-07-01',
          endDate: '2027-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-150-stem': 'warning' },
    expectOutputs: { 'opt-unemployment-150-stem': { totalUnemploymentDays: 150 } },
  },

  {
    id: 'e06-stem150/151-cumulative-is-violation',
    description:
      '151 cumulative OPT+STEM unemployment days = violation (one past the 150-day cap)',
    today: '2027-04-30',
    student: STEM_STUDENT,
    context: {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-opt',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 89 OPT days (same as e05)
          startDate: '2024-07-29',
          endDate: '2025-04-30',
        },
        {
          id: 'ep-stem',
          authType: 'STEM-OPT',
          employer: 'Beta Inc',
          hoursPerWeek: 40,
          // 62 STEM unemployed days: May 1–July 1 (31+30+1=62). Employment starts July 2.
          startDate: '2025-07-02',
          endDate: '2027-04-30',
        },
      ],
    },
    expect: { 'opt-unemployment-150-stem': 'violation' },
    expectOutputs: { 'opt-unemployment-150-stem': { totalUnemploymentDays: 151 } },
  },

  {
    id: 'e07-stem/91-opt-days-triggers-both-rules-differently',
    description:
      'STEM student with 91 OPT unemployment days fires opt-unemployment-90 as violation ' +
      'but opt-unemployment-150-stem as warning (91+31=122 cumulative, < 150 cap)',
    today: '2025-06-01',
    student: STEM_STUDENT,
    context: {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-opt',
          authType: 'OPT',
          employer: 'Acme Corp',
          hoursPerWeek: 40,
          // 91 OPT unemployment days. Employment starts July 31.
          startDate: '2024-07-31',
          endDate: '2025-04-30',
        },
        {
          id: 'ep-stem',
          authType: 'STEM-OPT',
          employer: 'Beta Inc',
          hoursPerWeek: 40,
          // 31 STEM unemployment days (May 1–May 31). Employment starts June 1 (today).
          startDate: '2025-06-01',
          endDate: null,
        },
      ],
    },
    expect: {
      'opt-unemployment-90': 'violation',
      'opt-unemployment-150-stem': 'warning',
    },
  },
];
