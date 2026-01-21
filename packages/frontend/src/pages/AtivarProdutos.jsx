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
  const [filterTipoEspecie, setFilterTipoEspecie] = useState('');
  const [filterTipoEvento, setFilterTipoEvento] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Estados para seleção em massa
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Estados para upload de foto
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [photoModalProduct, setPhotoModalProduct] = useState(null);

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

  // Atualizar peso médio do produto
  const handlePesoMedioChange = async (productId, value) => {
    try {
      const peso_medio_kg = parseFloat(value);

      if (isNaN(peso_medio_kg) || peso_medio_kg < 0) {
        return; // Ignora valores inválidos
      }

      // Atualiza localmente primeiro (otimistic update)
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productId ? { ...p, peso_medio_kg } : p
        )
      );

      // Envia para o backend
      await api.put(`/products/${productId}/peso-medio`, { peso_medio_kg });

    } catch (err) {
      console.error('Erro ao atualizar peso médio:', err);
      setError('Erro ao salvar peso médio. Tente novamente.');
      // Recarrega produtos em caso de erro
      fetchProducts();
    }
  };

  // Atualizar dias de produção do produto
  const handleProductionDaysChange = async (productId, value) => {
    try {
      const production_days = parseInt(value);

      if (isNaN(production_days) || production_days < 1) {
        return; // Ignora valores inválidos
      }

      // Atualiza localmente primeiro (otimistic update)
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productId ? { ...p, production_days } : p
        )
      );

      // Envia para o backend
      await api.put(`/products/${productId}/production-days`, { production_days });

    } catch (err) {
      console.error('Erro ao atualizar dias de produção:', err);
      setError('Erro ao salvar dias de produção. Tente novamente.');
      // Recarrega produtos em caso de erro
      fetchProducts();
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

  // Função para fazer upload de foto
  const handlePhotoUpload = async (productId, file) => {
    if (!file) return;

    try {
      setUploadingPhoto(productId);
      setError('');

      const formData = new FormData();
      formData.append('photo', file);

      const response = await api.post(`/products/${productId}/upload-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Atualizar produto localmente com a nova URL da foto
      const newFotoUrl = response.data.foto_url || response.data.foto_referencia;
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productId ? { ...p, foto_referencia: newFotoUrl } : p
        )
      );

      // Atualizar também o modal se ainda estiver aberto
      setPhotoModalProduct(prev => prev ? { ...prev, foto_referencia: newFotoUrl } : null);
      setSuccess('Foto enviada com sucesso!');
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
      setError('Erro ao enviar foto. Tente novamente.');
    } finally {
      setUploadingPhoto(null);
    }
  };

  // Função para excluir foto
  const handleDeletePhoto = async (productId) => {
    if (!confirm('Tem certeza que deseja excluir esta foto?')) return;

    try {
      setUploadingPhoto(productId);
      setError('');

      await api.delete(`/products/${productId}/photo`);

      // Atualizar produto localmente removendo a foto
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productId ? { ...p, foto_referencia: null } : p
        )
      );

      setSuccess('Foto excluída com sucesso!');
      setPhotoModalProduct(null);
    } catch (err) {
      console.error('Erro ao excluir foto:', err);
      setError('Erro ao excluir foto. Tente novamente.');
    } finally {
      setUploadingPhoto(null);
    }
  };

  // Reset seleções ao mudar filtros ou página
  useEffect(() => {
    handleClearSelection();
  }, [searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo, filterTipoEspecie, filterTipoEvento, currentPage]);

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

  const tiposEspecie = useMemo(() => {
    return [...new Set(products.map(p => p.tipoEspecie).filter(Boolean))].sort();
  }, [products]);

  const tiposEvento = useMemo(() => {
    return [...new Set(products.map(p => p.tipoEvento).filter(Boolean))].sort();
  }, [products]);

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
      const matchesTipoEspecie = !filterTipoEspecie || product.tipoEspecie === filterTipoEspecie;
      const matchesTipoEvento = !filterTipoEvento || product.tipoEvento === filterTipoEvento;

      return matchesSearch && matchesFilter && matchesSecao && matchesGrupo && matchesSubGrupo && matchesTipoEspecie && matchesTipoEvento;
    });

    // Depois ordenar se necessário
    if (!sort.field) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal = a[sort.field];
      let bVal = b[sort.field];

      // Tratar valores nulos/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Comparação numérica para preços e campos numéricos
      if (sort.field === 'valvenda' || sort.field === 'valvendaloja' || sort.field === 'vendaMedia' || sort.field === 'diasCobertura') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Comparação string (case insensitive)
      const comparison = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [products, searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo, filterTipoEspecie, filterTipoEvento, sort]);

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
  }, [searchTerm, filterActive, filterSecao, filterGrupo, filterSubGrupo, filterTipoEspecie, filterTipoEvento]);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

            {/* Terceira linha: Tipo Espécie e Tipo Evento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro Tipo Espécie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Espécie
                </label>
                <select
                  value={filterTipoEspecie}
                  onChange={(e) => setFilterTipoEspecie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos os tipos</option>
                  {tiposEspecie.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Tipo Evento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Evento
                </label>
                <select
                  value={filterTipoEvento}
                  onChange={(e) => setFilterTipoEvento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos os eventos</option>
                  {tiposEvento.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
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
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Foto
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
                        <SortableHeader field="tipoEspecie">
                          Tipo Espécie
                        </SortableHeader>
                        <SortableHeader field="tipoEvento">
                          Tipo Evento
                        </SortableHeader>
                        <SortableHeader field="pesavel">
                          Pesável
                        </SortableHeader>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Peso Médio Und
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dias de Produção
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedProducts.map((product) => (
                        <tr key={product.codigo} className="hover:bg-gray-50">
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

                          {/* Foto */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {product.foto_referencia ? (
                              <img
                                src={product.foto_referencia}
                                alt={product.descricao}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200 mx-auto cursor-pointer hover:scale-110 hover:border-orange-400 transition-all"
                                onClick={() => setPhotoModalProduct(product)}
                              />
                            ) : (
                              <div
                                className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 border-dashed flex items-center justify-center mx-auto cursor-pointer hover:bg-orange-50 hover:border-orange-400 transition-all"
                                onClick={() => setPhotoModalProduct(product)}
                              >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                            )}
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

                          {/* Tipo Espécie */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {product.tipoEspecie || '-'}
                          </td>

                          {/* Tipo Evento */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {product.tipoEvento || '-'}
                          </td>

                          {/* Pesável */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {product.pesavel === 'S' ? 'Sim' : 'Não'}
                          </td>

                          {/* Peso Médio Und */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="0.000"
                              value={product.peso_medio_kg || ''}
                              onChange={(e) => handlePesoMedioChange(product.codigo, e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="ml-1 text-xs text-gray-500">kg</span>
                          </td>

                          {/* Dias de Produção */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={product.production_days || ''}
                              onChange={(e) => handleProductionDaysChange(product.codigo, e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="ml-1 text-xs text-gray-500">dias</span>
                          </td>

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
                          {/* Foto do Produto */}
                          <div className="flex-shrink-0">
                            {product.foto_referencia ? (
                              <img
                                src={product.foto_referencia}
                                alt={product.descricao}
                                className="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:scale-110 hover:border-orange-400 transition-all"
                                onClick={() => setPhotoModalProduct(product)}
                              />
                            ) : (
                              <div
                                className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200 border-dashed flex items-center justify-center cursor-pointer hover:bg-orange-50 hover:border-orange-400 transition-all"
                                onClick={() => setPhotoModalProduct(product)}
                              >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                            )}
                          </div>
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
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div>
                                <span className="text-gray-500">Tipo:</span>
                                <span className="ml-1 font-medium">{product.tipoEspecie || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Evento:</span>
                                <span className="ml-1 font-medium">{product.tipoEvento || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Pesável:</span>
                                <span className="ml-1 font-medium">{product.pesavel === 'S' ? 'Sim' : 'Não'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Peso Médio:</span>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="0.000"
                                  value={product.peso_medio_kg || ''}
                                  onChange={(e) => handlePesoMedioChange(product.codigo, e.target.value)}
                                  className="ml-1 w-20 px-2 py-0.5 border border-gray-300 rounded text-xs focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="ml-1 text-xs text-gray-500">kg</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Dias Prod:</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  value={product.production_days || ''}
                                  onChange={(e) => handleProductionDaysChange(product.codigo, e.target.value)}
                                  className="ml-1 w-16 px-2 py-0.5 border border-gray-300 rounded text-xs text-center focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="ml-1 text-xs text-gray-500">dias</span>
                              </div>
                            </div>
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

      {/* Modal de Foto */}
      {photoModalProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {photoModalProduct.foto_referencia ? 'Foto do Produto' : 'Adicionar Foto'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {photoModalProduct.codigo} - {photoModalProduct.descricao}
                </p>
              </div>
              <button
                onClick={() => setPhotoModalProduct(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {photoModalProduct.foto_referencia ? (
                /* Quando há foto - Exibir foto expandida */
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img
                      src={photoModalProduct.foto_referencia}
                      alt={photoModalProduct.descricao}
                      className="max-w-full max-h-[50vh] object-contain rounded-lg border border-gray-200"
                    />
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleDeletePhoto(photoModalProduct.codigo)}
                      disabled={uploadingPhoto === photoModalProduct.codigo}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {uploadingPhoto === photoModalProduct.codigo ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Excluir Foto
                        </>
                      )}
                    </button>
                    <label className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Substituir Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handlePhotoUpload(photoModalProduct.codigo, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* Quando não há foto - Exibir opções de upload */
                <div className="space-y-4">
                  {uploadingPhoto === photoModalProduct.codigo ? (
                    /* Loading state */
                    <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50">
                      <svg className="animate-spin h-12 w-12 text-orange-500 mb-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-sm text-gray-600">Enviando foto...</p>
                    </div>
                  ) : (
                    /* Opções de captura */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Opção de Tirar Foto (Câmera) - Mais visível no mobile */}
                      <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-orange-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all bg-orange-50/50">
                        <svg className="w-12 h-12 text-orange-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-orange-600">Tirar Foto</p>
                        <p className="text-xs text-gray-500 mt-1">Usar a câmera</p>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handlePhotoUpload(photoModalProduct.codigo, e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      {/* Opção de Selecionar da Galeria */}
                      <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-gray-50 transition-all">
                        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-semibold text-gray-600">Galeria</p>
                        <p className="text-xs text-gray-500 mt-1">Selecionar arquivo</p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handlePhotoUpload(photoModalProduct.codigo, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 text-center">PNG, JPG ou JPEG (máx. 5MB)</p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setPhotoModalProduct(null)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}