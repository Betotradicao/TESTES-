import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed completo do Recrutador IA:
 *  - Adiciona coluna `requer_experiencia` na tabela de vagas
 *  - Cria 14 vagas-padrão (uma por setor de supermercado)
 *  - Insere 100+ perguntas categorizadas (comportamentais + tecnicas por setor)
 *
 * Perguntas tecnicas seguem o padrao "voce sabe identificar X?" — nao precisam
 * de resposta correta cravada, a IA avalia o conhecimento revelado na resposta.
 */
export class SeedRecrutadorVagasPerguntas1784711000000 implements MigrationInterface {
  name = 'SeedRecrutadorVagasPerguntas1784711000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar coluna `requer_experiencia` em vagas
    await queryRunner.query(`
      ALTER TABLE rh_recrutador_vagas
      ADD COLUMN IF NOT EXISTS requer_experiencia BOOLEAN DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE rh_recrutador_vagas
      ADD COLUMN IF NOT EXISTS setor VARCHAR(50) NULL
    `);

    // 1.1 Atualizar persona padrao da config (world-class)
    await queryRunner.query(`
      UPDATE rh_recrutador_config
      SET persona_descricao = 'Recrutadora top-tier especializada em varejo e supermercados, com mais de 15 anos de experiencia. Conhecida por entrevistas que vao alem do CV — entendem tecnica, comportamento, vida pessoal e sonhos do candidato em equilibrio. Usa metodo STAR, e profundamente empatica mas tambem firme em red flags. Faz o candidato se sentir respeitado mesmo se nao for selecionado.',
          instrucoes_extras = 'Sempre cumprimentar pelo nome. Balancear perguntas: tecnicas (se vaga exigir experiencia), comportamentais STAR, vida pessoal/sonhos (sempre marcar como opcional), red flags discretos. Nunca discriminar (CLT + LGPD). Nao insistir em assuntos pessoais se candidato declinar. Encerrar com agradecimento sincero.'
      WHERE id = (SELECT MIN(id) FROM rh_recrutador_config)
    `);

