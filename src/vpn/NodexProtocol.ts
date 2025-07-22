/**
 * NODEX PROTOCOL - Implementación del servidor
 */

import * as net from 'net';
import { NodexCrypto } from './NodexCrypto';
import { PacketType, NodexPacket } from '../types';

interface HandshakeResult {
  success: boolean;
  userId: string;
  error?: string;
}

export class NodexProtocol {
  private socket: net.Socket;
  private crypto: NodexCrypto;
  private isAuthenticated: boolean = false;
  private userId: string = '';

  // Constantes del protocolo
  private static readonly PROTOCOL_VERSION = 0x01;
  private static readonly HEADER_SIZE = 16;
  private static readonly SIGNATURE_SIZE = 32;
  private static readonly MAX_PAYLOAD_SIZE = 65536;

  constructor(socket: net.Socket, crypto: NodexCrypto) {
    this.socket = socket;
    this.crypto = crypto;
  }

  /**
   * Realizar handshake completo del protocolo Nodex
   */
  async performHandshake(): Promise<HandshakeResult> {
    try {
      console.log('🤝 Iniciando handshake Nodex...');

      // 1. Recibir AUTH_REQUEST del cliente
      const authRequest = await this.receivePacket();
      if (authRequest.type !== PacketType.AUTH_REQUEST) {
        return { success: false, userId: '', error: 'Esperaba AUTH_REQUEST' };
      }

      // 2. Verificar autenticación
      const authResult = this.verifyAuthentication(authRequest.payload);
      if (!authResult.success) {
        await this.sendErrorResponse('Autenticación fallida');
        return authResult;
      }

      // 3. Enviar AUTH_RESPONSE
      await this.sendAuthResponse(authResult.userId);

      // 4. Recibir confirmación del cliente
      const clientReady = await this.receivePacket();
      if (clientReady.type !== PacketType.TUNNEL_DATA) {
        return { success: false, userId: '', error: 'Esperaba confirmación del cliente' };
      }

      // 5. Enviar configuración del túnel
      await this.sendTunnelConfig();

      this.isAuthenticated = true;
      this.userId = authResult.userId;

      console.log(`✅ Handshake completado para usuario: ${authResult.userId}`);
      return { success: true, userId: authResult.userId };

    } catch (error) {
      console.error('❌ Error en handshake:', error);
      return { success: false, userId: '', error: error.message };
    }
  }

  /**
   * Verificar autenticación del cliente
   */
  private verifyAuthentication(payload: Buffer): HandshakeResult {
    try {
      const tokenString = payload.toString('utf8');
      
      // Verificar JWT o token simple
      if (tokenString.includes('test') || tokenString.includes('dev')) {
        // Token de desarrollo
        return { success: true, userId: 'dev-user-' + Date.now() };
      }

      // TODO: Integrar verificación real con JWT/Firebase
      
      // Por ahora aceptar cualquier token no vacío
      if (tokenString.length > 0) {
        return { success: true, userId: 'user-' + Date.now() };
      }

      return { success: false, userId: '', error: 'Token inválido' };

    } catch (error) {
      return { success: false, userId: '', error: 'Error verificando token' };
    }
  }

  /**
   * Enviar respuesta de autenticación
   */
  private async sendAuthResponse(userId: string): Promise<void> {
    const responseData = {
      status: 'success',
      userId,
      serverConfig: {
        version: '1.0.0',
        features: ['tunnel', 'encryption', 'compression']
      }
    };

    const payload = Buffer.from(JSON.stringify(responseData), 'utf8');
    await this.sendPacket(PacketType.AUTH_RESPONSE, payload);
  }

  /**
   * Enviar configuración del túnel
   */
  private async sendTunnelConfig(): Promise<void> {
    const tunnelConfig = {
      clientIp: '10.0.0.2',
      serverIp: '10.0.0.1',
      dns: ['8.8.8.8', '8.8.4.4'],
      mtu: 1420,
      routes: ['0.0.0.0/0']
    };

    const payload = Buffer.from(JSON.stringify(tunnelConfig), 'utf8');
    await this.sendPacket(PacketType.TUNNEL_DATA, payload);
  }

  /**
   * Enviar respuesta de error
   */
  private async sendErrorResponse(message: string): Promise<void> {
    const errorData = { error: message, timestamp: Date.now() };
    const payload = Buffer.from(JSON.stringify(errorData), 'utf8');
    await this.sendPacket(PacketType.ERROR, payload);
  }

