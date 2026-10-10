import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
      CREATE TABLE product_categories(
        id BIGSERIAL PRIMARY KEY,
        restaurant_id BIGINT REFERENCES restaurants(id),
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        CONSTRAINT uq_product_categories_restaurant_name UNIQUE (restaurant_id, name)
      );

      CREATE TABLE products(
        id BIGSERIAL PRIMARY KEY,
        restaurant_id BIGINT REFERENCES restaurants(id),
        category_id BIGINT REFERENCES product_categories(id),
        name TEXT NOT NULL,
        description TEXT,
        img_url TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        deleted_at TIMESTAMP
      );

      CREATE TABLE product_branch_details (
        id BIGSERIAL PRIMARY KEY,
        branch_id BIGINT REFERENCES restaurant_branches(id),
        product_id BIGINT REFERENCES products(id),
        price INT NOT NULL,
        stock INT NOT NULL,
        is_available BOOLEAN NOT NULL,
        
        CONSTRAINT uq_pbd_branch_product UNIQUE (branch_id, product_id)
      );

      CREATE INDEX idx_product_categories_restaurant_id ON product_categories(restaurant_id);
      CREATE INDEX idx_products_restaurant_id ON products(restaurant_id);
      CREATE INDEX idx_products_category_id ON products(category_id);
      CREATE INDEX idx_products_deleted_at ON products(deleted_at);
      CREATE INDEX idx_pbd_branch_id ON product_branch_details(branch_id);
      CREATE INDEX idx_pbd_product_id ON product_branch_details(product_id);


      -- Trigger: auto-insert product_branch_details for all branches when a product is created
      CREATE OR REPLACE FUNCTION fn_insert_product_branch_details()
      RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO product_branch_details (branch_id, product_id, price, stock, is_available)
          SELECT id, NEW.id, 0, 0, false
          FROM restaurant_branches
          WHERE restaurant_id = NEW.restaurant_id;
          RETURN NEW;
        END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_product_after_insert
        AFTER INSERT ON products
        FOR EACH ROW
        EXECUTE FUNCTION fn_insert_product_branch_details();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
        DROP TRIGGER IF EXISTS trg_product_after_insert ON products;
        DROP FUNCTION IF EXISTS fn_insert_product_branch_details;
        DROP TABLE IF EXISTS product_branch_details;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS product_categories;
    `);
}
