import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EquipmentsTab from './EquipmentsTab';
import ModulesTab from './ModulesTab';

export default function PreventionTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return searchParams.get('subtab') || 'equipment';
  });

  useEffect(() => {
    const subtabFromUrl = searchParams.get('subtab');
    if (subtabFromUrl && (subtabFromUrl === 'equipment' || subtabFromUrl === 'modules')) {
      setActiveSubTab(subtabFromUrl);
    }
  }, [searchParams]);

  const handleSubTabChange = (subtab) => {
    setActiveSubTab(subtab);
    const currentTab = searchParams.get('tab') || 'prevention';
    setSearchParams({ tab: currentTab, subtab });
  };

  const subTabs = [
    { id: 'equipment', label: 'Equipamentos' },
    { id: 'modules', label: 'Módulos' }
  ];

  return (
    <div>
      {/* Sub-navigation */}
      <div className="border-b border-gray-200 mb-4 -mt-2">
        <nav className="flex space-x-6" aria-label="Prevention Tabs">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleSubTabChange(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition
                ${activeSubTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeSubTab === 'equipment' && (
        <div className="mt-7">
          <EquipmentsTab />
        </div>
      )}
      {activeSubTab === 'modules' && (
        <div className="mt-7">
          <ModulesTab />
        </div>
      )}
    </div>
  );
}
