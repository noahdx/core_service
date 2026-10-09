import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL ,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      system_role TEXT NOT NULL IN CHECK(system_role in ('customer', 'delivery_agent', 'restaurant_user','system_admin')),
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      deleted_at TIMESTAMP
    )
    
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_phone ON users(phone);
    CREATE  INDEX idx_users_system_role ON users(system_role);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
      DROP TABLE IF EXISTS users;
  `);
}
