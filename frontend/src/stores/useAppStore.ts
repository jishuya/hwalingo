import { create } from 'zustand'

interface AppState {
  initialized: boolean
  setInitialized: (v: boolean) => void
}

const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (v) => set({ initialized: v })
}))

export default useAppStore
