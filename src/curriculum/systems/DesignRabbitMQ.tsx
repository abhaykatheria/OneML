import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-rabbitmq',
  title: 'Design RabbitMQ',
  description:
    'System design deep dive: a message broker with exchanges, queues, bindings, acknowledgments, and high-availability clustering',
  track: 'systems',
  order: 14,
  tags: [
    'rabbitmq',
    'message-broker',
    'amqp',
    'exchanges',
    'queues',
    'pub-sub',
    'system-design',
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

function drawQueue(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  msgCount: number,
  color: [number, number, number],
) {
  p.fill(color[0] * 0.2, color[1] * 0.2, color[2] * 0.2)
  p.stroke(color[0], color[1], color[2])
  p.strokeWeight(1.5)
  p.rect(x - w / 2, y - h / 2, w, h, 4)

  // Draw message slots inside
  const slotW = 8
  const slotGap = 3
  const startX = x - w / 2 + 6
  for (let i = 0; i < Math.min(msgCount, Math.floor((w - 12) / (slotW + slotGap))); i++) {
    p.fill(color[0], color[1], color[2], 180)
    p.noStroke()
    p.rect(startX + i * (slotW + slotGap), y - h / 4, slotW, h / 2, 2)
  }

  p.fill(255)
  p.noStroke()
  p.textAlign(p.CENTER, p.TOP)
  p.textSize(8)
  p.text(label, x, y + h / 2 + 3)
}

/* ================================================================== */
/*  Section 1 -- Problem Statement                                     */
/* ================================================================== */

function ProblemStatementSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a <strong className="text-white">message broker</strong> that decouples producers from
        consumers, supports flexible routing patterns, guarantees message delivery, and handles
        backpressure gracefully. This is RabbitMQ: the most widely deployed AMQP message broker,
        powering asynchronous workflows at companies from Bloomberg to Reddit.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The core tension: we want reliable delivery (no message lost) but also high throughput. We want
        flexible routing (messages reach the right consumers) without coupling producers to consumers.
        We want the broker to be smart enough to handle routing but simple enough to operate.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Functional Requirements                               */
/* ================================================================== */

function FunctionalRequirementsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">2. Functional Requirements</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">Publish messages:</strong> producers send messages to exchanges with a routing key</li>
        <li><strong className="text-white">Consume messages:</strong> consumers subscribe to queues, receive messages pushed by broker</li>
        <li><strong className="text-white">Exchange types:</strong>
          <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-gray-400">
            <li>Direct: route by exact routing key match</li>
            <li>Fanout: broadcast to all bound queues</li>
            <li>Topic: route by wildcard pattern matching (*.stock.#)</li>
            <li>Headers: route by message header attributes</li>
          </ul>
        </li>
        <li><strong className="text-white">Acknowledgments:</strong> consumer ack/nack with optional requeue</li>
        <li><strong className="text-white">Dead letter queues:</strong> rejected/expired messages routed to DLQ for inspection</li>
        <li><strong className="text-white">Message priority:</strong> priority queues (0-255) for urgent messages</li>
        <li><strong className="text-white">Delayed messages:</strong> publish with a delay before delivery via plugins or DLX+TTL</li>
        <li><strong className="text-white">Message TTL:</strong> per-message and per-queue expiration</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Non-Functional Requirements                           */
/* ================================================================== */

function NonFunctionalRequirementsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">3. Non-Functional Requirements</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Dimension</th>
              <th className="py-2 px-4 text-white">Target</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Delivery guarantee</td>
              <td className="py-2 px-4">At-least-once (with publisher confirms + consumer acks)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Ordering</td>
              <td className="py-2 px-4">FIFO within a single queue (not across queues)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Throughput</td>
              <td className="py-2 px-4">20-50K messages/sec per queue, higher with multiple queues</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Latency</td>
              <td className="py-2 px-4">Sub-millisecond for in-memory messages, 1-5ms for persistent</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Durability</td>
              <td className="py-2 px-4">Persistent messages survive broker restart (written to disk)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Availability</td>
              <td className="py-2 px-4">99.99% with mirrored/quorum queues across cluster nodes</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Back-of-Envelope Calculations                         */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">4. Back-of-Envelope Calculations</h2>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-3 font-mono text-sm text-gray-300">
        <p className="text-white font-bold font-sans">Throughput:</p>
        <p>50K messages/sec x 1KB avg message = <span className="text-green-400">50 MB/s</span> ingress</p>
        <p>With 3 consumers per queue: <span className="text-green-400">150 MB/s</span> egress</p>
        <p>Total network: <span className="text-yellow-400">~200 MB/s (1.6 Gbps)</span></p>

        <p className="text-white font-bold font-sans pt-2">Storage (persistent messages):</p>
        <p>50K msg/sec x 1KB x 86400 sec/day = <span className="text-green-400">~4.3 TB/day</span> if nothing consumed</p>
        <p>In practice, messages consumed quickly. Queue depth target: &lt;100K messages</p>
        <p>100K messages x 1KB = <span className="text-green-400">100 MB</span> typical queue depth</p>

        <p className="text-white font-bold font-sans pt-2">Memory:</p>
        <p>Each message in queue: ~1KB body + ~200B metadata = ~1.2KB</p>
        <p>100K queued messages = <span className="text-green-400">~120 MB RAM</span></p>
        <p>Erlang VM overhead per connection: ~100KB</p>
        <p>10K connections: <span className="text-green-400">~1 GB</span> connection overhead</p>

        <p className="text-white font-bold font-sans pt-2">Cluster sizing:</p>
        <p>3-node cluster: <span className="text-green-400">~150K msg/sec</span> aggregate throughput</p>
        <p>Each node: 16 cores, 64GB RAM, NVMe SSD for persistence</p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- API Design                                            */
/* ================================================================== */

function APIDesignSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. API Design (AMQP 0-9-1)</h2>
      <p className="text-gray-300 leading-relaxed">
        RabbitMQ uses the AMQP protocol. The API is a set of methods on channels within TCP connections.
        Each operation maps to an AMQP method frame.
      </p>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-3">
        <p className="text-white font-bold">// Connection lifecycle</p>
        <p>Connection.Open(host, port, vhost, credentials)</p>
        <p>Channel.Open(channel_id)  <span className="text-gray-500">// multiplexed on one TCP connection</span></p>

        <p className="text-white font-bold pt-2">// Declare topology</p>
        <p>Exchange.Declare(name=&quot;orders&quot;, type=&quot;topic&quot;, durable=true)</p>
        <p>Queue.Declare(name=&quot;order-processing&quot;, durable=true, arguments={'{'}&quot;x-dead-letter-exchange&quot;: &quot;dlx&quot;{'}'})</p>
        <p>Queue.Bind(queue=&quot;order-processing&quot;, exchange=&quot;orders&quot;, routing_key=&quot;order.created.*&quot;)</p>

        <p className="text-white font-bold pt-2">// Publish</p>
        <p>Basic.Publish(</p>
        <p>  exchange=&quot;orders&quot;,</p>
        <p>  routing_key=&quot;order.created.us&quot;,</p>
        <p>  body=&apos;{'{'}&quot;order_id&quot;: 42, &quot;amount&quot;: 99.99{'}'}&apos;,</p>
        <p>  properties={'{'} delivery_mode=2, content_type=&quot;application/json&quot;, priority=5 {'}'}</p>
        <p>)</p>

        <p className="text-white font-bold pt-2">// Consume</p>
        <p>Basic.Consume(queue=&quot;order-processing&quot;, consumer_tag=&quot;worker-1&quot;, no_ack=false)</p>
        <p><span className="text-gray-500">// broker pushes: Basic.Deliver(delivery_tag=1, body=...)</span></p>
        <p>Basic.Ack(delivery_tag=1)        <span className="text-gray-500">// success: remove from queue</span></p>
        <p>Basic.Nack(delivery_tag=1, requeue=false)  <span className="text-gray-500">// failure: send to DLQ</span></p>

        <p className="text-white font-bold pt-2">// Publisher confirms (for reliability)</p>
        <p>Confirm.Select()  <span className="text-gray-500">// enable confirm mode on channel</span></p>
        <p><span className="text-gray-500">// broker sends: Basic.Ack(delivery_tag=N) when persisted</span></p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Data Model                                            */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Data Model</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Entity</th>
              <th className="py-2 px-4 text-white">Key Fields</th>
              <th className="py-2 px-4 text-white">Storage</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-blue-400">Exchange</td>
              <td className="py-2 px-4">name, type (direct/fanout/topic/headers), durable, auto-delete</td>
              <td className="py-2 px-4">Mnesia (Erlang distributed DB)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-green-400">Queue</td>
              <td className="py-2 px-4">name, durable, exclusive, auto-delete, arguments (DLX, TTL, max-length)</td>
              <td className="py-2 px-4">Mnesia + message store on disk</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-yellow-400">Binding</td>
              <td className="py-2 px-4">source exchange, destination queue, routing_key, arguments</td>
              <td className="py-2 px-4">Mnesia</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-purple-400">Message</td>
              <td className="py-2 px-4">body, properties (content-type, delivery-mode, priority, expiration, headers)</td>
              <td className="py-2 px-4">RAM + disk (if persistent)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium text-red-400">Delivery</td>
              <td className="py-2 px-4">delivery_tag, consumer_tag, redelivered flag, exchange, routing_key</td>
              <td className="py-2 px-4">In-memory per channel</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Key insight:</strong> The exchange-binding-queue model is
          the heart of AMQP. Producers never send directly to queues. They send to exchanges, which
          route based on bindings. This indirection is what enables flexible routing without coupling
          producers to consumers.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- High-Level Architecture (p5)                          */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('RabbitMQ Message Flow: Producer → Exchange → Queue → Consumer', w / 2, 10)

      const prodX = w * 0.08
      const exchX = w * 0.32
      const queueX = w * 0.62
      const consX = w * 0.9

      // Producers
      const prodColors: [number, number, number] = [100, 180, 255]
      for (let i = 0; i < 3; i++) {
        const py = 80 + i * 70
        drawBox(p, prodX, py, 90, 30, [20, 40, 70], prodColors, `Producer ${i + 1}`, 9)
      }

      // Exchange (diamond shape)
      const exchY = 150
      const exchSize = 50
      p.fill(50, 35, 20)
      p.stroke(255, 180, 80)
      p.strokeWeight(2)
      p.beginShape()
      p.vertex(exchX, exchY - exchSize / 2)
      p.vertex(exchX + exchSize / 2, exchY)
      p.vertex(exchX, exchY + exchSize / 2)
      p.vertex(exchX - exchSize / 2, exchY)
      p.endShape(p.CLOSE)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Exchange', exchX, exchY - 5)
      p.textSize(7)
      p.fill(200)
      p.text('(routing)', exchX, exchY + 8)

      // Bindings label
      p.fill(255, 180, 80, 150)
      p.textSize(7)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('bindings', (exchX + queueX) / 2, 70)

      // Queues
      const queueColors: [number, number, number][] = [
        [80, 200, 120],
        [200, 120, 255],
        [255, 120, 80],
      ]
      const queueLabels = ['orders-us', 'orders-eu', 'notifications']
      for (let i = 0; i < 3; i++) {
        const qy = 80 + i * 70
        const msgCount = Math.floor(3 + Math.sin(t * 2 + i) * 3 + 3)
        drawQueue(p, queueX, qy, 120, 30, queueLabels[i], msgCount, queueColors[i])
      }

      // Consumers
      const consColors: [number, number, number] = [255, 200, 80]
      for (let i = 0; i < 3; i++) {
        const cy = 80 + i * 70
        drawBox(p, consX, cy, 80, 30, [50, 40, 20], consColors, `Consumer ${i + 1}`, 9)
      }

      // Producer to exchange arrows + dots
      for (let i = 0; i < 3; i++) {
        const py = 80 + i * 70
        drawArrow(p, prodX + 50, py, exchX - exchSize / 2 - 5, exchY, [100, 180, 255, 120])
        const prog = ((t * 0.7 + i * 0.33) % 1)
        drawMovingDot(p, prodX + 50, py, exchX - exchSize / 2, exchY, prog, [100, 200, 255], 6)
      }

      // Exchange to queue arrows + dots
      for (let i = 0; i < 3; i++) {
        const qy = 80 + i * 70
        drawArrow(p, exchX + exchSize / 2 + 5, exchY, queueX - 65, qy, [255, 180, 80, 120])
        const prog = ((t * 0.6 + i * 0.25) % 1)
        drawMovingDot(p, exchX + exchSize / 2, exchY, queueX - 60, qy, prog, [255, 200, 80], 5)
      }

      // Queue to consumer arrows + dots
      for (let i = 0; i < 3; i++) {
        const qy = 80 + i * 70
        drawArrow(p, queueX + 65, qy, consX - 45, qy, [queueColors[i][0], queueColors[i][1], queueColors[i][2], 120])
        const prog = ((t * 0.5 + i * 0.3) % 1)
        drawMovingDot(p, queueX + 65, qy, consX - 40, qy, prog, queueColors[i], 5)
      }

      // Persistence layer at bottom
      const diskY = 330
      drawBox(p, queueX, diskY, 180, 30, [30, 30, 50], [120, 120, 200], 'Message Store (Disk)', 9)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      drawArrow(p, queueX, 230, queueX, diskY - 18, [120, 120, 200, 140])
      ctx.setLineDash([])
      p.fill(120)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('persistent messages written to disk', queueX, diskY + 20)

      // Ack flow label
      p.fill(80, 200, 120, 150)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('consumer acks flow back', (queueX + consX) / 2, 250)

      // Labels
      p.fill(100)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('AMQP connection (TCP + channels)', w / 2, 370)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        The message flow in RabbitMQ follows the AMQP model:
        producers publish to <strong className="text-white">exchanges</strong>, exchanges route messages
        through <strong className="text-white">bindings</strong> to <strong className="text-white">queues</strong>,
        and the broker pushes messages from queues to <strong className="text-white">consumers</strong>.
        Producers never talk to queues directly.
      </p>
      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8a -- Deep Dive: Exchange Types                            */
/* ================================================================== */

function ExchangeTypesSection() {
  const [exchangeType, setExchangeType] = useState<'direct' | 'fanout' | 'topic'>('direct')
  const typeRef = useRef(exchangeType)
  typeRef.current = exchangeType

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 340)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      p.background(15, 15, 25)
      const et = typeRef.current

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)

      const exchX = w * 0.3
      const exchY = 100
      const qStartX = w * 0.6
      const queueNames = ['queue-A', 'queue-B', 'queue-C']

      // Exchange
      const exchSize = 45
      p.fill(50, 35, 20)
      p.stroke(255, 180, 80)
      p.strokeWeight(2)
      p.beginShape()
      p.vertex(exchX, exchY - exchSize / 2)
      p.vertex(exchX + exchSize / 2, exchY)
      p.vertex(exchX, exchY + exchSize / 2)
      p.vertex(exchX - exchSize / 2, exchY)
      p.endShape(p.CLOSE)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(et, exchX, exchY)

      // Producer
      const prodX = w * 0.08
      drawBox(p, prodX, exchY, 80, 30, [20, 40, 70], [100, 180, 255], 'Producer', 9)

      // Message info
      p.fill(200)
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('routing_key = "order.us"', prodX - 30, exchY + 30)

      drawArrow(p, prodX + 45, exchY, exchX - exchSize / 2 - 5, exchY, [100, 180, 255, 160])
      const prodProg = (t * 0.6) % 1
      drawMovingDot(p, prodX + 45, exchY, exchX - exchSize / 2, exchY, prodProg, [100, 200, 255], 6)

      // Queues
      const qColors: [number, number, number][] = [
        [80, 200, 120],
        [200, 120, 255],
        [255, 120, 80],
      ]
      const qBindings = ['order.us', 'order.eu', 'order.*']

      for (let i = 0; i < 3; i++) {
        const qy = 60 + i * 70
        drawQueue(p, qStartX + 60, qy, 100, 28, queueNames[i], 4, qColors[i])

        // Binding key label
        p.fill(180)
        p.textSize(7)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`bind: "${qBindings[i]}"`, qStartX - 5, qy)
      }

      // Routing logic per exchange type
      if (et === 'direct') {
        p.text('Direct: exact routing key match', w / 2, 10)
        // Only queue-A matches "order.us"
        const qy = 60
        drawArrow(p, exchX + exchSize / 2 + 5, exchY, qStartX + 5, qy, [80, 200, 120, 200])
        const prog = (t * 0.5) % 1
        drawMovingDot(p, exchX + exchSize / 2, exchY, qStartX + 10, qy, prog, [80, 255, 120], 7)

        // X marks on non-matching
        for (let i = 1; i < 3; i++) {
          const qy2 = 60 + i * 70
          p.stroke(255, 60, 60, 100)
          p.strokeWeight(1)
          const mx = (exchX + exchSize / 2 + qStartX) / 2
          const my = (exchY + qy2) / 2
          p.line(mx - 6, my - 6, mx + 6, my + 6)
          p.line(mx + 6, my - 6, mx - 6, my + 6)
        }

        // Explanation
        p.fill(180)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('"order.us" matches only queue-A binding "order.us"', w / 2, 270)

      } else if (et === 'fanout') {
        p.text('Fanout: broadcast to ALL bound queues', w / 2, 10)
        // All queues receive
        for (let i = 0; i < 3; i++) {
          const qy = 60 + i * 70
          drawArrow(p, exchX + exchSize / 2 + 5, exchY, qStartX + 5, qy, [qColors[i][0], qColors[i][1], qColors[i][2], 180])
          const prog = ((t * 0.5 + i * 0.15) % 1)
          drawMovingDot(p, exchX + exchSize / 2, exchY, qStartX + 10, qy, prog, qColors[i], 7)
        }
        p.fill(180)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Routing key ignored. Message delivered to ALL bound queues.', w / 2, 270)

      } else {
        p.text('Topic: wildcard pattern matching', w / 2, 10)
        // queue-A (order.us exact) and queue-C (order.* wildcard) match
        const matchIdx = [0, 2]
        for (const i of matchIdx) {
          const qy = 60 + i * 70
          drawArrow(p, exchX + exchSize / 2 + 5, exchY, qStartX + 5, qy, [qColors[i][0], qColors[i][1], qColors[i][2], 180])
          const prog = ((t * 0.5 + i * 0.2) % 1)
          drawMovingDot(p, exchX + exchSize / 2, exchY, qStartX + 10, qy, prog, qColors[i], 7)
        }
        // X on queue-B
        const qy2 = 60 + 1 * 70
        p.stroke(255, 60, 60, 100)
        p.strokeWeight(1)
        const mx = (exchX + exchSize / 2 + qStartX) / 2
        const my = (exchY + qy2) / 2
        p.line(mx - 6, my - 6, mx + 6, my + 6)
        p.line(mx + 6, my - 6, mx - 6, my + 6)

        p.fill(180)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('"order.us" matches "order.us" (exact) and "order.*" (wildcard)', w / 2, 270)
        p.text('* matches one word, # matches zero or more words', w / 2, 284)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Exchange Types</h2>
      <p className="text-gray-300 leading-relaxed">
        The exchange type determines how messages are routed to queues. Toggle between types to see
        how the same message with routing key &quot;order.us&quot; is handled differently.
      </p>
      <div className="flex gap-2 mb-2">
        {(['direct', 'fanout', 'topic'] as const).map((et) => (
          <button
            key={et}
            onClick={() => setExchangeType(et)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition ${exchangeType === et ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {et}
          </button>
        ))}
      </div>
      <P5Sketch sketch={sketch} height={340} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8b -- Deep Dive: Acknowledgment & Reliability              */
/* ================================================================== */

function AcknowledgmentSection() {
  const [scenario, setScenario] = useState<'happy' | 'crash' | 'nack'>('happy')
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 320)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const sc = scenarioRef.current

      // Timeline
      const margin = 50
      const lineLen = w - 2 * margin

      // Actors
      const prodX = margin + lineLen * 0.05
      const brokerX = margin + lineLen * 0.4
      const consX = margin + lineLen * 0.75
      const dlqX = margin + lineLen * 0.95

      // Actor labels
      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(10)
      p.text('Producer', prodX, 15)
      p.text('Broker', brokerX, 15)
      p.text('Consumer', consX, 15)
      if (sc === 'nack') {
        p.text('DLQ', dlqX, 15)
      }

      // Vertical lifelines
      p.stroke(60)
      p.strokeWeight(1)
      p.line(prodX, 35, prodX, 300)
      p.line(brokerX, 35, brokerX, 300)
      p.line(consX, 35, consX, 300)
      if (sc === 'nack') {
        p.line(dlqX, 35, dlqX, 300)
      }

      const steps: { y: number; from: number; to: number; label: string; color: [number, number, number, number] }[] = []

      if (sc === 'happy') {
        steps.push(
          { y: 80, from: prodX, to: brokerX, label: '1. publish(msg)', color: [100, 180, 255, 255] },
          { y: 110, from: brokerX, to: brokerX, label: '2. persist to disk', color: [255, 200, 80, 255] },
          { y: 140, from: brokerX, to: prodX, label: '3. publisher confirm', color: [80, 200, 120, 255] },
          { y: 180, from: brokerX, to: consX, label: '4. deliver(msg)', color: [255, 180, 80, 255] },
          { y: 220, from: consX, to: consX, label: '5. process msg', color: [200, 200, 200, 255] },
          { y: 260, from: consX, to: brokerX, label: '6. ack(delivery_tag)', color: [80, 200, 120, 255] },
          { y: 280, from: brokerX, to: brokerX, label: '7. remove from queue', color: [255, 100, 100, 255] },
        )
      } else if (sc === 'crash') {
        steps.push(
          { y: 80, from: prodX, to: brokerX, label: '1. publish(msg)', color: [100, 180, 255, 255] },
          { y: 110, from: brokerX, to: consX, label: '2. deliver(msg)', color: [255, 180, 80, 255] },
          { y: 150, from: consX, to: consX, label: '3. consumer CRASHES', color: [255, 60, 60, 255] },
          { y: 190, from: brokerX, to: brokerX, label: '4. no ack received (timeout)', color: [255, 200, 80, 255] },
          { y: 220, from: brokerX, to: consX, label: '5. redeliver(msg, redelivered=true)', color: [255, 180, 80, 255] },
          { y: 260, from: consX, to: brokerX, label: '6. ack (success this time)', color: [80, 200, 120, 255] },
        )
      } else {
        steps.push(
          { y: 80, from: prodX, to: brokerX, label: '1. publish(msg)', color: [100, 180, 255, 255] },
          { y: 110, from: brokerX, to: consX, label: '2. deliver(msg)', color: [255, 180, 80, 255] },
          { y: 150, from: consX, to: consX, label: '3. processing fails', color: [255, 60, 60, 255] },
          { y: 185, from: consX, to: brokerX, label: '4. nack(requeue=false)', color: [255, 100, 80, 255] },
          { y: 220, from: brokerX, to: dlqX, label: '5. route to DLQ', color: [200, 120, 255, 255] },
          { y: 260, from: dlqX, to: dlqX, label: '6. inspect & fix later', color: [200, 200, 200, 255] },
        )
      }

      const visibleSteps = Math.min(steps.length, Math.floor(t * 1.5) + 1)
      for (let i = 0; i < visibleSteps; i++) {
        const step = steps[i]
        if (step.from === step.to) {
          // Self-action
          p.fill(step.color[0], step.color[1], step.color[2])
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(step.label, step.from + 10, step.y)
          // Dot
          p.ellipse(step.from, step.y, 6, 6)
        } else {
          drawArrow(p, step.from, step.y, step.to, step.y, step.color, 1.5)
          p.fill(step.color[0], step.color[1], step.color[2])
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(step.label, (step.from + step.to) / 2, step.y - 4)
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Acknowledgment and Reliability</h2>
      <p className="text-gray-300 leading-relaxed">
        RabbitMQ achieves at-least-once delivery through a two-sided acknowledgment protocol:
        <strong className="text-white"> publisher confirms</strong> (broker acks to producer) and
        <strong className="text-white"> consumer acks</strong> (consumer acks to broker). See what
        happens in each scenario:
      </p>
      <div className="flex gap-2 mb-2">
        {([['happy', 'Happy Path'], ['crash', 'Consumer Crash'], ['nack', 'Nack to DLQ']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setScenario(key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${scenario === key ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <P5Sketch sketch={sketch} height={320} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8c -- Deep Dive: Clustering & HA                           */
/* ================================================================== */

function ClusteringSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Quorum Queues: Raft-Based Replication', w / 2, 10)

      // Three nodes
      const nodeW = w * 0.25
      const nodeH = 140
      const nodeY = 100
      const nodes = [
        { x: w * 0.17, label: 'Node 1 (Leader)', isLeader: true, color: [100, 180, 255] as [number, number, number] },
        { x: w * 0.5, label: 'Node 2 (Follower)', isLeader: false, color: [80, 200, 120] as [number, number, number] },
        { x: w * 0.83, label: 'Node 3 (Follower)', isLeader: false, color: [80, 200, 120] as [number, number, number] },
      ]

      for (const node of nodes) {
        const borderAlpha = node.isLeader ? 200 + Math.sin(t * 3) * 55 : 150
        p.fill(20, 25, 35)
        p.stroke(node.color[0], node.color[1], node.color[2], borderAlpha)
        p.strokeWeight(node.isLeader ? 2.5 : 1.5)
        p.rect(node.x - nodeW / 2, nodeY, nodeW, nodeH, 8)

        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.TOP)
        p.textSize(9)
        p.text(node.label, node.x, nodeY + 8)

        // Queue inside node
        const qy = nodeY + 50
        drawQueue(p, node.x, qy, nodeW - 20, 24, 'orders-q', 5, node.color)

        // WAL
        p.fill(50, 40, 30)
        p.stroke(180, 150, 80)
        p.strokeWeight(1)
        p.rect(node.x - nodeW / 2 + 10, nodeY + 90, nodeW - 20, 20, 4)
        p.fill(180, 150, 80)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Raft WAL (disk)', node.x, nodeY + 100)
      }

      // Replication arrows from leader to followers
      for (let i = 1; i < 3; i++) {
        const fromX = nodes[0].x + nodeW / 2
        const toX = nodes[i].x - nodeW / 2
        const arrowY = nodeY + 50
        drawArrow(p, fromX, arrowY, toX, arrowY, [100, 180, 255, 140])
        const prog = ((t * 0.5 + i * 0.3) % 1)
        drawMovingDot(p, fromX, arrowY, toX, arrowY, prog, [100, 200, 255], 6)
      }

      // Write flow
      const writeY = nodeY - 20
      p.fill(255, 200, 80)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('writes go to leader', nodes[0].x, writeY)

      // Commit after majority
      const commitY = nodeY + nodeH + 30
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Message committed after majority (2 of 3) acknowledge write to WAL', w / 2, commitY)

      // Quorum explanation
      const exY = commitY + 25
      p.fill(140)
      p.textSize(8)
      p.text('Quorum = floor(N/2) + 1. For 3 nodes, quorum = 2. Tolerates 1 node failure.', w / 2, exY)
      p.text('For 5 nodes, quorum = 3. Tolerates 2 node failures.', w / 2, exY + 14)

      // vs mirrored queues
      const vsY = exY + 40
      p.fill(255, 130, 80)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Quorum queues (Raft) replace classic mirrored queues (deprecated in 3.13+)', w / 2, vsY)
      p.fill(120)
      p.textSize(8)
      p.text('Quorum queues: stronger guarantees, better performance, simpler failure handling', w / 2, vsY + 16)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Deep Dive: Clustering and High Availability</h2>
      <p className="text-gray-300 leading-relaxed">
        RabbitMQ clustering replicates <strong className="text-white">metadata</strong> (exchanges,
        bindings, users) across all nodes but does <em>not</em> replicate queue contents by default.
        For HA, you need <strong className="text-white">quorum queues</strong> (Raft-based replication)
        which replicate messages across a majority of nodes.
      </p>
      <P5Sketch sketch={sketch} height={360} />
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Key insight:</strong> In a RabbitMQ cluster, queues are
          owned by a specific node. If that node dies, the queue is unavailable unless you use quorum
          queues. This is fundamentally different from Kafka, where partitions are always replicated.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Scaling Strategy                                      */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Scaling Strategy</h2>

      <h3 className="text-lg font-semibold text-blue-400">Vertical Scaling</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li>More RAM: keep more messages in memory before paging to disk</li>
        <li>More CPU cores: Erlang VM schedules across all cores (unlike Redis)</li>
        <li>Faster disks (NVMe): critical for persistent message throughput</li>
      </ul>

      <h3 className="text-lg font-semibold text-green-400 pt-4">Horizontal Scaling</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li><strong className="text-white">Sharded queues:</strong> split one logical queue across multiple nodes using consistent hashing exchange plugin</li>
        <li><strong className="text-white">Federation:</strong> loosely couple brokers across data centers. Each DC has its own broker; messages forwarded on demand. Tolerates WAN latency.</li>
        <li><strong className="text-white">Shovel:</strong> move messages between clusters (one-directional replication)</li>
        <li><strong className="text-white">Multiple queues:</strong> distribute workload by creating many queues and partitioning by routing key</li>
      </ul>

      <h3 className="text-lg font-semibold text-yellow-400 pt-4">Growth Milestones</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Scale</th>
              <th className="py-2 px-4 text-white">Architecture</th>
              <th className="py-2 px-4 text-white">Throughput</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">1x</td>
              <td className="py-2 px-4">3-node cluster with quorum queues</td>
              <td className="py-2 px-4">~50K msg/sec</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">10x</td>
              <td className="py-2 px-4">Sharded queues + more nodes (7-9 nodes)</td>
              <td className="py-2 px-4">~300K msg/sec</td>
            </tr>
            <tr>
              <td className="py-2 px-4">100x</td>
              <td className="py-2 px-4">Federation across DCs + sharding + consumer scaling</td>
              <td className="py-2 px-4">~2M msg/sec (aggregate)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Fault Tolerance                                      */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Broker node crashes</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Classic queues on that node become unavailable until the node recovers. Quorum queues
            continue serving from remaining nodes (as long as quorum is maintained). Durable persistent
            messages survive restart from disk. Transient messages are lost.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Consumer crashes</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Unacknowledged messages are requeued and redelivered to another consumer (or the same
            consumer after restart). The <code className="text-yellow-400">redelivered</code> flag is set to true,
            so consumers can detect redeliveries and handle them idempotently.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Network partition</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            RabbitMQ offers three partition handling modes: <code className="text-yellow-400">ignore</code> (manual
            intervention), <code className="text-yellow-400">pause-minority</code> (minority side stops accepting
            connections), and <code className="text-yellow-400">autoheal</code> (automatically pick a winner and
            restart loser). Quorum queues handle partitions through Raft leader election.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-green-900/50 rounded-lg p-4">
          <h3 className="text-green-400 font-semibold text-sm mb-2">End-to-end reliability checklist</h3>
          <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside ml-2">
            <li>Publisher confirms enabled (broker acks persistence)</li>
            <li>Messages marked persistent (delivery_mode = 2)</li>
            <li>Durable queues (survive broker restart)</li>
            <li>Consumer manual ack (no auto-ack)</li>
            <li>Dead letter exchanges configured for failed messages</li>
            <li>Quorum queues for cross-node replication</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Tradeoffs & Design Choices                           */
/* ================================================================== */

function TradeoffsSection() {
  const tradeoffs = [
    {
      chose: 'Push-based delivery (broker pushes to consumers)',
      over: 'Pull-based delivery (consumers poll the broker)',
      because: 'Push gives lower latency -- messages delivered immediately. But the broker must manage prefetch limits and backpressure. Kafka chose pull, which is simpler at the broker but adds latency.',
      color: 'border-blue-600',
    },
    {
      chose: 'Smart broker, simple consumers',
      over: 'Simple broker, smart consumers (Kafka model)',
      because: 'RabbitMQ tracks delivery state, handles routing, manages acks per message. Consumers are simple. The cost is more broker complexity and state. Kafka pushes complexity to consumers (offset management).',
      color: 'border-green-600',
    },
    {
      chose: 'AMQP protocol with exchanges and bindings',
      over: 'Simple topic-based pub/sub',
      because: 'AMQP gives extraordinary routing flexibility (direct, fanout, topic, headers). The cost is protocol complexity -- AMQP has 60+ methods. But the routing power eliminates the need for consumer-side filtering.',
      color: 'border-yellow-600',
    },
    {
      chose: 'Message deletion after consumption',
      over: 'Log retention (Kafka model)',
      because: 'Deleting consumed messages keeps queue sizes bounded and memory predictable. But you cannot replay old messages. Kafka retains messages for a configured period, enabling consumer replay at the cost of more storage.',
      color: 'border-purple-600',
    },
    {
      chose: 'Erlang/OTP runtime',
      over: 'JVM or native implementation',
      because: 'Erlang offers lightweight processes, fault tolerance via supervision trees, and hot code reloading. The cost is a smaller ecosystem and fewer Erlang developers. But for a message broker, Erlang is arguably the ideal runtime.',
      color: 'border-red-600',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Tradeoffs and Design Choices</h2>
      <div className="space-y-4">
        {tradeoffs.map((t, i) => (
          <div key={i} className={`bg-gray-800/60 border-l-4 ${t.color} rounded-r-lg p-4`}>
            <p className="text-white font-semibold text-sm">
              Chose: <span className="text-green-400">{t.chose}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Over: <span className="text-red-400">{t.over}</span>
            </p>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              {t.because}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">When to choose RabbitMQ over Kafka:</strong> When you need
          complex routing (topic exchanges, headers), per-message acknowledgment, message priority,
          request-reply patterns, or when your throughput needs are moderate (under 100K msg/sec).
          Kafka wins for high-throughput event streaming, log aggregation, and replay.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignRabbitMQ() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Design RabbitMQ</h1>
        <p className="text-lg text-gray-400">
          A system design deep dive into the most popular AMQP message broker. How exchanges,
          bindings, and queues enable flexible routing, and how publisher confirms and consumer
          acks guarantee reliable delivery.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <DataModelSection />
      <ArchitectureSection />
      <ExchangeTypesSection />
      <AcknowledgmentSection />
      <ClusteringSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
    </div>
  )
}
