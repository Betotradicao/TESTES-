import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/Logo';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordStrong } from '../utils/passwordPolicy';

export default function AdminSetup() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validInfo, setValidInfo] = useState(null);
  const [erroInicial, setErroInicial] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/auth/admin-setup/${token}`);
        setValidInfo(data);
        setName(data.admin?.name || '');
        setEmail(data.admin?.email || '');
        setUsername(data.admin?.username || '');
      } catch (err) {
        setErroInicial(err.response?.data?.error || 'Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!name.trim()) return setErro('Nome é obrigatório');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro('Email inválido');
    if (!username || !/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) return setErro('Usuário deve ter ao menos 3 caracteres (letras, números, _ ou -)');
    if (!isPasswordStrong(password)) return setErro('Senha não atende aos requisitos');
    if (password !== confirm) return setErro('As senhas não coincidem');

    try {
      setEnviando(true);
      await api.post(`/auth/admin-setup/${token}`, { name, email, username, password });
      setSucesso('Acesso configurado com sucesso! Redirecionando para o login...');
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao configurar acesso');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Validando link…</div>
      </div>
    );
  }

  if (erroInicial) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-600 mb-4">{erroInicial}</p>
          <p className="text-sm text-gray-500">Peça um novo link pra quem te enviou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4"><Logo size="medium" /></div>
            <h1 className="text-2xl font-bold text-gray-900">Configure seu acesso</h1>
            {validInfo?.empresa?.nomeFantasia && (
              <p className="text-orange-600 font-semibold mt-1">{validInfo.empresa.nomeFantasia}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">Defina seu email, usuário e senha pra acessar o sistema</p>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{erro}</div>
          )}
          {sucesso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{sucesso}</div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="João Silva"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email * <span className="text-xs text-gray-500 font-normal">(usado pra recuperar senha)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário * <span className="text-xs text-gray-500 font-normal">(login)</span></label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="joao_silva"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Letras, números, underscore e hífen. Min. 3 caracteres.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Senha forte"
                  required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              <PasswordRequirements password={password} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Digite a senha novamente"
                required
              />
              {confirm && password !== confirm && (
                <p className="mt-1 text-xs text-red-600">As senhas não coincidem</p>
              )}
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold text-lg shadow"
            >
              {enviando ? 'Configurando…' : 'Finalizar e ativar acesso'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">⚠️ Após salvar, este link deixa de funcionar (uso único).</p>
        </div>
      </div>
    </div>
  );
}
