import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhDocumentacaoTables1784702000000 implements MigrationInterface {
  name = 'CreateRhDocumentacaoTables1784702000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_pastas (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(colaborador_id, nome)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_doc_pastas_colab ON rh_documento_pastas(colaborador_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documentos (
        id SERIAL PRIMARY KEY,
        pasta_id INT NOT NULL REFERENCES rh_documento_pastas(id) ON DELETE CASCADE,
        nome VARCHAR(500) NOT NULL,
        arquivo_url TEXT NOT NULL,
        mime_type VARCHAR(100),
        tamanho_bytes BIGINT,
        observacao TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_documentos_pasta ON rh_documentos(pasta_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documentos`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_pastas`);
  }
}
