import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';
import { unemployedDaysInWindow } from '../dates';

const RULE: ComplianceRule = {
  id: 'opt-unemployment-150-stem',
  version: 1,
  title: 'STEM OPT Unemployment Cap — 150 Days (Cumulative)',
  sourceCitation: '8 CFR § 214.2(f)(11)(ii)',
  effectiveDate: '2016-05-10',
  supersedes: null,
};

const CAP = 150;
const WARNING_AT = 121; // warn when fewer than 30 days remain

/**
 * Checks whether cumulative unemployment days across the initial OPT period
 * AND the STEM OPT extension have reached or exceeded 150 days.
 *
 * The 150-day cap is cumulative: days used during initial OPT count toward
 * the 150-day total for the STEM extension period.
 *
 * Applies only when both OPT and STEM-OPT authorizations are present.
 */
export function checkOptUnemployment150Stem(
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

  const optAuth = context.authorizations.find(a => a.authType === 'OPT');
  const stemAuth = context.authorizations.find(a => a.authType === 'STEM-OPT');

  if (!stemAuth) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { isStemDesignated: true, stemAuthFound: false },
      outputs: {},
      message: 'No STEM OPT authorization on record — rule does not apply yet.',
    };
  }

  const allEmployment = context.employmentPeriods
    .filter(ep => ep.authType === 'OPT' || ep.authType === 'STEM-OPT')
    .map(ep => ({ start: ep.startDate, end: ep.endDate }));

  // Count unemployment across the OPT window (if any) and the STEM-OPT window
  let daysInOpt = 0;
  if (optAuth) {
    const optEnd = optAuth.endDate < todayIso ? optAuth.endDate : todayIso;
    daysInOpt = unemployedDaysInWindow(optAuth.startDate, optEnd, allEmployment);
  }

  const stemEnd = stemAuth.endDate < todayIso ? stemAuth.endDate : todayIso;
  const daysInStem = unemployedDaysInWindow(stemAuth.startDate, stemEnd, allEmployment);

  const totalDaysUsed = daysInOpt + daysInStem;
  const daysRemaining = Math.max(0, CAP - totalDaysUsed);

  let status: RuleResult['status'];
  if (totalDaysUsed > CAP) {
    status = 'violation';
  } else if (totalDaysUsed >= WARNING_AT) {
    status = 'warning';
  } else {
    status = 'pass';
  }

  const capExceededBy = Math.max(0, totalDaysUsed - CAP);

  const message =
    status === 'violation'
      ? `150-day cumulative cap exceeded by ${capExceededBy} day(s). Consult DSO and immigration attorney immediately.`
      : status === 'warning'
      ? `${totalDaysUsed} of 150 cumulative unemployment day(s) used — ${daysRemaining} remaining. Approaching cap.`
      : `${totalDaysUsed} of 150 cumulative unemployment day(s) used. ${daysRemaining} remaining.`;

  return {
    rule: RULE,
    studentId: student.id,
    status,
    computedAt: todayIso,
    inputs: {
      optWindowStart: optAuth?.startDate ?? null,
      optWindowEnd: optAuth?.endDate ?? null,
      stemWindowStart: stemAuth.startDate,
      stemWindowEnd: stemAuth.endDate,
      evaluatedThrough: todayIso,
    },
    outputs: {
      unemploymentDaysInOpt: daysInOpt,
      unemploymentDaysInStem: daysInStem,
      totalUnemploymentDays: totalDaysUsed,
      daysRemainingBeforeCap: daysRemaining,
      cap: CAP,
    },
    message,
  };
}
