/**
 * Synthetic cohort generator.
 *
 * Produces 15 deterministic students covering every compliance scenario:
 * - Clean OPT student (pass)
 * - OPT student approaching unemployment cap (warning)
 * - OPT student who exceeded cap (violation)
 * - STEM student with clean extension
 * - STEM student missing I-983 report
 * - STEM student with non-E-Verify employer
 * - Student with full-time CPT near the 12-month bar
 * - Student who hit the CPT bar (OPT eligibility lost)
 * - Student with CPT started before authorization
 * - Student currently in grace period (warning)
 * - Student who overstayed grace period (violation)
 * - Student with STEM extension and combined 150-day violation
 * - Student still in program (all rules pass/not-applicable)
 * - Student with OPT window missed
 * - Student with mixed part-time CPT + clean OPT
 *
 * Run: npx tsx src/seed/generate.ts
 * All writes are idempotent (INSERT OR REPLACE / INSERT OR IGNORE).
 */

import { randomUUID } from 'crypto';
import { initDb, getDb } from '../data/schema';
import {
  insertStudent,
  insertStudentEmployment,
  insertStudentAuthorization,
  insertStudentI983Submission,
  insertOutboxEvent,
} from '../data/queries';
import type { Student, EmploymentPeriod, AuthorizationPeriod } from '@f1/rule-engine';

// Fixed "today" for deterministic seed output
const TODAY = '2026-07-31';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function subYears(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
}

interface SeedStudent {
  student: Student;
  employment: EmploymentPeriod[];
  authorizations: AuthorizationPeriod[];
  i983Submissions?: string[];
}

function makeId(): string {
  return randomUUID();
}

const STEM_MAJORS = ['Computer Science', 'Electrical Engineering', 'Data Science', 'Mechanical Engineering'];
const NON_STEM_MAJORS = ['Business Administration', 'English Literature', 'Political Science'];

// Scenario 1: Clean OPT student — continuous employment, well under cap
function scenario_cleanOpt(): SeedStudent {
  const progEnd = addDays(TODAY, -60);  // finished 60 days ago
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Aiden Park', sevisId: 'N0010000001',
      programLevel: 'masters', major: STEM_MAJORS[0], isStemDesignated: true,
      programStartDate: subYears(progEnd, 2), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 2), i94ExpiryDate: null,
    },
    employment: [{ id: makeId(), authType: 'OPT', employer: 'TechCorp', hoursPerWeek: 40, startDate: addDays(progEnd, 5), endDate: TODAY, employerEverifyEnrolled: true }],
    authorizations: [{ id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd }],
  };
}

// Scenario 2: OPT student approaching 90-day cap (72 days used)
function scenario_optWarning(): SeedStudent {
  const progEnd = addDays(TODAY, -100);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const id = makeId();
  // 72-day gap at start
  return {
    student: {
      id, fullName: 'Mei Chen', sevisId: 'N0010000002',
      programLevel: 'masters', major: NON_STEM_MAJORS[0], isStemDesignated: false,
      programStartDate: subYears(progEnd, 2), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 2), i94ExpiryDate: null,
    },
    employment: [{ id: makeId(), authType: 'OPT', employer: 'Retail Co', hoursPerWeek: 40, startDate: addDays(progEnd, 72), endDate: TODAY }],
    authorizations: [{ id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd }],
  };
}

// Scenario 3: OPT student who exceeded 90-day cap (105 days)
function scenario_optViolation(): SeedStudent {
  const progEnd = addDays(TODAY, -200);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Carlos Reyes', sevisId: 'N0010000003',
      programLevel: 'bachelors', major: NON_STEM_MAJORS[1], isStemDesignated: false,
      programStartDate: subYears(progEnd, 4), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 4), i94ExpiryDate: null,
    },
    employment: [
      { id: makeId(), authType: 'OPT', employer: 'Freelance', hoursPerWeek: 40, startDate: addDays(progEnd, 105), endDate: addDays(progEnd, 180) },
    ],
    authorizations: [{ id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd }],
  };
}

