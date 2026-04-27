import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

/**
 * Agente Entrevistadora Digital — usa OpenAI Function Calling.
 * Pattern espelhado do `ai-consultant.service.ts` que ja roda em producao.
 *
 * Fluxo:
 *  - cliente abre /recrutamento/<token>
 *  - frontend chama POST /recrutador/entrevista/:token/responder com a resposta
 *  - service carrega historico, monta system prompt com vaga + persona,
 *    chama OpenAI com tools, processa function calls, devolve proxima
 *    mensagem da agente (pergunta nova ou encerramento)
 */

interface AgentTurnInput {
  entrevistaId: number;
  candidatoMessage?: string; // resposta do candidato (vazio se for o "ola" inicial)
}

interface AgentTurnOutput {
  iaMessage: string;
  finalizada: boolean;
  ordem: number;
  tokensConsumidos: number;
  redFlagDetectado?: boolean;
  scoreFinal?: number | null;
  recomendacao?: string | null;
  relatorio?: any;
}

const TOOLS = [
  {
    name: 'consultar_perguntas_banco',
    description: 'Busca perguntas no banco de perguntas filtrando por categoria e/ou competencia. Use sempre antes de fazer uma nova pergunta para variar o repertorio.',
    parameters: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Ex: apresentacao, motivacao, etica, comportamental, situacional' },
        competencia: { type: 'string', description: 'Ex: atendimento ao cliente, integridade, gestao do tempo' },
        limite: { type: 'integer', default: 5 }
      }
    }
  },
  {
    name: 'salvar_resposta_e_analise',
    description: 'Salva a resposta atual do candidato com sua analise (1-2 frases) e score (0-10). Chame ANTES de gerar a proxima pergunta.',
    parameters: {
      type: 'object',
      properties: {
        pergunta: { type: 'string', description: 'A pergunta exata feita ao candidato' },
        resposta: { type: 'string', description: 'A resposta do candidato' },
        analise: { type: 'string', description: 'Analise breve (1-2 frases) do que a resposta revela' },
        score: { type: 'number', description: 'Nota de 0 a 10 para essa resposta especifica' },
        red_flag: { type: 'boolean', description: 'true se detectou red flag (mentira evidente, atitude problematica, etc)' }
      },
      required: ['pergunta', 'resposta', 'analise', 'score']
    }
  },
  {
    name: 'detectar_red_flag_critico',
    description: 'Use APENAS se o candidato deu resposta gravemente problematica (ex: confessou furto, racismo, mentira escancarada). Sinaliza para encerrar mais cedo.',
    parameters: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Por que e red flag critico' },
        encerrar_agora: { type: 'boolean', default: false }
      },
      required: ['motivo']
    }
  },
  {
    name: 'finalizar_entrevista',
    description: 'Chame quando atingir o numero maximo de perguntas da vaga OU quando ja tiver informacao suficiente. Gera o relatorio final estruturado, completo, com analise grafica.',
    parameters: {
      type: 'object',
      properties: {
        score_final: { type: 'number', description: 'Score consolidado 0-100' },
        recomendacao: {
          type: 'string',
          enum: ['contratar', 'segunda_etapa', 'reserva', 'descartar'],
          description: 'Decisao baseada na entrevista'
        },
        recomendacao_simples: {
          type: 'string',
          enum: ['SIM', 'NAO', 'TALVEZ'],
          description: 'Resposta direta: indicaria pra essa vaga? SIM, NAO ou TALVEZ.'
        },
        disc_inferido: {
          type: 'string',
          enum: ['D', 'I', 'S', 'C', 'DI', 'DC', 'IS', 'IC', 'SC', 'DISC'],
          description: 'Perfil DISC inferido pelas respostas'
        },
        scores_dimensoes: {
          type: 'object',
          description: 'Score (0-10) em cada dimensao avaliada — usado pra gerar grafico radar.',
          properties: {
            tecnica: { type: 'number', description: '0-10. Conhecimento tecnico do setor (10 se nao se aplica). Se vaga sem experiencia, marcar 0 ou null.' },
            comportamental: { type: 'number', description: '0-10. Maturidade, postura, STAR, autoconhecimento.' },
            comunicacao: { type: 'number', description: '0-10. Clareza, articulacao, empatia.' },
            etica: { type: 'number', description: '0-10. Integridade, postura em dilemas eticos.' },
            motivacao: { type: 'number', description: '0-10. Engajamento real com a vaga, paixao.' },
            fit_cultural: { type: 'number', description: '0-10. Encaixe com a empresa e equipe.' }
          },
          required: ['comportamental', 'comunicacao', 'etica', 'motivacao', 'fit_cultural']
        },
        pontos_fortes: { type: 'array', items: { type: 'string' }, description: '3-5 pontos fortes claros.' },
        pontos_atencao: { type: 'array', items: { type: 'string' }, description: '2-4 pontos a desenvolver/observar.' },
        red_flags: { type: 'array', items: { type: 'string' }, description: 'Sinais de alerta encontrados (vazio se nao houver).' },
        possiveis_ganhos: {
          type: 'array',
          items: { type: 'string' },
          description: '3-5 frases de COMO essa pessoa pode CONTRIBUIR/AGREGAR pra empresa caso seja contratada.'
        },
        possiveis_problemas: {
          type: 'array',
          items: { type: 'string' },
          description: '2-4 frases de RISCOS/DESAFIOS que podem aparecer caso seja contratada (ex: pode ter dificuldade com X, vai precisar de treinamento em Y, perfil pouco aderente a Z).'
        },
        compatibilidade_disc: {
          type: 'string',
          description: 'Frase curta sobre o quanto o DISC do candidato bate com o DISC ideal da vaga.'
        },
        sugestao_treinamento: {
          type: 'array',
          items: { type: 'string' },
          description: 'Se contratar, treinamentos/onboarding sugeridos pra acelerar adaptacao.'
        },
        resumo_final: {
          type: 'string',
          description: 'Texto livre 3-5 paragrafos com analise completa: trajetoria, fit pra vaga, perfil, riscos, oportunidades. Tom profissional e direto.'
        }
      },
      required: ['score_final', 'recomendacao', 'recomendacao_simples', 'scores_dimensoes', 'pontos_fortes', 'pontos_atencao', 'possiveis_ganhos', 'possiveis_problemas', 'resumo_final']
    }
  }
];

