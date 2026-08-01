/**
 * Watcher subsystem tests.
 *
 * Uses an in-memory SQLite DB and injectable deps so no real network calls
 * or Claude API calls are made.
 */

// Must set DB_PATH before any module import touches schema
process.env.DB_PATH = ':memory:';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { initDb } from '../src/data/schema';
import { registerRoutes } from '../src/api/routes';
import { stripHtml, sha256 } from '../src/watcher/fetcher';
import { runCheckCycle } from '../src/watcher/checker';
import {
  getCheckLogs,
  getAllReviewTickets,
  getLastSnapshot,
} from '../src/watcher/queries';

// ─── Fastify instance for admin route tests ───────────────────────────────────

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

// ─── stripHtml ────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('removes simple tags and collapses whitespace', () => {
    const html = '<p>Hello  <b>world</b></p>';
    expect(stripHtml(html)).toBe('Hello world');
  });

  it('removes <script> block contents entirely', () => {
    const html = '<div>Content</div><script>alert("xss")</script><p>After</p>';
    const text = stripHtml(html);
    expect(text).not.toContain('alert');
    expect(text).toContain('Content');
    expect(text).toContain('After');
  });

  it('removes <style> block contents entirely', () => {
    const html = '<style>body { color: red; }</style><p>Visible</p>';
    const text = stripHtml(html);
    expect(text).not.toContain('color');
    expect(text).toContain('Visible');
  });

  it('decodes common HTML entities', () => {
    // &nbsp; becomes a space, then .trim() removes trailing whitespace
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe("& < > \" '");
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

// ─── sha256 ───────────────────────────────────────────────────────────────────

describe('sha256', () => {
  it('returns a 64-character hex string', () => {
    expect(sha256('hello')).toHaveLength(64);
  });

  it('returns the same hash for the same input', () => {
    expect(sha256('test content')).toBe(sha256('test content'));
  });

  it('returns different hashes for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

// ─── runCheckCycle (mocked deps) ─────────────────────────────────────────────

describe('runCheckCycle', () => {
  it('bootstraps all sources on first run without creating tickets', async () => {
    let fetchCount = 0;
    const result = await runCheckCycle({
      fetchText: async (_url) => {
        fetchCount++;
        return { hash: sha256('initial content ' + fetchCount), excerpt: 'initial content' };
      },
      summarize: async () => 'summary (should not be called on bootstrap)',
    });

    // All 5 sources should be checked
    expect(result.sourcesChecked).toBe(5);
    // No tickets on first run (bootstrap = no previous snapshot to compare)
    expect(result.changesFound).toBe(0);
    expect(result.ticketsCreated).toBe(0);

    // One check log entry written
    const logs = getCheckLogs(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].sourcesChecked).toBe(5);
    expect(logs[0].changesFound).toBe(0);
    expect(logs[0].finishedAt).not.toBeNull();
  });

  it('detects changes and opens tickets on second run', async () => {
    let summarizeCalled = 0;

    const result = await runCheckCycle({
      // Return different content than the bootstrapped baseline
      fetchText: async (_url) => ({
        hash: sha256('UPDATED content — regulation changed!'),
        excerpt: 'UPDATED content — regulation changed!',
      }),
      summarize: async (_sourceId, _old, _new) => {
        summarizeCalled++;
        return 'The page text changed significantly.';
      },
    });

    // All 5 sources changed → 5 tickets
    expect(result.changesFound).toBe(5);
    expect(result.ticketsCreated).toBe(5);
    expect(summarizeCalled).toBe(5);

    const tickets = getAllReviewTickets('pending');
    expect(tickets.length).toBeGreaterThanOrEqual(5);
    expect(tickets[0].diffSummary).toBe('The page text changed significantly.');
    expect(Array.isArray(tickets[0].affectedRuleIds)).toBe(true);
  });

  it('does not open tickets when content is unchanged', async () => {
    const stableHash = sha256('UPDATED content — regulation changed!');

    const result = await runCheckCycle({
      fetchText: async (_url) => ({
        hash: stableHash,
        excerpt: 'UPDATED content — regulation changed!',
      }),
      summarize: async () => {
        throw new Error('summarize should not be called when content is unchanged');
      },
    });

    expect(result.changesFound).toBe(0);
    expect(result.ticketsCreated).toBe(0);
  });

  it('continues checking remaining sources when one fetch fails', async () => {
    let callCount = 0;
    const result = await runCheckCycle({
      fetchText: async (_url) => {
        callCount++;
        if (callCount === 2) throw new Error('Simulated network failure');
        return { hash: sha256('stable-' + callCount), excerpt: 'stable' };
      },
      summarize: async () => 'summary',
    });

    // 4 out of 5 sources should succeed
    expect(result.sourcesChecked).toBe(4);
    // Error is propagated in the return value (avoids DB timestamp ordering ambiguity in tests)
    expect(result.error).toContain('Simulated network failure');
  });

  it('still creates tickets and uses fallback summary when summarize throws', async () => {
    // Use a unique hash so all 5 sources appear changed, triggering summarize for each.
    // summarize throws for all → fallback message for each.
    const uniqueHash = sha256('fallback-test-unique-' + Date.now());

    const result = await runCheckCycle({
      fetchText: async () => ({ hash: uniqueHash, excerpt: 'fallback test content' }),
      summarize: async () => {
        throw new Error('Claude API unavailable');
      },
    });

    // All 5 sources should have changed (unique hash differs from every prev snapshot)
    // and tickets should be created despite summarize throwing
    expect(result.changesFound).toBe(5);
    expect(result.ticketsCreated).toBe(5);

    // Verify the fallback text made it into the DB by finding any ticket from this run
    // (use getLastSnapshot as a proxy: if changesFound=5, tickets were written)
    const allPending = getAllReviewTickets('pending');
    const fallbackTicket = allPending.find(t => t.diffSummary.includes('AI summary unavailable'));
    expect(fallbackTicket).toBeDefined();
  });
});

// ─── Admin API routes ─────────────────────────────────────────────────────────

describe('GET /admin/watcher/log', () => {
  it('returns an array of check log entries', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/watcher/log' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; sourcesChecked: number }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0].sourcesChecked).toBe('number');
  });
});

describe('GET /admin/review-queue', () => {
  it('returns all tickets without filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/review-queue' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ status: string; affectedRuleIds: string[] }>;
    expect(Array.isArray(body)).toBe(true);
  });

  it('filters by status query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/review-queue?status=pending',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ status: string }>;
    expect(body.every(t => t.status === 'pending')).toBe(true);
  });
});

