export interface AuthUser {
  id: string
  email: string
  name: string
  createdAt?: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
