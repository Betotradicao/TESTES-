import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Popula rh_departamentos com os setores ja cadastrados na tabela sectors.
 * Insere apenas os nomes que ainda nao existem em rh_departamentos (idempotente).
 */
export class SeedRhDepartamentosFromSectors1784701600000 implements MigrationInterface {
  name = 'SeedRhDepartamentosFromSectors1784701600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verifica se a tabela sectors existe antes de tentar copiar
    const sectorsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'sectors'
    `);
    if (!sectorsExists || sectorsExists.length === 0) return;

    await queryRunner.query(`
      INSERT INTO rh_departamentos (nome, ativo)
      SELECT DISTINCT UPPER(TRIM(s.name)) AS nome, true
      FROM sectors s
      WHERE s.name IS NOT NULL
        AND TRIM(s.name) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM rh_departamentos d
          WHERE UPPER(TRIM(d.nome)) = UPPER(TRIM(s.name))
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Nao remove automaticamente - usuario pode ter editado dados
  }
}
