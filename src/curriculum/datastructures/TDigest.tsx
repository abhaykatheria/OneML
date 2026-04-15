import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/t-digest',
  title: 'T-Digest: Streaming Percentiles',
  description:
    'Estimate percentiles (p50, p95, p99) over massive streaming data in constant memory using the T-Digest data structure',
  track: 'datastructures',
  order: 1,
  tags: ['t-digest', 'percentile', 'streaming', 'monitoring', 'quantile', 'centroid'],
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

/** Generate a realistic latency sample (ms) — bimodal: most fast, some slow */
function sampleLatency(rng: () => number): number {
  if (rng() < 0.85) {
    // Fast path: 10-80ms, roughly log-normal
    return 10 + Math.abs(gaussianRng(rng) * 20)
  }
  // Slow path: 100-500ms
  return 100 + Math.abs(gaussianRng(rng) * 120)
}

function gaussianRng(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
}

/* ------------------------------------------------------------------ */
/* Section 1 — Centroid Formation Visualization                        */
/* ------------------------------------------------------------------ */

interface Centroid {
  mean: number
  count: number
}

function scaleFunction(q: number, delta: number): number {
  return (delta / 2) * Math.asin(2 * q - 1) / (Math.PI / 2)
}

function maxCountForQ(q: number, delta: number, n: number): number {
  const k0 = scaleFunction(q, delta)
  const k1 = scaleFunction(Math.min(1, q + 1 / n), delta)
  return Math.max(1, Math.floor((k1 - k0) * n / delta * 4))
}

