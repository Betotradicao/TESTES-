import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWebhookLogs1780000000000 implements MigrationInterface {
    name = 'CreateWebhookLogs1780000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "webhook_logs" (
                "id" SERIAL PRIMARY KEY,
                "status" varchar(50) NOT NULL,
                "reason" varchar(100) NOT NULL,
                "raw_payload" text,
                "ean" varchar(50),
                "plu" varchar(20),
                "product_description" varchar(200),
                "scanner_id" varchar(100),
                "machine_id" varchar(100),
                "equipment_id" integer,
                "employee_name" varchar(100),
                "error_message" text,
                "bip_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Criar índice para busca por data
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_created_at" ON "webhook_logs" ("created_at")
        `);

        // Criar índice para busca por status
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_status" ON "webhook_logs" ("status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_logs_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_logs_created_at"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "webhook_logs"`);
    }
}
