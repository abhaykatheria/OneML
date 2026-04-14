import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/partitioning',
  title: 'Partitioning (Sharding)',
  description: 'How to split large datasets across multiple nodes so that queries and load are distributed evenly, and the trade-offs between range and hash partitioning',
  track: 'systems',
  order: 6,
  tags: ['partitioning', 'sharding', 'consistent-hashing', 'hash-ring', 'rebalancing', 'secondary-indexes'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function simpleHash(key: string, mod: number): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) & 0x7fffffff
  }
  return h % mod
}

function hashToAngle(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) & 0x7fffffff
  }
  return (h % 3600) / 3600 * Math.PI * 2
}

const PARTITION_COLORS: [number, number, number][] = [
  [99, 102, 241],   // indigo
  [239, 68, 68],    // red
  [52, 211, 153],   // emerald
  [251, 191, 36],   // amber
  [168, 85, 247],   // purple
  [236, 72, 153],   // pink
  [20, 184, 166],   // teal
  [249, 115, 22],   // orange
]

const SAMPLE_KEYS = [
  'alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'heidi',
  'ivan', 'judy', 'karl', 'laura', 'mike', 'nancy', 'oscar', 'pat',
  'quinn', 'ruth', 'steve', 'tina', 'ursula', 'victor', 'wendy', 'xena',
]

/* ================================================================== */
/*  Section 1 -- Why Partition?                                        */
/* ================================================================== */
function WhyPartitionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Partition?</h2>
      <p className="text-gray-300 leading-relaxed">
        Replication gives you copies of the same data on multiple nodes. But what happens when your
        dataset is too large to fit on a single machine, or your write throughput exceeds what one
        node can handle? You need to <strong className="text-white">partition</strong> (also called
        <strong className="text-white"> sharding</strong>) -- split the data into smaller pieces and
        distribute them across multiple nodes.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Each piece of data belongs to exactly one partition. Each partition is a mini-database in its
        own right. The goal of partitioning is to spread data and query load evenly across nodes. If
        the partitioning is uneven, some partitions will have more data or receive more queries than
        others -- a situation called <strong className="text-white">skew</strong>. A partition with
        disproportionately high load is called a <strong className="text-white">hot spot</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The two fundamental approaches to partitioning are <strong className="text-white">key range</strong>
        (split on sorted key ranges) and <strong className="text-white">hash</strong> (split on the hash
        of the key). Each has distinct trade-offs for query patterns, load distribution, and range scans.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Key Range Partitioning (p5)                           */