    // 2. SEED VAGAS PADRAO (uma por setor)
    const vagas = [
      {
        titulo: 'Operador(a) de Caixa',
        setor: 'caixa',
        descricao: 'Atende clientes no PDV, opera o sistema, recebe pagamentos, mantem o caixa organizado e segue procedimentos de prevencao de perdas.',
        competencias: ['atendimento ao cliente','agilidade','atencao a detalhes','integridade','calculo basico'],
        disc: 'SC',
        carga: 'Escala 6x1, 8h/dia',
        requisitos_obrig: 'Ensino medio completo. Disponibilidade fim de semana e feriados.',
        requisitos_des: 'Experiencia em PDV. Cursos de operador de caixa.',
        red_flags: ['historico de furto','falta de atencao com dinheiro','baixa disciplina'],
        ia_extras: 'Avaliar paciencia em filas grandes, postura com cliente nervoso, entender se sabe lidar com erros de troco.',
        max_perg: 12
      },
      {
        titulo: 'Repositor(a) de Mercearia',
        setor: 'mercearia',
        descricao: 'Reposicao de produtos no salao de vendas, controle de validade, FIFO/PEPS, organizacao de gondolas, etiquetagem.',
        competencias: ['organizacao','disposicao fisica','atencao a validade','colaboracao'],
        disc: 'SC',
        carga: '44h semanais',
        requisitos_obrig: 'Disposicao para esforco fisico. Disponibilidade noturna eventual.',
        requisitos_des: 'Experiencia em supermercado. Conhecimento de FIFO.',
        red_flags: ['nao gosta de levantar peso','baixa atencao com vencimento'],
        ia_extras: 'Avaliar disposicao fisica, atencao com produto vencido, entender se respeita prazo.',
        max_perg: 10
      },
      {
        titulo: 'Acougueiro(a)',
        setor: 'acougue',
        descricao: 'Cortes de carne bovina, suina e aves, atendimento no balcao, conservacao e exposicao do produto, controle de validade.',
        competencias: ['conhecimento de cortes','atendimento ao cliente','manipulacao segura','higiene'],
        disc: 'DC',
        carga: '44h, escala 6x1',
        requisitos_obrig: 'Curso de manipulador de alimentos. Habilidade com facas.',
        requisitos_des: 'Experiencia minima 1 ano em acougue.',
        red_flags: ['nao tem destreza com faca','nao conhece cortes basicos'],
        ia_extras: 'Avaliar conhecimento de cortes principais (file mignon, alcatra, picanha, costela), boas praticas de higiene, atencao com tempo de exposicao.',
        max_perg: 12
      },
      {
        titulo: 'Padeiro(a) / Confeiteiro(a)',
        setor: 'padaria',
        descricao: 'Producao de paes, doces e salgados, controle de fermentacao, forneamento, embalagem e exposicao.',
        competencias: ['conhecimento de receitas','disciplina com tempo','higiene','criatividade'],
        disc: 'SC',
        carga: 'Madrugada/manha, 44h',
        requisitos_obrig: 'Curso de manipulador de alimentos. Disponibilidade horario madrugada.',
        requisitos_des: 'Curso de panificacao/confeitaria. Experiencia minima 6 meses.',
        red_flags: ['nao acorda cedo','nao segue receita'],
        ia_extras: 'Avaliar conhecimento de fermentacao, paciencia com tempo de descanso da massa, capacidade de seguir receita exata.',
        max_perg: 12
      },
      {
        titulo: 'Auxiliar de Padaria',
        setor: 'padaria',
        descricao: 'Apoia o padeiro, embala produtos, atende balcao, repoe vitrines, mantem area limpa.',
        competencias: ['atendimento ao cliente','organizacao','agilidade','trabalho em equipe'],
        disc: 'IS',
        carga: '44h, varias escalas',
        requisitos_obrig: 'Ensino fundamental.',
        requisitos_des: 'Experiencia em atendimento.',
        red_flags: ['falta de higiene','nao quer aprender'],
        ia_extras: 'Avaliar disposicao para aprender com o padeiro, paciencia com cliente que demora pra escolher.',
        max_perg: 10
      },
      {
        titulo: 'Hortifrutista',
        setor: 'hortifruti',
        descricao: 'Reposicao de FLV (frutas, legumes, verduras), controle de qualidade, descarte de produto estragado, organizacao visual da banca.',
        competencias: ['identificacao de qualidade','organizacao','atencao a detalhes','agilidade'],
        disc: 'SC',
        carga: '44h, comeca cedo',
        requisitos_obrig: 'Disposicao fisica. Disponibilidade horario inicio do dia.',
        requisitos_des: 'Experiencia previa em hortifruti.',
        red_flags: ['nao identifica fruta madura/passada','desorganizado'],
        ia_extras: 'Avaliar conhecimento de sazonalidade (qual fruta da em qual epoca), capacidade de identificar produto que vai estragar.',
        max_perg: 12
      },
      {
        titulo: 'Atendente de Frios e Laticinios',
        setor: 'frios',
        descricao: 'Atendimento no balcao de frios e queijos, fatiagem, pesagem, conservacao em temperatura adequada.',
        competencias: ['atendimento ao cliente','manipulacao segura','controle de temperatura','agilidade'],
        disc: 'IS',
        carga: '44h, escala 6x1',
        requisitos_obrig: 'Curso de manipulador de alimentos.',
        requisitos_des: 'Experiencia em frios.',
        red_flags: ['nao respeita temperatura','manuseio sem luva'],
        ia_extras: 'Avaliar conhecimento de temperatura ideal, FIFO, paciencia com cliente que pede 100g de cada produto.',
        max_perg: 11
      },
      {
        titulo: 'Atendente de Peixaria',
        setor: 'peixaria',
        descricao: 'Atende balcao de peixes e frutos do mar, limpa, escala, eviscerar, controla validade e temperatura.',
        competencias: ['identificacao de frescor','manipulacao segura','atendimento ao cliente'],
        disc: 'DC',
        carga: '44h',
        requisitos_obrig: 'Curso de manipulador de alimentos.',
        requisitos_des: 'Experiencia previa em peixaria.',
        red_flags: ['nao identifica peixe estragado','medo de manusear'],
        ia_extras: 'Avaliar conhecimento de identificacao de frescor (olho, guelra, textura), tipos de peixes mais comuns.',
        max_perg: 10
      },
      {
        titulo: 'Atendente de Adega / Bebidas',
        setor: 'bebidas',
        descricao: 'Reposicao de bebidas alcoolicas e nao alcoolicas, conferencia de validade, recomendacao a clientes.',
        competencias: ['conhecimento de produto','atendimento ao cliente','disposicao fisica'],
        disc: 'IS',
        carga: '44h',
        requisitos_obrig: 'Maior de 18 anos. Disposicao fisica.',
        requisitos_des: 'Conhecimento basico de vinhos e cervejas.',
        red_flags: ['vende bebida pra menor','nao gosta de levantar peso'],
        ia_extras: 'Avaliar etica de venda (recusar venda pra menor), conhecimento basico de tipos.',
        max_perg: 10
      },
      {
        titulo: 'Promotor(a) de Perfumaria',
        setor: 'perfumaria',
        descricao: 'Apresenta produtos, atende clientes, demonstra produtos, repoe vitrine de cosmeticos e higiene.',
        competencias: ['comunicacao','atendimento ao cliente','conhecimento de produto'],
        disc: 'I',
        carga: '44h',
        requisitos_obrig: 'Boa apresentacao pessoal.',
        requisitos_des: 'Experiencia em perfumaria/cosmeticos.',
        red_flags: ['timido demais','nao gosta de abordar cliente'],
        ia_extras: 'Avaliar capacidade de abordagem ativa, conhecimento de tipos de produto.',
        max_perg: 10
      },
      {
        titulo: 'Empacotador(a)',
        setor: 'caixa',
        descricao: 'Empacota compras no caixa, ajuda a carregar, mantem caixa organizado.',
        competencias: ['agilidade','simpatia','disposicao fisica'],
        disc: 'IS',
        carga: '6h ou 8h',
        requisitos_obrig: 'A partir de 16 anos.',
        requisitos_des: 'Primeiro emprego ok.',
        red_flags: ['preguicoso','sem paciencia'],
        ia_extras: 'Avaliar disposicao com cliente idoso, agilidade.',
        max_perg: 8
      },
      {
        titulo: 'Fiscal de Loja / Prevencao de Perdas',
        setor: 'prevencao',
        descricao: 'Monitora salao de vendas, identifica situacoes de risco, abordagem de suspeitos, analise de cameras.',
        competencias: ['observacao','postura firme','etica','comunicacao'],
        disc: 'D',
        carga: '44h, escalas variadas',
        requisitos_obrig: 'Maior de 18 anos. Sem antecedentes criminais.',
        requisitos_des: 'Curso de seguranca patrimonial. Experiencia previa.',
        red_flags: ['violencia desnecessaria','preconceito'],
        ia_extras: 'Avaliar postura etica, capacidade de abordagem sem violar dignidade do cliente.',
        max_perg: 12
      },
      {
        titulo: 'Encarregado(a) de Setor',
        setor: 'lideranca',
        descricao: 'Lidera equipe de um setor (acougue, padaria, mercearia, etc), gere escala, treina novatos, garante meta.',
        competencias: ['lideranca','comunicacao','organizacao','tomada de decisao','exemplaridade'],
        disc: 'DI',
        carga: '44h',
        requisitos_obrig: 'Experiencia minima 2 anos no setor que vai gerir.',
        requisitos_des: 'Curso de lideranca. Conhecimento de gestao de pessoas.',
        red_flags: ['autoritarismo','nao admite erro','favoritismo'],
        ia_extras: 'Avaliar como ja lidou com conflito de equipe, como acompanha resultado, como motiva colaborador desmotivado.',
        max_perg: 14
      },
      {
        titulo: 'Gerente de Loja',
        setor: 'gerencia',
        descricao: 'Gestao geral da loja: pessoas, vendas, custo, inventario, relacionamento com fornecedor, atendimento de cliente VIP.',
        competencias: ['lideranca','visao de negocio','tomada de decisao sob pressao','gestao de KPIs','comunicacao'],
        disc: 'DI',
        carga: '44h+ disponibilidade',
        requisitos_obrig: 'Experiencia minima 3 anos como encarregado/supervisor de varejo.',
        requisitos_des: 'Ensino superior em Administracao ou afins.',
        red_flags: ['microgerencia','nao delega','favoritismo'],
        ia_extras: 'Avaliar tomada de decisao sob pressao, gestao de crise, conhecimento de KPIs (ruptura, margem, perdas, NPS), relacao com equipe.',
        max_perg: 16
      }
    ];