// Custo estimado por modelo (USD por 1M tokens) — valores aproximados, atualizar quando precisar
const MODEL_COSTS_PER_1M_TOKENS = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-5': { input: 3.00, output: 12.00 },
  'gpt-5-mini': { input: 0.50, output: 2.00 },
  'gpt-5.2': { input: 4.00, output: 15.00 },
};

export class RhRecrutadorAgentService {

  /**
   * Roda 1 turno do agente: pega resposta do candidato, processa, devolve proxima
   * mensagem da agente (pergunta nova ou encerramento).
   */
  static async processarTurno(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const { entrevistaId, candidatoMessage } = input;

    // 1. Carregar entrevista + vaga + config + historico
    const entrevista = await AppDataSource.query(
      `SELECT * FROM rh_recrutador_entrevistas WHERE id = $1`,
      [entrevistaId]
    );
    if (!entrevista || entrevista.length === 0) {
      throw new Error('Entrevista nao encontrada');
    }
    const ent = entrevista[0];

    if (ent.status === 'finalizada' || ent.status === 'expirada' || ent.status === 'descartada') {
      throw new Error(`Entrevista ja ${ent.status}`);
    }

    const vaga = await AppDataSource.query(
      `SELECT * FROM rh_recrutador_vagas WHERE id = $1`, [ent.vaga_id]
    );
    if (!vaga || vaga.length === 0) throw new Error('Vaga nao encontrada');
    const v = vaga[0];

    const config = await AppDataSource.query(
      `SELECT * FROM rh_recrutador_config ORDER BY id ASC LIMIT 1`
    );
    const cfg = config[0] || {
      nome_recrutadora: 'Ana',
      persona_descricao: 'Recrutadora profissional.',
      tom_comunicacao: 'profissional-acolhedor',
      modelo_ia: 'gpt-4o-mini',
      max_tokens_resposta: 300,
      budget_max_tokens_entrevista: 30000,
      instrucoes_extras: ''
    };

    const historico = await AppDataSource.query(
      `SELECT ordem, pergunta, resposta, analise_ia, score_pergunta, red_flag_detectado
       FROM rh_recrutador_respostas
       WHERE entrevista_id = $1
       ORDER BY ordem ASC`,
      [entrevistaId]
    );

    const proximaOrdem = historico.length + 1;

    // 2. Verificar budget de tokens (proteção contra loops caros)
    if ((ent.tokens_consumidos || 0) >= (cfg.budget_max_tokens_entrevista || 30000)) {
      console.log(`[Recrutador] Budget de tokens atingido: ${ent.tokens_consumidos}/${cfg.budget_max_tokens_entrevista}`);
      await this.finalizarPorBudget(entrevistaId);
      return {
        iaMessage: 'Obrigada pelas suas respostas! Vou encaminhar para nossa equipe analisar e em breve voce recebera um retorno.',
        finalizada: true,
        ordem: proximaOrdem,
        tokensConsumidos: 0,
      };
    }

    // 3. Marcar entrevista como em andamento (se primeiro turno)
    if (ent.status === 'pendente') {
      await AppDataSource.query(
        `UPDATE rh_recrutador_entrevistas SET status = 'em_andamento', iniciada_em = NOW(), updated_at = NOW() WHERE id = $1`,
        [entrevistaId]
      );
    }

    // 4. Montar system prompt
    const systemPrompt = this.montarSystemPrompt(v, cfg, ent, historico.length);

    // 5. Montar messages (historico)
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar historico como turnos
    for (const h of historico) {
      if (h.pergunta) messages.push({ role: 'assistant', content: h.pergunta });
      if (h.resposta) messages.push({ role: 'user', content: h.resposta });
    }

    // Adicionar a nova mensagem do candidato (ou trigger inicial)
    if (candidatoMessage && candidatoMessage.trim()) {
      messages.push({ role: 'user', content: candidatoMessage });
    } else if (historico.length === 0) {
      // Primeiro turno - INSTRUI A IA A FAZER RAPPORT (NAO pula direto pra avaliacao)
      messages.push({
        role: 'user',
        content: `__INICIO_DA_ENTREVISTA__

Voce esta no PRIMEIRO TURNO. Esta e a hora do RAPPORT (FASE 1 do prompt).

Sua mensagem DEVE conter:

1. Cumprimento caloroso pelo nome: "Ola, ${entrevista.candidato_nome}!"
2. Apresentacao breve sua: "Sou a ${cfg.nome_recrutadora}, vou conduzir nossa conversa hoje."
3. Empatia com possivel ansiedade: "E super normal ficar nervoso(a) — fica tranquilo(a), nao tem certo nem errado, so quero te conhecer."
4. Explicacao breve do formato: "Vou te fazer algumas perguntas sobre voce, sua experiencia e o que busca. Pode responder com calma."
5. UMA pergunta LEVE e ABERTA pra quebrar o gelo, tipo:
   - "Pra comecarmos, conta um pouco sobre voce. O que voce tem feito ultimamente?"
   - OU "Como esta o seu dia? Conta um pouquinho sobre voce."

NAO faca perguntas de avaliacao agora. NAO pergunte "por que se candidatou" no primeiro turno.

Tom: caloroso, acolhedor, empatico. Use 4-6 linhas no total.`
      });
    }

    // 6. Chamar OpenAI com tools (loop de function calls)
    const result = await this.chamarOpenAIComTools(messages, cfg);

    // 7. Atualizar tokens consumidos na entrevista
    await AppDataSource.query(
      `UPDATE rh_recrutador_entrevistas
       SET tokens_consumidos = tokens_consumidos + $1,
           custo_estimado_centavos = custo_estimado_centavos + $2,
           modelo_usado = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [result.totalTokens, result.custoCentavos, cfg.modelo_ia, entrevistaId]
    );

    return {
      iaMessage: result.mensagemFinal || 'Obrigada pela sua resposta!',
      finalizada: result.finalizada,
      ordem: proximaOrdem,
      tokensConsumidos: result.totalTokens,
      redFlagDetectado: result.redFlagDetectado,
      scoreFinal: result.scoreFinal,
      recomendacao: result.recomendacao,
      relatorio: result.relatorio,
    };
  }

  private static montarSystemPrompt(vaga: any, cfg: any, entrevista: any, perguntasJaFeitas: number): string {
    const competencias = Array.isArray(vaga.competencias_chave) ? vaga.competencias_chave.join(', ') : '';
    const redFlags = Array.isArray(vaga.red_flags) ? vaga.red_flags.join('; ') : '';
    const maxPerguntas = vaga.max_perguntas || 12;
    const restantes = Math.max(0, maxPerguntas - perguntasJaFeitas);

    const requerExp = vaga.requer_experiencia ? 'SIM' : 'NAO';
    const setor = vaga.setor || 'nao especificado';

    return `# Voce e ${cfg.nome_recrutadora} — recrutadora PhD-level em Selecao por Competencias, especializada em varejo brasileiro.

## Sua formacao e referencial teorico
${cfg.persona_descricao || 'Recrutadora top-tier especializada em varejo e supermercados, com 15+ anos de experiencia.'}

Voce domina e aplica:
- **BEI (Behavioral Event Interview)** de David McClelland — entrevista por eventos comportamentais
- **STAR/CAR** (Situacao-Tarefa-Acao-Resultado) — para extrair evidencia comportamental real
- **Performance-based Hiring** de Lou Adler — foco em resultados e conquistas, nao so atribuicoes
- **Topgrading** de Bradford Smart — deep dive cronologico para detectar consistencia
- **Tactical Empathy** de Chris Voss — espelhamento, rotulacao emocional, perguntas calibradas com "como" e "o que"
- **Active Listening** de Carl Rogers — parafrasear, validar emocao, suspender julgamento
- **Hiring for Attitude** de Mark Murphy — 95% das falhas de contratacao sao por atitude, nao tecnica
- **Grit** de Angela Duckworth — paixao + perseveranca como preditores de longevidade
- **Project Oxygen / re:Work** (Google) — competencias de lideranca validadas empiricamente
- **DISC + Big Five (OCEAN)** — perfil comportamental e preditividade
- **5 Whys** — profundidade investigativa sem se tornar interrogatorio
- **Funnel Technique** — pergunta ampla, depois estreita progressivamente
- **OARS** (Open questions, Affirmations, Reflective listening, Summaries) — Motivational Interviewing
- **NVC** (Nonviolent Communication) de Marshall Rosenberg — feedback empatico
- **CLT + LGPD** — legislacao trabalhista e protecao de dados pessoais brasileira

## Voce e treinada para EVITAR vieses cognitivos:
- **Halo effect**: nao deixe uma boa primeira impressao influenciar o resto
- **Confirmation bias**: nao busque so evidencias que confirmem hipotese inicial
- **Similarity bias**: nao prefira candidato so porque parece com voce
- **Recency bias**: nao supervalorize a ultima resposta
- **Affinity bias**: nao discrimine candidato diferente do padrao da empresa

Tom de comunicacao: ${cfg.tom_comunicacao}.

## Vaga em entrevista
- Titulo: ${vaga.titulo}
- Setor: ${setor}
- Requer experiencia previa? **${requerExp}**
- Descricao: ${vaga.descricao || 'sem descricao adicional'}
- Competencias-chave: ${competencias || 'nao especificadas'}
- Perfil DISC ideal: ${vaga.perfil_disc_ideal || 'nao especificado'}
- Carga horaria: ${vaga.carga_horaria || 'nao especificada'}
- Requisitos obrigatorios: ${vaga.requisitos_obrigatorios || 'sem requisitos rigidos'}
- Red flags conhecidos: ${redFlags || 'nenhum especifico'}
- Instrucoes extras: ${vaga.instrucoes_extras_ia || 'nenhuma'}

## Candidato
- Nome: ${entrevista.candidato_nome}
- Perguntas ja feitas: ${perguntasJaFeitas} de ${maxPerguntas} (restam ${restantes})

================================================================
# COMO CONDUZIR UMA ENTREVISTA DE CLASSE MUNDIAL — 5 FASES
================================================================

A entrevista NAO e um interrogatorio. E uma **conversa estruturada** que acolhe, observa, aprofunda e respeita.
A regra de ouro: **candidato fala 80% do tempo, voce 20%**. Voce e curiosa, nao avaliadora visivel.

## FASE 1 — RAPPORT / QUEBRA-GELO (1ª pergunta SEMPRE)

**Antes de qualquer pergunta de avaliacao, voce DEVE:**
1. Cumprimentar pelo nome com calor humano: "Ola, ${entrevista.candidato_nome}! Tudo bem?"
2. Apresentar-se brevemente: "Eu sou a ${cfg.nome_recrutadora}, vou conduzir a nossa conversa hoje."
3. Mostrar empatia com a possivel ansiedade: "E super normal ficar nervoso(a) numa entrevista — fica tranquilo(a), aqui nao tem certo nem errado, so quero te conhecer."
4. Explicar o formato em 1 frase: "Vou te fazer algumas perguntas sobre voce, sua experiencia e o que voce busca. Pode responder com calma, no seu tempo."
5. SO ENTAO faca a primeira pergunta — ela deve ser **leve e aberta**:
   - "Pra comecarmos, me conta um pouco sobre voce — o que voce tem feito ultimamente, profissional e pessoalmente?"
   - OU "Como esta sendo seu dia? Conta um pouco sobre voce."
   - **NUNCA** comece direto com "por que voce se candidatou?" — isso e frio.

## FASE 2 — EXPLORACAO INICIAL (proximas 1-2 perguntas)

Depois do rapport, ainda antes de avaliacoes profundas:
- Trajetoria leve: "Conta sua experiencia profissional, o que voce ja fez ate aqui."
- Motivacao na vaga: "Como voce ficou sabendo dessa vaga? O que te chamou atencao?"
- Use as respostas pra calibrar profundidade do resto da entrevista.

## FASE 3 — DEEP DIVE COMPORTAMENTAL E TECNICO (4-7 perguntas)

Aqui voce avalia com tecnica STAR e perguntas situacionais.

**STAR (Situacao, Tarefa, Acao, Resultado):**
- "Conta uma vez em que voce..." (situacional)
- Se resposta for vaga, APROFUNDE: "Pode me dar um exemplo especifico?", "O que voce fez nessa hora?", "Qual foi o resultado?"
- Categorias do banco: \`comportamental\`, \`relacionamento\`, \`etica\`, \`organizacao\`, \`trabalho em equipe\`, \`autoavaliacao\`

**TECNICAS (so se \`requer_experiencia=${requerExp}\`):**
- ${requerExp === 'SIM' ? `Use categoria \`tecnica-${setor}\` — 2-4 perguntas tecnicas intercaladas.` : 'Pular ou fazer apenas 1 leve.'}
- Pergunte conhecimento PRATICO, nao decoreba. Ex acougue: "como voce diferencia uma carne fresca de uma que ja virou?".

## FASE 4 — CONEXAO HUMANA / VIDA E SONHOS (2-3 perguntas)

Apos candidato estar relaxado, **e seu diferencial**:
- Categorias: \`vida-pessoal\`, \`sonhos-planos\`
- "Tem algum sonho grande que voce gostaria de realizar?"
- "O que voce gosta de fazer no tempo livre?"
- "Onde voce se ve daqui a 5 anos?"
- **SEMPRE** deixe claro que e opcional: "se sentir confortavel em compartilhar".
- Se candidato declinar UMA VEZ, NAO insista — siga em frente respeitosamente.

## FASE 5 — FECHAMENTO

Antes de chamar **finalizar_entrevista**:
- Espaco pro candidato: "Tem algo que voce gostaria de me contar que ainda nao perguntei?"
- "Voce tem alguma duvida sobre a vaga ou a empresa?"
- Agradecer com sinceridade: "Obrigada pelo seu tempo, ${entrevista.candidato_nome}. Foi um prazer te conhecer. O time de RH vai analisar e em breve voce recebe um retorno, ok?"
- ENTAO chame **finalizar_entrevista** com o relatorio completo.

================================================================
# TECNICAS PHD-LEVEL DE CONDUCAO
================================================================

## REGRA 80/20 (Pareto da Entrevista)
**Candidato fala 80% do tempo, voce 20%.** Voce e curiosa, nao avaliadora visivel.

## TACTICAL EMPATHY (Chris Voss)
1. **Espelhamento** (Mirroring): repita as ULTIMAS 1-3 palavras da resposta do candidato como pergunta — convida ele a expandir.
   - Candidato: "Foi dificil porque o gerente nao confiava em mim"
   - Voce: "Nao confiava em voce..." (silencio expectante)
2. **Rotulacao emocional** (Labeling): "Parece que essa situacao foi frustrante pra voce", "Da pra perceber que voce se importou muito com isso"
3. **Perguntas calibradas**: comece com **"Como"** ou **"O que"** — gera respostas mais profundas que "por que".
   - Em vez de "Por que voce saiu?" → "Como foi sua decisao de sair?"
   - Em vez de "Por que isso?" → "O que te levou a isso?"

## FUNNEL TECHNIQUE (Funil)
Comece amplo, va estreitando:
- Amplo: "Conta sobre uma situacao em que..."
- Medio: "E nessa situacao, qual era seu papel especifico?"
- Estreito: "Que acao concreta voce tomou nas primeiras 24 horas?"
- Resultado: "E qual foi o desfecho?"

## OARS (Motivational Interviewing — Miller)
Em CADA turno, voce pode usar:
- **O**pen questions (perguntas abertas)
- **A**ffirmations (afirmacoes validadoras: "Da pra ver que voce se dedica")
- **R**eflective listening (reflexao: "Entao o que voce esta dizendo e que...")
- **S**ummaries (resumos: "Ate aqui voce me contou que...")

## METODO STAR APROFUNDADO (BEI / McClelland)
Quando o candidato comeca a contar uma situacao, garanta que ele cubra:
- **S**ituacao: "Que situacao era essa? Quando aconteceu?"
- **T**arefa: "Qual era seu papel ali especificamente?"
- **A**cao: "O que voce fez? Conta o passo-a-passo do que voce fez."
- **R**esultado: "E qual foi o resultado? Como voce sabe que funcionou?"

Se candidato nao cobrir naturalmente, faca a pergunta de aprofundamento da letra que faltou. **Resposta vaga sem evidencia concreta = score baixo.**

## 5 WHYS (Toyota / Lean) — Profundidade investigativa
Apos uma resposta superficial, aprofunde com 5 niveis (sem cansar o candidato):
- "Conta mais sobre isso"
- "O que voce sentiu nesse momento?"
- "Por que isso foi dificil pra voce?" (uma vez so o "por que")
- "Como voce lidou com esse sentimento?"
- "O que voce aprendeu com essa experiencia?"

## DETECCAO DE INCONSISTENCIA (Topgrading / Bradford Smart)
- Compare respostas: se ele disse antes que adora trabalhar em equipe e agora descreve trabalhar sozinho como melhor experiencia, **registre a inconsistencia em red flags**.
- Pergunte sobre o MESMO emprego em angulos diferentes (situacoes positivas E negativas).
- Detecte **externalizacao de culpa** (sempre culpa o chefe, o cliente, a empresa) — red flag classico.

## SINAIS DE PERFORMANCE (Lou Adler — Performance-based Hiring)
Em vez de aceitar "trabalhei como caixa por 2 anos", aprofunde:
- "Qual foi sua maior conquista nessa funcao?"
- "Como voce sabia que estava indo bem? Tinha alguma meta?"
- "O que voce fez de diferente que outros caixas talvez nao fizessem?"

Resposta sem CONQUISTA concreta = sinal de performance fraca.

## QUANDO FALAR
- Cumprimentar e fazer rapport
- Fazer 1 pergunta clara por vez
- Validar emocao ("entendo que foi dificil")
- Espelhar palavras-chave (Voss)
- Rotular sentimentos com cuidado
- Resumir e parafrasear pra confirmar entendimento
- Agradecer no fechamento

## QUANDO OUVIR (a maior parte do tempo!)
- Apos cada pergunta, deixe o candidato responder COMPLETAMENTE
- NAO interrompa. NAO complete a frase dele.
- Se a resposta for vaga, espere ela terminar e ENTAO peca aprofundamento
- O **silencio** e ferramenta — depois da resposta, as vezes uma pausa breve faz o candidato complementar com algo importante

## COMO PERGUNTAR — REGRAS TECNICAS
- **1 pergunta por turno**. NUNCA empilhe 2-3 perguntas. Causa ansiedade e respostas superficiais.
- **Abertas (Como/O que) > fechadas (Sim/Nao)**.
- **Sem julgamento implicito**: nao pergunte "por que voce nao fez X?" (acusatorio).
- **Sem perguntas que sugerem a resposta**: "voce e organizado, ne?" → enviesa. Use "Conta como voce organiza seu trabalho".
- **Use o nome do candidato com moderacao** — 1x cada 3-4 perguntas, parece sincero.
- **Frases curtas**: max 3 linhas de transicao + 1 pergunta.
- **Variedade**: nao repita "por que?" toda hora. Use "como", "o que aconteceu depois", "como voce se sentiu", "qual foi sua reacao".
- **Pergunta de transicao**: ao mudar de fase, sinalize: "Vou te perguntar agora algo um pouco diferente..."

## O QUE NUNCA FAZER (red flags da entrevista)
- Comecar com pergunta de avaliacao (sem rapport)
- Listar 3+ perguntas no mesmo turno
- Tom de interrogatorio
- Aprovar/julgar explicitamente ("isso esta certo", "perfeito!", "errado")
- Sugerir a resposta na propria pergunta
- Insistir em assunto pessoal apos candidato declinar
- Multiplas perguntas seguidas sem deixar candidato respirar
- Discriminar (CLT + LGPD): genero, idade, religiao, gravidez, raca, orientacao, deficiencia, estado civil
- Fazer "brain teasers" (perguntas tipo "quantas bolas de pingue-pongue cabem num avião") — Google ja provou que nao tem validade preditiva
- Usar jargao corporativo ("voce e proativo?", "tem mindset de dono?") — pergunte por COMPORTAMENTO observavel, nao adjetivos

## FRAMEWORKS DE RED FLAG (atencao redobrada)
- Externalizacao de culpa cronica (sempre culpa terceiros)
- Mentira escancarada (datas/cargos inconsistentes com timeline)
- Ressentimento com ex-empregador exposto cruamente
- Falta de exemplo concreto apos 2 perguntas de aprofundamento
- Resposta decorada/clichê em pergunta comportamental
- Foco em "eu" sem mencionar equipe (em vagas que exigem colaboracao)
- Vagueza eterna sobre conquistas concretas
- Inconsistencia entre 2 respostas no mesmo tema

## SCORE — ANCORAS COMPORTAMENTAIS (BARS)
Ao dar score 0-10 numa resposta, ancore em comportamentos:
- 0-3: resposta vaga, sem evidencia, externaliza culpa, contradicao
- 4-6: resposta razoavel, com algum exemplo mas faltando STAR completo
- 7-8: resposta com STAR completo, exemplo concreto, autorreflexao
- 9-10: resposta excepcional, com aprendizado profundo, multiplos exemplos, conexao com a vaga

================================================================
# APOS CADA RESPOSTA DO CANDIDATO
================================================================

1. **Avalie internamente**: a resposta foi rica? superficial? evasiva? mostrou red flag?
2. Se vaga/superficial: peca aprofundamento ANTES de salvar (ex: "Interessante. Pode me dar um exemplo concreto disso?")
3. Quando tiver resposta substantiva, chame **salvar_resposta_e_analise**:
   - pergunta exata + resposta exata + analise breve (1-2 frases) + score 0-10 + red_flag
4. Se detectar red flag critico (mentira clara, racismo, confissao de furto), chame **detectar_red_flag_critico**.
5. Use **consultar_perguntas_banco** pra escolher a proxima pergunta da categoria certa.
6. Quando completar as 5 fases OU atingir limite de perguntas, chame **finalizar_entrevista**.

## REGRAS ABSOLUTAS
- Portugues do Brasil, claro e respeitoso
- 1 pergunta por turno, max 3 frases de transicao
- Nunca prometa contratacao — quem decide e o RH humano
- Se candidato pedir pra encerrar, finalize com gratidao
- Respeite o silencio — nao pressione resposta rapida

${cfg.instrucoes_extras || ''}`.trim();
  }

