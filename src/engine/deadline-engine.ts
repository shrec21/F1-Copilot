import type { UnemploymentResult } from './unemployment-clock';
import type { DsTransitionResult } from './ds-transition';

export interface Deadline {
  id: string;
  title: string;
  description: string;
  date: string;
  daysUntil: number;
  severity: 'critical' | 'warning' | 'info' | 'past';
  ruleId: string;
  citation: string;
}

function toUtcDate(iso: string): Date {
  const parts = iso.split('-');
  return new Date(Date.UTC(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
  ));
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = toUtcDate(fromIso);
  const to = toUtcDate(toIso);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function severityForDays(days: number): 'critical' | 'warning' | 'info' | 'past' {
  if (days < 0) return 'past';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'info';
}

export function computeDeadlines(
  unemployment: UnemploymentResult | null,
  dsStatus: DsTransitionResult,
  programEndDate: string,
  todayIso: string,
): Deadline[] {
  const deadlines: Deadline[] = [];

  // --- D/S transition deadline ---
  if (dsStatus.regime === 'D/S' && dsStatus.transitionDeadline) {
    const days = daysBetween(todayIso, dsStatus.transitionDeadline);
    deadlines.push({
      id: 'ds-transition',
      title: 'D/S → Fixed-Date Filing Deadline',
      description: 'File required paperwork to transition from Duration of Status to fixed-period admission.',
      date: dsStatus.transitionDeadline,
      daysUntil: days,
      severity: severityForDays(days),
      ruleId: dsStatus.appliedRuleId,
      citation: '8 CFR § 214.2(f)(5)',
    });
  }

  // --- Grace period end ---
  if (dsStatus.graceperiodEndDate) {
    const days = daysBetween(todayIso, dsStatus.graceperiodEndDate);
    deadlines.push({
      id: 'grace-period-end',
      title: 'Grace Period End',
      description: 'Post-completion grace period expires — you must depart or have a change of status by this date.',
      date: dsStatus.graceperiodEndDate,
      daysUntil: days,
      severity: severityForDays(days),
      ruleId: dsStatus.appliedRuleId,
      citation: '8 CFR § 214.2(f)(5)(iv)',
    });
  }

  // --- Program end date ---
  const programDays = daysBetween(todayIso, programEndDate);
  deadlines.push({
    id: 'program-end',
    title: 'Program End Date',
    description: 'Your I-20 program end date. Post-completion OPT or departure arrangements should be in place.',
    date: programEndDate,
    daysUntil: programDays,
    severity: severityForDays(programDays),
    ruleId: 'fixed-period-admission-effective-date',
    citation: '8 CFR § 214.2(f)(8)',
  });

  // --- OPT unemployment cap projection ---
  if (unemployment && unemployment.status !== 'exceeded' && unemployment.remainingDays > 0) {
    // Project the date when the cap will be hit at the current rate (1 day per calendar day if unemployed)
    const today = toUtcDate(todayIso);
    const projectedMs = today.getTime() + unemployment.remainingDays * 86400000;
    const projectedDate = new Date(projectedMs);
    const projectedIso = projectedDate.toISOString().slice(0, 10);
    const days = unemployment.remainingDays;

    deadlines.push({
      id: 'opt-cap-projection',
      title: 'OPT Unemployment Cap Projection',
      description: `At the current pace, you would exhaust your ${unemployment.remainingDays + unemployment.usedDays}-day unemployment allowance by this date. Secure employment before then.`,
      date: projectedIso,
      daysUntil: days,
      severity: severityForDays(days),
      ruleId: unemployment.appliedRuleId,
      citation: '8 CFR § 214.2(f)(10)(ii)(C)',
    });
  }

  // Sort ascending by daysUntil
  deadlines.sort((a, b) => a.daysUntil - b.daysUntil);

  return deadlines;
}
