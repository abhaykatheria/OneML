import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'practical/model-deployment',
  title: 'Model Deployment & MLOps',
  description: 'From notebook to production: model serialization, serving patterns, A/B testing, monitoring, and CI/CD for ML',
  track: 'practical',
  order: 4,
  tags: ['deployment', 'mlops', 'serving', 'monitoring', 'drift', 'ci-cd'],
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/* ------------------------------------------------------------------ */
/* Section 1 — Serving Pipeline Visualization                          */
/* ------------------------------------------------------------------ */

function ServingPipelineSketch() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const requests: { x: number; stage: number; latency: number; startTime: number; color: number[] }[] = []
    const rng = makeRng(77)
    const latencies: number[] = []

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 420)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      t += 1

      const cw = p.width

      // Pipeline stages
      const stages = [
        { label: 'Client\nRequest', x: 0.08, color: [99, 102, 241] },
        { label: 'Load\nBalancer', x: 0.25, color: [168, 85, 247] },
        { label: 'Pre-\nprocess', x: 0.42, color: [250, 204, 21] },
        { label: 'Model\nInference', x: 0.58, color: [52, 211, 153] },
        { label: 'Post-\nprocess', x: 0.74, color: [244, 114, 182] },
        { label: 'Response', x: 0.91, color: [56, 189, 248] },
      ]

      // Draw stage boxes
      const boxW = 80
      const boxH = 60
      const pipeY = 100

      for (let i = 0; i < stages.length; i++) {
        const sx = stages[i].x * cw
        const col = stages[i].color

        // Connection arrow to next stage
        if (i < stages.length - 1) {
          const nx = stages[i + 1].x * cw
          p.stroke(100, 116, 139, 100)
          p.strokeWeight(2)
          const startX = sx + boxW / 2
          const endX = nx - boxW / 2
          p.line(startX, pipeY + boxH / 2, endX, pipeY + boxH / 2)
          // Arrowhead
          p.fill(100, 116, 139, 100)
          p.noStroke()
          p.triangle(endX, pipeY + boxH / 2, endX - 8, pipeY + boxH / 2 - 5, endX - 8, pipeY + boxH / 2 + 5)
        }

        // Box
        p.fill(col[0], col[1], col[2], 30)
        p.stroke(col[0], col[1], col[2], 120)
        p.strokeWeight(1.5)
        p.rect(sx - boxW / 2, pipeY, boxW, boxH, 8)

        // Label
        p.noStroke()
        p.fill(col[0], col[1], col[2])
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        const lines = stages[i].label.split('\n')
        for (let ln = 0; ln < lines.length; ln++) {
          p.text(lines[ln], sx, pipeY + boxH / 2 + (ln - (lines.length - 1) / 2) * 14)
        }
      }

      // Spawn new requests periodically
      if (t % 30 === 0) {
        const lat = 20 + Math.floor(rng() * 80)
        requests.push({
          x: stages[0].x * cw,
          stage: 0,
          latency: lat,
          startTime: t,
          color: [
            150 + Math.floor(rng() * 105),
            150 + Math.floor(rng() * 105),
            200 + Math.floor(rng() * 55),
          ],
        })
      }

      // Animate requests through pipeline
      const dotY = pipeY + boxH / 2
      for (let i = requests.length - 1; i >= 0; i--) {
        const req = requests[i]
        const progress = (t - req.startTime) / (req.latency * 0.8)
        const currentStageFloat = progress * (stages.length - 1)
        const stageIdx = Math.min(stages.length - 1, Math.floor(currentStageFloat))

        if (stageIdx >= stages.length - 1 && progress > 1.1) {
          latencies.push(req.latency)
          if (latencies.length > 50) latencies.shift()
          requests.splice(i, 1)
          continue
        }

        // Position between stages
        const frac = currentStageFloat - stageIdx
        const nextIdx = Math.min(stages.length - 1, stageIdx + 1)
        const rx = lerp(stages[stageIdx].x * cw, stages[nextIdx].x * cw, frac)

        // Draw request dot
        p.noStroke()
        p.fill(req.color[0], req.color[1], req.color[2], 200)
        p.circle(rx, dotY, 10)
        p.fill(req.color[0], req.color[1], req.color[2], 60)
        p.circle(rx, dotY, 18)
      }

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Request \u2192 Response Pipeline', cw / 2, 15)

      // Latency histogram
      if (latencies.length > 0) {
        const histX = 60
        const histY = 210
        const histW = cw - 120
        const histH = 120

        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Latency Distribution (ms)', histX + histW / 2, histY - 5)

        // Compute histogram bins
        const bins = 15
        const maxLat = 120
        const counts = Array(bins).fill(0)
        for (const l of latencies) {
          const bin = Math.min(bins - 1, Math.floor((l / maxLat) * bins))
          counts[bin]++
        }
        const maxCount = Math.max(...counts, 1)

        const binW = histW / bins
        for (let b = 0; b < bins; b++) {
          const bx = histX + b * binW
          const bh = (counts[b] / maxCount) * histH
          p.noStroke()
          p.fill(52, 211, 153, 150)
          p.rect(bx, histY + histH - bh, binW - 2, bh, 2)
        }

        // Axes
        p.fill(100, 116, 139)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('0', histX, histY + histH + 2)
        p.text(`${maxLat}ms`, histX + histW, histY + histH + 2)

        // Stats
        const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const p50 = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)]
        const p99 = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)]

        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        const statsY = histY + histH + 20
        p.text(`Mean: ${avgLat.toFixed(0)}ms`, histX, statsY)
        p.text(`P50: ${p50}ms`, histX + 140, statsY)
        p.text(`P99: ${p99}ms`, histX + 280, statsY)
        p.text(`Requests: ${latencies.length}`, histX + 420, statsY)
      }
    }
  }, [])

  return <P5Sketch sketch={sketch} height={420} />
}

