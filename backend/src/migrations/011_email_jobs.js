export const migration = {
  id: '011_email_jobs',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        email TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
        provider TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 2,
        message_id TEXT,
        preview_url TEXT,
        last_error TEXT,
        next_attempt_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_jobs_status_next_attempt
        ON email_jobs(status, next_attempt_at, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_jobs_email_created
        ON email_jobs(email, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_jobs_kind_created
        ON email_jobs(kind, created_at DESC);
    `);
  },
};
