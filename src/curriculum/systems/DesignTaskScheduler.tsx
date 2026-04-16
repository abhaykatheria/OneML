import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-task-scheduler',
  title: 'Design a Distributed Task Scheduler',
  description:
    'System design case study: build a distributed task scheduler like Airflow or Celery that reliably schedules and executes millions of tasks',
  track: 'systems',
  order: 16,
  tags: [
    'system-design',
    'task-scheduler',
    'distributed',
    'exactly-once',
    'cron',
    'worker-pool',
    'timing-wheel',
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
    p.fill(...TEXT_C)
    p.textSize(8)
    p.textAlign(p.CENTER, p.BOTTOM)
    p.text(label, (x1 + x2) / 2, Math.min(y1, y2) - 4)
  }
}

/* ------------------------------------------------------------------ */
/* Sketch 1: High-Level Architecture                                   */
/* ------------------------------------------------------------------ */

function ArchitectureSketch() {
  const frameRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 420

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      frameRef.current++
      const t = frameRef.current
      p.background(...BG)

      const cx = p.width / 2

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Distributed Task Scheduler \u2014 High-Level Architecture', cx, 10)

      // Components
      const dbX = cx - 260
      const dbY = 160
      drawBox(p, dbX, dbY, 110, 60, INDIGO, 'Task Store', '(PostgreSQL)')

      const schedX = cx - 80
      const schedY = 160
      drawBox(p, schedX, schedY, 110, 60, YELLOW, 'Scheduler', '(Leader)')

      const queueX = cx + 100
      const queueY = 160
      drawBox(p, queueX, queueY, 110, 60, PINK, 'Task Queue', '(Prioritized)')

      // Workers
      const workerStartX = cx + 50
      const workerY = 310
      for (let i = 0; i < 3; i++) {
        const wx = workerStartX + i * 100 - 100
        const active = (t % 120) > 30 + i * 20 && (t % 120) < 70 + i * 20
        drawBox(
          p,
          wx,
          workerY,
          80,
          50,
          active ? GREEN : [60, 70, 90],
          `Worker ${i + 1}`,
          active ? 'executing...' : 'idle',
        )
        // Arrow from queue to worker
        drawArrow(p, queueX, queueY + 30, wx, workerY - 25, active ? GREEN : GRID_C)
      }

      // Result store
      const resX = cx + 260
      const resY = 160
      drawBox(p, resX, resY, 100, 60, CYAN, 'Result Store', '(S3/DB)')

      // Arrows: DB -> Scheduler
      drawArrow(p, dbX + 55, dbY, schedX - 55, schedY, INDIGO, 'poll due tasks')

      // Arrows: Scheduler -> Queue
      drawArrow(p, schedX + 55, schedY, queueX - 55, queueY, YELLOW, 'enqueue')

      // Arrows: Workers -> Result Store
      const w2X = workerStartX + 100
      drawArrow(p, w2X, workerY - 25, resX, resY + 30, CYAN, 'results')

      // Animated tasks flowing scheduler -> queue
      const pulse = Math.sin(t * 0.05) * 0.5 + 0.5
      const taskX = schedX + 55 + (queueX - schedX - 110) * pulse
      p.noStroke()
      p.fill(...YELLOW)
      p.ellipse(taskX, schedY, 10, 10)

      // Client API
      const apiX = cx - 260
      const apiY = 60
      drawBox(p, apiX, apiY, 100, 40, PURPLE, 'API Gateway')
      drawArrow(p, apiX, apiY + 20, dbX, dbY - 30, PURPLE, 'submit task')

      // DLQ
      const dlqX = cx - 80
      const dlqY = 340
      drawBox(p, dlqX, dlqY, 100, 40, RED, 'Dead Letter Q', '(failed tasks)')

      // Legend
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Tasks flow: Client \u2192 Store \u2192 Scheduler \u2192 Queue \u2192 Workers \u2192 Results', 10, H - 8)
    }
  }, [])

  return <P5Sketch sketch={sketch} height={420} />
}

/* ------------------------------------------------------------------ */
/* Sketch 2: Timing Wheel                                              */
/* ------------------------------------------------------------------ */

