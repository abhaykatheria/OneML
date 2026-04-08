import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/linear-regression',
  title: 'Linear Regression',
  description: 'Fitting lines to data with ordinary least squares and gradient descent',
  track: 'classical',
  order: 1,
  tags: ['regression', 'linear', 'gradient-descent', 'mse', 'ols'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function randn(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
}

/* ------------------------------------------------------------------ */
/* Section 2 — OLS Interactive Sketch                                  */
/* ------------------------------------------------------------------ */

function OLSSketch() {
  const [slope, setSlope] = useState(0.5)
  const [intercept, setIntercept] = useState(150)
  const [mse, setMse] = useState(0)
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const slopeRef = useRef(slope)
  const interceptRef = useRef(intercept)
  slopeRef.current = slope
  interceptRef.current = intercept

  const sketch = useCallback(
    (p: p5) => {
      const pts = pointsRef.current
      const canvasH = 420

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)

        // Seed some initial points if empty
        if (pts.length === 0) {
          const rng = makeRng(42)
          for (let i = 0; i < 12; i++) {
            const x = 50 + rng() * (pw - 100)
            const y = canvasH - (0.4 * x + 80 + randn(rng) * 40)
            pts.push({ x, y })
          }
        }
      }

      p.draw = () => {
        const m = slopeRef.current
        const b = interceptRef.current

        p.background(15, 23, 42)

        // Grid
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        for (let x = 0; x < p.width; x += 50) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 50) p.line(0, y, p.width, y)

        // Regression line
        const y0 = -m * 0 + b
        const y1 = -m * p.width + b
        p.stroke(236, 72, 153)
        p.strokeWeight(2.5)
        p.line(0, y0, p.width, y1)

        // Residual lines and MSE computation
        let totalSqErr = 0
        for (const pt of pts) {
          const pred = -m * pt.x + b
          const err = pt.y - pred

          // Dashed residual line
          p.stroke(250, 204, 21, 120)
          p.strokeWeight(1)
          const steps = Math.max(1, Math.floor(Math.abs(err) / 8))
          for (let s = 0; s < steps; s++) {
            if (s % 2 === 0) {
              const segStart = pt.y - (err * s) / steps
              const segEnd = pt.y - (err * (s + 0.6)) / steps
              p.line(pt.x, segStart, pt.x, segEnd)
            }
          }

          // Squared error rectangle (faint)
          const sideLen = Math.min(Math.abs(err), 60)
          p.noStroke()
          p.fill(250, 204, 21, 25)
          p.rect(pt.x, Math.min(pt.y, pred), sideLen, Math.abs(err))

          totalSqErr += err * err
        }

        const currentMSE = pts.length > 0 ? totalSqErr / pts.length : 0
        setMse(currentMSE)

        // Data points
        p.noStroke()
        for (const pt of pts) {
          p.fill(99, 102, 241)
          p.ellipse(pt.x, pt.y, 12, 12)
        }

        // Labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`MSE: ${currentMSE.toFixed(1)}`, 10, 10)
        p.text(`y = ${(-m).toFixed(2)}x + ${b.toFixed(0)}`, 10, 28)
        p.text('Click to add points', 10, p.height - 22)
      }

      p.mousePressed = () => {
        if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
          pts.push({ x: p.mouseX, y: p.mouseY })
        }
      }
    },
    [], // stable reference — reads current values from refs
  )

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <label className="flex items-center gap-2">
                Slope:
                <input
                  type="range" min={-2} max={2} step={0.01} value={slope}
                  onChange={(e) => setSlope(parseFloat(e.target.value))}
                  className="w-40 accent-pink-500"
                />
                <span className="w-16 font-mono">{(-slope).toFixed(2)}</span>
              </label>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <label className="flex items-center gap-2">
                Intercept:
                <input
                  type="range" min={0} max={420} step={1} value={intercept}
                  onChange={(e) => setIntercept(parseFloat(e.target.value))}
                  className="w-40 accent-pink-500"
                />
                <span className="w-16 font-mono">{intercept.toFixed(0)}</span>
              </label>
              <span className="ml-auto font-mono text-yellow-400">MSE: {mse.toFixed(1)}</span>
            </div>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Gradient Descent Animation                              */
/* ------------------------------------------------------------------ */

