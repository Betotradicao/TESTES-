import { useState, useEffect } from 'react';
import SimulatorTab from './SimulatorTab';

export default function APIsTab() {
  const [activeSubTab, setActiveSubTab] = useState('zanthus');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState({});
  const [isTesting, setIsTesting] = useState({});

  const [apiConfigs, setApiConfigs] = useState({
    zanthus: {
      apiUrl: 'http://10.6.1.101',
      port: '',
      productsEndpoint: '/manager/restful/integracao/cadastro_sincrono.php5',
      salesEndpoint: '/manager/restful/integracao/cadastro_sincrono.php5'
    },
    intersolid: {
      apiUrl: 'http://10.6.1.102',
      port: '3003',
      username: 'ROBERTO',
      password: '312013@#',
      productsEndpoint: '/v1/produtos',
      salesEndpoint: '/v1/vendas'
    },
    evolution: {
      apiUrl: 'http://31.97.82.235:8090',
      apiToken: 'E73D57BB-5AEF-4560-87E6-966C933CE1DA',
      instance: 'FACIAL_TRADICAO_L1',
      whatsappGroupId: '120363422563235781@g.us'
    },
    database: {
      host: 'localhost',
      port: '5432',
      username: 'postgres',
      password: 'admin123',
      databaseName: 'market_security'
    },
    minio: {
      endpoint: 'localhost',
      port: '9000',
      accessKey: 'f0a02f9d4320abc34679f4742eecbad1',
      secretKey: '3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55',
      bucketName: 'market-security',
      useSSL: false,
      publicEndpoint: 'localhost',
      publicPort: '9000'
    }
  });

  const subTabs = [
    { id: 'zanthus', label: 'ZANTHUS' },
    { id: 'intersolid', label: 'INTERSOLID' },
    { id: 'evolution', label: 'EVOLUTION API' },
    { id: 'database', label: 'BANCO DE DADOS' },
    { id: 'minio', label: 'MINIO (Armazenamento)' },
    { id: 'simulator', label: 'SIMULADOR BIPAGENS' }
  ];

  // Busca configurações salvas do banco ao carregar
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/config/configurations`);
      const data = await response.json();

      if (data.success && data.data) {
        const configs = data.data;

        setApiConfigs({
          zanthus: {
            apiUrl: configs.zanthus_api_url || 'http://10.6.1.101',
            port: configs.zanthus_port || '',
            productsEndpoint: configs.zanthus_products_endpoint || '/manager/restful/integracao/cadastro_sincrono.php5',
            salesEndpoint: configs.zanthus_sales_endpoint || '/manager/restful/integracao/cadastro_sincrono.php5'
          },
          intersolid: {
            apiUrl: configs.intersolid_api_url || 'http://10.6.1.102',
            port: configs.intersolid_port || '3003',
            username: configs.intersolid_username || 'ROBERTO',
            password: configs.intersolid_password || '312013@#',
            productsEndpoint: configs.intersolid_products_endpoint || '/v1/produtos',
            salesEndpoint: configs.intersolid_sales_endpoint || '/v1/vendas'
          },
          evolution: {
            apiUrl: configs.evolution_api_url || 'http://31.97.82.235:8090',
            apiToken: configs.evolution_api_token || 'E73D57BB-5AEF-4560-87E6-966C933CE1DA',
            instance: configs.evolution_instance || 'FACIAL_TRADICAO_L1',
            whatsappGroupId: configs.evolution_whatsapp_group_id || '120363422563235781@g.us'
          },
          database: {
            host: configs.postgres_host || 'localhost',
            port: configs.postgres_port || '5432',
            username: configs.postgres_user || 'postgres',
            password: configs.postgres_password || 'admin123',
            databaseName: configs.postgres_database || 'prevencao_db'
          },
          minio: {
            endpoint: configs.minio_endpoint || 'localhost',
            port: configs.minio_port || '9000',
            accessKey: configs.minio_access_key || 'f0a02f9d4320abc34679f4742eecbad1',
            secretKey: configs.minio_secret_key || '3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55',
            bucketName: configs.minio_bucket_name || 'market-security',
            useSSL: configs.minio_use_ssl === 'true' || false,
            publicEndpoint: configs.minio_public_endpoint || 'localhost',
            publicPort: configs.minio_public_port || '9000'
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-preenche os endpoints quando a URL da API é digitada
  useEffect(() => {
    // Para Intersolid - só preenche se ainda não tiver valor
    if (apiConfigs.intersolid.apiUrl &&
        !apiConfigs.intersolid.productsEndpoint &&
        !apiConfigs.intersolid.salesEndpoint) {
      setApiConfigs(prev => ({
        ...prev,
        intersolid: {
          ...prev.intersolid,
          productsEndpoint: '/v1/produtos',
          salesEndpoint: '/v1/vendas'
        }
      }));
    }

    // Para Zanthus - só preenche se ainda não tiver valor
    if (apiConfigs.zanthus.apiUrl &&
        !apiConfigs.zanthus.productsEndpoint &&
        !apiConfigs.zanthus.salesEndpoint) {
      setApiConfigs(prev => ({
        ...prev,
        zanthus: {
          ...prev.zanthus,
          productsEndpoint: '/manager/restful/integracao/cadastro_sincrono.php5',
          salesEndpoint: '/manager/restful/integracao/cadastro_sincrono.php5'
        }
      }));
    }
  }, [apiConfigs.intersolid.apiUrl, apiConfigs.zanthus.apiUrl,
      apiConfigs.intersolid.productsEndpoint, apiConfigs.intersolid.salesEndpoint,
      apiConfigs.zanthus.productsEndpoint, apiConfigs.zanthus.salesEndpoint]);

  const handleInputChange = (api, field, value) => {
    setApiConfigs(prev => ({
      ...prev,
      [api]: {
        ...prev[api],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      // Converte o objeto de configurações para o formato do backend
      const configsToSave = {
        // Zanthus
        zanthus_api_url: apiConfigs.zanthus.apiUrl,
        zanthus_port: apiConfigs.zanthus.port,
        zanthus_products_endpoint: apiConfigs.zanthus.productsEndpoint,
        zanthus_sales_endpoint: apiConfigs.zanthus.salesEndpoint,

        // Intersolid
        intersolid_api_url: apiConfigs.intersolid.apiUrl,
        intersolid_port: apiConfigs.intersolid.port,
        intersolid_username: apiConfigs.intersolid.username,
        intersolid_password: apiConfigs.intersolid.password,
        intersolid_products_endpoint: apiConfigs.intersolid.productsEndpoint,
        intersolid_sales_endpoint: apiConfigs.intersolid.salesEndpoint,

        // Evolution API
        evolution_api_url: apiConfigs.evolution.apiUrl,
        evolution_api_token: apiConfigs.evolution.apiToken,
        evolution_instance: apiConfigs.evolution.instance,
        evolution_whatsapp_group_id: apiConfigs.evolution.whatsappGroupId,

        // PostgreSQL
        postgres_host: apiConfigs.database.host,
        postgres_port: apiConfigs.database.port,
        postgres_user: apiConfigs.database.username,
        postgres_password: apiConfigs.database.password,
        postgres_database: apiConfigs.database.databaseName,

        // MinIO
        minio_endpoint: apiConfigs.minio.endpoint,
        minio_port: apiConfigs.minio.port,
        minio_access_key: apiConfigs.minio.accessKey,
        minio_secret_key: apiConfigs.minio.secretKey,
        minio_bucket_name: apiConfigs.minio.bucketName,
        minio_use_ssl: String(apiConfigs.minio.useSSL),
        minio_public_endpoint: apiConfigs.minio.publicEndpoint,
        minio_public_port: apiConfigs.minio.publicPort
      };

      const response = await fetch(`${apiUrl}/config/configurations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configsToSave)
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Configurações salvas com sucesso! Senhas foram criptografadas.');
      } else {
        alert('❌ Erro ao salvar: ' + data.message);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('❌ Erro ao salvar configurações: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (apiType) => {
    setIsTesting(prev => ({ ...prev, [apiType]: true }));
    setTestResults(prev => ({ ...prev, [apiType]: null }));

    try {
      let result;

      switch (apiType) {
        case 'zanthus':
          result = await testZanthusConnection();
          break;
        case 'intersolid':
          result = await testIntersolidConnection();
          break;
        case 'evolution':
          result = await testEvolutionConnection();
          break;
        case 'database':
          result = await testDatabaseConnection();
          break;
        case 'minio':
          result = await testMinioConnection();
          break;
        default:
          result = { success: false, message: 'API não reconhecida' };
      }

      setTestResults(prev => ({ ...prev, [apiType]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [apiType]: {
          success: false,
          message: error.message || 'Erro ao testar conexão'
        }
      }));
    } finally {
      setIsTesting(prev => ({ ...prev, [apiType]: false }));
    }
  };

  const testZanthusConnection = async () => {
    const config = apiConfigs.zanthus;

    if (!config.apiUrl) {
      return {
        success: false,
        message: 'Preencha a URL da API antes de testar'
      };
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      // Chama o backend para fazer o teste (evita problemas de CORS)
      const response = await fetch(`${apiUrl}/config/test-zanthus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          port: config.port,
          apiToken: config.apiToken,
          endpoint: config.salesEndpoint || config.productsEndpoint
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: data.message,
          data: data.data
        };
      } else {
        return {
          success: false,
          message: data.message || 'Erro ao testar conexão',
          data: data.data
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`,
        error: {
          error: error.name,
          details: 'Erro ao comunicar com o backend'
        }
      };
    }
  };

  const testIntersolidConnection = async () => {
    const config = apiConfigs.intersolid;

    if (!config.apiUrl || !config.salesEndpoint) {
      return {
        success: false,
        message: 'Preencha a URL e o Endpoint de Vendas antes de testar'
      };
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      // Chama o backend para fazer o teste (evita problemas de CORS)
      const response = await fetch(`${apiUrl}/config/test-intersolid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          port: config.port,
          username: config.username,
          password: config.password,
          salesEndpoint: config.salesEndpoint,
          productsEndpoint: config.productsEndpoint
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: data.message,
          data: data.data
        };
      } else {
        return {
          success: false,
          message: data.message || 'Erro ao testar conexão',
          data: data.data
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`,
        data: {
          error: error.name,
          details: 'Erro ao comunicar com o backend'
        }
      };
    }
  };

  const testEvolutionConnection = async () => {
    const config = apiConfigs.evolution;

    if (!config.apiUrl || !config.apiToken) {
      return {
        success: false,
        message: 'Preencha a URL da API e o Token antes de testar'
      };
    }

    try {
      const response = await fetch(`${config.apiUrl}/instance/connectionState/${config.instance}`, {
        headers: {
          'apikey': config.apiToken
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Conexão OK! Status da instância: ${data.state || 'Conectado'}`,
          data: data
        };
      } else {
        return {
          success: false,
          message: `Erro: ${response.status} - ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  };

  const testDatabaseConnection = async () => {
    const config = apiConfigs.database;

    if (!config.host || !config.username || !config.password) {
      return {
        success: false,
        message: 'Preencha Host, Usuário e Senha antes de testar'
      };
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/config/test-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: 'Conexão com banco de dados estabelecida com sucesso!',
          data: data
        };
      } else {
        return {
          success: false,
          message: data.message || 'Erro ao conectar ao banco de dados'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  };

  const testMinioConnection = async () => {
    const config = apiConfigs.minio;

    if (!config.endpoint || !config.accessKey || !config.secretKey) {
      return {
        success: false,
        message: 'Preencha Endpoint, Access Key e Secret Key antes de testar'
      };
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/config/test-minio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: 'Conexão com MinIO estabelecida com sucesso!',
          data: data
        };
      } else {
        return {
          success: false,
          message: data.message || 'Erro ao conectar ao MinIO'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  };

  const renderTestResult = (apiType) => {
    const result = testResults[apiType];
    if (!result) return null;

    // Para Intersolid e Zanthus, mostra vendas e produtos lado a lado
    if ((apiType === 'intersolid' || apiType === 'zanthus') && result.success && result.data?.sales && result.data?.products) {
      return (
        <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Teste bem-sucedido</h3>
              <p className="mt-1 text-sm text-green-700">{result.message}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Coluna de Vendas */}
            <div className="bg-white bg-opacity-70 p-3 rounded">
              <h4 className="font-medium text-sm text-gray-900 mb-2">📊 Vendas (Total: {result.data.sales.total})</h4>
              <pre className="text-xs overflow-auto max-h-48 bg-gray-50 p-2 rounded">
                {JSON.stringify(result.data.sales.sample, null, 2)}
              </pre>
            </div>

            {/* Coluna de Produtos */}
            <div className="bg-white bg-opacity-70 p-3 rounded">
              <h4 className="font-medium text-sm text-gray-900 mb-2">📦 Produtos (Total: {result.data.products.total})</h4>
              <pre className="text-xs overflow-auto max-h-48 bg-gray-50 p-2 rounded">
                {JSON.stringify(result.data.products.sample, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    // Para outros casos, mostra o resultado padrão
    return (
      <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {result.success ? (
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? 'Teste bem-sucedido' : 'Teste falhou'}
            </h3>
            <div className={`mt-2 text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              <p>{result.message}</p>
              {result.data && (
                <pre className="mt-2 text-xs overflow-auto max-h-32 bg-white bg-opacity-50 p-2 rounded">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTestButton = (apiType) => (
    <button
      onClick={() => handleTestConnection(apiType)}
      disabled={isTesting[apiType]}
      className={`
        px-4 py-2 rounded-lg font-medium transition flex items-center space-x-2
        ${isTesting[apiType]
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700 text-white'
        }
      `}
    >
      {isTesting[apiType] ? (
        <>
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Testando...</span>
        </>
      ) : (
        <>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Testar Conexão</span>
        </>
      )}
    </button>
  );

  const renderZanthusForm = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          Sistema ERP Zanthus - Configurações para integração com produtos e vendas
        </p>
      </div>

      {/* Tailscale Help Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-300 rounded-lg p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              🔗 Acesso Seguro à Rede Local do Cliente (Tailscale)
            </h4>
            <div className="text-sm text-purple-800 space-y-2">
              <p className="font-medium">
                Como o Zanthus roda na rede <strong>local do cliente</strong> (ex: 10.6.1.101) e nossa VPS está na <strong>nuvem</strong>,
                usamos o <strong>Tailscale</strong> para criar um túnel VPN seguro entre os dois ambientes.
              </p>

              <div className="bg-white bg-opacity-60 rounded-lg p-3 mt-3">
                <p className="font-semibold text-purple-900 mb-2">📋 Configuração no Cliente (Windows):</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>
                    <strong>Baixar Tailscale:</strong>{' '}
                    <a href="https://tailscale.com/download/windows" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      https://tailscale.com/download/windows
                    </a>
                  </li>
                  <li>
                    <strong>Instalar</strong> e fazer login (mesmo email da VPS)
                  </li>
                  <li>
                    <strong>Abrir PowerShell como Administrador</strong> (Windows + X → PowerShell Admin)
                  </li>
                  <li>
                    <strong>Executar comando:</strong>
                    <div className="bg-gray-900 text-green-400 p-3 rounded mt-2 font-mono text-xs overflow-x-auto">
                      tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
                    </div>
                    <p className="text-xs text-gray-600 mt-1 italic">
                      ⚠️ Substitua <code className="bg-gray-200 px-1 rounded">10.6.1.0/24</code> pela rede local do cliente!
                      <br/>Para descobrir: abra CMD → execute <code className="bg-gray-200 px-1 rounded">ipconfig</code> →
                      se o IP for <code className="bg-gray-200 px-1 rounded">192.168.1.X</code>, use <code className="bg-gray-200 px-1 rounded">192.168.1.0/24</code>
                    </p>
                  </li>
                  <li>
                    <strong>Aprovar rota:</strong> Acesse{' '}
                    <a href="https://login.tailscale.com/admin/machines" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Painel Tailscale
                    </a>
                    {' '}→ Clique nos 3 pontinhos da máquina → Edit route settings → Marque a rede → Approve
                  </li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="font-semibold text-green-900 mb-1">✅ Como Testar:</p>
                <p className="text-xs text-green-800">
                  Na VPS, execute: <code className="bg-gray-800 text-green-400 px-2 py-1 rounded">curl http://10.6.1.101</code>
                  <br/>
                  Se retornar dados (mesmo que erro 401), está funcionando!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL da API Zanthus
        </label>
        <input
          type="text"
          value={apiConfigs.zanthus.apiUrl}
          onChange={(e) => handleInputChange('zanthus', 'apiUrl', e.target.value)}
          placeholder="http://10.6.1.101"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Porta (deixe vazio para usar porta padrão 80)
        </label>
        <input
          type="text"
          value={apiConfigs.zanthus.port}
          onChange={(e) => handleInputChange('zanthus', 'port', e.target.value)}
          placeholder="Vazio = porta 80 (padrão HTTP)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-2 mb-3">
          <h4 className="text-sm font-medium text-gray-900">Endpoints da API</h4>
          <div className="group relative">
            <svg className="w-4 h-4 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="invisible group-hover:visible absolute left-0 top-6 w-72 bg-gray-800 text-white text-xs rounded-lg p-3 z-10 shadow-lg">
              <p className="font-semibold mb-1">ℹ️ Como funciona a API Zanthus:</p>
              <p className="mb-2">A Zanthus usa o <strong>mesmo endpoint</strong> para produtos e vendas.</p>
              <p>A diferenciação é feita através da <strong>query SQL</strong> enviada no corpo da requisição (SELECT em TAB_PRODUTO para produtos, SELECT em ZAN_M43 para vendas).</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-xs font-medium text-gray-600">
                Endpoint de Produtos
              </label>
              <div className="group relative">
                <svg className="w-3.5 h-3.5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="invisible group-hover:visible absolute left-0 top-5 w-96 bg-gray-800 text-white text-xs rounded-lg p-3 z-10 shadow-lg">
                  <p className="font-semibold mb-2">📊 Query SQL utilizada:</p>
                  <pre className="bg-gray-900 p-2 rounded text-green-400 overflow-x-auto">
SELECT * FROM TAB_PRODUTO
WHERE ROWNUM &lt;= 5</pre>
                  <p className="mt-2 text-gray-300">Busca os primeiros 5 produtos da tabela TAB_PRODUTO</p>
                </div>
              </div>
            </div>
            <input
              type="text"
              value={apiConfigs.zanthus.productsEndpoint}
              onChange={(e) => handleInputChange('zanthus', 'productsEndpoint', e.target.value)}
              placeholder="/manager/restful/integracao/cadastro_sincrono.php5"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
            />
            <p className="text-xs text-green-600 mt-1">✓ Preenchido automaticamente</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-xs font-medium text-gray-600">
                Endpoint de Vendas
              </label>
              <div className="group relative">
                <svg className="w-3.5 h-3.5 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="invisible group-hover:visible absolute left-0 top-5 w-[500px] bg-gray-800 text-white text-xs rounded-lg p-3 z-10 shadow-lg">
                  <p className="font-semibold mb-2">📊 Query SQL utilizada:</p>
                  <pre className="bg-gray-900 p-2 rounded text-green-400 overflow-x-auto whitespace-pre-wrap">
SELECT
  z.M00AC as codCaixa,
  z.M00ZA as codLoja,
  z.M43AH as codProduto,
  z.M00AF as dtaSaida,
  z.M00AD as numCupomFiscal,
  z.M43DQ as valVenda,
  z.M43AO as qtdTotalProduto,
  z.M43AP as valTotalProduto,
  p.DESCRICAO_PRODUTO as desProduto
FROM ZAN_M43 z
LEFT JOIN TAB_PRODUTO p
  ON p.COD_PRODUTO LIKE '%' || z.M43AH
WHERE TRUNC(z.M00AF) = TO_DATE('ONTEM','YYYY-MM-DD')
AND ROWNUM &lt;= 5</pre>
                  <p className="mt-2 text-gray-300">Busca as primeiras 5 vendas de ontem com informações do produto relacionado</p>
                </div>
              </div>
            </div>
            <input
              type="text"
              value={apiConfigs.zanthus.salesEndpoint}
              onChange={(e) => handleInputChange('zanthus', 'salesEndpoint', e.target.value)}
              placeholder="/manager/restful/integracao/cadastro_sincrono.php5"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
            />
            <p className="text-xs text-green-600 mt-1">✓ Preenchido automaticamente</p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        {renderTestButton('zanthus')}
      </div>

      {renderTestResult('zanthus')}
    </div>
  );

  const renderIntersolidForm = () => (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-green-800">
          Sistema ERP Intersolid - Sistema alternativo de integração
        </p>
      </div>

      {/* Tailscale Help Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-300 rounded-lg p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              🔗 Acesso Seguro à Rede Local do Cliente (Tailscale)
            </h4>
            <div className="text-sm text-purple-800 space-y-2">
              <p className="font-medium">
                Como o Intersolid roda na rede <strong>local do cliente</strong> (ex: 10.6.1.102:3003) e nossa VPS está na <strong>nuvem</strong>,
                usamos o <strong>Tailscale</strong> para criar um túnel VPN seguro entre os dois ambientes.
              </p>

              <div className="bg-white bg-opacity-60 rounded-lg p-3 mt-3">
                <p className="font-semibold text-purple-900 mb-2">📋 Configuração no Cliente (Windows):</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>
                    <strong>Baixar Tailscale:</strong>{' '}
                    <a href="https://tailscale.com/download/windows" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      https://tailscale.com/download/windows
                    </a>
                  </li>
                  <li>
                    <strong>Instalar</strong> e fazer login (mesmo email da VPS)
                  </li>
                  <li>
                    <strong>Abrir PowerShell como Administrador</strong> (Windows + X → PowerShell Admin)
                  </li>
                  <li>
                    <strong>Executar comando:</strong>
                    <div className="bg-gray-900 text-green-400 p-3 rounded mt-2 font-mono text-xs overflow-x-auto">
                      tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
                    </div>
                    <p className="text-xs text-gray-600 mt-1 italic">
                      ⚠️ Substitua <code className="bg-gray-200 px-1 rounded">10.6.1.0/24</code> pela rede local do cliente!
                      <br/>Para descobrir: abra CMD → execute <code className="bg-gray-200 px-1 rounded">ipconfig</code> →
                      se o IP for <code className="bg-gray-200 px-1 rounded">192.168.1.X</code>, use <code className="bg-gray-200 px-1 rounded">192.168.1.0/24</code>
                    </p>
                  </li>
                  <li>
                    <strong>Aprovar rota:</strong> Acesse{' '}
                    <a href="https://login.tailscale.com/admin/machines" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Painel Tailscale
                    </a>
                    {' '}→ Clique nos 3 pontinhos da máquina → Edit route settings → Marque a rede → Approve
                  </li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="font-semibold text-green-900 mb-1">✅ Como Testar:</p>
                <p className="text-xs text-green-800">
                  Na VPS, execute: <code className="bg-gray-800 text-green-400 px-2 py-1 rounded">curl http://10.6.1.102:3003</code>
                  <br/>
                  Se retornar dados (mesmo que erro 401), está funcionando!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL da API Intersolid
        </label>
        <input
          type="text"
          value={apiConfigs.intersolid.apiUrl}
          onChange={(e) => handleInputChange('intersolid', 'apiUrl', e.target.value)}
          placeholder="http://10.6.1.101"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Porta
        </label>
        <input
          type="text"
          value={apiConfigs.intersolid.port}
          onChange={(e) => handleInputChange('intersolid', 'port', e.target.value)}
          placeholder="3003"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Usuário
        </label>
        <input
          type="text"
          value={apiConfigs.intersolid.username}
          onChange={(e) => handleInputChange('intersolid', 'username', e.target.value)}
          placeholder="Nome de usuário"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Senha
        </label>
        <input
          type="password"
          value={apiConfigs.intersolid.password}
          onChange={(e) => handleInputChange('intersolid', 'password', e.target.value)}
          placeholder="Senha"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Endpoints da API</h4>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Endpoint de Produtos
            </label>
            <input
              type="text"
              value={apiConfigs.intersolid.productsEndpoint}
              onChange={(e) => handleInputChange('intersolid', 'productsEndpoint', e.target.value)}
              placeholder="/v1/produtos"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
            />
            <p className="text-xs text-green-600 mt-1">✓ Preenchido automaticamente</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Endpoint de Vendas
            </label>
            <input
              type="text"
              value={apiConfigs.intersolid.salesEndpoint}
              onChange={(e) => handleInputChange('intersolid', 'salesEndpoint', e.target.value)}
              placeholder="/v1/vendas"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
            />
            <p className="text-xs text-green-600 mt-1">✓ Preenchido automaticamente</p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        {renderTestButton('intersolid')}
      </div>

      {renderTestResult('intersolid')}
    </div>
  );

  const [evolutionGroups, setEvolutionGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  const [sendingTestMessage, setSendingTestMessage] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [savedGroup, setSavedGroup] = useState(null);

  // Carregar grupo salvo do localStorage quando o componente montar
  useEffect(() => {
    const savedGroupData = localStorage.getItem('evolution_saved_group');
    if (savedGroupData) {
      try {
        const parsedGroup = JSON.parse(savedGroupData);
        setSavedGroup(parsedGroup);
        setSelectedGroup(parsedGroup);
      } catch (error) {
        console.error('Erro ao carregar grupo salvo:', error);
      }
    }
  }, []);

  const checkInstanceStatus = async () => {
    setCheckingStatus(true);
    try {
      const config = apiConfigs.evolution;
      const response = await fetch(`${config.apiUrl}/instance/connectionState/${config.instance}`, {
        headers: { 'apikey': config.apiToken }
      });

      if (response.ok) {
        const data = await response.json();
        setInstanceStatus({ active: data.state === 'open', state: data.state });
      } else {
        setInstanceStatus({ active: false, state: 'disconnected' });
      }
    } catch (error) {
      setInstanceStatus({ active: false, state: 'error' });
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadWhatsAppGroups = async () => {
    setLoadingGroups(true);
    setEvolutionGroups([]);

    try {
      const config = apiConfigs.evolution;

      console.log('🔍 Carregando grupos da Evolution API...');
      console.log('📝 Config:', {
        apiUrl: config.apiUrl,
        instance: config.instance,
        hasToken: !!config.apiToken
      });

      const url = `${config.apiUrl}/group/fetchAllGroups/${config.instance}?getParticipants=false`;
      console.log('🌐 URL completa:', url);

      const response = await fetch(url, {
        headers: {
          'apikey': config.apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Status da resposta:', response.status);
      console.log('📋 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Tipo de dados recebidos:', typeof data);
        console.log('✅ Dados completos:', JSON.stringify(data, null, 2));

        let groups = [];

        // Tentar diferentes formatos de resposta da API Evolution
        if (Array.isArray(data)) {
          // Formato 1: Array direto
          groups = data;
          console.log('📦 Formato: Array direto');
        } else if (data && Array.isArray(data.groups)) {
          // Formato 2: { groups: [...] }
          groups = data.groups;
          console.log('📦 Formato: Objeto com propriedade groups');
        } else if (data && data.data && Array.isArray(data.data)) {
          // Formato 3: { data: [...] }
          groups = data.data;
          console.log('📦 Formato: Objeto com propriedade data');
        } else if (data && typeof data === 'object') {
          // Formato 4: Objeto com valores sendo os grupos
          groups = Object.values(data);
          console.log('📦 Formato: Objeto convertido para array');
        }

        console.log(`📋 ${groups.length} grupos encontrados`);
        console.log('📋 Primeiro grupo (exemplo):', groups[0]);

        setEvolutionGroups(groups);

        if (groups.length === 0) {
          alert('⚠️ Nenhum grupo encontrado nesta instância');
        } else {
          alert(`✅ ${groups.length} grupos carregados com sucesso!`);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status, errorText);
        alert(`Erro ao carregar grupos (${response.status}): ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Erro ao conectar:', error);
      alert('Erro ao conectar com a API: ' + error.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    handleInputChange('evolution', 'whatsappGroupId', group.id);
  };

  const handleSaveGroup = () => {
    if (selectedGroup) {
      setSavedGroup(selectedGroup);
      setIsEditingGroup(false);
      setEvolutionGroups([]);

      // Salvar no localStorage
      localStorage.setItem('evolution_saved_group', JSON.stringify(selectedGroup));

      alert('✅ Grupo salvo com sucesso!');
    }
  };

  const handleEditGroup = () => {
    setIsEditingGroup(true);
    setSavedGroup(null);
  };

  const handleCancelEditGroup = () => {
    setIsEditingGroup(false);
    setEvolutionGroups([]);
    setSelectedGroup(savedGroup);
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) {
      alert('Digite uma mensagem de teste');
      return;
    }

    setSendingTestMessage(true);
    try {
      const config = apiConfigs.evolution;
      const response = await fetch(`${config.apiUrl}/message/sendText/${config.instance}`, {
        method: 'POST',
        headers: {
          'apikey': config.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: apiConfigs.evolution.whatsappGroupId,
          text: testMessage
        })
      });

      if (response.ok) {
        alert('✅ Mensagem enviada com sucesso!');
        setTestMessage('');
      } else {
        alert('❌ Erro ao enviar mensagem');
      }
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setSendingTestMessage(false);
    }
  };

  const renderEvolutionForm = () => (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-purple-800">
          Evolution API - Integração com WhatsApp para notificações
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL da API Evolution
        </label>
        <input
          type="text"
          value={apiConfigs.evolution.apiUrl}
          onChange={(e) => handleInputChange('evolution', 'apiUrl', e.target.value)}
          placeholder="https://evolution.api.com.br"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Token da API
        </label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={apiConfigs.evolution.apiToken}
            onChange={(e) => handleInputChange('evolution', 'apiToken', e.target.value)}
            placeholder="Token de autenticação"
            className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showToken ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instância
        </label>
        <input
          type="text"
          value={apiConfigs.evolution.instance}
          onChange={(e) => handleInputChange('evolution', 'instance', e.target.value)}
          placeholder="Nome da instância"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Grupo WhatsApp (Prevenção)
          </label>
          {!savedGroup && !isEditingGroup && (
            <button
              onClick={loadWhatsAppGroups}
              disabled={loadingGroups}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition flex items-center gap-2"
            >
              {loadingGroups ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Carregando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Carregar Grupos
                </>
              )}
            </button>
          )}
          {isEditingGroup && (
            <button
              onClick={loadWhatsAppGroups}
              disabled={loadingGroups}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition flex items-center gap-2"
            >
              {loadingGroups ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Carregando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Carregar Grupos
                </>
              )}
            </button>
          )}
        </div>

        {/* Grupo Salvo */}
        {savedGroup && !isEditingGroup && (
          <div className="border-2 border-green-500 bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="font-semibold text-sm text-green-900">Grupo Selecionado</p>
                </div>
                <p className="font-medium text-gray-900">{savedGroup.subject || 'Sem nome'}</p>
                <p className="text-xs text-gray-600 mt-1">{savedGroup.id}</p>
              </div>
              <button
                onClick={handleEditGroup}
                className="ml-4 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            </div>
          </div>
        )}

        {/* Lista de Grupos (modo seleção ou edição) */}
        {evolutionGroups.length > 0 && (!savedGroup || isEditingGroup) && (
          <>
            <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto">
              <p className="text-xs text-gray-600 mb-2">Clique em um grupo para selecioná-lo:</p>
              {evolutionGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={`p-3 mb-2 rounded-lg cursor-pointer transition ${
                    selectedGroup?.id === group.id
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{group.subject || 'Sem nome'}</p>
                      <p className="text-xs text-gray-500">{group.id}</p>
                    </div>
                    {selectedGroup?.id === group.id && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Botões de Salvar/Cancelar */}
            {selectedGroup && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveGroup}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition font-medium"
                >
                  Salvar Grupo
                </button>
                {isEditingGroup && (
                  <button
                    onClick={handleCancelEditGroup}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition font-medium"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {(selectedGroup || savedGroup) && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Testar Envio de Mensagem</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Mensagem de Teste</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Digite uma mensagem de teste..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={sendTestMessage}
              disabled={sendingTestMessage || !selectedGroup}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sendingTestMessage || !selectedGroup
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {sendingTestMessage ? 'Enviando...' : 'Enviar Mensagem de Teste'}
            </button>
          </div>
        </div>
      )}

      <div className="pt-4 border-t">
        {renderTestButton('evolution')}
      </div>

      {renderTestResult('evolution')}
    </div>
  );

  const renderDatabaseForm = () => (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-indigo-800">
          Configurações do Banco de Dados PostgreSQL
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Host / Endereço IP
        </label>
        <input
          type="text"
          value={apiConfigs.database.host}
          onChange={(e) => handleInputChange('database', 'host', e.target.value)}
          placeholder="localhost ou IP do servidor"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Porta
        </label>
        <input
          type="text"
          value={apiConfigs.database.port}
          onChange={(e) => handleInputChange('database', 'port', e.target.value)}
          placeholder="5432"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Usuário
        </label>
        <input
          type="text"
          value={apiConfigs.database.username}
          onChange={(e) => handleInputChange('database', 'username', e.target.value)}
          placeholder="postgres"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Senha
        </label>
        <input
          type="password"
          value={apiConfigs.database.password}
          onChange={(e) => handleInputChange('database', 'password', e.target.value)}
          placeholder="Senha do banco de dados"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nome do Banco de Dados
        </label>
        <input
          type="text"
          value={apiConfigs.database.databaseName}
          onChange={(e) => handleInputChange('database', 'databaseName', e.target.value)}
          placeholder="market_security"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="pt-4 border-t">
        {renderTestButton('database')}
      </div>

      {renderTestResult('database')}
    </div>
  );

  const renderSimulatorForm = () => {
    return <SimulatorTab />;
  };

  const renderMinioForm = () => (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-orange-800">
          MinIO - Armazenamento de imagens e avatares dos colaboradores
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Endpoint / Host
        </label>
        <input
          type="text"
          value={apiConfigs.minio.endpoint}
          onChange={(e) => handleInputChange('minio', 'endpoint', e.target.value)}
          placeholder="localhost ou IP do servidor"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Porta
        </label>
        <input
          type="text"
          value={apiConfigs.minio.port}
          onChange={(e) => handleInputChange('minio', 'port', e.target.value)}
          placeholder="9000"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Access Key
        </label>
        <input
          type="text"
          value={apiConfigs.minio.accessKey}
          onChange={(e) => handleInputChange('minio', 'accessKey', e.target.value)}
          placeholder="minioadmin"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Secret Key
        </label>
        <input
          type="password"
          value={apiConfigs.minio.secretKey}
          onChange={(e) => handleInputChange('minio', 'secretKey', e.target.value)}
          placeholder="Chave secreta"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nome do Bucket
        </label>
        <input
          type="text"
          value={apiConfigs.minio.bucketName}
          onChange={(e) => handleInputChange('minio', 'bucketName', e.target.value)}
          placeholder="employee-avatars"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="useSSL"
          checked={apiConfigs.minio.useSSL}
          onChange={(e) => handleInputChange('minio', 'useSSL', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="useSSL" className="ml-2 block text-sm text-gray-700">
          Usar SSL (HTTPS)
        </label>
      </div>

      <div className="pt-4 border-t">
        {renderTestButton('minio')}
      </div>

      {renderTestResult('minio')}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Sub-tabs Navigation */}
      <div className="border-b border-gray-200 px-6 pt-4">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="API Tabs">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition
                ${activeSubTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Forms Content */}
      <div className="p-6">
        {activeSubTab === 'zanthus' && renderZanthusForm()}
        {activeSubTab === 'intersolid' && renderIntersolidForm()}
        {activeSubTab === 'evolution' && renderEvolutionForm()}
        {activeSubTab === 'database' && renderDatabaseForm()}
        {activeSubTab === 'minio' && renderMinioForm()}
        {activeSubTab === 'simulator' && renderSimulatorForm()}

        {/* Save Button - Apenas para abas de configuração */}
        {activeSubTab !== 'simulator' && (
          <div className="mt-6 flex justify-end border-t pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`
                px-6 py-2 rounded-lg font-medium transition
                ${isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
