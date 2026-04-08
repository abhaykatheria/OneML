import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/matrices',
  title: 'Matrices & Transformations',
  description: 'See how matrices encode linear transformations — rotations, reflections, scaling — and why they power ML.',
  track: 'foundations',
  order: 2,
  tags: ['matrices', 'linear-algebra', 'transformations', 'eigenvalues', 'numpy'],
}

/* ------------------------------------------------------------------ */
/* Section 1 — Matrix Warps a Grid (2x2 transformation)                */
/* ------------------------------------------------------------------ */

function MatrixGridSketch() {
  const [a, setA] = useState(1)
  const [b, setB] = useState(0)
  const [c, setC] = useState(0)
  const [d, setD] = useState(1)

  const matRef = useRef({ a, b, c, d })
  matRef.current = { a, b, c, d }

  const sketch = useCallback((p: p5) => {
    const SCALE = 40
    let originX = 0
    let originY = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 420)
      originX = pw / 2
      originY = 210
    }

    function w2s(wx: number, wy: number): [number, number] {
      return [originX + wx * SCALE, originY - wy * SCALE]
    }

    function transform(x: number, y: number): [number, number] {
      const m = matRef.current
      return [m.a * x + m.b * y, m.c * x + m.d * y]
    }

    p.draw = () => {
      p.background(15, 23, 42)

      // Original grid (faint)
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let i = -6; i <= 6; i++) {
        const [x0, y0] = w2s(i, -6)
        const [x1, y1] = w2s(i, 6)
        p.line(x0, y0, x1, y1)
        const [x2, y2] = w2s(-6, i)
        const [x3, y3] = w2s(6, i)
        p.line(x2, y2, x3, y3)
      }

      // Transformed grid
      p.stroke(56, 189, 248, 60)
      p.strokeWeight(1)
      for (let i = -6; i <= 6; i++) {
        // Vertical lines of original become curves
        const steps = 40
        for (let s = 0; s < steps; s++) {
          const t0 = -6 + (12 * s) / steps
          const t1 = -6 + (12 * (s + 1)) / steps
          const [ax0, ay0] = transform(i, t0)
          const [ax1, ay1] = transform(i, t1)
          const [sx0, sy0] = w2s(ax0, ay0)
          const [sx1, sy1] = w2s(ax1, ay1)
          p.line(sx0, sy0, sx1, sy1)
        }
        // Horizontal lines
        for (let s = 0; s < steps; s++) {
          const t0 = -6 + (12 * s) / steps
          const t1 = -6 + (12 * (s + 1)) / steps
          const [ax0, ay0] = transform(t0, i)
          const [ax1, ay1] = transform(t1, i)
          const [sx0, sy0] = w2s(ax0, ay0)
          const [sx1, sy1] = w2s(ax1, ay1)
          p.line(sx0, sy0, sx1, sy1)
        }
      }

      // Transformed basis vectors
      const [e1x, e1y] = transform(1, 0)
      const [e2x, e2y] = transform(0, 1)

      // Draw basis e1
      const [se1x, se1y] = w2s(e1x, e1y)
      p.stroke(250, 204, 21)
      p.strokeWeight(3)
      p.line(originX, originY, se1x, se1y)
      p.fill(250, 204, 21)
      p.noStroke()
      p.ellipse(se1x, se1y, 8, 8)
      p.textSize(14)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('e1\'', se1x + 8, se1y)

      // Draw basis e2
      const [se2x, se2y] = w2s(e2x, e2y)
      p.stroke(52, 211, 153)
      p.strokeWeight(3)
      p.line(originX, originY, se2x, se2y)
      p.fill(52, 211, 153)
      p.noStroke()
      p.ellipse(se2x, se2y, 8, 8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('e2\'', se2x + 8, se2y)

      // Transform a unit square
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]] as const
      p.fill(56, 189, 248, 30)
      p.stroke(56, 189, 248, 120)
      p.strokeWeight(2)
      p.beginShape()
      for (const [sx, sy] of sq) {
        const [tx, ty] = transform(sx, sy)
        const [px, py] = w2s(tx, ty)
        p.vertex(px, py)
      }
      p.endShape(p.CLOSE)

      // Determinant
      const m = matRef.current
      const det = m.a * m.d - m.b * m.c
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Matrix: [[${m.a.toFixed(1)}, ${m.b.toFixed(1)}], [${m.c.toFixed(1)}, ${m.d.toFixed(1)}]]`, 14, 14)
      p.fill(det >= 0 ? [52, 211, 153] : [248, 113, 113])
      p.text(`det = ${det.toFixed(2)}   (area scale factor)`, 14, 36)
    }
  }, [])

  const presets: Record<string, [number, number, number, number]> = {
    Identity: [1, 0, 0, 1],
    'Rotate 45': [0.707, -0.707, 0.707, 0.707],
    'Scale 2x': [2, 0, 0, 2],
    Shear: [1, 1, 0, 1],
    Reflect: [1, 0, 0, -1],
    'Squeeze': [2, 0, 0, 0.5],
  }

  return (
    <div>
      <P5Sketch sketch={sketch} height={420} />
      <div className="mt-3 space-y-3 px-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([name, vals]) => (
            <button
              key={name}
              onClick={() => { setA(vals[0]); setB(vals[1]); setC(vals[2]); setD(vals[3]) }}
              className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-600 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            a: {a.toFixed(1)}
            <input type="range" min={-2} max={2} step={0.1} value={a}
              onChange={(e) => setA(Number(e.target.value))} className="w-32 accent-yellow-400" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            b: {b.toFixed(1)}
            <input type="range" min={-2} max={2} step={0.1} value={b}
              onChange={(e) => setB(Number(e.target.value))} className="w-32 accent-yellow-400" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            c: {c.toFixed(1)}
            <input type="range" min={-2} max={2} step={0.1} value={c}
              onChange={(e) => setC(Number(e.target.value))} className="w-32 accent-emerald-400" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            d: {d.toFixed(1)}
            <input type="range" min={-2} max={2} step={0.1} value={d}
              onChange={(e) => setD(Number(e.target.value))} className="w-32 accent-emerald-400" />
          </label>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Matrix Multiplication Animated                          */
/* ------------------------------------------------------------------ */

function MatMulSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const A = [[2, 1], [0, 3]] as const
  const B = [[1, 4], [2, 1]] as const

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 300)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const s = stepRef.current
      const cellW = 60
      const cellH = 50
      const startAx = 40
      const startBx = 240
      const startCx = 460
      const startY = 80

      // Draw matrix A
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(16)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('A', startAx + cellW, startY - 30)
      for (let r = 0; r < 2; r++) {
        for (let cc = 0; cc < 2; cc++) {
          const x = startAx + cc * cellW
          const y = startY + r * cellH
          const highlight = s >= 0 && Math.floor(s / 2) === r
          p.fill(highlight && cc === (s % 2 < 2 ? 0 : 1) ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0)')
          if (highlight) {
            p.fill(56, 189, 248, 40)
          } else {
            p.noFill()
          }
          p.stroke(71, 85, 105)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellH, 4)
          p.fill(highlight ? [56, 189, 248] : [226, 232, 240])
          p.noStroke()
          p.text(String(A[r][cc]), x + cellW / 2, y + cellH / 2)
        }
      }

      // Draw "x"
      p.fill(148, 163, 184)
      p.textSize(20)
      p.text('\u00D7', startBx - 25, startY + cellH / 2 + cellH / 2)

      // Draw matrix B
      p.textSize(16)
      p.text('B', startBx + cellW, startY - 30)
      for (let r = 0; r < 2; r++) {
        for (let cc = 0; cc < 2; cc++) {
          const x = startBx + cc * cellW
          const y = startY + r * cellH
          const highlight = s >= 0 && (s % 2) === cc
          if (highlight) {
            p.fill(250, 204, 21, 40)
          } else {
            p.noFill()
          }
          p.stroke(71, 85, 105)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellH, 4)
          p.fill(highlight ? [250, 204, 21] : [226, 232, 240])
          p.noStroke()
          p.text(String(B[r][cc]), x + cellW / 2, y + cellH / 2)
        }
      }

      // Draw "="
      p.fill(148, 163, 184)
      p.textSize(20)
      p.text('=', startCx - 25, startY + cellH / 2 + cellH / 2)

      // Result matrix C
      p.textSize(16)
      p.text('C', startCx + cellW, startY - 30)
      const C = [
        [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
        [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
      ]

      for (let r = 0; r < 2; r++) {
        for (let cc = 0; cc < 2; cc++) {
          const idx = r * 2 + cc
          const x = startCx + cc * cellW
          const y = startY + r * cellH
          const computed = idx <= s
          if (idx === s) {
            p.fill(52, 211, 153, 40)
          } else {
            p.noFill()
          }
          p.stroke(71, 85, 105)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellH, 4)
          p.fill(computed ? [52, 211, 153] : [71, 85, 105])
          p.noStroke()
          p.text(computed ? String(C[r][cc]) : '?', x + cellW / 2, y + cellH / 2)
        }
      }

      // Show calculation for current step
      if (s >= 0 && s < 4) {
        const r = Math.floor(s / 2)
        const cc = s % 2
        const calc = `C[${r}][${cc}] = ${A[r][0]}*${B[0][cc]} + ${A[r][1]}*${B[1][cc]} = ${C[r][cc]}`
        p.fill(255)
        p.textSize(15)
        p.textAlign(p.LEFT, p.TOP)
        p.text(calc, 40, startY + 130)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={300} />
      <div className="mt-2 flex items-center gap-3 px-2">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step <= 0}
          className="rounded bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-gray-400">Step {step + 1} / 4</span>
        <button
          onClick={() => setStep(Math.min(3, step + 1))}
          disabled={step >= 3}
          className="rounded bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Eigenvalue Visualization                                */
/* ------------------------------------------------------------------ */

function EigenSketch() {
  const [matIdx, setMatIdx] = useState(0)
  const matIdxRef = useRef(matIdx)
  matIdxRef.current = matIdx

  const matrices: { name: string; m: [number, number, number, number] }[] = [
    { name: 'Stretch', m: [2, 0, 0, 0.5] },
    { name: 'Shear', m: [1, 1, 0, 1] },
    { name: 'Rotate 30', m: [0.866, -0.5, 0.5, 0.866] },
    { name: 'Scale + Rotate', m: [1.5, -1, 1, 1.5] },
  ]

  const sketch = useCallback((p: p5) => {
    const SCALE = 80
    let originX = 0
    let originY = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 400)
      originX = pw / 2
      originY = 200
    }

    function w2s(wx: number, wy: number): [number, number] {
      return [originX + wx * SCALE, originY - wy * SCALE]
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const mat = matrices[matIdxRef.current].m
      const [a, b, c, d] = mat

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let i = -6; i <= 6; i++) {
        p.line(originX + i * SCALE, 0, originX + i * SCALE, p.height)
        p.line(0, originY - i * SCALE, p.width, originY - i * SCALE)
      }

      // Unit circle
      p.noFill()
      p.stroke(100, 116, 139, 80)
      p.strokeWeight(1)
      p.ellipse(originX, originY, SCALE * 2, SCALE * 2)

      // Transform the unit circle
      p.stroke(56, 189, 248, 120)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let angle = 0; angle <= p.TWO_PI + 0.1; angle += 0.05) {
        const ux = Math.cos(angle)
        const uy = Math.sin(angle)
        const tx = a * ux + b * uy
        const ty = c * ux + d * uy
        const [sx, sy] = w2s(tx, ty)
        p.vertex(sx, sy)
      }
      p.endShape()

      // Compute eigenvalues for 2x2: lambda^2 - (a+d)lambda + (ad-bc) = 0
      const trace = a + d
      const det = a * d - b * c
      const disc = trace * trace - 4 * det

      const eigenInfo: string[] = [`Matrix: [[${a.toFixed(2)}, ${b.toFixed(2)}], [${c.toFixed(2)}, ${d.toFixed(2)}]]`]

      if (disc >= 0) {
        const l1 = (trace + Math.sqrt(disc)) / 2
        const l2 = (trace - Math.sqrt(disc)) / 2
        eigenInfo.push(`Eigenvalues: ${l1.toFixed(3)}, ${l2.toFixed(3)}`)

        // Eigenvectors
        const eigenvecs: [number, number][] = []
        for (const lam of [l1, l2]) {
          let vx: number, vy: number
          if (Math.abs(b) > 1e-9) {
            vx = b
            vy = lam - a
          } else if (Math.abs(c) > 1e-9) {
            vx = lam - d
            vy = c
          } else {
            vx = (Math.abs(lam - a) < 1e-9) ? 0 : 1
            vy = (Math.abs(lam - a) < 1e-9) ? 1 : 0
          }
          const mag = Math.sqrt(vx * vx + vy * vy)
          if (mag > 1e-9) {
            vx /= mag
            vy /= mag
          }
          eigenvecs.push([vx, vy])
        }

        // Draw eigenvector lines
        const colors: [number, number, number][] = [[250, 204, 21], [248, 113, 113]]
        eigenvecs.forEach(([vx, vy], i) => {
          const [clr] = [colors[i]]
          p.stroke(clr[0], clr[1], clr[2], 180)
          p.strokeWeight(2.5)
          const ext = 4
          const [x0, y0] = w2s(-vx * ext, -vy * ext)
          const [x1, y1] = w2s(vx * ext, vy * ext)
          p.line(x0, y0, x1, y1)

          // Show eigenvector on unit circle and its transform
          const [sx, sy] = w2s(vx, vy)
          p.fill(clr[0], clr[1], clr[2])
          p.noStroke()
          p.ellipse(sx, sy, 10, 10)

          const tx = a * vx + b * vy
          const ty = c * vx + d * vy
          const [stx, sty] = w2s(tx, ty)
          p.stroke(clr[0], clr[1], clr[2])
          p.strokeWeight(2)
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.setLineDash([4, 4])
          p.line(sx, sy, stx, sty)
          ctx.setLineDash([])
          p.fill(clr[0], clr[1], clr[2])
          p.noStroke()
          p.ellipse(stx, sty, 10, 10)
        })

        eigenInfo.push(`Eigenvector 1: [${eigenvecs[0][0].toFixed(3)}, ${eigenvecs[0][1].toFixed(3)}]`)
        eigenInfo.push(`Eigenvector 2: [${eigenvecs[1][0].toFixed(3)}, ${eigenvecs[1][1].toFixed(3)}]`)
      } else {
        const realPart = trace / 2
        const imagPart = Math.sqrt(-disc) / 2
        eigenInfo.push(`Eigenvalues: ${realPart.toFixed(3)} +/- ${imagPart.toFixed(3)}i (complex)`)
        eigenInfo.push('Complex eigenvalues = rotation component')
      }

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      eigenInfo.forEach((line, i) => {
        p.text(line, 14, 14 + i * 20)
      })

      // Legend
      p.fill(100, 116, 139)
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Gray circle = unit circle | Blue ellipse = transformed | Colored lines = eigenvector directions', p.width / 2, p.height - 8)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={400} />
      <div className="mt-2 flex flex-wrap gap-2 px-2">
        {matrices.map((m, i) => (
          <button
            key={m.name}
            onClick={() => setMatIdx(i)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              matIdx === i ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const matrixOpsCode = `import numpy as np

