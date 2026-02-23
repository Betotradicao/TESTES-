import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

const formatWhatsAppUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : '55' + digits;
  return `https://web.whatsapp.com/send?phone=${num}`;
};

const formatCnpj = (cnpj) => {
  if (!cnpj) return '-';
  const nums = String(cnpj).replace(/\D/g, '');
  if (nums.length === 14) return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return cnpj;
};

const formatCurrency = (val) => {
  if (!val && val !== 0) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const FILTROS = [
  { id: 'saldo', label: 'Saldo Pendente', desc: 'Saídas - Retornos - Zerados > 0' },
  { id: 'saidas', label: 'Saídas', desc: 'Sair Estoque Loja → Troca Fornecedor' },
  { id: 'retornos', label: 'Retornos', desc: 'Sair Troca Fornecedor → Estoque Loja' },
  { id: 'zerados', label: 'Zerados', desc: 'Sair Troca Fornecedor e Não Voltar' },
];

const DEFAULT_COLUMNS = [
  { id: 'num', label: '#', align: 'center', width: 45 },
  { id: 'fantasia', label: 'Fantasia', align: 'left', width: 170 },
  { id: 'razaoSocial', label: 'Razão Social', align: 'left', width: 250 },
  { id: 'cnpj', label: 'CNPJ', align: 'left', width: 165 },
  { id: 'contato', label: 'Contato', align: 'left', width: 130 },
  { id: 'celular', label: 'Celular', align: 'center', width: 160 },
  { id: 'qtdTroca', label: 'Qtd Troca', align: 'right', width: 90 },
  { id: 'totalCusto', label: 'Total Custo', align: 'right', width: 130 },
  { id: 'totalVenda', label: 'Total Venda', align: 'right', width: 130 },
];

export default function PrevencaoTrocas() {
  const { lojaSelecionada } = useLoja();
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('saldo');
  const [expandidos, setExpandidos] = useState(new Set());
  const [itensCarregando, setItensCarregando] = useState(new Set());
  const [itensPorFornecedor, setItensPorFornecedor] = useState({});
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS.map(c => c.id));
  const [busca, setBusca] = useState('');
  const dragCol = useRef(null);
  const dragOverCol = useRef(null);

  useEffect(() => {
    carregarTrocas();
  }, [lojaSelecionada, tipoFiltro]);

  const carregarTrocas = async () => {
    setLoading(true);
    setError('');
    setExpandidos(new Set());
    setItensPorFornecedor({});
    try {
      const params = new URLSearchParams({ tipo: tipoFiltro });
      if (lojaSelecionada) params.append('loja', lojaSelecionada);
      const response = await api.get(`/losses/oracle/trocas?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar trocas do Oracle');
    } finally {
      setLoading(false);
    }
  };

  const toggleFornecedor = async (codFornecedor) => {
    const newExpandidos = new Set(expandidos);
    if (newExpandidos.has(codFornecedor)) {
      newExpandidos.delete(codFornecedor);
      setExpandidos(newExpandidos);
    } else {
      newExpandidos.add(codFornecedor);
      setExpandidos(newExpandidos);
      if (!itensPorFornecedor[codFornecedor]) {
        setItensCarregando(prev => new Set(prev).add(codFornecedor));
        try {
          const params = new URLSearchParams({ cod_fornecedor: codFornecedor.toString(), tipo: tipoFiltro });
          if (lojaSelecionada) params.append('loja', lojaSelecionada);
          const response = await api.get(`/losses/oracle/trocas/itens?${params}`);
          setItensPorFornecedor(prev => ({ ...prev, [codFornecedor]: response.data.itens }));
        } catch (err) {
          console.error('Erro ao carregar itens:', err);
        } finally {
          setItensCarregando(prev => { const s = new Set(prev); s.delete(codFornecedor); return s; });
        }
      }
    }
  };

  const handleDragStart = useCallback((colId) => { dragCol.current = colId; }, []);
  const handleDragOver = useCallback((e, colId) => { e.preventDefault(); dragOverCol.current = colId; }, []);
  const handleDrop = useCallback(() => {
    if (dragCol.current && dragOverCol.current && dragCol.current !== dragOverCol.current) {
      setColumnOrder(prev => {
        const newOrder = [...prev];
        const fromIdx = newOrder.indexOf(dragCol.current);
        const toIdx = newOrder.indexOf(dragOverCol.current);
        if (fromIdx !== -1 && toIdx !== -1) { newOrder.splice(fromIdx, 1); newOrder.splice(toIdx, 0, dragCol.current); }
        return newOrder;
      });
    }
    dragCol.current = null;
    dragOverCol.current = null;
  }, []);

  const renderCell = (colId, f, idx) => {
    const cel = f.celular || f.fone || '';
    const waUrl = formatWhatsAppUrl(cel);
    switch (colId) {
      case 'num': {
        const isExp = expandidos.has(f.codFornecedor);
        const isLoad = itensCarregando.has(f.codFornecedor);
        return isLoad ? (
          <svg className="w-4 h-4 animate-spin text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${isExp ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {isExp ? '−' : idx + 1}
          </span>
        );
      }
      case 'fantasia':
        return <span className="font-semibold text-gray-900">{f.fantasia}</span>;
      case 'razaoSocial':
        return <span className="text-gray-600 text-xs">{f.fornecedor}</span>;
      case 'cnpj':
        return <span className="text-gray-500 text-xs font-mono">{formatCnpj(f.cnpj)}</span>;
      case 'contato':
        return <span className="text-gray-600 text-xs">{f.contato || '-'}</span>;
      case 'celular':
        return cel && waUrl ? (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors whitespace-nowrap"
            title="Abrir WhatsApp">
            <span>📱</span><span className="font-medium">{cel}</span>
          </a>
        ) : <span className="text-gray-300 text-xs">-</span>;
      case 'qtdTroca':
        return <span className="font-semibold text-blue-600">{f.qtdItens}</span>;
      case 'totalCusto':
        return <span className="font-bold text-orange-600">{formatCurrency(f.totalCusto)}</span>;
      case 'totalVenda':
        return <span className="font-semibold text-gray-700">{formatCurrency(f.totalVenda)}</span>;
      default:
        return '-';
    }
  };

  const orderedColumns = columnOrder.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
  const colCount = orderedColumns.length;
  const stats = resultados?.estatisticas || {};
  const todosFornecedores = resultados?.fornecedores || [];
  const fornecedores = busca.trim()
    ? todosFornecedores.filter(f => {
        const termo = busca.trim().toLowerCase();
        return (f.fantasia || '').toLowerCase().includes(termo) || (f.fornecedor || '').toLowerCase().includes(termo);
      })
    : todosFornecedores;

  return (
    <Layout>
      <div className="p-4 lg:p-6">
        {/* Header Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">Prevenção Trocas</h1>
                <p className="text-white/80 text-sm">Análise de trocas com fornecedores - Oracle</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-right">
              <div>
                <p className="text-white/70 text-xs">Fornecedores</p>
                <p className="text-2xl font-bold">{stats.total_fornecedores || 0}</p>
              </div>
              <div className="w-px h-10 bg-white/30"></div>
              <div>
                <p className="text-white/70 text-xs">Total Custo</p>
                <p className="text-xl font-bold">{formatCurrency(stats.total_custo || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros: Abas + Busca */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-3">
          {/* Abas de tipo */}
          <div className="flex flex-wrap gap-2 mb-3">
            {FILTROS.map(f => (
              <button
                key={f.id}
                onClick={() => setTipoFiltro(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tipoFiltro === f.id
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={f.desc}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Busca */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por Razão Social ou Nome Fantasia..."
              className="w-full pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <RadarLoading size="sm" message="Carregando trocas..." />
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            <button onClick={carregarTrocas} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Tentar Novamente</button>
          </div>
        )}

        {/* Resultados */}
        {resultados && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Fornecedores', value: stats.total_fornecedores || 0, color: 'text-orange-600' },
                { label: 'Produtos', value: stats.total_produtos || 0, color: 'text-purple-600' },
                { label: 'Total Itens', value: stats.total_itens || 0, color: 'text-blue-600' },
                { label: 'Total Custo', value: formatCurrency(stats.total_custo || 0), color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                { label: 'Total Venda', value: formatCurrency(stats.total_venda || 0), color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
              ].map((card, i) => (
                <div key={i} className={`rounded-xl shadow-sm border p-4 text-center ${card.bg || 'bg-white border-gray-200'}`}>
                  <div className={`text-xl sm:text-2xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Indicador de busca */}
            {busca.trim() && (
              <div className="mb-3 text-sm text-gray-500">
                Mostrando <span className="font-bold text-orange-600">{fornecedores.length}</span> de {todosFornecedores.length} fornecedores para "<span className="font-medium">{busca}</span>"
              </div>
            )}

            {/* Dica de arraste */}
            <div className="mb-2 text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
              Arraste os cabeçalhos para reorganizar colunas
            </div>

            {/* Tabela de Fornecedores */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth: orderedColumns.reduce((s, c) => s + c.width, 0) }}>
                  <colgroup>
                    {orderedColumns.map(col => (
                      <col key={col.id} style={{ width: col.width, minWidth: col.width }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                      {orderedColumns.map((col) => (
                        <th key={col.id} draggable
                          onDragStart={() => handleDragStart(col.id)}
                          onDragOver={(e) => handleDragOver(e, col.id)}
                          onDrop={handleDrop}
                          className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap select-none border-r border-orange-400/30 last:border-r-0 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                          style={{ cursor: 'grab' }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3 opacity-40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                            </svg>
                            {col.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedores.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="px-4 py-12 text-center text-gray-400">
                          {busca.trim() ? 'Nenhum fornecedor encontrado para a busca' : 'Nenhuma troca encontrada'}
                        </td>
                      </tr>
                    ) : fornecedores.map((f, idx) => {
                      const isExpanded = expandidos.has(f.codFornecedor);
                      const isCarregando = itensCarregando.has(f.codFornecedor);
                      const itens = itensPorFornecedor[f.codFornecedor] || [];
                      const pct = (stats.total_custo || 0) > 0 ? ((f.totalCusto / stats.total_custo) * 100) : 0;

                      return [
                        <tr key={`row-${f.codFornecedor}`}
                          onClick={() => toggleFornecedor(f.codFornecedor)}
                          className={`cursor-pointer transition-colors border-b border-gray-100 ${
                            isExpanded ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white hover:bg-orange-50/50' : 'bg-gray-50/30 hover:bg-orange-50/50'
                          }`}
                        >
                          {orderedColumns.map((col) => (
                            <td key={col.id} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                              {renderCell(col.id, f, idx)}
                            </td>
                          ))}
                        </tr>,

                        <tr key={`bar-${f.codFornecedor}`} className="h-0.5">
                          <td colSpan={colCount} className="p-0 bg-gray-100">
                            <div className="h-0.5 bg-orange-400" style={{ width: `${pct}%` }} />
                          </td>
                        </tr>,

                        isExpanded && (
                          <tr key={`detail-${f.codFornecedor}`}>
                            <td colSpan={colCount} className="p-0 border-b-2 border-orange-200">
                              <div className="bg-orange-50/30">
                                {isCarregando ? (
                                  <div className="p-6 text-center"><RadarLoading size="sm" message="Carregando itens..." /></div>
                                ) : itens.length === 0 ? (
                                  <div className="p-4 text-center text-gray-400 text-sm">Nenhum item encontrado</div>
                                ) : (
                                  <div className="p-3">
                                    <div className="overflow-x-auto rounded-lg border border-orange-200">
                                      <table className="w-full text-xs border-collapse">
                                        <thead className="bg-orange-100/80">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Cód. Barras</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Produto</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Seção</th>
                                            <th className="px-3 py-2 text-center font-medium text-orange-800">Curva</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Qtd</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Custo Unit.</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Pç. Venda</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Margem</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Vd Média</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Valor Total</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Data</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-orange-100 bg-white">
                                          {itens.map((item, i) => (
                                            <tr key={i} className="hover:bg-orange-50/50">
                                              <td className="px-3 py-1.5 text-gray-500 font-mono">{item.codigoBarras}</td>
                                              <td className="px-3 py-1.5 font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                                              <td className="px-3 py-1.5 text-gray-500">{item.secao}</td>
                                              <td className="px-3 py-1.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                                                  item.curva === 'A' ? 'bg-green-100 text-green-700' :
                                                  item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                                  item.curva === 'C' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-gray-100 text-gray-500'
                                                }`}>{item.curva || 'X'}</span>
                                              </td>
                                              <td className={`px-3 py-1.5 text-right font-semibold ${item.quantidade < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {Math.abs(item.quantidade).toFixed(3)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(item.custoReposicao)}</td>
                                              <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(item.precoVenda)}</td>
                                              <td className={`px-3 py-1.5 text-right font-semibold ${(item.margem || 0) >= 30 ? 'text-green-600' : (item.margem || 0) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {(item.margem || 0).toFixed(1)}%
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-blue-600 font-medium">
                                                {(item.vdMedia || 0).toFixed(3)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-bold text-orange-600">
                                                {formatCurrency(Math.abs(item.valorTotal))}
                                              </td>
                                              <td className="px-3 py-1.5 text-gray-500">
                                                {item.dataAjuste ? new Date(item.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-orange-100/60 border-t border-orange-200 font-semibold">
                                          <tr>
                                            <td colSpan={4} className="px-3 py-2 text-orange-800">{itens.length} itens</td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                              {itens.reduce((s, it) => s + Math.abs(it.quantidade || 0), 0).toFixed(3)}
                                            </td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2 text-right text-orange-700">
                                              {formatCurrency(itens.reduce((s, it) => s + Math.abs(it.valorTotal || 0), 0))}
                                            </td>
                                            <td className="px-3 py-2"></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total rodapé */}
              {fornecedores.length > 0 && (
                <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">{fornecedores.length} fornecedor(es)</span>
                  <span className="font-bold text-orange-700">Total Custo: {formatCurrency(
                    busca.trim()
                      ? fornecedores.reduce((s, f) => s + (f.totalCusto || 0), 0)
                      : stats.total_custo || 0
                  )}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
