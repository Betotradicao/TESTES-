import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function ResetSenhaAdminTab() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adminUserId, setAdminUserId] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoadingList(true);
      const { data } = await api.get('/auth/admin-users');
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar lista de admins');
    } finally {
      setLoadingList(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!adminUserId) {
      setError('Selecione o admin que tera a senha redefinida');
      return;
    }
    if (!masterPassword) {
      setError('Informe sua senha master');
      return;
    }
    if (newAdminPassword.length < 6) {
      setError('A nova senha do admin deve ter no minimo 6 caracteres');
      return;
    }
    if (newAdminPassword !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post('/auth/master-reset-admin-password', {
        adminUserId,
        masterPassword,
        newAdminPassword,
      });
      const nome = data?.admin?.company?.nomeFantasia || data?.admin?.email || 'Admin';
      setSuccess(`Senha do admin "${nome}" redefinida com sucesso!`);
      setMasterPassword('');
      setNewAdminPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha do admin');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.isMaster) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
        Apenas o usuario master pode acessar esta area.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold">Resetar Senha de Admin</h3>
            <p className="text-white/90 text-sm">
              Gere uma nova senha para o gerencial/admin de um cliente usando a SUA senha master. Sua propria senha nao sera alterada.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin (gerencial) do cliente
          </label>
          {loadingList ? (
            <div className="text-sm text-gray-500">Carregando admins...</div>
          ) : (
            <select
              value={adminUserId}
              onChange={(e) => setAdminUserId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Selecione o admin...</option>
              {admins.map((a) => {
                const empresa = a.company?.nomeFantasia || a.company?.razaoSocial || 'Sem empresa';
                const identidade = a.name || a.username || a.email || a.id;
                return (
                  <option key={a.id} value={a.id}>
                    {empresa} - {identidade}
                  </option>
                );
              })}
            </select>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Somente contas com role "admin" aparecem aqui. O master nunca aparece nesta lista.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sua senha master (para autorizar)
          </label>
          <input
            type={showPasswords ? 'text' : 'password'}
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Digite sua senha master"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nova senha do admin
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Minimo 6 caracteres"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar nova senha
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Digite novamente"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="toggle-show-passwords"
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="toggle-show-passwords" className="ml-2 text-sm text-gray-700">
            Mostrar senhas
          </label>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Esta operacao altera <strong>apenas</strong> a senha do admin selecionado. A sua senha master permanece intocada.
        </div>

        <button
          type="submit"
          disabled={saving || loadingList}
          className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Redefinindo...' : 'Redefinir senha do admin'}
        </button>
      </form>
    </div>
  );
}
