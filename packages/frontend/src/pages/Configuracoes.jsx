import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TabsNavigation from '../components/configuracoes/TabsNavigation';
import EmpresaTab from '../components/configuracoes/EmpresaTab';
import SectorsTab from '../components/configuracoes/SectorsTab';
import EmployeesTab from '../components/configuracoes/EmployeesTab';
import PreventionTab from '../components/configuracoes/PreventionTab';
import APIsTab from '../components/configuracoes/APIsTab';
import SecurityTab from '../components/configuracoes/SecurityTab';

export default function Configuracoes() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'empresa';
  });

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && (tabFromUrl === 'empresa' || tabFromUrl === 'sectors' || tabFromUrl === 'employees' || tabFromUrl === 'prevention' || tabFromUrl === 'apis' || tabFromUrl === 'security')) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Configurações</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          </div>

          <TabsNavigation activeTab={activeTab} onChange={handleTabChange} />

          <div className="mt-6">
            {activeTab === 'empresa' && <EmpresaTab />}
            {activeTab === 'sectors' && <SectorsTab />}
            {activeTab === 'employees' && <EmployeesTab />}
            {activeTab === 'prevention' && <PreventionTab />}
            {activeTab === 'apis' && <APIsTab />}
            {activeTab === 'security' && <SecurityTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
