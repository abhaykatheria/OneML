import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-uber',
  title: 'Design Uber (Ride-Sharing)',
  description:
    'System design case study: real-time ride matching, tracking, and payments at massive global scale',
  track: 'systems',
  order: 17,
  tags: [
    'system-design',
    'uber',
    'ride-sharing',
    'geospatial',
    'real-time',
    'matching',
    'surge-pricing',
    'websocket',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const INDIGO: [number, number, number] = [99, 102, 241]
const PINK: [number, number, number] = [236, 72, 153]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const TEXT_C: [number, number, number] = [148, 163, 184]
const RED: [number, number, number] = [239, 68, 68]
const CYAN: [number, number, number] = [34, 211, 238]
const PURPLE: [number, number, number] = [168, 85, 247]
const ORANGE: [number, number, number] = [251, 146, 60]

/* ------------------------------------------------------------------ */
/* Helper: draw a rounded box with label                               */
/* ------------------------------------------------------------------ */

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
  label: string,
  subLabel?: string,
) {
  p.fill(color[0], color[1], color[2], 40)
  p.stroke(...color)
  p.strokeWeight(2)
  p.rect(x - w / 2, y - h / 2, w, h, 8)
  p.noStroke()
  p.fill(255)
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(11)
  p.text(label, x, subLabel ? y - 7 : y)
  if (subLabel) {
    p.fill(...TEXT_C)
    p.textSize(9)
    p.text(subLabel, x, y + 9)
  }
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number],
  label?: string,
) {
  p.stroke(...color)
  p.strokeWeight(2)
  p.line(x1, y1, x2, y2)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const aLen = 8
  p.fill(...color)
  p.noStroke()
  p.triangle(
    x2,
    y2,
    x2 - aLen * Math.cos(angle - 0.4),
    y2 - aLen * Math.sin(angle - 0.4),
    x2 - aLen * Math.cos(angle + 0.4),
    y2 - aLen * Math.sin(angle + 0.4),
  )
  if (label) {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    p.fill(...TEXT_C)
    p.textSize(8)
    p.textAlign(p.CENTER, p.BOTTOM)
    p.text(label, mx, my - 4)
  }
}

/* ------------------------------------------------------------------ */
/* Sketch 1: High-Level Architecture with Ride Lifecycle               */
/* ------------------------------------------------------------------ */

