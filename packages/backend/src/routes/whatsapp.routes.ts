import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { MappingService } from '../services/mapping.service';

const router: Router = Router();

/**
 * POST /api/whatsapp/test-group
 * Envia mensagem de teste para um grupo do WhatsApp
 */
router.post('/test-group', async (req, res) => {
  try {
    const { groupId, message } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({
        success: false,
        error: 'groupId e message são obrigatórios'
      });
    }

    const success = await WhatsAppService.sendMessage(groupId, message);

    if (success) {
      res.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso!'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar mensagem de teste'
      });
    }
  } catch (error: any) {
    console.error('Erro ao enviar mensagem de teste:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem de teste'
    });
  }
});

/**
 * GET /api/whatsapp/connection-status
 * Verifica status da conexão com a Evolution API
 */
router.get('/connection-status', async (req, res) => {
  try {
    const { ConfigurationService } = require('../services/configuration.service');

    // Buscar configurações
    const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
    const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
    const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

    if (!apiToken || !apiUrl || !instance) {
      return res.json({
        success: false,
        connected: false,
        error: 'Configurações da Evolution API não encontradas'
      });
    }

    // Fazer requisição para verificar status da conexão
    const url = `${apiUrl}/instance/connectionState/${encodeURIComponent(instance)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiToken
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: false,
        connected: false,
        error: `Evolution API Error: ${response.status} - ${errorText}`
      });
    }

    const data = await response.json() as { instance?: { state?: string } };
    const isConnected = data.instance?.state === 'open';

    res.json({
      success: true,
      connected: isConnected,
      state: data.instance?.state || 'unknown',
      data: data
    });
  } catch (error: any) {
    console.error('Erro ao verificar status da conexão Evolution:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message || 'Erro ao verificar conexão'
    });
  }
});

/**
 * GET /api/whatsapp/fetch-groups
 * Busca todos os grupos disponíveis na instância do WhatsApp
 */
router.get('/fetch-groups', async (req, res) => {
  try {
    const groups = await WhatsAppService.fetchGroups(req.query.participants === 'true');

    res.json({
      success: true,
      data: groups
    });
  } catch (error: any) {
    console.error('Erro ao buscar grupos do WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar grupos do WhatsApp'
    });
  }
});

/**
 * GET /api/whatsapp/comunidades
 * Comunidades onde este WhatsApp e admin, com quantos membros dao pra sortear
 */
router.get('/comunidades', async (req, res) => {
  try {
    const [grupos, numeroInstancia] = await Promise.all([
      WhatsAppService.listarGruposSorteaveis(),
      WhatsAppService.getNumeroInstancia().catch(() => ''),
    ]);
    // O numero vai junto porque a lista e "grupos onde o WhatsApp DO SISTEMA e
    // admin" — que nao e o WhatsApp pessoal do usuario. Sem mostrar isso, some
    // grupo da lista e parece bug.
    res.json({ success: true, data: grupos, numeroInstancia });
  } catch (error: any) {
    console.error('Erro ao listar comunidades:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao listar comunidades' });
  }
});

/**
 * POST /api/whatsapp/sorteio
 * Sorteia ganhadores entre os membros de uma comunidade
 * body: { avisosId, quantidade?, excluirAdmins? }
 */
router.post('/sorteio', async (req, res) => {
  try {
    const { sorteioId, quantidade, excluirAdmins } = req.body || {};
    if (!sorteioId) {
      return res.status(400).json({ success: false, error: 'sorteioId é obrigatório' });
    }

    const resultado = await WhatsAppService.sortearNaComunidade(
      sorteioId,
      Number(quantidade) || 1,
      excluirAdmins !== false,
    );

    console.log(`🎲 Sorteio em "${resultado.comunidade}": ${resultado.ganhadores.join(', ')} (${resultado.participaram} concorrendo)`);
    res.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Erro no sorteio:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao sortear' });
  }
});

/**
 * POST /api/whatsapp/send-bips-now
 * Envia manualmente o relatório de bipagens pendentes (ignora se já foi notificado)
 */
router.post('/send-bips-now', async (req, res) => {
  try {
    const { AppDataSource } = require('../config/database');
    const { Bip, BipStatus } = require('../entities/Bip');
    const { Between } = require('typeorm');

    // Calcular data de ontem no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBR = new Date(brDate);
    yesterdayBR.setDate(yesterdayBR.getDate() - 1);

    const year = yesterdayBR.getFullYear();
    const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayBR.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    console.log(`📤 [ENVIO MANUAL] Buscando bipagens pendentes de ${dateStr}...`);

    // Calcular período do dia em UTC (Brasil é UTC-3)
    const startOfDayBrazil = new Date(`${dateStr}T03:00:00.000Z`);
    const endOfDayBrazil = new Date(`${dateStr}T03:00:00.000Z`);
    endOfDayBrazil.setDate(endOfDayBrazil.getDate() + 1);
    endOfDayBrazil.setMilliseconds(endOfDayBrazil.getMilliseconds() - 1);

    const bipRepository = AppDataSource.getRepository(Bip);

    // Buscar TODAS as bipagens pendentes de ontem (ignorando notified_at)
    const pendingBips = await bipRepository.find({
      where: {
        status: BipStatus.PENDING,
        event_date: Between(startOfDayBrazil, endOfDayBrazil)
      },
      relations: ['equipment', 'equipment.sector', 'employee'],
      order: {
        event_date: 'ASC'
      }
    });

    console.log(`📱 [ENVIO MANUAL] Encontradas ${pendingBips.length} bipagens pendentes`);

    if (pendingBips.length === 0) {
      return res.json({
        success: true,
        message: `Nenhuma bipagem pendente encontrada para ${dateStr}`,
        count: 0
      });
    }

    // Enviar PDF
    const pdfSent = await WhatsAppService.sendPendingBipsPDF(pendingBips, dateStr);

    if (pdfSent) {
      // Atualizar notified_at
      const notifiedAt = new Date();
      for (const bip of pendingBips) {
        bip.notified_at = notifiedAt;
      }
      await bipRepository.save(pendingBips);

      console.log(`✅ [ENVIO MANUAL] ${pendingBips.length} bipagens enviadas e marcadas como notificadas`);

      res.json({
        success: true,
        message: `Relatório enviado com sucesso! ${pendingBips.length} bipagens de ${dateStr}`,
        count: pendingBips.length,
        date: dateStr
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de bipagens'
    });
  }
});

/**
 * POST /api/whatsapp/send-losses-now
 * Envia manualmente o relatório de quebras/ajustes do dia anterior
 * Busca dados diretamente do Oracle (ERP)
 */
router.post('/send-losses-now', async (req, res) => {
  try {
    const { OracleService } = require('../services/oracle.service');
    const { LossPDFService } = require('../services/loss-pdf.service');
    const { AppDataSource } = require('../config/database');
    const { LossReasonConfig } = require('../entities/LossReasonConfig');

    // Calcular data de ontem no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBR = new Date(brDate);
    yesterdayBR.setDate(yesterdayBR.getDate() - 1);

    const year = yesterdayBR.getFullYear();
    const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayBR.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateFormatted = `${day}/${month}/${year}`;

    console.log(`📤 [ENVIO MANUAL QUEBRAS] Buscando quebras do Oracle de ${dateStr}...`);

    // Buscar motivos ATIVOS do PostgreSQL (ignorarCalculo: true = motivo ativo na interface)
    const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);
    const activeReasons = await reasonConfigRepository.find({
      where: { ignorarCalculo: true }
    });
    const activeReasonNames = activeReasons.map((r: any) => r.motivo);

    console.log(`📋 [ENVIO MANUAL QUEBRAS] Motivos ativos: ${activeReasonNames.join(', ')}`);

    // Query para buscar todas as quebras do dia anterior do Oracle
    const codigoLoja = 1; // TODO: Pegar da configuração se necessário

    // Obter nomes das tabelas dinamicamente via MappingService
    const schema = await MappingService.getSchema();
    const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

    // Resolver colunas via MappingService
    const colCodProdutoAe = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_produto');
    const colQtdAjuste = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'quantidade');
    const colTipoAjuste = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'tipo_ajuste');
    const colDtaAjuste = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'data_ajuste');
    const colCodLojaAe = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_loja');
    const colCodProdutoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colCodBarraPrincipal = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA_PRINCIPAL');
    const colDesAjuste = await MappingService.getColumnFromTable('TAB_TIPO_AJUSTE', 'descricao_ajuste', 'DES_AJUSTE');
    const colCodAjuste = await MappingService.getColumnFromTable('TAB_TIPO_AJUSTE', 'codigo_ajuste', 'COD_AJUSTE');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'valor_custo_reposicao', 'VAL_CUSTO_REP');
    const colFlgCancelado = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'flag_cancelado', 'FLG_CANCELADO');

    const itensQuery = `
      SELECT
        ae.${colCodProdutoAe},
        p.${colDesProduto} as DESCRICAO,
        p.${colCodBarraPrincipal} as CODIGO_BARRAS,
        ta.${colDesAjuste} as MOTIVO,
        NVL(ae.${colQtdAjuste}, 0) as QUANTIDADE,
        NVL(ae.${colValCustoRep}, 0) as CUSTO_REPOSICAO,
        NVL(ae.${colQtdAjuste}, 0) * NVL(ae.${colValCustoRep}, 0) as VALOR_TOTAL,
        s.${colCodSecao},
        s.${colDesSecao} as SECAO
      FROM ${tabAjusteEstoque} ae
      JOIN ${tabProduto} p ON ae.${colCodProdutoAe} = p.${colCodProdutoP}
      LEFT JOIN ${tabTipoAjuste} ta ON ae.${colTipoAjuste} = ta.${colCodAjuste}
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoP} = s.${colCodSecao}
      WHERE ae.${colCodLojaAe} = :loja
      AND ae.${colDtaAjuste} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
      AND ae.${colDtaAjuste} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
      AND (ae.${colFlgCancelado} IS NULL OR ae.${colFlgCancelado} != 'S')
      ORDER BY ta.${colDesAjuste} ASC, p.${colDesProduto} ASC
    `;

    const params = {
      loja: codigoLoja,
      data_inicio: dateStr,
      data_fim: dateStr,
    };

    const oracleItems = await OracleService.query(itensQuery, params);

    console.log(`📊 [ENVIO MANUAL QUEBRAS] Encontradas ${oracleItems.length} quebras no Oracle`);

    if (oracleItems.length === 0) {
      return res.json({
        success: true,
        message: `Nenhuma quebra encontrada para ${dateFormatted}`,
        count: 0
      });
    }

    // Converter para formato esperado pelo LossPDFService
    const losses = oracleItems.map((item: any) => ({
      codigoBarras: item.CODIGO_BARRAS || '',
      descricaoReduzida: item.DESCRICAO || '',
      quantidadeAjuste: parseFloat(item.QUANTIDADE) || 0,
      custoReposicao: parseFloat(item.CUSTO_REPOSICAO) || 0,
      descricaoAjusteCompleta: item.MOTIVO || 'SEM MOTIVO',
      secao: item.COD_SECAO || '',
      secaoNome: item.SECAO || 'SEM SEÇÃO',
    }));

    // Filtrar itens para INCLUIR apenas motivos ATIVOS
    const filteredLosses = losses.filter((item: any) =>
      activeReasonNames.includes(item.descricaoAjusteCompleta)
    );

    console.log(`📊 [ENVIO MANUAL QUEBRAS] ${losses.length} quebras totais, ${filteredLosses.length} com motivos ativos`);

    if (filteredLosses.length === 0) {
      return res.json({
        success: true,
        message: `Nenhuma quebra com motivo ativo encontrada para ${dateFormatted} (${losses.length} quebras totais)`,
        count: 0
      });
    }

    // Separar saídas e entradas
    const saidas = filteredLosses.filter((item: any) => item.quantidadeAjuste < 0);
    const entradas = filteredLosses.filter((item: any) => item.quantidadeAjuste >= 0);

    // Calcular totais
    const totalSaidas = saidas.length;
    const totalEntradas = entradas.length;
    const valorSaidas = saidas.reduce((sum: number, item: any) =>
      sum + Math.abs(item.quantidadeAjuste * item.custoReposicao), 0);
    const valorEntradas = entradas.reduce((sum: number, item: any) =>
      sum + Math.abs(item.quantidadeAjuste * item.custoReposicao), 0);

    // Gerar resumo para WhatsApp
    const summary = LossPDFService.generateWhatsAppSummary(filteredLosses);
    const saidasPorMotivo = summary.saidas;
    const entradasPorMotivo = summary.entradas;

    // Gerar PDF
    const nomeLote = `Quebras ${dateFormatted}`;
    const pdfPath = await LossPDFService.generateLossesPDF(
      nomeLote,
      dateStr,
      dateStr,
      filteredLosses
    );

    console.log(`📄 [ENVIO MANUAL QUEBRAS] PDF gerado: ${pdfPath}`);

    // Enviar para WhatsApp
    const sent = await WhatsAppService.sendLossesReport(
      pdfPath,
      nomeLote,
      filteredLosses.length,
      totalSaidas,
      totalEntradas,
      valorSaidas,
      valorEntradas,
      saidasPorMotivo,
      entradasPorMotivo
    );

    // Limpar arquivo temporário
    const fs = require('fs');
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    if (sent) {
      console.log(`✅ [ENVIO MANUAL QUEBRAS] ${filteredLosses.length} quebras enviadas com sucesso`);

      res.json({
        success: true,
        message: `Relatório enviado com sucesso! ${filteredLosses.length} quebras de ${dateFormatted} (${totalSaidas} saídas: R$ ${valorSaidas.toFixed(2)}, ${totalEntradas} entradas: R$ ${valorEntradas.toFixed(2)})`,
        count: filteredLosses.length,
        date: dateStr
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL QUEBRAS] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de quebras'
    });
  }
});

/**
 * POST /api/whatsapp/send-abastecimento-now
 * Envia manualmente o relatório de prioridade de abastecimento do dia anterior
 */
router.post('/send-abastecimento-now', async (req, res) => {
  try {
    const { AbastecimentoService } = require('../services/abastecimento.service');
    const { AbastecimentoPDFService } = require('../services/abastecimento-pdf.service');
    const fs = require('fs');

    // Calcular data de ontem no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBR = new Date(brDate);
    yesterdayBR.setDate(yesterdayBR.getDate() - 1);

    const year = yesterdayBR.getFullYear();
    const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayBR.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateFormatted = `${day}/${month}/${year}`;

    console.log(`📤 [ENVIO MANUAL ABASTECIMENTO] Buscando dados de ${dateStr}...`);

    // Buscar dados do abastecimento (codLoja=1 por padrão)
    const result = await AbastecimentoService.getPrioridadeReposicao('1', dateStr);

    if (!result.itens || result.itens.length === 0) {
      return res.json({
        success: true,
        message: `Nenhum produto encontrado para ${dateFormatted}. Nada enviado.`,
        count: 0,
        date: dateStr
      });
    }

    // Filtrar apenas MERCADORIA
    const itensMercadoria = result.itens.filter((i: any) => i.tipo_especie === 'MERCADORIA');

    if (itensMercadoria.length === 0) {
      return res.json({
        success: true,
        message: `Nenhuma mercadoria encontrada para ${dateFormatted}. Nada enviado.`,
        count: 0,
        date: dateStr
      });
    }

    const p1 = itensMercadoria.filter((i: any) => i.prioridade === 1).length;
    const p2 = itensMercadoria.filter((i: any) => i.prioridade === 2).length;
    const p3 = itensMercadoria.filter((i: any) => i.prioridade === 3).length;
    const p4 = itensMercadoria.filter((i: any) => i.prioridade === 4).length;

    // Gerar PDF com pdfkit
    const pdfPath = await AbastecimentoPDFService.generatePDF(dateFormatted, itensMercadoria);

    console.log(`📤 [ENVIO MANUAL ABASTECIMENTO] PDF gerado: ${pdfPath}`);

    // Enviar via WhatsApp
    const sent = await WhatsAppService.sendAbastecimentoReport(
      pdfPath,
      dateFormatted,
      itensMercadoria.length,
      p1, p2, p3, p4
    );

    // Limpar PDF temporário
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

    if (sent) {
      console.log(`✅ [ENVIO MANUAL ABASTECIMENTO] ${itensMercadoria.length} itens enviados`);
      res.json({
        success: true,
        message: `Relatório enviado com sucesso! ${itensMercadoria.length} itens de ${dateFormatted} (P1: ${p1}, P2: ${p2}, P3: ${p3}, P4: ${p4})`,
        count: itensMercadoria.length,
        date: dateStr
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL ABASTECIMENTO] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de abastecimento'
    });
  }
});

/**
 * POST /api/whatsapp/send-cortes-now
 * Envia manualmente o relatório de cortes de pedidos do dia anterior
 */
router.post('/send-cortes-now', async (req, res) => {
  try {
    const { OracleService } = require('../services/oracle.service');
    const { CortesPDFService } = require('../services/cortes-pdf.service');
    const fs = require('fs');

    // Calcular data de ontem no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBR = new Date(brDate);
    yesterdayBR.setDate(yesterdayBR.getDate() - 1);

    const year = yesterdayBR.getFullYear();
    const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayBR.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateFormatted = `${day}/${month}/${year}`;

    console.log(`📤 [ENVIO MANUAL CORTES] Buscando cortes de ${dateStr}...`);

    // Resolver tabelas e colunas via MappingService
    const schema = await MappingService.getSchema();
    const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
    const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
    const pedCodParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor');
    const pedTipoRecebimentoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
    const pedTipoParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');
    const pedValPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_pedido');
    const ppNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
    const ppCodProdutoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
    const ppQtdPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida');
    const ppQtdRecebidaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_recebida');
    const ppValTabelaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela');
    const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
    const plEstoqueAtualCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
    const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');
    const ppDesUnidadeCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'descricao_unidade', 'DES_UNIDADE');
    const pedDtaPedidoCanceladoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_pedido_cancelado', 'DTA_PEDIDO_CANCELADO');

    // Query: buscar pedidos cancelados ontem com itens cortados, agrupados por fornecedor
    const query = `
      SELECT
        p.${pedNumPedidoCol} as NUM_PEDIDO,
        p.${pedCodParceiroCol} as COD_FORNECEDOR,
        p.${pedValPedidoCol} as VAL_PEDIDO,
        f.${fornRazaoSocialCol} as DES_FORNECEDOR,
        f.${fornCnpjCol} as CNPJ,
        pp.${ppCodProdutoCol} as COD_PRODUTO,
        pr.${prDesProdutoCol} as DES_PRODUTO,
        pp.${ppDesUnidadeCol} as DES_UNIDADE,
        pp.${ppQtdPedidoCol} as QTD_PEDIDO,
        NVL(pp.${ppQtdRecebidaCol}, 0) as QTD_RECEBIDA,
        (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) as QTD_CORTADA,
        NVL(pp.${ppValTabelaCol}, 0) as VAL_UNITARIO,
        (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) * NVL(pp.${ppValTabelaCol}, 0) as VAL_CORTE,
        NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA,
        NVL(pl.${plEstoqueAtualCol}, 0) as ESTOQUE_ATUAL
      FROM ${tabPedido} p
      INNER JOIN ${tabPedidoProduto} pp ON pp.${ppNumPedidoCol} = p.${pedNumPedidoCol}
      INNER JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = pp.${ppCodProdutoCol}
      LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = pp.${ppCodProdutoCol} AND pl.${plCodLojaCol} = 1
      LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
      WHERE p.${pedTipoParceiroCol} = 1
      AND p.${pedTipoRecebimentoCol} = 3
      AND TRUNC(p.${pedDtaPedidoCanceladoCol}) = TO_DATE(:dataCancelamento, 'YYYY-MM-DD')
      AND NVL(pp.${ppQtdRecebidaCol}, 0) < pp.${ppQtdPedidoCol}
      ORDER BY f.${fornRazaoSocialCol}, p.${pedNumPedidoCol}, (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) * NVL(pp.${ppValTabelaCol}, 0) DESC
    `;

    const oracleItems = await OracleService.query(query, { dataCancelamento: dateStr });

    console.log(`📊 [ENVIO MANUAL CORTES] Encontrados ${oracleItems.length} itens cortados no Oracle`);

    if (oracleItems.length === 0) {
      return res.json({
        success: true,
        message: `Nenhum corte encontrado para ${dateFormatted}. Nada enviado.`,
        count: 0,
        date: dateStr
      });
    }

    // Agrupar por fornecedor + pedido
    const fornMap = new Map<string, any>();
    oracleItems.forEach((item: any) => {
      const key = `${item.COD_FORNECEDOR}_${item.NUM_PEDIDO}`;
      if (!fornMap.has(key)) {
        fornMap.set(key, {
          cod_fornecedor: item.COD_FORNECEDOR,
          fornecedor: item.DES_FORNECEDOR || 'SEM FORNECEDOR',
          cnpj: item.CNPJ || '',
          num_pedido: item.NUM_PEDIDO,
          val_pedido: parseFloat(item.VAL_PEDIDO) || 0,
          itens: []
        });
      }
      fornMap.get(key).itens.push({
        cod_produto: item.COD_PRODUTO,
        descricao: item.DES_PRODUTO || '',
        qtd_pedida: parseFloat(item.QTD_PEDIDO) || 0,
        qtd_recebida: parseFloat(item.QTD_RECEBIDA) || 0,
        qtd_cortada: parseFloat(item.QTD_CORTADA) || 0,
        val_unitario: parseFloat(item.VAL_UNITARIO) || 0,
        val_total_corte: parseFloat(item.VAL_CORTE) || 0,
        curva: item.CURVA || 'X',
        estoque_atual: parseFloat(item.ESTOQUE_ATUAL) || 0,
        des_unidade: item.DES_UNIDADE || 'UN'
      });
    });

    const fornecedores = Array.from(fornMap.values());
    const totalItens = fornecedores.reduce((sum: number, f: any) => sum + f.itens.length, 0);
    const valorTotalCorte = fornecedores.reduce(
      (sum: number, f: any) => sum + f.itens.reduce((s: number, i: any) => s + i.val_total_corte, 0), 0
    );

    // Gerar PDF
    const pdfPath = await CortesPDFService.generatePDF(dateFormatted, fornecedores);

    console.log(`📤 [ENVIO MANUAL CORTES] PDF gerado: ${pdfPath}`);

    // Enviar via WhatsApp
    const sent = await WhatsAppService.sendCortesReport(
      pdfPath,
      dateFormatted,
      fornecedores.length,
      totalItens,
      valorTotalCorte
    );

    // Limpar PDF temporário
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

    if (sent) {
      console.log(`✅ [ENVIO MANUAL CORTES] ${totalItens} itens cortados de ${fornecedores.length} fornecedores enviados`);
      res.json({
        success: true,
        message: `Relatório enviado com sucesso! ${totalItens} itens cortados de ${fornecedores.length} fornecedores em ${dateFormatted} (R$ ${valorTotalCorte.toFixed(2)})`,
        count: totalItens,
        date: dateStr
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL CORTES] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de cortes'
    });
  }
});

/**
 * POST /api/whatsapp/send-atrasos-now
 * Envia manualmente o relatório de pedidos em atraso
 */
router.post('/send-atrasos-now', async (req, res) => {
  try {
    const { OracleService } = require('../services/oracle.service');
    const { AtrasosPDFService } = require('../services/atrasos-pdf.service');
    const fs = require('fs');

    // Data de hoje no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

    const year = brDate.getFullYear();
    const month = String(brDate.getMonth() + 1).padStart(2, '0');
    const day = String(brDate.getDate()).padStart(2, '0');
    const dateFormatted = `${day}/${month}/${year}`;

    console.log(`📤 [ENVIO MANUAL ATRASOS] Buscando pedidos em atraso...`);

    // Resolver tabelas e colunas via MappingService
    const schema = await MappingService.getSchema();
    const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
    const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
    const pedCodParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor');
    const pedTipoRecebimentoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
    const pedTipoParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');
    const pedValPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_pedido');
    const pedDtaEntregaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
    const ppNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
    const ppCodProdutoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
    const ppQtdPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida');
    const ppQtdRecebidaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_recebida');
    const ppValTabelaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela');
    const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
    const plEstoqueAtualCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
    const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');
    const ppDesUnidadeColAtrasos = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'descricao_unidade', 'DES_UNIDADE');

    // Query: buscar pedidos pendentes/parciais com data de entrega no passado
    const query = `
      SELECT
        p.${pedNumPedidoCol} as NUM_PEDIDO,
        p.${pedCodParceiroCol} as COD_FORNECEDOR,
        p.${pedValPedidoCol} as VAL_PEDIDO,
        TO_CHAR(p.${pedDtaEntregaCol}, 'DD/MM/YYYY') as DTA_ENTREGA,
        TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) as DIAS_ATRASO,
        f.${fornRazaoSocialCol} as DES_FORNECEDOR,
        f.${fornCnpjCol} as CNPJ,
        pp.${ppCodProdutoCol} as COD_PRODUTO,
        pr.${prDesProdutoCol} as DES_PRODUTO,
        pp.${ppDesUnidadeColAtrasos} as DES_UNIDADE,
        pp.${ppQtdPedidoCol} as QTD_PEDIDO,
        NVL(pp.${ppQtdRecebidaCol}, 0) as QTD_RECEBIDA,
        (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) as QTD_PENDENTE,
        NVL(pp.${ppValTabelaCol}, 0) as VAL_UNITARIO,
        (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) * NVL(pp.${ppValTabelaCol}, 0) as VAL_PENDENTE,
        NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA,
        NVL(pl.${plEstoqueAtualCol}, 0) as ESTOQUE_ATUAL
      FROM ${tabPedido} p
      INNER JOIN ${tabPedidoProduto} pp ON pp.${ppNumPedidoCol} = p.${pedNumPedidoCol}
      INNER JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = pp.${ppCodProdutoCol}
      LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = pp.${ppCodProdutoCol} AND pl.${plCodLojaCol} = 1
      LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
      WHERE p.${pedTipoParceiroCol} = 1
      AND p.${pedTipoRecebimentoCol} < 2
      AND TRUNC(p.${pedDtaEntregaCol}) < TRUNC(SYSDATE)
      AND (pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) > 0
      ORDER BY TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) DESC, f.${fornRazaoSocialCol}, p.${pedNumPedidoCol}
    `;

    const oracleItems = await OracleService.query(query, {});

    console.log(`📊 [ENVIO MANUAL ATRASOS] Encontrados ${oracleItems.length} itens em atraso no Oracle`);

    if (oracleItems.length === 0) {
      return res.json({
        success: true,
        message: `Nenhum pedido em atraso encontrado. Nada enviado.`,
        count: 0
      });
    }

    // Agrupar por fornecedor + pedido
    const fornMap = new Map<string, any>();
    oracleItems.forEach((item: any) => {
      const key = `${item.COD_FORNECEDOR}_${item.NUM_PEDIDO}`;
      if (!fornMap.has(key)) {
        fornMap.set(key, {
          cod_fornecedor: item.COD_FORNECEDOR,
          fornecedor: item.DES_FORNECEDOR || 'SEM FORNECEDOR',
          cnpj: item.CNPJ || '',
          num_pedido: item.NUM_PEDIDO,
          val_pedido: parseFloat(item.VAL_PEDIDO) || 0,
          dta_entrega: item.DTA_ENTREGA || '-',
          dias_atraso: parseInt(item.DIAS_ATRASO) || 0,
          itens: []
        });
      }
      fornMap.get(key).itens.push({
        cod_produto: item.COD_PRODUTO,
        descricao: item.DES_PRODUTO || '',
        qtd_pedida: parseFloat(item.QTD_PEDIDO) || 0,
        qtd_recebida: parseFloat(item.QTD_RECEBIDA) || 0,
        val_unitario: parseFloat(item.VAL_UNITARIO) || 0,
        val_total_pendente: parseFloat(item.VAL_PENDENTE) || 0,
        curva: item.CURVA || 'X',
        estoque_atual: parseFloat(item.ESTOQUE_ATUAL) || 0,
        des_unidade: item.DES_UNIDADE || 'UN'
      });
    });

    const fornecedores = Array.from(fornMap.values());
    const totalItens = fornecedores.reduce((sum: number, f: any) => sum + f.itens.length, 0);
    const valorTotalPendente = fornecedores.reduce(
      (sum: number, f: any) => sum + f.itens.reduce((s: number, i: any) => s + i.val_total_pendente, 0), 0
    );

    // Gerar PDF
    const pdfPath = await AtrasosPDFService.generatePDF(dateFormatted, fornecedores);

    console.log(`📤 [ENVIO MANUAL ATRASOS] PDF gerado: ${pdfPath}`);

    // Enviar via WhatsApp
    const sent = await WhatsAppService.sendAtrasosReport(
      pdfPath,
      dateFormatted,
      fornecedores.length,
      fornecedores.length,
      totalItens,
      valorTotalPendente
    );

    // Limpar PDF temporário
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

    if (sent) {
      console.log(`✅ [ENVIO MANUAL ATRASOS] ${totalItens} itens em atraso de ${fornecedores.length} fornecedores enviados`);
      res.json({
        success: true,
        message: `Relatório enviado com sucesso! ${totalItens} itens em atraso de ${fornecedores.length} fornecedores (R$ ${valorTotalPendente.toFixed(2)})`,
        count: totalItens
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL ATRASOS] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de atrasos'
    });
  }
});

/**
 * POST /api/whatsapp/send-prazo-fornecedores-now
 * Envia manualmente o relatório de prazo fornecedores fora do combinado (dia anterior)
 */
router.post('/send-prazo-fornecedores-now', async (req, res) => {
  try {
    const { PrazoFornecedoresService } = require('../services/prazo-fornecedores.service');
    const { PrazoFornecedoresPDFService } = require('../services/prazo-fornecedores-pdf.service');
    const fs = require('fs');

    // Calcular data de ontem no horário do Brasil
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBR = new Date(brDate);
    yesterdayBR.setDate(yesterdayBR.getDate() - 1);

    const year = yesterdayBR.getFullYear();
    const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayBR.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateFormatted = `${day}/${month}/${year}`;

    console.log(`📤 [ENVIO MANUAL PRAZO FORN] Buscando fornecedores de ${dateStr}...`);

    // Buscar fornecedores com prazos do dia anterior
    const fornecedores = await PrazoFornecedoresService.listarFornecedoresComPrazo(undefined, dateStr, dateStr);

    // Filtrar apenas fornecedores com COND_PGTO_SISTEMA > 0 e notas fora do combinado
    const fornecedoresFora: any[] = [];
    for (const forn of fornecedores) {
      if (!forn.COND_PGTO_SISTEMA || forn.COND_PGTO_SISTEMA <= 0) continue;
      const notasFora = (forn.notas || []).filter((n: any) => n.PRAZO_MEDIO_NF > 0 && n.PRAZO_MEDIO_NF < forn.COND_PGTO_SISTEMA);
      if (notasFora.length > 0) {
        fornecedoresFora.push({
          COD_FORNECEDOR: forn.COD_FORNECEDOR,
          DES_FANTASIA: forn.DES_FANTASIA,
          DES_CONTATO: (forn as any).DES_CONTATO || '',
          NUM_CELULAR: (forn as any).NUM_CELULAR || '',
          NUM_FONE: (forn as any).NUM_FONE || '',
          COND_PGTO_SISTEMA: forn.COND_PGTO_SISTEMA,
          PRAZO_MEDIO: forn.PRAZO_MEDIO,
          VAL_TOTAL: forn.VAL_TOTAL,
          notasFora,
        });
      }
    }

    if (fornecedoresFora.length === 0) {
      return res.json({
        success: true,
        message: `Nenhum fornecedor fora do combinado encontrado para ${dateFormatted}. Nada enviado.`,
        count: 0,
        date: dateStr
      });
    }

    const totalNFs = fornecedoresFora.reduce((s: number, f: any) => s + f.notasFora.length, 0);
    const valorTotal = fornecedoresFora.reduce((s: number, f: any) =>
      s + f.notasFora.reduce((s2: number, n: any) => s2 + (n.VAL_TOTAL_NF || 0), 0), 0);

    // Gerar PDF
    const pdfPath = await PrazoFornecedoresPDFService.generatePDF(dateFormatted, fornecedoresFora);

    console.log(`📤 [ENVIO MANUAL PRAZO FORN] PDF gerado: ${pdfPath}`);

    // Enviar via WhatsApp
    const sent = await WhatsAppService.sendPrazoFornecedoresReport(
      pdfPath, dateFormatted, fornecedoresFora.length, totalNFs, valorTotal
    );

    // Limpar PDF temporário
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

    if (sent) {
      console.log(`✅ [ENVIO MANUAL PRAZO FORN] ${fornecedoresFora.length} fornecedores fora do combinado enviados`);
      res.json({
        success: true,
        message: `Relatório enviado! ${fornecedoresFora.length} fornecedores fora do combinado, ${totalNFs} NFs (R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
        count: fornecedoresFora.length,
        date: dateStr
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar o PDF para o WhatsApp'
      });
    }
  } catch (error: any) {
    console.error('❌ [ENVIO MANUAL PRAZO FORN] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar relatório de prazo fornecedores'
    });
  }
});

export default router;
