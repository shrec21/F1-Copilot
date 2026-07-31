import type { DsTransitionResult } from './ds-transition';

export interface ActionStep {
  id: string;
  order: number;
  category: 'verify' | 'contact' | 'document' | 'file' | 'track' | 'plan';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  deadline?: string;
  daysUntil?: number;
  citation?: string;
  resources: { label: string; url: string }[];
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
  return Math.round(
    (toUtcDate(toIso).getTime() - toUtcDate(fromIso).getTime()) / 86400000,
  );
}

function withDays(step: ActionStep, todayIso: string): ActionStep {
  if (!step.deadline) return step;
  return { ...step, daysUntil: daysBetween(todayIso, step.deadline) };
}

/**
 * Generates a personalized, ordered action checklist for the D/S → fixed-date
 * transition based on the student's specific profile and computed D/S status.
 *
 * Steps are pure data — completion state is stored separately in the DB.
 */
export function computeActionPlan(
  profile: {
    fullName: string;
    programEndDate: string;
    admissionDate: string;
    visaAdmissionType: 'D/S' | 'fixed-date';
    isStemEligible: boolean;
  },
  dsStatus: DsTransitionResult,
  todayIso: string,
): ActionStep[] {
  const isDs = dsStatus.regime === 'D/S';
  const steps: ActionStep[] = [];

  // ── Step 1: Verify I-94 ────────────────────────────────────────────────────
  steps.push(withDays({
    id: 'verify-i94',
    order: 1,
    category: 'verify',
    priority: 'critical',
    title: 'Verify your current I-94 record',
    description: isDs
      ? 'Log in to the CBP I-94 website and confirm your admission class shows "F-1 D/S". ' +
        'Screenshot and save this record — you will need it when the transition takes effect on September 15, 2026.'
      : 'Log in to the CBP I-94 website and confirm your I-94 expiration date matches your I-20 program end date. ' +
        'Any discrepancy should be reported to your DSO immediately.',
    citation: 'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
    resources: [
      { label: 'CBP I-94 Website', url: 'https://i94.cbp.dhs.gov' },
    ],
  }, todayIso));

  // ── Step 2: Contact DSO ────────────────────────────────────────────────────
  steps.push(withDays({
    id: 'contact-dso',
    order: 2,
    category: 'contact',
    priority: 'critical',
    title: 'Schedule a meeting with your DSO',
    description: isDs
      ? 'Your school\'s Designated School Official is your primary resource for the transition. ' +
        'Book an appointment now — DSO calendars fill up quickly before the September 15 deadline. ' +
        'Ask specifically about whether you need to file anything with USCIS and what your school recommends.'
      : 'Notify your DSO that you are on a fixed-date I-94. Ask them to verify your SEVIS record ' +
        'reflects the correct program end date and that no action is needed on your part.',
    resources: [],
  }, todayIso));

  // ── Step 3: Gather documents ───────────────────────────────────────────────
  steps.push(withDays({
    id: 'gather-documents',
    order: 3,
    category: 'document',
    priority: 'high',
    title: 'Gather and scan all key documents',
    description:
      'Collect and make digital copies of: current I-20 (all pages), passport (bio page + all F-1 visas), ' +
      'all I-94 printouts, any previous I-20s, SEVIS fee receipt, and DS-2019 if applicable. ' +
      'Store them in a secure cloud folder. You may need to provide these to USCIS or your DSO.',
    resources: [],
  }, todayIso));

  if (isDs && dsStatus.transitionDeadline) {
    // ── Step 4 (D/S only): Understand the filing decision ───────────────────
    steps.push(withDays({
      id: 'understand-filing-decision',
      order: 4,
      category: 'plan',
      priority: 'critical',
      title: 'Decide: stay D/S or transition to fixed-date?',
      description:
        'Students currently on D/S have until March 18, 2027 to file with USCIS if they want to ' +
        'remain under the D/S regime. However, most students will automatically move to the fixed-date ' +
        'regime after September 15, 2026. Talk to your DSO about which path applies to you and whether ' +
        'any filing is beneficial for your situation.',
      deadline: dsStatus.transitionDeadline,
      citation: 'DHS Final Rule, 90 FR 5854 — transition provisions',
      resources: [
        { label: 'USCIS F-1 Status Page', url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment' },
        { label: 'Federal Register Rule Text', url: 'https://www.federalregister.gov/documents/2025/01/17/2025-01053/enhancing-program-integrity-for-f-and-m-nonimmigrant-students' },
      ],
    }, todayIso));

    // ── Step 5 (D/S only): Sept 15 transition date prep ─────────────────────
    steps.push(withDays({
      id: 'sept15-prep',
      order: 5,
      category: 'track',
      priority: 'critical',
      title: 'Prepare for September 15, 2026 transition date',
      description:
        'After September 15, 2026, all new F-1 admissions will be on a fixed-date basis. ' +
        'If you are currently in the U.S. on D/S, your existing status is preserved until you depart and re-enter. ' +
        'Do NOT travel internationally near the transition date without consulting your DSO first — ' +
        're-entry after Sept 15 will result in a fixed-date I-94.',
      deadline: '2026-09-15',
      citation: 'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025); effective Sept. 15, 2026',
      resources: [],
    }, todayIso));
  }

  // ── Step: Track program end date ──────────────────────────────────────────
  steps.push(withDays({
    id: 'track-program-end',
    order: isDs ? 6 : 4,
    category: 'track',
    priority: 'high',
    title: `Track your program end date: ${profile.programEndDate}`,
    description:
      'Your I-20 program end date is the anchor for all subsequent deadlines. ' +
      'Under the fixed-date regime, this date (plus 60 days grace period) determines when you must ' +
      'depart, transfer to another program, or change status. Make sure your DSO has the correct date in SEVIS.',
    deadline: profile.programEndDate,
    citation: 'DHS Final Rule, 90 FR 5854; 8 CFR § 214.2(f)(5)(iv)',
    resources: [],
  }, todayIso));

  // ── Step: Grace period ────────────────────────────────────────────────────
  if (dsStatus.graceperiodEndDate) {
    steps.push(withDays({
      id: 'track-grace-period',
      order: isDs ? 7 : 5,
      category: 'track',
      priority: 'high',
      title: `Know your 60-day grace period end: ${dsStatus.graceperiodEndDate}`,
      description:
        'After your program end date, you have a 60-day grace period to depart the U.S., ' +
        'transfer to another school, or file for a change of status. ' +
        'You may NOT work during this grace period (OPT must be applied for separately). ' +
        'Mark this date in your calendar and begin planning at least 90 days in advance.',
      deadline: dsStatus.graceperiodEndDate,
      citation: '8 CFR § 214.2(f)(5)(iv); DHS Final Rule, 90 FR 5854',
      resources: [],
    }, todayIso));
  }

  // ── Step: Post-completion planning ───────────────────────────────────────
  const postOrder = isDs ? 8 : 6;
  steps.push(withDays({
    id: 'post-completion-plan',
    order: postOrder,
    category: 'plan',
    priority: 'medium',
    title: profile.isStemEligible
      ? 'Plan for OPT and STEM OPT extension'
      : 'Plan for OPT or departure after program completion',
    description: profile.isStemEligible
      ? 'As a STEM-eligible student, you can apply for OPT (up to 12 months) and then a 24-month STEM extension. ' +
        'Apply for OPT up to 90 days before your program end date. Start the STEM extension process ' +
        'at least 90 days before your OPT EAD expires. Both require Form I-765.'
      : 'Apply for OPT up to 90 days before your program end date. Submit Form I-765 through your DSO ' +
        'and allow 3–5 months for USCIS processing. If you do not apply for OPT, ' +
        'arrange departure or a transfer before your grace period ends.',
    resources: [
      { label: 'USCIS Form I-765', url: 'https://www.uscis.gov/i-765' },
      { label: 'OPT Overview (USCIS)', url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students' },
    ],
  }, todayIso));

  return steps.sort((a, b) => a.order - b.order);
}
