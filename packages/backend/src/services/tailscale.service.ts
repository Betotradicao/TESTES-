import { exec } from 'child_process';
import { promisify } from 'util';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';

const execPromise = promisify(exec);

export class TailscaleService {
  /**
   * Obter configurações do Tailscale do banco
   */
  static async getConfig() {
    const configRepository = AppDataSource.getRepository(Configuration);

    const configs = await configRepository.find({
      where: [
        { key: 'tailscale_vps_ip' },
        { key: 'tailscale_client_ip' },
        { key: 'dvr_ip' }
      ]
    });

    const configMap: any = {};
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    return {
      vps_ip: configMap.tailscale_vps_ip || '',
      client_ip: configMap.tailscale_client_ip || '',
      dvr_ip: configMap.dvr_ip || '10.6.1.123'
    };
  }

  /**
   * Salvar configurações do Tailscale
   */
  static async saveConfig(updates: {
    vps_ip?: string;
    client_ip?: string;
  }) {
    const configRepository = AppDataSource.getRepository(Configuration);

    if (updates.vps_ip !== undefined) {
      await this.upsertConfig(configRepository, 'tailscale_vps_ip', updates.vps_ip);
    }

    if (updates.client_ip !== undefined) {
      await this.upsertConfig(configRepository, 'tailscale_client_ip', updates.client_ip);
    }

    return this.getConfig();
  }

  /**
   * Testar conectividade completa do Tailscale
   */
  static async testConnectivity() {
    const config = await this.getConfig();

    const results = {
      vps_to_client: await this.pingTest(config.client_ip, 'VPS → Cliente'),
      vps_to_dvr: await this.pingTest(config.dvr_ip, 'VPS → DVR'),
      dvr_http: await this.httpTest(config.dvr_ip, 'DVR HTTP')
    };

    return {
      config,
      tests: results,
      overall_status: this.calculateOverallStatus(results)
    };
  }

  /**
   * Testar ping em um IP
   */
  private static async pingTest(ip: string, description: string) {
    if (!ip || ip.trim() === '') {
      return {
        description,
        status: 'not_configured',
        color: 'gray',
        message: 'IP não configurado',
        latency_ms: null
      };
    }

    try {
      // Linux: ping -c 1 -W 2
      // Windows: ping -n 1 -w 2000
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `ping -n 1 -w 2000 ${ip}`
        : `ping -c 1 -W 2 ${ip}`;

      const { stdout, stderr } = await execPromise(cmd);

      // Extrair latência do resultado
      let latency = null;
      if (isWindows) {
        const match = stdout.match(/tempo[=<](\d+)ms/i) || stdout.match(/time[=<](\d+)ms/i);
        if (match) latency = parseInt(match[1]);
      } else {
        const match = stdout.match(/time=(\d+\.?\d*)\s*ms/i);
        if (match) latency = parseFloat(match[1]);
      }

      if (stdout.includes('TTL=') || stdout.includes('ttl=') || latency !== null) {
        return {
          description,
          status: 'online',
          color: 'green',
          message: `Conectado (${latency ? latency + 'ms' : 'OK'})`,
          latency_ms: latency
        };
      }

      return {
        description,
        status: 'offline',
        color: 'red',
        message: 'Sem resposta',
        latency_ms: null
      };
    } catch (error: any) {
      return {
        description,
        status: 'error',
        color: 'red',
        message: error.message || 'Erro ao executar ping',
        latency_ms: null
      };
    }
  }

  /**
   * Testar conexão HTTP no DVR
   */
  private static async httpTest(ip: string, description: string) {
    if (!ip || ip.trim() === '') {
      return {
        description,
        status: 'not_configured',
        color: 'gray',
        message: 'IP não configurado',
        response_time_ms: null
      };
    }

    try {
      const startTime = Date.now();
      const url = `http://${ip}/cgi-bin/magicBox.cgi?action=getSystemInfo`;

      // Obter credenciais do DVR
      const configRepository = AppDataSource.getRepository(Configuration);
      const dvrConfigs = await configRepository.find({
        where: [
          { key: 'dvr_usuario' },
          { key: 'dvr_senha' }
        ]
      });

      const dvrUser = dvrConfigs.find(c => c.key === 'dvr_usuario')?.value || 'admin';
      const dvrPass = dvrConfigs.find(c => c.key === 'dvr_senha')?.value || '';

      const cmd = `curl -u "${dvrUser}:${dvrPass}" --digest --connect-timeout 5 --max-time 10 "${url}" 2>&1`;
      const { stdout, stderr } = await execPromise(cmd);

      const responseTime = Date.now() - startTime;

      if (stdout.includes('processor') || stdout.includes('serialNumber') || stdout.includes('deviceType')) {
        return {
          description,
          status: 'online',
          color: 'green',
          message: `DVR respondendo (${responseTime}ms)`,
          response_time_ms: responseTime
        };
      }

      return {
        description,
        status: 'error',
        color: 'yellow',
        message: 'DVR respondeu mas dados inválidos',
        response_time_ms: responseTime
      };
    } catch (error: any) {
      return {
        description,
        status: 'offline',
        color: 'red',
        message: error.message || 'Falha ao conectar no DVR',
        response_time_ms: null
      };
    }
  }

  /**
   * Calcular status geral baseado nos testes
   */
  private static calculateOverallStatus(results: any) {
    const statuses = [
      results.vps_to_client.status,
      results.vps_to_dvr.status,
      results.dvr_http.status
    ];

    if (statuses.includes('not_configured')) {
      return {
        status: 'not_configured',
        color: 'gray',
        message: 'Configuração incompleta'
      };
    }

    if (statuses.every(s => s === 'online')) {
      return {
        status: 'healthy',
        color: 'green',
        message: 'Todos os sistemas online'
      };
    }

    if (statuses.includes('offline') || statuses.includes('error')) {
      return {
        status: 'unhealthy',
        color: 'red',
        message: 'Problemas de conectividade detectados'
      };
    }

    return {
      status: 'partial',
      color: 'yellow',
      message: 'Conectividade parcial'
    };
  }

  /**
   * Helper para inserir ou atualizar configuração
   */
  private static async upsertConfig(repository: any, key: string, value: string) {
    let config = await repository.findOne({ where: { key } });

    if (config) {
      config.value = value;
      config.updated_at = new Date();
    } else {
      config = repository.create({
        key,
        value,
        encrypted: false
      });
    }

    await repository.save(config);
  }
}
