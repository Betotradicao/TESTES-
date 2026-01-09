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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditItems, setAuditItems] = useState({});

  // Carregar produtos de padaria
  useEffect(() => {
    loadBakeryProducts();
  }, []);

  // Carregar auditorias do mês
  useEffect(() => {
    loadMonthAudits(currentMonth);
  }, [currentMonth]);

  const loadBakeryProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/production/bakery-products');
      setProducts(response.data);

      // Inicializar auditItems com valores padrão
      const initialItems = {};
      response.data.forEach(product => {
        initialItems[product.codigo] = {
          quantity_units: 0,
          production_days: 1
        };
      });
      setAuditItems(initialItems);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setError('Erro ao carregar produtos de padaria');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthAudits = async (monthDate) => {
    try {
      const response = await api.get('/production/audits');
      const allAudits = response.data;

      // Filtrar apenas auditorias do mês selecionado
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const filtered = allAudits.filter(audit => {
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

  const handleDayClick = (day) => {
    // Criar data sem problemas de timezone
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;

    setSelectedDate(dateStr);
    setError(''); // Limpar erros

    // Carregar auditoria se existir
    const audit = getDayAudit(day);
    if (audit) {
      loadAuditData(audit.id);
    } else {
      // Se não existir auditoria, resetar para valores padrão (0 unidades, 1 dia)
      const initialItems = {};
      products.forEach(product => {
        initialItems[product.codigo] = {
          quantity_units: 0,
          production_days: 1
        };
      });
      setAuditItems(initialItems);
    }
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

      const response = await api.post('/production/audits', {
        audit_date: selectedDate,
        items
      });

      setSuccess('Auditoria salva com sucesso!');
      await loadMonthAudits(currentMonth);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao salvar auditoria:', err);
      setError(err.response?.data?.error || 'Erro ao salvar auditoria');
    } finally {
      setLoading(false);
    }
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

        {/* Layout: Calendário + Formulário */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendário - 1/3 do espaço */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                ◀️
              </button>
              <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                ▶️
              </button>
            </div>

            {/* Grid do calendário */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              <div className="font-bold text-gray-600">Dom</div>
              <div className="font-bold text-gray-600">Seg</div>
              <div className="font-bold text-gray-600">Ter</div>
              <div className="font-bold text-gray-600">Qua</div>
              <div className="font-bold text-gray-600">Qui</div>
              <div className="font-bold text-gray-600">Sex</div>
              <div className="font-bold text-gray-600">Sáb</div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth().map((day, index) => {
                const isSelected = day && selectedDate === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                return (
                  <div
                    key={index}
                    className={`
                      aspect-square flex items-center justify-center rounded text-sm transition-all
                      ${day ? getDayColor(day) : 'bg-transparent'}
                      ${isSelected ? 'ring-4 ring-orange-500 ring-offset-2 scale-110 font-bold' : ''}
                    `}
                    onClick={() => day && handleDayClick(day)}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                <span>Concluída</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                <span>Em andamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                <span>Pendente</span>
              </div>
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

            {/* Filtros Informativos */}
            <div className="mb-4 flex gap-4 items-center text-sm">
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg">
                <span className="font-semibold text-orange-700">Seção:</span>
                <span className="text-orange-900">Padaria</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                <span className="font-semibold text-blue-700">Tipo:</span>
                <span className="text-blue-900">PRODUÇÃO</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-semibold text-gray-700">Total:</span>
                <span className="text-gray-900">{products.length} produtos</span>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                      Estoque<br/>(unidades)
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                      Dias<br/>Produção
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                      Venda Média<br/>(kg/dia)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map(product => (
                    <tr key={product.codigo} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <div className="font-medium">{product.descricao}</div>
                        <div className="text-xs text-gray-500">
                          {product.peso_medio_kg ? `${product.peso_medio_kg.toFixed(3)} kg/und` : 'Peso não cadastrado'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          value={auditItems[product.codigo]?.quantity_units || 0}
                          onChange={(e) => handleItemChange(product.codigo, 'quantity_units', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-orange-500 focus:border-orange-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={auditItems[product.codigo]?.production_days || 1}
                          onChange={(e) => handleItemChange(product.codigo, 'production_days', e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center text-sm">
                        {product.vendaMedia?.toFixed(3) || '0.000'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
