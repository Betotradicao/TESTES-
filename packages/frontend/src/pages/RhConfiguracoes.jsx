import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const TABS = [
  { key: 'cargos', label: 'Cargos', endpoint: '/rh/configuracoes/cargos', fields: ['nome', 'descricao'] },
  { key: 'empresas', label: 'Empresas', endpoint: '/companies', fields: ['codLoja', 'apelido', 'nomeFantasia', 'cidade'], readOnly: true, redirectTo: '/configuracoes?tab=empresa' },
  { key: 'jornadas', label: 'Jornadas', endpoint: '/rh/configuracoes/jornadas', fields: ['nome', 'carga_horaria', 'descricao'] },
  { key: 'escolaridades', label: 'Escolaridades', endpoint: '/rh/configuracoes/escolaridades', fields: ['nome'] },
  { key: 'escalas', label: 'Escalas', endpoint: '/rh/configuracoes/escalas', fields: ['nome', 'descricao'] },
  { key: 'regimes', label: 'Regimes', endpoint: '/rh/configuracoes/regimes-trabalho', fields: ['nome', 'descricao'] },
  { key: 'formas_pagamento', label: 'Formas Pgto', endpoint: '/rh/configuracoes/formas-pagamento', fields: ['nome', 'descricao'] },
  { key: 'prazos', label: 'Prazos Exp.', endpoint: '/rh/configuracoes/prazos-experiencia', fields: ['nome', 'dias', 'descricao'] },
  { key: 'tipos_desligamento', label: 'Tipos Deslig.', endpoint: '/rh/configuracoes/tipos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'motivos_desligamento', label: 'Motivos Deslig.', endpoint: '/rh/configuracoes/motivos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'departamentos', label: 'Setores', endpoint: '/rh/configuracoes/departamentos', fields: ['nome', 'descricao'] },
  { key: 'tipos_ausencia', label: 'Tipos Ausencia', endpoint: '/rh/configuracoes/tipos-ausencia', fields: ['nome', 'cor'] },
  { key: 'tipos_treinamento', label: 'Tipos Trein.', endpoint: '/rh/configuracoes/tipos-treinamento', fields: ['nome', 'categoria'] },
  { key: 'status_treinamento', label: 'Status Trein.', endpoint: '/rh/configuracoes/status-treinamento', fields: ['nome', 'cor'] },
  { key: 'beneficios', label: 'Benefícios', endpoint: '/rh/configuracoes/beneficios', fields: ['nome', 'descricao', 'valor'] },
  { key: 'feriados', label: 'Feriados', custom: true },
];

const FIELD_LABELS = {
  nome: 'Nome',
  descricao: 'Descricao',
  cnpj: 'CNPJ',
  endereco: 'Endereco',
  carga_horaria: 'Carga Horaria',
  dias: 'Dias',
  cor: 'Cor',
  categoria: 'Categoria',
  codLoja: 'Loja',
  cod_loja: 'Loja',
  apelido: 'Apelido',
  nomeFantasia: 'Nome Fantasia',
  cidade: 'Cidade',
  valor: 'Valor (R$)',
  date: 'Data',
  name: 'Feriado',
  type: 'Tipo',
};

