import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/transactions',
  title: 'Transactions & ACID',
  description:
    'Understanding transactions, isolation levels, MVCC, serializability, and distributed commits in data-intensive applications',
  track: 'systems',
  order: 7,
  tags: [
    'transactions',
    'acid',
    'isolation',
    'mvcc',
    'serializability',
    '2pc',
    'distributed',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const TXN_A: [number, number, number] = [99, 102, 241] // indigo
const TXN_B: [number, number, number] = [236, 72, 153] // pink
const COMMIT: [number, number, number] = [34, 197, 94] // green
const ABORT: [number, number, number] = [239, 68, 68] // red
const TEXT_C: [number, number, number] = [148, 163, 184] // slate-400
const ACCENT: [number, number, number] = [250, 204, 21] // yellow
const COORD: [number, number, number] = [168, 85, 247] // purple

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/* makeRng removed — unused */

/* ------------------------------------------------------------------ */
/* Section 1 — Isolation Levels Timeline p5 Sketch                     */
/* ------------------------------------------------------------------ */

type IsolationLevel =
  | 'read-uncommitted'
  | 'read-committed'
  | 'repeatable-read'
  | 'serializable'

interface TimelineEvent {
  txn: 'A' | 'B'
  action: string
  time: number
  result?: string
  anomaly?: string
}

function buildEvents(level: IsolationLevel): TimelineEvent[] {
  // Two transactions: A reads x, B writes x, A reads x again
  // Demonstrates dirty read, non-repeatable read, phantom scenarios
  const events: TimelineEvent[] = []

  if (level === 'read-uncommitted') {
    events.push({ txn: 'A', action: 'BEGIN', time: 0 })
    events.push({ txn: 'B', action: 'BEGIN', time: 1 })
    events.push({ txn: 'A', action: 'READ x', time: 2, result: 'x = 10' })
    events.push({ txn: 'B', action: 'WRITE x = 20', time: 3 })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 4,
      result: 'x = 20',
      anomaly: 'DIRTY READ: sees uncommitted write',
    })
    events.push({ txn: 'B', action: 'ROLLBACK', time: 5 })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 6,
      result: 'x = 10',
      anomaly: 'Value reverted! Data was never committed.',
    })
    events.push({ txn: 'A', action: 'COMMIT', time: 7 })
  } else if (level === 'read-committed') {
    events.push({ txn: 'A', action: 'BEGIN', time: 0 })
    events.push({ txn: 'B', action: 'BEGIN', time: 1 })
    events.push({ txn: 'A', action: 'READ x', time: 2, result: 'x = 10' })
    events.push({ txn: 'B', action: 'WRITE x = 20', time: 3 })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 4,
      result: 'x = 10',
      anomaly: 'No dirty read: only sees committed values',
    })
    events.push({ txn: 'B', action: 'COMMIT', time: 5 })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 6,
      result: 'x = 20',
      anomaly: 'NON-REPEATABLE READ: value changed between reads!',
    })
    events.push({ txn: 'A', action: 'COMMIT', time: 7 })
  } else if (level === 'repeatable-read') {
    events.push({ txn: 'A', action: 'BEGIN', time: 0 })
    events.push({ txn: 'B', action: 'BEGIN', time: 1 })
    events.push({ txn: 'A', action: 'READ x', time: 2, result: 'x = 10' })
    events.push({ txn: 'B', action: 'WRITE x = 20', time: 3 })
    events.push({ txn: 'B', action: 'COMMIT', time: 4 })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 5,
      result: 'x = 10',
      anomaly: 'Repeatable: snapshot at BEGIN, sees x = 10',
    })
    events.push({
      txn: 'A',
      action: 'SELECT COUNT(*) WHERE val > 15',
      time: 6,
      result: 'count = 0',
    })
    events.push({ txn: 'B', action: 'BEGIN', time: 6.5 })
    events.push({ txn: 'B', action: 'INSERT row val=25', time: 7 })
    events.push({ txn: 'B', action: 'COMMIT', time: 7.5 })
    events.push({
      txn: 'A',
      action: 'SELECT COUNT(*) WHERE val > 15',
      time: 8,
      result: 'count = 1',
      anomaly: 'PHANTOM READ: new row appeared in range query!',
    })
    events.push({ txn: 'A', action: 'COMMIT', time: 9 })
  } else {
    // serializable
    events.push({ txn: 'A', action: 'BEGIN', time: 0 })
    events.push({ txn: 'B', action: 'BEGIN', time: 1 })
    events.push({ txn: 'A', action: 'READ x', time: 2, result: 'x = 10' })
    events.push({ txn: 'B', action: 'WRITE x = 20', time: 3 })
    events.push({
      txn: 'B',
      action: 'COMMIT',
      time: 4,
      anomaly: 'Commit succeeds (no conflict with A yet)',
    })
    events.push({
      txn: 'A',
      action: 'READ x',
      time: 5,
      result: 'x = 10',
      anomaly: 'Still sees snapshot — fully isolated',
    })
    events.push({
      txn: 'A',
      action: 'WRITE x = x + 5',
      time: 6,
      anomaly: 'Conflict detected: B already modified x',
    })
    events.push({
      txn: 'A',
      action: 'ABORT (serialization failure)',
      time: 7,
      anomaly: 'Txn A must retry — guarantees serial equivalence',
    })
  }

  return events
}

