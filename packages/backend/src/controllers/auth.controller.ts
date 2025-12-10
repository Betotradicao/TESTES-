import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Employee } from '../entities/Employee';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      console.log('🔐 Tentativa de login:', { email, origin: req.headers.origin });

      if (!email || !password) {
        console.log('❌ Login falhou: campos vazios');
        return res.status(400).json({ error: 'Email/username and password are required' });
      }

      // Try to find user by email first (admin users)
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email },
        relations: ['company']
      });

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
          type: 'employee'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}