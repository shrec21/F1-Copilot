import { describe, it, expect, afterAll } from 'vitest';
import { fastify } from '../src/index';

describe('Health endpoint', () => {
  afterAll(async () => {
    await fastify.close();
  });

  it('GET /health returns { ok: true }', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
