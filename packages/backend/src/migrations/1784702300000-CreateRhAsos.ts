import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhAsos1784702300000 implements MigrationInterface {
  name = 'CreateRhAsos1784702300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_asos (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        tipo VARCHAR(30) NOT NULL,
        data_exame DATE NOT NULL,
        validade_meses INT DEFAULT 12,
        data_vencimento DATE,
        resultado VARCHAR(30) DEFAULT 'apto',
        clinica VARCHAR(255),
        medico_nome VARCHAR(255),
        medico_crm VARCHAR(50),
        observacoes TEXT,
        arquivo_url TEXT,
        arquivo_nome VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_asos_colab ON rh_asos(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_asos_venc ON rh_asos(data_vencimento)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_asos`);
  }
}
