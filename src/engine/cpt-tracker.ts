import type { Role } from './types';

export interface CptImpactResult {
  totalFullTimeMonths: number;
  optEligibilityAtRisk: boolean;
  appliedRuleId: string;
  disclaimer: string;
}

/**
 * Returns a "YYYY-MM" string representing the calendar month of a date.
 */
function toYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Returns all "YYYY-MM" strings for each calendar month that falls within
 * the date range [start, end] inclusive. A month is included if any day
 * in that month falls within the range.
 */
function monthsInRange(start: string, end: string): Set<string> {
  const months = new Set<string>();

  const startParts = start.split('-');
  let year = parseInt(startParts[0], 10);
  let month = parseInt(startParts[1], 10);

  const endYearMonth = toYearMonth(end);

  while (true) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    months.add(ym);

    if (ym >= endYearMonth) break;

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * Checks whether accumulated full-time CPT puts OPT eligibility at risk.
 *
 * @param cptRoles - All CPT roles (filter for cptType === 'full-time' internally)
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
  // Count the union of calendar months touched by full-time CPT roles
  const fullTimeMonths = new Set<string>();

  for (const role of cptRoles) {
    if (role.authorizationType !== 'CPT' || role.cptType !== 'full-time') continue;

    const end = role.period.end ?? (() => {
      const today = new Date();
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
    })();

    const months = monthsInRange(role.period.start, end);
    for (const m of months) {
      fullTimeMonths.add(m);
    }
  }

  const totalFullTimeMonths = fullTimeMonths.size;
  const optEligibilityAtRisk = totalFullTimeMonths >= fullTimeCptCapMonths;

  return {
    totalFullTimeMonths,
    optEligibilityAtRisk,
    appliedRuleId,
    disclaimer,
  };
}
