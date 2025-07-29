/**
 * SERVIDOR PRINCIPAL - Nodex VPN Server con WireGuard
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config';
import { WireGuardServer } from './vpn/WireGuardServer';
import authRoutes from './api/auth';
import vpnRoutes from './api/vpn';
import usersRoutes from './api/users';
import { initFirebase } from './firebase';
import { ApiResponse } from './types';

const app = express();

// Inicializar servidor WireGuard
const wireGuardServer = new WireGuardServer(
  config.vpn.serverIp, 
  config.vpn.wireGuardPort || 51820
);

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar para desarrollo
}));

// CORS
app.use(cors({
  origin: config.cors.allowedOrigins.includes('*') 
    ? true 
    : config.cors.allowedOrigins,
  credentials: true
}));

// Parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', async (req, res) => {
  const stats = await wireGuardServer.getConnectionStats();
  
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'OK',
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
      vpnServer: {
        type: 'WireGuard',
        status: wireGuardServer.isRunning() ? 'running' : 'stopped',
        connections: stats.totalPeers || 0,
        peers: stats.peers || []
      }
    },
    timestamp: new Date()
  };
  res.json(response);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/users', usersRoutes);

// Ruta para obtener información del servidor
app.get('/api/server/info', async (req, res) => {
  const serverConfig = wireGuardServer.getServerConfig();
  const stats = await wireGuardServer.getConnectionStats();
  
  const response: ApiResponse = {
    success: true,
    data: {
      name: 'Nodex VPN Server',
      type: 'WireGuard',
      location: 'Europe',
      flag: '🇪🇸',
      address: serverConfig.address,
      port: serverConfig.port,
      publicKey: serverConfig.publicKey,
      ping: 25,
      load: Math.round((stats.totalPeers / 100) * 100), // Estimado
      available: wireGuardServer.isRunning(),
      maxConnections: 100,
      activeConnections: stats.totalPeers || 0,
      protocol: 'WireGuard'
    },
    timestamp: new Date()
  };
  res.json(response);
});

// Nuevo endpoint para generar configuración WireGuard
app.post('/api/vpn/wireguard-config', async (req, res) => {
  try {
    console.log('🔄 INICIANDO generación de configuración WireGuard...');
    console.log('📥 Request body:', req.body);
    
    const userId = req.body.userId || 'anonymous-' + Date.now();
    console.log('👤 User ID:', userId);
    
    console.log('🔧 Llamando a wireGuardServer.generateClientConfig...');
    const config = await wireGuardServer.generateClientConfig(userId);
    
    console.log('✅ Configuración generada exitosamente');
    console.log('📋 Tipo de configuración:', typeof config);
    console.log('📋 Longitud de configuración:', config ? config.length : 'N/A');
    console.log('📋 Primeros 200 caracteres:', config ? config.substring(0, 200) + '...' : 'NULL');
    
    const response: ApiResponse = {
      success: true,
      data: {
        config,
        serverInfo: wireGuardServer.getServerConfig(),
        userId
      },
      timestamp: new Date()
    };
    
    console.log('📤 Enviando respuesta al cliente...');
    console.log('📤 Respuesta structure:', {
      success: response.success,
      hasData: !!response.data,
      hasConfig: !!(response.data && response.data.config),
      configType: response.data ? typeof response.data.config : 'N/A'
    });
    
    res.json(response);
  } catch (error) {
    console.error('❌ ERROR generando configuración WireGuard:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Error generando configuración',
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

// Manejo de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error del servidor:', err);
  
  const response: ApiResponse = {
    success: false,
    error: config.NODE_ENV === 'development' 
      ? err.message 
      : 'Error interno del servidor',
    timestamp: new Date()
  };
  
  res.status(err.status || 500).json(response);
});

// Ruta 404
app.use('*', (req, res) => {
  const response: ApiResponse = {
    success: false,
    error: 'Endpoint no encontrado',
    timestamp: new Date()
  };
  res.status(404).json(response);
});

/**
 * Inicializar servidor
 */
async function startServer() {
  try {
    console.log('🚀 Iniciando Nodex VPN Server con WireGuard...');
    
    // Inicializar Firebase si está configurado
    if (config.firebase.projectId) {
      await initFirebase();
      console.log('✅ Firebase inicializado');
    } else {
      console.log('⚠️  Firebase no configurado, usando autenticación simple');
    }
    
    // Iniciar servidor WireGuard
    await wireGuardServer.start();
    console.log(`✅ WireGuard Server iniciado en ${config.vpn.serverIp}:${config.vpn.wireGuardPort || 51820}`);
    
    // Iniciar servidor HTTP
    const server = app.listen(config.PORT, () => {
      console.log(`✅ Servidor HTTP corriendo en puerto ${config.PORT}`);
      console.log(`🌍 Entorno: ${config.NODE_ENV}`);
      console.log(`🔗 API: http://${config.vpn.serverIp}:${config.PORT}`);
      console.log(`🔒 VPN: WireGuard en ${config.vpn.serverIp}:${config.vpn.wireGuardPort || 51820}`);
    });

    // Manejo de cierre graceful
    process.on('SIGTERM', async () => {
      console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
      await shutdown(server);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
      await shutdown(server);
    });

  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

/**
 * Cierre graceful del servidor
 */
async function shutdown(server: any) {
  console.log('🔄 Cerrando servidor WireGuard...');
  await wireGuardServer.stop();
  
  console.log('🔄 Cerrando servidor HTTP...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
  
  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    console.log('⏰ Forzando cierre del servidor');
    process.exit(1);
  }, 10000);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada no manejada:', reason);
  process.exit(1);
});

// Iniciar servidor
startServer();

/**
 * Exportar instancia de WireGuard server para diagnósticos
 */
export function getWireGuardServer(): WireGuardServer {
  return wireGuardServer;
}

export default app; 