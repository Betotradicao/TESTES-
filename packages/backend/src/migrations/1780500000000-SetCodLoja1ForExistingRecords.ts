import { MigrationInterface, QueryRunner } from "typeorm";

export class SetCodLoja1ForExistingRecords1780500000000 implements MigrationInterface {
    name = 'SetCodLoja1ForExistingRecords1780500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Atualizar todos os registros existentes que têm cod_loja NULL para cod_loja = 1
        console.log('📦 Atualizando registros existentes para cod_loja = 1...');

        // Employees
        await queryRunner.query(`UPDATE "employees" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // Losses
        await queryRunner.query(`UPDATE "losses" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // Rupture Surveys
        await queryRunner.query(`UPDATE "rupture_surveys" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // Label Audits
        await queryRunner.query(`UPDATE "label_audits" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // HortFrut Conferences
        await queryRunner.query(`UPDATE "hortfrut_conferences" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // Production Audits
        await queryRunner.query(`UPDATE "production_audits" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        // Bips
        await queryRunner.query(`UPDATE "bips" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        console.log('✅ Registros atualizados para cod_loja = 1');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverter para NULL (não recomendado)
        console.log('⚠️  Revertendo cod_loja para NULL...');

        await queryRunner.query(`UPDATE "employees" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "losses" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "rupture_surveys" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "label_audits" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "hortfrut_conferences" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "production_audits" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
        await queryRunner.query(`UPDATE "bips" SET "cod_loja" = NULL WHERE "cod_loja" = 1`);
    }
}
