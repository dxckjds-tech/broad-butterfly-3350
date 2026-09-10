import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Keep v0.2.1 editor tests and add the v0.3.0 `tests/` folder.
    include: ['src/**/__tests__/**/*.test.ts?(x)', 'tests/**/*.test.ts?(x)'],
    restoreMocks: true,
  },
})
