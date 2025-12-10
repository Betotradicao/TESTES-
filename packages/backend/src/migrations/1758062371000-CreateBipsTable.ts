import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBipsTable1758062371000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "bips" (
                "id" SERIAL PRIMARY KEY,
                "ean" VARCHAR(20) NOT NULL,
                "event_date" TIMESTAMP NOT NULL,
                "bip_price_cents" INTEGER NOT NULL,
                "product_id" VARCHAR(20) NOT NULL,
                "product_description" TEXT,
                "product_full_price_cents_kg" INTEGER,
                "product_discount_price_cents_kg" INTEGER,
                "bip_weight" NUMERIC(12, 3),
                "tax_cupon" VARCHAR(50),
                "status" VARCHAR(20) DEFAULT 'pending' NOT NULL,
                CONSTRAINT "bips_status_check" CHECK (status IN ('verified', 'notified', 'pending'))
            )
        `);

        // Create index for better query performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_bips_event_date" ON "bips" ("event_date")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_bips_status" ON "bips" ("status")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_bips_product_id" ON "bips" ("product_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_bips_product_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_bips_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_bips_event_date"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "bips"`);
    }

}