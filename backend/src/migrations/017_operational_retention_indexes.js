export const migration = {
  id: '017_operational_retention_indexes',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
        ON telemetry_events(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_ops_events_created_at
        ON ops_events(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_jobs_terminal_updated
        ON email_jobs(status, updated_at DESC)
        WHERE status IN ('sent', 'failed');

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
        ON password_reset_tokens(expires_at, consumed_at, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expiry
        ON email_verification_tokens(expires_at, consumed_at, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_updated
        ON account_deletion_requests(status, updated_at DESC, created_at DESC);
    `);
  },
};
