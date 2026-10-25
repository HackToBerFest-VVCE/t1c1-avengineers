import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:15173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1100 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    { command: '.venv/bin/python -m uvicorn tests.e2e_server:app --host 127.0.0.1 --port 18030', cwd: '../backend', url: 'http://127.0.0.1:18030/api/health', reuseExistingServer: false },
    { command: 'FORMBRIDGE_DEV_API_TARGET=http://127.0.0.1:18030 npm run dev -- --host 127.0.0.1 --port 15173 --strictPort', url: 'http://127.0.0.1:15173', reuseExistingServer: false },
  ],
});
