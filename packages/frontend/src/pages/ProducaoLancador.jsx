import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ProducaoLancador() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentAudits, setRecentAudits] = useState([]);
  const [productCount, setProductCount] = useState(0);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAudits, setMonthAudits] = useState({});

  useEffect(() => {
    loadRecentAudits();
    loadMonthAudits(currentMonth);
    loadProductCount();
  }, []);

  useEffect(() => {
    loadMonthAudits(currentMonth);
  }, [currentMonth]);

  const loadProductCount = async () => {
    try {
      const response = await api.get('/production/bakery-products');
      setProductCount(response.data.length);
    } catch (err) {
      console.error('Erro ao carregar contagem de produtos:', err);
    }
  };

  const loadRecentAudits = async () => {
    try {
      const response = await api.get('/production/audits');
      setRecentAudits(response.data.slice(0, 5));
    } catch (err) {
      console.error('Erro ao carregar auditorias:', err);
    }
  };

  const loadMonthAudits = async (monthDate) => {
    try {
      const response = await api.get('/production/audits');
      const allAudits = response.data || [];

      // Agrupar por data
      const grouped = {};
      for (const audit of allAudits) {
        const dateKey = String(audit.audit_date).split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(audit);
      }

      // Filtrar apenas do mês atual
      const year = monthDate.getFullYear();
      const month = String(monthDate.getMonth() + 1).padStart(2, '0');
      const filtered = {};
      for (const [dateKey, audits] of Object.entries(grouped)) {
        if (dateKey.startsWith(`${year}-${month}`)) {
          filtered[dateKey] = audits;
        }
      }

      setMonthAudits(filtered);
    } catch (err) {
      console.error('Erro ao carregar auditorias do mês:', err);
    }
  };

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

  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dayAudits = getDayAudits(day);
    const hasAudits = dayAudits.length > 0;

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia com auditoria
    if (hasAudits) {
      const hasCompleted = dayAudits.some(a => a.status === 'completed');
      const hasInProgress = dayAudits.some(a => a.status === 'in_progress');

      if (hasCompleted) {
        return 'bg-green-100 text-green-800 font-semibold';
      }
      if (hasInProgress) {
        return 'bg-yellow-100 text-yellow-800 font-semibold';
      }
    }

    // Dia passado sem auditoria - vermelho claro
    return 'bg-red-100 text-red-600';
  };

  const getDayAudits = (day) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${month}-${dayStr}`;
    return monthAudits[dateKey] || [];
  };

  const handleCreateAudit = async () => {
    setLoading(true);
    setError('');

    try {
      // Verificar se já existe auditoria para hoje
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const existingAudit = recentAudits.find(a => {
        const auditDate = String(a.audit_date).split('T')[0];
        return auditDate === todayStr;
      });

      if (existingAudit) {
        // Redirecionar para auditoria existente
        navigate(`/producao-sugestao`);
      } else {
        // Navegar direto para tela de auditoria (ela cria a auditoria ao salvar primeiro item)
        navigate(`/producao-sugestao`);
      }
    } catch (err) {
      console.error('Erro ao criar auditoria:', err);
      setError(err.response?.data?.error || 'Erro ao criar auditoria');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAudit = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta auditoria?')) {
      return;
    }

    try {
      await api.delete(`/production/audits/${id}`);
      await loadRecentAudits();
      await loadMonthAudits(currentMonth);
      setSuccess('Auditoria excluída com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir auditoria');
    }
  };

  const handleSendWhatsApp = async (id) => {
    try {
      setLoading(true);
      await api.post(`/production/audits/${id}/send-whatsapp`);
      setSuccess('Relatório enviado para WhatsApp com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar para WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  // Formatar data sem conversão de timezone
  const formatAuditDate = (dateStr) => {
    if (!dateStr) return '-';
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pendente</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Em Andamento</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Finalizada</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  return (
    <Layout title="Sugestão Produção Padaria">
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">🥖 Sugestão Produção Padaria</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Registre o estoque atual e receba sugestões de produção baseadas na venda média
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

        {/* Layout: Botão Gerar + Calendário */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Área de Nova Auditoria - 2/3 do espaço */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nova Auditoria</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-5xl mb-3">🥖</div>
              <p className="text-base font-semibold text-gray-700 mb-1">
                Gerar Auditoria de Produção
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {productCount > 0 ? `${productCount} produtos ativos para conferir` : 'Carregando produtos...'}
              </p>

              <button
                onClick={handleCreateAudit}
                disabled={loading || productCount === 0}
                className="px-8 py-4 bg-orange-600 text-white text-lg font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Carregando...' : '🚀 Iniciar Auditoria'}
              </button>
            </div>

            {/* Informações */}
            <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 mb-2">ℹ️ Como funciona</h3>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>• Você informará o <strong>estoque atual em unidades</strong> de cada produto</li>
                <li>• O sistema calculará automaticamente a <strong>sugestão de produção</strong> baseada na venda média</li>
                <li>• Você pode ajustar os <strong>dias de produção</strong> para cada item</li>
                <li>• Ao finalizar, pode <strong>enviar o relatório para o WhatsApp</strong></li>
              </ul>
            </div>
          </div>

          {/* Calendário - 1/3 do espaço */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Mês anterior"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>

              <h3 className="text-sm font-bold text-gray-800 capitalize">
                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>

              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Próximo mês"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* Grade do Calendário */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                <div key={idx} className="text-center font-semibold text-gray-500 text-xs py-0.5">
                  {day}
                </div>
              ))}

              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];

                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`empty-${i}`} className=""></div>);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const dayAudits = getDayAudits(day);
                  const colorClass = getDayColor(day);

                  days.push(
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center rounded text-xs font-semibold cursor-pointer transition-all hover:shadow-md ${colorClass}`}
                      title={dayAudits.length > 0 ? `${dayAudits.length} auditoria(s)` : 'Sem auditorias'}
                    >
                      {day}
                    </div>
                  );
                }

                return days;
              })()}
            </div>

            {/* Lista de auditorias do mês */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                📋 Auditorias ({Object.values(monthAudits).flat().length})
              </h4>

              {Object.values(monthAudits).flat().length === 0 ? (
                <p className="text-gray-400 text-center py-3 text-xs">
                  Nenhuma auditoria este mês
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.values(monthAudits).flat().map((audit) => (
                    <div
                      key={audit.id}
                      className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/producao-sugestao`)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-800 text-xs">
                          {formatAuditDate(audit.audit_date)}
                        </span>
                        {getStatusBadge(audit.status)}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {audit.items?.length || 0} itens conferidos
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Auditorias Recentes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Auditorias Recentes</h2>

          {recentAudits.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma auditoria criada ainda
            </p>
          ) : (
            <div className="space-y-4">
              {recentAudits.map((audit) => {
                // Calcular totais
                const totalItems = audit.items?.length || 0;
                const totalSugestaoKg = audit.items?.reduce((acc, item) => acc + (parseFloat(item.suggested_production_kg) || 0), 0) || 0;
                const totalSugestaoUnd = audit.items?.reduce((acc, item) => acc + (parseInt(item.suggested_production_units) || 0), 0) || 0;

                return (
                  <div
                    key={audit.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {formatAuditDate(audit.audit_date)}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(audit.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Itens Conferidos</p>
                        <p className="font-semibold text-gray-700">{totalItems}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Sugestão Total (kg)</p>
                        <p className="font-semibold text-green-700">
                          {totalSugestaoKg.toFixed(2)} kg
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Sugestão Total (und)</p>
                        <p className="font-semibold text-blue-700">
                          {totalSugestaoUnd} unidades
                        </p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/producao-sugestao`)}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                      >
                        {audit.status === 'completed' ? '📊 Ver Detalhes' : '✏️ Continuar'}
                      </button>
                      {audit.status === 'completed' && (
                        <button
                          onClick={() => handleSendWhatsApp(audit.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                          📱 Enviar WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAudit(audit.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        title="Excluir auditoria"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