function CentroidFormationSketch() {
  const [speed, setSpeed] = useState(2)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const [delta, setDelta] = useState(25)
  const deltaRef = useRef(delta)
  deltaRef.current = delta

  const [totalInserted, setTotalInserted] = useState(0)
  const totalInsertedRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    const canvasH = 450
    const rng = makeRng(42)
    const centroids: Centroid[] = []
    const allValues: number[] = []
    let insertCount = 0
    let lastInsertedValue = -1
    let flashTimer = 0

    function insertValue(val: number) {
      allValues.push(val)
      insertCount++
      totalInsertedRef.current = insertCount
      lastInsertedValue = val
      flashTimer = 20

      if (centroids.length === 0) {
        centroids.push({ mean: val, count: 1 })
        return
      }

      // Find nearest centroid
      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < centroids.length; i++) {
        const d = Math.abs(centroids[i].mean - val)
        if (d < bestDist) {
          bestDist = d
          bestIdx = i
        }
      }

      // Compute quantile of nearest centroid
      let cumCount = 0
      for (let i = 0; i < bestIdx; i++) cumCount += centroids[i].count
      cumCount += centroids[bestIdx].count / 2
      const q = cumCount / Math.max(1, insertCount)
      const maxC = maxCountForQ(q, deltaRef.current, insertCount)

      if (centroids[bestIdx].count + 1 <= maxC) {
        // Merge into existing centroid
        const c = centroids[bestIdx]
        c.mean = (c.mean * c.count + val) / (c.count + 1)
        c.count++
      } else {
        // Create new centroid
        centroids.push({ mean: val, count: 1 })
        centroids.sort((a, b) => a.mean - b.mean)
      }
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      flashTimer = Math.max(0, flashTimer - 1)

      // Insert values at user-controlled speed
      for (let i = 0; i < speedRef.current; i++) {
        if (insertCount < 2000) {
          insertValue(sampleLatency(rng))
        }
      }

      if (p.frameCount % 3 === 0) {
        setTotalInserted(totalInsertedRef.current)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`T-Digest Centroid Formation  |  Values inserted: ${insertCount}  |  Centroids: ${centroids.length}`, 16, 12)

      // Draw value distribution (top area)
      const histTop = 50
      const histH = 100
      const bucketCount = 60
      const maxVal = 500
      const buckets = new Array(bucketCount).fill(0)
      for (const v of allValues) {
        const idx = Math.min(bucketCount - 1, Math.floor((v / maxVal) * bucketCount))
        buckets[idx]++
      }
      const maxBucket = Math.max(1, ...buckets)
      const barW = (W - 80) / bucketCount

      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Incoming Data Distribution (API response times in ms)', W / 2, histTop - 12)

      for (let i = 0; i < bucketCount; i++) {
        const h = (buckets[i] / maxBucket) * histH
        const x = 40 + i * barW
        p.fill(71, 85, 105, 180)
        p.noStroke()
        p.rect(x, histTop + histH - h, barW - 1, h)
      }

      // Axis labels
      p.fill(148, 163, 184)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (let v = 0; v <= 500; v += 100) {
        const x = 40 + (v / maxVal) * (W - 80)
        p.text(`${v}ms`, x, histTop + histH + 4)
      }

      // Draw centroids (bottom area)
      const centroidTop = histTop + histH + 40
      const centroidH = 200

      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('T-Digest Centroids (sized by count, more centroids near the tails)', W / 2, centroidTop - 12)

      if (centroids.length > 0) {
        const maxCount = Math.max(...centroids.map(c => c.count))

        for (let i = 0; i < centroids.length; i++) {
          const c = centroids[i]
          const x = 40 + (c.mean / maxVal) * (W - 80)
          const r = Math.max(4, Math.min(30, (c.count / maxCount) * 28 + 4))
          const y = centroidTop + centroidH / 2

          // Compute quantile for coloring
          let cumCount = 0
          for (let j = 0; j < i; j++) cumCount += centroids[j].count
          cumCount += c.count / 2
          const q = cumCount / Math.max(1, insertCount)

          // Color: tails are brighter (more important for p95/p99)
          const tailness = Math.min(q, 1 - q) // 0 at tails, 0.5 at median
          const isTail = tailness < 0.1
          if (isTail) {
            p.fill(52, 211, 153, 220)  // emerald for tail centroids
          } else {
            p.fill(99, 102, 241, 180)  // indigo for middle centroids
          }

          p.noStroke()
          p.ellipse(x, y, r * 2, r * 2)

          // Label larger centroids
          if (r > 10) {
            p.fill(255, 240)
            p.textSize(8)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${Math.round(c.mean)}`, x, y - 2)
            p.text(`n=${c.count}`, x, y + 8)
          }
        }

        // Flash the last inserted value
        if (flashTimer > 0 && lastInsertedValue >= 0) {
          const fx = 40 + (lastInsertedValue / maxVal) * (W - 80)
          const fy = centroidTop + centroidH / 2
          p.noFill()
          p.stroke(250, 204, 21, flashTimer * 12)
          p.strokeWeight(2)
          p.ellipse(fx, fy, 40 + (20 - flashTimer) * 2, 40 + (20 - flashTimer) * 2)
        }

        // Scale function explanation — draw region indicators
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        const labelY = centroidTop + centroidH / 2 + 45

        p.fill(52, 211, 153, 150)
        p.text('HIGH RESOLUTION', 40 + 0.03 * (W - 80), labelY)
        p.text('(p0-p5 tails)', 40 + 0.03 * (W - 80), labelY + 12)

        p.fill(99, 102, 241, 150)
        p.text('LOW RESOLUTION', W / 2, labelY)
        p.text('(middle)', W / 2, labelY + 12)

        p.fill(52, 211, 153, 150)
        p.text('HIGH RESOLUTION', 40 + 0.97 * (W - 80), labelY)
        p.text('(p95-p100 tails)', 40 + 0.97 * (W - 80), labelY + 12)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={450}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Speed:
            <input
              type="range"
              min={0}
              max={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-gray-400 w-8">{speed}</span>
          </label>
          <label className="flex items-center gap-2">
            Delta (compression):
            <input
              type="range"
              min={10}
              max={100}
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-gray-400 w-8">{delta}</span>
          </label>
          <span className="text-gray-500">
            Inserted: {totalInserted}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Percentile Query Visualization                          */
/* ------------------------------------------------------------------ */

function PercentileQuerySketch() {
  const [queryPercentile, setQueryPercentile] = useState(95)
  const queryRef = useRef(queryPercentile)
  queryRef.current = queryPercentile

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    const rng = makeRng(77)

    // Build a T-Digest with known data
    const allValues: number[] = []
    const centroids: Centroid[] = []
    let totalCount = 0

    function insertForBuild(val: number) {
      allValues.push(val)
      totalCount++
      if (centroids.length === 0) {
        centroids.push({ mean: val, count: 1 })
        return
      }
      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < centroids.length; i++) {
        const d = Math.abs(centroids[i].mean - val)
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      let cumCount = 0
      for (let i = 0; i < bestIdx; i++) cumCount += centroids[i].count
      cumCount += centroids[bestIdx].count / 2
      const q = cumCount / Math.max(1, totalCount)
      const maxC = maxCountForQ(q, 30, totalCount)
      if (centroids[bestIdx].count + 1 <= maxC) {
        const c = centroids[bestIdx]
        c.mean = (c.mean * c.count + val) / (c.count + 1)
        c.count++
      } else {
        centroids.push({ mean: val, count: 1 })
        centroids.sort((a, b) => a.mean - b.mean)
      }
    }

    // Pre-build with 5000 values
    for (let i = 0; i < 5000; i++) {
      insertForBuild(sampleLatency(rng))
    }
    allValues.sort((a, b) => a - b)

    function queryTDigest(pct: number): number {
      const target = (pct / 100) * totalCount
      let cumCount = 0
      for (let i = 0; i < centroids.length; i++) {
        if (cumCount + centroids[i].count >= target) {
          // Interpolate within this centroid
          const innerFrac = (target - cumCount) / centroids[i].count
          if (i === 0) return centroids[i].mean
          const prev = centroids[i - 1]
          const curr = centroids[i]
          return prev.mean + (curr.mean - prev.mean) * innerFrac
        }
        cumCount += centroids[i].count
      }
      return centroids[centroids.length - 1].mean
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const pct = queryRef.current
      const maxVal = 500

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Percentile Query: p${pct}`, 16, 12)

      // Draw CDF (cumulative distribution)
      const plotLeft = 60
      const plotRight = W - 40
      const plotTop = 50
      const plotBottom = 250
      const plotW = plotRight - plotLeft
      const plotH = plotBottom - plotTop

      // Grid
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      for (let i = 0; i <= 5; i++) {
        const y = plotTop + (i / 5) * plotH
        p.line(plotLeft, y, plotRight, y)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`${100 - i * 20}%`, plotLeft - 6, y)
        p.stroke(51, 65, 85)
      }
      for (let v = 0; v <= 500; v += 100) {
        const x = plotLeft + (v / maxVal) * plotW
        p.line(x, plotTop, x, plotBottom)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${v}ms`, x, plotBottom + 4)
        p.stroke(51, 65, 85)
      }

      // Actual CDF
      p.noFill()
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.beginShape()
      for (let i = 0; i < allValues.length; i += 10) {
        const x = plotLeft + (allValues[i] / maxVal) * plotW
        const y = plotBottom - ((i + 1) / allValues.length) * plotH
        p.vertex(x, y)
      }
      p.endShape()

      // T-Digest estimated CDF
      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.beginShape()
      let cum = 0
      for (const c of centroids) {
        const x = plotLeft + (c.mean / maxVal) * plotW
        cum += c.count
        const y = plotBottom - (cum / totalCount) * plotH
        p.vertex(x, y)
      }
      p.endShape()

      // Query line
      const exactIdx = Math.floor((pct / 100) * (allValues.length - 1))
      const exactVal = allValues[exactIdx]
      const estimatedVal = queryTDigest(pct)

      // Horizontal percentile line
      const pctY = plotBottom - (pct / 100) * plotH
      p.stroke(250, 204, 21, 180)
      p.strokeWeight(1)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([4, 4])
      p.line(plotLeft, pctY, plotRight, pctY)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

      // Vertical lines for exact and estimated
      const exactX = plotLeft + (exactVal / maxVal) * plotW
      const estX = plotLeft + (estimatedVal / maxVal) * plotW

      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.line(exactX, plotTop, exactX, plotBottom)

      p.stroke(52, 211, 153)
      p.strokeWeight(2)
      p.line(estX, plotTop, estX, plotBottom)

      // Legend
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)

      p.fill(99, 102, 241)
      p.rect(plotLeft, plotBottom + 24, 14, 3)
      p.fill(148, 163, 184)
      p.text(`Exact CDF / p${pct} = ${exactVal.toFixed(1)}ms`, plotLeft + 20, plotBottom + 20)

      p.fill(52, 211, 153)
      p.rect(plotLeft, plotBottom + 44, 14, 3)
      p.fill(148, 163, 184)
      p.text(`T-Digest CDF / p${pct} = ${estimatedVal.toFixed(1)}ms`, plotLeft + 20, plotBottom + 40)

      const error = Math.abs(estimatedVal - exactVal)
      const relError = (error / Math.max(1, exactVal)) * 100
      p.fill(250, 204, 21)
      p.text(`Error: ${error.toFixed(2)}ms (${relError.toFixed(2)}%)`, plotLeft + 20, plotBottom + 60)

      // Centroid display at bottom
      const cTop = plotBottom + 90
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Centroids: ${centroids.length} (from ${totalCount} values)`, 16, cTop)

      const maxCount = Math.max(...centroids.map(c => c.count))
      for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i]
        const x = plotLeft + (c.mean / maxVal) * plotW
        const r = Math.max(3, (c.count / maxCount) * 18 + 3)
        const y = cTop + 30

        let cumC = 0
        for (let j = 0; j < i; j++) cumC += centroids[j].count
        cumC += c.count / 2
        const q = cumC / totalCount
        const tailness = Math.min(q, 1 - q)
        if (tailness < 0.1) {
          p.fill(52, 211, 153, 200)
        } else {
          p.fill(99, 102, 241, 160)
        }
        p.noStroke()
        p.ellipse(x, y, r * 2, r * 2)
      }

      // Highlight the centroid used for the query
      p.noFill()
      p.stroke(250, 204, 21)
      p.strokeWeight(2)
      p.ellipse(estX, cTop + 30, 24, 24)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Query Percentile:
            <input
              type="range"
              min={1}
              max={99}
              value={queryPercentile}
              onChange={(e) => setQueryPercentile(Number(e.target.value))}
              className="w-64"
            />
            <span className="font-mono text-yellow-400 w-12">p{queryPercentile}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Merging Two T-Digests                                   */
