import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, AuthTokenPayload } from '../../../../shared/types/index.js'
import Database from 'better-sqlite3'

export class AuthService {
  private jwtSecret: string

  constructor(jwtSecret: string) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long')
    }
    this.jwtSecret = jwtSecret
  }

  /**
   * Register a new user
   */
  async register(
    db: Database.Database,
    username: string,
    email: string,
    password: string
  ): Promise<User> {
    // Validate input
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long')
    }
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address')
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    // Check if user already exists
    const existingUser = db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .get(username, email)

    if (existingUser) {
      throw new Error('Username or email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert user
    const result = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(username, email, passwordHash)

    // Fetch created user
    const user = db
      .prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid) as any

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at
    }
  }

  /**
   * Login a user and return JWT token
   */
  async login(
    db: Database.Database,
    username: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    // Find user
    const user = db
      .prepare('SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?')
      .get(username) as any

    if (!user) {
      throw new Error('Invalid username or password')
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash)

    if (!passwordValid) {
      throw new Error('Invalid username or password')
    }

    // Generate JWT token
    const payload: AuthTokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email
    }

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '7d' // Token expires in 7 days
    })

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at
      }
    }
  }

  /**
   * Verify JWT token and return user payload
   */
  verifyToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload
      return payload
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Get user by ID
   */
  getUserById(db: Database.Database, userId: number): User | null {
    const user = db
      .prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
      .get(userId) as any

    if (!user) return null

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    db: Database.Database,
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    // Fetch user
    const user = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as any

    if (!user) {
      throw new Error('User not found')
    }

    // Verify old password
    const passwordValid = await bcrypt.compare(oldPassword, user.password_hash)

    if (!passwordValid) {
      throw new Error('Invalid current password')
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long')
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Update password
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      newPasswordHash,
      userId
    )
  }
}
