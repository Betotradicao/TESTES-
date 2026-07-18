import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Coluna 'itens' (JSONB) na conciliacao_movimento para o tipo 'fatura':
 * um movimento (ex: fatura de cartão) com VÁRIOS lançamentos [{plano_conta_id, valor}]
 * que somados batem o valor do banco.
 */
export class AddItensConciliacaoMovimento1785400300000 implements MigrationInterface {
    name = 'AddItensConciliacaoMovimento1785400300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conciliacao_movimento" ADD COLUMN IF NOT EXISTS "itens" JSONB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conciliacao_movimento" DROP COLUMN IF EXISTS "itens"`);
    }
}
