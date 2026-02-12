import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

export default function NotaFiscalRecebimento() {
  const { lojaSelecionada } = useLoja();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState({ conferentes: [], cpds: [], financeiros: [] });
  const [fornecedoresList, setFornecedoresList] = useState([]);
  const [fornecedorSearch, setFornecedorSearch] = useState('');
  const [showFornecedorDropdown, setShowFornecedorDropdown] = useState(false);
  const [entradasMap, setEntradasMap] = useState({});
  const [filters, setFilters] = useState({
    data_de: new Date().toISOString().split('T')[0],
    data_ate: new Date().toISOString().split('T')[0],
    fornecedor: '',
    conferente: '',
    cpd: '',
    financeiro: ''
  });

  // Modal states
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [showAssinaturaModal, setShowAssinaturaModal] = useState(false);
  const [editingNota, setEditingNota] = useState(null);
  const [assinaturaData, setAssinaturaData] = useState({ notaId: null, tipo: '', username: '', password: '', isLote: false });
  const [assinaturaError, setAssinaturaError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formFornecedorSearch, setFormFornecedorSearch] = useState('');
  const [showFormFornecedorDropdown, setShowFormFornecedorDropdown] = useState(false);
  const [formCnpjSearch, setFormCnpjSearch] = useState('');
  const [showCnpjDropdown, setShowCnpjDropdown] = useState(false);
  const [buscandoNf, setBuscandoNf] = useState(false);
  const [nfOracleInfo, setNfOracleInfo] = useState(null);

  // Lote (batch) selection
  const [selectedNotas, setSelectedNotas] = useState(new Set());

  const [formNota, setFormNota] = useState({
    num_nota: '',
    fornecedor: '',
    cod_fornecedor: null,
    data_recebimento: new Date().toISOString().split('T')[0],
    hora_recebimento: new Date().toTimeString().slice(0, 5),
    valor_nota: ''
  });

  // Buscar NF no Oracle pelo número
  const buscarNfOracle = useCallback(async (numNota) => {
    if (!numNota || numNota.length < 1) {
      setNfOracleInfo(null);
      return;
    }
    setBuscandoNf(true);
    try {
      const res = await api.get(`/nota-fiscal-recebimento/buscar-nf-oracle/${numNota}`);
      const data = res.data;
      if (data.found) {
        setNfOracleInfo(data);
        const fornecedorNome = data.tem_cadastro
          ? (data.fornecedor_local || data.fornecedor)
          : (data.fornecedor || 'Fornecedor sem cadastro');
        setFormNota(prev => ({
          ...prev,
          fornecedor: fornecedorNome,
          cod_fornecedor: data.cod_fornecedor || null,
          valor_nota: data.valor_total ? data.valor_total.toString() : prev.valor_nota
        }));
        setFormFornecedorSearch(fornecedorNome);
        setFormCnpjSearch(data.cnpj || '');
      } else {
        setNfOracleInfo({ found: false });
      }
    } catch (err) {
      console.error('Erro ao buscar NF no Oracle:', err);
      setNfOracleInfo(null);
    } finally {
      setBuscandoNf(false);
    }
  }, []);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.data_de) params.append('data_de', filters.data_de);
      if (filters.data_ate) params.append('data_ate', filters.data_ate);
      if (filters.fornecedor) params.append('fornecedor', filters.fornecedor);
      if (filters.conferente) params.append('conferente', filters.conferente);
      if (filters.cpd) params.append('cpd', filters.cpd);
      if (filters.financeiro) params.append('financeiro', filters.financeiro);
      if (lojaSelecionada) params.append('cod_loja', lojaSelecionada);

      const res = await api.get(`/nota-fiscal-recebimento?${params.toString()}`);
      setNotas(res.data || []);
      setSelectedNotas(new Set());
    } catch (err) {
      console.error('Erro ao buscar notas:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, lojaSelecionada]);

  const fetchColaboradores = useCallback(async () => {
    try {
      const params = lojaSelecionada ? `?cod_loja=${lojaSelecionada}` : '';
      const res = await api.get(`/nota-fiscal-recebimento/colaboradores${params}`);
      setColaboradores(res.data || { conferentes: [], cpds: [], financeiros: [] });
    } catch (err) {
      console.error('Erro ao buscar colaboradores:', err);
    }
  }, [lojaSelecionada]);

  const fetchFornecedores = useCallback(async () => {
    try {
      const res = await api.get('/nota-fiscal-recebimento/fornecedores');
      setFornecedoresList(res.data || []);
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
    }
  }, []);

  const verificarEntradas = useCallback(async (notasList) => {
    if (!notasList || notasList.length === 0) {
      setEntradasMap({});
      return;
    }
    try {
      const payload = notasList.map(n => ({ num_nota: n.num_nota, cod_fornecedor: n.cod_fornecedor }));
      const res = await api.post('/nota-fiscal-recebimento/verificar-entradas', { notas: payload });
      setEntradasMap(res.data || {});
    } catch (err) {
      console.error('Erro ao verificar entradas:', err);
    }
  }, []);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);
  useEffect(() => { fetchColaboradores(); }, [fetchColaboradores]);
  useEffect(() => { fetchFornecedores(); }, [fetchFornecedores]);

  useEffect(() => {
    if (notas.length > 0) verificarEntradas(notas);
  }, [notas, verificarEntradas]);

  const formatCnpj = (cnpj) => {
    if (!cnpj) return '';
    const nums = cnpj.replace(/\D/g, '');
    if (nums.length === 14) return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    return cnpj;
  };

  const filteredFornecedores = fornecedoresList.filter(f => {
    const search = fornecedorSearch.toLowerCase().replace(/[.\-\/]/g, '');
    return f.nome?.toLowerCase().includes(search) ||
      f.cod?.toString().includes(search) ||
      f.cnpj?.replace(/\D/g, '').includes(search);
  }).slice(0, 15);

  const filteredFormFornecedores = fornecedoresList.filter(f => {
    const search = formFornecedorSearch.toLowerCase().replace(/[.\-\/]/g, '');
    return f.nome?.toLowerCase().includes(search) ||
      f.cod?.toString().includes(search) ||
      f.cnpj?.replace(/\D/g, '').includes(search);
  }).slice(0, 15);

  const filteredCnpjFornecedores = fornecedoresList.filter(f => {
    if (!formCnpjSearch || formCnpjSearch.length < 3) return false;
    const search = formCnpjSearch.replace(/\D/g, '');
    return f.cnpj?.replace(/\D/g, '').includes(search);
  }).slice(0, 10);

  const handleSalvarNota = async () => {
    if (!formNota.num_nota || !formNota.fornecedor || !formNota.valor_nota) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formNota,
        valor_nota: parseFloat(formNota.valor_nota),
        cod_loja: lojaSelecionada || 1
      };

      if (editingNota) {
        await api.put(`/nota-fiscal-recebimento/${editingNota.id}`, payload);
      } else {
        await api.post('/nota-fiscal-recebimento', payload);
      }

      setShowNovaModal(false);
      setEditingNota(null);
      setFormNota({
        num_nota: '',
        fornecedor: '',
        cod_fornecedor: null,
        data_recebimento: new Date().toISOString().split('T')[0],
        hora_recebimento: new Date().toTimeString().slice(0, 5),
        valor_nota: ''
      });
      setFormFornecedorSearch('');
      setFormCnpjSearch('');
      setNfOracleInfo(null);
      fetchNotas();
    } catch (err) {
      console.error('Erro ao salvar nota:', err);
      alert(err.response?.data?.error || 'Erro ao salvar nota');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluirNota = async (id) => {
    if (!confirm('Deseja excluir esta nota fiscal?')) return;
    try {
      await api.delete(`/nota-fiscal-recebimento/${id}`);
      fetchNotas();
    } catch (err) {
      console.error('Erro ao excluir nota:', err);
      alert(err.response?.data?.error || 'Erro ao excluir nota');
    }
  };

  const handleAbrirAssinatura = (notaId, tipo) => {
    setAssinaturaData({ notaId, tipo, username: '', password: '', isLote: false });
    setAssinaturaError('');
    setShowAssinaturaModal(true);
  };

  // Abrir modal de assinatura em lote
  const handleAbrirAssinaturaLote = (tipo) => {
    if (selectedNotas.size === 0) return;
    setAssinaturaData({ notaId: null, tipo, username: '', password: '', isLote: true });
    setAssinaturaError('');
    setShowAssinaturaModal(true);
  };

  const handleAssinar = async () => {
    if (!assinaturaData.username || !assinaturaData.password) {
      setAssinaturaError('Preencha usuario e senha');
      return;
    }
    setSubmitting(true);
    setAssinaturaError('');
    try {
      if (assinaturaData.isLote) {
        // Assinatura em lote
        const nota_ids = Array.from(selectedNotas);
        console.log('[LOTE FRONTEND] Enviando IDs:', nota_ids, 'tipo:', assinaturaData.tipo);
        const res = await api.post('/nota-fiscal-recebimento/assinar-lote', {
          tipo: assinaturaData.tipo,
          username: assinaturaData.username,
          password: assinaturaData.password,
          nota_ids
        });
        setShowAssinaturaModal(false);
        setSelectedNotas(new Set());
        fetchNotas();
        if (res.data.assinadas > 0) {
          // Sucesso silencioso
        }
      } else {
        // Assinatura individual
        await api.post(`/nota-fiscal-recebimento/${assinaturaData.notaId}/assinar`, {
          tipo: assinaturaData.tipo,
          username: assinaturaData.username,
          password: assinaturaData.password
        });
        setShowAssinaturaModal(false);
        fetchNotas();
      }
    } catch (err) {
      setAssinaturaError(err.response?.data?.error || 'Erro ao assinar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditarNota = (nota) => {
    setEditingNota(nota);
    setNfOracleInfo(null);
    setFormNota({
      num_nota: nota.num_nota,
      fornecedor: nota.fornecedor,
      cod_fornecedor: nota.cod_fornecedor,
      data_recebimento: nota.data_recebimento,
      hora_recebimento: nota.hora_recebimento,
      valor_nota: nota.valor_nota?.toString() || ''
    });
    setFormFornecedorSearch(nota.fornecedor || '');
    const forn = fornecedoresList.find(f => f.cod === nota.cod_fornecedor || parseInt(f.cod) === nota.cod_fornecedor);
    setFormCnpjSearch(forn?.cnpj ? formatCnpj(forn.cnpj) : '');
    setShowNovaModal(true);
  };

  // Lote selection helpers
  const toggleSelectNota = (id) => {
    setSelectedNotas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNotas.size === notas.length) {
      setSelectedNotas(new Set());
    } else {
      setSelectedNotas(new Set(notas.map(n => n.id)));
    }
  };

  const tipoLabels = { conferente: 'CONFERENTE', cpd: 'CPD', financeiro: 'FINANCEIRO' };

  const getEntradaStatus = (nota) => {
    const key = `${nota.num_nota}_${nota.cod_fornecedor}`;
    const keySimple = `${nota.num_nota}`;
    return entradasMap[key] || entradasMap[keySimple] || null;
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-';
    return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDateTime = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout>
      <main className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Prevenção Recebimento - Notas Fiscais</h1>
              <p className="text-sm text-gray-500">Registre e controle o recebimento de notas fiscais com assinatura digital</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingNota(null);
              setFormNota({
                num_nota: '',
                fornecedor: '',
                cod_fornecedor: null,
                data_recebimento: new Date().toISOString().split('T')[0],
                hora_recebimento: new Date().toTimeString().slice(0, 5),
                valor_nota: ''
              });
              setFormFornecedorSearch('');
              setFormCnpjSearch('');
              setNfOracleInfo(null);
              setShowNovaModal(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-medium flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nova Nota Fiscal
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data De</label>
              <input
                type="date"
                value={filters.data_de}
                onChange={(e) => setFilters({ ...filters, data_de: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data Até</label>
              <input
                type="date"
                value={filters.data_ate}
                onChange={(e) => setFilters({ ...filters, data_ate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor</label>
              <input
                type="text"
                value={fornecedorSearch}
                onChange={(e) => {
                  setFornecedorSearch(e.target.value);
                  setShowFornecedorDropdown(true);
                  if (!e.target.value) setFilters({ ...filters, fornecedor: '' });
                }}
                onFocus={() => setShowFornecedorDropdown(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Buscar fornecedor..."
              />
              {showFornecedorDropdown && fornecedorSearch && filteredFornecedores.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFornecedorSearch('');
                      setFilters({ ...filters, fornecedor: '' });
                      setShowFornecedorDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-orange-50 border-b"
                  >
                    Limpar filtro
                  </button>
                  {filteredFornecedores.map(f => (
                    <button
                      key={f.cod}
                      onClick={() => {
                        setFornecedorSearch(f.nome);
                        setFilters({ ...filters, fornecedor: f.nome });
                        setShowFornecedorDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                    >
                      <div className="truncate">{f.nome}</div>
                      <div className="text-gray-400 text-[10px]">{f.cod} {f.cnpj ? `- ${formatCnpj(f.cnpj)}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Conferente</label>
              <select
                value={filters.conferente}
                onChange={(e) => setFilters({ ...filters, conferente: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todos</option>
                {colaboradores.conferentes?.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CPD</label>
              <select
                value={filters.cpd}
                onChange={(e) => setFilters({ ...filters, cpd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todos</option>
                {colaboradores.cpds?.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Financeiro</label>
              <select
                value={filters.financeiro}
                onChange={(e) => setFilters({ ...filters, financeiro: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todos</option>
                {colaboradores.financeiros?.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Barra de assinatura em lote */}
        {selectedNotas.size > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">
                {selectedNotas.size} nota(s) selecionada(s)
              </span>
              <button
                onClick={() => setSelectedNotas(new Set())}
                className="text-white/70 hover:text-white text-xs underline"
              >
                Limpar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-xs mr-2">Assinar em lote:</span>
              <button
                onClick={() => handleAbrirAssinaturaLote('conferente')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                CONFERENTE
              </button>
              <button
                onClick={() => handleAbrirAssinaturaLote('cpd')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                CPD
              </button>
              <button
                onClick={() => handleAbrirAssinaturaLote('financeiro')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                FINANCEIRO
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[78vh]">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-orange-500 to-amber-500 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap w-[50px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px]">LOTE</span>
                      <input
                        type="checkbox"
                        checked={notas.length > 0 && selectedNotas.size === notas.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-white/50 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white text-xs whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left font-medium text-white text-xs whitespace-nowrap">N° da Nota</th>
                  <th className="px-3 py-2.5 text-left font-medium text-white text-xs whitespace-nowrap">FORNECEDOR</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap">Data Recebimento</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap">Hora</th>
                  <th className="px-3 py-2.5 text-right font-medium text-white text-xs whitespace-nowrap">Valor da Nota</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap min-w-[130px]">ENTRADA DE NOTA</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap min-w-[180px]">CONFERENTE</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap min-w-[180px]">Visto CPD</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap min-w-[180px]">Visto FINANCEIRO</th>
                  <th className="px-3 py-2.5 text-center font-medium text-white text-xs whitespace-nowrap w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Carregando...
                      </div>
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-gray-400">
                      Nenhuma nota fiscal registrada para o periodo selecionado
                    </td>
                  </tr>
                ) : (
                  notas.map((nota, idx) => {
                    const temAssinatura = nota.conferente_nome || nota.cpd_nome || nota.financeiro_nome;
                    const todasAssinaturas = nota.conferente_nome && nota.cpd_nome && nota.financeiro_nome;
                    const isSelected = selectedNotas.has(nota.id);
                    return (
                    <tr key={nota.id} className={`${
                      isSelected ? 'bg-blue-50' :
                      todasAssinaturas ? (idx % 2 === 0 ? 'bg-green-50/40' : 'bg-green-50/20') :
                      !temAssinatura ? (idx % 2 === 0 ? 'bg-gray-100/80' : 'bg-gray-50/80') :
                      (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')
                    } hover:bg-orange-50/50 transition-colors`}>
                      {/* LOTE checkbox */}
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectNota(nota.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{nota.num_nota}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-xs">{nota.fornecedor}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700 text-xs">
                        {nota.data_recebimento ? new Date(nota.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-700 text-xs">{nota.hora_recebimento || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-xs">{formatCurrency(nota.valor_nota)}</td>

                      {/* ENTRADA DE NOTA */}
                      <td className="px-3 py-2.5 text-center">
                        {(() => {
                          const entrada = getEntradaStatus(nota);
                          if (!entrada) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                PENDENTE
                              </span>
                            );
                          }
                          if (entrada.efetivada) {
                            return (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-800 border border-green-300">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  FINALIZADA
                                </span>
                                {entrada.data_entrada && (
                                  <div className="text-[10px] text-green-600 mt-0.5">{formatDateTime(entrada.data_entrada)}</div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                              PENDENTE
                            </span>
                          );
                        })()}
                      </td>

                      {/* CONFERENTE */}
                      <td className={`px-3 py-2.5 text-center ${!nota.conferente_nome ? 'bg-gray-200' : ''}`}>
                        {nota.conferente_nome ? (
                          <div>
                            <span className="text-green-700 font-bold text-base">{nota.conferente_nome}</span>
                            <div className="text-xs text-green-600 font-semibold">ASSINADO VIA SENHA PESSOAL</div>
                            <div className="text-[11px] text-green-500">{formatDateTime(nota.conferente_assinado_em)}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAbrirAssinatura(nota.id, 'conferente')}
                            className="px-3 py-1 bg-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-400 hover:text-gray-800 transition-colors"
                          >
                            Assinar
                          </button>
                        )}
                      </td>

                      {/* CPD */}
                      <td className={`px-3 py-2.5 text-center ${!nota.cpd_nome ? 'bg-gray-200' : ''}`}>
                        {nota.cpd_nome ? (
                          <div>
                            <span className="text-green-700 font-bold text-base">{nota.cpd_nome}</span>
                            <div className="text-xs text-green-600 font-semibold">ASSINADO VIA SENHA PESSOAL</div>
                            <div className="text-[11px] text-green-500">{formatDateTime(nota.cpd_assinado_em)}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAbrirAssinatura(nota.id, 'cpd')}
                            className="px-3 py-1 bg-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-400 hover:text-gray-800 transition-colors"
                          >
                            Assinar
                          </button>
                        )}
                      </td>

                      {/* FINANCEIRO */}
                      <td className={`px-3 py-2.5 text-center ${!nota.financeiro_nome ? 'bg-gray-200' : ''}`}>
                        {nota.financeiro_nome ? (
                          <div>
                            <span className="text-green-700 font-bold text-base">{nota.financeiro_nome}</span>
                            <div className="text-xs text-green-600 font-semibold">ASSINADO VIA SENHA PESSOAL</div>
                            <div className="text-[11px] text-green-500">{formatDateTime(nota.financeiro_assinado_em)}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAbrirAssinatura(nota.id, 'financeiro')}
                            className="px-3 py-1 bg-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-400 hover:text-gray-800 transition-colors"
                          >
                            Assinar
                          </button>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditarNota(nota)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleExcluirNota(nota.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Total */}
          {notas.length > 0 && (
            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">{notas.length} nota(s) encontrada(s)</span>
              <span className="font-bold text-orange-700 text-base">
                Total: {formatCurrency(notas.reduce((sum, n) => sum + parseFloat(n.valor_nota || 0), 0))}
              </span>
            </div>
          )}
        </div>

        {/* Modal Nova/Editar Nota */}
        {showNovaModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-xl px-6 py-4 flex items-center gap-3">
                <span className="text-2xl">{editingNota ? '📝' : '📄'}</span>
                <h3 className="text-lg font-semibold text-white">
                  {editingNota ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {/* N° da Nota */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° da Nota *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formNota.num_nota}
                      onChange={(e) => {
                        setFormNota({ ...formNota, num_nota: e.target.value });
                        if (nfOracleInfo) setNfOracleInfo(null);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== nfOracleInfo?.num_nf?.toString()) {
                          buscarNfOracle(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          const val = formNota.num_nota.trim();
                          if (val && val !== nfOracleInfo?.num_nf?.toString()) {
                            buscarNfOracle(val);
                          }
                        }
                      }}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                        nfOracleInfo?.found ? 'border-green-400 bg-green-50' :
                        nfOracleInfo?.found === false ? 'border-yellow-400 bg-yellow-50' :
                        'border-gray-300'
                      }`}
                      placeholder="Digite o numero da NF e pressione Tab..."
                      autoFocus
                    />
                    {buscandoNf && (
                      <div className="absolute right-3 top-2.5">
                        <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                    {!buscandoNf && nfOracleInfo?.found && (
                      <div className="absolute right-3 top-2.5 text-green-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {nfOracleInfo?.found && (
                    <div className="mt-1.5 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">NF encontrada no sistema!</span>
                        {!nfOracleInfo.tem_cadastro && (
                          <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">Fornecedor sem cadastro</span>
                        )}
                        {nfOracleInfo.tem_cadastro && (
                          <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">Fornecedor vinculado</span>
                        )}
                      </div>
                    </div>
                  )}
                  {nfOracleInfo?.found === false && (
                    <div className="mt-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-yellow-700">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-semibold">NF nao encontrada no Oracle - preencha manualmente</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Valor da Nota + CNPJ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Nota *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formNota.valor_nota}
                      onChange={(e) => setFormNota({ ...formNota, valor_nota: e.target.value })}
                      readOnly={!!nfOracleInfo?.found}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${nfOracleInfo?.found ? 'bg-gray-100 text-gray-700 border-gray-200' : 'border-gray-300'}`}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ do Fornecedor</label>
                    <input
                      type="text"
                      value={formCnpjSearch}
                      readOnly={!!nfOracleInfo?.found}
                      onChange={(e) => {
                        if (nfOracleInfo?.found) return;
                        const val = e.target.value;
                        setFormCnpjSearch(val);
                        setShowCnpjDropdown(true);
                        const digits = val.replace(/\D/g, '');
                        if (digits.length >= 14) {
                          const match = fornecedoresList.find(f => f.cnpj?.replace(/\D/g, '') === digits);
                          if (match) {
                            setFormCnpjSearch(formatCnpj(match.cnpj));
                            setFormFornecedorSearch(match.nome);
                            setFormNota({ ...formNota, fornecedor: match.nome, cod_fornecedor: parseInt(match.cod) || null });
                            setShowCnpjDropdown(false);
                          }
                        }
                      }}
                      onFocus={() => !nfOracleInfo?.found && setShowCnpjDropdown(true)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${nfOracleInfo?.found ? 'bg-gray-100 text-gray-700 border-gray-200' : 'border-gray-300'}`}
                      placeholder="Digite o CNPJ..."
                    />
                    {!nfOracleInfo?.found && showCnpjDropdown && formCnpjSearch && filteredCnpjFornecedores.length > 0 && (
                      <div className="absolute z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ width: 'calc(50% - 8px)' }}>
                        {filteredCnpjFornecedores.map(f => (
                          <button
                            key={f.cod}
                            onClick={() => {
                              setFormCnpjSearch(formatCnpj(f.cnpj));
                              setFormFornecedorSearch(f.nome);
                              setFormNota({ ...formNota, fornecedor: f.nome, cod_fornecedor: parseInt(f.cod) || null });
                              setShowCnpjDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                          >
                            <div className="font-medium text-orange-700">{formatCnpj(f.cnpj)}</div>
                            <div className="text-gray-600 text-xs truncate">{f.nome}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fornecedor */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor *</label>
                  <input
                    type="text"
                    value={formFornecedorSearch}
                    readOnly={!!nfOracleInfo?.found}
                    onChange={(e) => {
                      if (nfOracleInfo?.found) return;
                      setFormFornecedorSearch(e.target.value);
                      setFormNota({ ...formNota, fornecedor: e.target.value, cod_fornecedor: null });
                      setShowFormFornecedorDropdown(true);
                    }}
                    onFocus={() => !nfOracleInfo?.found && setShowFormFornecedorDropdown(true)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                      nfOracleInfo?.found ? 'bg-gray-100 text-gray-700 border-gray-200' :
                      formNota.cod_fornecedor ? 'border-green-400 bg-green-50' : 'border-gray-300'
                    }`}
                    placeholder="Buscar por nome ou codigo..."
                  />
                  {formNota.cod_fornecedor && !nfOracleInfo?.found && (
                    <span className="absolute right-3 top-8 text-green-600 text-xs">Vinculado</span>
                  )}
                  {!nfOracleInfo?.found && showFormFornecedorDropdown && formFornecedorSearch && !formNota.cod_fornecedor && filteredFormFornecedores.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredFormFornecedores.map(f => (
                        <button
                          key={f.cod}
                          onClick={() => {
                            setFormFornecedorSearch(f.nome);
                            setFormCnpjSearch(f.cnpj ? formatCnpj(f.cnpj) : '');
                            setFormNota({ ...formNota, fornecedor: f.nome, cod_fornecedor: parseInt(f.cod) || null });
                            setShowFormFornecedorDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                        >
                          <div className="truncate">{f.nome}</div>
                          <div className="text-gray-400 text-[10px]">{f.cod} {f.cnpj ? `- ${formatCnpj(f.cnpj)}` : ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Recebimento</label>
                    <input
                      type="date"
                      value={formNota.data_recebimento}
                      onChange={(e) => setFormNota({ ...formNota, data_recebimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora Recebimento</label>
                    <input
                      type="time"
                      value={formNota.hora_recebimento}
                      onChange={(e) => setFormNota({ ...formNota, hora_recebimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => { setShowNovaModal(false); setEditingNota(null); setFormFornecedorSearch(''); setFormCnpjSearch(''); setNfOracleInfo(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarNota}
                  disabled={submitting || !formNota.num_nota || !formNota.fornecedor || !formNota.valor_nota}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Assinatura (individual ou lote) */}
        {showAssinaturaModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-xl px-6 py-4 flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {assinaturaData.isLote ? 'Assinatura em Lote' : 'Assinatura Digital'}
                  </h3>
                  <p className="text-white/80 text-xs">
                    {assinaturaData.isLote
                      ? `Assinar ${selectedNotas.size} nota(s) como ${tipoLabels[assinaturaData.tipo]}`
                      : `Assinar como ${tipoLabels[assinaturaData.tipo]}`
                    }
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {assinaturaError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {assinaturaError}
                  </div>
                )}
                {assinaturaData.isLote && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <span className="font-semibold">{selectedNotas.size} notas</span> serao assinadas como <span className="font-semibold">{tipoLabels[assinaturaData.tipo]}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                  {(() => {
                    const listaColabs = assinaturaData.tipo === 'conferente' ? colaboradores.conferentes
                      : assinaturaData.tipo === 'cpd' ? colaboradores.cpds
                      : colaboradores.financeiros;
                    return (listaColabs && listaColabs.length > 0) ? (
                      <select
                        value={assinaturaData.username}
                        onChange={(e) => setAssinaturaData({ ...assinaturaData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Selecione o colaborador...</option>
                        {listaColabs.map(c => (
                          <option key={c.id} value={c.username}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={assinaturaData.username}
                          onChange={(e) => setAssinaturaData({ ...assinaturaData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Seu usuario"
                          autoComplete="off"
                        />
                        <p className="text-[10px] text-yellow-600 mt-1">Nenhum colaborador com flag de {tipoLabels[assinaturaData.tipo]} cadastrado</p>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input
                    type="password"
                    value={assinaturaData.password}
                    onChange={(e) => setAssinaturaData({ ...assinaturaData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Sua senha"
                    autoComplete="new-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAssinar(); }}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowAssinaturaModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssinar}
                  disabled={submitting || !assinaturaData.username || !assinaturaData.password}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Validando...' : assinaturaData.isLote ? `Assinar ${selectedNotas.size} Notas` : 'Assinar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
