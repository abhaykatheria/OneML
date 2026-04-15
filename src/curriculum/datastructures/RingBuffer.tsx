import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/ring-buffer',
  title: 'Ring Buffers: Fixed-Size FIFO',
  description:
    'A fixed-size circular queue that never allocates memory — the backbone of kernel I/O buffers, audio processing, logging systems, and high-performance messaging',
  track: 'datastructures',
  order: 11,
  tags: ['ring-buffer', 'circular-buffer', 'fifo', 'producer-consumer', 'lock-free', 'io-uring'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface RingBufferState {
  buffer: (string | null)[]
  head: number
  tail: number
  count: number
  capacity: number
  writeHistory: { index: number; value: string; overwritten: boolean; timer: number }[]
  readHistory: { index: number; value: string; timer: number }[]
  totalWrites: number
  totalReads: number
  totalOverwrites: number
}

function createRingBuffer(capacity: number): RingBufferState {
  return {
    buffer: new Array(capacity).fill(null),
    head: 0,
    tail: 0,
    count: 0,
    capacity,
    writeHistory: [],
    readHistory: [],
    totalWrites: 0,
    totalReads: 0,
    totalOverwrites: 0,
  }
}

function ringWrite(state: RingBufferState, value: string): RingBufferState {
  const next = { ...state, buffer: [...state.buffer], writeHistory: [...state.writeHistory] }
  const overwritten = next.count === next.capacity
  if (overwritten) {
    // Buffer full — overwrite oldest
    next.head = (next.head + 1) % next.capacity
    next.totalOverwrites++
  } else {
    next.count++
  }
  next.buffer[next.tail] = value
  next.writeHistory.push({ index: next.tail, value, overwritten, timer: 40 })
  if (next.writeHistory.length > 20) next.writeHistory.shift()
  next.tail = (next.tail + 1) % next.capacity
  next.totalWrites++
  return next
}

function ringRead(state: RingBufferState): { state: RingBufferState; value: string | null } {
  if (state.count === 0) return { state, value: null }
  const next = { ...state, buffer: [...state.buffer], readHistory: [...state.readHistory] }
  const value = next.buffer[next.head]
  next.readHistory.push({ index: next.head, value: value ?? '', timer: 40 })
  if (next.readHistory.length > 20) next.readHistory.shift()
  next.buffer[next.head] = null
  next.head = (next.head + 1) % next.capacity
  next.count--
  next.totalReads++
  return { state: next, value }
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Ring Buffer Visualization                    */
/* ------------------------------------------------------------------ */

function RingBufferSketch() {
  const capacity = 12
  const [ringState, setRingState] = useState(() => createRingBuffer(capacity))
  const [writeCounter, setWriteCounter] = useState(0)
  const [lastRead, setLastRead] = useState<string | null>(null)

  const stateRef = useRef(ringState)
  stateRef.current = ringState

  const handleWrite = useCallback(() => {
    const val = `W${writeCounter}`
    const newState = ringWrite(stateRef.current, val)
    setRingState(newState)
    stateRef.current = newState
    setWriteCounter((c) => c + 1)
    setLastRead(null)
  }, [writeCounter])

  const handleRead = useCallback(() => {
    const { state: newState, value } = ringRead(stateRef.current)
    setRingState(newState)
    stateRef.current = newState
    setLastRead(value)
  }, [])

  const handleReset = useCallback(() => {
    const fresh = createRingBuffer(capacity)
    setRingState(fresh)
    stateRef.current = fresh
    setWriteCounter(0)
    setLastRead(null)
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 460

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 800
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const st = stateRef.current

      // Update timers
      for (const h of st.writeHistory) { if (h.timer > 0) h.timer-- }
      for (const h of st.readHistory) { if (h.timer > 0) h.timer-- }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Ring Buffer  |  capacity=${st.capacity}  |  count=${st.count}  |  head=${st.head}  |  tail=${st.tail}`, 16, 12)

      // Draw ring
      const cx = W / 2
      const cy = 210
      const outerR = 140
      const innerR = 90
      const slotAngle = (2 * Math.PI) / st.capacity

      for (let i = 0; i < st.capacity; i++) {
        const startAngle = i * slotAngle - Math.PI / 2
        const endAngle = (i + 1) * slotAngle - Math.PI / 2

        const isHead = i === st.head && st.count > 0
        const isTail = i === st.tail
        const hasData = st.buffer[i] !== null
        const recentWrite = st.writeHistory.find((h) => h.index === i && h.timer > 0)
        const recentRead = st.readHistory.find((h) => h.index === i && h.timer > 0)

        // Draw slot as arc segment
        const midAngle = (startAngle + endAngle) / 2

        // Slot fill
        if (recentWrite && recentWrite.timer > 0) {
          const alpha = (recentWrite.timer / 40) * 200
          if (recentWrite.overwritten) {
            p.fill(239, 68, 68, alpha)
          } else {
            p.fill(52, 211, 153, alpha)
          }
        } else if (recentRead && recentRead.timer > 0) {
          const alpha = (recentRead.timer / 40) * 200
          p.fill(250, 204, 21, alpha)
        } else if (hasData) {
          p.fill(99, 102, 241, 120)
        } else {
          p.fill(30, 41, 59)
        }

        // Draw arc segment using triangles
        p.noStroke()
        const steps = 10
        for (let s = 0; s < steps; s++) {
          const a1 = startAngle + (s / steps) * (endAngle - startAngle) + 0.02
          const a2 = startAngle + ((s + 1) / steps) * (endAngle - startAngle) - 0.02
          p.triangle(
            cx + Math.cos(a1) * innerR, cy + Math.sin(a1) * innerR,
            cx + Math.cos(a1) * outerR, cy + Math.sin(a1) * outerR,
            cx + Math.cos(a2) * outerR, cy + Math.sin(a2) * outerR
          )
          p.triangle(
            cx + Math.cos(a1) * innerR, cy + Math.sin(a1) * innerR,
            cx + Math.cos(a2) * outerR, cy + Math.sin(a2) * outerR,
            cx + Math.cos(a2) * innerR, cy + Math.sin(a2) * innerR
          )
        }

        // Slot border
        p.stroke(71, 85, 105)
        p.strokeWeight(1)
        p.noFill()
        p.line(
          cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR,
          cx + Math.cos(startAngle) * outerR, cy + Math.sin(startAngle) * outerR
        )

        // Data label
        const labelR = (innerR + outerR) / 2
        const lx = cx + Math.cos(midAngle) * labelR
        const ly = cy + Math.sin(midAngle) * labelR
        p.noStroke()
        p.fill(hasData ? 255 : 80)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(hasData ? st.buffer[i]! : '--', lx, ly)

        // Index label
        const idxR = outerR + 16
        const ix = cx + Math.cos(midAngle) * idxR
        const iy = cy + Math.sin(midAngle) * idxR
        p.fill(100, 116, 139)
        p.textSize(8)
        p.text(`${i}`, ix, iy)

        // Head/tail markers
        if (isHead || isTail) {
          const markerR = innerR - 18
          const mx = cx + Math.cos(midAngle) * markerR
          const my = cy + Math.sin(midAngle) * markerR

          if (isHead && isTail && st.count > 0) {
            p.fill(250, 204, 21)
            p.textSize(8)
            p.text('H/T', mx, my)
          } else if (isHead) {
            p.fill(52, 211, 153)
            p.textSize(9)
            p.text('H', mx, my)
            // Arrow
            const arrowR = innerR - 4
            p.stroke(52, 211, 153)
            p.strokeWeight(2)
            p.line(
              cx + Math.cos(midAngle) * (arrowR - 12), cy + Math.sin(midAngle) * (arrowR - 12),
              cx + Math.cos(midAngle) * arrowR, cy + Math.sin(midAngle) * arrowR
            )
          } else if (isTail) {
            p.fill(239, 68, 68)
            p.textSize(9)
            p.text('T', mx, my)
            // Arrow
            const arrowR = innerR - 4
            p.stroke(239, 68, 68)
            p.strokeWeight(2)
            p.line(
              cx + Math.cos(midAngle) * (arrowR - 12), cy + Math.sin(midAngle) * (arrowR - 12),
              cx + Math.cos(midAngle) * arrowR, cy + Math.sin(midAngle) * arrowR
            )
          }
        }
      }

      // Center info
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(`${st.count}/${st.capacity}`, cx, cy - 8)
      p.fill(100, 116, 139)
      p.textSize(10)
      p.text(st.count === st.capacity ? 'FULL' : st.count === 0 ? 'EMPTY' : 'used', cx, cy + 10)

      // Stats bar
      const statsY = 380
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Writes: ${st.totalWrites}  |  Reads: ${st.totalReads}  |  Overwrites: ${st.totalOverwrites}`, 16, statsY)

      // Fill bar
      const barX = 16
      const barY = statsY + 20
      const barW = W - 32
      const barH = 14
      p.fill(30, 41, 59)
      p.rect(barX, barY, barW, barH, 3)
      const fillW = (st.count / st.capacity) * barW
      if (st.count === st.capacity) {
        p.fill(239, 68, 68, 180)
      } else if (st.count > st.capacity * 0.75) {
        p.fill(250, 204, 21, 180)
      } else {
        p.fill(99, 102, 241, 180)
      }
      p.rect(barX, barY, fillW, barH, 3)
      p.fill(255)
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(`${((st.count / st.capacity) * 100).toFixed(0)}% full`, barX + barW / 2, barY + barH / 2)

      // Legend
      const legY = barY + 26
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.noStroke()

      p.fill(52, 211, 153)
      p.rect(16, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Head (read)', 30, legY)

      p.fill(239, 68, 68)
      p.rect(130, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Tail (write)', 144, legY)

      p.fill(99, 102, 241, 120)
      p.rect(250, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Data', 264, legY)

      p.fill(250, 204, 21)
      p.rect(320, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Recently read', 334, legY)
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={460} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={handleWrite}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          Write
        </button>
        <button
          onClick={handleRead}
          disabled={ringState.count === 0}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Read
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        {lastRead !== null && (
          <span className="text-yellow-400 text-xs font-mono">Read: &quot;{lastRead}&quot;</span>
        )}
        {ringState.count === ringState.capacity && (
          <span className="text-red-400 text-xs">Buffer full! Next write overwrites oldest.</span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Producer-Consumer Simulation                            */
/* ------------------------------------------------------------------ */

function ProducerConsumerSketch() {
  const capacity = 16
  const [prodSpeed, setProdSpeed] = useState(3)
  const [consSpeed, setConsSpeed] = useState(2)
  const [running, setRunning] = useState(false)

  const prodSpeedRef = useRef(prodSpeed)
  prodSpeedRef.current = prodSpeed
  const consSpeedRef = useRef(consSpeed)
  consSpeedRef.current = consSpeed
  const runningRef = useRef(running)
  runningRef.current = running

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const buf: (number | null)[] = new Array(capacity).fill(null)
    let head = 0
    let tail = 0
    let count = 0
    let prodCounter = 0
    let totalProduced = 0
    let totalConsumed = 0
    let totalLost = 0
    const fillHistory: number[] = []
    const lossHistory: number[] = []
    let sampleTimer = 0

    function write(value: number) {
      if (count === capacity) {
        head = (head + 1) % capacity
        totalLost++
      } else {
        count++
      }
      buf[tail] = value
      tail = (tail + 1) % capacity
      totalProduced++
    }

    function read(): number | null {
      if (count === 0) return null
      const val = buf[head]
      buf[head] = null
      head = (head + 1) % capacity
      count--
      totalConsumed++
      return val
    }

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
        // Producer
        const pSpeed = prodSpeedRef.current
        if (p.frameCount % Math.max(1, 10 - pSpeed) === 0) {
          write(prodCounter++)
        }
        // Consumer
        const cSpeed = consSpeedRef.current
        if (p.frameCount % Math.max(1, 10 - cSpeed) === 0) {
          read()
        }

        // Sample fill level
        sampleTimer++
        if (sampleTimer % 5 === 0) {
          fillHistory.push(count / capacity)
          lossHistory.push(totalLost)
          if (fillHistory.length > 200) {
            fillHistory.shift()
            lossHistory.shift()
          }
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Producer-Consumer Simulation', 16, 12)

      // Draw buffer as horizontal bar
      const barX = 16
      const barY = 44
      const barW = W - 32
      const barH = 40
      const cellW = barW / capacity

      for (let i = 0; i < capacity; i++) {
        const x = barX + i * cellW
        const hasData = buf[i] !== null
        const isHead = i === head && count > 0
        const isTail = i === tail

        if (hasData) {
          p.fill(99, 102, 241, 150)
        } else {
          p.fill(30, 41, 59)
        }
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.rect(x, barY, cellW - 1, barH, 2)

        // Head/tail markers
        p.noStroke()
        if (isHead) {
          p.fill(52, 211, 153)
          p.triangle(x + cellW / 2 - 5, barY - 2, x + cellW / 2 + 5, barY - 2, x + cellW / 2, barY + 6)
        }
        if (isTail) {
          p.fill(239, 68, 68)
          p.triangle(x + cellW / 2 - 5, barY + barH + 2, x + cellW / 2 + 5, barY + barH + 2, x + cellW / 2, barY + barH - 6)
        }

        // Data value
        if (hasData) {
          p.fill(200)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${buf[i]}`, x + cellW / 2, barY + barH / 2)
        }
      }

      // Producer and consumer labels
      p.noStroke()
      p.fill(239, 68, 68)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text(`Producer (speed: ${prodSpeedRef.current}) ${runningRef.current ? '>>>' : '---'}`, 16, barY + barH + 20)

      p.fill(52, 211, 153)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text(`${runningRef.current ? '<<<' : '---'} Consumer (speed: ${consSpeedRef.current})`, W - 16, barY + barH + 20)

      // Stats
      const statsY = barY + barH + 40
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Produced: ${totalProduced}  |  Consumed: ${totalConsumed}  |  Lost (overwritten): ${totalLost}  |  Buffer: ${count}/${capacity}`, 16, statsY)

      const lossRate = totalProduced > 0 ? ((totalLost / totalProduced) * 100).toFixed(1) : '0.0'
      p.text(`Data loss rate: ${lossRate}%`, 16, statsY + 16)

      // Fill level chart
      const chartTop = statsY + 44
      const chartBottom = canvasH - 30
      const chartLeft = 50
      const chartRight = W - 20
      const chartW = chartRight - chartLeft
      const chartH = chartBottom - chartTop

      // Chart border
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.noFill()
      p.rect(chartLeft, chartTop, chartW, chartH)

      // Y-axis labels
      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(8)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('100%', chartLeft - 4, chartTop)
      p.text('50%', chartLeft - 4, chartTop + chartH / 2)
      p.text('0%', chartLeft - 4, chartBottom)

      p.fill(148, 163, 184)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Buffer fill level over time', chartLeft + chartW / 2, chartTop - 14)

      // Draw fill history
      if (fillHistory.length > 1) {
        p.noFill()
        p.stroke(99, 102, 241)
        p.strokeWeight(1.5)
        p.beginShape()
        for (let i = 0; i < fillHistory.length; i++) {
          const x = chartLeft + (i / (fillHistory.length - 1)) * chartW
          const y = chartBottom - fillHistory[i] * chartH
          p.vertex(x, y)
        }
        p.endShape()

        // Danger zone
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.globalAlpha = 0.1
        p.fill(239, 68, 68)
        p.noStroke()
        p.rect(chartLeft, chartTop, chartW, chartH * 0.15)
        ctx.globalAlpha = 1.0
        p.fill(239, 68, 68, 100)
        p.textSize(7)
        p.textAlign(p.RIGHT, p.TOP)
        p.text('overflow zone', chartRight - 2, chartTop + 2)
      }

      // Legend at bottom
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      const legY = canvasH - 14
      p.fill(52, 211, 153)
      p.text('H = Head (read)', 16, legY)
      p.fill(239, 68, 68)
      p.text('T = Tail (write)', 130, legY)
      p.fill(100, 116, 139)
      p.text('When producer > consumer: buffer fills, data overwritten', 250, legY)
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
        <label className="flex items-center gap-2 text-gray-400">
          Producer speed:
          <input
            type="range" min={1} max={9} value={prodSpeed}
            onChange={(e) => { setProdSpeed(Number(e.target.value)); prodSpeedRef.current = Number(e.target.value) }}
            className="w-24"
          />
          <span className="w-4 text-red-400">{prodSpeed}</span>
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          Consumer speed:
          <input
            type="range" min={1} max={9} value={consSpeed}
            onChange={(e) => { setConsSpeed(Number(e.target.value)); consSpeedRef.current = Number(e.target.value) }}
            className="w-24"
          />
          <span className="w-4 text-emerald-400">{consSpeed}</span>
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const ringBufferImplementation = `class RingBuffer:
    """
    Ring Buffer (Circular Buffer): a fixed-size FIFO queue backed by an array.

    Key properties:
    - Fixed memory allocation (no malloc/free after init)
    - O(1) write and read operations
    - When full, new writes overwrite the oldest data
    - Used in: kernel I/O buffers, audio processing, logging, network packets

    The magic: head and tail pointers wrap around using modular arithmetic.
    """

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.buffer = [None] * capacity
        self.head = 0      # read pointer (oldest data)
        self.tail = 0      # write pointer (next write position)
        self.count = 0     # current number of items
        self.overwrites = 0

    def write(self, value):
        """Write a value. If full, overwrites the oldest entry."""
        if self.count == self.capacity:
            # Buffer full: advance head (lose oldest)
            self.head = (self.head + 1) % self.capacity
            self.overwrites += 1
        else:
            self.count += 1
        self.buffer[self.tail] = value
        self.tail = (self.tail + 1) % self.capacity

    def read(self):
        """Read and remove the oldest value. Returns None if empty."""
        if self.count == 0:
            return None
        value = self.buffer[self.head]
        self.buffer[self.head] = None
        self.head = (self.head + 1) % self.capacity
        self.count -= 1
        return value

    def peek(self):
        """Look at oldest value without removing it."""
        if self.count == 0:
            return None
        return self.buffer[self.head]

    def is_full(self):
        return self.count == self.capacity

    def is_empty(self):
        return self.count == 0

    def __len__(self):
        return self.count

    def to_list(self):
        """Return contents in order (oldest to newest)."""
        result = []
        idx = self.head
        for _ in range(self.count):
            result.append(self.buffer[idx])
            idx = (idx + 1) % self.capacity
        return result

    def __repr__(self):
        return f"RingBuffer(cap={self.capacity}, count={self.count}, head={self.head}, tail={self.tail})"


# --- Demonstrate ring buffer behavior ---
rb = RingBuffer(5)
print("=== Basic Ring Buffer Operations ===")
print(f"Created: {rb}")

# Fill the buffer
for i in range(5):
    rb.write(f"item_{i}")
    print(f"  Write 'item_{i}': head={rb.head}, tail={rb.tail}, count={rb.count}")

print(f"\\nBuffer full: {rb.is_full()}")
print(f"Contents: {rb.to_list()}")

# Read two items
print(f"\\nRead: {rb.read()}")
print(f"Read: {rb.read()}")
print(f"After reads: {rb.to_list()}, count={rb.count}")

# Write more (should wrap around)
rb.write("new_1")
rb.write("new_2")
print(f"After 2 more writes: {rb.to_list()}")
print(f"head={rb.head}, tail={rb.tail}")

# Overwrite behavior
print(f"\\n=== Overwrite Behavior ===")
rb2 = RingBuffer(4)
for i in range(8):
    rb2.write(i * 10)
    contents = rb2.to_list()
    print(f"  Write {i*10:3d}: [{', '.join(str(x) for x in contents):>20s}] overwrites={rb2.overwrites}")

print(f"\\nFinal: {rb2.to_list()}")
print(f"Total overwrites: {rb2.overwrites}")
print(f"Lost data: first 4 values (0, 10, 20, 30) were overwritten")

# --- Use case: sliding window average ---
print(f"\\n=== Use Case: Sliding Window Average ===")
import random
random.seed(42)

window = RingBuffer(10)  # Keep last 10 readings
readings = [random.gauss(100, 15) for _ in range(30)]

print(f"Sensor readings (showing last 10 avg):")
for i, reading in enumerate(readings):
    window.write(reading)
    values = window.to_list()
    avg = sum(values) / len(values)
    marker = "*" if abs(reading - 100) > 25 else " "
    print(f"  t={i:2d}: reading={reading:6.1f} {marker} window_avg={avg:6.1f} (n={len(values)})")
`

const producerConsumerSimulation = `import random
random.seed(42)

class RingBuffer:
    """Simple ring buffer for simulation."""
    def __init__(self, capacity):
        self.capacity = capacity
        self.buffer = [None] * capacity
        self.head = 0
        self.tail = 0
        self.count = 0
        self.overwrites = 0

    def write(self, value):
        if self.count == self.capacity:
            self.head = (self.head + 1) % self.capacity
            self.overwrites += 1
        else:
            self.count += 1
        self.buffer[self.tail] = value
        self.tail = (self.tail + 1) % self.capacity

    def read(self):
        if self.count == 0:
            return None
        val = self.buffer[self.head]
        self.buffer[self.head] = None
        self.head = (self.head + 1) % self.capacity
        self.count -= 1
        return val

    def is_empty(self):
        return self.count == 0


def simulate_producer_consumer(buffer_size, prod_rate, cons_rate, duration):
    """
    Simulate producer-consumer with a ring buffer.

    Args:
        buffer_size: ring buffer capacity
        prod_rate: avg items produced per time step
        cons_rate: avg items consumed per time step
        duration: number of time steps
    Returns:
        dict with simulation statistics
    """
    buf = RingBuffer(buffer_size)
    total_produced = 0
    total_consumed = 0
    total_lost = 0
    max_fill = 0
    fill_levels = []

    for t in range(duration):
        # Producer: generate items (Poisson-like)
        n_produce = max(0, int(random.gauss(prod_rate, prod_rate * 0.3)))
        for _ in range(n_produce):
            old_overwrites = buf.overwrites
            buf.write(total_produced)
            if buf.overwrites > old_overwrites:
                total_lost += 1
            total_produced += 1

        # Consumer: consume items
        n_consume = max(0, int(random.gauss(cons_rate, cons_rate * 0.3)))
        for _ in range(n_consume):
            if buf.read() is not None:
                total_consumed += 1

        fill_levels.append(buf.count / buf.capacity)
        max_fill = max(max_fill, buf.count)

    return {
        "produced": total_produced,
        "consumed": total_consumed,
        "lost": total_lost,
        "loss_rate": total_lost / max(total_produced, 1) * 100,
        "max_fill": max_fill,
        "avg_fill": sum(fill_levels) / len(fill_levels) * 100,
        "buffer_size": buffer_size,
    }


# --- Simulate different scenarios ---
print("=== Producer-Consumer Simulation ===")
print(f"Duration: 1000 time steps\\n")

scenarios = [
    ("Balanced",     32, 5, 5),
    ("Slight overflow", 32, 6, 4),
    ("Heavy overflow",  32, 8, 3),
    ("Large buffer",   128, 8, 3),
    ("Tiny buffer",      8, 5, 5),
    ("Burst producer",  32, 10, 5),
]

print(f"{'Scenario':<20} {'BufSize':>7} {'Prod':>5} {'Cons':>5} {'Produced':>9} {'Consumed':>9} {'Lost':>6} {'Loss%':>7} {'AvgFill':>8}")
print("-" * 95)

for name, buf_size, prod_rate, cons_rate in scenarios:
    result = simulate_producer_consumer(buf_size, prod_rate, cons_rate, 1000)
    print(f"{name:<20} {buf_size:>7} {prod_rate:>5} {cons_rate:>5} {result['produced']:>9} {result['consumed']:>9} {result['lost']:>6} {result['loss_rate']:>6.1f}% {result['avg_fill']:>7.1f}%")

# --- Find optimal buffer size ---
print(f"\\n=== Finding Optimal Buffer Size ===")
print(f"Goal: < 1% data loss with prod_rate=7, cons_rate=5\\n")

for buf_size in [8, 16, 32, 64, 128, 256, 512]:
    # Run 5 trials for stability
    losses = []
    for _ in range(5):
        result = simulate_producer_consumer(buf_size, 7, 5, 1000)
        losses.append(result["loss_rate"])
    avg_loss = sum(losses) / len(losses)
    status = "OK" if avg_loss < 1.0 else "TOO HIGH"
    bar = "#" * int(avg_loss * 2)
    print(f"  buf_size={buf_size:>4}: avg_loss={avg_loss:5.1f}% [{bar:<30s}] {status}")

print(f"\\nKey insight: even when producer is faster than consumer,")
print(f"a sufficiently large buffer absorbs burst differences.")
print(f"But if the rate imbalance is sustained, no finite buffer prevents loss.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function RingBufferLesson() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16 text-gray-200">
      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-400 leading-relaxed max-w-3xl">
          A ring buffer is a fixed-size array that wraps around: when you reach the end, you continue from
          the beginning. No memory allocation. No deallocation. Just two pointers chasing each other in a
          circle. It is the data structure behind kernel I/O buffers, audio pipelines, network packet
          queues, and the fastest inter-thread messaging systems on the planet.
        </p>
      </header>

      {/* Section: The Problem */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Fixed-Size, Zero-Allocation Queues</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-3">
          <p>
            Many systems need a queue with hard constraints: <strong>fixed memory</strong> (no heap allocation
            after init), <strong>O(1) operations</strong> (no resizing, no copying), and a policy for when the
            queue is full. A linked-list queue allocates on every enqueue. A dynamic array resizes
            unpredictably. Neither is acceptable in a kernel interrupt handler, an audio callback, or a
            real-time network stack.
          </p>
          <p>
            The ring buffer solves this with elegant simplicity: a fixed array plus two pointers.
            The <strong>head</strong> pointer tracks where to read (oldest data).
            The <strong>tail</strong> pointer tracks where to write (next empty slot).
            Both wrap around using modular arithmetic: <code>next = (current + 1) % capacity</code>.
            When the buffer is full, new writes overwrite the oldest data — a deliberate design choice
            that prioritizes freshness over completeness.
          </p>
        </div>
      </section>

      {/* Section: Interactive Ring Buffer */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Ring Buffer Operations</h2>
        <p className="text-gray-400">
          Write items into the ring buffer and read them out. Watch the head and tail pointers move
          clockwise. When the buffer is full, the next write overwrites the oldest entry and the head
          advances.
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <RingBufferSketch />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400 space-y-2">
          <p><strong>How wrapping works:</strong> Both head and tail use modular arithmetic.
            When tail reaches index 11 (the last slot in a 12-element buffer), the next write goes
            to index 0. This is the &quot;ring&quot; — the array logically connects end to beginning.</p>
          <p><strong>Overwrite policy:</strong> When count equals capacity and you write, the head
            pointer advances (discarding the oldest unread item) before the tail writes. The newest
            data always gets in. This is exactly what you want for a logging buffer or audio stream
            — stale data is worthless.</p>
        </div>
      </section>

      {/* Section: Producer-Consumer */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Producer-Consumer Dynamics</h2>
        <p className="text-gray-400">
          A producer writes data at a variable rate. A consumer reads at a different rate. Adjust the
          speed sliders and watch what happens to the buffer fill level. When the producer is faster,
          the buffer fills and data starts getting overwritten.
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <ProducerConsumerSketch />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400 space-y-2">
          <p><strong>Balanced:</strong> When producer and consumer speeds are equal, the buffer stays
            partially filled and no data is lost. This is the steady-state ideal.</p>
          <p><strong>Overflow:</strong> When the producer is consistently faster, the buffer fills
            completely and the oldest data gets overwritten. The data loss rate converges to
            (prod_rate - cons_rate) / prod_rate.</p>
          <p><strong>Burst absorption:</strong> Even if the producer occasionally bursts, a
            sufficiently large buffer can absorb temporary spikes without data loss, as long as the
            average rates are balanced.</p>
        </div>
      </section>

      {/* Section: Real-World Applications */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-sky-400">LMAX Disruptor</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The LMAX Disruptor is the fastest inter-thread messaging library in Java, processing
              over 100 million messages per second. At its core: a pre-allocated ring buffer with
              sequence numbers instead of head/tail pointers. Writers claim a sequence number via
              CAS (compare-and-swap), write their data, then publish. Readers wait for sequences
              to become available. No locks, no contention, no garbage collection pressure.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-emerald-400">Linux io_uring</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Linux&apos;s io_uring uses two ring buffers shared between user space and kernel space:
              a <strong>submission queue</strong> (SQ) where the application posts I/O requests,
              and a <strong>completion queue</strong> (CQ) where the kernel posts results. The ring
              buffers are memory-mapped, so there are zero copies between user and kernel space.
              This design enables millions of I/O operations per second.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-yellow-400">Audio Processing</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Audio drivers use ring buffers to stream PCM samples between the hardware and
              application. The hardware writes samples at a fixed rate (e.g., 44,100 Hz). The
              application reads them in chunks. The ring buffer decouples these two rates. If the
              application is too slow, samples are overwritten (causing audio glitches/pops).
              Buffer size trades latency for reliability.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-purple-400">Lock-Free Ring Buffers</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              For single-producer, single-consumer scenarios, a ring buffer can be made
              <strong> lock-free</strong> using just atomic reads/writes. The producer only modifies
              tail; the consumer only modifies head. Since each pointer is written by only one
              thread, no CAS or mutex is needed — just memory ordering barriers. This is the
              fastest possible inter-thread communication primitive.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Python Implementation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implement: Ring Buffer</h2>
        <p className="text-gray-400">
          Build a complete ring buffer with write, read, overwrite detection, and a sliding-window
          average use case.
        </p>
        <PythonCell defaultCode={ringBufferImplementation} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Simulate: Producer-Consumer Data Loss</h2>
        <p className="text-gray-400">
          Simulate producer-consumer scenarios with different rate imbalances and buffer sizes.
          Find the optimal buffer size to keep data loss below 1%.
        </p>
        <PythonCell defaultCode={producerConsumerSimulation} />
      </section>

      {/* Section: Complexity Analysis */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-2 text-gray-300">Operation</th>
                <th className="px-4 py-2 text-gray-300">Time</th>
                <th className="px-4 py-2 text-gray-300">Space</th>
                <th className="px-4 py-2 text-gray-300">Notes</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Write</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2">Just a pointer increment + modulo</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Read</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2">Just a pointer increment + modulo</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Peek</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2">Read without advancing head</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Is Full / Is Empty</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2">Compare count to capacity / zero</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Total space</td>
                <td className="px-4 py-2 font-mono text-gray-500">--</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(n)</td>
                <td className="px-4 py-2">Fixed at creation, never grows</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          Compared to a linked-list queue (O(1) amortized but with allocation) or a dynamic array
          queue (O(1) amortized but with occasional O(n) resize), the ring buffer is O(1)
          worst-case with zero allocation — making it the only option for hard real-time systems.
        </p>
      </section>

      {/* Section: Key Takeaways */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">1.</span>
            <span>A ring buffer is a fixed-size array with head (read) and tail (write) pointers that wrap around using modular arithmetic.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">2.</span>
            <span>All operations are O(1) worst-case with zero memory allocation — critical for kernels, audio, and real-time systems.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">3.</span>
            <span>When full, new writes overwrite the oldest data. This is a feature, not a bug — freshness matters more than completeness in most streaming scenarios.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">4.</span>
            <span>Single-producer single-consumer ring buffers can be lock-free with just atomic pointer operations — the fastest possible inter-thread communication.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">5.</span>
            <span>Buffer sizing is a trade-off: larger buffers absorb bursts but add latency and memory. The right size depends on your burst patterns and latency tolerance.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
