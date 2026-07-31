import { describe, it, expect } from 'vitest';
import { checkCptFullTimeOptBar } from '../src/rules/cpt-full-time-opt-bar';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'Computer Science',
  isStemDesignated: false,
  programStartDate: '2020-08-15',
  programEndDate: '2024-05-10',
  admissionType: 'D/S',
  i94AdmissionDate: '2020-08-10',
  i94ExpiryDate: null,
};

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    employmentPeriods: [],
    authorizations: [],
    stemI983Submissions: [],
    ...overrides,
  };
}

describe('checkCptFullTimeOptBar', () => {
  it('returns pass with 0 months when no CPT on record', () => {
    const result = checkCptFullTimeOptBar(STUDENT, makeCtx(), '2023-01-01');
    expect(result.status).toBe('pass');
    expect(result.outputs['fullTimeCptMonths']).toBe(0);
    expect(result.outputs['optBarReached']).toBe(false);
  });

  it('ignores part-time CPT entirely', () => {
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: 'Lab A',
          hoursPerWeek: 20,
          startDate: '2020-09-01',
          endDate: '2024-04-30',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2024-04-30');
    expect(result.status).toBe('pass');
    expect(result.outputs['fullTimeCptMonths']).toBe(0);
    expect(result.outputs['optBarReached']).toBe(false);
  });

  it('counts full-time CPT months and returns pass under 12 months', () => {
    // 6 months of full-time CPT
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-06-01',
          endDate: '2021-11-30',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2021-12-01');
    expect(result.status).toBe('pass');
    expect(result.outputs['fullTimeCptMonths']).toBe(6);
    expect(result.outputs['optBarReached']).toBe(false);
  });

  it('returns warning when within 1 month of the bar', () => {
    // 11 months of full-time CPT
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-06-01',
          endDate: '2022-04-30',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2022-05-01');
    expect(result.status).toBe('warning');
    expect(result.outputs['fullTimeCptMonths']).toBe(11);
  });

  it('returns violation at exactly 12 months', () => {
    // 12 full calendar months
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-01-01',
          endDate: '2021-12-31',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2022-01-01');
    expect(result.status).toBe('violation');
    expect(result.outputs['optBarReached']).toBe(true);
    expect(result.outputs['fullTimeCptMonths']).toBe(12);
  });

  it('returns violation for more than 12 months', () => {
    // Two separate full-time CPT periods totaling 15 months
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-06-01',
          endDate: '2021-11-30',
        },
        {
          id: 'ep-2',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab B',
          hoursPerWeek: 40,
          startDate: '2022-01-01',
          endDate: '2022-09-30',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2022-10-01');
    expect(result.status).toBe('violation');
    expect(result.outputs['fullTimeCptMonths']).toBe(15);
  });

  it('does not double-count overlapping months from two employers', () => {
    // Two concurrent full-time CPT roles for 3 months — should still be 3 months
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2021-06-01',
          endDate: '2021-08-31',
        },
        {
          id: 'ep-2',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab B',
          hoursPerWeek: 40,
          startDate: '2021-06-01',
          endDate: '2021-08-31',
        },
      ],
    });
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2021-09-01');
    expect(result.outputs['fullTimeCptMonths']).toBe(3);
  });

  it('handles ongoing full-time CPT (no endDate) using todayIso as end', () => {
    const ctx = makeCtx({
      employmentPeriods: [
        {
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'Lab A',
          hoursPerWeek: 40,
          startDate: '2023-06-01',
          endDate: null,
        },
      ],
    });
    // Evaluated on 2024-05-31: 12 full months (June 2023 to May 2024)
    const result = checkCptFullTimeOptBar(STUDENT, ctx, '2024-05-31');
    expect(result.outputs['fullTimeCptMonths']).toBe(12);
    expect(result.status).toBe('violation');
  });
});
