import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EmployeesService } from '../services/employees.service';
import { EmployeePermissionsService } from '../services/employee-permissions.service';
import { validateCreateEmployee } from '../dtos/create-employee.dto';
import { validateUpdateEmployee } from '../dtos/update-employee.dto';

export class EmployeesController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const onlyActive = req.query.active === 'true';
      const codLoja = req.query.codLoja ? parseInt(req.query.codLoja as string) : undefined;

      const result = await EmployeesService.findAll(page, limit, onlyActive, codLoja);

      res.json(result);
    } catch (error) {
      console.error('Get all employees error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const employee = await EmployeesService.findById(id);
      res.json(employee);
    } catch (error: any) {
      console.error('Get employee by ID error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const validation = validateCreateEmployee(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const employee = await EmployeesService.create(req.body);
      res.status(201).json(employee);
    } catch (error: any) {
      console.error('Create employee error:', error);

      if (error.message === 'Username already exists') {
        return res.status(409).json({ error: error.message });
      }

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Cannot assign employee to inactive sector') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const validation = validateUpdateEmployee(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const employee = await EmployeesService.update(id, req.body);
      res.json(employee);
    } catch (error: any) {
      console.error('Update employee error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Username already exists') {
        return res.status(409).json({ error: error.message });
      }

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Cannot assign employee to inactive sector') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }

      const employee = await EmployeesService.uploadAvatar(id, req.file);
      res.json(employee);
    } catch (error: any) {
      console.error('Upload avatar error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async toggleStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const employee = await EmployeesService.toggleStatus(id);
      res.json(employee);
    } catch (error: any) {
      console.error('Toggle employee status error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async resetPassword(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const result = await EmployeesService.resetPassword(id, newPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Reset password error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Profile methods for logged-in employee
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can access their profile' });
      }

      const employee = await EmployeesService.findById(req.user.id);
      res.json(employee);
    } catch (error: any) {
      console.error('Get profile error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can update their profile' });
      }

      // Only allow name to be updated
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const employee = await EmployeesService.update(req.user.id, { name: name.trim() });
      res.json(employee);
    } catch (error: any) {
      console.error('Update profile error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfileAvatar(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can update their avatar' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }

      const employee = await EmployeesService.uploadAvatar(req.user.id, req.file);
      res.json(employee);
    } catch (error: any) {
      console.error('Update profile avatar error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can change their password' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      const result = await EmployeesService.changePassword(req.user.id, currentPassword, newPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Change password error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Current password is incorrect') {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Permissions methods
  static async getPermissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verificar se employee existe
      await EmployeesService.findById(id);

      const permissions = await EmployeePermissionsService.getPermissions(id);
      res.json(permissions);
    } catch (error: any) {
      console.error('Get employee permissions error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updatePermissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Permissions must be an array' });
      }

      // Verificar se employee existe
      await EmployeesService.findById(id);

      const result = await EmployeePermissionsService.updatePermissions(id, permissions);
      res.json(result);
    } catch (error: any) {
      console.error('Update employee permissions error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await EmployeesService.delete(id);
      res.json(result);
    } catch (error: any) {
      console.error('Delete employee error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
