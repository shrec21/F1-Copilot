import { describe, it, expect } from 'vitest';
import { checkOptUnemployment90 } from '../src/rules/opt-unemployment-90';
import { checkOptUnemployment150Stem } from '../src/rules/opt-unemployment-150-stem';
import type { Student, RuleContext } from '../src/types';

const BASE_STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'Computer Science',
  isStemDesignated: true,
  programStartDate: '2022-08-15',
  programEndDate: '2024-05-10',
  admissionType: 'D/S',
  i94AdmissionDate: '2022-08-10',
  i94ExpiryDate: null,
};

const OPT_AUTH = {
  id: 'auth-1',
  authType: 'OPT' as const,
  startDate: '2024-05-10',
  endDate: '2025-05-09',
};

const STEM_AUTH = {
  id: 'auth-2',
  authType: 'STEM-OPT' as const,
  startDate: '2025-05-10',
  endDate: '2027-05-09',
};

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    employmentPeriods: [],
    authorizations: [OPT_AUTH],
    stemI983Submissions: [],
    ...overrides,
  };
}

// --- checkOptUnemployment90 ---

describe('checkOptUnemployment90', () => {
  it('returns not-applicable when no OPT authorization exists', () => {
    const ctx = makeContext({ authorizations: [] });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2024-06-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns pass with 0 unemployment days when student was employed the entire OPT window', () => {
    const ctx = makeContext({
      employmentPeriods: [{
        id: 'ep-1',
        authType: 'OPT',
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        startDate: '2024-05-10',
        endDate: '2025-05-09',
      }],
    });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2025-05-09');
    expect(result.status).toBe('pass');
    expect(result.outputs['unemploymentDaysUsed']).toBe(0);
    expect(result.outputs['daysRemainingBeforeCap']).toBe(90);
  });

  it('counts unemployment days correctly for a 30-day gap', () => {
    // Student starts OPT May 10, 2024, but first job begins June 9, 2024 (30-day gap)
    const ctx = makeContext({
      employmentPeriods: [{
        id: 'ep-1',
        authType: 'OPT',
        employer: 'Acme Corp',
        hoursPerWeek: 40,
        startDate: '2024-06-09',
        endDate: '2025-05-09',
      }],
    });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2025-05-09');
    expect(result.status).toBe('pass');
    // May 10 to Jun 8 = 30 days (inclusive)
    expect(result.outputs['unemploymentDaysUsed']).toBe(30);
  });

  it('returns warning when unemployment days exceed 60 but not 90', () => {
    // 75-day gap at start of OPT
    const ctx = makeContext({
      employmentPeriods: [{
        id: 'ep-1',
        authType: 'OPT',
        employer: 'Acme',
        hoursPerWeek: 40,
        startDate: '2024-07-24', // 75 days after May 10
        endDate: '2025-05-09',
      }],
    });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2025-05-09');
    expect(result.status).toBe('warning');
    expect(result.outputs['unemploymentDaysUsed']).toBe(75);
  });

  it('returns violation when unemployment exceeds 90 days', () => {
    // Student has a 100-day gap
    const ctx = makeContext({
      employmentPeriods: [{
        id: 'ep-1',
        authType: 'OPT',
        employer: 'Acme',
        hoursPerWeek: 40,
        startDate: '2024-08-18', // 100 days after May 10
        endDate: '2025-05-09',
      }],
    });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2025-05-09');
    expect(result.status).toBe('violation');
    expect(result.outputs['unemploymentDaysUsed']).toBeGreaterThan(90);
  });

  it('evaluates only through today when OPT window is not yet expired', () => {
    // Today is 10 days into OPT, no employment yet
    const ctx = makeContext({ employmentPeriods: [] });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2024-05-20');
    // 11 days (May 10 through May 20 inclusive) of unemployment
    expect(result.outputs['unemploymentDaysUsed']).toBe(11);
    expect(result.status).toBe('pass');
  });

  it('handles overlapping employment periods without double-counting employed days', () => {
    const ctx = makeContext({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme',
          hoursPerWeek: 20,
          startDate: '2024-05-10',
          endDate: '2024-08-31',
        },
        {
          id: 'ep-2',
          authType: 'OPT',
          employer: 'Beta Inc',
          hoursPerWeek: 20,
          startDate: '2024-06-01',
          endDate: '2025-05-09',
        },
      ],
    });
    const result = checkOptUnemployment90(BASE_STUDENT, ctx, '2025-05-09');
    // Covered: May 10 - May 9 (full year) with overlapping periods — 0 unemployment days
    expect(result.outputs['unemploymentDaysUsed']).toBe(0);
    expect(result.status).toBe('pass');
  });

  it('correctly handles a leap year within the OPT period', () => {
    // OPT period covering Feb 28 - Mar 1 of a leap year (2024)
    const student: Student = {
      ...BASE_STUDENT,
      programEndDate: '2024-02-20',
    };
    const auth = {
      id: 'auth-leap',
      authType: 'OPT' as const,
      startDate: '2024-02-20',
      endDate: '2025-02-19',
    };
    const ctx: RuleContext = {
      employmentPeriods: [],
      authorizations: [auth],
      stemI983Submissions: [],
    };
    // Evaluate just the leap day range — Feb 28 to Mar 1 = 3 days (2/28, 2/29, 3/1)
    const result = checkOptUnemployment90(student, ctx, '2024-03-01');
    expect(result.outputs['unemploymentDaysUsed']).toBe(11); // Feb 20 to Mar 1 = 11 days
    expect(result.status).toBe('pass');
  });
});

