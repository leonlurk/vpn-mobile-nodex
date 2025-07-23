/**
 * TIPOS TYPESCRIPT - Servidor VPN Nodex con WireGuard
 */

// Configuración del servidor VPN (legacy)
export interface VpnServerConfig {
  serverIp: string;
  tcpPort: number;
  udpPort: number;
  maxConnections: number;
  connectionTimeout: number;
  keepAliveInterval: number;
}

// Configuración WireGuard
export interface WireGuardConfig {
  wireGuardPort: number;
  interface: string;
  serverVpnIp: string;
  clientSubnet: string;
  dns: string[];
}

// Peer de WireGuard
export interface WireGuardPeer {
  userId: string;
  publicKey: string;
  privateKey: string;
  allowedIPs: string;
  endpoint?: string;
  lastHandshake?: Date;
  bytesReceived?: number;
  bytesSent?: number;
}

// Configuración del cliente WireGuard
export interface WireGuardClientConfig {
  clientPrivateKey: string;
  clientPublicKey: string;
  clientAddress: string;
  serverPublicKey: string;
  serverEndpoint: string;
  dns: string[];
  allowedIPs: string;
}

// Configuración de conexión del cliente (legacy)
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
  protocol?: 'nodex' | 'wireguard';
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
  protocol: 'nodex' | 'wireguard';
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
  protocol?: 'nodex' | 'wireguard';
  publicKey?: string; // Para WireGuard
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

// Paquete del protocolo Nodex (legacy)
export interface NodexPacket {
  version: number;
  type: PacketType;
  timestamp: number;
  length: number;
  payload: Buffer;
  signature: Buffer;
}

// Tipos de paquetes del protocolo (legacy)
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
  protocol?: 'nodex' | 'wireguard';
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

// Configuración del túnel (legacy)
export interface TunnelConfig {
  clientIp: string;
  serverIp: string;
  dns: string[];
  routes: string[];
  mtu: number;
}

// Estadísticas del servidor WireGuard
export interface WireGuardStats {
  peers: WireGuardPeer[];
  totalPeers: number;
  interface: string;
  serverLoad: number;
} 