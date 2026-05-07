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
    const sessoes = await AppDataSource.getRepository(MktChatbotSessao)
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.contato', 'c')
      .leftJoinAndSelect('s.bloco_atual', 'b')
      .orderBy('s.ultima_atividade_at', 'DESC')
      .limit(100)
      .getMany();
    res.json({ success: true, sessoes });
  }

  static async listarMensagensSessao(req: Request, res: Response) {
    const sessaoId = parseInt(req.params.id);
    const msgs = await AppDataSource.getRepository(MktChatbotMensagem).find({
      where: { sessao_id: sessaoId }, order: { created_at: 'ASC' },
    });
    res.json({ success: true, mensagens: msgs });
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
    try {
      res.json({ success: true });
      const body = req.body || {};
      const event = body.event || body.eventType;
      if (event && !String(event).includes('messages')) return;

      const data = body.data || body;
      const fromMe = data?.key?.fromMe;
      if (fromMe) return;

      const remoteJid: string = data?.key?.remoteJid || '';
      if (remoteJid.endsWith('@g.us')) return;

      const telefone = (remoteJid.split('@')[0] || '').replace(/\D/g, '');
      if (!telefone) return;

      const nome = data?.pushName || null;
      const texto =
        data?.message?.conversation ||
        data?.message?.extendedTextMessage?.text ||
        data?.message?.imageMessage?.caption ||
        '';
      if (!texto.trim()) return;

      MktChatbotService.processarMensagemRecebida(telefone, nome, texto.trim()).catch(e => {
        console.error('[Chatbot] processar erro:', e);
      });
    } catch (e: any) {
      console.error('[Chatbot] webhook erro:', e?.message);
    }
  }
}
