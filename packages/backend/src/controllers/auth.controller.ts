import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Employee } from '../entities/Employee';
import { EmployeePermissionsService } from '../services/employee-permissions.service';

export class AuthController {
  static async me(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          type: 'admin',
          role: user.role,
          isMaster: user.isMaster,
          company: user.company ? {
            id: user.company.id,
            nomeFantasia: user.company.nomeFantasia,
            razaoSocial: user.company.razaoSocial,
            cnpj: user.company.cnpj
          } : null
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { name, username, email, currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Atualizar nome
      if (name) user.name = name;

      // Atualizar username (verificar se não está em uso)
      if (username && username !== user.username) {
        const existingUser = await userRepository.findOne({ where: { username } });
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: 'Username already in use' });
        }
        user.username = username;
      }

      // Atualizar email (verificar se não está em uso)
      if (email && email !== user.email) {
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: 'Email already in use' });
        }
        user.email = email;
      }

      // Atualizar senha se fornecida
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to change password' });
        }

        const isValidPassword = await user.validatePassword(currentPassword);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
      }

      await userRepository.save(user);

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          isMaster: user.isMaster
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      console.log('🔐 Tentativa de login:', { email, origin: req.headers.origin });

      if (!email || !password) {
        console.log('❌ Login falhou: campos vazios');
        return res.status(400).json({ error: 'Email/username and password are required' });
      }

      // Try to find user by email OR username (admin users)
      const userRepository = AppDataSource.getRepository(User);
      let user = await userRepository.findOne({
        where: { email },
        relations: ['company']
      });

      // Se não encontrou por email, tenta por username
      if (!user) {
        user = await userRepository.findOne({
          where: { username: email }, // O campo 'email' do form pode ser username
          relations: ['company']
        });
      }

      if (user) {
        console.log('✅ Usuário admin encontrado:', user.email);
        // User found - validate password
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          console.log('❌ Senha inválida para admin');
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('✅ Login admin bem-sucedido!');
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            type: 'admin',
            role: user.role,
            isMaster: user.isMaster,
            companyId: user.companyId
          },
          process.env.JWT_SECRET || 'development-secret',
          { expiresIn: '24h' }
        );

        return res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            email: user.email,
            type: 'admin',
            role: user.role,
            isMaster: user.isMaster,
            company: user.company ? {
              id: user.company.id,
              nomeFantasia: user.company.nomeFantasia,
              razaoSocial: user.company.razaoSocial,
              cnpj: user.company.cnpj
            } : null
          }
        });
      }

      // If not found as user, try to find as employee by username
      const employeeRepository = AppDataSource.getRepository(Employee);
      const employee = await employeeRepository.findOne({
        where: { username: email },
        relations: ['sector']
      });

      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if employee is active
      if (!employee.active) {
        return res.status(401).json({ error: 'Employee account is inactive' });
      }

      // Validate password
      const isValidPassword = await bcrypt.compare(password, employee.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Buscar permissões do colaborador
      const permissions = await EmployeePermissionsService.getPermissions(employee.id);

      const token = jwt.sign(
        { id: employee.id, username: employee.username, type: 'employee' },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: employee.id,
          name: employee.name,
          username: employee.username,
          avatar: employee.avatar,
          sector: employee.sector ? {
            id: employee.sector.id,
            name: employee.sector.name,
            color_hash: employee.sector.color_hash
          } : null,
          function_description: employee.function_description,
          first_access: employee.first_access,
          barcode: employee.barcode,
          type: 'employee',
          permissions // Incluir permissões no response
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}