import { AppDataSource } from '../config/database';
import { EmployeePermission } from '../entities/EmployeePermission';

interface PermissionInput {
  moduleId: string;
  submenus: string[] | null;
}

export class EmployeePermissionsService {
  /**
   * Buscar permissões de um colaborador e retornar agrupadas por módulo
   */
  static async getPermissions(employeeId: string): Promise<Record<string, string[]>> {
    const permissionRepository = AppDataSource.getRepository(EmployeePermission);

    const permissions = await permissionRepository.find({
      where: { employee_id: employeeId },
    });

    // Agrupar por módulo
    const grouped: Record<string, string[]> = {};
    const fullAccessModules = new Set<string>();

    // Primeiro pass: identificar módulos com acesso total
    for (const perm of permissions) {
      if (perm.submenu_id === null) {
        fullAccessModules.add(perm.module_id);
        grouped[perm.module_id] = []; // Array vazio = acesso total
      }
    }

    // Segundo pass: adicionar sub-menus específicos (apenas se não for acesso total)
    for (const perm of permissions) {
      if (perm.submenu_id !== null && !fullAccessModules.has(perm.module_id)) {
        if (!grouped[perm.module_id]) {
          grouped[perm.module_id] = [];
        }
        if (!grouped[perm.module_id].includes(perm.submenu_id)) {
          grouped[perm.module_id].push(perm.submenu_id);
        }
      }
    }

    console.log('📋 Backend - Permissões agrupadas:', grouped);
    return grouped;
  }

  /**
   * Atualizar permissões de um colaborador
   * Deleta todas as permissões antigas e cria novas
   */
  static async updatePermissions(
    employeeId: string,
    permissions: PermissionInput[]
  ): Promise<{ message: string; permissions: Record<string, string[]> }> {
    const permissionRepository = AppDataSource.getRepository(EmployeePermission);

    // 1. Deletar todas as permissões antigas do colaborador
    await permissionRepository.delete({ employee_id: employeeId });

    // 2. Criar novas permissões
    const newPermissions: Partial<EmployeePermission>[] = [];

    for (const perm of permissions) {
      if (!perm.submenus || perm.submenus.length === 0) {
        // Acesso total ao módulo (submenu_id = null)
        newPermissions.push({
          employee_id: employeeId,
          module_id: perm.moduleId,
          submenu_id: null,
        });
      } else {
        // Acesso a sub-menus específicos
        for (const submenuId of perm.submenus) {
          newPermissions.push({
            employee_id: employeeId,
            module_id: perm.moduleId,
            submenu_id: submenuId,
          });
        }
      }
    }

    // Salvar novas permissões
    if (newPermissions.length > 0) {
      await permissionRepository.save(newPermissions);
    }

    // Retornar permissões atualizadas
    const updatedPermissions = await this.getPermissions(employeeId);

    return {
      message: 'Permissions updated successfully',
      permissions: updatedPermissions,
    };
  }

  /**
   * Deletar todas as permissões de um colaborador
   */
  static async deleteAllPermissions(employeeId: string): Promise<void> {
    const permissionRepository = AppDataSource.getRepository(EmployeePermission);
    await permissionRepository.delete({ employee_id: employeeId });
  }
}
