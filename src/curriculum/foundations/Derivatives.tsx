import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/derivatives',
  title: 'Derivatives & Tangent Lines',
  description: 'Visualize how the secant line becomes the tangent and why derivatives drive every ML optimizer.',
  track: 'foundations',
  order: 3,
  tags: ['calculus', 'derivatives', 'tangent', 'rate-of-change', 'optimization'],
}

/* ------------------------------------------------------------------ */
/* Shared math helpers                                                 */
/* ------------------------------------------------------------------ */

type MathFn = (x: number) => number

const FUNCTIONS: Record<string, { fn: MathFn; deriv: MathFn; label: string; derivLabel: string }> = {
  'x^2': {
    fn: (x) => x * x,
    deriv: (x) => 2 * x,
    label: 'f(x) = x\u00B2',
    derivLabel: "f'(x) = 2x",
  },
  'sin(x)': {
    fn: (x) => Math.sin(x),
    deriv: (x) => Math.cos(x),
    label: 'f(x) = sin(x)',
    derivLabel: "f'(x) = cos(x)",
  },
  'e^x': {
    fn: (x) => Math.exp(x),
    deriv: (x) => Math.exp(x),
    label: 'f(x) = e\u02E3',
    derivLabel: "f'(x) = e\u02E3",
  },
  'x^3 - 3x': {
    fn: (x) => x * x * x - 3 * x,
    deriv: (x) => 3 * x * x - 3,
    label: 'f(x) = x\u00B3 - 3x',
    derivLabel: "f'(x) = 3x\u00B2 - 3",
  },
}

/* ------------------------------------------------------------------ */
/* Section 1 — Secant → Tangent (shrinking h)                          */
/* ------------------------------------------------------------------ */