// Scenario 4: STEM student — clean extension, E-Verify confirmed, I-983 up to date
function scenario_cleanStem(): SeedStudent {
  const progEnd = addDays(TODAY, -430);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const stemStart = optEnd;
  const stemEnd = addDays(stemStart, 730);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Priya Sharma', sevisId: 'N0010000004',
      programLevel: 'phd', major: STEM_MAJORS[1], isStemDesignated: true,
      programStartDate: subYears(progEnd, 5), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 5), i94ExpiryDate: null,
    },
    employment: [
      { id: makeId(), authType: 'OPT', employer: 'Lab Inc', hoursPerWeek: 40, startDate: addDays(progEnd, 3), endDate: optEnd, employerEverifyEnrolled: true },
      { id: makeId(), authType: 'STEM-OPT', employer: 'Lab Inc', hoursPerWeek: 40, startDate: stemStart, endDate: TODAY, employerEverifyEnrolled: true },
    ],
    authorizations: [
      { id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd },
      { id: makeId(), authType: 'STEM-OPT', startDate: stemStart, endDate: stemEnd },
    ],
    i983Submissions: [addDays(stemStart, 360)],
  };
}

// Scenario 5: STEM student — I-983 overdue by 20 days
// STEM started 385 days ago so the 1-year report was due 20 days ago
function scenario_i983Overdue(): SeedStudent {
  const stemStart = addDays(TODAY, -385);
  const optEnd = stemStart;
  const optStart = addDays(optEnd, -364);
  const progEnd = optStart;
  const stemEnd = addDays(stemStart, 730);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Omar Hassan', sevisId: 'N0010000005',
      programLevel: 'masters', major: STEM_MAJORS[2], isStemDesignated: true,
      programStartDate: subYears(progEnd, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 3), i94ExpiryDate: null,
    },
    employment: [
      { id: makeId(), authType: 'OPT', employer: 'DataSys', hoursPerWeek: 40, startDate: optStart, endDate: optEnd, employerEverifyEnrolled: true },
      { id: makeId(), authType: 'STEM-OPT', employer: 'DataSys', hoursPerWeek: 40, startDate: stemStart, endDate: TODAY, employerEverifyEnrolled: true },
    ],
    authorizations: [
      { id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd },
      { id: makeId(), authType: 'STEM-OPT', startDate: stemStart, endDate: stemEnd },
    ],
    // No I-983 submission — first report was due stemStart+365, which is 20 days ago
  };
}

// Scenario 6: STEM student — employer not E-Verify enrolled
function scenario_noEverify(): SeedStudent {
  const progEnd = addDays(TODAY, -420);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const stemStart = optEnd;
  const stemEnd = addDays(stemStart, 730);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Fatima Al-Rashid', sevisId: 'N0010000006',
      programLevel: 'masters', major: STEM_MAJORS[3], isStemDesignated: true,
      programStartDate: subYears(progEnd, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 3), i94ExpiryDate: null,
    },
    employment: [
      { id: makeId(), authType: 'OPT', employer: 'SmallBiz', hoursPerWeek: 40, startDate: optStart, endDate: optEnd, employerEverifyEnrolled: true },
      { id: makeId(), authType: 'STEM-OPT', employer: 'SmallBiz', hoursPerWeek: 40, startDate: stemStart, endDate: TODAY, employerEverifyEnrolled: false },
    ],
    authorizations: [
      { id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd },
      { id: makeId(), authType: 'STEM-OPT', startDate: stemStart, endDate: stemEnd },
    ],
    i983Submissions: [addDays(stemStart, 350)],
  };
}

// Scenario 7: Full-time CPT near 12-month bar (11 months)
function scenario_cptNearBar(): SeedStudent {
  const progEnd = addDays(TODAY, 90); // still in program
  const cptStart = addDays(TODAY, -330);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Lucas Schmidt', sevisId: 'N0010000007',
      programLevel: 'phd', major: STEM_MAJORS[0], isStemDesignated: true,
      programStartDate: subYears(TODAY, 4), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(TODAY, 4), i94ExpiryDate: null,
    },
    employment: [{
      id: makeId(), authType: 'CPT', cptType: 'full-time', employer: 'Research Lab',
      hoursPerWeek: 40, startDate: cptStart, endDate: TODAY,
    }],
    authorizations: [{
      id: makeId(), authType: 'CPT', employer: 'Research Lab',
      startDate: cptStart, endDate: progEnd,
    }],
  };
}

