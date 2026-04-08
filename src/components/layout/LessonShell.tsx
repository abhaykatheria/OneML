import { Suspense, lazy, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import TopNav from './TopNav'
import Sidebar from './Sidebar'
import { useProgressStore } from '../../core/store/progress'
import { getLessonsByTrack, getLessonByFile, TRACKS } from '../../curriculum/index'

export default function LessonShell() {
  const { track = '', lesson = '' } = useParams<{ track: string; lesson: string }>()
  const markComplete = useProgressStore((s) => s.markComplete)
  const isCompleted = useProgressStore((s) => s.isCompleted)

  const lessons = getLessonsByTrack(track)
  const currentMeta = getLessonByFile(track, lesson)
  const lessonId = currentMeta?.id ?? `${track}/${lesson}`
  const displayTitle = currentMeta?.title ?? lesson
  const trackName = TRACKS.find((t) => t.id === track)?.name ?? track

  const LessonComponent = useMemo(
    () =>
      lazy(
        () =>
          import(`../../curriculum/${track}/${lesson}.tsx`).catch(() => ({
            default: () => (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="mb-2 text-lg">Lesson not found</p>
                <p className="text-sm">
                  <code className="rounded bg-gray-800 px-2 py-1">
                    curriculum/{track}/{lesson}.tsx
                  </code>{' '}
                  does not exist yet.
                </p>
              </div>
            ),
          }))
      ),
    [track, lesson]
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav />

      <Sidebar track={track} lessons={lessons} />

      <main className="md:ml-64">
        {/* Breadcrumb */}
        <div className="border-b border-gray-800 px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <span>/</span>
            <span className="capitalize">{trackName}</span>
            <span>/</span>
            <span className="text-white">{displayTitle}</span>
          </nav>
        </div>

        {/* Lesson content */}
        <div className="p-6">
          <Suspense
            key={`${track}/${lesson}`}
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              </div>
            }
          >
            <LessonComponent />
          </Suspense>
        </div>

        {/* Mark complete button */}
        <div className="border-t border-gray-800 px-6 py-6">
          <button
            onClick={() => markComplete(lessonId)}
            disabled={isCompleted(lessonId)}
            className={`rounded-lg px-6 py-3 font-medium transition ${
              isCompleted(lessonId)
                ? 'cursor-default bg-green-800 text-green-200'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isCompleted(lessonId) ? 'Completed' : 'Mark Complete'}
          </button>
        </div>
      </main>
    </div>
  )
}
