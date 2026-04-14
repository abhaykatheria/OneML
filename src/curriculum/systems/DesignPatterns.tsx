import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-patterns',
  title: 'System Design Patterns',
  description:
    'Load balancing, caching, rate limiting, circuit breakers, message queues, and database scaling',
  track: 'systems',
  order: 10,
  tags: [
    'load-balancing',
    'caching',
    'rate-limiting',
    'circuit-breaker',
    'message-queue',
    'microservices',
    'sharding',
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

/* ------------------------------------------------------------------ */
/* Section 1 — Load Balancer Visualization                             */
/* ------------------------------------------------------------------ */

interface LBRequest {
  id: number
  x: number
  y: number
  targetServer: number
  phase: 'incoming' | 'routing' | 'processing' | 'done'
  progress: number
  processingTime: number
}

function LoadBalancerSketch() {
  const [algorithm, setAlgorithm] = useState<'round-robin' | 'least-conn' | 'weighted'>(
    'round-robin',
  )
  const algorithmRef = useRef(algorithm)
  algorithmRef.current = algorithm

  const sketch = useCallback((p: p5) => {
    const canvasH = 460
    let canvasW = 900
    const numServers = 5
    const requests: LBRequest[] = []
    const serverQueues: number[] = new Array(numServers).fill(0)
    const serverWeights = [3, 2, 2, 1, 1]
    let nextId = 0
    let frame = 0
    let rrIndex = 0
    let weightedCursor = 0
    const rng = makeRng(77)

    const lbX = 250
    const serverStartX = 550
    const serverSpacing = 70
    const serverY = (i: number) => 80 + i * serverSpacing

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const algo = algorithmRef.current

      // Spawn requests
      if (frame % 15 === 0) {
        let targetServer = 0

        if (algo === 'round-robin') {
          targetServer = rrIndex % numServers
          rrIndex++
        } else if (algo === 'least-conn') {
          targetServer = 0
          let minQ = serverQueues[0]
          for (let i = 1; i < numServers; i++) {
            if (serverQueues[i] < minQ) {
              minQ = serverQueues[i]
              targetServer = i
            }
          }
        } else if (algo === 'weighted') {
          // Weighted round-robin
          const expanded: number[] = []
          for (let i = 0; i < numServers; i++) {
            for (let w = 0; w < serverWeights[i]; w++) expanded.push(i)
          }
          targetServer = expanded[weightedCursor % expanded.length]
          weightedCursor++
        }

        const req: LBRequest = {
          id: nextId++,
          x: 50,
          y: canvasH / 2 + (rng() - 0.5) * 60,
          targetServer,
          phase: 'incoming',
          progress: 0,
          processingTime: 40 + Math.floor(rng() * 60),
        }
        requests.push(req)
        serverQueues[targetServer]++
      }

      // Update requests
      for (const req of requests) {
        if (req.phase === 'incoming') {
          req.x += (lbX - req.x) * 0.12
          if (Math.abs(req.x - lbX) < 5) req.phase = 'routing'
        } else if (req.phase === 'routing') {
          const tx = serverStartX - 30
          const ty = serverY(req.targetServer)
          req.x += (tx - req.x) * 0.1
          req.y += (ty - req.y) * 0.1
          if (Math.abs(req.x - tx) < 5 && Math.abs(req.y - ty) < 5) {
            req.phase = 'processing'
          }
        } else if (req.phase === 'processing') {
          req.progress++
          if (req.progress >= req.processingTime) {
            req.phase = 'done'
            serverQueues[req.targetServer] = Math.max(
              0,
              serverQueues[req.targetServer] - 1,
            )
          }
        }
      }

      // Remove completed requests
      for (let i = requests.length - 1; i >= 0; i--) {
        if (requests[i].phase === 'done') requests.splice(i, 1)
      }

      // Draw LB box
      p.stroke(59, 130, 246)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(lbX - 40, canvasH / 2 - 50, 80, 100, 8)
      p.noStroke()
      p.fill(59, 130, 246)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(11)
      p.text('Load', lbX, canvasH / 2 - 12)
      p.text('Balancer', lbX, canvasH / 2 + 6)

      // Draw servers
      for (let i = 0; i < numServers; i++) {
        const sy = serverY(i)
        const qLen = serverQueues[i]
        const load = Math.min(1, qLen / 8)
        const col = p.lerpColor(
          p.color(34, 197, 94),
          p.color(239, 68, 68),
          load,
        )

        p.stroke(100)
        p.strokeWeight(1)
        p.fill(30, 41, 59)
        p.rect(serverStartX - 30, sy - 25, 120, 50, 6)

        // Load bar
        p.noStroke()
        p.fill(col)
        p.rect(serverStartX - 25, sy + 10, Math.min(110, qLen * 14), 10, 3)

        // Server label
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`Server ${i}`, serverStartX - 22, sy - 8)

        // Queue count
        p.fill(148, 163, 184)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`q: ${qLen}`, serverStartX + 85, sy - 8)

        // Weight indicator for weighted algo
        if (algo === 'weighted') {
          p.fill(250, 204, 21, 180)
          p.textSize(9)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`w=${serverWeights[i]}`, serverStartX + 85, sy + 17)
        }

        // Connection line from LB
        p.stroke(60, 70, 90)
        p.strokeWeight(1)
        p.line(lbX + 40, canvasH / 2, serverStartX - 30, sy)
      }

      // Draw incoming requests
      for (const req of requests) {
        if (req.phase === 'done') continue
        const col =
          req.phase === 'processing'
            ? p.color(250, 204, 21)
            : p.color(59, 130, 246)
        p.fill(col)
        p.noStroke()
        p.ellipse(req.x, req.y, 10, 10)
      }

      // Title and info
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        `Algorithm: ${algo} — requests are distributed across ${numServers} backend servers`,
        10,
        10,
      )

      // Requests label
      p.fill(255)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(12)
      p.text('Requests', 60, 40)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-slate-400">Algorithm:</span>
            {(['round-robin', 'least-conn', 'weighted'] as const).map((a) => (
              <button
                key={a}
                className={`px-3 py-1 rounded text-sm ${
                  algorithm === a
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                onClick={() => setAlgorithm(a)}
              >
                {a}
              </button>
            ))}
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Cache Hit/Miss Visualization                            */
/* ------------------------------------------------------------------ */

interface CacheRequest {
  id: number
  key: string
  x: number
  y: number
  hit: boolean | null
  phase: 'check' | 'hit' | 'miss-db' | 'miss-fill' | 'done'
  progress: number
}

function CacheSketch() {
  const [cacheSize, setCacheSize] = useState(4)
  const cacheSizeRef = useRef(cacheSize)
  cacheSizeRef.current = cacheSize

  const sketch = useCallback((p: p5) => {
    const canvasH = 460
    let canvasW = 900
    const requests: CacheRequest[] = []
    const cache: { key: string; hits: number; lastUsed: number }[] = []
    let nextId = 0
    let frame = 0
    let totalRequests = 0
    let totalHits = 0
    const rng = makeRng(55)

    // Simulate zipf-like access pattern (some keys much more popular)
    const allKeys = ['user:1', 'user:2', 'user:3', 'product:A', 'product:B',
      'product:C', 'session:X', 'session:Y', 'config:main', 'stats:daily']
    const keyWeights = [10, 8, 5, 4, 3, 2, 2, 1, 1, 1]
    const totalWeight = keyWeights.reduce((a, b) => a + b, 0)

    function pickKey(): string {
      let r = rng() * totalWeight
      for (let i = 0; i < allKeys.length; i++) {
        r -= keyWeights[i]
        if (r <= 0) return allKeys[i]
      }
      return allKeys[0]
    }

    const cacheBoxX = 300
    const dbBoxX = 600
    const cacheBoxY = 100

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const maxCache = cacheSizeRef.current

      // Spawn requests
      if (frame % 25 === 0) {
        const key = pickKey()
        const cached = cache.find((c) => c.key === key)
        const isHit = cached !== undefined

        if (isHit && cached) {
          cached.hits++
          cached.lastUsed = frame
          totalHits++
        }
        totalRequests++

        const req: CacheRequest = {
          id: nextId++,
          key,
          x: 60,
          y: canvasH / 2 + (rng() - 0.5) * 40,
          hit: isHit ? true : null,
          phase: 'check',
          progress: 0,
        }
        requests.push(req)

        // If miss, will need to add to cache after DB fetch
        if (!isHit) {
          req.hit = false
        }
      }

      // Update requests
      for (const req of requests) {
        req.progress++
        if (req.phase === 'check') {
          req.x += (cacheBoxX - req.x) * 0.1
          if (Math.abs(req.x - cacheBoxX) < 5) {
            if (req.hit) {
              req.phase = 'hit'
            } else {
              req.phase = 'miss-db'
            }
          }
        } else if (req.phase === 'hit') {
          req.x += (60 - req.x) * 0.06
          if (req.x < 80) req.phase = 'done'
        } else if (req.phase === 'miss-db') {
          req.x += (dbBoxX - req.x) * 0.1
          if (Math.abs(req.x - dbBoxX) < 5) {
            req.phase = 'miss-fill'
            // Add to cache (LRU eviction)
            if (cache.length >= maxCache) {
              // Evict LRU
              let lruIdx = 0
              let lruTime = cache[0].lastUsed
              for (let i = 1; i < cache.length; i++) {
                if (cache[i].lastUsed < lruTime) {
                  lruTime = cache[i].lastUsed
                  lruIdx = i
                }
              }
              cache.splice(lruIdx, 1)
            }
            cache.push({ key: req.key, hits: 0, lastUsed: frame })
          }
        } else if (req.phase === 'miss-fill') {
          req.x += (60 - req.x) * 0.06
          if (req.x < 80) req.phase = 'done'
        }
      }

      // Remove done
      for (let i = requests.length - 1; i >= 0; i--) {
        if (requests[i].phase === 'done') requests.splice(i, 1)
      }

      // Draw cache box
      p.stroke(34, 197, 94)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(cacheBoxX - 60, cacheBoxY - 10, 130, 50 + maxCache * 30, 8)
      p.noStroke()
      p.fill(34, 197, 94)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Cache', cacheBoxX + 5, cacheBoxY - 5)

      // Draw cache slots
      for (let i = 0; i < maxCache; i++) {
        const slotY = cacheBoxY + 25 + i * 28
        if (i < cache.length) {
          p.fill(34, 197, 94, 40)
          p.rect(cacheBoxX - 50, slotY, 110, 24, 4)
          p.fill(255)
          p.textAlign(p.LEFT, p.CENTER)
          p.textSize(10)
          p.text(cache[i].key, cacheBoxX - 45, slotY + 12)
          p.fill(148, 163, 184)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`${cache[i].hits}h`, cacheBoxX + 55, slotY + 12)
        } else {
          p.fill(40, 50, 70, 60)
          p.rect(cacheBoxX - 50, slotY, 110, 24, 4)
          p.fill(80)
          p.textAlign(p.CENTER, p.CENTER)
          p.textSize(10)
          p.text('empty', cacheBoxX + 5, slotY + 12)
        }
      }

      // Draw DB box
      p.stroke(168, 85, 247)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(dbBoxX - 40, canvasH / 2 - 40, 80, 80, 8)
      p.noStroke()
      p.fill(168, 85, 247)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(13)
      p.text('Database', dbBoxX, canvasH / 2)

      // Draw requests
      for (const req of requests) {
        if (req.phase === 'done') continue
        const col = req.hit
          ? p.color(34, 197, 94)
          : p.color(239, 68, 68)
        p.fill(col)
        p.noStroke()
        p.ellipse(req.x, req.y, 12, 12)
        p.fill(255)
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(req.key.split(':')[1] ?? '', req.x, req.y)
      }

      // Hit ratio display
      const hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Hit Ratio: ${(hitRatio * 100).toFixed(1)}%`, 10, 10)
      p.fill(148, 163, 184)
      p.textSize(11)
      p.text(`Requests: ${totalRequests}  |  Hits: ${totalHits}  |  Misses: ${totalRequests - totalHits}`, 10, 30)

      // Hit ratio bar
      p.fill(40, 50, 70)
      p.rect(10, 48, 200, 10, 3)
      p.fill(hitRatio > 0.7 ? p.color(34, 197, 94) : hitRatio > 0.4 ? p.color(250, 204, 21) : p.color(239, 68, 68))
      p.rect(10, 48, 200 * hitRatio, 10, 3)

      // Legend
      p.fill(34, 197, 94)
      p.ellipse(10 + 5, canvasH - 20, 8, 8)
      p.fill(148, 163, 184)
      p.textAlign(p.LEFT, p.CENTER)
      p.textSize(10)
      p.text('Cache hit', 20, canvasH - 20)
      p.fill(239, 68, 68)
      p.ellipse(100 + 5, canvasH - 20, 8, 8)
      p.fill(148, 163, 184)
      p.text('Cache miss (go to DB)', 110, canvasH - 20)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Cache Size
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={cacheSize}
                onChange={(e) => setCacheSize(parseInt(e.target.value, 10))}
                className="w-32"
              />
              <span className="w-8 text-right">{cacheSize}</span>
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Token Bucket Rate Limiter Visualization                 */
/* ------------------------------------------------------------------ */

function RateLimiterSketch() {
  const [tokenRate, setTokenRate] = useState(2)
  const [burstSize, setBurstSize] = useState(5)
  const tokenRateRef = useRef(tokenRate)
  const burstSizeRef = useRef(burstSize)
  tokenRateRef.current = tokenRate
  burstSizeRef.current = burstSize

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    let canvasW = 900
    let frame = 0
    let tokens = 5
    const rng = makeRng(33)
    let accepted = 0
    let rejected = 0

    interface RLRequest {
      x: number
      y: number
      accepted: boolean | null
      alpha: number
    }
    const reqs: RLRequest[] = []

    const bucketX = 400
    const bucketY = 200
    const bucketW = 120
    const bucketH = 160

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const rate = tokenRateRef.current
      const burst = burstSizeRef.current

      // Add tokens at rate
      if (frame % Math.max(1, Math.floor(60 / rate)) === 0) {
        tokens = Math.min(burst, tokens + 1)
      }

      // Incoming requests (bursty pattern)
      const burstFrame = Math.sin(frame * 0.02) > 0.3
      const reqRate = burstFrame ? 10 : 25
      if (frame % reqRate === 0) {
        const req: RLRequest = {
          x: 80,
          y: bucketY + (rng() - 0.5) * 60,
          accepted: null,
          alpha: 255,
        }
        if (tokens >= 1) {
          tokens -= 1
          req.accepted = true
          accepted++
        } else {
          req.accepted = false
          rejected++
        }
        reqs.push(req)
      }

      // Update requests
      for (const req of reqs) {
        if (req.accepted === true) {
          req.x += 4
          if (req.x > canvasW) req.alpha = 0
        } else if (req.accepted === false) {
          req.alpha -= 3
        }
      }

      // Remove faded requests
      for (let i = reqs.length - 1; i >= 0; i--) {
        if (reqs[i].alpha <= 0) reqs.splice(i, 1)
      }

      // Draw bucket
      p.stroke(100)
      p.strokeWeight(2)
      p.noFill()
      p.rect(bucketX - bucketW / 2, bucketY - bucketH / 2, bucketW, bucketH, 4)

      // Fill level
      const fillRatio = tokens / burst
      const fillH = fillRatio * (bucketH - 10)
      p.noStroke()
      p.fill(59, 130, 246, 100)
      p.rect(
        bucketX - bucketW / 2 + 5,
        bucketY + bucketH / 2 - 5 - fillH,
        bucketW - 10,
        fillH,
        3,
      )

      // Tokens as circles
      for (let i = 0; i < Math.floor(tokens); i++) {
        const row = Math.floor(i / 3)
        const col = i % 3
        const tx = bucketX - 25 + col * 25
        const ty = bucketY + bucketH / 2 - 20 - row * 25
        p.fill(59, 130, 246)
        p.noStroke()
        p.ellipse(tx, ty, 18, 18)
      }

      // Bucket label
      p.fill(255)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(12)
      p.text('Token Bucket', bucketX, bucketY - bucketH / 2 - 20)
      p.fill(148, 163, 184)
      p.textSize(10)
      p.text(`${Math.floor(tokens)} / ${burst} tokens`, bucketX, bucketY + bucketH / 2 + 8)

      // Token drip animation (from top)
      if (frame % Math.max(1, Math.floor(60 / rate)) < 3) {
        p.fill(59, 130, 246, 150)
        p.noStroke()
        p.ellipse(bucketX, bucketY - bucketH / 2 - 5, 10, 10)
      }

      // Draw requests
      for (const req of reqs) {
        if (req.accepted) {
          p.fill(34, 197, 94, req.alpha)
          p.noStroke()
          p.ellipse(req.x, req.y, 10, 10)
        } else {
          p.fill(239, 68, 68, req.alpha)
          p.noStroke()
          // X mark for rejected
          p.strokeWeight(2)
          p.stroke(239, 68, 68, req.alpha)
          p.line(req.x - 5, req.y - 5, req.x + 5, req.y + 5)
          p.line(req.x + 5, req.y - 5, req.x - 5, req.y + 5)
          p.noStroke()
        }
      }

      // Arrow: requests -> bucket
      p.stroke(100)
      p.strokeWeight(1)
      p.line(120, bucketY, bucketX - bucketW / 2 - 10, bucketY)
      p.fill(100)
      p.noStroke()
      p.triangle(
        bucketX - bucketW / 2 - 10, bucketY,
        bucketX - bucketW / 2 - 18, bucketY - 4,
        bucketX - bucketW / 2 - 18, bucketY + 4,
      )

      // Arrow: bucket -> service
      p.stroke(100)
      p.strokeWeight(1)
      p.line(bucketX + bucketW / 2 + 10, bucketY, canvasW - 120, bucketY)

      // Service box
      p.stroke(34, 197, 94)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(canvasW - 120, bucketY - 30, 80, 60, 8)
      p.noStroke()
      p.fill(34, 197, 94)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(12)
      p.text('Service', canvasW - 80, bucketY)

      // Stats
      p.noStroke()
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Rate Limiter Statistics', 10, 10)
      p.fill(34, 197, 94)
      p.textSize(11)
      p.text(`Accepted: ${accepted}`, 10, 30)
      p.fill(239, 68, 68)
      p.text(`Rejected: ${rejected}`, 10, 46)
      const total = accepted + rejected
      p.fill(148, 163, 184)
      p.text(
        `Accept rate: ${total > 0 ? ((accepted / total) * 100).toFixed(1) : 0}%`,
        10,
        62,
      )

      // Burst indicator
      const isBurst = Math.sin(frame * 0.02) > 0.3
      p.fill(isBurst ? p.color(250, 204, 21) : p.color(100))
      p.textSize(10)
      p.text(isBurst ? 'BURST TRAFFIC' : 'normal traffic', 10, 82)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-6 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Token Rate
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={tokenRate}
                onChange={(e) => setTokenRate(parseFloat(e.target.value))}
                className="w-28"
              />
              <span className="w-12 text-right">{tokenRate}/s</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Burst Size
              <input
                type="range"
                min={2}
                max={10}
                step={1}
                value={burstSize}
                onChange={(e) => setBurstSize(parseInt(e.target.value, 10))}
                className="w-28"
              />
              <span className="w-8 text-right">{burstSize}</span>
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Circuit Breaker Visualization                           */
/* ------------------------------------------------------------------ */

function CircuitBreakerSketch() {
  const [failRate, setFailRate] = useState(0.3)
  const failRateRef = useRef(failRate)
  failRateRef.current = failRate

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    let canvasW = 900
    let frame = 0
    const rng = makeRng(88)

    let state: 'closed' | 'open' | 'half-open' = 'closed'
    let failCount = 0
    const failThreshold = 5
    let openTimer = 0
    const openTimeout = 180 // frames
    let halfOpenSuccesses = 0
    const halfOpenThreshold = 3

    interface CBRequest {
      x: number
      y: number
      success: boolean
      alpha: number
    }
    const reqs: CBRequest[] = []
    const history: { frame: number; state: string }[] = []

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const fRate = failRateRef.current

      // State machine
      if (state === 'open') {
        openTimer++
        if (openTimer >= openTimeout) {
          state = 'half-open'
          halfOpenSuccesses = 0
          history.push({ frame, state: 'half-open' })
        }
      }

      // Process requests
      if (frame % 20 === 0) {
        if (state === 'closed') {
          const success = rng() > fRate
          reqs.push({ x: 250, y: canvasH / 2, success, alpha: 255 })
          if (!success) {
            failCount++
            if (failCount >= failThreshold) {
              state = 'open'
              openTimer = 0
              failCount = 0
              history.push({ frame, state: 'open' })
            }
          } else {
            failCount = Math.max(0, failCount - 1)
          }
        } else if (state === 'open') {
          // Immediately reject
          reqs.push({ x: 250, y: canvasH / 2, success: false, alpha: 255 })
        } else if (state === 'half-open') {
          // Probe
          const success = rng() > fRate
          reqs.push({ x: 250, y: canvasH / 2, success, alpha: 255 })
          if (success) {
            halfOpenSuccesses++
            if (halfOpenSuccesses >= halfOpenThreshold) {
              state = 'closed'
              failCount = 0
              history.push({ frame, state: 'closed' })
            }
          } else {
            state = 'open'
            openTimer = 0
            history.push({ frame, state: 'open' })
          }
        }
      }

      // Update requests
      for (const req of reqs) {
        if (req.success) {
          req.x += 3
        }
        req.alpha -= 2
      }
      for (let i = reqs.length - 1; i >= 0; i--) {
        if (reqs[i].alpha <= 0) reqs.splice(i, 1)
      }

      // Draw state boxes
      const states = ['closed', 'open', 'half-open'] as const
      const stateX = { closed: 200, open: 450, 'half-open': 700 }
      const stateY = 120
      const stateColors = {
        closed: p.color(34, 197, 94),
        open: p.color(239, 68, 68),
        'half-open': p.color(250, 204, 21),
      }

      for (const s of states) {
        const x = stateX[s]
        const isActive = state === s
        p.stroke(isActive ? stateColors[s] : p.color(80))
        p.strokeWeight(isActive ? 3 : 1)
        p.fill(isActive ? p.color(30, 41, 59) : p.color(20, 28, 42))
        p.rect(x - 60, stateY - 30, 120, 60, 8)

        p.noStroke()
        p.fill(isActive ? stateColors[s] : p.color(100))
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(13)
        p.text(s.toUpperCase(), x, stateY)

        if (isActive) {
          // Pulsing glow
          const glow = Math.sin(frame * 0.1) * 30 + 30
          p.noFill()
          p.stroke(p.red(stateColors[s]), p.green(stateColors[s]), p.blue(stateColors[s]), glow)
          p.strokeWeight(2)
          p.rect(x - 64, stateY - 34, 128, 68, 10)
        }
      }

      // Draw transition arrows
      // closed -> open (fail threshold)
      p.stroke(150)
      p.strokeWeight(1)
      p.line(stateX.closed + 60, stateY - 10, stateX.open - 60, stateY - 10)
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(9)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`${failThreshold} failures`, (stateX.closed + stateX.open) / 2, stateY - 16)

      // open -> half-open (timeout)
      p.stroke(150)
      p.strokeWeight(1)
      p.line(stateX.open + 60, stateY, stateX['half-open'] - 60, stateY)
      p.noStroke()
      p.fill(148, 163, 184)
      p.text('timeout', (stateX.open + stateX['half-open']) / 2, stateY - 6)

      // half-open -> closed (success)
      p.stroke(150)
      p.strokeWeight(1)
      p.line(stateX['half-open'] - 30, stateY + 30, stateX.closed + 30, stateY + 30)
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`${halfOpenThreshold} successes`, (stateX.closed + stateX['half-open']) / 2, stateY + 34)

      // half-open -> open (failure)
      p.stroke(150)
      p.strokeWeight(1)
      p.line(stateX['half-open'] - 50, stateY + 25, stateX.open + 50, stateY + 25)
      p.noStroke()
      p.fill(239, 68, 68, 180)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('failure', (stateX.open + stateX['half-open']) / 2, stateY + 28)

      // Draw requests
      for (const req of reqs) {
        if (req.success) {
          p.fill(34, 197, 94, req.alpha)
          p.noStroke()
          p.ellipse(req.x, req.y + 100, 8, 8)
        } else {
          p.stroke(239, 68, 68, req.alpha)
          p.strokeWeight(2)
          p.line(req.x - 4, req.y + 96, req.x + 4, req.y + 104)
          p.line(req.x + 4, req.y + 96, req.x - 4, req.y + 104)
          p.noStroke()
        }
      }

      // Info text
      p.noStroke()
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Circuit Breaker State Machine', 10, 10)
      p.fill(148, 163, 184)
      p.textSize(11)
      p.text(`Current state: ${state}  |  Fail count: ${failCount}  |  Fail rate: ${(fRate * 100).toFixed(0)}%`, 10, 30)

      if (state === 'open') {
        p.fill(239, 68, 68)
        p.textSize(10)
        p.text(`Open timer: ${openTimer}/${openTimeout} frames`, 10, 48)
      }

      // History timeline
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('State transitions:', 10, canvasH - 60)
      const recentHistory = history.slice(-8)
      for (let i = 0; i < recentHistory.length; i++) {
        const h = recentHistory[i]
        const col = stateColors[h.state as keyof typeof stateColors] ?? p.color(150)
        p.fill(col)
        p.text(h.state, 10 + i * 90, canvasH - 40)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Service Failure Rate
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={failRate}
                onChange={(e) => setFailRate(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="w-12 text-right">{(failRate * 100).toFixed(0)}%</span>
            </label>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 5 — Message Queue Visualization                             */
/* ------------------------------------------------------------------ */

function MessageQueueSketch() {
  const [consumerDelay, setConsumerDelay] = useState(2)
  const consumerDelayRef = useRef(consumerDelay)
  consumerDelayRef.current = consumerDelay

  const sketch = useCallback((p: p5) => {
    const canvasH = 300
    let canvasW = 900
    let frame = 0
    const rng = makeRng(22)

    interface QMsg {
      id: number
      x: number
      y: number
      phase: 'produce' | 'queued' | 'consume' | 'done'
      queuePos: number
    }
    const msgs: QMsg[] = []
    let nextId = 0
    let queueDepth = 0
    const maxQueueShow = 20

    const prodX = 100
    const queueStartX = 280
    const queueEndX = 580
    const consX = 750
    const midY = canvasH / 2

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      canvasW = parent ? parent.clientWidth : 900
      p.createCanvas(canvasW, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frame++
      const cDelay = consumerDelayRef.current

      // Produce messages at steady rate
      if (frame % 12 === 0) {
        const msg: QMsg = {
          id: nextId++,
          x: prodX,
          y: midY + (rng() - 0.5) * 30,
          phase: 'produce',
          queuePos: queueDepth,
        }
        msgs.push(msg)
        queueDepth++
      }

      // Consume messages
      if (frame % Math.max(1, Math.floor(12 * cDelay)) === 0) {
        const queued = msgs.filter((m) => m.phase === 'queued')
        if (queued.length > 0) {
          queued[0].phase = 'consume'
          queueDepth = Math.max(0, queueDepth - 1)
        }
      }

      // Update positions
      for (const msg of msgs) {
        if (msg.phase === 'produce') {
          const targetX = queueStartX + 10
          msg.x += (targetX - msg.x) * 0.15
          msg.y += (midY - msg.y) * 0.15
          if (Math.abs(msg.x - targetX) < 3) {
            msg.phase = 'queued'
          }
        } else if (msg.phase === 'queued') {
          // Stay in queue
          const queuedMsgs = msgs.filter((m) => m.phase === 'queued')
          const idx = queuedMsgs.indexOf(msg)
          const targetX = queueStartX + 20 + idx * 16
          msg.x += (Math.min(targetX, queueEndX - 20) - msg.x) * 0.1
          msg.y += (midY - msg.y) * 0.1
        } else if (msg.phase === 'consume') {
          msg.x += (consX - msg.x) * 0.08
          msg.y += (midY - msg.y) * 0.08
          if (Math.abs(msg.x - consX) < 5) msg.phase = 'done'
        }
      }

      // Remove done
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].phase === 'done') msgs.splice(i, 1)
      }

      // Draw producer
      p.stroke(59, 130, 246)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(prodX - 35, midY - 30, 70, 60, 8)
      p.noStroke()
      p.fill(59, 130, 246)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(12)
      p.text('Producer', prodX, midY)

      // Draw queue
      p.stroke(250, 204, 21, 100)
      p.strokeWeight(2)
      p.noFill()
      p.rect(queueStartX, midY - 25, queueEndX - queueStartX, 50, 6)
      p.noStroke()
      p.fill(250, 204, 21)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(11)
      p.text('Message Queue', (queueStartX + queueEndX) / 2, midY - 45)

      // Queue depth bar
      const depthRatio = Math.min(1, queueDepth / maxQueueShow)
      p.fill(depthRatio > 0.7 ? p.color(239, 68, 68, 60) : p.color(250, 204, 21, 30))
      p.noStroke()
      p.rect(queueStartX + 2, midY - 23, (queueEndX - queueStartX - 4) * depthRatio, 46, 4)

      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`depth: ${queueDepth}`, (queueStartX + queueEndX) / 2, midY + 40)

      // Draw consumer
      p.stroke(34, 197, 94)
      p.strokeWeight(2)
      p.fill(30, 41, 59)
      p.rect(consX - 35, midY - 30, 70, 60, 8)
      p.noStroke()
      p.fill(34, 197, 94)
      p.textAlign(p.CENTER, p.CENTER)
      p.textSize(12)
      p.text('Consumer', consX, midY)

      // Draw messages
      for (const msg of msgs) {
        if (msg.phase === 'done') continue
        const col =
          msg.phase === 'queued'
            ? p.color(250, 204, 21)
            : msg.phase === 'consume'
            ? p.color(34, 197, 94)
            : p.color(59, 130, 246)
        p.fill(col)
        p.noStroke()
        p.rect(msg.x - 5, msg.y - 5, 10, 10, 2)
      }

      // Arrows
      p.stroke(80)
      p.strokeWeight(1)
      p.line(prodX + 35, midY, queueStartX, midY)
      p.line(queueEndX, midY, consX - 35, midY)

      // Info
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Adjust consumer speed to see queue depth grow or shrink', 10, 10)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Consumer Delay
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={consumerDelay}
                onChange={(e) => setConsumerDelay(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="w-10 text-right">{consumerDelay}x</span>
            </label>
            <span className="text-xs text-slate-500">
              Higher = slower consumer, queue grows
            </span>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const lruCacheCode = `# LRU Cache from Scratch
# ======================
# Using OrderedDict for O(1) get/put with LRU eviction

from collections import OrderedDict

class LRUCache:
    """Least Recently Used cache with fixed capacity."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache: OrderedDict[str, str] = OrderedDict()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> str | None:
        """Get value. Returns None on miss. Moves to end (most recent) on hit."""
        if key in self.cache:
            self.hits += 1
            # Move to end (most recently used)
            self.cache.move_to_end(key)
            return self.cache[key]
        self.misses += 1
        return None

    def put(self, key: str, value: str) -> str | None:
        """Put key-value pair. Returns evicted key if cache was full."""
        evicted = None
        if key in self.cache:
            # Update existing key, move to end
            self.cache.move_to_end(key)
            self.cache[key] = value
        else:
            if len(self.cache) >= self.capacity:
                # Evict least recently used (first item)
                evicted_key, _ = self.cache.popitem(last=False)
                evicted = evicted_key
            self.cache[key] = value
        return evicted

    def __repr__(self):
        items = list(self.cache.keys())
        return f"LRUCache(cap={self.capacity}, keys={items}, hits={self.hits}, misses={self.misses})"

    @property
    def hit_ratio(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


# --- Demo ---
cache = LRUCache(capacity=3)
print("=== LRU Cache (capacity=3) ===\\n")

# Simulate realistic access pattern
operations = [
    ("put", "user:1", "Alice"),
    ("put", "user:2", "Bob"),
    ("put", "user:3", "Charlie"),
    ("get", "user:1", None),       # Hit - moves user:1 to end
    ("get", "user:4", None),       # Miss
    ("put", "user:4", "Diana"),    # Evicts user:2 (LRU)
    ("get", "user:2", None),       # Miss (was evicted)
    ("get", "user:3", None),       # Hit
    ("put", "user:5", "Eve"),      # Evicts user:1
    ("get", "user:1", None),       # Miss (was evicted)
    ("get", "user:4", None),       # Hit
    ("get", "user:3", None),       # Hit
]

for op in operations:
    if op[0] == "put":
        evicted = cache.put(op[1], op[2])
        evict_msg = f" (evicted {evicted})" if evicted else ""
        print(f"  PUT {op[1]:8s} = {op[2]:8s}{evict_msg}")
    else:
        result = cache.get(op[1])
        status = f"HIT ({result})" if result else "MISS"
        print(f"  GET {op[1]:8s} => {status}")
    print(f"      State: {list(cache.cache.keys())}")

print(f"\\n=== Final Stats ===")
print(f"  {cache}")
print(f"  Hit ratio: {cache.hit_ratio:.1%}")

# --- Zipf-like workload simulation ---
print("\\n\\n=== Zipf Workload Simulation ===")
import random
random.seed(42)

for cap in [3, 5, 10, 20]:
    c = LRUCache(capacity=cap)
    # Populate
    for i in range(100):
        c.put(f"k:{i}", f"v:{i}")
    # Access with zipf-like pattern (some keys much more popular)
    for _ in range(1000):
        # Lower keys are more popular
        idx = int(random.paretovariate(1.5)) % 100
        key = f"k:{idx}"
        if c.get(key) is None:
            c.put(key, f"v:{idx}")
    print(f"  Capacity {cap:3d}: hit ratio = {c.hit_ratio:.1%}  (hits={c.hits}, misses={c.misses})")
`

const rateLimiterCode = `# Token Bucket Rate Limiter
# =========================
# Classic algorithm for rate limiting with burst support

import time

class TokenBucket:
    """Token bucket rate limiter.

    - Tokens are added at a constant rate
    - Requests consume one token
    - Burst = max tokens in bucket
    """

    def __init__(self, rate: float, burst: int):
        self.rate = rate          # tokens per second
        self.burst = burst        # max tokens
        self.tokens = float(burst)  # start full
        self.last_refill = 0.0    # timestamp of last refill

    def _refill(self, now: float):
        """Add tokens based on elapsed time."""
        elapsed = now - self.last_refill
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def allow(self, now: float) -> bool:
        """Check if a request is allowed. Consumes a token if yes."""
        self._refill(now)
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


# --- Simulation ---
# We simulate time advancing in small increments

print("=== Token Bucket Rate Limiter ===\\n")

limiter = TokenBucket(rate=5.0, burst=10)  # 5 tokens/sec, max burst of 10

# Simulate: clock starts at 0, advances in 0.01s increments
clock = 0.0
accepted = 0
rejected = 0
results = []  # (time, accepted_count, rejected_count)

print("Phase 1: Steady traffic (1 req every 0.15s)")
print("-" * 45)
for i in range(30):
    clock += 0.15
    allowed = limiter.allow(clock)
    if allowed:
        accepted += 1
    else:
        rejected += 1
    if i < 15 or i > 24:
        status = "ALLOW" if allowed else "DENY "
        print(f"  t={clock:5.2f}s  {status}  tokens={limiter.tokens:.1f}")
    elif i == 15:
        print(f"  ... (skipping middle) ...")

print(f"\\nSteady phase: {accepted} accepted, {rejected} rejected")

# Reset counters
prev_accepted = accepted
prev_rejected = rejected

print(f"\\nPhase 2: Burst traffic (10 requests at once)")
print("-" * 45)
clock += 0.5  # wait a bit to refill
print(f"  (waited 0.5s, tokens refilled to {min(10, limiter.tokens + 0.5 * 5):.1f})")
limiter._refill(clock)

burst_accepted = 0
burst_rejected = 0
for i in range(15):
    # All at the same time
    allowed = limiter.allow(clock)
    if allowed:
        burst_accepted += 1
        accepted += 1
    else:
        burst_rejected += 1
        rejected += 1
    status = "ALLOW" if allowed else "DENY "
    print(f"  Req #{i+1:2d}  {status}  tokens={limiter.tokens:.1f}")

print(f"\\nBurst phase: {burst_accepted} accepted, {burst_rejected} rejected")

# Recovery
print(f"\\nPhase 3: Recovery (waiting for tokens to refill)")
print("-" * 45)
for i in range(10):
    clock += 0.2
    limiter._refill(clock)
    allowed = limiter.allow(clock)
    if allowed:
        accepted += 1
    else:
        rejected += 1
    status = "ALLOW" if allowed else "DENY "
    print(f"  t={clock:5.2f}s  {status}  tokens={limiter.tokens:.1f}")

print(f"\\n=== Overall Stats ===")
print(f"  Total requests: {accepted + rejected}")
print(f"  Accepted: {accepted} ({accepted/(accepted+rejected)*100:.1f}%)")
print(f"  Rejected: {rejected} ({rejected/(accepted+rejected)*100:.1f}%)")

# --- Compare different configurations ---
print(f"\\n\\n=== Configuration Comparison ===")
print(f"{'Config':>20s}  {'Accepted':>8s}  {'Rejected':>8s}  {'Rate':>6s}")
print("-" * 50)

import random
random.seed(42)

for rate, burst in [(1, 3), (5, 5), (5, 10), (10, 10), (10, 20)]:
    lim = TokenBucket(rate=float(rate), burst=burst)
    t = 0.0
    a, r = 0, 0
    for _ in range(200):
        # Random inter-arrival time (bursty)
        t += random.expovariate(8.0)  # avg 8 req/s
        if lim.allow(t):
            a += 1
        else:
            r += 1
    pct = f"{a/(a+r)*100:.0f}%"
    print(f"  rate={rate:2d}/s burst={burst:2d}  {a:8d}  {r:8d}  {pct:>6s}")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function DesignPatterns() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-14 text-slate-200">
      {/* ---- Intro ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          System Design Patterns
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          Building reliable distributed systems requires a toolkit of proven
          patterns. These are not frameworks or libraries - they are{' '}
          <em>design patterns</em> that appear in nearly every production system.
          This lesson covers the patterns you will encounter most often: load
          balancing, caching, rate limiting, circuit breakers, message queues, and
          database scaling strategies.
        </p>
      </section>

      {/* ---- Load Balancing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Load Balancing</h2>
        <p className="leading-relaxed">
          A <strong>load balancer</strong> distributes incoming requests across
          multiple backend servers. This achieves two goals: higher throughput
          (more servers handle more requests) and fault tolerance (if one server
          fails, others continue serving). Load balancers sit at every layer:
          DNS, L4 (TCP), L7 (HTTP), and even within application code.
        </p>
        <p className="leading-relaxed">
          Toggle between algorithms in the visualization below. Notice how
          <strong> round-robin</strong> distributes evenly but ignores server
          load, <strong>least-connections</strong> adapts to slow servers, and
          <strong> weighted</strong> sends more traffic to stronger servers.
        </p>
        <LoadBalancerSketch />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Round-Robin
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Rotate through servers in order: 0, 1, 2, 3, 4, 0, 1, ...
              Simple and fair, but ignores actual load. A slow server accumulates
              a backlog.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Least Connections
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Send to the server with the fewest active connections. Adapts
              automatically to servers with different speeds. Used by NGINX and
              HAProxy.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">
              Weighted
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Assign weights based on server capacity (CPU, memory). A server
              with weight 3 gets 3x the traffic of a server with weight 1.
              Useful for heterogeneous fleets.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Caching ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Caching</h2>
        <p className="leading-relaxed">
          Caching stores frequently-accessed data in a fast layer (memory) to
          reduce load on the slower layer (database). A well-tuned cache can
          absorb 90%+ of reads, reducing database load by an order of magnitude.
        </p>
        <p className="leading-relaxed">
          The visualization below simulates a zipf-like access pattern (some keys
          are much more popular than others). Adjust the cache size to see how the
          hit ratio improves - even a small cache captures the most popular keys.
        </p>
        <CacheSketch />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Cache-Aside (Lazy Loading)
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Application checks cache first. On miss, reads from DB, then
              populates cache. Simple and widely used. Risk: cache and DB can
              become inconsistent.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Write-Through
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Write to cache and DB simultaneously. Guarantees consistency but
              adds write latency. Every write is a cache population.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">
              Write-Behind (Write-Back)
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Write to cache only; async flush to DB. Lowest write latency but
              risks data loss if cache crashes before flushing. Used in
              write-heavy workloads.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Cache Eviction Policies
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2">Policy</th>
                <th className="text-left py-2">Evicts</th>
                <th className="text-left py-2">Good For</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800">
                <td className="py-2 font-semibold text-white">LRU</td>
                <td>Least Recently Used item</td>
                <td>General-purpose; exploits temporal locality</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 font-semibold text-white">LFU</td>
                <td>Least Frequently Used item</td>
                <td>Stable popularity distributions</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 font-semibold text-white">TTL</td>
                <td>Expired items (time-based)</td>
                <td>Data that becomes stale (sessions, tokens)</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-white">FIFO</td>
                <td>Oldest item</td>
                <td>Simple, no bookkeeping overhead</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Rate Limiting ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Rate Limiting</h2>
        <p className="leading-relaxed">
          Rate limiting protects services from being overwhelmed by too many
          requests. Without it, a single misbehaving client can consume all
          resources and cause outages for everyone. The <strong>token bucket</strong>{' '}
          algorithm is the most common approach: tokens are added to a bucket at a
          fixed rate, and each request must consume a token. If the bucket is
          empty, the request is rejected.
        </p>
        <p className="leading-relaxed">
          The bucket has a maximum capacity (burst size), which allows short
          bursts of traffic above the average rate. Adjust the token rate and burst
          size below to see how they interact. Notice how during burst traffic,
          the bucket quickly drains and starts rejecting requests.
        </p>
        <RateLimiterSketch />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Token Bucket
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tokens added at fixed rate. Requests consume tokens. Burst-friendly:
              a full bucket can absorb a spike. Used by AWS API Gateway, NGINX.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Sliding Window
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Count requests in a sliding time window (e.g., last 60 seconds).
              Smoother than fixed windows (no boundary spikes). Slightly more
              memory for tracking timestamps.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Circuit Breaker ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Circuit Breaker</h2>
        <p className="leading-relaxed">
          When a downstream service is failing, continuing to send requests
          makes things worse - it overloads the failing service and wastes
          resources on the caller side. The <strong>circuit breaker</strong>{' '}
          pattern detects failures and &ldquo;opens the circuit&rdquo; to stop
          sending requests until the service recovers.
        </p>
        <p className="leading-relaxed">
          It works like an electrical circuit breaker: <strong>Closed</strong>{' '}
          (normal operation, requests flow through), <strong>Open</strong>{' '}
          (circuit tripped, requests fail immediately), <strong>Half-Open</strong>{' '}
          (probe with a few test requests to see if the service recovered).
          Adjust the failure rate to watch the state machine transition.
        </p>
        <CircuitBreakerSketch />
      </section>

      {/* ---- Message Queues ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Message Queues</h2>
        <p className="leading-relaxed">
          A message queue decouples producers from consumers. The producer
          enqueues work items; the consumer dequeues and processes them at its
          own pace. If the consumer is temporarily slower than the producer,
          the queue absorbs the difference (buffering). If the consumer crashes,
          messages wait in the queue instead of being lost.
        </p>
        <p className="leading-relaxed">
          Increase the consumer delay below and watch the queue depth grow. This
          is the backpressure signal - in production, you would autoscale
          consumers when queue depth exceeds a threshold.
        </p>
        <MessageQueueSketch />
      </section>

      {/* ---- Microservices vs Monolith ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Microservices vs. Monolith
        </h2>
        <p className="leading-relaxed">
          The eternal architecture debate. A <strong>monolith</strong> is a single
          deployable unit. All code runs in one process, shares one database. A
          <strong> microservice architecture</strong> decomposes the system into
          small, independently deployable services, each owning its own data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Monolith
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Simple to develop, test, and deploy initially</li>
              <li>No network calls between components</li>
              <li>Easy to refactor across modules</li>
              <li>Single database = strong consistency</li>
              <li>Scales by running multiple copies</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Best for: small teams, early-stage products, simple domains
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">
              Microservices
            </h4>
            <ul className="text-sm space-y-1 text-slate-300 list-disc list-inside">
              <li>Independent deployment per service</li>
              <li>Scale individual hot services</li>
              <li>Technology diversity (right tool per job)</li>
              <li>Fault isolation (one service crash != total outage)</li>
              <li>Organizational alignment (one team per service)</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Best for: large teams, complex domains, high-scale systems
            </p>
          </div>
        </div>
        <p className="leading-relaxed">
          Microservices introduce significant operational complexity: service
          discovery, API gateways, distributed tracing, circuit breakers, data
          consistency across services. The common advice: start with a monolith,
          extract services when you have a good reason (team scaling, independent
          deployment, different scaling needs).
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Supporting Infrastructure
          </h4>
          <dl className="text-sm space-y-2 text-slate-300">
            <div>
              <dt className="font-semibold text-white">Service Discovery</dt>
              <dd>
                How does Service A find Service B? DNS-based (Consul, Route 53)
                or registry-based (Eureka, etcd). Without it, services use
                hardcoded addresses - a maintenance nightmare.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">API Gateway</dt>
              <dd>
                Single entry point for external clients. Routes requests to
                the appropriate service, handles auth, rate limiting, and
                response aggregation. Examples: Kong, AWS API Gateway, Envoy.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Distributed Tracing</dt>
              <dd>
                A single user request may traverse 10+ services. Tracing
                (Jaeger, Zipkin, OpenTelemetry) propagates a trace ID so you
                can reconstruct the full request path and identify bottlenecks.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---- Database Scaling ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Database Scaling Patterns
        </h2>
        <p className="leading-relaxed">
          A single database server has finite capacity. When it becomes the
          bottleneck, you need scaling strategies. These patterns are not
          mutually exclusive - production systems often combine several.
        </p>

        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Read Replicas
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Write to a single primary. Replicate data to read-only replicas.
              Route read queries to replicas, write queries to primary. Works
              well when reads vastly outnumber writes (common in web apps).
              Trade-off: replication lag means reads may return stale data.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Sharding (Horizontal Partitioning)
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Split data across multiple databases by a shard key (e.g.,
              user_id % num_shards). Each shard holds a subset of the data
              and handles both reads and writes for that subset. Scales writes
              linearly. Challenges: cross-shard queries, rebalancing when
              adding shards, hotspot shards.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">
              Connection Pooling
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Database connections are expensive to create (TCP handshake, TLS,
              authentication). A connection pool (PgBouncer, ProxySQL)
              maintains a set of open connections and reuses them across
              requests. Reduces connection overhead and limits max connections
              to the database.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">
              CQRS (Command Query Responsibility Segregation)
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Use different data models for reads and writes. The write model
              is optimized for consistency (normalized). The read model is
              optimized for queries (denormalized, pre-computed). Changes
              from the write model are propagated to read models via events
              or CDC. Powerful but adds complexity.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: LRU Cache ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: LRU Cache
        </h2>
        <p className="leading-relaxed">
          Implement an LRU cache from scratch using Python&rsquo;s OrderedDict.
          The key insight: OrderedDict.move_to_end() gives O(1) access
          reordering, and popitem(last=False) evicts the least recently used
          item.
        </p>
        <PythonCell defaultCode={lruCacheCode} />
      </section>

      {/* ---- Python: Rate Limiter ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Token Bucket Rate Limiter
        </h2>
        <p className="leading-relaxed">
          Build a token bucket rate limiter and simulate steady traffic followed
          by a burst. Observe how the bucket absorbs the burst up to its
          capacity, then starts rejecting requests until tokens are replenished.
        </p>
        <PythonCell defaultCode={rateLimiterCode} />
      </section>

      {/* ---- Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Summary</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-3 text-slate-300 leading-relaxed">
          <p>
            <strong className="text-white">Load balancing</strong> distributes
            traffic for throughput and fault tolerance. Choose the algorithm
            based on your workload (round-robin for uniform, least-connections
            for variable latency).
          </p>
          <p>
            <strong className="text-white">Caching</strong> reduces database
            load by serving hot data from memory. LRU eviction, cache-aside
            patterns, and careful TTL tuning are the essentials.
          </p>
          <p>
            <strong className="text-white">Rate limiting</strong> (token bucket)
            and <strong className="text-white">circuit breakers</strong> protect
            services from overload and cascading failures.
          </p>
          <p>
            <strong className="text-white">Message queues</strong> decouple
            producers from consumers, enabling asynchronous processing and
            buffering. Pair with autoscaling for elastic throughput.
          </p>
          <p>
            <strong className="text-white">Database scaling</strong> combines
            read replicas, sharding, connection pooling, and CQRS to handle
            growing data and traffic.
          </p>
        </div>
      </section>
    </div>
  )
}
