export type Page = 'study' | 'analysis' | 'vocabulary' | 'story' | 'profile' | 'login'

export const pages: Page[] = ['study', 'analysis', 'vocabulary', 'story', 'profile', 'login']

export function readRoute(): Page {
  const route = location.hash.replace(/^#\/?/, '') as Page
  return pages.includes(route) ? route : 'study'
}
