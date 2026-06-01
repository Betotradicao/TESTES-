/**
 * 🔍 Controller para Monitor de Email DVR
 */

import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const DVREmailMonitor = require('../services/dvr-email-monitor');

let monitorInstance: any = null;

/**
 * Obter configuração do DVR do banco
 */
async function obterConfigDVR() {
  const configRepository = AppDataSource.getRepository(Configuration);

  const configs = await configRepository.find({
    where: [
      { key: 'dvr_ip' },
      { key: 'dvr_usuario' },
      { key: 'dvr_senha' },
      { key: 'dvr_monitor_intervalo' },
      { key: 'dvr_email_senha' }
    ]
  });

  const configMap: any = {};
  configs.forEach(c => {
    configMap[c.key] = c.value;
  });

  return {
    dvr: {
      ip: configMap.dvr_ip || '',
      usuario: configMap.dvr_usuario || 'admin',
      senha: configMap.dvr_senha || ''
    },
    intervaloMinutos: parseInt(configMap.dvr_monitor_intervalo || '360'),
    emailSenha: configMap.dvr_email_senha || ''
  };
}

/**
 * Salvar configuração no banco
 */
async function salvarConfig(key: string, value: string, descricao?: string) {
  const configRepository = AppDataSource.getRepository(Configuration);

  let config = await configRepository.findOne({ where: { key } });

  if (config) {
    config.value = value;
    config.updated_at = new Date();
  } else {
    config = configRepository.create({
      key,
      value,
      encrypted: false
    });
  }

  await configRepository.save(config);
}

/**
 * Testar conexão com DVR
 */
