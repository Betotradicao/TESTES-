import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartamentoPessoalTables1784702400000 implements MigrationInterface {
  name = 'CreateDepartamentoPessoalTables1784702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dp_pastas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE,
        ordem INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dp_subpastas (
        id SERIAL PRIMARY KEY,
        pasta_id INT NOT NULL REFERENCES dp_pastas(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        obrigatorio BOOLEAN DEFAULT false,
        ordem INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dp_subpastas ON dp_subpastas(pasta_id)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dp_documentos (
        id SERIAL PRIMARY KEY,
        pasta_id INT NOT NULL REFERENCES dp_pastas(id) ON DELETE CASCADE,
        subpasta_id INT NULL REFERENCES dp_subpastas(id) ON DELETE SET NULL,
        nome VARCHAR(500) NOT NULL,
        arquivo_url TEXT NOT NULL,
        mime_type VARCHAR(100),
        tamanho_bytes BIGINT,
        observacao TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dp_documentos ON dp_documentos(pasta_id)`);
    // Seed das 3 pastas padrao
    await queryRunner.query(`
      INSERT INTO dp_pastas (nome, ordem)
      SELECT v.nome, v.ordem FROM (VALUES
        ('DOCS EMPRESA', 1),
        ('DOCS VIGILANCIA', 2),
        ('DOCS MODELOS RH', 3)
      ) AS v(nome, ordem)
      WHERE NOT EXISTS (SELECT 1 FROM dp_pastas x WHERE x.nome = v.nome)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dp_documentos`);
    await queryRunner.query(`DROP TABLE IF EXISTS dp_subpastas`);
    await queryRunner.query(`DROP TABLE IF EXISTS dp_pastas`);
  }
}
