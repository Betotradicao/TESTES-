import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

export default function ChecklistAuditoresView({ modo = 'auditores' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const isAuditor = modo === 'auditores';
  const titulo = isAuditor ? 'Auditores' : 'Auditados';
  const flag = isAuditor ? 'Pode auditar' : 'Pode ser auditado';
  const endpoint = isAuditor ? '/checklist/auditores' : '/checklist/auditados';
  const chave = isAuditor ? 'auditores' : 'auditados';

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [modo]);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint);
      setLista(res.data?.[chave] || []);
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-auto">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">✅ {titulo}</h1>
              <p className="text-xs sm:text-sm opacity-90 truncate">Colaboradores marcados com "{flag}"</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="flex-1">
              Esta é apenas uma <strong>visualização</strong>. Para marcar ou desmarcar um colaborador como {titulo.toLowerCase()}, use{' '}
              <button onClick={() => navigate('/configuracoes?tab=colaboradores')} className="text-blue-700 underline hover:text-blue-900 font-medium">
                Configurações → Colaboradores
              </button>{' '}
              e ative a flag "{flag}" no cadastro do funcionário.
            </div>
          </div>

          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-gray-500 py-10 text-center italic">
              Nenhum colaborador marcado como "{flag}" ainda.
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 border-b">
                <strong>{lista.length}</strong> {lista.length === 1 ? 'colaborador' : 'colaboradores'}
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">Avatar</th>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Usuário</th>
                    <th className="text-left px-4 py-3">Setor</th>
                    <th className="text-left px-4 py-3">Loja</th>
                    <th className="text-left px-4 py-3">Código</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(e => (
                    <tr key={e.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {e.avatar ? (
                          <img src={e.avatar} alt={e.name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-sm border border-teal-200">
                            {(e.name || '?').trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.sector?.name || e.function_description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">Loja {e.cod_loja || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{e.barcode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
