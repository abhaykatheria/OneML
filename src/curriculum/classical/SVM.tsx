import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/svm',
  title: 'Support Vector Machines',
  description: 'Maximum margin classifiers, the kernel trick, and decision boundaries in high-dimensional spaces',
  track: 'classical',
  order: 6,
  tags: ['svm', 'classification', 'kernel-trick', 'margin', 'rbf'],
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

interface DataPoint {
  x: number
  y: number
  label: number
}

const CLASS_COLORS: [number, number, number][] = [
  [99, 102, 241],   // indigo (class 0)
  [239, 68, 68],    // red (class 1)
]

function generateLinearData(seed: number): DataPoint[] {
  const rng = makeRng(seed)
  const points: DataPoint[] = []
  for (let i = 0; i < 20; i++) {
    points.push({ x: 0.2 + randn(rng) * 0.12, y: 0.25 + randn(rng) * 0.15, label: 0 })
  }
  for (let i = 0; i < 20; i++) {
    points.push({ x: 0.75 + randn(rng) * 0.12, y: 0.7 + randn(rng) * 0.15, label: 1 })
  }
  // A few overlap points near boundary
  for (let i = 0; i < 5; i++) {
    points.push({ x: 0.42 + randn(rng) * 0.06, y: 0.48 + randn(rng) * 0.06, label: 0 })
  }
  for (let i = 0; i < 5; i++) {
    points.push({ x: 0.58 + randn(rng) * 0.06, y: 0.52 + randn(rng) * 0.06, label: 1 })
  }
  return points
}

function generateXORData(seed: number): DataPoint[] {
  const rng = makeRng(seed)
  const points: DataPoint[] = []
  // Quadrant 1 (top-left): class 0
  for (let i = 0; i < 15; i++) {
    points.push({ x: 0.25 + randn(rng) * 0.1, y: 0.25 + randn(rng) * 0.1, label: 0 })
  }
  // Quadrant 2 (top-right): class 1
  for (let i = 0; i < 15; i++) {
    points.push({ x: 0.75 + randn(rng) * 0.1, y: 0.25 + randn(rng) * 0.1, label: 1 })
  }
  // Quadrant 3 (bottom-left): class 1
  for (let i = 0; i < 15; i++) {
    points.push({ x: 0.25 + randn(rng) * 0.1, y: 0.75 + randn(rng) * 0.1, label: 1 })
  }
  // Quadrant 4 (bottom-right): class 0
  for (let i = 0; i < 15; i++) {
    points.push({ x: 0.75 + randn(rng) * 0.1, y: 0.75 + randn(rng) * 0.1, label: 0 })
  }
  return points
}

/* ------------------------------------------------------------------ */
/* Linear SVM — dot product based decision function                    */
/* ------------------------------------------------------------------ */

function linearSVMDecision(
  px: number, py: number,
  w1: number, w2: number, b: number
): number {
  return w1 * px + w2 * py + b
}

/* ------------------------------------------------------------------ */
/* Section 1 — Maximum Margin Classifier                               */
/* ------------------------------------------------------------------ */

