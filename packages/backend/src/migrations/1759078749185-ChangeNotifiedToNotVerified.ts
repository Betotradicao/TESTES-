import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeNotifiedToNotVerified1759078749185 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Primeiro remover constraint antigo
        await queryRunner.query(`ALTER TABLE "sells" DROP CONSTRAINT IF EXISTS "sells_status_check"`);

        // 2. Adicionar novo constraint com 'not_verified'
        await queryRunner.query(`
            ALTER TABLE "sells" ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'notified', 'not_verified', 'cancelled'))
        `);

        // 3. Agora fazer o UPDATE (ambos valores são válidos)
        await queryRunner.query(`UPDATE "sells" SET status = 'not_verified' WHERE status = 'notified'`);

        // 4. Remover constraint temporário e adicionar final
        await queryRunner.query(`ALTER TABLE "sells" DROP CONSTRAINT "sells_status_check"`);
        await queryRunner.query(`
            ALTER TABLE "sells" ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'not_verified', 'cancelled'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverter mudanças
        // 1. Remover constraint atual
        await queryRunner.query(`ALTER TABLE "sells" DROP CONSTRAINT "sells_status_check"`);

        // 2. Adicionar constraint temporário permitindo ambos
        await queryRunner.query(`
            ALTER TABLE "sells" ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'notified', 'not_verified', 'cancelled'))
        `);

        // 3. Reverter UPDATE
        await queryRunner.query(`UPDATE "sells" SET status = 'notified' WHERE status = 'not_verified'`);

        // 4. Restaurar constraint original
        await queryRunner.query(`ALTER TABLE "sells" DROP CONSTRAINT "sells_status_check"`);
        await queryRunner.query(`
            ALTER TABLE "sells" ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'notified', 'cancelled'))
        `);
    }

}
