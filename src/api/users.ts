/**
 * API ROUTES - Gestión de usuarios
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';

const router = Router();

/**
 * Obtener perfil del usuario
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    // TODO: Implementar middleware de autenticación
    const mockUser = {
      uid: 'test-user-123',
      email: 'test@nodexvpn.com',
      displayName: 'Usuario Test',
      subscription: 'premium',
      connectionHistory: []
    };

    const response: ApiResponse = {
      success: true,
      data: mockUser,
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo perfil de usuario',
      timestamp: new Date()
    } as ApiResponse);
  }
});

/**
 * Actualizar perfil del usuario
 */
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Perfil actualizado correctamente',
        displayName
      },
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando perfil',
      timestamp: new Date()
    } as ApiResponse);
  }
});

export default router; 