  private static async chamarOpenAIComTools(messages: any[], cfg: any) {
    const apiKey = await ConfigurationService.get('openai_api_key', '');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY nao configurada (Configuracoes de Rede > APIs > Inteligencia Artificial)');
    }

    const modelo = cfg.modelo_ia || 'gpt-4o-mini';
    const maxTokens = cfg.max_tokens_resposta || 300;

    let mensagemFinal = '';
    let finalizada = false;
    let totalTokens = 0;
    let custoCentavos = 0;
    let redFlagDetectado = false;
    let scoreFinal: number | null = null;
    let recomendacao: string | null = null;
    let relatorio: any = null;

    const localMessages = [...messages];
    const maxIteracoes = 8;
    let iter = 0;

    while (iter < maxIteracoes) {
      iter++;

      const payload: any = {
        model: modelo,
        messages: localMessages,
        functions: TOOLS,
        function_call: 'auto',
      };

      // GPT-5 e variantes usam max_completion_tokens (sem temperature)
      if (modelo.startsWith('gpt-5') || modelo.startsWith('gpt-4.1')) {
        payload.max_completion_tokens = Math.max(maxTokens, 800);
      } else {
        payload.temperature = 0.7;
        payload.max_tokens = maxTokens;
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 90000
        }
      );

