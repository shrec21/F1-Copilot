import { describe, it, expect } from 'vitest';
import { checkStemI983Reporting } from '../src/rules/stem-i983-reporting';
import type { Student, RuleContext } from '../src/types';

const STUDENT: Student = {
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

const STEM_AUTH = {
  id: 'auth-2',
  authType: 'STEM-OPT' as const,
  startDate: '2025-05-10',
  endDate: '2027-05-09',
};

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    employmentPeriods: [],
    authorizations: [STEM_AUTH],
    stemI983Submissions: [],
    ...overrides,
  };
}

describe('checkStemI983Reporting', () => {
  it('returns not-applicable for non-STEM student', () => {
    const student = { ...STUDENT, isStemDesignated: false };
    const result = checkStemI983Reporting(student, ctx(), '2025-06-01');
    expect(result.status).toBe('not-applicable');
  });

  it('returns not-applicable when no STEM-OPT authorization exists', () => {
    const result = checkStemI983Reporting(
      STUDENT,
      ctx({ authorizations: [] }),
      '2025-06-01',
    );
    expect(result.status).toBe('not-applicable');
  });

  it('returns pass before first annual deadline with no submissions', () => {
    // STEM starts May 10 2025; first report due May 10 2026
    const result = checkStemI983Reporting(STUDENT, ctx(), '2025-12-01');
    expect(result.status).toBe('pass');
    expect(result.outputs['nextDueDate']).toBe('2026-05-10');
  });

  it('returns warning within 30 days of first annual deadline', () => {
    // 20 days before first report due
    const result = checkStemI983Reporting(STUDENT, ctx(), '2026-04-20');
    expect(result.status).toBe('warning');
    expect(typeof result.outputs['daysUntilDue']).toBe('number');
  });

  it('returns violation when first annual report is overdue', () => {
    // 5 days after first report was due
    const result = checkStemI983Reporting(STUDENT, ctx(), '2026-05-15');
    expect(result.status).toBe('violation');
    expect(result.outputs['daysOverdue']).toBe(5);
  });

  it('returns pass after first submission, before next deadline', () => {
    const result = checkStemI983Reporting(
      STUDENT,
      ctx({ stemI983Submissions: ['2026-05-01'] }),
      '2026-06-01',
    );
    expect(result.status).toBe('pass');
    // Next due: May 1 2026 + 365 = May 1 2027 (approximately)
    expect(result.outputs['nextDueDate']).toBe('2027-05-01');
  });

  it('returns violation when second report is overdue', () => {
    const result = checkStemI983Reporting(
      STUDENT,
      ctx({ stemI983Submissions: ['2026-05-01'] }),
      '2027-06-01',
    );
    expect(result.status).toBe('violation');
    expect((result.outputs['daysOverdue'] as number)).toBeGreaterThan(0);
  });

  it('returns pass when STEM-OPT period has expired', () => {
    // After STEM-OPT ends, no further reporting is required
    const result = checkStemI983Reporting(
      STUDENT,
      ctx({ stemI983Submissions: ['2026-05-10'] }),
      '2027-05-15', // after STEM end date 2027-05-09
    );
    expect(result.status).toBe('pass');
    expect(result.outputs['stemExpired']).toBe(true);
  });
});
