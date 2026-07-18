import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Plano de Contas MANUAL da Conciliação Bancária (modo "Direto Manual").
 *
 * Espelha a hierarquia do plano de contas atual do ERP (TAB_CATEGORIA -> grupos,
 * TAB_SUBCATEGORIA -> contas), mas vive no Postgres e é editável pelo usuário.
 * É a base pra amarrar o texto exato do extrato bancário a uma conta e montar
 * o Demonstrativo "Direto Manual" a partir do banco.
 *
 * Estrutura auto-referenciada: 'grupo' (parent_id NULL) -> 'conta' (parent_id = grupo).
 * cod_categoria_oracle / cod_subcategoria_oracle rastreiam a origem quando importado,
 * evitando reimportar duplicado.
 */
export class CreatePlanoContas1785400000000 implements MigrationInterface {
    name = 'CreatePlanoContas1785400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "plano_contas" (
                "id" SERIAL PRIMARY KEY,
                "cod_loja" INTEGER NOT NULL,
                "tipo" VARCHAR(10) NOT NULL,
                "parent_id" INTEGER REFERENCES "plano_contas"("id") ON DELETE CASCADE,
                "nome" VARCHAR(200) NOT NULL,
                "is_receita" BOOLEAN NOT NULL DEFAULT false,
                "num_ordem" INTEGER NOT NULL DEFAULT 0,
                "ativo" BOOLEAN NOT NULL DEFAULT true,
                "cod_categoria_oracle" INTEGER,
                "cod_subcategoria_oracle" INTEGER,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_plano_contas_loja"
                ON "plano_contas"("cod_loja", "tipo", "num_ordem")
        `);

        // Evita reimportar a mesma categoria/subcategoria do Oracle duas vezes por loja.
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_plano_contas_oracle"
                ON "plano_contas"("cod_loja", "cod_categoria_oracle", "cod_subcategoria_oracle")
                WHERE "cod_categoria_oracle" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_plano_contas_oracle"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_plano_contas_loja"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "plano_contas"`);
    }
}
