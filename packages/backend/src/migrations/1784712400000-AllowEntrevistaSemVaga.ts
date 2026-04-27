import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite entrevistas SEM vaga associada (pré-entrevista exploratória pós-currículo).
 * Antes: vaga_id INT NOT NULL. Agora: NULLABLE.
 */
export class AllowEntrevistaSemVaga1784712400000 implements MigrationInterface {
  name = 'AllowEntrevistaSemVaga1784712400000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_entrevistas ALTER COLUMN vaga_id DROP NOT NULL`);
    // Adiciona flag pra identificar pre-entrevistas exploratorias
    await q.query(`ALTER TABLE rh_recrutador_entrevistas ADD COLUMN IF NOT EXISTS tipo_entrevista VARCHAR(30) DEFAULT 'vaga_especifica'`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS tipo_entrevista`);
    await q.query(`ALTER TABLE rh_recrutador_entrevistas ALTER COLUMN vaga_id SET NOT NULL`);
  }
}
