import type { DateRange } from './types';

export type ConsequenceSeverity = 'caution' | 'serious' | 'severe' | 'critical';

export interface ConsequenceTier {
  /** Short trigger label shown on the cascade, e.g. "Day 1 after deadline". */
  trigger: string;
  /** ISO 8601 date when this consequence becomes active. */
  date: string;
  /** Days from today until this consequence activates (negative = already active). */
  daysFromNow: number;
  title: string;
  detail: string;
  severity: ConsequenceSeverity;
  alreadyActive: boolean;
}

export interface RiskEntry {
  id: string;
  deadlineTitle: string;
  /** Hard deadline date (ISO 8601). */
  deadlineDate: string;
  daysUntilDeadline: number;
  /** True when today is past the deadline. */
  deadlineMissed: boolean;
  summary: string;
  consequences: ConsequenceTier[];
  citations: string[];
  disclaimer: string;
}

function toUtcDate(iso: string): Date {
  const p = iso.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
}

function addDays(iso: string, days: number): string {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86400000);
}

const DISCLAIMER =
  'Unlawful presence rules for F-1 students are complex and subject to policy change. ' +
  'Consequences depend on individual facts. This is not legal advice — consult an immigration attorney.';

/**
 * Computes the personalized risk cascade for each critical deadline.
 * Pure function — no side effects.
 */
