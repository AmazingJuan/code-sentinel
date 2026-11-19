export interface ManagedUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'analyst'
  createdAt: string
}

export interface UpdateUserPayload {
  name: string
  email: string
  role: ManagedUser['role']
}

export interface CreateUserPayload extends UpdateUserPayload {
  password: string
}
