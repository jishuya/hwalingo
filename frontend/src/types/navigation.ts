export type Page = 'study' | 'vocabulary' | 'quiz' | 'story' | 'profile' | 'login'

export const pages: Page[] = ['study', 'vocabulary', 'quiz', 'story', 'profile', 'login']

export function readRoute(): Page {
  const legacyHashPath = location.hash.replace(/^#\/?/, '')
  if (legacyHashPath === 'analysis') {
    history.replaceState(null, '', '/study')
    return 'study'
  }
  const legacyHashRoute = legacyHashPath as Page
  if (location.hash && pages.includes(legacyHashRoute)) {
    history.replaceState(null, '', `/${legacyHashRoute}`)
    return legacyHashRoute
  }

  const path = location.pathname.replace(/^\/+|\/+$/g, '')
  if (path === 'analysis') {
    history.replaceState(null, '', '/study')
    return 'study'
  }
  const route = path as Page
  return pages.includes(route) ? route : 'study'
}
