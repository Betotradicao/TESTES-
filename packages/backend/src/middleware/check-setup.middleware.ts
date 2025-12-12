import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

/**
 * Middleware para verificar se o sistema foi configurado
 * Redireciona para setup se necessário
 */
export async function checkSetupMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Rotas que não precisam de verificação de setup
    const publicRoutes = [
      '/api/setup/status',
      '/api/setup/perform',
      '/api/setup/test-smtp',
      '/health'
    ];

    // Se for rota pública, passar adiante
    if (publicRoutes.some(route => req.path === route)) {
      next();
      return;
    }

    // Verificar se sistema foi configurado
    const result = await pool.query(
      'SELECT is_setup_completed FROM system_config LIMIT 1'
    );

    const isSetupCompleted = result.rows.length > 0
      ? result.rows[0].is_setup_completed
      : false;

    if (!isSetupCompleted) {
      res.status(403).json({
        error: 'Sistema não configurado',
        setupRequired: true,
        message: 'Configure o sistema antes de continuar'
      });
      return;
    }

    // Setup completo, continuar
    next();

  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({
      error: 'Erro ao verificar status de configuração'
    });
  }
}
