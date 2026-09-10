export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'analyst'
  createdAt?: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
