import { Link, useLocation } from 'react-router-dom'

import { TRACKS } from '../../curriculum/index'

export default function TopNav() {
  const location = useLocation()
  const isInLesson = location.pathname.startsWith('/learn/')

  // Extract current track from URL
  const currentTrack = isInLesson ? location.pathname.split('/')[2] : ''

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-3">
        <Link to="/" className="text-xl font-bold text-purple-500">
          oneML
        </Link>

        {/* Track tabs — only visible inside lessons */}
        {isInLesson && (
          <div className="hidden items-center gap-1 md:flex">
            {TRACKS.map((t) => (
              <Link
                key={t.id}
                to={`/learn/${t.id}/${t.firstLesson}`}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  currentTrack === t.id
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/oneml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            GitHub
          </a>

        </div>
      </div>
    </nav>
  )
}
