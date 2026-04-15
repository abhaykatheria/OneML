import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/count-min-sketch',
  title: 'Count-Min Sketch: Frequency Estimation',
  description:
    'Estimate item frequencies in massive data streams using a compact 2D counter array — may overcount, but never undercounts',
  track: 'datastructures',
  order: 7,
  tags: ['count-min-sketch', 'probabilistic', 'streaming', 'frequency', 'hashing', 'heavy-hitters'],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const ACCENT: [number, number, number] = [99, 102, 241]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]

const RED: [number, number, number] = [239, 68, 68]
const TEXT_C: [number, number, number] = [148, 163, 184]
const CYAN: [number, number, number] = [34, 211, 238]

/* ------------------------------------------------------------------ */
/* Helpers — hashing                                                   */
/* ------------------------------------------------------------------ */

function hashStr(s: string, seed: number): number {
  let h = seed
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
    h = (h * 2654435761) | 0
  }
  return Math.abs(h)
}

function cmsHash(item: string, row: number, width: number): number {
  return hashStr(item, row * 7919 + 31) % width
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive CMS Grid Visualization                      */
/* ------------------------------------------------------------------ */

interface InsertAnim {
  item: string
  positions: number[]
  timer: number
}

interface QueryAnim {
  item: string
  positions: number[]
  values: number[]
  minVal: number
  timer: number
}

function CMSGridSketch() {
  const WIDTH = 12
  const DEPTH = 4

  const [inputValue, setInputValue] = useState('')
  const [queryResult, setQueryResult] = useState('')

  const countersRef = useRef<number[][]>(
    Array.from({ length: DEPTH }, () => new Array(WIDTH).fill(0))
  )
  const exactRef = useRef<Map<string, number>>(new Map())
  const insertAnimRef = useRef<InsertAnim | null>(null)
  const queryAnimRef = useRef<QueryAnim | null>(null)
  const insertedCountRef = useRef(0)

  const handleInsert = useCallback(() => {
    if (!inputValue.trim()) return
    const item = inputValue.trim()
    const positions: number[] = []
    for (let r = 0; r < DEPTH; r++) {
      const col = cmsHash(item, r, WIDTH)
      countersRef.current[r][col]++
      positions.push(col)
    }
    exactRef.current.set(item, (exactRef.current.get(item) ?? 0) + 1)
    insertedCountRef.current++
    insertAnimRef.current = { item, positions, timer: 90 }
    queryAnimRef.current = null
    setQueryResult('')
    setInputValue('')
  }, [inputValue])

  const handleQuery = useCallback(() => {
    if (!inputValue.trim()) return
    const item = inputValue.trim()
    const positions: number[] = []
    const values: number[] = []
    for (let r = 0; r < DEPTH; r++) {
      const col = cmsHash(item, r, WIDTH)
      positions.push(col)
      values.push(countersRef.current[r][col])
    }
    const minVal = Math.min(...values)
    const exact = exactRef.current.get(item) ?? 0
    const overcount = minVal - exact
    queryAnimRef.current = { item, positions, values, minVal, timer: 120 }
    insertAnimRef.current = null
    setQueryResult(
      `"${item}" estimated count: ${minVal} (exact: ${exact}${overcount > 0 ? `, overcount: +${overcount}` : ''})`
    )
  }, [inputValue])

  const handleReset = useCallback(() => {
    countersRef.current = Array.from({ length: DEPTH }, () => new Array(WIDTH).fill(0))
    exactRef.current.clear()
    insertedCountRef.current = 0
    insertAnimRef.current = null
    queryAnimRef.current = null
    setQueryResult('')
    setInputValue('')
  }, [])

  const handleBulkInsert = useCallback(() => {
    const items = ['#trending', '#news', '#tech', '#sports', '#music', '#food', '#travel', '#memes']
    for (let i = 0; i < 50; i++) {
      const idx = Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? 1 : Math.floor(Math.random() * items.length)
      const item = items[idx]
      for (let r = 0; r < DEPTH; r++) {
        const col = cmsHash(item, r, WIDTH)
        countersRef.current[r][col]++
      }
      exactRef.current.set(item, (exactRef.current.get(item) ?? 0) + 1)
      insertedCountRef.current++
    }
    insertAnimRef.current = null
    queryAnimRef.current = null
    setQueryResult('Inserted 50 random hashtags (Zipf-like distribution)')
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 460

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(...BG)
      const W = p.width
      const counters = countersRef.current
      const maxVal = Math.max(1, ...counters.flat())

      // Decrement animation timers
      if (insertAnimRef.current) {
        insertAnimRef.current.timer--
        if (insertAnimRef.current.timer <= 0) insertAnimRef.current = null
      }
      if (queryAnimRef.current) {
        queryAnimRef.current.timer--
        if (queryAnimRef.current.timer <= 0) queryAnimRef.current = null
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Count-Min Sketch  |  ${DEPTH} rows x ${WIDTH} columns  |  ${insertedCountRef.current} items inserted`, 16, 12)

      // Draw the 2D grid
      const gridTop = 50
      const cellW = Math.min(50, (W - 100) / WIDTH)
      const cellH = 48
      const gridLeft = (W - cellW * WIDTH) / 2

      const iAnim = insertAnimRef.current
      const qAnim = queryAnimRef.current

      for (let r = 0; r < DEPTH; r++) {
        // Row label
        p.fill(...CYAN)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`h${r}`, gridLeft - 8, gridTop + r * (cellH + 4) + cellH / 2)

        for (let c = 0; c < WIDTH; c++) {
          const x = gridLeft + c * cellW
          const y = gridTop + r * (cellH + 4)
          const val = counters[r][c]
          const intensity = val / maxVal

          // Determine highlight state
          let isInsertHL = false
          let isQueryHL = false
          if (iAnim && iAnim.positions[r] === c) isInsertHL = true
          if (qAnim && qAnim.positions[r] === c) isQueryHL = true

          // Cell background
          if (isInsertHL) {
            const flash = Math.sin(iAnim!.timer * 0.15) * 0.3 + 0.7
            p.fill(GREEN[0] * flash, GREEN[1] * flash, GREEN[2] * flash, 220)
          } else if (isQueryHL) {
            const isMin = qAnim!.values[r] === qAnim!.minVal
            if (isMin) {
              p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 200)
            } else {
              p.fill(ACCENT[0], ACCENT[1], ACCENT[2], 160)
            }
          } else if (val > 0) {
            p.fill(
              GRID_C[0] + (ACCENT[0] - GRID_C[0]) * intensity,
              GRID_C[1] + (ACCENT[1] - GRID_C[1]) * intensity,
              GRID_C[2] + (ACCENT[2] - GRID_C[2]) * intensity,
              140 + intensity * 80
            )
          } else {
            p.fill(...GRID_C)
          }

          p.stroke(51, 65, 85)
          p.strokeWeight(1)
          p.rect(x, y, cellW - 2, cellH - 2, 4)

          // Counter value
          p.fill(val > 0 ? 255 : 80)
          p.noStroke()
          p.textSize(val > 99 ? 10 : 13)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${val}`, x + (cellW - 2) / 2, y + (cellH - 2) / 2)

          // Column index
          if (r === 0) {
            p.fill(100, 116, 139)
            p.textSize(8)
            p.textAlign(p.CENTER, p.BOTTOM)
            p.text(`${c}`, x + (cellW - 2) / 2, y - 2)
          }
        }
      }

      // Draw insert animation arrow trail
      if (iAnim) {
        p.fill(...GREEN)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Inserting "${iAnim.item}" → hash positions: [${iAnim.positions.join(', ')}]`, 16, gridTop + DEPTH * (cellH + 4) + 10)
      }

      // Draw query animation
      if (qAnim) {
        p.fill(...YELLOW)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        const y0 = gridTop + DEPTH * (cellH + 4) + 10
        p.text(`Querying "${qAnim.item}" → values: [${qAnim.values.join(', ')}]`, 16, y0)
        p.text(`Estimated count = min(${qAnim.values.join(', ')}) = ${qAnim.minVal}`, 16, y0 + 18)
      }

      // How it works diagram at bottom
      const diagramY = gridTop + DEPTH * (cellH + 4) + 55
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('How it works:', 16, diagramY)

      p.fill(...TEXT_C)
      p.textSize(10)
      p.text('INSERT(x): for each row r, compute col = h_r(x), increment counters[r][col]', 16, diagramY + 20)
      p.text('QUERY(x):  for each row r, compute col = h_r(x), return min(counters[r][col])', 16, diagramY + 36)
      p.text('Key property: query(x) >= true_count(x), always. Never undercounts.', 16, diagramY + 56)

      // Visual legend
      const legendY = diagramY + 80
      p.fill(...GREEN)
      p.rect(16, legendY, 12, 12, 2)
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Insert highlight', 34, legendY + 6)

      p.fill(...YELLOW)
      p.rect(140, legendY, 12, 12, 2)
      p.fill(...TEXT_C)
      p.text('Min value (query result)', 158, legendY + 6)

      p.fill(...ACCENT)
      p.rect(320, legendY, 12, 12, 2)
      p.fill(...TEXT_C)
      p.text('Non-min query position', 338, legendY + 6)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={460}
        controls={
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert() }}
              placeholder="Enter item (e.g. #trending)"
              className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm w-48"
            />
            <button onClick={handleInsert} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
              Insert
            </button>
            <button onClick={handleQuery} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
              Query
            </button>
            <button onClick={handleBulkInsert} className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">
              +50 Random
            </button>
            <button onClick={handleReset} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">
              Reset
            </button>
          </div>
        }
      />
      {queryResult && (
        <p className={`mt-2 text-sm font-mono ${queryResult.includes('overcount') ? 'text-yellow-400' : 'text-emerald-400'}`}>
          {queryResult}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Overestimation Demonstration                            */
/* ------------------------------------------------------------------ */

function OverestimationSketch() {
  const [itemCount, setItemCount] = useState(200)
  const [running, setRunning] = useState(false)
  const [width, setWidth] = useState(50)
  const [depth, setDepth] = useState(4)

  const runningRef = useRef(running)
  runningRef.current = running
  const widthRef = useRef(width)
  widthRef.current = width
  const depthRef = useRef(depth)
  depthRef.current = depth

  const countersRef = useRef<number[][]>([])
  const exactCountsRef = useRef<Map<string, number>>(new Map())
  const streamCountRef = useRef(0)
  const itemCountRef = useRef(itemCount)
  itemCountRef.current = itemCount
  const errorsRef = useRef<{ item: string; exact: number; estimated: number }[]>([])
  const resetFlagRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const canvasH = 480

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
      countersRef.current = Array.from({ length: depthRef.current }, () => new Array(widthRef.current).fill(0))
    }

    p.draw = () => {
      if (resetFlagRef.current) {
        countersRef.current = Array.from({ length: depthRef.current }, () => new Array(widthRef.current).fill(0))
        exactCountsRef.current.clear()
        streamCountRef.current = 0
        errorsRef.current = []
        resetFlagRef.current = false
      }

      p.background(...BG)
      const W = p.width

      // Stream items with Zipf-like distribution
      if (runningRef.current && streamCountRef.current < itemCountRef.current) {
        for (let batch = 0; batch < 3 && streamCountRef.current < itemCountRef.current; batch++) {
          // Zipf: item_0 appears ~50% of the time, item_1 ~25%, etc.
          const rank = Math.floor(Math.pow(Math.random(), 2) * 30)
          const item = `item_${rank}`
          const d = countersRef.current.length
          const w = countersRef.current[0]?.length ?? 50
          for (let r = 0; r < d; r++) {
            const col = hashStr(item, r * 7919 + 31) % w
            countersRef.current[r][col]++
          }
          exactCountsRef.current.set(item, (exactCountsRef.current.get(item) ?? 0) + 1)
          streamCountRef.current++
        }

        // Compute errors for top items
        const d = countersRef.current.length
        const w = countersRef.current[0]?.length ?? 50
        const errors: { item: string; exact: number; estimated: number }[] = []
        for (const [item, exact] of exactCountsRef.current.entries()) {
          let minVal = Infinity
          for (let r = 0; r < d; r++) {
            const col = hashStr(item, r * 7919 + 31) % w
            minVal = Math.min(minVal, countersRef.current[r][col])
          }
          errors.push({ item, exact, estimated: minVal })
        }
        errors.sort((a, b) => b.exact - a.exact)
        errorsRef.current = errors.slice(0, 15)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Overestimation Demo  |  Streamed: ${streamCountRef.current}/${itemCountRef.current}`, 16, 12)

      // Draw bar chart comparing exact vs estimated
      const errors = errorsRef.current
      if (errors.length === 0) {
        p.fill(...TEXT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Press Start to stream items with Zipf distribution', W / 2, 200)
        return
      }

      const chartLeft = 100
      const chartRight = W - 30
      const chartTop = 45
      const barH = 22
      const gap = 4
      const maxCount = Math.max(1, ...errors.map(e => Math.max(e.exact, e.estimated)))

      for (let i = 0; i < errors.length; i++) {
        const e = errors[i]
        const y = chartTop + i * (barH + gap)
        const barW = chartRight - chartLeft

        // Item label
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(e.item, chartLeft - 6, y + barH / 2)

        // Exact count bar (green)
        const exactW = (e.exact / maxCount) * barW
        p.fill(...GREEN)
        p.noStroke()
        p.rect(chartLeft, y, exactW, barH / 2 - 1, 2)

        // Estimated count bar (yellow/red if overcount)
        const estW = (e.estimated / maxCount) * barW
        const overcount = e.estimated - e.exact
        if (overcount > 0) {
          p.fill(...YELLOW)
        } else {
          p.fill(...CYAN)
        }
        p.rect(chartLeft, y + barH / 2, estW, barH / 2 - 1, 2)

        // Overcount marker
        if (overcount > 0) {
          p.fill(...RED)
          p.textSize(8)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`+${overcount}`, chartLeft + estW + 4, y + barH * 0.75)
        }

        // Count labels
        p.fill(255)
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        if (exactW > 30) {
          p.text(`${e.exact}`, chartLeft + 4, y + barH / 4)
        }
        if (estW > 30) {
          p.text(`${e.estimated}`, chartLeft + 4, y + barH * 0.75)
        }
      }

      // Legend
      const legendY = chartTop + errors.length * (barH + gap) + 10
      p.fill(...GREEN)
      p.rect(chartLeft, legendY, 12, 10, 2)
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Exact count', chartLeft + 16, legendY + 5)

      p.fill(...YELLOW)
      p.rect(chartLeft + 110, legendY, 12, 10, 2)
      p.fill(...TEXT_C)
      p.text('Estimated count (may overcount)', chartLeft + 126, legendY + 5)

      p.fill(...RED)
      p.rect(chartLeft + 360, legendY, 12, 10, 2)
      p.fill(...TEXT_C)
      p.text('+N = overcount amount', chartLeft + 376, legendY + 5)

      // Stats
      const statsY = legendY + 25
      const totalOvercount = errors.reduce((s, e) => s + Math.max(0, e.estimated - e.exact), 0)
      const avgError = errors.length > 0 ? (totalOvercount / errors.length).toFixed(2) : '0'
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Avg overcount: ${avgError}  |  Heavy hitters are accurate, rare items may be inflated`, 16, statsY)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={480}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => { if (!running) resetFlagRef.current = true; setRunning(!running) }}
            className={`px-4 py-1.5 rounded text-white text-sm font-medium ${running ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {running ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={() => { resetFlagRef.current = true; setRunning(false) }}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
          >
            Reset
          </button>
          <label className="flex items-center gap-2">
            Items:
            <input type="range" min={100} max={5000} step={100} value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))} className="w-24" />
            <span className="text-gray-400 w-12">{itemCount}</span>
          </label>
          <label className="flex items-center gap-2">
            Width:
            <input type="range" min={10} max={200} step={10} value={width}
              onChange={(e) => { setWidth(Number(e.target.value)); resetFlagRef.current = true }}
              className="w-24" />
            <span className="text-gray-400 w-10">{width}</span>
          </label>
          <label className="flex items-center gap-2">
            Depth:
            <input type="range" min={2} max={8} step={1} value={depth}
              onChange={(e) => { setDepth(Number(e.target.value)); resetFlagRef.current = true }}
              className="w-16" />
            <span className="text-gray-400 w-6">{depth}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const cmsImplementation = `import hashlib
import math
import random

class CountMinSketch:
    """
    Count-Min Sketch: a probabilistic frequency estimation structure.

    Properties:
    - Query(x) >= true_count(x), ALWAYS (never undercounts)
    - Query(x) <= true_count(x) + epsilon * N  with probability >= 1-delta
    - Space: O((1/epsilon) * ln(1/delta)) counters
    """

    def __init__(self, width: int, depth: int):
        """
        Args:
            width (w): number of columns — controls accuracy (epsilon ~ 2/w)
            depth (d): number of rows/hash functions — controls confidence (delta ~ (1/2)^d)
        """
        self.width = width
        self.depth = depth
        self.counters = [[0] * width for _ in range(depth)]
        self.total = 0

    def _hash(self, item: str, row: int) -> int:
        """Hash item to a column index for a given row."""
        h = hashlib.md5(f"{row}:{item}".encode()).hexdigest()
        return int(h, 16) % self.width

    def insert(self, item: str, count: int = 1):
        """Increment counters for an item."""
        for r in range(self.depth):
            col = self._hash(item, r)
            self.counters[r][col] += count
        self.total += count

    def query(self, item: str) -> int:
        """
        Estimate the frequency of an item.
        Returns the minimum counter across all rows.
        """
        return min(
            self.counters[r][self._hash(item, r)]
            for r in range(self.depth)
        )

    def error_bound(self) -> float:
        """Upper bound on overcount: epsilon * N = (2/w) * total."""
        return (2.0 / self.width) * self.total

    def memory_bytes(self) -> int:
        """Approximate memory usage (4 bytes per counter)."""
        return self.width * self.depth * 4


# === Simulation: Trending Hashtags from Zipf Stream ===
random.seed(42)

# Generate 100K events with Zipf-like distribution
# (models real tweet hashtags: few very popular, long tail of rare ones)
num_unique = 500
num_events = 100_000

# Zipf distribution: frequency ~ 1/rank
weights = [1.0 / (i + 1) for i in range(num_unique)]
total_weight = sum(weights)
probs = [w / total_weight for w in weights]

# Build cumulative distribution for sampling
cum_probs = []
cumsum = 0.0
for pr in probs:
    cumsum += pr
    cum_probs.append(cumsum)

def sample_zipf():
    r = random.random()
    for idx, cp in enumerate(cum_probs):
        if r <= cp:
            return f"hashtag_{idx}"
    return f"hashtag_{num_unique - 1}"

# Generate stream
stream = [sample_zipf() for _ in range(num_events)]

# Exact counts
exact = {}
for item in stream:
    exact[item] = exact.get(item, 0) + 1

# Count-Min Sketch with reasonable parameters
cms = CountMinSketch(width=2000, depth=5)
for item in stream:
    cms.insert(item)

# Compare top-10 estimated vs exact
print("=== Top-10 Hashtags: Exact vs Estimated ===")
print(f"{'Hashtag':<16} {'Exact':>8} {'Estimated':>10} {'Error':>8} {'Relative':>10}")
print("-" * 58)

top_items = sorted(exact.items(), key=lambda x: -x[1])[:10]
for item, exact_count in top_items:
    est = cms.query(item)
    error = est - exact_count
    rel_err = error / exact_count * 100
    print(f"{item:<16} {exact_count:>8} {est:>10} {'+' + str(error):>8} {rel_err:>9.2f}%")

print(f"\\nTotal stream events: {num_events:,}")
print(f"Unique items: {len(exact)}")
print(f"CMS size: {cms.width}x{cms.depth} = {cms.width * cms.depth:,} counters")
print(f"CMS memory: {cms.memory_bytes():,} bytes ({cms.memory_bytes()/1024:.1f} KB)")
print(f"Exact HashMap would use: ~{len(exact) * 80 / 1024:.1f} KB (est. 80 bytes/entry)")
print(f"Error bound (epsilon * N): {cms.error_bound():.1f}")
print()

# Check accuracy across ALL items
total_overcount = 0
max_overcount = 0
overcounted_items = 0
for item, exact_count in exact.items():
    est = cms.query(item)
    overcount = est - exact_count
    total_overcount += overcount
    max_overcount = max(max_overcount, overcount)
    if overcount > 0:
        overcounted_items += 1

print(f"=== Accuracy Summary ===")
print(f"Items with overcount: {overcounted_items}/{len(exact)} ({overcounted_items/len(exact)*100:.1f}%)")
print(f"Average overcount: {total_overcount/len(exact):.2f}")
print(f"Max overcount: {max_overcount}")
print(f"Items with ZERO error: {len(exact) - overcounted_items}")
`

const cmsOptimalParams = `import math

def optimal_cms_params(epsilon: float, delta: float):
    """
    Compute optimal CMS dimensions for target error guarantees.

    Args:
        epsilon: maximum relative error. P(error > epsilon * N) < delta
                 In practice: estimated_count <= true_count + epsilon * N
        delta:   failure probability (how often the guarantee is violated)

    Returns:
        width (w): ceil(e / epsilon) where e = Euler's number
        depth (d): ceil(ln(1 / delta))

    Memory = w * d * sizeof(counter)
    """
    w = math.ceil(math.e / epsilon)
    d = math.ceil(math.log(1 / delta))
    memory = w * d * 4  # 4 bytes per counter
    return w, d, memory


print("=== Optimal CMS Parameters for Various Error/Confidence Targets ===")
print()
print(f"{'Epsilon':>10} {'Delta':>10} {'Width':>8} {'Depth':>7} {'Memory':>12} {'Guarantee'}")
print("-" * 80)

configs = [
    (0.01,  0.01,  "1% error, 99% confidence"),
    (0.01,  0.001, "1% error, 99.9% confidence"),
    (0.001, 0.01,  "0.1% error, 99% confidence"),
    (0.001, 0.001, "0.1% error, 99.9% confidence"),
    (0.1,   0.01,  "10% error, 99% confidence"),
    (0.0001,0.01,  "0.01% error, 99% confidence"),
]

for eps, delta, desc in configs:
    w, d, mem = optimal_cms_params(eps, delta)
    if mem > 1_000_000:
        mem_str = f"{mem/1_000_000:.2f} MB"
    elif mem > 1_000:
        mem_str = f"{mem/1_000:.1f} KB"
    else:
        mem_str = f"{mem} B"
    print(f"{eps:>10.4f} {delta:>10.4f} {w:>8,} {d:>7} {mem_str:>12}   {desc}")

print()
print("=== How CMS Compares to Exact Counting ===")
print()

# For a stream of N items with U unique items:
for N, U in [(1_000_000, 10_000), (100_000_000, 1_000_000), (1_000_000_000, 10_000_000)]:
    eps, delta = 0.001, 0.01
    w, d, cms_mem = optimal_cms_params(eps, delta)

    # Exact counting: HashMap with U entries, ~80 bytes each
    exact_mem = U * 80

    savings = (1 - cms_mem / exact_mem) * 100 if exact_mem > cms_mem else 0
    max_error = eps * N

    print(f"Stream: {N:>14,} events, {U:>12,} unique items")
    print(f"  CMS memory:   {cms_mem/1024:.1f} KB  (eps={eps}, delta={delta})")
    print(f"  Exact memory: {exact_mem/1024:.1f} KB")
    print(f"  Savings: {savings:.1f}%")
    print(f"  Max overcount per item: {max_error:,.0f}  ({eps*100}% of stream)")
    print()

print("Key insight: CMS memory is FIXED regardless of stream size!")
print("It depends only on desired accuracy (epsilon) and confidence (delta).")
print("Exact counting memory grows with the number of unique items.")
print()

# === Practical applications ===
print("=== Real-World Applications ===")
print()
apps = [
    ("Network DDoS detection", "0.001", "0.01",
     "Count packets per source IP. IPs exceeding threshold are suspicious.",
     "Millions of IPs, billions of packets/hour"),
    ("Spotify play counts", "0.01", "0.001",
     "Count plays per song for royalty estimation. Overcounting = paying more.",
     "100M+ songs, billions of plays/day"),
    ("Database query optimizer", "0.01", "0.01",
     "Estimate join selectivity. Overestimate -> suboptimal plan but still correct.",
     "Millions of distinct values per column"),
    ("NLP word frequency", "0.001", "0.01",
     "Count word occurrences in a large corpus for TF-IDF or language models.",
     "Millions of unique tokens, billions of words"),
]

for name, eps, delta, desc, scale in apps:
    w, d, mem = optimal_cms_params(float(eps), float(delta))
    print(f"  {name}")
    print(f"    Scale: {scale}")
    print(f"    eps={eps}, delta={delta} -> {w}x{d} grid, {mem/1024:.1f} KB")
    print(f"    {desc}")
    print()
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function CountMinSketch() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          Count-Min Sketch: Frequency Estimation
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          How many times has each hashtag appeared in a billion tweets? How often is each IP
          address sending packets to your server? When you need frequency counts for millions of
          unique items in a massive data stream, the Count-Min Sketch gives you approximate answers
          using a fraction of the memory that exact counting would require.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Counting at Scale</h2>
        <p className="text-gray-300 leading-relaxed">
          Imagine you are building a trending-topics feature for a social media platform.
          Every second, thousands of posts arrive, each tagged with hashtags. You need to know:
          <strong className="text-white"> "How many times has #WorldCup appeared in the last hour?"</strong>
        </p>
        <p className="text-gray-300 leading-relaxed">
          The naive approach is a hash map: <code className="text-emerald-400">counts[hashtag] += 1</code>.
          But with 50 million unique hashtags, that hash map uses gigabytes of RAM. And in a
          DDoS detection system tracking source IPs, you might see hundreds of millions of unique
          addresses. Exact counting becomes impractical.
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          <li>Trending hashtags: 50M unique tags at ~80 bytes/entry = 4 GB</li>
          <li>DDoS source IPs: 100M unique IPs at ~60 bytes/entry = 6 GB</li>
          <li>Database query frequencies: millions of distinct query fingerprints</li>
          <li>Network flow monitoring: counting bytes per (src, dst, port) tuple</li>
        </ul>
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            The key question: can we estimate frequencies without storing a counter for every
            unique item? The Count-Min Sketch answers yes, with a guaranteed error bound.
          </p>
        </div>
      </section>

      {/* ---- Section: How It Works ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How It Works: A 2D Counter Array</h2>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            A Count-Min Sketch is a 2D array of counters with <strong>d rows</strong> and{' '}
            <strong>w columns</strong>. Each row has its own hash function. To insert an item,
            hash it with each row's hash function to get a column index, and increment that
            counter. To query, take the <strong>minimum</strong> across all d rows.
          </p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm space-y-1">
          <p className="text-gray-400"># Count-Min Sketch operations</p>
          <p className="text-emerald-400">INSERT(item):</p>
          <p className="text-gray-300">&nbsp;&nbsp;for each row r in 0..d-1:</p>
          <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;col = hash_r(item) % w</p>
          <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;counters[r][col] += 1</p>
          <p className="text-gray-300">&nbsp;</p>
          <p className="text-cyan-400">QUERY(item):</p>
          <p className="text-gray-300">&nbsp;&nbsp;return min(counters[r][hash_r(item) % w] for r in 0..d-1)</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Try inserting items and querying them in the interactive visualization below.
          Watch how each row's hash function maps the item to a different column, and how the
          query returns the minimum counter value across all rows.
        </p>
        <CMSGridSketch />
        <p className="text-gray-400 text-sm">
          Try: insert "#trending" five times, then insert "#news" twice. Query both to see exact
          counts. Then click "+50 Random" and query again — some items may show overcounts due
          to hash collisions.
        </p>
      </section>

      {/* ---- Section: Overestimation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Overestimation: Never Undercounts</h2>
        <p className="text-gray-300 leading-relaxed">
          The Count-Min Sketch has an important asymmetric error property: it can{' '}
          <strong className="text-yellow-400">overcount</strong> (due to hash collisions adding
          to the same counter) but it can <strong className="text-emerald-400">never undercount</strong>.
          Every time an item is inserted, its counters are incremented. The minimum across rows
          is always at least the true count.
        </p>
        <p className="text-gray-300 leading-relaxed">
          In practice, heavy hitters (frequently occurring items) are estimated very accurately
          because their true count dominates any collision noise. Rare items may see significant
          relative overcounting because even a small collision adds a large percentage error.
        </p>
        <OverestimationSketch />
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Error Guarantee</h3>
          <p className="text-gray-300 text-sm">
            For a CMS with width <strong className="text-white">w</strong> and depth{' '}
            <strong className="text-white">d</strong>, after inserting{' '}
            <strong className="text-white">N</strong> total items:
          </p>
          <div className="font-mono text-sm text-emerald-400 text-center py-2">
            true_count(x) &lt;= query(x) &lt;= true_count(x) + (2/w) * N
          </div>
          <p className="text-gray-300 text-sm">
            with probability at least 1 - (1/2)<sup>d</sup>. More rows (d) increase confidence.
            More columns (w) decrease the error bound.
          </p>
        </div>
      </section>

      {/* ---- Section: Applications ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Network Traffic Analysis</h3>
            <p className="text-gray-300 text-sm">
              ISPs and firewalls use Count-Min Sketches to detect DDoS attacks. By counting
              packets per source IP, any IP exceeding a threshold triggers an alert. The CMS
              handles millions of IPs with kilobytes of memory, running at line speed.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">NLP Word Frequency</h3>
            <p className="text-gray-300 text-sm">
              When processing terabytes of text for language models, exact word counts require
              storing millions of unique tokens. A CMS provides approximate TF-IDF scores with
              bounded error, useful for feature selection and vocabulary pruning.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Database Query Optimization</h3>
            <p className="text-gray-300 text-sm">
              PostgreSQL and other databases use frequency sketches to estimate join selectivity
              and plan optimal query execution. An overestimate leads to a slightly suboptimal
              plan but still produces correct results.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Streaming Analytics</h3>
            <p className="text-gray-300 text-sm">
              Spotify estimates play counts for royalty calculations. Ad platforms count
              impression frequencies. In each case, the CMS provides good-enough accuracy with
              fixed memory, regardless of how large the stream grows.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: Full Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python Implementation: Zipf Stream</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete Count-Min Sketch implementation tested on 100K events drawn from a Zipf
          distribution (which models real-world frequency data like word counts and hashtag
          popularity). Compare estimated versus exact counts for the top-10 items.
        </p>
        <PythonCell defaultCode={cmsImplementation} />
      </section>

      {/* ---- Python: Optimal Parameters ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Optimal Width and Depth</h2>
        <p className="text-gray-300 leading-relaxed">
          The CMS has two knobs: <strong className="text-white">width (w)</strong> controls accuracy
          (epsilon = e/w) and <strong className="text-white">depth (d)</strong> controls confidence
          (delta = (1/2)<sup>d</sup>). This calculator shows how to size a CMS for your target
          error rate.
        </p>
        <PythonCell defaultCode={cmsOptimalParams} />
      </section>

      {/* ---- Section: Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Property</th>
                <th className="text-left py-2 pr-4 text-white">Count-Min Sketch</th>
                <th className="text-left py-2 text-white">Hash Map (Exact)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4 text-emerald-400">O(d) = O(1)</td>
                <td className="py-2">O(1) amortized</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Query</td>
                <td className="py-2 pr-4 text-emerald-400">O(d) = O(1)</td>
                <td className="py-2">O(1)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space</td>
                <td className="py-2 pr-4 text-emerald-400">O(w * d) = fixed</td>
                <td className="py-2">O(n) where n = unique items</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Accuracy</td>
                <td className="py-2 pr-4 text-yellow-400">Approximate (overcounts)</td>
                <td className="py-2 text-emerald-400">Exact</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Deletion</td>
                <td className="py-2 pr-4 text-yellow-400">Possible (decrement), but risky</td>
                <td className="py-2 text-emerald-400">Yes</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Merge</td>
                <td className="py-2 pr-4 text-emerald-400">Pointwise addition</td>
                <td className="py-2">Union of entries</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Count-Min Sketch uses a 2D counter array with d independent hash functions</li>
          <li>Insert: hash to d positions and increment. Query: return the minimum</li>
          <li>Never undercounts. Overcounting is bounded by (2/w) * N with probability 1 - (1/2)<sup>d</sup></li>
          <li>Memory is fixed: depends on target accuracy, not on stream size or unique item count</li>
          <li>Heavy hitters are estimated very accurately; rare items may have higher relative error</li>
          <li>Used in network monitoring, NLP, database optimization, and streaming analytics</li>
          <li>Two CMS can be merged by pointwise addition of their counter arrays</li>
        </ul>
      </section>
    </div>
  )
}
