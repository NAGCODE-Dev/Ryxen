export const migration = {
  id: '008_competition_sources',
  async up(client) {
    await client.query(`
      ALTER TABLE competitions
      ADD COLUMN IF NOT EXISTS source_provider TEXT NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS external_ref TEXT,
      ADD COLUMN IF NOT EXISTS official_site_url TEXT,
      ADD COLUMN IF NOT EXISTS registration_url TEXT,
      ADD COLUMN IF NOT EXISTS leaderboard_url TEXT,
      ADD COLUMN IF NOT EXISTS live_embed_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled',
      ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE competition_events
      ADD COLUMN IF NOT EXISTS external_ref TEXT,
      ADD COLUMN IF NOT EXISTS registration_url TEXT,
      ADD COLUMN IF NOT EXISTS leaderboard_url TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled',
      ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS idx_competitions_source_provider_status
        ON competitions(source_provider, status, starts_at DESC);

      CREATE INDEX IF NOT EXISTS idx_competitions_external_ref
        ON competitions(source_provider, external_ref);

      CREATE INDEX IF NOT EXISTS idx_competition_events_external_ref
        ON competition_events(external_ref, event_date DESC);
    `);
  },
};
