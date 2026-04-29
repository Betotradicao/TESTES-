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
    // Em clientes antigos sem o modulo de apontamentos, a tabela pode nao existir.
    // Migration vira no-op nesses casos pra nao quebrar a inicializacao.
    const tabela = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'rh_apontamento_campos'
    `);
    if (!tabela || tabela.length === 0) return;

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
