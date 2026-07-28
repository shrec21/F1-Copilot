import { describe, it, expect } from 'vitest';
import { computeUnemploymentDays } from '../src/engine/unemployment-clock';
import { checkCptEligibilityImpact } from '../src/engine/cpt-tracker';
import { checkConcurrentEmploymentConflicts } from '../src/engine/concurrent-employment';
import { checkDsTransitionStatus } from '../src/engine/ds-transition';

// ─── computeUnemploymentDays ─────────────────────────────────────────────────

describe('computeUnemploymentDays', () => {
  const RULE_ID = 'standard-opt-unemployment-cap';
  const DISCLAIMER = 'Not legal advice.';
  const CAP = 90;

  it('basic: 10-day OPT window, 7 days employed → 3 unemployed days', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-01-01', end: '2024-01-07' }],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(3);
    expect(result.remainingDays).toBe(CAP - 3);
    expect(result.status).toBe('ok');
    expect(result.appliedRuleId).toBe(RULE_ID);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it('zero unemployment: fully employed throughout OPT window', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-01-01', end: '2024-01-10' }],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
    expect(result.status).toBe('ok');
  });

  it('employment outside window is ignored (clamp to optWindow)', () => {
    const result = computeUnemploymentDays(
      [{ start: '2023-12-25', end: '2024-01-15' }],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(0);
  });

  it('employment spanning a leap day (Feb 28 - Mar 1 in 2024 leap year)', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-02-27', end: '2024-03-03' }],
      { start: '2024-02-25', end: '2024-03-05' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(4);
  });

  it('open-ended employment (no end date) counts up to optWindow end', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-01-05' }],
      { start: '2024-01-01', end: '2024-01-10' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(4);
  });

  it('exactly at threshold: usedDays === cap → status "exceeded"', () => {
    const result = computeUnemploymentDays(
      [],
      { start: '2024-01-01', end: '2024-03-30' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(90);
    expect(result.status).toBe('exceeded');
  });

  it('one below threshold: cap - 1 → status "warning"', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-03-30', end: '2024-03-30' }],
      { start: '2024-01-01', end: '2024-03-30' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(89);
    expect(result.status).toBe('warning');
  });

  it('warning threshold: usedDays === floor(cap * 0.75) → status "warning"', () => {
    const result = computeUnemploymentDays(
      [{ start: '2024-01-01', end: '2024-01-23' }],
      { start: '2024-01-01', end: '2024-03-30' },
      CAP,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.usedDays).toBe(67);
    expect(result.status).toBe('warning');
  });
});

// ─── checkCptEligibilityImpact ───────────────────────────────────────────────

describe('checkCptEligibilityImpact', () => {
  const RULE_ID = 'cpt-opt-eligibility-impact';
  const DISCLAIMER = 'Not legal advice.';
  const CAP = 12;

  it('11 full-time CPT months, cap 12 → optEligibilityAtRisk false', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2023-01-01', end: '2023-11-30' },
        cptType: 'full-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CAP, RULE_ID, DISCLAIMER);
    expect(result.totalFullTimeMonths).toBe(11);
    expect(result.optEligibilityAtRisk).toBe(false);
  });

  it('12 full-time CPT months, cap 12 → optEligibilityAtRisk true', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2023-01-01', end: '2023-12-31' },
        cptType: 'full-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CAP, RULE_ID, DISCLAIMER);
    expect(result.totalFullTimeMonths).toBe(12);
    expect(result.optEligibilityAtRisk).toBe(true);
  });

  it('part-time CPT roles are excluded from count', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme',
        hoursPerWeek: 20,
        period: { start: '2023-01-01', end: '2023-12-31' },
        cptType: 'part-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CAP, RULE_ID, DISCLAIMER);
    expect(result.totalFullTimeMonths).toBe(0);
    expect(result.optEligibilityAtRisk).toBe(false);
  });

  it('overlapping full-time CPT roles count the union of months, not the sum', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2023-01-01', end: '2023-06-30' },
        cptType: 'full-time' as const,
      },
      {
        id: 'r2',
        authorizationType: 'CPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2023-01-15', end: '2023-06-15' },
        cptType: 'full-time' as const,
      },
    ];
    const result = checkCptEligibilityImpact(roles, CAP, RULE_ID, DISCLAIMER);
    expect(result.totalFullTimeMonths).toBe(6);
    expect(result.optEligibilityAtRisk).toBe(false);
  });
});

// ─── checkConcurrentEmploymentConflicts ──────────────────────────────────────

