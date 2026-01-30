import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusPedidoDataEntregaToRuptureItems1769799100000 implements MigrationInterface {
  name = 'AddStatusPedidoDataEntregaToRuptureItems1769799100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna status_pedido (Pendente, Parcial, Completo)
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ADD COLUMN IF NOT EXISTS status_pedido VARCHAR(20) NULL
    `);

    // Adicionar coluna data_entrega
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ADD COLUMN IF NOT EXISTS data_entrega VARCHAR(20) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      DROP COLUMN IF EXISTS status_pedido
    `);

    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      DROP COLUMN IF EXISTS data_entrega
    `);
  }
}
