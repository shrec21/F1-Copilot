export interface DateRange {
  start: string;  // ISO 8601 date, e.g. "2024-01-15"
  end?: string;   // ISO 8601 date; absent means "currently ongoing"
}

export interface Role {
  id: string;
  authorizationType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer: string;
  hoursPerWeek: number;
  period: DateRange;
  cptType?: 'full-time' | 'part-time';  // required when authorizationType === 'CPT'
}

export interface Conflict {
  roleIds: [string, string];
  overlapStart: string;   // ISO 8601 date
  overlapEnd: string;     // ISO 8601 date (same as overlapStart for single-day overlap)
  ruleId: string;         // slug from RuleEntry.id that is violated
  description: string;    // human-readable explanation
}
