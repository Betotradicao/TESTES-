import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodLojaToSells1780700000000 implements MigrationInterface {
    name = 'AddCodLojaToSells1780700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar cod_loja em sells
        console.log('📦 Adicionando coluna cod_loja na tabela sells...');
        await queryRunner.query(`ALTER TABLE "sells" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Adicionar cod_loja em equipments
        console.log('📦 Adicionando coluna cod_loja na tabela equipments...');
        await queryRunner.query(`ALTER TABLE "equipments" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Adicionar cod_loja em webhook_logs
        console.log('📦 Adicionando coluna cod_loja na tabela webhook_logs...');
        await queryRunner.query(`ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Adicionar cod_loja em products
        console.log('📦 Adicionando coluna cod_loja na tabela products...');
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Adicionar cod_loja em bips
        console.log('📦 Adicionando coluna cod_loja na tabela bips...');
        await queryRunner.query(`ALTER TABLE "bips" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Atualizar registros existentes para cod_loja = 1
        console.log('📦 Atualizando registros existentes para cod_loja = 1...');
        await queryRunner.query(`UPDATE "sells" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);
        await queryRunner.query(`UPDATE "equipments" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);
        await queryRunner.query(`UPDATE "webhook_logs" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);
        await queryRunner.query(`UPDATE "products" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);
        await queryRunner.query(`UPDATE "bips" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);

        console.log('✅ Colunas cod_loja adicionadas e registros atualizados');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sells" DROP COLUMN IF EXISTS "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "equipments" DROP COLUMN IF EXISTS "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "webhook_logs" DROP COLUMN IF EXISTS "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "bips" DROP COLUMN IF EXISTS "cod_loja"`);
    }
}
