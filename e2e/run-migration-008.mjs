import pg from 'pg';
const { Client } = pg;

const projectRef = 'jmlxpcnkovxmadbygolp';
// Try direct DB connection (port 5432) 
const connString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD || 'postgres'}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected!');
  
  const statements = [
    `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`,
    `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS user_id UUID`,
    `UPDATE brokers SET org_id = tenant_id WHERE org_id IS NULL AND tenant_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_brokers_org_user ON brokers(org_id, user_id) WHERE user_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_brokers_org ON brokers(org_id)`,
    `ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_first_name TEXT`,
    `ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_last_name TEXT`,
    `ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_nationality TEXT`,
    `UPDATE broker_leads SET client_first_name = client_name WHERE client_first_name IS NULL AND client_name IS NOT NULL`,
    `ALTER TABLE broker_leads DROP COLUMN IF EXISTS lot_interest`,
    `ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS lot_interest UUID`,
  ];

  for (const sql of statements) {
    try {
      await client.query(sql);
      console.log(`OK: ${sql.substring(0, 70)}...`);
    } catch (e) {
      console.log(`WARN: ${sql.substring(0, 50)}... → ${e.message}`);
    }
  }

  const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'brokers' ORDER BY ordinal_position`);
  console.log('\nBrokers columns:', rows.map(r => r.column_name).join(', '));

  const { rows: leadCols } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'broker_leads' ORDER BY ordinal_position`);
  console.log('Broker_leads columns:', leadCols.map(r => r.column_name).join(', '));

  await client.end();
  console.log('\nMigration 008 complete!');
} catch (e) {
  console.error('Connection failed:', e.message);
  console.log('\nPlease set SUPABASE_DB_PASSWORD and retry, or run the SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/jmlxpcnkovxmadbygolp/sql/new');
}
