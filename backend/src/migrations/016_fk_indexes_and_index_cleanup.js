export const migration = {
  id: '016_fk_indexes_and_index_cleanup',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gym_memberships_user
        ON gym_memberships(user_id);

      CREATE INDEX IF NOT EXISTS idx_gyms_owner_user
        ON gyms(owner_user_id);

      CREATE INDEX IF NOT EXISTS idx_workouts_created_by_user
        ON workouts(created_by_user_id);

      CREATE INDEX IF NOT EXISTS idx_workout_assignments_membership
        ON workout_assignments(gym_membership_id);

      CREATE INDEX IF NOT EXISTS idx_athlete_groups_created_by_user
        ON athlete_groups(created_by_user_id);

      CREATE INDEX IF NOT EXISTS idx_athlete_group_memberships_membership
        ON athlete_group_memberships(gym_membership_id);

      CREATE INDEX IF NOT EXISTS idx_benchmark_results_user_created
        ON benchmark_results(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_benchmark_results_gym_created
        ON benchmark_results(gym_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_updated
        ON subscriptions(user_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_sync_snapshots_user_created
        ON sync_snapshots(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_created
        ON password_reset_tokens(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_jobs_user_created
        ON email_jobs(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_billing_claims_applied_user
        ON billing_claims(applied_user_id);

      CREATE INDEX IF NOT EXISTS idx_billing_claims_applied_subscription
        ON billing_claims(applied_subscription_id);

      CREATE INDEX IF NOT EXISTS idx_ops_events_user_created
        ON ops_events(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_ops_events_kind_created
        ON ops_events(kind, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_email_jobs_kind_updated
        ON email_jobs(kind, updated_at DESC, created_at DESC);

      DROP INDEX IF EXISTS idx_subscriptions_mp_payment;
      DROP INDEX IF EXISTS idx_subscriptions_mp_external_ref;
      DROP INDEX IF EXISTS idx_ops_events_kind_status_created;
      DROP INDEX IF EXISTS idx_ops_events_email_created;
      DROP INDEX IF EXISTS idx_email_jobs_email_created;
      DROP INDEX IF EXISTS idx_email_jobs_kind_created;
    `);
  },
};
