export const migration = {
  id: '020_trusted_devices',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        device_id TEXT NOT NULL,
        label TEXT,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_created
        ON trusted_devices(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_trusted_devices_email_device
        ON trusted_devices(email, device_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_trusted_devices_active_expiry
        ON trusted_devices(expires_at, revoked_at, updated_at DESC);
    `);
  },
};
