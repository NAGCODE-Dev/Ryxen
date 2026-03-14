export const migration = {
  id: '001_base_schema',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT NOT NULL DEFAULT 'mock',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_price_id TEXT,
        renew_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sync_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telemetry_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        item JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gyms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gym_memberships (
        id SERIAL PRIMARY KEY,
        gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        pending_email TEXT,
        role TEXT NOT NULL CHECK (role IN ('owner', 'coach', 'athlete')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'inactive')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_membership_user_unique
        ON gym_memberships(gym_id, user_id)
        WHERE user_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        scheduled_date DATE NOT NULL,
        payload JSONB NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workout_assignments (
        id SERIAL PRIMARY KEY,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        gym_membership_id INTEGER NOT NULL REFERENCES gym_memberships(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_assignment_unique
        ON workout_assignments(workout_id, gym_membership_id);

      CREATE TABLE IF NOT EXISTS athlete_groups (
        id SERIAL PRIMARY KEY,
        gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS athlete_group_memberships (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES athlete_groups(id) ON DELETE CASCADE,
        gym_membership_id INTEGER NOT NULL REFERENCES gym_memberships(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_athlete_group_membership_unique
        ON athlete_group_memberships(group_id, gym_membership_id);

      CREATE TABLE IF NOT EXISTS benchmark_library (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        official_source TEXT NOT NULL,
        year INTEGER,
        score_type TEXT NOT NULL,
        description TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS competitions (
        id SERIAL PRIMARY KEY,
        gym_id INTEGER REFERENCES gyms(id) ON DELETE CASCADE,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        visibility TEXT NOT NULL DEFAULT 'gym' CHECK (visibility IN ('gym', 'public')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS competition_events (
        id SERIAL PRIMARY KEY,
        competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
        benchmark_slug TEXT REFERENCES benchmark_library(slug) ON DELETE SET NULL,
        title TEXT NOT NULL,
        event_date TIMESTAMPTZ NOT NULL,
        score_type TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS benchmark_results (
        id SERIAL PRIMARY KEY,
        benchmark_slug TEXT NOT NULL REFERENCES benchmark_library(slug) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gym_id INTEGER REFERENCES gyms(id) ON DELETE SET NULL,
        competition_event_id INTEGER REFERENCES competition_events(id) ON DELETE SET NULL,
        score_display TEXT NOT NULL,
        score_value NUMERIC NOT NULL DEFAULT 0,
        tiebreak_seconds INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS athlete_pr_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_competitions_starts_at ON competitions(starts_at DESC);
      CREATE INDEX IF NOT EXISTS idx_competition_events_date ON competition_events(event_date DESC);
      CREATE INDEX IF NOT EXISTS idx_benchmark_results_slug ON benchmark_results(benchmark_slug, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_athlete_pr_records_user_exercise ON athlete_pr_records(user_id, exercise, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_athlete_groups_gym ON athlete_groups(gym_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_athlete_group_memberships_group ON athlete_group_memberships(group_id, created_at DESC);
    `);
  },
};
