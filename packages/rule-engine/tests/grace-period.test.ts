import { describe, it, expect } from 'vitest';
import { checkGracePeriod60Day } from '../src/rules/grace-period-60-day';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'Computer Science',
  isStemDesignated: false,
  programStartDate: '2022-08-15',
  programEndDate: '2024-05-10',
  admissionType: 'D/S',
  i94AdmissionDate: '2022-08-10',
  i94ExpiryDate: null,
};

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    employmentPeriods: [],
    authorizations: [],
    stemI983Submissions: [],
    ...overrides,
  };
}

describe('checkGracePeriod60Day — no OPT/STEM authorization', () => {
  it('returns pass before program end date', () => {
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-05-01');
    expect(result.status).toBe('pass');
    expect(result.message).toContain('program end date');
  });

  it('returns pass on program end date itself', () => {
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-05-10');
    expect(result.status).toBe('pass');
  });

  it('returns warning on day 1 of grace period', () => {
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-05-11');
    expect(result.status).toBe('warning');
    expect(result.outputs['daysRemainingInGracePeriod']).toBe(59);
  });

  it('returns warning on the last day of the grace period (day 60)', () => {
    // Grace period ends May 10 + 60 = July 9, 2024
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-07-09');
    expect(result.status).toBe('warning');
    expect(result.outputs['daysRemainingInGracePeriod']).toBe(0);
  });

  it('returns violation on the day after grace period ends', () => {
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-07-10');
    expect(result.status).toBe('violation');
    expect(result.outputs['daysOverdue']).toBe(1);
  });

  it('returns violation many days after grace period', () => {
    const result = checkGracePeriod60Day(STUDENT, ctx(), '2024-10-01');
    expect(result.status).toBe('violation');
    expect(typeof result.outputs['daysOverdue']).toBe('number');
    expect((result.outputs['daysOverdue'] as number)).toBeGreaterThan(50);
  });
});

describe('checkGracePeriod60Day — with OPT authorization', () => {
  const OPT = {
    id: 'auth-1',
    authType: 'OPT' as const,
    startDate: '2024-05-10',
    endDate: '2025-05-09',
  };

  it('returns pass before OPT EAD expiry', () => {
    const result = checkGracePeriod60Day(
      STUDENT,
      ctx({ authorizations: [OPT] }),
      '2025-04-01',
    );
    expect(result.status).toBe('pass');
    expect(result.message).toContain('OPT EAD expiry');
  });

  it('returns warning on day 1 after OPT expiry', () => {
    const result = checkGracePeriod60Day(
      STUDENT,
      ctx({ authorizations: [OPT] }),
      '2025-05-10',
    );
    expect(result.status).toBe('warning');
  });

  it('returns violation after OPT grace period ends', () => {
    // OPT ends May 9, 2025; grace ends July 8, 2025
    const result = checkGracePeriod60Day(
      STUDENT,
      ctx({ authorizations: [OPT] }),
      '2025-07-09',
    );
    expect(result.status).toBe('violation');
  });
});

describe('checkGracePeriod60Day — STEM-OPT takes priority over OPT', () => {
  const OPT = {
    id: 'auth-1',
    authType: 'OPT' as const,
    startDate: '2024-05-10',
    endDate: '2025-05-09',
  };
  const STEM = {
    id: 'auth-2',
    authType: 'STEM-OPT' as const,
    startDate: '2025-05-10',
    endDate: '2027-05-09',
  };

  it('bases grace period on STEM-OPT expiry, not OPT expiry', () => {
    const result = checkGracePeriod60Day(
      { ...STUDENT, isStemDesignated: true },
      ctx({ authorizations: [OPT, STEM] }),
      '2025-06-01',
    );
    // Should still be pass — STEM ends May 9 2027, well in the future
    expect(result.status).toBe('pass');
    expect(result.message).toContain('STEM-OPT EAD expiry');
  });
});
