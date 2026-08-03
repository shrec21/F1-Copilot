import { describe, it, expect } from 'vitest';
import { computeUnemploymentDays } from '../src/engine/unemployment-clock';
import { checkCptEligibilityImpact } from '../src/engine/cpt-tracker';
import { checkConcurrentEmploymentConflicts } from '../src/engine/concurrent-employment';

const RULE_ID = 'standard-opt-unemployment-cap';
const DISCLAIMER = 'Not legal advice. Consult a DSO.';
const CAP = 90;

// ─── 1. Leap year boundary: Feb 28 → Mar 1 (2024) ──────────────────────────

describe('leap year boundary (2024)', () => {
  it('counts Feb 29 — window Feb 27–Mar 2, employed Feb 28–29 → 3 unemployed days', () => {
    // Window: Feb 27, Feb 28, Feb 29, Mar 1, Mar 2 = 5 days
    // Employed: Feb 28, Feb 29 = 2 days
    // Unemployed: Feb 27, Mar 1, Mar 2 = 3 days
    const result = computeUnemploymentDays(
      [{ start: '2024-02-28', end: '2024-02-29' }],
      { start: '2024-02-27', end: '2024-03-02' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(3);
  });
});

// ─── 2. Non-leap year: Feb 28 → Mar 1 (2023) ──────────────────────────────

describe('non-leap year (2023)', () => {
  it('does NOT count Feb 29 — window Feb 27–Mar 2, employed Feb 28 only → 3 unemployed days', () => {
    // Window: Feb 27, Feb 28, Mar 1, Mar 2 = 4 days
    // Employed: Feb 28 = 1 day
    // Unemployed: Feb 27, Mar 1, Mar 2 = 3 days
    const result = computeUnemploymentDays(
      [{ start: '2023-02-28', end: '2023-02-28' }],
      { start: '2023-02-27', end: '2023-03-02' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(3);
  });
});

// ─── 3. Inclusive day counting — single-day window, no employment ──────────

describe('inclusive day counting', () => {
  it('single-day OPT window with no employment → 1 unemployed day (not 0)', () => {
    const result = computeUnemploymentDays(
      [],
      { start: '2024-06-15', end: '2024-06-15' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(1);
  });

  // ─── 4. Single-day window with matching single-day employment ─────────────
  it('single-day OPT window with matching employment → 0 unemployed days', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-06-15', end: '2024-06-15' }],
      { start: '2024-06-15', end: '2024-06-15' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
  });
});

// ─── 5. Adjacent employment periods with no gap ───────────────────────────

describe('adjacent employment periods', () => {
  it('two periods meeting exactly (A ends Jan 5, B starts Jan 6) → 0 unemployed days', () => {
    // Window: Jan 1–10 = 10 days
    // A: Jan 1–5 (5 days), B: Jan 6–10 (5 days) — no gap
    const result = computeUnemploymentDays(
      [
        { start: '2024-01-01', end: '2024-01-05' },
        { start: '2024-01-06', end: '2024-01-10' },
      ],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
  });
});

// ─── 6. One-day gap at year boundary ──────────────────────────────────────

describe('year-boundary gap', () => {
  it('gap of Jan 1 (New Year\'s Day) between two employment periods → 1 unemployed day', () => {
    // Window: Dec 30–Jan 2 = 4 days
    // A: Dec 30–31 (2 days), B: Jan 2 (1 day)
    // Gap: Jan 1 = 1 day
    const result = computeUnemploymentDays(
      [
        { start: '2023-12-30', end: '2023-12-31' },
        { start: '2024-01-02', end: '2024-01-02' },
      ],
      { start: '2023-12-30', end: '2024-01-02' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(1);
  });
});

// ─── 7. Open-ended (currently employed) period ────────────────────────────

describe('open-ended employment', () => {
  it('no end date — employment started Jan 1 with 31-day window → 0 unemployed days', () => {
    // Window: Jan 1–31 = 31 days
    // Employment: start Jan 1, no end → treated as covering through window end
    const result = computeUnemploymentDays(
      [{ start: '2024-01-01' }],
      { start: '2024-01-01', end: '2024-01-31' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
  });
});

// ─── 8. Overlapping employment periods — union not sum ────────────────────

describe('overlapping employment periods', () => {
  it('two periods that overlap (A: Jan 1–7, B: Jan 4–10) → 0 unemployed days, not double-counted', () => {
    // Window: Jan 1–10 = 10 days
    // Union covers all 10 days (A covers 1–7, B extends to 10)
    const result = computeUnemploymentDays(
      [
        { start: '2024-01-01', end: '2024-01-07' },
        { start: '2024-01-04', end: '2024-01-10' },
      ],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
  });
});

// ─── 9. Exactly-at-threshold: 89 vs 90 vs 91 days ─────────────────────────

describe('unemployment threshold boundary (cap = 90)', () => {
  it('89 unemployed days → status "warning" (≥ floor(90*0.75)=67, < 90)', () => {
    // Window: Jan 1 – Mar 30, 2025 = 89 days, no employment
    const result = computeUnemploymentDays(
      [],
      { start: '2025-01-01', end: '2025-03-30' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(89);
    expect(result.status).toBe('warning');
  });

  it('90 unemployed days → status "exceeded"', () => {
    // Window: Jan 1 – Mar 31, 2025 = 90 days, no employment
    const result = computeUnemploymentDays(
      [],
      { start: '2025-01-01', end: '2025-03-31' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(90);
    expect(result.status).toBe('exceeded');
  });

  it('91 unemployed days → status "exceeded", usedDays = 91', () => {
    // Window: Jan 1 – Apr 1, 2025 = 91 days, no employment
    const result = computeUnemploymentDays(
      [],
      { start: '2025-01-01', end: '2025-04-01' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(91);
    expect(result.status).toBe('exceeded');
  });
});

// ─── 10. CPT full-time month counting spanning multiple months ─────────────

describe('CPT full-time month counting', () => {
  const CPT_RULE_ID = 'cpt-opt-eligibility-impact';
  const CPT_CAP = 12;

  it('full-time CPT Jan 15 – Apr 15 (2024): 92 actual days → 3.1 months, cap 12 → not at risk', () => {
    // 2024 is a leap year: Jan(17)+Feb(29)+Mar(31)+Apr(15) = 92 days → 3.1 months
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        period: { start: '2024-01-15', end: '2024-04-15' },
        cptType: 'full-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CPT_CAP, CPT_RULE_ID, DISCLAIMER);
    expect(result.totalFullTimeDays).toBe(92);
    expect(result.totalFullTimeMonths).toBe(3.1);
    expect(result.optEligibilityAtRisk).toBe(false);
  });

  // ─── 11. CPT part-time excluded from full-time count ──────────────────────
  it('full-time CPT Jan–Nov 2024 (335 days) + part-time CPT Dec 2024 → 11.2 months, not at risk', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-11-30' },
        cptType: 'full-time' as const,
      },
      {
        id: 'r2',
        authorizationType: 'CPT' as const,
        employer: 'Beta LLC',
        hoursPerWeek: 20,
        period: { start: '2024-12-01', end: '2024-12-31' },
        cptType: 'part-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CPT_CAP, CPT_RULE_ID, DISCLAIMER);
    // 2024 leap year: Jan(31)+Feb(29)+Mar(31)+Apr(30)+May(31)+Jun(30)+Jul(31)+Aug(31)+Sep(30)+Oct(31)+Nov(30) = 335 days → 11.2 months
    expect(result.totalFullTimeDays).toBe(335);
    expect(result.totalFullTimeMonths).toBe(11.2);
    expect(result.optEligibilityAtRisk).toBe(false);
  });
});

// ─── 12. Conflict detection — roles sharing only a single day ─────────────

describe('concurrent employment conflict detection', () => {
  const CONFLICT_RULE_ID = 'cpt-per-employer-scoping';

  it('two OPT roles sharing only Jun 15 → 1 conflict with overlapStart = overlapEnd = "2024-06-15"', () => {
    // Role A OPT: Jun 1–15, Role B OPT: Jun 15–30
    // They share only Jun 15
    const roles = [
      {
        id: 'role-a',
        authorizationType: 'OPT' as const,
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        period: { start: '2024-06-01', end: '2024-06-15' },
      },
      {
        id: 'role-b',
        authorizationType: 'OPT' as const,
        employer: 'Beta LLC',
        hoursPerWeek: 40,
        period: { start: '2024-06-15', end: '2024-06-30' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, CONFLICT_RULE_ID);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapStart).toBe('2024-06-15');
    expect(conflicts[0].overlapEnd).toBe('2024-06-15');
    expect(conflicts[0].roleIds).toEqual(['role-a', 'role-b']);
  });

  // ─── 13. Conflict detection — end of one = start of other (no overlap) ────
  it('Role A ends Jun 14, Role B starts Jun 15 → 0 conflicts (no shared day)', () => {
    // The end date of A is strictly before the start of B — no overlap
    const roles = [
      {
        id: 'role-a',
        authorizationType: 'OPT' as const,
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        period: { start: '2024-06-01', end: '2024-06-14' },
      },
      {
        id: 'role-b',
        authorizationType: 'OPT' as const,
        employer: 'Beta LLC',
        hoursPerWeek: 40,
        period: { start: '2024-06-15', end: '2024-06-30' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, CONFLICT_RULE_ID);
    expect(conflicts).toHaveLength(0);
  });
});
