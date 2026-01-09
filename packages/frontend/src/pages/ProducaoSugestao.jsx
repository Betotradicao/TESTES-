import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ProducaoSugestao() {
  const navigate = useNavigate();

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAudits, setMonthAudits] = useState([]);

  // Estados da auditoria
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allAudits, setAllAudits] = useState([]);
  const [selectedSecao, setSelectedSecao] = useState('PADARIA');
  const [selectedTipo, setSelectedTipo] = useState('PRODUCAO');

  // Data fixada no dia atual
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate] = useState(todayStr);
  const [auditItems, setAuditItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' ou 'desc'
  const [auditSortField, setAuditSortField] = useState('audit_date');
  const [auditSortOrder, setAuditSortOrder] = useState('desc');

  // Carregar produtos de padaria e auditoria do dia
  useEffect(() => {
    loadBakeryProducts();
    loadTodayAudit();
  }, []);

  // Carregar auditorias do mês
  useEffect(() => {
    loadMonthAudits(currentMonth);
  }, [currentMonth]);

  const loadBakeryProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/production/bakery-products');
      setAllProducts(response.data);
      filterProducts(response.data, selectedSecao, selectedTipo);
    } catch (err) {
      console.error('❌ Erro ao carregar produtos:', err);
      const errorMessage = err.response?.status === 500
        ? '⚠️ Servidor ERP indisponível. Aguarde alguns minutos e tente novamente.'
        : 'Erro ao carregar produtos: ' + (err.response?.data?.error || err.message);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = (allProds, secao, tipo) => {
    const filtered = allProds.filter(p => p.desSecao === secao && p.tipoEvento === tipo);
    setProducts(filtered);
    const initialItems = {};
    filtered.forEach(product => {
      // Usa o production_days pré-configurado do produto, ou 1 como padrão
      initialItems[product.codigo] = { quantity_units: 0, production_days: product.production_days || 1 };
    });
    setAuditItems(initialItems);
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      filterProducts(allProducts, selectedSecao, selectedTipo);
    }
  }, [selectedSecao, selectedTipo]);

  const loadTodayAudit = async () => {
    try {
      // Buscar auditoria do dia atual
      const response = await api.get('/production/audits');
      const allAudits = response.data;

      // Recalcular todayStr dentro da função
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const todayAudit = allAudits.find(audit => {
        const auditDate = new Date(audit.audit_date);
        const auditDateStr = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}-${String(auditDate.getDate()).padStart(2, '0')}`;
        return auditDateStr === currentDateStr;
      });

      if (todayAudit) {
        loadAuditData(todayAudit.id);
      }
    } catch (err) {
      console.error('Erro ao carregar auditoria do dia:', err);
    }
  };

  const loadMonthAudits = async (monthDate) => {
    try {
      const response = await api.get('/production/audits');
      const audits = response.data;

      // Salvar todas as auditorias
      setAllAudits(audits);

      // Filtrar apenas auditorias do mês selecionado
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const filtered = audits.filter(audit => {
        const auditDate = new Date(audit.audit_date);
        return auditDate.getFullYear() === year && auditDate.getMonth() === month;
      });

      setMonthAudits(filtered);
    } catch (err) {
      console.error('Erro ao carregar auditorias do mês:', err);
    }
  };

  // Funções para navegação do calendário
  const prevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const nextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  // Verificar se dia tem auditoria
  const getDayAudit = (day) => {
    return monthAudits.find(audit => {
      const auditDate = new Date(audit.audit_date);
      return auditDate.getDate() === day;
    });
  };

  // Obter cor do dia no calendário
  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const audit = getDayAudit(day);

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia com auditoria concluída - verde claro
    if (audit && audit.status === 'completed') {
      return 'bg-green-100 text-green-800 font-semibold cursor-pointer hover:bg-green-200';
    }

    // Dia com auditoria em andamento - laranja
    if (audit && audit.status === 'in_progress') {
      return 'bg-orange-100 text-orange-800 font-semibold cursor-pointer hover:bg-orange-200';
    }

    // Dia passado sem auditoria - vermelho claro
    return 'bg-red-100 text-red-600';
  };

  // Dia não é mais clicável - data fixa no dia atual
  const handleDayClick = (day) => {
    // Desabilitado - data sempre fixada no dia atual
    return;
  };

  const loadAuditData = async (auditId) => {
    try {
      const response = await api.get(`/production/audits/${auditId}`);
      const audit = response.data;

      // Preencher os campos com os dados da auditoria
      const items = {};
      audit.items.forEach(item => {
        items[item.product_code] = {
          quantity_units: item.quantity_units,
          production_days: item.production_days
        };
      });
      setAuditItems(items);
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    }
  };

  const handleItemChange = (productCode, field, value) => {
    setAuditItems(prev => ({
      ...prev,
      [productCode]: {
        ...prev[productCode],
        [field]: parseInt(value) || 0
      }
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // Filtrar apenas produtos com quantidade > 0
      const items = products
        .filter(p => auditItems[p.codigo]?.quantity_units > 0)
        .map(p => ({
          product_code: p.codigo,
          product_name: p.descricao,
          quantity_units: auditItems[p.codigo].quantity_units,
          production_days: auditItems[p.codigo].production_days,
          unit_weight_kg: p.peso_medio_kg,
          avg_sales_kg: p.vendaMedia || 0,
        }));

      if (items.length === 0) {
        setError('Adicione ao menos um produto com quantidade');
        return;
      }

      // Salvar auditoria
      const response = await api.post('/production/audits', {
        audit_date: selectedDate,
        items
      });

      const auditId = response.data.id;

      // Enviar para WhatsApp
      try {
        await api.post(`/production/audits/${auditId}/send-whatsapp`);
        setSuccess('Auditoria salva e enviada para WhatsApp com sucesso!');
      } catch (whatsappErr) {
        console.error('Erro ao enviar para WhatsApp:', whatsappErr);
        setSuccess('Auditoria salva com sucesso! (Erro ao enviar para WhatsApp)');
      }

      await loadMonthAudits(currentMonth);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao salvar auditoria:', err);
      setError(err.response?.data?.error || 'Erro ao salvar auditoria');
    } finally {
      setLoading(false);
    }
  };

  const handleResendWhatsApp = async (auditId) => {
    try {
      await api.post(`/production/audits/${auditId}/send-whatsapp`);
      alert('Relatório reenviado para WhatsApp com sucesso!');
    } catch (err) {
      console.error('Erro ao reenviar para WhatsApp:', err);
      alert('Erro ao reenviar relatório para WhatsApp');
    }
  };

  const handleDeleteAudit = async (auditId) => {
    if (!confirm('Tem certeza que deseja excluir esta auditoria?')) {
      return;
    }

    try {
      await api.delete(`/production/audits/${auditId}`);
      setSuccess('Auditoria excluída com sucesso!');
      await loadMonthAudits(currentMonth);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao excluir auditoria:', err);
      setError('Erro ao excluir auditoria');
    }
  };

  const handleProductSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleAuditSort = (field) => {
    if (auditSortField === field) {
      setAuditSortOrder(auditSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setAuditSortField(field);
      setAuditSortOrder('asc');
    }
  };

  const getSortedAudits = () => {
    return [...allAudits].sort((a, b) => {
      let aValue, bValue;

      switch (auditSortField) {
        case 'audit_date':
          aValue = new Date(a.audit_date);
          bValue = new Date(b.audit_date);
          break;
        case 'auditor':
          aValue = (a.user?.name || a.user?.username || '').toLowerCase();
          bValue = (b.user?.name || b.user?.username || '').toLowerCase();
          break;
        case 'group':
          aValue = (a.whatsapp_group_name || '').toLowerCase();
          bValue = (b.whatsapp_group_name || '').toLowerCase();
          break;
        case 'total':
          aValue = a.items?.length || 0;
          bValue = b.items?.length || 0;
          break;
        case 'with_suggestion':
          aValue = a.items?.filter(item => (item.suggested_production_units || 0) > 0).length || 0;
          bValue = b.items?.filter(item => (item.suggested_production_units || 0) > 0).length || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return auditSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return auditSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Gerar dias do calendário
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Espaços vazios antes do primeiro dia
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Filtrar e ordenar produtos
  const filteredProducts = products
    .filter(product => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        product.descricao?.toLowerCase().includes(term) ||
        product.codigo?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const nameA = a.descricao?.toLowerCase() || '';
      const nameB = b.descricao?.toLowerCase() || '';
      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">🥖 Sugestão de Produção - Padaria</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Registre o estoque atual e receba sugestões de produção
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Layout: Data Fixa + Formulário */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data do Dia - 1/3 do espaço */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Data da Auditoria</h2>
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {today.getDate()}
              </div>
              <div className="text-sm font-medium text-blue-800 capitalize">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(today)}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(today)}
              </div>
            </div>

            {/* Informação fixa */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p className="font-medium">Auditoria fixada no dia atual</p>
              <p className="text-xs mt-1">A data muda automaticamente todos os dias</p>
            </div>
          </div>

          {/* Formulário de Lançamento - 2/3 do espaço */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Auditoria de {selectedDate.split('-').reverse().join('/')}
              </h2>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Filtros Dinâmicos */}
            <div className="mb-4 flex gap-4 items-center text-sm flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder="🔍 Buscar produto por nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Seção:</span>
                <select
                  value={selectedSecao}
                  onChange={(e) => setSelectedSecao(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {[...new Set(allProducts.map(p => p.desSecao))].sort().map(secao => (
                    <option key={secao} value={secao}>{secao}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Tipo:</span>
                <select
                  value={selectedTipo}
                  onChange={(e) => setSelectedTipo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {[...new Set(allProducts.map(p => p.tipoEvento))].sort().map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                <span className="font-semibold text-gray-700">Total:</span>
                <span className="text-gray-900">{filteredProducts.length} produtos</span>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Código</th>
                    <th
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={handleProductSort}
                    >
                      Produto {sortOrder === 'asc' ? '↑' : '↓'}
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Peso Médio</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Estoque (und)</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Dias Produção</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Venda Média (kg/dia)</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Custo</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Preço</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Margem %</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 bg-green-50">Sugestão (kg)</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 bg-blue-50">Sugestão (und)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map(product => {
                    const estoqueUnidades = auditItems[product.codigo]?.quantity_units || 0;
                    const diasProducao = auditItems[product.codigo]?.production_days || 1;
                    const pesoMedio = product.peso_medio_kg || 0;
                    const estoqueKg = estoqueUnidades * pesoMedio;
                    const vendaMediaKg = product.vendaMedia || 0;
                    const necessidadeKg = vendaMediaKg * diasProducao;
                    const sugestaoKg = Math.max(0, necessidadeKg - estoqueKg);
                    const sugestaoUnidades = pesoMedio > 0 ? Math.ceil(sugestaoKg / pesoMedio) : 0;

                    return (
                    <tr key={product.codigo} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {product.codigo || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="font-medium">{product.descricao}</div>
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                        {product.peso_medio_kg ? `${product.peso_medio_kg.toFixed(3)} kg` : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          value={auditItems[product.codigo]?.quantity_units || ''}
                          onChange={(e) => handleItemChange(product.codigo, 'quantity_units', e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          value={auditItems[product.codigo]?.production_days || ''}
                          onChange={(e) => handleItemChange(product.codigo, 'production_days', e.target.value)}
                          placeholder="1"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-orange-500 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-center text-sm">
                        {product.vendaMedia?.toFixed(3) || '0.000'}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                        {product.custo ? `R$ ${product.custo.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                        {product.preco ? `R$ ${product.preco.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                        {product.custo && product.preco ? `${(((product.preco - product.custo) / product.preco) * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-green-700 bg-green-50">
                        {sugestaoKg.toFixed(3)}
                      </td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-blue-700 bg-blue-50">
                        {sugestaoUnidades}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção de Auditorias Salvas */}
          {allAudits.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Auditorias Salvas</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-base">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleAuditSort('audit_date')}
                      >
                        Data {auditSortField === 'audit_date' && (auditSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleAuditSort('auditor')}
                      >
                        Auditor {auditSortField === 'auditor' && (auditSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleAuditSort('group')}
                      >
                        Grupo WhatsApp {auditSortField === 'group' && (auditSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleAuditSort('total')}
                      >
                        Total {auditSortField === 'total' && (auditSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleAuditSort('with_suggestion')}
                      >
                        Com Sugestão {auditSortField === 'with_suggestion' && (auditSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase">Sem Necessidade</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getSortedAudits().map(audit => {
                        const totalProducts = audit.items?.length || 0;
                        const withSuggestion = audit.items?.filter(item => (item.suggested_production_units || 0) > 0).length || 0;
                        const withoutSuggestion = totalProducts - withSuggestion;

                        return (
                          <tr key={audit.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 text-base text-gray-900 font-medium">
                              {new Date(audit.audit_date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 text-base text-gray-900">
                              {audit.user?.name || audit.user?.username || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-base text-gray-900">
                              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                                {audit.whatsapp_group_name || 'Não enviado'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-base text-center text-gray-900 font-semibold">
                              {totalProducts}
                            </td>
                            <td className="px-6 py-4 text-base text-center">
                              <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                {withSuggestion}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-base text-center">
                              <span className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                                {withoutSuggestion}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-base text-center">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleResendWhatsApp(audit.id)}
                                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-semibold shadow-sm hover:shadow transition"
                                  title="Reenviar para WhatsApp"
                                >
                                  📱 Reenviar
                                </button>
                                <button
                                  onClick={() => handleDeleteAudit(audit.id)}
                                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-semibold shadow-sm hover:shadow transition"
                                  title="Excluir auditoria"
                                >
                                  🗑️ Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
