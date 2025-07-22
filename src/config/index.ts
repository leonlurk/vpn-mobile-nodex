/**
 * CONFIGURACIÓN DEL SERVIDOR - Variables de entorno
 */

import dotenv from 'dotenv';
import { VpnServerConfig, FirebaseConfig } from '../types';

// Cargar variables de entorno
dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'VPN_TCP_PORT', 
  'VPN_UDP_PORT',
  'SERVER_IP',
  'JWT_SECRET'
];

// Verificar variables requeridas
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Variable de entorno requerida: ${envVar}`);
  }
}

export const config = {
  // Configuración del servidor
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  
  // Configuración VPN
  vpn: {
    serverIp: process.env.SERVER_IP!,
    tcpPort: parseInt(process.env.VPN_TCP_PORT!),
    udpPort: parseInt(process.env.VPN_UDP_PORT!),
    maxConnections: parseInt(process.env.MAX_CONCURRENT_CONNECTIONS || '100'),
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000'),
    keepAliveInterval: parseInt(process.env.KEEP_ALIVE_INTERVAL || '30000')
  } as VpnServerConfig,

  // Configuración JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // Configuración Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKeyPath: process.env.FIREBASE_PRIVATE_KEY_PATH || './config/firebase-admin.json',
    databaseURL: process.env.FIREBASE_DATABASE_URL
  } as FirebaseConfig,

  // Configuración CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  },

  // Configuración de logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    file: './logs/server.log'
  },

  // Configuración de la base de datos (fallback)
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./data/nodex.db'
  }
};

// Verificar configuración en desarrollo
if (config.NODE_ENV === 'development') {
  console.log('🔧 Configuración del servidor:', {
    ...config,
    jwt: { ...config.jwt, secret: '[HIDDEN]' }
  });
}

export default config; 