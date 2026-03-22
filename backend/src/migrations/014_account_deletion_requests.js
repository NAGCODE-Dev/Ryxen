export const migration = {
  id: '014_account_deletion_requests',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        token_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_confirmation'
          CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled', 'deleted', 'expired')),
        delete_after TIMESTAMPTZ NOT NULL,
        confirmed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status_due
        ON account_deletion_requests(status, delete_after, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_created
        ON account_deletion_requests(user_id, created_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_requests_token_hash
        ON account_deletion_requests(token_hash);
    `);
  },
};
