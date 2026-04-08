import { useState, useRef } from 'react'
import usePyodide from '../../core/pyodide/usePyodide'
import type { RunResult } from '../../core/pyodide/usePyodide'

interface PythonCellProps {
  defaultCode: string
  title?: string
  readOnly?: boolean
}

export default function PythonCell({ defaultCode, title, readOnly = false }: PythonCellProps) {
  const { run, loading } = usePyodide()
  const [code, setCode] = useState(defaultCode)
  const [output, setOutput] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [execTime, setExecTime] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleRun = async () => {
    setRunning(true)
    setOutput(null)
    setExecTime(null)

    const t0 = performance.now()
    try {
      const result = await run(code)
      setExecTime(Math.round(performance.now() - t0))
      setOutput(result)
    } catch (err) {
      setExecTime(Math.round(performance.now() - t0))
      setOutput({
        result: null,
        stdout: '',
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setRunning(false)
    }
  }

  const lineCount = code.split('\n').length

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">
          {title ?? 'Python'}
        </span>
        <button
          onClick={() => void handleRun()}
          disabled={loading || running}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium
                     bg-emerald-600 text-white hover:bg-emerald-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? (
            <>
              <Spinner />
              Loading...
            </>
          ) : running ? (
            <>
              <Spinner />
              Running...
            </>
          ) : (
            'Run \u25B6'
          )}
        </button>
      </div>

      {/* Code editor area */}
      <div className="relative flex">
        {/* Line numbers */}
        <div
          className="select-none py-3 pl-3 pr-2 text-right text-xs leading-6 text-gray-600 font-mono bg-gray-900/50"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent p-3 text-sm leading-6 text-gray-100 font-mono
                     outline-none placeholder-gray-600 min-h-[6rem]
                     read-only:text-gray-400"
          rows={lineCount}
        />
      </div>

      {/* Output area */}
      {(output || running) && (
        <div className="border-t border-gray-700 px-4 py-3 bg-gray-950 text-sm font-mono">
          {running && (
            <div className="flex items-center gap-2 text-gray-400">
              <Spinner /> Executing...
            </div>
          )}

          {output && !running && (
            <div className="flex flex-col gap-2">
              {/* Error */}
              {output.error && (
                <pre className="whitespace-pre-wrap text-red-400">{output.error}</pre>
              )}

              {/* Stdout */}
              {output.stdout && (
                <pre className="whitespace-pre-wrap text-gray-300">{output.stdout}</pre>
              )}

              {/* Result */}
              {output.result != null && !output.error && (
                <pre className="whitespace-pre-wrap text-emerald-400">
                  {typeof output.result === 'string'
                    ? output.result
                    : JSON.stringify(output.result, null, 2)}
                </pre>
              )}

              {/* Execution time */}
              {execTime !== null && (
                <div className="text-xs text-gray-500 mt-1">
                  Executed in {execTime} ms
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tiny inline spinner                                                */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
