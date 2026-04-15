import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProgressStore } from '../../core/store/progress'
import type { LessonEntry } from '../../curriculum/index'

interface SidebarProps {
  track: string
  lessons: LessonEntry[]
}

export default function Sidebar({ track, lessons }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const { lesson: currentLesson } = useParams<{ lesson: string }>()
  const completedLessons = useProgressStore((s) => s.completedLessons)
  const isCompleted = (id: string) => completedLessons.includes(id)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-purple-600 p-3 text-white shadow-lg md:hidden"
        aria-label="Toggle sidebar"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-[57px] z-40 h-[calc(100vh-57px)] w-64 overflow-y-auto border-r border-gray-800 bg-gray-950 px-3 pt-4 pb-20 transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}
      >
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          {track}
        </h2>
        <ul className="space-y-0.5">
          {lessons.map((lesson) => {
            const active = lesson.file === currentLesson
            return (
              <li key={lesson.id}>
                <Link
                  to={`/learn/${track}/${lesson.file}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {isCompleted(lesson.id) ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-gray-600" />
                  )}
                  <span>{lesson.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
