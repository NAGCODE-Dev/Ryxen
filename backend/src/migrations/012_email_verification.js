export const migration = {
  id: '012_email_verification',
  async up(client) {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

      UPDATE users
      SET email_verified = TRUE,
          email_verified_at = COALESCE(email_verified_at, created_at)
      WHERE email_verified = FALSE;

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup')),
        name TEXT,
        password_hash TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_lookup
        ON email_verification_tokens(email, purpose, created_at DESC);
    `);
  },
};
