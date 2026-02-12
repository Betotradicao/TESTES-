import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ExtratoSantander() {
  const [loading, setLoading] = useState(true);
  const [loadingSaldo, setLoadingSaldo] = useState(true);
  const [saldo, setSaldo] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [totais, setTotais] = useState({ creditos: 0, debitos: 0, qtdCreditos: 0, qtdDebitos: 0, totalRegistros: 0 });
  const [error, setError] = useState(null);
  const [sortEntradas, setSortEntradas] = useState({ key: 'valor', direction: 'desc' });
  const [sortSaidas, setSortSaidas] = useState({ key: 'valor', direction: 'desc' });

  // Filtros - data inicio = primeiro dia do mes, data fim = ontem
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [filters, setFilters] = useState({
    initialDate: primeiroDiaMes.toISOString().split('T')[0],
    finalDate: ontem.toISOString().split('T')[0]
  });

  const fetchSaldo = useCallback(async () => {
    setLoadingSaldo(true);
    try {
      const res = await api.get('/santander/saldo');
      setSaldo(res.data);
    } catch (err) {
      console.error('Erro ao buscar saldo:', err);
    } finally {
      setLoadingSaldo(false);
    }
  }, []);

  const fetchExtrato = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/santander/extrato-completo', {
        params: {
          initialDate: filters.initialDate,
          finalDate: filters.finalDate
        },
        timeout: 300000 // 5 minutos para consultas grandes (ano inteiro)
      });
      const data = res.data;
      setAllItems(data.items || []);
      setTotais(data.totais || { creditos: 0, debitos: 0, qtdCreditos: 0, qtdDebitos: 0, totalRegistros: 0 });
    } catch (err) {
      console.error('Erro ao buscar extrato:', err);
      setError(err.response?.data?.details || err.message || 'Erro ao buscar extrato');
      setAllItems([]);
      setTotais({ creditos: 0, debitos: 0, qtdCreditos: 0, qtdDebitos: 0, totalRegistros: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters.initialDate, filters.finalDate]);

  useEffect(() => { fetchSaldo(); }, [fetchSaldo]);
  useEffect(() => { fetchExtrato(); }, [fetchExtrato]);

  // Separar entradas e saidas
  const entradas = useMemo(() => allItems.filter(i => i.creditDebitType === 'CREDITO'), [allItems]);
  const saidas = useMemo(() => allItems.filter(i => i.creditDebitType === 'DEBITO'), [allItems]);

  // Funcao de ordenacao generica
  const sortItems = (items, sortConfig) => {
    if (!sortConfig.key) return items;
    return [...items].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'date': {
          const [ad, am, ay] = (a.transactionDate || '').split('/');
          const [bd, bm, by] = (b.transactionDate || '').split('/');
          aVal = `${ay}${am}${ad}`;
          bVal = `${by}${bm}${bd}`;
          break;
        }
        case 'descricao':
          aVal = (a.transactionName || '').toLowerCase();
          bVal = (b.transactionName || '').toLowerCase();
          break;
        case 'complemento':
          aVal = (a.historicComplement || '').toLowerCase();
          bVal = (b.historicComplement || '').toLowerCase();
          break;
        case 'valor':
          aVal = Math.abs(parseFloat(a.amount || 0));
          bVal = Math.abs(parseFloat(b.amount || 0));
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        default:
          return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const entradasOrdenadas = useMemo(() => sortItems(entradas, sortEntradas), [entradas, sortEntradas]);
  const saidasOrdenadas = useMemo(() => sortItems(saidas, sortSaidas), [saidas, sortSaidas]);

  const handleSortEntradas = (key) => {
    setSortEntradas(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSortSaidas = (key) => {
    setSortSaidas(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ sortConfig: sc, columnKey }) => {
    if (sc.key !== columnKey) {
      return (
        <svg className="w-3 h-3 text-gray-400 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      );
    }
    return sc.direction === 'asc' ? (
      <svg className="w-3 h-3 text-orange-500 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
      </svg>
    ) : (
      <svg className="w-3 h-3 text-orange-500 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
      </svg>
    );
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Tabela de lancamentos reutilizavel
  const TabelaLancamentos = ({ items, tipo, sortConfig: sc, onSort, isLoading }) => {
    const isEntrada = tipo === 'CREDITO';
    const corTexto = isEntrada ? 'text-green-600' : 'text-red-600';
    const corBg = isEntrada ? 'bg-green-50' : 'bg-red-50';
    const corBorder = isEntrada ? 'border-green-200' : 'border-red-200';
    const corHeader = isEntrada ? 'bg-green-100' : 'bg-red-100';
    const total = items.reduce((s, i) => s + Math.abs(parseFloat(i.amount || 0)), 0);

    return (
      <div className={`bg-white rounded-xl shadow-sm border ${corBorder} overflow-hidden flex flex-col`}>
        {/* Cabecalho da coluna */}
        <div className={`${corBg} px-4 py-3 border-b ${corBorder}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEntrada ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>
                </svg>
              )}
              <h3 className={`font-bold text-base ${corTexto}`}>
                {isEntrada ? 'ENTRADAS' : 'SAIDAS'}
              </h3>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                {items.length} lancamentos
              </span>
            </div>
            <p className={`text-lg font-bold ${corTexto}`}>
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto flex-1" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className={corHeader}>
                <th onClick={() => onSort('date')} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-orange-600 select-none w-24">
                  Data <SortIcon sortConfig={sc} columnKey="date" />
                </th>
                <th onClick={() => onSort('descricao')} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-orange-600 select-none">
                  Descricao <SortIcon sortConfig={sc} columnKey="descricao" />
                </th>
                <th onClick={() => onSort('complemento')} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-orange-600 select-none">
                  Complemento <SortIcon sortConfig={sc} columnKey="complemento" />
                </th>
                <th onClick={() => onSort('valor')} className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-orange-600 select-none w-32">
                  Valor <SortIcon sortConfig={sc} columnKey="valor" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan="4" className="px-3 py-2.5">
                      <div className="animate-pulse flex gap-3">
                        <div className="bg-gray-200 h-3.5 w-16 rounded"></div>
                        <div className="bg-gray-200 h-3.5 flex-1 rounded"></div>
                        <div className="bg-gray-200 h-3.5 w-20 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-3 py-8 text-center text-gray-400 text-sm">
                    Nenhum lancamento encontrado
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const valor = Math.abs(parseFloat(item.amount || 0));
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {item.transactionDate}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-800 font-medium">
                        {item.transactionName}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px] truncate" title={item.historicComplement}>
                        {item.historicComplement || '-'}
                      </td>
                      <td className={`px-3 py-2 text-xs font-bold text-right whitespace-nowrap ${corTexto}`}>
                        {formatCurrency(valor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodape com total */}
        {!isLoading && items.length > 0 && (
          <div className={`${corBg} px-4 py-2 border-t ${corBorder} flex justify-between items-center`}>
            <span className="text-xs text-gray-500">{items.length} lancamentos</span>
            <span className={`text-sm font-bold ${corTexto}`}>
              Total: {formatCurrency(total)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header com banner laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2.5">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Extrato Bancario - Santander</h1>
                <p className="text-white/80 text-sm">Ag. 3310 | Conta 13007597-3</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs uppercase tracking-wider">Saldo Disponivel</p>
              {loadingSaldo ? (
                <div className="animate-pulse bg-white/20 h-8 w-40 rounded mt-1"></div>
              ) : saldo ? (
                <p className="text-2xl md:text-3xl font-bold">{formatCurrency(saldo.availableAmount)}</p>
              ) : (
                <p className="text-lg text-white/60">Indisponivel</p>
              )}
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Total Entradas</p>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totais.creditos)}</p>
            <p className="text-xs text-gray-400">{totais.qtdCreditos} lancamentos</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Total Saidas</p>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totais.debitos)}</p>
            <p className="text-xs text-gray-400">{totais.qtdDebitos} lancamentos</p>
          </div>
          {/* SALDO DO PERIODO - Card grande em destaque */}
          <div className={`rounded-xl p-4 shadow-lg border-2 ${
            totais.creditos - totais.debitos >= 0
              ? 'bg-green-50 border-green-400'
              : 'bg-red-50 border-red-400'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <svg className={`w-5 h-5 ${totais.creditos - totais.debitos >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-gray-600 uppercase font-semibold">Saldo do Periodo</p>
            </div>
            <p className={`text-2xl font-black ${totais.creditos - totais.debitos >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(totais.creditos - totais.debitos)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {filters.initialDate.split('-').reverse().join('/')} a {filters.finalDate.split('-').reverse().join('/')}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Bloqueado</p>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {saldo ? formatCurrency(saldo.blockedAmount) : 'R$ 0,00'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Total Registros</p>
            </div>
            <p className="text-lg font-bold text-purple-600">{totais.totalRegistros?.toLocaleString()}</p>
            <p className="text-xs text-gray-400">
              {totais.qtdCreditos} entradas + {totais.qtdDebitos} saidas
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Inicio</label>
              <input
                type="date"
                value={filters.initialDate}
                onChange={(e) => setFilters(f => ({ ...f, initialDate: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.finalDate}
                onChange={(e) => setFilters(f => ({ ...f, finalDate: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={fetchExtrato}
              disabled={loading}
              className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              )}
              Consultar
            </button>
            <button
              onClick={fetchSaldo}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Atualizar Saldo
            </button>
            {loading && (
              <span className="text-xs text-orange-600 animate-pulse">
                Buscando todos os lancamentos... Isso pode levar alguns segundos.
              </span>
            )}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm font-medium">Erro: {error}</p>
            <p className="text-red-500 text-xs mt-1">Verifique as configuracoes do Santander em Configuracoes do sistema.</p>
          </div>
        )}

        {/* DUAS COLUNAS: Entradas | Saidas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coluna ENTRADAS */}
          <TabelaLancamentos
            items={entradasOrdenadas}
            tipo="CREDITO"
            sortConfig={sortEntradas}
            onSort={handleSortEntradas}
            isLoading={loading}
          />

          {/* Coluna SAIDAS */}
          <TabelaLancamentos
            items={saidasOrdenadas}
            tipo="DEBITO"
            sortConfig={sortSaidas}
            onSort={handleSortSaidas}
            isLoading={loading}
          />
        </div>

        {/* Rodape geral com resumo */}
        {!loading && allItems.length > 0 && (
          <div className="mt-4 bg-gray-800 rounded-xl p-4 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase">Entradas</p>
                <p className="text-green-400 font-bold">{formatCurrency(totais.creditos)}</p>
              </div>
              <div className="text-2xl text-gray-500">-</div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Saidas</p>
                <p className="text-red-400 font-bold">{formatCurrency(totais.debitos)}</p>
              </div>
              <div className="text-2xl text-gray-500">=</div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Saldo do Periodo</p>
                <p className={`font-bold text-lg ${totais.creditos - totais.debitos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(totais.creditos - totais.debitos)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{totais.totalRegistros?.toLocaleString()} lancamentos no total</p>
              <p className="text-xs text-gray-500">
                {filters.initialDate.split('-').reverse().join('/')} a {filters.finalDate.split('-').reverse().join('/')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
