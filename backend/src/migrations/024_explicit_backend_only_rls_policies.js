const BACKEND_ONLY_TABLES = [
  'account_deletion_requests',
  'app_migrations',
  'athlete_group_memberships',
  'athlete_groups',
  'athlete_measurements',
  'athlete_pr_records',
  'auth_redirect_grants',
  'benchmark_library',
  'benchmark_results',
  'billing_claims',
  'email_jobs',
  'email_verification_tokens',
  'gym_memberships',
  'gyms',
  'ops_events',
  'password_reset_support_requests',
  'password_reset_tokens',
  'running_session_logs',
  'strength_session_logs',
  'subscriptions',
  'sync_snapshots',
  'telemetry_events',
  'trusted_devices',
  'users',
  'workout_assignments',
  'workouts',
];

export const migration = {
  id: '024_explicit_backend_only_rls_policies',
  async up(client) {
    for (const tableName of BACKEND_ONLY_TABLES) {
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

      await client.query(
        `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename = ${escapeLiteral(tableName)}
                AND policyname = 'backend_only_deny_all'
            ) THEN
              EXECUTE 'CREATE POLICY backend_only_deny_all ON public.${escapeIdentifier(tableName)} FOR ALL TO public USING (false) WITH CHECK (false)';
            END IF;
          END
          $$;
        `,
      );
    }
  },
};

function escapeIdentifier(value) {
  return String(value || '').replace(/"/g, '""');
}

function escapeLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}
