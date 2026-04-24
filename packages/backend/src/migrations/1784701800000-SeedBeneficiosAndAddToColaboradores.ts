import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona beneficios_ids em rh_colaboradores (array de IDs de beneficios selecionados)
 * e popula rh_beneficios com os 3 beneficios padroes (Vale Transporte, Vale Refeicao, Plano de Saude)
 */
export class SeedBeneficiosAndAddToColaboradores1784701800000 implements MigrationInterface {
  name = 'SeedBeneficiosAndAddToColaboradores1784701800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Coluna array de IDs de beneficios selecionados pelo colaborador
    await queryRunner.query(`
      ALTER TABLE "rh_colaboradores"
      ADD COLUMN IF NOT EXISTS "beneficios_ids" INT[] DEFAULT '{}'
    `);

    // Seed dos beneficios padrao (idempotente)
    await queryRunner.query(`
      INSERT INTO rh_beneficios (nome, descricao, ativo)
      SELECT 'VALE TRANSPORTE', 'Conceder vale transporte ao colaborador', true
      WHERE NOT EXISTS (SELECT 1 FROM rh_beneficios WHERE UPPER(TRIM(nome)) = 'VALE TRANSPORTE')
    `);
    await queryRunner.query(`
      INSERT INTO rh_beneficios (nome, descricao, ativo)
      SELECT 'VALE REFEICAO', 'Conceder vale refeicao ao colaborador', true
      WHERE NOT EXISTS (SELECT 1 FROM rh_beneficios WHERE UPPER(TRIM(nome)) = 'VALE REFEICAO')
    `);
    await queryRunner.query(`
      INSERT INTO rh_beneficios (nome, descricao, ativo)
      SELECT 'PLANO DE SAUDE', 'Incluir colaborador no plano de saude', true
      WHERE NOT EXISTS (SELECT 1 FROM rh_beneficios WHERE UPPER(TRIM(nome)) = 'PLANO DE SAUDE')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_colaboradores" DROP COLUMN IF EXISTS "beneficios_ids"`);
  }
}
