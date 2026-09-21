import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'cloud.spec.ts', workers: 1,
  use: { ...devices['iPad Pro 11'], browserName: 'chromium', channel: 'chrome', baseURL: 'http://localhost:3101', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --webpack --port 3101', url: 'http://localhost:3101', reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://bolet-sync.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test_only' } },
});
