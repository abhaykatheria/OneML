interface ProgressProps {
  completed: number
  total: number
  className?: string
}

export default function Progress({ completed, total, className = '' }: ProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {completed} / {total} lessons
        </span>
        <span className="text-gray-500 dark:text-gray-400">{pct}%</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-purple-600 transition-all duration-500 ease-out dark:bg-purple-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  )
}
