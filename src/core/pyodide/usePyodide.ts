import { useCallback, useEffect, useRef } from 'react'
import { usePyodideStore } from '../store/pyodide'
import type { PyodideStatus } from '../store/pyodide'
import { PRELOAD_PACKAGES, getPreloadCode } from './preloads'

/* ------------------------------------------------------------------ */
/*  Worker singleton                                                   */
/* ------------------------------------------------------------------ */

interface PendingRequest {
  resolve: (value: RunResult | void) => void
  reject: (reason: unknown) => void
}

let worker: Worker | null = null
const pending = new Map<string, PendingRequest>()
let idCounter = 0
let bootPromise: Promise<void> | null = null

function nextId(): string {
  return `py_${++idCounter}_${Date.now()}`
}

// Classic worker source as a string — uses importScripts for Pyodide CDN
const WORKER_SOURCE = `
let pyodide = null;

function postStatus(status) {
  self.postMessage({ type: 'status', status });
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  postStatus('loading');
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');
  pyodide = await self.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
  });
  postStatus('installing');
  await pyodide.loadPackage('micropip');
  postStatus('ready');
  return pyodide;
}

async function handleRun(id, code) {
  try {
    const py = await ensurePyodide();
    const escaped = code.replace(/\\\\/g, '\\\\\\\\').replace(/"""/g, '\\\\"\\\\"\\\\"');
    const wrapped = \`
import sys as __sys__
import io as __io__
__stdout_buffer__ = __io__.StringIO()
__old_stdout__ = __sys__.stdout
__sys__.stdout = __stdout_buffer__
__result__ = None
try:
    try:
        __result__ = eval(compile("""\${escaped}""", '<cell>', 'eval'))
    except SyntaxError:
        exec(compile("""\${escaped}""", '<cell>', 'exec'))
        __result__ = None
finally:
    __sys__.stdout = __old_stdout__
(__result__, __stdout_buffer__.getvalue())
\`;
    const raw = await py.runPythonAsync(wrapped);
    let result = raw;
    if (raw && typeof raw === 'object' && typeof raw.toJs === 'function') {
      result = raw.toJs();
    }
    const arr = Array.isArray(result) ? result : [result, ''];
    let [value, stdout] = arr;
    if (value && typeof value === 'object' && typeof value.toJs === 'function') {
      value = value.toJs();
    }
    self.postMessage({
      id,
      result: value === undefined ? null : value,
      stdout: typeof stdout === 'string' ? stdout : '',
      error: null,
    });
  } catch (err) {
    self.postMessage({ id, result: null, stdout: '', error: err.message || String(err) });
  }
}

async function handleInstall(id, packages) {
  try {
    const py = await ensurePyodide();
    const micropip = py.pyimport('micropip');
    await micropip.install(packages);
    self.postMessage({ id, result: null, stdout: '', error: null });
  } catch (err) {
    self.postMessage({ id, result: null, stdout: '', error: err.message || String(err) });
  }
}

self.onmessage = function (event) {
  const msg = event.data;
  if (msg.type === 'run') { handleRun(msg.id, msg.code); }
  else if (msg.type === 'install') { handleInstall(msg.id, msg.packages); }
};
`

function getWorker(): Worker {
  if (worker) return worker

  const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  worker = new Worker(url)

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as WorkerMessage

    if ('type' in data && data.type === 'status') {
      usePyodideStore.getState().setStatus(data.status as PyodideStatus)
      return
    }

    if ('id' in data) {
      const entry = pending.get(data.id as string)
      if (entry) {
        pending.delete(data.id as string)
        entry.resolve(data as unknown as RunResult)
      }
    }
  }

  worker.onerror = (err) => {
    usePyodideStore.getState().setStatus('error')
    console.error('[pyodide worker]', err)
  }

  return worker
}

type WorkerMessage =
  | { type: 'status'; status: string }
  | { id: string; result: unknown; stdout: string; error: string | null }

function sendRequest<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = getWorker()
    const id = message.id as string
    pending.set(id, { resolve: resolve as PendingRequest['resolve'], reject })
    w.postMessage(message)
  })
}

/** Boot the worker, install preload packages, and import them. */
function ensureBooted(): Promise<void> {
  if (bootPromise) return bootPromise

  bootPromise = (async () => {
    // Trigger a lightweight run so the worker loads Pyodide
    const initId = nextId()
    await sendRequest<RunResult>({ type: 'run', id: initId, code: '"ok"' })

    // Install ML packages
    const installId = nextId()
    usePyodideStore.getState().setStatus('installing')
    getWorker().postMessage({ type: 'install', id: installId, packages: PRELOAD_PACKAGES })
    await new Promise<void>((resolve, reject) => {
      pending.set(installId, { resolve: resolve as PendingRequest['resolve'], reject })
    })

    // Warm-import packages so first user run is fast
    const warmId = nextId()
    await sendRequest<RunResult>({ type: 'run', id: warmId, code: getPreloadCode() })

    usePyodideStore.getState().setStatus('ready')
  })()

  return bootPromise
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface RunResult {
  result: unknown
  stdout: string
  error: string | null
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export default function usePyodide() {
  const status = usePyodideStore((s) => s.status)
  const bootStarted = useRef(false)

  // Kick off the boot sequence once
  useEffect(() => {
    if (!bootStarted.current) {
      bootStarted.current = true
      void ensureBooted()
    }
  }, [])

  const run = useCallback(
    async (code: string): Promise<RunResult> => {
      await ensureBooted()
      const id = nextId()
      const response = await sendRequest<RunResult>({
        type: 'run',
        id,
        code,
      })
      return response
    },
    [],
  )

  const install = useCallback(
    async (packages: string[]): Promise<void> => {
      await ensureBooted()
      const id = nextId()
      await sendRequest<void>({
        type: 'install',
        id,
        packages,
      })
    },
    [],
  )

  const loading = status !== 'ready'

  return { run, install, loading }
}
