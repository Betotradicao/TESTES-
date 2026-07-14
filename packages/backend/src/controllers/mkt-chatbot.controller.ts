import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { MktChatbotFluxo } from '../entities/MktChatbotFluxo';
import { MktChatbotBloco } from '../entities/MktChatbotBloco';
import { MktChatbotConexao } from '../entities/MktChatbotConexao';
import { MktChatbotContato } from '../entities/MktChatbotContato';
import { MktChatbotSessao } from '../entities/MktChatbotSessao';
import { MktChatbotMensagem } from '../entities/MktChatbotMensagem';
import { MktChatbotService } from '../services/mkt-chatbot.service';

export class MktChatbotController {
  // ========== FLUXOS ==========
  static async listarFluxos(_req: Request, res: Response) {
    const fluxos = await AppDataSource.getRepository(MktChatbotFluxo).find({
      order: { ativo: 'DESC', id: 'ASC' },
    });
    res.json({ success: true, fluxos });
  }

  static async obterFluxoCompleto(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const fluxo = await AppDataSource.getRepository(MktChatbotFluxo).findOne({ where: { id } });
      if (!fluxo) return res.status(404).json({ success: false, error: 'Fluxo nao encontrado' });
      const blocos = await AppDataSource.getRepository(MktChatbotBloco).find({
        where: { fluxo_id: id }, order: { id: 'ASC' }
      });
      const conexoes = await AppDataSource.getRepository(MktChatbotConexao).find({
        where: { fluxo_id: id }, order: { ordem: 'ASC', id: 'ASC' }
      });
      res.json({ success: true, fluxo, blocos, conexoes });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarFluxo(req: Request, res: Response) {
    try {
      const { nome, descricao, instance_name, mensagem_primeira_vez, mensagem_recorrente, timeout_inatividade_min } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const repo = AppDataSource.getRepository(MktChatbotFluxo);
      const fluxo = repo.create({
        nome: nome.trim(),
        descricao: descricao || null,
        instance_name: instance_name || null,
        mensagem_primeira_vez: mensagem_primeira_vez || null,
        mensagem_recorrente: mensagem_recorrente || null,
        timeout_inatividade_min: Number(timeout_inatividade_min) || 1440,
        ativo: true,
      });
      await repo.save(fluxo);
      res.json({ success: true, fluxo });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarFluxo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(MktChatbotFluxo);
      const fluxo = await repo.findOne({ where: { id } });
      if (!fluxo) return res.status(404).json({ success: false, error: 'Fluxo nao encontrado' });
      const fields = ['nome', 'descricao', 'ativo', 'instance_name', 'mensagem_primeira_vez', 'mensagem_recorrente', 'timeout_inatividade_min'];
      for (const f of fields) {
        if (req.body[f] !== undefined) (fluxo as any)[f] = req.body[f];
      }
      await repo.save(fluxo);
      res.json({ success: true, fluxo });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarFluxo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.getRepository(MktChatbotFluxo).delete({ id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== BLOCOS ==========
  static async criarBloco(req: Request, res: Response) {
    try {
      const { fluxo_id, tipo, nome, posicao_x, posicao_y, dados, is_inicial } = req.body;
      if (!fluxo_id || !tipo) return res.status(400).json({ success: false, error: 'fluxo_id e tipo obrigatorios' });
      const repo = AppDataSource.getRepository(MktChatbotBloco);
      if (is_inicial) {
        await repo.update({ fluxo_id, is_inicial: true }, { is_inicial: false });
      }
      const bloco = repo.create({
        fluxo_id, tipo, nome: nome || null,
        posicao_x: Number(posicao_x) || 0,
        posicao_y: Number(posicao_y) || 0,
        dados: dados || {},
        is_inicial: !!is_inicial,
      });
      await repo.save(bloco);
      res.json({ success: true, bloco });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarBloco(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(MktChatbotBloco);
      const bloco = await repo.findOne({ where: { id } });
      if (!bloco) return res.status(404).json({ success: false, error: 'Bloco nao encontrado' });
      const { tipo, nome, posicao_x, posicao_y, dados, is_inicial } = req.body;
      if (is_inicial === true && !bloco.is_inicial) {
        await repo.update({ fluxo_id: bloco.fluxo_id, is_inicial: true }, { is_inicial: false });
      }
      if (tipo !== undefined) bloco.tipo = tipo;
      if (nome !== undefined) bloco.nome = nome || null;
      if (posicao_x !== undefined) bloco.posicao_x = Number(posicao_x) || 0;
      if (posicao_y !== undefined) bloco.posicao_y = Number(posicao_y) || 0;
      if (dados !== undefined) bloco.dados = dados;
      if (is_inicial !== undefined) bloco.is_inicial = !!is_inicial;
      await repo.save(bloco);
      res.json({ success: true, bloco });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarBloco(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.getRepository(MktChatbotBloco).delete({ id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== CONEXOES ==========
  static async criarConexao(req: Request, res: Response) {
    try {
      const { fluxo_id, origem_id, destino_id, condicao, label, ordem } = req.body;
      if (!fluxo_id || !origem_id || !destino_id) {
        return res.status(400).json({ success: false, error: 'fluxo_id, origem_id, destino_id obrigatorios' });
      }
      const conexao = AppDataSource.getRepository(MktChatbotConexao).create({
        fluxo_id, origem_id, destino_id,
        condicao: condicao || null,
        label: label || null,
        ordem: Number(ordem) || 0,
      });
      await AppDataSource.getRepository(MktChatbotConexao).save(conexao);
      res.json({ success: true, conexao });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarConexao(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(MktChatbotConexao);
      const conexao = await repo.findOne({ where: { id } });
      if (!conexao) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });
      const { condicao, label, ordem } = req.body;
      if (condicao !== undefined) conexao.condicao = condicao || null;
      if (label !== undefined) conexao.label = label || null;
      if (ordem !== undefined) conexao.ordem = Number(ordem) || 0;
      await repo.save(conexao);
      res.json({ success: true, conexao });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarConexao(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.getRepository(MktChatbotConexao).delete({ id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== CONVERSAS ==========
  static async listarConversas(_req: Request, res: Response) {
    try {
      const sessoes = await AppDataSource.getRepository(MktChatbotSessao)
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.contato', 'c')
        .leftJoinAndSelect('s.bloco_atual', 'b')
        .orderBy('s.ultima_atividade_at', 'DESC')
        .limit(100)
        .getMany();
      res.json({ success: true, sessoes });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async listarMensagensSessao(req: Request, res: Response) {
    try {
      const sessaoId = parseInt(req.params.id);
      const msgs = await AppDataSource.getRepository(MktChatbotMensagem).find({
        where: { sessao_id: sessaoId }, order: { created_at: 'ASC' },
      });
      res.json({ success: true, mensagens: msgs });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== MENU SIMPLES ==========
  // O editor visual monta grafo qualquer, mas o caso real do supermercado e um
  // menu unico: "digite 1 pra X". Estes dois endpoints leem/gravam esse formato
  // por cima do MESMO grafo, sem canvas.
  //
  // Cada opcao do menu e uma SEQUENCIA de passos (uma cadeia de blocos):
  //   menu --[1]--> passo1 --[auto|palavra]--> passo2 --> ... --> volta pro menu
  // Passo 'pergunta' espera o cliente digitar: a palavra vira a condicao da
  // conexao que sai dele. Passo 'mensagem' segue sozinho. 'atendente'/'encerrar'
  // terminam a cadeia (nao voltam pro menu).

  /** Percorre a cadeia de blocos de uma opcao, parando ao voltar pro menu. */
  private static percorrerCadeia(
    inicioId: number,
    inicialId: number,
    blocos: MktChatbotBloco[],
    conexoes: MktChatbotConexao[],
  ): Array<{ bloco: MktChatbotBloco; saida: MktChatbotConexao | undefined }> {
    const cadeia: Array<{ bloco: MktChatbotBloco; saida: MktChatbotConexao | undefined }> = [];
    const vistos = new Set<number>();
    let atualId: number | undefined = inicioId;

    while (atualId && !vistos.has(atualId) && atualId !== inicialId) {
      vistos.add(atualId);
      const bloco = blocos.find(b => b.id === atualId);
      if (!bloco) break;
      const saida = conexoes.find(c => c.origem_id === atualId);
      cadeia.push({ bloco, saida });
      atualId = saida?.destino_id;
    }
    return cadeia;
  }

  /** GET /api/mkt-chatbot/fluxos/:id/menu */
  static async obterMenu(req: Request, res: Response) {
    try {
      const fluxoId = parseInt(req.params.id);
      const blocos = await AppDataSource.getRepository(MktChatbotBloco).find({ where: { fluxo_id: fluxoId } });
      const inicial = blocos.find(b => b.is_inicial);
      if (!inicial) return res.json({ success: true, texto_menu: '', opcoes: [] });

      const conexoes = await AppDataSource.getRepository(MktChatbotConexao).find({
        where: { fluxo_id: fluxoId }, order: { ordem: 'ASC', id: 'ASC' },
      });

      const opcoes = (Array.isArray(inicial.dados?.opcoes) ? inicial.dados.opcoes : []).map((o: any) => {
        const cx = conexoes.find(c => c.origem_id === inicial!.id && c.condicao === String(o.numero));
        const cadeia = cx ? MktChatbotController.percorrerCadeia(cx.destino_id, inicial!.id, blocos, conexoes) : [];

        const passos = cadeia.map(({ bloco, saida }) => {
          const d = bloco.dados || {};
          return {
            tipo: bloco.tipo,
            texto: (bloco.tipo === 'atendente' ? d.mensagem_transferencia
                  : bloco.tipo === 'encerrar'  ? d.mensagem_despedida
                  : d.texto) || '',
            // So passo 'pergunta' usa palavra: ela mora na conexao de saida dele.
            palavra_chave: bloco.tipo === 'pergunta' ? (saida?.condicao || '') : '',
          };
        });

        return { numero: String(o.numero ?? ''), label: o.label || '', passos };
      });

      res.json({ success: true, texto_menu: inicial.dados?.texto || '', opcoes });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * PUT /api/mkt-chatbot/fluxos/:id/menu
   * Body: { texto_menu, opcoes: [{ numero, label, passos: [{ tipo, texto, palavra_chave }] }] }
   *
   * Reaproveita os blocos que ja existem na cadeia (upsert por posicao) em vez de
   * recriar tudo: id de bloco e referenciado por sessao e mensagem, e recriar
   * quebraria conversa em andamento.
   */
  static async salvarMenu(req: Request, res: Response) {
    const runner = AppDataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const fluxoId = parseInt(req.params.id);
      const textoMenu = String(req.body?.texto_menu || '');
      const brutas = Array.isArray(req.body?.opcoes) ? req.body.opcoes : [];

      const fluxo = await runner.manager.findOne(MktChatbotFluxo, { where: { id: fluxoId } });
      if (!fluxo) {
        await runner.rollbackTransaction();
        return res.status(404).json({ success: false, error: 'Fluxo nao encontrado' });
      }

      const TIPOS_OK = ['mensagem', 'pergunta', 'atendente', 'encerrar'];
      const validas = brutas
        .map((o: any) => ({
          numero: String(o?.numero ?? '').trim(),
          label: String(o?.label ?? '').trim(),
          passos: (Array.isArray(o?.passos) ? o.passos : [])
            .map((p: any) => ({
              tipo: TIPOS_OK.includes(p?.tipo) ? p.tipo : 'mensagem',
              texto: String(p?.texto ?? ''),
              palavra_chave: String(p?.palavra_chave ?? '').trim(),
            }))
            .filter((p: any) => p.texto.trim() || p.palavra_chave),
        }))
        .filter((o: any) => o.numero && o.label);

      const dup = validas.map((o: any) => o.numero).filter((n: string, idx: number, a: string[]) => a.indexOf(n) !== idx);
      if (dup.length) {
        await runner.rollbackTransaction();
        return res.status(400).json({ success: false, error: `Numero de opcao repetido: ${dup.join(', ')}` });
      }
      for (const o of validas) {
        const semPalavra = o.passos.find((p: any) => p.tipo === 'pergunta' && !p.palavra_chave);
        if (semPalavra) {
          await runner.rollbackTransaction();
          return res.status(400).json({
            success: false,
            error: `Na opcao "${o.label}" tem um passo que espera o cliente digitar, mas sem palavra definida`,
          });
        }
      }

      // ---- Bloco do menu (pergunta inicial) ----
      let inicial = await runner.manager.findOne(MktChatbotBloco, { where: { fluxo_id: fluxoId, is_inicial: true } });
      if (!inicial) {
        inicial = await runner.manager.save(runner.manager.create(MktChatbotBloco, {
          fluxo_id: fluxoId, tipo: 'pergunta', nome: 'Menu Principal',
          posicao_x: 0, posicao_y: 0, is_inicial: true, dados: {},
        }));
      }
      inicial.tipo = 'pergunta';
      inicial.dados = {
        ...(inicial.dados || {}),
        texto: textoMenu,
        opcoes: validas.map((o: any) => ({ numero: o.numero, label: o.label })),
      };
      await runner.manager.save(inicial);

      const todosBlocos = await runner.manager.find(MktChatbotBloco, { where: { fluxo_id: fluxoId } });
      const todasConexoes = await runner.manager.find(MktChatbotConexao, {
        where: { fluxo_id: fluxoId }, order: { ordem: 'ASC', id: 'ASC' },
      });

      const usados = new Set<number>([inicial.id]);
      let i = 0;

      for (const o of validas) {
        i++;
        const cxOpcao = todasConexoes.find(c => c.origem_id === inicial!.id && c.condicao === o.numero);
        const cadeiaAtual = cxOpcao
          ? MktChatbotController.percorrerCadeia(cxOpcao.destino_id, inicial.id, todosBlocos, todasConexoes)
          : [];

        // Upsert de cada passo, reaproveitando o bloco da mesma posicao
        const idsDaCadeia: number[] = [];
        for (let j = 0; j < o.passos.length; j++) {
          const p = o.passos[j];
          let bloco: MktChatbotBloco | null = cadeiaAtual[j]?.bloco
            ? await runner.manager.findOne(MktChatbotBloco, { where: { id: cadeiaAtual[j].bloco.id } })
            : null;
          if (!bloco) {
            bloco = await runner.manager.save(runner.manager.create(MktChatbotBloco, {
              fluxo_id: fluxoId, tipo: p.tipo, nome: o.label,
              posicao_x: 320 + j * 320, posicao_y: (i - 1) * 190, is_inicial: false, dados: {},
            }));
          }
          bloco.tipo = p.tipo;
          bloco.nome = j === 0 ? o.label : `${o.label} — passo ${j + 1}`;
          // Cada tipo le o texto de uma chave diferente (ver renderizarBloco)
          const { opcoes: _descarta, ...dadosLimpos } = bloco.dados || {};
          bloco.dados = {
            // 'opcoes' sai fora: so o bloco do menu tem lista de opcoes, e o engine
            // anexa ela no fim do texto. Sobrando aqui, vira um "0 Voltar ao Menu"
            // fantasma no meio da resposta (heranca da conversao arvore->grafo).
            ...dadosLimpos,
            ...(p.tipo === 'atendente' ? { mensagem_transferencia: p.texto }
              : p.tipo === 'encerrar'  ? { mensagem_despedida: p.texto }
              : { texto: p.texto }),
          };
          await runner.manager.save(bloco);
          idsDaCadeia.push(bloco.id);
          usados.add(bloco.id);
        }

        // Menu --[numero]--> primeiro passo
        if (idsDaCadeia.length) {
          if (!cxOpcao) {
            await runner.manager.save(runner.manager.create(MktChatbotConexao, {
              fluxo_id: fluxoId, origem_id: inicial.id, destino_id: idsDaCadeia[0],
              condicao: o.numero, label: o.label, ordem: i,
            }));
          } else {
            cxOpcao.destino_id = idsDaCadeia[0];
            cxOpcao.label = o.label;
            cxOpcao.ordem = i;
            await runner.manager.save(cxOpcao);
          }
        } else if (cxOpcao) {
          await runner.manager.delete(MktChatbotConexao, { id: cxOpcao.id });
        }

        // Religa a cadeia do zero: mais simples e seguro que remendar aresta a aresta
        for (const id of idsDaCadeia) {
          await runner.manager.delete(MktChatbotConexao, { origem_id: id });
        }
        for (let j = 0; j < idsDaCadeia.length; j++) {
          const p = o.passos[j];
          if (p.tipo === 'atendente' || p.tipo === 'encerrar') continue; // termina aqui
          const proximo = j + 1 < idsDaCadeia.length ? idsDaCadeia[j + 1] : inicial.id;
          await runner.manager.save(runner.manager.create(MktChatbotConexao, {
            fluxo_id: fluxoId,
            origem_id: idsDaCadeia[j],
            destino_id: proximo,
            // 'pergunta' so avanca se o cliente digitar a palavra; 'mensagem' segue sozinha
            condicao: p.tipo === 'pergunta' ? p.palavra_chave : null,
            label: p.tipo === 'pergunta' ? p.palavra_chave : (proximo === inicial.id ? 'volta ao menu' : ''),
            ordem: j + 1,
          }));
        }
      }

      // ---- Limpeza: blocos que sairam do menu ----
      // So apaga o que ficou orfao de verdade. Bloco com sessao viva fica.
      for (const b of todosBlocos) {
        if (usados.has(b.id) || b.is_inicial) continue;
        const temSessao = await runner.manager.count(MktChatbotSessao, { where: { bloco_atual_id: b.id } });
        const alguemAponta = await runner.manager.count(MktChatbotConexao, { where: { destino_id: b.id } });
        if (!temSessao && !alguemAponta) {
          await runner.manager.delete(MktChatbotConexao, { origem_id: b.id });
          await runner.manager.update(MktChatbotMensagem, { bloco_id: b.id }, { bloco_id: null as any });
          await runner.manager.delete(MktChatbotBloco, { id: b.id });
        }
      }

      await runner.commitTransaction();
      res.json({ success: true });
    } catch (e: any) {
      await runner.rollbackTransaction();
      console.error('[Chatbot] salvarMenu erro:', e?.message || e);
      res.status(500).json({ success: false, error: e.message });
    } finally {
      await runner.release();
    }
  }


  // ========== SEED DE FLUXOS PRONTOS ==========
  static async seedExemplos(_req: Request, res: Response) {
    try {
      const fluxoRepo = AppDataSource.getRepository(MktChatbotFluxo);
      const blocoRepo = AppDataSource.getRepository(MktChatbotBloco);
      const conexaoRepo = AppDataSource.getRepository(MktChatbotConexao);

      // Desativa fluxos existentes (apenas 1 ativo)
      await fluxoRepo.update({ ativo: true }, { ativo: false });

      // Cria fluxo principal
      const fluxo = fluxoRepo.create({
        nome: 'Atendimento Geral - Supermercado Tradição',
        descricao: 'Fluxo de exemplo com saudação + menu de 4 opções',
        ativo: true,
        mensagem_primeira_vez:
`👋 *OLÁ! SEJA BEM-VINDO(A) AO CANAL DE ATENDIMENTO DO SUPERMERCADO TRADIÇÃO!* 🛒

✨ Aqui você fica por dentro das novidades e ofertas do supermercado do seu coração... 💖

📋 Logo abaixo você vai receber nosso menu e poderá nos dizer o motivo do seu contato.

Vamos lá! 🚀

⚠️ _Você está conversando com nosso atendente virtual._`,
        mensagem_recorrente:
`👋 Olá novamente! Que bom te ver por aqui. 😊
Selecione uma opção abaixo pra continuar.`,
        timeout_inatividade_min: 1440,
      });
      await fluxoRepo.save(fluxo);

      // Helper pra criar bloco
      const novoBloco = async (tipo: string, dados: any, x: number, y: number, opts: any = {}) => {
        const b = blocoRepo.create({
          fluxo_id: fluxo.id, tipo: tipo as any, dados, posicao_x: x, posicao_y: y,
          nome: opts.nome || null, is_inicial: !!opts.is_inicial,
        });
        await blocoRepo.save(b);
        return b;
      };
      const conectar = async (origem: any, destino: any, condicao: string | null = null, label: string | null = null) => {
        const c = conexaoRepo.create({
          fluxo_id: fluxo.id, origem_id: origem.id, destino_id: destino.id,
          condicao, label, ordem: 0,
        });
        await conexaoRepo.save(c);
        return c;
      };

      // ===== Bloco INICIAL: Menu principal =====
      const menu = await novoBloco('pergunta', {
        texto:
`📋 *MENU DE ATENDIMENTO*

Por favor, *digite o número* da opção desejada:`,
        delay_segundos: 1,
        mostrar_typing: true,
        opcoes: [
          { numero: '1', label: '🏷️ Grupo de Ofertas' },
          { numero: '2', label: '⏰ Horário de Funcionamento' },
          { numero: '3', label: '💼 Cadastro de Currículo' },
          { numero: '4', label: '📍 Endereço / Localização' },
          { numero: '5', label: '👤 Falar com Atendente' },
        ],
      }, 100, 300, { nome: 'Menu Principal', is_inicial: true });

      // ===== Opção 1: Grupo de Ofertas =====
      const ofertas = await novoBloco('mensagem', {
        texto:
`🏷️ *GRUPO DE OFERTAS VIP*

Entre no nosso grupo exclusivo no WhatsApp e receba todas as promoções em primeira mão! 🔥

🔗 https://chat.whatsapp.com/seugrupodeofertas

📱 Também siga nosso Instagram: @supermercadotradicao

✨ Pra voltar ao menu, digite *0*.`,
        delay_segundos: 2,
        mostrar_typing: true,
      }, 600, 50, { nome: '🏷️ Ofertas' });

      // ===== Opção 2: Horário =====
      const horario = await novoBloco('mensagem', {
        texto:
`⏰ *HORÁRIO DE FUNCIONAMENTO*

🕖 *Segunda a Sábado:* 7h às 22h
🕖 *Domingos e Feriados:* 7h às 20h

🛒 Estamos abertos 7 dias na semana pra te atender!

✨ Pra voltar ao menu, digite *0*.`,
        delay_segundos: 2,
        mostrar_typing: true,
      }, 600, 200, { nome: '⏰ Horário' });

      // ===== Opção 3: Currículos =====
      const curriculo = await novoBloco('mensagem', {
        texto:
`💼 *CADASTRE SEU CURRÍCULO*

Estamos sempre em busca de novos talentos! 🌟

Acesse nosso formulário online e cadastre seu currículo direto:
🔗 https://tradicao.prevencaonoradar.com.br/curriculo

📌 É rápido — leva uns 5 minutos.
✅ Você pode anexar foto e indicar a vaga de interesse (CLT, Aprendiz...).

✨ Pra voltar ao menu, digite *0*.`,
        delay_segundos: 2,
        mostrar_typing: true,
      }, 600, 350, { nome: '💼 Currículos' });

      // ===== Opção 4: Endereço =====
      const endereco = await novoBloco('mensagem', {
        texto:
`📍 *NOSSO ENDEREÇO*

🏠 Rua Antônio Júlio Cavalcante, 132
📌 Jardim Santa Inês I
🌎 São José dos Campos / SP
📮 CEP: 12245-000

🗺️ Veja no Google Maps:
https://maps.google.com/?q=Supermercado+Tradição+São+José+dos+Campos

✨ Pra voltar ao menu, digite *0*.`,
        delay_segundos: 2,
        mostrar_typing: true,
      }, 600, 500, { nome: '📍 Endereço' });

      // ===== Opção 5: Atendente =====
      const atendente = await novoBloco('atendente', {
        mensagem_transferencia:
`👤 *FALAR COM ATENDENTE HUMANO*

Em instantes você será transferido(a) para um de nossos atendentes. ⏳

⏰ Horário de atendimento: Seg-Sáb das 7h às 22h.
Se estiver fora desse horário, vamos responder na próxima abertura.`,
      }, 600, 650, { nome: '👤 Atendente' });

      // ===== Conexões: do Menu pra cada opção =====
      await conectar(menu, ofertas, '1', '🏷️ Ofertas');
      await conectar(menu, horario, '2', '⏰ Horário');
      await conectar(menu, curriculo, '3', '💼 Currículos');
      await conectar(menu, endereco, '4', '📍 Endereço');
      await conectar(menu, atendente, '5', '👤 Atendente');

      // ===== Voltar ao menu (opção "0" em cada resposta exceto atendente) =====
      // Bloco automático: a mensagem segue pra um "loop de espera" que aceita "0"
      // Como blocos do tipo 'mensagem' nao aguardam resposta, criamos uma "pergunta vazia"
      // ou simplesmente configuramos a sessao pra ficar no bloco esperando o "0"
      // SOLUCAO SIMPLES: cada bloco aguarda — viramos eles em pergunta de continuacao
      // Mas pra simplicidade, deixamos os 4 retornarem ao menu via "0"
      // (o engine procura conexao com condicao = "0" partindo desses blocos)
      await conectar(ofertas, menu, '0', 'Voltar ao menu');
      await conectar(horario, menu, '0', 'Voltar ao menu');
      await conectar(curriculo, menu, '0', 'Voltar ao menu');
      await conectar(endereco, menu, '0', 'Voltar ao menu');

      // Pra o engine aguardar a resposta apos enviar uma "mensagem", precisamos transformar
      // ofertas/horario/curriculo/endereco em "pergunta" com opcao 0 pra voltar
      ofertas.tipo = 'pergunta' as any;
      ofertas.dados = { ...ofertas.dados, opcoes: [{ numero: '0', label: 'Voltar ao menu' }] };
      await blocoRepo.save(ofertas);

      horario.tipo = 'pergunta' as any;
      horario.dados = { ...horario.dados, opcoes: [{ numero: '0', label: 'Voltar ao menu' }] };
      await blocoRepo.save(horario);

      curriculo.tipo = 'pergunta' as any;
      curriculo.dados = { ...curriculo.dados, opcoes: [{ numero: '0', label: 'Voltar ao menu' }] };
      await blocoRepo.save(curriculo);

      endereco.tipo = 'pergunta' as any;
      endereco.dados = { ...endereco.dados, opcoes: [{ numero: '0', label: 'Voltar ao menu' }] };
      await blocoRepo.save(endereco);

      res.json({ success: true, fluxo });
    } catch (e: any) {
      console.error('[Chatbot] seedExemplos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== WEBHOOK Evolution ==========
  static async webhook(req: Request, res: Response) {
    // Responde antes de processar: o fluxo tem delay/typing de varios segundos.
    res.json({ success: true });
    MktChatbotService.processarPayloadEvolution(req.body).catch(e =>
      console.error('[Chatbot] webhook erro:', e?.message || e)
    );
  }
}
