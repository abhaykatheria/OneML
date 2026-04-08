import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/knn',
  title: 'K-Nearest Neighbors',
  description: 'Classify by proximity — the simplest ML algorithm that needs no training',
  track: 'classical',
  order: 5,
  tags: ['knn', 'classification', 'distance-metrics', 'curse-of-dimensionality'],
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
  [52, 211, 153],   // emerald (class 2)
]

function generateData(seed: number): DataPoint[] {
  const rng = makeRng(seed)
  const points: DataPoint[] = []
  // Class 0: upper-left cluster
  for (let i = 0; i < 25; i++) {
    points.push({ x: 0.25 + randn(rng) * 0.1, y: 0.3 + randn(rng) * 0.1, label: 0 })
  }
  // Class 1: lower-right cluster
  for (let i = 0; i < 25; i++) {
    points.push({ x: 0.7 + randn(rng) * 0.12, y: 0.7 + randn(rng) * 0.1, label: 1 })
  }
  // Some overlap in the middle
  for (let i = 0; i < 10; i++) {
    points.push({ x: 0.45 + randn(rng) * 0.08, y: 0.5 + randn(rng) * 0.08, label: 0 })
  }
  for (let i = 0; i < 10; i++) {
    points.push({ x: 0.55 + randn(rng) * 0.08, y: 0.5 + randn(rng) * 0.08, label: 1 })
  }
  return points
}

function euclideanDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function knnPredict(query: { x: number; y: number }, data: DataPoint[], k: number): number {
  const dists = data.map((pt, i) => ({ i, d: euclideanDist(query, pt) }))
  dists.sort((a, b) => a.d - b.d)
  const votes = [0, 0]
  for (let i = 0; i < Math.min(k, dists.length); i++) {
    votes[data[dists[i].i].label]++
  }
  return votes[0] >= votes[1] ? 0 : 1
}

/* ------------------------------------------------------------------ */
/* Section 2 — Interactive KNN Query                                   */
/* ------------------------------------------------------------------ */

function KNNQuerySketch() {
  const [k, setK] = useState(5)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateData(42)
      let queryPt: { x: number; y: number } | null = null
      let neighbors: number[] = []
      let prediction = -1

      function toScreen(nx: number, ny: number): [number, number] {
        const margin = 40
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      function toNorm(sx: number, sy: number): [number, number] {
        const margin = 40
        return [
          (sx - margin) / (p.width - 2 * margin),
          (sy - margin) / (p.height - 2 * margin),
        ]
      }

      function updateQuery() {
        if (!queryPt) return
        const dists = data.map((pt, i) => ({ i, d: euclideanDist(queryPt!, pt) }))
        dists.sort((a, b) => a.d - b.d)
        neighbors = dists.slice(0, k).map((d) => d.i)
        const votes = [0, 0]
        for (const idx of neighbors) votes[data[idx].label]++
        prediction = votes[0] >= votes[1] ? 0 : 1
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 420)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Draw data points
        for (let i = 0; i < data.length; i++) {
          const [sx, sy] = toScreen(data[i].x, data[i].y)
          const [r, g, b] = CLASS_COLORS[data[i].label]
          const isNeighbor = neighbors.includes(i)

          if (isNeighbor) {
            // Draw connecting line to query
            if (queryPt) {
              const [qx, qy] = toScreen(queryPt.x, queryPt.y)
              p.stroke(r, g, b, 100)
              p.strokeWeight(1.5)
              p.line(qx, qy, sx, sy)
            }
            p.noStroke()
            p.fill(r, g, b, 60)
            p.ellipse(sx, sy, 22, 22)
          }

          p.noStroke()
          p.fill(r, g, b, 200)
          p.ellipse(sx, sy, 10, 10)
        }

        // Draw query point
        if (queryPt) {
          const [qx, qy] = toScreen(queryPt.x, queryPt.y)
          const [pr, pg, pb] = prediction >= 0 ? CLASS_COLORS[prediction] : [255, 255, 255]

          // Prediction halo
          p.noStroke()
          p.fill(pr, pg, pb, 40)
          p.ellipse(qx, qy, 30, 30)

          // Query point itself
          p.stroke(255)
          p.strokeWeight(2)
          p.fill(pr, pg, pb)
          p.ellipse(qx, qy, 14, 14)

          // Label
          p.noStroke()
          p.fill(255)
          p.textSize(12)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`Prediction: Class ${prediction}`, qx + 16, qy - 6)
          p.fill(148, 163, 184)
          p.text(`(${k} nearest neighbors)`, qx + 16, qy + 10)
        }

        // Instructions
        p.noStroke()
        p.fill(100, 116, 139)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Click anywhere to place a query point', 10, 10)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`K = ${k}`, p.width - 10, 10)

        // Legend
        p.textAlign(p.LEFT, p.BOTTOM)
        for (let c = 0; c < 2; c++) {
          const [r, g, b] = CLASS_COLORS[c]
          p.fill(r, g, b)
          p.ellipse(15, p.height - 25 + c * 18, 8, 8)
          p.fill(148, 163, 184)
          p.textSize(11)
          p.text(`Class ${c}`, 24, p.height - 19 + c * 18)
        }
      }

      p.mousePressed = () => {
        if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
          const [nx, ny] = toNorm(p.mouseX, p.mouseY)
          queryPt = { x: nx, y: ny }
          updateQuery()
        }
      }
    },
    [k],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            K (neighbors):
            <input
              type="range"
              min={1}
              max={25}
              step={2}
              value={k}
              onChange={(e) => setK(parseInt(e.target.value))}
              className="w-40"
            />
            <span className="w-6 font-mono">{k}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Decision Boundary                                       */
