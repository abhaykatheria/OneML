import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/cuckoo-filter',
  title: 'Cuckoo Filters: Better Bloom Filters',
  description:
    'Support deletion with better space efficiency than Bloom filters using cuckoo hashing with fingerprints',
  track: 'datastructures',
  order: 8,
  tags: ['cuckoo-filter', 'probabilistic', 'hashing', 'set-membership', 'fingerprint', 'deletion'],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const ACCENT: [number, number, number] = [99, 102, 241]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const PINK: [number, number, number] = [236, 72, 153]
const RED: [number, number, number] = [239, 68, 68]
const TEXT_C: [number, number, number] = [148, 163, 184]
const CYAN: [number, number, number] = [34, 211, 238]
const ORANGE: [number, number, number] = [251, 146, 60]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function hashStr(s: string, seed: number): number {
  let h = seed
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
    h = (h * 2654435761) | 0
  }
  return Math.abs(h)
}

function fingerprint(item: string): number {
  // 8-bit fingerprint (1-255, never 0)
  return (hashStr(item, 9973) % 255) + 1
}

function fpToHex(fp: number): string {
  return fp.toString(16).toUpperCase().padStart(2, '0')
}

/* ------------------------------------------------------------------ */
/* Section 1 — Cuckoo Hashing Animation                                */
/* ------------------------------------------------------------------ */

interface CuckooBucket {
  slots: (number | null)[]  // fingerprints
  labels: (string | null)[] // original item names for display
}

interface KickAnim {
  fromBucket: number
  toBucket: number
  fp: number
  label: string
  progress: number // 0 to 1
}

