/**
 * Canonical list of regulatory source pages monitored by the watcher.
 *
 * Each entry maps a URL to the ComplianceRule IDs (from packages/rule-engine)
 * that cite it. When the watcher detects a content change on a URL, it opens
 * a review ticket listing the affected rule IDs so a human knows which rules
 * to examine.
 *
 * To add a new source: append an entry here and re-deploy. The watcher will
 * bootstrap a baseline snapshot on its next run before raising any tickets.
 */

export interface WatcherSource {
  /** Stable identifier used as a DB key. Never change once deployed. */
  id: string;
  url: string;
  description: string;
  /** Rule IDs from packages/rule-engine/src/rules/ that cite this source. */
  affectedRuleIds: string[];
}

export const SOURCES: WatcherSource[] = [
  {
    id: 'ecfr-214-2',
    url: 'https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2',
    description: '8 CFR § 214.2 — the authoritative regulatory text for all F-1 rules. '
      + 'All 8 of our ComplianceRule entries cite subsections of this page.',
    affectedRuleIds: [
      'opt-unemployment-90',
      'opt-unemployment-150-stem',
      'grace-period-60-day',
      'cpt-full-time-opt-bar',
      'stem-i983-reporting',
      'opt-application-window',
      'cpt-authorization-prior',
      'stem-employer-everify',
    ],
  },
  {
    id: 'uscis-opt',
    url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students',
    description: 'USCIS plain-language OPT guidance. May reflect policy updates '
      + 'before they appear in the CFR (e.g. enforcement memos, COVID-era flexibilities).',
    affectedRuleIds: [
      'opt-unemployment-90',
      'opt-application-window',
      'grace-period-60-day',
    ],
  },
  {
    id: 'uscis-stem-opt',
    url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt',
    description: 'USCIS STEM OPT guidance page. Covers the 24-month extension, '
      + 'E-Verify requirement, and I-983 reporting cycle.',
    affectedRuleIds: [
      'opt-unemployment-150-stem',
      'stem-i983-reporting',
      'stem-employer-everify',
    ],
  },
  {
    id: 'sevp-cpt',
    url: 'https://studyinthestates.dhs.gov/sevis-help-hub/student-records/fm-student-employment/curricular-practical-training-cpt',
    description: 'SEVP Study in the States — CPT guidance. Covers authorization '
      + 'requirements and the 12-month full-time CPT bar on OPT eligibility.',
    affectedRuleIds: [
      'cpt-full-time-opt-bar',
      'cpt-authorization-prior',
    ],
  },
  {
    id: 'sevp-i983',
    url: 'https://studyinthestates.dhs.gov/stem-opt-hub/for-students/students-and-the-form-i-983',
    description: 'SEVP guidance on the I-983 Training Plan. Covers the 12-month '
      + 'self-evaluation reporting cycle required for STEM OPT students.',
    affectedRuleIds: [
      'stem-i983-reporting',
    ],
  },
];
