import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria rh_candidatos com IF NOT EXISTS.
 *
 * Necessario porque CreateRhRecrutadorTables (1784710000000) tem FK pra
 * rh_candidatos, e essa tabela so existia em clientes velhos (criada via
 * synchronize legacy). Em clientes novos faltava — migration falhava com
 * "relation rh_candidatos does not exist".
 *
 * Em clientes antigos: tabela ja existe → IF NOT EXISTS = no-op.
 */
export class CreateRhCandidatos1784700600000 implements MigrationInterface {
  name = 'CreateRhCandidatos1784700600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_candidatos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        telefone VARCHAR(20) NULL,
        cpf VARCHAR(14) NULL,
        data_nascimento DATE NULL,
        endereco TEXT NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(2) NULL,
        cargo_pretendido VARCHAR(255) NULL,
        status VARCHAR(30) DEFAULT 'novo',
        observacoes TEXT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_candidatos_status ON rh_candidatos(status)`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
