import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/kafka-foundations',
  title: 'Event-Driven Architecture & Kafka Fundamentals',
  description:
    'From request-response to event-driven systems — topics, partitions, consumer groups, delivery guarantees, and replication in Apache Kafka',
  track: 'systems',
  order: 11,
  tags: [
    'kafka',
    'event-driven',
    'partitions',
    'consumer-groups',
    'replication',
    'delivery-guarantees',
    'streaming',
  ],
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: [number, number, number],
  strokeColor: [number, number, number],
  label: string,
  labelSize = 10,
) {
  p.fill(fillColor[0], fillColor[1], fillColor[2])
  p.stroke(strokeColor[0], strokeColor[1], strokeColor[2])
  p.strokeWeight(1.5)
  p.rect(x - w / 2, y - h / 2, w, h, 6)
  p.fill(255)
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(labelSize)
  p.text(label, x, y)
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
  weight = 2,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 8
  p.stroke(color[0], color[1], color[2], color[3])
  p.strokeWeight(weight)
  p.line(x1, y1, x2, y2)
  p.fill(color[0], color[1], color[2], color[3])
  p.noStroke()
  p.triangle(
    x2,
    y2,
    x2 - headLen * Math.cos(angle - 0.35),
    y2 - headLen * Math.sin(angle - 0.35),
    x2 - headLen * Math.cos(angle + 0.35),
    y2 - headLen * Math.sin(angle + 0.35),
  )
}

function drawMovingDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
  size = 8,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

/* ================================================================== */
/*  Section 1 — Request-Response vs Event-Driven                       */
/* ================================================================== */

