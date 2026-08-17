import { db } from './schema';
import type { Role, DateRange } from '../engine/types';

export function upsertUserProfile(profile: {
  fullName: string;
  programEndDate: string;
  degreeLevel: string;
  visaAdmissionType: 'D/S' | 'fixed-date';
  admissionDate: string;
  isStemEligible: boolean;
}): void {
  db.prepare(`
    INSERT OR REPLACE INTO user_profile
      (id, full_name, program_end_date, degree_level, visa_admission_type, admission_date, is_stem_eligible)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(
    profile.fullName,
    profile.programEndDate,
    profile.degreeLevel,
    profile.visaAdmissionType,
    profile.admissionDate,
    profile.isStemEligible ? 1 : 0,
  );
}

export function getUserProfile(): {
  fullName: string;
  programEndDate: string;
  degreeLevel: string;
  visaAdmissionType: 'D/S' | 'fixed-date';
  admissionDate: string;
  isStemEligible: boolean;
} | null {
  const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as {
    id: number;
    full_name: string;
    program_end_date: string;
    degree_level: string;
    visa_admission_type: string;
    admission_date: string;
    is_stem_eligible: number;
  } | undefined;

  if (!row) return null;

  return {
    fullName: row.full_name,
    programEndDate: row.program_end_date,
    degreeLevel: row.degree_level,
    visaAdmissionType: row.visa_admission_type as 'D/S' | 'fixed-date',
    admissionDate: row.admission_date,
    isStemEligible: row.is_stem_eligible === 1,
  };
}

export function insertEmploymentPeriod(period: {
  employer: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  cptType?: 'full-time' | 'part-time';
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO employment_periods
      (employer, auth_type, cpt_type, hours_per_week, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    period.employer,
    period.authType,
    period.cptType ?? null,
    period.hoursPerWeek,
    period.startDate,
    period.endDate ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function getAllEmploymentPeriods(): Role[] {
  const rows = db.prepare('SELECT * FROM employment_periods').all() as Array<{
    id: number;
    employer: string;
    auth_type: string;
    cpt_type: string | null;
    hours_per_week: number;
    start_date: string;
    end_date: string | null;
  }>;

  return rows.map(row => ({
    id: String(row.id),
    authorizationType: row.auth_type as 'CPT' | 'OPT' | 'STEM-OPT',
    employer: row.employer,
    hoursPerWeek: row.hours_per_week,
    period: { start: row.start_date, end: row.end_date ?? undefined },
    cptType: (row.cpt_type ?? undefined) as 'full-time' | 'part-time' | undefined,
  }));
}

export function updateEmploymentPeriod(id: number, period: {
  employer: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  cptType?: 'full-time' | 'part-time';
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
}): boolean {
  const result = db.prepare(`
    UPDATE employment_periods
    SET employer = ?, auth_type = ?, cpt_type = ?, hours_per_week = ?, start_date = ?, end_date = ?
    WHERE id = ?
  `).run(
    period.employer,
    period.authType,
    period.cptType ?? null,
    period.hoursPerWeek,
    period.startDate,
    period.endDate ?? null,
    id,
  );
  return result.changes > 0;
}

export function deleteEmploymentPeriod(id: number): boolean {
  const result = db.prepare('DELETE FROM employment_periods WHERE id = ?').run(id);
  return result.changes > 0;
}

export function insertAuthorization(auth: {
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer?: string;
  startDate: string;
  endDate: string;
}): number {
  const result = db.prepare(`
    INSERT INTO authorizations (auth_type, employer, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `).run(
    auth.authType,
    auth.employer ?? null,
    auth.startDate,
    auth.endDate,
  );
  return Number(result.lastInsertRowid);
}

export interface AuthorizationRecord {
  id: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer?: string;
  startDate: string;
  endDate: string;
}

export function getAllAuthorizations(): AuthorizationRecord[] {
  const rows = db.prepare('SELECT * FROM authorizations ORDER BY start_date ASC').all() as Array<{
    id: number;
    auth_type: string;
    employer: string | null;
    start_date: string;
    end_date: string;
  }>;

  return rows.map(row => ({
    id: String(row.id),
    authType: row.auth_type as 'CPT' | 'OPT' | 'STEM-OPT',
    employer: row.employer ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export function getActionStepCompletions(): Record<string, boolean> {
  const rows = db.prepare('SELECT step_id, completed FROM action_step_completions').all() as Array<{
    step_id: string;
    completed: number;
  }>;
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[row.step_id] = row.completed === 1;
  }
  return result;
}

export function toggleActionStep(stepId: string, completed: boolean, completedAt: string | null): void {
  db.prepare(`
    INSERT INTO action_step_completions (step_id, completed, completed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(step_id) DO UPDATE SET completed = excluded.completed, completed_at = excluded.completed_at
  `).run(stepId, completed ? 1 : 0, completedAt);
}

export interface DocumentStatusRow {
  docId: string;
  status: 'not-started' | 'located' | 'scanned' | 'submitted';
  notes: string | null;
  updatedAt: string | null;
}

export function getAllDocumentStatuses(): Record<string, DocumentStatusRow> {
  const rows = db.prepare('SELECT doc_id, status, notes, updated_at FROM document_statuses').all() as Array<{
    doc_id: string;
    status: string;
    notes: string | null;
    updated_at: string | null;
  }>;
  const result: Record<string, DocumentStatusRow> = {};
  for (const row of rows) {
    result[row.doc_id] = {
      docId: row.doc_id,
      status: row.status as DocumentStatusRow['status'],
      notes: row.notes,
      updatedAt: row.updated_at,
    };
  }
  return result;
}

export function upsertDocumentStatus(
  docId: string,
  status: 'not-started' | 'located' | 'scanned' | 'submitted',
  notes: string | null,
  updatedAt: string,
): void {
  db.prepare(`
    INSERT INTO document_statuses (doc_id, status, notes, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(doc_id) DO UPDATE SET
      status = excluded.status,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(docId, status, notes, updatedAt);
}

// --- Synthetic cohort queries ---

import type { Student, EmploymentPeriod, AuthorizationPeriod, RuleContext } from '@f1/rule-engine';

export function insertStudent(s: Student): void {
  db.prepare(`
    INSERT OR REPLACE INTO students
      (id, full_name, sevis_id, program_level, major, is_stem_designated,
       program_start_date, program_end_date, admission_type, i94_admission_date, i94_expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.id, s.fullName, s.sevisId, s.programLevel, s.major,
    s.isStemDesignated ? 1 : 0,
    s.programStartDate, s.programEndDate, s.admissionType,
    s.i94AdmissionDate, s.i94ExpiryDate ?? null,
  );
}

export function getAllStudents(): Student[] {
  const rows = db.prepare('SELECT * FROM students ORDER BY full_name').all() as Array<{
    id: string; full_name: string; sevis_id: string; program_level: string;
    major: string; is_stem_designated: number; program_start_date: string;
    program_end_date: string; admission_type: string; i94_admission_date: string;
    i94_expiry_date: string | null;
  }>;
  return rows.map(r => ({
    id: r.id, fullName: r.full_name, sevisId: r.sevis_id,
    programLevel: r.program_level as Student['programLevel'],
    major: r.major, isStemDesignated: r.is_stem_designated === 1,
    programStartDate: r.program_start_date, programEndDate: r.program_end_date,
    admissionType: r.admission_type as Student['admissionType'],
    i94AdmissionDate: r.i94_admission_date, i94ExpiryDate: r.i94_expiry_date,
  }));
}

export function getStudentById(id: string): Student | null {
  const r = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as {
    id: string; full_name: string; sevis_id: string; program_level: string;
    major: string; is_stem_designated: number; program_start_date: string;
    program_end_date: string; admission_type: string; i94_admission_date: string;
    i94_expiry_date: string | null;
  } | undefined;
  if (!r) return null;
  return {
    id: r.id, fullName: r.full_name, sevisId: r.sevis_id,
    programLevel: r.program_level as Student['programLevel'],
    major: r.major, isStemDesignated: r.is_stem_designated === 1,
    programStartDate: r.program_start_date, programEndDate: r.program_end_date,
    admissionType: r.admission_type as Student['admissionType'],
    i94AdmissionDate: r.i94_admission_date, i94ExpiryDate: r.i94_expiry_date,
  };
}

export function insertStudentEmployment(studentId: string, ep: EmploymentPeriod): void {
  db.prepare(`
    INSERT OR REPLACE INTO student_employment
      (id, student_id, auth_type, employer, hours_per_week, start_date, end_date, cpt_type, employer_everify_enrolled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ep.id, studentId, ep.authType, ep.employer, ep.hoursPerWeek,
    ep.startDate, ep.endDate ?? null, ep.cptType ?? null,
    ep.employerEverifyEnrolled === undefined ? null : ep.employerEverifyEnrolled ? 1 : 0,
  );
}

export function insertStudentAuthorization(studentId: string, a: AuthorizationPeriod): void {
  db.prepare(`
    INSERT OR REPLACE INTO student_authorizations
      (id, student_id, auth_type, employer, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(a.id, studentId, a.authType, a.employer ?? null, a.startDate, a.endDate);
}

export function insertStudentI983Submission(studentId: string, submittedAt: string): void {
  const id = `${studentId}-i983-${submittedAt}`;
  db.prepare(`
    INSERT OR IGNORE INTO student_i983_submissions (id, student_id, submitted_at)
    VALUES (?, ?, ?)
  `).run(id, studentId, submittedAt);
}

export function getRuleContextForStudent(studentId: string): RuleContext {
  const empRows = db.prepare(
    'SELECT * FROM student_employment WHERE student_id = ? ORDER BY start_date',
  ).all(studentId) as Array<{
    id: string; auth_type: string; employer: string; hours_per_week: number;
    start_date: string; end_date: string | null; cpt_type: string | null;
    employer_everify_enrolled: number | null;
  }>;

  const authRows = db.prepare(
    'SELECT * FROM student_authorizations WHERE student_id = ? ORDER BY start_date',
  ).all(studentId) as Array<{
    id: string; auth_type: string; employer: string | null; start_date: string; end_date: string;
  }>;

  const i983Rows = db.prepare(
    'SELECT submitted_at FROM student_i983_submissions WHERE student_id = ? ORDER BY submitted_at',
  ).all(studentId) as Array<{ submitted_at: string }>;

  return {
    employmentPeriods: empRows.map(r => ({
      id: r.id,
      authType: r.auth_type as EmploymentPeriod['authType'],
      employer: r.employer,
      hoursPerWeek: r.hours_per_week,
      startDate: r.start_date,
      endDate: r.end_date,
      cptType: (r.cpt_type ?? undefined) as EmploymentPeriod['cptType'],
      employerEverifyEnrolled:
        r.employer_everify_enrolled === null ? undefined : r.employer_everify_enrolled === 1,
    })),
    authorizations: authRows.map(r => ({
      id: r.id,
      authType: r.auth_type as AuthorizationPeriod['authType'],
      employer: r.employer ?? undefined,
      startDate: r.start_date,
      endDate: r.end_date,
    })),
    stemI983Submissions: i983Rows.map(r => r.submitted_at),
  };
}

// --- Outbox + audit trail ---

export function insertOutboxEvent(event: {
  id: string; type: string; studentId: string; payload: Record<string, unknown>; createdAt: string;
}): void {
  db.prepare(`
    INSERT INTO outbox_events (id, type, student_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, event.type, event.studentId, JSON.stringify(event.payload), event.createdAt);
}

export function getUndispatchedEvents(limit = 20): Array<{
  id: string; type: string; studentId: string; payload: string; createdAt: string;
}> {
  return db.prepare(
    'SELECT id, type, student_id AS studentId, payload, created_at AS createdAt FROM outbox_events WHERE dispatched = 0 ORDER BY created_at LIMIT ?',
  ).all(limit) as Array<{ id: string; type: string; studentId: string; payload: string; createdAt: string }>;
}

export function markEventDispatched(id: string, dispatchedAt: string): void {
  db.prepare(
    'UPDATE outbox_events SET dispatched = 1, dispatched_at = ? WHERE id = ?',
  ).run(dispatchedAt, id);
}

export function insertComplianceEvent(event: {
  id: string; type: string; studentId: string; occurredAt: string; payload: Record<string, unknown>;
}): void {
  db.prepare(`
    INSERT INTO compliance_events (id, type, student_id, occurred_at, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, event.type, event.studentId, event.occurredAt, JSON.stringify(event.payload));
}

export function insertAuditEntry(entry: {
  id: string; studentId: string; eventId: string;
  ruleId: string; ruleVersion: number; status: string;
  inputsJson: string; outputsJson: string; sourceCitation: string; message: string; createdAt: string;
}): void {
  db.prepare(`
    INSERT INTO audit_trail
      (id, student_id, event_id, rule_id, rule_version, status,
       inputs_json, outputs_json, source_citation, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id, entry.studentId, entry.eventId, entry.ruleId, entry.ruleVersion,
    entry.status, entry.inputsJson, entry.outputsJson, entry.sourceCitation,
    entry.message, entry.createdAt,
  );
}

export function getAuditTrailForStudent(studentId: string): Array<{
  id: string; studentId: string; eventId: string; ruleId: string; ruleVersion: number;
  status: string; inputsJson: string; outputsJson: string; sourceCitation: string;
  message: string; createdAt: string; eventType: string; occurredAt: string;
}> {
  return db.prepare(`
    SELECT
      a.id, a.student_id AS studentId, a.event_id AS eventId, a.rule_id AS ruleId,
      a.rule_version AS ruleVersion, a.status, a.inputs_json AS inputsJson,
      a.outputs_json AS outputsJson, a.source_citation AS sourceCitation,
      a.message, a.created_at AS createdAt,
      e.type AS eventType, e.occurred_at AS occurredAt
    FROM audit_trail a
    JOIN compliance_events e ON e.id = a.event_id
    WHERE a.student_id = ?
    ORDER BY a.created_at DESC
  `).all(studentId) as Array<{
    id: string; studentId: string; eventId: string; ruleId: string; ruleVersion: number;
    status: string; inputsJson: string; outputsJson: string; sourceCitation: string;
    message: string; createdAt: string; eventType: string; occurredAt: string;
  }>;
}

// ── Observability metrics ──────────────────────────────────────────────────────

export function insertMetric(m: {
  id: string;
  name: string;
  valueMs: number;
  tags: Record<string, unknown>;
  recordedAt: string;
}): void {
  db.prepare(`
    INSERT INTO metrics (id, name, value_ms, tags, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(m.id, m.name, m.valueMs, JSON.stringify(m.tags), m.recordedAt);
}

/** Returns value_ms samples sorted ASC — caller computes percentiles. */
export function getMetricValues(name: string, limit = 500): number[] {
  const rows = db.prepare(
    'SELECT value_ms FROM metrics WHERE name = ? ORDER BY value_ms ASC LIMIT ?',
  ).all(name, limit) as Array<{ value_ms: number }>;
  return rows.map(r => r.value_ms);
}

/** Outbox lag: ms between created_at and dispatched_at for dispatched events. */
export function getOutboxLagValues(): { pendingCount: number; lagValues: number[] } {
  const { cnt } = db.prepare(
    'SELECT COUNT(*) AS cnt FROM outbox_events WHERE dispatched = 0',
  ).get() as { cnt: number };

  const rows = db.prepare(`
    SELECT CAST(
      (julianday(dispatched_at) - julianday(created_at)) * 86400000 AS REAL
    ) AS lag_ms
    FROM outbox_events
    WHERE dispatched = 1 AND dispatched_at IS NOT NULL
    ORDER BY lag_ms ASC
    LIMIT 500
  `).all() as Array<{ lag_ms: number }>;

  return { pendingCount: cnt, lagValues: rows.map(r => r.lag_ms) };
}

export function getOptWindow(): DateRange | null {
  const row = db.prepare(`
    SELECT start_date, end_date FROM authorizations
    WHERE auth_type IN ('OPT', 'STEM-OPT')
    ORDER BY start_date DESC
    LIMIT 1
  `).get() as { start_date: string; end_date: string } | undefined; // Safe cast: authorizations.end_date is TEXT NOT NULL in the schema, so it is always a string.

  if (!row) return null;
  return { start: row.start_date, end: row.end_date };
}
