/**
 * WIREGUARD SERVER - Modo simulación para desarrollo
 * 
 * Gestiona configuraciones WireGuard manteniendo tu API de control
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { WireGuardPeer } from '../types';

const execAsync = promisify(exec);

// Interfaz para estadísticas de peer
interface PeerStats {
  publicKey: string;
  lastHandshake?: Date | undefined;
  bytesReceived: number;
  bytesSent: number;
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
  private simulationMode: boolean = false; // Modo real

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
   * Inicializar WireGuard server (modo simulación)
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
      // Crear directorio wireguard si no existe
      await execAsync('sudo mkdir -p /etc/wireguard');
      
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
# PostUp y PostDown removidos - se manejan manualmente

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
      
      // PASO 1: Iniciar interfaz WireGuard primero (esto crea wg0)
      await execAsync(`sudo wg-quick up ${this.interfaceName}`);
      console.log(`✅ Interfaz ${this.interfaceName} iniciada`);
      
      // PASO 2: Esperar un momento para que la interfaz esté completamente activa
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // PASO 3: Verificar que la interfaz wg0 existe
      try {
        const { stdout: interfaces } = await execAsync('ip link show wg0');
        console.log('🔗 Interfaz wg0 confirmada:', interfaces.split('\n')[0]);
      } catch (e) {
        throw new Error('Interfaz wg0 no fue creada correctamente');
      }
      
      // PASO 4: Aplicar reglas iptables DESPUÉS de crear la interfaz
      await this.setupFirewallRules();
      
      // PASO 5: Verificar reglas aplicadas
      await this.verifyFirewallRules();
      
    } catch (error) {
      throw new Error(`Error iniciando interfaz WireGuard: ${error}`);
    }
  }

  /**
   * Configurar reglas de firewall manualmente
   */
  private async setupFirewallRules(): Promise<void> {
    try {
      console.log('🔧 Configurando reglas de firewall...');
      
      // Habilitar IP forwarding de forma persistente
      await execAsync('sudo sysctl -w net.ipv4.ip_forward=1');
      await execAsync('echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf').catch(() => {});
      
      // PASO 1: Verificar estado actual
      console.log('🔍 Estado actual del firewall:');
      try {
        const { stdout: currentForward } = await execAsync('sudo iptables -L FORWARD -n');
        console.log('📋 FORWARD actual:', currentForward.split('\n').slice(0, 5).join('\n'));
      } catch (e) {
        console.log('📋 No hay reglas FORWARD actuales');
      }
      
      // PASO 2: Limpiar TODAS las reglas relacionadas con MASQUERADE y wg0
      console.log('🧹 Limpiando reglas existentes...');
      await execAsync('sudo iptables -t nat -F POSTROUTING').catch(() => {});
      await execAsync('sudo iptables -F FORWARD').catch(() => {});
      
      // PASO 3: Aplicar reglas básicas FORWARD
      console.log('🔗 Aplicando reglas FORWARD...');
      await execAsync('sudo iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
      await execAsync('sudo iptables -A FORWARD -i wg0 -o eth0 -j ACCEPT');
      await execAsync('sudo iptables -A FORWARD -i eth0 -o wg0 -j ACCEPT');
      
      // PASO 4: Aplicar MASQUERADE
      console.log('🎭 Aplicando MASQUERADE...');
      await execAsync('sudo iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE');
      
      // PASO 5: Permitir tráfico en INPUT y OUTPUT para wg0
      console.log('🚪 Configurando INPUT/OUTPUT...');
      await execAsync('sudo iptables -A INPUT -i wg0 -j ACCEPT').catch(() => {});
      await execAsync('sudo iptables -A OUTPUT -o wg0 -j ACCEPT').catch(() => {});
      
      console.log('✅ Reglas de firewall configuradas');
      
    } catch (error) {
      console.error('❌ Error configurando firewall:', error);
    }
  }

  /**
   * Verificar reglas de firewall
   */
  private async verifyFirewallRules(): Promise<void> {
    try {
      console.log('🔍 Verificando reglas de firewall aplicadas...');
      
      // Verificar FORWARD
      try {
        const { stdout: forwardRules } = await execAsync('sudo iptables -L FORWARD -n --line-numbers');
        console.log('📋 Reglas FORWARD:');
        console.log(forwardRules);
        
        const hasWg0Forward = forwardRules.includes('wg0') || forwardRules.includes('10.0.0.0/24');
        console.log(`🔗 FORWARD para WireGuard: ${hasWg0Forward ? '✅ CONFIGURADO' : '❌ FALTANTE'}`);
      } catch (e) {
        console.log('⚠️ Error verificando FORWARD');
      }
      
      // Verificar MASQUERADE
      try {
        const { stdout: natRules } = await execAsync('sudo iptables -t nat -L POSTROUTING -n --line-numbers');
        console.log('📋 Reglas NAT (POSTROUTING):');
        console.log(natRules);
        
        const hasMasquerade = natRules.includes('MASQUERADE') && natRules.includes('10.0.0.0/24');
        console.log(`🎭 MASQUERADE para 10.0.0.0/24: ${hasMasquerade ? '✅ CONFIGURADO' : '❌ FALTANTE'}`);
      } catch (e) {
        console.log('⚠️ Error verificando NAT');
      }
      
      // Verificar IP forwarding
      try {
        const { stdout: ipForward } = await execAsync('cat /proc/sys/net/ipv4/ip_forward');
        console.log(`📋 IP Forwarding: ${ipForward.trim() === '1' ? '✅ Habilitado' : '❌ Deshabilitado'}`);
      } catch (e) {
        console.log('⚠️ Error verificando IP forwarding');
      }
      
      // Test de conectividad desde el servidor
      console.log('🌐 Probando conectividad del servidor...');
      try {
        await execAsync('ping -c 1 8.8.8.8', { timeout: 5000 });
        console.log('✅ Servidor tiene conectividad a internet');
      } catch (e) {
        console.log('❌ Servidor SIN conectividad a internet');
      }
      
    } catch (error) {
      console.warn('⚠️ Error verificando reglas:', error);
    }
  }

  /**
   * Generar cliente WireGuard para usuario
   */
  async generateClientConfig(userId: string, clientIP: string = ''): Promise<string> {
    // Generar keys para el cliente
    const { stdout: privateKey } = await execAsync('wg genkey');
    const clientPrivateKey = privateKey.trim();
    
    const { stdout: publicKey } = await execAsync(`echo "${clientPrivateKey}" | wg pubkey`);
    const clientPublicKey = publicKey.trim();

    // Asignar IP al cliente (auto-incrementar)
    if (!clientIP) {
      const nextIP = 2 + this.config.peers.size;
      clientIP = `10.0.0.${nextIP}/32`;
    }

    // Agregar peer al servidor
    const peer: WireGuardPeer = {
      userId,
      publicKey: clientPublicKey,
      privateKey: clientPrivateKey,
      allowedIPs: clientIP
    };

    this.config.peers.set(userId, peer);

    // Actualizar configuración del servidor
    await this.generateServerConfig();
    await this.reloadWireGuard();

    // Generar configuración del cliente
    const clientConfig = `[Interface]
PrivateKey = ${clientPrivateKey}
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
    let currentPeer: PeerStats | null = null;
    
    for (const line of lines) {
      if (line.includes('peer:')) {
        if (currentPeer) peers.push(currentPeer);
        currentPeer = {
          publicKey: line.split('peer:')[1].trim(),
          lastHandshake: undefined,
          bytesReceived: 0,
          bytesSent: 0
        } as PeerStats;
      } else if (currentPeer) {
        if (line.includes('latest handshake:')) {
          const handshakeStr = line.split('latest handshake:')[1].trim();
          if (handshakeStr && handshakeStr !== '(never)') {
            currentPeer.lastHandshake = new Date(handshakeStr);
          }
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