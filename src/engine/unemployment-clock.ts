import type { DateRange } from './types';

export interface UnemploymentResult {
  usedDays: number;
  remainingDays: number;
  status: 'ok' | 'warning' | 'exceeded';
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
 * Counts the number of inclusive calendar days between two UTC midnight Dates.
 */
function daysBetweenInclusive(start: Date, end: Date): number {
  const msPerDay = 86400000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * Counts unemployment days within an OPT authorization window.
 * An unemployment day is any calendar day in the optWindow not covered by
 * at least one employment period.
 *
 * @param employmentPeriods - Periods of qualifying employment (may overlap)
 * @param optWindow - The full OPT authorization window
 * @param unemploymentCapDays - Threshold from the loaded RuleFile (e.g. 90 or 150)
 * @param appliedRuleId - The RuleEntry.id being applied (e.g. "standard-opt-unemployment-cap")
 * @param disclaimer - The RuleFile.disclaimer text to pass through
 */
export function computeUnemploymentDays(
  employmentPeriods: DateRange[],
  optWindow: DateRange,
  unemploymentCapDays: number,
  appliedRuleId: string,
  disclaimer: string,
): UnemploymentResult {
  const msPerDay = 86400000;

  const windowStart = toUtcDate(optWindow.start);
  // If optWindow.end is absent, use today's date
  const windowEnd = optWindow.end ? toUtcDate(optWindow.end) : (() => {
    const today = new Date();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  })();

  const totalWindowDays = daysBetweenInclusive(windowStart, windowEnd);

  // Build a Set of employed day timestamps (UTC midnight ms) for fast lookup
  const employedDays = new Set<number>();

  for (const period of employmentPeriods) {
    const empStart = toUtcDate(period.start);
    const empEnd = period.end ? toUtcDate(period.end) : windowEnd;

    // Clamp to optWindow
    const clampedStart = empStart < windowStart ? windowStart : empStart;
    const clampedEnd = empEnd > windowEnd ? windowEnd : empEnd;

    if (clampedStart > clampedEnd) continue;

    // Mark every day in [clampedStart, clampedEnd] as employed
    let current = clampedStart.getTime();
    const endTime = clampedEnd.getTime();
    while (current <= endTime) {
      employedDays.add(current);
      current += msPerDay;
    }
  }

  const usedDays = totalWindowDays - employedDays.size;
  const remainingDays = unemploymentCapDays - usedDays;
  const warningThreshold = Math.floor(unemploymentCapDays * 0.75);

  let status: 'ok' | 'warning' | 'exceeded';
  if (usedDays >= unemploymentCapDays) {
    status = 'exceeded';
  } else if (usedDays >= warningThreshold) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    usedDays,
    remainingDays,
    status,
    appliedRuleId,
    disclaimer,
  };
}
