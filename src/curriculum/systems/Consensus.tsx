import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/consensus',
  title: 'Consistency & Consensus',
  description:
    'Linearizability, CAP theorem, ordering with Lamport and vector clocks, and consensus algorithms like Raft',
  track: 'systems',
  order: 8,
  tags: [
    'consensus',
    'linearizability',
    'cap',
    'raft',
    'lamport-clocks',
    'vector-clocks',
    'distributed',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const NODE_A: [number, number, number] = [99, 102, 241] // indigo
const NODE_B: [number, number, number] = [236, 72, 153] // pink
const NODE_C: [number, number, number] = [34, 197, 94] // green
const LEADER: [number, number, number] = [250, 204, 21] // yellow
const TEXT_C: [number, number, number] = [148, 163, 184] // slate-400
const ACCENT: [number, number, number] = [250, 204, 21] // yellow
const ABORT_C: [number, number, number] = [239, 68, 68] // red
const PURPLE: [number, number, number] = [168, 85, 247]
const NODE_COLORS: [number, number, number][] = [NODE_A, NODE_B, NODE_C]

/* ------------------------------------------------------------------ */
/* Section 1 — Linearizability Timeline p5 Sketch                      */
/* ------------------------------------------------------------------ */

interface ClientOp {
  client: string
  type: 'write' | 'read'
  value: string
  start: number
  end: number
  linPoint?: number // linearization point
  color: [number, number, number]
}

function LinearizabilitySketch() {
  const [showLinear, setShowLinear] = useState(true)
  const showLinRef = useRef(showLinear)
  showLinRef.current = showLinear

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 380

    // Two scenarios: linearizable and non-linearizable
    const linearOps: ClientOp[] = [
      { client: 'C1', type: 'write', value: 'x=1', start: 50, end: 200, linPoint: 120, color: NODE_A },
      { client: 'C2', type: 'read', value: 'x=0', start: 20, end: 100, linPoint: 60, color: NODE_B },
      { client: 'C2', type: 'read', value: 'x=1', start: 150, end: 280, linPoint: 210, color: NODE_B },
      { client: 'C3', type: 'write', value: 'x=2', start: 250, end: 400, linPoint: 320, color: NODE_C },
      { client: 'C1', type: 'read', value: 'x=2', start: 350, end: 480, linPoint: 410, color: NODE_A },
    ]

    const nonLinearOps: ClientOp[] = [
      { client: 'C1', type: 'write', value: 'x=1', start: 50, end: 200, linPoint: 120, color: NODE_A },
      { client: 'C2', type: 'read', value: 'x=1', start: 100, end: 250, linPoint: 170, color: NODE_B },
      { client: 'C3', type: 'read', value: 'x=0', start: 180, end: 350, linPoint: 260, color: NODE_C },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const isLinear = showLinRef.current
      const ops = isLinear ? linearOps : nonLinearOps
      p.background(...BG)

      // Title
      p.noStroke()
      p.fill(isLinear ? NODE_C[0] : ABORT_C[0], isLinear ? NODE_C[1] : ABORT_C[1], isLinear ? NODE_C[2] : ABORT_C[2])
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        isLinear ? 'Linearizable Execution' : 'Non-Linearizable Execution',
        10,
        10,
      )

      // Client lanes
      const clients = ['C1', 'C2', 'C3']
      const laneY = (client: string) => 80 + clients.indexOf(client) * 90
      const timeScale = (p.width - 80) / 520

      for (const c of clients) {
        const y = laneY(c)
        p.fill(...TEXT_C)
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(c, 40, y)

        // Lane line
        p.stroke(...GRID_C)
        p.strokeWeight(1)
        p.line(50, y, p.width - 20, y)
      }

      // Time axis
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(50, H - 30, p.width - 20, H - 30)
      p.noStroke()
      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('time --->', p.width / 2, H - 20)

      // Draw operations
      for (const op of ops) {
        const y = laneY(op.client)
        const x1 = 50 + op.start * timeScale
        const x2 = 50 + op.end * timeScale

        // Operation bar
        p.stroke(...op.color)
        p.strokeWeight(4)
        p.line(x1, y, x2, y)

        // Endpoints
        p.noStroke()
        p.fill(...op.color)
        p.ellipse(x1, y, 8, 8)
        p.ellipse(x2, y, 8, 8)

        // Label
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        const label = `${op.type === 'write' ? 'W' : 'R'}(${op.value})`
        p.text(label, (x1 + x2) / 2, y - 8)

        // Linearization point
        if (op.linPoint !== undefined) {
          const lx = 50 + op.linPoint * timeScale
          p.stroke(...ACCENT)
          p.strokeWeight(2)
          p.line(lx, y - 15, lx, y + 15)
          p.noStroke()
          p.fill(...ACCENT)
          p.ellipse(lx, y, 6, 6)
        }
      }

      // Explanation for non-linear case
      if (!isLinear) {
        p.noStroke()
        p.fill(...ABORT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text(
          'C2 reads x=1, but later C3 reads x=0. Once a read returns x=1,',
          p.width / 2,
          H - 70,
        )
        p.text(
          'all subsequent reads must also return x=1 (or newer). VIOLATION!',
          p.width / 2,
          H - 55,
        )
      } else {
        p.noStroke()
        p.fill(...ACCENT)
        p.textSize(11)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text(
          'Yellow markers = linearization points. All points form a valid sequential order.',
          10,
          H - 35,
        )
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowLinear(true)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                showLinear
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              LINEARIZABLE
            </button>
            <button
              onClick={() => setShowLinear(false)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                !showLinear
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              NON-LINEARIZABLE
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — CAP Theorem p5 Sketch                                   */
/* ------------------------------------------------------------------ */

function CAPSketch() {
  const [partitioned, setPartitioned] = useState(false)
  const [choice, setChoice] = useState<'consistent' | 'available'>('consistent')
  const partRef = useRef(partitioned)
  const choiceRef = useRef(choice)
  partRef.current = partitioned
  choiceRef.current = choice

  const sketch = useCallback((p: p5) => {
    const W = 700
    const H = 400

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const part = partRef.current
      const ch = choiceRef.current
      p.background(...BG)

      const cx = p.width / 2
      // Three nodes in a triangle
      const nodes = [
        { x: cx, y: 80, label: 'Node 1', data: 'x = 42' },
        { x: cx - 160, y: 280, label: 'Node 2', data: 'x = 42' },
        { x: cx + 160, y: 280, label: 'Node 3', data: 'x = 42' },
      ]

      // During partition, Node 3 might have stale data
      if (part && ch === 'available') {
        nodes[2].data = 'x = 37 (stale!)'
      }

      // Draw network links
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const isPartitionedLink =
            part && ((i === 0 && j === 2) || (i === 1 && j === 2))

          if (isPartitionedLink) {
            // Broken link
            p.stroke(...ABORT_C)
            p.strokeWeight(2)
            const ctx = p.drawingContext as CanvasRenderingContext2D; ctx.setLineDash([6, 6])
            p.line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)
            ctx.setLineDash([])

            // X mark in center
            const mx = (nodes[i].x + nodes[j].x) / 2
            const my = (nodes[i].y + nodes[j].y) / 2
            p.strokeWeight(3)
            p.line(mx - 8, my - 8, mx + 8, my + 8)
            p.line(mx - 8, my + 8, mx + 8, my - 8)
          } else {
            p.stroke(100, 116, 139)
            p.strokeWeight(2)
            p.line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < 3; i++) {
        const n = nodes[i]
        const isIsolated = part && i === 2

        p.noStroke()
        if (isIsolated && ch === 'consistent') {
          // Rejecting writes — shown dimmed
          p.fill(100, 100, 100)
        } else if (isIsolated && ch === 'available') {
          p.fill(...ABORT_C) // accepting writes but diverging
        } else {
          const [r, g, b] = NODE_COLORS[i]; p.fill(r, g, b)
        }
        p.ellipse(n.x, n.y, 70, 70)

        p.fill(255)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(n.label, n.x, n.y - 10)
        p.textSize(10)
        p.text(n.data, n.x, n.y + 10)
      }

      // Status and explanation
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)

      if (!part) {
        p.fill(...NODE_C)
        p.text(
          'Normal operation: all nodes connected, fully consistent and available.',
          cx,
          H - 70,
        )
      } else if (ch === 'consistent') {
        p.fill(...NODE_A)
        p.text('CP choice: Node 3 rejects reads/writes (unavailable).', cx, H - 80)
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text(
          'Clients connected to Node 3 get errors. But no stale data is served.',
          cx,
          H - 58,
        )
      } else {
        p.fill(...ABORT_C)
        p.text('AP choice: Node 3 still serves requests (available, but inconsistent).', cx, H - 80)
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text(
          'Node 3 returns stale x=37 while Nodes 1&2 have x=42. Data diverges!',
          cx,
          H - 58,
        )
      }

      // Partition label
      if (part) {
        p.fill(...ABORT_C)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('NETWORK PARTITION', cx, 12)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setPartitioned((p) => !p)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  partitioned
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {partitioned ? 'HEAL PARTITION' : 'CAUSE PARTITION'}
              </button>
            </div>
            {partitioned && (
              <div className="flex gap-2">
                <button
                  onClick={() => setChoice('consistent')}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    choice === 'consistent'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  CP (Consistent)
                </button>
                <button
                  onClick={() => setChoice('available')}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    choice === 'available'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  AP (Available)
                </button>
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Lamport / Vector Clocks p5 Sketch                       */
/* ------------------------------------------------------------------ */

interface ProcessEvent {
  process: number
  time: number // visual x position
  lamport: number
  vector: number[]
  label: string
  sendTo?: number // if this is a send event
  receiveFrom?: number // which process sent to this
}

function CausalitySketch() {
  const [showVector, setShowVector] = useState(false)
  const showVectorRef = useRef(showVector)
  showVectorRef.current = showVector

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 420

    // Three processes with events, messages, and clock values
    const events: ProcessEvent[] = [
      // Process 0 events
      { process: 0, time: 0, lamport: 1, vector: [1, 0, 0], label: 'a', sendTo: 1 },
      { process: 0, time: 2, lamport: 2, vector: [2, 0, 0], label: 'b' },
      { process: 0, time: 5, lamport: 5, vector: [3, 3, 0], label: 'e', receiveFrom: 1 },

      // Process 1 events
      { process: 1, time: 1, lamport: 2, vector: [1, 1, 0], label: 'c', receiveFrom: 0 },
      { process: 1, time: 3, lamport: 3, vector: [1, 2, 0], label: 'd', sendTo: 0 },
      { process: 1, time: 4, lamport: 4, vector: [1, 3, 0], label: 'f', sendTo: 2 },

      // Process 2 events
      { process: 2, time: 2, lamport: 1, vector: [0, 0, 1], label: 'g' },
      { process: 2, time: 5, lamport: 5, vector: [1, 3, 2], label: 'h', receiveFrom: 1 },
    ]

    // Message arrows: from sender to receiver
    const messages: { from: ProcessEvent; to: ProcessEvent }[] = [
      { from: events[0], to: events[3] }, // a -> c
      { from: events[4], to: events[2] }, // d -> e
      { from: events[5], to: events[7] }, // f -> h
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const sv = showVectorRef.current
      p.background(...BG)

      const LEFT = 80
      const RIGHT = p.width - 40
      const timeScale = (RIGHT - LEFT) / 6
      const processY = (proc: number) => 80 + proc * 120

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        sv ? 'Vector Clocks — capture causality' : 'Lamport Timestamps — total order but miss concurrency',
        10,
        10,
      )

      // Process lines
      for (let i = 0; i < 3; i++) {
        const y = processY(i)
        p.stroke(...GRID_C)
        p.strokeWeight(2)
        p.line(LEFT, y, RIGHT, y)

        p.noStroke()
        { const [r, g, b] = NODE_COLORS[i]; p.fill(r, g, b) }
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`P${i}`, LEFT - 12, y)
      }

      // Message arrows
      for (const msg of messages) {
        const x1 = LEFT + msg.from.time * timeScale
        const y1 = processY(msg.from.process)
        const x2 = LEFT + msg.to.time * timeScale
        const y2 = processY(msg.to.process)

        p.stroke(...ACCENT)
        p.strokeWeight(1.5)
        p.line(x1, y1, x2, y2)

        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const arrowSize = 8
        p.noStroke()
        p.fill(...ACCENT)
        p.triangle(
          x2,
          y2,
          x2 - arrowSize * Math.cos(angle - 0.4),
          y2 - arrowSize * Math.sin(angle - 0.4),
          x2 - arrowSize * Math.cos(angle + 0.4),
          y2 - arrowSize * Math.sin(angle + 0.4),
        )
      }

      // Events
      for (const ev of events) {
        const x = LEFT + ev.time * timeScale
        const y = processY(ev.process)

        p.noStroke()
        { const [r, g, b] = NODE_COLORS[ev.process]; p.fill(r, g, b) }
        p.ellipse(x, y, 18, 18)

        // Event label
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(ev.label, x, y)

        // Clock value
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        if (sv) {
          p.fill(...PURPLE)
          p.text(`[${ev.vector.join(',')}]`, x, y + 14)
        } else {
          p.fill(...ACCENT)
          p.text(`L=${ev.lamport}`, x, y + 14)
        }
      }

      // Explanation
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)

      if (!sv) {
        p.fill(...ACCENT)
        p.text(
          'Lamport: b has L=2, g has L=1, so L says g < b. But they are CONCURRENT (no causal link)!',
          10,
          H - 22,
        )
        p.fill(...TEXT_C)
        p.text(
          'Lamport timestamps give total order but cannot distinguish causal from concurrent events.',
          10,
          H - 6,
        )
      } else {
        p.fill(...PURPLE)
        p.text(
          'Vector clocks: b=[2,0,0] vs g=[0,0,1]. Neither dominates => CONCURRENT! Correctly identified.',
          10,
          H - 22,
        )
        p.fill(...TEXT_C)
        p.text(
          'v1 <= v2 iff every component of v1 <= v2. If neither dominates, events are concurrent.',
          10,
          H - 6,
        )
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
              onClick={() => setShowVector(false)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                !showVector
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              LAMPORT TIMESTAMPS
            </button>
            <button
              onClick={() => setShowVector(true)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                showVector
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              VECTOR CLOCKS
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Raft Consensus Algorithm p5 Sketch                      */
/* ------------------------------------------------------------------ */

type RaftNodeState = 'follower' | 'candidate' | 'leader'

interface RaftNode {
  x: number
  y: number
  id: number
  state: RaftNodeState
  term: number
  votedFor: number | null
  log: string[]
  voteCount: number
}

interface RaftStep {
  description: string
  nodes: RaftNode[]
  messages?: { from: number; to: number; label: string; color: [number, number, number] }[]
}

function buildRaftSteps(cx: number): RaftStep[] {
  const nodePositions = [
    { x: cx, y: 70 },
    { x: cx - 170, y: 200 },
    { x: cx + 170, y: 200 },
    { x: cx - 100, y: 320 },
    { x: cx + 100, y: 320 },
  ]

  const makeNodes = (
    states: RaftNodeState[],
    terms: number[],
    votedFor: (number | null)[],
    logs: string[][],
    voteCounts: number[],
  ): RaftNode[] =>
    nodePositions.map((pos, i) => ({
      ...pos,
      id: i,
      state: states[i],
      term: terms[i],
      votedFor: votedFor[i],
      log: logs[i],
      voteCount: voteCounts[i],
    }))

  return [
    {
      description: 'All nodes start as followers in term 1. Node 0 is the leader.',
      nodes: makeNodes(
        ['leader', 'follower', 'follower', 'follower', 'follower'],
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 0, 0, 0],
      ),
    },
    {
      description: 'Leader (Node 0) crashes! Followers detect missing heartbeats.',
      nodes: makeNodes(
        ['follower', 'follower', 'follower', 'follower', 'follower'],
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 0, 0, 0],
      ),
    },
    {
      description: 'Node 2 times out first. Increments term to 2, becomes candidate, votes for itself.',
      nodes: makeNodes(
        ['follower', 'follower', 'candidate', 'follower', 'follower'],
        [1, 1, 2, 1, 1],
        [0, 0, 2, 0, 0],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 1, 0, 0],
      ),
    },
    {
      description: 'Node 2 sends RequestVote to all other nodes for term 2.',
      nodes: makeNodes(
        ['follower', 'follower', 'candidate', 'follower', 'follower'],
        [1, 1, 2, 1, 1],
        [0, 0, 2, 0, 0],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 1, 0, 0],
      ),
      messages: [
        { from: 2, to: 0, label: 'RequestVote(term=2)', color: PURPLE },
        { from: 2, to: 1, label: 'RequestVote(term=2)', color: PURPLE },
        { from: 2, to: 3, label: 'RequestVote(term=2)', color: PURPLE },
        { from: 2, to: 4, label: 'RequestVote(term=2)', color: PURPLE },
      ],
    },
    {
      description: 'Nodes 1, 3, 4 grant their vote (haven\'t voted in term 2 yet). Node 0 is down.',
      nodes: makeNodes(
        ['follower', 'follower', 'candidate', 'follower', 'follower'],
        [1, 2, 2, 2, 2],
        [0, 2, 2, 2, 2],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 4, 0, 0],
      ),
      messages: [
        { from: 1, to: 2, label: 'Vote YES', color: NODE_C },
        { from: 3, to: 2, label: 'Vote YES', color: NODE_C },
        { from: 4, to: 2, label: 'Vote YES', color: NODE_C },
      ],
    },
    {
      description: 'Node 2 has 4 votes (majority of 5). Becomes LEADER for term 2!',
      nodes: makeNodes(
        ['follower', 'follower', 'leader', 'follower', 'follower'],
        [1, 2, 2, 2, 2],
        [0, 2, 2, 2, 2],
        [['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1'], ['SET x=1']],
        [0, 0, 4, 0, 0],
      ),
    },
    {
      description: 'New leader receives client request: SET y=7. Appends to its log.',
      nodes: makeNodes(
        ['follower', 'follower', 'leader', 'follower', 'follower'],
        [1, 2, 2, 2, 2],
        [0, 2, 2, 2, 2],
        [['SET x=1'], ['SET x=1'], ['SET x=1', 'SET y=7'], ['SET x=1'], ['SET x=1']],
        [0, 0, 4, 0, 0],
      ),
    },
    {
      description: 'Leader replicates "SET y=7" to followers via AppendEntries.',
      nodes: makeNodes(
        ['follower', 'follower', 'leader', 'follower', 'follower'],
        [1, 2, 2, 2, 2],
        [0, 2, 2, 2, 2],
        [['SET x=1'], ['SET x=1'], ['SET x=1', 'SET y=7'], ['SET x=1'], ['SET x=1']],
        [0, 0, 4, 0, 0],
      ),
      messages: [
        { from: 2, to: 1, label: 'AppendEntries(SET y=7)', color: LEADER },
        { from: 2, to: 3, label: 'AppendEntries(SET y=7)', color: LEADER },
        { from: 2, to: 4, label: 'AppendEntries(SET y=7)', color: LEADER },
      ],
    },
    {
      description: 'Followers 1, 3, 4 append entry and ACK. Majority (3/5) confirmed — entry is COMMITTED.',
      nodes: makeNodes(
        ['follower', 'follower', 'leader', 'follower', 'follower'],
        [1, 2, 2, 2, 2],
        [0, 2, 2, 2, 2],
        [
          ['SET x=1'],
          ['SET x=1', 'SET y=7'],
          ['SET x=1', 'SET y=7'],
          ['SET x=1', 'SET y=7'],
          ['SET x=1', 'SET y=7'],
        ],
        [0, 0, 4, 0, 0],
      ),
      messages: [
        { from: 1, to: 2, label: 'ACK', color: NODE_C },
        { from: 3, to: 2, label: 'ACK', color: NODE_C },
        { from: 4, to: 2, label: 'ACK', color: NODE_C },
      ],
    },
  ]
}

function RaftSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(0)
  stepRef.current = step

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 440

    let raftSteps: RaftStep[] = []

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      const cw = Math.min(pw, W)
      p.createCanvas(cw, H)
      raftSteps = buildRaftSteps(cw / 2)
    }

    p.draw = () => {
      if (raftSteps.length === 0) {
        raftSteps = buildRaftSteps(p.width / 2)
      }
      const s = stepRef.current
      const data = raftSteps[Math.min(s, raftSteps.length - 1)]
      p.background(...BG)

      // Description
      p.noStroke()
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text(data.description, p.width / 2, 8, p.width - 40)

      // Draw message lines first (behind nodes)
      if (data.messages) {
        for (const msg of data.messages) {
          const fromNode = data.nodes[msg.from]
          const toNode = data.nodes[msg.to]
          { const [r, g, b] = msg.color; p.stroke(r, g, b) }
          p.strokeWeight(2)
          p.line(fromNode.x, fromNode.y, toNode.x, toNode.y)

          // Label at midpoint
          const mx = (fromNode.x + toNode.x) / 2
          const my = (fromNode.y + toNode.y) / 2
          p.noStroke()
          { const [r, g, b] = msg.color; p.fill(r, g, b) }
          p.textSize(8)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(msg.label, mx, my - 4)
        }
      }

      // Draw nodes
      const nodeRadius = 42
      for (const node of data.nodes) {
        const isDown = node.id === 0 && s >= 1 && s <= 4

        // Node circle
        p.noStroke()
        if (isDown) {
          p.fill(60, 60, 60)
        } else if (node.state === 'leader') {
          p.fill(...LEADER)
        } else if (node.state === 'candidate') {
          p.fill(...PURPLE)
        } else {
          p.fill(...NODE_A)
        }
        p.ellipse(node.x, node.y, nodeRadius * 2, nodeRadius * 2)

        // Node label
        p.fill(node.state === 'leader' ? 0 : 255)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        if (isDown) {
          p.fill(150)
          p.text('DOWN', node.x, node.y - 6)
        } else {
          p.text(`N${node.id}`, node.x, node.y - 10)
          p.textSize(9)
          p.text(node.state.toUpperCase(), node.x, node.y + 2)
          p.text(`term ${node.term}`, node.x, node.y + 14)
        }

        // Log entries (small boxes below node)
        if (!isDown) {
          const logX = node.x - ((node.log.length - 1) * 28) / 2
          for (let l = 0; l < node.log.length; l++) {
            const lx = logX + l * 28
            const ly = node.y + nodeRadius + 12
            p.fill(30, 41, 59)
            p.stroke(100, 116, 139)
            p.strokeWeight(1)
            p.rect(lx - 12, ly, 24, 16, 3)
            p.noStroke()
            p.fill(...TEXT_C)
            p.textSize(7)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${l + 1}`, lx, ly + 8)
          }
        }
      }

      // Vote count for candidate
      for (const node of data.nodes) {
        if (node.state === 'candidate' && node.voteCount > 0) {
          p.noStroke()
          p.fill(...ACCENT)
          p.textSize(11)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(`Votes: ${node.voteCount}/5`, node.x, node.y - nodeRadius - 4)
        }
      }

      // Step indicator
      p.fill(...TEXT_C)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Step ${s + 1} / ${raftSteps.length}`, 10, H - 6)
    }
  }, [])

  const maxStep = buildRaftSteps(390).length - 1

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={440}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Prev
            </button>
            <button
              onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
              className="px-3 py-1 rounded bg-yellow-600 text-white text-xs hover:bg-yellow-500"
            >
              Next Step
            </button>
            <button
              onClick={() => setStep(0)}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Reset
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* PythonCell code strings                                             */
/* ------------------------------------------------------------------ */

const lamportVectorCode = `class LamportClock:
    """Lamport logical clock for a single process."""
    def __init__(self, pid: int):
        self.pid = pid
        self.time = 0

    def tick(self) -> int:
        """Internal event: increment clock."""
        self.time += 1
        return self.time

    def send(self) -> int:
        """Send event: increment and return timestamp to attach to message."""
        self.time += 1
        return self.time

    def receive(self, msg_time: int) -> int:
        """Receive event: update clock to max(local, msg) + 1."""
        self.time = max(self.time, msg_time) + 1
        return self.time


class VectorClock:
    """Vector clock for a process in a system of N processes."""
    def __init__(self, pid: int, n: int):
        self.pid = pid
        self.clock = [0] * n

    def tick(self) -> list[int]:
        """Internal event."""
        self.clock[self.pid] += 1
        return list(self.clock)

    def send(self) -> list[int]:
        """Send event: increment own component, return copy."""
        self.clock[self.pid] += 1
        return list(self.clock)

    def receive(self, msg_clock: list[int]) -> list[int]:
        """Receive: take component-wise max, then increment own."""
        for i in range(len(self.clock)):
            self.clock[i] = max(self.clock[i], msg_clock[i])
        self.clock[self.pid] += 1
        return list(self.clock)

    @staticmethod
    def happens_before(v1: list[int], v2: list[int]) -> bool:
        """v1 -> v2 iff all components of v1 <= v2 and at least one <."""
        return all(a <= b for a, b in zip(v1, v2)) and any(a < b for a, b in zip(v1, v2))

    @staticmethod
    def concurrent(v1: list[int], v2: list[int]) -> bool:
        """Events are concurrent if neither happens-before the other."""
        return not VectorClock.happens_before(v1, v2) and not VectorClock.happens_before(v2, v1)


# === Demo: 3 processes exchanging messages ===
print("=== Lamport Timestamps ===")
L = [LamportClock(i) for i in range(3)]

# P0: event a (internal)
a_time = L[0].tick()
print(f"P0 event 'a': L={a_time}")

# P0 sends to P1
msg_time = L[0].send()
c_time = L[1].receive(msg_time)
print(f"P0 sends (L={msg_time}) -> P1 receives: L={c_time}")

# P1: event d (internal)
d_time = L[1].tick()
print(f"P1 event 'd': L={d_time}")

# P2: event g (internal, concurrent with a and d)
g_time = L[2].tick()
print(f"P2 event 'g': L={g_time}")

print(f"\\nLamport says g (L={g_time}) < d (L={d_time})")
print("But g and d are CONCURRENT — no causal relationship!")
print("Lamport clocks cannot detect concurrency.\\n")

# === Vector Clocks ===
print("=== Vector Clocks ===")
V = [VectorClock(i, 3) for i in range(3)]

# P0: event a
a_vc = V[0].tick()
print(f"P0 event 'a': VC={a_vc}")

# P0 sends to P1
msg_vc = V[0].send()
c_vc = V[1].receive(msg_vc)
print(f"P0 sends VC={msg_vc} -> P1 receives: VC={c_vc}")

# P1: event d
d_vc = V[1].tick()
print(f"P1 event 'd': VC={d_vc}")

# P2: event g (concurrent)
g_vc = V[2].tick()
print(f"P2 event 'g': VC={g_vc}")

print(f"\\nIs a -> c? {VectorClock.happens_before(a_vc, c_vc)}")
print(f"Is d concurrent with g? {VectorClock.concurrent(d_vc, g_vc)}")
print("Vector clocks correctly identify concurrent events!")

# P1 sends to P2
f_vc = V[1].send()
h_vc = V[2].receive(f_vc)
print(f"\\nP1 sends VC={f_vc} -> P2 receives: VC={h_vc}")
print(f"Is d -> h? {VectorClock.happens_before(d_vc, h_vc)}  (yes, causal chain)")
print(f"Is g -> h? {VectorClock.happens_before(g_vc, h_vc)}  (yes, same process)")
`

const raftElectionCode = `import random

class RaftNode:
    """Simplified Raft node for leader election simulation."""
    def __init__(self, node_id: int, total_nodes: int):
        self.id = node_id
        self.total = total_nodes
        self.term = 0
        self.state = "follower"  # follower, candidate, leader
        self.voted_for = None    # who we voted for in current term
        self.votes_received = 0
        self.log = []

    def start_election(self):
        """Node times out and starts an election."""
        self.term += 1
        self.state = "candidate"
        self.voted_for = self.id
        self.votes_received = 1  # vote for self
        return self.term

    def request_vote(self, candidate_id: int, candidate_term: int) -> bool:
        """Handle a RequestVote RPC."""
        if candidate_term > self.term:
            # Update term, revert to follower
            self.term = candidate_term
            self.state = "follower"
            self.voted_for = None

        if candidate_term >= self.term and self.voted_for in (None, candidate_id):
            self.voted_for = candidate_id
            return True
        return False

    def receive_vote(self, granted: bool):
        """Process a vote response."""
        if granted:
            self.votes_received += 1
        majority = self.total // 2 + 1
        if self.votes_received >= majority and self.state == "candidate":
            self.state = "leader"
            return True  # won election
        return False

    def __repr__(self):
        return f"Node {self.id}: state={self.state}, term={self.term}, votes={self.votes_received}"


def simulate_election(n_nodes: int, failing_nodes: set[int] = set(), seed: int = 42):
    """Simulate a Raft leader election."""
    random.seed(seed)
    nodes = [RaftNode(i, n_nodes) for i in range(n_nodes)]

    # One random alive node times out first
    alive = [i for i in range(n_nodes) if i not in failing_nodes]
    candidate_id = random.choice(alive)

    print(f"--- Election with {n_nodes} nodes (failed: {failing_nodes or 'none'}) ---")
    print(f"Node {candidate_id} times out and starts election\\n")

    term = nodes[candidate_id].start_election()
    print(f"Node {candidate_id} becomes candidate for term {term}")

    # Request votes from all other nodes
    for i in range(n_nodes):
        if i == candidate_id:
            continue
        if i in failing_nodes:
            print(f"  Node {i}: DOWN (no response)")
            continue

        granted = nodes[i].request_vote(candidate_id, term)
        won = nodes[candidate_id].receive_vote(granted)
        print(f"  Node {i}: vote={'YES' if granted else 'NO'} "
              f"(votes so far: {nodes[candidate_id].votes_received})")

        if won:
            print(f"\\n*** Node {candidate_id} wins election with "
                  f"{nodes[candidate_id].votes_received}/{n_nodes} votes! ***")
            break

    print()
    for node in nodes:
        status = "DOWN" if node.id in failing_nodes else str(node)
        print(status)
    print()
    return nodes


# --- Scenario 1: Normal election (5 nodes, all healthy) ---
simulate_election(5)

# --- Scenario 2: Election with 2 failures (still has majority) ---
simulate_election(5, failing_nodes={0, 3}, seed=99)

# --- Scenario 3: Too many failures (no majority possible) ---
print("--- Election with 3 failures out of 5 ---")
nodes = [RaftNode(i, 5) for i in range(5)]
alive = [1]  # only node 1 is alive besides node 4
candidate = nodes[1]
term = candidate.start_election()
print(f"Node 1 starts election for term {term}")
print(f"Nodes 0, 2, 3 are DOWN. Only Node 4 can vote.")
granted = nodes[4].request_vote(1, term)
candidate.receive_vote(granted)
print(f"Node 4 votes YES. Total votes: {candidate.votes_received}/5")
print(f"Majority needed: 3. Election FAILS — not enough alive nodes!")
print(f"Node 1 remains candidate, will retry after timeout.\\n")

# --- Scenario 4: Split vote ---
print("--- Split vote scenario (4 nodes) ---")
nodes = [RaftNode(i, 4) for i in range(4)]
# Two candidates start simultaneously
t1 = nodes[0].start_election()
t2 = nodes[2].start_election()
print(f"Node 0 and Node 2 both start elections for term {max(t1,t2)}")

# Node 1 votes for Node 0, Node 3 votes for Node 2
nodes[1].request_vote(0, t1)
nodes[0].receive_vote(True)
print(f"Node 1 votes for Node 0 (votes: {nodes[0].votes_received})")

nodes[3].request_vote(2, t2)
nodes[2].receive_vote(True)
print(f"Node 3 votes for Node 2 (votes: {nodes[2].votes_received})")

print(f"Both have 2/4 votes. Majority = 3. SPLIT VOTE!")
print("Neither wins. Both back off with random timeout and retry.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function Consensus() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-14 text-gray-200">
      {/* ---- Section 1: The Impossibility Result ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Consistency &amp; Consensus
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          At the heart of distributed systems lies a fundamental tension: when
          network partitions occur (and they will), you must choose between
          consistency and availability. But the real story is more nuanced than
          the famous CAP theorem suggests, and the solution — consensus
          algorithms — is one of the most elegant ideas in computer science.
        </p>
      </section>

      {/* ---- Section 2: Linearizability ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Linearizability</h2>
        <p className="leading-relaxed">
          Linearizability is the strongest single-object consistency model: it
          makes a distributed system <em>look</em> as if there is only one copy
          of the data and every operation is atomic. Formally, for every
          concurrent execution there must exist a total order of operations
          (matching real-time order) such that each read returns the value of the
          most recent preceding write.
        </p>
        <p className="leading-relaxed">
          The key insight is the <strong className="text-yellow-400">
            linearization point
          </strong>: each operation appears to take effect at some single instant
          between its invocation and response. If operation A completes before
          operation B begins, then A&apos;s linearization point must precede B&apos;s.
        </p>

        <LinearizabilitySketch />

        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-green-400">Linearizable:</strong> Every read
            returns the most recently written value. Once a read sees a value,
            all subsequent reads (by any client) must see that value or a newer
            one.
          </p>
          <p>
            <strong className="text-red-400">Non-linearizable:</strong> A &quot;stale&quot;
            read occurs after a newer value was already observed. This violates
            the recency guarantee and cannot be explained by any sequential
            execution.
          </p>
          <p className="text-gray-400">
            Note: linearizability is about <em>single objects</em> (registers).
            Serializability is about <em>multi-object transactions</em>. They are
            different guarantees — a system can provide one without the other.
          </p>
        </div>
      </section>

      {/* ---- Section 3: CAP Theorem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          The CAP Theorem
        </h2>
        <p className="leading-relaxed">
          The CAP theorem (Brewer, 2000; Gilbert &amp; Lynch, 2002) states that a
          distributed system can provide at most <strong>two</strong> of the
          following three guarantees simultaneously:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-lg font-bold text-indigo-400">C</p>
            <p className="text-sm">Consistency (linearizability)</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-lg font-bold text-green-400">A</p>
            <p className="text-sm">Availability (every request gets a response)</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-lg font-bold text-red-400">P</p>
            <p className="text-sm">Partition tolerance (system works despite network splits)</p>
          </div>
        </div>
        <p className="leading-relaxed">
          Since network partitions <em>will</em> happen in any real distributed
          system, you effectively choose between CP (consistent but may reject
          requests) and AP (always available but may return stale data). Toggle
          the partition below to see the tradeoff.
        </p>

        <CAPSketch />

        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Important nuance:</strong> CAP
            is often misunderstood. It only applies during a partition. When the
            network is healthy, you can have both C and A. The real question is:
            what happens during the (hopefully rare) partition?
          </p>
          <p>
            <strong>CP systems:</strong> HBase, MongoDB (with majority reads),
            etcd, ZooKeeper. They sacrifice availability during partitions.
          </p>
          <p>
            <strong>AP systems:</strong> Cassandra, DynamoDB, CouchDB. They
            remain available but may serve stale or conflicting data.
          </p>
          <p className="text-gray-400">
            Many modern systems offer tunable consistency, letting you choose
            per-operation: strong reads when you need them, eventual consistency
            for high-throughput paths.
          </p>
        </div>
      </section>

      {/* ---- Section 4: Ordering and Causality ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Ordering and Causality
        </h2>
        <p className="leading-relaxed">
          In a distributed system without a global clock, how do we determine
          the order of events? The <strong className="text-yellow-400">
            happens-before
          </strong> relation (Lamport, 1978) defines a partial order: event A
          happens-before event B if A caused B (through message passing or
          sequential execution on the same process).
        </p>
        <p className="leading-relaxed">
          <strong className="text-yellow-400">Lamport timestamps</strong> give
          each event a number such that if A happens-before B, then L(A) &lt;
          L(B). But the converse is not true: L(A) &lt; L(B) does not mean A
          caused B. Lamport clocks provide a total order but lose information
          about concurrency.
        </p>
        <p className="leading-relaxed">
          <strong className="text-purple-400">Vector clocks</strong> solve this
          by giving each process its own counter. The vector allows us to
          determine whether two events are causally related or truly concurrent.
          If neither vector dominates the other, the events are concurrent — they
          happened independently with no causal link.
        </p>

        <CausalitySketch />
      </section>

      {/* ---- Section 5: Consensus Algorithms — Raft ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Consensus: The Raft Algorithm
        </h2>
        <p className="leading-relaxed">
          The <strong>consensus problem</strong>: how do N nodes agree on a
          value? This is fundamental to building reliable distributed systems —
          from electing a leader to deciding which database writes to commit.
        </p>
        <p className="leading-relaxed">
          <strong className="text-yellow-400">Raft</strong> (Ongaro &amp; Ousterhout,
          2014) was designed to be understandable. It decomposes consensus into
          three sub-problems: <em>leader election</em>, <em>log replication</em>,
          and <em>safety</em>. At any time, each node is a{' '}
          <strong>follower</strong>, <strong>candidate</strong>, or{' '}
          <strong>leader</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-indigo-400">
              Leader Election
            </h3>
            <p className="text-sm leading-relaxed mt-1">
              If a follower doesn&apos;t hear from a leader within a random timeout,
              it becomes a candidate, increments its <em>term</em>, votes for
              itself, and requests votes from all others. A candidate becomes
              leader if it receives votes from a majority. Each node votes for
              at most one candidate per term.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-yellow-400">
              Log Replication
            </h3>
            <p className="text-sm leading-relaxed mt-1">
              The leader receives client requests, appends them to its log, and
              replicates entries to followers via AppendEntries RPCs. Once a
              majority of nodes have the entry, it is <em>committed</em> — the
              leader applies it and responds to the client.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-green-400">Safety</h3>
            <p className="text-sm leading-relaxed mt-1">
              Raft guarantees that if an entry is committed, it will be present
              in the log of every future leader. A candidate can only win an
              election if its log is at least as up-to-date as a majority of
              nodes — this is the <em>election restriction</em>.
            </p>
          </div>
        </div>

        <p className="leading-relaxed">
          Step through the animated visualization below to see leader election
          and log replication in action.
        </p>

        <RaftSketch />
      </section>

      {/* ---- Section 6: Distributed Locks and Fencing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Distributed Locks and Fencing
        </h2>
        <p className="leading-relaxed">
          A common use of consensus is implementing distributed locks: ensuring
          only one client can access a resource at a time. But naive distributed
          locks are dangerous due to the <strong className="text-red-400">
            process pause problem
          </strong>.
        </p>
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">The problem:</strong> Client A
            acquires a lock, then pauses (GC pause, network delay). The lock
            expires. Client B acquires the same lock and starts working. Client A
            resumes, unaware its lock expired, and also writes — both clients
            think they hold the lock!
          </p>
          <p>
            <strong className="text-green-400">The solution: fencing tokens.</strong>{' '}
            Every time a lock is granted, the lock service issues a monotonically
            increasing <em>fencing token</em>. Clients include this token with
            every write. The storage system rejects any write with a token lower
            than the highest it has seen — so Client A&apos;s stale writes are
            rejected.
          </p>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm">
          <p className="font-bold text-red-400">Warning: Redlock is not safe</p>
          <p className="mt-1 leading-relaxed">
            Redis&apos;s Redlock algorithm attempts to implement a distributed lock
            across multiple Redis instances. However, as Martin Kleppmann showed,
            it does not provide the fencing guarantees needed for correctness. If
            you need a truly safe distributed lock, use a consensus-based system
            like ZooKeeper or etcd.
          </p>
        </div>
      </section>

      {/* ---- Section 7: ZooKeeper and etcd ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          ZooKeeper and etcd
        </h2>
        <p className="leading-relaxed">
          Rather than implementing Raft or Paxos yourself, you can use a
          <strong className="text-green-400"> coordination service</strong> that
          provides consensus as a building block. The two most widely used are:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-yellow-400">ZooKeeper</h3>
            <p className="text-sm leading-relaxed">
              Uses ZAB (ZooKeeper Atomic Broadcast), similar to Paxos. Provides
              a hierarchical key-value store with strong consistency, ephemeral
              nodes (auto-deleted when client disconnects), watches
              (notifications on changes), and sequential nodes (for implementing
              distributed queues and locks).
            </p>
            <p className="text-xs text-gray-400">
              Used by: Kafka, HBase, Hadoop, Solr, many others.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-indigo-400">etcd</h3>
            <p className="text-sm leading-relaxed">
              Uses Raft for consensus. Provides a flat key-value store with
              strong consistency, leases (TTL-based ephemeral keys), watch
              streams, and transactions (compare-and-swap). Simpler API than
              ZooKeeper, designed for modern cloud-native systems.
            </p>
            <p className="text-xs text-gray-400">
              Used by: Kubernetes (stores all cluster state in etcd).
            </p>
          </div>
        </div>
        <p className="leading-relaxed">
          These services let you outsource the hard problem of consensus and
          build higher-level abstractions: leader election, configuration
          management, service discovery, distributed locks with fencing, and
          group membership.
        </p>
      </section>

      {/* ---- PythonCell 1: Lamport and Vector Clocks ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Lamport &amp; Vector Clocks
        </h2>
        <p className="leading-relaxed">
          Implement Lamport timestamps and vector clocks from scratch. See how
          Lamport clocks create a total order that obscures concurrency, while
          vector clocks precisely capture the happens-before relation.
        </p>
        <PythonCell defaultCode={lamportVectorCode} />
      </section>

      {/* ---- PythonCell 2: Raft Leader Election ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Raft Leader Election
        </h2>
        <p className="leading-relaxed">
          Simulate the Raft leader election protocol. Explore scenarios including
          normal elections, elections with node failures, insufficient quorum, and
          split votes. Each scenario demonstrates a key property of the algorithm.
        </p>
        <PythonCell defaultCode={raftElectionCode} />
      </section>

      {/* ---- Section 8: Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <div className="bg-slate-800 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
          <p>
            <strong className="text-indigo-400">Linearizability</strong> makes
            a distributed system behave as if there is a single copy of data.
            It is the strongest consistency model but comes at the cost of
            performance and availability.
          </p>
          <p>
            <strong className="text-indigo-400">CAP theorem</strong> says you
            must choose between consistency and availability during network
            partitions. But this is a spectrum, not a binary choice — many
            systems offer tunable consistency.
          </p>
          <p>
            <strong className="text-indigo-400">Lamport timestamps</strong>{' '}
            provide total ordering but cannot detect concurrency.{' '}
            <strong className="text-purple-400">Vector clocks</strong> capture
            the full happens-before relation at the cost of O(N) space per event.
          </p>
          <p>
            <strong className="text-indigo-400">Consensus algorithms</strong>{' '}
            (Paxos, Raft, ZAB) allow N nodes to agree on a value despite
            failures. They require a majority quorum and make progress as long as
            a majority is alive.
          </p>
          <p>
            <strong className="text-indigo-400">Raft</strong> decomposes
            consensus into leader election (random timeouts, majority votes),
            log replication (leader appends, majority confirms), and safety
            (only up-to-date nodes can become leader).
          </p>
          <p>
            <strong className="text-indigo-400">
              Coordination services
            </strong>{' '}
            like ZooKeeper and etcd implement consensus so you don&apos;t have to.
            Use them for leader election, distributed locks (with fencing
            tokens), service discovery, and configuration management.
          </p>
        </div>
      </section>
    </div>
  )
}
