/**
 * API ROUTES - Control VPN
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';

const router = Router();

// Simulador de conexiones activas
const activeConnections = new Map();

/**
 * Iniciar conexión VPN
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { serverAddress, authToken } = req.body;

    if (!serverAddress || !authToken) {
      return res.status(400).json({
        success: false,
        error: 'serverAddress y authToken requeridos',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Simular conexión
    const connectionId = `conn-${Date.now()}`;
    activeConnections.set(connectionId, {
      serverAddress,
      connectedAt: new Date(),
      status: 'connected',
      bytesReceived: 0,
      bytesSent: 0
    });

    const response: ApiResponse = {
      success: true,
      data: {
        connectionId,
        status: 'connected',
        message: 'Conexión VPN establecida',
        server: {
          address: serverAddress,
          location: 'Europe',
          ping: 25
        }
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error conectando VPN:', error);
    res.status(500).json({
      success: false,
      error: 'Error estableciendo conexión VPN',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Desconectar VPN
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.body;

    if (connectionId && activeConnections.has(connectionId)) {
      activeConnections.delete(connectionId);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        status: 'disconnected',
        message: 'Conexión VPN terminada'
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error desconectando VPN:', error);
    res.status(500).json({
      success: false,
      error: 'Error terminando conexión VPN',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Estado de conexión VPN
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.query;

    if (connectionId && activeConnections.has(connectionId)) {
      const connection = activeConnections.get(connectionId);
      
      const response: ApiResponse = {
        success: true,
        data: {
          connected: true,
          status: 'connected',
          connectionTime: Date.now() - connection.connectedAt.getTime(),
          server: connection.serverAddress
        },
        timestamp: new Date()
      };

      res.json(response);
    } else {
      const response: ApiResponse = {
        success: true,
        data: {
          connected: false,
          status: 'disconnected'
        },
        timestamp: new Date()
      };

      res.json(response);
    }

  } catch (error) {
    console.error('❌ Error obteniendo estado VPN:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de conexión',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Estadísticas de conexión
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.query;

    let stats = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      connectionTime: 0,
      ping: 25
    };

    if (connectionId && activeConnections.has(connectionId)) {
      const connection = activeConnections.get(connectionId);
      stats.connectionTime = Date.now() - connection.connectedAt.getTime();
      // Simular estadísticas
      stats.bytesReceived = Math.floor(Math.random() * 1000000);
      stats.bytesSent = Math.floor(Math.random() * 500000);
      stats.packetsReceived = Math.floor(stats.bytesReceived / 1500);
      stats.packetsSent = Math.floor(stats.bytesSent / 1500);
    }

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Lista de servidores disponibles
 */
router.get('/servers', async (req: Request, res: Response) => {
  try {
    const servers = [
      { id: 'us-ny', name: 'Estados Unidos (NY)', flag: '🇺🇸', address: '92.113.32.217', ping: 25, load: 45 },
      { id: 'uk', name: 'Reino Unido', flag: '🇬🇧', address: '92.113.32.217', ping: 35, load: 60 },
      { id: 'de', name: 'Alemania', flag: '🇩🇪', address: '92.113.32.217', ping: 40, load: 30 },
    ];

    const response: ApiResponse = {
      success: true,
      data: servers,
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo lista de servidores',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Diagnóstico del servidor VPN
 */
router.get('/diagnostic', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Ejecutando diagnóstico del servidor VPN...');
    
    // Importar dinámicamente el servidor WireGuard
    const { getWireGuardServer } = await import('../server');
    const wireGuardServer = getWireGuardServer();
    
    if (!wireGuardServer) {
      return res.status(500).json({
        success: false,
        error: 'Servidor WireGuard no inicializado',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Obtener estadísticas
    const stats = await wireGuardServer.getConnectionStats();
    const serverConfig = wireGuardServer.getServerConfig();
    const isRunning = wireGuardServer.isRunning();

    const response: ApiResponse = {
      success: true,
      data: {
        server: {
          running: isRunning,
          publicKey: serverConfig.publicKey,
          address: serverConfig.address,
          port: serverConfig.port
        },
        connections: stats,
        timestamp: new Date()
      },
      timestamp: new Date()
    };

    res.json(response);
    console.log('✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando diagnóstico: ' + error,
      timestamp: new Date()
    } as ApiResponse);
  }
});

export default router; 