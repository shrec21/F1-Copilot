import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Match the tsconfig.json paths alias so tests use the TypeScript source
      // directly, not the compiled dist. Rule engine source changes are reflected
      // in tests immediately without a rebuild step.
      '@f1/rule-engine': path.resolve(__dirname, './packages/rule-engine/src/index.ts'),
    },
  },
});
