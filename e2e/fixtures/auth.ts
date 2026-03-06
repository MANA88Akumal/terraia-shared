import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { injectSessionCookie, clearSessionCookie } from '../helpers/cookie';
import type { TestUserKey } from '../helpers/supabase-admin';

type AuthFixtures = {
  /** Page with admin session cookie injected. Navigates to baseURL after auth. */
  authenticatedPage: Page;
  /** Page with investor session cookie injected. */
  investorPage: Page;
  /** Page with unapproved user session cookie injected. */
  unapprovedPage: Page;
  /** Page with onboard user session cookie injected (no org membership). */
  onboardPage: Page;
  /** Inject a session cookie for any test user into the current context. */
  loginAs: (userKey: TestUserKey) => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    await injectSessionCookie(context, 'admin');
    await use(page);
  },

  investorPage: async ({ page, context }, use) => {
    await injectSessionCookie(context, 'investor');
    await use(page);
  },

  unapprovedPage: async ({ page, context }, use) => {
    await injectSessionCookie(context, 'unapproved');
    await use(page);
  },

  onboardPage: async ({ page, context }, use) => {
    await injectSessionCookie(context, 'onboard');
    await use(page);
  },

  loginAs: async ({ context }, use) => {
    const fn = async (userKey: TestUserKey) => {
      await clearSessionCookie(context);
      await injectSessionCookie(context, userKey);
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
