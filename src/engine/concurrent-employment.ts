import type { Role, Conflict } from './types';

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
 * Returns today's ISO date string (YYYY-MM-DD) in UTC.
 */
function todayIso(): string {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Detects overlapping CPT/OPT authorization periods across multiple concurrent roles.
 * Two roles conflict when their date ranges overlap AND the combination is not
 * permitted (two simultaneous OPT or STEM-OPT authorizations are never permitted;
 * CPT + OPT overlap is flagged as a conflict requiring DSO review).
 *
 * @param roles - All active and historical roles
 * @param conflictRuleId - The RuleEntry.id to cite in every Conflict (e.g. "cpt-per-employer-scoping")
 */
export function checkConcurrentEmploymentConflicts(
  roles: Role[],
  conflictRuleId: string,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const today = todayIso();

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const a = roles[i];
      const b = roles[j];

      // Determine if this pair can conflict:
      // - Two OPT simultaneous: never permitted
      // - Two STEM-OPT simultaneous: never permitted
      // - OPT + STEM-OPT simultaneous: never permitted
      // - CPT + OPT/STEM-OPT overlap: flagged for DSO review
      // - Two CPT simultaneously: not flagged (CPT is per-employer scoped and can co-occur)
      const aType = a.authorizationType;
      const bType = b.authorizationType;

      const isConflictType =
        (aType !== 'CPT' && bType !== 'CPT') ||  // both OPT/STEM-OPT
        (aType === 'CPT' && bType !== 'CPT') ||   // CPT + OPT/STEM-OPT
        (aType !== 'CPT' && bType === 'CPT');     // OPT/STEM-OPT + CPT

      if (!isConflictType) continue;

      // Compute overlap
      const aStart = a.period.start;
      const aEnd = a.period.end ?? today;
      const bStart = b.period.start;
      const bEnd = b.period.end ?? today;

      // Overlap exists when: max(aStart, bStart) <= min(aEnd, bEnd)
      const overlapStart = aStart > bStart ? aStart : bStart;
      const overlapEnd = aEnd < bEnd ? aEnd : bEnd;

      if (overlapStart > overlapEnd) continue; // no overlap

      const description =
        `Authorization types ${aType} (role ${a.id}) and ${bType} (role ${b.id}) ` +
        `overlap from ${overlapStart} to ${overlapEnd}. ` +
        `Concurrent ${aType} + ${bType} authorization requires DSO review.`;

      conflicts.push({
        roleIds: [a.id, b.id],
        overlapStart,
        overlapEnd,
        ruleId: conflictRuleId,
        description,
      });
    }
  }

  return conflicts;
}