function GradientDescentSketch() {
  const [lr, setLr] = useState(0.05)
  const [running, setRunning] = useState(true)
  const lrRef = useRef(lr)
  const runningRef = useRef(running)
  const resetRef = useRef(0)
  lrRef.current = lr
  runningRef.current = running

  const sketch = useCallback(
    (p: p5) => {
      // Generate normalized data: x in [0,1], y ≈ 0.7x + 0.2 + noise
      const dataPoints: { x: number; y: number }[] = []
      const rng = makeRng(77)
      for (let i = 0; i < 20; i++) {
        const x = rng()
        const y = 0.7 * x + 0.2 + randn(rng) * 0.08
        dataPoints.push({ x, y })
      }

      let w = 0
      let b = 0
      const mseHistory: number[] = []
      let lastReset = 0
      const canvasH = 440
      const margin = 40

      function computeMSE(): number {
        let sum = 0
        for (const pt of dataPoints) {
          const pred = w * pt.x + b
          sum += (pt.y - pred) ** 2
        }
        return sum / dataPoints.length
      }

      function gradientStep() {
        const n = dataPoints.length
        let dw = 0
        let db = 0
        for (const pt of dataPoints) {
          const pred = w * pt.x + b
          const err = pred - pt.y
          dw += (2 / n) * err * pt.x
          db += (2 / n) * err
        }
        w -= lrRef.current * dw
        b -= lrRef.current * db
      }

      // Convert normalized coords to pixel coords
      function toPixelX(nx: number, areaW: number): number {
        return margin + nx * (areaW - 2 * margin)
      }
      function toPixelY(ny: number): number {
        return canvasH - margin - ny * (canvasH - 2 * margin)
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 800
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const mainW = p.width * 0.65
        const chartX = mainW + 20
        const chartW = p.width - chartX - 20
        const chartH = p.height - 80

        // Divider
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        p.line(mainW, 0, mainW, p.height)

        // Grid on main area
        p.stroke(30, 41, 59)
        for (let x = 0; x < mainW; x += 50) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 50) p.line(0, y, mainW, y)

        // Check for reset
        if (resetRef.current !== lastReset) {
          lastReset = resetRef.current
          w = 0
          b = 0
          mseHistory.length = 0
        }

        // Gradient descent steps
        if (runningRef.current) {
          for (let i = 0; i < 3; i++) gradientStep()
          mseHistory.push(computeMSE())
          if (mseHistory.length > 500) mseHistory.shift()
        }

        // Residuals
        p.stroke(250, 204, 21, 80)
        p.strokeWeight(1)
        for (const pt of dataPoints) {
          const px = toPixelX(pt.x, mainW)
          const pyActual = toPixelY(pt.y)
          const pyPred = toPixelY(w * pt.x + b)
          p.line(px, pyActual, px, pyPred)
        }

        // Regression line
        p.stroke(236, 72, 153)
        p.strokeWeight(2.5)
        const lineY0 = toPixelY(w * 0 + b)
        const lineY1 = toPixelY(w * 1 + b)
        p.line(toPixelX(0, mainW), lineY0, toPixelX(1, mainW), lineY1)

        // Data points
        p.noStroke()
        for (const pt of dataPoints) {
          p.fill(99, 102, 241)
          p.ellipse(toPixelX(pt.x, mainW), toPixelY(pt.y), 10, 10)
        }

        // --- MSE chart panel ---
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('MSE over iterations', chartX + chartW / 2, 12)

        // Chart axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(chartX, 40, chartX, 40 + chartH)
        p.line(chartX, 40 + chartH, chartX + chartW, 40 + chartH)

        if (mseHistory.length > 1) {
          const maxMSE = Math.max(...mseHistory.slice(0, 10), 0.001)
          p.stroke(52, 211, 153)
          p.strokeWeight(1.5)
          p.noFill()
          p.beginShape()
          for (let i = 0; i < mseHistory.length; i++) {
            const px = chartX + (i / (mseHistory.length - 1)) * chartW
            const py = 40 + chartH - Math.min(1, mseHistory[i] / maxMSE) * chartH
            p.vertex(px, Math.max(40, py))
          }
          p.endShape()

          // Current MSE label
          p.noStroke()
          p.fill(52, 211, 153)
          p.textSize(11)
          p.textAlign(p.LEFT, p.TOP)
          const currentMSE = mseHistory[mseHistory.length - 1]
          p.text(`MSE: ${currentMSE.toFixed(4)}`, chartX + 4, 40 + chartH + 8)
        }

        // Parameter labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`w: ${w.toFixed(3)}  b: ${b.toFixed(3)}`, 10, 10)
        p.text(`iter: ${mseHistory.length}`, 10, 26)
      }
    },
    [], // stable — reads lr/running from refs
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2 flex-wrap">
          <label className="flex items-center gap-2">
            Learning Rate:
            <input
              type="range" min={0.01} max={2} step={0.01} value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              className="w-36 accent-emerald-500"
            />
            <span className="w-16 font-mono">{lr.toFixed(2)}</span>
          </label>
          <button
            onClick={() => setRunning(!running)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            {running ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={() => { resetRef.current++; setRunning(true) }}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Reset
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 5 — Residual Analysis Sketch                                */
/* ------------------------------------------------------------------ */

function generateResidualData(good: boolean) {
  const rng = makeRng(good ? 55 : 99)
  const points: { x: number; pred: number; actual: number }[] = []
  for (let i = 0; i < 40; i++) {
    const x = rng() * 8 + 1
    const y = good
      ? 2.5 * x + 10 + randn(rng) * 3
      : 0.5 * x * x + 5 + randn(rng) * (x * 1.5)
    points.push({ x, pred: 0, actual: y })
  }
  const n = points.length
  const meanX = points.reduce((s, pt) => s + pt.x, 0) / n
  const meanY = points.reduce((s, pt) => s + pt.actual, 0) / n
  let num = 0, den = 0
  for (const pt of points) {
    num += (pt.x - meanX) * (pt.actual - meanY)
    den += (pt.x - meanX) ** 2
  }
  const w = den !== 0 ? num / den : 0
  const b = meanY - w * meanX
  for (const pt of points) pt.pred = w * pt.x + b
  return { points, w, b }
}

function ResidualSketch() {
  const [showGood, setShowGood] = useState(true)
  const dataRef = useRef(generateResidualData(true))
  const showGoodRef = useRef(showGood)

  // Regenerate data when toggle changes
  if (showGoodRef.current !== showGood) {
    showGoodRef.current = showGood
    dataRef.current = generateResidualData(showGood)
  }

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 380

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 800
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        const { points, w: wOLS, b: bOLS } = dataRef.current
        const good = showGoodRef.current

        p.background(15, 23, 42)
        const half = p.width / 2
        const margin = 50

        // Left panel: Fit plot
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Data + Fit', half / 2, 10)

        const xMin = 0, xMax = 10, yMin = -10, yMax = good ? 45 : 60
        const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * (half - margin * 2)
        const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * (canvasH - margin * 2)

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, canvasH - margin, half - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Fit line
        p.stroke(236, 72, 153)
        p.strokeWeight(2)
        p.line(mapX(xMin), mapY(wOLS * xMin + bOLS), mapX(xMax), mapY(wOLS * xMax + bOLS))

        // Points
        p.noStroke()
        for (const pt of points) {
          p.fill(99, 102, 241)
          p.ellipse(mapX(pt.x), mapY(pt.actual), 8, 8)
        }

        // Divider
        p.stroke(51, 65, 85)
        p.strokeWeight(2)
        p.line(half, 0, half, canvasH)

        // Right panel: Residual plot
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Residuals vs Predicted', half + (p.width - half) / 2, 10)

        const residuals = points.map(pt => pt.actual - pt.pred)
        const predMin = Math.min(...points.map(pt => pt.pred)) - 2
        const predMax = Math.max(...points.map(pt => pt.pred)) + 2
        const resMax = Math.max(...residuals.map(Math.abs)) * 1.3

        const mapPX = (v: number) => half + margin + ((v - predMin) / (predMax - predMin)) * (p.width - half - margin * 2)
        const mapRY = (v: number) => canvasH / 2 - (v / resMax) * (canvasH / 2 - margin)

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(half + margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(half + margin, margin, half + margin, canvasH - margin)

        // Zero line
        p.stroke(250, 204, 21, 100)
        p.strokeWeight(1)
        p.line(half + margin, canvasH / 2, p.width - margin, canvasH / 2)

        // Residual points
        p.noStroke()
        for (let i = 0; i < points.length; i++) {
          const isGood = Math.abs(residuals[i]) < resMax * 0.5
          p.fill(isGood ? 52 : 244, isGood ? 211 : 63, isGood ? 153 : 94, 200)
          p.ellipse(mapPX(points[i].pred), mapRY(residuals[i]), 8, 8)
        }

        // Status label
        p.noStroke()
        p.fill(good ? 52 : 244, good ? 211 : 63, good ? 153 : 94)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(
          good ? 'Good: random scatter, constant variance' : 'Bad: pattern visible, variance grows',
          p.width - 10, canvasH - 22,
        )
      }
    },
    [],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setShowGood(!showGood)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            {showGood ? 'Show Bad Residuals' : 'Show Good Residuals'}
          </button>
          <span className="text-gray-400">
            {showGood ? 'Linear data with homoscedastic noise' : 'Quadratic data fit with a line — heteroscedastic'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function LinearRegression() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: The Simplest ML Model ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Simplest ML Model</h2>

        <p className="mb-4">
          Every journey into machine learning begins with the same question: given some data, can we find a
          pattern? Linear regression is the answer in its simplest form. We assume the relationship between
          an input variable <em>x</em> and an output variable <em>y</em> can be approximated by a straight
          line:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">y = mx + b</code>
        </div>

        <p className="mb-4">
          Here <code className="text-pink-400">m</code> is the slope (how steep the line is) and{' '}
          <code className="text-pink-400">b</code> is the intercept (where the line crosses the y-axis).
          The model has only two parameters, making it beautifully interpretable: the slope tells you
          &ldquo;for every unit increase in x, y changes by m units.&rdquo;
        </p>

        <p className="mb-4">
          But what does &ldquo;best fit&rdquo; mean? Real data never falls perfectly on a line. Every
          data point has some deviation from the line, called a <strong className="text-white">residual</strong>.
          The &ldquo;best&rdquo; line is the one that makes these residuals as small as possible, collectively.
          This is where the concept of a <strong className="text-white">loss function</strong> enters the picture
          — a single number that measures how wrong our model is, and that we can systematically minimize.
        </p>

        <p className="mb-4">
          Linear regression is not just a toy model. It is the foundation of nearly all machine learning.
          Neural networks are built from layers of linear transformations. Understanding how to fit a single
          line — and why certain fitting procedures work — gives you the conceptual bedrock for everything
          that follows.
        </p>
      </section>

      {/* ========== Section 2: OLS ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Ordinary Least Squares</h2>

        <p className="mb-4">
          The most common way to define &ldquo;best fit&rdquo; is to minimize the{' '}
          <strong className="text-white">Mean Squared Error (MSE)</strong>. For each data point, we compute
          the vertical distance between the actual value and the predicted value on our line. We square these
          distances (so negative and positive errors don&rsquo;t cancel out), then average them:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-emerald-400">
            MSE = (1/n) * sum((y_i - (mx_i + b))^2)
          </code>
        </div>

        <p className="mb-4">
          Geometrically, each squared residual corresponds to the area of a square whose side length is the
          residual. The MSE is the average area of these squares. Minimizing MSE means making those squares
          as small as possible.
        </p>

        <p className="mb-4">
          In the visualization below, <strong className="text-white">click to add data points</strong>, then
          drag the slope and intercept sliders to try minimizing the MSE yourself. Watch the dashed yellow
          lines (residuals) and the faint yellow squares that represent each point&rsquo;s squared error.
          Can you find the combination of slope and intercept that gives the lowest MSE?
        </p>

        <OLSSketch />

        <p className="mt-4">
          Notice something important: the optimal line does not necessarily pass through any data point.
          It balances errors above and below. This is the key insight of least squares — it finds the
          compromise that minimizes total squared error across all points.
        </p>
      </section>

      {/* ========== Section 3: Gradient Descent ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Gradient Descent for Linear Regression</h2>

        <p className="mb-4">
          Manually dragging sliders is fun, but how does a computer find the best line automatically?
          The answer is <strong className="text-white">gradient descent</strong>, the workhorse optimization
          algorithm behind almost all of machine learning.
        </p>

        <p className="mb-4">
          The idea is beautifully simple: start with random values for <em>m</em> and <em>b</em>. Compute
          the MSE. Then ask: &ldquo;If I nudge <em>m</em> a tiny bit, does the MSE go up or down?&rdquo;
          The gradient tells us the direction of steepest increase, so we move in the <em>opposite</em>{' '}
          direction. We do the same for <em>b</em>. Repeat.
        </p>

        <p className="mb-4">
          The <strong className="text-white">learning rate</strong> controls how big each step is. Too small
          and the algorithm crawls. Too large and it overshoots, bouncing wildly. In the visualization below,
          watch the line animate from a random start toward the best fit. The side panel shows the MSE
          decreasing over iterations. Try adjusting the learning rate to see its effect.
        </p>

        <GradientDescentSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">The Gradient Descent Update Rule</h3>

        <p className="mb-4">
          At each step, we compute the partial derivatives of MSE with respect to each parameter:
        </p>

        <div className="my-4 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 font-mono text-sm space-y-2">
          <p className="text-emerald-400">dMSE/dw = (2/n) * sum((predicted - actual) * x_i)</p>
          <p className="text-emerald-400">dMSE/db = (2/n) * sum(predicted - actual)</p>
          <p className="text-gray-400 mt-3">Then update:</p>
          <p className="text-pink-400">w = w - learning_rate * dMSE/dw</p>
          <p className="text-pink-400">b = b - learning_rate * dMSE/db</p>
        </div>

        <p className="mb-4">
          For linear regression specifically, the MSE loss is a convex, bowl-shaped surface. This means
          gradient descent is guaranteed to find the global minimum (there are no local minima to get trapped
          in). This is not true for neural networks, which is one reason why linear regression is a great
          starting point.
        </p>
      </section>

      {/* ========== Section 4: Multiple Features ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Multiple Features</h2>

        <p className="mb-4">
          So far we have considered a single input variable. But real-world predictions depend on many
          features. Predicting house prices? You care about square footage, number of bedrooms, location,
          age. Each feature gets its own weight:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            y = w_1*x_1 + w_2*x_2 + ... + w_d*x_d + b
          </code>
        </div>

        <p className="mb-4">
          In matrix form, this becomes remarkably clean. We stack all our input features into a matrix{' '}
          <strong className="text-white">X</strong> (each row is one data point, each column is one feature),
          all our weights into a vector <strong className="text-white">w</strong>, and write:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-emerald-400">y = X * w</code>
        </div>

        <p className="mb-4">
          The Ordinary Least Squares solution has a beautiful closed-form expression derived by setting the
          gradient to zero and solving:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-yellow-400">w* = (X^T X)^(-1) X^T y</code>
        </div>

        <p className="mb-4">
          This is called the <strong className="text-white">normal equation</strong>. It gives the exact
          optimal weights in one computation — no iteration needed. However, it requires inverting a
          d-by-d matrix, which becomes expensive when d (the number of features) is very large. For
          high-dimensional problems, gradient descent is more practical.
        </p>

        <p className="mb-4">
          The key conceptual leap here is that linear regression in multiple dimensions is not fitting a
          line — it is fitting a <em>hyperplane</em>. In 2D inputs it is a plane; in 3D inputs it is a
          volume. The math, however, remains identical.
        </p>
      </section>

      {/* ========== Section 5: Residual Analysis ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Residual Analysis</h2>

        <p className="mb-4">
          Fitting a model is only half the job. You need to check whether the model&rsquo;s assumptions
          hold. A <strong className="text-white">residual plot</strong> — plotting residuals against
          predicted values — reveals whether your model is missing important structure in the data.
        </p>

        <p className="mb-4">
          <strong className="text-white">Good residuals</strong> look like random noise: scattered evenly
          above and below zero with roughly constant spread. This means the linear model has captured all
          the systematic pattern in the data.
        </p>

        <p className="mb-4">
          <strong className="text-white">Bad residuals</strong> show patterns. A curved pattern means the
          true relationship is non-linear and you need polynomial or other non-linear features.
          A fan shape (residuals growing with predictions) indicates{' '}
          <strong className="text-white">heteroscedasticity</strong> — the variance of errors is not
          constant, which violates a key OLS assumption and means your confidence intervals may be wrong.
        </p>

        <p className="mb-4">
          Toggle between the two cases below. In the &ldquo;good&rdquo; case, we generate data from a
          true linear relationship. In the &ldquo;bad&rdquo; case, the data is actually quadratic but we
          force a linear fit — notice the obvious pattern in the residuals.
        </p>

        <ResidualSketch />
      </section>

      {/* ========== Section 6: Python — Manual Gradient Descent ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Gradient Descent from Scratch</h2>

        <p className="mb-4">
          Let us implement linear regression with gradient descent using only NumPy, then compare with
          scikit-learn&rsquo;s built-in implementation. Run the code below to see both approaches
          converge to the same result.
        </p>

        <PythonCell
          title="Linear Regression — Manual GD vs sklearn"
          defaultCode={`import numpy as np
from sklearn.linear_model import LinearRegression

# Generate synthetic data: y = 3x + 7 + noise
np.random.seed(42)
X = np.random.rand(100, 1) * 10
y = 3 * X.squeeze() + 7 + np.random.randn(100) * 2

# --- Manual gradient descent ---
w, b = 0.0, 0.0
lr = 0.001
n = len(X)
mse_history = []

for epoch in range(500):
    preds = w * X.squeeze() + b
    errors = preds - y
    dw = (2 / n) * np.sum(errors * X.squeeze())
    db = (2 / n) * np.sum(errors)
    w -= lr * dw
    b -= lr * db
    mse = np.mean(errors ** 2)
    mse_history.append(mse)

print(f"Manual GD:  w = {w:.4f}, b = {b:.4f}, final MSE = {mse_history[-1]:.4f}")
print(f"MSE after 10 epochs: {mse_history[9]:.4f}")
print(f"MSE after 100 epochs: {mse_history[99]:.4f}")
print(f"MSE after 500 epochs: {mse_history[499]:.4f}")

# --- sklearn ---
model = LinearRegression().fit(X, y)
print(f"\\nsklearn:    w = {model.coef_[0]:.4f}, b = {model.intercept_:.4f}")
print(f"sklearn MSE = {np.mean((model.predict(X) - y) ** 2):.4f}")
print("\\nBoth methods find nearly identical parameters!")
`}
        />
      </section>

      {/* ========== Section 7: Python — Plotting ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Visualizing the Fit and Residuals</h2>

        <p className="mb-4">
          Good practice always includes visualizing both the fit and the residuals. The code below creates
          the fitted line, a residual plot, and the MSE convergence history.
        </p>

        <PythonCell
          title="Fit, Residuals, and MSE History"
          defaultCode={`import numpy as np

# Reproduce the data and fit
np.random.seed(42)
X = np.random.rand(100) * 10
y = 3 * X + 7 + np.random.randn(100) * 2

# Quick OLS via normal equation
X_design = np.column_stack([X, np.ones(len(X))])
w_star = np.linalg.lstsq(X_design, y, rcond=None)[0]
w, b = w_star[0], w_star[1]
predictions = w * X + b
residuals = y - predictions

print(f"OLS solution: y = {w:.4f}x + {b:.4f}")
print(f"MSE: {np.mean(residuals ** 2):.4f}")
print(f"\\nResidual statistics:")
print(f"  Mean: {np.mean(residuals):.6f} (should be ~0)")
print(f"  Std:  {np.std(residuals):.4f}")
print(f"  Min:  {np.min(residuals):.4f}")
print(f"  Max:  {np.max(residuals):.4f}")

# Check: are residuals roughly normally distributed?
from scipy import stats
_, p_value = stats.shapiro(residuals)
print(f"\\nShapiro-Wilk normality test p-value: {p_value:.4f}")
print(f"Residuals {'appear normal' if p_value > 0.05 else 'may not be normal'} (p > 0.05)")
`}
        />
      </section>

      {/* ========== Summary ========== */}
      <section className="border-t border-gray-700 pt-8">
        <h2 className="mb-4 text-2xl font-bold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Linear regression fits <code className="text-pink-400">y = mx + b</code> by minimizing the Mean Squared Error.</li>
          <li>Gradient descent iteratively adjusts parameters in the direction that reduces the loss.</li>
          <li>The learning rate controls step size — too small is slow, too large diverges.</li>
          <li>Multiple features extend the model to <code className="text-pink-400">y = Xw</code>, fitting a hyperplane.</li>
          <li>Always check residual plots: random scatter is good, patterns indicate model misspecification.</li>
        </ul>
      </section>
    </article>
  )
}