/* ------------------------------------------------------------------ */
/* Section 2 — A/B Testing Visualization                               */
/* ------------------------------------------------------------------ */

function ABTestingSketch() {
  const [splitPct, setSplitPct] = useState(50)
  const splitRef = useRef(splitPct)
  splitRef.current = splitPct

  const sketch = useCallback((p: p5) => {
    let t = 0
    const rng = makeRng(42)
    let modelACorrect = 0
    let modelATotal = 0
    let modelBCorrect = 0
    let modelBTotal = 0
    const historyA: number[] = []
    const historyB: number[] = []
    const particles: { x: number; y: number; targetY: number; model: 'A' | 'B'; correct: boolean; alpha: number; phase: number }[] = []

    // Model A: 72% accuracy, Model B: 78% accuracy
    const accA = 0.72
    const accB = 0.78

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 480)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      t += 1
      const cw = p.width
      const split = splitRef.current / 100

      // Spawn traffic
      if (t % 8 === 0) {
        const goToA = rng() < split
        const model = goToA ? 'A' as const : 'B' as const
        const correct = rng() < (model === 'A' ? accA : accB)

        if (model === 'A') {
          modelATotal++
          if (correct) modelACorrect++
          if (modelATotal > 0) historyA.push(modelACorrect / modelATotal)
        } else {
          modelBTotal++
          if (correct) modelBCorrect++
          if (modelBTotal > 0) historyB.push(modelBCorrect / modelBTotal)
        }

        particles.push({
          x: cw / 2,
          y: 60,
          targetY: model === 'A' ? 130 : 190,
          model,
          correct,
          alpha: 255,
          phase: 0,
        })
      }

      // Draw title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('A/B Testing: Comparing Models in Production', cw / 2, 10)

      // Incoming traffic label
      p.fill(148, 163, 184)
      p.textSize(12)
      p.text('Incoming Traffic', cw / 2, 42)

      // Split indicator
      const splitBarX = cw / 2 - 100
      const splitBarW = 200
      const splitBarY = 70
      p.fill(30, 41, 59)
      p.rect(splitBarX, splitBarY, splitBarW, 12, 6)
      p.fill(99, 102, 241, 180)
      p.rect(splitBarX, splitBarY, splitBarW * split, 12, 6, 0, 0, 6)
      p.fill(52, 211, 153, 180)
      p.rect(splitBarX + splitBarW * split, splitBarY, splitBarW * (1 - split), 12, 0, 6, 6, 0)

      p.fill(99, 102, 241)
      p.textSize(10)
      p.textAlign(p.RIGHT, p.TOP)
      p.text(`A: ${Math.round(split * 100)}%`, splitBarX + splitBarW * split - 4, splitBarY + 16)
      p.fill(52, 211, 153)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`B: ${Math.round((1 - split) * 100)}%`, splitBarX + splitBarW * split + 4, splitBarY + 16)

      // Model boxes
      const boxW = 140
      const boxH = 40

      // Model A
      p.fill(99, 102, 241, 30)
      p.stroke(99, 102, 241, 120)
      p.strokeWeight(1.5)
      p.rect(cw / 2 - boxW / 2, 110, boxW, boxH, 8)
      p.noStroke()
      p.fill(99, 102, 241)
      p.textSize(13)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Model A (baseline)', cw / 2, 130)

      // Model B
      p.fill(52, 211, 153, 30)
      p.stroke(52, 211, 153, 120)
      p.strokeWeight(1.5)
      p.rect(cw / 2 - boxW / 2, 170, boxW, boxH, 8)
      p.noStroke()
      p.fill(52, 211, 153)
      p.text('Model B (challenger)', cw / 2, 190)

      // Animate particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const part = particles[i]
        part.phase += 0.05

        if (part.phase < 1) {
          // Moving toward model
          part.y = lerp(60, part.targetY, part.phase)
        } else {
          part.alpha -= 8
        }

        if (part.alpha <= 0) {
          particles.splice(i, 1)
          continue
        }

        const col = part.model === 'A' ? [99, 102, 241] : [52, 211, 153]
        p.noStroke()
        p.fill(col[0], col[1], col[2], part.alpha)
        p.circle(part.x + (part.model === 'A' ? -30 : 30) + Math.sin(part.phase * 4) * 10, part.y, 6)
      }

      // Accuracy over time chart
      const chartX = 60
      const chartY = 240
      const chartW = cw - 120
      const chartH = 160

      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Accuracy Over Time', chartX + chartW / 2, chartY - 8)

      // Chart background
      p.fill(20, 27, 45)
      p.noStroke()
      p.rect(chartX, chartY, chartW, chartH, 4)

      // Grid lines
      p.stroke(40, 50, 70)
      p.strokeWeight(0.5)
      for (let g = 0; g <= 4; g++) {
        const gy = chartY + (g / 4) * chartH
        p.line(chartX, gy, chartX + chartW, gy)
      }

      // Y-axis labels
      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.RIGHT, p.CENTER)
      for (let g = 0; g <= 4; g++) {
        const val = 1.0 - g * 0.25
        p.text(val.toFixed(2), chartX - 5, chartY + (g / 4) * chartH)
      }

      // Draw history lines
      const drawLine = (history: number[], color: number[]) => {
        if (history.length < 2) return
        const maxPts = 200
        const start = Math.max(0, history.length - maxPts)
        const pts = history.slice(start)

        p.stroke(color[0], color[1], color[2], 200)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < pts.length; i++) {
          const px = chartX + (i / Math.max(1, pts.length - 1)) * chartW
          const py = chartY + (1 - pts[i]) * chartH
          p.vertex(px, py)
        }
        p.endShape()
      }

      drawLine(historyA, [99, 102, 241])
      drawLine(historyB, [52, 211, 153])

      // Legend and stats
      const statsY = chartY + chartH + 20
      p.noStroke()

      const rateA = modelATotal > 0 ? (modelACorrect / modelATotal * 100).toFixed(1) : '---'
      const rateB = modelBTotal > 0 ? (modelBCorrect / modelBTotal * 100).toFixed(1) : '---'

      p.fill(99, 102, 241)
      p.rect(chartX, statsY, 12, 12, 2)
      p.fill(200, 200, 200)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Model A: ${rateA}% accuracy (n=${modelATotal})`, chartX + 18, statsY)

      p.fill(52, 211, 153)
      p.rect(chartX + chartW / 2, statsY, 12, 12, 2)
      p.fill(200, 200, 200)
      p.text(`Model B: ${rateB}% accuracy (n=${modelBTotal})`, chartX + chartW / 2 + 18, statsY)

      // Statistical significance hint
      if (modelATotal > 20 && modelBTotal > 20) {
        const diff = Math.abs((modelACorrect / modelATotal) - (modelBCorrect / modelBTotal))
        const needed = 1.96 * Math.sqrt(0.75 * 0.25 * (1 / modelATotal + 1 / modelBTotal))
        const sig = diff > needed
        p.fill(sig ? 52 : 250, sig ? 211 : 204, sig ? 153 : 21)
        p.textAlign(p.CENTER, p.TOP)
        p.text(
          sig ? 'Result is statistically significant (p < 0.05)' : 'Not yet statistically significant \u2014 need more data',
          cw / 2,
          statsY + 22,
        )
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={480}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Traffic Split (% to Model A):
            <input type="range" min={10} max={90} step={1} value={splitPct}
              onChange={(e) => setSplitPct(parseInt(e.target.value))} className="w-48" />
            <span className="w-16 font-mono">{splitPct}% / {100 - splitPct}%</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Data Drift & Monitoring Visualization                   */
/* ------------------------------------------------------------------ */

function DataDriftSketch() {
  const [driftAmount, setDriftAmount] = useState(0)
  const driftRef = useRef(driftAmount)
  driftRef.current = driftAmount

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 440)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const cw = p.width
      const drift = driftRef.current

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Data Drift: Training Distribution vs Production Data', cw / 2, 12)

      // Generate training distribution (Gaussian, mean=50, std=12)
      const trainMean = 50
      const trainStd = 12

      // Production distribution shifts by drift amount
      const prodMean = trainMean + drift * 25
      const prodStd = trainStd + drift * 8

      // Compute PDFs
      const bins = 100
      const xMin = 0
      const xMax = 120
      const trainPDF: number[] = []
      const prodPDF: number[] = []

      const gaussian = (x: number, mu: number, sigma: number) => {
        const z = (x - mu) / sigma
        return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
      }

      for (let i = 0; i < bins; i++) {
        const x = xMin + (i / bins) * (xMax - xMin)
        trainPDF.push(gaussian(x, trainMean, trainStd))
        prodPDF.push(gaussian(x, prodMean, prodStd))
      }

      const maxPDF = Math.max(...trainPDF, ...prodPDF, 0.001)

      // Draw distributions
      const distX = 80
      const distY = 60
      const distW = cw - 160
      const distH = 180

      // Background
      p.fill(20, 27, 45)
      p.noStroke()
      p.rect(distX, distY, distW, distH, 4)

      // Grid
      p.stroke(40, 50, 70)
      p.strokeWeight(0.5)
      for (let g = 0; g <= 4; g++) {
        const gy = distY + (g / 4) * distH
        p.line(distX, gy, distX + distW, gy)
      }

      // Training distribution (filled)
      p.fill(99, 102, 241, 60)
      p.stroke(99, 102, 241, 180)
      p.strokeWeight(1.5)
      p.beginShape()
      p.vertex(distX, distY + distH)
      for (let i = 0; i < bins; i++) {
        const px = distX + (i / bins) * distW
        const py = distY + distH - (trainPDF[i] / maxPDF) * distH
        p.vertex(px, py)
      }
      p.vertex(distX + distW, distY + distH)
      p.endShape(p.CLOSE)

      // Production distribution (filled)
      p.fill(250, 204, 21, 40)
      p.stroke(250, 204, 21, 180)
      p.strokeWeight(1.5)
      p.beginShape()
      p.vertex(distX, distY + distH)
      for (let i = 0; i < bins; i++) {
        const px = distX + (i / bins) * distW
        const py = distY + distH - (prodPDF[i] / maxPDF) * distH
        p.vertex(px, py)
      }
      p.vertex(distX + distW, distY + distH)
      p.endShape(p.CLOSE)

      // X-axis
      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (let i = 0; i <= 6; i++) {
        const val = xMin + (i / 6) * (xMax - xMin)
        p.text(val.toFixed(0), distX + (i / 6) * distW, distY + distH + 4)
      }
      p.textSize(11)
      p.text('Feature Value', distX + distW / 2, distY + distH + 18)

      // Legend
      p.fill(99, 102, 241, 180)
      p.rect(distX, distY - 22, 12, 10, 2)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Training Distribution', distX + 16, distY - 22)

      p.fill(250, 204, 21, 180)
      p.rect(distX + 160, distY - 22, 12, 10, 2)
      p.fill(148, 163, 184)
      p.text('Production Data', distX + 176, distY - 22)

      // Compute KL divergence
      let kl = 0
      for (let i = 0; i < bins; i++) {
        const pVal = Math.max(prodPDF[i], 1e-10)
        const qVal = Math.max(trainPDF[i], 1e-10)
        kl += pVal * Math.log(pVal / qVal) * ((xMax - xMin) / bins)
      }
      kl = Math.max(0, kl)

      // KL divergence gauge
      const gaugeX = 80
      const gaugeY = 280
      const gaugeW = cw - 160
      const gaugeH = 30

      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('KL Divergence (Production || Training)', gaugeX, gaugeY - 8)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text(kl.toFixed(4), gaugeX + gaugeW, gaugeY - 8)

      // Gauge background
      p.fill(30, 41, 59)
      p.noStroke()
      p.rect(gaugeX, gaugeY, gaugeW, gaugeH, 6)

      // Gauge fill — color from green to red based on KL
      const klNorm = Math.min(1, kl / 3)
      const r = Math.floor(lerp(52, 239, klNorm))
      const g = Math.floor(lerp(211, 68, klNorm))
      const b = Math.floor(lerp(153, 68, klNorm))
      p.fill(r, g, b, 200)
      p.rect(gaugeX, gaugeY, gaugeW * klNorm, gaugeH, 6)

      // Threshold markers
      p.stroke(148, 163, 184, 100)
      p.strokeWeight(1)
      const warnThresh = 0.5 / 3
      const critThresh = 1.5 / 3
      p.line(gaugeX + gaugeW * warnThresh, gaugeY, gaugeX + gaugeW * warnThresh, gaugeY + gaugeH)
      p.line(gaugeX + gaugeW * critThresh, gaugeY, gaugeX + gaugeW * critThresh, gaugeY + gaugeH)

      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Warning', gaugeX + gaugeW * warnThresh, gaugeY + gaugeH + 4)
      p.text('Critical', gaugeX + gaugeW * critThresh, gaugeY + gaugeH + 4)

      // Alert status
      const alertY = gaugeY + gaugeH + 30
      let alertText: string
      let alertColor: number[]

      if (kl < 0.5) {
        alertText = 'STATUS: Healthy \u2014 distributions are aligned'
        alertColor = [52, 211, 153]
      } else if (kl < 1.5) {
        alertText = 'WARNING: Moderate drift detected \u2014 investigate feature distributions'
        alertColor = [250, 204, 21]
      } else {
        alertText = 'CRITICAL: Severe drift \u2014 consider retraining the model'
        alertColor = [239, 68, 68]
      }

      p.fill(alertColor[0], alertColor[1], alertColor[2], 30)
      p.rect(gaugeX, alertY, gaugeW, 30, 6)
      p.fill(alertColor[0], alertColor[1], alertColor[2])
      p.textSize(12)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(alertText, gaugeX + gaugeW / 2, alertY + 15)

      // Model accuracy degradation
      const degradeY = alertY + 50
      const baseAccuracy = 0.92
      const degradedAccuracy = Math.max(0.5, baseAccuracy - kl * 0.12)

      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Model accuracy at training time:', gaugeX, degradeY)
      p.fill(52, 211, 153)
      p.text(`${(baseAccuracy * 100).toFixed(1)}%`, gaugeX + 220, degradeY)

      p.fill(148, 163, 184)
      p.text('Estimated accuracy with drift:', gaugeX, degradeY + 22)
      const accColor = degradedAccuracy > 0.85 ? [52, 211, 153] : degradedAccuracy > 0.7 ? [250, 204, 21] : [239, 68, 68]
      p.fill(accColor[0], accColor[1], accColor[2])
      p.text(`${(degradedAccuracy * 100).toFixed(1)}%`, gaugeX + 220, degradeY + 22)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Time Progression (drift amount):
            <input type="range" min={0} max={100} step={1} value={driftAmount}
              onChange={(e) => setDriftAmount(parseInt(e.target.value) / 100)} className="w-48" />
            <span className="w-16 font-mono">{(driftAmount * 100).toFixed(0)}%</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const servingCode = `import numpy as np
