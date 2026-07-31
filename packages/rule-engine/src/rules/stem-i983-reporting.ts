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
 * Due dates:
 * - First report: 12 months after STEM OPT authorization start date
 * - Subsequent reports: 12 months after each prior submission
 *
 * If no submissions are on record, the next due date is STEM start + 12 months.
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

  // Determine when the next report is due
  let nextDueDate: string;
  let lastSubmission: string | null = null;

  if (submissions.length === 0) {
    nextDueDate = addDays(stemStart, REPORTING_INTERVAL_DAYS);
  } else {
    lastSubmission = submissions[submissions.length - 1];
    nextDueDate = addDays(lastSubmission, REPORTING_INTERVAL_DAYS);
  }

  // The next report is only required if its due date falls within the STEM-OPT period.
  // If the due date is after STEM expiry, no report is needed.
  const reportRequiredByDueDate =
    nextDueDate !== null && nextDueDate <= stemAuth.endDate;

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
