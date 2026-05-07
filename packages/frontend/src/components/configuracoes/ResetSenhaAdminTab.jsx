import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PasswordRequirements from '../PasswordRequirements';
import { passwordValidationError } from '../../utils/passwordPolicy';

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
  // Estados do "Gerar link de primeiro acesso"
  const [linkAdminUserId, setLinkAdminUserId] = useState('');
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkGerado, setLinkGerado] = useState(null); // { url, expires_at, admin }
  const [linkErro, setLinkErro] = useState('');
  const [copiado, setCopiado] = useState(false);

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
    const pwdErr = passwordValidationError(newAdminPassword);
    if (pwdErr) {
      setError(pwdErr);
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

  const gerarLinkPrimeiroAcesso = async () => {
    setLinkErro('');
    setLinkGerado(null);
    setCopiado(false);
    if (!linkAdminUserId) {
      setLinkErro('Selecione o admin pra gerar o link');
      return;
    }
    try {
      setGerandoLink(true);
      const { data } = await api.post('/auth/admin-setup-link', { adminUserId: linkAdminUserId });
      const url = `${window.location.origin}${data.path}`;
      setLinkGerado({ ...data, url });
    } catch (err) {
      setLinkErro(err.response?.data?.error || 'Erro ao gerar link');
    } finally {
      setGerandoLink(false);
    }
  };

  const copiarLink = async () => {
    if (!linkGerado?.url) return;
    try {
      await navigator.clipboard.writeText(linkGerado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setLinkErro('Não foi possível copiar — selecione o texto manualmente');
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

      {/* CARD: Gerar link de primeiro acesso */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-emerald-100 rounded-full p-2">
            <svg className="w-6 h-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">🔑 Gerar link de primeiro acesso</h4>
            <p className="text-xs text-gray-600 mt-1">Envie o link pro cliente. Ele abre, define email/usuário/senha próprios e o link expira automaticamente. Válido por 72h e só funciona 1 vez.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin do cliente</label>
            <select
              value={linkAdminUserId}
              onChange={(e) => setLinkAdminUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione o admin...</option>
              {admins.map(a => {
                const empresa = a.company?.nomeFantasia || a.company?.razaoSocial || 'Sem empresa';
                const id = a.name || a.username || a.email || a.id;
                return <option key={a.id} value={a.id}>{empresa} - {id}</option>;
              })}
            </select>
          </div>
          <button
            type="button"
            onClick={gerarLinkPrimeiroAcesso}
            disabled={gerandoLink || !linkAdminUserId}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition"
          >
            {gerandoLink ? 'Gerando…' : 'Gerar link'}
          </button>
        </div>

        {linkErro && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{linkErro}</div>}

        {linkGerado && (
          <div className="mt-4 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
            <p className="text-sm font-semibold text-emerald-900 mb-2">✅ Link gerado pra <strong>{linkGerado.admin?.company?.nomeFantasia || 'cliente'}</strong></p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                readOnly
                value={linkGerado.url}
                onClick={(e) => e.target.select()}
                className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded text-sm font-mono"
              />
              <button
                type="button"
                onClick={copiarLink}
                className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium whitespace-nowrap"
              >
                {copiado ? '✓ Copiado!' : '📋 Copiar'}
              </button>
            </div>
            <p className="text-xs text-emerald-800">⏰ Expira em: {new Date(linkGerado.expires_at).toLocaleString('pt-BR')} · 🔒 Uso único</p>
          </div>
        )}
      </div>

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
              placeholder="Senha forte"
              required
              autoComplete="new-password"
            />
            <PasswordRequirements password={newAdminPassword} />
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
            {confirmPassword && newAdminPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">As senhas não coincidem</p>
            )}
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
