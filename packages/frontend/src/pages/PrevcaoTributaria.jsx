import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

const STATUS_CONFIG = {
  OK:      { label: 'OK',      bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  ATENCAO: { label: 'ATENÇÃO', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  ALERTA:  { label: 'ALERTA',  bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

export default function PrevcaoTributaria() {
  const { lojaSelecionada } = useLoja();

  // Filtros de classificação mercadológica
  const [secoes,    setSecoes]    = useState([]);
  const [grupos,    setGrupos]    = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [segmentos, setSegmentos] = useState([]);

  const [codSecao,    setCodSecao]    = useState('');
  const [codGrupo,    setCodGrupo]    = useState('');
  const [codSubGrupo, setCodSubGrupo] = useState('');
  const [codSegmento, setCodSegmento] = useState('');
  const [statusFilter, setStatusFilter] = useState('DIVERGENTES');
  const [cardFilter, setCardFilter] = useState(null); // filtro local pelos cards

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [busca,   setBusca]   = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // ─── Carregar seções ────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/compra-venda/secoes').then(r => setSecoes(r.data || [])).catch(() => {});
  }, []);

  // ─── Cascata Grupo ──────────────────────────────────────────────────────────
  useEffect(() => {
    setGrupos([]); setCodGrupo('');
    setSubgrupos([]); setCodSubGrupo('');
    setSegmentos([]); setCodSegmento('');
    if (!codSecao) return;
    api.get(`/compra-venda/grupos?codSecao=${codSecao}`).then(r => setGrupos(r.data || [])).catch(() => {});
  }, [codSecao]);

  // ─── Cascata Subgrupo ───────────────────────────────────────────────────────
  useEffect(() => {
    setSubgrupos([]); setCodSubGrupo('');
    setSegmentos([]); setCodSegmento('');
    if (!codSecao || !codGrupo) return;
    api.get(`/compra-venda/subgrupos?codSecao=${codSecao}&codGrupo=${codGrupo}`).then(r => setSubgrupos(r.data || [])).catch(() => {});
  }, [codGrupo]);

  // ─── Cascata Segmento ───────────────────────────────────────────────────────
  useEffect(() => {
    setSegmentos([]); setCodSegmento('');
    if (!codSubGrupo) return;
    api.get(`/gestao-inteligente/segmentos?codSecao=${codSecao}&codGrupo=${codGrupo}&codSubgrupo=${codSubGrupo}`)
      .then(r => setSegmentos(r.data || []))
      .catch(() => {});
  }, [codSubGrupo]);

  // ─── Buscar dados ────────────────────────────────────────────────────────────
  const buscarDados = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ statusFilter });
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      if (codSecao)    params.append('codSecao',    codSecao);
      if (codGrupo)    params.append('codGrupo',    codGrupo);
      if (codSubGrupo) params.append('codSubGrupo', codSubGrupo);
      if (codSegmento) params.append('codSegmento', codSegmento);

      const res = await api.get(`/tributacao/produtos?${params}`);
      setData(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { buscarDados(); }, [lojaSelecionada, codSecao, codGrupo, codSubGrupo, codSegmento, statusFilter]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ─── Filtro por busca + card + ordenação ─────────────────────────────────────
  const filtrados = useMemo(() => {
    let list = data;
    if (cardFilter) list = list.filter(i => i.status === cardFilter);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(i =>
        i.des_produto?.toLowerCase().includes(q) ||
        i.cod_produto?.toLowerCase().includes(q) ||
        i.ncm?.toLowerCase().includes(q)
      );
    }
    if (sortCol) {
      list = [...list].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const cmp = typeof av === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [data, busca, cardFilter, sortCol, sortDir]);

  // ─── Contadores (sempre do total, não do filtrado) ──────────────────────────
  const counts = useMemo(() => ({
    total:   data.length,
    ok:      data.filter(i => i.status === 'OK').length,
    atencao: data.filter(i => i.status === 'ATENCAO').length,
    alerta:  data.filter(i => i.status === 'ALERTA').length,
  }), [data]);

  const fmt = (v, dec = 2) => (v == null ? '—' : Number(v).toFixed(dec) + '%');

  // Cor por alíquota ICMS
  const icmsColor = (v) => {
    const n = parseFloat(v) || 0;
    if (n === 0)                    return 'text-green-600 font-bold';
    if (n > 0   && n <= 2)          return 'text-green-500 font-bold';
    if (n > 2   && n <= 5)          return 'text-orange-500 font-bold';
    if (n > 5   && n <= 8)          return 'text-purple-600 font-bold';
    if (n > 8   && n <= 13)         return 'text-blue-500 font-bold';
    if (n > 13  && n <= 19)         return 'text-blue-700 font-bold';
    if (n > 19)                     return 'text-red-600 font-bold';
    return 'text-gray-700 font-bold';
  };

  const Th = ({ col, label, sub, className = '', center = false }) => {
    const active = sortCol === col;
    return (
      <th
        onClick={() => col && handleSort(col)}
        className={`px-3 py-2 font-semibold text-gray-600 select-none ${col ? 'cursor-pointer hover:bg-gray-100' : ''} ${center ? 'text-center' : 'text-left'} ${className}`}
      >
        <div className="flex items-center gap-1 justify-center whitespace-nowrap">
          <span>{label}</span>
          {col && (
            <span className={`text-[10px] ${active ? 'text-orange-500' : 'text-gray-300'}`}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </div>
        {sub && <div className="text-gray-400 font-normal text-xs">{sub}</div>}
      </th>
    );
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">

        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Prevenção Tributária</h1>
            <p className="text-sm text-gray-500">
              Identifica produtos com divergência entre alíquota de entrada e saída de ICMS, PIS e COFINS
            </p>
          </div>
        </div>

        {/* ── Cards de resumo (clicáveis como filtros) ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total',   value: counts.total,   key: null,       color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-200',   ring: 'ring-gray-400'   },
            { label: 'OK',      value: counts.ok,      key: 'OK',       color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  ring: 'ring-green-500'  },
            { label: 'Atenção', value: counts.atencao, key: 'ATENCAO',  color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-300', ring: 'ring-yellow-500' },
            { label: 'Alerta',  value: counts.alerta,  key: 'ALERTA',   color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    ring: 'ring-red-500'    },
          ].map(c => {
            const isActive = cardFilter === c.key;
            return (
              <button
                key={c.label}
                onClick={() => setCardFilter(isActive ? null : c.key)}
                className={`${c.bg} ${c.border} border rounded-lg p-4 text-center transition-all cursor-pointer hover:shadow-md
                  ${isActive ? `ring-2 ${c.ring} shadow-md` : 'hover:brightness-95'}`}
              >
                <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
                <div className={`text-sm font-medium mt-1 ${c.color}`}>{c.label}</div>
                {isActive && <div className="text-[10px] text-gray-400 mt-0.5">clique para limpar</div>}
              </button>
            );
          })}
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

            {/* Seção */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seção</label>
              <select value={codSecao} onChange={e => setCodSecao(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400">
                <option value="">Todas</option>
                {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.DES_SECAO}</option>)}
              </select>
            </div>

            {/* Grupo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grupo</label>
              <select value={codGrupo} onChange={e => setCodGrupo(e.target.value)} disabled={!codSecao}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400 disabled:opacity-50">
                <option value="">Todos</option>
                {grupos.map(g => <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.DES_GRUPO}</option>)}
              </select>
            </div>

            {/* Subgrupo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subgrupo</label>
              <select value={codSubGrupo} onChange={e => setCodSubGrupo(e.target.value)} disabled={!codGrupo}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400 disabled:opacity-50">
                <option value="">Todos</option>
                {subgrupos.map(s => <option key={s.COD_SUB_GRUPO} value={s.COD_SUB_GRUPO}>{s.DES_SUB_GRUPO}</option>)}
              </select>
            </div>

            {/* Segmento */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Segmento</label>
              <select value={codSegmento} onChange={e => setCodSegmento(e.target.value)} disabled={!codSubGrupo}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400 disabled:opacity-50">
                <option value="">Todos</option>
                {segmentos.map(s => <option key={s.COD_SEGMENTO || s.cod_segmento} value={s.COD_SEGMENTO || s.cod_segmento}>{s.DES_SEGMENTO || s.des_segmento}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400">
                <option value="DIVERGENTES">Apenas Divergentes</option>
                <option value="TODOS">Todos</option>
                <option value="OK">Somente OK</option>
                <option value="ATENCAO">Somente Atenção</option>
                <option value="ALERTA">Somente Alerta</option>
              </select>
            </div>

            {/* Busca */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Buscar produto</label>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Código, nome ou NCM..."
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>
        </div>

        {/* ── Tabela ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><RadarLoading /></div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <Th col="des_produto"        label="Produto"     className="min-w-[220px]" />
                    <Th col="ncm"                label="NCM"         center />
                    <Th col="des_sub_grupo"      label="Subgrupo"    />
                    <Th col="per_icms_entrada"   label="ICMS"        sub="Entrada"   center className="bg-blue-50 border-l border-blue-100" />
                    <Th col="per_icms_saida"     label="ICMS"        sub="Saída"     center className="bg-orange-50 border-l border-orange-100" />
                    <Th col="per_aliq_outorg"    label="Alíq."       sub="Outorgada" center className="bg-purple-50 border-l border-purple-100" />
                    <Th col="per_reducao_bc"     label="Red. BC"     sub="%"         center className="bg-purple-50" />
                    <Th col="per_pis_entrada"    label="PIS"         sub="Ent / Saí" center className="bg-blue-50 border-l border-blue-100" />
                    <Th col="per_cofins_entrada" label="COFINS"      sub="Ent / Saí" center className="bg-blue-50" />
                    <Th col="cst_pis_cof_entrada" label="CST PIS/COF" sub="Ent / Saí" center className="bg-blue-50" />
                    <Th col="markdown_pct"       label="Markdown"    sub="%"         center className="bg-emerald-50 border-l border-emerald-100" />
                    <Th col="mg_liquida_pct"     label="Mg. Líquida" sub="%"         center className="bg-emerald-50" />
                    <Th col="status"             label="Status"      center className="min-w-[90px]" />
                    <Th col={null}               label="Motivo"      className="min-w-[240px]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-gray-400 text-sm">
                        {loading ? '' : 'Nenhum produto encontrado com os filtros selecionados'}
                      </td>
                    </tr>
                  )}
                  {filtrados.map((item, idx) => {
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.OK;
                    const icmsDiv = item.per_icms_entrada !== item.per_icms_saida;
                    const pisDiv  = item.per_pis_entrada  !== item.per_pis_saida;
                    const cofDiv  = item.per_cofins_entrada !== item.per_cofins_saida;

                    return (
                      <tr key={idx} className={`hover:bg-gray-50 ${item.status === 'ALERTA' ? 'bg-red-50/30' : item.status === 'ATENCAO' ? 'bg-yellow-50/20' : ''}`}>
                        {/* Produto */}
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800 truncate max-w-[240px]" title={item.des_produto}>
                            {item.des_produto}
                          </div>
                          <div className="text-gray-400 text-xs">{item.cod_produto}</div>
                        </td>
                        {/* NCM */}
                        <td className="px-3 py-2 text-gray-600 font-mono text-sm">{item.ncm || '—'}</td>
                        {/* Subgrupo */}
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-[140px] truncate" title={`${item.des_secao} › ${item.des_grupo} › ${item.des_sub_grupo}`}>
                          {item.des_sub_grupo || '—'}
                        </td>
                        {/* ICMS Entrada */}
                        <td className="px-3 py-2 text-center bg-blue-50/40 border-l border-blue-100 font-mono text-sm">
                          <span className={icmsColor(item.per_icms_entrada)}>
                            {fmt(item.per_icms_entrada)}
                          </span>
                        </td>
                        {/* ICMS Saída */}
                        <td className="px-3 py-2 text-center bg-orange-50/40 border-l border-orange-100 font-mono text-sm">
                          <span className={`${icmsColor(item.per_icms_saida)} ${icmsDiv ? 'underline decoration-dotted' : ''}`}>
                            {fmt(item.per_icms_saida)}
                          </span>
                        </td>
                        {/* Alíq Outorgada */}
                        <td className="px-3 py-2 text-center bg-purple-50/40 border-l border-purple-100 font-mono text-sm text-purple-700">
                          {item.per_aliq_outorg > 0 ? fmt(item.per_aliq_outorg) : '—'}
                        </td>
                        {/* Redução BC */}
                        <td className="px-3 py-2 text-center bg-purple-50/40 font-mono text-sm font-semibold text-purple-700">
                          {item.per_reducao_bc > 0 ? fmt(item.per_reducao_bc) : '—'}
                        </td>
                        {/* PIS Ent / Saí */}
                        <td className={`px-3 py-2 text-center bg-blue-50/40 border-l border-blue-100 font-mono text-xs ${pisDiv ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
                          {fmt(item.per_pis_entrada)} / {fmt(item.per_pis_saida)}
                        </td>
                        {/* COFINS Ent / Saí */}
                        <td className={`px-3 py-2 text-center bg-blue-50/40 font-mono text-xs ${cofDiv ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
                          {fmt(item.per_cofins_entrada)} / {fmt(item.per_cofins_saida)}
                        </td>
                        {/* CST PIS/COF */}
                        <td className="px-3 py-2 text-center bg-blue-50/40 font-mono text-xs text-gray-500">
                          <span className={item.cst_pis_cof_entrada !== item.cst_pis_cof_saida ? 'text-orange-600 font-semibold' : ''}>
                            {item.cst_pis_cof_entrada || '—'} / {item.cst_pis_cof_saida || '—'}
                          </span>
                        </td>
                        {/* Markdown % */}
                        <td className={`px-3 py-2 text-center bg-emerald-50/40 border-l border-emerald-100 font-mono text-sm font-semibold
                          ${item.markdown_pct > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {item.markdown_pct > 0 ? fmt(item.markdown_pct) : '—'}
                        </td>
                        {/* Margem Líquida % */}
                        <td className={`px-3 py-2 text-center bg-emerald-50/40 font-mono text-sm font-semibold
                          ${item.mg_liquida_pct > 20 ? 'text-emerald-700' : item.mg_liquida_pct > 5 ? 'text-emerald-600' : item.mg_liquida_pct > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {item.val_venda > 0 ? fmt(item.mg_liquida_pct) : '—'}
                        </td>
                        {/* Status */}
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>
                        {/* Motivo */}
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-[280px]">
                          {item.motivo || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtrados.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-sm text-gray-500">
                {filtrados.length} produto{filtrados.length !== 1 ? 's' : ''} exibido{filtrados.length !== 1 ? 's' : ''}
                {counts.alerta > 0 && (
                  <span className="ml-3 text-red-600 font-semibold">
                    ⚠ {counts.alerta} alerta{counts.alerta !== 1 ? 's' : ''} de tributação
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
