export interface AuthUser {
  id: string
  email: string
  displayName: string
}

interface AuthResponse {
  user: AuthUser
}

interface ErrorResponse {
  message?: string
}

interface MessageResponse {
  message: string
}

export type ForgotPasswordResponse = MessageResponse

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ErrorResponse
    throw new Error(error.message ?? '요청을 처리하지 못했습니다.')
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function getCurrentUser(): Promise<AuthResponse> {
  return request('/api/auth/me')
}

export function login(email: string, password: string, rememberMe: boolean): Promise<AuthResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  })
}

export function signup(email: string, password: string, displayName: string): Promise<AuthResponse> {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
}

export function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(email: string, resetCode: string, password: string): Promise<MessageResponse> {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, resetCode, password }),
  })
}

export function logout(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' })
}
