import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/regularization',
  title: 'Regularization',
  description: 'Controlling overfitting with L2 (Ridge), L1 (Lasso), Elastic Net, and choosing the right lambda',
  track: 'classical',
  order: 4,
  tags: ['regularization', 'ridge', 'lasso', 'l1', 'l2', 'elastic-net', 'overfitting'],
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
/* Section 1 — Ridge (L2) Coefficient Bar Chart                        */
/* ------------------------------------------------------------------ */

function RidgeSketch() {
  const [lambda, setLambda] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 400

      // Simulated unregularized coefficients for a degree-8 polynomial
      // These represent the kind of wild coefficients you get from overfitting
      const baseCoeffs = [0.3, 1.8, -2.5, 4.2, -3.1, 5.7, -2.8, 1.4, -6.3]
      const featureNames = ['bias', 'x', 'x^2', 'x^3', 'x^4', 'x^5', 'x^6', 'x^7', 'x^8']

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
        const n = baseCoeffs.length

        // Apply L2 shrinkage: Ridge shrinks proportionally
        // Simplified model: w_ridge = w_ols / (1 + lambda)
        const shrinkFactor = 1 / (1 + lambda)
        const coeffs = baseCoeffs.map((c, i) => i === 0 ? c : c * shrinkFactor)

        const maxAbs = Math.max(...baseCoeffs.map(Math.abs)) * 1.1
        const barW = (plotW / n) * 0.7
        const gap = (plotW / n) * 0.3

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Ridge (L2) Regularization — Coefficient Magnitudes', p.width / 2, 8)

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        const zeroY = margin + plotH / 2
        p.line(margin, zeroY, p.width - margin, zeroY)
        p.line(margin, margin, margin, canvasH - margin)

        // Y-axis labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let v = -6; v <= 6; v += 2) {
          const y = zeroY - (v / maxAbs) * (plotH / 2)
          p.text(v.toString(), margin - 5, y)
          p.stroke(30, 41, 59)
          p.strokeWeight(1)
          p.line(margin, y, p.width - margin, y)
          p.noStroke()
        }

        // Bars
        for (let i = 0; i < n; i++) {
          const x = margin + i * (barW + gap) + gap / 2
          const barH = (coeffs[i] / maxAbs) * (plotH / 2)

          // Ghost bar (unregularized)
          const ghostH = (baseCoeffs[i] / maxAbs) * (plotH / 2)
          p.noStroke()
          p.fill(99, 102, 241, 30)
          if (ghostH >= 0) {
            p.rect(x, zeroY - ghostH, barW, ghostH)
          } else {
            p.rect(x, zeroY, barW, -ghostH)
          }

          // Current bar
          const positive = coeffs[i] >= 0
          if (positive) {
            p.fill(52, 211, 153)
            p.rect(x, zeroY - barH, barW, barH)
          } else {
            p.fill(244, 63, 94)
            p.rect(x, zeroY, barW, -barH)
          }

          // Feature label
          p.noStroke()
          p.fill(148, 163, 184)
          p.textSize(9)
          p.textAlign(p.CENTER, p.TOP)
          p.text(featureNames[i], x + barW / 2, canvasH - margin + 5)

          // Value label
          p.fill(226, 232, 240)
          p.textSize(9)
          p.textAlign(p.CENTER, positive ? p.BOTTOM : p.TOP)
          const labelY = positive ? zeroY - barH - 3 : zeroY - barH + 3
          p.text(coeffs[i].toFixed(2), x + barW / 2, labelY)
        }

        // L2 norm
        const l2 = Math.sqrt(coeffs.reduce((s, c) => s + c * c, 0))
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`lambda = ${lambda.toFixed(2)}`, margin + 5, margin + 5)
        p.text(`L2 norm = ${l2.toFixed(3)}`, margin + 5, margin + 20)

        // Legend
        p.fill(99, 102, 241, 60)
        p.rect(p.width - 200, margin + 5, 12, 12)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Unregularized', p.width - 183, margin + 11)

        p.fill(52, 211, 153)
        p.rect(p.width - 200, margin + 22, 12, 12)
        p.fill(148, 163, 184)
        p.text('Regularized', p.width - 183, margin + 28)
      }
    },
    [lambda],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Lambda (penalty strength):
            <input
              type="range" min={0} max={20} step={0.1} value={lambda}
              onChange={(e) => setLambda(parseFloat(e.target.value))}
              className="w-48 accent-emerald-500"
            />
            <span className="w-14 font-mono">{lambda.toFixed(1)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Lasso (L1) Coefficient Bar Chart                        */
/* ------------------------------------------------------------------ */

function LassoSketch() {
  const [lambda, setLambda] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 400

      const baseCoeffs = [0.3, 1.8, -2.5, 4.2, -3.1, 5.7, -2.8, 1.4, -6.3]
      const featureNames = ['bias', 'x', 'x^2', 'x^3', 'x^4', 'x^5', 'x^6', 'x^7', 'x^8']

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
        const n = baseCoeffs.length

        // Apply L1 shrinkage: soft-thresholding
        // w_lasso = sign(w) * max(0, |w| - lambda)
        const coeffs = baseCoeffs.map((c, i) => {
          if (i === 0) return c // Don't regularize bias
          const sign = c >= 0 ? 1 : -1
          return sign * Math.max(0, Math.abs(c) - lambda)
        })

        const maxAbs = Math.max(...baseCoeffs.map(Math.abs)) * 1.1
        const barW = (plotW / n) * 0.7
        const gap = (plotW / n) * 0.3

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Lasso (L1) Regularization — Coefficients Go to Exactly Zero', p.width / 2, 8)

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        const zeroY = margin + plotH / 2
        p.line(margin, zeroY, p.width - margin, zeroY)
        p.line(margin, margin, margin, canvasH - margin)

        // Y-axis labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let v = -6; v <= 6; v += 2) {
          const y = zeroY - (v / maxAbs) * (plotH / 2)
          p.text(v.toString(), margin - 5, y)
          p.stroke(30, 41, 59)
          p.strokeWeight(1)
          p.line(margin, y, p.width - margin, y)
          p.noStroke()
        }

        // Count zeros
        let numZero = 0
        for (let i = 1; i < n; i++) {
          if (Math.abs(coeffs[i]) < 0.001) numZero++
        }

        // Bars
        for (let i = 0; i < n; i++) {
          const x = margin + i * (barW + gap) + gap / 2
          const barH = (coeffs[i] / maxAbs) * (plotH / 2)

          // Ghost bar
          const ghostH = (baseCoeffs[i] / maxAbs) * (plotH / 2)
          p.noStroke()
          p.fill(99, 102, 241, 30)
          if (ghostH >= 0) {
            p.rect(x, zeroY - ghostH, barW, ghostH)
          } else {
            p.rect(x, zeroY, barW, -ghostH)
          }

          // Current bar
          const isZero = Math.abs(coeffs[i]) < 0.001 && i > 0
          if (isZero) {
            // Show "eliminated" indicator
            p.fill(250, 204, 21)
            p.textSize(14)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('0', x + barW / 2, zeroY)
          } else {
            const positive = coeffs[i] >= 0
            if (positive) {
              p.fill(52, 211, 153)
              p.rect(x, zeroY - barH, barW, Math.max(barH, 1))
            } else {
              p.fill(244, 63, 94)
              p.rect(x, zeroY, barW, Math.max(-barH, 1))
            }

            // Value label
            p.fill(226, 232, 240)
            p.textSize(9)
            p.textAlign(p.CENTER, positive ? p.BOTTOM : p.TOP)
            const labelY = positive ? zeroY - barH - 3 : zeroY - barH + 3
            p.text(coeffs[i].toFixed(2), x + barW / 2, labelY)
          }

          // Feature label
          p.noStroke()
          p.fill(isZero ? 250 : 148, isZero ? 204 : 163, isZero ? 21 : 184)
          p.textSize(9)
          p.textAlign(p.CENTER, p.TOP)
          p.text(featureNames[i], x + barW / 2, canvasH - margin + 5)
        }

        // Stats
        const l1 = coeffs.reduce((s, c) => s + Math.abs(c), 0)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`lambda = ${lambda.toFixed(2)}`, margin + 5, margin + 5)
        p.text(`L1 norm = ${l1.toFixed(3)}`, margin + 5, margin + 20)
        p.fill(250, 204, 21)
        p.text(`Zeroed features: ${numZero} / ${n - 1}`, margin + 5, margin + 35)
      }
    },
    [lambda],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Lambda (penalty strength):
            <input
              type="range" min={0} max={7} step={0.1} value={lambda}
              onChange={(e) => setLambda(parseFloat(e.target.value))}
              className="w-48 accent-yellow-500"
            />
            <span className="w-14 font-mono">{lambda.toFixed(1)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — L1 vs L2 Geometry (Diamond vs Circle)                   */
/* ------------------------------------------------------------------ */

function GeometrySketch() {
  const [lambda, setLambda] = useState(2.0)
  const [showL1, setShowL1] = useState(true)
  const [showL2, setShowL2] = useState(true)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 420

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const cx = p.width / 2
        const cy = canvasH / 2
        const scale = 50 // pixels per unit

        // Grid
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        for (let gx = -6; gx <= 6; gx++) {
          p.line(cx + gx * scale, 0, cx + gx * scale, canvasH)
        }
        for (let gy = -4; gy <= 4; gy++) {
          p.line(0, cy + gy * scale, p.width, cy + gy * scale)
        }

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1.5)
        p.line(0, cy, p.width, cy)
        p.line(cx, 0, cx, canvasH)

        // Axis labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('w1', p.width - 20, cy + 5)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('w2', cx + 5, 15)

        // OLS solution (the center of the loss contours)
        const olsW1 = 3
        const olsW2 = 2

        // Draw loss contours (ellipses centered at OLS solution)
        p.noFill()
        for (let r = 1; r <= 8; r++) {
          p.stroke(99, 102, 241, 30 + r * 5)
          p.strokeWeight(1)
          p.ellipse(cx + olsW1 * scale, cy - olsW2 * scale, r * scale * 0.8, r * scale * 1.0)
        }

        // OLS point
        p.noStroke()
        p.fill(99, 102, 241)
        p.ellipse(cx + olsW1 * scale, cy - olsW2 * scale, 10, 10)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`OLS (${olsW1}, ${olsW2})`, cx + olsW1 * scale + 8, cy - olsW2 * scale)

        const constraintR = lambda * scale

        // L1 constraint: diamond |w1| + |w2| <= lambda
        if (showL1) {
          p.stroke(250, 204, 21)
          p.strokeWeight(2)
          p.fill(250, 204, 21, 20)
          p.beginShape()
          p.vertex(cx + constraintR, cy)
          p.vertex(cx, cy - constraintR)
          p.vertex(cx - constraintR, cy)
          p.vertex(cx, cy + constraintR)
          p.endShape(p.CLOSE)

          // L1 solution tends to hit a vertex (sparse)
          // Find where the smallest loss contour touches the diamond
          // For our setup, it tends to hit the w2 axis or a vertex
          // Better approximation: project OLS onto L1 ball
          const olsL1 = Math.abs(olsW1) + Math.abs(olsW2)
          let l1x: number, l1y: number
          if (olsL1 <= lambda) {
            l1x = olsW1; l1y = olsW2
          } else {
            // The L1 solution tends to put weight on the axis of the larger coefficient
            // Soft-threshold approximation
            const ratio = lambda / olsL1
            l1x = olsW1 * ratio
            l1y = olsW2 * ratio
            // Push toward sparsity for smaller lambda
            if (lambda < 2) {
              l1x = Math.max(0, olsW1 - (olsL1 - lambda) * 0.6)
              l1y = Math.max(0, lambda - l1x)
            }
          }

          p.noStroke()
          p.fill(250, 204, 21)
          p.ellipse(cx + l1x * scale, cy - l1y * scale, 10, 10)
          p.fill(250, 204, 21, 200)
          p.textSize(10)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`L1 (${l1x.toFixed(1)}, ${l1y.toFixed(1)})`, cx + l1x * scale - 8, cy - l1y * scale)
        }

        // L2 constraint: circle w1^2 + w2^2 <= lambda^2
        if (showL2) {
          p.stroke(52, 211, 153)
          p.strokeWeight(2)
          p.fill(52, 211, 153, 20)
          p.ellipse(cx, cy, constraintR * 2, constraintR * 2)

          // L2 solution: project OLS onto L2 ball
          const olsNorm = Math.sqrt(olsW1 * olsW1 + olsW2 * olsW2)
          let l2x: number, l2y: number
          if (olsNorm <= lambda) {
            l2x = olsW1; l2y = olsW2
          } else {
            l2x = olsW1 * (lambda / olsNorm)
            l2y = olsW2 * (lambda / olsNorm)
          }

          p.noStroke()
          p.fill(52, 211, 153)
          p.ellipse(cx + l2x * scale, cy - l2y * scale, 10, 10)
          p.fill(52, 211, 153, 200)
          p.textSize(10)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`L2 (${l2x.toFixed(1)}, ${l2y.toFixed(1)})`, cx + l2x * scale + 8, cy - l2y * scale)
        }

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('L1 vs L2 Constraint Geometry', p.width / 2, 8)

        // Legend
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        if (showL1) {
          p.fill(250, 204, 21)
          p.text('L1 (Diamond) — solutions hit corners (sparse)', 10, canvasH - 40)
        }
        if (showL2) {
          p.fill(52, 211, 153)
          p.text('L2 (Circle) — solutions hit smoothly (small but nonzero)', 10, canvasH - 22)
        }
      }
    },
    [lambda, showL1, showL2],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2 flex-wrap">
          <label className="flex items-center gap-2">
            Constraint size:
            <input
              type="range" min={0.5} max={5} step={0.1} value={lambda}
              onChange={(e) => setLambda(parseFloat(e.target.value))}
              className="w-36 accent-indigo-500"
            />
            <span className="w-10 font-mono">{lambda.toFixed(1)}</span>
          </label>
          <button
            onClick={() => setShowL1(!showL1)}
            className={`px-3 py-1 rounded text-sm ${showL1 ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            L1 Diamond
          </button>
          <button
            onClick={() => setShowL2(!showL2)}
            className={`px-3 py-1 rounded text-sm ${showL2 ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            L2 Circle
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Validation Curve                                        */
/* ------------------------------------------------------------------ */

function ValidationCurveSketch() {
  const [highlighted, setHighlighted] = useState(5)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 380
      const rng = makeRng(55)

      // Simulate train/validation error vs lambda for a high-degree polynomial
      // As lambda increases: train error goes up (model is more constrained),
      // but validation error goes down then up (U-shape)
      const lambdas = [0, 0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 50, 100]
      const trainErrors: number[] = []
      const valErrors: number[] = []

      for (let i = 0; i < lambdas.length; i++) {
        const lam = lambdas[i]
        // Simulated curves
        const trainE = 0.02 + 0.15 * (1 - Math.exp(-lam * 0.5)) + randn(rng) * 0.005
        const valE = 0.8 * Math.exp(-lam * 5) + 0.05 + 0.2 * (1 - Math.exp(-lam * 0.1)) + randn(rng) * 0.01
        trainErrors.push(Math.max(0.01, trainE))
        valErrors.push(Math.max(0.02, valE))
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

        const n = lambdas.length
        const maxErr = Math.max(...valErrors, ...trainErrors) * 1.2

        const mapX = (i: number) => margin + (i / (n - 1)) * plotW
        const mapY = (v: number) => canvasH - margin - (v / maxErr) * plotH

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Validation Curve — Choosing Lambda', p.width / 2, 8)

        // Axis labels
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Lambda (log scale)', p.width / 2, canvasH - 22)
        p.push()
        p.translate(18, canvasH / 2)
        p.rotate(-p.HALF_PI)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Error', 0, 0)
        p.pop()

        // X-axis labels
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        for (let i = 0; i < n; i++) {
          p.text(lambdas[i].toString(), mapX(i), canvasH - margin + 4)
        }

        // Highlighted column
        if (highlighted >= 0 && highlighted < n) {
          p.noStroke()
          p.fill(99, 102, 241, 25)
          const colW = plotW / n
          p.rect(mapX(highlighted) - colW / 2, margin, colW, plotH)
        }

        // Train error line
        p.stroke(52, 211, 153)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < n; i++) {
          p.vertex(mapX(i), mapY(trainErrors[i]))
        }
        p.endShape()

        // Validation error line
        p.stroke(244, 63, 94)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < n; i++) {
          p.vertex(mapX(i), mapY(valErrors[i]))
        }
        p.endShape()

        // Points
        for (let i = 0; i < n; i++) {
          p.noStroke()
          p.fill(52, 211, 153)
          p.ellipse(mapX(i), mapY(trainErrors[i]), 7, 7)
          p.fill(244, 63, 94)
          p.ellipse(mapX(i), mapY(valErrors[i]), 7, 7)
        }

        // Best lambda marker
        let bestIdx = 0
        let bestVal = Infinity
        for (let i = 0; i < n; i++) {
          if (valErrors[i] < bestVal) {
            bestVal = valErrors[i]
            bestIdx = i
          }
        }
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.noFill()
        p.ellipse(mapX(bestIdx), mapY(valErrors[bestIdx]), 16, 16)
        p.noStroke()
        p.fill(250, 204, 21)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`Best: lambda=${lambdas[bestIdx]}`, mapX(bestIdx), mapY(valErrors[bestIdx]) - 10)

        // Legend
        p.noStroke()
        p.fill(52, 211, 153)
        p.rect(p.width - 170, margin + 5, 12, 3)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Train Error', p.width - 153, margin + 7)

        p.fill(244, 63, 94)
        p.rect(p.width - 170, margin + 22, 12, 3)
        p.fill(148, 163, 184)
        p.text('Validation Error', p.width - 153, margin + 24)

        // Info for highlighted
        if (highlighted >= 0 && highlighted < n) {
          p.fill(226, 232, 240)
          p.textSize(10)
          p.textAlign(p.LEFT, p.BOTTOM)
          p.text(
            `lambda=${lambdas[highlighted]}: Train=${trainErrors[highlighted].toFixed(4)}, Val=${valErrors[highlighted].toFixed(4)}`,
            margin + 5,
            canvasH - margin - 5,
          )
        }

        // Zone labels
        p.fill(244, 63, 94, 80)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text('OVERFITTING', mapX(1), margin + 5)
        p.text('(too little reg.)', mapX(1), margin + 17)

        p.text('UNDERFITTING', mapX(n - 2), margin + 5)
        p.text('(too much reg.)', mapX(n - 2), margin + 17)
      }
    },
    [highlighted],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Highlight index:
            <input
              type="range" min={0} max={11} step={1} value={highlighted}
              onChange={(e) => setHighlighted(parseInt(e.target.value))}
              className="w-40 accent-indigo-500"
            />
            <span className="w-14 font-mono">idx {highlighted}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cell                                                         */