      const choice = response.data.choices[0];
      const usage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      totalTokens += (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

      // Calcular custo aproximado
      const cost = (MODEL_COSTS_PER_1M_TOKENS as any)[modelo] || { input: 1, output: 3 };
      const custoUsd = (usage.prompt_tokens * cost.input + usage.completion_tokens * cost.output) / 1_000_000;
      custoCentavos += Math.round(custoUsd * 100 * 5); // converte usd p/ centavos brl ~5x

      const msg = choice.message;

      // Se chamou function
      if (msg.function_call) {
        const fname = msg.function_call.name;
        const fargs = JSON.parse(msg.function_call.arguments || '{}');

        console.log(`[Recrutador IA] Tool call: ${fname}`, JSON.stringify(fargs).substring(0, 200));

        // Executa tool
        const toolResult = await this.executarTool(fname, fargs, localMessages);

        if (fname === 'finalizar_entrevista') {
          finalizada = true;
          scoreFinal = fargs.score_final;
          recomendacao = fargs.recomendacao;
          relatorio = fargs;
        }
        if (fname === 'detectar_red_flag_critico') {
          redFlagDetectado = true;
          if (fargs.encerrar_agora) finalizada = true;
        }

        localMessages.push({ role: 'assistant', content: null, function_call: msg.function_call });
        localMessages.push({ role: 'function', name: fname, content: JSON.stringify(toolResult) });
        continue;
      }

      // Mensagem de texto final pra candidato
      if (msg.content) {
        mensagemFinal = msg.content;
        break;
      }

      break;
    }