function SecantTangentSketch() {
  const [h, setH] = useState(2.0)
  const [pointX, setPointX] = useState(1.0)
  const hRef = useRef(h)
  hRef.current = h
  const pxRef = useRef(pointX)
  pxRef.current = pointX

  const fn = FUNCTIONS['x^2']

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 400
    const PAD = 50
    const xMin = -3
    const xMax = 4
    const yMin = -2
    const yMax = 10

    function mapX(x: number) { return PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD) }
    function mapY(y: number) { return H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD) }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const curH = hRef.current
      const px = pxRef.current

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let x = Math.ceil(xMin); x <= xMax; x++) p.line(mapX(x), 0, mapX(x), H)
      for (let y = Math.ceil(yMin); y <= yMax; y++) p.line(0, mapY(y), W, mapY(y))

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(mapX(xMin), mapY(0), mapX(xMax), mapY(0))
      p.line(mapX(0), mapY(yMin), mapX(0), mapY(yMax))

      // Axis labels
      p.fill(100, 116, 139)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      for (let x = Math.ceil(xMin); x <= xMax; x++) {
        if (x !== 0) p.text(String(x), mapX(x), mapY(0) + 4)
      }

      // Curve
      p.noFill()
      p.stroke(56, 189, 248)
      p.strokeWeight(2)
      p.beginShape()
      for (let sx = 0; sx < W; sx += 2) {
        const x = xMin + (sx / W) * (xMax - xMin)
        const y = fn.fn(x)
        p.vertex(mapX(x), mapY(y))
      }
      p.endShape()

      // Point on curve
      const py = fn.fn(px)
      p.fill(250, 204, 21)
      p.noStroke()
      p.ellipse(mapX(px), mapY(py), 10, 10)

      // Second point (secant)
      const px2 = px + curH
      const py2 = fn.fn(px2)
      p.fill(248, 113, 113)
      p.noStroke()
      p.ellipse(mapX(px2), mapY(py2), 8, 8)

      // Secant line through both points
      const secantSlope = (py2 - py) / (curH || 0.001)
      const trueSlope = fn.deriv(px)

      // Extend secant line across canvas
      const lx1 = xMin
      const ly1 = py + secantSlope * (lx1 - px)
      const lx2 = xMax
      const ly2 = py + secantSlope * (lx2 - px)
      p.stroke(248, 113, 113, 180)
      p.strokeWeight(1.5)
      p.line(mapX(lx1), mapY(ly1), mapX(lx2), mapY(ly2))

      // Tangent line (true derivative)
      const tly1 = py + trueSlope * (lx1 - px)
      const tly2 = py + trueSlope * (lx2 - px)
      p.stroke(52, 211, 153, 180)
      p.strokeWeight(1.5)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([6, 4])
      p.line(mapX(lx1), mapY(tly1), mapX(lx2), mapY(tly2))
      ctx.setLineDash([])

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`f(x) = x\u00B2   at x = ${px.toFixed(1)}`, 14, 14)
      p.fill(248, 113, 113)
      p.text(`Secant slope (h=${curH.toFixed(2)}): ${secantSlope.toFixed(4)}`, 14, 36)
      p.fill(52, 211, 153)
      p.text(`True derivative f'(${px.toFixed(1)}) = ${trueSlope.toFixed(4)}`, 14, 58)
      p.fill(148, 163, 184)
      p.textSize(12)
      p.text(`Error: ${Math.abs(secantSlope - trueSlope).toFixed(6)}`, 14, 82)

      // Legend
      p.fill(100, 116, 139)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Red = secant line | Green dashed = tangent line | Shrink h to see convergence', p.width / 2, H - 6)
    }
  }, [fn])

  return (
    <div>
      <P5Sketch sketch={sketch} height={400} />
      <div className="mt-3 flex flex-wrap items-center gap-6 px-2">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          h = {h.toFixed(2)}
          <input type="range" min={0.01} max={3} step={0.01} value={h}
            onChange={(e) => setH(Number(e.target.value))} className="w-48 accent-red-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          x = {pointX.toFixed(1)}
          <input type="range" min={-2} max={3} step={0.1} value={pointX}
            onChange={(e) => setPointX(Number(e.target.value))} className="w-32 accent-yellow-400" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Common Derivatives with Dropdown                        */
/* ------------------------------------------------------------------ */

function DerivativePlotSketch() {
  const [fnKey, setFnKey] = useState<keyof typeof FUNCTIONS>('x^2')
  const fnKeyRef = useRef(fnKey)
  fnKeyRef.current = fnKey

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 380
    const PAD = 50

    function getRange(key: string): { xMin: number; xMax: number; yMin: number; yMax: number } {
      switch (key) {
        case 'sin(x)': return { xMin: -7, xMax: 7, yMin: -2, yMax: 2 }
        case 'e^x': return { xMin: -3, xMax: 3, yMin: -1, yMax: 8 }
        case 'x^3 - 3x': return { xMin: -3, xMax: 3, yMin: -5, yMax: 5 }
        default: return { xMin: -4, xMax: 4, yMin: -2, yMax: 10 }
      }
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const key = fnKeyRef.current
      const f = FUNCTIONS[key]
      const { xMin, xMax, yMin, yMax } = getRange(key)

      const mapX = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD)
      const mapY = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) p.line(mapX(x), 0, mapX(x), H)
      for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) p.line(0, mapY(y), W, mapY(y))

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(mapX(xMin), mapY(0), mapX(xMax), mapY(0))
      p.line(mapX(0), mapY(yMin), mapX(0), mapY(yMax))

      // f(x) curve
      p.noFill()
      p.stroke(56, 189, 248)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let sx = 0; sx <= W; sx += 2) {
        const x = xMin + (sx / W) * (xMax - xMin)
        const y = f.fn(x)
        if (y >= yMin - 2 && y <= yMax + 2) p.vertex(mapX(x), mapY(y))
      }
      p.endShape()

      // f'(x) curve
      p.noFill()
      p.stroke(250, 204, 21)
      p.strokeWeight(2)
      p.beginShape()
      for (let sx = 0; sx <= W; sx += 2) {
        const x = xMin + (sx / W) * (xMax - xMin)
        const y = f.deriv(x)
        if (y >= yMin - 2 && y <= yMax + 2) p.vertex(mapX(x), mapY(y))
      }
      p.endShape()

      // Moving marker at mouse x
      if (p.mouseX > PAD && p.mouseX < W - PAD && p.mouseY > 0 && p.mouseY < H) {
        const mx = xMin + ((p.mouseX - PAD) / (W - 2 * PAD)) * (xMax - xMin)
        const fy = f.fn(mx)
        const dy = f.deriv(mx)

        // Tangent line at cursor
        const tLen = (xMax - xMin) * 0.15
        p.stroke(52, 211, 153, 140)
        p.strokeWeight(1.5)
        p.line(mapX(mx - tLen), mapY(fy - dy * tLen), mapX(mx + tLen), mapY(fy + dy * tLen))

        // Dots
        p.fill(56, 189, 248)
        p.noStroke()
        p.ellipse(mapX(mx), mapY(fy), 8, 8)
        p.fill(250, 204, 21)
        p.ellipse(mapX(mx), mapY(dy), 8, 8)

        p.fill(255)
        p.textSize(12)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text(`x = ${mx.toFixed(2)}  f = ${fy.toFixed(2)}  f' = ${dy.toFixed(2)}`, mapX(mx) + 12, mapY(fy) - 4)
      }

      // Labels
      p.fill(56, 189, 248)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(f.label, 14, 14)
      p.fill(250, 204, 21)
      p.text(f.derivLabel, 14, 34)
      p.fill(100, 116, 139)
      p.textSize(11)
      p.text('Hover to see tangent line and values', 14, 56)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={380} />
      <div className="mt-2 flex flex-wrap gap-2 px-2">
        {Object.keys(FUNCTIONS).map((key) => (
          <button
            key={key}
            onClick={() => setFnKey(key as keyof typeof FUNCTIONS)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              fnKey === key ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Animated Ball (rate of change)                          */
/* ------------------------------------------------------------------ */

function RateOfChangeSketch() {
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const timeRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 320
    const PAD = 50
    const xMin = 0
    const xMax = 10
    const yMin = 0
    const yMax = 50

    // Position function: s(t) = 0.5 * t^2
    const pos = (t: number) => 0.5 * t * t
    const vel = (t: number) => t // derivative of position

    const mapX = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD)
    const mapY = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD)

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)

      if (playingRef.current) {
        timeRef.current += 0.02
        if (timeRef.current > xMax) timeRef.current = 0
      }

      const t = timeRef.current
      const s = pos(t)
      const v = vel(t)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let x = 0; x <= 10; x++) p.line(mapX(x), 0, mapX(x), H)
      for (let y = 0; y <= 50; y += 10) p.line(0, mapY(y), W, mapY(y))

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(mapX(xMin), mapY(0), mapX(xMax), mapY(0))
      p.line(mapX(0), mapY(yMin), mapX(0), mapY(yMax))

      // Labels
      p.fill(100, 116, 139)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('time (s)', W / 2, H - 15)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('position', PAD - 8, mapY(yMax / 2))

      // Position curve
      p.noFill()
      p.stroke(56, 189, 248)
      p.strokeWeight(2)
      p.beginShape()
      for (let sx = 0; sx <= W; sx += 3) {
        const tx = xMin + ((sx - PAD) / (W - 2 * PAD)) * (xMax - xMin)
        if (tx >= 0 && tx <= xMax) {
          const sy = pos(tx)
          p.vertex(mapX(tx), mapY(sy))
        }
      }
      p.endShape()

      // Current point
      p.fill(250, 204, 21)
      p.noStroke()
      p.ellipse(mapX(t), mapY(s), 12, 12)

      // Tangent line at current point
      const tLen = 1.5
      p.stroke(52, 211, 153, 180)
      p.strokeWeight(1.5)
      p.line(mapX(t - tLen), mapY(s - v * tLen), mapX(t + tLen), mapY(s + v * tLen))

      // Ball visualization at top
      const ballY = 30
      const ballX = mapX(t)
      p.fill(250, 204, 21)
      p.noStroke()
      p.ellipse(ballX, ballY, 20, 20)

      // Velocity arrow on ball
      const arrowLen = v * 8
      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.line(ballX, ballY, ballX + arrowLen, ballY)
      if (arrowLen > 2) {
        p.fill(52, 211, 153)
        p.noStroke()
        p.triangle(ballX + arrowLen, ballY, ballX + arrowLen - 6, ballY - 4, ballX + arrowLen - 6, ballY + 4)
      }

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.RIGHT, p.TOP)
      p.text(`t = ${t.toFixed(2)}s`, W - 14, 14)
      p.text(`position = ${s.toFixed(2)}`, W - 14, 36)
      p.fill(52, 211, 153)
      p.text(`velocity = ${v.toFixed(2)}  (derivative)`, W - 14, 58)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={320} />
      <div className="mt-2 flex items-center gap-3 px-2">
        <button
          onClick={() => { setPlaying(!playing); playingRef.current = !playing }}
          className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-600"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => { timeRef.current = 0 }}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
        >
          Reset
        </button>
        <span className="text-sm text-gray-400">
          s(t) = 0.5t&sup2; &mdash; velocity is the derivative of position
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const numericalDerivCode = `import numpy as np

# Numerical derivative: f'(x) ≈ [f(x+h) - f(x)] / h
def numerical_derivative(f, x, h=1e-7):
    """Central difference is more accurate than forward difference."""
    return (f(x + h) - f(x - h)) / (2 * h)

# Test on f(x) = x^2 (true derivative = 2x)
f = lambda x: x**2
x = 3.0
approx = numerical_derivative(f, x)
exact = 2 * x
print(f"f(x) = x^2 at x = {x}")
print(f"  Numerical: {approx:.10f}")
print(f"  Exact:     {exact:.10f}")
print(f"  Error:     {abs(approx - exact):.2e}")

# Test on f(x) = sin(x) at x = pi/4
import math
g = math.sin
x2 = math.pi / 4
print(f"\\nf(x) = sin(x) at x = pi/4")
print(f"  Numerical: {numerical_derivative(g, x2):.10f}")
print(f"  Exact:     {math.cos(x2):.10f}")

# Show how h affects accuracy
print("\\nEffect of h on accuracy (forward difference for x^2 at x=3):")
for exp in range(1, 16):
    h = 10 ** (-exp)
    fd = (f(3 + h) - f(3)) / h
    err = abs(fd - 6.0)
    print(f"  h=1e-{exp:2d}  derivative={fd:.12f}  error={err:.2e}")
`

