// Set in-memory DB before any module import that touches schema
process.env.DB_PATH = ':memory:';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { initDb } from '../src/data/schema';
import { registerRoutes } from '../src/api/routes';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.get('/health', async () => ({ ok: true }));
  initDb();
  registerRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /status with no profile', () => {
  it('returns 404 with error message when no profile is set', async () => {
    // No profile has been created yet at this point (tests run sequentially within a file)
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { error: string };
    expect(body.error).toMatch(/Profile not set/i);
  });
});

describe('POST /profile', () => {
  it('creates/updates profile and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/profile',
      payload: {
        fullName: 'Jane Doe',
        programEndDate: '2026-05-15',
        degreeLevel: 'masters',
        visaAdmissionType: 'D/S',
        admissionDate: '2024-08-25',
        isStemEligible: false,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('POST /employment', () => {
  it('creates an employment period and returns 201 with id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/employment',
      payload: {
        employer: 'Acme Corp',
        authType: 'OPT',
        hoursPerWeek: 40,
        startDate: '2025-06-01',
        endDate: '2025-12-01',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number };
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/employment',
      payload: {
        // Missing employer, authType, hoursPerWeek, startDate
        endDate: '2025-12-01',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });
});

describe('GET /status with profile and OPT employment', () => {
  it('returns 200 with required keys when profile and OPT employment exist', async () => {
    // POST an OPT authorization window so unemployment can be computed
    await app.inject({
      method: 'POST',
      url: '/authorization',
      payload: {
        authType: 'OPT',
        startDate: '2025-06-01',
        endDate: '2026-06-01',
      },
    });

    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('unemployment');
    expect(body).toHaveProperty('cptImpact');
    expect(body).toHaveProperty('conflicts');
    expect(body).toHaveProperty('dsStatus');
  });
});

describe('GET /rules/:topic', () => {
  it('returns 200 with topic and rules array for opt-unemployment', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rules/opt-unemployment',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { topic: string; rules: unknown[] };
    expect(body.topic).toBe('opt-unemployment');
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown topic', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rules/unknown-topic',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { error: string };
    expect(body.error).toContain('Unknown topic');
  });
});
