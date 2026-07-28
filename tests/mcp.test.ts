// Must set DB_PATH before any module import touches schema
process.env.DB_PATH = ':memory:';

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { initDb } from '../src/data/schema';
import { registerRoutes } from '../src/api/routes';

// ─── Mock the agent module so POST /ask never makes real API calls ───────────
vi.mock('../src/mcp/agent', () => ({
  askAgent: vi.fn().mockResolvedValue('Mocked agent answer'),
}));

import { handleToolCall } from '../src/mcp/server';
import type { RuleFile } from '../src/rules/types';

// ─── Fastify app for /ask route tests ─────────────────────────────────────────
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  initDb();
  registerRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── Tool handler tests ────────────────────────────────────────────────────────

describe('handleToolCall — lookup_rule', () => {
  it('returns correct RuleFile JSON for opt-unemployment', async () => {
    const result = await handleToolCall('lookup_rule', { topic: 'opt-unemployment' });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text) as RuleFile;
    expect(parsed.topic).toBe('opt-unemployment');
    expect(Array.isArray(parsed.rules)).toBe(true);
    expect(parsed.rules.length).toBeGreaterThan(0);
    expect(typeof parsed.disclaimer).toBe('string');
  });

  it('returns correct RuleFile JSON for cpt-authorization', async () => {
    const result = await handleToolCall('lookup_rule', { topic: 'cpt-authorization' });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text) as RuleFile;
    expect(parsed.topic).toBe('cpt-authorization');
    expect(Array.isArray(parsed.rules)).toBe(true);
    expect(parsed.rules.length).toBeGreaterThan(0);
  });

  it('returns error content for unknown topic', async () => {
    const result = await handleToolCall('lookup_rule', { topic: 'unknown-topic' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unknown topic');
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
});
