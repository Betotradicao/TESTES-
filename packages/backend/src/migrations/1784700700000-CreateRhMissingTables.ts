import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria mais tabelas RH base com IF NOT EXISTS pra clientes novos.
 * Em clientes antigos: no-op (tabelas ja existem via synchronize legacy).
 *
 * Tabelas: rh_disc_resultados, rh_apontamento_campos, rh_documentos,
 * rh_dependentes, rh_escalas (sem domingo), rh_lancamentos_financeiros.
 */
export class CreateRhMissingTables1784700700000 implements MigrationInterface {
  name = 'CreateRhMissingTables1784700700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // rh_disc_resultados — referenciada por AddCurriculoIdAmarracao
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_disc_resultados (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        colaborador_id INT NULL,
        candidato_id INT NULL,
        perfil_primario VARCHAR(2) NULL,
        perfil_secundario VARCHAR(2) NULL,
        score_d INT DEFAULT 0,
        score_i INT DEFAULT 0,
        score_s INT DEFAULT 0,
        score_c INT DEFAULT 0,
        respostas JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // rh_apontamento_campos — campos customizados de proventos/descontos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_apontamento_campos (
        id SERIAL PRIMARY KEY,
        chave VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        ordem INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // rh_documentos NAO criada aqui — CreateRhDocumentacaoTables (1784702000000)
    // tem schema proprio (pasta_id, arquivo_url, etc).

    // rh_dependentes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_dependentes (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NULL,
        nome VARCHAR(255) NOT NULL,
        parentesco VARCHAR(50) NULL,
        cpf VARCHAR(14) NULL,
        data_nascimento DATE NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // rh_lancamentos_financeiros
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_lancamentos_financeiros (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NULL,
        tipo VARCHAR(50) NOT NULL,
        valor NUMERIC(10,2) NOT NULL,
        descricao TEXT NULL,
        data_lancamento DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabelas auxiliares simples (lookups)
    const lookupTables = [
      'rh_ausencias',
      'rh_formas_pagamento',
      'rh_motivos_ausencia',
      'rh_motivos_desligamento',
      'rh_tipos_ausencia',
      'rh_tipos_desligamento',
      'rh_tipos_treinamento',
      'rh_status_treinamento',
      'rh_prazos_experiencia',
      'rh_treinamentos',
      'rh_historico_alteracoes',
      'rh_vagas',
    ];
    for (const t of lookupTables) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS ${t} (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(255) NULL,
          descricao TEXT NULL,
          ativo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