import time

# Simulate a model serving endpoint
# In production this would be a REST API (Flask/FastAPI) or gRPC service

class ModelServer:
    """Simulates a model inference server with preprocessing and postprocessing."""

    def __init__(self, model_weights, feature_means, feature_stds):
        self.weights = np.array(model_weights)
        self.feature_means = np.array(feature_means)
        self.feature_stds = np.array(feature_stds)
        self.request_count = 0
        self.latencies = []

    def preprocess(self, raw_input):
        """Normalize features using training statistics."""
        return (np.array(raw_input) - self.feature_means) / self.feature_stds

    def predict(self, features):
        """Logistic regression inference."""
        logit = features @ self.weights[:-1] + self.weights[-1]
        prob = 1 / (1 + np.exp(-logit))
        return float(prob)

    def postprocess(self, probability, threshold=0.5):
        """Convert probability to decision with confidence."""
        return {
            "prediction": "positive" if probability >= threshold else "negative",
            "confidence": float(max(probability, 1 - probability)),
            "probability": float(probability)
        }

    def serve(self, raw_input, threshold=0.5):
        """Full serving pipeline: preprocess -> predict -> postprocess."""
        start = time.time()

        features = self.preprocess(raw_input)
        prob = self.predict(features)
        result = self.postprocess(prob, threshold)

        latency_ms = (time.time() - start) * 1000
        self.request_count += 1
        self.latencies.append(latency_ms)

        result["latency_ms"] = round(latency_ms, 3)
        result["request_id"] = self.request_count
        return result


