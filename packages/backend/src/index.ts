// Configurar PATH do Oracle Instant Client ANTES de qualquer import
if (process.platform === 'win32') {
  const oraclePath = 'C:\\oracle\\instantclient_64\\instantclient_23_4';
  process.env.PATH = `${oraclePath};${process.env.PATH}`;
  console.log('✅ Oracle Instant Client adicionado ao PATH');
}

import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { AppDataSource } from './config/database';
import { swaggerSpec } from './config/swagger';
import healthRouter from './routes/health.routes';
import authRouter from './routes/auth.routes';
import bipsRouter from './routes/bips.routes';
import bipagesRouter from './routes/bipages.routes';
import productsRouter from './routes/products.routes';
import salesRouter from './routes/sales.routes';
import sellsRouter from './routes/sells.routes';
import sectorsRouter from './routes/sectors.routes';
import equipmentsRouter from './routes/equipments.routes';
import employeesRouter from './routes/employees.routes';
import equipmentSessionsRouter from './routes/equipment-sessions.routes';
import configRouter from './routes/config.routes';
import companiesRouter from './routes/companies.routes';
import systemRouter from './routes/system.routes';
import setupRouter from './routes/setup.routes';
import passwordRecoveryRouter from './routes/password-recovery.routes';
import configurationsRouter from './routes/configurations.routes';
import emailMonitorRouter from './routes/email-monitor.routes';
// import dvrRouter from './routes/dvr.routes'; // Desabilitado temporariamente
import dvrMonitorRouter from './routes/dvr-monitor.routes';
import suspectIdentificationsRouter from './routes/suspect-identifications.routes';
import tailscaleRouter from './routes/tailscale.routes';
import systemStatusRouter from './routes/system-status.routes';
import ruptureSurveyRouter from './routes/rupture-survey.routes';
import labelAuditRouter from './routes/label-audit.routes';
import lossRouter from './routes/loss.routes';
import whatsappRouter from './routes/whatsapp.routes';
import pdvRouter from './routes/pdv.routes';
import productionAuditRouter from './routes/production-audit.routes';
import hortfrutRouter from './routes/hortfrut.routes';
import suppliersRouter from './routes/suppliers.routes';
import compraVendaRouter from './routes/compra-venda.routes';
import frenteCaixaRouter from './routes/frente-caixa.routes';
import pedidosCompraRouter from './routes/pedidos-compra.routes';
import rupturaIndustriaRouter from './routes/ruptura-industria.routes';
import gestaoInteligenteRouter from './routes/gestao-inteligente.routes';
import databaseConnectionsRouter from './routes/database-connections.routes';
import erpTemplatesRouter from './routes/erp-templates.routes';
import tunnelInstallerRouter from './routes/tunnel-installer.routes';
import barcodeInstallerRouter from './routes/barcode-installer.routes';
import holidaysRouter from './routes/holidays.routes';
import aiConsultantRouter from './routes/ai-consultant.routes';
import calendarioAtendimentoRouter from './routes/calendario-atendimento.routes';
import { cotacaoRouter, cotacaoPublicRouter } from './routes/cotacao.routes';
import notaFiscalRecebimentoRouter from './routes/nota-fiscal-recebimento.routes';
import santanderRouter from './routes/santander.routes';
import { minioService } from './services/minio.service';
import { OracleService } from './services/oracle.service';
import { MappingService } from './services/mapping.service';
import { EmailMonitorService } from './services/email-monitor.service';
import { SellsSyncService } from './services/sells-sync.service';
import { seedMasterUser } from './database/seeds/masterUser.seed';
import seedConfigurations from './scripts/seed-configurations';
import * as cron from 'node-cron';
// import { checkSetupMiddleware } from './middleware/check-setup.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração CORS para permitir acesso via Ngrok e rede local
app.use(cors({
  origin: true, // Permite qualquer origem
  credentials: true, // Permite cookies e autenticação
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Headers adicionais para Chrome Private Network Access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Rotas públicas (setup precisa estar disponível antes do login)
app.use('/api/setup', setupRouter);
app.use('/api/password-recovery', passwordRecoveryRouter);
app.use('/api/public/cotacao', cotacaoPublicRouter);

// Rotas protegidas
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/bips', bipsRouter);
app.use('/api/bipagens', bipagesRouter);
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/sells', sellsRouter);
app.use('/api/sectors', sectorsRouter);
app.use('/api/equipments', equipmentsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/equipment-sessions', equipmentSessionsRouter);
app.use('/api/config', configRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/system', systemRouter);
app.use('/api/configurations', configurationsRouter);
app.use('/api/email-monitor', emailMonitorRouter);
// app.use('/api/dvr', dvrRouter); // Desabilitado temporariamente
app.use('/api/dvr-monitor', dvrMonitorRouter);
app.use('/api/suspect-identifications', suspectIdentificationsRouter);
app.use('/api/tailscale', tailscaleRouter);
app.use('/api', systemStatusRouter);
app.use('/api/rupture-surveys', ruptureSurveyRouter);
app.use('/api/label-audits', labelAuditRouter);
app.use('/api/losses', lossRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/pdv', pdvRouter);
app.use('/api/production', productionAuditRouter);
app.use('/api/hortfrut', hortfrutRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/compra-venda', compraVendaRouter);
app.use('/api/frente-caixa', frenteCaixaRouter);
app.use('/api/pedidos-compra', pedidosCompraRouter);
app.use('/api/ruptura-industria', rupturaIndustriaRouter);
app.use('/api/gestao-inteligente', gestaoInteligenteRouter);
app.use('/api/database-connections', databaseConnectionsRouter);
app.use('/api/erp-templates', erpTemplatesRouter);
app.use('/api/tunnel-installer', tunnelInstallerRouter);
app.use('/api/barcode-installer', barcodeInstallerRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/ai-consultant', aiConsultantRouter);
app.use('/api/calendario-atendimento', calendarioAtendimentoRouter);
app.use('/api/cotacao', cotacaoRouter);
app.use('/api/nota-fiscal-recebimento', notaFiscalRecebimentoRouter);
app.use('/api/santander', santanderRouter);
// app.use('/api/user-security', userSecurityRouter);

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    // Seed de configurações do sistema (popula com dados do .env)
    // Agora só cria configurações novas, não sobrescreve existentes
    await seedConfigurations();

    // Seed do usuário master (desenvolvedor - cria automaticamente no boot)
    await seedMasterUser(AppDataSource);

    // Health check automático para manter conexão viva
    // Executa a cada 20 segundos
    setInterval(async () => {
      try {
        await AppDataSource.query('SELECT 1');
        console.log('🔄 Database connection alive');
      } catch (error) {
        console.error('❌ Database connection lost, attempting to reconnect...');
        try {
          if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('✅ Database reconnected successfully');
          }
        } catch (reconnectError) {
          console.error('❌ Failed to reconnect:', reconnectError);
        }
      }
    }, 20000); // 20 segundos

  } catch (error) {
    console.warn('⚠️ Database connection failed:', error);
    console.log('Starting server without database connection...');

    // Tentar reconectar a cada 30 segundos
    setInterval(async () => {
      if (!AppDataSource.isInitialized) {
        try {
          console.log('🔄 Attempting to connect to database...');
          await AppDataSource.initialize();
          console.log('✅ Database connected successfully');
        } catch (retryError: any) {
          console.error('❌ Retry failed:', retryError?.message || retryError);
        }
      }
    }, 30000);
  }

  // Initialize MinIO bucket
  try {
    await minioService.ensureBucketExists();
    console.log('✅ MinIO initialized successfully');
  } catch (error) {
    console.error('❌ MinIO initialization failed:', error);
    console.log('Continuing without MinIO (avatar uploads will fail)');
  }

  // Initialize Oracle connection (optional - for Compra x Venda)
  try {
    await OracleService.initialize();
    console.log('✅ Oracle connection pool initialized');
  } catch (error) {
    console.error('⚠️ Oracle initialization failed (Compra x Venda may not work):', error);
    console.log('Continuing without Oracle connection');
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
  });
  // Timeout de 5 minutos para rotas pesadas (ex: extrato bancário de um ano)
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 310000;

  // Email Monitor Cron Job - runs every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await EmailMonitorService.checkNewEmails();
    } catch (error) {
      console.error('❌ Email monitor cron error:', error);
    }
  });

  console.log('📧 Email monitor cron job started (every 30 seconds)');

  // Pending Bips Report Cron Job - runs every minute and checks configured schedule time
  let lastBipsSendMinute = -1; // Evitar enviar múltiplas vezes no mesmo minuto

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_bips_schedule_time');

      // Converter horário do Brasil para comparação
      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      // Log a cada minuto para debug
      console.log(`🔍 [BIPS CRON] Horário Brasil: ${brDate.toLocaleTimeString('pt-BR')} | Configurado: ${scheduleTime || 'NÃO CONFIGURADO'}`);

      // Se não houver horário configurado, não envia
      if (!scheduleTime) {
        return;
      }

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);

      // Verificar se é o horário configurado (em horário do Brasil)
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      console.log(`🔍 [BIPS CRON] currentMinuteKey: ${currentMinuteKey} | scheduleMinuteKey: ${scheduleMinuteKey} | lastSent: ${lastBipsSendMinute}`);

      if (currentMinuteKey === scheduleMinuteKey && lastBipsSendMinute !== currentMinuteKey) {
        lastBipsSendMinute = currentMinuteKey;

        console.log(`⏰ Horário de envio de bipagens pendentes: ${scheduleTime} (Brasil)`);
        console.log(`📅 Horário atual (Brasil): ${brDate.toLocaleTimeString('pt-BR')}`);

        // Buscar bipagens do dia anterior (em horário do Brasil)
        const yesterdayBR = new Date(brDate);
        yesterdayBR.setDate(yesterdayBR.getDate() - 1);

        // Formatar data no padrão YYYY-MM-DD usando horário do Brasil
        const year = yesterdayBR.getFullYear();
        const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
        const day = String(yesterdayBR.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        console.log(`📊 Buscando bipagens pendentes de ${dateStr}...`);

        const { AppDataSource } = await import('./config/database');
        const { Bip, BipStatus } = await import('./entities/Bip');
        const { IsNull, Between } = await import('typeorm');

        const bipRepository = AppDataSource.getRepository(Bip);

        // Calcular início e fim do dia em UTC (considerando que Brasil é UTC-3)
        // Início do dia no Brasil (00:00) = 03:00 UTC
        // Fim do dia no Brasil (23:59:59) = 02:59:59 UTC do dia seguinte
        const startOfDayBrazil = new Date(`${dateStr}T03:00:00.000Z`); // 00:00 Brasil = 03:00 UTC
        const endOfDayBrazil = new Date(`${dateStr}T03:00:00.000Z`);
        endOfDayBrazil.setDate(endOfDayBrazil.getDate() + 1);
        endOfDayBrazil.setMilliseconds(endOfDayBrazil.getMilliseconds() - 1); // 23:59:59.999 Brasil

        console.log(`🕐 Período de busca (UTC): ${startOfDayBrazil.toISOString()} até ${endOfDayBrazil.toISOString()}`);

        const pendingBips = await bipRepository.find({
          where: {
            status: BipStatus.PENDING,
            notified_at: IsNull(),
            event_date: Between(startOfDayBrazil, endOfDayBrazil)
          },
          relations: ['equipment', 'equipment.sector', 'employee'],
          order: {
            event_date: 'ASC'
          }
        });

        console.log(`📱 Encontradas ${pendingBips.length} bipagens pendentes para enviar`);

        if (pendingBips.length > 0) {
          const { WhatsAppService } = await import('./services/whatsapp.service');
          const pdfSent = await WhatsAppService.sendPendingBipsPDF(pendingBips, dateStr);

          if (pdfSent) {
            // Marcar bipagens como notificadas
            const notifiedAt = new Date();
            for (const bip of pendingBips) {
              bip.notified_at = notifiedAt;
            }
            await bipRepository.save(pendingBips);
            console.log(`✅ ${pendingBips.length} bipagens marcadas como notificadas`);
          } else {
            console.error(`❌ Falha ao enviar PDF de bipagens pendentes`);
          }
        } else {
          console.log(`ℹ️ Nenhuma bipagem pendente para enviar em ${dateStr}`);
        }
      }
    } catch (error) {
      console.error('❌ Pending bips cron error:', error);
    }
  });

  console.log('🔔 Pending bips report cron job started (checks every minute, respects Brazil timezone)');

  // Losses Report Cron Job - runs every minute and checks configured schedule time
  let lastLossesSendMinute = -1; // Evitar enviar múltiplas vezes no mesmo minuto

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_losses_schedule_time');

      // Converter horário do Brasil para comparação
      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      // Se não houver horário configurado, não envia
      if (!scheduleTime) {
        return;
      }

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);

      // Verificar se é o horário configurado (em horário do Brasil)
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastLossesSendMinute !== currentMinuteKey) {
        lastLossesSendMinute = currentMinuteKey;

        console.log(`⏰ [QUEBRAS CRON] Horário de envio: ${scheduleTime} (Brasil)`);
        console.log(`📅 [QUEBRAS CRON] Horário atual (Brasil): ${brDate.toLocaleTimeString('pt-BR')}`);

        // Buscar quebras do dia anterior (em horário do Brasil)
        const yesterdayBR = new Date(brDate);
        yesterdayBR.setDate(yesterdayBR.getDate() - 1);

        // Formatar data no padrão YYYY-MM-DD usando horário do Brasil
        const year = yesterdayBR.getFullYear();
        const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
        const day = String(yesterdayBR.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dateFormatted = `${day}/${month}/${year}`;

        console.log(`📊 [QUEBRAS CRON] Buscando quebras do Oracle de ${dateStr}...`);

        const { AppDataSource } = await import('./config/database');
        const { LossReasonConfig } = await import('./entities/LossReasonConfig');
        const { LossPDFService } = await import('./services/loss-pdf.service');
        const { WhatsAppService } = await import('./services/whatsapp.service');
        const { OracleService } = await import('./services/oracle.service');
        const fs = await import('fs');

        const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);

        // Buscar motivos ATIVOS (ignorarCalculo: true = motivo ativo na interface)
        const activeReasons = await reasonConfigRepository.find({
          where: { ignorarCalculo: true }
        });
        const activeReasonNames = activeReasons.map((r: any) => r.motivo);

        console.log(`📋 [QUEBRAS CRON] Motivos ativos: ${activeReasonNames.join(', ')}`);

        // Buscar todas as quebras do dia anterior do Oracle
        const codigoLoja = 1; // TODO: Pegar da configuração se necessário

        // Buscar schema e nomes reais das tabelas via MappingService
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

        console.log(`📊 [QUEBRAS CRON] Encontradas ${oracleItems.length} quebras no Oracle`);

        if (oracleItems.length === 0) {
          console.log(`ℹ️ [QUEBRAS CRON] Nenhuma quebra para enviar em ${dateStr}`);
          return;
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

        console.log(`📊 [QUEBRAS CRON] ${losses.length} quebras totais, ${filteredLosses.length} com motivos ativos`);

        if (filteredLosses.length === 0) {
          console.log(`ℹ️ [QUEBRAS CRON] Nenhuma quebra com motivo ativo encontrada`);
          return;
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

        console.log(`📄 [QUEBRAS CRON] PDF gerado: ${pdfPath}`);

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
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }

        if (sent) {
          console.log(`✅ [QUEBRAS CRON] ${filteredLosses.length} quebras enviadas com sucesso`);
        } else {
          console.error(`❌ [QUEBRAS CRON] Falha ao enviar PDF de quebras`);
        }
      }
    } catch (error) {
      console.error('❌ Losses cron error:', error);
    }
  });

  console.log('📊 Losses report cron job started (checks every minute, respects Brazil timezone)');

  // ==========================================
  // CRON: Sincronização de Vendas (Sells Sync)
  // Cruza vendas do Oracle com bipagens a cada 1 minuto
  // ==========================================
  cron.schedule('* * * * *', async () => {
    try {
      await SellsSyncService.syncToday();
    } catch (error) {
      console.error('❌ Sells sync cron error:', error);
    }
  });
  console.log('🔄 Sells sync cron job started (every 1 minute)');
};

startServer();
