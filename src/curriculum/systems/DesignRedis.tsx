import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-redis',
  title: 'Design Redis',
  description:
    'System design deep dive: an in-memory key-value store with persistence, replication, pub/sub, and rich data structures',
  track: 'systems',
  order: 13,
  tags: [
    'redis',
    'key-value',
    'in-memory',
    'persistence',
    'replication',
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

/* ================================================================== */
/*  Section 1 -- Problem Statement                                     */
/* ================================================================== */

function ProblemStatementSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design an <strong className="text-white">in-memory key-value store</strong> that supports
        sub-millisecond reads and writes, rich data structures beyond simple strings, publish/subscribe
        messaging, and optional durability. This is Redis: the Swiss-army knife of infrastructure that
        powers caching layers, session stores, rate limiters, leaderboards, and real-time analytics at
        companies from Twitter to Stripe.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The core tension: we want the speed of RAM but the durability of disk. We want the simplicity
        of a single-threaded model but the throughput to handle hundreds of thousands of operations per
        second. We want a single-node tool that also scales horizontally.
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
        <li><strong className="text-white">Key-value operations:</strong> GET, SET, DEL, EXISTS, KEYS pattern matching</li>
        <li><strong className="text-white">TTL and expiry:</strong> SET key value EX seconds, EXPIRE key seconds, TTL key</li>
        <li><strong className="text-white">Data structures:</strong>
          <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-gray-400">
            <li>Strings (with INCR/DECR for atomic counters)</li>
            <li>Lists (LPUSH, RPUSH, LPOP, RPOP, LRANGE)</li>
            <li>Hashes (HSET, HGET, HGETALL)</li>
            <li>Sets (SADD, SMEMBERS, SINTER, SUNION)</li>
            <li>Sorted Sets (ZADD, ZRANGE, ZRANGEBYSCORE, ZRANK)</li>
          </ul>
        </li>
        <li><strong className="text-white">Pub/Sub:</strong> SUBSCRIBE channel, PUBLISH channel message, PSUBSCRIBE for pattern-based subscriptions</li>
        <li><strong className="text-white">Transactions:</strong> MULTI/EXEC for atomic command batches, WATCH for optimistic locking</li>
        <li><strong className="text-white">Lua scripting:</strong> EVAL for server-side scripts that execute atomically</li>
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
              <td className="py-2 px-4 font-medium">Latency</td>
              <td className="py-2 px-4">Sub-millisecond for reads and writes (p99 &lt; 1ms)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Throughput</td>
              <td className="py-2 px-4">100K+ operations/sec on a single node</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Persistence</td>
              <td className="py-2 px-4">Configurable: pure in-memory, periodic snapshots, or append-only log</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Replication</td>
              <td className="py-2 px-4">Async master-replica with automatic failover via Sentinel</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Availability</td>
              <td className="py-2 px-4">99.99% with Sentinel/Cluster (automatic failover in seconds)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Consistency</td>
              <td className="py-2 px-4">Eventual (async replication); strong on single node</td>
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
        <p className="text-white font-bold font-sans">Memory sizing:</p>
        <p>100M keys x 1KB avg value = <span className="text-green-400">100 GB RAM</span></p>
        <p>+ key overhead (~64 bytes/key for hash table entry) = 100M x 64B = <span className="text-green-400">~6.4 GB overhead</span></p>
        <p>Total: <span className="text-yellow-400">~107 GB</span> (fits in a single modern server with 128 GB RAM)</p>

        <p className="text-white font-bold font-sans pt-2">Throughput (single-threaded event loop):</p>
        <p>Simple GET/SET: ~100ns per operation in memory</p>
        <p>Network round-trip overhead: ~50-100us per command</p>
        <p>With pipelining (batch 100 commands): <span className="text-green-400">500K-1M ops/sec</span></p>
        <p>Without pipelining: <span className="text-green-400">~100K ops/sec</span> (bottleneck is network, not CPU)</p>

        <p className="text-white font-bold font-sans pt-2">Persistence cost:</p>
        <p>RDB snapshot of 100GB: ~2-5 minutes (fork + write to disk)</p>
        <p>AOF at 100K writes/sec x 100 bytes avg = <span className="text-green-400">10 MB/s disk write</span></p>
        <p>AOF rewrite compacts the file periodically (background process)</p>

        <p className="text-white font-bold font-sans pt-2">Replication bandwidth:</p>
        <p>100K writes/sec x 100 bytes = <span className="text-green-400">10 MB/s per replica</span></p>
        <p>Full resync of 100GB dataset: ~10 min on 1 Gbps link</p>
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
        Redis uses its own text-based protocol (RESP) rather than HTTP. Commands are the API.
        Each command is atomic and executes in the single-threaded event loop.
      </p>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-3">
        <p className="text-white font-bold">// String operations</p>
        <p>SET user:1001 &quot;{'{'}name: Alice{'}'}&quot; EX 3600  <span className="text-gray-500">// set with 1hr TTL</span></p>
        <p>GET user:1001                                <span className="text-gray-500">// returns the JSON string</span></p>
        <p>INCR page:views:home                        <span className="text-gray-500">// atomic counter</span></p>

        <p className="text-white font-bold pt-2">// List operations (message queue pattern)</p>
        <p>LPUSH queue:emails &quot;job-payload&quot;            <span className="text-gray-500">// push to head</span></p>
        <p>BRPOP queue:emails 30                       <span className="text-gray-500">// blocking pop from tail, 30s timeout</span></p>

        <p className="text-white font-bold pt-2">// Sorted set (leaderboard)</p>
        <p>ZADD leaderboard 9500 &quot;player:42&quot;          <span className="text-gray-500">// add with score</span></p>
        <p>ZREVRANGE leaderboard 0 9 WITHSCORES        <span className="text-gray-500">// top 10</span></p>
        <p>ZRANK leaderboard &quot;player:42&quot;               <span className="text-gray-500">// rank of player</span></p>

        <p className="text-white font-bold pt-2">// Hash (object storage)</p>
        <p>HSET product:99 name &quot;Widget&quot; price 29.99   <span className="text-gray-500">// set fields</span></p>
        <p>HGETALL product:99                          <span className="text-gray-500">// get all fields</span></p>

        <p className="text-white font-bold pt-2">// Pub/Sub</p>
        <p>SUBSCRIBE notifications                     <span className="text-gray-500">// listen on channel</span></p>
        <p>PUBLISH notifications &quot;new-order&quot;           <span className="text-gray-500">// broadcast to subscribers</span></p>

        <p className="text-white font-bold pt-2">// Transaction</p>
        <p>MULTI                                       <span className="text-gray-500">// begin atomic batch</span></p>
        <p>  INCR balance:alice -100</p>
        <p>  INCR balance:bob 100</p>
        <p>EXEC                                        <span className="text-gray-500">// execute atomically</span></p>
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
      <p className="text-gray-300 leading-relaxed">
        Redis stores all data in a global hash table mapping keys (always strings) to typed value objects.
        Each value object knows its type and encoding, allowing Redis to choose the most memory-efficient
        representation.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Type</th>
              <th className="py-2 px-4 text-white">Internal Encoding</th>
              <th className="py-2 px-4 text-white">When Used</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-blue-400">String</td>
              <td className="py-2 px-4">int (if numeric), embstr (&le;44 bytes), raw SDS</td>
              <td className="py-2 px-4">Caching, counters, flags</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-green-400">List</td>
              <td className="py-2 px-4">quicklist (linked list of ziplists)</td>
              <td className="py-2 px-4">Queues, recent items, timelines</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-yellow-400">Hash</td>
              <td className="py-2 px-4">ziplist (small) or hashtable (large)</td>
              <td className="py-2 px-4">Object storage, user profiles</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-purple-400">Set</td>
              <td className="py-2 px-4">intset (all ints, small) or hashtable</td>
              <td className="py-2 px-4">Tags, unique items, intersections</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium text-red-400">Sorted Set</td>
              <td className="py-2 px-4">ziplist (small) or skiplist + hashtable</td>
              <td className="py-2 px-4">Leaderboards, time-series, priority queues</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Key insight:</strong> The skip list backing sorted sets
          gives O(log N) insert, delete, and range queries. Combined with a hash table for O(1)
          score lookups by member, this dual structure is what makes ZRANGEBYSCORE and ZRANK both fast.
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
      p.createCanvas(w, 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const cx = w / 2

      // Title
      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Redis Single-Node Architecture', cx, 10)

      // Clients
      const clientY = 60
      const clientColors: [number, number, number] = [100, 180, 255]
      for (let i = 0; i < 4; i++) {
        const cx2 = w * 0.15 + i * (w * 0.23)
        drawBox(p, cx2, clientY, 80, 32, [20, 40, 70], clientColors, `Client ${i + 1}`, 9)
      }

      // Event loop
      const loopY = 160
      const loopW = w * 0.6
      p.fill(25, 50, 40)
      p.stroke(80, 200, 120)
      p.strokeWeight(2)
      p.rect(cx - loopW / 2, loopY - 30, loopW, 60, 8)
      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(12)
      p.text('Single-Threaded Event Loop (epoll/kqueue)', cx, loopY - 8)
      p.textSize(9)
      p.fill(150)
      p.text('multiplexes thousands of client connections', cx, loopY + 10)

      // Spinning indicator
      const spinR = 12
      const spinX = cx + loopW / 2 - 30
      const spinY = loopY
      p.stroke(80, 200, 120)
      p.strokeWeight(2)
      p.noFill()
      p.arc(spinX, spinY, spinR * 2, spinR * 2, t * 3, t * 3 + Math.PI * 1.5)

      // Connection lines from clients to event loop
      for (let i = 0; i < 4; i++) {
        const cx2 = w * 0.15 + i * (w * 0.23)
        const progress = ((t * 0.7 + i * 0.25) % 1)
        drawArrow(p, cx2, clientY + 18, cx, loopY - 32, [100, 180, 255, 120], 1)
        drawMovingDot(p, cx2, clientY + 18, cx, loopY - 32, progress, [100, 200, 255], 6)
      }

      // Command processor
      const procY = 250
      drawBox(p, cx, procY, 160, 36, [50, 30, 20], [255, 160, 80], 'Command Processor', 10)
      drawArrow(p, cx, loopY + 32, cx, procY - 20, [80, 200, 120, 200])

      // Hash table (main keyspace)
      const htY = 340
      const htX = cx - w * 0.25
      drawBox(p, htX, htY, 140, 50, [40, 20, 50], [180, 120, 255], 'Main Hash Table', 10)
      p.fill(150)
      p.textSize(8)
      p.text('(keyspace dict)', htX, htY + 16)

      // Data structures
      const dsY = 340
      const dsX = cx + w * 0.05
      drawBox(p, dsX, dsY, 100, 50, [50, 30, 20], [255, 160, 80], 'Skip Lists', 9)

      const ds2X = cx + w * 0.25
      drawBox(p, ds2X, dsY, 100, 50, [20, 40, 50], [80, 180, 255], 'Quicklists', 9)

      // AOF / RDB
      const persistY = 420
      const aofX = cx - w * 0.15
      const rdbX = cx + w * 0.15
      drawBox(p, aofX, persistY, 110, 30, [30, 30, 50], [120, 120, 200], 'AOF (disk)', 9)
      drawBox(p, rdbX, persistY, 110, 30, [30, 30, 50], [120, 120, 200], 'RDB (disk)', 9)

      // Arrows from processor to storage
      drawArrow(p, cx - 30, procY + 20, htX, htY - 28, [180, 120, 255, 180])
      drawArrow(p, cx, procY + 20, dsX, dsY - 28, [255, 160, 80, 180])
      drawArrow(p, cx + 30, procY + 20, ds2X, dsY - 28, [80, 180, 255, 180])

      // Persist arrows
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      drawArrow(p, htX, htY + 28, aofX, persistY - 18, [120, 120, 200, 140])
      drawArrow(p, htX + 30, htY + 28, rdbX, persistY - 18, [120, 120, 200, 140])
      ctx.setLineDash([])

      // Animated write flowing through
      const writeProgress = (t * 0.4) % 1
      if (writeProgress < 0.5) {
        const p2 = writeProgress * 2
        drawMovingDot(p, cx, loopY + 32, cx, procY - 20, p2, [255, 200, 80], 7)
      } else {
        const p2 = (writeProgress - 0.5) * 2
        drawMovingDot(p, cx - 30, procY + 20, htX, htY - 28, p2, [255, 200, 80], 7)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis runs a <strong className="text-white">single-threaded event loop</strong> that
        multiplexes thousands of client connections using OS-level I/O multiplexing (epoll on Linux,
        kqueue on macOS). Every command executes atomically in this loop -- no locks, no context
        switches, no race conditions. This is the single most important design decision in Redis.
      </p>
      <P5Sketch sketch={sketch} height={440} />
      <p className="text-gray-300 leading-relaxed">
        The event loop reads commands from client sockets, executes them against the in-memory data
        structures, and writes responses back. Because everything is in memory and single-threaded,
        each operation completes in microseconds. The bottleneck is network I/O, not computation.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8a -- Deep Dive: Persistence                               */
/* ================================================================== */

function PersistenceSection() {
  const [mode, setMode] = useState<'rdb' | 'aof'>('rdb')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 320)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      p.background(15, 15, 25)
      const m = modeRef.current

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text(m === 'rdb' ? 'RDB Snapshots (Point-in-Time Dumps)' : 'AOF (Append-Only File)', w / 2, 10)

      if (m === 'rdb') {
        drawRDBTimeline(p, t, w)
      } else {
        drawAOFTimeline(p, t, w)
      }
    }

    function drawRDBTimeline(p: p5, t: number, w: number) {
      const timelineY = 80
      const margin = 60

      // Timeline
      p.stroke(80)
      p.strokeWeight(2)
      p.line(margin, timelineY, w - margin, timelineY)
      p.fill(80)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('time', w - margin + 5, timelineY - 5)

      // Writes (small dots along timeline)
      const writeY = timelineY - 30
      p.fill(255)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.textSize(9)
      p.text('writes', margin + 20, writeY - 8)
      for (let i = 0; i < 30; i++) {
        const x = margin + 40 + i * ((w - 2 * margin - 60) / 30)
        const pulse = Math.sin(t * 4 + i * 0.5) * 0.5 + 0.5
        p.fill(100, 200, 120, 100 + pulse * 155)
        p.noStroke()
        p.ellipse(x, writeY, 4, 4)
      }

      // RDB snapshot points
      const snapY = timelineY + 40
      const snaps = [0.0, 0.33, 0.66, 1.0]
      p.fill(255)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('RDB snapshots (fork + dump)', w / 2, snapY + 30)

      for (let i = 0; i < snaps.length; i++) {
        const x = margin + 40 + snaps[i] * (w - 2 * margin - 80)
        // Vertical line from timeline to snapshot
        p.stroke(100, 150, 255, 150)
        p.strokeWeight(1)
        p.line(x, timelineY, x, snapY)
        // Snapshot box
        drawBox(p, x, snapY, 50, 22, [20, 30, 60], [100, 150, 255], `snap`, 8)
      }

      // Data loss window highlight
      const lossStart = margin + 40 + 0.66 * (w - 2 * margin - 80)
      const lossEnd = margin + 40 + 1.0 * (w - 2 * margin - 80)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.globalAlpha = 0.15
      p.fill(255, 80, 80)
      p.noStroke()
      p.rect(lossStart, timelineY - 40, lossEnd - lossStart, 40)
      ctx.globalAlpha = 1.0

      p.fill(255, 100, 100)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('data loss window on crash', (lossStart + lossEnd) / 2, timelineY + 70)

      // Restart box
      const restartY = 220
      drawBox(p, w / 2, restartY, 200, 30, [30, 50, 30], [80, 200, 120], 'Fast restart: load .rdb file', 9)

      // Properties
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      const propsX = margin
      const propsY = 260
      p.text('+ Compact binary format, fast to load', propsX, propsY)
      p.text('+ Minimal performance impact (fork-based)', propsX, propsY + 14)
      p.fill(255, 130, 130)
      p.text('- Data loss between snapshots', propsX, propsY + 28)
      p.text('- fork() doubles memory briefly (copy-on-write)', propsX, propsY + 42)
    }

    function drawAOFTimeline(p: p5, t: number, w: number) {
      const timelineY = 80
      const margin = 60

      // Timeline
      p.stroke(80)
      p.strokeWeight(2)
      p.line(margin, timelineY, w - margin, timelineY)

      // Writes + log entries
      const writeY = timelineY - 30
      const logY = timelineY + 40

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.BOTTOM)
      p.textSize(9)
      p.text('writes', margin + 20, writeY - 8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('AOF log entries', margin + 20, logY + 14)

      for (let i = 0; i < 30; i++) {
        const x = margin + 40 + i * ((w - 2 * margin - 60) / 30)
        const active = (t * 8) % 30 > i
        // Write dot
        p.fill(100, 200, 120, active ? 255 : 80)
        p.noStroke()
        p.ellipse(x, writeY, 4, 4)
        // Log entry
        if (active) {
          p.fill(255, 200, 80, 200)
          p.rect(x - 1, logY, 3, 10)
          // Arrow from write to log
          if (Math.floor((t * 8) % 30) === i) {
            drawMovingDot(p, x, writeY, x, logY, (t * 3) % 1, [255, 200, 80], 5)
          }
        }
      }

      // AOF file growing
      const aofWidth = ((t * 0.3) % 1) * (w * 0.6)
      const aofY = 180
      p.fill(40, 35, 20)
      p.stroke(255, 200, 80)
      p.strokeWeight(1)
      p.rect(margin, aofY, aofWidth, 20, 4)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('appendonly.aof (grows with every write)', margin, aofY + 30)

      // Rewrite compaction
      const rewriteY = 230
      drawBox(p, w / 2, rewriteY, 240, 26, [40, 30, 20], [255, 160, 80], 'AOF rewrite (background compaction)', 9)

      // Properties
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      const propsX = margin
      const propsY = 260
      p.text('+ Every write logged, minimal data loss', propsX, propsY)
      p.text('+ fsync policies: always / every-sec / never', propsX, propsY + 14)
      p.fill(255, 130, 130)
      p.text('- Larger file size than RDB', propsX, propsY + 28)
      p.text('- Slower restart (replay all commands)', propsX, propsY + 42)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Persistence</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis offers two persistence mechanisms that can be used independently or together.
        <strong className="text-white"> RDB</strong> takes periodic point-in-time snapshots.
        <strong className="text-white"> AOF</strong> logs every write operation.
      </p>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setMode('rdb')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition ${mode === 'rdb' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          RDB Snapshots
        </button>
        <button
          onClick={() => setMode('aof')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition ${mode === 'aof' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          AOF Log
        </button>
      </div>
      <P5Sketch sketch={sketch} height={320} />
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Best practice:</strong> Use both. RDB for fast restarts
          and backups. AOF for minimal data loss. On restart, Redis prefers AOF (more complete) when
          both are available. The combination gives you the best of both worlds.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8b -- Deep Dive: Replication & Sentinel                    */
/* ================================================================== */

function ReplicationSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Master-Replica Replication with Sentinel Failover', w / 2, 10)

      const masterX = w / 2
      const masterY = 90
      const replicaY = 230
      const sentinelY = 160

      // Master
      const masterPulse = Math.sin(t * 3) * 0.3 + 0.7
      p.fill(25, 50, 80)
      p.stroke(100, 180, 255, masterPulse * 255)
      p.strokeWeight(2)
      p.rect(masterX - 60, masterY - 25, 120, 50, 8)
      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(11)
      p.text('Master', masterX, masterY - 6)
      p.textSize(9)
      p.fill(150)
      p.text('reads + writes', masterX, masterY + 10)

      // Replicas
      const replicaXs = [w * 0.2, w * 0.5, w * 0.8]
      for (let i = 0; i < 3; i++) {
        const rx = replicaXs[i]
        p.fill(20, 40, 30)
        p.stroke(80, 200, 120)
        p.strokeWeight(1.5)
        p.rect(rx - 55, replicaY - 22, 110, 44, 8)
        p.fill(255)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Replica ${i + 1}`, rx, replicaY - 5)
        p.textSize(8)
        p.fill(150)
        p.text('reads only', rx, replicaY + 10)

        // Replication stream arrow
        drawArrow(p, masterX, masterY + 28, rx, replicaY - 25, [80, 200, 120, 160])
        // Moving data dots
        const progress = ((t * 0.6 + i * 0.33) % 1)
        drawMovingDot(p, masterX, masterY + 28, rx, replicaY - 25, progress, [80, 255, 120], 6)
      }

      // Sentinel nodes
      const sentinelXs = [w * 0.15, w * 0.5, w * 0.85]
      for (let i = 0; i < 3; i++) {
        const sx = sentinelXs[i]
        const sy = sentinelY
        const pulse = Math.sin(t * 4 + i) * 0.5 + 0.5
        p.fill(50, 30, 30)
        p.stroke(255, 120, 80, 120 + pulse * 135)
        p.strokeWeight(1.5)
        p.rect(sx - 40, sy - 14, 80, 28, 6)
        p.fill(255)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Sentinel ${i + 1}`, sx, sy)

        // Monitoring lines to master
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.stroke(255, 120, 80, 60)
        p.strokeWeight(1)
        p.line(sx, sy + 14, masterX, masterY - 25)
        ctx.setLineDash([])
      }

      // Labels
      p.fill(255, 120, 80)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Sentinels monitor master health', w * 0.15, sentinelY + 20)
      p.text('and trigger automatic failover', w * 0.15, sentinelY + 32)

      // Write flow label
      p.fill(100, 180, 255)
      p.textSize(8)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('client writes', masterX - 70, masterY)

      // Replication label
      p.fill(80, 200, 120)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('async replication stream', w / 2, replicaY + 30)

      // Failover sequence at bottom
      const fY = 310
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Failover sequence:', 40, fY)
      p.fill(180)
      p.textSize(9)
      p.text('1. Sentinel detects master down (SDOWN)', 40, fY + 16)
      p.text('2. Sentinel quorum agrees (ODOWN)', 40, fY + 28)
      p.text('3. One sentinel elected as leader', 40, fY + 40)
      p.text('4. Best replica promoted to master', 40, fY + 52)
      p.text('5. Other replicas reconfigured to follow new master', 40, fY + 64)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Replication and Sentinel</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis replication is <strong className="text-white">asynchronous</strong>: the master does not
        wait for replicas to acknowledge writes before responding to the client. This maximizes
        throughput but means a master crash can lose the most recent writes that have not yet
        propagated.
      </p>
      <P5Sketch sketch={sketch} height={380} />
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Sentinel</strong> is a separate process that monitors Redis
        instances. When a majority of sentinels agree the master is down, they elect a leader sentinel
        that promotes the most up-to-date replica to master. Clients use Sentinel to discover the
        current master address.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8c -- Deep Dive: Redis Cluster                             */
/* ================================================================== */

function ClusterSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.01
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Redis Cluster: 16384 Hash Slots', w / 2, 10)

      const cx = w / 2
      const cy = 200
      const ringR = 130

      // Draw hash ring
      p.noFill()
      p.stroke(60)
      p.strokeWeight(3)
      p.ellipse(cx, cy, ringR * 2, ringR * 2)

      // Nodes on ring
      const nodes = [
        { label: 'Node A', slots: '0-5460', color: [100, 180, 255] as [number, number, number], angle: -Math.PI / 2 },
        { label: 'Node B', slots: '5461-10922', color: [80, 200, 120] as [number, number, number], angle: Math.PI / 6 },
        { label: 'Node C', slots: '10923-16383', color: [255, 160, 80] as [number, number, number], angle: (5 * Math.PI) / 6 },
      ]

      // Draw colored arcs for slot ranges
      const slotAngles = [
        { start: -Math.PI / 2, end: Math.PI / 6, color: [100, 180, 255, 80] as [number, number, number, number] },
        { start: Math.PI / 6, end: (5 * Math.PI) / 6, color: [80, 200, 120, 80] as [number, number, number, number] },
        { start: (5 * Math.PI) / 6, end: Math.PI * 1.5, color: [255, 160, 80, 80] as [number, number, number, number] },
      ]

      for (const arc of slotAngles) {
        p.stroke(arc.color[0], arc.color[1], arc.color[2], arc.color[3])
        p.strokeWeight(8)
        p.noFill()
        p.arc(cx, cy, ringR * 2, ringR * 2, arc.start, arc.end)
      }

      // Draw nodes
      for (const node of nodes) {
        const nx = cx + Math.cos(node.angle) * ringR
        const ny = cy + Math.sin(node.angle) * ringR

        p.fill(node.color[0] * 0.3, node.color[1] * 0.3, node.color[2] * 0.3)
        p.stroke(node.color[0], node.color[1], node.color[2])
        p.strokeWeight(2)
        p.ellipse(nx, ny, 50, 50)

        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(9)
        p.text(node.label, nx, ny - 5)
        p.textSize(7)
        p.fill(200)
        p.text(node.slots, nx, ny + 8)
      }

      // Animated key lookup
      const keyX = w * 0.1
      const keyY = cy - 40
      p.fill(255, 200, 80)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('SET user:42 "data"', keyX, keyY)

      // CRC16 hash
      p.fill(180)
      p.textSize(9)
      p.text('CRC16("user:42") % 16384', keyX, keyY + 16)
      p.text('= slot 7832', keyX, keyY + 30)

      // Arrow to Node B
      const targetNode = nodes[1]
      const tnx = cx + Math.cos(targetNode.angle) * ringR
      const tny = cy + Math.sin(targetNode.angle) * ringR
      const progress = (t * 0.5) % 1
      drawArrow(p, keyX + 80, keyY + 40, tnx - 30, tny, [255, 200, 80, 150])
      drawMovingDot(p, keyX + 80, keyY + 40, tnx - 30, tny, progress, [255, 200, 80], 7)

      // Node B arrow label
      p.fill(80, 200, 120)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('slot 7832 belongs to Node B', cx, cy + ringR + 20)

      // Resharding note
      const noteY = cy + ringR + 45
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Resharding: move slot ranges between nodes without downtime', cx, noteY)
      p.text('CLUSTER SETSLOT <slot> MIGRATING/IMPORTING', cx, noteY + 14)

      // Gossip protocol label
      p.fill(120)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Nodes communicate via gossip protocol (CLUSTER MEET, heartbeats)', cx, noteY + 34)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Deep Dive: Redis Cluster</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis Cluster partitions data across multiple masters using <strong className="text-white">16,384
        hash slots</strong>. Each key is mapped to a slot via CRC16(key) % 16384, and each master
        owns a range of slots. This is not consistent hashing (like Dynamo) but a fixed slot assignment
        that makes resharding predictable.
      </p>
      <P5Sketch sketch={sketch} height={400} />
      <p className="text-gray-300 leading-relaxed">
        If a client sends a command to the wrong node, that node responds with a <code className="text-yellow-400">MOVED</code> redirect
        pointing to the correct node. Smart clients cache the slot map and route directly, avoiding
        the extra round-trip. When slots are being migrated, nodes respond with <code className="text-yellow-400">ASK</code> redirects
        that handle the transition gracefully.
      </p>
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

      <h3 className="text-lg font-semibold text-blue-400">Vertical Scaling (Scale Up)</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li>Add more RAM: a single Redis instance can handle hundreds of GB</li>
        <li>Faster CPU only helps marginally (Redis is memory and network bound)</li>
        <li>Faster NIC (25/100 Gbps) improves throughput at high QPS</li>
        <li>Practical limit: ~200-300GB per instance (fork-based persistence gets expensive)</li>
      </ul>

      <h3 className="text-lg font-semibold text-green-400 pt-4">Horizontal Scaling (Scale Out)</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li><strong className="text-white">Read replicas:</strong> add followers for read-heavy workloads. Linear read scaling.</li>
        <li><strong className="text-white">Redis Cluster:</strong> shard data across N masters. Each master handles 1/N of the keyspace.</li>
        <li><strong className="text-white">Client-side sharding:</strong> hash keys in the client to route to different Redis instances. Simple but no auto-failover or resharding.</li>
      </ul>

      <h3 className="text-lg font-semibold text-yellow-400 pt-4">Growth Milestones</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Scale</th>
              <th className="py-2 px-4 text-white">Architecture</th>
              <th className="py-2 px-4 text-white">Ops/sec</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">1x</td>
              <td className="py-2 px-4">Single master + 2 replicas + Sentinel</td>
              <td className="py-2 px-4">~100K writes, ~300K reads</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">10x</td>
              <td className="py-2 px-4">Redis Cluster (6 masters, 6 replicas)</td>
              <td className="py-2 px-4">~600K writes, ~1.8M reads</td>
            </tr>
            <tr>
              <td className="py-2 px-4">100x</td>
              <td className="py-2 px-4">Cluster (60 masters) + read replicas + client pipelining</td>
              <td className="py-2 px-4">~6M writes, ~18M reads</td>
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
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Master crashes</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Sentinel detects failure within <code className="text-yellow-400">down-after-milliseconds</code> (default 30s,
            typically configured to 5s). Quorum of sentinels agree on ODOWN. Leader sentinel promotes
            best replica (most replication offset). Clients reconnect to new master via Sentinel discovery.
            Total failover time: 5-15 seconds. Writes during this window are rejected.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Replica crashes</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Read traffic redistributes to remaining replicas. When the replica recovers, it performs
            a partial resync (PSYNC) using the replication backlog buffer. If the backlog is insufficient,
            a full resync (RDB transfer) is needed.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Network partition</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Split-brain risk: the old master keeps accepting writes on one side, while a new master is
            elected on the other. Redis mitigates this with <code className="text-yellow-400">min-replicas-to-write</code>:
            the master stops accepting writes if fewer than N replicas are reachable. When the partition
            heals, the old master becomes a replica and loses its divergent writes.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-green-900/50 rounded-lg p-4">
          <h3 className="text-green-400 font-semibold text-sm mb-2">Durability guarantees</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            With AOF fsync=always: at most 1 write lost. With AOF fsync=everysec: at most 1 second
            of writes lost. With RDB only: all writes since last snapshot lost. With no persistence:
            all data lost on restart (acceptable for pure cache use cases).
          </p>
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
      chose: 'Single-threaded event loop',
      over: 'Multi-threaded concurrent execution',
      because: 'Eliminates all locking, context switching, and race conditions. The bottleneck is network I/O, not CPU. Redis 6+ uses I/O threads for network parsing but keeps command execution single-threaded.',
      color: 'border-blue-600',
    },
    {
      chose: 'In-memory with optional persistence',
      over: 'Disk-first with memory cache',
      because: 'Memory access is 100-1000x faster than SSD. By making memory the source of truth, Redis achieves sub-millisecond latency. The cost is limited dataset size and more complex durability.',
      color: 'border-green-600',
    },
    {
      chose: 'Async replication',
      over: 'Synchronous replication',
      because: 'Waiting for replica ack would increase write latency from microseconds to milliseconds and reduce throughput dramatically. The tradeoff is potential data loss on master failure.',
      color: 'border-yellow-600',
    },
    {
      chose: 'Fixed hash slots (16384)',
      over: 'Consistent hashing (virtual nodes)',
      because: 'Hash slots make resharding explicit and predictable. You move specific slot ranges between nodes. Consistent hashing is better for dynamic membership, but Redis Cluster prioritizes operational simplicity.',
      color: 'border-purple-600',
    },
    {
      chose: 'Rich data structures server-side',
      over: 'Simple key-value with client-side logic',
      because: 'By supporting lists, sets, sorted sets natively, Redis can execute operations atomically and avoid round-trips. ZRANGEBYSCORE on a sorted set is one command, not "fetch all, sort, filter" on the client.',
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
          <strong className="text-yellow-400">Final thought:</strong> Redis succeeds because it makes
          one bet and follows it relentlessly: <em>memory is fast, simplicity scales</em>. The
          single-threaded model is counterintuitive but eliminates entire classes of bugs. The rich
          data structures eliminate entire classes of round-trips. The result is a system that does
          less but does it extraordinarily well.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignRedis() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Design Redis</h1>
        <p className="text-lg text-gray-400">
          A system design deep dive into the world's most popular in-memory data store. How a
          single-threaded event loop achieves sub-millisecond latency at 100K+ ops/sec, with
          persistence, replication, and horizontal sharding.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <DataModelSection />
      <ArchitectureSection />
      <PersistenceSection />
      <ReplicationSection />
      <ClusterSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
    </div>
  )
}
