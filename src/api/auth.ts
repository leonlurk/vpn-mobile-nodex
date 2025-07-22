/**
 * API ROUTES - Autenticación
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import { verifyFirebaseToken, isFirebaseAvailable } from '../firebase';
import { ApiResponse, AuthenticatedUser } from '../types';

const router = Router();

/**
 * Login con Firebase Token
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

    let user: AuthenticatedUser | null = null;

    // Intentar autenticación con Firebase
    if (isFirebaseAvailable()) {
      user = await verifyFirebaseToken(idToken);
    }

    // Fallback: autenticación simple
    if (!user) {
      // Decodificar token simple para desarrollo
      try {
        const decoded = jwt.verify(idToken, config.jwt.secret) as any;
        user = {
          uid: decoded.uid || 'test-user',
          email: decoded.email || 'test@nodexvpn.com',
          displayName: decoded.name || 'Usuario Test',
          emailVerified: true
        };
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido',
          timestamp: new Date()
        } as ApiResponse);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación fallida',
        timestamp: new Date()
      } as ApiResponse);
    }

    // Generar JWT para el servidor
    const serverToken = jwt.sign(
      { 
        uid: user.uid, 
        email: user.email,
        displayName: user.displayName 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        token: serverToken,
        user: user,
        expiresIn: config.jwt.expiresIn
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Verificar token JWT
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

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    const response: ApiResponse = {
      success: true,
      data: {
        valid: true,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          displayName: decoded.displayName
        },
        expiresAt: new Date(decoded.exp * 1000)
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token inválido o expirado',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Crear token de desarrollo (solo para testing)
 */
router.post('/dev-token', async (req: Request, res: Response) => {
  if (config.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Endpoint solo disponible en desarrollo',
      timestamp: new Date()
    } as ApiResponse);
  }

  try {
    const { email = 'test@nodexvpn.com', name = 'Usuario Test' } = req.body;

    const token = jwt.sign(
      {
        uid: 'dev-user-' + Date.now(),
        email,
        name
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        message: 'Token de desarrollo creado'
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error creando token de desarrollo',
      timestamp: new Date()
    } as ApiResponse);
  }
});

export default router; 