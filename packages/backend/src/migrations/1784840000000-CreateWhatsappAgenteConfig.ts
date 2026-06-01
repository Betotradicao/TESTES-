import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agente IA do WhatsApp - configuracao (1 linha global) + log de auditoria
 *
 * O agente recebe mensagens via webhook da Evolution API, processa com GPT
 * e responde no grupo configurado. Cada mensagem que vira "tool call"
 * (consulta ao banco) ou acao destrutiva eh logada em whatsapp_agente_logs.
 */
export class CreateWhatsappAgenteConfig1784840000000 implements MigrationInterface {
  name = 'CreateWhatsappAgenteConfig1784840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============ CONFIGURACAO (1 linha) ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_agente_config (
        id SERIAL PRIMARY KEY,
        ativo BOOLEAN NOT NULL DEFAULT false,

        -- Conexao
        group_id VARCHAR(120) NULL,
        group_name VARCHAR(200) NULL,
        prefixo VARCHAR(20) NOT NULL DEFAULT '@radar',
        whitelist_numeros TEXT[] DEFAULT '{}',
        horario_inicio TIME NOT NULL DEFAULT '07:00',
        horario_fim TIME NOT NULL DEFAULT '22:00',
        dias_semana TEXT[] DEFAULT '{seg,ter,qua,qui,sex,sab}',
        mensagem_fora_horario TEXT DEFAULT 'Bom dia! Volto às 07:00 👋',

        -- Persona
        nome_agente VARCHAR(80) NOT NULL DEFAULT 'Radar',
        avatar_emoji VARCHAR(10) NOT NULL DEFAULT '🤖',
        persona_descricao TEXT NOT NULL DEFAULT 'Assistente de gestao do supermercado. Responde sobre vendas, quebras, fornecedores, estoque e RH.',
        tom_comunicacao VARCHAR(40) NOT NULL DEFAULT 'profissional',
        modelo_ia VARCHAR(60) NOT NULL DEFAULT 'gpt-4o-mini',
        max_tokens_resposta INT NOT NULL DEFAULT 800,
        temperatura NUMERIC(3,2) NOT NULL DEFAULT 0.5,
        instrucoes_extras TEXT NOT NULL DEFAULT '',

        -- Tools habilitadas (JSON: { tool_name: true/false })
        tools_habilitadas JSONB NOT NULL DEFAULT '{}',

        -- Notificacoes proativas (JSON: { tipo: { ativo, horario, parametros } })
        notificacoes_proativas JSONB NOT NULL DEFAULT '{}',

        -- Limites
        budget_mensal_brl NUMERIC(10,2) DEFAULT 50.00,
        alertar_em_pct INT DEFAULT 80,
        bloquear_em_pct INT DEFAULT 100,
        gasto_mes_atual_brl NUMERIC(10,2) DEFAULT 0,
        mes_referencia_gasto VARCHAR(7) NULL,

        -- Lojas/setores acessiveis
        lojas_permitidas TEXT[] DEFAULT '{}',
        setores_permitidos TEXT[] DEFAULT '{}',
        esconder_custo BOOLEAN NOT NULL DEFAULT true,

        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Seed inicial com config default
    await queryRunner.query(`
      INSERT INTO whatsapp_agente_config (ativo, nome_agente, persona_descricao)
      SELECT false, 'Radar', 'Assistente de gestao do supermercado'
      WHERE NOT EXISTS (SELECT 1 FROM whatsapp_agente_config)
    `);

    // ============ LOG DE AUDITORIA ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_agente_logs (
        id SERIAL PRIMARY KEY,
        timestamp_recebido TIMESTAMP NOT NULL DEFAULT NOW(),
        timestamp_respondido TIMESTAMP NULL,

        -- Quem enviou
        from_number VARCHAR(80) NOT NULL,
        from_name VARCHAR(200),
        group_id VARCHAR(120),
        group_name VARCHAR(200),

        -- Conteudo
        mensagem_recebida TEXT NOT NULL,
        resposta_enviada TEXT,

        -- Tool chamada (se houve)
        tool_name VARCHAR(80),
        tool_params JSONB,
        tool_resultado JSONB,

        -- Tokens / custo
        tokens_input INT DEFAULT 0,
        tokens_output INT DEFAULT 0,
        custo_estimado_brl NUMERIC(10,4) DEFAULT 0,
        modelo VARCHAR(60),

        -- Status
        sucesso BOOLEAN DEFAULT true,
        erro TEXT,
        ignorada BOOLEAN DEFAULT false,
        motivo_ignorada VARCHAR(80)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wa_agente_logs_ts ON whatsapp_agente_logs(timestamp_recebido DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wa_agente_logs_from ON whatsapp_agente_logs(from_number, timestamp_recebido DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_wa_agente_logs_from`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_wa_agente_logs_ts`);
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_agente_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_agente_config`);
  }
}
