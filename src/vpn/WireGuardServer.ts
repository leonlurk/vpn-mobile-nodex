/**
 * WIREGUARD SERVER - Reemplaza el protocolo Nodex
 * 
 * Gestiona configuraciones WireGuard manteniendo tu API de control
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface WireGuardPeer {
  userId: string;
  publicKey: string;
  privateKey: string;
  allowedIPs: string;
  endpoint?: string;
}

export interface WireGuardConfig {
  serverPublicKey: string;
  serverPrivateKey: string;
  serverAddress: string;
  serverPort: number;
  peers: Map<string, WireGuardPeer>;
}

export class WireGuardServer extends EventEmitter {
  private config: WireGuardConfig;
  private interfaceName: string = 'wg0';
  private running: boolean = false;
  private configPath: string = '/etc/wireguard/wg0.conf';

  constructor(serverAddress: string, serverPort: number = 51820) {
    super();
    
    this.config = {
      serverPublicKey: '',
      serverPrivateKey: '',
      serverAddress,
      serverPort,
      peers: new Map()
    };
  }

  /**
   * Inicializar WireGuard server
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Iniciando WireGuard Server...');
      
      // Verificar si WireGuard está instalado
      await this.checkWireGuardInstallation();
      
      // Generar o cargar keys del servidor
      await this.initializeServerKeys();
      
      // Generar configuración inicial
      await this.generateServerConfig();
      
      // Iniciar interfaz WireGuard
      await this.startWireGuardInterface();
      
      this.running = true;
      console.log(`✅ WireGuard Server iniciado en ${this.config.serverAddress}:${this.config.serverPort}`);
      
    } catch (error) {
      console.error('❌ Error iniciando WireGuard:', error);
      throw error;
    }
  }

  /**
   * Detener WireGuard server
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 Deteniendo WireGuard Server...');
      
      await execAsync(`sudo wg-quick down ${this.interfaceName}`);
      this.running = false;
      
      console.log('✅ WireGuard Server detenido');
    } catch (error) {
      console.error('⚠️ Error deteniendo WireGuard:', error);
    }
  }

  /**
   * Verificar instalación de WireGuard
   */
  private async checkWireGuardInstallation(): Promise<void> {
    try {
      await execAsync('which wg');
      await execAsync('which wg-quick');
    } catch (error) {
      throw new Error('WireGuard no está instalado. Ejecute: sudo apt install wireguard');
    }
  }

  /**
   * Inicializar keys del servidor
   */
  private async initializeServerKeys(): Promise<void> {
    const privateKeyPath = '/etc/wireguard/server_private.key';
    const publicKeyPath = '/etc/wireguard/server_public.key';

    try {
      // Intentar cargar keys existentes
      this.config.serverPrivateKey = (await fs.readFile(privateKeyPath, 'utf8')).trim();
      this.config.serverPublicKey = (await fs.readFile(publicKeyPath, 'utf8')).trim();
      
      console.log('✅ Keys del servidor cargadas');
    } catch (error) {
      // Generar nuevas keys
      console.log('🔑 Generando nuevas keys del servidor...');
      
      const { stdout: privateKey } = await execAsync('wg genkey');
      this.config.serverPrivateKey = privateKey.trim();
      
      const { stdout: publicKey } = await execAsync(`echo "${this.config.serverPrivateKey}" | wg pubkey`);
      this.config.serverPublicKey = publicKey.trim();
      
      // Guardar keys
      await fs.writeFile(privateKeyPath, this.config.serverPrivateKey);
      await fs.writeFile(publicKeyPath, this.config.serverPublicKey);
      
      // Permisos restrictivos
      await execAsync(`sudo chmod 600 ${privateKeyPath}`);
      await execAsync(`sudo chmod 644 ${publicKeyPath}`);
      
      console.log('✅ Nuevas keys generadas y guardadas');
    }
  }

  /**
   * Generar configuración del servidor
   */
  private async generateServerConfig(): Promise<void> {
    const config = `[Interface]
PrivateKey = ${this.config.serverPrivateKey}
Address = 10.0.0.1/24
ListenPort = ${this.config.serverPort}
PostUp = iptables -A FORWARD -i ${this.interfaceName} -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i ${this.interfaceName} -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

${this.generatePeersConfig()}`;

    await fs.writeFile(this.configPath, config);
    await execAsync(`sudo chmod 600 ${this.configPath}`);
    
    console.log('✅ Configuración de servidor generada');
  }

  /**
   * Generar configuración de peers
   */
  private generatePeersConfig(): string {
    let peersConfig = '';
    
    for (const [userId, peer] of this.config.peers) {
      peersConfig += `
[Peer]
# Usuario: ${userId}
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.allowedIPs}
`;
    }
    
    return peersConfig;
  }

  /**
   * Iniciar interfaz WireGuard
   */
  private async startWireGuardInterface(): Promise<void> {
    try {
      // Detener si ya está corriendo
      await execAsync(`sudo wg-quick down ${this.interfaceName}`).catch(() => {});
      
      // Iniciar interfaz
      await execAsync(`sudo wg-quick up ${this.interfaceName}`);
      
      console.log(`✅ Interfaz ${this.interfaceName} iniciada`);
    } catch (error) {
      throw new Error(`Error iniciando interfaz WireGuard: ${error}`);
    }
  }

  /**
   * Generar cliente WireGuard para usuario
   */
  async generateClientConfig(userId: string, clientIP: string = ''): Promise<string> {
    // Generar keys para el cliente
    const { stdout: clientPrivateKey } = await execAsync('wg genkey');
    const clientPrivateKeyTrimmed = clientPrivateKey.trim();
    
    const { stdout: clientPublicKey } = await execAsync(`echo "${clientPrivateKeyTrimmed}" | wg pubkey`);
    const clientPublicKeyTrimmed = clientPublicKey.trim();

    // Asignar IP al cliente (auto-incrementar)
    if (!clientIP) {
      const nextIP = 2 + this.config.peers.size;
      clientIP = `10.0.0.${nextIP}/32`;
    }

    // Agregar peer al servidor
    const peer: WireGuardPeer = {
      userId,
      publicKey: clientPublicKeyTrimmed,
      privateKey: clientPrivateKeyTrimmed,
      allowedIPs: clientIP
    };

    this.config.peers.set(userId, peer);

    // Actualizar configuración del servidor
    await this.generateServerConfig();
    await this.reloadWireGuard();

    // Generar configuración del cliente
    const clientConfig = `[Interface]
PrivateKey = ${clientPrivateKeyTrimmed}
Address = ${clientIP}
DNS = 8.8.8.8, 8.8.4.4

[Peer]
PublicKey = ${this.config.serverPublicKey}
Endpoint = ${this.config.serverAddress}:${this.config.serverPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

    console.log(`✅ Configuración generada para usuario: ${userId}`);
    
    return clientConfig;
  }

  /**
   * Remover cliente
   */
  async removeClient(userId: string): Promise<void> {
    if (this.config.peers.has(userId)) {
      this.config.peers.delete(userId);
      await this.generateServerConfig();
      await this.reloadWireGuard();
      
      console.log(`✅ Cliente removido: ${userId}`);
    }
  }

  /**
   * Recargar configuración WireGuard
   */
  private async reloadWireGuard(): Promise<void> {
    try {
      await execAsync(`sudo wg syncconf ${this.interfaceName} ${this.configPath}`);
    } catch (error) {
      // Si syncconf falla, reiniciar la interfaz
      await execAsync(`sudo wg-quick down ${this.interfaceName}`);
      await execAsync(`sudo wg-quick up ${this.interfaceName}`);
    }
  }

  /**
   * Obtener estadísticas de conexiones
   */
  async getConnectionStats(): Promise<any> {
    try {
      const { stdout } = await execAsync(`sudo wg show ${this.interfaceName}`);
      return this.parseWireGuardStats(stdout);
    } catch (error) {
      return { peers: [], totalPeers: 0 };
    }
  }

  /**
   * Parsear estadísticas de WireGuard
   */
  private parseWireGuardStats(output: string): any {
    const peers = [];
    const lines = output.split('\n');
    
    let currentPeer = null;
    
    for (const line of lines) {
      if (line.includes('peer:')) {
        if (currentPeer) peers.push(currentPeer);
        currentPeer = {
          publicKey: line.split('peer:')[1].trim(),
          lastHandshake: null,
          bytesReceived: 0,
          bytesSent: 0
        };
      } else if (currentPeer) {
        if (line.includes('latest handshake:')) {
          currentPeer.lastHandshake = line.split('latest handshake:')[1].trim();
        } else if (line.includes('transfer:')) {
          const transfer = line.split('transfer:')[1].trim();
          const parts = transfer.split(',');
          currentPeer.bytesReceived = parseInt(parts[0]) || 0;
          currentPeer.bytesSent = parseInt(parts[1]) || 0;
        }
      }
    }
    
    if (currentPeer) peers.push(currentPeer);
    
    return {
      peers,
      totalPeers: peers.length,
      interface: this.interfaceName
    };
  }

  /**
   * Verificar si está corriendo
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Obtener peers activos
   */
  getActivePeers(): WireGuardPeer[] {
    return Array.from(this.config.peers.values());
  }

  /**
   * Obtener configuración del servidor
   */
  getServerConfig(): { publicKey: string; address: string; port: number } {
    return {
      publicKey: this.config.serverPublicKey,
      address: this.config.serverAddress,
      port: this.config.serverPort
    };
  }
} 