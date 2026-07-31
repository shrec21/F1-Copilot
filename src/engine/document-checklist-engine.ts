export type DocumentStatus = 'not-started' | 'located' | 'scanned' | 'submitted';

export interface DocumentItem {
  id: string;
  order: number;
  category: 'identity' | 'immigration' | 'academic' | 'employment' | 'financial';
  name: string;
  description: string;
  whyNeeded: string;
  requiredForDsTransition: boolean;
  conditional?: string;   // shown when the doc only applies in certain situations
  resource?: { label: string; url: string };
}

/**
 * Canonical list of documents relevant to F-1 / D/S transition compliance.
 * Ordered by priority (identity & core immigration first).
 */
export const DOCUMENT_LIST: DocumentItem[] = [
  {
    id: 'i94-printout',
    order: 1,
    category: 'immigration',
    name: 'I-94 Admission Record (printout)',
    description: 'Official CBP record of your most recent entry. Shows admission class (F-1 D/S or fixed-date) and expiration.',
    whyNeeded: 'Primary proof of your current status and the starting point for any transition analysis. DSOs and USCIS request this first.',
    requiredForDsTransition: true,
    resource: { label: 'Get I-94 from CBP', url: 'https://i94.cbp.dhs.gov' },
  },
  {
    id: 'passport-bio',
    order: 2,
    category: 'identity',
    name: 'Passport bio page (color copy)',
    description: 'Photo page of your current, valid passport.',
    whyNeeded: 'Required for any USCIS filing or DSO verification. Must be valid for at least 6 months beyond your program end date.',
    requiredForDsTransition: true,
  },
  {
    id: 'f1-visa-stamps',
    order: 3,
    category: 'immigration',
    name: 'All F-1 visa stamp pages',
    description: 'Copies of every F-1 visa stamp in your current and expired passports.',
    whyNeeded: 'Shows your complete entry history and confirms visa class at each admission.',
    requiredForDsTransition: true,
  },
  {
    id: 'current-i20',
    order: 4,
    category: 'immigration',
    name: 'Current I-20 (all pages)',
    description: 'Your most recently issued I-20, signed by your DSO on page 2.',
    whyNeeded: 'The I-20 is your legal program authorization document. Must be current and DSO-signed within the last 12 months for travel.',
    requiredForDsTransition: true,
  },
  {
    id: 'previous-i20s',
    order: 5,
    category: 'immigration',
    name: 'All previous I-20s',
    description: 'Every I-20 issued to you since first entering F-1 status.',
    whyNeeded: 'Establishes your complete program history. Needed if USCIS questions any gap or transfer.',
    requiredForDsTransition: false,
  },
  {
    id: 'sevis-fee-receipt',
    order: 6,
    category: 'immigration',
    name: 'SEVIS fee receipt (Form I-901)',
    description: 'Confirmation email or PDF from FMJfee.com showing the $350 SEVIS fee was paid.',
    whyNeeded: 'Proof of SEVIS enrollment. Required for any USCIS filing that references your SEVIS ID.',
    requiredForDsTransition: false,
    resource: { label: 'FMJfee.com', url: 'https://www.fmjfee.com' },
  },
  {
    id: 'unofficial-transcript',
    order: 7,
    category: 'academic',
    name: 'Unofficial academic transcript',
    description: 'Current transcript showing enrollment status and GPA.',
    whyNeeded: 'Required for OPT/CPT applications through your DSO. Also used to verify full-time enrollment.',
    requiredForDsTransition: false,
  },
  {
    id: 'i765-application',
    order: 8,
    category: 'immigration',
    name: 'Form I-765 (OPT application)',
    description: 'Application for Employment Authorization — filed with USCIS for OPT or STEM OPT.',
    whyNeeded: 'If you have applied or plan to apply for OPT, keep a copy of the filed I-765 and the USCIS receipt notice.',
    requiredForDsTransition: false,
    conditional: 'Only if you have applied for or plan to apply for OPT/STEM-OPT.',
    resource: { label: 'USCIS Form I-765', url: 'https://www.uscis.gov/i-765' },
  },
  {
    id: 'ead-card',
    order: 9,
    category: 'employment',
    name: 'EAD card (front and back copy)',
    description: 'Your Employment Authorization Document issued by USCIS for OPT or STEM-OPT.',
    whyNeeded: 'Primary proof of work authorization. Must be presented to employers and kept current.',
    requiredForDsTransition: false,
    conditional: 'Only if you have been approved for OPT or STEM-OPT.',
  },
  {
    id: 'cpt-authorization-letter',
    order: 10,
    category: 'employment',
    name: 'CPT authorization letter(s)',
    description: 'Official CPT endorsement from your school on your I-20, plus any employer offer letters used for CPT approval.',
    whyNeeded: 'Proves each CPT period was properly authorized. Needed if your CPT history affects OPT eligibility.',
    requiredForDsTransition: false,
    conditional: 'Only if you have done or are doing CPT.',
  },
  {
    id: 'uscis-notices',
    order: 11,
    category: 'immigration',
    name: 'All USCIS approval notices (I-797)',
    description: 'Any I-797 notices received from USCIS (change of status, extension, etc.).',
    whyNeeded: 'Documents any changes to your status history. Required if you have ever filed with USCIS.',
    requiredForDsTransition: false,
    conditional: 'Only if you have previously filed any petition with USCIS.',
  },
];
