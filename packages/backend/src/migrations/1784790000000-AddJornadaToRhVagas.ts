import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adiciona coluna jornada_id em rh_vagas pra ligar a vaga a uma jornada cadastrada. */
export class AddJornadaToRhVagas1784790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS jornada_id INT`);
    // FK opcional — so cria se a tabela de jornadas existir e a constraint ainda nao existe
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rh_jornadas')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE table_name='rh_vagas' AND constraint_name='rh_vagas_jornada_id_fkey'
           )
        THEN
          ALTER TABLE rh_vagas
            ADD CONSTRAINT rh_vagas_jornada_id_fkey
            FOREIGN KEY (jornada_id) REFERENCES rh_jornadas(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // sem rollback — campo opcional
  }
}
