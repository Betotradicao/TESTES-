import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { ConfigurationService } from './configuration.service';

interface Banco24hConfig {
  userId: string;
  cnpjRaiz: string;
  lojaCode: number;
  environment: string;
  pfxPassword: string;
}

interface DepositoResult {
  loja: number;
  atm: number;
  nomeATM: string;
  nsuTransacao: number;
  dataHoraTransacao: string;
  identicacao: string;
  codMoeda: string;
  valor: number;
  valorDigitado: number | null;
  situacao: string;
  dataRegularizacao: string | null;
  banco: number;
  agencia: number;
  conta: number;
  cnpjFavorecido: string;
  nomeFavorecido: string;
  quantidadeCedulas: Array<{ denominacao: number; quantidade: number }>;
}

interface DepositosResponse {
  metadados: {
    urlBase: string;
    contexto: string;
    limite: number;
    inicio: number;
    tamanho: number;
    proxima: string | null;
  };
  resultados: DepositoResult[];
}

export class Banco24horasService {
  private static configCache: Banco24hConfig | null = null;
  private static configCacheTime: number = 0;
  private static privateKeyCache: string | null = null;

  private static async getConfig(): Promise<Banco24hConfig> {
    if (this.configCache && Date.now() - this.configCacheTime < 300000) {
      return this.configCache;
    }

    const userId = await ConfigurationService.get('banco24h_user_id', '');
    const cnpjRaiz = await ConfigurationService.get('banco24h_cnpj_raiz', '');
    const lojaCode = await ConfigurationService.get('banco24h_loja_code', '');
    const environment = await ConfigurationService.get('banco24h_environment', 'production');
    const pfxPassword = await ConfigurationService.get('santander_pfx_password', '');

    if (!userId || !cnpjRaiz) {
      throw new Error('Configurações do Banco 24horas não encontradas. Configure user_id e cnpj_raiz em Configurações.');
    }

    this.configCache = {
      userId: userId!,
      cnpjRaiz: cnpjRaiz!,
      lojaCode: parseInt(lojaCode || '0'),
      environment: environment || 'production',
      pfxPassword: pfxPassword || ''
    };
    this.configCacheTime = Date.now();

    return this.configCache;
  }

  private static getBaseUrl(environment: string): string {
    return environment === 'sandbox'
      ? 'https://api.sandbox.partner.banco24horasvarejo.com.br'
      : 'https://api.partner.banco24horasvarejo.com.br';
  }

  /**
   * Carrega a chave privada do PFX do Santander (mesma usada no portal Banco 24h)
   */
  private static async getPrivateKey(): Promise<string> {
    if (this.privateKeyCache) {
      return this.privateKeyCache;
    }

    // Primeiro tentar a chave já extraída
    const extractedKeyPaths = [
      path.join(process.cwd(), 'certificates', 'santander-private.key'),
      path.join(__dirname, '..', '..', 'certificates', 'santander-private.key'),
      '/app/certificates/santander-private.key',
    ];

    for (const keyPath of extractedKeyPaths) {
      if (fs.existsSync(keyPath)) {
        this.privateKeyCache = fs.readFileSync(keyPath, 'utf8');
        console.log(`[Banco24h] Chave privada carregada de: ${keyPath}`);
        return this.privateKeyCache;
      }
    }

    // Se não encontrou a key extraída, extrair do PFX
    const pfxPaths = [
      path.join(process.cwd(), 'certificates', 'santander.pfx'),
      path.join(__dirname, '..', '..', 'certificates', 'santander.pfx'),
      '/app/certificates/santander.pfx',
    ];

    const config = await this.getConfig();

    for (const pfxPath of pfxPaths) {
      if (fs.existsSync(pfxPath)) {
        try {
          const { execSync } = require('child_process');
          const outPath = pfxPath.replace('santander.pfx', 'santander-private.key');
          execSync(
            `openssl pkcs12 -in "${pfxPath}" -nocerts -nodes -passin pass:${config.pfxPassword} -out "${outPath}"`,
            { timeout: 10000 }
          );
          this.privateKeyCache = fs.readFileSync(outPath, 'utf8');
          console.log(`[Banco24h] Chave privada extraída do PFX: ${pfxPath}`);
          return this.privateKeyCache;
        } catch (err: any) {
          console.error(`[Banco24h] Erro ao extrair chave do PFX ${pfxPath}:`, err.message);
        }
      }
    }

    throw new Error(
      'Chave privada não encontrada. Verifique se santander-private.key ou santander.pfx está em certificates/'
    );
  }

