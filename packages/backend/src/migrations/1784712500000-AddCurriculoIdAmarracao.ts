import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amarra DISC e Pre-Entrevista ao curriculo de origem.
 * Permite que a tela de Curriculos mostre, por candidato:
 *   - se fez o teste DISC e qual o perfil (primario/secundario)
 *   - se fez a pre-entrevista com a Recrutadora IA
 */
export class AddCurriculoIdAmarracao1784712500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_disc_resultados
      ADD COLUMN IF NOT EXISTS curriculo_id INT NULL REFERENCES curriculos(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_disc_resultados_curriculo_id ON rh_disc_resultados(curriculo_id)
    `);

    await queryRunner.query(`
      ALTER TABLE rh_recrutador_entrevistas
      ADD COLUMN IF NOT EXISTS curriculo_id INT NULL REFERENCES curriculos(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_recrutador_entrevistas_curriculo_id ON rh_recrutador_entrevistas(curriculo_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_recrutador_entrevistas_curriculo_id`);
    await queryRunner.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS curriculo_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_disc_resultados_curriculo_id`);
    await queryRunner.query(`ALTER TABLE rh_disc_resultados DROP COLUMN IF EXISTS curriculo_id`);
  }
}