// --- checkOptUnemployment150Stem ---

describe('checkOptUnemployment150Stem', () => {
  it('returns not-applicable when student is not STEM-designated', () => {
    const student = { ...BASE_STUDENT, isStemDesignated: false };
    const ctx = makeContext({ authorizations: [OPT_AUTH, STEM_AUTH] });
    const result = checkOptUnemployment150Stem(student, ctx, '2026-01-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns not-applicable when no STEM-OPT authorization exists', () => {
    const ctx = makeContext({ authorizations: [OPT_AUTH] });
    const result = checkOptUnemployment150Stem(BASE_STUDENT, ctx, '2025-06-01');
    expect(result.status).toBe('not-applicable');
  });

  it('counts cumulative unemployment across OPT and STEM-OPT windows', () => {
    // 30-day gap in OPT, 30-day gap in STEM-OPT = 60 total
    const ctx: RuleContext = {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme',
          hoursPerWeek: 40,
          startDate: '2024-06-09', // 30-day gap from OPT start
          endDate: '2025-05-09',
        },
        {
          id: 'ep-2',
          authType: 'STEM-OPT',
          employer: 'Beta',
          hoursPerWeek: 40,
          startDate: '2025-06-09', // 30-day gap from STEM start
          endDate: '2027-05-09',
        },
      ],
    };
    const result = checkOptUnemployment150Stem(BASE_STUDENT, ctx, '2027-05-09');
    expect(result.outputs['unemploymentDaysInOpt']).toBe(30);
    expect(result.outputs['unemploymentDaysInStem']).toBe(30);
    expect(result.outputs['totalUnemploymentDays']).toBe(60);
    expect(result.status).toBe('pass');
  });

  it('returns violation when cumulative days exceed 150', () => {
    // 80 days in OPT + 80 days in STEM-OPT = 160 total
    const ctx: RuleContext = {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme',
          hoursPerWeek: 40,
          startDate: '2024-07-29', // 80 days after OPT start
          endDate: '2025-05-09',
        },
        {
          id: 'ep-2',
          authType: 'STEM-OPT',
          employer: 'Beta',
          hoursPerWeek: 40,
          startDate: '2025-07-29', // 80 days after STEM start
          endDate: '2027-05-09',
        },
      ],
    };
    const result = checkOptUnemployment150Stem(BASE_STUDENT, ctx, '2027-05-09');
    expect(result.outputs['totalUnemploymentDays']).toBeGreaterThan(150);
    expect(result.status).toBe('violation');
  });

  it('returns warning when total days exceed 120 (within 30 of cap)', () => {
    // 65 days in OPT + 65 days in STEM-OPT = 130 total
    const ctx: RuleContext = {
      authorizations: [OPT_AUTH, STEM_AUTH],
      stemI983Submissions: [],
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'OPT',
          employer: 'Acme',
          hoursPerWeek: 40,
          startDate: '2024-07-14', // 65 days after OPT start
          endDate: '2025-05-09',
        },
        {
          id: 'ep-2',
          authType: 'STEM-OPT',
          employer: 'Beta',
          hoursPerWeek: 40,
          startDate: '2025-07-14', // 65 days after STEM start
          endDate: '2027-05-09',
        },
      ],
    };
    const result = checkOptUnemployment150Stem(BASE_STUDENT, ctx, '2027-05-09');
    expect(result.outputs['totalUnemploymentDays']).toBe(130);
    expect(result.status).toBe('warning');
  });
});
