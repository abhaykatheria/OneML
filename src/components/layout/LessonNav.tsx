import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getLessonsByTrack } from '../../curriculum'

interface LessonNavProps {
  currentLessonId: string
}

export default function LessonNav({ currentLessonId }: LessonNavProps) {
  const track = currentLessonId.split('/')[0] ?? ''

  const { prev, next } = useMemo(() => {
    const lessons = getLessonsByTrack(track)
    const idx = lessons.findIndex((l) => l.id === currentLessonId)
    return {
      prev: idx > 0 ? lessons[idx - 1] : null,
      next: idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null,
    }
  }, [currentLessonId, track])

  if (!prev && !next) return null

  const toHref = (lesson: typeof prev) => {
    return `/learn/${track}/${lesson!.file}`
  }

  return (
    <nav
      aria-label="Lesson navigation"
      className="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700"
    >
      {prev ? (
        <Link
          to={toHref(prev)}
          className="group flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg
            className="h-4 w-4 transition group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>
            <span className="block text-xs text-gray-400 dark:text-gray-500">Previous</span>
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          to={toHref(next)}
          className="group flex items-center gap-2 rounded-lg px-4 py-2 text-right text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <span>
            <span className="block text-xs text-gray-400 dark:text-gray-500">Next</span>
            {next.title}
          </span>
          <svg
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  )
}
