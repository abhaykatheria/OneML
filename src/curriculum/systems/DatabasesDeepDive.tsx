import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/databases-deep-dive',
  title: 'Databases Deep Dive',
  description:
    'PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ScyllaDB, DynamoDB, RocksDB, ClickHouse, Elasticsearch, CockroachDB — how they work, what they trade, and when to reach for which',
  track: 'systems',
  order: 28,
  tags: [
    'databases',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'cassandra',
    'scylla',
    'dynamodb',
    'rocksdb',
    'clickhouse',
    'elasticsearch',
    'cockroachdb',
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
/*  Section 1 -- Why so many databases?                                */
/* ================================================================== */

function IntroSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. Why So Many Databases Exist</h2>
      <p className="text-gray-300 leading-relaxed">
        Thirty years ago there was one answer — Oracle or DB2. Today's tools landscape has
        hundreds of databases and they are <em>not</em> redundant. Each one picks a different
        point on a multi-dimensional tradeoff space. The skill in production engineering is not
        knowing all of them — it's knowing which axes matter and which database lives closest to
        your workload's point on those axes.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This lesson is a comparative map. We'll go through the core storage engines
        (<strong className="text-white">B-tree vs LSM</strong>), the layout choices
        (<strong className="text-white">row vs column</strong>), and the consistency choices
        (<strong className="text-white">CP vs AP</strong>). Then we'll profile the databases
        that people actually deploy — Postgres, MySQL, MongoDB, Redis, Cassandra, ScyllaDB,
        DynamoDB, RocksDB, ClickHouse, Elasticsearch, CockroachDB — and say exactly what each
        one is good at.
      </p>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The one guarantee:</strong> you will run more than
          one database in production. Transactional user data belongs in one, the firehose of
          events belongs in another, the caches belong somewhere else, the analytics queries
          belong in yet another. This is called <em>polyglot persistence</em> and it is the
          norm, not the exception.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- The tradeoff dimensions                               */
/* ================================================================== */

function DimensionsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">2. The Tradeoff Dimensions</h2>
      <p className="text-gray-300 leading-relaxed">
        Every database choice can be framed as a position on a handful of independent axes. If
        you can place a workload on these axes, you're 80% of the way to knowing the database.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Workload shape: OLTP vs OLAP</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            <strong className="text-white">OLTP</strong> (transactional): many small
            reads/writes, low latency, touch a few rows. <strong className="text-white">OLAP</strong>{' '}
            (analytical): fewer queries, each scans millions of rows, aggregates across
            columns. They want <em>opposite</em> storage layouts.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Storage layout: Row vs Column</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Row-oriented keeps all a record's fields contiguous — great for OLTP.
            Column-oriented keeps one field across many records contiguous — great for
            OLAP scans and compression.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Storage engine: B-tree vs LSM tree</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            B-tree updates in place — fast reads, random-write friendly. LSM appends to memtable,
            flushes to sorted files — crushes write throughput, reads have to check multiple
            levels.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Consistency: CP vs AP</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Under a network partition, you can guarantee{' '}
            <strong className="text-white">C</strong>onsistency (reject writes) or{' '}
            <strong className="text-white">A</strong>vailability (accept writes with possible
            conflicts). CAP makes you pick. PACELC adds the "also latency" dimension for the
            normal case.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Placement: In-memory vs on-disk</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            In-memory (Redis, Memcached): microsecond latency, limited by RAM cost, needs
            persistence discipline. On-disk: gigabyte-to-petabyte range, latency bounded by SSD
            read time. Most real systems cache in-memory <em>in front of</em> an on-disk store.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-cyan-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Topology: Single-node vs distributed</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            A single 256-core box with NVMe will outrun a 50-node distributed cluster up to a
            point — and be 100x simpler. Go distributed when data size, availability SLO, or
            write volume genuinely exceed one box. Not before.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- The landscape map                                     */
/* ================================================================== */

function LandscapeSection() {
  const sketch = useCallback((p: p5) => {
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 540)
      p.textFont('monospace')
      p.noLoop()
    }

    p.draw = () => {
      p.background(15, 15, 25)

      drawLabel(p, 'The database landscape: data model (x) × consistency (y)', w / 2, 22, 12, [255, 255, 255])

      // Chart axes
      const padL = 110
      const padR = 40
      const padT = 60
      const padB = 80
      const chartW = w - padL - padR
      const chartH = 540 - padT - padB

      p.stroke(120, 120, 150)
      p.strokeWeight(1.2)
      p.line(padL, padT, padL, padT + chartH)
      p.line(padL, padT + chartH, padL + chartW, padT + chartH)

      // Y-axis ticks
      drawLabel(p, 'strong', padL - 12, padT + 10, 9, [180, 200, 255], 'right')
      drawLabel(p, 'consistency', padL - 12, padT + 24, 7, [160, 180, 220], 'right')
      drawLabel(p, 'eventual', padL - 12, padT + chartH - 10, 9, [255, 180, 160], 'right')
      drawLabel(p, 'consistency', padL - 12, padT + chartH + 4, 7, [220, 160, 140], 'right')

      // X-axis ticks (5 categories along the bottom)
      const xCats = ['KV', 'Document', 'Wide-column', 'Relational', 'Columnar / OLAP']
      for (let i = 0; i < xCats.length; i++) {
        const xPos = padL + ((i + 0.5) / xCats.length) * chartW
        p.stroke(120, 120, 150)
        p.strokeWeight(1)
        p.line(xPos, padT + chartH, xPos, padT + chartH + 4)
        drawLabel(p, xCats[i], xPos, padT + chartH + 16, 9, [200, 200, 220])
      }
      drawLabel(p, 'data model →', w - padR - 40, padT + chartH + 36, 9, [180, 180, 200], 'left')

      // Place databases
      type DB = { name: string; xCat: number; y: number; color: RGB }
      const dbs: DB[] = [
        { name: 'Redis', xCat: 0.35, y: 0.25, color: [255, 120, 120] },
        { name: 'Memcached', xCat: 0.1, y: 0.7, color: [255, 160, 120] },
        { name: 'DynamoDB', xCat: 0.55, y: 0.55, color: [255, 190, 100] },
        { name: 'RocksDB', xCat: 0.15, y: 0.2, color: [200, 180, 140] },
        { name: 'MongoDB', xCat: 1.4, y: 0.45, color: [140, 200, 120] },
        { name: 'Cassandra', xCat: 2.35, y: 0.75, color: [180, 140, 220] },
        { name: 'ScyllaDB', xCat: 2.55, y: 0.7, color: [200, 140, 230] },
        { name: 'Bigtable', xCat: 2.15, y: 0.55, color: [160, 130, 210] },
        { name: 'Postgres', xCat: 3.25, y: 0.1, color: [100, 180, 255] },
        { name: 'MySQL', xCat: 3.5, y: 0.15, color: [120, 200, 255] },
        { name: 'CockroachDB', xCat: 3.65, y: 0.05, color: [130, 210, 255] },
        { name: 'Spanner', xCat: 3.35, y: 0.02, color: [150, 220, 255] },
        { name: 'ClickHouse', xCat: 4.3, y: 0.4, color: [255, 220, 140] },
        { name: 'BigQuery', xCat: 4.5, y: 0.35, color: [255, 210, 120] },
        { name: 'Snowflake', xCat: 4.7, y: 0.3, color: [255, 200, 100] },
        { name: 'Druid', xCat: 4.1, y: 0.6, color: [220, 200, 100] },
      ]

      for (const d of dbs) {
        const x = padL + (d.xCat / xCats.length) * chartW
        const y = padT + d.y * chartH

        // Dot
        p.fill(d.color[0], d.color[1], d.color[2])
        p.noStroke()
        p.ellipse(x, y, 14, 14)

        // Label
        drawLabel(p, d.name, x + 10, y, 9, d.color, 'left')
      }

      // Legend / annotations
      drawLabel(
        p,
        'Upper band = "CP-ish": strong consistency, single-key linearizability. Lower band = "AP": eventual or tunable.',
        w / 2,
        540 - 20,
        8,
        [180, 180, 200],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">3. The Landscape Map</h2>
      <p className="text-gray-300 leading-relaxed">
        A coarse map of where the major databases sit. X axis: data model (simpler on the left,
        richer on the right). Y axis: default consistency (strong at the top, eventual at the
        bottom). Most real databases are tunable within a band — this is where they land by
        default.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Storage engines: B-tree vs LSM                        */
/* ================================================================== */

function StorageEngineSection() {
  const [engine, setEngine] = useState<'btree' | 'lsm'>('lsm')
  const engineRef = useRef(engine)
  engineRef.current = engine

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
      const e = engineRef.current

      drawLabel(
        p,
        e === 'lsm'
          ? 'LSM tree: writes to memtable → flush to sorted files → background compaction'
          : 'B-tree: writes update pages in place, always keeping the tree balanced',
        w / 2,
        22,
        11,
        [255, 255, 255],
      )

      if (e === 'lsm') {
        // LSM layout
        const writerX = 90
        const memX = 260
        const l0X = 420
        const l1X = 560
        const l2X = 700

        // Writer
        drawBox(p, writerX, 150, 110, 36, [20, 40, 70], [100, 180, 255], 'write(k, v)', 10)

        // Memtable (RAM)
        drawBox(p, memX, 150, 130, 56, [40, 30, 60], [200, 140, 255], 'Memtable', 10)
        drawLabel(p, '(in-memory, sorted)', memX, 168, 8, [200, 160, 220])
        drawLabel(p, 'e.g. skiplist', memX, 180, 7, [180, 140, 200])

        // WAL
        drawBox(p, memX, 240, 130, 28, [50, 30, 30], [220, 120, 120], 'WAL (disk)', 9)
        drawLabel(p, 'append only, for crash recovery', memX, 258, 7, [220, 160, 160])

        // Arrow writer -> memtable
        drawArrow(p, writerX + 55, 150, memX - 65, 150, [100, 180, 255, 180])
        const wProg = (t * 0.9) % 1
        drawMovingDot(p, writerX + 55, 150, memX - 65, 150, wProg, [100, 200, 255])

        // Arrow memtable -> WAL
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.stroke(220, 120, 120, 130)
        p.strokeWeight(1)
        p.line(memX, 178, memX, 226)
        ctx.setLineDash([])

        // Level 0 SSTables (multiple small files)
        drawLabel(p, 'Level 0', l0X, 90, 10, [120, 220, 160])
        for (let i = 0; i < 4; i++) {
          const fy = 110 + i * 22
          p.fill(20, 40, 25)
          p.stroke(120, 220, 160)
          p.strokeWeight(1)
          p.rect(l0X - 50, fy, 100, 18, 3)
          drawLabel(p, `SSTable-${i}`, l0X, fy + 9, 8, [160, 220, 180])
        }

        // Level 1
        drawLabel(p, 'Level 1', l1X, 90, 10, [255, 200, 120])
        for (let i = 0; i < 3; i++) {
          const fy = 110 + i * 30
          p.fill(40, 30, 20)
          p.stroke(255, 200, 120)
          p.strokeWeight(1)
          p.rect(l1X - 60, fy, 120, 24, 3)
          drawLabel(p, `SSTable L1-${i}`, l1X, fy + 12, 7, [255, 220, 160])
        }

        // Level 2
        drawLabel(p, 'Level 2', l2X, 90, 10, [255, 140, 180])
        for (let i = 0; i < 2; i++) {
          const fy = 110 + i * 45
          p.fill(50, 20, 35)
          p.stroke(255, 140, 180)
          p.strokeWeight(1)
          p.rect(l2X - 75, fy, 150, 38, 3)
          drawLabel(p, `SSTable L2-${i}`, l2X, fy + 19, 7, [255, 180, 200])
        }

        // Memtable -> L0 flush
        drawArrow(p, memX + 65, 150, l0X - 55, 155, [200, 140, 255, 150])
        drawLabel(p, 'flush', (memX + 65 + l0X - 55) / 2, 140, 8, [200, 160, 220])

        // L0 -> L1 compaction
        drawArrow(p, l0X + 55, 155, l1X - 65, 155, [120, 220, 160, 140])
        drawLabel(p, 'compact', (l0X + 55 + l1X - 65) / 2, 140, 8, [160, 220, 180])

        // L1 -> L2
        drawArrow(p, l1X + 65, 155, l2X - 80, 155, [255, 200, 120, 140])
        drawLabel(p, 'compact', (l1X + 65 + l2X - 80) / 2, 140, 8, [255, 220, 160])

        // Read path
        drawLabel(p, 'Read path: check memtable → L0 → L1 → L2 (bloom filters skip misses)', w / 2, 300, 10, [180, 220, 180])

        // Properties
        p.fill(30, 30, 50, 220)
        p.stroke(100, 100, 140)
        p.strokeWeight(1)
        p.rect(40, 330, w - 80, 150, 6)
        drawLabel(p, 'Properties:', 60, 346, 10, [255, 255, 255], 'left')
        drawLabel(p, '+ Writes are sequential appends → extremely fast (millions/sec)', 80, 364, 9, [180, 220, 180], 'left')
        drawLabel(p, '+ Space-amplification is moderate, levels compact over time', 80, 380, 9, [180, 220, 180], 'left')
        drawLabel(p, '− Reads may touch multiple files → use bloom filters to skip', 80, 396, 9, [220, 180, 180], 'left')
        drawLabel(p, '− Compaction eats CPU + disk I/O in background', 80, 412, 9, [220, 180, 180], 'left')
        drawLabel(p, 'Used by: Cassandra, ScyllaDB, RocksDB, HBase, LevelDB, BadgerDB, InfluxDB', 80, 434, 9, [200, 200, 220], 'left')
        drawLabel(p, 'Also: SQLite (WAL mode is B-tree + WAL); Postgres does NOT use LSM', 80, 450, 9, [200, 200, 220], 'left')
      } else {
        // B-tree layout
        // Root
        const rootY = 90
        const rootW = 240
        p.fill(40, 30, 60)
        p.stroke(200, 140, 255)
        p.strokeWeight(1.5)
        p.rect(w / 2 - rootW / 2, rootY, rootW, 34, 4)
        // Keys in root
        for (let i = 0; i < 3; i++) {
          const kx = w / 2 - rootW / 2 + (i + 0.5) * (rootW / 3)
          p.fill(255)
          p.noStroke()
          p.textAlign(p.CENTER, p.CENTER)
          p.textSize(10)
          p.text(`k${(i + 1) * 25}`, kx, rootY + 17)
        }
        drawLabel(p, 'Root', w / 2, rootY - 10, 9, [200, 140, 255])

        // Internal level
        const internalY = 180
        const internalPositions = [w * 0.2, w * 0.42, w * 0.58, w * 0.8]
        for (let i = 0; i < internalPositions.length; i++) {
          const ix = internalPositions[i]
          p.fill(30, 40, 60)
          p.stroke(100, 180, 255)
          p.strokeWeight(1.3)
          p.rect(ix - 70, internalY, 140, 30, 4)
          drawLabel(p, `k${i * 25 + 10} | k${i * 25 + 20}`, ix, internalY + 15, 8, [160, 200, 255])
        }

        // Leaves (linked list at bottom)
        const leafY = 280
        const leafCount = 8
        for (let i = 0; i < leafCount; i++) {
          const lx = w * (0.08 + i * 0.11)
          p.fill(20, 40, 30)
          p.stroke(120, 220, 160)
          p.strokeWeight(1.2)
          p.rect(lx - 38, leafY, 76, 24, 3)
          drawLabel(p, `${i * 12}..${i * 12 + 11}`, lx, leafY + 12, 8, [160, 220, 180])

          // Leaves are doubly-linked
          if (i < leafCount - 1) {
            const nextX = w * (0.08 + (i + 1) * 0.11)
            p.stroke(120, 220, 160, 130)
            p.strokeWeight(1)
            p.line(lx + 38, leafY + 12, nextX - 38, leafY + 12)
          }
        }

        // Root -> internal arrows
        const rootChildren = [w * 0.2, w * 0.42, w * 0.58, w * 0.8]
        for (let i = 0; i < rootChildren.length; i++) {
          p.stroke(200, 140, 255, 140)
          p.strokeWeight(1)
          p.line(w / 2, rootY + 34, rootChildren[i], internalY)
        }

        // Internal -> leaf arrows (each internal has 2 children)
        for (let i = 0; i < internalPositions.length; i++) {
          const ix = internalPositions[i]
          for (let j = 0; j < 2; j++) {
            const leafIdx = i * 2 + j
            const lx = w * (0.08 + leafIdx * 0.11)
            p.stroke(100, 180, 255, 140)
            p.strokeWeight(1)
            p.line(ix, internalY + 30, lx, leafY)
          }
        }

        // Write animation: find path down to leaf
        const tgtLeaf = Math.floor((t * 0.5) % leafCount)
        const tgtInternal = Math.floor(tgtLeaf / 2)
        const phase = (t * 0.5) % 1

        if (phase < 0.33) {
          const k = phase / 0.33
          drawMovingDot(p, w / 2, rootY + 34, internalPositions[tgtInternal], internalY, k, [255, 220, 120])
        } else if (phase < 0.67) {
          const k = (phase - 0.33) / 0.34
          const lx = w * (0.08 + tgtLeaf * 0.11)
          drawMovingDot(p, internalPositions[tgtInternal], internalY + 30, lx, leafY, k, [255, 220, 120])
        } else {
          const lx = w * (0.08 + tgtLeaf * 0.11)
          p.fill(255, 220, 120)
          p.noStroke()
          p.ellipse(lx, leafY + 12, 10, 10)
          drawLabel(p, 'update leaf page', lx, leafY + 32, 8, [255, 220, 140])
        }

        // Properties
        p.fill(30, 30, 50, 220)
        p.stroke(100, 100, 140)
        p.strokeWeight(1)
        p.rect(40, 330, w - 80, 150, 6)
        drawLabel(p, 'Properties:', 60, 346, 10, [255, 255, 255], 'left')
        drawLabel(p, '+ Reads are O(log n) page hits — predictable, low-latency point lookups', 80, 364, 9, [180, 220, 180], 'left')
        drawLabel(p, '+ Range scans use the leaf linked list — very efficient', 80, 380, 9, [180, 220, 180], 'left')
        drawLabel(p, '− Random writes → page splits → fragmentation and write-amplification', 80, 396, 9, [220, 180, 180], 'left')
        drawLabel(p, '− Updates happen in place → WAL needed for crash safety', 80, 412, 9, [220, 180, 180], 'left')
        drawLabel(p, 'Used by: Postgres, MySQL InnoDB, SQLite, most traditional relational engines', 80, 434, 9, [200, 200, 220], 'left')
        drawLabel(p, 'Variants: B+tree (separates internal and leaf), fractal trees (TokuDB)', 80, 450, 9, [200, 200, 220], 'left')
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">4. Storage Engines — B-tree vs LSM</h2>
      <p className="text-gray-300 leading-relaxed">
        Every database has a storage engine underneath. Two shapes dominate, and they are
        opposite in almost every way. The choice drives write throughput, read latency,
        space efficiency, and operational pain.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Engine:</span>
            {(['btree', 'lsm'] as const).map((en) => (
              <button
                key={en}
                onClick={() => setEngine(en)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  engine === en
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {en === 'btree' ? 'B-tree' : 'LSM tree'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">When B-tree wins</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Read-heavy workloads, lots of point lookups, range scans, foreign keys, true
            secondary indexes. Relational OLTP defaults here. Lower write amplification on
            modest write rates. Postgres, MySQL, SQLite.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">When LSM wins</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Write-heavy workloads (ingestion, time-series, event logs), massive scale,
            eventually-consistent reads, wide-column patterns. Compression is excellent
            because values on the same level are sorted. Cassandra, RocksDB, ScyllaDB.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">MyRocks is MySQL on RocksDB:</strong> Facebook
          runs trillions of rows on MySQL with the InnoDB engine swapped out for RocksDB.
          Same SQL, same replication, different storage engine — proof that the engine is a
          decoupled concern from the query/transaction layer.
        </p>
      </div>
    </section>
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
  size = 8,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

/* ================================================================== */
/*  Section 5 -- Row vs Columnar                                       */
/* ================================================================== */

function RowVsColumnarSection() {
  const [layout, setLayout] = useState<'row' | 'column'>('column')
  const layoutRef = useRef(layout)
  layoutRef.current = layout

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
      const l = layoutRef.current

      drawLabel(
        p,
        l === 'row'
          ? 'Row-oriented: each row\'s fields stored contiguously (OLTP friendly)'
          : 'Column-oriented: each field stored across all rows contiguously (OLAP friendly)',
        w / 2,
        22,
        11,
        [255, 255, 255],
      )

      // Example table: events(event_id, user_id, ts, event_type, country)
      // We'll draw 8 rows × 5 columns

      const tableX = w * 0.5
      const rowCount = 8
      const colCount = 5
      const cellW = 68
      const cellH = 24
      const tableW = colCount * cellW
      const tableH = rowCount * cellH
      const tx = tableX - tableW / 2
      const ty = 80

      const colors: RGB[] = [
        [100, 180, 255],
        [120, 220, 140],
        [255, 180, 100],
        [220, 140, 255],
        [255, 140, 180],
      ]

      const colNames = ['event_id', 'user_id', 'ts', 'event_type', 'country']

      // Query highlight: "SELECT country, COUNT(*) FROM events GROUP BY country"
      // Only reads event_type and country columns (indexes 3, 4). Wait — country is column 4.
      // Let's do: "SELECT country, COUNT(*) GROUP BY country" → reads only column 4.
      // To make it clearer: highlight cells that a query touches.
      // Query: "SELECT country, COUNT(*) FROM events WHERE event_type='click' GROUP BY country"
      // Touches columns event_type (3) and country (4)

      // Column headers
      for (let c = 0; c < colCount; c++) {
        const cx = tx + c * cellW
        p.fill(colors[c][0] * 0.25, colors[c][1] * 0.25, colors[c][2] * 0.25)
        p.stroke(colors[c][0], colors[c][1], colors[c][2])
        p.strokeWeight(1)
        p.rect(cx, ty - 28, cellW, 24, 2)
        drawLabel(p, colNames[c], cx + cellW / 2, ty - 16, 8, colors[c])
      }

      const touchedCols = [3, 4]

      // Draw cells based on layout
      if (l === 'row') {
        // Row-major: row r is stored at bytes [r*colCount, r*colCount+colCount)
        for (let r = 0; r < rowCount; r++) {
          for (let c = 0; c < colCount; c++) {
            const cx = tx + c * cellW
            const cy = ty + r * cellH
            const touched = touchedCols.includes(c)
            p.fill(25, 25, 30)
            p.stroke(touched ? 255 : 80, touched ? 220 : 80, touched ? 120 : 100, touched ? 200 : 120)
            p.strokeWeight(touched ? 1.5 : 1)
            p.rect(cx, cy, cellW, cellH, 2)
            p.fill(touched ? 255 : 150, touched ? 220 : 150, touched ? 120 : 150)
            p.noStroke()
            p.textAlign(p.CENTER, p.CENTER)
            p.textSize(8)
            const val = `r${r}c${c}`
            p.text(val, cx + cellW / 2, cy + cellH / 2)
          }
        }

        // Storage layout strip at bottom
        const stripY = ty + tableH + 50
        const stripCellW = 28
        const stripCount = rowCount * colCount
        const stripStart = w / 2 - (stripCount * stripCellW) / 2
        drawLabel(p, 'on-disk layout (bytes):', stripStart, stripY - 14, 9, [200, 200, 220], 'left')

        for (let i = 0; i < stripCount; i++) {
          const r = Math.floor(i / colCount)
          const c = i % colCount
          const touched = touchedCols.includes(c)
          const col = colors[c]
          p.fill(col[0] * 0.3, col[1] * 0.3, col[2] * 0.3)
          p.stroke(touched ? col[0] : col[0] * 0.5, touched ? col[1] : col[1] * 0.5, touched ? col[2] : col[2] * 0.5, touched ? 220 : 100)
          p.strokeWeight(touched ? 1.5 : 0.8)
          p.rect(stripStart + i * stripCellW, stripY, stripCellW - 2, 20, 2)
          if (touched) {
            p.fill(255, 220, 120)
            p.noStroke()
            p.textSize(6)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('✓', stripStart + i * stripCellW + stripCellW / 2 - 1, stripY + 10)
          }
        }

        drawLabel(
          p,
          'Query "SELECT country WHERE event_type=\'click\'" must read EVERY byte and skip 60% (3 of 5 cols).',
          w / 2,
          stripY + 44,
          9,
          [255, 200, 160],
        )
      } else {
        // Column-major: column c is stored contiguously
        for (let r = 0; r < rowCount; r++) {
          for (let c = 0; c < colCount; c++) {
            const cx = tx + c * cellW
            const cy = ty + r * cellH
            const touched = touchedCols.includes(c)
            p.fill(25, 25, 30)
            p.stroke(touched ? 255 : 80, touched ? 220 : 80, touched ? 120 : 100, touched ? 200 : 120)
            p.strokeWeight(touched ? 1.5 : 1)
            p.rect(cx, cy, cellW, cellH, 2)
            p.fill(touched ? 255 : 150, touched ? 220 : 150, touched ? 120 : 150)
            p.noStroke()
            p.textAlign(p.CENTER, p.CENTER)
            p.textSize(8)
            const val = `r${r}c${c}`
            p.text(val, cx + cellW / 2, cy + cellH / 2)
          }
        }

        // Storage layout strip at bottom — grouped by column
        const stripY = ty + tableH + 50
        const stripCellW = 28
        const stripStart = w / 2 - (rowCount * colCount * stripCellW) / 2
        drawLabel(p, 'on-disk layout (bytes):', stripStart, stripY - 14, 9, [200, 200, 220], 'left')

        // Draw column blocks
        for (let c = 0; c < colCount; c++) {
          const touched = touchedCols.includes(c)
          const col = colors[c]
          const blockStart = stripStart + c * (rowCount * stripCellW)

          // Column block frame
          p.noFill()
          p.stroke(col[0], col[1], col[2], touched ? 200 : 100)
          p.strokeWeight(touched ? 2 : 1)
          p.rect(blockStart - 2, stripY - 3, rowCount * stripCellW + 2, 26, 3)

          for (let r = 0; r < rowCount; r++) {
            p.fill(col[0] * 0.3, col[1] * 0.3, col[2] * 0.3)
            p.stroke(col[0], col[1], col[2], touched ? 220 : 100)
            p.strokeWeight(0.8)
            p.rect(blockStart + r * stripCellW, stripY, stripCellW - 2, 20, 2)
            if (touched) {
              p.fill(255, 220, 120)
              p.noStroke()
              p.textSize(6)
              p.textAlign(p.CENTER, p.CENTER)
              p.text('✓', blockStart + r * stripCellW + stripCellW / 2 - 1, stripY + 10)
            }
          }

          // Column name below block
          drawLabel(p, colNames[c], blockStart + (rowCount * stripCellW) / 2, stripY + 32, 7, touched ? [255, 220, 120] : col)
        }

        drawLabel(
          p,
          'Same query reads ONLY event_type + country blocks (40% of bytes). Compresses ~10x since values repeat.',
          w / 2,
          stripY + 56,
          9,
          [160, 220, 160],
        )
      }

      // Example query text
      p.fill(30, 30, 50, 220)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, ty - 60, w - 80, 26, 6)
      drawLabel(p, 'Query: SELECT country, COUNT(*) FROM events WHERE event_type = \'click\' GROUP BY country', w / 2, ty - 47, 9, [255, 220, 140])

      void t
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. Row vs Columnar Storage</h2>
      <p className="text-gray-300 leading-relaxed">
        Two ways to lay out a table on disk. Row-oriented: Alice's entire record sits together,
        then Bob's, then Charlie's. Column-oriented: every row's{' '}
        <code className="text-pink-400">country</code> value sits together, then every row's{' '}
        <code className="text-pink-400">event_type</code>. For a query reading 2 columns across
        a billion rows, columnar is 10–100x faster — it skips 60% of bytes and compresses the
        rest.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Layout:</span>
            {(['row', 'column'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setLayout(lv)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  layout === lv
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {lv}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Row-oriented wins for</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Point lookups ("get user 42"), wide reads of a single record, transactional
            updates ("increment balance"). Postgres, MySQL, InnoDB, Oracle, every classical
            OLTP database.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Columnar wins for</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Analytics queries (SUM, COUNT, AVG over time), dashboards, ad-hoc BI.
            ClickHouse, BigQuery, Snowflake, Redshift, Druid, Apache Pinot. Also:{' '}
            <em>hybrid engines</em> (SingleStore, TiFlash) that maintain both layouts.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Why columnar compresses so well:</strong>{' '}
          adjacent values in a column are the same <em>type</em>, often the same{' '}
          <em>value</em>. "country=US, country=US, country=US..." → run-length encoded to "US×3".
          Timestamps and sorted IDs use delta encoding. Typical columnar compression ratios are
          5–20×; with good encoding choices, 50×. This means fewer bytes to read from disk.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- PostgreSQL / MySQL                                    */
/* ================================================================== */

function PostgresMySQLSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. PostgreSQL &amp; MySQL</h2>
      <p className="text-gray-300 leading-relaxed">
        The default answer for transactional data. If someone asks "what database should we
        use" and you have no other information, say Postgres. You will be right &gt;70% of the
        time.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">PostgreSQL</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 leading-relaxed">
            <li>B-tree storage (with WAL), MVCC for concurrent reads/writes</li>
            <li>SQL with strong standards compliance (window functions, CTEs, JSONB)</li>
            <li>Rich extension ecosystem: PostGIS (spatial), pgvector (ANN), TimescaleDB, Citus (sharding)</li>
            <li>Logical and physical replication; hot standbys</li>
            <li>Single-node write throughput: ~50K writes/sec on good hardware</li>
            <li>Reaches limits around 10 TB / 100K QPS before you need to shard or migrate</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">MySQL (InnoDB)</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 leading-relaxed">
            <li>Clustered B+tree (rows stored in primary-key order)</li>
            <li>Row-level locking, MVCC via undo logs</li>
            <li>Replication is battle-tested — GitHub, Booking.com, Shopify run massive fleets</li>
            <li>MyRocks variant swaps InnoDB for RocksDB (LSM) — wins on write-heavy workloads</li>
            <li>Vitess shards MySQL horizontally (YouTube, Slack)</li>
            <li>Weaker JSON / analytical support than Postgres, but often faster for simple OLTP</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans">Example use cases</p>
        <p>• User accounts, billing, orders — anything with foreign keys and money</p>
        <p>• Multi-table joins: "orders JOIN users JOIN items JOIN shipments"</p>
        <p>• Audit trails with strict ordering</p>
        <p>• Small-to-medium analytics (up to ~1 TB with materialized views)</p>
        <p>• Feature store reads at the API layer (if backed by a cache)</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The rule:</strong> start with Postgres. Move off
          it only when you have a concrete reason — vertical limits reached, specific access
          pattern it handles poorly (large fan-out writes, massive time-series), or a specialized
          workload (vector search at billion-scale, graph traversal, petabyte OLAP). Otherwise,
          stay with the database that has 30 years of production hardening.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- MongoDB                                               */
/* ================================================================== */

function MongoSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. MongoDB — The Document Database</h2>
      <p className="text-gray-300 leading-relaxed">
        MongoDB stores JSON-like documents (BSON) indexed by{' '}
        <code className="text-pink-400">_id</code>, with secondary indexes on any field. A
        document can nest objects and arrays; a collection has no fixed schema. It's the
        default for "my data is nested objects and I don't want to do joins."
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">What MongoDB gives you</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 leading-relaxed">
            <li>Flexible schema — evolve document shape without migrations</li>
            <li>Rich secondary indexes including compound, text, geo, hashed, wildcard</li>
            <li>Aggregation pipeline (like SQL, but over nested documents)</li>
            <li>Built-in sharding via hash or range on any field</li>
            <li>Replica sets with automatic failover</li>
            <li>WiredTiger storage engine (B-tree with optional LSM mode)</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Where it bites</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 leading-relaxed">
            <li>Joins across collections are slow (use $lookup sparingly)</li>
            <li>Multi-document transactions exist but have overhead</li>
            <li>Unbounded document growth is an anti-pattern (16MB limit)</li>
            <li>Sharding is trickier than it looks — shard-key choice is permanent</li>
            <li>Schema-less is schema-deferred; bad data lives forever</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans">Fits well for</p>
        <p>• Content management / CMS — pages with variable shape</p>
        <p>• Product catalogs — attributes differ per category</p>
        <p>• User profiles with nested preferences, settings, history</p>
        <p>• Event logs where each event type has different fields</p>
        <p>• IoT device state with varying sensor payloads</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Postgres has JSONB now:</strong> the gap has
          narrowed dramatically. Postgres JSONB supports indexing, path queries, and partial
          updates. If your only reason to pick MongoDB was "my data is nested," test Postgres
          JSONB first. Reach for Mongo when you also need easy sharding or the aggregation
          pipeline specifically.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Redis                                                 */
/* ================================================================== */

function RedisSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Redis — The In-Memory Swiss Army Knife</h2>
      <p className="text-gray-300 leading-relaxed">
        Redis is not just a key-value store — it's a data structure server. Strings, hashes,
        lists, sets, sorted sets, streams, bitmaps, HyperLogLog, geospatial indexes. Each is a
        first-class primitive with atomic operations. Single-threaded event loop, everything
        in RAM, microsecond latency.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-3">The core data structures</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-white">Type</th>
                <th className="py-2 px-3 text-white">Operations</th>
                <th className="py-2 px-3 text-white">Classic use</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-xs">
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">String</td>
                <td className="py-2 px-3">GET SET INCR EXPIRE</td>
                <td className="py-2 px-3">Counters, session tokens, cache</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Hash</td>
                <td className="py-2 px-3">HGET HSET HINCRBY</td>
                <td className="py-2 px-3">Object fields, user profile fields</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">List</td>
                <td className="py-2 px-3">LPUSH RPUSH LRANGE BRPOP</td>
                <td className="py-2 px-3">Queues, activity streams</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Set</td>
                <td className="py-2 px-3">SADD SINTER SUNION</td>
                <td className="py-2 px-3">Tags, unique visitors, friend lists</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Sorted Set</td>
                <td className="py-2 px-3">ZADD ZRANGEBYSCORE</td>
                <td className="py-2 px-3">Leaderboards, priority queues, rate limiters</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Stream</td>
                <td className="py-2 px-3">XADD XREADGROUP</td>
                <td className="py-2 px-3">Kafka-in-Redis for modest scale</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">HyperLogLog</td>
                <td className="py-2 px-3">PFADD PFCOUNT</td>
                <td className="py-2 px-3">Cardinality estimation at constant memory</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-pink-400">Geo</td>
                <td className="py-2 px-3">GEOADD GEOSEARCH</td>
                <td className="py-2 px-3">"Find drivers within 5 km"</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Persistence modes</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><strong className="text-white">RDB:</strong> periodic snapshot; small file, fast restart, loses last N minutes on crash</li>
            <li><strong className="text-white">AOF:</strong> append-only log of every command; durable, larger, slower restart</li>
            <li><strong className="text-white">Both:</strong> production default — RDB for recovery, AOF for durability</li>
            <li><strong className="text-white">None:</strong> pure cache — data is regeneratable</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Scale</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li>Single Redis: 100K-1M ops/sec (one core)</li>
            <li>Memory limit: as much RAM as you can afford (up to ~1 TB per node)</li>
            <li><strong className="text-white">Redis Cluster:</strong> hash-slot-based sharding, 16384 slots, linear scale</li>
            <li>Managed variants: ElastiCache, MemoryDB (AOF to multi-AZ), Upstash (serverless)</li>
            <li>Drop-in forks: KeyDB (multi-threaded), Dragonfly (modern, 25× perf claims)</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Redis is a primary database too, not just a
          cache:</strong> for session state, rate limiters, leaderboards, real-time counters —
          anything that fits in RAM and benefits from sub-millisecond latency — Redis is often
          the <em>source of truth</em>. With AOF + replica it's durable enough for production.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Cassandra, Scylla                                     */
/* ================================================================== */

function CassandraScyllaSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Cassandra &amp; ScyllaDB — Wide-Column</h2>
      <p className="text-gray-300 leading-relaxed">
        Cassandra (Facebook origin, now Apache) and ScyllaDB (C++ rewrite) are{' '}
        <strong className="text-white">wide-column</strong> databases built for massive write
        throughput and linear scale. LSM storage, peer-to-peer architecture (no leader),
        tunable consistency, partitioned by hash of a primary key.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">The data model</p>
          <p className="text-gray-300 text-sm leading-relaxed mb-2">
            A table has a <em>partition key</em> (determines which node) and a{' '}
            <em>clustering key</em> (orders rows within a partition). Reads of a full partition
            are a single-node range scan.
          </p>
          <div className="font-mono text-xs bg-gray-900 rounded p-3">
            <p className="text-pink-400">CREATE TABLE events (</p>
            <p className="ml-2">user_id uuid,</p>
            <p className="ml-2">event_time timestamp,</p>
            <p className="ml-2">event_type text, data text,</p>
            <p className="ml-2 text-amber-400">PRIMARY KEY (user_id, event_time)</p>
            <p className="text-pink-400">)</p>
            <p className="ml-2 text-gray-500">// partition by user_id, cluster by event_time DESC</p>
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Tunable consistency</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Every read and write specifies a consistency level:{' '}
            <code className="text-pink-400">ONE</code>,{' '}
            <code className="text-pink-400">QUORUM</code>,{' '}
            <code className="text-pink-400">LOCAL_QUORUM</code>,{' '}
            <code className="text-pink-400">ALL</code>. Write QUORUM + read QUORUM gives
            strong single-key consistency. Write ONE + read ONE gives maximum availability
            and speed.
          </p>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-2">Cassandra vs ScyllaDB</p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Same data model, same CQL, same clients. ScyllaDB is a ground-up C++ rewrite using
          the <strong className="text-white">Seastar</strong> framework — shared-nothing
          per-core architecture, no locks, no garbage collector. Claims{' '}
          <strong className="text-white">10× throughput per node</strong> and much lower P99s.
          Production truth: most of the 10× is real for write-heavy workloads. Operationally
          it's drop-in replacement for Cassandra; migration is a schema dump + reload.
        </p>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans">Fits well for</p>
        <p>• Time-series at scale (sensor data, event logs, audit trails)</p>
        <p>• User activity feeds — partition by user_id, cluster by timestamp</p>
        <p>• Messaging systems (WhatsApp's main store is custom-Mnesia + ScyllaDB at the edge)</p>
        <p>• Any "write once, read by a known key" workload at TB+ scale</p>
        <p>• Netflix uses Cassandra as the system of record for almost everything user-facing</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The big warning:</strong> Cassandra/Scylla are
          not good at arbitrary queries. There are no joins; secondary indexes exist but are
          slow and discouraged. You must design the schema <em>around</em> the queries you'll
          make. If a query shape changes, you re-denormalize. This is fine when queries are
          known and stable; painful when requirements shift weekly.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- DynamoDB                                             */
/* ================================================================== */

function DynamoSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. DynamoDB — Managed Wide-Column</h2>
      <p className="text-gray-300 leading-relaxed">
        DynamoDB is AWS's managed, serverless, always-available KV/wide-column store. The
        original Dynamo paper (2007) inspired Cassandra, Riak, and others — but DynamoDB the
        product is now its own thing, with strong-consistency options, global tables, and
        effectively-unlimited scale.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Keys and indexes</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Every item has a <strong className="text-white">partition key</strong> (hash).
            Optionally a <strong className="text-white">sort key</strong> for ordering within
            a partition. Secondary access patterns use{' '}
            <strong className="text-white">GSIs</strong> (global secondary indexes — new
            partition+sort key) and <strong className="text-white">LSIs</strong> (local
            secondary indexes — different sort key, same partition).
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Capacity models</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><strong className="text-white">On-demand:</strong> pay per request; auto-scales instantly; $$ but operationally free</li>
            <li><strong className="text-white">Provisioned:</strong> reserve R/W capacity units; cheaper at steady state</li>
            <li><strong className="text-white">DAX:</strong> managed write-through cache for microsecond reads</li>
            <li><strong className="text-white">Global Tables:</strong> multi-region active-active with last-writer-wins</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans">Single-table design</p>
        <p>The idiomatic Dynamo pattern: one table, many entity types, partition key encodes</p>
        <p>the entity + id, sort key encodes the relationship. Example:</p>
        <p className="mt-2">  PK=USER#42   SK=PROFILE         → user profile</p>
        <p>  PK=USER#42   SK=ORDER#2024-01-15 → order record</p>
        <p>  PK=USER#42   SK=ORDER#2024-02-20 → order record</p>
        <p>  PK=ORDER#2024-01-15  SK=USER#42  → inverse lookup</p>
        <p className="mt-2 text-gray-500">Query PK=USER#42 returns everything about user 42. Minimal round-trips.</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Strengths:</strong> you will never page on
          Dynamo. Scaling is AWS's problem. You pay for throughput, not nodes. Latency is
          ~10 ms P99 regardless of table size.
          <br /><br />
          <strong className="text-yellow-400">Weaknesses:</strong> queries must match your key
          design — arbitrary ad-hoc queries are not possible. Secondary indexes cost extra
          writes. Cost can explode under bad access patterns (hot partitions, full scans). No
          joins, no aggregations, no SQL.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Consistent Hashing Ring                              */
/* ================================================================== */

function ConsistentHashingSection() {
  const [nodeCount, setNodeCount] = useState(6)
  const countRef = useRef(nodeCount)
  countRef.current = nodeCount

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 500)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.008
      p.background(15, 15, 25)

      drawLabel(p, 'Consistent hashing: keys and nodes both on a hash ring', w / 2, 22, 12, [255, 255, 255])

      const cx = w / 2
      const cy = 260
      const rOuter = 170

      // Ring
      p.noFill()
      p.stroke(120, 120, 160)
      p.strokeWeight(2)
      p.ellipse(cx, cy, rOuter * 2, rOuter * 2)

      // Hash range labels
      drawLabel(p, '0x0000', cx, cy - rOuter - 14, 8, [160, 160, 200])
      drawLabel(p, '0xFFFF', cx + rOuter + 28, cy, 8, [160, 160, 200])
      drawLabel(p, '0x8000', cx, cy + rOuter + 14, 8, [160, 160, 200])
      drawLabel(p, '0x4000', cx - rOuter - 28, cy, 8, [160, 160, 200], 'right')

      const n = countRef.current

      // Draw nodes at evenly-spaced hash positions
      const nodeColors: RGB[] = [
        [100, 180, 255],
        [120, 220, 140],
        [255, 180, 100],
        [220, 140, 255],
        [255, 140, 180],
        [140, 220, 220],
        [255, 200, 140],
        [180, 220, 120],
      ]

      const nodePositions: { x: number; y: number; angle: number }[] = []
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(angle) * rOuter
        const y = cy + Math.sin(angle) * rOuter
        nodePositions.push({ x, y, angle })

        const color = nodeColors[i % nodeColors.length]
        p.fill(color[0], color[1], color[2])
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(2)
        p.ellipse(x, y, 26, 26)
        p.fill(15, 15, 25)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(10)
        p.text(`${i + 1}`, x, y)

        // Node label outside
        const labelR = rOuter + 30
        const lx = cx + Math.cos(angle) * labelR
        const ly = cy + Math.sin(angle) * labelR
        drawLabel(p, `Node ${i + 1}`, lx, ly, 8, color)
      }

      // Draw a few key hash positions
      const keyAngles = [0.15, 0.42, 0.61, 0.78, 0.95, 1.3, 1.7, 2.1, 2.5, 2.9, 3.3, 3.8, 4.4, 5.1, 5.8]
      for (let i = 0; i < keyAngles.length; i++) {
        const ang = keyAngles[i] + Math.sin(t + i) * 0.02 // tiny jitter
        const x = cx + Math.cos(ang - Math.PI / 2) * (rOuter - 22)
        const y = cy + Math.sin(ang - Math.PI / 2) * (rOuter - 22)
        p.fill(200, 200, 200)
        p.noStroke()
        p.ellipse(x, y, 7, 7)

        // Find which node owns this key (walk clockwise)
        // Each node owns the arc from its position to the next node (clockwise).
        let owner = 0
        for (let j = 0; j < n; j++) {
          const nodeAng = (j / n) * Math.PI * 2
          const keyAng = ang
          if (keyAng >= nodeAng && keyAng < ((j + 1) / n) * Math.PI * 2) {
            owner = j
            break
          }
          if (j === n - 1 && keyAng >= nodeAng) {
            owner = j
          }
        }

        // Highlight owner's arc
        const color = nodeColors[owner % nodeColors.length]
        p.stroke(color[0], color[1], color[2], 180)
        p.strokeWeight(1)
        p.line(x, y, nodePositions[owner].x, nodePositions[owner].y)
      }

      // Legend / text
      p.fill(30, 30, 50, 220)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, 440, w - 80, 56, 6)
      drawLabel(p, 'How it works:', 60, 456, 10, [255, 255, 255], 'left')
      drawLabel(p, '1. Hash every key to a position on the ring (0 to 2^64)', 80, 472, 9, [200, 220, 220], 'left')
      drawLabel(p, '2. Each node owns the arc from its position backward to the previous node (clockwise walk)', 80, 486, 9, [200, 220, 220], 'left')

      // Side note
      drawLabel(p, `Adding a node only moves ~1/N of keys. Removing a node moves that node's keys to its clockwise neighbor.`, w / 2, 90, 9, [255, 220, 160])
      drawLabel(p, 'In practice: each physical node has 100+ "virtual nodes" so load stays balanced when nodes leave.', w / 2, 108, 9, [220, 200, 180])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Consistent Hashing (Shared by Cassandra, Dynamo, ScyllaDB)</h2>
      <p className="text-gray-300 leading-relaxed">
        All the Dynamo-family databases — Cassandra, ScyllaDB, Riak, Voldemort — use the same
        trick to partition keys across nodes without a coordinator:{' '}
        <strong className="text-white">consistent hashing</strong>. Keys hash to positions on a
        ring, nodes hash to positions on the same ring, and a key belongs to the first node
        clockwise from its position. Adding or removing a node only moves ~1/N of keys.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">Nodes:</span>
            <input
              type="range"
              min={3}
              max={8}
              value={nodeCount}
              onChange={(e) => setNodeCount(parseInt(e.target.value, 10))}
              className="w-40"
            />
            <span className="text-xs text-gray-300 font-mono">{nodeCount}</span>
          </div>
        }
      />

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Replication on top:</strong> for replication
          factor 3, a key lives on the owner node <em>plus the next two</em> clockwise. Writes
          go to all three (at the requested consistency level). Reads can go to any N of them
          depending on the read consistency. This is how Cassandra and DynamoDB get both
          distribution and fault tolerance from one mechanism.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- RocksDB (embedded)                                   */
/* ================================================================== */

function RocksDBSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. RocksDB — The LSM Library That's Everywhere</h2>
      <p className="text-gray-300 leading-relaxed">
        RocksDB is not a standalone database. It's an <strong className="text-white">embedded
        C++ library</strong> — a single-node, persistent key-value store that you link into
        your application. Forked from Google's LevelDB by Facebook, it is the storage engine
        underneath a staggering number of other systems.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold mb-2">Things actually built on RocksDB</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-white">System</th>
                <th className="py-2 px-3 text-white">Role of RocksDB</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 text-xs">
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">MyRocks (MySQL)</td>
                <td className="py-2 px-3">Storage engine replacing InnoDB</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">CockroachDB</td>
                <td className="py-2 px-3">Per-node key-value store (until recently; now Pebble, a Go rewrite)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">TiKV / TiDB</td>
                <td className="py-2 px-3">Per-node storage</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Flink</td>
                <td className="py-2 px-3">State backend for stream jobs</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Kafka Streams</td>
                <td className="py-2 px-3">Local state stores</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 px-3 font-mono text-pink-400">Ceph BlueStore</td>
                <td className="py-2 px-3">Object metadata</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-pink-400">Dgraph / YDB / many more</td>
                <td className="py-2 px-3">Storage substrate</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold text-sm mb-2">What RocksDB gives you</p>
        <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
          <li>Ordered key-value store (byte-lexicographic)</li>
          <li>Put / Get / Delete / Merge / RangeScan / Snapshot</li>
          <li>Column families (separate keyspaces in one DB)</li>
          <li>Tunable compaction (leveled, universal, FIFO)</li>
          <li>Pluggable compression (Snappy, LZ4, ZSTD)</li>
          <li>Single-node throughput: 1M+ writes/sec on NVMe</li>
          <li>Handles TB+ datasets per instance with constant-ish memory</li>
        </ul>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">BadgerDB, LevelDB, Pebble:</strong> siblings.
          LevelDB is RocksDB's parent (Google). BadgerDB is Go-native with SSD-optimized
          value log separation. Pebble is CockroachDB's Go-rewrite of RocksDB. All share the
          same LSM ideas; the API is roughly `Put`, `Get`, `Scan`.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 13 -- Columnar / OLAP                                       */
/* ================================================================== */

function ColumnarSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Columnar OLAP — ClickHouse, BigQuery, Snowflake, Druid</h2>
      <p className="text-gray-300 leading-relaxed">
        The analytics side of the database world. All column-oriented, all vectorized
        execution, all designed for "scan a billion rows, aggregate a few columns, return
        a few hundred rows." An OLTP database would crumble under this shape; an OLAP database
        does it in seconds.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-yellow-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">ClickHouse</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Open-source, self-hostable columnar OLAP from Yandex. MergeTree engine (LSM-like),
            sorted by your primary key for data skipping. Ingests millions of rows/sec on one
            node. SQL with extensive analytical functions. Used by Cloudflare, Uber
            (DASH), ByteDance. Cheap, fast, predictable.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-orange-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">BigQuery (Google)</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Serverless — no nodes, no provisioning. You upload data, run SQL, pay per TB
            scanned (or flat-rate slots). Distributed execution across thousands of workers
            transparently. Excellent for ad-hoc analytics at petabyte scale. Weakness: every
            query has warm-up latency; not great for low-latency dashboards.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Snowflake</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Separates storage (on S3/blob) from compute (virtual warehouses you spin up). Pay
            for storage once, compute per-warehouse-second. Time travel (query historical
            state), zero-copy cloning, semi-structured SQL on JSON. The current de facto
            enterprise data warehouse.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Druid &amp; Pinot</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Real-time OLAP: ingest streaming data, serve sub-second aggregation queries over
            billions of events. Druid powers Netflix's real-time analytics; Pinot powers
            LinkedIn's site-speed and dashboards. Optimized for dashboards with filter+group-by
            over time ranges.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">DuckDB</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The "SQLite of analytics." A single-file, in-process columnar database. No server.
            Queries Parquet / CSV / Arrow directly. Revolutionary for local analysis,
            notebooks, and embedded BI — it does SQL over a 100 GB dataset on your laptop
            faster than you can set up Spark.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The ETL pipeline:</strong> OLTP is your system
          of record; OLAP is a secondary store populated by CDC from OLTP. Typical flow:
          Postgres → Debezium → Kafka → ClickHouse/Snowflake. Analytics queries never touch
          the OLTP side. The two layers have opposite access patterns and must not fight for
          the same resources.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 14 -- Specialty: Time-series, Search, Graph, Vector         */
/* ================================================================== */

function SpecialtySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">14. Specialty Databases</h2>
      <p className="text-gray-300 leading-relaxed">
        Four workloads where a general-purpose database is technically possible but a specialist
        wins by 10–100×.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Time-series: InfluxDB, TimescaleDB, Prometheus, QuestDB</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Time-indexed numerical data: metrics, IoT sensors, market ticks. Specialized
            compression (delta-delta encoding, Gorilla compression) reduces storage by 10×+.
            Downsampling/retention policies. Flux or PromQL or SQL with time-window functions.
            <br /><br />
            <strong className="text-white">TimescaleDB</strong> is a Postgres extension — best
            of both worlds if you're already on Postgres.{' '}
            <strong className="text-white">Prometheus</strong> is the Kubernetes-era default for
            observability; its TSDB is simple and opinionated.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Search: Elasticsearch, OpenSearch, Meilisearch, Typesense</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Inverted-index over text + structured fields. Full-text queries, fuzzy matching,
            aggregations, geo, vectors. Elasticsearch is the incumbent (Uber, GitHub's code
            search, many log-analytics stacks on top of Elastic).{' '}
            <strong className="text-white">OpenSearch</strong> is the Amazon fork.{' '}
            <strong className="text-white">Meilisearch</strong> and{' '}
            <strong className="text-white">Typesense</strong> are modern, smaller, dev-friendly
            alternatives for "instant search" UIs.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Graph: Neo4j, Dgraph, TigerGraph, JanusGraph</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Data model where relationships are first-class. Traversal queries ("friends of
            friends who like X") are O(traversed edges) rather than exploding JOINs.{' '}
            <strong className="text-white">Neo4j</strong> with Cypher is the popular choice for
            recommendation engines, fraud detection, identity graphs. For most apps a regular
            relational database is fine; reach for a graph DB when your query shape is 4+ hops
            deep routinely.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold mb-2">Vector: pgvector, Pinecone, Weaviate, Qdrant, Milvus</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Store high-dimensional embeddings (e.g. 1536-d from OpenAI) and answer
            nearest-neighbor queries via HNSW, IVF-PQ, or ScaNN indexes. Essential for RAG,
            semantic search, recommendation. <strong className="text-white">pgvector</strong>{' '}
            is the pragmatic choice if you're already on Postgres — works up to tens of
            millions of vectors. <strong className="text-white">Pinecone, Weaviate, Qdrant,
            Milvus</strong> for higher scale (billions) or when you need specialized features
            (hybrid search, multi-tenancy, cloud managed).
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 15 -- NewSQL: CockroachDB, Spanner, TiDB, Yugabyte         */
/* ================================================================== */

function NewSQLSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">15. NewSQL — Distributed SQL</h2>
      <p className="text-gray-300 leading-relaxed">
        The class that says "why can't we have SQL <em>and</em> horizontal scale?" Spanner
        (Google) proved it was possible, and the open-source world followed with CockroachDB,
        TiDB, Yugabyte. Full SQL, ACID transactions, strong consistency, and horizontal scale
        to hundreds of nodes.
      </p>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Google Spanner</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The progenitor. Globally-distributed ACID via <strong className="text-white">TrueTime</strong>{' '}
            — GPS + atomic clocks at every datacenter give a bounded global timestamp. Powers
            AdWords, Google Photos, Gmail. Available on GCP. Expensive but the gold standard for
            multi-region strong consistency.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">CockroachDB</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Spanner without atomic clocks. Uses hybrid logical clocks for distributed
            transactions. Postgres-wire-compatible — same drivers, similar SQL. Survives
            multi-node, multi-AZ, multi-region failures transparently. Harder to operate than
            single-node Postgres but much easier than sharding Postgres yourself.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">TiDB</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            MySQL-wire-compatible distributed SQL. Splits into TiKV (storage, RocksDB-based)
            and TiDB (SQL layer). Has a separate columnar engine (TiFlash) so one cluster
            serves both OLTP and OLAP. Used by PingCAP customers at massive scale in China.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-pink-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">YugabyteDB</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Postgres-wire-compatible, with a DocDB (RocksDB-based) layer beneath. Similar
            positioning to Cockroach. Focus on multi-cloud and geo-distribution.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Cost of distributed SQL:</strong> a transaction
          touching 2 rows on different nodes needs distributed consensus (Raft or Paxos) to
          commit. Latency goes from ~1ms on single-node Postgres to ~5–50ms cross-node. Fine
          for most apps; be aware if your hot path is chatty or latency-critical.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 16 -- Decision Framework                                   */
/* ================================================================== */

function DecisionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">16. Picking the Right Database</h2>
      <p className="text-gray-300 leading-relaxed">
        A practical decision framework, ordered by how likely you are to need each step.
      </p>

      <div className="space-y-3">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 1 — Is it transactional user data with relationships?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">Postgres</strong> (or MySQL). Default. Don't
            overthink this. Handles &lt;10 TB and &lt;100K QPS. Move later if and when.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 2 — Do you need a cache or ephemeral state?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">Redis</strong>. Session data, rate limiters,
            leaderboards, ephemeral pub/sub.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 3 — Is the workload "write a lot by known key, read by that same key"?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">Cassandra / ScyllaDB</strong> (self-hosted) or{' '}
            <strong className="text-white">DynamoDB</strong> (AWS). Event logs, user activity,
            IoT, messaging.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 4 — Is it analytics over hundreds of millions+ rows?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">ClickHouse</strong> (self-host),{' '}
            <strong className="text-white">BigQuery / Snowflake</strong> (managed),{' '}
            <strong className="text-white">Druid / Pinot</strong> (real-time dashboards),{' '}
            <strong className="text-white">DuckDB</strong> (single-node / local).
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 5 — Is it time-series metrics or logs?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">Prometheus</strong> (k8s metrics),{' '}
            <strong className="text-white">TimescaleDB</strong> (if on Postgres),{' '}
            <strong className="text-white">InfluxDB / QuestDB</strong> (high-ingest TSDB),
            or ClickHouse (works great for logs too).
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 6 — Full-text or fuzzy search?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">Elasticsearch / OpenSearch</strong> at scale;{' '}
            <strong className="text-white">Meilisearch / Typesense</strong> for instant-search UIs;{' '}
            <strong className="text-white">Postgres full-text search</strong> for small-to-medium
            use cases.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 7 — Vector similarity (RAG, recommendations)?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">pgvector</strong> first (you're already on Postgres,
            handles up to tens of millions);{' '}
            <strong className="text-white">Pinecone / Weaviate / Qdrant / Milvus</strong> at
            billion-scale or for specialized features.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 8 — Outgrew single-node Postgres and need SQL + horizontal scale?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">CockroachDB</strong>,{' '}
            <strong className="text-white">Spanner</strong>,{' '}
            <strong className="text-white">TiDB</strong>, or{' '}
            <strong className="text-white">YugabyteDB</strong>. Or: shard Postgres with Citus /
            Vitess (for MySQL).
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm">Step 9 — Building your own storage engine?</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            → <strong className="text-white">RocksDB</strong> (C++) or{' '}
            <strong className="text-white">BadgerDB</strong> (Go). You almost certainly should
            not do this.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The polyglot truth:</strong> a typical production
          app uses Postgres for core data, Redis for cache and hot counters, S3 for blobs, a
          Kafka/streams layer for events, and ClickHouse or Snowflake for analytics. Do not
          try to make one database do all of this.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 17 -- Common pitfalls                                      */
/* ================================================================== */

function PitfallsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">17. Common Pitfalls</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Using MongoDB when you need relations</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The "schema-less" pitch wins at prototype time and loses at year two, when product
            wants "orders by user's company" and the only way is to fetch every user and scan.
            If your data has foreign keys, use a relational database.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-orange-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Running analytics on your OLTP database</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            The marketing team's `GROUP BY country OVER last_90_days` query locks up Postgres
            for 4 minutes and your checkout times out. Analytics and transactional workloads
            must be on separate systems — the cost of a read replica or an ETL to ClickHouse
            is much less than the cost of a Tuesday-afternoon outage.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Hot partitions</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Dynamo/Cassandra/Scylla partition by hash of partition key. If 90% of your traffic
            keys to the same partition (e.g. a global `status_counter`), you have a one-node
            problem on a multi-node cluster. Design keys so traffic spreads.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-yellow-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Using Redis as the primary store without AOF</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Redis is durable only if you configure it to be. RDB-only snapshots can lose
            minutes of data on crash. If Redis holds anything you can't regenerate, turn on
            AOF with fsync=everysec and run a replica.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Sharding too early</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Postgres on a modern box handles ~100K QPS and multi-TB data. Most companies never
            need more. Sharding adds an order of magnitude of operational complexity; do it
            when you have the numbers to prove you need it, not when you fear needing it.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Picking by hype rather than workload</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            "Netflix uses Cassandra so we should too." Netflix also has a team of distributed-
            systems engineers dedicated to running Cassandra. Pick for your workload and your
            team's experience, not for prestige.
          </p>
        </div>

        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold">Missing backups / untested restores</p>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Every database has a backup story. It works until you try to restore for real. Do
            quarterly fire drills: restore a production snapshot to a scratch environment and
            measure the RTO. Databases that "can't be backed up" (ephemeral Redis without AOF)
            must not hold primary data.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The ultimate rule:</strong> a database choice
          is mostly a bet on <em>which problems you want to have</em>. Postgres gives you
          boring, well-documented problems. Cassandra gives you scaling problems. ClickHouse
          gives you ingestion-pipeline problems. Pick the problems you are best equipped to
          solve, not the ones you hope never to have.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DatabasesDeepDive() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Databases Deep Dive</h1>
        <p className="text-lg text-gray-400">
          Postgres, MySQL, MongoDB, Redis, Cassandra, ScyllaDB, DynamoDB, RocksDB, ClickHouse,
          Elasticsearch, CockroachDB — how each stores data, what it's fast at, where it hurts,
          and when to reach for it.
        </p>
      </header>

      <IntroSection />
      <DimensionsSection />
      <LandscapeSection />
      <StorageEngineSection />
      <RowVsColumnarSection />
      <PostgresMySQLSection />
      <MongoSection />
      <RedisSection />
      <CassandraScyllaSection />
      <DynamoSection />
      <ConsistentHashingSection />
      <RocksDBSection />
      <ColumnarSection />
      <SpecialtySection />
      <NewSQLSection />
      <DecisionSection />
      <PitfallsSection />
    </div>
  )
}
