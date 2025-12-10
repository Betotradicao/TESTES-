import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotifiedAtToBips1759074839394 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Adicionar coluna notified_at
        await queryRunner.query(`
            ALTER TABLE "bips"
            ADD COLUMN "notified_at" TIMESTAMP
        `);

        // 2. Preencher notified_at para registros com status 'notified'
        // Define como o dia seguinte ao event_date às 00:00:00
        await queryRunner.query(`
            UPDATE "bips"
            SET "notified_at" = "event_date" + INTERVAL '1 day'
            WHERE "status" = 'notified'
        `);

        // 3. Atualizar status de 'notified' para 'pending'
        await queryRunner.query(`
            UPDATE "bips"
            SET "status" = 'pending'
            WHERE "status" = 'notified'
        `);

        // 4. Criar índice para a nova coluna
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_bips_notified_at" ON "bips" ("notified_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverter mudanças
        // 1. Restaurar status 'notified' baseado em notified_at
        await queryRunner.query(`
            UPDATE "bips"
            SET "status" = 'notified'
            WHERE "notified_at" IS NOT NULL AND "status" = 'pending'
        `);

        // 2. Remover índice
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_bips_notified_at"
        `);

        // 3. Remover coluna
        await queryRunner.query(`
            ALTER TABLE "bips"
            DROP COLUMN "notified_at"
        `);
    }

}