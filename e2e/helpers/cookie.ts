import type { BrowserContext } from '@playwright/test';
import { createTestSession, type TestUserKey } from './supabase-admin';

const COOKIE_NAME = 'mana88_session';
const COOKIE_DOMAIN = '.terraia.io';

/**
 * Create a test session and inject it as the mana88_session cookie.
 * This bypasses Google OAuth — the AuthProvider reads this cookie on load
 * and establishes a valid Supabase session from it.
 */
export async function injectSessionCookie(context: BrowserContext, userKey: TestUserKey) {
  const session = await createTestSession(userKey);

  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  });

  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: encodeURIComponent(cookieValue),
      domain: COOKIE_DOMAIN,
      path: '/',
      secure: true,
      sameSite: 'Lax',
      expires: session.expires_at,
    },
  ]);
}

/**
 * Clear the mana88_session cookie from the browser context.
 */
export async function clearSessionCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: '',
      domain: COOKIE_DOMAIN,
      path: '/',
      secure: true,
      sameSite: 'Lax',
      expires: 0,
    },
  ]);
}

/**
 * Check if the mana88_session cookie exists in the context.
 */
export async function hasSessionCookie(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies();
  return cookies.some((c) => c.name === COOKIE_NAME && c.value !== '');
}
