import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../../utils/api';
import { useLoja } from '../../contexts/LojaContext';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function getDiaSemana(dateStr, year) {
  // dateStr = "MM-DD"
  const [mm, dd] = dateStr.split('-').map(Number);
  const d = new Date(year, mm - 1, dd);
  return DIAS_SEMANA[d.getDay()];
}

function formatDate(dateStr) {
  // "MM-DD" -> "DD/MM"
  const [mm, dd] = dateStr.split('-');
  return `${dd}/${mm}`;
}

export default function HolidaysTab() {
  const { lojaSelecionada, lojas } = useLoja();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [selectedLoja, setSelectedLoja] = useState(lojaSelecionada || 1);
  const [form, setForm] = useState({ name: '', day: '', month: '' });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (selectedLoja) {
      loadHolidays();
    }
  }, [selectedLoja]);

  // Atualizar loja selecionada quando o contexto muda
  useEffect(() => {
    if (lojaSelecionada) {
      setSelectedLoja(lojaSelecionada);
    }
  }, [lojaSelecionada]);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/holidays?cod_loja=${selectedLoja}`);

      if (response.data.length === 0) {
        // Seed feriados nacionais se não existem
        const seedResponse = await api.post(`/holidays/seed/${selectedLoja}`);
        setHolidays(seedResponse.data || []);
      } else {
        setHolidays(response.data);
      }
    } catch (err) {
      console.error('Erro ao carregar feriados:', err);
      toast.error('Erro ao carregar feriados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      const [mm, dd] = holiday.date.split('-');
      setForm({
        name: holiday.name,
        day: dd,
        month: mm,
      });
    } else {
      setEditingHoliday(null);
      setForm({ name: '', day: '', month: '' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.day || !form.month) {
      toast.error('Preencha nome, dia e mês');
      return;
    }

    const day = parseInt(form.day);
    const month = parseInt(form.month);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      toast.error('Data inválida');
      return;
    }

    try {
      const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, {
          name: form.name.trim(),
          date: mmdd,
        });
        toast.success('Feriado atualizado');
      } else {
        await api.post('/holidays', {
          name: form.name.trim(),
          date: mmdd,
          cod_loja: selectedLoja,
        });
        toast.success('Feriado criado');
      }

      setShowModal(false);
      loadHolidays();
    } catch (err) {
      console.error('Erro ao salvar feriado:', err);
      toast.error('Erro ao salvar feriado');
    }
  };

  const handleDelete = async (holiday) => {
    if (holiday.type === 'national') {
      toast.error('Feriados nacionais não podem ser removidos');
      return;
    }

    if (!confirm(`Remover o feriado "${holiday.name}"?`)) return;

    try {
      await api.delete(`/holidays/${holiday.id}`);
      toast.success('Feriado removido');
      loadHolidays();
    } catch (err) {
      console.error('Erro ao deletar feriado:', err);
      toast.error('Erro ao deletar feriado');
    }
  };

  // Contadores
  const nacionais = holidays.filter(h => h.type === 'national').length;
  const regionais = holidays.filter(h => h.type === 'regional').length;

  const meses = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Feriados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie feriados nacionais e regionais por loja
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Feriado Regional
        </button>
      </div>

      {/* Filtros: Loja */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Seletor de Loja */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Loja</label>
            <select
              value={selectedLoja || ''}
              onChange={(e) => setSelectedLoja(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {lojas.length > 0 ? (
                lojas.map(loja => (
                  <option key={loja.COD_LOJA} value={loja.COD_LOJA}>
                    Loja {loja.COD_LOJA} - {loja.APELIDO || loja.FANTASIA || 'Sem nome'}
                  </option>
                ))
              ) : (
                <option value="1">Loja 1</option>
              )}
            </select>
          </div>

          {/* Badges de contagem */}
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
              {nacionais} nacionais
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              {regionais} regionais
            </span>
          </div>
        </div>
      </div>

      {/* Tabela de Feriados */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-500">Carregando feriados...</p>
          </div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-500">Nenhum feriado cadastrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Data</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Dia da Semana</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Feriado</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 text-sm">Tipo</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 text-sm w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => {
                const diaSemana = getDiaSemana(holiday.date, currentYear);
                const isFimDeSemana = diaSemana === 'Sábado' || diaSemana === 'Domingo';
                const isPassado = (() => {
                  const [mm, dd] = holiday.date.split('-').map(Number);
                  const holidayDate = new Date(currentYear, mm - 1, dd);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return holidayDate < today;
                })();

                return (
                  <tr
                    key={holiday.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isPassado ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono text-base font-semibold text-gray-900">
                        {formatDate(holiday.date)}/{currentYear}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${isFimDeSemana ? 'text-red-600' : 'text-gray-700'}`}>
                        {diaSemana}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-900 font-medium">{holiday.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {holiday.type === 'national' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Nacional
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          Regional
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {holiday.type === 'regional' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenModal(holiday)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(holiday)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📅</span>
                  <div>
                    <h3 className="text-xl font-bold">
                      {editingHoliday ? 'Editar Feriado' : 'Novo Feriado Regional'}
                    </h3>
                    <p className="text-orange-200 text-sm">
                      Loja {selectedLoja} - Recorrente todo ano
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Feriado *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Aniversário da Cidade"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-base"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dia *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: e.target.value })}
                    placeholder="27"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-base"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês *</label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-base"
                  >
                    <option value="">Selecione</option>
                    {meses.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.day && form.month && (
                <p className="text-sm text-gray-500">
                  Cai em{' '}
                  <strong>
                    {getDiaSemana(`${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`, currentYear)}
                  </strong>{' '}
                  em {currentYear}
                </p>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.day || !form.month}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
              >
                {editingHoliday ? 'Salvar' : 'Criar Feriado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
