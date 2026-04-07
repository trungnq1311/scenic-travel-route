import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.test-token-for-e2e',
      MAPBOX_API_KEY: 'pk.test-token-for-e2e',
      NEXT_PUBLIC_E2E_DISABLE_MAP: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
