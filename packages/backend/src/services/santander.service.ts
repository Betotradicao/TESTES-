import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationService } from './configuration.service';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface SantanderConfig {
  clientId: string;
  clientSecret: string;
  pfxPassword: string;
  branchCode: string;
  accountNumber: string;
  environment: string;
}

export class SantanderService {
  private static tokenCache: TokenCache | null = null;
  private static axiosInstance: AxiosInstance | null = null;
  private static configCache: SantanderConfig | null = null;
  private static configCacheTime: number = 0;

  /**
   * Carrega configurações do banco
   */
  private static async getConfig(): Promise<SantanderConfig> {
    // Cache de 5 min para não ficar lendo do banco toda hora
    if (this.configCache && Date.now() - this.configCacheTime < 300000) {
      return this.configCache;
    }

    const clientId = await ConfigurationService.get('santander_client_id', '');
    const clientSecret = await ConfigurationService.get('santander_client_secret', '');
    const pfxPassword = await ConfigurationService.get('santander_pfx_password', '');
    const branchCode = await ConfigurationService.get('santander_branch_code', '3310');
    const accountNumber = await ConfigurationService.get('santander_account_number', '000130075973');
    const environment = await ConfigurationService.get('santander_environment', 'production');

    if (!clientId || !clientSecret) {
      throw new Error('Configurações do Santander não encontradas. Configure client_id e client_secret em Configurações.');
    }

    this.configCache = {
      clientId: clientId!,
      clientSecret: clientSecret!,
      pfxPassword: pfxPassword || '',
      branchCode: branchCode || '3310',
      accountNumber: accountNumber || '000130075973',
      environment: environment || 'production'
    };
    this.configCacheTime = Date.now();

    return this.configCache;
  }

  /**
   * Retorna a base URL conforme o ambiente
   */
  private static getBaseUrl(environment: string): string {
    return environment === 'sandbox'
      ? 'https://trust-sandbox.api.santander.com.br'
      : 'https://trust-open.api.santander.com.br';
  }

  /**
   * Carrega o PFX e cria o httpsAgent para mTLS
   */
  private static getPfxBuffer(): Buffer {
    // Tentar vários caminhos possíveis para o PFX
    const possiblePaths = [
      path.join(process.cwd(), 'certificates', 'santander.pfx'),
      path.join(__dirname, '..', '..', 'certificates', 'santander.pfx'),
      '/app/certificates/santander.pfx',
    ];

    for (const pfxPath of possiblePaths) {
      if (fs.existsSync(pfxPath)) {
        return fs.readFileSync(pfxPath);
      }
    }

    throw new Error(
      `Certificado PFX do Santander não encontrado. Caminhos verificados: ${possiblePaths.join(', ')}`
    );
  }

  /**
   * Cria o httpsAgent com mTLS (PFX)
   */
  private static createHttpsAgent(pfxPassword: string): https.Agent {
    const pfxBuffer = this.getPfxBuffer();
    return new https.Agent({
      pfx: pfxBuffer,
      passphrase: pfxPassword,
      rejectUnauthorized: true
    });
  }

  /**
   * Obtém ou renova o token OAuth 2.0
   */
  static async getToken(): Promise<string> {
    // Se token em cache e não expirado (com margem de 60s)
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60000) {
      return this.tokenCache.token;
    }

    const config = await this.getConfig();
    const baseUrl = this.getBaseUrl(config.environment);
    const agent = this.createHttpsAgent(config.pfxPassword);

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);

    const response = await axios.post(
      `${baseUrl}/auth/oauth/v2/token`,
      params.toString(),
      {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;

    this.tokenCache = {
      token: access_token,
      expiresAt: Date.now() + (expires_in * 1000)
    };

    // Resetar axios instance para usar novo token
    this.axiosInstance = null;

    console.log(`[Santander] Token obtido com sucesso (expira em ${expires_in}s)`);
    return access_token;
  }

  /**
   * Retorna uma instância axios configurada com mTLS + token
   */
  private static async getAxiosInstance(): Promise<AxiosInstance> {
    const config = await this.getConfig();
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl(config.environment);
    const agent = this.createHttpsAgent(config.pfxPassword);

    this.axiosInstance = axios.create({
      baseURL: `${baseUrl}/bank_account_information/v1`,
      httpsAgent: agent,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Application-Key': config.clientId
      }
    });

    return this.axiosInstance;
  }

  /**
   * Retorna o accountId no formato AGENCIA.CONTA (4dig.12dig)
   */
  private static async getAccountId(): Promise<string> {
    const config = await this.getConfig();
    return `${config.branchCode}.${config.accountNumber}`;
  }

  /**
   * Consulta saldo da conta
   */
  static async getBalance(): Promise<any> {
    const api = await this.getAxiosInstance();
    const accountId = await this.getAccountId();
    const response = await api.get(`/banks/90400888000142/balances/${accountId}`);
    return response.data;
  }

  /**
   * Consulta extrato (statements) - até 50 por página
   */
  static async getStatements(
    initialDate: string,
    finalDate: string,
    limit: number = 50,
    offset: number = 1
  ): Promise<any> {
    const api = await this.getAxiosInstance();
    const accountId = await this.getAccountId();
    const response = await api.get(`/banks/90400888000142/statements/${accountId}`, {
      params: {
        initialDate,
        finalDate,
        _limit: limit,
        _offset: offset
      }
    });
    return response.data;
  }

  /**
   * Consulta transações efetivas (big volume) - até 750 por página
   */
  static async getTransactions(
    initialDate: string,
    finalDate: string,
    limit: number = 750,
    nextPage?: string
  ): Promise<any> {
    const api = await this.getAxiosInstance();
    const accountId = await this.getAccountId();
    const params: any = {
      initialDate,
      finalDate,
      _limit: limit
    };
    if (nextPage) {
      params._nextPage = nextPage;
    }
    const response = await api.get(`/transactions/${accountId}`, { params });
    return response.data;
  }

  /**
   * Consulta lançamentos provisionados - até 750 por página
   */
  static async getProvisioneds(
    initialDate: string,
    finalDate: string,
    limit: number = 750,
    nextPage?: string
  ): Promise<any> {
    const api = await this.getAxiosInstance();
    const accountId = await this.getAccountId();
    const params: any = {
      initialDate,
      finalDate,
      _limit: limit
    };
    if (nextPage) {
      params._nextPage = nextPage;
    }
    const response = await api.get(`/provisioneds/${accountId}`, { params });
    return response.data;
  }

  /**
   * Testa conexão com a API
   */
  static async testConnection(): Promise<{ success: boolean; message: string; balance?: any }> {
    try {
      const balance = await this.getBalance();
      return {
        success: true,
        message: `Conexão OK. Saldo disponível: R$ ${balance.availableAmount}`,
        balance
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
      branchCode: config.branchCode,
      accountNumber: config.accountNumber,
      environment: config.environment,
      hasCertificate: (() => {
        try { this.getPfxBuffer(); return true; } catch { return false; }
      })()
    };
  }

  /**
   * Limpa todos os caches (útil após trocar configurações)
   */
  static clearCache(): void {
    this.tokenCache = null;
    this.axiosInstance = null;
    this.configCache = null;
    this.configCacheTime = 0;
  }
}
