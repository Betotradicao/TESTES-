import { Response } from 'express';
import { AppDataSource } from '../config/database';

/**
 * Utilitário para tratar erros de banco de dados
 * Detecta problemas de conexão e tenta reconectar automaticamente
 */
export class DatabaseErrorHandler {
  /**
   * Verifica se o erro é relacionado à conexão do banco
   */
  static isConnectionError(error: any): boolean {
    const connectionErrors = [
      'Connection terminated',
      'Connection terminated unexpectedly',
      'connection to server',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'the database system is shutting down',
      'the database system is starting up',
      'no pg_hba.conf entry',
      'password authentication failed',
      'Connection pool is empty',
    ];

    const errorMessage = error?.message || error?.toString() || '';
    return connectionErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * Tenta reconectar ao banco de dados
   */
  static async tryReconnect(): Promise<boolean> {
    try {
      if (!AppDataSource.isInitialized) {
        console.log('🔄 Tentando reconectar ao banco de dados...');
        await AppDataSource.initialize();
        console.log('✅ Reconexão bem-sucedida!');
        return true;
      }
      return true;
    } catch (error) {
      console.error('❌ Falha na reconexão:', error);
      return false;
    }
  }

  /**
   * Manipula erros de banco de dados em controllers
   */
  static async handleError(error: any, res: Response, customMessage?: string): Promise<void> {
    console.error('Erro no banco de dados:', error);

    // Se for erro de conexão, tentar reconectar
    if (this.isConnectionError(error)) {
      console.error('⚠️ Erro de conexão detectado!');

      const reconnected = await this.tryReconnect();

      if (reconnected) {
        res.status(503).json({
          error: 'Conexão com o banco de dados foi perdida e restaurada. Por favor, tente novamente.',
          code: 'DB_CONNECTION_RESTORED',
          retry: true,
        });
      } else {
        res.status(503).json({
          error: 'Não foi possível conectar ao banco de dados. Por favor, tente novamente em alguns instantes.',
          code: 'DB_CONNECTION_FAILED',
          retry: true,
        });
      }
      return;
    }

    // Outros erros de banco
    res.status(500).json({
      error: customMessage || 'Erro ao processar requisição',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  /**
   * Wrapper para executar queries com retry automático
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (this.isConnectionError(error) && attempt < maxRetries) {
          console.log(`⚠️ Tentativa ${attempt} falhou, reconectando...`);
          await this.tryReconnect();
          // Aguarda um pouco antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }
}
