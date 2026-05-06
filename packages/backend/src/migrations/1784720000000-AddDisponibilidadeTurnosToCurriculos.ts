import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona coluna `disponibilidade_turnos` (JSONB) na tabela curriculos.
 * Guarda array de strings: 'manha' | 'intermediario' | 'tarde' | 'qualquer'.
 */
export class AddDisponibilidadeTurnosToCurriculos1784720000000 implements MigrationInterface {
  name = 'AddDisponibilidadeTurnosToCurriculos1784720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE curriculos
        ADD COLUMN IF NOT EXISTS disponibilidade_turnos JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE curriculos DROP COLUMN IF EXISTS disponibilidade_turnos`);
  }
}
