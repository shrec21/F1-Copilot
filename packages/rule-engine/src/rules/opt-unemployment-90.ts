import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';
import { unemployedDaysInWindow, addDays } from '../dates';

const RULE: ComplianceRule = {
  id: 'opt-unemployment-90',
  version: 1,
  title: 'OPT Unemployment Cap — 90 Days',
  sourceCitation: '8 CFR § 214.2(f)(10)(ii)(A)',
  effectiveDate: '2008-04-08',
  supersedes: null,
};

const CAP = 90;
const WARNING_AT = 61; // warn when fewer than 30 days remain

/**
 * Checks whether unemployment days during the initial OPT period have
 * reached or exceeded the 90-day cap.
 *
 * "Unemployment" is any calendar day within the OPT EAD window where
 * the student has no active OPT employment period on record.
 */
export function checkOptUnemployment90(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  const optAuth = context.authorizations.find(a => a.authType === 'OPT');

  if (!optAuth) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { authorizationCount: context.authorizations.length },
      outputs: {},
      message: 'No OPT authorization on record — rule does not apply.',
    };
  }

  // Evaluate up to today or EAD end, whichever is earlier
  const windowEnd = optAuth.endDate < todayIso ? optAuth.endDate : todayIso;

  const optEmployment = context.employmentPeriods
    .filter(ep => ep.authType === 'OPT')
    .map(ep => ({ start: ep.startDate, end: ep.endDate }));

  const daysUsed = unemployedDaysInWindow(optAuth.startDate, windowEnd, optEmployment);
  const daysRemaining = Math.max(0, CAP - daysUsed);

  let status: RuleResult['status'];
  if (daysUsed > CAP) {
    status = 'violation';
  } else if (daysUsed >= WARNING_AT) {
    status = 'warning';
  } else {
    status = 'pass';
  }

  const capExceededBy = Math.max(0, daysUsed - CAP);
  const projectedViolationDate =
    daysRemaining > 0 ? addDays(windowEnd, daysRemaining) : null;

  const message =
    status === 'violation'
      ? `90-day cap exceeded by ${capExceededBy} day(s). Consult DSO and immigration attorney immediately.`
      : status === 'warning'
      ? `${daysUsed} of 90 unemployment day(s) used — ${daysRemaining} remaining. Approaching cap.`
      : `${daysUsed} of 90 unemployment day(s) used. ${daysRemaining} remaining.`;

  return {
    rule: RULE,
    studentId: student.id,
    status,
    computedAt: todayIso,
    inputs: {
      optWindowStart: optAuth.startDate,
      optWindowEnd: optAuth.endDate,
      evaluatedThrough: windowEnd,
      optEmploymentPeriods: optEmployment.length,
    },
    outputs: {
      unemploymentDaysUsed: daysUsed,
      daysRemainingBeforeCap: daysRemaining,
      cap: CAP,
      projectedViolationDate,
    },
    message,
  };
}