function ArchitectureSketch() {
  const [phase, setPhase] = useState(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 460

    const phases = [
      'Rider requests a ride',
      'Matching Service finds nearby driver',
      'Driver en route to pickup',
      'Rider picked up, in transit',
      'Dropoff complete, payment settled',
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const ph = phaseRef.current
      const cx = p.width / 2

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Uber Architecture \u2014 Ride Lifecycle', cx, 10)

      // Phase description
      p.fill(...YELLOW)
      p.textSize(12)
      p.text(phases[ph], cx, 30)

      // Rider App (left)
      const riderX = 70
      const riderY = 130
      const rActive = ph <= 1
      drawBox(p, riderX, riderY, 90, 50, rActive ? PINK : GRID_C, 'Rider App')

      // Driver App (right)
      const driverX = p.width - 70
      const driverY = 130
      const dActive = ph >= 1
      drawBox(p, driverX, driverY, 90, 50, dActive ? GREEN : GRID_C, 'Driver App')

      // API Gateway
      const gwX = cx
      const gwY = 80
      drawBox(p, gwX, gwY, 100, 36, PURPLE, 'API Gateway')

      // Ride Service
      const rideX = cx - 120
      const rideY = 170
      drawBox(p, rideX, rideY, 100, 44, INDIGO, 'Ride Service', 'state machine')

      // Matching Service
      const matchX = cx + 120
      const matchY = 170
      const matchActive = ph === 1
      drawBox(p, matchX, matchY, 100, 44, matchActive ? YELLOW : CYAN, 'Matching', 'geospatial')

      // Location Service
      const locX = cx + 120
      const locY = 260
      drawBox(p, locX, locY, 100, 44, ORANGE, 'Location Svc', '500K writes/s')

      // Payment Service
      const payX = cx - 120
      const payY = 330
      const payActive = ph === 4
      drawBox(p, payX, payY, 100, 44, payActive ? GREEN : PURPLE, 'Payment Svc', 'idempotent')

      // Notification Service
      const notifX = cx
      const notifY = 330
      drawBox(p, notifX, notifY, 100, 44, PINK, 'Notification', 'push + SMS')

      // WebSocket Gateway
      const wsX = cx
      const wsY = 260
      drawBox(p, wsX, wsY, 100, 44, CYAN, 'WebSocket GW', 'real-time')

      // Arrows based on phase
      if (ph >= 0) {
        drawArrow(p, riderX + 45, riderY - 10, gwX - 50, gwY, PINK, 'request ride')
        drawArrow(p, gwX - 30, gwY + 18, rideX, rideY - 22, PURPLE)
      }
      if (ph >= 1) {
        drawArrow(p, rideX + 50, rideY, matchX - 50, matchY, INDIGO, 'find driver')
        drawArrow(p, matchX + 50, matchY - 10, driverX - 45, driverY, YELLOW, 'offer ride')
      }
      if (ph >= 2) {
        drawArrow(p, driverX - 45, driverY + 15, locX + 50, locY - 15, ORANGE, 'location pings')
        drawArrow(p, locX - 50, locY, wsX + 50, wsY, ORANGE)
        drawArrow(p, wsX - 50, wsY, riderX + 45, riderY + 15, CYAN, 'live tracking')
      }
      if (ph >= 4) {
        drawArrow(p, rideX, rideY + 22, payX, payY - 22, INDIGO, 'charge fare')
        drawArrow(p, payX + 50, payY, notifX - 50, notifY, GREEN, 'receipt')
      }

      // Ride state indicator
      const stateLabels = ['REQUESTED', 'MATCHING', 'DRIVER_EN_ROUTE', 'IN_TRANSIT', 'COMPLETED']
      const stateColors: [number, number, number][] = [PINK, YELLOW, ORANGE, CYAN, GREEN]
      p.fill(...stateColors[ph])
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`Ride State: ${stateLabels[ph]}`, cx, H - 30)

      // State machine dots
      const dotY = H - 16
      const dotSpacing = 80
      const startX = cx - (stateLabels.length - 1) * dotSpacing / 2
      for (let i = 0; i < stateLabels.length; i++) {
        const dx = startX + i * dotSpacing
        p.fill(i <= ph ? stateColors[i][0] : 50, i <= ph ? stateColors[i][1] : 50, i <= ph ? stateColors[i][2] : 50)
        p.noStroke()
        p.ellipse(dx, dotY, 12, 12)
        if (i < stateLabels.length - 1) {
          p.stroke(i < ph ? 100 : 40)
          p.strokeWeight(2)
          p.line(dx + 6, dotY, dx + dotSpacing - 6, dotY)
        }
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={460}
      controls={
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setPhase((s) => Math.max(0, s - 1))}
            className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
          >
            Prev Phase
          </button>
          <button
            onClick={() => setPhase((s) => Math.min(4, s + 1))}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
          >
            Next Phase
          </button>
          <button
            onClick={() => setPhase(0)}
            className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
          >
            Reset
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Sketch 2: Geospatial Matching with Geohash Cells                    */
/* ------------------------------------------------------------------ */

function GeospatialSketch() {
  const frameRef = useRef(0)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(showSearch)
  searchRef.current = showSearch

  const sketch = useCallback((p: p5) => {
    const W = 700
    const H = 450
    const CELLS = 8
    let drivers: { x: number; y: number; cell: string }[] = []
    let riderX = 0
    let riderY = 0

    function cellAt(gx: number, gy: number): string {
      return `${gx},${gy}`
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
      p.randomSeed(42)

      const gridSize = (Math.min(p.width, H) - 100) / CELLS
      const offsetX = 60
      const offsetY = 50

      // Scatter drivers
      drivers = []
      for (let i = 0; i < 25; i++) {
        const gx = Math.floor(p.random(CELLS))
        const gy = Math.floor(p.random(CELLS))
        drivers.push({
          x: offsetX + gx * gridSize + p.random(gridSize * 0.2, gridSize * 0.8),
          y: offsetY + gy * gridSize + p.random(gridSize * 0.2, gridSize * 0.8),
          cell: cellAt(gx, gy),
        })
      }

      // Rider position
      riderX = offsetX + 3.5 * gridSize
      riderY = offsetY + 4.5 * gridSize
    }

    p.draw = () => {
      frameRef.current++
      const t = frameRef.current
      p.background(...BG)
      const searching = searchRef.current

      const gridSize = (Math.min(p.width, H) - 100) / CELLS
      const offsetX = 60
      const offsetY = 50

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Geospatial Matching \u2014 Geohash Grid', p.width / 2, 10)

      // Rider cell
      const riderCellX = Math.floor((riderX - offsetX) / gridSize)
      const riderCellY = Math.floor((riderY - offsetY) / gridSize)

      // Search ring expansion
      const searchRadius = searching ? Math.min(Math.floor(t * 0.02), 3) : 0

      // Draw grid cells
      for (let gx = 0; gx < CELLS; gx++) {
        for (let gy = 0; gy < CELLS; gy++) {
          const cx = offsetX + gx * gridSize
          const cy = offsetY + gy * gridSize
          const dx = Math.abs(gx - riderCellX)
          const dy = Math.abs(gy - riderCellY)
          const dist = Math.max(dx, dy)

          let cellColor: [number, number, number] = GRID_C
          if (searching && dist <= searchRadius) {
            if (dist === 0) {
              cellColor = PINK
            } else if (dist === 1) {
              cellColor = ORANGE
            } else if (dist === 2) {
              cellColor = YELLOW
            } else {
              cellColor = INDIGO
            }
          }

          p.fill(cellColor[0], cellColor[1], cellColor[2], searching && dist <= searchRadius ? 50 : 15)
          p.stroke(cellColor[0], cellColor[1], cellColor[2], searching && dist <= searchRadius ? 120 : 40)
          p.strokeWeight(1)
          p.rect(cx, cy, gridSize, gridSize)

          // Cell label
          p.noStroke()
          p.fill(80)
          p.textSize(7)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`${gx}${gy}`, cx + 2, cy + 2)
        }
      }

      // Draw drivers
      for (const d of drivers) {
        const dCellX = Math.floor((d.x - offsetX) / gridSize)
        const dCellY = Math.floor((d.y - offsetY) / gridSize)
        const dx = Math.abs(dCellX - riderCellX)
        const dy = Math.abs(dCellY - riderCellY)
        const dist = Math.max(dx, dy)
        const inRange = searching && dist <= searchRadius

        p.noStroke()
        p.fill(inRange ? GREEN[0] : 80, inRange ? GREEN[1] : 80, inRange ? GREEN[2] : 80)
        p.ellipse(d.x, d.y, inRange ? 12 : 8, inRange ? 12 : 8)

        if (inRange) {
          // Car icon (simple triangle)
          p.fill(...GREEN)
          p.textSize(8)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text('\u{1F697}', d.x, d.y - 6)
        }
      }

      // Draw rider
      p.fill(...PINK)
      p.noStroke()
      p.ellipse(riderX, riderY, 16, 16)
      p.fill(255)
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('R', riderX, riderY)

      // Rider label
      p.fill(...PINK)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('\u2190 Rider', riderX + 14, riderY)

      // Search ring legend
      if (searching) {
        const legX = p.width - 160
        const legY = 60
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Search rings:', legX, legY)

        const rings: { label: string; color: [number, number, number] }[] = [
          { label: 'Ring 0 (rider cell)', color: PINK },
          { label: 'Ring 1 (adjacent)', color: ORANGE },
          { label: 'Ring 2 (next ring)', color: YELLOW },
          { label: 'Ring 3 (expanding)', color: INDIGO },
        ]
        for (let i = 0; i < rings.length; i++) {
          if (i > searchRadius) break
          p.fill(...rings[i].color)
          p.textSize(9)
          p.text(rings[i].label, legX, legY + 18 + i * 16)
        }

        // Count nearby drivers
        const nearby = drivers.filter((d) => {
          const dCellX = Math.floor((d.x - offsetX) / gridSize)
          const dCellY = Math.floor((d.y - offsetY) / gridSize)
          return Math.max(Math.abs(dCellX - riderCellX), Math.abs(dCellY - riderCellY)) <= searchRadius
        })
        p.fill(...GREEN)
        p.textSize(11)
        p.text(`Drivers found: ${nearby.length}`, legX, legY + 100)
      }

      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Geohash cells group nearby locations. Search expands ring by ring until K drivers found.', 10, H - 6)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={450}
      controls={
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setShowSearch(false)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              !showSearch
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            IDLE
          </button>
          <button
            onClick={() => { setShowSearch(true); frameRef.current = 0 }}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              showSearch
                ? 'bg-pink-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            SEARCH FOR DRIVERS
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Sketch 3: Surge Pricing Zones                                       */
/* ------------------------------------------------------------------ */

function SurgePricingSketch() {
  const frameRef = useRef(0)
  const [surgeMode, setSurgeMode] = useState(false)
  const surgeRef = useRef(surgeMode)
  surgeRef.current = surgeMode

  const sketch = useCallback((p: p5) => {
    const W = 700
    const H = 400
    const ZONES = 4

    interface ZoneState {
      name: string
      drivers: number
      riders: number
      multiplier: number
      x: number
      y: number
    }

    const zones: ZoneState[] = [
      { name: 'Downtown', drivers: 20, riders: 15, multiplier: 1.0, x: 0, y: 0 },
      { name: 'Airport', drivers: 8, riders: 5, multiplier: 1.0, x: 0, y: 0 },
      { name: 'Stadium', drivers: 12, riders: 10, multiplier: 1.0, x: 0, y: 0 },
      { name: 'Suburbs', drivers: 18, riders: 8, multiplier: 1.0, x: 0, y: 0 },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
      const spacing = p.width / (ZONES + 1)
      for (let i = 0; i < ZONES; i++) {
        zones[i].x = spacing * (i + 1)
        zones[i].y = H / 2 - 20
      }
    }

    p.draw = () => {
      frameRef.current++
      const t = frameRef.current
      p.background(...BG)
      const isSurge = surgeRef.current

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Surge Pricing \u2014 Supply vs Demand per Zone', p.width / 2, 10)

      // Simulate surge at Stadium zone
      if (isSurge) {
        const surgeFactor = Math.min((t % 500) * 0.01, 1)
        zones[2].riders = 10 + Math.floor(surgeFactor * 40)
        zones[2].multiplier = 1.0 + Math.min(surgeFactor * 2.5, 2.5)
        zones[1].riders = 5 + Math.floor(surgeFactor * 15)
        zones[1].multiplier = 1.0 + Math.min(surgeFactor * 1.2, 1.2)
      } else {
        zones[2].riders = 10
        zones[2].multiplier = 1.0
        zones[1].riders = 5
        zones[1].multiplier = 1.0
      }

      for (const z of zones) {
        const ratio = z.riders / Math.max(z.drivers, 1)
        const isHot = ratio > 1.5
        const isWarm = ratio > 1.0

        // Zone circle
        const radius = 60
        const zoneColor: [number, number, number] = isHot ? RED : isWarm ? ORANGE : GREEN
        p.fill(zoneColor[0], zoneColor[1], zoneColor[2], 30)
        p.stroke(...zoneColor)
        p.strokeWeight(2)
        p.ellipse(z.x, z.y, radius * 2, radius * 2)

        // Zone name
        p.noStroke()
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(z.name, z.x, z.y - 25)

        // Supply/demand
        p.fill(...GREEN)
        p.textSize(9)
        p.text(`Drivers: ${z.drivers}`, z.x, z.y - 8)
        p.fill(...PINK)
        p.text(`Riders: ${z.riders}`, z.x, z.y + 6)

        // Multiplier
        const multColor: [number, number, number] = z.multiplier > 2.0 ? RED : z.multiplier > 1.5 ? ORANGE : z.multiplier > 1.0 ? YELLOW : GREEN
        p.fill(...multColor)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${z.multiplier.toFixed(1)}x`, z.x, z.y + 25)

        // Bar chart below
        const barY = z.y + radius + 20
        const barW = 40
        const barH = 50

        // Supply bar
        const supplyH = (z.drivers / 30) * barH
        p.fill(...GREEN)
        p.noStroke()
        p.rect(z.x - barW / 2 - 2, barY + barH - supplyH, barW / 2 - 2, supplyH, 2)

        // Demand bar
        const demandH = Math.min((z.riders / 30) * barH, barH + 20)
        p.fill(...PINK)
        p.rect(z.x + 2, barY + barH - demandH, barW / 2 - 2, demandH, 2)

        // Labels
        p.fill(...TEXT_C)
        p.textSize(7)
        p.textAlign(p.CENTER, p.TOP)
        p.text('S   D', z.x, barY + barH + 3)
      }

      // Legend
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Green = balanced | Orange = warming | Red = surging. Multiplier increases with demand/supply ratio.', 10, H - 6)

      // Formula
      p.fill(...YELLOW)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('multiplier = f(demand / supply) with smoothing + caps', p.width / 2, H - 20)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => { setSurgeMode(false); frameRef.current = 0 }}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              !surgeMode
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            NORMAL
          </button>
          <button
            onClick={() => { setSurgeMode(true); frameRef.current = 0 }}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              surgeMode
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            SURGE EVENT (concert ends)
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Sketch 4: Real-Time Tracking via WebSocket                          */
/* ------------------------------------------------------------------ */

function TrackingSketch() {
  const frameRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    const W = 700
    const H = 400

    interface RoutePoint {
      x: number
      y: number
    }

    let route: RoutePoint[] = []
    let locationEvents: { x: number; y: number; t: number }[] = []

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)

      // Build a route from pickup to dropoff
      const startX = 80
      const startY = 300
      const endX = p.width - 120
      const endY = 100
      const midX1 = startX + (endX - startX) * 0.3
      const midY1 = startY - 50
      const midX2 = startX + (endX - startX) * 0.6
      const midY2 = endY + 80
      // Bezier-like route points
      route = []
      for (let t = 0; t <= 1; t += 0.005) {
        const u = 1 - t
        const rx = u * u * u * startX + 3 * u * u * t * midX1 + 3 * u * t * t * midX2 + t * t * t * endX
        const ry = u * u * u * startY + 3 * u * u * t * midY1 + 3 * u * t * t * midY2 + t * t * t * endY
        route.push({ x: rx, y: ry })
      }
    }

    p.draw = () => {
      frameRef.current++
      const t = frameRef.current
      p.background(...BG)

      if (route.length === 0) return

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Real-Time Tracking \u2014 WebSocket Location Stream', p.width / 2, 10)

      // Draw route path
      p.stroke(40, 50, 70)
      p.strokeWeight(3)
      p.noFill()
      p.beginShape()
      for (const pt of route) {
        p.vertex(pt.x, pt.y)
      }
      p.endShape()

      // Driver position (moves along route)
      const progress = (t * 0.003) % 1
      const routeIdx = Math.floor(progress * (route.length - 1))
      const driverPos = route[routeIdx]

      // Emit location event every ~60 frames (simulating 4s interval)
      if (t % 60 === 0) {
        locationEvents.push({ x: driverPos.x, y: driverPos.y, t })
        if (locationEvents.length > 20) locationEvents.shift()
      }

      // Draw past location events (breadcrumbs)
      for (let i = 0; i < locationEvents.length; i++) {
        const ev = locationEvents[i]
        const age = (t - ev.t) / 300
        const alpha = Math.max(0, 1 - age)
        p.noStroke()
        p.fill(CYAN[0], CYAN[1], CYAN[2], alpha * 150)
        p.ellipse(ev.x, ev.y, 6, 6)
      }

      // Draw traversed path in color
      p.stroke(...GREEN)
      p.strokeWeight(3)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= routeIdx; i++) {
        p.vertex(route[i].x, route[i].y)
      }
      p.endShape()

      // Driver dot
      p.noStroke()
      p.fill(...GREEN)
      p.ellipse(driverPos.x, driverPos.y, 18, 18)
      p.fill(255)
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('D', driverPos.x, driverPos.y)

      // Pickup marker
      p.fill(...PINK)
      p.noStroke()
      p.ellipse(route[0].x, route[0].y, 14, 14)
      p.fill(255)
      p.textSize(7)
      p.text('P', route[0].x, route[0].y)
      p.fill(...PINK)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Pickup', route[0].x + 12, route[0].y)

      // Dropoff marker
      const last = route[route.length - 1]
      p.fill(...YELLOW)
      p.noStroke()
      p.ellipse(last.x, last.y, 14, 14)
      p.fill(0)
      p.textSize(7)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('X', last.x, last.y)
      p.fill(...YELLOW)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Dropoff', last.x + 12, last.y)

      // WebSocket event stream panel
      const panelX = p.width - 180
      const panelY = 50
      p.fill(20, 25, 40)
      p.stroke(40, 50, 70)
      p.strokeWeight(1)
      p.rect(panelX, panelY, 170, 180, 6)

      p.noStroke()
      p.fill(...CYAN)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('WebSocket Events', panelX + 8, panelY + 8)

      const recentEvents = locationEvents.slice(-7)
      for (let i = 0; i < recentEvents.length; i++) {
        const ev = recentEvents[i]
        p.fill(...TEXT_C)
        p.textSize(8)
        p.text(
          `loc: (${ev.x.toFixed(0)}, ${ev.y.toFixed(0)}) t=${ev.t}`,
          panelX + 8,
          panelY + 26 + i * 18,
        )
      }

      // Latency note
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Driver pushes GPS every 4s \u2192 Location Service \u2192 WebSocket \u2192 Rider sees ~1s delay', 10, H - 6)
    }
  }, [])

  return <P5Sketch sketch={sketch} height={400} />
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function DesignUber() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-14 text-gray-200">
      {/* ---- Section 1: Problem Statement ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Design Uber (Ride-Sharing)
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          Build a real-time ride-sharing platform: match riders with nearby
          drivers, track rides live, compute dynamic pricing, and settle payments
          &mdash; all at a scale of millions of concurrent rides across the globe.
        </p>
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">The challenge:</strong> Every 4
            seconds, 2 million drivers send their GPS coordinates. Riders expect
            a match within 1 second. The system must handle city-scale demand
            spikes (concerts, sporting events) while maintaining 99.99% uptime.
          </p>
        </div>
      </section>

      {/* ---- Section 2: Functional Requirements ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Functional Requirements</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-300">
          <li>
            <strong className="text-white">Request a ride:</strong> Rider provides
            pickup location and destination. System estimates fare and ETA.
          </li>
          <li>
            <strong className="text-white">Match with nearby drivers:</strong>{' '}
            Find the closest available drivers using geospatial indexing. Offer the
            ride; first to accept wins.
          </li>
          <li>
            <strong className="text-white">Real-time tracking:</strong> Both rider
            and driver see live location on a map, updated every 4 seconds.
          </li>
          <li>
            <strong className="text-white">Fare estimation &amp; surge pricing:</strong>{' '}
            Dynamic pricing based on supply/demand ratio per geographic zone.
          </li>
          <li>
            <strong className="text-white">Trip history &amp; ratings:</strong>{' '}
            Complete record of past trips. Mutual rider/driver ratings.
          </li>
          <li>
            <strong className="text-white">Payments:</strong> Charge the rider,
            pay the driver (minus commission). Support multiple payment methods.
          </li>
        </ul>
      </section>

      {/* ---- Section 3: Non-Functional Requirements ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Non-Functional Requirements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">{'<'}1 second matching</h3>
            <p className="text-sm text-gray-300">
              From ride request to driver notification in under 1 second. Geospatial
              queries must be blazing fast.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Real-time location (4s)</h3>
            <p className="text-sm text-gray-300">
              2M drivers sending GPS every 4 seconds = 500K location writes/sec.
              Must be ingested and queryable in near real-time.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">99.99% availability</h3>
            <p className="text-sm text-gray-300">
              ~52 minutes of downtime per year. Multi-region deployment. No single
              point of failure for the ride lifecycle.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">1M concurrent rides</h3>
            <p className="text-sm text-gray-300">
              Handle 20M rides/day globally. State machines for each ride must be
              durable and consistent even through failures.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 4: Back-of-Envelope Calculations ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Back-of-Envelope Calculations</h2>
        <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm space-y-2 text-gray-300">
          <p>Daily rides: <span className="text-cyan-400">20,000,000</span></p>
          <p>Concurrent rides at peak: <span className="text-cyan-400">~1,000,000</span></p>
          <p>Online drivers: <span className="text-cyan-400">2,000,000</span></p>
          <p>Location updates: <span className="text-cyan-400">2M / 4s = 500,000 writes/sec</span></p>
          <p>Location record size: <span className="text-cyan-400">~100 bytes</span> (driver_id, lat, lng, ts)</p>
          <p>Location throughput: <span className="text-cyan-400">500K x 100B = 50 MB/sec</span></p>
          <p>Trip records/day: <span className="text-cyan-400">20M x ~2KB = 40 GB/day</span></p>
          <p>Matching queries/sec: <span className="text-cyan-400">~230 rides/sec avg, 2K/sec peak</span></p>
          <p>WebSocket connections: <span className="text-cyan-400">~2M (riders tracking) + 2M (drivers) = 4M</span></p>
        </div>
      </section>

      {/* ---- Section 5: API Design ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">API Design</h2>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-4">
          <div>
            <p className="text-green-400">POST /rides</p>
            <pre className="text-gray-300 mt-1 ml-4">{`{
  "rider_id": "uuid",
  "pickup": { "lat": 37.7749, "lng": -122.4194 },
  "destination": { "lat": 37.3382, "lng": -121.8863 },
  "ride_type": "UberX"   // UberX, UberXL, UberBlack
}`}</pre>
            <p className="text-gray-500 mt-1 ml-4">{'\u2192'} 201 {'{'} "ride_id": "uuid", "estimated_fare": 42.50, "eta_minutes": 5, "surge": 1.2 {'}'}</p>
          </div>
          <div>
            <p className="text-green-400">POST /rides/:id/accept</p>
            <pre className="text-gray-300 mt-1 ml-4">{`{ "driver_id": "uuid" }`}</pre>
            <p className="text-gray-500 ml-4">{'\u2192'} 200 {'{'} "status": "driver_en_route", "driver": {'{'} ... {'}'} {'}'}</p>
          </div>
          <div>
            <p className="text-cyan-400">GET /rides/:id/track</p>
            <p className="text-gray-500 ml-4">{'\u2192'} WebSocket upgrade. Streams {'{'} "lat", "lng", "heading", "eta" {'}'} every 4s</p>
          </div>
          <div>
            <p className="text-green-400">POST /rides/:id/complete</p>
            <p className="text-gray-500 ml-4">{'\u2192'} 200 {'{'} "final_fare": 45.00, "payment_status": "charged" {'}'}</p>
          </div>
          <div>
            <p className="text-cyan-400">GET /fare-estimate?pickup_lat=...&amp;dest_lat=...</p>
            <p className="text-gray-500 ml-4">{'\u2192'} {'{'} "fare_range": [38, 48], "surge_multiplier": 1.2, "eta_minutes": 5 {'}'}</p>
          </div>
        </div>
      </section>

      {/* ---- Section 6: Data Model ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Data Model</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-indigo-400 font-semibold font-mono mb-2">User</h3>
            <pre className="text-sm text-gray-300">{`id           UUID (PK)
type         ENUM: rider, driver
name         VARCHAR
email        VARCHAR (unique)
phone        VARCHAR
rating       DECIMAL(3,2)
payment_methods JSONB
created_at   TIMESTAMP`}</pre>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-green-400 font-semibold font-mono mb-2">Vehicle</h3>
            <pre className="text-sm text-gray-300">{`id           UUID (PK)
driver_id    UUID (FK)
make         VARCHAR
model        VARCHAR
year         INT
license_plate VARCHAR (unique)
vehicle_type ENUM: standard, xl, black`}</pre>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-pink-400 font-semibold font-mono mb-2">Ride</h3>
            <pre className="text-sm text-gray-300">{`id           UUID (PK)
rider_id     UUID (FK)
driver_id    UUID (FK, nullable)
status       ENUM: requested, matching,
  driver_en_route, in_transit,
  completed, cancelled
pickup       POINT (lat, lng)
destination  POINT (lat, lng)
fare         DECIMAL
surge_multi  DECIMAL
requested_at TIMESTAMP
started_at   TIMESTAMP
completed_at TIMESTAMP`}</pre>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-orange-400 font-semibold font-mono mb-2">Location (hot store)</h3>
            <pre className="text-sm text-gray-300">{`driver_id    UUID (PK)
lat          DOUBLE
lng          DOUBLE
heading      FLOAT
speed        FLOAT
geohash      VARCHAR(12) (indexed)
updated_at   TIMESTAMP
-- In Redis/memory. TTL = 30s
-- Stale entries auto-expire
-- (driver went offline)`}</pre>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-sm">
          <p className="text-gray-300">
            <strong className="text-yellow-400">Key insight:</strong> The Location
            table is not in PostgreSQL &mdash; it lives in an in-memory store (Redis
            with geospatial indexing, or a custom spatial index). It is ephemeral and
            write-heavy (500K/sec). Trip data is in a durable RDBMS.
          </p>
        </div>
      </section>

      {/* ---- Section 7: High-Level Architecture ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">High-Level Architecture</h2>
        <p className="leading-relaxed">
          The system decomposes into domain services: <strong className="text-indigo-400">Ride Service</strong> (state
          machine for ride lifecycle), <strong className="text-cyan-400">Matching Service</strong> (geospatial
          driver lookup), <strong className="text-orange-400">Location Service</strong> (ingests 500K GPS
          pings/sec), <strong className="text-purple-400">Payment Service</strong> (fare
          calculation &amp; charging), and a <strong className="text-cyan-400">WebSocket
          Gateway</strong> for real-time tracking.
        </p>
        <ArchitectureSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Ride lifecycle state machine:</strong>{' '}
            REQUESTED {'\u2192'} MATCHING {'\u2192'} DRIVER_EN_ROUTE {'\u2192'} IN_TRANSIT {'\u2192'} COMPLETED.
            Each state transition is persisted atomically. If any service crashes,
            the ride can be resumed from its last persisted state.
          </p>
          <p>
            <strong className="text-orange-400">Location Service</strong> is the
            write-heaviest component. It receives driver pings, updates the
            geospatial index, and fans out location events to subscribed riders
            via the WebSocket Gateway.
          </p>
        </div>
      </section>

      {/* ---- Section 8: Deep Dive — Geospatial Matching ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Geospatial Matching
        </h2>
        <p className="leading-relaxed">
          When a rider requests a ride, we need to find the K nearest available
          drivers. A brute-force scan of 2M driver locations is too slow. Instead
          we partition the Earth&apos;s surface into <strong className="text-pink-400">geohash cells</strong> &mdash;
          each cell is a rectangular region encoded as a string prefix. Nearby
          locations share a common prefix.
        </p>
        <p className="leading-relaxed">
          The matching algorithm works in <strong className="text-yellow-400">expanding rings</strong>:
          first search the rider&apos;s own cell, then adjacent cells, then the next
          ring, until enough candidates are found. Since geohash cells have a
          known spatial extent, we can bound the search efficiently.
        </p>
        <GeospatialSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-cyan-400">Geohash vs Quadtree:</strong> Geohash
            maps to string prefixes, making it trivial to shard across Redis nodes
            (GEORADIUS). Quadtrees give more adaptive resolution but are harder to
            distribute. Uber uses a variant of Google&apos;s S2 geometry library which
            provides hierarchical cell IDs with consistent coverage.
          </p>
          <p>
            <strong className="text-green-400">Optimization:</strong> Pre-filter
            drivers by <code className="text-cyan-400">status = available</code> in
            the geospatial index. Store driver status alongside location. A driver
            who is already on a trip is excluded without a separate DB lookup.
          </p>
        </div>
      </section>

      {/* ---- Section 9: Deep Dive — Surge Pricing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Surge Pricing
        </h2>
        <p className="leading-relaxed">
          Surge pricing is a market mechanism: when demand (riders) exceeds supply
          (drivers) in a zone, fares increase to (a) discourage marginal demand
          and (b) incentivize more drivers to enter the zone. The multiplier is
          computed per geographic zone (city block or neighborhood granularity).
        </p>
        <SurgePricingSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Computation:</strong> Every 1-2
            minutes, a background job computes per-zone supply/demand ratio. The
            multiplier function has smoothing (to avoid oscillation), a minimum
            threshold (no surge below 1.0x), and a configurable cap (e.g., 5.0x).
          </p>
          <p>
            <strong className="text-pink-400">Surge pinning:</strong> Once a rider
            confirms a ride at a quoted surge price, that price is locked in. Even
            if surge drops during the ride, the rider pays the quoted amount (or
            vice versa). This prevents race conditions between pricing and booking.
          </p>
          <p>
            <strong className="text-green-400">Heat maps:</strong> Uber shows
            drivers a heat map of high-demand zones. This naturally rebalances
            supply as drivers move toward surge areas for higher earnings.
          </p>
        </div>
      </section>

      {/* ---- Section 10: Deep Dive — Real-Time Tracking ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Real-Time Tracking
        </h2>
        <p className="leading-relaxed">
          The driver app pushes GPS coordinates every 4 seconds to the Location
          Service. The rider subscribes to their driver&apos;s location via a
          WebSocket connection. The system must fan out location updates from
          one driver to the subscribed rider with minimal latency.
        </p>
        <TrackingSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-cyan-400">Architecture:</strong> Driver {'\u2192'}{' '}
            Location Service (writes to geospatial index + publishes to Kafka
            topic partitioned by driver_id) {'\u2192'} WebSocket Gateway (subscribes
            to relevant partitions) {'\u2192'} Rider.
          </p>
          <p>
            <strong className="text-orange-400">Push vs Pull:</strong> Push
            (WebSocket) is used for active ride tracking because latency matters.
            For the &quot;nearby drivers&quot; map on the home screen, we use a pull
            model (periodic API calls) since it is less latency-sensitive and has
            many more subscribers.
          </p>
          <p>
            <strong className="text-yellow-400">ETA prediction:</strong> Raw GPS
            coordinates are snapped to roads using a map-matching service. The ETA
            is computed using real-time traffic data plus the remaining route
            distance. Updated with each location ping.
          </p>
        </div>
      </section>

      {/* ---- Section 11: Scaling Strategy ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Scaling Strategy</h2>
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-indigo-400 font-semibold mb-2">Geospatial sharding by city/region</h3>
            <p className="text-sm text-gray-300">
              Each city or metro area is an independent shard. A rider in San Francisco
              never needs to query driver locations in New York. This provides natural
              data locality and allows independent scaling per city.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-orange-400 font-semibold mb-2">Separate read/write paths for locations</h3>
            <p className="text-sm text-gray-300">
              Location writes (500K/sec) go to a write-optimized store (Redis, or a
              custom ring buffer). Location reads (matching queries, tracking) go
              through read replicas. The write path is append-only; the read path
              serves only the latest position per driver.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-pink-400 font-semibold mb-2">CQRS for trip data</h3>
            <p className="text-sm text-gray-300">
              The Ride Service writes to a transactional database (PostgreSQL).
              Trip history, analytics, and search are served from a read-optimized
              store (Elasticsearch or Cassandra) populated via change data capture.
              This separates the OLTP and OLAP workloads.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-cyan-400 font-semibold mb-2">WebSocket Gateway scaling</h3>
            <p className="text-sm text-gray-300">
              4M concurrent WebSocket connections require many gateway nodes. Use
              consistent hashing to route a rider&apos;s connection to the same
              gateway node. If a node fails, connections are re-established and
              routed to a different node (clients auto-reconnect).
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 12: Fault Tolerance ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Fault Tolerance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Ride state machine durability</h3>
            <p className="text-sm text-gray-300">
              Each state transition is persisted to the database before acknowledging.
              If the Ride Service crashes, the ride resumes from its last committed
              state. An orchestrator periodically scans for stuck rides
              (e.g., &quot;matching&quot; for {'>'} 2 minutes) and retries or cancels them.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Payment idempotency</h3>
            <p className="text-sm text-gray-300">
              Each payment carries an idempotency key (ride_id). If the charge
              request is retried due to a timeout, the payment provider deduplicates.
              No double charges. Settlement (paying the driver) is async and
              eventually consistent.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Driver location TTL</h3>
            <p className="text-sm text-gray-300">
              Each location record has a 30-second TTL in Redis. If a driver&apos;s
              app crashes or loses connectivity, their location expires automatically.
              Stale drivers are never matched with riders.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Multi-region failover</h3>
            <p className="text-sm text-gray-300">
              Active-active deployment across regions. Each region handles its local
              cities. If an entire region fails, DNS routes traffic to the nearest
              healthy region. Cross-region replication ensures trip data is not lost.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 13: Tradeoffs ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Tradeoffs</h2>
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Geohash vs Quadtree for Spatial Index
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Geohash (common choice):</strong>{' '}
              String-based, easy to shard and store in Redis (GEOADD/GEORADIUS).
              Fixed-precision cells may have edge-case issues at cell boundaries.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Quadtree:</strong> Adaptive
              resolution (denser areas get finer cells). Better for non-uniform
              distributions but harder to distribute across nodes. Uber uses S2
              cells (a hybrid approach).
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Push vs Pull for Location Updates
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Push (WebSocket, our choice for active rides):</strong>{' '}
              Low latency, server-initiated. But each connection consumes resources.
              4M connections require significant gateway infrastructure.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Pull (polling):</strong> Simpler
              infrastructure, stateless servers. Higher latency, more bandwidth
              waste. Used for the &quot;nearby drivers&quot; preview where freshness
              tolerance is higher.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Consistency vs Latency for Matching
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Eventual consistency (our choice):</strong>{' '}
              The driver location index is eventually consistent (a few seconds stale).
              This is acceptable because a matched driver might decline anyway. We
              optimize for speed ({'{<'}1s matching) over perfect accuracy.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Strong consistency:</strong> Would
              require synchronous replication of every location update. At 500K
              writes/sec, this would add unacceptable latency and is not worth the
              precision gain.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Dispatch Strategy: Nearest vs Optimal
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Nearest driver:</strong> Simple,
              fast. But globally suboptimal &mdash; assigning the nearest driver to
              each request greedily can leave some riders stranded while nearby
              drivers are assigned to distant requests.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Batch optimal (Uber&apos;s approach):</strong>{' '}
              Collect requests in short batches (~2s), solve a bipartite matching
              problem (Hungarian algorithm) to minimize total wait time. Better
              globally but adds latency from batching.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Summary</h2>
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p className="text-gray-300">
            Designing Uber is a masterclass in real-time systems at scale. The key
            insights are:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
            <li>
              <strong className="text-pink-400">Geospatial indexing</strong>{' '}
              (geohash/S2 cells) for sub-second driver matching with expanding
              ring search.
            </li>
            <li>
              <strong className="text-orange-400">Separate hot and cold paths:</strong>{' '}
              in-memory store for 500K location writes/sec, durable DB for trip
              records.
            </li>
            <li>
              <strong className="text-cyan-400">WebSocket for real-time tracking</strong>{' '}
              during active rides, polling for non-critical views.
            </li>
            <li>
              <strong className="text-red-400">Surge pricing</strong> as a
              market-clearing mechanism with zone-level granularity, smoothing,
              and price pinning.
            </li>
            <li>
              <strong className="text-indigo-400">Ride state machine</strong>{' '}
              persisted to durable storage for crash recovery, with an
              orchestrator for stuck-ride cleanup.
            </li>
            <li>
              <strong className="text-yellow-400">City-level sharding</strong>{' '}
              for natural data locality and independent scaling per market.
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
