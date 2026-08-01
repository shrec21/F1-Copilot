import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';
import { addDays, daysBetween } from '../dates';

const RULE: ComplianceRule = {
  id: 'stem-i983-reporting',
  version: 1,
  title: 'STEM OPT I-983 Self-Evaluation — 12-Month Reporting Cycle',
  sourceCitation: '8 CFR § 214.2(f)(10)(ii)(C)(8)',
  effectiveDate: '2016-05-10',
  supersedes: null,
};

const REPORTING_INTERVAL_DAYS = 365; // 12 months (annual cycle)
const WARNING_DAYS_BEFORE = 30;       // warn 30 days before due

/**
 * Checks whether the student has submitted their annual Form I-983
 * self-evaluation to their DSO within the required 12-month cycle.
 *
 * Due dates are fixed from STEM-OPT start (not rolling from last submission):
 * - First report: STEM start + 12 months (365 days)
 * - Second (final) report: STEM start + 24 months (730 days)
 *
 * A report is considered required if its nominal due date falls within the
 * STEM-OPT period or within the 10-day post-conclusion window per regulation:
 * 8 CFR § 214.2(f)(10)(ii)(C)(8) — "within 10 days following the conclusion
 * of each reporting period."
 */
export function checkStemI983Reporting(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  if (!student.isStemDesignated) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { isStemDesignated: false },
      outputs: {},
      message: 'Student is not STEM-designated — rule does not apply.',
    };
  }

  const stemAuth = context.authorizations.find(a => a.authType === 'STEM-OPT');
  if (!stemAuth) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { isStemDesignated: true, stemAuthFound: false },
      outputs: {},
      message: 'No STEM OPT authorization on record — reporting cycle has not begun.',
    };
  }

  const submissions = [...context.stemI983Submissions].sort();
  const stemStart = stemAuth.startDate;

  // Due dates are fixed from STEM-OPT start date, not rolling from last submission.
  // 8 CFR § 214.2(f)(10)(ii)(C)(8): annual evaluations at 12-month intervals
  // anchored to the start of the STEM OPT period (SEVP guidance: first report
  // at stemStart + 12 months, subsequent reports at stemStart + 24 months, etc.).
  // A late submission does NOT advance the next deadline.
  const nextDueDate = addDays(stemStart, (submissions.length + 1) * REPORTING_INTERVAL_DAYS);
  const lastSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

  // A report is required if its nominal due date falls within the STEM-OPT period or
  // within the 10-day post-conclusion window allowed for final-assessment submission.
  // (8 CFR § 214.2(f)(10)(ii)(C)(8): submit "within 10 days following the conclusion.")
  const reportRequiredByDueDate =
    nextDueDate !== null && nextDueDate <= addDays(stemAuth.endDate, 10);

  if (reportRequiredByDueDate) {
    const daysUntilDue = daysBetween(todayIso, nextDueDate);

    if (daysUntilDue < 0) {
      return {
        rule: RULE,
        studentId: student.id,
        status: 'violation',
        computedAt: todayIso,
        inputs: { stemStart, lastSubmission, nextDueDate, submissionCount: submissions.length },
        outputs: { daysOverdue: Math.abs(daysUntilDue), nextDueDate },
        message: `I-983 self-evaluation is ${Math.abs(daysUntilDue)} day(s) overdue (was due ${nextDueDate}). Submit to DSO immediately.`,
      };
    }

    if (daysUntilDue <= WARNING_DAYS_BEFORE) {
      return {
        rule: RULE,
        studentId: student.id,
        status: 'warning',
        computedAt: todayIso,
        inputs: { stemStart, lastSubmission, nextDueDate, submissionCount: submissions.length },
        outputs: { daysUntilDue, nextDueDate },
        message: `I-983 self-evaluation due in ${daysUntilDue} day(s) (${nextDueDate}). Schedule submission with your DSO.`,
      };
    }

    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: { stemStart, lastSubmission, nextDueDate, submissionCount: submissions.length },
      outputs: { daysUntilDue, nextDueDate },
      message: `I-983 reporting current. Next due: ${nextDueDate} (${daysUntilDue} day(s) away).`,
    };
  }

  // Next due date is after STEM expiry — no more reporting needed
  return {
    rule: RULE,
    studentId: student.id,
    status: 'pass',
    computedAt: todayIso,
    inputs: { stemStart, stemEnd: stemAuth.endDate, submissionCount: submissions.length },
    outputs: { submissionsOnRecord: submissions.length, stemExpired: todayIso > stemAuth.endDate },
    message: `STEM OPT period ended on ${stemAuth.endDate}. ${submissions.length} I-983 submission(s) recorded.`,
  };
}
