import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/polynomial-regression',
  title: 'Polynomial Regression',
  description: 'Fitting curves to data with polynomials, understanding overfitting, bias-variance tradeoff, and train/test splits',
  track: 'classical',
  order: 2,
  tags: ['regression', 'polynomial', 'overfitting', 'underfitting', 'bias-variance', 'train-test'],
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

/** Fit a polynomial of given degree to points using normal equation. Returns coefficients [a0, a1, ..., ad]. */
function fitPolynomial(xs: number[], ys: number[], degree: number): number[] {
  const n = xs.length
  if (n === 0) return Array(degree + 1).fill(0)
  const d = Math.min(degree, n - 1)

  // Build Vandermonde matrix X and X^T * X, X^T * y
  const XtX: number[][] = Array.from({ length: d + 1 }, () => Array(d + 1).fill(0))
  const Xty: number[] = Array(d + 1).fill(0)

  for (let i = 0; i < n; i++) {
    const powers: number[] = [1]
    for (let j = 1; j <= 2 * d; j++) {
      powers.push(powers[j - 1] * xs[i])
    }
    for (let r = 0; r <= d; r++) {
      for (let c = 0; c <= d; c++) {
        XtX[r][c] += powers[r + c]
      }
      Xty[r] += powers[r] * ys[i]
    }
  }

  // Add tiny regularization for numerical stability
  for (let i = 0; i <= d; i++) {
    XtX[i][i] += 1e-8
  }

  // Gaussian elimination with partial pivoting
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]])
  const m = d + 1
  for (let col = 0; col < m; col++) {
    let maxRow = col
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-12) continue
    const pivot = aug[col][col]
    for (let j = col; j <= m; j++) aug[col][j] /= pivot
    for (let row = 0; row < m; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = col; j <= m; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  const coeffs = aug.map(row => row[m])
  // Pad with zeros if degree > d
  while (coeffs.length <= degree) coeffs.push(0)
  return coeffs
}

function evalPoly(coeffs: number[], x: number): number {
  let val = 0
  let xp = 1
  for (const c of coeffs) {
    val += c * xp
    xp *= x
  }
  return val
}

