import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';

const RULE: ComplianceRule = {
  id: 'stem-employer-everify',
  version: 1,
  title: 'STEM OPT Employer Must Be Enrolled in E-Verify',
  sourceCitation: '8 CFR § 214.2(f)(10)(ii)(C)(2)',
  effectiveDate: '2016-05-10',
  supersedes: null,
};

interface EmployerStatus {
  employer: string;
  employmentId: string;
  startDate: string;
  everifyStatus: 'confirmed' | 'unconfirmed' | 'not-enrolled';
}

/**
 * Checks that every STEM OPT employer is enrolled in E-Verify.
 *
 * The student is responsible for confirming E-Verify enrollment before
 * accepting STEM OPT employment. This rule evaluates the data the
 * student has provided:
 * - employerEverifyEnrolled === true   -> confirmed
 * - employerEverifyEnrolled === false  -> violation (not enrolled)
 * - employerEverifyEnrolled === undefined -> warning (unconfirmed)
 *
 * Students must also report employer changes to their DSO within 5 business
 * days (8 CFR § 214.2(f)(10)(ii)(C)(4)), but that check is handled by a
 * separate rule.
 */
export function checkStemEmployerEverify(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  if (!student.isStemDesignated) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { isStemDesignated: false },
      outputs: {},
      message: 'Student is not STEM-designated — rule does not apply.',
    };
  }

  const stemPeriods = context.employmentPeriods.filter(
    ep => ep.authType === 'STEM-OPT',
  );

  if (stemPeriods.length === 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { isStemDesignated: true, stemEmploymentCount: 0 },
      outputs: {},
      message: 'No STEM OPT employment periods on record — rule does not apply.',
    };
  }

  const statuses: EmployerStatus[] = stemPeriods.map(ep => ({
    employer: ep.employer,
    employmentId: ep.id,
    startDate: ep.startDate,
    everifyStatus:
      ep.employerEverifyEnrolled === true
        ? 'confirmed'
        : ep.employerEverifyEnrolled === false
        ? 'not-enrolled'
        : 'unconfirmed',
  }));

  const violations = statuses.filter(s => s.everifyStatus === 'not-enrolled');
  const unconfirmed = statuses.filter(s => s.everifyStatus === 'unconfirmed');

  if (violations.length > 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'violation',
      computedAt: todayIso,
      inputs: { stemEmploymentCount: stemPeriods.length },
      outputs: { employerStatuses: statuses, violationCount: violations.length },
      message: `${violations.length} STEM OPT employer(s) confirmed NOT enrolled in E-Verify: ${violations.map(v => v.employer).join(', ')}.`,
    };
  }

  if (unconfirmed.length > 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'warning',
      computedAt: todayIso,
      inputs: { stemEmploymentCount: stemPeriods.length },
      outputs: { employerStatuses: statuses, unconfirmedCount: unconfirmed.length },
      message: `${unconfirmed.length} STEM OPT employer(s) have unconfirmed E-Verify status: ${unconfirmed.map(u => u.employer).join(', ')}. Verify at uscis.gov/e-verify before starting work.`,
    };
  }

  return {
    rule: RULE,
    studentId: student.id,
    status: 'pass',
    computedAt: todayIso,
    inputs: { stemEmploymentCount: stemPeriods.length },
    outputs: { employerStatuses: statuses },
    message: `All ${stemPeriods.length} STEM OPT employer(s) confirmed enrolled in E-Verify.`,
  };
}
