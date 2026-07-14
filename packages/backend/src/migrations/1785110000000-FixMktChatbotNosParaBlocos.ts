import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conserta o schema do chatbot em bancos que rodaram a versao ANTIGA da
 * CreateMktChatbotTables1784723000000.
 *
 * O que aconteceu: aquela migration foi EDITADA depois de ja ter rodado em
 * producao. A versao original criava uma ARVORE (mkt_chatbot_nos com parent_id);
 * o arquivo foi reescrito pra criar um GRAFO (blocos + conexoes). Como o TypeORM
 * so guarda o NOME da migration, ela nunca re-executou: o banco ficou com o schema
 * velho e o codigo passou a esperar o novo. Resultado: `relation
 * "mkt_chatbot_blocos" does not exist` derrubando o backend inteiro.
 *
 * Esta migration e IDEMPOTENTE e cobre os dois cenarios:
 * - Banco antigo (tem `nos`): cria blocos/conexoes, converte os dados e aposenta `nos`
 * - Banco novo (ja tem `blocos`): nao faz nada
 *
 * Conversao arvore -> grafo:
 * - cada `no` vira um bloco
 * - cada par (parent -> filho) vira uma conexao com condicao = opcao_numero do filho
 * - no com filhos numerados vira 'pergunta' (os filhos viram as opcoes do menu)
 * - no is_final vira 'atendente'; demais viram 'mensagem'
 * - filho "opcao 0" sem filhos (o classico "Voltar ao Menu") ganha conexao
 *   automatica de volta pro bloco inicial — o loop que a arvore nao permitia
 */
export class FixMktChatbotNosParaBlocos1785110000000 implements MigrationInterface {
  name = 'FixMktChatbotNosParaBlocos1785110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Se nem o chatbot existe nesse banco, nao ha nada a consertar.
    const temFluxos = await queryRunner.query(`SELECT to_regclass('public.mkt_chatbot_fluxos') IS NOT NULL AS existe`);
    if (!temFluxos?.[0]?.existe) return;

    // ========== 1. TABELAS QUE FALTAM ==========
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
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chatbot_conexoes_fluxo ON mkt_chatbot_conexoes(fluxo_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chatbot_conexoes_origem ON mkt_chatbot_conexoes(origem_id)`);

    // ========== 2. COLUNAS QUE FALTAM ==========
    await queryRunner.query(`ALTER TABLE mkt_chatbot_contatos ADD COLUMN IF NOT EXISTS variaveis JSONB NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  ADD COLUMN IF NOT EXISTS contexto_ia JSONB DEFAULT '[]'::jsonb`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  ADD COLUMN IF NOT EXISTS bloco_atual_id INT`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_mensagens ADD COLUMN IF NOT EXISTS bloco_id INT`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatbot_sessoes_bloco_atual') THEN
          ALTER TABLE mkt_chatbot_sessoes ADD CONSTRAINT fk_chatbot_sessoes_bloco_atual
            FOREIGN KEY (bloco_atual_id) REFERENCES mkt_chatbot_blocos(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatbot_mensagens_bloco') THEN
          ALTER TABLE mkt_chatbot_mensagens ADD CONSTRAINT fk_chatbot_mensagens_bloco
            FOREIGN KEY (bloco_id) REFERENCES mkt_chatbot_blocos(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // ========== 3. CONVERSAO DOS DADOS (arvore -> grafo) ==========
    // So roda se sobrou a tabela antiga E os blocos ainda estao vazios.
    await queryRunner.query(`
      DO $$
      DECLARE
        v_max_id INT;
      BEGIN
        IF to_regclass('public.mkt_chatbot_nos') IS NULL THEN RETURN; END IF;
        IF EXISTS (SELECT 1 FROM mkt_chatbot_blocos) THEN RETURN; END IF;

        -- Reaproveita os ids antigos: blocos esta vazio, entao nao ha colisao.
        -- Isso mantem sessoes.no_atual_id e mensagens.no_id apontando certo.
        INSERT INTO mkt_chatbot_blocos
          (id, fluxo_id, tipo, nome, posicao_x, posicao_y, dados, is_inicial, created_at, updated_at)
        SELECT
          n.id,
          n.fluxo_id,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM mkt_chatbot_nos f
              WHERE f.parent_id = n.id AND COALESCE(f.opcao_numero, '') <> ''
            ) THEN 'pergunta'
            WHEN n.is_final THEN 'atendente'
            ELSE 'mensagem'
          END,
          n.opcao_label,
          COALESCE(p.nivel, 0) * 280,
          COALESCE(p.pos, 0) * 160,
          jsonb_strip_nulls(jsonb_build_object(
            'texto',          COALESCE(n.mensagem, ''),
            'delay_segundos', COALESCE(n.delay_segundos, 1),
            'mostrar_typing', COALESCE(n.mostrar_typing, true),
            'link_url',       n.link_url,
            'midia_url',      n.midia_url,
            'midia_tipo',     n.midia_tipo
          ))
          -- opcoes do menu: os filhos numerados viram a lista de opcoes
          || COALESCE((
               SELECT jsonb_build_object('opcoes', jsonb_agg(
                        jsonb_build_object('numero', f.opcao_numero, 'label', f.opcao_label)
                        ORDER BY f.ordem, f.id))
               FROM mkt_chatbot_nos f
               WHERE f.parent_id = n.id AND COALESCE(f.opcao_numero, '') <> ''
             ), '{}'::jsonb)
          -- bloco final: o engine le mensagem_transferencia/mensagem_despedida,
          -- nao 'texto'. Grava os dois pra nao perder o texto se o Roberto
          -- trocar o tipo do bloco depois.
          || CASE WHEN n.is_final THEN jsonb_build_object(
               'mensagem_transferencia', COALESCE(n.mensagem, ''),
               'mensagem_despedida',     COALESCE(n.mensagem, '')
             ) ELSE '{}'::jsonb END,
          COALESCE(n.is_inicial, false),
          n.created_at,
          n.updated_at
        FROM mkt_chatbot_nos n
        LEFT JOIN (
          WITH RECURSIVE arvore AS (
            SELECT id, 0 AS nivel,
                   (ROW_NUMBER() OVER (ORDER BY ordem, id))::int - 1 AS pos
            FROM mkt_chatbot_nos WHERE parent_id IS NULL
            UNION ALL
            SELECT f.id, a.nivel + 1,
                   (ROW_NUMBER() OVER (PARTITION BY f.parent_id ORDER BY f.ordem, f.id))::int - 1
            FROM mkt_chatbot_nos f JOIN arvore a ON f.parent_id = a.id
          )
          SELECT id, nivel, pos FROM arvore
        ) p ON p.id = n.id;

