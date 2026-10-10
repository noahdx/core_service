import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
      CREATE TABLE restaurants(
        id BIGSERIAL PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES users(id),
        name TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL CHECK ( status IN ('active', 'pending', 'disabled', 'suspended') ),
        primary_country TEXT NOT NULL,
        logo_url TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );

      CREATE INDEX idx_restaurants_owner_id ON restaurants(owner_id);
      CREATE INDEX idx_restaurants_status ON restaurants(status);
      CREATE INDEX idx_restaurants_primary_country ON restaurants(primary_country);
      CREATE INDEX idx_restaurants_primary_created_at ON restaurants(created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS restaurants;`);
}