/* ------------------------------------------------------------------ */

const ridgeLassoCode = `import numpy as np
from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.preprocessing import PolynomialFeatures
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

# Generate curved data
np.random.seed(42)
n = 60
X = np.sort(np.random.uniform(-2, 2, n)).reshape(-1, 1)
y_true = np.sin(X.ravel() * 1.5)
y = y_true + np.random.normal(0, 0.3, n)

# Create polynomial features (degree 10 — deliberately high)
poly = PolynomialFeatures(degree=10, include_bias=False)
X_poly = poly.fit_transform(X)

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X_poly, y, test_size=0.3, random_state=42
)

print("=" * 60)
print("Comparing Ridge vs Lasso vs Elastic Net (Degree-10 Polynomial)")
print("=" * 60)
print()

# No regularization (plain OLS)
from sklearn.linear_model import LinearRegression
ols = LinearRegression().fit(X_train, y_train)
print(f"{'Model':<20} | {'Train MSE':>10} | {'Test MSE':>10} | {'Nonzero':>7}")
print("-" * 58)
ols_train = mean_squared_error(y_train, ols.predict(X_train))
ols_test = mean_squared_error(y_test, ols.predict(X_test))
print(f"{'OLS (no reg.)':<20} | {ols_train:10.4f} | {ols_test:10.4f} | {np.sum(np.abs(ols.coef_) > 0.001):>7}")

# Ridge with different alphas
for alpha in [0.01, 0.1, 1.0, 10.0]:
    model = Ridge(alpha=alpha).fit(X_train, y_train)
    tr = mean_squared_error(y_train, model.predict(X_train))
    te = mean_squared_error(y_test, model.predict(X_test))
    nz = np.sum(np.abs(model.coef_) > 0.001)
    print(f"{'Ridge a=' + str(alpha):<20} | {tr:10.4f} | {te:10.4f} | {nz:>7}")

print()

# Lasso with different alphas
for alpha in [0.01, 0.1, 1.0, 10.0]:
    model = Lasso(alpha=alpha, max_iter=10000).fit(X_train, y_train)
    tr = mean_squared_error(y_train, model.predict(X_train))
    te = mean_squared_error(y_test, model.predict(X_test))
    nz = np.sum(np.abs(model.coef_) > 0.001)
    print(f"{'Lasso a=' + str(alpha):<20} | {tr:10.4f} | {te:10.4f} | {nz:>7}")

print()

# Elastic Net
for alpha in [0.01, 0.1, 1.0]:
    model = ElasticNet(alpha=alpha, l1_ratio=0.5, max_iter=10000).fit(X_train, y_train)
    tr = mean_squared_error(y_train, model.predict(X_train))
    te = mean_squared_error(y_test, model.predict(X_test))
    nz = np.sum(np.abs(model.coef_) > 0.001)
    print(f"{'ElasticNet a=' + str(alpha):<20} | {tr:10.4f} | {te:10.4f} | {nz:>7}")

print()
print("KEY OBSERVATIONS:")
print("- OLS overfits badly (low train, high test)")
print("- Ridge shrinks all coefficients but keeps all nonzero")
print("- Lasso drives many coefficients to exactly zero (feature selection!)")
print("- Elastic Net combines both: some sparsity + smooth shrinkage")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function Regularization() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: The Overfitting Problem ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Overfitting Problem</h2>

        <p className="mb-4">
          In the previous lesson on polynomial regression, we saw how a high-degree polynomial can memorize
          training data perfectly — achieving near-zero training error — while performing terribly on new
          data. The coefficients become enormous, creating wild oscillations between data points.
        </p>

        <p className="mb-4">
          But here is the dilemma: we often <em>need</em> complex models. Real data can have many features,
          nonlinear relationships, and subtle patterns. We cannot just use a simple model and hope for the
          best. We need a way to use complex models while preventing them from overfitting.
        </p>

        <p className="mb-4">
          <strong className="text-white">Regularization</strong> is the solution. The idea is elegant: add
          a penalty term to the loss function that discourages large coefficient values. The model must now
          balance two objectives — fitting the data well <em>and</em> keeping the coefficients small:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            Total Loss = Data Loss + lambda * Complexity Penalty
          </code>
        </div>

        <p className="mb-4">
          The hyperparameter <strong className="text-white">lambda</strong> controls the tradeoff. When
          lambda is zero, we get the original unregularized model. As lambda increases, the model is
          forced to find simpler solutions with smaller coefficients. The key question is: how exactly
          should we measure &ldquo;complexity&rdquo;? The two most common answers give us Ridge and Lasso
          regression.
        </p>
      </section>

      {/* ========== Section 2: Ridge (L2) Regularization ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Ridge Regression (L2 Penalty)</h2>

        <p className="mb-4">
          <strong className="text-white">Ridge regression</strong> adds the sum of squared coefficients to
          the loss:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-emerald-400">
            L_ridge = MSE + lambda * sum(w_i^2)
          </code>
        </div>

        <p className="mb-4">
          This is called the <strong className="text-white">L2 penalty</strong> because it uses the squared
          L2 norm of the weight vector. The effect is to shrink all coefficients toward zero proportionally.
          Large coefficients get penalized more heavily (because squaring amplifies large values). The
          result is a smoother, more stable model.
        </p>

        <p className="mb-4">
          In the visualization below, the faint bars show the unregularized coefficients — notice how some
          are very large, which causes overfitting. As you increase lambda, watch all the bars shrink
          simultaneously. Ridge never makes any coefficient exactly zero; it only makes them smaller.
        </p>

        <RidgeSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Why Does Shrinking Help?</h3>

        <p className="mb-4">
          Large coefficients mean the model is very sensitive to small changes in input. A coefficient of
          100 on x^7 means a tiny change in x gets amplified enormously. By penalizing large coefficients,
          Ridge forces the model to spread its &ldquo;capacity&rdquo; across features more evenly, leading
          to smoother predictions that generalize better.
        </p>

        <p className="mb-4">
          Ridge regression has a closed-form solution, extending the normal equation:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-yellow-400">
            w* = (X^T X + lambda * I)^(-1) X^T y
          </code>
        </div>

        <p className="mb-4">
          The addition of lambda * I to the matrix makes it always invertible, even when X^T X is singular
          (which happens when features are correlated or there are more features than samples). This is
          why Ridge regression is sometimes called <strong className="text-white">Tikhonov regularization
          </strong>.
        </p>
      </section>

      {/* ========== Section 3: Lasso (L1) Regularization ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Lasso Regression (L1 Penalty)</h2>

        <p className="mb-4">
          <strong className="text-white">Lasso regression</strong> uses the sum of absolute values instead
          of squared values:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-yellow-400">
            L_lasso = MSE + lambda * sum(|w_i|)
          </code>
        </div>

        <p className="mb-4">
          This seemingly small change — absolute value instead of square — has a profound consequence.
          Lasso does not just shrink coefficients; it can set them to <strong className="text-white">
          exactly zero</strong>. This means Lasso performs automatic <strong className="text-white">
          feature selection</strong> — it identifies which features are important and eliminates the rest.
        </p>

        <p className="mb-4">
          Watch carefully as you increase lambda below. Unlike Ridge, where all bars shrink proportionally,
          Lasso drives the smallest coefficients to zero first. The yellow &ldquo;0&rdquo; markers show
          which features have been eliminated. This sparse solution uses fewer features, making the model
          more interpretable.
        </p>

        <LassoSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Why Does L1 Produce Zeros?</h3>

        <p className="mb-4">
          The mathematical reason involves the gradient of the absolute value function. The L1 penalty
          contributes a constant gradient (either +lambda or -lambda) regardless of the coefficient
          magnitude. For small coefficients, this constant push is strong enough to drive them all the
          way to zero. In contrast, L2&rsquo;s gradient is proportional to the coefficient value, so it
          gets weaker as the coefficient approaches zero — it asymptotically approaches but never reaches
          zero.
        </p>

        <p className="mb-4">
          This sparsity property makes Lasso invaluable when you have many features but suspect only a
          few are actually relevant — a common situation in genomics, text analysis, and many other domains.
        </p>
      </section>

      {/* ========== Section 4: L1 vs L2 Geometry ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">L1 vs. L2: The Geometric View</h2>

        <p className="mb-4">
          The difference between L1 and L2 has a beautiful geometric interpretation. Regularization is
          equivalent to constraining the weights to lie within a region:
        </p>

        <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
          <li>
            <strong className="text-yellow-400">L1 constraint</strong>: |w1| + |w2| &lt;= t, which is a
            <strong className="text-white"> diamond</strong> in 2D (a polytope with sharp corners at the axes).
          </li>
          <li>
            <strong className="text-emerald-400">L2 constraint</strong>: w1^2 + w2^2 &lt;= t^2, which is a
            <strong className="text-white"> circle</strong> in 2D (a smooth ball with no corners).
          </li>
        </ul>

        <p className="mb-4">
          The optimal regularized solution is where the loss contours (ellipses centered at the OLS
          solution) first touch the constraint region. For the L1 diamond, the first contact point is
          very likely to be at a <em>corner</em> — and corners lie on the axes, where one coordinate is
          zero. This is why L1 produces sparse solutions. For the L2 circle, the first contact can happen
          anywhere on the smooth boundary, so both coordinates are typically nonzero.
        </p>

        <GeometrySketch />

        <p className="mt-4">
          Shrink the constraint size and watch the solutions move. The L2 solution slides smoothly along
          the circle, keeping both weights nonzero. The L1 solution tends to snap to the axes — one
          weight goes to zero while the other absorbs the constraint budget. This geometric intuition
          is one of the most important insights in all of statistical learning.
        </p>
      </section>

      {/* ========== Section 5: Elastic Net ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Elastic Net: Best of Both Worlds</h2>

        <p className="mb-4">
          What if you want both the sparsity of Lasso and the stability of Ridge?{' '}
          <strong className="text-white">Elastic Net</strong> combines both penalties:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            L_elastic = MSE + lambda * [ alpha * sum(|w_i|) + (1-alpha) * sum(w_i^2) ]
          </code>
        </div>

        <p className="mb-4">
          The parameter <strong className="text-white">alpha</strong> (also called l1_ratio) controls the
          mix. When alpha = 1, it is pure Lasso. When alpha = 0, it is pure Ridge. Values in between give
          a blend.
        </p>

        <p className="mb-4">
          Elastic Net is particularly useful when features are correlated. Lasso tends to arbitrarily pick
          one of a group of correlated features and zero out the rest. Elastic Net handles this more
          gracefully by keeping groups of correlated features together while still providing some sparsity.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="font-semibold text-emerald-400 mb-2">Ridge (L2)</h3>
            <p className="text-sm">Shrinks all, zeros none. Stable with correlated features.
            Best when all features are relevant.</p>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <h3 className="font-semibold text-yellow-400 mb-2">Lasso (L1)</h3>
            <p className="text-sm">Zeros many, feature selection built in. Can be unstable with
            correlated features. Best when few features matter.</p>
          </div>
          <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-4">
            <h3 className="font-semibold text-pink-400 mb-2">Elastic Net</h3>
            <p className="text-sm">Balances sparsity and stability. Handles correlated features
            well. Best general-purpose choice.</p>
          </div>
        </div>
      </section>

      {/* ========== Section 6: Choosing Lambda ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Choosing Lambda with Cross-Validation</h2>

        <p className="mb-4">
          Lambda is a <strong className="text-white">hyperparameter</strong> — it is not learned from the
          data but must be set before training. Choosing it well is critical. Too small and you get
          overfitting (the regularization is not doing its job). Too large and you get underfitting (the
          model is too constrained to capture the pattern).
        </p>

        <p className="mb-4">
          The standard approach is to use <strong className="text-white">cross-validation</strong>. Try many
          values of lambda (typically on a logarithmic scale), evaluate each using cross-validated error,
          and pick the one with the lowest validation error. The chart below illustrates this process.
        </p>

        <ValidationCurveSketch />

        <p className="mt-4">
          Notice the characteristic pattern: too little regularization (left) shows a large gap between
          train and validation error (overfitting). Too much regularization (right) shows both errors
          increasing (underfitting). The sweet spot is where validation error is minimized.
        </p>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Practical Tips</h3>

        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            Search lambda on a <strong className="text-white">logarithmic scale</strong>: [0.001, 0.01,
            0.1, 1, 10, 100]. The optimal lambda can vary by orders of magnitude.
          </li>
          <li>
            Use <code className="text-emerald-400">RidgeCV</code> or <code className="text-emerald-400">
            LassoCV</code> in scikit-learn — they perform cross-validated lambda selection automatically.
          </li>
          <li>
            <strong className="text-white">Standardize your features</strong> before regularization. If
            features are on different scales, the penalty unfairly affects features with larger magnitudes.
          </li>
          <li>
            The <strong className="text-white">one-standard-error rule</strong>: instead of picking the
            lambda with the absolute lowest CV error, pick the simplest model (largest lambda) whose error
            is within one standard error of the minimum. This gives a more parsimonious model.
          </li>
        </ul>
      </section>

      {/* ========== Section 7: Python — Ridge vs Lasso ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Ridge vs. Lasso vs. Elastic Net</h2>

        <p className="mb-4">
          Let us put it all together. We fit a deliberately over-parameterized model (degree-10 polynomial)
          and compare how Ridge, Lasso, and Elastic Net handle the overfitting. Pay attention to how many
          coefficients each method keeps nonzero.
        </p>

        <PythonCell defaultCode={ridgeLassoCode} title="Ridge vs Lasso vs Elastic Net Comparison" />

        <p className="mt-4">
          Study the output table carefully. OLS (no regularization) shows the classic overfitting pattern:
          excellent train error, terrible test error. Ridge improves test error while keeping all features.
          Lasso improves test error while zeroing out many features. Elastic Net provides a middle ground.
          The &ldquo;Nonzero&rdquo; column reveals the sparsity difference between the methods.
        </p>
      </section>

      {/* ========== Section 8: Key Takeaways ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Regularization prevents overfitting by penalizing complexity</h3>
            <p className="text-sm">
              Adding a penalty term to the loss function forces the model to find simpler solutions. The
              strength of the penalty (lambda) controls the bias-variance tradeoff.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">L2 (Ridge) shrinks; L1 (Lasso) eliminates</h3>
            <p className="text-sm">
              Ridge shrinks all coefficients toward zero but keeps them nonzero. Lasso drives many to exactly
              zero, performing automatic feature selection. The geometric reason: diamond corners vs. smooth circle.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Elastic Net combines both penalties</h3>
            <p className="text-sm">
              Elastic Net gets the sparsity benefits of L1 with the stability of L2. It is especially useful
              when features are correlated.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Use cross-validation to choose lambda</h3>
            <p className="text-sm">
              Lambda is a hyperparameter that must be tuned. Search on a log scale, use cross-validation,
              and always standardize features first. Regularization is not optional — it is a fundamental
              part of building models that generalize.
            </p>
          </div>
        </div>
      </section>
    </article>
  )
}