export default function RhConfiguracoes() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const currentTab = TABS.find(t => t.key === activeTab);

  useEffect(() => {
    if (currentTab?.custom) { setLoading(false); setRecords([]); return; }
    fetchRecords();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      if (!currentTab?.endpoint) { setRecords([]); return; }
      const response = await api.get(currentTab.endpoint);
      let data = Array.isArray(response.data) ? response.data : [];
      // Tab Empresas: ordena por codLoja ASC (matriz com codLoja null vai por ultimo)
      if (activeTab === 'empresas') {
        data = data.slice().sort((a, b) => {
          const ca = a.codLoja ?? 999999;
          const cb = b.codLoja ?? 999999;
          return ca - cb;
        });
      }
      // Tab Setores: ordena por cod_loja ASC e depois nome
      if (activeTab === 'departamentos') {
        data = data.slice().sort((a, b) => {
          const ca = a.cod_loja ?? 999999;
          const cb = b.cod_loja ?? 999999;
          if (ca !== cb) return ca - cb;
          return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });
      }
      // Tab Feriados: ordena por data ASC
      if (activeTab === 'feriados') {
        data = data.slice().sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return da - db;
        });
      }
      setRecords(data);
    } catch (err) {
      console.error('Erro ao carregar registros:', err);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingRecord(null);
    const empty = {};
    currentTab.fields.forEach(f => { empty[f] = ''; });
    setFormData(empty);
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    const data = {};
    currentTab.fields.forEach(f => { data[f] = record[f] || ''; });
    setFormData(data);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.nome.trim()) {
      toast.error('O campo Nome e obrigatorio');
      return;
    }
    try {
      setSaving(true);
      if (editingRecord) {
        await api.put(`${currentTab.endpoint}/${editingRecord.id}`, formData);
        toast.success('Registro atualizado com sucesso');
      } else {
        await api.post(currentTab.endpoint, formData);
        toast.success('Registro criado com sucesso');
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      if (err.response?.status === 409) {
        toast.error('Registro duplicado');
      } else {
        toast.error('Erro ao salvar registro');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Deseja desativar "${record.nome}"?`)) return;
    try {
      await api.delete(`${currentTab.endpoint}/${record.id}`);
      toast.success('Registro desativado com sucesso');
      fetchRecords();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast.error('Erro ao desativar registro');
    }
  };

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
          <h1 className="text-2xl font-bold">Configuracoes RH</h1>
          <p className="text-orange-100 text-sm">Gerencie tabelas auxiliares do RH</p>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b shadow-sm">
          <div className="flex overflow-x-auto px-4">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentTab?.custom && activeTab === 'feriados' ? (
            <FeriadosTab />
          ) : (
          <div className="bg-white rounded-lg shadow">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-700">{currentTab.label}</h2>
              {currentTab.readOnly ? (
                <button
                  onClick={() => navigate(currentTab.redirectTo || '/configuracoes')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Gerenciar em Configurações →
                </button>
              ) : (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Adicionar
                </button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-20">
                <RadarLoading size="sm" message="" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                Nenhum registro encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-600 text-white">
                      {currentTab.fields.map(f => (
                        <th key={f} className="text-left px-6 py-3 text-sm font-medium">
                          {FIELD_LABELS[f] || f}
                        </th>
                      ))}
                      <th className="text-left px-6 py-3 text-sm font-medium">ID</th>
                      {!currentTab.readOnly && (
                        <th className="text-right px-6 py-3 text-sm font-medium">Acoes</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {records.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        {currentTab.fields.map(f => (
                          <td key={f} className="px-6 py-3 text-sm text-gray-700">
                            {(f === 'codLoja' || f === 'cod_loja')
                              ? (record[f] != null ? `Loja ${record[f]}` : 'Matriz')
                              : f === 'date' && record[f]
                                ? new Date(record[f]).toLocaleDateString('pt-BR')
                                : f === 'type' && record[f]
                                  ? (record[f] === 'national' ? '🇧🇷 Nacional' : record[f] === 'regional' ? '📍 Regional' : record[f])
                                  : (record[f] ?? '-')}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-xs text-gray-400 font-mono">{record.id}</td>
                        {!currentTab.readOnly && (
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => openEditModal(record)}
                              className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(record)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-700">
                {editingRecord ? 'Editar' : 'Adicionar'} {currentTab.label}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {currentTab.fields.map(f => (
                <div key={f}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {FIELD_LABELS[f] || f}
                  </label>
                  {f === 'descricao' || f === 'endereco' ? (
                    <textarea
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value.toUpperCase() })}
                      rows={3}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'carga_horaria' ? (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => {
                        // permite apenas numeros e dois pontos, formato HH:MM
                        const raw = e.target.value.replace(/[^\d:]/g, '');
                        setFormData({ ...formData, [f]: raw });
                      }}
                      placeholder="HH:MM (ex: 06:00, 07:20, 08:48)"
                      maxLength={5}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'cor' ? (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      placeholder="#000000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'dias' || f === 'valor' ? (
                    <input
                      type="number"
                      step={f === 'valor' ? '0.01' : undefined}
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab customizado: Feriados ============
function FeriadosTab() {
  const [lojas, setLojas] = useState([]);
  const [codLoja, setCodLoja] = useState('');
  const [feriados, setFeriados] = useState([]);
  const [loadingFer, setLoadingFer] = useState(false);
  const [modalAberto, setModalAberto] = useState(null); // null | { id, name, date } (dia-mes DD/MM)

  // Carrega lojas (via /companies/stores/list)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/companies/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setLojas(data);
      } catch { /* ignore */ }
    })();
  }, []);

  const carregar = async () => {
    if (!codLoja) { setFeriados([]); return; }
    setLoadingFer(true);
    try {
      const r = await api.get(`/holidays?cod_loja=${codLoja}`);
      const list = Array.isArray(r.data) ? r.data : [];
      // Ordena por MM-DD
      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setFeriados(list);
    } catch {
      toast.error('Erro ao carregar feriados');
    } finally { setLoadingFer(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [codLoja]);

  const seedNacionais = async () => {
    if (!codLoja) return;
    try {
      await api.post(`/holidays/seed/${codLoja}`);
      toast.success('Feriados nacionais adicionados');
      await carregar();
    } catch {
      toast.error('Erro ao adicionar nacionais');
    }
  };

  const salvar = async () => {
    if (!modalAberto) return;
    if (!modalAberto.name?.trim() || !modalAberto.date?.match(/^\d{2}\/\d{2}$/)) {
      toast.error('Preencha nome e data no formato DD/MM');
      return;
    }
    const [dd, mm] = modalAberto.date.split('/');
    const dateMMDD = `${mm}-${dd}`;
    try {
      if (modalAberto.id) {
        await api.put(`/holidays/${modalAberto.id}`, { name: modalAberto.name.trim().toUpperCase(), date: dateMMDD });
      } else {
        await api.post('/holidays', { name: modalAberto.name.trim().toUpperCase(), date: dateMMDD, cod_loja: parseInt(codLoja) });
      }
      toast.success('Feriado salvo');
      setModalAberto(null);
      await carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    }
  };

  const excluir = async (f) => {
    if (f.type === 'national') { toast.error('Não é possível excluir feriados nacionais'); return; }
    if (!window.confirm(`Excluir "${f.name}"?`)) return;
    try {
      await api.delete(`/holidays/${f.id}`);
      toast.success('Excluído');
      await carregar();
    } catch { toast.error('Erro ao excluir'); }
  };

  const formatarDDMM = (mmdd) => {
    if (!mmdd || mmdd.length !== 5) return '-';
    const [mm, dd] = mmdd.split('-');
    return `${dd}/${mm}`;
  };

  const nacionais = feriados.filter(f => f.type === 'national');
  const regionais = feriados.filter(f => f.type === 'regional');

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar: seletor de loja + acao */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Loja</label>
            <select value={codLoja} onChange={e => setCodLoja(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">Selecione a loja para ver e cadastrar feriados</option>
              {lojas.map(l => (
                <option key={l.id} value={l.cod_loja}>
                  {l.apelido ? `Loja ${l.cod_loja} - ${l.apelido}` : (l.label || l.nome_fantasia || `Loja ${l.cod_loja}`)}
                </option>
              ))}
            </select>
          </div>
          {codLoja && (
            <>
              <button onClick={seedNacionais}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                🇧🇷 Preencher Nacionais
              </button>
              <button onClick={() => setModalAberto({ id: null, name: '', date: '' })}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                + Novo Feriado Regional
              </button>
            </>
          )}
        </div>
        {codLoja && (
          <div className="mt-2 text-xs text-gray-500 flex gap-4">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{nacionais.length} nacionais</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{regionais.length} regionais</span>
          </div>
        )}
      </div>

      {/* Lista */}
      {!codLoja ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-2">🏪</div>
          <p className="font-semibold">Selecione uma loja pra ver os feriados</p>
        </div>
      ) : loadingFer ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : feriados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Nenhum feriado cadastrado. Clique em <strong>🇧🇷 Preencher Nacionais</strong> pra começar.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-600 text-white">
              <th className="text-left px-6 py-3 text-sm font-medium">Data</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Feriado</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Tipo</th>
              <th className="text-right px-6 py-3 text-sm font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {feriados.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-semibold text-gray-800">{formatarDDMM(f.date)}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{f.name}</td>
                <td className="px-6 py-3 text-sm">
                  {f.type === 'national' ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">🇧🇷 Nacional</span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📍 Regional</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {f.type === 'regional' ? (
                    <>
                      <button onClick={() => setModalAberto({ id: f.id, name: f.name, date: formatarDDMM(f.date) })}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                      <button onClick={() => excluir(f)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Feriado oficial</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de edicao/criacao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">{modalAberto.id ? 'Editar Feriado' : 'Novo Feriado Regional'}</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Nome do feriado *</label>
                <input type="text" value={modalAberto.name}
                  onChange={e => setModalAberto({ ...modalAberto, name: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="Ex: ANIVERSÁRIO DA CIDADE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Data (DD/MM) *</label>
                <input type="text" value={modalAberto.date}
                  onChange={e => {
                    let v = e.target.value.replace(/[^\d]/g, '');
                    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                    setModalAberto({ ...modalAberto, date: v });
                  }}
                  maxLength={5}
                  placeholder="25/07"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500 mt-1">Ex: 25/07 pra 25 de julho. Todo ano se repete.</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={salvar}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
