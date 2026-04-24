import { pool } from '../db.js';
import { migration as baseSchemaMigration } from './001_baseSchema.js';
import { migration as seedBenchmarksMigration } from './002_seedBenchmarks.js';
import { migration as sportTypesMigration } from './003_sport_types.js';
import { migration as sportHistoryMigration } from './005_sport_history.js';
import { migration as logCompletionStateMigration } from './006_log_completion_state.js';
import { migration as billingClaimsMigration } from './007_billing_claims.js';
import { migration as athleteMeasurementsMigration } from './009_athlete_measurements.js';
import { migration as opsEventsMigration } from './010_ops_events.js';
import { migration as emailJobsMigration } from './011_email_jobs.js';
import { migration as emailVerificationMigration } from './012_email_verification.js';
import { migration as removeCompetitionSchemaMigration } from './013_remove_competition_schema.js';
import { migration as accountDeletionRequestsMigration } from './014_account_deletion_requests.js';
import { migration as enablePublicRlsLockdownMigration } from './015_enable_public_rls_lockdown.js';
import { migration as fkIndexesAndIndexCleanupMigration } from './016_fk_indexes_and_index_cleanup.js';
import { migration as operationalRetentionIndexesMigration } from './017_operational_retention_indexes.js';
import { migration as appStateSyncIndexMigration } from './018_app_state_sync_index.js';
import { migration as passwordResetSupportRequestsMigration } from './019_password_reset_support_requests.js';
import { migration as trustedDevicesMigration } from './020_trusted_devices.js';
import { migration as refreshBenchmarkLibraryExpansionMigration } from './021_refresh_benchmark_library_expansion.js';
import { migration as securityHardeningMigration } from './022_security_hardening.js';
import { migration as authRedirectGrantsMigration } from './023_auth_redirect_grants.js';

const MIGRATIONS = [
  baseSchemaMigration,
  seedBenchmarksMigration,
  sportTypesMigration,
  sportHistoryMigration,
  logCompletionStateMigration,
  billingClaimsMigration,
  athleteMeasurementsMigration,
  opsEventsMigration,
  emailJobsMigration,
  emailVerificationMigration,
  removeCompetitionSchemaMigration,
  accountDeletionRequestsMigration,
  enablePublicRlsLockdownMigration,
  fkIndexesAndIndexCleanupMigration,
  operationalRetentionIndexesMigration,
  appStateSyncIndexMigration,
  passwordResetSupportRequestsMigration,
  trustedDevicesMigration,
  refreshBenchmarkLibraryExpansionMigration,
  securityHardeningMigration,
  authRedirectGrantsMigration,
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
