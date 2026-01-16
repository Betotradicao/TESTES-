export default function TabsNavigation({ activeTab, onChange, pageType = 'config' }) {
  // Abas para Configurações de REDE
  const redeTabs = [
    { id: 'apis', label: 'APIs' },
    { id: 'whatsapp-groups', label: 'Grupos WhatsApp' },
    { id: 'security', label: 'Segurança' },
    { id: 'email-monitor', label: 'Monitor Email' },
    { id: 'email', label: 'Email' },
    { id: 'cron-monitor', label: 'CRON Monitor' },
    { id: 'empresa', label: 'Empresa' },
    { id: 'modulos', label: 'Módulos' }
  ];

  // Abas para Configurações normais
  const configTabs = [
    { id: 'sectors', label: 'Setores' },
    { id: 'employees', label: 'Colaboradores' },
    { id: 'prevention', label: 'Leitores' },
    { id: 'hortfrut-boxes', label: 'Caixas HortFrut' }
  ];

  const tabs = pageType === 'rede' ? redeTabs : configTabs;

  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
