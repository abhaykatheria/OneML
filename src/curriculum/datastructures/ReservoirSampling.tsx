import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/reservoir-sampling',
  title: 'Reservoir Sampling: Random Samples from Streams',
  description:
    'Maintain a perfectly uniform random sample of K items from a stream of unknown (possibly infinite) length — using O(K) memory and a single pass',
  track: 'datastructures',
  order: 12,
  tags: ['reservoir-sampling', 'streaming', 'randomized', 'algorithm-r', 'sampling', 'statistics'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Generate a deterministic color for an item index */
function itemColor(index: number): [number, number, number] {
  const hues: [number, number, number][] = [
    [99, 102, 241],   // indigo
    [239, 68, 68],    // red
    [52, 211, 153],   // emerald
    [250, 204, 21],   // yellow
    [168, 85, 247],   // purple
    [56, 189, 248],   // sky
    [251, 146, 60],   // orange
    [236, 72, 153],   // pink
    [34, 197, 94],    // green
    [244, 114, 182],  // rose
  ]
  return hues[index % hues.length]
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Reservoir Sampling Visualization             */
/* ------------------------------------------------------------------ */

function ReservoirSketch() {
  const [k, setK] = useState(5)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [streamCount, setStreamCount] = useState(0)

  const kRef = useRef(k)
  kRef.current = k
  const runningRef = useRef(running)
  runningRef.current = running
  const speedRef = useRef(speed)
  speedRef.current = speed

  const handleReset = useCallback(() => {
    setRunning(false)
    runningRef.current = false
    setStreamCount(0)
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 500

    // Algorithm state
    let reservoir: { value: number; color: [number, number, number] }[] = []
    let n = 0 // total items seen
    let lastAction: {
      item: number
      kept: boolean
      replacedIdx: number | null
      probability: number
      timer: number
    } | null = null
    const streamItems: { value: number; color: [number, number, number]; x: number; kept: boolean }[] = []
    const selectionCounts = new Map<number, number>() // track how many times each item number is selected
    let resetFlag = false

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 800
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const curK = kRef.current

      // Detect reset (k changed or running toggled off with intention to reset)
      if (curK !== reservoir.length && n > 0) {
        resetFlag = true
      }
      if (resetFlag || (n === 0 && reservoir.length > 0)) {
        reservoir = []
        n = 0
        lastAction = null
        streamItems.length = 0
        selectionCounts.clear()
        resetFlag = false
      }

      // Process new items
      if (runningRef.current) {
        const spd = speedRef.current
        const itemsPerFrame = Math.max(1, Math.floor(spd / 2))

        for (let q = 0; q < itemsPerFrame; q++) {
          n++
          const newItem = { value: n, color: itemColor(n) }
          const streamX = W + 20

          if (n <= curK) {
            // Fill reservoir with first K items
            reservoir.push({ ...newItem })
            lastAction = { item: n, kept: true, replacedIdx: null, probability: 1.0, timer: 30 }
            streamItems.push({ ...newItem, x: streamX, kept: true })
            selectionCounts.set(n, (selectionCounts.get(n) ?? 0) + 1)
          } else {
            // Algorithm R: keep with probability K/n
            const prob = curK / n
            const rand = Math.random()
            if (rand < prob) {
              const replaceIdx = Math.floor(Math.random() * curK)
              const oldValue = reservoir[replaceIdx].value
              selectionCounts.set(oldValue, Math.max(0, (selectionCounts.get(oldValue) ?? 1) - 1))
              reservoir[replaceIdx] = { ...newItem }
              selectionCounts.set(n, (selectionCounts.get(n) ?? 0) + 1)
              lastAction = { item: n, kept: true, replacedIdx: replaceIdx, probability: prob, timer: 30 }
              streamItems.push({ ...newItem, x: streamX, kept: true })
            } else {
              lastAction = { item: n, kept: false, replacedIdx: null, probability: prob, timer: 30 }
              streamItems.push({ ...newItem, x: streamX, kept: false })
            }
          }
        }

        if (p.frameCount % 10 === 0) {
          setStreamCount(n)
        }
      }

      // Animate stream items flowing left
      for (const item of streamItems) {
        item.x -= 2 + speedRef.current * 0.5
      }
      // Remove items that have gone off screen
      while (streamItems.length > 0 && streamItems[0].x < -30) {
        streamItems.shift()
      }

      if (lastAction && lastAction.timer > 0) lastAction.timer--

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Reservoir Sampling (Algorithm R)  |  K=${curK}  |  Items seen: ${n}`, 16, 12)

      // Draw stream
      const streamY = 55
      const streamH = 30
      p.fill(30, 41, 59)
      p.noStroke()
      p.rect(0, streamY, W, streamH)

      // Stream label
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('STREAM >>>', 8, streamY + streamH / 2)

      // Draw flowing items
      for (const item of streamItems) {
        if (item.x < 0 || item.x > W + 20) continue
        const [r, g, b] = item.color
        const alpha = item.kept ? 220 : 80
        p.fill(r, g, b, alpha)
        p.noStroke()
        p.ellipse(item.x, streamY + streamH / 2, 18, 18)
        p.fill(255, 255, 255, alpha)
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${item.value}`, item.x, streamY + streamH / 2)
      }

      // Draw reservoir
      const resY = 120
      const resH = 60
      const slotW = Math.min(80, (W - 60) / curK)
      const resStartX = (W - curK * slotW) / 2

      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`Reservoir (K = ${curK} slots)`, W / 2, resY - 18)

      for (let i = 0; i < curK; i++) {
        const x = resStartX + i * slotW
        const isReplaceTarget = lastAction && lastAction.replacedIdx === i && lastAction.timer > 0

        if (i < reservoir.length) {
          const [r, g, b] = reservoir[i].color
          if (isReplaceTarget) {
            // Flash effect for replacement
            const flash = Math.sin(lastAction!.timer * 0.3) * 50 + 200
            p.fill(r, g, b, flash)
            p.stroke(250, 204, 21)
            p.strokeWeight(2)
          } else {
            p.fill(r, g, b, 160)
            p.stroke(71, 85, 105)
            p.strokeWeight(1)
          }
        } else {
          p.fill(30, 41, 59)
          p.stroke(71, 85, 105)
          p.strokeWeight(1)
        }

        p.rect(x + 2, resY, slotW - 4, resH, 5)

        // Value
        if (i < reservoir.length) {
          p.fill(255)
          p.noStroke()
          p.textSize(14)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${reservoir[i].value}`, x + slotW / 2, resY + resH / 2 - 6)

          // Slot index
          p.fill(100, 116, 139)
          p.textSize(8)
          p.text(`slot ${i}`, x + slotW / 2, resY + resH / 2 + 14)
        } else {
          p.fill(80)
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('empty', x + slotW / 2, resY + resH / 2)
        }
      }

      // Decision display
      const decY = resY + resH + 30
      if (lastAction && lastAction.timer > 0 && n > curK) {
        const prob = (lastAction.probability * 100).toFixed(1)
        p.noStroke()

        if (lastAction.kept) {
          p.fill(52, 211, 153)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text(
            `Item ${lastAction.item}: kept! (prob = K/n = ${curK}/${n} = ${prob}%) ` +
            (lastAction.replacedIdx !== null ? `\u2192 replaced slot ${lastAction.replacedIdx}` : ''),
            W / 2, decY
          )
        } else {
          p.fill(239, 68, 68, 180)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text(
            `Item ${lastAction.item}: rejected (prob = ${prob}%, random > threshold)`,
            W / 2, decY
          )
        }
      } else if (n > 0 && n <= curK) {
        p.fill(52, 211, 153, 180)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Filling reservoir: ${n}/${curK} slots used (first K items always kept)`, W / 2, decY)
      }

      // Probability visualization
      const probY = decY + 32
      if (n > curK) {
        const prob = curK / n
        const barX = 60
        const barW = W - 120
        const barH = 20

        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Current acceptance probability: K/n = ${curK}/${n}`, barX, probY)

        // Probability bar
        const pbY = probY + 16
        p.fill(30, 41, 59)
        p.noStroke()
        p.rect(barX, pbY, barW, barH, 3)
        p.fill(52, 211, 153, 180)
        p.rect(barX, pbY, barW * prob, barH, 3)

        p.fill(255)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${(prob * 100).toFixed(2)}%`, barX + barW * prob / 2, pbY + barH / 2)

        // Annotation
        p.fill(100, 116, 139)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text(
          `As n grows, acceptance probability shrinks \u2192 ensures each item has equal K/n chance of being in the reservoir`,
          barX, pbY + barH + 6
        )
      }

      // Convergence chart — show that each item has ~K/n probability
      const chartTop = 330
      const chartBottom = canvasH - 30
      const chartLeft = 60
      const chartRight = W - 30
      const chartW = chartRight - chartLeft
      const chartH = chartBottom - chartTop

      if (n > curK) {
        // Chart border
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.noFill()
        p.rect(chartLeft, chartTop, chartW, chartH)

        p.fill(148, 163, 184)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Selection frequency per item (should converge to K/n)', chartLeft + chartW / 2, chartTop - 4)

        // Expected value line
        const expectedProb = curK / n
        const expectedY = chartBottom - (expectedProb * n / curK) * chartH * 0.4
        p.stroke(250, 204, 21, 150)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([4, 4])
        p.line(chartLeft, expectedY, chartRight, expectedY)
        ctx.setLineDash([])

        p.fill(250, 204, 21, 180)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.RIGHT, p.BOTTOM)
        p.text(`Expected: K/n = ${expectedProb.toFixed(4)}`, chartRight, expectedY - 2)

        // Show reservoir items as bars
        const barCount = Math.min(reservoir.length, 20)
        const bw = Math.min(30, chartW / (barCount + 1))
        for (let i = 0; i < barCount; i++) {
          const item = reservoir[i]
          const inReservoir = 1 // it is currently in reservoir
          const x = chartLeft + 10 + i * (bw + 4)
          const normalizedH = (inReservoir / curK) * chartH * 0.4
          const [r, g, b] = item.color

          p.fill(r, g, b, 180)
          p.noStroke()
          p.rect(x, chartBottom - normalizedH, bw, normalizedH, 2, 2, 0, 0)

          p.fill(200)
          p.textSize(7)
          p.textAlign(p.CENTER, p.TOP)
          p.text(`${item.value}`, x + bw / 2, chartBottom + 2)
        }

        // Y-axis label
        p.fill(100, 116, 139)
        p.textSize(8)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text('1.0', chartLeft - 4, chartBottom - chartH * 0.4)
        p.text('0.0', chartLeft - 4, chartBottom)
      } else {
        p.fill(100, 116, 139)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Start the stream to see probability convergence', W / 2, (chartTop + chartBottom) / 2)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={500} />
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
        <button
          onClick={() => { setRunning(!running); runningRef.current = !running }}
          className={`px-4 py-1.5 rounded text-white text-sm font-medium transition-colors ${running ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {running ? 'Pause' : 'Start Stream'}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <label className="flex items-center gap-2 text-gray-400">
          K:
          <input
            type="range" min={2} max={10} value={k}
            onChange={(e) => { const v = Number(e.target.value); setK(v); kRef.current = v; handleReset() }}
            className="w-20"
          />
          <span className="w-6 text-indigo-400">{k}</span>
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          Speed:
          <input
            type="range" min={1} max={9} value={speed}
            onChange={(e) => { setSpeed(Number(e.target.value)); speedRef.current = Number(e.target.value) }}
            className="w-20"
          />
          <span className="w-4">{speed}</span>
        </label>
        <span className="text-gray-500 text-xs">
          Items seen: {streamCount}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Probability Convergence Visualization                   */
/* ------------------------------------------------------------------ */

function ConvergenceSketch() {
  const [running, setRunning] = useState(false)
  const [totalItems, setTotalItems] = useState(0)

  const runningRef = useRef(running)
  runningRef.current = running

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const K = 5

    let reservoir: number[] = []
    let n = 0
    const selectionFreq = new Map<number, number>() // item -> times it was in reservoir at sample point
    const samplePoints: { n: number; freqs: number[] }[] = []
    let sampleTimer = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 800
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width

      if (runningRef.current) {
        // Process multiple items per frame
        for (let q = 0; q < 20; q++) {
          n++
          if (n <= K) {
            reservoir.push(n)
          } else {
            const j = Math.floor(Math.random() * n)
            if (j < K) {
              reservoir[j] = n
            }
          }

          // Sample every 50 items
          sampleTimer++
          if (sampleTimer % 50 === 0) {
            // Count which items are currently in reservoir
            for (const item of reservoir) {
              selectionFreq.set(item, (selectionFreq.get(item) ?? 0) + 1)
            }

            // Record sample point: compute empirical probability for items 1..min(n,100)
            const maxCheck = Math.min(n, 100)
            const freqs: number[] = []
            const totalSamples = sampleTimer / 50
            for (let i = 1; i <= maxCheck; i++) {
              const count = selectionFreq.get(i) ?? 0
              freqs.push(count / totalSamples)
            }
            samplePoints.push({ n, freqs })
            if (samplePoints.length > 200) samplePoints.shift()

            if (sampleTimer % 200 === 0) {
              setTotalItems(n)
            }
          }
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Probability Convergence  |  K=${K}  |  n=${n}`, 16, 12)

      // Chart
      const chartLeft = 60
      const chartRight = W - 30
      const chartTop = 50
      const chartBottom = canvasH - 50
      const chartW = chartRight - chartLeft
      const chartH = chartBottom - chartTop

      // Border
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.noFill()
      p.rect(chartLeft, chartTop, chartW, chartH)

      if (samplePoints.length > 1 && n > K) {
        const expectedProb = K / n
        const maxProb = Math.max(0.3, expectedProb * 3)

        // Y-axis
        p.noStroke()
        p.fill(100, 116, 139)
        p.textSize(8)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let i = 0; i <= 4; i++) {
          const val = (i / 4) * maxProb
          const y = chartBottom - (i / 4) * chartH
          p.text(`${(val * 100).toFixed(1)}%`, chartLeft - 4, y)
          p.stroke(51, 65, 85)
          p.strokeWeight(0.5)
          p.line(chartLeft, y, chartRight, y)
          p.noStroke()
        }

        // X-axis label
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Item index (first 100 items)', chartLeft + chartW / 2, chartBottom + 20)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Y: empirical probability of being in reservoir', chartLeft, chartBottom + 34)

        // Expected probability line
        const expectedY = chartBottom - (expectedProb / maxProb) * chartH
        if (expectedY > chartTop) {
          p.stroke(250, 204, 21, 200)
          p.strokeWeight(1.5)
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.setLineDash([6, 4])
          p.line(chartLeft, expectedY, chartRight, expectedY)
          ctx.setLineDash([])
          p.fill(250, 204, 21)
          p.noStroke()
          p.textSize(9)
          p.textAlign(p.RIGHT, p.BOTTOM)
          p.text(`Expected K/n = ${(expectedProb * 100).toFixed(3)}%`, chartRight, expectedY - 3)
        }

        // Plot the latest frequency distribution
        const latest = samplePoints[samplePoints.length - 1]
        const numBars = Math.min(latest.freqs.length, 100)
        const barW = Math.max(1, chartW / numBars)

        for (let i = 0; i < numBars; i++) {
          const freq = latest.freqs[i]
          const x = chartLeft + (i / numBars) * chartW
          const h = (freq / maxProb) * chartH
          const [r, g, b] = itemColor(i + 1)
          p.fill(r, g, b, 150)
          p.noStroke()
          p.rect(x, chartBottom - Math.min(h, chartH), barW - (barW > 2 ? 1 : 0), Math.min(h, chartH))
        }

        // Uniformity metric
        if (latest.freqs.length > 10) {
          const avg = latest.freqs.reduce((a, b) => a + b, 0) / latest.freqs.length
          const variance = latest.freqs.reduce((a, b) => a + (b - avg) ** 2, 0) / latest.freqs.length
          const cv = avg > 0 ? Math.sqrt(variance) / avg : 0
          p.fill(148, 163, 184)
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.LEFT, p.TOP)
          p.text(
            `Coefficient of variation: ${cv.toFixed(3)} (closer to 0 = more uniform)`,
            chartLeft + 10, chartTop + 8
          )
        }
      } else {
        p.fill(100, 116, 139)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Start the stream to see how sampling probabilities converge to uniform', W / 2, (chartTop + chartBottom) / 2)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={400} />
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
        <button
          onClick={() => { setRunning(!running); runningRef.current = !running }}
          className={`px-4 py-1.5 rounded text-white text-sm font-medium transition-colors ${running ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <span className="text-gray-500 text-xs">
          Items processed: {totalItems} | K=5 | Each bar shows how often that item was found in the reservoir
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const algorithmRImplementation = `import random
random.seed(42)

def reservoir_sample(stream, k):
    """
    Algorithm R (Vitter, 1985): Reservoir Sampling

    Maintains a uniform random sample of exactly K items from a stream
    of unknown length, using O(K) memory and a single pass.

    For item i (1-indexed):
      - If i <= K: add to reservoir (guaranteed)
      - If i > K: keep with probability K/i, replacing a random reservoir item

    Theorem: After seeing n items, every item has exactly K/n probability
    of being in the reservoir.
    """
    reservoir = []
    for i, item in enumerate(stream):
        if i < k:
            # First K items always go in
            reservoir.append(item)
        else:
            # Keep item with probability k/(i+1)
            j = random.randint(0, i)
            if j < k:
                reservoir[j] = item
    return reservoir


# --- Basic demonstration ---
print("=== Algorithm R: Reservoir Sampling ===\\n")

# Stream of 100,000 items, sample K=10
stream = range(100_000)
k = 10
sample = reservoir_sample(stream, k)
print(f"Stream: 0 to 99,999 (100K items)")
print(f"K = {k}")
print(f"Sample: {sorted(sample)}")
print(f"Sample size: {len(sample)}")

# --- Verify uniformity ---
print(f"\\n=== Uniformity Verification ===")
print(f"Running 10,000 trials of sampling K=5 from stream of 100 items...")

k = 5
n = 100
trials = 10_000
selection_count = [0] * n  # how many times each item was selected

for _ in range(trials):
    sample = reservoir_sample(range(n), k)
    for item in sample:
        selection_count[item] += 1

# Each item should be selected with probability K/n = 5/100 = 5%
expected = k / n
print(f"\\nExpected selection probability: K/n = {k}/{n} = {expected:.4f} ({expected*100:.1f}%)")
print(f"Expected selections per item: {expected * trials:.0f}")

# Show first 20 items
print(f"\\nItem | Count | Frequency | Deviation")
print("-" * 45)
for i in range(20):
    freq = selection_count[i] / trials
    deviation = (freq - expected) / expected * 100
    bar = "#" * int(freq * 200)
    print(f"  {i:2d} | {selection_count[i]:5d} | {freq:.4f}    | {deviation:+.1f}%  {bar}")

# Chi-squared test for uniformity
chi_sq = sum((c - expected * trials) ** 2 / (expected * trials) for c in selection_count)
print(f"\\nChi-squared statistic: {chi_sq:.1f}")
print(f"Degrees of freedom: {n - 1}")
print(f"Expected range for uniform: ~{n-1 - 2*(n-1)**0.5:.0f} to {n-1 + 2*(n-1)**0.5:.0f}")
print(f"Uniform: {'YES' if chi_sq < n - 1 + 3 * (n-1)**0.5 else 'NO'}")

# --- Why it works: step-by-step proof for small case ---
print(f"\\n=== Why It Works: Proof by Example ===")
print(f"K=2, stream=[A, B, C, D]")
print()
print("After item A (i=1): reservoir = [A]        P(A in res) = 1")
print("After item B (i=2): reservoir = [A, B]     P(A) = 1, P(B) = 1")
print("After item C (i=3): keep C with prob 2/3")
print("  If kept: replaces random slot => P(A survives) = 1 * (1/3 + 2/3 * 1/2) = 2/3")
print("  P(A in res after C) = 2/3")
print("  P(B in res after C) = 2/3  (symmetric)")
print("  P(C in res after C) = 2/3  (kept with prob 2/3)")
print("After item D (i=4): keep D with prob 2/4 = 1/2")
print("  P(any earlier item survives) = 2/3 * (1/2 + 1/2 * 1/2) = 2/3 * 3/4 = 1/2")
print("  P(D in res) = 1/2 = K/n = 2/4")
print("  => Every item has probability K/n = 2/4 = 0.5")
`

const weightedReservoirSampling = `import random
import math
random.seed(42)

def weighted_reservoir_sample(stream, k):
    """
    Weighted Reservoir Sampling (Efraimidis & Spirakis, 2006)

    Each item has a weight. Heavier items are more likely to be sampled.

    Algorithm:
    1. For each item, compute key = random()^(1/weight)
    2. Keep the K items with the largest keys
    3. This gives each item probability proportional to its weight

    This is used in: ML training (importance sampling), A/B testing,
    database TABLESAMPLE, network monitoring.
    """
    import heapq

    heap = []  # min-heap of (key, item)

    for item, weight in stream:
        # Key formula: u^(1/w) where u ~ Uniform(0,1)
        u = random.random()
        key = u ** (1.0 / weight) if weight > 0 else 0

        if len(heap) < k:
            heapq.heappush(heap, (key, item))
        elif key > heap[0][0]:
            heapq.heapreplace(heap, (key, item))

    return [(item, key) for key, item in heap]


# --- Weighted sampling demonstration ---
print("=== Weighted Reservoir Sampling ===\\n")

# Items with different weights (e.g., server traffic by region)
items = [
    ("US-East",    50),
    ("US-West",    30),
    ("EU-West",    25),
    ("EU-Central", 15),
    ("Asia-Pacific", 20),
    ("South-America", 8),
    ("Africa",      5),
    ("Middle-East",  7),
    ("Australia",   10),
    ("Canada",      12),
]

total_weight = sum(w for _, w in items)
print("Items and weights (e.g., server traffic by region):")
for name, weight in items:
    pct = weight / total_weight * 100
    bar = "#" * int(pct)
    print(f"  {name:<15} weight={weight:3d} ({pct:5.1f}%) {bar}")

# Run weighted sampling many times
print(f"\\n--- Sampling K=3 from {len(items)} items, 10000 trials ---")
k = 3
trials = 10_000
counts = {name: 0 for name, _ in items}

for _ in range(trials):
    stream = [(name, weight) for name, weight in items]
    random.shuffle(stream)  # Simulate stream order
    sample = weighted_reservoir_sample(iter(stream), k)
    for name, _ in sample:
        counts[name] += 1

print(f"\\n{'Region':<15} {'Weight':>6} {'Expected%':>10} {'Observed%':>10} {'Ratio':>7}")
print("-" * 55)
for name, weight in sorted(items, key=lambda x: -x[1]):
    expected_pct = weight / total_weight * 100 * k  # expected % considering K samples
    observed_pct = counts[name] / trials * 100
    ratio = observed_pct / expected_pct if expected_pct > 0 else 0
    print(f"  {name:<15} {weight:5d} {expected_pct:9.1f}% {observed_pct:9.1f}% {ratio:6.2f}x")

print(f"\\nRatio close to 1.0 = sampling matches weight distribution")

# --- Compare uniform vs weighted ---
print(f"\\n=== Uniform vs Weighted Comparison ===")

# Simulate a dataset with very skewed weights
skewed_items = [(f"item_{i}", (i + 1) ** 2) for i in range(20)]
# Heavy items: item_19 (400), item_18 (361), ...
# Light items: item_0 (1), item_1 (4), ...

k = 5
trials = 5000

# Uniform sampling
uniform_counts = [0] * 20
for _ in range(trials):
    sample = random.sample(range(20), k)
    for idx in sample:
        uniform_counts[idx] += 1

# Weighted sampling
weighted_counts = [0] * 20
for _ in range(trials):
    stream = [(i, w) for i, (_, w) in enumerate(skewed_items)]
    random.shuffle(stream)
    sample = weighted_reservoir_sample(iter(stream), k)
    for idx, _ in sample:
        weighted_counts[idx] += 1

print(f"Sampling K={k} from 20 items with weights = (index+1)^2")
print(f"\\n{'Item':<10} {'Weight':>6} {'Uniform%':>9} {'Weighted%':>10}")
print("-" * 40)
for i in [0, 1, 4, 9, 14, 19]:
    name, weight = skewed_items[i]
    u_pct = uniform_counts[i] / trials * 100
    w_pct = weighted_counts[i] / trials * 100
    print(f"  {name:<10} {weight:5d} {u_pct:8.1f}% {w_pct:9.1f}%")

print(f"\\nWeighted sampling heavily favors high-weight items,")
print(f"while uniform sampling treats all items equally.")

# --- Real-world use case: A/B test sampling ---
print(f"\\n=== Real-World: A/B Test Session Sampling ===")
print(f"Sampling K=1000 sessions from a stream, weighted by session duration")
print(f"(longer sessions = more engagement data = more valuable)")

n_sessions = 50_000
durations = [max(1, int(random.lognormvariate(3, 1.5))) for _ in range(n_sessions)]
stream = list(enumerate(durations))

sample = weighted_reservoir_sample(iter(stream), 1000)
sampled_durations = [d for _, d in sorted(sample)]
all_durations = sorted(durations)

def percentile(data, pct):
    idx = int(len(data) * pct / 100)
    return data[min(idx, len(data) - 1)]

print(f"\\n{'Metric':<25} {'All sessions':>15} {'Weighted sample':>15}")
print("-" * 60)
for label, pct in [("Median duration", 50), ("75th percentile", 75), ("90th percentile", 90), ("95th percentile", 95)]:
    all_val = percentile(all_durations, pct)
    sample_val = percentile(sampled_durations, pct)
    print(f"  {label:<25} {all_val:>14}s {sample_val:>14}s")

print(f"\\nWeighted sample over-represents longer sessions,")
print(f"giving more statistical power for analyzing engaged users.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function ReservoirSamplingLesson() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16 text-gray-200">
      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-400 leading-relaxed max-w-3xl">
          You have a stream of data — server logs, user clicks, sensor readings — and you need a
          perfectly uniform random sample of exactly K items. The catch: you do not know how long the
          stream is (it might be infinite), and you cannot store the whole thing. Reservoir sampling
          solves this in O(K) memory with a single pass, guaranteeing every item has equal probability
          of being selected.
        </p>
      </header>

      {/* Section: The Problem */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Sampling Without Knowing N</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-3">
          <p>
            <strong>Naive approach:</strong> Store the entire stream, then randomly pick K items. But what
            if the stream has billions of items? Or is infinite (a live sensor feed)? You cannot store it
            all, and you do not know N in advance to compute random indices.
          </p>
          <p>
            <strong>Algorithm R (Vitter, 1985):</strong> Keep the first K items. For every subsequent
            item i (where i &gt; K), keep it with probability K/i, replacing a randomly chosen item in
            the reservoir. That is it. After processing N items, every item has exactly K/N probability
            of being in the sample. The proof is a beautiful induction argument.
          </p>
          <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700 font-mono text-sm">
            <div className="text-emerald-400 mb-2"># Algorithm R pseudocode</div>
            <div>reservoir = first K items from stream</div>
            <div>for i = K+1, K+2, K+3, ...:</div>
            <div className="ml-4">j = random integer in [1, i]</div>
            <div className="ml-4">if j &lt;= K:</div>
            <div className="ml-8">reservoir[j] = stream[i]</div>
          </div>
        </div>
      </section>

      {/* Section: Interactive Reservoir Sampling */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Watch Algorithm R in Action</h2>
        <p className="text-gray-400">
          Colored items flow in from the stream. The first K items fill the reservoir. For each
          subsequent item, a coin is flipped with probability K/i. If kept, it randomly replaces one
          reservoir slot. Watch the acceptance probability shrink as more items arrive.
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <ReservoirSketch />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400 space-y-2">
          <p><strong>Key observation:</strong> Early items have high acceptance probability (K/i is large
            when i is small), but they can be replaced later. Late items have low acceptance probability
            but if they get in, they are unlikely to be replaced. These two effects perfectly cancel out,
            giving every item exactly K/N probability.</p>
          <p><strong>Why K/i specifically?</strong> Consider item i. It enters with probability K/i. It
            survives item i+1 with probability 1 - (K/(i+1)) * (1/K) = i/(i+1). Multiplying across all
            future items: K/i * i/(i+1) * (i+1)/(i+2) * ... * (N-1)/N = K/N. The telescoping product
            is the mathematical magic.</p>
        </div>
      </section>

      {/* Section: Probability Convergence */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Visualize: Probability Convergence</h2>
        <p className="text-gray-400">
          Run the stream for thousands of items and observe how the empirical selection frequency
          of each item converges to the theoretical K/N. Each bar represents how often a particular
          item was found in the reservoir across sampling snapshots.
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <ConvergenceSketch />
        </div>
      </section>

      {/* Section: Real-World Applications */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-sky-400">A/B Testing</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              When running an A/B test, you often need a random sample of user sessions for deep
              analysis (e.g., replaying sessions, computing complex metrics). Reservoir sampling
              lets you maintain a fixed-size sample as users arrive, without knowing how many
              sessions the test will collect. Every session has equal probability of being analyzed.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-emerald-400">Database TABLESAMPLE</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              SQL databases support <code className="text-emerald-300">SELECT * FROM table TABLESAMPLE(10 PERCENT)</code>.
              Under the hood, many implementations use reservoir sampling (or variants) to return an
              approximate random sample without scanning the entire table. PostgreSQL&apos;s BERNOULLI
              sampling mode is essentially streaming reservoir sampling.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-yellow-400">ML Training Data</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              When training on massive datasets, you often subsample. Reservoir sampling ensures the
              subsample is truly random without loading the entire dataset. This is especially useful
              for streaming data sources or when the dataset does not fit in memory. Weighted variants
              allow importance sampling for class-imbalanced datasets.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-purple-400">Network Monitoring</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Network switches process millions of packets per second. Reservoir sampling is used to
              maintain a representative sample of packets for traffic analysis, intrusion detection,
              and billing. Weighted reservoir sampling (by packet size) ensures large flows are
              proportionally represented in the sample.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Weighted Reservoir Sampling */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Weighted Reservoir Sampling</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-3">
          <p>
            Standard Algorithm R gives each item equal probability. But what if items have weights?
            The <strong>Efraimidis-Spirakis algorithm (2006)</strong> handles this elegantly:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>For each item with weight w, compute a key: <code>key = random()^(1/w)</code></li>
            <li>Maintain the K items with the largest keys</li>
            <li>Each item&apos;s inclusion probability is proportional to its weight</li>
          </ol>
          <p>
            The key insight: <code>u^(1/w)</code> where u is uniform gives higher keys to items with
            larger weights, making them more likely to be in the top-K. This is used in importance
            sampling for ML, biased sampling for analytics, and network traffic monitoring.
          </p>
        </div>
      </section>

      {/* Section: Python Implementation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implement: Algorithm R with Uniformity Proof</h2>
        <p className="text-gray-400">
          Implement Algorithm R, stream 100K items, and statistically verify that every item has
          equal probability of being in the sample. Includes a step-by-step proof walkthrough.
        </p>
        <PythonCell defaultCode={algorithmRImplementation} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implement: Weighted Reservoir Sampling</h2>
        <p className="text-gray-400">
          Implement the Efraimidis-Spirakis weighted sampling algorithm. Compare uniform versus
          weighted sampling distributions and see a real-world A/B test session sampling scenario.
        </p>
        <PythonCell defaultCode={weightedReservoirSampling} />
      </section>

      {/* Section: Complexity Analysis */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-2 text-gray-300">Algorithm</th>
                <th className="px-4 py-2 text-gray-300">Time</th>
                <th className="px-4 py-2 text-gray-300">Space</th>
                <th className="px-4 py-2 text-gray-300">Notes</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Algorithm R (uniform)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(n)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(K)</td>
                <td className="px-4 py-2">Single pass, O(1) per item</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Weighted (Efraimidis-Spirakis)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(n log K)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(K)</td>
                <td className="px-4 py-2">Heap maintains top-K keys</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Algorithm L (optimized)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(K(1+log(n/K)))</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(K)</td>
                <td className="px-4 py-2">Skips items — much faster for large n</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Naive (store all, then sample)</td>
                <td className="px-4 py-2 font-mono text-red-400">O(n)</td>
                <td className="px-4 py-2 font-mono text-red-400">O(n)</td>
                <td className="px-4 py-2">Requires knowing n and storing everything</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          Algorithm L (Vitter, 1985) is an optimized variant that skips over items that will not be
          selected, reducing the number of random number generations from O(n) to O(K(1 + log(n/K))).
          For very large streams, this is a massive speedup.
        </p>
      </section>

      {/* Section: Key Takeaways */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">1.</span>
            <span>Reservoir sampling maintains a uniform random sample of K items from a stream of unknown length, using O(K) memory and a single pass.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">2.</span>
            <span>Algorithm R: keep first K items, then for item i, include with probability K/i replacing a random reservoir slot. Every item ends up with exactly K/N probability.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">3.</span>
            <span>The uniformity guarantee comes from a telescoping product: early items have high acceptance but high replacement risk; late items have low acceptance but low replacement risk.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">4.</span>
            <span>Weighted variants (Efraimidis-Spirakis) use the key formula u^(1/w) to bias sampling toward high-weight items while maintaining streaming single-pass properties.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">5.</span>
            <span>Used everywhere: A/B testing, database TABLESAMPLE, ML training data subsampling, network packet sampling, and any scenario where you need representative samples from unbounded data.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
