import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/hyperloglog',
  title: 'HyperLogLog: Counting Unique Visitors',
  description:
    'Probabilistic cardinality estimation using leading zeros — count billions of unique elements with kilobytes of memory',
  track: 'datastructures',
  order: 4,
  tags: [
    'hyperloglog',
    'probabilistic',
    'cardinality',
    'streaming',
    'redis',
    'counting',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const ACCENT: [number, number, number] = [99, 102, 241] // indigo
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const PINK: [number, number, number] = [236, 72, 153]
const RED: [number, number, number] = [239, 68, 68]
const TEXT_C: [number, number, number] = [148, 163, 184]
const CYAN: [number, number, number] = [34, 211, 238]

/* ------------------------------------------------------------------ */
/* Helpers — simple hash & leading zeros                               */
/* ------------------------------------------------------------------ */

function simpleHash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function countLeadingZeros(value: number, bits: number): number {
  let count = 0
  for (let i = bits - 1; i >= 0; i--) {
    if ((value & (1 << i)) === 0) {
      count++
    } else {
      break
    }
  }
  return count
}

/* ------------------------------------------------------------------ */
/* Section 1 — Register Visualization                                  */
/* ------------------------------------------------------------------ */

function RegisterSketch() {
  const NUM_REGISTERS = 16
  const REGISTER_BITS = 4 // log2(16) for register selection
  const VALUE_BITS = 28 // remaining bits for leading zeros

  const [speed, setSpeed] = useState(5)
  const [running, setRunning] = useState(false)
  const speedRef = useRef(speed)
  const runningRef = useRef(running)
  speedRef.current = speed
  runningRef.current = running

  const registersRef = useRef<number[]>(new Array(NUM_REGISTERS).fill(0))
  const countRef = useRef(0)
  const frameCountRef = useRef(0)
  const lastItemRef = useRef<{
    id: string
    hash: number
    binary: string
    registerIdx: number
    leadingZeros: number
  } | null>(null)

  const resetRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 520

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      if (resetRef.current) {
        registersRef.current = new Array(NUM_REGISTERS).fill(0)
        countRef.current = 0
        lastItemRef.current = null
        resetRef.current = false
      }

      p.background(...BG)
      const registers = registersRef.current

      // Process new items
      if (runningRef.current) {
        frameCountRef.current++
        if (frameCountRef.current % Math.max(1, 10 - speedRef.current) === 0) {
          const id = `user_${Math.random().toString(36).slice(2, 10)}_${countRef.current}`
          const hash = simpleHash(id)
          const registerIdx = hash >>> VALUE_BITS
          const valuePart = hash & ((1 << VALUE_BITS) - 1)
          const lz = countLeadingZeros(valuePart, VALUE_BITS) + 1

          if (lz > registers[registerIdx]) {
            registers[registerIdx] = lz
          }

          countRef.current++
          lastItemRef.current = {
            id,
            hash,
            binary: hash.toString(2).padStart(32, '0'),
            registerIdx,
            leadingZeros: lz,
          }
        }
      }

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.LEFT, p.TOP)
      p.text('HyperLogLog Registers', 15, 12)

      p.fill(...TEXT_C)
      p.textSize(11)
      p.text(`Elements streamed: ${countRef.current}`, 15, 35)

      // Compute estimate
      const m = NUM_REGISTERS
      const alpha = 0.7213 / (1 + 1.079 / m)
      let harmonicSum = 0
      for (let j = 0; j < m; j++) {
        harmonicSum += Math.pow(2, -registers[j])
      }
      const estimate = Math.round(alpha * m * m / harmonicSum)

      p.fill(...YELLOW)
      p.textSize(13)
      p.text(`Estimated cardinality: ${estimate}`, 15, 55)

      // Draw formula
      p.fill(...TEXT_C)
      p.textSize(10)
      p.text(`E = alpha * m^2 / SUM(2^(-M[j]))  =  ${alpha.toFixed(4)} * ${m}^2 / ${harmonicSum.toFixed(4)}`, 15, 78)

      // Draw registers
      const regStartY = 105
      const regW = (p.width - 40) / NUM_REGISTERS
      const maxRegVal = Math.max(1, ...registers)

      for (let i = 0; i < NUM_REGISTERS; i++) {
        const x = 20 + i * regW
        const barMaxH = 180
        const barH = (registers[i] / Math.max(maxRegVal, 10)) * barMaxH

        // Register background
        p.fill(...GRID_C)
        p.noStroke()
        p.rect(x + 2, regStartY, regW - 4, barMaxH, 3)

        // Register value bar
        const intensity = registers[i] / Math.max(maxRegVal, 1)
        const r = ACCENT[0] + (PINK[0] - ACCENT[0]) * intensity
        const g = ACCENT[1] + (PINK[1] - ACCENT[1]) * intensity
        const b = ACCENT[2] + (PINK[2] - ACCENT[2]) * intensity
        p.fill(r, g, b)
        p.rect(x + 2, regStartY + barMaxH - barH, regW - 4, barH, 3)

        // Highlight last updated register
        if (lastItemRef.current && lastItemRef.current.registerIdx === i) {
          p.stroke(...YELLOW)
          p.strokeWeight(2)
          p.noFill()
          p.rect(x + 1, regStartY - 1, regW - 2, barMaxH + 2, 3)
        }

        // Register index label
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`R${i}`, x + regW / 2, regStartY + barMaxH + 5)

        // Register value
        p.fill(255)
        p.textSize(10)
        p.text(`${registers[i]}`, x + regW / 2, regStartY + barMaxH + 18)
      }

      // Last item details
      const detailY = regStartY + 220
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Last Element Processed:', 15, detailY)

      if (lastItemRef.current) {
        const item = lastItemRef.current
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text(`ID: ${item.id}`, 15, detailY + 22)

        // Draw the binary representation with colored sections
        p.text('Hash (binary):', 15, detailY + 42)

        const binStr = item.binary
        const bx = 130
        const charW = 12
        p.textSize(12)
        p.textFont('monospace')

        // First REGISTER_BITS bits in yellow (register selector)
        for (let i = 0; i < REGISTER_BITS; i++) {
          p.fill(...YELLOW)
          p.text(binStr[i], bx + i * charW, detailY + 42)
        }

        // Remaining bits — highlight leading zeros in cyan, first 1 in green
        let foundOne = false
        for (let i = REGISTER_BITS; i < 32; i++) {
          if (!foundOne && binStr[i] === '0') {
            p.fill(...CYAN)
          } else if (!foundOne && binStr[i] === '1') {
            p.fill(...GREEN)
            foundOne = true
          } else {
            p.fill(...GRID_C)
          }
          p.text(binStr[i], bx + i * charW, detailY + 42)
        }

        // Legend
        p.textFont('sans-serif')
        p.textSize(10)
        const legendY = detailY + 65

        p.fill(...YELLOW)
        p.rect(15, legendY, 10, 10, 2)
        p.fill(...TEXT_C)
        p.text(`Register selector (bits 0-${REGISTER_BITS - 1}) -> R${item.registerIdx}`, 30, legendY)

        p.fill(...CYAN)
        p.rect(15, legendY + 16, 10, 10, 2)
        p.fill(...TEXT_C)
        p.text(`Leading zeros = ${item.leadingZeros - 1} -> stored max = ${item.leadingZeros}`, 30, legendY + 16)

        p.fill(...GREEN)
        p.rect(15, legendY + 32, 10, 10, 2)
        p.fill(...TEXT_C)
        p.text('First 1-bit (terminates the run)', 30, legendY + 32)
      } else {
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text('Press START to begin streaming elements...', 15, detailY + 22)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={520}
        controls={
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                running
                  ? 'bg-red-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              {running ? 'PAUSE' : 'START'}
            </button>
            <button
              onClick={() => {
                resetRef.current = true
                setRunning(false)
              }}
              className="px-4 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
            <label className="text-xs text-gray-400 flex items-center gap-2">
              Speed:
              <input
                type="range"
                min={1}
                max={10}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-24"
              />
              {speed}
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Accuracy Sketch: Estimated vs Actual                    */
/* ------------------------------------------------------------------ */

function AccuracySketch() {
  const [running, setRunning] = useState(false)
  const [registerCount, setRegisterCount] = useState(64)
  const runningRef = useRef(running)
  const registerCountRef = useRef(registerCount)
  runningRef.current = running
  registerCountRef.current = registerCount

  const stateRef = useRef<{
    registers: number[]
    count: number
    seen: Set<number>
    history: { actual: number; estimated: number }[]
  }>({ registers: [], count: 0, seen: new Set(), history: [] })

  const resetRef = useRef(true)

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 440

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      if (resetRef.current) {
        const m = registerCountRef.current
        stateRef.current = {
          registers: new Array(m).fill(0),
          count: 0,
          seen: new Set(),
          history: [],
        }
        resetRef.current = false
      }

      const state = stateRef.current
      const m = state.registers.length

      // Process elements
      if (runningRef.current) {
        for (let batch = 0; batch < 20; batch++) {
          const val = Math.floor(Math.random() * 2_000_000)
          const hash = simpleHash(`v${val}`)
          state.seen.add(val)

          const regBits = Math.round(Math.log2(m))
          const regIdx = hash >>> (32 - regBits)
          const valuePart = (hash << regBits) >>> 0
          const lz = countLeadingZeros(valuePart, 32 - regBits) + 1

          if (regIdx < m && lz > state.registers[regIdx]) {
            state.registers[regIdx] = lz
          }

          state.count++

          if (state.count % 50 === 0) {
            const alpha = m >= 128 ? 0.7213 / (1 + 1.079 / m)
              : m === 64 ? 0.709
              : m === 32 ? 0.697
              : m === 16 ? 0.673
              : 0.65
            let harmonicSum = 0
            for (let j = 0; j < m; j++) {
              harmonicSum += Math.pow(2, -state.registers[j])
            }
            const est = Math.round(alpha * m * m / harmonicSum)
            state.history.push({ actual: state.seen.size, estimated: est })
          }
        }
      }

      p.background(...BG)

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Accuracy: Estimated vs Actual (m = ${m} registers)`, 15, 12)

      p.fill(...TEXT_C)
      p.textSize(11)
      const stdError = (1.04 / Math.sqrt(m) * 100).toFixed(1)
      p.text(`Standard error: 1.04 / sqrt(${m}) = ${stdError}%   |   Memory: ${m} bytes`, 15, 34)
      p.text(`Elements processed: ${state.count}   |   True unique: ${state.seen.size}`, 15, 50)

      // Plot area
      const plotX = 70
      const plotY = 75
      const plotW = p.width - 100
      const plotH = H - 120

      // Grid
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(plotX, plotY, plotX, plotY + plotH)
      p.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)

      if (state.history.length > 1) {
        const maxVal = Math.max(
          ...state.history.map((h) => Math.max(h.actual, h.estimated)),
          1
        )

        // Y-axis labels
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let i = 0; i <= 4; i++) {
          const val = Math.round((maxVal * i) / 4)
          const y = plotY + plotH - (i / 4) * plotH
          p.text(val.toLocaleString(), plotX - 5, y)
          p.stroke(...GRID_C)
          p.strokeWeight(0.5)
          p.line(plotX, y, plotX + plotW, y)
          p.noStroke()
        }

        // Error band
        const errFrac = 1.04 / Math.sqrt(m)
        p.fill(99, 102, 241, 30)
        p.noStroke()
        p.beginShape()
        for (let i = 0; i < state.history.length; i++) {
          const x = plotX + (i / (state.history.length - 1)) * plotW
          const y = plotY + plotH - ((state.history[i].actual * (1 + errFrac)) / maxVal) * plotH
          p.vertex(x, y)
        }
        for (let i = state.history.length - 1; i >= 0; i--) {
          const x = plotX + (i / (state.history.length - 1)) * plotW
          const y = plotY + plotH - ((state.history[i].actual * (1 - errFrac)) / maxVal) * plotH
          p.vertex(x, y)
        }
        p.endShape(p.CLOSE)

        // Actual line (green)
        p.stroke(...GREEN)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < state.history.length; i++) {
          const x = plotX + (i / (state.history.length - 1)) * plotW
          const y = plotY + plotH - (state.history[i].actual / maxVal) * plotH
          p.vertex(x, y)
        }
        p.endShape()

        // Estimated line (indigo)
        p.stroke(...ACCENT)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < state.history.length; i++) {
          const x = plotX + (i / (state.history.length - 1)) * plotW
          const y = plotY + plotH - (state.history[i].estimated / maxVal) * plotH
          p.vertex(x, y)
        }
        p.endShape()

        // Legend
        p.noStroke()
        const legY = plotY + plotH + 20
        p.fill(...GREEN)
        p.rect(plotX, legY, 14, 3)
        p.fill(...TEXT_C)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Actual unique count', plotX + 20, legY + 2)

        p.fill(...ACCENT)
        p.rect(plotX + 170, legY, 14, 3)
        p.fill(...TEXT_C)
        p.text('HLL estimate', plotX + 190, legY + 2)

        p.fill(99, 102, 241, 80)
        p.rect(plotX + 310, legY - 4, 14, 10, 2)
        p.fill(...TEXT_C)
        p.text(`Expected error band (+/- ${stdError}%)`, plotX + 330, legY + 2)
      } else {
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Press START to stream elements and see accuracy...', plotX + plotW / 2, plotY + plotH / 2)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={440}
        controls={
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                running
                  ? 'bg-red-600 text-white'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {running ? 'PAUSE' : 'START'}
            </button>
            <button
              onClick={() => {
                resetRef.current = true
                setRunning(false)
              }}
              className="px-4 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
            <label className="text-xs text-gray-400 flex items-center gap-2">
              Registers:
              <select
                value={registerCount}
                onChange={(e) => {
                  setRegisterCount(Number(e.target.value))
                  resetRef.current = true
                  setRunning(false)
                }}
                className="bg-slate-700 text-gray-200 rounded px-2 py-1 text-xs"
              >
                <option value={16}>16 (16 B)</option>
                <option value={32}>32 (32 B)</option>
                <option value={64}>64 (64 B)</option>
                <option value={128}>128 (128 B)</option>
                <option value={256}>256 (256 B)</option>
              </select>
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Memory Comparison Sketch                                */
/* ------------------------------------------------------------------ */

function MemorySketch() {
  const frameRef = useRef(0)
  const dataRef = useRef<{ count: number; hllBytes: number; setBytes: number }[]>([])
  const [running, setRunning] = useState(false)
  const runningRef = useRef(running)
  runningRef.current = running

  const resetRef = useRef(true)

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 360

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      if (resetRef.current) {
        dataRef.current = []
        frameRef.current = 0
        resetRef.current = false
      }

      p.background(...BG)

      if (runningRef.current) {
        frameRef.current++
        if (frameRef.current % 3 === 0) {
          const count = dataRef.current.length > 0
            ? dataRef.current[dataRef.current.length - 1].count + 5000
            : 5000
          // HLL with 16K registers = 16KB always
          const hllBytes = 16384
          // HashSet: ~50 bytes per entry (object overhead, hash table)
          const setBytes = count * 50
          dataRef.current.push({ count, hllBytes, setBytes })
          if (dataRef.current.length > 200) {
            dataRef.current = dataRef.current.slice(-200)
          }
        }
      }

      const data = dataRef.current

      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Memory Usage: HyperLogLog vs HashSet', 15, 12)

      const plotX = 80
      const plotY = 50
      const plotW = p.width - 110
      const plotH = H - 100

      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(plotX, plotY, plotX, plotY + plotH)
      p.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)

      if (data.length > 1) {
        const maxBytes = Math.max(...data.map((d) => d.setBytes), 1)
        const maxCount = Math.max(...data.map((d) => d.count), 1)

        // Y-axis labels
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        for (let i = 0; i <= 4; i++) {
          const bytes = Math.round((maxBytes * i) / 4)
          const y = plotY + plotH - (i / 4) * plotH
          const label = bytes >= 1048576
            ? `${(bytes / 1048576).toFixed(1)} MB`
            : bytes >= 1024
            ? `${(bytes / 1024).toFixed(0)} KB`
            : `${bytes} B`
          p.text(label, plotX - 5, y)
          p.stroke(...GRID_C)
          p.strokeWeight(0.5)
          p.line(plotX, y, plotX + plotW, y)
          p.noStroke()
        }

        // X-axis labels
        p.textAlign(p.CENTER, p.TOP)
        for (let i = 0; i <= 4; i++) {
          const count = Math.round((maxCount * i) / 4)
          const x = plotX + (i / 4) * plotW
          p.fill(...TEXT_C)
          p.text(`${(count / 1000).toFixed(0)}K`, x, plotY + plotH + 5)
        }

        // HashSet line (red)
        p.stroke(...RED)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < data.length; i++) {
          const x = plotX + (i / (data.length - 1)) * plotW
          const y = plotY + plotH - (data[i].setBytes / maxBytes) * plotH
          p.vertex(x, y)
        }
        p.endShape()

        // HLL line (green) — nearly flat at the bottom
        p.stroke(...GREEN)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < data.length; i++) {
          const x = plotX + (i / (data.length - 1)) * plotW
          const y = plotY + plotH - (data[i].hllBytes / maxBytes) * plotH
          p.vertex(x, y)
        }
        p.endShape()

        // Legend
        p.noStroke()
        const lastSet = data[data.length - 1]
        const setMB = (lastSet.setBytes / 1048576).toFixed(1)
        const hllKB = (lastSet.hllBytes / 1024).toFixed(0)

        p.fill(...RED)
        p.rect(plotX, plotY + plotH + 25, 14, 3)
        p.fill(...TEXT_C)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`HashSet: ${setMB} MB (and growing)`, plotX + 20, plotY + plotH + 27)

        p.fill(...GREEN)
        p.rect(plotX + 250, plotY + plotH + 25, 14, 3)
        p.fill(...TEXT_C)
        p.text(`HyperLogLog: ${hllKB} KB (constant!)`, plotX + 270, plotY + plotH + 27)
      } else {
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Press START to compare memory growth...', plotX + plotW / 2, plotY + plotH / 2)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                running
                  ? 'bg-red-600 text-white'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {running ? 'PAUSE' : 'START'}
            </button>
            <button
              onClick={() => {
                resetRef.current = true
                setRunning(false)
              }}
              className="px-4 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python cells                                                        */
/* ------------------------------------------------------------------ */

const pythonHLLImplementation = `import hashlib, math

class HyperLogLog:
    """HyperLogLog cardinality estimator from scratch."""

    def __init__(self, b=10):
        """b = number of bits for register selection.
        m = 2^b registers. More registers = better accuracy.
        Standard error = 1.04 / sqrt(m)."""
        self.b = b
        self.m = 1 << b            # number of registers
        self.registers = [0] * self.m
        self.alpha = self._get_alpha(self.m)

    def _get_alpha(self, m):
        if m == 16: return 0.673
        if m == 32: return 0.697
        if m == 64: return 0.709
        return 0.7213 / (1 + 1.079 / m)

    def _hash(self, item):
        """Hash item to a 32-bit integer."""
        h = hashlib.sha256(str(item).encode()).hexdigest()
        return int(h[:8], 16)  # first 32 bits

    def _leading_zeros(self, value, max_bits):
        """Count leading zeros + 1 (the rank function)."""
        if value == 0:
            return max_bits + 1
        count = 1
        for i in range(max_bits - 1, -1, -1):
            if value & (1 << i):
                return count
            count += 1
        return count

    def add(self, item):
        """Add an item to the HyperLogLog."""
        h = self._hash(item)
        # First b bits select the register
        register_idx = h >> (32 - self.b)
        # Remaining bits used for leading zeros
        remaining = (h << self.b) & 0xFFFFFFFF
        rank = self._leading_zeros(remaining, 32 - self.b)
        self.registers[register_idx] = max(self.registers[register_idx], rank)

    def count(self):
        """Estimate the cardinality using harmonic mean."""
        harmonic_sum = sum(2.0 ** (-r) for r in self.registers)
        estimate = self.alpha * self.m * self.m / harmonic_sum

        # Small range correction (linear counting)
        if estimate <= 2.5 * self.m:
            zeros = self.registers.count(0)
            if zeros > 0:
                estimate = self.m * math.log(self.m / zeros)

        return int(estimate)

    def merge(self, other):
        """Merge another HLL into this one (max of each register).
        Perfect for distributed counting across servers!"""
        for i in range(self.m):
            self.registers[i] = max(self.registers[i], other.registers[i])

# --- Demo ---
import random
random.seed(42)

hll = HyperLogLog(b=10)  # 1024 registers
true_unique = set()

print("Streaming elements and tracking accuracy:")
print(f"{'Elements':>10} | {'True Unique':>12} | {'HLL Estimate':>12} | {'Error':>8}")
print("-" * 55)

for i in range(100_000):
    item = random.randint(0, 200_000)
    hll.add(item)
    true_unique.add(item)

    if (i + 1) % 10_000 == 0:
        est = hll.count()
        actual = len(true_unique)
        error = abs(est - actual) / actual * 100
        print(f"{i+1:>10} | {actual:>12,} | {est:>12,} | {error:>6.1f}%")

print(f"\\nMemory: {hll.m} registers = {hll.m} bytes")
print(f"Standard error: {1.04 / math.sqrt(hll.m) * 100:.1f}%")

# Demo: merging HLLs from different servers
hll_server_a = HyperLogLog(b=10)
hll_server_b = HyperLogLog(b=10)

for i in range(50_000):
    hll_server_a.add(f"user_a_{random.randint(0, 100_000)}")

for i in range(50_000):
    hll_server_b.add(f"user_b_{random.randint(0, 100_000)}")

# Merge!
hll_server_a.merge(hll_server_b)
print(f"\\n--- Merging Demo ---")
print(f"Server A estimate: ~{hll_server_a.count():,} unique users across both servers")`

const pythonHLLComparison = `import hashlib, math, sys, random, time

class MiniHLL:
    """Compact HyperLogLog for benchmarking."""
    def __init__(self, b=10):
        self.b = b
        self.m = 1 << b
        self.registers = bytearray(self.m)  # 1 byte per register
        self.alpha = 0.7213 / (1 + 1.079 / self.m) if self.m >= 128 else 0.709

    def add(self, item):
        h = hash(str(item)) & 0xFFFFFFFF
        idx = h >> (32 - self.b)
        remaining = (h << self.b) & 0xFFFFFFFF
        rank = 1
        for i in range(31 - self.b, -1, -1):
            if remaining & (1 << i): break
            rank += 1
        if rank > self.registers[idx]:
            self.registers[idx] = rank

    def count(self):
        harmonic = sum(2.0 ** (-r) for r in self.registers)
        est = self.alpha * self.m * self.m / harmonic
        if est <= 2.5 * self.m:
            zeros = self.registers.count(0)
            if zeros > 0:
                est = self.m * math.log(self.m / zeros)
        return int(est)

random.seed(42)

# --- Experiment: stream elements and compare ---
N = 200_000
hll = MiniHLL(b=10)       # 1024 registers = 1 KB
exact_set = set()

print("Streaming 200K unique values:")
print(f"{'Count':>8} | {'True':>8} | {'HLL Est':>8} | {'Error%':>7} | {'Set Size':>10} | {'HLL Size':>10}")
print("-" * 70)

for i in range(N):
    val = random.randint(0, 1_000_000)
    hll.add(val)
    exact_set.add(val)

    if (i + 1) % 20_000 == 0:
        est = hll.count()
        actual = len(exact_set)
        err = abs(est - actual) / actual * 100

        # Memory estimation
        # Python set: ~50-80 bytes per element (PyObject + hash table overhead)
        set_bytes = sys.getsizeof(exact_set)
        hll_bytes = hll.m  # 1 byte per register

        set_kb = set_bytes / 1024
        hll_str = f"{hll_bytes} B" if hll_bytes < 1024 else f"{hll_bytes/1024:.1f} KB"
        set_str = f"{set_kb:.0f} KB" if set_kb < 1024 else f"{set_kb/1024:.1f} MB"

        print(f"{i+1:>8} | {actual:>8,} | {est:>8,} | {err:>5.1f}%  | {set_str:>10} | {hll_str:>10}")

print(f"\\n--- Final Memory Comparison ---")
print(f"HyperLogLog: {hll.m:,} bytes ({hll.m/1024:.1f} KB)")
print(f"Exact Set:   {sys.getsizeof(exact_set):,} bytes ({sys.getsizeof(exact_set)/1024:.0f} KB)")
print(f"Ratio:       HashSet uses {sys.getsizeof(exact_set) / hll.m:.0f}x more memory!")
print(f"\\nWith 16K registers (16 KB), you could count BILLIONS")
print(f"of unique elements with only ~0.8% error.")`

/* ------------------------------------------------------------------ */
/* Main lesson component                                               */
/* ------------------------------------------------------------------ */

export default function HyperLogLog() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Hero ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-3">
          HyperLogLog: Counting Unique Visitors
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          How do you count the number of unique visitors to a website that gets 100 million
          hits per day — without storing every visitor ID in memory? HyperLogLog is the
          probabilistic data structure that lets Redis, Google Analytics, and BigQuery do
          exactly this, using just a few kilobytes of memory to count billions of unique elements.
        </p>
      </header>

      {/* ---- Section 1: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Counting Unique Elements at Scale</h2>
        <p className="text-gray-300 leading-relaxed">
          Imagine you run a popular website. You want to answer a simple question: "How many
          unique users visited today?" Each visitor has a user ID (or cookie). You see 100
          million page views, but many users visit multiple times. You need the
          <span className="text-indigo-400 font-semibold"> cardinality</span> — the count of
          distinct elements in the stream.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This sounds trivial, but at scale it becomes a serious engineering problem.
          Real-world systems that face it include:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li><span className="text-yellow-400">Redis PFCOUNT</span> — count unique keys across millions of operations</li>
          <li><span className="text-yellow-400">Google Analytics</span> — unique visitors per day, per page, per country</li>
          <li><span className="text-yellow-400">BigQuery APPROX_COUNT_DISTINCT</span> — count distinct values in billion-row tables</li>
          <li><span className="text-yellow-400">Network monitoring</span> — count unique source IPs in a packet stream</li>
          <li><span className="text-yellow-400">Database query optimizers</span> — estimate column cardinality for join planning</li>
        </ul>
      </section>

      {/* ---- Section 2: Naive Approach ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Naive Approach: Just Use a Set</h2>
        <p className="text-gray-300 leading-relaxed">
          The obvious solution: maintain a <code className="text-pink-400">HashSet</code> of
          all user IDs you have seen. For each new visitor, insert into the set. At the end
          of the day, return <code className="text-pink-400">set.size()</code>.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This gives you an exact answer but the memory cost is devastating. If you have 50
          million unique visitors and each ID is a 16-byte UUID, you need at minimum 800 MB
          of raw ID storage — plus hash table overhead, bringing the real cost to 2-4 GB.
          And that is per counter. If you want unique visitors per page, per country, per
          referrer, you are looking at terabytes.
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-mono text-red-400 mb-2">Memory grows linearly:</h3>
          <p className="text-gray-400 text-sm font-mono">
            10M unique users x ~80 bytes/entry = ~800 MB<br />
            50M unique users x ~80 bytes/entry = ~4 GB<br />
            1B unique users x ~80 bytes/entry = ~80 GB
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          We need a data structure that gives us an <span className="text-green-400">approximate</span> count
          using <span className="text-green-400">constant memory</span>, regardless of how many unique
          elements we see.
        </p>
      </section>

      {/* ---- Section 3: The Key Insight ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Key Insight: Leading Zeros in Hashes</h2>
        <p className="text-gray-300 leading-relaxed">
          Hash each element to a uniformly random binary string. Now look at how many leading
          zeros each hash has. A good hash function produces each bit independently with 50/50
          probability, so:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li>A hash starting with <code className="text-cyan-400">0...</code> — happens with probability 1/2</li>
          <li>A hash starting with <code className="text-cyan-400">00...</code> — happens with probability 1/4</li>
          <li>A hash starting with <code className="text-cyan-400">000...</code> — happens with probability 1/8</li>
          <li>A hash starting with <code className="text-cyan-400">0000...</code> — probability 1/16</li>
          <li>In general, k leading zeros has probability 1/2^k</li>
        </ul>
        <p className="text-gray-300 leading-relaxed">
          Think of it like flipping coins. If you flip a coin and see 10 heads in a row, you
          would be surprised — that event has probability 1/1024. So you would guess that
          somebody has been flipping coins for a while. Specifically, if the longest run of
          heads you have ever seen is k, a good estimate of total flips is roughly 2^k.
        </p>
        <div className="bg-slate-800/60 border border-indigo-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-indigo-400 mb-2">The Core Idea</h3>
          <p className="text-gray-300 text-sm">
            If the maximum number of leading zeros we have seen across all hashed elements is k,
            then the estimated number of unique elements is approximately <span className="text-yellow-400 font-mono">2^k</span>.
            The more elements you hash, the more likely you are to see a long run of leading zeros.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          But using a single maximum is wildly inaccurate — a single lucky hash can throw off
          the estimate by a factor of 2. HyperLogLog fixes this by using many independent
          estimators (registers) and combining them with a harmonic mean.
        </p>
      </section>

      {/* ---- Section 4: How HyperLogLog Works ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How HyperLogLog Works</h2>
        <p className="text-gray-300 leading-relaxed">
          HyperLogLog uses <span className="text-yellow-400">m</span> registers (buckets). For
          each element:
        </p>
        <ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
          <li>
            <span className="text-white font-semibold">Hash</span> the element to a 32-bit
            (or 64-bit) integer
          </li>
          <li>
            <span className="text-white font-semibold">Select register</span> — use the
            first <code className="text-yellow-400">log2(m)</code> bits of the hash to pick
            which register to update
          </li>
          <li>
            <span className="text-white font-semibold">Count leading zeros</span> — in the
            remaining bits, count consecutive leading zeros and add 1. Call this the "rank"
          </li>
          <li>
            <span className="text-white font-semibold">Update register</span> — store the
            maximum rank seen in that register:
            <code className="text-cyan-400 ml-1">registers[j] = max(registers[j], rank)</code>
          </li>
        </ol>
        <p className="text-gray-300 leading-relaxed">
          The cardinality estimate combines all registers using a <span className="text-indigo-400">harmonic mean</span>:
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 font-mono text-sm text-center">
          <span className="text-yellow-400">E = alpha * m^2 / SUM(2^(-M[j]))</span>
          <p className="text-gray-500 text-xs mt-2 font-sans">
            where alpha is a bias correction constant, m is the number of registers,
            and M[j] is the value in register j
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The harmonic mean is crucial — it is much more robust to outliers than the arithmetic
          mean. A single register with an unusually high value does not skew the entire estimate.
        </p>
      </section>

      {/* ---- Interactive: Register Viz ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Watch the Registers Fill</h2>
        <p className="text-gray-300 leading-relaxed">
          Stream user IDs through a 16-register HyperLogLog. Watch each element get hashed,
          the register selected (yellow bits), and leading zeros counted (cyan bits). The
          estimate updates in real-time using the harmonic mean formula.
        </p>
        <RegisterSketch />
      </section>

      {/* ---- Section 5: Accuracy ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Accuracy and the Magic of More Registers</h2>
        <p className="text-gray-300 leading-relaxed">
          The standard error of HyperLogLog is <code className="text-yellow-400">1.04 / sqrt(m)</code>,
          where m is the number of registers. This means:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li><span className="text-white">16 registers (16 B)</span> — 26% error. Useful for rough ballpark only.</li>
          <li><span className="text-white">256 registers (256 B)</span> — 6.5% error. Decent for analytics.</li>
          <li><span className="text-white">1,024 registers (1 KB)</span> — 3.25% error. Good for most applications.</li>
          <li><span className="text-white">16,384 registers (16 KB)</span> — 0.81% error. This is what Redis uses.</li>
          <li><span className="text-white">65,536 registers (64 KB)</span> — 0.41% error. Production-grade precision.</li>
        </ul>
        <p className="text-gray-300 leading-relaxed">
          The stunning thing: 16 KB of memory gives you sub-1% error for counting
          <span className="text-green-400 font-semibold"> billions</span> of unique elements.
          A HashSet storing the same data would need gigabytes.
        </p>
        <AccuracySketch />
      </section>

      {/* ---- Memory Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Memory: Constant vs Linear</h2>
        <p className="text-gray-300 leading-relaxed">
          The core value proposition of HyperLogLog is that its memory is fixed regardless
          of input size. As the number of unique elements grows, a HashSet grows linearly
          while HyperLogLog stays flat. Watch the gap widen:
        </p>
        <MemorySketch />
      </section>

      {/* ---- Section 6: Merging ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Merging: Distributed Counting for Free</h2>
        <p className="text-gray-300 leading-relaxed">
          One of HyperLogLog's most powerful properties is that two HLLs can be merged by
          simply taking the <span className="text-green-400">maximum</span> of each
          corresponding register. If server A tracks West Coast visitors and server B tracks
          East Coast visitors, you can merge their HLLs to get the total unique visitor count
          across both regions — without double-counting users who visited both.
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 font-mono text-sm">
          <p className="text-gray-400 mb-2">// Merge is trivially parallelizable</p>
          <p className="text-cyan-400">merged[j] = max(hll_a[j], hll_b[j]) for each register j</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          This is why Redis supports <code className="text-pink-400">PFMERGE</code> — you can
          maintain per-hour HLLs and merge them to get daily, weekly, or monthly uniques.
          You cannot do this with a simple counter (that would overcount). With exact sets,
          merging requires union, which is expensive. With HLL, merging is O(m) — a few
          microseconds for 16K registers.
        </p>
      </section>

      {/* ---- Section 7: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Redis</h3>
            <p className="text-gray-400 text-sm">
              <code className="text-pink-400">PFADD mykey user123</code> — add element<br />
              <code className="text-pink-400">PFCOUNT mykey</code> — get cardinality estimate<br />
              <code className="text-pink-400">PFMERGE dest key1 key2</code> — merge HLLs<br />
              Uses 12 KB per key. Error rate: 0.81%.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">Google BigQuery</h3>
            <p className="text-gray-400 text-sm">
              <code className="text-cyan-400">APPROX_COUNT_DISTINCT(column)</code><br />
              Uses HLL++ (an improved variant) internally. Orders of magnitude faster than
              exact COUNT(DISTINCT ...) on billion-row tables.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Presto / Trino</h3>
            <p className="text-gray-400 text-sm">
              <code className="text-cyan-400">approx_distinct(column)</code><br />
              Used at Facebook, Uber, Netflix for interactive analytics on massive datasets.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Network Monitoring</h3>
            <p className="text-gray-400 text-sm">
              Count unique source IPs in a high-speed packet stream. Routers and switches use
              HLL-like structures to detect DDoS attacks (sudden cardinality spike in source IPs).
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python Cell 1: Full Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: HyperLogLog from Scratch</h2>
        <p className="text-gray-300 leading-relaxed">
          Build a complete HyperLogLog with hashing, register selection, leading zero counting,
          harmonic mean estimation, and merging. Run it against 100K elements and see the
          accuracy at every 10K step.
        </p>
        <PythonCell defaultCode={pythonHLLImplementation} />
      </section>

      {/* ---- Python Cell 2: Memory Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Experiment: Memory Savings in Practice</h2>
        <p className="text-gray-300 leading-relaxed">
          Stream 200K values and compare the memory footprint of a Python set versus a 1 KB
          HyperLogLog. Watch the memory diverge by orders of magnitude while the accuracy
          stays within a few percent.
        </p>
        <PythonCell defaultCode={pythonHLLComparison} />
      </section>

      {/* ---- Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
          <li>
            HyperLogLog estimates the number of unique elements in a stream using
            <span className="text-green-400"> O(1) memory</span> — independent of input size.
          </li>
          <li>
            The insight: hash elements to binary, count leading zeros. Longer runs of leading
            zeros imply more unique elements seen.
          </li>
          <li>
            Multiple registers + harmonic mean reduce variance from a single estimator.
          </li>
          <li>
            Standard error is <code className="text-yellow-400">1.04 / sqrt(m)</code>. With
            16K registers (16 KB), you get 0.81% error.
          </li>
          <li>
            Merging is trivial: take the max of each register. This enables distributed
            counting across servers, time windows, and dimensions.
          </li>
          <li>
            Used everywhere in production: Redis, BigQuery, Presto, Spark, network monitoring,
            database query optimizers.
          </li>
        </ul>
      </section>
    </div>
  )
}
