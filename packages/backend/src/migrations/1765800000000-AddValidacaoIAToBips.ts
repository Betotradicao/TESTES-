import { MigrationInterface, QueryRunner } from "typeorm";

export class AddValidacaoIAToBips1765800000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar colunas de validação IA na tabela bips
        await queryRunner.query(`
            ALTER TABLE "bips"
            ADD COLUMN IF NOT EXISTS "validacao_codigo" DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS "validacao_status" VARCHAR(20),
            ADD COLUMN IF NOT EXISTS "validacao_foto" TEXT,
            ADD COLUMN IF NOT EXISTS "validacao_detalhes" JSONB
        `);

        // Criar índice para melhorar performance nas consultas por status de validação
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_bips_validacao_status" ON "bips" ("validacao_status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover índice
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_bips_validacao_status"`);

        // Remover colunas
        await queryRunner.query(`
            ALTER TABLE "bips"
            DROP COLUMN IF EXISTS "validacao_codigo",
            DROP COLUMN IF EXISTS "validacao_status",
            DROP COLUMN IF EXISTS "validacao_foto",
            DROP COLUMN IF EXISTS "validacao_detalhes"
        `);
    }

}
