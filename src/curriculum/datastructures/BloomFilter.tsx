import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/bloom-filter',
  title: 'Bloom Filters: Probabilistic Set Membership',
  description:
    'Test set membership in constant time with massive space savings — at the cost of occasional false positives, but never false negatives',
  track: 'datastructures',
  order: 2,
  tags: ['bloom-filter', 'probabilistic', 'hashing', 'set-membership', 'false-positive'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Simple string hash — produces a deterministic integer from a string + seed */
function hashStr(s: string, seed: number): number {
  let h = seed
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
    h = (h * 2654435761) | 0
  }
  return Math.abs(h)
}

/** Generate K hash positions for a string in a bit array of size m */
function getPositions(s: string, k: number, m: number): number[] {
  const positions: number[] = []
  for (let i = 0; i < k; i++) {
    positions.push(hashStr(s, i * 7919 + 31) % m)
  }
  return positions
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Bloom Filter Visualization                  */
/* ------------------------------------------------------------------ */

function BloomFilterSketch() {
  const [inputValue, setInputValue] = useState('')
  const [_insertedItems, setInsertedItems] = useState<string[]>([])
  const [queryResult, setQueryResult] = useState<string>('')
  const [k, setK] = useState(3)
  const [m, setM] = useState(32)

  const insertedRef = useRef<Set<string>>(new Set())
  const bitsRef = useRef<number[]>(new Array(32).fill(0))
  const highlightRef = useRef<{ positions: number[]; type: 'insert' | 'query-hit' | 'query-miss'; timer: number } | null>(null)
  const kRef = useRef(k)
  kRef.current = k
  const mRef = useRef(m)
  mRef.current = m

  const handleInsert = useCallback(() => {
    if (!inputValue.trim()) return
    const val = inputValue.trim()
    const positions = getPositions(val, kRef.current, mRef.current)
    for (const pos of positions) {
      bitsRef.current[pos] = 1
    }
    insertedRef.current.add(val)
    setInsertedItems([...insertedRef.current])
    highlightRef.current = { positions, type: 'insert', timer: 60 }
    setInputValue('')
    setQueryResult('')
  }, [inputValue])

  const handleQuery = useCallback(() => {
    if (!inputValue.trim()) return
    const val = inputValue.trim()
    const positions = getPositions(val, kRef.current, mRef.current)
    const allSet = positions.every(pos => bitsRef.current[pos] === 1)
    const actuallyIn = insertedRef.current.has(val)

    if (allSet) {
      if (actuallyIn) {
        setQueryResult(`"${val}" -> PROBABLY IN SET (true positive)`)
        highlightRef.current = { positions, type: 'query-hit', timer: 60 }
      } else {
        setQueryResult(`"${val}" -> PROBABLY IN SET (FALSE POSITIVE! not actually inserted)`)
        highlightRef.current = { positions, type: 'query-hit', timer: 60 }
      }
    } else {
      setQueryResult(`"${val}" -> DEFINITELY NOT IN SET (bits at positions [${positions.filter(p => !bitsRef.current[p]).join(', ')}] are 0)`)
      highlightRef.current = { positions, type: 'query-miss', timer: 60 }
    }
  }, [inputValue])

  const handleReset = useCallback(() => {
    bitsRef.current = new Array(mRef.current).fill(0)
    insertedRef.current.clear()
    setInsertedItems([])
    setQueryResult('')
    highlightRef.current = null
    setInputValue('')
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 380

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const bits = bitsRef.current
      const curM = mRef.current
      const curK = kRef.current

      // Resize bits array if m changed
      if (bits.length !== curM) {
        const newBits = new Array(curM).fill(0)
        bitsRef.current = newBits
        insertedRef.current.clear()
        return
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      const filled = bits.filter(b => b === 1).length
      const fillRatio = (filled / curM * 100).toFixed(1)
      p.text(`Bloom Filter  |  m=${curM} bits  |  k=${curK} hash functions  |  ${filled}/${curM} bits set (${fillRatio}%)`, 16, 12)

      // Draw bit array
      const bitAreaTop = 50
      const cols = Math.min(curM, Math.floor((W - 40) / 32))
      const rows = Math.ceil(curM / cols)
      const cellSize = Math.min(28, Math.floor((W - 60) / cols))
      const startX = (W - cols * cellSize) / 2

      const hl = highlightRef.current
      const hlPositions = hl ? new Set(hl.positions) : new Set<number>()

      if (hl) {
        hl.timer--
        if (hl.timer <= 0) highlightRef.current = null
      }

      for (let i = 0; i < curM; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = startX + col * cellSize
        const y = bitAreaTop + row * cellSize

        const isHighlighted = hlPositions.has(i)
        const isSet = bits[i] === 1

        // Background
        if (isHighlighted && hl) {
          if (hl.type === 'insert') {
            p.fill(52, 211, 153, 200) // emerald for insert
          } else if (hl.type === 'query-hit') {
            p.fill(250, 204, 21, 200) // yellow for query hit
          } else {
            if (isSet) {
              p.fill(99, 102, 241, 200) // indigo if bit is set
            } else {
              p.fill(239, 68, 68, 200) // red for miss position
            }
          }
        } else if (isSet) {
          p.fill(99, 102, 241, 160) // indigo for set bits
        } else {
          p.fill(30, 41, 59) // dark for unset bits
        }

        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.rect(x, y, cellSize - 2, cellSize - 2, 3)

        // Bit value
        p.fill(isSet ? 255 : 100)
        p.noStroke()
        p.textSize(cellSize > 20 ? 11 : 8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(isSet ? '1' : '0', x + (cellSize - 2) / 2, y + (cellSize - 2) / 2)

        // Index below
        if (cellSize > 18) {
          p.fill(100, 116, 139)
          p.textSize(7)
          p.text(`${i}`, x + (cellSize - 2) / 2, y + cellSize + 4)
        }
      }

      // Hash function visualization
      const hashAreaTop = bitAreaTop + rows * (cellSize + (cellSize > 18 ? 12 : 4)) + 20
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)

      if (hl && hl.timer > 0) {
        p.text(`Hash positions: [${hl.positions.join(', ')}]`, 16, hashAreaTop)
        // Draw arrows from hash label to positions
        p.stroke(hl.type === 'insert' ? p.color(52, 211, 153) : hl.type === 'query-hit' ? p.color(250, 204, 21) : p.color(239, 68, 68))
        p.strokeWeight(1)
        for (const pos of hl.positions) {
          const col = pos % cols
          const row = Math.floor(pos / cols)
          const bx = startX + col * cellSize + (cellSize - 2) / 2
          const by = bitAreaTop + row * cellSize
          // Small indicator dot above the bit
          p.noStroke()
          if (hl.type === 'insert') {
            p.fill(52, 211, 153)
          } else if (hl.type === 'query-hit') {
            p.fill(250, 204, 21)
          } else {
            p.fill(239, 68, 68)
          }
          p.ellipse(bx, by - 4, 6, 6)
        }
      }

      // Inserted items list
      const listTop = hashAreaTop + 30
      p.fill(100, 116, 139)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      const items = [...insertedRef.current]
      if (items.length > 0) {
        p.text(`Inserted (${items.length}): ${items.slice(-12).join(', ')}${items.length > 12 ? '...' : ''}`, 16, listTop)
      }

      // False positive rate formula
      const fpRate = Math.pow(1 - Math.exp(-curK * items.length / curM), curK)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.text(`Theoretical FP rate: (1 - e^(-kn/m))^k = ${(fpRate * 100).toFixed(2)}%`, 16, listTop + 16)

      // Legend
      const legY = listTop + 40
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)

      p.fill(30, 41, 59)
      p.rect(16, legY, 12, 12, 2)
      p.fill(148, 163, 184)
      p.text('0 — unset', 34, legY + 6)

      p.fill(99, 102, 241, 160)
      p.rect(100, legY, 12, 12, 2)
      p.fill(148, 163, 184)
      p.text('1 — set', 118, legY + 6)

      p.fill(52, 211, 153, 200)
      p.rect(180, legY, 12, 12, 2)
      p.fill(148, 163, 184)
      p.text('insert target', 198, legY + 6)

      p.fill(250, 204, 21, 200)
      p.rect(290, legY, 12, 12, 2)
      p.fill(148, 163, 184)
      p.text('query hit', 308, legY + 6)

      p.fill(239, 68, 68, 200)
      p.rect(380, legY, 12, 12, 2)
      p.fill(148, 163, 184)
      p.text('query miss (guarantees NOT in set)', 398, legY + 6)
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={380} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleInsert()
          }}
          placeholder='Type a value (e.g. "alice")'
          className="px-3 py-1.5 rounded bg-gray-800 border border-gray-600 text-gray-200 text-sm w-48 outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleInsert}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          Insert
        </button>
        <button
          onClick={handleQuery}
          className="px-3 py-1.5 rounded bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-500 transition-colors"
        >
          Query
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <label className="flex items-center gap-2 text-gray-400">
          k:
          <input
            type="range" min={1} max={7} value={k}
            onChange={(e) => { setK(Number(e.target.value)); handleReset() }}
            className="w-20"
          />
          <span className="w-4">{k}</span>
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          m:
          <select
            value={m}
            onChange={(e) => { setM(Number(e.target.value)); handleReset() }}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
          >
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
            <option value={128}>128</option>
          </select>
        </label>
      </div>
      {queryResult && (
        <div className={`text-sm font-mono px-3 py-2 rounded ${queryResult.includes('FALSE POSITIVE') ? 'bg-red-900/40 text-red-300 border border-red-700' : queryResult.includes('DEFINITELY NOT') ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700'}`}>
          {queryResult}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — False Positive Rate Visualization                       */
/* ------------------------------------------------------------------ */

function FalsePositiveRateSketch() {
  const [insertCount, setInsertCount] = useState(0)
  const insertCountRef = useRef(0)
  const [autoInsert, setAutoInsert] = useState(false)
  const autoInsertRef = useRef(false)
  autoInsertRef.current = autoInsert

  const sketch = useCallback((p: p5) => {
    const canvasH = 440
    const m = 200  // bit array size
    const k = 3    // hash functions
    const bits = new Array(m).fill(0)
    let nInserted = 0
    let fpTests = 0
    let fpCount = 0
    const inserted = new Set<string>()
    const fpHistory: { n: number; theoretical: number; measured: number }[] = []
    let testCounter = 0

    function insertItem() {
      const word = `item_${nInserted}_${Math.random().toString(36).slice(2, 6)}`
      const positions = getPositions(word, k, m)
      for (const pos of positions) bits[pos] = 1
      inserted.add(word)
      nInserted++
      insertCountRef.current = nInserted
    }

    function testFPRate() {
      // Test 50 random non-inserted strings
      let falsePos = 0
      let tests = 0
      for (let i = 0; i < 50; i++) {
        const word = `test_${testCounter++}_${Math.random().toString(36).slice(2, 8)}`
        if (inserted.has(word)) continue
        tests++
        const positions = getPositions(word, k, m)
        const allSet = positions.every(pos => bits[pos] === 1)
        if (allSet) falsePos++
      }
      fpTests += tests
      fpCount += falsePos
      return tests > 0 ? falsePos / tests : 0
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

      // Auto insert
      if (autoInsertRef.current && p.frameCount % 3 === 0 && nInserted < m * 2) {
        insertItem()
        const measured = testFPRate()
        const theoretical = Math.pow(1 - Math.exp(-k * nInserted / m), k)
        fpHistory.push({ n: nInserted, theoretical, measured })
        if (p.frameCount % 6 === 0) setInsertCount(nInserted)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`False Positive Rate vs Fill Level  |  m=${m} bits, k=${k} hashes, n=${nInserted} items`, 16, 12)

      // Draw bit array (compact horizontal bar)
      const barTop = 44
      const barH = 16
      const barLeft = 40
      const barRight = W - 40
      const bitW = (barRight - barLeft) / m

      for (let i = 0; i < m; i++) {
        const x = barLeft + i * bitW
        if (bits[i]) { p.fill(99, 102, 241, 200) } else { p.fill(30, 41, 59) }
        p.noStroke()
        p.rect(x, barTop, Math.max(1, bitW - 0.5), barH)
      }

      const filledCount = bits.filter((b: number) => b === 1).length
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Bit array: ${filledCount}/${m} bits set (${(filledCount / m * 100).toFixed(0)}% full)`, barLeft, barTop + barH + 4)

      // FP Rate chart
      const plotLeft = 60
      const plotRight = W - 40
      const plotTop = 100
      const plotBottom = 340
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
        p.text(`${(100 - i * 20)}%`, plotLeft - 6, y)
        p.stroke(51, 65, 85)
      }

      // X-axis labels
      const maxN = m * 2
      for (let n = 0; n <= maxN; n += Math.ceil(maxN / 5)) {
        const x = plotLeft + (n / maxN) * plotW
        p.stroke(51, 65, 85)
        p.line(x, plotTop, x, plotBottom)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${n}`, x, plotBottom + 4)
      }

      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Items inserted (n)', plotLeft + plotW / 2, plotBottom + 18)

      // Draw theoretical curve
      p.noFill()
      p.stroke(250, 204, 21)
      p.strokeWeight(2)
      p.beginShape()
      for (let n = 0; n <= maxN; n += 2) {
        const fp = Math.pow(1 - Math.exp(-k * n / m), k)
        const x = plotLeft + (n / maxN) * plotW
        const y = plotBottom - fp * plotH
        p.vertex(x, y)
      }
      p.endShape()

      // Draw measured points
      p.noStroke()
      for (const pt of fpHistory) {
        const x = plotLeft + (pt.n / maxN) * plotW
        const y = plotBottom - pt.measured * plotH
        p.fill(52, 211, 153, 180)
        p.ellipse(x, y, 5, 5)
      }

      // Current position marker
      if (nInserted > 0) {
        const curFP = Math.pow(1 - Math.exp(-k * nInserted / m), k)
        const cx = plotLeft + (nInserted / maxN) * plotW
        const cy = plotBottom - curFP * plotH
        p.fill(239, 68, 68)
        p.noStroke()
        p.ellipse(cx, cy, 10, 10)
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`FP: ${(curFP * 100).toFixed(1)}%`, cx + 10, cy)
      }

      // Legend
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      const legY = plotBottom + 38

      p.fill(250, 204, 21)
      p.rect(plotLeft, legY - 1, 16, 3)
      p.fill(148, 163, 184)
      p.text('Theoretical: (1 - e^(-kn/m))^k', plotLeft + 22, legY)

      p.fill(52, 211, 153, 180)
      p.ellipse(plotLeft + plotW / 2 + 6, legY, 6, 6)
      p.fill(148, 163, 184)
      p.text('Measured FP rate', plotLeft + plotW / 2 + 16, legY)

      // Annotations
      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      const annotY = legY + 20
      if (nInserted < 10) {
        p.text('Click "Auto-fill" to watch the false positive rate climb as the filter fills up', plotLeft, annotY)
      } else if (filledCount / m < 0.5) {
        p.text(`Filter is ${(filledCount / m * 100).toFixed(0)}% full — FP rate is still low`, plotLeft, annotY)
      } else if (filledCount / m < 0.8) {
        p.text(`Filter is getting full — FP rate is climbing rapidly!`, plotLeft, annotY)
      } else {
        p.text(`Filter is nearly saturated — almost every query returns a false positive!`, plotLeft, annotY)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setAutoInsert(!autoInsert)}
            className={`px-4 py-1.5 rounded text-white text-sm font-medium transition-colors ${autoInsert ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {autoInsert ? 'Pause' : 'Auto-fill'}
          </button>
          <span className="text-gray-500">
            Items: {insertCount} | Watch FP rate increase as filter fills
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Optimal K Calculator Sketch                             */
/* ------------------------------------------------------------------ */

function OptimalKSketch() {
  const [targetM, setTargetM] = useState(1000)
  const targetMRef = useRef(targetM)
  targetMRef.current = targetM

  const [targetN, setTargetN] = useState(100)
  const targetNRef = useRef(targetN)
  targetNRef.current = targetN

  const sketch = useCallback((p: p5) => {
    const canvasH = 320

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const curM = targetMRef.current
      const curN = targetNRef.current

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Optimal Number of Hash Functions  |  m=${curM} bits, n=${curN} items`, 16, 12)

      // Plot FP rate for different k values
      const plotLeft = 60
      const plotRight = W - 40
      const plotTop = 50
      const plotBottom = 240
      const plotW = plotRight - plotLeft
      const plotH = plotBottom - plotTop
      const maxK = 20

      // Grid
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      for (let i = 0; i <= 4; i++) {
        const y = plotTop + (i / 4) * plotH
        p.line(plotLeft, y, plotRight, y)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        const label = (1 - i / 4) * 100
        p.text(`${label.toFixed(0)}%`, plotLeft - 6, y)
        p.stroke(51, 65, 85)
      }

      for (let ki = 0; ki <= maxK; ki += 2) {
        const x = plotLeft + (ki / maxK) * plotW
        p.stroke(51, 65, 85)
        p.line(x, plotTop, x, plotBottom)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${ki}`, x, plotBottom + 4)
      }

      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Number of hash functions (k)', plotLeft + plotW / 2, plotBottom + 18)

      // Plot curve
      let bestK = 1
      let bestFP = 1
      const fpValues: number[] = []

      for (let ki = 1; ki <= maxK; ki++) {
        const fp = Math.pow(1 - Math.exp(-ki * curN / curM), ki)
        fpValues.push(fp)
        if (fp < bestFP) {
          bestFP = fp
          bestK = ki
        }
      }

      // Draw bars for each k
      const barW = plotW / maxK * 0.7
      for (let ki = 1; ki <= maxK; ki++) {
        const fp = fpValues[ki - 1]
        const x = plotLeft + ((ki - 0.5) / maxK) * plotW - barW / 2
        const h = fp * plotH

        if (ki === bestK) {
          p.fill(52, 211, 153, 220)
        } else {
          p.fill(99, 102, 241, 160)
        }
        p.noStroke()
        p.rect(x, plotBottom - h, barW, h, 2, 2, 0, 0)
      }

      // Best k marker
      const bx = plotLeft + ((bestK - 0.5) / maxK) * plotW
      const by = plotBottom - bestFP * plotH
      p.fill(52, 211, 153)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`Optimal k=${bestK}`, bx, by - 8)
      p.text(`FP=${(bestFP * 100).toFixed(2)}%`, bx, by + 0)

      // Optimal k formula
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      const optK = Math.round((curM / curN) * Math.LN2)
      p.text(`Optimal k = (m/n) * ln(2) = (${curM}/${curN}) * 0.693 = ${((curM / curN) * Math.LN2).toFixed(1)} -> ${optK}`, 16, plotBottom + 44)

      p.fill(100, 116, 139)
      p.textSize(10)
      p.text(`Bits per element: ${(curM / curN).toFixed(1)} | Memory: ${(curM / 8).toFixed(0)} bytes for ${curN} items`, 16, plotBottom + 64)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={320}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Bits (m):
            <input
              type="range" min={100} max={10000} step={100} value={targetM}
              onChange={(e) => setTargetM(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-gray-400 w-16">{targetM}</span>
          </label>
          <label className="flex items-center gap-2">
            Items (n):
            <input
              type="range" min={10} max={2000} step={10} value={targetN}
              onChange={(e) => setTargetN(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-gray-400 w-12">{targetN}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const bloomImplementation = `import math
import hashlib

class BloomFilter:
    """
    Bloom Filter: a space-efficient probabilistic data structure for
    testing whether an element is a member of a set.

    Properties:
    - False positives are possible (says "in set" when it's not)
    - False negatives are IMPOSSIBLE (if it says "not in set", it's definitely not)
    - Cannot remove elements (see Counting Bloom Filter for that)
    """

    def __init__(self, m: int, k: int):
        """
        Args:
            m: number of bits in the bit array
            k: number of hash functions
        """
        self.m = m
        self.k = k
        self.bits = [0] * m
        self.n = 0  # number of inserted elements

    def _hashes(self, item: str) -> list:
        """Generate k hash positions for an item."""
        positions = []
        for i in range(self.k):
            # Use SHA-256 with different seeds for each hash function
            h = hashlib.sha256(f"{i}:{item}".encode()).hexdigest()
            pos = int(h, 16) % self.m
            positions.append(pos)
        return positions

    def insert(self, item: str):
        """Insert an item into the Bloom filter."""
        for pos in self._hashes(item):
            self.bits[pos] = 1
        self.n += 1

    def query(self, item: str) -> bool:
        """
        Check if an item MIGHT be in the set.
        Returns:
            True  -> item is PROBABLY in the set (could be false positive)
            False -> item is DEFINITELY NOT in the set
        """
        return all(self.bits[pos] == 1 for pos in self._hashes(item))

    def false_positive_rate(self) -> float:
        """Theoretical false positive probability."""
        return (1 - math.exp(-self.k * self.n / self.m)) ** self.k

    def fill_ratio(self) -> float:
        """Fraction of bits that are set to 1."""
        return sum(self.bits) / self.m

    @staticmethod
    def optimal_k(m: int, n: int) -> int:
        """Compute optimal number of hash functions."""
        return max(1, round((m / n) * math.log(2)))

    @staticmethod
    def optimal_m(n: int, fp_rate: float) -> int:
        """Compute optimal bit array size for desired FP rate."""
        return max(1, round(-n * math.log(fp_rate) / (math.log(2) ** 2)))


# === Demo ===
# Scenario: web crawler checking "have I visited this URL?"

# Design for 10,000 URLs with 1% false positive rate
n = 10_000
target_fp = 0.01
m = BloomFilter.optimal_m(n, target_fp)
k = BloomFilter.optimal_k(m, n)

print(f"Design parameters:")
print(f"  Expected items (n): {n:,}")
print(f"  Target FP rate: {target_fp*100}%")
print(f"  Optimal bits (m): {m:,} ({m/8:,.0f} bytes = {m/8/1024:.1f} KB)")
print(f"  Optimal hash functions (k): {k}")
print(f"  Bits per element: {m/n:.1f}")
print()

bf = BloomFilter(m, k)

# Insert 10,000 URLs
urls = [f"https://example.com/page/{i}" for i in range(n)]
for url in urls:
    bf.insert(url)

print(f"After inserting {bf.n:,} items:")
print(f"  Fill ratio: {bf.fill_ratio()*100:.1f}%")
print(f"  Theoretical FP rate: {bf.false_positive_rate()*100:.2f}%")

# Test with known items (should all return True)
true_positives = sum(bf.query(url) for url in urls[:1000])
print(f"  True positive rate (1000 known items): {true_positives}/1000")

# Test with unknown items (some may be false positives)
false_positives = sum(bf.query(f"https://other.com/page/{i}") for i in range(10000))
print(f"  False positives (10000 unknown items): {false_positives}")
print(f"  Measured FP rate: {false_positives/10000*100:.2f}%")
print()
print(f"Memory comparison:")
print(f"  Bloom filter: {m/8/1024:.1f} KB")
print(f"  HashSet (est): {n * 50 / 1024:.1f} KB  (50 bytes/URL avg)")
print(f"  Savings: {(1 - (m/8)/(n*50))*100:.1f}%")
`

const bloomVsHashset = `import math
import hashlib
import sys

class BloomFilter:
    def __init__(self, m, k):
        self.m = m
        self.k = k
        self.bits = bytearray(m // 8 + 1)  # packed bits for realistic memory
        self.n = 0

    def _hashes(self, item):
        positions = []
        for i in range(self.k):
            h = hashlib.md5(f"{i}:{item}".encode()).hexdigest()
            positions.append(int(h, 16) % self.m)
        return positions

    def insert(self, item):
        for pos in self._hashes(item):
            self.bits[pos // 8] |= (1 << (pos % 8))
        self.n += 1

    def query(self, item):
        return all(
            (self.bits[pos // 8] >> (pos % 8)) & 1
            for pos in self._hashes(item)
        )

# === Compare Bloom Filter vs HashSet at various scales ===
print(f"{'N':>10} | {'Bloom (KB)':>12} | {'HashSet (KB)':>12} | {'Savings':>8} | {'FP Rate':>10}")
print("-" * 65)

for n in [1_000, 10_000, 100_000, 1_000_000]:
    # Design Bloom filter for 1% FP rate
    target_fp = 0.01
    m = max(1, round(-n * math.log(target_fp) / (math.log(2) ** 2)))
    k = max(1, round((m / n) * math.log(2)))

    bloom_bytes = m // 8 + 1
    # HashSet: estimate ~50 bytes per item (hash + pointer + string overhead)
    hashset_bytes = n * 50

    bf = BloomFilter(m, k)

    # Insert items
    for i in range(n):
        bf.insert(f"item_{i}")

    # Measure FP rate on 5000 non-members
    fp = sum(bf.query(f"nonmember_{i}") for i in range(5000))
    fp_rate = fp / 5000

    bloom_kb = bloom_bytes / 1024
    hashset_kb = hashset_bytes / 1024
    savings = (1 - bloom_bytes / hashset_bytes) * 100

    print(f"{n:>10,} | {bloom_kb:>10.1f} KB | {hashset_kb:>10.1f} KB | {savings:>6.1f}% | {fp_rate*100:>8.2f}%")

print()
print("Key insight: Bloom filter memory is PROPORTIONAL to desired accuracy,")
print("not to the size of the strings being stored!")
print()

# === Counting Bloom Filter (supports deletion) ===
print("=== Counting Bloom Filter ===")
print()

class CountingBloomFilter:
    """Instead of bits, use counters. Supports deletion."""
    def __init__(self, m, k):
        self.m = m
        self.k = k
        self.counters = [0] * m
        self.n = 0

    def _hashes(self, item):
        positions = []
        for i in range(self.k):
            h = hashlib.md5(f"{i}:{item}".encode()).hexdigest()
            positions.append(int(h, 16) % self.m)
        return positions

    def insert(self, item):
        for pos in self._hashes(item):
            self.counters[pos] += 1
        self.n += 1

    def delete(self, item):
        """Delete an item (decrement counters). Only safe if item was actually inserted."""
        for pos in self._hashes(item):
            self.counters[pos] = max(0, self.counters[pos] - 1)
        self.n -= 1

    def query(self, item):
        return all(self.counters[pos] > 0 for pos in self._hashes(item))

cbf = CountingBloomFilter(m=10000, k=7)

# Insert and verify
for name in ["alice", "bob", "carol", "dave"]:
    cbf.insert(name)

print(f"After inserting alice, bob, carol, dave:")
for name in ["alice", "bob", "carol", "eve"]:
    result = cbf.query(name)
    print(f"  query('{name}'): {'probably in set' if result else 'definitely not in set'}")

# Delete bob
cbf.delete("bob")
print(f"\\nAfter deleting bob:")
for name in ["alice", "bob", "carol"]:
    result = cbf.query(name)
    print(f"  query('{name}'): {'probably in set' if result else 'definitely not in set'}")

print()
print("Counting Bloom Filter uses 4x more memory (counters vs bits)")
print("but supports deletion — useful for caches and session tracking.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function BloomFilter() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          Bloom Filters: Probabilistic Set Membership
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          Is this username taken? Has this URL been crawled? Is this IP on the blocklist?
          When you need to check membership in a set of billions of items, Bloom filters trade
          a tiny false positive rate for massive space savings.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Set Membership at Scale</h2>
        <p className="text-gray-300 leading-relaxed">
          You are building a web crawler. Before fetching a URL, you need to check:
          <strong className="text-white"> "Have I already visited this URL?"</strong> After crawling
          a billion pages, your visited-URL set uses <strong className="text-white">~50 GB of RAM</strong> (assuming
          50 bytes per URL on average). That is impractical for a single machine.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Similar problems appear everywhere:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          <li>Username availability check during signup (1 billion usernames at ~10 bytes each = 10 GB)</li>
          <li>Malicious URL detection in the browser (Google Safe Browsing checks billions of URLs)</li>
          <li>Cache routing in CDNs — does this edge server have this object cached?</li>
          <li>Database query optimization — PostgreSQL uses Bloom filters to skip unnecessary disk reads</li>
        </ul>
      </section>

      {/* ---- Section: Naive Approach ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Naive Approach: Hash Set</h2>
        <p className="text-gray-300 leading-relaxed">
          A hash set gives O(1) lookup with perfect accuracy. But it stores the actual items.
          Memory grows linearly: 1 million items at 50 bytes each = 50 MB. 1 billion items = 50 GB.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm space-y-1">
          <p className="text-gray-400"># Hash set: O(1) lookup, but O(n) memory</p>
          <p className="text-gray-300">visited = set() &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# stores EVERY url</p>
          <p className="text-gray-300">visited.add(url) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# O(1)</p>
          <p className="text-gray-300">url in visited &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# O(1), but 50 GB at 1B items</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The fundamental issue: hash sets store the data itself. What if we could just store
          a <em>fingerprint</em> — a tiny bit pattern that tells us membership with high
          probability, without storing the actual strings?
        </p>
      </section>

      {/* ---- Section: The Key Insight ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Key Insight: Bit Array + Multiple Hashes</h2>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            A Bloom filter is a bit array of m bits, all initially 0. To insert an item,
            hash it with k different hash functions to get k positions, and set those bits to 1.
            To query, check if ALL k positions are 1. If any is 0, the item is definitely not in
            the set. If all are 1, it is probably in the set (but could be a false positive).
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The brilliant trade-off: a Bloom filter never stores the items themselves. It only
          remembers their hash fingerprints. This means:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          <li><strong className="text-emerald-400">No false negatives</strong> — if an item was inserted, its k bits are definitely set. The query will always return true.</li>
          <li><strong className="text-yellow-400">Possible false positives</strong> — some items hash to positions that happen to all be set by OTHER items. The query returns true even though the item was never inserted.</li>
          <li><strong className="text-white">Massive space savings</strong> — 1 billion items with 1% FP rate requires only ~1.2 GB (about 10 bits per item), vs 50 GB for a hash set.</li>
        </ul>
      </section>

      {/* ---- Section: Interactive Bloom Filter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Bloom Filter</h2>
        <p className="text-gray-300 leading-relaxed">
          Type a value and click "Insert" to add it to the Bloom filter. Then query for
          values to see if they are in the set. Try inserting "alice", "bob", "carol" and then
          querying "dave" — you might get a false positive! Adjust k (hash functions) and m (bit
          array size) to see how they affect behavior.
        </p>
        <BloomFilterSketch />
        <p className="text-gray-400 text-sm">
          Try: insert "alice", "bob", "carol", "dave", "eve" — then query "frank", "grace", "heidi"
          to look for false positives. Reduce m to 16 bits to see more false positives.
        </p>
      </section>

      {/* ---- Section: False Positive Rate ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">False Positive Rate: The Price of Space Efficiency</h2>
        <p className="text-gray-300 leading-relaxed">
          As more items are inserted, more bits get set to 1, and the chance that a random query
          finds all k bits set (by coincidence) increases. The theoretical false positive rate is:
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 text-center">
          <p className="text-emerald-400 font-mono text-lg">
            FP = (1 - e<sup>-kn/m</sup>)<sup>k</sup>
          </p>
          <p className="text-gray-400 text-sm mt-2">
            where k = hash functions, n = inserted items, m = bit array size
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Watch the false positive rate climb as items are inserted. The green dots show the
          measured FP rate (by testing random non-member queries) and the yellow curve shows
          the theoretical prediction.
        </p>
        <FalsePositiveRateSketch />
      </section>

      {/* ---- Section: Optimal K ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Choosing the Right Parameters</h2>
        <p className="text-gray-300 leading-relaxed">
          Given a bit array of m bits and n expected items, there is an optimal number of
          hash functions k that minimizes the false positive rate. Too few hash functions means
          not enough discrimination. Too many means the bit array fills up too fast.
        </p>
        <OptimalKSketch />
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Design formulas</h3>
          <div className="font-mono text-sm text-gray-300 space-y-1">
            <p>Optimal k = (m/n) * ln(2) <span className="text-gray-500">-- minimizes FP rate</span></p>
            <p>Optimal m = -n * ln(FP) / ln(2)^2 <span className="text-gray-500">-- bits needed for target FP</span></p>
            <p>Bits per item = -ln(FP) / ln(2)^2 = ~9.6 for 1% FP <span className="text-gray-500">-- independent of item size!</span></p>
          </div>
        </div>
      </section>

      {/* ---- Section: Counting Bloom Filters ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Counting Bloom Filters: Supporting Deletion</h2>
        <p className="text-gray-300 leading-relaxed">
          Standard Bloom filters do not support deletion — setting a bit to 0 might affect
          other items that hash to the same position. <strong className="text-white">Counting Bloom Filters</strong> replace
          each bit with a counter (typically 4 bits). Insert increments the counters, delete
          decrements them. A position is "set" if its counter is greater than 0.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Trade-offs</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Uses ~4x more memory than a standard Bloom filter (4-bit counters vs 1-bit)</li>
            <li>Supports deletion, but only if items are only deleted after being inserted</li>
            <li>Counter overflow is possible with very high-count items (rare in practice with 4-bit counters)</li>
            <li>Used in network routers, CDN cache management, and session tracking</li>
          </ul>
        </div>
      </section>

      {/* ---- Python: Full Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete Bloom filter implementation with optimal parameter calculation. The demo
          simulates a web crawler checking 10,000 URLs with a target 1% false positive rate.
        </p>
        <PythonCell defaultCode={bloomImplementation} />
      </section>

      {/* ---- Python: Memory Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Memory Comparison: Bloom Filter vs HashSet</h2>
        <p className="text-gray-300 leading-relaxed">
          How much memory do you actually save? This code compares a Bloom filter against a
          hash set at different scales, and also demonstrates a Counting Bloom Filter that
          supports deletion.
        </p>
        <PythonCell defaultCode={bloomVsHashset} />
      </section>

      {/* ---- Section: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Google Chrome Safe Browsing</h3>
            <p className="text-gray-300 text-sm">
              Chrome checks every URL you visit against a list of known malicious URLs. A Bloom
              filter is downloaded to your browser (~2 MB for millions of URLs). If the Bloom filter
              says "not in set", the URL is safe — no network request needed. Only on a positive
              match does Chrome verify with Google's servers.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">PostgreSQL</h3>
            <p className="text-gray-300 text-sm">
              PostgreSQL uses Bloom filters in its Bloom index access method. When joining large
              tables, a Bloom filter can quickly eliminate rows that definitely do not match,
              avoiding expensive disk reads. Each heap page is summarized by a Bloom filter of
              its contained values.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Apache Cassandra / HBase</h3>
            <p className="text-gray-300 text-sm">
              LSM-tree databases use Bloom filters on each SSTable. Before reading an SSTable
              from disk, the Bloom filter checks if the requested key could be in that file.
              This reduces disk I/O dramatically — most reads only touch 1-2 SSTables instead
              of scanning all of them.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Medium / Akamai CDN</h3>
            <p className="text-gray-300 text-sm">
              Medium uses Bloom filters to avoid recommending articles you have already read.
              Akamai uses them for cache routing — quickly determining which edge server has
              a particular object cached, without querying every server.
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
                <th className="text-left py-2 pr-4 text-white">Bloom Filter</th>
                <th className="text-left py-2 text-white">Hash Set</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">O(k)</td>
                <td className="py-2 font-mono text-emerald-400">O(1) amortized</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Query</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">O(k)</td>
                <td className="py-2 font-mono text-emerald-400">O(1)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Delete</td>
                <td className="py-2 pr-4 font-mono text-red-400">Not supported*</td>
                <td className="py-2 font-mono text-emerald-400">O(1)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space (1B items, 1% FP)</td>
                <td className="py-2 pr-4 font-mono text-emerald-400">~1.2 GB</td>
                <td className="py-2 font-mono text-red-400">~50 GB</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">False positives</td>
                <td className="py-2 pr-4 text-yellow-400">Yes (configurable rate)</td>
                <td className="py-2 text-emerald-400">No</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-sm">
          * Counting Bloom Filters support deletion at the cost of ~4x more memory.
        </p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Bloom filters test set membership using a bit array and multiple hash functions</li>
          <li>False negatives are impossible — if an item was inserted, the filter will always say "probably yes"</li>
          <li>False positives are possible but controllable — pick m and k based on your tolerance</li>
          <li>Memory is proportional to the desired accuracy, NOT to the size of the items stored</li>
          <li>At 10 bits per item (~1.2 bytes), you get a 1% false positive rate regardless of item size</li>
          <li>Used in production by Chrome (safe browsing), PostgreSQL (indexing), Cassandra (SSTables), and CDNs</li>
          <li>Counting Bloom Filters extend the idea to support deletion using counters instead of bits</li>
        </ul>
      </section>
    </div>
  )
}
