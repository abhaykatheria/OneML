import { Link } from 'react-router-dom'
import type { LessonEntry } from '../../curriculum/index'
import Badge from './Badge'

interface LessonCardProps {
  meta: LessonEntry
  completed: boolean
}

export default function LessonCard({ meta, completed }: LessonCardProps) {
  const href = `/learn/${meta.track}/${meta.file}`

  return (
    <Link
      to={href}
      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-purple-600"
    >
      {/* Completed badge */}
      {completed && (
        <span
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
          aria-label="Completed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      <Badge track={meta.track} />

      <h3 className="mt-3 text-base font-semibold text-gray-900 group-hover:text-purple-600 dark:text-gray-100 dark:group-hover:text-purple-400">
        {meta.title}
      </h3>

      <p className="mt-1 flex-1 text-sm text-gray-500 dark:text-gray-400">
        {meta.description}
      </p>

      {meta.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {meta.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
