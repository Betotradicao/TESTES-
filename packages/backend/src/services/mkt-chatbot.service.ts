import { AppDataSource } from '../config/database';
import { MktChatbotFluxo } from '../entities/MktChatbotFluxo';
import { MktChatbotBloco } from '../entities/MktChatbotBloco';
import { MktChatbotConexao } from '../entities/MktChatbotConexao';
import { MktChatbotContato } from '../entities/MktChatbotContato';
import { MktChatbotSessao } from '../entities/MktChatbotSessao';
import { MktChatbotMensagem } from '../entities/MktChatbotMensagem';
import { ConfigurationService } from './configuration.service';

/**
 * Engine do chatbot — modelo grafo.
 *
 * Fluxo:
 * 1. Webhook chega com mensagem do cliente
 * 2. Identifica/cria contato pelo telefone
 * 3. Verifica sessao ativa (e nao expirada)
 *    - Sem sessao: cria nova no bloco inicial
 *    - Com sessao: usa o bloco_atual como ponto de partida
 * 4. Decide proximo bloco baseado no tipo do bloco atual:
 *    - 'mensagem' / 'atendente' / 'encerrar': segue conexao automatica (condicao=null)
 *    - 'pergunta': procura conexao com condicao = resposta do usuario
 *    - 'ia': chama LLM, envia resposta, segue conexao automatica (ou mantem-se em loop)
 * 5. Renderiza o proximo bloco (delay + typing + envio)
 * 6. Se proximo bloco eh do tipo "automatico" (mensagem/atendente/encerrar) e nao
 *    espera resposta, avanca recursivamente ate chegar num bloco que aguarda
 *    resposta (pergunta) ou termina (atendente/encerrar)
 */
export class MktChatbotService {
  private static normalizarTelefone(tel: string): string {
    return (tel || '').replace(/\D/g, '');
  }

