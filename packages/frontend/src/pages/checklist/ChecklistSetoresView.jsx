import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

export default function ChecklistSetoresView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await api.get('/checklist/setores');
      setSetores(res.data?.setores || []);
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
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-5">
          <h1 className="text-2xl font-bold">✅ Check List no Radar — Setores</h1>
          <p className="text-sm opacity-90">Setores disponíveis para uso nos templates de auditoria</p>
        </div>

        <div className="p-6">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="flex-1">
              Esta é apenas uma <strong>visualização</strong>. Para adicionar, editar ou desativar setores, use{' '}
              <button onClick={() => navigate('/configuracoes?tab=setores')} className="text-blue-700 underline hover:text-blue-900 font-medium">
                Configurações → Setores
              </button>.
            </div>
          </div>

          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : setores.length === 0 ? (
            <div className="text-gray-500 py-10 text-center italic">Nenhum setor cadastrado</div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3">ID</th>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Loja</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {setores.map(s => (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{s.id}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-3 py-1 rounded text-white text-xs font-medium" style={{ backgroundColor: s.color_hash || '#14b8a6' }}>
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">Loja {s.cod_loja || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
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
