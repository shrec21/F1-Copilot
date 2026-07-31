import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';
import { addDays, daysBetween } from '../dates';

const RULE: ComplianceRule = {
  id: 'grace-period-60-day',
  version: 1,
  title: '60-Day Post-Completion Grace Period',
  sourceCitation: '8 CFR § 214.2(f)(5)(iv)',
  effectiveDate: '2008-04-08',
  supersedes: null,
};

/**
 * Returns the date from which the 60-day grace period begins.
 *
 * Priority:
 * 1. STEM-OPT EAD expiry (if student has STEM-OPT authorization)
 * 2. OPT EAD expiry (if student has OPT authorization)
 * 3. Program end date
 */
function graceStartDate(
  programEndDate: string,
  context: RuleContext,
): { basis: string; date: string } {
  const stemAuth = context.authorizations.find(a => a.authType === 'STEM-OPT');
  if (stemAuth) return { basis: 'STEM-OPT EAD expiry', date: stemAuth.endDate };

  const optAuth = context.authorizations.find(a => a.authType === 'OPT');
  if (optAuth) return { basis: 'OPT EAD expiry', date: optAuth.endDate };

  return { basis: 'program end date', date: programEndDate };
}

/**
 * Checks whether the student is within or past their 60-day grace period.
 *
 * The grace period begins the day after the completion event (program end,
 * OPT expiry, or STEM-OPT expiry — whichever is latest). The student must
 * depart, transfer, or change status by the grace period end date.
 *
 * Before the completion event: pass (grace period has not started).
 * Within the grace period: warning (action required, days remaining shown).
 * After the grace period: violation (unlawful presence may be accruing).
 */
export function checkGracePeriod60Day(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  const { basis, date: completionDate } = graceStartDate(
    student.programEndDate,
    context,
  );

  const graceEnd = addDays(completionDate, 60);
  const daysUntilGraceEnd = daysBetween(todayIso, graceEnd);
  const daysUntilCompletion = daysBetween(todayIso, completionDate);

  // Grace period has not started yet
  if (todayIso <= completionDate) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: { completionDate, basis, graceEnd, todayIso },
      outputs: { daysUntilCompletionEvent: daysUntilCompletion, graceEnd },
      message: `${basis} not yet reached (${completionDate}). Grace period begins after that date.`,
    };
  }

  // Within grace period
  if (todayIso <= graceEnd) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'warning',
      computedAt: todayIso,
      inputs: { completionDate, basis, graceEnd, todayIso },
      outputs: { daysRemainingInGracePeriod: daysUntilGraceEnd, graceEnd },
      message: `Grace period active — ${daysUntilGraceEnd} day(s) remaining (ends ${graceEnd}). Must depart, transfer, or change status before then.`,
    };
  }

  // Past grace period
  const daysOverdue = daysBetween(graceEnd, todayIso);
  return {
    rule: RULE,
    studentId: student.id,
    status: 'violation',
    computedAt: todayIso,
    inputs: { completionDate, basis, graceEnd, todayIso },
    outputs: { daysOverdue, graceEnd },
    message: `60-day grace period ended on ${graceEnd} — ${daysOverdue} day(s) ago. Unlawful presence may be accruing. Consult DSO and immigration attorney immediately.`,
  };
}
