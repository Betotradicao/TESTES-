import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    username?: string;
    type: 'admin' | 'employee';
    role?: UserRole;
    isMaster?: boolean;
    companyId?: string | null;
  };
  userId?: string; // Para compatibilidade com controllers existentes
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('🔐 AUTHENTICATE TOKEN - Path:', req.path, 'Method:', req.method);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ AUTHENTICATE TOKEN - Token ausente!');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'development-secret', (err: any, user: any) => {
    if (err) {
      console.log('❌ AUTHENTICATE TOKEN - Token inválido:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('✅ AUTHENTICATE TOKEN - Sucesso! User:', user.email, 'Role:', user.role, 'isMaster:', user.isMaster);
    req.user = user;
    req.userId = user.id; // Para compatibilidade com controllers existentes
    next();
  });
};

// Simple token authentication for external integrations (n8n, etc)
export const authenticateApiToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const apiToken = process.env.API_TOKEN;

  if (!apiToken) {
    return res.status(500).json({ error: 'Unauthorized' });
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (token !== apiToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Set a mock user for compatibility
  req.user = {
    id: 'api-integration',
    email: 'api@system.local',
    type: 'admin'
  };

  next();
};

// Middleware that accepts BOTH API token OR JWT token (for webhook endpoints)
export const authenticateWebhook = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Try API token first
  const apiToken = process.env.API_TOKEN;
  if (apiToken && token === apiToken) {
    req.user = {
      id: 'api-integration',
      email: 'api@system.local',
      type: 'admin'
    };
    return next();
  }

  // Try JWT token
  jwt.verify(token, process.env.JWT_SECRET || 'development-secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware to check if user is master (Roberto - role MASTER)
export const isMaster = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Verificar se tem role MASTER ou isMaster flag
  if (req.user.role !== UserRole.MASTER && !req.user.isMaster) {
    return res.status(403).json({ error: 'Master access required' });
  }

  next();
};

// Middleware to check if user is company admin or master
export const isAdminOrMaster = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Master ou admin da empresa
    if (user.isMaster || user.role === UserRole.ADMIN) {
      return next();
    }

    return res.status(403).json({ error: 'Admin or Master access required' });
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return res.status(500).json({ error: 'Failed to check permissions' });
  }
};