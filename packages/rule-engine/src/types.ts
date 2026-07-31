// Core domain types for the F-1 compliance rule engine.
// All types are plain data — no methods, no classes.

export interface Student {
  id: string;
  fullName: string;
  sevisId: string;
  programLevel: 'bachelors' | 'masters' | 'phd' | 'other';
  major: string;
  isStemDesignated: boolean;
  programStartDate: string;    // ISO 8601
  programEndDate: string;      // ISO 8601
  admissionType: 'D/S' | 'fixed-date';
  i94AdmissionDate: string;    // ISO 8601
  i94ExpiryDate: string | null; // null when admissionType is 'D/S'
}

export interface EmploymentPeriod {
  id: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer: string;
  hoursPerWeek: number;
  startDate: string;           // ISO 8601
  endDate: string | null;      // null = currently employed
  cptType?: 'full-time' | 'part-time'; // required when authType is 'CPT'
  // Whether the employer has confirmed E-Verify enrollment.
  // undefined = not yet verified by student. Required for STEM-OPT.
  employerEverifyEnrolled?: boolean;
}

export interface AuthorizationPeriod {
  id: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer?: string;           // required for CPT
  startDate: string;           // ISO 8601 (EAD start date for OPT/STEM-OPT)
  endDate: string;             // ISO 8601 (EAD end date for OPT/STEM-OPT)
}

// Passed alongside Student to each rule function.
export interface RuleContext {
  employmentPeriods: EmploymentPeriod[];
  authorizations: AuthorizationPeriod[];
  // Dates on which the student submitted Form I-983 to their DSO.
  stemI983Submissions: string[]; // ISO 8601 dates, sorted ascending
}

// Definition of one compliance rule, versioned and citable.
export interface ComplianceRule {
  id: string;
  version: number;
  title: string;
  sourceCitation: string; // e.g. "8 CFR § 214.2(f)(10)(ii)(A)"
  effectiveDate: string;  // ISO 8601 date the cited regulation took effect
  supersedes: string | null; // "<id>@v<n>" of the rule this replaces, or null
}

export type RuleStatus = 'pass' | 'warning' | 'violation' | 'not-applicable';

// Returned by every rule function. Inputs are snapshotted so the audit
// record is self-contained — no re-query needed to understand why it fired.
export interface RuleResult {
  rule: ComplianceRule;
  studentId: string;
  status: RuleStatus;
  computedAt: string;                  // ISO 8601 timestamp
  inputs: Record<string, unknown>;     // snapshot of values used at evaluation
  outputs: Record<string, unknown>;    // computed values, e.g. { daysUsed: 72 }
  message: string;                     // terse, deterministic — NOT LLM-generated
}

// Domain events written to the outbox alongside the triggering state change
// (same DB transaction — transactional outbox pattern).
export type ComplianceEventType =
  | 'employment.started'
  | 'employment.ended'
  | 'authorization.added'
  | 'profile.updated'
  | 'travel.departed'
  | 'travel.returned';

export interface ComplianceEvent {
  id: string;
  type: ComplianceEventType;
  studentId: string;
  occurredAt: string;                  // ISO 8601
  payload: Record<string, unknown>;
}

// Immutable audit record. One row per (event, rule) pair.
// Append-only — never updated or deleted.
export interface AuditEntry {
  id: string;
  studentId: string;
  eventId: string;
  rule: ComplianceRule;
  status: RuleStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  createdAt: string;                   // ISO 8601
}