/* ================================================================== */
function KeyRangeSection() {
  const [hotSpotMode, setHotSpotMode] = useState(false)
  const stateRef = useRef({ hotSpot: false, animT: 0 })

  const sketch = useCallback((p: p5) => {
    let t = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      const hotSpot = stateRef.current.hotSpot
      p.background(15, 15, 25)

      const leftX = 60
      const rightX = p.width - 40
      const barY = 80
      const barH = 50

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Key Range Partitioning', 20, 10)

      // Key space bar A-Z
      p.fill(30, 35, 50)
      p.stroke(80)
      p.strokeWeight(1)
      p.rect(leftX, barY, rightX - leftX, barH, 4)

      // Partition boundaries
      const partitions = [
        { label: 'P0', from: 'A', to: 'F', color: PARTITION_COLORS[0] },
        { label: 'P1', from: 'G', to: 'L', color: PARTITION_COLORS[1] },
        { label: 'P2', from: 'M', to: 'R', color: PARTITION_COLORS[2] },
        { label: 'P3', from: 'S', to: 'Z', color: PARTITION_COLORS[3] },
      ]

      const totalRange = 26
      for (let i = 0; i < partitions.length; i++) {
        const part = partitions[i]
        const fromIdx = part.from.charCodeAt(0) - 65
        const toIdx = part.to.charCodeAt(0) - 65 + 1
        const x1 = p.map(fromIdx, 0, totalRange, leftX, rightX)
        const x2 = p.map(toIdx, 0, totalRange, leftX, rightX)

        p.fill(part.color[0] * 0.2, part.color[1] * 0.2, part.color[2] * 0.2)
        p.stroke(part.color[0], part.color[1], part.color[2])
        p.strokeWeight(1)
        p.rect(x1, barY, x2 - x1, barH)

        // Label
        p.fill(part.color[0], part.color[1], part.color[2])
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${part.label} [${part.from}-${part.to}]`, (x1 + x2) / 2, barY + barH / 2)
      }

      // Letter markers
      p.fill(140)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      for (let i = 0; i < 26; i++) {
        const x = p.map(i + 0.5, 0, totalRange, leftX, rightX)
        p.text(String.fromCharCode(65 + i), x, barY + barH + 6)
      }

      // Animate data routing
      const keysToRoute = hotSpot
        ? ['alice', 'adam', 'amy', 'anna', 'alex', 'alan', 'beth', 'abby', 'ava', 'aria']
        : SAMPLE_KEYS.slice(0, 12)

      const routeY = barY + barH + 40
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(hotSpot ? 'Hot Spot! Most keys start with A-F' : 'Keys routed to partitions:', 20, routeY - 4)

      for (let i = 0; i < keysToRoute.length; i++) {
        const key = keysToRoute[i]
        const firstChar = key.charAt(0).toUpperCase().charCodeAt(0) - 65
        const partIdx = firstChar < 6 ? 0 : firstChar < 12 ? 1 : firstChar < 18 ? 2 : 3
        const part = partitions[partIdx]

        // fromIdx, toIdx, targetX computed but unused

        const row = Math.floor(i / 4)
        const col = i % 4
        const keyX = 30 + col * 170
        const keyY = routeY + 18 + row * 50

        // Key box
        p.fill(40, 45, 60)
        p.stroke(part.color[0], part.color[1], part.color[2], 150)
        p.strokeWeight(1)
        p.rect(keyX, keyY, 80, 22, 4)

        p.fill(200)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`"${key}"`, keyX + 40, keyY + 11)

        // Arrow to partition
        p.fill(part.color[0], part.color[1], part.color[2], 120)
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`-> ${part.label}`, keyX + 84, keyY + 11)
      }

      // Hot spot indicator
      if (hotSpot) {
        const p0x1 = p.map(0, 0, totalRange, leftX, rightX)
        const p0x2 = p.map(6, 0, totalRange, leftX, rightX)
        const pulseAlpha = Math.sin(t * 5) * 60 + 60
        p.fill(255, 60, 60, pulseAlpha)
        p.noStroke()
        p.rect(p0x1, barY, p0x2 - p0x1, barH)

        p.fill(255, 80, 80)
        p.textSize(12)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('HOT SPOT!', (p0x1 + p0x2) / 2, barY - 4)

        p.fill(200)
        p.textSize(10)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text('Problem: if many keys share a prefix (e.g. names starting with A), one partition gets overwhelmed.', 20, p.height - 8)
      } else {
        p.fill(120)
        p.textSize(9)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text('Key range partitioning preserves sort order — great for range queries (e.g. "all users A-D").', 20, p.height - 8)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Partitioning by Key Range</h2>
      <p className="text-gray-300 leading-relaxed">
        The simplest approach: sort all keys, then divide the key space into contiguous ranges. Each
        partition owns a range (e.g., A-F, G-L, etc.). To find which partition holds a key, check
        which range it falls into. This is how HBase, BigTable, and traditional B-tree indexes work.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The advantage: range queries are efficient. To find all users with names starting with "A"
        through "D", you query a single partition. The disadvantage: if keys are not uniformly distributed,
        some partitions get far more traffic. Toggle "Show Hot Spot" to see how a skewed key distribution
        overloads one partition.
      </p>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <ControlPanel title="Hot Spot Demo">
            <button
              onClick={() => {
                const next = !hotSpotMode
                setHotSpotMode(next)
                stateRef.current.hotSpot = next
              }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                hotSpotMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {hotSpotMode ? 'Show Normal Distribution' : 'Show Hot Spot'}
            </button>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Hash Partitioning (p5)                                */
/* ================================================================== */
function HashPartitionSection() {
  const [numPartitions, setNumPartitions] = useState(4)
  const stateRef = useRef({ numParts: 4 })
  stateRef.current.numParts = numPartitions

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const nParts = stateRef.current.numParts
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Hash Partitioning: Uniform Distribution', 20, 10)

      // Show hash computation for sample keys
      const keys = SAMPLE_KEYS.slice(0, 16)
      const buckets: string[][] = Array.from({ length: nParts }, () => [])

      for (const key of keys) {
        const bucket = simpleHash(key, nParts)
        buckets[bucket].push(key)
      }

      // Draw partition buckets
      const bucketWidth = (p.width - 80) / nParts
      const bucketY = 60
      const bucketH = 200

      for (let i = 0; i < nParts; i++) {
        const bx = 40 + i * bucketWidth
        const color = PARTITION_COLORS[i % PARTITION_COLORS.length]

        // Bucket container
        p.fill(color[0] * 0.15, color[1] * 0.15, color[2] * 0.15)
        p.stroke(color[0], color[1], color[2], 150)
        p.strokeWeight(1)
        p.rect(bx + 4, bucketY, bucketWidth - 8, bucketH, 6)

        // Bucket label
        p.fill(color[0], color[1], color[2])
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Partition ${i}`, bx + bucketWidth / 2, bucketY + 6)
        p.textSize(9)
        p.fill(140)
        p.text(`(${buckets[i].length} keys)`, bx + bucketWidth / 2, bucketY + 20)

        // Keys in bucket
        for (let j = 0; j < buckets[i].length; j++) {
          const ky = bucketY + 38 + j * 20
          if (ky + 18 > bucketY + bucketH) break

          p.fill(50, 55, 70)
          p.stroke(color[0], color[1], color[2], 80)
          p.strokeWeight(1)
          p.rect(bx + 10, ky, bucketWidth - 20, 16, 3)

          p.fill(200)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(buckets[i][j], bx + bucketWidth / 2, ky + 8)
        }
      }

      // Distribution bar chart
      const chartY = bucketY + bucketH + 20
      const maxCount = Math.max(...buckets.map(b => b.length), 1)
      const barMaxH = 60

      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Distribution:', 20, chartY)

      for (let i = 0; i < nParts; i++) {
        const bx = 40 + i * bucketWidth + bucketWidth / 2 - 15
        const barH = (buckets[i].length / maxCount) * barMaxH
        const color = PARTITION_COLORS[i % PARTITION_COLORS.length]

        p.fill(color[0], color[1], color[2], 180)
        p.noStroke()
        p.rect(bx, chartY + 20 + barMaxH - barH, 30, barH, 3)

        p.fill(200)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${buckets[i].length}`, bx + 15, chartY + 22 + barMaxH)
      }

      // Uniformity score
      const avg = keys.length / nParts
      const variance = buckets.reduce((sum, b) => sum + (b.length - avg) ** 2, 0) / nParts
      const stddev = Math.sqrt(variance)
      const uniformity = Math.max(0, 100 - (stddev / avg * 100))

      p.fill(uniformity > 70 ? p.color(80, 200, 120) : p.color(255, 160, 60))
      p.textSize(10)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text(`Uniformity: ${uniformity.toFixed(0)}% (std/mean = ${(stddev / avg).toFixed(2)})`, p.width - 20, p.height - 8)

      p.fill(120)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('hash(key) % N -> partition. Destroys sort order but distributes evenly.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Partitioning by Hash</h2>
      <p className="text-gray-300 leading-relaxed">
        To avoid hot spots, many systems hash the key before partitioning. A good hash function
        distributes keys uniformly regardless of their original distribution. The partition for a key
        is <code className="text-emerald-400">hash(key) % N</code> where N is the number of partitions.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The trade-off: you lose the ability to do efficient range queries. With key-range partitioning,
        "find all users A-D" hits one partition. With hash partitioning, those keys are scattered across
        all partitions, so you must query every partition (a <strong className="text-white">scatter/gather</strong>
        query). Adjust the number of partitions below to see how distribution changes.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Partitions">
            <InteractiveSlider
              label="Number of Partitions"
              min={2}
              max={8}
              step={1}
              value={numPartitions}
              onChange={(v) => { setNumPartitions(v); stateRef.current.numParts = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Consistent Hashing Ring (p5, interactive)             */
/* ================================================================== */
function ConsistentHashingSection() {
  const [nodeCount, setNodeCount] = useState(3)
  const [virtualNodes, setVirtualNodes] = useState(1)
  const stateRef = useRef({ nodeCount: 3, virtualNodes: 1, clickedNode: -1 })

  const sketch = useCallback((p: p5) => {
    let t = 0

    interface RingNode {
      angle: number
      nodeId: number
      virtualIdx: number
      color: [number, number, number]
    }

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.01
      const { nodeCount: nc, virtualNodes: vn } = stateRef.current
      p.background(15, 15, 25)

      const centerX = p.width / 2
      const centerY = 210
      const radius = 150

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Consistent Hashing Ring', 20, 10)

      // Draw ring
      p.noFill()
      p.stroke(60, 65, 80)
      p.strokeWeight(2)
      p.ellipse(centerX, centerY, radius * 2, radius * 2)

      // Generate ring nodes (real + virtual)
      const ringNodes: RingNode[] = []
      for (let n = 0; n < nc; n++) {
        for (let v = 0; v < vn; v++) {
          const key = `node${n}-v${v}`
          const angle = hashToAngle(key)
          ringNodes.push({
            angle,
            nodeId: n,
            virtualIdx: v,
            color: PARTITION_COLORS[n % PARTITION_COLORS.length],
          })
        }
      }
      ringNodes.sort((a, b) => a.angle - b.angle)

      // Draw arcs showing ownership
      for (let i = 0; i < ringNodes.length; i++) {
        const node = ringNodes[i]
        const prevAngle = i === 0 ? ringNodes[ringNodes.length - 1].angle - Math.PI * 2 : ringNodes[i - 1].angle
        const startAngle = prevAngle
        const endAngle = node.angle

        p.noFill()
        p.stroke(node.color[0], node.color[1], node.color[2], 60)
        p.strokeWeight(6)
        p.arc(centerX, centerY, radius * 2, radius * 2, startAngle, endAngle)
      }

      // Draw data keys on the ring
      const dataKeys = SAMPLE_KEYS.slice(0, 8)
      for (const key of dataKeys) {
        const angle = hashToAngle(key)
        const kx = centerX + Math.cos(angle) * (radius + 20)
        const ky = centerY + Math.sin(angle) * (radius + 20)

        // Find owning node (first node clockwise)
        let owner = ringNodes[0]
        for (const rn of ringNodes) {
          if (rn.angle >= angle) { owner = rn; break }
        }

        p.fill(owner.color[0], owner.color[1], owner.color[2], 150)
        p.noStroke()
        p.ellipse(kx, ky, 8, 8)

        p.fill(160)
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        const labelR = radius + 34
        p.text(key, centerX + Math.cos(angle) * labelR, centerY + Math.sin(angle) * labelR)
      }

      // Draw ring nodes
      for (const node of ringNodes) {
        const nx = centerX + Math.cos(node.angle) * radius
        const ny = centerY + Math.sin(node.angle) * radius

        p.fill(node.color[0] * 0.4, node.color[1] * 0.4, node.color[2] * 0.4)
        p.stroke(node.color[0], node.color[1], node.color[2])
        p.strokeWeight(2)
        const nodeSize = node.virtualIdx === 0 ? 20 : 14
        p.ellipse(nx, ny, nodeSize, nodeSize)

        if (node.virtualIdx === 0) {
          p.fill(255)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`N${node.nodeId}`, nx, ny)
        } else {
          p.fill(node.color[0], node.color[1], node.color[2], 180)
          p.noStroke()
          p.textSize(6)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`v${node.virtualIdx}`, nx, ny)
        }
      }

      // Node distribution stats
      const keyCounts: Record<number, number> = {}
      for (let n = 0; n < nc; n++) keyCounts[n] = 0

      for (const key of dataKeys) {
        const angle = hashToAngle(key)
        let owner = ringNodes[0]
        for (const rn of ringNodes) {
          if (rn.angle >= angle) { owner = rn; break }
        }
        keyCounts[owner.nodeId]++
      }

      const statsY = 400
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Key ownership:', 20, statsY)

      for (let n = 0; n < nc; n++) {
        const color = PARTITION_COLORS[n % PARTITION_COLORS.length]
        p.fill(color[0], color[1], color[2])
        p.textSize(9)
        p.text(`Node ${n}: ${keyCounts[n]} keys${vn > 1 ? ` (${vn} vnodes)` : ''}`, 140 + n * 160, statsY)
      }

      // Info
      p.fill(120)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Each key is assigned to the first node clockwise on the ring. Virtual nodes improve balance.', 20, p.height - 4)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Consistent Hashing</h2>
      <p className="text-gray-300 leading-relaxed">
        Standard hash partitioning (<code className="text-emerald-400">hash(key) % N</code>) has a
        fatal flaw: when you add or remove a node, N changes, and almost every key remaps to a
        different partition. This causes a massive data migration storm.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Consistent hashing</strong> fixes this. Imagine a circular hash
        space (a "ring"). Both nodes and keys are hashed onto positions on this ring. Each key is
        assigned to the first node encountered clockwise from its position. When a node is added or
        removed, only the keys in the affected arc of the ring need to move -- all other keys stay put.
      </p>
      <p className="text-gray-300 leading-relaxed">
        With few physical nodes, the distribution can be uneven. <strong className="text-white">Virtual
        nodes</strong> (vnodes) solve this: each physical node places multiple tokens on the ring,
        creating many small arcs instead of a few large ones. Increase the virtual nodes slider to see
        improved distribution.
      </p>
      <P5Sketch
        sketch={sketch}
        height={440}
        controls={
          <ControlPanel title="Ring Configuration">
            <InteractiveSlider
              label="Physical Nodes"
              min={2}
              max={6}
              step={1}
              value={nodeCount}
              onChange={(v) => { setNodeCount(v); stateRef.current.nodeCount = v }}
            />
            <InteractiveSlider
              label="Virtual Nodes per Physical"
              min={1}
              max={8}
              step={1}
              value={virtualNodes}
              onChange={(v) => { setVirtualNodes(v); stateRef.current.virtualNodes = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Secondary Indexes                                     */
/* ================================================================== */
function SecondaryIndexSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Secondary Indexes with Partitioning</h2>
      <p className="text-gray-300 leading-relaxed">
        So far we have partitioned by primary key. But what if you need to search by a secondary
        attribute -- e.g., find all users in a given city? Two approaches:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-5 border border-blue-800">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">Document-Partitioned (Local) Index</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Each partition maintains its own secondary index, covering only the documents in that partition.
            A write only updates a single partition's index. But a query by secondary key must be sent to
            <strong className="text-white"> all partitions</strong> and the results merged -- this is
            called <strong className="text-white">scatter/gather</strong>. It is expensive and adds
            tail latency (the slowest partition determines overall latency).
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Used by: MongoDB, Riak, Cassandra, Elasticsearch, VoltDB
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 border border-green-800">
          <h3 className="text-sm font-semibold text-green-400 mb-2">Term-Partitioned (Global) Index</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            A global index covers all data, but the index itself is partitioned by term. For example,
            cities A-M on one index partition, N-Z on another. A secondary-key query hits only the
            relevant index partition(s) -- much faster reads. But a write may now need to update
            <strong className="text-white"> multiple index partitions</strong> (the data partition and
            the relevant index partitions), often done asynchronously.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Used by: Amazon DynamoDB (global secondary indexes), Oracle
          </p>
        </div>
      </div>
      <p className="text-gray-300 leading-relaxed text-sm">
        The fundamental trade-off: local indexes make writes fast but reads slow (scatter/gather).
        Global indexes make reads fast but writes slow (multi-partition coordination). Most systems
        default to local indexes and accept the scatter/gather cost, because write performance is
        usually the bottleneck.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Rebalancing Strategies                                */
/* ================================================================== */
function RebalancingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Rebalancing Strategies</h2>
      <p className="text-gray-300 leading-relaxed">
        As data grows or nodes are added/removed, the system must rebalance -- move data between
        partitions to keep load even. This must happen without dropping availability.
      </p>
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Fixed Number of Partitions</h3>
          <p className="text-gray-300 text-sm">
            Create many more partitions than nodes at the start (e.g., 1000 partitions for 10 nodes = 100
            partitions per node). When adding a node, steal some partitions from each existing node.
            Partition boundaries never change -- only the assignment of partitions to nodes. This is the
            approach used by Riak, Elasticsearch, and Couchbase.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Caveat: choosing the right number of partitions upfront is tricky. Too many = overhead per
            partition. Too few = can't rebalance effectively when data grows.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">Dynamic Partitioning</h3>
          <p className="text-gray-300 text-sm">
            When a partition exceeds a configured size, split it into two. When a partition shrinks below
            a threshold, merge it with an adjacent partition. The number of partitions adapts to the data
            volume. Used by HBase and RethinkDB.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-semibold text-green-400 mb-2">Proportional to Nodes</h3>
          <p className="text-gray-300 text-sm">
            Keep a fixed number of partitions per node (e.g., 256 per node). When a new node joins,
            it randomly splits existing partitions and takes half of each. The total partition count
            grows with the cluster. Used by Cassandra and Ketama.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Request Routing                                       */
/* ================================================================== */
function RequestRoutingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Request Routing</h2>
      <p className="text-gray-300 leading-relaxed">
        When a client wants to read or write a key, how does it know which node (partition) to contact?
        Three main approaches:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-3 ml-4">
        <li>
          <strong className="text-white">Contact any node.</strong> If the node owns the partition, it
          handles the request. Otherwise, it forwards to the correct node. This requires all nodes to
          know the full partition map. Used by Cassandra and Riak (gossip protocol).
        </li>
        <li>
          <strong className="text-white">Route through a partition-aware load balancer.</strong> A
          routing tier sits between clients and nodes, directing each request to the right partition.
          The routing tier must stay up-to-date with partition assignments.
        </li>
        <li>
          <strong className="text-white">Client knows the partition map.</strong> The client itself
          maintains a copy of the partition assignment and contacts the correct node directly.
          Requires a mechanism for clients to discover changes (e.g., ZooKeeper watches).
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Many systems use a coordination service like <strong className="text-white">ZooKeeper</strong>
        to maintain the authoritative partition-to-node mapping. Nodes register themselves in ZooKeeper,
        and routing tiers (or clients) subscribe to changes. When a partition is reassigned, ZooKeeper
        notifies all subscribers. This is used by HBase, SolrCloud, Kafka, and (internally) MongoDB.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Consistent Hashing                            */
/* ================================================================== */
function PythonConsistentHashingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Consistent Hashing with Virtual Nodes</h2>
      <p className="text-gray-300 leading-relaxed">
        Implement a consistent hash ring from scratch. Observe how adding or removing a node causes
        minimal key reassignment, and how virtual nodes dramatically improve distribution uniformity.
      </p>
      <PythonCell
        defaultCode={`import hashlib
from collections import Counter

class ConsistentHashRing:
    def __init__(self, num_virtual_nodes=1):
        self.num_vnodes = num_virtual_nodes
        self.ring = {}  # hash_position -> node_name
        self.sorted_keys = []
        self.nodes = set()

    def _hash(self, key):
        """Hash a key to a position on the ring [0, 2^32)."""
        return int(hashlib.md5(key.encode()).hexdigest(), 16) % (2**32)

    def add_node(self, node):
        self.nodes.add(node)
        for i in range(self.num_vnodes):
            vnode_key = f"{node}:vnode{i}"
            h = self._hash(vnode_key)
            self.ring[h] = node
            self.sorted_keys.append(h)
        self.sorted_keys.sort()

    def remove_node(self, node):
        self.nodes.discard(node)
        for i in range(self.num_vnodes):
            vnode_key = f"{node}:vnode{i}"
            h = self._hash(vnode_key)
            if h in self.ring:
                del self.ring[h]
                self.sorted_keys.remove(h)

    def get_node(self, key):
        if not self.ring:
            return None
        h = self._hash(key)
        # Find the first ring position >= h (clockwise)
        for pos in self.sorted_keys:
            if pos >= h:
                return self.ring[pos]
        return self.ring[self.sorted_keys[0]]  # Wrap around

    def get_distribution(self, keys):
        counts = Counter()
        for key in keys:
            node = self.get_node(key)
            counts[node] += 1
        return counts

# Generate test keys
keys = [f"user:{i}" for i in range(10000)]

# --- Test 1: Without virtual nodes ---
print("=" * 55)
print("TEST 1: 3 nodes, NO virtual nodes (1 vnode each)")
print("=" * 55)
ring1 = ConsistentHashRing(num_virtual_nodes=1)
for node in ["node-A", "node-B", "node-C"]:
    ring1.add_node(node)

dist1 = ring1.get_distribution(keys)
print("Key distribution:")
for node, count in sorted(dist1.items()):
    bar = "#" * (count // 100)
    print(f"  {node}: {count:5d} ({count/100:.1f}%) {bar}")

std1 = (sum((c - 10000/3)**2 for c in dist1.values()) / 3) ** 0.5
print(f"Standard deviation: {std1:.0f}")

# --- Test 2: With virtual nodes ---
print()
print("=" * 55)
print("TEST 2: 3 nodes, 150 virtual nodes each")
print("=" * 55)
ring2 = ConsistentHashRing(num_virtual_nodes=150)
for node in ["node-A", "node-B", "node-C"]:
    ring2.add_node(node)

dist2 = ring2.get_distribution(keys)
print("Key distribution:")
for node, count in sorted(dist2.items()):
    bar = "#" * (count // 100)
    print(f"  {node}: {count:5d} ({count/100:.1f}%) {bar}")

std2 = (sum((c - 10000/3)**2 for c in dist2.values()) / 3) ** 0.5
print(f"Standard deviation: {std2:.0f}")
print(f"\\nVnodes reduced std by {(1 - std2/std1)*100:.1f}%")

# --- Test 3: Minimal disruption when adding a node ---
print()
print("=" * 55)
print("TEST 3: Adding a node — key reassignment")
print("=" * 55)
before = {key: ring2.get_node(key) for key in keys}
ring2.add_node("node-D")
after = {key: ring2.get_node(key) for key in keys}

moved = sum(1 for k in keys if before[k] != after[k])
print(f"Keys moved: {moved} / {len(keys)} ({moved/len(keys)*100:.1f}%)")
print(f"Ideal (1/N_new): {100/4:.1f}%")
print(f"With naive hash%N, ~75% of keys would move!")

new_dist = ring2.get_distribution(keys)
print("\\nNew distribution after adding node-D:")
for node, count in sorted(new_dist.items()):
    print(f"  {node}: {count:5d} ({count/100:.1f}%)")`}
        title="Consistent Hashing with Virtual Nodes"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Python: Partitioning Strategy Comparison              */
/* ================================================================== */
function PythonPartitionComparisonSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Key-Range vs Hash Partitioning</h2>
      <p className="text-gray-300 leading-relaxed">
        Compare how key-range and hash partitioning handle different data distributions. We generate
        realistic datasets and measure how evenly each strategy distributes the load.
      </p>
      <PythonCell
        defaultCode={`import hashlib
from collections import Counter
import random

random.seed(42)

def hash_partition(key, num_partitions):
    """Hash-based: hash(key) % N."""
    h = int(hashlib.md5(key.encode()).hexdigest(), 16)
    return h % num_partitions

def range_partition(key, boundaries):
    """Range-based: find which range the key falls into."""
    for i, boundary in enumerate(boundaries):
        if key <= boundary:
            return i
    return len(boundaries)

NUM_PARTITIONS = 4
NUM_KEYS = 10000

# --- Dataset 1: Uniform random keys ---
print("=" * 55)
print("DATASET 1: Uniformly distributed keys")
print("=" * 55)
uniform_keys = [f"key_{random.randint(0, 999999):06d}" for _ in range(NUM_KEYS)]

hash_dist = Counter(hash_partition(k, NUM_PARTITIONS) for k in uniform_keys)
boundaries = ["key_250000", "key_500000", "key_750000"]
range_dist = Counter(range_partition(k, boundaries) for k in uniform_keys)

print("\\nHash partitioning:")
for p in range(NUM_PARTITIONS):
    count = hash_dist[p]
    pct = count / NUM_KEYS * 100
    bar = "#" * int(pct / 2)
    print(f"  P{p}: {count:5d} ({pct:5.1f}%) {bar}")

print("\\nRange partitioning:")
for p in range(NUM_PARTITIONS):
    count = range_dist.get(p, 0)
    pct = count / NUM_KEYS * 100
    bar = "#" * int(pct / 2)
    print(f"  P{p}: {count:5d} ({pct:5.1f}%) {bar}")

# --- Dataset 2: Skewed keys (hot prefix) ---
print("\\n" + "=" * 55)
print("DATASET 2: Skewed keys (70% start with 'user_00')")
print("=" * 55)
skewed_keys = []
for _ in range(NUM_KEYS):
    if random.random() < 0.7:
        skewed_keys.append(f"user_00{random.randint(0, 9999):04d}")
    else:
        skewed_keys.append(f"user_{random.randint(10, 99)}{random.randint(0, 9999):04d}")

hash_dist2 = Counter(hash_partition(k, NUM_PARTITIONS) for k in skewed_keys)
boundaries2 = ["user_25", "user_50", "user_75"]
range_dist2 = Counter(range_partition(k, boundaries2) for k in skewed_keys)

print("\\nHash partitioning (handles skew well):")
for p in range(NUM_PARTITIONS):
    count = hash_dist2[p]
    pct = count / NUM_KEYS * 100
    bar = "#" * int(pct / 2)
    print(f"  P{p}: {count:5d} ({pct:5.1f}%) {bar}")

print("\\nRange partitioning (creates hot spot!):")
for p in range(NUM_PARTITIONS):
    count = range_dist2.get(p, 0)
    pct = count / NUM_KEYS * 100
    bar = "#" * int(pct / 2)
    hot = " <-- HOT SPOT!" if pct > 40 else ""
    print(f"  P{p}: {count:5d} ({pct:5.1f}%) {bar}{hot}")

# --- Summary statistics ---
print("\\n" + "=" * 55)
print("SUMMARY: Distribution Uniformity")
print("=" * 55)

def std_dev(dist, n_parts, total):
    ideal = total / n_parts
    return (sum((dist.get(p, 0) - ideal)**2 for p in range(n_parts)) / n_parts) ** 0.5

results = [
    ("Uniform + Hash",  std_dev(hash_dist, 4, NUM_KEYS)),
    ("Uniform + Range", std_dev(range_dist, 4, NUM_KEYS)),
    ("Skewed + Hash",   std_dev(hash_dist2, 4, NUM_KEYS)),
    ("Skewed + Range",  std_dev(range_dist2, 4, NUM_KEYS)),
]

print(f"\\n{'Strategy':<20} {'Std Dev':>10} {'Rating':>10}")
print("-" * 42)
for name, sd in results:
    rating = "Excellent" if sd < 100 else "Good" if sd < 500 else "Poor" if sd < 2000 else "Terrible"
    print(f"{name:<20} {sd:>10.1f} {rating:>10}")

print("\\nConclusion: Hash partitioning handles skewed data gracefully.")
print("Range partitioning is best when keys are naturally uniform")
print("and you need efficient range queries.")`}
        title="Partitioning Strategy Comparison"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Partitioning() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Partitioning (Sharding)</h1>
        <p className="text-lg text-gray-400">
          How to split datasets across multiple nodes for horizontal scalability, and the trade-offs
          between key-range partitioning, hash partitioning, and consistent hashing.
        </p>
      </header>

      <WhyPartitionSection />
      <KeyRangeSection />
      <HashPartitionSection />
      <ConsistentHashingSection />
      <SecondaryIndexSection />
      <RebalancingSection />
      <RequestRoutingSection />
      <PythonConsistentHashingSection />
      <PythonPartitionComparisonSection />
    </div>
  )
}
