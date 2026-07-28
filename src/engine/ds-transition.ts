export interface DsTransitionResult {
  regime: 'D/S' | 'fixed-date';
  transitionDeadline: string | null;  // ISO 8601 date; null if already on fixed-date
  graceperiodEndDate: string | null;  // ISO 8601 date from programEndDate + graceDays
  appliedRuleId: string;
  disclaimer: string;
}

/**
 * Returns UTC midnight Date for an ISO 8601 date string "YYYY-MM-DD".
 */
function toUtcDate(iso: string): Date {
  const parts = iso.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Adds a number of calendar days to a UTC date and returns ISO 8601 string.
 */
function addDays(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Determines a student's regime under the Sept 15 2026 D/S transition rule.
 *
 * @param admissionDate - The student's most recent I-94 admission date (ISO 8601)
 * @param programEndDate - The I-20 program end date (ISO 8601)
 * @param isCurrentlyDs - Whether the student is currently admitted D/S
 * @param fixedPeriodEffectiveDate - From RuleFile, e.g. "2026-09-15"
 * @param pendingDsDeadline - From RuleFile, e.g. "2027-03-18"
 * @param gracePeriodDays - From RuleFile, e.g. 60
 * @param appliedRuleId - e.g. "fixed-period-admission-effective-date"
 * @param disclaimer - RuleFile.disclaimer to pass through
 */
export function checkDsTransitionStatus(
  admissionDate: string,
  programEndDate: string,
  isCurrentlyDs: boolean,
  fixedPeriodEffectiveDate: string,
  pendingDsDeadline: string,
  gracePeriodDays: number,
  appliedRuleId: string,
  disclaimer: string,
): DsTransitionResult {
  const graceperiodEndDate = addDays(programEndDate, gracePeriodDays);

  // If admissionDate is on or after fixedPeriodEffectiveDate: regime = 'fixed-date'
  if (admissionDate >= fixedPeriodEffectiveDate) {
    return {
      regime: 'fixed-date',
      transitionDeadline: null,
      graceperiodEndDate,
      appliedRuleId,
      disclaimer,
    };
  }

  // Else: only D/S if the student is currently admitted D/S.
  // A pre-transition student not on D/S already has a fixed-date I-94 expiry.
  if (!isCurrentlyDs) {
    return {
      regime: 'fixed-date',
      transitionDeadline: null,
      graceperiodEndDate,
      appliedRuleId,
      disclaimer,
    };
  }

  return {
    regime: 'D/S',
    transitionDeadline: pendingDsDeadline,
    graceperiodEndDate,
    appliedRuleId,
    disclaimer,
  };
}
