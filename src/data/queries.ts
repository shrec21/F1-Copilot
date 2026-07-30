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