# Create matrices
A = np.array([[2, 1],
              [0, 3]])
B = np.array([[1, 4],
              [2, 1]])

print("A =")
print(A)
print("\\nB =")
print(B)

# Matrix multiplication
C = A @ B  # same as np.dot(A, B) for 2D
print("\\nA @ B =")
print(C)

# Determinant — area scale factor
print(f"\\ndet(A) = {np.linalg.det(A):.1f}")

# Inverse
A_inv = np.linalg.inv(A)
print(f"\\nA^-1 =\\n{A_inv}")
print(f"\\nA @ A^-1 =\\n{(A @ A_inv).round(2)}")

# Eigenvalues & eigenvectors
eigenvalues, eigenvectors = np.linalg.eig(A)
print(f"\\nEigenvalues: {eigenvalues}")
print(f"Eigenvectors (columns):\\n{eigenvectors}")

# Verify: A @ v = lambda * v
for i in range(len(eigenvalues)):
    v = eigenvectors[:, i]
    lam = eigenvalues[i]
    lhs = A @ v
    rhs = lam * v
    print(f"\\nA @ v{i+1} = {lhs.round(4)}")
    print(f"lambda{i+1} * v{i+1} = {rhs.round(4)}")
`

const mlMatrixCode = `import numpy as np

# In ML, a dataset is a matrix: rows = samples, columns = features
# A linear model computes: predictions = X @ weights + bias

