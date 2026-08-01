/**
 * Adversarial eval scenarios: 60-day post-completion grace period.
 *
 * Key boundary facts:
 *   - Completion day itself (today === completionDate) → pass
 *   - Day 1 after completion → warning begins (grace period starts)
 *   - Day 60 after completion (graceEnd = completionDate + 60) → warning, 0 remaining
 *   - Day 61 after completion → violation (first day of overstay)
 *
 * completionDate priority: STEM-OPT expiry > OPT expiry > programEndDate
 */

import type { EvalScenario } from '../types';

// Student with no OPT/STEM-OPT auth: grace period anchors to programEndDate.
const STUDENT = {
  id: 'eval-stu',
  fullName: 'Eval Student',
  sevisId: 'N0099900000',
  programLevel: 'masters' as const,
  major: 'Computer Science',
  isStemDesignated: false,
  programStartDate: '2022-09-01',
  programEndDate: '2024-05-01', // ← completion date for this scenario group
  admissionType: 'D/S' as const,
  i94AdmissionDate: '2022-08-28',
  i94ExpiryDate: null,
};

// graceEnd = addDays('2024-05-01', 60) = '2024-06-30'
// (May has 31 days: May 1 + 30 = May 31, + 30 = June 30)

export const GRACE_PERIOD_SCENARIOS: EvalScenario[] = [
  {
    id: 'e14-grace/completion-day-is-pass',
    description:
      'Today = programEndDate (completion day itself) → pass. ' +
      'Grace period begins the day AFTER completion, not on completion day.',
    today: '2024-05-01',
    student: STUDENT,
    context: { authorizations: [], stemI983Submissions: [], employmentPeriods: [] },
    expect: { 'grace-period-60-day': 'pass' },
  },

  {
    id: 'e15-grace/day-60-last-day-of-grace-is-warning',
    description:
      'Today = completionDate + 60 (= 2024-06-30) → warning with 0 days remaining. ' +
      'Last day of grace period is still within the window: todayIso <= graceEnd.',
    today: '2024-06-30',
    student: STUDENT,
    context: { authorizations: [], stemI983Submissions: [], employmentPeriods: [] },
    expect: { 'grace-period-60-day': 'warning' },
    expectOutputs: { 'grace-period-60-day': { daysRemainingInGracePeriod: 0 } },
  },

  {
    id: 'e16-grace/day-61-first-violation-day',
    description:
      'Today = completionDate + 61 (= 2024-07-01) → violation, 1 day overdue. ' +
      'First day that todayIso > graceEnd.',
    today: '2024-07-01',
    student: STUDENT,
    context: { authorizations: [], stemI983Submissions: [], employmentPeriods: [] },
    expect: { 'grace-period-60-day': 'violation' },
    expectOutputs: { 'grace-period-60-day': { daysOverdue: 1 } },
  },
];
