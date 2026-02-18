import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function AnaliseRelevancia() {
  const { user, logout } = useAuth();
  const { lojas, lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totais, setTotais] = useState(null);

  // Filtros
  const [filters, setFilters] = useState({
    dataInicio: (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]; })(),
    dataFim: new Date().toISOString().split('T')[0],
    codLoja: '',
    codSecao: '',
    codGrupo: '',
    codSubGrupo: '',
  });

  // Config do processamento
  const [config, setConfig] = useState({
    pesoVendasRS: 25,
    pesoVendasQtde: 25,
    pesoPenetCupons: 30,
    pesoPenetSubCateg: 20,
    pctNotavel: 2,
    pctSensivel: 7,
    subcategoriaPor: 'grupo',
  });

  // Listas de filtros
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);

  const [todasSecoes, setTodasSecoes] = useState(true);

  // Filtro de busca na tabela
  const [searchText, setSearchText] = useState('');
  // Filtro por relevância (clicando nos cards)
  const [filterRelevancia, setFilterRelevancia] = useState(null); // null = todos, 'N', 'SP', 'R'

  // Ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'SCORE', direction: 'desc' });

  // Colunas (ordem customizável via drag & drop)
  const defaultColumns = [
    { key: 'COD_PRODUTO', label: 'Código', align: 'left' },
    { key: 'COD_BARRAS', label: 'Cód. Barras', align: 'left' },
    { key: 'DESCRICAO', label: 'Descrição', align: 'left' },
    { key: 'RELEVANCIA', label: 'Relevância', align: 'center' },
    { key: 'SCORE', label: 'Score', align: 'right' },
    { key: 'PRECO_VENDA', label: 'Preço Venda', align: 'right' },
    { key: 'CONC_BARATO', label: 'Conc. Mais Barato', align: 'right' },
    { key: 'PART_VENDAS_RS', label: 'Part. Vendas R$', align: 'right' },
    { key: 'PART_VENDAS_QTDE', label: 'Part. Vendas Qtde', align: 'right' },
    { key: 'PENET_CUPONS', label: 'Penet. Cupons', align: 'right' },
    { key: 'PENET_SUBCATEG', label: 'Penet. SubCateg', align: 'right' },
    { key: 'VAL_VENDA', label: 'Vendas R$', align: 'right' },
    { key: 'QTD_VENDA', label: 'Qtde Vendida', align: 'right' },
    { key: 'QTD_CUPONS', label: 'Nº Cupons', align: 'right' },
  ];
  const [columnOrder, setColumnOrder] = useState(defaultColumns);

  function formatDateForApi(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Carregar seções
  useEffect(() => {
    api.get('/relevancia/secoes').then(r => setSecoes(r.data || [])).catch(() => {});
  }, []);

  // Sincronizar loja - pré-selecionar se tiver loja no contexto, ou primeira loja disponível
  useEffect(() => {
    if (lojaSelecionada !== null && lojaSelecionada !== undefined) {
      setFilters(prev => ({ ...prev, codLoja: String(lojaSelecionada) }));
    } else if (lojas.length > 0 && !filters.codLoja) {
      setFilters(prev => ({ ...prev, codLoja: String(lojas[0].COD_LOJA) }));
    }
  }, [lojaSelecionada, lojas]);

  // Carregar grupos quando seção muda
  useEffect(() => {
    if (filters.codSecao) {
      api.get(`/relevancia/grupos?codSecao=${filters.codSecao}`).then(r => setGrupos(r.data || [])).catch(() => {});
      setFilters(prev => ({ ...prev, codGrupo: '', codSubGrupo: '' }));
      setSubgrupos([]);
    } else {
      setGrupos([]);
      setSubgrupos([]);
    }
  }, [filters.codSecao]);

  // Carregar subgrupos quando grupo muda
  useEffect(() => {
    if (filters.codSecao && filters.codGrupo) {
      api.get(`/relevancia/subgrupos?codSecao=${filters.codSecao}&codGrupo=${filters.codGrupo}`)
        .then(r => setSubgrupos(r.data || [])).catch(() => {});
      setFilters(prev => ({ ...prev, codSubGrupo: '' }));
    } else {
      setSubgrupos([]);
    }
  }, [filters.codGrupo]);

  const pctRegular = Math.max(0, 100 - config.pctNotavel - config.pctSensivel);

  const handleProcessar = async () => {
    if (!filters.codLoja) { toast.error('Selecione uma loja'); return; }
    if (!todasSecoes && !filters.codSecao) { toast.error('Selecione uma seção'); return; }
    if (!filters.dataInicio || !filters.dataFim) { toast.error('Informe o período'); return; }

    const somaPesos = config.pesoVendasRS + config.pesoVendasQtde + config.pesoPenetCupons + config.pesoPenetSubCateg;
    if (somaPesos !== 100) { toast.error(`Soma dos pesos deve ser 100% (atual: ${somaPesos}%)`); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        dataInicio: formatDateForApi(filters.dataInicio),
        dataFim: formatDateForApi(filters.dataFim),
        codLoja: filters.codLoja,
        pesoVendasRS: String(config.pesoVendasRS),
        pesoVendasQtde: String(config.pesoVendasQtde),
        pesoPenetCupons: String(config.pesoPenetCupons),
        pesoPenetSubCateg: String(config.pesoPenetSubCateg),
        pctNotavel: String(config.pctNotavel),
        pctSensivel: String(config.pctSensivel),
        subcategoriaPor: config.subcategoriaPor,
      });
      if (todasSecoes) {
        params.append('todasSecoes', 'true');
      } else {
        params.append('codSecao', filters.codSecao);
      }
      if (filters.codGrupo) params.append('codGrupo', filters.codGrupo);
      if (filters.codSubGrupo) params.append('codSubGrupo', filters.codSubGrupo);

      const response = await api.get(`/relevancia/processar?${params.toString()}`);
      if (response.data.success) {
        setData(response.data.data || []);
        setTotais(response.data.totais || null);
        setFilterRelevancia(null);
        toast.success(`Processamento concluído: ${response.data.totais?.totalItens || 0} itens`);
      } else {
        toast.error(response.data.error || 'Erro no processamento');
      }
    } catch (err) {
      toast.error('Erro ao processar relevância');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Badge de relevância
  const renderRelevancia = (rel) => {
    if (rel === 'N') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">N</span>;
    if (rel === 'SP') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">SP</span>;
    if (rel === 'R') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">R</span>;
    return <span className="text-gray-400">-</span>;
  };

  // Ordenação
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Dados filtrados e ordenados
  const filteredData = data
    .filter(row => {
      // Filtro por relevância (cards clicáveis)
      if (filterRelevancia && row.RELEVANCIA !== filterRelevancia) return false;
      // Filtro por busca texto
      if (!searchText) return true;
      const s = searchText.toLowerCase();
      return (row.DESCRICAO || '').toLowerCase().includes(s)
        || String(row.COD_PRODUTO).includes(s)
        || (row.COD_BARRAS || '').includes(s);
    })
    .sort((a, b) => {
      const val_a = a[sortConfig.key] ?? 0;
      const val_b = b[sortConfig.key] ?? 0;
      if (typeof val_a === 'string') return sortConfig.direction === 'asc' ? val_a.localeCompare(val_b) : val_b.localeCompare(val_a);
      return sortConfig.direction === 'asc' ? val_a - val_b : val_b - val_a;
    });

  const formatNumber = (v, decimals = 2) => {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatCurrency = (v) => {
    if (v == null || isNaN(v)) return '-';
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Análise Relevância</h1>
          <div className="w-10" />
        </div>

        {/* Header Laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-white">ANÁLISE DE RELEVÂNCIA</h1>
                <div className="relative"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}>
                  <svg className="h-5 w-5 text-white/80 hover:text-white cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showTooltip && (
                    <div className="absolute left-0 top-8 z-50 w-[90vw] max-w-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 p-5 text-gray-700 text-sm leading-relaxed"
                      style={{ pointerEvents: 'none' }}>
                      <h3 className="font-bold text-orange-600 text-base mb-2">Como funciona a Análise de Relevância?</h3>
                      <p className="mb-3">
                        Classifica cada produto em <strong>3 categorias</strong> com base na sua importância para o negócio, usando a <strong>metodologia ATKearney</strong>:
                      </p>
                      <div className="space-y-2 mb-3">
                        <div className="flex items-start gap-2">
                          <span className="inline-block mt-0.5 w-4 h-4 rounded bg-green-500 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">N</span>
                          <span><strong>Notável (top 2%)</strong> — Produtos essenciais. Ex: Arroz 5kg, Leite Integral, Café 500g. Alta venda, presentes na maioria dos cupons.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="inline-block mt-0.5 w-4 h-4 rounded bg-yellow-500 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center" style={{fontSize:'9px'}}>SP</span>
                          <span><strong>Sensível a Preço (7%)</strong> — Produtos que o cliente compara preço. Ex: Cerveja, Refrigerante, Óleo de Soja. Preço competitivo é crucial.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="inline-block mt-0.5 w-4 h-4 rounded bg-red-500 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">R</span>
                          <span><strong>Regular (91%)</strong> — Demais produtos do mix. Ex: Temperos, produtos de nicho. Menor impacto individual.</span>
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-800 mb-1">4 Critérios de Pontuação:</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
                        <li><strong>Part. Vendas R$</strong> — Quanto o produto representa do faturamento total da seção</li>
                        <li><strong>Part. Vendas Qtde</strong> — Quanto representa em volume de unidades vendidas</li>
                        <li><strong>Penetração Cupons</strong> — Em quantos cupons o produto aparece vs total de cupons da seção</li>
                        <li><strong>Penetração SubCategoria</strong> — Em quantos cupons aparece vs cupons do mesmo grupo/subgrupo</li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-500 italic">
                        Os produtos são ordenados por score (soma ponderada dos 4 critérios) e classificados pelos percentis configurados.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-orange-100 text-sm">Processamento de relevância - Metodologia ATKearney</p>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-3">
          {/* Filtros + Config */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {/* Período */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data Início</label>
                <input type="date" value={filters.dataInicio} onChange={e => setFilters(p => ({ ...p, dataInicio: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data Fim</label>
                <input type="date" value={filters.dataFim} onChange={e => setFilters(p => ({ ...p, dataFim: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              {/* Seção */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seção *</label>
                <select value={filters.codSecao} onChange={e => setFilters(p => ({ ...p, codSecao: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">Selecione</option>
                  {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.DES_SECAO}</option>)}
                </select>
              </div>
              {/* Grupo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Grupo</label>
                <select value={filters.codGrupo} onChange={e => setFilters(p => ({ ...p, codGrupo: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.DES_GRUPO}</option>)}
                </select>
              </div>
              {/* SubGrupo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">SubGrupo</label>
                <select value={filters.codSubGrupo} onChange={e => setFilters(p => ({ ...p, codSubGrupo: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">Todos</option>
                  {subgrupos.map(sg => <option key={sg.COD_SUB_GRUPO} value={sg.COD_SUB_GRUPO}>{sg.DES_SUB_GRUPO}</option>)}
                </select>
              </div>
              {/* Loja */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Loja *</label>
                <select value={filters.codLoja} onChange={e => setFilters(p => ({ ...p, codLoja: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">Selecione</option>
                  {lojas.map(l => <option key={l.COD_LOJA} value={l.COD_LOJA}>{l.COD_LOJA} - {l.DES_LOJA || l.APELIDO || ''}</option>)}
                </select>
              </div>
            </div>

            {/* Config de Pesos e Distribuição */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Pesos */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <h3 className="text-sm font-bold text-orange-800 mb-2 uppercase">Pesos (total = 100%)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Vendas R$</label>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pesoVendasRS} onChange={e => setConfig(p => ({ ...p, pesoVendasRS: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Vendas Qtde</label>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pesoVendasQtde} onChange={e => setConfig(p => ({ ...p, pesoVendasQtde: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Penet. Cupons</label>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pesoPenetCupons} onChange={e => setConfig(p => ({ ...p, pesoPenetCupons: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Penet. SubCateg</label>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pesoPenetSubCateg} onChange={e => setConfig(p => ({ ...p, pesoPenetSubCateg: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm mt-1 font-bold ${config.pesoVendasRS + config.pesoVendasQtde + config.pesoPenetCupons + config.pesoPenetSubCateg === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    Total: {config.pesoVendasRS + config.pesoVendasQtde + config.pesoPenetCupons + config.pesoPenetSubCateg}%
                  </div>
                </div>

                {/* Distribuição */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <h3 className="text-sm font-bold text-orange-800 mb-1 uppercase">Distribuição Itens</h3>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2 cursor-pointer">
                    <input type="checkbox" checked={todasSecoes} onChange={e => setTodasSecoes(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600" />
                    Processar todas as seções?
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-500 rounded-sm"></span> Notáveis:</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pctNotavel} onChange={e => setConfig(p => ({ ...p, pctNotavel: Number(e.target.value) }))}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} step={0.5} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-500 rounded-sm"></span> Sensíveis a preço:</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={config.pctSensivel} onChange={e => setConfig(p => ({ ...p, pctSensivel: Number(e.target.value) }))}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center font-semibold" min={0} max={100} step={0.5} />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-500 rounded-sm"></span> Regulares:</span>
                      <span className="text-sm font-bold text-gray-700">{formatNumber(pctRegular, 2)}%</span>
                    </div>
                  </div>
                </div>

                {/* SubCategoria + Botão */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-orange-800 mb-2 uppercase">SubCategoria</h3>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input type="radio" name="subcateg" checked={config.subcategoriaPor === 'grupo'}
                          onChange={() => setConfig(p => ({ ...p, subcategoriaPor: 'grupo' }))} className="text-orange-600" />
                        Grupo
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input type="radio" name="subcateg" checked={config.subcategoriaPor === 'subgrupo'}
                          onChange={() => setConfig(p => ({ ...p, subcategoriaPor: 'subgrupo' }))} className="text-orange-600" />
                        SubGrupo
                      </label>
                    </div>
                  </div>
                  <button onClick={handleProcessar} disabled={loading}
                    className="mt-3 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 transition-all shadow-md flex items-center justify-center gap-2">
                    {loading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Processando...</>
                    ) : (
                      <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Processar</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && <RadarLoading message="Processando relevância..." />}

          {/* Totais */}
          {totais && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white rounded-lg shadow-sm border p-3 text-center">
                <div className="text-xs text-gray-500">Total Itens</div>
                <div className="text-lg font-bold text-gray-900">{totais.totalItens}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-3 text-center">
                <div className="text-xs text-gray-500">Total Vendas</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totais.totalVendas)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-3 text-center">
                <div className="text-xs text-gray-500">Total Cupons</div>
                <div className="text-lg font-bold text-gray-900">{totais.totalCupons?.toLocaleString('pt-BR')}</div>
              </div>
              <div onClick={() => setFilterRelevancia(prev => prev === 'N' ? null : 'N')}
                className={`rounded-lg shadow-sm border p-3 text-center cursor-pointer transition-all hover:scale-105 ${filterRelevancia === 'N' ? 'bg-green-200 border-green-500 ring-2 ring-green-400' : 'bg-green-50 border-green-200 hover:border-green-400'}`}>
                <div className="text-xs text-green-600 font-medium">Notáveis (N)</div>
                <div className="text-lg font-bold text-green-800">{totais.notaveis}</div>
              </div>
              <div onClick={() => setFilterRelevancia(prev => prev === 'SP' ? null : 'SP')}
                className={`rounded-lg shadow-sm border p-3 text-center cursor-pointer transition-all hover:scale-105 ${filterRelevancia === 'SP' ? 'bg-yellow-200 border-yellow-500 ring-2 ring-yellow-400' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'}`}>
                <div className="text-xs text-yellow-600 font-medium">Sensíveis (SP)</div>
                <div className="text-lg font-bold text-yellow-800">{totais.sensiveis}</div>
              </div>
              <div onClick={() => setFilterRelevancia(prev => prev === 'R' ? null : 'R')}
                className={`rounded-lg shadow-sm border p-3 text-center cursor-pointer transition-all hover:scale-105 ${filterRelevancia === 'R' ? 'bg-red-200 border-red-500 ring-2 ring-red-400' : 'bg-red-50 border-red-200 hover:border-red-400'}`}>
                <div className="text-xs text-red-600 font-medium">Regulares (R)</div>
                <div className="text-lg font-bold text-red-800">{totais.regulares}</div>
              </div>
              <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-300 p-3 text-center">
                <div className="text-xs text-gray-600 font-medium">Total Apurados</div>
                <div className="text-lg font-bold text-gray-900">{totais.notaveis + totais.sensiveis + totais.regulares}</div>
              </div>
            </div>
          )}


          {/* Tabela de Resultados */}
          {data.length > 0 && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Search */}
              <div className="p-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                    placeholder="Buscar por código, descrição ou EAN..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                {filterRelevancia && (
                  <button onClick={() => setFilterRelevancia(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                    Filtro: {filterRelevancia === 'N' ? 'Notáveis' : filterRelevancia === 'SP' ? 'Sensíveis' : 'Regulares'}
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                <span className="text-xs text-gray-500">{filteredData.length} de {data.length} itens</span>
              </div>

              <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}>
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {columnOrder.map((col, colIdx) => (
                        <th key={col.key}
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('colIdx', colIdx.toString()); }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            const from = parseInt(e.dataTransfer.getData('colIdx'));
                            if (from !== colIdx) {
                              setColumnOrder(prev => {
                                const arr = [...prev];
                                const [moved] = arr.splice(from, 1);
                                arr.splice(colIdx, 0, moved);
                                return arr;
                              });
                            }
                          }}
                          onClick={() => handleSort(col.key)}
                          className={`px-3 py-2 text-${col.align} font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap border-b border-gray-200 select-none`}>
                          {col.label}
                          {sortConfig.key === col.key && (
                            <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.map((row, idx) => (
                      <tr key={row.COD_PRODUTO} className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        {columnOrder.map(col => {
                          const val = row[col.key];
                          if (col.key === 'COD_PRODUTO') return <td key={col.key} className="px-3 py-2 text-gray-700 font-mono">{val}</td>;
                          if (col.key === 'COD_BARRAS') return <td key={col.key} className="px-3 py-2 text-gray-600 font-mono">{val || '-'}</td>;
                          if (col.key === 'DESCRICAO') return <td key={col.key} className="px-3 py-2 text-gray-900 max-w-xs truncate" title={val}>{val}</td>;
                          if (col.key === 'RELEVANCIA') return <td key={col.key} className="px-3 py-2 text-center">{renderRelevancia(val)}</td>;
                          if (col.key === 'SCORE') return <td key={col.key} className="px-3 py-2 text-right font-semibold text-gray-900">{formatNumber(val, 4)}</td>;
                          if (col.key === 'PRECO_VENDA') {
                            const pv = val || 0;
                            const cb = row.CONC_BARATO || 0;
                            const cor = (pv > 0 && cb > 0) ? (pv <= cb ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold') : 'text-gray-700';
                            return <td key={col.key} className={`px-3 py-2 text-right ${cor}`}>{formatCurrency(val)}</td>;
                          }
                          if (col.key === 'CONC_BARATO') return <td key={col.key} className="px-3 py-2 text-right text-gray-700">{formatCurrency(val)}</td>;
                          if (col.key === 'VAL_VENDA') return <td key={col.key} className="px-3 py-2 text-right text-gray-700">{formatCurrency(val)}</td>;
                          if (col.key === 'QTD_CUPONS') return <td key={col.key} className="px-3 py-2 text-right text-gray-700">{val?.toLocaleString('pt-BR')}</td>;
                          if (['PART_VENDAS_RS', 'PART_VENDAS_QTDE', 'PENET_CUPONS', 'PENET_SUBCATEG'].includes(col.key)) return <td key={col.key} className="px-3 py-2 text-right text-gray-700">{formatNumber(val)}%</td>;
                          return <td key={col.key} className="px-3 py-2 text-right text-gray-700">{formatNumber(val)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <p className="text-lg font-medium">Selecione os filtros e clique em Processar</p>
              <p className="text-sm mt-1">Configure os pesos e a distribuição para gerar a análise de relevância</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