const chainRuleCode = `import numpy as np

# Chain rule: d/dx f(g(x)) = f'(g(x)) * g'(x)
# This is the foundation of backpropagation!

# Example: f(x) = sin(x^2)
# g(x) = x^2, f(u) = sin(u)
# f'(u) = cos(u), g'(x) = 2x
# So: d/dx sin(x^2) = cos(x^2) * 2x

x = np.linspace(-2, 2, 5)

# Analytical chain rule
analytical = np.cos(x**2) * 2 * x

# Numerical verification
h = 1e-7
numerical = (np.sin((x + h)**2) - np.sin((x - h)**2)) / (2 * h)

print("Chain rule: d/dx sin(x^2) = cos(x^2) * 2x")
print(f"{'x':>8s} {'analytical':>12s} {'numerical':>12s} {'error':>12s}")
for i in range(len(x)):
    err = abs(analytical[i] - numerical[i])
    print(f"{x[i]:8.2f} {analytical[i]:12.6f} {numerical[i]:12.6f} {err:12.2e}")

# Why this matters for ML:
print("\\n--- Why this matters ---")
print("Neural networks are compositions of functions:")
print("  output = f3(f2(f1(input)))")
print("Backpropagation uses the chain rule to compute")
print("gradients through every layer efficiently.")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Derivatives() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* Title */}
      <header>
        <h1 className="text-4xl font-bold text-white">Derivatives &amp; Tangent Lines</h1>
        <p className="mt-3 text-lg text-gray-300">
          The derivative measures how fast a function changes. It is the slope of the tangent
          line — the best linear approximation at a single point. Every optimizer in machine
          learning, from gradient descent to Adam, relies on derivatives to decide which way
          to adjust model parameters.
        </p>
      </header>

      {/* Section 1 — Secant → Tangent */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">From Secant to Tangent</h2>
        <p className="text-gray-300">
          Start with two points on a curve and draw the <strong className="text-white">secant
          line</strong> through them. As you slide the second point closer to the first (shrink
          <em> h</em>), the secant line rotates and approaches the{' '}
          <strong className="text-white">tangent line</strong> — the line that just barely
          touches the curve at one point. The slope of the tangent is the derivative.
        </p>
        <p className="text-gray-300">
          Use the slider below to shrink <em>h</em> toward zero and watch the red secant line
          converge to the green tangent. The error readout shows how the secant slope approaches
          the true derivative.
        </p>
        <SecantTangentSketch />
      </section>

      {/* Section 2 — Common Derivatives */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Common Derivatives</h2>
        <p className="text-gray-300">
          Different functions have different derivative formulas. Select a function below to see
          both the original function (blue) and its derivative (yellow) plotted simultaneously.
          Hover over the plot to see the tangent line and read off exact values.
        </p>
        <ul className="list-disc space-y-1 pl-6 text-gray-300">
          <li><code className="text-sky-400">d/dx (x&sup2;) = 2x</code> — the parabola gets steeper as x grows</li>
          <li><code className="text-sky-400">d/dx (sin x) = cos x</code> — derivative leads by 90 degrees</li>
          <li><code className="text-sky-400">d/dx (e&#x02E3;) = e&#x02E3;</code> — the exponential is its own derivative</li>
          <li><code className="text-sky-400">d/dx (x&sup3; - 3x) = 3x&sup2; - 3</code> — zeros of the derivative are extrema of the function</li>
        </ul>
        <DerivativePlotSketch />
      </section>

      {/* Section 3 — Rate of Change */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Rate of Change: Position &amp; Velocity</h2>
        <p className="text-gray-300">
          The most intuitive interpretation of the derivative is as a <strong className="text-white">
          rate of change</strong>. If position is a function of time, its derivative is velocity —
          how fast the position is changing at each instant. The ball below moves according to
          s(t) = 0.5t&sup2;. Its velocity (shown by the green arrow) increases linearly because
          the derivative of 0.5t&sup2; is t.
        </p>
        <p className="text-gray-300">
          In machine learning, the &ldquo;position&rdquo; is the loss value and the
          &ldquo;velocity&rdquo; is how fast the loss is changing with respect to each parameter.
          The derivative tells us which direction makes the loss decrease fastest.
        </p>
        <RateOfChangeSketch />
      </section>

      {/* Section 4 — Why Derivatives in ML */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Why Derivatives Matter for ML</h2>
        <p className="text-gray-300">
          Nearly every model in machine learning is trained by minimizing a <strong className="text-white">
          loss function</strong>. The core idea is simple:
        </p>
        <ol className="list-decimal space-y-2 pl-6 text-gray-300">
          <li>Compute the derivative of the loss with respect to each model parameter.</li>
          <li>Move each parameter a small step in the direction that decreases the loss (opposite the derivative).</li>
          <li>Repeat until the loss is small enough.</li>
        </ol>
        <p className="text-gray-300">
          This is gradient descent, and it only works because derivatives exist and can be
          computed efficiently. The <strong className="text-white">chain rule</strong> — which
          says the derivative of a composition f(g(x)) is f&prime;(g(x))&middot;g&prime;(x) —
          is the mathematical engine behind backpropagation in neural networks.
        </p>
      </section>

      {/* Python 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Numerical Derivatives</h2>
        <p className="text-gray-300">
          You can approximate any derivative numerically using the definition:
          f&prime;(x) &asymp; [f(x+h) - f(x-h)] / (2h). The central difference formula is
          more accurate than the forward difference. Run the cell below to see how the
          step size h affects accuracy — there is a sweet spot, because too-small h causes
          floating-point rounding errors.
        </p>
        <PythonCell defaultCode={numericalDerivCode} title="Numerical Derivatives" />
      </section>

      {/* Python 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: The Chain Rule</h2>
        <p className="text-gray-300">
          The chain rule is arguably the single most important calculus rule for deep learning.
          A neural network is a chain of function compositions, and backpropagation is just the
          chain rule applied recursively from output to input.
        </p>
        <PythonCell defaultCode={chainRuleCode} title="Chain Rule Verification" />
      </section>

      {/* Summary */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>The derivative is the slope of the tangent line — the instantaneous rate of change.</li>
          <li>It is defined as the limit of the secant slope as the two points merge.</li>
          <li>Common derivatives: power rule, trig, exponential.</li>
          <li>The chain rule decomposes derivatives of compositions — the basis of backpropagation.</li>
          <li>Gradient descent uses derivatives to iteratively minimize the loss function.</li>
        </ul>
      </section>
    </div>
  )
}