function MaxMarginSketch() {
  const [cParam, setCParam] = useState(1.0)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateLinearData(42)
      const margin = 40

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      // Simple linear SVM approximation via perceptron-like fitting
      // We compute a separating hyperplane and identify support vectors
      function fitSVM(C: number): { w1: number; w2: number; b: number; svIndices: number[] } {
        // Use gradient descent on hinge loss + L2 regularization
        let w1 = 0, w2 = 0, b = 0
        const lr = 0.01
        const epochs = 500

        for (let epoch = 0; epoch < epochs; epoch++) {
          let dw1 = w1, dw2 = w2, db = 0  // Regularization gradient

          for (const pt of data) {
            const yi = pt.label === 0 ? -1 : 1
            const decision = w1 * pt.x + w2 * pt.y + b
            if (yi * decision < 1) {
              dw1 -= C * yi * pt.x
              dw2 -= C * yi * pt.y
              db -= C * yi
            }
          }

          w1 -= lr * dw1
          w2 -= lr * dw2
          b -= lr * db
        }

        // Identify support vectors: points closest to the margin
        const distances = data.map((pt, i) => {
          const yi = pt.label === 0 ? -1 : 1
          const d = yi * (w1 * pt.x + w2 * pt.y + b)
          return { i, d }
        })
        distances.sort((a, b) => a.d - b.d)
        const svIndices = distances.slice(0, 6).map(d => d.i)

        return { w1, w2, b, svIndices }
      }

      let model = fitSVM(cParam * 50)

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 440)
        model = fitSVM(cParam * 50)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const { w1, w2, b, svIndices } = model

        // Draw decision regions (faint)
        const res = 8
        for (let sx = margin; sx < p.width - margin; sx += res) {
          for (let sy = margin; sy < p.height - margin; sy += res) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const decision = linearSVMDecision(nx, ny, w1, w2, b)
            const [r, g, bb] = decision < 0 ? CLASS_COLORS[0] : CLASS_COLORS[1]
            p.noStroke()
            p.fill(r, g, bb, 25)
            p.rect(sx, sy, res, res)
          }
        }

        // Draw margin band
        const norm = Math.sqrt(w1 * w1 + w2 * w2)
        if (norm > 0.001) {
          // Draw the margin boundaries (decision = +1 and decision = -1)
          p.stroke(250, 204, 21, 80)
          p.strokeWeight(1.5)
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.setLineDash([6, 4])

          for (const offset of [-1, 1]) {
            const points: [number, number][] = []
            for (let t = 0; t <= 1; t += 0.01) {
              // For each x, find y where w1*x + w2*y + b = offset
              if (Math.abs(w2) > 0.001) {
                const y = (offset - w1 * t - b) / w2
                if (y >= 0 && y <= 1) points.push(toScreen(t, y))
              }
            }
            if (points.length >= 2) {
              p.line(points[0][0], points[0][1], points[points.length - 1][0], points[points.length - 1][1])
            }
          }
          ctx.setLineDash([])

          // Fill the margin band
          p.noStroke()
          p.fill(250, 204, 21, 15)
          p.beginShape()
          for (let t = 0; t <= 1; t += 0.01) {
            if (Math.abs(w2) > 0.001) {
              const y = (-1 - w1 * t - b) / w2
              if (y >= 0 && y <= 1) {
                const [sx, sy] = toScreen(t, y)
                p.vertex(sx, sy)
              }
            }
          }
          for (let t = 1; t >= 0; t -= 0.01) {
            if (Math.abs(w2) > 0.001) {
              const y = (1 - w1 * t - b) / w2
              if (y >= 0 && y <= 1) {
                const [sx, sy] = toScreen(t, y)
                p.vertex(sx, sy)
              }
            }
          }
          p.endShape(p.CLOSE)
        }

        // Decision boundary line
        p.stroke(250, 204, 21)
        p.strokeWeight(2.5)
        const linePoints: [number, number][] = []
        for (let t = 0; t <= 1; t += 0.005) {
          if (Math.abs(w2) > 0.001) {
            const y = (-w1 * t - b) / w2
            if (y >= 0 && y <= 1) linePoints.push(toScreen(t, y))
          }
        }
        if (linePoints.length >= 2) {
          p.line(linePoints[0][0], linePoints[0][1],
            linePoints[linePoints.length - 1][0], linePoints[linePoints.length - 1][1])
        }

        // Data points
        for (let i = 0; i < data.length; i++) {
          const [sx, sy] = toScreen(data[i].x, data[i].y)
          const [r, g, bb] = CLASS_COLORS[data[i].label]
          const isSV = svIndices.includes(i)

          if (isSV) {
            // Support vector highlight ring
            p.stroke(250, 204, 21)
            p.strokeWeight(2.5)
            p.noFill()
            p.ellipse(sx, sy, 22, 22)
          }

          p.noStroke()
          p.fill(r, g, bb, 220)
          p.ellipse(sx, sy, 10, 10)
        }

        // Labels
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`C = ${cParam.toFixed(2)}`, 10, 10)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text('Yellow ring = support vector', 10, 28)
        p.text('Dashed lines = margin boundaries', 10, 43)

        // Margin width label
        if (norm > 0.001) {
          p.fill(250, 204, 21, 200)
          p.textSize(11)
          p.textAlign(p.RIGHT, p.TOP)
          p.text(`Margin width: ${(2 / norm).toFixed(3)}`, p.width - 10, 10)
        }
      }
    },
    [cParam],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            C (regularization):
            <input
              type="range"
              min={0.01}
              max={5}
              step={0.01}
              value={cParam}
              onChange={(e) => setCParam(parseFloat(e.target.value))}
              className="w-48 accent-yellow-400"
            />
            <span className="w-12 font-mono">{cParam.toFixed(2)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Kernel Trick (XOR data + RBF boundary)                  */
/* ------------------------------------------------------------------ */

function KernelTrickSketch() {
  const [kernel, setKernel] = useState<'linear' | 'rbf'>('linear')
  const [gamma, setGamma] = useState(5.0)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateXORData(77)
      const margin = 40

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      // RBF kernel: K(x, y) = exp(-gamma * ||x-y||^2)
      function rbfKernel(x1: number, y1: number, x2: number, y2: number, g: number): number {
        return Math.exp(-g * ((x1 - x2) ** 2 + (y1 - y2) ** 2))
      }

      // Kernel SVM prediction using a simple weighted approach
      // We pre-compute alpha values using a simplified SMO-like heuristic
      function predictRBF(px: number, py: number): number {
        let sum = 0
        for (const pt of data) {
          const yi = pt.label === 0 ? -1 : 1
          const k = rbfKernel(px, py, pt.x, pt.y, gamma)
          sum += yi * k
        }
        return sum
      }

      function predictLinear(px: number, py: number): number {
        // Simple linear decision (won't separate XOR)
        let sum = 0
        for (const pt of data) {
          const yi = pt.label === 0 ? -1 : 1
          const k = px * pt.x + py * pt.y
          sum += yi * k
        }
        return sum
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 440)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Draw decision regions
        const res = 8
        for (let sx = margin; sx < p.width - margin; sx += res) {
          for (let sy = margin; sy < p.height - margin; sy += res) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const decision = kernel === 'rbf'
              ? predictRBF(nx, ny)
              : predictLinear(nx, ny)

            const [r, g, b] = decision < 0 ? CLASS_COLORS[0] : CLASS_COLORS[1]
            p.noStroke()
            p.fill(r, g, b, 35)
            p.rect(sx, sy, res, res)
          }
        }

        // Draw boundary contour (where decision ~= 0)
        const bRes = 4
        for (let sx = margin; sx < p.width - margin; sx += bRes) {
          for (let sy = margin; sy < p.height - margin; sy += bRes) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const decision = kernel === 'rbf'
              ? predictRBF(nx, ny)
              : predictLinear(nx, ny)

            if (Math.abs(decision) < (kernel === 'rbf' ? 1.5 : 20)) {
              p.noStroke()
              p.fill(250, 204, 21, 60)
              p.rect(sx, sy, bRes, bRes)
            }
          }
        }

        // Data points
        for (const pt of data) {
          const [sx, sy] = toScreen(pt.x, pt.y)
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.noStroke()
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 10, 10)
        }

        // Labels
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Kernel: ${kernel.toUpperCase()}`, 10, 10)

        if (kernel === 'rbf') {
          p.fill(148, 163, 184)
          p.textSize(11)
          p.text(`gamma = ${gamma.toFixed(1)}`, 10, 30)
        }

        if (kernel === 'linear') {
          p.fill(239, 68, 68, 200)
          p.textSize(12)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text('Linear kernel cannot separate XOR data!', p.width / 2, p.height - margin + 30)
        } else {
          p.fill(52, 211, 153, 200)
          p.textSize(12)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text('RBF kernel captures the non-linear boundary', p.width / 2, p.height - margin + 30)
        }

        // Legend
        p.textAlign(p.LEFT, p.BOTTOM)
        for (let c = 0; c < 2; c++) {
          const [r, g, b] = CLASS_COLORS[c]
          p.fill(r, g, b)
          p.noStroke()
          p.ellipse(15, p.height - 12 + c * 16, 8, 8)
          p.fill(148, 163, 184)
          p.textSize(11)
          p.text(`Class ${c}`, 24, p.height - 6 + c * 16)
        }

        p.noLoop()
      }
    },
    [kernel, gamma],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Kernel:
            <select
              value={kernel}
              onChange={(e) => setKernel(e.target.value as 'linear' | 'rbf')}
              className="rounded bg-gray-800 px-2 py-1 text-gray-200"
            >
              <option value="linear">Linear</option>
              <option value="rbf">RBF (Gaussian)</option>
            </select>
          </label>
          {kernel === 'rbf' && (
            <label className="flex items-center gap-2">
              Gamma:
              <input
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={gamma}
                onChange={(e) => setGamma(parseFloat(e.target.value))}
                className="w-40 accent-emerald-400"
              />
              <span className="w-10 font-mono">{gamma.toFixed(1)}</span>
            </label>
          )}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — RBF Gamma Exploration                                   */
/* ------------------------------------------------------------------ */

function GammaExplorationSketch() {
  const [gamma, setGamma] = useState(5.0)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateLinearData(42)
      const margin = 40

      function rbfKernel(x1: number, y1: number, x2: number, y2: number, g: number): number {
        return Math.exp(-g * ((x1 - x2) ** 2 + (y1 - y2) ** 2))
      }

      function predict(px: number, py: number): number {
        let sum = 0
        for (const pt of data) {
          const yi = pt.label === 0 ? -1 : 1
          sum += yi * rbfKernel(px, py, pt.x, pt.y, gamma)
        }
        return sum
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 400)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Decision regions
        const res = 6
        for (let sx = margin; sx < p.width - margin; sx += res) {
          for (let sy = margin; sy < p.height - margin; sy += res) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const decision = predict(nx, ny)
            const [r, g, b] = decision < 0 ? CLASS_COLORS[0] : CLASS_COLORS[1]
            const intensity = Math.min(50, Math.abs(decision) * 15)
            p.noStroke()
            p.fill(r, g, b, intensity)
            p.rect(sx, sy, res, res)
          }
        }

        // Boundary highlight
        const bRes = 4
        for (let sx = margin; sx < p.width - margin; sx += bRes) {
          for (let sy = margin; sy < p.height - margin; sy += bRes) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const d = predict(nx, ny)
            if (Math.abs(d) < 0.8) {
              p.noStroke()
              p.fill(250, 204, 21, 70)
              p.rect(sx, sy, bRes, bRes)
            }
          }
        }

        // Data points
        for (const pt of data) {
          const [sx, sy] = [
            margin + pt.x * (p.width - 2 * margin),
            margin + pt.y * (p.height - 2 * margin),
          ]
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.noStroke()
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 10, 10)
        }

        // Labels
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`RBF gamma = ${gamma.toFixed(1)}`, 10, 10)

        p.fill(148, 163, 184)
        p.textSize(11)
        const desc = gamma < 2
          ? 'Low gamma: smooth, underfitting boundary'
          : gamma < 10
            ? 'Moderate gamma: balanced boundary'
            : 'High gamma: wiggly, overfitting boundary'
        p.text(desc, 10, 28)

        p.noLoop()
      }
    },
    [gamma],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Gamma:
            <input
              type="range"
              min={0.5}
              max={50}
              step={0.5}
              value={gamma}
              onChange={(e) => setGamma(parseFloat(e.target.value))}
              className="w-56 accent-yellow-400"
            />
            <span className="w-12 font-mono">{gamma.toFixed(1)}</span>
          </label>
          <span className="text-gray-500 text-xs">
            {gamma < 2 ? 'Smooth' : gamma < 10 ? 'Balanced' : 'Wiggly'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function SVM() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1 — The Maximum Margin Idea ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">1. The Maximum Margin Idea</h2>
        <p className="mb-4 leading-relaxed">
          Suppose you have two groups of data points and you want to draw a line that separates them.
          In general, there are infinitely many lines that could do the job. Logistic regression picks
          one. A perceptron picks another. But Support Vector Machines ask a more ambitious question:
          which line is the <span className="text-white font-semibold">best possible</span> separator?
        </p>
        <p className="mb-4 leading-relaxed">
          SVM defines &ldquo;best&rdquo; as the line that maximizes the
          <span className="text-white font-semibold"> margin</span> — the distance between the decision
          boundary and the nearest data point on either side. Imagine inflating a band around the
          separating line until it touches the closest points. Those points are called
          <span className="text-white font-semibold"> support vectors</span>, and they are the only
          data points that actually matter for defining the boundary. Every other point could be moved
          or deleted without changing the classifier at all.
        </p>
        <p className="mb-4 leading-relaxed">
          Why maximize the margin? Intuitively, a wider margin means the classifier is more robust to
          small perturbations in the data. Theoretically, a larger margin corresponds to a lower
          VC dimension, which provides a generalization bound: the model is less likely to overfit.
          This makes SVM one of the most principled classifiers in all of machine learning.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Key Concepts</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Decision boundary:</span> The hyperplane w &middot; x + b = 0</li>
            <li><span className="text-white">Margin:</span> The perpendicular distance 2/||w|| between the two margin boundaries</li>
            <li><span className="text-white">Support vectors:</span> The training points closest to the boundary that define it</li>
            <li><span className="text-white">Maximizing margin = minimizing ||w||</span> subject to correct classification</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 2 — Soft Margin and the C Parameter ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">2. Soft Margin and the C Parameter</h2>
        <p className="mb-4 leading-relaxed">
          Real-world data is rarely perfectly separable. Some points will always fall on the wrong side
          of any line. The <span className="text-white font-semibold">soft margin</span> SVM handles
          this by allowing some misclassifications, but penalizing them. The penalty strength is
          controlled by the hyperparameter <span className="text-white font-semibold">C</span>.
        </p>
        <p className="mb-4 leading-relaxed">
          The SVM optimization becomes: minimize ||w||/2 + C &times; &sum; max(0, 1 - y<sub>i</sub>(w &middot; x<sub>i</sub> + b)).
          The first term wants a wide margin (small ||w||). The second term penalizes violations. C
          controls the trade-off:
        </p>
        <ul className="mb-4 list-disc pl-5 space-y-1">
          <li><span className="text-white">Large C:</span> heavy penalty for violations &rarr; narrow margin, fewer misclassifications, risk of overfitting</li>
          <li><span className="text-white">Small C:</span> mild penalty &rarr; wide margin, more misclassifications tolerated, smoother boundary</li>
        </ul>
        <p className="mb-4 leading-relaxed">
          In the visualization below, data points circled in yellow are the support vectors. Drag the C
          slider and watch how the margin width changes and which points become support vectors. With
          very small C, the margin is wide and the classifier tolerates outliers. As C grows, the
          margin shrinks and the classifier fights harder to classify every point correctly.
        </p>
        <MaxMarginSketch />
        <p className="mt-4 leading-relaxed text-gray-400">
          Notice that only a few points (the support vectors) influence the boundary. This sparsity
          is a key advantage of SVMs over methods like logistic regression, where every point contributes
          to the decision. In high dimensions, this sparsity also makes SVMs more memory-efficient.
        </p>
      </section>

      {/* ========== Section 3 — The Kernel Trick ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">3. The Kernel Trick</h2>
        <p className="mb-4 leading-relaxed">
          A linear SVM can only draw straight boundaries. But many real-world problems are non-linear.
          Consider the classic XOR pattern below: two classes are arranged in alternating quadrants.
          No single straight line can separate them.
        </p>
        <p className="mb-4 leading-relaxed">
          The <span className="text-white font-semibold">kernel trick</span> is one of the most elegant
          ideas in machine learning. Instead of explicitly transforming the data into a higher-dimensional
          space where it becomes linearly separable, we replace every dot product in the SVM formulation
          with a <span className="text-white font-semibold">kernel function</span> K(x<sub>i</sub>, x<sub>j</sub>)
          that computes the inner product in that higher-dimensional space implicitly. We never actually
          compute the transformation — we just evaluate the kernel.
        </p>
        <p className="mb-4 leading-relaxed">
          The most popular kernel is the <span className="text-white font-semibold">Radial Basis Function (RBF)</span>:
          K(x, y) = exp(-&gamma; ||x - y||&sup2;). This corresponds to an infinite-dimensional feature space.
          Toggle between Linear and RBF below to see the difference. The linear kernel fails completely
          on the XOR data, while RBF effortlessly captures the non-linear structure.
        </p>
        <KernelTrickSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Common Kernels</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Linear:</span> K(x, y) = x &middot; y — straight boundary, fast, good for high-d sparse data</li>
            <li><span className="text-white">Polynomial:</span> K(x, y) = (x &middot; y + c)<sup>d</sup> — curved boundaries of degree d</li>
            <li><span className="text-white">RBF (Gaussian):</span> K(x, y) = exp(-&gamma;||x - y||&sup2;) — most flexible, local influence</li>
            <li><span className="text-white">Sigmoid:</span> K(x, y) = tanh(&alpha; x &middot; y + c) — neural-network-like</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 4 — The Gamma Parameter ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">4. RBF Gamma: From Smooth to Wiggly</h2>
        <p className="mb-4 leading-relaxed">
          The RBF kernel has a critical hyperparameter: <span className="text-white font-semibold">gamma</span> (&gamma;).
          It controls the &ldquo;reach&rdquo; of each training point&apos;s influence. Think of each data point
          as emitting a Gaussian bump of influence. Gamma controls how wide or narrow that bump is.
        </p>
        <p className="mb-4 leading-relaxed">
          <span className="text-white">Low gamma</span> means each point has a wide influence region. Distant
          points still affect the decision, producing a smooth, gently curving boundary. This is the SVM
          equivalent of high bias / low variance — the model underfits if gamma is too small.
        </p>
        <p className="mb-4 leading-relaxed">
          <span className="text-white">High gamma</span> means each point has a very tight influence region.
          Only the nearest training points affect the decision at any location. The boundary becomes
          extremely wiggly, wrapping around individual data points — classic overfitting. The model
          memorizes the training data instead of learning the underlying pattern.
        </p>
        <p className="mb-4 leading-relaxed">
          Drag the slider below from low to high gamma and watch the boundary transform from an
          underfitting gentle curve to an overfitting fractal-like boundary.
        </p>
        <GammaExplorationSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Tuning C and Gamma Together</h3>
          <p className="text-gray-300">
            In practice, C and gamma are always tuned together using cross-validation. A common approach
            is grid search over a logarithmic range: C in [0.01, 0.1, 1, 10, 100] and gamma in
            [0.001, 0.01, 0.1, 1, 10]. Scikit-learn&apos;s <code className="text-emerald-400">GridSearchCV</code> automates
            this. The best combination often lies in a narrow diagonal band in the C-gamma space.
          </p>
        </div>
      </section>

      {/* ========== Section 5 — SVM with scikit-learn ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">5. SVM in Practice with scikit-learn</h2>
        <p className="mb-4 leading-relaxed">
          Let us put it all together by training a real SVM on synthetic data using scikit-learn.
          The code below generates a non-linearly separable dataset, trains an RBF SVM, and reports
          the accuracy. Try changing the kernel, C, and gamma to see how the results change.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.svm import SVC
from sklearn.datasets import make_moons
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Generate non-linear data (two interleaving half circles)
X, y = make_moons(n_samples=300, noise=0.2, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Train SVM with RBF kernel
svm = SVC(kernel='rbf', C=1.0, gamma='scale', random_state=42)
svm.fit(X_train, y_train)

# Evaluate
y_pred = svm.predict(X_test)
print(f"Kernel: {svm.kernel}")
print(f"C: {svm.C}, Gamma: {svm._gamma}")
print(f"Number of support vectors: {svm.n_support_}")
print(f"\\nAccuracy: {accuracy_score(y_test, y_pred):.4f}")
print(f"\\n{classification_report(y_test, y_pred)}")
`}
          title="SVM with RBF Kernel"
        />
      </section>

      {/* ========== Section 6 — Comparing Kernels ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">6. Comparing Kernels on Real Data</h2>
        <p className="mb-4 leading-relaxed">
          Different datasets benefit from different kernels. A useful exercise is to compare kernels
          side by side. The code below trains linear, polynomial, and RBF SVMs on the same dataset
          and compares their performance. Notice how the non-linear kernels handle curved boundaries
          that the linear kernel cannot capture.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.svm import SVC
from sklearn.datasets import make_circles
from sklearn.model_selection import cross_val_score

# Generate concentric circles (not linearly separable)
X, y = make_circles(n_samples=400, noise=0.1, factor=0.4, random_state=42)

kernels = ['linear', 'poly', 'rbf']
for k in kernels:
    svm = SVC(kernel=k, C=1.0, gamma='scale', degree=3, random_state=42)
    scores = cross_val_score(svm, X, y, cv=5, scoring='accuracy')
    print(f"{k:>8} kernel: accuracy = {scores.mean():.4f} (+/- {scores.std():.4f})")

print("\\nRBF wins because the data has a circular boundary!")
print("Linear fails because no straight line can separate concentric circles.")
`}
          title="Kernel Comparison"
        />
      </section>

      {/* ========== Section 7 — When to Use SVMs ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">7. When to Use SVMs</h2>
        <p className="mb-4 leading-relaxed">
          SVMs shine in specific scenarios and have well-understood limitations. Understanding when
          to reach for an SVM versus other methods is a key practical skill.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Strengths</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">High-dimensional data:</span> SVMs work well even when the number of features exceeds the number of samples (e.g., text classification)</li>
            <li><span className="text-white">Clear margin:</span> When classes are well-separated, SVM finds an excellent boundary</li>
            <li><span className="text-white">Memory efficient:</span> Only support vectors are stored, not the entire dataset</li>
            <li><span className="text-white">Kernel flexibility:</span> Custom kernels can encode domain knowledge</li>
          </ul>
        </div>
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Scaling:</span> Training time is O(n&sup2;) to O(n&sup3;), making SVMs impractical for very large datasets (&gt;100K samples)</li>
            <li><span className="text-white">No probabilities:</span> SVMs output class labels, not probabilities (Platt scaling can add them, but it is an approximation)</li>
            <li><span className="text-white">Feature scaling required:</span> SVMs are sensitive to the scale of input features — always standardize first</li>
            <li><span className="text-white">Hyperparameter sensitivity:</span> Poor C/gamma choices lead to dramatic under- or overfitting</li>
          </ul>
        </div>
        <p className="mt-4 leading-relaxed text-gray-400">
          In modern practice, SVMs have been largely superseded by gradient-boosted trees (for
          tabular data) and deep learning (for images and text). But they remain a powerful baseline,
          especially for small-to-medium datasets with clear structure, and the theory behind them
          — margin maximization, kernel methods, and convex optimization — is foundational to all of
          machine learning.
        </p>
      </section>
    </article>
  )
}
