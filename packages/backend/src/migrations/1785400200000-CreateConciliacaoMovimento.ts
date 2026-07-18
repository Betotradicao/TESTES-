import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Classificação por MOVIMENTO específico do extrato (Conciliação Manual, Bloco A).
 * Convive com conciliacao_amarracoes (regra por texto exato = "automática").
 *
 * - tipo 'unica'        -> classificação pontual daquele movimento (plano_conta_id). Não propaga.
 * - tipo 'transferencia'-> transferência entre contas (transfer_id -> bank_transfers). Fora do DRE.
 *
 * Precedência: o registro por movimento VENCE a amarração por texto.
 * mov_key = "data|valor|texto|tipo_operacao" (estável por movimento).
 */
export class CreateConciliacaoMovimento1785400200000 implements MigrationInterface {
    name = 'CreateConciliacaoMovimento1785400200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "conciliacao_movimento" (
                "id" SERIAL PRIMARY KEY,
                "cod_loja" INTEGER NOT NULL,
                "mov_key" TEXT NOT NULL,
                "tipo" VARCHAR(20) NOT NULL,
                "plano_conta_id" INTEGER REFERENCES "plano_contas"("id") ON DELETE CASCADE,
                "transfer_id" UUID,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_conc_mov_loja_key"
                ON "conciliacao_movimento"("cod_loja", "mov_key")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_conc_mov_loja_key"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "conciliacao_movimento"`);
    }
}
