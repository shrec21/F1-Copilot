import type { UnemploymentResult } from './unemployment-clock';
import type { CptImpactResult } from './cpt-tracker';
import type { Conflict } from './types';
import type { DsTransitionResult } from './ds-transition';

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  deadline?: string;
  daysUntil?: number;
  ruleId: string;
  action: string;
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

export function computeAlerts(
  unemployment: UnemploymentResult | null,
  cptImpact: CptImpactResult,
  conflicts: Conflict[],
  dsStatus: DsTransitionResult,
  todayIso: string,
): Alert[] {
  const alerts: Alert[] = [];

  // --- Unemployment clock alerts ---
  if (unemployment) {
    if (unemployment.status === 'exceeded') {
      alerts.push({
        id: 'unemployment-exceeded',
        severity: 'critical',
        title: 'OPT Unemployment Cap Exceeded',
        description: `You have used ${unemployment.usedDays} unemployment days — above the cap. Your OPT authorization may be considered violated.`,
        ruleId: unemployment.appliedRuleId,
        action: 'Contact your DSO immediately to discuss your options.',
      });
    } else if (unemployment.status === 'warning') {
      alerts.push({
        id: 'unemployment-warning',
        severity: 'warning',
        title: 'Approaching Unemployment Cap',
        description: `You have used ${unemployment.usedDays} unemployment days. Only ${unemployment.remainingDays} days remain before the cap.`,
        ruleId: unemployment.appliedRuleId,
        action: 'Secure qualifying employment soon or consult your DSO about authorized leave.',
      });
    }
  }

  // --- CPT eligibility impact alerts ---
  if (cptImpact.optEligibilityAtRisk) {
    alerts.push({
      id: 'cpt-opt-risk',
      severity: 'critical',
      title: 'OPT Eligibility at Risk from Full-Time CPT',
      description: `You have accumulated ${cptImpact.totalFullTimeMonths} month(s) of full-time CPT, which may eliminate your OPT eligibility.`,
      ruleId: cptImpact.appliedRuleId,
      action: 'Speak with your DSO before pursuing OPT — eligibility may be affected.',
    });
  }

  // --- D/S transition deadline alerts ---
  if (dsStatus.regime === 'D/S' && dsStatus.transitionDeadline) {
    const days = daysBetween(todayIso, dsStatus.transitionDeadline);
    if (days >= 0 && days <= 90) {
      const severity = days <= 30 ? 'critical' : 'warning';
      alerts.push({
        id: 'ds-transition-deadline',
        severity,
        title: 'D/S to Fixed-Date Transition Deadline Approaching',
        description: `You are currently on D/S status and must file before the transition deadline on ${dsStatus.transitionDeadline}.`,
        deadline: dsStatus.transitionDeadline,
        daysUntil: days,
        ruleId: dsStatus.appliedRuleId,
        action: 'File the required paperwork with USCIS and notify your DSO before the deadline.',
      });
    } else if (days < 0) {
      alerts.push({
        id: 'ds-transition-past',
        severity: 'critical',
        title: 'D/S Transition Deadline Passed',
        description: `The D/S transition deadline of ${dsStatus.transitionDeadline} has passed. Your status situation requires immediate attention.`,
        deadline: dsStatus.transitionDeadline,
        daysUntil: days,
        ruleId: dsStatus.appliedRuleId,
        action: 'Contact your DSO and an immigration attorney immediately.',
      });
    }
  }

  // --- Conflict alerts ---
  for (const conflict of conflicts) {
    alerts.push({
      id: `conflict-${conflict.roleIds[0]}-${conflict.roleIds[1]}`,
      severity: 'critical',
      title: 'Concurrent Employment Conflict Detected',
      description: conflict.description,
      ruleId: conflict.ruleId,
      action: 'Review your employment periods and consult your DSO about authorization.',
    });
  }

  return alerts;
}
