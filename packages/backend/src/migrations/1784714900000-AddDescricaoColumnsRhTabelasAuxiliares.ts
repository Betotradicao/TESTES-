import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garante que todas as tabelas auxiliares de RH tenham a coluna `descricao`.
 * Algumas instalacoes antigas criaram essas tabelas sem essa coluna,
 * o que faz o seed SeedRhConfiguracoesPadrao falhar com:
 *   "column 'descricao' of relation 'X' does not exist"
 *
 * Roda ANTES de 1784715000000-SeedRhConfiguracoesPadrao.
 * Idempotente: usa ADD COLUMN IF NOT EXISTS.
 */
export class AddDescricaoColumnsRhTabelasAuxiliares1784714900000 implements MigrationInterface {
  name = 'AddDescricaoColumnsRhTabelasAuxiliares1784714900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabelas = [
      'rh_cargos',
      'rh_jornadas',
      'rh_escalas',
      'rh_escalas_domingo',
      'rh_regimes_trabalho',
      'rh_formas_pagamento',
      'rh_prazos_experiencia',
      'rh_tipos_desligamento',
      'rh_motivos_desligamento',
      'rh_tipos_ausencia',
      'rh_tipos_treinamento',
      'rh_status_treinamento',
      'rh_epis_epcs',
    ];
    for (const t of tabelas) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS public.${t} ADD COLUMN IF NOT EXISTS descricao TEXT`
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // sem rollback (manter coluna)
  }
}
