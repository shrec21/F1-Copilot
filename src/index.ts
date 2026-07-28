import Fastify from 'fastify';
import { initDb } from './data/schema';
import { registerRoutes } from './api/routes';

const fastify = Fastify({ logger: false });

fastify.get('/health', async (_request, _reply) => {
  return { ok: true };
});

const start = async () => {
  try {
    initDb();
    registerRoutes(fastify);
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

export { fastify };

if (require.main === module) {
  start();
}
