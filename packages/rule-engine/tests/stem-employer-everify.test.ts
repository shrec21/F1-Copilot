import { describe, it, expect } from 'vitest';
import { checkStemEmployerEverify } from '../src/rules/stem-employer-everify';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'CS',
  isStemDesignated: true,
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

describe('checkStemEmployerEverify', () => {
  it('returns not-applicable for non-STEM student', () => {
    const student = { ...STUDENT, isStemDesignated: false };
    const result = checkStemEmployerEverify(student, ctx(), '2025-06-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns not-applicable when no STEM-OPT employment exists', () => {
    const result = checkStemEmployerEverify(STUDENT, ctx(), '2025-06-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns pass when all STEM employers confirmed E-Verify enrolled', () => {
    const result = checkStemEmployerEverify(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'STEM-OPT',
          employer: 'TechCorp',
          hoursPerWeek: 40,
          startDate: '2025-05-10',
          endDate: null,
          employerEverifyEnrolled: true,
        }],
      }),
      '2025-06-01',
    );
    expect(result.status).toBe('pass');
  });

  it('returns warning when employer E-Verify status is unconfirmed', () => {
    const result = checkStemEmployerEverify(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'STEM-OPT',
          employer: 'TechCorp',
          hoursPerWeek: 40,
          startDate: '2025-05-10',
          endDate: null,
          // employerEverifyEnrolled not set
        }],
      }),
      '2025-06-01',
    );
    expect(result.status).toBe('warning');
    expect(result.message).toContain('unconfirmed');
  });

  it('returns violation when employer confirmed NOT enrolled in E-Verify', () => {
    const result = checkStemEmployerEverify(
      STUDENT,
      ctx({
        employmentPeriods: [{
          id: 'ep-1',
          authType: 'STEM-OPT',
          employer: 'SmallShop LLC',
          hoursPerWeek: 40,
          startDate: '2025-05-10',
          endDate: null,
          employerEverifyEnrolled: false,
        }],
      }),
      '2025-06-01',
    );
    expect(result.status).toBe('violation');
    expect(result.message).toContain('SmallShop LLC');
  });

  it('violation takes precedence over warning when both exist', () => {
    const result = checkStemEmployerEverify(
      STUDENT,
      ctx({
        employmentPeriods: [
          {
            id: 'ep-1',
            authType: 'STEM-OPT',
            employer: 'TechCorp',
            hoursPerWeek: 20,
            startDate: '2025-05-10',
            endDate: null,
            employerEverifyEnrolled: undefined, // warning
          },
          {
            id: 'ep-2',
            authType: 'STEM-OPT',
            employer: 'BadCo',
            hoursPerWeek: 20,
            startDate: '2025-06-01',
            endDate: null,
            employerEverifyEnrolled: false, // violation
          },
        ],
      }),
      '2025-07-01',
    );
    expect(result.status).toBe('violation');
  });
});
