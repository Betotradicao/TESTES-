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
    const groups = await WhatsAppService.fetchGroups();

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
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_produto');
    const colCodSecaoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    const itensQuery = `
      SELECT
        ae.${colCodProdutoAe},
        p.${colDesProduto} as DESCRICAO,
        p.COD_BARRA_PRINCIPAL as CODIGO_BARRAS,
        ta.DES_AJUSTE as MOTIVO,
        NVL(ae.${colQtdAjuste}, 0) as QUANTIDADE,
        NVL(ae.VAL_CUSTO_REP, 0) as CUSTO_REPOSICAO,
        NVL(ae.${colQtdAjuste}, 0) * NVL(ae.VAL_CUSTO_REP, 0) as VALOR_TOTAL,
        s.${colCodSecao},
        s.${colDesSecao} as SECAO
      FROM ${tabAjusteEstoque} ae
      JOIN ${tabProduto} p ON ae.${colCodProdutoAe} = p.${colCodProdutoP}
      LEFT JOIN ${tabTipoAjuste} ta ON ae.${colTipoAjuste} = ta.COD_AJUSTE
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoP} = s.${colCodSecao}
      WHERE ae.${colCodLojaAe} = :loja
      AND ae.${colDtaAjuste} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
      AND ae.${colDtaAjuste} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
      AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
      ORDER BY ta.DES_AJUSTE ASC, p.${colDesProduto} ASC
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

export default router;
