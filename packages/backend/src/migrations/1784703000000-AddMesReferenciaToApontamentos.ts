import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMesReferenciaToApontamentos1784703000000 implements MigrationInterface {
  name = 'AddMesReferenciaToApontamentos1784703000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_apontamentos
      ADD COLUMN IF NOT EXISTS mes_referencia DATE NULL,
      ADD COLUMN IF NOT EXISTS mes_caixa DATE NULL
    `);
    // Para registros existentes, define ambos como o mes da data_inicio
    await queryRunner.query(`
      UPDATE rh_apontamentos
      SET mes_referencia = COALESCE(mes_referencia, DATE_TRUNC('month', data_inicio)::date),
          mes_caixa = COALESCE(mes_caixa, DATE_TRUNC('month', data_fim)::date)
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apontamentos_mes_ref ON rh_apontamentos(mes_referencia)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apontamentos_mes_caixa ON rh_apontamentos(mes_caixa)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_apontamentos_mes_ref`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_apontamentos_mes_caixa`);
    await queryRunner.query(`ALTER TABLE rh_apontamentos DROP COLUMN IF EXISTS mes_referencia, DROP COLUMN IF EXISTS mes_caixa`);
  }
}
