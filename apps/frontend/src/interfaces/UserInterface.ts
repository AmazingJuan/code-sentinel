export interface ManagedUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'analyst'
  createdAt: string
}