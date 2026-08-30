import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@trade-ai/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@trade-ai/platform-adapters': path.resolve(
        __dirname,
        '../../packages/platform-adapters/src/index.ts',
      ),
      '@trade-ai/diagnosis-engine': path.resolve(
        __dirname,
        '../../services/diagnosis-engine/src/index.ts',
      ),
      '@trade-ai/mic-rule-engine': path.resolve(
        __dirname,
        '../../services/mic-rule-engine/src/index.ts',
      ),
      '@trade-ai/scoring-rules': path.resolve(__dirname, '../../packages/scoring-rules/src/index.ts'),
      '@trade-ai/geo-engine': path.resolve(__dirname, '../../services/geo-engine/src/index.ts'),
      '@trade-ai/seo-engine': path.resolve(__dirname, '../../services/seo-engine/src/index.ts'),
    },
  },
});
