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
  'Contratado(a)': 'bg-purple-100 text-purple-800',
  'Fechada': 'bg-purple-100 text-purple-800', // alias antigo
  'Cancelada': 'bg-red-100 text-red-800',
};

const STATUS_OPTIONS = ['Aberta', 'Em Selecao', 'Contratado(a)', 'Cancelada'];
// Vagas antigas usavam "Fechada" — tratamos como sinonimo de "Contratado(a)" pra nao perder historico
const STATUS_FINALIZADO_VALUES = ['Contratado(a)', 'Fechada'];

const TURNOS = [
  { key: 'manha', label: 'Turno Manhã', emoji: '🌅' },
  { key: 'intermediario', label: 'Turno Intermediário', emoji: '☀️' },
  { key: 'tarde', label: 'Turno Tarde', emoji: '🌆' },
  { key: 'qualquer', label: 'Qualquer horário', emoji: '✨' },
];

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
  cod_loja: '',
  experiencia_obrigatoria: false,
  experiencia_meses_minimo: '',
  turnos: [],
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
  const [sugestoesSalarios, setSugestoesSalarios] = useState({}); // { cargo_id: salario_medio }
  const [departamentos, setDepartamentos] = useState([]);
  const [beneficiosCatalogo, setBeneficiosCatalogo] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState(''); // '' = Todas
  const [filtroStatus, setFiltroStatus] = useState(''); // '' = Todos

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
  const [expandedVagaId, setExpandedVagaId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [vagasRes, cargosRes, deptRes, benRes, sugRes, lojasRes] = await Promise.all([
        api.get('/rh/vagas'),
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/departamentos'),
        api.get('/rh/configuracoes/beneficios'),
        api.get('/rh/configuracoes/cargos/sugestao-salarios').catch(() => ({ data: [] })),
        api.get('/rh/empresas').catch(() => ({ data: [] })),
      ]);
      setVagas(vagasRes.data || []);
      setCargos(cargosRes.data || []);
      setDepartamentos(deptRes.data || []);
      const benData = benRes.data?.beneficios || benRes.data || [];
      setBeneficiosCatalogo(Array.isArray(benData) ? benData.filter(b => b.ativo !== false) : []);
      const sugMap = {};
      (sugRes.data || []).forEach(s => { sugMap[s.cargo_id] = s.salario_medio; });
      setSugestoesSalarios(sugMap);
      const lojasArr = Array.isArray(lojasRes.data) ? lojasRes.data : (lojasRes.data?.empresas || []);
      setLojas(lojasArr.slice().sort((a, b) => (a.codLoja ?? 999999) - (b.codLoja ?? 999999)));
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
      // Se a vaga nao tem salario salvo, puxa do cargo cadastrado em Configuracoes RH
      // Fallback: usa sugestao (media dos colaboradores ativos no cargo)
      let salarioInicial = vaga.salario_min;
      const temSalario = salarioInicial != null && salarioInicial !== '' && Number(salarioInicial) > 0;
      if (!temSalario && vaga.cargo_id) {
        const cargoSel = cargos.find(c => String(c.id) === String(vaga.cargo_id));
        if (cargoSel && cargoSel.salario_base != null && Number(cargoSel.salario_base) > 0) {
          salarioInicial = String(cargoSel.salario_base);
        } else if (sugestoesSalarios[Number(vaga.cargo_id)] != null) {
          salarioInicial = String(sugestoesSalarios[Number(vaga.cargo_id)]);
        }
      }
      setFormData({
        titulo: vaga.titulo || '',
        cargo_id: vaga.cargo_id || '',
        departamento_id: vaga.departamento_id || '',
        descricao: vaga.descricao || '',
        quantidade_vagas: vaga.quantidade_vagas || 1,
        salario_min: salarioInicial || '',
        salario_max: vaga.salario_max || '',
        data_abertura: vaga.data_abertura ? vaga.data_abertura.substring(0, 10) : '',
        status: vaga.status || 'Aberta',
        requisitos: vaga.requisitos || '',
        beneficios: vaga.beneficios || '',
        selecionados: Array.isArray(vaga.selecionados) ? vaga.selecionados : [],
        cod_loja: vaga.cod_loja != null ? String(vaga.cod_loja) : '',
        experiencia_obrigatoria: !!vaga.experiencia_obrigatoria,
        experiencia_meses_minimo: vaga.experiencia_meses_minimo != null ? String(vaga.experiencia_meses_minimo) : '',
        turnos: Array.isArray(vaga.turnos) ? vaga.turnos : [],
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
    const lista = Array.isArray(formData.selecionados) ? formData.selecionados : [];
    if (lista.some(s => Number(s.curriculo_id) === idNum)) {
      toast.error('Esse candidato ja esta na lista');
      return;
    }
    try {
      setBuscandoCurriculo(true);
      const resp = await api.get(`/curriculos/${idNum}`);
      const data = resp?.data?.curriculo || resp?.data;
      if (!data || !data.id) {
        toast.error('Curriculo nao encontrado');
        return;
      }
      setFormData(prev => ({
        ...prev,
        selecionados: [...(Array.isArray(prev.selecionados) ? prev.selecionados : []), novoSelecionado(data)]
      }));
      setBuscaCurriculoId('');
      toast.success(`${data.nome} adicionado`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) toast.error('Curriculo nao encontrado');
      else if (status === 401 || status === 403) toast.error('Sem permissao pra ver curriculos');
      else toast.error(`Erro ao buscar curriculo${status ? ' (' + status + ')' : ''}: ${err?.message || ''}`);
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

  const visualizarCurriculo = (curriculoId) => {
    // Abre o curriculo completo (mesmo modal do Banco de Curriculos) em nova aba
    window.open(`/rh/curriculos/banco?id=${curriculoId}`, '_blank', 'noopener');
  };

  const atualizarStatusInteressado = async (curriculoId, novoStatus, vagaId = null) => {
    try {
      await api.put(`/curriculos/${curriculoId}`, { status: novoStatus });
      // Quando candidato vira "selecionado", a vaga muda de "Aberta" pra "Em Selecao" (se ainda estiver aberta)
      if (novoStatus === 'selecionado' && vagaId) {
        const vaga = vagas.find(v => v.id === vagaId);
        if (vaga && vaga.status === 'Aberta') {
          try {
            await api.put(`/rh/vagas/${vagaId}`, { ...vaga, status: 'Em Selecao' });
          } catch { /* nao bloqueia */ }
        }
      }
      toast.success(novoStatus === 'selecionado' ? '✓ Candidato selecionado' : novoStatus === 'recusado' ? '🚫 Candidato recusado' : novoStatus === 'em_analise' ? '🔎 Em análise' : 'Status atualizado');
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao atualizar status do candidato');
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
    setFormData((prev) => {
      const novo = { ...prev, [name]: value };
      // Quando muda o cargo, puxa o salario base cadastrado em Configuracoes RH > Cargos
      // Fallback: se nao tem salario_base salvo, usa a sugestao (media dos colaboradores ativos)
      if (name === 'cargo_id') {
        const cargoSel = cargos.find(c => String(c.id) === String(value));
        const sb = cargoSel?.salario_base;
        let valorAuto = '';
        if (sb != null && sb !== '' && Number(sb) > 0) {
          valorAuto = String(sb);
        } else if (value && sugestoesSalarios[Number(value)] != null) {
          valorAuto = String(sugestoesSalarios[Number(value)]);
        }
        novo.salario_min = valorAuto;
      }
      return novo;
    });
  };

  const handleSalvar = async () => {
    if (!formData.cargo_id) {
      toast.error('Cargo e obrigatorio');
      return;
    }
    // Auto-gera titulo com base no cargo selecionado se nao informado
    const cargoSelecionado = cargos.find(c => String(c.id) === String(formData.cargo_id));
    const codLojaSelecionada = formData.cod_loja !== '' && formData.cod_loja != null ? Number(formData.cod_loja) : null;
    const basePayload = {
      ...formData,
      titulo: (formData.titulo && formData.titulo.trim()) || cargoSelecionado?.nome || 'Vaga',
      experiencia_obrigatoria: !!formData.experiencia_obrigatoria,
      experiencia_meses_minimo: formData.experiencia_obrigatoria && formData.experiencia_meses_minimo !== ''
        ? Number(formData.experiencia_meses_minimo) : null,
      turnos: Array.isArray(formData.turnos) ? formData.turnos : [],
    };

    // Fan-out: criando vaga com "Todas as lojas" e ha lojas cadastradas → clona uma por loja
    const ehFanOut = !editando && codLojaSelecionada == null && lojas.length > 0;
    if (ehFanOut) {
      const ok = window.confirm(`Isso vai criar ${lojas.length} vagas (uma pra cada loja). Continuar?`);
      if (!ok) return;
    }

    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/vagas/${editando.id}`, { ...basePayload, cod_loja: codLojaSelecionada });
        toast.success('Vaga atualizada com sucesso');
      } else if (ehFanOut) {
        await Promise.all(
          lojas.map(l => api.post('/rh/vagas', { ...basePayload, cod_loja: l.codLoja ?? null }))
        );
        toast.success(`${lojas.length} vagas criadas (uma pra cada loja)`);
      } else {
        await api.post('/rh/vagas', { ...basePayload, cod_loja: codLojaSelecionada });
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

  // Vagas filtradas (afeta cards e tabela)
  // Cards: refletem APENAS o filtro de loja (pra nao zerar todos quando seleciona um status)
  const vagasFiltradasPorLoja = filtroLoja === ''
    ? vagas
    : vagas.filter(v => String(v.cod_loja ?? '') === String(filtroLoja));
  // Tabela: aplica tambem o filtro de status (clique nos cards)
  const matchStatus = (statusVaga, filtro) => {
    if (filtro === '') return true;
    if (filtro === 'Contratado(a)') return STATUS_FINALIZADO_VALUES.includes(statusVaga);
    return statusVaga === filtro;
  };
  const vagasFiltradas = vagasFiltradasPorLoja.filter(v => matchStatus(v.status, filtroStatus));

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
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white px-6 py-4">
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
          {/* Filtro de Loja */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-semibold text-gray-700">🏢 Loja:</label>
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[260px]"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((l) => (
                <option key={l.id ?? l.codLoja} value={l.codLoja ?? ''}>
                  {l.codLoja != null ? `Loja ${l.codLoja} - ` : ''}{l.apelido || l.nomeFantasia || `Loja ${l.id}`}
                </option>
              ))}
            </select>
            {filtroLoja !== '' && (
              <span className="text-xs text-gray-500">
                Mostrando vagas de <strong>{(() => {
                  const l = lojas.find(x => String(x.codLoja) === String(filtroLoja));
                  return l ? (l.apelido || l.nomeFantasia || `Loja ${l.codLoja}`) : `Loja ${filtroLoja}`;
                })()}</strong>
              </span>
            )}
          </div>

          {/* Stats clicaveis — funcionam como filtro de status. Cards refletem filtro de loja. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { key: 'Aberta', label: 'Abertas', cor: 'green' },
              { key: 'Em Selecao', label: 'Em Seleção', cor: 'blue' },
              { key: 'Contratado(a)', label: 'Contratado(a)', cor: 'purple' },
              { key: 'Cancelada', label: 'Canceladas', cor: 'red' },
            ].map(card => {
              const ativo = filtroStatus === card.key;
              const count = vagasFiltradasPorLoja.filter(v => matchStatus(v.status, card.key)).length;
              const corText = { green: 'text-green-600', blue: 'text-blue-600', purple: 'text-purple-600', red: 'text-red-600' }[card.cor];
              const corBorder = { green: 'border-green-400', blue: 'border-blue-400', purple: 'border-purple-400', red: 'border-red-400' }[card.cor];
              const corBorderLeve = { green: 'border-green-200', blue: 'border-blue-200', purple: 'border-purple-200', red: 'border-red-200' }[card.cor];
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setFiltroStatus(ativo ? '' : card.key)}
                  className={`text-left bg-white rounded-lg shadow-sm p-4 border-2 transition-all hover:shadow-md ${ativo ? `${corBorder} ring-2 ring-offset-1 ring-orange-400` : corBorderLeve}`}
                  title={ativo ? 'Clique pra remover o filtro' : `Filtrar por ${card.label}`}
                >
                  <p className="text-sm text-gray-600 flex items-center justify-between">
                    {card.label}
                    {ativo && <span className="text-[10px] uppercase font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">filtrando</span>}
                  </p>
                  <p className={`text-2xl font-bold ${corText}`}>{count}</p>
                </button>
              );
            })}
          </div>

          {/* Titulo contextual da loja */}
          {(() => {
            const lojaSel = filtroLoja !== '' ? lojas.find(x => String(x.codLoja) === String(filtroLoja)) : null;
            const nomeLoja = lojaSel ? (lojaSel.apelido || lojaSel.nomeFantasia || `Loja ${lojaSel.codLoja}`) : null;
            return (
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>🏢</span>
                {nomeLoja ? (
                  <>Vagas que <span className="text-orange-600">{nomeLoja}</span> está precisando</>
                ) : (
                  <>Vagas de <span className="text-orange-600">todas as lojas</span></>
                )}
              </h2>
            );
          })()}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-rose-600 uppercase">❤️ Interessados</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-amber-600 uppercase">🔎 Em Análise</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase">🎯 Selecionados</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">🚫 Recusados</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titulo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Benefícios</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Experiência</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Abertura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dias Em Aberto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vagasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        {vagas.length === 0 ? 'Nenhuma vaga cadastrada' : 'Nenhuma vaga pra essa loja'}
                      </td>
                    </tr>
                  ) : (
                    vagasFiltradas.flatMap((v) => {
                      const sels = Array.isArray(v.selecionados) ? v.selecionados : [];
                      const interessados = Array.isArray(v.interessados) ? v.interessados : [];
                      const isExpanded = expandedVagaId === v.id;
                      const podeExpandir = sels.length > 0 || interessados.length > 0;
                      const rows = [];
                      rows.push(
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-2 py-3 text-center">
                            {podeExpandir && (
                              <button
                                onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                title={isExpanded ? 'Recolher' : 'Expandir candidatos'}
                                className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-base"
                              >
                                {isExpanded ? '−' : '+'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {(() => {
                              if (v.cod_loja == null) return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Todas</span>;
                              const l = lojas.find(x => String(x.codLoja) === String(v.cod_loja));
                              const nome = l?.apelido || l?.nomeFantasia || `Loja ${v.cod_loja}`;
                              return <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium border border-orange-200">🏢 {nome}</span>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}`}>
                              {v.status === 'Fechada' ? 'Contratado(a)' : v.status}
                            </span>
                          </td>
                          {(() => {
                            // Separa interessados por status. 4 colunas distintas agora:
                            //   'novo' = INTERESSADOS (pendentes — aguardando primeira decisao)
                            //   'em_analise' = EM ANÁLISE (sendo avaliado)
                            //   'selecionado' / 'aprovado' / 'contratado' = SELECIONADOS
                            //   'recusado' / 'reprovado' (alias antigo) = RECUSADOS
                            const intPendentes = interessados.filter(c => !c.status || c.status === 'novo');
                            const intEmAnalise = interessados.filter(c => c.status === 'em_analise');
                            const intSelecionados = interessados.filter(c => c.status === 'selecionado' || c.status === 'aprovado' || c.status === 'contratado');
                            const intRecusados = interessados.filter(c => c.status === 'recusado' || c.status === 'reprovado');
                            return (
                              <>
                                <td className="px-4 py-3 text-center">
                                  {intPendentes.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os interessados"
                                    >❤️ {intPendentes.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {intEmAnalise.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os em análise"
                                    >🔎 {intEmAnalise.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {(sels.length + intSelecionados.length) > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os selecionados"
                                    >🎯 {sels.length + intSelecionados.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {intRecusados.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os recusados"
                                    >🚫 {intRecusados.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                              </>
                            );
                          })()}
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {v.titulo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.cargo_nome || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {v.salario_min ? formatCurrency(v.salario_min) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {(() => {
                              const lista = (v.beneficios || '').split(',').map(s => s.trim()).filter(Boolean);
                              if (lista.length === 0) return <span className="text-gray-300">—</span>;
                              return (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {lista.map((b, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-medium">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {v.experiencia_obrigatoria ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                                ✓ {v.experiencia_meses_minimo ? `${v.experiencia_meses_minimo} meses` : 'Sim'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Não exige</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(v.data_abertura)}</td>
                          <td className="px-4 py-3 text-sm">
                            {(() => {
                              if (!v.data_abertura) return <span className="text-gray-300">—</span>;
                              if (STATUS_FINALIZADO_VALUES.includes(v.status) || v.status === 'Cancelada') {
                                return <span className="text-gray-400 text-xs">—</span>;
                              }
                              const dias = Math.floor((Date.now() - new Date(v.data_abertura).getTime()) / (1000 * 60 * 60 * 24));
                              const cor = dias <= 7 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : dias <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200';
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cor}`}>
                                  {dias === 0 ? 'Hoje' : dias === 1 ? '1 dia' : `${dias} dias`}
                                </span>
                              );
                            })()}
                          </td>
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
                      );
                      if (isExpanded && podeExpandir) {
                        rows.push(
                          <tr key={`${v.id}-expand`} className="bg-blue-50">
                            <td colSpan={15} className="px-4 py-3 space-y-4">
                              {sels.length > 0 && (
                              <div>
                              <div className="text-xs font-bold text-blue-900 mb-2">🎯 Candidatos selecionados ({sels.length})</div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="bg-blue-100 text-blue-900">
                                      <th className="px-2 py-1.5 text-left">Nº</th>
                                      <th className="px-2 py-1.5 text-left">Nome</th>
                                      <th className="px-2 py-1.5 text-left">Adicionado</th>
                                      <th className="px-2 py-1.5 text-left">Entrevista</th>
                                      <th className="px-2 py-1.5 text-left">Data Entrevista</th>
                                      <th className="px-2 py-1.5 text-left">Entrevistador</th>
                                      <th className="px-2 py-1.5 text-left">Resultado</th>
                                      <th className="px-2 py-1.5 text-left">Pós-Entrevista</th>
                                      <th className="px-2 py-1.5 text-left">Datas Exames</th>
                                      <th className="px-2 py-1.5 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sels.map((s, i) => (
                                      <tr key={`${s.curriculo_id}-${i}`} className="border-t border-blue-200 bg-white">
                                        <td className="px-2 py-1.5 font-mono font-bold">{s.curriculo_id}</td>
                                        <td className="px-2 py-1.5">
                                          <button
                                            onClick={() => visualizarCurriculo(s.curriculo_id)}
                                            className="text-blue-700 hover:underline font-semibold"
                                          >
                                            {s.nome}
                                          </button>
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600">
                                          {s.adicionado_em ? new Date(s.adicionado_em).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 capitalize">{s.entrevista || '-'}</td>
                                        <td className="px-2 py-1.5 text-gray-600">
                                          {s.data_entrevista ? new Date(s.data_entrevista).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600">{s.entrevistador || '-'}</td>
                                        <td className="px-2 py-1.5">
                                          {s.resultado_entrevista ? (
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                              s.resultado_entrevista === 'passou' ? 'bg-green-100 text-green-800' :
                                              s.resultado_entrevista === 'reprovado' || s.resultado_entrevista === 'desistiu' || s.resultado_entrevista === 'nao_compareceu' ? 'bg-red-100 text-red-800' :
                                              'bg-amber-100 text-amber-800'
                                            }`}>
                                              {({passou:'Passou', aguarda_decisao:'Aguarda decisão', nao_compareceu:'Não compareceu', reprovado:'Reprovado', desistiu:'Desistiu'})[s.resultado_entrevista] || s.resultado_entrevista}
                                            </span>
                                          ) : '-'}
                                          {s.motivo_reprovacao && <div className="text-[10px] italic text-gray-500 mt-0.5">"{s.motivo_reprovacao}"</div>}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {s.pos_entrevista ? ({
                                            aguarda_agendar_exames: '⏳ Agendar exames',
                                            aguarda_resultado_exames: '⏳ Aguarda resultado',
                                            aprovado_exames: '✅ Aprovado',
                                            reprovado_exames: '❌ Reprovado',
                                          })[s.pos_entrevista] || s.pos_entrevista : '-'}
                                          {s.motivo_reprovacao_exames && <div className="text-[10px] italic text-gray-500 mt-0.5">"{s.motivo_reprovacao_exames}"</div>}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600">
                                          {s.data_agendar_exames && <div>Agendar: {new Date(s.data_agendar_exames).toLocaleDateString('pt-BR')}</div>}
                                          {s.data_resultado_exames && <div>Resultado: {new Date(s.data_resultado_exames).toLocaleDateString('pt-BR')}</div>}
                                          {!s.data_agendar_exames && !s.data_resultado_exames && '-'}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {s.contratado ? (
                                            <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-[11px] font-bold">✓ Contratado</span>
                                          ) : (
                                            <span className="text-gray-400 italic">Em processo</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              </div>
                              )}

                              {/* Candidatos INTERESSADOS (vieram do formulario publico) */}
                              {interessados.length > 0 && (
                                <div className={sels.length > 0 ? 'pt-4 mt-4 border-t border-blue-200' : ''}>
                                  <div className="text-xs font-bold text-rose-900 mb-2">❤️ Candidatos interessados ({interessados.length}) — vieram do formulário público</div>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                      <thead>
                                        <tr className="bg-rose-100 text-rose-900">
                                          <th className="px-2 py-1.5 text-left">Nº</th>
                                          <th className="px-2 py-1.5 text-left">Nome</th>
                                          <th className="px-2 py-1.5 text-left">WhatsApp</th>
                                          <th className="px-2 py-1.5 text-left">Email</th>
                                          <th className="px-2 py-1.5 text-left">Cidade</th>
                                          <th className="px-2 py-1.5 text-left">Recebido em</th>
                                          <th className="px-2 py-1.5 text-left">Status</th>
                                          <th className="px-2 py-1.5 text-center">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {interessados.map((c, i) => {
                                          const st = c.status || 'novo';
                                          const isSel = st === 'selecionado' || st === 'aprovado' || st === 'contratado';
                                          const isRec = st === 'recusado' || st === 'reprovado';
                                          const stLabel = isSel ? '✓ Selecionado' : isRec ? '🚫 Recusado' : st === 'em_analise' ? '🔎 Em análise' : '🆕 Novo';
                                          const stCls = isSel ? 'bg-blue-100 text-blue-800' : isRec ? 'bg-gray-200 text-gray-700' : 'bg-rose-100 text-rose-800';
                                          return (
                                            <tr key={`int-${c.curriculo_id}-${i}`} className="border-t border-rose-200 bg-white">
                                              <td className="px-2 py-1.5 font-mono font-bold">{c.curriculo_id}</td>
                                              <td className="px-2 py-1.5">
                                                <button
                                                  onClick={() => visualizarCurriculo(c.curriculo_id)}
                                                  className="text-rose-700 hover:underline font-semibold"
                                                >
                                                  {c.nome}
                                                </button>
                                              </td>
                                              <td className="px-2 py-1.5 text-gray-700">{c.whatsapp || '-'}</td>
                                              <td className="px-2 py-1.5 text-gray-700">{c.email || '-'}</td>
                                              <td className="px-2 py-1.5 text-gray-700">{c.cidade || '-'}</td>
                                              <td className="px-2 py-1.5 text-gray-600">
                                                {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                              </td>
                                              <td className="px-2 py-1.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${stCls}`}>{stLabel}</span>
                                              </td>
                                              <td className="px-2 py-1.5">
                                                <div className="flex gap-1 justify-center flex-wrap">
                                                  <button
                                                    onClick={() => atualizarStatusInteressado(c.curriculo_id, 'em_analise', v.id)}
                                                    disabled={st === 'em_analise'}
                                                    className={`px-2 py-1 text-[11px] font-bold rounded transition ${st === 'em_analise' ? 'bg-amber-200 text-amber-700 cursor-default' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                                                    title="Marcar como em análise"
                                                  >🔎 Em Análise</button>
                                                  <button
                                                    onClick={() => atualizarStatusInteressado(c.curriculo_id, 'selecionado', v.id)}
                                                    disabled={isSel}
                                                    className={`px-2 py-1 text-[11px] font-bold rounded transition ${isSel ? 'bg-blue-200 text-blue-700 cursor-default' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                                                    title="Marcar como selecionado (a vaga vira 'Em Seleção')"
                                                  >✓ Selecionar</button>
                                                  <button
                                                    onClick={() => atualizarStatusInteressado(c.curriculo_id, 'recusado', v.id)}
                                                    disabled={isRec}
                                                    className={`px-2 py-1 text-[11px] font-bold rounded transition ${isRec ? 'bg-gray-300 text-gray-600 cursor-default' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                                                    title="Marcar como recusado"
                                                  >🚫 Recusar</button>
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
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })
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
              <div className="px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>{editando ? '✏️' : '🆕'}</span>
                    {editando ? 'Editar Vaga' : 'Nova Vaga'}
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">Preencha os dados da vaga abaixo</p>
                </div>
                <button onClick={fecharModal} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Loja</label>
                    <select
                      name="cod_loja"
                      value={formData.cod_loja}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
                    >
                      <option value="">Todas as lojas (cria 1 vaga pra cada)</option>
                      {lojas.map((l) => (
                        <option key={l.id ?? l.codLoja} value={l.codLoja ?? ''}>
                          {l.codLoja != null ? `Loja ${l.codLoja} - ` : ''}{l.apelido || l.nomeFantasia || `Loja ${l.id}`}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-gray-500 italic">
                      {!editando && formData.cod_loja === '' && lojas.length > 0
                        ? `⚠️ Ao salvar vai gerar ${lojas.length} vagas (uma pra cada loja)`
                        : 'Vaga aparece pra candidatos desta loja no formulário público'}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">💼 Cargo *</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">📅 Data Abertura</label>
                    <input
                      type="date"
                      name="data_abertura"
                      value={formData.data_abertura}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">💰 Salário Base</label>
                    <input
                      type="number"
                      name="salario_min"
                      value={formData.salario_min}
                      onChange={handleChange}
                      step="0.01"
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-[11px] text-gray-500 italic">Preenchido automaticamente pelo cargo (editavel)</span>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">📊 Status</label>
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
                  <div className="md:col-span-2 bg-sky-50 border border-sky-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">🕐 Disponibilidade de horário</label>
                    <p className="text-xs text-gray-500 mb-2">Marque os turnos disponíveis para esta vaga</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {TURNOS.map(t => {
                        const marcado = (formData.turnos || []).includes(t.key);
                        return (
                          <label
                            key={t.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition ${marcado ? 'bg-white border-sky-500' : 'bg-white border-gray-200 hover:border-sky-300'}`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => {
                                setFormData(prev => {
                                  const atuais = Array.isArray(prev.turnos) ? prev.turnos : [];
                                  const novo = marcado ? atuais.filter(x => x !== t.key) : [...atuais, t.key];
                                  return { ...prev, turnos: novo };
                                });
                              }}
                              className="w-4 h-4 text-sky-500 rounded"
                            />
                            <span className="text-lg">{t.emoji}</span>
                            <span className="text-sm font-medium">{t.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">⏳ Precisa experiência?</label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="experiencia_obrigatoria"
                          checked={formData.experiencia_obrigatoria === true}
                          onChange={() => setFormData(prev => ({ ...prev, experiencia_obrigatoria: true }))}
                        />
                        <span className="text-sm">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="experiencia_obrigatoria"
                          checked={formData.experiencia_obrigatoria === false}
                          onChange={() => setFormData(prev => ({ ...prev, experiencia_obrigatoria: false, experiencia_meses_minimo: '' }))}
                        />
                        <span className="text-sm">Não</span>
                      </label>
                    </div>
                    {formData.experiencia_obrigatoria && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tempo mínimo de experiência (meses)</label>
                        <input
                          type="number"
                          min="1"
                          name="experiencia_meses_minimo"
                          value={formData.experiencia_meses_minimo}
                          onChange={handleChange}
                          placeholder="Ex: 6 = 6 meses, 24 = 2 anos"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">📝 Descrição / Atividades</label>
                      {(() => {
                        const cargoSel = cargos.find(c => String(c.id) === String(formData.cargo_id));
                        const atividadesCargo = cargoSel?.descritivo_atividades || '';
                        if (!atividadesCargo) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.descricao && !window.confirm('Substituir o conteúdo atual pelas atividades do cargo?')) return;
                              setFormData(prev => ({ ...prev, descricao: atividadesCargo }));
                            }}
                            className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium transition flex items-center gap-1"
                            title="Copia as atividades cadastradas no cargo (Configurações RH > Cargos)"
                          >
                            📋 Trazer atividades do cargo
                          </button>
                        );
                      })()}
                    </div>
                    <textarea
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Descreva as atividades da vaga ou clique em 'Trazer atividades do cargo'"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    {!formData.cargo_id && (
                      <p className="text-[11px] text-gray-500 italic mt-1">Selecione um cargo acima pra habilitar "Trazer atividades do cargo".</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">📋 Requisitos</label>
                      {(() => {
                        const cargoSel = cargos.find(c => String(c.id) === String(formData.cargo_id));
                        const requisitosCargo = cargoSel?.requisitos || '';
                        if (!requisitosCargo) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.requisitos && !window.confirm('Substituir o conteúdo atual pelos requisitos do cargo?')) return;
                              setFormData(prev => ({ ...prev, requisitos: requisitosCargo }));
                            }}
                            className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium transition flex items-center gap-1"
                            title="Copia os requisitos cadastrados no cargo (Configurações RH > Cargos)"
                          >
                            📋 Trazer requisitos do cargo
                          </button>
                        );
                      })()}
                    </div>
                    <textarea
                      name="requisitos"
                      value={formData.requisitos}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Ex: Ensino Médio completo, disponibilidade de horário..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">🎁 Benefícios</label>
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
