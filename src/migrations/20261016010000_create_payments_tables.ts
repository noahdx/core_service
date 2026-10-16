import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE payment_providers (
      id INT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      priority SMALLINT NOT NULL DEFAULT 100
    );

    INSERT INTO payment_providers (id, name, is_enabled, priority) VALUES
      (1, 'kashier', true, 10),
      (2, 'cod', true, 20)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE payment_sessions (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider_id INT NOT NULL REFERENCES payment_providers(id),
      provider_session_id TEXT NOT NULL UNIQUE,
      redirect_url TEXT NOT NULL,
      amount INT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      status TEXT NOT NULL CHECK (
        status IN (
          'initialized',
          'pending',
          'authorized',
          'captured',
          'failed',
          'expired',
          'cancelled'
        )
      ),
      raw_init_payload JSONB NULL,
      raw_last_payload JSONB NULL,
      failure_attempts INT NOT NULL DEFAULT 0,
      max_failure_attempts INT NOT NULL DEFAULT 3,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_payment_sessions_provider_session_id ON payment_sessions (provider_session_id);
    CREATE INDEX idx_payment_sessions_order_id ON payment_sessions (order_id);

    CREATE TABLE transactions (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NULL REFERENCES orders(id),
      transaction_type TEXT NOT NULL CHECK (
        transaction_type IN (
          'charge',
          'refund',
          'commission',
          'payout',
          'cod_collection',
          'adjustment'
        )
      ),
      method TEXT NOT NULL CHECK (method IN ('online', 'cod', 'bank_transfer', 'system')),
      provider_id INT NULL REFERENCES payment_providers(id),
      provider_reference_id TEXT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'reversed')),
      amount INT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      src_acc_id BIGINT NULL REFERENCES users(id),
      dst_acc_id BIGINT NULL REFERENCES users(id),
      is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
      refunded_payment_id BIGINT NULL REFERENCES transactions(id),
      idempotency_key TEXT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_transactions_order_id ON transactions (order_id);
    CREATE INDEX idx_transactions_provider_reference_id ON transactions (provider_reference_id) WHERE provider_reference_id IS NOT NULL;
    CREATE INDEX idx_transactions_type_status_created_at ON transactions (transaction_type, status, created_at DESC);

    CREATE TABLE payment_webhook_events (
      id BIGSERIAL PRIMARY KEY,
      provider_id INT NOT NULL REFERENCES payment_providers(id),
      provider_event_id TEXT NOT NULL,
      signature TEXT NOT NULL,
      payload JSONB NOT NULL,
      received_at TIMESTAMP NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMP NULL,
      process_error TEXT NULL,
      CONSTRAINT uq_payment_webhook_events_provider_event_id UNIQUE (provider_id, provider_event_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS payment_webhook_events;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS payment_sessions;
    DROP TABLE IF EXISTS payment_providers;
  `);
}