function RequestVsEventSection() {
  const [mode, setMode] = useState<'sync' | 'async'>('sync')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 420
    let canvasW = 800

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      p.background(15, 15, 25)
      const m = modeRef.current
      const cx = canvasW / 2

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(14)
      p.text(
        m === 'sync'
          ? 'Request-Response (Synchronous)'
          : 'Event-Driven (Asynchronous)',
        cx,
        12,
      )

      if (m === 'sync') {
        drawSyncDiagram(p, t, canvasW, canvasH)
      } else {
        drawAsyncDiagram(p, t, canvasW, canvasH)
      }
    }

    function drawSyncDiagram(p: p5, t: number, w: number, h: number) {
      const svcA = { x: w * 0.15, y: 100 }
      const svcB = { x: w * 0.5, y: 100 }
      const svcC = { x: w * 0.85, y: 100 }
      const client = { x: w * 0.15, y: 280 }

      drawBox(p, svcA.x, svcA.y, 100, 44, [30, 60, 90], [80, 160, 255], 'Service A')
      drawBox(p, svcB.x, svcB.y, 100, 44, [30, 60, 90], [80, 160, 255], 'Service B')
      drawBox(p, svcC.x, svcC.y, 100, 44, [30, 60, 90], [80, 160, 255], 'Service C')
      drawBox(p, client.x, client.y, 100, 44, [50, 30, 60], [180, 100, 220], 'Client')

      // Arrows between services
      drawArrow(p, svcA.x + 50, svcA.y, svcB.x - 50, svcB.y, [100, 180, 255, 150])
      drawArrow(p, svcB.x + 50, svcB.y, svcC.x - 50, svcC.y, [100, 180, 255, 150])
      drawArrow(p, client.x, client.y - 22, svcA.x, svcA.y + 22, [180, 100, 220, 150])

      // Animate request flowing: Client -> A -> B -> C, wait, then C -> B -> A -> Client
      const cycle = t % 4.0
      const requestColor: [number, number, number] = [100, 255, 150]
      const responseColor: [number, number, number] = [255, 180, 80]

      if (cycle < 0.5) {
        // Client -> A
        drawMovingDot(p, client.x, client.y - 22, svcA.x, svcA.y + 22, cycle / 0.5, requestColor)
      } else if (cycle < 1.0) {
        // A -> B
        drawMovingDot(p, svcA.x + 50, svcA.y, svcB.x - 50, svcB.y, (cycle - 0.5) / 0.5, requestColor)
      } else if (cycle < 1.5) {
        // B -> C
        drawMovingDot(p, svcB.x + 50, svcB.y, svcC.x - 50, svcC.y, (cycle - 1.0) / 0.5, requestColor)
      } else if (cycle < 2.0) {
        // C processing... (slow!) — show spinner
        const blink = Math.sin(t * 12) > 0
        p.fill(blink ? 255 : 80, blink ? 80 : 40, 40)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Processing...', svcC.x, svcC.y + 38)
      } else if (cycle < 2.5) {
        // C -> B
        drawMovingDot(p, svcC.x - 50, svcC.y, svcB.x + 50, svcB.y, (cycle - 2.0) / 0.5, responseColor)
      } else if (cycle < 3.0) {
        // B -> A
        drawMovingDot(p, svcB.x - 50, svcB.y, svcA.x + 50, svcA.y, (cycle - 2.5) / 0.5, responseColor)
      } else if (cycle < 3.5) {
        // A -> Client
        drawMovingDot(p, svcA.x, svcA.y + 22, client.x, client.y - 22, (cycle - 3.0) / 0.5, responseColor)
      }

      // Latency timeline at bottom
      const timelineY = h - 60
      p.stroke(60)
      p.strokeWeight(1)
      p.line(w * 0.1, timelineY, w * 0.9, timelineY)

      const segments = [
        { label: 'A->B', w: 0.12, color: [80, 160, 255] as [number, number, number] },
        { label: 'B->C', w: 0.12, color: [80, 160, 255] as [number, number, number] },
        { label: 'C proc', w: 0.3, color: [255, 80, 80] as [number, number, number] },
        { label: 'C->B', w: 0.12, color: [255, 180, 80] as [number, number, number] },
        { label: 'B->A', w: 0.12, color: [255, 180, 80] as [number, number, number] },
      ]
      let sx = w * 0.1
      const totalW = w * 0.8
      for (const seg of segments) {
        const segW = totalW * seg.w / 0.78
        p.fill(seg.color[0], seg.color[1], seg.color[2], 80)
        p.stroke(seg.color[0], seg.color[1], seg.color[2])
        p.strokeWeight(1)
        p.rect(sx, timelineY - 12, segW, 24, 3)
        p.fill(255)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(seg.label, sx + segW / 2, timelineY)
        sx += segW
      }

      p.fill(200, 80, 80)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Total latency = sum of ALL calls (cascading!)', p.width / 2, timelineY + 22)
    }

    function drawAsyncDiagram(p: p5, t: number, w: number, h: number) {
      const producer = { x: w * 0.12, y: 130 }
      const broker = { x: w * 0.42, y: 130 }
      const consB = { x: w * 0.75, y: 70 }
      const consC = { x: w * 0.75, y: 190 }

      drawBox(p, producer.x, producer.y, 100, 44, [30, 60, 40], [80, 200, 100], 'Service A')
      drawBox(p, broker.x, broker.y, 120, 70, [50, 40, 20], [220, 170, 60], 'Kafka\nBroker')
      drawBox(p, consB.x, consB.y, 100, 44, [30, 60, 90], [80, 160, 255], 'Service B')
      drawBox(p, consC.x, consC.y, 100, 44, [30, 60, 90], [80, 160, 255], 'Service C')

      // Arrows
      drawArrow(p, producer.x + 50, producer.y, broker.x - 60, broker.y, [80, 200, 100, 150])
      drawArrow(p, broker.x + 60, broker.y - 20, consB.x - 50, consB.y, [100, 180, 255, 150])
      drawArrow(p, broker.x + 60, broker.y + 20, consC.x - 50, consC.y, [100, 180, 255, 150])

      // Messages flowing — producer fires and forgets
      const cycle = t % 2.0
      const msgColor: [number, number, number] = [100, 255, 150]
      if (cycle < 0.6) {
        drawMovingDot(p, producer.x + 50, producer.y, broker.x - 60, broker.y, cycle / 0.6, msgColor)
      }

      // Consumer B reads quickly
      const cB = (t + 0.4) % 1.5
      if (cB < 0.6) {
        drawMovingDot(p, broker.x + 60, broker.y - 20, consB.x - 50, consB.y, cB / 0.6, [80, 180, 255])
      }

      // Consumer C reads slowly — but doesn't block B
      const cC = (t + 0.2) % 3.0
      if (cC < 1.0) {
        drawMovingDot(p, broker.x + 60, broker.y + 20, consC.x - 50, consC.y, cC / 1.0, [80, 180, 255])
      }

      // Show "slow" label on C occasionally
      if (Math.sin(t * 3) > 0.3) {
        p.fill(255, 180, 80)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('(slow, but independent)', consC.x, consC.y + 34)
      }

      // Ack from broker back to producer
      if (cycle >= 0.6 && cycle < 0.9) {
        drawMovingDot(p, broker.x - 60, broker.y, producer.x + 50, producer.y, (cycle - 0.6) / 0.3, [80, 200, 100])
      }

      p.fill(80, 200, 100)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Producer ack\'d immediately — no cascading latency', w / 2, h - 60)
      p.fill(150)
      p.textSize(10)
      p.text('Each consumer processes at its own pace', w / 2, h - 40)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        Request-Response vs Event-Driven Architecture
      </h2>
      <p className="text-gray-300 leading-relaxed">
        Most developers start with synchronous request-response: Service A calls Service B over HTTP,
        Service B calls Service C, and every service waits for the next one to finish before responding.
        This is conceptually simple but creates <strong className="text-white">temporal coupling</strong> --
        if Service C takes 3 seconds, the entire chain takes at least 3 seconds. If C is down, the
        entire chain fails. Every service is only as reliable as its least reliable dependency.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Event-driven architecture flips this model. Instead of Service A <em>calling</em> Service B,
        Service A <em>publishes an event</em> to a broker. Services B and C subscribe to events they
        care about and process them independently. Service A does not know (or care) who is listening.
        If Service C is slow, Service B is completely unaffected. If Service C goes down entirely,
        events queue up in the broker and C processes them when it recovers -- no data lost, no
        cascading failure.
      </p>

      <div className="flex gap-3 mb-2">
        <button
          onClick={() => setMode('sync')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'sync'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Synchronous (REST)
        </button>
        <button
          onClick={() => setMode('async')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'async'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Event-Driven (Kafka)
        </button>
      </div>

      <P5Sketch sketch={sketch} />

      <p className="text-gray-300 leading-relaxed">
        Toggle between the two architectures above. In the synchronous model, notice how the request
        dot must travel the entire chain and back before the client gets a response. The latency
        bar at the bottom shows how each hop adds to total response time -- and Service C's slow
        processing dominates everything.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In the event-driven model, Service A publishes to Kafka and gets an acknowledgment back almost
        immediately. Services B and C pull events at their own pace. A slow consumer C does not block
        a fast consumer B. This is the foundational insight behind event-driven systems: by introducing
        a durable buffer between producers and consumers, you decouple them in <strong className="text-white">time</strong>,{' '}
        <strong className="text-white">identity</strong>, and <strong className="text-white">rate</strong>.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Why Event-Driven?                                      */
/* ================================================================== */

function WhyEventDrivenSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Event-Driven?</h2>
      <p className="text-gray-300 leading-relaxed">
        The shift from request-response to event-driven is not about technology preferences -- it is
        about fundamental architectural properties that affect how your system behaves under real-world
        conditions. Here are the four pillars:
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Decoupling</h3>
      <p className="text-gray-300 leading-relaxed">
        In a REST architecture, Service A must know Service B's URL, API contract, and availability
        status. If you add a new Service D that also needs to process the same events, you must modify
        Service A to make an additional HTTP call. With events, Service A publishes to a topic. If
        you add Service D, you simply create a new consumer -- Service A is never modified. This is
        not just a nice-to-have; at scale (hundreds of microservices), this decoupling is the difference
        between teams shipping independently and a monolithic deployment nightmare.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Scalability</h3>
      <p className="text-gray-300 leading-relaxed">
        When you need to handle more load, you add more consumers to the consumer group. The broker
        rebalances partitions across the new consumers automatically. You do not touch the producer
        at all. Contrast this with REST: to handle more load on Service B, you add more instances
        behind a load balancer, but Service A still needs to handle retry logic, circuit breakers,
        and timeouts for each call. With events, the broker absorbs load spikes naturally -- events
        queue up during a burst and consumers drain them at their own pace.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Resilience</h3>
      <p className="text-gray-300 leading-relaxed">
        If a consumer crashes, its events are not lost. They sit in the broker until the consumer
        restarts and resumes from its last committed offset. In a REST world, if Service B is down
        when Service A makes a call, the request fails and you need retry logic, dead letter queues,
        and manual intervention. Kafka provides this durability out of the box -- events are persisted
        to disk and replicated across brokers. A consumer can go down for hours, come back, and
        process everything it missed.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Audit Trail</h3>
      <p className="text-gray-300 leading-relaxed">
        Events in Kafka are an <strong className="text-white">immutable, ordered log</strong>. Unlike a
        database where an UPDATE overwrites previous state, Kafka retains every event in sequence.
        This gives you a complete history of everything that happened. Want to debug why a user's
        account was charged twice? Replay the events. Need to build a new analytics pipeline that
        processes all historical data? Reset the consumer offset to zero and re-read everything.
        This is not theoretical -- companies like LinkedIn, Uber, and Netflix use Kafka's log as the
        source of truth for their systems.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Real-world example:</strong> At a typical e-commerce company,
          when a user places an order, the Order Service publishes an "OrderPlaced" event. The Inventory
          Service reserves stock, the Payment Service charges the card, the Email Service sends a confirmation,
          the Analytics Service records the purchase, and the Fraud Service scores the transaction -- all
          independently, all from the same event. Adding a new Loyalty Points Service next quarter?
          Just subscribe to "OrderPlaced." Zero changes to existing services.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Kafka Core Concepts (Animated Cluster)                 */
/* ================================================================== */

function CoreConceptsSection() {
  const [consumerCount, setConsumerCount] = useState(2)
  const countRef = useRef(consumerCount)
  countRef.current = consumerCount

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 520
    let canvasW = 800

    interface Message {
      id: number
      partIdx: number
      progress: number
      phase: 'produce' | 'stored' | 'consume'
      consumerIdx: number
      key: string
    }

    const messages: Message[] = []
    let msgId = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      const nConsumers = countRef.current
      const brokerColors: [number, number, number][] = [
        [60, 120, 180],
        [60, 150, 100],
        [140, 90, 60],
      ]

      // Layout
      const prodX = canvasW * 0.08
      const brokerStartX = canvasW * 0.25
      const brokerEndX = canvasW * 0.65
      const consX = canvasW * 0.85

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Kafka Cluster — 3 Brokers, 1 Topic, 4 Partitions', canvasW / 2, 10)

      // Draw brokers
      const brokerW = (brokerEndX - brokerStartX - 20) / 3
      for (let b = 0; b < 3; b++) {
        const bx = brokerStartX + b * (brokerW + 10)
        const by = 45
        const bh = 420
        p.fill(brokerColors[b][0] * 0.25, brokerColors[b][1] * 0.25, brokerColors[b][2] * 0.25)
        p.stroke(brokerColors[b][0], brokerColors[b][1], brokerColors[b][2], 100)
        p.strokeWeight(1)
        p.rect(bx, by, brokerW, bh, 8)
        p.fill(brokerColors[b][0] + 80, brokerColors[b][1] + 80, brokerColors[b][2] + 80)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Broker ${b}`, bx + brokerW / 2, by + 6)
      }

      // Partition placement: P0->B0, P1->B1, P2->B2, P3->B0
      const partBroker = [0, 1, 2, 0]
      const partSlot = [0, 0, 0, 1] // which slot within broker
      const partColors: [number, number, number][] = [
        [80, 160, 255],
        [80, 200, 120],
        [220, 170, 60],
        [200, 100, 180],
      ]

      // Draw partitions inside brokers
      const partPositions: { x: number; y: number }[] = []
      for (let pi = 0; pi < 4; pi++) {
        const b = partBroker[pi]
        const slot = partSlot[pi]
        const bx = brokerStartX + b * (brokerW + 10)
        const px = bx + brokerW / 2
        const py = 90 + slot * 200
        partPositions.push({ x: px, y: py })

        // Partition box
        const pw = brokerW - 20
        const ph = 160
        p.fill(partColors[pi][0] * 0.15, partColors[pi][1] * 0.15, partColors[pi][2] * 0.15)
        p.stroke(partColors[pi][0], partColors[pi][1], partColors[pi][2], 120)
        p.strokeWeight(1)
        p.rect(px - pw / 2, py - 10, pw, ph, 4)

        p.fill(partColors[pi][0], partColors[pi][1], partColors[pi][2])
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Partition ${pi}`, px, py - 6)

        // Draw offset segments (log)
        const segCount = 8
        const segW = (pw - 10) / segCount
        for (let s = 0; s < segCount; s++) {
          const sx = px - pw / 2 + 5 + s * segW
          const sy = py + 16
          const filled = s < 5 + Math.floor(Math.sin(t + pi) * 2 + 2)
          p.fill(
            filled ? partColors[pi][0] * 0.5 : 30,
            filled ? partColors[pi][1] * 0.5 : 30,
            filled ? partColors[pi][2] * 0.5 : 30,
          )
          p.stroke(partColors[pi][0], partColors[pi][1], partColors[pi][2], 60)
          p.strokeWeight(0.5)
          p.rect(sx, sy, segW - 2, 18, 2)
          if (filled) {
            p.fill(200)
            p.noStroke()
            p.textSize(7)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${s}`, sx + (segW - 2) / 2, sy + 9)
          }
        }

        // Offset label
        p.fill(150)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.TOP)
        p.text('offsets ->', px, py + 38)
      }

      // Producers
      const producers = ['Prod 1', 'Prod 2']
      for (let i = 0; i < producers.length; i++) {
        const py = 140 + i * 200
        drawBox(p, prodX, py, 70, 36, [40, 60, 30], [100, 200, 80], producers[i], 9)
      }

      // Consumers
      const consumerLabels = ['Cons 0', 'Cons 1', 'Cons 2', 'Cons 3']
      const consSpacing = 360 / Math.max(nConsumers, 1)
      for (let c = 0; c < nConsumers; c++) {
        const cy = 90 + c * consSpacing
        drawBox(p, consX, cy, 70, 36, [50, 30, 50], [180, 100, 220], consumerLabels[c], 9)

        // Show which partitions this consumer owns
        const assigned = getAssignedPartitions(c, nConsumers)
        p.fill(150)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`P[${assigned.join(',')}]`, consX, cy + 24)
      }

      // Animate messages
      if (Math.random() < 0.02) {
        const partIdx = Math.floor(Math.random() * 4)
        const consumerIdx = getConsumerForPartition(partIdx, nConsumers)
        messages.push({
          id: msgId++,
          partIdx,
          progress: 0,
          phase: 'produce',
          consumerIdx,
          key: ['user_1', 'user_2', 'order_A', 'order_B'][partIdx],
        })
      }

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        msg.progress += 0.012

        const pp = partPositions[msg.partIdx]
        const cy = 90 + msg.consumerIdx * consSpacing

        if (msg.phase === 'produce') {
          const fromX = prodX + 35
          const fromY = 140 + (msg.partIdx < 2 ? 0 : 1) * 200
          const toX = pp.x
          const toY = pp.y + 60
          if (msg.progress >= 1) {
            msg.progress = 0
            msg.phase = 'consume'
          } else {
            drawMovingDot(p, fromX, fromY, toX, toY, msg.progress, partColors[msg.partIdx], 6)
          }
        } else if (msg.phase === 'consume') {
          const fromX = pp.x
          const fromY = pp.y + 60
          const toX = consX - 35
          const toY = cy
          if (msg.progress >= 1) {
            messages.splice(i, 1)
          } else {
            drawMovingDot(p, fromX, fromY, toX, toY, msg.progress, partColors[msg.partIdx], 6)
          }
        }
      }

      // Consumer group label
      p.fill(180, 100, 220, 80)
      p.stroke(180, 100, 220, 60)
      p.strokeWeight(1)
      p.noFill()
      p.rect(consX - 45, 60, 90, nConsumers * consSpacing + 30, 8)
      p.fill(180, 100, 220)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Consumer Group', consX, 62)

      // Legend
      p.fill(150)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Colored dots = messages routed by key', 10, canvasH - 30)
      p.text('Offset numbers = position in partition log', 10, canvasH - 16)
    }

    function getAssignedPartitions(consumerIdx: number, total: number): number[] {
      const assigned: number[] = []
      for (let p = 0; p < 4; p++) {
        if (p % total === consumerIdx) assigned.push(p)
      }
      return assigned
    }

    function getConsumerForPartition(partIdx: number, total: number): number {
      return partIdx % total
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Kafka Core Concepts</h2>
      <p className="text-gray-300 leading-relaxed">
        Kafka's data model centers on a small number of powerful abstractions. Understanding them
        deeply is essential before you touch a single line of producer/consumer code.
      </p>

      <h3 className="text-xl font-semibold text-white">Topics & Partitions</h3>
      <p className="text-gray-300 leading-relaxed">
        A <strong className="text-white">topic</strong> is a named feed of events -- think of it as a
        category or channel. "user-signups", "order-events", "click-stream". A topic is split into
        one or more <strong className="text-white">partitions</strong>, and each partition is an ordered,
        append-only log of records. Messages within a partition have a unique, monotonically increasing{' '}
        <strong className="text-white">offset</strong> (basically a sequence number). This offset is how
        consumers track their position -- "I have processed up to offset 42 in partition 3."
      </p>
      <p className="text-gray-300 leading-relaxed">
        Partitions are the unit of parallelism in Kafka. A topic with 4 partitions can have up to 4
        consumers in a group reading in parallel. More partitions = more throughput, but also more
        overhead (more file handles, more replication traffic, longer leader election times). In
        practice, start with the number of partitions equal to your expected peak consumer count,
        and round up. You can always increase partitions later, but you cannot decrease them, and
        increasing them breaks key-based ordering guarantees.
      </p>

      <h3 className="text-xl font-semibold text-white">Brokers</h3>
      <p className="text-gray-300 leading-relaxed">
        A <strong className="text-white">broker</strong> is a single Kafka server. A Kafka cluster
        consists of multiple brokers (typically 3-5 in small deployments, hundreds in large ones like
        at LinkedIn). Each broker stores a subset of the partitions. When you create a topic with 4
        partitions and have 3 brokers, Kafka distributes the partitions across brokers (roughly evenly)
        for load balancing and fault tolerance.
      </p>

      <div className="flex gap-3 mb-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setConsumerCount(n)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              consumerCount === n
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n} Consumer{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} />

      <p className="text-gray-300 leading-relaxed">
        The visualization above shows a 3-broker cluster with a single topic split across 4 partitions.
        Change the consumer count and watch how partitions are reassigned. With 2 consumers, each gets
        2 partitions. With 4, each gets exactly 1. Notice: with more consumers than partitions, some
        consumers would be idle -- this is why the number of partitions sets the upper bound on consumer
        parallelism within a single group.
      </p>

      <h3 className="text-xl font-semibold text-white">Producers & Consumers</h3>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Producers</strong> write records to topics. Each record has an
        optional key and a value. If a key is provided, Kafka hashes the key to determine which
        partition the record goes to (all records with the same key go to the same partition, guaranteeing
        ordering per key). If no key is provided, Kafka uses round-robin or sticky partitioning to
        distribute records evenly.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Consumers</strong> read from topics by subscribing and polling.
        Each consumer tracks its position (offset) per partition. Consumers can be grouped into{' '}
        <strong className="text-white">consumer groups</strong>, where each partition is assigned to
        exactly one consumer in the group. This ensures no two consumers in the same group process the
        same message, enabling parallel processing without duplication.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Partitioning Deep Dive                                 */
/* ================================================================== */

function PartitioningSection() {
  const [mode, setMode] = useState<'keyed' | 'roundrobin' | 'hotkey'>('keyed')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 400
    let canvasW = 800

    interface KeyMsg {
      key: string
      partition: number
      x: number
      y: number
      targetX: number
      targetY: number
      progress: number
      color: [number, number, number]
    }

    const msgs: KeyMsg[] = []
    const partitionCounts = [0, 0, 0, 0]
    let rrIndex = 0

    const keyColors: Record<string, [number, number, number]> = {
      user_1: [80, 160, 255],
      user_2: [80, 200, 120],
      user_3: [220, 170, 60],
      user_4: [200, 100, 180],
      hot_key: [255, 80, 80],
    }

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)
      const m = modeRef.current

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      const titles: Record<string, string> = {
        keyed: 'Keyed Partitioning — Same key always goes to same partition',
        roundrobin: 'Round-Robin — Messages distributed evenly (no ordering guarantee)',
        hotkey: 'Hot Partition Problem — One key dominates a single partition',
      }
      p.text(titles[m], canvasW / 2, 8)

      // Hash function box
      const hashX = canvasW * 0.35
      const hashY = canvasH * 0.45
      drawBox(p, hashX, hashY, 80, 40, [50, 50, 20], [200, 200, 80], 'hash(key)\n% 4', 9)

      // Partitions on the right
      const partX = canvasW * 0.7
      const partYStart = 60
      const partSpacing = 80
      for (let pi = 0; pi < 4; pi++) {
        const py = partYStart + pi * partSpacing
        const barW = Math.min(partitionCounts[pi] * 3, 120)
        drawBox(p, partX, py, 80, 34, [30, 40, 60], [80, 130, 200], `P${pi}`, 10)
        // Count bar
        p.fill(80, 130, 200, 80)
        p.noStroke()
        p.rect(partX + 44, py - 8, barW, 16, 3)
        p.fill(200)
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${partitionCounts[pi]}`, partX + 48 + barW, py)
      }

      // Spawn messages
      if (Math.random() < (m === 'hotkey' ? 0.08 : 0.04)) {
        let key: string
        let partition: number

        if (m === 'keyed') {
          const keys = ['user_1', 'user_2', 'user_3', 'user_4']
          key = keys[Math.floor(Math.random() * keys.length)]
          partition = simpleHash(key, 4)
        } else if (m === 'roundrobin') {
          key = `msg_${Math.floor(Math.random() * 100)}`
          partition = rrIndex % 4
          rrIndex++
        } else {
          // hot key: 80% traffic goes to one key
          key = Math.random() < 0.8 ? 'hot_key' : ['user_1', 'user_2', 'user_3'][Math.floor(Math.random() * 3)]
          partition = m === 'hotkey' && key === 'hot_key' ? 1 : simpleHash(key, 4)
        }

        const startX = canvasW * 0.08
        const startY = 60 + Math.random() * 280
        const color = keyColors[key] || [150, 150, 150]
        msgs.push({
          key,
          partition,
          x: startX,
          y: startY,
          targetX: partX - 40,
          targetY: partYStart + partition * partSpacing,
          progress: 0,
          color,
        })
      }

      // Animate and draw messages
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        msg.progress += 0.015

        if (msg.progress < 0.4) {
          // Moving to hash
          const prog = msg.progress / 0.4
          const mx = msg.x + (hashX - 40 - msg.x) * prog
          const my = msg.y + (hashY - msg.y) * prog
          p.fill(msg.color[0], msg.color[1], msg.color[2])
          p.noStroke()
          p.ellipse(mx, my, 8, 8)
          p.fill(200)
          p.textSize(7)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(msg.key, mx + 6, my)
        } else if (msg.progress < 1.0) {
          // Hash to partition
          const prog = (msg.progress - 0.4) / 0.6
          const mx = hashX + 40 + (msg.targetX - hashX - 40) * prog
          const my = hashY + (msg.targetY - hashY) * prog
          p.fill(msg.color[0], msg.color[1], msg.color[2])
          p.noStroke()
          p.ellipse(mx, my, 8, 8)
        } else {
          partitionCounts[msg.partition]++
          msgs.splice(i, 1)
        }
      }

      // Key legend
      p.fill(150)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      let ly = canvasH - 40
      for (const [k, c] of Object.entries(keyColors)) {
        if (m !== 'hotkey' && k === 'hot_key') continue
        if (m === 'roundrobin') continue
        p.fill(c[0], c[1], c[2])
        p.ellipse(10, ly, 8, 8)
        p.fill(180)
        p.text(k, 20, ly)
        ly += 14
      }

      // Hot partition warning
      if (m === 'hotkey') {
        const totalCount = partitionCounts.reduce((a, b) => a + b, 0)
        if (totalCount > 20 && partitionCounts[1] / totalCount > 0.6) {
          p.fill(255, 80, 80, 180)
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('HOT PARTITION! P1 has ' + Math.round(partitionCounts[1] / totalCount * 100) + '% of traffic', canvasW * 0.7, canvasH - 20)
        }
      }
    }

    function simpleHash(key: string, numPartitions: number): number {
      let hash = 0
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
      }
      return Math.abs(hash) % numPartitions
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Partitioning Deep Dive</h2>
      <p className="text-gray-300 leading-relaxed">
        How a message ends up in a specific partition is one of Kafka's most important design decisions.
        The partitioning strategy directly affects ordering guarantees, parallelism, and load distribution.
      </p>
      <p className="text-gray-300 leading-relaxed">
        When a producer sends a record with a <strong className="text-white">key</strong>, Kafka computes
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">hash(key) % num_partitions</code> to
        determine the target partition. This guarantees that all records with the same key go to the same
        partition, which guarantees <strong className="text-white">ordering per key</strong>. This is
        critical: if you are processing events for user_123, you need their events in order
        (signup, then purchase, then refund -- not refund before signup).
      </p>
      <p className="text-gray-300 leading-relaxed">
        Without a key, Kafka uses a <strong className="text-white">sticky partitioner</strong> (since
        Kafka 2.4) that batches records to one partition until the batch is full, then switches. This
        gives better batching efficiency than pure round-robin while still distributing evenly.
      </p>

      <div className="flex gap-3 mb-2">
        {(['keyed', 'roundrobin', 'hotkey'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m === 'keyed' ? 'Keyed' : m === 'roundrobin' ? 'Round-Robin' : 'Hot Key'}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} />

      <p className="text-gray-300 leading-relaxed">
        The hot partition problem is real and painful. If one key has disproportionate traffic (a celebrity's
        user_id, a viral product_id), its partition becomes a bottleneck. All that traffic hits a single
        broker, a single consumer, and a single disk. Solutions include: adding a random suffix to hot keys
        (spreading across partitions at the cost of ordering), using a separate topic for high-traffic
        entities, or pre-splitting hot keys into sub-keys at the application level.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Consumer Groups & Rebalancing                          */
/* ================================================================== */

function ConsumerGroupsSection() {
  const [scenario, setScenario] = useState<'two-groups' | 'add-consumer' | 'consumer-dies'>('two-groups')
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 440
    let canvasW = 800

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)
      const sc = scenarioRef.current

      // Topic with 4 partitions in the center
      const topicX = canvasW * 0.38
      const topicY = 40
      const partW = 55
      const partH = 30
      const partGap = 8

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Topic: "user-events" (4 partitions)', topicX + (partW * 2 + partGap * 1.5), 10)

      const partColors: [number, number, number][] = [
        [80, 160, 255], [80, 200, 120], [220, 170, 60], [200, 100, 180],
      ]

      for (let pi = 0; pi < 4; pi++) {
        const px = topicX + pi * (partW + partGap)
        drawBox(p, px + partW / 2, topicY + 40, partW, partH, [30, 40, 60], partColors[pi], `P${pi}`, 9)

        // Animate messages being produced
        if (Math.sin(t * 3 + pi * 1.5) > 0.5) {
          p.fill(partColors[pi][0], partColors[pi][1], partColors[pi][2], 150)
          p.noStroke()
          p.ellipse(px + partW / 2, topicY + 28, 5, 5)
        }
      }

      if (sc === 'two-groups') {
        drawTwoGroups(p, t, canvasW, canvasH, topicX, partW, partGap, partColors)
      } else if (sc === 'add-consumer') {
        drawAddConsumer(p, t, canvasW, canvasH, topicX, partW, partGap, partColors)
      } else {
        drawConsumerDies(p, t, canvasW, canvasH, topicX, partW, partGap, partColors)
      }
    }

    function drawGroup(
      p: p5,
      label: string,
      consumers: { name: string; partitions: number[]; alive: boolean }[],
      groupX: number,
      groupY: number,
      topicX: number,
      partW: number,
      partGap: number,
      partColors: [number, number, number][],
      groupColor: [number, number, number],
      t: number,
    ) {
      const consH = 36
      const consW = 90
      const consGap = 10
      const totalH = consumers.length * (consH + consGap) + 30

      // Group outline
      p.noFill()
      p.stroke(groupColor[0], groupColor[1], groupColor[2], 60)
      p.strokeWeight(1)
      p.rect(groupX - consW / 2 - 10, groupY - 10, consW + 20, totalH, 8)

      p.fill(groupColor[0], groupColor[1], groupColor[2])
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text(label, groupX, groupY - 6)

      for (let ci = 0; ci < consumers.length; ci++) {
        const c = consumers[ci]
        const cy = groupY + 24 + ci * (consH + consGap)

        if (!c.alive) {
          p.fill(60, 20, 20)
          p.stroke(200, 60, 60)
          p.strokeWeight(1.5)
          p.rect(groupX - consW / 2, cy - consH / 2, consW, consH, 4)
          p.stroke(200, 60, 60)
          p.strokeWeight(2)
          p.line(groupX - 15, cy - 10, groupX + 15, cy + 10)
          p.line(groupX + 15, cy - 10, groupX - 15, cy + 10)
          p.fill(200, 60, 60)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(c.name + ' (DEAD)', groupX, cy + consH / 2 + 8)
          continue
        }

        drawBox(p, groupX, cy, consW, consH, [40, 30, 50], groupColor, c.name, 9)

        // Show assigned partitions
        p.fill(180)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`P[${c.partitions.join(',')}]`, groupX, cy + consH / 2 + 8)

        // Draw lines from partitions to this consumer
        for (const pi of c.partitions) {
          const px = topicX + pi * (partW + partGap) + partW / 2
          const py = 70
          const lineAlpha = 60 + Math.sin(t * 2 + ci + pi) * 30
          p.stroke(partColors[pi][0], partColors[pi][1], partColors[pi][2], lineAlpha)
          p.strokeWeight(1)
          p.line(px, py, groupX, cy - consH / 2)

          // Message dots flowing down
          const dotProg = (t * 0.5 + pi * 0.3 + ci * 0.2) % 1
          drawMovingDot(p, px, py, groupX, cy - consH / 2, dotProg, partColors[pi], 5)
        }
      }
    }

    function drawTwoGroups(
      p: p5, t: number, w: number, _h: number,
      topicX: number, partW: number, partGap: number,
      partColors: [number, number, number][],
    ) {
      p.fill(200)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Both groups get ALL messages independently', w / 2, 90)

      drawGroup(
        p, 'Group: "analytics"',
        [
          { name: 'Analytics-0', partitions: [0, 1], alive: true },
          { name: 'Analytics-1', partitions: [2, 3], alive: true },
        ],
        w * 0.22, 120, topicX, partW, partGap, partColors, [80, 180, 220], t,
      )

      drawGroup(
        p, 'Group: "notifications"',
        [
          { name: 'Notif-0', partitions: [0, 1, 2, 3], alive: true },
        ],
        w * 0.75, 120, topicX, partW, partGap, partColors, [220, 150, 80], t,
      )

      p.fill(150)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Analytics group: 2 consumers, 2 partitions each', 10, _h - 30)
      p.text('Notifications group: 1 consumer, all 4 partitions', 10, _h - 16)
    }

    function drawAddConsumer(
      p: p5, t: number, w: number, _h: number,
      topicX: number, partW: number, partGap: number,
      partColors: [number, number, number][],
    ) {
      const phase = Math.floor(t / 4) % 2

      if (phase === 0) {
        p.fill(200)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Before: 2 consumers, 2 partitions each', w / 2, 90)

        drawGroup(
          p, 'Group: "processing"',
          [
            { name: 'Worker-0', partitions: [0, 1], alive: true },
            { name: 'Worker-1', partitions: [2, 3], alive: true },
          ],
          w * 0.5, 120, topicX, partW, partGap, partColors, [120, 200, 120], t,
        )
      } else {
        p.fill(100, 255, 150)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('After: 4 consumers! Rebalancing assigns 1 partition each', w / 2, 90)

        drawGroup(
          p, 'Group: "processing" (rebalanced)',
          [
            { name: 'Worker-0', partitions: [0], alive: true },
            { name: 'Worker-1', partitions: [1], alive: true },
            { name: 'Worker-2', partitions: [2], alive: true },
            { name: 'Worker-3', partitions: [3], alive: true },
          ],
          w * 0.5, 120, topicX, partW, partGap, partColors, [120, 200, 120], t,
        )
      }

      // Rebalance flash
      if (Math.abs((t % 4) - 4) < 0.3 || Math.abs((t % 4) - 0) < 0.3) {
        p.fill(255, 255, 100, 30)
        p.noStroke()
        p.rect(0, 80, w, _h - 80)
        p.fill(255, 255, 100)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('REBALANCING...', w / 2, _h / 2)
      }
    }

    function drawConsumerDies(
      p: p5, t: number, w: number, _h: number,
      topicX: number, partW: number, partGap: number,
      partColors: [number, number, number][],
    ) {
      const phase = Math.floor(t / 5) % 2

      if (phase === 0) {
        p.fill(200)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Normal: 3 consumers handling 4 partitions', w / 2, 90)

        drawGroup(
          p, 'Group: "processing"',
          [
            { name: 'Worker-0', partitions: [0], alive: true },
            { name: 'Worker-1', partitions: [1, 2], alive: true },
            { name: 'Worker-2', partitions: [3], alive: true },
          ],
          w * 0.5, 120, topicX, partW, partGap, partColors, [120, 200, 120], t,
        )
      } else {
        p.fill(255, 80, 80)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Worker-1 CRASHED! Its partitions reassigned to survivors', w / 2, 90)

        drawGroup(
          p, 'Group: "processing" (after failure)',
          [
            { name: 'Worker-0', partitions: [0, 1], alive: true },
            { name: 'Worker-1', partitions: [], alive: false },
            { name: 'Worker-2', partitions: [2, 3], alive: true },
          ],
          w * 0.5, 120, topicX, partW, partGap, partColors, [120, 200, 120], t,
        )
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Consumer Groups & Rebalancing</h2>
      <p className="text-gray-300 leading-relaxed">
        Consumer groups are Kafka's mechanism for parallel processing with no duplicate consumption.
        Every consumer belongs to a group (identified by a <code className="text-yellow-300 bg-gray-800 px-1 rounded">group.id</code>).
        Within a group, each partition is assigned to exactly one consumer. Across groups, every group
        gets its own independent copy of all messages.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is the key distinction from traditional message queues like RabbitMQ: in RabbitMQ, once a
        message is consumed and acknowledged, it is gone. In Kafka, the message stays in the log. Multiple
        consumer groups can each read the same messages at their own pace. The "analytics" group can be
        3 hours behind while the "notifications" group is real-time -- they do not interfere with each other.
      </p>

      <div className="flex gap-3 mb-2">
        {(['two-groups', 'add-consumer', 'consumer-dies'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              scenario === s
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s === 'two-groups' ? 'Two Groups' : s === 'add-consumer' ? 'Add Consumer' : 'Consumer Dies'}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} />

      <h3 className="text-xl font-semibold text-white mt-6">Rebalancing Protocol</h3>
      <p className="text-gray-300 leading-relaxed">
        When a consumer joins or leaves a group, Kafka triggers a <strong className="text-white">rebalance</strong>.
        The group coordinator (a designated broker) revokes all partition assignments and reassigns them.
        During a rebalance, <em>no consumer in the group can process messages</em>. This "stop the world"
        pause is the biggest pain point with Kafka consumer groups.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Kafka 2.4 introduced <strong className="text-white">incremental cooperative rebalancing</strong>,
        which only revokes partitions that actually need to move, reducing downtime. But rebalancing
        still causes latency spikes, so minimizing unnecessary rebalances is critical in production.
        Common causes of unwanted rebalances: consumers taking too long to process (exceeding{' '}
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">max.poll.interval.ms</code>),
        unstable network causing heartbeat timeouts, or frequent deployments cycling consumer instances.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Delivery Guarantees                                    */
/* ================================================================== */

function DeliveryGuaranteesSection() {
  const [guarantee, setGuarantee] = useState<'at-most-once' | 'at-least-once' | 'exactly-once'>('at-least-once')
  const guaranteeRef = useRef(guarantee)
  guaranteeRef.current = guarantee

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 380
    let canvasW = 800

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const g = guaranteeRef.current

      const prodX = canvasW * 0.1
      const brokerX = canvasW * 0.42
      const consX = canvasW * 0.75
      const timeY = 60

      drawBox(p, prodX, timeY, 80, 36, [40, 60, 30], [100, 200, 80], 'Producer', 10)
      drawBox(p, brokerX, timeY, 80, 36, [50, 40, 20], [220, 170, 60], 'Broker', 10)
      drawBox(p, consX, timeY, 80, 36, [50, 30, 50], [180, 100, 220], 'Consumer', 10)

      // Timeline
      const tlY = 110
      const tlH = 230
      for (const x of [prodX, brokerX, consX]) {
        p.stroke(80)
        p.strokeWeight(1)
        p.line(x, tlY, x, tlY + tlH)
      }

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)

      if (g === 'at-most-once') {
        p.text('At-Most-Once: Fire and forget', canvasW / 2, 10)
        drawAtMostOnce(p, t, prodX, brokerX, consX, tlY, tlH, canvasW)
      } else if (g === 'at-least-once') {
        p.text('At-Least-Once: Retry until ack (may duplicate)', canvasW / 2, 10)
        drawAtLeastOnce(p, t, prodX, brokerX, consX, tlY, tlH, canvasW)
      } else {
        p.text('Exactly-Once: Idempotent producer + transactional writes', canvasW / 2, 10)
        drawExactlyOnce(p, t, prodX, brokerX, consX, tlY, tlH, canvasW)
      }
    }

    function drawTimelineMsg(
      p: p5,
      x1: number, x2: number,
      y: number,
      color: [number, number, number],
      label: string,
      failed = false,
    ) {
      if (failed) {
        p.stroke(200, 60, 60)
        p.strokeWeight(2)
        const midX = (x1 + x2) / 2
        p.line(x1, y, midX, y)
        p.fill(200, 60, 60)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('X', midX, y - 1)
      } else {
        drawArrow(p, x1, y, x2, y, [color[0], color[1], color[2], 200], 1.5)
      }
      p.fill(180)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(label, (x1 + x2) / 2, y - 4)
    }

    function drawAtMostOnce(
      p: p5, _t: number,
      prodX: number, brokerX: number, consX: number,
      tlY: number, _tlH: number, _w: number,
    ) {
      const step = Math.floor(_t * 0.8) % 6
      const yBase = tlY + 20

      // Steps
      if (step >= 0) drawTimelineMsg(p, prodX, brokerX, yBase, [100, 200, 80], 'send msg')
      if (step >= 1) drawTimelineMsg(p, brokerX, prodX, yBase + 35, [220, 170, 60], 'ack (disabled)')
      if (step >= 2) drawTimelineMsg(p, brokerX, consX, yBase + 70, [180, 100, 220], 'deliver')
      if (step >= 3) {
        // Consumer crashes before processing
        p.fill(255, 80, 80)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Consumer crashes!', consX, yBase + 95)
        p.text('Message LOST', consX, yBase + 110)
      }
      if (step >= 4) {
        p.fill(255, 200, 80)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Offset already committed', brokerX, yBase + 140)
        p.text('-> message will NOT be redelivered', brokerX, yBase + 155)
      }

      p.fill(150)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Use case: metrics/logging where losing some data is acceptable', 10, tlY + _tlH + 20)
    }

    function drawAtLeastOnce(
      p: p5, _t: number,
      prodX: number, brokerX: number, consX: number,
      tlY: number, _tlH: number, _w: number,
    ) {
      const step = Math.floor(_t * 0.7) % 7
      const yBase = tlY + 20

      if (step >= 0) drawTimelineMsg(p, prodX, brokerX, yBase, [100, 200, 80], 'send msg')
      if (step >= 1) drawTimelineMsg(p, brokerX, consX, yBase + 30, [180, 100, 220], 'deliver')
      if (step >= 2) {
        p.fill(100, 255, 150)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('processed OK', consX + 50, yBase + 55)
      }
      if (step >= 3) {
        // Consumer crashes before committing offset
        p.fill(255, 80, 80)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('CRASH before offset commit!', consX, yBase + 80)
      }
      if (step >= 4) {
        p.fill(255, 200, 80)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Consumer restarts...', consX, yBase + 105)
      }
      if (step >= 5) drawTimelineMsg(p, brokerX, consX, yBase + 130, [180, 100, 220], 're-deliver (DUPLICATE)')
      if (step >= 6) {
        p.fill(255, 180, 80)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Same message processed TWICE', _w / 2, yBase + 160)
        p.text('-> consumer must be idempotent!', _w / 2, yBase + 175)
      }

      p.fill(150)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Most common setting. Consumer must handle duplicates (idempotent writes).', 10, tlY + _tlH + 20)
    }

    function drawExactlyOnce(
      p: p5, _t: number,
      prodX: number, brokerX: number, consX: number,
      tlY: number, _tlH: number, w: number,
    ) {
      const step = Math.floor(_t * 0.6) % 6
      const yBase = tlY + 20

      if (step >= 0) drawTimelineMsg(p, prodX, brokerX, yBase, [100, 200, 80], 'send (idempotent, PID+seq)')
      if (step >= 1) {
        p.fill(100, 200, 100)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Broker deduplicates by PID+seq', brokerX + 50, yBase + 20)
      }
      if (step >= 2) drawTimelineMsg(p, brokerX, prodX, yBase + 40, [220, 170, 60], 'ack')
      if (step >= 3) drawTimelineMsg(p, brokerX, consX, yBase + 70, [180, 100, 220], 'deliver in transaction')
      if (step >= 4) {
        p.fill(100, 200, 255)
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Consume + produce + offset commit', w / 2, yBase + 95)
        p.text('all in ONE atomic transaction', w / 2, yBase + 110)
      }
      if (step >= 5) {
        p.fill(100, 255, 150)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Result: exactly-once processing', w / 2, yBase + 140)
        p.text('(within Kafka — external systems need idempotency)', w / 2, yBase + 158)
      }

      p.fill(150)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Requires enable.idempotence=true + transactional.id. Higher latency, lower throughput.', 10, tlY + _tlH + 20)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Delivery Guarantees</h2>
      <p className="text-gray-300 leading-relaxed">
        Delivery semantics in Kafka are often misunderstood. The guarantee is a contract between the
        producer, broker, and consumer -- and each component can fail independently.
      </p>

      <h3 className="text-xl font-semibold text-white">At-Most-Once</h3>
      <p className="text-gray-300 leading-relaxed">
        The producer sends the message and does not retry on failure. The consumer commits its offset
        <em> before</em> processing. If processing fails, the message is never reprocessed. Data loss
        is possible but you will never see duplicates. Used for non-critical telemetry where losing
        a few data points is acceptable.
      </p>

      <h3 className="text-xl font-semibold text-white">At-Least-Once</h3>
      <p className="text-gray-300 leading-relaxed">
        The producer retries on failure. The consumer commits its offset <em>after</em> processing.
        If the consumer crashes after processing but before committing, it will reprocess the message
        on restart. No data loss, but duplicates are possible. This is the <strong className="text-white">
        default and most common</strong> setting. Your consumer must be idempotent -- meaning processing
        the same message twice has the same effect as processing it once (e.g., using UPSERT instead
        of INSERT, or deduplicating by a unique message ID).
      </p>

      <h3 className="text-xl font-semibold text-white">Exactly-Once</h3>
      <p className="text-gray-300 leading-relaxed">
        Kafka 0.11+ supports exactly-once semantics (EOS) through two mechanisms:{' '}
        <strong className="text-white">idempotent producers</strong> (each producer gets a PID and
        sequence number; the broker deduplicates retries) and{' '}
        <strong className="text-white">transactional writes</strong> (the consumer's offset commit and
        any produced output records are wrapped in an atomic transaction). This gives you exactly-once
        <em> within Kafka</em>. For external systems (databases, APIs), you still need application-level
        idempotency.
      </p>

      <div className="flex gap-3 mb-2">
        {(['at-most-once', 'at-least-once', 'exactly-once'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGuarantee(g)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              guarantee === g
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {g.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Replication & Durability                               */
/* ================================================================== */

function ReplicationSection() {
  const [acksMode, setAcksMode] = useState<0 | 1 | 'all'>(1)
  const [leaderAlive, setLeaderAlive] = useState(true)
  const ackRef = useRef(acksMode)
  ackRef.current = acksMode
  const aliveRef = useRef(leaderAlive)
  aliveRef.current = leaderAlive

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 420
    let canvasW = 800

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.014
      p.background(15, 15, 25)

      const acks = ackRef.current
      const alive = aliveRef.current

      const prodX = canvasW * 0.1
      const leaderX = canvasW * 0.42
      const f1X = canvasW * 0.68
      const f2X = canvasW * 0.88
      const nodeY = 100

      // Producer
      drawBox(p, prodX, nodeY, 80, 40, [40, 60, 30], [100, 200, 80], 'Producer', 10)

      // Leader
      if (alive) {
        drawBox(p, leaderX, nodeY, 90, 40, [40, 50, 80], [100, 160, 255], 'Leader', 10)
        p.fill(100, 160, 255)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Partition 0', leaderX, nodeY + 28)
      } else {
        p.fill(50, 20, 20)
        p.stroke(200, 60, 60)
        p.strokeWeight(1.5)
        p.rect(leaderX - 45, nodeY - 20, 90, 40, 6)
        p.stroke(200, 60, 60)
        p.strokeWeight(3)
        p.line(leaderX - 15, nodeY - 10, leaderX + 15, nodeY + 10)
        p.line(leaderX + 15, nodeY - 10, leaderX - 15, nodeY + 10)
        p.fill(200, 60, 60)
        p.noStroke()
        p.textSize(9)
        p.text('Leader DOWN', leaderX, nodeY + 28)
      }

      // Followers
      const followerAlive = !alive // If leader dies, follower 1 becomes new leader
      drawBox(p, f1X, nodeY, 90, 40,
        followerAlive ? [40, 50, 80] : [30, 50, 40],
        followerAlive ? [100, 160, 255] : [80, 200, 120],
        followerAlive ? 'NEW Leader' : 'Follower 1', 10,
      )
      drawBox(p, f2X, nodeY, 90, 40, [30, 50, 40], [80, 200, 120], 'Follower 2', 10)

      // ISR label
      p.fill(200, 200, 80)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      if (alive) {
        p.text('ISR: {Leader, F1, F2}', canvasW / 2, nodeY - 40)
      } else {
        p.text('ISR: {F1 (new leader), F2}', canvasW / 2, nodeY - 40)
      }

      // Replication arrows
      if (alive) {
        drawArrow(p, leaderX + 45, nodeY, f1X - 45, nodeY, [80, 200, 120, 120])
        drawArrow(p, leaderX + 45, nodeY + 10, f2X - 45, nodeY + 10, [80, 200, 120, 120])

        // Animate replication
        const repProg = (t * 0.5) % 1
        drawMovingDot(p, leaderX + 45, nodeY, f1X - 45, nodeY, repProg, [80, 200, 120], 6)
        drawMovingDot(p, leaderX + 45, nodeY + 10, f2X - 45, nodeY + 10, (repProg + 0.3) % 1, [80, 200, 120], 6)

        // Producer write
        const writeProg = (t * 0.4) % 1
        drawMovingDot(p, prodX + 40, nodeY, leaderX - 45, nodeY, writeProg, [100, 200, 80], 7)
      }

      // Acks explanation
      const infoY = 180
      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`acks=${acks}`, 20, infoY)

      p.fill(180)
      p.textSize(10)
      if (acks === 0) {
        p.text('Producer does not wait for any acknowledgment.', 20, infoY + 20)
        p.text('Fastest, but message may be lost if broker crashes before writing to disk.', 20, infoY + 36)
        p.text('Use case: ultra-high-throughput metrics where some loss is OK.', 20, infoY + 52)

        // Show message going and immediately returning
        p.fill(100, 255, 100, 150)
        p.textSize(9)
        p.text('-> Producer continues immediately (no ack wait)', 20, infoY + 72)
      } else if (acks === 1) {
        p.text('Producer waits for leader to write to its local log.', 20, infoY + 20)
        p.text('Message is persisted on leader but NOT yet replicated.', 20, infoY + 36)
        p.text('If leader crashes before replication, message is LOST.', 20, infoY + 52)
        p.fill(255, 180, 80)
        p.text('This is the default and a common source of data loss in production.', 20, infoY + 72)
      } else {
        p.text('Producer waits for ALL in-sync replicas (ISR) to acknowledge.', 20, infoY + 20)
        p.text('Message is safely replicated before producer gets ack.', 20, infoY + 36)
        p.text('If leader crashes, followers have the data. No data loss.', 20, infoY + 52)
        p.fill(100, 255, 150)
        p.text('Highest durability. Use for financial/critical data.', 20, infoY + 72)
        p.fill(255, 200, 80)
        p.textSize(9)
        p.text('Trade-off: higher latency (must wait for slowest ISR member).', 20, infoY + 88)
      }

      // Leader election explanation
      if (!alive) {
        const elecY = infoY + 110
        p.fill(100, 160, 255)
        p.textSize(11)
        p.text('Leader Failover:', 20, elecY)
        p.fill(180)
        p.textSize(10)
        p.text('1. Controller detects leader is dead (missed heartbeat)', 20, elecY + 18)
        p.text('2. Controller picks a new leader from ISR (Follower 1)', 20, elecY + 34)
        p.text('3. New leader starts accepting writes', 20, elecY + 50)
        p.text('4. Follower 2 now replicates from new leader', 20, elecY + 66)

        p.fill(255, 200, 80)
        p.textSize(9)
        p.text('Unclean leader election: if ALL ISR members are dead, promote an out-of-sync', 20, elecY + 90)
        p.text('replica. Allows availability but LOSES data. Controlled by unclean.leader.election.enable.', 20, elecY + 104)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Replication & Durability</h2>
      <p className="text-gray-300 leading-relaxed">
        Every Kafka partition can be replicated across multiple brokers. One replica is the{' '}
        <strong className="text-white">leader</strong> (handles all reads and writes), and the others
        are <strong className="text-white">followers</strong> that replicate from the leader. The set
        of replicas that are fully caught up is called the{' '}
        <strong className="text-white">ISR (In-Sync Replicas)</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        A follower falls out of the ISR if it falls too far behind the leader (controlled by{' '}
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">replica.lag.time.max.ms</code>).
        The ISR is critical because{' '}
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">acks=all</code> only waits for ISR
        members, not all replicas. If a slow follower drops out of ISR, it will not block producer writes.
        This is the tension: a small ISR means faster acks but less durability.
      </p>

      <div className="flex gap-3 mb-2">
        <span className="text-gray-400 text-sm self-center mr-1">acks:</span>
        {([0, 1, 'all'] as const).map((a) => (
          <button
            key={String(a)}
            onClick={() => setAcksMode(a)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              acksMode === a
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            acks={String(a)}
          </button>
        ))}
        <button
          onClick={() => setLeaderAlive(!leaderAlive)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ml-4 ${
            !leaderAlive
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {leaderAlive ? 'Kill Leader' : 'Restore Leader'}
        </button>
      </div>

      <P5Sketch sketch={sketch} />

      <p className="text-gray-300 leading-relaxed">
        The combination of <code className="text-yellow-300 bg-gray-800 px-1 rounded">acks=all</code> +{' '}
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">min.insync.replicas=2</code> is the
        gold standard for durability. With a replication factor of 3 and min ISR of 2, the producer's
        write is acknowledged only after at least 2 replicas (the leader + 1 follower) have persisted it.
        Even if the leader crashes immediately after acking, the data survives on the follower. If
        fewer than 2 replicas are in the ISR, the broker rejects writes entirely -- preferring
        unavailability over data loss.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Kafka vs Alternatives                                  */
/* ================================================================== */

function KafkaVsAlternativesSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Kafka vs Alternatives</h2>
      <p className="text-gray-300 leading-relaxed">
        Kafka is not the only messaging system, and it is not always the right choice. Understanding
        the trade-offs helps you pick the right tool.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300 border border-gray-700 rounded-lg">
          <thead className="text-gray-200 bg-gray-800">
            <tr>
              <th className="px-4 py-3 border-b border-gray-700">Property</th>
              <th className="px-4 py-3 border-b border-gray-700">Kafka</th>
              <th className="px-4 py-3 border-b border-gray-700">RabbitMQ</th>
              <th className="px-4 py-3 border-b border-gray-700">AWS SQS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Model</td>
              <td className="px-4 py-2">Distributed log (pull-based)</td>
              <td className="px-4 py-2">Message broker (push-based)</td>
              <td className="px-4 py-2">Managed queue (pull-based)</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Retention</td>
              <td className="px-4 py-2">Configurable (days/forever)</td>
              <td className="px-4 py-2">Until consumed & acked</td>
              <td className="px-4 py-2">Up to 14 days</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Ordering</td>
              <td className="px-4 py-2">Per-partition</td>
              <td className="px-4 py-2">Per-queue (FIFO)</td>
              <td className="px-4 py-2">Best-effort (FIFO queues available)</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Multi-consumer</td>
              <td className="px-4 py-2">Yes (consumer groups)</td>
              <td className="px-4 py-2">Requires exchange fanout</td>
              <td className="px-4 py-2">No (use SNS+SQS)</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Replay</td>
              <td className="px-4 py-2">Yes (seek to offset)</td>
              <td className="px-4 py-2">No (consumed = gone)</td>
              <td className="px-4 py-2">No</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="px-4 py-2 text-white font-medium">Throughput</td>
              <td className="px-4 py-2">Millions/sec per cluster</td>
              <td className="px-4 py-2">Tens of thousands/sec</td>
              <td className="px-4 py-2">Virtually unlimited (managed)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-white font-medium">Complexity</td>
              <td className="px-4 py-2">High (ZK/KRaft, partitions, ISR)</td>
              <td className="px-4 py-2">Medium (exchanges, bindings)</td>
              <td className="px-4 py-2">Low (fully managed)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6">When to use Kafka</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>High-throughput event streaming (millions of events per second)</li>
        <li>Event sourcing / CQRS patterns where you need an immutable log</li>
        <li>Multiple consumers need to independently process the same events</li>
        <li>You need replay capability (reprocessing historical data)</li>
        <li>Stream processing pipelines (Kafka Streams, Flink, Spark Structured Streaming)</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">When to use RabbitMQ instead</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Complex routing logic (topic exchanges, headers-based routing)</li>
        <li>Per-message acknowledgment and redelivery (traditional task queues)</li>
        <li>Lower throughput, simpler operational needs</li>
        <li>Message priority queues</li>
        <li>Protocols beyond AMQP: MQTT, STOMP</li>
      </ul>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Key insight:</strong> Kafka is a <em>log</em>, not a
          <em> queue</em>. A log retains messages after consumption and supports multiple readers at
          different positions. A queue delivers a message to one consumer and deletes it. This
          fundamental difference determines when each tool is appropriate. If you find yourself
          fighting Kafka to behave like a queue (per-message ack, selective consumption, priority),
          you probably want RabbitMQ or SQS.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function KafkaFoundations() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">
          Event-Driven Architecture & Kafka Fundamentals
        </h1>
        <p className="text-lg text-gray-400">
          From synchronous request-response to asynchronous event streaming -- a deep dive into
          Apache Kafka's architecture, partitioning model, consumer groups, delivery guarantees,
          and replication. The foundation for every real-world Kafka deployment.
        </p>
      </header>

      <RequestVsEventSection />
      <WhyEventDrivenSection />
      <CoreConceptsSection />
      <PartitioningSection />
      <ConsumerGroupsSection />
      <DeliveryGuaranteesSection />
      <ReplicationSection />
      <KafkaVsAlternativesSection />
    </div>
  )
}
