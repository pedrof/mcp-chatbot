import { Request, Response } from 'express'
import { asyncHandler } from './utils.js'
import { AuthService } from '../services/auth/AuthService.js'
import Database from 'better-sqlite3'
import { z } from 'zod'

export class AuthAPI {
  constructor(
    private db: Database.Database,
    private authService: AuthService
  ) {}

  /**
   * POST /api/auth/register
   * Register a new user
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters')
    })

    const validation = schema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      })
      return
    }

    const { username, email, password } = validation.data

    try {
      const user = await this.authService.register(
        this.db,
        username,
        email,
        password
      )

      res.status(201).json({
        message: 'User registered successfully',
        user
      })
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message })
      } else {
        throw error
      }
    }
  })

  /**
   * POST /api/auth/login
   * Login a user and return JWT token
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required')
    })

    const validation = schema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      })
      return
    }

    const { username, password } = validation.data

    try {
      const result = await this.authService.login(this.db, username, password)

      res.json(result)
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ error: error.message })
      } else {
        throw error
      }
    }
  })

  /**
   * GET /api/auth/me
   * Get current user information (requires authentication)
   */
  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const user = this.authService.getUserById(this.db, req.user.userId)

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user })
  })

  /**
   * POST /api/auth/change-password
   * Change user password (requires authentication)
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const schema = z.object({
      oldPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters')
    })

    const validation = schema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid input',
        details: validation.error.errors
      })
      return
    }

    const { oldPassword, newPassword } = validation.data

    try {
      await this.authService.changePassword(
        this.db,
        req.user.userId,
        oldPassword,
        newPassword
      )

      res.json({ message: 'Password changed successfully' })
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message })
      } else {
        throw error
      }
    }
  })
}
