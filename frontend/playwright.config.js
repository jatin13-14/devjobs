import { defineConfig } from '@playwright/test';

if (process.env.DEVJOBS_E2E !== '1' || !process.env.E2E_SYSTEM_IDENTIFIER || !process.env.E2E_RUN_ID
  || !/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(process.env.E2E_BACKEND_URL || '')
  || !/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(process.env.E2E_FRONTEND_URL || '')) {
  throw new Error('Run backend/run_browser.py with its owned disposable PostgreSQL container');
}

export default defineConfig({
  testDir: './e2e',
  ...(process.env.E2E_PRODUCTION === '1' ? { testMatch: ['routes.spec.js', 'workflows.spec.js', 'saved-jobs.spec.js'] } : {}),
  outputDir: `/tmp/devjobs-e2e-${process.env.E2E_RUN_ID}-results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: { actionTimeout: 10000, baseURL: process.env.E2E_FRONTEND_URL, trace: 'off', screenshot: 'only-on-failure' },
});