        -- sequence tem que pular pra frente, senao o proximo INSERT colide
        SELECT COALESCE(MAX(id), 0) INTO v_max_id FROM mkt_chatbot_blocos;
        PERFORM setval(pg_get_serial_sequence('mkt_chatbot_blocos', 'id'), GREATEST(v_max_id, 1));

        -- arestas: pai -> filho, condicao = numero da opcao do filho
        INSERT INTO mkt_chatbot_conexoes (fluxo_id, origem_id, destino_id, condicao, label, ordem)
        SELECT n.fluxo_id, n.parent_id, n.id, NULLIF(n.opcao_numero, ''), n.opcao_label, COALESCE(n.ordem, 0)
        FROM mkt_chatbot_nos n
        WHERE n.parent_id IS NOT NULL;

        -- "Voltar ao Menu": folha com opcao '0' volta pro inicial (loop)
        INSERT INTO mkt_chatbot_conexoes (fluxo_id, origem_id, destino_id, condicao, label, ordem)
        SELECT n.fluxo_id, n.id, ini.id, NULL, 'voltar ao menu', 0
        FROM mkt_chatbot_nos n
        JOIN LATERAL (
          SELECT b.id FROM mkt_chatbot_blocos b
          WHERE b.fluxo_id = n.fluxo_id AND b.is_inicial LIMIT 1
        ) ini ON true
        WHERE COALESCE(n.opcao_numero, '') = '0'
          AND NOT EXISTS (SELECT 1 FROM mkt_chatbot_nos f WHERE f.parent_id = n.id)
          AND ini.id <> n.id;

        -- ponteiros das sessoes/mensagens (ids foram preservados)
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'mkt_chatbot_sessoes' AND column_name = 'no_atual_id') THEN
          UPDATE mkt_chatbot_sessoes SET bloco_atual_id = no_atual_id WHERE no_atual_id IS NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'mkt_chatbot_mensagens' AND column_name = 'no_id') THEN
          UPDATE mkt_chatbot_mensagens SET bloco_id = no_id WHERE no_id IS NOT NULL;
        END IF;
      END $$;
    `);

    // ========== 4. APOSENTA O SCHEMA ANTIGO ==========
    // `nos` vira _legacy em vez de DROP: os dados sao do cliente e a conversao
    // acima e a primeira coisa a suspeitar se o fluxo sair torto.
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  DROP COLUMN IF EXISTS no_atual_id`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_mensagens DROP COLUMN IF EXISTS no_id`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.mkt_chatbot_nos') IS NOT NULL
           AND to_regclass('public.mkt_chatbot_nos_legacy') IS NULL THEN
          ALTER TABLE mkt_chatbot_nos RENAME TO mkt_chatbot_nos_legacy;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta o que da pra voltar. A arvore original continua em _legacy.
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.mkt_chatbot_nos_legacy') IS NOT NULL
           AND to_regclass('public.mkt_chatbot_nos') IS NULL THEN
          ALTER TABLE mkt_chatbot_nos_legacy RENAME TO mkt_chatbot_nos;
        END IF;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  ADD COLUMN IF NOT EXISTS no_atual_id INT`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_mensagens ADD COLUMN IF NOT EXISTS no_id INT`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  DROP COLUMN IF EXISTS bloco_atual_id`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_sessoes  DROP COLUMN IF EXISTS contexto_ia`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_mensagens DROP COLUMN IF EXISTS bloco_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_conexoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS mkt_chatbot_blocos`);
  }
}