np.random.seed(42)

# 5 samples, 3 features
X = np.random.randn(5, 3).round(2)
weights = np.array([0.5, -1.2, 0.8])
bias = 0.3

predictions = X @ weights + bias
print("Feature matrix X:")
print(X)
print(f"\\nWeights: {weights}")
print(f"Bias: {bias}")
print(f"\\nPredictions (X @ w + b): {predictions.round(3)}")

# Transpose — swap rows and columns
print(f"\\nX shape: {X.shape}")
print(f"X^T shape: {X.T.shape}")

# Covariance matrix — captures feature correlations
cov = (X.T @ X) / (X.shape[0] - 1)
print(f"\\nCovariance matrix (3x3):")
print(cov.round(3))
print("Diagonal = variances of each feature")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Matrices() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* Title */}
      <header>
        <h1 className="text-4xl font-bold text-white">Matrices &amp; Transformations</h1>
        <p className="mt-3 text-lg text-gray-300">
          A matrix is much more than a grid of numbers. It is a <em>machine</em> that transforms
          vectors — stretching, rotating, reflecting, projecting. Every linear model, every layer
          of a neural network, and every PCA decomposition is at its core a matrix multiplication.
        </p>
      </header>

      {/* Section 1 — Matrix as Transformation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">A Matrix Transforms Space</h2>
        <p className="text-gray-300">
          A 2&times;2 matrix <code className="text-sky-400">[[a, b], [c, d]]</code> transforms
          every point <code className="text-sky-400">(x, y)</code> in the plane to a new point.
          The entire grid warps, but straight lines stay straight and the origin stays fixed —
          that is what makes the transformation <em>linear</em>.
        </p>
        <p className="text-gray-300">
          Use the preset buttons or adjust the four matrix entries below to see how different
          matrices warp the grid. Watch how the unit square (blue region) and the two basis
          vectors change. The determinant tells you how much the area scales.
        </p>
        <MatrixGridSketch />
      </section>

      {/* Section 2 — Matrix Multiplication */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Matrix Multiplication, Step by Step</h2>
        <p className="text-gray-300">
          Matrix multiplication is the <strong className="text-white">composition</strong> of
          transformations. If A transforms space one way and B transforms it another, then
          A&times;B applies B first, then A. The entry C[i][j] is the dot product of A's i-th
          row and B's j-th column.
        </p>
        <p className="text-gray-300">
          Step through the multiplication below. At each step the highlighted row of A
          is dotted with the highlighted column of B to produce one entry of the result C.
        </p>
        <MatMulSketch />
      </section>

      {/* Section 3 — Rotation, Scale, Shear */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Rotation, Scaling &amp; Shear</h2>
        <p className="text-gray-300">
          Every 2D linear transformation can be understood as a combination of three primitives:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-gray-300">
          <li>
            <strong className="text-white">Scaling</strong> — stretches or compresses along
            axes. Matrix: <code className="text-sky-400">[[sx, 0], [0, sy]]</code>.
          </li>
          <li>
            <strong className="text-white">Rotation</strong> — rotates by angle &theta;.
            Matrix: <code className="text-sky-400">[[cos&theta;, -sin&theta;], [sin&theta;, cos&theta;]]</code>.
            Determinant is always 1.
          </li>
          <li>
            <strong className="text-white">Shear</strong> — tilts one axis while keeping the
            other fixed. Matrix: <code className="text-sky-400">[[1, k], [0, 1]]</code>.
          </li>
        </ul>
        <p className="text-gray-300">
          The <strong className="text-white">determinant</strong> of a matrix is the factor by
          which it scales areas. A determinant of 2 doubles all areas; a determinant of -1
          preserves area but flips orientation (like a mirror). A determinant of 0 means the
          matrix collapses space into a lower dimension — the transformation is not invertible.
        </p>
      </section>

      {/* Section 4 — Eigenvalues */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Eigenvalues &amp; Eigenvectors</h2>
        <p className="text-gray-300">
          An <strong className="text-white">eigenvector</strong> of a matrix A is a special
          direction that the matrix only stretches (or shrinks), never rotates. Formally:
          <code className="text-sky-400 mx-1">Av = &lambda;v</code>, where &lambda; (the
          eigenvalue) is the scaling factor.
        </p>
        <p className="text-gray-300">
          Below, the gray circle is the unit circle. The blue ellipse shows where the matrix
          sends it. The colored lines are eigenvector directions — notice how points on those
          lines get mapped to other points on the same line. Dots on eigenvectors get scaled
          by their eigenvalue, shown by the dashed connection.
        </p>
        <p className="text-gray-300">
          Eigenvalues are central to ML: PCA finds the eigenvectors of the covariance matrix,
          the power method computes PageRank, and the spectral gap determines how fast random
          walks mix.
        </p>
        <EigenSketch />
      </section>

      {/* Python 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Matrix Operations in NumPy</h2>
        <p className="text-gray-300">
          NumPy makes matrix operations concise. Use the <code className="text-sky-400">@</code>{' '}
          operator for multiplication, and <code className="text-sky-400">np.linalg</code> for
          decompositions, inverses, and eigenvalues.
        </p>
        <PythonCell defaultCode={matrixOpsCode} title="Matrix Operations" />
      </section>

      {/* Python 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Matrices in ML Pipelines</h2>
        <p className="text-gray-300">
          In machine learning, your dataset <em>is</em> a matrix. Each row is a sample, each
          column is a feature. A linear model is simply a matrix-vector product. The covariance
          matrix captures how features vary together — the starting point for PCA.
        </p>
        <PythonCell defaultCode={mlMatrixCode} title="Matrices in Machine Learning" />
      </section>

      {/* Summary */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>A matrix encodes a linear transformation: it maps vectors to vectors while preserving addition and scaling.</li>
          <li>Matrix multiplication composes transformations — order matters (AB != BA in general).</li>
          <li>The determinant measures area/volume scaling; zero determinant means information is lost.</li>
          <li>Eigenvectors are directions preserved by the transformation; eigenvalues are their scale factors.</li>
          <li>Datasets, model weights, and covariance are all matrices.</li>
        </ul>
      </section>
    </div>
  )
}
