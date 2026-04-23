export const migration = {
  id: '022_security_hardening',
  async up(client) {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      UPDATE users
      SET password_changed_at = COALESCE(password_changed_at, created_at, NOW())
      WHERE password_changed_at IS NULL;

      WITH duplicate_pending_invites AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY gym_id, LOWER(pending_email)
            ORDER BY created_at ASC, id ASC
          ) AS row_number
        FROM gym_memberships
        WHERE pending_email IS NOT NULL
          AND user_id IS NULL
      )
      DELETE FROM gym_memberships gm
      USING duplicate_pending_invites dup
      WHERE gm.id = dup.id
        AND dup.row_number > 1;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_membership_pending_email_unique
        ON gym_memberships(gym_id, LOWER(pending_email))
        WHERE pending_email IS NOT NULL
          AND user_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_workouts_gym_sport_scheduled
        ON workouts(gym_id, sport_type, scheduled_date DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_workout_assignments_membership_completed
        ON workout_assignments(gym_membership_id, completed_at, assigned_at DESC);

      CREATE INDEX IF NOT EXISTS idx_strength_session_logs_user_logged_at
        ON strength_session_logs(user_id, logged_at DESC);

      CREATE INDEX IF NOT EXISTS idx_benchmark_results_slug_score_value
        ON benchmark_results(benchmark_slug, score_value DESC, created_at DESC);
    `);

    await client.query(`
      WITH duplicate_trusted_devices AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, LOWER(email), device_id
            ORDER BY updated_at DESC, id DESC
          ) AS row_number
        FROM trusted_devices
        WHERE revoked_at IS NULL
      )
      UPDATE trusted_devices td
      SET revoked_at = NOW(),
          updated_at = NOW()
      FROM duplicate_trusted_devices dup
      WHERE td.id = dup.id
        AND dup.row_number > 1;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_active_unique
        ON trusted_devices(user_id, email, device_id)
        WHERE revoked_at IS NULL;
    `);

    await client.query(`ALTER TABLE public.password_reset_support_requests ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY`);
  },
};
