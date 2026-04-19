import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-messaging',
  title: 'Design a Real-Time Messaging App (100M users)',
  description:
    'WhatsApp / Messenger at scale: WebSocket gateways, write-path fan-out, ordering via sequence numbers, group chat strategies, presence, offline delivery, and end-to-end encryption',
  track: 'systems',
  order: 26,
  tags: [
    'messaging',
    'whatsapp',
    'websocket',
    'real-time',
    'fan-out',
    'presence',
    'e2e-encryption',
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
/*  Section 1 -- Problem Statement                                     */
/* ================================================================== */

function ProblemStatementSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a <strong className="text-white">real-time messaging platform</strong> like WhatsApp
        or Facebook Messenger at{' '}
        <strong className="text-white">100M monthly active users</strong>. The core promise: you
        send a message and the other person sees it within a second — no matter where they are,
        whether they were online when you sent it, whether the group has 4 members or 500.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The interesting constraints are not throughput alone. They are:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li>A <strong className="text-white">persistent connection</strong> per online user — not a request/response API</li>
        <li><strong className="text-white">Bidirectional</strong> — server pushes, client pushes, both at once</li>
        <li><strong className="text-white">Per-conversation ordering</strong> even under failures, retries, and multi-device sync</li>
        <li><strong className="text-white">Offline recipients</strong> — the message must arrive when they come back online or via push notification</li>
        <li><strong className="text-white">Groups with wildly different sizes</strong> — 1:1 chats and 500-member groups share one system</li>
        <li><strong className="text-white">End-to-end encryption</strong> — the server must deliver without being able to read</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Every big messaging app — Messenger, WhatsApp, iMessage, Telegram, Signal, Discord —
        makes different tradeoffs across these, and this lesson is a map of those tradeoffs.
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
        <li><strong className="text-white">Send / receive text messages</strong> 1:1 and in groups (up to 500 members)</li>
        <li><strong className="text-white">Delivery receipts</strong> — sent, delivered, read (per-recipient in groups)</li>
        <li><strong className="text-white">Typing indicators</strong> and <strong className="text-white">online / last-seen presence</strong></li>
        <li><strong className="text-white">Media messages</strong> — images, videos, voice notes, documents with thumbnails</li>
        <li><strong className="text-white">Offline delivery</strong> — messages queued until recipient reconnects</li>
        <li><strong className="text-white">Push notifications</strong> via APNS / FCM when app is backgrounded or killed</li>
        <li><strong className="text-white">Multi-device sync</strong> — same account on phone + web + desktop, all consistent</li>
        <li><strong className="text-white">Message history</strong> — scroll back through years of conversation</li>
        <li><strong className="text-white">Group management</strong> — create, add / remove members, admin roles</li>
        <li><strong className="text-white">End-to-end encryption</strong> — Signal-protocol style (optional, covered at the end)</li>
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
              <td className="py-2 px-4 font-medium">P50 send-to-deliver latency</td>
              <td className="py-2 px-4">&lt; 200 ms (same region)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">P99 latency</td>
              <td className="py-2 px-4">&lt; 1 second</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Availability</td>
              <td className="py-2 px-4">99.99% (52 min / year of downtime)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Durability</td>
              <td className="py-2 px-4">Zero message loss once the server acks the send</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Ordering</td>
              <td className="py-2 px-4">FIFO per conversation (across devices, across retries)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Delivery guarantee</td>
              <td className="py-2 px-4">Exactly-once UX via client-generated idempotency IDs</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Connection count</td>
              <td className="py-2 px-4">~30M concurrent WebSockets at peak (~30% of MAU)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Global reach</td>
              <td className="py-2 px-4">Multi-region with edge PoPs; &lt; 100 ms RTT to the nearest gateway</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Back-of-Envelope                                      */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">4. Back-of-Envelope Calculations</h2>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-3 font-mono text-sm text-gray-300">
        <p className="text-white font-bold font-sans">User scale</p>
        <p>100M MAU × 30% online peak = <span className="text-green-400">30M concurrent WebSockets</span></p>
        <p>Per gateway server: ~50K sockets comfortably → <span className="text-yellow-400">600 gateway nodes at peak</span></p>

        <p className="text-white font-bold font-sans pt-2">Message volume</p>
        <p>100M users × 50 msgs/day avg = <span className="text-green-400">5B messages/day</span></p>
        <p>5B / 86400 = ~58K msgs/sec avg, ~<span className="text-yellow-400">200K msgs/sec peak</span></p>
        <p>Avg 200B payload × 200K/sec = <span className="text-green-400">~40 MB/s ingress</span></p>

        <p className="text-white font-bold font-sans pt-2">Fan-out (reads)</p>
        <p>Avg conversation size: 5 recipients → 200K sends × 5 = <span className="text-yellow-400">1M deliveries/sec peak</span></p>
        <p>Plus typing/presence/read-receipts: roughly 10x the send rate = <span className="text-yellow-400">~2M events/sec peak total</span></p>

        <p className="text-white font-bold font-sans pt-2">Storage</p>
        <p>5B msgs/day × 500B stored (with metadata) = <span className="text-green-400">2.5 TB/day</span></p>
        <p>× 365 days × 5 years retention = <span className="text-green-400">~4.5 PB</span></p>
        <p>+ media: 10% of msgs × 500 KB = <span className="text-green-400">~250 TB/day → multi-PB CDN + object store</span></p>

        <p className="text-white font-bold font-sans pt-2">Memory (hot connection state)</p>
        <p>30M sockets × ~16 KB/conn = <span className="text-yellow-400">~480 GB across the gateway tier</span></p>
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
      <h2 className="text-2xl font-bold text-white">5. API Design</h2>
      <p className="text-gray-300 leading-relaxed">
        The API is split into two shapes: REST/HTTPS for one-shot operations (history fetch,
        media upload) and a persistent WebSocket for real-time push. Every WebSocket frame has a
        small envelope + typed payload.
      </p>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold">// 1. Connect + authenticate</p>
        <p>GET /ws  Upgrade: websocket  Authorization: Bearer &lt;jwt&gt;</p>
        <p>&lt;-- &#123; type: &quot;connected&quot;, session_id, last_seq_acked &#125;</p>

        <p className="text-white font-bold pt-2">// 2. Client sends a message</p>
        <p>--&gt; &#123;</p>
        <p>    type: &quot;send&quot;,</p>
        <p>    client_msg_id: &quot;uuid-v4&quot;,   <span className="text-gray-500">// idempotency key</span></p>
        <p>    conversation_id,</p>
        <p>    body,</p>
        <p>    attachments: [&#123; s3_key, mime, size &#125;]</p>
        <p>  &#125;</p>
        <p>&lt;-- &#123; type: &quot;ack&quot;, client_msg_id, message_id, seq &#125;</p>

        <p className="text-white font-bold pt-2">// 3. Server pushes inbound message</p>
        <p>&lt;-- &#123;</p>
        <p>    type: &quot;message&quot;,</p>
        <p>    message_id, conversation_id, sender_id, seq,</p>
        <p>    body, attachments, ts</p>
        <p>  &#125;</p>
        <p>--&gt; &#123; type: &quot;delivered&quot;, message_id &#125;    <span className="text-gray-500">// recipient ack</span></p>

        <p className="text-white font-bold pt-2">// 4. Presence &amp; typing (ephemeral)</p>
        <p>--&gt; &#123; type: &quot;typing&quot;, conversation_id, on: true &#125;</p>
        <p>&lt;-- &#123; type: &quot;presence&quot;, user_id, status: &quot;online&quot; &#125;</p>

        <p className="text-white font-bold pt-2">// 5. REST: paginated history</p>
        <p>GET /conversations/&#123;id&#125;/messages?before_seq=N&amp;limit=50</p>

        <p className="text-white font-bold pt-2">// 6. REST: media upload via presigned URL</p>
        <p>POST /uploads/presign  → &#123; s3_url, s3_key &#125;</p>
        <p>PUT  &lt;s3_url&gt;  binary data...</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why WebSocket over HTTP polling:</strong> 30M users
          polling every 3 seconds is 10M QPS just to ask "anything new?" — mostly returning
          nothing. One persistent socket per user, with a ~30 KB/s idle cost (mostly TCP keepalives),
          is the only sane choice at this scale. MQTT over TCP or QUIC is a reasonable alternative; WhatsApp historically used XMPP then moved to a custom binary protocol.
        </p>
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
              <th className="py-2 px-3 text-white">Table</th>
              <th className="py-2 px-3 text-white">Key fields</th>
              <th className="py-2 px-3 text-white">Partition by</th>
              <th className="py-2 px-3 text-white">Storage</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 text-xs">
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-blue-400">users</td>
              <td className="py-2 px-3">user_id (pk), phone, display_name, last_seen, push_token, device_id</td>
              <td className="py-2 px-3">user_id</td>
              <td className="py-2 px-3">SQL (consistency matters here)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-green-400">conversations</td>
              <td className="py-2 px-3">conversation_id (pk), type (1:1 / group), title, created_at</td>
              <td className="py-2 px-3">conversation_id</td>
              <td className="py-2 px-3">SQL or Cassandra</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-emerald-400">conversation_members</td>
              <td className="py-2 px-3">(conversation_id, user_id) (pk), role, joined_at, last_read_seq</td>
              <td className="py-2 px-3">conversation_id (+ global index by user_id)</td>
              <td className="py-2 px-3">SQL or Cassandra</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-purple-400">messages</td>
              <td className="py-2 px-3">(conversation_id, seq) (pk), message_id, sender_id, body, attachments, ts</td>
              <td className="py-2 px-3">conversation_id (clustering on seq)</td>
              <td className="py-2 px-3">Cassandra / Bigtable (time-series, append-heavy)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-pink-400">inbox (user_inbox)</td>
              <td className="py-2 px-3">(user_id, message_id) (pk), conversation_id, seq, delivered_at</td>
              <td className="py-2 px-3">user_id</td>
              <td className="py-2 px-3">Cassandra (per-user queue of undelivered msgs)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-amber-400">delivery_status</td>
              <td className="py-2 px-3">(message_id, recipient_id) (pk), state (sent/delivered/read), ts</td>
              <td className="py-2 px-3">message_id</td>
              <td className="py-2 px-3">Cassandra (high write rate)</td>
            </tr>
            <tr className="align-top">
              <td className="py-2 px-3 font-medium text-cyan-400">connection_registry</td>
              <td className="py-2 px-3">user_id → gateway_node_id + socket_id</td>
              <td className="py-2 px-3">user_id (hash)</td>
              <td className="py-2 px-3">Redis (ephemeral, TTL on disconnect)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why per-conversation seq (not global):</strong> a
          global sequence number is a write bottleneck at 200K msgs/sec. Per-conversation seq
          gives you per-conversation FIFO ordering (which is what users care about), and the
          partition key is <code className="text-pink-400">conversation_id</code> — one
          monotonically increasing counter per shard.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- High-Level Architecture                               */
/* ================================================================== */

function ArchitectureSection() {
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

      drawLabel(p, 'End-to-end architecture: clients → gateways → services → storage', w / 2, 20, 12, [255, 255, 255])

      // Layer 1: Clients (row of phones)
      const clientsY = 70
      const phones = 5
      for (let i = 0; i < phones; i++) {
        const x = w * (0.1 + i * 0.2)
        drawBox(p, x, clientsY, 70, 28, [20, 40, 70], [100, 180, 255], `Client ${i + 1}`, 8)
      }

      // Layer 2: Global LB / edge
      const lbY = 140
      drawBox(p, w / 2, lbY, 260, 30, [30, 30, 50], [180, 180, 220], 'Edge LB (Anycast · WSS / QUIC)', 10)

      // Layer 3: Gateway tier (WebSocket fleet)
      const gatewaysY = 220
      const gws = 4
      for (let i = 0; i < gws; i++) {
        const x = w * (0.15 + i * 0.23)
        drawBox(p, x, gatewaysY, 120, 36, [35, 45, 30], [160, 220, 140], `Gateway ${i + 1}`, 9)
        drawLabel(p, '~50K sockets', x, gatewaysY + 14, 7, [180, 220, 180])
      }

      // Layer 4: Core services (row)
      const svcY = 330
      const services: { x: number; label: string; color: RGB }[] = [
        { x: w * 0.12, label: 'Auth / Session', color: [180, 180, 220] },
        { x: w * 0.3, label: 'Message\nService', color: [255, 180, 100] },
        { x: w * 0.48, label: 'Presence\nService', color: [200, 140, 255] },
        { x: w * 0.66, label: 'Push\nFanout', color: [255, 140, 180] },
        { x: w * 0.84, label: 'Media /\nAPI', color: [140, 220, 220] },
      ]
      for (const s of services) {
        drawBox(
          p,
          s.x,
          svcY,
          110,
          44,
          [s.color[0] * 0.2, s.color[1] * 0.2, s.color[2] * 0.2],
          s.color,
          s.label.split('\n')[0],
          9,
        )
        drawLabel(p, s.label.split('\n')[1] ?? '', s.x, svcY + 12, 8, s.color)
      }

      // Layer 5: Storage
      const storY = 440
      const stores: { x: number; label: string; color: RGB }[] = [
        { x: w * 0.12, label: 'Users SQL', color: [100, 180, 255] },
        { x: w * 0.3, label: 'Messages\n(Cassandra)', color: [255, 180, 100] },
        { x: w * 0.48, label: 'Presence\n(Redis)', color: [200, 140, 255] },
        { x: w * 0.66, label: 'Kafka\n(event bus)', color: [255, 140, 180] },
        { x: w * 0.84, label: 'S3 / CDN\n(media)', color: [140, 220, 220] },
      ]
      for (const s of stores) {
        drawBox(
          p,
          s.x,
          storY,
          115,
          44,
          [s.color[0] * 0.15, s.color[1] * 0.15, s.color[2] * 0.15],
          s.color,
          s.label.split('\n')[0],
          9,
        )
        drawLabel(p, s.label.split('\n')[1] ?? '', s.x, storY + 12, 7, s.color)
      }

      // Arrows: clients -> LB
      for (let i = 0; i < phones; i++) {
        const x = w * (0.1 + i * 0.2)
        drawArrow(p, x, clientsY + 14, w / 2 - 130 + i * 65, lbY - 15, [100, 180, 255, 80])
      }

      // LB -> Gateways
      for (let i = 0; i < gws; i++) {
        const gx = w * (0.15 + i * 0.23)
        drawArrow(p, w / 2, lbY + 15, gx, gatewaysY - 18, [180, 180, 220, 120])
      }

      // Gateways -> Services (show one animated flow)
      const activeSvc = Math.floor((t * 0.5) % services.length)
      for (let i = 0; i < gws; i++) {
        const gx = w * (0.15 + i * 0.23)
        const sx = services[activeSvc].x
        drawArrow(p, gx, gatewaysY + 18, sx, svcY - 22, [160, 220, 140, 80])
      }
      // Animated dot from one gateway to the active service
      const prog = (t % 1)
      drawMovingDot(
        p,
        w * 0.38,
        gatewaysY + 18,
        services[activeSvc].x,
        svcY - 22,
        prog,
        services[activeSvc].color,
      )

      // Services -> Storage (vertical)
      for (let i = 0; i < services.length; i++) {
        const s = services[i]
        const st = stores[i]
        drawArrow(p, s.x, svcY + 22, st.x, storY - 22, [s.color[0], s.color[1], s.color[2], 110])
      }

      // Label for Kafka / event bus (cross-cutting)
      const kafkaX = stores[3].x
      const kafkaY = storY
      for (let i = 1; i < 4; i++) {
        const sx = services[i].x
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        drawArrow(p, sx, svcY + 22, kafkaX, kafkaY - 22, [255, 140, 180, 80])
        ctx.setLineDash([])
      }

      // Footer
      drawLabel(
        p,
        'Hot path = Client → Edge → Gateway (WS) → Message Service → Cassandra + Kafka → Fan-out',
        w / 2,
        500,
        9,
        [200, 200, 200],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        Five layers, loosely coupled. The <strong className="text-white">gateway tier</strong>{' '}
        terminates WebSockets and keeps per-connection state. <strong className="text-white">Core services</strong>{' '}
        are stateless workers that talk to storage. A <strong className="text-white">Kafka event bus</strong>{' '}
        decouples the write path from fan-out, enabling safe retries and replay.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">The stateful layer: Gateway</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            The only place in the system that holds a user's live connection. Everything else is
            stateless and horizontally scalable. A gateway owns the socket, applies
            backpressure, and relays messages in and out. When the gateway dies, the client
            reconnects to another one and replays missing messages by <code className="text-pink-400">last_seq_acked</code>.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Why Kafka in the middle</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            A sent message is written once to Kafka. Every downstream consumer (push service,
            analytics, archive, anti-spam, fan-out) reads independently. This isolates the
            hot send path from slow downstreams, makes retries safe, and survives transient
            Cassandra hiccups.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Connection Layer (WebSocket at scale)                 */
/* ================================================================== */

function ConnectionLayerSection() {
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

      drawLabel(p, 'Finding a user: the connection registry', w / 2, 20, 12, [255, 255, 255])

      // Sender gateway on the left
      const senderGwX = w * 0.12
      drawBox(p, senderGwX, 180, 130, 40, [35, 45, 30], [160, 220, 140], 'Gateway-A', 10)
      drawLabel(p, '(Alice\'s connection)', senderGwX, 205, 8, [200, 220, 200])

      // Alice client
      drawBox(p, senderGwX, 90, 70, 28, [20, 40, 70], [100, 180, 255], 'Alice', 9)
      drawArrow(p, senderGwX, 104, senderGwX, 160, [100, 180, 255, 180])
      drawLabel(p, 'WSS', senderGwX + 20, 132, 8, [150, 200, 255])

      // Message Service
      const msX = w * 0.35
      drawBox(p, msX, 180, 140, 50, [50, 40, 20], [255, 180, 100], 'Message Service', 10)
      drawLabel(p, '(stateless worker)', msX, 198, 8, [220, 200, 160])

      drawArrow(p, senderGwX + 65, 180, msX - 70, 180, [160, 220, 140, 180])
      const prog1 = (t * 0.8) % 1
      drawMovingDot(p, senderGwX + 65, 180, msX - 70, 180, prog1, [180, 240, 160], 7)
      drawLabel(p, '1. send', (senderGwX + msX) / 2, 163, 9, [180, 220, 180])

      // Redis connection registry
      const redisX = w * 0.58
      drawBox(p, redisX, 80, 160, 48, [60, 30, 30], [255, 120, 120], 'Redis: conn_registry', 10)
      drawLabel(p, 'user_id → gw_node', redisX, 97, 8, [255, 180, 180])
      drawLabel(p, 'TTL on heartbeat', redisX, 110, 7, [220, 160, 160])

      drawArrow(p, msX, 155, redisX - 10, 105, [255, 180, 100, 160])
      drawArrow(p, redisX - 10, 115, msX, 167, [255, 120, 120, 160])
      drawLabel(p, '2. lookup Bob', (msX + redisX) / 2 - 20, 135, 8, [220, 180, 180])

      // Recipient gateway + Bob
      const recvGwX = w * 0.85
      drawBox(p, recvGwX, 180, 130, 40, [35, 45, 30], [160, 220, 140], 'Gateway-B', 10)
      drawLabel(p, '(Bob\'s connection)', recvGwX, 205, 8, [200, 220, 200])

      drawBox(p, recvGwX, 90, 70, 28, [20, 40, 70], [100, 180, 255], 'Bob', 9)
      drawArrow(p, recvGwX, 160, recvGwX, 104, [100, 180, 255, 180])

      drawArrow(p, msX + 70, 180, recvGwX - 65, 180, [255, 180, 100, 180])
      const prog2 = (t * 0.8 + 0.3) % 1
      drawMovingDot(p, msX + 70, 180, recvGwX - 65, 180, prog2, [255, 200, 120], 7)
      drawLabel(p, '3. push', (msX + recvGwX) / 2, 163, 9, [220, 200, 160])

      const prog3 = (t * 0.8 + 0.5) % 1
      drawMovingDot(p, recvGwX, 160, recvGwX, 104, prog3, [120, 200, 255], 7)

      // Below: Heartbeat and registration flow
      const heartY = 340
      drawLabel(p, 'Registration on connect:', 40, heartY - 60, 10, [255, 255, 255], 'left')
      drawLabel(p, "1. Client opens WSS → LB picks any Gateway", 60, heartY - 40, 9, [220, 220, 220], 'left')
      drawLabel(p, "2. Gateway writes SETEX user_id:<uid> {gw_id, socket_id} EX 60 in Redis", 60, heartY - 22, 9, [220, 220, 220], 'left')
      drawLabel(p, "3. Gateway heartbeats every 20s to refresh TTL (auto-cleanup on crash)", 60, heartY - 4, 9, [220, 220, 220], 'left')
      drawLabel(p, "4. On disconnect: DEL the key + publish 'offline' event on Kafka", 60, heartY + 14, 9, [220, 220, 220], 'left')

      // Box around the operation text
      p.noFill()
      p.stroke(80, 80, 100)
      p.strokeWeight(1)
      p.rect(30, heartY - 72, w - 60, 100, 8)

      drawLabel(
        p,
        'Failure handling: if Gateway-B is dead, Redis TTL expires → lookup returns nothing → message queued in user_inbox + push notification sent',
        w / 2,
        420,
        9,
        [255, 200, 120],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Connection Layer — WebSockets at 30M</h2>
      <p className="text-gray-300 leading-relaxed">
        The gateway tier holds the live sockets. Two questions drive its design:{' '}
        <strong className="text-white">how do we find a user's gateway?</strong> and{' '}
        <strong className="text-white">what happens when a gateway dies?</strong>
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Connection registry (Redis)</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            A hash map{' '}
            <code className="text-pink-400">user_id → (gateway_node_id, socket_id)</code> in
            Redis, partitioned by <code className="text-pink-400">user_id</code>. Gateways write
            on connect with a short TTL and refresh it via heartbeats. The message service
            reads it to find the right gateway to push to.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Multiple devices per user</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Use a <em>set</em> keyed by user_id containing all active (device_id,
            gateway_node_id) pairs. Every incoming message fans out to every device in the set,
            and each device acks independently. Newer devices sync missing messages via the{' '}
            <code className="text-pink-400">last_seq_acked</code> cursor on reconnect.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Load balancing gateways:</strong> clients should
          not hash to a specific gateway — any gateway will do, since the registry makes the
          location independent. The LB picks the least-loaded node. If the chosen gateway dies,
          the client reconnects, re-registers, and re-subscribes to its conversations. No
          sticky sessions needed.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Write Path / Message Send Flow                        */
/* ================================================================== */

function WritePathSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 480)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.010
      p.background(15, 15, 25)

      drawLabel(p, 'Write path: 1 send → N deliveries (with idempotency and durability)', w / 2, 20, 12, [255, 255, 255])

      // Steps arranged vertically
      const xCenter = w / 2
      const steps: { y: number; title: string; detail: string; color: RGB }[] = [
        { y: 70, title: 'Alice sends: { client_msg_id, conv_id, body }', detail: 'client_msg_id = UUID generated on device = idempotency key', color: [100, 180, 255] },
        { y: 130, title: 'Gateway: authenticate + forward to Message Service', detail: 'no durable write yet — just a stateless hop', color: [160, 220, 140] },
        { y: 190, title: 'Message Service: dedupe + assign (conv_id, seq)', detail: 'INSERT IF NOT EXISTS by client_msg_id; seq from per-conversation counter', color: [255, 180, 100] },
        { y: 260, title: 'Persist: Cassandra messages + Kafka event', detail: 'two writes: the message row + a topic event for fan-out', color: [220, 140, 255] },
        { y: 330, title: 'ACK Alice: { message_id, seq }', detail: 'at this point the write is durable; Alice\'s UI shows double-check ✓✓', color: [120, 220, 140] },
        { y: 390, title: 'Fan-out: push to every recipient (+ inbox row if offline)', detail: 'Kafka consumer reads event → for each recipient: registry lookup → push OR enqueue', color: [255, 140, 180] },
      ]

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        // Big box
        p.fill(s.color[0] * 0.15, s.color[1] * 0.15, s.color[2] * 0.15)
        p.stroke(s.color[0], s.color[1], s.color[2])
        p.strokeWeight(1.5)
        p.rect(xCenter - 380, s.y - 22, 760, 48, 6)

        // Step number badge
        p.fill(s.color[0], s.color[1], s.color[2])
        p.noStroke()
        p.ellipse(xCenter - 360, s.y, 26, 26)
        p.fill(15, 15, 25)
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(11)
        p.text(`${i + 1}`, xCenter - 360, s.y)

        drawLabel(p, s.title, xCenter - 340, s.y - 7, 11, [255, 255, 255], 'left')
        drawLabel(p, s.detail, xCenter - 340, s.y + 10, 9, [200, 200, 200], 'left')

        // Down arrow to next
        if (i < steps.length - 1) {
          const fromY = s.y + 26
          const toY = steps[i + 1].y - 22
          p.stroke(120, 120, 140)
          p.strokeWeight(1.2)
          p.line(xCenter - 340, fromY, xCenter - 340, toY - 2)
          p.fill(120, 120, 140)
          p.noStroke()
          p.triangle(xCenter - 340, toY, xCenter - 344, toY - 6, xCenter - 336, toY - 6)
        }
      }

      // Animated dot following the steps
      const totalSpan = steps[steps.length - 1].y - steps[0].y
      const phase = (t * 0.3) % 1
      const dotY = steps[0].y + phase * totalSpan
      p.fill(255, 220, 120)
      p.noStroke()
      p.ellipse(xCenter - 340, dotY, 10, 10)

      // Side note on idempotency
      drawLabel(
        p,
        "Idempotency: if Alice's network flakes and she retries, step 3 dedupes by client_msg_id — the user sees one message, not two.",
        w / 2,
        455,
        9,
        [255, 220, 160],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. The Write Path</h2>
      <p className="text-gray-300 leading-relaxed">
        What actually happens between "Alice taps send" and "Bob's phone buzzes." Six steps. The
        whole thing takes 50–200 ms at P50.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Why the client generates client_msg_id</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            If the server generated the ID, a retry would create a duplicate. The client picks a
            UUIDv4 once, includes it in every retry, and the Message Service uses it as the
            primary idempotency key. First write wins; retries return the same{' '}
            <code className="text-pink-400">message_id</code> and <code className="text-pink-400">seq</code>.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Why ack after Kafka, not after fan-out</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            If we waited for every recipient to be pushed, the sender ack would be gated on the
            slowest recipient. By acking right after Cassandra + Kafka are durable, Alice sees
            instant confirmation, and fan-out is best-effort from an isolated consumer.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Kafka Event Bus (async backbone)                     */
/* ================================================================== */

function KafkaBackboneSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 540)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Kafka: one durable write, many independent consumers', w / 2, 20, 12, [255, 255, 255])

      // Producer (Message Service)
      const prodX = w * 0.1
      drawBox(p, prodX, 260, 120, 44, [50, 40, 20], [255, 180, 100], 'Message Svc', 10)
      drawLabel(p, '(producer)', prodX, 282, 8, [220, 180, 140])

      // Kafka topic: messages.sent (append-only log)
      const topicX = w * 0.42
      const topicY = 260
      const logW = 280
      const logH = 54
      const numCells = 14
      const cellW = logW / numCells
      const logStartX = topicX - logW / 2

      // Frame
      p.stroke(100, 180, 255)
      p.strokeWeight(1.5)
      p.fill(20, 30, 50)
      p.rect(logStartX, topicY - logH / 2, logW, logH, 4)

      const highWater = Math.min(numCells, Math.floor(t * 2.5) % (numCells + 3) + 1)
      for (let i = 0; i < numCells; i++) {
        const filled = i < highWater
        p.fill(filled ? 40 : 25, filled ? 70 : 40, filled ? 120 : 60)
        p.stroke(100, 180, 255, filled ? 200 : 80)
        p.strokeWeight(1)
        p.rect(logStartX + i * cellW, topicY - logH / 2, cellW, logH, 2)
        if (filled) {
          p.fill(200, 220, 255)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${i}`, logStartX + i * cellW + cellW / 2, topicY)
        }
      }

      drawLabel(p, 'topic: messages.sent', topicX, topicY - logH / 2 - 14, 11, [160, 220, 255])
      drawLabel(p, '(partitioned by conversation_id · 7-day retention)', topicX, topicY + logH / 2 + 14, 8, [150, 180, 220])

      // Producer -> Topic
      drawArrow(p, prodX + 60, topicY, logStartX - 5, topicY, [255, 180, 100, 180])
      const prodProg = (t * 0.8) % 1
      drawMovingDot(p, prodX + 60, topicY, logStartX - 5, topicY, prodProg, [255, 200, 120])
      drawLabel(p, 'produce', (prodX + 60 + logStartX - 5) / 2, topicY - 14, 8, [255, 200, 140])

      // Consumer groups on the right
      const consX = w * 0.84
      const groups: { y: number; name: string; offset: number; color: RGB; purpose: string }[] = [
        { y: 80, name: 'Push Fanout', offset: 12, color: [120, 220, 140], purpose: 'deliver to each recipient' },
        { y: 160, name: 'Archive', offset: 9, color: [180, 180, 220], purpose: 'warm → cold storage' },
        { y: 260, name: 'Analytics', offset: 7, color: [255, 200, 100], purpose: 'real-time dashboards' },
        { y: 360, name: 'Anti-spam / ML', offset: 5, color: [255, 140, 180], purpose: 'classify, rate-limit' },
        { y: 440, name: 'Cross-region', offset: 10, color: [200, 140, 255], purpose: 'multi-DC replica' },
      ]

      for (let i = 0; i < groups.length; i++) {
        const g = groups[i]
        drawBox(
          p,
          consX,
          g.y,
          145,
          30,
          [g.color[0] * 0.15, g.color[1] * 0.15, g.color[2] * 0.15],
          g.color,
          g.name,
          9,
        )
        drawLabel(p, g.purpose, consX, g.y + 22, 7, [180, 180, 180])

        // Arrow from topic to consumer
        drawArrow(p, logStartX + logW + 5, topicY, consX - 80, g.y, [g.color[0], g.color[1], g.color[2], 110])
        // Moving dot (the group fetching)
        const prog = ((t * 0.55 + i * 0.14) % 1)
        drawMovingDot(p, logStartX + logW + 5, topicY, consX - 80, g.y, prog, g.color, 5)

        // Offset pointer from consumer down/up into the log cell it's at
        const offsetX = logStartX + g.offset * cellW + cellW / 2
        const offsetTopY = topicY - logH / 2 - 8
        const offsetBotY = topicY + logH / 2 + 8
        const aboveTopic = g.y < topicY
        const y0 = aboveTopic ? offsetTopY : offsetBotY
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([2, 3])
        p.stroke(g.color[0], g.color[1], g.color[2], 160)
        p.strokeWeight(1)
        p.line(offsetX, y0, offsetX, aboveTopic ? topicY - logH / 2 : topicY + logH / 2)
        ctx.setLineDash([])
        // Offset label
        drawLabel(p, `@${g.offset}`, offsetX, aboveTopic ? offsetTopY - 6 : offsetBotY + 6, 7, g.color)
      }

      // Footer caption
      p.fill(30, 30, 50, 220)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, 490, w - 80, 36, 6)
      drawLabel(p, 'Each consumer group tracks its OWN offset. A slow or broken consumer cannot affect the others', w / 2, 502, 9, [220, 220, 220])
      drawLabel(p, 'or the send path — it catches up from its stored offset when it recovers.', w / 2, 516, 9, [220, 220, 220])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. The Async Backbone — Kafka Event Bus</h2>
      <p className="text-gray-300 leading-relaxed">
        Almost everything the system does after "Alice's message is durable" flows through
        Kafka. The write path ends with{' '}
        <code className="text-pink-400">Cassandra insert + Kafka produce</code> — and that's it
        for the hot path. Everything else is a Kafka consumer doing its own thing at its own
        pace.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-2">The main topics</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-white">Topic</th>
                <th className="py-2 px-3 text-white">Producer</th>
                <th className="py-2 px-3 text-white">Consumers</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-xs">
              <tr className="border-b border-gray-800 align-top">
                <td className="py-2 px-3 font-mono text-pink-400">messages.sent</td>
                <td className="py-2 px-3">Message Service (after Cassandra write)</td>
                <td className="py-2 px-3">Push Fanout · Archive · Analytics · Anti-spam · Search indexer · Cross-region replicator</td>
              </tr>
              <tr className="border-b border-gray-800 align-top">
                <td className="py-2 px-3 font-mono text-pink-400">deliveries.acked</td>
                <td className="py-2 px-3">Gateway (on client ack / read)</td>
                <td className="py-2 px-3">Delivery-status updater · Analytics</td>
              </tr>
              <tr className="border-b border-gray-800 align-top">
                <td className="py-2 px-3 font-mono text-pink-400">presence.changed</td>
                <td className="py-2 px-3">Gateway (connect / disconnect)</td>
                <td className="py-2 px-3">Last-seen updater · Push-token refresher</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 px-3 font-mono text-pink-400">media.uploaded</td>
                <td className="py-2 px-3">API Service (on S3 PUT complete)</td>
                <td className="py-2 px-3">Thumbnail generator · Virus scanner · Transcoder</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">What goes through Kafka</p>
          <ul className="list-disc list-inside text-gray-300 text-xs mt-2 space-y-1 leading-relaxed">
            <li>The fan-out trigger for every message</li>
            <li>Everything async: archive, analytics, anti-spam, search indexing</li>
            <li>Cross-region replication</li>
            <li>Anything that benefits from replay — a bug-fixed consumer re-processes from a past offset</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">What does NOT go through Kafka</p>
          <ul className="list-disc list-inside text-gray-300 text-xs mt-2 space-y-1 leading-relaxed">
            <li>Live WebSocket push to online users (direct Message Service → Gateway RPC — Kafka's 5–20 ms is too much)</li>
            <li>Presence / typing events (Redis Pub/Sub — fire-and-forget, microseconds)</li>
            <li>History fetches (REST → Cassandra)</li>
            <li>Connection registry (Redis SETEX + heartbeats)</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why this shape:</strong> imagine Push Fanout
          called APNS synchronously from inside Alice's send. A slow APNS upstream would slow
          every send in the system. With Kafka in the middle, Alice gets her ack the instant
          Cassandra + Kafka are durable (~10 ms), and Push Fanout catches up from its own
          offset. If Push Fanout is down for 10 minutes, Analytics doesn't notice; when Push
          Fanout recovers, it picks up where it left off. Isolation by offset is the core gift
          Kafka gives this design.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Ordering & Delivery Guarantees                       */
/* ================================================================== */

function OrderingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Ordering, Idempotency &amp; Delivery</h2>
      <p className="text-gray-300 leading-relaxed">
        Users expect that if they typed A then B, everyone sees A then B. That's harder than it
        sounds when you have retries, multiple devices, and offline recipients all in play.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Per-conversation sequence numbers</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Every message gets an integer <code className="text-pink-400">seq</code> that is
            monotonically increasing within a single <code className="text-pink-400">conversation_id</code>.
            The partition key is the conversation, so there's one counter per shard — no global
            bottleneck. Clients display in seq order, not timestamp order (wall clocks drift
            across devices).
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Exactly-once UX via idempotency</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            At-least-once at the protocol level (retries happen). <em>Exactly-once at the user
            level</em> by deduping on <code className="text-pink-400">client_msg_id</code>. The
            Cassandra insert is conditional:{' '}
            <code className="text-pink-400">INSERT ... IF NOT EXISTS</code>. On duplicate, the
            handler returns the previously-assigned seq. The user sees one message whether
            Alice retried zero or a hundred times.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Client-side cursor: last_seq_acked</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Every client tracks per-conversation <code className="text-pink-400">last_seq_acked</code>
            (highest seq it has received and displayed). On reconnect, the client opens the WS,
            sends <code className="text-pink-400">&#123;last_seq_acked per conversation&#125;</code>,
            and the server replays missing messages from the inbox table. No gaps, no duplicates.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Multi-device consistency</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Each device is an independent subscriber with its own{' '}
            <code className="text-pink-400">last_seq_acked</code>. The inbox row stores{' '}
            <code className="text-pink-400">delivered_to_device</code> bitmask, so the server
            knows which devices have received each message. When phone A acks, phones B and C
            don't get a "delivered" event until they have acked it too (this matches the UX of
            both checkmarks in WhatsApp).
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-rose-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Read receipts</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            A read event is just another message sent upstream:{' '}
            <code className="text-pink-400">&#123; type: "read", conv_id, up_to_seq &#125;</code>.
            Written to <code className="text-pink-400">conversation_members.last_read_seq</code>,
            then fanned out to the original sender's gateway. Group reads generate one event per
            reader — aggregate on the client for the blue-checkmark UI.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">What about strict global ordering?</strong> Don't
          try. A global sequence at 200K writes/sec requires a single shard for every write —
          game over. Per-conversation ordering is what users perceive; cross-conversation
          ordering is meaningless ("did Alice's message in group X come before Bob's in group
          Y?" — nobody cares).
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- Group Fan-Out                                        */
/* ================================================================== */

function GroupFanoutSection() {
  const [strategy, setStrategy] = useState<'fanout-write' | 'fanout-read' | 'hybrid'>('hybrid')
  const stratRef = useRef(strategy)
  stratRef.current = strategy

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
      const s = stratRef.current

      const title =
        s === 'fanout-write'
          ? 'Fan-out on write: one row per recipient (fast reads, expensive writes)'
          : s === 'fanout-read'
          ? 'Fan-out on read: one row per message (cheap writes, expensive reads)'
          : 'Hybrid: write-fanout for small groups, read-fanout for large groups'
      drawLabel(p, title, w / 2, 22, 11, [255, 255, 255])

      // Sender
      const sX = w * 0.08
      drawBox(p, sX, 200, 80, 30, [20, 40, 70], [100, 180, 255], 'Sender', 9)

      // Message service
      const msX = w * 0.28
      drawBox(p, msX, 200, 120, 36, [50, 40, 20], [255, 180, 100], 'Message Svc', 10)
      drawArrow(p, sX + 40, 200, msX - 60, 200, [100, 180, 255, 160])
      const pp = (t * 0.8) % 1
      drawMovingDot(p, sX + 40, 200, msX - 60, 200, pp, [100, 200, 255])

      // Storage area
      const stX = w * 0.55
      const stY = 200

      if (s === 'fanout-write') {
        // Draw N rows in "inbox" storage (one per recipient)
        const n = 6
        drawLabel(p, 'user_inbox (1 write × N rows)', stX, stY - 95, 10, [255, 140, 180])
        for (let i = 0; i < n; i++) {
          const ry = stY - 80 + i * 22
          p.fill(30, 20, 25)
          p.stroke(255, 140, 180)
          p.strokeWeight(1)
          p.rect(stX - 80, ry - 10, 160, 18, 3)
          drawLabel(p, `user_${i + 1} → msg_42`, stX, ry, 8, [255, 180, 200])
        }

        // Arrow from message service
        drawArrow(p, msX + 60, 200, stX - 80, 180, [255, 180, 100, 160])
        for (let i = 0; i < n; i++) {
          const prog = ((t * 0.6 + i * 0.1) % 1)
          const ry = stY - 80 + i * 22
          drawMovingDot(p, msX + 60, 200, stX - 80, ry, prog, [255, 160, 180], 5)
        }

        // Recipients: read directly
        const rx = w * 0.86
        for (let i = 0; i < 3; i++) {
          const ry = 140 + i * 50
          drawBox(p, rx, ry, 90, 26, [30, 40, 25], [160, 220, 140], `Recipient ${i + 1}`, 8)
          drawArrow(p, stX + 80, ry, rx - 45, ry, [160, 220, 140, 120])
          drawLabel(p, 'cheap read', (stX + 80 + rx - 45) / 2, ry - 8, 7, [180, 220, 180])
        }

        // Footer
        drawLabel(p, 'Cost at group of 500: 500 writes per send. Great for 1:1.', w / 2, 380, 10, [255, 180, 200])
      } else if (s === 'fanout-read') {
        // Single message row
        drawLabel(p, 'messages (1 write × 1 row)', stX, stY - 95, 10, [220, 140, 255])
        p.fill(30, 20, 35)
        p.stroke(220, 140, 255)
        p.strokeWeight(1.5)
        p.rect(stX - 80, stY - 60, 160, 26, 3)
        drawLabel(p, 'conv_42.msg_42', stX, stY - 47, 8, [220, 180, 255])

        // Arrow to storage
        drawArrow(p, msX + 60, 200, stX - 80, stY - 47, [255, 180, 100, 160])
        const prog1 = (t * 0.7) % 1
        drawMovingDot(p, msX + 60, 200, stX - 80, stY - 47, prog1, [255, 200, 140])

        // Conversation membership (static)
        p.fill(25, 25, 35)
        p.stroke(180, 180, 220)
        p.strokeWeight(1)
        p.rect(stX - 80, stY, 160, 42, 3)
        drawLabel(p, 'conversation_members', stX, stY + 10, 8, [200, 200, 255])
        drawLabel(p, '(user_1..user_N, last_read_seq)', stX, stY + 24, 7, [180, 180, 220])

        // Recipients: scan + read
        const rx = w * 0.86
        for (let i = 0; i < 3; i++) {
          const ry = 140 + i * 50
          drawBox(p, rx, ry, 90, 26, [30, 40, 25], [160, 220, 140], `Recipient ${i + 1}`, 8)
          drawArrow(p, stX + 80, stY + 20, rx - 45, ry, [200, 140, 255, 120])
          drawLabel(p, 'expensive read', (stX + 80 + rx - 45) / 2 + 5, (stY + 20 + ry) / 2 - 6, 7, [220, 200, 255])
        }

        drawLabel(p, 'Cost at group of 500: 1 write, 500 clients each scan conversation. Expensive at read.', w / 2, 380, 10, [220, 180, 255])
      } else {
        // Hybrid: two paths
        // Small group: write fanout (top)
        p.fill(30, 20, 25)
        p.stroke(255, 140, 180)
        p.strokeWeight(1)
        p.rect(stX - 90, 130, 180, 50, 6)
        drawLabel(p, 'small groups (<50): fanout-on-write', stX, 147, 9, [255, 180, 200])
        drawLabel(p, '→ user_inbox rows per recipient', stX, 162, 8, [220, 180, 200])

        // Large group: read fanout (bottom)
        p.fill(30, 20, 35)
        p.stroke(220, 140, 255)
        p.strokeWeight(1)
        p.rect(stX - 90, 220, 180, 50, 6)
        drawLabel(p, 'large groups (≥50): fanout-on-read', stX, 237, 9, [220, 180, 255])
        drawLabel(p, '→ clients scan messages table', stX, 252, 8, [200, 180, 220])

        // Arrow from MS, branch
        drawArrow(p, msX + 60, 200, stX - 90, 155, [255, 180, 100, 140])
        drawArrow(p, msX + 60, 200, stX - 90, 245, [255, 180, 100, 140])
        drawLabel(p, 'branch on member count', (msX + stX - 90) / 2 - 30, 190, 8, [255, 200, 120])

        // Recipients
        const rx = w * 0.86
        for (let i = 0; i < 3; i++) {
          const ry = 140 + i * 50
          drawBox(p, rx, ry, 90, 26, [30, 40, 25], [160, 220, 140], `Recipient ${i + 1}`, 8)
        }
        drawArrow(p, stX + 90, 155, rx - 45, 140, [255, 140, 180, 140])
        drawArrow(p, stX + 90, 245, rx - 45, 240, [220, 140, 255, 140])

        drawLabel(p, 'Best of both: 1:1s and small groups get fast reads; broadcast channels don\'t explode write volume.', w / 2, 380, 10, [200, 200, 255])
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. Group Chat — Fan-Out Strategies</h2>
      <p className="text-gray-300 leading-relaxed">
        A 1:1 chat and a 500-person group can't use the same strategy. The choice is where to
        pay the cost: at write time (duplicate into every recipient's inbox) or at read time
        (single row, every recipient scans).
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Strategy:</span>
            {(['fanout-write', 'fanout-read', 'hybrid'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStrategy(st)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  strategy === st
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Fan-out on write</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Duplicate the message into every recipient's per-user inbox. Reads are a direct key
            lookup on the recipient's inbox — extremely fast. Write amplification is O(group
            size). Great for 1:1s and small groups; catastrophic for large broadcast groups.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Fan-out on read</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Store one row per message, keyed by conversation_id. Recipients query the
            conversation's messages directly. Writes are O(1). Reads are O(messages since last
            check) × O(conversations) — ugly at fan-in. Used for large broadcast channels.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Hybrid (production)</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Most systems branch on group size: fan-out-on-write for &lt;50 members,
            fan-out-on-read for larger. Twitter solved the same problem for celebrity followers
            this way. The threshold is tuned per system.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Real-time delivery is orthogonal:</strong>{' '}
          fan-out strategies are about <em>storage</em>, not WebSocket push. The live push is
          always "look up each recipient's gateway in Redis and send the message." Storage
          decides where the message lives for history and offline delivery.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 13 -- Presence & Ephemeral State                           */
/* ================================================================== */

function PresenceSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Presence &amp; typing via Redis Pub/Sub: never persisted, never acked', w / 2, 22, 12, [255, 255, 255])

      // Gateway A (Alice typing)
      const gwAX = w * 0.15
      drawBox(p, gwAX, 140, 130, 36, [35, 45, 30], [160, 220, 140], 'Gateway-A', 10)

      // Alice
      drawBox(p, gwAX, 70, 70, 28, [20, 40, 70], [100, 180, 255], 'Alice (typing)', 8)
      drawArrow(p, gwAX, 84, gwAX, 122, [100, 180, 255, 160])

      // Redis Pub/Sub
      const redisX = w * 0.5
      drawBox(p, redisX, 140, 160, 46, [60, 30, 30], [255, 120, 120], 'Redis Pub/Sub', 11)
      drawLabel(p, 'channel: conv_42', redisX, 157, 8, [255, 180, 180])

      // Gateway A publishes
      drawArrow(p, gwAX + 65, 140, redisX - 80, 140, [255, 140, 140, 180])
      const pp1 = (t * 0.8) % 1
      drawMovingDot(p, gwAX + 65, 140, redisX - 80, 140, pp1, [255, 160, 160])
      drawLabel(p, 'PUBLISH', (gwAX + redisX) / 2 - 30, 124, 9, [255, 180, 180])

      // Multiple recipient gateways
      const gws: { x: number; y: number }[] = [
        { x: w * 0.82, y: 70 },
        { x: w * 0.88, y: 140 },
        { x: w * 0.82, y: 210 },
      ]
      for (let i = 0; i < gws.length; i++) {
        const g = gws[i]
        drawBox(p, g.x, g.y, 120, 30, [35, 45, 30], [160, 220, 140], `Gateway-${String.fromCharCode(66 + i)}`, 8)
        drawArrow(p, redisX + 80, 140, g.x - 60, g.y, [255, 140, 140, 140])
        const prog = ((t * 0.7 + i * 0.15) % 1)
        drawMovingDot(p, redisX + 80, 140, g.x - 60, g.y, prog, [255, 180, 180], 6)
      }

      // Labels: SUBSCRIBE
      drawLabel(p, 'SUBSCRIBE conv_42', redisX + 90, 105, 8, [255, 180, 180], 'left')
      drawLabel(p, '(one subscriber per active conv on each gateway)', redisX + 20, 185, 8, [220, 180, 180])

      // Explanation box at bottom
      p.fill(30, 30, 50, 220)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, 260, w - 80, 100, 6)

      drawLabel(p, 'Why Redis Pub/Sub (fire-and-forget) is perfect here:', w / 2, 275, 10, [255, 255, 255])
      drawLabel(p, '• If Bob is offline, he does not care that Alice is typing (typing has no past).', w / 2, 295, 9, [220, 220, 220])
      drawLabel(p, '• If the publish is lost, the next keystroke re-publishes within ~1s.', w / 2, 312, 9, [220, 220, 220])
      drawLabel(p, '• Zero persistence cost: a 200K events/sec storm does not hit any database.', w / 2, 329, 9, [220, 220, 220])
      drawLabel(p, '• Same mechanism handles online/offline, typing, live cursors, call signaling.', w / 2, 346, 9, [220, 220, 220])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Presence, Typing &amp; Ephemeral State</h2>
      <p className="text-gray-300 leading-relaxed">
        The second-largest chunk of traffic in a messaging system isn't messages — it's{' '}
        <em>ephemera</em>: "typing...", online dots, last-seen updates, read receipts. A naive
        implementation (write every event to the durable store and fan out through the same
        pipeline as messages) would multiply database load by 10x for information that is{' '}
        <em>irrelevant five seconds later</em>.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Online / offline presence</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            On connect: gateway writes{' '}
            <code className="text-pink-400">user:{'<id>'}:online = true</code> with TTL 60s +
            heartbeat refreshes. On disconnect: DEL + PUBLISH{' '}
            <code className="text-pink-400">offline</code> on a <code className="text-pink-400">user:{'<id>'}:presence</code>{' '}
            channel. Interested parties (anyone in a conversation with this user) SUBSCRIBE.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Typing indicators</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Client emits a <code className="text-pink-400">typing</code> event every ~3s while
            the keyboard is active. Gateway publishes to{' '}
            <code className="text-pink-400">conv:{'<id>'}:typing</code>. Subscribers show "…"
            for a window of 5s; if no new typing event arrives, they hide it. Never stored.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Last-seen gotcha:</strong> "last seen at X" is
          persisted (users scroll back days later), but <em>online now</em> is ephemeral. On
          connect the gateway updates <code className="text-pink-400">users.last_seen</code>{' '}
          in the SQL store once; on disconnect it updates again. In between, presence is all
          in Redis.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 14 -- Offline Delivery & Push                              */
/* ================================================================== */

function OfflineSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">14. Offline Delivery &amp; Push Notifications</h2>
      <p className="text-gray-300 leading-relaxed">
        Most users are offline most of the time. The system's behavior when the recipient is
        disconnected is where durability promises are actually tested.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">1 — Registry miss → enqueue</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The message service looks up the recipient in Redis; TTL expired (no active
            gateway). The message is already in <code className="text-pink-400">messages</code>{' '}
            — for fan-out-on-write systems the per-user inbox row was also written. For
            read-fanout, the client will find the message on next fetch. Either way: no data loss.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">2 — Trigger push notification</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The Push Fanout Service consumes the Kafka message event. For each recipient
            without an active gateway, it looks up the device's push token (APNS for iOS, FCM
            for Android, WNS for Windows) and sends a small alert. Push payloads don't include
            the full message (E2E encrypted!) — just "Alice sent you a message" + a trigger for
            the app to fetch.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">3 — Reconnect &amp; replay</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            When Bob reopens the app, the client reconnects, sends{' '}
            <code className="text-pink-400">&#123;conv_id: last_seq_acked&#125;</code> for each
            conversation. The gateway queries the message store for seqs after those cursors
            and streams them down the new socket. Phone buzzes; UI catches up.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-rose-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">4 — Multi-device replay</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            If Bob has a phone and a laptop, each is an independent subscriber with its own
            cursor. The phone may already have message 42 while the laptop needs it — no
            coordination needed; each device syncs independently from the message store.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">APNS/FCM are not reliable channels:</strong> push
          providers drop notifications under load, batch aggressively, and silently kill badly
          behaved apps. Treat them as best-effort <em>wake-up taps</em>, not as a replacement
          for the message store. The phrase "my WhatsApp notifications are delayed" is usually
          APNS, not WhatsApp.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 15 -- Media, E2E Encryption                                */
/* ================================================================== */

function MediaAndE2ESection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">15. Media &amp; End-to-End Encryption</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Media (images, video, voice, files)</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Never send media bytes over the WebSocket. The flow is:
          </p>
          <ul className="list-decimal list-inside text-gray-300 text-sm mt-2 space-y-1 leading-relaxed">
            <li>Client requests a presigned S3 URL from the API service</li>
            <li>Client PUTs the (encrypted) bytes directly to S3</li>
            <li>Client sends a normal message with <code className="text-pink-400">attachment: {'{s3_key, mime, size}'}</code></li>
            <li>Recipients' clients GET from CloudFront CDN using the s3_key</li>
            <li>Thumbnails generated by an async Lambda on S3 put-events and written back as an additional attachment</li>
          </ul>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            At 100M users, CDN egress dominates cost. Aggressive compression, transcoding
            (H.265 for video), and edge caching are mandatory.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">End-to-End Encryption (Signal Protocol)</p>
          <p className="text-gray-300 text-sm leading-relaxed mb-2">
            WhatsApp, Signal, and iMessage use variants of the Signal Protocol. In short:
          </p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 leading-relaxed">
            <li><strong className="text-white">Identity keys:</strong> long-term Curve25519 keys per device, published to a key directory</li>
            <li><strong className="text-white">Prekeys:</strong> a stash of short-term keys per device, used to bootstrap sessions while the recipient is offline</li>
            <li><strong className="text-white">X3DH:</strong> triple-Diffie-Hellman handshake to derive a shared session key from one online and one offline participant</li>
            <li><strong className="text-white">Double Ratchet:</strong> per-message key rotation that provides forward secrecy (losing today's key doesn't expose yesterday's messages)</li>
            <li><strong className="text-white">Group messaging:</strong> Sender Keys — each sender maintains a symmetric key distributed pairwise to every recipient</li>
          </ul>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            From the server's perspective, the message body is opaque bytes. The server
            still sees metadata: who messaged whom, when, and in what sizes — which is why
            Signal invests so much in minimizing server metadata.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">What E2E costs the server:</strong> the server can
          no longer do spam detection on message content, no server-side search, no
          content-based push previews. WhatsApp ships these in-app (client-side search, OCR,
          translation) rather than giving them up.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 16 -- Partitioning & Scaling                               */
/* ================================================================== */

function PartitioningSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">16. Partitioning &amp; Scaling to 100M Users</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Gateway tier</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Stateless per-request, stateful per-connection. Add nodes linearly: 50K sockets per
            node × 600 nodes = 30M. Auto-scale based on active socket count, not CPU.
            Multi-region: the LB is anycast (AWS Global Accelerator / Cloudflare) routing to
            the nearest region's gateway.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Messages table (Cassandra)</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Partition key <code className="text-pink-400">conversation_id</code>, clustering key{' '}
            <code className="text-pink-400">seq DESC</code>. This keeps all of a conversation's
            messages on one node — reads are a single range scan. Hot partitions (viral group
            chats, celebrity broadcast channels) are split manually with a{' '}
            <code className="text-pink-400">(conversation_id, hour_bucket)</code> compound key
            when they cross ~10 MB/hr.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">user_inbox table</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Partition by <code className="text-pink-400">user_id</code>. At 30M connections
            pushing ~1M deliveries/sec, inbox writes are the highest-volume hot path. Cassandra
            with LeveledCompaction and TTL after 30 days (unread messages get cleaned up; read
            ones are already in the messages table).
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Redis (connection registry + presence + typing)</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Redis Cluster with ~256 shards, partitioned by user_id hash. Every gateway
            maintains connections to all shards. Memory sizing: 30M entries × 200B = 6 GB
            total — fits easily. Pub/Sub channels do not shard cleanly, so we run separate
            pub/sub-only Redis per region and use keyspace notifications sparingly.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Multi-region</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Users connect to their nearest region's gateway. Cassandra runs multi-DC replication
            with LOCAL_QUORUM writes (acceptable — cross-region messages replicate
            asynchronously, usually within 100 ms). The conversation's "home region" is pinned
            to its primary members' region, so cross-region chats have one hop added. Active-
            active works because per-conversation ordering is local (seq is per-conversation,
            not global).
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 17 -- Tradeoffs                                            */
/* ================================================================== */

function TradeoffsSection() {
  const tradeoffs = [
    {
      chose: 'Persistent WebSocket per user',
      over: 'HTTP long-polling',
      because:
        'At 30M concurrent users, polling even every 10s is 3M QPS of mostly-empty responses. Persistent sockets shift the cost to memory (~16 KB/conn) and a single TCP stream per user. It costs more infrastructure knowledge but is 10x cheaper at steady state.',
      color: 'border-blue-600',
    },
    {
      chose: 'Per-conversation seq numbers',
      over: 'Global monotonic message IDs',
      because:
        'A global counter is a write bottleneck at 200K msg/sec. Per-conversation seq is what users perceive as "order", requires no cross-shard coordination, and lets messages shard by conversation_id. The price is no canonical global timeline.',
      color: 'border-amber-600',
    },
    {
      chose: 'Client-generated idempotency IDs',
      over: 'Server-generated IDs with server-side dedup',
      because:
        'Client retries happen all the time (flaky mobile networks). If the server picks IDs, a retry with the same content creates a duplicate. Moving the ID generation to the client makes retries trivially safe. The cost is trusting the client to generate a unique ID; UUIDv4 is good enough.',
      color: 'border-green-600',
    },
    {
      chose: 'Hybrid fan-out (write for small, read for large)',
      over: 'Single fan-out strategy',
      because:
        'Uniform write-fanout blows up on celebrity / broadcast groups (1 send = 500K writes). Uniform read-fanout is slow for 1:1 chats that dominate volume. Branching on group size gets the best of both at the cost of codebase complexity. Same reason Twitter has two feed paths.',
      color: 'border-pink-600',
    },
    {
      chose: 'Redis Pub/Sub for presence / typing',
      over: 'Durable storage for every ephemeral event',
      because:
        'Typing events are 10x the rate of messages and uninteresting five seconds later. Redis Pub/Sub is fire-and-forget, in-memory, microseconds of latency. A lost typing event is invisible to users. Persisting them would triple the database load for zero user value.',
      color: 'border-red-600',
    },
    {
      chose: 'Kafka between ingest and fan-out',
      over: 'Direct service-to-service calls',
      because:
        "If the Message Service called Push Fanout synchronously, a slow APNS upstream would slow every send. Kafka decouples them: sends commit to Kafka, fan-out is async. It also enables replay (bug fix) and multiple consumers (analytics, archive, anti-spam) without touching the hot path.",
      color: 'border-purple-600',
    },
    {
      chose: 'Server ack after durable write (not after fan-out)',
      over: 'Ack only after all recipients are reached',
      because:
        'Acking after fan-out would gate Alice\'s UI on the slowest recipient. Acking after Cassandra+Kafka makes the send feel instant and keeps durability honest — once the ack comes back, the message will arrive. Fan-out is async; recipients see it when they see it.',
      color: 'border-cyan-600',
    },
    {
      chose: 'End-to-end encryption (Signal Protocol)',
      over: 'Server-side encryption only',
      because:
        'E2E means the server cannot read. That rules out server-side spam filters, message search, and content-based features. The win is meaningful: even a subpoena of the entire message store reveals nothing about contents. WhatsApp moved the tradeoff to the client (in-app search, on-device ML) rather than giving up.',
      color: 'border-rose-600',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">17. Tradeoffs and Design Choices</h2>
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
          <strong className="text-yellow-400">The hard parts, in order:</strong> (1) persistent
          connections at scale — almost nobody gets this right on the first try; (2) per-
          conversation ordering across retries and multi-device; (3) the fan-out choice for
          groups; (4) the metadata you leak through push notifications and connection patterns.
          Everything else — storage, CDNs, auth — is solved infrastructure.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignRealtimeMessaging() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">
          Design a Real-Time Messaging App (100M users)
        </h1>
        <p className="text-lg text-gray-400">
          How WhatsApp, Messenger, iMessage, and Signal deliver a billion messages a day —
          persistent WebSockets, per-conversation ordering, hybrid fan-out, ephemeral presence,
          and end-to-end encryption, combined into a sub-second real-time system.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <DataModelSection />
      <ArchitectureSection />
      <ConnectionLayerSection />
      <WritePathSection />
      <KafkaBackboneSection />
      <OrderingSection />
      <GroupFanoutSection />
      <PresenceSection />
      <OfflineSection />
      <MediaAndE2ESection />
      <PartitioningSection />
      <TradeoffsSection />
    </div>
  )
}
