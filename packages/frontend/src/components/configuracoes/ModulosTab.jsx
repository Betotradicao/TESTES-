import { useState, useEffect } from 'react';

export default function ModulosTab() {
  const [modules, setModules] = useState([
    { id: 'dashboard', name: 'Boas Vindas', icon: '📊', active: true },
    { id: 'bipagens', name: 'Prevenção de Bipagens', icon: '🔍', active: true },
    { id: 'pdv', name: 'Prevenção de PDV', icon: '💳', active: true },
    { id: 'facial', name: 'Prevenção Facial', icon: '👤', active: true }
  ]);

  const [success, setSuccess] = useState(null);

  // Carregar configuração salva do localStorage
  useEffect(() => {
    const savedModules = localStorage.getItem('modules_config');
    if (savedModules) {
      try {
        setModules(JSON.parse(savedModules));
      } catch (err) {
        console.error('Erro ao carregar módulos:', err);
      }
    }
  }, []);

  const handleToggleModule = (moduleId) => {
    setModules(prev => {
      const updated = prev.map(mod =>
        mod.id === moduleId ? { ...mod, active: !mod.active } : mod
      );

      // Salvar no localStorage
      localStorage.setItem('modules_config', JSON.stringify(updated));

      // Disparar evento para atualizar o Sidebar
      window.dispatchEvent(new Event('storage'));

      setSuccess(`Módulo ${updated.find(m => m.id === moduleId).name} ${updated.find(m => m.id === moduleId).active ? 'ativado' : 'desativado'} com sucesso!`);
      setTimeout(() => setSuccess(null), 3000);

      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Gerenciar Módulos do Sistema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Ative ou desative módulos do menu lateral. Módulos desativados ficarão em cinza e inacessíveis.
          </p>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <div className="space-y-3">
          {modules.map(module => (
            <div
              key={module.id}
              className={`
                border rounded-lg p-4 transition-all
                ${module.active
                  ? 'border-gray-200 bg-white hover:bg-gray-50'
                  : 'border-gray-300 bg-gray-100'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`
                    text-3xl
                    ${!module.active && 'opacity-40 grayscale'}
                  `}>
                    {module.icon}
                  </div>
                  <div>
                    <h3 className={`
                      font-semibold text-lg
                      ${module.active ? 'text-gray-900' : 'text-gray-500'}
                    `}>
                      {module.name}
                    </h3>
                    <p className={`
                      text-sm
                      ${module.active ? 'text-gray-600' : 'text-gray-400'}
                    `}>
                      {module.active ? 'Módulo ativo e acessível' : 'Módulo desativado (apenas visualização)'}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => handleToggleModule(module.id)}
                  className={`
                    relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                    ${module.active ? 'bg-green-500' : 'bg-gray-300'}
                  `}
                  title={module.active ? 'Desativar módulo' : 'Ativar módulo'}
                >
                  <span
                    className={`
                      inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                      ${module.active ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Informação importante:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Módulos desativados continuarão visíveis no menu, mas ficarão em cinza claro</li>
                <li>Ao tentar acessar um módulo desativado, o usuário verá uma mensagem informativa</li>
                <li>Apenas administradores podem ativar/desativar módulos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
