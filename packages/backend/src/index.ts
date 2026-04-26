// Configurar PATH do Oracle Instant Client ANTES de qualquer import
if (process.platform === 'win32') {
  const oraclePath = 'C:\\oracle\\instantclient_64\\instantclient_23_4';
  process.env.PATH = `${oraclePath};${process.env.PATH}`;
  console.log('✅ Oracle Instant Client adicionado ao PATH');
}

import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import financeiroRouter from './routes/financeiro.routes';
import frenteCaixaRouter from './routes/frente-caixa.routes';
import pedidosCompraRouter from './routes/pedidos-compra.routes';
import rupturaIndustriaRouter from './routes/ruptura-industria.routes';
import gestaoInteligenteRouter from './routes/gestao-inteligente.routes';
import tributacaoRouter from './routes/tributacao.routes';
import databaseConnectionsRouter from './routes/database-connections.routes';
import erpTemplatesRouter from './routes/erp-templates.routes';
import tunnelInstallerRouter from './routes/tunnel-installer.routes';
import topQuedasRouter from './routes/top-quedas.routes';
import barcodeInstallerRouter from './routes/barcode-installer.routes';
import holidaysRouter from './routes/holidays.routes';
import aiConsultantRouter from './routes/ai-consultant.routes';
import calendarioAtendimentoRouter from './routes/calendario-atendimento.routes';
import { cotacaoRouter, cotacaoPublicRouter } from './routes/cotacao.routes';
import notaFiscalRecebimentoRouter from './routes/nota-fiscal-recebimento.routes';
import santanderRouter from './routes/santander.routes';
import banco24horasRouter from './routes/banco24horas.routes';
import ponderacaoRouter from './routes/ponderacao.routes';
import ancoragemRouter from './routes/ancoragem.routes';
import relevanciaRouter from './routes/relevancia.routes';
import competitividadeRouter from './routes/competitividade.routes';
import ofertasRouter from './routes/ofertas.routes';
import demonstrativoCaixaRouter from './routes/demonstrativo-caixa.routes';
import abastecimentoRouter from './routes/abastecimento.routes';
import bankAccountsRouter from './routes/bank-accounts.routes';
import ddaRouter from './routes/dda.routes';
import conciliacaoRouter from './routes/conciliacao.routes';
import prazoFornecedoresRouter from './routes/prazo-fornecedores.routes';
import garimpadorRouter from './routes/garimpador.routes';
import checklistRouter from './routes/checklist.routes';
import arvoreConhecimentoRouter from './routes/arvore-conhecimento.routes';
import curriculosRouter from './routes/curriculos.routes';
import analiseCotacaoRouter from './routes/analise-cotacao.routes';
import prevencaoCaixaRouter from './routes/prevencao-caixa.routes';
import metasRouter from './routes/metas.routes';
import dvrCftvRouter from './routes/dvr-cftv.routes';
import faceRecognitionRouter from './routes/face-recognition.routes';
import ecommerceRouter from './routes/ecommerce.routes';
import margensCategoriaRouter from './routes/margens-categoria.routes';
import disparoWhatsappRouter from './routes/disparo-whatsapp.routes';
import pendenciasNotasRouter from './routes/pendencias-notas.routes';
import rhRouter from './routes/rh.routes';
import acougueRouter from './routes/acougue.routes';
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

