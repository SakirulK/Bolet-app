import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testIgnore: 'cloud.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices['iPad Pro 11'],
    browserName: 'chromium', channel: 'chrome',
    baseURL: 'http://127.0.0.1:3100',
    storageState: {
      cookies: [],
      origins: [{
        origin: 'http://127.0.0.1:3100',
        localStorage: [{ name: 'brainbo-continue-local', value: 'true' }],
      }],
    },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run start -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false },
});
