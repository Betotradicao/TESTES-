import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhApontamentos1784702500000 implements MigrationInterface {
  name = 'CreateRhApontamentos1784702500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_apontamentos (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        hora_extra_60 NUMERIC(10,2) DEFAULT 0,
        hora_extra_60_inter NUMERIC(10,2) DEFAULT 0,
        hora_extra_100 NUMERIC(10,2) DEFAULT 0,
        adicional_noturno NUMERIC(10,2) DEFAULT 0,
        quebra_caixa NUMERIC(10,2) DEFAULT 0,
        ajuda_custo_domingo NUMERIC(10,2) DEFAULT 0,
        ajuda_custo_feriado NUMERIC(10,2) DEFAULT 0,
        insalubridade NUMERIC(10,2) DEFAULT 0,
        premio NUMERIC(10,2) DEFAULT 0,
        falta_dias NUMERIC(6,2) DEFAULT 0,
        atraso_horas NUMERIC(6,2) DEFAULT 0,
        desconto_dsr NUMERIC(10,2) DEFAULT 0,
        vale_transporte NUMERIC(10,2) DEFAULT 0,
        desconto_quebra_caixa NUMERIC(10,2) DEFAULT 0,
        contribuicao_sindical NUMERIC(10,2) DEFAULT 0,
        adiantamento NUMERIC(10,2) DEFAULT 0,
        compras NUMERIC(10,2) DEFAULT 0,
        observacao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (colaborador_id, data_inicio, data_fim)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apontamentos_colab ON rh_apontamentos(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apontamentos_periodo ON rh_apontamentos(data_inicio, data_fim)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_apontamentos_company ON rh_apontamentos(company_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_apontamentos`);
  }
}
