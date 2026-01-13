import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Definição das 24 colunas disponíveis
const AVAILABLE_COLUMNS = [
  { id: 'codigo', label: 'Código', visible: true },
  { id: 'descricao', label: 'Descrição', visible: true },
  { id: 'desReduzida', label: 'Desc. Reduzida', visible: false },
  { id: 'ean', label: 'EAN', visible: true },
  { id: 'valCustoRep', label: 'Custo', visible: true },
  { id: 'valvendaloja', label: 'Preço Loja', visible: false },
  { id: 'valvenda', label: 'Preço Venda', visible: true },
  { id: 'valOferta', label: 'Oferta', visible: false },
  { id: 'estoque', label: 'Estoque', visible: true },
  { id: 'desSecao', label: 'Seção', visible: true },
  { id: 'desGrupo', label: 'Grupo', visible: false },
  { id: 'desSubGrupo', label: 'Subgrupo', visible: false },
  { id: 'fantasiaForn', label: 'Fornecedor', visible: true },
  { id: 'margemRef', label: 'Margem Meta', visible: false },
  { id: 'margemCalculada', label: 'Margem %', visible: true },
  { id: 'vendaMedia', label: 'Venda Média', visible: false },
  { id: 'diasCobertura', label: 'Dias Cobertura', visible: false },
  { id: 'dtaUltCompra', label: 'Últ. Compra', visible: false },
  { id: 'qtdUltCompra', label: 'Qtd Últ. Compra', visible: false },
  { id: 'qtdPedidoCompra', label: 'Pedido Compra', visible: false },
  { id: 'estoqueMinimo', label: 'Estoque Mín', visible: false },
  { id: 'tipoEspecie', label: 'Tipo Espécie', visible: false },
  { id: 'dtaCadastro', label: 'Data Cadastro', visible: false },
  { id: 'diasSemVenda', label: 'Dias s/ Venda', visible: true },
];

