import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

export default function ProgramacaoAtual() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data
  const [programacoes, setProgramacoes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Filters
  const [selectedProg, setSelectedProg] = useState('');
  const [filterSecao, setFilterSecao] = useState('');
  const [filterCurva, setFilterCurva] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [searchText, setSearchText] = useState('');
  const [apenasAtivas, setApenasAtivas] = useState(true);

  // Sort
  const [sortColumn, setSortColumn] = useState('DESCRICAO');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Load programacoes
  useEffect(() => {
    const codLoja = lojaSelecionada?.cod_loja || 1;
    setLoading(true);
    api.get(`/api/ofertas/programacoes?codLoja=${codLoja}&ativas=${apenasAtivas}`)
      .then(res => {
        setProgramacoes(res.data || []);
        if (res.data?.length > 0) {
          setSelectedProg(String(res.data[0].COD_PROG));
        } else {
          setSelectedProg('');
          setProdutos([]);
          setResumo(null);
        }
      })
      .catch(err => {
        console.error('Erro ao carregar programacoes:', err);
        setProgramacoes([]);
      })
      .finally(() => setLoading(false));
  }, [lojaSelecionada, apenasAtivas]);

  // Load produtos when programacao changes
  useEffect(() => {
    if (!selectedProg) return;
    const codLoja = lojaSelecionada?.cod_loja || 1;
    setLoadingProdutos(true);
    api.get(`/api/ofertas/produtos/${selectedProg}?codLoja=${codLoja}`)
      .then(res => {
        setProdutos(res.data?.produtos || []);
        setResumo(res.data?.resumo || null);
        setCurrentPage(1);
      })
      .catch(err => {
        console.error('Erro ao carregar produtos:', err);
        setProdutos([]);
        setResumo(null);
      })
      .finally(() => setLoadingProdutos(false));
  }, [selectedProg, lojaSelecionada]);

  // Filter options
  const filterOptions = useMemo(() => {
    const secoes = [...new Set(produtos.map(p => p.SECAO).filter(Boolean))].sort();
    const curvas = [...new Set(produtos.map(p => p.CURVA).filter(Boolean))].sort();
    const fornecedores = [...new Set(produtos.map(p => p.FORNECEDOR).filter(Boolean))].sort();
    return { secoes, curvas, fornecedores };
  }, [produtos]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let result = [...produtos];

    if (filterSecao) result = result.filter(p => p.SECAO === filterSecao);
    if (filterCurva) result = result.filter(p => p.CURVA === filterCurva);
    if (filterFornecedor) result = result.filter(p => p.FORNECEDOR === filterFornecedor);
    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(p =>
        (p.DESCRICAO || '').toLowerCase().includes(s) ||
        (p.COD_BARRAS || '').includes(s) ||
        (p.COD_PRODUTO || '').includes(s)
      );
    }

    // Sort
    result.sort((a, b) => {
      let va = a[sortColumn];
      let vb = b[sortColumn];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [produtos, filterSecao, filterCurva, filterFornecedor, searchText, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (val) => {
    if (val == null) return 'R$ 0,00';
    return `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
  };

  const formatPercent = (val) => {
    if (val == null) return '0,0%';
    return `${Number(val).toFixed(1).replace('.', ',')}%`;
  };

  const formatNumber = (val) => {
    if (val == null) return '0';
    return Number(val).toFixed(2).replace('.', ',');
  };

  const selectedProgData = programacoes.find(p => String(p.COD_PROG) === selectedProg);

  // Table columns definition
  const columns = [
    { id: 'DESCRICAO', label: 'Descricao', align: 'left' },
    { id: 'COD_BARRAS', label: 'EAN', align: 'left' },
    { id: 'CUSTO', label: 'Custo', align: 'right', format: formatCurrency },
    { id: 'PRECO_NORMAL', label: 'Preco Normal', align: 'right', format: formatCurrency },
    { id: 'PRECO_OFERTA', label: 'Preco Oferta', align: 'right', format: formatCurrency },
    { id: 'MARGEM_NORMAL', label: 'Mg Normal', align: 'right', format: formatPercent },
    { id: 'MARGEM_OFERTA', label: 'Mg Oferta', align: 'right', format: formatPercent },
    { id: 'ESTOQUE', label: 'Estoque', align: 'right', format: formatNumber },
    { id: 'VD_MEDIA', label: 'Vd Media', align: 'right', format: formatNumber },
    { id: 'DIAS_COBERTURA', label: 'Dias Cob.', align: 'right', format: (v) => v != null ? Number(v).toFixed(1).replace('.', ',') : '0' },
    { id: 'CURVA', label: 'Curva', align: 'center' },
    { id: 'SECAO', label: 'Secao', align: 'left' },
    { id: 'FORNECEDOR', label: 'Fornecedor', align: 'left' },
  ];

  const getCurvaColor = (curva) => {
    switch (curva) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-orange-100 text-orange-800';
      case 'E': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMargemColor = (margem) => {
    if (margem < 0) return 'text-red-600 font-semibold';
    if (margem < 5) return 'text-orange-600';
    if (margem < 15) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getEstoqueColor = (estoque) => {
    if (estoque <= 0) return 'text-red-600 font-semibold';
    if (estoque < 5) return 'text-orange-600';
    return 'text-gray-900';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Programacao Atual</h1>
          <button onClick={logout} className="p-2 text-gray-600 hover:text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        <div className="p-3 sm:p-6 min-w-0">
          {/* Orange Gradient Header - Desktop */}
          <div className="hidden lg:block bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">GESTAO DE OFERTAS</h1>
                <p className="text-white/90">
                  Acompanhe as ofertas ativas, margens, estoque e performance dos produtos em promocao
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Programacao */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Programacao</label>
                <select
                  value={selectedProg}
                  onChange={(e) => setSelectedProg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  {programacoes.length === 0 && (
                    <option value="">Nenhuma programacao encontrada</option>
                  )}
                  {programacoes.map(p => (
                    <option key={p.COD_PROG} value={String(p.COD_PROG)}>
                      {p.DES_PROGRAMACAO} ({p.DTA_INICIAL} - {p.DTA_FINAL}) [{p.TOTAL_PRODUTOS} itens]
                    </option>
                  ))}
                </select>
              </div>

              {/* Secao */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secao</label>
                <select
                  value={filterSecao}
                  onChange={(e) => { setFilterSecao(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todas</option>
                  {filterOptions.secoes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Curva */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curva</label>
                <select
                  value={filterCurva}
                  onChange={(e) => { setFilterCurva(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todas</option>
                  {filterOptions.curvas.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                <select
                  value={filterFornecedor}
                  onChange={(e) => { setFilterFornecedor(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todos</option>
                  {filterOptions.fornecedores.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Busca */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <input
                  type="text"
                  placeholder="Produto, EAN..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
            </div>

            {/* Toggle ativas */}
            <div className="mt-3 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasAtivas}
                  onChange={(e) => setApenasAtivas(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600">Apenas ofertas ativas</span>
              </label>
              {selectedProgData && (
                <span className="text-xs text-gray-500 ml-4">
                  Vigencia: {selectedProgData.DTA_INICIAL} a {selectedProgData.DTA_FINAL}
                </span>
              )}
            </div>
          </div>

          {/* Cards Resumo */}
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
              {/* Total Produtos */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📦</span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">{resumo.totalProdutos}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Total Produtos</p>
              </div>

              {/* Estoque Zerado */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">🚫</span>
                  <span className="text-xl sm:text-2xl font-bold text-red-600">{resumo.estZerado}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Est. Zerado</p>
                <p className="text-[10px] sm:text-xs text-red-500">
                  {resumo.totalProdutos > 0 ? ((resumo.estZerado / resumo.totalProdutos) * 100).toFixed(1) : 0}% do total
                </p>
              </div>

              {/* Margem Oferta */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">🏷️</span>
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaOferta)}`}>
                    {formatPercent(resumo.margemMediaOferta)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Oferta</p>
              </div>

              {/* Margem Normal */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">💰</span>
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaNormal)}`}>
                    {formatPercent(resumo.margemMediaNormal)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Normal</p>
              </div>

              {/* Valor Estoque */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📊</span>
                  <span className="text-lg sm:text-xl font-bold text-purple-600">
                    {formatCurrency(resumo.valorEstoque)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Valor Estoque</p>
              </div>

              {/* Diferenca Margem */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-amber-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📉</span>
                  <span className={`text-xl sm:text-2xl font-bold ${resumo.difMargem >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resumo.difMargem >= 0 ? '-' : '+'}{formatPercent(Math.abs(resumo.difMargem))}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Dif. Margem</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Normal vs Oferta</p>
              </div>
            </div>
          )}

          {/* Info bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="text-xs sm:text-sm text-gray-600">
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
              {(filterSecao || filterCurva || filterFornecedor || searchText) && (
                <button
                  onClick={() => { setFilterSecao(''); setFilterCurva(''); setFilterFornecedor(''); setSearchText(''); setCurrentPage(1); }}
                  className="ml-2 text-orange-500 hover:text-orange-700 underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {(loading || loadingProdutos) && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Carregando...</span>
            </div>
          )}

          {/* Table */}
          {!loading && !loadingProdutos && filteredProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {columns.map(col => (
                        <th
                          key={col.id}
                          onClick={() => handleSort(col.id)}
                          className={`px-3 py-3 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.label}
                          {sortColumn === col.id && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product, idx) => (
                      <tr key={`${product.COD_PRODUTO}-${idx}`} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                        {/* Descricao */}
                        <td className="px-3 py-2.5 text-sm text-gray-900 max-w-[200px] truncate" title={product.DESCRICAO}>
                          {product.DESCRICAO}
                        </td>
                        {/* EAN */}
                        <td className="px-3 py-2.5 text-sm text-gray-600 font-mono">{product.COD_BARRAS}</td>
                        {/* Custo */}
                        <td className="px-3 py-2.5 text-sm text-right text-gray-700">{formatCurrency(product.CUSTO)}</td>
                        {/* Preco Normal */}
                        <td className="px-3 py-2.5 text-sm text-right text-gray-700">{formatCurrency(product.PRECO_NORMAL)}</td>
                        {/* Preco Oferta */}
                        <td className="px-3 py-2.5 text-sm text-right font-semibold text-orange-600">{formatCurrency(product.PRECO_OFERTA)}</td>
                        {/* Margem Normal */}
                        <td className={`px-3 py-2.5 text-sm text-right ${getMargemColor(product.MARGEM_NORMAL)}`}>
                          {formatPercent(product.MARGEM_NORMAL)}
                        </td>
                        {/* Margem Oferta */}
                        <td className={`px-3 py-2.5 text-sm text-right ${getMargemColor(product.MARGEM_OFERTA)}`}>
                          {formatPercent(product.MARGEM_OFERTA)}
                        </td>
                        {/* Estoque */}
                        <td className={`px-3 py-2.5 text-sm text-right ${getEstoqueColor(product.ESTOQUE)}`}>
                          {formatNumber(product.ESTOQUE)}
                        </td>
                        {/* Vd Media */}
                        <td className="px-3 py-2.5 text-sm text-right text-gray-700">{formatNumber(product.VD_MEDIA)}</td>
                        {/* Dias Cobertura */}
                        <td className={`px-3 py-2.5 text-sm text-right ${product.DIAS_COBERTURA <= 0 ? 'text-red-600 font-semibold' : product.DIAS_COBERTURA < 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                          {product.DIAS_COBERTURA != null ? Number(product.DIAS_COBERTURA).toFixed(1).replace('.', ',') : '0'}
                        </td>
                        {/* Curva */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCurvaColor(product.CURVA)}`}>
                            {product.CURVA}
                          </span>
                        </td>
                        {/* Secao */}
                        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[120px] truncate" title={product.SECAO}>
                          {product.SECAO}
                        </td>
                        {/* Fornecedor */}
                        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[150px] truncate" title={product.FORNECEDOR}>
                          {product.FORNECEDOR}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <div className="text-xs sm:text-sm text-gray-500">
                    {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ⏮
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ◀
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">{currentPage}/{totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ⏭
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadingProdutos && filteredProducts.length === 0 && selectedProg && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou selecionar outra programacao</p>
            </div>
          )}

          {!loading && programacoes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📋</span>
              <p className="text-lg font-medium">Nenhuma programacao {apenasAtivas ? 'ativa' : ''} encontrada</p>
              <p className="text-sm">Verifique se existem ofertas cadastradas no ERP</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
