/**
 * NODEX VPN SERVER - Servidor VPN principal
 * 
 * Implementa el protocolo VPN Nodex 100% propietario
 */

import * as net from 'net';
import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { VpnServerConfig, ConnectionState, VpnConnectionEvent } from '../types';
import { NodexProtocol } from './NodexProtocol';
import { NodexCrypto } from './NodexCrypto';

export class NodexServer extends EventEmitter {
  private config: VpnServerConfig;
  private tcpServer: net.Server | null = null;
  private udpSocket: dgram.Socket | null = null;
  private isRunning: boolean = false;
  private activeConnections: Map<string, ConnectionState> = new Map();
  private crypto: NodexCrypto;

  constructor(config: VpnServerConfig) {
    super();
    this.config = config;
    this.crypto = new NodexCrypto();
    
    console.log('🎯 NodexServer inicializado:', {
      tcpPort: config.tcpPort,
      udpPort: config.udpPort,
      maxConnections: config.maxConnections
    });
  }

  /**
   * Iniciar el servidor VPN
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('El servidor ya está en ejecución');
    }

    try {
      // Inicializar cifrado
      await this.crypto.initialize();
      
      // Iniciar servidor TCP para handshake
      await this.startTcpServer();
      
      // Iniciar servidor UDP para datos del túnel
      await this.startUdpServer();
      
      this.isRunning = true;
      console.log(`✅ Nodex VPN Server iniciado en TCP:${this.config.tcpPort}, UDP:${this.config.udpPort}`);
      
    } catch (error) {
      console.error('❌ Error iniciando servidor VPN:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Detener el servidor VPN
   */
  async stop(): Promise<void> {
    console.log('🛑 Deteniendo Nodex VPN Server...');
    
    this.isRunning = false;
    
    // Cerrar todas las conexiones activas
    for (const [clientId, connection] of this.activeConnections) {
      this.disconnectClient(clientId, 'Server shutdown');
    }
    
    // Cerrar servidores
    if (this.tcpServer) {
      this.tcpServer.close();
      this.tcpServer = null;
    }
    
    if (this.udpSocket) {
      this.udpSocket.close();
      this.udpSocket = null;
    }
    
    console.log('✅ Nodex VPN Server detenido');
  }

  /**
   * Iniciar servidor TCP para handshake
   */
  private async startTcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => {
        this.handleTcpConnection(socket);
      });

      this.tcpServer.on('error', (error) => {
        console.error('❌ Error en servidor TCP:', error);
        reject(error);
      });

      this.tcpServer.listen(this.config.tcpPort, this.config.serverIp, () => {
        console.log(`✅ Servidor TCP listening en ${this.config.serverIp}:${this.config.tcpPort}`);
        resolve();
      });
    });
  }

  /**
   * Iniciar servidor UDP para datos del túnel
   */
  private async startUdpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udpSocket = dgram.createSocket('udp4');

      this.udpSocket.on('message', (msg, rinfo) => {
        this.handleUdpMessage(msg, rinfo);
      });

      this.udpSocket.on('error', (error) => {
        console.error('❌ Error en servidor UDP:', error);
        reject(error);
      });

      this.udpSocket.bind(this.config.udpPort, this.config.serverIp, () => {
        console.log(`✅ Servidor UDP listening en ${this.config.serverIp}:${this.config.udpPort}`);
        resolve();
      });
    });
  }

  /**
   * Manejar nueva conexión TCP
   */
  private async handleTcpConnection(socket: net.Socket): Promise<void> {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`🔗 Nueva conexión TCP: ${clientId}`);

    try {
      // Verificar límite de conexiones
      if (this.activeConnections.size >= this.config.maxConnections) {
        console.log(`⚠️  Límite de conexiones alcanzado, rechazando: ${clientId}`);
        socket.end();
        return;
      }

      // Crear protocolo Nodex para esta conexión
      const protocol = new NodexProtocol(socket, this.crypto);
      
      // Realizar handshake
      const authResult = await protocol.performHandshake();
      
      if (!authResult.success) {
        console.log(`❌ Handshake fallido para: ${clientId}`);
        socket.end();
        return;
      }

      // Registrar conexión activa
      const connectionState: ConnectionState = {
        clientId,
        userId: authResult.userId,
        connected: true,
        status: 'connected',
        connectedAt: new Date(),
        lastActivity: new Date(),
        bytesReceived: 0,
        bytesSent: 0
      };

      this.activeConnections.set(clientId, connectionState);
      
      console.log(`✅ Cliente conectado: ${clientId} (Usuario: ${authResult.userId})`);
      
      // Emitir evento de conexión
      const event: VpnConnectionEvent = {
        clientId,
        userId: authResult.userId,
        event: 'connected',
        timestamp: new Date()
      };
      this.emit('connection', event);

    } catch (error) {
      console.error(`❌ Error en handshake TCP ${clientId}:`, error);
      socket.end();
    }

    // Manejar desconexión
    socket.on('close', () => {
      this.disconnectClient(clientId, 'Client disconnected');
    });

    socket.on('error', (error) => {
      console.error(`❌ Error en socket TCP ${clientId}:`, error);
      this.disconnectClient(clientId, 'Socket error');
    });
  }

  /**
   * Manejar mensaje UDP
   */
  private handleUdpMessage(message: Buffer, rinfo: dgram.RemoteInfo): void {
    const clientId = `${rinfo.address}:${rinfo.port}`;
    
    // Verificar que la conexión esté registrada
    const connection = this.activeConnections.get(clientId);
    if (!connection) {
      console.log(`⚠️  Mensaje UDP de cliente no registrado: ${clientId}`);
      return;
    }

    try {
      // Descifrar mensaje
      const decryptedData = this.crypto.decrypt(message);
      
      // Actualizar estadísticas
      connection.bytesReceived += message.length;
      connection.lastActivity = new Date();
      
      // Procesar datos del túnel (aquí iría la lógica de enrutamiento)
      this.processTunnelData(clientId, decryptedData);
      
    } catch (error) {
      console.error(`❌ Error procesando mensaje UDP ${clientId}:`, error);
    }
  }

  /**
   * Procesar datos del túnel
   */
  private processTunnelData(clientId: string, data: Buffer): void {
    // TODO: Implementar enrutamiento de paquetes IP
    // Por ahora solo simularemos el procesamiento
    console.log(`📦 Datos del túnel recibidos de ${clientId}: ${data.length} bytes`);
  }

  /**
   * Desconectar cliente
   */
  private disconnectClient(clientId: string, reason: string): void {
    const connection = this.activeConnections.get(clientId);
    if (connection) {
      console.log(`🔌 Desconectando cliente ${clientId}: ${reason}`);
      
      connection.connected = false;
      connection.status = 'disconnected';
      
      // Emitir evento de desconexión
      const event: VpnConnectionEvent = {
        clientId,
        userId: connection.userId,
        event: 'disconnected',
        timestamp: new Date(),
        data: { reason }
      };
      this.emit('disconnection', event);
      
      this.activeConnections.delete(clientId);
    }
  }

  /**
   * Obtener conexiones activas
   */
  getActiveConnections(): ConnectionState[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * Obtener carga del servidor
   */
  getServerLoad(): number {
    return Math.round((this.activeConnections.size / this.config.maxConnections) * 100);
  }

  /**
   * Verificar si el servidor está corriendo
   */
  isRunning(): boolean {
    return this.isRunning;
  }
} 