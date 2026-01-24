import { useState, useEffect, useRef } from 'react';
import { MENU_STRUCTURE } from '../../constants/menuConstants';

export default function PermissionsSelector({ selectedPermissions, onChange }) {
  const [permissions, setPermissions] = useState({});
  const moduleCheckboxRefs = useRef({});

  // Inicializar permissions do prop
  useEffect(() => {
    console.log('🔄 PermissionsSelector recebeu selectedPermissions:', selectedPermissions);

    if (selectedPermissions && Array.isArray(selectedPermissions) && selectedPermissions.length > 0) {
      const permissionsObj = {};
      selectedPermissions.forEach(perm => {
        // Se submenus é null = acesso total
        // Se submenus é array vazio [] = também acesso total
        // Se submenus tem itens = acesso parcial
        const isFullAccess = perm.submenus === null || (Array.isArray(perm.submenus) && perm.submenus.length === 0);

        permissionsObj[perm.moduleId] = {
          fullAccess: isFullAccess,
          submenus: perm.submenus || []
        };

        console.log(`   📦 Módulo ${perm.moduleId}:`, {
          fullAccess: isFullAccess,
          submenus: perm.submenus
        });
      });

      console.log('✅ Permissions object criado:', permissionsObj);
      setPermissions(permissionsObj);
    } else {
      console.log('⚠️ selectedPermissions está vazio, não é array, ou length = 0');
      // Limpar permissões se vier vazio
      setPermissions({});
    }
  }, [selectedPermissions]);

  // Converter permissions object para array format esperado pela API
  const convertToApiFormat = (perms) => {
    return Object.keys(perms).map(moduleId => ({
      moduleId,
      submenus: perms[moduleId].fullAccess ? null : perms[moduleId].submenus
    }));
  };

  // Toggle acesso total ao módulo
  const toggleModuleFullAccess = (moduleId, module) => {
    const newPermissions = { ...permissions };

    if (!newPermissions[moduleId]) {
      // Não tinha acesso - ativar acesso total
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    } else if (newPermissions[moduleId].fullAccess) {
      // Tinha acesso total - remover completamente
      delete newPermissions[moduleId];
    } else {
      // Tinha acesso parcial - ativar acesso total (marcar todos)
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    }

    console.log('🔄 toggleModuleFullAccess - Novo estado:', newPermissions);
    setPermissions(newPermissions);
    onChange(convertToApiFormat(newPermissions));
  };

  // Toggle submenu individual
  const toggleSubmenu = (moduleId, submenuId, module) => {
    const newPermissions = { ...permissions };

    if (!newPermissions[moduleId]) {
      // Criar novo com esse submenu
      newPermissions[moduleId] = {
        fullAccess: false,
        submenus: [submenuId]
      };
    } else if (newPermissions[moduleId].fullAccess) {
      // Estava com acesso total, agora tirar esse submenu
      const allSubmenus = module.submenus.map(s => s.id);
      const remainingSubmenus = allSubmenus.filter(id => id !== submenuId);

      if (remainingSubmenus.length === 0) {
        // Se não sobrou nenhum, remove o módulo
        delete newPermissions[moduleId];
      } else {
        newPermissions[moduleId] = {
          fullAccess: false,
          submenus: remainingSubmenus
        };
      }
    } else {
      // Acesso parcial
      const currentSubmenus = newPermissions[moduleId].submenus;

      if (currentSubmenus.includes(submenuId)) {
        // Remover submenu
        const newSubmenus = currentSubmenus.filter(id => id !== submenuId);

        if (newSubmenus.length === 0) {
          delete newPermissions[moduleId];
        } else {
          newPermissions[moduleId] = {
            fullAccess: false,
            submenus: newSubmenus
          };
        }
      } else {
        // Adicionar submenu
        const newSubmenus = [...currentSubmenus, submenuId];

        // Verificar se marcou todos - se sim, marcar como fullAccess
        if (newSubmenus.length === module.submenus.length) {
          newPermissions[moduleId] = {
            fullAccess: true,
            submenus: []
          };
        } else {
          newPermissions[moduleId] = {
            fullAccess: false,
            submenus: newSubmenus
          };
        }
      }
    }

    setPermissions(newPermissions);
    onChange(convertToApiFormat(newPermissions));
  };

  // Verificar se módulo tem acesso total
  const hasFullAccess = (moduleId) => {
    return permissions[moduleId]?.fullAccess === true;
  };

  // Verificar se submenu está selecionado
  const isSubmenuSelected = (moduleId, submenuId) => {
    if (!permissions[moduleId]) return false;
    if (permissions[moduleId].fullAccess) return true;
    return permissions[moduleId].submenus.includes(submenuId);
  };

  // Verificar se módulo tem algum acesso (parcial ou total)
  const hasAnyAccess = (moduleId) => {
    return !!permissions[moduleId];
  };

  // Verificar se módulo está em estado parcial (alguns sub-menus marcados, mas não todos)
  const hasPartialAccess = (moduleId) => {
    if (!permissions[moduleId]) return false;
    if (permissions[moduleId].fullAccess) return false;
    return permissions[moduleId].submenus.length > 0;
  };

  // Atualizar estado indeterminate dos checkboxes de módulo
  useEffect(() => {
    Object.keys(moduleCheckboxRefs.current).forEach(moduleId => {
      const checkbox = moduleCheckboxRefs.current[moduleId];
      if (checkbox) {
        checkbox.indeterminate = hasPartialAccess(moduleId);
      }
    });
  }, [permissions]);

  // Mapear emojis para cada módulo
  const moduleEmojis = {
    'bipagens': '🏷️',
    'pdv': '🛒',
    'facial': '👤',
    'ruptura': '📋',
    'etiquetas': '🔖',
    'perdas': '📊',
    'producao': '🥖',
    'hortfrut': '🥬',
    'estoque-margem': '📦',
    'compra-venda': '📈'
  };

  return (
    <div className="space-y-4">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔐</span>
          <h3 className="text-lg font-semibold text-orange-900">Controle de Permissões</h3>
        </div>
        <p className="text-sm text-orange-700">
          Selecione os módulos e funcionalidades que este colaborador poderá acessar no sistema.
        </p>
      </div>

      {MENU_STRUCTURE.filter(module => module.submenus.length > 0).map(module => {
        const moduleEmoji = moduleEmojis[module.id] || '📦';
        const hasAccess = hasAnyAccess(module.id);
        const isFullAccess = hasFullAccess(module.id);
        const isPartial = hasPartialAccess(module.id);

        return (
          <div
            key={module.id}
            className={`border-2 rounded-xl p-4 transition-all duration-200 ${
              hasAccess
                ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 shadow-sm'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            {/* Header do Módulo */}
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                ref={(el) => moduleCheckboxRefs.current[module.id] = el}
                id={`module-${module.id}`}
                checked={hasAccess}
                onChange={() => toggleModuleFullAccess(module.id, module)}
                className="w-5 h-5 text-orange-500 border-2 border-gray-300 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
              />
              <label
                htmlFor={`module-${module.id}`}
                className="ml-3 flex items-center gap-2 text-sm font-semibold cursor-pointer select-none flex-1"
              >
                <span className="text-2xl">{moduleEmoji}</span>
                <div className="flex-1">
                  <div className="text-gray-900">{module.title}</div>
                  {isFullAccess && (
                    <div className="flex items-center gap-1 text-xs text-green-700 font-medium mt-0.5">
                      <span>✅</span>
                      <span>Acesso Total ao Módulo</span>
                    </div>
                  )}
                  {isPartial && (
                    <div className="flex items-center gap-1 text-xs text-orange-700 font-medium mt-0.5">
                      <span>⚡</span>
                      <span>Acesso Parcial</span>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Sub-menus */}
            {module.submenus.length > 0 && (
              <div className="ml-9 space-y-2 mt-3 pl-4 border-l-2 border-orange-200">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-2">
                  <span>📑</span>
                  <span>Funcionalidades disponíveis:</span>
                </div>
                {module.submenus.map(submenu => (
                  <div
                    key={submenu.id}
                    className={`flex items-center p-2 rounded-lg transition-colors ${
                      isSubmenuSelected(module.id, submenu.id)
                        ? 'bg-orange-100'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`submenu-${module.id}-${submenu.id}`}
                      checked={isSubmenuSelected(module.id, submenu.id)}
                      onChange={() => toggleSubmenu(module.id, submenu.id, module)}
                      className="w-4 h-4 text-orange-500 border-2 border-gray-300 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`submenu-${module.id}-${submenu.id}`}
                      className="ml-3 text-sm text-gray-700 cursor-pointer select-none flex-1 font-medium"
                    >
                      {submenu.title}
                    </label>
                    {isSubmenuSelected(module.id, submenu.id) && (
                      <span className="text-sm">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Resumo modernizado */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-blue-900">Resumo de Permissões</div>
            <div className="text-sm text-blue-700 mt-1">
              {Object.keys(permissions).length === 0 ? (
                <span>⚠️ Nenhum módulo selecionado - colaborador não terá acesso ao sistema</span>
              ) : (
                <span>✅ {Object.keys(permissions).length} módulo(s) com acesso configurado</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
