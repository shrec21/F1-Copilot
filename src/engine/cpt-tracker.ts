import type { Role } from './types';

export interface CptImpactResult {
  totalFullTimeDays: number;
  totalFullTimeMonths: number;
  optEligibilityAtRisk: boolean;
  appliedRuleId: string;
  disclaimer: string;
}

/**
 * Checks whether accumulated full-time CPT puts OPT eligibility at risk.
 *
 * Counts the union of actual calendar days covered by full-time CPT roles
 * (overlapping periods are deduplicated). Converts to months by dividing
 * by 30 (rounded to 1 decimal place).
 *
 * @param cptRoles - All CPT roles (filters for cptType === 'full-time' internally)
 * @param fullTimeCptCapMonths - Threshold from RuleFile (e.g. 12)
 * @param appliedRuleId - e.g. "cpt-opt-eligibility-impact"
 * @param disclaimer - RuleFile.disclaimer to pass through
 */
export function checkCptEligibilityImpact(
  cptRoles: Role[],
  fullTimeCptCapMonths: number,
  appliedRuleId: string,
  disclaimer: string,
): CptImpactResult {
  const coveredDays = new Set<string>();

  for (const role of cptRoles) {
    if (role.authorizationType !== 'CPT' || role.cptType !== 'full-time') continue;

    const today = new Date();
    const endStr = role.period.end ??
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
        .toISOString()
        .slice(0, 10);

    const cursor = new Date(role.period.start + 'T00:00:00Z');
    const endDate = new Date(endStr + 'T00:00:00Z');

    while (cursor <= endDate) {
      coveredDays.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const totalFullTimeDays = coveredDays.size;
  const totalFullTimeMonths = Math.round((totalFullTimeDays / 30) * 10) / 10;
  const optEligibilityAtRisk = totalFullTimeDays >= fullTimeCptCapMonths * 30;

  return {
    totalFullTimeDays,
    totalFullTimeMonths,
    optEligibilityAtRisk,
    appliedRuleId,
    disclaimer,
  };
}
