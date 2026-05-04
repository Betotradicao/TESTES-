import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  selecionados: [],
};

const novoSelecionado = (curriculo) => ({
  curriculo_id: curriculo.id,
  nome: curriculo.nome,
  adicionado_em: new Date().toISOString(),
  entrevista: null,
  data_entrevista: null,
  entrevistador: null,
  resultado_entrevista: null,
  motivo_reprovacao: null,
  pos_entrevista: null,
  data_agendar_exames: null,
  data_resultado_exames: null,
  motivo_reprovacao_exames: null,
  contratado: false,
  colaborador_id: null,
});

export default function RhVagas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [beneficiosCatalogo, setBeneficiosCatalogo] = useState([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [salvando, setSalvando] = useState(false);

  // Selecionados (Em Selecao)
  const [buscaCurriculoId, setBuscaCurriculoId] = useState('');
  const [buscandoCurriculo, setBuscandoCurriculo] = useState(false);
  const [curriculoVisualizar, setCurriculoVisualizar] = useState(null);
  const [carregandoCurriculo, setCarregandoCurriculo] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [vagasRes, cargosRes, deptRes, benRes] = await Promise.all([
        api.get('/rh/vagas'),
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/departamentos'),
        api.get('/rh/configuracoes/beneficios'),
      ]);
      setVagas(vagasRes.data || []);
      setCargos(cargosRes.data || []);
      setDepartamentos(deptRes.data || []);
      const benData = benRes.data?.beneficios || benRes.data || [];
      setBeneficiosCatalogo(Array.isArray(benData) ? benData.filter(b => b.ativo !== false) : []);
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
        selecionados: Array.isArray(vaga.selecionados) ? vaga.selecionados : [],
      });
    } else {
      setEditando(null);
      setFormData({ ...initialForm, data_abertura: new Date().toISOString().substring(0, 10) });
    }
    setBuscaCurriculoId('');
    setModalAberto(true);
  };

  // === Selecionados handlers ===
  const adicionarCandidato = async () => {
    const idNum = parseInt(String(buscaCurriculoId).replace(/\D/g, ''), 10);
    if (!idNum) {
      toast.error('Informe o numero do curriculo');
      return;
    }
    if (formData.selecionados.some(s => Number(s.curriculo_id) === idNum)) {
      toast.error('Esse candidato ja esta na lista');
      return;
    }
    try {
      setBuscandoCurriculo(true);
      const { data } = await api.get(`/curriculos/${idNum}`);
      if (!data || !data.id) {
        toast.error('Curriculo nao encontrado');
        return;
      }
      setFormData(prev => ({ ...prev, selecionados: [...prev.selecionados, novoSelecionado(data)] }));
      setBuscaCurriculoId('');
      toast.success(`${data.nome} adicionado`);
    } catch (err) {
      toast.error(err.response?.status === 404 ? 'Curriculo nao encontrado' : 'Erro ao buscar curriculo');
    } finally {
      setBuscandoCurriculo(false);
    }
  };

  const atualizarSelecionado = (idx, patch) => {
    setFormData(prev => {
      const lista = [...prev.selecionados];
      lista[idx] = { ...lista[idx], ...patch };
      return { ...prev, selecionados: lista };
    });
  };

  const removerSelecionado = (idx) => {
    if (!window.confirm('Remover este candidato da selecao?')) return;
    setFormData(prev => ({ ...prev, selecionados: prev.selecionados.filter((_, i) => i !== idx) }));
  };

  const visualizarCurriculo = async (curriculoId) => {
    try {
      setCarregandoCurriculo(true);
      const { data } = await api.get(`/curriculos/${curriculoId}`);
      setCurriculoVisualizar(data);
    } catch (err) {
      toast.error('Erro ao carregar curriculo');
    } finally {
      setCarregandoCurriculo(false);
    }
  };

  const irParaContratacao = (sel) => {
    // Salva a vaga primeiro pra persistir o estado, depois navega pro cadastro
    handleSalvar().then(() => {
      navigate(`/rh/cadastro?curriculo_id=${sel.curriculo_id}&vaga_id=${editando?.id || ''}`);
    });
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
    if (!formData.cargo_id) {
      toast.error('Cargo e obrigatorio');
      return;
    }
    try {
      setSalvando(true);
      // Auto-gera titulo com base no cargo selecionado se nao informado
      const cargoSelecionado = cargos.find(c => String(c.id) === String(formData.cargo_id));
      const payload = {
        ...formData,
        titulo: (formData.titulo && formData.titulo.trim()) || cargoSelecionado?.nome || 'Vaga',
      };
      if (editando) {
        await api.put(`/rh/vagas/${editando.id}`, payload);
        toast.success('Vaga atualizada com sucesso');
      } else {
        await api.post('/rh/vagas', payload);
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Abertura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vagas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Nenhuma vaga cadastrada
                      </td>
                    </tr>
                  ) : (
                    vagas.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.titulo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.cargo_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.departamento_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {v.salario_min ? formatCurrency(v.salario_min) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(v.data_abertura)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-3">
                            <button
                              onClick={() => abrirModal(v)}
                              className="text-orange-600 hover:text-orange-800 text-base font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleExcluir(v.id)}
                              className="text-red-600 hover:text-red-800 text-base font-semibold"
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
            <div className={`bg-white rounded-xl shadow-xl w-full ${formData.status === 'Em Selecao' ? 'max-w-6xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Abertura</label>
                    <input
                      type="date"
                      name="data_abertura"
                      value={formData.data_abertura}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salario</label>
                    <input
                      type="number"
                      name="salario_min"
                      value={formData.salario_min}
                      onChange={handleChange}
                      step="0.01"
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
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
                    {beneficiosCatalogo.length === 0 ? (
                      <p className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        Nenhum beneficio cadastrado em Configuracoes RH &gt; Beneficios.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 px-3 py-2 border border-gray-300 rounded-lg max-h-44 overflow-y-auto">
                        {beneficiosCatalogo.map(b => {
                          const selecionados = (formData.beneficios || '')
                            .split(',').map(s => s.trim()).filter(Boolean);
                          const marcado = selecionados.includes(b.nome);
                          return (
                            <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-orange-50 px-2 py-1 rounded">
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => {
                                  const next = marcado
                                    ? selecionados.filter(n => n !== b.nome)
                                    : [...selecionados, b.nome];
                                  setFormData(prev => ({ ...prev, beneficios: next.join(', ') }));
                                }}
                                className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                              />
                              <span>{b.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* SELECIONADOS - aparece quando status = Em Selecao */}
                {formData.status === 'Em Selecao' && (
                  <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-blue-900">
                        🎯 Candidatos Selecionados ({formData.selecionados.length})
                      </h3>
                    </div>

                    {/* Adicionar novo */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Numero do Curriculo (Banco de Curriculos)
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ex: 25"
                          value={buscaCurriculoId}
                          onChange={(e) => setBuscaCurriculoId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); adicionarCandidato(); }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={adicionarCandidato}
                        disabled={buscandoCurriculo}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                      >
                        {buscandoCurriculo ? 'Buscando...' : '+ Selecionar'}
                      </button>
                    </div>

                    {/* Lista de selecionados */}
                    {formData.selecionados.length === 0 ? (
                      <p className="text-xs text-gray-600 italic text-center py-4">
                        Nenhum candidato selecionado ainda. Adicione pelo numero do curriculo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formData.selecionados.map((sel, idx) => (
                          <div key={`${sel.curriculo_id}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                            {/* Header: numero + nome + remover */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded px-2 py-0.5">
                                  N{sel.curriculo_id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => visualizarCurriculo(sel.curriculo_id)}
                                  className="font-bold text-sm text-blue-700 hover:underline"
                                >
                                  {sel.nome}
                                </button>
                                {sel.contratado && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 font-bold">
                                    ✓ Contratado
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removerSelecionado(idx)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                ✕ Remover
                              </button>
                            </div>

                            {/* Etapas em colunas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* ENTREVISTA */}
                              <div className="border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="font-bold text-gray-700 mb-1">Entrevista</div>
                                {['agendada', 'realizada'].map(v => (
                                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`entrevista-${idx}`}
                                      checked={sel.entrevista === v}
                                      onChange={() => atualizarSelecionado(idx, { entrevista: v })}
                                    />
                                    <span className="capitalize">{v}</span>
                                  </label>
                                ))}
                                {sel.entrevista === 'agendada' && (
                                  <div className="mt-1.5 space-y-1">
                                    <input
                                      type="datetime-local"
                                      value={sel.data_entrevista || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_entrevista: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Entrevistador"
                                      value={sel.entrevistador || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { entrevistador: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* RESULTADO ENTREVISTA */}
                              <div className="border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="font-bold text-gray-700 mb-1">Resultado da Entrevista</div>
                                {[
                                  { v: 'passou', l: 'Passou' },
                                  { v: 'aguarda_decisao', l: 'Aguarda decisao' },
                                  { v: 'nao_compareceu', l: 'Nao compareceu' },
                                  { v: 'reprovado', l: 'Reprovado' },
                                  { v: 'desistiu', l: 'Desistiu' },
                                ].map(o => (
                                  <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`resultado-${idx}`}
                                      checked={sel.resultado_entrevista === o.v}
                                      onChange={() => atualizarSelecionado(idx, {
                                        resultado_entrevista: o.v,
                                        // se nao passou, limpa pos-entrevista
                                        ...(o.v !== 'passou' ? { pos_entrevista: null, data_agendar_exames: null, data_resultado_exames: null } : {})
                                      })}
                                    />
                                    <span>{o.l}</span>
                                  </label>
                                ))}
                                {(sel.resultado_entrevista === 'reprovado' || sel.resultado_entrevista === 'desistiu') && (
                                  <input
                                    type="text"
                                    placeholder="Motivo"
                                    value={sel.motivo_reprovacao || ''}
                                    onChange={(e) => atualizarSelecionado(idx, { motivo_reprovacao: e.target.value })}
                                    className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                  />
                                )}
                              </div>

                              {/* POS-ENTREVISTA - so aparece se passou */}
                              {sel.resultado_entrevista === 'passou' && (
                                <div className="border border-green-300 rounded p-2 bg-green-50">
                                  <div className="font-bold text-green-800 mb-1">Pos-Entrevista (Passou)</div>
                                  {[
                                    { v: 'aguarda_agendar_exames', l: 'Aguardando Agendar Exames' },
                                    { v: 'aguarda_resultado_exames', l: 'Aguardando Resultado Exames' },
                                    { v: 'aprovado_exames', l: 'Aprovado nos Exames' },
                                    { v: 'reprovado_exames', l: 'Reprovado nos Exames' },
                                  ].map(o => (
                                    <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`pos-${idx}`}
                                        checked={sel.pos_entrevista === o.v}
                                        onChange={() => {
                                          const patch = { pos_entrevista: o.v };
                                          // Auto-grava data ao marcar agendar/resultado
                                          if (o.v === 'aguarda_agendar_exames' && !sel.data_agendar_exames) {
                                            patch.data_agendar_exames = new Date().toISOString().substring(0, 10);
                                          }
                                          if (o.v === 'aguarda_resultado_exames' && !sel.data_resultado_exames) {
                                            patch.data_resultado_exames = new Date().toISOString().substring(0, 10);
                                          }
                                          atualizarSelecionado(idx, patch);
                                        }}
                                      />
                                      <span>{o.l}</span>
                                    </label>
                                  ))}
                                  {sel.pos_entrevista === 'aguarda_agendar_exames' && (
                                    <input
                                      type="date"
                                      value={sel.data_agendar_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_agendar_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'aguarda_resultado_exames' && (
                                    <input
                                      type="date"
                                      value={sel.data_resultado_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_resultado_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'reprovado_exames' && (
                                    <input
                                      type="text"
                                      placeholder="Motivo"
                                      value={sel.motivo_reprovacao_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { motivo_reprovacao_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'aprovado_exames' && !sel.contratado && (
                                    <button
                                      type="button"
                                      onClick={() => irParaContratacao(sel)}
                                      className="mt-2 w-full px-2 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700"
                                    >
                                      ✓ CONTRATAR
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

        {/* Modal de visualizacao do curriculo */}
        {curriculoVisualizar && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4" onClick={() => setCurriculoVisualizar(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h2 className="text-lg font-bold">
                  Curriculo N{curriculoVisualizar.id} - {curriculoVisualizar.nome}
                </h2>
                <button onClick={() => setCurriculoVisualizar(null)} className="text-white hover:text-gray-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {curriculoVisualizar.foto_url && (
                    <div className="col-span-2 flex justify-center">
                      <img src={curriculoVisualizar.foto_url} alt="" className="w-32 h-32 rounded-full object-cover border-2 border-gray-200" />
                    </div>
                  )}
                  <div><b>WhatsApp:</b> {curriculoVisualizar.whatsapp || '-'}</div>
                  <div><b>Email:</b> {curriculoVisualizar.email || '-'}</div>
                  <div><b>Idade:</b> {curriculoVisualizar.idade || '-'}</div>
                  <div><b>Cidade:</b> {[curriculoVisualizar.cidade, curriculoVisualizar.bairro].filter(Boolean).join(' / ') || '-'}</div>
                  <div className="col-span-2"><b>Cargos de interesse:</b> {Array.isArray(curriculoVisualizar.cargos_interesse) ? curriculoVisualizar.cargos_interesse.join(', ') : (curriculoVisualizar.cargos_interesse || '-')}</div>
                </div>
                {curriculoVisualizar.experiencias && (
                  <div>
                    <b>Experiencias:</b>
                    <pre className="mt-1 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                      {typeof curriculoVisualizar.experiencias === 'string'
                        ? curriculoVisualizar.experiencias
                        : JSON.stringify(curriculoVisualizar.experiencias, null, 2)}
                    </pre>
                  </div>
                )}
                {curriculoVisualizar.observacoes && (
                  <div>
                    <b>Observacoes:</b>
                    <p className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs whitespace-pre-wrap">{curriculoVisualizar.observacoes}</p>
                  </div>
                )}
                <a
                  href={`/rh/curriculos/banco?id=${curriculoVisualizar.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 text-blue-700 hover:underline text-xs"
                >
                  Ver no Banco de Curriculos →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