/* ------------------------------------------------------------------ */

function KNNBoundarySketch() {
  const [k, setK] = useState(5)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateData(42)
      const resolution = 6

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 420)
        p.noLoop()
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 40
        const plotW = p.width - 2 * margin
        const plotH = p.height - 2 * margin

        // Draw decision regions
        p.noStroke()
        for (let px = 0; px < plotW; px += resolution) {
          for (let py = 0; py < plotH; py += resolution) {
            const nx = px / plotW
            const ny = py / plotH
            const pred = knnPredict({ x: nx, y: ny }, data, k)
            const [r, g, b] = CLASS_COLORS[pred]
            p.fill(r, g, b, 35)
            p.rect(margin + px, margin + py, resolution, resolution)
          }
        }

        // Draw boundary contour by checking adjacent cells
        for (let px = 0; px < plotW - resolution; px += resolution) {
          for (let py = 0; py < plotH - resolution; py += resolution) {
            const nx = px / plotW
            const ny = py / plotH
            const pred = knnPredict({ x: nx, y: ny }, data, k)
            const predR = knnPredict({ x: (px + resolution) / plotW, y: ny }, data, k)
            const predD = knnPredict({ x: nx, y: (py + resolution) / plotH }, data, k)
            if (pred !== predR || pred !== predD) {
              p.fill(255, 255, 255, 40)
              p.rect(margin + px, margin + py, resolution, resolution)
            }
          }
        }

        // Data points
        for (const pt of data) {
          const sx = margin + pt.x * plotW
          const sy = margin + pt.y * plotH
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.stroke(15, 23, 42)
          p.strokeWeight(1)
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 8, 8)
        }

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`KNN Decision Boundary (K = ${k})`, p.width / 2, 8)

        // Annotation
        p.fill(100, 116, 139)
        p.textSize(11)
        p.textAlign(p.LEFT, p.BOTTOM)
        if (k === 1) {
          p.text('K=1: Jagged boundary, overfitting to noise', 10, p.height - 8)
        } else if (k >= 20) {
          p.text('Large K: Very smooth, potentially underfitting', 10, p.height - 8)
        } else {
          p.text('Moderate K: Balanced boundary complexity', 10, p.height - 8)
        }
      }
    },
    [k],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            K:
            <input
              type="range"
              min={1}
              max={35}
              step={2}
              value={k}
              onChange={(e) => { setK(parseInt(e.target.value)) }}
              className="w-48"
            />
            <span className="w-6 font-mono">{k}</span>
          </label>
          <span className="ml-auto text-xs text-gray-500">
            {k === 1 ? 'Overfitting' : k >= 20 ? 'Underfitting' : 'Balanced'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Distance Metric Shapes                                  */
/* ------------------------------------------------------------------ */

function DistanceMetricSketch() {
  const [metric, setMetric] = useState<'euclidean' | 'manhattan' | 'minkowski'>('euclidean')
  const [minkP, setMinkP] = useState(3)

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 360)
        p.noLoop()
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const cx = p.width / 2
        const cy = p.height / 2
        const scale = 120

        // Draw concentric "circles" of equal distance
        const radii = [0.3, 0.6, 0.9, 1.2]

        for (const radius of radii) {
          p.stroke(99, 102, 241, 60 + radius * 80)
          p.strokeWeight(1.5)
          p.noFill()
          p.beginShape()

          const steps = 200
          for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * p.TWO_PI
            let dx: number, dy: number

            if (metric === 'euclidean') {
              dx = radius * Math.cos(theta)
              dy = radius * Math.sin(theta)
            } else if (metric === 'manhattan') {
              // |dx| + |dy| = radius => parametric form
              const ct = Math.cos(theta)
              const st = Math.sin(theta)
              const norm = Math.abs(ct) + Math.abs(st)
              dx = (ct / norm) * radius
              dy = (st / norm) * radius
            } else {
              // Minkowski: (|dx|^p + |dy|^p)^(1/p) = radius
              const ct = Math.cos(theta)
              const st = Math.sin(theta)
              const norm = (Math.abs(ct) ** minkP + Math.abs(st) ** minkP) ** (1 / minkP)
              dx = (ct / norm) * radius
              dy = (st / norm) * radius
            }

            p.vertex(cx + dx * scale, cy + dy * scale)
          }
          p.endShape(p.CLOSE)
        }

        // Center point
        p.noStroke()
        p.fill(255)
        p.ellipse(cx, cy, 8, 8)

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(0.5)
        p.line(cx - scale * 1.5, cy, cx + scale * 1.5, cy)
        p.line(cx, cy - scale * 1.5, cx, cy + scale * 1.5)

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        const title =
          metric === 'euclidean'
            ? 'Euclidean Distance (L2) — Circles'
            : metric === 'manhattan'
              ? 'Manhattan Distance (L1) — Diamonds'
              : `Minkowski Distance (p=${minkP}) — Rounded Shape`
        p.text(title, p.width / 2, 12)

        // Distance labels
        p.fill(99, 102, 241, 180)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        for (let i = 0; i < radii.length; i++) {
          p.text(`d = ${radii[i].toFixed(1)}`, cx + radii[i] * scale + 6, cy)
        }
      }
    },
    [metric, minkP],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={360}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Metric:
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as 'euclidean' | 'manhattan' | 'minkowski')}
              className="rounded bg-gray-800 px-2 py-1 text-gray-200"
            >
              <option value="euclidean">Euclidean (L2)</option>
              <option value="manhattan">Manhattan (L1)</option>
              <option value="minkowski">Minkowski (Lp)</option>
            </select>
          </label>
          {metric === 'minkowski' && (
            <label className="flex items-center gap-2">
              p:
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={minkP}
                onChange={(e) => setMinkP(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="w-8 font-mono">{minkP}</span>
            </label>
          )}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 5 — Curse of Dimensionality                                 */
/* ------------------------------------------------------------------ */

function CurseDimensionalitySketch() {
  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 600
      p.createCanvas(pw, 340)
      p.noLoop()
    }

    p.draw = () => {
      p.background(15, 23, 42)

      const margin = 60
      const plotW = p.width - margin * 2
      const plotH = p.height - margin * 2

      // Simulated ratio of (max distance / min distance) vs dimensionality
      // In high-d, this ratio approaches 1 — all points become equidistant
      const dims = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000]
      // Theoretical approximation: ratio ~ 1 + c / sqrt(d)
      const ratios = dims.map((d) => 1 + 2.5 / Math.sqrt(d))

      const maxDim = 1000
      const maxRatio = 3.8

      function mx(d: number): number {
        return margin + (Math.log10(d) / Math.log10(maxDim)) * plotW
      }
      function my(r: number): number {
        return p.height - margin - ((r - 1) / (maxRatio - 1)) * plotH
      }

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(0.5)
      for (const d of [1, 10, 100, 1000]) {
        p.line(mx(d), margin, mx(d), p.height - margin)
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin, p.height - margin, p.width - margin, p.height - margin)
      p.line(margin, margin, margin, p.height - margin)

      // Labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Dimensionality (log scale)', p.width / 2, p.height - 18)

      p.push()
      p.translate(16, p.height / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Max dist / Min dist', 0, 0)
      p.pop()

      // X ticks
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.fill(100, 116, 139)
      for (const d of [1, 10, 100, 1000]) {
        p.text(d.toString(), mx(d), p.height - margin + 6)
      }

      // Curve
      p.noFill()
      p.stroke(239, 68, 68)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let i = 0; i < dims.length; i++) {
        p.vertex(mx(dims[i]), my(ratios[i]))
      }
      p.endShape()

      // Points
      p.noStroke()
      for (let i = 0; i < dims.length; i++) {
        p.fill(239, 68, 68)
        p.ellipse(mx(dims[i]), my(ratios[i]), 7, 7)
      }

      // Reference line at ratio = 1
      p.stroke(250, 204, 21, 100)
      p.strokeWeight(1)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.line(margin, my(1), p.width - margin, my(1))
      ctx.setLineDash([])

      p.noStroke()
      p.fill(250, 204, 21)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Ratio = 1 (all points equidistant)', margin + 4, my(1) - 4)

      // Annotation
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.RIGHT, p.TOP)
      p.text('As dimensions grow, distances converge', p.width - margin, margin + 4)
      p.text('and KNN loses its discriminative power', p.width - margin, margin + 18)
    }
  }, [])

  return <P5Sketch sketch={sketch} height={340} />
}

