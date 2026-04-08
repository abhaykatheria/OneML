import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/pca',
  title: 'PCA & Dimensionality Reduction',
  description: 'Find the directions of maximum variance and reduce dimensions while preserving information',
  track: 'classical',
  order: 11,
  tags: ['pca', 'dimensionality-reduction', 'eigenvalues', 'tsne'],
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
/* Section 1 — PCA Axes Visualization                                  */
/* ------------------------------------------------------------------ */

function PCAAxesSketch() {
  const [rotation, setRotation] = useState(0)
  const [showPCs, setShowPCs] = useState(true)

  const sketch = useCallback(
    (p: p5) => {
      const rng = makeRng(42)
      // Generate correlated 2D data
      const N = 80
      const rawPoints: [number, number][] = []
      for (let i = 0; i < N; i++) {
        const x = randn(rng) * 2.0
        const y = 0.7 * x + randn(rng) * 0.6 // correlated
        rawPoints.push([x, y])
      }

      // Compute PCA analytically
      const meanX = rawPoints.reduce((s, p) => s + p[0], 0) / N
      const meanY = rawPoints.reduce((s, p) => s + p[1], 0) / N
      const centered = rawPoints.map(([x, y]) => [x - meanX, y - meanY] as [number, number])

      let cov00 = 0, cov01 = 0, cov11 = 0
      for (const [x, y] of centered) {
        cov00 += x * x
        cov01 += x * y
        cov11 += y * y
      }
      cov00 /= N; cov01 /= N; cov11 /= N

      // Eigenvalues & eigenvectors of 2x2 symmetric matrix
      const trace = cov00 + cov11
      const det = cov00 * cov11 - cov01 * cov01
      const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det))
      const lam1 = trace / 2 + disc
      const lam2 = trace / 2 - disc

      // Eigenvector for lam1
      let ev1x = cov01
      let ev1y = lam1 - cov00
      const len1 = Math.sqrt(ev1x * ev1x + ev1y * ev1y) || 1
      ev1x /= len1; ev1y /= len1

      // PC2 is perpendicular
      const ev2x = -ev1y
      const ev2y = ev1x

      const pcAngle = Math.atan2(ev1y, ev1x)
      const totalVar = lam1 + lam2
      const var1Pct = ((lam1 / totalVar) * 100).toFixed(1)
      const var2Pct = ((lam2 / totalVar) * 100).toFixed(1)

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 450)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const cx = p.width / 2
        const cy = p.height / 2
        const scale = 55

        // Interpolate rotation: 0 = original axes, 1 = PC axes
        const currentAngle = rotation * pcAngle

        // Draw grid
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        for (let i = -5; i <= 5; i++) {
          const cos = Math.cos(currentAngle)
          const sin = Math.sin(currentAngle)
          // Horizontal lines in rotated frame
          const hx1 = cx + (-5 * cos - i * sin) * scale
          const hy1 = cy + (-5 * sin + i * cos) * scale
          const hx2 = cx + (5 * cos - i * sin) * scale
          const hy2 = cy + (5 * sin + i * cos) * scale
          p.line(hx1, hy1, hx2, hy2)
          // Vertical lines in rotated frame
          const vx1 = cx + (i * cos - (-5) * sin) * scale
          const vy1 = cy + (i * sin + (-5) * cos) * scale
          const vx2 = cx + (i * cos - 5 * sin) * scale
          const vy2 = cy + (i * sin + 5 * cos) * scale
          p.line(vx1, vy1, vx2, vy2)
        }

        // Rotated axes
        p.stroke(71, 85, 105)
        p.strokeWeight(2)
        const cos = Math.cos(currentAngle)
        const sin = Math.sin(currentAngle)
        p.line(cx - cos * 250, cy - sin * 250, cx + cos * 250, cy + sin * 250)
        p.line(cx + sin * 250, cy - cos * 250, cx - sin * 250, cy + cos * 250)

        // PC arrows (always shown if toggled)
        if (showPCs) {
          // PC1
          p.stroke(234, 67, 53)
          p.strokeWeight(3)
          const arrowLen1 = Math.sqrt(lam1) * scale * 2
          const ax1 = cx + ev1x * arrowLen1
          const ay1 = cy + ev1y * arrowLen1
          p.line(cx, cy, ax1, ay1)
          // Arrowhead
          const headSize = 8
          const angle1 = Math.atan2(ev1y, ev1x)
          p.fill(234, 67, 53)
          p.noStroke()
          p.triangle(
            ax1, ay1,
            ax1 - headSize * Math.cos(angle1 - 0.4), ay1 - headSize * Math.sin(angle1 - 0.4),
            ax1 - headSize * Math.cos(angle1 + 0.4), ay1 - headSize * Math.sin(angle1 + 0.4),
          )

          // PC2
          p.stroke(66, 133, 244)
          p.strokeWeight(3)
          const arrowLen2 = Math.sqrt(lam2) * scale * 2
          const ax2 = cx + ev2x * arrowLen2
          const ay2 = cy + ev2y * arrowLen2
          p.line(cx, cy, ax2, ay2)
          p.fill(66, 133, 244)
          p.noStroke()
          const angle2 = Math.atan2(ev2y, ev2x)
          p.triangle(
            ax2, ay2,
            ax2 - headSize * Math.cos(angle2 - 0.4), ay2 - headSize * Math.sin(angle2 - 0.4),
            ax2 - headSize * Math.cos(angle2 + 0.4), ay2 - headSize * Math.sin(angle2 + 0.4),
          )
        }

        // Data points
        p.noStroke()
        for (const [x, y] of centered) {
          p.fill(168, 85, 247, 180)
          p.ellipse(cx + x * scale, cy + y * scale, 7, 7)
        }

        // Legend
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        if (showPCs) {
          p.fill(234, 67, 53)
          p.text(`PC1 (${var1Pct}% variance)`, 15, 15)
          p.fill(66, 133, 244)
          p.text(`PC2 (${var2Pct}% variance)`, 15, 35)
        }

        p.fill(148, 163, 184)
        p.textSize(11)
        const angleLabel = rotation === 0 ? 'Original axes' : rotation === 1 ? 'PC-aligned axes' : `Rotating (${(rotation * 100).toFixed(0)}%)`
        p.text(angleLabel, 15, p.height - 25)
      }
    },
    [rotation, showPCs],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={450}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Rotate to PCs:
            <input type="range" min={0} max={1} step={0.02} value={rotation}
              onChange={(e) => setRotation(parseFloat(e.target.value))} className="w-40" />
            <span className="w-12 font-mono">{(rotation * 100).toFixed(0)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showPCs} onChange={(e) => setShowPCs(e.target.checked)} />
            Show PC arrows
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Projection onto PC1                                     */
/* ------------------------------------------------------------------ */

