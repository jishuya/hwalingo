export type Page = 'study' | 'analysis' | 'vocabulary' | 'quiz' | 'story' | 'profile' | 'login'

export const pages: Page[] = ['study', 'analysis', 'vocabulary', 'quiz', 'story', 'profile', 'login']

export function readRoute(): Page {
  const legacyHashRoute = location.hash.replace(/^#\/?/, '') as Page
  if (location.hash && pages.includes(legacyHashRoute)) {
    history.replaceState(null, '', `/${legacyHashRoute}`)
    return legacyHashRoute
  }

  const route = location.pathname.replace(/^\/+|\/+$/g, '') as Page
  return pages.includes(route) ? route : 'study'
}
