import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProductsTable1758080000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "products" (
                "id" SERIAL PRIMARY KEY,
                "erp_product_id" VARCHAR(20) UNIQUE NOT NULL,
                "description" VARCHAR(255) NOT NULL,
                "short_description" VARCHAR(100),
                "ean" VARCHAR(20),
                "weighable" BOOLEAN DEFAULT false,
                "section_code" INTEGER,
                "section_name" VARCHAR(100),
                "group_code" INTEGER,
                "group_name" VARCHAR(100),
                "subgroup_code" INTEGER,
                "subgroup_name" VARCHAR(100),
                "supplier_code" INTEGER,
                "supplier_name" VARCHAR(255),
                "active" BOOLEAN DEFAULT false NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
        `);

        // Create index for better query performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_erp_product_id" ON "products" ("erp_product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_active" ON "products" ("active")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_erp_product_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    }

}