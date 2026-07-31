import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';
import { daysBetween, addDays } from '../dates';

const RULE: ComplianceRule = {
  id: 'opt-application-window',
  version: 1,
  title: 'OPT Application and EAD Start Date Window',
  // NOTE: The 30-day post-DSO-recommendation filing deadline is flagged as
  // uncertain pending regulatory verification. This version encodes the
  // two constraints we are confident about:
  // (1) EAD start date may not precede program end date.
  // (2) EAD start date must be within 60 days after program end date.
  sourceCitation: '8 CFR § 214.2(f)(11)(i)',
  effectiveDate: '2008-04-08',
  supersedes: null,
};

/**
 * Checks that the student's OPT EAD start date is within the valid window
 * relative to their program end date.
 *
 * Valid window: [programEndDate, programEndDate + 60 days]
 *
 * - Before programEndDate: EAD cannot start before graduation.
 * - After programEndDate + 60 days: application window has closed.
 *
 * If no OPT authorization exists, checks whether the student is still
 * within the filing window (up to 60 days after program end) and warns
 * if time is running out.
 */
export function checkOptApplicationWindow(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  const optAuth = context.authorizations.find(a => a.authType === 'OPT');
  const windowOpen = student.programEndDate;
  const windowClose = addDays(student.programEndDate, 60);

  // If OPT authorization exists, validate EAD start date
  if (optAuth) {
    const eadStart = optAuth.startDate;

    if (eadStart < windowOpen) {
      const daysEarly = daysBetween(eadStart, windowOpen);
      return {
        rule: RULE,
        studentId: student.id,
        status: 'violation',
        computedAt: todayIso,
        inputs: {
          programEndDate: student.programEndDate,
          eadStartDate: eadStart,
          windowOpen,
          windowClose,
        },
        outputs: { daysBeforeWindow: daysEarly },
        message: `OPT EAD start date (${eadStart}) is ${daysEarly} day(s) before program end date (${windowOpen}). EAD may not start before graduation.`,
      };
    }

    if (eadStart > windowClose) {
      const daysLate = daysBetween(windowClose, eadStart);
      return {
        rule: RULE,
        studentId: student.id,
        status: 'violation',
        computedAt: todayIso,
        inputs: {
          programEndDate: student.programEndDate,
          eadStartDate: eadStart,
          windowOpen,
          windowClose,
        },
        outputs: { daysAfterWindow: daysLate },
        message: `OPT EAD start date (${eadStart}) is ${daysLate} day(s) after the 60-day post-program-end deadline (${windowClose}).`,
      };
    }

    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: {
        programEndDate: student.programEndDate,
        eadStartDate: eadStart,
        windowOpen,
        windowClose,
      },
      outputs: { eadStartWithinWindow: true },
      message: `OPT EAD start date (${eadStart}) is within the valid window [${windowOpen}, ${windowClose}].`,
    };
  }

  // No OPT authorization — check if the window is still open or has closed
  if (todayIso < windowOpen) {
    const daysUntilOpen = daysBetween(todayIso, windowOpen);
    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: { programEndDate: student.programEndDate, windowOpen, windowClose },
      outputs: { daysUntilWindowOpens: daysUntilOpen },
      message: `OPT window opens on ${windowOpen} (${daysUntilOpen} day(s) away). No OPT authorization recorded yet.`,
    };
  }

  if (todayIso <= windowClose) {
    const daysRemaining = daysBetween(todayIso, windowClose);
    const status = daysRemaining <= 14 ? 'warning' : 'pass';
    return {
      rule: RULE,
      studentId: student.id,
      status,
      computedAt: todayIso,
      inputs: { programEndDate: student.programEndDate, windowOpen, windowClose },
      outputs: { daysRemainingInWindow: daysRemaining },
      message: `OPT filing window closes on ${windowClose} — ${daysRemaining} day(s) remaining. No OPT authorization recorded yet.`,
    };
  }

  return {
    rule: RULE,
    studentId: student.id,
    status: 'violation',
    computedAt: todayIso,
    inputs: { programEndDate: student.programEndDate, windowOpen, windowClose },
    outputs: { windowClosedDaysAgo: daysBetween(windowClose, todayIso) },
    message: `OPT filing window closed on ${windowClose}. No OPT authorization recorded. Student may have missed the opportunity.`,
  };
}
