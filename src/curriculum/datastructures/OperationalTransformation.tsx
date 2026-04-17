import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/operational-transformation',
  title: 'Operational Transformation: Real-Time Collaboration',
  description:
    'How Google Docs lets multiple people edit the same document at the same time without conflicts — the algorithm that powers real-time collaborative editing',
  track: 'datastructures',
  order: 17,
  tags: [
    'operational-transformation',
    'ot',
    'collaboration',
    'google-docs',
    'crdt',
    'distributed',
    'text-editing',
    'conflict-resolution',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const ACCENT: [number, number, number] = [99, 102, 241]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const PINK: [number, number, number] = [236, 72, 153]
const RED: [number, number, number] = [239, 68, 68]
const TEXT_C: [number, number, number] = [148, 163, 184]

/* ------------------------------------------------------------------ */
/* OT Types and Core Logic                                             */
/* ------------------------------------------------------------------ */

type Op =
  | { type: 'insert'; pos: number; char: string }
  | { type: 'delete'; pos: number }

function applyOp(doc: string, op: Op): string {
  if (op.type === 'insert') {
    return doc.slice(0, op.pos) + op.char + doc.slice(op.pos)
  }
  return doc.slice(0, op.pos) + doc.slice(op.pos + 1)
}

function transformOp(a: Op, b: Op): Op {
  // Transform a against b: produce a' such that apply(apply(doc,b), a') = apply(apply(doc,a), b')
  if (a.type === 'insert' && b.type === 'insert') {
    if (a.pos < b.pos || (a.pos === b.pos && a.char <= b.char)) {
      return { ...a }
    }
    return { ...a, pos: a.pos + 1 }
  }
  if (a.type === 'insert' && b.type === 'delete') {
    if (a.pos <= b.pos) return { ...a }
    return { ...a, pos: a.pos - 1 }
  }
  if (a.type === 'delete' && b.type === 'insert') {
    if (a.pos < b.pos) return { ...a }
    return { ...a, pos: a.pos + 1 }
  }
  // delete vs delete
  if (a.type === 'delete' && b.type === 'delete') {
    if (a.pos < b.pos) return { ...a }
    if (a.pos > b.pos) return { ...a, pos: a.pos - 1 }
    // Same position: both delete the same char, a becomes a no-op
    // We represent this as insert of empty at 0 (identity op)
    return { type: 'insert', pos: 0, char: '' }
  }
  return { ...a }
}

function opToString(op: Op): string {
  if (op.type === 'insert') return `ins('${op.char}', ${op.pos})`
  return `del(${op.pos})`
}

/* ------------------------------------------------------------------ */
/* Helper: draw character boxes for a document string                  */
/* ------------------------------------------------------------------ */

function drawDocBoxes(
  p: p5,
  doc: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  highlightPos: number,
  highlightColor: [number, number, number],
  label: string
) {
  p.noStroke()
  p.fill(...TEXT_C)
  p.textSize(11)
  p.textAlign(p.LEFT, p.BOTTOM)
  p.text(label, x, y - 4)

  for (let i = 0; i < doc.length; i++) {
    const bx = x + i * (boxW + 3)
    const isHighlighted = i === highlightPos

    if (isHighlighted) {
      p.fill(highlightColor[0], highlightColor[1], highlightColor[2], 60)
      p.stroke(...highlightColor)
    } else {
      p.fill(30, 41, 59)
      p.stroke(55, 65, 81)
    }
    p.strokeWeight(1.5)
    p.rect(bx, y, boxW, boxH, 4)

    p.noStroke()
    p.fill(isHighlighted ? 255 : 200)
    p.textSize(16)
    p.textAlign(p.CENTER, p.CENTER)
    p.textFont('monospace')
    p.text(doc[i], bx + boxW / 2, y + boxH / 2)
  }
  // reset font
  p.textFont('sans-serif')
}

/* ------------------------------------------------------------------ */
/* Section 1 — Naive Approach Fails (animated step-through)            */
/* ------------------------------------------------------------------ */

function NaiveApproachSketch() {
  const [showOT, setShowOT] = useState(false)
  const showOTRef = useRef(showOT)
  showOTRef.current = showOT

  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 600

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      const cx = p.width / 2
      const s = stepRef.current
      const withOT = showOTRef.current

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      p.text(withOT ? 'With OT Transformation' : 'Naive Approach (No Transformation)', 15, 12)
      p.fill(...TEXT_C)
      p.textSize(11)
      p.text(`Step ${s} of 4`, 15, 32)

      const doc0 = 'ABCDE'
      const boxW = 38
      const boxH = 36

      // Step 0: original document
      const baseX = cx - (doc0.length * (boxW + 3)) / 2
      drawDocBoxes(p, doc0, baseX, 65, boxW, boxH, -1, GREEN, 'Original Document:')

      if (s >= 1) {
        // User A: insert 'X' at position 2
        p.noStroke()
        p.fill(...ACCENT)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('User A: insert "X" at position 2', 15, 125)

        const docA = 'ABXCDE'
        const axStart = cx - (docA.length * (boxW + 3)) / 2
        drawDocBoxes(p, docA, axStart, 145, boxW, boxH, 2, ACCENT, 'After A:')

        // User B: delete position 3 (the "D")
        p.noStroke()
        p.fill(...PINK)
        p.textSize(12)
        p.text('User B: delete position 3 (the "D")', p.width / 2 + 10, 125)

        const docB = 'ABCE'
        const bxStart = cx - (docB.length * (boxW + 3)) / 2
        drawDocBoxes(p, docB, bxStart, 205, boxW, boxH, -1, PINK, 'After B:')

        // Mark deleted char
        p.fill(...RED)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('("D" removed)', bxStart + 3 * (boxW + 3) + boxW + 8, 215)
      }

      if (s >= 2) {
        // Apply A then B naively
        p.noStroke()
        p.fill(...YELLOW)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Apply A first, then B (delete pos 3):', 15, 280)

        const docAB_naive = 'ABXDE'  // Wrong! Deleted 'C' instead of 'D'
        if (!withOT) {
          const abX = cx - (docAB_naive.length * (boxW + 3)) / 2
          drawDocBoxes(p, 'ABXCDE', abX, 300, boxW, boxH, 3, RED, 'Before delete:')

          // Draw strike through position 3
          ctx.setLineDash([4, 3])
          p.stroke(...RED)
          p.strokeWeight(2)
          const strikeX = abX + 3 * (boxW + 3) + boxW / 2
          p.line(strikeX - 12, 318, strikeX + 12, 318)
          ctx.setLineDash([])

          p.noStroke()
          p.fill(...RED)
          p.textSize(10)
          p.text('Deletes "C" not "D"!', abX + 4 * (boxW + 3) + boxW + 10, 310)
        } else {
          p.fill(...GREEN)
          p.textSize(11)
          p.text('Transform: B was del(3), A was ins(2). Since 3 >= 2, B\' = del(3+1) = del(4)', 15, 295)

          const abX = cx - ('ABXCDE'.length * (boxW + 3)) / 2
          drawDocBoxes(p, 'ABXCDE', abX, 315, boxW, boxH, 4, GREEN, 'Before transformed delete:')

          ctx.setLineDash([4, 3])
          p.stroke(...GREEN)
          p.strokeWeight(2)
          const strikeX = abX + 4 * (boxW + 3) + boxW / 2
          p.line(strikeX - 12, 333, strikeX + 12, 333)
          ctx.setLineDash([])

          p.noStroke()
          p.fill(...GREEN)
          p.textSize(10)
          p.text('Correctly deletes "D"', abX + 5 * (boxW + 3) + boxW + 10, 325)
        }
      }

      if (s >= 3) {
        const y3 = withOT ? 385 : 375
        p.noStroke()
        p.fill(...(withOT ? GREEN : YELLOW))
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(withOT ? 'Result (correct):' : 'Naive result:', 15, y3)

        if (!withOT) {
          const resX = cx - ('ABXDE'.length * (boxW + 3)) / 2
          drawDocBoxes(p, 'ABXDE', resX, y3 + 20, boxW, boxH, -1, YELLOW, '')
          p.fill(...RED)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text('"C" was deleted instead of "D" \u2014 WRONG!', cx, y3 + 65)
        } else {
          const resX = cx - ('ABXCE'.length * (boxW + 3)) / 2
          drawDocBoxes(p, 'ABXCE', resX, y3 + 20, boxW, boxH, -1, GREEN, '')
          p.fill(...GREEN)
          p.textSize(11)
          p.textAlign(p.CENTER, p.TOP)
          p.text('"D" correctly deleted, "X" inserted \u2014 CORRECT!', cx, y3 + 65)
        }
      }

      if (s >= 4) {
        const y4 = withOT ? 480 : 465
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        if (!withOT) {
          p.text('The insert shifted all positions, but the naive approach ignored this.', cx, y4)
          p.text('OT fixes this by transforming operations against each other.', cx, y4 + 16)
        } else {
          p.text('OT adjusted B\'s delete position to account for A\'s insert.', cx, y4)
          p.text('Both orderings (A then B\' or B then A\') produce the same final document.', cx, y4 + 16)
        }
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      controls={
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
          >
            Prev
          </button>
          <button
            onClick={() => setStep(s => Math.min(4, s + 1))}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
          >
            Next
          </button>
          <button
            onClick={() => { setShowOT(v => !v); setStep(0) }}
            className={`px-3 py-1 rounded text-sm ${showOT ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-pink-600 hover:bg-pink-500'} text-white`}
          >
            {showOT ? 'Showing: With OT' : 'Showing: Naive (Broken)'}
          </button>
          <button
            onClick={() => setStep(0)}
            className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
          >
            Reset
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Diamond Diagram (the core OT visualization)             */
/* ------------------------------------------------------------------ */

function DiamondDiagramSketch() {
  const [animProgress, setAnimProgress] = useState(0)
  const progressRef = useRef(0)
  const autoPlayRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 650
    let frame = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      frame++

      const prog = progressRef.current
      const cx = p.width / 2
      const cy = 320

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      p.text('OT Diamond Diagram: Convergence Guarantee', 15, 12)

      // Diamond coordinates
      const topY = cy - 180
      const midY = cy
      const botY = cy + 180
      const leftX = cx - 200
      const rightX = cx + 200

      // Document labels
      const docS = 'HELLO'
      const opA: Op = { type: 'insert', pos: 5, char: '!' }
      const opB: Op = { type: 'insert', pos: 0, char: '>' }
      const docA = applyOp(docS, opA) // HELLO!
      const docB = applyOp(docS, opB) // >HELLO
      const opAp = transformOp(opA, opB) // ins at 6
      const opBp = transformOp(opB, opA) // ins at 0
      const docFinal = applyOp(docA, opBp) // >HELLO!

      // Animated pulse
      const pulse = Math.sin(frame * 0.04) * 0.3 + 0.7

      // Draw the diamond edges
      // S -> A (top-left to mid-left) — User A's operation
      const drawPhase1 = Math.min(prog / 25, 1)
      // S -> B (top-left to mid-right) — User B's operation
      const drawPhase2 = Math.min(Math.max((prog - 10) / 25, 0), 1)
      // A -> Final (mid-left to bottom) — transformed B' applied to A
      const drawPhase3 = Math.min(Math.max((prog - 40) / 25, 0), 1)
      // B -> Final (mid-right to bottom) — transformed A' applied to B
      const drawPhase4 = Math.min(Math.max((prog - 50) / 25, 0), 1)

      // Grid lines for reference
      ctx.globalAlpha = 0.15
      ctx.setLineDash([2, 6])
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(cx, topY - 30, cx, botY + 50)
      p.line(leftX - 40, midY, rightX + 40, midY)
      ctx.setLineDash([])
      ctx.globalAlpha = 1.0

      // Draw diamond edges with animation
      // Edge S -> S_A
      if (drawPhase1 > 0) {
        const ex = cx + (leftX - cx) * drawPhase1
        const ey = topY + (midY - topY) * drawPhase1
        p.stroke(...ACCENT)
        p.strokeWeight(3)
        p.line(cx, topY, ex, ey)

        // Arrow particle
        if (drawPhase1 < 1) {
          p.noStroke()
          p.fill(ACCENT[0], ACCENT[1], ACCENT[2], 200)
          p.ellipse(ex, ey, 10, 10)
        }

        // Label on edge
        if (drawPhase1 > 0.3) {
          p.noStroke()
          p.fill(...ACCENT)
          p.textSize(11)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`A: ${opToString(opA)}`, (cx + leftX) / 2 - 10, (topY + midY) / 2 - 12)
        }
      }

      // Edge S -> S_B
      if (drawPhase2 > 0) {
        const ex = cx + (rightX - cx) * drawPhase2
        const ey = topY + (midY - topY) * drawPhase2
        p.stroke(...PINK)
        p.strokeWeight(3)
        p.line(cx, topY, ex, ey)

        if (drawPhase2 < 1) {
          p.noStroke()
          p.fill(PINK[0], PINK[1], PINK[2], 200)
          p.ellipse(ex, ey, 10, 10)
        }

        if (drawPhase2 > 0.3) {
          p.noStroke()
          p.fill(...PINK)
          p.textSize(11)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`B: ${opToString(opB)}`, (cx + rightX) / 2 + 10, (topY + midY) / 2 - 12)
        }
      }

      // Edge S_A -> S' (apply B' to A's state)
      if (drawPhase3 > 0) {
        const sx = leftX
        const sy = midY
        const ex = leftX + (cx - leftX) * drawPhase3
        const ey = midY + (botY - midY) * drawPhase3
        p.stroke(...PINK)
        p.strokeWeight(2)
        ctx.setLineDash([6, 4])
        p.line(sx, sy, ex, ey)
        ctx.setLineDash([])

        if (drawPhase3 < 1) {
          p.noStroke()
          p.fill(PINK[0], PINK[1], PINK[2], 200)
          p.ellipse(ex, ey, 8, 8)
        }

        if (drawPhase3 > 0.3) {
          p.noStroke()
          p.fill(...PINK)
          p.textSize(10)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`B': ${opToString(opBp)}`, (leftX + cx) / 2 - 8, (midY + botY) / 2 - 12)
        }
      }

      // Edge S_B -> S' (apply A' to B's state)
      if (drawPhase4 > 0) {
        const sx = rightX
        const sy = midY
        const ex = rightX + (cx - rightX) * drawPhase4
        const ey = midY + (botY - midY) * drawPhase4
        p.stroke(...ACCENT)
        p.strokeWeight(2)
        ctx.setLineDash([6, 4])
        p.line(sx, sy, ex, ey)
        ctx.setLineDash([])

        if (drawPhase4 < 1) {
          p.noStroke()
          p.fill(ACCENT[0], ACCENT[1], ACCENT[2], 200)
          p.ellipse(ex, ey, 8, 8)
        }

        if (drawPhase4 > 0.3) {
          p.noStroke()
          p.fill(...ACCENT)
          p.textSize(10)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`A': ${opToString(opAp)}`, (rightX + cx) / 2 + 8, (midY + botY) / 2 - 12)
        }
      }

      // Draw state nodes
      // S (top)
      p.fill(40, 50, 70)
      p.stroke(...GRID_C)
      p.strokeWeight(2)
      p.ellipse(cx, topY, 70, 44)
      p.noStroke()
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.CENTER, p.CENTER)
      p.textFont('monospace')
      p.text(docS, cx, topY)
      p.textFont('sans-serif')
      p.fill(...TEXT_C)
      p.textSize(9)
      p.text('S (initial)', cx, topY - 30)

      // S_A (mid-left)
      if (drawPhase1 >= 1) {
        p.fill(ACCENT[0], ACCENT[1], ACCENT[2], 30)
        p.stroke(...ACCENT)
        p.strokeWeight(2)
        p.ellipse(leftX, midY, 80, 44)
        p.noStroke()
        p.fill(255)
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.textFont('monospace')
        p.text(docA, leftX, midY)
        p.textFont('sans-serif')
        p.fill(...ACCENT)
        p.textSize(9)
        p.text('S_A (User A)', leftX, midY - 30)
      }

      // S_B (mid-right)
      if (drawPhase2 >= 1) {
        p.fill(PINK[0], PINK[1], PINK[2], 30)
        p.stroke(...PINK)
        p.strokeWeight(2)
        p.ellipse(rightX, midY, 80, 44)
        p.noStroke()
        p.fill(255)
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.textFont('monospace')
        p.text(docB, rightX, midY)
        p.textFont('sans-serif')
        p.fill(...PINK)
        p.textSize(9)
        p.text('S_B (User B)', rightX, midY - 30)
      }

      // S' (bottom — final converged state)
      if (drawPhase3 >= 1 && drawPhase4 >= 1) {
        const glowAlpha = pulse * 60
        p.fill(GREEN[0], GREEN[1], GREEN[2], glowAlpha)
        p.noStroke()
        p.ellipse(cx, botY, 100, 56)

        p.fill(GREEN[0], GREEN[1], GREEN[2], 30)
        p.stroke(...GREEN)
        p.strokeWeight(2)
        p.ellipse(cx, botY, 86, 48)
        p.noStroke()
        p.fill(255)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.textFont('monospace')
        p.text(docFinal, cx, botY)
        p.textFont('sans-serif')
        p.fill(...GREEN)
        p.textSize(10)
        p.text('S\' (converged!)', cx, botY - 32)

        // Convergence message
        p.fill(...GREEN)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Both paths arrive at the same final state!', cx, botY + 40)
      }

      // Legend at bottom
      p.noStroke()
      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Solid lines = original operations | Dashed lines = transformed operations', 15, H - 10)

      // Auto-play
      if (autoPlayRef.current && prog < 100) {
        progressRef.current = Math.min(prog + 0.6, 100)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      controls={
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="range"
            min={0}
            max={100}
            value={animProgress}
            onChange={e => {
              const v = Number(e.target.value)
              setAnimProgress(v)
              progressRef.current = v
              autoPlayRef.current = false
            }}
            className="w-48"
          />
          <button
            onClick={() => { progressRef.current = 0; setAnimProgress(0); autoPlayRef.current = true }}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
          >
            Play Animation
          </button>
          <button
            onClick={() => { autoPlayRef.current = false }}
            className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
          >
            Pause
          </button>
          <span className="text-gray-400 text-xs">Drag slider to scrub through the diamond diagram</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Interactive Transform Rules Explorer                     */
/* ------------------------------------------------------------------ */

function TransformRulesSketch() {
  const [opAType, setOpAType] = useState<'insert' | 'delete'>('insert')
  const [opBType, setOpBType] = useState<'delete' | 'insert'>('delete')
  const [posA, setPosA] = useState(2)
  const [posB, setPosB] = useState(3)
  const [charA, setCharA] = useState('X')

  const opATypeRef = useRef(opAType)
  const opBTypeRef = useRef(opBType)
  const posARef = useRef(posA)
  const posBRef = useRef(posB)
  const charARef = useRef(charA)
  opATypeRef.current = opAType
  opBTypeRef.current = opBType
  posARef.current = posA
  posBRef.current = posB
  charARef.current = charA

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 550

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      const cx = p.width / 2

      const doc = 'ABCDEF'
      const boxW = 38
      const boxH = 34

      // Build operations
      const aType = opATypeRef.current
      const bType = opBTypeRef.current
      const aPos = Math.min(posARef.current, aType === 'insert' ? doc.length : doc.length - 1)
      const bPos = Math.min(posBRef.current, bType === 'insert' ? doc.length : doc.length - 1)

      const opA: Op = aType === 'insert'
        ? { type: 'insert', pos: aPos, char: charARef.current }
        : { type: 'delete', pos: aPos }
      const opB: Op = bType === 'insert'
        ? { type: 'insert', pos: bPos, char: 'Y' }
        : { type: 'delete', pos: bPos }

      const opAp = transformOp(opA, opB)
      const opBp = transformOp(opB, opA)

      // Apply operations
      const docAfterA = applyOp(doc, opA)
      const docAfterB = applyOp(doc, opB)

      // Apply transformed ops
      let docABp = docAfterA
      if (opBp.type === 'insert' && opBp.char === '') {
        // no-op from delete-delete conflict
      } else {
        try { docABp = applyOp(docAfterA, opBp) } catch { /* bounds */ }
      }

      let docBAp = docAfterB
      if (opAp.type === 'insert' && opAp.char === '') {
        // no-op
      } else {
        try { docBAp = applyOp(docAfterB, opAp) } catch { /* bounds */ }
      }

      const converged = docABp === docBAp

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Interactive Transform Rules', 15, 12)

      // Original document
      const baseX = cx - (doc.length * (boxW + 3)) / 2
      drawDocBoxes(p, doc, baseX, 50, boxW, boxH, -1, GRID_C, 'Original:')

      // Op A label
      p.noStroke()
      p.fill(...ACCENT)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`User A: ${opToString(opA)}`, 15, 110)

      // Doc after A
      const axStart = 15
      drawDocBoxes(p, docAfterA, axStart, 130, boxW, boxH,
        opA.type === 'insert' ? opA.pos : -1, ACCENT, '')

      // Op B label
      p.noStroke()
      p.fill(...PINK)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`User B: ${opToString(opB)}`, p.width / 2, 110)

      // Doc after B
      drawDocBoxes(p, docAfterB, p.width / 2, 130, boxW, boxH,
        opB.type === 'insert' ? opB.pos : -1, PINK, '')

      // Divider
      ctx.setLineDash([4, 4])
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(20, 190, p.width - 20, 190)
      ctx.setLineDash([])

      // Transform results
      p.noStroke()
      p.fill(...YELLOW)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('After OT Transform:', 15, 205)

      // Transformed ops
      p.fill(...ACCENT)
      p.textSize(11)
      p.text(`A' = transform(A, B) = ${opToString(opAp)}`, 15, 228)

      p.fill(...PINK)
      p.text(`B' = transform(B, A) = ${opToString(opBp)}`, 15, 248)

      // Path 1: Apply A then B'
      p.fill(...TEXT_C)
      p.textSize(11)
      p.text('Path 1: apply A, then B\':', 15, 280)
      drawDocBoxes(p, docABp, 15, 300, boxW, boxH, -1, ACCENT, '')

      // Path 2: Apply B then A'
      p.fill(...TEXT_C)
      p.textSize(11)
      p.text('Path 2: apply B, then A\':', 15, 360)
      drawDocBoxes(p, docBAp, 15, 380, boxW, boxH, -1, PINK, '')

      // Convergence check
      if (converged) {
        p.fill(GREEN[0], GREEN[1], GREEN[2], 40)
        p.noStroke()
        p.rect(10, 435, p.width - 20, 40, 8)
        p.fill(...GREEN)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Converged! Both paths produce: "${docABp}"`, cx, 455)
      } else {
        p.fill(RED[0], RED[1], RED[2], 40)
        p.noStroke()
        p.rect(10, 435, p.width - 20, 40, 8)
        p.fill(...RED)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Diverged! (edge case)', cx, 455)
      }

      // Rule explanation
      p.fill(...TEXT_C)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      let ruleText = ''
      if (opA.type === 'insert' && opB.type === 'insert') {
        ruleText = `insert vs insert: ${opA.pos < opB.pos ? 'A is earlier, B shifts right' : opA.pos > opB.pos ? 'B is earlier, A shifts right' : 'same position, tie-break by char value'}`
      } else if (opA.type === 'insert' && opB.type === 'delete') {
        ruleText = `insert vs delete: ${opA.pos <= opB.pos ? 'insert is before delete, delete shifts right' : 'insert is after delete, insert shifts left'}`
      } else if (opA.type === 'delete' && opB.type === 'insert') {
        ruleText = `delete vs insert: ${opA.pos < opB.pos ? 'delete is before insert, insert shifts left' : 'delete is after insert, delete shifts right'}`
      } else {
        ruleText = opA.pos === opB.pos
          ? 'delete vs delete (same pos): both delete same char, one becomes no-op'
          : `delete vs delete: ${opA.pos < opB.pos ? 'A is earlier, B shifts left' : 'B is earlier, A shifts left'}`
      }
      p.text(`Rule: ${ruleText}`, 15, 490)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      controls={
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-300">
            A:
            <select
              value={opAType}
              onChange={e => setOpAType(e.target.value as 'insert' | 'delete')}
              className="ml-1 bg-slate-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="insert">insert</option>
              <option value="delete">delete</option>
            </select>
          </label>
          <label className="text-sm text-gray-300">
            pos:
            <input
              type="range" min={0} max={5} value={posA}
              onChange={e => setPosA(Number(e.target.value))}
              className="ml-1 w-24"
            />
            <span className="ml-1 text-indigo-400">{posA}</span>
          </label>
          {opAType === 'insert' && (
            <label className="text-sm text-gray-300">
              char:
              <input
                type="text" maxLength={1} value={charA}
                onChange={e => setCharA(e.target.value || 'X')}
                className="ml-1 w-10 bg-slate-700 text-white rounded px-2 py-1 text-sm text-center"
              />
            </label>
          )}
          <span className="text-gray-500">|</span>
          <label className="text-sm text-gray-300">
            B:
            <select
              value={opBType}
              onChange={e => setOpBType(e.target.value as 'insert' | 'delete')}
              className="ml-1 bg-slate-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="insert">insert</option>
              <option value="delete">delete</option>
            </select>
          </label>
          <label className="text-sm text-gray-300">
            pos:
            <input
              type="range" min={0} max={5} value={posB}
              onChange={e => setPosB(Number(e.target.value))}
              className="ml-1 w-24"
            />
            <span className="ml-1 text-pink-400">{posB}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Client-Server OT Protocol Sequence Diagram              */
/* ------------------------------------------------------------------ */

function ProtocolSketch() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  interface SeqStep {
    desc: string
    arrows: Array<{
      from: number // 0=Server, 1=ClientA, 2=ClientB
      to: number
      label: string
      color: [number, number, number]
    }>
    serverDoc: string
    clientADoc: string
    clientBDoc: string
    serverNote?: string
  }

  const stepsData: SeqStep[] = [
    {
      desc: 'Initial state: all participants have "HELLO"',
      arrows: [],
      serverDoc: 'HELLO', clientADoc: 'HELLO', clientBDoc: 'HELLO',
    },
    {
      desc: 'Client A types "!" at end (pos 5). Sends ins("!", 5) rev=0 to server.',
      arrows: [{ from: 1, to: 0, label: 'ins("!",5) r0', color: ACCENT }],
      serverDoc: 'HELLO', clientADoc: 'HELLO!', clientBDoc: 'HELLO',
    },
    {
      desc: 'Client B inserts ">" at start (pos 0). Sends ins(">", 0) rev=0 to server.',
      arrows: [{ from: 2, to: 0, label: 'ins(">",0) r0', color: PINK }],
      serverDoc: 'HELLO', clientADoc: 'HELLO!', clientBDoc: '>HELLO',
    },
    {
      desc: 'Server receives A\'s op first. Applies ins("!", 5). Server doc becomes "HELLO!". Rev=1.',
      arrows: [],
      serverDoc: 'HELLO!', clientADoc: 'HELLO!', clientBDoc: '>HELLO',
      serverNote: 'Applied A\'s op. Rev 0 \u2192 1',
    },
    {
      desc: 'Server broadcasts A\'s op to Client B.',
      arrows: [{ from: 0, to: 2, label: 'ins("!",5)', color: ACCENT }],
      serverDoc: 'HELLO!', clientADoc: 'HELLO!', clientBDoc: '>HELLO!',
    },
    {
      desc: 'Server receives B\'s op (rev=0). Must transform against ops since rev 0: A\'s ins("!",5).',
      arrows: [],
      serverDoc: 'HELLO!', clientADoc: 'HELLO!', clientBDoc: '>HELLO!',
      serverNote: 'Transform B against A: ins(">",0) stays ins(">",0)',
    },
    {
      desc: 'Server applies transformed B\'. Doc becomes ">HELLO!". Rev=2.',
      arrows: [],
      serverDoc: '>HELLO!', clientADoc: 'HELLO!', clientBDoc: '>HELLO!',
      serverNote: 'Applied B\'. Rev 1 \u2192 2',
    },
    {
      desc: 'Server broadcasts transformed B\' to Client A. A applies it.',
      arrows: [{ from: 0, to: 1, label: 'ins(">",0)', color: PINK }],
      serverDoc: '>HELLO!', clientADoc: '>HELLO!', clientBDoc: '>HELLO!',
    },
    {
      desc: 'All participants converged to ">HELLO!"',
      arrows: [],
      serverDoc: '>HELLO!', clientADoc: '>HELLO!', clientBDoc: '>HELLO!',
    },
  ]

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 680

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      const s = stepRef.current
      const data = stepsData[s]

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      p.text('OT Protocol: Client-Server Sequence', 15, 12)
      p.fill(...TEXT_C)
      p.textSize(11)
      p.text(`Step ${s} of ${stepsData.length - 1}`, 15, 32)

      // Participant columns
      const cols = [
        { x: 140, label: 'Client A', color: ACCENT },
        { x: p.width / 2, label: 'Server', color: YELLOW },
        { x: p.width - 140, label: 'Client B', color: PINK },
      ]

      const topY = 70
      const lineTop = 110
      const lineBot = 530

      // Draw column headers and lifelines
      for (const col of cols) {
        // Header box
        p.fill(col.color[0], col.color[1], col.color[2], 30)
        p.stroke(...col.color)
        p.strokeWeight(1.5)
        p.rect(col.x - 50, topY, 100, 30, 6)
        p.noStroke()
        p.fill(...col.color)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(col.label, col.x, topY + 15)

        // Lifeline
        ctx.setLineDash([4, 4])
        p.stroke(col.color[0], col.color[1], col.color[2], 80)
        p.strokeWeight(1)
        p.line(col.x, lineTop, col.x, lineBot)
        ctx.setLineDash([])
      }

      // Draw arrows for current step
      const arrowY = 140 + s * 42
      for (const arrow of data.arrows) {
        const fromX = cols[arrow.from === 0 ? 1 : arrow.from === 1 ? 0 : 2].x
        const toX = cols[arrow.to === 0 ? 1 : arrow.to === 1 ? 0 : 2].x

        p.stroke(...arrow.color)
        p.strokeWeight(2)
        p.line(fromX, arrowY, toX, arrowY)

        // Arrowhead
        const dir = toX > fromX ? 1 : -1
        p.fill(...arrow.color)
        p.noStroke()
        p.triangle(
          toX, arrowY,
          toX - dir * 10, arrowY - 5,
          toX - dir * 10, arrowY + 5
        )

        // Label
        p.textSize(9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.fill(...arrow.color)
        p.text(arrow.label, (fromX + toX) / 2, arrowY - 6)
      }

      // Server note
      if (data.serverNote) {
        p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 20)
        p.noStroke()
        p.rect(cols[1].x - 90, arrowY - 18, 180, 36, 4)
        p.fill(...YELLOW)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(data.serverNote, cols[1].x, arrowY)
      }

      // Timeline dots for all steps
      for (let i = 0; i <= Math.min(s, stepsData.length - 1); i++) {
        const dy = 140 + i * 42
        const dotAlpha = i === s ? 255 : 80
        for (let c = 0; c < 3; c++) {
          p.fill(cols[c].color[0], cols[c].color[1], cols[c].color[2], dotAlpha)
          p.noStroke()
          p.ellipse(cols[c].x, dy, i === s ? 8 : 5)
        }
      }

      // Document states
      const docY = 555
      p.noStroke()
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Current Document State:', p.width / 2, docY)

      const docs = [data.clientADoc, data.serverDoc, data.clientBDoc]
      for (let c = 0; c < 3; c++) {
        p.fill(cols[c].color[0], cols[c].color[1], cols[c].color[2], 25)
        p.stroke(cols[c].color[0], cols[c].color[1], cols[c].color[2], 80)
        p.strokeWeight(1)
        p.rect(cols[c].x - 55, docY + 20, 110, 32, 6)
        p.noStroke()
        p.fill(255)
        p.textSize(14)
        p.textFont('monospace')
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`"${docs[c]}"`, cols[c].x, docY + 36)
        p.textFont('sans-serif')
      }

      // All converged?
      if (s === stepsData.length - 1) {
        p.fill(GREEN[0], GREEN[1], GREEN[2], 40)
        p.noStroke()
        p.rect(20, docY + 60, p.width - 40, 30, 6)
        p.fill(...GREEN)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('All participants converged!', p.width / 2, docY + 75)
      }

      // Description
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(data.desc, 15, H - 10)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      controls={
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
          >
            Prev
          </button>
          <button
            onClick={() => setStep(s => Math.min(stepsData.length - 1, s + 1))}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
          >
            Next
          </button>
          <button
            onClick={() => setStep(0)}
            className="px-3 py-1 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
          >
            Reset
          </button>
          <span className="text-gray-400 text-xs">
            Step {step}/{stepsData.length - 1}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python code strings                                                 */
/* ------------------------------------------------------------------ */

const pythonOTTransform = `# Operational Transformation: Core Transform Function
# Implements transform rules for insert and delete operations on plain text

def transform(op_a, op_b):
    """Transform op_a against op_b.
    Returns op_a' such that apply(apply(doc, op_b), op_a') == apply(apply(doc, op_a), op_b')

    Operations are tuples: ('ins', pos, char) or ('del', pos)
    """
    a_type, b_type = op_a[0], op_b[0]

    if a_type == 'ins' and b_type == 'ins':
        a_pos, a_char = op_a[1], op_a[2]
        b_pos, b_char = op_b[1], op_b[2]
        # If A inserts before B, or at same position with lower char (tie-break)
        if a_pos < b_pos or (a_pos == b_pos and a_char <= b_char):
            return op_a  # A's position unchanged
        else:
            return ('ins', a_pos + 1, a_char)  # Shift right past B's insert

    elif a_type == 'ins' and b_type == 'del':
        a_pos, a_char = op_a[1], op_a[2]
        b_pos = op_b[1]
        if a_pos <= b_pos:
            return op_a  # Insert before delete, no change
        else:
            return ('ins', a_pos - 1, a_char)  # Shift left past deleted char

    elif a_type == 'del' and b_type == 'ins':
        a_pos = op_a[1]
        b_pos = op_b[1]
        if a_pos < b_pos:
            return op_a  # Delete before insert, no change
        else:
            return ('del', a_pos + 1)  # Shift right past inserted char

    else:  # del vs del
        a_pos, b_pos = op_a[1], op_b[1]
        if a_pos < b_pos:
            return op_a  # Delete before other delete
        elif a_pos > b_pos:
            return ('del', a_pos - 1)  # Shift left
        else:
            return ('noop',)  # Both delete same char, becomes no-op

def apply_op(doc, op):
    """Apply an operation to a document string."""
    if op[0] == 'ins':
        pos, char = op[1], op[2]
        return doc[:pos] + char + doc[pos:]
    elif op[0] == 'del':
        pos = op[1]
        return doc[:pos] + doc[pos+1:]
    return doc  # noop

# --------------------------------------------------
# Test: Two concurrent operations on "ABCDE"
# --------------------------------------------------
doc = "ABCDE"
op_a = ('ins', 2, 'X')   # User A: insert 'X' at position 2
op_b = ('del', 3)         # User B: delete position 3 (the 'D')

print(f"Original document:  \\"{doc}\\"")
print(f"User A operation:   {op_a}  (insert 'X' at pos 2)")
print(f"User B operation:   {op_b}  (delete char at pos 3, which is 'D')")
print()

# Transform operations against each other
op_a_prime = transform(op_a, op_b)  # A' to apply after B
op_b_prime = transform(op_b, op_a)  # B' to apply after A

print(f"Transformed A' = transform(A, B) = {op_a_prime}")
print(f"Transformed B' = transform(B, A) = {op_b_prime}")
print()

# Path 1: Apply A then B'
doc_path1 = apply_op(doc, op_a)
print(f"Path 1: apply A to \\"{doc}\\"  ->  \\"{doc_path1}\\"")
doc_path1 = apply_op(doc_path1, op_b_prime)
print(f"         apply B' to above   ->  \\"{doc_path1}\\"")

# Path 2: Apply B then A'
doc_path2 = apply_op(doc, op_b)
print(f"Path 2: apply B to \\"{doc}\\"  ->  \\"{doc_path2}\\"")
doc_path2 = apply_op(doc_path2, op_a_prime)
print(f"         apply A' to above   ->  \\"{doc_path2}\\"")

print()
converged = doc_path1 == doc_path2
print(f"Path 1 result: \\"{doc_path1}\\"")
print(f"Path 2 result: \\"{doc_path2}\\"")
print(f"Converged: {converged}")
print()

# --------------------------------------------------
# Test all transform rule combinations
# --------------------------------------------------
print("=" * 55)
print("Testing all transform rule combinations:")
print("=" * 55)

test_cases = [
    ("ABCDE", ('ins', 1, 'X'), ('ins', 3, 'Y'), "ins vs ins (A before B)"),
    ("ABCDE", ('ins', 3, 'X'), ('ins', 1, 'Y'), "ins vs ins (A after B)"),
    ("ABCDE", ('ins', 2, 'X'), ('ins', 2, 'Y'), "ins vs ins (same pos)"),
    ("ABCDE", ('ins', 1, 'X'), ('del', 3),       "ins vs del (ins before del)"),
    ("ABCDE", ('ins', 4, 'X'), ('del', 1),       "ins vs del (ins after del)"),
    ("ABCDE", ('del', 1),      ('ins', 3, 'Y'),  "del vs ins (del before ins)"),
    ("ABCDE", ('del', 4),      ('ins', 1, 'Y'),  "del vs ins (del after ins)"),
    ("ABCDE", ('del', 1),      ('del', 3),       "del vs del (different pos)"),
    ("ABCDE", ('del', 2),      ('del', 2),       "del vs del (same pos)"),
]

all_pass = True
for doc_t, a, b, desc in test_cases:
    a_p = transform(a, b)
    b_p = transform(b, a)

    r1 = apply_op(apply_op(doc_t, a), b_p)
    r2 = apply_op(apply_op(doc_t, b), a_p)

    ok = r1 == r2
    if not ok:
        all_pass = False
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {desc}: \\"{r1}\\" == \\"{r2}\\"")

print()
print(f"All tests passed: {all_pass}")
`

const pythonCollabSession = `# Simulating a Collaborative Editing Session with OT
# 3 users making concurrent edits, server transforming and broadcasting

def transform(op_a, op_b):
    """Transform op_a against op_b."""
    a_type, b_type = op_a[0], op_b[0]
    if a_type == 'ins' and b_type == 'ins':
        a_pos, a_char = op_a[1], op_a[2]
        b_pos, b_char = op_b[1], op_b[2]
        if a_pos < b_pos or (a_pos == b_pos and a_char <= b_char):
            return op_a
        return ('ins', a_pos + 1, a_char)
    elif a_type == 'ins' and b_type == 'del':
        a_pos, a_char = op_a[1], op_a[2]
        b_pos = op_b[1]
        if a_pos <= b_pos:
            return op_a
        return ('ins', a_pos - 1, a_char)
    elif a_type == 'del' and b_type == 'ins':
        a_pos = op_a[1]
        b_pos = op_b[1]
        if a_pos < b_pos:
            return op_a
        return ('del', a_pos + 1)
    else:
        a_pos, b_pos = op_a[1], op_b[1]
        if a_pos < b_pos:
            return op_a
        elif a_pos > b_pos:
            return ('del', a_pos - 1)
        return ('noop',)

def apply_op(doc, op):
    if op[0] == 'ins':
        return doc[:op[1]] + op[2] + doc[op[1]:]
    elif op[0] == 'del':
        return doc[:op[1]] + doc[op[1]+1:]
    return doc

# --------------------------------------------------
# Server-based OT Collaboration Engine
# --------------------------------------------------
class OTServer:
    def __init__(self, doc):
        self.doc = doc
        self.history = []  # list of applied ops
        self.revision = 0

    def receive(self, op, client_rev):
        """Receive an op from a client at client_rev.
        Transform against all ops since client_rev, apply, return transformed op."""
        transformed = op
        for past_op in self.history[client_rev:]:
            transformed = transform(transformed, past_op)

        self.doc = apply_op(self.doc, transformed)
        self.history.append(transformed)
        self.revision += 1
        return transformed

class OTClient:
    def __init__(self, name, doc):
        self.name = name
        self.doc = doc
        self.revision = 0  # last known server revision

    def local_edit(self, op):
        """Apply a local edit."""
        self.doc = apply_op(self.doc, op)
        return op

    def receive_remote(self, op):
        """Receive an op from the server and apply it."""
        self.doc = apply_op(self.doc, op)
        self.revision += 1

# --------------------------------------------------
# Simulation: 3 users editing "Hello World"
# --------------------------------------------------
initial_doc = "Hello World"
server = OTServer(initial_doc)
alice = OTClient("Alice", initial_doc)
bob = OTClient("Bob", initial_doc)
carol = OTClient("Carol", initial_doc)

print(f"Initial document: \\"{initial_doc}\\"")
print(f"{'='*55}")
print()

# Round 1: Three concurrent edits
print("Round 1: Three concurrent edits")
print("-" * 40)

# Alice inserts "!" at the end (pos 11)
op_alice = ('ins', 11, '!')
alice.local_edit(op_alice)
print(f"  Alice types '!' at end     -> \\"{alice.doc}\\"")

# Bob inserts ">" at the start (pos 0)
op_bob = ('ins', 0, '>')
bob.local_edit(op_bob)
print(f"  Bob types '>' at start     -> \\"{bob.doc}\\"")

# Carol deletes the space (pos 5)
op_carol = ('del', 5)
carol.local_edit(op_carol)
print(f"  Carol deletes space at 5   -> \\"{carol.doc}\\"")
print()

# Server processes Alice's op first
print("Server processes Alice's op (rev 0):")
srv_alice = server.receive(op_alice, alice.revision)
alice.revision += 1
print(f"  Server doc: \\"{server.doc}\\"  (rev {server.revision})")

# Broadcast to Bob and Carol
bob.receive_remote(srv_alice)
carol.receive_remote(srv_alice)
print(f"  Bob receives Alice's op    -> \\"{bob.doc}\\"")
print(f"  Carol receives Alice's op  -> \\"{carol.doc}\\"")
print()

# Server processes Bob's op (needs transform against Alice's)
print("Server processes Bob's op (rev 0, needs transform):")
srv_bob = server.receive(op_bob, bob.revision - 1)
bob.revision += 1
print(f"  Server transformed & applied -> \\"{server.doc}\\"  (rev {server.revision})")

# Broadcast to Alice and Carol
alice.receive_remote(srv_bob)
carol.receive_remote(srv_bob)
print(f"  Alice receives Bob's op    -> \\"{alice.doc}\\"")
print(f"  Carol receives Bob's op    -> \\"{carol.doc}\\"")
print()

# Server processes Carol's op (needs transform against Alice + Bob)
print("Server processes Carol's op (rev 0, needs 2 transforms):")
srv_carol = server.receive(op_carol, carol.revision - 2)
carol.revision += 1
print(f"  Server transformed & applied -> \\"{server.doc}\\"  (rev {server.revision})")

# Broadcast to Alice and Bob
alice.receive_remote(srv_carol)
bob.receive_remote(srv_carol)
print(f"  Alice receives Carol's op  -> \\"{alice.doc}\\"")
print(f"  Bob receives Carol's op    -> \\"{bob.doc}\\"")
print()

# Check convergence
print("=" * 55)
print("Final state after Round 1:")
print(f"  Server:  \\"{server.doc}\\"")
print(f"  Alice:   \\"{alice.doc}\\"")
print(f"  Bob:     \\"{bob.doc}\\"")
print(f"  Carol:   \\"{carol.doc}\\"")

all_match = server.doc == alice.doc == bob.doc == carol.doc
print(f"  All converged: {all_match}")
print()

# Round 2: More concurrent edits
print("Round 2: More concurrent edits")
print("-" * 40)

# Alice inserts "Dear " at position 1 (after ">")
op_a2 = ('ins', 1, 'D')
alice.local_edit(op_a2)

# Bob deletes the "!" at the end
end_pos = len(bob.doc) - 1
op_b2 = ('del', end_pos)
bob.local_edit(op_b2)

# Carol inserts "." at the end
op_c2 = ('ins', len(carol.doc), '.')
carol.local_edit(op_c2)

print(f"  Alice inserts 'D' at pos 1 -> \\"{alice.doc}\\"")
print(f"  Bob deletes last char      -> \\"{bob.doc}\\"")
print(f"  Carol appends '.'          -> \\"{carol.doc}\\"")
print()

# Process all three through server
srv_a2 = server.receive(op_a2, alice.revision)
alice.revision += 1
bob.receive_remote(srv_a2)
carol.receive_remote(srv_a2)

srv_b2 = server.receive(op_b2, bob.revision - 1)
bob.revision += 1
alice.receive_remote(srv_b2)
carol.receive_remote(srv_b2)

srv_c2 = server.receive(op_c2, carol.revision - 2)
carol.revision += 1
alice.receive_remote(srv_c2)
bob.receive_remote(srv_c2)

print("After server processes all ops:")
print(f"  Server:  \\"{server.doc}\\"")
print(f"  Alice:   \\"{alice.doc}\\"")
print(f"  Bob:     \\"{bob.doc}\\"")
print(f"  Carol:   \\"{carol.doc}\\"")

all_match = server.doc == alice.doc == bob.doc == carol.doc
print(f"  All converged: {all_match}")
print()
print("OT ensures convergence regardless of the order")
print("the server processes concurrent operations!")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function OperationalTransformation() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-16 text-gray-200">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-3">{meta.title}</h1>
        <p className="text-lg text-gray-400 leading-relaxed">{meta.description}</p>
      </header>

      {/* ---- Section 1: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Concurrent Editing</h2>
        <p className="text-gray-300 leading-relaxed">
          Imagine two people editing the same Google Doc at the same time. User A types
          &quot;Hello&quot; at the beginning. User B types &quot;World&quot; at the beginning.
          Without any coordination, one user&apos;s changes could overwrite the other&apos;s.
          The result would be unpredictable and one person&apos;s work would silently vanish.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is not a theoretical problem. It is the central challenge that every
          collaborative editing system must solve. Google Docs, Notion, Overleaf, VS Code
          Live Share, Figma &mdash; all of these tools let multiple users edit simultaneously, and
          they all need a mechanism to reconcile concurrent changes.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The simplest &quot;solution&quot; is locking: only one user can edit at a time. But
          that destroys the real-time experience. What we want is <span className="text-indigo-400 font-semibold">
          optimistic concurrency</span>: let everyone edit freely, then reconcile their
          changes so that all users converge to the same document. This is exactly what
          <span className="text-indigo-400 font-semibold"> Operational Transformation (OT)</span> achieves.
        </p>
        <div className="bg-slate-800/60 border border-indigo-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-indigo-400 mb-2">Core Guarantee of OT</h3>
          <p className="text-gray-300 text-sm">
            Given any two concurrent operations A and B applied to the same document state,
            OT produces transformed operations A&apos; and B&apos; such that:
          </p>
          <p className="text-cyan-300 font-mono text-sm mt-2 text-center">
            apply(apply(doc, A), B&apos;) = apply(apply(doc, B), A&apos;)
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Both orderings produce the same final document. This is called the
            <span className="text-white font-semibold"> convergence property</span>.
          </p>
        </div>
      </section>

      {/* ---- Section 2: Naive Approach Fails ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Naive Approach Fails</h2>
        <p className="text-gray-300 leading-relaxed">
          Consider a document &quot;ABCDE&quot;. User A inserts &quot;X&quot; at position 2
          (producing &quot;ABXCDE&quot;). Concurrently, User B deletes position 3 (the
          &quot;D&quot;). If we naively apply A&apos;s operation first, the document becomes
          &quot;ABXCDE&quot;. Now if we apply B&apos;s original delete-at-position-3, we
          delete &quot;C&quot; instead of &quot;D&quot; &mdash; the insert shifted everything.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle between the naive approach and the OT-corrected version to see the difference.
          Step through each phase to understand exactly where the naive approach breaks down
          and how OT fixes it.
        </p>
        <NaiveApproachSketch />
      </section>

      {/* ---- Section 3: The Transform Function (Diamond Diagram) ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Transform Function: Diamond Diagram</h2>
        <p className="text-gray-300 leading-relaxed">
          The core idea of OT is the <span className="text-yellow-400 font-semibold">transform function</span>.
          Given two concurrent operations A and B (both applied to the same starting state S),
          the transform function produces A&apos; and B&apos; such that:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li>Applying A then B&apos; produces final state S&apos;</li>
          <li>Applying B then A&apos; produces the same final state S&apos;</li>
        </ul>
        <p className="text-gray-300 leading-relaxed">
          This is visualized as a <span className="text-yellow-400 font-semibold">diamond diagram</span>:
          the starting state S is at the top. A&apos;s edit takes us left, B&apos;s edit takes us right.
          The transformed operations complete the diamond by converging at the bottom to the
          same final state S&apos;.
        </p>
        <DiamondDiagramSketch />
        <div className="bg-slate-800/60 border border-yellow-700/50 rounded-lg p-4 mt-2">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Why &quot;Diamond&quot;?</h3>
          <p className="text-gray-300 text-sm">
            The four states (S, S_A, S_B, S&apos;) form a diamond shape. The top-to-left
            and top-to-right edges are the original operations. The left-to-bottom and
            right-to-bottom edges are the transformed operations. The key property is that
            both paths through the diamond arrive at the same bottom state. This is sometimes
            called the <span className="text-white">TP1 property</span> (Transformation Property 1).
          </p>
        </div>
      </section>

      {/* ---- Section 4: Transform Rules for Text ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Transform Rules for Text Operations</h2>
        <p className="text-gray-300 leading-relaxed">
          For plain text with insert and delete operations, there are four cases to handle.
          Use the controls below to pick any combination of operations and see how the
          transform function adjusts positions to maintain convergence.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/60 border border-indigo-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">insert vs insert</h3>
            <p className="text-gray-400 text-sm">
              If A inserts at a position before B&apos;s insert, B&apos;s position shifts
              right by 1 (to account for the new character). If both insert at the same
              position, we break ties by character value to ensure a deterministic order.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-pink-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">insert vs delete</h3>
            <p className="text-gray-400 text-sm">
              If the insert is at or before the delete position, the delete shifts right
              by 1 (the inserted char pushes it). If the insert is after the delete, the
              insert shifts left by 1 (the deleted char pulls it).
            </p>
          </div>
          <div className="bg-slate-800/60 border border-cyan-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2">delete vs insert</h3>
            <p className="text-gray-400 text-sm">
              Mirror of insert vs delete. If the delete is before the insert, the insert
              shifts left. If the delete is at or after the insert, the delete shifts right.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-yellow-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">delete vs delete</h3>
            <p className="text-gray-400 text-sm">
              If both delete different positions, the later one shifts left by 1 (since an
              earlier character was removed). If both delete the <em>same</em> position,
              one becomes a no-op &mdash; the character is already gone.
            </p>
          </div>
        </div>
        <TransformRulesSketch />
      </section>

      {/* ---- Section 5: The OT Algorithm (Jupiter/GOTO) ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The OT Protocol: Client-Server Architecture</h2>
        <p className="text-gray-300 leading-relaxed">
          The transform function handles pairs of operations. But in a real system, there is a
          <span className="text-yellow-400 font-semibold"> server</span> coordinating multiple clients.
          The protocol works like this:
        </p>
        <ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
          <li>
            Each client applies edits locally (optimistic) and sends them to the server
            along with a <span className="text-cyan-400">revision number</span> indicating
            which server state the edit was based on.
          </li>
          <li>
            The server receives the operation and transforms it against all operations that
            have been applied since the client&apos;s revision number. This accounts for
            any concurrent edits the client has not yet seen.
          </li>
          <li>
            The server applies the transformed operation to its document and increments its
            revision.
          </li>
          <li>
            The server broadcasts the transformed operation to all other clients.
          </li>
        </ol>
        <p className="text-gray-300 leading-relaxed">
          This is the essence of the <span className="text-white font-semibold">Jupiter protocol</span> (used
          by Google Docs) and the <span className="text-white font-semibold">GOTO algorithm</span>. The
          server acts as a serialization point &mdash; it picks a total order for all operations.
          Step through the sequence diagram below to see how concurrent edits are reconciled.
        </p>
        <ProtocolSketch />
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mt-2">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Why Revision Numbers?</h3>
          <p className="text-gray-400 text-sm">
            The revision number tells the server &quot;this operation was created when the client
            last saw revision N.&quot; The server then knows it needs to transform the incoming
            operation against all operations from revision N+1 onward. Without revision numbers,
            the server would not know which concurrent operations to transform against.
          </p>
        </div>
      </section>

      {/* ---- Section 6: OT vs CRDTs ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">OT vs CRDTs</h2>
        <p className="text-gray-300 leading-relaxed">
          OT is not the only approach to collaborative editing.
          <span className="text-indigo-400 font-semibold"> Conflict-free Replicated Data Types (CRDTs)</span> are
          an alternative that takes a fundamentally different approach. Both solve the same
          problem but with different trade-offs.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 pr-4 text-white">Aspect</th>
                <th className="text-left py-3 pr-4 text-indigo-400">OT</th>
                <th className="text-left py-3 text-pink-400">CRDTs</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Architecture</td>
                <td className="py-2 pr-4">Requires central server</td>
                <td className="py-2">Peer-to-peer (decentralized)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Transform logic</td>
                <td className="py-2 pr-4">Complex transform functions (error-prone)</td>
                <td className="py-2">Simpler merge (commutative by construction)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Memory overhead</td>
                <td className="py-2 pr-4 text-emerald-400">Low (just operations)</td>
                <td className="py-2 text-yellow-400">Higher (unique IDs per character)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Network</td>
                <td className="py-2 pr-4">Requires server connectivity</td>
                <td className="py-2 text-emerald-400">Works offline, sync later</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Correctness</td>
                <td className="py-2 pr-4 text-yellow-400">Hard to prove (many edge cases)</td>
                <td className="py-2 text-emerald-400">Mathematically guaranteed</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4 font-medium text-white">Tombstones</td>
                <td className="py-2 pr-4 text-emerald-400">Not needed</td>
                <td className="py-2 text-yellow-400">Deleted chars kept as tombstones</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">Used by</td>
                <td className="py-2 pr-4">Google Docs, VS Code Live Share</td>
                <td className="py-2">Figma, Yjs, Automerge</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-800/60 border border-indigo-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">When to Use OT</h3>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
              <li>Client-server architecture with a trusted server</li>
              <li>Memory-constrained environments (no per-char metadata)</li>
              <li>You already have a reliable server infrastructure</li>
              <li>Document sizes are moderate (transform chains stay short)</li>
            </ul>
          </div>
          <div className="bg-slate-800/60 border border-pink-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">When to Use CRDTs</h3>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
              <li>Peer-to-peer or offline-first applications</li>
              <li>No central server available or desired</li>
              <li>Need mathematically provable correctness</li>
              <li>Can tolerate the memory overhead of unique IDs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Section 7: Real-World Implementations ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Implementations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Google Docs (OT)</h3>
            <p className="text-gray-400 text-sm">
              Uses the Jupiter protocol, a client-server OT system. Each keystroke is an
              operation sent to Google&apos;s servers, transformed against concurrent ops, and
              broadcast. The original 2009 Google Wave also used OT but with a more ambitious
              peer-to-peer vision that proved too complex.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">Figma (CRDT)</h3>
            <p className="text-gray-400 text-sm">
              Uses a custom CRDT for its design canvas. Each object on the canvas has a
              unique ID and last-writer-wins semantics for properties. Figma chose CRDTs
              because their data model (objects with properties) maps naturally to LWW-Register
              CRDTs, and it simplifies their multiplayer architecture.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">VS Code Live Share (OT)</h3>
            <p className="text-gray-400 text-sm">
              Uses OT for collaborative editing sessions. The host&apos;s VS Code instance acts
              as the server. Operations are transformed and relayed to guests. Supports
              multiple cursors, selections, and file-level operations.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2">Notion (Custom OT-like)</h3>
            <p className="text-gray-400 text-sm">
              Uses a custom system that combines OT-like transformation with a block-based
              document model. Each block (paragraph, heading, list item) is an independent
              unit, reducing the scope of conflicts. Concurrent edits to different blocks
              never conflict.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Apple Notes (CRDT)</h3>
            <p className="text-gray-400 text-sm">
              Uses CRDTs for syncing across devices via iCloud. Each device can edit
              offline and sync later. The CRDT ensures all devices converge to the same
              state without a central coordination server.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-orange-400 mb-2">Yjs (CRDT Library)</h3>
            <p className="text-gray-400 text-sm">
              An open-source CRDT library for building collaborative applications. Used by
              many projects including Jupyter notebooks, BlockSuite, and Tiptap. Implements
              the YATA algorithm (Yet Another Transformation Approach), which is technically
              a CRDT despite the name.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 8: Challenges ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Challenges in Practice</h2>
        <p className="text-gray-300 leading-relaxed">
          The basic OT transform function for insert and delete on plain text is relatively
          straightforward. But real collaborative editors face several additional challenges
          that make the engineering significantly harder.
        </p>
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Undo/Redo</h3>
            <p className="text-gray-400 text-sm">
              When User A presses Ctrl+Z, they expect to undo <em>their</em> last action, not
              the last action globally. But other operations may have been applied since then.
              The undo operation itself must be transformed against all intervening operations.
              This is called <span className="text-white">transform-based undo</span> and is
              notoriously difficult to implement correctly.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Cursor and Selection Tracking</h3>
            <p className="text-gray-400 text-sm">
              Each user&apos;s cursor position and selection range must be transformed along with
              operations. When User B inserts text before User A&apos;s cursor, A&apos;s cursor
              must shift right. This requires transforming cursor positions through the same
              OT pipeline as document operations.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">Rich Text (Attributes)</h3>
            <p className="text-gray-400 text-sm">
              Real editors support bold, italic, font size, color, and other formatting.
              These are typically modeled as &quot;retain N characters with attribute
              changes&quot; operations. The transform function must handle retain-vs-insert,
              retain-vs-delete, and attribute conflicts (what if A bolds a word while B
              italicizes the same word?).
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Presence (Live Cursors)</h3>
            <p className="text-gray-400 text-sm">
              Showing other users&apos; cursors in real time requires a separate channel for
              presence data. Cursor positions are ephemeral (not part of the document) but
              must still be transformed as the document changes. Most systems use a
              lightweight presence protocol alongside the OT/CRDT document sync.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">TP2 and N-Way Concurrency</h3>
            <p className="text-gray-400 text-sm">
              The basic diamond property (TP1) handles two concurrent operations. For
              three or more concurrent operations, we need the stronger TP2 property:
              transforming against different orderings of concurrent ops must yield the same
              result. Many OT algorithms fail TP2, which is why most production systems use
              a central server to impose a total order (avoiding the need for TP2).
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python Cell 1: OT Transform Function ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: OT Transform Function</h2>
        <p className="text-gray-300 leading-relaxed">
          Implement the core OT transform function for all four cases (insert/insert,
          insert/delete, delete/insert, delete/delete). Then verify convergence: apply two
          concurrent operations in both orders and confirm they produce the same result.
        </p>
        <PythonCell defaultCode={pythonOTTransform} />
      </section>

      {/* ---- Python Cell 2: Collaborative Session Simulation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: Collaborative Editing Session</h2>
        <p className="text-gray-300 leading-relaxed">
          Simulate a full collaborative session with a server and three clients. Each client
          makes concurrent edits, the server transforms and broadcasts, and all clients
          converge to the same final document.
        </p>
        <PythonCell defaultCode={pythonCollabSession} />
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
          <li>
            Operational Transformation enables real-time collaborative editing by transforming
            concurrent operations so that all orderings converge to the same document state.
          </li>
          <li>
            The <span className="text-yellow-400">transform function</span> is the core primitive:
            given two concurrent operations, it produces adjusted versions that commute
            correctly. This is visualized as a diamond diagram.
          </li>
          <li>
            For plain text, there are four cases: insert/insert, insert/delete, delete/insert,
            and delete/delete. Each case adjusts positions to account for the other operation&apos;s
            effect on the document.
          </li>
          <li>
            Production systems use a <span className="text-cyan-400">client-server architecture</span> where
            the server imposes a total order on operations. This avoids the need for the
            more difficult TP2 property.
          </li>
          <li>
            CRDTs are the main alternative to OT. OT requires a server but uses less memory;
            CRDTs work peer-to-peer and offline but carry per-character metadata overhead.
          </li>
          <li>
            Real-world challenges include undo/redo, cursor tracking, rich text attributes,
            and presence. These make production OT systems significantly more complex than the
            basic algorithm.
          </li>
          <li>
            Google Docs and VS Code Live Share use OT. Figma, Apple Notes, and Yjs use CRDTs.
            The choice depends on architecture (client-server vs peer-to-peer) and the
            data model of the application.
          </li>
        </ul>
      </section>
    </div>
  )
}