export function computeRiskModel(
  profile: {
    programEndDate: string;
    admissionDate: string;
    visaAdmissionType: 'D/S' | 'fixed-date';
    isStemEligible: boolean;
  },
  optWindow: DateRange | null,
  todayIso: string,
): RiskEntry[] {
  const risks: RiskEntry[] = [];

  const graceEnd  = addDays(profile.programEndDate, 60);
  const bar3year  = addDays(graceEnd, 180);   // 3-year bar: 180 days of unlawful presence
  const bar10year = addDays(graceEnd, 365);   // 10-year bar: 365 days of unlawful presence

  const isDs = profile.visaAdmissionType === 'D/S' && profile.admissionDate < '2026-09-15';

  function tier(
    trigger: string,
    date: string,
    title: string,
    detail: string,
    severity: ConsequenceSeverity,
  ): ConsequenceTier {
    const daysFromNow = daysBetween(todayIso, date);
    return { trigger, date, daysFromNow, title, detail, severity, alreadyActive: daysFromNow < 0 };
  }

  // ── Risk 1: Missing the 60-day grace period ───────────────────────────────
  {
    const deadline = graceEnd;
    const daysToDead = daysBetween(todayIso, deadline);

    risks.push({
      id: 'grace-period-overstay',
      deadlineTitle: '60-Day Grace Period (program end + 60 days)',
      deadlineDate: deadline,
      daysUntilDeadline: daysToDead,
      deadlineMissed: daysToDead < 0,
      summary:
        'Remaining in the U.S. past your grace period without OPT, a transfer, or a change of status ' +
        'puts you out of status and begins unlawful presence accumulation. ' +
        'The consequences escalate with every day you remain.',
      consequences: [
        tier(
          'Day 1 after grace period',
          addDays(graceEnd, 1),
          'Out of status — unlawful presence begins',
          'You are no longer in a valid immigration status. Unlawful presence begins accruing from this date. ' +
          'Any employment after this point is unauthorized, carrying permanent immigration consequences.',
          'serious',
        ),
        tier(
          'Day 181 of unlawful presence',
          bar3year,
          '3-year re-entry bar triggered on departure',
          `If you depart the U.S. on or after ${bar3year}, a 3-year bar on re-entry is automatically triggered. ` +
          'This applies to any future visa application, admission, or immigration benefit.',
          'severe',
        ),
        tier(
          'Day 366 of unlawful presence',
          bar10year,
          '10-year re-entry bar triggered on departure',
          `If you depart the U.S. on or after ${bar10year}, a 10-year bar on re-entry is triggered. ` +
          'This is one of the most serious immigration consequences short of a permanent bar.',
          'critical',
        ),
        tier(
          'Ongoing',
          addDays(graceEnd, 1),
          'Future immigration benefits permanently impaired',
          'Unlawful presence creates a presumption of inadmissibility for future visa applications, ' +
          'adjustment of status petitions, and naturalization. The longer the overstay, the harder it is to overcome.',
          'critical',
        ),
      ],
      citations: [
        'INA § 212(a)(9)(B) — unlawful presence bars (3-year and 10-year)',
        '8 CFR § 214.2(f)(5)(iv) — 60-day grace period',
        'USCIS Policy Manual, Vol. 12, Part D — unlawful presence for nonimmigrants',
      ],
      disclaimer: DISCLAIMER,
    });
  }

  // ── Risk 2: Working without authorization (OPT EAD expired / not obtained) ─
  {
    const deadline = profile.programEndDate;  // last day eligible for OPT start
    const daysToDead = daysBetween(todayIso, deadline);

    risks.push({
      id: 'unauthorized-employment',
      deadlineTitle: 'OPT Application Deadline (apply before program end)',
      deadlineDate: deadline,
      daysUntilDeadline: daysToDead,
      deadlineMissed: daysToDead < 0,
      summary:
        'Working without a valid EAD — whether because OPT was never obtained or the EAD expired — ' +
        'is unauthorized employment. This carries consequences that are permanent and cannot be waived ' +
        'by future compliance.',
      consequences: [
        tier(
          'First day of unauthorized work',
          addDays(todayIso, 0),
          'Unauthorized employment begins',
          'Any work performed without a valid EAD is unauthorized employment, even a single day. ' +
          'Employers who knowingly hire unauthorized workers also face sanctions.',
          'serious',
        ),
        tier(
          'Permanent — no time limit',
          addDays(todayIso, 1),
          'Permanent bar on adjustment of status',
          'Under INA § 245(c)(2), persons who have engaged in unauthorized employment are permanently ' +
          'ineligible to adjust status inside the U.S. This includes future green card applications. ' +
          'This consequence does not expire.',
          'critical',
        ),
        tier(
          'If USCIS discovers it',
          addDays(todayIso, 1),
          'Removal proceedings may be initiated',
          'USCIS or ICE may initiate removal proceedings upon discovering unauthorized employment, ' +
          'regardless of how long ago it occurred.',
          'critical',
        ),
      ],
      citations: [
        'INA § 245(c)(2) — adjustment of status bar for unauthorized employment',
        'INA § 274A — employer sanctions for hiring unauthorized workers',
        '8 CFR § 214.2(f)(9) — OPT authorization requirements',
      ],
      disclaimer: DISCLAIMER,
    });
  }

  // ── Risk 3: STEM OPT extension missed (STEM-eligible with OPT window) ─────
  if (profile.isStemEligible && optWindow?.end) {
    const optExpiry   = optWindow.end;
    const daysToDead  = daysBetween(todayIso, optExpiry);
    const graceStem   = addDays(optExpiry, 60);   // 60-day grace after OPT expiry

    risks.push({
      id: 'stem-opt-extension-missed',
      deadlineTitle: 'STEM OPT Extension Deadline (before OPT EAD expiry)',
      deadlineDate: optExpiry,
      daysUntilDeadline: daysToDead,
      deadlineMissed: daysToDead < 0,
      summary:
        `Your OPT EAD expires on ${optExpiry}. If a timely STEM extension application is not pending ` +
        'with USCIS before that date, your work authorization ends immediately and the 60-day ' +
        'post-OPT grace period begins.',
      consequences: [
        tier(
          'Day after OPT EAD expiry',
          addDays(optExpiry, 1),
          'Work authorization ends — must stop working immediately',
          `After ${optExpiry}, you have no valid EAD. Any work performed is unauthorized employment ` +
          'with permanent consequences (see Unauthorized Employment risk). Stop working the day your EAD expires.',
          'severe',
        ),
        tier(
          'Day after OPT EAD expiry',
          addDays(optExpiry, 1),
          '60-day grace period begins',
          `A 60-day grace period runs from ${addDays(optExpiry, 1)} to ${graceStem}. ` +
          'You may remain in the U.S. during this period but cannot work. ' +
          'You must depart, transfer, or change status by the grace period end.',
          'serious',
        ),
        tier(
          `After grace period (${graceStem})`,
          addDays(graceStem, 1),
          'Out of status — unlawful presence accumulates',
          'Remaining past the grace period triggers the same unlawful presence cascade as overstaying ' +
          'your program end grace period: eventual 3-year and 10-year bars.',
          'critical',
        ),
        tier(
          'If timely extension was pending',
          optExpiry,
          'Cap-gap coverage applies — no interruption',
          'If you filed the STEM extension application before your OPT EAD expired, USCIS cap-gap ' +
          'provisions allow you to continue working until a decision is made. ' +
          'File as early as 90 days before EAD expiry.',
          'caution',
        ),
      ],
      citations: [
        '8 CFR § 214.2(f)(10)(ii)(C) — STEM OPT extension',
        'INA § 274A — unauthorized employment',
        'USCIS Cap-Gap guidance for OPT extension applicants',
      ],
      disclaimer: DISCLAIMER,
    });
  }

  // ── Risk 4: D/S preservation filing missed (D/S students only) ───────────
  if (isDs) {
    const deadline   = '2027-03-18';
    const daysToDead = daysBetween(todayIso, deadline);

    risks.push({
      id: 'ds-filing-missed',
      deadlineTitle: 'D/S Preservation Filing Deadline (March 18, 2027)',
      deadlineDate: deadline,
      daysUntilDeadline: daysToDead,
      deadlineMissed: daysToDead < 0,
      summary:
        'Missing the D/S preservation filing deadline is the least severe of the risks — it does not ' +
        'immediately put you out of status. However, it closes the window to remain under the D/S ' +
        'regime permanently, and creates status ambiguity if your I-94 still shows D/S.',
      consequences: [
        tier(
          'Day after deadline',
          addDays(deadline, 1),
          'D/S preservation window permanently closed',
          'You cannot file after March 18, 2027. USCIS will treat you as fixed-date going forward. ' +
          'This is not a violation by itself — it is simply a lost opportunity.',
          'caution',
        ),
        tier(
          'On next re-entry after Sept 15, 2026',
          '2026-09-15',
          'Fixed-date I-94 issued on re-entry',
          'Any re-entry to the U.S. after September 15, 2026 will result in a fixed-date I-94 ' +
          'regardless of whether you filed. Track this new expiration carefully.',
          'caution',
        ),
        tier(
          'If I-94 says D/S but you are past program end + 60 days',
          graceEnd,
          'Potential status ambiguity',
          'Your I-94 may show D/S while USCIS treats you as fixed-date. If you are past your ' +
          'program end date + 60 days, you may be out of status despite what the I-94 shows. ' +
          'Consult your DSO and an immigration attorney immediately.',
          'severe',
        ),
      ],
      citations: [
        'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025) — transition provisions',
        '8 CFR § 214.2(f)(5)',
      ],
      disclaimer: DISCLAIMER,
    });
  }

  // Sort: missed deadlines first, then by days until deadline ascending
  risks.sort((a, b) => {
    if (a.deadlineMissed !== b.deadlineMissed) return a.deadlineMissed ? -1 : 1;
    return a.daysUntilDeadline - b.daysUntilDeadline;
  });

  return risks;
}
