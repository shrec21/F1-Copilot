import { describe, it, expect } from 'vitest';
import { checkCptAuthorizationPrior } from '../src/rules/cpt-authorization-prior';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'CS',
  isStemDesignated: false,
  programStartDate: '2022-08-15',
  programEndDate: '2025-05-10',
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

describe('checkCptAuthorizationPrior', () => {
  it('returns not-applicable when no CPT employment periods exist', () => {
    const result = checkCptAuthorizationPrior(STUDENT, ctx(), '2023-01-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns pass when employment start is covered by a matching authorization', () => {
    const result = checkCptAuthorizationPrior(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: 'Research Lab',
          hoursPerWeek: 20,
          startDate: '2023-06-01',
          endDate: '2023-08-31',
        }],
        authorizations: [{
          id: 'auth-1',
          authType: 'CPT',
          employer: 'Research Lab',
          startDate: '2023-05-15',
          endDate: '2023-08-31',
        }],
      }),
      '2023-09-01',
    );
    expect(result.status).toBe('pass');
  });

  it('returns violation when no CPT authorization exists for employer', () => {
    const result = checkCptAuthorizationPrior(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: 'Research Lab',
          hoursPerWeek: 20,
          startDate: '2023-06-01',
          endDate: '2023-08-31',
        }],
        authorizations: [],
      }),
      '2023-09-01',
    );
    expect(result.status).toBe('violation');
    expect(result.outputs['violations']).toHaveLength(1);
  });

  it('is case-insensitive and trims employer names', () => {
    const result = checkCptAuthorizationPrior(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: '  Research Lab  ',
          hoursPerWeek: 20,
          startDate: '2023-06-01',
          endDate: null,
        }],
        authorizations: [{
          id: 'auth-1',
          authType: 'CPT',
          employer: 'RESEARCH LAB',
          startDate: '2023-05-01',
          endDate: '2023-12-31',
        }],
      }),
      '2023-09-01',
    );
    expect(result.status).toBe('pass');
  });

  it('returns violation when employment started before authorization period', () => {
    const result = checkCptAuthorizationPrior(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'full-time',
          employer: 'TechCo',
          hoursPerWeek: 40,
          startDate: '2023-05-01',
          endDate: '2023-08-31',
        }],
        authorizations: [{
          id: 'auth-1',
          authType: 'CPT',
          employer: 'TechCo',
          startDate: '2023-06-01', // authorization starts AFTER employment
          endDate: '2023-08-31',
        }],
      }),
      '2023-09-01',
    );
    expect(result.status).toBe('violation');
  });

  it('passes when authorization covers employment exactly (same start date)', () => {
    const result = checkCptAuthorizationPrior(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'CPT',
          cptType: 'part-time',
          employer: 'TechCo',
          hoursPerWeek: 20,
          startDate: '2023-06-01',
          endDate: '2023-08-31',
        }],
        authorizations: [{
          id: 'auth-1',
          authType: 'CPT',
          employer: 'TechCo',
          startDate: '2023-06-01', // exact same start — authorized just in time
          endDate: '2023-08-31',
        }],
      }),
      '2023-09-01',
    );
    expect(result.status).toBe('pass');
  });
});
