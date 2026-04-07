import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function RhCadastroGeral() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lista e paginacao
  const [colaboradores, setColaboradores] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtroDebounced, setFiltroDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativo');
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const itensPorPagina = 20;

  // Estatisticas
  const [stats, setStats] = useState({ total: 0, ativos: 0, desligados: 0 });

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('pessoais');
  const [salvando, setSalvando] = useState(false);

  // Dropdowns de configuracao
  const [cargos, setCargos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);

  // Form data
  const initialFormData = {
    // Dados Pessoais
    matricula: '',
    nome: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    sexo: '',
    estado_civil: '',
    nacionalidade: 'Brasileiro(a)',
    naturalidade: '',
    escolaridade_id: '',
    nome_pai: '',
    nome_mae: '',
    telefone: '',
    celular: '',
    email: '',
    // Endereco
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Dados Profissionais
    cargo_id: '',
    empresa_id: '',
    jornada_id: '',
    data_admissao: '',
    salario: '',
    status: 'ativo',
    // Documentos
    ctps: '',
    serie_ctps: '',
    pis_pasep: '',
    titulo_eleitor: '',
    reservista: '',
    // Banco
    banco: '',
    agencia: '',
    conta: '',
    tipo_conta: '',
    pix: '',
    // Beneficios
    vale_transporte: false,
    vale_refeicao: false,
    valor_vale_refeicao: '',
    plano_saude: false,
    // Observacoes
    observacoes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltroDebounced(filtro);
    }, 500);
    return () => clearTimeout(timer);
  }, [filtro]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    carregarColaboradores();
    carregarEstatisticas();
  }, [paginaAtual, filtroDebounced, statusFiltro]);

  // Carregar configuracoes ao montar
  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const [cargosRes, empRes, jorRes, escRes] = await Promise.all([
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/empresas'),
        api.get('/rh/configuracoes/jornadas'),
        api.get('/rh/configuracoes/escolaridades')
      ]);
      setCargos(cargosRes.data?.cargos || cargosRes.data || []);
      setEmpresas(empRes.data?.empresas || empRes.data || []);
      setJornadas(jorRes.data?.jornadas || jorRes.data || []);
      setEscolaridades(escRes.data?.escolaridades || escRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar configuracoes:', error);
    }
  };

  const carregarEstatisticas = async () => {
    try {
      const response = await api.get('/rh/colaboradores/stats');
      setStats({
        total: response.data?.totalColaboradores || response.data?.total || 0,
        ativos: response.data?.ativos || 0,
        desligados: response.data?.desligados || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatisticas:', error);
    }
  };

  const carregarColaboradores = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', paginaAtual);
      params.append('limit', itensPorPagina);
      if (filtroDebounced) params.append('search', filtroDebounced);
      if (statusFiltro !== 'todos') params.append('status', statusFiltro);

      const response = await api.get(`/rh/colaboradores?${params.toString()}`);
      setColaboradores(response.data?.data || response.data?.colaboradores || []);
      setTotalPaginas(response.data?.pagination?.totalPages || response.data?.totalPages || 1);
      setTotalRegistros(response.data?.pagination?.total || response.data?.total || 0);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      toast.error('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (colaborador = null) => {
    if (colaborador) {
      setEditando(colaborador);
      setFormData({
        matricula: colaborador.matricula || '',
        nome: colaborador.nome || '',
        cpf: colaborador.cpf || '',
        rg: colaborador.rg || '',
        data_nascimento: colaborador.data_nascimento?.split('T')[0] || '',
        sexo: colaborador.sexo || '',
        estado_civil: colaborador.estado_civil || '',
        nacionalidade: colaborador.nacionalidade || '',
        naturalidade: colaborador.naturalidade || '',
        escolaridade_id: colaborador.escolaridade_id || '',
        nome_pai: colaborador.nome_pai || '',
        nome_mae: colaborador.nome_mae || '',
        telefone: colaborador.telefone || '',
        celular: colaborador.celular || '',
        email: colaborador.email || '',
        cep: colaborador.cep || '',
        endereco: colaborador.endereco || '',
        numero: colaborador.numero || '',
        complemento: colaborador.complemento || '',
        bairro: colaborador.bairro || '',
        cidade: colaborador.cidade || '',
        estado: colaborador.estado || '',
        cargo_id: colaborador.cargo_id || '',
        empresa_id: colaborador.empresa_id || '',
        jornada_id: colaborador.jornada_id || '',
        data_admissao: colaborador.data_admissao?.split('T')[0] || '',
        salario: colaborador.salario || '',
        status: colaborador.status || 'ativo',
        ctps: colaborador.ctps || '',
        serie_ctps: colaborador.serie_ctps || '',
        pis_pasep: colaborador.pis_pasep || '',
        titulo_eleitor: colaborador.titulo_eleitor || '',
        reservista: colaborador.reservista || '',
        banco: colaborador.banco || '',
        agencia: colaborador.agencia || '',
        conta: colaborador.conta || '',
        tipo_conta: colaborador.tipo_conta || '',
        pix: colaborador.pix || '',
        vale_transporte: colaborador.vale_transporte || false,
        vale_refeicao: colaborador.vale_refeicao || false,
        valor_vale_refeicao: colaborador.valor_vale_refeicao || '',
        plano_saude: colaborador.plano_saude || false,
        observacoes: colaborador.observacoes || ''
      });
    } else {
      setEditando(null);
      setFormData(initialFormData);
    }
    setAbaAtiva('pessoais');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/colaboradores/${editando.id}`, formData);
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        await api.post('/rh/colaboradores', formData);
        toast.success('Colaborador cadastrado com sucesso!');
      }
      fecharModal();
      carregarColaboradores();
      carregarEstatisticas();
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar colaborador');
    } finally {
      setSalvando(false);
    }
  };

  const excluirColaborador = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o colaborador "${nome}"?`)) return;
    try {
      await api.delete(`/rh/colaboradores/${id}`);
      toast.success('Colaborador excluido com sucesso!');
      carregarColaboradores();
      carregarEstatisticas();
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error);
      toast.error('Erro ao excluir colaborador');
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarCPF = (cpf) => {
    if (!cpf) return '-';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Indices para paginacao
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = Math.min(indiceInicio + colaboradores.length, totalRegistros);

  // Input class helper
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm";
  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // Abas do modal
  const abas = [
    { id: 'pessoais', label: 'Dados Pessoais', icon: '👤' },
    { id: 'endereco', label: 'Endereco', icon: '🏠' },
    { id: 'profissionais', label: 'Profissionais', icon: '💼' },
    { id: 'documentos', label: 'Documentos', icon: '📄' },
    { id: 'banco', label: 'Banco', icon: '🏦' },
    { id: 'beneficios', label: 'Beneficios', icon: '🎁' }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Colaboradores</h1>
              <p className="text-orange-100 text-sm">Gerencie todos os colaboradores da empresa</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-orange-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-500 rounded-lg p-4 text-white shadow-lg">
              <p className="text-blue-100 text-sm font-medium">Total de Colaboradores</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-green-500 rounded-lg p-4 text-white shadow-lg">
              <p className="text-green-100 text-sm font-medium">Ativos</p>
              <p className="text-3xl font-bold mt-1">{stats.ativos}</p>
            </div>
            <div className="bg-red-500 rounded-lg p-4 text-white shadow-lg">
              <p className="text-red-100 text-sm font-medium">Desligados</p>
              <p className="text-3xl font-bold mt-1">{stats.desligados}</p>
            </div>
          </div>

          {/* Filtros e Acoes */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                {/* Busca */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nome, CPF ou matricula..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={filtro}
                      onChange={(e) => {
                        setFiltro(e.target.value);
                        setPaginaAtual(1);
                      }}
                    />
                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Filtro por Status */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={statusFiltro}
                  onChange={(e) => {
                    setStatusFiltro(e.target.value);
                    setPaginaAtual(1);
                  }}
                >
                  <option value="todos">Todos os status</option>
                  <option value="ativo">Ativos</option>
                  <option value="desligado">Desligados</option>
                </select>
              </div>

              {/* Botao Novo */}
              <button
                onClick={() => abrirModal()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo Colaborador
              </button>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex justify-center py-20">
              <RadarLoading message="Carregando colaboradores..." />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Matricula</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">CPF</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Cargo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Empresa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {colaboradores.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-lg font-medium">Nenhum colaborador encontrado</p>
                          <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo colaborador.</p>
                        </td>
                      </tr>
                    ) : (
                      colaboradores.map((colab) => (
                        <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {colab.matricula || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {colab.nome}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatarCPF(colab.cpf)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.cargo_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.empresa_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              colab.status === 'ativo'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {colab.status === 'ativo' ? 'Ativo' : 'Desligado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => abrirModal(colab)}
                                className="text-orange-600 hover:text-orange-800 transition-colors"
                                title="Editar colaborador"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => excluirColaborador(colab.id, colab.nome)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Excluir colaborador"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginacao */}
              {totalRegistros > 0 && (
                <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{indiceInicio + 1}</span> ate{' '}
                    <span className="font-medium">{indiceFim}</span> de{' '}
                    <span className="font-medium">{totalRegistros}</span> resultados
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    {[...Array(Math.min(totalPaginas, 5))].map((_, i) => {
                      let pageNum;
                      if (totalPaginas <= 5) {
                        pageNum = i + 1;
                      } else if (paginaAtual <= 3) {
                        pageNum = i + 1;
                      } else if (paginaAtual >= totalPaginas - 2) {
                        pageNum = totalPaginas - 4 + i;
                      } else {
                        pageNum = paginaAtual - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPaginaAtual(pageNum)}
                          className={`px-3 py-1 rounded border text-sm font-medium ${
                            paginaAtual === pageNum
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edicao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold">
                {editando ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <button
                type="button"
                onClick={fecharModal}
                className="text-white hover:text-orange-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <div className="flex overflow-x-auto px-4">
                {abas.map((aba) => (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setAbaAtiva(aba.id)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      abaAtiva === aba.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-1">{aba.icon}</span>
                    {aba.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* ===== ABA: Dados Pessoais ===== */}
                {abaAtiva === 'pessoais' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Matricula *</label>
                        <input type="text" required className={inputClass} value={formData.matricula} onChange={(e) => handleChange('matricula', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo *</label>
                        <input type="text" required className={inputClass} value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>CPF *</label>
                        <input type="text" required className={inputClass} value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} placeholder="000.000.000-00" />
                      </div>
                      <div>
                        <label className={labelClass}>RG</label>
                        <input type="text" className={inputClass} value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Data de Nascimento *</label>
                        <input type="date" required className={inputClass} value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Sexo *</label>
                        <select required className={selectClass} value={formData.sexo} onChange={(e) => handleChange('sexo', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                          <option value="N">Nao Informar</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Estado Civil</label>
                        <select className={selectClass} value={formData.estado_civil} onChange={(e) => handleChange('estado_civil', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="Solteiro(a)">Solteiro(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viuvo(a)">Viuvo(a)</option>
                          <option value="Uniao Estavel">Uniao Estavel</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Escolaridade</label>
                        <select className={selectClass} value={formData.escolaridade_id} onChange={(e) => handleChange('escolaridade_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {escolaridades.map(esc => (
                            <option key={esc.id} value={esc.id}>{esc.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nacionalidade</label>
                        <input type="text" className={inputClass} value={formData.nacionalidade} onChange={(e) => handleChange('nacionalidade', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Naturalidade</label>
                        <input type="text" className={inputClass} value={formData.naturalidade} onChange={(e) => handleChange('naturalidade', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nome do Pai</label>
                        <input type="text" className={inputClass} value={formData.nome_pai} onChange={(e) => handleChange('nome_pai', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Nome da Mae</label>
                        <input type="text" className={inputClass} value={formData.nome_mae} onChange={(e) => handleChange('nome_mae', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Contato</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Telefone</label>
                        <input type="text" className={inputClass} value={formData.telefone} onChange={(e) => handleChange('telefone', e.target.value)} placeholder="(00) 0000-0000" />
                      </div>
                      <div>
                        <label className={labelClass}>Celular</label>
                        <input type="text" className={inputClass} value={formData.celular} onChange={(e) => handleChange('celular', e.target.value)} placeholder="(00) 00000-0000" />
                      </div>
                      <div>
                        <label className={labelClass}>E-mail</label>
                        <input type="email" className={inputClass} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Endereco ===== */}
                {abaAtiva === 'endereco' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>CEP</label>
                        <input type="text" className={inputClass} value={formData.cep} onChange={(e) => handleChange('cep', e.target.value)} placeholder="00000-000" />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Endereco</label>
                        <input type="text" className={inputClass} value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Numero</label>
                        <input type="text" className={inputClass} value={formData.numero} onChange={(e) => handleChange('numero', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Complemento</label>
                        <input type="text" className={inputClass} value={formData.complemento} onChange={(e) => handleChange('complemento', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Bairro</label>
                        <input type="text" className={inputClass} value={formData.bairro} onChange={(e) => handleChange('bairro', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Cidade</label>
                        <input type="text" className={inputClass} value={formData.cidade} onChange={(e) => handleChange('cidade', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>UF</label>
                        <select className={selectClass} value={formData.estado} onChange={(e) => handleChange('estado', e.target.value)}>
                          <option value="">Selecione...</option>
                          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Dados Profissionais ===== */}
                {abaAtiva === 'profissionais' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Cargo *</label>
                        <select required className={selectClass} value={formData.cargo_id} onChange={(e) => {
                          const cargoId = e.target.value;
                          const cargoSelecionado = cargos.find(c => c.id === parseInt(cargoId));
                          handleChange('cargo_id', cargoId);
                          if (cargoSelecionado?.salario_base) {
                            handleChange('salario', cargoSelecionado.salario_base);
                          }
                        }}>
                          <option value="">Selecione...</option>
                          {cargos.map(cargo => (
                            <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Empresa *</label>
                        <select required className={selectClass} value={formData.empresa_id} onChange={(e) => handleChange('empresa_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Jornada *</label>
                        <select required className={selectClass} value={formData.jornada_id} onChange={(e) => handleChange('jornada_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {jornadas.map(jornada => (
                            <option key={jornada.id} value={jornada.id}>
                              {jornada.nome}{jornada.horas_diarias ? ` (${jornada.horas_diarias}h/dia)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Data de Admissao *</label>
                        <input type="date" required className={inputClass} value={formData.data_admissao} onChange={(e) => handleChange('data_admissao', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Salario (R$)</label>
                        <input type="number" step="0.01" className={inputClass} value={formData.salario} onChange={(e) => handleChange('salario', e.target.value)} placeholder="0,00" />
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <select className={selectClass} value={formData.status} onChange={(e) => handleChange('status', e.target.value)}>
                          <option value="ativo">Ativo</option>
                          <option value="desligado">Desligado</option>
                        </select>
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Observacoes</h4>
                    <div>
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={formData.observacoes}
                        onChange={(e) => handleChange('observacoes', e.target.value)}
                        placeholder="Observacoes gerais sobre o colaborador..."
                      />
                    </div>
                  </div>
                )}

                {/* ===== ABA: Documentos ===== */}
                {abaAtiva === 'documentos' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 pb-2 border-b border-gray-200">CTPS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero CTPS</label>
                        <input type="text" className={inputClass} value={formData.ctps} onChange={(e) => handleChange('ctps', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Serie</label>
                        <input type="text" className={inputClass} value={formData.serie_ctps} onChange={(e) => handleChange('serie_ctps', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">PIS/PASEP</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero PIS/PASEP</label>
                        <input type="text" className={inputClass} value={formData.pis_pasep} onChange={(e) => handleChange('pis_pasep', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Titulo de Eleitor</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero</label>
                        <input type="text" className={inputClass} value={formData.titulo_eleitor} onChange={(e) => handleChange('titulo_eleitor', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Certificado de Reservista</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero</label>
                        <input type="text" className={inputClass} value={formData.reservista} onChange={(e) => handleChange('reservista', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Banco ===== */}
                {abaAtiva === 'banco' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Banco</label>
                        <input type="text" className={inputClass} value={formData.banco} onChange={(e) => handleChange('banco', e.target.value)} placeholder="Ex: Bradesco, Itau, Banco do Brasil..." />
                      </div>
                      <div>
                        <label className={labelClass}>Agencia</label>
                        <input type="text" className={inputClass} value={formData.agencia} onChange={(e) => handleChange('agencia', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Conta</label>
                        <input type="text" className={inputClass} value={formData.conta} onChange={(e) => handleChange('conta', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Tipo de Conta</label>
                        <select className={selectClass} value={formData.tipo_conta} onChange={(e) => handleChange('tipo_conta', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="corrente">Conta Corrente</option>
                          <option value="poupanca">Poupanca</option>
                          <option value="salario">Conta Salario</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Chave PIX</label>
                        <input type="text" className={inputClass} value={formData.pix} onChange={(e) => handleChange('pix', e.target.value)} placeholder="CPF, email, telefone ou chave aleatoria" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Beneficios ===== */}
                {abaAtiva === 'beneficios' && (
                  <div className="space-y-6">
                    {/* Vale Transporte */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          checked={formData.vale_transporte}
                          onChange={(e) => handleChange('vale_transporte', e.target.checked)}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Vale Transporte</span>
                          <p className="text-xs text-gray-500">Conceder vale transporte ao colaborador</p>
                        </div>
                      </label>
                    </div>

                    {/* Vale Refeicao */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          checked={formData.vale_refeicao}
                          onChange={(e) => handleChange('vale_refeicao', e.target.checked)}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Vale Refeicao</span>
                          <p className="text-xs text-gray-500">Conceder vale refeicao ao colaborador</p>
                        </div>
                      </label>
                      {formData.vale_refeicao && (
                        <div className="mt-3 ml-8">
                          <label className={labelClass}>Valor do Vale Refeicao (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            className={`${inputClass} max-w-xs`}
                            value={formData.valor_vale_refeicao}
                            onChange={(e) => handleChange('valor_vale_refeicao', e.target.value)}
                            placeholder="0,00"
                          />
                        </div>
                      )}
                    </div>

                    {/* Plano de Saude */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          checked={formData.plano_saude}
                          onChange={(e) => handleChange('plano_saude', e.target.checked)}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Plano de Saude</span>
                          <p className="text-xs text-gray-500">Incluir colaborador no plano de saude</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-xl">
                <div className="text-sm text-gray-500">
                  {abaAtiva !== 'pessoais' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = abas.findIndex(a => a.id === abaAtiva);
                        if (idx > 0) setAbaAtiva(abas[idx - 1].id);
                      }}
                      className="text-orange-600 hover:text-orange-800 font-medium"
                    >
                      ← Aba anterior
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  {abaAtiva !== 'beneficios' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = abas.findIndex(a => a.id === abaAtiva);
                        if (idx < abas.length - 1) setAbaAtiva(abas[idx + 1].id);
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                    >
                      Proxima aba →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {salvando ? 'Salvando...' : (editando ? 'Atualizar' : 'Cadastrar')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}