export async function testarConexaoDVR(req: Request, res: Response) {
  try {
    const { ip, usuario, senha } = req.body;

    if (!ip || !usuario || !senha) {
      return res.status(400).json({
        error: 'IP, usuário e senha são obrigatórios'
      });
    }

    // Testar conexão via curl
    const url = `http://${ip}/cgi-bin/magicBox.cgi?action=getSystemInfo`;
    const cmd = `curl -u "${usuario}:${senha}" --digest --connect-timeout 5 "${url}" 2>nul`;

    try {
      const { stdout } = await execPromise(cmd);

      if (stdout.includes('processor') || stdout.includes('serialNumber')) {
        res.json({
          success: true,
          message: 'Conexão bem-sucedida!',
          info: stdout
        });
      } else {
        res.status(400).json({
          error: 'DVR respondeu mas dados inválidos',
          details: stdout
        });
      }
    } catch (error: any) {
      res.status(500).json({
        error: 'Falha ao conectar no DVR',
        details: error.message
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao testar conexão',
      details: error.message
    });
  }
}

/**
 * Obter configurações atuais do DVR
 */
export async function obterConfiguracao(req: Request, res: Response) {
  try {
    const config = await obterConfigDVR();

    res.json({
      ip: config.dvr.ip,
      usuario: config.dvr.usuario,
      // Não retornar senha por segurança
      intervaloMinutos: config.intervaloMinutos,
      temSenhaEmail: !!config.emailSenha
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter configuração',
      details: error.message
    });
  }
}

/**
 * Iniciar monitor
 */
export async function iniciarMonitor(req: Request, res: Response) {
  try {
    if (monitorInstance && monitorInstance.enabled) {
      return res.status(400).json({
        error: 'Monitor já está em execução'
      });
    }

    // Obter configurações do DVR do banco
    const configDVR = await obterConfigDVR();

    // Criar instância do monitor
    monitorInstance = new DVREmailMonitor({
      dvr: configDVR.dvr,
      intervaloMinutos: configDVR.intervaloMinutos || 5
    });

    // Iniciar em background
    monitorInstance.iniciar().catch(console.error);

    res.json({
      success: true,
      message: 'Monitor iniciado com sucesso',
      config: {
        intervaloMinutos: monitorInstance.intervaloMinutos,
        dvr: {
          ip: monitorInstance.dvr.ip
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao iniciar monitor',
      details: error.message
    });
  }
}

/**
 * Parar monitor
 */
export async function pararMonitor(req: Request, res: Response) {
  try {
    if (!monitorInstance || !monitorInstance.enabled) {
      return res.status(400).json({
        error: 'Monitor não está em execução'
      });
    }

    monitorInstance.parar();

    res.json({
      success: true,
      message: 'Monitor parado com sucesso'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao parar monitor',
      details: error.message
    });
  }
}

/**
 * Obter status e estatísticas do monitor
 */
export async function statusMonitor(req: Request, res: Response) {
  try {
    if (!monitorInstance) {
      return res.json({
        ativo: false,
        message: 'Monitor nunca foi iniciado'
      });
    }

    const stats = monitorInstance.getEstatisticas();

    res.json({
      ativo: stats.enabled,
      intervaloMinutos: stats.intervaloMinutos,
      ultimaVerificacao: stats.ultimaVerificacao,
      totalVerificacoes: stats.totalVerificacoes,
      totalCorrecoes: stats.totalCorrecoes,
      ultimaCorrecao: stats.ultimaCorrecao,
      dvr: stats.dvr
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter status',
      details: error.message
    });
  }
}

/**
 * Forçar verificação manual
 */
export async function verificarAgora(req: Request, res: Response) {
  try {
    if (!monitorInstance) {
      return res.status(400).json({
        error: 'Monitor não está inicializado. Inicie o monitor primeiro.'
      });
    }

    // Executar verificação imediata
    await monitorInstance.verificarESalvar();

    const stats = monitorInstance.getEstatisticas();

    res.json({
      success: true,
      message: 'Verificação manual concluída',
      ultimaVerificacao: stats.ultimaVerificacao,
      totalCorrecoes: stats.totalCorrecoes
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao verificar',
      details: error.message
    });
  }
}

/**
 * Salvar configuração de senha do Gmail
 */
export async function salvarSenhaGmail(req: Request, res: Response) {
  try {
    const { senha } = req.body;

    if (!senha) {
      return res.status(400).json({
        error: 'Senha é obrigatória'
      });
    }

    // Salvar no banco
    await salvarConfig('dvr_email_senha', senha, 'Senha correta do Gmail para DVR Intelbras');

    res.json({
      success: true,
      message: 'Senha salva com sucesso'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao salvar senha',
      details: error.message
    });
  }
}

/**
 * Salvar configurações do DVR
 */
export async function salvarConfigDVR(req: Request, res: Response) {
  try {
    const { ip, usuario, senha, intervaloMinutos } = req.body;

    if (!ip || !usuario || !senha) {
      return res.status(400).json({
        error: 'IP, usuário e senha são obrigatórios'
      });
    }

    // Salvar todas as configurações
    await salvarConfig('dvr_ip', ip, 'IP do DVR Intelbras');
    await salvarConfig('dvr_usuario', usuario, 'Usuário do DVR');
    await salvarConfig('dvr_senha', senha, 'Senha do DVR');
    await salvarConfig('dvr_monitor_intervalo', intervaloMinutos.toString(), 'Intervalo de verificação em minutos');

    res.json({
      success: true,
      message: 'Configurações salvas com sucesso'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao salvar configurações',
      details: error.message
    });
  }
}

/**
 * Obter stream da câmera
 * Converte RTSP para formato web-compatível (MJPEG snapshot)
 */
export async function getCameraStream(req: Request, res: Response) {
  try {
    const { cameraId, rtspUrl } = req.body;

    if (!cameraId || !rtspUrl) {
      return res.status(400).json({
        error: 'cameraId e rtspUrl são obrigatórios'
      });
    }

    // Obter configurações do DVR
    const configDVR = await obterConfigDVR();

    if (!configDVR.dvr.ip) {
      return res.status(400).json({
        error: 'DVR não configurado. Configure o DVR nas Configurações primeiro.'
      });
    }

    // Para Intelbras, usar snapshot HTTP ao invés de RTSP streaming
    // URL snapshot: http://IP/cgi-bin/snapshot.cgi?channel=X
    const snapshotUrl = `http://${configDVR.dvr.ip}/cgi-bin/snapshot.cgi?channel=${cameraId}`;

    res.json({
      success: true,
      streamUrl: snapshotUrl,
      type: 'snapshot',
      message: 'Use esta URL com refresh periódico para simular stream'
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter stream da câmera',
      details: error.message
    });
  }
}
