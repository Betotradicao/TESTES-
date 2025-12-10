import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProductActivationHistoryTable1758080001000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "product_activation_history" (
                "id" SERIAL PRIMARY KEY,
                "user_id" UUID NOT NULL,
                "product_id" INTEGER NOT NULL,
                "active" BOOLEAN NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CONSTRAINT "fk_product_activation_history_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
                CONSTRAINT "fk_product_activation_history_product" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE
            )
        `);

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_product_activation_history_user_id" ON "product_activation_history" ("user_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_product_activation_history_product_id" ON "product_activation_history" ("product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_product_activation_history_created_at" ON "product_activation_history" ("created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_activation_history_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_activation_history_product_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_activation_history_user_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_activation_history"`);
    }

}