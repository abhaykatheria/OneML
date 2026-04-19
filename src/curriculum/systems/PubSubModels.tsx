import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/pubsub-models',
  title: 'Pub-Sub Models Deep Dive',
  description:
    'How publish-subscribe works across Redis Pub/Sub, Kafka, RabbitMQ, NATS, and managed services — push vs pull, durable vs ephemeral, and when to use which',
  track: 'systems',
  order: 24,
  tags: [
    'pub-sub',
    'messaging',
    'redis',
    'kafka',
    'rabbitmq',
    'nats',
    'sns',
    'system-design',
  ],
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number]

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: RGB,
  strokeColor: RGB,
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
  weight = 1.5,
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
  color: RGB,
  size = 7,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

function drawLabel(
  p: p5,
  text: string,
  x: number,
  y: number,
  size = 9,
  color: RGB = [180, 180, 180],
  align: 'left' | 'center' | 'right' = 'center',
) {
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  const hAlign = align === 'left' ? p.LEFT : align === 'right' ? p.RIGHT : p.CENTER
  p.textAlign(hAlign, p.CENTER)
  p.textSize(size)
  p.text(text, x, y)
}

/* ================================================================== */
/*  Section 1 -- What is Pub-Sub?                                      */
/* ================================================================== */

function IntroSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. What is Publish-Subscribe?</h2>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Publish-subscribe</strong> is a messaging pattern where
        senders (publishers) do not send messages to specific receivers. Instead, they publish
        messages to a <strong className="text-white">topic</strong> or <strong className="text-white">channel</strong>,
        and any number of subscribers that have expressed interest in that topic receive a copy.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is a pattern of <em>decoupling in three dimensions</em>:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li><strong className="text-white">Space decoupling:</strong> publisher and subscriber don't know each other's identity or location</li>
        <li><strong className="text-white">Time decoupling:</strong> subscribers don't need to be online when the message is published (depending on the model)</li>
        <li><strong className="text-white">Synchronization decoupling:</strong> publishers don't block waiting for subscribers to process</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Every real-world pub-sub system makes different tradeoffs around these dimensions. Redis
        Pub/Sub gives you space and synchronization decoupling but no time decoupling (messages
        to offline subscribers are lost). Kafka gives you all three via durable logs. RabbitMQ
        sits in the middle with durable queues bound to topic exchanges. The rest of this lesson
        is about the shape of those tradeoffs.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Pub-Sub vs Point-to-Point                             */
/* ================================================================== */

function VsQueueSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      // Title
      drawLabel(p, 'Point-to-Point Queue', w * 0.25, 20, 12, [255, 255, 255])
      drawLabel(p, 'Publish-Subscribe', w * 0.75, 20, 12, [255, 255, 255])

      // Divider
      p.stroke(60, 60, 80)
      p.strokeWeight(1)
      p.line(w / 2, 40, w / 2, 420)

      /* ---------- LEFT: Point-to-Point Queue ---------- */
      const leftProd = w * 0.08
      const leftQ = w * 0.25
      const leftCons = w * 0.42

      drawBox(p, leftProd, 150, 70, 28, [20, 40, 70], [100, 180, 255], 'Producer', 9)

      // Queue (row of slots)
      const queueSlots = 6
      const slotW = 16
      const totalW = queueSlots * (slotW + 2)
      const qStartX = leftQ - totalW / 2
      for (let i = 0; i < queueSlots; i++) {
        p.fill(40, 45, 60)
        p.stroke(120, 140, 180)
        p.strokeWeight(1)
        p.rect(qStartX + i * (slotW + 2), 138, slotW, 24, 2)
      }
      drawLabel(p, 'Queue', leftQ, 178, 9, [200, 200, 200])

      // Consumers competing
      for (let i = 0; i < 3; i++) {
        const cy = 90 + i * 60
        drawBox(p, leftCons, cy, 75, 26, [40, 30, 20], [255, 160, 80], `Worker ${i + 1}`, 9)
      }

      // Producer -> Queue moving dots
      const prodProg = (t * 0.7) % 1
      drawArrow(p, leftProd + 35, 150, leftQ - totalW / 2 - 5, 150, [100, 180, 255, 120])
      drawMovingDot(p, leftProd + 35, 150, leftQ - totalW / 2, 150, prodProg, [100, 200, 255])

      // Queue -> ONE consumer (round-robin)
      const activeCons = Math.floor((t * 0.6) % 3)
      for (let i = 0; i < 3; i++) {
        const cy = 90 + i * 60
        const isActive = i === activeCons
        const alpha = isActive ? 200 : 40
        drawArrow(p, leftQ + totalW / 2 + 5, 150, leftCons - 38, cy, [255, 160, 80, alpha])
        if (isActive) {
          const prog = ((t * 0.6) % 1)
          drawMovingDot(p, leftQ + totalW / 2, 150, leftCons - 38, cy, prog, [255, 180, 80])
        }
      }

      drawLabel(p, 'Each message goes to ONE worker', w * 0.25, 260, 10, [255, 160, 80])
      drawLabel(p, 'Workload is split. Work once.', w * 0.25, 278, 9, [180, 180, 180])
      drawLabel(p, '"Competing consumers"', w * 0.25, 296, 9, [140, 140, 140])

      // Use cases
      drawLabel(p, 'Use for:', w * 0.25, 330, 10, [255, 255, 255])
      drawLabel(p, 'background jobs • order processing', w * 0.25, 350, 9, [200, 200, 200])
      drawLabel(p, 'email sending • video transcoding', w * 0.25, 368, 9, [200, 200, 200])
      drawLabel(p, 'any task that must run exactly once', w * 0.25, 386, 9, [200, 200, 200])

      /* ---------- RIGHT: Pub-Sub ---------- */
      const rProd = w * 0.58
      const rTopic = w * 0.72
      const rCons = w * 0.9

      drawBox(p, rProd, 150, 70, 28, [20, 40, 70], [100, 180, 255], 'Publisher', 9)

      // Topic as a cloud/oval
      p.fill(40, 30, 60)
      p.stroke(200, 140, 255)
      p.strokeWeight(1.5)
      p.ellipse(rTopic, 150, 90, 50)
      drawLabel(p, 'Topic', rTopic, 145, 10, [255, 255, 255])
      drawLabel(p, '"orders"', rTopic, 160, 8, [200, 200, 200])

      // Subscribers
      for (let i = 0; i < 3; i++) {
        const cy = 90 + i * 60
        const labels = ['Analytics', 'Notifier', 'Audit Log']
        drawBox(p, rCons, cy, 75, 26, [30, 50, 30], [120, 220, 140], labels[i], 9)
      }

      // Publisher -> Topic
      drawArrow(p, rProd + 35, 150, rTopic - 45, 150, [100, 180, 255, 140])
      const pubProg = (t * 0.7) % 1
      drawMovingDot(p, rProd + 35, 150, rTopic - 45, 150, pubProg, [100, 200, 255])

      // Topic -> ALL subscribers (fan-out)
      for (let i = 0; i < 3; i++) {
        const cy = 90 + i * 60
        drawArrow(p, rTopic + 45, 150, rCons - 38, cy, [120, 220, 140, 180])
        const prog = ((t * 0.6 + i * 0.08) % 1)
        drawMovingDot(p, rTopic + 45, 150, rCons - 38, cy, prog, [120, 220, 140])
      }

      drawLabel(p, 'Each message goes to EVERY subscriber', w * 0.75, 260, 10, [120, 220, 140])
      drawLabel(p, 'Broadcast. Work N times.', w * 0.75, 278, 9, [180, 180, 180])
      drawLabel(p, '"Fan-out"', w * 0.75, 296, 9, [140, 140, 140])

      // Use cases
      drawLabel(p, 'Use for:', w * 0.75, 330, 10, [255, 255, 255])
      drawLabel(p, 'event notifications • cache invalidation', w * 0.75, 350, 9, [200, 200, 200])
      drawLabel(p, 'feed fan-out • real-time dashboards', w * 0.75, 368, 9, [200, 200, 200])
      drawLabel(p, 'anything N independent services need', w * 0.75, 386, 9, [200, 200, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">2. Pub-Sub vs Point-to-Point Queues</h2>
      <p className="text-gray-300 leading-relaxed">
        The single most common confusion in messaging is the difference between a{' '}
        <strong className="text-white">queue</strong> and a <strong className="text-white">topic</strong>.
        Both look like "send a message somewhere else". They behave fundamentally differently under fan-out.
      </p>
      <P5Sketch sketch={sketch} />
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Rule of thumb:</strong> if you want the work done
          once, you want a queue. If you want every interested service to react independently,
          you want pub-sub. Most real systems use both — pub-sub for event distribution, queues
          downstream of each subscriber for reliable work.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Core Dimensions                                       */
/* ================================================================== */

function DimensionsSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Push delivery (broker → subscriber)', w * 0.25, 20, 12, [255, 200, 100])
      drawLabel(p, 'Pull delivery (subscriber → broker)', w * 0.75, 20, 12, [120, 220, 255])

      p.stroke(60, 60, 80)
      p.strokeWeight(1)
      p.line(w / 2, 40, w / 2, 400)

      /* ---------- LEFT: Push ---------- */
      const lBroker = w * 0.15
      const lSubs = w * 0.4

      drawBox(p, lBroker, 200, 80, 34, [50, 35, 20], [255, 180, 80], 'Broker', 10)

      // Broker "pushes" with bursts to each subscriber
      for (let i = 0; i < 3; i++) {
        const sy = 140 + i * 60
        drawBox(p, lSubs, sy, 75, 26, [30, 40, 20], [150, 220, 120], `Sub ${i + 1}`, 9)
        drawArrow(p, lBroker + 40, 200, lSubs - 38, sy, [255, 180, 80, 150])
        const prog = ((t * 0.8 + i * 0.25) % 1)
        drawMovingDot(p, lBroker + 40, 200, lSubs - 38, sy, prog, [255, 200, 100])
      }

      drawLabel(p, 'Broker decides when to deliver', w * 0.25, 310, 10, [255, 200, 100])
      drawLabel(p, '+ Low latency: no polling delay', w * 0.25, 332, 9, [180, 220, 180])
      drawLabel(p, '+ Subscriber code stays simple', w * 0.25, 350, 9, [180, 220, 180])
      drawLabel(p, '− Broker tracks per-sub state', w * 0.25, 368, 9, [220, 180, 180])
      drawLabel(p, '− Slow subs cause backpressure', w * 0.25, 386, 9, [220, 180, 180])

      drawLabel(p, 'RabbitMQ • Redis Pub/Sub • MQTT • SNS', w * 0.25, 105, 9, [150, 150, 200])

      /* ---------- RIGHT: Pull ---------- */
      const rLog = w * 0.72
      const rSubs = w * 0.58

      // Draw the log as stacked segments
      const logSegments = 8
      const segW = 22
      const logStartX = rLog - (logSegments * segW) / 2
      for (let i = 0; i < logSegments; i++) {
        const age = (t * 5 + i) % logSegments
        const brightness = 80 + (age / logSegments) * 150
        p.fill(40, 50, 80)
        p.stroke(brightness, brightness + 20, 255)
        p.strokeWeight(1)
        p.rect(logStartX + i * segW, 150, segW - 2, 100, 2)
        drawLabel(p, `${i}`, logStartX + i * segW + segW / 2 - 1, 200, 8, [140, 160, 220])
      }
      drawLabel(p, 'Append-only log', rLog, 130, 10, [120, 220, 255])
      drawLabel(p, '(offsets →)', rLog, 265, 8, [140, 160, 220])

      // Subscribers with offset arrows pointing INTO the log
      for (let i = 0; i < 3; i++) {
        const sy = 140 + i * 60
        const offset = Math.floor(((t * 0.5 + i * 0.3) % 1) * (logSegments - 1))
        drawBox(p, rSubs, sy, 75, 26, [20, 35, 55], [120, 220, 255], `Sub ${i + 1}`, 9)
        drawLabel(p, `@offset ${offset}`, rSubs, sy + 22, 7, [140, 200, 255])

        // Pointer from sub into log cell
        const targetX = logStartX + offset * segW + segW / 2
        drawArrow(p, rSubs + 38, sy, targetX, 150 + 48, [120, 220, 255, 100])
      }

      drawLabel(p, 'Subscribers fetch at their own pace', w * 0.75, 310, 10, [120, 220, 255])
      drawLabel(p, '+ Broker is stateless/simple', w * 0.75, 332, 9, [180, 220, 180])
      drawLabel(p, '+ Replay from any offset', w * 0.75, 350, 9, [180, 220, 180])
      drawLabel(p, '− Latency: poll interval', w * 0.75, 368, 9, [220, 180, 180])
      drawLabel(p, '− Client tracks its own offset', w * 0.75, 386, 9, [220, 180, 180])

      drawLabel(p, 'Kafka • Pulsar • Kinesis • SQS (long poll)', w * 0.75, 105, 9, [150, 150, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">3. The Three Core Dimensions</h2>
      <p className="text-gray-300 leading-relaxed">
        Pub-sub systems differ on three independent axes. Knowing which axis a given product
        lies on tells you 90% of its operational behavior.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-orange-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Push vs Pull</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Does the broker push messages out as they arrive, or do subscribers poll for them?
            Push minimizes latency; pull decouples consumer speed from producer speed and
            enables replay.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Ephemeral vs Durable</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Does the broker keep messages after delivery? Ephemeral systems (Redis Pub/Sub,
            NATS core) drop messages once delivered. Durable systems (Kafka, Pulsar) retain
            the full log for days or forever.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Topic vs Rich Routing</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Is there one topic per channel, or can the broker route via patterns, headers,
            or attributes? Kafka picks simplicity (topics only); RabbitMQ picks expressiveness
            (four exchange types with wildcards).
          </p>
        </div>
      </div>

      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Redis Pub/Sub                                         */
/* ================================================================== */

function RedisPubSubSection() {
  const [lateSubActive, setLateSubActive] = useState(false)
  const lateRef = useRef(lateSubActive)
  lateRef.current = lateSubActive

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900
    type Msg = { id: number; progress: number; targets: number[] }
    let msgs: Msg[] = []
    let msgId = 0
    let lastEmit = 0

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 1
      p.background(15, 15, 25)

      const pubX = w * 0.08
      const brokerX = w * 0.35
      const subX = w * 0.75

      // Title
      drawLabel(p, 'Redis Pub/Sub: fire-and-forget channel fan-out', w / 2, 20, 12, [255, 120, 120])

      // Publisher
      drawBox(p, pubX, 210, 90, 32, [40, 20, 20], [220, 120, 120], 'PUBLISH', 10)
      drawLabel(p, 'channel: news', pubX, 240, 8, [220, 180, 180])

      // Broker (Redis)
      drawBox(p, brokerX, 210, 110, 50, [60, 30, 30], [255, 120, 120], 'Redis', 12)
      drawLabel(p, 'subscriber list:', brokerX, 235, 8, [220, 180, 180])
      drawLabel(p, 'news → [sub_1, sub_2, sub_3]', brokerX, 250, 7, [200, 160, 160])

      // Subscribers (sub 3 is the "late" one)
      const subYs = [110, 210, 310]
      const subNames = ['Sub 1', 'Sub 2', 'Sub 3 (late joiner)']
      const subActive = [true, true, lateRef.current]

      for (let i = 0; i < 3; i++) {
        const color: RGB = subActive[i] ? [120, 220, 140] : [80, 80, 80]
        const bgColor: RGB = subActive[i] ? [20, 45, 25] : [30, 30, 30]
        drawBox(p, subX, subYs[i], 130, 30, bgColor, color, subNames[i], 9)
        if (!subActive[i]) {
          drawLabel(p, '(disconnected)', subX, subYs[i] + 22, 7, [120, 120, 120])
        }
      }

      // Emit a new message periodically
      if (t - lastEmit > 90) {
        lastEmit = t
        const targets: number[] = []
        for (let i = 0; i < 3; i++) if (subActive[i]) targets.push(i)
        msgs.push({ id: msgId++, progress: 0, targets })
      }

      // Producer -> Redis arrow
      drawArrow(p, pubX + 45, 210, brokerX - 55, 210, [220, 120, 120, 140])

      // Redis -> sub arrows (only to active subs)
      for (let i = 0; i < 3; i++) {
        const alpha = subActive[i] ? 150 : 30
        drawArrow(p, brokerX + 55, 210, subX - 65, subYs[i], [120, 220, 140, alpha])
      }

      // Draw messages in flight
      for (const m of msgs) {
        m.progress += 0.008
        // Phase 1: publisher -> broker (0 to 0.35)
        // Phase 2: broker -> each target sub (0.35 to 1.0)
        if (m.progress < 0.35) {
          const local = m.progress / 0.35
          const x = pubX + 45 + (brokerX - 55 - (pubX + 45)) * local
          p.fill(255, 180, 180)
          p.noStroke()
          p.ellipse(x, 210, 9, 9)
        } else {
          const local = (m.progress - 0.35) / 0.65
          for (const ti of m.targets) {
            const x = brokerX + 55 + (subX - 65 - (brokerX + 55)) * local
            const y = 210 + (subYs[ti] - 210) * local
            p.fill(120, 240, 140)
            p.noStroke()
            p.ellipse(x, y, 9, 9)
          }
        }
      }
      msgs = msgs.filter((m) => m.progress < 1)

      // Explanation text
      const missedCount = Math.floor(t / 90) // approximation
      drawLabel(
        p,
        `If Sub 3 is offline, Redis drops the message. No replay. No storage.`,
        w / 2,
        375,
        10,
        lateRef.current ? [180, 220, 180] : [255, 140, 120],
      )
      drawLabel(
        p,
        lateRef.current
          ? 'Sub 3 is online → receiving new messages from now on (misses earlier ones).'
          : 'Sub 3 is offline → every message published right now is lost to Sub 3 forever.',
        w / 2,
        395,
        9,
        [180, 180, 180],
      )
      // suppress unused warning
      void missedCount
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">4. Model A — Redis Pub/Sub</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis Pub/Sub is the minimalist extreme. It lives entirely in memory with no persistence,
        no acknowledgments, no consumer groups, no offset tracking. When a publisher publishes to
        a channel, Redis walks its in-memory list of subscribers for that channel and pushes the
        bytes down each TCP socket. If the socket is closed — or the subscriber is slow — the
        message is simply dropped.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setLateSubActive((v) => !v)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                lateSubActive
                  ? 'bg-green-700 text-green-100 hover:bg-green-600'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {lateSubActive ? 'Sub 3 is online' : 'Bring Sub 3 online'}
            </button>
            <span className="text-xs text-gray-400">
              Toggle to see fire-and-forget behavior.
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">What it gets right</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li>Sub-millisecond delivery latency</li>
            <li>Trivial to operate — just Redis</li>
            <li>Pattern subscriptions (<code className="text-pink-400">PSUBSCRIBE news.*</code>)</li>
            <li>Zero persistence overhead</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">What it gives up</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li>Zero durability — offline sub = dropped messages</li>
            <li>No acknowledgments, no retries</li>
            <li>No replay, no history</li>
            <li>Slow subscribers: broker buffers until output-buffer-limit, then disconnects</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Use Redis Pub/Sub when:</strong> subscribers are
          always online, missing a message is acceptable, and latency matters more than
          reliability. Classic fits: cache invalidation events, real-time dashboards, chat
          presence ("typing…"), WebSocket fan-out in a single data center. If you need durability,
          reach for Redis Streams (a different Redis primitive) or a real log-based broker.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Kafka (log-based)                                     */
/* ================================================================== */

function KafkaSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 520)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Kafka: the log is the source of truth', w / 2, 20, 13, [100, 220, 255])

      // Producer
      const prodX = w * 0.1
      drawBox(p, prodX, 260, 90, 32, [20, 40, 70], [100, 180, 255], 'Producer', 10)
      drawLabel(p, 'topic: orders', prodX, 288, 8, [180, 200, 255])

      // Topic with 2 partitions, each an append-only log
      const topicX = w * 0.48
      const partW = w * 0.42
      const partStartX = topicX - partW / 2

      // Partition 0
      const p0y = 180
      const p1y = 340
      const partH = 50
      const numCells = 14
      const cellW = partW / numCells

      for (let py = 0; py < 2; py++) {
        const y = py === 0 ? p0y : p1y
        // Frame
        p.stroke(100, 180, 255)
        p.strokeWeight(1.5)
        p.fill(20, 30, 50)
        p.rect(partStartX, y, partW, partH, 4)

        // Cells
        const highWater = Math.min(numCells, Math.floor((t * 2 + py * 3) % numCells) + 1)
        for (let i = 0; i < numCells; i++) {
          const filled = i < highWater
          p.fill(filled ? 40 : 25, filled ? 70 : 40, filled ? 120 : 60)
          p.stroke(100, 180, 255, filled ? 200 : 80)
          p.strokeWeight(1)
          p.rect(partStartX + i * cellW, y, cellW, partH, 2)
          if (filled) {
            p.fill(200, 220, 255)
            p.noStroke()
            p.textSize(8)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${i}`, partStartX + i * cellW + cellW / 2, y + partH / 2)
          }
        }

        drawLabel(p, `Partition ${py}`, partStartX - 50, y + partH / 2, 9, [180, 200, 255], 'right')
        drawLabel(p, '(append →)', partStartX + partW + 45, y + partH / 2, 8, [140, 180, 220])
      }

      // Producer arrows -> partitions
      for (let py = 0; py < 2; py++) {
        const y = py === 0 ? p0y : p1y
        drawArrow(p, prodX + 45, 260, partStartX - 5, y + partH / 2, [100, 180, 255, 130])
      }
      // Flowing dots into partitions
      const prodProg = (t * 0.8) % 1
      for (let py = 0; py < 2; py++) {
        const y = py === 0 ? p0y : p1y
        const phase = py === 0 ? prodProg : (prodProg + 0.5) % 1
        drawMovingDot(p, prodX + 45, 260, partStartX - 5, y + partH / 2, phase, [100, 200, 255])
      }

      // Consumer Group A (Analytics) - reading from offset 3
      // Consumer Group B (Notifier) - reading from offset 7 (further behind / ahead)
      const cgX = w * 0.48
      const cgAY = 90
      const cgBY = 450

      // Draw Consumer Group A
      p.fill(20, 50, 25)
      p.stroke(120, 220, 140)
      p.strokeWeight(1.5)
      p.rect(cgX - 140, cgAY - 22, 280, 44, 6)
      drawLabel(p, 'Consumer Group A: "analytics"', cgX, cgAY - 8, 10, [120, 220, 140])
      drawLabel(p, 'offsets: p0@5  p1@4', cgX, cgAY + 10, 9, [180, 220, 180])

      // Consumer Group B
      p.fill(50, 35, 20)
      p.stroke(255, 180, 80)
      p.strokeWeight(1.5)
      p.rect(cgX - 140, cgBY - 22, 280, 44, 6)
      drawLabel(p, 'Consumer Group B: "email-notifier"', cgX, cgBY - 8, 10, [255, 200, 100])
      drawLabel(p, 'offsets: p0@8  p1@7', cgX, cgBY + 10, 9, [220, 200, 180])

      // Draw offset pointers
      const offsetsA = [5, 4]
      const offsetsB = [8, 7]
      for (let py = 0; py < 2; py++) {
        const y = py === 0 ? p0y : p1y
        // A pointer (from above the partition)
        const ax = partStartX + offsetsA[py] * cellW + cellW / 2
        p.stroke(120, 220, 140)
        p.strokeWeight(2)
        const axStart = py === 0 ? cgAY + 22 : y - 16
        const axEnd = py === 0 ? y - 2 : y - 2
        if (py === 0) {
          p.line(ax, axStart, ax, axEnd)
          p.fill(120, 220, 140)
          p.noStroke()
          p.triangle(ax, y, ax - 5, y - 8, ax + 5, y - 8)
        } else {
          // For p1, draw from bottom
          p.line(ax, y + partH + 2, ax, y + partH + 16)
          p.fill(120, 220, 140)
          p.noStroke()
          p.triangle(ax, y + partH, ax - 5, y + partH + 8, ax + 5, y + partH + 8)
          drawLabel(p, 'A→p1', ax, y + partH + 24, 7, [120, 220, 140])
        }
        if (py === 0) drawLabel(p, 'A→p0', ax, y - 14, 7, [120, 220, 140])

        // B pointer (offset, drawn from opposite side)
        const bx = partStartX + offsetsB[py] * cellW + cellW / 2
        p.stroke(255, 180, 80)
        p.strokeWeight(2)
        if (py === 0) {
          p.line(bx, y + partH + 2, bx, y + partH + 16)
          p.fill(255, 180, 80)
          p.noStroke()
          p.triangle(bx, y + partH, bx - 5, y + partH + 8, bx + 5, y + partH + 8)
          drawLabel(p, 'B→p0', bx, y + partH + 24, 7, [255, 180, 80])
        } else {
          p.line(bx, cgBY - 22, bx, y + partH + 2)
          p.fill(255, 180, 80)
          p.noStroke()
          p.triangle(bx, y + partH, bx - 5, y + partH + 8, bx + 5, y + partH + 8)
          drawLabel(p, 'B→p1', bx, y + partH + 24, 7, [255, 180, 80])
        }
      }

      // Caption
      drawLabel(
        p,
        'Each consumer group tracks its OWN offset per partition. Messages stay for retention window.',
        w / 2,
        500,
        9,
        [200, 200, 200],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. Model B — Kafka (Log-Based)</h2>
      <p className="text-gray-300 leading-relaxed">
        Kafka inverts the classic broker design. Instead of queues that empty as consumers read
        them, Kafka keeps an immutable, append-only <strong className="text-white">log</strong>{' '}
        per topic partition. The log is the source of truth. Consumers do not receive messages
        from Kafka — they <em>fetch</em> them by offset, and Kafka returns bytes.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Partitions</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            A topic is split into N partitions. Each partition is a single ordered log.
            Parallelism is per-partition: more partitions = more consumer parallelism.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Consumer Groups</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Subscribers form groups. Each partition is consumed by exactly one consumer per
            group. Different groups read independently — this is how fan-out + work-sharing
            co-exist in one model.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Retention</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Messages stick around for a time (default 7 days) or size limit. New subscribers
            can replay from offset 0. Reprocessing a bad deploy is "reset offsets to yesterday."
          </p>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans text-sm">Why the log shape matters</p>
        <p>• The broker is stateless w.r.t. consumers — just serves byte ranges by offset.</p>
        <p>• A slow consumer cannot hurt a fast one; they don't share delivery state.</p>
        <p>• Replay is free: rewind the offset, read again.</p>
        <p>• Ordering is trivial <em>within</em> a partition (append order); impossible across partitions.</p>
        <p>• Throughput scales linearly with partition count — 1M+ messages/sec is routine.</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Use Kafka when:</strong> throughput matters
          (&gt;100K msg/sec), messages feed multiple independent pipelines (analytics + audit +
          search index), replay is a requirement, or you need event sourcing / CDC. Avoid it
          when you need per-message delivery semantics (priority, expiration, routing headers)
          — that's what RabbitMQ is for.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- RabbitMQ / AMQP                                       */
/* ================================================================== */

function RabbitMQSection() {
  const [exchangeType, setExchangeType] = useState<'fanout' | 'direct' | 'topic'>('topic')
  const typeRef = useRef(exchangeType)
  typeRef.current = exchangeType

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const et = typeRef.current

      drawLabel(p, `RabbitMQ: exchange (${et}) routes to matching queues`, w / 2, 20, 12, [255, 180, 80])

      // Publisher
      const pubX = w * 0.08
      drawBox(p, pubX, 210, 90, 32, [20, 40, 70], [100, 180, 255], 'Publisher', 10)

      // Message routing key
      const routingKeys: Record<typeof et, string> = {
        fanout: '(ignored)',
        direct: 'orders.us',
        topic: 'orders.us.priority',
      }
      drawLabel(p, `routing_key = "${routingKeys[et]}"`, pubX, 240, 8, [200, 220, 255])

      // Exchange (diamond)
      const exchX = w * 0.32
      const exchY = 210
      const exchSize = 54
      p.fill(50, 35, 20)
      p.stroke(255, 180, 80)
      p.strokeWeight(2)
      p.beginShape()
      p.vertex(exchX, exchY - exchSize / 2)
      p.vertex(exchX + exchSize / 2, exchY)
      p.vertex(exchX, exchY + exchSize / 2)
      p.vertex(exchX - exchSize / 2, exchY)
      p.endShape(p.CLOSE)
      drawLabel(p, 'Exchange', exchX, exchY - 6, 9, [255, 220, 150])
      drawLabel(p, `(${et})`, exchX, exchY + 8, 8, [255, 200, 120])

      // Queues
      const qX = w * 0.6
      const consX = w * 0.85
      const queues = [
        { y: 110, name: 'q.orders-us', bind: et === 'topic' ? 'orders.us.*' : et === 'direct' ? 'orders.us' : 'any', worker: 'US Order Worker', color: [120, 220, 140] as RGB },
        { y: 210, name: 'q.orders-eu', bind: et === 'topic' ? 'orders.eu.*' : et === 'direct' ? 'orders.eu' : 'any', worker: 'EU Order Worker', color: [200, 120, 255] as RGB },
        { y: 310, name: 'q.orders-audit', bind: et === 'topic' ? 'orders.#' : et === 'direct' ? 'orders.us' : 'any', worker: 'Audit Service', color: [255, 140, 180] as RGB },
      ]

      // Publisher -> exchange
      drawArrow(p, pubX + 45, exchY, exchX - exchSize / 2 - 5, exchY, [100, 180, 255, 160])
      const pubProg = (t * 0.8) % 1
      drawMovingDot(p, pubX + 45, exchY, exchX - exchSize / 2, exchY, pubProg, [100, 200, 255])

      // Determine which queues match
      const matches = queues.map((q) => {
        if (et === 'fanout') return true
        if (et === 'direct') return q.bind === 'orders.us'
        // topic: match pattern against "orders.us.priority"
        if (q.bind === 'orders.#') return true
        if (q.bind === 'orders.us.*') return true
        return false
      })

      for (let i = 0; i < queues.length; i++) {
        const q = queues[i]

        // Queue box (tube)
        const qw = 110
        const qh = 28
        p.fill(q.color[0] * 0.15, q.color[1] * 0.15, q.color[2] * 0.15)
        p.stroke(q.color[0], q.color[1], q.color[2])
        p.strokeWeight(1.5)
        p.rect(qX - qw / 2, q.y - qh / 2, qw, qh, 4)

        // Message slots inside queue
        const slotW = 8
        const slotGap = 3
        const startX = qX - qw / 2 + 6
        const msgCount = matches[i] ? Math.floor(3 + Math.sin(t * 2 + i) * 2 + 3) : 0
        for (let j = 0; j < msgCount; j++) {
          p.fill(q.color[0], q.color[1], q.color[2], 200)
          p.noStroke()
          p.rect(startX + j * (slotW + slotGap), q.y - qh / 4, slotW, qh / 2, 2)
        }

        drawLabel(p, q.name, qX, q.y + qh / 2 + 10, 8, q.color)
        drawLabel(p, `bind: "${q.bind}"`, qX, q.y + qh / 2 + 22, 7, [140, 140, 140])

        // Consumer
        drawBox(p, consX, q.y, 95, 26, [30, 30, 50], q.color, q.worker, 8)

        // Exchange -> queue arrow
        const arrowColor: [number, number, number, number] = matches[i]
          ? [255, 180, 80, 180]
          : [80, 80, 80, 60]
        drawArrow(p, exchX + exchSize / 2 + 5, exchY, qX - qw / 2 - 5, q.y, arrowColor)

        if (matches[i]) {
          const prog = ((t * 0.6 + i * 0.2) % 1)
          drawMovingDot(p, exchX + exchSize / 2, exchY, qX - qw / 2, q.y, prog, [255, 200, 100])
        } else {
          // Draw an X over the arrow
          const midX = (exchX + exchSize / 2 + qX - qw / 2 - 5) / 2
          const midY = (exchY + q.y) / 2
          p.stroke(200, 80, 80, 180)
          p.strokeWeight(2)
          p.line(midX - 5, midY - 5, midX + 5, midY + 5)
          p.line(midX - 5, midY + 5, midX + 5, midY - 5)
        }

        // Queue -> consumer arrow
        drawArrow(p, qX + qw / 2 + 5, q.y, consX - 50, q.y, [q.color[0], q.color[1], q.color[2], 150])
        if (matches[i]) {
          const prog = ((t * 0.5 + i * 0.3) % 1)
          drawMovingDot(p, qX + qw / 2 + 5, q.y, consX - 50, q.y, prog, q.color)
        }
      }

      drawLabel(p, 'Broker pushes messages to consumers. Consumer ACKs remove them from queue.', w / 2, 395, 9, [200, 200, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Model C — RabbitMQ / AMQP (Routed Push)</h2>
      <p className="text-gray-300 leading-relaxed">
        RabbitMQ sits philosophically between Redis and Kafka. Like Redis, the broker actively
        pushes messages and tracks delivery state. Like Kafka, messages can be durable. What
        makes RabbitMQ distinctive is the <strong className="text-white">exchange layer</strong> —
        a routing table that sits in front of queues and can match on exact keys, wildcards, or
        headers.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Exchange type:</span>
            {(['fanout', 'direct', 'topic'] as const).map((et) => (
              <button
                key={et}
                onClick={() => setExchangeType(et)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  exchangeType === et
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {et}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">The exchange-queue-binding model</p>
          <p className="text-gray-300 text-xs leading-relaxed mb-2">
            Producers never send to queues. They publish to exchanges with a routing key. An
            exchange's <em>bindings</em> declare which queues get which messages.
          </p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><code className="text-orange-400">fanout</code>: broadcast to every bound queue</li>
            <li><code className="text-orange-400">direct</code>: exact routing-key match</li>
            <li><code className="text-orange-400">topic</code>: wildcard pattern (<code>orders.#</code>)</li>
            <li><code className="text-orange-400">headers</code>: match on message header attributes</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">What RabbitMQ gives you</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li>Per-message acknowledgment + redelivery</li>
            <li>Dead-letter queues for poison messages</li>
            <li>Priority queues (0–255)</li>
            <li>Per-message TTL</li>
            <li>Request-reply pattern (temporary reply queues)</li>
            <li>Flexible routing without changing publisher code</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Mental model:</strong> Kafka is a database for
          events; RabbitMQ is a smart mail-sorting room. Kafka retains and lets you re-read.
          RabbitMQ routes and forgets. Use RabbitMQ when routing logic is rich, per-message
          semantics matter, and throughput is under 100K msg/sec per queue.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- NATS, MQTT, Pulsar, Redis Streams                     */
/* ================================================================== */

function OtherBrokersSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. The Rest of the Landscape</h2>
      <p className="text-gray-300 leading-relaxed">
        A handful of other pub-sub systems are worth knowing because they occupy niches the big
        three don't fill well.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-teal-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">NATS &amp; NATS JetStream</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Ultralight, Go-based, designed for service-to-service communication. Core NATS is
            fire-and-forget like Redis Pub/Sub but with wildcard subjects (<code className="text-teal-300">orders.us.*</code>) and microsecond latency.
            <strong className="text-white"> JetStream</strong> adds a durable log layer on top — effectively NATS plus Kafka-like retention, but single-binary simple. A good fit for edge deployments and multi-cloud meshes.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-cyan-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">MQTT</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The IoT pub-sub protocol. Tiny wire format (2-byte fixed header), built for flaky
            radios, battery-powered sensors, and satellite links. Hierarchical topics
            (<code className="text-cyan-300">home/livingroom/temperature</code>), three QoS levels (at-most-once, at-least-once, exactly-once),
            and <em>retained messages</em> — the broker keeps the latest message per topic so new subscribers
            get current state immediately. Brokers: Mosquitto, HiveMQ, EMQX.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-indigo-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Apache Pulsar</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Kafka's main competitor in the durable-log space. Two-tier architecture: brokers are
            stateless, storage is <strong className="text-white">BookKeeper</strong> (replicated
            log service). You can scale storage and compute independently — something Kafka has
            only recently caught up to with KRaft + tiered storage. Also supports four
            subscription modes (exclusive, shared, failover, key_shared) so you can do
            Kafka-style or RabbitMQ-style fan-out from the same cluster.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-rose-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Redis Streams</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The durable-log answer inside Redis — not the same thing as Redis Pub/Sub. Streams
            use the <code className="text-rose-300">XADD</code> / <code className="text-rose-300">XREAD</code> family, keep messages until trimmed, and support consumer groups
            via <code className="text-rose-300">XREADGROUP</code>. Think "Kafka-in-a-Redis" for low-throughput use cases where you already run Redis and don't want to stand up a Kafka cluster.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Managed Pub-Sub (SNS + SQS, Google Pub/Sub)           */
/* ================================================================== */

function ManagedSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'SNS → SQS fan-out: topic broadcasts, each queue buffers for one subscriber', w / 2, 22, 11, [255, 200, 120])

      // Publisher
      const pubX = w * 0.08
      drawBox(p, pubX, 220, 90, 32, [20, 40, 70], [100, 180, 255], 'Service A', 10)
      drawLabel(p, '(publisher)', pubX, 250, 8, [180, 200, 255])

      // SNS topic
      const snsX = w * 0.3
      p.fill(50, 40, 15)
      p.stroke(255, 200, 120)
      p.strokeWeight(2)
      p.ellipse(snsX, 220, 110, 60)
      drawLabel(p, 'SNS topic', snsX, 213, 10, [255, 220, 150])
      drawLabel(p, 'order-events', snsX, 228, 8, [255, 200, 120])

      // 3 SQS queues (one per subscriber)
      const sqsX = w * 0.58
      const consX = w * 0.88
      const subs = [
        { y: 120, name: 'sqs-analytics', worker: 'Analytics', color: [120, 220, 140] as RGB },
        { y: 220, name: 'sqs-email', worker: 'Email Svc', color: [200, 120, 255] as RGB },
        { y: 320, name: 'sqs-warehouse', worker: 'Data Lake', color: [255, 140, 180] as RGB },
      ]

      // Producer -> SNS
      drawArrow(p, pubX + 45, 220, snsX - 55, 220, [100, 180, 255, 160])
      const pubProg = (t * 0.7) % 1
      drawMovingDot(p, pubX + 45, 220, snsX - 55, 220, pubProg, [100, 200, 255])

      for (let i = 0; i < subs.length; i++) {
        const s = subs[i]
        // SNS -> SQS
        drawArrow(p, snsX + 55, 220, sqsX - 55, s.y, [255, 200, 120, 160])
        const prog = ((t * 0.6 + i * 0.12) % 1)
        drawMovingDot(p, snsX + 55, 220, sqsX - 55, s.y, prog, [255, 220, 140])

        // SQS queue as a tube
        p.fill(s.color[0] * 0.12, s.color[1] * 0.12, s.color[2] * 0.12)
        p.stroke(s.color[0], s.color[1], s.color[2])
        p.strokeWeight(1.5)
        p.rect(sqsX - 55, s.y - 16, 110, 32, 4)

        const slotW = 8
        const slotGap = 3
        const startX = sqsX - 55 + 6
        const msgCount = Math.floor(3 + Math.sin(t * 1.5 + i) * 2 + 3)
        for (let j = 0; j < msgCount; j++) {
          p.fill(s.color[0], s.color[1], s.color[2], 200)
          p.noStroke()
          p.rect(startX + j * (slotW + slotGap), s.y - 8, slotW, 16, 2)
        }
        drawLabel(p, s.name, sqsX, s.y + 28, 8, s.color)

        // Consumer
        drawBox(p, consX, s.y, 90, 26, [30, 30, 50], s.color, s.worker, 9)
        drawArrow(p, sqsX + 55, s.y, consX - 48, s.y, [s.color[0], s.color[1], s.color[2], 160])
        const cp = ((t * 0.5 + i * 0.3) % 1)
        drawMovingDot(p, sqsX + 55, s.y, consX - 48, s.y, cp, s.color)
      }

      // Explanation
      drawLabel(p, 'Why the fan-out pattern?', w / 2, 385, 10, [255, 255, 255])
      drawLabel(
        p,
        "SNS = broadcast. SQS = durable per-subscriber buffer. Each subscriber reads at its own pace",
        w / 2,
        403,
        9,
        [200, 200, 200],
      )
      drawLabel(
        p,
        'and retries on failure without affecting others. Slow consumers don\'t stall the topic.',
        w / 2,
        420,
        9,
        [200, 200, 200],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Model D — Managed Services (SNS+SQS, Google Pub/Sub)</h2>
      <p className="text-gray-300 leading-relaxed">
        Cloud providers offer a slightly different shape: the <strong className="text-white">fan-out pattern</strong>.
        A single broadcast topic (AWS SNS, GCP Pub/Sub topic) is fronted by per-subscriber queues
        (AWS SQS, Pub/Sub subscriptions). The broker does the fan-out; each queue becomes a
        durable, ack-based buffer for one consumer.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">AWS SNS + SQS</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            SNS is the pub-sub topic; SQS is the queue. To subscribe, you point an SQS queue at
            the SNS topic. SNS delivers a copy of every message to each subscribed queue. Your
            service drains its queue with long-polling and acks on success. Delivery is
            at-least-once. No replay (SQS messages are consumed destructively).
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Google Cloud Pub/Sub</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Collapses the two into one product. One topic, many subscriptions. Each subscription
            is independently durable with configurable retention (7 days default, 31 days max).
            Supports both push (broker → HTTPS endpoint) and pull modes. Can replay within
            retention via <code className="text-pink-400">seek</code>.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why the fan-out pattern is nice:</strong> each
          subscriber has its own durable buffer, so a slow or failing consumer can't slow down
          the topic or other subscribers. You get cross-zone durability for free. The price is
          higher per-message cost and no replay beyond retention.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Delivery Semantics                                    */
/* ================================================================== */

function DeliverySemanticsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Delivery Semantics</h2>
      <p className="text-gray-300 leading-relaxed">
        Every pub-sub system has to answer one deeply uncomfortable question: what happens if the
        network or the subscriber fails between "broker sent the message" and "subscriber
        processed it"? There are only three possible answers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">At-most-once</p>
          <p className="text-gray-400 text-xs mt-1">send and forget</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Broker sends, no ack required. Message may be lost in flight. Never duplicated.
            <br /><br />
            <strong className="text-white">Where:</strong> Redis Pub/Sub, NATS core, UDP-based
            telemetry, MQTT QoS 0.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-yellow-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">At-least-once</p>
          <p className="text-gray-400 text-xs mt-1">retry until acked</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Subscriber must ack. If no ack within a timeout, broker redelivers. Guarantees
            delivery but may duplicate on retry.
            <br /><br />
            <strong className="text-white">Where:</strong> Kafka default, RabbitMQ with acks,
            SQS, MQTT QoS 1. You need idempotent consumers.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Exactly-once</p>
          <p className="text-gray-400 text-xs mt-1">expensive and conditional</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Each message delivered and processed exactly once. Requires transactional commit
            between broker state and consumer state.
            <br /><br />
            <strong className="text-white">Where:</strong> Kafka transactions (producer +
            consumer in same transaction), Pulsar with deduplication, MQTT QoS 2. Works only
            for supported sinks.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The practical truth:</strong> most systems run
          <em> at-least-once</em> and make the consumer idempotent. True exactly-once is only
          possible when the broker and the consumer's state store participate in the same
          transaction (Kafka → Kafka, or Kafka → a connector with dedup). If you're pushing to
          an external REST API or a non-transactional database, you have at-least-once whether
          you like it or not.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Comparison Table                                     */
/* ================================================================== */

function ComparisonSection() {
  const rows = [
    {
      dim: 'Persistence',
      redis: 'None (in-memory fan-out)',
      kafka: 'Durable log, retention-based',
      rabbit: 'Optional (persistent queues)',
      managed: 'Durable (SQS) or retention (Pub/Sub)',
    },
    {
      dim: 'Delivery model',
      redis: 'Push',
      kafka: 'Pull (consumer fetches)',
      rabbit: 'Push',
      managed: 'Pull (default) or push',
    },
    {
      dim: 'Delivery guarantee',
      redis: 'At-most-once',
      kafka: 'At-least-once (exactly-once w/ txns)',
      rabbit: 'At-least-once (with acks)',
      managed: 'At-least-once',
    },
    {
      dim: 'Ordering',
      redis: 'Per-channel (best effort)',
      kafka: 'Per-partition FIFO',
      rabbit: 'Per-queue FIFO',
      managed: 'FIFO variant available (SQS FIFO)',
    },
    {
      dim: 'Replay',
      redis: 'No',
      kafka: 'Yes, from any offset in retention',
      rabbit: 'No (consumed messages gone)',
      managed: 'SQS: no. Pub/Sub: within retention',
    },
    {
      dim: 'Routing',
      redis: 'Channel names + pattern sub',
      kafka: 'Topic only (consumer filters)',
      rabbit: 'Direct/Topic/Fanout/Headers',
      managed: 'Topic + SNS filter policies',
    },
    {
      dim: 'Throughput (single cluster)',
      redis: '100K–1M msg/sec',
      kafka: '1M+ msg/sec, scales w/ partitions',
      rabbit: '20–50K msg/sec per queue',
      managed: 'Effectively unlimited (managed)',
    },
    {
      dim: 'Latency',
      redis: '<1 ms',
      kafka: '2–10 ms typical',
      rabbit: '1–5 ms',
      managed: '10–100 ms (network path)',
    },
    {
      dim: 'Operational cost',
      redis: 'Trivial',
      kafka: 'Complex (ZK/KRaft, tuning)',
      rabbit: 'Moderate (Erlang, clustering)',
      managed: 'Zero ops, higher $/message',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Side-by-Side Comparison</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-3 px-3 text-white font-semibold">Dimension</th>
              <th className="py-3 px-3 text-red-400 font-semibold">Redis Pub/Sub</th>
              <th className="py-3 px-3 text-blue-400 font-semibold">Kafka</th>
              <th className="py-3 px-3 text-orange-400 font-semibold">RabbitMQ</th>
              <th className="py-3 px-3 text-green-400 font-semibold">SNS+SQS / Pub/Sub</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800 align-top">
                <td className="py-2 px-3 font-medium text-white">{r.dim}</td>
                <td className="py-2 px-3">{r.redis}</td>
                <td className="py-2 px-3">{r.kafka}</td>
                <td className="py-2 px-3">{r.rabbit}</td>
                <td className="py-2 px-3">{r.managed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Decision Framework                                   */
/* ================================================================== */

function DecisionSection() {
  const sketch = useCallback((p: p5) => {
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 520)
      p.textFont('monospace')
      p.noLoop()
    }

    p.draw = () => {
      p.background(15, 15, 25)

      drawLabel(p, 'Decision tree: which pub-sub fits your use case?', w / 2, 20, 12, [255, 255, 255])

      const boxW = 220
      const boxH = 42
      const qBox = (x: number, y: number, label: string, color: RGB = [140, 180, 255]) => {
        p.fill(25, 30, 50)
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(1.5)
        p.rect(x - boxW / 2, y - boxH / 2, boxW, boxH, 8)
        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(10)
        p.text(label, x, y)
      }
      const aBox = (x: number, y: number, label: string, color: RGB) => {
        const w2 = 160
        const h2 = 36
        p.fill(color[0] * 0.2, color[1] * 0.2, color[2] * 0.2)
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(2)
        p.rect(x - w2 / 2, y - h2 / 2, w2, h2, 8)
        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(10)
        p.text(label, x, y)
      }
      const edge = (x1: number, y1: number, x2: number, y2: number, label: string) => {
        // Horizontal then vertical routing
        p.stroke(120, 120, 140)
        p.strokeWeight(1.2)
        p.noFill()
        p.line(x1, y1, x1, (y1 + y2) / 2)
        p.line(x1, (y1 + y2) / 2, x2, (y1 + y2) / 2)
        p.line(x2, (y1 + y2) / 2, x2, y2)
        // Arrowhead
        p.fill(120, 120, 140)
        p.noStroke()
        p.triangle(x2, y2, x2 - 4, y2 - 8, x2 + 4, y2 - 8)
        // Edge label
        drawLabel(p, label, (x1 + x2) / 2, (y1 + y2) / 2 - 8, 8, [180, 180, 180])
      }

      // Root
      qBox(w / 2, 60, 'Do subscribers need to replay / catch up?')

      // Left branch: YES (durable log)
      qBox(w * 0.25, 170, 'Throughput > 100K msg/sec?')
      edge(w / 2, 60 + 21, w * 0.25, 170 - 21, 'yes')

      // Right branch: NO (ephemeral OK or ack-based)
      qBox(w * 0.75, 170, 'Need rich routing / per-msg acks?')
      edge(w / 2, 60 + 21, w * 0.75, 170 - 21, 'no')

      // Left-left: YES (high throughput) → Kafka / Pulsar
      aBox(w * 0.12, 280, 'Kafka or Pulsar', [100, 180, 255])
      edge(w * 0.25, 170 + 21, w * 0.12, 280 - 18, 'yes')
      // Left-right: NO → Redis Streams / Google Pub/Sub
      qBox(w * 0.38, 280, 'Managed cloud OK?')
      edge(w * 0.25, 170 + 21, w * 0.38, 280 - 21, 'no')

      aBox(w * 0.3, 380, 'Redis Streams', [220, 120, 140])
      edge(w * 0.38, 280 + 21, w * 0.3, 380 - 18, 'self-host')
      aBox(w * 0.48, 380, 'Google Pub/Sub', [140, 220, 180])
      edge(w * 0.38, 280 + 21, w * 0.48, 380 - 18, 'managed')

      // Right-left: YES (rich routing) → RabbitMQ
      aBox(w * 0.62, 280, 'RabbitMQ', [255, 180, 80])
      edge(w * 0.75, 170 + 21, w * 0.62, 280 - 18, 'yes')

      // Right-right: NO → need persistence?
      qBox(w * 0.88, 280, 'Subs always online?')
      edge(w * 0.75, 170 + 21, w * 0.88, 280 - 21, 'no')

      aBox(w * 0.82, 380, 'Redis Pub/Sub', [220, 120, 120])
      edge(w * 0.88, 280 + 21, w * 0.82, 380 - 18, 'yes')
      aBox(w * 0.95, 380, 'SNS+SQS', [120, 220, 140])
      edge(w * 0.88, 280 + 21, w * 0.95, 380 - 18, 'no')

      // Footer: special-case notes
      p.fill(200, 200, 200)
      p.noStroke()
      p.textAlign(p.LEFT, p.TOP)
      p.textSize(9)
      p.text('Special cases:', 40, 445)
      p.fill(180, 180, 180)
      p.text('• IoT / constrained devices → MQTT', 40, 462)
      p.text('• Microservice mesh / edge → NATS or NATS JetStream', 40, 478)
      p.text('• Already running Redis + modest scale → Redis Streams', 40, 494)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Which One Should You Pick?</h2>
      <p className="text-gray-300 leading-relaxed">
        The honest answer in most production systems is: you use more than one. A common stack
        is Kafka for the durable event backbone, Redis Pub/Sub for real-time UI fan-out, and
        RabbitMQ or SQS for per-service work queues downstream of Kafka consumers. The tree
        below helps you pick the right tool for a specific problem, not the whole stack.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="space-y-3">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Pick Kafka if</p>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            events flow into multiple independent downstream systems (analytics, audit, search
            index, ML features), you need replay, or throughput is genuinely large. The
            operational tax is real — budget for it.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-orange-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Pick RabbitMQ if</p>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            routing is the interesting part: topic wildcards, header-based routing, priorities,
            DLQs, or request-reply. Pick it when throughput is moderate and per-message
            semantics matter more than replay.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Pick Redis Pub/Sub if</p>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            you need the lowest possible latency, subscribers are always online, and a dropped
            message is tolerable. Cache invalidation, presence/typing indicators, real-time UI
            updates, and WebSocket fan-out inside a data center are the classic fits.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Pick SNS+SQS or Google Pub/Sub if</p>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            you're already on the cloud provider, the operational cost of Kafka/RabbitMQ isn't
            worth it, and per-message cost is acceptable. The per-subscriber queue pattern is
            remarkably robust for service decoupling.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">One final rule:</strong> the broker choice is
          rarely what kills a pub-sub system in production. What kills them is non-idempotent
          consumers, missing dead-letter handling, undersized retention, and poor observability
          on consumer lag. Pick the simplest broker that meets your durability and routing
          needs, then spend your time on the consumer side.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function PubSubModels() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Pub-Sub Models Deep Dive</h1>
        <p className="text-lg text-gray-400">
          How publish-subscribe works — from Redis Pub/Sub's fire-and-forget broadcast to
          Kafka's durable log, RabbitMQ's routed push, and cloud fan-out with SNS+SQS.
          The patterns, the tradeoffs, and when to use which.
        </p>
      </header>

      <IntroSection />
      <VsQueueSection />
      <DimensionsSection />
      <RedisPubSubSection />
      <KafkaSection />
      <RabbitMQSection />
      <OtherBrokersSection />
      <ManagedSection />
      <DeliverySemanticsSection />
      <ComparisonSection />
      <DecisionSection />
    </div>
  )
}
