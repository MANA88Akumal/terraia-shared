/**
 * One-time setup script to create E2E test users in Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx e2e/setup-test-users.ts
 *
 * Idempotent — safe to run multiple times. Skips users that already exist.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getAdminClient, getTestUsers } from './helpers/supabase-admin';

const TENANT_SLUG = 'mana88';

async function setup() {
  const admin = getAdminClient();
  console.log('Setting up E2E test users...\n');

  // Get tenant ID for mana88
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', TENANT_SLUG)
    .single();

  const tenantId = tenant?.id ?? null;
  if (tenantId) {
    console.log(`Found tenant "${TENANT_SLUG}" with id: ${tenantId}`);
  } else {
    console.log(`No tenant found for "${TENANT_SLUG}" — will skip user_roles rows`);
  }

  const TEST_USERS = getTestUsers();
  for (const [key, user] of Object.entries(TEST_USERS)) {
    console.log(`\n--- ${key}: ${user.email} ---`);

    // Check if user already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u) => u.email === user.email);

    let userId: string;

    if (existingUser) {
      console.log(`  Auth user exists (id: ${existingUser.id})`);
      userId = existingUser.id;

      // Update password in case it changed
      await admin.auth.admin.updateUserById(userId, {
        password: user.password,
        email_confirm: true,
      });
      console.log('  Updated password + confirmed email');
    } else {
      // Create auth user
      const { data: created, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });

      if (error) {
        console.error(`  Failed to create auth user: ${error.message}`);
        continue;
      }

      userId = created.user.id;
      console.log(`  Created auth user (id: ${userId})`);
    }

    // Upsert profile
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        approved: user.approved,
      },
      { onConflict: 'id' }
    );

    if (profileErr) {
      console.error(`  Profile upsert failed: ${profileErr.message}`);
    } else {
      console.log(`  Profile upserted (role: ${user.role}, approved: ${user.approved})`);
    }

    // Upsert user_roles (if tenant exists)
    if (tenantId) {
      const appAccess =
        user.role === 'admin'
          ? ['accounting', 'cms', 'investors']
          : user.role === 'investor'
            ? ['investors']
            : [];

      const { error: roleErr } = await admin.from('user_roles').upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          role: user.role,
          app_access: appAccess,
          is_active: true,
        },
        { onConflict: 'user_id,tenant_id' }
      );

      if (roleErr) {
        console.error(`  user_roles upsert failed: ${roleErr.message}`);
      } else {
        console.log(`  user_roles upserted (app_access: ${JSON.stringify(appAccess)})`);
      }
    }
  }

  console.log('\n--- Setup complete ---');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
