import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modulo "Entrevistador Digital" (RH no Radar > Recrutador IA)
 * Cria tabelas pra:
 *  - Vagas e seus criterios de avaliacao
 *  - Banco de perguntas reutilizaveis (categorizadas)
 *  - Entrevistas (sessoes com candidatos via link unico)
 *  - Respostas individuais com analise da IA
 *  - Configuracao da agente (persona, modelo, system prompt)
 */
export class CreateRhRecrutadorTables1784710000000 implements MigrationInterface {
  name = 'CreateRhRecrutadorTables1784710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Vagas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_recrutador_vagas (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(150) NOT NULL,
        descricao TEXT NULL,
        cargo_id INT NULL REFERENCES rh_cargos(id) ON DELETE SET NULL,
        departamento_id INT NULL REFERENCES rh_departamentos(id) ON DELETE SET NULL,
        competencias_chave JSONB DEFAULT '[]'::jsonb,
        perfil_disc_ideal VARCHAR(20) NULL,
        salario_min NUMERIC(12,2) NULL,
        salario_max NUMERIC(12,2) NULL,
        carga_horaria VARCHAR(50) NULL,
        beneficios TEXT NULL,
        requisitos_obrigatorios TEXT NULL,
        requisitos_desejaveis TEXT NULL,
        red_flags JSONB DEFAULT '[]'::jsonb,
        instrucoes_extras_ia TEXT NULL,
        max_perguntas INT DEFAULT 12,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_vagas_ativo ON rh_recrutador_vagas(ativo)`);

    // 2. Banco de Perguntas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_recrutador_perguntas_banco (
        id SERIAL PRIMARY KEY,
        pergunta TEXT NOT NULL,
        categoria VARCHAR(50) NOT NULL,
        competencia VARCHAR(100) NULL,
        tipo VARCHAR(30) DEFAULT 'comportamental',
        nivel_dificuldade VARCHAR(20) DEFAULT 'medio',
        dica_avaliacao TEXT NULL,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_perguntas_categoria ON rh_recrutador_perguntas_banco(categoria) WHERE ativo = true`);

    // 3. Configuracao Global (persona, modelo, system prompt customizavel)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_recrutador_config (
        id SERIAL PRIMARY KEY,
        nome_recrutadora VARCHAR(100) DEFAULT 'Ana',
        persona_descricao TEXT NULL,
        tom_comunicacao VARCHAR(50) DEFAULT 'profissional-acolhedor',
        modelo_ia VARCHAR(50) DEFAULT 'gpt-4o-mini',
        max_tokens_resposta INT DEFAULT 300,
        timeout_resposta_segundos INT DEFAULT 90,
        budget_max_tokens_entrevista INT DEFAULT 30000,
        instrucoes_extras TEXT NULL,
        anti_fraude_ativo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Entrevistas (sessoes com candidatos)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_recrutador_entrevistas (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) NOT NULL UNIQUE,
        vaga_id INT NOT NULL REFERENCES rh_recrutador_vagas(id) ON DELETE CASCADE,
        candidato_nome VARCHAR(150) NOT NULL,
        candidato_telefone VARCHAR(20) NULL,
        candidato_email VARCHAR(150) NULL,
        candidato_id INT NULL REFERENCES rh_candidatos(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'pendente',
        iniciada_em TIMESTAMP NULL,
        finalizada_em TIMESTAMP NULL,
        expira_em TIMESTAMP NULL,
        score_final NUMERIC(5,2) NULL,
        recomendacao VARCHAR(30) NULL,
        relatorio_json JSONB NULL,
        red_flags JSONB DEFAULT '[]'::jsonb,
        disc_inferido VARCHAR(20) NULL,
        tokens_consumidos INT DEFAULT 0,
        custo_estimado_centavos INT DEFAULT 0,
        modelo_usado VARCHAR(50) NULL,
        ip_candidato VARCHAR(45) NULL,
        user_agent TEXT NULL,
        observacoes_rh TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_entrevistas_token ON rh_recrutador_entrevistas(token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_entrevistas_vaga ON rh_recrutador_entrevistas(vaga_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_entrevistas_status ON rh_recrutador_entrevistas(status)`);

    // 5. Respostas individuais (cada turno da entrevista)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_recrutador_respostas (
        id SERIAL PRIMARY KEY,
        entrevista_id INT NOT NULL REFERENCES rh_recrutador_entrevistas(id) ON DELETE CASCADE,
        ordem INT NOT NULL,
        pergunta TEXT NOT NULL,
        resposta TEXT NULL,
        analise_ia TEXT NULL,
        score_pergunta NUMERIC(5,2) NULL,
        red_flag_detectado BOOLEAN DEFAULT false,
        tempo_resposta_segundos INT NULL,
        tokens_consumidos INT DEFAULT 0,
        respondida_em TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_recrutador_respostas_entrevista ON rh_recrutador_respostas(entrevista_id, ordem)`);

    // 6. Seeds: persona padrao da agente
    await queryRunner.query(`
      INSERT INTO rh_recrutador_config (nome_recrutadora, persona_descricao, tom_comunicacao, modelo_ia, instrucoes_extras)
      VALUES (
        'Ana',
        'Recrutadora experiente com 10 anos de mercado, especializada em varejo e supermercados. Empatica mas objetiva. Faz perguntas comportamentais usando metodo STAR (Situacao, Tarefa, Acao, Resultado).',
        'profissional-acolhedor',
        'gpt-4o-mini',
        'Sempre cumprimentar pelo nome. Nunca discriminar por idade, genero, orientacao, etnia ou condicao social. Respeitar LGPD - nao perguntar dados pessoais alem do necessario para a vaga.'
      )
      ON CONFLICT DO NOTHING
    `);

    // 7. Seeds: perguntas iniciais (banco de perguntas mais comuns no varejo)
    await queryRunner.query(`
      INSERT INTO rh_recrutador_perguntas_banco (pergunta, categoria, competencia, tipo, nivel_dificuldade, dica_avaliacao) VALUES
        ('Conta um pouco sobre voce e sua trajetoria profissional ate aqui.', 'apresentacao', 'comunicacao', 'aberta', 'facil', 'Avalia clareza, capacidade de resumir e foco em pontos relevantes.'),
        ('Por que voce se interessou por essa vaga?', 'motivacao', 'engajamento', 'aberta', 'facil', 'Identifica se candidato pesquisou sobre a empresa e tem motivacao real.'),
        ('Conta uma situacao no trabalho em que voce teve que lidar com um cliente dificil. O que aconteceu e como voce resolveu?', 'relacionamento', 'atendimento ao cliente', 'situacional', 'medio', 'STAR: deve conter situacao, tarefa, acao tomada, resultado obtido.'),
        ('Descreva uma vez em que voce errou no trabalho. O que aconteceu e o que aprendeu?', 'autoavaliacao', 'maturidade', 'situacional', 'medio', 'Candidato que nunca erra ou nao admite erro = red flag.'),
        ('Como voce reage quando recebe uma critica do seu supervisor?', 'comportamental', 'receptividade a feedback', 'aberta', 'medio', 'Procurar respostas que demonstrem maturidade e crescimento.'),
        ('Qual e a sua maior qualidade profissional? E o seu maior ponto a melhorar?', 'autoavaliacao', 'autoconhecimento', 'aberta', 'facil', 'Pontos a melhorar genericos ("sou perfeccionista") sao red flag.'),
        ('Em uma rotina de trabalho intensa, como voce organiza suas tarefas?', 'organizacao', 'gestao do tempo', 'aberta', 'medio', 'Avalia capacidade de priorizacao e metodo proprio.'),
        ('Voce ja precisou trabalhar em equipe com alguem que voce nao gostava? Como foi?', 'trabalho em equipe', 'colaboracao', 'situacional', 'medio', 'Procurar profissionalismo e foco no objetivo coletivo.'),
        ('O que voce faria se um cliente pedisse pra voce furar uma regra da loja?', 'etica', 'integridade', 'situacional', 'dificil', 'CRITICO em PDV. Resposta deve mostrar firmeza educada.'),
        ('Onde voce se ve daqui a 2 anos?', 'planejamento', 'visao de carreira', 'aberta', 'facil', 'Verifica se candidato tem plano e se a vaga encaixa.'),
        ('Voce tem disponibilidade para trabalhar aos finais de semana e feriados?', 'logistica', 'disponibilidade', 'fechada', 'facil', 'CRITICO no varejo. Resposta direta esperada.'),
        ('Como voce reagiria se visse um colega de trabalho cometendo uma irregularidade?', 'etica', 'integridade', 'situacional', 'dificil', 'Procurar postura responsavel sem ser delator radical.')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_recrutador_respostas`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_recrutador_entrevistas`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_recrutador_config`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_recrutador_perguntas_banco`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_recrutador_vagas`);
  }
}
