import type { DateRange } from './types';

export type FilingStatus = 'upcoming' | 'open' | 'expiring' | 'closed' | 'not-applicable';

export interface FilingWindow {
  id: string;
  order: number;
  title: string;
  description: string;
  /** Earliest date the student should act (ISO 8601). */
  windowOpens: string;
  /** Hard USCIS or DSO deadline (ISO 8601). */
  hardDeadline: string;
  /** Days from today until the hard deadline (negative = past). */
  daysUntilDeadline: number;
  /** Days from today until the window opens (negative = already open). */
  daysUntilOpen: number;
  status: FilingStatus;
  form?: string;
  filingEntity: 'USCIS' | 'DSO' | 'CBP' | 'N/A';
  keySteps: string[];
  citation: string;
  note?: string;
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

function statusFor(daysUntilOpen: number, daysUntilDeadline: number): FilingStatus {
  if (daysUntilDeadline < 0) return 'closed';
  if (daysUntilOpen > 0)     return 'upcoming';
  if (daysUntilDeadline <= 30) return 'expiring';
  return 'open';
}

/**
 * Computes every F-1 filing window relevant to the student's situation.
 * Pure function — all inputs passed explicitly so it remains testable.
 *
 * @param profile       - Student profile from DB
 * @param optWindow     - Most recent OPT/STEM-OPT authorization window, or null
 * @param todayIso      - Current date ISO string
 */
export function computeFilingWindows(
  profile: {
    programEndDate: string;
    admissionDate: string;
    visaAdmissionType: 'D/S' | 'fixed-date';
    isStemEligible: boolean;
  },
  optWindow: DateRange | null,
  todayIso: string,
): FilingWindow[] {
  const windows: FilingWindow[] = [];

  const TRANSITION_DATE   = '2026-09-15';
  const DS_FILING_DEADLINE = '2027-03-18';
  const isDs = profile.visaAdmissionType === 'D/S' && profile.admissionDate < TRANSITION_DATE;

  // ── 1. Sept 15 Transition (informational for everyone) ────────────────────
  {
    const deadline  = TRANSITION_DATE;
    const opens     = addDays(deadline, -90);   // 90-day awareness window
    const daysOpen  = daysBetween(todayIso, opens);
    const daysDead  = daysBetween(todayIso, deadline);
    windows.push({
      id: 'sept15-transition',
      order: 1,
      title: 'D/S → Fixed-Date Transition Takes Effect',
      description:
        'On this date all new F-1 admissions become fixed-date. Students currently on D/S who travel ' +
        'and re-enter after this date receive a fixed-date I-94.',
      windowOpens: opens,
      hardDeadline: deadline,
      daysUntilDeadline: daysDead,
      daysUntilOpen: daysOpen,
      status: statusFor(daysOpen, daysDead),
      filingEntity: 'CBP',
      keySteps: [
        'Print and save your current I-94 before this date.',
        'Get your I-20 DSO-signed if you plan to travel.',
        'Review the Scenarios tab to understand your specific situation.',
      ],
      citation: 'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
    });
  }

  // ── 2. D/S Preservation Filing (D/S students only) ───────────────────────
  if (isDs) {
    const opens    = TRANSITION_DATE;           // opens on/after transition date
    const deadline = DS_FILING_DEADLINE;
    const daysOpen = daysBetween(todayIso, opens);
    const daysDead = daysBetween(todayIso, deadline);
    windows.push({
      id: 'ds-preservation-filing',
      order: 2,
      title: 'D/S Preservation Filing with USCIS',
      description:
        'D/S students who wish to formally remain under the Duration of Status regime must file ' +
        'with USCIS between September 15, 2026 and March 18, 2027. ' +
        'Most students do not need this — consult your DSO.',
      windowOpens: opens,
      hardDeadline: deadline,
      daysUntilDeadline: daysDead,
      daysUntilOpen: daysOpen,
      status: statusFor(daysOpen, daysDead),
      filingEntity: 'USCIS',
      keySteps: [
        'Consult your DSO to determine if this filing benefits your situation.',
        'USCIS will publish the exact form and procedure — monitor uscis.gov.',
        'File between September 15, 2026 and March 18, 2027.',
      ],
      citation: 'DHS Final Rule, 90 FR 5854 — transition provisions',
      note: 'USCIS has not yet published the exact filing mechanism. Monitor uscis.gov and your DSO communications.',
    });
  }

  // ── 3. OPT Application Window ────────────────────────────────────────────
  {
    const opens    = addDays(profile.programEndDate, -90); // can submit to DSO 90 days early
    const deadline = addDays(profile.programEndDate, 60);  // must be received within grace period
    const daysOpen = daysBetween(todayIso, opens);
    const daysDead = daysBetween(todayIso, deadline);
    windows.push({
      id: 'opt-application',
      order: 3,
      title: 'OPT Application (Form I-765)',
      description:
        'Apply for post-completion Optional Practical Training up to 90 days before your program ' +
        'end date. USCIS must receive the application within your 60-day grace period.',
      windowOpens: opens,
      hardDeadline: deadline,
      daysUntilDeadline: daysDead,
      daysUntilOpen: daysOpen,
      status: statusFor(daysOpen, daysDead),
      form: 'I-765',
      filingEntity: 'USCIS',
      keySteps: [
        `Submit OPT request to your DSO starting ${opens} (90 days before program end).`,
        'DSO endorses your I-20 and submits I-765 package to USCIS.',
        'Allow 3–5 months for USCIS processing — apply early.',
        `USCIS must receive the application by ${deadline} (end of grace period).`,
      ],
      citation: '8 CFR § 214.2(f)(11); USCIS Form I-765 instructions',
      note: 'Processing times vary. Apply as early as the window allows to avoid gaps.',
    });
  }

  // ── 4. STEM OPT Extension (STEM-eligible students with an OPT window) ────
  if (profile.isStemEligible && optWindow?.end) {
    const opens    = addDays(optWindow.end, -90);
    const deadline = optWindow.end;  // must apply before OPT EAD expires
    const daysOpen = daysBetween(todayIso, opens);
    const daysDead = daysBetween(todayIso, deadline);
    windows.push({
      id: 'stem-opt-extension',
      order: 4,
      title: 'STEM OPT Extension (Form I-765 + I-983)',
      description:
        'STEM-eligible students on OPT can apply for a 24-month extension. The application must ' +
        'be filed with USCIS before the current OPT EAD expires.',
      windowOpens: opens,
      hardDeadline: deadline,
      daysUntilDeadline: daysDead,
      daysUntilOpen: daysOpen,
      status: statusFor(daysOpen, daysDead),
      form: 'I-765 + I-983',
      filingEntity: 'USCIS',
      keySteps: [
        `Begin preparing Form I-983 Training Plan ${opens} (90 days before OPT expiry).`,
        'Employer must be enrolled in E-Verify — confirm before filing.',
        'Submit I-983 to DSO for I-20 STEM endorsement.',
        `File I-765 with USCIS before your OPT EAD expires on ${optWindow.end}.`,
      ],
      citation: '8 CFR § 214.2(f)(10)(ii)(C); USCIS STEM OPT Hub',
      note: `Your current OPT window ends ${optWindow.end}. Apply well before this date — USCIS processing takes 3–5 months.`,
    });
  }

  // ── 5. Program End / Grace Period Anchor ─────────────────────────────────
  {
    const opens    = addDays(profile.programEndDate, -30); // 30-day "prepare" reminder
    const deadline = addDays(profile.programEndDate, 60);  // grace period ends
    const daysOpen = daysBetween(todayIso, opens);
    const daysDead = daysBetween(todayIso, deadline);
    windows.push({
      id: 'grace-period-departure',
      order: 5,
      title: '60-Day Grace Period — Depart, Transfer, or Change Status',
      description:
        'After your program end date, you have a 60-day grace period to depart the U.S., ' +
        'transfer to another SEVP school, or file for a change of status. ' +
        'You may not work during the grace period without OPT or other authorization.',
      windowOpens: opens,
      hardDeadline: deadline,
      daysUntilDeadline: daysDead,
      daysUntilOpen: daysOpen,
      status: statusFor(daysOpen, daysDead),
      filingEntity: 'N/A',
      keySteps: [
        `Program ends ${profile.programEndDate} — ensure OPT, transfer, or departure is arranged.`,
        `Grace period expires ${deadline} — you must be out of the U.S. or have changed status by then.`,
        'Do not work during the grace period without a valid EAD.',
        'Transfer SEVIS record if moving to a new school.',
      ],
      citation: '8 CFR § 214.2(f)(5)(iv)',
    });
  }

  return windows.sort((a, b) => a.order - b.order);
}