# Create a trained model server
np.random.seed(42)
weights = np.random.randn(5)  # 4 features + 1 bias
server = ModelServer(
    model_weights=weights,
    feature_means=[5.0, 3.0, 4.0, 1.2],
    feature_stds=[0.8, 0.4, 1.5, 0.7]
)

# Simulate 100 requests
print("Simulating 100 inference requests...\\n")
results = []
for i in range(100):
    # Random input mimicking real features
    raw = np.random.randn(4) * [0.8, 0.4, 1.5, 0.7] + [5.0, 3.0, 4.0, 1.2]
    result = server.serve(raw.tolist())
    results.append(result)

# Show a few example responses
print("Sample responses:")
for r in results[:3]:
    print(f"  Request #{r['request_id']}: {r['prediction']} "
          f"(conf={r['confidence']:.3f}, latency={r['latency_ms']:.3f}ms)")

# Aggregate latency statistics
lats = [r['latency_ms'] for r in results]
print(f"\\nLatency Statistics ({len(lats)} requests):")
print(f"  Mean:   {np.mean(lats):.3f} ms")
print(f"  Median: {np.median(lats):.3f} ms")
print(f"  P95:    {np.percentile(lats, 95):.3f} ms")
print(f"  P99:    {np.percentile(lats, 99):.3f} ms")

