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
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-5">
          <h1 className="text-2xl font-bold">✅ Check List no Radar — {titulo}</h1>
          <p className="text-sm opacity-90">{descricao}</p>
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