export default function EstoqueSaude() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuração de colunas
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('estoque_columns');
    return saved ? JSON.parse(saved) : AVAILABLE_COLUMNS;
  });

  // Filtros
  const [filterTipoEspecie, setFilterTipoEspecie] = useState('MERCADORIA');
  const [filterTipoEvento, setFilterTipoEvento] = useState('DIRETA');
  const [activeCardFilter, setActiveCardFilter] = useState('todos');

  // Salvar colunas no localStorage
  useEffect(() => {
    localStorage.setItem('estoque_columns', JSON.stringify(columns));
  }, [columns]);

  // Toggle visibilidade de coluna
  const toggleColumn = (columnId) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Buscar produtos
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/products');
      const allProducts = response.data.data || response.data;

      // Adicionar colunas calculadas
      const productsWithCalcs = allProducts.map(p => {
        const dataAtual = new Date();
        const dtaUltVenda = p.dtaUltMovVenda ? new Date(p.dtaUltMovVenda.slice(0, 4), p.dtaUltMovVenda.slice(4, 6) - 1, p.dtaUltMovVenda.slice(6, 8)) : null;
        const diasSemVenda = dtaUltVenda ? Math.floor((dataAtual - dtaUltVenda) / (1000 * 60 * 60 * 24)) : 999;

        const margemCalculada = p.valvenda > 0 ? (((p.valvenda - p.valCustoRep) / p.valvenda) * 100).toFixed(2) : 0;

        return {
          ...p,
          diasSemVenda,
          margemCalculada: parseFloat(margemCalculada)
        };
      });

      setProducts(productsWithCalcs);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao carregar produtos. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Produtos filtrados
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtro de Tipo Espécie
    if (filterTipoEspecie) {
      filtered = filtered.filter(p => p.tipoEspecie === filterTipoEspecie);
    }

    // Filtro de Tipo Evento
    if (filterTipoEvento) {
      filtered = filtered.filter(p => p.tipoEvento === filterTipoEvento);
    }

    // Filtro por Card clicado
    if (activeCardFilter === 'zerado') {
      filtered = filtered.filter(p => p.estoque === 0);
    } else if (activeCardFilter === 'negativo') {
      filtered = filtered.filter(p => p.estoque < 0);
    } else if (activeCardFilter === 'sem_venda') {
      filtered = filtered.filter(p => p.diasSemVenda > 30);
    } else if (activeCardFilter === 'margem_negativa') {
      filtered = filtered.filter(p => p.margemCalculada < 0);
    } else if (activeCardFilter === 'margem_baixa') {
      filtered = filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0);
    }

    return filtered;
  }, [products, filterTipoEspecie, filterTipoEvento, activeCardFilter]);

  // Cálculos dos cards
  const stats = useMemo(() => {
    const filtered = products.filter(p => {
      let match = true;
      if (filterTipoEspecie) match = match && p.tipoEspecie === filterTipoEspecie;
      if (filterTipoEvento) match = match && p.tipoEvento === filterTipoEvento;
      return match;
    });

    return {
      estoqueZerado: filtered.filter(p => p.estoque === 0).length,
      estoqueNegativo: filtered.filter(p => p.estoque < 0).length,
      semVenda30Dias: filtered.filter(p => p.diasSemVenda > 30).length,
      margemNegativa: filtered.filter(p => p.margemCalculada < 0).length,
      margemAbaixoMeta: filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0).length,
      total: filtered.length
    };
  }, [products, filterTipoEspecie, filterTipoEvento]);

  // Renderizar valor da célula
  const renderCellValue = (product, columnId) => {
    const value = product[columnId];

    switch (columnId) {
      case 'valCustoRep':
      case 'valvendaloja':
      case 'valvenda':
      case 'valOferta':
        return `R$ ${value?.toFixed(2) || '0.00'}`;

      case 'estoque':
        return value?.toFixed(2) || '0.00';

      case 'margemCalculada':
      case 'margemRef':
        return `${value?.toFixed(1) || '0.0'}%`;

      case 'dtaUltCompra':
      case 'dtaCadastro':
        return value ? new Date(value).toLocaleDateString('pt-BR') : '-';

      case 'diasSemVenda':
        return `${value} dias`;

      default:
        return value || '-';
    }
  };

  // Função para obter classe CSS da célula
  const getCellClassName = (product, columnId) => {
    const baseClass = "px-4 py-3 text-sm";

    if (columnId === 'estoque') {
      return `${baseClass} text-right font-medium ${
        product.estoque < 0 ? 'text-red-600' :
        product.estoque === 0 ? 'text-orange-600' :
        'text-gray-900'
      }`;
    }

    if (columnId === 'margemCalculada') {
      return `${baseClass} text-right font-medium ${
        product.margemCalculada < 0 ? 'text-red-600' :
        product.margemCalculada < product.margemRef ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'diasSemVenda') {
      return `${baseClass} text-right font-medium ${
        product.diasSemVenda > 30 ? 'text-red-600' :
        product.diasSemVenda > 15 ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'valCustoRep' || columnId === 'valvenda' || columnId === 'margemRef') {
      return `${baseClass} text-right text-gray-700`;
    }

    if (columnId === 'codigo') {
      return `${baseClass} font-medium text-gray-900`;
    }

    return `${baseClass} text-gray-700`;
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
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
          <h1 className="text-lg font-semibold text-gray-900">📦 Prevenção Estoque</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Card com Gradiente Laranja */}
          <div className="hidden lg:block bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">📦 Prevenção de Estoque</h1>
                <p className="text-white/90">
                  Monitore a saúde do seu estoque e identifique produtos críticos
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Tipo de Espécie
                </label>
                <select
                  value={filterTipoEspecie}
                  onChange={(e) => setFilterTipoEspecie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="MERCADORIA">MERCADORIA</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Tipo de Evento
                </label>
                <select
                  value={filterTipoEvento}
                  onChange={(e) => setFilterTipoEvento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="DIRETA">DIRETA</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={fetchProducts}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Carregando...' : '🔄 Atualizar'}
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  ⚙️ Colunas ({visibleColumns.length}/{columns.length})
                </button>
              </div>
            </div>
          </div>

          {/* Cards de Resumo - Clicáveis */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {/* Card Estoque Zerado */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'zerado' ? 'todos' : 'zerado')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'zerado' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">📭</span>
                <span className="text-2xl font-bold text-red-600">{stats.estoqueZerado}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Estoque Zerado</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Estoque Negativo */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'negativo' ? 'todos' : 'negativo')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'negativo' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">⚠️</span>
                <span className="text-2xl font-bold text-red-700">{stats.estoqueNegativo}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Estoque Negativo</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Sem Venda +30 dias */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'sem_venda' ? 'todos' : 'sem_venda')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'sem_venda' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">⏸️</span>
                <span className="text-2xl font-bold text-orange-600">{stats.semVenda30Dias}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Sem Venda +30d</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Margem Negativa */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'margem_negativa' ? 'todos' : 'margem_negativa')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'margem_negativa' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💸</span>
                <span className="text-2xl font-bold text-red-800">{stats.margemNegativa}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Margem Negativa</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Margem Abaixo Meta */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'margem_baixa' ? 'todos' : 'margem_baixa')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'margem_baixa' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💰</span>
                <span className="text-2xl font-bold text-yellow-600">{stats.margemAbaixoMeta}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Margem Abaixo Meta</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>
          </div>

          {/* Info do filtro ativo */}
          {activeCardFilter !== 'todos' && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded">
              <div className="flex items-center justify-between">
                <p className="text-sm text-orange-800">
                  <strong>Filtro ativo:</strong> {
                    activeCardFilter === 'zerado' ? '📭 Estoque Zerado' :
                    activeCardFilter === 'negativo' ? '⚠️ Estoque Negativo' :
                    activeCardFilter === 'sem_venda' ? '⏸️ Sem Venda +30 dias' :
                    activeCardFilter === 'margem_negativa' ? '💸 Margem Negativa' :
                    '💰 Margem Abaixo da Meta'
                  }
                </p>
                <button
                  onClick={() => setActiveCardFilter('todos')}
                  className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                >
                  ✕ Limpar filtro
                </button>
              </div>
            </div>
          )}

          {/* Tabela de Produtos */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {visibleColumns.map(col => (
                      <th key={col.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        🔄 Carregando produtos...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-red-500">
                        ❌ {error}
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        📭 Nenhum produto encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.codigo} className="hover:bg-gray-50">
                        {visibleColumns.map(col => (
                          <td key={col.id} className={getCellClassName(product, col.id)}>
                            {renderCellValue(product, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer da Tabela */}
            {!loading && !error && filteredProducts.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Exibindo <strong>{filteredProducts.length}</strong> de <strong>{stats.total}</strong> produtos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar de Seleção de Colunas */}
      {showColumnSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowColumnSelector(false)}>
          <div
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">⚙️ Configurar Colunas</h2>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/90 mt-2">
                {visibleColumns.length} de {columns.length} colunas visíveis
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-2">
                {columns.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => toggleColumn(column.id)}
                      className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {column.label}
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setColumns(AVAILABLE_COLUMNS);
                    setShowColumnSelector(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  🔄 Restaurar Padrão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