describe('POST /admin/review-queue/:id/resolve', () => {
  it('returns 400 when status is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/review-queue/some-id/resolve',
      payload: { reviewerNote: 'noted' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when reviewerNote is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/review-queue/some-id/resolve',
      payload: { status: 'reviewed-no-change', reviewerNote: '   ' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toContain('reviewerNote');
  });

  it('returns 404 for unknown ticket id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/review-queue/does-not-exist/resolve',
      payload: { status: 'reviewed-false-positive', reviewerNote: 'Not a real change' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('resolves a pending ticket and prevents double-resolve', async () => {
    // Get a pending ticket ID from the DB
    const pending = getAllReviewTickets('pending');
    if (pending.length === 0) return; // skip if no pending tickets from earlier tests

    const ticketId = pending[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/admin/review-queue/${ticketId}/resolve`,
      payload: {
        status: 'reviewed-no-change',
        reviewerNote: 'Reviewed — only navigation changed, no substantive update.',
      },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { ok: boolean }).ok).toBe(true);

    // Attempting to resolve the same ticket again should 404
    const res2 = await app.inject({
      method: 'POST',
      url: `/admin/review-queue/${ticketId}/resolve`,
      payload: { status: 'reviewed-false-positive', reviewerNote: 'second attempt' },
    });
    expect(res2.statusCode).toBe(404);
  });
});

describe('POST /admin/watcher/run', () => {
  it('returns 202 Accepted immediately', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/watcher/run' });
    expect(res.statusCode).toBe(202);
    const body = res.json() as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(typeof body.message).toBe('string');
  });
});