describe('checkConcurrentEmploymentConflicts', () => {
  const RULE_ID = 'cpt-per-employer-scoping';

  it('no overlap → empty array', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'OPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-06-30' },
      },
      {
        id: 'r2',
        authorizationType: 'OPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2024-07-01', end: '2024-12-31' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, RULE_ID);
    expect(conflicts).toHaveLength(0);
  });

  it('two OPT roles with overlapping dates → one Conflict', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'OPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-06-30' },
      },
      {
        id: 'r2',
        authorizationType: 'OPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2024-04-01', end: '2024-09-30' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, RULE_ID);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].roleIds).toEqual(['r1', 'r2']);
    expect(conflicts[0].overlapStart).toBe('2024-04-01');
    expect(conflicts[0].overlapEnd).toBe('2024-06-30');
    expect(conflicts[0].ruleId).toBe(RULE_ID);
  });

  it('CPT + OPT overlap → one Conflict', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'CPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-06-30' },
        cptType: 'full-time' as const,
      },
      {
        id: 'r2',
        authorizationType: 'OPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2024-04-01', end: '2024-09-30' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, RULE_ID);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].roleIds).toEqual(['r1', 'r2']);
  });

  it('open-ended role overlapping another → detected as conflict', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'OPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-12-31' },
      },
      {
        id: 'r2',
        authorizationType: 'STEM-OPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2024-06-01' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, RULE_ID);
    expect(conflicts).toHaveLength(1);
  });

  it('non-overlapping roles (one ends day before other starts) → no conflict', () => {
    const roles = [
      {
        id: 'r1',
        authorizationType: 'OPT' as const,
        employer: 'Acme',
        hoursPerWeek: 40,
        period: { start: '2024-01-01', end: '2024-06-30' },
      },
      {
        id: 'r2',
        authorizationType: 'OPT' as const,
        employer: 'Beta',
        hoursPerWeek: 40,
        period: { start: '2024-07-01', end: '2024-12-31' },
      },
    ];
    const conflicts = checkConcurrentEmploymentConflicts(roles, RULE_ID);
    expect(conflicts).toHaveLength(0);
  });
});

// ─── checkDsTransitionStatus ─────────────────────────────────────────────────

describe('checkDsTransitionStatus', () => {
  const RULE_ID = 'fixed-period-admission-effective-date';
  const DISCLAIMER = 'Not legal advice.';
  const EFFECTIVE_DATE = '2026-09-15';
  const PENDING_DS_DEADLINE = '2027-03-18';
  const GRACE_DAYS = 60;

  it('admission before effective date + isCurrentlyDs → regime D/S, transitionDeadline set', () => {
    const result = checkDsTransitionStatus(
      '2026-05-01',
      '2026-12-15',
      true,
      EFFECTIVE_DATE,
      PENDING_DS_DEADLINE,
      GRACE_DAYS,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.regime).toBe('D/S');
    expect(result.transitionDeadline).toBe(PENDING_DS_DEADLINE);
    expect(result.appliedRuleId).toBe(RULE_ID);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it('admission on or after effective date → regime fixed-date, transitionDeadline null', () => {
    const result = checkDsTransitionStatus(
      '2026-09-15',
      '2027-05-15',
      true,
      EFFECTIVE_DATE,
      PENDING_DS_DEADLINE,
      GRACE_DAYS,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.regime).toBe('fixed-date');
    expect(result.transitionDeadline).toBeNull();
  });

  it('admission after effective date → regime fixed-date', () => {
    const result = checkDsTransitionStatus(
      '2026-10-01',
      '2027-05-15',
      false,
      EFFECTIVE_DATE,
      PENDING_DS_DEADLINE,
      GRACE_DAYS,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.regime).toBe('fixed-date');
    expect(result.transitionDeadline).toBeNull();
  });

  it('graceperiodEndDate = programEndDate + gracePeriodDays (verify arithmetic)', () => {
    const result = checkDsTransitionStatus(
      '2026-05-01',
      '2026-12-15',
      true,
      EFFECTIVE_DATE,
      PENDING_DS_DEADLINE,
      GRACE_DAYS,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.graceperiodEndDate).toBe('2027-02-13');
  });

  it('graceperiodEndDate spans a leap year (Feb 28 2028 + 2 days = Mar 1 2028)', () => {
    const result = checkDsTransitionStatus(
      '2026-05-01',
      '2028-02-28',
      true,
      EFFECTIVE_DATE,
      PENDING_DS_DEADLINE,
      2,
      RULE_ID,
      DISCLAIMER,
    );
    expect(result.graceperiodEndDate).toBe('2028-03-01');
  });
});
