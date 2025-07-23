/**
 * FIREBASE ADMIN SDK - Configuración completa
 * 
 * Integración completa con Firebase para VPN móvil
 */

import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';

// Configuración del proyecto
const FIREBASE_CONFIG = {
  projectId: 'nodexvpn',
  serviceAccountPath: path.join(__dirname, '../../serviceAccountKey.json')
};

let firebaseApp: admin.app.App | null = null;
let auth: admin.auth.Auth | null = null;
let firestore: admin.firestore.Firestore | null = null;

/**
 * Inicializar Firebase Admin SDK
 */
export async function initFirebase(): Promise<void> {
  try {
    if (firebaseApp) {
      console.log('✅ Firebase ya está inicializado');
      return;
    }

    console.log('🔥 Inicializando Firebase Admin SDK...');

    // Verificar que existe el service account
    const serviceAccount = require(FIREBASE_CONFIG.serviceAccountPath);
    
    // Inicializar Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: FIREBASE_CONFIG.projectId,
      databaseURL: `https://${FIREBASE_CONFIG.projectId}-default-rtdb.firebaseio.com`
    });

    // Inicializar servicios
    auth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);

    // Configurar Firestore
    await setupFirestoreCollections();

    console.log('✅ Firebase Admin SDK inicializado correctamente');
    console.log(`📊 Proyecto: ${FIREBASE_CONFIG.projectId}`);
    
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    throw error;
  }
}

/**
 * Configurar colecciones de Firestore
 */
async function setupFirestoreCollections(): Promise<void> {
  if (!firestore) return;

  try {
    // Crear colección de usuarios si no existe
    const usersRef = firestore.collection('users');
    
    // Crear colección de sesiones VPN
    const sessionsRef = firestore.collection('vpn_sessions');
    
    // Crear colección de logs de conexión
    const logsRef = firestore.collection('connection_logs');

    console.log('✅ Colecciones Firestore configuradas');
  } catch (error) {
    console.error('⚠️ Error configurando Firestore:', error);
  }
}

/**
 * Verificar token de Firebase Auth
 */
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!auth) {
    throw new Error('Firebase Auth no está inicializado');
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log(`✅ Token verificado para usuario: ${decodedToken.uid}`);
    return decodedToken;
  } catch (error) {
    console.error('❌ Error verificando token:', error);
    throw new Error('Token inválido');
  }
}

/**
 * Crear o actualizar usuario en Firestore
 */
export async function createOrUpdateUser(userInfo: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}): Promise<void> {
  if (!firestore) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const userRef = firestore.collection('users').doc(userInfo.uid);
    
    const userData = {
      uid: userInfo.uid,
      email: userInfo.email,
      displayName: userInfo.displayName || '',
      photoURL: userInfo.photoURL || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      vpnSubscription: {
        active: true,
        plan: 'free',
        expiresAt: null
      },
      connectionStats: {
        totalConnections: 0,
        totalDataUsed: 0,
        lastConnectionAt: null
      }
    };

    await userRef.set(userData, { merge: true });
    console.log(`✅ Usuario actualizado en Firestore: ${userInfo.uid}`);
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    throw error;
  }
}

/**
 * Obtener información del usuario
 */
export async function getUserInfo(uid: string): Promise<any> {
  if (!firestore) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const userDoc = await firestore.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error('Usuario no encontrado');
    }

    return userDoc.data();
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    throw error;
  }
}

/**
 * Registrar sesión VPN
 */
export async function logVpnSession(sessionData: {
  uid: string;
  serverLocation: string;
  connectTime: Date;
  disconnectTime?: Date;
  bytesTransferred?: number;
  clientIP?: string;
}): Promise<string> {
  if (!firestore) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const sessionRef = await firestore.collection('vpn_sessions').add({
      ...sessionData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Sesión VPN registrada: ${sessionRef.id}`);
    return sessionRef.id;
  } catch (error) {
    console.error('❌ Error registrando sesión VPN:', error);
    throw error;
  }
}

/**
 * Actualizar estadísticas de usuario
 */
export async function updateUserStats(uid: string, stats: {
  connectionCount?: number;
  dataUsed?: number;
  lastConnectionAt?: Date;
}): Promise<void> {
  if (!firestore) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const userRef = firestore.collection('users').doc(uid);
    
    const updateData: any = {};
    
    if (stats.connectionCount) {
      updateData['connectionStats.totalConnections'] = admin.firestore.FieldValue.increment(stats.connectionCount);
    }
    
    if (stats.dataUsed) {
      updateData['connectionStats.totalDataUsed'] = admin.firestore.FieldValue.increment(stats.dataUsed);
    }
    
    if (stats.lastConnectionAt) {
      updateData['connectionStats.lastConnectionAt'] = stats.lastConnectionAt;
    }

    await userRef.update(updateData);
    console.log(`✅ Estadísticas actualizadas para usuario: ${uid}`);
  } catch (error) {
    console.error('❌ Error actualizando estadísticas:', error);
    throw error;
  }
}

/**
 * Verificar suscripción activa
 */
export async function checkUserSubscription(uid: string): Promise<boolean> {
  try {
    const userInfo = await getUserInfo(uid);
    const subscription = userInfo.vpnSubscription;
    
    if (!subscription.active) {
      return false;
    }
    
    // Si tiene fecha de expiración, verificarla
    if (subscription.expiresAt) {
      const now = new Date();
      const expirationDate = subscription.expiresAt.toDate();
      return now < expirationDate;
    }
    
    // Si no tiene fecha de expiración (plan gratuito), está activo
    return true;
  } catch (error) {
    console.error('❌ Error verificando suscripción:', error);
    return false;
  }
}

/**
 * Crear custom token para usuario
 */
export async function createCustomToken(uid: string, additionalClaims?: object): Promise<string> {
  if (!auth) {
    throw new Error('Firebase Auth no está inicializado');
  }

  try {
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    console.log(`✅ Custom token creado para usuario: ${uid}`);
    return customToken;
  } catch (error) {
    console.error('❌ Error creando custom token:', error);
    throw error;
  }
}

/**
 * Obtener instancias de Firebase
 */
export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    throw new Error('Firebase no está inicializado');
  }
  return firebaseApp;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!auth) {
    throw new Error('Firebase Auth no está inicializado');
  }
  return auth;
}

export function getFirebaseFirestore(): admin.firestore.Firestore {
  if (!firestore) {
    throw new Error('Firestore no está inicializado');
  }
  return firestore;
}

/**
 * Verificar si Firebase está disponible
 */
export function isFirebaseAvailable(): boolean {
  return firebaseApp !== null;
}

/**
 * Cerrar conexiones Firebase
 */
export async function closeFirebase(): Promise<void> {
  if (firebaseApp) {
    await firebaseApp.delete();
    firebaseApp = null;
    auth = null;
    firestore = null;
    console.log('✅ Firebase desconectado');
  }
} 