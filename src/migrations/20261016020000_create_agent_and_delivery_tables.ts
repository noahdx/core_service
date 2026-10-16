import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE restaurant_balances (
      restaurant_id BIGINT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
      balance INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE agent_earnings (
      id BIGSERIAL PRIMARY KEY,
      agent_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_agent_earnings_order_id UNIQUE (order_id)
    );

    CREATE INDEX idx_agent_earnings_agent_earned_at ON agent_earnings (agent_id, earned_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS agent_earnings CASCADE;
    DROP TABLE IF EXISTS restaurant_balances CASCADE;
  `);
}
