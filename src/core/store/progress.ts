import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProgressState {
  completedLessons: string[]
  markComplete: (id: string) => void
  isCompleted: (id: string) => boolean
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      completedLessons: [],
      markComplete: (id: string) => {
        const { completedLessons } = get()
        if (!completedLessons.includes(id)) {
          set({ completedLessons: [...completedLessons, id] })
        }
      },
      isCompleted: (id: string) => get().completedLessons.includes(id),
    }),
    { name: 'oneml-progress' }
  )
)
