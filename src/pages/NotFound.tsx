import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="mb-4 text-6xl font-bold text-purple-500">404</h1>
      <p className="mb-8 text-xl text-gray-400">Page not found</p>
      <Link
        to="/"
        className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-700"
      >
        Back to Home
      </Link>
    </div>
  )
}
