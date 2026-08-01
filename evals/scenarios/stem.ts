/**
 * Adversarial eval scenarios: STEM OPT rules.
 *
 * stem-employer-everify:
 *   - employerEverifyEnrolled === true      → pass
 *   - employerEverifyEnrolled === false     → violation
 *   - employerEverifyEnrolled === undefined → warning (unconfirmed)
 *
 * stem-i983-reporting (fixed-deadline semantics after bug fix):
 *   Due dates are ANCHORED TO STEM START, not rolling from last submission.
 *     1st due: stemStart + 365
 *     2nd due: stemStart + 730
 *   A late submission does NOT advance the next deadline.
 *   A report is required if its due date falls within STEM period or
 *   within the 10-day post-conclusion window.
 */

import type { EvalScenario } from '../types';

const STEM_STUDENT = {
  id: 'eval-stu',
  fullName: 'Eval Student',
  sevisId: 'N0099900000',
  programLevel: 'masters' as const,
  major: 'Computer Science',
  isStemDesignated: true,
  programStartDate: '2022-09-01',
  programEndDate: '2024-05-01',
  admissionType: 'D/S' as const,
  i94AdmissionDate: '2022-08-28',
  i94ExpiryDate: null,
};

// For I-983 scenarios: STEM-OPT start 2025-01-01, end 2027-01-05
// 1st due: addDays('2025-01-01', 365) = '2026-01-01'
// 2nd due: addDays('2025-01-01', 730) = '2027-01-01'
// STEM end '2027-01-05': addDays('2027-01-05', 10) = '2027-01-15'
// '2027-01-01' <= '2027-01-15' → 2nd report required within 10-day window ✓
const STEM_AUTH_I983 = {
  id: 'auth-stem-i983',
  authType: 'STEM-OPT' as const,
  startDate: '2025-01-01',
  endDate: '2027-01-05',
};

// For E-Verify scenarios: generic STEM-OPT auth
const STEM_AUTH_EVERIFY = {
  id: 'auth-stem-ev',
  authType: 'STEM-OPT' as const,
  startDate: '2025-05-01',
  endDate: '2027-04-30',
};

export const STEM_SCENARIOS: EvalScenario[] = [
  // ── stem-employer-everify ────────────────────────────────────────────────────

  {
    id: 'e22-everify/confirmed-is-pass',
    description:
      'STEM OPT employer with employerEverifyEnrolled=true → pass.',
    today: '2026-01-01',
    student: STEM_STUDENT,
    context: {
      authorizations: [STEM_AUTH_EVERIFY],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-stem',
          authType: 'STEM-OPT',
          employer: 'Google LLC',
          hoursPerWeek: 40,
          startDate: '2025-05-01',
          endDate: null,
          employerEverifyEnrolled: true,
        },
      ],
    },
    expect: { 'stem-employer-everify': 'pass' },
  },

  {
    id: 'e23-everify/not-enrolled-is-violation',
    description:
      'STEM OPT employer with employerEverifyEnrolled=false → violation. ' +
      'Student confirmed employer is NOT enrolled in E-Verify.',
    today: '2026-01-01',
    student: STEM_STUDENT,
    context: {
      authorizations: [STEM_AUTH_EVERIFY],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-stem',
          authType: 'STEM-OPT',
          employer: 'Small Shop Inc',
          hoursPerWeek: 40,
          startDate: '2025-05-01',
          endDate: null,
          employerEverifyEnrolled: false, // confirmed not enrolled
        },
      ],
    },
    expect: { 'stem-employer-everify': 'violation' },
  },

  // ── stem-i983-reporting: fixed-deadline behavior ─────────────────────────────

  {
    id: 'e24-i983/fixed-deadline-after-early-submission',
    description:
      'After 1 submission filed 12 days early (2025-12-20), today is 2026-03-01. ' +
      'Next due must be stemStart + 730 = 2027-01-01 (fixed deadline), ' +
      'NOT submission + 365 = 2026-12-20 (old rolling behavior). Status = pass.',
    today: '2026-03-01',
    student: STEM_STUDENT,
    context: {
      authorizations: [STEM_AUTH_I983],
      stemI983Submissions: ['2025-12-20'], // submitted 12 days before first due 2026-01-01
      employmentPeriods: [],
    },
    expect: { 'stem-i983-reporting': 'pass' },
    // KEY assertion: next due date anchors to STEM start, not last submission
    expectOutputs: { 'stem-i983-reporting': { nextDueDate: '2027-01-01' } },
  },

  {
    id: 'e25-i983/second-report-overdue-after-fixed-deadline',
    description:
      'After 1 submission, today is 14 days past the FIXED second due date (2027-01-01). ' +
      'Should be violation (14 days overdue). Validates that fixed-deadline semantics ' +
      'correctly identifies overdue status even when student filed first report early.',
    today: '2027-01-15', // 14 days past second due 2027-01-01
    student: STEM_STUDENT,
    context: {
      authorizations: [STEM_AUTH_I983],
      stemI983Submissions: ['2025-12-20'], // only the first report, no second
      employmentPeriods: [],
    },
    expect: { 'stem-i983-reporting': 'violation' },
    expectOutputs: { 'stem-i983-reporting': { daysOverdue: 14 } },
  },
];
