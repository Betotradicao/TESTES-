import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona coluna selecionados (JSONB) em rh_vagas.
 *
 * Estrutura de cada item:
 * {
 *   curriculo_id: number,
 *   nome: string,
 *   adicionado_em: ISO string,
 *   entrevista: 'agendada' | 'realizada' | null,
 *   data_entrevista: ISO date | null,        // quando agendada
 *   resultado_entrevista: 'passou' | 'aguarda_decisao' | 'nao_compareceu' | 'reprovado' | 'desistiu' | null,
 *   motivo_reprovacao: string | null,
 *   pos_entrevista: 'aguarda_agendar_exames' | 'aguarda_resultado_exames' | 'aprovado_exames' | 'reprovado_exames' | null,
 *   data_agendar_exames: ISO date | null,
 *   data_resultado_exames: ISO date | null,
 *   contratado: boolean,
 *   colaborador_id: number | null,
 *   historico: [{ campo, valor, em }]
 * }
 */
export class AddSelecionadosToRhVagas1784716000000 implements MigrationInterface {
  name = 'AddSelecionadosToRhVagas1784716000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='rh_vagas' AND column_name='selecionados'`
    );
    if (has.length === 0) {
      await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN selecionados jsonb NOT NULL DEFAULT '[]'::jsonb`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas DROP COLUMN IF EXISTS selecionados`);
  }
}
