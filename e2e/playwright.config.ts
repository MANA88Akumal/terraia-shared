import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  outputDir: 'test-results',

  projects: [
    {
      name: 'portal',
      testMatch: ['auth.spec.ts', 'role-access.spec.ts', 'rls-isolation.spec.ts', 'portal-dashboard.spec.ts', 'sign-out.spec.ts', 'i18n.spec.ts'],
      use: {
        baseURL: 'https://investors.terraia.io',
      },
    },
    {
      name: 'accounting',
      testMatch: ['accounting-dashboard.spec.ts'],
      use: {
        baseURL: 'https://accounting.terraia.io',
      },
    },
    {
      name: 'cms',
      testMatch: ['cms-dashboard.spec.ts'],
      use: {
        baseURL: 'https://cms.terraia.io',
      },
    },
    {
      name: 'login',
      testMatch: ['login-portal.spec.ts'],
      use: {
        baseURL: 'https://login.terraia.io',
      },
    },
    {
      name: 'onboarding',
      testMatch: ['onboarding.spec.ts'],
      use: {
        baseURL: 'https://login.terraia.io',
      },
    },
    {
      name: 'cross-app',
      testMatch: ['cross-app-sso.spec.ts', 'app-switcher.spec.ts'],
    },
  ],
});