// Configuração CORS - restringe origens permitidas
app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (apps mobile, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowed = [
      // Domínios de produção
      /\.prevencaonoradar\.com\.br$/,
      /\.prevencaonoradar\.com$/,
      // Rede local (desenvolvimento)
      /^https?:\/\/10\.\d+\.\d+\.\d+/,
      /^https?:\/\/192\.168\.\d+\.\d+/,
      /^https?:\/\/172\.\d+\.\d+\.\d+/,
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
      // Ngrok (desenvolvimento remoto)
      /\.ngrok\.io$/,
      /\.ngrok-free\.app$/,
      // Cloudflare tunnels
      /\.trycloudflare\.com$/,
    ];

    const isAllowed = allowed.some(pattern => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Headers adicionais para Chrome Private Network Access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

// Helmet: headers de segurança HTTP (previne XSS, clickjacking, MIME sniffing)
app.use(helmet({
  contentSecurityPolicy: false, // desabilitado pra nao quebrar frontend inline scripts
  crossOriginEmbedderPolicy: false, // desabilitado pra nao quebrar imagens externas
}));

// Rate limit global: max 200 requests por minuto por IP (protege contra DDoS simples)
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200, // max 200 requests por IP por minuto
  message: { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Nao limita health check (usado por Docker healthcheck)
    return req.path === '/api/health';
  }
}));

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
app.use('/api/financeiro', financeiroRouter);
app.use('/api/frente-caixa', frenteCaixaRouter);
app.use('/api/pedidos-compra', pedidosCompraRouter);
app.use('/api/ruptura-industria', rupturaIndustriaRouter);
app.use('/api/gestao-inteligente', gestaoInteligenteRouter);
app.use('/api/tributacao', tributacaoRouter);
app.use('/api/database-connections', databaseConnectionsRouter);
app.use('/api/erp-templates', erpTemplatesRouter);
app.use('/api/tunnel-installer', tunnelInstallerRouter);
app.use('/api/top-quedas', topQuedasRouter);
app.use('/api/barcode-installer', barcodeInstallerRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/ai-consultant', aiConsultantRouter);
app.use('/api/calendario-atendimento', calendarioAtendimentoRouter);
app.use('/api/cotacao', cotacaoRouter);
app.use('/api/nota-fiscal-recebimento', notaFiscalRecebimentoRouter);
app.use('/api/santander', santanderRouter);
app.use('/api/banco24horas', banco24horasRouter);
app.use('/api/ponderacao', ponderacaoRouter);
app.use('/api/ancoragem', ancoragemRouter);
app.use('/api/relevancia', relevanciaRouter);
app.use('/api/competitividade', competitividadeRouter);
app.use('/api/ofertas', ofertasRouter);
app.use('/api/demonstrativo-caixa', demonstrativoCaixaRouter);
app.use('/api/abastecimento', abastecimentoRouter);
app.use('/api/bank-accounts', bankAccountsRouter);
app.use('/api/dda', ddaRouter);
app.use('/api/conciliacao', conciliacaoRouter);
app.use('/api/prazo-fornecedores', prazoFornecedoresRouter);
app.use('/api/garimpador', garimpadorRouter);
app.use('/api/checklist', checklistRouter);
app.use('/api/arvore-conhecimento', arvoreConhecimentoRouter);
app.use('/api/curriculos', curriculosRouter);
app.use('/api/analise-cotacao', analiseCotacaoRouter);
app.use('/api/ecommerce', ecommerceRouter);
app.use('/api/margens-categoria', margensCategoriaRouter);
app.use('/api/prevencao-caixa', prevencaoCaixaRouter);
app.use('/api/metas', metasRouter);
app.use('/api/dvr-cftv', dvrCftvRouter);
app.use('/api/face-recognition', faceRecognitionRouter);
app.use('/api/disparo-whatsapp', disparoWhatsappRouter);
app.use('/api/pendencias-notas', pendenciasNotasRouter);
app.use('/api/rh', rhRouter);
app.use('/api/acougue', acougueRouter);

// app.use('/api/user-security', userSecurityRouter);

// Disparo WhatsApp - configurar webhook na Evolution API
app.post('/api/disparo-whatsapp/setup-webhook', async (req: any, res: any) => {
  try {
    const ConfigService = require('./services/configuration.service').ConfigurationService;
    const url = await ConfigService.get('disparo_whats_url');
    const token = await ConfigService.get('disparo_whats_token');
    const instancia = await ConfigService.get('disparo_whats_instancia');
    if (!url || !token || !instancia) {
      return res.status(400).json({ error: 'Config de disparo não encontrada' });
    }

    const webhookUrl = req.body.webhook_url || 'https://tradicao.prevencaonoradar.com.br/api/disparo-whatsapp/webhook';
    const axios = require('axios');

    // Tentar diferentes endpoints da Evolution API
    let response;
    const headers = { apikey: token, 'Content-Type': 'application/json' };
    const payload = {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPDATE', 'MESSAGES_UPSERT', 'MESSAGE_RECEIPT_UPDATE']
    };

    // Tentar v1
    try {
      response = await axios.put(`${url}/webhook/set/${encodeURIComponent(instancia)}`, payload, { headers, timeout: 10000 });
      return res.json({ success: true, data: response.data, webhook_url: webhookUrl, method: 'PUT v1' });
    } catch (e1: any) {
      console.log('Webhook v1 PUT falhou:', e1.response?.status, e1.response?.data);
    }

    // Tentar v2
    try {
      response = await axios.post(`${url}/webhook/instance/${encodeURIComponent(instancia)}`, { webhook: payload }, { headers, timeout: 10000 });
      return res.json({ success: true, data: response.data, webhook_url: webhookUrl, method: 'POST v2' });
    } catch (e2: any) {
      console.log('Webhook v2 POST falhou:', e2.response?.status, e2.response?.data);
    }

    // Tentar buscar webhook atual
    try {
      response = await axios.get(`${url}/webhook/find/${encodeURIComponent(instancia)}`, { headers, timeout: 10000 });
      return res.json({ success: false, current_webhook: response.data, message: 'Não conseguiu configurar, mostrando webhook atual' });
    } catch (e3: any) {
      console.log('Webhook find falhou:', e3.response?.status, e3.response?.data);
    }

    // Listar instâncias pra debug
    try {
      response = await axios.get(`${url}/instance/fetchInstances`, { headers, timeout: 10000 });
      return res.json({ success: false, instances: response.data?.map((i: any) => i.name), message: 'Webhook não configurado, instâncias listadas' });
    } catch (e4: any) {
      return res.status(500).json({ error: 'Todas as tentativas falharam', details: e4.response?.data || e4.message });
    }
  } catch (err: any) {
    console.error('Erro setup webhook:', err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Marketing WhatsApp - teste de conexão com Evolution API
app.post('/api/marketing/whatsapp/test-connection', async (req: any, res: any) => {
  try {
    const { url, token, instancia } = req.body;
    if (!url || !token || !instancia) {
      return res.status(400).json({ error: 'URL, Token e Instância são obrigatórios' });
    }
    const axios = require('axios');
    const response = await axios.get(`${url}/instance/connectionState/${instancia}`, {
      headers: { apikey: token },
      timeout: 10000
    });
    const state = response.data?.instance?.state || response.data?.state || 'unknown';
    if (state === 'open' || state === 'connected') {
      return res.json({ success: true, message: `Conectado! Estado: ${state}` });
    } else {
      return res.json({ success: true, message: `Instância encontrada. Estado: ${state}` });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.response?.data?.message || err.message || 'Falha na conexão' });
  }
});

// Marketing WhatsApp - helper para buscar config
async function getMarketingConfig() {
  const ConfigService = require('./services/configuration.service').ConfigurationService;
  const url = await ConfigService.get('disparo_whats_url');
  const token = await ConfigService.get('disparo_whats_token');
  const instancia = await ConfigService.get('disparo_whats_instancia');
  return { url, token, instancia };
}

// Marketing WhatsApp - helper para buscar dados da Evolution via API
async function fetchEvolutionData(url: string, token: string, instancia: string) {
  const axios = require('axios');

  // Buscar instanceId
  const instResp = await axios.get(`${url}/instance/fetchInstances`, {
    headers: { apikey: token }, timeout: 10000
  });
  const inst = instResp.data?.find((i: any) => i.name === instancia);
  if (!inst) return null;

  // Buscar todas as mensagens (excluindo stories/status)
  const msgsResp = await axios.post(`${url}/chat/findMessages/${encodeURIComponent(instancia)}`, {
    where: {},
    limit: 1000
  }, { headers: { apikey: token }, timeout: 30000 }).catch(() => ({ data: { messages: { records: [] } } }));

  let msgs = msgsResp.data?.messages?.records || [];

  // Se API retorna vazio, tentar buscar de outra forma
  if (msgs.length === 0) {
    // Tentar endpoint alternativo
    try {
      const altResp = await axios.get(`${url}/chat/findContacts/${encodeURIComponent(instancia)}`, {
        headers: { apikey: token }, timeout: 10000
      });
      // Buscar mensagens por contato
    } catch {}
  }

  return { instance: inst, messages: msgs };
}

// Marketing WhatsApp - stats de entregas
app.get('/api/marketing/whatsapp/stats', async (req: any, res: any) => {
  try {
    const { url, token, instancia } = await getMarketingConfig();
    if (!url || !token || !instancia) {
      return res.json(null);
    }
    const axios = require('axios');

    // Buscar instância
    const instResp = await axios.get(`${url}/instance/fetchInstances`, {
      headers: { apikey: token }, timeout: 10000
    });
    const inst = instResp.data?.find((i: any) => i.name === instancia);
    if (!inst) return res.json(null);

    const totalMsgs = inst._count?.Message || 0;

    // 1. Buscar chats pra descobrir broadcast IDs
    const chatsResp = await axios.post(`${url}/chat/findChats/${encodeURIComponent(instancia)}`, {},
      { headers: { apikey: token }, timeout: 10000 }
    ).catch(() => ({ data: [] }));
    const chats = chatsResp.data || [];
    const broadcastIds = chats
      .map((c: any) => c.remoteJid)
      .filter((jid: string) => jid?.includes('@broadcast') && jid !== 'status@broadcast');

    // 2. Buscar mensagens enviadas (fromMe)
    const fromMeResp = await axios.post(`${url}/chat/findMessages/${encodeURIComponent(instancia)}`, {
      where: { key: { fromMe: true } }, limit: 1000
    }, { headers: { apikey: token }, timeout: 30000 }).catch(() => ({ data: { messages: { records: [] } } }));
    let msgs = fromMeResp.data?.messages?.records || [];

    // 3. Buscar mensagens de cada broadcast
    for (const bId of broadcastIds) {
      const bResp = await axios.post(`${url}/chat/findMessages/${encodeURIComponent(instancia)}`, {
        where: { key: { remoteJid: bId } }, limit: 500
      }, { headers: { apikey: token }, timeout: 15000 }).catch(() => ({ data: { messages: { records: [] } } }));
      const bMsgs = bResp.data?.messages?.records || [];
      const existingIds = new Set(msgs.map((m: any) => m.key?.id));
      bMsgs.forEach((m: any) => { if (!existingIds.has(m.key?.id)) msgs.push(m); });
    }

    let enviadas = 0, entregues = 0, lidas = 0, falharam = 0;
    msgs.forEach((m: any) => {
      const fromMe = m.key?.fromMe;
      const jid = m.key?.remoteJid || '';
      const isBroadcast = jid.includes('@broadcast') && jid !== 'status@broadcast';
      if (!fromMe && !isBroadcast) return;
      enviadas++;
      // Usar MessageUpdate pra status mais preciso
      const updates = m.MessageUpdate || [];
      const hasRead = updates.some((u: any) => u.status === 'READ');
      const hasDelivery = updates.some((u: any) => u.status === 'DELIVERY_ACK');
      const hasError = updates.some((u: any) => u.status === 'ERROR' || u.status === 'FAILED');
      if (hasRead) lidas++;
      else if (hasDelivery) entregues++;
      else if (hasError) falharam++;
    });

    // Se API não retorna msgs enviadas, usar total da instância como fallback
    if (enviadas === 0 && totalMsgs > 0) {
      enviadas = totalMsgs;
    }

    return res.json({ enviadas, entregues, lidas, falharam, totalMsgs });
  } catch (err: any) {
    console.error('Erro marketing stats:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Marketing WhatsApp - listar mensagens com detalhes
app.get('/api/marketing/whatsapp/messages', async (req: any, res: any) => {
  try {
    const { url, token, instancia } = await getMarketingConfig();
    if (!url || !token || !instancia) {
      return res.json({ messages: [] });
    }
    const axios = require('axios');

    // 1. Buscar chats pra descobrir broadcast IDs
    const chatsResp = await axios.post(`${url}/chat/findChats/${encodeURIComponent(instancia)}`, {},
      { headers: { apikey: token }, timeout: 10000 }
    ).catch(() => ({ data: [] }));
    const chats = chatsResp.data || [];
    const broadcastIds = chats
      .map((c: any) => c.remoteJid)
      .filter((jid: string) => jid?.includes('@broadcast') && jid !== 'status@broadcast');

    // 2. Buscar mensagens enviadas por nós (fromMe)
    const fromMeResp = await axios.post(`${url}/chat/findMessages/${encodeURIComponent(instancia)}`, {
      where: { key: { fromMe: true } }, limit: 500
    }, { headers: { apikey: token }, timeout: 30000 }).catch(() => ({ data: { messages: { records: [] } } }));
    let allMsgs = fromMeResp.data?.messages?.records || [];

    // 3. Buscar mensagens de cada broadcast (lista de transmissão)
    for (const bId of broadcastIds) {
      const bResp = await axios.post(`${url}/chat/findMessages/${encodeURIComponent(instancia)}`, {
        where: { key: { remoteJid: bId } }, limit: 100
      }, { headers: { apikey: token }, timeout: 15000 }).catch(() => ({ data: { messages: { records: [] } } }));
      const bMsgs = bResp.data?.messages?.records || [];
      const existingIds = new Set(allMsgs.map((m: any) => m.key?.id));
      bMsgs.forEach((m: any) => { if (!existingIds.has(m.key?.id)) allMsgs.push(m); });
    }

    const filtered = allMsgs;

    // Formatar mensagens
    const formatted = filtered.map((m: any) => ({
      id: m.key?.id,
      fromMe: m.key?.fromMe || false,
      remoteJid: m.key?.remoteJid,
      participant: m.key?.participant,
      remoteJidAlt: m.key?.remoteJidAlt,
      pushName: m.pushName,
      messageType: m.messageType,
      timestamp: m.messageTimestamp,
      caption: m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || m.message?.conversation || '',
      imageUrl: m.message?.imageMessage?.url || null,
      videoUrl: m.message?.videoMessage?.url || null,
      status: (() => {
        const updates = m.MessageUpdate || [];
        if (updates.length > 0) {
          // Prioridade: READ > DELIVERY_ACK > SERVER_ACK
          if (updates.some((u: any) => u.status === 'READ')) return 'READ';
          if (updates.some((u: any) => u.status === 'DELIVERY_ACK')) return 'DELIVERY_ACK';
          if (updates.some((u: any) => u.status === 'SERVER_ACK')) return 'SERVER_ACK';
          return updates[updates.length - 1].status;
        }
        return m.status || 'PENDING';
      })(),
    }));

    return res.json({ messages: formatted });
  } catch (err: any) {
    console.error('Erro marketing messages:', err.message);
    return res.status(500).json({ error: err.message });
  }
});


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

  // Abastecimento Report Cron Job - runs every minute and checks configured schedule time
  let lastAbastecimentoSendMinute = -1;

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_abastecimento_schedule_time');

      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      if (!scheduleTime) return;

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastAbastecimentoSendMinute !== currentMinuteKey) {
        lastAbastecimentoSendMinute = currentMinuteKey;

        console.log(`⏰ [ABASTECIMENTO CRON] Horário de envio: ${scheduleTime} (Brasil)`);

        const { AbastecimentoService } = await import('./services/abastecimento.service');
        const { AbastecimentoPDFService } = await import('./services/abastecimento-pdf.service');
        const { WhatsAppService } = await import('./services/whatsapp.service');
        const fs = await import('fs');

        // Data de ontem
        const yesterdayBR = new Date(brDate);
        yesterdayBR.setDate(yesterdayBR.getDate() - 1);
        const year = yesterdayBR.getFullYear();
        const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
        const day = String(yesterdayBR.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dateFormatted = `${day}/${month}/${year}`;

        const result = await AbastecimentoService.getPrioridadeReposicao('1', dateStr);

        if (result.itens && result.itens.length > 0) {
          const itensMercadoria = result.itens.filter((i: any) => i.tipo_especie === 'MERCADORIA');

          if (itensMercadoria.length > 0) {
            const p1 = itensMercadoria.filter((i: any) => i.prioridade === 1).length;
            const p2 = itensMercadoria.filter((i: any) => i.prioridade === 2).length;
            const p3 = itensMercadoria.filter((i: any) => i.prioridade === 3).length;
            const p4 = itensMercadoria.filter((i: any) => i.prioridade === 4).length;

            // Gerar PDF com pdfkit
            const pdfPath = await AbastecimentoPDFService.generatePDF(dateFormatted, itensMercadoria);

            const sent = await WhatsAppService.sendAbastecimentoReport(
              pdfPath, dateFormatted, itensMercadoria.length, p1, p2, p3, p4
            );

            try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

            if (sent) {
              console.log(`✅ [ABASTECIMENTO CRON] ${itensMercadoria.length} itens enviados`);
            } else {
              console.error(`❌ [ABASTECIMENTO CRON] Falha ao enviar PDF`);
            }
          }
        } else {
          console.log(`ℹ️ [ABASTECIMENTO CRON] Sem itens para ${dateFormatted}`);
        }
      }
    } catch (error) {
      console.error('❌ Abastecimento cron error:', error);
    }
  });

  console.log('📦 Abastecimento report cron job started (checks every minute, respects Brazil timezone)');

  // Prazo Fornecedores (Fora do Combinado) Report Cron Job
  let lastPrazoFornSendMinute = -1;

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_prazo_fornecedores_schedule_time');

      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      if (!scheduleTime) return;

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastPrazoFornSendMinute !== currentMinuteKey) {
        lastPrazoFornSendMinute = currentMinuteKey;

        console.log(`⏰ [PRAZO FORN CRON] Horário de envio: ${scheduleTime} (Brasil)`);

        const { PrazoFornecedoresService } = await import('./services/prazo-fornecedores.service');
        const { PrazoFornecedoresPDFService } = await import('./services/prazo-fornecedores-pdf.service');
        const { WhatsAppService } = await import('./services/whatsapp.service');
        const fs = await import('fs');

        // Data de ontem
        const yesterdayBR = new Date(brDate);
        yesterdayBR.setDate(yesterdayBR.getDate() - 1);
        const year = yesterdayBR.getFullYear();
        const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
        const day = String(yesterdayBR.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dateFormatted = `${day}/${month}/${year}`;

        const fornecedores = await PrazoFornecedoresService.listarFornecedoresComPrazo(undefined, dateStr, dateStr);

        // Filtrar fora do combinado
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

        if (fornecedoresFora.length > 0) {
          const totalNFs = fornecedoresFora.reduce((s: number, f: any) => s + f.notasFora.length, 0);
          const valorTotal = fornecedoresFora.reduce((s: number, f: any) =>
            s + f.notasFora.reduce((s2: number, n: any) => s2 + (n.VAL_TOTAL_NF || 0), 0), 0);

          const pdfPath = await PrazoFornecedoresPDFService.generatePDF(dateFormatted, fornecedoresFora);

          const sent = await WhatsAppService.sendPrazoFornecedoresReport(
            pdfPath, dateFormatted, fornecedoresFora.length, totalNFs, valorTotal
          );

          try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

          if (sent) {
            console.log(`✅ [PRAZO FORN CRON] ${fornecedoresFora.length} fornecedores fora do combinado enviados`);
          } else {
            console.error(`❌ [PRAZO FORN CRON] Falha ao enviar PDF`);
          }
        } else {
          console.log(`ℹ️ [PRAZO FORN CRON] Nenhum fornecedor fora do combinado para ${dateFormatted}`);
        }
      }
    } catch (error) {
      console.error('❌ Prazo Fornecedores cron error:', error);
    }
  });

  console.log('📋 Prazo Fornecedores report cron job started (checks every minute, respects Brazil timezone)');

  // Cortes de Pedidos Report Cron Job - runs every minute and checks configured schedule time
  let lastCortesSendMinute = -1;

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_cortes_schedule_time');

      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      if (!scheduleTime) return;

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastCortesSendMinute !== currentMinuteKey) {
        lastCortesSendMinute = currentMinuteKey;

        console.log(`⏰ [CORTES CRON] Horário de envio: ${scheduleTime} (Brasil)`);

        const { OracleService } = await import('./services/oracle.service');
        const { MappingService } = await import('./services/mapping.service');
        const { CortesPDFService } = await import('./services/cortes-pdf.service');
        const { WhatsAppService } = await import('./services/whatsapp.service');
        const fs = await import('fs');

        // Data de ontem
        const yesterdayBR = new Date(brDate);
        yesterdayBR.setDate(yesterdayBR.getDate() - 1);
        const year = yesterdayBR.getFullYear();
        const month = String(yesterdayBR.getMonth() + 1).padStart(2, '0');
        const day = String(yesterdayBR.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dateFormatted = `${day}/${month}/${year}`;

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

        const query = `
          SELECT
            p.${pedNumPedidoCol} as NUM_PEDIDO,
            p.${pedCodParceiroCol} as COD_FORNECEDOR,
            p.${pedValPedidoCol} as VAL_PEDIDO,
            f.${fornRazaoSocialCol} as DES_FORNECEDOR,
            f.${fornCnpjCol} as CNPJ,
            pp.${ppCodProdutoCol} as COD_PRODUTO,
            pr.${prDesProdutoCol} as DES_PRODUTO,
            pp.DES_UNIDADE,
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
          AND TRUNC(p.DTA_PEDIDO_CANCELADO) = TO_DATE(:dataCancelamento, 'YYYY-MM-DD')
          AND NVL(pp.${ppQtdRecebidaCol}, 0) < pp.${ppQtdPedidoCol}
          ORDER BY f.${fornRazaoSocialCol}, p.${pedNumPedidoCol}
        `;

        const oracleItems = await OracleService.query(query, { dataCancelamento: dateStr });

        if (oracleItems.length > 0) {
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

          const pdfPath = await CortesPDFService.generatePDF(dateFormatted, fornecedores);

          const sent = await WhatsAppService.sendCortesReport(
            pdfPath, dateFormatted, fornecedores.length, totalItens, valorTotalCorte
          );

          try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

          if (sent) {
            console.log(`✅ [CORTES CRON] ${totalItens} itens cortados de ${fornecedores.length} fornecedores enviados`);
          } else {
            console.error(`❌ [CORTES CRON] Falha ao enviar PDF de cortes`);
          }
        } else {
          console.log(`ℹ️ [CORTES CRON] Sem cortes para ${dateFormatted}`);
        }
      }
    } catch (error) {
      console.error('❌ Cortes cron error:', error);
    }
  });

  console.log('✂️ Cortes report cron job started (checks every minute, respects Brazil timezone)');

  // Pedidos em Atraso Report Cron Job - runs every minute and checks configured schedule time
  let lastAtrasosSendMinute = -1;

  cron.schedule('* * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const scheduleTime = await ConfigurationService.get('whatsapp_atrasos_schedule_time');

      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

      if (!scheduleTime) return;

      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastAtrasosSendMinute !== currentMinuteKey) {
        lastAtrasosSendMinute = currentMinuteKey;

        console.log(`⏰ [ATRASOS CRON] Horário de envio: ${scheduleTime} (Brasil)`);

        const { OracleService } = await import('./services/oracle.service');
        const { MappingService } = await import('./services/mapping.service');
        const { AtrasosPDFService } = await import('./services/atrasos-pdf.service');
        const { WhatsAppService } = await import('./services/whatsapp.service');
        const fs = await import('fs');

        const year = brDate.getFullYear();
        const month = String(brDate.getMonth() + 1).padStart(2, '0');
        const day = String(brDate.getDate()).padStart(2, '0');
        const dateFormatted = `${day}/${month}/${year}`;

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
            pp.DES_UNIDADE,
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

        if (oracleItems.length > 0) {
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

          const pdfPath = await AtrasosPDFService.generatePDF(dateFormatted, fornecedores);

          const sent = await WhatsAppService.sendAtrasosReport(
            pdfPath, dateFormatted, fornecedores.length, fornecedores.length, totalItens, valorTotalPendente
          );

          try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

          if (sent) {
            console.log(`✅ [ATRASOS CRON] ${totalItens} itens em atraso de ${fornecedores.length} fornecedores enviados`);
          } else {
            console.error(`❌ [ATRASOS CRON] Falha ao enviar PDF de atrasos`);
          }
        } else {
          console.log(`ℹ️ [ATRASOS CRON] Sem pedidos em atraso`);
        }
      }
    } catch (error) {
      console.error('❌ Atrasos cron error:', error);
    }
  });

  console.log('⏰ Atrasos report cron job started (checks every minute, respects Brazil timezone)');

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

  // ==========================================
  // CRON: Sync VectorStore do Garimpador (configurável via tela de IA)
  // Verifica a cada hora se é o momento de sincronizar
  // ==========================================
  let vectorStoreLastSyncDate = '';
  cron.schedule('0 * * * *', async () => {
    try {
      const { ConfigurationService } = await import('./services/configuration.service');
      const freq = await ConfigurationService.get('vectorstore_sync_freq') || 'semanal';
      const diaConfig = parseInt(await ConfigurationService.get('vectorstore_sync_dia') || '1');
      const horaConfig = parseInt(await ConfigurationService.get('vectorstore_sync_hora') || '6');

      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hora = now.getHours();
      const diaSemana = now.getDay(); // 0=dom, 1=seg...
      const diaMes = now.getDate();
      const hoje = now.toISOString().split('T')[0];

      if (hora !== horaConfig) return;
      if (vectorStoreLastSyncDate === hoje) return; // já sincronizou hoje

      let deveSync = false;
      if (freq === 'diario') deveSync = true;
      else if (freq === 'semanal') deveSync = (diaSemana === diaConfig);
      else if (freq === 'mensal') deveSync = (diaMes === diaConfig);

      if (deveSync) {
        vectorStoreLastSyncDate = hoje;
        console.log(`🔄 [VectorStore] Sync ${freq} iniciado (config: dia=${diaConfig}, hora=${horaConfig}h)...`);
        const { GarimpadorVectorStoreService } = await import('./services/garimpador-vectorstore.service');
        await GarimpadorVectorStoreService.sincronizar();
        console.log('✅ [VectorStore] Sync concluído');
      }
    } catch (error) {
      console.error('❌ [VectorStore] Sync erro:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });
  console.log('📦 VectorStore sync cron job started (configurable schedule)');

  // Disparo WhatsApp - atualizar scores de contatos diariamente às 3h
  cron.schedule('0 3 * * *', async () => {
    try {
      const { DisparoWhatsAppService } = await import('./services/disparo-whatsapp.service');
      await DisparoWhatsAppService.updateContactScores();
    } catch (error) {
      console.error('❌ [DISPARO] Erro ao atualizar scores:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });
  console.log('📊 Disparo WhatsApp score cron started (daily 3AM)');
};

startServer();