function IsolationSketch() {
  const [level, setLevel] = useState<IsolationLevel>('read-uncommitted')
  const [step, setStep] = useState(0)
  const levelRef = useRef(level)
  const stepRef = useRef(step)
  const eventsRef = useRef<TimelineEvent[]>(buildEvents(level))
  levelRef.current = level
  stepRef.current = step

  const changeLevel = (l: IsolationLevel) => {
    setLevel(l)
    setStep(0)
    levelRef.current = l
    stepRef.current = 0
    eventsRef.current = buildEvents(l)
  }

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 420
    const LANE_Y_A = 120
    const LANE_Y_B = 260
    const LEFT = 100
    const RIGHT = 720

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const events = eventsRef.current
      const curStep = stepRef.current
      p.background(...BG)

      // Title
      p.noStroke()
      p.fill(...TEXT_C)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        `Isolation Level: ${levelRef.current.toUpperCase().replace('-', ' ')}`,
        10,
        10,
      )

      // Lane labels
      p.fill(...TXN_A)
      p.textSize(14)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Txn A', LEFT - 15, LANE_Y_A)
      p.fill(...TXN_B)
      p.text('Txn B', LEFT - 15, LANE_Y_B)

      // Timeline lines
      p.stroke(...GRID_C)
      p.strokeWeight(2)
      p.line(LEFT, LANE_Y_A, RIGHT, LANE_Y_A)
      p.line(LEFT, LANE_Y_B, RIGHT, LANE_Y_B)

      // Time markers
      const maxTime = events.length > 0 ? events[events.length - 1].time : 1
      const timeScale = (RIGHT - LEFT) / (maxTime + 0.5)

      // Draw events up to current step
      for (let i = 0; i <= Math.min(curStep, events.length - 1); i++) {
        const ev = events[i]
        const x = LEFT + ev.time * timeScale
        const y = ev.txn === 'A' ? LANE_Y_A : LANE_Y_B

        // Event dot
        const col = ev.txn === 'A' ? TXN_A : TXN_B
        const isAbort =
          ev.action.includes('ROLLBACK') || ev.action.includes('ABORT')
        const isCommit = ev.action.includes('COMMIT')
        p.noStroke()
        if (isAbort) {
          p.fill(...ABORT)
        } else if (isCommit) {
          p.fill(...COMMIT)
        } else {
          { const [r, g, b] = col; p.fill(r, g, b) }
        }
        p.ellipse(x, y, 14, 14)

        // Action label
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        const labelY = ev.txn === 'A' ? y - 16 : y + 24
        p.text(ev.action, x, labelY)

        // Result
        if (ev.result) {
          p.fill(...ACCENT)
          p.textSize(9)
          const resY = ev.txn === 'A' ? y - 30 : y + 36
          p.text(ev.result, x, resY)
        }

        // Anomaly highlight for current step
        if (i === curStep && ev.anomaly) {
          p.fill(255, 255, 255, 230)
          p.textSize(12)
          p.textAlign(p.CENTER, p.TOP)
          const anomalyColor = ev.anomaly.includes('No ')
            ? COMMIT
            : ev.anomaly.includes('snapshot') ||
                ev.anomaly.includes('Repeatable') ||
                ev.anomaly.includes('sees snapshot') ||
                ev.anomaly.includes('Commit succeeds')
              ? COMMIT
              : ABORT
          { const [r, g, b] = anomalyColor; p.fill(r, g, b) }
          p.text(ev.anomaly, p.width / 2, H - 50)
        }
      }

      // Step indicator
      p.fill(...TEXT_C)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(
        `Step ${Math.min(curStep + 1, events.length)} / ${events.length}`,
        10,
        H - 10,
      )
    }
  }, [])

  const events = eventsRef.current

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'read-uncommitted',
                  'read-committed',
                  'repeatable-read',
                  'serializable',
                ] as IsolationLevel[]
              ).map((l) => (
                <button
                  key={l}
                  onClick={() => changeLevel(l)}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    level === l
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {l.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
              >
                Prev Step
              </button>
              <button
                onClick={() =>
                  setStep((s) => Math.min(events.length - 1, s + 1))
                }
                className="px-3 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
              >
                Next Step
              </button>
              <button
                onClick={() => setStep(0)}
                className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
              >
                Reset
              </button>
            </div>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — MVCC Visualization p5 Sketch                           */
/* ------------------------------------------------------------------ */

interface VersionedRow {
  key: string
  versions: {
    value: number
    createdBy: string
    txnId: number
    visible: boolean
  }[]
}

function MVCCSketch() {
  const [animStep, setAnimStep] = useState(0)
  const stepRef = useRef(0)
  stepRef.current = animStep

  const mvccSteps = [
    {
      desc: 'Initial state: key "balance" has value 100 (created by Txn 0)',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
          ],
        },
      ] as VersionedRow[],
      txnA: 'idle',
      txnB: 'idle',
      snapshot_a: -1,
      snapshot_b: -1,
    },
    {
      desc: 'Txn A (id=1) begins. Takes snapshot at txnId=1.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
          ],
        },
      ],
      txnA: 'active',
      txnB: 'idle',
      snapshot_a: 1,
      snapshot_b: -1,
    },
    {
      desc: 'Txn B (id=2) begins. Takes snapshot at txnId=2.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
          ],
        },
      ],
      txnA: 'active',
      txnB: 'active',
      snapshot_a: 1,
      snapshot_b: 2,
    },
    {
      desc: 'Txn B writes balance = 200. New version is created but not yet committed.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
            { value: 200, createdBy: 'T2', txnId: 2, visible: false },
          ],
        },
      ],
      txnA: 'active',
      txnB: 'writing',
      snapshot_a: 1,
      snapshot_b: 2,
    },
    {
      desc: 'Txn A reads balance. Snapshot sees only T0 version: balance = 100.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
            { value: 200, createdBy: 'T2', txnId: 2, visible: false },
          ],
        },
      ],
      txnA: 'reading',
      txnB: 'writing',
      snapshot_a: 1,
      snapshot_b: 2,
    },
    {
      desc: 'Txn B commits. Version by T2 is now committed and visible to new snapshots.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
            { value: 200, createdBy: 'T2', txnId: 2, visible: true },
          ],
        },
      ],
      txnA: 'active',
      txnB: 'committed',
      snapshot_a: 1,
      snapshot_b: 2,
    },
    {
      desc: 'Txn A reads again. Still sees balance = 100 (snapshot isolation).',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: true },
            { value: 200, createdBy: 'T2', txnId: 2, visible: true },
          ],
        },
      ],
      txnA: 'reading',
      txnB: 'committed',
      snapshot_a: 1,
      snapshot_b: 2,
    },
    {
      desc: 'Txn A commits. Old version (T0) is now eligible for garbage collection.',
      rows: [
        {
          key: 'balance',
          versions: [
            { value: 100, createdBy: 'T0', txnId: 0, visible: false },
            { value: 200, createdBy: 'T2', txnId: 2, visible: true },
          ],
        },
      ],
      txnA: 'committed',
      txnB: 'committed',
      snapshot_a: 1,
      snapshot_b: 2,
    },
  ]

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 400

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const s = stepRef.current
      const data = mvccSteps[s]
      p.background(...BG)

      // Description
      p.noStroke()
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(data.desc, 15, 12, p.width - 30)

      // Draw version chain
      const rowY = 160
      p.fill(...TEXT_C)
      p.textSize(12)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Key: "balance"', 15, rowY - 30)

      const versions = data.rows[0].versions
      for (let v = 0; v < versions.length; v++) {
        const vx = 80 + v * 220
        const vy = rowY

        // Version box
        const isOld = !versions[v].visible && data.txnA === 'committed'
        p.stroke(isOld ? ABORT[0] : ACCENT[0], isOld ? ABORT[1] : ACCENT[1], isOld ? ABORT[2] : ACCENT[2])
        p.strokeWeight(2)
        p.fill(30, 41, 59)
        p.rect(vx, vy, 180, 70, 8)

        // Version content
        p.noStroke()
        p.fill(255)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`value = ${versions[v].value}`, vx + 90, vy + 10)
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text(`created by ${versions[v].createdBy}`, vx + 90, vy + 30)
        p.fill(versions[v].visible ? COMMIT[0] : ABORT[0], versions[v].visible ? COMMIT[1] : ABORT[1], versions[v].visible ? COMMIT[2] : ABORT[2])
        p.text(
          versions[v].visible ? 'committed' : isOld ? 'GC eligible' : 'uncommitted',
          vx + 90,
          vy + 48,
        )

        // Chain arrow
        if (v > 0) {
          p.stroke(...ACCENT)
          p.strokeWeight(2)
          const ax = vx - 40
          p.line(ax, vy + 35, ax + 38, vy + 35)
          p.noStroke()
          p.fill(...ACCENT)
          p.triangle(ax + 38, vy + 30, ax + 38, vy + 40, ax + 46, vy + 35)
        }
      }

      // Transaction status boxes
      const drawTxnBox = (
        label: string,
        state: string,
        snapshotId: number,
        x: number,
        y: number,
        color: [number, number, number],
      ) => {
        p.stroke(...color)
        p.strokeWeight(2)
        p.fill(30, 41, 59)
        p.rect(x, y, 200, 80, 8)
        p.noStroke()
        p.fill(...color)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(label, x + 100, y + 8)
        p.fill(...TEXT_C)
        p.textSize(11)
        p.text(`Status: ${state}`, x + 100, y + 30)
        if (snapshotId >= 0) {
          p.text(`Snapshot: txnId < ${snapshotId}`, x + 100, y + 48)
        }

        // Reading indicator
        if (state === 'reading') {
          p.fill(...ACCENT)
          p.textSize(10)
          p.text('reads balance = 100', x + 100, y + 64)
        }
      }

      drawTxnBox('Txn A (id=1)', data.txnA, data.snapshot_a, 80, 290, TXN_A)
      drawTxnBox('Txn B (id=2)', data.txnB, data.snapshot_b, 400, 290, TXN_B)

      // Step indicator
      p.fill(...TEXT_C)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Step ${s + 1} / ${mvccSteps.length}`, 10, H - 6)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setAnimStep((s) => Math.max(0, s - 1))}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Prev
            </button>
            <button
              onClick={() =>
                setAnimStep((s) => Math.min(mvccSteps.length - 1, s + 1))
              }
              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
            >
              Next
            </button>
            <button
              onClick={() => setAnimStep(0)}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Reset
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Two-Phase Commit (2PC) Animation p5 Sketch              */
/* ------------------------------------------------------------------ */

function TwoPhaseCommitSketch() {
  const [phase, setPhase] = useState(0)
  const [scenario, setScenario] = useState<'success' | 'abort' | 'crash'>(
    'success',
  )
  const phaseRef = useRef(0)
  const scenarioRef = useRef(scenario)
  phaseRef.current = phase
  scenarioRef.current = scenario

  const phaseDescriptions: Record<string, string[]> = {
    success: [
      'Phase 0: Coordinator receives client request to commit a transaction.',
      'Phase 1 (Prepare): Coordinator sends PREPARE to all participants.',
      'Phase 1 (Vote): All participants respond YES — they can commit.',
      'Phase 2 (Commit): Coordinator sends COMMIT to all participants.',
      'Phase 2 (Ack): All participants acknowledge. Transaction committed!',
    ],
    abort: [
      'Phase 0: Coordinator receives client request to commit.',
      'Phase 1 (Prepare): Coordinator sends PREPARE to all participants.',
      'Phase 1 (Vote): Participant 2 votes NO (constraint violation).',
      'Phase 2 (Abort): Coordinator sends ABORT to all participants.',
      'Phase 2 (Done): All participants roll back. Transaction aborted.',
    ],
    crash: [
      'Phase 0: Coordinator receives client request to commit.',
      'Phase 1 (Prepare): Coordinator sends PREPARE. Participants vote YES.',
      'Coordinator crashes after writing COMMIT to its log!',
      'Participants are stuck: they voted YES but have no decision.',
      'This is the BLOCKING PROBLEM of 2PC. Participants must wait for coordinator recovery.',
    ],
  }

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 420

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      const ph = phaseRef.current
      const sc = scenarioRef.current
      p.background(...BG)

      // Coordinator
      const cx = p.width / 2
      const cy = 80
      const isCrash = sc === 'crash' && ph >= 2

      p.noStroke()
      if (isCrash) {
        p.fill(...ABORT)
      } else {
        p.fill(...COORD)
      }
      p.ellipse(cx, cy, 60, 60)
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(isCrash ? 'CRASH' : 'Coord', cx, cy)

      // Participants
      const participants = [
        { x: cx - 200, y: 280 },
        { x: cx, y: 280 },
        { x: cx + 200, y: 280 },
      ]

      for (let i = 0; i < 3; i++) {
        const px = participants[i].x
        const py = participants[i].y

        // Participant state color
        let partColor: readonly [number, number, number] = TXN_A
        if (ph >= 4 || (ph >= 3 && sc !== 'crash')) {
          partColor = sc === 'success' ? COMMIT : sc === 'abort' ? ABORT : ACCENT
        }
        if (sc === 'crash' && ph >= 3) {
          partColor = ACCENT // uncertain/blocking
        }

        p.noStroke()
        { const [r, g, b] = partColor; p.fill(r, g, b) }
        p.ellipse(px, py, 55, 55)
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`P${i + 1}`, px, py - 8)

        // State label
        let stateLabel = 'ready'
        if (ph >= 2) {
          if (sc === 'abort' && i === 1) {
            stateLabel = 'VOTE NO'
          } else if (ph >= 2) {
            stateLabel = 'VOTE YES'
          }
        }
        if (ph >= 4) {
          stateLabel = sc === 'success' ? 'COMMITTED' : 'ABORTED'
        }
        if (sc === 'crash' && ph >= 3) {
          stateLabel = 'BLOCKED!'
        }
        p.text(stateLabel, px, py + 8)
      }

      // Messages (arrows)
      if (ph >= 1 && !isCrash) {
        // Prepare messages
        p.stroke(...ACCENT)
        p.strokeWeight(2)
        for (const part of participants) {
          p.line(cx, cy + 30, part.x, part.y - 30)
        }
        p.noStroke()
        p.fill(...ACCENT)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('PREPARE', cx - 130, 170)
      }

      if (ph >= 2) {
        // Vote messages back
        for (let i = 0; i < 3; i++) {
          const isNo = sc === 'abort' && i === 1
          p.stroke(isNo ? ABORT[0] : COMMIT[0], isNo ? ABORT[1] : COMMIT[1], isNo ? ABORT[2] : COMMIT[2])
          p.strokeWeight(2)
          // Offset to show return arrow
          p.line(
            participants[i].x + 8,
            participants[i].y - 30,
            cx + 8,
            cy + 30,
          )
        }
        p.noStroke()
        p.fill(...COMMIT)
        p.textSize(9)
        p.text('YES', cx + 140, 170)
        if (sc === 'abort') {
          p.fill(...ABORT)
          p.text('NO', cx + 10, 185)
        }
      }

      if (ph >= 3 && !isCrash) {
        // Commit/Abort decision
        const decisionColor = sc === 'success' ? COMMIT : ABORT
        { const [r, g, b] = decisionColor; p.stroke(r, g, b) }
        p.strokeWeight(3)
        for (const part of participants) {
          p.line(cx - 8, cy + 30, part.x - 8, part.y - 30)
        }
        p.noStroke()
        { const [r, g, b] = decisionColor; p.fill(r, g, b) }
        p.textSize(10)
        p.text(sc === 'success' ? 'COMMIT' : 'ABORT', cx - 140, 210)
      }

      // Description
      const descs = phaseDescriptions[sc]
      const descIdx = Math.min(ph, descs.length - 1)
      p.noStroke()
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(descs[descIdx], p.width / 2, H - 55, p.width - 40)

      // Step counter
      p.fill(...TEXT_C)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Phase ${ph} / ${descs.length - 1}`, 10, H - 6)
    }
  }, [])

  const maxPhase = phaseDescriptions[scenario].length - 1

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex gap-2">
              {(['success', 'abort', 'crash'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setScenario(s)
                    setPhase(0)
                  }}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    scenario === s
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase((p) => Math.max(0, p - 1))}
                className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
              >
                Prev
              </button>
              <button
                onClick={() => setPhase((p) => Math.min(maxPhase, p + 1))}
                className="px-3 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-500"
              >
                Next Step
              </button>
              <button
                onClick={() => setPhase(0)}
                className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
              >
                Reset
              </button>
            </div>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* PythonCell code strings                                             */
