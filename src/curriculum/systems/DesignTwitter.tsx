import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-twitter',
  title: 'Design Twitter (Social Media Feed)',
  description:
    'System design case study: tweet posting, fan-out strategies, home timeline generation, social graph, search, trending topics, and notification delivery at Twitter scale',
  track: 'systems',
  order: 20,
  tags: [
    'system-design',
    'twitter',
    'fan-out',
    'timeline',
    'social-graph',
    'search',
    'trending',
    'cqrs',
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

function drawDot(
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

function drawDashedLine(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
) {
  const ctx = p.drawingContext as CanvasRenderingContext2D
  ctx.setLineDash([4, 4])
  p.stroke(color[0], color[1], color[2], color[3])
  p.strokeWeight(1)
  p.line(x1, y1, x2, y2)
  ctx.setLineDash([])
}

/* ================================================================== */
/*  Section 1 — Problem Statement & Requirements                       */
/* ================================================================== */

function ProblemSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a real-time social media platform like Twitter (now X) that allows users to
        post short messages (tweets), follow other users, and view a personalized home timeline
        aggregating content from the people they follow. The system must handle hundreds of millions
        of daily active users, deliver timelines with sub-200ms latency, and manage the unique
        challenge of &ldquo;celebrity&rdquo; accounts with tens of millions of followers. This is
        the most classic system design interview question because it touches fan-out strategies,
        caching, social graphs, search, and real-time delivery all in one problem.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Post tweets (280 characters, images, videos)</li>
        <li>Follow and unfollow users</li>
        <li>Home timeline: feed of tweets from followed users, reverse chronological + ranked</li>
        <li>User timeline: all tweets from a specific user</li>
        <li>Search tweets by keyword</li>
        <li>Trending topics (top hashtags in the last hour/day)</li>
        <li>Like, retweet, and reply to tweets</li>
        <li>Notifications (someone liked, retweeted, or followed you)</li>
        <li>Direct messages (brief mention for completeness)</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>500M total users, 200M daily active users (DAU)</li>
        <li>500M tweets/day {'\u2248'} 6K tweets/sec write throughput</li>
        <li>Read-heavy: each user reads timeline ~50x/day {'\u2192'} 10B timeline reads/day {'\u2248'} 115K reads/sec</li>
        <li>Timeline load latency {'<'}200ms at p99</li>
        <li>99.99% availability (less than 53 minutes downtime/year)</li>
        <li>Eventual consistency acceptable for timelines (a few seconds delay is OK)</li>
        <li>Users see their own tweets immediately (read-after-write consistency)</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Back-of-Envelope Calculations                          */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">2. Back-of-Envelope Calculations</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Tweet Volume</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>500M tweets/day {'\u00d7'} 280 bytes avg text = 140 GB/day of text</li>
          <li>Including metadata (user_id, timestamps, counters) {'\u2248'} 500 GB/day</li>
          <li>Annual text storage: {'\u2248'} 180 TB/year</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Media Storage</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10% of tweets have images: 50M {'\u00d7'} 200KB = 10 TB/day</li>
          <li>1% of tweets have video: 5M {'\u00d7'} 5MB avg = 25 TB/day</li>
          <li>Total media: {'\u2248'} 35 TB/day, {'\u2248'} 12.8 PB/year</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Social Graph</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>200M active users {'\u00d7'} avg 200 follows = 40B follow edges</li>
          <li>Each edge: 16 bytes (two 8-byte IDs) {'\u2192'} {'\u2248'} 640 GB raw</li>
          <li>With indexes and reverse mappings: {'\u2248'} 2-3 TB</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Timeline Cache</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Each user&apos;s cached timeline: 800 tweet IDs {'\u00d7'} 8 bytes = 6.4 KB</li>
          <li>200M users {'\u00d7'} 6.4 KB = {'\u2248'} 1.28 TB in Redis</li>
          <li>With replication: {'\u2248'} 4 TB total Redis cluster</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Fan-out: The Celebrity Problem</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Celebrity with 50M followers posts a tweet</li>
          <li>Fan-out on write: 50M timeline cache updates per single tweet</li>
          <li>At 6K tweets/sec total {'\u2192'} potential billions of cache writes/sec during celebrity bursts</li>
          <li>This is THE key challenge in designing Twitter</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — API Design                                             */
/* ================================================================== */

function APISection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">3. API Design</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/tweets</code>
          <p className="text-gray-400 text-sm mt-1">
            Post a new tweet. Body: {'{'} text, media_ids[], reply_to_id? {'}'}
            {' \u2192 '} Returns tweet object with id, created_at.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/timeline/home?cursor=X&limit=20</code>
          <p className="text-gray-400 text-sm mt-1">
            Paginated home timeline. Returns tweets from followed users, ranked by relevance.
            Cursor-based pagination for infinite scroll.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/timeline/user/:user_id?cursor=X</code>
          <p className="text-gray-400 text-sm mt-1">
            User timeline {'\u2014'} all tweets from a specific user in reverse chronological order.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/follow/:user_id</code>
          <p className="text-gray-400 text-sm mt-1">
            Follow a user. Triggers async backfill of their recent tweets into your timeline cache.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">DELETE /api/v1/follow/:user_id</code>
          <p className="text-gray-400 text-sm mt-1">
            Unfollow a user. Async removal of their tweets from your timeline cache.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/search?q=keyword&cursor=X</code>
          <p className="text-gray-400 text-sm mt-1">
            Full-text search over tweets. Backed by Elasticsearch inverted index.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/trending</code>
          <p className="text-gray-400 text-sm mt-1">
            Top trending hashtags. Computed via sliding window with Count-Min Sketch.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/tweets/:id/like</code>
          <span className="text-gray-500 mx-2">|</span>
          <code className="text-green-400 text-sm">POST /api/v1/tweets/:id/retweet</code>
          <p className="text-gray-400 text-sm mt-1">
            Engagement actions. Each triggers a notification to the tweet author.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Data Model                                             */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">4. Data Model</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">User</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: snowflake_id,
  handle: string (unique),
  display_name: string,
  bio: text,
  avatar_url: string,
  followers_count: int,
  following_count: int,
  is_celebrity: bool,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Tweet</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: snowflake_id,
  user_id: snowflake_id,
  text: varchar(280),
  media_urls: string[],
  reply_to_id: snowflake_id | null,
  likes_count: int,
  retweet_count: int,
  reply_count: int,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Follow (Social Graph)</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  follower_id: snowflake_id,
  followee_id: snowflake_id,
  created_at: timestamp
}
-- PK: (follower_id, followee_id)
-- Index: (followee_id, follower_id)
-- "Who does X follow?" → scan by follower_id
-- "Who follows X?" → scan by followee_id`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Timeline (Materialized)</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  user_id: snowflake_id,
  tweet_id: snowflake_id,
  author_id: snowflake_id,
  score: float,
  created_at: timestamp
}
-- Stored in Redis sorted set
-- Key: timeline:{user_id}
-- Score: tweet_id (time-sortable)
-- Max 800 entries per user`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Like / Retweet</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`Like {
  user_id: snowflake_id,
  tweet_id: snowflake_id,
  created_at: timestamp
}
Retweet {
  user_id: snowflake_id,
  tweet_id: snowflake_id,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Notification</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: snowflake_id,
  user_id: snowflake_id,
  type: "like" | "retweet" |
        "follow" | "reply" | "mention",
  actor_id: snowflake_id,
  tweet_id: snowflake_id | null,
  read: bool,
  created_at: timestamp
}`}</pre>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — High-Level Architecture (p5 animated)                  */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 500

    interface Packet {
      progress: number
      fromX: number
      fromY: number
      toX: number
      toY: number
      color: [number, number, number]
      speed: number
    }
    const packets: Packet[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 900)
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
      p.text('Twitter High-Level Architecture', canvasW / 2, 8)

      const bw = 84
      const bh = 30
      const hbw = bw / 2
      const hbh = bh / 2
      const g = 10

      // Columns
      const c1 = canvasW * 0.08
      const c2 = canvasW * 0.24
      const c3 = canvasW * 0.40
      const c4 = canvasW * 0.56
      const c5 = canvasW * 0.72
      const c6 = canvasW * 0.88

      // Rows
      const r1 = 55   // write
      const r2 = 135  // async fan-out
      const r3 = 225  // read
      const r4 = 310  // search
      const r5 = 395  // metadata / notifications

      // ── ROW 1: WRITE PATH ──
      drawBox(p, c1, r1, bw, bh, [30, 30, 50], [120, 120, 200], 'Client', 8)
      drawBox(p, c2, r1, bw, bh, [30, 40, 30], [100, 200, 100], 'API Gateway', 8)
      drawBox(p, c3, r1, bw, bh, [30, 30, 60], [99, 102, 241], 'Tweet Svc', 8)
      drawBox(p, c4, r1, bw, bh, [20, 40, 50], [52, 180, 220], 'Tweet DB', 8)
      drawBox(p, c5, r1, bw, bh, [30, 40, 40], [100, 180, 180], 'Media Svc', 8)
      drawBox(p, c6, r1, bw, bh, [40, 40, 30], [180, 180, 100], 'CDN', 8)
      // Horizontal: Client → GW → Tweet Svc → Tweet DB → Media → CDN
      drawArrow(p, c1+hbw+g, r1, c2-hbw-g, r1, [100,200,100,150])
      drawArrow(p, c2+hbw+g, r1, c3-hbw-g, r1, [100,200,100,150])
      drawArrow(p, c3+hbw+g, r1, c4-hbw-g, r1, [99,102,241,150])
      drawArrow(p, c4+hbw+g, r1, c5-hbw-g, r1, [52,180,220,120])
      drawArrow(p, c5+hbw+g, r1, c6-hbw-g, r1, [100,180,180,120])
      // Tweet Svc also publishes to Msg Queue (vertical down)
      drawArrow(p, c3, r1+hbh+g, c3, r2-hbh-g, [99,102,241,130])

      // ── ROW 2: FAN-OUT (async) ──
      drawBox(p, c3, r2, bw, bh, [40, 30, 40], [180, 100, 180], 'Msg Queue', 8)
      drawBox(p, c4, r2, bw, bh, [50, 30, 30], [236, 72, 153], 'Fan-out Svc', 8)
      // Fan-out reads from Social Graph AND writes to Feed Cache (parallel, not sequential)
      drawBox(p, c5, r2-30, bw, bh, [50, 20, 20], [220, 80, 80], 'Social Graph', 8)
      drawBox(p, c5, r2+30, bw, bh, [50, 30, 20], [255, 140, 50], 'Feed Cache', 8)
      // Queue → Fan-out
      drawArrow(p, c3+hbw+g, r2, c4-hbw-g, r2, [180,100,180,150])
      // Fan-out → Social Graph (reads follower list) — up-right
      drawArrow(p, c4+hbw+g, r2-6, c5-hbw-g, r2-30, [220,80,80,130])
      // Fan-out → Feed Cache (writes to each follower's cache) — down-right
      drawArrow(p, c4+hbw+g, r2+6, c5-hbw-g, r2+30, [255,140,50,130])

      // Labels on fan-out arrows
      p.fill(140)
      p.textSize(6)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('read followers', c4+hbw+12, r2-14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('write timelines', c4+hbw+12, r2+12)

      // ── ROW 3: READ PATH ──
      drawBox(p, c1, r3, bw, bh, [30, 30, 50], [120, 120, 200], 'Client', 8)
      drawBox(p, c2, r3, bw, bh, [30, 40, 30], [100, 200, 100], 'API Gateway', 8)
      drawBox(p, c3, r3, bw, bh, [30, 50, 40], [52, 211, 153], 'Timeline Svc', 8)
      drawArrow(p, c1+hbw+g, r3, c2-hbw-g, r3, [52,211,153,150])
      drawArrow(p, c2+hbw+g, r3, c3-hbw-g, r3, [52,211,153,150])
      // Timeline Svc reads Feed Cache — L-shape: right then up
      p.stroke(255, 140, 50, 130)
      p.strokeWeight(1.5)
      p.line(c3+hbw+g, r3, c5, r3)
      p.line(c5, r3, c5, r2+30+hbh+g)
      p.fill(255,140,50,130)
      p.noStroke()
      p.triangle(c5, r2+30+hbh+g, c5-3, r2+30+hbh+g+7, c5+3, r2+30+hbh+g+7)

      // ── ROW 4: SEARCH ──
      drawBox(p, c1, r4, bw, bh, [30, 30, 50], [120, 120, 200], 'Client', 8)
      drawBox(p, c2, r4, bw, bh, [30, 40, 30], [100, 200, 100], 'API Gateway', 8)
      drawBox(p, c3, r4, bw, bh, [40, 30, 50], [180, 100, 220], 'Search Svc', 8)
      drawBox(p, c4, r4, bw, bh, [40, 40, 20], [200, 200, 60], 'Elasticsearch', 8)
      drawArrow(p, c1+hbw+g, r4, c2-hbw-g, r4, [180,100,220,150])
      drawArrow(p, c2+hbw+g, r4, c3-hbw-g, r4, [180,100,220,150])
      drawArrow(p, c3+hbw+g, r4, c4-hbw-g, r4, [180,100,220,150])

      // ── ROW 5: METADATA + NOTIFICATIONS ──
      drawBox(p, c3, r5, bw, bh, [40, 35, 20], [220, 170, 60], 'Notif Svc', 8)
      drawBox(p, c4, r5, bw, bh, [30, 35, 45], [100, 150, 220], 'Metadata Svc', 8)
      drawBox(p, c5, r5, bw, bh, [35, 35, 35], [160, 160, 160], 'User DB', 8)
      drawArrow(p, c4+hbw+g, r5, c5-hbw-g, r5, [100,150,220,130])
      // Fan-out → Notifications (vertical dashed)
      drawDashedLine(p, c3+10, r2+hbh+g+10, c3+10, r5-hbh-g, [220,170,60,50])

      // Row labels
      p.fill(55)
      p.textSize(7)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('WRITE', 4, r1)
      p.text('ASYNC', 4, r2-4)
      p.text('FAN-OUT', 4, r2+6)
      p.text('READ', 4, r3)
      p.text('SEARCH', 4, r4)

      // ── ANIMATED DOTS ──
      // Blue: write path + fan-out
      const wp = (t * 0.18) % 1
      if (wp < 0.14) drawDot(p, c1+hbw, r1, c2-hbw, r1, wp/0.14, [99,200,241])
      else if (wp < 0.28) drawDot(p, c2+hbw, r1, c3-hbw, r1, (wp-0.14)/0.14, [99,200,241])
      else if (wp < 0.42) drawDot(p, c3+hbw, r1, c4-hbw, r1, (wp-0.28)/0.14, [99,200,241])
      else if (wp < 0.52) drawDot(p, c3, r1+hbh, c3, r2-hbh, (wp-0.42)/0.10, [180,100,180])
      else if (wp < 0.66) drawDot(p, c3+hbw, r2, c4-hbw, r2, (wp-0.52)/0.14, [236,72,153])
      else if (wp < 0.80) {
        // Fan-out reads graph + writes cache simultaneously
        drawDot(p, c4+hbw, r2-6, c5-hbw, r2-30, (wp-0.66)/0.14, [220,80,80])
        drawDot(p, c4+hbw, r2+6, c5-hbw, r2+30, (wp-0.66)/0.14, [255,140,50])
      }

      // Green: read path
      const rp = ((t * 0.18) + 0.5) % 1
      if (rp < 0.25) drawDot(p, c1+hbw, r3, c2-hbw, r3, rp/0.25, [52,211,153])
      else if (rp < 0.50) drawDot(p, c2+hbw, r3, c3-hbw, r3, (rp-0.25)/0.25, [52,211,153])
      else if (rp < 0.75) drawDot(p, c3+hbw, r3, c5, r3, (rp-0.50)/0.25, [255,140,50])
      else drawDot(p, c5, r3, c5, r2+30+hbh, (rp-0.75)/0.25, [255,140,50])

      void packets
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The architecture separates the <strong>write path</strong> (posting tweets, fan-out) from
        the <strong>read path</strong> (loading timelines). A blue dot traces a tweet being posted
        and fanned out; a green dot traces a timeline read from Redis cache.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Deep Dive 1: Fan-out Strategies (p5)                   */
/* ================================================================== */

function FanoutSection() {
  const [mode, setMode] = useState<'write' | 'read' | 'hybrid'>('write')

  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 420

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      const titles: Record<string, string> = {
        write: 'Fan-out on Write (Push Model)',
        read: 'Fan-out on Read (Pull Model)',
        hybrid: 'Hybrid Approach (What Twitter Does)',
      }

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(titles[mode], canvasW / 2, 8)

      const cX = canvasW * 0.12
      const svcX = canvasW * 0.32
      const graphX = canvasW * 0.52
      const cacheX = canvasW * 0.72
      const readX = canvasW * 0.90

      if (mode === 'write') {
        /* User A posts a tweet */
        drawBox(p, cX, 80, 80, 34, [30, 30, 60], [99, 102, 241], 'User A\nPosts Tweet', 9)
        drawBox(p, svcX, 80, 80, 34, [50, 30, 30], [236, 72, 153], 'Fan-out\nService', 9)
        drawBox(p, graphX, 80, 80, 34, [50, 20, 20], [220, 80, 80], 'Social Graph\nDB', 9)

        drawArrow(p, cX + 40, 80, svcX - 40, 80, [99, 102, 241, 160])
        drawArrow(p, svcX + 40, 80, graphX - 40, 80, [236, 72, 153, 140])

        p.fill(160)
        p.textSize(7)
        p.text('get followers', (svcX + graphX) / 2, 63)

        /* Followers' timeline caches */
        const followers = ['Follower 1', 'Follower 2', 'Follower 3', 'Follower 4', '...50M more']
        const startY = 160
        const gap = 48

        for (let i = 0; i < followers.length; i++) {
          const fy = startY + i * gap
          const isLast = i === followers.length - 1
          const fc: [number, number, number] = isLast ? [80, 80, 80] : [50, 30, 20]
          const sc: [number, number, number] = isLast ? [140, 140, 140] : [255, 140, 50]
          drawBox(p, cacheX, fy, 90, 30, fc, sc, `${followers[i]}\nTimeline Cache`, 8)
          drawArrow(p, svcX + 20, 97, cacheX - 45, fy - 8, [236, 72, 153, 80])

          /* Animated write dots */
          const delay = i * 0.15
          const prog = ((t * 0.5) - delay) % 2
          if (prog > 0 && prog < 1 && !isLast) {
            drawDot(p, svcX + 20, 97, cacheX - 45, fy - 8, prog, [255, 140, 50])
          }
        }

        /* Pros / Cons */
        p.fill(52, 211, 153)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text('+ Timeline reads are O(1): pre-computed', cacheX + 55, startY)
        p.text('+ Sub-millisecond read latency', cacheX + 55, startY + 14)
        p.fill(236, 72, 153)
        p.text('- Celebrity problem: 80M writes per tweet', cacheX + 55, startY + 36)
        p.text('- Write amplification: 6K tweets/s * avg fanout', cacheX + 55, startY + 50)
        p.text('- Minutes of delay for large fan-outs', cacheX + 55, startY + 64)

      } else if (mode === 'read') {
        /* User B reads their timeline */
        drawBox(p, readX, 80, 80, 34, [30, 60, 30], [52, 211, 153], 'User B\nReads Feed', 9)
        drawBox(p, cacheX, 80, 80, 34, [30, 30, 60], [99, 102, 241], 'Timeline\nService', 9)
        drawBox(p, graphX, 80, 80, 34, [50, 20, 20], [220, 80, 80], 'Social Graph\nDB', 9)

        drawArrow(p, readX - 40, 80, cacheX + 40, 80, [52, 211, 153, 160])
        drawArrow(p, cacheX - 40, 80, graphX + 40, 80, [99, 102, 241, 140])

        p.fill(160)
        p.textSize(7)
        p.text('get following list', (cacheX + graphX) / 2, 63)

        /* Fetch from each followed user's tweet store */
        const following = ['@alice', '@bob', '@cnn', '@elonmusk', '@taylor']
        const startY = 160
        const gap = 48

        for (let i = 0; i < following.length; i++) {
          const fy = startY + i * gap
          drawBox(p, svcX, fy, 80, 30, [30, 30, 60], [99, 102, 241], `${following[i]}\nRecent Tweets`, 8)
          drawArrow(p, graphX - 20, 97, svcX + 40, fy - 8, [220, 80, 80, 80])

          const prog = ((t * 0.4) - i * 0.12) % 2
          if (prog > 0 && prog < 1) {
            drawDot(p, svcX + 40, fy, cacheX - 40, 110, prog, [99, 102, 241])
          }
        }

        /* Merge sort box */
        drawBox(p, cacheX, 140, 80, 30, [50, 40, 20], [220, 170, 60], 'Merge Sort\n+ Rank', 9)
        drawArrow(p, cacheX, 155, cacheX, 180, [220, 170, 60, 140])
        drawBox(p, cacheX, 200, 80, 30, [30, 50, 30], [52, 211, 153], 'Ranked\nTimeline', 9)

        p.fill(52, 211, 153)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text('+ No write amplification', cacheX + 55, 160)
        p.text('+ Always fresh data', cacheX + 55, 174)
        p.fill(236, 72, 153)
        p.text('- Slow reads: must query N followed users', cacheX + 55, 196)
        p.text('- High read latency (100s of DB queries)', cacheX + 55, 210)
        p.text('- Cannot meet <200ms SLA at scale', cacheX + 55, 224)

      } else {
        /* Hybrid approach */
        p.fill(200)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Normal users (<10K followers): Fan-out on Write', canvasW / 2, 30)
        p.text('Celebrities (>10K followers): Fan-out on Read', canvasW / 2, 44)

        /* Left side: pre-computed cache */
        drawBox(p, cX, 110, 80, 30, [30, 30, 60], [99, 102, 241], 'Normal User\nPosts', 9)
        drawBox(p, svcX, 110, 80, 30, [50, 30, 30], [236, 72, 153], 'Fan-out\nService', 9)
        drawArrow(p, cX + 40, 110, svcX - 40, 110, [99, 102, 241, 140])

        drawBox(p, graphX, 180, 100, 34, [50, 30, 20], [255, 140, 50], 'Your Pre-computed\nTimeline Cache', 9)

        /* Fan-out writes for normal users */
        for (let i = 0; i < 3; i++) {
          const fy = 160 + i * 20
          const prog = ((t * 0.5) - i * 0.2) % 2
          if (prog > 0 && prog < 1) {
            drawDot(p, svcX + 20, 125, graphX - 50, fy, prog, [255, 140, 50])
          }
        }
        drawArrow(p, svcX + 20, 125, graphX - 50, 175, [236, 72, 153, 100])

        /* Right side: celebrity tweets fetched on demand */
        drawBox(p, cacheX + 30, 110, 80, 30, [50, 40, 10], [255, 200, 50], 'Celebrity\nTweet Store', 9)

        /* Reader */
        drawBox(p, graphX, 290, 90, 34, [30, 50, 30], [52, 211, 153], 'User Reads\nTimeline', 9)
        drawArrow(p, graphX, 273, graphX, 210, [52, 211, 153, 140])
        drawArrow(p, graphX + 30, 273, cacheX + 30, 125, [255, 200, 50, 120])

        p.fill(160)
        p.textSize(7)
        p.text('read cache', graphX - 30, 240)
        p.text('fetch celebrity tweets', cacheX - 10, 210)

        /* Merge */
        drawBox(p, graphX, 350, 100, 30, [50, 40, 20], [220, 170, 60], 'Merge + Rank\nCache + Celebrity', 8)
        drawArrow(p, graphX, 307, graphX, 335, [52, 211, 153, 140])

        /* Timeline read dot animation */
        const rp = (t * 0.4) % 2
        if (rp < 0.5) {
          drawDot(p, graphX, 273, graphX, 210, rp * 2, [255, 140, 50])
        } else if (rp < 1) {
          drawDot(p, graphX + 30, 273, cacheX + 30, 125, (rp - 0.5) * 2, [255, 200, 50])
        }

        /* Explanation */
        p.fill(52, 211, 153)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        const ex = canvasW * 0.05
        p.text('+ Best of both worlds: fast reads for most content', ex, 390)
        p.text('+ Celebrities do not cause write storms', ex, 404)
        p.fill(255, 200, 50)
        p.text('Threshold: ~10K followers (tunable)', ex + canvasW * 0.5, 390)
        p.text('Only ~0.1% of users are above threshold', ex + canvasW * 0.5, 404)
      }
    }
  }, [mode])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: Fan-out Strategy</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Fan-out is THE key design decision for Twitter. When User A posts a tweet, how do their
        followers see it? There are three approaches. Toggle between them to understand the
        tradeoffs.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setMode('write')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'write'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Fan-out on Write (Push)
        </button>
        <button
          onClick={() => setMode('read')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'read'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Fan-out on Read (Pull)
        </button>
        <button
          onClick={() => setMode('hybrid')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'hybrid'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Hybrid (Twitter&apos;s Approach)
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Deep Dive 2: Timeline Ranking (p5)                     */
/* ================================================================== */

function RankingSection() {
  const [showRanked, setShowRanked] = useState(true)

  const sketch = useCallback((p: p5) => {
    let canvasW = 800
    const canvasH = 380

    interface RankedTweet {
      author: string
      text: string
      age: string
      engagementScore: number
      authorScore: number
      interactionScore: number
      mediaBonus: number
      totalScore: number
      chronoOrder: number
    }

    const tweets: RankedTweet[] = [
      { author: '@bestfriend', text: 'Just landed in Tokyo!', age: '2m', engagementScore: 0.3, authorScore: 0.9, interactionScore: 0.95, mediaBonus: 0.4, totalScore: 0.92, chronoOrder: 1 },
      { author: '@news_bbc', text: 'Breaking: Market hits record high', age: '30s', engagementScore: 0.8, authorScore: 0.5, interactionScore: 0.2, mediaBonus: 0.0, totalScore: 0.45, chronoOrder: 0 },
      { author: '@techguru', text: 'New React 19 features are amazing', age: '5m', engagementScore: 0.6, authorScore: 0.7, interactionScore: 0.8, mediaBonus: 0.0, totalScore: 0.78, chronoOrder: 2 },
      { author: '@randomacct', text: 'Good morning everyone', age: '1m', engagementScore: 0.05, authorScore: 0.1, interactionScore: 0.05, mediaBonus: 0.0, totalScore: 0.08, chronoOrder: 3 },
      { author: '@colleague', text: 'Check out my new project demo', age: '8m', engagementScore: 0.4, authorScore: 0.6, interactionScore: 0.85, mediaBonus: 0.3, totalScore: 0.75, chronoOrder: 4 },
      { author: '@celeb', text: 'Thank you for 10M followers!', age: '15m', engagementScore: 0.95, authorScore: 0.3, interactionScore: 0.1, mediaBonus: 0.2, totalScore: 0.35, chronoOrder: 5 },
    ]

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text(showRanked ? 'ML-Ranked Timeline' : 'Reverse Chronological Timeline', canvasW / 2, 8)

      const sorted = [...tweets].sort((a, b) =>
        showRanked ? b.totalScore - a.totalScore : a.chronoOrder - b.chronoOrder
      )

      const startY = 35
      const rowH = 55
      const leftX = 20
      const barStart = canvasW * 0.55

      /* Column headers */
      p.fill(180)
      p.textSize(8)
      p.textAlign(p.LEFT, p.TOP)
      p.text('TWEET', leftX, startY)
      p.text('ENGAGEMENT', barStart, startY)
      p.text('AUTHOR', barStart + 80, startY)
      p.text('INTERACTION', barStart + 150, startY)
      p.text('TOTAL', barStart + 230, startY)

      for (let i = 0; i < sorted.length; i++) {
        const tw = sorted[i]
        const y = startY + 16 + i * rowH

        /* Rank number */
        p.fill(showRanked ? 52 : 120, showRanked ? 211 : 120, showRanked ? 153 : 120)
        p.textSize(14)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`#${i + 1}`, leftX + 20, y + 6)

        /* Tweet preview */
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text(tw.author, leftX + 28, y + 2)
        p.fill(180)
        p.textSize(8)
        p.text(tw.text, leftX + 28, y + 16)
        p.fill(120)
        p.text(tw.age + ' ago', leftX + 28, y + 28)

        /* Score bars */
        const barW = 60
        const barH = 8
        const scores = [
          { val: tw.engagementScore, x: barStart, color: [99, 102, 241] },
          { val: tw.authorScore, x: barStart + 80, color: [236, 72, 153] },
          { val: tw.interactionScore, x: barStart + 150, color: [52, 211, 153] },
          { val: tw.totalScore, x: barStart + 230, color: [255, 200, 50] },
        ]

        for (const s of scores) {
          p.fill(40)
          p.noStroke()
          p.rect(s.x, y + 10, barW, barH, 2)
          p.fill(s.color[0], s.color[1], s.color[2])
          p.rect(s.x, y + 10, barW * s.val, barH, 2)
          p.fill(200)
          p.textSize(7)
          p.textAlign(p.LEFT, p.TOP)
          p.text((s.val * 100).toFixed(0) + '%', s.x + barW + 3, y + 9)
        }

        /* Separator line */
        if (i < sorted.length - 1) {
          p.stroke(40)
          p.strokeWeight(0.5)
          p.line(leftX, y + rowH - 6, canvasW - 20, y + rowH - 6)
        }
      }
    }
  }, [showRanked])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: Timeline Ranking</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Modern Twitter does not show pure reverse-chronological feeds. An ML ranker scores each
        tweet based on: engagement rate, your history with the author, media type, and tweet
        recency. Notice how ranking surfaces your best friend&apos;s tweet above breaking news
        you do not normally engage with.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowRanked(true)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            showRanked ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ML-Ranked Feed
        </button>
        <button
          onClick={() => setShowRanked(false)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            !showRanked ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Chronological Feed
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Deep Dive 3: Search & Trending (p5)                    */
/* ================================================================== */

function SearchTrendingSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 400

    const hashtags = ['#AI', '#Bitcoin', '#WorldCup', '#React', '#TypeScript', '#NASA', '#Olympics', '#Python', '#Tesla', '#Climate', '#GameDay', '#Music', '#Startup', '#OpenAI', '#SpaceX']

    /* Count-Min Sketch simulation */
    const ROWS = 3
    const COLS = 8
    const cms: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0) as number[])
    const trueCounts: Record<string, number> = {}

    function hashFn(s: string, row: number): number {
      let h = row * 31
      for (let i = 0; i < s.length; i++) h = (h * 37 + s.charCodeAt(i)) % COLS
      return h
    }

    function cmsAdd(tag: string) {
      for (let r = 0; r < ROWS; r++) {
        cms[r][hashFn(tag, r)]++
      }
      trueCounts[tag] = (trueCounts[tag] || 0) + 1
    }

    function cmsQuery(tag: string): number {
      let min = Infinity
      for (let r = 0; r < ROWS; r++) {
        min = Math.min(min, cms[r][hashFn(tag, r)])
      }
      return min
    }

    /* Streaming tweets */
    interface StreamTweet {
      text: string
      tag: string
      x: number
      y: number
      alpha: number
    }
    const stream: StreamTweet[] = []
    let nextTweet = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
      /* Pre-seed some data */
      for (let i = 0; i < 40; i++) {
        const tag = hashtags[Math.floor(Math.random() * 5)]
        cmsAdd(tag)
      }
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Search & Trending: Count-Min Sketch', canvasW / 2, 8)

      /* Add new tweets periodically */
      if (t > nextTweet) {
        nextTweet = t + 0.3 + Math.random() * 0.4
        const tag = hashtags[Math.floor(Math.random() * hashtags.length)]
        /* Weight some hashtags more */
        const hot = ['#AI', '#WorldCup', '#Bitcoin']
        const extra = hot.includes(tag) ? 3 : 1
        for (let e = 0; e < extra; e++) cmsAdd(tag)
        stream.push({
          text: `"...${tag}..."`,
          tag,
          x: 30 + Math.random() * (canvasW * 0.3),
          y: 30,
          alpha: 255,
        })
      }

      /* Draw streaming tweets falling */
      for (let i = stream.length - 1; i >= 0; i--) {
        const st = stream[i]
        st.y += 1.2
        st.alpha -= 1.5
        if (st.alpha <= 0) { stream.splice(i, 1); continue }
        p.fill(180, 180, 255, st.alpha)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text(st.text, st.x, st.y)
      }

      /* Draw CMS grid */
      const gridX = canvasW * 0.42
      const gridY = 60
      const cellW = 48
      const cellH = 30

      p.fill(200)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Count-Min Sketch (3 hash functions \u00d7 8 buckets)', gridX + (COLS * cellW) / 2, gridY - 16)

      for (let r = 0; r < ROWS; r++) {
        p.fill(160)
        p.textSize(8)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`h${r + 1}()`, gridX - 6, gridY + r * cellH + cellH / 2)
        for (let c = 0; c < COLS; c++) {
          const cx = gridX + c * cellW
          const cy = gridY + r * cellH
          const val = cms[r][c]
          const intensity = Math.min(val / 30, 1)
          p.fill(20 + intensity * 40, 20 + intensity * 20, 50 + intensity * 180)
          p.stroke(60, 60, 100)
          p.strokeWeight(0.5)
          p.rect(cx, cy, cellW, cellH)
          p.fill(255)
          p.noStroke()
          p.textSize(9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(String(val), cx + cellW / 2, cy + cellH / 2)
        }
      }

      /* Trending list */
      const trendX = canvasW * 0.42
      const trendY = gridY + ROWS * cellH + 30

      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Top Trending (from CMS):', trendX, trendY)

      const estimates = hashtags.map(tag => ({ tag, count: cmsQuery(tag), trueCount: trueCounts[tag] || 0 }))
      estimates.sort((a, b) => b.count - a.count)
      const top10 = estimates.slice(0, 10)

      const maxCount = Math.max(top10[0]?.count || 1, 1)
      for (let i = 0; i < top10.length; i++) {
        const ty = trendY + 20 + i * 22
        const item = top10[i]
        const barW = (item.count / maxCount) * 180

        p.fill(180)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`${i + 1}. ${item.tag}`, trendX + 90, ty)

        /* Bar */
        p.fill(99, 102, 241, 180)
        p.noStroke()
        p.rect(trendX + 96, ty + 1, barW, 12, 2)

        p.fill(200)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`est:${item.count}  true:${item.trueCount}`, trendX + 100 + barW, ty + 1)
      }

      /* Inverted index illustration (right side) */
      const iiX = canvasW * 0.02
      const iiY = trendY

      p.fill(200)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Inverted Index (Elasticsearch):', iiX, iiY)

      const indexEntries = [
        { term: '#AI', postings: 'tweet_42, tweet_108, tweet_215, ...' },
        { term: '#Bitcoin', postings: 'tweet_7, tweet_89, tweet_301, ...' },
        { term: '#WorldCup', postings: 'tweet_55, tweet_133, tweet_290, ...' },
        { term: 'amazing', postings: 'tweet_12, tweet_88, tweet_193, ...' },
      ]

      for (let i = 0; i < indexEntries.length; i++) {
        const ey = iiY + 18 + i * 20
        p.fill(255, 200, 50)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text(indexEntries[i].term, iiX + 4, ey)
        p.fill(120)
        p.text(' \u2192 ' + indexEntries[i].postings, iiX + 60, ey)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Search & Trending Topics</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Tweet search uses an <strong>inverted index</strong> (Elasticsearch) mapping terms to tweet
        IDs. Trending topics use a <strong>Count-Min Sketch</strong> {'\u2014'} a probabilistic data
        structure that counts hashtag frequencies in a sliding window with bounded memory. Watch
        tweets stream in and see how the CMS updates and the trending list changes in real time.
        Note how CMS estimates may slightly overcount (never undercount).
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 — Deep Dive 4: Social Graph at Scale                     */
/* ================================================================== */

function SocialGraphSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 340

    interface GraphNode {
      id: string
      x: number
      y: number
      r: number
      color: [number, number, number]
    }

    const nodes: GraphNode[] = []
    const edges: Array<{ from: number; to: number }> = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')

      /* Build a small social graph */
      const userNames = ['You', 'Alice', 'Bob', 'CNN', 'Elon', 'Taylor', 'Dev1', 'Dev2', 'News2', 'Friend']
      const cx = canvasW * 0.25
      const cy = canvasH * 0.5
      for (let i = 0; i < userNames.length; i++) {
        const angle = (i / userNames.length) * Math.PI * 2 - Math.PI / 2
        const r = i === 0 ? 0 : 100 + Math.random() * 40
        const isCeleb = ['CNN', 'Elon', 'Taylor'].includes(userNames[i])
        nodes.push({
          id: userNames[i],
          x: i === 0 ? cx : cx + Math.cos(angle) * r,
          y: i === 0 ? cy : cy + Math.sin(angle) * r,
          r: isCeleb ? 18 : 12,
          color: isCeleb ? [236, 72, 153] : i === 0 ? [52, 211, 153] : [99, 102, 241],
        })
      }
      /* You follow several */
      edges.push({ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 4 }, { from: 0, to: 5 })
      /* Others follow each other */
      edges.push({ from: 1, to: 2 }, { from: 2, to: 6 }, { from: 6, to: 7 }, { from: 3, to: 8 }, { from: 9, to: 0 })
      edges.push({ from: 7, to: 0 }, { from: 1, to: 9 }, { from: 5, to: 3 })
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      const ctx = p.drawingContext as CanvasRenderingContext2D

      /* Title */
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Social Graph: Follow Relationships', canvasW * 0.25, 8)

      /* Draw edges */
      for (const edge of edges) {
        const fromN = nodes[edge.from]
        const toN = nodes[edge.to]
        const isYourFollow = edge.from === 0
        if (isYourFollow) {
          p.stroke(52, 211, 153, 120)
          p.strokeWeight(2)
        } else {
          p.stroke(60, 60, 90, 80)
          p.strokeWeight(1)
        }
        p.line(fromN.x, fromN.y, toN.x, toN.y)

        /* Arrow head */
        const angle = Math.atan2(toN.y - fromN.y, toN.x - fromN.x)
        const ax = toN.x - Math.cos(angle) * (toN.r + 3)
        const ay = toN.y - Math.sin(angle) * (toN.r + 3)
        p.fill(isYourFollow ? 52 : 60, isYourFollow ? 211 : 60, isYourFollow ? 153 : 90, isYourFollow ? 160 : 80)
        p.noStroke()
        p.triangle(
          ax, ay,
          ax - 6 * Math.cos(angle - 0.4), ay - 6 * Math.sin(angle - 0.4),
          ax - 6 * Math.cos(angle + 0.4), ay - 6 * Math.sin(angle + 0.4),
        )
      }

      /* Draw nodes */
      for (const node of nodes) {
        const pulse = node.id === 'You' ? Math.sin(t * 3) * 3 : 0
        p.fill(node.color[0], node.color[1], node.color[2])
        p.noStroke()
        p.ellipse(node.x, node.y, node.r * 2 + pulse, node.r * 2 + pulse)
        p.fill(255)
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(node.id, node.x, node.y)
      }

      /* Right side: storage explanation */
      const rX = canvasW * 0.55
      const rY = 30

      p.fill(200)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Storage: Adjacency Lists in Key-Value Store', rX, rY)

      p.fill(160)
      p.textSize(9)
      const entries = [
        { key: 'following:You', val: '[Alice, Bob, CNN, Elon, Taylor]' },
        { key: 'following:Alice', val: '[Bob, Friend]' },
        { key: 'followers:You', val: '[Friend, Dev2]' },
        { key: 'followers:Alice', val: '[You]' },
        { key: 'followers:Elon', val: '[You, ... 80M more]' },
      ]
      for (let i = 0; i < entries.length; i++) {
        const ey = rY + 22 + i * 22
        p.fill(255, 200, 50)
        p.textSize(9)
        p.text(entries[i].key, rX, ey)
        p.fill(140)
        p.text(' \u2192 ' + entries[i].val, rX + 130, ey)
      }

      /* Sharding explanation */
      p.fill(200)
      p.textSize(11)
      p.text('Sharding Strategy', rX, rY + 150)

      const shards = [
        { label: 'Shard 0', range: 'user_id % 16 = 0', color: [99, 102, 241] },
        { label: 'Shard 1', range: 'user_id % 16 = 1', color: [236, 72, 153] },
        { label: 'Shard 2', range: 'user_id % 16 = 2', color: [52, 211, 153] },
        { label: '...', range: '', color: [100, 100, 100] },
        { label: 'Shard 15', range: 'user_id % 16 = 15', color: [255, 200, 50] },
      ]

      for (let i = 0; i < shards.length; i++) {
        const sy = rY + 172 + i * 28
        const s = shards[i]
        drawBox(p, rX + 50, sy, 90, 22, [30, 30, 40], s.color as [number, number, number], s.label, 8)
        p.fill(140)
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(s.range, rX + 105, sy)
      }

      /* Note about bidirectional */
      ctx.globalAlpha = 0.8
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('"Who does X follow?" \u2192 O(1) lookup by follower_id', rX, canvasH - 50)
      p.text('"Who follows X?" \u2192 O(1) via reverse index (followee_id)', rX, canvasH - 36)
      p.text('40B edges, sharded by user_id across 16+ nodes', rX, canvasH - 22)
      ctx.globalAlpha = 1.0
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Social Graph at Scale</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The follow graph has 40 billion edges. Each user&apos;s follows and followers are stored
        as adjacency lists in a key-value store, with both forward (following) and reverse
        (followers) indexes. The graph is sharded by user_id. Celebrity nodes like Elon (80M
        followers) are highlighted {'\u2014'} their follower lists span many shards.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 10 — Scaling Strategy                                      */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">10. Scaling Strategy</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">Timeline Cache (Redis)</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Sharded by user_id across Redis cluster</li>
            <li>Each user: sorted set of ~800 tweet IDs</li>
            <li>Total: ~1.3 TB across cluster + replicas</li>
            <li>TTL: evict timelines of inactive users (30 days)</li>
            <li>On cache miss: rebuild from tweet DB + follow graph</li>
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">Tweet Storage</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Sharded MySQL or Cassandra by tweet_id</li>
            <li>Snowflake IDs: time-sortable, globally unique</li>
            <li>Hot tweets cached in Memcached/Redis</li>
            <li>Cold storage tier for tweets older than 30 days</li>
            <li>Read replicas for user timeline queries</li>
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">Search (Elasticsearch)</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Inverted index sharded by time range</li>
            <li>Recent tweets (7 days) in hot cluster</li>
            <li>Older tweets in warm/cold tiers</li>
            <li>Near-real-time indexing via Kafka</li>
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">Media (CDN + Object Store)</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Images/videos stored in S3-compatible object store</li>
            <li>CDN (CloudFront/Akamai) for global delivery</li>
            <li>Thumbnail generation on upload</li>
            <li>Video transcoding for multiple bitrates</li>
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">CQRS: Separate Read/Write</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Write path: Tweet Service {'\u2192'} DB + Kafka {'\u2192'} Fan-out</li>
            <li>Read path: Timeline Service {'\u2192'} Redis cache {'\u2192'} merge celebrity tweets</li>
            <li>Completely independent scaling of reads vs writes</li>
            <li>Read path scales horizontally with more Redis shards</li>
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold text-sm mb-2">Rate Limiting & Anti-Spam</h4>
          <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
            <li>Token bucket per user: 300 tweets/day, 1000 likes/day</li>
            <li>Sliding window rate limiter at API gateway</li>
            <li>ML-based spam detection on tweet content</li>
            <li>CAPTCHAs for suspicious accounts</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 — Fault Tolerance                                       */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">11. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold text-sm mb-2">Timeline Cache Failure</h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            The timeline cache in Redis is <strong>rebuildable</strong>. If a Redis node dies, we
            lose cached timelines for those users, but can reconstruct them from the tweet store +
            follow graph. Users experience a brief latency spike (first read triggers rebuild) but
            no data loss. Redis Cluster provides automatic failover to replicas.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold text-sm mb-2">Fan-out Service Failure</h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            Tweet writes are <strong>durable in the DB first</strong>. Fan-out is async via a
            message queue (Kafka). If the fan-out service crashes mid-way, messages remain in
            the queue and are reprocessed on recovery. Worst case: some followers see a tweet a
            few minutes late, but the tweet itself is never lost. Idempotent fan-out operations
            prevent duplicate timeline entries.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold text-sm mb-2">Circuit Breaker on Celebrity Fan-out</h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            If a celebrity with 80M followers posts during a traffic spike, the fan-out service
            detects the large follower count and <strong>skips push fan-out entirely</strong>,
            falling back to pull-on-read for that tweet. A circuit breaker prevents cascading
            failure from overwhelming the timeline cache cluster.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold text-sm mb-2">Read-After-Write Consistency</h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            When a user posts a tweet, they expect to see it in their own timeline immediately.
            The client optimistically inserts the tweet into the local timeline view. On the
            backend, we route the user&apos;s own timeline reads to the primary DB for a short
            window (e.g., 5 seconds) to guarantee read-after-write consistency, while other
            followers continue reading from eventually-consistent caches.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold text-sm mb-2">Multi-Region Failover</h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            Deploy across 3+ regions. Each region has a full copy of the timeline cache and
            read replicas of the tweet DB. Writes go to a primary region and are replicated
            async. If a region goes down, DNS-based failover routes traffic to the nearest
            healthy region. Cross-region replication lag of 100-500ms is acceptable given our
            eventual consistency model.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 — Tradeoffs                                             */
/* ================================================================== */

function TradeoffsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">12. Key Tradeoffs</h2>

      <div className="space-y-4">
        {[
          {
            left: 'Fan-out on Write',
            right: 'Fan-out on Read',
            leftPros: 'Ultra-fast reads (pre-computed), simple read path',
            rightPros: 'No write amplification, always fresh',
            tension: 'Read latency vs. write cost. Hybrid resolves this by splitting on follower count threshold.',
          },
          {
            left: 'Pre-computed Timeline',
            right: 'On-demand Timeline',
            leftPros: 'Sub-ms reads from Redis, predictable latency',
            rightPros: 'Always up to date, no stale data',
            tension: 'Staleness vs. speed. Acceptable to show tweets a few seconds late for most users.',
          },
          {
            left: 'Exact Trending Counts',
            right: 'Approximate (Count-Min Sketch)',
            leftPros: '100% accurate counts',
            rightPros: 'Bounded memory (KB vs GB), near-real-time',
            tension: 'Accuracy vs. memory/speed. CMS may overcount by <5%, which is fine for trending.',
          },
          {
            left: 'ML-Ranked Feed',
            right: 'Chronological Feed',
            leftPros: 'Higher engagement, surfaces relevant content',
            rightPros: 'User control, transparency, no filter bubble',
            tension: 'Engagement optimization vs. user autonomy. Twitter offers both as a toggle.',
          },
          {
            left: 'Strong Consistency',
            right: 'Eventual Consistency',
            leftPros: 'User sees latest state immediately everywhere',
            rightPros: 'Higher availability, lower latency, simpler scaling',
            tension: 'Use strong consistency only for the posting user (read-after-write). Everyone else gets eventual.',
          },
        ].map((tradeoff, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-green-400 font-semibold text-sm">{tradeoff.left}</span>
              <span className="text-gray-500 text-sm">vs.</span>
              <span className="text-blue-400 font-semibold text-sm">{tradeoff.right}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <p className="text-gray-400 text-xs">
                <span className="text-green-400">+</span> {tradeoff.leftPros}
              </p>
              <p className="text-gray-400 text-xs">
                <span className="text-blue-400">+</span> {tradeoff.rightPros}
              </p>
            </div>
            <p className="text-yellow-400 text-xs italic">{tradeoff.tension}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignTwitter() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold text-white">
          Design Twitter (Social Media Feed)
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          The classic system design interview question. How do you build a real-time social
          media platform that serves 200M daily active users, handles 500M tweets/day, and
          delivers home timelines in under 200ms?
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <FanoutSection />
      <RankingSection />
      <SearchTrendingSection />
      <SocialGraphSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />

      <footer className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
        System Design Case Study {'\u2014'} oneML Learning Platform
      </footer>
    </div>
  )
}
