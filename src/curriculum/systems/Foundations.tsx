import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/foundations',
  title: 'Reliability, Scalability & Maintainability',
  description: 'The three pillars of data-intensive applications: building systems that work correctly, handle growth, and remain easy to change',
  track: 'systems',
  order: 1,
  tags: ['reliability', 'scalability', 'maintainability', 'latency', 'percentiles', 'sla'],
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

function randn(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
}

/** Generate a latency sample with a long tail */
function generateLatency(rng: () => number, baseMs: number, loadFactor: number): number {
  const base = baseMs + randn(rng) * (baseMs * 0.15)
  const spike = rng() < 0.05 + loadFactor * 0.08 ? baseMs * (2 + rng() * 8 * (1 + loadFactor)) : 0
  return Math.max(1, base + spike * (1 + loadFactor * 0.5))
}

/* ------------------------------------------------------------------ */
/* Section 1 — Request Load Visualization                              */
/* ------------------------------------------------------------------ */

function RequestLoadSketch() {
  const [spikeIntensity, setSpikeIntensity] = useState(0.3)
  const spikeRef = useRef(spikeIntensity)
  spikeRef.current = spikeIntensity

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    let bars: number[] = []
    let frame = 0
    const rng = makeRng(42)

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
      // Initialize 60 bars representing seconds of traffic
      for (let i = 0; i < 60; i++) bars.push(0)
    }

    p.draw = () => {
      frame++
      const spike = spikeRef.current

      p.background(15, 23, 42)

      // Generate new request count every 2 frames (~30 fps = 1 second of simulated time per second)
      if (frame % 2 === 0) {
        const baseRate = 80 + randn(rng) * 15
        // Periodic spike pattern
        const t = frame / 60
        const spikeMultiplier = Math.sin(t * 0.5) > 0.7 ? 1 + spike * 4 : 1
        const val = Math.max(0, baseRate * spikeMultiplier + randn(rng) * 10 * spike)
        bars.push(val)
        if (bars.length > 60) bars = bars.slice(bars.length - 60)
      }

      const margin = { left: 60, right: 20, top: 40, bottom: 50 }
      const plotW = p.width - margin.left - margin.right
      const plotH = canvasH - margin.top - margin.bottom
      const maxVal = Math.max(200, ...bars) * 1.1

      // Grid lines
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let i = 0; i <= 4; i++) {
        const y = margin.top + (plotH * i) / 4
        p.line(margin.left, y, p.width - margin.right, y)
        p.noStroke()
        p.fill(100, 116, 139)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(Math.round(maxVal * (1 - i / 4)).toString(), margin.left - 8, y)
        p.stroke(30, 41, 59)
      }

      // Average line
      const avg = bars.reduce((a, b) => a + b, 0) / bars.length
      const avgY = margin.top + plotH * (1 - avg / maxVal)
      p.stroke(250, 204, 21, 150)
      p.strokeWeight(1.5)
      const ctx = p.drawingContext as CanvasRenderingContext2D; ctx.setLineDash([6, 4])
      p.line(margin.left, avgY, p.width - margin.right, avgY)
      ctx.setLineDash([])

      // Peak line
      const peak = Math.max(...bars)
      const peakY = margin.top + plotH * (1 - peak / maxVal)
      p.stroke(244, 63, 94, 150)
      p.strokeWeight(1.5)
      ctx.setLineDash([6, 4])
      p.line(margin.left, peakY, p.width - margin.right, peakY)
      ctx.setLineDash([])

      // Bars
      const barW = Math.max(2, plotW / 60 - 2)
      for (let i = 0; i < bars.length; i++) {
        const x = margin.left + (plotW * i) / 60
        const h = (bars[i] / maxVal) * plotH
        const y = margin.top + plotH - h
        const isSpike = bars[i] > avg * 1.5
        if (isSpike) {
          p.fill(244, 63, 94, 200)
        } else {
          p.fill(99, 102, 241, 200)
        }
        p.noStroke()
        p.rect(x, y, barW, h, 2, 2, 0, 0)
      }

      // Labels
      p.noStroke()
      p.fill(250, 204, 21)
      p.textSize(11)
      p.textAlign(p.LEFT, p.CENTER)
      p.text(`avg: ${avg.toFixed(0)} req/s`, p.width - margin.right - 130, avgY - 10)

      p.fill(244, 63, 94)
      p.text(`peak: ${peak.toFixed(0)} req/s`, p.width - margin.right - 130, peakY - 10)

      // Title
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Request Rate Over Time (req/s)', p.width / 2, 10)

      // X axis label
      p.fill(100, 116, 139)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Time (seconds)', p.width / 2, canvasH - 18)

      // Y axis label
      p.push()
      p.translate(14, canvasH / 2)
      p.rotate(-p.HALF_PI)
      p.fill(100, 116, 139)
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Requests / sec', 0, 0)
      p.pop()
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Spike intensity:
            <input
              type="range" min={0} max={1} step={0.05} value={spikeIntensity}
              onChange={(e) => setSpikeIntensity(parseFloat(e.target.value))}
              className="w-40 accent-rose-500"
            />
            <span className="w-12 font-mono">{spikeIntensity.toFixed(2)}</span>
          </label>
          <span className="text-gray-500 text-xs">Red bars = spikes above 1.5x average</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Latency Distribution with Percentiles                   */
