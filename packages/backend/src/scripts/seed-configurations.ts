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
      console.log('✅ Configurações já existem no banco. Pulando seed.');
      return;
    }

    console.log('📝 Banco de configurações vazio. Populando com dados do .env...');

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
        key: 'minio_console_port',
        value: '9011',
        description: 'Porta do console web do MinIO'
      },

      // PostgreSQL
      {
        key: 'postgres_host',
        value: process.env.DB_HOST || 'localhost',
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
      }
    ];

    // Inserir todas as configurações
    for (const config of configs) {
      const configuration = configRepository.create(config);
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
