import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'practical/feature-engineering',
  title: 'Feature Engineering',
  description: 'Selecting, creating, and transforming features to improve model performance',
  track: 'practical',
  order: 2,
  tags: ['feature-engineering', 'feature-selection', 'correlation', 'polynomial', 'pca', 'importance'],
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
/* Section 2 — Correlation Heatmap / Feature Selection Sketch          */
/* ------------------------------------------------------------------ */

function CorrelationHeatmapSketch() {
  const featureNames = ['Age', 'Income', 'Education', 'Hours', 'Score', 'Noise1', 'Noise2', 'Target']
  const n = featureNames.length

  // Precompute a correlation matrix (simulated)
  const corrMatrix = useRef<number[][]>([]).current
  if (corrMatrix.length === 0) {
    // Meaningful correlations
    const base: number[][] = [
      // Age  Inc  Edu  Hrs  Scr  N1   N2   Tgt
      [1.00, 0.65, 0.40, -0.10, 0.45, 0.05, -0.03, 0.35],
      [0.65, 1.00, 0.55, 0.15, 0.60, -0.02, 0.08, 0.72],
      [0.40, 0.55, 1.00, 0.05, 0.50, 0.01, -0.06, 0.58],
      [-0.10, 0.15, 0.05, 1.00, 0.20, 0.03, 0.02, 0.25],
      [0.45, 0.60, 0.50, 0.20, 1.00, -0.04, 0.07, 0.68],
      [0.05, -0.02, 0.01, 0.03, -0.04, 1.00, 0.10, 0.02],
      [-0.03, 0.08, -0.06, 0.02, 0.07, 0.10, 1.00, -0.01],
      [0.35, 0.72, 0.58, 0.25, 0.68, 0.02, -0.01, 1.00],
    ]
    for (const row of base) corrMatrix.push(row)
  }

  const [selected, setSelected] = useState<boolean[]>([true, true, true, true, true, true, true, false])
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // Compute simulated accuracy based on selected features
  function computeAccuracy(sel: boolean[]): number {
    // Base accuracy from each feature's correlation with target
    const targetCorrs = corrMatrix[n - 1]
    let signal = 0
    let noise = 0
    let count = 0
    for (let i = 0; i < n - 1; i++) {
      if (!sel[i]) continue
      count++
      const corr = Math.abs(targetCorrs[i])
      if (corr > 0.2) {
        signal += corr
      } else {
        noise += 0.02
      }
    }
    if (count === 0) return 0.5
    // Penalty for too many noisy features (curse of dimensionality)
    const base = 0.55 + signal * 0.15 - noise * 0.8
    // Slight penalty for redundant highly-correlated features
    let redundancy = 0
    const selIdx = []
    for (let i = 0; i < n - 1; i++) if (sel[i]) selIdx.push(i)
    for (let i = 0; i < selIdx.length; i++) {
      for (let j = i + 1; j < selIdx.length; j++) {
        if (Math.abs(corrMatrix[selIdx[i]][selIdx[j]]) > 0.5) redundancy += 0.01
      }
    }
    return Math.min(0.95, Math.max(0.5, base - redundancy))
  }

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const margin = 40

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const sel = selectedRef.current

      // Heatmap dimensions
      const cellSize = Math.min(38, (canvasH - margin * 2 - 30) / n)
      const hmX = margin + 60
      const hmY = margin + 20

      // Draw heatmap
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const val = corrMatrix[r][c]
          const cx = hmX + c * cellSize
          const cy = hmY + r * cellSize

          // Color: blue for negative, red for positive
          const intensity = Math.abs(val)
          if (val >= 0) {
            p.fill(52 + intensity * 180, 80 + intensity * 80, 100 + intensity * 50, 200)
          } else {
            p.fill(100 + intensity * 154, 63 + intensity * 10, 94, 200)
          }

          // Dim rows/cols that are deselected (except target row/col)
          if (r < n - 1 && !sel[r] && c < n - 1 && !sel[c]) {
            p.fill(30, 41, 59, 100)
          } else if ((r < n - 1 && !sel[r]) || (c < n - 1 && !sel[c])) {
            // Partially dim
            if (val >= 0) {
              p.fill(52 + intensity * 180, 80 + intensity * 80, 100 + intensity * 50, 80)
            } else {
              p.fill(100 + intensity * 154, 63 + intensity * 10, 94, 80)
            }
          }

          p.noStroke()
          p.rect(cx, cy, cellSize - 1, cellSize - 1, 2)

          // Value text
          if (cellSize > 28) {
            p.fill(255, 255, 255, intensity > 0.3 ? 220 : 100)
            p.textSize(9)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(val.toFixed(2), cx + cellSize / 2, cy + cellSize / 2)
          }
        }
      }

      // Row labels (left side)
      p.textSize(10)
      p.textAlign(p.RIGHT, p.CENTER)
      for (let r = 0; r < n; r++) {
        const isSelected = r === n - 1 || sel[r]
        p.fill(isSelected ? 226 : 100, isSelected ? 232 : 116, isSelected ? 240 : 139)
        p.text(featureNames[r], hmX - 4, hmY + r * cellSize + cellSize / 2)
      }

      // Column labels (top, rotated)
      for (let c = 0; c < n; c++) {
        const isSelected = c === n - 1 || sel[c]
        p.push()
        p.translate(hmX + c * cellSize + cellSize / 2, hmY - 4)
        p.rotate(-p.HALF_PI)
        p.fill(isSelected ? 226 : 100, isSelected ? 232 : 116, isSelected ? 240 : 139)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(featureNames[c], 0, 0)
        p.pop()
      }

      // Selection checkboxes
      const checkX = hmX + n * cellSize + 30
      const checkY = hmY
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Select Features:', checkX, checkY - 18)

      for (let i = 0; i < n - 1; i++) {
        const cy = checkY + i * 28
        // Checkbox
        p.stroke(100, 116, 139)
        p.strokeWeight(1)
        p.fill(sel[i] ? 99 : 30, sel[i] ? 102 : 41, sel[i] ? 241 : 59)
        p.rect(checkX, cy, 16, 16, 3)
        if (sel[i]) {
          p.stroke(255)
          p.strokeWeight(2)
          p.line(checkX + 3, cy + 8, checkX + 7, cy + 12)
          p.line(checkX + 7, cy + 12, checkX + 13, cy + 4)
        }
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(featureNames[i], checkX + 22, cy + 8)

        // Correlation with target
        const corr = corrMatrix[i][n - 1]
        p.fill(Math.abs(corr) > 0.2 ? 52 : 148, Math.abs(corr) > 0.2 ? 211 : 163, Math.abs(corr) > 0.2 ? 153 : 184)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`r=${corr.toFixed(2)}`, checkX + 90, cy + 8)
      }

      // Accuracy display
      const acc = computeAccuracy(sel)
      const accY = checkY + (n - 1) * 28 + 20
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Model Accuracy:', checkX, accY)

      // Accuracy bar
      const barW = 140
      p.fill(30, 41, 59)
      p.rect(checkX, accY + 22, barW, 18, 4)
      const accColor = acc > 0.8 ? [52, 211, 153] : acc > 0.65 ? [250, 204, 21] : [244, 63, 94]
      p.fill(accColor[0], accColor[1], accColor[2], 200)
      p.rect(checkX, accY + 22, barW * ((acc - 0.5) / 0.5), 18, 4)
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(`${(acc * 100).toFixed(1)}%`, checkX + barW / 2, accY + 31)

      // Color scale legend
      const legendY = canvasH - 30
      p.textSize(9)
      p.fill(148, 163, 184)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Correlation', hmX + n * cellSize / 2, legendY - 14)
      const legendW = n * cellSize
      for (let i = 0; i < 50; i++) {
        const t = i / 49 // 0 to 1
        const val = -1 + t * 2 // -1 to +1
        const intensity = Math.abs(val)
        if (val >= 0) {
          p.fill(52 + intensity * 180, 80 + intensity * 80, 100 + intensity * 50)
        } else {
          p.fill(100 + intensity * 154, 63 + intensity * 10, 94)
        }
        p.noStroke()
        p.rect(hmX + (i / 50) * legendW, legendY, legendW / 50 + 1, 10)
      }
      p.fill(148, 163, 184)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('-1', hmX, legendY + 12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('0', hmX + legendW / 2, legendY + 12)
      p.textAlign(p.RIGHT, p.TOP)
      p.text('+1', hmX + legendW, legendY + 12)
    }

    p.mousePressed = () => {
      const sel = [...selectedRef.current]
      const cellSize = Math.min(38, (canvasH - margin * 2 - 30) / n)
      const hmX2 = margin + 60
      const checkX = hmX2 + n * cellSize + 30
      const checkY = margin + 20

      for (let i = 0; i < n - 1; i++) {
        const cy = checkY + i * 28
        if (p.mouseX >= checkX && p.mouseX <= checkX + 16 && p.mouseY >= cy && p.mouseY <= cy + 16) {
          sel[i] = !sel[i]
          setSelected(sel)
          break
        }
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <span className="text-gray-400">Click checkboxes to select/deselect features and see accuracy change</span>
          <button
            onClick={() => setSelected([true, true, true, true, true, false, false, false])}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Select Best
          </button>
          <button
            onClick={() => setSelected([true, true, true, true, true, true, true, false])}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Select All
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Feature Importance Sketch                               */
/* ------------------------------------------------------------------ */

function FeatureImportanceSketch() {
  const [method, setMethod] = useState<'tree' | 'permutation'>('tree')
  const methodRef = useRef(method)
  methodRef.current = method

  const features = ['Income', 'Education', 'Score', 'Age', 'Hours', 'Noise2', 'Noise1']
  const treeImportance = [0.28, 0.22, 0.20, 0.15, 0.10, 0.03, 0.02]
  const permImportance = [0.32, 0.18, 0.25, 0.12, 0.08, 0.01, 0.04]

  const sketch = useCallback((p: p5) => {
    const canvasH = 350
    const margin = 50
    const barMarginLeft = 110

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const meth = methodRef.current
      const importances = meth === 'tree' ? treeImportance : permImportance
      const maxVal = Math.max(...importances)
      const barH = 28
      const gap = 8
      const startY = margin + 10
      const barMaxW = p.width - barMarginLeft - margin - 60

      // Title
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(
        meth === 'tree' ? 'Tree-Based Feature Importance (Gini)' : 'Permutation Feature Importance',
        p.width / 2,
        10,
      )

      // Bars
      for (let i = 0; i < features.length; i++) {
        const y = startY + i * (barH + gap)
        const val = importances[i]
        const w = (val / maxVal) * barMaxW

        // Label
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(features[i], barMarginLeft - 10, y + barH / 2)

        // Background bar
        p.fill(30, 41, 59)
        p.rect(barMarginLeft, y, barMaxW, barH, 4)

        // Value bar
        const isImportant = val > 0.1
        if (isImportant) {
          p.fill(99, 102, 241, 200)
        } else {
          p.fill(100, 116, 139, 150)
        }
        p.rect(barMarginLeft, y, w, barH, 4)

        // Value label
        p.fill(226, 232, 240)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(val.toFixed(3), barMarginLeft + w + 8, y + barH / 2)
      }

      // Explanation
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      if (meth === 'tree') {
        p.text(
          'Gini importance: how much each feature reduces impurity across all tree splits',
          barMarginLeft,
          canvasH - 10,
        )
      } else {
        p.text(
          'Permutation importance: accuracy drop when feature values are randomly shuffled',
          barMarginLeft,
          canvasH - 10,
        )
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={350}
      controls={
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-300">
          {(['tree', 'permutation'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1 rounded text-sm ${
                method === m ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {m === 'tree' ? 'Tree Importance (Gini)' : 'Permutation Importance'}
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Polynomial Features Sketch                              */
/* ------------------------------------------------------------------ */

function PolynomialFeaturesSketch() {
  const [degree, setDegree] = useState(1)
  const degreeRef = useRef(degree)
  degreeRef.current = degree

  const dataRef = useRef<{ x: number; y: number }[]>([])

  if (dataRef.current.length === 0) {
    const rng = makeRng(33)
    for (let i = 0; i < 40; i++) {
      const x = -3 + rng() * 6
      // True function: y = 0.5x^2 - 0.3x + 1 + noise
      const y = 0.5 * x * x - 0.3 * x + 1 + randn(rng) * 0.8
      dataRef.current.push({ x, y })
    }
  }

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const margin = 60

    // Fit polynomial of given degree using normal equations
    function fitPoly(data: { x: number; y: number }[], deg: number): number[] {
      const n = data.length
      // Build Vandermonde matrix
      const X: number[][] = []
      const Y: number[] = []
      for (const d of data) {
        const row: number[] = []
        for (let j = 0; j <= deg; j++) row.push(Math.pow(d.x, j))
        X.push(row)
        Y.push(d.y)
      }

      // X^T * X
      const m = deg + 1
      const XtX: number[][] = Array.from({ length: m }, () => Array(m).fill(0))
      const XtY: number[] = Array(m).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          for (let k = 0; k < m; k++) {
            XtX[j][k] += X[i][j] * X[i][k]
          }
          XtY[j] += X[i][j] * Y[i]
        }
      }

      // Solve using Gaussian elimination
      const aug: number[][] = XtX.map((row, i) => [...row, XtY[i]])
      for (let col = 0; col < m; col++) {
        let maxRow = col
        for (let row = col + 1; row < m; row++) {
          if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
        if (Math.abs(aug[col][col]) < 1e-10) continue
        for (let row = col + 1; row < m; row++) {
          const factor = aug[row][col] / aug[col][col]
          for (let j = col; j <= m; j++) aug[row][j] -= factor * aug[col][j]
        }
      }
      const coeffs = Array(m).fill(0)
      for (let i = m - 1; i >= 0; i--) {
        let sum = aug[i][m]
        for (let j = i + 1; j < m; j++) sum -= aug[i][j] * coeffs[j]
        coeffs[i] = Math.abs(aug[i][i]) > 1e-10 ? sum / aug[i][i] : 0
      }
      return coeffs
    }

    function evalPoly(coeffs: number[], x: number): number {
      let y = 0
      for (let i = 0; i < coeffs.length; i++) y += coeffs[i] * Math.pow(x, i)
      return y
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const data = dataRef.current
      const deg = degreeRef.current

      const xMin = -3.5
      const xMax = 3.5
      const yMin = -2
      const yMax = 8

      const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * (p.width - margin * 2)
      const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * (canvasH - margin * 2)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = -3; gx <= 3; gx++) p.line(mapX(gx), margin, mapX(gx), canvasH - margin)
      for (let gy = -1; gy <= 7; gy++) p.line(margin, mapY(gy), p.width - margin, mapY(gy))

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
      p.line(margin, margin, margin, canvasH - margin)

      // Fit and draw polynomial
      const coeffs = fitPoly(data, deg)
      p.stroke(236, 72, 153)
      p.strokeWeight(2.5)
      p.noFill()
      p.beginShape()
      for (let px = xMin; px <= xMax; px += 0.05) {
        const py = evalPoly(coeffs, px)
        const sx = mapX(px)
        const sy = mapY(py)
        if (sy > margin - 20 && sy < canvasH - margin + 20) {
          p.vertex(sx, sy)
        }
      }
      p.endShape()

      // True function (dashed)
      p.stroke(52, 211, 153, 100)
      p.strokeWeight(1.5)
      for (let px = xMin; px <= xMax; px += 0.1) {
        const y1 = 0.5 * px * px - 0.3 * px + 1
        const y2 = 0.5 * (px + 0.05) * (px + 0.05) - 0.3 * (px + 0.05) + 1
        const step = Math.floor((px - xMin) / 0.1)
        if (step % 2 === 0) {
          p.line(mapX(px), mapY(y1), mapX(px + 0.05), mapY(y2))
        }
      }

      // Data points
      p.noStroke()
      for (const d of data) {
        p.fill(99, 102, 241, 200)
        p.ellipse(mapX(d.x), mapY(d.y), 9, 9)
      }

      // Compute MSE
      let mse = 0
      for (const d of data) {
        const pred = evalPoly(coeffs, d.x)
        mse += (d.y - pred) ** 2
      }
      mse /= data.length

      // Info
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Degree: ${deg}  |  MSE: ${mse.toFixed(3)}  |  Parameters: ${deg + 1}`, margin, 10)

      // Legend
      p.stroke(236, 72, 153)
      p.strokeWeight(2.5)
      p.line(p.width - 200, 14, p.width - 175, 14)
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text(`Degree-${deg} fit`, p.width - 170, 14)

      p.stroke(52, 211, 153, 100)
      p.strokeWeight(1.5)
      p.line(p.width - 200, 30, p.width - 175, 30)
      p.noStroke()
      p.fill(148, 163, 184)
      p.text('True function', p.width - 170, 30)

      // Axis labels
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('x', (margin + p.width - margin) / 2, canvasH - margin + 8)
      p.push()
      p.translate(16, (margin + canvasH - margin) / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('y', 0, 0)
      p.pop()
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Polynomial Degree:
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={degree}
              onChange={e => setDegree(parseInt(e.target.value))}
              className="w-40 accent-pink-500"
            />
            <span className="w-8 font-mono">{degree}</span>
          </label>
          <span className="text-gray-500">
            {degree === 1
              ? '(linear — underfitting)'
              : degree === 2
                ? '(quadratic — good fit!)'
                : degree <= 4
                  ? '(still reasonable)'
                  : '(overfitting risk!)'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function FeatureEngineering() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: The Art of Feature Engineering ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Art of Feature Engineering</h2>

        <p className="mb-4">
          There is a saying among ML practitioners: &ldquo;Applied machine learning is basically
          feature engineering.&rdquo; While modern deep learning has automated some of this work,
          for the vast majority of ML problems — especially tabular data — the features you give
          a model matter more than the model itself.
        </p>

        <p className="mb-4">
          <strong className="text-white">Feature engineering</strong> is the process of using domain
          knowledge to create, select, and transform input variables that make machine learning
          algorithms work better. A skilled feature engineer can take a mediocre dataset and a
          simple model and outperform a complex model trained on raw data.
        </p>

        <p className="mb-4">
          Consider predicting house prices. The raw dataset might include square footage, number
          of bedrooms, and lot size. But an experienced real estate analyst knows that{' '}
          <em>price per square foot</em> varies by neighborhood, that{' '}
          <em>age of the house</em> matters more than the year it was built, and that the{' '}
          <em>ratio of bedrooms to bathrooms</em> signals a specific market segment. Each of these
          derived features encodes domain knowledge that the model would struggle to learn on its
          own.
        </p>

        <p className="mb-4">
          In this lesson, we explore the key strategies: selecting the most informative features,
          understanding feature importance, creating polynomial and interaction features, and
          knowing when to reduce dimensionality. Each technique is demonstrated with interactive
          visualizations that let you see the impact firsthand.
        </p>
      </section>

      {/* ========== Section 2: Feature Selection ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Feature Selection</h2>

        <p className="mb-4">
          Not all features are created equal. Some are strongly predictive, some are redundant
          (correlated with other features), and some are pure noise. Including irrelevant or noisy
          features hurts model performance through the{' '}
          <strong className="text-white">curse of dimensionality</strong> — as dimensions increase,
          data becomes sparse, distances become less meaningful, and models need exponentially more
          data to learn.
        </p>

        <p className="mb-4">
          There are three main approaches to feature selection:
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Filter Methods</h3>
        <p className="mb-4">
          Evaluate each feature independently using statistical measures like correlation with
          the target, mutual information, or chi-squared tests. Fast and model-agnostic, but
          they miss feature interactions — two features might be weak individually but powerful
          together.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Wrapper Methods</h3>
        <p className="mb-4">
          Treat feature selection as a search problem. Forward selection starts with no features
          and adds the best one at each step. Backward elimination starts with all features and
          removes the least useful. These find better subsets but are computationally expensive
          since they train a model for each candidate subset.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Embedded Methods</h3>
        <p className="mb-4">
          The model itself performs feature selection during training. L1 (Lasso) regularization
          drives unimportant feature weights to exactly zero. Tree-based models inherently rank
          features by how much they reduce impurity. These are efficient because selection happens
          as a byproduct of training.
        </p>

        <p className="mb-4">
          The correlation heatmap below shows relationships between features and the target
          variable. Click the checkboxes to select or deselect features. Notice how removing
          noise features (Noise1, Noise2 with near-zero target correlation) improves accuracy,
          and how keeping only the most correlated features produces the best results.
        </p>

        <CorrelationHeatmapSketch />

        <p className="mt-4">
          A key insight from the heatmap: Income and Score are both highly correlated with the
          Target (r=0.72 and r=0.68) but also correlated with each other (r=0.60). This
          multicollinearity means they carry overlapping information. Removing one might not hurt
          accuracy much while reducing model complexity.
        </p>
      </section>

      {/* ========== Section 3: Feature Importance ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Feature Importance</h2>

        <p className="mb-4">
          Once a model is trained, we often want to understand which features contributed most
          to its predictions. This is not just about curiosity — it helps validate that the model
          is learning sensible patterns, guides further feature engineering, and builds trust
          in the model&rsquo;s decisions.
        </p>

        <p className="mb-4">
          <strong className="text-white">Tree-based importance</strong> (also called Gini importance
          or mean decrease in impurity) measures how much each feature reduces the splitting
          criterion across all nodes in a tree ensemble. Features used in many splits near the
          root are considered most important.
        </p>

        <p className="mb-4">
          <strong className="text-white">Permutation importance</strong> takes a different approach:
          after training, randomly shuffle one feature&rsquo;s values and measure how much the
          model&rsquo;s performance degrades. If accuracy drops significantly, that feature is
          important. This method is model-agnostic and avoids biases that can affect tree-based
          importance (e.g., tree importance favoring high-cardinality features).
        </p>

        <p className="mb-4">
          Toggle between the two methods below. Notice that the rankings are similar but not
          identical — Income and Score swap positions. This is common and reflects the different
          definitions of &ldquo;importance.&rdquo;
        </p>

        <FeatureImportanceSketch />
      </section>

      {/* ========== Section 4: Polynomial Features ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Polynomial Features</h2>

        <p className="mb-4">
          Sometimes the relationship between features and the target is not linear. A straight
          line simply cannot capture a parabolic or more complex pattern. One powerful trick is
          to create <strong className="text-white">polynomial features</strong> — new columns
          that are powers and products of the original features.
        </p>

        <p className="mb-4">
          For a single feature <code className="text-pink-400">x</code>, adding{' '}
          <code className="text-pink-400">x^2</code> as a second feature lets a linear model fit
          a parabola: <code className="text-pink-400">y = w0 + w1*x + w2*x^2</code>. The model
          is still &ldquo;linear&rdquo; in its parameters (w0, w1, w2), but the decision boundary
          in the original feature space is curved. This is the key insight of{' '}
          <strong className="text-white">basis expansion</strong>.
        </p>

        <p className="mb-4">
          In the visualization below, the data follows a quadratic curve (dashed green). Drag the
          degree slider to see how polynomial features of different degrees affect the fit. Notice:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Degree 1</strong> (linear) — clear underfitting. A
            straight line cannot capture the curve.
          </li>
          <li>
            <strong className="text-white">Degree 2</strong> — excellent fit. Matches the true
            quadratic relationship.
          </li>
          <li>
            <strong className="text-white">Degree 5+</strong> — starts overfitting. The curve
            begins wiggling to fit noise in the training data.
          </li>
          <li>
            <strong className="text-white">Degree 9-10</strong> — extreme overfitting. Wild
            oscillations, terrible generalization.
          </li>
        </ul>

        <PolynomialFeaturesSketch />

        <p className="mt-4">
          With multiple features, polynomial expansion also creates{' '}
          <strong className="text-white">interaction terms</strong>. For features x1 and x2,
          degree-2 expansion adds: x1^2, x2^2, and x1*x2. The interaction term x1*x2 captures
          how the two features combine — for example, the effect of education on income might
          depend on years of experience.
        </p>
      </section>

      {/* ========== Section 5: Dimensionality Reduction ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Dimensionality Reduction as Feature Engineering</h2>

        <p className="mb-4">
          Sometimes the opposite of feature creation is needed: reducing the number of features.
          High-dimensional data suffers from the curse of dimensionality, increased computational
          cost, and noise from irrelevant features. Dimensionality reduction transforms many
          features into fewer, more informative ones.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">PCA (Principal Component Analysis)</h3>
        <p className="mb-4">
          PCA finds the directions of maximum variance in the data and projects onto them. The
          first principal component captures the most variance, the second captures the most
          remaining variance orthogonal to the first, and so on. If the first few components
          capture 95% of variance, you can safely discard the rest. PCA is unsupervised — it
          does not use labels, so it might not preserve the most discriminative information.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Feature Hashing</h3>
        <p className="mb-4">
          For very high-dimensional sparse data (e.g., text with millions of unique words), feature
          hashing maps features to a fixed-size vector using a hash function. It is memory-efficient
          and needs no vocabulary, but collisions can lose information. The &ldquo;hashing trick&rdquo;
          is widely used in production NLP systems.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">When to Reduce</h3>
        <p className="mb-4">
          Use dimensionality reduction when you have many correlated features (PCA consolidates
          them), when you need to visualize high-dimensional data (reduce to 2-3D), when training
          is too slow, or when you suspect overfitting from too many features. Avoid it when
          feature interpretability is critical — principal components are linear combinations
          that lack clear real-world meaning.
        </p>
      </section>

      {/* ========== Section 6: Feature Engineering for Different Data Types ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Feature Engineering for Different Data Types</h2>

        <h3 className="mb-3 text-xl font-semibold text-white">Text Data</h3>
        <p className="mb-4">
          Raw text must be converted to numerical vectors.{' '}
          <strong className="text-white">TF-IDF</strong> (Term Frequency-Inverse Document Frequency)
          weighs words by how often they appear in a document relative to the corpus — rare but
          present words get high scores. <strong className="text-white">N-grams</strong> capture
          word sequences: bigrams like &ldquo;not good&rdquo; convey different meaning than the
          individual words. For deep learning, word embeddings (Word2Vec, GloVe) encode semantic
          meaning in dense vectors.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Time Series Data</h3>
        <p className="mb-4">
          Temporal data benefits from engineered features that capture trends and patterns.{' '}
          <strong className="text-white">Lag features</strong> (value at t-1, t-2, ...) let the
          model use past values. <strong className="text-white">Rolling statistics</strong>{' '}
          (7-day moving average, 30-day rolling standard deviation) capture trends and volatility.
          Calendar features (day of week, month, is_holiday) encode cyclical patterns. Difference
          features (change from yesterday) capture momentum.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Image Data</h3>
        <p className="mb-4">
          For classical ML on images, hand-crafted features include{' '}
          <strong className="text-white">HOG</strong> (Histogram of Oriented Gradients) for shape
          detection, <strong className="text-white">edge detectors</strong> (Sobel, Canny) for
          boundaries, color histograms for appearance, and texture features (LBP, Gabor filters).
          Deep learning has largely replaced hand-crafted image features with learned
          representations from convolutional networks — but understanding traditional features
          helps you appreciate what CNNs learn automatically.
        </p>
      </section>

      {/* ========== Section 7: Python — Feature Selection Comparison ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Feature Selection Comparison</h2>

        <p className="mb-4">
          Let us compare feature selection methods in practice. We will generate a dataset with
          informative and noisy features, then see how different selection strategies affect
          model accuracy.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

np.random.seed(42)
n = 300

# Create features: 5 informative, 5 noisy
x1 = np.random.normal(0, 1, n)  # informative
x2 = np.random.normal(0, 1, n)  # informative
x3 = 0.7 * x1 + 0.3 * np.random.normal(0, 1, n)  # correlated with x1
x4 = np.random.normal(0, 1, n)  # informative
x5 = 0.5 * x2 + 0.5 * x4 + np.random.normal(0, 0.3, n)  # interaction
noise1 = np.random.normal(0, 1, n)  # pure noise
noise2 = np.random.normal(0, 1, n)  # pure noise
noise3 = np.random.normal(0, 1, n)  # pure noise
noise4 = np.random.normal(0, 1, n)  # pure noise
noise5 = np.random.normal(0, 1, n)  # pure noise

# Target: depends on x1, x2, x4
y = (1.5 * x1 - 0.8 * x2 + 1.2 * x4 + np.random.normal(0, 0.5, n) > 0).astype(int)

X = np.column_stack([x1, x2, x3, x4, x5, noise1, noise2, noise3, noise4, noise5])
names = ['x1', 'x2', 'x3(corr)', 'x4', 'x5(inter)', 'noise1', 'noise2', 'noise3', 'noise4', 'noise5']

# Split
split = 200
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

# Simple logistic regression
def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def train_and_eval(Xtr, ytr, Xte, yte, lr=0.1, epochs=300):
    w = np.zeros(Xtr.shape[1])
    b = 0.0
    for _ in range(epochs):
        pred = sigmoid(Xtr @ w + b)
        err = pred - ytr
        w -= lr * (Xtr.T @ err) / len(ytr)
        b -= lr * err.mean()
    pred_test = (sigmoid(Xte @ w + b) >= 0.5).astype(int)
    return (pred_test == yte).mean()

# 1. All features
acc_all = train_and_eval(X_train, y_train, X_test, y_test)
print(f"All 10 features:     accuracy = {acc_all:.1%}")

# 2. Correlation-based filter: select features with |corr| > 0.15
correlations = []
for i in range(X_train.shape[1]):
    corr = np.abs(np.corrcoef(X_train[:, i], y_train)[0, 1])
    correlations.append(corr)

print(f"\\nCorrelation with target:")
for i, (name, corr) in enumerate(zip(names, correlations)):
    marker = " <-- selected" if corr > 0.15 else ""
    print(f"  {name:>12}: {corr:.3f}{marker}")

selected = [i for i, c in enumerate(correlations) if c > 0.15]
acc_filter = train_and_eval(X_train[:, selected], y_train, X_test[:, selected], y_test)
print(f"\\nFilter method ({len(selected)} features): accuracy = {acc_filter:.1%}")

# 3. Only the true informative features
true_features = [0, 1, 3]  # x1, x2, x4
acc_true = train_and_eval(X_train[:, true_features], y_train, X_test[:, true_features], y_test)
print(f"True features only (3):  accuracy = {acc_true:.1%}")

# 4. Only noise features
noise_features = [5, 6, 7, 8, 9]
acc_noise = train_and_eval(X_train[:, noise_features], y_train, X_test[:, noise_features], y_test)
print(f"Noise features only (5): accuracy = {acc_noise:.1%}")

print(f"\\nConclusion: Removing noise features improved accuracy by {(acc_filter - acc_all)*100:+.1f}pp")`}
        />
      </section>

      {/* ========== Section 8: Python — Polynomial Features ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Polynomial Features in Practice</h2>

        <p className="mb-4">
          Let us see how adding polynomial features can transform a model&rsquo;s ability to fit
          nonlinear patterns. We will create data with a quadratic relationship and compare
          linear versus polynomial regression.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

np.random.seed(42)
n = 100

# Generate nonlinear data: y = 0.5*x^2 - 2*x + 3 + noise
x = np.random.uniform(-3, 3, n)
y = 0.5 * x**2 - 2 * x + 3 + np.random.normal(0, 0.8, n)

# Split
split = 70
x_train, x_test = x[:split], x[split:]
y_train, y_test = y[:split], y[split:]

# Helper: fit linear regression with normal equations
def fit_predict(X_train, y_train, X_test):
    # Add bias column
    ones_tr = np.column_stack([np.ones(len(X_train)), X_train])
    ones_te = np.column_stack([np.ones(len(X_test)), X_test])
    # Normal equation: w = (X^T X)^-1 X^T y
    w = np.linalg.lstsq(ones_tr, y_train, rcond=None)[0]
    pred_train = ones_tr @ w
    pred_test = ones_te @ w
    return pred_train, pred_test, w

def mse(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)

print("=== Polynomial Feature Comparison ===\\n")

for degree in [1, 2, 3, 5, 9]:
    # Create polynomial features
    X_tr = np.column_stack([x_train**d for d in range(1, degree + 1)])
    X_te = np.column_stack([x_test**d for d in range(1, degree + 1)])

    pred_tr, pred_te, w = fit_predict(X_tr, y_train, X_te)

    train_mse = mse(y_train, pred_tr)
    test_mse = mse(y_test, pred_te)

    status = ""
    if degree == 1:
        status = " (underfitting)"
    elif degree == 2:
        status = " (best fit!)"
    elif degree >= 5:
        status = " (overfitting risk)"

    print(f"Degree {degree:2d}: train_MSE={train_mse:.3f}, test_MSE={test_mse:.3f}, params={degree+1}{status}")

print("\\n=== Interaction Features Example ===")
print("\\nWith 2 features (x1, x2), degree-2 expansion gives:")
print("  Original:    [x1, x2]")
print("  Degree 2:    [x1, x2, x1^2, x1*x2, x2^2]")
print("  That's 5 features from 2 — grows as C(n+d, d)")
print()

# Demonstrate interaction features
x1 = np.random.normal(0, 1, n)
x2 = np.random.normal(0, 1, n)
# Target depends on interaction
y_inter = 2 * x1 * x2 + np.random.normal(0, 0.5, n)
y_inter_binary = (y_inter > 0).astype(int)

# Without interaction
X_no_inter = np.column_stack([x1, x2])[:split]
X_no_inter_test = np.column_stack([x1, x2])[split:]

# With interaction
X_with_inter = np.column_stack([x1, x2, x1*x2])[:split]
X_with_inter_test = np.column_stack([x1, x2, x1*x2])[split:]

pred_no, _, _ = fit_predict(X_no_inter, y_inter[:split], X_no_inter_test)
pred_with, _, _ = fit_predict(X_with_inter, y_inter[:split], X_with_inter_test)

print(f"Predicting y = 2*x1*x2 + noise:")
print(f"  Without interaction term: test_MSE = {mse(y_inter[split:], pred_no):.3f}")
print(f"  With interaction term:    test_MSE = {mse(y_inter[split:], pred_with):.3f}")
print(f"\\nThe interaction term captures the relationship that neither x1 nor x2 alone can!")`}
        />
      </section>

      {/* ========== Closing ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            Feature engineering is often the highest-leverage activity in an ML project. Good
            features with a simple model beat bad features with a complex model.
          </li>
          <li>
            Use correlation analysis and feature importance to identify which features actually
            contribute to predictions. Remove noise features to reduce overfitting.
          </li>
          <li>
            Polynomial features allow linear models to capture nonlinear relationships, but
            higher degrees risk overfitting. Always validate on held-out data.
          </li>
          <li>
            Different data types require different feature engineering strategies: TF-IDF for
            text, lag features for time series, edge detectors for images.
          </li>
          <li>
            Dimensionality reduction (PCA) can help when you have many correlated features,
            but it sacrifices interpretability.
          </li>
          <li>
            Feature selection and feature creation are iterative processes. Experiment, measure,
            and iterate based on validation performance.
          </li>
        </ul>
      </section>
    </article>
  )
}
