import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class SystemController {
  /**
   * Gera um token aleatório seguro
   */
  private static generateRandomToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Caminho do arquivo .env
   */
  private static getEnvPath(): string {
    return path.join(__dirname, '../../.env');
  }

  /**
   * Lê o arquivo .env e retorna o conteúdo
   */
  private static readEnvFile(): string {
    const envPath = this.getEnvPath();
    if (!fs.existsSync(envPath)) {
      throw new Error('Arquivo .env não encontrado');
    }
    return fs.readFileSync(envPath, 'utf-8');
  }

  /**
   * Atualiza o arquivo .env com novo token
   */
  private static updateEnvFile(newToken: string): void {
    const envPath = this.getEnvPath();
    let envContent = this.readEnvFile();

    // Substituir token existente ou adicionar se não existir
    if (envContent.includes('API_TOKEN=')) {
      envContent = envContent.replace(/API_TOKEN=.*/g, `API_TOKEN=${newToken}`);
    } else {
      envContent += `\nAPI_TOKEN=${newToken}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Atualizar variável de ambiente em tempo de execução
    process.env.API_TOKEN = newToken;
  }

  /**
   * GET /api/system/token
   * Retorna o token atual (apenas para admins)
   */
  static async getToken(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se é admin (você pode adicionar verificação de role aqui)
      const currentToken = process.env.API_TOKEN || '';

      if (!currentToken) {
        res.status(404).json({
          error: 'Token não configurado'
        });
        return;
      }

      res.json({
        token: currentToken,
        message: 'Token atual recuperado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao buscar token:', error);
      res.status(500).json({
        error: 'Erro ao buscar token',
        details: error.message
      });
    }
  }

  /**
   * POST /api/system/token/generate
   * Gera e atualiza automaticamente um novo token
   */
  static async generateToken(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se é admin (você pode adicionar verificação de role aqui)

      const newToken = this.generateRandomToken();
      const oldToken = process.env.API_TOKEN;

      // Atualizar arquivo .env
      this.updateEnvFile(newToken);

      console.log('✅ Token atualizado com sucesso');
      console.log(`   Token antigo: ${oldToken}`);
      console.log(`   Token novo: ${newToken}`);

      res.json({
        message: 'Novo token gerado e atualizado com sucesso',
        token: newToken,
        warning: 'IMPORTANTE: Você precisa reconfigurar todos os scanners com o novo token!'
      });
    } catch (error: any) {
      console.error('❌ Erro ao gerar token:', error);
      res.status(500).json({
        error: 'Erro ao gerar token',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/system/token
   * Atualiza o token com um valor específico fornecido
   */
  static async updateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        res.status(400).json({
          error: 'Token inválido. Forneça um token válido no corpo da requisição.'
        });
        return;
      }

      const oldToken = process.env.API_TOKEN;

      // Atualizar arquivo .env
      this.updateEnvFile(token.trim());

      console.log('✅ Token atualizado com sucesso');
      console.log(`   Token antigo: ${oldToken}`);
      console.log(`   Token novo: ${token.trim()}`);

      res.json({
        message: 'Token atualizado com sucesso',
        token: token.trim(),
        warning: 'IMPORTANTE: Você precisa reconfigurar todos os scanners com o novo token!'
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar token:', error);
      res.status(500).json({
        error: 'Erro ao atualizar token',
        details: error.message
      });
    }
  }
}
