import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/batch-stream',
  title: 'Batch & Stream Processing',
  description:
    'MapReduce, dataflow engines, event streams, message brokers, event sourcing, CDC, and exactly-once semantics',
  track: 'systems',
  order: 9,
  tags: [
    'batch',
    'stream',
    'mapreduce',
    'kafka',
    'event-sourcing',
    'cdc',
    'exactly-once',
  ],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/* lerpColor removed — unused */

/* ------------------------------------------------------------------ */
/* Section 1 — MapReduce Pipeline Visualization                        */
/* ------------------------------------------------------------------ */

function MapReduceSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const sketch = useCallback((p: p5) => {
    const canvasH = 560
    let canvasW = 900

    // E-commerce order data — like Amazon's daily sales log
    const orders = [
      { id: 'ORD-001', category: 'Electronics', amount: 299, city: 'NYC' },
      { id: 'ORD-002', category: 'Books', amount: 24, city: 'LA' },
      { id: 'ORD-003', category: 'Electronics', amount: 899, city: 'NYC' },
      { id: 'ORD-004', category: 'Clothing', amount: 65, city: 'Chicago' },
      { id: 'ORD-005', category: 'Books', amount: 18, city: 'NYC' },
      { id: 'ORD-006', category: 'Electronics', amount: 149, city: 'LA' },
      { id: 'ORD-007', category: 'Clothing', amount: 42, city: 'LA' },
      { id: 'ORD-008', category: 'Books', amount: 35, city: 'Chicago' },
      { id: 'ORD-009', category: 'Clothing', amount: 120, city: 'NYC' },
      { id: 'ORD-010', category: 'Electronics', amount: 549, city: 'Chicago' },
    ]

    const catColors: Record<string, [number, number, number]> = {
      Electronics: [99, 102, 241],
      Books: [52, 211, 153],
      Clothing: [236, 72, 153],
    }
    const categories = ['Electronics', 'Books', 'Clothing']

    // Animated positions for each order
    const positions: { x: number; y: number; tx: number; ty: number }[] = []

    const phaseX = [0.07, 0.27, 0.48, 0.70, 0.90]
    const phaseLabels = ['Raw Orders', 'Map', 'Shuffle by Category', 'Reduce (Aggregate)', 'Revenue Report']
    const phaseDesc = [
      '10 orders from 3 cities',
      'Emit (category, $amount)',
      'Group by category',
      'Sum revenue per category',
      'Final results',
    ]

    // Aggregated results
    const totals: Record<string, { count: number; revenue: number }> = {}
    for (const o of orders) {
      if (!totals[o.category]) totals[o.category] = { count: 0, revenue: 0 }
      totals[o.category].count++
      totals[o.category].revenue += o.amount
    }

    function setTargets(phase: number) {
      const topY = 90
      const rowH = (canvasH - topY - 60) / orders.length

      if (phase === 0) {
        orders.forEach((_, i) => {
          positions[i].tx = phaseX[0] * canvasW
          positions[i].ty = topY + i * rowH + rowH / 2
        })
      } else if (phase === 1) {
        orders.forEach((_, i) => {
          positions[i].tx = phaseX[1] * canvasW
          positions[i].ty = topY + i * rowH + rowH / 2
        })
      } else if (phase === 2) {
        // Group by category
        const groups: Record<string, number[]> = {}
        orders.forEach((o, i) => {
          if (!groups[o.category]) groups[o.category] = []
          groups[o.category].push(i)
        })
        let catIdx = 0
        for (const cat of categories) {
          const idxs = groups[cat] ?? []
          const groupY = topY + catIdx * (canvasH - topY - 60) / 3
          idxs.forEach((idx, j) => {
            positions[idx].tx = phaseX[2] * canvasW + j * 28
            positions[idx].ty = groupY + 30
          })
          catIdx++
        }
      } else if (phase === 3 || phase === 4) {
        const px = phaseX[phase === 3 ? 3 : 4] * canvasW
        let catIdx = 0
        const placed = new Set<string>()
        orders.forEach((o, i) => {
          if (!placed.has(o.category)) {
            placed.add(o.category)
            positions[i].tx = px
            positions[i].ty = topY + catIdx * 120 + 50
            catIdx++
          } else {
            positions[i].tx = px - 20
            positions[i].ty = positions[i].y
          }
        })
      }
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
      // Init positions
      for (let i = 0; i < orders.length; i++) {
        const y = 90 + (i / orders.length) * (canvasH - 150) + 20
        positions.push({ x: phaseX[0] * canvasW, y, tx: phaseX[0] * canvasW, ty: y })
      }
    }

    p.draw = () => {
      const currentStep = stepRef.current
      p.background(15, 23, 42)

      setTargets(currentStep)

      // Animate
      for (const pos of positions) {
        pos.x += (pos.tx - pos.x) * 0.1
        pos.y += (pos.ty - pos.y) * 0.1
      }

      // Phase columns
      for (let i = 0; i < 5; i++) {
        const cx = phaseX[i] * canvasW
        if (i === currentStep) {
          p.fill(59, 130, 246, 20)
          p.noStroke()
          p.rect(cx - 55, 42, 110, canvasH - 62, 8)
        }
        p.noStroke()
        p.fill(i === currentStep ? 255 : 120)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(phaseLabels[i], cx, 44)
        p.fill(80)
        p.textSize(9)
        p.text(phaseDesc[i], cx, 58)
      }

      // Arrows between phases
      p.stroke(60)
      p.strokeWeight(1)
      for (let i = 0; i < 4; i++) {
        const x1 = phaseX[i] * canvasW + 48
        const x2 = phaseX[i + 1] * canvasW - 48
        p.line(x1, canvasH / 2, x2, canvasH / 2)
        p.fill(60)
        p.noStroke()
        p.triangle(x2, canvasH / 2, x2 - 6, canvasH / 2 - 3, x2 - 6, canvasH / 2 + 3)
        p.stroke(60)
      }

      // Draw items based on current phase
      p.textSize(9)
      const seen = new Set<string>()

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]
        const pos = positions[i]
        const [cr, cg, cb] = catColors[o.category]

        if (currentStep === 0) {
          // Raw orders — show as rows
          p.fill(cr, cg, cb, 180)
          p.noStroke()
          p.rect(pos.x - 4, pos.y - 8, 8, 16, 3)
          p.fill(200)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`${o.id}  ${o.category}  $${o.amount}  ${o.city}`, pos.x + 12, pos.y)
        } else if (currentStep === 1) {
          // Map — emit (category, amount)
          p.fill(cr, cg, cb, 200)
          p.noStroke()
          p.ellipse(pos.x, pos.y, 14, 14)
          p.fill(220)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`(${o.category}, $${o.amount})`, pos.x + 14, pos.y)
        } else if (currentStep === 2) {
          // Shuffle — grouped by category
          p.fill(cr, cg, cb, 200)
          p.noStroke()
          p.ellipse(pos.x, pos.y, 16, 16)
          p.fill(255)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`$${o.amount}`, pos.x, pos.y)
          // Category label (once per group)
          if (!seen.has(o.category)) {
            seen.add(o.category)
            p.fill(cr, cg, cb)
            p.textAlign(p.RIGHT, p.CENTER)
            p.textSize(11)
            p.text(o.category, phaseX[2] * canvasW - 20, pos.y)
            p.textSize(9)
          }
        } else if (currentStep >= 3) {
          // Reduce / Output — aggregated
          if (!seen.has(o.category)) {
            seen.add(o.category)
            const t = totals[o.category]
            // Draw a bar proportional to revenue
            const maxRev = Math.max(...categories.map(c => totals[c].revenue))
            const barW = (t.revenue / maxRev) * 120
            p.fill(cr, cg, cb, 60)
            p.noStroke()
            p.rect(pos.x - 5, pos.y - 14, barW, 28, 4)
            p.fill(cr, cg, cb)
            p.ellipse(pos.x, pos.y, 20, 20)
            p.fill(255)
            p.textAlign(p.LEFT, p.CENTER)
            p.textSize(11)
            if (currentStep === 3) {
              p.text(`${o.category}: ${t.count} orders, sum($) = ...`, pos.x + 16, pos.y)
            } else {
              p.text(`${o.category}`, pos.x + 16, pos.y - 8)
              p.fill(52, 211, 153)
              p.text(`$${t.revenue.toLocaleString()}`, pos.x + 16, pos.y + 8)
              p.fill(140)
              p.textSize(9)
              p.text(`(${t.count} orders, avg $${Math.round(t.revenue / t.count)})`, pos.x + 16 + 60, pos.y + 8)
            }
            p.textSize(9)
          }
        }
      }

      // Title
      p.noStroke()
      p.fill(200)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('MapReduce: E-Commerce Revenue by Category (Amazon-style)', 10, 10)
      p.fill(100)
      p.textSize(10)
      p.text('10 orders across 3 categories and 3 cities — step through the pipeline', 10, 26)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={560}
        controls={
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <button
              className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-40"
              disabled={step <= 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              &larr; Previous
            </button>
            <span className="text-sm text-slate-300 min-w-[180px] text-center">
              Phase {step + 1} / 5:{' '}
              {['Raw Orders', 'Map', 'Shuffle', 'Reduce', 'Report'][step]}
            </span>
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-40"
              disabled={step >= 4}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Next &rarr;
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Pub/Sub Message Broker Visualization                    */
/* ------------------------------------------------------------------ */

interface BrokerMessage {
  id: number
  partition: number
  offset: number
  x: number
  y: number
  consumed: boolean
  producing: boolean
  age: number
}

function PubSubSketch() {
  const [producerRate, setProducerRate] = useState(1.0)
  const [consumerSpeed, setConsumerSpeed] = useState(0.6)
  const producerRateRef = useRef(producerRate)
  const consumerSpeedRef = useRef(consumerSpeed)
  producerRateRef.current = producerRate
  consumerSpeedRef.current = consumerSpeed

  const sketch = useCallback((p: p5) => {
    const canvasH = 460
    let canvasW = 900
    const numPartitions = 3
    const numConsumers = 2
    const messages: BrokerMessage[] = []
    let nextId = 0
    let frame = 0
    // consumer offsets (reserved for future use)
    const partitionQueues: number[][] = [[], [], []] // message ids per partition
    const rng = makeRng(99)

    const producerX = 80
    const brokerStartX = 250
    const brokerEndX = 600
    const consumerX = 750
    const partitionY = (i: number) => 120 + i * 110

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const pRate = producerRateRef.current
      const cSpeed = consumerSpeedRef.current

      // Produce messages
      if (frame % Math.max(1, Math.floor(30 / pRate)) === 0) {
        const part = Math.floor(rng() * numPartitions)
        const offset = partitionQueues[part].length
        const msg: BrokerMessage = {
          id: nextId++,
          partition: part,
          offset,
          x: producerX,
          y: partitionY(part),
          consumed: false,
          producing: true,
          age: 0,
        }
        messages.push(msg)
        partitionQueues[part].push(msg.id)
      }

      // Consume messages
      for (let c = 0; c < numConsumers; c++) {
        if (frame % Math.max(1, Math.floor(40 / cSpeed)) === 0) {
          // Consumer c reads from partitions assigned to it (simple: partition mod consumers)
          for (let part = 0; part < numPartitions; part++) {
            if (part % numConsumers === c) {
              const unconsumed = messages.filter(
                (m) => m.partition === part && !m.consumed && !m.producing,
              )
              if (unconsumed.length > 0) {
                unconsumed[0].consumed = true
              }
            }
          }
        }
      }

      // Update positions
      for (const msg of messages) {
        msg.age++
        if (msg.producing) {
          // Move to broker
          const targetX = brokerStartX + 20 + msg.offset * 24
          msg.x += (targetX - msg.x) * 0.1
          msg.y += (partitionY(msg.partition) - msg.y) * 0.1
          if (Math.abs(msg.x - targetX) < 2) {
            msg.producing = false
          }
        } else if (msg.consumed) {
          // Move to consumer area
          const cIdx = msg.partition % numConsumers
          const targetX = consumerX
          const targetY = 160 + cIdx * 180
          msg.x += (targetX - msg.x) * 0.06
          msg.y += (targetY - msg.y) * 0.06
        }
      }

      // Remove old consumed messages
      const toRemove = messages.filter((m) => m.consumed && m.x > consumerX - 10)
      for (const m of toRemove) {
        const idx = messages.indexOf(m)
        if (idx >= 0 && m.age > 60) messages.splice(idx, 1)
      }

      // Draw labels
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(14)
      p.fill(255)
      p.noStroke()
      p.text('Producers', producerX, 40)
      p.text('Message Broker', (brokerStartX + brokerEndX) / 2, 40)
      p.text('Consumers', consumerX, 40)

      // Draw producer box
      p.stroke(59, 130, 246)
      p.strokeWeight(2)
      p.noFill()
      p.rect(producerX - 40, 60, 80, canvasH - 100, 8)
      // Pulsing indicator
      const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7
      p.fill(59, 130, 246, pulse * 255)
      p.noStroke()
      p.ellipse(producerX, canvasH / 2, 20, 20)

      // Draw partition boxes
      for (let i = 0; i < numPartitions; i++) {
        const py = partitionY(i)
        p.stroke(100, 116, 139)
        p.strokeWeight(1)
        p.noFill()
        p.rect(brokerStartX, py - 25, brokerEndX - brokerStartX, 50, 6)
        p.fill(148, 163, 184)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`Partition ${i}`, brokerStartX + 5, py - 15)

        // Count unconsumed
        const lag = messages.filter(
          (m) => m.partition === i && !m.consumed && !m.producing,
        ).length
        p.fill(lag > 5 ? p.color(239, 68, 68) : p.color(34, 197, 94))
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`lag: ${lag}`, brokerEndX - 5, py - 15)
      }

      // Draw consumer boxes
      for (let c = 0; c < numConsumers; c++) {
        const cy = 160 + c * 180
        p.stroke(168, 85, 247)
        p.strokeWeight(2)
        p.noFill()
        p.rect(consumerX - 40, cy - 40, 80, 80, 8)
        p.fill(168, 85, 247)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Consumer ${c}`, consumerX, cy - 28)
        // Show which partitions
        p.fill(148, 163, 184)
        p.textSize(10)
        const parts = Array.from({ length: numPartitions }, (_, i) => i)
          .filter((i) => i % numConsumers === c)
          .join(', ')
        p.text(`P[${parts}]`, consumerX, cy + 25)
      }

      // Draw messages
      for (const msg of messages) {
        const partColors = [
          p.color(59, 130, 246),
          p.color(34, 197, 94),
          p.color(250, 204, 21),
        ]
        const col = partColors[msg.partition % 3]
        if (msg.consumed) {
          p.fill(
            p.red(col),
            p.green(col),
            p.blue(col),
            Math.max(0, 200 - msg.age * 2),
          )
        } else {
          p.fill(col)
        }
        p.noStroke()
        p.rect(msg.x - 8, msg.y - 8, 16, 16, 3)
      }

      // Arrows
      p.stroke(100)
      p.strokeWeight(1)
      for (let i = 0; i < numPartitions; i++) {
        p.line(producerX + 40, partitionY(i), brokerStartX, partitionY(i))
      }
      for (let c = 0; c < numConsumers; c++) {
        const cy = 160 + c * 180
        p.line(brokerEndX, cy, consumerX - 40, cy)
      }

      // Legend
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        'Messages flow from producers to partitioned topics, then to consumer groups. Watch lag grow when consumers are slow.',
        10,
        canvasH - 30,
      )
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-6 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Producer Rate
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={producerRate}
                onChange={(e) => setProducerRate(parseFloat(e.target.value))}
                className="w-28"
              />
              <span className="w-8 text-right">{producerRate.toFixed(1)}x</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Consumer Speed
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={consumerSpeed}
                onChange={(e) => setConsumerSpeed(parseFloat(e.target.value))}
                className="w-28"
              />
              <span className="w-8 text-right">{consumerSpeed.toFixed(1)}x</span>
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Event Sourcing Visualization                            */
/* ------------------------------------------------------------------ */

interface EventItem {
  type: string
  payload: string
  timestamp: number
  y: number
  alpha: number
}

interface DerivedState {
  cart: string[]
  orders: number
  user: string | null
}

function EventSourcingSketch() {
  const [replayTo, setReplayTo] = useState(-1) // -1 = all
  const replayToRef = useRef(replayTo)
  replayToRef.current = replayTo

  const eventsRef = useRef<EventItem[]>([
    { type: 'UserCreated', payload: 'alice', timestamp: 0, y: 0, alpha: 0 },
    { type: 'ItemAdded', payload: 'Laptop', timestamp: 1, y: 0, alpha: 0 },
    { type: 'ItemAdded', payload: 'Mouse', timestamp: 2, y: 0, alpha: 0 },
    { type: 'ItemRemoved', payload: 'Mouse', timestamp: 3, y: 0, alpha: 0 },
    { type: 'ItemAdded', payload: 'Keyboard', timestamp: 4, y: 0, alpha: 0 },
    { type: 'OrderPlaced', payload: 'order-001', timestamp: 5, y: 0, alpha: 0 },
    { type: 'ItemAdded', payload: 'Monitor', timestamp: 6, y: 0, alpha: 0 },
    { type: 'ItemAdded', payload: 'Webcam', timestamp: 7, y: 0, alpha: 0 },
    { type: 'OrderPlaced', payload: 'order-002', timestamp: 8, y: 0, alpha: 0 },
  ])

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    let canvasW = 900
    let frame = 0
    const events = eventsRef.current

    function deriveState(upTo: number): DerivedState {
      const state: DerivedState = { cart: [], orders: 0, user: null }
      const limit = upTo < 0 ? events.length : upTo + 1
      for (let i = 0; i < limit; i++) {
        const e = events[i]
        switch (e.type) {
          case 'UserCreated':
            state.user = e.payload
            break
          case 'ItemAdded':
            state.cart.push(e.payload)
            break
          case 'ItemRemoved':
            state.cart = state.cart.filter((x) => x !== e.payload)
            break
          case 'OrderPlaced':
            state.orders++
            state.cart = []
            break
        }
      }
      return state
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const replay = replayToRef.current
      const cutoff = replay < 0 ? events.length - 1 : replay

      const eventLogX = 40
      const stateX = canvasW * 0.6
      const rowH = 36

      // Title
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Event Log (append-only)', eventLogX, 15)
      p.text('Derived State (rebuilt from events)', stateX, 15)

      // Draw event log
      p.textSize(12)
      const typeColors: Record<string, p5.Color> = {
        UserCreated: p.color(59, 130, 246),
        ItemAdded: p.color(34, 197, 94),
        ItemRemoved: p.color(239, 68, 68),
        OrderPlaced: p.color(168, 85, 247),
      }

      for (let i = 0; i < events.length; i++) {
        const e = events[i]
        const ey = 45 + i * rowH
        const included = i <= cutoff
        const col = typeColors[e.type] ?? p.color(200)

        // Background
        if (included) {
          p.fill(p.red(col), p.green(col), p.blue(col), 25)
        } else {
          p.fill(30, 41, 59, 100)
        }
        p.noStroke()
        p.rect(eventLogX, ey, canvasW * 0.5 - 60, rowH - 4, 4)

        // Event type tag
        p.fill(included ? col : p.color(100))
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`#${i}`, eventLogX + 5, ey + rowH / 2 - 2)
        p.fill(included ? 255 : 100)
        p.text(`${e.type}`, eventLogX + 35, ey + rowH / 2 - 2)
        p.fill(included ? 200 : 80)
        p.textSize(11)
        p.text(`"${e.payload}"`, eventLogX + 160, ey + rowH / 2 - 2)
        p.textSize(12)

        // Replay marker
        if (i === cutoff) {
          p.fill(250, 204, 21)
          p.triangle(
            eventLogX - 10,
            ey + rowH / 2 - 6,
            eventLogX - 10,
            ey + rowH / 2 + 6,
            eventLogX - 2,
            ey + rowH / 2,
          )
        }
      }

      // Derive and display state
      const state = deriveState(cutoff)
      const stateBoxY = 45

      p.fill(30, 41, 59)
      p.stroke(59, 130, 246, 80)
      p.strokeWeight(1)
      p.rect(stateX, stateBoxY, canvasW - stateX - 20, 280, 8)

      p.noStroke()
      p.fill(255)
      p.textAlign(p.LEFT, p.TOP)
      p.textSize(13)
      let sy = stateBoxY + 15

      p.fill(148, 163, 184)
      p.text('user:', stateX + 15, sy)
      p.fill(255)
      p.text(state.user ?? 'null', stateX + 90, sy)
      sy += 28

      p.fill(148, 163, 184)
      p.text('cart:', stateX + 15, sy)
      p.fill(255)
      if (state.cart.length === 0) {
        p.text('[]', stateX + 90, sy)
      } else {
        p.text(`[${state.cart.join(', ')}]`, stateX + 90, sy)
      }
      sy += 28

      p.fill(148, 163, 184)
      p.text('orders:', stateX + 15, sy)
      p.fill(255)
      p.text(`${state.orders}`, stateX + 90, sy)
      sy += 40

      // Replay info
      p.fill(250, 204, 21)
      p.textSize(11)
      p.text(
        replay < 0
          ? 'Replaying all events'
          : `Replaying events 0..${cutoff}`,
        stateX + 15,
        sy,
      )
    }
  }, [])

  const numEvents = eventsRef.current.length

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Replay up to event:
              <input
                type="range"
                min={0}
                max={numEvents - 1}
                value={replayTo < 0 ? numEvents - 1 : replayTo}
                onChange={(e) => setReplayTo(parseInt(e.target.value, 10))}
                className="w-48"
              />
              <span className="w-6 text-right">
                #{replayTo < 0 ? numEvents - 1 : replayTo}
              </span>
            </label>
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
              onClick={() => setReplayTo(-1)}
            >
              Replay All
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const mapreduceCode = `# MapReduce Word Count from Scratch
# ===================================
# Implement the three core phases: Map, Shuffle, Reduce

from collections import defaultdict

# --- Input data ---
documents = [
    "the quick brown fox jumps over the lazy dog",
    "the dog barked at the fox",
    "the fox ran quickly over the hill",
    "a lazy dog slept by the hill",
]

# --- MAP PHASE ---
# Each mapper processes one document and emits (key, value) pairs
def map_function(document: str) -> list[tuple[str, int]]:
    """Emit (word, 1) for each word in the document."""
    pairs = []
    for word in document.lower().split():
        pairs.append((word, 1))
    return pairs

# Run mappers in parallel (simulated)
print("=== MAP PHASE ===")
mapped: list[tuple[str, int]] = []
for i, doc in enumerate(documents):
    result = map_function(doc)
    mapped.extend(result)
    print(f"  Mapper {i}: {len(result)} pairs from '{doc[:30]}...'")

print(f"\\nTotal intermediate pairs: {len(mapped)}")
print(f"Sample: {mapped[:5]}")

# --- SHUFFLE PHASE ---
# Group all values by key
print("\\n=== SHUFFLE PHASE ===")
def shuffle(pairs: list[tuple[str, int]]) -> dict[str, list[int]]:
    """Group values by key across all mappers."""
    groups: dict[str, list[int]] = defaultdict(list)
    for key, value in pairs:
        groups[key].append(value)
    return dict(groups)

shuffled = shuffle(mapped)
print(f"Unique keys after shuffle: {len(shuffled)}")
for key in list(shuffled.keys())[:5]:
    print(f"  '{key}': {shuffled[key]}")

# --- REDUCE PHASE ---
# Aggregate values for each key
print("\\n=== REDUCE PHASE ===")
def reduce_function(key: str, values: list[int]) -> tuple[str, int]:
    """Sum up all counts for a word."""
    return (key, sum(values))

results = {}
for key, values in shuffled.items():
    word, count = reduce_function(key, values)
    results[word] = count

# Sort by frequency
sorted_results = sorted(results.items(), key=lambda x: -x[1])
print("\\nWord frequencies (sorted):")
for word, count in sorted_results:
    print(f"  {word:12s} => {count}")

print(f"\\nTotal unique words: {len(results)}")
print(f"Most common: '{sorted_results[0][0]}' ({sorted_results[0][1]} occurrences)")
`

