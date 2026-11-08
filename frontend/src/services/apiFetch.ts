export const SESSION_EXPIRED_EVENT = 'hwalingo:session-expired'

// Sign-in failures are form errors, rather than expired application sessions.
const publicAuthPaths = new Set(['/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/reset-password'])

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(path, options)
  if (response.status === 401 && !publicAuthPaths.has(path) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return response
}