function TimingWheelSketch() {
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const sketch = useCallback((p: p5) => {
    const W = 700
    const H = 420
    let angle = 0
    const SLOTS = 12
    const tasks: { slot: number; label: string; color: [number, number, number] }[] = [
      { slot: 1, label: 'T1', color: INDIGO },
      { slot: 1, label: 'T2', color: PINK },
      { slot: 3, label: 'T3', color: GREEN },
      { slot: 5, label: 'T4', color: CYAN },
      { slot: 7, label: 'T5', color: PURPLE },
      { slot: 8, label: 'T6', color: ORANGE },
      { slot: 10, label: 'T7', color: YELLOW },
      { slot: 11, label: 'T8', color: RED },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      angle += 0.005 * speedRef.current

      const cx = p.width * 0.35
      const cy = H / 2 + 10
      const outerR = 150
      const innerR = 100

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Timing Wheel \u2014 Efficient Task Scheduling', p.width / 2, 10)

      // Current slot
      const currentSlot = Math.floor(
        ((angle % (Math.PI * 2)) / (Math.PI * 2)) * SLOTS,
      )

      // Draw wheel slots
      for (let i = 0; i < SLOTS; i++) {
        const a1 = (i / SLOTS) * Math.PI * 2 - Math.PI / 2
        const a2 = ((i + 1) / SLOTS) * Math.PI * 2 - Math.PI / 2
        const mid = (a1 + a2) / 2

        const isCurrent = i === currentSlot
        p.stroke(isCurrent ? 255 : 60, isCurrent ? 255 : 70, isCurrent ? 0 : 90)
        p.strokeWeight(isCurrent ? 3 : 1)
        p.fill(isCurrent ? 40 : 20, isCurrent ? 45 : 25, isCurrent ? 60 : 42)
        p.arc(cx, cy, outerR * 2, outerR * 2, a1, a2, p.PIE)

        // Slot number
        const tx = cx + Math.cos(mid) * (innerR + 20)
        const ty = cy + Math.sin(mid) * (innerR + 20)
        p.noStroke()
        p.fill(isCurrent ? 255 : 140)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${i}`, tx, ty)

        // Tasks in this slot
        const slotTasks = tasks.filter((tsk) => tsk.slot === i)
        for (let j = 0; j < slotTasks.length; j++) {
          const tr = outerR + 18 + j * 22
          const ttx = cx + Math.cos(mid) * tr
          const tty = cy + Math.sin(mid) * tr
          p.fill(...slotTasks[j].color)
          p.noStroke()
          p.ellipse(ttx, tty, 16, 16)
          p.fill(255)
          p.textSize(7)
          p.text(slotTasks[j].label, ttx, tty)
        }
      }

      // Inner circle
      p.fill(...BG)
      p.noStroke()
      p.ellipse(cx, cy, innerR * 2, innerR * 2)

      // Hand / pointer
      const handAngle = angle - Math.PI / 2
      const hx = cx + Math.cos(handAngle) * (innerR + 15)
      const hy = cy + Math.sin(handAngle) * (innerR + 15)
      p.stroke(...YELLOW)
      p.strokeWeight(3)
      p.line(cx, cy, hx, hy)
      p.noStroke()
      p.fill(...YELLOW)
      p.ellipse(cx, cy, 10, 10)

      // Center label
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('LEADER', cx, cy - 12)
      p.fill(...TEXT_C)
      p.textSize(9)
      p.text(`slot ${currentSlot}`, cx, cy + 6)

      // Leader election info
      const infoX = p.width * 0.72
      p.noStroke()
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Leader Scheduler', infoX - 20, 50)

      p.fill(...TEXT_C)
      p.textSize(10)
      const lines = [
        'Only ONE scheduler is active',
        'via leader election (ZooKeeper',
        'or Raft-based).',
        '',
        'The leader advances the wheel:',
        `  Current tick: slot ${currentSlot}`,
        '',
        'Tasks at current slot are',
        'dequeued and sent to the',
        'priority task queue.',
        '',
        'Standby schedulers watch',
        'for leader failure to',
        'take over instantly.',
      ]
      for (let i = 0; i < lines.length; i++) {
        p.text(lines[i], infoX - 20, 70 + i * 16)
      }

      // Fired tasks animation
      const fired = tasks.filter((tsk) => tsk.slot === currentSlot)
      if (fired.length > 0) {
        p.fill(...GREEN)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(
          `Firing: ${fired.map((f) => f.label).join(', ')}`,
          infoX - 20,
          H - 50,
        )
      }

      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('O(1) scheduling: advance pointer, fire tasks in current bucket', 10, H - 6)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex gap-2 mt-2">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                speed === s
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Sketch 3: Exactly-Once Execution (Pessimistic Locking)              */
/* ------------------------------------------------------------------ */

function ExactlyOnceSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 380

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const s = stepRef.current
      const cx = p.width / 2

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Exactly-Once Execution \u2014 Pessimistic Locking Race', cx, 10)

      // DB
      drawBox(p, cx, 80, 200, 50, INDIGO, 'Task Store (DB)', 'task_42: status=?')

      // Two workers racing
      const w1X = cx - 150
      const w2X = cx + 150
      const wY = 220
      drawBox(p, w1X, wY, 100, 50, GREEN, 'Worker A')
      drawBox(p, w2X, wY, 100, 50, PINK, 'Worker B')

      // Step descriptions & animations
      const descs = [
        'Both workers see task_42 is due and try to claim it simultaneously.',
        'Worker A: UPDATE tasks SET status="running" WHERE id=42 AND status="pending"',
        'Worker A succeeds (1 row affected). Worker B: 0 rows affected \u2192 loses the race.',
        'Worker A executes the task. Worker B moves on. No duplicate execution.',
        'Worker A writes result with idempotency token. Even retries are safe.',
      ]

      // Task status
      const statuses = ['pending', 'pending \u2192 running?', 'running (A wins)', 'running', 'completed']
      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(`status: ${statuses[Math.min(s, 4)]}`, cx, 115)

      // Arrows and highlights per step
      if (s >= 0) {
        // Both workers looking at DB
        const ctx = (p.drawingContext as unknown as CanvasRenderingContext2D)
        ctx.setLineDash([4, 4])
        p.stroke(...TEXT_C)
        p.strokeWeight(1)
        p.line(w1X, wY - 25, cx - 30, 105)
        p.line(w2X, wY - 25, cx + 30, 105)
        ctx.setLineDash([])
      }

      if (s >= 1) {
        // Worker A sends UPDATE
        drawArrow(p, w1X + 50, wY - 10, cx - 50, 95, GREEN, 'UPDATE ... AND status="pending"')
      }

      if (s >= 2) {
        // Worker A wins
        p.fill(...GREEN)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text('\u2713 1 row updated', w1X, wY + 32)

        // Worker B loses
        p.fill(...RED)
        p.text('\u2717 0 rows updated', w2X, wY + 32)
        drawArrow(p, w2X - 50, wY - 10, cx + 50, 95, RED, 'UPDATE fails')
      }

      if (s >= 3) {
        // Worker A executes
        drawBox(p, w1X, 320, 100, 40, GREEN, 'Executing...', 'task_42')
      }

      if (s >= 4) {
        // Idempotency
        drawBox(p, cx, 320, 160, 40, CYAN, 'Result + Idempotency Token')
        drawArrow(p, w1X + 50, 320, cx - 80, 320, GREEN)
      }

      // Description
      p.noStroke()
      p.fill(...YELLOW)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(descs[Math.min(s, 4)], cx, H - 10)

      // Step counter
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Step ${s + 1} / 5`, 10, H - 6)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
          >
            Prev
          </button>
          <button
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
          >
            Next
          </button>
          <button
            onClick={() => setStep(0)}
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
/* Sketch 4: Worker Pool with Crash Recovery                           */
/* ------------------------------------------------------------------ */

function WorkerPoolSketch() {
  const frameRef = useRef(0)
  const [crashed, setCrashed] = useState(false)
  const crashRef = useRef(crashed)
  crashRef.current = crashed

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 400

    interface WorkerState {
      id: number
      x: number
      task: string | null
      progress: number
      color: [number, number, number]
      isCrashed: boolean
    }

    const workers: WorkerState[] = [
      { id: 1, x: 0, task: 'T1', progress: 0, color: GREEN, isCrashed: false },
      { id: 2, x: 0, task: 'T2', progress: 0, color: CYAN, isCrashed: false },
      { id: 3, x: 0, task: 'T3', progress: 0, color: PURPLE, isCrashed: false },
      { id: 4, x: 0, task: null, progress: 0, color: ORANGE, isCrashed: false },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
      const spacing = p.width / 5
      for (let i = 0; i < workers.length; i++) {
        workers[i].x = spacing * (i + 1)
      }
    }

    p.draw = () => {
      frameRef.current++
      const t = frameRef.current
      p.background(...BG)

      const isCrashed = crashRef.current

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Worker Pool \u2014 Pull Model with Crash Recovery', p.width / 2, 10)

      // Priority queue at top
      const qY = 60
      drawBox(p, p.width / 2, qY, 300, 40, PINK, 'Priority Queue: [T4, T5, T6, T7, ...]')

      // Update workers
      for (const w of workers) {
        if (isCrashed && w.id === 2) {
          w.isCrashed = true
          w.task = 'T2'
        } else if (!isCrashed && w.isCrashed) {
          w.isCrashed = false
          w.task = null
          w.progress = 0
        }

        if (!w.isCrashed && w.task) {
          w.progress = (w.progress + 0.5) % 100
          if (w.progress > 99) {
            w.task = null
            w.progress = 0
          }
        }
      }

      // Draw workers
      const wY = 200
      for (const w of workers) {
        const color: [number, number, number] = w.isCrashed ? RED : w.color

        // Box
        p.fill(color[0], color[1], color[2], w.isCrashed ? 80 : 40)
        p.stroke(...color)
        p.strokeWeight(2)
        p.rect(w.x - 50, wY - 35, 100, 70, 8)

        p.noStroke()
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        if (w.isCrashed) {
          p.fill(...RED)
          p.text(`Worker ${w.id}`, w.x, wY - 15)
          p.textSize(16)
          p.text('\u2717 CRASHED', w.x, wY + 8)
        } else {
          p.text(`Worker ${w.id}`, w.x, wY - 15)
          if (w.task) {
            p.fill(...YELLOW)
            p.textSize(10)
            p.text(`Running ${w.task}`, w.x, wY + 5)
            // Progress bar
            p.fill(30, 41, 59)
            p.rect(w.x - 35, wY + 18, 70, 6, 3)
            p.fill(...GREEN)
            p.rect(w.x - 35, wY + 18, 70 * (w.progress / 100), 6, 3)
          } else {
            p.fill(...TEXT_C)
            p.textSize(10)
            p.text('idle', w.x, wY + 5)
          }
        }

        // Arrow from queue to worker
        if (!w.isCrashed) {
          drawArrow(p, w.x, qY + 20, w.x, wY - 35, w.task ? w.color : GRID_C)
        }
      }

      // Crash recovery flow
      if (isCrashed) {
        const crashW = workers[1]
        const recoverY = 300

        // Timeout detection
        p.fill(...RED)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Heartbeat timeout detected!', crashW.x, wY + 45)

        // Reschedule arrow
        const blink = Math.sin(t * 0.1) > 0
        if (blink) {
          drawArrow(p, crashW.x, wY + 60, p.width / 2, qY + 20, RED, 'reschedule T2 (retry +1)')
        }

        // Dead letter note
        drawBox(p, p.width / 2, recoverY + 40, 260, 36, RED, 'If max retries exceeded \u2192 Dead Letter Queue')
      }

      // Result store
      const rY = 320
      if (!isCrashed) {
        drawBox(p, p.width / 2, rY, 200, 36, CYAN, 'Result Store')
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Workers report success/failure on completion', p.width / 2, rY + 24)
      }

      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Workers pull tasks from priority queue. Heartbeats detect crashes.', 10, H - 6)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setCrashed(false)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              !crashed
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            HEALTHY
          </button>
          <button
            onClick={() => setCrashed(true)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              crashed
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            CRASH WORKER 2
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function DesignTaskScheduler() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-14 text-gray-200">
      {/* ---- Section 1: Problem Statement ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Design a Distributed Task Scheduler
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          Think Airflow, Celery, or cloud-managed cron services. We need to build
          a system that reliably schedules and executes millions of tasks &mdash;
          both one-time and recurring &mdash; with guarantees around exactly-once
          execution, sub-second accuracy, and fault tolerance.
        </p>
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">The challenge:</strong> A naive
            cron daemon on a single server cannot scale. What happens when that
            server dies? How do you handle 10,000 task executions per second?
            How do you prevent a task from running twice or not at all?
          </p>
        </div>
      </section>

      {/* ---- Section 2: Functional Requirements ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Functional Requirements</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-300">
          <li>
            <strong className="text-white">Submit tasks:</strong> One-time or
            recurring via cron expression (e.g., <code className="text-pink-400">*/5 * * * *</code>).
            Each task has a payload (HTTP callback, function name, etc.).
          </li>
          <li>
            <strong className="text-white">Cancel tasks:</strong> Remove a
            scheduled task before its next execution.
          </li>
          <li>
            <strong className="text-white">Task status &amp; history:</strong>{' '}
            Query the current state and full execution history of any task.
          </li>
          <li>
            <strong className="text-white">Retry on failure:</strong> Configurable
            max retries with exponential backoff.
          </li>
          <li>
            <strong className="text-white">Task priority:</strong> Higher-priority
            tasks execute before lower-priority ones when workers are contended.
          </li>
          <li>
            <strong className="text-white">Deduplication:</strong> Prevent the
            same task from being enqueued multiple times for the same scheduled time.
          </li>
        </ul>
      </section>

      {/* ---- Section 3: Non-Functional Requirements ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Non-Functional Requirements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Exactly-once execution</h3>
            <p className="text-sm text-gray-300">
              No task runs twice for a given scheduled time. No task is silently
              dropped. This is the single hardest guarantee.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Sub-second accuracy</h3>
            <p className="text-sm text-gray-300">
              A task scheduled for 14:00:00 should begin execution within 1 second
              of that time under normal load.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Scale</h3>
            <p className="text-sm text-gray-300">
              Handle 1M scheduled tasks and 10K executions per second at peak.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Fault tolerance</h3>
            <p className="text-sm text-gray-300">
              Survive node failures without missing any scheduled tasks. No single
              point of failure.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 4: Back-of-Envelope Calculations ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Back-of-Envelope Calculations</h2>
        <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm space-y-2 text-gray-300">
          <p>Total scheduled tasks: <span className="text-cyan-400">1,000,000</span></p>
          <p>Avg task metadata size: <span className="text-cyan-400">~1 KB</span></p>
          <p>Task store size: <span className="text-cyan-400">1M x 1KB = 1 GB</span> (fits in memory, backed by DB)</p>
          <p>Peak execution rate: <span className="text-cyan-400">10,000 tasks/sec</span></p>
          <p>Avg task execution time: <span className="text-cyan-400">~500ms</span></p>
          <p>Workers needed at peak: <span className="text-cyan-400">10K x 0.5s = 5,000 concurrent workers</span></p>
          <p>Execution history at 10K/sec: <span className="text-cyan-400">~864M records/day</span> {'\u2192'} archive to cold storage</p>
          <p>Task results: <span className="text-cyan-400">~500 bytes avg</span> {'\u2192'} ~432 GB/day {'\u2192'} S3 for persistence</p>
        </div>
      </section>

      {/* ---- Section 5: API Design ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">API Design</h2>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-4">
          <div>
            <p className="text-green-400">POST /tasks</p>
            <pre className="text-gray-300 mt-1 ml-4">{`{
  "name": "send-weekly-report",
  "cron": "0 9 * * MON",        // or "once": "2024-03-15T14:00:00Z"
  "payload": { "url": "https://...", "method": "POST", "body": {...} },
  "priority": 5,                 // 1 (lowest) to 10 (highest)
  "max_retries": 3,
  "timeout_ms": 30000,
  "idempotency_key": "report-week-12-2024"
}`}</pre>
            <p className="text-gray-500 mt-1 ml-4">{'\u2192'} 201 Created {'{'} "task_id": "uuid", "next_run_at": "..." {'}'}</p>
          </div>
          <div>
            <p className="text-red-400">DELETE /tasks/:id</p>
            <p className="text-gray-500 ml-4">{'\u2192'} 204 No Content (cancels future executions)</p>
          </div>
          <div>
            <p className="text-cyan-400">GET /tasks/:id/status</p>
            <p className="text-gray-500 ml-4">{'\u2192'} {'{'} "status": "scheduled", "next_run_at": "...", "last_run": {'{'} ... {'}'} {'}'}</p>
          </div>
          <div>
            <p className="text-cyan-400">GET /tasks/:id/history?limit=10</p>
            <p className="text-gray-500 ml-4">{'\u2192'} [{'{'} "execution_id": "...", "started_at": "...", "status": "success" {'}'}]</p>
          </div>
        </div>
      </section>

      {/* ---- Section 6: Data Model ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Data Model</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-indigo-400 font-semibold font-mono mb-2">Task</h3>
            <pre className="text-sm text-gray-300">{`id           UUID (PK)
name         VARCHAR(255)
cron_expr    VARCHAR(100)  -- null for one-time
payload      JSONB
next_run_at  TIMESTAMP (indexed)
status       ENUM: pending, running,
             completed, cancelled
retry_count  INT (default 0)
max_retries  INT (default 3)
priority     INT (1-10)
timeout_ms   INT
idempotency_key VARCHAR (unique)
created_at   TIMESTAMP
updated_at   TIMESTAMP`}</pre>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-pink-400 font-semibold font-mono mb-2">Execution</h3>
            <pre className="text-sm text-gray-300">{`id           UUID (PK)
task_id      UUID (FK → Task)
scheduled_for TIMESTAMP
started_at   TIMESTAMP
completed_at TIMESTAMP
worker_id    VARCHAR
status       ENUM: running, success,
             failed, timed_out
result       JSONB
error        TEXT
retry_number INT`}</pre>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-sm">
          <p className="text-gray-300">
            <strong className="text-yellow-400">Key index:</strong>{' '}
            <code className="text-pink-400">CREATE INDEX idx_due_tasks ON tasks (next_run_at) WHERE status = &apos;pending&apos;</code>.
            The scheduler queries this index every tick to find due tasks.
            With a partial index, lookups are O(log n) on only pending tasks.
          </p>
        </div>
      </section>

      {/* ---- Section 7: High-Level Architecture ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">High-Level Architecture</h2>
        <p className="leading-relaxed">
          The system has five major components: a <strong className="text-indigo-400">Task Store</strong> (database
          holding all task definitions), a <strong className="text-yellow-400">Scheduler</strong> (polls for due
          tasks and enqueues them), a <strong className="text-pink-400">Priority Queue</strong> (buffers tasks
          for workers), a <strong className="text-green-400">Worker Pool</strong> (executes tasks), and a{' '}
          <strong className="text-cyan-400">Result Store</strong> (persists execution outcomes).
        </p>
        <ArchitectureSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Flow:</strong> Clients submit tasks
            via the API Gateway {'\u2192'} tasks are persisted in the Task Store with
            a computed <code className="text-cyan-400">next_run_at</code> {'\u2192'} the Scheduler
            periodically scans for tasks where{' '}
            <code className="text-cyan-400">next_run_at {'<='} now()</code> {'\u2192'} due tasks
            are enqueued into the Priority Queue {'\u2192'} Workers pull from the queue,
            execute, and write results.
          </p>
          <p>
            For recurring tasks, after execution the Scheduler computes the next
            run time from the cron expression and updates{' '}
            <code className="text-cyan-400">next_run_at</code>.
          </p>
        </div>
      </section>

      {/* ---- Section 8: Deep Dive — Timing Wheel & Leader Election ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Timing Wheel &amp; Leader Election
        </h2>
        <p className="leading-relaxed">
          Polling the database every second for due tasks works at small scale but
          becomes expensive at 1M tasks. The <strong className="text-yellow-400">timing wheel</strong>{' '}
          is a circular buffer of time slots. Each slot holds a linked list of
          tasks due at that tick. The scheduler simply advances a pointer and fires
          all tasks in the current bucket &mdash; <strong>O(1)</strong> per tick
          regardless of total task count.
        </p>
        <p className="leading-relaxed">
          Only <strong>one scheduler instance</strong> should be active at any time
          to prevent duplicate scheduling. We achieve this via{' '}
          <strong className="text-yellow-400">leader election</strong>: all scheduler
          nodes participate in a Raft or ZooKeeper-based election. The leader runs
          the timing wheel; standbys watch for failure and take over within seconds.
        </p>
        <TimingWheelSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Hierarchical timing wheels:</strong>{' '}
            For tasks far in the future, use multiple wheel layers (seconds,
            minutes, hours). When a coarse-grained slot fires, tasks cascade
            into the finer wheel &mdash; like clock hands.
          </p>
          <p>
            <strong className="text-green-400">Failover:</strong> If the leader
            dies, the standby takes over. It reloads due tasks from the DB (source
            of truth) and reconstructs the timing wheel. Worst case: a few seconds
            of delay, but no tasks are lost.
          </p>
        </div>
      </section>

      {/* ---- Section 9: Deep Dive — Exactly-Once Execution ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Exactly-Once Execution
        </h2>
        <p className="leading-relaxed">
          The core challenge: how do we guarantee a task runs exactly once, even
          when multiple workers race to pick it up and workers can crash mid-execution?
        </p>
        <p className="leading-relaxed">
          The answer is <strong className="text-indigo-400">pessimistic locking</strong> via
          an atomic database operation. When a worker wants to claim a task, it runs:
        </p>
        <pre className="bg-slate-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">
{`UPDATE tasks
SET status = 'running', worker_id = :worker_id, started_at = NOW()
WHERE id = :task_id AND status = 'pending'
RETURNING id;`}
        </pre>
        <p className="leading-relaxed">
          Because this is a single atomic SQL statement, if two workers race,
          only one gets <code className="text-cyan-400">RETURNING id</code> back.
          The loser gets zero rows and moves on.
        </p>
        <ExactlyOnceSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-cyan-400">Idempotency tokens:</strong> Each
            execution carries a unique token (task_id + scheduled_for). If a
            worker retries due to a transient failure, the downstream system can
            deduplicate using this token. This makes retries safe.
          </p>
          <p>
            <strong className="text-red-400">Edge case:</strong> Worker crashes
            after claiming but before completing. The task is stuck in
            &quot;running&quot; forever. Solution: a reaper process scans for tasks
            with <code className="text-pink-400">status=&apos;running&apos; AND started_at {'<'} NOW() - timeout</code> and
            resets them to &quot;pending&quot; with an incremented retry count.
          </p>
        </div>
      </section>

      {/* ---- Section 10: Deep Dive — Worker Pool ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Deep Dive: Worker Pool &amp; Crash Recovery
        </h2>
        <p className="leading-relaxed">
          Workers use a <strong className="text-pink-400">pull model</strong>: they
          dequeue tasks from the priority queue when they have capacity. This
          naturally provides backpressure &mdash; if workers are overloaded, the
          queue grows and new workers can be auto-scaled.
        </p>
        <p className="leading-relaxed">
          Each worker sends periodic <strong className="text-green-400">heartbeats</strong>.
          If a worker stops heartbeating, the system assumes it has crashed and
          reschedules its in-flight tasks.
        </p>
        <WorkerPoolSketch />
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p>
            <strong className="text-yellow-400">Priority queue:</strong> Tasks with
            higher priority are dequeued first. Within the same priority, FIFO
            ordering applies. This ensures critical tasks (payment processing) are
            not starved by low-priority batch jobs.
          </p>
          <p>
            <strong className="text-red-400">Dead letter queue:</strong> Tasks
            that exceed <code className="text-cyan-400">max_retries</code> are moved
            to a dead letter queue. Operators can inspect, debug, and manually
            retry or discard these tasks. Alert on DLQ depth.
          </p>
        </div>
      </section>

      {/* ---- Section 11: Scaling Strategy ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Scaling Strategy</h2>
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-indigo-400 font-semibold mb-2">Partition tasks by hash(task_id)</h3>
            <p className="text-sm text-gray-300">
              Shard the task store across multiple database partitions using
              consistent hashing on <code className="text-cyan-400">task_id</code>.
              Each partition has its own scheduler shard, so scheduler work is
              distributed. With 16 partitions, each scheduler only manages ~62K
              tasks out of 1M.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-pink-400 font-semibold mb-2">Multiple scheduler shards</h3>
            <p className="text-sm text-gray-300">
              Each shard runs its own leader election. Shard 0 manages tasks with
              hash(id) mod 16 = 0, shard 1 manages mod 16 = 1, etc. This removes
              the single-scheduler bottleneck while maintaining exactly-once
              guarantees within each shard.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-green-400 font-semibold mb-2">Auto-scaling worker pool</h3>
            <p className="text-sm text-gray-300">
              Monitor queue depth and worker CPU utilization. When queue depth
              exceeds a threshold, spin up more workers (Kubernetes HPA or cloud
              auto-scaling groups). Scale down when queue is drained. Target:
              queue wait time {'<'} 100ms at p99.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-cyan-400 font-semibold mb-2">Execution history archival</h3>
            <p className="text-sm text-gray-300">
              At 864M records/day, the execution table would grow unbounded.
              Partition by <code className="text-cyan-400">scheduled_for</code> date.
              Move partitions older than 7 days to cold storage (S3 + Athena).
              Keep recent history in the hot database for fast queries.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 12: Fault Tolerance ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Fault Tolerance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Scheduler failure</h3>
            <p className="text-sm text-gray-300">
              Leader election ensures a standby takes over within seconds. The new
              leader reloads due tasks from the DB (source of truth) and
              reconstructs the in-memory timing wheel. During failover, tasks may
              be slightly delayed but never lost.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Worker failure</h3>
            <p className="text-sm text-gray-300">
              Heartbeat-based detection with configurable timeout (default 30s).
              Crashed worker&apos;s tasks are requeued with retry_count incremented.
              If retry_count exceeds max_retries, the task goes to the dead letter
              queue.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Queue failure</h3>
            <p className="text-sm text-gray-300">
              Use a replicated message queue (e.g., Kafka, Redis Streams with
              replication). The DB is the source of truth &mdash; if the queue
              loses data, the scheduler rescans the DB and re-enqueues due tasks.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Database failure</h3>
            <p className="text-sm text-gray-300">
              Use a replicated database (e.g., PostgreSQL with synchronous
              replication). If the primary fails, promote a replica. The timing
              wheel is rebuilt from the new primary. WAL ensures no committed
              tasks are lost.
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
              Pull vs Push to Workers
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Pull (our choice):</strong> Workers
              request tasks when ready. Natural backpressure, simple load balancing.
              Slight latency overhead from polling.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Push:</strong> Scheduler assigns
              tasks to specific workers. Lower latency but requires the scheduler
              to track worker capacity, complicating the design.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Polling vs Notification for Due Tasks
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">Timing wheel (our choice):</strong>{' '}
              O(1) per tick, very efficient. But requires in-memory state that must
              be rebuilt on failover.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">DB polling:</strong> Stateless
              and simple. But expensive at scale &mdash;{' '}
              <code className="text-cyan-400">SELECT * WHERE next_run_at {'<='} now()</code>{' '}
              every second on 1M rows adds significant DB load.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              DB-Backed vs Queue-Backed Scheduling
            </h3>
            <p className="text-sm text-gray-300">
              <strong className="text-green-400">DB-backed (our choice):</strong> The
              database is the source of truth for task definitions. Strong
              consistency, durable, supports complex queries (history, status).
              The queue is a buffer, not the authority.
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-pink-400">Queue-only:</strong> Higher
              throughput, lower latency. But queues are poor at &quot;what runs at
              3pm tomorrow?&quot; queries. Risk of message loss. Harder to inspect
              and debug. Works better for simple fire-and-forget workloads.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-2">
              Exactly-Once vs At-Least-Once
            </h3>
            <p className="text-sm text-gray-300">
              True exactly-once is expensive (pessimistic locks, idempotency
              tokens). Many systems settle for <em>at-least-once</em> with
              idempotent handlers &mdash; tasks may run twice but produce the
              same result. We chose exactly-once because duplicate task execution
              (e.g., duplicate payments) is unacceptable in many domains.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Summary</h2>
        <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
          <p className="text-gray-300">
            A distributed task scheduler is a fundamental building block. The key
            insights are:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
            <li>
              <strong className="text-yellow-400">Timing wheel</strong> for O(1)
              scheduling with leader election for single-writer safety.
            </li>
            <li>
              <strong className="text-indigo-400">Pessimistic locking</strong>{' '}
              (atomic UPDATE with WHERE clause) for exactly-once task claiming.
            </li>
            <li>
              <strong className="text-pink-400">Pull-based worker pool</strong>{' '}
              with heartbeats, priority queuing, and auto-scaling.
            </li>
            <li>
              <strong className="text-red-400">Dead letter queue</strong> for
              tasks that permanently fail, plus alerting.
            </li>
            <li>
              <strong className="text-green-400">DB as source of truth</strong>{' '}
              with the queue as a performance buffer, not the authority.
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
