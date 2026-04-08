/**
 * Helper code to prepend to user Python so matplotlib output is
 * captured as a base64 PNG string instead of trying to show a GUI window.
 */
export const MATPLOTLIB_CAPTURE_CODE = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io as _io, base64 as _b64

def _capture_plot():
    buf = _io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    plt.close('all')
    buf.seek(0)
    return 'data:image/png;base64,' + _b64.b64encode(buf.read()).decode()
`.trim()

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface MatplotlibOutputProps {
  output: string
}

const BASE64_PNG_PREFIX = 'data:image/png;base64,'

export default function MatplotlibOutput({ output }: MatplotlibOutputProps) {
  if (!output) return null

  // Check if the output contains a base64 PNG
  const idx = output.indexOf(BASE64_PNG_PREFIX)

  if (idx !== -1) {
    // Extract the data URI — take from the prefix to end of line or end of string
    const start = idx
    const endNewline = output.indexOf('\n', start)
    const dataUri = endNewline === -1 ? output.slice(start) : output.slice(start, endNewline)

    // Any text before the image
    const textBefore = output.slice(0, idx).trim()
    // Any text after the image
    const textAfter = endNewline === -1 ? '' : output.slice(endNewline + 1).trim()

    return (
      <div className="flex flex-col gap-2">
        {textBefore && (
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">{textBefore}</pre>
        )}
        <img
          src={dataUri}
          alt="Matplotlib output"
          className="max-w-full rounded border border-gray-700"
        />
        {textAfter && (
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">{textAfter}</pre>
        )}
      </div>
    )
  }

  // No image detected — render as plain text
  return (
    <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">{output}</pre>
  )
}