  /**
   * Base64URL encode (sem padding)
   */
  private static base64url(data: string): string {
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  /**
   * Cria JWT assinado com RS256
   * Header: { alg: RS256, typ: JWT, userId: UUID }
   * Payload: corpo da requisição
   */
  private static async createJWT(payload: any): Promise<string> {
    const config = await this.getConfig();
    const privateKey = await this.getPrivateKey();

    const header = {
      alg: 'RS256',
      typ: 'JWT',
      userId: config.userId
    };

    const headerB64 = this.base64url(JSON.stringify(header));
    const payloadB64 = this.base64url(JSON.stringify(payload));
    const signInput = `${headerB64}.${payloadB64}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signInput);
    const signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Faz request POST para a API do Banco 24horas
   */
  private static async request(endpoint: string, payload: any): Promise<any> {
    const config = await this.getConfig();
    const baseUrl = this.getBaseUrl(config.environment);
    const token = await this.createJWT(payload);

    return new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}${endpoint}`);
      const bodyStr = JSON.stringify(payload);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Resposta inválida da API: ${data.substring(0, 200)}`));
            }
          } else {
            let errorMsg = `HTTP ${res.statusCode}`;
            try {
              const errorData = JSON.parse(data);
              errorMsg += `: ${errorData.message || JSON.stringify(errorData)}`;
            } catch {
              errorMsg += `: ${data.substring(0, 200)}`;
            }
            reject(new Error(errorMsg));
          }
        });
      });

      req.on('error', (err: Error) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout de 30s na API do Banco 24horas'));
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /**
   * Consulta depósitos em um período
   * Datas em formato ISO 8601 UTC: 2026-02-01T03:00:00Z
   */
  static async getDepositos(
    dataInicial: string,
    dataFinal: string,
    limite: number = 100,
    inicio: number = 0
  ): Promise<DepositosResponse> {
    const config = await this.getConfig();

    const payload: any = {
      dataHoraInicial: dataInicial,
      dataHoraFinal: dataFinal,
      cnpjRaizList: [config.cnpjRaiz]
    };

    if (config.lojaCode > 0) {
      payload.lojaList = [config.lojaCode];
    }

    // Paginação via query string na URL
    let endpoint = `/v2/transacao/consulta-depositos?limite=${limite}&inicio=${inicio}`;

    return this.request(endpoint, payload);
  }

  /**
   * Busca TODOS os depósitos de um período (com paginação automática)
   */
  static async getAllDepositos(
    dataInicial: string,
    dataFinal: string
  ): Promise<{ resultados: DepositoResult[]; totalRegistros: number }> {
    const LIMITE = 100;
    let inicio = 0;
    let allResults: DepositoResult[] = [];
    let hasMore = true;

    while (hasMore) {
      const response = await this.getDepositos(dataInicial, dataFinal, LIMITE, inicio);

      if (response.resultados && response.resultados.length > 0) {
        allResults = allResults.concat(response.resultados);
        inicio += LIMITE;

        // Se retornou menos que o limite, não tem mais páginas
        if (response.resultados.length < LIMITE || !response.metadados?.proxima) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Safety: máximo 50 páginas (5000 registros)
      if (inicio >= 5000) {
        console.warn('[Banco24h] Limite de segurança atingido: 5000 registros');
        hasMore = false;
      }
    }

    console.log(`[Banco24h] Total: ${allResults.length} depósitos de ${dataInicial} a ${dataFinal}`);

    return {
      resultados: allResults,
      totalRegistros: allResults.length
    };
  }

  /**
   * Testa conexão com a API
   */
  static async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Testar com período do último mês
      const hoje = new Date();
      const umMesAtras = new Date(hoje);
      umMesAtras.setMonth(umMesAtras.getMonth() - 1);

      const dataFinal = hoje.toISOString().replace(/\.\d{3}Z/, 'Z');
      const dataInicial = umMesAtras.toISOString().replace(/\.\d{3}Z/, 'Z');

      const response = await this.getDepositos(dataInicial, dataFinal, 5, 0);
      return {
        success: true,
        message: `Conexão OK. ${response.resultados?.length || 0} depósitos encontrados (amostra).`,
        data: response.metadados
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Erro na conexão: ${error.message}`
      };
    }
  }

  /**
   * Retorna config pública (sem secrets)
   */
  static async getPublicConfig(): Promise<any> {
    const config = await this.getConfig();
    return {
      userId: config.userId,
      cnpjRaiz: config.cnpjRaiz,
      lojaCode: config.lojaCode,
      environment: config.environment,
      hasPrivateKey: (() => {
        try {
          const paths = [
            path.join(process.cwd(), 'certificates', 'santander-private.key'),
            '/app/certificates/santander-private.key',
          ];
          return paths.some(p => fs.existsSync(p));
        } catch { return false; }
      })()
    };
  }

  static clearCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
    this.privateKeyCache = null;
  }
}
