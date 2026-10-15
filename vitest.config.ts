import { defineConfig } from 'vitest/config'

// Tests de la lógica (sin los plugins de vite.config.ts, que abren la base local).
//   npm test
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'worker/**/*.test.js'],
    setupFiles: ['fake-indexeddb/auto'],
  },
})
