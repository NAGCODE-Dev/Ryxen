const PUBLIC_TABLES = [
  'users',
  'sync_snapshots',
  'telemetry_events',
  'password_reset_tokens',
  'gyms',
  'gym_memberships',
  'workouts',
  'workout_assignments',
  'benchmark_library',
  'athlete_measurements',
  'athlete_pr_records',
  'benchmark_results',
  'subscriptions',
  'ops_events',
  'app_migrations',
  'athlete_group_memberships',
  'athlete_groups',
  'billing_claims',
  'email_jobs',
  'running_session_logs',
  'strength_session_logs',
  'email_verification_tokens',
  'account_deletion_requests',
];

export const migration = {
  id: '015_enable_public_rls_lockdown',
  async up(client) {
    for (const tableName of PUBLIC_TABLES) {
      const exists = await client.query(
        `
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
          LIMIT 1
        `,
        [tableName],
      );

      if (exists.rowCount === 0) continue;

      await client.query(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`);
    }
  },
};
