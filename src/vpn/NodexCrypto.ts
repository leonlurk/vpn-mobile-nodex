/**
 * NODEX CRYPTO - Cifrado AES-256-GCM
 */

import * as crypto from 'crypto';

export class NodexCrypto {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16;  // 128 bits
  private tagLength = 16; // 128 bits
  private masterKey: Buffer | null = null;

  /**
   * Inicializar sistema de cifrado
   */
  async initialize(): Promise<void> {
    try {
      // Generar clave maestra (en producción debería venir de configuración segura)
      this.masterKey = crypto.randomBytes(this.keyLength);
      console.log('✅ Sistema de cifrado Nodex inicializado');
    } catch (error) {
      console.error('❌ Error inicializando cifrado:', error);
      throw error;
    }
  }

  /**
   * Cifrar datos
   */
  encrypt(data: Buffer): Buffer {
    if (!this.masterKey) {
      throw new Error('Sistema de cifrado no inicializado');
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.masterKey);
      cipher.setAAD(iv);

      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const tag = cipher.getAuthTag();

      // Formato: [IV][TAG][ENCRYPTED_DATA]
      return Buffer.concat([iv, tag, encrypted]);

    } catch (error) {
      console.error('❌ Error cifrando datos:', error);
      throw error;
    }
  }

  /**
   * Descifrar datos
   */
  decrypt(encryptedData: Buffer): Buffer {
    if (!this.masterKey) {
      throw new Error('Sistema de cifrado no inicializado');
    }

    try {
      // Extraer componentes
      const iv = encryptedData.slice(0, this.ivLength);
      const tag = encryptedData.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedData.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipher(this.algorithm, this.masterKey);
      decipher.setAuthTag(tag);
      decipher.setAAD(iv);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;

    } catch (error) {
      console.error('❌ Error descifrando datos:', error);
      throw error;
    }
  }

  /**
   * Generar hash de datos
   */
  hash(data: Buffer): Buffer {
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Generar HMAC
   */
  hmac(data: Buffer, key?: Buffer): Buffer {
    const hmacKey = key || this.masterKey;
    if (!hmacKey) {
      throw new Error('Clave HMAC requerida');
    }
    return crypto.createHmac('sha256', hmacKey).update(data).digest();
  }

  /**
   * Verificar integridad con HMAC
   */
  verifyHmac(data: Buffer, signature: Buffer, key?: Buffer): boolean {
    try {
      const expectedSignature = this.hmac(data, key);
      return crypto.timingSafeEqual(signature, expectedSignature);
    } catch (error) {
      return false;
    }
  }
} 