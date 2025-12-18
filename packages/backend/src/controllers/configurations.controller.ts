import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import { ConfigurationService } from '../services/configuration.service';

const configRepository = AppDataSource.getRepository(Configuration);

export class ConfigurationsController {
  /**
   * GET /api/configurations
   * Buscar todas as configurações
   */
  async index(req: Request, res: Response) {
    try {
      const configurations = await configRepository.find();

      // Converter para objeto chave-valor para facilitar uso no frontend
      const configMap: Record<string, string | null> = {};
      configurations.forEach(config => {
        configMap[config.key] = config.value;
      });

      return res.json(configMap);
    } catch (error) {
      console.error('Error fetching configurations:', error);
      return res.status(500).json({ error: 'Failed to fetch configurations' });
    }
  }

  /**
   * GET /api/configurations/:key
   * Buscar configuração específica por chave
   */
  async show(req: Request, res: Response) {
    try {
      const { key } = req.params;

      const configuration = await configRepository.findOne({
        where: { key }
      });

      if (!configuration) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      return res.json(configuration);
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  }

  /**
   * PUT /api/configurations/:key
   * Atualizar configuração específica
   */
  async update(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!value) {
        return res.status(400).json({ error: 'Value is required' });
      }

      let configuration = await configRepository.findOne({
        where: { key }
      });

      if (!configuration) {
        // Criar se não existir
        configuration = configRepository.create({ key, value });
      } else {
        configuration.value = value;
      }

      await configRepository.save(configuration);

      return res.json(configuration);
    } catch (error) {
      console.error('Error updating configuration:', error);
      return res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * GET /api/configurations/email
   * Buscar configurações de email (do banco de dados)
   */
  async getEmailConfig(req: Request, res: Response) {
    try {
      const emailUser = await ConfigurationService.get('email_user', process.env.EMAIL_USER || '');
      const emailPass = await ConfigurationService.get('email_pass', process.env.EMAIL_PASS || '');

      return res.json({
        email_user: emailUser,
        email_pass: emailPass
      });
    } catch (error) {
      console.error('Error fetching email configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch email configuration' });
    }
  }

  /**
   * PUT /api/configurations/email
   * Atualizar configurações de email (salva no banco de dados)
   */
  async updateEmailConfig(req: Request, res: Response) {
    try {
      const { email_user, email_pass } = req.body;

      if (!email_user || !email_pass) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Salvar no banco de dados
      await ConfigurationService.set('email_user', email_user);
      await ConfigurationService.set('email_pass', email_pass);

      // Atualizar variáveis de ambiente em memória
      process.env.EMAIL_USER = email_user;
      process.env.EMAIL_PASS = email_pass;

      return res.json({
        message: 'Configurações de email atualizadas com sucesso',
        email_user,
        email_pass: '***' // Não retornar a senha real
      });
    } catch (error) {
      console.error('Error updating email configuration:', error);
      return res.status(500).json({ error: 'Failed to update email configuration' });
    }
  }
}