  /**
   * Deixa a resposta do cliente comparavel com a condicao da conexao.
   * Tira acento, pontuacao e caixa: "Salvei!", " SALVEI " e "salvei" viram o mesmo.
   * O cliente digita no celular, com pressa — nao da pra exigir texto exato.
   */
  private static normalizarResposta(txt: string): string {
    return (txt || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acento (marcas combinantes)
      .replace(/[^\w\s]/g, '')                          // tira pontuacao
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Numero por extenso -> digito. Muita gente escreve "dois" em vez de "2". */
  private static readonly NUMERO_EXTENSO: Record<string, string> = {
    zero: '0', um: '1', uma: '1', primeiro: '1', primeira: '1',
    dois: '2', duas: '2', segundo: '2', segunda: '2',
    tres: '3', terceiro: '3', terceira: '3',
    quatro: '4', quarto: '4', quarta: '4',
    cinco: '5', quinto: '5', quinta: '5',
    seis: '6', sexto: '6', sexta: '6',
    sete: '7', setimo: '7', setima: '7',
    oito: '8', oitavo: '8', oitava: '8',
    nove: '9', nono: '9', nona: '9',
    dez: '10', decimo: '10', decima: '10',
  };

  /**
   * Damerau-Levenshtein (optimal string alignment) — quantas edicoes separam
   * duas strings, contando troca de letras VIZINHAS como uma so.
   *
   * Levenshtein puro cobraria 2 por "salvei"->"salvie", que e justamente o erro
   * de digitacao mais comum (dedo mais rapido que a cabeca). Com o limite em 1,
   * o typo mais provavel seria o unico a nao ser perdoado.
   */
  private static distancia(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const custo = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,          // remocao
          d[i][j - 1] + 1,          // insercao
          d[i - 1][j - 1] + custo,  // substituicao
        );
        // Transposicao de vizinhas: "ie" <-> "ei"
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }

  /**
   * A resposta do cliente casa com a condicao desta conexao?
   *
   * Vai afrouxando em camadas, da mais segura pra mais tolerante:
   *  1. igual (ja normalizado)
   *  2. numero por extenso: "um" casa com "1"
   *  3. a palavra aparece na frase: "ja salvei aqui" casa com "salvei"
   *  4. erro de digitacao: "salvie" casa com "salvei"
   *
   * As camadas 3 e 4 SO valem pra palavra. Em numero de menu seria um tiro no pe:
   * "1" e "2" tem distancia 1, entao aproximar mandaria o cliente pra opcao errada.
   */
  private static condicaoBate(condicao: string, resposta: string): boolean {
    const cond = this.normalizarResposta(condicao);
    const resp = this.normalizarResposta(resposta);
    if (!cond || !resp) return false;

    if (cond === resp) return true;

    // Numero por extenso, nos dois sentidos
    const respNum = this.NUMERO_EXTENSO[resp];
    if (respNum && respNum === cond) return true;
    const condNum = this.NUMERO_EXTENSO[cond];
    if (condNum && (condNum === resp || condNum === respNum)) return true;

    // Dai pra frente, so palavra. Numero para aqui.
    const ehNumero = /^\d+$/.test(cond);
    if (ehNumero || cond.length < 4) return false;

    // A palavra esperada aparece solta na frase
    const palavras = resp.split(' ');
    if (palavras.includes(cond)) return true;

    // Erro de digitacao — tolerancia cresce com o tamanho da palavra
    const limite = cond.length >= 8 ? 2 : 1;
    if (this.distancia(cond, resp) <= limite) return true;
    // ...ou numa das palavras da frase ("ja salvie" -> "salvei")
    return palavras.some(p => p.length >= 4 && this.distancia(cond, p) <= limite);
  }

  private static async resolverInstance(fluxo: MktChatbotFluxo): Promise<string> {
    if (fluxo.instance_name) return fluxo.instance_name;
    const fromConfig = await ConfigurationService.get('disparo_whats_instancia', '');
    return fromConfig || 'MARKETING';
  }

  private static delay(seconds: number): Promise<void> {
    return new Promise(r => setTimeout(r, Math.max(0, seconds) * 1000));
  }

  private static async enviarTyping(instance: string, telefone: string, seconds = 2): Promise<void> {
    try {
      const url = await ConfigurationService.get('disparo_whats_url', '');
      const token = await ConfigurationService.get('disparo_whats_token', '');
      if (!url || !token) return;
      await fetch(`${url}/chat/sendPresence/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': token },
        body: JSON.stringify({ number: telefone, delay: seconds * 1000, presence: 'composing' }),
      });
    } catch (e: any) {
      console.error('[Chatbot] typing erro:', e?.message);
    }
  }

  private static async enviarTexto(instance: string, telefone: string, texto: string): Promise<string | null> {
    try {
      const url = await ConfigurationService.get('disparo_whats_url', '');
      const token = await ConfigurationService.get('disparo_whats_token', '');
      if (!url || !token) {
        console.warn('[Chatbot] Evolution nao configurada (disparo_whats_url/token)');
        return null;
      }
      const resp = await fetch(`${url}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': token },
        body: JSON.stringify({ number: telefone, text: texto }),
      });
      if (!resp.ok) {
        console.error('[Chatbot] sendText falhou:', resp.status, await resp.text());
        return null;
      }
      const data: any = await resp.json();
      return data?.key?.id || null;
    } catch (e: any) {
      console.error('[Chatbot] enviarTexto erro:', e?.message);
      return null;
    }
  }