  /**
   * Crear paquete según el formato Nodex
   */
  private createPacket(type: PacketType, payload: Buffer): Buffer {
    const header = Buffer.allocUnsafe(NodexProtocol.HEADER_SIZE);
    let offset = 0;

    // Header: Version(1) + Type(1) + Reserved(2) + Timestamp(4) + Length(4) + Reserved(4)
    header.writeUInt8(NodexProtocol.PROTOCOL_VERSION, offset); offset += 1;
    header.writeUInt8(type, offset); offset += 1;
    header.writeUInt16BE(0, offset); offset += 2; // Reserved
    header.writeUInt32BE(Math.floor(Date.now() / 1000), offset); offset += 4; // Timestamp
    header.writeUInt32BE(payload.length, offset); offset += 4; // Length
    header.writeUInt32BE(0, offset); // Reserved

    // Crear firma HMAC
    const dataToSign = Buffer.concat([header, payload]);
    const signature = this.crypto.hmac(dataToSign);

    // Paquete completo: [HEADER][PAYLOAD][SIGNATURE]
    return Buffer.concat([header, payload, signature]);
  }

  /**
   * Enviar paquete
   */
  private async sendPacket(type: PacketType, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (payload.length > NodexProtocol.MAX_PAYLOAD_SIZE) {
        reject(new Error('Payload demasiado grande'));
        return;
      }

      const packet = this.createPacket(type, payload);
      
      this.socket.write(packet, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Recibir paquete
   */
  private async receivePacket(): Promise<NodexPacket> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout recibiendo paquete'));
      }, 30000);

      // Leer header primero
      this.readBytes(NodexProtocol.HEADER_SIZE, (headerData) => {
        if (!headerData) {
          clearTimeout(timeout);
          reject(new Error('Error leyendo header'));
          return;
        }

        // Parsear header
        const version = headerData.readUInt8(0);
        const type = headerData.readUInt8(1);
        const timestamp = headerData.readUInt32BE(4);
        const length = headerData.readUInt32BE(8);

        if (version !== NodexProtocol.PROTOCOL_VERSION) {
          clearTimeout(timeout);
          reject(new Error('Versión de protocolo incompatible'));
          return;
        }

        if (length > NodexProtocol.MAX_PAYLOAD_SIZE) {
          clearTimeout(timeout);
          reject(new Error('Payload demasiado grande'));
          return;
        }

        // Leer payload y firma
        const totalSize = length + NodexProtocol.SIGNATURE_SIZE;
        this.readBytes(totalSize, (payloadAndSig) => {
          clearTimeout(timeout);
          
          if (!payloadAndSig) {
            reject(new Error('Error leyendo payload'));
            return;
          }

          const payload = payloadAndSig.slice(0, length);
          const signature = payloadAndSig.slice(length);

          // Verificar firma
          const dataToVerify = Buffer.concat([headerData, payload]);
          if (!this.crypto.verifyHmac(dataToVerify, signature)) {
            reject(new Error('Firma de paquete inválida'));
            return;
          }

          resolve({
            version,
            type,
            timestamp,
            length,
            payload,
            signature
          });
        });
      });
    });
  }

  /**
   * Leer cantidad específica de bytes
   */
  private readBytes(count: number, callback: (data: Buffer | null) => void): void {
    let buffer = Buffer.alloc(count);
    let bytesRead = 0;

    const onData = (chunk: Buffer) => {
      const bytesToCopy = Math.min(chunk.length, count - bytesRead);
      chunk.copy(buffer, bytesRead, 0, bytesToCopy);
      bytesRead += bytesToCopy;

      if (bytesRead >= count) {
        this.socket.removeListener('data', onData);
        this.socket.removeListener('error', onError);
        this.socket.removeListener('close', onClose);
        callback(buffer);
      }
    };

    const onError = (error: Error) => {
      this.socket.removeListener('data', onData);
      this.socket.removeListener('close', onClose);
      callback(null);
    };

    const onClose = () => {
      this.socket.removeListener('data', onData);
      this.socket.removeListener('error', onError);
      callback(null);
    };

    this.socket.on('data', onData);
    this.socket.on('error', onError);
    this.socket.on('close', onClose);
  }

  /**
   * Verificar si está autenticado
   */
  isClientAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Obtener ID del usuario
   */
  getUserId(): string {
    return this.userId;
  }
} 