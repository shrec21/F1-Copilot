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
