import { pool } from './db.js';
import {
  RETENTION_ACCOUNT_DELETION_DAYS,
  RETENTION_EMAIL_JOBS_DAYS,
  RETENTION_EMAIL_VERIFICATION_DAYS,
  RETENTION_OPS_DAYS,
  RETENTION_PASSWORD_RESET_DAYS,
  RETENTION_SWEEP_INTERVAL_MS,
  RETENTION_SYNC_SNAPSHOT_KEEP_PER_USER,
  RETENTION_TELEMETRY_DAYS,
} from './config.js';

let retentionWorkerStarted = false;
let retentionSweepTimer = null;

export function startOperationalRetentionWorker() {
  if (retentionWorkerStarted) return;
  retentionWorkerStarted = true;
  retentionSweepTimer = setInterval(() => {
    sweepOperationalData().catch((error) => {
      console.error('[retention-worker] sweep failed', error);
    });
  }, RETENTION_SWEEP_INTERVAL_MS);
  retentionSweepTimer.unref?.();
}

export async function sweepOperationalData() {
  const summary = {
    telemetryEventsDeleted: 0,
    opsEventsDeleted: 0,
    emailJobsDeleted: 0,
    passwordResetTokensDeleted: 0,
    emailVerificationTokensDeleted: 0,
    syncSnapshotsDeleted: 0,
    accountDeletionRequestsDeleted: 0,
  };

  summary.telemetryEventsDeleted = await deleteOlderThan('telemetry_events', 'created_at', RETENTION_TELEMETRY_DAYS);
  summary.opsEventsDeleted = await deleteOlderThan('ops_events', 'created_at', RETENTION_OPS_DAYS);
  summary.emailJobsDeleted = await deleteEmailJobs();
  summary.passwordResetTokensDeleted = await deleteAuthTokens({
    table: 'password_reset_tokens',
    days: RETENTION_PASSWORD_RESET_DAYS,
  });
  summary.emailVerificationTokensDeleted = await deleteAuthTokens({
    table: 'email_verification_tokens',
    days: RETENTION_EMAIL_VERIFICATION_DAYS,
  });
  summary.syncSnapshotsDeleted = await deleteOldSyncSnapshots();
  summary.accountDeletionRequestsDeleted = await deleteFinalizedAccountDeletionRequests();

  return summary;
}

async function deleteOlderThan(tableName, columnName, days) {
  const result = await pool.query(
    `DELETE FROM ${tableName}
     WHERE ${columnName} < NOW() - ($1::int * INTERVAL '1 day')`,
    [days],
  );
  return Number(result.rowCount || 0);
}

async function deleteEmailJobs() {
  const result = await pool.query(
    `DELETE FROM email_jobs
     WHERE status IN ('sent', 'failed')
       AND COALESCE(updated_at, created_at) < NOW() - ($1::int * INTERVAL '1 day')`,
    [RETENTION_EMAIL_JOBS_DAYS],
  );
  return Number(result.rowCount || 0);
}

async function deleteAuthTokens({ table, days }) {
  const result = await pool.query(
    `DELETE FROM ${table}
     WHERE (consumed_at IS NOT NULL AND consumed_at < NOW() - ($1::int * INTERVAL '1 day'))
        OR (expires_at < NOW() - ($1::int * INTERVAL '1 day'))`,
    [days],
  );
  return Number(result.rowCount || 0);
}

async function deleteOldSyncSnapshots() {
  const result = await pool.query(
    `WITH ranked AS (
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC, id DESC
         ) AS row_num
       FROM sync_snapshots
     )
     DELETE FROM sync_snapshots ss
     USING ranked r
     WHERE ss.id = r.id
       AND r.row_num > $1`,
    [RETENTION_SYNC_SNAPSHOT_KEEP_PER_USER],
  );
  return Number(result.rowCount || 0);
}

async function deleteFinalizedAccountDeletionRequests() {
  const result = await pool.query(
    `DELETE FROM account_deletion_requests
     WHERE status IN ('cancelled', 'deleted', 'expired')
       AND COALESCE(updated_at, created_at) < NOW() - ($1::int * INTERVAL '1 day')`,
    [RETENTION_ACCOUNT_DELETION_DAYS],
  );
  return Number(result.rowCount || 0);
}
