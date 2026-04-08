import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'practical/data-preprocessing',
  title: 'Data Preprocessing',
  description: 'Cleaning, scaling, encoding, and balancing real-world data before it ever touches a model',
  track: 'practical',
  order: 1,
  tags: ['preprocessing', 'missing-values', 'scaling', 'encoding', 'imbalanced', 'outliers'],
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
/* Section 2 — Missing Values Sketch                                   */
/* ------------------------------------------------------------------ */

interface TableRow {
  age: number | null
  income: number | null
  score: number | null
}

function generateTableData(seed: number): TableRow[] {
  const rng = makeRng(seed)
  const rows: TableRow[] = []
  for (let i = 0; i < 10; i++) {
    rows.push({
      age: rng() < 0.2 ? null : Math.round(22 + rng() * 40),
      income: rng() < 0.25 ? null : Math.round(30000 + rng() * 70000),
      score: rng() < 0.15 ? null : Math.round(40 + rng() * 60),
    })
  }
  return rows
}

function MissingValuesSketch() {
  const [strategy, setStrategy] = useState<'original' | 'drop' | 'mean' | 'median' | 'forward'>(
    'original'
  )
  const strategyRef = useRef(strategy)
  strategyRef.current = strategy

  const rawData = useRef(generateTableData(42)).current

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const colLabels = ['Row', 'Age', 'Income', 'Score']
    const colWidths = [0.1, 0.25, 0.35, 0.3]

    function getMean(arr: (number | null)[]): number {
      const valid = arr.filter((v): v is number => v !== null)
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
    }

    function getMedian(arr: (number | null)[]): number {
      const valid = arr.filter((v): v is number => v !== null).sort((a, b) => a - b)
      if (valid.length === 0) return 0
      const mid = Math.floor(valid.length / 2)
      return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid]
    }

    function applyStrategy(data: TableRow[]): (TableRow & { imputed: { age: boolean; income: boolean; score: boolean } })[] {
      const strat = strategyRef.current

      if (strat === 'original') {
        return data.map(r => ({ ...r, imputed: { age: false, income: false, score: false } }))
      }

      if (strat === 'drop') {
        return data
          .filter(r => r.age !== null && r.income !== null && r.score !== null)
          .map(r => ({ ...r, imputed: { age: false, income: false, score: false } }))
      }

      const ages = data.map(r => r.age)
      const incomes = data.map(r => r.income)
      const scores = data.map(r => r.score)

      if (strat === 'mean') {
        const meanAge = Math.round(getMean(ages))
        const meanIncome = Math.round(getMean(incomes))
        const meanScore = Math.round(getMean(scores))
        return data.map(r => ({
          age: r.age ?? meanAge,
          income: r.income ?? meanIncome,
          score: r.score ?? meanScore,
          imputed: { age: r.age === null, income: r.income === null, score: r.score === null },
        }))
      }

      if (strat === 'median') {
        const medAge = Math.round(getMedian(ages))
        const medIncome = Math.round(getMedian(incomes))
        const medScore = Math.round(getMedian(scores))
        return data.map(r => ({
          age: r.age ?? medAge,
          income: r.income ?? medIncome,
          score: r.score ?? medScore,
          imputed: { age: r.age === null, income: r.income === null, score: r.score === null },
        }))
      }

      // forward fill
      const result: (TableRow & { imputed: { age: boolean; income: boolean; score: boolean } })[] = []
      let lastAge: number | null = null
      let lastIncome: number | null = null
      let lastScore: number | null = null
      for (const r of data) {
        const imp = { age: false, income: false, score: false }
        let age = r.age
        let income = r.income
        let score = r.score
        if (age === null && lastAge !== null) { age = lastAge; imp.age = true }
        if (income === null && lastIncome !== null) { income = lastIncome; imp.income = true }
        if (score === null && lastScore !== null) { score = lastScore; imp.score = true }
        if (age !== null) lastAge = age
        if (income !== null) lastIncome = income
        if (score !== null) lastScore = score
        result.push({ age, income, score, imputed: imp })
      }
      return result
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const processed = applyStrategy(rawData)
      const rowH = 32
      const headerY = 30
      const startY = headerY + rowH + 8
      const tableW = p.width - 60
      const tableX = 30

      // Title
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`Strategy: ${strategyRef.current.toUpperCase()}`, p.width / 2, 6)

      // Column headers
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.CENTER)
      let cx = tableX
      for (let c = 0; c < colLabels.length; c++) {
        const w = tableW * colWidths[c]
        p.text(colLabels[c], cx + w / 2, headerY + rowH / 2)
        cx += w
      }

      // Header line
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(tableX, headerY + rowH, tableX + tableW, headerY + rowH)

      // Data rows
      for (let i = 0; i < processed.length; i++) {
        const row = processed[i]
        const y = startY + i * rowH

        // Alternating row bg
        if (i % 2 === 0) {
          p.noStroke()
          p.fill(30, 41, 59, 80)
          p.rect(tableX, y, tableW, rowH)
        }

        cx = tableX
        const values: { text: string; imputed: boolean }[] = [
          { text: String(i + 1), imputed: false },
          { text: row.age !== null ? String(row.age) : 'NaN', imputed: row.imputed.age },
          { text: row.income !== null ? `$${row.income.toLocaleString()}` : 'NaN', imputed: row.imputed.income },
          { text: row.score !== null ? String(row.score) : 'NaN', imputed: row.imputed.score },
        ]

        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        for (let c = 0; c < values.length; c++) {
          const w = tableW * colWidths[c]
          const v = values[c]
          if (v.text === 'NaN') {
            p.noStroke()
            p.fill(244, 63, 94, 40)
            p.rect(cx + 2, y + 2, w - 4, rowH - 4, 4)
            p.fill(244, 63, 94)
            p.text('NaN', cx + w / 2, y + rowH / 2)
          } else if (v.imputed) {
            p.noStroke()
            p.fill(52, 211, 153, 30)
            p.rect(cx + 2, y + 2, w - 4, rowH - 4, 4)
            p.fill(52, 211, 153)
            p.text(v.text, cx + w / 2, y + rowH / 2)
          } else {
            p.noStroke()
            p.fill(226, 232, 240)
            p.text(v.text, cx + w / 2, y + rowH / 2)
          }
          cx += w
        }
      }

      // Row count info
      const originalCount = rawData.length
      const missing = rawData.filter(
        r => r.age === null || r.income === null || r.score === null
      ).length
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(
        `Rows: ${processed.length}/${originalCount}  |  Missing cells in original: ${rawData.reduce((s, r) => s + (r.age === null ? 1 : 0) + (r.income === null ? 1 : 0) + (r.score === null ? 1 : 0), 0)}  |  Rows with any NaN: ${missing}`,
        tableX,
        canvasH - 10,
      )

      // Legend
      p.fill(244, 63, 94)
      p.rect(p.width - 200, canvasH - 28, 10, 10, 2)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Missing', p.width - 186, canvasH - 23)
      p.fill(52, 211, 153)
      p.rect(p.width - 120, canvasH - 28, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Imputed', p.width - 106, canvasH - 23)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-300">
            {(['original', 'drop', 'mean', 'median', 'forward'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`px-3 py-1 rounded text-sm ${
                  strategy === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {s === 'forward' ? 'Forward Fill' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Outlier Detection Sketch                                */
/* ------------------------------------------------------------------ */

function OutlierSketch() {
  const [method, setMethod] = useState<'iqr' | 'zscore'>('iqr')
  const [threshold, setThreshold] = useState(1.5)
  const methodRef = useRef(method)
  const thresholdRef = useRef(threshold)
  methodRef.current = method
  thresholdRef.current = threshold

  const dataRef = useRef<{ x: number; y: number }[]>([])

  if (dataRef.current.length === 0) {
    const rng = makeRng(101)
    for (let i = 0; i < 60; i++) {
      const x = rng() * 80 + 10
      const y = 0.6 * x + 20 + randn(rng) * 8
      dataRef.current.push({ x, y })
    }
    // Inject outliers
    dataRef.current.push({ x: 15, y: 90 })
    dataRef.current.push({ x: 85, y: 15 })
    dataRef.current.push({ x: 50, y: 95 })
    dataRef.current.push({ x: 70, y: 5 })
    dataRef.current.push({ x: 10, y: 80 })
  }

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const margin = 50

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const data = dataRef.current
      const meth = methodRef.current
      const thresh = thresholdRef.current

      // Compute which points are outliers
      const ys = data.map(d => d.y)
      const outliers = new Set<number>()

      if (meth === 'zscore') {
        const mean = ys.reduce((a, b) => a + b, 0) / ys.length
        const std = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length)
        for (let i = 0; i < data.length; i++) {
          if (std > 0 && Math.abs((ys[i] - mean) / std) > thresh) outliers.add(i)
        }
      } else {
        const sorted = [...ys].sort((a, b) => a - b)
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        const iqr = q3 - q1
        const lo = q1 - thresh * iqr
        const hi = q3 + thresh * iqr
        for (let i = 0; i < data.length; i++) {
          if (ys[i] < lo || ys[i] > hi) outliers.add(i)
        }
      }

      // Map coordinates
      const xMin = 0
      const xMax = 100
      const yMin = 0
      const yMax = 100
      const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * (p.width - margin * 2)
      const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * (canvasH - margin * 2)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = 0; gx <= 100; gx += 20) p.line(mapX(gx), margin, mapX(gx), canvasH - margin)
      for (let gy = 0; gy <= 100; gy += 20) p.line(margin, mapY(gy), p.width - margin, mapY(gy))

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
      p.line(margin, margin, margin, canvasH - margin)

      // Threshold bounds
      if (meth === 'iqr') {
        const sorted = [...ys].sort((a, b) => a - b)
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        const iqr = q3 - q1
        const lo = q1 - thresh * iqr
        const hi = q3 + thresh * iqr

        p.noStroke()
        p.fill(250, 204, 21, 20)
        p.rect(margin, mapY(hi), p.width - margin * 2, mapY(lo) - mapY(hi))

        p.stroke(250, 204, 21, 100)
        p.strokeWeight(1)
        const loY = mapY(lo)
        const hiY = mapY(hi)
        if (loY < canvasH - margin) {
          p.line(margin, loY, p.width - margin, loY)
        }
        if (hiY > margin) {
          p.line(margin, hiY, p.width - margin, hiY)
        }

        // Labels
        p.noStroke()
        p.fill(250, 204, 21)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.BOTTOM)
        if (hiY > margin) p.text(`Upper: ${hi.toFixed(1)}`, p.width - margin, hiY - 2)
        p.textAlign(p.RIGHT, p.TOP)
        if (loY < canvasH - margin) p.text(`Lower: ${lo.toFixed(1)}`, p.width - margin, loY + 2)
      } else {
        const mean = ys.reduce((a, b) => a + b, 0) / ys.length
        const std = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length)
        const lo = mean - thresh * std
        const hi = mean + thresh * std

        p.noStroke()
        p.fill(168, 85, 247, 20)
        p.rect(margin, mapY(hi), p.width - margin * 2, mapY(lo) - mapY(hi))

        p.stroke(168, 85, 247, 100)
        p.strokeWeight(1)
        p.line(margin, mapY(mean), p.width - margin, mapY(mean))
        const loY = mapY(lo)
        const hiY = mapY(hi)
        if (loY < canvasH - margin) p.line(margin, loY, p.width - margin, loY)
        if (hiY > margin) p.line(margin, hiY, p.width - margin, hiY)

        p.noStroke()
        p.fill(168, 85, 247)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.BOTTOM)
        if (hiY > margin) p.text(`+${thresh.toFixed(1)} sigma`, p.width - margin, hiY - 2)
        p.textAlign(p.RIGHT, p.TOP)
        if (loY < canvasH - margin) p.text(`-${thresh.toFixed(1)} sigma`, p.width - margin, loY + 2)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text('mean', p.width - margin, mapY(mean))
      }

      // Points
      for (let i = 0; i < data.length; i++) {
        const isOutlier = outliers.has(i)
        p.noStroke()
        if (isOutlier) {
          p.fill(244, 63, 94)
          p.ellipse(mapX(data[i].x), mapY(data[i].y), 14, 14)
          // X mark
          p.stroke(255, 255, 255)
          p.strokeWeight(1.5)
          const cx = mapX(data[i].x)
          const cy = mapY(data[i].y)
          p.line(cx - 4, cy - 4, cx + 4, cy + 4)
          p.line(cx - 4, cy + 4, cx + 4, cy - 4)
        } else {
          p.fill(99, 102, 241)
          p.ellipse(mapX(data[i].x), mapY(data[i].y), 10, 10)
        }
      }

      // Info text
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        `Method: ${meth === 'iqr' ? 'IQR' : 'Z-Score'}  |  Threshold: ${thresh.toFixed(1)}  |  Outliers: ${outliers.size}/${data.length}`,
        margin,
        10,
      )

      // Legend
      p.fill(99, 102, 241)
      p.ellipse(p.width - 150, 14, 8, 8)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Normal', p.width - 142, 14)
      p.fill(244, 63, 94)
      p.ellipse(p.width - 80, 14, 8, 8)
      p.fill(148, 163, 184)
      p.text('Outlier', p.width - 72, 14)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-gray-300">
          <div className="flex items-center gap-2">
            {(['iqr', 'zscore'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-1 rounded text-sm ${
                  method === m ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {m === 'iqr' ? 'IQR Method' : 'Z-Score Method'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            Threshold:
            <input
              type="range"
              min={0.5}
              max={3.5}
              step={0.1}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="w-36 accent-yellow-500"
            />
            <span className="w-10 font-mono">{threshold.toFixed(1)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Feature Scaling Sketch                                  */
/* ------------------------------------------------------------------ */

function FeatureScalingSketch() {
  const [mode, setMode] = useState<'original' | 'standardize' | 'minmax'>('original')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const dataRef = useRef<{ x: number; y: number }[]>([])

  if (dataRef.current.length === 0) {
    const rng = makeRng(77)
    for (let i = 0; i < 40; i++) {
      // x: age (20-70 range), y: income (20000-120000 range) — very different scales
      const age = 20 + rng() * 50
      const income = 20000 + rng() * 100000
      dataRef.current.push({ x: age, y: income })
    }
  }

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const margin = 60

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const raw = dataRef.current
      const m = modeRef.current
      const halfW = p.width / 2

      // Transform data
      let transformed: { x: number; y: number }[]
      let xLabel: string
      let yLabel: string
      let titleText: string

      if (m === 'original') {
        transformed = raw
        xLabel = 'Age (20-70)'
        yLabel = 'Income (20k-120k)'
        titleText = 'Original: Features on Very Different Scales'
      } else if (m === 'standardize') {
        const meanX = raw.reduce((s, d) => s + d.x, 0) / raw.length
        const meanY = raw.reduce((s, d) => s + d.y, 0) / raw.length
        const stdX = Math.sqrt(raw.reduce((s, d) => s + (d.x - meanX) ** 2, 0) / raw.length)
        const stdY = Math.sqrt(raw.reduce((s, d) => s + (d.y - meanY) ** 2, 0) / raw.length)
        transformed = raw.map(d => ({
          x: stdX > 0 ? (d.x - meanX) / stdX : 0,
          y: stdY > 0 ? (d.y - meanY) / stdY : 0,
        }))
        xLabel = 'Age (z-score)'
        yLabel = 'Income (z-score)'
        titleText = 'Standardization: Mean=0, Std=1'
      } else {
        const minX = Math.min(...raw.map(d => d.x))
        const maxX = Math.max(...raw.map(d => d.x))
        const minY = Math.min(...raw.map(d => d.y))
        const maxY = Math.max(...raw.map(d => d.y))
        transformed = raw.map(d => ({
          x: maxX > minX ? (d.x - minX) / (maxX - minX) : 0.5,
          y: maxY > minY ? (d.y - minY) / (maxY - minY) : 0.5,
        }))
        xLabel = 'Age (0-1)'
        yLabel = 'Income (0-1)'
        titleText = 'Min-Max Normalization: Range [0, 1]'
      }

      // Compute plot bounds
      const xs = transformed.map(d => d.x)
      const ys = transformed.map(d => d.y)
      const xMin = Math.min(...xs)
      const xMax = Math.max(...xs)
      const yMin = Math.min(...ys)
      const yMax = Math.max(...ys)
      const xPad = (xMax - xMin) * 0.1 || 1
      const yPad = (yMax - yMin) * 0.1 || 1

      const mapX = (v: number) =>
        margin + ((v - (xMin - xPad)) / (xMax - xMin + 2 * xPad)) * (halfW - margin - 20)
      const mapY = (v: number) =>
        canvasH - margin - ((v - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * (canvasH - margin - 30)

      // Title
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(titleText, halfW / 2, 8)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = 0; gx < 6; gx++) {
        const px = margin + (gx / 5) * (halfW - margin - 20)
        p.line(px, 28, px, canvasH - margin)
      }
      for (let gy = 0; gy < 6; gy++) {
        const py = 28 + (gy / 5) * (canvasH - margin - 28)
        p.line(margin, py, halfW - 20, py)
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1.5)
      p.line(margin, canvasH - margin, halfW - 20, canvasH - margin)
      p.line(margin, 28, margin, canvasH - margin)

      // Axis labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text(xLabel, (margin + halfW - 20) / 2, canvasH - margin + 8)
      p.push()
      p.translate(14, (28 + canvasH - margin) / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(yLabel, 0, 0)
      p.pop()

      // Points
      p.noStroke()
      for (const d of transformed) {
        p.fill(99, 102, 241, 200)
        p.ellipse(mapX(d.x), mapY(d.y), 9, 9)
      }

      // Right half: gradient descent convergence comparison
      const rightX = halfW + 20
      const rightW = p.width - rightX - 30
      const chartTop = 50
      const chartBot = canvasH - margin

      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Gradient Descent Convergence', rightX + rightW / 2, 8)

      // Divider
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(halfW, 0, halfW, canvasH)

      // Simulate convergence (scaled features converge much faster)
      const iters = 100
      const unscaledLoss: number[] = []
      const scaledLoss: number[] = []
      for (let i = 0; i < iters; i++) {
        unscaledLoss.push(100 * Math.exp(-0.02 * i) + 5 * Math.sin(i * 0.3) * Math.exp(-0.01 * i))
        scaledLoss.push(100 * Math.exp(-0.15 * i))
      }
      const maxLoss = Math.max(unscaledLoss[0], scaledLoss[0])

      // Chart axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(rightX, chartBot, rightX + rightW, chartBot)
      p.line(rightX, chartTop, rightX, chartBot)

      // Unscaled curve
      p.stroke(244, 63, 94)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i < iters; i++) {
        const px = rightX + (i / (iters - 1)) * rightW
        const py = chartBot - (Math.max(0, unscaledLoss[i]) / maxLoss) * (chartBot - chartTop)
        p.vertex(px, py)
      }
      p.endShape()

      // Scaled curve
      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i < iters; i++) {
        const px = rightX + (i / (iters - 1)) * rightW
        const py = chartBot - (Math.max(0, scaledLoss[i]) / maxLoss) * (chartBot - chartTop)
        p.vertex(px, py)
      }
      p.endShape()

      // Labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Iterations', rightX + rightW / 2, chartBot + 8)

      p.textAlign(p.LEFT, p.TOP)
      p.fill(244, 63, 94)
      p.rect(rightX + 10, chartTop + 5, 12, 3)
      p.fill(148, 163, 184)
      p.text('Unscaled (oscillates)', rightX + 26, chartTop)
      p.fill(52, 211, 153)
      p.rect(rightX + 10, chartTop + 22, 12, 3)
      p.fill(148, 163, 184)
      p.text('Scaled (smooth)', rightX + 26, chartTop + 17)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-300">
          {(['original', 'standardize', 'minmax'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm ${
                mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {m === 'original' ? 'Original' : m === 'standardize' ? 'Standardize (Z-Score)' : 'Min-Max (0-1)'}
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 6 — Class Imbalance Sketch                                  */
/* ------------------------------------------------------------------ */

function ImbalanceSketch() {
  const [balanceMethod, setBalanceMethod] = useState<'original' | 'oversample' | 'undersample' | 'smote'>(
    'original'
  )
  const methodRef = useRef(balanceMethod)
  methodRef.current = balanceMethod

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    const rng = makeRng(55)
    const majorityCount = 180
    const minorityCount = 20

    // Generate base data
    const majority: { x: number; y: number }[] = []
    const minority: { x: number; y: number }[] = []
    for (let i = 0; i < majorityCount; i++) {
      majority.push({ x: 30 + randn(rng) * 12, y: 40 + randn(rng) * 12 })
    }
    for (let i = 0; i < minorityCount; i++) {
      minority.push({ x: 65 + randn(rng) * 8, y: 65 + randn(rng) * 8 })
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const meth = methodRef.current

      let dispMajority = [...majority]
      let dispMinority = [...minority]
      let statusText = ''

      if (meth === 'oversample') {
        // Duplicate random minority points
        const rng2 = makeRng(123)
        while (dispMinority.length < dispMajority.length) {
          const base = minority[Math.floor(rng2() * minority.length)]
          dispMinority.push({ x: base.x + randn(rng2) * 1.5, y: base.y + randn(rng2) * 1.5 })
        }
        statusText = `Oversampled: ${dispMajority.length} majority, ${dispMinority.length} minority`
      } else if (meth === 'undersample') {
        const rng2 = makeRng(456)
        const shuffled = [...majority].sort(() => rng2() - 0.5)
        dispMajority = shuffled.slice(0, minorityCount)
        statusText = `Undersampled: ${dispMajority.length} majority, ${dispMinority.length} minority`
      } else if (meth === 'smote') {
        // SMOTE-like: create synthetic points between minority neighbors
        const rng2 = makeRng(789)
        while (dispMinority.length < dispMajority.length) {
          const a = minority[Math.floor(rng2() * minority.length)]
          const b = minority[Math.floor(rng2() * minority.length)]
          const t = rng2()
          dispMinority.push({
            x: a.x + t * (b.x - a.x) + randn(rng2) * 0.5,
            y: a.y + t * (b.y - a.y) + randn(rng2) * 0.5,
          })
        }
        statusText = `SMOTE: ${dispMajority.length} majority, ${dispMinority.length} minority (synthetic)`
      } else {
        statusText = `Original: ${dispMajority.length} majority, ${dispMinority.length} minority (9:1 ratio)`
      }

      // Plot bounds
      const margin = 50
      const plotH = canvasH - margin * 2 + 10
      const mapY = (v: number) => canvasH - margin - ((v - 0) / 100) * plotH

      // Left: bar chart of class distribution
      const barAreaW = 120
      const barX = margin + 10
      const barMaxH = plotH * 0.7
      const maxCount = Math.max(dispMajority.length, dispMinority.length)

      // Bar backgrounds
      p.noStroke()
      p.fill(30, 41, 59)
      p.rect(barX, mapY(80), 40, barMaxH)
      p.rect(barX + 60, mapY(80), 40, barMaxH)

      // Bars
      const majH = (dispMajority.length / maxCount) * barMaxH
      const minH = (dispMinority.length / maxCount) * barMaxH
      p.fill(99, 102, 241, 180)
      p.rect(barX, mapY(80) + barMaxH - majH, 40, majH, 3, 3, 0, 0)
      p.fill(244, 63, 94, 180)
      p.rect(barX + 60, mapY(80) + barMaxH - minH, 40, minH, 3, 3, 0, 0)

      // Bar labels
      p.fill(226, 232, 240)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(String(dispMajority.length), barX + 20, mapY(80) + barMaxH - majH - 4)
      p.text(String(dispMinority.length), barX + 80, mapY(80) + barMaxH - minH - 4)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Majority', barX + 20, mapY(80) + barMaxH + 4)
      p.text('Minority', barX + 80, mapY(80) + barMaxH + 4)

      // Right: scatter plot
      const scatterX = margin + barAreaW + 40
      const scatterW = p.width - scatterX - margin
      const scatterMapX = (v: number) => scatterX + ((v - 0) / 100) * scatterW
      const scatterMapY = (v: number) => canvasH - margin - ((v - 0) / 100) * plotH

      // Background grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = 0; gx <= 100; gx += 20) {
        const px = scatterMapX(gx)
        if (px >= scatterX) p.line(px, margin - 10, px, canvasH - margin)
      }
      for (let gy = 0; gy <= 100; gy += 20) p.line(scatterX, scatterMapY(gy), p.width - margin, scatterMapY(gy))

      // Points
      p.noStroke()
      for (const pt of dispMajority) {
        p.fill(99, 102, 241, 150)
        p.ellipse(scatterMapX(pt.x), scatterMapY(pt.y), 7, 7)
      }
      for (const pt of dispMinority) {
        const isSynthetic = meth === 'smote' || meth === 'oversample'
        p.fill(244, 63, 94, isSynthetic ? 120 : 200)
        p.ellipse(scatterMapX(pt.x), scatterMapY(pt.y), 7, 7)
      }

      // Status
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text(statusText, p.width / 2, 8)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-300">
          {(['original', 'oversample', 'undersample', 'smote'] as const).map(m => (
            <button
              key={m}
              onClick={() => setBalanceMethod(m)}
              className={`px-3 py-1 rounded text-sm ${
                balanceMethod === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {m === 'original' ? 'Original' : m === 'oversample' ? 'Oversample' : m === 'undersample' ? 'Undersample' : 'SMOTE'}
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function DataPreprocessing() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: Why Preprocessing Matters ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Why Preprocessing Matters</h2>

        <p className="mb-4">
          The phrase &ldquo;garbage in, garbage out&rdquo; might sound cliched, but it captures one
          of the most important truths in machine learning. No model, no matter how sophisticated,
          can overcome fundamentally flawed input data. In practice, data scientists spend 60-80%
          of their time on data preparation and cleaning — not on modeling.
        </p>

        <p className="mb-4">
          Real-world data is messy. Sensors fail and produce missing readings. Human data entry
          introduces typos and inconsistencies. Measurements come in wildly different units: age
          in years, income in dollars, temperature in Celsius. Categories like &ldquo;color&rdquo;
          or &ldquo;country&rdquo; need to be converted to numbers before a model can use them.
          And datasets are often heavily skewed, with 99% of examples belonging to one class and
          only 1% to the class you actually care about detecting.
        </p>

        <p className="mb-4">
          <strong className="text-white">Data preprocessing</strong> is the systematic process of
          transforming raw data into a clean, well-structured format that a machine learning algorithm
          can learn from effectively. It includes handling missing values, detecting and dealing with
          outliers, scaling features to comparable ranges, encoding categorical variables, and
          balancing class distributions. Each of these steps can dramatically impact model performance
          — sometimes more than the choice of algorithm itself.
        </p>

        <p className="mb-4">
          In this lesson, we will walk through each preprocessing step with interactive visualizations.
          You will see firsthand how different strategies change the data and affect downstream
          model behavior.
        </p>
      </section>

      {/* ========== Section 2: Missing Values ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Handling Missing Values</h2>

        <p className="mb-4">
          Missing values are ubiquitous. A patient skips a lab test, a survey respondent leaves a
          field blank, a sensor drops a reading. Most ML algorithms cannot handle <code className="text-pink-400">NaN</code>{' '}
          values directly — they need complete numerical inputs. So we must decide: what do we do
          with the gaps?
        </p>

        <p className="mb-4">
          There are several common strategies, each with tradeoffs:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Drop rows</strong> — Remove any row that has a missing
            value. Simple and clean, but you lose data. If missingness is correlated with the target
            variable, dropping rows introduces bias.
          </li>
          <li>
            <strong className="text-white">Mean imputation</strong> — Replace missing values with
            the column mean. Preserves the overall average but underestimates variance and can
            distort correlations between features.
          </li>
          <li>
            <strong className="text-white">Median imputation</strong> — Replace with the column
            median. More robust to outliers than the mean. A good default choice for skewed
            distributions.
          </li>
          <li>
            <strong className="text-white">Forward fill</strong> — Carry the last known value
            forward. Particularly useful for time-series data where the most recent observation is
            a reasonable proxy for the current one.
          </li>
        </ul>

        <p className="mb-4">
          Toggle between strategies in the visualization below. Notice how <span className="text-emerald-400">green
          cells</span> show imputed values and <span className="text-rose-400">red cells</span> show
          remaining gaps. Pay attention to how many rows survive each strategy and what values get
          filled in.
        </p>

        <MissingValuesSketch />

        <p className="mt-4">
          In practice, the best strategy depends on the amount and pattern of missingness. If only
          1-2% of data is missing at random, mean or median imputation works fine. If a column is
          50% missing, you might drop the column entirely. More advanced techniques like{' '}
          <strong className="text-white">KNN imputation</strong> or{' '}
          <strong className="text-white">iterative imputation</strong> (MICE) use relationships
          between features to produce smarter fill values.
        </p>
      </section>

      {/* ========== Section 3: Outlier Detection ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Outlier Detection</h2>

        <p className="mb-4">
          Outliers are data points that deviate significantly from the majority of observations.
          They might be genuine extreme values (a billionaire in income data), measurement errors
          (a typo turning 50 into 5000), or data corruption. Outliers can have an outsized
          influence on models — a single extreme point can shift a regression line dramatically.
        </p>

        <p className="mb-4">
          Two of the most common detection methods are:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">IQR method</strong> — Compute the interquartile range
            (Q3 - Q1). Points below Q1 - k*IQR or above Q3 + k*IQR are flagged as outliers.
            The default k = 1.5 is a widely used convention. This method is robust because it
            is based on percentiles, not the mean.
          </li>
          <li>
            <strong className="text-white">Z-score method</strong> — Compute how many standard
            deviations each point is from the mean. Points beyond a threshold (commonly 2 or 3
            sigma) are flagged. This assumes roughly normal data, and the mean and standard
            deviation themselves can be distorted by extreme outliers.
          </li>
        </ul>

        <p className="mb-4">
          In the scatter plot below, toggle between methods and adjust the threshold. Watch how
          the highlighted outliers change. Notice that the IQR method and Z-score method can
          disagree — they define &ldquo;extreme&rdquo; differently.
        </p>

        <OutlierSketch />

        <p className="mt-4">
          What you do after detecting outliers matters as much as finding them. Options include
          removing them, capping them at a threshold (winsorizing), or transforming the feature
          (e.g., applying a log transform to compress the range). The right choice depends on
          whether the outlier is a genuine extreme value or an error.
        </p>
      </section>

      {/* ========== Section 4: Feature Scaling ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Feature Scaling</h2>

        <p className="mb-4">
          Many machine learning algorithms are sensitive to the scale of input features. Consider
          a dataset with two features: age (range 20-70) and income (range $20,000-$120,000).
          In the raw feature space, income dominates simply because its numbers are larger. A
          distance-based algorithm like KNN or K-Means would treat a difference of $1 in income
          as equivalent to a difference of 1 year in age — clearly wrong.
        </p>

        <p className="mb-4">
          <strong className="text-white">Standardization</strong> (z-score normalization) transforms
          each feature to have mean 0 and standard deviation 1:{' '}
          <code className="text-pink-400">z = (x - mean) / std</code>. This puts all features on
          the same scale without bounding them to a specific range.
        </p>

        <p className="mb-4">
          <strong className="text-white">Min-Max normalization</strong> scales each feature to the
          [0, 1] range: <code className="text-pink-400">x' = (x - min) / (max - min)</code>. This
          is useful when you need bounded inputs (e.g., for neural networks with sigmoid activations)
          but is more sensitive to outliers than standardization.
        </p>

        <p className="mb-4">
          The visualization below shows the same data in its original scale, after standardization,
          and after min-max normalization. On the right, you can see how feature scaling dramatically
          improves gradient descent convergence — the scaled loss drops smoothly while the unscaled
          version oscillates.
        </p>

        <FeatureScalingSketch />

        <p className="mt-4">
          Algorithms that use gradient descent (linear/logistic regression, neural networks) or
          distance calculations (KNN, SVM, K-Means) benefit enormously from scaling. Tree-based
          methods (decision trees, random forests, gradient boosting) are largely invariant to
          feature scale because they make splits based on thresholds, not distances.
        </p>
      </section>

      {/* ========== Section 5: Encoding Categorical Variables ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Encoding Categorical Variables</h2>

        <p className="mb-4">
          Machine learning models operate on numbers, but real-world data is full of categories:
          color, city, department, product type. We need to convert these to numerical
          representations, but the encoding choice matters.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">One-Hot Encoding</h3>
        <p className="mb-4">
          Create a binary column for each category. If a feature has values [Red, Blue, Green],
          it becomes three columns: <code className="text-pink-400">is_Red</code>,{' '}
          <code className="text-pink-400">is_Blue</code>,{' '}
          <code className="text-pink-400">is_Green</code>. Each row has exactly one 1 and the rest
          are 0s. This avoids implying any ordering between categories. The downside: high-cardinality
          features (e.g., zip codes with 40,000 values) create a huge number of sparse columns.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Label Encoding</h3>
        <p className="mb-4">
          Assign each category a unique integer: Red=0, Blue=1, Green=2. Simple and compact, but
          it introduces a false ordering — the model might learn that Green (2) is &ldquo;greater
          than&rdquo; Red (0), which is meaningless for nominal categories. Label encoding works
          well for tree-based models (which only compare thresholds) but can mislead linear models.
        </p>

        <h3 className="mb-3 text-xl font-semibold text-white">Ordinal Encoding</h3>
        <p className="mb-4">
          When categories have a natural order — like education level (High School &lt; Bachelor&rsquo;s
          &lt; Master&rsquo;s &lt; PhD) or satisfaction rating (Low &lt; Medium &lt; High) — we assign
          integers that respect that order. This preserves meaningful ranking information.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="pb-2 text-left text-white">Method</th>
                <th className="pb-2 text-left text-white">Best For</th>
                <th className="pb-2 text-left text-white">Avoid When</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-700">
                <td className="py-2 text-emerald-400">One-Hot</td>
                <td className="py-2">Nominal categories, linear models, low cardinality</td>
                <td className="py-2">High cardinality (&gt;20 categories), tree models</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 text-yellow-400">Label</td>
                <td className="py-2">Tree-based models, compact representation</td>
                <td className="py-2">Linear/distance-based models with nominal features</td>
              </tr>
              <tr>
                <td className="py-2 text-purple-400">Ordinal</td>
                <td className="py-2">Naturally ordered categories</td>
                <td className="py-2">Nominal categories (no inherent order)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========== Section 6: Handling Imbalanced Data ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Handling Imbalanced Data</h2>

        <p className="mb-4">
          Imagine you are building a fraud detection model. Out of 10,000 transactions, only 50
          are fraudulent — a 0.5% positive rate. A model that always predicts &ldquo;not fraud&rdquo;
          achieves 99.5% accuracy while being completely useless. This is the{' '}
          <strong className="text-white">class imbalance problem</strong>.
        </p>

        <p className="mb-4">
          There are several resampling strategies to address imbalance:
        </p>

        <ul className="mb-6 list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Random oversampling</strong> — Duplicate minority class
            examples (with slight noise) until classes are balanced. Risk: can lead to overfitting
            on the repeated minority examples.
          </li>
          <li>
            <strong className="text-white">Random undersampling</strong> — Remove majority class
            examples until classes are balanced. Risk: you throw away potentially useful data.
          </li>
          <li>
            <strong className="text-white">SMOTE</strong> (Synthetic Minority Over-sampling Technique)
            — Generate new synthetic minority examples by interpolating between existing minority
            neighbors. This creates more diverse examples than simple duplication, reducing overfitting
            risk while still balancing the classes.
          </li>
        </ul>

        <p className="mb-4">
          In the visualization below, toggle between strategies. The bar chart on the left shows
          class counts, while the scatter plot on the right shows the actual data distribution.
          Notice how SMOTE creates new points along the lines between existing minority examples,
          filling in the minority region more naturally than simple oversampling.
        </p>

        <ImbalanceSketch />

        <p className="mt-4">
          Beyond resampling, you can also address imbalance through{' '}
          <strong className="text-white">class weights</strong> (telling the model to penalize
          minority misclassifications more heavily), choosing appropriate metrics (F1, AUC-ROC
          instead of accuracy), or using anomaly detection approaches for extreme imbalance.
        </p>
      </section>

      {/* ========== Section 7: Python — Complete Preprocessing Pipeline ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Preprocessing Pipeline</h2>

        <p className="mb-4">
          In practice, you chain preprocessing steps into a pipeline using scikit-learn. This
          ensures the same transformations are applied consistently to training and test data,
          preventing data leakage. The code below demonstrates a complete pipeline with imputation,
          scaling, and encoding.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

# Simulate a dataset with missing values and mixed types
np.random.seed(42)
n = 100

# Numerical features
ages = np.random.normal(35, 10, n)
incomes = np.random.normal(55000, 15000, n)
scores = np.random.normal(70, 15, n)

# Introduce missing values (10% random)
mask_age = np.random.random(n) < 0.1
mask_income = np.random.random(n) < 0.1
ages[mask_age] = np.nan
incomes[mask_income] = np.nan

print("=== Raw Data Summary ===")
print(f"Ages:    mean={np.nanmean(ages):.1f}, std={np.nanstd(ages):.1f}, missing={mask_age.sum()}")
print(f"Incomes: mean={np.nanmean(incomes):.0f}, std={np.nanstd(incomes):.0f}, missing={mask_income.sum()}")
print(f"Scores:  mean={np.nanmean(scores):.1f}, std={np.nanstd(scores):.1f}")

# Step 1: Impute missing values with median
from numpy import nanmedian
ages_clean = ages.copy()
incomes_clean = incomes.copy()
ages_clean[np.isnan(ages_clean)] = nanmedian(ages)
incomes_clean[np.isnan(incomes_clean)] = nanmedian(incomes)

print("\\n=== After Median Imputation ===")
print(f"Ages:    mean={ages_clean.mean():.1f}, missing={np.isnan(ages_clean).sum()}")
print(f"Incomes: mean={incomes_clean.mean():.0f}, missing={np.isnan(incomes_clean).sum()}")

# Step 2: Standardize (z-score)
def standardize(x):
    return (x - x.mean()) / x.std()

ages_scaled = standardize(ages_clean)
incomes_scaled = standardize(incomes_clean)
scores_scaled = standardize(scores)

print("\\n=== After Standardization ===")
print(f"Ages:    mean={ages_scaled.mean():.4f}, std={ages_scaled.std():.4f}")
print(f"Incomes: mean={incomes_scaled.mean():.4f}, std={incomes_scaled.std():.4f}")
print(f"Scores:  mean={scores_scaled.mean():.4f}, std={scores_scaled.std():.4f}")

# Step 3: Detect outliers with IQR
def iqr_outliers(x, k=1.5):
    q1, q3 = np.percentile(x, [25, 75])
    iqr = q3 - q1
    return (x < q1 - k * iqr) | (x > q3 + k * iqr)

outlier_mask = iqr_outliers(scores)
print(f"\\n=== Outlier Detection (IQR, k=1.5) ===")
print(f"Outliers in scores: {outlier_mask.sum()}/{len(scores)}")
print(f"Outlier values: {scores[outlier_mask].round(1)}")

print("\\nPreprocessing pipeline complete!")`}
        />
      </section>

      {/* ========== Section 8: Python — Impact on Model Accuracy ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Impact of Preprocessing</h2>

        <p className="mb-4">
          Does preprocessing actually matter? Let us train the same model on raw data versus
          preprocessed data and compare. The difference can be striking, especially for algorithms
          sensitive to feature scale.
        </p>

        <PythonCell
          defaultCode={`import numpy as np

# Generate a classification dataset
np.random.seed(42)
n = 200

# Feature 1: age (small range)
age = np.random.normal(40, 12, n)
# Feature 2: income (large range)
income = np.random.normal(60000, 20000, n)
# Target: higher income + younger age => class 1
logits = -0.05 * age + 0.00005 * income + np.random.normal(0, 0.5, n)
y = (logits > 0).astype(int)

# Inject some missing values
age_missing = age.copy()
income_missing = income.copy()
mask = np.random.random(n) < 0.08
age_missing[mask] = np.nan
mask2 = np.random.random(n) < 0.08
income_missing[mask2] = np.nan

# --- RAW approach: drop missing, no scaling ---
valid = ~np.isnan(age_missing) & ~np.isnan(income_missing)
X_raw = np.column_stack([age_missing[valid], income_missing[valid]])
y_raw = y[valid]

# Train/test split (manual)
split = int(0.7 * len(y_raw))
idx = np.random.permutation(len(y_raw))
X_train_raw, X_test_raw = X_raw[idx[:split]], X_raw[idx[split:]]
y_train_raw, y_test_raw = y_raw[idx[:split]], y_raw[idx[split:]]

# Simple logistic regression (gradient descent)
def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def train_logreg(X, y, lr=0.01, epochs=200):
    w = np.zeros(X.shape[1])
    b = 0.0
    for _ in range(epochs):
        pred = sigmoid(X @ w + b)
        err = pred - y
        w -= lr * (X.T @ err) / len(y)
        b -= lr * err.mean()
    return w, b

def accuracy(X, y, w, b):
    pred = (sigmoid(X @ w + b) >= 0.5).astype(int)
    return (pred == y).mean()

# Train on raw data
w_raw, b_raw = train_logreg(X_train_raw, y_train_raw, lr=0.0000001, epochs=200)
acc_raw = accuracy(X_test_raw, y_test_raw, w_raw, b_raw)

# --- PREPROCESSED approach: impute + scale ---
age_clean = age_missing.copy()
income_clean = income_missing.copy()
age_clean[np.isnan(age_clean)] = np.nanmedian(age_missing)
income_clean[np.isnan(income_clean)] = np.nanmedian(income_missing)

X_all = np.column_stack([age_clean, income_clean])

# Scale using training statistics only
X_train_pp = X_all[idx[:split]]
X_test_pp = X_all[idx[split:]]
y_train_pp = y[idx[:split]]
y_test_pp = y[idx[split:]]

train_mean = X_train_pp.mean(axis=0)
train_std = X_train_pp.std(axis=0)
X_train_scaled = (X_train_pp - train_mean) / train_std
X_test_scaled = (X_test_pp - train_mean) / train_std

# Train on preprocessed data
w_pp, b_pp = train_logreg(X_train_scaled, y_train_pp, lr=0.1, epochs=200)
acc_pp = accuracy(X_test_scaled, y_test_pp, w_pp, b_pp)

print("=== Model Comparison ===")
print(f"Raw data (drop NaN, no scaling):")
print(f"  Training samples: {len(y_train_raw)}, Test accuracy: {acc_raw:.1%}")
print(f"\\nPreprocessed (impute + standardize):")
print(f"  Training samples: {len(y_train_pp)}, Test accuracy: {acc_pp:.1%}")
print(f"\\nImprovement: {(acc_pp - acc_raw)*100:+.1f} percentage points")
print("\\nKey insight: Scaling lets gradient descent use a")
print("reasonable learning rate across all features.")`}
        />
      </section>

      {/* ========== Closing ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            Always inspect your data for missing values, outliers, and scale differences before
            training a model.
          </li>
          <li>
            Choose imputation strategies based on the amount and pattern of missingness — median
            is a safe default for numerical features.
          </li>
          <li>
            Scale features for gradient-based and distance-based algorithms. Tree-based models
            generally do not need scaling.
          </li>
          <li>
            Use one-hot encoding for nominal categories with linear models, label encoding for
            tree-based models, and ordinal encoding only when categories have a natural order.
          </li>
          <li>
            Address class imbalance with resampling techniques or class weights — never evaluate
            an imbalanced classifier on accuracy alone.
          </li>
          <li>
            Wrap all preprocessing into a pipeline so that transformations are applied consistently
            to training and test data.
          </li>
        </ul>
      </section>
    </article>
  )
}
