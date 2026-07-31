// Must set DB_PATH before any module import touches schema
process.env.DB_PATH = ':memory:';

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { initDb } from '../src/data/schema';
import { registerRoutes } from '../src/api/routes';
import {
  insertStudent,
  insertStudentEmployment,
  insertStudentAuthorization,
} from '../src/data/queries';

// ─── Mock the agent module so POST /ask never makes real API calls ───────────
vi.mock('../src/mcp/agent', () => ({
  askAgent: vi.fn().mockResolvedValue('Mocked agent answer'),
}));

import { handleToolCall } from '../src/mcp/server';
import { askAgent } from '../src/mcp/agent';

// ─── Shared test student ──────────────────────────────────────────────────────

const STUDENT_ID = randomUUID();
const TODAY = new Date().toISOString().slice(0, 10);

// ─── Fastify app for /ask route tests ─────────────────────────────────────────
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  initDb();

  // Insert a minimal STEM student into the in-memory DB for tool happy-path tests
  insertStudent({
    id: STUDENT_ID,
    fullName: 'Test Student',
    sevisId: 'N9999999999',
    programLevel: 'masters',
    major: 'Computer Science',
    isStemDesignated: true,
    programStartDate: '2022-09-01',
    programEndDate: '2024-05-15',
    admissionType: 'D/S',
    i94AdmissionDate: '2022-09-01',
    i94ExpiryDate: null,
  });

  // OPT authorization: 2024-05-15 → 2025-05-14
  insertStudentAuthorization(STUDENT_ID, {
    id: randomUUID(),
    authType: 'OPT',
    startDate: '2024-05-15',
    endDate: '2025-05-14',
  });

  // OPT employment with a gap: hired after 30 days → 30 unemployment days used
  insertStudentEmployment(STUDENT_ID, {
    id: randomUUID(),
    authType: 'OPT',
    employer: 'Acme Corp',
    hoursPerWeek: 40,
    startDate: '2024-06-14',
    endDate: null,
    employerEverifyEnrolled: true,
  });

  registerRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── check_cpt_eligibility ─────────────────────────────────────────────────────

