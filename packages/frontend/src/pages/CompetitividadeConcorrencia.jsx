import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import api from '../utils/api';

const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPct = (v) => `${(v || 0).toFixed(2)}%`;
const formatDate = (d) => {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const RELEVANCIA_OPTIONS = [
  { key: '', label: 'Todos', emoji: '📋' },
  { key: 'N', label: 'Notaveis', emoji: '⭐' },
  { key: 'SP', label: 'Sensivel a Preco', emoji: '💰' },
  { key: 'R', label: 'Restante', emoji: '📦' },
];

export default function CompetitividadeConcorrencia() {
  const { user, logout } = useAuth();
  const { lojaSelecionada, lojas } = useLoja();
  const codLoja = lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [concorrentes, setConcorrentes] = useState([]);
  const [secoes, setSecoes] = useState([]);

  // Filtros
  const [codSecao, setCodSecao] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'DIFERENCA_RS', direction: 'desc' });
  const [relevanciaFilter, setRelevanciaFilter] = useState('');

  // Navegacao entre concorrentes
  const [concIdx, setConcIdx] = useState(0);

  // Filtro por card clicado
  const [cardFilter, setCardFilter] = useState(null);

  // Carregar secoes
  useEffect(() => {
    if (!codLoja) return;
    api.get(`/competitividade/secoes?codLoja=${codLoja}`).then(r => setSecoes(r.data || [])).catch(() => {});
  }, [codLoja]);

  // Buscar dados
  const fetchData = async () => {
    if (!codLoja) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('codLoja', String(codLoja));
      if (codSecao) params.append('codSecao', codSecao);
      const r = await api.get(`/competitividade/dados?${params.toString()}`);
      setData(r.data.rows || []);
      setConcorrentes(r.data.concorrentes || []);
      setConcIdx(0);
      setCardFilter(null);
    } catch (err) {
      toast.error('Erro ao buscar dados: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [codLoja]);

  // Concorrente atual
  const concAtual = concorrentes[concIdx] || null;

  // Dados filtrados pelo concorrente atual + relevancia
  const dadosConc = useMemo(() => {
    let result = data;
    if (concAtual) result = result.filter(r => r.CONC_NOME === concAtual);
    if (relevanciaFilter) result = result.filter(r => r.RELEVANCIA === relevanciaFilter);
    return result;
  }, [data, concAtual, relevanciaFilter]);

  // Resumo do concorrente atual
  const resumo = useMemo(() => {
    const items = dadosConc;
    const baratos = items.filter(r => r.PRECO_VENDA < r.CONC_PRECO);
    const caros = items.filter(r => r.PRECO_VENDA > r.CONC_PRECO);
    const iguais = items.filter(r => r.PRECO_VENDA === r.CONC_PRECO);
    const totalNosso = items.reduce((s, r) => s + r.PRECO_VENDA, 0);
    const totalConc = items.reduce((s, r) => s + r.CONC_PRECO, 0);
    const diferenca = totalNosso - totalConc;
    return { baratos: baratos.length, caros: caros.length, iguais: iguais.length, total: items.length, totalNosso, totalConc, diferenca };
  }, [dadosConc]);

  // Dados filtrados por card clicado + texto
  const filteredData = useMemo(() => {
    let result = dadosConc;
    if (cardFilter === 'baratos') result = result.filter(r => r.PRECO_VENDA < r.CONC_PRECO);
    else if (cardFilter === 'caros') result = result.filter(r => r.PRECO_VENDA > r.CONC_PRECO);
    else if (cardFilter === 'iguais') result = result.filter(r => r.PRECO_VENDA === r.CONC_PRECO);

    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(r => r.DESCRICAO?.toLowerCase().includes(s) || r.COD_PRODUTO?.includes(s) || r.COD_BARRAS?.includes(s));
    }
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const va = a[sortConfig.key] ?? 0;
        const vb = b[sortConfig.key] ?? 0;
        if (typeof va === 'string') return sortConfig.direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortConfig.direction === 'asc' ? va - vb : vb - va;
      });
    }
    return result;
  }, [dadosConc, cardFilter, searchText, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const prevConc = () => { setConcIdx(i => (i - 1 + concorrentes.length) % concorrentes.length); setCardFilter(null); };
  const nextConc = () => { setConcIdx(i => (i + 1) % concorrentes.length); setCardFilter(null); };

  const toggleCardFilter = (type) => {
    setCardFilter(prev => prev === type ? null : type);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} onCloseMobileMenu={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 overflow-auto">
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Competitividade</h1>
          <div></div>
        </div>

      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🏆</span>
              <div>
                <h1 className="text-2xl font-bold text-white">COMPETITIVIDADE E CONCORRENCIA</h1>
                <p className="text-orange-100">Compare seus precos com os concorrentes e identifique oportunidades</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">📂 Secao</label>
              <select value={codSecao} onChange={e => setCodSecao(e.target.value)}
                className="border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                <option value="">Todas</option>
                {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.DES_SECAO}</option>)}
              </select>
            </div>
            <button onClick={fetchData} disabled={loading}
              className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all disabled:opacity-50">
              {loading ? '⏳ Buscando...' : '🔍 Pesquisar'}
            </button>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-500 block mb-1">🔎 Buscar produto</label>
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Nome, codigo ou EAN..."
                className="border rounded-lg px-4 py-2.5 text-sm w-full max-w-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
            </div>
            <span className="text-sm text-gray-500 self-center font-medium">{filteredData.length} de {dadosConc.length} produtos</span>
          </div>

          {/* Filtro Relevancia */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-500">🎯 Relevancia:</span>
            {RELEVANCIA_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setRelevanciaFilter(opt.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  relevanciaFilter === opt.key
                    ? opt.key === 'N' ? 'bg-purple-600 text-white shadow-md'
                    : opt.key === 'SP' ? 'bg-amber-500 text-white shadow-md'
                    : opt.key === 'R' ? 'bg-gray-500 text-white shadow-md'
                    : 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Painel do Concorrente */}
        {data.length > 0 && concAtual && (
          <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
            {/* Header do concorrente com setas */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-5 flex items-center justify-between">
              <button onClick={prevConc} className="p-3 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white" title="Concorrente anterior">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl">🏪</span>
                  <h2 className="text-2xl font-bold text-white">{concAtual}</h2>
                </div>
                <p className="text-orange-100 text-sm mt-1">
                  Concorrente {concIdx + 1} de {concorrentes.length} — {resumo.total} produtos pesquisados
                </p>
              </div>
              <button onClick={nextConc} className="p-3 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white" title="Proximo concorrente">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* Cards resumo */}
            <div className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Mais Baratos */}
                <button onClick={() => toggleCardFilter('baratos')}
                  className={`rounded-xl border-2 p-5 text-left transition-all hover:shadow-lg ${cardFilter === 'baratos' ? 'border-green-500 bg-green-50 ring-2 ring-green-300' : 'border-gray-200 bg-white hover:border-green-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">😊</span>
                    <span className="text-4xl font-bold text-green-600">{resumo.baratos}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-2">Mais Baratos</p>
                  <p className="text-xs text-green-600">Nosso preco menor</p>
                </button>

                {/* Mais Caros */}
                <button onClick={() => toggleCardFilter('caros')}
                  className={`rounded-xl border-2 p-5 text-left transition-all hover:shadow-lg ${cardFilter === 'caros' ? 'border-red-500 bg-red-50 ring-2 ring-red-300' : 'border-gray-200 bg-white hover:border-red-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">😟</span>
                    <span className="text-4xl font-bold text-red-600">{resumo.caros}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-2">Mais Caros</p>
                  <p className="text-xs text-red-600">Nosso preco maior</p>
                </button>

                {/* Preco Igual */}
                <button onClick={() => toggleCardFilter('iguais')}
                  className={`rounded-xl border-2 p-5 text-left transition-all hover:shadow-lg ${cardFilter === 'iguais' ? 'border-gray-500 bg-gray-50 ring-2 ring-gray-300' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🤝</span>
                    <span className="text-4xl font-bold text-gray-600">{resumo.iguais}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-2">Preco Igual</p>
                  <p className="text-xs text-gray-500">Mesmo preco</p>
                </button>

                {/* Nosso Total vs Concorrente */}
                <div className="rounded-xl border-2 border-orange-200 bg-orange-50/30 p-5 flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">🏠 Nosso</p>
                      <p className="text-xl font-extrabold text-orange-600">{formatCurrency(resumo.totalNosso)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">🏪 Deles</p>
                      <p className="text-xl font-extrabold text-blue-600">{formatCurrency(resumo.totalConc)}</p>
                    </div>
                  </div>
                </div>

                {/* Diferenca */}
                <div className={`rounded-xl border-2 p-5 flex flex-col justify-center ${resumo.diferenca > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                  <div className="text-center">
                    <span className="text-2xl">{resumo.diferenca > 0 ? '📈' : '📉'}</span>
                    <p className={`text-xl font-bold ${resumo.diferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {resumo.diferenca > 0 ? '+' : ''}{formatCurrency(resumo.diferenca)}
                    </p>
                  </div>
                  <p className={`text-xs text-center mt-1 ${resumo.diferenca > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {resumo.diferenca > 0 ? 'Pagaria MAIS conosco' : 'Pagaria MENOS conosco'}
                  </p>
                </div>
              </div>

              {/* Indicador de filtro ativo */}
              {cardFilter && (
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <span className={`px-4 py-1.5 rounded-full font-semibold ${
                    cardFilter === 'baratos' ? 'bg-green-100 text-green-700' :
                    cardFilter === 'caros' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    🔽 Filtrando: {cardFilter === 'baratos' ? 'Mais Baratos' : cardFilter === 'caros' ? 'Mais Caros' : 'Preco Igual'}
                    ({filteredData.length} itens)
                  </span>
                  <button onClick={() => setCardFilter(null)} className="text-gray-400 hover:text-gray-600 underline">
                    Limpar filtro
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabela */}
        {filteredData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '65vh' }}>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {[
                      { key: 'COD_PRODUTO', label: 'Codigo', align: 'left' },
                      { key: 'DESCRICAO', label: 'Descricao', align: 'left' },
                      { key: 'RELEVANCIA', label: 'Relev.', align: 'center' },
                      { key: 'CURVA', label: 'Curva', align: 'center' },
                      { key: 'SECAO', label: 'Secao', align: 'left' },
                      { key: 'PRECO_VENDA', label: '🏠 Nosso', align: 'right' },
                      { key: 'CONC_PRECO', label: '🏪 Conc.', align: 'right' },
                      { key: 'DIFERENCA_RS', label: 'Dif R$', align: 'right' },
                      { key: 'DIFERENCA_PCT', label: 'Dif %', align: 'right' },
                      { key: 'MARGEM_PCT', label: 'Margem %', align: 'right' },
                      { key: 'ESTOQUE', label: 'Estoque', align: 'right' },
                      { key: 'VD_MEDIA', label: 'Vd Media', align: 'right' },
                      { key: 'DTA_PESQUISA', label: '📅 Pesquisa', align: 'center' },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-4 py-3 text-${col.align} font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap border-b-2 border-gray-200 select-none`}>
                        {col.label}
                        {sortConfig.key === col.key && (
                          <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row, idx) => {
                    const difColor = row.DIFERENCA_RS > 0 ? 'text-red-600 font-semibold' : row.DIFERENCA_RS < 0 ? 'text-green-600 font-semibold' : 'text-gray-500';
                    const pvColor = row.PRECO_VENDA <= row.CONC_PRECO ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                    return (
                      <tr key={`${row.COD_PRODUTO}-${idx}`} className={`hover:bg-orange-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-2.5 text-gray-700 font-mono">{row.COD_PRODUTO}</td>
                        <td className="px-4 py-2.5 text-gray-900 max-w-sm truncate font-medium" title={row.DESCRICAO}>{row.DESCRICAO}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                            row.RELEVANCIA === 'N' ? 'bg-purple-100 text-purple-700' :
                            row.RELEVANCIA === 'SP' ? 'bg-amber-100 text-amber-700' :
                            row.RELEVANCIA === 'R' ? 'bg-gray-100 text-gray-600' :
                            'bg-gray-50 text-gray-400'
                          }`}>{row.RELEVANCIA === 'N' ? '⭐ N' : row.RELEVANCIA === 'SP' ? '💰 SP' : row.RELEVANCIA === 'R' ? '📦 R' : '-'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                            row.CURVA === 'A' ? 'bg-green-100 text-green-700' :
                            row.CURVA === 'B' ? 'bg-blue-100 text-blue-700' :
                            row.CURVA === 'C' ? 'bg-yellow-100 text-yellow-700' :
                            row.CURVA === 'D' ? 'bg-orange-100 text-orange-700' :
                            row.CURVA === 'E' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>{row.CURVA}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{row.SECAO}</td>
                        <td className={`px-4 py-2.5 text-right ${pvColor}`}>{formatCurrency(row.PRECO_VENDA)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{formatCurrency(row.CONC_PRECO)}</td>
                        <td className={`px-4 py-2.5 text-right ${difColor}`}>
                          {row.DIFERENCA_RS > 0 ? '+' : ''}{formatCurrency(row.DIFERENCA_RS)}
                        </td>
                        <td className={`px-4 py-2.5 text-right ${difColor}`}>
                          {row.DIFERENCA_PCT > 0 ? '+' : ''}{formatPct(row.DIFERENCA_PCT)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{formatPct(row.MARGEM_PCT)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{Number(row.ESTOQUE || 0).toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{(row.VD_MEDIA || 0).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{formatDate(row.DTA_PESQUISA)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">Carregando dados de concorrencia...</p>
          </div>
        )}

        {/* Empty */}
        {data.length === 0 && !loading && !codLoja && (
          <div className="text-center py-20 text-gray-400">
            <span className="text-6xl block mb-4">🏪</span>
            <p className="text-xl font-medium">Selecione uma loja</p>
            <p className="text-sm mt-2">Escolha uma loja no menu lateral para visualizar dados de concorrencia</p>
          </div>
        )}
        {data.length === 0 && !loading && codLoja && (
          <div className="text-center py-20 text-gray-400">
            <span className="text-6xl block mb-4">🏆</span>
            <p className="text-xl font-medium">Nenhum produto com pesquisa de concorrente</p>
            <p className="text-sm mt-2">Verifique se existem dados de pesquisa de preco cadastrados no sistema</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
