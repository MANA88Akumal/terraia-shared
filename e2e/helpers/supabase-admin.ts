import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy env access — ESM hoists static imports above dotenv.config(),
// so we must read process.env inside functions, not at module top level.
function getEnv() {
  return {
    url: process.env.SUPABASE_URL || 'https://jmlxpcnkovxmadbygolp.supabase.co',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    testPassword: process.env.TEST_USER_PASSWORD || 'E2eTestPass!2024',
  };
}

export function getTestUsers() {
  const pw = getEnv().testPassword;
  return {
    admin: {
      email: 'e2e-admin@manaakumal.com',
      password: pw,
      role: 'admin' as const,
      approved: true,
      full_name: 'E2E Admin',
    },
    investor: {
      email: 'e2e-investor@manaakumal.com',
      password: pw,
      role: 'investor' as const,
      approved: true,
      full_name: 'E2E Investor',
    },
    unapproved: {
      email: 'e2e-unapproved@manaakumal.com',
      password: pw,
      role: 'investor' as const,
      approved: false,
      full_name: 'E2E Unapproved',
    },
  };
}

// Keep a static version for type inference
export const TEST_USERS = {
  admin: { email: 'e2e-admin@manaakumal.com', role: 'admin' },
  investor: { email: 'e2e-investor@manaakumal.com', role: 'investor' },
  unapproved: { email: 'e2e-unapproved@manaakumal.com', role: 'investor' },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getEnv();
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Set it in e2e/.env or as an environment variable.');
  }
  if (!_adminClient) {
    _adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

export function getAnonClient(): SupabaseClient {
  const { url, anonKey } = getEnv();
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is required. Set it in e2e/.env or as an environment variable.');
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Sign in as a test user and return the session (access_token, refresh_token, expires_at).
 * Uses signInWithPassword against the real Supabase auth, bypassing Google OAuth.
 */
export async function createTestSession(userKey: TestUserKey) {
  const users = getTestUsers();
  const user = users[userKey];
  const admin = getAdminClient();

  const { data, error } = await admin.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user "${userKey}" (${user.email}): ${error.message}`);
  }

  if (!data.session) {
    throw new Error(`No session returned for test user "${userKey}" (${user.email})`);
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: Math.floor(data.session.expires_at ?? (Date.now() / 1000 + 3600)),
  };
}
