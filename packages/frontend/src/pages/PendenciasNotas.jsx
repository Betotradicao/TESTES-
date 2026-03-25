import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

export default function PendenciasNotas() {
  const { lojaSelecionada } = useLoja();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedNf, setExpandedNf] = useState({});
  const [itensCache, setItensCache] = useState({});

  const hoje = new Date().toISOString().split('T')[0];
  const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(mesAtras);
  const [dataFim, setDataFim] = useState(hoje);
  const [fornecedor, setFornecedor] = useState('');
  const [numNf, setNumNf] = useState('');
  const [manifesto, setManifesto] = useState('todos');
  const [statusNfe, setStatusNfe] = useState('todos');

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);
      if (fornecedor) params.append('fornecedor', fornecedor);
      if (numNf) params.append('numNf', numNf);
      if (manifesto !== 'todos') params.append('manifesto', manifesto);
      if (statusNfe !== 'todos') params.append('statusNfe', statusNfe);

      const res = await api.get(`/pendencias-notas?${params.toString()}`);
      if (res.data.success) {
        setNotas(res.data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, fornecedor, numNf, manifesto, statusNfe, lojaSelecionada]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const toggleNf = async (nota) => {
    const key = nota.idNota;
    if (expandedNf[key]) {
      setExpandedNf(prev => ({ ...prev, [key]: false }));
      return;
    }
    if (!itensCache[key]) {
      try {
        const res = await api.get(`/pendencias-notas/${nota.idNota}/itens`);
        if (res.data.success) {
          setItensCache(prev => ({ ...prev, [key]: res.data.data }));
        }
      } catch (err) {
        console.error('Erro ao buscar itens:', err);
      }
    }
    setExpandedNf(prev => ({ ...prev, [key]: true }));
  };

  const formatCurrency = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const manifestoColor = (st) => {
    switch(st) {
      case 0: return 'bg-yellow-100 text-yellow-800';
      case 1: return 'bg-green-100 text-green-700';
      case 2: return 'bg-blue-100 text-blue-700';
      case 3: return 'bg-red-100 text-red-700';
      case 4: return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const nfeColor = (st) => {
    switch(st) {
      case 100: return 'bg-green-100 text-green-700';
      case 101: return 'bg-red-100 text-red-700';
      case 999: return 'bg-red-200 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const totalNotas = notas.length;
  const totalValor = notas.reduce((acc, n) => acc + (n.valorTotal || 0), 0);
  const totalConfirmadas = notas.filter(n => n.statusManifesto === 1).length;
  const totalPendentes = notas.filter(n => n.statusManifesto === 0).length;
  const totalRejeitadas = notas.filter(n => n.statusManifesto === 3 || n.statusManifesto === 4).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <div>
            <h1 className="text-2xl font-bold">Pendencias de Notas</h1>
            <p className="text-white/80 text-sm">Consulte notas fiscais de entrada e status de manifesto</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mx-4 mt-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Inicio</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fornecedor</label>
            <input type="text" value={fornecedor} onChange={e => setFornecedor(e.target.value)}
              placeholder="Nome ou CNPJ..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Numero NF</label>
            <input type="text" value={numNf} onChange={e => setNumNf(e.target.value)}
              placeholder="NF" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Manifesto</label>
            <select value={manifesto} onChange={e => setManifesto(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="todos">Todos</option>
              <option value="0">Pendente</option>
              <option value="1">Confirmada</option>
              <option value="2">Ciencia</option>
              <option value="3">Desconhecida</option>
              <option value="4">Nao Realizada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status NFe</label>
            <select value={statusNfe} onChange={e => setStatusNfe(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="todos">Todos</option>
              <option value="100">Autorizada</option>
              <option value="101">Cancelada</option>
              <option value="999">Rejeitada</option>
            </select>
          </div>
          <div>
            <button onClick={fetchNotas}
              className="w-full bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-orange-600 transition">
              Buscar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mx-4 mb-4">
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
          <p className="text-xs text-gray-500">Total de Notas</p>
          <p className="text-2xl font-bold text-blue-600">{totalNotas}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-500">Valor Total</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalValor)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-400">
          <p className="text-xs text-gray-500">Confirmadas</p>
          <p className="text-2xl font-bold text-green-600">{totalConfirmadas}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-yellow-500">
          <p className="text-xs text-gray-500">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{totalPendentes}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-500">Rejeitadas</p>
          <p className="text-2xl font-bold text-red-600">{totalRejeitadas}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow mx-4 mb-4 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 w-10"></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">NF</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Serie</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Emissao</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Fornecedor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">CNPJ</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Valor</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Status NFe</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Manifesto</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Recebimento</th>
                </tr>
              </thead>
              <tbody>
                {notas.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Nenhuma nota encontrada</td></tr>
                ) : notas.map((nota, idx) => {
                  const key = nota.idNota;
                  const isExpanded = expandedNf[key];
                  const itens = itensCache[key] || [];
                  return (
                    <React.Fragment key={key}>
                      <tr className={`border-b hover:bg-orange-50 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        onClick={() => toggleNf(nota)}>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-lg font-bold ${isExpanded ? 'text-orange-500' : 'text-gray-400'}`}>
                            {isExpanded ? '−' : '+'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-800">{nota.numNf}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{nota.serie || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{formatDate(nota.dtaEmissao)}</td>
                        <td className="px-3 py-3 text-sm text-gray-800 font-medium max-w-[250px] truncate">{nota.fornecedor || '-'}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 font-mono">{nota.cnpj || '-'}</td>
                        <td className="px-3 py-3 text-sm text-right font-semibold text-green-700">{formatCurrency(nota.valorTotal)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${nfeColor(nota.statusNfe)}`}>
                            {nota.statusNfeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${manifestoColor(nota.statusManifesto)}`}>
                            {nota.statusManifestoLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{formatDate(nota.dtaRecebimento)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="bg-orange-50 px-6 py-4">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-xs font-bold text-orange-700">Itens da NF {nota.numNf} ({itens.length} produtos)</p>
                              {nota.chaveAcesso && (
                                <p className="text-[10px] text-gray-400 font-mono">Chave: {nota.chaveAcesso}</p>
                              )}
                            </div>
                            {itens.length === 0 ? (
                              <p className="text-xs text-gray-400">Carregando itens...</p>
                            ) : (
                              <table className="w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                <thead className="bg-orange-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">Codigo</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">EAN</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">Descricao</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">NCM</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold text-orange-800">CFOP</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold text-orange-800">UN</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">Qtd</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">Vlr Unit</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">Vlr Total</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">ICMS</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">PIS</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-orange-800">COFINS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itens.map((item, i) => (
                                    <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                      <td className="px-3 py-1.5 text-xs text-gray-400">{item.numItem}</td>
                                      <td className="px-3 py-1.5 text-xs text-gray-700 font-mono">{item.codProduto}</td>
                                      <td className="px-3 py-1.5 text-xs text-gray-500 font-mono">{item.ean || '-'}</td>
                                      <td className="px-3 py-1.5 text-xs text-gray-800 font-medium">{item.descricao || '-'}</td>
                                      <td className="px-3 py-1.5 text-xs text-gray-500">{item.ncm || '-'}</td>
                                      <td className="px-3 py-1.5 text-xs text-center text-gray-600">{item.cfop || '-'}</td>
                                      <td className="px-3 py-1.5 text-xs text-center text-gray-600">{item.unidade || '-'}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-blue-700 font-semibold">{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-gray-600">{formatCurrency(item.valorUnitario)}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-green-700 font-semibold">{formatCurrency(item.valorTotal)}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-purple-600">{formatCurrency(item.icms)}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-purple-600">{formatCurrency(item.pis)}</td>
                                      <td className="px-3 py-1.5 text-xs text-right text-purple-600">{formatCurrency(item.cofins)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
