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

// Mapeamento padrão para Oracle Intersolid (pré-preenchido para facilitar)
const DEFAULT_MAPPINGS = {
  // Módulo: Produtos
  'produtos_codigo_table': 'TAB_PRODUTO',
  'produtos_codigo_column': 'COD_PRODUTO',
  'produtos_descricao_table': 'TAB_PRODUTO',
  'produtos_descricao_column': 'DES_PRODUTO',
  'produtos_descricao_reduzida_table': 'TAB_PRODUTO',
  'produtos_descricao_reduzida_column': 'DES_REDUZIDA',
  'produtos_ean_table': 'TAB_PRODUTO',
  'produtos_ean_column': 'COD_BARRA_PRINCIPAL',
  'produtos_preco_venda_table': 'TAB_PRODUTO_LOJA',
  'produtos_preco_venda_column': 'VAL_VENDA',
  'produtos_preco_oferta_table': 'TAB_PRODUTO_LOJA',
  'produtos_preco_oferta_column': 'VAL_OFERTA',
  'produtos_preco_custo_table': 'TAB_PRODUTO_LOJA',
  'produtos_preco_custo_column': 'VAL_CUSTO_REP',
  'produtos_estoque_table': 'TAB_PRODUTO_LOJA',
  'produtos_estoque_column': 'QTD_EST_ATUAL',
  'produtos_margem_table': 'TAB_PRODUTO_LOJA',
  'produtos_margem_column': 'VAL_MARGEM',
  'produtos_curva_table': 'TAB_PRODUTO_LOJA',
  'produtos_curva_column': 'DES_RANK_PRODLOJA',
  'produtos_secao_table': 'TAB_SECAO',
  'produtos_secao_column': 'DES_SECAO',
  'produtos_grupo_table': 'TAB_GRUPO',
  'produtos_grupo_column': 'DES_GRUPO',
  'produtos_subgrupo_table': 'TAB_SUBGRUPO',
  'produtos_subgrupo_column': 'DES_SUB_GRUPO',
  'produtos_fornecedor_table': 'TAB_FORNECEDOR',
  'produtos_fornecedor_column': 'DES_FORNECEDOR',
  'produtos_pesavel_table': 'TAB_PRODUTO',
  'produtos_pesavel_column': 'IPV',

  // Módulo: Vendas/PDV (TAB_PRODUTO_PDV é a tabela principal de vendas)
  'vendas_numero_cupom_table': 'TAB_PRODUTO_PDV',
  'vendas_numero_cupom_column': 'NUM_CUPOM_FISCAL',
  'vendas_data_venda_table': 'TAB_PRODUTO_PDV',
  'vendas_data_venda_column': 'DTA_SAIDA',
  'vendas_valor_total_table': 'TAB_PRODUTO_PDV',
  'vendas_valor_total_column': 'VAL_TOTAL_PRODUTO',
  'vendas_cod_operador_table': 'TAB_PRODUTO_PDV',
  'vendas_cod_operador_column': 'COD_VENDEDOR',
  'vendas_nome_operador_table': 'TAB_OPERADORES',
  'vendas_nome_operador_column': 'DES_OPERADOR',
  'vendas_cod_pdv_table': 'TAB_PRODUTO_PDV',
  'vendas_cod_pdv_column': 'NUM_PDV',
  'vendas_status_cupom_table': 'TAB_PRODUTO_PDV',
  'vendas_status_cupom_column': 'FLG_CUPOM_CANCELADO',

  // Módulo: Estoque (TAB_AJUSTE_ESTOQUE)
  'estoque_cod_produto_table': 'TAB_AJUSTE_ESTOQUE',
  'estoque_cod_produto_column': 'COD_PRODUTO',
  'estoque_quantidade_table': 'TAB_AJUSTE_ESTOQUE',
  'estoque_quantidade_column': 'QTD_AJUSTE',
  'estoque_tipo_movimento_table': 'TAB_AJUSTE_ESTOQUE',
  'estoque_tipo_movimento_column': 'COD_AJUSTE',
  'estoque_data_movimento_table': 'TAB_AJUSTE_ESTOQUE',
  'estoque_data_movimento_column': 'DTA_AJUSTE',
  'estoque_motivo_table': 'TAB_AJUSTE_ESTOQUE',
  'estoque_motivo_column': 'MOTIVO',

  // Módulo: Fornecedores
  'fornecedores_codigo_table': 'TAB_FORNECEDOR',
  'fornecedores_codigo_column': 'COD_FORNECEDOR',
  'fornecedores_razao_social_table': 'TAB_FORNECEDOR',
  'fornecedores_razao_social_column': 'DES_FORNECEDOR',
  'fornecedores_fantasia_table': 'TAB_FORNECEDOR',
  'fornecedores_fantasia_column': 'DES_FANTASIA',
  'fornecedores_cnpj_table': 'TAB_FORNECEDOR',
  'fornecedores_cnpj_column': 'NUM_CGC',
  'fornecedores_telefone_table': 'TAB_FORNECEDOR',
  'fornecedores_telefone_column': 'NUM_FONE',

  // Módulo: Notas Fiscais (TAB_FORNECEDOR_NOTA)
  'notas_fiscais_numero_nf_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_numero_nf_column': 'NUM_NF_FORN',
  'notas_fiscais_serie_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_serie_column': 'NUM_SERIE_NF',
  'notas_fiscais_data_entrada_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_data_entrada_column': 'DTA_ENTRADA',
  'notas_fiscais_cod_fornecedor_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_cod_fornecedor_column': 'COD_FORNECEDOR',
  'notas_fiscais_valor_total_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_valor_total_column': 'VAL_TOTAL_NF',
  'notas_fiscais_chave_acesso_table': 'TAB_FORNECEDOR_NOTA',
  'notas_fiscais_chave_acesso_column': 'NUM_CHAVE_ACESSO',
};

