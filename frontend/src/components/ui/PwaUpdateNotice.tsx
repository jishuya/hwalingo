import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ConfirmDialog } from './Dialog'

export default function PwaUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyFailed, setApplyFailed] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const pageController = useRef<ServiceWorker | null>(null)
  const applyTimer = useRef<number | undefined>(undefined)
  useRegisterSW({
    immediate: true,
    // Reloading is coordinated with the browser's controller change below.
    onNeedReload: () => {},
    onRegisteredSW: (_url, registered) => setRegistration(registered),
  })
  useEffect(() => {
    if (!registration) return
    let announced: ServiceWorker | null = null
    let installing: ServiceWorker | null = null
    const announceWaiting = () => {
      const waiting = registration.waiting
      if (!waiting || waiting === announced || !navigator.serviceWorker.controller) return
      announced = waiting
      setUpdateAvailable(true)
    }
    const watchInstallation = () => {
      installing?.removeEventListener('statechange', announceWaiting)
      installing = registration.installing
      installing?.addEventListener('statechange', announceWaiting)
      announceWaiting()
    }
    registration.addEventListener('updatefound', watchInstallation)
    watchInstallation()
    const check = () => {
      if (document.visibilityState === 'visible') void registration.update().then(announceWaiting).catch(() => {})
    }
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      registration.removeEventListener('updatefound', watchInstallation)
      installing?.removeEventListener('statechange', announceWaiting)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [registration])
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    pageController.current = navigator.serviceWorker.controller
    const changed = () => {
      const next = navigator.serviceWorker.controller
      if (!next) return
      if (!pageController.current) {
        pageController.current = next
        return
      }
      if (next === pageController.current) return
      if (applyTimer.current !== undefined) {
        window.clearTimeout(applyTimer.current)
        window.location.reload()
      } else {
        setUpdateAvailable(true)
      }
    }
    // Also catch subsequent updates and updates activated by another open tab.
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
      window.clearTimeout(applyTimer.current)
    }
  }, [])
  const confirmUpdate = () => {
    const controller = navigator.serviceWorker.controller
    if (controller && controller !== pageController.current) {
      window.location.reload()
      return
    }
    const fail = () => {
      window.clearTimeout(applyTimer.current)
      applyTimer.current = undefined
      setApplying(false)
      setApplyFailed(true)
    }
    setApplyFailed(false)
    setApplying(true)
    applyTimer.current = window.setTimeout(fail, 10_000)
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }
  return <ConfirmDialog open={updateAvailable} title="새 버전이 준비됐어요"
    message={applyFailed ? '새 버전을 적용하는 데 시간이 걸리고 있어요. 잠시 후 다시 눌러 주세요.' : '새로고침하면 최신 기능을 사용할 수 있어요. 작성 중인 내용이 있다면 마친 뒤 진행해 주세요.'}
    confirmLabel="새로고침" cancelLabel="나중에" loading={applying} onConfirm={confirmUpdate} onCancel={() => {
      if (!applying) setUpdateAvailable(false)
    }}/>
}
