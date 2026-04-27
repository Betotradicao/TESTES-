import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed de templates classicos de RH:
 *  1. Clima Organizacional (16 perguntas)
 *  2. eNPS (Employee NPS) (3 perguntas)
 *  3. Avaliacao de Lideranca (12 perguntas)
 *  4. Onboarding 30/60/90 dias (10 perguntas)
 *  5. Pesquisa de Saida/Desligamento (10 perguntas)
 *  6. Avaliacao de Treinamento (8 perguntas)
 *  7. Avaliacao 360 graus (12 perguntas)
 *
 * Idempotente: pula se o nome ja existir.
 */
export class SeedPesquisasPadraoRh1784712800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const inserir = async (
      modelo: { nome: string; descricao: string; icone: string; cor: string; anonima?: boolean },
      perguntas: Array<{ secao?: string; tipo: string; enunciado: string; obrigatoria?: boolean; configuracao?: any }>
    ) => {
      const exists = await queryRunner.query(
        `SELECT id FROM pesquisa_modelos WHERE nome = $1 LIMIT 1`,
        [modelo.nome]
      );
      if (exists.length > 0) return;
      const [m] = await queryRunner.query(
        `INSERT INTO pesquisa_modelos (nome, descricao, icone, cor, ativa, anonima)
         VALUES ($1, $2, $3, $4, TRUE, $5) RETURNING id`,
        [modelo.nome, modelo.descricao, modelo.icone, modelo.cor, modelo.anonima !== false]
      );
      let ordem = 0;
      for (const p of perguntas) {
        ordem++;
        await queryRunner.query(
          `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [m.id, p.secao || null, ordem, p.tipo, p.enunciado, !!p.obrigatoria, JSON.stringify(p.configuracao || {})]
        );
      }
    };

    // ===== 1. CLIMA ORGANIZACIONAL =====
    await inserir(
      {
        nome: 'Clima Organizacional',
        descricao: 'Avaliação anônima do clima da empresa. Suas respostas ajudam a identificar pontos fortes e oportunidades de melhoria. Não há respostas certas ou erradas.',
        icone: '🌡️',
        cor: 'blue',
      },
      [
        // Ambiente de trabalho
        { secao: 'Ambiente de Trabalho', tipo: 'rating_5_matriz',
          enunciado: 'Como você avalia os seguintes aspectos do ambiente de trabalho?',
          configuracao: { criterios: ['Limpeza e organização', 'Conforto (temperatura, ruído, iluminação)', 'Segurança', 'Equipamentos disponíveis', 'Espaços de descanso/refeição'] }
        },
        // Relacionamento
        { secao: 'Relacionamento', tipo: 'rating_5_matriz',
          enunciado: 'Como avalia o relacionamento com:',
          configuracao: { criterios: ['Colegas do seu setor', 'Outros setores', 'Seu líder direto', 'Diretoria/Donos'] }
        },
        // Comunicação
        { secao: 'Comunicação', tipo: 'rating_5_matriz',
          enunciado: 'Avalie a comunicação na empresa:',
          configuracao: { criterios: ['Clareza das informações repassadas', 'Frequência de comunicados', 'Espaço pra dar opinião', 'Resposta às suas dúvidas'] }
        },
        // Liderança imediata
        { secao: 'Liderança Imediata', tipo: 'rating_5_matriz',
          enunciado: 'Avalie seu líder direto:',
          configuracao: { criterios: ['Sabe ouvir', 'Dá feedback construtivo', 'É justo nas decisões', 'Reconhece bons resultados', 'É exemplo de comportamento'] }
        },
        // Reconhecimento
        { secao: 'Reconhecimento', tipo: 'multipla_escolha',
          enunciado: 'Você se sente reconhecido pelo trabalho que faz?',
          configuracao: { opcoes: ['Sim, sempre', 'Sim, na maioria das vezes', 'Às vezes', 'Raramente', 'Nunca'] }
        },
        { secao: 'Reconhecimento', tipo: 'texto_longo',
          enunciado: 'Que forma de reconhecimento você mais valoriza?'
        },
        // Carreira
        { secao: 'Carreira e Crescimento', tipo: 'sim_nao',
          enunciado: 'Você vê possibilidade de crescimento dentro da empresa?'
        },
        { secao: 'Carreira e Crescimento', tipo: 'multipla_escolha',
          enunciado: 'Como avalia as oportunidades de treinamento e desenvolvimento?',
          configuracao: { opcoes: ['Excelentes', 'Boas', 'Razoáveis', 'Ruins', 'Inexistentes'] }
        },
        // Remuneração e benefícios
        { secao: 'Remuneração e Benefícios', tipo: 'rating_5_matriz',
          enunciado: 'Avalie:',
          configuracao: { criterios: ['Salário em relação ao mercado', 'Benefícios oferecidos', 'Pontualidade no pagamento', 'Equidade entre colegas'] }
        },
        // Carga de trabalho
        { secao: 'Carga de Trabalho', tipo: 'multipla_escolha',
          enunciado: 'Como você avalia sua carga de trabalho?',
          configuracao: { opcoes: ['Muito leve', 'Adequada', 'Pesada mas administrável', 'Muito pesada', 'Insustentável'] }
        },
        { secao: 'Carga de Trabalho', tipo: 'sim_nao',
          enunciado: 'Você consegue manter equilíbrio entre vida pessoal e profissional?'
        },
        // Cultura e Valores
        { secao: 'Cultura e Valores', tipo: 'multipla_escolha',
          enunciado: 'Você se identifica com os valores da empresa?',
          configuracao: { opcoes: ['Totalmente', 'Em grande parte', 'Parcialmente', 'Pouco', 'Não me identifico'] }
        },
        { secao: 'Cultura e Valores', tipo: 'sim_nao',
          enunciado: 'Você indicaria a empresa pra um amigo trabalhar?'
        },
        // Geral
        { secao: 'Geral', tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você recomendaria a empresa pra um amigo trabalhar? (eNPS)',
          obrigatoria: true,
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'O que mais te ORGULHA de trabalhar aqui?'
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'O que precisa melhorar URGENTEMENTE? (sugestões diretas)'
        },
      ]
    );

    // ===== 2. eNPS (Employee NPS) =====
    await inserir(
      {
        nome: 'eNPS - Pulse Rápido',
        descricao: 'Pesquisa rápida de 30 segundos pra medir o quanto colaboradores recomendam a empresa. Ideal pra aplicar mensalmente.',
        icone: '🎯',
        cor: 'emerald',
      },
      [
        { tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você recomendaria nossa empresa pra um amigo trabalhar?',
          obrigatoria: true,
        },
        { tipo: 'texto_longo',
          enunciado: 'Por quê? (qual o principal motivo da sua nota?)'
        },
        { tipo: 'texto_curto',
          enunciado: 'O que faria você dar uma nota maior?'
        },
      ]
    );

    // ===== 3. AVALIACAO DE LIDERANCA =====
    await inserir(
      {
        nome: 'Avaliação de Liderança',
        descricao: 'Avaliação do líder direto. Ajuda a desenvolver a liderança da empresa. 100% anônima.',
        icone: '👔',
        cor: 'orange',
      },
      [
        { secao: 'Comunicação', tipo: 'rating_5_matriz',
          enunciado: 'Avalie seu líder em comunicação:',
          configuracao: { criterios: ['Clareza ao passar instruções', 'Sabe ouvir', 'Dá feedback construtivo', 'Mantém a equipe informada'] }
        },
        { secao: 'Postura', tipo: 'rating_5_matriz',
          enunciado: 'Avalie a postura do líder:',
          configuracao: { criterios: ['É justo nas decisões', 'Trata todos com respeito', 'Mantém compromissos', 'É exemplo de ética'] }
        },
        { secao: 'Gestão', tipo: 'rating_5_matriz',
          enunciado: 'Avalie a gestão:',
          configuracao: { criterios: ['Define prioridades claras', 'Distribui tarefas com equilíbrio', 'Reconhece bons resultados', 'Apoia em momentos difíceis', 'Promove crescimento da equipe'] }
        },
        { secao: 'Resultados', tipo: 'multipla_escolha',
          enunciado: 'Você sente que seu líder cobra resultados de forma:',
          configuracao: { opcoes: ['Justa e motivadora', 'Excessiva mas necessária', 'Pesada e desmotivadora', 'Pouca cobrança'] }
        },
        { secao: 'Resultados', tipo: 'sim_nao',
          enunciado: 'Você se sente apoiado quando enfrenta dificuldades?'
        },
        { secao: 'Geral', tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você recomendaria seu líder pra outras pessoas trabalharem?',
          obrigatoria: true,
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'O que seu líder faz MUITO BEM? (continue fazendo)'
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'O que seu líder poderia MELHORAR? (comece a fazer / pare de fazer)'
        },
      ]
    );

    // ===== 4. ONBOARDING =====
    await inserir(
      {
        nome: 'Onboarding 30/60/90 Dias',
        descricao: 'Pesquisa pra colaboradores que estão na empresa há até 90 dias. Avalia o processo de integração.',
        icone: '🚀',
        cor: 'pink',
      },
      [
        { tipo: 'multipla_escolha',
          enunciado: 'Há quanto tempo está na empresa?',
          configuracao: { opcoes: ['Menos de 30 dias', '30 a 60 dias', '60 a 90 dias', 'Mais de 90 dias'] }
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'Avalie o processo de boas-vindas:',
          configuracao: { criterios: ['Recepção no primeiro dia', 'Apresentação aos colegas', 'Tour pela empresa', 'Treinamento inicial', 'Equipamentos prontos no início'] }
        },
        { tipo: 'sim_nao',
          enunciado: 'Você recebeu treinamento adequado pra começar a função?'
        },
        { tipo: 'sim_nao',
          enunciado: 'Suas atribuições foram claramente explicadas?'
        },
        { tipo: 'multipla_escolha',
          enunciado: 'Como você se sente em relação à empresa após esse período?',
          configuracao: { opcoes: ['Muito satisfeito, quero crescer aqui', 'Satisfeito', 'Neutro, ainda avaliando', 'Pouco satisfeito', 'Pensando em sair'] }
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'Avalie o suporte recebido:',
          configuracao: { criterios: ['Do líder direto', 'Dos colegas', 'Do RH', 'Da equipe técnica/sistemas'] }
        },
        { tipo: 'texto_longo',
          enunciado: 'O que mais te SURPREENDEU positivamente nestes primeiros dias?'
        },
        { tipo: 'texto_longo',
          enunciado: 'O que poderia melhorar no processo de integração?'
        },
        { tipo: 'sim_nao',
          enunciado: 'Você se vê na empresa daqui a 1 ano?'
        },
        { tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você está satisfeito até agora?',
          obrigatoria: true,
        },
      ]
    );

    // ===== 5. PESQUISA DE SAIDA/DESLIGAMENTO =====
    await inserir(
      {
        nome: 'Pesquisa de Desligamento',
        descricao: 'Pesquisa aplicada quando colaborador vai deixar a empresa. Suas respostas ajudam a melhorar pra quem fica. 100% confidencial.',
        icone: '👋',
        cor: 'amber',
      },
      [
        { tipo: 'multipla_escolha',
          enunciado: 'Quanto tempo trabalhou na empresa?',
          configuracao: { opcoes: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'] }
        },
        { tipo: 'multipla_escolha',
          enunciado: 'Qual o principal motivo da saída?',
          configuracao: { opcoes: ['Salário melhor em outro lugar', 'Insatisfação com a liderança', 'Falta de crescimento', 'Conflitos no ambiente', 'Mudança de área/carreira', 'Motivo pessoal/familiar', 'Outro'] },
          obrigatoria: true,
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'O que avalia POSITIVAMENTE da empresa?',
          configuracao: { criterios: ['Ambiente de trabalho', 'Colegas de equipe', 'Liderança', 'Salário e benefícios', 'Oportunidades de crescimento'] }
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'O que mais TE INCOMODOU?',
          configuracao: { criterios: ['Carga de trabalho', 'Gestão / liderança', 'Comunicação', 'Política interna', 'Falta de reconhecimento'] }
        },
        { tipo: 'sim_nao',
          enunciado: 'Você indicaria a empresa pra um amigo trabalhar?'
        },
        { tipo: 'sim_nao',
          enunciado: 'Você voltaria a trabalhar na empresa no futuro?'
        },
        { tipo: 'texto_longo',
          enunciado: 'O que a empresa precisa MUDAR pra reter melhor as pessoas?'
        },
        { tipo: 'texto_longo',
          enunciado: 'Pra onde você está indo? (empresa/cargo, opcional)'
        },
        { tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você recomendaria a empresa?',
        },
        { tipo: 'texto_longo',
          enunciado: 'Quer deixar uma mensagem final?'
        },
      ]
    );

    // ===== 6. AVALIACAO DE TREINAMENTO =====
    await inserir(
      {
        nome: 'Avaliação de Treinamento',
        descricao: 'Pesquisa pós-treinamento. Ajuda a melhorar os próximos.',
        icone: '📚',
        cor: 'purple',
      },
      [
        { tipo: 'texto_curto',
          enunciado: 'Nome do treinamento que você participou:',
          obrigatoria: true,
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'Avalie o conteúdo:',
          configuracao: { criterios: ['Relevância do tema', 'Aprofundamento', 'Aplicabilidade no dia a dia', 'Material disponibilizado'] }
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'Avalie o instrutor/palestrante:',
          configuracao: { criterios: ['Domínio do assunto', 'Clareza na explicação', 'Capacidade de envolver', 'Tirou dúvidas adequadamente'] }
        },
        { tipo: 'rating_5_matriz',
          enunciado: 'Avalie a estrutura:',
          configuracao: { criterios: ['Local/sala', 'Duração', 'Horário escolhido', 'Equipamentos audiovisuais'] }
        },
        { tipo: 'multipla_escolha',
          enunciado: 'O treinamento atendeu suas expectativas?',
          configuracao: { opcoes: ['Superou', 'Atendeu totalmente', 'Atendeu parcialmente', 'Não atendeu'] }
        },
        { tipo: 'sim_nao',
          enunciado: 'Você se sente preparado pra aplicar o que aprendeu?'
        },
        { tipo: 'texto_longo',
          enunciado: 'Que outros temas você gostaria de ver em treinamentos futuros?'
        },
        { tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto recomendaria este treinamento pra um colega?',
          obrigatoria: true,
        },
      ]
    );

    // ===== 7. AVALIACAO 360 GRAUS =====
    await inserir(
      {
        nome: 'Avaliação 360°',
        descricao: 'Avaliação de competências e comportamentos. Pode ser usada pra avaliar líderes, pares ou subordinados.',
        icone: '🔄',
        cor: 'teal',
      },
      [
        { tipo: 'texto_curto',
          enunciado: 'Nome da pessoa avaliada:',
          obrigatoria: true,
        },
        { tipo: 'multipla_escolha',
          enunciado: 'Sua relação com a pessoa avaliada:',
          configuracao: { opcoes: ['Sou o líder dele(a)', 'Somos pares (mesmo nível)', 'Sou subordinado dele(a)', 'Sou cliente interno'] }
        },
        { secao: 'Competências Técnicas', tipo: 'rating_5_matriz',
          enunciado: 'Avalie as competências técnicas:',
          configuracao: { criterios: ['Conhecimento da função', 'Qualidade do trabalho', 'Produtividade', 'Capacidade de resolver problemas', 'Cumpre prazos'] }
        },
        { secao: 'Competências Comportamentais', tipo: 'rating_5_matriz',
          enunciado: 'Avalie os comportamentos:',
          configuracao: { criterios: ['Trabalho em equipe', 'Comunicação', 'Postura ética', 'Proatividade', 'Resiliência sob pressão', 'Aceita feedback'] }
        },
        { secao: 'Liderança (se aplicável)', tipo: 'rating_5_matriz',
          enunciado: 'Se a pessoa lidera:',
          configuracao: { criterios: ['Inspira a equipe', 'Toma decisões com clareza', 'Desenvolve pessoas', 'Dá feedback construtivo'] }
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'Quais são os PONTOS FORTES dessa pessoa? (continue fazendo)'
        },
        { secao: 'Geral', tipo: 'texto_longo',
          enunciado: 'Quais PONTOS DE MELHORIA você sugere? (oportunidades)'
        },
        { secao: 'Geral', tipo: 'nps_0_10',
          enunciado: 'De 0 a 10, o quanto você recomendaria essa pessoa em um time?',
          obrigatoria: true,
        },
      ]
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove dados (seed) — se for revertir, melhor fazer manual.
  }
}
