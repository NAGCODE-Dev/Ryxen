import pg from 'pg';

const { Pool } = pg;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definido no ambiente.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('[reset-public-schema] ok');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[reset-public-schema] failed', error);
  process.exit(1);
});