function CuckooHashingSketch() {
  const NUM_BUCKETS = 10
  const SLOTS_PER_BUCKET = 2
  const MAX_KICKS = 20

  const [inputValue, setInputValue] = useState('')
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [queryResult, setQueryResult] = useState('')

  const bucketsRef = useRef<CuckooBucket[]>(
    Array.from({ length: NUM_BUCKETS }, () => ({
      slots: new Array(SLOTS_PER_BUCKET).fill(null),
      labels: new Array(SLOTS_PER_BUCKET).fill(null),
    }))
  )
  const kickAnimsRef = useRef<KickAnim[]>([])
  const highlightBucketsRef = useRef<{ buckets: number[]; type: 'insert' | 'query-hit' | 'query-miss' | 'delete'; timer: number } | null>(null)
  const animPhaseRef = useRef(0) // current kick being animated
  const insertedSetRef = useRef<Set<string>>(new Set())

  const getPositions = useCallback((item: string): [number, number] => {
    const fp = fingerprint(item)
    const i1 = hashStr(item, 42) % NUM_BUCKETS
    const i2 = (i1 ^ (hashStr(String(fp), 77) % NUM_BUCKETS)) % NUM_BUCKETS
    return [i1, i2 === i1 ? (i1 + 1) % NUM_BUCKETS : i2]
  }, [])

  const handleInsert = useCallback(() => {
    if (!inputValue.trim()) return
    const item = inputValue.trim()
    const fp = fingerprint(item)
    const [i1, i2] = getPositions(item)
    const buckets = bucketsRef.current
    const logs: string[] = []
    const kicks: KickAnim[] = []

    logs.push(`INSERT "${item}" → fp=0x${fpToHex(fp)}, h1=${i1}, h2=${i2}`)

    // Try i1 first
    let placed = false
    for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
      if (buckets[i1].slots[s] === null) {
        buckets[i1].slots[s] = fp
        buckets[i1].labels[s] = item
        logs.push(`  Placed in bucket ${i1}, slot ${s}`)
        placed = true
        break
      }
    }

    // Try i2
    if (!placed) {
      for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
        if (buckets[i2].slots[s] === null) {
          buckets[i2].slots[s] = fp
          buckets[i2].labels[s] = item
          logs.push(`  Bucket ${i1} full. Placed in bucket ${i2}, slot ${s}`)
          placed = true
          break
        }
      }
    }

    // Cuckoo eviction chain
    if (!placed) {
      logs.push(`  Both buckets full! Starting cuckoo eviction chain...`)
      let curFp = fp
      let curLabel = item
      let curBucket = i1
      let evictionFailed = false

      for (let kick = 0; kick < MAX_KICKS; kick++) {
        // Pick a random slot to evict
        const evictSlot = kick % SLOTS_PER_BUCKET
        const evictedFp = buckets[curBucket].slots[evictSlot]!
        const evictedLabel = buckets[curBucket].labels[evictSlot]!

        // Place current item
        buckets[curBucket].slots[evictSlot] = curFp
        buckets[curBucket].labels[evictSlot] = curLabel

        logs.push(`  Kick #${kick + 1}: evict "${evictedLabel}" (0x${fpToHex(evictedFp)}) from bucket ${curBucket}`)

        // Compute alternate position for evicted item
        const altBucket = (curBucket ^ (hashStr(String(evictedFp), 77) % NUM_BUCKETS)) % NUM_BUCKETS
        const targetBucket = altBucket === curBucket ? (curBucket + 1) % NUM_BUCKETS : altBucket

        kicks.push({
          fromBucket: curBucket,
          toBucket: targetBucket,
          fp: evictedFp,
          label: evictedLabel,
          progress: 0,
        })

        // Try to place evicted item in its alternate position
        let evictPlaced = false
        for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
          if (buckets[targetBucket].slots[s] === null) {
            buckets[targetBucket].slots[s] = evictedFp
            buckets[targetBucket].labels[s] = evictedLabel
            logs.push(`  Placed "${evictedLabel}" in bucket ${targetBucket}, slot ${s}`)
            evictPlaced = true
            placed = true
            break
          }
        }

        if (evictPlaced) break

        curFp = evictedFp
        curLabel = evictedLabel
        curBucket = targetBucket

        if (kick === MAX_KICKS - 1) {
          logs.push(`  FAILED: max kicks (${MAX_KICKS}) reached. Filter may need rehashing.`)
          evictionFailed = true
        }
      }

      if (evictionFailed) {
        setLogMessages(logs)
        setInputValue('')
        return
      }
    }

    if (placed) {
      insertedSetRef.current.add(item)
    }
    kickAnimsRef.current = kicks
    animPhaseRef.current = 0
    highlightBucketsRef.current = { buckets: [i1, i2], type: 'insert', timer: 90 }
    setLogMessages(logs)
    setQueryResult('')
    setInputValue('')
  }, [inputValue, getPositions])

  const handleQuery = useCallback(() => {
    if (!inputValue.trim()) return
    const item = inputValue.trim()
    const fp = fingerprint(item)
    const [i1, i2] = getPositions(item)
    const buckets = bucketsRef.current

    let found = false
    for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
      if (buckets[i1].slots[s] === fp || buckets[i2].slots[s] === fp) {
        found = true
        break
      }
    }

    highlightBucketsRef.current = {
      buckets: [i1, i2],
      type: found ? 'query-hit' : 'query-miss',
      timer: 90,
    }
    kickAnimsRef.current = []

    const actual = insertedSetRef.current.has(item)
    if (found && actual) {
      setQueryResult(`"${item}" → FOUND (true positive)`)
    } else if (found && !actual) {
      setQueryResult(`"${item}" → FOUND (FALSE POSITIVE — fingerprint collision)`)
    } else {
      setQueryResult(`"${item}" → NOT FOUND (checked buckets ${i1} and ${i2})`)
    }
  }, [inputValue, getPositions])

  const handleDelete = useCallback(() => {
    if (!inputValue.trim()) return
    const item = inputValue.trim()
    const fp = fingerprint(item)
    const [i1, i2] = getPositions(item)
    const buckets = bucketsRef.current

    let deleted = false
    for (const bi of [i1, i2]) {
      for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
        if (buckets[bi].slots[s] === fp) {
          buckets[bi].slots[s] = null
          buckets[bi].labels[s] = null
          deleted = true
          break
        }
      }
      if (deleted) break
    }

    highlightBucketsRef.current = { buckets: [i1, i2], type: 'delete', timer: 90 }
    kickAnimsRef.current = []
    if (deleted) {
      insertedSetRef.current.delete(item)
      setQueryResult(`"${item}" → DELETED (fingerprint removed)`)
    } else {
      setQueryResult(`"${item}" → NOT FOUND (nothing to delete)`)
    }
  }, [inputValue, getPositions])

  const handleReset = useCallback(() => {
    bucketsRef.current = Array.from({ length: NUM_BUCKETS }, () => ({
      slots: new Array(SLOTS_PER_BUCKET).fill(null),
      labels: new Array(SLOTS_PER_BUCKET).fill(null),
    }))
    insertedSetRef.current.clear()
    kickAnimsRef.current = []
    highlightBucketsRef.current = null
    setLogMessages([])
    setQueryResult('')
    setInputValue('')
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 420

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(...BG)
      const W = p.width
      const buckets = bucketsRef.current
      const ctx = p.drawingContext as CanvasRenderingContext2D

      // Decrement timers
      if (highlightBucketsRef.current) {
        highlightBucketsRef.current.timer--
        if (highlightBucketsRef.current.timer <= 0) highlightBucketsRef.current = null
      }

      // Animate kicks
      const kicks = kickAnimsRef.current
      if (kicks.length > 0 && animPhaseRef.current < kicks.length) {
        const kick = kicks[animPhaseRef.current]
        kick.progress += 0.04
        if (kick.progress >= 1) {
          kick.progress = 1
          animPhaseRef.current++
        }
      }

      // Title
      const itemCount = buckets.reduce((s, b) => s + b.slots.filter(x => x !== null).length, 0)
      const totalSlots = NUM_BUCKETS * SLOTS_PER_BUCKET
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Cuckoo Filter  |  ${NUM_BUCKETS} buckets x ${SLOTS_PER_BUCKET} slots  |  ${itemCount}/${totalSlots} occupied (${(itemCount / totalSlots * 100).toFixed(0)}%)`, 16, 12)

      // Draw buckets
      const bucketW = Math.min(65, (W - 40) / NUM_BUCKETS)
      const bucketH = 100
      const bucketTop = 50
      const gridLeft = (W - bucketW * NUM_BUCKETS) / 2

      const hl = highlightBucketsRef.current
      const hlBuckets = hl ? new Set(hl.buckets) : new Set<number>()

      for (let b = 0; b < NUM_BUCKETS; b++) {
        const x = gridLeft + b * bucketW
        const isHL = hlBuckets.has(b)

        // Bucket outline
        if (isHL && hl) {
          if (hl.type === 'insert') p.stroke(...GREEN)
          else if (hl.type === 'query-hit') p.stroke(...YELLOW)
          else if (hl.type === 'query-miss') p.stroke(...RED)
          else p.stroke(...ORANGE)
          p.strokeWeight(2)
        } else {
          p.stroke(51, 65, 85)
          p.strokeWeight(1)
        }
        p.fill(...GRID_C)
        p.rect(x + 2, bucketTop, bucketW - 4, bucketH, 4)

        // Bucket index
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`B${b}`, x + bucketW / 2, bucketTop - 2)

        // Slots
        const slotH = (bucketH - 8) / SLOTS_PER_BUCKET
        for (let s = 0; s < SLOTS_PER_BUCKET; s++) {
          const sy = bucketTop + 4 + s * slotH
          const fp = buckets[b].slots[s]
          const label = buckets[b].labels[s]

          if (fp !== null) {
            // Filled slot
            const hue = (fp * 37) % 360
            const r2 = ACCENT[0] + ((hue * 7) % 100)
            const g2 = ACCENT[1] + ((hue * 13) % 80)
            const b2 = ACCENT[2] - ((hue * 3) % 80)
            p.fill(Math.min(255, r2), Math.min(255, g2), Math.max(60, b2), 180)
            p.noStroke()
            p.rect(x + 5, sy, bucketW - 10, slotH - 3, 3)

            p.fill(255)
            p.textSize(bucketW > 55 ? 8 : 7)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`0x${fpToHex(fp)}`, x + bucketW / 2, sy + slotH / 4)
            if (label && bucketW > 45) {
              p.fill(200)
              p.textSize(7)
              const displayLabel = label.length > 7 ? label.slice(0, 6) + '..' : label
              p.text(displayLabel, x + bucketW / 2, sy + slotH * 0.65)
            }
          } else {
            // Empty slot
            p.fill(20, 30, 48)
            p.noStroke()
            p.rect(x + 5, sy, bucketW - 10, slotH - 3, 3)
            p.fill(60)
            p.textSize(8)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('empty', x + bucketW / 2, sy + slotH / 2 - 1)
          }
        }
      }

      // Draw kick animations
      for (let k = 0; k < kicks.length && k <= animPhaseRef.current; k++) {
        const kick = kicks[k]
        if (kick.progress < 1) {
          const fromX = gridLeft + kick.fromBucket * bucketW + bucketW / 2
          const toX = gridLeft + kick.toBucket * bucketW + bucketW / 2
          const curX = fromX + (toX - fromX) * kick.progress
          const curY = bucketTop + bucketH + 20 + Math.sin(kick.progress * Math.PI) * -30

          p.fill(...ORANGE)
          p.noStroke()
          p.ellipse(curX, curY, 16, 16)
          p.fill(255)
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(fpToHex(kick.fp), curX, curY)

          // Arrow
          ctx.globalAlpha = 0.4
          ctx.setLineDash([4, 3])
          p.stroke(...ORANGE)
          p.strokeWeight(1)
          p.line(fromX, bucketTop + bucketH + 5, toX, bucketTop + bucketH + 5)
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        }
      }

      // Log area
      const logY = bucketTop + bucketH + 50
      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Operation Log:', 16, logY)

      p.fill(...TEXT_C)
      p.textSize(9)
      const logs = logMessages
      const maxLogs = 6
      const startIdx = Math.max(0, logs.length - maxLogs)
      for (let i = startIdx; i < logs.length; i++) {
        const msg = logs[i]
        if (msg.includes('FAILED') || msg.includes('FALSE')) p.fill(...RED)
        else if (msg.includes('Kick')) p.fill(...ORANGE)
        else if (msg.includes('Placed')) p.fill(...GREEN)
        else p.fill(...TEXT_C)
        p.text(msg, 16, logY + 18 + (i - startIdx) * 14)
      }

      // How it works
      const infoY = logY + 18 + maxLogs * 14 + 10
      p.fill(...TEXT_C)
      p.textSize(9)
      p.text('Two candidate buckets per item: i1 = hash(item), i2 = i1 XOR hash(fingerprint)', 16, infoY)
      p.text('If both full, evict an existing fingerprint to its alternate bucket (the "cuckoo")', 16, infoY + 14)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logMessages])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert() }}
              placeholder="Enter item..."
              className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm w-40"
            />
            <button onClick={handleInsert} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
              Insert
            </button>
            <button onClick={handleQuery} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
              Lookup
            </button>
            <button onClick={handleDelete} className="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium">
              Delete
            </button>
            <button onClick={handleReset} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">
              Reset
            </button>
          </div>
        }
      />
      {queryResult && (
        <p className={`mt-2 text-sm font-mono ${queryResult.includes('FALSE') || queryResult.includes('NOT FOUND') ? 'text-red-400' : queryResult.includes('DELETED') ? 'text-orange-400' : 'text-emerald-400'}`}>
          {queryResult}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Side-by-Side Cuckoo vs Bloom Comparison                 */
/* ------------------------------------------------------------------ */

function ComparisonSketch() {
  const [itemCount] = useState(0)
  const [running, setRunning] = useState(false)

  const runningRef = useRef(running)
  runningRef.current = running
  const itemCountRef = useRef(itemCount)

  // Bloom filter state
  const bloomBitsRef = useRef<Uint8Array>(new Uint8Array(256))
  const bloomKRef = useRef(7)

  // Cuckoo filter state (simplified)
  const cuckooBucketsRef = useRef<(number | null)[]>(new Array(128).fill(null))

  const fpTestedRef = useRef(0)
  const bloomFPRef = useRef(0)
  const cuckooFPRef = useRef(0)
  const insertedRef = useRef<Set<string>>(new Set())
  const resetFlagRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const canvasH = 440

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      if (resetFlagRef.current) {
        bloomBitsRef.current = new Uint8Array(256)
        cuckooBucketsRef.current = new Array(128).fill(null)
        insertedRef.current.clear()
        fpTestedRef.current = 0
        bloomFPRef.current = 0
        cuckooFPRef.current = 0
        itemCountRef.current = 0
        resetFlagRef.current = false
      }

      p.background(...BG)
      const W = p.width
      const halfW = W / 2 - 10

      // Insert items
      if (runningRef.current) {
        const item = `item_${itemCountRef.current}`
        const k = bloomKRef.current

        // Bloom insert
        for (let i = 0; i < k; i++) {
          const pos = hashStr(item, i * 7919 + 31) % 256
          bloomBitsRef.current[pos] = 1
        }

        // Cuckoo insert (simplified — just fingerprint in first available slot)
        const fp = (hashStr(item, 9973) % 255) + 1
        const i1 = hashStr(item, 42) % 128
        const i2 = (i1 ^ (hashStr(String(fp), 77) % 128)) % 128
        if (cuckooBucketsRef.current[i1] === null) {
          cuckooBucketsRef.current[i1] = fp
        } else if (cuckooBucketsRef.current[i2] === null) {
          cuckooBucketsRef.current[i2] = fp
        }
        // else: skip (simplified — no cuckoo eviction in viz)

        insertedRef.current.add(item)
        itemCountRef.current++

        // Test FP rate periodically
        if (itemCountRef.current % 10 === 0) {
          for (let t = 0; t < 20; t++) {
            const testItem = `test_nonmember_${fpTestedRef.current}_${t}`
            fpTestedRef.current++

            // Bloom FP test
            let bloomMatch = true
            for (let i = 0; i < k; i++) {
              const pos = hashStr(testItem, i * 7919 + 31) % 256
              if (bloomBitsRef.current[pos] === 0) { bloomMatch = false; break }
            }
            if (bloomMatch) bloomFPRef.current++

            // Cuckoo FP test
            const tfp = (hashStr(testItem, 9973) % 255) + 1
            const ti1 = hashStr(testItem, 42) % 128
            const ti2 = (ti1 ^ (hashStr(String(tfp), 77) % 128)) % 128
            if (cuckooBucketsRef.current[ti1] === tfp || cuckooBucketsRef.current[ti2] === tfp) {
              cuckooFPRef.current++
            }
          }
        }
      }

      const count = itemCountRef.current
      const tested = fpTestedRef.current

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Cuckoo Filter vs Bloom Filter  |  ${count} items inserted`, 16, 12)

      // Divider
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(W / 2, 40, W / 2, canvasH - 10)

      // === Bloom Filter side (left) ===
      p.fill(...PINK)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Bloom Filter', halfW / 2 + 10, 42)

      // Draw bit array (compressed)
      const bloomTop = 70
      const bloomBits = bloomBitsRef.current
      const bCols = 32
      const bRows = 8
      const bCellW = Math.min(12, (halfW - 20) / bCols)
      const bStartX = 10 + (halfW - bCols * bCellW) / 2

      for (let i = 0; i < 256; i++) {
        const col = i % bCols
        const row = Math.floor(i / bCols)
        const x = bStartX + col * bCellW
        const y = bloomTop + row * bCellW
        p.fill(bloomBits[i] ? PINK[0] : GRID_C[0], bloomBits[i] ? PINK[1] : GRID_C[1], bloomBits[i] ? PINK[2] : GRID_C[2], bloomBits[i] ? 180 : 100)
        p.noStroke()
        p.rect(x, y, bCellW - 1, bCellW - 1, 1)
      }

      const bloomFill = bloomBits.reduce((s: number, b: number) => s + b, 0)
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Bits: 256  |  Set: ${bloomFill} (${(bloomFill / 256 * 100).toFixed(0)}%)`, 16, bloomTop + bRows * bCellW + 6)
      p.text(`Memory: 32 bytes`, 16, bloomTop + bRows * bCellW + 20)
      p.text(`Deletion: NOT SUPPORTED`, 16, bloomTop + bRows * bCellW + 34)

      const bloomFPRate = tested > 0 ? (bloomFPRef.current / tested * 100).toFixed(2) : '0.00'
      p.fill(...RED)
      p.text(`FP rate: ${bloomFPRate}% (${bloomFPRef.current}/${tested})`, 16, bloomTop + bRows * bCellW + 52)

      // === Cuckoo Filter side (right) ===
      const rightX = W / 2 + 10
      p.fill(...CYAN)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Cuckoo Filter', rightX + halfW / 2, 42)

      // Draw bucket array (compressed)
      const cuckooTop = 70
      const cBuckets = cuckooBucketsRef.current
      const cCols = 16
      const cRows = 8
      const cCellW = Math.min(14, (halfW - 20) / cCols)
      const cStartX = rightX + (halfW - cCols * cCellW) / 2

      for (let i = 0; i < 128; i++) {
        const col = i % cCols
        const row = Math.floor(i / cCols)
        const x = cStartX + col * cCellW
        const y = cuckooTop + row * cCellW
        const fp = cBuckets[i]
        if (fp !== null) {
          p.fill(CYAN[0], CYAN[1], CYAN[2], 180)
        } else {
          p.fill(...GRID_C)
        }
        p.noStroke()
        p.rect(x, y, cCellW - 1, cCellW - 1, 1)
      }

      const cuckooFill = cBuckets.filter(x => x !== null).length
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Buckets: 128  |  Used: ${cuckooFill} (${(cuckooFill / 128 * 100).toFixed(0)}%)`, rightX + 6, cuckooTop + cRows * cCellW + 6)
      p.text(`Memory: 128 bytes (1 byte/fingerprint)`, rightX + 6, cuckooTop + cRows * cCellW + 20)
      p.fill(...GREEN)
      p.text(`Deletion: SUPPORTED`, rightX + 6, cuckooTop + cRows * cCellW + 34)

      const cuckooFPRate = tested > 0 ? (cuckooFPRef.current / tested * 100).toFixed(2) : '0.00'
      p.fill(cuckooFPRef.current < bloomFPRef.current ? GREEN[0] : RED[0],
        cuckooFPRef.current < bloomFPRef.current ? GREEN[1] : RED[1],
        cuckooFPRef.current < bloomFPRef.current ? GREEN[2] : RED[2])
      p.text(`FP rate: ${cuckooFPRate}% (${cuckooFPRef.current}/${tested})`, rightX + 6, cuckooTop + cRows * cCellW + 52)

      // Comparison summary at bottom
      const summaryY = 310
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Comparison Summary', W / 2, summaryY)

      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      const tbl = [
        ['Feature', 'Bloom Filter', 'Cuckoo Filter'],
        ['Deletion', 'No', 'Yes'],
        ['Lookup', 'k hash computations', '2 bucket checks'],
        ['Space (for FP < 3%)', 'Higher', 'Lower'],
        ['Insert', 'Always succeeds', 'May need eviction'],
        ['Max load factor', '100% of bits', '~95% of buckets'],
      ]
      const colW = [100, halfW - 60, halfW - 60]
      for (let r = 0; r < tbl.length; r++) {
        const y = summaryY + 22 + r * 16
        for (let c = 0; c < 3; c++) {
          const x2 = 16 + colW.slice(0, c).reduce((a, b) => a + b, 0)
          if (r === 0) p.fill(255)
          else if (c === 2 && tbl[r][2].includes('Yes') || c === 2 && tbl[r][2].includes('Lower')) p.fill(...GREEN)
          else p.fill(...TEXT_C)
          p.text(tbl[r][c], x2, y)
        }
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => { if (!running) resetFlagRef.current = true; setRunning(!running) }}
            className={`px-4 py-1.5 rounded text-white text-sm font-medium ${running ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {running ? 'Pause' : 'Start Inserting'}
          </button>
          <button
            onClick={() => { resetFlagRef.current = true; setRunning(false) }}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
          >
            Reset
          </button>
          <span className="text-gray-500 text-xs">
            Watch as both filters fill up and compare false positive rates
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const cuckooImplementation = `import hashlib
import random

class CuckooFilter:
    """
    Cuckoo Filter: a practical alternative to Bloom filters.

    Advantages over Bloom filters:
    - Supports deletion
    - Better space efficiency for false positive rates < 3%
    - Constant-time lookup (always check exactly 2 buckets)

    Key idea: store fingerprints (short hashes) in a cuckoo hash table.
    Each item has two candidate buckets. If both are full, evict an
    existing fingerprint to its alternate bucket (like a cuckoo bird).
    """

    def __init__(self, num_buckets: int, bucket_size: int = 4, fp_bits: int = 8):
        """
        Args:
            num_buckets: number of buckets (should be power of 2)
            bucket_size: slots per bucket (typically 4)
            fp_bits: fingerprint size in bits (8 = 1 byte, controls FP rate)
        """
        self.num_buckets = num_buckets
        self.bucket_size = bucket_size
        self.fp_bits = fp_bits
        self.fp_mask = (1 << fp_bits) - 1
        self.max_kicks = 500
        self.buckets = [[None] * bucket_size for _ in range(num_buckets)]
        self.count = 0

    def _fingerprint(self, item: str) -> int:
        """Compute a non-zero fingerprint."""
        h = int(hashlib.sha256(item.encode()).hexdigest(), 16)
        fp = (h & self.fp_mask) or 1  # never zero
        return fp

    def _hash(self, item: str) -> int:
        """Primary bucket index."""
        h = int(hashlib.md5(item.encode()).hexdigest(), 16)
        return h % self.num_buckets

    def _alt_index(self, index: int, fp: int) -> int:
        """Compute alternate bucket: i XOR hash(fingerprint)."""
        h = int(hashlib.md5(str(fp).encode()).hexdigest(), 16)
        return (index ^ h) % self.num_buckets

    def insert(self, item: str) -> bool:
        """
        Insert an item. Returns True if successful, False if filter is too full.
        """
        fp = self._fingerprint(item)
        i1 = self._hash(item)
        i2 = self._alt_index(i1, fp)

        # Try to place in i1 or i2
        for idx in (i1, i2):
            for slot in range(self.bucket_size):
                if self.buckets[idx][slot] is None:
                    self.buckets[idx][slot] = fp
                    self.count += 1
                    return True

        # Must evict — start cuckoo chain
        idx = random.choice([i1, i2])
        for _ in range(self.max_kicks):
            slot = random.randrange(self.bucket_size)
            # Swap
            fp, self.buckets[idx][slot] = self.buckets[idx][slot], fp
            # Move evicted fp to its alternate bucket
            idx = self._alt_index(idx, fp)
            for s in range(self.bucket_size):
                if self.buckets[idx][s] is None:
                    self.buckets[idx][s] = fp
                    self.count += 1
                    return True

        return False  # filter is too full, need to resize

    def lookup(self, item: str) -> bool:
        """Check if an item might be in the filter."""
        fp = self._fingerprint(item)
        i1 = self._hash(item)
        i2 = self._alt_index(i1, fp)
        return fp in self.buckets[i1] or fp in self.buckets[i2]

    def delete(self, item: str) -> bool:
        """
        Delete an item. Returns True if found and removed.
        IMPORTANT: only delete items that were actually inserted!
        """
        fp = self._fingerprint(item)
        i1 = self._hash(item)
        i2 = self._alt_index(i1, fp)

        for idx in (i1, i2):
            for slot in range(self.bucket_size):
                if self.buckets[idx][slot] == fp:
                    self.buckets[idx][slot] = None
                    self.count -= 1
                    return True
        return False

    def load_factor(self) -> float:
        """Current occupancy ratio."""
        total_slots = self.num_buckets * self.bucket_size
        return self.count / total_slots

    def memory_bytes(self) -> int:
        """Approximate memory usage."""
        bits_per_slot = self.fp_bits
        total_bits = self.num_buckets * self.bucket_size * bits_per_slot
        return total_bits // 8


# === Demo: Insert, Lookup, Delete ===
random.seed(42)
cf = CuckooFilter(num_buckets=1024, bucket_size=4, fp_bits=12)

# Insert 3000 items
items = [f"user_{i}" for i in range(3000)]
inserted = 0
for item in items:
    if cf.insert(item):
        inserted += 1
    else:
        print(f"  Insert failed at item {item} (filter too full)")
        break

print(f"Inserted: {inserted} items")
print(f"Load factor: {cf.load_factor():.1%}")
print(f"Memory: {cf.memory_bytes():,} bytes ({cf.memory_bytes()/1024:.1f} KB)")
print()

# Lookup test (true positives)
tp = sum(cf.lookup(item) for item in items[:1000])
print(f"True positive rate (1000 known items): {tp}/1000 = {tp/10:.1f}%")

# False positive test
fp_count = sum(cf.lookup(f"nonmember_{i}") for i in range(10000))
print(f"False positives (10000 unknown items): {fp_count}")
print(f"Measured FP rate: {fp_count/10000*100:.3f}%")
print()

# === Delete demo ===
print("=== Deletion Demo ===")
delete_items = items[:500]

print(f"Before deletion:")
print(f"  lookup('user_0'): {cf.lookup('user_0')}")
print(f"  lookup('user_100'): {cf.lookup('user_100')}")
print(f"  Load factor: {cf.load_factor():.1%}")

for item in delete_items:
    cf.delete(item)

print(f"\\nAfter deleting 500 items:")
print(f"  lookup('user_0'): {cf.lookup('user_0')}")   # should be False
print(f"  lookup('user_100'): {cf.lookup('user_100')}") # should be False
print(f"  lookup('user_500'): {cf.lookup('user_500')}") # should be True
print(f"  Load factor: {cf.load_factor():.1%}")
print()

# Verify no false negatives among remaining items
fn = sum(1 for item in items[500:inserted] if not cf.lookup(item))
print(f"False negatives among {inserted-500} remaining items: {fn}")
print("(Should be 0 — cuckoo filters guarantee no false negatives)")
`

const cuckooVsBloom = `import hashlib
import math
import random

class SimpleBloom:
    """Compact Bloom filter for comparison."""
    def __init__(self, m, k):
        self.m = m
        self.k = k
        self.bits = bytearray(m // 8 + 1)
        self.n = 0

    def _hashes(self, item):
        return [int(hashlib.md5(f"{i}:{item}".encode()).hexdigest(), 16) % self.m
                for i in range(self.k)]

    def insert(self, item):
        for pos in self._hashes(item):
            self.bits[pos // 8] |= (1 << (pos % 8))
        self.n += 1

    def lookup(self, item):
        return all((self.bits[pos // 8] >> (pos % 8)) & 1
                    for pos in self._hashes(item))

    def memory_bytes(self):
        return len(self.bits)


class SimpleCuckoo:
    """Compact Cuckoo filter for comparison."""
    def __init__(self, num_buckets, bucket_size=4, fp_bits=8):
        self.num_buckets = num_buckets
        self.bucket_size = bucket_size
        self.fp_bits = fp_bits
        self.fp_mask = (1 << fp_bits) - 1
        self.buckets = [[0] * bucket_size for _ in range(num_buckets)]
        self.count = 0

    def _fp(self, item):
        h = int(hashlib.sha256(item.encode()).hexdigest(), 16)
        return (h & self.fp_mask) or 1

    def _h(self, item):
        return int(hashlib.md5(item.encode()).hexdigest(), 16) % self.num_buckets

    def _alt(self, idx, fp):
        h = int(hashlib.md5(str(fp).encode()).hexdigest(), 16)
        return (idx ^ h) % self.num_buckets

    def insert(self, item):
        fp = self._fp(item)
        i1 = self._h(item)
        i2 = self._alt(i1, fp)
        for idx in (i1, i2):
            for s in range(self.bucket_size):
                if self.buckets[idx][s] == 0:
                    self.buckets[idx][s] = fp
                    self.count += 1
                    return True
        idx = random.choice([i1, i2])
        for _ in range(500):
            s = random.randrange(self.bucket_size)
            fp, self.buckets[idx][s] = self.buckets[idx][s], fp
            idx = self._alt(idx, fp)
            for s2 in range(self.bucket_size):
                if self.buckets[idx][s2] == 0:
                    self.buckets[idx][s2] = fp
                    self.count += 1
                    return True
        return False

    def lookup(self, item):
        fp = self._fp(item)
        i1 = self._h(item)
        i2 = self._alt(i1, fp)
        return fp in self.buckets[i1] or fp in self.buckets[i2]

    def delete(self, item):
        fp = self._fp(item)
        i1 = self._h(item)
        i2 = self._alt(i1, fp)
        for idx in (i1, i2):
            for s in range(self.bucket_size):
                if self.buckets[idx][s] == fp:
                    self.buckets[idx][s] = 0
                    self.count -= 1
                    return True
        return False

    def memory_bytes(self):
        return self.num_buckets * self.bucket_size * self.fp_bits // 8


# === Head-to-head comparison ===
random.seed(42)
N = 5000
test_items = [f"item_{i}" for i in range(N)]
non_members = [f"nonmember_{i}" for i in range(10000)]

print("=== Cuckoo Filter vs Bloom Filter ===")
print(f"Inserting {N} items, testing {len(non_members)} non-members")
print()

# Design for similar false positive rates
configs = [
    ("8-bit fingerprint", 8, 1024, 4),
    ("12-bit fingerprint", 12, 1024, 4),
    ("16-bit fingerprint", 16, 512, 4),
]

for name, fp_bits, num_buckets, bucket_size in configs:
    cf = SimpleCuckoo(num_buckets, bucket_size, fp_bits)
    inserted = sum(1 for item in test_items if cf.insert(item))

    # Design Bloom with same memory
    bloom_bits = cf.memory_bytes() * 8
    bloom_k = max(1, round(bloom_bits / N * math.log(2)))
    bf = SimpleBloom(bloom_bits, bloom_k)
    for item in test_items:
        bf.insert(item)

    # FP rates
    cf_fp = sum(1 for item in non_members if cf.lookup(item))
    bf_fp = sum(1 for item in non_members if bf.lookup(item))

    cf_fp_rate = cf_fp / len(non_members) * 100
    bf_fp_rate = bf_fp / len(non_members) * 100

    print(f"--- {name} ---")
    print(f"  Cuckoo: {cf.memory_bytes():,} bytes, FP rate: {cf_fp_rate:.3f}%, inserted: {inserted}/{N}")
    print(f"  Bloom:  {bf.memory_bytes():,} bytes, FP rate: {bf_fp_rate:.3f}% (same memory, k={bloom_k})")
    winner = "Cuckoo" if cf_fp_rate < bf_fp_rate else "Bloom"
    print(f"  Winner: {winner} ({abs(cf_fp_rate - bf_fp_rate):.3f}% better FP rate)")
    print()

# === Deletion advantage ===
print("=== Deletion: Cuckoo's Superpower ===")
cf = SimpleCuckoo(1024, 4, 12)
for item in test_items:
    cf.insert(item)

# Delete half the items
delete_set = test_items[:N//2]
for item in delete_set:
    cf.delete(item)

# Check: deleted items should NOT be found
false_finds = sum(1 for item in delete_set if cf.lookup(item))
# Check: remaining items should still be found
remaining = test_items[N//2:]
still_found = sum(1 for item in remaining if cf.lookup(item))

print(f"After deleting {len(delete_set)} of {N} items:")
print(f"  Deleted items found (should be ~0): {false_finds}")
print(f"  Remaining items found (should be {len(remaining)}): {still_found}")
print(f"  Load factor after deletion: {cf.count / (1024*4):.1%}")
print()
print("With a Bloom filter, deletion is IMPOSSIBLE without rebuilding from scratch.")
print("Cuckoo filters simply remove the fingerprint from its bucket.")
print()

# === When to use which ===
print("=== Decision Guide ===")
print()
print("Use CUCKOO FILTER when:")
print("  - You need deletion support")
print("  - Target FP rate is < 3%")
print("  - You want constant-time (2 bucket) lookups")
print("  - You can tolerate occasional insert failures at high load")
print()
print("Use BLOOM FILTER when:")
print("  - You never need deletion")
print("  - Target FP rate is > 3%")
print("  - You need guaranteed insert success")
print("  - Simpler implementation is preferred")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function CuckooFilter() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          Cuckoo Filters: Better Bloom Filters
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          Bloom filters are fantastic for set membership testing, but they have a fatal flaw:
          you cannot delete elements. Cuckoo filters solve this problem while achieving better
          space efficiency for low false positive rates, using a clever hashing scheme inspired
          by the cuckoo bird.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem with Bloom Filters</h2>
        <p className="text-gray-300 leading-relaxed">
          Bloom filters set bits to 1 during insertion, but multiple items share the same bit
          positions (by design — that is what makes them space-efficient). This means you{' '}
          <strong className="text-red-400">cannot safely set bits back to 0</strong> during
          deletion — doing so would create false negatives for other items that hash to the same
          positions.
        </p>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-300 text-sm">
            Scenario: you are building a cache filter. When an item is evicted from cache, you
            need to remove it from the filter. With a Bloom filter, you cannot. Stale entries
            accumulate and the false positive rate rises over time. The only fix is to rebuild
            the entire filter from scratch.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Counting Bloom filters (using counters instead of bits) support deletion but use 4x
          more memory. Cuckoo filters offer a better solution: deletion support with{' '}
          <strong className="text-white">less memory than a Bloom filter</strong> at low FP rates.
        </p>
      </section>

      {/* ---- Section: Cuckoo Hashing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Cuckoo Hashing: The Core Idea</h2>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            Each item has exactly <strong>two candidate bucket positions</strong>. If both are full,
            one of the existing items is evicted ("cuckooed") to its alternate position. This may
            trigger a chain of relocations, just like a cuckoo bird pushing other eggs out of
            the nest.
          </p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm space-y-1">
          <p className="text-gray-400"># Cuckoo filter operations</p>
          <p className="text-emerald-400">INSERT(item):</p>
          <p className="text-gray-300">&nbsp;&nbsp;fp = fingerprint(item)</p>
          <p className="text-gray-300">&nbsp;&nbsp;i1 = hash(item)</p>
          <p className="text-gray-300">&nbsp;&nbsp;i2 = i1 XOR hash(fp) &nbsp;&nbsp;// partial-key cuckoo hashing</p>
          <p className="text-gray-300">&nbsp;&nbsp;if bucket[i1] or bucket[i2] has empty slot: place fp</p>
          <p className="text-gray-300">&nbsp;&nbsp;else: evict random entry, place it at its alt position</p>
          <p className="text-gray-300">&nbsp;</p>
          <p className="text-cyan-400">LOOKUP(item):</p>
          <p className="text-gray-300">&nbsp;&nbsp;fp = fingerprint(item)</p>
          <p className="text-gray-300">&nbsp;&nbsp;return fp in bucket[i1] or fp in bucket[i2]</p>
          <p className="text-gray-300">&nbsp;</p>
          <p className="text-orange-400">DELETE(item):</p>
          <p className="text-gray-300">&nbsp;&nbsp;fp = fingerprint(item)</p>
          <p className="text-gray-300">&nbsp;&nbsp;remove first occurrence of fp from bucket[i1] or bucket[i2]</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The crucial trick is <strong className="text-white">partial-key cuckoo hashing</strong>:
          the alternate bucket is computed as <code className="text-cyan-400">i1 XOR hash(fingerprint)</code>.
          This means you can compute the alternate position from any bucket index and the stored
          fingerprint alone — without knowing the original item. This is what enables the eviction
          chain to work even though only fingerprints are stored.
        </p>
      </section>

      {/* ---- Section: Interactive Cuckoo Filter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Cuckoo Filter</h2>
        <p className="text-gray-300 leading-relaxed">
          Insert items and watch fingerprints being placed in buckets. When both candidate buckets
          are full, observe the cuckoo eviction chain. Try deleting items — something impossible
          with standard Bloom filters.
        </p>
        <CuckooHashingSketch />
        <p className="text-gray-400 text-sm">
          Try: insert "alice", "bob", "carol", "dave" then try "eve" and "frank" until you see
          a cuckoo eviction. Then delete "alice" and verify it is gone with Lookup.
        </p>
      </section>

      {/* ---- Section: Fingerprints ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Fingerprints: Space Efficiency</h2>
        <p className="text-gray-300 leading-relaxed">
          Instead of storing full items (like a hash table) or just bit positions (like a Bloom
          filter), cuckoo filters store <strong className="text-white">fingerprints</strong> —
          short hashes of each item, typically 8-16 bits.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Fingerprint size vs FP rate</h3>
          <div className="font-mono text-sm text-gray-300 space-y-1">
            <p>8-bit fingerprint: FP rate approximately 1/256 = 0.39%</p>
            <p>12-bit fingerprint: FP rate approximately 1/4096 = 0.024%</p>
            <p>16-bit fingerprint: FP rate approximately 1/65536 = 0.0015%</p>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            More precisely: FP rate = 2 * (bucket_size) / 2<sup>fp_bits</sup> for a loaded filter.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          With 4 slots per bucket and 12-bit fingerprints, each bucket uses just 6 bytes.
          A cuckoo filter with 95% load factor uses about 12.6 bits per item at 0.03% FP rate,
          while a Bloom filter needs 14.4 bits per item for the same FP rate.
        </p>
      </section>

      {/* ---- Section: Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Cuckoo vs Bloom: Side by Side</h2>
        <p className="text-gray-300 leading-relaxed">
          Watch both filters process the same stream of items. Compare their space usage and
          false positive rates. The cuckoo filter typically achieves a lower FP rate with the
          same or less memory for target FP rates below 3%.
        </p>
        <ComparisonSketch />
      </section>

      {/* ---- Section: When to Use ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">When to Use Cuckoo Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4">
            <h3 className="text-lg font-medium text-emerald-400 mb-2">Use Cuckoo Filters when:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
              <li>You need deletion support (cache eviction, session management)</li>
              <li>Target false positive rate is below 3%</li>
              <li>You want deterministic lookup time (always 2 bucket checks)</li>
              <li>Memory efficiency matters (better bits-per-item at low FP)</li>
            </ul>
          </div>
          <div className="bg-pink-900/20 border border-pink-700 rounded-lg p-4">
            <h3 className="text-lg font-medium text-pink-400 mb-2">Use Bloom Filters when:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
              <li>You never need to delete elements</li>
              <li>Target false positive rate is above 3%</li>
              <li>You need guaranteed insert success (no load factor limit)</li>
              <li>Simpler implementation is preferred</li>
            </ul>
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-2">Real-World Usage</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
            <li><strong className="text-white">ScyllaDB</strong> uses cuckoo filters for SSTable lookups, replacing Bloom filters for better performance</li>
            <li><strong className="text-white">Badger (Go)</strong> key-value store uses cuckoo filters in its LSM-tree</li>
            <li><strong className="text-white">Network packet classification</strong> uses cuckoo filters for ACL rule matching</li>
            <li><strong className="text-white">Genome analysis</strong> tools use cuckoo filters for k-mer membership testing with deletion for error correction</li>
          </ul>
        </div>
      </section>

      {/* ---- Python: Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete cuckoo filter with insert, lookup, and delete operations. The demo inserts
          3000 items, measures the false positive rate, then demonstrates deletion — something
          impossible with a standard Bloom filter.
        </p>
        <PythonCell defaultCode={cuckooImplementation} />
      </section>

      {/* ---- Python: Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Cuckoo vs Bloom: Empirical Comparison</h2>
        <p className="text-gray-300 leading-relaxed">
          Head-to-head comparison with the same memory budget. At low FP rates, the cuckoo
          filter wins on space efficiency. The code also demonstrates the deletion advantage.
        </p>
        <PythonCell defaultCode={cuckooVsBloom} />
      </section>

      {/* ---- Section: Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Property</th>
                <th className="text-left py-2 pr-4 text-white">Cuckoo Filter</th>
                <th className="text-left py-2 text-white">Bloom Filter</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4">O(1) amortized</td>
                <td className="py-2">O(k)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Lookup</td>
                <td className="py-2 pr-4 text-emerald-400">O(1) — always 2 buckets</td>
                <td className="py-2">O(k) — k hash checks</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Delete</td>
                <td className="py-2 pr-4 text-emerald-400">O(1) — supported</td>
                <td className="py-2 text-red-400">Not possible</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space (FP &lt; 3%)</td>
                <td className="py-2 pr-4 text-emerald-400">Better</td>
                <td className="py-2">Worse</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Max occupancy</td>
                <td className="py-2 pr-4 text-yellow-400">~95% load factor</td>
                <td className="py-2 text-emerald-400">100% of bits usable</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Insert failure</td>
                <td className="py-2 pr-4 text-yellow-400">Possible at high load</td>
                <td className="py-2 text-emerald-400">Never fails</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Cuckoo filters store fingerprints in a cuckoo hash table with 2 candidate buckets per item</li>
          <li>Partial-key cuckoo hashing (i2 = i1 XOR hash(fp)) enables relocations without the original item</li>
          <li>Deletion is supported by simply removing a matching fingerprint from its bucket</li>
          <li>Better space efficiency than Bloom filters when the target false positive rate is below 3%</li>
          <li>Lookup is always constant time: check exactly 2 buckets</li>
          <li>Trade-off: inserts can fail at high load factors (~95%), requiring a resize</li>
          <li>Used in databases (ScyllaDB, Badger), network systems, and bioinformatics</li>
        </ul>
      </section>
    </div>
  )
}
