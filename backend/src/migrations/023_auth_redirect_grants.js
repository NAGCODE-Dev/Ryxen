export const migration = {
  id: '023_auth_redirect_grants',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_redirect_grants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL UNIQUE,
        flow TEXT NOT NULL DEFAULT 'native_google_oauth',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_auth_redirect_grants_user_created
        ON auth_redirect_grants(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_auth_redirect_grants_active_expiry
        ON auth_redirect_grants(expires_at, consumed_at, created_at DESC);
    `);

    await client.query(`ALTER TABLE public.auth_redirect_grants ENABLE ROW LEVEL SECURITY`);
  },
};
