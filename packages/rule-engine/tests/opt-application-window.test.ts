import { describe, it, expect } from 'vitest';
import { checkOptApplicationWindow } from '../src/rules/opt-application-window';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
  id: 'stu-1',
  fullName: 'Test Student',
  sevisId: 'N0012345678',
  programLevel: 'masters',
  major: 'CS',
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

const validOptAuth = (startDate: string) => ({
  id: 'auth-1',
  authType: 'OPT' as const,
  startDate,
  endDate: '2025-05-09',
});

describe('checkOptApplicationWindow — with OPT authorization', () => {
  it('passes when EAD start equals program end date', () => {
    const result = checkOptApplicationWindow(
      STUDENT,
      ctx({ authorizations: [validOptAuth('2024-05-10')] }),
      '2024-05-10',
    );
    expect(result.status).toBe('pass');
  });

  it('passes when EAD start is 30 days after program end', () => {
    const result = checkOptApplicationWindow(
      STUDENT,
      ctx({ authorizations: [validOptAuth('2024-06-09')] }),
      '2024-06-09',
    );
    expect(result.status).toBe('pass');
  });

  it('passes when EAD start is exactly 60 days after program end (boundary)', () => {
    // May 10 + 60 = July 9
    const result = checkOptApplicationWindow(
      STUDENT,
      ctx({ authorizations: [validOptAuth('2024-07-09')] }),
      '2024-07-09',
    );
    expect(result.status).toBe('pass');
  });

  it('returns violation when EAD start is 1 day before program end', () => {
    const result = checkOptApplicationWindow(
      STUDENT,
      ctx({ authorizations: [validOptAuth('2024-05-09')] }),
      '2024-05-09',
    );
    expect(result.status).toBe('violation');
    expect(result.outputs['daysBeforeWindow']).toBe(1);
  });

  it('returns violation when EAD start is 61 days after program end', () => {
    // May 10 + 61 = July 10
    const result = checkOptApplicationWindow(
      STUDENT,
      ctx({ authorizations: [validOptAuth('2024-07-10')] }),
      '2024-07-10',
    );
    expect(result.status).toBe('violation');
    expect(result.outputs['daysAfterWindow']).toBe(1);
  });
});

describe('checkOptApplicationWindow — no OPT authorization yet', () => {
  it('returns pass when today is before program end date', () => {
    const result = checkOptApplicationWindow(STUDENT, ctx(), '2024-04-01');
    expect(result.status).toBe('pass');
    expect(result.message).toContain('opens on');
  });

  it('returns pass when today is program end date', () => {
    const result = checkOptApplicationWindow(STUDENT, ctx(), '2024-05-10');
    expect(result.status).toBe('pass');
  });

  it('returns pass when today is within 60-day window and not close to deadline', () => {
    const result = checkOptApplicationWindow(STUDENT, ctx(), '2024-05-25');
    expect(result.status).toBe('pass');
    expect(result.message).toContain('closes');
  });

  it('returns warning when window closes within 14 days', () => {
    // Window closes July 9 — warn from June 26 onward
    const result = checkOptApplicationWindow(STUDENT, ctx(), '2024-06-26');
    expect(result.status).toBe('warning');
  });

  it('returns violation when window has closed and no OPT authorization', () => {
    // July 10 = 1 day after window close
    const result = checkOptApplicationWindow(STUDENT, ctx(), '2024-07-10');
    expect(result.status).toBe('violation');
    expect(result.outputs['windowClosedDaysAgo']).toBe(1);
  });
});