function computeMSE(xs: number[], ys: number[], coeffs: number[]): number {
  if (xs.length === 0) return 0
  let sum = 0
  for (let i = 0; i < xs.length; i++) {
    const err = ys[i] - evalPoly(coeffs, xs[i])
    sum += err * err
  }
  return sum / xs.length
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Polynomial Fitting                          */
/* ------------------------------------------------------------------ */

function PolyFitSketch() {
  const [degree, setDegree] = useState(3)
  const [mse, setMse] = useState(0)
  const pointsRef = useRef<{ x: number; y: number }[]>([])

  const sketch = useCallback(
    (p: p5) => {
      const pts = pointsRef.current
      const canvasH = 420

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)

        if (pts.length === 0) {
          const rng = makeRng(42)
          for (let i = 0; i < 15; i++) {
            const tx = -1 + (i / 14) * 2 + randn(rng) * 0.1
            const ty = 0.8 * tx * tx * tx - 0.5 * tx + randn(rng) * 0.3
            pts.push({ x: tx, y: ty })
          }
        }
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Grid
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        for (let x = 0; x < p.width; x += 50) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 50) p.line(0, y, p.width, y)

        const margin = 40
        const plotW = p.width - margin * 2
        const plotH = canvasH - margin * 2

        // Compute data range
        let xMin = -1.5, xMax = 1.5, yMin = -2, yMax = 2
        if (pts.length > 0) {
          xMin = Math.min(...pts.map(pt => pt.x)) - 0.3
          xMax = Math.max(...pts.map(pt => pt.x)) + 0.3
          yMin = Math.min(...pts.map(pt => pt.y)) - 0.5
          yMax = Math.max(...pts.map(pt => pt.y)) + 0.5
        }

        const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * plotW
        const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * plotH

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Fit polynomial
        const xs = pts.map(pt => pt.x)
        const ys = pts.map(pt => pt.y)
        const coeffs = fitPolynomial(xs, ys, degree)

        // Draw fitted curve
        p.stroke(236, 72, 153)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        const steps = 200
        for (let i = 0; i <= steps; i++) {
          const tx = xMin + (i / steps) * (xMax - xMin)
          const ty = evalPoly(coeffs, tx)
          const clampedY = Math.max(yMin - 1, Math.min(yMax + 1, ty))
          p.vertex(mapX(tx), mapY(clampedY))
        }
        p.endShape()

        // Residuals
        for (const pt of pts) {
          const pred = evalPoly(coeffs, pt.x)
          p.stroke(250, 204, 21, 100)
          p.strokeWeight(1)
          p.line(mapX(pt.x), mapY(pt.y), mapX(pt.x), mapY(pred))
        }

        // Data points
        p.noStroke()
        for (const pt of pts) {
          p.fill(99, 102, 241)
          p.ellipse(mapX(pt.x), mapY(pt.y), 10, 10)
        }

        // MSE
        const currentMSE = computeMSE(xs, ys, coeffs)
        setMse(currentMSE)

        // Labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Degree: ${degree}  |  MSE: ${currentMSE.toFixed(4)}`, margin + 5, 12)
        p.text('Click to add points', margin + 5, canvasH - 22)
      }

      p.mousePressed = () => {
        if (p.mouseX >= 40 && p.mouseX <= p.width - 40 && p.mouseY >= 40 && p.mouseY <= p.height - 40) {
          const margin = 40
          const plotW = p.width - margin * 2
          const plotH = p.height - margin * 2
          let xMin = -1.5, xMax = 1.5, yMin = -2, yMax = 2
          if (pts.length > 0) {
            xMin = Math.min(...pts.map(pt => pt.x)) - 0.3
            xMax = Math.max(...pts.map(pt => pt.x)) + 0.3
            yMin = Math.min(...pts.map(pt => pt.y)) - 0.5
            yMax = Math.max(...pts.map(pt => pt.y)) + 0.5
          }
          const tx = xMin + ((p.mouseX - margin) / plotW) * (xMax - xMin)
          const ty = yMax - ((p.mouseY - margin) / plotH) * (yMax - yMin)
          pts.push({ x: tx, y: ty })
        }
      }
    },
    [degree],
  )

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex items-center gap-4 text-sm text-gray-300 mt-2 flex-wrap">
            <label className="flex items-center gap-2">
              Polynomial Degree:
              <input
                type="range" min={1} max={10} step={1} value={degree}
                onChange={(e) => setDegree(parseInt(e.target.value))}
                className="w-40 accent-pink-500"
              />
              <span className="w-8 font-mono">{degree}</span>
            </label>
            <span className="ml-auto font-mono text-yellow-400">MSE: {mse.toFixed(4)}</span>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Overfitting vs Underfitting: Three Panels               */
/* ------------------------------------------------------------------ */

