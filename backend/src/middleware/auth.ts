import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth/AuthService.js'
import { AuthTokenPayload } from '../../../shared/types/index.js'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

/**
 * Middleware to authenticate JWT token and attach user to request
 */
export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' })
        return
      }

      const token = authHeader.substring(7) // Remove 'Bearer ' prefix

      // Verify token and get user payload
      const user = authService.verifyToken(token)

      // Attach user to request
      req.user = user

      next()
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 * Useful for endpoints that work with or without authentication
 */
export function createOptionalAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const user = authService.verifyToken(token)
        req.user = user
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }

    next()
  }
}