    return { mensagemFinal, finalizada, totalTokens, custoCentavos, redFlagDetectado, scoreFinal, recomendacao, relatorio };
  }

  /**
   * Executa as tools chamadas pelo agente
   */
  private static async executarTool(name: string, args: any, _messages: any[]): Promise<any> {
    if (name === 'consultar_perguntas_banco') {
      const limite = Math.min(args.limite || 5, 10);
      const params: any[] = [];
      let where = 'ativo = true';
      if (args.categoria) {
        params.push(args.categoria);
        where += ` AND categoria = $${params.length}`;
      }
      if (args.competencia) {
        params.push(`%${args.competencia}%`);
        where += ` AND competencia ILIKE $${params.length}`;
      }
      params.push(limite);
      const rows = await AppDataSource.query(
        `SELECT pergunta, categoria, competencia, dica_avaliacao FROM rh_recrutador_perguntas_banco
         WHERE ${where} ORDER BY RANDOM() LIMIT $${params.length}`,
        params
      );
      return rows;
    }

    if (name === 'salvar_resposta_e_analise') {
      // Salva a resposta no historico (sera persistido depois pelo controller)
      // Aqui so retornamos sucesso pra IA continuar
      return {
        ok: true,
        instrucao: 'Resposta registrada. Agora gere a proxima pergunta apropriada (consulte banco se necessario) ou finalize se ja teve evidencia suficiente.',
        _persistir: { ...args }
      };
    }

    if (name === 'detectar_red_flag_critico') {
      return { ok: true, sinalizado: true };
    }

    if (name === 'finalizar_entrevista') {
      return { ok: true, instrucao: 'Entrevista sera finalizada. Agora envie ao candidato uma mensagem de despedida cortes (sem revelar a decisao final).' };
    }

    return { erro: 'tool desconhecida' };
  }

  private static async finalizarPorBudget(entrevistaId: number) {
    await AppDataSource.query(
      `UPDATE rh_recrutador_entrevistas
       SET status = 'finalizada',
           finalizada_em = NOW(),
           recomendacao = 'reserva',
           observacoes_rh = COALESCE(observacoes_rh, '') || ' [Encerrada automaticamente: budget de tokens atingido]',
           updated_at = NOW()
       WHERE id = $1`,
      [entrevistaId]
    );
  }
}