function ProjectionSketch() {
  const [projAmount, setProjAmount] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const rng = makeRng(42)
      const N = 60
      const rawPoints: [number, number][] = []
      for (let i = 0; i < N; i++) {
        const x = randn(rng) * 2.0
        const y = 0.7 * x + randn(rng) * 0.6
        rawPoints.push([x, y])
      }

      const meanX = rawPoints.reduce((s, p) => s + p[0], 0) / N
      const meanY = rawPoints.reduce((s, p) => s + p[1], 0) / N
      const centered = rawPoints.map(([x, y]) => [x - meanX, y - meanY] as [number, number])

      // PCA
      let cov00 = 0, cov01 = 0, cov11 = 0
      for (const [x, y] of centered) {
        cov00 += x * x; cov01 += x * y; cov11 += y * y
      }
      cov00 /= N; cov01 /= N; cov11 /= N
      const trace = cov00 + cov11
      const det = cov00 * cov11 - cov01 * cov01
      const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det))
      const lam1 = trace / 2 + disc

      let ev1x = cov01
      let ev1y = lam1 - cov00
      const len = Math.sqrt(ev1x * ev1x + ev1y * ev1y) || 1
      ev1x /= len; ev1y /= len

      // Project each point onto PC1
      const projections = centered.map(([x, y]) => {
        const dot = x * ev1x + y * ev1y
        return [dot * ev1x, dot * ev1y] as [number, number]
      })

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 420)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const cx = p.width / 2
        const cy = p.height / 2 - 20
        const scale = 55

        // PC1 line
        p.stroke(234, 67, 53, 100)
        p.strokeWeight(2)
        p.line(cx - ev1x * 300, cy - ev1y * 300, cx + ev1x * 300, cy + ev1y * 300)

        // Draw projection lines and points
        const t = projAmount
        for (let i = 0; i < N; i++) {
          const [ox, oy] = centered[i]
          const [px, py] = projections[i]
          // Interpolate between original and projected position
          const ix = ox * (1 - t) + px * t
          const iy = oy * (1 - t) + py * t

          // Projection line (faint)
          if (t > 0) {
            p.stroke(148, 163, 184, 40 + t * 60)
            p.strokeWeight(1)
            p.line(cx + ox * scale, cy + oy * scale, cx + ix * scale, cy + iy * scale)
          }

          // Point
          p.noStroke()
          p.fill(168, 85, 247, 200)
          p.ellipse(cx + ix * scale, cy + iy * scale, 7, 7)
        }

        // 1D projection bar at bottom
        if (t > 0.3) {
          const barY = p.height - 50
          const barAlpha = Math.min(255, (t - 0.3) * 300)
          p.stroke(51, 65, 85, barAlpha)
          p.strokeWeight(1)
          p.line(50, barY, p.width - 50, barY)

          p.noStroke()
          p.fill(226, 232, 240, barAlpha)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text('1D Projection onto PC1', p.width / 2, barY + 10)

          // Project points onto the bar
          const projVals = centered.map(([x, y]) => x * ev1x + y * ev1y)
          const pMin = Math.min(...projVals)
          const pMax = Math.max(...projVals)
          const barW = p.width - 100

          for (let i = 0; i < N; i++) {
            const normalized = (projVals[i] - pMin) / (pMax - pMin)
            const bx = 50 + normalized * barW
            p.fill(168, 85, 247, barAlpha * 0.8)
            p.ellipse(bx, barY, 6, 6)
          }
        }

        // Labels
        p.noStroke()
        p.fill(234, 67, 53)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('PC1 axis', 15, 15)
        p.fill(148, 163, 184)
        p.textSize(11)
        const label = t === 0 ? '2D data (original)' : t === 1 ? 'Projected onto PC1 (1D)' : 'Projecting...'
        p.text(label, 15, 35)
      }
    },
    [projAmount],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Projection:
            <input type="range" min={0} max={1} step={0.02} value={projAmount}
              onChange={(e) => setProjAmount(parseFloat(e.target.value))} className="w-44" />
            <span className="w-16 font-mono">{projAmount === 0 ? '2D' : projAmount === 1 ? '1D' : `${(projAmount * 100).toFixed(0)}%`}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Variance Explained                                      */
