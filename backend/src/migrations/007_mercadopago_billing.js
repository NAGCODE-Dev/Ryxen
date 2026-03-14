export const migration = {
  id: '007_mercadopago_billing',
  async up(client) {
    await client.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT,
        ADD COLUMN IF NOT EXISTS mercadopago_preference_id TEXT,
        ADD COLUMN IF NOT EXISTS mercadopago_external_reference TEXT;

      CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_payment
        ON subscriptions(mercadopago_payment_id);

      CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_external_ref
        ON subscriptions(mercadopago_external_reference);
    `);
  },
};
