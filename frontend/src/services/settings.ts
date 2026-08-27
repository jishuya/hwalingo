export type Theme = 'light' | 'dark' | 'system'

export interface UserSettings {
  theme: Theme
  notificationsEnabled: boolean
  timezone: string
  weeklyGoalDays: number
}

async function settingsRequest<T>(options?: RequestInit): Promise<T> {
  const response = await fetch('/api/settings/me', {
    ...options,
    credentials: 'include',
    headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message ?? '설정을 처리하지 못했습니다.')
  }
  return response.json() as Promise<T>
}

export async function getUserSettings(): Promise<UserSettings> {
  return (await settingsRequest<{ settings: UserSettings }>()).settings
}

export async function updateUserSettings(settings: UserSettings): Promise<UserSettings> {
  return (await settingsRequest<{ settings: UserSettings }>({ method: 'PATCH', body: JSON.stringify(settings) })).settings
}
