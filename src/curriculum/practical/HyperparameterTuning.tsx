import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'practical/hyperparameter-tuning',
  title: 'Hyperparameter Tuning',
  description: 'Grid search, random search, Bayesian optimization, and early stopping for finding the best model configuration',
  track: 'practical',
  order: 3,
  tags: ['hyperparameters', 'grid-search', 'random-search', 'bayesian-optimization', 'early-stopping', 'cross-validation'],
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

// A 2D score landscape: validation accuracy as function of learning rate and regularization
// Has a clear optimum region with smooth falloff
function scoreFunction(lr: number, reg: number): number {
  // Optimal around lr=0.3, reg=0.01
  const lrDist = (Math.log10(lr) - Math.log10(0.3)) ** 2
  const regDist = (Math.log10(reg) - Math.log10(0.01)) ** 2
  const base = 0.92 - 0.3 * lrDist - 0.15 * regDist
  // Add some ridges for interest
  const ridge = 0.02 * Math.sin(lr * 15) * Math.cos(reg * 200)
  return Math.min(0.95, Math.max(0.45, base + ridge))
}

/* ------------------------------------------------------------------ */
/* Section 2 — Grid Search Sketch                                      */
/* ------------------------------------------------------------------ */

function GridSearchSketch() {
  const [gridRes, setGridRes] = useState(8)
  const gridResRef = useRef(gridRes)
  gridResRef.current = gridRes

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const margin = 60

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const res = gridResRef.current

      const plotW = p.width - margin * 2
      const plotH = canvasH - margin * 2

      // Learning rate range: 0.001 to 1 (log scale)
      // Regularization range: 0.0001 to 1 (log scale)
      const lrMin = 0.001
      const lrMax = 1.0
      const regMin = 0.0001
      const regMax = 1.0

      const lrValues: number[] = []
      const regValues: number[] = []
      for (let i = 0; i < res; i++) {
        const t = i / (res - 1)
        lrValues.push(lrMin * Math.pow(lrMax / lrMin, t))
        regValues.push(regMin * Math.pow(regMax / regMin, t))
      }

      // Evaluate all grid points
      let bestScore = -1
      let bestLr = 0
      let bestReg = 0

      const cells: { x: number; y: number; score: number; lr: number; reg: number }[] = []
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const lr = lrValues[i]
          const reg = regValues[j]
          const score = scoreFunction(lr, reg)
          const px = margin + (i / (res - 1)) * plotW
          const py = canvasH - margin - (j / (res - 1)) * plotH
          cells.push({ x: px, y: py, score, lr, reg })
          if (score > bestScore) {
            bestScore = score
            bestLr = lr
            bestReg = reg
          }
        }
      }

      // Draw grid cells
      const cellW = plotW / (res - 1 || 1)
      const cellH = plotH / (res - 1 || 1)

      for (const cell of cells) {
        const intensity = (cell.score - 0.45) / 0.5
        const r = Math.round(30 + intensity * 20)
        const g = Math.round(41 + intensity * 170)
        const b = Math.round(59 + intensity * 94)
        p.noStroke()
        p.fill(r, g, b, 200)
        p.rect(cell.x - cellW / 2, cell.y - cellH / 2, cellW - 1, cellH - 1, 3)

        // Score text
        if (res <= 10) {
          p.fill(255, 255, 255, intensity > 0.3 ? 220 : 100)
          p.textSize(res <= 6 ? 10 : 8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(cell.score.toFixed(2), cell.x, cell.y)
        }
      }

      // Highlight best cell
      const bestCell = cells.reduce((best, c) => (c.score > best.score ? c : best), cells[0])
      p.noFill()
      p.stroke(250, 204, 21)
      p.strokeWeight(3)
      p.rect(bestCell.x - cellW / 2, bestCell.y - cellH / 2, cellW - 1, cellH - 1, 3)

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
      p.line(margin, margin, margin, canvasH - margin)

      // Axis labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Learning Rate (log scale)', (margin + p.width - margin) / 2, canvasH - margin + 22)

      // X axis ticks
      p.textSize(9)
      for (let i = 0; i < Math.min(res, 8); i++) {
        const t = i / (Math.min(res, 8) - 1)
        const px = margin + t * plotW
        p.text(lrValues[Math.min(i, lrValues.length - 1)].toFixed(3), px, canvasH - margin + 6)
      }

      p.push()
      p.translate(margin - 38, (margin + canvasH - margin) / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.textSize(11)
      p.text('Regularization (log scale)', 0, 0)
      p.pop()

      // Info
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Grid Search: ${res}x${res} = ${res * res} evaluations`, margin, 10)
      p.fill(250, 204, 21)
      p.textSize(11)
      p.text(`Best: lr=${bestLr.toFixed(4)}, reg=${bestReg.toFixed(4)}, score=${bestScore.toFixed(3)}`, margin, 28)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Grid Resolution:
            <input
              type="range"
              min={3}
              max={15}
              step={1}
              value={gridRes}
              onChange={e => setGridRes(parseInt(e.target.value))}
              className="w-36 accent-yellow-500"
            />
            <span className="w-20 font-mono">{gridRes}x{gridRes} = {gridRes * gridRes}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Random Search Sketch                                    */
/* ------------------------------------------------------------------ */

function RandomSearchSketch() {
  const [nSamples, setNSamples] = useState(30)
  const nSamplesRef = useRef(nSamples)
  nSamplesRef.current = nSamples

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const margin = 60

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const ns = nSamplesRef.current
      const rng = makeRng(42) // deterministic for given seed

      const plotW = p.width - margin * 2
      const plotH = canvasH - margin * 2

      const lrMin = 0.001
      const lrMax = 1.0
      const regMin = 0.0001
      const regMax = 1.0

      // Draw background heatmap (coarse)
      const bgRes = 30
      for (let i = 0; i < bgRes; i++) {
        for (let j = 0; j < bgRes; j++) {
          const tLr = i / (bgRes - 1)
          const tReg = j / (bgRes - 1)
          const lr = lrMin * Math.pow(lrMax / lrMin, tLr)
          const reg = regMin * Math.pow(regMax / regMin, tReg)
          const score = scoreFunction(lr, reg)
          const intensity = (score - 0.45) / 0.5
          const px = margin + tLr * plotW
          const py = canvasH - margin - tReg * plotH
          const cw = plotW / bgRes + 1
          const ch = plotH / bgRes + 1
          p.noStroke()
          p.fill(30 + intensity * 20, 41 + intensity * 100, 59 + intensity * 60, 60)
          p.rect(px, py - ch, cw, ch)
        }
      }

      // Generate random samples
      let bestScore = -1
      let bestLr = 0
      let bestReg = 0
      const samples: { px: number; py: number; score: number; lr: number; reg: number }[] = []

      for (let i = 0; i < ns; i++) {
        const tLr = rng()
        const tReg = rng()
        const lr = lrMin * Math.pow(lrMax / lrMin, tLr)
        const reg = regMin * Math.pow(regMax / regMin, tReg)
        const score = scoreFunction(lr, reg)
        const px = margin + tLr * plotW
        const py = canvasH - margin - tReg * plotH
        samples.push({ px, py, score, lr, reg })
        if (score > bestScore) {
          bestScore = score
          bestLr = lr
          bestReg = reg
        }
      }

      // Draw sample points
      for (const s of samples) {
        const intensity = (s.score - 0.45) / 0.5
        const isBest = s.score === bestScore
        p.noStroke()
        if (isBest) {
          p.fill(250, 204, 21)
          p.ellipse(s.px, s.py, 16, 16)
        } else {
          p.fill(30 + intensity * 222, 41 + intensity * 170, 59 + intensity * 94, 220)
          p.ellipse(s.px, s.py, 10, 10)
        }
        p.stroke(255, 255, 255, 60)
        p.strokeWeight(1)
        p.noFill()
        p.ellipse(s.px, s.py, isBest ? 16 : 10, isBest ? 16 : 10)
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
      p.line(margin, margin, margin, canvasH - margin)

      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Learning Rate (log scale)', (margin + p.width - margin) / 2, canvasH - margin + 10)

      p.push()
      p.translate(margin - 38, (margin + canvasH - margin) / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.textSize(11)
      p.text('Regularization (log scale)', 0, 0)
      p.pop()

      // Info
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Random Search: ${ns} evaluations`, margin, 10)
      p.fill(250, 204, 21)
      p.textSize(11)
      p.text(`Best: lr=${bestLr.toFixed(4)}, reg=${bestReg.toFixed(4)}, score=${bestScore.toFixed(3)}`, margin, 28)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Number of Samples:
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={nSamples}
              onChange={e => setNSamples(parseInt(e.target.value))}
              className="w-40 accent-yellow-500"
            />
            <span className="w-10 font-mono">{nSamples}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Grid vs Random Side-by-Side                             */
/* ------------------------------------------------------------------ */

function GridVsRandomSketch() {
  const [budget, setBudget] = useState(25)
  const budgetRef = useRef(budget)
  budgetRef.current = budget

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const margin = 50

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const bgt = budgetRef.current
      const halfW = p.width / 2
      const plotH = canvasH - margin * 2

      // Divider
      p.stroke(51, 65, 85)
      p.strokeWeight(2)
      p.line(halfW, 0, halfW, canvasH)

      // For this comparison, the score depends mostly on learning rate (x-axis)
      // and only slightly on regularization (y-axis)
      // This makes random search superior because it samples more unique x values
      function scoreFnUneven(lr: number, reg: number): number {
        const lrDist = (Math.log10(lr) - Math.log10(0.2)) ** 2
        const regDist = (Math.log10(reg) - Math.log10(0.01)) ** 2
        return Math.min(0.95, Math.max(0.45, 0.92 - 0.4 * lrDist - 0.05 * regDist))
      }

      const lrMin = 0.001
      const lrMax = 1.0
      const regMin = 0.0001
      const regMax = 1.0

      // ---------- Left: Grid Search ----------
      const gridRes = Math.round(Math.sqrt(bgt))
      const gridN = gridRes * gridRes
      let gridBest = -1

      // Draw grid projections on axes
      const leftPlotW = halfW - margin * 2
      const uniqueLrGrid = new Set<number>()

      for (let i = 0; i < gridRes; i++) {
        for (let j = 0; j < gridRes; j++) {
          const tLr = i / Math.max(1, gridRes - 1)
          const tReg = j / Math.max(1, gridRes - 1)
          const lr = lrMin * Math.pow(lrMax / lrMin, tLr)
          const reg = regMin * Math.pow(regMax / regMin, tReg)
          const score = scoreFnUneven(lr, reg)
          const px = margin + tLr * leftPlotW
          const py = canvasH - margin - tReg * plotH

          uniqueLrGrid.add(i)

          const intensity = (score - 0.45) / 0.5
          p.noStroke()
          p.fill(99, 102, 241, 80 + intensity * 170)
          p.ellipse(px, py, 8, 8)

          if (score > gridBest) gridBest = score
        }
      }

      // ---------- Right: Random Search ----------
      const rng = makeRng(42)
      let randomBest = -1
      const uniqueLrRandom = new Set<number>()

      for (let i = 0; i < bgt; i++) {
        const tLr = rng()
        const tReg = rng()
        const lr = lrMin * Math.pow(lrMax / lrMin, tLr)
        const reg = regMin * Math.pow(regMax / regMin, tReg)
        const score = scoreFnUneven(lr, reg)
        const px = halfW + margin + tLr * leftPlotW
        const py = canvasH - margin - tReg * plotH

        uniqueLrRandom.add(Math.round(tLr * 100))

        const intensity = (score - 0.45) / 0.5
        p.noStroke()
        p.fill(52, 211, 153, 80 + intensity * 170)
        p.ellipse(px, py, 8, 8)

        if (score > randomBest) randomBest = score
      }

      // Project grid points onto x-axis to show coverage
      p.stroke(99, 102, 241, 60)
      p.strokeWeight(1)
      for (let i = 0; i < gridRes; i++) {
        const px = margin + (i / Math.max(1, gridRes - 1)) * leftPlotW
        p.line(px, canvasH - margin, px, canvasH - margin + 15)
      }

      // Titles
      p.noStroke()
      p.fill(99, 102, 241)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`Grid Search (${gridN} evals)`, margin + leftPlotW / 2, 8)
      p.fill(52, 211, 153)
      p.text(`Random Search (${bgt} evals)`, halfW + margin + leftPlotW / 2, 8)

      // Best scores
      p.textSize(11)
      p.fill(99, 102, 241)
      p.text(`Best: ${gridBest.toFixed(3)}`, margin + leftPlotW / 2, 26)
      p.fill(52, 211, 153)
      p.text(`Best: ${randomBest.toFixed(3)}`, halfW + margin + leftPlotW / 2, 26)

      // Coverage info
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(
        `${uniqueLrGrid.size} unique LR values`,
        margin + leftPlotW / 2,
        canvasH - 6,
      )
      p.text(
        `${uniqueLrRandom.size} unique LR values`,
        halfW + margin + leftPlotW / 2,
        canvasH - 6,
      )

      // Axes
      for (const offset of [0, halfW]) {
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(offset + margin, canvasH - margin, offset + margin + leftPlotW, canvasH - margin)
        p.line(offset + margin, margin, offset + margin, canvasH - margin)
      }

      // Explanation at bottom center
      p.noStroke()
      p.fill(250, 204, 21)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      const winner = randomBest >= gridBest ? 'Random wins' : 'Grid wins'
      p.text(
        `When LR matters more than Reg: ${winner} with more diverse LR coverage`,
        p.width / 2,
        canvasH - 18,
      )
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Total Budget:
            <input
              type="range"
              min={9}
              max={64}
              step={1}
              value={budget}
              onChange={e => setBudget(parseInt(e.target.value))}
              className="w-40 accent-yellow-500"
            />
            <span className="w-10 font-mono">{budget}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 5 — Bayesian Optimization Sketch                            */
/* ------------------------------------------------------------------ */

function BayesianOptSketch() {
  const [step, setStep] = useState(3)
  const stepRef = useRef(step)
  stepRef.current = step

  const sketch = useCallback((p: p5) => {
    const canvasH = 440
    const margin = 60

    // True objective function (1D for visualization)
    function trueObj(x: number): number {
      return 0.5 * Math.sin(3 * x) + 0.3 * Math.cos(7 * x) + 0.4 * Math.sin(x) + 0.5
    }

    // Simple GP-like surrogate: RBF interpolation
    function surrogate(
      x: number,
      observations: { x: number; y: number }[],
      lengthScale: number,
    ): { mean: number; std: number } {
      if (observations.length === 0) return { mean: 0.5, std: 0.3 }

      const kernel = (a: number, b: number) =>
        Math.exp(-((a - b) ** 2) / (2 * lengthScale ** 2))

      let weightSum = 0
      let valueSum = 0
      let minDist = Infinity

      for (const obs of observations) {
        const k = kernel(x, obs.x)
        weightSum += k
        valueSum += k * obs.y
        minDist = Math.min(minDist, Math.abs(x - obs.x))
      }

      const mean = weightSum > 0.001 ? valueSum / weightSum : 0.5
      // Uncertainty grows with distance from observations
      const std = Math.max(0.01, 0.3 * (1 - Math.exp(-(minDist ** 2) / (2 * (lengthScale * 0.5) ** 2))))
      return { mean, std }
    }

    // Choose next point via UCB acquisition
    function acquisitionUCB(
      x: number,
      observations: { x: number; y: number }[],
      ls: number,
      kappa: number,
    ): number {
      const { mean, std } = surrogate(x, observations, ls)
      return mean + kappa * std
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const nSteps = stepRef.current
      const ls = 0.3
      const kappa = 1.5

      const plotW = p.width - margin * 2
      const topH = (canvasH - margin * 2 - 30) * 0.65
      const botH = (canvasH - margin * 2 - 30) * 0.35
      const topY = margin
      const botY = margin + topH + 30

      const mapX = (v: number) => margin + ((v - 0) / (Math.PI * 2)) * plotW
      const mapTopY = (v: number) => topY + topH - ((v + 0.2) / 1.5) * topH
      const mapBotY = (v: number) => botY + botH - ((v + 0.2) / 1.5) * botH

      // Generate observations up to current step
      const observations: { x: number; y: number }[] = []
      const rng = makeRng(42)
      // Initial random points
      const initPoints = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2]
      for (let i = 0; i < Math.min(nSteps, 3); i++) {
        observations.push({ x: initPoints[i], y: trueObj(initPoints[i]) })
      }
      // Bayesian steps
      for (let s = 3; s < nSteps; s++) {
        // Find max acquisition
        let bestX = 0
        let bestAcq = -Infinity
        for (let i = 0; i <= 200; i++) {
          const x = (i / 200) * Math.PI * 2
          const acq = acquisitionUCB(x, observations, ls, kappa)
          if (acq > bestAcq) {
            bestAcq = acq
            bestX = x
          }
        }
        observations.push({ x: bestX, y: trueObj(bestX) })
      }

      // --- Top plot: surrogate + true function ---
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Surrogate Model with Uncertainty', p.width / 2, topY - 18)

      // Confidence band
      const nPts = 200
      const upperPts: { x: number; y: number }[] = []
      const lowerPts: { x: number; y: number }[] = []
      for (let i = 0; i <= nPts; i++) {
        const x = (i / nPts) * Math.PI * 2
        const { mean, std } = surrogate(x, observations, ls)
        upperPts.push({ x: mapX(x), y: mapTopY(mean + 2 * std) })
        lowerPts.push({ x: mapX(x), y: mapTopY(mean - 2 * std) })
      }

      // Fill confidence band
      p.fill(99, 102, 241, 30)
      p.noStroke()
      p.beginShape()
      for (const pt of upperPts) p.vertex(pt.x, pt.y)
      for (let i = lowerPts.length - 1; i >= 0; i--) p.vertex(lowerPts[i].x, lowerPts[i].y)
      p.endShape(p.CLOSE)

      // Surrogate mean
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= nPts; i++) {
        const x = (i / nPts) * Math.PI * 2
        const { mean } = surrogate(x, observations, ls)
        p.vertex(mapX(x), mapTopY(mean))
      }
      p.endShape()

      // True function (dashed)
      p.stroke(52, 211, 153, 120)
      p.strokeWeight(1.5)
      for (let i = 0; i < nPts; i++) {
        if (i % 3 < 2) {
          const x1 = (i / nPts) * Math.PI * 2
          const x2 = ((i + 1) / nPts) * Math.PI * 2
          p.line(mapX(x1), mapTopY(trueObj(x1)), mapX(x2), mapTopY(trueObj(x2)))
        }
      }

      // Observation points
      for (let i = 0; i < observations.length; i++) {
        const obs = observations[i]
        const isLatest = i === observations.length - 1 && nSteps > 3
        p.noStroke()
        if (isLatest) {
          p.fill(250, 204, 21)
          p.ellipse(mapX(obs.x), mapTopY(obs.y), 14, 14)
        } else if (i < 3) {
          p.fill(148, 163, 184)
          p.ellipse(mapX(obs.x), mapTopY(obs.y), 10, 10)
        } else {
          p.fill(236, 72, 153)
          p.ellipse(mapX(obs.x), mapTopY(obs.y), 10, 10)
        }
      }

      // Top axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin, topY + topH, p.width - margin, topY + topH)
      p.line(margin, topY, margin, topY + topH)

      // --- Bottom plot: acquisition function ---
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Acquisition Function (UCB)', p.width / 2, botY - 16)

      // Draw acquisition
      p.stroke(250, 204, 21)
      p.strokeWeight(2)
      p.noFill()
      let maxAcqX = 0
      let maxAcqVal = -Infinity
      p.beginShape()
      for (let i = 0; i <= nPts; i++) {
        const x = (i / nPts) * Math.PI * 2
        const acq = acquisitionUCB(x, observations, ls, kappa)
        p.vertex(mapX(x), mapBotY(acq))
        if (acq > maxAcqVal) {
          maxAcqVal = acq
          maxAcqX = x
        }
      }
      p.endShape()

      // Mark next evaluation point
      if (nSteps >= 3) {
        p.stroke(250, 204, 21, 150)
        p.strokeWeight(1)
        p.line(mapX(maxAcqX), botY, mapX(maxAcqX), botY + botH)
        p.noStroke()
        p.fill(250, 204, 21)
        p.textSize(9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('next', mapX(maxAcqX), botY - 2)
      }

      // Bottom axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin, botY + botH, p.width - margin, botY + botH)
      p.line(margin, botY, margin, botY + botH)

      // Legend
      const legX = p.width - 200
      p.noStroke()
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.line(legX, topY + 5, legX + 20, topY + 5)
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Surrogate mean', legX + 24, topY + 5)

      p.stroke(52, 211, 153, 120)
      p.strokeWeight(1.5)
      p.line(legX, topY + 20, legX + 20, topY + 20)
      p.noStroke()
      p.fill(148, 163, 184)
      p.text('True function', legX + 24, topY + 20)

      p.fill(99, 102, 241, 60)
      p.rect(legX, topY + 31, 20, 8)
      p.fill(148, 163, 184)
      p.text('Uncertainty', legX + 24, topY + 35)

      // Best found
      const bestObs = observations.reduce((best, o) => (o.y > best.y ? o : best), observations[0])
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Step ${nSteps}  |  Observations: ${observations.length}  |  Best score: ${bestObs.y.toFixed(3)}`, margin, canvasH - 18)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Optimization Step:
            <input
              type="range"
              min={3}
              max={15}
              step={1}
              value={step}
              onChange={e => setStep(parseInt(e.target.value))}
              className="w-40 accent-yellow-500"
            />
            <span className="w-10 font-mono">{step}</span>
          </label>
          <span className="text-gray-500">
            {step <= 3 ? '(initial random samples)' : step <= 6 ? '(exploring)' : step <= 10 ? '(converging)' : '(refining)'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 7 — Early Stopping Sketch                                   */
/* ------------------------------------------------------------------ */

function EarlyStoppingSketch() {
  const [patience, setPatience] = useState(10)
  const patienceRef = useRef(patience)
  patienceRef.current = patience

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    const margin = 60

    // Generate training curves
    const epochs = 150
    const rng = makeRng(42)
    const trainLoss: number[] = []
    const valLoss: number[] = []
    for (let i = 0; i < epochs; i++) {
      const t = i / epochs
      trainLoss.push(2.0 * Math.exp(-4 * t) + 0.05 + randn(rng) * 0.02)
      // Validation: decreases then increases (overfitting)
      const valBase = 2.0 * Math.exp(-3.5 * t) + 0.1 + 0.4 * t * t
      valLoss.push(valBase + randn(rng) * 0.03)
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const pat = patienceRef.current

      const plotW = p.width - margin * 2
      const plotH = canvasH - margin * 2

      const maxLoss = Math.max(...trainLoss.slice(0, 5), ...valLoss.slice(0, 5))
      const minLoss = 0

      const mapX = (epoch: number) => margin + (epoch / (epochs - 1)) * plotW
      const mapY = (loss: number) => margin + plotH - ((loss - minLoss) / (maxLoss - minLoss)) * plotH

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = 0; gx <= epochs; gx += 25) p.line(mapX(gx), margin, mapX(gx), canvasH - margin)
      for (let gy = 0; gy <= maxLoss; gy += 0.5) p.line(margin, mapY(gy), p.width - margin, mapY(gy))

      // Find early stopping point
      let bestValLoss = Infinity
      let bestEpoch = 0
      let stopEpoch = epochs - 1
      let waitCount = 0

      for (let i = 0; i < epochs; i++) {
        if (valLoss[i] < bestValLoss) {
          bestValLoss = valLoss[i]
          bestEpoch = i
          waitCount = 0
        } else {
          waitCount++
          if (waitCount >= pat) {
            stopEpoch = i
            break
          }
        }
      }

      // Shade the "stopped" region
      if (stopEpoch < epochs - 1) {
        p.noStroke()
        p.fill(244, 63, 94, 15)
        p.rect(mapX(stopEpoch), margin, p.width - margin - mapX(stopEpoch), plotH)

        // Vertical stop line
        p.stroke(244, 63, 94, 180)
        p.strokeWeight(2)
        p.line(mapX(stopEpoch), margin, mapX(stopEpoch), canvasH - margin)

        // Label
        p.noStroke()
        p.fill(244, 63, 94)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`STOP (epoch ${stopEpoch})`, mapX(stopEpoch), margin + 4)
      }

      // Best epoch marker
      p.stroke(250, 204, 21, 120)
      p.strokeWeight(1)
      p.line(mapX(bestEpoch), margin, mapX(bestEpoch), canvasH - margin)
      p.noStroke()
      p.fill(250, 204, 21)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`best (${bestEpoch})`, mapX(bestEpoch), margin - 2)

      // Training loss curve
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i < epochs; i++) {
        p.vertex(mapX(i), mapY(trainLoss[i]))
      }
      p.endShape()

      // Validation loss curve
      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i < epochs; i++) {
        p.vertex(mapX(i), mapY(valLoss[i]))
      }
      p.endShape()

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
      p.line(margin, margin, margin, canvasH - margin)

      // Axis labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Epoch', (margin + p.width - margin) / 2, canvasH - margin + 10)
      p.push()
      p.translate(18, (margin + canvasH - margin) / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Loss', 0, 0)
      p.pop()

      // Tick labels
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (let e = 0; e <= epochs; e += 25) {
        p.text(String(e), mapX(e), canvasH - margin + 2)
      }

      // Legend
      p.noStroke()
      p.fill(99, 102, 241)
      p.rect(p.width - 180, margin + 5, 14, 3)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Training loss', p.width - 162, margin + 7)

      p.fill(52, 211, 153)
      p.rect(p.width - 180, margin + 20, 14, 3)
      p.fill(148, 163, 184)
      p.text('Validation loss', p.width - 162, margin + 22)

      // Info
      p.fill(226, 232, 240)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(
        `Patience: ${pat}  |  Best val loss: ${bestValLoss.toFixed(3)} at epoch ${bestEpoch}  |  Stop: epoch ${stopEpoch}`,
        margin,
        canvasH - margin - plotH - 4,
      )
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Patience:
            <input
              type="range"
              min={3}
              max={50}
              step={1}
              value={patience}
              onChange={e => setPatience(parseInt(e.target.value))}
              className="w-40 accent-emerald-500"
            />
            <span className="w-10 font-mono">{patience}</span>
          </label>
          <span className="text-gray-500">
            {patience <= 5 ? '(aggressive — may stop too early)' : patience <= 15 ? '(moderate)' : patience <= 30 ? '(patient)' : '(very patient — may not stop)'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function HyperparameterTuning() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: What Are Hyperparameters? ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">What Are Hyperparameters?</h2>

        <p className="mb-4">
          Every machine learning model has two kinds of numbers inside it. The first kind —{' '}
          <strong className="text-white">parameters</strong> — are learned from data during training.
          Weights in a neural network, coefficients in linear regression, split thresholds in a
          decision tree: these are all parameters that the training algorithm discovers automatically.
        </p>

        <p className="mb-4">
          The second kind — <strong className="text-white">hyperparameters</strong> — are set{' '}
          <em>before</em> training begins. They control <em>how</em> the model learns, not{' '}
          <em>what</em> it learns. Examples include:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Learning rate</strong> — How big a step does gradient
            descent take at each iteration? Too large and it overshoots; too small and it takes
            forever.
          </li>
          <li>
            <strong className="text-white">K in KNN</strong> — How many neighbors should vote on
            a prediction? K=1 is noisy; K=100 is overly smooth.
          </li>
          <li>
            <strong className="text-white">Max depth in decision trees</strong> — How deep can
            the tree grow? Deeper trees are more expressive but overfit more easily.
          </li>
          <li>
            <strong className="text-white">Regularization strength (lambda)</strong> — How much
            should the model be penalized for complexity? Too much and it underfits; too little
            and it overfits.
          </li>
          <li>
            <strong className="text-white">Number of hidden layers and neurons</strong> — The
            architecture of a neural network is itself a hyperparameter.
          </li>
        </ul>

        <p className="mb-4">
          The challenge: there is no formula for choosing the best hyperparameters. They depend
          on the dataset, the problem, and often interact with each other in complex ways. A
          learning rate that works beautifully with weak regularization might fail with strong
          regularization. This is why we need systematic search strategies.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="pb-2 text-left text-white">Parameters (Learned)</th>
                <th className="pb-2 text-left text-white">Hyperparameters (Set Before Training)</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-700">
                <td className="py-2">Neural network weights</td>
                <td className="py-2">Learning rate, batch size</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2">Linear regression coefficients</td>
                <td className="py-2">Regularization lambda</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2">Tree split thresholds</td>
                <td className="py-2">Max depth, min samples per leaf</td>
              </tr>
              <tr>
                <td className="py-2">SVM support vectors</td>
                <td className="py-2">C, gamma, kernel choice</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========== Section 2: Grid Search ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Grid Search</h2>

        <p className="mb-4">
          The simplest approach: define a discrete set of values for each hyperparameter, then
          try every possible combination. If you have 10 values for learning rate and 10 values
          for regularization, grid search evaluates all 10x10 = 100 combinations and picks the
          one with the best validation score.
        </p>

        <p className="mb-4">
          Grid search is exhaustive and easy to understand. It guarantees you find the best
          combination <em>within the grid</em>. But it scales poorly — with 3 hyperparameters
          and 10 values each, you need 1,000 evaluations. With 5 hyperparameters, that is
          100,000. Each evaluation means training a full model, so computational cost explodes
          exponentially.
        </p>

        <p className="mb-4">
          The heatmap below shows validation score across a grid of learning rate and regularization
          values. Brighter cells indicate better scores. The yellow border marks the best
          combination found. Adjust the grid resolution to see how finer grids find better
          optima but require more evaluations.
        </p>

        <GridSearchSketch />
      </section>

      {/* ========== Section 3: Random Search ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Random Search</h2>

        <p className="mb-4">
          Instead of an exhaustive grid, randomly sample hyperparameter combinations from their
          ranges. This sounds naive, but a landmark 2012 paper by Bergstra and Bengio showed
          that random search is often <em>more efficient</em> than grid search. Why?
        </p>

        <p className="mb-4">
          The key insight is <strong className="text-white">effective dimensionality</strong>.
          In many problems, some hyperparameters matter much more than others. If learning rate
          is critical but regularization barely affects performance, a 5x5 grid gives you only
          5 unique learning rate values across 25 evaluations. Random search with 25 samples
          gives you 25 unique learning rate values — much better coverage of the dimension that
          matters.
        </p>

        <p className="mb-4">
          Each dot below represents one random evaluation. The background shows the true score
          landscape. Increase the sample count and watch how random search efficiently discovers
          good regions.
        </p>

        <RandomSearchSketch />
      </section>

      {/* ========== Section 4: Grid vs Random ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Grid vs Random: Side by Side</h2>

        <p className="mb-4">
          Here is the effective dimensionality argument made visual. In this scenario, learning
          rate matters much more than regularization (the score depends almost entirely on the
          x-axis). Grid search distributes its budget evenly across both axes, wasting evaluations
          on a dimension that does not matter. Random search, by contrast, provides much better
          coverage of the important dimension.
        </p>

        <p className="mb-4">
          Adjust the total evaluation budget and compare. Notice how random search consistently
          samples more unique learning rate values and often finds a better or equal optimum with
          the same budget.
        </p>

        <GridVsRandomSketch />

        <p className="mt-4">
          This does not mean random search is always better. If both hyperparameters matter
          equally and you have a small budget, grid search provides more uniform coverage. In
          practice, random search is the default recommendation because in most problems, some
          hyperparameters matter more than others.
        </p>
      </section>

      {/* ========== Section 5: Bayesian Optimization ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Bayesian Optimization</h2>

        <p className="mb-4">
          Both grid and random search ignore what they have already learned. They choose the
          next evaluation point without considering the scores of previous evaluations.{' '}
          <strong className="text-white">Bayesian optimization</strong> is smarter: it builds a
          probabilistic model (surrogate) of the objective function and uses it to decide where
          to evaluate next.
        </p>

        <p className="mb-4">
          The process works in a loop:
        </p>

        <ol className="mb-6 list-decimal pl-6 space-y-2">
          <li>
            <strong className="text-white">Fit a surrogate model</strong> (typically a Gaussian
            Process) to all observations so far. This gives a predicted score and uncertainty
            at every point.
          </li>
          <li>
            <strong className="text-white">Compute an acquisition function</strong> that balances
            exploitation (choosing points where the predicted score is high) with exploration
            (choosing points where uncertainty is high). Popular choices include Upper Confidence
            Bound (UCB) and Expected Improvement (EI).
          </li>
          <li>
            <strong className="text-white">Evaluate at the point</strong> that maximizes the
            acquisition function, add it to observations, and repeat.
          </li>
        </ol>

        <p className="mb-4">
          The visualization below shows a 1D objective function (dashed green), the surrogate
          model (blue line with uncertainty band), and the acquisition function (yellow, bottom).
          Step through the optimization to watch how the surrogate becomes more accurate and the
          algorithm intelligently chooses where to evaluate next — sampling in uncertain regions
          early on, then focusing near the optimum.
        </p>

        <BayesianOptSketch />

        <p className="mt-4">
          Bayesian optimization shines when evaluations are expensive (e.g., training a large
          neural network takes hours). It typically finds good hyperparameters in 10-30
          evaluations, while random search might need 100+. Libraries like{' '}
          <strong className="text-white">Optuna</strong>,{' '}
          <strong className="text-white">Hyperopt</strong>, and{' '}
          <strong className="text-white">Ax</strong> implement this approach.
        </p>
      </section>

      {/* ========== Section 6: Cross-Validation for Tuning ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Cross-Validation for Tuning</h2>

        <p className="mb-4">
          When tuning hyperparameters, you must be careful about <strong className="text-white">data
          leakage</strong>. If you use the same validation set to both choose hyperparameters and
          report final performance, your reported accuracy will be optimistically biased — you
          have effectively overfit to the validation set.
        </p>

        <p className="mb-4">
          The solution is <strong className="text-white">nested cross-validation</strong>:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Outer loop</strong> — K-fold CV that estimates
            generalization performance. Each fold holds out a different test set.
          </li>
          <li>
            <strong className="text-white">Inner loop</strong> — Within each outer fold, perform
            another round of K-fold CV on the training data to select the best hyperparameters.
          </li>
        </ul>

        <p className="mb-4">
          This way, the test data in the outer loop has never been used for any decision —
          neither model training nor hyperparameter selection. The inner loop&rsquo;s
          &ldquo;validation&rdquo; data is separate from the outer loop&rsquo;s &ldquo;test&rdquo;
          data. The resulting performance estimate is unbiased, though more computationally
          expensive.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-sm text-emerald-400">
            Outer fold 1: [Train1 {'{'}inner CV for HP selection{'}'} ] [Test1]<br />
            Outer fold 2: [Train2 {'{'}inner CV for HP selection{'}'} ] [Test2]<br />
            Outer fold 3: [Train3 {'{'}inner CV for HP selection{'}'} ] [Test3]<br />
            ...<br />
            Final score = average of Test1, Test2, Test3, ...
          </code>
        </div>

        <p className="mb-4">
          For simpler workflows, a train/validation/test split (60/20/20) is often sufficient:
          train models on the training set, select hyperparameters based on the validation set,
          and report final performance on the held-out test set that was never touched during
          tuning.
        </p>
      </section>

      {/* ========== Section 7: Early Stopping ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Early Stopping</h2>

        <p className="mb-4">
          Early stopping is a form of regularization that is particularly relevant to iterative
          models like neural networks and gradient boosting. The idea: monitor the validation
          loss during training and stop when it starts to increase (indicating overfitting).
        </p>

        <p className="mb-4">
          The <strong className="text-white">patience</strong> parameter controls how many epochs
          of no improvement to tolerate before stopping. Low patience stops quickly but risks
          halting during a temporary plateau. High patience allows the model to recover from
          dips but risks training too long into the overfitting zone.
        </p>

        <p className="mb-4">
          In the visualization below, the training loss (blue) keeps decreasing — the model
          keeps memorizing the training data. But the validation loss (green) eventually turns
          upward — the gap between training and validation loss is the hallmark of overfitting.
          The red line marks where early stopping halts training, and the yellow line marks the
          epoch with the best validation loss. Adjust patience to see how it changes the
          stopping point.
        </p>

        <EarlyStoppingSketch />

        <p className="mt-4">
          In practice, early stopping is almost always used when training neural networks. It
          effectively turns the number of training epochs from a hyperparameter you must tune
          into something that is automatically determined. Combined with model checkpointing
          (saving the best model, not the last model), it is one of the simplest and most
          effective regularization techniques.
        </p>
      </section>

      {/* ========== Section 8: Python — Grid and Random Search ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Grid and Random Search</h2>

        <p className="mb-4">
          Let us implement grid search and random search from scratch and compare their
          efficiency at finding optimal hyperparameters.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

np.random.seed(42)

# Generate a classification dataset
n = 300
X = np.random.randn(n, 5)
true_w = np.array([1.5, -0.8, 1.2, 0.0, 0.0])  # Only 3 features matter
y = (X @ true_w + np.random.normal(0, 0.5, n) > 0).astype(int)

# Split: train (60%), val (20%), test (20%)
X_train, X_val, X_test = X[:180], X[180:240], X[240:]
y_train, y_val, y_test = y[:180], y[180:240], y[240:]

# Logistic regression with L2 regularization
def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def train_logreg(X, y, lr, reg_lambda, epochs=200):
    w = np.zeros(X.shape[1])
    b = 0.0
    for _ in range(epochs):
        pred = sigmoid(X @ w + b)
        err = pred - y
        w -= lr * (X.T @ err / len(y) + reg_lambda * w)
        b -= lr * err.mean()
    return w, b

def accuracy(X, y, w, b):
    return ((sigmoid(X @ w + b) >= 0.5).astype(int) == y).mean()

# === Grid Search ===
lr_values = [0.001, 0.01, 0.05, 0.1, 0.5, 1.0]
reg_values = [0.0001, 0.001, 0.01, 0.1, 0.5]

best_grid_score = 0
best_grid_params = {}
grid_evals = 0

for lr in lr_values:
    for reg in reg_values:
        w, b = train_logreg(X_train, y_train, lr, reg)
        score = accuracy(X_val, y_val, w, b)
        grid_evals += 1
        if score > best_grid_score:
            best_grid_score = score
            best_grid_params = {'lr': lr, 'reg': reg}

print(f"=== Grid Search ({grid_evals} evaluations) ===")
print(f"Best params: lr={best_grid_params['lr']}, reg={best_grid_params['reg']}")
print(f"Val accuracy: {best_grid_score:.1%}")

# === Random Search (same budget) ===
best_random_score = 0
best_random_params = {}
rng = np.random.RandomState(42)

for _ in range(grid_evals):
    lr = 10 ** rng.uniform(-3, 0)   # log-uniform [0.001, 1]
    reg = 10 ** rng.uniform(-4, -0.3)  # log-uniform [0.0001, 0.5]
    w, b = train_logreg(X_train, y_train, lr, reg)
    score = accuracy(X_val, y_val, w, b)
    if score > best_random_score:
        best_random_score = score
        best_random_params = {'lr': round(lr, 5), 'reg': round(reg, 5)}

print(f"\\n=== Random Search ({grid_evals} evaluations) ===")
print(f"Best params: lr={best_random_params['lr']}, reg={best_random_params['reg']}")
print(f"Val accuracy: {best_random_score:.1%}")

# Final evaluation on test set
w_grid, b_grid = train_logreg(X_train, y_train, **best_grid_params)
w_rand, b_rand = train_logreg(X_train, y_train, best_random_params['lr'], best_random_params['reg'])

print(f"\\n=== Test Set Performance ===")
print(f"Grid Search:   {accuracy(X_test, y_test, w_grid, b_grid):.1%}")
print(f"Random Search: {accuracy(X_test, y_test, w_rand, b_rand):.1%}")
print(f"\\nRandom search explores continuous ranges,")
print(f"often finding better values between grid points.")`}
        />
      </section>

      {/* ========== Section 9: Python — Validation Curves ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Validation Curves Across Hyperparameter Ranges</h2>

        <p className="mb-4">
          Plotting validation scores across a range of a single hyperparameter produces a
          validation curve — one of the most informative diagnostic tools for understanding
          model behavior.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

np.random.seed(42)

# Generate data
n = 400
X = np.random.randn(n, 3)
y = (1.5 * X[:, 0] - X[:, 1] + 0.8 * X[:, 2] + np.random.normal(0, 0.5, n) > 0).astype(int)

X_train, X_val = X[:280], X[280:]
y_train, y_val = y[:280], y[280:]

def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def train_and_eval(X_tr, y_tr, X_va, y_va, lr, reg, epochs=300):
    w = np.zeros(X_tr.shape[1])
    b = 0.0
    for _ in range(epochs):
        pred = sigmoid(X_tr @ w + b)
        err = pred - y_tr
        w -= lr * (X_tr.T @ err / len(y_tr) + reg * w)
        b -= lr * err.mean()
    train_acc = ((sigmoid(X_tr @ w + b) >= 0.5).astype(int) == y_tr).mean()
    val_acc = ((sigmoid(X_va @ w + b) >= 0.5).astype(int) == y_va).mean()
    return train_acc, val_acc

# === Validation Curve: Regularization Strength ===
print("=== Validation Curve: Regularization (lambda) ===")
print(f"{'Lambda':>12}  {'Train Acc':>10}  {'Val Acc':>10}  {'Gap':>8}  Status")
print("-" * 60)

reg_values = [0.0001, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
best_val = 0
best_reg = 0

for reg in reg_values:
    tr_acc, va_acc = train_and_eval(X_train, y_train, X_val, y_val, lr=0.1, reg=reg)
    gap = tr_acc - va_acc

    if va_acc > best_val:
        best_val = va_acc
        best_reg = reg

    if gap > 0.08:
        status = "overfitting"
    elif va_acc < 0.7:
        status = "underfitting"
    else:
        status = "good"

    print(f"{reg:>12.4f}  {tr_acc:>10.1%}  {va_acc:>10.1%}  {gap:>8.1%}  {status}")

print(f"\\nBest regularization: lambda={best_reg}")

# === Validation Curve: Learning Rate ===
print("\\n=== Validation Curve: Learning Rate ===")
print(f"{'LR':>12}  {'Train Acc':>10}  {'Val Acc':>10}  Status")
print("-" * 52)

lr_values = [0.001, 0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0]
best_val_lr = 0
best_lr = 0

for lr in lr_values:
    tr_acc, va_acc = train_and_eval(X_train, y_train, X_val, y_val, lr=lr, reg=0.01)

    if va_acc > best_val_lr:
        best_val_lr = va_acc
        best_lr = lr

    if tr_acc < 0.6:
        status = "too slow to converge"
    elif va_acc < tr_acc - 0.05:
        status = "unstable"
    else:
        status = "good"

    print(f"{lr:>12.3f}  {tr_acc:>10.1%}  {va_acc:>10.1%}  {status}")

print(f"\\nBest learning rate: {best_lr}")
print(f"\\nKey insight: The gap between train and val accuracy")
print(f"reveals overfitting (large gap) vs underfitting (both low).")`}
        />
      </section>

      {/* ========== Closing ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            Hyperparameters control how a model learns and must be set before training. They
            interact in complex ways and have a significant impact on performance.
          </li>
          <li>
            Grid search is exhaustive but scales exponentially. It works well with few
            hyperparameters (1-2) and when you have a good sense of the range.
          </li>
          <li>
            Random search provides better coverage of important dimensions and is the default
            recommendation for most problems.
          </li>
          <li>
            Bayesian optimization uses past results to choose evaluations intelligently. It is
            ideal when each evaluation is expensive (large models, long training times).
          </li>
          <li>
            Always use a proper validation strategy (held-out validation set or cross-validation)
            to avoid overfitting to the hyperparameter search.
          </li>
          <li>
            Early stopping is a simple, powerful technique that automatically determines training
            duration and acts as regularization.
          </li>
          <li>
            Validation curves (score vs. hyperparameter value) are invaluable for understanding
            the underfitting-overfitting tradeoff.
          </li>
        </ul>
      </section>
    </article>
  )
}
