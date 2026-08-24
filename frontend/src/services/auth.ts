export interface AuthUser {
  id: string
  email: string
  displayName: string
  profileImageUrl: string | null
}

interface AuthResponse {
  user: AuthUser
}

interface ErrorResponse {
  message?: string
}

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

export function logout(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' })
}