// Scenario 8: CPT bar hit — student has 13 months full-time CPT, OPT eligibility lost
function scenario_cptBarHit(): SeedStudent {
  const progEnd = addDays(TODAY, 30);
  const cptStart = addDays(TODAY, -400);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Amara Okafor', sevisId: 'N0010000008',
      programLevel: 'masters', major: STEM_MAJORS[1], isStemDesignated: true,
      programStartDate: subYears(TODAY, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(TODAY, 3), i94ExpiryDate: null,
    },
    employment: [{
      id: makeId(), authType: 'CPT', cptType: 'full-time', employer: 'Corp A',
      hoursPerWeek: 40, startDate: cptStart, endDate: TODAY,
    }],
    authorizations: [{
      id: makeId(), authType: 'CPT', employer: 'Corp A',
      startDate: cptStart, endDate: progEnd,
    }],
  };
}

// Scenario 9: CPT started before authorization
function scenario_cptBeforeAuth(): SeedStudent {
  const progEnd = addDays(TODAY, 180);
  const cptEmpStart = addDays(TODAY, -60);
  const cptAuthStart = addDays(TODAY, -40); // authorization came 20 days after employment started
  const id = makeId();
  return {
    student: {
      id, fullName: 'Hana Kobayashi', sevisId: 'N0010000009',
      programLevel: 'masters', major: NON_STEM_MAJORS[2], isStemDesignated: false,
      programStartDate: subYears(TODAY, 2), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(TODAY, 2), i94ExpiryDate: null,
    },
    employment: [{
      id: makeId(), authType: 'CPT', cptType: 'part-time', employer: 'Policy Inst',
      hoursPerWeek: 20, startDate: cptEmpStart, endDate: TODAY,
    }],
    authorizations: [{
      id: makeId(), authType: 'CPT', employer: 'Policy Inst',
      startDate: cptAuthStart, endDate: progEnd,
    }],
  };
}

// Scenario 10: Student in grace period (30 days into 60-day window)
function scenario_inGracePeriod(): SeedStudent {
  const progEnd = addDays(TODAY, -30);
  const optStart = addDays(TODAY, -730); // had OPT that expired
  const optEnd = addDays(progEnd, -10);  // OPT expired 10 days before program end (edge case)
  const id = makeId();
  return {
    student: {
      id, fullName: 'Ivan Petrov', sevisId: 'N0010000010',
      programLevel: 'masters', major: NON_STEM_MAJORS[0], isStemDesignated: false,
      programStartDate: subYears(TODAY, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(TODAY, 3), i94ExpiryDate: null,
    },
    employment: [],
    authorizations: [],
  };
}

// Scenario 11: Grace period overstayed (80 days past end)
function scenario_gracePeriodViolation(): SeedStudent {
  const progEnd = addDays(TODAY, -140);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Soo-Yeon Kim', sevisId: 'N0010000011',
      programLevel: 'bachelors', major: NON_STEM_MAJORS[1], isStemDesignated: false,
      programStartDate: subYears(progEnd, 4), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 4), i94ExpiryDate: null,
    },
    employment: [],
    authorizations: [],
  };
}

// Scenario 12: STEM student — cumulative 160 unemployment days (violation)
function scenario_stemUnemploymentViolation(): SeedStudent {
  const progEnd = addDays(TODAY, -500);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const stemStart = optEnd;
  const stemEnd = addDays(stemStart, 730);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Rafael Torres', sevisId: 'N0010000012',
      programLevel: 'masters', major: STEM_MAJORS[2], isStemDesignated: true,
      programStartDate: subYears(progEnd, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 3), i94ExpiryDate: null,
    },
    employment: [
      // 80-day OPT gap + 80-day STEM gap = 160 total
      { id: makeId(), authType: 'OPT', employer: 'TechA', hoursPerWeek: 40, startDate: addDays(optStart, 80), endDate: optEnd, employerEverifyEnrolled: true },
      { id: makeId(), authType: 'STEM-OPT', employer: 'TechA', hoursPerWeek: 40, startDate: addDays(stemStart, 80), endDate: TODAY, employerEverifyEnrolled: true },
    ],
    authorizations: [
      { id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd },
      { id: makeId(), authType: 'STEM-OPT', startDate: stemStart, endDate: stemEnd },
    ],
    i983Submissions: [addDays(stemStart, 350)],
  };
}