function ThreePanelSketch() {
  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 360
      const rng = makeRng(123)

      // Generate curved data: y = sin(x) + noise
      const data: { x: number; y: number }[] = []
      for (let i = 0; i < 20; i++) {
        const tx = -2 + (i / 19) * 4 + randn(rng) * 0.1
        const ty = Math.sin(tx * 1.2) + randn(rng) * 0.25
        data.push({ x: tx, y: ty })
      }

      const xs = data.map(d => d.x)
      const ys = data.map(d => d.y)

      const degrees = [1, 3, 15]
      const labels = ['Degree 1 (Underfit)', 'Degree 3 (Good Fit)', 'Degree 15 (Overfit)']
      const colors: [number, number, number][] = [
        [244, 63, 94],   // rose
        [52, 211, 153],  // emerald
        [244, 63, 94],   // rose (overfit)
      ]

      const allCoeffs = degrees.map(d => fitPolynomial(xs, ys, d))

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 900
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const panelW = p.width / 3
        const margin = 30
        const xMin = -2.5, xMax = 2.5, yMin = -2, yMax = 2

        for (let panelIdx = 0; panelIdx < 3; panelIdx++) {
          const offsetX = panelIdx * panelW
          const plotW = panelW - margin * 2

          const mapX = (v: number) => offsetX + margin + ((v - xMin) / (xMax - xMin)) * plotW
          const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * (canvasH - margin * 2)

          // Panel divider
          if (panelIdx > 0) {
            p.stroke(51, 65, 85)
            p.strokeWeight(1)
            p.line(offsetX, 0, offsetX, canvasH)
          }

          // Title
          p.noStroke()
          const [cr, cg, cb] = colors[panelIdx]
          p.fill(cr, cg, cb)
          p.textSize(12)
          p.textAlign(p.CENTER, p.TOP)
          p.text(labels[panelIdx], offsetX + panelW / 2, 8)

          // MSE label
          const panelMSE = computeMSE(xs, ys, allCoeffs[panelIdx])
          p.fill(148, 163, 184)
          p.textSize(10)
          p.text(`MSE: ${panelMSE.toFixed(4)}`, offsetX + panelW / 2, 24)

          // Axes
          p.stroke(51, 65, 85)
          p.strokeWeight(1)
          p.line(offsetX + margin, canvasH - margin, offsetX + panelW - margin, canvasH - margin)
          p.line(offsetX + margin, margin + 20, offsetX + margin, canvasH - margin)

          // Fitted curve
          p.stroke(cr, cg, cb)
          p.strokeWeight(2)
          p.noFill()
          p.beginShape()
          const steps = 200
          for (let i = 0; i <= steps; i++) {
            const tx = xMin + (i / steps) * (xMax - xMin)
            const ty = evalPoly(allCoeffs[panelIdx], tx)
            const clamped = Math.max(yMin - 0.5, Math.min(yMax + 0.5, ty))
            p.vertex(mapX(tx), mapY(clamped))
          }
          p.endShape()

          // True function (faint)
          p.stroke(148, 163, 184, 60)
          p.strokeWeight(1)
          p.noFill()
          p.beginShape()
          for (let i = 0; i <= steps; i++) {
            const tx = xMin + (i / steps) * (xMax - xMin)
            p.vertex(mapX(tx), mapY(Math.sin(tx * 1.2)))
          }
          p.endShape()

          // Data points
          p.noStroke()
          for (const pt of data) {
            p.fill(99, 102, 241)
            p.ellipse(mapX(pt.x), mapY(pt.y), 8, 8)
          }
        }
      }
    },
    [],
  )

  return <P5Sketch sketch={sketch} height={360} />
}

/* ------------------------------------------------------------------ */
/* Section 3 — Bias-Variance Tradeoff: Train/Test Error vs Complexity  */
/* ------------------------------------------------------------------ */

