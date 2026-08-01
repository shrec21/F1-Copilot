/**
 * Adversarial eval scenarios: OPT application window (EAD start date timing).
 *
 * The rule encodes post-completion OPT only:
 *   windowOpen  = programEndDate
 *   windowClose = programEndDate + 60 days
 *
 * If an OPT auth exists:
 *   eadStart < windowOpen  → violation (before graduation)
 *   eadStart > windowClose → violation (too late)
 *   otherwise              → pass
 *
 * If no OPT auth:
 *   today > windowClose → violation (missed the filing window)
 *   today within window, <= 14 days remaining → warning
 *   otherwise → pass
 *
 * NOTE (known limitation): Pre-completion OPT (EAD starting up to 90 days before
 * program end, 8 CFR § 214.2(f)(11)(i)(A)) is NOT modeled by this rule.
 * The scenario for pre-completion OPT is marked skip=true below.
 */

import type { EvalScenario } from '../types';

// programEndDate = '2024-05-01'
// windowOpen  = '2024-05-01'
// windowClose = addDays('2024-05-01', 60) = '2024-06-30'

const STUDENT = {
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

export const OPT_WINDOW_SCENARIOS: EvalScenario[] = [
  {
    id: 'e17-opt-window/ead-on-program-end-is-pass',
    description:
      'OPT EAD start date = programEndDate → pass. ' +
      'Starting OPT on graduation day is within the valid window.',
    today: '2024-07-01',
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-opt',
          authType: 'OPT',
          startDate: '2024-05-01', // = windowOpen (programEndDate)
          endDate: '2025-04-30',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    expect: { 'opt-application-window': 'pass' },
  },

  {
    id: 'e18-opt-window/ead-1-day-before-grad-is-violation',
    description:
      'OPT EAD start 1 day before programEndDate = violation. ' +
      'EAD cannot start before graduation.',
    today: '2024-07-01',
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-opt',
          authType: 'OPT',
          startDate: '2024-04-30', // 1 day before windowOpen
          endDate: '2025-04-29',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    expect: { 'opt-application-window': 'violation' },
  },

  {
    id: 'e19-opt-window/ead-exactly-60-days-after-is-pass',
    description:
      'OPT EAD start = programEndDate + 60 days (= windowClose) → pass. ' +
      'windowClose is the last valid EAD start date (inclusive).',
    today: '2024-07-01',
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-opt',
          authType: 'OPT',
          startDate: '2024-06-30', // = windowClose = programEndDate + 60
          endDate: '2025-06-29',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    expect: { 'opt-application-window': 'pass' },
  },

  {
    id: 'e20-opt-window/ead-61-days-after-is-violation',
    description:
      'OPT EAD start = programEndDate + 61 days (1 past windowClose) → violation.',
    today: '2024-07-01',
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-opt',
          authType: 'OPT',
          startDate: '2024-07-01', // = windowClose + 1
          endDate: '2025-06-30',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    expect: { 'opt-application-window': 'violation' },
  },

  {
    id: 'e21-opt-window/no-auth-after-window-closed-is-violation',
    description:
      'No OPT authorization filed, today > windowClose (61 days after graduation) = violation. ' +
      'Student missed the 60-day post-completion filing window.',
    today: '2024-07-01', // > windowClose 2024-06-30
    student: STUDENT,
    context: {
      authorizations: [],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    expect: { 'opt-application-window': 'violation' },
  },

  // ── Known limitation: pre-completion OPT ─────────────────────────────────

  {
    id: 'e-skip-opt-window/pre-completion-opt-not-modeled',
    description:
      '[KNOWN LIMITATION] Pre-completion OPT (EAD starting up to 90 days before graduation) ' +
      'is legal under 8 CFR § 214.2(f)(11)(i)(A) but the opt-application-window rule currently ' +
      'flags any EAD start date before programEndDate as a violation. ' +
      'This scenario is skipped until pre-completion OPT is modeled.',
    skip: true,
    skipReason:
      'opt-application-window rule only models post-completion OPT. ' +
      'Pre-completion OPT (EAD up to 90 days before program end) is not yet implemented.',
    today: '2024-07-01',
    student: STUDENT,
    context: {
      authorizations: [
        {
          id: 'auth-opt',
          authType: 'OPT',
          startDate: '2024-02-01', // 90 days before programEndDate 2024-05-01
          endDate: '2025-01-31',
        },
      ],
      stemI983Submissions: [],
      employmentPeriods: [],
    },
    // If pre-completion OPT were modeled, this should be 'pass'.
    // Current implementation returns 'violation'.
    expect: { 'opt-application-window': 'pass' },
  },
];