/* ------------------------------------------------------------------ */

function VarianceExplainedSketch() {
  const [nComponents, setNComponents] = useState(6)

  const sketch = useCallback(
    (p: p5) => {
      // Simulated variance explained ratios for 10-dimensional data
      const variances = [0.35, 0.22, 0.15, 0.10, 0.07, 0.04, 0.03, 0.02, 0.015, 0.005]
      const cumulative = variances.reduce((acc, v) => {
        acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + v)
        return acc
      }, [] as number[])

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 380)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 65
        const plotW = p.width - margin * 2
        const plotH = p.height - margin * 2
        const barW = plotW / 10 - 6

        function mx(i: number): number { return margin + (i + 0.5) * (plotW / 10) }
        function my(v: number): number { return p.height - margin - v * plotH }

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
        p.text('Principal Component', p.width / 2, p.height - 18)
        p.push()
        p.translate(16, p.height / 2)
        p.rotate(-p.HALF_PI)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Variance Explained', 0, 0)
        p.pop()

        // Y-axis ticks
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let v = 0; v <= 1; v += 0.2) {
          p.fill(100, 116, 139)
          p.text(`${(v * 100).toFixed(0)}%`, margin - 8, my(v))
          p.stroke(51, 65, 85, 60)
          p.strokeWeight(0.5)
          p.line(margin, my(v), p.width - margin, my(v))
        }

        // Bars (individual variance)
        for (let i = 0; i < 10; i++) {
          const selected = i < nComponents
          p.noStroke()
          p.fill(selected ? 99 : 51, selected ? 102 : 65, selected ? 241 : 85, selected ? 220 : 100)
          p.rect(mx(i) - barW / 2, my(variances[i]), barW, my(0) - my(variances[i]), 2, 2, 0, 0)

          // X-axis label
          p.fill(selected ? 200 : 100, selected ? 200 : 116, selected ? 255 : 139)
          p.textSize(10)
          p.textAlign(p.CENTER, p.TOP)
          p.text(`PC${i + 1}`, mx(i), p.height - margin + 6)
        }

        // Cumulative line
        p.noFill()
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < 10; i++) {
          p.vertex(mx(i), my(cumulative[i]))
        }
        p.endShape()

        // Cumulative dots
        p.noStroke()
        for (let i = 0; i < 10; i++) {
          p.fill(250, 204, 21)
          p.ellipse(mx(i), my(cumulative[i]), 6, 6)
        }

        // 95% threshold line
        p.stroke(52, 211, 153, 150)
        p.strokeWeight(1)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([5, 5])
        p.line(margin, my(0.95), p.width - margin, my(0.95))
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])
        p.noStroke()
        p.fill(52, 211, 153)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.BOTTOM)
        p.text('95% threshold', p.width - margin, my(0.95) - 3)

        // Highlight selected components
        const selectedVar = cumulative[nComponents - 1]
        p.stroke(99, 102, 241, 100)
        p.strokeWeight(1)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([3, 3])
        p.line(mx(nComponents - 1), my(0), mx(nComponents - 1), my(selectedVar))
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

        // Info
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${nComponents} components  =  ${(selectedVar * 100).toFixed(1)}% variance`, margin, 8)

        // Legend
        p.fill(99, 102, 241)
        p.rect(p.width - 180, 15, 12, 12, 2)
        p.fill(180, 180, 200)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Individual', p.width - 164, 15)
        p.fill(250, 204, 21)
        p.ellipse(p.width - 174, 40, 8, 8)
        p.fill(180, 180, 200)
        p.text('Cumulative', p.width - 164, 34)
      }
    },
    [nComponents],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Components to keep:
            <input type="range" min={1} max={10} step={1} value={nComponents}
              onChange={(e) => setNComponents(parseInt(e.target.value))} className="w-36" />
            <span className="w-8 font-mono">{nComponents}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — PCA vs t-SNE Comparison                                 */
/* ------------------------------------------------------------------ */

function PCAVsTSNESketch() {
  const [view, setView] = useState<'pca' | 'tsne'>('pca')

  const sketch = useCallback(
    (p: p5) => {
      const rng = makeRng(55)
      const K = 4
      const N = 40 // per cluster
      const colors: [number, number, number][] = [
        [66, 133, 244], [234, 67, 53], [52, 211, 153], [250, 204, 21],
      ]

      // Generate 10D data with 4 clusters
      const clusterCenters = [
        [3, 0, 0, 0, 0, 2, 0, 0, 0, 0],
        [0, 3, 0, 0, 0, 0, 2, 0, 0, 0],
        [0, 0, 3, 0, 0, 0, 0, 2, 0, 0],
        [0, 0, 0, 3, 0, 0, 0, 0, 2, 0],
      ]

      interface DataPoint {
        high: number[]
        label: number
      }

      const data: DataPoint[] = []
      for (let k = 0; k < K; k++) {
        for (let i = 0; i < N; i++) {
          const point = clusterCenters[k].map((c) => c + randn(rng) * 0.5)
          data.push({ high: point, label: k })
        }
      }

      // PCA: project onto first 2 principal components (simplified: just use first 2 most-varying dims)
      // Compute covariance and find top 2 eigenvectors
      const D = 10
      const means = Array(D).fill(0)
      for (const pt of data) {
        for (let d = 0; d < D; d++) means[d] += pt.high[d]
      }
      for (let d = 0; d < D; d++) means[d] /= data.length

      // Center the data
      const centered = data.map((pt) => pt.high.map((v, d) => v - means[d]))

      // Use power iteration for top 2 eigenvectors (simplified PCA)
      function powerIteration(matrix: number[][], _deflated: boolean): number[] {
        let vec = Array(D).fill(0).map(() => rng() - 0.5)
        for (let iter = 0; iter < 50; iter++) {
          const newVec = Array(D).fill(0)
          for (let i = 0; i < D; i++) {
            for (let j = 0; j < D; j++) {
              newVec[i] += matrix[i][j] * vec[j]
            }
          }
          const norm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0)) || 1
          vec = newVec.map((v) => v / norm)
        }
        return vec
      }

      // Compute covariance matrix
      const cov: number[][] = Array.from({ length: D }, () => Array(D).fill(0))
      for (const pt of centered) {
        for (let i = 0; i < D; i++) {
          for (let j = 0; j < D; j++) {
            cov[i][j] += pt[i] * pt[j]
          }
        }
      }
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) cov[i][j] /= data.length

      const pc1 = powerIteration(cov, false)
      // Deflate
      const lam1 = pc1.reduce((s, _v, i) => {
        let dot = 0
        for (let j = 0; j < D; j++) dot += cov[i][j] * pc1[j]
        return s + dot * pc1[i]
      }, 0)
      const covDeflated = cov.map((row, i) => row.map((v, j) => v - lam1 * pc1[i] * pc1[j]))
      const pc2 = powerIteration(covDeflated, true)

      // PCA projections
      const pcaProj = centered.map((pt) => ({
        x: pt.reduce((s, v, i) => s + v * pc1[i], 0),
        y: pt.reduce((s, v, i) => s + v * pc2[i], 0),
      }))

      // Simplified t-SNE-like: use random layout that respects cluster structure
      // (True t-SNE is too expensive for real-time; we simulate the result)
      const tsneRng = makeRng(123)
      const tsneAnchors = [
        [150, 130], [450, 130], [150, 330], [450, 330],
      ]
      const tsneProj = data.map((pt) => {
        const anchor = tsneAnchors[pt.label]
        return {
          x: anchor[0] + randn(tsneRng) * 35,
          y: anchor[1] + randn(tsneRng) * 35,
        }
      })

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 420)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const proj = view === 'pca' ? pcaProj : tsneProj
        const margin = 50

        // Normalize projections to fit canvas
        const xs = proj.map((p) => p.x)
        const ys = proj.map((p) => p.y)
        const xMin = Math.min(...xs)
        const xMax = Math.max(...xs)
        const yMin = Math.min(...ys)
        const yMax = Math.max(...ys)
        const xRange = xMax - xMin || 1
        const yRange = yMax - yMin || 1
        const plotW = p.width - margin * 2
        const plotH = p.height - margin * 2

        // Draw points
        p.noStroke()
        for (let i = 0; i < data.length; i++) {
          const col = colors[data[i].label]
          p.fill(col[0], col[1], col[2], 200)
          const px = margin + ((proj[i].x - xMin) / xRange) * plotW
          const py = margin + ((proj[i].y - yMin) / yRange) * plotH
          p.ellipse(px, py, 8, 8)
        }

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text(view === 'pca' ? 'PCA (linear, preserves global structure)' : 't-SNE (nonlinear, preserves local structure)', margin, 10)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text('4 clusters in 10D space, reduced to 2D', margin, 30)

        // Legend
        for (let k = 0; k < K; k++) {
          p.fill(colors[k][0], colors[k][1], colors[k][2])
          p.ellipse(p.width - 90, margin + k * 20, 8, 8)
          p.fill(180, 180, 200)
          p.textSize(10)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`Cluster ${k + 1}`, p.width - 80, margin + k * 20)
        }
      }
    },
    [view],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <button onClick={() => setView('pca')}
            className={`rounded px-4 py-1.5 transition-colors ${view === 'pca' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            PCA
          </button>
          <button onClick={() => setView('tsne')}
            className={`rounded px-4 py-1.5 transition-colors ${view === 'tsne' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            t-SNE
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function PCA() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-200">
      {/* ---------- Section 1: Curse of Dimensionality ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">1. The Curse of Dimensionality</h2>
        <p className="mb-4 text-gray-300">
          As the number of features (dimensions) grows, several problems emerge. In high dimensions,
          data points become increasingly sparse — the volume of the space grows exponentially, but
          the amount of data stays fixed. A dataset that densely covers a 2D square would be
          hopelessly sparse in 100D.
        </p>
        <p className="mb-4 text-gray-300">
          This sparsity has real consequences. Distance metrics become less meaningful: in high
          dimensions, the ratio of the nearest and farthest neighbor distances approaches 1,
          making k-NN unreliable. Models need exponentially more data to achieve the same
          performance. Many features are noisy or redundant, adding variance without signal.
        </p>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">Dimensionality reduction</strong> addresses this by
          projecting data into a lower-dimensional space while preserving as much useful information
          as possible. This speeds up training, reduces overfitting, and can reveal hidden structure
          that is invisible in the original high-dimensional space.
        </p>
      </section>

      {/* ---------- Section 2: What PCA Does ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">2. What PCA Does</h2>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">Principal Component Analysis (PCA)</strong> finds the
          directions in which the data varies the most, then uses those directions as new axes.
          The first principal component (PC1) points along the direction of maximum variance. The
          second principal component (PC2) is perpendicular to PC1 and captures the most remaining
          variance. And so on.
        </p>
        <p className="mb-4 text-gray-300">
          Mathematically, PCA computes the eigenvectors of the data's covariance matrix. The
          eigenvector with the largest eigenvalue is PC1 (the direction of greatest spread). The
          eigenvalues tell you how much variance each component captures. Projecting onto the top k
          eigenvectors gives a k-dimensional representation that preserves the most variance.
        </p>
        <p className="mb-6 text-gray-300">
          In the visualization below, the purple dots form a correlated cloud. The red arrow (PC1)
          points along the "longest" direction — the axis of maximum spread. The blue arrow (PC2)
          is perpendicular and captures the remaining spread. Use the slider to rotate the
          coordinate grid from the original axes to the PC-aligned axes.
        </p>
        <PCAAxesSketch />
      </section>

      {/* ---------- Section 3: Projection ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">3. Projection: From 2D to 1D</h2>
        <p className="mb-4 text-gray-300">
          Once we know the principal components, dimensionality reduction is just projection. To
          reduce from D dimensions to k dimensions, we project each data point onto the top k
          principal components. Each point's new coordinates are the dot products with the PC
          vectors.
        </p>
        <p className="mb-4 text-gray-300">
          The simplest case is projecting 2D data onto PC1 (a line). Each 2D point is mapped to the
          closest point on the PC1 line. The perpendicular distance from the point to the line is
          the information that gets discarded — this is the variance captured by PC2.
        </p>
        <p className="mb-6 text-gray-300">
          Drag the slider to animate the projection. Watch the 2D scatter collapse onto the red PC1
          line, and see the 1D projection bar appear at the bottom. The spread along the bar is the
          variance retained; the collapse perpendicular to the line is the variance discarded.
        </p>
        <ProjectionSketch />
      </section>

      {/* ---------- Section 4: Variance Explained ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">4. Variance Explained</h2>
        <p className="mb-4 text-gray-300">
          The key question in PCA is: <em>how many components should I keep?</em> Each principal
          component captures a fraction of the total variance. The <strong className="text-white">
          explained variance ratio</strong> tells you what fraction of the total variance is
          captured by each component.
        </p>
        <p className="mb-4 text-gray-300">
          A common rule of thumb is to keep enough components to explain
          <strong className="text-white"> 95% of the total variance</strong>. Plot the cumulative
          explained variance and find where it crosses the 95% line. In practice, you might find
          that 100 features can be reduced to 10-20 components with minimal information loss.
        </p>
        <p className="mb-6 text-gray-300">
          The bar chart shows the variance explained by each of 10 components. The yellow line
          shows cumulative variance. Use the slider to select how many components to keep and see
          what fraction of variance you retain.
        </p>
        <VarianceExplainedSketch />
      </section>

      {/* ---------- Section 5: PCA on Images ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">5. PCA on Images</h2>
        <p className="mb-4 text-gray-300">
          PCA is widely used for image compression and analysis. A grayscale image of 64x64 pixels
          is a point in 4096-dimensional space. Applying PCA to a dataset of face images produces
          what are called <strong className="text-white">eigenfaces</strong> — the principal
          components of the face space.
        </p>
        <p className="mb-4 text-gray-300">
          The first few eigenfaces capture the most common variations: overall brightness, the
          direction of lighting, the presence of glasses, hairstyle differences, etc. Any face can
          be approximately reconstructed as a weighted sum of a small number of eigenfaces. With
          just 50-100 components (out of 4096), you can reconstruct recognizable faces.
        </p>
        <p className="mb-4 text-gray-300">
          This same principle applies beyond faces: PCA finds the "basis patterns" in any
          high-dimensional dataset. In NLP, PCA on word co-occurrence matrices produces word
          embeddings. In genomics, the first few PCs often correspond to population structure.
        </p>
      </section>

      {/* ---------- Section 6: PCA vs t-SNE ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">6. PCA vs t-SNE</h2>
        <p className="mb-4 text-gray-300">
          PCA is a <strong className="text-white">linear</strong> method — it can only find
          directions that are straight lines in the original space. This means it preserves global
          structure (overall distances and spread) but can miss complex nonlinear patterns.
        </p>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">t-SNE</strong> (t-distributed Stochastic Neighbor
          Embedding) is a <strong className="text-white">nonlinear</strong> method designed
          specifically for visualization. It converts high-dimensional distances into probabilities:
          nearby points get high probability, distant points get low probability. It then finds a
          2D layout that preserves these probabilities, keeping similar points close together.
        </p>
        <p className="mb-4 text-gray-300">
          t-SNE excels at preserving <strong className="text-white">local structure</strong> (which
          points are neighbors) and often reveals clearly separated clusters that PCA misses.
          However, t-SNE does not preserve global distances — the relative positions of clusters in
          the 2D plot are not meaningful, and the perplexity parameter affects the result. Use PCA
          for interpretable, reproducible reduction; use t-SNE for visual exploration of clusters.
        </p>
        <p className="mb-6 text-gray-300">
          Toggle between PCA and t-SNE views of the same 10-dimensional 4-cluster dataset.
        </p>
        <PCAVsTSNESketch />
      </section>

      {/* ---------- Section 7: Python - PCA ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">7. Python: PCA with Scikit-Learn</h2>
        <p className="mb-4 text-gray-300">
          Apply PCA to a dataset and examine the explained variance ratio. This is the most common
          workflow: fit PCA, check how many components you need, then transform the data.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.decomposition import PCA
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler

# Generate 20-dimensional data
X, y = make_classification(n_samples=300, n_features=20, n_informative=5,
                           n_redundant=10, random_state=42)

# Always standardize before PCA!
X_scaled = StandardScaler().fit_transform(X)

# Fit PCA with all components
pca = PCA()
pca.fit(X_scaled)

# Explained variance ratio
evr = pca.explained_variance_ratio_
cumulative = np.cumsum(evr)

print("Component | Var Explained | Cumulative")
print("-" * 42)
for i in range(min(10, len(evr))):
    print(f"   PC{i+1:<3}  |    {evr[i]:.3f}      |   {cumulative[i]:.3f}")

# How many components for 95% variance?
n_95 = np.argmax(cumulative >= 0.95) + 1
print(f"\\nComponents for 95% variance: {n_95} (out of {X.shape[1]})")

# Transform data
X_reduced = PCA(n_components=n_95).fit_transform(X_scaled)
print(f"Original shape: {X_scaled.shape}")
print(f"Reduced shape:  {X_reduced.shape}")
`}
        />
      </section>

      {/* ---------- Section 8: Python - PCA vs t-SNE ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">8. Python: PCA vs t-SNE Comparison</h2>
        <p className="mb-4 text-gray-300">
          Compare PCA and t-SNE on a clustered dataset. Note how t-SNE produces more clearly
          separated groups, while PCA provides a linear projection that preserves global geometry.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.datasets import make_blobs
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.cluster import KMeans

# Generate 50D data with 5 clusters
X, y_true = make_blobs(n_samples=300, n_features=50, centers=5,
                        cluster_std=2.0, random_state=42)
X_scaled = StandardScaler().fit_transform(X)

# PCA to 2D
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)
print(f"PCA explained variance: {pca.explained_variance_ratio_.sum():.3f}")

# t-SNE to 2D
tsne = TSNE(n_components=2, random_state=42, perplexity=30)
X_tsne = tsne.fit_transform(X_scaled)

# Cluster on each 2D representation and compare
for name, X_2d in [("PCA", X_pca), ("t-SNE", X_tsne)]:
    km = KMeans(n_clusters=5, random_state=42, n_init=10).fit(X_2d)
    sil = silhouette_score(X_2d, km.labels_)
    from sklearn.metrics import adjusted_rand_score
    ari = adjusted_rand_score(y_true, km.labels_)
    print(f"\\n{name} 2D representation:")
    print(f"  Silhouette score:      {sil:.3f}")
    print(f"  Adjusted Rand Index:   {ari:.3f}")
    print(f"  Spread (std of coords): x={X_2d[:,0].std():.2f}, y={X_2d[:,1].std():.2f}")

# PCA is better for downstream ML; t-SNE is better for visualization
print("\\nPCA: preserves variance, reproducible, fast")
print("t-SNE: preserves neighborhoods, great for viz, slow, non-deterministic")
`}
        />
      </section>
    </article>
  )
}
