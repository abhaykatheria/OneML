import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/kafka-practice',
  title: 'Kafka in Real-World Systems',
  description:
    'Four production Kafka architectures — real-time betting, social media fan-out, infrastructure monitoring, and webhook delivery — plus operational best practices',
  track: 'systems',
  order: 12,
  tags: [
    'kafka',
    'system-design',
    'betting',
    'social-media',
    'monitoring',
    'webhooks',
    'kafka-connect',
    'schema-registry',
    'operations',
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
  // Handle multiline labels
  const lines = label.split('\n')
  for (let i = 0; i < lines.length; i++) {
    p.text(lines[i], x, y + (i - (lines.length - 1) / 2) * (labelSize + 2))
  }
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
  const headLen = 7
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
  size = 6,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

function drawKafkaTopic(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
) {
  p.fill(50, 40, 20)
  p.stroke(220, 170, 60, 120)
  p.strokeWeight(1.5)
  p.rect(x - w / 2, y - h / 2, w, h, 6)
  p.fill(220, 170, 60)
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(8)
  p.text(label, x, y)
}

/* ================================================================== */
/*  Section 1 — Real-Time Betting Platform                             */
/* ================================================================== */

function BettingPlatformSection() {
  const [showPeak, setShowPeak] = useState(false)
  const peakRef = useRef(showPeak)
  peakRef.current = showPeak

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 500
    let canvasW = 800

    interface BetMsg {
      x: number
      y: number
      targetX: number
      targetY: number
      progress: number
      stage: number // 0=user->kafka, 1=kafka->odds, 2=odds->risk, 3=risk->settle, 4=settle->wallet
      color: [number, number, number]
    }

    const bets: BetMsg[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)
      const peak = peakRef.current

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(
        peak
          ? 'World Cup Final — 2M bets/sec, consumer lag growing'
          : 'Real-Time Betting Platform Architecture',
        canvasW / 2,
        8,
      )

      // Layout — pipeline left to right
      const userX = canvasW * 0.06
      const kafkaX = canvasW * 0.22
      const oddsX = canvasW * 0.40
      const riskX = canvasW * 0.56
      const settleX = canvasW * 0.72
      const walletX = canvasW * 0.88
      const pipeY = 120

      // Users
      for (let i = 0; i < (peak ? 5 : 2); i++) {
        const uy = 60 + i * (peak ? 30 : 50)
        drawBox(p, userX, uy, 55, 22, [40, 30, 50], [180, 100, 220], 'User', 8)
        drawArrow(p, userX + 28, uy, kafkaX - 40, pipeY, [180, 100, 220, 100])
      }

      // Kafka topic
      drawKafkaTopic(p, kafkaX, pipeY, 80, 50, 'topic: "bets"\n(by user_id)')

      // Services
      const services = [
        { x: oddsX, label: 'Odds\nService', color: [80, 160, 255] as [number, number, number] },
        { x: riskX, label: 'Risk\nEngine', color: [200, 100, 100] as [number, number, number] },
        { x: settleX, label: 'Settlement\nService', color: [100, 200, 120] as [number, number, number] },
        { x: walletX, label: 'Wallet\nService', color: [220, 170, 60] as [number, number, number] },
      ]

      for (let i = 0; i < services.length; i++) {
        const s = services[i]
        drawBox(p, s.x, pipeY, 76, 50, [s.color[0] * 0.2, s.color[1] * 0.2, s.color[2] * 0.2], s.color, s.label, 8)

        // Arrows between stages
        if (i < services.length - 1) {
          drawArrow(p, s.x + 38, pipeY, services[i + 1].x - 38, pipeY, [150, 150, 150, 100])
        }
      }

      // Arrow from kafka to odds
      drawArrow(p, kafkaX + 40, pipeY, oddsX - 38, pipeY, [220, 170, 60, 150])

      // Odds compacted topic (side channel)
      const oddsTopicY = pipeY - 80
      drawKafkaTopic(p, oddsX, oddsTopicY, 76, 28, '"odds" (compacted)')
      drawArrow(p, oddsX, oddsTopicY + 14, oddsX, pipeY - 25, [220, 170, 60, 120])

      // DLQ
      const dlqY = pipeY + 80
      drawKafkaTopic(p, riskX, dlqY, 70, 28, '"bets.dlq"')
      drawArrow(p, riskX, pipeY + 25, riskX, dlqY - 14, [200, 80, 80, 120])
      p.fill(200, 80, 80)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('failed bets', riskX, dlqY + 18)

      // Spawn bet messages
      const spawnRate = peak ? 0.15 : 0.04
      if (Math.random() < spawnRate) {
        const color: [number, number, number] = [
          150 + Math.random() * 100,
          80 + Math.random() * 80,
          200 + Math.random() * 55,
        ]
        bets.push({
          x: userX + 28,
          y: 60 + Math.random() * (peak ? 120 : 80),
          targetX: kafkaX - 40,
          targetY: pipeY,
          progress: 0,
          stage: 0,
          color,
        })
      }

      // Animate bets through pipeline
      const stageTargets = [
        { x: kafkaX - 40, y: pipeY },
        { x: oddsX - 38, y: pipeY },
        { x: riskX - 38, y: pipeY },
        { x: settleX - 38, y: pipeY },
        { x: walletX - 38, y: pipeY },
      ]

      for (let i = bets.length - 1; i >= 0; i--) {
        const bet = bets[i]
        bet.progress += peak ? 0.008 : 0.015

        if (bet.progress >= 1) {
          bet.progress = 0
          bet.stage++
          if (bet.stage >= 5) {
            bets.splice(i, 1)
            continue
          }
          const prev = stageTargets[bet.stage - 1]
          const next = stageTargets[bet.stage]
          bet.x = prev.x
          bet.y = prev.y
          bet.targetX = next.x
          bet.targetY = next.y
        }

        drawMovingDot(p, bet.x, bet.y, bet.targetX, bet.targetY, bet.progress, bet.color, 5)
      }

      // Consumer lag indicator during peak
      if (peak) {
        const lagY = 220
        p.fill(255, 80, 80, 150)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Consumer Lag:', 10, lagY)

        const lagWidth = Math.min(60 + Math.sin(t * 0.5) * 30 + t * 2, canvasW * 0.6)
        p.fill(255, 80, 80, 40)
        p.rect(110, lagY - 2, lagWidth, 18, 3)
        p.fill(255, 80, 80)
        p.rect(110, lagY - 2, lagWidth, 18, 3)
        p.fill(255)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${Math.floor(lagWidth * 100)} messages behind`, 115, lagY + 7)
      }

      // Key design decisions
      const decY = peak ? 260 : 220
      p.fill(200)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      const decisions = [
        'Partitioned by user_id -> all bets from one user in order (no double-spend)',
        'Odds topic is compacted -> consumers always get latest odds per match_id',
        'Settlement uses exactly-once (transactional) -> no double payouts',
        'Failed bets -> DLQ for manual review (risk limit exceeded, invalid odds)',
        'Each service is its own consumer group -> independent processing',
      ]
      for (let i = 0; i < decisions.length; i++) {
        p.fill(80, 180, 255)
        p.ellipse(16, decY + i * 16 + 4, 4, 4)
        p.fill(180)
        p.text(decisions[i], 24, decY + i * 16)
      }

      // Scaling note
      if (peak) {
        p.fill(255, 200, 80)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(
          'Auto-scaling: Kafka partitions stay fixed, but consumer instances scale 2x -> 8x during peaks',
          canvasW / 2,
          canvasH - 10,
        )
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        System 1: Real-Time Betting Platform
      </h2>

      <h3 className="text-xl font-semibold text-white">The Challenge</h3>
      <p className="text-gray-300 leading-relaxed">
        A live sports betting platform must handle millions of bets per second during peak events
        (a World Cup final, a Super Bowl). Odds change every few seconds as the match progresses.
        Financial correctness is non-negotiable: a user cannot be charged twice for the same bet,
        a payout cannot be issued twice for the same win, and the system must remain responsive
        even under extreme load.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The naive approach -- a monolithic REST API that synchronously validates odds, checks risk
        limits, settles the bet, and debits the wallet -- falls apart immediately under load. A
        slow risk check blocks the entire pipeline. A database lock on the wallet table creates
        contention. The system becomes a cascading failure waiting to happen.
      </p>

      <h3 className="text-xl font-semibold text-white">Architecture</h3>

      <div className="flex gap-3 mb-2">
        <button
          onClick={() => setShowPeak(false)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            !showPeak
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Normal Load
        </button>
        <button
          onClick={() => setShowPeak(true)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            showPeak
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          World Cup Final (Peak)
        </button>
      </div>

      <P5Sketch sketch={sketch} />

      <h3 className="text-xl font-semibold text-white">Key Design Decisions</h3>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Partition by user_id:</strong> All bets from a single user land
        in the same partition, processed by the same consumer. This gives you per-user ordering: bet
        placement, confirmation, and settlement happen in sequence. Without this, a race condition could
        allow a user to place a bet that exceeds their balance because the debit from their previous bet
        has not been processed yet.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Compacted odds topic:</strong> The "odds" topic uses log compaction.
        Instead of retaining all odds updates, Kafka keeps only the latest value per key (match_id).
        When the Odds Service starts up or resets, it reads the compacted topic to build an in-memory
        snapshot of current odds for every active match. This is essentially a distributed key-value store
        backed by Kafka.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Exactly-once for settlement:</strong> The Settlement Service uses
        Kafka transactions. It reads a bet from the "bets" topic, computes the result, and atomically
        writes the payout event to the "payouts" topic AND commits its consumer offset -- all in one
        transaction. If it crashes midway, the transaction is aborted and the bet is reprocessed.
        No double payouts.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Dead letter queue (DLQ):</strong> If the Risk Engine rejects a bet
        (risk limit exceeded, suspicious pattern), the bet is published to "bets.dlq" for manual review.
        This prevents poison pill messages from blocking the main pipeline.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Social Media Feed & Notifications                      */
/* ================================================================== */

function SocialMediaSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 460
    let canvasW = 800

    interface FanoutMsg {
      fromX: number
      fromY: number
      toX: number
      toY: number
      progress: number
      color: [number, number, number]
    }
    const msgs: FanoutMsg[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Social Media Fan-Out Architecture', canvasW / 2, 8)

      // User posting
      const userX = canvasW * 0.06
      const userY = 140
      drawBox(p, userX, userY, 60, 36, [50, 30, 60], [200, 120, 240], 'User\nPosts', 8)

      // API gateway
      const apiX = canvasW * 0.18
      drawBox(p, apiX, userY, 60, 36, [40, 40, 60], [140, 140, 220], 'API\nGateway', 8)
      drawArrow(p, userX + 30, userY, apiX - 30, userY, [200, 120, 240, 120])

      // Kafka topic
      const kafkaX = canvasW * 0.34
      const kafkaY = userY
      drawKafkaTopic(p, kafkaX, kafkaY, 80, 44, 'topic: "posts"\n(by post_id)')
      drawArrow(p, apiX + 30, userY, kafkaX - 40, kafkaY, [140, 140, 220, 120])

      // Fan-out consumers
      const consumers = [
        { label: 'Feed\nService', y: 60, color: [80, 200, 120] as [number, number, number], desc: 'Build follower timelines' },
        { label: 'Notification\nService', y: 140, color: [80, 160, 255] as [number, number, number], desc: 'Push to mobile' },
        { label: 'Analytics\nService', y: 220, color: [220, 170, 60] as [number, number, number], desc: 'Count impressions' },
        { label: 'Moderation\nService', y: 300, color: [200, 100, 100] as [number, number, number], desc: 'Content scanning' },
      ]

      const consX = canvasW * 0.56

      for (const c of consumers) {
        drawBox(p, consX, c.y, 80, 38, [c.color[0] * 0.2, c.color[1] * 0.2, c.color[2] * 0.2], c.color, c.label, 8)
        drawArrow(p, kafkaX + 40, kafkaY, consX - 40, c.y, [c.color[0], c.color[1], c.color[2], 60])

        p.fill(c.color[0], c.color[1], c.color[2], 150)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(c.desc, consX + 44, c.y)
      }

      // Downstream from feed service -> cache
      const cacheX = canvasW * 0.82
      drawBox(p, cacheX, 60, 70, 30, [30, 50, 40], [80, 200, 120], 'Feed Cache\n(per-user)', 7)
      drawArrow(p, consX + 40, 60, cacheX - 35, 60, [80, 200, 120, 100])

      // Downstream from notification -> mobile
      drawBox(p, cacheX, 140, 70, 30, [30, 40, 60], [80, 160, 255], 'Push\nNotification', 7)
      drawArrow(p, consX + 40, 140, cacheX - 35, 140, [80, 160, 255, 100])

      // Downstream from analytics -> data warehouse
      drawBox(p, cacheX, 220, 70, 30, [50, 40, 20], [220, 170, 60], 'Data\nWarehouse', 7)
      drawArrow(p, consX + 40, 220, cacheX - 35, 220, [220, 170, 60, 100])

      // Moderation slow indicator
      const slowBlink = Math.sin(t * 3) > 0
      if (slowBlink) {
        p.fill(255, 200, 80, 150)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('SLOW (ML model)', consX, 325)
      }

      // Animate messages
      if (Math.random() < 0.05) {
        for (const c of consumers) {
          msgs.push({
            fromX: kafkaX + 40,
            fromY: kafkaY,
            toX: consX - 40,
            toY: c.y,
            progress: 0,
            color: c.color,
          })
        }
      }

      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]
        m.progress += 0.02
        if (m.progress >= 1) {
          msgs.splice(i, 1)
        } else {
          drawMovingDot(p, m.fromX, m.fromY, m.toX, m.toY, m.progress, m.color, 5)
        }
      }

      // Key patterns at bottom
      const patY = 360
      p.fill(200)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      const patterns = [
        'Each consumer is its own group -> ALL get every post independently',
        'Moderation service is slow (ML inference) but does NOT block feed delivery',
        'Feed service writes to per-user cache (materialized view pattern)',
        'Viral post: 1 event consumed by all groups; feed service fans out to millions of follower caches',
        'Backpressure: if notification service is overwhelmed, lag grows but no data lost',
      ]
      for (let i = 0; i < patterns.length; i++) {
        p.fill(220, 170, 60)
        p.ellipse(16, patY + i * 16 + 4, 4, 4)
        p.fill(180)
        p.text(patterns[i], 24, patY + i * 16)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        System 2: Social Media Feed & Notifications
      </h2>

      <h3 className="text-xl font-semibold text-white">The Challenge</h3>
      <p className="text-gray-300 leading-relaxed">
        When a user posts a photo on a social platform, that single action triggers a cascade of
        downstream work: the post must appear in every follower's feed, push notifications must be
        sent to close friends, the analytics system must record the event, and the content moderation
        pipeline must scan for policy violations. Each of these downstream consumers has vastly
        different latency requirements and processing speeds.
      </p>
      <p className="text-gray-300 leading-relaxed">
        A celebrity with 50 million followers posts a photo. The Feed Service must update 50 million
        feed caches. The Notification Service might only send push notifications to users who opted in.
        The Moderation Service runs an ML model that takes 2 seconds per image. If these were all
        synchronous calls, the user would wait minutes for their post to go live. With Kafka, the
        user's request completes in milliseconds -- the API writes one event and is done.
      </p>

      <P5Sketch sketch={sketch} />

      <h3 className="text-xl font-semibold text-white">Handling Viral Posts</h3>
      <p className="text-gray-300 leading-relaxed">
        A viral post creates an asymmetric fan-out: one input event causes millions of downstream writes.
        The Feed Service is the bottleneck here. Two strategies:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Push-on-write (fan-out-on-write):</strong> When a post arrives,
          immediately write it to every follower's feed cache. Pre-computes the feed. Fast reads but slow
          writes for high-follower users. Used by Twitter for most users.
        </li>
        <li>
          <strong className="text-white">Pull-on-read (fan-out-on-read):</strong> When a user opens
          their feed, query the posts from everyone they follow in real-time. Fast writes but slow reads.
          Used for celebrity accounts where fan-out-on-write is too expensive.
        </li>
        <li>
          <strong className="text-white">Hybrid:</strong> Fan-out-on-write for users with fewer than N
          followers; fan-out-on-read for celebrities. This is what most large social platforms do.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Kafka enables this elegantly: the Feed Service consumer group processes posts and decides the
        strategy per post based on the poster's follower count. The decision logic is in the consumer,
        not the producer -- the producer just publishes the event and moves on.
      </p>

      <h3 className="text-xl font-semibold text-white">Backpressure</h3>
      <p className="text-gray-300 leading-relaxed">
        When the Notification Service is overwhelmed (e.g., a breaking news event triggers millions of
        push notifications), its consumer lag grows. Kafka handles this gracefully -- the messages sit
        in the topic, and the service drains them as fast as it can. Other consumer groups (Feed,
        Analytics) are completely unaffected. This is fundamentally different from a push-based system
        like RabbitMQ, where the broker would need to throttle delivery or risk overwhelming the consumer.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Infrastructure Monitoring & Alerting                   */
/* ================================================================== */

function MonitoringSection() {
  const [windowType, setWindowType] = useState<'tumbling' | 'hopping' | 'session'>('tumbling')
  const windowRef = useRef(windowType)
  windowRef.current = windowType

  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 500
    let canvasW = 800

    interface MetricDot {
      x: number
      y: number
      tx: number
      ty: number
      progress: number
      color: [number, number, number]
      serverId: number
    }
    const dots: MetricDot[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Infrastructure Monitoring Pipeline — 10K servers, 10M metrics/sec', canvasW / 2, 8)

      // Servers on the left
      const serverX = canvasW * 0.05
      const serverCount = 6
      for (let i = 0; i < serverCount; i++) {
        const sy = 50 + i * 40
        p.fill(30, 40, 50)
        p.stroke(80, 120, 160, 80)
        p.strokeWeight(1)
        p.rect(serverX - 22, sy - 10, 44, 20, 3)
        p.fill(120, 160, 200)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`srv-${i}`, serverX, sy)
      }
      p.fill(120)
      p.textSize(7)
      p.text('...10K', serverX, 50 + serverCount * 40)

      // Kafka topics
      const kafkaX = canvasW * 0.22
      const kafkaY = 140
      drawKafkaTopic(p, kafkaX, kafkaY, 76, 44, 'topic: "metrics"\n(by server_id)')

      // Arrows from servers to kafka
      for (let i = 0; i < serverCount; i++) {
        const sy = 50 + i * 40
        drawArrow(p, serverX + 22, sy, kafkaX - 38, kafkaY, [80, 120, 160, 40])
      }

      // Stream processor
      const streamX = canvasW * 0.42
      drawBox(p, streamX, kafkaY, 80, 44, [40, 50, 30], [120, 200, 80], 'Kafka\nStreams', 9)
      drawArrow(p, kafkaX + 38, kafkaY, streamX - 40, kafkaY, [220, 170, 60, 120])

      // Output topics
      const alertTopicX = canvasW * 0.60
      const aggTopicX = canvasW * 0.60
      drawKafkaTopic(p, alertTopicX, kafkaY - 45, 76, 28, '"alerts"')
      drawKafkaTopic(p, aggTopicX, kafkaY + 45, 76, 28, '"metrics.agg"')
      drawArrow(p, streamX + 40, kafkaY - 10, alertTopicX - 38, kafkaY - 45, [200, 100, 100, 100])
      drawArrow(p, streamX + 40, kafkaY + 10, aggTopicX - 38, kafkaY + 45, [80, 200, 120, 100])

      // Downstream consumers
      const alertX = canvasW * 0.78
      const dashX = canvasW * 0.78
      const coldX = canvasW * 0.78
      drawBox(p, alertX, kafkaY - 70, 70, 32, [60, 30, 30], [200, 100, 100], 'Alerting\nService', 8)
      drawBox(p, dashX, kafkaY, 70, 32, [30, 50, 50], [80, 200, 200], 'Dashboard\n(WebSocket)', 8)
      drawBox(p, coldX, kafkaY + 70, 70, 32, [40, 40, 50], [140, 140, 200], 'Cold Storage\n(S3/HDFS)', 8)

      drawArrow(p, alertTopicX + 38, kafkaY - 45, alertX - 35, kafkaY - 70, [200, 100, 100, 100])
      drawArrow(p, aggTopicX + 38, kafkaY + 45, dashX - 35, kafkaY, [80, 200, 200, 100])
      drawArrow(p, aggTopicX + 38, kafkaY + 45, coldX - 35, kafkaY + 70, [140, 140, 200, 100])

      // PagerDuty
      const pagerX = canvasW * 0.93
      drawBox(p, pagerX, kafkaY - 70, 50, 24, [60, 20, 20], [255, 80, 80], 'PagerDuty', 7)
      drawArrow(p, alertX + 35, kafkaY - 70, pagerX - 25, kafkaY - 70, [255, 80, 80, 100])

      // Animate metric dots
      if (Math.random() < 0.12) {
        const sid = Math.floor(Math.random() * serverCount)
        dots.push({
          x: serverX + 22,
          y: 50 + sid * 40,
          tx: kafkaX - 38,
          ty: kafkaY,
          progress: 0,
          color: [80 + Math.random() * 60, 120 + Math.random() * 80, 160 + Math.random() * 60],
          serverId: sid,
        })
      }

      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i]
        d.progress += 0.025
        if (d.progress >= 1) {
          dots.splice(i, 1)
        } else {
          drawMovingDot(p, d.x, d.y, d.tx, d.ty, d.progress, d.color, 4)
        }
      }

      // Window types diagram at bottom
      const winY = 300
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Windowed Aggregation', canvasW / 2, winY - 10)

      const wt = windowRef.current
      drawWindowDiagram(p, wt, canvasW, winY + 10, t)
    }

    function drawWindowDiagram(p: p5, type: string, w: number, y: number, t: number) {
      const timelineX = w * 0.1
      const timelineW = w * 0.8
      const timelineY = y + 30

      // Time axis
      p.stroke(80)
      p.strokeWeight(1)
      p.line(timelineX, timelineY, timelineX + timelineW, timelineY)
      p.fill(120)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      for (let i = 0; i <= 10; i++) {
        const x = timelineX + (i / 10) * timelineW
        p.text(`${i}s`, x, timelineY + 4)
        p.stroke(60)
        p.strokeWeight(0.5)
        p.line(x, timelineY - 3, x, timelineY + 3)
        p.noStroke()
      }

      // Events scattered on timeline
      const events = [0.5, 1.2, 1.8, 2.5, 3.1, 4.0, 4.3, 5.5, 6.2, 7.8, 8.1, 8.5, 9.2]
      for (const e of events) {
        const x = timelineX + (e / 10) * timelineW
        p.fill(200, 200, 100)
        p.noStroke()
        p.ellipse(x, timelineY - 10, 5, 5)
      }

      // Windows
      const windowY = timelineY + 25
      p.textAlign(p.LEFT, p.TOP)
      p.fill(200)
      p.textSize(9)

      if (type === 'tumbling') {
        p.text('Tumbling Window (2s): non-overlapping, fixed-size', timelineX, y)
        const windowSize = 2
        for (let i = 0; i < 5; i++) {
          const wx = timelineX + (i * windowSize / 10) * timelineW
          const ww = (windowSize / 10) * timelineW
          const active = Math.floor(((t * 2) % 10) / windowSize) === i
          p.fill(80, 160, 255, active ? 60 : 30)
          p.stroke(80, 160, 255, active ? 200 : 80)
          p.strokeWeight(1)
          p.rect(wx, windowY, ww, 24, 3)
          p.fill(180)
          p.noStroke()
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          const count = events.filter(e => e >= i * windowSize && e < (i + 1) * windowSize).length
          p.text(`count=${count}`, wx + ww / 2, windowY + 12)
        }
      } else if (type === 'hopping') {
        p.text('Hopping Window (size=3s, hop=1s): overlapping windows', timelineX, y)
        const windowSize = 3
        const hop = 1
        for (let i = 0; i < 8; i++) {
          const start = i * hop
          const wx = timelineX + (start / 10) * timelineW
          const ww = (windowSize / 10) * timelineW
          if (wx + ww > timelineX + timelineW + 5) continue
          const row = i % 3
          p.fill(80, 200, 120, 25)
          p.stroke(80, 200, 120, 80)
          p.strokeWeight(1)
          p.rect(wx, windowY + row * 18, ww, 14, 2)
          p.fill(160)
          p.noStroke()
          p.textSize(6)
          p.textAlign(p.CENTER, p.CENTER)
          const count = events.filter(e => e >= start && e < start + windowSize).length
          p.text(`[${start}-${start + windowSize}s] n=${count}`, wx + ww / 2, windowY + row * 18 + 7)
        }
      } else {
        p.text('Session Window (gap=1.5s): groups events with idle gaps', timelineX, y)
        // Find sessions
        const sortedEvents = [...events].sort((a, b) => a - b)
        const sessions: { start: number; end: number; count: number }[] = []
        let sessionStart = sortedEvents[0]
        let sessionEnd = sortedEvents[0]
        let count = 1
        for (let i = 1; i < sortedEvents.length; i++) {
          if (sortedEvents[i] - sessionEnd > 1.5) {
            sessions.push({ start: sessionStart, end: sessionEnd, count })
            sessionStart = sortedEvents[i]
            sessionEnd = sortedEvents[i]
            count = 1
          } else {
            sessionEnd = sortedEvents[i]
            count++
          }
        }
        sessions.push({ start: sessionStart, end: sessionEnd, count })

        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i]
          const wx = timelineX + (s.start / 10) * timelineW - 5
          const ww = ((s.end - s.start) / 10) * timelineW + 10
          p.fill(220, 170, 60, 30)
          p.stroke(220, 170, 60, 120)
          p.strokeWeight(1)
          p.rect(wx, windowY, Math.max(ww, 20), 24, 3)
          p.fill(200)
          p.noStroke()
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`session ${i + 1}: ${s.count} events`, wx + Math.max(ww, 20) / 2, windowY + 12)
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        System 3: Infrastructure Monitoring & Alerting
      </h2>

      <h3 className="text-xl font-semibold text-white">The Challenge</h3>
      <p className="text-gray-300 leading-relaxed">
        Consider a cloud provider running 10,000 servers. Each emits CPU, memory, disk I/O, network,
        and application-level metrics every second. That is 10 million events per second of raw telemetry.
        You need to: build real-time dashboards with sub-second latency, detect anomalies and fire alerts
        within 30 seconds, and store months of historical data cost-effectively for capacity planning.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Directly writing 10M events/sec to a time-series database would melt it. Instead, Kafka acts as
        the ingestion buffer and Kafka Streams performs windowed aggregation before the data hits downstream
        stores.
      </p>

      <P5Sketch sketch={sketch} />

      <h3 className="text-xl font-semibold text-white">Windowed Aggregation</h3>
      <p className="text-gray-300 leading-relaxed">
        Kafka Streams (or Flink, or Spark Structured Streaming) computes rolling aggregates over time
        windows. The three main window types serve different use cases:
      </p>

      <div className="flex gap-3 mb-2">
        {(['tumbling', 'hopping', 'session'] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWindowType(w)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              windowType === w
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {w.charAt(0).toUpperCase() + w.slice(1)} Window
          </button>
        ))}
      </div>

      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Tumbling windows:</strong> Fixed-size, non-overlapping.
          "Average CPU per 1-minute window." Every event belongs to exactly one window. Simple, low
          overhead. Used for periodic aggregation (dashboards that refresh every N seconds).
        </li>
        <li>
          <strong className="text-white">Hopping windows:</strong> Fixed-size, overlapping. "Average CPU
          over the last 5 minutes, computed every 1 minute." An event can belong to multiple windows.
          Gives smoother trends and catches anomalies that straddle window boundaries.
        </li>
        <li>
          <strong className="text-white">Session windows:</strong> Variable-size, defined by an inactivity
          gap. "Group all events for a server until there is a 30-second gap." Used for user session
          analysis or grouping burst activity. No fixed boundaries -- the window closes when the gap
          threshold is exceeded.
        </li>
      </ul>

      <h3 className="text-xl font-semibold text-white">Late-Arriving Data</h3>
      <p className="text-gray-300 leading-relaxed">
        What happens when a metric arrives 10 seconds late due to network delay? The window it belongs
        to may already be "closed" and its aggregate emitted. Stream processors handle this with{' '}
        <strong className="text-white">watermarks</strong> and{' '}
        <strong className="text-white">allowed lateness</strong>. A watermark is the processor's estimate
        of how far along event time has progressed. Events arriving after the watermark plus the allowed
        lateness window are dropped or sent to a side channel. This is a trade-off: longer allowed
        lateness means more accurate results but higher memory usage (keeping windows open longer) and
        higher latency before emitting final results.
      </p>

      <h3 className="text-xl font-semibold text-white">Tiered Storage</h3>
      <p className="text-gray-300 leading-relaxed">
        Kafka's tiered storage (KIP-405, available in Confluent and recent Apache Kafka releases) lets
        you keep recent data on broker SSDs and automatically offload older data to S3 or HDFS. This
        means your "metrics" topic can retain a year of data without requiring terabytes of broker disk.
        Consumers reading recent data get local SSD performance; consumers replaying historical data
        transparently read from object storage. This is a game-changer for cost optimization in
        high-volume metrics pipelines.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Webhook Delivery System                                */
/* ================================================================== */

function WebhookSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const canvasH = 480
    let canvasW = 800

    let spawnTimer = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      spawnTimer += 0.016
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Webhook Delivery System with Retry Topology', canvasW / 2, 8)

      // Layout
      const inboundX = canvasW * 0.06
      const inboundY = 80
      const mainTopicX = canvasW * 0.22
      const workerX = canvasW * 0.40
      const endpointX = canvasW * 0.58

      // Inbound sources
      const sources = ['Stripe', 'PayPal', 'Twilio']
      for (let i = 0; i < sources.length; i++) {
        drawBox(p, inboundX, 50 + i * 40, 55, 26, [40, 40, 60], [140, 140, 220], sources[i], 8)
        drawArrow(p, inboundX + 28, 50 + i * 40, mainTopicX - 38, inboundY, [140, 140, 220, 80])
      }

      // Main topic
      drawKafkaTopic(p, mainTopicX, inboundY, 76, 38, '"webhooks.in"\n(by customer_id)')

      // Delivery workers
      drawBox(p, workerX, inboundY, 80, 38, [40, 50, 30], [120, 200, 80], 'Delivery\nWorker Pool', 8)
      drawArrow(p, mainTopicX + 38, inboundY, workerX - 40, inboundY, [220, 170, 60, 120])

      // Customer endpoint
      drawBox(p, endpointX, inboundY, 76, 38, [50, 30, 50], [180, 100, 220], 'Customer\nEndpoint', 8)
      drawArrow(p, workerX + 40, inboundY, endpointX - 38, inboundY, [120, 200, 80, 120])

      // Success path
      p.fill(100, 255, 150)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('HTTP 200 -> commit offset', endpointX + 42, inboundY - 8)
      p.fill(255, 80, 80)
      p.text('HTTP 5xx / timeout -> retry', endpointX + 42, inboundY + 8)

      // Retry topology
      const retryTopics = [
        { label: '"retry-1"\ndelay: 1s', x: canvasW * 0.30, y: 180, color: [200, 180, 80] as [number, number, number] },
        { label: '"retry-2"\ndelay: 10s', x: canvasW * 0.46, y: 180, color: [200, 150, 60] as [number, number, number] },
        { label: '"retry-3"\ndelay: 60s', x: canvasW * 0.62, y: 180, color: [200, 120, 40] as [number, number, number] },
        { label: '"retry-4"\ndelay: 300s', x: canvasW * 0.78, y: 180, color: [200, 90, 30] as [number, number, number] },
      ]

      for (let i = 0; i < retryTopics.length; i++) {
        const rt = retryTopics[i]
        drawKafkaTopic(p, rt.x, rt.y, 72, 34, rt.label)
        if (i < retryTopics.length - 1) {
          drawArrow(p, rt.x + 36, rt.y, retryTopics[i + 1].x - 36, retryTopics[i + 1].y, [rt.color[0], rt.color[1], rt.color[2], 100])
        }
      }

      // Arrow from worker to retry-1 on failure
      drawArrow(p, workerX, inboundY + 19, retryTopics[0].x, retryTopics[0].y - 17, [255, 180, 80, 100])

      // DLQ
      const dlqX = canvasW * 0.88
      const dlqY = 240
      drawKafkaTopic(p, dlqX, dlqY, 60, 32, '"webhooks\n.dlq"')
      drawArrow(p, retryTopics[3].x + 36, retryTopics[3].y + 10, dlqX - 30, dlqY - 10, [255, 80, 80, 120])

      p.fill(255, 80, 80)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Manual review', dlqX, dlqY + 22)

      // Animate retry flow
      const retryY = 280
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Retry Flow Animation', canvasW / 2, retryY)

      // Animated retry bounce
      const retryBoxes = [
        { label: 'Deliver', x: canvasW * 0.08, color: [120, 200, 80] as [number, number, number] },
        { label: 'FAIL!', x: canvasW * 0.20, color: [255, 80, 80] as [number, number, number] },
        { label: 'Retry-1\n(1s)', x: canvasW * 0.34, color: [200, 180, 80] as [number, number, number] },
        { label: 'FAIL!', x: canvasW * 0.46, color: [255, 80, 80] as [number, number, number] },
        { label: 'Retry-2\n(10s)', x: canvasW * 0.58, color: [200, 150, 60] as [number, number, number] },
        { label: 'FAIL!', x: canvasW * 0.70, color: [255, 80, 80] as [number, number, number] },
        { label: 'Retry-3\n(60s)', x: canvasW * 0.82, color: [200, 120, 40] as [number, number, number] },
        { label: 'OK!', x: canvasW * 0.94, color: [100, 255, 150] as [number, number, number] },
      ]

      const animY = retryY + 40
      for (let i = 0; i < retryBoxes.length; i++) {
        const rb = retryBoxes[i]
        p.fill(rb.color[0] * 0.2, rb.color[1] * 0.2, rb.color[2] * 0.2)
        p.stroke(rb.color[0], rb.color[1], rb.color[2], 100)
        p.strokeWeight(1)
        p.rect(rb.x - 26, animY - 15, 52, 30, 4)
        p.fill(rb.color[0], rb.color[1], rb.color[2])
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        const lines = rb.label.split('\n')
        for (let l = 0; l < lines.length; l++) {
          p.text(lines[l], rb.x, animY + (l - (lines.length - 1) / 2) * 10)
        }
        if (i < retryBoxes.length - 1) {
          drawArrow(p, rb.x + 26, animY, retryBoxes[i + 1].x - 26, animY, [150, 150, 150, 100], 1)
        }
      }

      // Bouncing dot through retry stages
      const totalStages = retryBoxes.length
      const cycleLen = 6.0
      const stage = ((t * 0.6) % cycleLen) / cycleLen * totalStages
      const fromIdx = Math.floor(stage) % totalStages
      const toIdx = Math.min(fromIdx + 1, totalStages - 1)
      const prog = stage - fromIdx
      if (fromIdx < totalStages - 1) {
        drawMovingDot(
          p,
          retryBoxes[fromIdx].x + 26,
          animY,
          retryBoxes[toIdx].x - 26,
          animY,
          prog,
          [255, 255, 100],
          8,
        )
      }

      // Delay labels between retry stages
      const delays = ['', '', '1s wait', '', '10s wait', '', '60s wait', '']
      for (let i = 0; i < delays.length; i++) {
        if (delays[i]) {
          p.fill(255, 200, 80, 150)
          p.noStroke()
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(delays[i], retryBoxes[i].x, animY + 24)
        }
      }

      // Key patterns
      const patY = animY + 50
      p.fill(200)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      const patterns = [
        'Partitioned by customer_id -> all webhooks for one customer in order',
        'Rate limiting: pause partition consumption when customer rate limit hit',
        'Idempotency key: customer deduplicates using webhook_id in header',
        'Observability: track delivery latency SLO (99.9% within 30s)',
        'Exponential backoff: 1s -> 10s -> 60s -> 300s -> DLQ',
      ]
      for (let i = 0; i < patterns.length; i++) {
        p.fill(180, 100, 220)
        p.ellipse(16, patY + i * 16 + 4, 4, 4)
        p.fill(180)
        p.text(patterns[i], 24, patY + i * 16)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        System 4: Webhook Delivery System
      </h2>

      <h3 className="text-xl font-semibold text-white">The Challenge</h3>
      <p className="text-gray-300 leading-relaxed">
        Your platform integrates with payment providers (Stripe, PayPal) that send webhook events
        when transactions complete. You must deliver these events to your customers' endpoints reliably.
        Requirements: guaranteed delivery (no dropped webhooks), per-customer ordering (events for one
        customer arrive in sequence), rate limiting (do not overwhelm a customer's endpoint), and retry
        with exponential backoff for transient failures.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The tricky part is retry logic. A naive "retry in a loop with sleep" blocks the consumer thread
        and prevents it from processing other messages. A dedicated retry topic topology solves this
        elegantly.
      </p>

      <P5Sketch sketch={sketch} />

      <h3 className="text-xl font-semibold text-white">Retry Topology</h3>
      <p className="text-gray-300 leading-relaxed">
        Instead of retrying inline, the delivery worker publishes failed webhooks to a retry topic.
        Each retry topic has a delay: retry-1 has a 1-second delay, retry-2 has 10 seconds, retry-3
        has 60 seconds, retry-4 has 300 seconds. A separate consumer reads each retry topic and
        re-attempts delivery. If all retries are exhausted, the webhook goes to the DLQ.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The delay is implemented using Kafka headers or timestamps: the retry consumer checks the
        timestamp and skips messages whose delay has not elapsed yet (pausing the partition). Alternatively,
        in Kafka Streams, you can use a state store with a punctuator that fires after the delay.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This pattern keeps the main delivery pipeline fast. A customer whose endpoint is down does not
        block delivery to other customers, because their failed webhooks are shunted to the retry
        topics. The main consumer moves on immediately.
      </p>

      <h3 className="text-xl font-semibold text-white">Rate Limiting</h3>
      <p className="text-gray-300 leading-relaxed">
        Customers have different rate limits based on their plan. A small business might accept 10
        webhooks/sec; an enterprise might accept 1000/sec. Since webhooks are partitioned by customer_id,
        each consumer can maintain a per-customer rate limiter in memory. When a customer hits their
        limit, the consumer pauses that partition (using{' '}
        <code className="text-yellow-300 bg-gray-800 px-1 rounded">consumer.pause()</code>) and resumes
        it after the rate window resets. This is fine-grained flow control without affecting other
        customers on different partitions.
      </p>

      <h3 className="text-xl font-semibold text-white">Exactly-Once Delivery</h3>
      <p className="text-gray-300 leading-relaxed">
        Kafka guarantees at-least-once delivery, which means a webhook might be delivered twice (if
        the consumer crashes after the HTTP call but before committing the offset). To provide
        exactly-once semantics to your customers, include an{' '}
        <strong className="text-white">idempotency key</strong> in the webhook payload (usually the
        event_id from the source). Customers use this key to deduplicate: if they have already processed
        event_id=evt_abc123, they ignore the duplicate. This moves the exactly-once responsibility to
        the application layer, which is the pragmatic solution used by Stripe, GitHub, and every other
        major webhook provider.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Kafka Operations & Production Concerns                 */
/* ================================================================== */

function OperationsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        Kafka Operations & Production Concerns
      </h2>
      <p className="text-gray-300 leading-relaxed">
        Deploying Kafka to production is where theory meets reality. Understanding these operational
        aspects is the difference between a Kafka cluster that hums along and one that pages you at 3 AM.
      </p>

      <h3 className="text-xl font-semibold text-white">Topic Configuration</h3>
      <p className="text-gray-300 leading-relaxed">
        Every topic has configuration parameters that profoundly affect behavior:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">retention.ms / retention.bytes:</strong> How long to keep messages.
          Time-based retention (e.g., 7 days) is the default. Size-based retention caps total bytes per
          partition. When both are set, whichever triggers first wins. For event sourcing topics where
          you need infinite retention, set retention.ms=-1.
        </li>
        <li>
          <strong className="text-white">cleanup.policy=compact:</strong> Log compaction keeps only the
          latest value per key. Kafka periodically scans the log and removes older records with the same
          key, keeping only the most recent. Used for "current state" topics: latest user profile, latest
          config, latest odds per match_id.
        </li>
        <li>
          <strong className="text-white">segment.ms / segment.bytes:</strong> The log is divided into
          segments (files on disk). Retention and compaction operate on closed segments. Smaller segments
          mean more frequent cleanup but more file handles. Typically 1GB per segment, closed after 7 days.
        </li>
        <li>
          <strong className="text-white">min.insync.replicas:</strong> Combined with acks=all, this
          determines the minimum number of replicas that must acknowledge a write. Setting this to 2
          with replication factor 3 means one replica can be down without blocking writes, but if two
          are down, the partition becomes read-only.
        </li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Consumer Lag Monitoring</h3>
      <p className="text-gray-300 leading-relaxed">
        Consumer lag is the difference between the latest offset in a partition and the consumer's
        committed offset. It represents how far behind the consumer is. This is the single most
        important operational metric for Kafka consumers.
      </p>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">What lag means:</strong>
        </p>
        <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mt-2">
          <li><strong className="text-white">Lag = 0:</strong> Consumer is caught up. Processing in real-time.</li>
          <li><strong className="text-white">Lag growing slowly:</strong> Consumer is slightly slower than production rate. Add more consumers or optimize processing.</li>
          <li><strong className="text-white">Lag growing fast:</strong> Consumer is significantly slower. Common causes: slow external calls (DB, HTTP), GC pauses, under-provisioned consumers, a poison pill message causing repeated failures.</li>
          <li><strong className="text-white">Lag suddenly spikes:</strong> Consumer restarted and is replaying from an older offset, or a rebalance caused a processing pause.</li>
        </ul>
      </div>
      <p className="text-gray-300 leading-relaxed mt-3">
        Monitor lag using Kafka's built-in tools (<code className="text-yellow-300 bg-gray-800 px-1 rounded">kafka-consumer-groups.sh --describe</code>),
        Burrow (LinkedIn's open-source lag monitor), or Prometheus exporters. Alert when lag exceeds a
        threshold relative to your SLO (e.g., "alert if the notifications consumer is more than 60
        seconds behind").
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Schema Registry</h3>
      <p className="text-gray-300 leading-relaxed">
        Without schema management, producer and consumer teams inevitably break each other. Producer
        adds a field, consumer does not expect it and crashes. Consumer expects a field that the producer
        removed. Schema Registry (typically Confluent Schema Registry, but there are open-source
        alternatives) solves this by:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Storing schemas centrally:</strong> Producers register their
          Avro/Protobuf/JSON Schema before publishing. Each schema gets a version number.
        </li>
        <li>
          <strong className="text-white">Compatibility checking:</strong> The registry enforces compatibility
          modes. <em>Backward compatible</em>: new schema can read data written by old schema (consumers can
          upgrade first). <em>Forward compatible</em>: old schema can read data written by new schema
          (producers can upgrade first). <em>Full compatible</em>: both directions.
        </li>
        <li>
          <strong className="text-white">Efficient serialization:</strong> Avro and Protobuf are compact
          binary formats. With schema registry, the schema is stored once (by ID), and each message only
          includes a 5-byte schema ID prefix, not the full schema. This can reduce message size by 40-70%
          compared to JSON.
        </li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Kafka Connect</h3>
      <p className="text-gray-300 leading-relaxed">
        Kafka Connect is a framework for streaming data between Kafka and external systems without
        writing custom producers/consumers. It provides:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Source connectors:</strong> Pull data INTO Kafka. Examples:
          Debezium (CDC from PostgreSQL/MySQL -- captures every row change as a Kafka event), JDBC Source
          (periodic queries), File Source, S3 Source.
        </li>
        <li>
          <strong className="text-white">Sink connectors:</strong> Push data FROM Kafka to external systems.
          Examples: Elasticsearch Sink (full-text search indexing), S3 Sink (data lake ingestion), JDBC Sink
          (write to relational DB), BigQuery Sink.
        </li>
        <li>
          <strong className="text-white">Distributed mode:</strong> Connect workers run as a cluster,
          distributing connector tasks across nodes. If a worker dies, its tasks are rebalanced to surviving
          workers -- same concept as consumer group rebalancing.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The killer use case is CDC (Change Data Capture) with Debezium. Instead of dual-writing to both
        your database and Kafka (which risks inconsistency), you write to the database only and Debezium
        captures the change log and publishes it to Kafka. This gives you a reliable, ordered stream of
        every database change -- effectively turning your database's write-ahead log into a Kafka topic.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Common Pitfalls</h3>
      <div className="space-y-3">
        <div className="bg-gray-800 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Too many partitions</p>
          <p className="text-gray-300 text-sm mt-1">
            Each partition has overhead: file handles, memory for index segments, replication traffic.
            With 100,000+ partitions, leader election after a broker failure can take minutes. Start with
            <code className="text-yellow-300 bg-gray-900 px-1 rounded ml-1">num_partitions = max(throughput / consumer_throughput, expected_consumer_count)</code>
            and increase conservatively.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Consumer group rebalancing storms</p>
          <p className="text-gray-300 text-sm mt-1">
            If consumers take too long to process a batch (exceeding max.poll.interval.ms, default 5 minutes),
            the broker considers them dead and triggers a rebalance. The rebalance pauses all consumers,
            causing them to fall further behind, triggering more rebalances. Fix: increase max.poll.interval.ms,
            reduce max.poll.records, or optimize processing time.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Poison pill messages</p>
          <p className="text-gray-300 text-sm mt-1">
            A malformed message that causes the consumer to throw an exception and crash, restart, re-read
            the same message, crash again -- forever. Always wrap processing in try/catch and send failures
            to a DLQ. Never let a single bad message block your entire pipeline.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Offset management bugs</p>
          <p className="text-gray-300 text-sm mt-1">
            Auto-commit (enable.auto.commit=true) commits offsets on a timer, regardless of whether
            processing succeeded. If the consumer crashes between auto-commit and processing, messages
            are lost (at-most-once). For any non-trivial application, use manual offset management:
            commit after processing completes, and handle the exactly-once/at-least-once semantics
            explicitly.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Unbalanced partitions after key changes</p>
          <p className="text-gray-300 text-sm mt-1">
            If you increase the partition count on a topic, the hash(key) % num_partitions mapping changes.
            Records with the same key will now go to different partitions than before. This breaks ordering
            guarantees for existing keys and can cause data inconsistencies in consumers that assume
            per-key ordering. Plan your initial partition count carefully -- you can always add consumers
            up to the partition count, but increasing partitions is a one-way door.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function KafkaInPractice() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">
          Kafka in Real-World Systems
        </h1>
        <p className="text-lg text-gray-400">
          Four production Kafka architectures dissected by a staff engineer -- real-time betting,
          social media fan-out, infrastructure monitoring, and webhook delivery systems. Plus the
          operational knowledge you need to run Kafka in production without getting paged at 3 AM.
        </p>
      </header>

      <BettingPlatformSection />
      <SocialMediaSection />
      <MonitoringSection />
      <WebhookSection />
      <OperationsSection />
    </div>
  )
}
