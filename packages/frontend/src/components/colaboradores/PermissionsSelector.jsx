import { useState, useEffect } from 'react';
import { MENU_STRUCTURE } from '../../constants/menuConstants';

export default function PermissionsSelector({ selectedPermissions, onChange }) {
  const [permissions, setPermissions] = useState({});

  // Inicializar permissions do prop
  useEffect(() => {
    if (selectedPermissions && Array.isArray(selectedPermissions)) {
      const permissionsObj = {};
      selectedPermissions.forEach(perm => {
        permissionsObj[perm.moduleId] = {
          fullAccess: !perm.submenus || perm.submenus.length === 0,
          submenus: perm.submenus || []
        };
      });
      setPermissions(permissionsObj);
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
      // Ativar acesso total
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    } else if (newPermissions[moduleId].fullAccess) {
      // Desativar acesso total - remove módulo
      delete newPermissions[moduleId];
    } else {
      // Tinha acesso parcial, agora ativar total
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    }

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

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Selecione os módulos e funcionalidades que este colaborador poderá acessar:
      </div>

      {MENU_STRUCTURE.filter(module => module.submenus.length > 0).map(module => (
        <div key={module.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          {/* Header do Módulo */}
          <div className="flex items-center mb-3">
            <input
              type="checkbox"
              id={`module-${module.id}`}
              checked={hasFullAccess(module.id)}
              onChange={() => toggleModuleFullAccess(module.id, module)}
              className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
            />
            <label
              htmlFor={`module-${module.id}`}
              className="ml-3 text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              {module.title} - Acesso Total ao Módulo
            </label>
          </div>

          {/* Sub-menus */}
          {module.submenus.length > 0 && (
            <div className="ml-7 space-y-2">
              <div className="text-xs text-gray-500 mb-2">Sub-menus:</div>
              {module.submenus.map(submenu => (
                <div key={submenu.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`submenu-${module.id}-${submenu.id}`}
                    checked={isSubmenuSelected(module.id, submenu.id)}
                    onChange={() => toggleSubmenu(module.id, submenu.id, module)}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label
                    htmlFor={`submenu-${module.id}-${submenu.id}`}
                    className="ml-3 text-sm text-gray-700 cursor-pointer select-none"
                  >
                    {submenu.title}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Resumo */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Resumo:</strong> {Object.keys(permissions).length} módulo(s) com acesso configurado
        </div>
      </div>
    </div>
  );
}
