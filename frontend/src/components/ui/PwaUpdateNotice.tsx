import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ConfirmDialog } from './Dialog'

export default function PwaUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  useRegisterSW({
    immediate: true,
    // The worker can update its cache while the page still runs old JavaScript.
    // Ask before reloading so an update never discards an unfinished exercise.
    onNeedReload: () => setUpdateAvailable(true),
    onRegisteredSW: (_url, registration) => { registrationRef.current = registration },
  })
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let controller = navigator.serviceWorker.controller
    const changed = () => {
      const next = navigator.serviceWorker.controller
      if (controller && next && next !== controller) setUpdateAvailable(true)
      controller = next
    }
    // Also catch subsequent updates and updates activated by another open tab.
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    const check = () => {
      if (document.visibilityState === 'visible') void registrationRef.current?.update().catch(() => {})
    }
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [])
  return <ConfirmDialog open={updateAvailable} title="새 버전이 준비됐어요" message="새로고침하면 최신 기능을 사용할 수 있어요. 작성 중인 내용이 있다면 마친 뒤 진행해 주세요." confirmLabel="새로고침" cancelLabel="나중에" onConfirm={() => window.location.reload()} onCancel={() => setUpdateAvailable(false)}/>
}
