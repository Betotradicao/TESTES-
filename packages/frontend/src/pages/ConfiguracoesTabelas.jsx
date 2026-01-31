import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Tipos de banco de dados suportados
const DATABASE_TYPES = [
  { id: 'oracle', name: 'Oracle', icon: '🔶', color: 'bg-red-500' },
  { id: 'sqlserver', name: 'SQL Server', icon: '🔷', color: 'bg-blue-500' },
  { id: 'mysql', name: 'MySQL', icon: '🐬', color: 'bg-cyan-500' },
  { id: 'postgres', name: 'PostgreSQL', icon: '🐘', color: 'bg-indigo-500' },
];

// Módulos do sistema que podem ser mapeados
const SYSTEM_MODULES = [
  {
    id: 'produtos',
    name: 'Produtos',
    icon: '📦',
    description: 'Código, descrição, preço, estoque, seção, grupo',
    fields: [
      { id: 'codigo', name: 'Código do Produto', required: true, description: 'Identificador único do produto' },
      { id: 'descricao', name: 'Descrição', required: true, description: 'Nome completo do produto' },
      { id: 'descricao_reduzida', name: 'Descrição Reduzida', required: false, description: 'Nome curto para etiquetas' },
      { id: 'ean', name: 'Código de Barras (EAN)', required: false, description: 'Código de barras principal' },
      { id: 'preco_venda', name: 'Preço de Venda', required: true, description: 'Preço atual de venda' },
      { id: 'preco_oferta', name: 'Preço de Oferta', required: false, description: 'Preço promocional' },
      { id: 'preco_custo', name: 'Custo de Reposição', required: false, description: 'Custo atual do produto' },
      { id: 'estoque', name: 'Estoque Atual', required: false, description: 'Quantidade em estoque' },
      { id: 'margem', name: 'Margem', required: false, description: 'Margem de lucro atual' },
      { id: 'curva', name: 'Curva ABC', required: false, description: 'Classificação A, B, C ou X' },
      { id: 'secao', name: 'Seção', required: false, description: 'Nome da seção (ex: AÇOUGUE)' },
      { id: 'grupo', name: 'Grupo', required: false, description: 'Nome do grupo (ex: BOVINOS)' },
      { id: 'subgrupo', name: 'Subgrupo', required: false, description: 'Nome do subgrupo' },
      { id: 'fornecedor', name: 'Fornecedor', required: false, description: 'Nome do fornecedor principal' },
      { id: 'pesavel', name: 'É Pesável?', required: false, description: 'Se o produto é vendido por peso' },
    ]
  },
  {
    id: 'vendas',
    name: 'Vendas/PDV',
    icon: '💰',
    description: 'Cupons, itens vendidos, cancelamentos, operadores',
    fields: [
      { id: 'numero_cupom', name: 'Número do Cupom', required: true, description: 'Identificador único da venda' },
      { id: 'data_venda', name: 'Data da Venda', required: true, description: 'Data e hora da venda' },
      { id: 'valor_total', name: 'Valor Total', required: true, description: 'Valor total do cupom' },
      { id: 'cod_operador', name: 'Código Operador', required: false, description: 'ID do operador de caixa' },
      { id: 'nome_operador', name: 'Nome Operador', required: false, description: 'Nome do operador' },
      { id: 'cod_pdv', name: 'Código PDV', required: false, description: 'Identificador do caixa/terminal' },
      { id: 'status_cupom', name: 'Status do Cupom', required: false, description: 'Se foi cancelado, finalizado, etc' },
    ]
  },
  {
    id: 'estoque',
    name: 'Estoque',
    icon: '📊',
    description: 'Movimentações, ajustes, entradas, saídas',
    fields: [
      { id: 'cod_produto', name: 'Código do Produto', required: true, description: 'Produto movimentado' },
      { id: 'quantidade', name: 'Quantidade', required: true, description: 'Quantidade movimentada' },
      { id: 'tipo_movimento', name: 'Tipo de Movimento', required: true, description: 'Entrada, saída, ajuste' },
      { id: 'data_movimento', name: 'Data do Movimento', required: true, description: 'Quando ocorreu' },
      { id: 'motivo', name: 'Motivo', required: false, description: 'Razão da movimentação' },
    ]
  },
  {
    id: 'fornecedores',
    name: 'Fornecedores',
    icon: '🏭',
    description: 'Cadastro de fornecedores, contatos',
    fields: [
      { id: 'codigo', name: 'Código do Fornecedor', required: true, description: 'ID único' },
      { id: 'razao_social', name: 'Razão Social', required: true, description: 'Nome oficial' },
      { id: 'fantasia', name: 'Nome Fantasia', required: false, description: 'Nome comercial' },
      { id: 'cnpj', name: 'CNPJ', required: false, description: 'Documento do fornecedor' },
      { id: 'telefone', name: 'Telefone', required: false, description: 'Contato principal' },
    ]
  },
  {
    id: 'notas_fiscais',
    name: 'Notas Fiscais',
    icon: '📑',
    description: 'NFs de entrada, compras, custos',
    fields: [
      { id: 'numero_nf', name: 'Número da NF', required: true, description: 'Número da nota fiscal' },
      { id: 'serie', name: 'Série', required: false, description: 'Série da NF' },
      { id: 'data_entrada', name: 'Data de Entrada', required: true, description: 'Quando a NF entrou' },
      { id: 'cod_fornecedor', name: 'Código Fornecedor', required: true, description: 'Quem emitiu a NF' },
      { id: 'valor_total', name: 'Valor Total', required: false, description: 'Valor total da NF' },
      { id: 'chave_acesso', name: 'Chave de Acesso', required: false, description: 'Chave NFe' },
    ]
  },
];