# Prediction distribution
preds = [r['prediction'] for r in results]
print(f"\\nPrediction Distribution:")
print(f"  Positive: {preds.count('positive')}")
print(f"  Negative: {preds.count('negative')}")
`

const driftDetectionCode = `import numpy as np

# Detect data drift by comparing training vs production distributions

def compute_kl_divergence(p_hist, q_hist):
    """KL(P || Q) - measures how P diverges from Q."""
    p = np.array(p_hist, dtype=float)
    q = np.array(q_hist, dtype=float)
    # Smooth to avoid log(0)
    p = (p + 1e-10) / p.sum()
    q = (q + 1e-10) / q.sum()
    return float(np.sum(p * np.log(p / q)))

def compute_psi(expected, actual, bins=10):
    """Population Stability Index — commonly used in production monitoring."""
    e_hist, bin_edges = np.histogram(expected, bins=bins, density=False)
    a_hist, _ = np.histogram(actual, bins=bin_edges, density=False)

    e_pct = (e_hist + 1) / (len(expected) + bins)
    a_pct = (a_hist + 1) / (len(actual) + bins)

    psi = np.sum((a_pct - e_pct) * np.log(a_pct / e_pct))
    return float(psi)

def ks_test_statistic(sample1, sample2):
    """Kolmogorov-Smirnov test statistic for two samples."""
    all_values = np.sort(np.concatenate([sample1, sample2]))
    cdf1 = np.searchsorted(np.sort(sample1), all_values, side='right') / len(sample1)
    cdf2 = np.searchsorted(np.sort(sample2), all_values, side='right') / len(sample2)
    return float(np.max(np.abs(cdf1 - cdf2)))

