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
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', color: 'bg-indigo-500' },
];

// ====================================================================================
// CATÁLOGO DE TABELAS - Definição de todas as tabelas e seus campos
// ====================================================================================
const TABLE_CATALOG = {
  TAB_PRODUTO: {
    name: 'Produtos',
    description: 'Tabela principal de produtos',
    fields: [
      { id: 'codigo_produto', name: 'Código do Produto', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_PRODUTO' },
      { id: 'descricao', name: 'Descrição', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_PRODUTO' },
      { id: 'descricao_reduzida', name: 'Descrição Reduzida', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_REDUZIDA' },
      { id: 'codigo_barras', name: 'Código de Barras', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_BARRA_PRINCIPAL' },
      { id: 'pesavel', name: 'É Pesável', defaultTable: 'TAB_PRODUTO', defaultColumn: 'IPV' },
      { id: 'embalagem', name: 'Embalagem', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_EMBALAGEM' },
      { id: 'codigo_secao', name: 'Código Seção', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_SECAO' },
      { id: 'descricao_secao', name: 'Descrição Seção', defaultTable: 'TAB_SECAO', defaultColumn: 'DES_SECAO' },
      { id: 'codigo_grupo', name: 'Código Grupo', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_GRUPO' },
      { id: 'descricao_grupo', name: 'Descrição Grupo', defaultTable: 'TAB_GRUPO', defaultColumn: 'DES_GRUPO' },
      { id: 'codigo_subgrupo', name: 'Código Subgrupo', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_SUB_GRUPO' },
      { id: 'descricao_subgrupo', name: 'Descrição Subgrupo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'DES_SUB_GRUPO' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_FORNECEDOR' },
    ]
  },
  TAB_PRODUTO_LOJA: {
    name: 'Produto por Loja',
    description: 'Preços e estoque por loja',
    fields: [
      { id: 'preco_venda', name: 'Preço de Venda', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_VENDA' },
      { id: 'preco_oferta', name: 'Preço de Oferta', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_OFERTA' },
      { id: 'preco_custo', name: 'Custo de Reposição', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_CUSTO_REP' },
      { id: 'estoque_atual', name: 'Estoque Atual', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_EST_ATUAL' },
      { id: 'margem', name: 'Margem', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_MARGEM' },
      { id: 'curva', name: 'Curva ABC', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'DES_RANK_PRODLOJA' },
    ]
  },
  TAB_PRODUTO_PDV: {
    name: 'Vendas PDV',
    description: 'Cupons e itens vendidos',
    fields: [
      { id: 'numero_cupom', name: 'Número do Cupom', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'NUM_CUPOM_FISCAL' },
      { id: 'data_venda', name: 'Data da Venda', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'DTA_SAIDA' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'VAL_TOTAL_PRODUTO' },
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'COD_VENDEDOR' },
      { id: 'numero_pdv', name: 'Número PDV', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'NUM_PDV' },
      { id: 'cupom_cancelado', name: 'Cupom Cancelado', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'FLG_CUPOM_CANCELADO' },
      { id: 'valor_desconto', name: 'Valor Desconto', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'VAL_DESCONTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'QTD_TOTAL_PRODUTO' },
    ]
  },
  TAB_OPERADORES: {
    name: 'Operadores',
    description: 'Operadores de caixa',
    fields: [
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_OPERADORES', defaultColumn: 'COD_OPERADOR' },
      { id: 'nome_operador', name: 'Nome Operador', defaultTable: 'TAB_OPERADORES', defaultColumn: 'DES_OPERADOR' },
    ]
  },
  TAB_ESTOQUE: {
    name: 'Movimentações de Estoque',
    description: 'Entradas, saídas e ajustes',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'QTD_AJUSTE' },
      { id: 'tipo_movimento', name: 'Tipo Movimento', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_AJUSTE' },
      { id: 'data_movimento', name: 'Data Movimento', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'DTA_AJUSTE' },
      { id: 'motivo', name: 'Motivo', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'MOTIVO' },
    ]
  },
  TAB_FORNECEDOR: {
    name: 'Fornecedores',
    description: 'Cadastro de fornecedores',
    fields: [
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'razao_social', name: 'Razão Social', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'DES_FORNECEDOR' },
      { id: 'nome_fantasia', name: 'Nome Fantasia', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'DES_FANTASIA' },
      { id: 'cnpj', name: 'CNPJ', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'NUM_CGC' },
      { id: 'telefone', name: 'Telefone', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'NUM_FONE' },
    ]
  },
  TAB_NOTA_FISCAL: {
    name: 'Notas Fiscais',
    description: 'NFs de entrada',
    fields: [
      { id: 'numero_nf', name: 'Número NF', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_NF_FORN' },
      { id: 'serie', name: 'Série', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_SERIE_NF' },
      { id: 'data_entrada', name: 'Data Entrada', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'DTA_ENTRADA' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'VAL_TOTAL_NF' },
      { id: 'chave_acesso', name: 'Chave de Acesso', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_CHAVE_ACESSO' },
    ]
  },
  TAB_PEDIDO: {
    name: 'Pedidos',
    description: 'Pedidos de compra',
    fields: [
      { id: 'numero_pedido', name: 'Número Pedido', defaultTable: 'TAB_PEDIDO_COMPRA', defaultColumn: 'NUM_PEDIDO' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_PEDIDO_COMPRA', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'data_pedido', name: 'Data Pedido', defaultTable: 'TAB_PEDIDO_COMPRA', defaultColumn: 'DTA_PEDIDO' },
      { id: 'status', name: 'Status', defaultTable: 'TAB_PEDIDO_COMPRA', defaultColumn: 'FLG_STATUS' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_PEDIDO_COMPRA', defaultColumn: 'VAL_TOTAL' },
    ]
  },
  TAB_RUPTURA: {
    name: 'Rupturas',
    description: 'Registro de rupturas',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_RUPTURA', defaultColumn: 'COD_PRODUTO' },
      { id: 'data_ruptura', name: 'Data Ruptura', defaultTable: 'TAB_RUPTURA', defaultColumn: 'DTA_RUPTURA' },
      { id: 'motivo', name: 'Motivo', defaultTable: 'TAB_RUPTURA', defaultColumn: 'DES_MOTIVO' },
    ]
  },
  TAB_QUEBRA: {
    name: 'Quebras',
    description: 'Registro de quebras/perdas',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_QUEBRA', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_QUEBRA', defaultColumn: 'QTD_QUEBRA' },
      { id: 'data_quebra', name: 'Data Quebra', defaultTable: 'TAB_QUEBRA', defaultColumn: 'DTA_QUEBRA' },
      { id: 'motivo', name: 'Motivo', defaultTable: 'TAB_QUEBRA', defaultColumn: 'DES_MOTIVO' },
      { id: 'valor', name: 'Valor', defaultTable: 'TAB_QUEBRA', defaultColumn: 'VAL_QUEBRA' },
    ]
  },
  TAB_ETIQUETA: {
    name: 'Etiquetas',
    description: 'Impressão de etiquetas',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_ETIQUETA', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_ETIQUETA', defaultColumn: 'QTD_ETIQUETA' },
      { id: 'data_impressao', name: 'Data Impressão', defaultTable: 'TAB_ETIQUETA', defaultColumn: 'DTA_IMPRESSAO' },
    ]
  },
  TAB_PRODUCAO: {
    name: 'Produção',
    description: 'Controle de produção',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PRODUCAO', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade_produzida', name: 'Quantidade Produzida', defaultTable: 'TAB_PRODUCAO', defaultColumn: 'QTD_PRODUZIDA' },
      { id: 'data_producao', name: 'Data Produção', defaultTable: 'TAB_PRODUCAO', defaultColumn: 'DTA_PRODUCAO' },
    ]
  },
  TAB_HORTFRUTI: {
    name: 'Hort Fruti',
    description: 'Controle de hortifruti',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_HORTFRUTI', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade_pesada', name: 'Quantidade Pesada', defaultTable: 'TAB_HORTFRUTI', defaultColumn: 'QTD_PESADA' },
      { id: 'data_pesagem', name: 'Data Pesagem', defaultTable: 'TAB_HORTFRUTI', defaultColumn: 'DTA_PESAGEM' },
    ]
  },
  TAB_CUPOM_FINALIZADORA: {
    name: 'Finalizadoras de Cupom',
    description: 'Formas de pagamento dos cupons',
    fields: [
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_OPERADOR' },
      { id: 'numero_cupom', name: 'Número do Cupom', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'NUM_CUPOM_FISCAL' },
      { id: 'data_venda', name: 'Data da Venda', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'DTA_VENDA' },
      { id: 'valor_liquido', name: 'Valor Líquido', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'VAL_LIQUIDO' },
      { id: 'codigo_finalizadora', name: 'Código Finalizadora', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_FINALIZADORA' },
      { id: 'codigo_tipo', name: 'Código Tipo', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_TIPO' },
      { id: 'numero_pdv', name: 'Número PDV', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'NUM_PDV' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_LOJA' },
    ]
  },
};

// ====================================================================================
// MÓDULOS DE NEGÓCIO - Estrutura hierárquica
// ====================================================================================
const BUSINESS_MODULES = [
  {
    id: 'prevencao',
    name: 'Prevenção no Radar',
    icon: '🛡️',
    color: 'from-orange-500 to-red-500',
    submodules: [
      { id: 'bipagens', name: 'Prevenção de Bipagens', icon: '📡', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_PRODUTO_PDV', 'TAB_OPERADORES', 'TAB_CUPOM_FINALIZADORA'] },
      { id: 'pdv', name: 'Prevenção PDV', icon: '💳', tables: ['TAB_PRODUTO_PDV', 'TAB_OPERADORES'] },
      { id: 'facial', name: 'Prevenção Facial', icon: '👤', tables: ['TAB_OPERADORES'] },
      { id: 'rupturas', name: 'Prevenção Rupturas', icon: '🔍', tables: ['TAB_PRODUTO', 'TAB_RUPTURA'] },
      { id: 'etiquetas', name: 'Prevenção Etiquetas', icon: '🏷️', tables: ['TAB_PRODUTO', 'TAB_ETIQUETA'] },
      { id: 'quebras', name: 'Prevenção Quebras', icon: '💔', tables: ['TAB_PRODUTO', 'TAB_QUEBRA'] },
      { id: 'producao', name: 'Produção', icon: '🏭', tables: ['TAB_PRODUTO', 'TAB_PRODUCAO'] },
      { id: 'hortfruti', name: 'Hort Fruti', icon: '🥬', tables: ['TAB_PRODUTO', 'TAB_HORTFRUTI'] },
    ]
  },
  {
    id: 'gestao',
    name: 'Gestão no Radar',
    icon: '📊',
    color: 'from-blue-500 to-indigo-600',
    submodules: [
      { id: 'gestao_inteligente', name: 'Gestão Inteligente', icon: '🧠', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_PRODUTO_PDV'] },
      { id: 'estoque_margem', name: 'Estoque e Margem', icon: '📦', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_ESTOQUE'] },
      { id: 'compra_venda', name: 'Compra e Venda', icon: '🛒', tables: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_NOTA_FISCAL'] },
      { id: 'pedidos', name: 'Pedidos', icon: '📋', tables: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_PEDIDO'] },
      { id: 'ruptura_industria', name: 'Ruptura Indústria', icon: '🏭', tables: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_RUPTURA'] },
    ]
  }
];

// Gerar lista de todos os submódulos para tracking
const getAllSubmodules = () => {
  const subs = {};
  BUSINESS_MODULES.forEach(mod => {
    mod.submodules.forEach(sub => {
      subs[`${mod.id}.${sub.id}`] = false;
    });
  });
  return subs;
};

export default function ConfiguracoesTabelas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('mapeamento');

  // Estado para Conexões
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Estado para navegação hierárquica
  const [selectedMainModule, setSelectedMainModule] = useState('prevencao');
  const [selectedSubmodule, setSelectedSubmodule] = useState('bipagens');
  const [selectedConnection, setSelectedConnection] = useState(null);

  // Gerar mapeamentos iniciais com valores Intersolid
  const getInitialMappings = () => {
    const mappings = {};
    Object.entries(TABLE_CATALOG).forEach(([tableId, tableInfo]) => {
      mappings[tableId] = {
        nome_real: tableInfo.fields[0]?.defaultTable || tableId,
        colunas: {},
        tabelas_campo: {}
      };
      tableInfo.fields.forEach(field => {
        mappings[tableId].colunas[field.id] = field.defaultColumn;
        mappings[tableId].tabelas_campo[field.id] = field.defaultTable;
      });
    });
    return mappings;
  };

  // Estado para mapeamentos (por tabela) - JÁ PRÉ-PREENCHIDO COM INTERSOLID
  const [tableMappings, setTableMappings] = useState(getInitialMappings);
  const [testResults, setTestResults] = useState({});
  const [testingMapping, setTestingMapping] = useState(null);
  const [testingAll, setTestingAll] = useState(false);

  // Estado para rastrear submódulos salvos
  const [savedSubmodules, setSavedSubmodules] = useState(getAllSubmodules());

  // Verificar se todos os submódulos foram salvos
  const allSubmodulesSaved = Object.values(savedSubmodules).every(saved => saved);

  // Estado para ERP Templates
  const [erpTemplates, setErpTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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

  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get('/database-connections');
      const mapped = (response.data || []).map(conn => ({
        ...conn,
        active: conn.status === 'active',
        readOnly: true,
        database: conn.service || conn.database,
        lastTest: conn.last_test_at,
        testSuccess: conn.status === 'active'
      }));
      setConnections(mapped);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      setConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Pré-preencher com valores Intersolid (sem salvar)
  const handlePreFillIntersolid = () => {
    setTableMappings(getInitialMappings());
    setTestResults({});
    alert('✅ Campos preenchidos com valores padrão Intersolid!\n\nRevise e salve cada submódulo.');
  };

  // Função para mudar conexão selecionada e carregar mapeamentos
  const handleConnectionChange = async (connectionId) => {
    setSelectedConnection(connectionId || null);
    setTestResults({});

    if (!connectionId) {
      // Manter valores Intersolid pré-preenchidos
      setTableMappings(getInitialMappings());
      setSavedSubmodules(getAllSubmodules());
      return;
    }

    // Buscar mapeamentos salvos da conexão
    try {
      const response = await api.get(`/database-connections/${connectionId}/mappings`);
      if (response.data?.mappings?.tabelas && Object.keys(response.data.mappings.tabelas).length > 0) {
        // Mesclar com valores Intersolid (para campos não salvos)
        const savedMappings = response.data.mappings.tabelas;
        const initialMappings = getInitialMappings();

        // Mesclar: valores salvos têm prioridade, mas campos vazios usam Intersolid
        const mergedMappings = {};
        Object.entries(initialMappings).forEach(([tableId, initialTable]) => {
          const savedTable = savedMappings[tableId] || {};
          mergedMappings[tableId] = {
            nome_real: savedTable.nome_real || initialTable.nome_real,
            colunas: { ...initialTable.colunas, ...(savedTable.colunas || {}) },
            tabelas_campo: { ...initialTable.tabelas_campo, ...(savedTable.tabelas_campo || {}) }
          };
        });

        setTableMappings(mergedMappings);

        // Marcar submódulos como salvos baseado nas tabelas preenchidas
        const newSaved = { ...getAllSubmodules() };
        BUSINESS_MODULES.forEach(mod => {
          mod.submodules.forEach(sub => {
            const allTablesHaveData = sub.tables.every(tableId =>
              savedMappings[tableId]?.nome_real
            );
            newSaved[`${mod.id}.${sub.id}`] = allTablesHaveData;
          });
        });
        setSavedSubmodules(newSaved);
      } else {
        // Sem mapeamentos salvos - manter valores Intersolid
        setTableMappings(getInitialMappings());
        setSavedSubmodules(getAllSubmodules());
      }
    } catch (error) {
      console.error('Erro ao carregar mapeamentos:', error);
      // Em caso de erro, manter valores Intersolid
      setTableMappings(getInitialMappings());
      setSavedSubmodules(getAllSubmodules());
    }
  };

  // Atualizar valor de uma coluna
  const handleUpdateColumn = (tableId, fieldId, value) => {
    setTableMappings(prev => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        colunas: {
          ...(prev[tableId]?.colunas || {}),
          [fieldId]: value
        }
      }
    }));
    // Marcar submódulo como não salvo
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    setSavedSubmodules(prev => ({ ...prev, [subKey]: false }));
  };

  // Atualizar tabela de um campo específico
  const handleUpdateFieldTable = (tableId, fieldId, value) => {
    setTableMappings(prev => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        tabelas_campo: {
          ...(prev[tableId]?.tabelas_campo || {}),
          [fieldId]: value
        },
        nome_real: prev[tableId]?.nome_real || value
      }
    }));
    // Marcar submódulo como não salvo
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    setSavedSubmodules(prev => ({ ...prev, [subKey]: false }));
  };

  // Testar um mapeamento específico
  const handleTestMapping = async (tableId, fieldId) => {
    const mapping = tableMappings[tableId];
    const tableName = mapping?.tabelas_campo?.[fieldId] || mapping?.nome_real || tableId;
    const columnName = mapping?.colunas?.[fieldId];

    if (!tableName || !columnName) {
      alert('Preencha a tabela e a coluna antes de testar');
      return;
    }

    const testKey = `${tableId}_${fieldId}`;
    setTestingMapping(testKey);
    setTestResults(prev => ({
      ...prev,
      [testKey]: { loading: true }
    }));

    try {
      const response = await api.post('/database-connections/test-mapping', {
        connectionId: selectedConnection,
        tableName,
        columnName
      });

      setTestResults(prev => ({
        ...prev,
        [testKey]: {
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
        [testKey]: {
          loading: false,
          success: false,
          message: error.response?.data?.message || 'Erro ao testar'
        }
      }));
    } finally {
      setTestingMapping(null);
    }
  };

  // Testar TODOS os mapeamentos do submódulo atual
  const handleTestAllMappings = async () => {
    if (!selectedConnection) return;

    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    if (!submodule) return;

    setTestingAll(true);

    // Para cada tabela do submódulo
    for (const tableId of submodule.tables) {
      const tableInfo = TABLE_CATALOG[tableId];
      if (!tableInfo) continue;

      // Para cada campo da tabela
      for (const field of tableInfo.fields) {
        const mapping = tableMappings[tableId];
        const tableName = mapping?.tabelas_campo?.[field.id] || mapping?.nome_real || tableId;
        const columnName = mapping?.colunas?.[field.id];

        const testKey = `${tableId}_${field.id}`;

        if (!tableName || !columnName) {
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              loading: false,
              success: false,
              message: 'Tabela/coluna não preenchida'
            }
          }));
          continue;
        }

        setTestResults(prev => ({
          ...prev,
          [testKey]: { loading: true }
        }));

        try {
          const response = await api.post('/database-connections/test-mapping', {
            connectionId: selectedConnection,
            tableName,
            columnName
          });

          setTestResults(prev => ({
            ...prev,
            [testKey]: {
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
            [testKey]: {
              loading: false,
              success: false,
              message: error.response?.data?.message || 'Erro ao testar'
            }
          }));
        }

        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setTestingAll(false);
  };

  // Salvar mapeamentos do submódulo atual
  const [savingMappings, setSavingMappings] = useState(false);
  const handleSaveSubmoduleMappings = async () => {
    if (!selectedConnection) {
      alert('Selecione uma conexão primeiro!');
      return;
    }

    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    if (!submodule) return;

    setSavingMappings(true);
    try {
      // Salvar cada tabela do submódulo
      for (const tableId of submodule.tables) {
        const mapping = tableMappings[tableId];
        if (!mapping) continue;

        await api.post('/database-connections/save-table-mapping', {
          connectionId: selectedConnection,
          tableId,
          realTableName: mapping.nome_real || tableId,
          columns: mapping.colunas || {},
          tabelas_campo: mapping.tabelas_campo || {}
        });
      }

      // Marcar submódulo como salvo
      const subKey = `${selectedMainModule}.${selectedSubmodule}`;
      setSavedSubmodules(prev => ({ ...prev, [subKey]: true }));

      alert(`✅ Mapeamentos de "${submodule.name}" salvos com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      alert('❌ Erro ao salvar mapeamentos: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingMappings(false);
    }
  };

  // Salvar template ERP
  const handleSaveErpTemplate = async (templateName) => {
    try {
      const selectedConn = connections.find(c => c.id == selectedConnection);
      const response = await api.post('/erp-templates', {
        name: templateName,
        description: `Template para ERP ${templateName}`,
        database_type: selectedConn?.type || 'oracle',
        mappings: { version: 2, tabelas: tableMappings }
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

  // Handlers de conexão
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
      const payload = {
        name: connectionData.name,
        type: connectionData.type,
        host: connectionData.host,
        host_vps: connectionData.host_vps || '172.20.0.1',
        port: connectionData.port,
        service: connectionData.service || connectionData.database,
        database: connectionData.database,
        schema: connectionData.schema,
        username: connectionData.username,
        password: connectionData.password,
        is_default: false,
        status: testPassed ? 'active' : 'inactive'
      };

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

  // Render da aba Mapeamento (HIERÁRQUICO)
  const renderMappingTab = () => {
    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    const isSubmoduleSaved = savedSubmodules[subKey];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mapeamento de Tabelas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Conecte os campos do sistema às colunas do seu banco de dados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePreFillIntersolid}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔶 Preencher Intersolid
            </button>
          </div>
        </div>

        {/* Seletor de Módulo Principal */}
        <div className="flex flex-wrap gap-3">
          {BUSINESS_MODULES.map(module => {
            const savedCount = module.submodules.filter(s => savedSubmodules[`${module.id}.${s.id}`]).length;
            const totalCount = module.submodules.length;
            const allSaved = savedCount === totalCount;

            return (
              <button
                key={module.id}
                onClick={() => {
                  setSelectedMainModule(module.id);
                  setSelectedSubmodule(module.submodules[0].id);
                }}
                className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all relative ${
                  selectedMainModule === module.id
                    ? 'border-orange-500 bg-gradient-to-br ' + module.color + ' text-white shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-3xl">{module.icon}</span>
                <div className="text-left">
                  <div className="font-bold">{module.name}</div>
                  <div className={`text-xs ${selectedMainModule === module.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {savedCount}/{totalCount} submódulos
                  </div>
                </div>
                {/* Badge de status */}
                <span className={`absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                  allSaved ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {allSaved ? '✓' : savedCount}
                </span>
              </button>
            );
          })}

          {/* Botão Salvar Padrão ERP */}
          <button
            onClick={() => {
              if (!allSubmodulesSaved) {
                const pendingCount = Object.values(savedSubmodules).filter(s => !s).length;
                alert(`⚠️ Salve todos os submódulos primeiro!\n\nFaltam ${pendingCount} submódulo(s).`);
                return;
              }
              setShowSaveTemplateModal(true);
            }}
            disabled={!allSubmodulesSaved}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all ${
              allSubmodulesSaved
                ? 'border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="text-3xl">{allSubmodulesSaved ? '💾' : '🔒'}</span>
            <div className="text-left">
              <div className="font-bold">Salvar Padrão ERP</div>
              <div className="text-xs opacity-75">
                {allSubmodulesSaved ? 'Criar template' : `${Object.values(savedSubmodules).filter(s => !s).length} pendente(s)`}
              </div>
            </div>
          </button>
        </div>

        {/* Seletor de Submódulo */}
        <div className="flex flex-wrap gap-2">
          {mainModule?.submodules.map(sub => {
            const subSaved = savedSubmodules[`${selectedMainModule}.${sub.id}`];
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubmodule(sub.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all relative ${
                  selectedSubmodule === sub.id
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span>{sub.icon}</span>
                <span className="font-medium">{sub.name}</span>
                <span className={`w-5 h-5 flex items-center justify-center text-xs rounded-full ${
                  subSaved ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {subSaved ? '✓' : '!'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Área de Mapeamento */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header do Submódulo */}
          <div className={`bg-gradient-to-r ${mainModule?.color || 'from-orange-500 to-red-500'} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{submodule?.icon}</span>
                <div>
                  <h3 className="text-xl font-bold">{submodule?.name}</h3>
                  <p className="text-white/80">
                    Tabelas: {submodule?.tables.map(t => TABLE_CATALOG[t]?.name || t).join(', ')}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-bold ${
                isSubmoduleSaved ? 'bg-green-500' : 'bg-white/20'
              }`}>
                {isSubmoduleSaved ? '✓ SALVO' : '⚠ PENDENTE'}
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
              onChange={(e) => handleConnectionChange(e.target.value)}
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
              {/* Botão Testar Todos */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 Dica:</strong> Preencha a Tabela e Coluna de cada campo. Use "Testar Todos" para validar.
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

              {/* Renderizar cada tabela do submódulo */}
              {submodule?.tables.map(tableId => {
                const tableInfo = TABLE_CATALOG[tableId];
                if (!tableInfo) return null;

                return (
                  <div key={tableId} className="mb-8">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      {tableInfo.name}
                      <span className="text-sm font-normal text-gray-500">({tableInfo.description})</span>
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '180px'}}>Campo</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '200px'}}>Tabela</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '200px'}}>Coluna</th>
                            <th className="text-center py-2 px-2 font-semibold text-gray-700 text-sm" style={{width: '50px'}}></th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm">Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableInfo.fields.map(field => {
                            const testKey = `${tableId}_${field.id}`;
                            const result = testResults[testKey];
                            const mapping = tableMappings[tableId];

                            return (
                              <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  <div className="font-medium text-gray-900 text-sm">{field.name}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder={field.defaultTable}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    value={mapping?.tabelas_campo?.[field.id] || ''}
                                    onChange={(e) => handleUpdateFieldTable(tableId, field.id, e.target.value)}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder={field.defaultColumn}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    value={mapping?.colunas?.[field.id] || ''}
                                    onChange={(e) => handleUpdateColumn(tableId, field.id, e.target.value)}
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    onClick={() => handleTestMapping(tableId, field.id)}
                                    disabled={testingMapping === testKey || testingAll}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {testingMapping === testKey ? (
                                      <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                                    ) : (
                                      '🔍'
                                    )}
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  {result?.loading ? (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                      <span>Testando...</span>
                                    </div>
                                  ) : result?.success ? (
                                    <div className="text-green-600 text-sm">
                                      ✅ {result.count?.toLocaleString()} reg. | Ex: {result.sample}
                                    </div>
                                  ) : result?.message ? (
                                    <div className="text-red-600 text-sm">
                                      ❌ {result.message}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic text-sm">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Botão Salvar */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                  isSubmoduleSaved
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                }`}>
                  {isSubmoduleSaved ? (
                    <>✅ {submodule?.name} - SALVO</>
                  ) : (
                    <>⚠️ {submodule?.name} - PENDENTE</>
                  )}
                </div>

                <button
                  onClick={handleSaveSubmoduleMappings}
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
                      💾 Salvar {submodule?.name}
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

  // Render da aba Conexões
  const renderConnectionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conexões de Banco de Dados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure as conexões com os bancos de dados externos
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
            Configure a primeira conexão com seu banco de dados para começar.
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
              <div key={conn.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
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
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {dbType?.name || conn.type} • {conn.host}:{conn.port} • {conn.database || conn.schema}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={testingConnection === conn.id}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Testar conexão"
                    >
                      {testingConnection === conn.id ? (
                        <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      ) : (
                        '🔌'
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
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      🗑️
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

  // Render da aba ERP Templates
  const renderErpTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Templates de ERP</h2>
          <p className="text-sm text-gray-500 mt-1">
            Templates pré-configurados para agilizar a configuração
          </p>
        </div>
      </div>

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
            Configure os mapeamentos na aba "Mapeamento" e salve como template.
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
              <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 ${dbType?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white text-xl`}>
                    {dbType?.icon || '🗄️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{template.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{template.description || 'Template de mapeamento'}</p>
                  </div>
                </div>
                <button
                  className="w-full py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors text-sm"
                  onClick={() => {
                    // Aplicar template
                    if (template.mappings?.tabelas) {
                      setTableMappings(template.mappings.tabelas);
                    }
                    setActiveTab('mapeamento');
                    alert('Template aplicado! Configure a conexão e salve os mapeamentos.');
                  }}
                >
                  Usar este Template
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Modal de Conexão (simplificado)
  const ConnectionModal = () => {
    const [formData, setFormData] = useState(() => {
      if (editingConnection) {
        return {
          name: editingConnection.name || '',
          type: editingConnection.type || 'oracle',
          host: editingConnection.host || '',
          host_vps: editingConnection.host_vps || '172.20.0.1',
          port: editingConnection.port?.toString() || '1521',
          service: editingConnection.service || '',
          database: editingConnection.database || editingConnection.service || '',
          schema: editingConnection.schema || '',
          username: editingConnection.username || '',
          password: '',
          active: editingConnection.active !== false
        };
      }
      return {
        name: '',
        type: 'oracle',
        host: '',
        host_vps: '172.20.0.1',
        port: '1521',
        service: '',
        database: '',
        schema: '',
        username: '',
        password: '',
        active: true
      };
    });
    const [showPassword, setShowPassword] = useState(false);
    const [testingModal, setTestingModal] = useState(false);
    const [modalTestResult, setModalTestResult] = useState(null);
    const [savingModal, setSavingModal] = useState(false);

    const handleTestFormConnection = async () => {
      setTestingModal(true);
      setModalTestResult(null);

      try {
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
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingConnection ? 'Editar Conexão' : 'Nova Conexão'}
              </h3>
              <button
                onClick={() => setShowConnectionModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Conexão *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: Oracle Intersolid"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Banco *</label>
              <div className="grid grid-cols-4 gap-2">
                {DATABASE_TYPES.map(db => (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => handleChange('type', db.id)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      formData.type === db.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <span className="text-2xl mb-1">{db.icon}</span>
                    <span className="text-xs font-medium">{db.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Host *</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  placeholder="10.6.1.100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Porta *</label>
                <input
                  type="text"
                  value={formData.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  placeholder="1521"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === 'oracle' ? 'SID/Service' : 'Database'} *
                </label>
                <input
                  type="text"
                  value={formData.type === 'oracle' ? formData.service : formData.database}
                  onChange={(e) => handleChange(formData.type === 'oracle' ? 'service' : 'database', e.target.value)}
                  placeholder={formData.type === 'oracle' ? 'orcl' : 'nome_banco'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              {formData.type === 'oracle' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schema</label>
                  <input
                    type="text"
                    value={formData.schema}
                    onChange={(e) => handleChange('schema', e.target.value)}
                    placeholder="INTERSOLID"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usuário *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="usuario"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            {modalTestResult && (
              <div className={`p-4 rounded-lg ${modalTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${modalTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {modalTestResult.success ? '✅' : '❌'} {modalTestResult.message}
                </p>
              </div>
            )}
          </div>

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
                onClick={handleTestFormConnection}
                disabled={testingModal || !formData.host || !formData.port || !formData.username || !formData.password}
                className="px-6 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                {testingModal ? '⏳ Testando...' : '🔌 Testar'}
              </button>
              <button
                onClick={async () => {
                  if (savingModal) return;
                  setSavingModal(true);
                  try {
                    await handleSaveConnection(formData, modalTestResult?.success);
                  } finally {
                    setSavingModal(false);
                  }
                }}
                disabled={savingModal}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {savingModal ? '⏳ Salvando...' : '💾 Salvar'}
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
          <div className="w-10"></div>
        </div>

        <main className="p-4 lg:p-8">
          {/* Header Principal */}
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
                  Configure conexões e mapeie as tabelas do seu ERP
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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏢</span>
              <div>
                <h3 className="text-xl font-bold">Salvar Padrão ERP</h3>
                <p className="text-purple-200 text-sm">Salve este mapeamento como template</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
          </div>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do ERP *</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex: Intersolid, Zanthus, SAP..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
            autoFocus
          />
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {saving ? '⏳ Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
