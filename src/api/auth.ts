/**
 * AUTENTICACIÓN - Rutas Firebase Auth
 * 
 * Sistema completo de autenticación con Firebase
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { 
  verifyFirebaseToken, 
  createOrUpdateUser, 
  getUserInfo, 
  checkUserSubscription,
  createCustomToken
} from '../firebase';
import config from '../config';
import { ApiResponse, AuthenticatedUser } from '../types';

const router = Router();

/**
 * LOGIN - Verificar token Firebase y crear sesión
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Token de Firebase requerido',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Verificar token con Firebase
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Crear/actualizar usuario en Firestore
    await createOrUpdateUser({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    });

    // Verificar suscripción
    const hasActiveSubscription = await checkUserSubscription(decodedToken.uid);

    // Crear JWT para sesiones internas
    const payload = { 
      uid: decodedToken.uid,
      email: decodedToken.email,
      subscription: hasActiveSubscription 
    };
    const options: jwt.SignOptions = { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] };
    const internalToken = jwt.sign(payload, config.jwt.secret, options);

    // Obtener información completa del usuario
    const userInfo = await getUserInfo(decodedToken.uid);

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name || userInfo.displayName,
          photoURL: decodedToken.picture || userInfo.photoURL,
          emailVerified: decodedToken.email_verified,
          subscription: userInfo.vpnSubscription,
          connectionStats: userInfo.connectionStats
        },
        tokens: {
          firebase: idToken,
          internal: internalToken
        },
        hasActiveSubscription
      },
      timestamp: new Date()
    };

    console.log(`✅ Login exitoso: ${decodedToken.email} (${decodedToken.uid})`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de autenticación',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * REGISTER - Crear cuenta (Firebase maneja la creación)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Token de Firebase requerido',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Verificar token (usuario ya creado en Firebase)
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Crear usuario en Firestore con plan gratuito
    await createOrUpdateUser({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    });

    // Crear JWT interno
    const registerPayload = { 
      uid: decodedToken.uid,
      email: decodedToken.email,
      subscription: true // Plan gratuito activo
    };
    const registerOptions: jwt.SignOptions = { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] };
    const internalToken = jwt.sign(registerPayload, config.jwt.secret, registerOptions);

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Usuario registrado exitosamente',
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name,
          emailVerified: decodedToken.email_verified
        },
        tokens: {
          firebase: idToken,
          internal: internalToken
        },
        hasActiveSubscription: true
      },
      timestamp: new Date()
    };

    console.log(`✅ Registro exitoso: ${decodedToken.email} (${decodedToken.uid})`);
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en registro',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * VERIFY TOKEN - Verificar token interno
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token requerido',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Verificar JWT interno
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Verificar que el usuario aún existe en Firebase
    const userInfo = await getUserInfo(decoded.uid);
    
    // Verificar suscripción actualizada
    const hasActiveSubscription = await checkUserSubscription(decoded.uid);

    const response: ApiResponse = {
      success: true,
      data: {
        valid: true,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          subscription: userInfo.vpnSubscription,
          connectionStats: userInfo.connectionStats
        },
        hasActiveSubscription
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error verificando token:', error);
    res.status(401).json({
      success: false,
      error: 'Token inválido o expirado',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * LOGOUT - Cerrar sesión
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // En Firebase, el logout se maneja en el cliente
    // Aquí podríamos invalidar tokens internos si tuviéramos una blacklist
    
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Sesión cerrada exitosamente'
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error cerrando sesión',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * REFRESH TOKEN - Renovar token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requerido',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Verificar refresh token con Firebase
    const decodedToken = await verifyFirebaseToken(refreshToken);
    
    // Crear nuevo JWT interno
    const refreshPayload = { 
      uid: decodedToken.uid,
      email: decodedToken.email,
      subscription: await checkUserSubscription(decodedToken.uid)
    };
    const refreshOptions: jwt.SignOptions = { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] };
    const newInternalToken = jwt.sign(refreshPayload, config.jwt.secret, refreshOptions);

    const response: ApiResponse = {
      success: true,
      data: {
        tokens: {
          firebase: refreshToken,
          internal: newInternalToken
        }
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error renovando token:', error);
    res.status(401).json({
      success: false,
      error: 'Error renovando token',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * PROFILE - Obtener perfil del usuario
 */
router.get('/profile', verifyAuthToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userInfo = await getUserInfo(user.uid);

    const response: ApiResponse = {
      success: true,
      data: {
        user: userInfo
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo perfil',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * MIDDLEWARE - Verificar token de autenticación
 */
export async function verifyAuthToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autorización requerido',
        timestamp: new Date()
      } as ApiResponse);
    }

    const token = authHeader.substring(7);
    
    // Intentar verificar como token Firebase primero
    try {
      const decodedToken = await verifyFirebaseToken(token);
      (req as any).user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      };
      return next();
    } catch (firebaseError) {
      // Si falla Firebase, intentar JWT interno
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        (req as any).user = {
          uid: decoded.uid,
          email: decoded.email,
          subscription: decoded.subscription
        };
        return next();
      } catch (jwtError) {
        throw new Error('Token inválido');
      }
    }

  } catch (error) {
    console.error('❌ Error verificando token:', error);
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado',
      timestamp: new Date()
    } as ApiResponse);
  }
}

export default router; 