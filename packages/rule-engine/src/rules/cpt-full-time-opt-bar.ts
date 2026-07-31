import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';

const RULE: ComplianceRule = {
  id: 'cpt-full-time-opt-bar',
  version: 1,
  title: 'Full-Time CPT Bar on OPT Eligibility — 12 Months',
  sourceCitation: '8 CFR § 214.2(f)(10)(i)',
  effectiveDate: '1996-01-01',
  supersedes: null,
};

// The regulation says "12 months". Compare at the month level — converting to
// days (e.g. 12 * 30 = 360) loses precision due to variable month lengths.
const CAP_MONTHS = 12;
const WARNING_AT_MONTHS = 11; // warn when within 1 month of the bar

/** Returns "YYYY-MM" for an ISO date. */
function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Returns the set of "YYYY-MM" calendar months touched by [startIso, endIso].
 * A month is included if at least one day of it falls in the range.
 */
function monthsInRange(startIso: string, endIso: string): Set<string> {
  const months = new Set<string>();
  const [sy, sm] = startIso.split('-').map(Number);
  const endYM = yearMonth(endIso);
  let y = sy;
  let m = sm;
  while (true) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    months.add(ym);
    if (ym >= endYM) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * Checks whether cumulative full-time CPT has reached 12 months (365 days),
 * which permanently eliminates OPT eligibility.
 *
 * Counts distinct calendar months touched by full-time CPT periods, then
 * converts to days for comparison (consistent with the calendar-month
 * approach used in existing CPT-tracker and standard DSO practice).
 */
export function checkCptFullTimeOptBar(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  const fullTimeCptPeriods = context.employmentPeriods.filter(
    ep => ep.authType === 'CPT' && ep.cptType === 'full-time',
  );

  if (fullTimeCptPeriods.length === 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: { fullTimeCptPeriodCount: 0 },
      outputs: { fullTimeCptMonths: 0, fullTimeCptDays: 0, optBarReached: false },
      message: 'No full-time CPT periods on record. OPT eligibility not affected.',
    };
  }

  // Count union of calendar months across all full-time CPT periods
  const allMonths = new Set<string>();
  for (const ep of fullTimeCptPeriods) {
    const end = ep.endDate ?? todayIso;
    for (const m of monthsInRange(ep.startDate, end)) {
      allMonths.add(m);
    }
  }

  const totalMonths = allMonths.size;
  const optBarReached = totalMonths >= CAP_MONTHS;

  let status: RuleResult['status'];
  if (optBarReached) {
    status = 'violation';
  } else if (totalMonths >= WARNING_AT_MONTHS) {
    status = 'warning';
  } else {
    status = 'pass';
  }

  const monthsRemaining = Math.max(0, CAP_MONTHS - totalMonths);

  const message =
    status === 'violation'
      ? `${totalMonths} month(s) of full-time CPT accumulated — OPT eligibility permanently lost. Consult DSO immediately.`
      : status === 'warning'
      ? `${totalMonths} month(s) of full-time CPT accumulated — within ${monthsRemaining} month(s) of the 12-month bar.`
      : `${totalMonths} month(s) of full-time CPT accumulated. OPT eligibility intact (bar: 12 months).`;

  return {
    rule: RULE,
    studentId: student.id,
    status,
    computedAt: todayIso,
    inputs: {
      fullTimeCptPeriodCount: fullTimeCptPeriods.length,
      periods: fullTimeCptPeriods.map(ep => ({
        start: ep.startDate,
        end: ep.endDate ?? todayIso,
      })),
    },
    outputs: {
      fullTimeCptMonths: totalMonths,
      optBarReached,
      monthsRemainingBeforeBar: monthsRemaining,
    },
    message,
  };
}