function BiasVarianceSketch() {
  const [highlighted, setHighlighted] = useState(3)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 400
      const rng = makeRng(77)

      // Generate data from sin function
      const allData: { x: number; y: number }[] = []
      for (let i = 0; i < 40; i++) {
        const tx = -2 + (i / 39) * 4 + randn(rng) * 0.05
        const ty = Math.sin(tx * 1.2) + randn(rng) * 0.25
        allData.push({ x: tx, y: ty })
      }

      // Split: first 25 train, rest test
      const trainData = allData.slice(0, 25)
      const testData = allData.slice(25)
      const trainX = trainData.map(d => d.x)
      const trainY = trainData.map(d => d.y)
      const testX = testData.map(d => d.x)
      const testY = testData.map(d => d.y)

      // Compute train/test MSE for degrees 1..10
      const maxDeg = 10
      const trainMSEs: number[] = []
      const testMSEs: number[] = []
      for (let deg = 1; deg <= maxDeg; deg++) {
        const coeffs = fitPolynomial(trainX, trainY, deg)
        trainMSEs.push(computeMSE(trainX, trainY, coeffs))
        testMSEs.push(computeMSE(testX, testY, coeffs))
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const margin = 60
        const plotW = p.width - margin * 2
        const plotH = canvasH - margin * 2

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Axis labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Polynomial Degree (Model Complexity)', p.width / 2, canvasH - 25)
        p.push()
        p.translate(18, canvasH / 2)
        p.rotate(-p.HALF_PI)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Mean Squared Error', 0, 0)
        p.pop()

        // Title
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Bias-Variance Tradeoff', p.width / 2, 10)

        // Cap test MSE for display
        const allMSEs = [...trainMSEs, ...testMSEs.map(v => Math.min(v, 5))]
        const maxMSE = Math.max(...allMSEs) * 1.1
        const minMSE = 0

        const mapX = (deg: number) => margin + ((deg - 0.5) / (maxDeg + 0.5)) * plotW
        const mapY = (v: number) => canvasH - margin - ((v - minMSE) / (maxMSE - minMSE)) * plotH

        // Degree tick labels
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        for (let d = 1; d <= maxDeg; d++) {
          p.text(String(d), mapX(d), canvasH - margin + 5)
        }

        // Highlighted degree vertical line
        p.stroke(99, 102, 241, 40)
        p.strokeWeight(plotW / maxDeg - 4)
        p.line(mapX(highlighted), margin, mapX(highlighted), canvasH - margin)

        // Train error line
        p.stroke(52, 211, 153)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let d = 1; d <= maxDeg; d++) {
          p.vertex(mapX(d), mapY(trainMSEs[d - 1]))
        }
        p.endShape()

        // Test error line
        p.stroke(244, 63, 94)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let d = 1; d <= maxDeg; d++) {
          p.vertex(mapX(d), mapY(Math.min(testMSEs[d - 1], maxMSE)))
        }
        p.endShape()

        // Points on lines
        for (let d = 1; d <= maxDeg; d++) {
          p.noStroke()
          p.fill(52, 211, 153)
          p.ellipse(mapX(d), mapY(trainMSEs[d - 1]), 8, 8)
          p.fill(244, 63, 94)
          p.ellipse(mapX(d), mapY(Math.min(testMSEs[d - 1], maxMSE)), 8, 8)
        }

        // Legend
        p.noStroke()
        p.fill(52, 211, 153)
        p.rect(p.width - 180, 40, 12, 3)
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Train Error', p.width - 162, 42)

        p.fill(244, 63, 94)
        p.rect(p.width - 180, 58, 12, 3)
        p.fill(148, 163, 184)
        p.text('Test Error', p.width - 162, 60)

        // Zone labels
        p.fill(244, 63, 94, 80)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text('UNDERFITTING', mapX(1.5), margin + 5)
        p.text('High Bias', mapX(1.5), margin + 18)
        p.text('OVERFITTING', mapX(maxDeg - 1), margin + 5)
        p.text('High Variance', mapX(maxDeg - 1), margin + 18)

        p.fill(52, 211, 153, 80)
        p.text('SWEET SPOT', mapX(3.5), margin + 5)

        // Info for highlighted degree
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(11)
        p.textAlign(p.LEFT, p.BOTTOM)
        const hi = highlighted - 1
        p.text(
          `Degree ${highlighted}: Train MSE = ${trainMSEs[hi].toFixed(4)}, Test MSE = ${Math.min(testMSEs[hi], 99).toFixed(4)}`,
          margin + 5,
          canvasH - margin - 5,
        )
      }
    },
    [highlighted],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Highlight Degree:
            <input
              type="range" min={1} max={10} step={1} value={highlighted}
              onChange={(e) => setHighlighted(parseInt(e.target.value))}
              className="w-40 accent-indigo-500"
            />
            <span className="w-8 font-mono">{highlighted}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const polyFitCode = `import numpy as np

# Generate curved data
np.random.seed(42)
n = 30
X = np.sort(np.random.uniform(-2, 2, n))
y_true = np.sin(X * 1.2)
y = y_true + np.random.normal(0, 0.25, n)

# Fit polynomials of different degrees
from numpy.polynomial import polynomial as P

for degree in [1, 3, 5, 9]:
    coeffs = np.polyfit(X, y, degree)
    y_pred = np.polyval(coeffs, X)
    mse = np.mean((y - y_pred)**2)
    print(f"Degree {degree:2d}: Train MSE = {mse:.4f}")

print()
print("Notice: Train MSE always decreases with degree.")
print("But does that mean the model is better? Not necessarily!")
`

