import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';

export default function ChecklistStub({ titulo, descricao }) {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
              <p className="text-xs sm:text-sm opacity-90">{descricao}</p>
            </div>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="max-w-lg mx-auto mt-12 bg-white border rounded-lg p-8">
            <div className="text-5xl mb-3">🚧</div>
            <h2 className="text-lg font-semibold text-gray-700">Em construção</h2>
            <p className="text-sm text-gray-500 mt-2">Este módulo será implementado em breve. Por enquanto, use <strong>Cadastros → Templates</strong> para configurar os roteiros.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