# Simulate training data (what the model was trained on)
np.random.seed(42)
n_train = 1000
train_feature1 = np.random.normal(50, 10, n_train)
train_feature2 = np.random.exponential(5, n_train)

# Simulate production data with increasing drift
print("=== Data Drift Detection Report ===\\n")
print(f"{'Time Period':<20} {'Feature':<12} {'KL Div':<10} {'PSI':<10} {'KS Stat':<10} {'Alert'}")
print("-" * 72)

for month, drift in [("Month 1", 0), ("Month 2", 2), ("Month 3", 5),
                       ("Month 4", 10), ("Month 6", 20)]:
    prod_f1 = np.random.normal(50 + drift, 10 + drift * 0.3, 500)
    prod_f2 = np.random.exponential(5 + drift * 0.2, 500)

    for fname, train_data, prod_data in [("Feature 1", train_feature1, prod_f1),
                                          ("Feature 2", train_feature2, prod_f2)]:
        bins = 30
        t_hist, edges = np.histogram(train_data, bins=bins, density=False)
        p_hist, _ = np.histogram(prod_data, bins=edges, density=False)

        kl = compute_kl_divergence(p_hist, t_hist)
        psi = compute_psi(train_data, prod_data)
        ks = ks_test_statistic(train_data, prod_data)

        if psi > 0.25:
            alert = "CRITICAL"
        elif psi > 0.1:
            alert = "WARNING"
        else:
            alert = "OK"

        print(f"{month:<20} {fname:<12} {kl:<10.4f} {psi:<10.4f} {ks:<10.4f} {alert}")