export default function ConfiguracoesTabelas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('erp');

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
  const [mappings, setMappings] = useState(DEFAULT_MAPPINGS); // Pré-preenchido com valores padrão
  const [availableTables, setAvailableTables] = useState([]);
  const [availableColumns, setAvailableColumns] = useState({});
  const [loadingTables, setLoadingTables] = useState(false);
  const [testingMapping, setTestingMapping] = useState(null); // ID do campo sendo testado
  const [testResults, setTestResults] = useState({}); // Resultados dos testes por campo

  // Estado para ERP Templates
  const [erpTemplates, setErpTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Estado para rastrear módulos salvos
  const [savedModules, setSavedModules] = useState({
    produtos: false,
    vendas: false,
    estoque: false,
    fornecedores: false,
    notas_fiscais: false
  });

  // Verificar se todos os módulos foram salvos
  const allModulesSaved = Object.values(savedModules).every(saved => saved);

  // Verificar se é Master
  useEffect(() => {
    if (!user?.isMaster) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Carregar conexões e templates ao iniciar
  useEffect(() => {
    loadConnections();
    loadErpTemplates();
  }, []);

  // Função para carregar templates de ERP
  const loadErpTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.get('/erp-templates');
      setErpTemplates(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar templates ERP:', error);
      setErpTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Função para salvar template ERP
  const handleSaveErpTemplate = async (templateName) => {
    try {
      const selectedConn = connections.find(c => c.id == selectedConnection);
      const response = await api.post('/erp-templates', {
        name: templateName,
        description: `Template para ERP ${templateName}`,
        database_type: selectedConn?.type || 'oracle',
        mappings: mappings
      });

      if (response.data.success) {
        alert('Template ERP salvo com sucesso!');
        loadErpTemplates();
        setShowSaveTemplateModal(false);
      } else {
        alert('Erro ao salvar template: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao salvar template ERP:', error);
      alert('Erro ao salvar template: ' + (error.response?.data?.error || error.message));
    }
  };

  // Função para aplicar template ERP
  const handleApplyTemplate = (template) => {
    try {
      const templateMappings = typeof template.mappings === 'string'
        ? JSON.parse(template.mappings)
        : template.mappings;
      setMappings(templateMappings);
      setSelectedTemplate(template);

      // Marcar todos os módulos como salvos (já que vieram do template)
      setSavedModules({
        produtos: true,
        vendas: true,
        estoque: true,
        fornecedores: true,
        notas_fiscais: true
      });

      // Abrir modal de conexão diretamente com o tipo de banco do template travado
      setEditingConnection(null);
      setShowConnectionModal(true);
    } catch (error) {
      console.error('Erro ao aplicar template:', error);
      alert('Erro ao aplicar template');
    }
  };

  // Função para excluir template ERP
  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      await api.delete(`/erp-templates/${templateId}`);
      loadErpTemplates();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      alert('Erro ao excluir template');
    }
  };

  // Função para upload de logo do ERP
  const handleUploadLogo = async (templateId, file) => {
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('templateId', templateId.toString());

      const response = await api.post('/erp-templates/upload-logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        loadErpTemplates(); // Recarregar para mostrar o novo logo
      } else {
        alert('Erro ao fazer upload: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      alert('Erro ao fazer upload do logo');
    }
  };

  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get('/database-connections');
      // Mapear campos do backend para o frontend
      const mapped = (response.data || []).map(conn => ({
        ...conn,
        active: conn.status === 'active',
        readOnly: true, // Por segurança, sempre somente leitura
        database: conn.service || conn.database, // Oracle usa service
        lastTest: conn.last_test_at,
        testSuccess: conn.status === 'active'
      }));
      setConnections(mapped);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      // Em caso de erro, lista vazia
      setConnections([]);
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

  const handleSaveConnection = async (connectionData, testPassed = false) => {
    try {
      // Mapear campos do formulário para o backend
      const payload = {
        name: connectionData.name,
        type: connectionData.type,
        host: connectionData.host,
        port: connectionData.port,
        service: connectionData.service || connectionData.database, // Oracle usa service
        database: connectionData.database,
        schema: connectionData.schema,
        username: connectionData.username,
        password: connectionData.password, // Só envia se preenchido
        is_default: false,
        status: testPassed ? 'active' : 'inactive' // Status baseado no resultado do teste
      };

      // Não enviar senha vazia ao editar (mantém a existente)
      if (!payload.password && editingConnection) {
        delete payload.password;
      }

      if (editingConnection) {
        await api.put(`/database-connections/${editingConnection.id}`, payload);
      } else {
        await api.post('/database-connections', payload);
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

  // Testar mapeamento de uma tabela/coluna específica
  const handleTestMapping = async (fieldId) => {
    const tableName = mappings[`${selectedModule}_${fieldId}_table`];
    const columnName = mappings[`${selectedModule}_${fieldId}_column`];

    if (!tableName || !columnName) {
      alert('Preencha o nome da tabela e da coluna antes de testar');
      return;
    }

    setTestingMapping(fieldId);
    setTestResults(prev => ({
      ...prev,
      [fieldId]: { loading: true }
    }));

    try {
      const response = await api.post('/database-connections/test-mapping', {
        connectionId: selectedConnection,
        tableName,
        columnName
      });

      setTestResults(prev => ({
        ...prev,
        [fieldId]: {
          loading: false,
          success: response.data.success,
          sample: response.data.sample,
          message: response.data.message,
          count: response.data.count
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [fieldId]: {
          loading: false,
          success: false,
          message: error.response?.data?.message || 'Erro ao testar'
        }
      }));
    } finally {
      setTestingMapping(null);
    }
  };

  // Testar TODOS os mapeamentos do módulo atual
  const [testingAll, setTestingAll] = useState(false);
  const handleTestAllMappings = async () => {
    const currentModule = SYSTEM_MODULES.find(m => m.id === selectedModule);
    if (!currentModule || !selectedConnection) return;

    setTestingAll(true);

    // Testar cada campo sequencialmente
    for (const field of currentModule.fields) {
      const tableName = mappings[`${selectedModule}_${field.id}_table`];
      const columnName = mappings[`${selectedModule}_${field.id}_column`];

      if (!tableName || !columnName) {
        setTestResults(prev => ({
          ...prev,
          [field.id]: {
            loading: false,
            success: false,
            message: 'Tabela/coluna não preenchida'
          }
        }));
        continue;
      }

      setTestResults(prev => ({
        ...prev,
        [field.id]: { loading: true }
      }));

      try {
        const response = await api.post('/database-connections/test-mapping', {
          connectionId: selectedConnection,
          tableName,
          columnName
        });

        setTestResults(prev => ({
          ...prev,
          [field.id]: {
            loading: false,
            success: response.data.success,
            sample: response.data.sample,
            message: response.data.message,
            count: response.data.count
          }
        }));
      } catch (error) {
        setTestResults(prev => ({
          ...prev,
          [field.id]: {
            loading: false,
            success: false,
            message: error.response?.data?.message || 'Erro ao testar'
          }
        }));
      }

      // Pequena pausa entre cada teste para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setTestingAll(false);
  };

  // Salvar mapeamentos
  const [savingMappings, setSavingMappings] = useState(false);
  const handleSaveMappings = async () => {
    if (!selectedConnection) {
      alert('Selecione uma conexão primeiro!');
      return;
    }

    setSavingMappings(true);
    try {
      // Salvar os mapeamentos no backend
      const response = await api.post('/database-connections/save-mappings', {
        connectionId: selectedConnection,
        module: selectedModule,
        mappings: mappings
      });

      if (response.data.success) {
        // Marcar o módulo atual como salvo
        setSavedModules(prev => ({
          ...prev,
          [selectedModule]: true
        }));
        alert('✅ Mapeamentos salvos com sucesso!');
      } else {
        alert('❌ Erro ao salvar: ' + (response.data.message || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      alert('❌ Erro ao salvar mapeamentos: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingMappings(false);
    }
  };

  // Render da aba ERP Cliente
  const renderErpTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Templates de ERP</h2>
          <p className="text-sm text-gray-500 mt-1">
            Selecione um ERP pré-configurado para agilizar a configuração de novos clientes
          </p>
        </div>
      </div>

      {/* Lista de Templates */}
      {loadingTemplates ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando templates...</p>
        </div>
      ) : erpTemplates.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum template de ERP configurado</h3>
          <p className="text-gray-500 mb-6">
            Configure os mapeamentos na aba "Mapeamento" e salve como template para reutilizar.
          </p>
          <button
            onClick={() => setActiveTab('mapeamento')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Ir para Mapeamento
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {erpTemplates.map(template => {
            const dbType = DATABASE_TYPES.find(t => t.id === template.database_type);
            return (
              <div
                key={template.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => handleApplyTemplate(template)}
              >
                {/* Linha superior: Logo ERP + Info */}
                <div className="flex items-center gap-3 mb-3">
                  {/* Logo do ERP - no início */}
                  {template.logo_url ? (
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 h-20 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Clique para alterar o logo"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadLogo(template.id, e.target.files[0])}
                      />
                      <img
                        src={template.logo_url}
                        alt={`Logo ${template.name}`}
                        className="w-20 h-20 object-contain rounded-lg bg-gray-50 p-1"
                      />
                    </label>
                  ) : (
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-orange-400 hover:text-orange-500 transition-all flex-shrink-0"
                      title="Adicionar logo"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadLogo(template.id, e.target.files[0])}
                      />
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span className="text-[10px] mt-0.5">Logo</span>
                    </label>
                  )}

                  {/* Info do template */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{template.description || 'Template de mapeamento'}</p>
                  </div>
                </div>

                {/* Botão usar template + ícone banco + lixeira */}
                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyTemplate(template);
                    }}
                  >
                    Usar este Template
                  </button>
                  {/* Ícone do tipo de banco */}
                  <div className={`w-9 h-9 ${dbType?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0`} title={dbType?.name || template.database_type}>
                    {dbType?.icon || '🗄️'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir template"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-800 mb-2">Como funciona?</h4>
        <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
          <li>Selecione um template de ERP acima (ou crie um novo na aba Mapeamento)</li>
          <li>Os mapeamentos de tabelas serão preenchidos automaticamente</li>
          <li>Na aba Conexões, configure apenas: Host, Porta, Usuário e Senha</li>
          <li>Teste a conexão e salve!</li>
        </ol>
      </div>
    </div>
  );

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
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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

        {/* Seletor de Módulo + Botão Salvar Padrão ERP */}
        <div className="flex flex-wrap items-center gap-3">
          {SYSTEM_MODULES.map(module => {
            const isSaved = savedModules[module.id];
            return (
              <button
                key={module.id}
                onClick={() => setSelectedModule(module.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all relative ${
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
                {/* Indicador de status no canto superior direito */}
                <span className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  isSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {isSaved ? '✓' : '!'}
                </span>
              </button>
            );
          })}

          {/* Botão Salvar Padrão ERP - no final da linha dos módulos */}
          <button
            onClick={() => {
              if (!allModulesSaved) {
                const pendingCount = Object.values(savedModules).filter(s => !s).length;
                alert(`⚠️ Salve todos os módulos primeiro!\n\nFaltam ${pendingCount} módulo(s) para salvar.`);
                return;
              }
              setShowSaveTemplateModal(true);
            }}
            disabled={!allModulesSaved}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
              allModulesSaved
                ? 'border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer'
                : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="text-2xl">{allModulesSaved ? '💾' : '🔒'}</span>
            <div className="text-left">
              <div className="font-medium">Salvar Padrão ERP</div>
              <div className="text-xs opacity-75">
                {allModulesSaved
                  ? 'Criar template'
                  : `${Object.values(savedModules).filter(s => !s).length} módulo(s) pendente(s)`}
              </div>
            </div>
          </button>
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
              {/* Dica e botão Testar Todos */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 Dica:</strong> O schema <strong>({connections.find(c => c.id == selectedConnection)?.schema || 'N/A'})</strong> será usado automaticamente nas consultas.
                  </p>
                </div>
                <button
                  onClick={handleTestAllMappings}
                  disabled={testingAll}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                >
                  {testingAll ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Testando...
                    </>
                  ) : (
                    <>🚀 Testar Todos</>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700" style={{width: '160px'}}>Campo</th>
                      <th className="text-left py-3 px-2 font-semibold text-gray-700" style={{width: '220px'}}>Tabela</th>
                      <th className="text-left py-3 px-2 font-semibold text-gray-700" style={{width: '240px'}}>Coluna</th>
                      <th className="text-center py-3 px-2 font-semibold text-gray-700" style={{width: '50px'}}></th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700" style={{width: '280px'}}>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentModule?.fields.map(field => {
                      const testResult = testResults[field.id];
                      return (
                        <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              {field.required && (
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" title="Campo obrigatório"></span>
                              )}
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{field.name}</div>
                                <div className="text-xs text-gray-400">{field.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="Tabela"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              value={mappings[`${selectedModule}_${field.id}_table`] || ''}
                              onChange={(e) => setMappings(prev => ({
                                ...prev,
                                [`${selectedModule}_${field.id}_table`]: e.target.value
                              }))}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="Coluna"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              value={mappings[`${selectedModule}_${field.id}_column`] || ''}
                              onChange={(e) => setMappings(prev => ({
                                ...prev,
                                [`${selectedModule}_${field.id}_column`]: e.target.value
                              }))}
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleTestMapping(field.id)}
                              disabled={testingMapping === field.id || testingAll || !mappings[`${selectedModule}_${field.id}_table`] || !mappings[`${selectedModule}_${field.id}_column`]}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {testingMapping === field.id ? (
                                <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                              ) : (
                                '🔍'
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            {testResult?.loading ? (
                              <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                <span>Testando...</span>
                              </div>
                            ) : testResult?.success ? (
                              <div className="bg-green-50 p-2 rounded border border-green-200">
                                <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                                  ✅ {testResult.count?.toLocaleString()} registros encontrados
                                </div>
                                <div className="text-sm text-green-800 mt-1 font-medium">
                                  📋 Exemplos: <span className="font-bold text-green-900">{testResult.sample}</span>
                                </div>
                              </div>
                            ) : testResult?.message ? (
                              <div className="bg-red-50 p-2 rounded border border-red-200">
                                <span className="text-red-600 font-medium text-sm">
                                  ❌ {testResult.message}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-sm">Clique em 🔍 para testar</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botão Salvar Mapeamento + Indicador de Status */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                {/* Indicador de Status do Módulo Atual */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                  savedModules[selectedModule]
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                  {savedModules[selectedModule] ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      SALVO
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                      PENDENTE
                    </>
                  )}
                </div>

                <button
                  onClick={handleSaveMappings}
                  disabled={savingMappings}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {savingMappings ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Salvar Mapeamento
                    </>
                  )}
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
    // Verificar se veio de um template (tipo de banco travado)
    const isFromTemplate = selectedTemplate !== null;
    const templateDbType = selectedTemplate?.database_type || 'oracle';

    // Se está editando, carregar dados da conexão existente
    // Se é nova conexão, iniciar com campos em branco
    const [formData, setFormData] = useState(() => {
      if (editingConnection) {
        return {
          name: editingConnection.name || '',
          type: editingConnection.type || 'oracle',
          host: editingConnection.host || '',
          port: editingConnection.port?.toString() || '1521',
          service: editingConnection.service || '',
          database: editingConnection.database || editingConnection.service || '',
          schema: editingConnection.schema || '',
          username: editingConnection.username || '',
          password: '', // Nunca pré-preencher senha por segurança
          readOnly: true,
          active: editingConnection.active !== false
        };
      }
      // Nova conexão - usa tipo do template se vier de um
      return {
        name: isFromTemplate ? `Conexão ${selectedTemplate?.name || ''}` : '',
        type: isFromTemplate ? templateDbType : 'oracle',
        host: '',
        port: '', // Vazio para nova conexão
        service: '',
        database: '',
        schema: '',
        username: '',
        password: '',
        readOnly: true,
        active: true
      };
    });
    const [showPassword, setShowPassword] = useState(false);
    const [testingModal, setTestingModal] = useState(false);
    const [modalTestResult, setModalTestResult] = useState(null);
    const [savingModal, setSavingModal] = useState(false);

    const dbType = DATABASE_TYPES.find(t => t.id === formData.type);

    // Testar conexão com os dados DO FORMULÁRIO (não os salvos)
    const handleTestFormConnection = async () => {
      setTestingModal(true);
      setModalTestResult(null);

      try {
        // Usa endpoint test-new que testa sem salvar
        const response = await api.post('/database-connections/test-new', {
          type: formData.type,
          host: formData.host,
          port: formData.port,
          service: formData.service || formData.database,
          database: formData.database,
          username: formData.username,
          password: formData.password,
          schema: formData.schema
        });

        setModalTestResult({
          success: response.data.success,
          message: response.data.message
        });
      } catch (error) {
        setModalTestResult({
          success: false,
          message: error.response?.data?.message || 'Falha ao testar conexão'
        });
      } finally {
        setTestingModal(false);
      }
    };

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
                  {isFromTemplate ? '📋' : '🔌'}
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {editingConnection
                      ? 'Editar Conexão'
                      : isFromTemplate
                      ? `Nova Conexão - ${selectedTemplate?.name}`
                      : 'Nova Conexão de Banco'}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {isFromTemplate
                      ? 'Mapeamentos já configurados! Preencha apenas os dados de conexão.'
                      : 'Configure os dados de acesso ao banco de dados'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConnectionModal(false);
                  setSelectedTemplate(null);
                }}
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
                {isFromTemplate && (
                  <span className="ml-2 text-xs text-orange-600 font-normal">
                    (Definido pelo template)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => !isFromTemplate && handleChange('name', e.target.value)}
                placeholder="Ex: ERP Principal, Oracle Intersolid..."
                readOnly={isFromTemplate}
                className={`w-full px-4 py-3 border rounded-lg ${
                  isFromTemplate
                    ? 'border-orange-300 bg-orange-50 text-orange-700 font-medium cursor-not-allowed'
                    : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                }`}
              />
            </div>

            {/* Tipo de Banco */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Banco de Dados *
                {isFromTemplate && (
                  <span className="ml-2 text-xs text-orange-600 font-normal">
                    (Definido pelo template)
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DATABASE_TYPES.map(db => {
                  const isLocked = isFromTemplate && db.id !== templateDbType;
                  const isSelected = formData.type === db.id;
                  return (
                    <button
                      key={db.id}
                      type="button"
                      onClick={() => !isLocked && handleChange('type', db.id)}
                      disabled={isLocked}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all relative ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50'
                          : isLocked
                          ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-3xl mb-1">{db.icon}</span>
                      <span className="text-sm font-medium">{db.name}</span>
                      {isLocked && (
                        <span className="absolute top-1 right-1 text-gray-400">🔒</span>
                      )}
                      {isSelected && isFromTemplate && (
                        <span className="absolute top-1 right-1 text-green-500">✓</span>
                      )}
                    </button>
                  );
                })}
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
                  placeholder="Ex: 10.0.0.50"
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
                  placeholder="Ex: 1521, 1433..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === 'oracle' ? 'SID/Service Name' : 'Database'} *
                </label>
                <input
                  type="text"
                  value={formData.type === 'oracle' ? formData.service : formData.database}
                  onChange={(e) => handleChange(formData.type === 'oracle' ? 'service' : 'database', e.target.value)}
                  placeholder={formData.type === 'oracle' ? 'orcl' : 'nome_banco'}
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
                    placeholder="Ex: SISTEMA"
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
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

            {/* Resultado do Teste */}
            {modalTestResult && (
              <div className={`p-4 rounded-lg ${modalTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${modalTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {modalTestResult.success ? '✅' : '❌'} {modalTestResult.message}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                setShowConnectionModal(false);
                setSelectedTemplate(null); // Limpar template ao cancelar
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestFormConnection}
                disabled={testingModal || !formData.host || !formData.port || !formData.username || !formData.password}
                className="px-6 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingModal ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                    Testando...
                  </span>
                ) : (
                  '🔌 Testar Conexão'
                )}
              </button>
              <button
                onClick={async () => {
                  if (savingModal) return; // Prevenir clique duplo
                  setSavingModal(true);
                  try {
                    await handleSaveConnection(formData, modalTestResult?.success);
                    setSelectedTemplate(null); // Limpar template após salvar
                  } finally {
                    setSavingModal(false);
                  }
                }}
                disabled={savingModal}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingModal ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Salvando...
                  </span>
                ) : (
                  '💾 Salvar Conexão'
                )}
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
          {/* Header Principal - LARANJA igual tela de bipagens */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Configurações de Tabelas</h1>
                <p className="text-orange-100 mt-1">
                  Configure conexões de banco de dados e mapeie as tabelas do seu ERP
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('erp')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'erp'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              🏢 ERP Cliente
            </button>
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
          {activeTab === 'erp' && renderErpTab()}
          {activeTab === 'conexoes' && renderConnectionsTab()}
          {activeTab === 'mapeamento' && renderMappingTab()}
        </main>
      </div>

      {/* Modal de Conexão */}
      {showConnectionModal && <ConnectionModal />}

      {/* Modal de Salvar Template ERP */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          onClose={() => setShowSaveTemplateModal(false)}
          onSave={handleSaveErpTemplate}
        />
      )}
    </div>
  );
}

// Componente Modal para Salvar Template ERP
function SaveTemplateModal({ onClose, onSave }) {
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Digite o nome do ERP');
      return;
    }
    setSaving(true);
    try {
      await onSave(templateName.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                🏢
              </div>
              <div>
                <h3 className="text-xl font-bold">Salvar Padrão ERP</h3>
                <p className="text-purple-200 text-sm">
                  Salve este mapeamento para reutilizar
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome do ERP *
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex: Intersolid, Zanthus, SAP..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
            autoFocus
          />
          <p className="text-sm text-gray-500 mt-2">
            Este nome será usado para identificar o template ao configurar novos clientes.
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Salvando...
              </span>
            ) : (
              'Salvar Template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
