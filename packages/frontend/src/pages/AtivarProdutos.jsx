import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

export default function AtivarProdutos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // all, active, inactive
  const [filterSecao, setFilterSecao] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterSubGrupo, setFilterSubGrupo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Estados para seleção em massa
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Estado para ordenação
  const [sort, setSort] = useState({ field: '', direction: 'asc' });

  // Função para ordenação
  const handleSort = (field) => {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    setSort({ field, direction });
  };

  // Componente de header ordenável
  const SortableHeader = ({ field, children }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sort.field === field ? (
          <span className="text-orange-500 text-sm">
            {sort.direction === 'asc' ? '↑' : '↓'}
          </span>
        ) : (
          <span className="text-gray-300 text-xs hover:text-gray-400">
            ↑↓
          </span>
        )}
      </div>
    </th>
  );

  // Função para buscar produtos
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/products');
      setProducts(response.data.data || response.data);

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

  // Função para ativar/desativar produto
  const toggleProduct = async (productId, currentState) => {
    // Verificar se já há algum produto sendo atualizado
    if (Object.values(updating).some(isUpdating => isUpdating)) {
      return;
    }

    try {
      setUpdating({ [productId]: true });
      setError('');

      await api.put(`/products/${productId}/activate`, {
        active: !currentState
      });

      // Atualizar lista local
      setProducts(products.map(product =>
        product.codigo === productId
          ? { ...product, active: !currentState }
          : product
      ));

    } catch (err) {
      console.error('Erro ao atualizar produto:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao atualizar produto. Tente novamente.');
      }
    } finally {
      setUpdating({});
    }
  };

  // Funções de seleção em massa
  const handleSelectProduct = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      // Desmarcar todos
      setSelectedProducts(new Set());
      setSelectAll(false);
    } else {
      // Selecionar todos os produtos da página atual
      const currentPageProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      );
      const newSelected = new Set(currentPageProducts.map(p => p.codigo));
      setSelectedProducts(newSelected);
      setSelectAll(true);
    }
  };

  const handleSelectAllVisible = () => {
    const newSelected = new Set(filteredProducts.map(p => p.codigo));
    setSelectedProducts(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedProducts(new Set());
    setSelectAll(false);
  };

  const handleCaptureFromCamera = async (productCode) => {
    try {
      setUpdating(prev => ({ ...prev, [productCode]: true }));
      setError('');

      console.log(`📸 Capturando foto da câmera para produto ${productCode}...`);

      // Chamar API para capturar foto da câmera 15 (balança)
      const response = await api.post(`/products/${productCode}/capture-from-camera`, {
        cameraId: 15
      });

      console.log('✅ Foto capturada e analisada:', response.data);

      // Atualizar produto localmente com os dados da análise
      setProducts(products.map(product =>
        product.codigo === productCode
          ? {
              ...product,
              foto_referencia: response.data.foto_url,
              coloracao: response.data.analysis.coloracao,
              formato: response.data.analysis.formato,
              gordura_visivel: response.data.analysis.gordura_visivel,
              presenca_osso: response.data.analysis.presenca_osso
            }
          : product
      ));

      setSuccess(`Foto capturada e analisada! Confiança: ${response.data.analysis.confianca}%`);

    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        const errorMsg = err.response?.data?.error || 'Erro ao capturar foto da câmera. Verifique se o DVR está configurado.';
        setError(errorMsg);
      }
    } finally {
      setUpdating(prev => ({ ...prev, [productCode]: false }));
    }
  };

  const handleBulkActivate = async (activate) => {
    if (selectedProducts.size === 0) return;

    const confirmMessage = activate
      ? `Tem certeza que deseja ATIVAR ${selectedProducts.size} produtos selecionados?`
      : `Tem certeza que deseja DESATIVAR ${selectedProducts.size} produtos selecionados?`;

    if (!confirm(confirmMessage)) return;

    try {
      setBulkUpdating(true);
      setError('');

      // Fazer requisição em lote
      const selectedIds = Array.from(selectedProducts);
      await api.put('/products/bulk-activate', {
        productIds: selectedIds,
        active: activate
      });

      // Atualizar produtos localmente
      setProducts(products.map(product =>
        selectedProducts.has(product.codigo)
          ? { ...product, active: activate }
          : product
      ));

      // Limpar seleção
      handleClearSelection();

      setSuccess(`${selectedProducts.size} produtos ${activate ? 'ativados' : 'desativados'} com sucesso!`);

    } catch (err) {
      console.error('Erro na ativação em massa:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao processar ativação em massa. Tente novamente.');
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  // Reset seleções ao mudar filtros ou página
  useEffect(() => {
    handleClearSelection();
  }, [searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo, currentPage]);

  // Carregar produtos ao montar componente
  useEffect(() => {
    fetchProducts();
  }, []);

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Extrair listas únicas para os filtros em cascata
  const secoes = useMemo(() => {
    return [...new Set(products.map(p => p.desSecao).filter(Boolean))].sort();
  }, [products]);

  const grupos = useMemo(() => {
    if (!filterSecao) return [];
    return [...new Set(
      products
        .filter(p => p.desSecao === filterSecao)
        .map(p => p.desGrupo)
        .filter(Boolean)
    )].sort();
  }, [products, filterSecao]);

  const subgrupos = useMemo(() => {
    if (!filterGrupo) return [];
    return [...new Set(
      products
        .filter(p => p.desSecao === filterSecao && p.desGrupo === filterGrupo)
        .map(p => p.desSubGrupo)
        .filter(Boolean)
    )].sort();
  }, [products, filterSecao, filterGrupo]);

  // Filtrar e ordenar produtos
  const filteredProducts = useMemo(() => {
    // Primeiro filtrar
    const filtered = products.filter(product => {
      const matchesSearch = product.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            product.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            product.ean?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterActive === 'all' ||
                            (filterActive === 'active' && product.active) ||
                            (filterActive === 'inactive' && !product.active);

      const matchesSecao = !filterSecao || product.desSecao === filterSecao;
      const matchesGrupo = !filterGrupo || product.desGrupo === filterGrupo;
      const matchesSubGrupo = !filterSubGrupo || product.desSubGrupo === filterSubGrupo;

      return matchesSearch && matchesFilter && matchesSecao && matchesGrupo && matchesSubGrupo;
    });

    // Depois ordenar se necessário
    if (!sort.field) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal = a[sort.field];
      let bVal = b[sort.field];

      // Tratar valores nulos/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Comparação numérica para preços
      if (sort.field === 'valvenda' || sort.field === 'valvendaloja') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Comparação string (case insensitive)
      const comparison = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [products, searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo, sort]);

  // Paginar produtos filtrados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Calcular total de páginas
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo]);

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
          <h1 className="text-lg font-semibold text-gray-900">Ativar Produtos</h1>
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
          {/* Card de Estatísticas com Gradiente Laranja */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl lg:text-3xl font-bold">Ativar Produtos</h1>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
            </div>

            <p className="text-white/90 mb-6">
              Gerencie quais produtos devem ser monitorados pelo sistema de prevenção
            </p>

            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/80 text-sm font-medium mb-1">Total de Produtos</div>
                <div className="text-3xl font-bold">{products.length}</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/80 text-sm font-medium mb-1">Produtos Ativos</div>
                <div className="text-3xl font-bold">{products.filter(p => p.active).length}</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/80 text-sm font-medium mb-1">Produtos Inativos</div>
                <div className="text-3xl font-bold">{products.filter(p => !p.active).length}</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/80 text-sm font-medium mb-1">Selecionados</div>
                <div className="text-3xl font-bold">{selectedProducts.size}</div>
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            {/* Primeira linha: Buscar produto e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Busca */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar produto
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o código ou descrição..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
              </div>

              {/* Filtro de Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">Todos os produtos</option>
                  <option value="active">Produtos ativos</option>
                  <option value="inactive">Produtos inativos</option>
                </select>
              </div>
            </div>

            {/* Segunda linha: Seção, Grupo e Subgrupo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro Seção */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seção
                </label>
                <select
                  value={filterSecao}
                  onChange={(e) => {
                    setFilterSecao(e.target.value);
                    setFilterGrupo(''); // Reset cascata
                    setFilterSubGrupo('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todas as seções</option>
                  {secoes.map(secao => (
                    <option key={secao} value={secao}>{secao}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Grupo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grupo
                </label>
                <select
                  value={filterGrupo}
                  onChange={(e) => {
                    setFilterGrupo(e.target.value);
                    setFilterSubGrupo(''); // Reset cascata
                  }}
                  disabled={!filterSecao}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Todos os grupos</option>
                  {grupos.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Subgrupo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subgrupo
                </label>
                <select
                  value={filterSubGrupo}
                  onChange={(e) => setFilterSubGrupo(e.target.value)}
                  disabled={!filterGrupo}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Todos os subgrupos</option>
                  {subgrupos.map(subgrupo => (
                    <option key={subgrupo} value={subgrupo}>{subgrupo}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ações em Massa */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <div className="flex flex-col space-y-4">
              {/* Primeira linha: Seleção */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <span className="text-sm font-medium text-gray-700">Seleção em Massa:</span>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors text-center"
                    >
                      Selecionar Todos Visíveis ({filteredProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={selectedProducts.size === 0}
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>
                {selectedProducts.size > 0 && (
                  <div className="text-sm text-gray-600 sm:ml-auto">
                    <span className="font-medium">{selectedProducts.size}</span> produtos selecionados
                  </div>
                )}
              </div>

              {/* Segunda linha: Ações */}
              {selectedProducts.size > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-3 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Ações:</span>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => handleBulkActivate(true)}
                      disabled={bulkUpdating}
                      className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      {bulkUpdating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                          </svg>
                          <span>Ativar Selecionados</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkActivate(false)}
                      disabled={bulkUpdating}
                      className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      {bulkUpdating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                          <span>Desativar Selecionados</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mensagens de Sucesso/Erro */}
          {success && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
              <div className="flex">
                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-orange-700">{success}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Produtos */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Produtos ({filteredProducts.length} encontrados)
                </h3>
                <div className="text-sm text-gray-500">
                  Página {currentPage} de {totalPages}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Carregando produtos...
                </div>
              </div>
            ) : (
              <>
                {/* Tabela para Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                            />
                          </div>
                        </th>
                        <SortableHeader field="codigo">
                          Código
                        </SortableHeader>
                        <SortableHeader field="ean">
                          EAN
                        </SortableHeader>
                        <SortableHeader field="descricao">
                          Descrição
                        </SortableHeader>
                        <SortableHeader field="valvenda">
                          Preço
                        </SortableHeader>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Foto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Coloração
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Formato
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gordura
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Osso
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Peso (kg)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Posição
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedProducts.map((product) => (
                        <tr key={product.codigo} className="hover:bg-gray-50">
                          {/* Ação - Toggle Ativo/Inativo */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <label className={`relative inline-flex items-center ${
                              Object.values(updating).some(isUpdating => isUpdating) && !updating[product.codigo]
                                ? 'cursor-not-allowed opacity-50'
                                : updating[product.codigo]
                                ? 'cursor-not-allowed'
                                : 'cursor-pointer'
                            }`}>
                              <input
                                type="checkbox"
                                checked={product.active}
                                onChange={() => toggleProduct(product.codigo, product.active)}
                                disabled={Object.values(updating).some(isUpdating => isUpdating)}
                                className="sr-only peer"
                              />
                              <div className={`relative w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                                updating[product.codigo]
                                  ? 'bg-gray-300 peer-checked:bg-gray-400'
                                  : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 peer-checked:bg-orange-500'
                              }`}></div>
                            </label>
                          </td>

                          {/* Checkbox */}
                          <td className="px-6 py-4 whitespace-nowrap w-16">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedProducts.has(product.codigo)}
                                onChange={() => handleSelectProduct(product.codigo)}
                                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </div>
                          </td>

                          {/* Código */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {product.codigo}
                          </td>

                          {/* EAN */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {product.ean || '-'}
                          </td>

                          {/* Descrição */}
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {product.descricao}
                          </td>

                          {/* Preço */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.valvenda ? `R$ ${product.valvenda.toFixed(2).replace('.', ',')}` : '-'}
                          </td>

                          {/* Foto */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleCaptureFromCamera(product.codigo)}
                              disabled={updating[product.codigo]}
                              className="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Capturar foto da câmera 15 (balança) e analisar com IA"
                            >
                              {updating[product.codigo] ? '⏳ Processando...' : '📷 Upload'}
                            </button>
                          </td>

                          {/* Coloração */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select className="text-xs border border-gray-300 rounded px-2 py-1">
                              <option value="">-</option>
                              <option value="vermelho">🔴 Vermelho</option>
                              <option value="rosa">🌸 Rosa</option>
                              <option value="branco">⚪ Branco</option>
                              <option value="amarelo">🟡 Amarelo</option>
                              <option value="marrom">🟤 Marrom</option>
                            </select>
                          </td>

                          {/* Formato */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select className="text-xs border border-gray-300 rounded px-2 py-1">
                              <option value="">-</option>
                              <option value="retangular">Retangular</option>
                              <option value="irregular">Irregular</option>
                              <option value="cilindrico">Cilíndrico</option>
                              <option value="achatado">Achatado</option>
                              <option value="triangular">Triangular</option>
                            </select>
                          </td>

                          {/* Gordura */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select className="text-xs border border-gray-300 rounded px-2 py-1">
                              <option value="">-</option>
                              <option value="nenhuma">Nenhuma</option>
                              <option value="pouca">Pouca</option>
                              <option value="media">Média</option>
                              <option value="muita">Muita</option>
                            </select>
                          </td>

                          {/* Osso */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <input type="checkbox" className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded" />
                          </td>

                          {/* Peso */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-1 items-center">
                              <input type="number" step="0.1" placeholder="Min" className="w-16 text-xs border border-gray-300 rounded px-1 py-1" />
                              <span className="text-gray-400 text-xs">-</span>
                              <input type="number" step="0.1" placeholder="Max" className="w-16 text-xs border border-gray-300 rounded px-1 py-1" />
                            </div>
                          </td>

                          {/* Posição */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button className="text-orange-600 hover:text-orange-800 text-xs">
                              📍 Definir
                            </button>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.active
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {product.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards para Mobile */}
                <div className="lg:hidden">
                  {paginatedProducts.map((product) => (
                    <div key={product.codigo} className="border-b border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.codigo)}
                            onChange={() => handleSelectProduct(product.codigo)}
                            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {product.codigo}
                            </div>
                            <div className="text-xs text-gray-500">
                              EAN: {product.ean || 'Sem EAN'}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {product.descricao}
                            </div>
                            {product.valvenda && (
                              <div className="text-sm font-medium text-gray-900 mt-1">
                                R$ {product.valvenda.toFixed(2).replace('.', ',')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            product.active
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <label className={`relative inline-flex items-center ${
                            Object.values(updating).some(isUpdating => isUpdating) && !updating[product.codigo]
                              ? 'cursor-not-allowed opacity-50'
                              : updating[product.codigo]
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}>
                            <input
                              type="checkbox"
                              checked={product.active}
                              onChange={() => toggleProduct(product.codigo, product.active)}
                              disabled={Object.values(updating).some(isUpdating => isUpdating)}
                              className="sr-only peer"
                            />
                            <div className={`relative w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                              updating[product.codigo]
                                ? 'bg-gray-300 peer-checked:bg-gray-400'
                                : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 peer-checked:bg-orange-500'
                            }`}></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredProducts.length === 0 && !loading && (
                  <div className="p-8 text-center text-gray-500">
                    Nenhum produto encontrado com os filtros selecionados.
                  </div>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="px-4 py-4 border-t border-gray-200">
                    {/* Mobile */}
                    <div className="lg:hidden space-y-3">
                      <div className="text-center text-sm text-gray-600">
                        Página {currentPage} de {totalPages} • {filteredProducts.length} produtos
                      </div>
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 flex-shrink-0 transition-colors"
                        >
                          ‹
                        </button>

                        {/* Números compactos para mobile */}
                        <div className="flex space-x-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-2 text-sm rounded-md flex-shrink-0 min-w-[40px] transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 flex-shrink-0 transition-colors"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden lg:flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)} a{' '}
                        {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produtos
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                        >
                          Anterior
                        </button>

                        {/* Números das páginas */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}