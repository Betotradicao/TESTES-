import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conserta tabelas auxiliares de RH que estavam faltando colunas:
 *
 * 1. updated_at (TIMESTAMP) em todas — sem isso o deletarConfig/atualizarConfig
 *    do RhController falham silenciosamente (sql usa "updated_at = NOW()" no
 *    UPDATE). Isso fazia exclusao e edicao nao funcionarem em Tipos Desligamento,
 *    Formas Pagamento, etc.
 *
 * 2. dias (INT) em rh_prazos_experiencia — controller tenta inserir esse campo
 *    mas a coluna nao existia, fazendo o INSERT falhar e novos prazos nao
 *    salvarem.
 *
 * Idempotente: usa ADD COLUMN IF NOT EXISTS.
 */
export class FixRhConfigTablesColumns1784722000000 implements MigrationInterface {
  name = 'FixRhConfigTablesColumns1784722000000';

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
      'rh_beneficios',
      'rh_epis_epcs',
      'rh_escolaridades',
    ];

    // 1. Adiciona updated_at se faltar
    for (const t of tabelas) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS public.${t} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
      );
    }

    // 2. Colunas faltantes em tabelas especificas que faziam INSERT/UPDATE falharem
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.rh_prazos_experiencia ADD COLUMN IF NOT EXISTS dias INT`
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.rh_tipos_ausencia ADD COLUMN IF NOT EXISTS cor VARCHAR(20)`
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.rh_tipos_treinamento ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)`
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.rh_status_treinamento ADD COLUMN IF NOT EXISTS cor VARCHAR(20)`
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Sem rollback (manter colunas pra evitar quebra)
  }
}