print("\\n--- Interpretation Guide ---")
print("PSI < 0.1:    No significant drift")
print("PSI 0.1-0.25: Moderate drift, investigate")
print("PSI > 0.25:   Significant drift, consider retraining")
print("\\nKL Divergence measures information lost when using training distribution")
print("to approximate production distribution. Higher = more drift.")
print("\\nKS Statistic measures max difference between CDFs. Values > 0.1")
print("typically indicate meaningful distribution shift.")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function ModelDeployment() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* ---- Intro ---- */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Model Deployment & MLOps</h2>
        <p className="mb-3 text-gray-300">
          Training a model in a Jupyter notebook is only the beginning. The real challenge is getting
          that model into production where it serves real users reliably, scales under load, and
          maintains performance over time. This is the domain of MLOps &mdash; the intersection of
          machine learning, DevOps, and data engineering.
        </p>
        <p className="text-gray-300">
          The gap between a notebook prototype and a production system is enormous. Your notebook
          model might achieve 95% accuracy on a test set, but production brings new challenges:
          input data that looks nothing like your training data, latency requirements measured in
          milliseconds, the need for monitoring and alerting, versioning of both models and data,
          and the organizational challenge of keeping models up-to-date as the world changes.
        </p>
      </section>

      {/* ---- Serialization ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Model Serialization</h2>
        <p className="mb-3 text-gray-300">
          Before deploying, you need to save your trained model in a format that can be loaded in
          a serving environment. There is no universal answer &mdash; the right format depends on
          your framework, target platform, and performance requirements.
        </p>
        <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-lg font-semibold text-white">Serialization Formats</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-purple-400">Pickle / Joblib</span> &mdash;
              Python-native serialization. Fast and easy for scikit-learn models. But fragile:
              pickle files are tied to exact Python and library versions. Never use pickle for
              long-term storage or cross-platform serving. Security risk from untrusted sources.
            </div>
            <div>
              <span className="font-semibold text-blue-400">ONNX (Open Neural Network Exchange)</span> &mdash;
              Framework-agnostic format. Export from PyTorch, TensorFlow, scikit-learn and run
              inference in any ONNX runtime (C++, Java, JavaScript, etc.). Excellent for
              cross-platform deployment and edge devices.
            </div>
            <div>
              <span className="font-semibold text-green-400">SavedModel (TensorFlow) / TorchScript (PyTorch)</span> &mdash;
              Native framework formats that capture the full computation graph. Optimized for
              their respective serving infrastructure (TF Serving, TorchServe). Support
              hardware-specific optimizations like GPU acceleration and quantization.
            </div>
            <div>
              <span className="font-semibold text-yellow-400">PMML / PFA</span> &mdash;
              XML/JSON-based standards for simpler models (linear, trees). Used in enterprise
              environments where XML pipelines are standard. Less common in modern ML stacks.
            </div>
          </div>
        </div>
        <p className="text-gray-300">
          Rule of thumb: use ONNX when you need portability across platforms, use native framework
          formats when you are staying within one ecosystem and need maximum performance, and avoid
          pickle for anything beyond quick local experiments.
        </p>
      </section>

      {/* ---- Serving Patterns ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Serving Patterns</h2>
        <p className="mb-4 text-gray-300">
          How you serve predictions depends on your use case. A fraud detection system needs
          sub-millisecond responses on every transaction. A recommendation engine might batch-process
          millions of users overnight. A chatbot streams tokens one at a time. Each pattern has
          different infrastructure, latency, and cost characteristics.
        </p>
        <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-indigo-400">REST API (Online Serving)</span> &mdash;
              Synchronous request/response. Client sends input, waits for prediction. Typical
              latency target: 10-100ms. Use Flask, FastAPI, or managed services like SageMaker
              Endpoints. Scale horizontally with load balancers.
            </div>
            <div>
              <span className="font-semibold text-green-400">Batch Inference</span> &mdash;
              Process large datasets offline (hourly, daily). No latency requirement. Run on
              Spark, AWS Batch, or simple cron jobs. Cost-effective for recommendations, scoring
              pipelines, and feature precomputation.
            </div>
            <div>
              <span className="font-semibold text-pink-400">Streaming</span> &mdash;
              Real-time processing of event streams (Kafka, Kinesis). Model processes events as
              they arrive. Used for anomaly detection, real-time recommendations, and
              token-by-token LLM generation.
            </div>
          </div>
        </div>
        <p className="mb-4 text-gray-300">
          The visualization below shows the journey of a request through a typical online serving
          pipeline. Notice how each stage adds latency &mdash; preprocessing, model inference, and
          postprocessing all contribute to the total response time.
        </p>
        <ServingPipelineSketch />
      </section>

      {/* ---- A/B Testing ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">A/B Testing Models in Production</h2>
        <p className="mb-4 text-gray-300">
          When you have a new model that looks better on offline metrics, how do you know it will
          actually perform better in production? Offline evaluation can be misleading &mdash; the
          test set might not represent current user behavior, or the model might have unexpected
          failure modes. A/B testing lets you compare models safely by splitting live traffic.
        </p>
        <p className="mb-4 text-gray-300">
          In the visualization below, incoming traffic is split between Model A (the baseline)
          and Model B (the challenger). Watch how the accuracy estimates converge over time, and
          how statistical significance emerges as more data accumulates. Try adjusting the traffic
          split &mdash; sending more traffic to the challenger gives you faster results but
          increases risk.
        </p>
        <ABTestingSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">A/B Testing Best Practices</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
            <li>Start with a small traffic percentage (5-10%) to limit blast radius</li>
            <li>Run the test long enough to reach statistical significance</li>
            <li>Monitor not just accuracy but also latency, error rates, and business metrics</li>
            <li>Use guardrails: automatically roll back if the challenger performs much worse</li>
            <li>Account for novelty effects &mdash; users might interact differently with new features initially</li>
          </ul>
        </div>
      </section>

      {/* ---- Monitoring & Data Drift ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Monitoring & Data Drift</h2>
        <p className="mb-4 text-gray-300">
          Models do not age like wine. They degrade over time as the world changes. A fraud model
          trained on 2023 transactions will miss 2024 fraud patterns. A recommendation engine
          trained before a pandemic will not understand post-pandemic behavior. This phenomenon
          is called <span className="text-yellow-400">data drift</span> (or concept drift), and it
          is the single biggest reason production models fail silently.
        </p>
        <p className="mb-4 text-gray-300">
          The visualization below shows a training distribution (blue) and production data
          (yellow). Use the slider to simulate time passing &mdash; notice how the production data
          gradually shifts away from what the model was trained on. The KL divergence measures
          this shift quantitatively. As drift increases, the model&apos;s effective accuracy drops
          even though nothing about the model itself has changed.
        </p>
        <DataDriftSketch />
        <p className="mt-4 text-gray-300">
          Production monitoring should track: input feature distributions (to catch data drift),
          prediction distributions (to catch concept drift), model latency and throughput, error
          rates, and downstream business metrics. Set up automated alerts at different severity
          levels so your team knows when to investigate and when to retrain.
        </p>
      </section>

      {/* ---- CI/CD for ML ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">CI/CD for Machine Learning</h2>
        <p className="mb-3 text-gray-300">
          Traditional CI/CD tests code changes. ML CI/CD must also validate data and models.
          A code change might break nothing in unit tests but produce a model with terrible
          performance. The ML pipeline needs additional validation gates.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-lg font-semibold text-white">ML Pipeline Stages</h3>
          <div className="space-y-4 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">1</span>
              <div>
                <span className="font-semibold text-white">Data Validation</span> &mdash;
                Check schema, value ranges, null rates, distribution statistics against historical
                baselines. Catch data pipeline issues before they poison your model.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">2</span>
              <div>
                <span className="font-semibold text-white">Training</span> &mdash;
                Reproducible training with pinned dependencies, random seeds, and tracked
                hyperparameters. Store the training dataset version alongside the model.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">3</span>
              <div>
                <span className="font-semibold text-white">Model Validation</span> &mdash;
                Automated tests: accuracy must exceed baseline, no regression on critical slices,
                latency within budget, model size within limits, fairness metrics pass thresholds.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">4</span>
              <div>
                <span className="font-semibold text-white">Staging Deployment</span> &mdash;
                Deploy to a staging environment with shadow traffic. Compare predictions against
                the current production model before any traffic shift.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-block rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">5</span>
              <div>
                <span className="font-semibold text-white">Canary / A/B Rollout</span> &mdash;
                Gradually shift traffic to the new model. Monitor all metrics. Auto-rollback if
                degradation is detected.
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-gray-300">
          Tools like MLflow, DVC, Weights & Biases, and Kubeflow Pipelines help automate these
          stages. The key insight is that ML systems have three axes of change &mdash; code, data,
          and model &mdash; and all three must be versioned, tested, and monitored.
        </p>
      </section>

      {/* ---- Model Versioning ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Model Versioning & Experiment Tracking</h2>
        <p className="mb-3 text-gray-300">
          In software engineering, git tracks code changes. In ML, you also need to track which
          data was used, which hyperparameters were set, what the evaluation metrics were, and what
          the resulting model artifact looks like. Without this, reproducing a result from three
          months ago becomes nearly impossible.
        </p>
        <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">What to Version</h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-purple-400">Code</span>: git commit hash,
              branch, training script version
            </div>
            <div>
              <span className="font-semibold text-blue-400">Data</span>: dataset version or hash,
              preprocessing config, feature definitions
            </div>
            <div>
              <span className="font-semibold text-green-400">Model</span>: architecture,
              hyperparameters, trained weights, serialization format
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Metrics</span>: train/val/test
              scores, per-slice performance, latency benchmarks
            </div>
            <div>
              <span className="font-semibold text-pink-400">Environment</span>: Python version,
              library versions, hardware (GPU type, memory)
            </div>
            <div>
              <span className="font-semibold text-cyan-400">Lineage</span>: which training run
              produced which model, parent experiments
            </div>
          </div>
        </div>
        <p className="text-gray-300">
          A model registry (like MLflow Model Registry or SageMaker Model Registry) acts as the
          single source of truth. Each model has a lifecycle: experimental, staging, production,
          archived. Promotion between stages is gated by automated tests and human review.
        </p>
      </section>

      {/* ---- Python: Serving Simulation ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Hands-On: Simulating a Serving Endpoint</h2>
        <p className="mb-4 text-gray-300">
          The code below simulates a model serving endpoint with preprocessing, inference, and
          postprocessing stages. It measures per-request latency and computes latency percentiles
          &mdash; the metrics you would monitor in a real deployment.
        </p>
        <PythonCell defaultCode={servingCode} />
      </section>

      {/* ---- Python: Drift Detection ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Hands-On: Detecting Data Drift</h2>
        <p className="mb-4 text-gray-300">
          This code compares training and production distributions using three complementary metrics:
          KL divergence measures information-theoretic distance, PSI (Population Stability Index) is
          the industry standard for drift monitoring, and the Kolmogorov-Smirnov statistic measures
          the maximum CDF difference. Watch how all three metrics increase as drift grows over time.
        </p>
        <PythonCell defaultCode={driftDetectionCode} />
      </section>

      {/* ---- Summary ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Key Takeaways</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <ul className="list-disc space-y-2 pl-5 text-gray-300">
            <li>
              <span className="font-semibold text-white">Serialization matters</span>: choose the
              right format for your deployment target. ONNX for portability, native formats for
              performance.
            </li>
            <li>
              <span className="font-semibold text-white">Match serving pattern to use case</span>:
              online for real-time decisions, batch for bulk processing, streaming for event-driven
              systems.
            </li>
            <li>
              <span className="font-semibold text-white">A/B test before full rollout</span>:
              offline metrics are necessary but not sufficient. Production behavior can surprise you.
            </li>
            <li>
              <span className="font-semibold text-white">Monitor for drift continuously</span>:
              models degrade silently. Track input distributions, prediction distributions, and
              business metrics.
            </li>
            <li>
              <span className="font-semibold text-white">Version everything</span>: code, data,
              models, and metrics. Reproducibility is not optional in production ML.
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
