/**
 * SERVIDOR PRINCIPAL - Nodex VPN Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config';
import { NodexServer } from './vpn/NodexServer';
import authRoutes from './api/auth';
import vpnRoutes from './api/vpn';
import usersRoutes from './api/users';
import { initFirebase } from './firebase';
import { ApiResponse } from './types';

const app = express();

// Inicializar servidor VPN
const vpnServer = new NodexServer(config.vpn);

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
app.get('/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'OK',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
      vpnServer: {
        status: vpnServer.isRunning() ? 'running' : 'stopped',
        connections: vpnServer.getActiveConnections().length
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
app.get('/api/server/info', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      name: 'Nodex VPN Server',
      location: 'Europe',
      flag: '🇪🇺',
      address: config.vpn.serverIp,
      port: config.vpn.tcpPort,
      ping: 25,
      load: vpnServer.getServerLoad(),
      available: vpnServer.isRunning(),
      maxConnections: config.vpn.maxConnections,
      activeConnections: vpnServer.getActiveConnections().length
    },
    timestamp: new Date()
  };
  res.json(response);
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
    console.log('🚀 Iniciando Nodex VPN Server...');
    
    // Inicializar Firebase si está configurado
    if (config.firebase.projectId) {
      await initFirebase();
      console.log('✅ Firebase inicializado');
    } else {
      console.log('⚠️  Firebase no configurado, usando autenticación simple');
    }
    
    // Iniciar servidor VPN
    await vpnServer.start();
    console.log(`✅ Servidor VPN iniciado en puertos TCP:${config.vpn.tcpPort}, UDP:${config.vpn.udpPort}`);
    
    // Iniciar servidor HTTP
    const server = app.listen(config.PORT, () => {
      console.log(`✅ Servidor HTTP corriendo en puerto ${config.PORT}`);
      console.log(`🌍 Entorno: ${config.NODE_ENV}`);
      console.log(`🔗 API: http://${config.vpn.serverIp}:${config.PORT}`);
      console.log(`🔒 VPN: ${config.vpn.serverIp}:${config.vpn.tcpPort}`);
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
  console.log('🔄 Cerrando conexiones VPN...');
  await vpnServer.stop();
  
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

export default app; 