"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const database_1 = require("./config/database");
const swagger_1 = require("./config/swagger");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const bips_routes_1 = __importDefault(require("./routes/bips.routes"));
const bipages_routes_1 = __importDefault(require("./routes/bipages.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const sales_routes_1 = __importDefault(require("./routes/sales.routes"));
const sells_routes_1 = __importDefault(require("./routes/sells.routes"));
const sectors_routes_1 = __importDefault(require("./routes/sectors.routes"));
const equipments_routes_1 = __importDefault(require("./routes/equipments.routes"));
const employees_routes_1 = __importDefault(require("./routes/employees.routes"));
const equipment_sessions_routes_1 = __importDefault(require("./routes/equipment-sessions.routes"));
const config_routes_1 = __importDefault(require("./routes/config.routes"));
const companies_routes_1 = __importDefault(require("./routes/companies.routes"));
const system_routes_1 = __importDefault(require("./routes/system.routes"));
const setup_routes_1 = __importDefault(require("./routes/setup.routes"));
const password_recovery_routes_1 = __importDefault(require("./routes/password-recovery.routes"));
const configurations_routes_1 = __importDefault(require("./routes/configurations.routes"));
const email_monitor_routes_1 = __importDefault(require("./routes/email-monitor.routes"));
const suspect_identifications_routes_1 = __importDefault(require("./routes/suspect-identifications.routes"));
const minio_service_1 = require("./services/minio.service");
const email_monitor_service_1 = require("./services/email-monitor.service");
const cron = __importStar(require("node-cron"));
// import { checkSetupMiddleware } from './middleware/check-setup.middleware';
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Configuração CORS para permitir acesso via Ngrok e rede local
app.use((0, cors_1.default)({
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
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger_1.swaggerSpec);
});
// Rotas públicas (setup precisa estar disponível antes do login)
app.use('/api/setup', setup_routes_1.default);
app.use('/api/password-recovery', password_recovery_routes_1.default);
// Rotas protegidas
app.use('/api', health_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/bips', bips_routes_1.default);
app.use('/api/bipagens', bipages_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/sales', sales_routes_1.default);
app.use('/api/sells', sells_routes_1.default);
app.use('/api/sectors', sectors_routes_1.default);
app.use('/api/equipments', equipments_routes_1.default);
app.use('/api/employees', employees_routes_1.default);
app.use('/api/equipment-sessions', equipment_sessions_routes_1.default);
app.use('/api/config', config_routes_1.default);
app.use('/api/companies', companies_routes_1.default);
app.use('/api/system', system_routes_1.default);
app.use('/api/configurations', configurations_routes_1.default);
app.use('/api/email-monitor', email_monitor_routes_1.default);
app.use('/api/suspect-identifications', suspect_identifications_routes_1.default);
// app.use('/api/user-security', userSecurityRouter);
const startServer = async () => {
    try {
        await database_1.AppDataSource.initialize();
        console.log('✅ Database connected successfully');
        // Seed do usuário master (DESABILITADO - usar first-setup)
        // await seedMasterUser(AppDataSource);
        // Health check automático para manter conexão viva
        // Executa a cada 20 segundos
        setInterval(async () => {
            try {
                await database_1.AppDataSource.query('SELECT 1');
                console.log('🔄 Database connection alive');
            }
            catch (error) {
                console.error('❌ Database connection lost, attempting to reconnect...');
                try {
                    if (!database_1.AppDataSource.isInitialized) {
                        await database_1.AppDataSource.initialize();
                        console.log('✅ Database reconnected successfully');
                    }
                }
                catch (reconnectError) {
                    console.error('❌ Failed to reconnect:', reconnectError);
                }
            }
        }, 20000); // 20 segundos
    }
    catch (error) {
        console.warn('⚠️ Database connection failed:', error);
        console.log('Starting server without database connection...');
        // Tentar reconectar a cada 30 segundos
        setInterval(async () => {
            if (!database_1.AppDataSource.isInitialized) {
                try {
                    console.log('🔄 Attempting to connect to database...');
                    await database_1.AppDataSource.initialize();
                    console.log('✅ Database connected successfully');
                }
                catch (retryError) {
                    console.error('❌ Retry failed:', retryError?.message || retryError);
                }
            }
        }, 30000);
    }
    // Initialize MinIO bucket
    try {
        await minio_service_1.minioService.ensureBucketExists();
        console.log('✅ MinIO initialized successfully');
    }
    catch (error) {
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
            await email_monitor_service_1.EmailMonitorService.checkNewEmails();
        }
        catch (error) {
            console.error('❌ Email monitor cron error:', error);
        }
    });
    console.log('📧 Email monitor cron job started (every 30 seconds)');
};
startServer();
//# sourceMappingURL=index.js.map