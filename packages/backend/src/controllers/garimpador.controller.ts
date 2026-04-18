import { Request, Response } from 'express';
import { GarimpadorService } from '../services/garimpador.service';
import { GarimpadorProcessadorService } from '../services/garimpador-processador.service';
import { GarimpadorComparadorService } from '../services/garimpador-comparador.service';
import { GarimpadorAnalyticsService } from '../services/garimpador-analytics.service';
import { GarimpadorDecomposerService } from '../services/garimpador-decomposer.service';
import { GarimpadorVectorStoreService } from '../services/garimpador-vectorstore.service';
import { ConfigurationService } from '../services/configuration.service';
import { MappingService } from '../services/mapping.service';
import { OracleService } from '../services/oracle.service';
import { PostgresErpService } from '../services/postgres-erp.service';
import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';

export class GarimpadorController {

  /**
   * POST /api/garimpador/webhook
   * Recebe webhook da Evolution API (público, sem auth)
   */
  static async webhook(req: Request, res: Response) {
    try {
      const result = await GarimpadorService.processarWebhook(req.body);

      if (result) {
        res.json({ ok: true, contato: result.contato.nome || result.contato.telefone });
      } else {
        res.json({ ok: true, ignored: true });
      }
    } catch (error: any) {
      console.error('[Garimpador] Erro no webhook:', error);
      // Sempre retorna 200 pro webhook não ficar retentando
      res.json({ ok: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/contatos
   * Lista todos os contatos com contagem de mensagens
   */
  static async listarContatos(req: Request, res: Response) {
    try {
      const contatos = await GarimpadorService.listarContatos();
      res.json(contatos);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao listar contatos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/garimpador/contatos/:id/tipo
   * Atualiza o tipo de um contato (fornecedor/concorrente/nao_classificado)
   */
  static async atualizarTipoContato(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { tipo } = req.body;

      if (!tipo) {
        return res.status(400).json({ error: 'Campo "tipo" é obrigatório' });
      }

      const contato = await GarimpadorService.atualizarTipoContato(id, tipo);
      if (!contato) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      res.json(contato);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao atualizar tipo:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/mensagens
   * Lista mensagens com filtros e paginação
   */
  static async listarMensagens(req: Request, res: Response) {
    try {
      const filtros = {
        contatoId: req.query.contatoId ? parseInt(req.query.contatoId as string) : undefined,
        tipoMidia: req.query.tipoMidia as string | undefined,
        processado: req.query.processado !== undefined ? req.query.processado === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await GarimpadorService.listarMensagens(filtros);
      res.json(result);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao listar mensagens:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/estatisticas
   * Retorna estatísticas gerais
   */
  static async getEstatisticas(req: Request, res: Response) {
    try {
      const stats = await GarimpadorService.getEstatisticas();
      res.json(stats);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/garimpador/configurar-webhook
   * Configura o webhook na Evolution API para receber mensagens
   */
  static async configurarWebhook(req: Request, res: Response) {
    try {
      const { enabled, webhookUrl } = req.body;

      // Buscar configs da Evolution
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiUrl || !apiToken || !instance) {
        return res.status(400).json({
          success: false,
          error: 'Configurações da Evolution API não encontradas. Configure URL, Token e Instância primeiro.'
        });
      }

      // URL do webhook do garimpador (detecta HTTPS atrás de proxy)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const url = webhookUrl || `${protocol}://${host}/api/garimpador/webhook`;

      // Payload no formato Evolution API v2.3.x (requer wrapper "webhook")
      const webhookPayload = {
        webhook: enabled
          ? { enabled: true, url, webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT'] }
          : { enabled: false, url: '', webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT'] }
      };

      const setWebhookUrl = `${apiUrl}/webhook/set/${encodeURIComponent(instance)}`;

      const response = await fetch(setWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Garimpador] Erro ao configurar webhook na Evolution:', errorText);
        return res.status(500).json({
          success: false,
          error: `Erro na Evolution API: ${response.status} - ${errorText}`
        });
      }

      const result = await response.json();
      console.log(`[Garimpador] Webhook ${enabled ? 'configurado' : 'removido'} com sucesso:`, result);

      res.json({
        success: true,
        message: enabled ? 'Webhook configurado com sucesso na Evolution API' : 'Webhook removido da Evolution API',
        webhookUrl: enabled ? url : null,
        data: result
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao configurar webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/webhook-status
   * Verifica se o webhook está configurado na Evolution API
   */
  static async webhookStatus(req: Request, res: Response) {
    try {
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiUrl || !apiToken || !instance) {
        return res.json({ success: true, configured: false, reason: 'Evolution API não configurada' });
      }

      const findWebhookUrl = `${apiUrl}/webhook/find/${encodeURIComponent(instance)}`;

      const response = await fetch(findWebhookUrl, {
        method: 'GET',
        headers: { 'apikey': apiToken }
      });

      if (!response.ok) {
        return res.json({ success: true, configured: false, reason: 'Não foi possível consultar webhook' });
      }

      const data = await response.json() as any;
      const hasGarimpadorWebhook = data?.url?.includes('/api/garimpador/webhook');

      res.json({
        success: true,
        configured: hasGarimpadorWebhook,
        currentUrl: data?.url || null,
        events: data?.events || []
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao verificar webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/processar
   * Processa todas as mensagens nao processadas
   */
  static async processarTodas(req: Request, res: Response) {
    try {
      const resultado = await GarimpadorProcessadorService.processarMensagensNaoProcessadas();
      res.json({
        success: true,
        ...resultado,
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao processar mensagens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/processar/:id
   * Processa uma mensagem especifica
   */
  static async processarUma(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(GarimpadorMensagem);
      const mensagem = await repo.findOne({ where: { id } });

      if (!mensagem) {
        return res.status(404).json({ success: false, error: 'Mensagem nao encontrada' });
      }

      const extraido = await GarimpadorProcessadorService.processarMensagem(mensagem);
      res.json({
        success: true,
        processado: true,
        conteudo_extraido: extraido,
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao processar mensagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/comparar/:id
   * Compara produtos de uma mensagem com Oracle e envia para WhatsApp
   */
  static async compararUma(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const resultado = await GarimpadorComparadorService.compararEEnviar(id);
      res.json({ success: true, ...resultado });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao comparar mensagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/comparar
   * Compara todas as mensagens pendentes com Oracle e envia para WhatsApp
   */
  static async compararTodas(req: Request, res: Response) {
    try {
      const resultado = await GarimpadorComparadorService.processarPendentes();
      res.json({ success: true, ...resultado });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao comparar mensagens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/buscar-produto
   * Busca um produto no Oracle (para testes)
   */
  static async buscarProduto(req: Request, res: Response) {
    try {
      const { descricao } = req.body;
      if (!descricao) {
        return res.status(400).json({ success: false, error: 'Campo "descricao" obrigatorio' });
      }

      const busca = await GarimpadorComparadorService.buscarProdutoOracle(descricao);
      res.json({ success: true, produto: busca.match, candidatos: busca.candidatos });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar produto:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ===== ANALYTICS =====

  /**
   * GET /api/garimpador/analytics/resumo
   */
  static async getResumoAnalytics(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query as any;
      const resumo = await GarimpadorAnalyticsService.getResumoAnalytics(dataInicio, dataFim);
      res.json({ success: true, ...resumo });
    } catch (error: any) {
      console.error('[Garimpador] Erro resumo analytics:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/analytics/ranking
   */
  static async getRankingFornecedores(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, tipo } = req.query as any;
      const ranking = await GarimpadorAnalyticsService.getRankingFornecedores(dataInicio, dataFim, tipo);
      res.json({ success: true, ranking });
    } catch (error: any) {
      console.error('[Garimpador] Erro ranking:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/analytics/ranking/:contatoId
   */
  static async getDetalhesFornecedor(req: Request, res: Response) {
    try {
      const contatoId = parseInt(req.params.contatoId);
      const { classificacao, dataInicio, dataFim } = req.query as any;
      const itens = await GarimpadorAnalyticsService.getDetalhesFornecedor(contatoId, classificacao, dataInicio, dataFim);
      res.json({ success: true, itens });
    } catch (error: any) {
      console.error('[Garimpador] Erro detalhes fornecedor:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/analytics/projecao
   */
  static async getProjecaoPreco(req: Request, res: Response) {
    try {
      const { termo, dataInicio, dataFim } = req.query as any;
      if (!termo) {
        return res.status(400).json({ success: false, error: 'Parametro "termo" obrigatorio' });
      }
      const resultado = await GarimpadorAnalyticsService.getProjecaoPreco(termo, dataInicio, dataFim);
      res.json({ success: true, ...resultado });
    } catch (error: any) {
      console.error('[Garimpador] Erro projecao:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/analytics/fora-mix
   */
  static async getProdutosForaMix(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query as any;
      const produtos = await GarimpadorAnalyticsService.getProdutosForaMix(dataInicio, dataFim);
      res.json({ success: true, total: produtos.length, produtos });
    } catch (error: any) {
      console.error('[Garimpador] Erro fora do mix:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/produtos-pesquisar
   */
  static async getProdutosPesquisar(req: Request, res: Response) {
    try {
      const { codSecao, codGrupo, codSubGrupo, tipoEspecie, tipoEvento } = req.query as any;
      const produtos = await GarimpadorAnalyticsService.getProdutosPesquisar({
        codSecao, codGrupo, codSubGrupo, tipoEspecie, tipoEvento,
      });
      res.json({ success: true, total: produtos.length, produtos });
    } catch (error: any) {
      console.error('[Garimpador] Erro produtos pesquisar:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/produtos-excluidos
   * Retorna lista de codigos de produtos excluidos dos cruzamentos
   */
  static async getProdutosExcluidos(req: Request, res: Response) {
    try {
      const raw = await ConfigurationService.get('garimpador_produtos_excluidos', '[]');
      const excluidos = JSON.parse(raw || '[]');
      res.json({ success: true, total: excluidos.length, excluidos });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar excluidos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/produtos-excluidos
   * Salva lista de codigos de produtos excluidos dos cruzamentos
   */
  static async salvarProdutosExcluidos(req: Request, res: Response) {
    try {
      const { excluidos } = req.body;
      if (!Array.isArray(excluidos)) {
        return res.status(400).json({ success: false, error: 'Campo "excluidos" deve ser um array' });
      }
      await ConfigurationService.set('garimpador_produtos_excluidos', JSON.stringify(excluidos));
      res.json({ success: true, total: excluidos.length });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao salvar excluidos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ===== MATCH CONFIG =====

  /**
   * GET /api/garimpador/match-config
   * Retorna os 7 pesos/configs do algoritmo de matching
   */
  static async getMatchConfig(req: Request, res: Response) {
    try {
      const config = {
        pesoMarca: parseFloat(await ConfigurationService.get('garimpador_match_peso_marca', '3.0') || '3.0'),
        pesoGramatura: parseFloat(await ConfigurationService.get('garimpador_match_peso_gramatura', '2.0') || '2.0'),
        pesoEmbalagem: parseFloat(await ConfigurationService.get('garimpador_match_peso_embalagem', '1.5') || '1.5'),
        pesoVariante: parseFloat(await ConfigurationService.get('garimpador_match_peso_variante', '1.5') || '1.5'),
        pesoDescricao: parseFloat(await ConfigurationService.get('garimpador_match_peso_descricao', '1.0') || '1.0'),
        toleranciaGramatura: parseFloat(await ConfigurationService.get('garimpador_match_tolerancia_gramatura', '15') || '15'),
        penalMarca: parseFloat(await ConfigurationService.get('garimpador_match_penal_marca', '5.0') || '5.0'),
      };
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('[Garimpador] Erro getMatchConfig:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/match-config
   * Salva os pesos/configs do algoritmo de matching
   */
  static async saveMatchConfig(req: Request, res: Response) {
    try {
      const { pesoMarca, pesoGramatura, pesoEmbalagem, pesoVariante, pesoDescricao, toleranciaGramatura, penalMarca } = req.body;

      if (pesoMarca !== undefined) await ConfigurationService.set('garimpador_match_peso_marca', String(pesoMarca));
      if (pesoGramatura !== undefined) await ConfigurationService.set('garimpador_match_peso_gramatura', String(pesoGramatura));
      if (pesoEmbalagem !== undefined) await ConfigurationService.set('garimpador_match_peso_embalagem', String(pesoEmbalagem));
      if (pesoVariante !== undefined) await ConfigurationService.set('garimpador_match_peso_variante', String(pesoVariante));
      if (pesoDescricao !== undefined) await ConfigurationService.set('garimpador_match_peso_descricao', String(pesoDescricao));
      if (toleranciaGramatura !== undefined) await ConfigurationService.set('garimpador_match_tolerancia_gramatura', String(toleranciaGramatura));
      if (penalMarca !== undefined) await ConfigurationService.set('garimpador_match_penal_marca', String(penalMarca));

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Garimpador] Erro saveMatchConfig:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/lojas
   * Lista lojas do ERP (TAB_LOJA) — usado no seletor de multi-loja.
   * Bifurca entre Oracle e PostgreSQL conforme conexao ativa.
   */
  static async listarLojas(req: Request, res: Response) {
    try {
      const schema = await MappingService.getSchema();
      const tabLoja = await MappingService.getRealTableName('TAB_LOJA', 'TAB_LOJA');
      const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja', 'COD_LOJA');
      const colDescLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'descricao_loja', 'DES_LOJA');

      let dbType: 'oracle' | 'postgresql' = 'oracle';
      try {
        const repo = AppDataSource.getRepository(DatabaseConnection);
        let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
        if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
        if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
        if (conn?.type === DatabaseType.POSTGRESQL) dbType = 'postgresql';
      } catch { /* default oracle */ }

      const sql = `SELECT ${colCodLoja} AS codigo, ${colDescLoja} AS descricao FROM ${schema}.${tabLoja} ORDER BY ${colCodLoja}`;
      const rows: any[] = dbType === 'postgresql'
        ? await PostgresErpService.query<any>(sql, [])
        : await OracleService.query<any>(sql, {});
      const lojas = rows.map((r: any) => {
        const cod = r.codigo ?? r.CODIGO;
        const desc = r.descricao ?? r.DESCRICAO;
        return { codigo: Number(cod), descricao: desc || `Loja ${cod}` };
      });
      res.json({ success: true, lojas });
    } catch (error: any) {
      console.error('[Garimpador] Erro listarLojas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/lojas-config
   * Retorna configuracao de multi-loja (participantes + modo de referencia)
   */
  static async getLojasConfig(req: Request, res: Response) {
    try {
      const lojasStr = (await ConfigurationService.get('garimpador_lojas_participantes', '[1]')) || '[1]';
      const refCusto = (await ConfigurationService.get('garimpador_ref_custo', 'menor')) || 'menor';
      let lojas: number[] = [1];
      try {
        const parsed = JSON.parse(lojasStr);
        if (Array.isArray(parsed)) lojas = parsed.map((n: any) => Number(n)).filter((n: number) => !isNaN(n));
      } catch { /* default */ }
      res.json({ success: true, lojas, refCusto: refCusto === 'medio' ? 'medio' : 'menor' });
    } catch (error: any) {
      console.error('[Garimpador] Erro getLojasConfig:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/lojas-config
   * Salva configuracao de multi-loja
   */
  static async saveLojasConfig(req: Request, res: Response) {
    try {
      const { lojas, refCusto } = req.body;
      if (!Array.isArray(lojas) || lojas.length === 0) {
        return res.status(400).json({ success: false, error: 'Informe pelo menos uma loja em "lojas"' });
      }
      const lojasNum = lojas.map((n: any) => Number(n)).filter((n: number) => !isNaN(n));
      if (lojasNum.length === 0) {
        return res.status(400).json({ success: false, error: 'Lojas invalidas' });
      }
      const ref = refCusto === 'medio' ? 'medio' : 'menor';
      await ConfigurationService.set('garimpador_lojas_participantes', JSON.stringify(lojasNum));
      await ConfigurationService.set('garimpador_ref_custo', ref);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Garimpador] Erro saveLojasConfig:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/test-match
   * Testa decomposicao + matching de um produto
   */
  static async testMatch(req: Request, res: Response) {
    try {
      const { descricao } = req.body;
      if (!descricao) {
        return res.status(400).json({ success: false, error: 'Campo "descricao" obrigatorio' });
      }

      // Carregar marcas do Oracle antes de decompor
      await GarimpadorDecomposerService.carregarMarcasOracle();
      const decomposicao = GarimpadorDecomposerService.decompor(descricao);
      const busca = await GarimpadorComparadorService.buscarProdutoOracle(descricao);

      res.json({
        success: true,
        decomposicao,
        produtoEncontrado: busca.match,
        candidatos: busca.candidatos,
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro testMatch:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/reprocessar
   * Reprocessa todas as comparacoes existentes com o novo algoritmo de matching
   * NAO envia para WhatsApp, apenas recalcula os matches
   */
  static async reprocessarTodos(req: Request, res: Response) {
    try {
      console.log('[Garimpador Reprocessar] Iniciando reprocessamento (somente nao encontrados do dia)...');
      await GarimpadorDecomposerService.carregarMarcasOracle();

      const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);

      // Buscar apenas mensagens de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const mensagens = await msgRepo
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.contato', 'c')
        .where('m.processado = true')
        .andWhere('m.conteudo_extraido IS NOT NULL')
        .andWhere('m.received_at >= :hoje', { hoje })
        .orderBy('m.received_at', 'ASC')
        .getMany();

      let reprocessadas = 0;
      let erros = 0;
      let totalProdutos = 0;
      let novosMatches = 0;

      console.log(`[Garimpador Reprocessar] ${mensagens.length} mensagens para processar`);

      for (const msg of mensagens) {
        try {
          let dados: any;
          try {
            dados = JSON.parse(msg.conteudo_extraido || '{}');
          } catch { continue; }

          let produtosOriginais = dados.produtos_originais;

          if (!produtosOriginais && Array.isArray(dados) && dados.length > 0 && dados[0].produto) {
            produtosOriginais = dados;
          }

          if (!Array.isArray(produtosOriginais) || produtosOriginais.length === 0) continue;

          // Verificar se tem algum produto nao encontrado (produtoLoja null)
          const resultadosAnteriores = Array.isArray(dados.resultados_comparacao) ? dados.resultados_comparacao : [];
          const temNaoEncontrado = resultadosAnteriores.some((r: any) => !r.produtoLoja);
          if (!temNaoEncontrado && resultadosAnteriores.length > 0) continue; // Todos ja encontrados, pular

          const resultados: any[] = [];
          totalProdutos += produtosOriginais.length;

          for (const prod of produtosOriginais) {
            try {
              const busca = await GarimpadorComparadorService.buscarProdutoOracle(prod.produto);
              if (!busca.match) {
                resultados.push({
                  produtoOfertado: prod.produto,
                  precoOferta: prod.preco,
                  produtoLoja: null,
                  candidatos: busca.candidatos.slice(0, 10),
                  diferenca: 0,
                  boaOferta: false,
                  margemAtual: 0,
                  margemFutura: 0,
                  margemMeta: 0,
                  diferencaMargem: 0,
                  classificacao: 'ruim',
                  matchScore: 0,
                });
                continue;
              }

              const resultado = GarimpadorComparadorService.calcularComparacao(prod, busca.match);
              resultado.classificacao = await GarimpadorComparadorService.classificar(resultado.diferencaMargem);
              // Incluir candidatos no resultado com match tambem
              resultado.candidatos = busca.candidatos.slice(0, 10);
              resultados.push(resultado);
            } catch (e: any) {
              console.error(`[Garimpador Reprocessar] Erro produto "${prod.produto}":`, e.message);
            }
          }

          await msgRepo.update(msg.id, {
            conteudo_extraido: JSON.stringify({
              produtos_originais: produtosOriginais,
              resultados_comparacao: resultados,
              total_enviadas: 0,
              data_comparacao: new Date().toISOString(),
              reprocessado: true,
            }),
          });
          reprocessadas++;
          console.log(`[Garimpador Reprocessar] Msg ${reprocessadas}/${mensagens.length} (${msg.contato?.nome || 'sem contato'}) - ${resultados.length}/${produtosOriginais.length} matches`);
        } catch (e: any) {
          erros++;
          console.error(`[Garimpador Reprocessar] Erro msg ${msg.id}:`, e.message);
        }
      }

      console.log(`[Garimpador Reprocessar] CONCLUIDO: ${reprocessadas} msgs, ${totalProdutos} produtos, ${novosMatches} novos matches, ${erros} erros`);

      res.json({
        success: true,
        reprocessadas,
        total: mensagens.length,
        erros,
        totalProdutos,
        novosMatches,
      });
    } catch (error: any) {
      console.error('[Garimpador Reprocessar] ERRO FATAL:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/vectorstore/sync
   * Sincroniza produtos Oracle -> PGVector cache (gera embeddings)
   */
  static async syncVectorStore(req: Request, res: Response) {
    try {
      const result = await GarimpadorVectorStoreService.sincronizar();
      const stats = await GarimpadorVectorStoreService.stats();
      res.json({ success: true, message: `Sincronizacao concluida: ${result.total} produtos, ${result.atualizados} atualizados`, stats });
    } catch (error: any) {
      console.error('[VectorStore Sync] Erro:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/vectorstore/stats
   * Retorna estatisticas do cache vetorial
   */
  static async vectorStoreStats(req: Request, res: Response) {
    try {
      const stats = await GarimpadorVectorStoreService.stats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/vectorstore/search?q=texto
   * Testa busca vetorial
   */
  static async vectorStoreSearch(req: Request, res: Response) {
    try {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ error: 'Parametro q obrigatorio' });

      const limite = parseInt(req.query.limite as string) || 10;
      const candidatos = await GarimpadorVectorStoreService.buscarSimilares(q, limite);
      res.json(candidatos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/openai-balance
   * Retorna saldo/uso da conta OpenAI
   */
  static async getOpenAIBalance(req: Request, res: Response) {
    try {
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) {
        return res.json({ success: false, error: 'API Key OpenAI nao configurada' });
      }

      const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

      // Usar a API oficial de Costs (https://platform.openai.com/docs/api-reference/usage)
      // GET /v1/organization/costs?start_time=UNIX&end_time=UNIX&group_by[]=line_item
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startTime = Math.floor(startOfMonth.getTime() / 1000);
      const endTime = Math.floor(now.getTime() / 1000) + 86400;

      let usageThisMonth = 0;
      let dailyCosts: { date: string; cost: number }[] = [];
      let needsPermission = false;

      try {
        const costsUrl = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`;
        const costsResp = await fetch(costsUrl, { headers });
        if (costsResp.ok) {
          const costsData = await costsResp.json() as any;
          if (Array.isArray(costsData.data)) {
            for (const bucket of costsData.data) {
              const bucketTotal = Array.isArray(bucket.results)
                ? bucket.results.reduce((sum: number, r: any) => sum + (r.amount?.value || 0), 0)
                : 0;
              usageThisMonth += bucketTotal;
              if (bucketTotal > 0) {
                dailyCosts.push({
                  date: new Date(bucket.start_time * 1000).toISOString().split('T')[0],
                  cost: Math.round(bucketTotal * 100) / 100,
                });
              }
            }
          }
          usageThisMonth = Math.round(usageThisMonth * 100) / 100;
        } else if (costsResp.status === 403) {
          needsPermission = true;
        }
      } catch { }

      if (needsPermission) {
        return res.json({
          success: false,
          error: 'A API Key nao tem permissao "api.usage.read". Gere uma nova key em platform.openai.com com essa permissao.',
        });
      }

      res.json({
        success: true,
        balance: {
          usageThisMonth,
          dailyCosts,
          mesReferencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        },
      });
    } catch (error: any) {
      console.error('[OpenAI Balance] Erro:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
