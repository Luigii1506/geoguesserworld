import { defineConfig, devices } from '@playwright/test'

// Pruebas de navegador (npm run e2e): la app en `vite` sobre los datos locales
// (data/geo.db y public/community, que salen del pipeline). En móvil y en escritorio.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { viewport: { width: 1366, height: 900 } } },
  ],
})
