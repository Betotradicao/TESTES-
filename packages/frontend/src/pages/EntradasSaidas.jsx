import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const TIPO_PARCEIRO_LABELS = {
  0: 'Outros',
  1: 'Fornecedor',
  3: 'Cartão/TEF',
  4: 'Cupom PDV',
  5: 'Funcionário',
};

const INITIAL_COLUMNS = [
  { id: 'TIPO', header: '📋 Tipo', align: 'center' },
  { id: 'PARCEIRO', header: '👤 Parceiro', align: 'left' },
  { id: 'DOCUMENTO', header: '📄 Documento', align: 'left' },
  { id: 'PARCELA', header: '📑 Parcela', align: 'center' },
  { id: 'VENCIMENTO', header: '📅 Vencimento', align: 'center' },
  { id: 'VALOR', header: '💰 Valor', align: 'right' },
  { id: 'JUROS', header: '📈 Juros', align: 'right' },
  { id: 'DESCONTO', header: '📉 Desconto', align: 'right' },
  { id: 'STATUS', header: '🔖 Status', align: 'center' },
  { id: 'DT_QUITACAO', header: '✅ Dt. Quitação', align: 'center' },
  { id: 'BANCO', header: '🏦 Banco', align: 'left' },
  { id: 'ENTIDADE', header: '💳 Entidade', align: 'left' },
  { id: 'CATEGORIA', header: '📂 Categoria', align: 'left' },
  { id: 'TIPO_PARCEIRO', header: '🏷️ Tipo Parceiro', align: 'center' },
  { id: 'NF', header: '🧾 NF', align: 'center' },
  { id: 'OBS', header: '📝 Obs', align: 'left' },
];

