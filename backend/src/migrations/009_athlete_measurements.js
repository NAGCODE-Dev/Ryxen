export const migration = {
  id: '009_athlete_measurements',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS athlete_measurements (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT '',
        value NUMERIC NOT NULL,
        notes TEXT,
        recorded_at DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_athlete_measurements_user_recorded
        ON athlete_measurements(user_id, recorded_at DESC, created_at DESC);
    `);
  },
};
