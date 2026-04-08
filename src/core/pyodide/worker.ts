// @ts-nocheck
/* eslint-disable no-restricted-globals */

/**
 * Pyodide Web Worker (classic worker — no ES module syntax)
 */

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

function wrapWithStdoutCapture(code) {
  // We need to escape the code for embedding in a Python string
  const escaped = code.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  return `
import sys as __sys__
import io as __io__
__stdout_buffer__ = __io__.StringIO()
__old_stdout__ = __sys__.stdout
__sys__.stdout = __stdout_buffer__
__result__ = None
try:
    try:
        __result__ = eval(compile("""${escaped}""", '<cell>', 'eval'))
    except SyntaxError:
        exec(compile("""${escaped}""", '<cell>', 'exec'))
        __result__ = None
finally:
    __sys__.stdout = __old_stdout__
(__result__, __stdout_buffer__.getvalue())
`;
}

async function handleRun(id, code) {
  try {
    const py = await ensurePyodide();
    const wrapped = wrapWithStdoutCapture(code);
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
    self.postMessage({
      id,
      result: null,
      stdout: '',
      error: err.message || String(err),
    });
  }
}

async function handleInstall(id, packages) {
  try {
    const py = await ensurePyodide();
    const micropip = py.pyimport('micropip');
    await micropip.install(packages);
    self.postMessage({
      id,
      result: null,
      stdout: '',
      error: null,
    });
  } catch (err) {
    self.postMessage({
      id,
      result: null,
      stdout: '',
      error: err.message || String(err),
    });
  }
}

self.onmessage = function (event) {
  const msg = event.data;
  if (msg.type === 'run') {
    handleRun(msg.id, msg.code);
  } else if (msg.type === 'install') {
    handleInstall(msg.id, msg.packages);
  }
};
