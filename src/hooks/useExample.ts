import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

export function useExample() {
  const setInitialized = useAppStore((s) => s.setInitialized)
  useEffect(() => {
    setInitialized(true)
  }, [setInitialized])
}