// Scenario 13: Student still in program — all applicable rules pass
function scenario_inProgram(): SeedStudent {
  const progEnd = addDays(TODAY, 180);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Nina Johansson', sevisId: 'N0010000013',
      programLevel: 'phd', major: STEM_MAJORS[3], isStemDesignated: true,
      programStartDate: subYears(TODAY, 3), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(TODAY, 3), i94ExpiryDate: null,
    },
    employment: [{
      id: makeId(), authType: 'CPT', cptType: 'part-time', employer: 'Uni Lab',
      hoursPerWeek: 20, startDate: addDays(TODAY, -180), endDate: TODAY,
    }],
    authorizations: [{
      id: makeId(), authType: 'CPT', employer: 'Uni Lab',
      startDate: addDays(TODAY, -200), endDate: progEnd,
    }],
  };
}

// Scenario 14: OPT window missed — 80 days past program end, no OPT authorization
function scenario_optWindowMissed(): SeedStudent {
  const progEnd = addDays(TODAY, -80);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Anya Kowalski', sevisId: 'N0010000014',
      programLevel: 'masters', major: NON_STEM_MAJORS[2], isStemDesignated: false,
      programStartDate: subYears(progEnd, 2), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 2), i94ExpiryDate: null,
    },
    employment: [],
    authorizations: [],
  };
}

// Scenario 15: Part-time CPT + clean OPT (control — all pass)
function scenario_partTimeCptCleanOpt(): SeedStudent {
  const progEnd = addDays(TODAY, -10);
  const optStart = progEnd;
  const optEnd = addDays(optStart, 364);
  const id = makeId();
  return {
    student: {
      id, fullName: 'Davi Oliveira', sevisId: 'N0010000015',
      programLevel: 'bachelors', major: STEM_MAJORS[0], isStemDesignated: true,
      programStartDate: subYears(progEnd, 4), programEndDate: progEnd,
      admissionType: 'D/S', i94AdmissionDate: subYears(progEnd, 4), i94ExpiryDate: null,
    },
    employment: [
      {
        id: makeId(), authType: 'CPT', cptType: 'part-time', employer: 'Dev Studio',
        hoursPerWeek: 20, startDate: addDays(TODAY, -300), endDate: progEnd,
      },
      { id: makeId(), authType: 'OPT', employer: 'Dev Studio', hoursPerWeek: 40, startDate: addDays(progEnd, 5), endDate: TODAY, employerEverifyEnrolled: true },
    ],
    authorizations: [
      { id: makeId(), authType: 'CPT', employer: 'Dev Studio', startDate: addDays(TODAY, -310), endDate: progEnd },
      { id: makeId(), authType: 'OPT', startDate: optStart, endDate: optEnd },
    ],
  };
}

export function runSeed(): void {
  initDb();

  // Clear synthetic data before re-seeding (idempotent).
  // Order matters: child tables before parent (students).
  getDb().exec(`
    DELETE FROM student_i983_submissions;
    DELETE FROM student_authorizations;
    DELETE FROM student_employment;
    DELETE FROM outbox_events WHERE student_id IN (SELECT id FROM students);
    DELETE FROM audit_trail WHERE student_id IN (SELECT id FROM students);
    DELETE FROM compliance_events WHERE student_id IN (SELECT id FROM students);
    DELETE FROM students;
  `);

  const scenarios: SeedStudent[] = [
    scenario_cleanOpt(),
    scenario_optWarning(),
    scenario_optViolation(),
    scenario_cleanStem(),
    scenario_i983Overdue(),
    scenario_noEverify(),
    scenario_cptNearBar(),
    scenario_cptBarHit(),
    scenario_cptBeforeAuth(),
    scenario_inGracePeriod(),
    scenario_gracePeriodViolation(),
    scenario_stemUnemploymentViolation(),
    scenario_inProgram(),
    scenario_optWindowMissed(),
    scenario_partTimeCptCleanOpt(),
  ];

  let studentCount = 0;
  for (const s of scenarios) {
    insertStudent(s.student);
    for (const ep of s.employment) {
      insertStudentEmployment(s.student.id, ep);
    }
    for (const a of s.authorizations) {
      insertStudentAuthorization(s.student.id, a);
    }
    for (const sub of s.i983Submissions ?? []) {
      insertStudentI983Submission(s.student.id, sub);
    }
    // Write one outbox event per student so the dispatcher evaluates all rules on startup
    insertOutboxEvent({
      id: randomUUID(),
      type: 'profile.updated',
      studentId: s.student.id,
      payload: { seededAt: TODAY },
      createdAt: new Date().toISOString(),
    });
    studentCount++;
  }

  console.log(`[seed] inserted ${studentCount} synthetic students`);
}

// Run when executed directly: npx tsx src/seed/generate.ts
if (require.main === module) {
  runSeed();
}
