import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';

const router: Router = Router();
const configController = new ConfigController();

/**
 * @swagger
 * /api/config/test-database:
 *   post:
 *     summary: Testa a conexão com banco de dados PostgreSQL
 *     description: Verifica se é possível conectar ao banco de dados com as credenciais fornecidas
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               host:
 *                 type: string
 *                 example: localhost
 *               port:
 *                 type: string
 *                 example: "5432"
 *               username:
 *                 type: string
 *                 example: postgres
 *               password:
 *                 type: string
 *                 example: admin123
 *               databaseName:
 *                 type: string
 *                 example: market_security
 *     responses:
 *       200:
 *         description: Conexão testada com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro ao conectar ao banco de dados
 */
router.post('/test-database', (req, res) => configController.testDatabaseConnection(req, res));

/**
 * @swagger
 * /api/config/test-minio:
 *   post:
 *     summary: Testa a conexão com MinIO
 *     description: Verifica se é possível conectar ao MinIO com as credenciais fornecidas
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoint:
 *                 type: string
 *                 example: localhost
 *               port:
 *                 type: string
 *                 example: "9000"
 *               accessKey:
 *                 type: string
 *                 example: minioadmin
 *               secretKey:
 *                 type: string
 *                 example: minioadmin123
 *               useSSL:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Conexão testada com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro ao conectar ao MinIO
 */
router.post('/test-minio', (req, res) => configController.testMinioConnection(req, res));

/**
 * @swagger
 * /api/config/test-intersolid:
 *   post:
 *     summary: Testa a conexão com API Intersolid
 *     description: Verifica se é possível conectar à API Intersolid e buscar vendas
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               apiUrl:
 *                 type: string
 *                 example: http://10.6.1.101
 *               port:
 *                 type: string
 *                 example: "3003"
 *               username:
 *                 type: string
 *                 example: ROBERTO
 *               password:
 *                 type: string
 *                 example: senha123
 *               salesEndpoint:
 *                 type: string
 *                 example: /v1/vendas
 *     responses:
 *       200:
 *         description: Conexão testada com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro ao conectar à API
 */
router.post('/test-intersolid', (req, res) => configController.testIntersolidConnection(req, res));

/**
 * @swagger
 * /api/config/configurations:
 *   get:
 *     summary: Busca todas as configurações salvas
 *     description: Retorna todas as configurações do sistema
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Configurações recuperadas com sucesso
 *       500:
 *         description: Erro ao buscar configurações
 */
router.get('/configurations', (req, res) => configController.getConfigurations(req, res));

/**
 * @swagger
 * /api/config/configurations:
 *   post:
 *     summary: Salva as configurações do sistema
 *     description: Salva ou atualiza as configurações (senhas são criptografadas automaticamente)
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *             example:
 *               intersolid_api_url: http://10.6.1.100
 *               database_host: localhost
 *               database_password: admin123
 *     responses:
 *       200:
 *         description: Configurações salvas com sucesso
 *       400:
 *         description: Configurações inválidas
 *       500:
 *         description: Erro ao salvar configurações
 */
router.post('/configurations', (req, res) => configController.saveConfigurations(req, res));

// Teste de conexão OpenAI
router.post('/test-openai', (req, res) => configController.testOpenAIConnection(req, res));

export default router;
