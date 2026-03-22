export const migration = {
  id: '013_remove_competition_schema',
  async up(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_competition_events_comp_sport_date;
      DROP INDEX IF EXISTS idx_competitions_gym_sport_starts;
      DROP INDEX IF EXISTS idx_competition_events_date;
      DROP INDEX IF EXISTS idx_competitions_starts_at;

      ALTER TABLE benchmark_results
      ADD COLUMN IF NOT EXISTS sport_type TEXT NOT NULL DEFAULT 'cross';

      CREATE INDEX IF NOT EXISTS idx_benchmark_results_sport_slug
        ON benchmark_results(sport_type, benchmark_slug, created_at DESC);

      ALTER TABLE benchmark_results
      DROP COLUMN IF EXISTS competition_event_id;

      DROP TABLE IF EXISTS competition_events;
      DROP TABLE IF EXISTS competitions;
    `);
  },
};
