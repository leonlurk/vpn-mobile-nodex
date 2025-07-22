/**
 * TIPOS TYPESCRIPT - Servidor VPN Nodex
 */

// Configuración del servidor VPN
export interface VpnServerConfig {
  serverIp: string;
  tcpPort: number;
  udpPort: number;
  maxConnections: number;
  connectionTimeout: number;
  keepAliveInterval: number;
}

// Configuración de conexión del cliente
export interface ClientVpnConfig {
  serverAddress: string;
  serverPort: number;
  authToken: string;
  clientId?: string;
}

// Estado de conexión
export interface ConnectionState {
  clientId: string;
  userId: string;
  connected: boolean;
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
  connectedAt?: Date;
  lastActivity?: Date;
  bytesReceived: number;
  bytesSent: number;
}

// Estadísticas de conexión
export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  connectionTime: number;
  serverLocation: string;
  ping: number;
}

// Información del servidor
export interface ServerInfo {
  id: string;
  name: string;
  location: string;
  flag: string;
  address: string;
  port: number;
  ping: number;
  load: number;
  available: boolean;
}

// Usuario autenticado
export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  customClaims?: any;
}

// Paquete del protocolo Nodex
export interface NodexPacket {
  version: number;
  type: PacketType;
  timestamp: number;
  length: number;
  payload: Buffer;
  signature: Buffer;
}

// Tipos de paquetes del protocolo
export enum PacketType {
  AUTH_REQUEST = 0x01,
  AUTH_RESPONSE = 0x02,
  TUNNEL_DATA = 0x03,
  KEEP_ALIVE = 0x04,
  DISCONNECT = 0x05,
  ERROR = 0x06
}

// Evento de conexión VPN
export interface VpnConnectionEvent {
  clientId: string;
  userId: string;
  event: 'connected' | 'disconnected' | 'error';
  timestamp: Date;
  data?: any;
}

// Configuración de Firebase
export interface FirebaseConfig {
  projectId: string;
  privateKeyPath: string;
  databaseURL?: string;
}

// Respuesta de la API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// Request con usuario autenticado
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Configuración del túnel
export interface TunnelConfig {
  clientIp: string;
  serverIp: string;
  dns: string[];
  routes: string[];
  mtu: number;
} 