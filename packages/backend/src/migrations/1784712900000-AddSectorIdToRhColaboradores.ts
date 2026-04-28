import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona setor (FK pra tabela `sectors` das Configuracoes) na lista de
 * colaboradores. Permite filtrar/agrupar por setor (acougue, padaria, etc).
 */
export class AddSectorIdToRhColaboradores1784712900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
      ADD COLUMN IF NOT EXISTS sector_id INT NULL REFERENCES sectors(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_sector_id ON rh_colaboradores(sector_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_colaboradores_sector_id`);
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS sector_id`);
  }
}
