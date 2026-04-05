import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const STATUS_COLORS = {
  'Aberta': 'bg-green-100 text-green-800',
  'Em Selecao': 'bg-blue-100 text-blue-800',
  'Fechada': 'bg-gray-100 text-gray-800',
  'Cancelada': 'bg-red-100 text-red-800',
};

const STATUS_OPTIONS = ['Aberta', 'Em Selecao', 'Fechada', 'Cancelada'];

const initialForm = {
  titulo: '',
  cargo_id: '',
  departamento_id: '',
  descricao: '',
  quantidade_vagas: 1,
  salario_min: '',
  salario_max: '',
  data_abertura: '',
  status: 'Aberta',
  requisitos: '',
  beneficios: '',
};

export default function RhVagas() {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [vagasRes, cargosRes, deptRes] = await Promise.all([
        api.get('/rh/vagas'),
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/departamentos'),
      ]);
      setVagas(vagasRes.data || []);
      setCargos(cargosRes.data || []);
      setDepartamentos(deptRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar vagas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (v) => {
    if (!v && v !== 0) return '-';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const abrirModal = (vaga = null) => {
    if (vaga) {
      setEditando(vaga);
      setFormData({
        titulo: vaga.titulo || '',
        cargo_id: vaga.cargo_id || '',
        departamento_id: vaga.departamento_id || '',
        descricao: vaga.descricao || '',
        quantidade_vagas: vaga.quantidade_vagas || 1,
        salario_min: vaga.salario_min || '',
        salario_max: vaga.salario_max || '',
        data_abertura: vaga.data_abertura ? vaga.data_abertura.substring(0, 10) : '',
        status: vaga.status || 'Aberta',
        requisitos: vaga.requisitos || '',
        beneficios: vaga.beneficios || '',
      });
    } else {
      setEditando(null);
      setFormData({ ...initialForm, data_abertura: new Date().toISOString().substring(0, 10) });
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setFormData(initialForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalvar = async () => {
    if (!formData.titulo.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }
    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/vagas/${editando.id}`, formData);
        toast.success('Vaga atualizada com sucesso');
      } else {
        await api.post('/rh/vagas', formData);
        toast.success('Vaga criada com sucesso');
      }
      fecharModal();
      fetchAll();
    } catch (err) {
      toast.error('Erro ao salvar vaga');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta vaga?')) return;
    try {
      await api.delete(`/rh/vagas/${id}`);
      toast.success('Vaga excluida com sucesso');
      fetchAll();
    } catch (err) {
      toast.error('Erro ao excluir vaga');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <RadarLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Vagas</h1>
              <p className="text-orange-100 text-sm mt-1">Gestao de vagas abertas e processos seletivos</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => abrirModal()}
                className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition"
              >
                + Nova Vaga
              </button>
              <button
                className="md:hidden text-white"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Vagas</p>
              <p className="text-2xl font-bold text-gray-900">{vagas.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-200">
              <p className="text-sm text-gray-600">Abertas</p>
              <p className="text-2xl font-bold text-green-600">{vagas.filter((v) => v.status === 'Aberta').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-200">
              <p className="text-sm text-gray-600">Em Selecao</p>
              <p className="text-2xl font-bold text-blue-600">{vagas.filter((v) => v.status === 'Em Selecao').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Fechadas</p>
              <p className="text-2xl font-bold text-gray-600">{vagas.filter((v) => v.status === 'Fechada').length}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titulo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departamento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qtd Vagas</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Abertura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vagas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Nenhuma vaga cadastrada
                      </td>
                    </tr>
                  ) : (
                    vagas.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.titulo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.cargo_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.departamento_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.quantidade_vagas || 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {v.salario_min || v.salario_max
                            ? `${formatCurrency(v.salario_min)} - ${formatCurrency(v.salario_max)}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(v.data_abertura)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => abrirModal(v)}
                              className="text-orange-600 hover:text-orange-800 text-xs font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleExcluir(v.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editando ? 'Editar Vaga' : 'Nova Vaga'}</h2>
                <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                    <input
                      type="text"
                      name="titulo"
                      value={formData.titulo}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <select
                      name="cargo_id"
                      value={formData.cargo_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {cargos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <select
                      name="departamento_id"
                      value={formData.departamento_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Vagas</label>
                    <input
                      type="number"
                      name="quantidade_vagas"
                      value={formData.quantidade_vagas}
                      onChange={handleChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salario Minimo</label>
                    <input
                      type="number"
                      name="salario_min"
                      value={formData.salario_min}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salario Maximo</label>
                    <input
                      type="number"
                      name="salario_max"
                      value={formData.salario_max}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Abertura</label>
                    <input
                      type="date"
                      name="data_abertura"
                      value={formData.data_abertura}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
                    <textarea
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requisitos</label>
                    <textarea
                      name="requisitos"
                      value={formData.requisitos}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beneficios</label>
                    <textarea
                      name="beneficios"
                      value={formData.beneficios}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
