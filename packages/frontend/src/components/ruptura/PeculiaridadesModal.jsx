import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function PeculiaridadesModal({ onClose }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [changes, setChanges] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  // Filtros
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [filtroSecao, setFiltroSecao] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('');

  // Carregar opcoes de filtro
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Carregar produtos quando filtros mudarem
  useEffect(() => {
    loadProducts();
  }, [page, search, filtroSecao, filtroGrupo, filtroSubgrupo]);

  const loadFilterOptions = async () => {
    try {
      // Buscar secoes unicas
      const response = await api.get('/products/sections');
      setSecoes(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar filtros:', err);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });

      if (search) {
        params.append('search', search);
      }
      if (filtroSecao) {
        params.append('secao', filtroSecao);
      }
      if (filtroGrupo) {
        params.append('grupo', filtroGrupo);
      }
      if (filtroSubgrupo) {
        params.append('subgrupo', filtroSubgrupo);
      }

      const response = await api.get(`/products/peculiaridades?${params}`);
      setProducts(response.data.products);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);

      // Atualizar listas de grupos e subgrupos baseado nos produtos
      if (response.data.grupos) {
        setGrupos(response.data.grupos);
      }
      if (response.data.subgrupos) {
        setSubgrupos(response.data.subgrupos);
      }
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setError('Erro ao carregar produtos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCheckboxChange = (erpProductId) => {
    // Buscar valor atual do produto
    const product = products.find(p => p.erp_product_id === erpProductId);
    if (!product) return;

    const newValue = !product.sem_exposicao;

    // Update local state for immediate UI feedback
    setProducts(prev => prev.map(p =>
      p.erp_product_id === erpProductId
        ? { ...p, sem_exposicao: newValue }
        : p
    ));

    // Track changes
    setChanges(prev => {
      const existing = prev[erpProductId] || {};
      return {
        ...prev,
        [erpProductId]: { ...existing, sem_exposicao: newValue }
      };
    });
  };

  const handleGrupoSimilarChange = (erpProductId, value) => {
    const numValue = value === '' ? null : parseInt(value, 10);

    // Update local state for immediate UI feedback
    setProducts(prev => prev.map(p =>
      p.erp_product_id === erpProductId
        ? { ...p, grupo_similar: numValue }
        : p
    ));

    // Track changes
    setChanges(prev => {
      const existing = prev[erpProductId] || {};
      return {
        ...prev,
        [erpProductId]: { ...existing, grupo_similar: numValue }
      };
    });
  };

  const handleSave = async () => {
    // Build list of products with changes
    const changedProducts = Object.entries(changes).map(([erp_product_id, data]) => {
      const product = products.find(p => p.erp_product_id === erp_product_id);
      return {
        erp_product_id,
        sem_exposicao: data.sem_exposicao !== undefined ? data.sem_exposicao : product?.sem_exposicao,
        grupo_similar: data.grupo_similar !== undefined ? data.grupo_similar : product?.grupo_similar
      };
    });

    if (changedProducts.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.put('/products/peculiaridades', {
        products: changedProducts
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError('Erro ao salvar alteracoes. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setFiltroSecao('');
    setFiltroGrupo('');
    setFiltroSubgrupo('');
    setPage(1);
  };

  const hasChanges = Object.keys(changes).length > 0;
  const hasFilters = search || filtroSecao || filtroGrupo || filtroSubgrupo;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Configurar Peculiaridades
              </h3>
              <p className="text-sm text-gray-500">
                Configure produtos sem exposicao e grupos de itens similares
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Legend */}
          <div className="p-2 bg-blue-50 rounded text-sm text-blue-700 mb-3">
            <strong>Grupo Similar:</strong> Produtos com o mesmo numero sao similares. Ex: Leite A e Leite B com grupo "1"
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {/* Busca */}
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Codigo, EAN ou descricao..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* Secao */}
            <select
              value={filtroSecao}
              onChange={(e) => { setFiltroSecao(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="">Todas Secoes</option>
              {secoes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Grupo */}
            <select
              value={filtroGrupo}
              onChange={(e) => { setFiltroGrupo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="">Todos Grupos</option>
              {grupos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Subgrupo */}
            <select
              value={filtroSubgrupo}
              onChange={(e) => { setFiltroSubgrupo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="">Todos Subgrupos</option>
              {subgrupos.map(sg => (
                <option key={sg} value={sg}>{sg}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-orange-600 hover:text-orange-800"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Carregando produtos...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum produto encontrado com esses filtros.
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-500 mb-3">
                Mostrando {products.length} de {total} produtos
              </div>

              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Codigo
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Descricao
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Secao
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Sem Exp.
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Grp. Similar
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr
                      key={product.erp_product_id}
                      className={`hover:bg-gray-50 ${product.sem_exposicao ? 'bg-orange-50' : ''} ${product.grupo_similar ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-2 py-2 text-sm text-gray-900 font-mono">
                        {product.erp_product_id}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900">
                        {product.description}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-600">
                        {product.section_name || '-'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={product.sem_exposicao || false}
                          onChange={() => handleCheckboxChange(product.erp_product_id)}
                          className="h-5 w-5 text-orange-500 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={product.grupo_similar || ''}
                          onChange={(e) => handleGrupoSimilarChange(product.erp_product_id, e.target.value)}
                          placeholder="-"
                          className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Pagina {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Proxima
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {hasChanges && (
                <span className="text-orange-600 font-medium">
                  {Object.keys(changes).length} produto(s) alterado(s)
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar Alteracoes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
