// Pure date utilities. All functions operate on ISO 8601 "YYYY-MM-DD" strings
// interpreted as UTC midnight. No Date.now() or new Date() calls — callers
// pass todayIso explicitly so functions remain deterministic and testable.

/** Parses "YYYY-MM-DD" as UTC midnight. */
export function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Milliseconds per calendar day. */
export const MS_PER_DAY = 86_400_000;

/**
 * Signed difference in whole days: positive when toIso is after fromIso.
 * Uses rounding to absorb DST artifacts that do not apply to UTC, but
 * keeps the implementation consistent with the existing codebase.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (toUtcDate(toIso).getTime() - toUtcDate(fromIso).getTime()) / MS_PER_DAY,
  );
}

/** Returns iso + n calendar days as "YYYY-MM-DD". */
export function addDays(iso: string, n: number): string {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a Set of UTC-midnight millisecond timestamps for every calendar day
 * in [startIso, endIso] inclusive, clamped to [clampStart, clampEnd].
 * Used for O(1) "is day employed?" lookups.
 */
export function buildDaySet(
  startIso: string,
  endIso: string,
  clampStart: string,
  clampEnd: string,
): Set<number> {
  const s = startIso < clampStart ? clampStart : startIso;
  const e = endIso > clampEnd ? clampEnd : endIso;
  const days = new Set<number>();
  if (s > e) return days;
  let t = toUtcDate(s).getTime();
  const tEnd = toUtcDate(e).getTime();
  while (t <= tEnd) {
    days.add(t);
    t += MS_PER_DAY;
  }
  return days;
}

/**
 * Counts calendar days in [windowStart, windowEnd] inclusive NOT covered by
 * any of the supplied intervals. Each interval is { start, end } in ISO 8601;
 * an absent end defaults to windowEnd.
 */
export function unemployedDaysInWindow(
  windowStart: string,
  windowEnd: string,
  intervals: ReadonlyArray<{ start: string; end: string | null }>,
): number {
  if (windowStart > windowEnd) return 0;

  // Build union of employed-day timestamps
  const employedMs = new Set<number>();
  for (const iv of intervals) {
    const ivEnd = iv.end ?? windowEnd;
    for (const ms of buildDaySet(iv.start, ivEnd, windowStart, windowEnd)) {
      employedMs.add(ms);
    }
  }

  const totalDays = daysBetween(windowStart, windowEnd) + 1;
  return Math.max(0, totalDays - employedMs.size);
}