/* ------------------------------------------------------------------ */

function MergeSketch() {
  const [merged, setMerged] = useState(false)
  const mergedRef = useRef(false)

  const [mergeProgress, setMergeProgress] = useState(0)
  const mergeProgressRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const rng1 = makeRng(11)
    const rng2 = makeRng(88)

    // Build two T-Digests from different "servers"
    const digestA: Centroid[] = []
    const digestB: Centroid[] = []
    const mergedDigest: Centroid[] = []
    let countA = 0
    let countB = 0

    function buildDigest(digest: Centroid[], rng: () => number, n: number): number {
      let total = 0
      for (let i = 0; i < n; i++) {
        const val = sampleLatency(rng)
        total++
        if (digest.length === 0) {
          digest.push({ mean: val, count: 1 })
          continue
        }
        let bestIdx = 0
        let bestDist = Infinity
        for (let j = 0; j < digest.length; j++) {
          const d = Math.abs(digest[j].mean - val)
          if (d < bestDist) { bestDist = d; bestIdx = j }
        }
        let cumCount = 0
        for (let j = 0; j < bestIdx; j++) cumCount += digest[j].count
        cumCount += digest[bestIdx].count / 2
        const q = cumCount / Math.max(1, total)
        const maxC = maxCountForQ(q, 25, total)
        if (digest[bestIdx].count + 1 <= maxC) {
          const c = digest[bestIdx]
          c.mean = (c.mean * c.count + val) / (c.count + 1)
          c.count++
        } else {
          digest.push({ mean: val, count: 1 })
          digest.sort((a, b) => a.mean - b.mean)
        }
      }
      return total
    }

    countA = buildDigest(digestA, rng1, 2000)
    countB = buildDigest(digestB, rng2, 2000)

    // Merge: interleave centroids sorted by mean, then re-compress
    function doMerge() {
      const combined = [...digestA, ...digestB].sort((a, b) => a.mean - b.mean)
      mergedDigest.length = 0
      // Simple re-compression: merge adjacent small centroids
      for (const c of combined) {
        if (mergedDigest.length === 0) {
          mergedDigest.push({ ...c })
          continue
        }
        const last = mergedDigest[mergedDigest.length - 1]
        let cumCount = 0
        for (const mc of mergedDigest) cumCount += mc.count
        const q = cumCount / (countA + countB)
        const maxC = maxCountForQ(q, 25, countA + countB)
        if (last.count + c.count <= maxC && Math.abs(last.mean - c.mean) < 15) {
          last.mean = (last.mean * last.count + c.mean * c.count) / (last.count + c.count)
          last.count += c.count
        } else {
          mergedDigest.push({ ...c })
        }
      }
    }

    let animProgress = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const maxVal = 500
      const leftPad = 40
      const rightPad = 40
      const plotW = W - leftPad - rightPad

      if (mergedRef.current && animProgress < 1) {
        animProgress = Math.min(1, animProgress + 0.02)
        mergeProgressRef.current = animProgress
        if (animProgress >= 0.5 && mergedDigest.length === 0) {
          doMerge()
        }
        if (p.frameCount % 2 === 0) setMergeProgress(animProgress)
      }

      const drawDigest = (digest: Centroid[], y: number, label: string, col: [number, number, number]) => {
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(label, 16, y)

        const maxCount = Math.max(1, ...digest.map(c => c.count))
        for (const c of digest) {
          const x = leftPad + (c.mean / maxVal) * plotW
          const r = Math.max(3, (c.count / maxCount) * 16 + 3)
          p.fill(col[0], col[1], col[2], 200)
          p.noStroke()
          p.ellipse(x, y, r * 2, r * 2)
        }

        // Axis
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(leftPad, y + 24, leftPad + plotW, y + 24)

        p.noStroke()
        p.fill(100, 116, 139)
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        for (let v = 0; v <= 500; v += 100) {
          p.text(`${v}`, leftPad + (v / maxVal) * plotW, y + 27)
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Merging T-Digests from Two Servers', 16, 12)

      if (animProgress < 0.5) {
        // Show two separate digests
        const offset = animProgress * 60
        drawDigest(digestA, 80 + offset, `Server A (${countA} values, ${digestA.length} centroids)`, [99, 102, 241])
        drawDigest(digestB, 220 - offset, `Server B (${countB} values, ${digestB.length} centroids)`, [244, 114, 182])
      } else {
        // Show merged
        const alpha = Math.min(1, (animProgress - 0.5) * 4)

        // Fade out originals
        if (alpha < 1) {
          p.push()
          ;(p.drawingContext as CanvasRenderingContext2D).globalAlpha = 1 - alpha
          drawDigest(digestA, 110, `Server A`, [99, 102, 241])
          drawDigest(digestB, 190, `Server B`, [244, 114, 182])
          p.pop()
        }

        // Fade in merged
        p.push()
        ;(p.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha
        drawDigest(mergedDigest, 150, `Merged (${countA + countB} values, ${mergedDigest.length} centroids)`, [52, 211, 153])
        p.pop()
      }

      // Explanation text
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      if (animProgress < 0.01) {
        p.text('Each server independently computes its own T-Digest. Click "Merge" to combine them.', 16, 310)
      } else if (animProgress < 0.5) {
        p.text('Step 1: Interleave centroids from both digests, sorted by mean...', 16, 310)
      } else if (animProgress < 1) {
        p.text('Step 2: Re-compress by merging adjacent centroids that fit within the scale function...', 16, 310)
      } else {
        p.text('Done! The merged T-Digest can answer percentile queries for ALL data from both servers.', 16, 310)
        p.text(`Combined: ${mergedDigest.length} centroids represent ${countA + countB} values with sub-1% error at tails.`, 16, 330)
      }

      // How it works
      p.fill(100, 116, 139)
      p.textSize(10)
      p.text('merge(A, B) = sort(A.centroids + B.centroids by mean) -> recompress with scale function', 16, 360)
      p.text('Key property: merge is ASSOCIATIVE and COMMUTATIVE -> works for any number of servers', 16, 376)
    }
  }, [])

  const handleMerge = useCallback(() => {
    setMerged(true)
    mergedRef.current = true
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={handleMerge}
            disabled={merged}
            className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mergeProgress >= 1 ? 'Merged!' : merged ? 'Merging...' : 'Merge Digests'}
          </button>
          <span className="text-gray-500">
            Distributed systems merge T-Digests to compute global percentiles
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const tdigestImplementation = `import math
import random

class Centroid:
    """A centroid is a weighted mean representing a cluster of values."""
    def __init__(self, mean, count=1):
        self.mean = mean
        self.count = count

    def __repr__(self):
        return f"Centroid(mean={self.mean:.2f}, count={self.count})"

class TDigest:
    """
    T-Digest: a data structure for accurate estimation of quantiles
    over streaming data, using O(delta) space regardless of data size.

    Key idea: keep more centroids (higher resolution) near the tails
    (q near 0 or 1) and fewer in the middle (q near 0.5).
    """
    def __init__(self, delta=100):
        self.delta = delta       # compression parameter
        self.centroids = []      # sorted list of centroids
        self.count = 0           # total values absorbed
        self.buffer = []         # buffer for batch inserts
        self.buffer_size = 500

    def _scale(self, q):
        """Scale function k(q) = delta/2 * arcsin(2q-1) / (pi/2)
        Maps quantile q in [0,1] to an index space.
        Near q=0 and q=1, small changes in q map to large changes in k,
        forcing more centroids (higher resolution) at the tails."""
        return (self.delta / 2) * math.asin(2 * q - 1) / (math.pi / 2)

    def _max_count(self, q):
        """Maximum count allowed for a centroid at quantile q."""
        if self.count == 0:
            return 1
        k0 = self._scale(q)
        k1 = self._scale(min(1.0, q + 1.0 / self.count))
        return max(1, int((k1 - k0) * self.count / self.delta * 4))

    def insert(self, value):
        """Insert a single value into the T-Digest."""
        self.buffer.append(value)
        if len(self.buffer) >= self.buffer_size:
            self._flush()

    def _flush(self):
        """Process buffered values."""
        random.shuffle(self.buffer)  # randomize insertion order
        for val in self.buffer:
            self._insert_one(val)
        self.buffer = []

    def _insert_one(self, value):
        self.count += 1
        if not self.centroids:
            self.centroids.append(Centroid(value, 1))
            return

        # Find nearest centroid
        best_idx = 0
        best_dist = float('inf')
        for i, c in enumerate(self.centroids):
            d = abs(c.mean - value)
            if d < best_dist:
                best_dist = d
                best_idx = i

        # Compute quantile of nearest centroid
        cum = sum(c.count for c in self.centroids[:best_idx])
        cum += self.centroids[best_idx].count / 2
        q = cum / self.count
        max_c = self._max_count(q)

        if self.centroids[best_idx].count + 1 <= max_c:
            # Merge into existing centroid
            c = self.centroids[best_idx]
            c.mean = (c.mean * c.count + value) / (c.count + 1)
            c.count += 1
        else:
            # Create new centroid and insert in sorted order
            new_c = Centroid(value, 1)
            inserted = False
            for i, c in enumerate(self.centroids):
                if c.mean > value:
                    self.centroids.insert(i, new_c)
                    inserted = True
                    break
            if not inserted:
                self.centroids.append(new_c)

    def percentile(self, p):
        """Query the p-th percentile (0-100)."""
        self._flush()
        if not self.centroids:
            return None

        target = (p / 100) * self.count
        cum = 0
        for i, c in enumerate(self.centroids):
            if cum + c.count >= target:
                # Interpolate
                inner = (target - cum) / c.count
                if i == 0:
                    return c.mean
                prev = self.centroids[i - 1]
                return prev.mean + (c.mean - prev.mean) * inner
            cum += c.count
        return self.centroids[-1].mean

    def merge(self, other):
        """Merge another T-Digest into this one.
        Used in distributed systems to combine digests from different nodes."""
        self._flush()
        other._flush()
        combined = sorted(
            self.centroids + other.centroids,
            key=lambda c: c.mean
        )
        new_digest = TDigest(self.delta)
        new_digest.count = self.count + other.count

        # Recompress
        for c in combined:
            if not new_digest.centroids:
                new_digest.centroids.append(Centroid(c.mean, c.count))
                continue
            last = new_digest.centroids[-1]
            cum = sum(x.count for x in new_digest.centroids)
            q = cum / new_digest.count
            max_c = new_digest._max_count(q)
            if last.count + c.count <= max_c:
                last.mean = (last.mean * last.count + c.mean * c.count) / (last.count + c.count)
                last.count += c.count
            else:
                new_digest.centroids.append(Centroid(c.mean, c.count))
        return new_digest

# Demo: build a T-Digest and query percentiles
random.seed(42)
td = TDigest(delta=100)

# Simulate API response times (bimodal distribution)
for _ in range(5000):
    if random.random() < 0.85:
        td.insert(10 + abs(random.gauss(0, 20)))  # fast responses
    else:
        td.insert(100 + abs(random.gauss(0, 120))) # slow responses

print(f"T-Digest built with {td.count} values using {len(td.centroids)} centroids")
print(f"Memory: ~{len(td.centroids) * 16} bytes vs {td.count * 8} bytes for raw storage")
print()
print("Percentile estimates:")
for pct in [50, 75, 90, 95, 99]:
    val = td.percentile(pct)
    print(f"  p{pct}: {val:.1f} ms")
`

const tdigestAccuracyTest = `import math
import random

# === T-Digest Implementation (compact) ===
class Centroid:
    def __init__(self, mean, count=1):
        self.mean = mean
        self.count = count

class TDigest:
    def __init__(self, delta=100):
        self.delta = delta
        self.centroids = []
        self.count = 0
        self.buf = []

    def _scale(self, q):
        return (self.delta / 2) * math.asin(2 * q - 1) / (math.pi / 2)

    def _max_count(self, q):
        if self.count == 0: return 1
        k0 = self._scale(q)
        k1 = self._scale(min(1.0, q + 1 / self.count))
        return max(1, int((k1 - k0) * self.count / self.delta * 4))

    def insert(self, v):
        self.buf.append(v)
        if len(self.buf) >= 500:
            self._flush()

    def _flush(self):
        random.shuffle(self.buf)
        for v in self.buf:
            self.count += 1
            if not self.centroids:
                self.centroids.append(Centroid(v)); continue
            bi, bd = 0, float('inf')
            for i, c in enumerate(self.centroids):
                d = abs(c.mean - v)
                if d < bd: bd = d; bi = i
            cum = sum(c.count for c in self.centroids[:bi]) + self.centroids[bi].count / 2
            q = cum / self.count
            mc = self._max_count(q)
            if self.centroids[bi].count + 1 <= mc:
                c = self.centroids[bi]
                c.mean = (c.mean * c.count + v) / (c.count + 1)
                c.count += 1
            else:
                nc = Centroid(v)
                ins = False
                for i, c in enumerate(self.centroids):
                    if c.mean > v:
                        self.centroids.insert(i, nc); ins = True; break
                if not ins: self.centroids.append(nc)
        self.buf = []

    def percentile(self, p):
        self._flush()
        if not self.centroids: return None
        target = (p / 100) * self.count
        cum = 0
        for i, c in enumerate(self.centroids):
            if cum + c.count >= target:
                inner = (target - cum) / c.count
                if i == 0: return c.mean
                prev = self.centroids[i - 1]
                return prev.mean + (c.mean - prev.mean) * inner
            cum += c.count
        return self.centroids[-1].mean

# === Accuracy Test: T-Digest vs Exact ===
random.seed(123)
N = 100_000
all_values = []
td = TDigest(delta=100)

for _ in range(N):
    if random.random() < 0.85:
        v = 10 + abs(random.gauss(0, 20))
    else:
        v = 100 + abs(random.gauss(0, 120))
    all_values.append(v)
    td.insert(v)

all_values.sort()

print(f"Streamed {N:,} values into T-Digest")
print(f"Centroids used: {len(td.centroids)}")
print(f"Compression ratio: {N / len(td.centroids):.0f}x")
print(f"Memory savings: {(1 - len(td.centroids) / N) * 100:.2f}%")
print()
print(f"{'Percentile':<12} {'Exact':>10} {'T-Digest':>10} {'Error':>10} {'Rel Err%':>10}")
print("-" * 56)

for pct in [1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9]:
    exact_idx = int((pct / 100) * (N - 1))
    exact_val = all_values[exact_idx]
    est_val = td.percentile(pct)
    err = abs(est_val - exact_val)
    rel_err = (err / max(0.01, exact_val)) * 100
    marker = " <-- TAIL" if pct >= 95 or pct <= 5 else ""
    print(f"  p{pct:<9} {exact_val:>10.2f} {est_val:>10.2f} {err:>10.2f} {rel_err:>9.2f}%{marker}")

print()
print("Key insight: T-Digest is MOST accurate at the tails (p95, p99, p99.9)")
print("where monitoring systems need it most!")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function TDigest() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          T-Digest: Streaming Percentiles
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          How do you compute p50, p95, and p99 over billions of data points in real time,
          using only kilobytes of memory? The T-Digest data structure solves one of the
          hardest problems in production monitoring.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Real-Time Percentiles at Scale</h2>
        <p className="text-gray-300 leading-relaxed">
          Imagine you run a service handling <strong className="text-white">100,000 requests per second</strong>.
          Your monitoring dashboard needs to show the p50 (median), p95, and p99 latency
          updated every second. That is 8.6 billion data points per day.
        </p>
        <p className="text-gray-300 leading-relaxed">
          You cannot store them all. Even at 8 bytes per value, one day of data is
          <strong className="text-white"> ~64 GB</strong>. And you need the answer in real time,
          not after a batch job finishes.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-2">Real-world examples</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong className="text-white">Elasticsearch</strong> — percentile aggregation across terabytes of log data</li>
            <li><strong className="text-white">Prometheus</strong> — histogram quantile estimation for alerting (is p99 latency above 200ms?)</li>
            <li><strong className="text-white">Netflix</strong> — streaming video quality monitoring across millions of devices</li>
            <li><strong className="text-white">Datadog / Grafana</strong> — real-time latency dashboards</li>
          </ul>
        </div>
      </section>

      {/* ---- Section: Naive Approach ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Naive Approach: Sort Everything</h2>
        <p className="text-gray-300 leading-relaxed">
          To find the exact p95, you sort all values and pick the one at index 0.95 * n.
          This is <code className="text-emerald-400">O(n log n)</code> time and <code className="text-emerald-400">O(n)</code> memory.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm">
          <p className="text-gray-400"># Naive percentile computation</p>
          <p className="text-gray-300">values.sort() &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# O(n log n) time</p>
          <p className="text-gray-300">p95 = values[int(0.95 * n)] &nbsp;# requires ALL values in memory</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          At 100K req/sec, after just one hour you have 360 million values. Sorting 360M
          values takes seconds. After a day, you need 64 GB of RAM just to hold the array.
          <strong className="text-white"> This does not scale.</strong>
        </p>
        <p className="text-gray-300 leading-relaxed">
          What we need is a <em>streaming algorithm</em>: process each value once, use
          constant memory, and answer percentile queries at any time.
        </p>
      </section>

      {/* ---- Section: The Key Insight ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Key Insight: Variable Resolution</h2>
        <p className="text-gray-300 leading-relaxed">
          The brilliant insight behind T-Digest (invented by Ted Dunning in 2013) is:
        </p>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            Keep more detail where it matters most. For percentile queries, the tails
            (near p0 and p100) matter more than the middle. Use many small clusters near
            the extremes and few large clusters in the middle.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          T-Digest represents the data as a sorted list of <strong className="text-white">centroids</strong>.
          Each centroid has a <code className="text-emerald-400">mean</code> (average value of the points it
          represents) and a <code className="text-emerald-400">count</code> (how many points it absorbed).
          The <strong className="text-white">scale function</strong> controls how large each centroid can grow
          based on its position in the quantile space:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          <li>Near q=0 or q=1 (the tails): centroids stay <strong className="text-white">small</strong> (few points each) for high accuracy</li>
          <li>Near q=0.5 (the middle): centroids grow <strong className="text-white">large</strong> (many points each) to save space</li>
        </ul>
        <p className="text-gray-300 leading-relaxed">
          This is exactly what monitoring systems need — pinpoint accuracy at p95, p99, p99.9
          where SLA violations live, and coarser resolution in the uninteresting middle.
        </p>
      </section>

      {/* ---- Section: Centroid Formation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Watch Centroids Form</h2>
        <p className="text-gray-300 leading-relaxed">
          This visualization streams API response times into a T-Digest. Watch how centroids
          form: <span className="text-emerald-400">green centroids</span> at the tails stay small
          for precision, while <span className="text-indigo-400">indigo centroids</span> in the
          middle grow large to compress the data. The yellow ring flashes where each new value
          is absorbed.
        </p>
        <CentroidFormationSketch />
      </section>

      {/* ---- Section: Querying Percentiles ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Querying Percentiles</h2>
        <p className="text-gray-300 leading-relaxed">
          To answer "what is the p95 latency?", T-Digest walks through its centroids,
          accumulating counts until it reaches 95% of the total. It then interpolates
          between the two surrounding centroids. Drag the slider to query any percentile
          and see how close the estimate is to the exact value.
        </p>
        <PercentileQuerySketch />
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">How the query works step by step</h3>
          <ol className="list-decimal list-inside text-gray-300 space-y-1">
            <li>Walk through centroids left to right, summing their counts</li>
            <li>When the cumulative count reaches <code className="text-emerald-400">p/100 * total_count</code>, stop</li>
            <li>Interpolate between this centroid and the previous one</li>
            <li>Return the interpolated value as the percentile estimate</li>
          </ol>
          <p className="text-gray-400 text-sm mt-2">
            Time complexity: O(centroids) per query, where centroids is typically 100-300 regardless of data size.
          </p>
        </div>
      </section>

      {/* ---- Section: Merging T-Digests ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Merging T-Digests: The Distributed Superpower</h2>
        <p className="text-gray-300 leading-relaxed">
          In distributed systems, each server computes its own T-Digest locally. To get
          global percentiles, you <strong className="text-white">merge</strong> the digests.
          This is what makes T-Digest practical for systems like Elasticsearch and Prometheus:
          each shard/node sends its compact digest to a coordinator, which merges them all.
        </p>
        <MergeSketch />
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-2">Merge Algorithm</h3>
          <ol className="list-decimal list-inside text-gray-300 space-y-1">
            <li>Combine all centroids from both digests</li>
            <li>Sort by mean value</li>
            <li>Re-compress: walk through and merge adjacent centroids that fit within the scale function</li>
          </ol>
          <p className="text-gray-300 mt-2">
            The merge operation is <strong className="text-white">associative and commutative</strong>,
            meaning you can merge in any order and get the same result. This makes it
            trivial to fan-out/fan-in across hundreds of nodes.
          </p>
        </div>
      </section>

      {/* ---- Section: Scale Function Deep Dive ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Scale Function: Why Tails Get More Resolution</h2>
        <p className="text-gray-300 leading-relaxed">
          The magic of T-Digest lies in its scale function <code className="text-emerald-400">k(q) = (delta/2) * arcsin(2q - 1) / (pi/2)</code>.
          This maps quantile position q in [0, 1] to a compressed index space. Near q=0 and q=1,
          the function changes rapidly — small changes in q produce large changes in k. This means
          centroids near the tails are allocated more "space" in the index, forcing them to stay small.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm text-gray-300">
          <p className="text-gray-400"># Scale function behavior</p>
          <p>q=0.01 (p1):  &nbsp;max centroid size = ~3 values &nbsp;(high resolution at tail)</p>
          <p>q=0.05 (p5):  &nbsp;max centroid size = ~8 values</p>
          <p>q=0.50 (p50): &nbsp;max centroid size = ~200 values (low resolution at center)</p>
          <p>q=0.95 (p95): &nbsp;max centroid size = ~8 values</p>
          <p>q=0.99 (p99): &nbsp;max centroid size = ~3 values &nbsp;(high resolution at tail)</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The <code className="text-emerald-400">delta</code> parameter controls total compression.
          Higher delta = more centroids = better accuracy but more memory. In practice,
          delta=100 gives sub-1% error at the tails with ~200-300 centroids (about 5 KB of memory) —
          enough to summarize billions of values.
        </p>
      </section>

      {/* ---- Python: Full Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          Here is a complete T-Digest implementation from scratch. It includes the scale
          function, centroid insertion with merging, percentile querying, and digest merging
          for distributed use.
        </p>
        <PythonCell defaultCode={tdigestImplementation} />
      </section>

      {/* ---- Python: Accuracy Test ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Accuracy Test: T-Digest vs Exact Percentiles</h2>
        <p className="text-gray-300 leading-relaxed">
          How good is T-Digest really? Let us stream 100,000 values and compare the estimated
          percentiles against the exact values computed by sorting. Notice that the error is
          smallest at the tails (p95, p99, p99.9) — exactly where we need it most.
        </p>
        <PythonCell defaultCode={tdigestAccuracyTest} />
      </section>

      {/* ---- Section: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Elasticsearch</h3>
            <p className="text-gray-300 text-sm">
              The <code className="text-emerald-400">percentiles</code> aggregation uses T-Digest
              internally. When you run a percentile query across a distributed index, each shard
              computes a local T-Digest and sends it to the coordinating node for merging.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Prometheus / Grafana</h3>
            <p className="text-gray-300 text-sm">
              Prometheus uses histograms and summaries for quantile estimation. The native
              histogram type in Prometheus 2.40+ uses a T-Digest-like approach for more
              accurate percentile computation.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Netflix</h3>
            <p className="text-gray-300 text-sm">
              Netflix uses T-Digest extensively in their monitoring infrastructure to track
              streaming video quality metrics (buffer ratio, bitrate) across hundreds of
              millions of devices in real time.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Apache Spark / Flink</h3>
            <p className="text-gray-300 text-sm">
              Both frameworks use T-Digest for approximate percentile computation in
              distributed data processing pipelines, where exact computation would require
              expensive shuffles.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section: Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">Time</th>
                <th className="text-left py-2 text-white">Space</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert one value</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">O(delta)</td>
                <td className="py-2 font-mono text-emerald-400">O(delta)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Query percentile</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">O(delta)</td>
                <td className="py-2 font-mono text-emerald-400">O(1)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Merge two digests</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">O(delta log delta)</td>
                <td className="py-2 font-mono text-emerald-400">O(delta)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Exact sort (naive)</td>
                <td className="py-2 pr-4 font-mono text-red-400">O(n log n)</td>
                <td className="py-2 font-mono text-red-400">O(n)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-300 leading-relaxed">
          With delta=100, a T-Digest uses about <strong className="text-white">5 KB</strong> of memory
          regardless of whether it has absorbed 1,000 values or 1,000,000,000 values. That is
          the power of streaming data structures.
        </p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>T-Digest represents data as a sorted list of weighted centroids that adaptively cluster values</li>
          <li>The scale function ensures more centroids (higher precision) near the tails and fewer in the middle</li>
          <li>Percentile queries interpolate between centroids in O(delta) time</li>
          <li>T-Digests can be merged, making them ideal for distributed systems where each node computes a local digest</li>
          <li>Practical accuracy: sub-1% relative error at p95/p99 with only ~200 centroids</li>
          <li>Used in production by Elasticsearch, Prometheus, Netflix, Spark, and many more</li>
        </ul>
      </section>
    </div>
  )
}
