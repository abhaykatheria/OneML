import { create } from 'zustand'

export type PyodideStatus = 'idle' | 'loading' | 'installing' | 'ready' | 'error'

interface PyodideState {
  status: PyodideStatus
  setStatus: (s: PyodideStatus) => void
}

export const usePyodideStore = create<PyodideState>()((set) => ({
  status: 'idle',
  setStatus: (s) => set({ status: s }),
}))
