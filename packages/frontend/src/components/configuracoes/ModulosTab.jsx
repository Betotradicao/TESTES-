import { useState, useEffect } from 'react';

const SECTIONS = [
  {
    id: 'gestao-radar',
    name: 'Gestão no Radar',
    icon: '📊',
    color: 'blue',
    modules: [
      { id: 'gestao-inteligente', name: 'Gestão Inteligente', icon: '📊' },
      { id: 'estoque-margem', name: 'Gestão de Estoque', icon: '📦' },
      { id: 'compras', name: 'Gestão de Compras', icon: '🛒' },
      { id: 'pricing', name: 'Gestão de Pricing', icon: '🏷️' },
      { id: 'ofertas', name: 'Gestão de Ofertas', icon: '🎁' },
    ]
  },
  {
    id: 'prevencao-radar',
    name: 'Prevenção no Radar',
    icon: '🔍',
    color: 'red',
    modules: [
      { id: 'bipagens', name: 'Prevenção de Bipagens', icon: '🔍' },
      { id: 'pdv', name: 'Prevenção PDV', icon: '💳' },
      { id: 'facial', name: 'Prevenção Facial', icon: '👤' },
      { id: 'ruptura', name: 'Prevenção Rupturas', icon: '📋' },
      { id: 'etiquetas', name: 'Prevenção Etiquetas', icon: '🔖' },
      { id: 'perdas', name: 'Prevenção Quebras', icon: '📉' },
      { id: 'prevencao-trocas', name: 'Prevenção Trocas', icon: '🔄' },
      { id: 'producao', name: 'Prevenção Produção', icon: '🥖' },
      { id: 'hortfrut', name: 'Prevenção HortFruti', icon: '🥬' },
      { id: 'controle-recebimento', name: 'Prevenção Recebimento', icon: '📄' },
      { id: 'abastecimento', name: 'Prevenção Abastecimento', icon: '🚚' },
    ]
  },
  {
    id: 'oferta-radar',
    name: 'Oferta no Radar',
    icon: '💎',
    color: 'purple',
    modules: [
      { id: 'garimpa-fornecedores', name: 'Fornecedores e Concorrentes', icon: '🔎' },
    ]
  },
  {
    id: 'financas-radar',
    name: 'Finanças no Radar',
    icon: '💰',
    color: 'green',
    modules: [
      { id: 'demonstrativo-caixa', name: 'Demonstrativo de Caixa', icon: '📊' },
      { id: 'entradas-saidas', name: 'Entradas e Saídas', icon: '↕️' },
      { id: 'bancos', name: 'Bancos', icon: '🏦' },
    ]
  },
  {
    id: 'consultor-digital',
    name: 'Consultor Digital',
    icon: '🤖',
    color: 'orange',
    modules: [
      { id: 'rota-crescimento', name: 'Rota do Crescimento', icon: '🚀' },
    ]
  },
];

// Flatten all modules for initial state
const ALL_MODULES = SECTIONS.flatMap(s => s.modules);

