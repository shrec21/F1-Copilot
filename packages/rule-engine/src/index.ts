// Public API of the @f1/rule-engine package.
// Import from here, not from individual rule files.

export type {
  Student,
  EmploymentPeriod,
  AuthorizationPeriod,
  RuleContext,
  ComplianceRule,
  RuleStatus,
  RuleResult,
  ComplianceEventType,
  ComplianceEvent,
  AuditEntry,
} from './types';

export { checkOptUnemployment90 } from './rules/opt-unemployment-90';
export { checkOptUnemployment150Stem } from './rules/opt-unemployment-150-stem';
export { checkCptFullTimeOptBar } from './rules/cpt-full-time-opt-bar';
export { checkCptAuthorizationPrior } from './rules/cpt-authorization-prior';
export { checkGracePeriod60Day } from './rules/grace-period-60-day';
export { checkOptApplicationWindow } from './rules/opt-application-window';
export { checkStemEmployerEverify } from './rules/stem-employer-everify';
export { checkStemI983Reporting } from './rules/stem-i983-reporting';

// Date utilities exposed for use by the backend adapter layer
export { daysBetween, addDays } from './dates';

/**
 * Runs all applicable rules for a student and returns the full result set.
 * Rules that return 'not-applicable' are still included in the output so
 * callers can distinguish "checked and not applicable" from "not checked."
 */
import type { Student, RuleContext, RuleResult } from './types';
import { checkOptUnemployment90 } from './rules/opt-unemployment-90';
import { checkOptUnemployment150Stem } from './rules/opt-unemployment-150-stem';
import { checkCptFullTimeOptBar } from './rules/cpt-full-time-opt-bar';
import { checkCptAuthorizationPrior } from './rules/cpt-authorization-prior';
import { checkGracePeriod60Day } from './rules/grace-period-60-day';
import { checkOptApplicationWindow } from './rules/opt-application-window';
import { checkStemEmployerEverify } from './rules/stem-employer-everify';
import { checkStemI983Reporting } from './rules/stem-i983-reporting';

export function evaluateAllRules(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult[] {
  return [
    checkOptUnemployment90(student, context, todayIso),
    checkOptUnemployment150Stem(student, context, todayIso),
    checkCptFullTimeOptBar(student, context, todayIso),
    checkCptAuthorizationPrior(student, context, todayIso),
    checkGracePeriod60Day(student, context, todayIso),
    checkOptApplicationWindow(student, context, todayIso),
    checkStemEmployerEverify(student, context, todayIso),
    checkStemI983Reporting(student, context, todayIso),
  ];
}