/* ------------------------------------------------------------------ */

const isolationSimCode = `import random

class SimpleDB:
    """A toy database demonstrating isolation level anomalies."""
    def __init__(self):
        self.committed = {"x": 10, "y": 50}
        self.uncommitted = {}  # txn_id -> {key: value}
        self.active_txns = set()
        self.txn_counter = 0

    def begin(self):
        self.txn_counter += 1
        tid = self.txn_counter
        self.active_txns.add(tid)
        # Snapshot for repeatable read
        self.uncommitted[tid] = {}
        return tid

    def write(self, tid, key, value):
        self.uncommitted[tid][key] = value

    def read(self, tid, key, level="read-committed"):
        if level == "read-uncommitted":
            # Can see ANY write, even uncommitted
            for other_tid in sorted(self.uncommitted.keys(), reverse=True):
                if key in self.uncommitted[other_tid]:
                    return self.uncommitted[other_tid][key]
            return self.committed.get(key)

        elif level == "read-committed":
            # Only see committed values (not other txns' uncommitted writes)
            if key in self.uncommitted[tid]:
                return self.uncommitted[tid][key]
            return self.committed.get(key)

        elif level == "repeatable-read":
            # Snapshot at begin time: always return same value
            if key in self.uncommitted[tid]:
                return self.uncommitted[tid][key]
            return self.committed.get(key)

    def commit(self, tid):
        for k, v in self.uncommitted[tid].items():
            self.committed[k] = v
        del self.uncommitted[tid]
        self.active_txns.discard(tid)

    def rollback(self, tid):
        del self.uncommitted[tid]
        self.active_txns.discard(tid)

# --- Demonstrate dirty read under READ UNCOMMITTED ---
print("=== DIRTY READ (Read Uncommitted) ===")
db = SimpleDB()
t1 = db.begin()
t2 = db.begin()

db.write(t2, "x", 999)  # T2 writes but hasn't committed
val = db.read(t1, "x", "read-uncommitted")
print(f"T1 reads x = {val}  (T2 wrote 999 but hasn't committed!)")
db.rollback(t2)  # T2 rolls back!
val2 = db.read(t1, "x", "read-uncommitted")
print(f"T1 reads x = {val2}  (T2 rolled back, value reverted)")
print(f"Anomaly: T1 read {val} which was NEVER committed!\\n")

# --- Demonstrate non-repeatable read under READ COMMITTED ---
print("=== NON-REPEATABLE READ (Read Committed) ===")
db2 = SimpleDB()
t1 = db2.begin()
t2 = db2.begin()

val1 = db2.read(t1, "x", "read-committed")
print(f"T1 first read: x = {val1}")
db2.write(t2, "x", 42)
db2.commit(t2)
val2 = db2.read(t1, "x", "read-committed")
print(f"T1 second read: x = {val2}")
print(f"Anomaly: Same query returned {val1} then {val2}!\\n")

# --- Repeatable read prevents that ---
print("=== REPEATABLE READ (no non-repeatable read) ===")
db3 = SimpleDB()
t1 = db3.begin()
t2 = db3.begin()
val1 = db3.read(t1, "x", "repeatable-read")
print(f"T1 first read: x = {val1}")
db3.write(t2, "x", 42)
db3.commit(t2)
val2 = db3.read(t1, "x", "repeatable-read")
print(f"T1 second read: x = {val2}")
print(f"Both reads return {val1} — consistent snapshot!")
`

