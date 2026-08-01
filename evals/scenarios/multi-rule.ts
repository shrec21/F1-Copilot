/**
 * Cross-rule adversarial scenarios that exercise evaluateAllRules() end-to-end.
 *
 * These scenarios are not testing individual rules but real student situations
 * where multiple rules fire simultaneously. They catch regressions that only
 * appear in the full pipeline.
 */

import type { EvalScenario } from '../types';

// OPT auth used in cross-rule scenarios
const OPT_AUTH = {
  id: 'auth-opt',
  authType: 'OPT' as const,
  startDate: '2024-05-01',
  endDate: '2025-04-30',
};

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

export const MULTI_RULE_SCENARIOS: EvalScenario[] = [
  {
    id: 'e26-multi/all-clear-opt-student',
    description:
      'A well-behaved OPT student: employed from day 1, OPT window valid, program ongoing. ' +
      'Verifies that a clean profile produces all-pass results through the full pipeline.',
    today: '2024-08-01', // mid-OPT, well within all windows
    student: BASE_STUDENT,
    context: {
      authorizations: [OPT_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Good Employer Inc',
          hoursPerWeek: 40,
          startDate: '2024-05-01',
          endDate: null, // currently employed
        },
      ],
    },
    expect: {
      'opt-unemployment-90': 'pass',
      'cpt-full-time-opt-bar': 'pass',
      'cpt-authorization-prior': 'not-applicable',
      'grace-period-60-day': 'pass',
      'opt-application-window': 'pass',
      'stem-employer-everify': 'not-applicable',
      'stem-i983-reporting': 'not-applicable',
      'opt-unemployment-150-stem': 'not-applicable',
    },
  },

  {
    id: 'e27-multi/double-violation-opt-unemployment-and-grace-period',
    description:
      'OPT student with 91-day unemployment gap (violation) AND today is 61 days past OPT ' +
      'expiry (grace period violation). Both violations must fire simultaneously. ' +
      'This tests the independence of the two rules — neither suppresses the other.',
    // OPT end: 2025-04-30. graceEnd = addDays('2025-04-30', 60) = 2025-06-29.
    // Today: 2025-06-30 → 1 day past graceEnd → violation.
    today: '2025-06-30',
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
          // 91-day unemployment gap: May 1–July 30 (31+30+30=91 days)
          startDate: '2024-07-31',
          endDate: '2025-04-30',
        },
      ],
    },
    expect: {
      'opt-unemployment-90': 'violation',
      'grace-period-60-day': 'violation',
    },
    expectOutputs: {
      'opt-unemployment-90': { unemploymentDaysUsed: 91 },
      'grace-period-60-day': { daysOverdue: 1 },
    },
  },
];