export default function ConfiguracoesTabelas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('conexoes');

  // Estado para Conexões
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Estado para Mapeamento
  const [selectedModule, setSelectedModule] = useState('produtos');
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [mappings, setMappings] = useState({});
  const [availableTables, setAvailableTables] = useState([]);
  const [availableColumns, setAvailableColumns] = useState({});
  const [loadingTables, setLoadingTables] = useState(false);
  const [testingMapping, setTestingMapping] = useState(false);
  const [mappingTestResult, setMappingTestResult] = useState(null);

  // Verificar se é Master
  useEffect(() => {
    if (!user?.isMaster) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Carregar conexões ao iniciar
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get('/database-connections');
      setConnections(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      // Mock data para visualização
      setConnections([
        {
          id: 1,
          name: 'Oracle - Intersolid',
          type: 'oracle',
          host: '10.6.1.102',
          port: '1521',
          database: 'ORCL',
          schema: 'INTERSOLID',
          username: 'sistema',
          active: true,
          readOnly: true,
          lastTest: new Date().toISOString(),
          testSuccess: true
        }
      ]);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleTestConnection = async (connection) => {
    setTestingConnection(connection.id);
    setTestResult(null);

    try {
      const response = await api.post(`/database-connections/${connection.id}/test`);
      setTestResult({
        success: true,
        message: 'Conexão bem sucedida!',
        details: response.data
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Falha na conexão',
        details: error.response?.data
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSaveConnection = async (connectionData) => {
    try {
      if (editingConnection) {
        await api.put(`/database-connections/${editingConnection.id}`, connectionData);
      } else {
        await api.post('/database-connections', connectionData);
      }
      loadConnections();
      setShowConnectionModal(false);
      setEditingConnection(null);
    } catch (error) {
      console.error('Erro ao salvar conexão:', error);
      alert('Erro ao salvar conexão: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!confirm('Tem certeza que deseja excluir esta conexão?')) return;

    try {
      await api.delete(`/database-connections/${connectionId}`);
      loadConnections();
    } catch (error) {
      console.error('Erro ao excluir conexão:', error);
      alert('Erro ao excluir conexão');
    }
  };

  const renderConnectionsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conexões de Banco de Dados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure as conexões com os bancos de dados externos (ERP, PDV, etc)
          </p>
        </div>
        <button
          onClick={() => {
            setEditingConnection(null);
            setShowConnectionModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nova Conexão
        </button>
      </div>

      {/* Lista de Conexões */}
      {loadingConnections ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando conexões...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão configurada</h3>
          <p className="text-gray-500 mb-6">
            Configure a primeira conexão com seu banco de dados para começar a mapear as tabelas.
          </p>
          <button
            onClick={() => setShowConnectionModal(true)}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Configurar Primeira Conexão
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map(conn => {
            const dbType = DATABASE_TYPES.find(t => t.id === conn.type);
            return (
              <div
                key={conn.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Ícone do tipo de banco */}
                    <div className={`w-12 h-12 ${dbType?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white text-2xl`}>
                      {dbType?.icon || '🗄️'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{conn.name}</h3>
                        {conn.active ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Ativo</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Inativo</span>
                        )}
                        {conn.readOnly && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Somente Leitura</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {dbType?.name || conn.type} • {conn.host}:{conn.port} • {conn.database || conn.schema}
                      </p>
                      {conn.lastTest && (
                        <p className="text-xs text-gray-400 mt-1">
                          Último teste: {new Date(conn.lastTest).toLocaleString('pt-BR')}
                          {conn.testSuccess ? ' ✅' : ' ❌'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={testingConnection === conn.id}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {testingConnection === conn.id ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                          Testando...
                        </span>
                      ) : (
                        '🔌 Testar'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingConnection(conn);
                        setShowConnectionModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Resultado do teste */}
                {testResult && testingConnection === null && conn.id === connections.find(c => c.id === conn.id)?.id && (
                  <div className={`mt-4 p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-sm font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.success ? '✅' : '❌'} {testResult.message}
                    </p>
                    {testResult.details?.tables && (
                      <p className="text-xs text-gray-500 mt-1">
                        📊 {testResult.details.tables} tabelas encontradas
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMappingTab = () => {
    const currentModule = SYSTEM_MODULES.find(m => m.id === selectedModule);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mapeamento de Tabelas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Conecte os campos do sistema Prevenção às colunas do seu banco de dados
          </p>
        </div>

        {/* Seletor de Módulo */}
        <div className="flex flex-wrap gap-3">
          {SYSTEM_MODULES.map(module => (
            <button
              key={module.id}
              onClick={() => setSelectedModule(module.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                selectedModule === module.id
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <span className="text-2xl">{module.icon}</span>
              <div className="text-left">
                <div className="font-medium">{module.name}</div>
                <div className="text-xs opacity-75">{module.fields.length} campos</div>
              </div>
            </button>
          ))}
        </div>

        {/* Área de Mapeamento */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header do Módulo */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{currentModule?.icon}</span>
              <div>
                <h3 className="text-xl font-bold">{currentModule?.name}</h3>
                <p className="text-orange-100">{currentModule?.description}</p>
              </div>
            </div>
          </div>

          {/* Seletor de Conexão */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conexão de Banco de Dados:
            </label>
            <select
              value={selectedConnection || ''}
              onChange={(e) => setSelectedConnection(e.target.value || null)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Selecione uma conexão...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {DATABASE_TYPES.find(t => t.id === conn.type)?.icon} {conn.name} ({conn.host})
                </option>
              ))}
            </select>
          </div>

          {/* Tabela de Mapeamento */}
          {selectedConnection ? (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Campo do Sistema</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tabela</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Coluna</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentModule?.fields.map(field => (
                      <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {field.required && (
                              <span className="w-2 h-2 bg-red-500 rounded-full" title="Campo obrigatório"></span>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{field.name}</div>
                              <div className="text-xs text-gray-500">{field.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            defaultValue=""
                          >
                            <option value="">Selecione...</option>
                            <option value="TAB_PRODUTO">TAB_PRODUTO</option>
                            <option value="TAB_PRODUTO_LOJA">TAB_PRODUTO_LOJA</option>
                            <option value="TAB_SECAO">TAB_SECAO</option>
                            <option value="TAB_GRUPO">TAB_GRUPO</option>
                            <option value="TAB_FORNECEDOR">TAB_FORNECEDOR</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            defaultValue=""
                          >
                            <option value="">Selecione...</option>
                            <option value="COD_PRODUTO">COD_PRODUTO</option>
                            <option value="DES_PRODUTO">DES_PRODUTO</option>
                            <option value="VAL_VENDA">VAL_VENDA</option>
                            <option value="VAL_OFERTA">VAL_OFERTA</option>
                            <option value="QTD_EST_ATUAL">QTD_EST_ATUAL</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-400 italic">-</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Código do produto para testar..."
                    className="px-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    🔄 Testar Busca
                  </button>
                </div>
                <button className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  Salvar Mapeamento
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👆</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma conexão</h3>
              <p className="text-gray-500">
                Escolha uma conexão de banco de dados acima para configurar o mapeamento.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Modal de Nova/Editar Conexão
  const ConnectionModal = () => {
    const [formData, setFormData] = useState(editingConnection || {
      name: '',
      type: 'oracle',
      host: '',
      port: '',
      database: '',
      schema: '',
      username: '',
      password: '',
      readOnly: true,
      active: true
    });

    const dbType = DATABASE_TYPES.find(t => t.id === formData.type);

    const handleChange = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                  🔌
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {editingConnection ? 'Editar Conexão' : 'Nova Conexão de Banco'}
                  </h3>
                  <p className="text-orange-100 text-sm">
                    Configure os dados de acesso ao banco de dados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectionModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Formulário */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Nome da Conexão */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Conexão *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: ERP Principal, Oracle Intersolid..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Tipo de Banco */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Banco de Dados *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DATABASE_TYPES.map(db => (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => handleChange('type', db.id)}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      formData.type === db.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl mb-1">{db.icon}</span>
                    <span className="text-sm font-medium">{db.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campos de conexão em grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Host/IP *
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  placeholder="Ex: 192.168.1.100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porta *
                </label>
                <input
                  type="text"
                  value={formData.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  placeholder={formData.type === 'oracle' ? '1521' : formData.type === 'sqlserver' ? '1433' : '3306'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === 'oracle' ? 'SID/Service Name' : 'Database'} *
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => handleChange('database', e.target.value)}
                  placeholder={formData.type === 'oracle' ? 'ORCL' : 'nome_banco'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              {formData.type === 'oracle' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schema
                  </label>
                  <input
                    type="text"
                    value={formData.schema}
                    onChange={(e) => handleChange('schema', e.target.value)}
                    placeholder="Ex: INTERSOLID"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="usuario_banco"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Opções */}
            <div className="flex flex-wrap gap-6 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.readOnly}
                  onChange={(e) => handleChange('readOnly', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <span className="font-medium text-gray-700">Somente Leitura</span>
                  <p className="text-xs text-gray-500">Recomendado para segurança</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <span className="font-medium text-gray-700">Conexão Ativa</span>
                  <p className="text-xs text-gray-500">Habilitar esta conexão</p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setShowConnectionModal(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-6 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors"
              >
                🔌 Testar Conexão
              </button>
              <button
                onClick={() => handleSaveConnection(formData)}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                💾 Salvar Conexão
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Configurações de Tabelas</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        <main className="p-4 lg:p-8">
          {/* Header Principal */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-lg p-8 mb-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Configurações de Tabelas</h1>
                <p className="text-purple-200 mt-1">
                  Configure conexões de banco de dados e mapeie as tabelas do seu ERP
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('conexoes')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'conexoes'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              🔌 Conexões
            </button>
            <button
              onClick={() => setActiveTab('mapeamento')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'mapeamento'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              📋 Mapeamento
            </button>
          </div>

          {/* Conteúdo das Tabs */}
          {activeTab === 'conexoes' && renderConnectionsTab()}
          {activeTab === 'mapeamento' && renderMappingTab()}
        </main>
      </div>

      {/* Modal de Conexão */}
      {showConnectionModal && <ConnectionModal />}
    </div>
  );
}