const eventSourcingCode = `# Event Sourcing System
# =====================
# Store events, derive state, replay from checkpoints

from dataclasses import dataclass, field
from typing import Any
import json

@dataclass
class Event:
    event_type: str
    payload: dict
    sequence: int = 0

@dataclass
class ShoppingCartState:
    user: str | None = None
    cart: list[str] = field(default_factory=list)
    total_orders: int = 0
    order_history: list[str] = field(default_factory=list)

    def __repr__(self):
        return (
            f"CartState(user={self.user}, "
            f"cart={self.cart}, "
            f"orders={self.total_orders}, "
            f"history={self.order_history})"
        )

class EventStore:
    """Append-only event log with replay capability."""

    def __init__(self):
        self.events: list[Event] = []
        self.sequence = 0
        self.snapshots: dict[int, ShoppingCartState] = {}

    def append(self, event_type: str, payload: dict) -> Event:
        """Append a new event to the log."""
        event = Event(event_type=event_type, payload=payload, sequence=self.sequence)
        self.events.append(event)
        self.sequence += 1
        return event

    def replay(self, up_to: int = -1) -> ShoppingCartState:
        """Replay events to derive current state."""
        state = ShoppingCartState()
        limit = len(self.events) if up_to < 0 else up_to + 1

        # Check for nearest snapshot before our target
        best_snap = -1
        for seq in self.snapshots:
            if seq < limit and seq > best_snap:
                best_snap = seq

        start = 0
        if best_snap >= 0:
            # Start from snapshot
            snap = self.snapshots[best_snap]
            state = ShoppingCartState(
                user=snap.user,
                cart=list(snap.cart),
                total_orders=snap.total_orders,
                order_history=list(snap.order_history),
            )
            start = best_snap + 1

        # Apply events from start
        for i in range(start, limit):
            event = self.events[i]
            self._apply(state, event)
        return state

    def snapshot(self, at_sequence: int):
        """Save a snapshot at a given sequence number."""
        state = self.replay(at_sequence)
        self.snapshots[at_sequence] = state
        print(f"  Snapshot saved at seq {at_sequence}: {state}")

    @staticmethod
    def _apply(state: ShoppingCartState, event: Event):
        if event.event_type == "UserCreated":
            state.user = event.payload["name"]
        elif event.event_type == "ItemAdded":
            state.cart.append(event.payload["item"])
        elif event.event_type == "ItemRemoved":
            item = event.payload["item"]
            if item in state.cart:
                state.cart.remove(item)
        elif event.event_type == "OrderPlaced":
            state.order_history.append(event.payload["order_id"])
            state.total_orders += 1
            state.cart = []  # clear cart after order

# --- Build the event log ---
store = EventStore()

events_to_add = [
    ("UserCreated",  {"name": "alice"}),
    ("ItemAdded",    {"item": "Laptop"}),
    ("ItemAdded",    {"item": "Mouse"}),
    ("ItemRemoved",  {"item": "Mouse"}),
    ("ItemAdded",    {"item": "Keyboard"}),
    ("OrderPlaced",  {"order_id": "ORD-001"}),
    ("ItemAdded",    {"item": "Monitor"}),
    ("ItemAdded",    {"item": "Webcam"}),
    ("OrderPlaced",  {"order_id": "ORD-002"}),
]

print("=== Appending Events ===")
for etype, payload in events_to_add:
    evt = store.append(etype, payload)
    print(f"  #{evt.sequence}: {etype} {payload}")

# --- Replay from scratch ---
print("\\n=== Replay All Events ===")
final = store.replay()
print(f"  Final state: {final}")

# --- Replay to specific points ---
print("\\n=== Replay to Different Points ===")
for i in range(len(store.events)):
    state = store.replay(i)
    e = store.events[i]
    print(f"  After #{i} ({e.event_type}): cart={state.cart}, orders={state.total_orders}")

# --- Snapshots for faster replay ---
print("\\n=== Snapshot & Replay from Checkpoint ===")
store.snapshot(5)  # Snapshot after first order
state_from_snap = store.replay(8)  # Replay to end using snapshot
print(f"  State at end (via snapshot): {state_from_snap}")

# Verify correctness
state_full = store.replay()
assert state_from_snap.total_orders == state_full.total_orders
assert state_from_snap.user == state_full.user
print("  Snapshot-based replay matches full replay!")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function BatchStream() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-14 text-slate-200">
      {/* ---- Intro ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Batch &amp; Stream Processing
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          A data system does not merely store data - it must also <em>process</em>{' '}
          it. Two fundamental paradigms dominate: <strong>batch processing</strong>,
          which operates on a bounded, complete dataset (think &ldquo;run this job
          over all of last month&rsquo;s logs&rdquo;), and{' '}
          <strong>stream processing</strong>, which operates on unbounded data as it
          arrives (think &ldquo;react to each click in real time&rdquo;). This
          lesson explores both paradigms, their core abstractions, and the patterns
          that make them reliable at scale.
        </p>
      </section>

      {/* ---- Batch Processing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Batch Processing</h2>
        <p className="leading-relaxed">
          Batch processing has a long lineage in computing. The Unix philosophy
          captures its essence: each program reads from <code>stdin</code>,
          transforms the data, and writes to <code>stdout</code>. You compose
          powerful pipelines from small, single-purpose tools:{' '}
          <code>cat access.log | awk ... | sort | uniq -c | sort -rn | head -5</code>.
        </p>
        <p className="leading-relaxed">
          The key properties are: the input is <em>bounded</em> (you know where it
          ends), the processing can be <em>retried</em> if it fails (the input is
          still there), and the output is <em>derived</em> from the input (the input
          is never mutated). MapReduce is the distributed version of this idea,
          designed by Google for processing the entire web at scale.
        </p>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Unix Pipe Analogy
          </h4>
          <div className="font-mono text-sm space-y-1 text-green-400">
            <p>$ cat documents/*.txt &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Input: bounded dataset</p>
            <p>&nbsp; | tr &apos; &apos; &apos;\n&apos; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Map: one word per line</p>
            <p>&nbsp; | sort &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Shuffle: group equal keys</p>
            <p>&nbsp; | uniq -c &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Reduce: count per key</p>
            <p>&nbsp; | sort -rn &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Sort output</p>
          </div>
        </div>
      </section>

      {/* ---- MapReduce ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">MapReduce</h2>
        <p className="leading-relaxed">
          MapReduce distributes the Unix pipe pattern across a cluster. The
          framework handles parallelism, fault tolerance, and data distribution.
          You write just two functions: <strong>Map</strong> (extract key-value
          pairs from each input record) and <strong>Reduce</strong> (aggregate all
          values that share a key). Between them lies the <strong>Shuffle</strong>{' '}
          phase, where the framework groups key-value pairs by key across the
          network.
        </p>
        <p className="leading-relaxed">
          Step through the visualization below to see how a word-count job flows
          through each phase. Notice how the shuffle phase is the expensive part:
          it requires sorting and network transfer of all intermediate data.
        </p>
        <MapReduceSketch />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              MapReduce Strengths
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Simple programming model (just map + reduce)</li>
              <li>Automatic parallelism across cluster</li>
              <li>Fault tolerant (re-run failed tasks)</li>
              <li>Scales horizontally with more nodes</li>
              <li>Input data is never mutated</li>
            </ul>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-red-400 mb-2">
              MapReduce Limitations
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Writes intermediate data to disk between stages</li>
              <li>Multi-step jobs require chaining MapReduce jobs</li>
              <li>No support for iterative algorithms (ML training)</li>
              <li>High latency (minutes to hours per job)</li>
              <li>Shuffle phase is a bottleneck</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Beyond MapReduce ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Beyond MapReduce</h2>
        <p className="leading-relaxed">
          MapReduce&rsquo;s biggest pain point is <em>materialization of
          intermediate state</em>. Every MapReduce job writes its output to the
          distributed filesystem (HDFS), and the next job reads it back. For a
          pipeline with 10 stages, this means 10 rounds of disk I/O.
        </p>
        <p className="leading-relaxed">
          <strong>Dataflow engines</strong> like Apache Spark, Apache Flink, and
          Google Dataflow solve this by representing the entire pipeline as a
          directed acyclic graph (DAG) of operators. Data flows through the graph
          in memory where possible, spilling to disk only when necessary. This
          yields 10-100x speedups for iterative workloads like ML training.
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Comparison: MapReduce vs. Dataflow Engines
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2">Aspect</th>
                <th className="text-left py-2">MapReduce</th>
                <th className="text-left py-2">Dataflow (Spark/Flink)</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800">
                <td className="py-2">Intermediate data</td>
                <td>Written to HDFS</td>
                <td>Kept in memory (pipelined)</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2">Multi-stage jobs</td>
                <td>Chain separate jobs</td>
                <td>Single DAG</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2">Iterative algorithms</td>
                <td>Very slow</td>
                <td>Fast (cache in memory)</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2">Fault tolerance</td>
                <td>Re-read from HDFS</td>
                <td>Lineage-based recomputation</td>
              </tr>
              <tr>
                <td className="py-2">Optimization</td>
                <td>Manual</td>
                <td>Query optimizer (Catalyst, etc.)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Stream Processing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Stream Processing</h2>
        <p className="leading-relaxed">
          Batch processing is a great fit when you can afford to wait - run a job
          nightly, get results in the morning. But many applications need to react
          to events as they happen: fraud detection, real-time dashboards, alerting,
          recommendation updates. This is the domain of <em>stream processing</em>.
        </p>
        <p className="leading-relaxed">
          The fundamental difference: batch processes a <em>bounded</em> dataset
          that has a beginning and end. A stream is <em>unbounded</em> - it has a
          beginning but never ends. New events keep arriving. The stream processor
          must handle them incrementally, maintaining state across events without
          ever seeing the &ldquo;complete&rdquo; input.
        </p>
        <p className="leading-relaxed">
          An <strong>event</strong> is an immutable record of something that
          happened at a point in time: a user clicked a button, a sensor reported
          a temperature, a payment was processed. Events are typically small (a few
          KB) and self-contained. The stream is an ordered sequence of these events.
        </p>
      </section>

      {/* ---- Message Brokers ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Message Brokers</h2>
        <p className="leading-relaxed">
          A <strong>message broker</strong> (like Apache Kafka, Amazon Kinesis, or
          Redpanda) sits between event producers and consumers. It decouples them:
          producers write events to <em>topics</em> without knowing who will read
          them. Consumers subscribe to topics and process events at their own pace.
        </p>
        <p className="leading-relaxed">
          Topics are split into <strong>partitions</strong> for parallelism. Each
          partition is an ordered, append-only log. Within a partition, every
          message has a sequential <strong>offset</strong>. Consumer groups
          distribute partitions among their members so that each message is
          processed by exactly one consumer in the group.
        </p>
        <p className="leading-relaxed">
          Adjust the producer rate and consumer speed below. When consumers are
          slower than producers, observe the <em>consumer lag</em> growing on each
          partition - a critical metric for monitoring stream processing health.
        </p>
        <PubSubSketch />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Key Concepts
          </h4>
          <dl className="text-sm space-y-3 text-slate-300">
            <div>
              <dt className="font-semibold text-white">Topic</dt>
              <dd>A named log of events. Producers write to a topic; consumers read from it.</dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Partition</dt>
              <dd>
                A topic is split into partitions for parallelism. Each partition is an
                ordered, append-only sequence. Messages within a partition are strictly
                ordered; across partitions, ordering is not guaranteed.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Offset</dt>
              <dd>
                Each message in a partition has a sequential offset. Consumers track
                their current offset to know where they left off.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Consumer Group</dt>
              <dd>
                A set of consumers that share the work. Each partition is assigned to
                exactly one consumer in the group. If a consumer fails, its partitions
                are rebalanced to other members.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---- Event Sourcing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Event Sourcing</h2>
        <p className="leading-relaxed">
          Traditional databases store the <em>current state</em> of each entity.
          When you update a user&rsquo;s cart, the old cart is overwritten.{' '}
          <strong>Event sourcing</strong> takes the opposite approach: store every
          event that ever happened, and derive the current state by replaying them.
        </p>
        <p className="leading-relaxed">
          The event log is the source of truth. The current state is just a
          <em> read-optimized projection</em> that can be rebuilt at any time.
          This gives you a complete audit trail, the ability to debug by replaying
          to any point in time, and the freedom to create new projections
          retroactively.
        </p>
        <p className="leading-relaxed">
          Use the slider below to replay events up to any point and see how the
          derived state changes. Notice how the state after each &ldquo;OrderPlaced&rdquo;
          clears the cart.
        </p>
        <EventSourcingSketch />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Event Sourcing Benefits
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Complete audit trail of every change</li>
              <li>Time-travel debugging (replay to any point)</li>
              <li>Create new read models retroactively</li>
              <li>Events are immutable - no data loss</li>
              <li>Natural fit for event-driven architectures</li>
            </ul>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">
              Event Sourcing Challenges
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Event schema evolution over time</li>
              <li>Replaying long event logs is slow (use snapshots)</li>
              <li>Eventual consistency between projections</li>
              <li>Harder to query than a traditional database</li>
              <li>Requires discipline in event design</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Change Data Capture ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Change Data Capture (CDC)
        </h2>
        <p className="leading-relaxed">
          <strong>Change Data Capture</strong> bridges the gap between databases
          and stream processing. The idea: observe every insert, update, and delete
          on a database table and publish them as events to a message broker. This
          lets you keep derived systems (search indexes, caches, analytics) in sync
          with the database without coupling them directly.
        </p>
        <p className="leading-relaxed">
          Most databases already maintain a write-ahead log (WAL) or binary log
          that records every change. CDC tools like Debezium read this log and
          publish change events to Kafka. The downstream consumer does not need to
          poll the database - it receives changes as they happen.
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 font-mono text-sm">
          <p className="text-slate-400 mb-2">// CDC event from database WAL</p>
          <p className="text-green-400">{'{'}</p>
          <p className="text-slate-300 ml-4">&quot;op&quot;: &quot;UPDATE&quot;,</p>
          <p className="text-slate-300 ml-4">&quot;table&quot;: &quot;users&quot;,</p>
          <p className="text-slate-300 ml-4">&quot;before&quot;: {'{'} &quot;id&quot;: 42, &quot;name&quot;: &quot;Alice&quot;, &quot;email&quot;: &quot;old@example.com&quot; {'}'},</p>
          <p className="text-slate-300 ml-4">&quot;after&quot;: {'{'} &quot;id&quot;: 42, &quot;name&quot;: &quot;Alice&quot;, &quot;email&quot;: &quot;new@example.com&quot; {'}'},</p>
          <p className="text-slate-300 ml-4">&quot;ts_ms&quot;: 1712524800000</p>
          <p className="text-green-400">{'}'}</p>
        </div>
        <p className="leading-relaxed">
          CDC enables a powerful pattern: use a traditional relational database as
          the system of record, but derive event streams from it. You get the best
          of both worlds - ACID transactions for writes, real-time event streams
          for downstream processing.
        </p>
      </section>

      {/* ---- Exactly-Once Semantics ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Exactly-Once Semantics
        </h2>
        <p className="leading-relaxed">
          When processing events in a distributed system, failures are inevitable.
          A consumer might crash after processing a message but before committing
          its offset. How many times does each message get processed?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-red-400 mb-2">At-Most-Once</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Commit offset <em>before</em> processing. If the consumer crashes
              during processing, the message is lost. Fast but unreliable.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Use case: metrics that tolerate gaps
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">
              At-Least-Once
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Commit offset <em>after</em> processing. If the consumer crashes
              after processing but before committing, it will re-process the
              message on restart. Safe but may cause duplicates.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Use case: most stream processing (with idempotent writes)
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Exactly-Once
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Each message is processed exactly one time. Requires atomic
              transactions that span both the processing output and the offset
              commit. Very hard in practice.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Use case: financial transactions, billing
            </p>
          </div>
        </div>

        <p className="leading-relaxed">
          True exactly-once delivery is generally considered impossible in
          distributed systems (think: two generals problem). The practical
          solution is <strong>at-least-once delivery + idempotent processing</strong>.
          If your consumer can safely process the same message twice without
          changing the outcome (e.g., using a unique event ID to deduplicate),
          then at-least-once <em>effectively becomes</em> exactly-once from the
          application&rsquo;s perspective.
        </p>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 font-mono text-sm">
          <p className="text-slate-400 mb-2">// Idempotent write pattern</p>
          <p className="text-blue-400">INSERT INTO</p>
          <p className="text-slate-300 ml-4">payments (payment_id, amount, status)</p>
          <p className="text-blue-400">VALUES</p>
          <p className="text-slate-300 ml-4">(&apos;pay-12345&apos;, 99.99, &apos;completed&apos;)</p>
          <p className="text-blue-400">ON CONFLICT</p>
          <p className="text-slate-300 ml-4">(payment_id) <span className="text-blue-400">DO NOTHING</span>;</p>
          <p className="text-slate-400 mt-2">// Second attempt with same payment_id is a no-op</p>
        </div>
      </section>

      {/* ---- Python: MapReduce ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: MapReduce Word Count
        </h2>
        <p className="leading-relaxed">
          Implement the three phases of MapReduce from scratch. The map function
          emits (word, 1) pairs, shuffle groups by key, and reduce sums the counts.
        </p>
        <PythonCell defaultCode={mapreduceCode} />
      </section>

      {/* ---- Python: Event Sourcing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Event Sourcing System
        </h2>
        <p className="leading-relaxed">
          Build an event sourcing system with an append-only event store, state
          derivation via replay, and snapshot-based checkpointing for performance.
        </p>
        <PythonCell defaultCode={eventSourcingCode} />
      </section>

      {/* ---- Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Summary</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-3 text-slate-300 leading-relaxed">
          <p>
            <strong className="text-white">Batch processing</strong> transforms
            bounded datasets through MapReduce or dataflow engines. It is the
            workhorse for ETL, analytics, and ML training pipelines.
          </p>
          <p>
            <strong className="text-white">Stream processing</strong> reacts to
            unbounded event streams in real time, powered by message brokers like
            Kafka that decouple producers from consumers.
          </p>
          <p>
            <strong className="text-white">Event sourcing</strong> stores events
            rather than current state, enabling replay, auditing, and flexible
            projections. <strong>CDC</strong> connects traditional databases to
            event streams.
          </p>
          <p>
            <strong className="text-white">Exactly-once semantics</strong> are
            achieved in practice through idempotent processing on top of
            at-least-once delivery.
          </p>
        </div>
      </section>
    </div>
  )
}
