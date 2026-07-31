export type ScenarioId =
  | 'new-admission-post-sept15'
  | 'fixed-date-pre-transition'
  | 'ds-staying'
  | 'ds-travel-before-sept15'
  | 'ds-travel-after-sept15'
  | 'ds-deadline-passed';

export type OutcomeSeverity = 'safe' | 'action-required' | 'critical' | 'info';

export interface ScenarioRisk {
  title: string;
  detail: string;
}

export interface ScenarioAction {
  order: number;
  text: string;
  deadline?: string;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  outcome: string;
  outcomeSeverity: OutcomeSeverity;
  keyFacts: string[];
  risks: ScenarioRisk[];
  actions: ScenarioAction[];
  citations: string[];
  /**
   * Conditions in plain English — shown in the reference matrix so any
   * student can identify which scenario matches their situation.
   */
  appliesWhen: string;
}

/** The canonical D/S transition scenario matrix. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'new-admission-post-sept15',
    title: 'New admission after September 15, 2026',
    subtitle: 'You have always been on fixed-date. The transition does not apply to you.',
    appliesWhen: 'Your most recent I-94 admission date is on or after September 15, 2026.',
    outcome: 'Your I-94 shows a specific expiration date equal to your I-20 program end date plus 60 days. No transition action required.',
    outcomeSeverity: 'safe',
    keyFacts: [
      'All F-1 admissions on or after Sept 15, 2026 are automatically on fixed-date.',
      'Your I-94 will expire on your program end date plus a 60-day grace period.',
      'You must depart, transfer, or change status before your I-94 expires.',
      'OPT authorization extends your ability to stay and work beyond the program end date.',
    ],
    risks: [
      {
        title: 'I-94 / I-20 mismatch',
        detail: 'If your I-94 expiration does not match your I-20 program end date + 60 days, report the discrepancy to your DSO immediately.',
      },
      {
        title: 'Grace period misunderstood',
        detail: 'The 60-day grace period is for departure, transfer, or status change only — you may not work during it without OPT authorization.',
      },
    ],
    actions: [
      { order: 1, text: 'Print and verify your I-94 at i94.cbp.dhs.gov — confirm the expiration date.' },
      { order: 2, text: 'Compare your I-94 expiration to your I-20 program end date + 60 days.' },
      { order: 3, text: 'Apply for OPT at least 90 days before your program end date if you plan to work after graduation.', deadline: undefined },
      { order: 4, text: 'Plan your departure or status change at least 30 days before your grace period ends.' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
      '8 CFR § 214.2(f)(5)(iv) — 60-day grace period',
    ],
  },

  {
    id: 'fixed-date-pre-transition',
    title: 'Already on fixed-date admission (pre-Sept 15)',
    subtitle: 'You are already in the new regime. The September 15 transition does not require any filing from you.',
    appliesWhen: 'Your most recent I-94 shows a fixed expiration date (not "D/S") and you were admitted before September 15, 2026.',
    outcome: 'Your current fixed-date I-94 remains valid. No USCIS filing is needed for the transition. You are effectively already under the new rules.',
    outcomeSeverity: 'safe',
    keyFacts: [
      'Your I-94 already has a specific expiration date tied to your program end date.',
      'The March 18, 2027 USCIS filing deadline applies only to students on D/S — not to you.',
      'When you travel and re-enter, you will receive another fixed-date I-94 (as always).',
      'Your 60-day grace period begins on your I-20 program end date.',
    ],
    risks: [
      {
        title: 'I-94 expiration tracking',
        detail: 'Unlike D/S students, you have a hard expiration date. Missing it — even by one day — puts you out of status. Set a calendar reminder.',
      },
      {
        title: 'Re-entry after program end',
        detail: 'If you travel after your program end date, CBP may not admit you in F-1 status without an active OPT EAD or new I-20.',
      },
    ],
    actions: [
      { order: 1, text: 'Confirm your I-94 expiration at i94.cbp.dhs.gov.' },
      { order: 2, text: 'Add your I-94 expiration and program end date to your calendar with 60-day and 30-day reminders.' },
      { order: 3, text: 'Apply for OPT 90 days before your program end date if you plan to work after graduation.' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
      '8 CFR § 214.2(f)(5)',
    ],
  },

  {
    id: 'ds-staying',
    title: 'D/S student — remaining in the U.S. through the transition',
    subtitle: 'Your D/S status is preserved while you stay. You have until March 18, 2027 to decide whether to file with USCIS.',
    appliesWhen: 'You are currently admitted D/S, your I-94 shows "D/S", you were admitted before September 15, 2026, and you are not planning international travel.',
    outcome: 'Your existing D/S status continues uninterrupted while you remain in the U.S. However, any departure and re-entry after September 15 converts you to fixed-date automatically.',
    outcomeSeverity: 'action-required',
    keyFacts: [
      'Remaining in the U.S. continuously preserves your D/S status — there is no automatic conversion on Sept 15 for students already inside the U.S.',
      'If you want to formally remain under D/S, you must file with USCIS by March 18, 2027.',
      'If you do NOT file, USCIS will treat your status as fixed-date going forward — which for most students is fine.',
      'D/S status gives no specific expiration date on your I-94; fixed-date gives a hard expiry tied to your program end date.',
      'Consult your DSO about whether filing with USCIS is right for your specific situation.',
    ],
    risks: [
      {
        title: 'International travel converts your status',
        detail: 'Any departure from the U.S. and re-entry after September 15, 2026 will result in a fixed-date I-94 at the port of entry. Plan travel carefully.',
      },
      {
        title: 'Missing the March 2027 filing deadline',
        detail: 'If you miss the March 18, 2027 deadline without filing, USCIS will not grant you D/S status going forward. This is not necessarily harmful but is irreversible.',
      },
      {
        title: 'Confusion at port of entry',
        detail: 'CBP officers may not be fully trained on transition edge cases. Carry all your documents and know your I-20 program end date.',
      },
    ],
    actions: [
      { order: 1, text: 'Print your current I-94 and confirm it shows "D/S".' },
      { order: 2, text: 'Book a meeting with your DSO this week to discuss whether you should file with USCIS.' },
      { order: 3, text: 'Gather your full document set (I-20s, passport, I-94 history) before the September 15 deadline.', deadline: '2026-09-15' },
      { order: 4, text: 'If you plan to travel internationally, do so before September 15 or accept a fixed-date I-94 on re-entry.' },
      { order: 5, text: 'Decide by January 2027 whether to file with USCIS to preserve D/S.', deadline: '2027-01-31' },
      { order: 6, text: 'File with USCIS (if applicable) before the March 18, 2027 deadline.', deadline: '2027-03-18' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025) — transition provisions',
      '8 CFR § 214.2(f)(5)',
    ],
  },

  {
    id: 'ds-travel-before-sept15',
    title: 'D/S student — re-entering the U.S. before September 15',
    subtitle: 'You will receive a D/S admission as usual. Make sure you are back before the transition date.',
    appliesWhen: 'You are on D/S, you have traveled or plan to travel abroad, and your return to the U.S. is before September 15, 2026.',
    outcome: 'CBP will admit you under D/S at the port of entry — the same as before. Your I-94 will again show "D/S". No change to your status.',
    outcomeSeverity: 'action-required',
    keyFacts: [
      'Ports of entry will continue to admit F-1 D/S students as D/S until September 14, 2026.',
      'Your I-20 must be valid and signed by your DSO within the last 12 months for travel.',
      'F-1 visa stamp must be valid for entry (or you must use automatic revalidation from Canada/Mexico).',
      'Book return travel with a meaningful buffer before September 15 — flight delays could push you past the date.',
    ],
    risks: [
      {
        title: 'Flight delay past September 15',
        detail: 'If your return is delayed past September 15 (flight cancellation, layover, etc.), CBP will issue a fixed-date I-94. Have contingency plans.',
      },
      {
        title: 'Expired or unsigned I-20',
        detail: 'CBP will not admit you if your I-20 is expired or lacks a DSO travel signature within the last 12 months. Verify before departure.',
      },
    ],
    actions: [
      { order: 1, text: 'Confirm your return flight arrives in the U.S. before September 14 with buffer for delays.' },
      { order: 2, text: 'Get your I-20 signed by your DSO before you depart — signature must be within 12 months.' },
      { order: 3, text: 'Carry copies of I-94 history, all I-20s, and your F-1 visa at the port of entry.' },
      { order: 4, text: 'After re-entry, print your new I-94 and verify it shows "D/S".' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
      '8 CFR § 214.2(f)(3) — admission documentation',
    ],
  },

  {
    id: 'ds-travel-after-sept15',
    title: 'D/S student — re-entering the U.S. after September 15',
    subtitle: 'You will receive a fixed-date I-94 on re-entry. Your I-94 will expire on your program end date + 60 days.',
    appliesWhen: 'You are currently on D/S, and you are planning to travel abroad and re-enter the U.S. on or after September 15, 2026.',
    outcome: 'CBP will issue a fixed-date I-94 with an expiration equal to your I-20 program end date plus 60 days. You will no longer be on D/S after this re-entry.',
    outcomeSeverity: 'action-required',
    keyFacts: [
      'After September 15, 2026, all F-1 re-entries result in fixed-date I-94s — there are no exceptions.',
      'Your new I-94 will expire on your program end date + 60-day grace period.',
      'This is not a status violation — it is the new normal for F-1 students.',
      'The March 18, 2027 USCIS filing window no longer applies once you have a fixed-date I-94.',
      'Your OPT eligibility is not affected by the switch from D/S to fixed-date.',
    ],
    risks: [
      {
        title: 'Hard expiration date you must track',
        detail: 'Unlike D/S, your new fixed-date I-94 has a specific expiration. If you remain in the U.S. past this date without OPT or a change of status, you are out of status.',
      },
      {
        title: 'I-20 must match new I-94',
        detail: 'After re-entry, verify your I-20 program end date is consistent with your new I-94 expiration. Any mismatch should be reported to your DSO.',
      },
    ],
    actions: [
      { order: 1, text: 'Get your I-20 signed by your DSO before departure — valid signature required for re-entry.' },
      { order: 2, text: 'Upon re-entry, accept the fixed-date I-94 — this is expected and correct.' },
      { order: 3, text: 'Print your new I-94 at i94.cbp.dhs.gov and verify it shows your program end date + 60 days.' },
      { order: 4, text: 'Set a calendar reminder for your I-94 expiration date with a 60-day warning.' },
      { order: 5, text: 'If you plan to work after graduation, begin the OPT application process at least 90 days before your program end date.' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025)',
      '8 CFR § 214.2(f)(5)(iv)',
    ],
  },

  {
    id: 'ds-deadline-passed',
    title: 'D/S student — March 2027 filing deadline passed',
    subtitle: 'The window to file with USCIS has closed. You are now treated as a fixed-date student.',
    appliesWhen: 'You were on D/S before September 15, 2026, remained in the U.S., and the March 18, 2027 USCIS filing deadline has passed without filing.',
    outcome: 'USCIS will treat your status as fixed-date going forward. Your program end date + 60-day grace period is now your effective "expiration". Consult your DSO immediately.',
    outcomeSeverity: 'critical',
    keyFacts: [
      'The March 18, 2027 filing deadline was a one-time window — it cannot be reopened.',
      'For most students, the transition to fixed-date is not harmful; it simply means you now have a hard deadline.',
      'Your OPT eligibility is not affected.',
      'If you are past your program end date + 60 days, you may be out of status — consult an attorney immediately.',
    ],
    risks: [
      {
        title: 'Potential status ambiguity',
        detail: 'Your I-94 may still show "D/S" but USCIS treats you as fixed-date. This discrepancy should be resolved with your DSO.',
      },
      {
        title: 'Travel risk',
        detail: 'Traveling internationally now and re-entering may expose the ambiguity at the port of entry. Consult your DSO before any travel.',
      },
    ],
    actions: [
      { order: 1, text: 'Contact your DSO immediately to review your current status.' },
      { order: 2, text: 'Consult an immigration attorney if you are unsure whether you are in status.' },
      { order: 3, text: 'Do not travel internationally without consulting your DSO and an attorney first.' },
      { order: 4, text: 'Calculate whether you are within your program end date + 60-day grace window.' },
    ],
    citations: [
      'DHS Final Rule, 90 FR 5854 (Jan. 17, 2025) — transition provisions',
      '8 CFR § 214.2(f)(5)',
    ],
  },
];

const TRANSITION_DATE = '2026-09-15';
const DS_FILING_DEADLINE = '2027-03-18';

/**
 * Detects which scenario best matches the student's current situation.
 * Returns null if the profile does not have enough information.
 */
export function detectScenario(
  admissionDate: string,
  visaAdmissionType: 'D/S' | 'fixed-date',
  todayIso: string,
): ScenarioId {
  // Admitted on or after transition date → always fixed-date, new regime
  if (admissionDate >= TRANSITION_DATE) {
    return 'new-admission-post-sept15';
  }

  // Pre-transition, already on fixed-date
  if (visaAdmissionType === 'fixed-date') {
    return 'fixed-date-pre-transition';
  }

  // Pre-transition, on D/S
  // Check if the March 2027 filing deadline has passed
  if (todayIso > DS_FILING_DEADLINE) {
    return 'ds-deadline-passed';
  }

  // Default for active D/S students
  return 'ds-staying';
}
