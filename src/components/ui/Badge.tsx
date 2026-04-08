const trackColors: Record<string, string> = {
  foundations:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  classical:
    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  neural:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  deep:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  advanced:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  practical:
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

interface BadgeProps {
  track: string
  className?: string
}

export default function Badge({ track, className = '' }: BadgeProps) {
  const colors =
    trackColors[track] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors} ${className}`}
    >
      {track}
    </span>
  )
}
