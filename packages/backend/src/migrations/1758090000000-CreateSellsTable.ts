import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSellsTable1758090000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sells" (
                "id" SERIAL PRIMARY KEY,
                "activated_product_id" INTEGER NOT NULL,
                "product_id" VARCHAR(20) NOT NULL,
                "product_description" TEXT NOT NULL,
                "sell_date" DATE NOT NULL,
                "sell_value_cents" INTEGER NOT NULL,
                "product_weight" NUMERIC(12, 3) NOT NULL,
                "bip_id" INTEGER NULL,
                "status" VARCHAR(20) NOT NULL CHECK (status IN ('verified', 'notified')),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CONSTRAINT "fk_sells_activated_product" FOREIGN KEY ("activated_product_id") REFERENCES "products" ("id") ON DELETE CASCADE,
                CONSTRAINT "fk_sells_bip" FOREIGN KEY ("bip_id") REFERENCES "bips" ("id") ON DELETE SET NULL
            )
        `);

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_activated_product_id" ON "sells" ("activated_product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_product_id" ON "sells" ("product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_sell_date" ON "sells" ("sell_date")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_status" ON "sells" ("status")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_bip_id" ON "sells" ("bip_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sells_created_at" ON "sells" ("created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_bip_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_sell_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_product_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sells_activated_product_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sells"`);
    }

}