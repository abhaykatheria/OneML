import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/timing-wheel',
  title: 'Timing Wheels: Efficient Timer Management',
  description:
    'O(1) timer insertion and expiration using circular buffers — the data structure behind Kafka, Netty, and the Linux kernel timer system',
  track: 'datastructures',
  order: 16,
  tags: ['timing-wheel', 'timer', 'kafka', 'netty', 'kernel', 'scheduler', 'circular-buffer'],
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
/* Timing Wheel Data Structure                                         */
/* ------------------------------------------------------------------ */

interface Timer {
  id: number
  label: string
  expiresAt: number
  bucket: number
  color: [number, number, number]
}

interface TimingWheelState {
  buckets: Timer[][]
  size: number
  currentTick: number
  nextId: number
}

function createTimingWheel(size: number): TimingWheelState {
  const buckets: Timer[][] = []
  for (let i = 0; i < size; i++) {
    buckets.push([])
  }
  return { buckets, size, currentTick: 0, nextId: 1 }
}

function addTimer(wheel: TimingWheelState, delay: number, label: string): Timer {
  const expiresAt = wheel.currentTick + delay
  const bucket = expiresAt % wheel.size
  const colors: [number, number, number][] = [ACCENT, GREEN, YELLOW, PINK, CYAN, ORANGE]
  const timer: Timer = {
    id: wheel.nextId++,
    label,
    expiresAt,
    bucket,
    color: colors[wheel.nextId % colors.length],
  }
  wheel.buckets[bucket].push(timer)
  return timer
}

function advanceTick(wheel: TimingWheelState): Timer[] {
  wheel.currentTick++
  const bucket = wheel.currentTick % wheel.size
  const expired = wheel.buckets[bucket].filter(t => t.expiresAt <= wheel.currentTick)
  wheel.buckets[bucket] = wheel.buckets[bucket].filter(t => t.expiresAt > wheel.currentTick)
  return expired
}

function getTotalTimers(wheel: TimingWheelState): number {
  let count = 0
  for (const b of wheel.buckets) count += b.length
  return count
}

/* ------------------------------------------------------------------ */
/* Hierarchical Timing Wheel                                           */
/* ------------------------------------------------------------------ */

interface HierTimer {
  id: number
  label: string
  expiresAt: number
  color: [number, number, number]
}

interface HierWheel {
  buckets: HierTimer[][]
  size: number
  currentTick: number
  resolution: number  // ticks per bucket in this level
  name: string
}

interface HierTimingWheelState {
  wheels: HierWheel[]
  currentTick: number
  nextId: number
}

function createHierTimingWheel(): HierTimingWheelState {
  const seconds: HierWheel = { buckets: Array.from({ length: 10 }, () => []), size: 10, currentTick: 0, resolution: 1, name: 'Seconds' }
  const minutes: HierWheel = { buckets: Array.from({ length: 6 }, () => []), size: 6, currentTick: 0, resolution: 10, name: 'Minutes' }
  const hours: HierWheel = { buckets: Array.from({ length: 6 }, () => []), size: 6, currentTick: 0, resolution: 60, name: 'Hours' }
  return { wheels: [seconds, minutes, hours], currentTick: 0, nextId: 1 }
}

function hierAddTimer(state: HierTimingWheelState, delay: number, label: string): HierTimer {
  const expiresAt = state.currentTick + delay
  const colors: [number, number, number][] = [ACCENT, GREEN, YELLOW, PINK, CYAN, ORANGE]
  const timer: HierTimer = {
    id: state.nextId++,
    label,
    expiresAt,
    color: colors[state.nextId % colors.length],
  }
  // Place in the appropriate wheel level
  placeTimer(state, timer)
  return timer
}

function placeTimer(state: HierTimingWheelState, timer: HierTimer): void {
  const remaining = timer.expiresAt - state.currentTick
  if (remaining <= 0) return

  // Find the highest wheel level where this timer fits
  for (let i = state.wheels.length - 1; i >= 0; i--) {
    const wheel = state.wheels[i]
    if (remaining >= wheel.resolution) {
      const bucket = Math.floor((timer.expiresAt / wheel.resolution)) % wheel.size
      wheel.buckets[bucket].push(timer)
      return
    }
  }
  // Falls into the lowest wheel
  const wheel = state.wheels[0]
  const bucket = timer.expiresAt % wheel.size
  wheel.buckets[bucket].push(timer)
}

