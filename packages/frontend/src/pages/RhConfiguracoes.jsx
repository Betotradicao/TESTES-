import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const TABS = [
  { key: 'cargos', label: 'Cargos', endpoint: '/rh/configuracoes/cargos', fields: ['nome', 'descricao'] },
  { key: 'empresas', label: 'Empresas', endpoint: '/companies', fields: ['codLoja', 'apelido', 'nomeFantasia', 'cidade'], readOnly: true },
  { key: 'jornadas', label: 'Jornadas', endpoint: '/rh/configuracoes/jornadas', fields: ['nome', 'carga_horaria', 'descricao'] },
  { key: 'escolaridades', label: 'Escolaridades', endpoint: '/rh/configuracoes/escolaridades', fields: ['nome'] },
  { key: 'escalas', label: 'Escalas', endpoint: '/rh/configuracoes/escalas', fields: ['nome', 'descricao'] },
  { key: 'regimes', label: 'Regimes', endpoint: '/rh/configuracoes/regimes-trabalho', fields: ['nome', 'descricao'] },
  { key: 'formas_pagamento', label: 'Formas Pgto', endpoint: '/rh/configuracoes/formas-pagamento', fields: ['nome', 'descricao'] },
  { key: 'prazos', label: 'Prazos Exp.', endpoint: '/rh/configuracoes/prazos-experiencia', fields: ['nome', 'dias', 'descricao'] },
  { key: 'tipos_desligamento', label: 'Tipos Deslig.', endpoint: '/rh/configuracoes/tipos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'motivos_desligamento', label: 'Motivos Deslig.', endpoint: '/rh/configuracoes/motivos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'departamentos', label: 'Departamentos', endpoint: '/rh/configuracoes/departamentos', fields: ['nome', 'descricao'] },
  { key: 'tipos_ausencia', label: 'Tipos Ausencia', endpoint: '/rh/configuracoes/tipos-ausencia', fields: ['nome', 'cor'] },
  { key: 'tipos_treinamento', label: 'Tipos Trein.', endpoint: '/rh/configuracoes/tipos-treinamento', fields: ['nome', 'categoria'] },
  { key: 'status_treinamento', label: 'Status Trein.', endpoint: '/rh/configuracoes/status-treinamento', fields: ['nome', 'cor'] },
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
  apelido: 'Apelido',
  nomeFantasia: 'Nome Fantasia',
  cidade: 'Cidade',
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
    fetchRecords();
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
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
          <div className="bg-white rounded-lg shadow">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-700">{currentTab.label}</h2>
              {currentTab.readOnly ? (
                <button
                  onClick={() => navigate('/configuracoes')}
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
                            {f === 'codLoja'
                              ? (record[f] != null ? `Loja ${record[f]}` : 'Matriz')
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
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : (
                    <input
                      type={f === 'dias' || f === 'carga_horaria' ? 'number' : 'text'}
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
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
