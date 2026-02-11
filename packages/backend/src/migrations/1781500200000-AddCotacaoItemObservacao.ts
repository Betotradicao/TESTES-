import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCotacaoItemObservacao1781500200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item ADD COLUMN IF NOT EXISTS observacao TEXT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cotacao_pedido_item DROP COLUMN IF EXISTS observacao`);
  }
}
