export const migration = {
  id: '010_ops_events',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops_events (
        id SERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        email TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ops_events_kind_status_created
        ON ops_events(kind, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_ops_events_email_created
        ON ops_events(email, created_at DESC);
    `);
  },
};
