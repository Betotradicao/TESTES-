import { Router } from 'express';
import * as net from 'net';

const router: Router = Router();

/**
 * Teste TCP rápido de porta (timeout curto para não travar o health)
 */
function testPort(host: string, port: number, timeout: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

router.get('/health', async (req, res) => {
  try {
    const { AppDataSource } = require('../config/database');
    const isDatabaseConnected = AppDataSource.isInitialized;

    // Verificar conexões externas cadastradas (Oracle, etc.)
    let externalConnections: any[] = [];
    try {
      if (isDatabaseConnected) {
        const { DatabaseConnection } = require('../entities/DatabaseConnection');
        const repo = AppDataSource.getRepository(DatabaseConnection);
        const connections = await repo.find();

        const isVps = process.env.NODE_ENV === 'production';
        for (const conn of connections) {
          const hostToUse = isVps && conn.host_vps ? conn.host_vps : conn.host;
          const reachable = await testPort(hostToUse, conn.port);
          externalConnections.push({
            name: conn.name,
            type: conn.type,
            host: hostToUse,
            port: conn.port,
            reachable
          });
        }
      }
    } catch (e) {
      // Não impede o health de funcionar
    }

    const allExternalOk = externalConnections.length === 0 || externalConnections.every(c => c.reachable);

    res.json({
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        connected: isDatabaseConnected
      },
      externalDatabases: {
        configured: externalConnections.length > 0,
        allConnected: allExternalOk,
        connections: externalConnections
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'API is running with errors',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        connected: false
      },
      externalDatabases: {
        configured: false,
        allConnected: false,
        connections: []
      }
    });
  }
});

export default router;