import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev -- --host 127.0.0.1', port: 4173, reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'phone-landscape', use: { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } } },
  ],
});
