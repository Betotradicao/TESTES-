import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentoSubpastas1784702200000 implements MigrationInterface {
  name = 'CreateDocumentoSubpastas1784702200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_subpastas (
        id SERIAL PRIMARY KEY,
        pasta_id INT NOT NULL REFERENCES rh_documento_pastas(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        obrigatorio BOOLEAN DEFAULT false,
        ordem INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subpastas_pasta ON rh_documento_subpastas(pasta_id)`);
    await queryRunner.query(`
      ALTER TABLE rh_documentos
      ADD COLUMN IF NOT EXISTS subpasta_id INT NULL REFERENCES rh_documento_subpastas(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_documentos DROP COLUMN IF EXISTS subpasta_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_subpastas`);
  }
}