const mvccCode = `class MVCCStore:
    """Simple MVCC key-value store with snapshot isolation."""

    def __init__(self):
        self.next_txn_id = 1
        # Each key maps to a list of (txn_id, value, committed)
        self.versions: dict[str, list[tuple[int, any, bool]]] = {}
        self.snapshots: dict[int, int] = {}  # txn_id -> snapshot_ts
        self.committed_txns: set[int] = {0}  # txn 0 is "initial"

    def put_initial(self, key: str, value):
        """Seed initial data (as if committed by txn 0)."""
        self.versions.setdefault(key, []).append((0, value, True))

    def begin(self) -> int:
        tid = self.next_txn_id
        self.next_txn_id += 1
        # Snapshot: list of committed txn IDs at this moment
        self.snapshots[tid] = tid
        return tid

    def _visible(self, ver_txn: int, reader_txn: int) -> bool:
        """Is a version visible to this reader's snapshot?"""
        # A version is visible if:
        # 1. It was created by a committed txn, AND
        # 2. That txn committed before reader began (txn_id < snapshot)
        # OR it's the reader's own write
        if ver_txn == reader_txn:
            return True
        return ver_txn in self.committed_txns and ver_txn < self.snapshots[reader_txn]

    def read(self, tid: int, key: str):
        """Read the latest visible version for this transaction."""
        if key not in self.versions:
            return None
        # Walk versions in reverse to find latest visible
        for ver_txn, value, committed in reversed(self.versions[key]):
            if self._visible(ver_txn, tid):
                return value
        return None

    def write(self, tid: int, key: str, value):
        """Write a new version (uncommitted until commit)."""
        self.versions.setdefault(key, []).append((tid, value, False))

    def commit(self, tid: int):
        """Mark all versions by this txn as committed."""
        self.committed_txns.add(tid)
        for key in self.versions:
            for i, (vtid, val, _) in enumerate(self.versions[key]):
                if vtid == tid:
                    self.versions[key][i] = (vtid, val, True)
        del self.snapshots[tid]
        print(f"  Txn {tid} committed.")

    def gc(self, min_active_txn: int):
        """Remove versions no longer visible to any active transaction."""
        removed = 0
        for key in self.versions:
            # Keep the latest committed version before min_active_txn
            # plus all versions >= min_active_txn
            versions = self.versions[key]
            keep = []
            found_visible = False
            for ver_txn, val, committed in reversed(versions):
                if ver_txn >= min_active_txn or not found_visible:
                    keep.append((ver_txn, val, committed))
                    if committed and ver_txn < min_active_txn:
                        found_visible = True
                else:
                    removed += 1
            self.versions[key] = list(reversed(keep))
        return removed

# --- Demo ---
store = MVCCStore()
store.put_initial("balance", 1000)
store.put_initial("name", "Alice")

print("=== MVCC Snapshot Isolation Demo ===\\n")

# T1 begins and reads
t1 = store.begin()
print(f"T1 (id={t1}) begins")
print(f"  T1 reads balance = {store.read(t1, 'balance')}")

# T2 begins and writes
t2 = store.begin()
print(f"T2 (id={t2}) begins")
store.write(t2, "balance", 2000)
print(f"  T2 writes balance = 2000 (uncommitted)")

# T1 cannot see T2's write
print(f"  T1 reads balance = {store.read(t1, 'balance')}  (still 1000!)")

# T2 commits
store.commit(t2)

# T1 STILL cannot see T2's write (snapshot isolation)
print(f"  T1 reads balance = {store.read(t1, 'balance')}  (STILL 1000 — snapshot!)")

# T1 commits
store.commit(t1)

# New transaction T3 sees T2's committed write
t3 = store.begin()
print(f"\\nT3 (id={t3}) begins AFTER T2 committed")
print(f"  T3 reads balance = {store.read(t3, 'balance')}  (sees 2000)")
store.commit(t3)

# Garbage collection
removed = store.gc(min_active_txn=store.next_txn_id)
print(f"\\nGarbage collection: removed {removed} old version(s)")
print(f"Remaining versions for 'balance': {store.versions['balance']}")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function Transactions() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-14 text-gray-200">
      {/* ---- Section 1: The Need for Transactions ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Transactions &amp; ACID
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          In a world where things constantly go wrong — processes crash mid-write,
          disks fail, networks drop packets, multiple clients race to modify the
          same data — transactions provide a powerful abstraction: a way to group
          several reads and writes into a single logical unit that either
          <strong className="text-white"> fully succeeds </strong>
          or <strong className="text-white"> fully fails</strong>.
        </p>
      </section>

      {/* ---- Section 2: The Need for Transactions (detail) ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Why Transactions Matter
        </h2>
        <p className="leading-relaxed">
          Consider transferring $100 from Account A to Account B. This requires
          two writes: debit A, credit B. Without transactions, a crash between
          the two writes leaves $100 missing. Transactions ensure that either
          both writes happen or neither does.
        </p>
        <p className="leading-relaxed">
          But transactions are not just about crash recovery. When multiple users
          access the database concurrently, their operations can interleave in
          surprising ways, producing results that no sequential execution could.
          Transactions provide <em>isolation</em> — each transaction runs as if
          it were the only one using the database.
        </p>
        <div className="bg-slate-800 rounded-lg p-4 text-sm font-mono space-y-1">
          <p className="text-yellow-400">Things that can go wrong:</p>
          <p>1. The database software or hardware may fail at any time</p>
          <p>2. The application may crash mid-operation</p>
          <p>3. Network interruptions can cut off the app from the database</p>
          <p>4. Multiple clients may write simultaneously, overwriting each other</p>
          <p>5. A client may read partially-updated (inconsistent) data</p>
          <p>6. Race conditions between clients can cause subtle bugs</p>
        </div>
      </section>

      {/* ---- Section 3: ACID Explained ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">ACID Explained</h2>
        <p className="leading-relaxed">
          The safety guarantees provided by transactions are often described by
          the acronym <strong className="text-indigo-400">ACID</strong>:
          Atomicity, Consistency, Isolation, and Durability. But the meaning of
          each letter is more nuanced than it first appears.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-indigo-400">
              A — Atomicity
            </h3>
            <p className="text-sm leading-relaxed">
              Not about concurrency (that&apos;s isolation). Atomicity means that if
              a transaction makes several changes and one of them fails, the
              transaction is <em>aborted</em> and all changes are rolled back.
              All-or-nothing. The database guarantees you never see a half-finished
              transaction.
            </p>
            <p className="text-xs text-gray-400">
              Example: A bank transfer debits account A then credits account B. If
              the credit fails, the debit is undone.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-green-400">
              C — Consistency
            </h3>
            <p className="text-sm leading-relaxed">
              The most overloaded term in computer science. In ACID, it means that
              certain <em>invariants</em> about your data must always hold. For
              example, credits and debits must balance. This is primarily the
              <strong> application&apos;s responsibility</strong> — the database just
              provides atomicity and isolation; the app defines what &quot;consistent&quot;
              means.
            </p>
            <p className="text-xs text-gray-400">
              Example: In an accounting system, the sum of all account balances
              must equal zero after every transaction.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-pink-400">
              I — Isolation
            </h3>
            <p className="text-sm leading-relaxed">
              Concurrently executing transactions should not interfere with each
              other. The classic definition:
              <strong> serializability</strong> — the result is the same as if
              transactions ran one at a time, in some serial order. In practice,
              full serializability has a performance cost, so databases offer
              weaker isolation levels.
            </p>
            <p className="text-xs text-gray-400">
              Example: Two users simultaneously book the last seat on a flight.
              Without isolation, both might succeed, overbooking the flight.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-lg font-bold text-yellow-400">
              D — Durability
            </h3>
            <p className="text-sm leading-relaxed">
              Once a transaction has committed, its data will not be lost — even
              if the machine crashes or loses power. Typically implemented via
              write-ahead logs (WAL) and replication. In a single-node database,
              this means writing to non-volatile storage. In a replicated database,
              it means the data has been copied to a sufficient number of nodes.
            </p>
            <p className="text-xs text-gray-400">
              No guarantee is absolute: if all disks and all backups are destroyed,
              nothing can save you. Durability is about surviving common failures.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 4: Isolation Levels ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Isolation Levels</h2>
        <p className="leading-relaxed">
          Full serializability is expensive. In practice, databases offer a menu
          of <em>isolation levels</em>, each preventing different anomalies at
          different performance costs. The SQL standard defines four levels, from
          weakest to strongest:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-3 text-gray-400">Level</th>
                <th className="text-center py-2 px-3 text-gray-400">
                  Dirty Read
                </th>
                <th className="text-center py-2 px-3 text-gray-400">
                  Non-Repeatable
                </th>
                <th className="text-center py-2 px-3 text-gray-400">
                  Phantom
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-slate-700">
                <td className="py-2 px-3">Read Uncommitted</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 px-3">Read Committed</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 px-3">Repeatable Read</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
                <td className="text-center py-2 px-3 text-red-400">possible</td>
              </tr>
              <tr>
                <td className="py-2 px-3">Serializable</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
                <td className="text-center py-2 px-3 text-green-400">prevented</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="leading-relaxed">
          Use the interactive visualization below to step through two concurrent
          transactions under each isolation level. Watch for the anomalies that
          each level allows or prevents.
        </p>

        <IsolationSketch />

        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-red-400">Dirty Read:</strong> Transaction
            reads data written by another transaction that hasn&apos;t committed yet.
            If that transaction rolls back, you read data that never existed.
          </p>
          <p>
            <strong className="text-red-400">Non-Repeatable Read:</strong> You
            read a value, another transaction modifies and commits it, and your
            second read sees a different value. Same query, different results.
          </p>
          <p>
            <strong className="text-red-400">Phantom Read:</strong> You query
            rows matching a condition, another transaction inserts a new matching
            row, and your second query returns a different set of rows.
          </p>
        </div>
      </section>

      {/* ---- Section 5: Implementing Isolation — MVCC ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Implementing Isolation: MVCC
        </h2>
        <p className="leading-relaxed">
          The dominant approach to implementing snapshot isolation and repeatable
          read is <strong className="text-yellow-400">
            Multi-Version Concurrency Control (MVCC)
          </strong>. Instead of modifying rows in place, the database keeps
          multiple versions of each row. Each transaction sees a consistent
          snapshot of the database based on when it started.
        </p>
        <p className="leading-relaxed">
          MVCC has several key properties: (1) readers never block writers and
          writers never block readers, (2) each transaction sees a frozen
          snapshot, (3) old versions are garbage-collected once no active
          transaction can see them.
        </p>
        <p className="leading-relaxed">
          Compare this with <strong>Two-Phase Locking (2PL)</strong>, the
          pessimistic alternative: every read acquires a shared lock, every write
          acquires an exclusive lock, and locks are held until the transaction
          ends. 2PL provides serializability but has poor performance because
          readers and writers block each other.
        </p>
        <p className="leading-relaxed">
          Step through the MVCC visualization below to see how version chains
          work, how snapshots provide isolation, and when garbage collection
          reclaims old versions.
        </p>

        <MVCCSketch />
      </section>

      {/* ---- Section 6: Serializability ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Serializability</h2>
        <p className="leading-relaxed">
          Serializability is the strongest isolation level — it guarantees that
          the outcome of concurrent transactions is equivalent to some serial
          (one-at-a-time) execution. There are three main approaches:
        </p>

        <div className="space-y-3">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-indigo-400">
              1. Actual Serial Execution
            </h3>
            <p className="text-sm leading-relaxed mt-1">
              The simplest approach: run one transaction at a time on a single
              thread. This became viable with RAM-sized datasets and stored
              procedures (VoltDB, Redis). The bottleneck is that one CPU core
              limits throughput.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-pink-400">
              2. Two-Phase Locking (2PL)
            </h3>
            <p className="text-sm leading-relaxed mt-1">
              Transactions acquire locks as they go: shared locks for reads,
              exclusive locks for writes. All locks are released only after
              commit or abort. Provides serializability but suffers from lock
              contention and potential deadlocks. This was the standard for 30+
              years.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-base font-bold text-green-400">
              3. Serializable Snapshot Isolation (SSI)
            </h3>
            <p className="text-sm leading-relaxed mt-1">
              The best of both worlds: uses MVCC snapshots (optimistic — no
              blocking) but detects conflicts at commit time. If a transaction
              read data that another transaction has since modified, it must
              abort and retry. Used in PostgreSQL&apos;s SERIALIZABLE level. Much
              better performance than 2PL because reads don&apos;t block.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 7: Distributed Transactions — 2PC ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Distributed Transactions: Two-Phase Commit
        </h2>
        <p className="leading-relaxed">
          When a transaction spans multiple nodes (e.g., different database
          partitions or different services), we need a protocol to ensure all
          nodes either commit or abort. The standard solution is{' '}
          <strong className="text-purple-400">Two-Phase Commit (2PC)</strong>.
        </p>
        <p className="leading-relaxed">
          In 2PC, a <em>coordinator</em> manages the process: (1) In the
          <strong> prepare phase</strong>, it asks each participant to vote
          YES or NO. (2) If all vote YES, the coordinator writes its COMMIT
          decision to disk, then broadcasts COMMIT. If any vote NO, it
          broadcasts ABORT.
        </p>
        <p className="leading-relaxed">
          The critical insight: once a participant votes YES, it has made a
          <em> promise</em> — it must commit if the coordinator says so, even
          after a crash. This is why it&apos;s called a <strong>blocking protocol
          </strong>: if the coordinator crashes after participants vote YES but
          before sending the decision, participants are stuck waiting.
        </p>

        <TwoPhaseCommitSketch />

        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm">
          <p className="font-bold text-red-400">The Blocking Problem</p>
          <p className="mt-1 leading-relaxed">
            If the coordinator crashes after the prepare phase, participants who
            voted YES cannot safely commit or abort — they must wait for the
            coordinator to recover. This can leave database locks held for an
            unbounded period. This is the fundamental limitation of 2PC.
            Solutions like 3PC exist but have their own issues; in practice, most
            systems use consensus-based approaches (e.g., Raft) instead.
          </p>
        </div>
      </section>

      {/* ---- PythonCell 1: Isolation Level Simulation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Isolation Level Anomalies
        </h2>
        <p className="leading-relaxed">
          Run the code below to simulate concurrent transactions under different
          isolation levels. Observe how dirty reads, non-repeatable reads, and
          phantom reads manifest (or are prevented).
        </p>
        <PythonCell defaultCode={isolationSimCode} />
      </section>

      {/* ---- PythonCell 2: MVCC Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Hands-On: Building an MVCC Store
        </h2>
        <p className="leading-relaxed">
          This implementation builds a simple MVCC key-value store from scratch.
          Each write creates a new version. Reads use transaction snapshots to
          determine visibility. Watch how concurrent transactions see consistent
          but different views of the data.
        </p>
        <PythonCell defaultCode={mvccCode} />
      </section>

      {/* ---- Section 8: Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <div className="bg-slate-800 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
          <p>
            <strong className="text-indigo-400">Transactions</strong> simplify
            the programming model by converting many possible partial-failure
            modes into a simple abort-and-retry model.
          </p>
          <p>
            <strong className="text-indigo-400">ACID</strong> properties are not
            binary — different databases implement them to different degrees, and
            &quot;consistency&quot; is really the application&apos;s job.
          </p>
          <p>
            <strong className="text-indigo-400">Isolation levels</strong>{' '}
            represent a tradeoff between performance and correctness. Most
            applications use Read Committed or Repeatable Read, not full
            Serializable.
          </p>
          <p>
            <strong className="text-indigo-400">MVCC</strong> is the dominant
            implementation strategy: keep multiple versions so readers don&apos;t
            block writers. PostgreSQL, MySQL/InnoDB, Oracle, and CockroachDB all
            use MVCC.
          </p>
          <p>
            <strong className="text-indigo-400">SSI</strong> (Serializable
            Snapshot Isolation) gives you serializability with MVCC&apos;s performance
            characteristics — the best practical approach.
          </p>
          <p>
            <strong className="text-indigo-400">2PC</strong> is the standard for
            distributed transactions but is a blocking protocol. Its coordinator
            is a single point of failure. Modern systems increasingly use
            consensus protocols instead.
          </p>
        </div>
      </section>
    </div>
  )
}