    for (const v of vagas) {
      await queryRunner.query(
        `INSERT INTO rh_recrutador_vagas
         (titulo, descricao, competencias_chave, perfil_disc_ideal, carga_horaria,
          requisitos_obrigatorios, requisitos_desejaveis, red_flags, instrucoes_extras_ia,
          max_perguntas, requer_experiencia, setor, ativo)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb, $9, $10, false, $11, true)
         ON CONFLICT DO NOTHING`,
        [
          v.titulo, v.descricao,
          JSON.stringify(v.competencias), v.disc, v.carga,
          v.requisitos_obrig, v.requisitos_des,
          JSON.stringify(v.red_flags), v.ia_extras,
          v.max_perg, v.setor
        ]
      );
    }

    // 3. SEED PERGUNTAS TECNICAS POR SETOR
    const perguntasTecnicas = [
      // ACOUGUE
      ['Conhecendo cortes de carne — qual a diferenca entre alcatra e picanha? Onde fica cada uma?', 'tecnica-acougue', 'cortes de carne', 'tecnica', 'medio',
        'Resposta correta: alcatra e a parte traseira do boi (3 musculos), picanha e o cone que fica em cima da alcatra. Avaliar conhecimento de localizacao anatomica.'],
      ['Imagine que entrou um corte na sua bancada com aspecto escurecido nas bordas. O que voce faz?', 'tecnica-acougue', 'controle de qualidade', 'situacional', 'dificil',
        'Esperado: identificar oxidacao, separar pra venda especial ou descarte. NAO repassar pro cliente como fresco.'],
      ['Como voce explicaria a diferenca entre carne de primeira, segunda e terceira pra um cliente?', 'tecnica-acougue', 'atendimento tecnico', 'aberta', 'medio',
        'Avaliar didatica e conhecimento de classificacao.'],
      ['Quais sao os 3 cortes mais vendidos pra churrasco no Brasil?', 'tecnica-acougue', 'cortes de carne', 'fechada', 'facil',
        'Esperado: picanha, fraldinha, costela (ou alcatra). Outros aceitos com argumentacao.'],
      ['Voce sabe afiar uma faca de acougueiro? Explique o processo.', 'tecnica-acougue', 'manipulacao', 'aberta', 'medio',
        'Avaliar conhecimento de chaira, angulo correto, frequencia de afiar.'],

      // PADARIA
      ['Por que a massa do pao precisa descansar (fermentar)? O que acontece se voce assar antes do tempo?', 'tecnica-padaria', 'fermentacao', 'aberta', 'medio',
        'Esperado: fermento age sobre o gluten, levedura produz CO2 que faz a massa crescer. Sem descanso = pao denso.'],
      ['Qual a diferenca entre fermento biologico e fermento quimico? Em que tipo de receita usa cada um?', 'tecnica-padaria', 'fermentacao', 'aberta', 'medio',
        'Biologico (massa de pao, pizza), quimico (bolo, biscoito).'],
      ['Voce esta fazendo pao frances. A massa esta muito grudenta nas maos. O que faz?', 'tecnica-padaria', 'producao', 'situacional', 'medio',
        'Adicionar farinha aos poucos, deixar descansar mais, conferir hidratacao da receita.'],
      ['Quanto tempo dura um pao frances feito as 6h da manha numa vitrine sem aquecimento?', 'tecnica-padaria', 'controle de qualidade', 'fechada', 'facil',
        'Esperado: 4-6h (depois fica duro). Avaliar percepcao de qualidade.'],

      // HORTIFRUTI
      ['Como voce identifica visualmente uma maca em ponto ideal de venda? E uma que ja vai estragar?', 'tecnica-hortifruti', 'identificacao qualidade', 'aberta', 'facil',
        'Madura: cor uniforme, firme, sem manchas. Estragando: amassada, com brilho oleoso, manchas escuras.'],
      ['Qual a diferenca entre um abacate em ponto e um verde demais? Como ensinar isso pro cliente?', 'tecnica-hortifruti', 'atendimento tecnico', 'aberta', 'medio',
        'Pressao leve no caule indica maturacao. Verde = duro, maduro = leve cedencia.'],
      ['Em qual epoca do ano cai o preco da banana? Por que?', 'tecnica-hortifruti', 'sazonalidade', 'aberta', 'medio',
        'Esperado: safra principal de jan-abr. Avaliar conhecimento de sazonalidade.'],
      ['Voce ve uma manga muito madura na banca, comecando a passar. O que voce faz?', 'tecnica-hortifruti', 'gestao de validade', 'situacional', 'medio',
        'Esperado: separar pra venda em oferta, fazer combo, ou retirar antes que estrague o resto.'],
      ['Como diferenciar tomate italiano de tomate cereja de tomate-de-arvore?', 'tecnica-hortifruti', 'identificacao produtos', 'aberta', 'facil',
        'Avaliar conhecimento basico de variedades.'],

      // CAIXA
      ['Cliente pagou R$ 100,00 por uma compra de R$ 47,35. Quanto e o troco e como voce devolveria em notas/moedas?', 'tecnica-caixa', 'calculo', 'fechada', 'facil',
        'R$ 52,65 — 1x50, 1x2, 0,50, 0,10, 0,05.'],
      ['O que voce faz se notar uma cedula falsa no caixa?', 'tecnica-caixa', 'prevencao', 'situacional', 'medio',
        'Esperado: nao entregar troco, chamar supervisor, registrar ocorrencia, NAO acusar cliente.'],
      ['Cliente comprou um produto e quer trocar. O que voce verifica antes de aceitar?', 'tecnica-caixa', 'procedimento', 'aberta', 'medio',
        'Politica da loja, prazo, nota fiscal, estado do produto.'],
      ['Como voce procede ao iniciar e fechar um turno de caixa? Quais passos sao importantes?', 'tecnica-caixa', 'procedimento', 'aberta', 'medio',
        'Avaliar disciplina com sangria, conferencia inicial, fechamento, deposito.'],

      // FRIOS
      ['Qual a temperatura correta de exposicao de queijos e frios?', 'tecnica-frios', 'controle temperatura', 'fechada', 'facil',
        'Esperado: 4-7 graus C. Avaliar conhecimento tecnico.'],
      ['Cliente pede 200g de presunto. Voce fatia 215g. Como procede?', 'tecnica-frios', 'atendimento', 'situacional', 'facil',
        'Esperado: pesar antes, falar pro cliente, perguntar se ok ou ajustar. Nao fingir que era 200.'],
      ['O que e FIFO/PEPS? Como voce aplica isso na sua bancada?', 'tecnica-frios', 'controle estoque', 'aberta', 'medio',
        'First In First Out / Primeiro a Entrar, Primeiro a Sair. Produtos mais antigos na frente.'],

      // PEIXARIA
      ['Como voce identifica que um peixe esta fresco? Quais sao os sinais visuais?', 'tecnica-peixaria', 'identificacao frescor', 'aberta', 'medio',
        'Esperado: olho brilhante e nao afundado, guelra vermelha, textura firme, sem cheiro forte.'],
      ['Qual a diferenca entre filetar e escalar um peixe? Em que situacao usa cada tecnica?', 'tecnica-peixaria', 'tecnica corte', 'aberta', 'dificil',
        'Filetar = remover espinha. Escalar = remover escamas. Avaliar conhecimento.'],
      ['Cite 3 peixes mais vendidos no Brasil e em qual epoca cada um e mais barato.', 'tecnica-peixaria', 'sazonalidade', 'aberta', 'medio',
        'Tilapia, salmao, sardinha, etc. Avaliar conhecimento de mercado.'],

      // PREVENCAO DE PERDAS
      ['Voce ve um cliente colocando produto na bolsa sem passar no caixa. Como voce aborda?', 'tecnica-prevencao', 'abordagem', 'situacional', 'dificil',
        'Esperado: NUNCA acusar diretamente. Convidar a passar no caixa, falar com discricao, evitar constrangimento, chamar superior se necessario.'],
      ['Quais sao os horarios de maior risco de furto numa loja de supermercado?', 'tecnica-prevencao', 'analise risco', 'aberta', 'medio',
        'Inicio da manha (poucos funcionarios), horario de pico (alta movimentacao), final do dia.'],
      ['O que voce faz se um colaborador esta agindo de forma suspeita?', 'tecnica-prevencao', 'etica', 'situacional', 'dificil',
        'Esperado: documentar, reportar pra gerencia/RH com evidencias. Nao confrontar diretamente.'],

      // BEBIDAS
      ['Cliente que aparenta ser menor de idade quer comprar cerveja. Como voce procede?', 'tecnica-bebidas', 'etica', 'situacional', 'medio',
        'Esperado: pedir documento. Recusar venda se nao apresentar ou for menor. NAO ceder.'],
      ['Qual a diferenca entre uma cerveja Pilsen e uma IPA?', 'tecnica-bebidas', 'conhecimento produto', 'aberta', 'medio',
        'Pilsen = leve, dourada, baixa fermentacao. IPA = amarga, alta fermentacao, lupulada.'],

      // LIDERANCA / GERENCIA
      ['Conta uma situacao em que voce teve que advertir um colaborador. Como conduziu?', 'lideranca', 'gestao pessoas', 'situacional', 'dificil',
        'Avaliar maturidade, foco no comportamento (nao na pessoa), feedback construtivo.'],
      ['Sua equipe nao bateu meta tres meses seguidos. O que voce faz?', 'lideranca', 'gestao resultado', 'situacional', 'dificil',
        'Diagnostico de causa, conversa individual, plano de acao, ajuste de processo, treinamento.'],
      ['Como voce reage quando um colaborador erra de forma grave (ex: deixar cair muito produto, esquecer de tirar do freezer)?', 'lideranca', 'gestao erro', 'situacional', 'medio',
        'Apurar antes de julgar, ouvir versao, focar em prevenir, nao em punir como primeira reacao.'],
      ['Voce tem que demitir alguem por baixo desempenho. Como conduz a conversa?', 'lideranca', 'desligamento', 'situacional', 'dificil',
        'Avaliar humanidade, clareza, respeito.'],
      ['Quais 3 KPIs voce considera mais importantes pra gerir uma loja de supermercado?', 'tecnica-gerencia', 'gestao KPI', 'aberta', 'medio',
        'Margem, ruptura, perdas, ticket medio, NPS, custo de pessoal. Avaliar visao de negocio.'],

      // COMPORTAMENTAIS GERAIS (uteis pra qualquer setor)
      ['Conta uma situacao no trabalho em que voce precisou ir alem das suas atribuicoes. O que voce fez e qual foi o resultado?', 'comportamental', 'iniciativa', 'situacional', 'medio',
        'Buscar STAR. Avaliar proatividade real (nao decorada).'],
      ['Qual foi a critica mais dificil que voce recebeu no trabalho? Como reagiu?', 'comportamental', 'receptividade feedback', 'situacional', 'medio',
        'Avaliar maturidade, capacidade de absorver feedback sem se defender.'],
      ['Conta uma situacao em que voce discordou do seu chefe. Como lidou?', 'comportamental', 'autonomia', 'situacional', 'dificil',
        'Avaliar respeito a hierarquia + capacidade de argumentar com dados.'],
      ['Voce ja teve que trabalhar com alguem dificil de lidar? Como foi?', 'comportamental', 'colaboracao', 'situacional', 'medio',
        'Avaliar profissionalismo, foco no objetivo coletivo.'],
      ['Em uma rotina apertada com muitas tarefas, como voce decide o que fazer primeiro?', 'comportamental', 'gestao tempo', 'aberta', 'medio',
        'Avaliar metodo de priorizacao (urgencia x importancia).'],
      ['Conta uma situacao em que voce reconheceu que estava errado. O que aconteceu depois?', 'comportamental', 'maturidade', 'situacional', 'medio',
        'Capacidade de admitir erro = sinal de maturidade.'],

      // ETICA
      ['Voce ve um colega de trabalho cometendo um erro que pode prejudicar a loja. O que voce faz?', 'etica', 'integridade', 'situacional', 'dificil',
        'Avaliar postura responsavel sem ser delator. Conversar com o colega, depois reportar se necessario.'],
      ['Um cliente conhecido seu pede pra voce passar um produto sem registrar. Como voce age?', 'etica', 'integridade', 'situacional', 'dificil',
        'Recusar com firmeza educada. Explicar que pode ser demitido. Nao ceder mesmo sob pressao.'],
      ['Voce ja participou de algum esquema de "racha" (combinar com colegas)? Como foi?', 'etica', 'integridade', 'aberta', 'dificil',
        'Pergunta direta. Avaliar honestidade da resposta.'],

      // VIDA PESSOAL E FAMILIA (LGPD-compliant: candidato decide se quer compartilhar)
      ['Conta um pouco sobre sua rotina fora do trabalho. O que voce gosta de fazer no tempo livre?', 'vida-pessoal', 'autoconhecimento', 'aberta', 'facil',
        'Avaliar equilibrio vida-trabalho, hobbies, rede de apoio. Voluntario - candidato decide o que compartilhar.'],
      ['Quem sao as pessoas mais importantes pra voce na sua vida hoje? (so o que se sentir confortavel em compartilhar)', 'vida-pessoal', 'rede de apoio', 'aberta', 'facil',
        'Avaliar maturidade emocional, base familiar/social. Questao opcional.'],
      ['Voce tem familia que depende de voce financeiramente? Como isso influencia na sua escolha de trabalho?', 'vida-pessoal', 'estabilidade', 'aberta', 'medio',
        'PERMITIDA pela CLT. Avalia maturidade e responsabilidade. Resposta opcional.'],
      ['Como voce gerencia o equilibrio entre trabalho e vida pessoal? Tem alguma rotina que te ajuda?', 'vida-pessoal', 'equilibrio', 'aberta', 'medio',
        'Avaliar autoconhecimento e capacidade de auto-cuidado.'],
      ['Voce ja passou por alguma situacao dificil na vida que te transformou de algum jeito? (so se sentir confortavel)', 'vida-pessoal', 'resiliencia', 'aberta', 'medio',
        'Voluntaria. Avaliar resiliencia, maturidade emocional. NAO insistir se nao quiser responder.'],

      // SONHOS, PLANOS E FUTURO
      ['Onde voce se ve daqui a 5 anos? Tanto profissional quanto pessoalmente.', 'sonhos-planos', 'visao de futuro', 'aberta', 'medio',
        'Avaliar se tem plano de vida claro, ambicao saudavel, alinhamento com a vaga.'],
      ['Tem algum sonho grande que voce gostaria de realizar? Pode ser de carreira, viagem, conquista pessoal — o que vier.', 'sonhos-planos', 'motivacao', 'aberta', 'facil',
        'Pergunta poderosa. Resposta revela motivacao real, valores, drives internos.'],
      ['Se voce pudesse mudar uma coisa na sua vida hoje, o que seria?', 'sonhos-planos', 'autoconhecimento', 'aberta', 'medio',
        'Revela frustracao atual e clareza sobre o que valoriza. Espacar com cuidado.'],
      ['O que te faz se sentir realizado(a) num dia de trabalho? Pode ser uma coisa pequena.', 'sonhos-planos', 'motivacao', 'aberta', 'facil',
        'Identifica gatilho de engajamento. Util pra retencao.'],
      ['Que tipo de pessoa voce admira muito na sua vida e por que? (pode ser alguem da familia, ja conhecido, autor, etc)', 'sonhos-planos', 'valores', 'aberta', 'medio',
        'Revela valores e modelos. Mostra o tipo de futuro que candidato projeta.'],
      ['Tem alguma coisa que voce sempre quis aprender e ainda nao teve oportunidade? Por que?', 'sonhos-planos', 'curiosidade', 'aberta', 'facil',
        'Identifica curiosidade, drive de aprendizado, barreiras autoimpostas.'],
      ['Voce se considera mais uma pessoa que vive o presente ou que planeja muito o futuro? Conta como funciona pra voce.', 'sonhos-planos', 'perfil temporal', 'aberta', 'medio',
        'Revela perfil cognitivo - vivencia/agora vs planejamento/depois. Util pra encaixe na vaga.'],
      ['Se voce tivesse 1 milhao de reais sem precisar trabalhar, o que voce faria com a sua vida?', 'sonhos-planos', 'motivacao real', 'aberta', 'medio',
        'Pergunta classica - revela motivacao real (alem do salario), proposito pessoal.'],
      ['Qual conquista da sua vida (de qualquer area) voce mais se orgulha?', 'sonhos-planos', 'autoestima', 'aberta', 'facil',
        'Avaliar autoestima saudavel, capacidade de reconhecer proprio mérito.'],
      ['Voce tem filhos ou pretende ter? (so se for confortavel falar) Como concilia com trabalho?', 'vida-pessoal', 'planejamento familiar', 'aberta', 'medio',
        'PERMITIDA mas opcional. So perguntar se contexto pedir. NUNCA usar pra discriminar.'],
      ['Que tipo de ambiente de trabalho te faz se sentir bem? E qual te deixa desconfortavel?', 'vida-pessoal', 'fit cultural', 'aberta', 'medio',
        'Avalia auto-conhecimento sobre ambiente ideal, evita contratacao mal-encaixada.'],

      // CHEGADA E PRIMEIRA IMPRESSAO
      ['Como voce ficou sabendo dessa vaga? E o que te chamou atencao nela especificamente?', 'apresentacao', 'engajamento', 'aberta', 'facil',
        'Identifica canal de captacao + nivel de pesquisa do candidato sobre a empresa.'],
      ['Se eu pedir pra voce se descrever em 3 palavras, quais seriam? E por que essas?', 'apresentacao', 'autoconhecimento', 'aberta', 'medio',
        'Revela auto-imagem, valores principais, capacidade de sintese.']
    ];

    for (const p of perguntasTecnicas) {
      await queryRunner.query(
        `INSERT INTO rh_recrutador_perguntas_banco
         (pergunta, categoria, competencia, tipo, nivel_dificuldade, dica_avaliacao)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        p
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove apenas perguntas com categorias tecnicas (mantem as comportamentais antigas)
    await queryRunner.query(`DELETE FROM rh_recrutador_perguntas_banco WHERE categoria LIKE 'tecnica-%' OR categoria IN ('lideranca')`);
    await queryRunner.query(`ALTER TABLE rh_recrutador_vagas DROP COLUMN IF EXISTS requer_experiencia`);
    await queryRunner.query(`ALTER TABLE rh_recrutador_vagas DROP COLUMN IF EXISTS setor`);
  }
}
