import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/g-counter',
  title: 'G-Counter: Conflict-Free Distributed Counting',
  description:
    'Count events across distributed nodes without coordination using CRDTs — data structures that mathematically guarantee convergence',
  track: 'datastructures',
  order: 3,
  tags: ['crdt', 'g-counter', 'pn-counter', 'distributed', 'eventual-consistency', 'conflict-free'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const NODE_COLORS: [number, number, number][] = [
  [99, 102, 241],   // indigo — Server A
  [52, 211, 153],   // emerald — Server B
  [250, 204, 21],   // yellow — Server C
  [244, 114, 182],  // pink — Server D
  [34, 211, 238],   // cyan — Server E
]

const NODE_NAMES = ['A', 'B', 'C', 'D', 'E']

/* ------------------------------------------------------------------ */
/* Section 1 — Race Condition Visualization                            */
/* ------------------------------------------------------------------ */

function RaceConditionSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(0)
  stepRef.current = step

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
      const curStep = stepRef.current

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('The Problem: Shared Counter with Race Condition', 16, 12)

      // Draw two datacenters
      const dcW = 180
      const dcH = 120
      const dcY = 60
      const dc1X = W / 2 - dcW - 40
      const dc2X = W / 2 + 40

      // Shared counter in the middle
      const counterY = dcY + dcH + 60
      const counterX = W / 2

      const drawDC = (x: number, y: number, name: string, col: [number, number, number], localVal: string, action: string, active: boolean) => {
        p.fill(col[0], col[1], col[2], active ? 40 : 20)
        p.stroke(col[0], col[1], col[2], active ? 200 : 80)
        p.strokeWeight(2)
        p.rect(x, y, dcW, dcH, 8)

        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(name, x + dcW / 2, y + 12)

        p.fill(255)
        p.textSize(24)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(localVal, x + dcW / 2, y + dcH / 2)

        if (action) {
          p.fill(col[0], col[1], col[2])
          p.textSize(10)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(action, x + dcW / 2, y + dcH - 8)
        }
      }

      // Steps of the race condition
      const steps = [
        { dc1Val: '?', dc2Val: '?', counterVal: '100', dc1Act: '', dc2Act: '', desc: 'Shared counter = 100. Both datacenters will try to increment it.' },
        { dc1Val: '100', dc2Val: '?', counterVal: '100', dc1Act: 'READ -> 100', dc2Act: '', desc: 'Datacenter East reads counter: 100' },
        { dc1Val: '100', dc2Val: '100', counterVal: '100', dc1Act: 'READ -> 100', dc2Act: 'READ -> 100', desc: 'Datacenter West ALSO reads counter: 100 (before East writes!)' },
        { dc1Val: '101', dc2Val: '100', counterVal: '100', dc1Act: '100 + 1 = 101', dc2Act: 'READ -> 100', desc: 'East computes 100 + 1 = 101' },
        { dc1Val: '101', dc2Val: '101', counterVal: '100', dc1Act: '100 + 1 = 101', dc2Act: '100 + 1 = 101', desc: 'West ALSO computes 100 + 1 = 101 (based on stale read)' },
        { dc1Val: '101', dc2Val: '101', counterVal: '101', dc1Act: 'WRITE 101', dc2Act: '100 + 1 = 101', desc: 'East writes 101 to shared counter' },
        { dc1Val: '101', dc2Val: '101', counterVal: '101', dc1Act: 'WRITE 101', dc2Act: 'WRITE 101', desc: 'West writes 101 too — OVERWRITES East\'s increment! Lost update!' },
      ]

      const s = steps[Math.min(curStep, steps.length - 1)]

      drawDC(dc1X, dcY, 'Datacenter East', [99, 102, 241], s.dc1Val, s.dc1Act, curStep >= 1 && curStep <= 5)
      drawDC(dc2X, dcY, 'Datacenter West', [52, 211, 153], s.dc2Val, s.dc2Act, curStep >= 2 && curStep <= 6)

      // Shared counter
      p.fill(30, 41, 59)
      p.stroke(148, 163, 184)
      p.strokeWeight(2)
      p.rect(counterX - 60, counterY - 30, 120, 60, 8)

      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Shared Counter', counterX, counterY - 26)

      p.fill(255)
      p.textSize(28)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(s.counterVal, counterX, counterY + 6)

      // Arrows from DCs to counter
      p.stroke(99, 102, 241, curStep >= 1 ? 150 : 40)
      p.strokeWeight(1)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([4, 4])
      p.line(dc1X + dcW / 2, dcY + dcH, counterX - 30, counterY - 30)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

      p.stroke(52, 211, 153, curStep >= 2 ? 150 : 40)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([4, 4])
      p.line(dc2X + dcW / 2, dcY + dcH, counterX + 30, counterY - 30)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

      // Description
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text(s.desc, W / 2, counterY + 50)

      // Final result indicator
      if (curStep >= 6) {
        p.fill(239, 68, 68)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('BUG: 2 increments happened, but counter only went from 100 to 101!', W / 2, counterY + 76)
        p.text('Expected: 102. Got: 101. One like was LOST.', W / 2, counterY + 96)
      }

      // Step indicator
      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Step ${Math.min(curStep, steps.length - 1) + 1}/${steps.length}`, 16, canvasH - 8)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-3 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step <= 0}
            className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setStep(Math.min(6, step + 1))}
            disabled={step >= 6}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            Next Step
          </button>
          <button
            onClick={() => setStep(0)}
            className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          <span className="text-gray-500">
            Step through the race condition
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — G-Counter Interactive Visualization                     */
/* ------------------------------------------------------------------ */

interface GCounterState {
  vectors: number[][]  // [node][node] — each node's view of all counts
  events: { type: 'increment' | 'sync'; node: number; target?: number; time: number }[]
}

function GCounterSketch() {
  const numNodes = 3
  const [state, setState] = useState<GCounterState>({
    vectors: Array.from({ length: numNodes }, () => new Array(numNodes).fill(0)),
    events: [],
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const [eventLog, setEventLog] = useState<string[]>([])

  const handleIncrement = useCallback((nodeIdx: number) => {
    setState(prev => {
      const newVectors = prev.vectors.map(v => [...v])
      newVectors[nodeIdx][nodeIdx] += 1
      const newEvents = [...prev.events, {
        type: 'increment' as const,
        node: nodeIdx,
        time: Date.now(),
      }]
      return { vectors: newVectors, events: newEvents }
    })
    setEventLog(prev => [...prev, `Node ${NODE_NAMES[nodeIdx]} incremented its own counter`])
  }, [])

  const handleSync = useCallback((from: number, to: number) => {
    setState(prev => {
      const newVectors = prev.vectors.map(v => [...v])
      // Merge: to takes element-wise max of its vector and from's vector
      for (let i = 0; i < numNodes; i++) {
        newVectors[to][i] = Math.max(newVectors[to][i], newVectors[from][i])
      }
      // from also takes element-wise max
      for (let i = 0; i < numNodes; i++) {
        newVectors[from][i] = Math.max(newVectors[from][i], newVectors[to][i])
      }
      const newEvents = [...prev.events, {
        type: 'sync' as const,
        node: from,
        target: to,
        time: Date.now(),
      }]
      return { vectors: newVectors, events: newEvents }
    })
    setEventLog(prev => [...prev, `Sync: ${NODE_NAMES[from]} <-> ${NODE_NAMES[to]} (element-wise max)`])
  }, [])

  const handleReset = useCallback(() => {
    setState({
      vectors: Array.from({ length: numNodes }, () => new Array(numNodes).fill(0)),
      events: [],
    })
    setEventLog([])
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 420

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const st = stateRef.current

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('G-Counter: Each Node Maintains a Vector', 16, 12)

      // Draw nodes
      const nodeW = 160
      const nodeH = 180
      const gap = (W - numNodes * nodeW) / (numNodes + 1)
      const nodeY = 50

      for (let n = 0; n < numNodes; n++) {
        const x = gap + n * (nodeW + gap)
        const col = NODE_COLORS[n]

        // Node box
        p.fill(col[0], col[1], col[2], 25)
        p.stroke(col[0], col[1], col[2], 180)
        p.strokeWeight(2)
        p.rect(x, nodeY, nodeW, nodeH, 8)

        // Node name
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.textSize(16)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Server ${NODE_NAMES[n]}`, x + nodeW / 2, nodeY + 8)

        // Vector display
        const vecY = nodeY + 36
        p.textSize(10)
        p.fill(148, 163, 184)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Vector:', x + 12, vecY)

        for (let i = 0; i < numNodes; i++) {
          const vy = vecY + 18 + i * 22
          const isOwn = i === n
          const c = NODE_COLORS[i]

          // Slot background
          p.fill(isOwn ? 40 : 25, isOwn ? 50 : 35, isOwn ? 70 : 55, 200)
          p.stroke(c[0], c[1], c[2], isOwn ? 160 : 60)
          p.strokeWeight(1)
          p.rect(x + 12, vy, nodeW - 24, 18, 3)

          // Label
          p.fill(c[0], c[1], c[2])
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`${NODE_NAMES[i]}:`, x + 16, vy + 9)

          // Value
          p.fill(255)
          p.textSize(14)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`${st.vectors[n][i]}`, x + nodeW - 16, vy + 9)

          if (isOwn) {
            p.fill(c[0], c[1], c[2], 80)
            p.textSize(7)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('(mine)', x + nodeW / 2, vy + 9)
          }
        }

        // Total
        const total = st.vectors[n].reduce((a, b) => a + b, 0)
        p.fill(255)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Total: ${total}`, x + nodeW / 2, nodeY + nodeH - 28)

        // Highlight own row
        p.fill(col[0], col[1], col[2], 30)
        p.noStroke()
      }

      // Global total line
      const allTotals = st.vectors.map(v => v.reduce((a, b) => a + b, 0))
      const allAgree = allTotals.every(t => t === allTotals[0])

      const summaryY = nodeY + nodeH + 20
      p.fill(allAgree ? 52 : 250, allAgree ? 211 : 204, allAgree ? 153 : 21)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)

      if (allAgree) {
        p.text(`All nodes agree: total = ${allTotals[0]}`, W / 2, summaryY)
      } else {
        p.text(`Nodes see different totals: [${allTotals.join(', ')}] — sync to converge!`, W / 2, summaryY)
      }

      // Explanation
      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('increment(node) -> node.vector[node] += 1  |  merge(A, B) -> element-wise max  |  value() -> sum(vector)', W / 2, summaryY + 24)

      // Sync arrows between nodes
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Click "Sync" buttons below to merge vectors between node pairs', W / 2, summaryY + 48)

      // Convergence proof
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Why it works: max() is idempotent, commutative, and associative. Repeated syncs always converge.', 16, summaryY + 70)
      p.text('Each node only increments its OWN entry, so no updates are ever lost — no matter the sync order.', 16, summaryY + 84)
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={420} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[0, 1, 2].map(n => (
          <button
            key={`inc-${n}`}
            onClick={() => handleIncrement(n)}
            style={{ backgroundColor: `rgb(${NODE_COLORS[n].join(',')})` }}
            className="px-3 py-1.5 rounded text-white text-sm font-medium opacity-90 hover:opacity-100 transition-opacity"
          >
            Like on {NODE_NAMES[n]}
          </button>
        ))}
        <span className="text-gray-600 mx-1">|</span>
        {[[0, 1], [1, 2], [0, 2]].map(([from, to]) => (
          <button
            key={`sync-${from}-${to}`}
            onClick={() => handleSync(from, to)}
            className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
          >
            Sync {NODE_NAMES[from]}&#8596;{NODE_NAMES[to]}
          </button>
        ))}
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded bg-gray-800 text-gray-400 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Reset
        </button>
      </div>
      {eventLog.length > 0 && (
        <div className="bg-gray-900 rounded border border-gray-700 p-3 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-1">Event log:</p>
          {eventLog.slice(-8).map((log, i) => (
            <p key={i} className="text-xs text-gray-400 font-mono">{log}</p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Timeline / Convergence Visualization                    */
/* ------------------------------------------------------------------ */

function ConvergenceSketch() {
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  playingRef.current = playing

  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  speedRef.current = speed

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    const numNodes = 3

    // Pre-scripted scenario
    interface Event {
      time: number
      type: 'inc' | 'sync'
      node: number
      target?: number
    }

    const events: Event[] = [
      { time: 0.5, type: 'inc', node: 0 },
      { time: 1.0, type: 'inc', node: 0 },
      { time: 1.2, type: 'inc', node: 1 },
      { time: 1.8, type: 'inc', node: 2 },
      { time: 2.0, type: 'inc', node: 0 },
      { time: 2.5, type: 'inc', node: 1 },
      { time: 3.0, type: 'sync', node: 0, target: 1 },
      { time: 3.5, type: 'inc', node: 2 },
      { time: 4.0, type: 'inc', node: 2 },
      { time: 4.2, type: 'inc', node: 1 },
      { time: 5.0, type: 'sync', node: 1, target: 2 },
      { time: 5.5, type: 'inc', node: 0 },
      { time: 6.0, type: 'sync', node: 0, target: 2 },
      { time: 6.5, type: 'sync', node: 0, target: 1 },
      { time: 7.0, type: 'sync', node: 1, target: 2 },
    ]

    const maxTime = 8

    let simTime = 0
    const vectors = Array.from({ length: numNodes }, () => new Array(numNodes).fill(0))
    let processedUpTo = 0

    function resetSim() {
      simTime = 0
      processedUpTo = 0
      for (let n = 0; n < numNodes; n++) {
        for (let i = 0; i < numNodes; i++) {
          vectors[n][i] = 0
        }
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

      // Advance time
      if (playingRef.current) {
        simTime += (1 / 60) * speedRef.current
        if (simTime > maxTime) {
          resetSim()
        }
      }

      // Process events
      while (processedUpTo < events.length && events[processedUpTo].time <= simTime) {
        const ev = events[processedUpTo]
        if (ev.type === 'inc') {
          vectors[ev.node][ev.node] += 1
        } else if (ev.type === 'sync' && ev.target !== undefined) {
          for (let i = 0; i < numNodes; i++) {
            const mx = Math.max(vectors[ev.node][i], vectors[ev.target][i])
            vectors[ev.node][i] = mx
            vectors[ev.target][i] = mx
          }
        }
        processedUpTo++
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('G-Counter Convergence Timeline', 16, 12)

      // Timeline
      const tlLeft = 80
      const tlRight = W - 30
      const tlW = tlRight - tlLeft
      const nodeSpacing = 80
      const tlTop = 60

      // Time axis
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      for (let t = 0; t <= maxTime; t++) {
        const x = tlLeft + (t / maxTime) * tlW
        p.line(x, tlTop - 10, x, tlTop + numNodes * nodeSpacing + 10)
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`t=${t}`, x, tlTop + numNodes * nodeSpacing + 14)
        p.stroke(51, 65, 85)
      }

      // Node lanes
      for (let n = 0; n < numNodes; n++) {
        const y = tlTop + n * nodeSpacing + nodeSpacing / 2
        const col = NODE_COLORS[n]

        // Lane line
        p.stroke(col[0], col[1], col[2], 60)
        p.strokeWeight(2)
        p.line(tlLeft, y, tlRight, y)

        // Label
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`Node ${NODE_NAMES[n]}`, tlLeft - 8, y)
      }

      // Draw events
      for (let i = 0; i < events.length; i++) {
        const ev = events[i]
        const x = tlLeft + (ev.time / maxTime) * tlW
        const y = tlTop + ev.node * nodeSpacing + nodeSpacing / 2
        const isPast = ev.time <= simTime
        const col = NODE_COLORS[ev.node]

        if (ev.type === 'inc') {
          // Increment dot
          p.fill(isPast ? col[0] : 60, isPast ? col[1] : 60, isPast ? col[2] : 60, isPast ? 255 : 100)
          p.noStroke()
          p.ellipse(x, y, isPast ? 14 : 10, isPast ? 14 : 10)
          p.fill(isPast ? 0 : 80)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('+1', x, y)
        } else if (ev.type === 'sync' && ev.target !== undefined) {
          // Sync line between nodes
          const y2 = tlTop + ev.target * nodeSpacing + nodeSpacing / 2
          p.stroke(isPast ? 255 : 80, isPast ? 255 : 80, isPast ? 255 : 80, isPast ? 200 : 60)
          p.strokeWeight(isPast ? 2 : 1)
          ;(p.drawingContext as CanvasRenderingContext2D).setLineDash(isPast ? [] : [3, 3])
          p.line(x, y, x, y2)
          ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

          // Sync arrows
          const midY = (y + y2) / 2
          p.fill(isPast ? 255 : 80, isPast ? 255 : 80, isPast ? 255 : 80, isPast ? 200 : 60)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('sync', x + 14, midY)
        }
      }

      // Playhead
      const phX = tlLeft + (simTime / maxTime) * tlW
      p.stroke(239, 68, 68)
      p.strokeWeight(2)
      p.line(phX, tlTop - 15, phX, tlTop + numNodes * nodeSpacing + 10)
      p.fill(239, 68, 68)
      p.noStroke()
      p.triangle(phX - 5, tlTop - 15, phX + 5, tlTop - 15, phX, tlTop - 8)

      // Current state display
      const stateY = tlTop + numNodes * nodeSpacing + 40
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Current vectors:', 16, stateY)

      for (let n = 0; n < numNodes; n++) {
        const col = NODE_COLORS[n]
        const x = 16 + n * 200
        const y = stateY + 20

        p.fill(col[0], col[1], col[2])
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${NODE_NAMES[n]}: [${vectors[n].join(', ')}]`, x, y)

        const total = vectors[n].reduce((a, b) => a + b, 0)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text(`total = ${total}`, x, y + 16)
      }

      // Convergence status
      const totals = vectors.map(v => v.reduce((a, b) => a + b, 0))
      const allSame = totals.every(t => t === totals[0])
      const trueTotal = vectors[0].map((_, i) => Math.max(...vectors.map(v => v[i]))).reduce((a, b) => a + b, 0)

      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      if (allSame) {
        p.fill(52, 211, 153)
        p.text(`CONVERGED: all nodes agree on total = ${totals[0]}`, 16, stateY + 50)
      } else {
        p.fill(250, 204, 21)
        p.text(`NOT YET CONVERGED: nodes see [${totals.join(', ')}] — true total is ${trueTotal}`, 16, stateY + 50)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setPlaying(!playing)}
            className={`px-4 py-1.5 rounded text-white text-sm font-medium transition-colors ${playing ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <label className="flex items-center gap-2">
            Speed:
            <input
              type="range" min={0.5} max={3} step={0.5} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-gray-400 w-8">{speed}x</span>
          </label>
          <span className="text-gray-500">
            Watch increments and syncs happen over time
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const gcounterImplementation = `import random
import time

class GCounter:
    """
    G-Counter (Grow-only Counter) — a CRDT for distributed counting.

    Each node maintains a vector of counts: one entry per node.
    - To increment: increase YOUR OWN entry
    - To read the total: sum all entries
    - To merge with another node: take element-wise max

    Properties:
    - No coordination needed between nodes
    - Merge is idempotent, commutative, and associative
    - Guaranteed to converge (all nodes see the same total after syncing)
    - No lost updates — each node only modifies its own entry
    """

    def __init__(self, node_id: str, all_nodes: list):
        self.node_id = node_id
        self.counts = {node: 0 for node in all_nodes}

    def increment(self, amount: int = 1):
        """Increment this node's own counter."""
        self.counts[self.node_id] += amount

    def value(self) -> int:
        """Read the total count (sum of all entries)."""
        return sum(self.counts.values())

    def merge(self, other: 'GCounter'):
        """
        Merge another G-Counter into this one.
        Take element-wise max — this is the key CRDT property!

        Why max works:
        - If node A incremented 5 times and node B knows about 3,
          max(5, 3) = 5 — we keep the latest information.
        - max is idempotent: max(a, a) = a — re-merging is safe
        - max is commutative: max(a, b) = max(b, a) — order doesn't matter
        - max is associative: max(a, max(b, c)) = max(max(a, b), c)
        """
        for node in self.counts:
            self.counts[node] = max(self.counts[node], other.counts.get(node, 0))

    def __repr__(self):
        entries = ', '.join(f'{k}:{v}' for k, v in sorted(self.counts.items()))
        return f"GCounter({self.node_id}, [{entries}], total={self.value()})"


# === Simulation: 3 nodes independently counting likes ===
nodes = ['A', 'B', 'C']
counters = {n: GCounter(n, nodes) for n in nodes}

print("=== G-Counter Simulation: Distributed Like Counter ===")
print()

# Phase 1: Independent increments (no communication)
random.seed(42)
print("Phase 1: Independent increments (no syncing)")
for _ in range(5):
    node = random.choice(nodes)
    counters[node].increment()
    print(f"  Like on {node}: {counters[node]}")

print()
print("Each node sees a different total:")
for n in nodes:
    print(f"  {counters[n]}")

# Phase 2: Sync A <-> B
print()
print("Phase 2: Sync A <-> B")
counters['A'].merge(counters['B'])
counters['B'].merge(counters['A'])
for n in nodes:
    print(f"  {counters[n]}")
print("  A and B now agree, but C is still behind")

# Phase 3: More increments
print()
print("Phase 3: More increments")
counters['C'].increment()
counters['C'].increment()
counters['A'].increment()
for n in nodes:
    print(f"  {counters[n]}")

# Phase 4: Full sync
print()
print("Phase 4: Full sync (all pairs)")
counters['A'].merge(counters['B'])
counters['B'].merge(counters['A'])
counters['B'].merge(counters['C'])
counters['C'].merge(counters['B'])
counters['A'].merge(counters['C'])
counters['C'].merge(counters['A'])
print("After full sync:")
for n in nodes:
    print(f"  {counters[n]}")

all_agree = len(set(c.value() for c in counters.values())) == 1
print(f"\\nAll nodes agree: {all_agree}")
print(f"Total likes: {counters['A'].value()}")
print(f"No likes were lost, despite no coordination during counting!")
`

const pnCounterImplementation = `class GCounter:
    """Grow-only counter (compact implementation)."""
    def __init__(self, node_id, all_nodes):
        self.node_id = node_id
        self.counts = {n: 0 for n in all_nodes}

    def increment(self, amount=1):
        self.counts[self.node_id] += amount

    def value(self):
        return sum(self.counts.values())

    def merge(self, other):
        for n in self.counts:
            self.counts[n] = max(self.counts[n], other.counts.get(n, 0))

    def __repr__(self):
        return '{' + ', '.join(f'{k}:{v}' for k, v in sorted(self.counts.items())) + '}'


class PNCounter:
    """
    PN-Counter: supports both increment AND decrement.

    Uses two G-Counters:
    - P (positive): tracks increments
    - N (negative): tracks decrements
    - Value = P.value() - N.value()

    Since both P and N are G-Counters (only grow), they each converge
    independently. The difference also converges.
    """

    def __init__(self, node_id: str, all_nodes: list):
        self.node_id = node_id
        self.P = GCounter(node_id, all_nodes)  # increments
        self.N = GCounter(node_id, all_nodes)  # decrements

    def increment(self, amount: int = 1):
        """Like / upvote / add."""
        self.P.increment(amount)

    def decrement(self, amount: int = 1):
        """Unlike / downvote / remove."""
        self.N.increment(amount)  # Note: N is a G-Counter, so we INCREMENT it

    def value(self) -> int:
        """Net count = total increments - total decrements."""
        return self.P.value() - self.N.value()

    def merge(self, other: 'PNCounter'):
        """Merge another PN-Counter: merge P with P, N with N."""
        self.P.merge(other.P)
        self.N.merge(other.N)

    def __repr__(self):
        return f"PNCounter({self.node_id}, P={self.P}, N={self.N}, value={self.value()})"


# === Simulation: Likes and Unlikes on a Viral Post ===
import random
random.seed(123)

nodes = ['US-East', 'US-West', 'Europe']
counters = {n: PNCounter(n, nodes) for n in nodes}

print("=== PN-Counter: Distributed Likes & Unlikes ===")
print()

# Simulate activity
actions = []
for _ in range(20):
    node = random.choice(nodes)
    if random.random() < 0.7:  # 70% likes, 30% unlikes
        counters[node].increment()
        actions.append(f"LIKE on {node}")
    else:
        counters[node].decrement()
        actions.append(f"UNLIKE on {node}")

print("Activity log (no syncing yet):")
for a in actions:
    print(f"  {a}")

print()
print("Before sync — each node sees different net count:")
for n in nodes:
    c = counters[n]
    print(f"  {n}: likes={c.P.value()}, unlikes={c.N.value()}, net={c.value()}")

# Full sync
print()
print("After full sync:")
for n1 in nodes:
    for n2 in nodes:
        if n1 != n2:
            counters[n1].merge(counters[n2])

for n in nodes:
    c = counters[n]
    print(f"  {n}: likes={c.P.value()}, unlikes={c.N.value()}, net={c.value()}")

all_agree = len(set(c.value() for c in counters.values())) == 1
print(f"\\nAll nodes agree: {all_agree}")
print(f"Net score: {counters[nodes[0]].value()}")
print()

# Prove convergence with random sync order
print("=== Convergence Proof: Random sync order ===")
print()

for trial in range(3):
    # Reset
    counters2 = {n: PNCounter(n, nodes) for n in nodes}

    # Same actions
    random.seed(42 + trial)
    for _ in range(50):
        node = random.choice(nodes)
        if random.random() < 0.65:
            counters2[node].increment()
        else:
            counters2[node].decrement()

    # Random sync order
    sync_pairs = [(n1, n2) for n1 in nodes for n2 in nodes if n1 != n2]
    random.shuffle(sync_pairs)
    for n1, n2 in sync_pairs:
        counters2[n1].merge(counters2[n2])
    # Second pass to ensure full propagation
    random.shuffle(sync_pairs)
    for n1, n2 in sync_pairs:
        counters2[n1].merge(counters2[n2])

    totals = [counters2[n].value() for n in nodes]
    print(f"  Trial {trial+1}: sync order = random -> all nodes see {totals[0]}? {len(set(totals)) == 1}")

print()
print("No matter what order syncs happen, the final value always converges!")
print("This is the mathematical guarantee of CRDTs.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function GCounter() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          G-Counter: Conflict-Free Distributed Counting
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          How do you count total likes on a viral post when the counter is replicated
          across five datacenters? CRDTs (Conflict-free Replicated Data Types) let each
          node count independently and merge later — with a mathematical guarantee that
          no updates are ever lost.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Counting Across Datacenters</h2>
        <p className="text-gray-300 leading-relaxed">
          A viral video on YouTube gets <strong className="text-white">10,000 likes per second</strong> from
          users around the world. The like counter is replicated across 5 datacenters
          (US-East, US-West, Europe, Asia, Australia) so users everywhere see low-latency
          responses. Each datacenter receives likes independently.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The datacenters cannot coordinate in real-time. Network latency between US and
          Europe is 80-100ms. Network partitions happen. You cannot use a single source of
          truth because it would be a bottleneck and a single point of failure.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-2">The core challenge</h3>
          <p className="text-gray-300">
            Two datacenters each read the counter as 100, each independently increment
            to 101, then replicate. Result: <strong className="text-red-400">counter = 101 instead of 102</strong>.
            One like was lost. This is the classic "lost update" problem.
          </p>
        </div>
      </section>

      {/* ---- Section: Race Condition ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Naive Approach: Shared Counter</h2>
        <p className="text-gray-300 leading-relaxed">
          Step through the race condition that happens when two datacenters try to
          increment a shared counter without coordination.
        </p>
        <RaceConditionSketch />
      </section>

      {/* ---- Section: CRDTs Introduction ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">CRDTs: The Mathematical Solution</h2>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            A Conflict-free Replicated Data Type (CRDT) is a data structure that can be
            independently modified on different nodes and merged without conflicts.
            No coordination needed. No locks. No consensus protocol. The merge function
            is mathematically guaranteed to converge to the correct result.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The key properties that make a merge function "conflict-free":
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>
            <strong className="text-white">Commutative</strong>: merge(A, B) = merge(B, A) — order of syncing does not matter
          </li>
          <li>
            <strong className="text-white">Associative</strong>: merge(A, merge(B, C)) = merge(merge(A, B), C) — grouping does not matter
          </li>
          <li>
            <strong className="text-white">Idempotent</strong>: merge(A, A) = A — re-syncing the same data is harmless
          </li>
        </ul>
        <p className="text-gray-300 leading-relaxed">
          Any merge function with these three properties guarantees <strong className="text-white">eventual
          consistency</strong>: no matter what order or how many times nodes sync, they will
          all converge to the same value.
        </p>
      </section>

      {/* ---- Section: G-Counter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The G-Counter: Grow-Only Counter</h2>
        <p className="text-gray-300 leading-relaxed">
          The G-Counter is the simplest CRDT. Instead of a single number, each node
          maintains a <strong className="text-white">vector</strong> — one entry per node in the system.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm space-y-2 text-gray-300">
          <p className="text-gray-400"># G-Counter operations</p>
          <p><span className="text-emerald-400">increment()</span>: my_vector[my_id] += 1 &nbsp;&nbsp;<span className="text-gray-500"># only touch YOUR OWN entry</span></p>
          <p><span className="text-emerald-400">value()</span>: &nbsp;&nbsp;&nbsp;sum(my_vector) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-gray-500"># total = sum of all entries</span></p>
          <p><span className="text-emerald-400">merge(other)</span>: for each i: my_vector[i] = max(my_vector[i], other[i]) <span className="text-gray-500"># element-wise max</span></p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Why does this work? Each node only modifies its own entry, so there is never a
          write conflict. The merge function takes the element-wise <code className="text-emerald-400">max</code>,
          which is commutative, associative, and idempotent. No increment is ever lost.
        </p>
      </section>

      {/* ---- Section: Interactive G-Counter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive G-Counter</h2>
        <p className="text-gray-300 leading-relaxed">
          Click "Like on A/B/C" to increment a node's counter. Each node only modifies
          its own row in the vector. Click "Sync" to merge two nodes — they exchange
          vectors and take the element-wise max. Try different orderings and verify that
          the total always converges correctly after a full sync.
        </p>
        <GCounterSketch />
        <p className="text-gray-400 text-sm">
          Try: click "Like on A" 3 times, "Like on B" 2 times, "Like on C" 1 time.
          Then sync in any order — all nodes will agree on total = 6.
        </p>
      </section>

      {/* ---- Section: Convergence Timeline ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Convergence Timeline</h2>
        <p className="text-gray-300 leading-relaxed">
          Watch a pre-scripted scenario where three nodes independently receive likes
          and periodically sync. Notice how nodes can have different totals at any point
          in time, but after syncing, they always converge to the same correct total.
        </p>
        <ConvergenceSketch />
      </section>

      {/* ---- Section: PN-Counter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">PN-Counter: Supporting Decrements</h2>
        <p className="text-gray-300 leading-relaxed">
          A G-Counter can only grow — you cannot "unlike" a post. The <strong className="text-white">PN-Counter</strong> solves
          this by using <em>two</em> G-Counters:
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <div className="font-mono text-sm text-gray-300 space-y-1">
            <p><span className="text-emerald-400">P</span> — a G-Counter tracking increments (likes)</p>
            <p><span className="text-red-400">N</span> — a G-Counter tracking decrements (unlikes)</p>
            <p><span className="text-yellow-400">value</span> = P.value() - N.value()</p>
          </div>
        </div>
        <p className="text-gray-300 leading-relaxed">
          Both P and N are G-Counters, so they each converge independently. The difference
          also converges. Merging a PN-Counter means merging P with P and N with N.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-2">Example</h3>
          <div className="font-mono text-sm text-gray-300 space-y-1">
            <p>Node A: like, like, unlike &nbsp;&nbsp;{'->'} P=[2,0,0] N=[1,0,0] {'->'} net = 2 - 1 = 1</p>
            <p>Node B: like &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'->'} P=[0,1,0] N=[0,0,0] {'->'} net = 1 - 0 = 1</p>
            <p>After merge: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;P=[2,1,0] N=[1,0,0] {'->'} net = 3 - 1 = 2</p>
          </div>
        </div>
      </section>

      {/* ---- Python: G-Counter Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: G-Counter Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete G-Counter implementation with increment, value, and merge operations.
          The simulation shows 3 nodes independently counting likes and periodically syncing.
        </p>
        <PythonCell defaultCode={gcounterImplementation} />
      </section>

      {/* ---- Python: PN-Counter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: PN-Counter (Likes and Unlikes)</h2>
        <p className="text-gray-300 leading-relaxed">
          The PN-Counter extends the G-Counter to support both increments and decrements.
          The simulation includes a convergence proof — no matter what order syncs happen,
          the final value is always the same.
        </p>
        <PythonCell defaultCode={pnCounterImplementation} />
      </section>

      {/* ---- Section: Other CRDTs ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Beyond Counters: The CRDT Family</h2>
        <p className="text-gray-300 leading-relaxed">
          Counters are just the beginning. The same principles extend to much richer data types:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">G-Set / OR-Set</h3>
            <p className="text-gray-300 text-sm">
              A grow-only set (G-Set) only supports adding elements. The Observed-Remove Set
              (OR-Set) supports both add and remove by tagging each addition with a unique ID.
              Used for shopping carts, friend lists, collaborative document element tracking.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">LWW-Register</h3>
            <p className="text-gray-300 text-sm">
              Last-Writer-Wins Register — each write is timestamped, and merge picks the latest.
              Simple but lossy: concurrent writes to the same key discard one value. Used by
              Cassandra for individual cell values.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">MV-Register</h3>
            <p className="text-gray-300 text-sm">
              Multi-Value Register — on conflict, keeps ALL concurrent values (siblings).
              The application resolves the conflict. Used by Riak and DynamoDB for handling
              concurrent writes without losing data.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Sequence CRDTs (RGA, LSEQ)</h3>
            <p className="text-gray-300 text-sm">
              Support concurrent insertions and deletions in an ordered list. The foundation
              of real-time collaborative editing in tools like Figma, Google Docs (via
              operational transformation + CRDTs), and Yjs.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Apache Cassandra</h3>
            <p className="text-gray-300 text-sm">
              Cassandra's counter columns implement a PN-Counter-like CRDT. Each node tracks
              its local increments/decrements and merges during read repair and anti-entropy.
              This is how Cassandra provides distributed counters without consensus.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Riak</h3>
            <p className="text-gray-300 text-sm">
              Riak was one of the first databases to offer native CRDT support. Its data types
              include counters (PN-Counter), sets (OR-Set), maps (recursive CRDTs), and
              registers (LWW-Register). All merge automatically on read.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Redis (CRDB)</h3>
            <p className="text-gray-300 text-sm">
              Redis Enterprise's Active-Active geo-distribution uses CRDTs to replicate
              data across regions without conflicts. Counters, strings, sets, sorted sets,
              and lists all have CRDT-based merge semantics.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Figma / Yjs</h3>
            <p className="text-gray-300 text-sm">
              Figma uses CRDTs for real-time multiplayer editing. Yjs is a popular open-source
              CRDT framework used by many collaborative editors (Notion, Tiptap). Each user's
              edits are modeled as CRDT operations that merge without conflicts.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section: When to Use ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">When to Use CRDTs</h2>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-3">
          <div>
            <h3 className="text-emerald-400 font-medium">Good fit</h3>
            <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 mt-1">
              <li>Counters, likes, views, votes across regions</li>
              <li>Collaborative editing (text, drawing, spreadsheets)</li>
              <li>Shopping carts in geo-distributed e-commerce</li>
              <li>Device sync (offline-first mobile apps)</li>
              <li>Any system where availability trumps strict consistency</li>
            </ul>
          </div>
          <div>
            <h3 className="text-red-400 font-medium">Poor fit</h3>
            <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 mt-1">
              <li>Bank account balances (need strong consistency — cannot go negative)</li>
              <li>Unique ID generation (requires global coordination)</li>
              <li>Inventory management with strict stock limits</li>
              <li>Any case where "temporary inconsistency" is unacceptable</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>A shared counter across distributed nodes suffers from lost updates without coordination</li>
          <li>CRDTs solve this by designing data structures whose merge function is commutative, associative, and idempotent</li>
          <li>G-Counter: each node owns one entry in a vector; increment your own, merge with element-wise max</li>
          <li>PN-Counter: two G-Counters (one for increments, one for decrements) to support likes AND unlikes</li>
          <li>Convergence is mathematically guaranteed regardless of sync timing or ordering</li>
          <li>Used in production by Cassandra, Riak, Redis, Figma, and many collaborative editing tools</li>
          <li>CRDTs trade strong consistency for availability — they are the foundation of AP systems in the CAP theorem</li>
        </ul>
      </section>
    </div>
  )
}