const trainTestCode = `import numpy as np

# Generate data
np.random.seed(7)
n = 50
X = np.sort(np.random.uniform(-2, 2, n))
y_true = np.sin(X * 1.2)
y = y_true + np.random.normal(0, 0.25, n)

# Split into train (70%) and test (30%)
split = int(0.7 * n)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

print(f"Train samples: {len(X_train)}, Test samples: {len(X_test)}")
print()

# Fit polynomials and track BOTH train and test MSE
print(f"{'Degree':>6} | {'Train MSE':>10} | {'Test MSE':>10} | {'Status':>12}")
print("-" * 50)

best_test_mse = float('inf')
best_degree = 1

for degree in range(1, 11):
    coeffs = np.polyfit(X_train, y_train, degree)
    y_train_pred = np.polyval(coeffs, X_train)
    y_test_pred = np.polyval(coeffs, X_test)

    train_mse = np.mean((y_train - y_train_pred)**2)
    test_mse = np.mean((y_test - y_test_pred)**2)

    if test_mse < best_test_mse:
        best_test_mse = test_mse
        best_degree = degree

    # Detect overfitting: test error much higher than train
    if test_mse > train_mse * 3:
        status = "OVERFITTING"
    elif train_mse > 0.1:
        status = "UNDERFITTING"
    else:
        status = "OK"

    print(f"{degree:6d} | {train_mse:10.4f} | {test_mse:10.4f} | {status:>12}")

print()
print(f"Best degree by test MSE: {best_degree} (test MSE = {best_test_mse:.4f})")
print()
print("KEY INSIGHT: Train MSE always decreases,")
print("but test MSE has a U-shape -- it increases")
print("once the model starts memorizing noise.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function PolynomialRegression() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: When Lines Aren't Enough ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">When Lines Are Not Enough</h2>

        <p className="mb-4">
          Linear regression is powerful, but the real world is rarely linear. House prices do not increase
          at a constant rate with square footage. The relationship between study hours and exam scores
          levels off after a point. Chemical reaction rates follow curves, not straight lines.
        </p>

        <p className="mb-4">
          When the underlying relationship between inputs and outputs is curved, a straight line will
          systematically miss the pattern. The residuals will show a clear structure instead of random
          scatter — a telltale sign that we need a more flexible model.
        </p>

        <p className="mb-4">
          <strong className="text-white">Polynomial regression</strong> extends linear regression by adding
          powers of the input variable as new features. Instead of fitting <code className="text-pink-400">
          y = w_1*x + b</code>, we fit:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            y = w_d*x^d + w_(d-1)*x^(d-1) + ... + w_1*x + w_0
          </code>
        </div>

        <p className="mb-4">
          The degree <em>d</em> controls how flexible the curve can be. Degree 1 gives a straight line.
          Degree 2 gives a parabola. Degree 3 can capture an S-shaped curve. Higher degrees can fit
          increasingly complex patterns — but as we will see, this flexibility comes with a dangerous
          cost.
        </p>

        <p className="mb-4">
          A crucial insight: even though the model involves powers of <em>x</em>, it is still
          &ldquo;linear&rdquo; in the <em>parameters</em>. We are fitting a linear combination of
          features <code className="text-emerald-400">[1, x, x^2, ..., x^d]</code>. This means we can
          use the same normal equation and gradient descent techniques from linear regression.
        </p>
      </section>

      {/* ========== Section 2: Interactive Polynomial Fitting ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Fitting Polynomials to Data</h2>

        <p className="mb-4">
          The visualization below shows data with a curved pattern. Use the degree slider to see how
          polynomials of different degrees fit the data. <strong className="text-white">Click on the
          canvas</strong> to add your own data points and watch the curve adapt.
        </p>

        <p className="mb-4">
          Start with degree 1 (a straight line) and slowly increase it. At what degree does the curve
          start to capture the true pattern? At what degree does it start to do something suspicious —
          wiggling wildly between data points?
        </p>

        <PolyFitSketch />

        <p className="mt-4">
          As you increase the degree, the training MSE drops — the curve passes closer and closer to
          every data point. At very high degrees, the polynomial may pass through every single point,
          achieving near-zero training error. But look at how the curve behaves <em>between</em> the
          data points. It oscillates wildly. This is <strong className="text-white">overfitting</strong>:
          the model is memorizing the noise in the data rather than learning the underlying pattern.
        </p>
      </section>

      {/* ========== Section 3: Overfitting vs Underfitting ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Overfitting vs. Underfitting</h2>

        <p className="mb-4">
          These three panels show the same dataset fit with three different polynomial degrees. The faint
          gray curve shows the true underlying function (a sine wave) — the pattern we are trying to learn.
        </p>

        <ThreePanelSketch />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <h3 className="text-lg font-semibold text-rose-400 mb-2">Underfitting (Degree 1)</h3>
            <p className="text-sm">
              The model is too simple to capture the curve. It misses the systematic pattern in the data.
              Both training and test error are high. This is <strong className="text-white">high bias</strong>:
              the model has strong but wrong assumptions about the data.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">Good Fit (Degree 3)</h3>
            <p className="text-sm">
              The model captures the true pattern without fitting the noise. It will generalize well to new
              data. The curve closely follows the true function (gray) without wild oscillations.
            </p>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <h3 className="text-lg font-semibold text-rose-400 mb-2">Overfitting (Degree 15)</h3>
            <p className="text-sm">
              The model memorizes every data point, including their noise. It oscillates wildly between
              points. Training error is near zero, but it would perform terribly on new data. This is{' '}
              <strong className="text-white">high variance</strong>: the model is too sensitive to the
              specific training data.
            </p>
          </div>
        </div>
      </section>

      {/* ========== Section 4: Bias-Variance Tradeoff ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Bias-Variance Tradeoff</h2>

        <p className="mb-4">
          The tension between underfitting and overfitting is one of the most fundamental concepts in
          machine learning. It is known as the <strong className="text-white">bias-variance tradeoff</strong>.
        </p>

        <p className="mb-4">
          <strong className="text-white">Bias</strong> is the error from overly simplistic assumptions.
          A degree-1 polynomial has high bias because it assumes the data is linear when it is not.
          <strong className="text-white"> Variance</strong> is the error from excessive sensitivity to
          the training data. A degree-15 polynomial has high variance because it fits the noise and would
          give a completely different curve with a different random sample.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-yellow-400">
            Total Error = Bias^2 + Variance + Irreducible Noise
          </code>
        </div>

        <p className="mb-4">
          The chart below shows how training error and test error change as we increase model complexity.
          Training error always decreases (more parameters can always fit the training data better). But
          test error has a characteristic <strong className="text-white">U-shape</strong>: it decreases
          initially as the model gains the flexibility to capture the true pattern, then increases as the
          model starts fitting noise. The bottom of the U is the sweet spot.
        </p>

        <BiasVarianceSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Reading the Chart</h3>

        <p className="mb-4">
          Drag the slider to highlight different degrees and compare train vs. test error. Notice these
          key patterns:
        </p>

        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            <strong className="text-white">Low complexity (left)</strong>: Both errors are high. The model
            cannot represent the pattern. This is underfitting.
          </li>
          <li>
            <strong className="text-white">Moderate complexity (middle)</strong>: Both errors are low and
            close together. The model captures the pattern without overfitting.
          </li>
          <li>
            <strong className="text-white">High complexity (right)</strong>: Training error is tiny but
            test error explodes. The gap between them is the telltale sign of overfitting.
          </li>
        </ul>
      </section>

      {/* ========== Section 5: Train/Test Split ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Train/Test Split</h2>

        <p className="mb-4">
          How do we detect overfitting in practice? We cannot see the true underlying function (if we
          could, we would not need machine learning). The answer is to <strong className="text-white">
          hold out</strong> some data that the model never sees during training.
        </p>

        <p className="mb-4">
          The idea is simple: split your dataset into two parts. The <strong className="text-white">
          training set</strong> is used to fit the model. The <strong className="text-white">test set
          </strong> is used only to evaluate how well the model generalizes. If the model performs well
          on training data but poorly on test data, it is overfitting.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-emerald-500/60" />
            <div className="flex-1 h-4 rounded bg-rose-500/60" />
            <div className="flex-1 h-4 rounded bg-rose-500/60" />
            <div className="flex-1 h-4 rounded bg-rose-500/60" />
          </div>
          <div className="flex text-xs text-gray-400">
            <span className="flex-[7]">Training Set (70%)</span>
            <span className="flex-[3] text-right">Test Set (30%)</span>
          </div>
        </div>

        <p className="mb-4">
          A common split ratio is 70/30 or 80/20. The key rule: <em>never</em> use the test set to make
          decisions about the model. Once you choose your model based on test performance, the test set
          is &ldquo;used up&rdquo; and no longer provides an unbiased estimate. For model selection, you
          need a <strong className="text-white">validation set</strong> — a third split used to tune
          hyperparameters like the polynomial degree.
        </p>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Cross-Validation</h3>

        <p className="mb-4">
          When data is scarce, holding out 30% for testing feels wasteful. <strong className="text-white">
          K-fold cross-validation</strong> solves this by rotating which portion is the test set. The data
          is split into K equal parts. We train K times, each time using a different part as the test set
          and the remaining K-1 parts for training. The final score is the average across all K runs.
        </p>

        <p className="mb-4">
          This gives us a more reliable estimate of generalization performance while using all the data
          for both training and testing (just not at the same time).
        </p>
      </section>

      {/* ========== Section 6: Python — Fit Polynomials ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Fitting Polynomials</h2>

        <p className="mb-4">
          Let us see polynomial regression in action with NumPy. We generate curved data, fit polynomials
          of different degrees, and observe how training MSE changes with complexity.
        </p>

        <PythonCell defaultCode={polyFitCode} title="Polynomial Fit — Training MSE vs. Degree" />
      </section>

      {/* ========== Section 7: Python — Train vs Test ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Train vs. Test Error</h2>

        <p className="mb-4">
          Now the crucial experiment. We split the data into training and test sets, then compare
          how each polynomial degree performs on data it has never seen. This reveals the U-shaped
          test error curve — the empirical manifestation of the bias-variance tradeoff.
        </p>

        <PythonCell defaultCode={trainTestCode} title="Train/Test Split — Finding the Optimal Degree" />

        <p className="mt-4">
          Run the code and study the output carefully. The train MSE decreases monotonically with degree,
          but the test MSE reaches a minimum and then climbs. The degree with the lowest test MSE is our
          best choice — it balances model flexibility with generalization.
        </p>
      </section>

      {/* ========== Section 8: Key Takeaways ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Polynomial features add flexibility</h3>
            <p className="text-sm">
              By including x^2, x^3, etc. as features, we can fit curves while still using the linear
              regression machinery. The degree controls model complexity.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">More complex is not always better</h3>
            <p className="text-sm">
              A model that perfectly fits the training data may be useless on new data. The gap between
              training and test error is the signal for overfitting.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Always evaluate on held-out data</h3>
            <p className="text-sm">
              Train/test splits and cross-validation are essential tools. They let us estimate how well
              our model will perform in the real world, not just on the data we already have.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">The bias-variance tradeoff is universal</h3>
            <p className="text-sm">
              Every ML model faces this tradeoff. Too simple means high bias (underfitting). Too complex
              means high variance (overfitting). The art of ML is finding the sweet spot. In the next
              lesson on regularization, we will learn a principled way to control this tradeoff.
            </p>
          </div>
        </div>
      </section>
    </article>
  )
}
