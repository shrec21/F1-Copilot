import type { Student, RuleContext, RuleResult, ComplianceRule } from '../types';

const RULE: ComplianceRule = {
  id: 'cpt-authorization-prior',
  version: 1,
  title: 'CPT Must Be Authorized Before Employment Begins',
  sourceCitation: '8 CFR § 214.2(f)(10)(i)',
  effectiveDate: '1996-01-01',
  supersedes: null,
};

interface Violation {
  employmentId: string;
  employer: string;
  employmentStart: string;
  authorizationStart: string | null; // null = no matching authorization found
  unauthorizedDays: number;
}

/**
 * Checks that every CPT employment period is covered by a DSO-issued
 * CPT authorization that starts on or before the employment start date.
 *
 * A CPT authorization is considered a match for an employment period when:
 * - authType is 'CPT'
 * - employer matches (case-insensitive, trimmed)
 * - authorization startDate <= employment startDate
 * - authorization endDate >= employment startDate
 */
export function checkCptAuthorizationPrior(
  student: Student,
  context: RuleContext,
  todayIso: string,
): RuleResult {
  const cptPeriods = context.employmentPeriods.filter(
    ep => ep.authType === 'CPT',
  );

  if (cptPeriods.length === 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'not-applicable',
      computedAt: todayIso,
      inputs: { cptEmploymentCount: 0 },
      outputs: {},
      message: 'No CPT employment periods on record — rule does not apply.',
    };
  }

  const cptAuths = context.authorizations.filter(a => a.authType === 'CPT');
  const violations: Violation[] = [];

  for (const ep of cptPeriods) {
    const epEmployer = ep.employer.trim().toLowerCase();

    // Find a CPT authorization that covers this employment's start date
    const matchingAuth = cptAuths.find(auth => {
      const authEmployer = (auth.employer ?? '').trim().toLowerCase();
      return (
        authEmployer === epEmployer &&
        auth.startDate <= ep.startDate &&
        auth.endDate >= ep.startDate
      );
    });

    if (!matchingAuth) {
      // Count the days of unauthorized work
      const empEnd = ep.endDate ?? todayIso;
      // Without a matching auth, the whole period is unauthorized
      const unauthorizedDays =
        Math.round(
          (new Date(empEnd + 'T00:00:00Z').getTime() -
            new Date(ep.startDate + 'T00:00:00Z').getTime()) /
            86_400_000,
        ) + 1;

      violations.push({
        employmentId: ep.id,
        employer: ep.employer,
        employmentStart: ep.startDate,
        authorizationStart: null,
        unauthorizedDays,
      });
    } else if (matchingAuth.startDate > ep.startDate) {
      // Auth exists but started after employment — count the gap days
      const gapDays =
        Math.round(
          (new Date(matchingAuth.startDate + 'T00:00:00Z').getTime() -
            new Date(ep.startDate + 'T00:00:00Z').getTime()) /
            86_400_000,
        );

      if (gapDays > 0) {
        violations.push({
          employmentId: ep.id,
          employer: ep.employer,
          employmentStart: ep.startDate,
          authorizationStart: matchingAuth.startDate,
          unauthorizedDays: gapDays,
        });
      }
    }
  }

  if (violations.length === 0) {
    return {
      rule: RULE,
      studentId: student.id,
      status: 'pass',
      computedAt: todayIso,
      inputs: {
        cptEmploymentCount: cptPeriods.length,
        cptAuthorizationCount: cptAuths.length,
      },
      outputs: { violations: [] },
      message: `All ${cptPeriods.length} CPT period(s) covered by prior DSO authorization.`,
    };
  }

  return {
    rule: RULE,
    studentId: student.id,
    status: 'violation',
    computedAt: todayIso,
    inputs: {
      cptEmploymentCount: cptPeriods.length,
      cptAuthorizationCount: cptAuths.length,
    },
    outputs: { violations },
    message: `${violations.length} CPT employment period(s) lack prior DSO authorization — unauthorized employment may have occurred.`,
  };
}