const SECTION_COLORS = {
  blue: { bg: 'bg-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', ring: 'ring-blue-500' },
  red: { bg: 'bg-red-600', bgLight: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', ring: 'ring-red-500' },
  purple: { bg: 'bg-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', ring: 'ring-purple-500' },
  green: { bg: 'bg-green-600', bgLight: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', ring: 'ring-green-500' },
  orange: { bg: 'bg-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', ring: 'ring-orange-500' },
};

export default function ModulosTab() {
  const [modules, setModules] = useState(() =>
    ALL_MODULES.map(m => ({ ...m, active: true }))
  );
  const [success, setSuccess] = useState(null);

  // Carregar configuração salva do localStorage e migrar dados antigos
  useEffect(() => {
    const savedModules = localStorage.getItem('modules_config');
    if (savedModules) {
      try {
        const parsed = JSON.parse(savedModules);
        // Migrar: garantir que todos os módulos existam, preservar active state
        const migrated = ALL_MODULES.map(defaultMod => {
          const saved = parsed.find(m => m.id === defaultMod.id);
          return { ...defaultMod, active: saved ? saved.active : true };
        });
        setModules(migrated);
        localStorage.setItem('modules_config', JSON.stringify(migrated));
      } catch (err) {
        console.error('Erro ao carregar módulos:', err);
        const defaults = ALL_MODULES.map(m => ({ ...m, active: true }));
        setModules(defaults);
        localStorage.setItem('modules_config', JSON.stringify(defaults));
      }
    } else {
      const defaults = ALL_MODULES.map(m => ({ ...m, active: true }));
      localStorage.setItem('modules_config', JSON.stringify(defaults));
    }
  }, []);

  const saveAndNotify = (updated) => {
    setModules(updated);
    localStorage.setItem('modules_config', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleModule = (moduleId) => {
    const updated = modules.map(mod =>
      mod.id === moduleId ? { ...mod, active: !mod.active } : mod
    );
    saveAndNotify(updated);
    const toggled = updated.find(m => m.id === moduleId);
    setSuccess(`${toggled.name} ${toggled.active ? 'ativado' : 'desativado'} com sucesso!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleToggleSection = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;
    const sectionModuleIds = section.modules.map(m => m.id);
    const allActive = sectionModuleIds.every(id => modules.find(m => m.id === id)?.active);
    const newState = !allActive;
    const updated = modules.map(mod =>
      sectionModuleIds.includes(mod.id) ? { ...mod, active: newState } : mod
    );
    saveAndNotify(updated);
    setSuccess(`${section.name} ${newState ? 'ativado' : 'desativado'} por completo!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const getSectionState = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return 'off';
    const sectionModuleIds = section.modules.map(m => m.id);
    const activeCount = sectionModuleIds.filter(id => modules.find(m => m.id === id)?.active).length;
    if (activeCount === sectionModuleIds.length) return 'on';
    if (activeCount === 0) return 'off';
    return 'partial';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Gerenciar Módulos do Sistema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Ative ou desative módulos e seções inteiras. Módulos desativados ficarão inacessíveis no menu lateral.
          </p>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            {success}
          </div>
        )}

        <div className="space-y-6">
          {SECTIONS.map(section => {
            const colors = SECTION_COLORS[section.color];
            const sectionState = getSectionState(section.id);

            return (
              <div key={section.id} className={`rounded-xl border-2 ${sectionState === 'off' ? 'border-gray-200 bg-gray-50' : `${colors.border} ${colors.bgLight}`} overflow-hidden transition-all`}>
                {/* Section Header */}
                <div className={`flex items-center justify-between px-5 py-4 ${sectionState === 'off' ? 'bg-gray-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${sectionState === 'off' ? 'bg-gray-400' : colors.bg} rounded-lg flex items-center justify-center text-lg`}>
                      <span>{section.icon}</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-base ${sectionState === 'off' ? 'text-gray-500' : colors.text}`}>
                        {section.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {section.modules.length} módulo{section.modules.length > 1 ? 's' : ''} &middot;{' '}
                        {sectionState === 'on' ? 'Todos ativos' : sectionState === 'off' ? 'Todos inativos' : 'Parcialmente ativo'}
                      </p>
                    </div>
                  </div>

                  {/* Section Toggle */}
                  <button
                    onClick={() => handleToggleSection(section.id)}
                    className={`
                      relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                      ${sectionState === 'on' ? 'bg-green-500' : sectionState === 'partial' ? 'bg-yellow-400' : 'bg-gray-300'}
                    `}
                    title={sectionState === 'on' ? 'Desativar seção inteira' : 'Ativar seção inteira'}
                  >
                    <span
                      className={`
                        inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow
                        ${sectionState === 'on' ? 'translate-x-7' : sectionState === 'partial' ? 'translate-x-4' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Module List */}
                <div className="px-5 pb-4 pt-1">
                  <div className="space-y-2">
                    {section.modules.map(mod => {
                      const moduleState = modules.find(m => m.id === mod.id);
                      const isActive = moduleState?.active ?? true;

                      return (
                        <div
                          key={mod.id}
                          className={`
                            flex items-center justify-between px-4 py-3 rounded-lg border transition-all
                            ${isActive
                              ? 'border-gray-200 bg-white hover:bg-gray-50'
                              : 'border-gray-200 bg-gray-100'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xl ${!isActive && 'opacity-40 grayscale'}`}>
                              {mod.icon}
                            </span>
                            <span className={`font-medium ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                              {mod.name}
                            </span>
                          </div>

                          <button
                            onClick={() => handleToggleModule(mod.id)}
                            className={`
                              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${isActive ? 'bg-green-500' : 'bg-gray-300'}
                            `}
                            title={isActive ? 'Desativar módulo' : 'Ativar módulo'}
                          >
                            <span
                              className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm
                                ${isActive ? 'translate-x-6' : 'translate-x-1'}
                              `}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Informação importante:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Use o toggle da seção para ativar/desativar todos os módulos de uma vez</li>
                <li>Módulos desativados ficarão em cinza e inacessíveis no menu lateral</li>
                <li>Apenas administradores podem ativar/desativar módulos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
