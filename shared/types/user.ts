export interface User {
  id: number
  username: string
  email: string
  createdAt: string
}

export interface UserWithPassword extends User {
  passwordHash: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface AuthTokenPayload {
  userId: number
  username: string
  email: string
}