describe('handleToolCall — check_cpt_eligibility', () => {
  it('returns error when studentId is missing', async () => {
    const result = await handleToolCall('check_cpt_eligibility', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('studentId is required');
  });

  it('returns error for unknown student', async () => {
    const result = await handleToolCall('check_cpt_eligibility', { studentId: 'does-not-exist' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('returns eligibility data for known student with no CPT', async () => {
    const result = await handleToolCall('check_cpt_eligibility', { studentId: STUDENT_ID });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text) as {
      eligible: boolean;
      fullTimeCptMonths: number;
      citation: string;
    };
    expect(data.eligible).toBe(true);
    expect(data.fullTimeCptMonths).toBe(0);
    expect(data.citation).toContain('214.2(f)(10)(i)');
  });
});

// ─── calculate_unemployment_days ───────────────────────────────────────────────

describe('handleToolCall — calculate_unemployment_days', () => {
  it('returns error when studentId is missing', async () => {
    const result = await handleToolCall('calculate_unemployment_days', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('studentId is required');
  });

  it('returns error for unknown student', async () => {
    const result = await handleToolCall('calculate_unemployment_days', { studentId: 'ghost' });
    expect(result.isError).toBe(true);
  });

  it('returns unemployment day counts for known student', async () => {
    const result = await handleToolCall('calculate_unemployment_days', {
      studentId: STUDENT_ID,
      asOfDate: '2024-07-15',
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text) as {
      asOfDate: string;
      opt90DayCap: { unemploymentDaysUsed: number; cap: number };
    };
    expect(data.asOfDate).toBe('2024-07-15');
    // Gap: 2024-05-15 to 2024-06-13 = 30 days unemployed
    expect(data.opt90DayCap.unemploymentDaysUsed).toBe(30);
    expect(data.opt90DayCap.cap).toBe(90);
  });
});

// ─── simulate_opt_timeline ─────────────────────────────────────────────────────

describe('handleToolCall — simulate_opt_timeline', () => {
  it('returns error when required args are missing', async () => {
    const result = await handleToolCall('simulate_opt_timeline', { studentId: STUDENT_ID });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('required');
  });

  it('returns error for invalid date format', async () => {
    const result = await handleToolCall('simulate_opt_timeline', {
      studentId: STUDENT_ID,
      proposedStartDate: '09/01/2025',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('YYYY-MM-DD');
  });

  it('returns OPT and STEM timeline for STEM student', async () => {
    const result = await handleToolCall('simulate_opt_timeline', {
      studentId: STUDENT_ID,
      proposedStartDate: '2025-06-01',
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text) as {
      optWindow: { start: string; end: string; durationDays: number };
      stemWindow: { start: string; end: string; durationDays: number };
      unemploymentCaps: {
        optCap90: { worstCaseCapHitDate: string };
        stemCumulativeCap150: { worstCaseCapHitDate: string };
      };
    };
    expect(data.optWindow.start).toBe('2025-06-01');
    expect(data.optWindow.durationDays).toBe(365);
    expect(data.stemWindow.durationDays).toBe(730);
    // Worst-case 90-day cap: start + 89 days = 2025-08-29
    expect(data.unemploymentCaps.optCap90.worstCaseCapHitDate).toBe('2025-08-29');
  });
});

// ─── get_compliance_audit_trail ────────────────────────────────────────────────

describe('handleToolCall — get_compliance_audit_trail', () => {
  it('returns error when studentId is missing', async () => {
    const result = await handleToolCall('get_compliance_audit_trail', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('studentId is required');
  });

  it('returns error for unknown student', async () => {
    const result = await handleToolCall('get_compliance_audit_trail', { studentId: 'none' });
    expect(result.isError).toBe(true);
  });

  it('returns audit trail (empty if dispatcher not run) for known student', async () => {
    const result = await handleToolCall('get_compliance_audit_trail', { studentId: STUDENT_ID });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text) as {
      totalEntries: number;
      entries: unknown[];
      student: { name: string };
    };
    expect(data.student.name).toBe('Test Student');
    expect(Array.isArray(data.entries)).toBe(true);
    // In-memory DB with no dispatcher run → 0 entries
    expect(data.totalEntries).toBe(0);
  });
});

// ─── unknown tool ──────────────────────────────────────────────────────────────

describe('handleToolCall — unknown tool', () => {
  it('returns error for unknown tool name', async () => {
    const result = await handleToolCall('nonexistent_tool', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unknown tool');
  });
});

// ─── POST /ask route tests ─────────────────────────────────────────────────────

describe('POST /ask', () => {
  it('returns 400 when question is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ask',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toContain('question is required');
  });

  it('returns { answer: string } when askAgent resolves with mocked answer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ask',
      payload: { question: 'How many unemployment days do I have left on OPT?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: string };
    expect(typeof body.answer).toBe('string');
    expect(body.answer).toBe('Mocked agent answer');
  });

  it('propagates DSO fallback phrase when question is out of corpus', async () => {
    // The system prompt is the primary enforcement mechanism that instructs the model
    // to return the exact DSO fallback phrase for out-of-corpus questions. This test
    // verifies that the phrase travels correctly through the /ask route to the caller.
    const DSO_FALLBACK =
      "This isn't covered by what I can verify — please talk to your DSO or an immigration attorney.";

    // Override the mock for this one call to simulate an out-of-corpus response
    vi.mocked(askAgent).mockResolvedValueOnce(DSO_FALLBACK);

    const res = await app.inject({
      method: 'POST',
      url: '/ask',
      payload: { question: 'Can I work on a tourist visa?' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: string };
    expect(body.answer).toContain('talk to your DSO');
  });
});