/* ------------------------------------------------------------------ */

function LatencyDistributionSketch() {
  const [load, setLoad] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    let samples: number[] = []

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      const loadFactor = loadRef.current
      p.background(15, 23, 42)

      // Regenerate samples each frame based on load
      const rng = makeRng(123)
      samples = []
      for (let i = 0; i < 1000; i++) {
        samples.push(generateLatency(rng, 50, loadFactor))
      }
      samples.sort((a, b) => a - b)

      const margin = { left: 60, right: 30, top: 40, bottom: 60 }
      const plotW = p.width - margin.left - margin.right
      const plotH = canvasH - margin.top - margin.bottom

      // Build histogram bins
      const maxLatency = Math.min(samples[samples.length - 1] * 1.05, 1500)
      const numBins = 60
      const binWidth = maxLatency / numBins
      const bins: number[] = new Array(numBins).fill(0)
      for (const s of samples) {
        const idx = Math.min(numBins - 1, Math.floor(s / binWidth))
        bins[idx]++
      }
      const maxBin = Math.max(...bins)

      // Draw histogram bars
      const barW = plotW / numBins
      for (let i = 0; i < numBins; i++) {
        const h = (bins[i] / maxBin) * plotH
        const x = margin.left + i * barW
        const y = margin.top + plotH - h

        p.noStroke()
        p.fill(99, 102, 241, 180)
        p.rect(x, y, barW - 1, h)
      }

      // Percentile lines
      const pcts = [
        { p: 0.5, label: 'p50', color: [52, 211, 153] as const },
        { p: 0.95, label: 'p95', color: [250, 204, 21] as const },
        { p: 0.99, label: 'p99', color: [244, 63, 94] as const },
      ]

      for (const pct of pcts) {
        const idx = Math.floor(samples.length * pct.p)
        const val = samples[idx]
        const x = margin.left + (val / maxLatency) * plotW

        p.stroke(pct.color[0], pct.color[1], pct.color[2], 220)
        p.strokeWeight(2)
        p.line(x, margin.top, x, margin.top + plotH)

        p.noStroke()
        p.fill(pct.color[0], pct.color[1], pct.color[2])
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${pct.label}: ${val.toFixed(0)}ms`, x + 4, margin.top + 4 + pcts.indexOf(pct) * 18)
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin.left, margin.top + plotH, p.width - margin.right, margin.top + plotH)
      p.line(margin.left, margin.top, margin.left, margin.top + plotH)

      // X axis ticks
      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      for (let i = 0; i <= 5; i++) {
        const val = (maxLatency * i) / 5
        const x = margin.left + (plotW * i) / 5
        p.text(`${val.toFixed(0)}ms`, x, margin.top + plotH + 6)
      }

      // Title
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Latency Distribution (1000 requests)', p.width / 2, 10)

      // Axis labels
      p.fill(100, 116, 139)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Response Time (ms)', p.width / 2, canvasH - 18)

      p.push()
      p.translate(14, canvasH / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Frequency', 0, 0)
      p.pop()

      // Tail latency annotation
      if (loadFactor > 0.5) {
        p.noStroke()
        p.fill(244, 63, 94, 180)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.BOTTOM)
        p.text('Tail latencies growing under load!', p.width - margin.right, margin.top + plotH - 8)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            System Load:
            <input
              type="range" min={0} max={2} step={0.05} value={load}
              onChange={(e) => setLoad(parseFloat(e.target.value))}
              className="w-48 accent-yellow-500"
            />
            <span className="w-16 font-mono">{(load * 50).toFixed(0)}%</span>
          </label>
          <span className="text-gray-500 text-xs">Increase load to see tail latencies grow</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Vertical vs Horizontal Scaling                          */
/* ------------------------------------------------------------------ */

function ScalingSketch() {
  const [approach, setApproach] = useState<'vertical' | 'horizontal'>('vertical')
  const [scaleLevel, setScaleLevel] = useState(1)
  const approachRef = useRef(approach)
  const scaleRef = useRef(scaleLevel)
  approachRef.current = approach
  scaleRef.current = scaleLevel

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    let animT = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.02
      const mode = approachRef.current
      const level = scaleRef.current

      p.background(15, 23, 42)

      const centerX = p.width / 2
      const centerY = canvasH / 2

      if (mode === 'vertical') {
        // Single server that grows
        const baseW = 80
        const baseH = 100
        const scale = 1 + (level - 1) * 0.4
        const w = baseW * scale
        const h = baseH * scale
        const x = centerX - w / 2
        const y = centerY - h / 2 + 20

        // Server box with glow
        p.noStroke()
        p.fill(99, 102, 241, 30)
        p.rect(x - 8, y - 8, w + 16, h + 16, 12)

        p.stroke(99, 102, 241)
        p.strokeWeight(2)
        p.fill(30, 41, 59)
        p.rect(x, y, w, h, 8)

        // CPU/RAM bars inside
        const barMargin = 10
        const barH = 8
        const numBars = Math.min(8, Math.floor(level) + 2)
        for (let i = 0; i < numBars; i++) {
          const bx = x + barMargin
          const by = y + barMargin + i * (barH + 4)
          const bw = w - barMargin * 2
          p.noStroke()
          p.fill(51, 65, 85)
          p.rect(bx, by, bw, barH, 2)
          const fillPct = 0.3 + Math.sin(animT + i) * 0.15 + (level - 1) * 0.08
          p.fill(99, 102, 241, 200)
          p.rect(bx, by, bw * Math.min(1, fillPct), barH, 2)
        }

        // Label
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Single Server (Scale Up)', centerX, 16)

        // Specs
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        const cpus = Math.pow(2, Math.floor(level))
        const ram = Math.pow(2, Math.floor(level)) * 8
        p.text(`${cpus} CPUs | ${ram} GB RAM`, centerX, y + h + 16)

        // Cost indicator
        const cost = Math.pow(2, level - 1)
        p.fill(250, 204, 21)
        p.textSize(11)
        p.text(`Cost: ~$${(cost * 100).toFixed(0)}/mo`, centerX, y + h + 34)

        // Connection limit warning
        if (level > 3) {
          p.fill(244, 63, 94)
          p.textSize(11)
          p.text('Hardware limits approaching!', centerX, y + h + 52)
        }

        // Incoming requests
        for (let i = 0; i < 5; i++) {
          const arrowX = centerX
          const arrowY = y - 30 - i * 12
          const offset = Math.sin(animT * 2 + i) * 3
          p.fill(52, 211, 153, 150)
          p.noStroke()
          p.triangle(arrowX - 4, arrowY + offset - 6, arrowX + 4, arrowY + offset - 6, arrowX, arrowY + offset)
        }
      } else {
        // Horizontal: multiple servers with load balancer
        const numServers = Math.min(8, Math.floor(level) + 1)
        const serverW = 60
        const serverH = 70

        // Load balancer
        const lbY = 60
        const lbW = 120
        const lbH = 36
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.fill(30, 41, 59)
        p.rect(centerX - lbW / 2, lbY, lbW, lbH, 6)
        p.noStroke()
        p.fill(250, 204, 21)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Load Balancer', centerX, lbY + lbH / 2)

        // Incoming requests to LB
        for (let i = 0; i < 5; i++) {
          const arrowY = lbY - 15 - i * 10
          const offset = Math.sin(animT * 2 + i) * 3
          p.fill(52, 211, 153, 150)
          p.noStroke()
          p.triangle(centerX - 4, arrowY + offset - 5, centerX + 4, arrowY + offset - 5, centerX, arrowY + offset)
        }

        // Servers
        const totalWidth = numServers * (serverW + 16) - 16
        const startX = centerX - totalWidth / 2
        const serverY = lbY + lbH + 60

        for (let i = 0; i < numServers; i++) {
          const sx = startX + i * (serverW + 16)
          const sy = serverY

          // Connection line from LB
          p.stroke(99, 102, 241, 100)
          p.strokeWeight(1)
          p.line(centerX, lbY + lbH, sx + serverW / 2, sy)

          // Animated packet along connection
          const progress = ((animT * 1.5 + i * 0.7) % 1)
          const packetX = centerX + (sx + serverW / 2 - centerX) * progress
          const packetY = (lbY + lbH) + (sy - lbY - lbH) * progress
          p.noStroke()
          p.fill(52, 211, 153, 180)
          p.ellipse(packetX, packetY, 6, 6)

          // Server box
          p.stroke(99, 102, 241)
          p.strokeWeight(1.5)
          p.fill(30, 41, 59)
          p.rect(sx, sy, serverW, serverH, 6)

          // CPU bar inside
          p.noStroke()
          p.fill(51, 65, 85)
          p.rect(sx + 6, sy + 8, serverW - 12, 6, 2)
          const usage = 0.2 + Math.sin(animT + i * 1.3) * 0.15 + (1 / numServers) * 0.3
          p.fill(99, 102, 241, 180)
          p.rect(sx + 6, sy + 8, (serverW - 12) * Math.min(1, usage), 6, 2)

          // Server label
          p.noStroke()
          p.fill(148, 163, 184)
          p.textSize(9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`S${i + 1}`, sx + serverW / 2, sy + serverH / 2 + 8)
        }

        // Label
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Multiple Servers (Scale Out)', centerX, 10)

        // Cost / specs
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${numServers} servers | ${numServers * 4} CPUs total`, centerX, serverY + serverH + 16)

        p.fill(250, 204, 21)
        p.text(`Cost: ~$${(numServers * 50).toFixed(0)}/mo`, centerX, serverY + serverH + 34)

        p.fill(52, 211, 153)
        p.text(`Redundancy: can lose ${Math.max(0, numServers - 1)} server(s)`, centerX, serverY + serverH + 52)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <button
              onClick={() => setApproach(approach === 'vertical' ? 'horizontal' : 'vertical')}
              className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
            >
              Switch to {approach === 'vertical' ? 'Horizontal' : 'Vertical'} Scaling
            </button>
            <span className="text-gray-400">
              {approach === 'vertical' ? 'Bigger machine (scale up)' : 'More machines (scale out)'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <label className="flex items-center gap-2">
              Scale level:
              <input
                type="range" min={1} max={5} step={0.5} value={scaleLevel}
                onChange={(e) => setScaleLevel(parseFloat(e.target.value))}
                className="w-40 accent-indigo-500"
              />
              <span className="w-10 font-mono">{scaleLevel.toFixed(1)}</span>
            </label>
          </div>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — SLA Calculator                                          */
/* ------------------------------------------------------------------ */

function SLACalculator() {
  const [nines, setNines] = useState(3)

  const availability = 1 - Math.pow(10, -nines)
  const downtimeYear = (1 - availability) * 365.25 * 24 * 60 // minutes
  const downtimeMonth = downtimeYear / 12
  const downtimeWeek = downtimeYear / 52

  const formatTime = (minutes: number): string => {
    if (minutes >= 60 * 24) return `${(minutes / (60 * 24)).toFixed(1)} days`
    if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hours`
    if (minutes >= 1) return `${minutes.toFixed(1)} minutes`
    return `${(minutes * 60).toFixed(1)} seconds`
  }

  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-6">
      <h4 className="text-white font-semibold mb-4">SLA & Error Budget Calculator</h4>
      <div className="flex items-center gap-4 mb-6 text-sm text-gray-300">
        <label className="flex items-center gap-2">
          Number of nines:
          <input
            type="range" min={1} max={6} step={0.5} value={nines}
            onChange={(e) => setNines(parseFloat(e.target.value))}
            className="w-40 accent-emerald-500"
          />
          <span className="font-mono text-emerald-400 text-lg">{availability * 100}%</span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900/60 rounded p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Downtime / Year</div>
          <div className="text-lg font-mono text-yellow-400">{formatTime(downtimeYear)}</div>
        </div>
        <div className="bg-gray-900/60 rounded p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Downtime / Month</div>
          <div className="text-lg font-mono text-yellow-400">{formatTime(downtimeMonth)}</div>
        </div>
        <div className="bg-gray-900/60 rounded p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Downtime / Week</div>
          <div className="text-lg font-mono text-yellow-400">{formatTime(downtimeWeek)}</div>
        </div>
      </div>
      <p className="text-sm text-gray-400 mt-4">
        The <strong className="text-white">error budget</strong> is the amount of downtime you can
        &quot;spend&quot; before violating your SLA. With {(availability * 100).toFixed(3)}% uptime,
        you have {formatTime(downtimeMonth)} of allowed downtime per month. Every deployment, every
        incident, every maintenance window eats into this budget.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function Foundations() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: The Three Pillars ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Three Pillars of Data-Intensive Applications</h2>

        <p className="mb-4">
          Most applications today are <strong className="text-white">data-intensive</strong> rather than
          compute-intensive. The bottleneck is rarely raw CPU power. Instead, the hard problems are the
          amount of data, the complexity of data, and the speed at which it changes. When we build such
          systems, three concerns dominate everything:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="rounded-lg bg-gray-800/60 border border-emerald-800/40 p-5">
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">Reliability</h3>
            <p className="text-sm">
              The system continues to work correctly even when things go wrong — hardware faults, software
              bugs, human errors. A reliable system is <em>fault-tolerant</em>: it anticipates faults
              and prevents them from causing failures.
            </p>
          </div>
          <div className="rounded-lg bg-gray-800/60 border border-indigo-800/40 p-5">
            <h3 className="text-lg font-semibold text-indigo-400 mb-2">Scalability</h3>
            <p className="text-sm">
              The system has reasonable strategies for handling growth — more users, more data, more
              complexity. Scalability is not a binary label; it means asking &quot;If our load grows
              in a specific way, what are our options for coping?&quot;
            </p>
          </div>
          <div className="rounded-lg bg-gray-800/60 border border-yellow-800/40 p-5">
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Maintainability</h3>
            <p className="text-sm">
              Over time, many different people will work on the system. Maintainability means making life
              easy for them: operability (easy to keep running), simplicity (easy to understand), and
              evolvability (easy to change).
            </p>
          </div>
        </div>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Reliability: Faults vs Failures</h3>

        <p className="mb-4">
          A <strong className="text-white">fault</strong> is when one component of the system deviates from
          its spec. A <strong className="text-white">failure</strong> is when the system as a whole stops
          providing the required service. The goal is to build <em>fault-tolerant</em> systems that prevent
          faults from causing failures.
        </p>

        <p className="mb-4">
          Faults come in three flavors:
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong className="text-white">Hardware faults</strong> — hard disks crash (mean time to failure ~10-50 years),
            RAM develops bit errors, power grids have blackouts. Traditional approach: add redundancy (RAID disks,
            dual power supplies, hot-swap CPUs). As data volumes grow, we increasingly also need software-level
            fault tolerance.
          </li>
          <li>
            <strong className="text-white">Software errors</strong> — a bug that causes every instance of an application
            server to crash on a particular input, a runaway process that uses up CPU/memory/disk, a service the system
            depends on slows down or returns corrupted responses. These are harder to anticipate because they are
            correlated across nodes.
          </li>
          <li>
            <strong className="text-white">Human errors</strong> — configuration errors by operators are a leading cause
            of outages. Mitigations: well-designed abstractions, sandbox environments, thorough testing, easy rollback,
            detailed monitoring.
          </li>
        </ul>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Maintainability: Three Design Principles</h3>

        <p className="mb-4">
          The majority of the cost of software is not in initial development but in ongoing maintenance:
          fixing bugs, keeping systems operational, investigating failures, adapting to new platforms,
          repaying technical debt, and adding new features. Three design principles help minimize pain:
        </p>

        <div className="my-4 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 font-mono text-sm space-y-2">
          <p className="text-emerald-400">Operability   — make it easy for operations teams to keep the system healthy</p>
          <p className="text-indigo-400">Simplicity     — manage complexity through good abstractions, not accidental complexity</p>
          <p className="text-yellow-400">Evolvability   — make it easy to make changes (also called extensibility or plasticity)</p>
        </div>
      </section>

      {/* ========== Section 2: Describing Load ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Describing Load</h2>

        <p className="mb-4">
          Before we can discuss scalability, we need a vocabulary for describing the current load on a system.
          Load can be described with a few numbers called <strong className="text-white">load parameters</strong>.
          The best choice of parameters depends on your system&rsquo;s architecture:
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li><strong className="text-white">Requests per second</strong> to a web server</li>
          <li><strong className="text-white">Read-to-write ratio</strong> in a database</li>
          <li><strong className="text-white">Number of simultaneously active users</strong> in a chat room</li>
          <li><strong className="text-white">Hit rate</strong> on a cache</li>
        </ul>

        <p className="mb-4">
          Perhaps the average case matters most to you, or perhaps your bottleneck is dominated by a small
          number of extreme cases. The visualization below shows request traffic arriving at a server. Watch
          how <span className="text-rose-400">spike traffic</span> (red bars) can far exceed the average.
          A system designed only for average load will collapse under spikes.
        </p>

        <RequestLoadSketch />

        <p className="mt-4">
          Twitter provides a famous example from DDIA. They had two main operations: <em>post a tweet</em>
          (4.6k req/s average, 12k peak) and <em>view home timeline</em> (300k req/s). The challenge was
          not the write volume but the fan-out: each tweet needed to be delivered to all followers. A user
          with 30 million followers means a single tweet triggers 30 million writes to timeline caches.
          Understanding <em>which</em> load parameter is the bottleneck is crucial.
        </p>
      </section>

      {/* ========== Section 3: Describing Performance ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Describing Performance</h2>

        <p className="mb-4">
          Once you have described the load, you can investigate what happens when load increases. Two
          questions matter:
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>When you increase a load parameter and keep system resources unchanged, how is performance affected?</li>
          <li>When you increase a load parameter, how much do you need to increase resources to keep performance unchanged?</li>
        </ul>

        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">Latency vs Response Time</h3>

        <p className="mb-4">
          <strong className="text-white">Response time</strong> is what the client sees: the time between
          sending a request and receiving the response. It includes network delays, queueing delays, and
          the actual service time. <strong className="text-white">Latency</strong> is the time a request
          spends waiting to be handled — the time it is &quot;latent,&quot; awaiting service.
        </p>

        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">Percentiles, Not Averages</h3>

        <p className="mb-4">
          If you take your list of response times and sort them, the <strong className="text-white">median</strong>
          (50th percentile, p50) is the halfway point. Half of requests are served faster than the median.
          The median is a good metric for what users &quot;typically&quot; experience.
        </p>

        <p className="mb-4">
          But the tail matters enormously. The 95th, 99th, and 99.9th percentiles (p95, p99, p999) tell you
          how bad the outliers are. Amazon observed that a 100ms increase in response time reduces sales by
          1%. They also found that the customers with the slowest requests are often the most valuable,
          because they have the most data in their accounts.
        </p>

        <p className="mb-4">
          <strong className="text-white">Tail latency amplification:</strong> even if only a small
          percentage of backend calls are slow, if an end-user request requires multiple backend calls
          in parallel, the probability that at least one is slow goes up dramatically. With 5 parallel
          backend calls at p99 = 1s, roughly 5% of user requests will take more than 1 second.
        </p>

        <p className="mb-4">
          The visualization below shows a histogram of 1000 request latencies with p50, p95, and p99
          lines. <strong className="text-white">Increase the load slider</strong> and watch the tail
          latencies grow — this is exactly what happens to real systems under pressure.
        </p>

        <LatencyDistributionSketch />
      </section>

      {/* ========== Section 4: Approaches to Scalability ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Approaches to Scalability</h2>

        <p className="mb-4">
          There are two fundamental approaches to handling increased load:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-lg bg-gray-800/60 border border-indigo-800/40 p-5">
            <h4 className="text-md font-semibold text-indigo-400 mb-2">Vertical Scaling (Scale Up)</h4>
            <p className="text-sm">
              Move to a more powerful machine — more CPUs, RAM, disk. Simple, but there is a hard ceiling:
              the most powerful single machine you can buy. Also, costs grow super-linearly: a machine
              with 2x the CPUs costs far more than 2x the price.
            </p>
          </div>
          <div className="rounded-lg bg-gray-800/60 border border-emerald-800/40 p-5">
            <h4 className="text-md font-semibold text-emerald-400 mb-2">Horizontal Scaling (Scale Out)</h4>
            <p className="text-sm">
              Distribute load across multiple smaller machines. More complex (need load balancing,
              data partitioning, replication) but no ceiling and fault-tolerant — losing one machine
              is not catastrophic. This is the &quot;shared-nothing&quot; architecture.
            </p>
          </div>
        </div>

        <p className="mb-4">
          In practice, good architectures use a pragmatic mixture of both approaches. The visualization
          below lets you compare the two strategies side by side. Notice how horizontal scaling provides
          natural redundancy, while vertical scaling has diminishing returns and a hard limit.
        </p>

        <ScalingSketch />

        <p className="mt-4">
          An architecture that is appropriate for one level of load is unlikely to cope with 10 times
          that load. The architecture of systems that operate at large scale is usually highly specific
          to the application — there is no one-size-fits-all scalable architecture (informally known
          as <em>magic scaling sauce</em>). The problem may be reads, writes, data volume, data
          complexity, response time requirements, or some combination. Scalable architectures are built
          from general-purpose building blocks arranged in familiar patterns.
        </p>
      </section>

      {/* ========== Section 5: SLAs and Error Budgets ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">SLAs and Error Budgets</h2>

        <p className="mb-4">
          A <strong className="text-white">Service Level Agreement (SLA)</strong> is a contract that
          defines the expected level of service. SLAs are commonly expressed as uptime percentages.
          The difference between &quot;three nines&quot; (99.9%) and &quot;four nines&quot; (99.99%) sounds
          trivially small, but the allowed downtime differs by an order of magnitude.
        </p>

        <p className="mb-4">
          The <strong className="text-white">error budget</strong> concept, popularized by Google SRE,
          flips the question: instead of asking &quot;how do we prevent all downtime?&quot; you ask
          &quot;how much unreliability can we tolerate?&quot; This budget can then be &quot;spent&quot; on
          deploying new features, running experiments, or performing necessary maintenance.
        </p>

        <SLACalculator />

        <p className="mt-4">
          Note that SLAs are often defined in terms of percentiles, not just uptime. For example:
          &quot;99% of requests will have a response time under 200ms, and 99.9% under 1s.&quot;
          This brings together everything we discussed about latency distributions and percentiles.
        </p>
      </section>

      {/* ========== Section 6: Python — Percentile Latencies ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Computing Percentile Latencies</h2>

        <p className="mb-4">
          Let us generate a realistic latency distribution and compute its percentiles. We will model
          a system where most requests are fast, but a long tail of slow requests exists due to garbage
          collection pauses, cache misses, and network retries.
        </p>

        <PythonCell
          title="Latency Percentiles & Distribution"
          defaultCode={`import numpy as np

# Simulate 10,000 request latencies (in ms)
np.random.seed(42)
n = 10000

# Base latency: log-normal distribution (common in real systems)
base = np.random.lognormal(mean=3.5, sigma=0.5, size=n)

# Add occasional spikes (5% of requests hit slow path)
spike_mask = np.random.random(n) < 0.05
spikes = np.random.exponential(scale=200, size=n)
latencies = base + spike_mask * spikes

# Compute percentiles
percentiles = [50, 90, 95, 99, 99.9]
values = np.percentile(latencies, percentiles)

print("=== Latency Distribution Analysis ===")
print(f"Total requests: {n}")
print(f"Mean latency:   {np.mean(latencies):.1f} ms")
print(f"Std deviation:  {np.std(latencies):.1f} ms")
print(f"Min:            {np.min(latencies):.1f} ms")
print(f"Max:            {np.max(latencies):.1f} ms")
print()
print("--- Percentiles ---")
for p, v in zip(percentiles, values):
    label = f"p{p}"
    print(f"  {label:>6}: {v:>8.1f} ms")

print()
print("--- SLA Compliance ---")
sla_threshold = 200  # ms
compliant = np.sum(latencies < sla_threshold) / n * 100
print(f"  Requests under {sla_threshold}ms: {compliant:.2f}%")
print(f"  SLA target 99.0%: {'PASS' if compliant >= 99.0 else 'FAIL'}")
print(f"  SLA target 99.9%: {'PASS' if compliant >= 99.9 else 'FAIL'}")

print()
# Tail latency amplification
# If a user request fans out to k parallel backend calls,
# what is the probability that at least one is slow?
for k in [1, 3, 5, 10, 20]:
    p_one_fast = np.sum(latencies < 100) / n
    p_all_fast = p_one_fast ** k
    p_any_slow = 1 - p_all_fast
    print(f"  Fan-out={k:>2}: P(any call > 100ms) = {p_any_slow*100:.1f}%")`}
        />
      </section>

      {/* ========== Section 7: Python — Load Test Simulation ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Simulating a Load Test</h2>

        <p className="mb-4">
          In a real load test, we ramp up the request rate and observe how the system responds. Here
          we simulate a server with a queue: as load increases beyond capacity, requests pile up in the
          queue and response times degrade. This is the fundamental mechanism behind tail latency growth.
        </p>

        <PythonCell
          title="Load Test Simulation"
          defaultCode={`import numpy as np

np.random.seed(7)

def simulate_server(arrival_rate, service_rate, duration_sec=60):
    """Simulate a single-server queue (M/M/1 model).

    arrival_rate: requests arriving per second
    service_rate: requests the server can handle per second
    """
    t = 0.0
    queue = []  # list of arrival times
    response_times = []

    while t < duration_sec:
        # Time until next arrival (exponential)
        inter_arrival = np.random.exponential(1.0 / arrival_rate)
        t += inter_arrival

        # Service time for this request
        service_time = np.random.exponential(1.0 / service_rate)

        # When can we start processing?
        if queue:
            start_time = max(t, queue[-1])  # wait for prev to finish
        else:
            start_time = t

        finish_time = start_time + service_time
        queue.append(finish_time)

        # Response time = finish - arrival
        response_times.append((finish_time - t) * 1000)  # to ms

        # Prune old queue entries
        queue = [q for q in queue if q > t]

    return np.array(response_times)

print("=== Load Test: Ramping Request Rate ===")
print(f"{'Rate':>8} {'Count':>7} {'p50':>8} {'p95':>8} {'p99':>8} {'SLA<200ms':>10}")
print("-" * 55)

service_capacity = 100  # server handles 100 req/s

for rate in [20, 50, 70, 85, 95, 99, 105]:
    rts = simulate_server(rate, service_capacity)
    if len(rts) < 10:
        continue
    p50 = np.percentile(rts, 50)
    p95 = np.percentile(rts, 95)
    p99 = np.percentile(rts, 99)
    sla = np.sum(rts < 200) / len(rts) * 100
    status = "OK" if sla >= 99.0 else "WARN" if sla >= 95.0 else "FAIL"
    print(f"{rate:>5}/s  {len(rts):>7} {p50:>7.1f}ms {p95:>7.1f}ms {p99:>7.1f}ms {sla:>8.1f}% {status}")

print()
print("Key insight: As arrival rate approaches service capacity,")
print("latencies grow EXPONENTIALLY (not linearly). This is the")
print("fundamental queueing theory result that governs all systems.")
print()
print("At 95% utilization, the average queue length is 19x higher")
print("than at 50% utilization. Never run servers at >80% capacity!")`}
        />
      </section>

      {/* ========== Summary ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-5">
          <ul className="space-y-3">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">1.</span>
              <span>
                <strong className="text-white">Reliability</strong> means making systems work correctly
                even when faults occur. Faults can be in hardware, software, or humans. We build
                fault-tolerant systems, not fault-free systems.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>
                <strong className="text-white">Scalability</strong> requires first describing load with
                precise parameters, then measuring performance with percentiles (not averages). The tail
                latencies (p99, p999) often matter more than the median.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>
                <strong className="text-white">Vertical scaling</strong> (bigger machines) is simpler but
                has a hard ceiling. <strong className="text-white">Horizontal scaling</strong> (more machines)
                is more complex but provides fault tolerance and has no ceiling.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">4.</span>
              <span>
                <strong className="text-white">SLAs</strong> define expected service levels. Error budgets
                give teams a quantitative framework for balancing reliability with feature velocity.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">5.</span>
              <span>
                <strong className="text-white">Maintainability</strong> — operability, simplicity,
                evolvability — is what determines the long-term success of a system. Most of the cost
                of software is maintenance, not initial development.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </article>
  )
}
