export default function TabsNavigation({ activeTab, onChange }) {
  const tabs = [
    { id: 'empresa', label: 'Empresa' },
    { id: 'sectors', label: 'Setores' },
    { id: 'employees', label: 'Colaboradores' },
    { id: 'prevention', label: 'Prevenção' },
    { id: 'apis', label: 'APIs' },
    { id: 'security', label: 'Segurança' }
  ];

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
