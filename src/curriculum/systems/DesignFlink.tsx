import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-flink',
  title: 'Design Apache Flink',
  description:
    'Stream processing at scale: job graph, event time and watermarks, windowing, stateful operators, checkpointing, and exactly-once guarantees',
  track: 'systems',
  order: 25,
  tags: [
    'flink',
    'stream-processing',
    'event-time',
    'watermarks',
    'checkpointing',
    'exactly-once',
    'stateful',
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
        Design a <strong className="text-white">distributed stream processing engine</strong> that
        consumes unbounded event streams, maintains per-key state across events, computes windowed
        aggregates on <em>event time</em> (not wall-clock time), survives node failures without
        duplicating output, and scales from a laptop to thousands of cores. This is Apache Flink:
        the engine behind Alibaba's Singles Day analytics, Netflix's real-time billing, and
        Uber's surge pricing.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The hard parts are not just throughput. They are:{' '}
        <strong className="text-white">events arrive out of order</strong> (the phone sending a
        pageview was in a tunnel for two minutes);{' '}
        <strong className="text-white">state must survive failures</strong> (an hour-long session
        window cannot restart from scratch);{' '}
        <strong className="text-white">outputs must be exactly-once</strong> (a payment event
        must debit the wallet exactly once even if a TaskManager crashes mid-flush). Flink's
        design is an answer to these three problems, all at once.
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
        <li><strong className="text-white">Ingest unbounded streams</strong> from Kafka, Kinesis, Pulsar, files, sockets, CDC sources</li>
        <li><strong className="text-white">Stateless transformations:</strong> map, filter, flatMap, union</li>
        <li><strong className="text-white">Stateful transformations:</strong> keyBy → aggregate / reduce / process with user-defined state</li>
        <li><strong className="text-white">Event-time windowing:</strong> tumbling, sliding, session, global windows on event time</li>
        <li><strong className="text-white">Watermarks:</strong> tell operators "no more events with timestamp ≤ T will arrive"</li>
        <li><strong className="text-white">Joins over streams:</strong> interval join, windowed join, temporal table join</li>
        <li><strong className="text-white">Exactly-once sinks:</strong> Kafka, JDBC, filesystems via two-phase commit</li>
        <li><strong className="text-white">Savepoints:</strong> operator-triggered snapshots for upgrades and migration</li>
        <li><strong className="text-white">SQL and Table API</strong> on top of the DataStream API</li>
        <li><strong className="text-white">CEP (Complex Event Processing):</strong> pattern matching on streams</li>
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
              <td className="py-2 px-4 font-medium">End-to-end latency</td>
              <td className="py-2 px-4">Milliseconds (sub-second p99 with small checkpoint interval)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Throughput</td>
              <td className="py-2 px-4">Millions of events/sec per job across the cluster</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Delivery guarantee</td>
              <td className="py-2 px-4">Exactly-once (with supported sources/sinks); at-least-once otherwise</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">State size</td>
              <td className="py-2 px-4">TB per job (RocksDB backend, off-heap)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Fault tolerance</td>
              <td className="py-2 px-4">Recovery in &lt;1 minute via incremental checkpoints to S3/HDFS</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Correctness under out-of-order events</td>
              <td className="py-2 px-4">Event-time semantics with watermarks + allowed lateness</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Rescaling</td>
              <td className="py-2 px-4">Change parallelism without data loss via key groups</td>
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
        <p className="text-white font-bold font-sans">Workload: real-time clickstream aggregation</p>
        <p>1B events/day = <span className="text-green-400">~12K events/sec avg, ~50K peak</span></p>
        <p>Avg event size 500B → <span className="text-green-400">~25 MB/s ingress at peak</span></p>

        <p className="text-white font-bold font-sans pt-2">State sizing</p>
        <p>100M distinct users × 2KB session state = <span className="text-green-400">200 GB keyed state</span></p>
        <p>+ 24h of windowed counts × 10M keys × 100B = <span className="text-green-400">~1 TB window state</span></p>
        <p>RocksDB off-heap with SSDs → fits on 10 TaskManagers × 128 GB RAM + 1 TB NVMe each</p>

        <p className="text-white font-bold font-sans pt-2">Checkpointing</p>
        <p>Incremental checkpoint every 30s → diff size ~2% of state = <span className="text-yellow-400">~20 GB / 30s</span></p>
        <p>S3 write throughput: ~200 MB/s per TaskManager → <span className="text-yellow-400">10s to flush</span></p>

        <p className="text-white font-bold font-sans pt-2">Parallelism</p>
        <p>Target 50K events/sec peak ÷ 5K events/sec per slot = <span className="text-green-400">~10 parallel slots</span></p>
        <p>Typical: 10 TaskManagers × 4 slots = <span className="text-green-400">40-way parallelism</span></p>
        <p>4x headroom for bursts and recovery</p>

        <p className="text-white font-bold font-sans pt-2">Cluster cost</p>
        <p>10 × r5.4xlarge (16 vCPU, 128 GB) = <span className="text-yellow-400">~$7K/month on-demand</span></p>
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
      <h2 className="text-2xl font-bold text-white">5. API Design (DataStream)</h2>
      <p className="text-gray-300 leading-relaxed">
        Flink's DataStream API reads like a chain of transformations. Each call returns a new
        stream; Flink compiles the chain into a dataflow graph (operators and edges) and
        schedules it on the cluster.
      </p>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-2">
        <p className="text-white font-bold">// Build the job graph</p>
        <p>env = StreamExecutionEnvironment.getExecutionEnvironment()</p>
        <p>env.enableCheckpointing(30_000)   <span className="text-gray-500">// every 30s</span></p>
        <p>env.getCheckpointConfig().setCheckpointingMode(EXACTLY_ONCE)</p>

        <p className="text-white font-bold pt-2">// Source: Kafka</p>
        <p>clicks = env</p>
        <p>  .fromSource(KafkaSource.builder()&#46;build(), watermarkStrategy, &quot;clicks&quot;)</p>
        <p>  .assignTimestampsAndWatermarks(</p>
        <p>    WatermarkStrategy.forBoundedOutOfOrderness(Duration.ofSeconds(5))</p>
        <p>  )</p>

        <p className="text-white font-bold pt-2">// Transform: keyBy + window + aggregate</p>
        <p>perUser = clicks</p>
        <p>  .keyBy(click -&gt; click.userId)</p>
        <p>  .window(TumblingEventTimeWindows.of(Time.minutes(5)))</p>
        <p>  .aggregate(new ClickCount())</p>

        <p className="text-white font-bold pt-2">// Sink: Kafka with exactly-once</p>
        <p>perUser.sinkTo(</p>
        <p>  KafkaSink.builder()</p>
        <p>    .setDeliveryGuarantee(EXACTLY_ONCE)</p>
        <p>    .setTransactionalIdPrefix(&quot;click-agg&quot;)</p>
        <p>    .build()</p>
        <p>)</p>

        <p className="text-white font-bold pt-2">// Submit</p>
        <p>env.execute(&quot;click-aggregation&quot;)</p>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">
        Same job in <strong className="text-white">Flink SQL</strong>:
        <code className="ml-2 text-pink-400 bg-gray-900 px-2 py-1 rounded">
          SELECT userId, TUMBLE_START(ts, INTERVAL '5' MINUTE), COUNT(*) FROM clicks GROUP BY userId, TUMBLE(ts, INTERVAL '5' MINUTE)
        </code>
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Job Graph                                             */
/* ================================================================== */

function JobGraphSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Logical job graph → parallel execution graph', w / 2, 22, 12, [255, 255, 255])

      // Operator positions (logical)
      const ops = [
        { name: 'Source\n(Kafka)', x: w * 0.1, par: 4, color: [100, 180, 255] as RGB },
        { name: 'Map\n(parse)', x: w * 0.3, par: 4, color: [120, 220, 140] as RGB },
        { name: 'keyBy\n(userId)', x: w * 0.5, par: 1, color: [255, 200, 100] as RGB, isShuffle: true },
        { name: 'Window\n(5min)', x: w * 0.7, par: 4, color: [220, 140, 255] as RGB },
        { name: 'Sink\n(Kafka)', x: w * 0.9, par: 2, color: [255, 140, 180] as RGB },
      ]

      // Draw each operator with subtasks stacked vertically
      const baseY = 180
      const taskH = 22
      const taskW = 100
      const taskGap = 6

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i]
        if (op.isShuffle) {
          // keyBy is a shuffle boundary, not an operator box
          drawLabel(p, '── keyBy shuffle ──', op.x, baseY, 9, [255, 200, 100])
          drawLabel(p, 'hash(userId) % N', op.x, baseY + 16, 7, [200, 170, 120])
          continue
        }
        const totalH = op.par * taskH + (op.par - 1) * taskGap
        const startY = baseY - totalH / 2
        for (let j = 0; j < op.par; j++) {
          const y = startY + j * (taskH + taskGap) + taskH / 2
          drawBox(
            p,
            op.x,
            y,
            taskW,
            taskH,
            [op.color[0] * 0.2, op.color[1] * 0.2, op.color[2] * 0.2],
            op.color,
            `${op.name.split('\n')[0]} #${j + 1}`,
            7.5,
          )
        }
        // Operator label above
        drawLabel(p, op.name.split('\n')[0], op.x, startY - 20, 10, [255, 255, 255])
        drawLabel(p, op.name.split('\n')[1] ?? '', op.x, startY - 8, 8, [200, 200, 200])
        drawLabel(p, `parallelism = ${op.par}`, op.x, startY + totalH + 24, 8, op.color)
      }

      // Forward edges (source -> map): 1-to-1, kept together
      const source = ops[0]
      const map = ops[1]
      for (let j = 0; j < 4; j++) {
        const y = baseY - (4 * taskH + 3 * taskGap) / 2 + j * (taskH + taskGap) + taskH / 2
        drawArrow(p, source.x + taskW / 2, y, map.x - taskW / 2, y, [100, 180, 255, 120])
        const prog = ((t * 0.7 + j * 0.1) % 1)
        drawMovingDot(p, source.x + taskW / 2, y, map.x - taskW / 2, y, prog, [120, 200, 255], 5)
      }

      // Shuffle edges (map -> window): all-to-all via keyBy
      const window = ops[3]
      for (let src = 0; src < 4; src++) {
        const srcY = baseY - (4 * taskH + 3 * taskGap) / 2 + src * (taskH + taskGap) + taskH / 2
        for (let dst = 0; dst < 4; dst++) {
          const dstY = baseY - (4 * taskH + 3 * taskGap) / 2 + dst * (taskH + taskGap) + taskH / 2
          drawArrow(p, map.x + taskW / 2, srcY, window.x - taskW / 2, dstY, [255, 200, 100, 50])
        }
        const prog = ((t * 0.5 + src * 0.15) % 1)
        const targetDst = src // visualize one active path per source
        const dstY = baseY - (4 * taskH + 3 * taskGap) / 2 + targetDst * (taskH + taskGap) + taskH / 2
        drawMovingDot(
          p,
          map.x + taskW / 2,
          srcY,
          window.x - taskW / 2,
          dstY,
          prog,
          [255, 220, 130],
          5,
        )
      }

      // Forward-ish edges (window -> sink): rebalance (4 -> 2)
      const sink = ops[4]
      for (let src = 0; src < 4; src++) {
        const srcY = baseY - (4 * taskH + 3 * taskGap) / 2 + src * (taskH + taskGap) + taskH / 2
        const dst = src % 2
        const dstY = baseY - (2 * taskH + 1 * taskGap) / 2 + dst * (taskH + taskGap) + taskH / 2
        drawArrow(p, window.x + taskW / 2, srcY, sink.x - taskW / 2, dstY, [220, 140, 255, 100])
        const prog = ((t * 0.6 + src * 0.12) % 1)
        drawMovingDot(
          p,
          window.x + taskW / 2,
          srcY,
          sink.x - taskW / 2,
          dstY,
          prog,
          [220, 160, 255],
          5,
        )
      }

      // Footer
      drawLabel(
        p,
        'Edges: forward (1-to-1) • shuffle (hash by key) • rebalance (round-robin to lower parallelism)',
        w / 2,
        335,
        8,
        [180, 180, 180],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Data Model — The Job Graph</h2>
      <p className="text-gray-300 leading-relaxed">
        A Flink program compiles into a <strong className="text-white">dataflow graph</strong>: a
        DAG of operators connected by edges. Each operator has a configurable{' '}
        <strong className="text-white">parallelism</strong>; at runtime each operator becomes N
        parallel <em>subtasks</em>, and edges become one of three shapes.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Forward (1-to-1)</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Same parallelism on both sides, events stay on the same slot. Flink{' '}
            <em>chains</em> these together so there is no serialization between them — just a
            function call. Huge throughput win.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Shuffle (keyBy)</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Every upstream subtask can send to every downstream subtask. The hash of the key
            decides the target. This is where network cost and per-key ordering enter the
            picture.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Rebalance / Rescale</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Round-robin to a different parallelism (e.g. 4 → 2 for a slower sink) or distribute
            evenly when upstream is skewed. No key affinity.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Architecture                                          */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 460)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      drawLabel(p, 'Flink cluster: JobManager + TaskManagers with slots', w / 2, 22, 12, [255, 255, 255])

      // Client
      const clientX = w * 0.5
      drawBox(p, clientX, 62, 150, 30, [30, 30, 50], [160, 160, 200], 'Client (job submitter)', 9)

      // JobManager
      const jmX = w * 0.5
      const jmY = 150
      const jmW = 260
      const jmH = 64
      p.fill(40, 30, 60)
      p.stroke(200, 140, 255)
      p.strokeWeight(2)
      p.rect(jmX - jmW / 2, jmY - jmH / 2, jmW, jmH, 8)
      drawLabel(p, 'JobManager (coordinator)', jmX, jmY - 16, 11, [220, 180, 255])
      drawLabel(p, 'Dispatcher  •  ResourceManager', jmX, jmY + 2, 8, [200, 160, 220])
      drawLabel(p, 'JobMaster  •  Checkpoint Coordinator', jmX, jmY + 16, 8, [200, 160, 220])

      // Client -> JobManager
      drawArrow(p, clientX, 77, jmX, jmY - jmH / 2, [160, 160, 200, 160])
      drawLabel(p, 'submit', clientX + 60, (77 + jmY - jmH / 2) / 2, 8, [180, 180, 200])

      // TaskManagers (3)
      const tmCount = 3
      const tmY = 330
      const tmW = 200
      const tmH = 130

      for (let i = 0; i < tmCount; i++) {
        const tmX = w * (0.2 + i * 0.3)
        // TM frame
        p.fill(25, 40, 25)
        p.stroke(120, 220, 140)
        p.strokeWeight(2)
        p.rect(tmX - tmW / 2, tmY - tmH / 2, tmW, tmH, 8)
        drawLabel(p, `TaskManager ${i + 1}`, tmX, tmY - tmH / 2 + 14, 10, [180, 240, 200])

        // Slots within TM (2x2 grid)
        const slotW = 78
        const slotH = 40
        for (let s = 0; s < 4; s++) {
          const sx = tmX - slotW + (s % 2) * (slotW + 6)
          const sy = tmY - 5 + Math.floor(s / 2) * (slotH + 6)

          // Slot body
          const active = ((t * 1.5 + i + s * 0.3) % 2) < 1.6
          const slotColor: RGB = active ? [140, 220, 140] : [80, 100, 80]
          p.fill(20, 35, 25)
          p.stroke(slotColor[0], slotColor[1], slotColor[2])
          p.strokeWeight(1)
          p.rect(sx, sy, slotW, slotH, 4)
          drawLabel(p, `slot ${s + 1}`, sx + slotW / 2, sy + 9, 7, [180, 220, 200])

          // Running subtask label
          if (active) {
            const opNames = ['src', 'map', 'win', 'sink']
            drawLabel(p, opNames[s], sx + slotW / 2, sy + 26, 9, slotColor)
          } else {
            drawLabel(p, '(idle)', sx + slotW / 2, sy + 26, 7, [120, 140, 120])
          }
        }

        // JobManager -> TaskManager control
        drawArrow(p, jmX - 30 + i * 30, jmY + jmH / 2, tmX, tmY - tmH / 2, [200, 140, 255, 100])
        // TM -> JM heartbeat
        const hbProg = ((t * 0.8 + i * 0.3) % 1)
        drawMovingDot(p, tmX, tmY - tmH / 2, jmX - 30 + i * 30, jmY + jmH / 2, hbProg, [160, 220, 180], 5)
      }

      // Heartbeat label
      drawLabel(p, 'control: deploy, heartbeat, checkpoint triggers, metrics', w / 2, 250, 9, [200, 170, 220])

      // Data flow between TMs (shuffle network)
      const tm1x = w * 0.2
      const tm2x = w * 0.5
      const tm3x = w * 0.8
      const shuffleY = tmY + tmH / 2 - 10
      p.stroke(100, 180, 255, 100)
      p.strokeWeight(1.2)
      const dash = p.drawingContext as CanvasRenderingContext2D
      dash.setLineDash([4, 3])
      p.line(tm1x + 90, shuffleY, tm2x - 90, shuffleY)
      p.line(tm2x + 90, shuffleY, tm3x - 90, shuffleY)
      dash.setLineDash([])
      drawLabel(p, 'shuffle network (Netty)', w / 2, shuffleY + 18, 8, [140, 180, 220])

      // Footer
      drawLabel(
        p,
        'Scaling: add more TaskManagers. Each TM has a fixed number of slots; total parallelism = sum of slots.',
        w / 2,
        440,
        8,
        [180, 180, 180],
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        A Flink cluster has two process types: one{' '}
        <strong className="text-white">JobManager</strong> (HA-capable, with standby leaders) that
        coordinates, and many <strong className="text-white">TaskManagers</strong> that execute.
        Each TaskManager exposes a fixed number of <strong className="text-white">slots</strong>;
        each subtask runs in a slot.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">JobManager components</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><strong className="text-white">Dispatcher:</strong> receives job submissions; spawns a JobMaster per job</li>
            <li><strong className="text-white">JobMaster:</strong> deploys tasks, tracks status, triggers checkpoints for one job</li>
            <li><strong className="text-white">ResourceManager:</strong> acquires slots from TaskManagers (or from YARN/K8s)</li>
            <li><strong className="text-white">Checkpoint Coordinator:</strong> injects barriers, records global checkpoints</li>
            <li><strong className="text-white">HA storage (ZK/K8s):</strong> leader election + job graph persistence</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">TaskManager components</p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><strong className="text-white">Task slots:</strong> units of parallelism; one CPU thread each (by default)</li>
            <li><strong className="text-white">Network stack (Netty):</strong> shuffles data between subtasks across TMs</li>
            <li><strong className="text-white">Memory manager:</strong> off-heap memory for network buffers, RocksDB, sorting</li>
            <li><strong className="text-white">State backend:</strong> HashMap (heap) or RocksDB (off-heap, incremental CP)</li>
            <li><strong className="text-white">Metrics + actor system:</strong> heartbeats, logs, Prometheus reporter</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Slot sharing:</strong> Flink can co-locate subtasks
          from <em>different</em> operators in one slot (default behavior). A pipeline{' '}
          <code className="text-pink-400">source → map → sink</code> with parallelism 4 needs only 4
          slots, not 12. This turns forward edges into in-process function calls and is the single
          biggest reason Flink is fast.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Event Time and Watermarks                             */
/* ================================================================== */

function EventTimeSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      p.background(15, 15, 25)

      drawLabel(p, 'Event time vs processing time: the watermark story', w / 2, 22, 12, [255, 255, 255])

      const timelineY1 = 120 // event-time timeline (upper)
      const timelineY2 = 310 // processing-time timeline (lower)
      const startX = 40
      const endX = w - 40

      // Timeline axes
      p.stroke(140, 140, 180)
      p.strokeWeight(1.5)
      p.line(startX, timelineY1, endX, timelineY1)
      p.line(startX, timelineY2, endX, timelineY2)

      // Axis labels near the right end of each timeline (clear of watermark zone on the left)
      drawLabel(p, 'event time  (when it happened) →', endX, timelineY1 - 14, 10, [200, 200, 255], 'right')
      drawLabel(p, 'processing time  (when Flink saw it) →', endX, timelineY2 + 20, 10, [200, 200, 255], 'right')

      // Tick marks
      for (let i = 0; i <= 10; i++) {
        const x = startX + (i / 10) * (endX - startX)
        p.stroke(120, 120, 160)
        p.strokeWeight(1)
        p.line(x, timelineY1 - 4, x, timelineY1 + 4)
        p.line(x, timelineY2 - 4, x, timelineY2 + 4)
        drawLabel(p, `t${i}`, x, timelineY1 + 14, 7, [140, 140, 180])
        drawLabel(p, `t${i}`, x, timelineY2 - 14, 7, [140, 140, 180])
      }

      // Events with (event_time, arrival_time)
      // Show out-of-order arrivals
      type Ev = { et: number; at: number; color: RGB; label: string }
      const events: Ev[] = [
        { et: 1, at: 1, color: [120, 220, 140], label: 'A' },
        { et: 2, at: 3, color: [100, 180, 255], label: 'B' },
        { et: 5, at: 4, color: [255, 180, 100], label: 'C' },
        { et: 3, at: 5.5, color: [220, 140, 255], label: 'D (late!)' },
        { et: 6, at: 6, color: [255, 140, 180], label: 'E' },
        { et: 4, at: 7, color: [140, 220, 220], label: 'F (late!)' },
        { et: 8, at: 8.5, color: [220, 220, 140], label: 'G' },
      ]

      // Watermark: follows the max event time seen minus out-of-orderness allowance
      const nowIdx = Math.min(events.length, Math.floor((t * 0.8) % (events.length + 2)))
      const visible = events.slice(0, nowIdx)

      const allowedLateness = 2
      let maxEt = 0
      for (const e of visible) maxEt = Math.max(maxEt, e.et)
      const watermark = Math.max(0, maxEt - allowedLateness)

      // Draw watermark line on event-time axis (vertical)
      const wmX = startX + (watermark / 10) * (endX - startX)
      p.stroke(255, 100, 100)
      p.strokeWeight(2)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([6, 4])
      p.line(wmX, timelineY1 - 40, wmX, timelineY1 + 40)
      ctx.setLineDash([])
      drawLabel(p, `W = ${watermark}`, wmX, timelineY1 - 48, 9, [255, 120, 120])
      drawLabel(p, 'watermark', wmX, timelineY1 - 36, 8, [255, 150, 150])

      // Draw events: dot on event-time, dot on processing-time, connected by arrow
      for (const e of visible) {
        const etX = startX + (e.et / 10) * (endX - startX)
        const atX = startX + (e.at / 10) * (endX - startX)

        // Processing-time dot (always "on time" at its arrival)
        p.fill(e.color[0], e.color[1], e.color[2])
        p.noStroke()
        p.ellipse(atX, timelineY2, 12, 12)
        p.fill(10, 10, 15)
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(8)
        p.text(e.label.charAt(0), atX, timelineY2)

        // Event-time dot
        p.fill(e.color[0], e.color[1], e.color[2], 180)
        p.noStroke()
        p.ellipse(etX, timelineY1, 12, 12)
        p.fill(10, 10, 15)
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(8)
        p.text(e.label.charAt(0), etX, timelineY1)

        // Connect them with a curve: event-time dot ↘ processing-time dot
        p.stroke(e.color[0], e.color[1], e.color[2], 120)
        p.strokeWeight(1.2)
        p.noFill()
        p.beginShape()
        p.vertex(etX, timelineY1 + 7)
        p.bezierVertex(etX, timelineY1 + 60, atX, timelineY2 - 60, atX, timelineY2 - 7)
        p.endShape()

        // Label late events
        if (e.et < watermark) {
          drawLabel(p, 'LATE', etX, timelineY1 + 28, 7, [255, 120, 120])
        }
      }

      // Explanation panel
      p.fill(30, 30, 50, 200)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(startX, 365, endX - startX, 45, 6)
      drawLabel(p, 'Watermark W(t) = max observed event-time − allowed out-of-orderness', w / 2, 378, 9, [255, 220, 160])
      drawLabel(p, 'An event with event_time < W is "late". Windows with end_time ≤ W are closed.', w / 2, 394, 9, [200, 200, 200])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Event Time &amp; Watermarks</h2>
      <p className="text-gray-300 leading-relaxed">
        The central insight of Flink: a stream has <em>two</em> clocks.{' '}
        <strong className="text-white">Event time</strong> is when the thing happened in the real
        world (embedded in the event as a timestamp).{' '}
        <strong className="text-white">Processing time</strong> is when Flink saw it. Events can
        be late, reordered, or arrive in bursts after a network partition. If windowing used
        processing time, a 5-minute window would have different contents depending on how laggy
        the network was — which is wrong.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <p className="text-white font-semibold text-sm mb-2">What a watermark is</p>
        <p className="text-gray-300 text-sm leading-relaxed">
          A <strong className="text-white">watermark W</strong> is a declaration flowing through
          the stream: "all events with <code className="text-pink-400">event_time ≤ W</code> have
          arrived; you may now close any window that ends before W." Watermarks are generated at
          sources (typically as "max-event-time-seen − maxOutOfOrderness"), propagated through
          operators, and hold back the lowest of all incoming watermarks at joins. A window
          emits exactly when the watermark crosses its end.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-yellow-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">The correctness-latency tradeoff</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Aggressive watermarks (small maxOutOfOrderness) emit results fast but drop more late
            events. Conservative watermarks wait longer — lower latency no more, but the count
            is more accurate. You pick the point on this curve per job.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-emerald-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Handling lateness</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Flink has three knobs for late events:{' '}
            <strong className="text-white">allowedLateness</strong> (keep the window open past
            its end for N more time units),{' '}
            <strong className="text-white">side outputs</strong> (route anything too-late to a
            separate stream), and{' '}
            <strong className="text-white">idle source detection</strong> (don't let a silent
            partition stall the watermark).
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Windowing                                             */
/* ================================================================== */

function WindowingSection() {
  const [windowType, setWindowType] = useState<'tumbling' | 'sliding' | 'session'>('tumbling')
  const typeRef = useRef(windowType)
  typeRef.current = windowType

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.008
      p.background(15, 15, 25)

      const wt = typeRef.current
      drawLabel(
        p,
        wt === 'tumbling'
          ? 'Tumbling windows: fixed size, non-overlapping'
          : wt === 'sliding'
          ? 'Sliding windows: fixed size, overlapping'
          : 'Session windows: dynamic, gap-based',
        w / 2,
        22,
        12,
        [255, 255, 255],
      )

      const tlY = 200
      const startX = 70
      const endX = w - 40
      const span = endX - startX

      // Timeline
      p.stroke(140, 140, 180)
      p.strokeWeight(1.5)
      p.line(startX, tlY, endX, tlY)
      drawLabel(p, 'event time →', endX + 12, tlY, 9, [180, 180, 200], 'left')

      // Ticks every 1 "minute"
      for (let i = 0; i <= 12; i++) {
        const x = startX + (i / 12) * span
        p.stroke(120, 120, 160)
        p.strokeWeight(1)
        p.line(x, tlY - 4, x, tlY + 4)
        if (i % 2 === 0) drawLabel(p, `${i}m`, x, tlY + 16, 7, [140, 140, 180])
      }

      // Events (jittered on timeline)
      type Ev = { et: number; userId: string }
      const events: Ev[] = [
        { et: 0.5, userId: 'A' },
        { et: 1.2, userId: 'B' },
        { et: 1.8, userId: 'A' },
        { et: 2.5, userId: 'A' },
        { et: 3.5, userId: 'B' },
        { et: 4.1, userId: 'A' },
        { et: 4.6, userId: 'A' },
        { et: 7.5, userId: 'B' },
        { et: 7.9, userId: 'B' },
        { et: 8.3, userId: 'B' },
        { et: 10.5, userId: 'A' },
        { et: 11.2, userId: 'A' },
      ]

      // Animate: up to some visible prefix
      const cutoff = ((t * 2) % 14)
      const visible = events.filter((e) => e.et < cutoff)

      for (const e of visible) {
        const x = startX + (e.et / 12) * span
        const color: RGB = e.userId === 'A' ? [120, 220, 140] : [255, 180, 100]
        p.fill(color[0], color[1], color[2])
        p.noStroke()
        p.ellipse(x, tlY - 25, 11, 11)
        drawLabel(p, e.userId, x, tlY - 25, 7, [20, 20, 20])
      }

      // Draw windows
      const drawWindow = (a: number, b: number, color: RGB, label: string, row = 0) => {
        const x1 = startX + (a / 12) * span
        const x2 = startX + (b / 12) * span
        const y = tlY + 40 + row * 40
        p.fill(color[0], color[1], color[2], 40)
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(1.5)
        p.rect(x1, y - 14, x2 - x1, 28, 4)
        drawLabel(p, label, (x1 + x2) / 2, y, 8, [255, 255, 255])
      }

      if (wt === 'tumbling') {
        // Tumbling 3-minute windows
        const size = 3
        for (let i = 0; i < 4; i++) {
          const a = i * size
          const b = a + size
          if (a > 12) break
          drawWindow(a, b, [100, 180, 255], `[${a}m, ${b}m)`, 0)
        }
        drawLabel(p, 'window(3m) — each event in exactly one window', w / 2, 310, 10, [180, 220, 255])
      } else if (wt === 'sliding') {
        // Sliding 4-minute windows every 2 minutes
        const size = 4
        const slide = 2
        let row = 0
        for (let start = 0; start <= 10; start += slide) {
          drawWindow(start, start + size, [180, 140, 255], `[${start}m, ${start + size}m)`, row % 2)
          row++
        }
        drawLabel(p, 'window(size=4m, slide=2m) — events in multiple windows', w / 2, 310, 10, [220, 200, 255])
      } else {
        // Session windows: gap = 2 minutes between events of same key
        // Group events by key, form sessions
        const gap = 2
        const byKey: Record<string, number[]> = {}
        for (const e of visible) {
          byKey[e.userId] ??= []
          byKey[e.userId].push(e.et)
        }
        const colors: Record<string, RGB> = { A: [120, 220, 140], B: [255, 180, 100] }
        let row = 0
        for (const key of Object.keys(byKey)) {
          const ets = byKey[key].sort((a, b) => a - b)
          let start = ets[0]
          let last = ets[0]
          for (let i = 1; i < ets.length; i++) {
            if (ets[i] - last > gap) {
              drawWindow(start, last + 0.2, colors[key], `${key}: session`, row)
              start = ets[i]
            }
            last = ets[i]
          }
          drawWindow(start, last + 0.2, colors[key], `${key}: session`, row)
          row++
        }
        drawLabel(p, 'session(gap=2m) — per-key windows that close after 2m of inactivity', w / 2, 310, 10, [220, 220, 180])
      }

      // Advance indicator
      const cutoffX = startX + (cutoff / 12) * span
      p.stroke(255, 200, 80)
      p.strokeWeight(2)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 3])
      p.line(cutoffX, tlY - 60, cutoffX, tlY + 150)
      ctx.setLineDash([])
      drawLabel(p, 'watermark →', cutoffX, tlY - 66, 8, [255, 220, 120])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Windowing</h2>
      <p className="text-gray-300 leading-relaxed">
        A window is "a bucket of events defined by time." Flink has three built-in shapes, and
        understanding when to use which is most of the skill of writing stream jobs.
      </p>

      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 mr-2">Window type:</span>
            {(['tumbling', 'sliding', 'session'] as const).map((wt) => (
              <button
                key={wt}
                onClick={() => setWindowType(wt)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  windowType === wt
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {wt}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Tumbling</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Fixed size, no overlap, every event in exactly one window. Use for{' '}
            <em>aligned</em> time buckets: hourly revenue, daily active users. The default choice
            when business logic says "per interval".
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-purple-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Sliding</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Fixed size, overlaps every `slide` units. Use for rolling metrics: "5-minute average
            CPU reported every 30 seconds." Every event lands in{' '}
            <code className="text-pink-400">size / slide</code> windows — state multiplies, watch
            memory.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-amber-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Session</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            Per-key, dynamic boundaries: window closes after N seconds of inactivity. Use for
            user sessions, game matches, transaction bursts. Windows have no fixed size or
            alignment — Flink merges them as events arrive.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- State Management                                     */
/* ================================================================== */

function StateSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. State &amp; State Backends</h2>
      <p className="text-gray-300 leading-relaxed">
        Every non-trivial stream job is stateful. A "count per user per 5-minute window"
        job is really "for each userId I have just seen, read the running count, add one, write
        it back." State is the variable that lives inside an operator between events.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Keyed state (the common case)</p>
          <p className="text-gray-300 text-xs leading-relaxed mb-2">
            Exists per key after a <code className="text-pink-400">keyBy</code>. The runtime
            scopes reads/writes to the current key automatically. Types:
          </p>
          <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 leading-relaxed">
            <li><code className="text-pink-400">ValueState&lt;T&gt;</code> — single value</li>
            <li><code className="text-pink-400">ListState&lt;T&gt;</code> — append-only list</li>
            <li><code className="text-pink-400">MapState&lt;K,V&gt;</code> — nested map</li>
            <li><code className="text-pink-400">ReducingState</code>, <code className="text-pink-400">AggregatingState</code> — with a built-in reducer</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <p className="text-white font-semibold text-sm mb-2">Operator state (broadcast, source offsets)</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Scoped to a subtask instance, not a key. The canonical use is source offsets
            (Kafka consumer tracking per-partition offsets) and broadcast state (small config
            streams replicated to every subtask). Redistribution strategies on rescale:{' '}
            <em>even-split</em>, <em>broadcast</em>, or <em>union</em>.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">State backend</th>
              <th className="py-2 px-4 text-white">Storage</th>
              <th className="py-2 px-4 text-white">Access speed</th>
              <th className="py-2 px-4 text-white">State size limit</th>
              <th className="py-2 px-4 text-white">Checkpoint mode</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-green-400">HashMap (heap)</td>
              <td className="py-2 px-4">JVM heap (Java objects)</td>
              <td className="py-2 px-4">Fastest (pointer deref)</td>
              <td className="py-2 px-4">Bounded by heap</td>
              <td className="py-2 px-4">Full snapshot</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium text-blue-400">RocksDB</td>
              <td className="py-2 px-4">Off-heap LSM on local disk</td>
              <td className="py-2 px-4">Slower (deserialize per read)</td>
              <td className="py-2 px-4">Multi-TB (SSD-bounded)</td>
              <td className="py-2 px-4">Incremental (SSTable diffs)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">RocksDB is the default for production.</strong>{' '}
          The incremental-checkpoint story is the real reason: you upload only the{' '}
          <em>changed</em> SSTable files to S3, not the full state. A job with 1 TB of state can
          still checkpoint in seconds because typically only a few GB of SSTables changed since
          the last checkpoint.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Checkpointing / Exactly-Once                         */
/* ================================================================== */

function CheckpointSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 460)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.010
      p.background(15, 15, 25)

      drawLabel(p, 'Checkpoint barriers flow with the data (Chandy-Lamport style)', w / 2, 22, 12, [255, 255, 255])

      // Operators positions
      const opX = [w * 0.12, w * 0.35, w * 0.58, w * 0.82]
      const opY = 180
      const opNames = ['Source\n(Kafka)', 'Map', 'Window', 'Sink\n(Kafka)']
      const opColors: RGB[] = [
        [100, 180, 255],
        [120, 220, 140],
        [220, 140, 255],
        [255, 180, 100],
      ]

      // Draw operators
      for (let i = 0; i < 4; i++) {
        drawBox(p, opX[i], opY, 110, 44, [opColors[i][0] * 0.2, opColors[i][1] * 0.2, opColors[i][2] * 0.2], opColors[i], opNames[i].split('\n')[0], 10)
        drawLabel(p, opNames[i].split('\n')[1] ?? '', opX[i], opY + 14, 8, [200, 200, 200])
      }

      // Edges
      for (let i = 0; i < 3; i++) {
        drawArrow(p, opX[i] + 55, opY, opX[i + 1] - 55, opY, [140, 140, 180, 140])
      }

      // JobManager (checkpoint coordinator)
      const jmX = w * 0.5
      const jmY = 70
      drawBox(p, jmX, jmY, 200, 36, [40, 30, 60], [200, 140, 255], 'Checkpoint Coordinator', 10)

      // Trigger arrow from JM to source
      drawArrow(p, jmX - 80, jmY + 18, opX[0] + 10, opY - 25, [200, 140, 255, 180])
      drawLabel(p, 'trigger CP n', (jmX - 80 + opX[0] + 10) / 2 - 20, (jmY + 18 + opY - 25) / 2, 8, [220, 180, 255])

      // Barriers as moving vertical bars
      // Barrier n is injected by the source and flows through all operators
      const barrierCycle = 6 // seconds
      const phase = (t % barrierCycle) / barrierCycle
      const barrierProgress = phase * 3 // 0..3 covers src -> map -> window -> sink

      for (let b = 0; b < 3; b++) {
        // Each segment of the progress corresponds to one edge
        if (barrierProgress > b && barrierProgress < b + 1) {
          const local = barrierProgress - b
          const x = opX[b] + 55 + (opX[b + 1] - 55 - (opX[b] + 55)) * local
          // Draw the barrier as a bold vertical segment
          p.stroke(255, 80, 80)
          p.strokeWeight(3)
          p.line(x, opY - 30, x, opY + 30)
          drawLabel(p, 'barrier n', x, opY - 36, 8, [255, 120, 120])

          // Data dots behind and ahead of barrier
          for (let d = 0; d < 3; d++) {
            const ahead = local + 0.05 + d * 0.1
            const dProg = ahead - 1
            if (ahead < 1 && ahead > local + 0.02) {
              const dx = opX[b] + 55 + (opX[b + 1] - 55 - (opX[b] + 55)) * ahead
              p.fill(opColors[b][0], opColors[b][1], opColors[b][2])
              p.noStroke()
              p.ellipse(dx, opY, 6, 6)
            }
            void dProg
          }
        }
      }

      // Snapshot state for each operator that has "seen" the barrier
      for (let i = 0; i < 4; i++) {
        const passed = barrierProgress > i
        if (passed) {
          // Draw state snapshot indicator
          p.fill(255, 200, 100, 200)
          p.stroke(255, 200, 100)
          p.strokeWeight(1)
          p.rect(opX[i] - 20, opY + 35, 40, 20, 3)
          drawLabel(p, 'saved', opX[i], opY + 45, 8, [50, 40, 10])

          // Arrow to S3
          const s3Y = 360
          p.stroke(255, 200, 100, 120)
          p.strokeWeight(1)
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.setLineDash([3, 3])
          p.line(opX[i], opY + 55, opX[i], s3Y - 15)
          ctx.setLineDash([])
        }
      }

      // S3 / durable storage
      const s3Y = 360
      drawBox(p, w / 2, s3Y, 240, 36, [30, 45, 30], [120, 220, 140], 'Durable storage (S3 / HDFS)', 10)
      drawLabel(p, 'incremental SSTable uploads per operator per checkpoint', w / 2, s3Y + 28, 8, [180, 220, 180])

      // Caption
      p.fill(30, 30, 50, 200)
      p.stroke(100, 100, 140)
      p.strokeWeight(1)
      p.rect(40, 410, w - 80, 40, 6)
      drawLabel(p, '1. Coordinator triggers CP n at sources. 2. Sources inject barrier n into stream.', w / 2, 424, 9, [220, 220, 180])
      drawLabel(p, '3. When an operator sees barrier n, it snapshots its state and forwards the barrier.', w / 2, 440, 9, [220, 220, 180])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Checkpointing &amp; Exactly-Once</h2>
      <p className="text-gray-300 leading-relaxed">
        Flink's approach to fault tolerance is the <strong className="text-white">barrier
        algorithm</strong> — a variant of the Chandy-Lamport distributed snapshot. The
        Checkpoint Coordinator (on the JobManager) periodically injects a barrier into each
        source. The barrier flows through the job alongside data. When an operator sees the
        barrier on all its input channels, it snapshots its state to durable storage and
        forwards the barrier downstream. When the sink acknowledges the barrier, the checkpoint
        is globally consistent.
      </p>

      <P5Sketch sketch={sketch} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border-l-4 border-red-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Barrier alignment</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            An operator with multiple inputs waits for barrier n on <em>every</em> input before
            snapshotting. Data on already-arrived-barrier channels buffers briefly —{' '}
            <em>aligned</em> mode. For lower latency under backpressure there's{' '}
            <em>unaligned checkpoints</em> that snapshots in-flight buffers instead.
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Recovery</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            On failure: job cancels, state is restored from the last successful checkpoint, and
            sources rewind to the offsets recorded in the checkpoint. Kafka sources rewind via
            stored offsets; files restart at recorded byte positions. Recovery is bounded by
            checkpoint age + startup time (tens of seconds typically).
          </p>
        </div>
        <div className="bg-gray-800/60 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-semibold text-sm">Exactly-once sinks</p>
          <p className="text-gray-300 text-xs mt-2 leading-relaxed">
            The checkpoint only makes <em>internal</em> state exactly-once. For end-to-end
            exactly-once, sinks must participate in a two-phase commit: writes between
            checkpoints go into a transaction that commits only when the checkpoint completes.
            Kafka, JDBC with XA, and S3 with pending-commits support this.
          </p>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-2">
        <p className="text-white font-bold font-sans text-sm">Two-phase commit sink lifecycle</p>
        <p>1. <strong className="text-white">beginTransaction()</strong> — on first write after a checkpoint</p>
        <p>2. <strong className="text-white">invoke(record)</strong> — write records into the open transaction</p>
        <p>3. <strong className="text-white">preCommit()</strong> — when barrier arrives, flush and prepare (pending)</p>
        <p>4. <strong className="text-white">commit()</strong> — after checkpoint is durable, commit all pending transactions</p>
        <p>5. <strong className="text-white">abort()</strong> — on failure before commit, roll back</p>
        <p className="text-gray-500 pt-1">Failure between preCommit and commit is safe: the checkpoint metadata tracks pending transactions and commits them on recovery.</p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- Scaling & Rescaling                                  */
/* ================================================================== */

function RescalingSection() {
  const sketch = useCallback((p: p5) => {
    let w = 900

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 900)
      p.createCanvas(w, 360)
      p.textFont('monospace')
      p.noLoop()
    }

    p.draw = () => {
      p.background(15, 15, 25)

      drawLabel(p, 'Rescaling via key groups: the fixed pre-shard that makes it work', w / 2, 22, 12, [255, 255, 255])

      // Before: parallelism 2
      drawLabel(p, 'Before: parallelism = 2', w * 0.28, 60, 11, [255, 180, 100])
      drawLabel(p, 'After: parallelism = 4', w * 0.72, 60, 11, [120, 220, 140])

      // Key groups row (fixed at max parallelism, e.g. 8)
      const kgCount = 8
      const kgBeforeY = 110
      const kgAfterY = 270
      const kgW = 60
      const kgStartX1 = w * 0.07
      const kgStartX2 = w * 0.53
      const colors: RGB[] = [
        [120, 180, 255],
        [120, 220, 180],
        [255, 200, 120],
        [220, 140, 255],
        [255, 140, 180],
        [180, 220, 220],
        [220, 220, 120],
        [140, 200, 255],
      ]

      // Before: 2 subtasks, each owns 4 key groups
      for (let i = 0; i < kgCount; i++) {
        const x = kgStartX1 + i * (kgW + 4)
        p.fill(colors[i][0] * 0.3, colors[i][1] * 0.3, colors[i][2] * 0.3)
        p.stroke(colors[i][0], colors[i][1], colors[i][2])
        p.strokeWeight(1.2)
        p.rect(x, kgBeforeY, kgW, 34, 3)
        drawLabel(p, `KG ${i}`, x + kgW / 2, kgBeforeY + 17, 8, colors[i])
      }
      // Subtask groupings before
      p.noFill()
      p.stroke(255, 180, 100)
      p.strokeWeight(2)
      p.rect(kgStartX1 - 3, kgBeforeY - 4, 4 * (kgW + 4) + 2, 42, 5)
      p.rect(kgStartX1 - 3 + 4 * (kgW + 4), kgBeforeY - 4, 4 * (kgW + 4) + 2, 42, 5)
      drawLabel(p, 'Subtask 0', kgStartX1 + (kgW + 4) * 2 - (kgW + 4) / 2 + kgW / 2, kgBeforeY + 58, 9, [255, 180, 100])
      drawLabel(p, 'Subtask 1', kgStartX1 + (kgW + 4) * 6 - (kgW + 4) / 2 + kgW / 2, kgBeforeY + 58, 9, [255, 180, 100])

      // After: 4 subtasks, each owns 2 key groups
      for (let i = 0; i < kgCount; i++) {
        const x = kgStartX2 + (i % 4) * (kgW + 4)
        const y = kgAfterY + Math.floor(i / 4) * 40
        p.fill(colors[i][0] * 0.3, colors[i][1] * 0.3, colors[i][2] * 0.3)
        p.stroke(colors[i][0], colors[i][1], colors[i][2])
        p.strokeWeight(1.2)
        p.rect(x, y, kgW, 34, 3)
        drawLabel(p, `KG ${i}`, x + kgW / 2, y + 17, 8, colors[i])
      }
      // Subtask groupings after: pairs of KGs
      // Subtask i owns KG 2i and KG 2i+1
      // Layout: row0 = KG 0-3, row1 = KG 4-7
      // Subtask 0 -> KG 0 (row0 col0) + KG 1 (row0 col1)
      // Subtask 1 -> KG 2 (row0 col2) + KG 3 (row0 col3)
      // Subtask 2 -> KG 4 (row1 col0) + KG 5 (row1 col1)
      // Subtask 3 -> KG 6 (row1 col2) + KG 7 (row1 col3)
      p.noFill()
      p.stroke(120, 220, 140)
      p.strokeWeight(2)
      // Subtask 0
      p.rect(kgStartX2 - 3, kgAfterY - 4, 2 * (kgW + 4) + 2, 42, 5)
      // Subtask 1
      p.rect(kgStartX2 - 3 + 2 * (kgW + 4), kgAfterY - 4, 2 * (kgW + 4) + 2, 42, 5)
      // Subtask 2
      p.rect(kgStartX2 - 3, kgAfterY + 40 - 4, 2 * (kgW + 4) + 2, 42, 5)
      // Subtask 3
      p.rect(kgStartX2 - 3 + 2 * (kgW + 4), kgAfterY + 40 - 4, 2 * (kgW + 4) + 2, 42, 5)

      drawLabel(p, 'Subtask 0', kgStartX2 + (kgW + 4) - (kgW + 4) / 2 + kgW / 2, kgAfterY + 58, 9, [120, 220, 140])
      drawLabel(p, 'Subtask 1', kgStartX2 + (kgW + 4) * 3 - (kgW + 4) / 2 + kgW / 2, kgAfterY + 58, 9, [120, 220, 140])
      drawLabel(p, 'Subtask 2', kgStartX2 + (kgW + 4) - (kgW + 4) / 2 + kgW / 2, kgAfterY + 98, 9, [120, 220, 140])
      drawLabel(p, 'Subtask 3', kgStartX2 + (kgW + 4) * 3 - (kgW + 4) / 2 + kgW / 2, kgAfterY + 98, 9, [120, 220, 140])

      // Arrow between panels
      drawArrow(p, w * 0.46, 200, w * 0.52, 200, [255, 255, 255, 180], 2)
      drawLabel(p, 'savepoint → rescale → restore', w * 0.49, 185, 8, [220, 220, 220])
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. Scaling &amp; Rescaling</h2>
      <p className="text-gray-300 leading-relaxed">
        The obvious problem: if you hash userId to a subtask mod parallelism, changing
        parallelism remaps every key and invalidates all per-key state. Flink solves this by
        decoupling keys from subtasks through <strong className="text-white">key groups</strong>.
        The number of key groups is fixed at job creation (defaults to max parallelism, e.g.
        128). Each key hashes to one key group. Each subtask <em>owns</em> a contiguous range of
        key groups.
      </p>

      <P5Sketch sketch={sketch} />

      <p className="text-gray-300 leading-relaxed">
        When you rescale from 2 → 4, the key groups don't move between keys — they're just
        redistributed among the new subtask count. State is reshuffled at the{' '}
        <strong className="text-white">key-group granularity</strong>, not per-key. This makes
        rescaling a bulk operation: take a savepoint, change parallelism, restore. Each subtask
        reads the key groups it now owns from the savepoint files.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">The max-parallelism cap:</strong> you can only
          rescale up to <em>maxParallelism</em> (the number of key groups). Set it generously
          at job creation — 128 or 256 is a good default. Raising it later requires a full
          reprocess of state, which is expensive.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 13 -- Flink vs Alternatives                                */
/* ================================================================== */

function VsOthersSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Flink vs Spark Streaming vs Kafka Streams</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-white">Dimension</th>
              <th className="py-2 px-3 text-blue-400">Flink</th>
              <th className="py-2 px-3 text-orange-400">Spark Structured Streaming</th>
              <th className="py-2 px-3 text-green-400">Kafka Streams</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 text-xs">
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Execution model</td>
              <td className="py-2 px-3">True event-at-a-time streaming</td>
              <td className="py-2 px-3">Micro-batches (100ms-1s); continuous mode is experimental</td>
              <td className="py-2 px-3">Library inside your app — no cluster</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Latency</td>
              <td className="py-2 px-3">Milliseconds</td>
              <td className="py-2 px-3">Hundreds of ms (batch interval)</td>
              <td className="py-2 px-3">Milliseconds</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">State backend</td>
              <td className="py-2 px-3">RocksDB (TB-scale), heap, incremental CP</td>
              <td className="py-2 px-3">Heap / RocksDB; batch-checkpoint to HDFS</td>
              <td className="py-2 px-3">RocksDB + Kafka changelog topics</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Exactly-once</td>
              <td className="py-2 px-3">Yes, with 2PC sinks (Kafka/JDBC/S3)</td>
              <td className="py-2 px-3">Yes, via idempotent writes + WAL</td>
              <td className="py-2 px-3">Yes, via Kafka transactions</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Event time</td>
              <td className="py-2 px-3">First-class (watermarks, allowed lateness, side outputs)</td>
              <td className="py-2 px-3">Supported; watermarks less flexible</td>
              <td className="py-2 px-3">Supported; less mature than Flink</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Deployment</td>
              <td className="py-2 px-3">Standalone, YARN, Kubernetes, Application Mode</td>
              <td className="py-2 px-3">Spark cluster (standalone, YARN, K8s)</td>
              <td className="py-2 px-3">Plain JVM app; scale by running more instances</td>
            </tr>
            <tr className="border-b border-gray-800 align-top">
              <td className="py-2 px-3 font-medium text-white">Sources/sinks</td>
              <td className="py-2 px-3">Kafka, Kinesis, Pulsar, JDBC, FS, Iceberg, Hudi, CDC</td>
              <td className="py-2 px-3">Same as Spark (wide connector set)</td>
              <td className="py-2 px-3">Kafka only (by design)</td>
            </tr>
            <tr className="align-top">
              <td className="py-2 px-3 font-medium text-white">Best for</td>
              <td className="py-2 px-3">Low-latency, complex event-time logic, large state</td>
              <td className="py-2 px-3">Unified batch+stream, ML+streaming same cluster</td>
              <td className="py-2 px-3">Kafka-to-Kafka microservices, no extra infra</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Short version:</strong> if event time, low latency,
          and large state matter independently of Kafka, choose Flink. If you already run a
          Spark cluster for batch and the latency budget is ~1 second, Structured Streaming is
          fine. If your system is purely Kafka-topic-in / Kafka-topic-out and you want a
          library instead of a cluster, Kafka Streams wins on operational simplicity.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 14 -- Tradeoffs                                            */
/* ================================================================== */

function TradeoffsSection() {
  const tradeoffs = [
    {
      chose: 'Event-at-a-time streaming (true streaming)',
      over: 'Micro-batches (Spark-style)',
      because:
        'Micro-batches simplify the runtime (batch executor reused) at the cost of a latency floor equal to the batch interval. Flink chose to solve the harder problem once — per-event execution with checkpoint-based fault tolerance — and get millisecond latency as a result.',
      color: 'border-blue-600',
    },
    {
      chose: 'Event time with watermarks',
      over: 'Processing time only',
      because:
        "Processing-time windowing is easy but wrong for almost every business question. Flink made event-time the default and built a watermark machinery that is invasive but correct. It's the reason Flink is used for billing, fraud detection, and compliance.",
      color: 'border-purple-600',
    },
    {
      chose: 'Aligned checkpoints by default',
      over: 'Always unaligned',
      because:
        'Aligned checkpoints produce tidy, consistent snapshots but stall under heavy backpressure (fast-input channels wait for slow ones). Flink 1.11+ added unaligned checkpoints for backpressure relief — they snapshot in-flight buffers too, at the cost of larger checkpoints. Tunable per-job.',
      color: 'border-amber-600',
    },
    {
      chose: 'RocksDB + incremental checkpoints',
      over: 'Heap-only + full snapshots',
      because:
        'Heap state is 10x faster to access but caps at a few GB per subtask. RocksDB reads are slower (deserialize per access) but state scales to TB and incremental checkpoints become possible — only changed SSTables ship to S3. This is what enables Flink at scale.',
      color: 'border-green-600',
    },
    {
      chose: 'Key groups for rescaling',
      over: 'Rehash on every parallelism change',
      because:
        'Naively changing parallelism rehashes every key, invalidating state. Key groups pre-shard to a fixed count (maxParallelism) and rebalance groups — not keys — across subtasks. The price is a hard cap on maximum parallelism; the benefit is fast rescale without a full state reprocess.',
      color: 'border-cyan-600',
    },
    {
      chose: 'Two-phase commit for exactly-once sinks',
      over: 'Idempotent writes only',
      because:
        'Idempotent keys work for some sinks (upserts by primary key) but not for append-only logs or message queues. 2PC lets Flink coordinate a single transactional commit across the checkpoint boundary. The cost is that sinks must support transactions — Kafka, JDBC XA, S3 multipart. Non-transactional sinks fall back to at-least-once.',
      color: 'border-rose-600',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">14. Tradeoffs and Design Choices</h2>
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
          <strong className="text-yellow-400">When to pick Flink:</strong> the job has real
          event-time logic (windowing, out-of-order events), latency needs to be under a second,
          state is GB-to-TB scale, and you need exactly-once end-to-end. If two of those are
          false — say a batch nightly aggregation — reach for Spark or a query engine instead.
          Flink's power comes with operational weight; use it where the problem shape actually
          needs it.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignFlink() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Design Apache Flink</h1>
        <p className="text-lg text-gray-400">
          A system design deep dive into the stream processor behind Alibaba's realtime
          analytics, Netflix's billing, and Uber's surge pricing. How the job graph, watermarks,
          state backends, and the checkpoint barrier algorithm combine into exactly-once
          streaming at scale.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <JobGraphSection />
      <ArchitectureSection />
      <EventTimeSection />
      <WindowingSection />
      <StateSection />
      <CheckpointSection />
      <RescalingSection />
      <VsOthersSection />
      <TradeoffsSection />
    </div>
  )
}