export default function EntradasSaidas() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [resumo, setResumo] = useState({});
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('entradas_saidas_columns_order');
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const colMap = {};
        INITIAL_COLUMNS.forEach(c => colMap[c.id] = c);
        const ordered = savedIds.filter(id => colMap[id]).map(id => colMap[id]);
        INITIAL_COLUMNS.forEach(c => { if (!savedIds.includes(c.id)) ordered.push(c); });
        return ordered;
      } catch { return INITIAL_COLUMNS; }
    }
    return INITIAL_COLUMNS;
  });

  // Filtros
  const [filters, setFilters] = useState({
    dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    tipoConta: '',
    quitado: '',
    tipoParceiro: '',
    codBanco: '',
    codEntidade: '',
    codCategoria: '',
    parceiro: '',
  });

  // Dropdowns
  const [bancos, setBancos] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Drag & drop columns
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  useEffect(() => { loadFilterData(); }, []);

  const loadFilterData = async () => {
    setLoadingFilters(true);
    try {
      const [bancosRes, entidadesRes, categoriasRes] = await Promise.all([
        api.get('/financeiro/bancos').catch(() => ({ data: [] })),
        api.get('/financeiro/entidades').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setBancos(bancosRes.data || []);
      setEntidades(entidadesRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);
      if (filters.tipoConta) params.append('tipoConta', filters.tipoConta);
      if (filters.quitado) params.append('quitado', filters.quitado);
      if (filters.tipoParceiro) params.append('tipoParceiro', filters.tipoParceiro);
      if (filters.codBanco) params.append('codBanco', filters.codBanco);
      if (filters.codEntidade) params.append('codEntidade', filters.codEntidade);
      if (filters.codCategoria) params.append('codCategoria', filters.codCategoria);
      if (filters.parceiro) params.append('parceiro', filters.parceiro);
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      const [dadosRes, resumoRes] = await Promise.all([
        api.get(`/financeiro/dados?${params.toString()}`),
        api.get(`/financeiro/resumo?${params.toString()}`),
      ]);

      setData(dadosRes.data?.data || []);
      setResumo(resumoRes.data || {});
      toast.success(`${dadosRes.data?.count || 0} registros encontrados`);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({
      dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
      tipoConta: '',
      quitado: '',
      tipoParceiro: '',
      codBanco: '',
      codEntidade: '',
      codCategoria: '',
      parceiro: '',
    });
    setData([]);
    setResumo({});
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (val) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('pt-BR');
  };

  const renderCellValue = (row, colId) => {
    switch (colId) {
      case 'TIPO':
        return row.TIPO_CONTA === 0
          ? <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">SAÍDA</span>
          : <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">ENTRADA</span>;
      case 'PARCEIRO':
        return <span className="truncate max-w-[200px] block" title={row.DES_PARCEIRO}>{row.DES_PARCEIRO || '-'}</span>;
      case 'DOCUMENTO':
        return row.NUM_DOCTO || '-';
      case 'PARCELA':
        return row.QTD_PARCELA > 1 ? `${row.NUM_PARCELA}/${row.QTD_PARCELA}` : '-';
      case 'VENCIMENTO':
        return formatDate(row.DTA_VENCIMENTO);
      case 'VALOR':
        return formatCurrency(row.VAL_PARCELA);
      case 'JUROS':
        return row.VAL_JUROS > 0 ? formatCurrency(row.VAL_JUROS) : '-';
      case 'DESCONTO':
        return row.VAL_DESCONTO > 0 ? formatCurrency(row.VAL_DESCONTO) : '-';
      case 'STATUS':
        return row.FLG_QUITADO === 'S'
          ? <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">Quitado</span>
          : <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">Aberto</span>;
      case 'DT_QUITACAO':
        return formatDate(row.DTA_QUITADA);
      case 'BANCO':
        return row.DES_BANCO || '-';
      case 'ENTIDADE':
        return row.DES_ENTIDADE || '-';
      case 'CATEGORIA':
        return row.DES_CATEGORIA || '-';
      case 'TIPO_PARCEIRO':
        return TIPO_PARCEIRO_LABELS[row.TIPO_PARCEIRO] || row.TIPO_PARCEIRO;
      case 'NF':
        return row.NUM_NF || '-';
      case 'OBS':
        return <span className="truncate max-w-[150px] block" title={row.DES_OBSERVACAO}>{row.DES_OBSERVACAO || '-'}</span>;
      default:
        return '-';
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e, colId) => { setDraggedColumn(colId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnd = () => { setDraggedColumn(null); setDragOverColumn(null); };
  const handleDragOver = (e, colId) => { e.preventDefault(); setDragOverColumn(colId); };
  const handleDragLeave = () => { setDragOverColumn(null); };
  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColId) return;
    const newCols = [...columns];
    const fromIdx = newCols.findIndex(c => c.id === draggedColumn);
    const toIdx = newCols.findIndex(c => c.id === targetColId);
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    setColumns(newCols);
    localStorage.setItem('entradas_saidas_columns_order', JSON.stringify(newCols.map(c => c.id)));
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ENTRADAS E SAÍDAS</h1>
              <p className="text-orange-100 text-sm">Contas a Pagar e Receber - Fluxo Financeiro</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Cards de Resumo */}
          {(resumo.TOTAL_ENTRADAS !== undefined) && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium uppercase">Total Entradas</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(resumo.TOTAL_ENTRADAS)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs text-red-600 font-medium uppercase">Total Saídas</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(resumo.TOTAL_SAIDAS)}</p>
              </div>
              <div className={`${Number(resumo.SALDO) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
                <p className={`text-xs font-medium uppercase ${Number(resumo.SALDO) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
                <p className={`text-lg font-bold ${Number(resumo.SALDO) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(resumo.SALDO)}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-600 font-medium uppercase">Abertos</p>
                <p className="text-lg font-bold text-yellow-700">{Number(resumo.QTD_ABERTOS || 0).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-yellow-500">{formatCurrency(resumo.SAIDAS_ABERTAS)} a pagar</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-xs text-emerald-600 font-medium uppercase">Quitados</p>
                <p className="text-lg font-bold text-emerald-700">{Number(resumo.QTD_QUITADOS || 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📅 Data Início</label>
                <input type="date" value={filters.dataInicio} onChange={(e) => setFilters({...filters, dataInicio: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📅 Data Fim</label>
                <input type="date" value={filters.dataFim} onChange={(e) => setFilters({...filters, dataFim: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📋 Tipo</label>
                <select value={filters.tipoConta} onChange={(e) => setFilters({...filters, tipoConta: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="1">Entradas (Receber)</option>
                  <option value="0">Saídas (Pagar)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🔖 Status</label>
                <select value={filters.quitado} onChange={(e) => setFilters({...filters, quitado: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="N">Abertos</option>
                  <option value="S">Quitados</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🏷️ Parceiro</label>
                <select value={filters.tipoParceiro} onChange={(e) => setFilters({...filters, tipoParceiro: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="1">Fornecedor</option>
                  <option value="3">Cartão/TEF</option>
                  <option value="4">Cupom PDV</option>
                  <option value="5">Funcionário</option>
                  <option value="0">Outros</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🏦 Banco</label>
                <select value={filters.codBanco} onChange={(e) => setFilters({...filters, codBanco: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todos'}</option>
                  {bancos.map(b => <option key={b.COD_BANCO} value={b.COD_BANCO}>{b.DES_BANCO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">💳 Entidade</label>
                <select value={filters.codEntidade} onChange={(e) => setFilters({...filters, codEntidade: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todas'}</option>
                  {entidades.map(e => <option key={e.COD_ENTIDADE} value={e.COD_ENTIDADE}>{e.DES_ENTIDADE}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📂 Categoria</label>
                <select value={filters.codCategoria} onChange={(e) => setFilters({...filters, codCategoria: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todas'}</option>
                  {categorias.map(c => <option key={c.COD_CATEGORIA} value={c.COD_CATEGORIA}>{c.DES_CATEGORIA}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🔍 Buscar Parceiro</label>
                <input type="text" placeholder="Nome do parceiro..." value={filters.parceiro}
                  onChange={(e) => setFilters({...filters, parceiro: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleSearch} disabled={loading}
                  className="flex-1 px-4 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </>
                  ) : 'Pesquisar'}
                </button>
                <button onClick={handleClear}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">
                  Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow overflow-hidden relative">
            {loading && data.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <RadarLoading message="Buscando dados financeiros..." />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-600">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.id} draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`px-3 py-3 text-xs font-medium text-white uppercase tracking-wider cursor-move select-none whitespace-nowrap
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                          ${dragOverColumn === col.id ? 'bg-gray-500 border-l-2 border-orange-400' : ''}
                          ${draggedColumn === col.id ? 'opacity-50' : ''}
                          hover:bg-gray-500`}
                        title="Arraste para reordenar">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                          </svg>
                          <span>{col.header}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                        {loading ? '' : 'Nenhum dado encontrado. Selecione os filtros e clique em Pesquisar.'}
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={row.NUM_REGISTRO || idx} className={`hover:bg-gray-50 ${row.TIPO_CONTA === 0 ? 'bg-red-50/20' : 'bg-green-50/20'}`}>
                        {columns.map((col) => (
                          <td key={col.id}
                            className={`px-3 py-2 text-sm whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                            {renderCellValue(row, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 border-t">
                Exibindo {data.length} registros (máximo 500)
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
