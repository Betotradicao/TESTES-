import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

const BoletoDDA = () => {
  const [loading, setLoading] = useState(false);
  const [boletos, setBoletos] = useState([]);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });

  // Bank selector
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');

  // Date filter - dia 1 do mês atual até hoje
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [initialDate, setInitialDate] = useState(firstDay);
  const [finalDate, setFinalDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedCode, setCopiedCode] = useState(null);

  // Load banks
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const response = await api.get('/bank-accounts');
        const banks = response.data?.data || response.data || [];
        const activeBanks = (Array.isArray(banks) ? banks : []).filter(b => b.ativo && b.certificate_path);
        setBanks(activeBanks);
        if (activeBanks.length > 0) {
          setSelectedBankId(activeBanks[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar bancos:', err);
      }
    };
    loadBanks();
  }, []);

  // Fetch boletos
  const fetchBoletos = useCallback(async () => {
    if (!selectedBankId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/dda/boletos', {
        params: {
          bankId: selectedBankId,
          initialDate,
          finalDate,
          status: statusFilter
        },
        timeout: 60000
      });

      setBoletos(response.data?.boletos || []);
    } catch (err) {
      console.error('Erro ao buscar boletos DDA:', err);
      if (err.response?.status === 403) {
        setError('Sem permissão para acessar DDA. O produto "Pagamento de Contas" precisa estar habilitado no portal Santander.');
      } else {
        setError(err.response?.data?.details || err.message || 'Erro ao buscar boletos');
      }
      setBoletos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBankId, initialDate, finalDate, statusFilter]);

  // Auto-fetch when bank changes
  useEffect(() => {
    if (selectedBankId) {
      fetchBoletos();
    }
  }, [selectedBankId]);

  // Format helpers
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatCNPJ = (doc) => {
    if (!doc) return '-';
    const str = String(doc).padStart(14, '0');
    if (str.length === 14) {
      return `${str.slice(0,2)}.${str.slice(2,5)}.${str.slice(5,8)}/${str.slice(8,12)}-${str.slice(12)}`;
    }
    if (str.length === 11) {
      return `${str.slice(0,3)}.${str.slice(3,6)}.${str.slice(6,9)}-${str.slice(9)}`;
    }
    return str;
  };

  const getStatusInfo = (boleto) => {
    const dueDate = new Date(boleto.dueDate + 'T00:00:00');
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (dueDate < todayDate) {
      return { label: 'Vencido', color: 'text-red-600', bg: 'bg-red-100' };
    }
    if (dueDate.toDateString() === todayDate.toDateString()) {
      return { label: 'Vence Hoje', color: 'text-amber-600', bg: 'bg-amber-100' };
    }
    return { label: 'A Vencer', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const parseNominalValue = (val) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(',', '.')) || 0;
  };

  // Sort
  const sortedBoletos = useMemo(() => {
    const sorted = [...boletos].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'dueDate':
          aVal = a.dueDate || '';
          bVal = b.dueDate || '';
          break;
        case 'beneficiary':
          aVal = (a.beneficiary?.beneficiaryName || '').trim().toLowerCase();
          bVal = (b.beneficiary?.beneficiaryName || '').trim().toLowerCase();
          break;
        case 'valor':
          aVal = parseNominalValue(a.nominalValue);
          bVal = parseNominalValue(b.nominalValue);
          break;
        case 'status':
          aVal = getStatusInfo(a).label;
          bVal = getStatusInfo(b).label;
          break;
        default:
          aVal = a[sortConfig.key] || '';
          bVal = b[sortConfig.key] || '';
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [boletos, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Summary
  const summary = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let totalValor = 0;
    let aVencer = 0;
    let vencidos = 0;
    let valorAVencer = 0;
    let valorVencidos = 0;

    boletos.forEach(b => {
      const val = parseNominalValue(b.nominalValue);
      totalValor += val;
      const dueDate = new Date(b.dueDate + 'T00:00:00');
      if (dueDate < todayDate) {
        vencidos++;
        valorVencidos += val;
      } else {
        aVencer++;
        valorAVencer += val;
      }
    });

    return { total: boletos.length, totalValor, aVencer, vencidos, valorAVencer, valorVencidos };
  }, [boletos]);

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const SortIcon = ({ columnKey }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <span className="inline-flex flex-col ml-1">
        <svg width="8" height="5" viewBox="0 0 8 5" className={`${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-gray-300'}`}>
          <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
        </svg>
        <svg width="8" height="5" viewBox="0 0 8 5" className={`mt-0.5 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-gray-300'}`}>
          <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
        </svg>
      </span>
    );
  };

  const selectedBank = banks.find(b => b.id === selectedBankId);

  return (
    <Layout>
      <div className="p-4 md:p-6 w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2.5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M6 14h4" />
                  <path d="M14 14h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Boletos DDA</h1>
                <p className="text-white/80 text-sm">
                  Débito Direto Autorizado - Boletos registrados
                  {selectedBank && ` | ${selectedBank.nome}`}
                </p>
              </div>
            </div>
            {/* Total */}
            <div className="text-right">
              <p className="text-white/70 text-xs">Valor Total</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalValor)}</p>
              <p className="text-white/70 text-xs">{summary.total} boleto{summary.total !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && boletos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
              <p className="text-xs text-orange-500 font-medium">Total Boletos</p>
              <p className="text-2xl font-bold text-orange-700">{summary.total}</p>
              <p className="text-xs text-gray-400">{formatCurrency(summary.totalValor)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
              <p className="text-xs text-green-500 font-medium">A Vencer</p>
              <p className="text-2xl font-bold text-green-700">{summary.aVencer}</p>
              <p className="text-xs text-gray-400">{formatCurrency(summary.valorAVencer)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
              <p className="text-xs text-red-500 font-medium">Vencidos</p>
              <p className="text-2xl font-bold text-red-700">{summary.vencidos}</p>
              <p className="text-xs text-gray-400">{formatCurrency(summary.valorVencidos)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <p className="text-xs text-purple-500 font-medium">Valor Médio</p>
              <p className="text-2xl font-bold text-purple-700">
                {summary.total > 0 ? formatCurrency(summary.totalValor / summary.total) : 'R$ 0,00'}
              </p>
              <p className="text-xs text-gray-400">por boleto</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            {banks.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[200px]"
                >
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedBank && (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">CNPJ</p>
                  <p className="text-sm font-mono font-medium text-gray-700">{formatCNPJ(selectedBank.cnpj) || '-'}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">Agência</p>
                  <p className="text-sm font-mono font-medium text-gray-700">{selectedBank.agencia || '-'}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">Conta</p>
                  <p className="text-sm font-mono font-medium text-gray-700">{selectedBank.conta || '-'}</p>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Inicial</label>
              <input
                type="date"
                value={initialDate}
                onChange={(e) => setInitialDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Final</label>
              <input
                type="date"
                value={finalDate}
                onChange={(e) => setFinalDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ALL">Todos</option>
                <option value="OPEN_TO_EXPIRE">A Vencer</option>
                <option value="OPEN_EXPIRED">Vencidos</option>
                <option value="SCHEDULED">Agendados</option>
                <option value="PAID">Pagos</option>
                <option value="ISSUED">Baixados</option>
              </select>
            </div>
            <button
              onClick={fetchBoletos}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              )}
              Consultar
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Conta</th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('dueDate')}
                  >
                    <span className="flex items-center">Vencimento <SortIcon columnKey="dueDate" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('beneficiary')}
                  >
                    <span className="flex items-center">Beneficiário <SortIcon columnKey="beneficiary" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">CNPJ/CPF</th>
                  <th
                    className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('valor')}
                  >
                    <span className="flex items-center justify-end">Valor <SortIcon columnKey="valor" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-center font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center justify-center">Status <SortIcon columnKey="status" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Limite Pgto</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Código de Barras</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton loading
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sortedBoletos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <svg className="mx-auto mb-3 w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="6" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                      </svg>
                      <p className="font-medium">Nenhum boleto encontrado</p>
                      <p className="text-xs mt-1">Ajuste os filtros ou selecione outro banco</p>
                    </td>
                  </tr>
                ) : (
                  sortedBoletos.map((boleto, idx) => {
                    const status = getStatusInfo(boleto);
                    const benefName = (boleto.beneficiary?.beneficiaryName || '').trim();
                    const benefDoc = boleto.beneficiary?.beneficiaryDocument;
                    const code = boleto.code || '';

                    return (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {selectedBank?.nome || '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {formatDate(boleto.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-700" title={benefName}>
                          {benefName.length > 35 ? benefName.substring(0, 35) + '...' : benefName}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {formatCNPJ(benefDoc)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                          {formatCurrency(parseNominalValue(boleto.nominalValue))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                          {formatDate(boleto.paymentLimitDate)}
                        </td>
                        <td className="px-4 py-3">
                          {code && (
                            <button
                              onClick={() => copyToClipboard(code)}
                              className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-colors ${
                                copiedCode === code
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-orange-700'
                              }`}
                              title={code}
                            >
                              {copiedCode === code ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  {code.substring(0, 20)}...
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer summary */}
        {!loading && boletos.length > 0 && (
          <div className="mt-4 bg-gray-800 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-gray-400 text-xs">A Vencer</span>
                  <p className="font-bold text-green-400">{summary.aVencer} boletos = {formatCurrency(summary.valorAVencer)}</p>
                </div>
                <div className="text-gray-500">+</div>
                <div>
                  <span className="text-gray-400 text-xs">Vencidos</span>
                  <p className="font-bold text-red-400">{summary.vencidos} boletos = {formatCurrency(summary.valorVencidos)}</p>
                </div>
                <div className="text-gray-500">=</div>
                <div>
                  <span className="text-gray-400 text-xs">Total</span>
                  <p className="font-bold text-orange-400">{summary.total} boletos = {formatCurrency(summary.totalValor)}</p>
                </div>
              </div>
              <div className="text-gray-400 text-xs">
                {selectedBank && `${selectedBank.nome} | Ag. ${selectedBank.agencia} | Conta ${selectedBank.conta}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BoletoDDA;
