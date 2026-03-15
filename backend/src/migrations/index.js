import { pool } from '../db.js';
import { migration as baseSchemaMigration } from './001_baseSchema.js';
import { migration as seedBenchmarksMigration } from './002_seedBenchmarks.js';
import { migration as sportTypesMigration } from './003_sport_types.js';
import { migration as competitionSportTypesMigration } from './004_competition_sport_types.js';
import { migration as sportHistoryMigration } from './005_sport_history.js';
import { migration as logCompletionStateMigration } from './006_log_completion_state.js';
import { migration as billingClaimsMigration } from './007_billing_claims.js';
import { migration as competitionSourcesMigration } from './008_competition_sources.js';

const MIGRATIONS = [
  baseSchemaMigration,
  seedBenchmarksMigration,
  sportTypesMigration,
  competitionSportTypesMigration,
  sportHistoryMigration,
  logCompletionStateMigration,
  billingClaimsMigration,
  competitionSourcesMigration,
];

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of MIGRATIONS) {
      const exists = await client.query(
        `SELECT 1 FROM app_migrations WHERE id = $1 LIMIT 1`,
        [migration.id],
      );

      if (exists.rowCount > 0) continue;

      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query(
          `INSERT INTO app_migrations (id) VALUES ($1)`,
          [migration.id],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
