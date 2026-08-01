/**
 * Adversarial eval scenarios: CPT rules.
 *
 * cpt-full-time-opt-bar:
 *   - Counts CALENDAR MONTHS (not days). A period touching even 1 day of a
 *     month counts that month. Violation at >= 12 months.
 *   - Part-time CPT is completely ignored by this rule.
 *
 * cpt-authorization-prior:
 *   - Employer names are matched case-insensitively after trimming.
 *   - Employment start must be >= authorization start date (same day is OK).
 */

import type { EvalScenario } from '../types';

const STUDENT = {
  id: 'eval-stu',
  fullName: 'Eval Student',
  sevisId: 'N0099900000',
  programLevel: 'masters' as const,
  major: 'Computer Science',
  isStemDesignated: false,
  programStartDate: '2020-09-01',
  programEndDate: '2024-05-01',
  admissionType: 'D/S' as const,
  i94AdmissionDate: '2020-08-28',
  i94ExpiryDate: null,
};

const TODAY = '2024-05-01'; // evaluation date for all CPT scenarios

export const CPT_SCENARIOS: EvalScenario[] = [
  // ── cpt-full-time-opt-bar ───────────────────────────────────────────────────

  {
    id: 'e08-cpt-bar/partial-month-counts-as-full-month',
    description:
      'Full-time CPT from Jan 15 to Feb 10 touches 2 calendar months → counted as 2 months. ' +
      'Confirms "any day in a month = full month" semantics used in DSO practice.',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2023-01-15',
          endDate: '2023-02-10',
        },
      ],
    },
    expect: { 'cpt-full-time-opt-bar': 'pass' },
    expectOutputs: { 'cpt-full-time-opt-bar': { fullTimeCptMonths: 2 } },
  },

  {
    id: 'e09-cpt-bar/exactly-12-months-is-violation',
    description:
      'Full-time CPT spanning exactly 12 calendar months (Jan–Dec) = violation. ' +
      'This is the precise 12-month bar from 8 CFR § 214.2(f)(10)(i).',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-01-01',
          endDate: '2021-12-31',
        },
      ],
    },
    expect: { 'cpt-full-time-opt-bar': 'violation' },
    expectOutputs: { 'cpt-full-time-opt-bar': { fullTimeCptMonths: 12, optBarReached: true } },
  },

  {
    id: 'e10-cpt-bar/part-time-never-counted',
    description:
      'Unlimited part-time CPT does not accumulate toward the 12-month OPT bar. ' +
      '18 months of part-time CPT → 0 full-time months → pass.',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: 'University Lab',
          hoursPerWeek: 20,
          startDate: '2020-09-01',
          endDate: '2022-02-28',
        },
      ],
    },
    expect: { 'cpt-full-time-opt-bar': 'pass' },
    expectOutputs: { 'cpt-full-time-opt-bar': { fullTimeCptMonths: 0, optBarReached: false } },
  },

  // ── cpt-authorization-prior ─────────────────────────────────────────────────

  {
    id: 'e11-cpt-auth/employment-same-day-as-auth-start-is-pass',
    description:
      'CPT employment starting on the exact authorization start date = pass. ' +
      '"Prior" means auth.startDate <= employment.startDate.',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-cpt',
          authType: 'CPT',
          employer: 'Tech Corp',
          startDate: '2023-09-01',
          endDate: '2023-12-31',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Tech Corp',
          hoursPerWeek: 40,
          startDate: '2023-09-01', // same day as auth start
          endDate: '2023-12-31',
        },
      ],
    },
    expect: { 'cpt-authorization-prior': 'pass' },
  },

  {
    id: 'e12-cpt-auth/employment-1-day-before-auth-is-violation',
    description:
      'CPT employment starting 1 day before authorization = violation. ' +
      'Even a single day of unauthorized work triggers the rule.',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-cpt',
          authType: 'CPT',
          employer: 'Tech Corp',
          startDate: '2023-09-01',
          endDate: '2023-12-31',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Tech Corp',
          hoursPerWeek: 40,
          startDate: '2023-08-31', // 1 day before auth start
          endDate: '2023-12-31',
        },
      ],
    },
    expect: { 'cpt-authorization-prior': 'violation' },
  },

  {
    id: 'e13-cpt-auth/no-auth-for-employer-is-violation',
    description:
      'CPT employment at "Tech Corp" with authorization only for "Different Corp" = violation. ' +
      'Employer matching is case-insensitive but must be the same employer.',
    today: TODAY,
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-cpt',
          authType: 'CPT',
          employer: 'Different Corp', // does not match employment employer
          startDate: '2023-09-01',
          endDate: '2023-12-31',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Tech Corp',
          hoursPerWeek: 40,
          startDate: '2023-09-01',
          endDate: '2023-12-31',
        },
      ],
    },
    expect: { 'cpt-authorization-prior': 'violation' },
  },
];
