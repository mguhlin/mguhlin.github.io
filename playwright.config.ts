import { defineConfig, devices } from '@playwright/test';
const live = process.env.SITE_URL;
export default defineConfig({
  testDir: './tests',
  webServer: live ? undefined : {
    command: 'python3 -m http.server 4180 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4180/',
    reuseExistingServer: true,
  },
  use: { baseURL: live || 'http://127.0.0.1:4180/', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: {...devices['Desktop Chrome']} },
    { name: 'firefox', use: {...devices['Desktop Firefox']} },
    { name: 'webkit-phone', use: {...devices['iPhone 13']} },
  ],
});
