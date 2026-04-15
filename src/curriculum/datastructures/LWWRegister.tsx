import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/lww-register',
  title: 'LWW-Register: Last Writer Wins',
  description:
    'Conflict resolution in distributed systems using timestamps — how replicas converge when concurrent writes happen across datacenters',
  track: 'datastructures',
  order: 5,
  tags: [
    'lww-register',
    'crdt',
    'distributed',
    'conflict-resolution',
    'replication',
    'cassandra',
  ],
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

const NODE_COLORS: [number, number, number][] = [ACCENT, PINK, GREEN]
const NODE_LABELS = ['Phone', 'Laptop', 'Cloud']

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Register {
  value: string
  timestamp: number
}

interface SyncEvent {
  from: number
  to: number
  frame: number
}

/* ------------------------------------------------------------------ */
/* Section 1 — LWW Register: 3-Node Interactive Sketch                 */
/* ------------------------------------------------------------------ */

function LWWRegisterSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const registersRef = useRef<Register[]>([
    { value: 'Alice', timestamp: 0 },
    { value: 'Alice', timestamp: 0 },
    { value: 'Alice', timestamp: 0 },
  ])

  const eventsRef = useRef<string[]>(['Initial state: all nodes have value "Alice" at t=0'])
  const syncAnimRef = useRef<SyncEvent | null>(null)
  const animFrameRef = useRef(0)

  const steps = [
    { action: 'init', desc: 'All nodes start with "Alice" at t=0' },
    { action: 'write', node: 0, value: 'Bob', ts: 10, desc: 'Phone writes "Bob" at t=10' },
    { action: 'write', node: 1, value: 'Carol', ts: 15, desc: 'Laptop writes "Carol" at t=15' },
    { action: 'write', node: 2, value: 'Dave', ts: 8, desc: 'Cloud writes "Dave" at t=8 (clock is behind!)' },
    { action: 'sync', from: 0, to: 2, desc: 'Sync Phone -> Cloud: Cloud sees (Bob, t=10), keeps it because 10 > 8' },
    { action: 'sync', from: 1, to: 2, desc: 'Sync Laptop -> Cloud: Cloud sees (Carol, t=15), keeps it because 15 > 10' },
    { action: 'sync', from: 2, to: 0, desc: 'Sync Cloud -> Phone: Phone sees (Carol, t=15), keeps it because 15 > 10' },
    { action: 'sync', from: 2, to: 1, desc: 'Sync Cloud -> Laptop: already (Carol, t=15) — no change. All converged!' },
  ]

  const applyStep = useCallback((s: number) => {
    if (s === 0) {
      registersRef.current = [
        { value: 'Alice', timestamp: 0 },
        { value: 'Alice', timestamp: 0 },
        { value: 'Alice', timestamp: 0 },
      ]
      eventsRef.current = ['Initial state: all nodes have value "Alice" at t=0']
      syncAnimRef.current = null
      return
    }

    const stepDef = steps[s]
    if (!stepDef) return

    const regs = registersRef.current

    if (stepDef.action === 'write' && stepDef.node !== undefined) {
      regs[stepDef.node] = { value: stepDef.value!, timestamp: stepDef.ts! }
      eventsRef.current.push(stepDef.desc)
    } else if (stepDef.action === 'sync' && stepDef.from !== undefined && stepDef.to !== undefined) {
      const fromReg = regs[stepDef.from]
      const toReg = regs[stepDef.to]
      if (fromReg.timestamp > toReg.timestamp) {
        regs[stepDef.to] = { ...fromReg }
      }
      eventsRef.current.push(stepDef.desc)
      syncAnimRef.current = { from: stepDef.from, to: stepDef.to, frame: 0 }
    }
  }, [])

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 480

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      animFrameRef.current++

      const regs = registersRef.current
      const cx = p.width / 2

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.LEFT, p.TOP)
      p.text('LWW-Register: 3-Node Replication', 15, 12)

      p.fill(...TEXT_C)
      p.textSize(11)
      p.text(`Step ${stepRef.current} of ${steps.length - 1}`, 15, 35)

      // Node positions — triangle layout
      const nodePositions = [
        { x: cx, y: 100 },          // Phone (top)
        { x: cx - 200, y: 280 },    // Laptop (bottom-left)
        { x: cx + 200, y: 280 },    // Cloud (bottom-right)
      ]

      // Draw network links
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          p.stroke(...GRID_C)
          p.strokeWeight(1)
          p.line(nodePositions[i].x, nodePositions[i].y, nodePositions[j].x, nodePositions[j].y)
        }
      }

      // Draw sync animation
      if (syncAnimRef.current) {
        const sync = syncAnimRef.current
        sync.frame++
        const progress = Math.min(sync.frame / 40, 1)
        const from = nodePositions[sync.from]
        const to = nodePositions[sync.to]

        const ax = from.x + (to.x - from.x) * progress
        const ay = from.y + (to.y - from.y) * progress

        // Arrow line
        p.stroke(...YELLOW)
        p.strokeWeight(2)
        p.line(from.x, from.y, ax, ay)

        // Arrow head
        p.fill(...YELLOW)
        p.noStroke()
        p.ellipse(ax, ay, 10, 10)

        if (progress >= 1) {
          syncAnimRef.current = null
        }
      }

      // Draw nodes
      for (let i = 0; i < 3; i++) {
        const pos = nodePositions[i]
        const reg = regs[i]
        const color = NODE_COLORS[i]

        // Node circle
        p.fill(color[0], color[1], color[2], 40)
        p.stroke(...color)
        p.strokeWeight(2)
        p.ellipse(pos.x, pos.y, 90, 90)

        // Label
        p.noStroke()
        p.fill(...color)
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(NODE_LABELS[i], pos.x, pos.y - 22)

        // Value
        p.fill(255)
        p.textSize(16)
        p.textFont('monospace')
        p.text(`"${reg.value}"`, pos.x, pos.y + 2)

        // Timestamp
        p.fill(...TEXT_C)
        p.textSize(10)
        p.textFont('sans-serif')
        p.text(`t = ${reg.timestamp}`, pos.x, pos.y + 22)
      }

      // Check convergence
      const allSame = regs.every(
        (r) => r.value === regs[0].value && r.timestamp === regs[0].timestamp
      )
      if (allSame && stepRef.current > 0) {
        p.noStroke()
        p.fill(...GREEN)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('All nodes converged!', cx, 350)
      }

      // Event log
      const events = eventsRef.current
      const logY = 380
      p.noStroke()
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Event Log:', 15, logY)

      p.fill(...TEXT_C)
      p.textSize(10)
      const visibleEvents = events.slice(-4)
      for (let i = 0; i < visibleEvents.length; i++) {
        const alpha = 100 + (155 * (i + 1)) / visibleEvents.length
        p.fill(148, 163, 184, alpha)
        p.text(`> ${visibleEvents[i]}`, 15, logY + 18 + i * 16)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={480}
        controls={
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button
              onClick={() => {
                const newStep = 0
                setStep(newStep)
                registersRef.current = [
                  { value: 'Alice', timestamp: 0 },
                  { value: 'Alice', timestamp: 0 },
                  { value: 'Alice', timestamp: 0 },
                ]
                eventsRef.current = ['Initial state: all nodes have value "Alice" at t=0']
                syncAnimRef.current = null
              }}
              className="px-3 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
            <button
              onClick={() => {
                if (step < steps.length - 1) {
                  const newStep = step + 1
                  applyStep(newStep)
                  setStep(newStep)
                }
              }}
              disabled={step >= steps.length - 1}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                step >= steps.length - 1
                  ? 'bg-slate-800 text-gray-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              NEXT STEP
            </button>
            <span className="text-xs text-gray-500 ml-2">
              {steps[step]?.desc}
            </span>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Clock Skew Sketch                                       */
/* ------------------------------------------------------------------ */

function ClockSkewSketch() {
  const [scenario, setScenario] = useState<'correct' | 'skewed'>('correct')
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 420

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const isSkewed = scenarioRef.current === 'skewed'
      const cx = p.width / 2

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        isSkewed ? 'Clock Skew: Wrong Winner!' : 'Correct Clocks: Right Winner',
        15, 12
      )

      // Timeline
      const timelineY = 80
      const timelineW = p.width - 100

      // Node A (top)
      const nodeAY = timelineY + 40
      // Node B (bottom)
      const nodeBY = timelineY + 160

      // Draw timelines
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(50, nodeAY, 50 + timelineW, nodeAY)
      p.line(50, nodeBY, 50 + timelineW, nodeBY)

      // Labels
      p.noStroke()
      p.fill(...ACCENT)
      p.textSize(13)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Node A', 45, nodeAY)
      p.fill(...PINK)
      p.text('Node B', 45, nodeBY)

      // Real time axis
      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      const realTimeY = nodeBY + 60
      p.stroke(...GRID_C)
      p.line(50, realTimeY, 50 + timelineW, realTimeY)
      p.noStroke()
      p.text('Real Wall Clock Time --->', cx, realTimeY + 10)

      // Scenario data
      if (!isSkewed) {
        // Correct: Node A writes at real=10:00:00, ts=100. Node B writes at real=10:00:01, ts=101
        // LWW picks B (ts=101) — correct, B was actually later
        const writeAX = 50 + timelineW * 0.3
        const writeBX = 50 + timelineW * 0.5

        // Write events
        p.fill(...ACCENT)
        p.noStroke()
        p.ellipse(writeAX, nodeAY, 14, 14)
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('write("Alice")', writeAX, nodeAY - 12)
        p.fill(...ACCENT)
        p.textSize(9)
        p.text('ts = 100', writeAX, nodeAY + 22)

        p.fill(...PINK)
        p.ellipse(writeBX, nodeBY, 14, 14)
        p.fill(255)
        p.textSize(10)
        p.text('write("Bob")', writeBX, nodeBY - 12)
        p.fill(...PINK)
        p.textSize(9)
        p.text('ts = 101', writeBX, nodeBY + 22)

        // Real time markers
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('10:00:00', writeAX, realTimeY - 4)
        p.text('10:00:01', writeBX, realTimeY - 4)

        p.stroke(...GRID_C)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D; ctx.setLineDash([3, 3])
        p.line(writeAX, nodeAY + 10, writeAX, realTimeY)
        p.line(writeBX, nodeBY + 10, writeBX, realTimeY)
        ctx.setLineDash([])

        // Result
        p.noStroke()
        p.fill(...GREEN)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('LWW picks "Bob" (ts=101 > ts=100)', cx, nodeBY + 90)
        p.fill(...GREEN)
        p.textSize(11)
        p.text('Correct! Bob was written later in real time.', cx, nodeBY + 112)
      } else {
        // Skewed: Node A clock is fast. Real=10:00:00 but ts=150. Node B correct: real=10:00:01, ts=101
        // LWW picks A (ts=150) — WRONG, B was actually later
        const writeAX = 50 + timelineW * 0.3
        const writeBX = 50 + timelineW * 0.5

        p.fill(...ACCENT)
        p.noStroke()
        p.ellipse(writeAX, nodeAY, 14, 14)
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('write("Alice")', writeAX, nodeAY - 12)
        p.fill(...ACCENT)
        p.textSize(9)
        p.text('ts = 150 (clock fast!)', writeAX, nodeAY + 22)

        p.fill(...PINK)
        p.ellipse(writeBX, nodeBY, 14, 14)
        p.fill(255)
        p.textSize(10)
        p.text('write("Bob")', writeBX, nodeBY - 12)
        p.fill(...PINK)
        p.textSize(9)
        p.text('ts = 101 (clock correct)', writeBX, nodeBY + 22)

        // Real time markers
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('10:00:00', writeAX, realTimeY - 4)
        p.text('10:00:01', writeBX, realTimeY - 4)

        p.stroke(...GRID_C)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D; ctx.setLineDash([3, 3])
        p.line(writeAX, nodeAY + 10, writeAX, realTimeY)
        p.line(writeBX, nodeBY + 10, writeBX, realTimeY)
        ctx.setLineDash([])

        // Clock skew indicator
        p.noStroke()
        p.fill(...ORANGE)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Node A clock is 49s ahead!', writeAX + 40, nodeAY)

        // Result
        p.fill(...RED)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('LWW picks "Alice" (ts=150 > ts=101)', cx, nodeBY + 90)
        p.fill(...RED)
        p.textSize(11)
        p.text('WRONG! Bob was written later in real time, but Node A\'s fast clock wins.', cx, nodeBY + 112)

        p.fill(...ORANGE)
        p.textSize(10)
        p.text('This is a fundamental limitation of LWW with wall clocks.', cx, nodeBY + 132)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setScenario('correct')}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                scenario === 'correct'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              CORRECT CLOCKS
            </button>
            <button
              onClick={() => setScenario('skewed')}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                scenario === 'skewed'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              SKEWED CLOCKS
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — LWW-Element-Set Sketch                                  */
/* ------------------------------------------------------------------ */

function LWWElementSetSketch() {
  interface ElementEntry {
    addTs: number
    removeTs: number
  }

  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const setStateRef = useRef<Map<string, ElementEntry>>(new Map())
  const eventsRef = useRef<string[]>(['LWW-Element-Set initialized (empty)'])

  const operations = [
    { action: 'init', desc: 'Empty set' },
    { op: 'add', element: 'milk', ts: 5, desc: 'add("milk", t=5)' },
    { op: 'add', element: 'eggs', ts: 8, desc: 'add("eggs", t=8)' },
    { op: 'add', element: 'bread', ts: 10, desc: 'add("bread", t=10)' },
    { op: 'remove', element: 'milk', ts: 12, desc: 'remove("milk", t=12) — milk removed (12 > 5)' },
    { op: 'add', element: 'milk', ts: 15, desc: 'add("milk", t=15) — milk re-added (15 > 12)' },
    { op: 'remove', element: 'bread', ts: 9, desc: 'remove("bread", t=9) — bread stays! (9 < 10, add wins)' },
    { op: 'remove', element: 'eggs', ts: 20, desc: 'remove("eggs", t=20) — eggs removed (20 > 8)' },
  ]

  const applyOp = useCallback((s: number) => {
    if (s === 0) {
      setStateRef.current = new Map()
      eventsRef.current = ['LWW-Element-Set initialized (empty)']
      return
    }
    const op = operations[s]
    if (!op || !('op' in op)) return

    const map = setStateRef.current
    const existing = map.get(op.element!) || { addTs: -1, removeTs: -1 }

    if (op.op === 'add') {
      existing.addTs = Math.max(existing.addTs, op.ts!)
    } else {
      existing.removeTs = Math.max(existing.removeTs, op.ts!)
    }
    map.set(op.element!, existing)
    eventsRef.current.push(op.desc!)
  }, [])

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 400

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const map = setStateRef.current

      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('LWW-Element-Set Internal State', 15, 12)

      // Table header
      const tableY = 50
      const colX = [20, 140, 260, 380, 520]
      p.fill(...TEXT_C)
      p.textSize(11)
      p.text('Element', colX[0], tableY)
      p.text('Add Timestamp', colX[1], tableY)
      p.text('Remove Timestamp', colX[2], tableY)
      p.text('In Set?', colX[3], tableY)
      p.text('Reason', colX[4], tableY)

      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(15, tableY + 18, p.width - 15, tableY + 18)

      let row = 0
      map.forEach((entry, key) => {
        const y = tableY + 30 + row * 35
        const inSet = entry.addTs > entry.removeTs

        // Row background
        p.noStroke()
        p.fill(inSet ? 34 : 239, inSet ? 197 : 68, inSet ? 94 : 68, 15)
        p.rect(15, y - 5, p.width - 30, 30, 4)

        p.fill(255)
        p.textSize(13)
        p.textFont('monospace')
        p.text(key, colX[0], y + 4)

        p.fill(...CYAN)
        p.textSize(12)
        p.text(entry.addTs >= 0 ? `t = ${entry.addTs}` : '—', colX[1], y + 4)

        p.fill(...ORANGE)
        p.text(entry.removeTs >= 0 ? `t = ${entry.removeTs}` : '—', colX[2], y + 4)

        p.fill(inSet ? GREEN[0] : RED[0], inSet ? GREEN[1] : RED[1], inSet ? GREEN[2] : RED[2])
        p.textFont('sans-serif')
        p.textSize(12)
        p.text(inSet ? 'YES' : 'NO', colX[3], y + 4)

        p.fill(...TEXT_C)
        p.textSize(10)
        if (entry.addTs >= 0 && entry.removeTs >= 0) {
          p.text(
            inSet
              ? `add(${entry.addTs}) > remove(${entry.removeTs})`
              : `remove(${entry.removeTs}) > add(${entry.addTs})`,
            colX[4], y + 5
          )
        } else if (entry.addTs >= 0) {
          p.text('only added', colX[4], y + 5)
        }

        row++
      })

      if (map.size === 0) {
        p.fill(...TEXT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Set is empty. Step through operations to see the state evolve.', p.width / 2, 150)
      }

      // Current set contents
      const setY = 260
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Current set contents:', 15, setY)

      const members: string[] = []
      map.forEach((entry, key) => {
        if (entry.addTs > entry.removeTs) members.push(key)
      })

      p.fill(...GREEN)
      p.textSize(14)
      p.textFont('monospace')
      p.text(members.length > 0 ? `{ ${members.join(', ')} }` : '{ }', 15, setY + 22)

      // Event log
      const events = eventsRef.current.slice(-5)
      const logY = 310
      p.fill(255)
      p.textFont('sans-serif')
      p.textSize(12)
      p.text('Operations:', 15, logY)

      p.textSize(10)
      for (let i = 0; i < events.length; i++) {
        const alpha = 100 + (155 * (i + 1)) / events.length
        p.fill(148, 163, 184, alpha)
        p.text(`> ${events[i]}`, 15, logY + 18 + i * 15)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button
              onClick={() => {
                setStep(0)
                setStateRef.current = new Map()
                eventsRef.current = ['LWW-Element-Set initialized (empty)']
              }}
              className="px-3 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
            <button
              onClick={() => {
                if (step < operations.length - 1) {
                  const newStep = step + 1
                  applyOp(newStep)
                  setStep(newStep)
                }
              }}
              disabled={step >= operations.length - 1}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                step >= operations.length - 1
                  ? 'bg-slate-800 text-gray-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              NEXT OPERATION
            </button>
            <span className="text-xs text-gray-500 ml-2">
              Step {step} of {operations.length - 1}
              {step < operations.length - 1 && operations[step + 1] && 'desc' in operations[step + 1]
                ? ` — next: ${operations[step + 1].desc}`
                : ''}
            </span>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python cells                                                        */
/* ------------------------------------------------------------------ */

const pythonLWWRegister = `import time, random

class LWWRegister:
    """Last-Writer-Wins Register.
    Stores a (value, timestamp) pair.
    On merge, the higher timestamp wins."""

    def __init__(self, value=None, timestamp=0):
        self.value = value
        self.timestamp = timestamp

    def write(self, value, timestamp):
        """Write only succeeds if the new timestamp is higher."""
        if timestamp > self.timestamp:
            self.value = value
            self.timestamp = timestamp
            return True
        return False

    def read(self):
        return self.value

    def merge(self, other):
        """Merge with another LWW-Register.
        Keep the value with the highest timestamp.
        This is commutative, associative, and idempotent (CRDT!)."""
        if other.timestamp > self.timestamp:
            self.value = other.value
            self.timestamp = other.timestamp

    def __repr__(self):
        return f'LWWRegister("{self.value}", t={self.timestamp})'

# --- Simulate 3 nodes (Phone, Laptop, Cloud) ---
phone  = LWWRegister("Alice", 0)
laptop = LWWRegister("Alice", 0)
cloud  = LWWRegister("Alice", 0)

print("=== Initial State ===")
print(f"Phone:  {phone}")
print(f"Laptop: {laptop}")
print(f"Cloud:  {cloud}")

# User updates name on Phone at t=10
phone.write("Bob", 10)
print("\\n--- Phone writes 'Bob' at t=10 ---")
print(f"Phone:  {phone}")

# User updates name on Laptop at t=15
laptop.write("Carol", 15)
print("\\n--- Laptop writes 'Carol' at t=15 ---")
print(f"Laptop: {laptop}")

# Cloud gets a late write at t=8
cloud.write("Dave", 8)
print("\\n--- Cloud writes 'Dave' at t=8 ---")
print(f"Cloud:  {cloud}")

# Now sync all nodes through Cloud
print("\\n=== Syncing through Cloud ===")

# Phone -> Cloud
cloud.merge(phone)
print(f"After Phone -> Cloud:  Cloud = {cloud}")

# Laptop -> Cloud
cloud.merge(laptop)
print(f"After Laptop -> Cloud: Cloud = {cloud}")

# Cloud -> Phone
phone.merge(cloud)
print(f"After Cloud -> Phone:  Phone = {phone}")

# Cloud -> Laptop
laptop.merge(cloud)
print(f"After Cloud -> Laptop: Laptop = {laptop}")

print("\\n=== Final State (all converged) ===")
print(f"Phone:  {phone}")
print(f"Laptop: {laptop}")
print(f"Cloud:  {cloud}")
assert phone.value == laptop.value == cloud.value
print("\\nAll nodes agree! The highest timestamp (Carol, t=15) won.")

# Demonstrate commutativity
a = LWWRegister("X", 5)
b = LWWRegister("Y", 10)

a1, a2 = LWWRegister("X", 5), LWWRegister("X", 5)
b1, b2 = LWWRegister("Y", 10), LWWRegister("Y", 10)

a1.merge(b1)  # merge b into a
b2.merge(a2)  # merge a into b

print(f"\\n=== Commutativity Check ===")
print(f"a.merge(b) -> {a1}")
print(f"b.merge(a) -> {b2}")
print(f"Same result: {a1.value == b2.value}")  # True!`

const pythonLWWElementSet = `class LWWElementSet:
    """LWW-Element-Set: a set where each element has
    add and remove timestamps. Element is in the set
    if its add timestamp > remove timestamp."""

    def __init__(self):
        self.add_map = {}     # element -> timestamp
        self.remove_map = {}  # element -> timestamp

    def add(self, element, timestamp):
        """Add an element with a timestamp."""
        if element not in self.add_map or timestamp > self.add_map[element]:
            self.add_map[element] = timestamp

    def remove(self, element, timestamp):
        """Remove an element with a timestamp."""
        if element not in self.remove_map or timestamp > self.remove_map[element]:
            self.remove_map[element] = timestamp

    def lookup(self, element):
        """Is the element currently in the set?
        True if add_ts > remove_ts (or never removed)."""
        if element not in self.add_map:
            return False
        add_ts = self.add_map[element]
        remove_ts = self.remove_map.get(element, -1)
        return add_ts > remove_ts

    def elements(self):
        """Return all elements currently in the set."""
        return {e for e in self.add_map if self.lookup(e)}

    def merge(self, other):
        """Merge another LWW-Element-Set into this one.
        Take the max timestamp for each element's add and remove."""
        for elem, ts in other.add_map.items():
            if elem not in self.add_map or ts > self.add_map[elem]:
                self.add_map[elem] = ts
        for elem, ts in other.remove_map.items():
            if elem not in self.remove_map or ts > self.remove_map[elem]:
                self.remove_map[elem] = ts

    def __repr__(self):
        items = self.elements()
        return f'LWWSet({items})'

# --- Demo: Shopping cart across devices ---
phone = LWWElementSet()
laptop = LWWElementSet()

print("=== Collaborative Shopping Cart ===\\n")

# Add items on phone
phone.add("milk", 1)
phone.add("eggs", 2)
phone.add("bread", 3)
print(f"Phone adds milk, eggs, bread: {phone}")

# Laptop independently adds and removes
laptop.add("milk", 1)  # same add
laptop.add("butter", 4)
laptop.remove("milk", 5)  # remove milk at t=5
print(f"Laptop adds butter, removes milk: {laptop}")

# Phone re-adds milk at t=7 (after laptop's remove, but phone doesn't know yet)
phone.add("milk", 7)
print(f"Phone re-adds milk at t=7: {phone}")

# Now merge!
print("\\n--- Merging Phone and Laptop ---")
phone.merge(laptop)
print(f"Phone after merge: {phone}")
print(f"  milk in set? {phone.lookup('milk')}")
print(f"  milk add_ts={phone.add_map.get('milk')}, remove_ts={phone.remove_map.get('milk', 'N/A')}")
print(f"  -> milk stays because add(t=7) > remove(t=5)")

# Merge other direction too
laptop.merge(phone)
print(f"\\nLaptop after merge: {laptop}")
assert phone.elements() == laptop.elements()
print(f"Both devices agree: {phone.elements()}")

# --- Element lifecycle ---
print("\\n=== Element Lifecycle Demo ===")
s = LWWElementSet()

timeline = [
    ("add", "X", 1, "Add X at t=1"),
    ("add", "Y", 2, "Add Y at t=2"),
    ("remove", "X", 3, "Remove X at t=3"),
    ("add", "X", 5, "Re-add X at t=5"),
    ("remove", "X", 4, "Remove X at t=4 (late msg, ignored: 4 < 5)"),
    ("add", "Z", 6, "Add Z at t=6"),
    ("remove", "Y", 7, "Remove Y at t=7"),
]

for op, elem, ts, desc in timeline:
    if op == "add":
        s.add(elem, ts)
    else:
        s.remove(elem, ts)
    print(f"  {desc:50s} -> set = {s.elements()}")

print(f"\\nFinal set: {s.elements()}")
print("X is in set because add(5) > remove(4), even though remove came later in the timeline!")`

/* ------------------------------------------------------------------ */
/* Main lesson component                                               */
/* ------------------------------------------------------------------ */

export default function LWWRegister() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Hero ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-3">
          LWW-Register: Last Writer Wins
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          When the same data is replicated across multiple servers or devices, concurrent writes
          create conflicts. The LWW-Register is the simplest conflict resolution strategy:
          attach a timestamp to every write, and when replicas sync, keep the value with the
          highest timestamp. Simple, predictable, and used everywhere from Cassandra to DynamoDB.
        </p>
      </header>

      {/* ---- Section 1: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Concurrent Writes on Replicated Data</h2>
        <p className="text-gray-300 leading-relaxed">
          Imagine a user profile — name, email, bio — stored in three datacenters for low latency
          and high availability. The user updates their name on datacenter A (because they are in
          New York), then a second later updates their bio on datacenter B (because they hopped to
          a European CDN). Both writes succeed locally, but when the datacenters sync, they see
          conflicting versions of the profile.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is not a theoretical edge case. It happens constantly in:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li><span className="text-yellow-400">User settings sync</span> — change theme on phone, change notification preference on laptop</li>
          <li><span className="text-yellow-400">Multi-leader replication</span> — writes accepted at any datacenter (Cassandra, CockroachDB)</li>
          <li><span className="text-yellow-400">Offline-first apps</span> — edit a document offline on two devices, sync when back online</li>
          <li><span className="text-yellow-400">Real-time collaboration</span> — two users edit the same field at the same time</li>
        </ul>
      </section>

      {/* ---- Section 2: Naive Approach ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Naive Approach: Just Overwrite</h2>
        <p className="text-gray-300 leading-relaxed">
          The simplest approach: when syncing, just overwrite with whatever version arrives last.
          But "last" is ambiguous in a distributed system. Last to arrive at the server? Last to
          be sent? The sync order depends on network latency, routing, and timing — none of which
          are deterministic.
        </p>
        <div className="bg-slate-800/60 border border-red-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-2">The Problem with "Just Overwrite"</h3>
          <p className="text-gray-400 text-sm">
            Server A receives: name="Bob" then name="Carol" (from different clients)<br />
            Server B receives: name="Carol" then name="Bob" (different network path, reversed order)<br /><br />
            After sync, Server A has "Carol" and Server B has "Bob". They have <span className="text-red-400">diverged</span> — and
            there is no way to resolve it without a deterministic rule.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          We need a conflict resolution rule that is <span className="text-green-400">deterministic</span>,
          <span className="text-green-400"> commutative</span> (order of merging does not matter),
          and <span className="text-green-400"> idempotent</span> (merging the same data twice has no effect).
          Last-Writer-Wins gives us exactly that.
        </p>
      </section>

      {/* ---- Section 3: How LWW Works ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How LWW-Register Works</h2>
        <p className="text-gray-300 leading-relaxed">
          An LWW-Register stores a pair: <code className="text-cyan-400">(value, timestamp)</code>.
          The rules are simple:
        </p>
        <ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
          <li>
            <span className="text-white font-semibold">Write</span> — set the value and record
            the current timestamp. Only succeeds if the new timestamp is strictly greater than the stored one.
          </li>
          <li>
            <span className="text-white font-semibold">Merge</span> — compare timestamps. Keep
            the value with the higher timestamp. If tied, use a deterministic tiebreaker (e.g., lexicographic
            comparison of node IDs).
          </li>
          <li>
            <span className="text-white font-semibold">Read</span> — return the current value.
          </li>
        </ol>
        <p className="text-gray-300 leading-relaxed">
          Because merge is commutative (<code className="text-cyan-400">merge(A, B) = merge(B, A)</code>),
          associative, and idempotent, replicas are guaranteed to converge regardless of the order
          in which they sync. This makes LWW-Register a <span className="text-indigo-400 font-semibold">CRDT</span> (Conflict-free
          Replicated Data Type).
        </p>
      </section>

      {/* ---- Interactive: 3-Node Sketch ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Three Devices Syncing</h2>
        <p className="text-gray-300 leading-relaxed">
          Step through a scenario where Phone, Laptop, and Cloud each write different values at
          different times. Watch how sync propagation and the LWW merge rule cause all three
          nodes to converge on the same value — the one with the highest timestamp.
        </p>
        <LWWRegisterSketch />
      </section>

      {/* ---- Section 4: The Clock Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Clock Problem: When Time Lies</h2>
        <p className="text-gray-300 leading-relaxed">
          LWW-Register assumes timestamps reflect real causality: a higher timestamp means a later
          write. But wall clocks across machines drift. NTP can correct them, but only to within
          milliseconds (and sometimes clocks jump). If Node A's clock is ahead by 50 seconds,
          its writes will always win — even if Node B's writes were genuinely later.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is a <span className="text-red-400 font-semibold">fundamental limitation</span>, not
          a bug. There is no way to determine "true" ordering of events across machines without
          coordination (and coordination defeats the purpose of multi-leader replication). LWW
          trades correctness for availability and simplicity.
        </p>
        <ClockSkewSketch />
        <div className="bg-slate-800/60 border border-orange-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-400 mb-2">Mitigations (but not fixes)</h3>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
            <li>Use NTP with tight bounds (Google Spanner uses GPS + atomic clocks for TrueTime)</li>
            <li>Use Lamport timestamps or hybrid logical clocks (HLC) instead of wall clocks</li>
            <li>Accept that LWW may silently drop concurrent writes — this is the price of simplicity</li>
            <li>For use cases where drops are unacceptable, use a richer CRDT (like OR-Set, next lesson)</li>
          </ul>
        </div>
      </section>

      {/* ---- Section 5: LWW-Element-Set ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">LWW-Element-Set: Extending to Sets</h2>
        <p className="text-gray-300 leading-relaxed">
          We can extend the LWW concept to sets. Each element in an <span className="text-indigo-400">LWW-Element-Set</span> has
          two timestamps: one for the most recent add, and one for the most recent remove. The element
          is considered "in the set" if its add timestamp is greater than its remove timestamp.
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 font-mono text-sm">
          <p className="text-gray-400 mb-1">// Lookup rule:</p>
          <p className="text-cyan-400">element is in set iff add_timestamp(e) {'>'} remove_timestamp(e)</p>
          <p className="text-gray-400 mt-2 mb-1">// Merge rule:</p>
          <p className="text-cyan-400">add_ts[e] = max(self.add_ts[e], other.add_ts[e])</p>
          <p className="text-cyan-400">remove_ts[e] = max(self.remove_ts[e], other.remove_ts[e])</p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Step through operations to see how the add and remove timestamps interact. Pay attention
          to step 7 — a remove with a timestamp lower than the add is ignored, because the add
          "happened after" the remove.
        </p>
        <LWWElementSetSketch />
      </section>

      {/* ---- Section 6: When to Use LWW ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">When LWW Is Appropriate</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-green-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Good Fit</h3>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
              <li>User settings and preferences (theme, language)</li>
              <li>Single-valued profile fields (name, avatar, status)</li>
              <li>Device sync where "most recent" is the right semantics</li>
              <li>Cache invalidation (latest version wins)</li>
              <li>Sensor readings (latest reading is most relevant)</li>
            </ul>
          </div>
          <div className="bg-slate-800/60 border border-red-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Bad Fit</h3>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
              <li>Collaborative text editing (use RGA or Yjs)</li>
              <li>Shared counters (use G-Counter or PN-Counter)</li>
              <li>Shopping carts where concurrent adds must both survive (use OR-Set)</li>
              <li>Any use case where silently dropping a concurrent write is unacceptable</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Section 7: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">Apache Cassandra</h3>
            <p className="text-gray-400 text-sm">
              Every column in Cassandra has a timestamp. On read, Cassandra returns the value
              with the highest timestamp. This is LWW at the column level, applied to every
              write in the database.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">Amazon DynamoDB</h3>
            <p className="text-gray-400 text-sm">
              DynamoDB global tables use LWW by default for conflict resolution. The write
              with the latest timestamp wins when replicas reconcile.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Riak</h3>
            <p className="text-gray-400 text-sm">
              Riak supports LWW bucket types where <code className="text-cyan-400">last_write_wins=true</code>.
              Simple and fast, used when application semantics allow dropped concurrent writes.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Redis (CRDT Module)</h3>
            <p className="text-gray-400 text-sm">
              Redis Enterprise's active-active geo-replication uses LWW for strings. Each write
              carries a vector clock + wall clock timestamp for conflict resolution.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python Cell 1: LWW-Register ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: LWW-Register</h2>
        <p className="text-gray-300 leading-relaxed">
          Build an LWW-Register with write, read, and merge operations. Simulate concurrent
          writes across three nodes and watch them converge through pairwise syncing.
        </p>
        <PythonCell defaultCode={pythonLWWRegister} />
      </section>

      {/* ---- Python Cell 2: LWW-Element-Set ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: LWW-Element-Set</h2>
        <p className="text-gray-300 leading-relaxed">
          Build an LWW-Element-Set with add, remove, lookup, and merge. Watch how timestamps
          on add and remove operations determine set membership, and how a late-arriving remove
          with an old timestamp is correctly ignored.
        </p>
        <PythonCell defaultCode={pythonLWWElementSet} />
      </section>

      {/* ---- Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
          <li>
            LWW-Register resolves conflicts by keeping the value with the highest timestamp.
            It is a CRDT — merge is commutative, associative, and idempotent.
          </li>
          <li>
            Convergence is guaranteed: regardless of sync order, all replicas end up with the
            same value.
          </li>
          <li>
            The trade-off is <span className="text-red-400">silent data loss</span> — concurrent
            writes are resolved by timestamp, and the "losing" write is silently dropped.
          </li>
          <li>
            Clock skew can cause the "wrong" write to win. Mitigations exist (HLC, TrueTime)
            but none are perfect.
          </li>
          <li>
            LWW-Element-Set extends the concept to sets with per-element add/remove timestamps.
          </li>
          <li>
            Use LWW for simple, single-valued fields where "most recent" is the right semantic.
            For richer conflict resolution, use OR-Set or other CRDTs.
          </li>
        </ul>
      </section>
    </div>
  )
}
