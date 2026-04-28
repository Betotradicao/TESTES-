import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona em rh_apontamento_campos:
 *  - mostra_qtd   BOOLEAN  — coluna deve mostrar input de QTD?
 *  - mostra_valor BOOLEAN  — coluna deve mostrar input de R$?
 *
 * Default: TRUE pros dois (compatibilidade com colunas ja existentes).
 */
export class AddMostraQtdValorRhApontamentoCampos1784713200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_apontamento_campos
      ADD COLUMN IF NOT EXISTS mostra_qtd BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS mostra_valor BOOLEAN DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_apontamento_campos
      DROP COLUMN IF EXISTS mostra_qtd,
      DROP COLUMN IF EXISTS mostra_valor
    `);
  }
}