/* ------------------------------------------------------------------ */
/* Section 6 — Accuracy vs K                                           */
/* ------------------------------------------------------------------ */

function AccuracyVsKSketch() {
  const sketch = useCallback((p: p5) => {
    // Simulated accuracy curves
    const kValues = [1, 3, 5, 7, 9, 11, 13, 15, 19, 25, 31, 41, 51]
    const trainAcc = [1.0, 0.96, 0.93, 0.91, 0.90, 0.89, 0.88, 0.87, 0.86, 0.84, 0.82, 0.78, 0.74]
    const testAcc = [0.82, 0.88, 0.91, 0.92, 0.91, 0.90, 0.89, 0.88, 0.87, 0.85, 0.82, 0.77, 0.72]

    let animProgress = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 600
      p.createCanvas(pw, 360)
      animProgress = 0
    }

    p.draw = () => {
      p.background(15, 23, 42)
      animProgress = Math.min(1, animProgress + 0.008)

      const margin = 60
      const plotW = p.width - margin * 2
      const plotH = p.height - margin * 2

      function mx(k: number): number {
        return margin + ((k - 1) / 50) * plotW
      }
      function my(acc: number): number {
        return p.height - margin - ((acc - 0.6) / 0.45) * plotH
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin, p.height - margin, p.width - margin, p.height - margin)
      p.line(margin, margin, margin, p.height - margin)

      // Labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('K (number of neighbors)', p.width / 2, p.height - 18)

      p.push()
      p.translate(16, p.height / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Accuracy', 0, 0)
      p.pop()

      // Y ticks
      p.textSize(10)
      p.textAlign(p.RIGHT, p.CENTER)
      p.fill(100, 116, 139)
      for (let acc = 0.65; acc <= 1.0; acc += 0.05) {
        p.text(acc.toFixed(2), margin - 6, my(acc))
        p.stroke(30, 41, 59)
        p.strokeWeight(0.3)
        p.line(margin, my(acc), p.width - margin, my(acc))
        p.noStroke()
      }

      // X ticks
      p.textAlign(p.CENTER, p.TOP)
      for (const k of [1, 5, 11, 21, 31, 41, 51]) {
        p.fill(100, 116, 139)
        p.text(k.toString(), mx(k), p.height - margin + 6)
      }

      const nVisible = Math.ceil(kValues.length * animProgress)

      // Train accuracy curve
      p.noFill()
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.beginShape()
      for (let i = 0; i < nVisible; i++) {
        p.vertex(mx(kValues[i]), my(trainAcc[i]))
      }
      p.endShape()

      // Test accuracy curve
      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.beginShape()
      for (let i = 0; i < nVisible; i++) {
        p.vertex(mx(kValues[i]), my(testAcc[i]))
      }
      p.endShape()

      // Points
      p.noStroke()
      for (let i = 0; i < nVisible; i++) {
        p.fill(99, 102, 241)
        p.ellipse(mx(kValues[i]), my(trainAcc[i]), 6, 6)
        p.fill(52, 211, 153)
        p.ellipse(mx(kValues[i]), my(testAcc[i]), 6, 6)
      }

      // Optimal K marker
      if (animProgress > 0.4) {
        const optIdx = 3 // K=7
        const alpha = Math.min(255, (animProgress - 0.4) * 400)
        p.stroke(250, 204, 21, alpha)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([4, 4])
        p.line(mx(kValues[optIdx]), margin, mx(kValues[optIdx]), p.height - margin)
        ctx.setLineDash([])

        p.noStroke()
        p.fill(250, 204, 21, alpha)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Best K', mx(kValues[optIdx]) + 6, margin + 8)
      }

      // Legend
      p.noStroke()
      const lx = p.width - margin - 100
      const ly = margin + 10
      p.fill(99, 102, 241)
      p.ellipse(lx, ly, 8, 8)
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Train accuracy', lx + 10, ly)
      p.fill(52, 211, 153)
      p.ellipse(lx, ly + 18, 8, 8)
      p.fill(148, 163, 184)
      p.text('Test accuracy', lx + 10, ly + 18)

      // Overfitting / Underfitting labels
      if (animProgress > 0.8) {
        p.fill(148, 163, 184, 150)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Overfitting', mx(1) + 20, p.height - margin - 4)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Underfitting', mx(45), margin + 4)
      }
    }
  }, [])

  return <P5Sketch sketch={sketch} height={360} />
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function KNN() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1 — The Simplest Idea in ML ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">1. The Simplest Idea in ML</h2>
        <p className="mb-4 leading-relaxed">
          Imagine you move to a new city and want to know if a neighborhood is safe. What do you do?
          You look at the <span className="text-white font-semibold">nearest houses</span> and check
          what they are like. If most nearby houses are well-maintained and in a good area, you conclude
          yours probably is too. That is the entire idea behind K-Nearest Neighbors.
        </p>
        <p className="mb-4 leading-relaxed">
          KNN is a <span className="text-white font-semibold">lazy learner</span> — it does absolutely
          no work during &ldquo;training.&rdquo; It simply memorizes the entire dataset. When a new
          data point arrives, KNN finds the K closest training examples and lets them vote on the
          answer. For classification, the majority class wins. For regression, it takes the average
          of the neighbors&apos; values.
        </p>
        <p className="mb-4 leading-relaxed">
          This extreme simplicity makes KNN a perfect starting point for understanding classification.
          But it also brings real trade-offs: KNN is slow at prediction time (it must scan all training
          data), it is sensitive to the choice of K and the distance metric, and it breaks down
          spectacularly in high dimensions. We will explore all of these phenomena interactively.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Key Properties</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Instance-based:</span> No model is learned — the training data IS the model</li>
            <li><span className="text-white">Non-parametric:</span> Makes no assumptions about the data distribution</li>
            <li><span className="text-white">Lazy:</span> All computation deferred to prediction time</li>
            <li><span className="text-white">Universal approximator:</span> Given enough data, KNN can approximate any function</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 2 — How KNN Works ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">2. How KNN Works</h2>
        <p className="mb-4 leading-relaxed">
          The visualization below shows a 2D scatter plot with two classes (indigo and red). Click
          anywhere on the canvas to place a <span className="text-white font-semibold">query point</span>.
          KNN will find the K nearest training points, draw lines connecting them to your query, and
          display the majority vote prediction.
        </p>
        <p className="mb-4 leading-relaxed">
          Try placing your query point in different regions: deep inside a cluster, on the boundary
          between classes, or in empty space far from all data. Use the slider to change K. With K=1
          the prediction is determined by a single nearest neighbor — highly sensitive to noise. As K
          increases, the vote aggregates more neighbors and the prediction becomes more stable but may
          lose local detail.
        </p>
        <KNNQuerySketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">The KNN Algorithm</h3>
          <ol className="list-decimal space-y-1 pl-5 text-gray-300">
            <li>Store the entire training dataset (no model fitting).</li>
            <li>Given a new query point, compute its distance to every training point.</li>
            <li>Sort by distance and select the K nearest neighbors.</li>
            <li>For classification: return the majority class among the K neighbors.</li>
            <li>For regression: return the mean (or weighted mean) of the K neighbors&apos; values.</li>
          </ol>
        </div>
      </section>

      {/* ========== Section 3 — Decision Boundaries ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">3. Decision Boundaries</h2>
        <p className="mb-4 leading-relaxed">
          The <span className="text-white font-semibold">decision boundary</span> is the surface
          in feature space where the classifier switches from predicting one class to another. For
          KNN, the boundary shape depends directly on K. Below, the colored regions show where KNN
          would predict each class. The white highlighting marks the boundary itself.
        </p>
        <p className="mb-4 leading-relaxed">
          Drag the K slider from 1 to 35 and watch the boundary transform. At K=1, the boundary is
          extremely jagged — it wraps tightly around individual points, including noisy ones. This is
          <span className="text-white font-semibold"> overfitting</span>: the model captures noise
          rather than signal. As K increases, the boundary smooths out because more neighbors must agree,
          washing out the influence of single outliers. But push K too high and the boundary becomes
          overly smooth — it <span className="text-white font-semibold">underfits</span>, ignoring
          real patterns in the data.
        </p>
        <KNNBoundarySketch />
        <p className="mt-4 leading-relaxed text-gray-400">
          Notice the critical trade-off: small K gives a complex boundary with low bias but high
          variance. Large K gives a smooth boundary with high bias but low variance. The optimal K
          balances these two forces.
        </p>
      </section>

      {/* ========== Section 4 — Distance Metrics ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">4. Distance Metrics</h2>
        <p className="mb-4 leading-relaxed">
          KNN is entirely defined by what &ldquo;nearest&rdquo; means, so the choice of distance
          metric is critical. The visualization below shows the shape of equal-distance contours
          under different metrics. Points on the same contour are all considered equidistant from the
          center.
        </p>
        <p className="mb-4 leading-relaxed">
          <span className="text-white font-semibold">Euclidean distance (L2)</span> produces familiar
          circles — it treats all directions equally. <span className="text-white font-semibold">Manhattan
          distance (L1)</span> measures distance along axes only (like navigating a grid of city blocks),
          producing diamond-shaped contours. <span className="text-white font-semibold">Minkowski
          distance</span> generalizes both: p=1 is Manhattan, p=2 is Euclidean, and larger p values
          approach the Chebyshev (max-coordinate) distance, making contours increasingly square.
        </p>
        <DistanceMetricSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Which Metric to Use?</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Euclidean:</span> Default choice. Works well when features have similar scales.</li>
            <li><span className="text-white">Manhattan:</span> Better when features are on different scales or when high-dimensional.</li>
            <li><span className="text-white">Cosine similarity:</span> Popular for text data where direction matters more than magnitude.</li>
            <li>Always <span className="text-white">normalize your features</span> before using KNN — otherwise, features with larger ranges dominate the distance.</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 5 — Curse of Dimensionality ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">5. The Curse of Dimensionality</h2>
        <p className="mb-4 leading-relaxed">
          KNN works beautifully in low dimensions (2D, 3D), but it has a fundamental weakness that
          gets exponentially worse as dimensionality increases. The problem is both geometric and
          statistical, and it dooms all distance-based methods in high-dimensional spaces.
        </p>
        <p className="mb-4 leading-relaxed">
          The core insight is this: in high dimensions, <span className="text-white font-semibold">all
          points become roughly equidistant from each other</span>. The ratio of the farthest distance
          to the nearest distance converges to 1. When all points are equally far away, the concept of
          &ldquo;nearest neighbor&rdquo; becomes meaningless — your K &ldquo;nearest&rdquo; neighbors
          are barely closer than the K farthest points.
        </p>
        <CurseDimensionalitySketch />
        <p className="mt-4 leading-relaxed">
          The chart above shows the ratio of maximum to minimum pairwise distance as dimensionality
          increases. In 2D the ratio is large (clear separation between near and far points). By 100+
          dimensions, it approaches 1.0 — all distances are nearly identical.
        </p>
        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">Why Does This Happen?</h3>
        <p className="mb-4 leading-relaxed">
          Consider a unit hypercube in d dimensions. To capture 10% of the data volume, you need a
          neighborhood that extends 0.1<sup>1/d</sup> along each axis. In 2D that is 0.316 (about a
          third of the range). In 100D it is 0.977 — you need to cover 97.7% of each axis just to
          capture 10% of the volume! The space is so vast that local neighborhoods must be enormous,
          destroying any notion of locality.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Practical Implications</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li>KNN rarely works well beyond ~20 features without dimensionality reduction.</li>
            <li>Use PCA, feature selection, or embeddings to reduce dimensions before KNN.</li>
            <li>The amount of data needed grows exponentially with dimensionality.</li>
            <li>Manhattan distance degrades more gracefully than Euclidean in high-d.</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 6 — Choosing K ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">6. Choosing K</h2>
        <p className="mb-4 leading-relaxed">
          The value of K is a <span className="text-white font-semibold">hyperparameter</span> — you
          must choose it before running KNN. There is no formula for the optimal K; it depends on the
          data. But we can use the training-vs-test accuracy curves to guide our choice.
        </p>
        <p className="mb-4 leading-relaxed">
          The animated chart below shows two curves. The <span className="text-indigo-400">indigo
          curve</span> is training accuracy and the <span className="text-emerald-400">green
          curve</span> is test accuracy. At K=1, training accuracy is perfect (each point is its own
          nearest neighbor), but test accuracy is lower — classic overfitting. As K grows, training
          accuracy drops while test accuracy initially improves, peaks, then also declines. The peak
          of the test curve marks the optimal K.
        </p>
        <AccuracyVsKSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Rules of Thumb</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li>Use <span className="text-white">cross-validation</span> to find the best K.</li>
            <li>K = sqrt(N) is a common starting point (N is the number of training samples).</li>
            <li>Use <span className="text-white">odd K</span> for binary classification to avoid ties.</li>
            <li>Weighted KNN (closer neighbors get more vote weight) can smooth the K sensitivity.</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 7 — Python: KNN from Scratch ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">7. KNN from Scratch</h2>
        <p className="mb-4 leading-relaxed">
          Let us implement KNN from scratch with NumPy, then compare to scikit-learn. The key
          operation is computing all pairwise distances between query points and training data,
          then selecting the K smallest for each query.
        </p>
        <PythonCell
          title="KNN from scratch and with sklearn"
          defaultCode={`import numpy as np

# Generate sample data: two clusters
np.random.seed(42)
X_train = np.vstack([
    np.random.randn(30, 2) * 0.8 + [2, 2],   # class 0
    np.random.randn(30, 2) * 0.8 + [5, 5],   # class 1
])
y_train = np.array([0]*30 + [1]*30)

X_test = np.array([[3.5, 3.5], [1.0, 1.5], [5.5, 6.0], [3.8, 4.2]])

# --- KNN from scratch ---
def knn_predict(X_train, y_train, X_test, k=5):
    # Compute all pairwise distances
    # (n_test, 1, 2) - (1, n_train, 2) -> (n_test, n_train)
    diffs = X_test[:, np.newaxis, :] - X_train[np.newaxis, :, :]
    dists = np.sqrt((diffs ** 2).sum(axis=2))

    # For each test point, find K nearest
    nn_indices = np.argsort(dists, axis=1)[:, :k]
    nn_labels = y_train[nn_indices]

    # Majority vote
    preds = []
    for labels in nn_labels:
        counts = np.bincount(labels, minlength=2)
        preds.append(np.argmax(counts))
    return np.array(preds)

preds_scratch = knn_predict(X_train, y_train, X_test, k=5)
print("KNN from scratch predictions:", preds_scratch)

# --- Compare with sklearn ---
from sklearn.neighbors import KNeighborsClassifier
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(X_train, y_train)
preds_sklearn = knn.predict(X_test)
print("sklearn KNN predictions:     ", preds_sklearn)
print("Match:", np.array_equal(preds_scratch, preds_sklearn))

# Cross-validation to find best K
from sklearn.model_selection import cross_val_score
print("\\nCross-validation accuracy for different K:")
for k in [1, 3, 5, 7, 11, 15, 21]:
    scores = cross_val_score(
        KNeighborsClassifier(n_neighbors=k),
        X_train, y_train, cv=5, scoring='accuracy'
    )
    print(f"  K={k:2d}: {scores.mean():.3f} +/- {scores.std():.3f}")
`}
        />
      </section>

      {/* ========== Section 8 — Python: Decision Boundaries ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">8. Visualizing Decision Boundaries</h2>
        <p className="mb-4 leading-relaxed">
          This code generates the classic KNN decision boundary plot for three different K values.
          You will see how the boundary shape changes from jagged (K=1, overfitting) to smooth
          (K=25, underfitting), with an optimal middle ground.
        </p>
        <PythonCell
          title="KNN decision boundaries for different K"
          defaultCode={`import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.datasets import make_moons

# Generate a more interesting dataset (two interleaved half-moons)
X, y = make_moons(n_samples=200, noise=0.25, random_state=42)

# Test different K values
k_values = [1, 7, 25]
print("Decision boundary analysis for make_moons dataset:")
print(f"Training samples: {len(X)}")
print()

for k in k_values:
    knn = KNeighborsClassifier(n_neighbors=k)
    knn.fit(X, y)

    # Compute accuracy on a grid to measure boundary complexity
    h = 0.05
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(
        np.arange(x_min, x_max, h),
        np.arange(y_min, y_max, h)
    )
    grid_points = np.c_[xx.ravel(), yy.ravel()]
    Z = knn.predict(grid_points)

    # Count boundary transitions (measure of complexity)
    Z_grid = Z.reshape(xx.shape)
    transitions = 0
    for i in range(Z_grid.shape[0] - 1):
        for j in range(Z_grid.shape[1] - 1):
            if Z_grid[i, j] != Z_grid[i+1, j]:
                transitions += 1
            if Z_grid[i, j] != Z_grid[i, j+1]:
                transitions += 1

    train_acc = knn.score(X, y)
    print(f"K={k:2d}: train accuracy={train_acc:.3f}, "
          f"boundary transitions={transitions} "
          f"({'complex/overfitting' if k==1 else 'smooth/underfitting' if k==25 else 'balanced'})")

# Weighted KNN comparison
from sklearn.model_selection import cross_val_score
print("\\nUniform vs Distance-weighted KNN (5-fold CV):")
for weights in ['uniform', 'distance']:
    scores = cross_val_score(
        KNeighborsClassifier(n_neighbors=7, weights=weights),
        X, y, cv=5
    )
    print(f"  weights='{weights}': {scores.mean():.3f} +/- {scores.std():.3f}")
`}
        />
      </section>
    </article>
  )
}
