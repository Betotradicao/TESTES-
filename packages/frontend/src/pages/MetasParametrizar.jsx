import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { fetchMetas, createMeta, updateMeta, deleteMeta, toggleMeta } from '../services/metas.service';
import { fetchEmployees } from '../services/employees.service';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const TIPOS_META = [
  { value: 'loja', label: 'Loja', icon: '🏪' },
  { value: 'time', label: 'Times', icon: '👥', disabled: true },
  { value: 'individual', label: 'Individual', icon: '👤', disabled: true },
];

const INDICADORES = [
  { value: 'lucro', label: 'Lucro', icon: '💰' },
  { value: 'vendas', label: 'Vendas', icon: '📊', disabled: true },
  { value: 'margem', label: 'Margem', icon: '📈', disabled: true },
];

export default function MetasParametrizar() {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMeta, setEditingMeta] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('criar');
  const [deletingId, setDeletingId] = useState(null);

  // Form state
  const [form, setForm] = useState({
    nome: '',
    tipo: 'loja',
    indicador: 'lucro',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    inflacao: '',
    crescimento: '',
    responsaveis: [],
  });

  const loadMetas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMetas();
      setMetas(data);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await fetchEmployees(1, 1000, true);
      setEmployees(data.employees || data.data || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }, []);

  useEffect(() => {
    loadMetas();
    loadEmployees();
  }, [loadMetas, loadEmployees]);

  const resetForm = () => {
    setForm({
      nome: '',
      tipo: 'loja',
      indicador: 'lucro',
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      inflacao: '',
      crescimento: '',
      responsaveis: [],
    });
    setEditingMeta(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (meta) => {
    setEditingMeta(meta);
    setForm({
      nome: meta.nome,
      tipo: meta.tipo,
      indicador: meta.indicador,
      mes: meta.mes,
      ano: meta.ano,
      inflacao: String(meta.inflacao || ''),
      crescimento: String(meta.crescimento || ''),
      responsaveis: (meta.responsaveis || []).map((r) => r.employee_id),
    });
    setShowModal(true);
  };

  const totalCrescimento = () => {
    const inf = parseFloat(form.inflacao) || 0;
    const cresc = parseFloat(form.crescimento) || 0;
    return (inf + cresc).toFixed(2);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return alert('Nome da meta é obrigatório');
    if (!form.mes || !form.ano) return alert('Mês e ano são obrigatórios');

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      indicador: form.indicador,
      mes: form.mes,
      ano: form.ano,
      inflacao: parseFloat(form.inflacao) || 0,
      crescimento: parseFloat(form.crescimento) || 0,
      total_crescimento: parseFloat(totalCrescimento()),
      responsaveis: form.responsaveis,
    };

    try {
      if (editingMeta) {
        await updateMeta(editingMeta.id, payload);
      } else {
        await createMeta(payload);
      }
      setShowModal(false);
      resetForm();
      loadMetas();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      alert('Erro ao salvar meta');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
    try {
      setDeletingId(id);
      await deleteMeta(id);
      loadMetas();
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleMeta(id);
      loadMetas();
    } catch (error) {
      console.error('Erro ao alternar meta:', error);
    }
  };

  const toggleResponsavel = (employeeId) => {
    setForm((prev) => ({
      ...prev,
      responsaveis: prev.responsaveis.includes(employeeId)
        ? prev.responsaveis.filter((id) => id !== employeeId)
        : [...prev.responsaveis, employeeId],
    }));
  };

  const getMesLabel = (mes) => MESES.find((m) => m.value === mes)?.label || mes;
  const getTipoLabel = (tipo) => TIPOS_META.find((t) => t.value === tipo)?.label || tipo;
  const getIndicadorInfo = (ind) => INDICADORES.find((i) => i.value === ind) || { label: ind, icon: '📊' };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Parametrizar Metas</h1>
              <p className="text-sm text-gray-500">Configuração de metas por operador, setor e período</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('criar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'criar'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Criar Metas
          </button>
        </div>

        {/* Tab Content: Criar Metas */}
        {activeTab === 'criar' && (
          <div>
            {/* Create Button */}
            <div className="mb-6">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                </svg>
                Criar Meta
              </button>
            </div>

            {/* Metas List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              </div>
            ) : metas.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma meta cadastrada</h2>
                <p className="text-gray-500">Clique em "Criar Meta" para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {metas.map((meta) => {
                  const indInfo = getIndicadorInfo(meta.indicador);
                  return (
                    <div
                      key={meta.id}
                      className={`bg-white rounded-xl shadow-sm border-l-4 ${
                        meta.ativo ? 'border-l-amber-500' : 'border-l-gray-300'
                      } border border-gray-200 overflow-hidden transition-all hover:shadow-md`}
                    >
                      {/* Card Header */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{indInfo.icon}</span>
                            <div>
                              <h3 className="font-semibold text-gray-800 text-sm leading-tight">{meta.nome}</h3>
                              <p className="text-xs text-gray-500">
                                {getTipoLabel(meta.tipo)} &bull; {indInfo.label}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              meta.ativo
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {meta.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>

                        <div className="text-xs text-amber-600 font-medium mb-3">
                          {getMesLabel(meta.mes)} / {meta.ano}
                        </div>

                        {/* Percentuais */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-blue-500 font-medium uppercase">Inflação</p>
                            <p className="text-lg font-bold text-blue-700">{Number(meta.inflacao).toFixed(1)}%</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-green-500 font-medium uppercase">Crescimento</p>
                            <p className="text-lg font-bold text-green-700">{Number(meta.crescimento).toFixed(1)}%</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-amber-500 font-medium uppercase">Total</p>
                            <p className="text-lg font-bold text-amber-700">{Number(meta.total_crescimento).toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Responsáveis */}
                        {meta.responsaveis && meta.responsaveis.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] text-gray-400 font-medium uppercase mb-1">Responsáveis</p>
                            <div className="flex flex-wrap gap-1">
                              {meta.responsaveis.map((r) => (
                                <span
                                  key={r.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600"
                                >
                                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[9px] font-bold">
                                    {r.employee?.name?.charAt(0) || '?'}
                                  </span>
                                  {r.employee?.name || 'Colaborador'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
                        <button
                          onClick={() => openEditModal(meta)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggle(meta.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={meta.ativo ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"}/>
                          </svg>
                          {meta.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDelete(meta.id)}
                          disabled={deletingId === meta.id}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Criar/Editar Meta */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  {editingMeta ? 'Editar Meta' : 'Criar Nova Meta'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Meta</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Meta Lucro Março 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  />
                </div>

                {/* Tipo de Meta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Meta</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIPOS_META.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => !t.disabled && setForm({ ...form, tipo: t.value })}
                        disabled={t.disabled}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-all ${
                          form.tipo === t.value
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : t.disabled
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 hover:border-amber-300 text-gray-600'
                        }`}
                      >
                        <span className="text-xl">{t.icon}</span>
                        <span className="font-medium">{t.label}</span>
                        {t.disabled && <span className="text-[10px] text-gray-400">Em breve</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Indicador */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indicador</label>
                  <div className="grid grid-cols-3 gap-2">
                    {INDICADORES.map((i) => (
                      <button
                        key={i.value}
                        onClick={() => !i.disabled && setForm({ ...form, indicador: i.value })}
                        disabled={i.disabled}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-all ${
                          form.indicador === i.value
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : i.disabled
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 hover:border-amber-300 text-gray-600'
                        }`}
                      >
                        <span className="text-xl">{i.icon}</span>
                        <span className="font-medium">{i.label}</span>
                        {i.disabled && <span className="text-[10px] text-gray-400">Em breve</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mês e Ano */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                    <select
                      value={form.mes}
                      onChange={(e) => setForm({ ...form, mes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    >
                      {MESES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                    <input
                      type="number"
                      value={form.ano}
                      onChange={(e) => setForm({ ...form, ano: parseInt(e.target.value) })}
                      min={2020}
                      max={2035}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    />
                  </div>
                </div>

                {/* Percentuais */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Percentuais de Crescimento</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Inflação (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.inflacao}
                        onChange={(e) => setForm({ ...form, inflacao: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Crescimento acima da inflação (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.crescimento}
                        onChange={(e) => setForm({ ...form, crescimento: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3 bg-amber-100 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-800">Total Crescimento</span>
                    <span className="text-xl font-bold text-amber-700">{totalCrescimento()}%</span>
                  </div>
                </div>

                {/* Responsáveis */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsáveis ({form.responsaveis.length} selecionado{form.responsaveis.length !== 1 ? 's' : ''})
                  </label>
                  <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto">
                    {employees.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400 text-center">Nenhum colaborador encontrado</p>
                    ) : (
                      employees.map((emp) => (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            form.responsaveis.includes(emp.id) ? 'bg-amber-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.responsaveis.includes(emp.id)}
                            onChange={() => toggleResponsavel(emp.id)}
                            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {emp.name?.charAt(0) || '?'}
                          </span>
                          <span className="text-sm text-gray-700">{emp.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm"
                >
                  {editingMeta ? 'Salvar Alterações' : 'Criar Meta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
