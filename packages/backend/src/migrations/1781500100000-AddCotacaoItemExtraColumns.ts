import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCotacaoItemExtraColumns1781500100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item ADD COLUMN IF NOT EXISTS cod_barra VARCHAR(50) NULL`);
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item ADD COLUMN IF NOT EXISTS curva VARCHAR(5) NULL`);
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item ADD COLUMN IF NOT EXISTS custo_ideal DECIMAL(12,4) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item DROP COLUMN IF EXISTS cod_barra`);
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item DROP COLUMN IF EXISTS curva`);
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item DROP COLUMN IF EXISTS custo_ideal`);
  }
}
