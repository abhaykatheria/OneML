import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-notification-service',
  title: 'Design a Notification Service',
  description:
    'Multi-channel notifications at 100M-user scale: push/email/SMS/webhook adapters, retries with exponential backoff, deduplication, rate shaping for broadcasts, preferences, and compliance',
  track: 'systems',
  order: 27,
  tags: [
    'notification-service',
    'push',
    'email',
    'sms',
    'webhook',
    'rate-limiting',
    'compliance',
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
        Design a <strong className="text-white">notification service</strong> that every other
        backend in the company can call to reach users across{' '}
        <strong className="text-white">push (APNS, FCM), email, SMS, in-app, and webhook</strong>{' '}
        channels — at the scale of 100M users, with bursts to tens of millions when a marketing
        broadcast fires. This is OneSignal, AWS SNS + Pinpoint, Twilio Notify, Airship — the
        infrastructure no product team wants to build twice.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The deceptive thing about notifications is that "send a push" sounds trivial. The real
        complexity lives in the margins:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li><strong className="text-white">Multiple channels per user</strong> with per-category preferences</li>
        <li><strong className="text-white">Providers fail in provider-specific ways</strong> (APNS drops, SES bounces, Twilio throttles)</li>
        <li><strong className="text-white">Retries must not duplicate</strong> — sending one security code twice is worse than sending zero</li>
        <li><strong className="text-white">Broadcasts must not overwhelm providers</strong> — 100M pushes to APNS in one second gets you rate-limited at the edge</li>
        <li><strong className="text-white">Quiet hours, timezones, unsubscribe, compliance</strong> — the system has to respect every one of them, every time</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The service sees two very different workloads. Transactional sends — password resets,
        order confirmations, security codes — need sub-second latency for a handful of recipients.
        Marketing and broadcast sends need throughput into the millions over minutes. The system
        has to handle both without letting one starve the other.
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
        <li><strong className="text-white">Send to a single user</strong> on one or many channels (transactional path)</li>
        <li><strong className="text-white">Broadcast to a segment</strong> of up to 100M users (marketing path)</li>
        <li><strong className="text-white">Channel support:</strong> push (APNS, FCM, Huawei, Web Push), email (SES, SendGrid), SMS (Twilio, Vonage), in-app (via the app's WebSocket), webhook (to Slack, Teams, arbitrary HTTP endpoints)</li>
        <li><strong className="text-white">Templates</strong> with variable substitution, localization, and per-channel rendering (push is 4 lines, email is HTML, SMS is 160 chars)</li>
        <li><strong className="text-white">Scheduled sends</strong> — "deliver this at 9am local time tomorrow"</li>
        <li><strong className="text-white">User preferences</strong> per (channel × category), with global opt-outs and suppression lists</li>
        <li><strong className="text-white">Rate limiting &amp; deduplication</strong> — no more than N of category X per user per window; dedupe near-identical sends</li>
        <li><strong className="text-white">Quiet hours</strong> per user timezone for non-critical categories</li>
        <li><strong className="text-white">Retries with exponential backoff</strong>; dead-letter queue for poison messages</li>
        <li><strong className="text-white">Delivery tracking:</strong> queued → sent → delivered → opened → clicked → bounced → complained</li>
        <li><strong className="text-white">Unsubscribe:</strong> one-click from email (CAN-SPAM), app-level opt-out, global suppression</li>
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
              <td className="py-2 px-4 font-medium">P50 latency (transactional)</td>
              <td className="py-2 px-4">&lt; 1s from API call to provider accept</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">P99 latency (transactional)</td>
              <td className="py-2 px-4">&lt; 5s</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Broadcast completion</td>
              <td className="py-2 px-4">100M recipients delivered in 5-10 minutes (rate-shaped)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Sustained throughput</td>
              <td className="py-2 px-4">50K notifications/sec baseline</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Burst throughput</td>
              <td className="py-2 px-4">500K notifications/sec during broadcasts</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Availability</td>
              <td className="py-2 px-4">99.99% (each channel isolated — Twilio outage doesn't kill email)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Delivery guarantee</td>
              <td className="py-2 px-4">At-least-once, with exactly-once UX via client_event_id dedup</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Compliance</td>
              <td className="py-2 px-4">GDPR, CAN-SPAM, TCPA (US SMS), regional data residency</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Observability</td>
              <td className="py-2 px-4">Per-channel per-tenant dashboards; delivery funnel (queued→delivered→opened)</td>
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
        <p className="text-white font-bold font-sans">Volume</p>
        <p>100M users × 5 notifications/day avg = <span className="text-green-400">500M/day</span></p>
        <p>500M / 86400s = ~6K/sec avg, <span className="text-yellow-400">~50K/sec peak</span></p>

        <p className="text-white font-bold font-sans pt-2">A broadcast</p>
        <p>100M recipients × 1 push = <span className="text-green-400">100M events</span></p>
        <p>Rate-shape at 500K/sec → <span className="text-yellow-400">~3.3 minutes to drain</span></p>
        <p>APNS accepts ~9K/sec per connection → we need <span className="text-yellow-400">~55 parallel APNS connections</span> for that shape</p>

        <p className="text-white font-bold font-sans pt-2">Payload / bandwidth</p>
        <p>Push avg 500B × 50K/sec = <span className="text-green-400">~25 MB/s ingress</span></p>
        <p>Email avg 30KB × 5K/sec = <span className="text-green-400">~150 MB/s (dominated by HTML + attachments)</span></p>

        <p className="text-white font-bold font-sans pt-2">Storage</p>
        <p>500M deliveries/day × 400B metadata = <span className="text-green-400">~200 GB/day delivery log</span></p>
        <p>Hot (30d) + cold (1y) = <span className="text-green-400">~80 TB</span></p>
        <p>Templates + segments + preferences: modest (~100 GB total)</p>

        <p className="text-white font-bold font-sans pt-2">Worker sizing (per channel)</p>
        <p>Push workers: 50K/sec ÷ 2K/sec/worker = <span className="text-green-400">~25 push workers baseline, ~250 at burst</span></p>
        <p>Email workers: 5K/sec ÷ 200/sec/worker = <span className="text-green-400">~25 email workers baseline</span></p>
        <p>SMS workers: bottlenecked by Twilio quota, not our fleet size</p>
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
        A small, opinionated REST surface. Sends are async: the API returns a{' '}
        <code className="text-pink-400">notification_id</code> immediately and the status is
        available via a separate GET or webhook callback.
      </p>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold">// 1. Transactional send (single or small set)</p>
        <p>POST /v1/notifications</p>
        <p>&#123;</p>
        <p>  client_event_id: &quot;uuid-v4&quot;,     <span className="text-gray-500">// idempotency key (required)</span></p>
        <p>  user_id: &quot;usr_123&quot;,</p>
        <p>  template_id: &quot;order.shipped.v2&quot;,</p>
        <p>  category: &quot;transactional&quot;,    <span className="text-gray-500">// determines preferences + priority</span></p>
        <p>  variables: &#123; order_id, eta, tracking_url &#125;,</p>
        <p>  channels: [&quot;push&quot;, &quot;email&quot;],  <span className="text-gray-500">// optional; template has defaults</span></p>
        <p>  send_at: &quot;2026-04-20T14:00:00Z&quot;  <span className="text-gray-500">// optional; omit = now</span></p>
        <p>&#125;</p>
        <p>→ 202 &#123; notification_id, status: &quot;queued&quot; &#125;</p>

        <p className="text-white font-bold pt-2">// 2. Broadcast to a segment</p>
        <p>POST /v1/broadcasts</p>
        <p>&#123;</p>
        <p>  client_event_id,</p>
        <p>  segment_id: &quot;seg_active_us_android&quot;,</p>
        <p>  template_id, variables,</p>
        <p>  rate_limit_per_sec: 500000,   <span className="text-gray-500">// default 100K</span></p>
        <p>  send_at: &quot;2026-04-20T09:00:00-07:00&quot;   <span className="text-gray-500">// local-time aware</span></p>
        <p>&#125;</p>
        <p>→ 202 &#123; broadcast_id, estimated_duration_sec, estimated_recipients &#125;</p>

        <p className="text-white font-bold pt-2">// 3. Preferences</p>
        <p>GET /v1/users/&#123;id&#125;/preferences</p>
        <p>PUT /v1/users/&#123;id&#125;/preferences</p>
        <p>&#123;</p>
        <p>  channels: &#123;</p>
        <p>    email: &#123; marketing: false, transactional: true, security: true &#125;,</p>
        <p>    push:  &#123; marketing: true,  transactional: true, security: true &#125;,</p>
        <p>    sms:   &#123; marketing: false, transactional: false, security: true &#125;</p>
        <p>  &#125;,</p>
        <p>  quiet_hours: &#123; start: &quot;22:00&quot;, end: &quot;08:00&quot;, timezone: &quot;America/Los_Angeles&quot; &#125;</p>
        <p>&#125;</p>

        <p className="text-white font-bold pt-2">// 4. Device registration (push tokens)</p>
        <p>POST /v1/users/&#123;id&#125;/devices</p>
        <p>&#123; device_id, platform: &quot;ios&quot;, push_token, app_version &#125;</p>

        <p className="text-white font-bold pt-2">// 5. Status lookup</p>
        <p>GET /v1/notifications/&#123;id&#125;</p>
        <p>→ &#123; status, attempts, delivered_at, opened_at, failures[] &#125;</p>

        <p className="text-white font-bold pt-2">// 6. Provider callbacks (inbound webhooks)</p>
        <p>POST /internal/callbacks/apns</p>
        <p>POST /internal/callbacks/ses   <span className="text-gray-500">// bounces, complaints</span></p>
        <p>POST /internal/callbacks/twilio  <span className="text-gray-500">// delivered, failed</span></p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Idempotency is non-negotiable:</strong> the caller
          provides <code className="text-pink-400">client_event_id</code> on every send. If the
          caller's network flakes and the API is called twice with the same id, the second call
          returns the first result instead of creating a duplicate send. Without this, a retrying
          caller sends the same security code twice, and users lose trust in the product.
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
              <th className="py-2 px-3 text-white">Partition</th>
              <th className="py-2 px-3 text-white">Storage</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 text-xs">
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-blue-400">users</td>
              <td className="py-2 px-3">user_id, email, phone, timezone, locale, country</td>
              <td className="py-2 px-3">user_id</td>
              <td className="py-2 px-3">SQL (synced from customer's user service)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-cyan-400">devices</td>
              <td className="py-2 px-3">(user_id, device_id), platform, push_token, app_version, last_seen</td>
              <td className="py-2 px-3">user_id</td>
              <td className="py-2 px-3">SQL or Cassandra</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-emerald-400">preferences</td>
              <td className="py-2 px-3">user_id, channel, category, enabled, quiet_hours_json</td>
              <td className="py-2 px-3">user_id</td>
              <td className="py-2 px-3">SQL (read-heavy, small rows)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-amber-400">templates</td>
              <td className="py-2 px-3">template_id, version, channel, locale, body (mustache), metadata</td>
              <td className="py-2 px-3">template_id</td>
              <td className="py-2 px-3">Postgres + aggressive edge caching</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-orange-400">notifications</td>
              <td className="py-2 px-3">notification_id, user_id, template_id, category, client_event_id, created_at</td>
              <td className="py-2 px-3">notification_id (hash)</td>
              <td className="py-2 px-3">Cassandra (append-heavy)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-purple-400">deliveries</td>
              <td className="py-2 px-3">(notification_id, channel) (pk), provider, status, attempts</td>
              <td className="py-2 px-3">notification_id</td>
              <td className="py-2 px-3">Cassandra (one row per recipient × channel)</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-pink-400">delivery_events</td>
              <td className="py-2 px-3">delivery_id, event_type, ts, provider_payload</td>
              <td className="py-2 px-3">delivery_id</td>
              <td className="py-2 px-3">Cassandra with 30d TTL; aggregated to warehouse</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-rose-400">suppression_list</td>
              <td className="py-2 px-3">(user_id or email_hash), reason (unsub / bounce / complaint), added_at</td>
              <td className="py-2 px-3">hash of identifier</td>
              <td className="py-2 px-3">SQL (every send checks this — kept small, indexed)</td>
            </tr>
            <tr className="align-top">
              <td className="py-2 px-3 font-medium text-violet-400">idempotency_keys</td>
              <td className="py-2 px-3">client_event_id, notification_id, created_at (TTL 24h)</td>
              <td className="py-2 px-3">client_event_id (hash)</td>
              <td className="py-2 px-3">Redis or DynamoDB w/ TTL</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why deliveries is separate from notifications:</strong>{' '}
          one notification fans out to 1–5 channels per user, plus retries per channel. The
          deliveries table carries per-channel state (attempts, provider-message-id, status)
          so the notifications row stays immutable once created — an audit record. The deliveries
          row is the thing the workers update.
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
      p.createCanvas(w, 540)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Notification pipeline: ingest → filter → render → route → deliver', w / 2, 22, 12, [255, 255, 255])

      // Layer 1: Callers (API clients)
      const callerY = 70
      const callers = ['Order Svc', 'Auth Svc', 'Marketing', 'Partner API']
      for (let i = 0; i < callers.length; i++) {
        const x = w * (0.1 + i * 0.21)
        drawBox(p, x, callerY, 105, 28, [20, 40, 70], [100, 180, 255], callers[i], 9)
      }

      // Layer 2: API / Orchestrator
      const apiY = 150
      drawBox(p, w / 2, apiY, 320, 38, [40, 35, 60], [200, 160, 255], 'Notification API + Orchestrator', 11)

      // Arrows callers → API
      for (let i = 0; i < callers.length; i++) {
        const x = w * (0.1 + i * 0.21)
        drawArrow(p, x, callerY + 14, w / 2 - 130 + i * 85, apiY - 19, [100, 180, 255, 130])
      }

      // Layer 3: Filter pipeline (horizontal chain)
      const filterY = 240
      const filters: { label: string; x: number; color: RGB }[] = [
        { label: 'Preference\nCheck', x: w * 0.1, color: [120, 220, 180] },
        { label: 'Suppression', x: w * 0.28, color: [255, 180, 120] },
        { label: 'Dedup +\nRate Limit', x: w * 0.46, color: [255, 140, 180] },
        { label: 'Quiet Hours', x: w * 0.64, color: [180, 180, 240] },
        { label: 'Template\nRender', x: w * 0.82, color: [255, 220, 120] },
      ]

      for (const f of filters) {
        drawBox(
          p,
          f.x,
          filterY,
          130,
          46,
          [f.color[0] * 0.18, f.color[1] * 0.18, f.color[2] * 0.18],
          f.color,
          f.label.split('\n')[0],
          9,
        )
        drawLabel(p, f.label.split('\n')[1] ?? '', f.x, filterY + 12, 8, f.color)
      }

      // API -> first filter
      drawArrow(p, w / 2 - 100, apiY + 19, filters[0].x, filterY - 23, [200, 160, 255, 140])

      // Sequential filter arrows
      for (let i = 0; i < filters.length - 1; i++) {
        drawArrow(p, filters[i].x + 65, filterY, filters[i + 1].x - 65, filterY, [200, 200, 200, 120])
        const prog = ((t * 0.6 + i * 0.12) % 1)
        drawMovingDot(p, filters[i].x + 65, filterY, filters[i + 1].x - 65, filterY, prog, [255, 220, 140], 5)
      }

      // Layer 4: Channel Routers (branch out from last filter)
      const routerY = 360
      const routers: { label: string; x: number; color: RGB }[] = [
        { label: 'Push Router', x: w * 0.12, color: [120, 220, 140] },
        { label: 'Email Router', x: w * 0.32, color: [255, 180, 100] },
        { label: 'SMS Router', x: w * 0.52, color: [255, 140, 180] },
        { label: 'Webhook Rt', x: w * 0.72, color: [200, 140, 255] },
        { label: 'In-App Rt', x: w * 0.92, color: [140, 220, 220] },
      ]

      for (const r of routers) {
        drawBox(
          p,
          r.x,
          routerY,
          115,
          32,
          [r.color[0] * 0.18, r.color[1] * 0.18, r.color[2] * 0.18],
          r.color,
          r.label,
          9,
        )
      }

      // Template render -> routers (fan-out)
      for (const r of routers) {
        drawArrow(p, filters[4].x, filterY + 23, r.x, routerY - 16, [255, 220, 120, 110])
      }
      const activeRouter = Math.floor((t * 0.4) % routers.length)
      const rprog = (t * 0.8) % 1
      drawMovingDot(
        p,
        filters[4].x,
        filterY + 23,
        routers[activeRouter].x,
        routerY - 16,
        rprog,
        routers[activeRouter].color,
      )

      // Layer 5: Providers (under each router)
      const provY = 450
      const providers: { x: number; label: string; color: RGB }[] = [
        { x: w * 0.12, label: 'APNS / FCM', color: [120, 220, 140] },
        { x: w * 0.32, label: 'SES / SendGrid', color: [255, 180, 100] },
        { x: w * 0.52, label: 'Twilio / Vonage', color: [255, 140, 180] },
        { x: w * 0.72, label: 'HTTP endpoints', color: [200, 140, 255] },
        { x: w * 0.92, label: 'WS gateway', color: [140, 220, 220] },
      ]
      for (const pv of providers) {
        drawBox(p, pv.x, provY, 115, 30, [25, 25, 35], pv.color, pv.label, 8)
      }
      for (let i = 0; i < routers.length; i++) {
        drawArrow(p, routers[i].x, routerY + 16, providers[i].x, provY - 15, [routers[i].color[0], routers[i].color[1], routers[i].color[2], 130])
      }

      // Side: Kafka event bus (async) — draw on right side with dashed lines from orchestrator/routers to it
      const kafkaX = w - 50
      const kafkaY = 320
      p.fill(40, 20, 30)
      p.stroke(255, 120, 160)
      p.strokeWeight(2)
      p.rect(kafkaX - 40, kafkaY - 60, 70, 120, 6)
      drawLabel(p, 'Kafka', kafkaX - 5, kafkaY - 40, 10, [255, 160, 190])
      drawLabel(p, 'event bus', kafkaX - 5, kafkaY - 25, 8, [220, 140, 170])
      drawLabel(p, 'status /', kafkaX - 5, kafkaY + 8, 7, [220, 140, 170])
      drawLabel(p, 'callbacks /', kafkaX - 5, kafkaY + 20, 7, [220, 140, 170])
      drawLabel(p, 'analytics', kafkaX - 5, kafkaY + 32, 7, [220, 140, 170])

      // Dashed lines from API + routers to Kafka
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([3, 3])
      p.stroke(255, 140, 180, 100)
      p.strokeWeight(1)
      p.line(w / 2 + 160, apiY, kafkaX - 40, kafkaY - 40)
      for (const r of routers) {
        p.line(r.x + 50, routerY, kafkaX - 40, kafkaY + 20)
      }
      ctx.setLineDash([])

      // Footer
      drawLabel(p, 'Kafka carries: notification.queued · delivery.attempted · delivery.settled · provider.callback', w / 2, 520, 9, [220, 180, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        A single notification flows through five horizontal stages. Each stage is stateless and
        horizontally scalable. The ordering of the filter pipeline is deliberate — cheap
        preference checks before expensive template rendering, and template rendering before
        per-channel routing.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Why the filter order matters</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Preference → suppression → dedup/rate-limit → quiet hours → render. Everything that
            can reject the notification runs <em>before</em> template rendering. Rendering is
            the most CPU-expensive step; dropping a message after rendering is pure waste.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Why channel isolation</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Each channel has its own router, worker pool, Kafka topic, and rate-limit budget.
            If Twilio throttles, SMS falls behind — email and push are untouched. The
            orchestrator doesn't block on any single channel; it fans a message into N channel
            topics and moves on.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Kafka in this design:</strong> every channel
          router writes the prepared payload to a per-channel Kafka topic (e.g.{' '}
          <code className="text-pink-400">push.queued</code>,{' '}
          <code className="text-pink-400">email.queued</code>). Worker pools consume from their
          topic and call providers. Provider callbacks (APNS feedback, SES bounces, Twilio
          status) land on <code className="text-pink-400">provider.callback</code> and update
          the deliveries table plus the suppression list. Kafka decouples send from delivery
          tracking and lets each stage scale independently.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Channel Adapters & Circuit Breakers                    */
/* ================================================================== */

function ChannelAdaptersSection() {
  const [breakerState, setBreakerState] = useState<'closed' | 'open' | 'half-open'>('closed')
  const breakerRef = useRef(breakerState)
  breakerRef.current = breakerState

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

      const bs = breakerRef.current

      drawLabel(p, 'Channel adapters: one interface, many provider SDKs, all isolated by circuit breaker', w / 2, 22, 11, [255, 255, 255])

      // Router (source)
      const routerX = w * 0.1
      drawBox(p, routerX, 210, 110, 44, [30, 45, 30], [160, 220, 140], 'Push Router', 10)
      drawLabel(p, '(reads Kafka)', routerX, 232, 8, [180, 220, 180])

      // Worker + Adapter (boxed)
      const workerX = w * 0.36
      const workerY = 210
      p.fill(30, 30, 45)
      p.stroke(140, 180, 220)
      p.strokeWeight(1.5)
      p.rect(workerX - 95, workerY - 80, 190, 160, 8)
      drawLabel(p, 'Push Worker', workerX, workerY - 62, 10, [180, 220, 255])

      // Circuit breaker state indicator
      const breakerColor: RGB =
        bs === 'closed' ? [120, 220, 140] : bs === 'open' ? [255, 120, 120] : [255, 200, 100]
      p.fill(breakerColor[0] * 0.2, breakerColor[1] * 0.2, breakerColor[2] * 0.2)
      p.stroke(breakerColor[0], breakerColor[1], breakerColor[2])
      p.strokeWeight(2)
      p.rect(workerX - 80, workerY - 40, 160, 30, 6)
      drawLabel(
        p,
        bs === 'closed' ? 'Circuit: CLOSED (healthy)' : bs === 'open' ? 'Circuit: OPEN (failing fast)' : 'Circuit: HALF-OPEN (probing)',
        workerX,
        workerY - 25,
        9,
        breakerColor,
      )

      // Adapter
      drawBox(p, workerX, workerY + 15, 150, 28, [25, 25, 35], [200, 200, 255], 'APNS adapter', 9)
      drawLabel(p, '(HTTP/2 + JWT)', workerX, workerY + 33, 7, [180, 180, 220])

      // Retry indicator as clean centered text inside worker box
      drawLabel(p, '↻ retry with exponential backoff', workerX, workerY + 60, 8, [255, 200, 120])

      // Arrow Router -> Worker
      drawArrow(p, routerX + 55, workerY, workerX - 95, workerY - 30, [160, 220, 140, 160])
      const prog = (t * 0.7) % 1
      drawMovingDot(p, routerX + 55, workerY, workerX - 95, workerY - 30, prog, [180, 240, 160])

      // Provider (primary + secondary)
      const primX = w * 0.7
      const primY = 130
      const secX = w * 0.7
      const secY = 290

      drawBox(p, primX, primY, 150, 36, [30, 30, 20], [255, 200, 100], 'APNS (primary)', 10)
      drawLabel(p, 'api.push.apple.com', primX, primY + 16, 8, [220, 200, 140])

      drawBox(p, secX, secY, 150, 36, [30, 30, 20], [200, 160, 100], 'APNS (fallback)', 10)
      drawLabel(p, 'same provider, diff region', secX, secY + 16, 7, [200, 180, 140])

      // Arrows Worker -> Provider based on breaker state
      if (bs === 'closed') {
        drawArrow(p, workerX + 75, workerY + 20, primX - 75, primY + 5, [120, 220, 140, 160])
        const pprog = (t * 0.9) % 1
        drawMovingDot(p, workerX + 75, workerY + 20, primX - 75, primY + 5, pprog, [140, 240, 160])
        drawLabel(p, '✓ healthy requests', (workerX + 75 + primX - 75) / 2, (workerY + 20 + primY + 5) / 2 - 12, 8, [140, 220, 160])
      } else if (bs === 'open') {
        // X over the primary arrow
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([4, 4])
        p.stroke(255, 100, 100, 120)
        p.strokeWeight(1.5)
        p.line(workerX + 75, workerY + 20, primX - 75, primY + 5)
        ctx.setLineDash([])
        const mx = (workerX + 75 + primX - 75) / 2
        const my = (workerY + 20 + primY + 5) / 2
        p.stroke(255, 100, 100)
        p.strokeWeight(2)
        p.line(mx - 8, my - 8, mx + 8, my + 8)
        p.line(mx - 8, my + 8, mx + 8, my - 8)
        drawLabel(p, 'fail fast · no request sent', mx, my + 22, 9, [255, 140, 140])
      } else {
        // half-open: one trial arrow
        drawArrow(p, workerX + 75, workerY + 20, primX - 75, primY + 5, [255, 200, 100, 140])
        if ((t % 3) < 0.3) {
          const pprog = (t % 0.3) / 0.3
          drawMovingDot(p, workerX + 75, workerY + 20, primX - 75, primY + 5, pprog, [255, 220, 140])
        }
        drawLabel(p, 'probe every ~30s', (workerX + 75 + primX - 75) / 2, (workerY + 20 + primY + 5) / 2 - 12, 8, [255, 200, 140])
      }

      // Secondary provider (failover) — always visible as fallback, dashed line
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.stroke(180, 140, 100, 120)
      p.strokeWeight(1.2)
      p.line(workerX + 95, workerY + 55, secX - 75, secY - 12)
      ctx.setLineDash([])
      // Failover annotation: single line in the gap between worker and fallback, above the arrow
      const gapMidX = (workerX + 95 + secX - 75) / 2
      drawLabel(p, 'fallback on failure', gapMidX, 220, 8, [200, 160, 120])

      // Bottom explanation
      drawLabel(p, 'Provider callbacks (bounces, delivery, failure) flow back to Kafka → Status Tracker → deliveries table', w / 2, 395, 9, [200, 200, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Channel Adapters &amp; Circuit Breakers</h2>
      <p className="text-gray-300 leading-relaxed">
        Every channel has at least one provider. Most have two or three — a primary and one or
        more fallbacks for when the primary is down, throttled, or being gradually migrated
        away from. The worker → adapter → provider chain has to handle failure gracefully
        without taking the whole channel down.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Circuit state:</span>
            {(['closed', 'open', 'half-open'] as const).map((bs) => (
              <button
                key={bs}
                onClick={() => setBreakerState(bs)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  breakerState === bs
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {bs}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Closed</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Normal state. Requests flow through. Failures increment a rolling counter; if error
            rate exceeds threshold (e.g. 50% over 30s), the breaker trips to open.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Open</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Fail fast without touching the provider. All messages deflect to fallback provider
            or requeue on Kafka with a backoff delay. Protects us from holding threads waiting
            on a dead upstream.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Half-open</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            After a cooldown (~30s), let one trial request through. If it succeeds, close the
            breaker and resume normal traffic. If it fails, re-open for another cooldown.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Per-tenant and per-provider breakers:</strong> one
          misbehaving customer spamming invalid tokens should not trip the breaker for
          well-behaved customers. Real production systems maintain breakers keyed by{' '}
          <code className="text-pink-400">(provider, tenant_id)</code> so isolation is real.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Templates & Personalization                           */
/* ================================================================== */

function TemplatesSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Templates &amp; Personalization</h2>
      <p className="text-gray-300 leading-relaxed">
        A template is <em>per-channel</em>, <em>per-locale</em>, and <em>versioned</em>. One
        logical notification — "order shipped" — compiles to different bodies for email (HTML,
        full details), push (one-line preview + deep link), and SMS (160 chars with the tracking
        URL).
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Template shape</p>
          <div className="font-mono text-xs text-gray-300 bg-gray-900 rounded p-3 space-y-1">
            <p className="text-pink-400">template_id: order.shipped.v2</p>
            <p><span className="text-gray-500">channel:</span> email</p>
            <p><span className="text-gray-500">locale:</span> en-US</p>
            <p><span className="text-gray-500">subject:</span> Your order &#123;&#123;order_id&#125;&#125; has shipped</p>
            <p><span className="text-gray-500">body_html:</span> &lt;h1&gt;Tracking: &#123;&#123;tracking_url&#125;&#125;&lt;/h1&gt; ...</p>
            <p><span className="text-gray-500">body_text:</span> Your order &#123;&#123;order_id&#125;&#125; ships &#123;&#123;eta&#125;&#125;...</p>
            <p><span className="text-gray-500">unsubscribe_header:</span> auto</p>
            <p><span className="text-gray-500">category:</span> transactional</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
            <p className="text-white font-semibold text-sm">Variable substitution</p>
            <p className="text-gray-300 text-xs mt-2 leading-relaxed">
              Mustache / Handlebars syntax. The render step fetches user profile fields
              (display_name, timezone, locale) and merges with caller-provided{' '}
              <code className="text-pink-400">variables</code>. Escape HTML output by default;
              opt-in to raw for trusted fragments.
            </p>
          </div>
          <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
            <p className="text-white font-semibold text-sm">Localization</p>
            <p className="text-gray-300 text-xs mt-2 leading-relaxed">
              Template lookup is keyed by{' '}
              <code className="text-pink-400">(template_id, channel, locale)</code>. If the
              user's locale has no version, fall back to the template's default locale (usually
              <code className="text-pink-400">en-US</code>). Date and number formatting uses ICU
              with the user's locale.
            </p>
          </div>
          <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
            <p className="text-white font-semibold text-sm">Versioning &amp; rollout</p>
            <p className="text-gray-300 text-xs mt-2 leading-relaxed">
              Templates are immutable once published. New versions get a new id
              (<code className="text-pink-400">.v2</code>). Callers pin to a version. Supports
              gradual rollout, A/B testing, and rollback — just flip the default version pointer.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Preview and test-send:</strong> template authors
          need a way to preview with real user context before hitting production. A preview API
          renders against a sample user and returns the fully-resolved output; a test-send API
          only delivers to a whitelist of QA recipients, even when called with production
          credentials.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Retry & Backoff                                      */
/* ================================================================== */

function RetrySection() {
  const [failureType, setFailureType] = useState<'retryable' | 'non-retryable'>('retryable')
  const typeRef = useRef(failureType)
  typeRef.current = failureType

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

      const ft = typeRef.current

      drawLabel(
        p,
        ft === 'retryable'
          ? 'Retryable failure (5xx / timeout): exponential backoff, succeed on attempt 4'
          : 'Non-retryable failure (4xx / bad token): no retry, remove token + suppress',
        w / 2,
        22,
        11,
        [255, 255, 255],
      )

      // Timeline
      const startX = 60
      const endX = w - 60
      const tlY = 250
      p.stroke(140, 140, 180)
      p.strokeWeight(1.5)
      p.line(startX, tlY, endX, tlY)
      drawLabel(p, 'time →', endX + 20, tlY, 9, [180, 180, 200], 'left')

      // Attempt points with labels
      type Attempt = {
        label: string
        offset: number
        result: 'fail' | 'success' | 'dlq' | 'suppress'
      }

      const attempts: Attempt[] =
        ft === 'retryable'
          ? [
              { label: 'attempt 1', offset: 0, result: 'fail' },
              { label: 'attempt 2\n(+1s)', offset: 0.1, result: 'fail' },
              { label: 'attempt 3\n(+2s)', offset: 0.24, result: 'fail' },
              { label: 'attempt 4\n(+4s)', offset: 0.45, result: 'fail' },
              { label: 'attempt 5\n(+8s)', offset: 0.75, result: 'success' },
            ]
          : [
              { label: 'attempt 1', offset: 0, result: 'fail' },
              { label: 'classify:\n400 invalid token', offset: 0.35, result: 'suppress' },
            ]

      // Draw attempts
      const span = endX - startX - 80
      for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i]
        const x = startX + 40 + a.offset * span
        const color: RGB =
          a.result === 'success'
            ? [120, 220, 140]
            : a.result === 'dlq'
            ? [255, 120, 120]
            : a.result === 'suppress'
            ? [255, 180, 100]
            : [200, 180, 100]

        // Marker circle
        p.fill(color[0], color[1], color[2])
        p.noStroke()
        p.ellipse(x, tlY, 18, 18)

        // X or check inside
        p.stroke(15, 15, 25)
        p.strokeWeight(2)
        if (a.result === 'fail') {
          p.line(x - 4, tlY - 4, x + 4, tlY + 4)
          p.line(x - 4, tlY + 4, x + 4, tlY - 4)
        } else if (a.result === 'success') {
          p.line(x - 5, tlY, x - 1, tlY + 4)
          p.line(x - 1, tlY + 4, x + 5, tlY - 4)
        } else {
          // suppress/dlq: dash
          p.line(x - 5, tlY, x + 5, tlY)
        }

        // Label
        const labelLines = a.label.split('\n')
        drawLabel(p, labelLines[0], x, tlY - 35, 9, color)
        if (labelLines[1]) drawLabel(p, labelLines[1], x, tlY - 22, 7, color)

        // Result annotation below
        const annotation =
          a.result === 'success'
            ? 'delivered ✓'
            : a.result === 'suppress'
            ? 'remove token + suppress user'
            : a.result === 'dlq'
            ? 'to DLQ'
            : '5xx / timeout'
        drawLabel(p, annotation, x, tlY + 30, 8, color)
      }

      // Retry curve visualization (for retryable case)
      if (ft === 'retryable') {
        // Show the exponential curve as bars
        const barY = 340
        drawLabel(p, 'backoff delays (seconds):', 60, barY, 10, [200, 200, 220], 'left')
        const delays = [1, 2, 4, 8]
        const maxBarH = 50
        const barW = 50
        for (let i = 0; i < delays.length; i++) {
          const h = (delays[i] / 8) * maxBarH
          const bx = 260 + i * 90
          p.fill(100, 180, 255, 180)
          p.stroke(100, 180, 255)
          p.strokeWeight(1)
          p.rect(bx - barW / 2, barY + 10 + (maxBarH - h), barW, h, 3)
          drawLabel(p, `${delays[i]}s`, bx, barY + 15 + maxBarH + 8, 9, [180, 220, 255])
        }

        drawLabel(p, '2^(attempt-1) seconds + jitter', w - 120, barY + 40, 9, [180, 220, 255])
      } else {
        // Non-retryable: show the permanent failure lanes
        const lanesY = 340
        drawLabel(p, 'actions on non-retryable:', 60, lanesY, 10, [200, 200, 220], 'left')
        drawLabel(p, '• remove push_token from devices table', 80, lanesY + 20, 9, [255, 200, 140], 'left')
        drawLabel(p, '• add to suppression_list (reason: invalid)', 80, lanesY + 36, 9, [255, 200, 140], 'left')
        drawLabel(p, '• emit provider.callback event to Kafka', 80, lanesY + 52, 9, [255, 200, 140], 'left')
      }

      // Footer classifier
      p.fill(30, 30, 50, 220)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, 80, w - 80, 80, 6)

      drawLabel(p, 'Failure classifier:', 60, 96, 10, [255, 255, 255], 'left')
      drawLabel(p, '• 5xx, timeouts, connection errors → RETRYABLE (retry with backoff)', 80, 114, 9, [200, 220, 200], 'left')
      drawLabel(p, '• 429 rate-limited → RETRYABLE (honor Retry-After header)', 80, 130, 9, [200, 220, 200], 'left')
      drawLabel(p, '• 400, 404, 410 (invalid token) → NON-RETRYABLE (remove + suppress)', 80, 146, 9, [255, 200, 180], 'left')
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Delivery Pipeline — Retries, Backoff &amp; DLQ</h2>
      <p className="text-gray-300 leading-relaxed">
        Providers fail in two fundamentally different ways, and the system treats them
        differently. Transient failures (timeout, 5xx, 429 throttle) are <em>retryable</em> —
        retry the same message with exponential backoff. Terminal failures (400 bad request,
        410 token expired) are <em>non-retryable</em> — retrying won't help; instead we remove
        the bad token and suppress future sends.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Scenario:</span>
            {(['retryable', 'non-retryable'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setFailureType(ft)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  failureType === ft
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Backoff schedule</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            <code className="text-pink-400">delay = min(base × 2^attempt, max) + jitter</code>.
            Base = 1s, max = 1h, jitter ± 25% to avoid thundering herd when a provider
            recovers. Up to 8 attempts, ~2h total window. After the final attempt, the message
            moves to a DLQ for human inspection.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">How retries are implemented</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            The worker writes back to Kafka with a{' '}
            <code className="text-pink-400">visible_at</code> timestamp instead of retrying
            in-process. A scheduler consumer only surfaces messages whose visibility time has
            passed. This avoids holding threads blocked on sleep, survives worker restarts, and
            makes backoff visible in Kafka lag metrics.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The DLQ is not a dustbin:</strong> it's an
          operational signal. A sudden spike of messages hitting the DLQ is how you learn
          that a provider changed their API, a template has a render bug, or a new device
          platform is emitting invalid tokens. Alert on DLQ growth rate, not just depth.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Dedup, Rate Limiting, Quiet Hours                    */
/* ================================================================== */

function DedupSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Dedup, Rate Limiting &amp; Quiet Hours</h2>
      <p className="text-gray-300 leading-relaxed">
        Three filters that every send must pass. Each one can kill a notification. Each one
        has to be fast — they're on the hot path, called hundreds of thousands of times per
        second.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Deduplication</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Two kinds. <strong className="text-white">Idempotency dedup</strong> uses{' '}
            <code className="text-pink-400">client_event_id</code>: same id within 24h returns the
            existing notification_id rather than re-sending. <strong className="text-white">Content
            dedup</strong> computes a fingerprint:{' '}
            <code className="text-pink-400">sha1(user_id + template_id + sorted(variables))</code>
            and checks Redis for the same fingerprint within the last 15 minutes (duration is
            per-category). A bursty caller that fires "password reset" three times in a row gets
            one send.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Rate limiting (per user × category)</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Bucket policy: "no more than 3 marketing emails / 24h / user", "no more than 10
            push / hour / user for any category". Implementation: Redis sliding-window counter
            keyed by <code className="text-pink-400">(user_id, category)</code>. Transactional
            and security categories are exempt; marketing and promotional are strictly limited.
            Over-limit sends are <em>dropped</em>, not queued — the user is saying "stop".
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Quiet hours</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            If user's local time is within their quiet-hours window (default 22:00–08:00) and
            the category is not critical, the notification is deferred (written to the delayed
            queue with <code className="text-pink-400">visible_at = next quiet-hours end</code>)
            rather than sent immediately. Critical categories (security codes, password resets,
            order confirmations) bypass quiet hours.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Priority classes override everything</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Each notification declares a priority: <code className="text-pink-400">critical</code>{' '}
            (security/auth — bypass all filters),{' '}
            <code className="text-pink-400">transactional</code> (bypass rate limits and quiet
            hours, honor preferences), <code className="text-pink-400">promotional</code>{' '}
            (subject to everything). The category mechanism is how the system supports both
            "2FA code" and "new feature promo" in one pipeline without collisions.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why dedup is both good UX and provider
          protection:</strong> APNS penalizes senders that emit duplicates rapidly by reducing
          their per-connection rate limit. Content dedup not only improves user experience but
          also preserves throughput to every user that follows.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- User Preferences                                     */
/* ================================================================== */

function PreferencesSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. User Preferences</h2>
      <p className="text-gray-300 leading-relaxed">
        Preferences are a two-dimensional matrix per user: <em>channel × category</em>. A row
        per category, a column per channel, a boolean at each cell. Plus a small bit of state
        for quiet hours, language, and timezone.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-3">Example preferences matrix (Alice)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-white">Category</th>
                <th className="py-2 px-3 text-center text-white">Push</th>
                <th className="py-2 px-3 text-center text-white">Email</th>
                <th className="py-2 px-3 text-center text-white">SMS</th>
                <th className="py-2 px-3 text-center text-white">In-app</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-xs">
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium">Security (2FA, password)</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium">Transactional (orders)</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium">Social (mentions, DMs)</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium">Product updates</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-green-400">on</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">Marketing</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
                <td className="py-2 px-3 text-center text-red-400">off</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Read path</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Every send reads preferences. Hot path, so it's a Postgres row hit with aggressive
            caching (~100ms TTL, invalidate on write). Preferences rarely change, so cache hit
            rate is &gt;99% and the DB sees a small fraction of send volume.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Write path is audited</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Every preference change writes to a separate{' '}
            <code className="text-pink-400">preferences_audit</code> log with actor, source (UI,
            email-unsub, API), timestamp. Required for compliance — when a user says "I
            never unsubscribed", we can prove when and how they did.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Global suppression beats preferences:</strong> if
          Alice's email is on the suppression list (hard bounce, spam complaint), we never send
          to it, even if her preference says "yes, marketing emails please." Suppression is a
          safety belt the user can't disable by accident.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 13 -- Broadcast & Rate Shaping                             */
/* ================================================================== */

function BroadcastSection() {
  const [mode, setMode] = useState<'shaped' | 'naive'>('shaped')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 500)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const m = modeRef.current

      drawLabel(
        p,
        m === 'shaped'
          ? 'Rate-shaped broadcast: 100M recipients spread over ~3 minutes, under provider limits'
          : 'Naive broadcast: fire everything at once → provider throttles → cascading retries',
        w / 2,
        22,
        11,
        [255, 255, 255],
      )

      // Top: segment -> shards
      const segY = 80
      drawBox(p, w * 0.12, segY, 150, 36, [40, 30, 60], [200, 140, 255], 'Segment Builder', 10)
      drawLabel(p, '100M recipients', w * 0.12, segY + 18, 8, [200, 170, 220])

      // Shard workers (fan-out)
      const shardY = 170
      const shardCount = 6
      for (let i = 0; i < shardCount; i++) {
        const x = w * (0.3 + i * 0.1)
        drawBox(p, x, shardY, 75, 26, [25, 40, 30], [140, 220, 160], `Shard ${i + 1}`, 8)

        // Segment -> shard arrow
        drawArrow(p, w * 0.12 + 75, segY, x, shardY - 13, [200, 140, 255, 140])
      }

      // Kafka queue
      const kafkaY = 240
      drawBox(p, w / 2, kafkaY, 280, 30, [40, 20, 30], [255, 140, 180], 'Kafka: push.queued (rate-shaped producer)', 9)
      for (let i = 0; i < shardCount; i++) {
        const x = w * (0.3 + i * 0.1)
        drawArrow(p, x, shardY + 13, w / 2 - 130 + i * 50, kafkaY - 15, [140, 220, 160, 130])
      }

      // Delivery-rate chart
      const chartY = 340
      const chartH = 120
      const chartX1 = 80
      const chartX2 = w - 80
      const chartW = chartX2 - chartX1

      // Chart box
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.noFill()
      p.rect(chartX1, chartY, chartW, chartH, 4)

      // Axes
      drawLabel(p, 'req/sec', chartX1 - 6, chartY + 10, 8, [180, 180, 200], 'right')
      drawLabel(p, 'time →', chartX2 + 30, chartY + chartH - 5, 8, [180, 180, 200], 'left')

      // Provider limit line
      const limitY = chartY + 30
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.stroke(255, 120, 120)
      p.strokeWeight(1.2)
      p.line(chartX1, limitY, chartX2, limitY)
      ctx.setLineDash([])
      drawLabel(p, 'provider rate limit (e.g. 500K/s)', chartX2 - 6, limitY - 8, 8, [255, 140, 140], 'right')

      // Draw the delivery curve
      p.noFill()
      p.strokeWeight(2)
      if (m === 'shaped') {
        // Bell curve, stays under limit
        p.stroke(120, 220, 140)
        p.beginShape()
        for (let i = 0; i <= 120; i++) {
          const x = chartX1 + (i / 120) * chartW
          const normalized = (i - 60) / 30
          const y = chartY + chartH - 15 - Math.exp(-normalized * normalized) * (chartH - 60) * 0.95
          p.vertex(x, y)
        }
        p.endShape()
        drawLabel(p, 'steady ramp-up, holds below limit, drains cleanly', w / 2, chartY + chartH + 18, 9, [120, 220, 140])
      } else {
        // Spike above limit, then long tail of throttled retries
        p.stroke(255, 120, 120)
        p.beginShape()
        for (let i = 0; i <= 120; i++) {
          const x = chartX1 + (i / 120) * chartW
          let y: number
          if (i < 5) {
            // Sharp spike
            y = chartY + chartH - 15 - (i / 5) * (chartH - 22)
          } else if (i < 20) {
            // Clamped at limit (throttled)
            y = limitY + 2
          } else if (i < 80) {
            // Long tail of retries
            y = limitY + 2 + ((i - 20) / 60) * 30
          } else {
            y = chartY + chartH - 15 - ((120 - i) / 40) * 40
          }
          p.vertex(x, y)
        }
        p.endShape()

        // Throttle label
        drawLabel(p, 'THROTTLED', chartX1 + chartW * 0.2, limitY - 8, 9, [255, 140, 140])
        drawLabel(p, 'spike exceeds provider limit → 429s → long retry tail', w / 2, chartY + chartH + 18, 9, [255, 140, 140])
      }

      // Current position animated marker
      const tpos = (t * 0.2) % 1
      const mx = chartX1 + tpos * chartW
      p.stroke(255, 220, 120)
      p.strokeWeight(1)
      ctx.setLineDash([3, 3])
      p.line(mx, chartY, mx, chartY + chartH)
      ctx.setLineDash([])
      drawLabel(p, 'now', mx, chartY - 6, 8, [255, 220, 140])

      // Rate-limit policy box
      drawLabel(p, 'Shaping policy:', 60, chartY + chartH + 45, 10, [255, 255, 255], 'left')
      drawLabel(p, '• target_rate = min(user_rate_limit, provider_capacity × 0.7)', 80, chartY + chartH + 62, 9, [200, 200, 220], 'left')
      drawLabel(p, '• producer reads segment pages slowly; enqueues at token-bucket rate', 80, chartY + chartH + 78, 9, [200, 200, 220], 'left')
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Broadcast &amp; Rate Shaping</h2>
      <p className="text-gray-300 leading-relaxed">
        Sending to 100M users is not the same problem scaled up from sending to one. If the
        system enqueues 100M messages at once and lets the workers drain as fast as they can,
        the providers will throttle within seconds. APNS starts returning 429s; SES drops
        reputation score; Twilio cuts your throughput. The fix is to{' '}
        <em>shape the rate at ingest</em> so the pipeline never exceeds what providers will
        accept.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Mode:</span>
            {(['shaped', 'naive'] as const).map((mv) => (
              <button
                key={mv}
                onClick={() => setMode(mv)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  mode === mv
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {mv}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Segment Builder</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Paginated query against the segment store, yielding user_ids in chunks of ~10K.
            Paginates slowly, governed by a token bucket so the downstream rate is controlled
            at the <em>source</em>, not the sink.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Shard Workers</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Each shard applies preferences, suppression, and rate limits to its slice of users
            and pushes the surviving messages to the per-channel Kafka topic. Horizontal
            scale comes from running more shards.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Channel Workers</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Consume the channel topic at a steady rate matched to provider capacity. Multiple
            worker processes share the topic via Kafka consumer groups; if one falls behind,
            rebalance brings its partitions to a healthier peer.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">"Send at 9 AM local time":</strong> the segment
          builder can split 100M recipients into per-timezone cohorts and schedule each cohort
          to start draining when its local 9 AM arrives. This creates 24 small, overlapping
          waves rather than one giant wave — easier on providers and more relevant for users.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 14 -- Observability & Delivery Tracking                    */
/* ================================================================== */

function ObservabilitySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">14. Observability &amp; Delivery Tracking</h2>
      <p className="text-gray-300 leading-relaxed">
        A notification passes through a funnel of states. Every transition is an event; every
        event is both user-visible (delivery status API) and aggregatable (dashboards,
        anomaly detection).
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-3">Delivery funnel</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-white">Event</th>
                <th className="py-2 px-3 text-white">Source</th>
                <th className="py-2 px-3 text-white">Typical rate / 100</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-xs">
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-blue-400">queued</td>
                <td className="py-2 px-3">Orchestrator (after filters)</td>
                <td className="py-2 px-3">100</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-cyan-400">sent</td>
                <td className="py-2 px-3">Worker (provider accepted)</td>
                <td className="py-2 px-3">~98</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-green-400">delivered</td>
                <td className="py-2 px-3">Provider callback</td>
                <td className="py-2 px-3">~95 (push) / ~92 (email)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-emerald-400">opened</td>
                <td className="py-2 px-3">Tracking pixel / app foreground</td>
                <td className="py-2 px-3">~20-40 (email) / ~15 (push)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-purple-400">clicked</td>
                <td className="py-2 px-3">URL redirector</td>
                <td className="py-2 px-3">~2-5</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-medium text-amber-400">bounced</td>
                <td className="py-2 px-3">Provider callback</td>
                <td className="py-2 px-3">~1-5 (email) / 0 (push)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-red-400">complained</td>
                <td className="py-2 px-3">ISP feedback loop</td>
                <td className="py-2 px-3">&lt; 0.1 (must stay low or sender reputation tanks)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Provider callbacks</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Providers push delivery status via webhooks: APNS feedback service, SES SNS topic,
            Twilio status callbacks. These are ingested at{' '}
            <code className="text-pink-400">/internal/callbacks/*</code> endpoints, normalized
            into a common event shape, and written to Kafka{' '}
            <code className="text-pink-400">provider.callback</code>. A consumer updates the
            deliveries table and triggers side effects (suppression on bounce/complaint).
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Key alerts</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li>Bounce rate per template crosses 5% → paused</li>
            <li>Complaint rate per sender crosses 0.1% → SES reputation is in danger</li>
            <li>Delivered/queued ratio drops &gt;5pp in 5min → provider issue</li>
            <li>DLQ growth rate &gt; 1K/min → classifier bug or provider API change</li>
            <li>P99 send latency &gt; 5s sustained → back-pressure somewhere</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Auto-suppression on hard bounce:</strong> one
          hard-bounce from SES isn't a network glitch — the mailbox doesn't exist. The
          address is immediately added to the suppression list and the source system is
          notified via webhook so it can mark the email as invalid. Same for APNS{' '}
          <code className="text-pink-400">Unregistered</code>: the push token is removed from
          the devices table.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 15 -- Compliance & Unsubscribe                             */
/* ================================================================== */

function ComplianceSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">15. Compliance &amp; Unsubscribe</h2>
      <p className="text-gray-300 leading-relaxed">
        Every channel has its own regulatory envelope. The notification service has to enforce
        them globally, because product teams cannot be expected to re-implement CAN-SPAM or
        GDPR in every caller.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Email — CAN-SPAM &amp; list-unsubscribe</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Every marketing email must carry a visible unsubscribe link plus the{' '}
            <code className="text-pink-400">List-Unsubscribe</code> and{' '}
            <code className="text-pink-400">List-Unsubscribe-Post: List-Unsubscribe=One-Click</code>
            headers. Gmail and Yahoo now require one-click unsubscribe for senders &gt;5K/day.
            The unsubscribe URL carries a signed token so the server knows which user +
            category without them logging in.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">SMS — TCPA (US) &amp; STOP handling</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The user must have opted in. A reply of{' '}
            <code className="text-pink-400">STOP</code>, <code className="text-pink-400">UNSUBSCRIBE</code>,
            <code className="text-pink-400">END</code>, or <code className="text-pink-400">CANCEL</code>
            adds their phone to the global suppression list. The system replies once to confirm
            ("You are unsubscribed...") and sends nothing further. Audit log captures the event.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">GDPR — right to erasure</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            On a DSR delete request, cascade-delete the user's preferences, devices,
            notification history, delivery events. The user's email/phone hash stays on the
            suppression list by default — this prevents future sends if a new record for them
            is created by accident. Caller services that re-create the user must explicitly
            re-opt-in.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Data residency</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            EU users' preferences, devices, and delivery logs are stored in EU-region storage
            only. The notification API inspects the user's country on entry and routes to the
            regional cluster. Regional providers are preferred (SES eu-west-1, Twilio EU data
            center) so even the provider call never leaves the region.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The suppression list is append-only:</strong>{' '}
          once an email is suppressed, removing it requires a compliance-team sign-off. Users
          who opt back in go through explicit confirmation, not a checkbox. This costs some
          potential volume — and protects sender reputation, which is far more valuable.
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
      <h2 className="text-2xl font-bold text-white">16. Partitioning &amp; Scaling</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">API tier</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Stateless; scale by connection count. Auto-scale target: 1K req/sec per node at
            50% CPU. Idempotency store (Redis) is sharded by client_event_id hash, with 24h
            TTL — footprint is small.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Kafka topics</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            One topic per channel (<code className="text-pink-400">push.queued</code>,{' '}
            <code className="text-pink-400">email.queued</code>, etc.), each with enough
            partitions for 10x headroom over peak throughput. Retention: 7 days, which covers
            the maximum retry window plus operational slack.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Worker pools</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Each channel has its own Kubernetes deployment with autoscaling keyed on Kafka
            consumer lag (not CPU). A growing lag means we need more workers; falling lag
            means we can scale back in. Per-channel HPA targets keep the hot path responsive
            without over-provisioning.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Deliveries table (Cassandra)</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Partition by <code className="text-pink-400">notification_id</code>. Each partition
            is small (1-5 rows), distributes evenly. Delivery-event TTL of 30 days keeps the
            hot set manageable; cold events aggregate into the analytics warehouse.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Multi-region</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Full stack deployed per region (us-east, us-west, eu-west, ap-south). Users are
            pinned to their home region for preference/history storage; the API accepts sends
            in any region and routes to the user's home for preference lookup if needed. Kafka
            does not replicate cross-region — regions are independent failure domains.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-cyan-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Multi-tenant isolation</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            If this is a B2B product (Twilio-style), each customer gets per-tenant rate limits
            and per-tenant Kafka partitioning so noisy neighbors can't impact each other.
            Large customers can be moved to dedicated Kafka partitions/workers via config.
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
      chose: 'Per-channel Kafka topics + worker pools',
      over: 'Unified queue with a channel field',
      because:
        'A unified queue couples all channel fates. A Twilio outage creates a backlog of SMS messages that starves email workers reading from the same topic. Per-channel topics give independent scaling, independent failure, and per-channel observability. The price is more moving parts.',
      color: 'border-blue-600',
    },
    {
      chose: 'Client-generated idempotency keys (client_event_id)',
      over: 'Server-side dedup on content hash only',
      because:
        'Callers retry on flaky networks. If the server dedupes by content hash, two legitimately different "password reset" sends collapse into one. Forcing the caller to supply an event id draws a clear line — "the caller tells us whether this is a retry or a new send." Content-hash dedup is a secondary defense, not the primary one.',
      color: 'border-amber-600',
    },
    {
      chose: 'Rate-shape broadcasts at the source (segment builder)',
      over: 'Let the queue fill and workers drain at provider limits',
      because:
        'If we enqueue 100M messages all at once and drain as fast as providers accept, Kafka holds 100M messages for 3 minutes — fine for Kafka, bad for visibility. Worse, if the user cancels the broadcast, we still have 100M messages in flight. Shaping at the source keeps the in-flight set small and cancelable.',
      color: 'border-purple-600',
    },
    {
      chose: 'Async API (202 + notification_id) for all sends',
      over: 'Sync API that waits for provider accept',
      because:
        "Sync APIs couple the caller's latency to provider latency. A Twilio blip becomes a caller's timeout. Async + status-lookup decouples them: the caller always gets a fast 202, the status is available by ID. The rare caller that needs sync semantics (password reset before the user gives up) can poll the status endpoint with a short timeout.",
      color: 'border-emerald-600',
    },
    {
      chose: 'Circuit breaker per (provider, tenant)',
      over: 'Circuit breaker per provider only',
      because:
        'One abusive tenant sending to 10M invalid tokens would trip the shared breaker and halt sends for every other customer. Per-tenant breakers isolate the blast radius. Cost is more state and more breaker instances — worth it for a multi-tenant product.',
      color: 'border-green-600',
    },
    {
      chose: 'Suppression list as a separate hard store',
      over: 'Suppression as a flag on the preferences row',
      because:
        'Suppression is a compliance-critical safety belt. It must survive accidental preference resets, system bugs, even database restores of older snapshots. Keeping it in its own append-only store with independent backups makes "oops, we restored from yesterday and re-enabled 10K unsubscribes" a non-event.',
      color: 'border-red-600',
    },
    {
      chose: 'Kafka between routers and workers (async backbone)',
      over: 'Direct RPC from routers to workers',
      because:
        "Workers restart, autoscale, and crash. Direct RPC needs service discovery, connection pools, retry logic, and backpressure protocols between every pair. Kafka absorbs all of this — workers read at their own pace, slow workers just mean more lag. Retries become 'produce again with visible_at', not 'hold a thread sleeping'.",
      color: 'border-pink-600',
    },
    {
      chose: 'Non-retryable failures remove the bad token immediately',
      over: 'Retry everything, let providers handle it',
      because:
        'An invalid push token is not a transient problem. Retrying it wastes provider quota and damages sender reputation (APNS penalizes high invalid-token rate). Immediate removal on 410/400 keeps the token registry clean, keeps our reputation high, and keeps latency low for valid tokens.',
      color: 'border-cyan-600',
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
          <strong className="text-yellow-400">What makes a notification service hard at
          scale:</strong> not the scale itself, but the <em>variety</em>. Five channels, five
          providers per channel, two workload shapes (transactional vs broadcast), three
          compliance frameworks, a dozen failure modes per provider. The design is mostly
          about drawing clean boundaries — channel, provider, tenant, category, region — so
          that when something breaks, exactly one of those things fails, and nothing else
          notices.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignNotificationService() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Design a Notification Service</h1>
        <p className="text-lg text-gray-400">
          The multi-channel delivery infrastructure behind OneSignal, Pinpoint, and Twilio
          Notify — push, email, SMS, webhook — at 100M-user scale. How to isolate channels,
          rate-shape broadcasts, dedupe retries, survive provider outages, and stay compliant.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <DataModelSection />
      <ArchitectureSection />
      <ChannelAdaptersSection />
      <TemplatesSection />
      <RetrySection />
      <DedupSection />
      <PreferencesSection />
      <BroadcastSection />
      <ObservabilitySection />
      <ComplianceSection />
      <PartitioningSection />
      <TradeoffsSection />
    </div>
  )
}