  /**
   * Renderiza um bloco: monta texto de saida, mostra typing/delay, envia.
   * Retorna se o bloco "aguarda resposta" (true = pergunta) ou se eh automatico.
   */
  private static async renderizarBloco(
    sessao: MktChatbotSessao,
    bloco: MktChatbotBloco,
    instance: string,
    telefone: string,
    textoUsuario: string,
  ): Promise<{ aguardaResposta: boolean; encerrar: boolean }> {
    const dados = bloco.dados || {};
    const delay = Number(dados.delay_segundos ?? 1);
    const typing = dados.mostrar_typing !== false;

    let textoFinal = '';
    let encerrar = false;
    let aguardaResposta = false;

    if (bloco.tipo === 'mensagem') {
      textoFinal = String(dados.texto || '');
      if (dados.link_url) textoFinal += `\n\n${dados.link_url}`;
    } else if (bloco.tipo === 'pergunta') {
      textoFinal = String(dados.texto || '');
      const opcoes = Array.isArray(dados.opcoes) ? dados.opcoes : [];
      if (opcoes.length > 0) {
        textoFinal += '\n\n' + opcoes.map((o: any) => `${o.numero}️⃣ ${o.label}`).join('\n');
      }
      aguardaResposta = true;
    } else if (bloco.tipo === 'ia') {
      // Chama LLM (placeholder — implementacao real abaixo)
      textoFinal = await this.executarBlocoIA(sessao, bloco, textoUsuario);
      // Por padrao bloco IA aguarda nova resposta (loop ate o usuario sair)
      aguardaResposta = true;
    } else if (bloco.tipo === 'atendente') {
      textoFinal = String(dados.mensagem_transferencia || '👤 Em instantes você será atendido por um humano. Aguarde, por favor.');
      encerrar = true;
    } else if (bloco.tipo === 'encerrar') {
      textoFinal = String(dados.mensagem_despedida || '👋 Conversa encerrada. Até logo!');
      encerrar = true;
    }

    if (typing && delay > 0) {
      await this.enviarTyping(instance, telefone, delay);
    }
    await this.delay(delay);

    let msgId: string | null = null;
    if (textoFinal.trim()) {
      msgId = await this.enviarTexto(instance, telefone, textoFinal);
      await AppDataSource.getRepository(MktChatbotMensagem).save({
        sessao_id: sessao.id,
        direcao: 'enviada',
        conteudo: textoFinal,
        bloco_id: bloco.id,
        whatsapp_message_id: msgId,
      } as MktChatbotMensagem);
    }

    sessao.bloco_atual_id = bloco.id;
    sessao.ultima_atividade_at = new Date();
    if (encerrar) {
      sessao.status = bloco.tipo === 'atendente' ? 'transferida_humano' : 'finalizada';
      sessao.finalizada_at = new Date();
    }
    await AppDataSource.getRepository(MktChatbotSessao).save(sessao);

    return { aguardaResposta, encerrar };
  }

