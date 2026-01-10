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
import { minioService } from './services/minio.service';
import { EmailMonitorService } from './services/email-monitor.service';
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
  });

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
      const scheduleTime = await ConfigurationService.get('whatsapp_bips_schedule_time', '08:00');

      // Converter horário do Brasil para comparação
      const now = new Date();
      const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const [configHours, configMinutes] = scheduleTime.split(':').map(Number);

      // Verificar se é o horário configurado (em horário do Brasil)
      const currentMinuteKey = brDate.getHours() * 60 + brDate.getMinutes();
      const scheduleMinuteKey = configHours * 60 + configMinutes;

      if (currentMinuteKey === scheduleMinuteKey && lastBipsSendMinute !== currentMinuteKey) {
        lastBipsSendMinute = currentMinuteKey;

        console.log(`⏰ Horário de envio de bipagens pendentes: ${scheduleTime} (Brasil)`);
        console.log(`📅 Horário atual (Brasil): ${brDate.toLocaleTimeString('pt-BR')}`);

        // Buscar bipagens do dia anterior
        const yesterday = new Date(brDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`📊 Buscando bipagens pendentes de ${dateStr}...`);

        const { AppDataSource } = await import('./config/database');
        const { Bip, BipStatus } = await import('./entities/Bip');
        const { IsNull, Between } = await import('typeorm');

        const bipRepository = AppDataSource.getRepository(Bip);
        const filterDate = new Date(dateStr);
        const startOfDay = new Date(filterDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const pendingBips = await bipRepository.find({
          where: {
            status: BipStatus.PENDING,
            notified_at: IsNull(),
            event_date: Between(startOfDay, endOfDay)
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
};

startServer();