import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Amarrações da Conciliação "Direto Manual".
 * Liga o TEXTO EXATO do Favorecido do extrato bancário a uma conta do plano_contas.
 * UNIQUE (cod_loja, texto_exato): amarrou uma vez, toda linha com o mesmo texto herda.
 */
export class CreateConciliacaoAmarracoes1785400100000 implements MigrationInterface {
    name = 'CreateConciliacaoAmarracoes1785400100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "conciliacao_amarracoes" (
                "id" SERIAL PRIMARY KEY,
                "cod_loja" INTEGER NOT NULL,
                "texto_exato" TEXT NOT NULL,
                "plano_conta_id" INTEGER NOT NULL REFERENCES "plano_contas"("id") ON DELETE CASCADE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_amarracao_loja_texto"
                ON "conciliacao_amarracoes"("cod_loja", "texto_exato")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_amarracao_loja_texto"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "conciliacao_amarracoes"`);
    }
}
