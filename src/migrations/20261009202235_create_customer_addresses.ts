import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
      CREATE TABLE customer_addresses (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id),
        label TEXT NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        lat DECIMAL(10,7) NOT NULL ,
        is_default BOOLEAN NOT NULL,
        country TEXT NOT NULL,
        city TEXT NOT NULL,
        street TEXT NOT NULL,
        type TEXT NOT NULL CHECK ( type IN ('home', 'public_place', 'office') ),
        building TEXT,
        apartment_number TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );

      CREATE INDEX idx_customer_addresses_user_id ON customer_addresses(user_id);
      
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
      DROP TABLE IF EXISTS customer_addresses
  `);
}
