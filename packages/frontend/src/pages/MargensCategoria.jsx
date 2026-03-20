import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function MargensCategoria() {
  const { user, logout } = useAuth();
  const { lojas, lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Filtros cascata
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [segmentos, setSegmentos] = useState([]);
  const [codSecao, setCodSecao] = useState('');
  const [codGrupo, setCodGrupo] = useState('');
  const [codSubGrupo, setCodSubGrupo] = useState('');
  const [codSegmento, setCodSegmento] = useState('');

  // Busca e ordenacao
  const [busca, setBusca] = useState('');
  const [sortCol, setSortCol] = useState('DESCRICAO');
  const [sortDir, setSortDir] = useState('asc');

  // Carregar secoes
  useEffect(() => {
    api.get('/margens-categoria/secoes').then(r => setSecoes(r.data || [])).catch(() => {});
  }, []);

  // Carregar grupos quando secao muda
  useEffect(() => {
    if (codSecao) {
      api.get(`/margens-categoria/grupos?codSecao=${codSecao}`).then(r => setGrupos(r.data || [])).catch(() => {});
    } else {
      setGrupos([]);
    }
    setCodGrupo('');
    setCodSubGrupo('');
    setCodSegmento('');
    setSubgrupos([]);
    setSegmentos([]);
  }, [codSecao]);

  // Carregar subgrupos quando grupo muda
  useEffect(() => {
    if (codSecao && codGrupo) {
      api.get(`/margens-categoria/subgrupos?codSecao=${codSecao}&codGrupo=${codGrupo}`)
        .then(r => setSubgrupos(r.data || [])).catch(() => {});
    } else {
      setSubgrupos([]);
    }
    setCodSubGrupo('');
    setCodSegmento('');
    setSegmentos([]);
  }, [codGrupo]);

  // Carregar segmentos quando subgrupo muda
  useEffect(() => {
    if (codSecao) {
      const params = new URLSearchParams({ codSecao });
      if (codGrupo) params.append('codGrupo', codGrupo);
      if (codSubGrupo) params.append('codSubGrupo', codSubGrupo);
      api.get(`/margens-categoria/segmentos?${params}`).then(r => setSegmentos(r.data || [])).catch(() => {});
    } else {
      setSegmentos([]);
    }
    setCodSegmento('');
  }, [codSubGrupo, codSecao, codGrupo]);

  // Buscar produtos
  const handleBuscar = async () => {
    const codLoja = lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : null);
    if (!codLoja) { toast.error('Selecione uma loja'); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({ codLoja: String(codLoja) });
      if (codSecao) params.append('codSecao', codSecao);
      if (codGrupo) params.append('codGrupo', codGrupo);
      if (codSubGrupo) params.append('codSubGrupo', codSubGrupo);
      if (codSegmento) params.append('codSegmento', codSegmento);

      const res = await api.get(`/margens-categoria/produtos?${params}`);
      setData(res.data || []);
      if ((res.data || []).length === 0) toast('Nenhum produto encontrado', { icon: 'i' });
      else toast.success(`${res.data.length} produtos carregados`);
    } catch (err) {
      toast.error('Erro ao buscar produtos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Ordenacao
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // Filtro e ordenacao dos dados
  const filtrados = useMemo(() => {
    let arr = [...data];
    if (busca) {
      const s = busca.toLowerCase();
      arr = arr.filter(r =>
        (r.DESCRICAO || '').toLowerCase().includes(s) ||
        String(r.COD_PRODUTO || '').includes(s) ||
        (r.COD_BARRAS || '').includes(s)
      );
    }
    arr.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [data, busca, sortCol, sortDir]);

  const fmt = (v, dec = 2) => {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const fmtCur = (v) => v == null || isNaN(v) ? '-' : `R$ ${fmt(v)}`;
  const fmtInt = (v) => v == null || isNaN(v) ? '-' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const fmtDate = (v) => {
    if (!v) return '-';
    try {
      const d = new Date(v);
      return d.toLocaleDateString('pt-BR');
    } catch { return '-'; }
  };

  // Cor da relevancia
  const relBadge = (rel) => {
    if (rel === 'N') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">N</span>;
    if (rel === 'SP') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">SP</span>;
    if (rel === 'R') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">R</span>;
    return <span className="text-gray-400 text-xs">-</span>;
  };

  // Cor da curva ABC
  const curvaBadge = (curva) => {
    const c = (curva || '').toUpperCase().trim();
    if (c === 'A') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">A</span>;
    if (c === 'B') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">B</span>;
    if (c === 'C') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">C</span>;
    if (c === 'D') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">D</span>;
    return <span className="text-gray-400 text-xs">{curva || '-'}</span>;
  };

  // Cor dias sem venda
  const diasSemVendaColor = (d) => {
    if (d == null || isNaN(d)) return 'text-gray-500';
    if (d <= 7) return 'text-green-600 font-semibold';
    if (d <= 30) return 'text-yellow-600 font-semibold';
    if (d <= 90) return 'text-orange-600 font-semibold';
    return 'text-red-600 font-bold';
  };

  // Cor cobertura
  const coberturaColor = (d) => {
    if (d == null || isNaN(d)) return 'text-gray-500';
    if (d >= 30) return 'text-green-600 font-semibold';
    if (d >= 15) return 'text-yellow-600 font-semibold';
    if (d >= 7) return 'text-orange-600 font-semibold';
    return 'text-red-600 font-bold';
  };

  // Componente header
  const Th = ({ col, label, align = 'left', bg = '' }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-3 py-2.5 text-${align} text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap border-b-2 border-gray-200 select-none ${bg} ${sortCol === col ? 'text-orange-600' : 'text-gray-600'}`}
    >
      {label}
      <span className="ml-1 text-[10px]">
        {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Margens por Categoria</h1>
          <div className="w-10" />
        </div>

        {/* Header Laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-white">MARGENS POR CATEGORIA</h1>
                <div className="relative"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}>
                  <svg className="h-5 w-5 text-white/80 hover:text-white cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showTooltip && (
                    <div className="absolute left-0 top-8 z-50 w-[90vw] max-w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 p-5 text-gray-700 text-sm leading-relaxed"
                      style={{ pointerEvents: 'none' }}>
                      <h3 className="font-bold text-orange-600 text-base mb-2">Margens por Categoria</h3>
                      <p className="mb-2">
                        Visao detalhada dos produtos por categoria mercadologica, com indicadores de estoque, vendas e cobertura.
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
                        <li><strong>Relevancia:</strong> N = Notavel, SP = Sensivel a Preco, R = Regular</li>
                        <li><strong>Curva ABC:</strong> Classificacao por importancia de venda</li>
                        <li><strong>Cobertura:</strong> Dias de estoque disponiveis</li>
                        <li><strong>Dias s/ Venda:</strong> Tempo desde a ultima venda</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-orange-100 text-sm">Indicadores de estoque, vendas e cobertura por classificacao mercadologica</p>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-3">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Secao</label>
                <select value={codSecao} onChange={e => setCodSecao(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">Todas</option>
                  {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.DES_SECAO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Grupo</label>
                <select value={codGrupo} onChange={e => setCodGrupo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" disabled={!codSecao}>
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.DES_GRUPO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">SubGrupo</label>
                <select value={codSubGrupo} onChange={e => setCodSubGrupo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" disabled={!codGrupo}>
                  <option value="">Todos</option>
                  {subgrupos.map(sg => <option key={sg.COD_SUB_GRUPO} value={sg.COD_SUB_GRUPO}>{sg.DES_SUB_GRUPO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Segmento</label>
                <select value={codSegmento} onChange={e => setCodSegmento(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" disabled={!codSecao}>
                  <option value="">Todos</option>
                  {segmentos.map(sg => <option key={sg.COD_SEGMENTO} value={sg.COD_SEGMENTO}>{sg.DES_SEGMENTO}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleBuscar} disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg px-4 py-1.5 text-sm font-bold hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 transition-all shadow-md flex items-center justify-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Buscando...</>
                  ) : (
                    <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Buscar</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && <RadarLoading message="Carregando produtos..." />}

          {/* Tabela */}
          {data.length > 0 && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Busca + contador */}
              <div className="p-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar por codigo, descricao ou EAN..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <span className="text-xs text-gray-500">{filtrados.length} de {data.length} produtos</span>
              </div>

              <div className="overflow-x-auto" style={{ maxHeight: '65vh' }}>
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <Th col="COD_PRODUTO" label="Codigo" />
                      <Th col="DESCRICAO" label="Produto" />
                      <Th col="COD_BARRAS" label="Cod. Barras" />
                      <Th col="RELEVANCIA" label="Relev." align="center" />
                      <Th col="CURVA" label="Curva" align="center" />
                      <Th col="PRECO_VENDA" label="Preco Venda" align="right" bg="bg-blue-50" />
                      <Th col="PRECO_CUSTO" label="Preco Custo" align="right" bg="bg-blue-50" />
                      <Th col="MARGEM" label="Margem %" align="right" bg="bg-emerald-50" />
                      <Th col="VENDA_MEDIA_DIA" label="Venda Media/Dia" align="right" bg="bg-orange-50" />
                      <Th col="VENDA_MEDIA_MES" label="Venda Media/Mes" align="right" bg="bg-orange-50" />
                      <Th col="ESTOQUE_ATUAL" label="Estoque Atual" align="right" />
                      <Th col="COBERTURA" label="Dias Cobertura" align="right" />
                      <Th col="DIAS_SEM_VENDA" label="Dias s/ Venda" align="right" />
                      <Th col="DATA_ULTIMA_COMPRA" label="Ult. Compra" align="center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrados.map((row, idx) => (
                      <tr key={`${row.COD_PRODUTO}-${idx}`} className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-2 text-gray-700 font-mono text-xs">{row.COD_PRODUTO}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-xs truncate text-xs font-medium" title={row.DESCRICAO}>{row.DESCRICAO}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">{row.COD_BARRAS || '-'}</td>
                        <td className="px-3 py-2 text-center">{relBadge(row.RELEVANCIA)}</td>
                        <td className="px-3 py-2 text-center">{curvaBadge(row.CURVA)}</td>
                        <td className="px-3 py-2 text-right text-xs bg-blue-50/30">{fmtCur(row.PRECO_VENDA)}</td>
                        <td className="px-3 py-2 text-right text-xs bg-blue-50/30">{fmtCur(row.PRECO_CUSTO)}</td>
                        <td className={`px-3 py-2 text-right text-xs font-semibold bg-emerald-50/30 ${(row.MARGEM || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(row.MARGEM)}%
                        </td>
                        <td className="px-3 py-2 text-right text-xs bg-orange-50/30">{fmtCur(row.VENDA_MEDIA_DIA)}</td>
                        <td className="px-3 py-2 text-right text-xs bg-orange-50/30">{fmtCur(row.VENDA_MEDIA_MES)}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium">{fmtInt(row.ESTOQUE_ATUAL)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${coberturaColor(row.COBERTURA)}`}>{fmtInt(row.COBERTURA)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${diasSemVendaColor(row.DIAS_SEM_VENDA)}`}>{fmtInt(row.DIAS_SEM_VENDA)}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-600">{fmtDate(row.DATA_ULTIMA_COMPRA)}</td>
                      </tr>
                    ))}
                    {filtrados.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                          Nenhum produto encontrado com os filtros aplicados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg font-medium">Selecione os filtros e clique em Buscar</p>
              <p className="text-sm mt-1">Use os filtros de secao, grupo, subgrupo e segmento para refinar a busca</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
