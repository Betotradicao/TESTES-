import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPausaToRhEscalaTurnos1784702800000 implements MigrationInterface {
  name = 'AddPausaToRhEscalaTurnos1784702800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_turnos
      ADD COLUMN IF NOT EXISTS pausa_minutos INT DEFAULT 0
    `);
    // Seed padroes CLT nos turnos existentes que sao "turno":
    //  - total_horas > 6  => pausa 60 min
    //  - total_horas entre 4 e 6 => pausa 15 min
    //  - outros => 0
    // E atualiza total_horas pra ser hora_fim - hora_inicio - pausa (horas liquidas)
    await queryRunner.query(`
      UPDATE rh_escala_turnos
      SET pausa_minutos = CASE
        WHEN tipo = 'turno' AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL
             AND EXTRACT(EPOCH FROM (
               CASE WHEN hora_fim < hora_inicio THEN hora_fim + INTERVAL '24 hours' ELSE hora_fim END - hora_inicio
             )) / 3600 > 6 THEN 60
        WHEN tipo = 'turno' AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL
             AND EXTRACT(EPOCH FROM (
               CASE WHEN hora_fim < hora_inicio THEN hora_fim + INTERVAL '24 hours' ELSE hora_fim END - hora_inicio
             )) / 3600 >= 4 THEN 15
        ELSE 0
      END
    `);
    // Recalcula total_horas = (hora_fim - hora_inicio) - pausa, em horas liquidas
    await queryRunner.query(`
      UPDATE rh_escala_turnos
      SET total_horas = ROUND(
        (EXTRACT(EPOCH FROM (
          CASE WHEN hora_fim < hora_inicio THEN hora_fim + INTERVAL '24 hours' ELSE hora_fim END - hora_inicio
        )) / 60 - pausa_minutos) / 60.0
      , 2)
      WHERE tipo = 'turno' AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_escala_turnos DROP COLUMN IF EXISTS pausa_minutos`);
  }
}
