/**
 * FIREBASE INTEGRATION - Autenticación y servicios
 */

import admin from 'firebase-admin';
import config from '../config';
import { AuthenticatedUser } from '../types';

let firebaseInitialized = false;

/**
 * Inicializar Firebase Admin SDK
 */
export async function initFirebase(): Promise<void> {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Verificar si existe archivo de credenciales
    const fs = require('fs');
    const path = require('path');
    
    const credentialsPath = path.resolve(config.firebase.privateKeyPath);
    
    if (!fs.existsSync(credentialsPath)) {
      console.warn('⚠️  Archivo de credenciales Firebase no encontrado:', credentialsPath);
      return;
    }

    // Inicializar Firebase Admin
    const serviceAccount = require(credentialsPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.firebase.databaseURL,
      projectId: config.firebase.projectId
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK inicializado');
    
  } catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
    throw error;
  }
}

/**
 * Verificar token JWT de Firebase
 */
export async function verifyFirebaseToken(idToken: string): Promise<AuthenticatedUser | null> {
  try {
    if (!firebaseInitialized) {
      throw new Error('Firebase no está inicializado');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      photoURL: decodedToken.picture,
      emailVerified: decodedToken.email_verified || false,
      customClaims: decodedToken.custom_claims
    };
    
  } catch (error) {
    console.error('❌ Error verificando token Firebase:', error);
    return null;
  }
}

/**
 * Obtener usuario por UID
 */
export async function getFirebaseUser(uid: string): Promise<AuthenticatedUser | null> {
  try {
    if (!firebaseInitialized) {
      throw new Error('Firebase no está inicializado');
    }

    const userRecord = await admin.auth().getUser(uid);
    
    return {
      uid: userRecord.uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      emailVerified: userRecord.emailVerified,
      customClaims: userRecord.customClaims
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo usuario Firebase:', error);
    return null;
  }
}

/**
 * Verificar si Firebase está disponible
 */
export function isFirebaseAvailable(): boolean {
  return firebaseInitialized;
}

export default {
  initFirebase,
  verifyFirebaseToken,
  getFirebaseUser,
  isFirebaseAvailable
}; 