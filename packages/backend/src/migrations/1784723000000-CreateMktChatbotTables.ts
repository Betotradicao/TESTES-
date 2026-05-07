import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estrutura do Chatbot/Agente IA do Marketing — modelo "fluxograma" (estilo n8n simplificado).
 *
 * Diferente de uma arvore parent-filho, aqui usamos GRAFO:
 * - Blocos: caixas tipadas no canvas (mensagem, pergunta, ia, atendente, encerrar)
 * - Conexoes: arestas entre blocos. Uma conexao pode ter "condicao" (ex: opcao "1") que
 *   determina quando segui-la
 *
 * Vantagens vs arvore:
 * - Permite loops (voltar ao menu)
 * - Multiplas conexoes saindo do mesmo bloco
 * - Conectar nos arbitrarios (nao precisa ter "filhos")
 */
export class CreateMktChatbotTables1784723000000 implements MigrationInterface {
  name = 'CreateMktChatbotTables1784723000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== FLUXOS ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_fluxos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        ativo BOOLEAN NOT NULL DEFAULT true,
        instance_name VARCHAR(255),
        mensagem_primeira_vez TEXT,
        mensagem_recorrente TEXT,
        timeout_inatividade_min INT NOT NULL DEFAULT 1440,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ========== BLOCOS (caixas no canvas) ==========
    // tipo: 'mensagem' | 'pergunta' | 'ia' | 'atendente' | 'encerrar'
    // dados: JSONB com config especifica por tipo
    //   mensagem: { texto, delay_segundos, mostrar_typing, link, midia_url, midia_tipo }
    //   pergunta: { texto, delay_segundos, mostrar_typing, opcoes: [{numero, label}] }
    //   ia: { prompt_sistema, persona, modelo, temperatura }
    //   atendente: { mensagem_transferencia }
    //   encerrar: { mensagem_despedida }
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_blocos (
        id SERIAL PRIMARY KEY,
        fluxo_id INT NOT NULL REFERENCES mkt_chatbot_fluxos(id) ON DELETE CASCADE,
        tipo VARCHAR(30) NOT NULL,
        nome VARCHAR(255),
        posicao_x INT NOT NULL DEFAULT 0,
        posicao_y INT NOT NULL DEFAULT 0,
        dados JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_inicial BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chatbot_blocos_fluxo ON mkt_chatbot_blocos(fluxo_id)`);

    // ========== CONEXOES (arestas) ==========
    // condicao: null = padrao (qualquer resposta segue)
    // condicao: '1', '2'... = segue se a resposta da pergunta bater com esse valor
    // condicao: '*' = fallback (se nada bater)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_conexoes (
        id SERIAL PRIMARY KEY,
        fluxo_id INT NOT NULL REFERENCES mkt_chatbot_fluxos(id) ON DELETE CASCADE,
        origem_id INT NOT NULL REFERENCES mkt_chatbot_blocos(id) ON DELETE CASCADE,
        destino_id INT NOT NULL REFERENCES mkt_chatbot_blocos(id) ON DELETE CASCADE,
        condicao VARCHAR(50),
        label VARCHAR(255),
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_conexoes_fluxo ON mkt_chatbot_conexoes(fluxo_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_conexoes_origem ON mkt_chatbot_conexoes(origem_id);
    `);

    // ========== CONTATOS ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_contatos (
        id SERIAL PRIMARY KEY,
        telefone VARCHAR(30) NOT NULL UNIQUE,
        nome_whatsapp VARCHAR(255),
        primeira_msg_at TIMESTAMP,
        ultima_msg_at TIMESTAMP,
        total_msgs INT NOT NULL DEFAULT 0,
        bloqueado BOOLEAN NOT NULL DEFAULT false,
        observacao TEXT,
        variaveis JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chatbot_contatos_tel ON mkt_chatbot_contatos(telefone)`);

    // ========== SESSOES ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_sessoes (
        id SERIAL PRIMARY KEY,
        contato_id INT NOT NULL REFERENCES mkt_chatbot_contatos(id) ON DELETE CASCADE,
        fluxo_id INT NOT NULL REFERENCES mkt_chatbot_fluxos(id) ON DELETE CASCADE,
        bloco_atual_id INT REFERENCES mkt_chatbot_blocos(id) ON DELETE SET NULL,
        iniciada_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ultima_atividade_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finalizada_at TIMESTAMP,
        status VARCHAR(30) NOT NULL DEFAULT 'ativa',
        contexto_ia JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessoes_contato ON mkt_chatbot_sessoes(contato_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessoes_status ON mkt_chatbot_sessoes(status) WHERE status = 'ativa';
    `);

    // ========== MENSAGENS ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mkt_chatbot_mensagens (
        id SERIAL PRIMARY KEY,
        sessao_id INT NOT NULL REFERENCES mkt_chatbot_sessoes(id) ON DELETE CASCADE,
        direcao VARCHAR(10) NOT NULL,
        conteudo TEXT NOT NULL,
        bloco_id INT REFERENCES mkt_chatbot_blocos(id) ON DELETE SET NULL,
        whatsapp_message_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chatbot_mensagens_sessao ON mkt_chatbot_mensagens(sessao_id, created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_mensagens`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_sessoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_contatos`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_conexoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_blocos`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_fluxos`);
  }
}
