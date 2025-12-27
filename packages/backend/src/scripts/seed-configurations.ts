import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';

/**
 * Script de seed para popular configurações iniciais do sistema
 * Executa automaticamente ao iniciar o backend pela primeira vez
 */
async function seedConfigurations() {
  try {
    console.log('🌱 Iniciando seed de configurações...');

    // Garantir que o banco está conectado
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const configRepository = AppDataSource.getRepository(Configuration);

    // Verificar se já existe alguma configuração
    const existingCount = await configRepository.count();

    if (existingCount > 0) {
      console.log('🔄 Configurações já existem. Atualizando com valores do .env...');
    } else {
      console.log('📝 Banco de configurações vazio. Populando com dados do .env...');
    }

    // Pegar valores do ambiente (vindos do .env do Docker)
    const configs = [
      // MinIO
      {
        key: 'minio_endpoint',
        value: process.env.MINIO_PUBLIC_ENDPOINT || process.env.HOST_IP || 'localhost',
        description: 'Endpoint público do MinIO (IP ou domínio)'
      },
      {
        key: 'minio_port',
        value: process.env.MINIO_PUBLIC_PORT || '9010',
        description: 'Porta pública da API do MinIO'
      },
      {
        key: 'minio_access_key',
        value: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '',
        description: 'Access Key (usuário) do MinIO'
      },
      {
        key: 'minio_secret_key',
        value: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '',
        description: 'Secret Key (senha) do MinIO'
      },
      {
        key: 'minio_use_ssl',
        value: process.env.MINIO_PUBLIC_USE_SSL || 'false',
        description: 'Usar SSL/HTTPS para MinIO'
      },
      {
        key: 'minio_bucket_name',
        value: process.env.MINIO_BUCKET_NAME || 'market-security',
        description: 'Nome do bucket do MinIO'
      },
      {
        key: 'minio_public_endpoint',
        value: process.env.MINIO_PUBLIC_ENDPOINT || process.env.HOST_IP || 'localhost',
        description: 'Endpoint público do MinIO para acesso externo'
      },
      {
        key: 'minio_public_port',
        value: process.env.MINIO_PUBLIC_PORT || '9010',
        description: 'Porta pública do MinIO para acesso externo'
      },
      {
        key: 'minio_console_port',
        value: '9011',
        description: 'Porta do console web do MinIO'
      },

      // PostgreSQL
      {
        key: 'postgres_host',
        value: process.env.HOST_IP || 'localhost',
        description: 'Host do PostgreSQL'
      },
      {
        key: 'postgres_port',
        value: '5434', // Porta externa do Docker
        description: 'Porta externa do PostgreSQL'
      },
      {
        key: 'postgres_user',
        value: process.env.DB_USER || 'postgres',
        description: 'Usuário do PostgreSQL'
      },
      {
        key: 'postgres_password',
        value: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
        description: 'Senha do PostgreSQL'
      },
      {
        key: 'postgres_database',
        value: process.env.DB_NAME || 'prevencao_db',
        description: 'Nome do banco de dados PostgreSQL'
      },

      // Sistema
      {
        key: 'host_ip',
        value: process.env.HOST_IP || 'localhost',
        description: 'IP da máquina host'
      },
      {
        key: 'api_token',
        value: process.env.API_TOKEN || '',
        description: 'Token de autenticação da API para scanners'
      },

      // Tailscale
      {
        key: 'tailscale_vps_ip',
        value: process.env.TAILSCALE_VPS_IP || process.env.TAILSCALE_IP || '',
        description: 'IP da VPS na rede Tailscale'
      },
      {
        key: 'tailscale_client_ip',
        value: process.env.TAILSCALE_CLIENT_IP || '',
        description: 'IP Tailscale da máquina do cliente (onde roda o ERP)'
      },

      // APIs PRÉ-CONFIGURADAS (apenas Zanthus, Intersolid e Evolution)
      // Zanthus ERP
      {
        key: 'zanthus_api_url',
        value: 'http://10.6.1.101',
        description: 'URL da API Zanthus'
      },
      {
        key: 'zanthus_port',
        value: '',
        description: 'Porta da API Zanthus (opcional)'
      },
      {
        key: 'zanthus_products_endpoint',
        value: '/manager/restful/integracao/cadastro_sincrono.php5',
        description: 'Endpoint de produtos Zanthus'
      },
      {
        key: 'zanthus_sales_endpoint',
        value: '/manager/restful/integracao/cadastro_sincrono.php5',
        description: 'Endpoint de vendas Zanthus'
      },

      // Intersolid ERP
      {
        key: 'intersolid_api_url',
        value: 'http://10.6.1.102',
        description: 'URL da API Intersolid'
      },
      {
        key: 'intersolid_port',
        value: '3003',
        description: 'Porta da API Intersolid'
      },
      {
        key: 'intersolid_username',
        value: 'ROBERTO',
        description: 'Usuário da API Intersolid'
      },
      {
        key: 'intersolid_password',
        value: '312013@#',
        description: 'Senha da API Intersolid'
      },
      {
        key: 'intersolid_products_endpoint',
        value: '/v1/produtos',
        description: 'Endpoint de produtos Intersolid'
      },
      {
        key: 'intersolid_sales_endpoint',
        value: '/v1/vendas',
        description: 'Endpoint de vendas Intersolid'
      },

      // Evolution API (WhatsApp)
      {
        key: 'evolution_api_url',
        value: 'http://31.97.82.235:8090',
        description: 'URL da Evolution API (WhatsApp)'
      },
      {
        key: 'evolution_api_token',
        value: 'E73D57BB-5AEF-4560-87E6-966C933CE1DA',
        description: 'Token de autenticação Evolution API'
      },
      {
        key: 'evolution_instance',
        value: 'FACIAL_TRADICAO_L1',
        description: 'Nome da instância Evolution API'
      },
      {
        key: 'evolution_whatsapp_group_id',
        value: '120363422563235781@g.us',
        description: 'ID do grupo WhatsApp para notificações'
      },

      // Email - Recuperação de Senha
      {
        key: 'email_user',
        value: process.env.EMAIL_USER || 'betotradicao76@gmail.com',
        description: 'Email para envio (Gmail)'
      },
      {
        key: 'email_pass',
        value: process.env.EMAIL_PASS || 'ylljjijqstxnwogk',
        description: 'Senha de app do Gmail'
      },

      // Monitor de Email DVR
      {
        key: 'dvr_ip',
        value: '',
        description: 'IP do DVR na rede local'
      },
      {
        key: 'dvr_usuario',
        value: 'admin',
        description: 'Usuário do DVR'
      },
      {
        key: 'dvr_senha',
        value: '',
        description: 'Senha do DVR'
      },
      {
        key: 'dvr_email_senha',
        value: '',
        description: 'Senha do email do DVR'
      },
      {
        key: 'dvr_monitor_intervalo',
        value: '360',
        description: 'Intervalo do monitor em segundos (padrão: 360s = 6min)'
      },
      {
        key: 'dvr_monitor_auto_start',
        value: 'false',
        description: 'Auto-iniciar monitor de email'
      },

      // Monitor de Email (Novo sistema)
      {
        key: 'email_monitor_email',
        value: 'betotradicao76@gmail.com',
        description: 'Email Gmail para monitorar'
      },
      {
        key: 'email_monitor_app_password',
        value: 'ygrowrdaloqfgtcc',
        description: 'Senha de app do Gmail para IMAP (Monitor DVR)'
      },
      {
        key: 'email_monitor_subject_filter',
        value: 'ALERTA DVR',
        description: 'Filtro de assunto dos emails'
      },
      {
        key: 'email_monitor_check_interval',
        value: '30',
        description: 'Intervalo de verificação em segundos'
      },
      {
        key: 'email_monitor_whatsapp_group',
        value: '120363421239599536@g.us',
        description: 'ID do grupo WhatsApp para notificações do Monitor'
      },
      {
        key: 'email_monitor_enabled',
        value: 'false',
        description: 'Monitor habilitado (true/false)'
      }
    ];

    // Inserir ou atualizar todas as configurações (upsert)
    for (const config of configs) {
      // Buscar configuração existente
      let configuration = await configRepository.findOne({ where: { key: config.key } });

      if (configuration) {
        // Atualizar valor existente
        configuration.value = config.value;
      } else {
        // Criar nova configuração
        configuration = configRepository.create({
          key: config.key,
          value: config.value
        });
      }

      await configRepository.save(configuration);
      console.log(`   ✅ ${config.key}: ${config.value ? '***' : '(vazio)'}`);
    }

    console.log('✅ Seed de configurações concluído com sucesso!');
    console.log(`   Total: ${configs.length} configurações criadas`);

  } catch (error) {
    console.error('❌ Erro ao executar seed de configurações:', error);
    throw error;
  }
}

// Executar seed se for chamado diretamente
if (require.main === module) {
  seedConfigurations()
    .then(() => {
      console.log('✅ Seed finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed:', error);
      process.exit(1);
    });
}

export default seedConfigurations;
