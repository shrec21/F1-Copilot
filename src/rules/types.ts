export interface RuleEntry {
  id: string;           // stable slug, e.g. "standard-opt-unemployment-cap"
  summary: string;      // one sentence, plain English
  threshold?: number;   // numeric limit if applicable (days, months)
  unit?: 'days' | 'months';
  citation: string;     // e.g. "8 CFR § 214.2(f)(10)(ii)"
  deadline?: string;    // ISO 8601 date for rules that carry a specific deadline
}

export interface RuleFile {
  topic: string;           // machine key, e.g. "opt-unemployment"
  effective_date: string;  // ISO 8601, e.g. "2024-01-01"
  source_url: string;      // canonical federal/SEVP URL
  disclaimer: string;      // full disclaimer text shown in UI for this rule topic
  rules: RuleEntry[];
}
