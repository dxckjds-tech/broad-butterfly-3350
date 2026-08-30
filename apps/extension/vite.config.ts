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
    },
  },
});
