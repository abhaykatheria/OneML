import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  padding?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  className?: string
}

const paddingStyles: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
}

export default function Card({
  title,
  description,
  padding = 'md',
  children,
  className = '',
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${paddingStyles[padding]} ${className}`}
    >
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {(title || description) && children ? (
        <div className="mt-4">{children}</div>
      ) : (
        children
      )}
    </div>
  )
}
