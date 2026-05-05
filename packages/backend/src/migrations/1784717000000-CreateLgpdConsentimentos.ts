import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria tabela de consentimentos LGPD do tenant.
 * Registra aceites de Termos de Uso, Politica de Privacidade e DPA com prova
 * (IP, user-agent, timestamp, hash do conteudo, versao).
 *
 * E uma das tabelas mais sensiveis do sistema - serve como prova legal de
 * que o representante da empresa aceitou os termos.
 */
export class CreateLgpdConsentimentos1784717000000 implements MigrationInterface {
  name = 'CreateLgpdConsentimentos1784717000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lgpd_consentimentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo VARCHAR(50) NOT NULL,
        versao VARCHAR(20) NOT NULL,
        hash_conteudo VARCHAR(64) NOT NULL,
        titular_tipo VARCHAR(20) NOT NULL,
        titular_id VARCHAR(100) NOT NULL,
        titular_nome VARCHAR(255),
        titular_cpf_hash VARCHAR(64),
        titular_email VARCHAR(255),
        ip VARCHAR(45),
        user_agent TEXT,
        observacoes TEXT,
        arquivo_assinado_url TEXT,
        aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revogado_em TIMESTAMPTZ,
        motivo_revogacao TEXT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lgpd_titular ON lgpd_consentimentos(titular_tipo, titular_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lgpd_tipo ON lgpd_consentimentos(tipo)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lgpd_aceito_em ON lgpd_consentimentos(aceito_em DESC)`);

    // Tabela de configuracoes LGPD do tenant (retencao, DPO, etc)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lgpd_configuracoes (
        id SERIAL PRIMARY KEY,
        dpo_nome VARCHAR(255),
        dpo_email VARCHAR(255),
        dpo_telefone VARCHAR(50),
        retencao_curriculos_meses INT DEFAULT 12,
        retencao_logs_meses INT DEFAULT 12,
        retencao_gravacoes_dias INT DEFAULT 30,
        politica_privacidade_url TEXT,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Insere config default se vazio
    await queryRunner.query(`
      INSERT INTO lgpd_configuracoes (id, dpo_nome, dpo_email, retencao_curriculos_meses, retencao_logs_meses, retencao_gravacoes_dias)
      SELECT 1, '', '', 12, 12, 30
      WHERE NOT EXISTS (SELECT 1 FROM lgpd_configuracoes WHERE id = 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lgpd_configuracoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS lgpd_consentimentos`);
  }
}
