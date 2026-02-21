import { useState, useEffect } from 'react';
import api from '../../services/api';

const MASKED = '********';

// Cores por tipo de banco
const BANK_COLORS = {
  santander: { bg: 'bg-red-600', hover: 'hover:bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-500', activeBg: 'bg-red-600' },
  tricard: { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-500', activeBg: 'bg-blue-600' },
  tribanco: { bg: 'bg-green-600', hover: 'hover:bg-green-500', light: 'bg-green-50', text: 'text-green-700', border: 'border-green-500', activeBg: 'bg-green-600' },
  outro: { bg: 'bg-gray-600', hover: 'hover:bg-gray-500', light: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-500', activeBg: 'bg-gray-600' },
};

function getBankColor(tipo) {
  return BANK_COLORS[tipo] || BANK_COLORS.outro;
}

export default function CadastroBancarioTab() {
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [showCertModal, setShowCertModal] = useState(null); // bank object or null
  const [certFile, setCertFile] = useState(null);
  const [certPassword, setCertPassword] = useState('');

  const emptyForm = {
    nome: '',
    tipo_banco: 'santander',
    cnpj: '',
    agencia: '',
    conta: '',
    client_id: '',
    client_secret: '',
    environment: 'production',
    ativo: true,
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/bank-accounts');
      const data = response.data.data || [];
      setBanks(data);
      // Selecionar primeira aba se não tem nenhuma selecionada
      if (data.length > 0 && !activeSubTab) {
        const tipos = [...new Set(data.map(b => b.tipo_banco))];
        setActiveSubTab(tipos[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar bancos cadastrados' });
    } finally {
      setLoading(false);
    }
  };

  // Agrupar bancos por tipo
  const banksByType = banks.reduce((acc, bank) => {
    const tipo = bank.tipo_banco || 'outro';
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(bank);
    return acc;
  }, {});

  const bankTypes = Object.keys(banksByType);
  const currentBanks = banksByType[activeSubTab] || [];

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleNew = () => {
    setEditingBank(null);
    setForm({ ...emptyForm, tipo_banco: activeSubTab || 'santander' });
    setShowModal(true);
  };

  const handleEdit = (bank) => {
    setEditingBank(bank);
    setForm({
      nome: bank.nome || '',
      tipo_banco: bank.tipo_banco || 'santander',
      cnpj: bank.cnpj || '',
      agencia: bank.agencia || '',
      conta: bank.conta || '',
      client_id: '',
      client_secret: '',
      environment: bank.environment || 'production',
      ativo: bank.ativo !== false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome) {
      showMsg('error', 'Nome do banco é obrigatório');
      return;
    }

    try {
      setSaving(true);
      const payload = { ...form };

      if (editingBank) {
        if (!payload.client_id) delete payload.client_id;
        if (!payload.client_secret) delete payload.client_secret;
      }

      if (editingBank) {
        await api.put(`/api/bank-accounts/${editingBank.id}`, payload);
        showMsg('success', 'Banco atualizado com sucesso!');
      } else {
        await api.post('/api/bank-accounts', payload);
        showMsg('success', 'Banco cadastrado com sucesso!');
      }

      setShowModal(false);
      fetchBanks();
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
      showMsg('error', error.response?.data?.error || 'Erro ao salvar banco');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bank) => {
    if (!window.confirm(`Deseja realmente excluir o banco "${bank.nome}"?`)) return;

    try {
      setDeletingId(bank.id);
      await api.delete(`/api/bank-accounts/${bank.id}`);
      showMsg('success', 'Banco removido com sucesso!');
      fetchBanks();
    } catch (error) {
      console.error('Erro ao excluir banco:', error);
      showMsg('error', error.response?.data?.error || 'Erro ao excluir banco');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTestConnection = async (bank) => {
    try {
      setTestingId(bank.id);
      const response = await api.post(`/api/bank-accounts/${bank.id}/test`);
      showMsg('success', response.data.message || 'Conexão bem sucedida!');
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      showMsg('error', error.response?.data?.error || 'Falha ao testar conexão');
    } finally {
      setTestingId(null);
    }
  };

  const openCertModal = (bank) => {
    setShowCertModal(bank);
    setCertFile(null);
    setCertPassword('');
  };

  const handleUploadCertificate = async () => {
    if (!certFile || !showCertModal) return;

    try {
      setUploadingId(showCertModal.id);
      const formData = new FormData();
      formData.append('certificate', certFile);
      if (certPassword) {
        formData.append('pfx_password', certPassword);
      }

      await api.post(`/api/bank-accounts/${showCertModal.id}/certificate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showMsg('success', 'Certificado e senha salvos com sucesso!');
      setShowCertModal(null);
      fetchBanks();
    } catch (error) {
      console.error('Erro ao enviar certificado:', error);
      showMsg('error', error.response?.data?.error || 'Erro ao enviar certificado');
    } finally {
      setUploadingId(null);
    }
  };

  const formatCNPJ = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Cadastro Bancário</h2>
            <p className="mt-1 text-sm text-gray-600">
              Gerencie os bancos cadastrados para consulta de extratos e saldos
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
            </svg>
            Novo Banco
          </button>
        </div>

        {/* Mensagens */}
        {message.text && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Sub-abas por tipo de banco */}
      {bankTypes.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {bankTypes.map((tipo) => {
              const color = getBankColor(tipo);
              const isActive = activeSubTab === tipo;
              const count = banksByType[tipo]?.length || 0;
              return (
                <button
                  key={tipo}
                  onClick={() => setActiveSubTab(tipo)}
                  className={`relative px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
                    isActive
                      ? `${color.text} border-b-3 border-current bg-white`
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  style={isActive ? { borderBottomWidth: '3px' } : {}}
                >
                  <span className="flex items-center gap-2">
                    {tipo === 'santander' && '🔴'}
                    {tipo === 'tricard' && '🔵'}
                    {tipo === 'tribanco' && '🟢'}
                    {!['santander', 'tricard', 'tribanco'].includes(tipo) && '🏦'}
                    {tipo.toUpperCase()}
                    {count > 1 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isActive ? `${color.light} ${color.text}` : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Conteúdo da sub-aba selecionada */}
          <div className="p-6">
            {currentBanks.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
                <h3 className="text-base font-medium text-gray-600 mb-1">Nenhuma conta configurada</h3>
                <p className="text-sm text-gray-500">Clique em "Novo Banco" para adicionar uma conta {activeSubTab?.toUpperCase()}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {currentBanks.map((bank) => {
                  const color = getBankColor(bank.tipo_banco);
                  return (
                    <div key={bank.id} className={`bg-white border rounded-lg p-5 border-l-4 ${color.border}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{bank.nome}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              bank.ativo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {bank.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                            {bank.cnpj && (
                              <div>
                                <span className="font-medium text-gray-500">CNPJ:</span>
                                <span className="ml-1 text-gray-700">{bank.cnpj}</span>
                              </div>
                            )}
                            {bank.agencia && (
                              <div>
                                <span className="font-medium text-gray-500">Agência:</span>
                                <span className="ml-1 text-gray-700">{bank.agencia}</span>
                              </div>
                            )}
                            {bank.conta && (
                              <div>
                                <span className="font-medium text-gray-500">Conta:</span>
                                <span className="ml-1 text-gray-700">{bank.conta}</span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-gray-500">Ambiente:</span>
                              <span className="ml-1 text-gray-700 capitalize">{bank.environment === 'production' ? 'Produção' : 'Sandbox'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Client ID:</span>
                              <span className="ml-1 font-mono text-xs text-gray-700">{bank.client_id ? MASKED : <span className="text-yellow-600">Não configurado</span>}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Client Secret:</span>
                              <span className="ml-1 font-mono text-xs text-gray-700">{bank.client_secret ? MASKED : <span className="text-yellow-600">Não configurado</span>}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Certificado:</span>
                              <span className={`ml-1 font-medium ${bank.certificate_path ? 'text-green-600' : 'text-yellow-600'}`}>
                                {bank.certificate_path ? '✓ Enviado' : '✗ Pendente'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Senha PFX:</span>
                              <span className="ml-1 font-mono text-xs text-gray-700">{bank.pfx_password ? MASKED : <span className="text-yellow-600">Não configurada</span>}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleEdit(bank)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleTestConnection(bank)}
                          disabled={testingId === bank.id}
                          className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium disabled:opacity-50"
                        >
                          {testingId === bank.id ? 'Testando...' : 'Testar Conexão'}
                        </button>
                        <button
                          onClick={() => openCertModal(bank)}
                          className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium"
                        >
                          Upload Certificado
                        </button>
                        <button
                          onClick={() => handleDelete(bank)}
                          disabled={deletingId === bank.id}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium disabled:opacity-50 ml-auto"
                        >
                          {deletingId === bank.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vazio - nenhum banco */}
      {bankTypes.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
          </svg>
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum banco cadastrado</h3>
          <p className="text-sm text-gray-500 mb-4">Clique em "Novo Banco" para cadastrar o primeiro</p>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingBank ? 'Editar Banco' : 'Novo Banco'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {editingBank
                  ? 'Atualize as informações do banco. Campos sensíveis em branco mantêm o valor atual.'
                  : 'Preencha os dados para cadastrar um novo banco.'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Santander - CNPJ Principal"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Tipo Banco + Ambiente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Banco</label>
                  {activeSubTab ? (
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium uppercase">
                      {form.tipo_banco === 'santander' && '🔴 '}
                      {form.tipo_banco === 'tricard' && '🔵 '}
                      {form.tipo_banco === 'tribanco' && '🟢 '}
                      {form.tipo_banco.charAt(0).toUpperCase() + form.tipo_banco.slice(1)}
                    </div>
                  ) : (
                    <select
                      value={form.tipo_banco}
                      onChange={(e) => setForm({ ...form, tipo_banco: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="santander">Santander</option>
                      <option value="tricard">Tricard</option>
                      <option value="tribanco">Tribanco</option>
                      <option value="outro">Outro</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                  <select
                    value={form.environment}
                    onChange={(e) => setForm({ ...form, environment: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="production">Produção</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </div>
              </div>

              {/* CNPJ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Agência + Conta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                  <input
                    type="text"
                    value={form.agencia}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setForm({ ...form, agencia: digits });
                    }}
                    placeholder="Ex: 3310"
                    maxLength={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                  <input
                    type="text"
                    value={form.conta}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setForm({ ...form, conta: digits });
                    }}
                    onBlur={() => {
                      // Auto-preencher com zeros à esquerda (12 dígitos para Santander)
                      if (form.conta && form.tipo_banco === 'santander') {
                        setForm({ ...form, conta: form.conta.padStart(12, '0') });
                      }
                    }}
                    placeholder="Ex: 000130075973"
                    maxLength={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                  {form.tipo_banco === 'santander' && (
                    <p className="text-xs text-amber-600 mt-1">Santander exige 12 dígitos com zeros à esquerda. O sistema completa automaticamente.</p>
                  )}
                </div>
              </div>

              {/* Separador - Credenciais */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                  Credenciais de Acesso
                  {editingBank && (
                    <span className="text-xs text-gray-500 font-normal">(deixe vazio para manter atual)</span>
                  )}
                </h4>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="password"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  placeholder={editingBank ? 'Deixe vazio para manter atual' : 'Client ID da API bancária'}
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret / Token</label>
                <input
                  type="password"
                  value={form.client_secret}
                  onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  placeholder={editingBank ? 'Deixe vazio para manter atual' : 'Client Secret da API bancária'}
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-sm font-medium text-gray-700">Banco ativo</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
              >
                {saving ? 'Salvando...' : (editingBank ? 'Salvar Alterações' : 'Cadastrar Banco')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload de Certificado + Senha PFX */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload de Certificado Digital
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {showCertModal.nome}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo do Certificado (.pfx)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                  <input
                    type="file"
                    accept=".pfx,.p12,.pem,.key,.cer,.crt"
                    onChange={(e) => setCertFile(e.target.files[0])}
                    className="hidden"
                    id="cert-file-input"
                  />
                  <label htmlFor="cert-file-input" className="cursor-pointer">
                    {certFile ? (
                      <div className="flex items-center justify-center gap-2 text-purple-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span className="font-medium">{certFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                        </svg>
                        <span className="text-sm">Clique para selecionar o arquivo</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Senha do PFX */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha do Certificado PFX</label>
                <input
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  placeholder="Digite a senha do certificado"
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">A senha será salva de forma encriptada no servidor</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCertModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadCertificate}
                disabled={!certFile || uploadingId === showCertModal.id}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
              >
                {uploadingId === showCertModal.id ? 'Enviando...' : 'Enviar Certificado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
