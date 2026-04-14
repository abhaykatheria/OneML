import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/replication',
  title: 'Replication',
  description: 'How data is copied across multiple nodes for fault tolerance, scalability, and low latency — and the consistency challenges that arise',
  track: 'systems',
  order: 5,
  tags: ['replication', 'consistency', 'leader-follower', 'quorum', 'conflict-resolution', 'high-availability'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface NodeState {
  x: number
  y: number
  label: string
  role: 'leader' | 'follower'
  data: number
  alive: boolean
  lagMs: number
  color: [number, number, number]
}

function drawNode(p: p5, node: NodeState, highlight: boolean, pulse: number) {
  const r = 30
  if (!node.alive) {
    p.fill(60, 30, 30)
    p.stroke(200, 60, 60)
    p.strokeWeight(2)
  } else if (highlight) {
    p.fill(40, 80, 140)
    p.stroke(100, 200, 255, 150 + pulse * 100)
    p.strokeWeight(3)
  } else {
    p.fill(node.color[0] * 0.3, node.color[1] * 0.3, node.color[2] * 0.3)
    p.stroke(node.color[0], node.color[1], node.color[2])
    p.strokeWeight(1.5)
  }
  p.ellipse(node.x, node.y, r * 2, r * 2)

  p.fill(255)
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(10)
  p.text(node.label, node.x, node.y - 6)
  p.textSize(9)
  p.fill(180)
  p.text(`v${node.data}`, node.x, node.y + 8)

  if (!node.alive) {
    p.stroke(200, 60, 60)
    p.strokeWeight(3)
    p.line(node.x - 12, node.y - 12, node.x + 12, node.y + 12)
    p.line(node.x + 12, node.y - 12, node.x - 12, node.y + 12)
  }
}

function drawArrow(p: p5, x1: number, y1: number, x2: number, y2: number, color: [number, number, number, number], weight: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 10
  const fromR = 32
  const toR = 32

  const sx = x1 + Math.cos(angle) * fromR
  const sy = y1 + Math.sin(angle) * fromR
  const ex = x2 - Math.cos(angle) * toR
  const ey = y2 - Math.sin(angle) * toR

  p.stroke(color[0], color[1], color[2], color[3])
  p.strokeWeight(weight)
  p.line(sx, sy, ex, ey)

  p.fill(color[0], color[1], color[2], color[3])
  p.noStroke()
  p.triangle(
    ex, ey,
    ex - headLen * Math.cos(angle - 0.3), ey - headLen * Math.sin(angle - 0.3),
    ex - headLen * Math.cos(angle + 0.3), ey - headLen * Math.sin(angle + 0.3)
  )
}

/* ================================================================== */
/*  Section 1 -- Why Replicate?                                        */
/* ================================================================== */
function WhyReplicateSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Replicate?</h2>
      <p className="text-gray-300 leading-relaxed">
        Keeping a copy of data on multiple machines serves several goals:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">High availability</strong> -- if one machine dies, others can
          continue serving requests. This is the most fundamental reason: a single point of failure
          means a single disk crash takes down your entire service.
        </li>
        <li>
          <strong className="text-white">Reduced latency</strong> -- by placing replicas geographically
          close to users, you avoid round-trips across continents. A user in Tokyo reads from a replica
          in Tokyo, not from a primary in Virginia.
        </li>
        <li>
          <strong className="text-white">Read scalability</strong> -- if your workload is read-heavy
          (and most are), you can spread read queries across many replicas. The leader handles writes;
          followers handle reads.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The fundamental challenge of replication is keeping data consistent across nodes when data changes.
        Every write must eventually reach every replica, but network delays, machine failures, and
        concurrent writes create a minefield of consistency anomalies. The three main replication
        architectures -- single-leader, multi-leader, and leaderless -- make different trade-offs in
        handling these challenges.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Single-Leader Replication (p5 animated)               */
/* ================================================================== */
function SingleLeaderSection() {
  const [leaderAlive, setLeaderAlive] = useState(true)
  const [, setWriteInFlight] = useState(false)
  const stateRef = useRef({ leaderAlive: true, writeInFlight: false, writeT: 0, failoverT: 0, replicatePhase: 0 })

  const sketch = useCallback((p: p5) => {
    let t = 0

    const leader: NodeState = { x: 0, y: 80, label: 'Leader', role: 'leader', data: 5, alive: true, lagMs: 0, color: [100, 180, 255] }
    const followers: NodeState[] = [
      { x: 0, y: 240, label: 'Follower A', role: 'follower', data: 5, alive: true, lagMs: 50, color: [80, 200, 120] },
      { x: 0, y: 240, label: 'Follower B', role: 'follower', data: 5, alive: true, lagMs: 120, color: [80, 200, 120] },
      { x: 0, y: 240, label: 'Follower C', role: 'follower', data: 5, alive: true, lagMs: 200, color: [80, 200, 120] },
    ]

    p.setup = () => {
      const w = Math.min(p.windowWidth - 40, 760)
      p.createCanvas(w, 340)
      p.textFont('monospace')
      leader.x = w / 2
      const spacing = w / 4
      followers[0].x = spacing
      followers[1].x = spacing * 2
      followers[2].x = spacing * 3
    }

    p.draw = () => {
      t += 0.02
      const state = stateRef.current
      leader.alive = state.leaderAlive
      p.background(15, 15, 25)

      const pulse = Math.sin(t * 4)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Single-Leader Replication', 20, 10)

      // Client
      p.fill(60, 60, 90)
      p.stroke(140, 140, 200)
      p.strokeWeight(1)
      p.rect(leader.x - 40, 10, 80, 28, 6)
      p.fill(200)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Client', leader.x, 24)

      // Write arrow to leader
      if (state.writeInFlight) {
        state.writeT += 0.02
        const writeProgress = Math.min(state.writeT, 1)

        // Animate write going to leader
        if (writeProgress < 0.3 && leader.alive) {
          const wy = p.lerp(38, leader.y - 30, writeProgress / 0.3)
          p.fill(255, 200, 60)
          p.noStroke()
          p.ellipse(leader.x, wy, 12, 12)
          p.fill(50)
          p.textSize(7)
          p.text('W', leader.x, wy)
        }

        // Leader updates
        if (writeProgress >= 0.3 && leader.alive) {
          leader.data = 6
        }

        // Replication arrows flowing down
        if (writeProgress >= 0.4 && leader.alive) {
          const repProgress = (writeProgress - 0.4) / 0.6
          for (let i = 0; i < followers.length; i++) {
            const lagFactor = (i + 1) * 0.25
            const thisProgress = Math.max(0, Math.min(1, (repProgress - lagFactor * 0.3) / 0.7))

            if (thisProgress > 0 && thisProgress < 1) {
              const ry = p.lerp(leader.y + 30, followers[i].y - 30, thisProgress)
              drawArrow(p, leader.x, leader.y, followers[i].x, followers[i].y,
                [80, 200, 120, Math.floor(thisProgress * 200)], 1.5)
              p.fill(80, 200, 120, 200)
              p.noStroke()
              p.ellipse(p.lerp(leader.x, followers[i].x, thisProgress), ry, 10, 10)
            }

            if (thisProgress >= 1) {
              followers[i].data = 6
            }
          }
        }

        if (writeProgress >= 1) {
          state.writeInFlight = false
          state.writeT = 0
        }
      }

      // Always draw replication lines (faint)
      if (leader.alive) {
        for (const f of followers) {
          drawArrow(p, leader.x, leader.y, f.x, f.y, [80, 200, 120, 40], 1)
        }
      }

      // Failover animation
      if (!leader.alive) {
        state.failoverT += 0.01
        if (state.failoverT > 0.5 && state.failoverT < 0.8) {
          // Election in progress
          p.fill(255, 200, 60)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text('ELECTION IN PROGRESS...', p.width / 2, leader.y + 40)

          // Voting arrows between followers
          for (let i = 0; i < followers.length; i++) {
            for (let j = i + 1; j < followers.length; j++) {
              p.stroke(255, 200, 60, 100 + Math.sin(t * 8 + i) * 80)
              p.strokeWeight(1)
              p.line(followers[i].x, followers[i].y, followers[j].x, followers[j].y)
            }
          }
        }
        if (state.failoverT > 0.8) {
          // Follower A promoted
          followers[0].role = 'leader'
          followers[0].label = 'New Leader'
          followers[0].color = [100, 180, 255]
          p.fill(80, 200, 120)
          p.textSize(10)
          p.textAlign(p.CENTER, p.TOP)
          p.text('Follower A promoted to leader!', p.width / 2, leader.y + 40)

          // New replication from new leader
          for (let i = 1; i < followers.length; i++) {
            drawArrow(p, followers[0].x, followers[0].y, followers[i].x, followers[i].y,
              [100, 180, 255, 80], 1)
          }
        }
      } else {
        state.failoverT = 0
        followers[0].role = 'follower'
        followers[0].label = 'Follower A'
        followers[0].color = [80, 200, 120]
      }

      // Draw nodes
      drawNode(p, leader, state.writeInFlight && leader.alive, pulse)
      for (const f of followers) {
        drawNode(p, f, false, pulse)
      }

      // Lag indicators
      p.fill(160)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (const f of followers) {
        const lag = f.data < leader.data ? `lag: ${f.lagMs}ms` : 'up to date'
        p.text(lag, f.x, f.y + 36)
      }

      // Legend
      p.fill(120)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Writes go to leader only. Followers replicate asynchronously.', 20, p.height - 8)
    }
  }, [])

  const handleWrite = () => {
    stateRef.current.writeInFlight = true
    stateRef.current.writeT = 0
    setWriteInFlight(true)
  }

  const toggleLeader = () => {
    const next = !leaderAlive
    setLeaderAlive(next)
    stateRef.current.leaderAlive = next
    stateRef.current.failoverT = 0
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Single-Leader Replication</h2>
      <p className="text-gray-300 leading-relaxed">
        The most common replication strategy: one node is designated the <strong className="text-white">leader</strong>
        (also called primary or master). All writes go to the leader. The leader streams changes to its
        <strong className="text-white"> followers</strong> (replicas, secondaries) via a replication log.
        Followers apply the changes in the same order the leader processed them.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Reads can go to any node. This is where the consistency problems begin: if a follower has not yet
        applied the latest writes, a client reading from it sees stale data. Click "Send Write" to watch
        a write propagate through the system. Click "Kill Leader" to trigger a failover election.
      </p>
      <P5Sketch
        sketch={sketch}
        height={340}
        controls={
          <ControlPanel title="Controls">
            <div className="flex gap-3">
              <button
                onClick={handleWrite}
                disabled={!leaderAlive}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  leaderAlive
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Send Write
              </button>
              <button
                onClick={toggleLeader}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  leaderAlive
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {leaderAlive ? 'Kill Leader' : 'Revive Leader'}
              </button>
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Replication Lag Problems (p5 timeline)                */
/* ================================================================== */
function ReplicationLagSection() {
  const [lagAmount, setLagAmount] = useState(300)
  const stateRef = useRef({ lagAmount: 300 })
  stateRef.current.lagAmount = lagAmount

  const sketch = useCallback((p: p5) => {
    let t = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.01
      const lag = stateRef.current.lagAmount
      p.background(15, 15, 25)

      const timelineY = 50
      const leaderY = 120
      const followerY = 200
      const clientY = 290
      const leftX = 80
      const rightX = p.width - 40

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Replication Lag: The "Time Travel" Problem', 20, 10)

      // Timeline
      p.stroke(80)
      p.strokeWeight(1)
      p.line(leftX, timelineY, rightX, timelineY)

      // Time markers
      const totalMs = 1000
      for (let ms = 0; ms <= totalMs; ms += 100) {
        const x = p.map(ms, 0, totalMs, leftX, rightX)
        p.stroke(60)
        p.line(x, timelineY - 5, x, timelineY + 5)
        p.fill(120)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${ms}ms`, x, timelineY + 8)
      }

      // Node labels
      p.fill(100, 180, 255)
      p.textSize(11)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Leader', leftX - 10, leaderY)
      p.fill(80, 200, 120)
      p.text('Follower', leftX - 10, followerY)
      p.fill(200, 160, 80)
      p.text('Client', leftX - 10, clientY)

      // Leader timeline bar
      p.fill(30, 50, 80)
      p.noStroke()
      p.rect(leftX, leaderY - 10, rightX - leftX, 20, 3)

      // Follower timeline bar
      p.fill(30, 60, 40)
      p.rect(leftX, followerY - 10, rightX - leftX, 20, 3)

      // Client timeline bar
      p.fill(50, 40, 20)
      p.rect(leftX, clientY - 10, rightX - leftX, 20, 3)

      // Write event at t=200ms on leader
      const writeT = 200
      const writeX = p.map(writeT, 0, totalMs, leftX, rightX)

      p.fill(255, 100, 60)
      p.noStroke()
      p.rect(writeX - 2, leaderY - 10, 4, 20, 1)
      p.textSize(8)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.fill(255, 100, 60)
      p.text('WRITE x=42', writeX, leaderY - 14)

      // Replication arrives at follower at t=200+lag
      const replicaT = writeT + lag
      const replicaX = p.map(Math.min(replicaT, totalMs), 0, totalMs, leftX, rightX)

      if (replicaT <= totalMs) {
        p.fill(80, 200, 120)
        p.rect(replicaX - 2, followerY - 10, 4, 20, 1)
        p.textSize(8)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`Replicated (${lag}ms lag)`, replicaX, followerY - 14)

        // Lag zone (stale reads possible here)
        p.fill(255, 80, 80, 30)
        p.noStroke()
        p.rect(writeX, followerY - 10, replicaX - writeX, 20)
        p.fill(255, 80, 80, 150)
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('STALE', (writeX + replicaX) / 2, followerY)
      }

      // Replication arrow
      if (replicaT <= totalMs) {
        p.stroke(80, 200, 120, 80)
        p.strokeWeight(1)
        const dashPhase = t * 100
        for (let i = 0; i < 10; i++) {
          const frac = ((i * 0.1 + dashPhase * 0.01) % 1)
          const dx = p.lerp(writeX, replicaX, frac)
          const dy = p.lerp(leaderY + 10, followerY - 10, frac)
          p.point(dx, dy)
        }
      }

      // Client reads
      const read1T = 250  // Read from leader at 250ms -> gets x=42
      const read2T = 350  // Read from follower at 350ms -> might be stale
      const read1X = p.map(read1T, 0, totalMs, leftX, rightX)
      const read2X = p.map(read2T, 0, totalMs, leftX, rightX)

      // Read 1: from leader
      p.fill(100, 180, 255)
      p.noStroke()
      p.rect(read1X - 2, clientY - 10, 4, 20, 1)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('READ leader', read1X, clientY + 14)
      p.fill(80, 200, 120)
      p.text('x=42 (correct)', read1X, clientY + 26)

      // Arrow from client to leader
      p.stroke(100, 180, 255, 100)
      p.strokeWeight(1)
      p.line(read1X, clientY - 10, read1X, leaderY + 10)

      // Read 2: from follower
      const followerHasData = read2T >= replicaT
      p.fill(200, 160, 80)
      p.noStroke()
      p.rect(read2X - 2, clientY - 10, 4, 20, 1)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('READ follower', read2X, clientY + 14)
      p.fill(followerHasData ? p.color(80, 200, 120) : p.color(255, 80, 80))
      p.text(followerHasData ? 'x=42 (correct)' : 'x=OLD (stale!)', read2X, clientY + 26)

      // Arrow from client to follower
      p.stroke(200, 160, 80, 100)
      p.strokeWeight(1)
      p.line(read2X, clientY - 10, read2X, followerY + 10)

      // Problem explanation
      p.fill(200)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      if (!followerHasData) {
        p.fill(255, 120, 80)
        p.text('Read-after-write inconsistency: client wrote x=42, then reads stale value from follower!', 20, p.height - 30)
      } else {
        p.fill(80, 200, 120)
        p.text('With this lag, the follower has caught up by the time the client reads. No inconsistency.', 20, p.height - 30)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Replication Lag Problems</h2>
      <p className="text-gray-300 leading-relaxed">
        When replication is asynchronous (and it almost always is, for performance), followers may lag
        behind the leader. This creates several consistency anomalies:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Read-after-write consistency</strong> -- a user writes data, then
          immediately reads it back. If the read goes to a follower that has not yet replicated the write,
          the user sees their write "disappear."
        </li>
        <li>
          <strong className="text-white">Monotonic reads</strong> -- a user makes two reads. The first
          goes to a follower with lag=100ms (sees the write). The second goes to a follower with lag=300ms
          (does not see it). The user sees data "go back in time."
        </li>
        <li>
          <strong className="text-white">Consistent prefix reads</strong> -- a sequence of causally
          related writes appears in the wrong order when reading from replicas with different lag.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Adjust the replication lag below and observe how it affects whether the client's read from the
        follower is stale. With enough lag, the client sees old data even though the leader already has
        the write.
      </p>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <ControlPanel title="Replication Lag">
            <InteractiveSlider
              label="Lag Amount"
              min={50}
              max={800}
              step={50}
              value={lagAmount}
              onChange={(v) => { setLagAmount(v); stateRef.current.lagAmount = v }}
              unit="ms"
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Multi-Leader Replication (p5)                         */
/* ================================================================== */
function MultiLeaderSection() {
  const [, setShowConflict] = useState(false)
  const stateRef = useRef({ showConflict: false, conflictT: 0 })

  const sketch = useCallback((p: p5) => {
    let t = 0

    interface DC {
      x: number
      y: number
      label: string
      leaderColor: [number, number, number]
      data: string
    }

    const dcs: DC[] = [
      { x: 0, y: 0, label: 'US-East', leaderColor: [100, 180, 255], data: 'x=1' },
      { x: 0, y: 0, label: 'EU-West', leaderColor: [200, 120, 255], data: 'x=1' },
      { x: 0, y: 0, label: 'AP-Tokyo', leaderColor: [255, 180, 80], data: 'x=1' },
    ]

    p.setup = () => {
      const w = Math.min(p.windowWidth - 40, 760)
      p.createCanvas(w, 340)
      p.textFont('monospace')

      dcs[0].x = w * 0.2; dcs[0].y = 120
      dcs[1].x = w * 0.5; dcs[1].y = 80
      dcs[2].x = w * 0.8; dcs[2].y = 120
    }

    p.draw = () => {
      t += 0.02
      const state = stateRef.current
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Multi-Leader Replication (Multi-Datacenter)', 20, 10)

      // Bidirectional replication arrows between all DCs
      for (let i = 0; i < dcs.length; i++) {
        for (let j = i + 1; j < dcs.length; j++) {
          const pulse = Math.sin(t * 3 + i + j) * 0.3 + 0.5
          p.stroke(100, 100, 140, Math.floor(60 * pulse))
          p.strokeWeight(1)
          p.line(dcs[i].x, dcs[i].y, dcs[j].x, dcs[j].y)

          // Animated replication dots
          const frac = ((t * 0.3 + i * 0.3) % 1)
          const dx = p.lerp(dcs[i].x, dcs[j].x, frac)
          const dy = p.lerp(dcs[i].y, dcs[j].y, frac)
          p.fill(100, 100, 140, Math.floor(120 * pulse))
          p.noStroke()
          p.ellipse(dx, dy, 5, 5)

          // Reverse direction
          const frac2 = ((t * 0.3 + j * 0.3 + 0.5) % 1)
          const dx2 = p.lerp(dcs[j].x, dcs[i].x, frac2)
          const dy2 = p.lerp(dcs[j].y, dcs[i].y, frac2)
          p.ellipse(dx2, dy2, 5, 5)
        }
      }

      // Draw datacenter boxes
      for (const dc of dcs) {
        // DC boundary
        p.fill(25, 28, 40)
        p.stroke(60, 65, 80)
        p.strokeWeight(1)
        p.rect(dc.x - 55, dc.y - 45, 110, 90, 8)

        // Leader node
        p.fill(dc.leaderColor[0] * 0.3, dc.leaderColor[1] * 0.3, dc.leaderColor[2] * 0.3)
        p.stroke(dc.leaderColor[0], dc.leaderColor[1], dc.leaderColor[2])
        p.strokeWeight(1.5)
        p.ellipse(dc.x, dc.y - 10, 36, 36)

        p.fill(255)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Leader', dc.x, dc.y - 16)
        p.fill(180)
        p.textSize(8)
        p.text(dc.data, dc.x, dc.y - 4)

        // Follower dots
        p.fill(60, 80, 60)
        p.stroke(80, 120, 80)
        p.strokeWeight(1)
        p.ellipse(dc.x - 18, dc.y + 26, 14, 14)
        p.ellipse(dc.x + 18, dc.y + 26, 14, 14)

        // DC label
        p.fill(dc.leaderColor[0], dc.leaderColor[1], dc.leaderColor[2])
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(dc.label, dc.x, dc.y - 48)
      }

      // Write conflict animation
      if (state.showConflict) {
        state.conflictT += 0.015

        if (state.conflictT > 0 && state.conflictT < 0.4) {
          // Concurrent writes
          p.fill(255, 100, 60)
          p.textSize(10)
          p.textAlign(p.CENTER, p.TOP)
          p.text('SET x=2', dcs[0].x, dcs[0].y + 50)
          p.fill(100, 255, 60)
          p.text('SET x=3', dcs[1].x, dcs[1].y + 50)

          dcs[0].data = 'x=2'
          dcs[1].data = 'x=3'
        }

        if (state.conflictT > 0.4 && state.conflictT < 0.7) {
          // Conflict detected
          p.fill(255, 60, 60, 180)
          p.textSize(14)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('CONFLICT!', p.width / 2, 200)
          p.textSize(10)
          p.fill(255, 150, 100)
          p.text('Both leaders modified x concurrently', p.width / 2, 220)
          p.text('US-East says x=2, EU-West says x=3', p.width / 2, 235)
        }

        if (state.conflictT > 0.7) {
          // Resolution
          p.fill(255, 200, 60)
          p.textSize(12)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('Resolution Strategies:', p.width / 2, 200)

          const strategies = [
            'Last-Write-Wins (LWW): highest timestamp wins',
            'Custom merge: application-specific logic',
            'CRDT: mathematically conflict-free data types',
          ]
          p.textSize(10)
          p.fill(200)
          for (let i = 0; i < strategies.length; i++) {
            p.text(strategies[i], p.width / 2, 222 + i * 18)
          }
        }

        if (state.conflictT > 1.5) {
          state.conflictT = 0
          state.showConflict = false
          dcs[0].data = 'x=1'
          dcs[1].data = 'x=1'
        }
      }

      // Legend
      p.fill(120)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Each datacenter has its own leader. Writes are replicated asynchronously between DCs.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Multi-Leader Replication</h2>
      <p className="text-gray-300 leading-relaxed">
        Single-leader replication has a limitation: all writes must go through one node. If you have
        multiple datacenters (for latency or compliance), every write from a remote datacenter must
        cross the WAN to reach the leader. <strong className="text-white">Multi-leader</strong>
        (also called master-master) replication places a leader in each datacenter. Each leader
        accepts writes locally and replicates asynchronously to other leaders.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The big trade-off: concurrent writes to different leaders can conflict. Two users in different
        datacenters modify the same record simultaneously. By the time the writes replicate, there
        is a conflict. Click "Trigger Write Conflict" to see this happen.
      </p>
      <P5Sketch
        sketch={sketch}
        height={340}
        controls={
          <ControlPanel title="Conflict Demo">
            <button
              onClick={() => {
                setShowConflict(true)
                stateRef.current.showConflict = true
                stateRef.current.conflictT = 0
              }}
              className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              Trigger Write Conflict
            </button>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Leaderless / Quorum Replication (p5)                  */
/* ================================================================== */
function LeaderlessQuorumSection() {
  const [numNodes, setNumNodes] = useState(5)
  const [writeQuorum, setWriteQuorum] = useState(3)
  const [readQuorum, setReadQuorum] = useState(3)
  const stateRef = useRef({ N: 5, W: 3, R: 3, animT: 0, phase: 'idle' as string })

  const triggerDemo = () => {
    stateRef.current.animT = 0
    stateRef.current.phase = 'write'
  }

  const sketch = useCallback((p: p5) => {
    let t = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      const { N, W, R } = stateRef.current
      p.background(15, 15, 25)

      const centerX = p.width / 2
      const centerY = 160
      const radius = 110

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Leaderless (Dynamo-style) Replication', 20, 10)

      // Quorum condition
      const quorumMet = W + R > N
      p.fill(quorumMet ? p.color(80, 200, 120) : p.color(255, 100, 60))
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`W + R ${quorumMet ? '>' : '<='} N  =>  ${W} + ${R} = ${W + R} ${quorumMet ? '>' : '<='} ${N}`, centerX, 30)
      p.text(quorumMet ? 'Quorum condition MET: reads guaranteed to see latest write' : 'Quorum condition NOT MET: stale reads possible!', centerX, 46)

      // Draw nodes in a circle
      const nodePositions: { x: number; y: number }[] = []
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2
        const nx = centerX + Math.cos(angle) * radius
        const ny = centerY + Math.sin(angle) * radius
        nodePositions.push({ x: nx, y: ny })
      }

      // Animation
      const state = stateRef.current
      if (state.phase !== 'idle') {
        state.animT += 0.012
      }

      // Determine which nodes received the write (first W nodes)
      const writeNodes = new Set<number>()
      const readNodes = new Set<number>()
      for (let i = 0; i < W; i++) writeNodes.add(i)
      // Read nodes: pick R nodes starting from an offset to show overlap
      const readOffset = Math.max(0, N - R)
      for (let i = 0; i < R; i++) readNodes.add((readOffset + i) % N)

      // Calculate overlap
      const overlap = new Set<number>()
      for (const n of writeNodes) {
        if (readNodes.has(n)) overlap.add(n)
      }

      // Draw connections
      if (state.phase === 'write' && state.animT < 0.5) {
        // Write arrows from client to W nodes
        const writeProgress = state.animT / 0.5
        for (const ni of writeNodes) {
          const node = nodePositions[ni]
          const alpha = Math.min(writeProgress * 400, 200)
          drawArrow(p, centerX, centerY + radius + 70, node.x, node.y, [255, 160, 60, alpha], 1.5)
        }
        p.fill(255, 160, 60)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Writing to ${W} nodes...`, centerX, centerY + radius + 80)
      }

      if (state.phase === 'write' && state.animT >= 0.5) {
        state.phase = 'read'
      }

      if (state.phase === 'read' && state.animT < 1.0) {
        // Read arrows from R nodes to client
        const readProgress = (state.animT - 0.5) / 0.5
        for (const ni of readNodes) {
          const node = nodePositions[ni]
          const alpha = Math.min(readProgress * 400, 200)
          drawArrow(p, node.x, node.y, centerX, centerY + radius + 70, [100, 200, 255, alpha], 1.5)
        }
        p.fill(100, 200, 255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Reading from ${R} nodes...`, centerX, centerY + radius + 80)
      }

      if (state.phase === 'read' && state.animT >= 1.0) {
        state.phase = 'result'
      }

      if (state.phase === 'result') {
        p.fill(quorumMet ? p.color(80, 200, 120) : p.color(255, 100, 60))
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        if (quorumMet) {
          p.text(`Overlap: ${overlap.size} node(s) have fresh data => read returns latest write`, centerX, centerY + radius + 80)
        } else {
          p.text(`Overlap: ${overlap.size} node(s) — may not include a node with the latest write!`, centerX, centerY + radius + 80)
        }

        if (state.animT > 2.0) {
          state.phase = 'idle'
          state.animT = 0
        }
      }

      // Draw nodes
      for (let i = 0; i < N; i++) {
        const node = nodePositions[i]
        const isWrite = writeNodes.has(i)
        const isRead = readNodes.has(i)
        const isOverlap = overlap.has(i)

        if (isOverlap && state.phase !== 'idle') {
          p.fill(80, 140, 60)
          p.stroke(200, 255, 100)
          p.strokeWeight(2.5)
        } else if (isWrite && state.phase !== 'idle') {
          p.fill(60, 50, 20)
          p.stroke(255, 160, 60)
          p.strokeWeight(2)
        } else if (isRead && state.phase !== 'idle') {
          p.fill(20, 50, 70)
          p.stroke(100, 200, 255)
          p.strokeWeight(2)
        } else {
          p.fill(40, 45, 60)
          p.stroke(100, 110, 140)
          p.strokeWeight(1.5)
        }
        p.ellipse(node.x, node.y, 44, 44)

        p.fill(255)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`N${i + 1}`, node.x, node.y - 5)

        // Version label
        p.fill(140)
        p.textSize(8)
        const hasLatest = isWrite || (state.phase === 'idle')
        p.text(hasLatest && state.phase !== 'idle' ? 'v2' : 'v1', node.x, node.y + 8)
      }

      // Legend
      p.fill(120)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Orange = write nodes (W) | Blue = read nodes (R) | Green = overlap (guarantees freshness)', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Leaderless Replication & Quorums</h2>
      <p className="text-gray-300 leading-relaxed">
        In leaderless replication (pioneered by Amazon's Dynamo), there is no designated leader. Clients
        send writes to <strong className="text-white">W</strong> nodes and reads to
        <strong className="text-white"> R</strong> nodes, out of <strong className="text-white">N</strong>
        total replicas. If <code className="text-emerald-400">W + R &gt; N</code>, at least one node
        in the read set must have the latest write -- this is the <strong className="text-white">quorum
        condition</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Adjust N, W, and R below. When the quorum condition is met, reads are guaranteed to see the
        latest write (assuming no failures). When it is not met, stale reads become possible. Click
        "Run Demo" to see the write and read phases animated.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Quorum Parameters">
            <InteractiveSlider
              label="N (total nodes)"
              min={3}
              max={9}
              step={1}
              value={numNodes}
              onChange={(v) => {
                setNumNodes(v)
                stateRef.current.N = v
                if (writeQuorum > v) { setWriteQuorum(v); stateRef.current.W = v }
                if (readQuorum > v) { setReadQuorum(v); stateRef.current.R = v }
              }}
            />
            <InteractiveSlider
              label="W (write quorum)"
              min={1}
              max={numNodes}
              step={1}
              value={writeQuorum}
              onChange={(v) => { setWriteQuorum(v); stateRef.current.W = v }}
            />
            <InteractiveSlider
              label="R (read quorum)"
              min={1}
              max={numNodes}
              step={1}
              value={readQuorum}
              onChange={(v) => { setReadQuorum(v); stateRef.current.R = v }}
            />
            <button
              onClick={triggerDemo}
              className="px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-500 transition-colors"
            >
              Run Demo
            </button>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Conflict Resolution                                   */
/* ================================================================== */
function ConflictResolutionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Conflict Resolution</h2>
      <p className="text-gray-300 leading-relaxed">
        When concurrent writes conflict, the system must resolve the disagreement. There is no universally
        correct resolution -- it depends on the application's semantics.
      </p>
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Last-Write-Wins (LWW)</h3>
          <p className="text-gray-300 text-sm">
            Attach a timestamp to each write. When conflicts are detected, the write with the highest
            timestamp wins. Simple and widely used (Cassandra defaults to this), but it silently
            discards concurrent writes. If two users edit the same document, one user's changes vanish
            without warning. LWW achieves <strong className="text-white">eventual convergence</strong>
            at the cost of <strong className="text-white">data loss</strong>.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">Application-Level Merge</h3>
          <p className="text-gray-300 text-sm">
            Return all conflicting versions to the application and let it merge them. For a shopping
            cart, you might take the union of items. For a text document, you might use operational
            transforms or CRDT-based merge. More complex, but preserves all concurrent writes.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-green-400 mb-2">CRDTs (Conflict-free Replicated Data Types)</h3>
          <p className="text-gray-300 text-sm">
            Data structures mathematically designed so that concurrent updates always converge to the
            same result without coordination. Examples: G-Counter (grow-only counter), OR-Set
            (observed-remove set), LWW-Register. Used in systems like Riak, Redis CRDB, and Automerge
            for collaborative editing.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Replication Lag Simulation                    */
/* ================================================================== */
function PythonReplicationLagSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Simulating Replication Lag</h2>
      <p className="text-gray-300 leading-relaxed">
        This simulation models a single-leader setup where a client writes to the leader, then reads
        from a follower at various delays. Observe how the read result depends on the replication lag
        and the timing of the read.
      </p>
      <PythonCell
        defaultCode={`import random

class ReplicatedDatabase:
    """Simulates a single-leader database with async replication."""

    def __init__(self, num_followers=3, lag_range=(50, 500)):
        self.leader_data = {}
        self.leader_log = []  # (timestamp, key, value)
        self.followers = [
            {"data": {}, "applied_up_to": 0, "lag_ms": random.randint(*lag_range)}
            for _ in range(num_followers)
        ]
        self.clock = 0  # simulated time in ms

    def write(self, key, value):
        """Write to leader (always succeeds immediately)."""
        self.clock += 10  # write takes 10ms
        self.leader_data[key] = value
        self.leader_log.append((self.clock, key, value))
        return self.clock

    def advance_time(self, ms):
        """Advance the clock and replicate to followers."""
        self.clock += ms
        for follower in self.followers:
            # Apply all log entries that have had enough time to replicate
            for ts, key, value in self.leader_log:
                if ts + follower["lag_ms"] <= self.clock and ts > follower["applied_up_to"]:
                    follower["data"][key] = value
                    follower["applied_up_to"] = ts

    def read_leader(self, key):
        return self.leader_data.get(key, None)

    def read_follower(self, follower_idx, key):
        return self.followers[follower_idx]["data"].get(key, None)

# --- Simulation ---
random.seed(42)
db = ReplicatedDatabase(num_followers=3, lag_range=(100, 400))

print("Follower lag configuration:")
for i, f in enumerate(db.followers):
    print(f"  Follower {i}: {f['lag_ms']}ms lag")

# Write some data
write_time = db.write("user:1", "Alice")
print(f"\\nWrote user:1 = 'Alice' at t={write_time}ms")

# Immediately read from all nodes
print(f"\\n--- Reading immediately (t={db.clock}ms) ---")
print(f"  Leader:     user:1 = {db.read_leader('user:1')}")
for i in range(3):
    val = db.read_follower(i, "user:1")
    status = "FRESH" if val == "Alice" else "STALE (None)"
    print(f"  Follower {i}: user:1 = {val}  [{status}]")

# Wait some time
db.advance_time(200)
print(f"\\n--- After 200ms (t={db.clock}ms) ---")
for i in range(3):
    val = db.read_follower(i, "user:1")
    lag = db.followers[i]["lag_ms"]
    status = "FRESH" if val == "Alice" else f"STALE (lag={lag}ms, need {lag - 200}ms more)"
    print(f"  Follower {i}: user:1 = {val}  [{status}]")

# Wait more
db.advance_time(300)
print(f"\\n--- After 500ms total (t={db.clock}ms) ---")
for i in range(3):
    val = db.read_follower(i, "user:1")
    print(f"  Follower {i}: user:1 = {val}  [{'FRESH' if val == 'Alice' else 'STALE'}]")

# Demonstrate read-after-write inconsistency
print("\\n" + "=" * 50)
print("READ-AFTER-WRITE INCONSISTENCY DEMO")
print("=" * 50)
db2 = ReplicatedDatabase(num_followers=3, lag_range=(200, 200))
db2.write("profile", "{'name': 'Bob', 'bio': 'Updated!'}")
db2.advance_time(50)  # only 50ms passed

leader_val = db2.read_leader("profile")
follower_val = db2.read_follower(0, "profile")
print(f"\\nUser updates profile, then refreshes page...")
print(f"  If routed to leader:   sees '{leader_val[:30]}...'")
print(f"  If routed to follower: sees '{follower_val}'")
print(f"  User thinks: 'My update disappeared!'")
print(f"\\nFix: read-after-write consistency = always read your own")
print(f"writes from the leader (or a follower known to be up-to-date).")`}
        title="Replication Lag Simulation"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Quorum Read/Write                             */
/* ================================================================== */
function PythonQuorumSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Quorum Read/Write Simulation</h2>
      <p className="text-gray-300 leading-relaxed">
        This cell implements a Dynamo-style quorum system. You can experiment with different N, W, R
        values and see when reads return stale data. The quorum condition <code className="text-emerald-400">W + R &gt; N</code>
        ensures at least one node in every read set has the latest write.
      </p>
      <PythonCell
        defaultCode={`import random

class DynamoNode:
    def __init__(self, node_id):
        self.id = node_id
        self.data = {}  # key -> (value, version)
        self.alive = True

    def write(self, key, value, version):
        if not self.alive:
            return False
        self.data[key] = (value, version)
        return True

    def read(self, key):
        if not self.alive:
            return None
        return self.data.get(key, None)

class DynamoCluster:
    def __init__(self, n):
        self.N = n
        self.nodes = [DynamoNode(i) for i in range(n)]
        self.version = 0

    def quorum_write(self, key, value, W):
        """Write to W random available nodes."""
        self.version += 1
        available = [n for n in self.nodes if n.alive]
        if len(available) < W:
            return False, f"Only {len(available)} nodes available, need W={W}"

        targets = random.sample(available, W)
        successes = 0
        for node in targets:
            if node.write(key, value, self.version):
                successes += 1

        return successes >= W, f"Wrote to nodes {[n.id for n in targets]}, version={self.version}"

    def quorum_read(self, key, R):
        """Read from R random available nodes, return highest version."""
        available = [n for n in self.nodes if n.alive]
        if len(available) < R:
            return None, f"Only {len(available)} nodes available, need R={R}"

        targets = random.sample(available, R)
        results = []
        for node in targets:
            val = node.read(key)
            if val is not None:
                results.append((val[0], val[1], node.id))

        if not results:
            return None, f"No data found on nodes {[n.id for n in targets]}"

        # Return the value with highest version
        best = max(results, key=lambda x: x[1])
        return best[0], f"Read from nodes {[n.id for n in targets]}, " \\
                         f"versions={[(r[2], r[1]) for r in results]}, " \\
                         f"returning v{best[1]}: '{best[0]}'"

# --- Experiment 1: Quorum condition met (W+R > N) ---
random.seed(42)
print("=" * 60)
print("EXPERIMENT 1: N=5, W=3, R=3 (W+R=6 > N=5)")
print("=" * 60)

cluster = DynamoCluster(5)
ok, msg = cluster.quorum_write("user:1", "Alice", W=3)
print(f"Write: {msg}")

# Try multiple reads — should always get latest
print("\\n10 reads (should all return 'Alice'):")
stale_count = 0
for i in range(10):
    val, msg = cluster.quorum_read("user:1", R=3)
    is_fresh = val == "Alice"
    if not is_fresh:
        stale_count += 1
    print(f"  Read {i+1}: {val} {'FRESH' if is_fresh else 'STALE!'} — {msg}")
print(f"Stale reads: {stale_count}/10")

# --- Experiment 2: Quorum condition NOT met (W+R <= N) ---
print("\\n" + "=" * 60)
print("EXPERIMENT 2: N=5, W=2, R=2 (W+R=4 <= N=5)")
print("=" * 60)

cluster2 = DynamoCluster(5)
ok, msg = cluster2.quorum_write("user:1", "Bob_v1", W=2)
print(f"Write v1: {msg}")
ok, msg = cluster2.quorum_write("user:1", "Bob_v2", W=2)
print(f"Write v2: {msg}")

print("\\n10 reads (may return stale data!):")
stale_count = 0
for i in range(10):
    val, msg = cluster2.quorum_read("user:1", R=2)
    is_latest = val == "Bob_v2"
    if not is_latest:
        stale_count += 1
    print(f"  Read {i+1}: {val} {'FRESH' if is_latest else 'STALE!'}")
print(f"Stale reads: {stale_count}/10")

# --- Experiment 3: Node failure with quorum ---
print("\\n" + "=" * 60)
print("EXPERIMENT 3: Tolerating failures (N=5, W=3, R=3)")
print("=" * 60)

cluster3 = DynamoCluster(5)
cluster3.quorum_write("key", "value_latest", W=3)

# Kill 2 nodes
cluster3.nodes[0].alive = False
cluster3.nodes[1].alive = False
print("Killed nodes 0 and 1. 3 nodes remaining.")

val, msg = cluster3.quorum_read("key", R=3)
print(f"Read with R=3: {val} — {msg}")

# Kill one more — quorum impossible
cluster3.nodes[2].alive = False
print("\\nKilled node 2. Only 2 nodes remaining.")
val, msg = cluster3.quorum_read("key", R=3)
print(f"Read with R=3: {val} — {msg}")
print("System is unavailable — cannot form a read quorum!")`}
        title="Quorum Read/Write Simulation"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Replication() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Replication</h1>
        <p className="text-lg text-gray-400">
          How data is copied across multiple machines for fault tolerance, read scalability, and low
          latency -- and the consistency trade-offs that arise from asynchronous replication.
        </p>
      </header>

      <WhyReplicateSection />
      <SingleLeaderSection />
      <ReplicationLagSection />
      <MultiLeaderSection />
      <LeaderlessQuorumSection />
      <ConflictResolutionSection />
      <PythonReplicationLagSection />
      <PythonQuorumSection />
    </div>
  )
}
