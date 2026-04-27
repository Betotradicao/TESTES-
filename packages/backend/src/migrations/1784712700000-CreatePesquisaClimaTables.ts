import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modulo Pesquisa de Clima (RH).
 *
 * Estrutura:
 *   pesquisa_modelos      - template reutilizavel (1 modelo, varias rodadas)
 *   pesquisa_perguntas    - perguntas do template
 *   pesquisa_rodadas      - cada execucao do modelo (gera token publico)
 *   pesquisa_respostas    - cabecalho da resposta anonima
 *   pesquisa_resp_itens   - cada pergunta respondida
 *
 * Seed: cria automaticamente o modelo "Pesquisa de Satisfacao - Supermercado Tradicao"
 * com as 26 perguntas do Google Forms original (clone fiel).
 */
export class CreatePesquisaClimaTables1784712700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============ TABELAS ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pesquisa_modelos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        cor VARCHAR(20) NULL,
        icone VARCHAR(20) NULL,
        ativa BOOLEAN DEFAULT TRUE,
        anonima BOOLEAN DEFAULT TRUE,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pesquisa_perguntas (
        id SERIAL PRIMARY KEY,
        modelo_id INT NOT NULL REFERENCES pesquisa_modelos(id) ON DELETE CASCADE,
        secao VARCHAR(100) NULL,
        ordem INT DEFAULT 0,
        tipo VARCHAR(50) NOT NULL,
        enunciado TEXT NOT NULL,
        obrigatoria BOOLEAN DEFAULT FALSE,
        configuracao JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_perguntas_modelo ON pesquisa_perguntas(modelo_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pesquisa_rodadas (
        id SERIAL PRIMARY KEY,
        modelo_id INT NOT NULL REFERENCES pesquisa_modelos(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        token_publico VARCHAR(64) NOT NULL UNIQUE,
        aberta BOOLEAN DEFAULT TRUE,
        abre_em TIMESTAMP NULL,
        fecha_em TIMESTAMP NULL,
        total_respostas INT DEFAULT 0,
        nps_medio NUMERIC(5,2) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_rodadas_modelo ON pesquisa_rodadas(modelo_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_rodadas_token ON pesquisa_rodadas(token_publico)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pesquisa_respostas (
        id SERIAL PRIMARY KEY,
        rodada_id INT NOT NULL REFERENCES pesquisa_rodadas(id) ON DELETE CASCADE,
        ip_hash VARCHAR(64) NULL,
        user_agent_hash VARCHAR(64) NULL,
        finalizada_em TIMESTAMP DEFAULT NOW(),
        tempo_segundos INT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_respostas_rodada ON pesquisa_respostas(rodada_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pesquisa_resp_itens (
        id SERIAL PRIMARY KEY,
        resposta_id INT NOT NULL REFERENCES pesquisa_respostas(id) ON DELETE CASCADE,
        pergunta_id INT NOT NULL REFERENCES pesquisa_perguntas(id) ON DELETE CASCADE,
        valor_numerico NUMERIC(10,2) NULL,
        valor_texto TEXT NULL,
        valor_opcoes JSONB NULL,
        valor_matriz JSONB NULL,
        colaborador_id_avaliado INT NULL,
        setor_id_avaliado INT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_resp_itens_resposta ON pesquisa_resp_itens(resposta_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pesquisa_resp_itens_pergunta ON pesquisa_resp_itens(pergunta_id)`);

    // ============ SEED: Pesquisa de Satisfacao - Supermercado Tradicao ============
    const exists = await queryRunner.query(
      `SELECT id FROM pesquisa_modelos WHERE nome = 'Pesquisa de Satisfação - Supermercado Tradição' LIMIT 1`
    );
    if (exists.length > 0) return;

    const [modelo] = await queryRunner.query(`
      INSERT INTO pesquisa_modelos (nome, descricao, cor, icone, ativa, anonima)
      VALUES (
        'Pesquisa de Satisfação - Supermercado Tradição',
        'A loja valoriza o feedback dos clientes para melhorar o atendimento e a qualidade dos produtos. As respostas são anônimas.',
        'orange',
        '🛒',
        TRUE,
        TRUE
      )
      RETURNING id
    `);
    const modeloId = modelo.id;

    // Tipos suportados:
    //   rating_5_matriz   - tabela com 1 a 5 estrelas em varios criterios
    //   multipla_escolha  - radio (uma opcao)
    //   checkbox          - varios checkboxes (varias opcoes)
    //   texto_curto       - input single-line
    //   texto_longo       - textarea
    //   nps_0_10          - barra 0-10 NPS
    //   sim_nao           - radio Sim/Nao

    const insert = async (secao: string, ordem: number, tipo: string, enunciado: string, config: any, obrig = false) => {
      await queryRunner.query(
        `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [modeloId, secao, ordem, tipo, enunciado, obrig, JSON.stringify(config || {})]
      );
    };

    // Critérios padrão dos setores (de atendimento)
    const criteriosCompleto = ['Simpatia do atendente', 'Limpeza', 'Agilidade', 'Organização', 'Qualidade dos produtos', 'Variedade', 'Preço'];
    const criteriosSemAtendente = ['Limpeza', 'Organização', 'Qualidade dos produtos', 'Variedade', 'Preço', 'Atendimento dos funcionários'];
    const criteriosMercearia = ['Limpeza', 'Organização das gôndolas', 'Variedade', 'Preço', 'Atendimento dos funcionários'];
    const criteriosCaixas = ['Simpatia do operador', 'Limpeza', 'Agilidade', 'Organização'];

    const motivosCompra = ['Preço', 'Qualidade', 'Variedade', 'Agilidade', 'Atendimento', 'Limpeza'];
    const motivosAbandono = ['Sou cliente atual', 'Outro'];
    const interesseSelfService = ['Sim, gostaria muito', 'Talvez', 'Não tenho interesse', 'Outro'];

    // ===== PADARIA =====
    await insert('Padaria', 1, 'rating_5_matriz', 'Como você avalia a Padaria?', { criterios: criteriosCompleto });
    await insert('Padaria', 2, 'multipla_escolha', 'Qual o principal motivo de você comprar na Padaria?', { opcoes: motivosCompra });
    await insert('Padaria', 3, 'multipla_escolha', 'Por qual motivo você não compra mais na Padaria?', { opcoes: motivosAbandono });
    await insert('Padaria', 4, 'multipla_escolha', 'Você teria interesse em pão tipo self-service (auto-atendimento)?', { opcoes: interesseSelfService });
    await insert('Padaria', 5, 'texto_longo', 'Sugestões de melhorias para a Padaria', {});

    // ===== AÇOUGUE =====
    await insert('Açougue', 6, 'rating_5_matriz', 'Como você avalia o Açougue?', { criterios: criteriosCompleto });
    await insert('Açougue', 7, 'multipla_escolha', 'Qual o principal motivo de você comprar no Açougue?', { opcoes: motivosCompra });
    await insert('Açougue', 8, 'multipla_escolha', 'Por qual motivo você não compra mais no Açougue?', { opcoes: motivosAbandono });
    await insert('Açougue', 9, 'multipla_escolha', 'Você teria interesse em uma vitrine de carnes pré-cortadas?', { opcoes: ['Sim, facilita muito', 'Talvez', 'Prefiro corte na hora', 'Outro'] });
    await insert('Açougue', 10, 'texto_longo', 'Sugestões de melhorias para o Açougue', {});

    // ===== HORTIFRUTI =====
    await insert('Hortifruti', 11, 'rating_5_matriz', 'Como você avalia o Hortifruti?', { criterios: criteriosSemAtendente });
    await insert('Hortifruti', 12, 'multipla_escolha', 'Qual o principal motivo de você comprar no Hortifruti?', { opcoes: motivosCompra });
    await insert('Hortifruti', 13, 'multipla_escolha', 'Por qual motivo você não compra mais no Hortifruti?', { opcoes: motivosAbandono });
    await insert('Hortifruti', 14, 'texto_longo', 'Sugestões de melhorias para o Hortifruti', {});

    // ===== MERCEARIA =====
    await insert('Mercearia', 15, 'rating_5_matriz', 'Como você avalia a Mercearia?', { criterios: criteriosMercearia });
    await insert('Mercearia', 16, 'texto_longo', 'Sugestões de melhorias para a Mercearia', {});

    // ===== CAIXAS =====
    await insert('Caixas', 17, 'rating_5_matriz', 'Como você avalia os Caixas?', { criterios: criteriosCaixas });
    await insert('Caixas', 18, 'texto_longo', 'Sugestões de melhorias para os Caixas', {});

    // ===== GERAL =====
    await insert('Geral', 19, 'texto_longo', 'Existe algum produto que você gostaria de encontrar e que nós ainda não oferecemos?', {});
    await insert('Geral', 20, 'multipla_escolha', 'O que você acha das nossas promoções e descontos?', {
      opcoes: ['São excelentes', 'São boas', 'São razoáveis', 'Poderiam melhorar']
    });
    await insert('Geral', 21, 'multipla_escolha', 'Você teria interesse em um aplicativo de descontos ativados pelo CPF?', {
      opcoes: ['Sim, com certeza usaria', 'Talvez usaria', 'Não tenho interesse', 'Outro']
    });
    await insert('Geral', 22, 'checkbox', 'Como você fica sabendo das nossas ofertas? (pode marcar mais de uma)', {
      opcoes: ['WhatsApp', 'Facebook / Instagram', 'Rádio interna da loja', 'Boca a boca / amigos']
    });
    await insert('Geral', 23, 'texto_longo', 'Quais supermercados concorrentes você frequenta e por quê?', {});
    await insert('Geral', 24, 'multipla_escolha', 'Você sabia que temos estacionamento próprio?', {
      opcoes: ['Sim, conhecia', 'Não conhecia', 'Conheço mas não uso']
    });
    await insert('Geral', 25, 'multipla_escolha', 'Qual horário de abertura você acha ideal?', {
      opcoes: ['7:30 ou antes', '8:00', '8:30', 'Está bom como está']
    });
    await insert('Geral', 26, 'texto_longo', 'Sugestões gerais para melhorar sua experiência na loja', {});
    await insert('Geral', 27, 'nps_0_10', 'Em uma escala de 0 a 10, o quanto você recomendaria nosso supermercado a um amigo ou familiar?', {}, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pesquisa_resp_itens`);
    await queryRunner.query(`DROP TABLE IF EXISTS pesquisa_respostas`);
    await queryRunner.query(`DROP TABLE IF EXISTS pesquisa_rodadas`);
    await queryRunner.query(`DROP TABLE IF EXISTS pesquisa_perguntas`);
    await queryRunner.query(`DROP TABLE IF EXISTS pesquisa_modelos`);
  }
}