  /**
   * Executa um bloco do tipo "ia". Usa OpenAI/Claude conforme config.
   * Por enquanto faz fallback simples — a integracao completa pode ser
   * implementada depois.
   */
  private static async executarBlocoIA(
    sessao: MktChatbotSessao,
    bloco: MktChatbotBloco,
    textoUsuario: string,
  ): Promise<string> {
    const dados = bloco.dados || {};
    const promptSistema = String(dados.prompt_sistema || 'Voce e um atendente cordial.');
    const persona = String(dados.persona || '');

    // Atualiza contexto da sessao
    const contexto = Array.isArray(sessao.contexto_ia) ? sessao.contexto_ia : [];
    contexto.push({ role: 'user', content: textoUsuario });

    try {
      const openaiKey = await ConfigurationService.get('openai_api_key', '');
      if (!openaiKey) {
        return '🤖 (Integração com IA não configurada — adicione openai_api_key em Configurações)';
      }

      const messages = [
        { role: 'system', content: persona ? `${promptSistema}\n\nPersona: ${persona}` : promptSistema },
        ...contexto.slice(-10), // ultimas 10 mensagens
      ];

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: dados.modelo || 'gpt-4o-mini',
          messages,
          temperature: Number(dados.temperatura ?? 0.7),
          max_tokens: Number(dados.max_tokens ?? 500),
        }),
      });
      if (!resp.ok) {
        return `🤖 (Erro IA: ${resp.status})`;
      }
      const data: any = await resp.json();
      const resposta = data?.choices?.[0]?.message?.content || '';
      contexto.push({ role: 'assistant', content: resposta });
      sessao.contexto_ia = contexto.slice(-20);
      return resposta;
    } catch (e: any) {
      console.error('[Chatbot IA]', e?.message);
      return '🤖 Desculpe, tive um problema técnico. Pode reformular?';
    }
  }

  /**
   * A partir do bloco atual, decide qual bloco vem em seguida.
   * - Para blocos automaticos (mensagem/atendente/encerrar): segue 1a conexao sem condicao
   * - Para 'pergunta': procura conexao com condicao = resposta do usuario; se nao acha,
   *   tenta conexao com condicao '*' (fallback); senao retorna null
   */
  private static async resolverProximoBloco(
    blocoAtual: MktChatbotBloco,
    respostaUsuario: string,
  ): Promise<MktChatbotBloco | null> {
    const conexoes = await AppDataSource.getRepository(MktChatbotConexao).find({
      where: { origem_id: blocoAtual.id },
      order: { ordem: 'ASC', id: 'ASC' },
    });
    if (conexoes.length === 0) return null;

    let proxId: number | null = null;

    if (blocoAtual.tipo === 'pergunta' || blocoAtual.tipo === 'ia') {
      // Ordem importa: quem vier primeiro na lista ganha. Por isso condicaoBate
      // e conservador — nunca aproxima numero (ver la).
      const match = conexoes.find(c => c.condicao && c.condicao !== '*' && this.condicaoBate(c.condicao, respostaUsuario));
      if (match) proxId = match.destino_id;
      else {
        // Fallback
        const fallback = conexoes.find(c => c.condicao === '*' || c.condicao === null);
        if (fallback) proxId = fallback.destino_id;
      }
    } else {
      // Automatico — segue primeira conexao
      proxId = conexoes[0].destino_id;
    }

    if (!proxId) return null;
    return AppDataSource.getRepository(MktChatbotBloco).findOne({ where: { id: proxId } });
  }

  /**
   * Recebe o payload cru da Evolution e toca o fluxo se for mensagem de cliente.
   *
   * Mora aqui (e nao no controller) porque a Evolution so aceita UM webhook por
   * instancia: como o disparo e o chatbot dividem a instancia MARKETING, o
   * webhook do disparo tambem precisa despachar pra ca. Os dois entram por este
   * mesmo ponto.
   */
  static async processarPayloadEvolution(body: any): Promise<void> {
    const evento = String(body?.event || body?.eventType || '').toLowerCase().replace(/_/g, '.');
    // So mensagem nova. 'messages.update' e recibo de entrega — e do disparo.
    if (evento && evento !== 'messages.upsert') return;

    const data = body?.data || body;
    if (!data?.key || data.key.fromMe) return;

    const remoteJid: string = data.key.remoteJid || '';
    if (!remoteJid || remoteJid.endsWith('@g.us')) return; // grupo nao

    const telefone = (remoteJid.split('@')[0] || '').replace(/\D/g, '');
    if (!telefone) return;

    const texto = (
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      data.message?.videoMessage?.caption ||
      ''
    ).trim();
    if (!texto) return;

    await this.processarMensagemRecebida(telefone, data.pushName || null, texto);
  }

  /**
   * Ponto de entrada: processa mensagem recebida.
   */
  static async processarMensagemRecebida(
    telefone: string,
    nomeWhats: string | null,
    textoRecebido: string,
  ): Promise<void> {
    const tel = this.normalizarTelefone(telefone);
    if (!tel) return;

    const fluxoRepo = AppDataSource.getRepository(MktChatbotFluxo);
    const fluxo = await fluxoRepo.findOne({ where: { ativo: true }, order: { id: 'ASC' } });
    if (!fluxo) {
      console.log('[Chatbot] sem fluxo ativo, ignorando mensagem');
      return;
    }
    const instance = await this.resolverInstance(fluxo);

    // Identifica/cria contato
    const contatoRepo = AppDataSource.getRepository(MktChatbotContato);
    let contato = await contatoRepo.findOne({ where: { telefone: tel } });
    const eraNovo = !contato;
    if (!contato) {
      contato = contatoRepo.create({
        telefone: tel,
        nome_whatsapp: nomeWhats,
        primeira_msg_at: new Date(),
        ultima_msg_at: new Date(),
        total_msgs: 1,
      });
    } else {
      contato.nome_whatsapp = contato.nome_whatsapp || nomeWhats;
      contato.ultima_msg_at = new Date();
      contato.total_msgs = (contato.total_msgs || 0) + 1;
    }
    if (contato.bloqueado) return;
    await contatoRepo.save(contato);

    // Verifica sessao ativa
    const sessaoRepo = AppDataSource.getRepository(MktChatbotSessao);
    let sessao = await sessaoRepo.findOne({
      where: { contato_id: contato.id, status: 'ativa' as any },
      order: { id: 'DESC' },
    });
    const timeoutMs = (fluxo.timeout_inatividade_min || 1440) * 60 * 1000;
    if (sessao && (Date.now() - new Date(sessao.ultima_atividade_at).getTime()) > timeoutMs) {
      sessao.status = 'expirada';
      sessao.finalizada_at = new Date();
      await sessaoRepo.save(sessao);
      sessao = null;
    }

    const blocoRepo = AppDataSource.getRepository(MktChatbotBloco);
    let proximoBloco: MktChatbotBloco | null = null;

    // Cooldown do menu: "ja mandei o menu pra esse contato faz pouco tempo".
    // Sem isso o bot despeja o menu inteiro a cada "oi" que nao casa com opcao.
    const menuEmCooldown = this.menuEmCooldown(fluxo, contato);

    if (!sessao) {
      const inicial = await blocoRepo.findOne({ where: { fluxo_id: fluxo.id, is_inicial: true } });
      if (!inicial) {
        console.error('[Chatbot] fluxo sem bloco inicial');
        return;
      }
      sessao = sessaoRepo.create({
        contato_id: contato.id,
        fluxo_id: fluxo.id,
        // Ja aponta pro menu: mesmo calado, se o cliente digitar "1" a gente
        // sabe de onde ele esta respondendo.
        bloco_atual_id: inicial.id,
        iniciada_at: new Date(),
        ultima_atividade_at: new Date(),
        status: 'ativa',
        contexto_ia: [],
      });
      sessao = await sessaoRepo.save(sessao);

      // Loga 1a mensagem recebida
      await AppDataSource.getRepository(MktChatbotMensagem).save({
        sessao_id: sessao.id,
        direcao: 'recebida',
        conteudo: textoRecebido,
      } as MktChatbotMensagem);

      if (menuEmCooldown) {
        console.log(`[Chatbot] ${tel}: menu em cooldown (${fluxo.intervalo_menu_horas}h), nao reenviando`);
        return;
      }

      // Saudacao 1a vez ou recorrente
      const saudacao = eraNovo ? fluxo.mensagem_primeira_vez : fluxo.mensagem_recorrente;
      if (saudacao) {
        await this.enviarTexto(instance, tel, saudacao);
        await AppDataSource.getRepository(MktChatbotMensagem).save({
          sessao_id: sessao.id,
          direcao: 'enviada',
          conteudo: saudacao,
        } as MktChatbotMensagem);
        await this.delay(1);
      }

      proximoBloco = inicial;
    } else {
      // Sessao ativa — interpreta resposta
      await AppDataSource.getRepository(MktChatbotMensagem).save({
        sessao_id: sessao.id,
        direcao: 'recebida',
        conteudo: textoRecebido,
      } as MktChatbotMensagem);

      const blocoAtual = sessao.bloco_atual_id
        ? await blocoRepo.findOne({ where: { id: sessao.bloco_atual_id } })
        : null;

      if (!blocoAtual) {
        // Sem bloco atual — reseta no inicial
        proximoBloco = await blocoRepo.findOne({ where: { fluxo_id: fluxo.id, is_inicial: true } });
      } else {
        proximoBloco = await this.resolverProximoBloco(blocoAtual, textoRecebido);
        if (!proximoBloco) {
          // Nao casou com nenhuma opcao. Repetir o bloco e o certo (o cliente
          // errou a opcao), mas se o bloco for o MENU e ele acabou de receber o
          // menu, repetir vira spam — cala a boca ate o cooldown passar.
          if (blocoAtual.is_inicial && menuEmCooldown) {
            console.log(`[Chatbot] ${tel}: resposta invalida no menu, mas menu em cooldown — ignorando`);
            return;
          }
          await this.delay(1);
          await this.enviarTexto(instance, tel, '❓ Não entendi sua resposta. Por favor, escolha uma das opções abaixo:');
          proximoBloco = blocoAtual;
        }
      }
    }

    // Renderiza em loop ate aguardar resposta ou encerrar
    let safety = 0;
    while (proximoBloco && safety++ < 10) {
      // Marca quando o menu vai pro contato — e o relogio do cooldown
      if (proximoBloco.is_inicial) {
        contato.ultimo_menu_at = new Date();
        await contatoRepo.save(contato);
      }
      const result = await this.renderizarBloco(sessao, proximoBloco, instance, tel, textoRecebido);
      if (result.aguardaResposta || result.encerrar) break;
      // Bloco automatico — avanca
      proximoBloco = await this.resolverProximoBloco(proximoBloco, '');
    }
  }

  /**
   * O menu ja foi pra esse contato ha menos de `intervalo_menu_horas`?
   * 0 (default) desliga o cooldown e mantem o comportamento antigo.
   */
  private static menuEmCooldown(fluxo: MktChatbotFluxo, contato: MktChatbotContato): boolean {
    const horas = Number(fluxo.intervalo_menu_horas || 0);
    if (horas <= 0 || !contato.ultimo_menu_at) return false;
    const decorridoMs = Date.now() - new Date(contato.ultimo_menu_at).getTime();
    return decorridoMs < horas * 60 * 60 * 1000;
  }
}