function hierAdvanceTick(state: HierTimingWheelState): HierTimer[] {
  state.currentTick++
  const expired: HierTimer[] = []

  // Advance lowest wheel
  const lowest = state.wheels[0]
  lowest.currentTick = state.currentTick
  const lowestBucket = state.currentTick % lowest.size
  const inBucket = lowest.buckets[lowestBucket]
  for (const t of inBucket) {
    if (t.expiresAt <= state.currentTick) {
      expired.push(t)
    }
  }
  lowest.buckets[lowestBucket] = inBucket.filter(t => t.expiresAt > state.currentTick)

  // Check if we need to cascade from higher wheels
  for (let i = 1; i < state.wheels.length; i++) {
    const wheel = state.wheels[i]
    if (state.currentTick % wheel.resolution === 0) {
      // Cascade: move timers from current bucket to lower wheels
      wheel.currentTick = state.currentTick
      const bucket = Math.floor(state.currentTick / wheel.resolution) % wheel.size
      const timers = wheel.buckets[bucket]
      wheel.buckets[bucket] = []
      for (const t of timers) {
        if (t.expiresAt <= state.currentTick) {
          expired.push(t)
        } else {
          placeTimer(state, t)
        }
      }
    }
  }

  return expired
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Simple Timing Wheel                         */
/* ------------------------------------------------------------------ */

function SimpleWheelSketch() {
  const WHEEL_SIZE = 12
  const [statusMsg, setStatusMsg] = useState('Add timers with different delays, then advance the tick')
  const [timerDelay, setTimerDelay] = useState(3)
  const [speed, setSpeed] = useState(0)  // 0 = manual, >0 = auto ticks per second

  const wheelRef = useRef<TimingWheelState>(createTimingWheel(WHEEL_SIZE))
  const expiredFlashRef = useRef<{ tick: number; timers: Timer[] }[]>([])
  const animRef = useRef(0)
  const autoTickRef = useRef(0)
  const speedRef = useRef(0)
  const timerDelayRef = useRef(timerDelay)

  const handleAddTimer = useCallback(() => {
    const delay = timerDelayRef.current
    const timer = addTimer(wheelRef.current, delay, `T${wheelRef.current.nextId - 1}`)
    setStatusMsg(`Added timer "${timer.label}" expiring at tick ${timer.expiresAt} (bucket ${timer.bucket})`)
    animRef.current = 30
  }, [])

  const handleAdvance = useCallback(() => {
    const expired = advanceTick(wheelRef.current)
    if (expired.length > 0) {
      expiredFlashRef.current.push({ tick: wheelRef.current.currentTick, timers: expired })
      if (expiredFlashRef.current.length > 5) expiredFlashRef.current.shift()
      setStatusMsg(
        `Tick ${wheelRef.current.currentTick}: fired ${expired.length} timer(s) — ${expired.map(t => t.label).join(', ')}`
      )
    } else {
      setStatusMsg(`Tick ${wheelRef.current.currentTick}: no timers expired`)
    }
  }, [])

  const handleAddRandom = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      const delay = 1 + Math.floor(Math.random() * WHEEL_SIZE)
      addTimer(wheelRef.current, delay, `T${wheelRef.current.nextId - 1}`)
    }
    setStatusMsg(`Added 5 random timers (${getTotalTimers(wheelRef.current)} total)`)
    animRef.current = 30
  }, [])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 520)
        p.textFont('monospace')
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        // Auto advance
        if (speedRef.current > 0) {
          autoTickRef.current++
          const interval = Math.floor(60 / speedRef.current)
          if (autoTickRef.current >= interval) {
            autoTickRef.current = 0
            const expired = advanceTick(wheelRef.current)
            if (expired.length > 0) {
              expiredFlashRef.current.push({ tick: wheelRef.current.currentTick, timers: expired })
              if (expiredFlashRef.current.length > 5) expiredFlashRef.current.shift()
            }
          }
        }

        p.background(...BG)

        // Grid
        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        const wheel = wheelRef.current
        const cx = 280
        const cy = 270
        const outerR = 180
        const innerR = 100

        // Draw wheel segments
        for (let i = 0; i < wheel.size; i++) {
          const angle1 = (i / wheel.size) * p.TWO_PI - p.HALF_PI
          const angle2 = ((i + 1) / wheel.size) * p.TWO_PI - p.HALF_PI
          const isCurrent = i === wheel.currentTick % wheel.size
          const timers = wheel.buckets[i]

          // Segment fill
          if (isCurrent) {
            p.fill(99, 102, 241, 60)
          } else if (timers.length > 0) {
            p.fill(30, 41, 59, 200)
          } else {
            p.fill(20, 30, 48, 150)
          }

          p.stroke(isCurrent ? ACCENT : GRID_C)
          p.strokeWeight(isCurrent ? 2 : 1)
          p.beginShape()
          p.vertex(cx + Math.cos(angle1) * innerR, cy + Math.sin(angle1) * innerR)
          p.vertex(cx + Math.cos(angle1) * outerR, cy + Math.sin(angle1) * outerR)
          // Arc approximation
          const steps = 8
          for (let s = 0; s <= steps; s++) {
            const a = angle1 + (angle2 - angle1) * (s / steps)
            p.vertex(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
          }
          p.vertex(cx + Math.cos(angle2) * innerR, cy + Math.sin(angle2) * innerR)
          for (let s = steps; s >= 0; s--) {
            const a = angle1 + (angle2 - angle1) * (s / steps)
            p.vertex(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
          }
          p.endShape(p.CLOSE)

          // Bucket label
          const midAngle = (angle1 + angle2) / 2
          p.noStroke()
          p.fill(isCurrent ? ACCENT : TEXT_C)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${i}`, cx + Math.cos(midAngle) * (innerR - 15), cy + Math.sin(midAngle) * (innerR - 15))

          // Draw timers as dots in the bucket
          for (let j = 0; j < timers.length; j++) {
            const t = timers[j]
            const dotR = innerR + 20 + j * 18
            if (dotR > outerR - 10) continue
            const dotAngle = midAngle + (j - timers.length / 2) * 0.04
            const dx = cx + Math.cos(dotAngle) * dotR
            const dy = cy + Math.sin(dotAngle) * dotR

            p.fill(...t.color)
            p.noStroke()
            p.ellipse(dx, dy, 12, 12)
            p.fill(255)
            p.textSize(7)
            p.text(t.label, dx, dy)
          }
        }

        // Draw clock hand
        const handAngle = ((wheel.currentTick % wheel.size) / wheel.size) * p.TWO_PI - p.HALF_PI
        p.stroke(...RED)
        p.strokeWeight(3)
        p.line(cx, cy, cx + Math.cos(handAngle) * (innerR + 10), cy + Math.sin(handAngle) * (innerR + 10))

        // Center circle
        p.fill(...BG)
        p.stroke(...ACCENT)
        p.strokeWeight(2)
        p.ellipse(cx, cy, 50, 50)
        p.noStroke()
        p.fill(...CYAN)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${wheel.currentTick}`, cx, cy)

        // Title
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Simple Timing Wheel', 20, 15)
        p.textSize(11)
        p.text(`Tick: ${wheel.currentTick}  |  Active: ${getTotalTimers(wheel)}  |  Buckets: ${wheel.size}`, 20, 35)

        // Expired timers log (right side)
        const logX = 530
        const logY = 60
        p.fill(...ORANGE)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Expired Timers:', logX, logY)

        for (let i = expiredFlashRef.current.length - 1; i >= 0; i--) {
          const entry = expiredFlashRef.current[i]
          const y = logY + 20 + (expiredFlashRef.current.length - 1 - i) * 28
          const age = wheel.currentTick - entry.tick
          ctx.globalAlpha = Math.max(0.3, 1 - age * 0.1)
          p.fill(...TEXT_C)
          p.textSize(10)
          p.text(`Tick ${entry.tick}: ${entry.timers.map(t => t.label).join(', ')}`, logX, y)
          ctx.globalAlpha = 1.0
        }

        // How it works explanation
        p.fill(...TEXT_C)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        const explanY = 400
        p.fill(...GREEN)
        p.text('Insert: bucket = (currentTick + delay) % wheelSize', logX, explanY)
        p.fill(...YELLOW)
        p.text('Advance: check bucket at currentTick % wheelSize', logX, explanY + 16)
        p.fill(...RED)
        p.text('Fire all expired timers in that bucket', logX, explanY + 32)

        if (animRef.current > 0) animRef.current--
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-gray-400">
          Delay:
          <input
            type="range"
            min={1}
            max={WHEEL_SIZE}
            value={timerDelay}
            onChange={e => { const v = parseInt(e.target.value); setTimerDelay(v); timerDelayRef.current = v }}
            className="ml-2 align-middle"
          />
          <span className="ml-1 text-cyan-400">{timerDelay}</span>
        </label>
        <button onClick={handleAddTimer} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          Add Timer
        </button>
        <button onClick={handleAddRandom} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded">
          +5 Random
        </button>
        <button onClick={handleAdvance} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded">
          Advance Tick
        </button>
        <label className="text-sm text-gray-400">
          Auto:
          <input
            type="range"
            min={0}
            max={10}
            value={speed}
            onChange={e => { const v = parseInt(e.target.value); setSpeed(v); speedRef.current = v }}
            className="ml-2 align-middle"
          />
          <span className="ml-1 text-cyan-400">{speed === 0 ? 'Off' : `${speed}/s`}</span>
        </label>
      </div>
      <div className="text-sm text-gray-400">{statusMsg}</div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Hierarchical Timing Wheel                               */
/* ------------------------------------------------------------------ */

function HierWheelSketch() {
  const [statusMsg, setStatusMsg] = useState('Add timers with large delays to see hierarchical cascading')
  const [speed, setSpeed] = useState(0)

  const stateRef = useRef<HierTimingWheelState>(createHierTimingWheel())
  const expiredRef = useRef<{ tick: number; timers: HierTimer[] }[]>([])
  const cascadeFlashRef = useRef(0)
  const autoTickRef = useRef(0)
  const speedRef = useRef(0)

  const handleAdd = useCallback((delay: number) => {
    const timer = hierAddTimer(stateRef.current, delay, `T${stateRef.current.nextId - 1}`)
    setStatusMsg(`Added timer "${timer.label}" expiring at tick ${timer.expiresAt} (delay=${delay})`)
  }, [])

  const handleAdvance = useCallback(() => {
    const expired = hierAdvanceTick(stateRef.current)
    if (stateRef.current.currentTick % 10 === 0) {
      cascadeFlashRef.current = 30
    }
    if (expired.length > 0) {
      expiredRef.current.push({ tick: stateRef.current.currentTick, timers: expired })
      if (expiredRef.current.length > 8) expiredRef.current.shift()
      setStatusMsg(`Tick ${stateRef.current.currentTick}: fired ${expired.map(t => t.label).join(', ')}`)
    }
  }, [])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 500)
        p.textFont('monospace')
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        // Auto advance
        if (speedRef.current > 0) {
          autoTickRef.current++
          const interval = Math.floor(60 / speedRef.current)
          if (autoTickRef.current >= interval) {
            autoTickRef.current = 0
            const expired = hierAdvanceTick(stateRef.current)
            if (stateRef.current.currentTick % 10 === 0) cascadeFlashRef.current = 30
            if (expired.length > 0) {
              expiredRef.current.push({ tick: stateRef.current.currentTick, timers: expired })
              if (expiredRef.current.length > 8) expiredRef.current.shift()
            }
          }
        }

        p.background(...BG)

        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        const state = stateRef.current
        const wheelColors: [number, number, number][] = [CYAN, ORANGE, PINK]

        // Draw each wheel level
        for (let w = 0; w < state.wheels.length; w++) {
          const wheel = state.wheels[w]
          const cx = 150 + w * 230
          const cy = 230
          const outerR = 90
          const innerR = 50
          const col = wheelColors[w]

          // Wheel label
          p.noStroke()
          p.fill(...col)
          p.textSize(13)
          p.textAlign(p.CENTER, p.TOP)
          p.text(`${wheel.name} (res=${wheel.resolution})`, cx, 60)

          // Draw buckets
          for (let i = 0; i < wheel.size; i++) {
            const angle1 = (i / wheel.size) * p.TWO_PI - p.HALF_PI
            const angle2 = ((i + 1) / wheel.size) * p.TWO_PI - p.HALF_PI
            const bucketIdx = Math.floor(state.currentTick / wheel.resolution) % wheel.size
            const isCurrent = i === bucketIdx
            const timers = wheel.buckets[i]

            if (isCurrent) {
              p.fill(col[0], col[1], col[2], 40)
              p.stroke(...col)
              p.strokeWeight(2)
            } else {
              p.fill(20, 30, 48, 150)
              p.stroke(...GRID_C)
              p.strokeWeight(1)
            }

            p.beginShape()
            p.vertex(cx + Math.cos(angle1) * innerR, cy + Math.sin(angle1) * innerR)
            p.vertex(cx + Math.cos(angle1) * outerR, cy + Math.sin(angle1) * outerR)
            const steps = 6
            for (let s = 0; s <= steps; s++) {
              const a = angle1 + (angle2 - angle1) * (s / steps)
              p.vertex(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
            }
            p.vertex(cx + Math.cos(angle2) * innerR, cy + Math.sin(angle2) * innerR)
            for (let s = steps; s >= 0; s--) {
              const a = angle1 + (angle2 - angle1) * (s / steps)
              p.vertex(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
            }
            p.endShape(p.CLOSE)

            // Bucket label
            const midAngle = (angle1 + angle2) / 2
            p.noStroke()
            p.fill(isCurrent ? col : TEXT_C)
            p.textSize(9)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${i}`, cx + Math.cos(midAngle) * (innerR - 12), cy + Math.sin(midAngle) * (innerR - 12))

            // Timer dots
            for (let j = 0; j < Math.min(timers.length, 3); j++) {
              const t = timers[j]
              const dotR = innerR + 15 + j * 14
              if (dotR > outerR - 5) continue
              p.fill(...t.color)
              p.noStroke()
              p.ellipse(cx + Math.cos(midAngle) * dotR, cy + Math.sin(midAngle) * dotR, 10, 10)
            }
            if (timers.length > 3) {
              p.fill(...TEXT_C)
              p.textSize(7)
              p.text(`+${timers.length - 3}`, cx + Math.cos(midAngle) * (outerR - 8), cy + Math.sin(midAngle) * (outerR - 8))
            }
          }

          // Clock hand
          const handBucket = Math.floor(state.currentTick / wheel.resolution) % wheel.size
          const handAngle = ((handBucket + 0.5) / wheel.size) * p.TWO_PI - p.HALF_PI
          p.stroke(...RED)
          p.strokeWeight(2)
          p.line(cx, cy, cx + Math.cos(handAngle) * (innerR + 5), cy + Math.sin(handAngle) * (innerR + 5))

          // Center
          p.fill(...BG)
          p.stroke(...col)
          p.strokeWeight(1.5)
          p.ellipse(cx, cy, 30, 30)
          p.noStroke()
          p.fill(...col)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${Math.floor(state.currentTick / wheel.resolution) % wheel.size}`, cx, cy)

          // Cascade arrow
          if (w < state.wheels.length - 1) {
            const arrowX = cx + outerR + 20
            p.stroke(cascadeFlashRef.current > 0 && w === 0 ? YELLOW : GRID_C)
            p.strokeWeight(cascadeFlashRef.current > 0 && w === 0 ? 2 : 1)
            ctx.setLineDash([4, 4])
            p.line(arrowX, cy, arrowX + 20, cy)
            ctx.setLineDash([])
            p.noStroke()
            p.fill(cascadeFlashRef.current > 0 && w === 0 ? YELLOW : TEXT_C)
            p.textSize(8)
            p.textAlign(p.CENTER, p.BOTTOM)
            p.text('cascade', arrowX + 10, cy - 5)
          }
        }

        if (cascadeFlashRef.current > 0) cascadeFlashRef.current--

        // Title and info
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Hierarchical Timing Wheel', 20, 15)
        p.textSize(11)
        p.text(`Global tick: ${state.currentTick}`, 20, 35)

        // Expired log
        const logY = 370
        p.fill(...ORANGE)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Recent Expirations:', 20, logY)
        for (let i = expiredRef.current.length - 1; i >= Math.max(0, expiredRef.current.length - 6); i--) {
          const entry = expiredRef.current[i]
          const row = expiredRef.current.length - 1 - i
          const age = state.currentTick - entry.tick
          ctx.globalAlpha = Math.max(0.3, 1 - age * 0.05)
          p.fill(...TEXT_C)
          p.textSize(9)
          p.text(`Tick ${entry.tick}: ${entry.timers.map(t => `${t.label}(exp=${t.expiresAt})`).join(', ')}`, 30, logY + 18 + row * 16)
          ctx.globalAlpha = 1.0
        }
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => handleAdd(3)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded">
          +3 ticks
        </button>
        <button onClick={() => handleAdd(8)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded">
          +8 ticks
        </button>
        <button onClick={() => handleAdd(25)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded">
          +25 ticks
        </button>
        <button onClick={() => handleAdd(55)} className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-sm rounded">
          +55 ticks
        </button>
        <button onClick={() => handleAdd(120)} className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-sm rounded">
          +120 ticks
        </button>
        <button onClick={handleAdvance} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded">
          Advance
        </button>
        <label className="text-sm text-gray-400">
          Auto:
          <input
            type="range"
            min={0}
            max={15}
            value={speed}
            onChange={e => { const v = parseInt(e.target.value); setSpeed(v); speedRef.current = v }}
            className="ml-2 align-middle"
          />
          <span className="ml-1 text-cyan-400">{speed === 0 ? 'Off' : `${speed}/s`}</span>
        </label>
      </div>
      <div className="text-sm text-gray-400">{statusMsg}</div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Code                                                         */
/* ------------------------------------------------------------------ */

const timingWheelImpl = `class TimingWheel:
    """Simple timing wheel with O(1) insert and O(1) per-tick expiration."""

    def __init__(self, size=60):
        self.size = size
        self.buckets = [[] for _ in range(size)]
        self.current_tick = 0
        self.next_id = 1

    def add_timer(self, delay, callback_name=""):
        """Add a timer that fires after 'delay' ticks. O(1)."""
        expires_at = self.current_tick + delay
        bucket = expires_at % self.size
        timer = {
            'id': self.next_id,
            'label': callback_name or f"timer_{self.next_id}",
            'expires_at': expires_at,
            'bucket': bucket,
        }
        self.next_id += 1
        self.buckets[bucket].append(timer)
        return timer

    def cancel_timer(self, timer):
        """Cancel a timer. O(n) in the bucket, but buckets are small."""
        bucket = timer['bucket']
        self.buckets[bucket] = [t for t in self.buckets[bucket] if t['id'] != timer['id']]

    def advance_tick(self):
        """Advance one tick and return expired timers. O(1) amortized."""
        self.current_tick += 1
        bucket = self.current_tick % self.size
        expired = [t for t in self.buckets[bucket] if t['expires_at'] <= self.current_tick]
        self.buckets[bucket] = [t for t in self.buckets[bucket] if t['expires_at'] > self.current_tick]
        return expired

    def get_expired(self):
        """Check current bucket without advancing."""
        bucket = self.current_tick % self.size
        return [t for t in self.buckets[bucket] if t['expires_at'] <= self.current_tick]

    def total_timers(self):
        return sum(len(b) for b in self.buckets)

# --- Demo ---
wheel = TimingWheel(size=12)
print(f"Timing wheel with {wheel.size} buckets")
print()

# Add timers
timers = []
for delay in [3, 5, 3, 7, 12, 1, 8]:
    t = wheel.add_timer(delay, f"conn_timeout_{delay}s")
    timers.append(t)
    print(f"  Added '{t['label']}' -> bucket {t['bucket']} (expires at tick {t['expires_at']})")

print(f"\\nTotal active timers: {wheel.total_timers()}")
print()

# Cancel one timer
cancelled = timers[2]
wheel.cancel_timer(cancelled)
print(f"Cancelled '{cancelled['label']}'")
print(f"Total active timers: {wheel.total_timers()}")
print()

# Advance through ticks
print("Advancing ticks:")
for _ in range(15):
    expired = wheel.advance_tick()
    if expired:
        names = [t['label'] for t in expired]
        print(f"  Tick {wheel.current_tick}: FIRED {names}")
    else:
        print(f"  Tick {wheel.current_tick}: (no expirations)")

print(f"\\nRemaining timers: {wheel.total_timers()}")
`

const hierWheelImpl = `import time
import heapq

class HierarchicalTimingWheel:
    """
    Three-level timing wheel: seconds (10 buckets), minutes (6 buckets), hours (6 buckets).
    Timers cascade from higher wheels to lower ones as time advances.
    """

    def __init__(self):
        self.wheels = [
            {'name': 'seconds', 'size': 10, 'resolution': 1, 'buckets': [[] for _ in range(10)]},
            {'name': 'minutes', 'size': 6, 'resolution': 10, 'buckets': [[] for _ in range(6)]},
            {'name': 'hours',   'size': 6, 'resolution': 60, 'buckets': [[] for _ in range(6)]},
        ]
        self.current_tick = 0
        self.next_id = 1

    def add_timer(self, delay, label=""):
        expires_at = self.current_tick + delay
        timer = {'id': self.next_id, 'label': label or f"T{self.next_id}", 'expires_at': expires_at}
        self.next_id += 1
        self._place(timer)
        return timer

    def _place(self, timer):
        remaining = timer['expires_at'] - self.current_tick
        if remaining <= 0:
            return
        # Place in highest appropriate wheel
        for w in reversed(self.wheels):
            if remaining >= w['resolution']:
                bucket = (timer['expires_at'] // w['resolution']) % w['size']
                w['buckets'][bucket].append(timer)
                return
        # Default: lowest wheel
        bucket = timer['expires_at'] % self.wheels[0]['size']
        self.wheels[0]['buckets'][bucket].append(timer)

    def advance_tick(self):
        self.current_tick += 1
        expired = []

        # Check lowest wheel
        w0 = self.wheels[0]
        bucket_idx = self.current_tick % w0['size']
        ready = [t for t in w0['buckets'][bucket_idx] if t['expires_at'] <= self.current_tick]
        w0['buckets'][bucket_idx] = [t for t in w0['buckets'][bucket_idx] if t['expires_at'] > self.current_tick]
        expired.extend(ready)

        # Cascade from higher wheels when their tick boundary is crossed
        for i in range(1, len(self.wheels)):
            w = self.wheels[i]
            if self.current_tick % w['resolution'] == 0:
                bucket_idx = (self.current_tick // w['resolution']) % w['size']
                cascade = w['buckets'][bucket_idx]
                w['buckets'][bucket_idx] = []
                for t in cascade:
                    if t['expires_at'] <= self.current_tick:
                        expired.append(t)
                    else:
                        self._place(t)
        return expired

    def total_timers(self):
        return sum(len(b) for w in self.wheels for b in w['buckets'])

    def status(self):
        for w in self.wheels:
            counts = [len(b) for b in w['buckets']]
            print(f"  {w['name']:8s} (res={w['resolution']:2d}): {counts}")


# --- Demo: Hierarchical Timing Wheel ---
print("=== Hierarchical Timing Wheel ===\\n")
hw = HierarchicalTimingWheel()

# Add timers at various delays
for delay, label in [(3, "quick_3"), (8, "short_8"), (15, "medium_15"),
                      (35, "long_35"), (55, "longer_55"), (90, "very_long_90")]:
    t = hw.add_timer(delay, label)
    print(f"Added '{label}' expiring at tick {t['expires_at']}")

print(f"\\nWheel state:")
hw.status()
print(f"Total timers: {hw.total_timers()}")

# Advance and show cascading
print("\\n--- Advancing 100 ticks ---")
for _ in range(100):
    expired = hw.advance_tick()
    if expired:
        names = [f"{t['label']}(exp={t['expires_at']})" for t in expired]
        print(f"  Tick {hw.current_tick}: FIRED {names}")
    if hw.current_tick % 10 == 0 and hw.current_tick <= 60:
        print(f"  [Tick {hw.current_tick} - cascade check] Timers remaining: {hw.total_timers()}")


# --- Benchmark: Timing Wheel vs Heap ---
print("\\n=== Benchmark: Timing Wheel vs Heap-based Timer ===\\n")

import random
random.seed(42)
N = 5000

# Timing Wheel
tw = HierarchicalTimingWheel()
t0 = time.time()
for i in range(N):
    tw.add_timer(random.randint(1, 300), f"tw_{i}")
tw_insert_time = time.time() - t0

t0 = time.time()
tw_fired = 0
for _ in range(300):
    expired = tw.advance_tick()
    tw_fired += len(expired)
tw_advance_time = time.time() - t0

# Heap-based timer queue
heap = []
t0 = time.time()
for i in range(N):
    delay = random.randint(1, 300)
    heapq.heappush(heap, (delay, i, f"heap_{i}"))
heap_insert_time = time.time() - t0

t0 = time.time()
heap_fired = 0
for tick in range(1, 301):
    while heap and heap[0][0] <= tick:
        heapq.heappop(heap)
        heap_fired += 1
heap_advance_time = time.time() - t0

print(f"Timers: {N}, Ticks: 300")
print(f"Timing Wheel: insert={tw_insert_time*1000:.1f}ms, advance={tw_advance_time*1000:.1f}ms, fired={tw_fired}")
print(f"Heap Queue:   insert={heap_insert_time*1000:.1f}ms, advance={heap_advance_time*1000:.1f}ms, fired={heap_fired}")
print(f"\\nTiming wheel insert is O(1), heap insert is O(log n).")
print(f"For 100K+ timers, the timing wheel advantage is significant.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function TimingWheel() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      {/* ---- Hero ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          A web server with 100,000 active connections needs a timeout timer for each one. When a connection
          goes idle, its timer fires and the server closes it. Adding, canceling, and firing these timers must
          be blazing fast. A <strong className="text-indigo-400">timing wheel</strong> achieves O(1) insert
          and O(1) per-tick expiration by mapping timers into a circular array of buckets — like the face of a clock.
        </p>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-sm">
            <strong>Why not a heap?</strong> A min-heap gives O(log n) insert and O(log n) pop.
            With 100K timers, that is 17 comparisons per operation. A timing wheel does both in O(1).
            At 10K timer operations per second, the difference matters. Kafka, Netty, and the Linux
            kernel all use timing wheels for exactly this reason.
          </p>
        </div>
      </section>

      {/* ---- Section 1: Simple Timing Wheel ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Timing Wheel</h2>
        <p className="text-gray-300 leading-relaxed">
          The wheel has 12 buckets (like a clock face). Each timer is placed in the bucket corresponding
          to its expiration tick: <code className="text-cyan-400">bucket = (currentTick + delay) % wheelSize</code>.
          The red hand advances one tick at a time. When it reaches a bucket, all expired timers in that
          bucket fire.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Add timers with different delays and watch them appear in the appropriate buckets. Then advance
          the tick (manually or with the auto slider) and watch timers fire as the hand reaches them.
        </p>
        <SimpleWheelSketch />
      </section>

      {/* ---- Section 2: How It Works ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How Timing Wheels Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-green-400 mb-2">Add Timer: O(1)</h3>
            <p className="text-gray-300 text-sm">
              Compute the target bucket: <code className="text-green-400">(current + delay) % size</code>.
              Append the timer to that bucket&apos;s list. No sorting, no comparisons, no tree traversal.
              This is why timing wheels beat heaps for high-throughput systems.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-yellow-400 mb-2">Advance Tick: O(1) amortized</h3>
            <p className="text-gray-300 text-sm">
              Increment the tick counter. Check the bucket at <code className="text-yellow-400">tick % size</code>.
              Fire all timers whose expiration time has passed. Each timer is checked exactly once when its
              bucket is visited, giving O(1) amortized cost per timer.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-pink-400 mb-2">Cancel Timer: O(1)*</h3>
            <p className="text-gray-300 text-sm">
              Mark the timer as cancelled (lazy deletion). When the bucket is visited, skip cancelled timers.
              This avoids the O(n) cost of searching the bucket. With doubly-linked lists, true O(1) removal
              is possible by keeping a direct reference to the timer node.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Limitation: Range</h3>
            <p className="text-gray-300 text-sm">
              A wheel with N buckets and tick interval T can only handle delays up to N*T. A 60-bucket
              wheel with 1-second ticks covers at most 60 seconds. For longer timeouts, you need
              hierarchical wheels or a larger wheel.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 3: Hierarchical Wheel ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hierarchical Timing Wheels</h2>
        <p className="text-gray-300 leading-relaxed">
          For long timeouts, use multiple wheels at different resolutions — like the seconds, minutes, and
          hours hands on a clock. The seconds wheel (resolution=1) handles short timers. When it completes
          a full revolution, the minutes wheel (resolution=10) advances, and timers from its current bucket
          <strong className="text-yellow-400"> cascade</strong> down to the seconds wheel.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is how Kafka implements delayed messages: a hierarchy of timing wheels handles delays from
          milliseconds to hours without needing millions of buckets. The cascade operation moves at most
          one bucket of timers per revolution, keeping the amortized cost O(1).
        </p>
        <HierWheelSketch />
      </section>

      {/* ---- Section 4: Real World ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Apache Kafka</h3>
            <p className="text-gray-300 text-sm">
              Kafka uses a hierarchical timing wheel for delayed message delivery and request timeout
              management. With millions of in-flight produce/fetch requests, each needing a timeout,
              O(1) timer operations are essential. Kafka&apos;s{' '}
              <code className="text-cyan-400">SystemTimer</code> class implements this with a 20-bucket
              wheel cascading at increasing intervals.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Netty HashedWheelTimer</h3>
            <p className="text-gray-300 text-sm">
              Netty (the Java networking framework used by millions of servers) provides{' '}
              <code className="text-cyan-400">HashedWheelTimer</code> as its default timer implementation.
              It uses a single wheel with configurable size and tick duration. Used for connection timeouts,
              keep-alive checks, and scheduled tasks.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Linux Kernel</h3>
            <p className="text-gray-300 text-sm">
              The Linux kernel timer subsystem uses a hierarchical timing wheel with 5 levels
              (called &quot;timer vectors&quot;). It manages all kernel timers: TCP retransmission,
              scheduler time slices, device timeouts, and more. The design handles timers from
              microseconds to hours efficiently.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">TCP Retransmission</h3>
            <p className="text-gray-300 text-sm">
              Every unacknowledged TCP packet has a retransmission timer. A busy server may have millions
              of outstanding packets. When an ACK arrives, the timer is cancelled (O(1)). When the timer
              fires, the packet is retransmitted. Timing wheels make this manageable at scale.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: Simple Timing Wheel ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: Simple Timing Wheel</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete timing wheel implementation with add, cancel, and advance operations.
          The demo adds timers, cancels one, and advances through all ticks to show firing behavior.
        </p>
        <PythonCell defaultCode={timingWheelImpl} />
      </section>

      {/* ---- Python: Hierarchical + Benchmark ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: Hierarchical Wheel + Heap Benchmark</h2>
        <p className="text-gray-300 leading-relaxed">
          A hierarchical timing wheel with cascade logic, compared against Python&apos;s heapq-based
          timer queue. The benchmark inserts 5000 timers and advances 300 ticks, measuring insert
          and advance time for both approaches.
        </p>
        <PythonCell defaultCode={hierWheelImpl} />
      </section>

      {/* ---- Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">Timing Wheel</th>
                <th className="text-left py-2 pr-4 text-white">Min-Heap</th>
                <th className="text-left py-2 text-white">Sorted List</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Add timer</td>
                <td className="py-2 pr-4 text-emerald-400">O(1)</td>
                <td className="py-2 pr-4 text-yellow-400">O(log n)</td>
                <td className="py-2 text-red-400">O(n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Cancel timer</td>
                <td className="py-2 pr-4 text-emerald-400">O(1)*</td>
                <td className="py-2 pr-4 text-red-400">O(n)</td>
                <td className="py-2 text-red-400">O(n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Fire expired</td>
                <td className="py-2 pr-4 text-emerald-400">O(1) amortized</td>
                <td className="py-2 pr-4 text-yellow-400">O(k log n)</td>
                <td className="py-2 text-emerald-400">O(k)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space</td>
                <td className="py-2 pr-4">O(n + W)</td>
                <td className="py-2 pr-4">O(n)</td>
                <td className="py-2">O(n)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Max delay</td>
                <td className="py-2 pr-4 text-yellow-400">Limited by wheel size</td>
                <td className="py-2 pr-4 text-emerald-400">Unbounded</td>
                <td className="py-2 text-emerald-400">Unbounded</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-sm italic">n = total timers, k = expired timers per tick, W = wheel size. *O(1) with lazy deletion or doubly-linked list</p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Timing wheels map timers into a circular bucket array: insert is O(1) using modular arithmetic</li>
          <li>Advancing one tick checks one bucket, firing all expired timers in O(1) amortized time</li>
          <li>Hierarchical wheels extend the range by cascading timers from coarse-grained wheels to fine-grained ones</li>
          <li>The cascade operation is the key insight: timers are placed approximately at first, then refined as time approaches</li>
          <li>Kafka, Netty, and the Linux kernel all use timing wheels for managing millions of concurrent timers</li>
          <li>Trade-off: timing wheels use more memory (empty buckets) but provide O(1) operations that heaps cannot match</li>
        </ul>
      </section>
    </div>
  )
}
