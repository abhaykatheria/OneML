import { useState, useCallback } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export default function CodeBlock({
  code,
  language = 'python',
  className = '',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard API unavailable */
    }
  }, [code])

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      {/* Language label */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-1.5 dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {language}
        </span>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-gray-800 dark:text-gray-200">
          {code}
        </code>
      </pre>
    </div>
  )
}
