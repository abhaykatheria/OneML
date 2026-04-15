import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/or-set',
  title: 'OR-Set: Observed-Remove Set',
  description:
    'A CRDT that preserves concurrent adds even when removes happen simultaneously — the gold standard for replicated sets',
  track: 'datastructures',
  order: 6,
  tags: [
    'or-set',
    'crdt',
    'distributed',
    'conflict-free',
    'replication',
    'add-wins',
    'riak',
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
const CYAN: [number, number, number] = [34, 211, 238]
const ORANGE: [number, number, number] = [251, 146, 60]

const NODE_COLORS: [number, number, number][] = [ACCENT, PINK, GREEN]
const NODE_LABELS = ['Node A', 'Node B', 'Node C']

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let tagCounter = 0
function newTag(nodeId: string): string {
  tagCounter++
  return `${nodeId}_${tagCounter}`
}

interface ORSetState {
  // element -> set of active tags
  elements: Map<string, Set<string>>
}

function orSetAdd(state: ORSetState, element: string, tag: string) {
  if (!state.elements.has(element)) {
    state.elements.set(element, new Set())
  }
  state.elements.get(element)!.add(tag)
}

function orSetRemove(state: ORSetState, element: string): Set<string> {
  // Returns the set of tags that were removed (the "observed" tags)
  const tags = state.elements.get(element)
  const removed = new Set(tags || [])
  if (tags) {
    tags.clear()
  }
  return removed
}


function orSetMembers(state: ORSetState): string[] {
  const result: string[] = []
  state.elements.forEach((tags, element) => {
    if (tags.size > 0) result.push(element)
  })
  return result.sort()
}



/* ------------------------------------------------------------------ */
/* Section 1 — OR-Set Step-Through Visualization                       */
/* ------------------------------------------------------------------ */

function ORSetSketch() {
  interface StepDef {
    desc: string
    action: () => void
  }

  const nodesRef = useRef<ORSetState[]>([
    { elements: new Map() },
    { elements: new Map() },
    { elements: new Map() },
  ])
  const tombstonesRef = useRef<Map<string, Set<string>>[]>([
    new Map(), new Map(), new Map(),
  ])
  const eventsRef = useRef<string[]>(['All nodes start empty'])

  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step

  const steps: StepDef[] = [
    {
      desc: 'Initial: all nodes empty',
      action: () => {
        tagCounter = 0
        nodesRef.current = [
          { elements: new Map() },
          { elements: new Map() },
          { elements: new Map() },
        ]
        tombstonesRef.current = [new Map(), new Map(), new Map()]
        eventsRef.current = ['All nodes start empty']
      },
    },
    {
      desc: 'Node A: add("milk") -- creates milk:{a1}',
      action: () => {
        const tag = newTag('a')
        orSetAdd(nodesRef.current[0], 'milk', tag)
        eventsRef.current.push(`Node A: add("milk") -> tag ${tag}`)
      },
    },
    {
      desc: 'Node B: add("milk") -- creates milk:{b2} (independent add!)',
      action: () => {
        const tag = newTag('b')
        orSetAdd(nodesRef.current[1], 'milk', tag)
        eventsRef.current.push(`Node B: add("milk") -> tag ${tag}`)
      },
    },
    {
      desc: 'Sync A <-> B: both get milk:{a1, b2}',
      action: () => {
        // Merge A and B bidirectionally
        const a = nodesRef.current[0]
        const b = nodesRef.current[1]
        // For each element in B, add its tags to A
        b.elements.forEach((tags, elem) => {
          if (!a.elements.has(elem)) a.elements.set(elem, new Set())
          tags.forEach((t) => a.elements.get(elem)!.add(t))
        })
        // For each element in A, add its tags to B
        a.elements.forEach((tags, elem) => {
          if (!b.elements.has(elem)) b.elements.set(elem, new Set())
          tags.forEach((t) => b.elements.get(elem)!.add(t))
        })
        eventsRef.current.push('Sync A <-> B: milk now has tags {a_1, b_2} on both')
      },
    },
    {
      desc: 'Node A: remove("milk") -- removes tags {a1, b2} that A has seen',
      action: () => {
        const removed = orSetRemove(nodesRef.current[0], 'milk')
        const ts = tombstonesRef.current[0]
        if (!ts.has('milk')) ts.set('milk', new Set())
        removed.forEach((t) => ts.get('milk')!.add(t))
        eventsRef.current.push(`Node A: remove("milk") -> tombstoned {${[...removed].join(', ')}}`)
      },
    },
    {
      desc: 'Node C: add("milk") -- creates milk:{c3} (concurrent with A\'s remove!)',
      action: () => {
        const tag = newTag('c')
        orSetAdd(nodesRef.current[2], 'milk', tag)
        eventsRef.current.push(`Node C: add("milk") -> tag ${tag} (concurrent with A's remove)`)
      },
    },
    {
      desc: 'Sync all: A gets C\'s tag c3. c3 was NOT in A\'s tombstones, so milk SURVIVES!',
      action: () => {
        const a = nodesRef.current[0]
        const b = nodesRef.current[1]
        const c = nodesRef.current[2]
        const aTomb = tombstonesRef.current[0]

        // C -> A: add C's tags, but skip tombstoned ones
        c.elements.forEach((tags, elem) => {
          if (!a.elements.has(elem)) a.elements.set(elem, new Set())
          const tombstoned = aTomb.get(elem) || new Set()
          tags.forEach((t) => {
            if (!tombstoned.has(t)) {
              a.elements.get(elem)!.add(t)
            }
          })
        })

        // A -> B (with A's tombstones)
        a.elements.forEach((tags, elem) => {
          if (!b.elements.has(elem)) b.elements.set(elem, new Set())
          // Remove tombstoned tags from B
          const tombstoned = aTomb.get(elem) || new Set()
          const bTags = b.elements.get(elem)!
          tombstoned.forEach((t) => bTags.delete(t))
          // Add A's surviving tags
          tags.forEach((t) => bTags.add(t))
        })

        // C -> B
        c.elements.forEach((tags, elem) => {
          if (!b.elements.has(elem)) b.elements.set(elem, new Set())
          tags.forEach((t) => b.elements.get(elem)!.add(t))
        })

        // A -> C (with tombstones)
        a.elements.forEach((tags, elem) => {
          if (!c.elements.has(elem)) c.elements.set(elem, new Set())
          tags.forEach((t) => c.elements.get(elem)!.add(t))
        })
        // Apply A's tombstones to C
        aTomb.forEach((tombTags, elem) => {
          const cTags = c.elements.get(elem)
          if (cTags) {
            tombTags.forEach((t) => cTags.delete(t))
          }
        })

        eventsRef.current.push('Sync all: c_3 not tombstoned by A, so milk:{c_3} survives!')
        eventsRef.current.push('All nodes converge: milk is IN the set (add-wins semantics)')
      },
    },
  ]

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 520

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const nodes = nodesRef.current

      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.LEFT, p.TOP)
      p.text('OR-Set: Observed-Remove Set', 15, 12)

      p.fill(...TEXT_C)
      p.textSize(11)
      p.text(`Step ${stepRef.current} of ${steps.length - 1}`, 15, 35)

      // Draw 3 nodes side by side
      const nodeW = (p.width - 50) / 3
      const nodeStartY = 60

      for (let i = 0; i < 3; i++) {
        const x = 15 + i * (nodeW + 10)
        const node = nodes[i]
        const color = NODE_COLORS[i]

        // Node header
        p.fill(color[0], color[1], color[2], 30)
        p.stroke(...color)
        p.strokeWeight(1)
        p.rect(x, nodeStartY, nodeW, 220, 6)

        p.noStroke()
        p.fill(...color)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text(NODE_LABELS[i], x + nodeW / 2, nodeStartY + 8)

        // Internal state: element -> tags
        let row = 0
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(10)

        if (node.elements.size === 0) {
          p.fill(...TEXT_C)
          p.text('(empty)', x + 10, nodeStartY + 35)
        }

        node.elements.forEach((tags, element) => {
          const ey = nodeStartY + 35 + row * 40
          const inSet = tags.size > 0

          // Element name
          p.fill(inSet ? 255 : 100)
          p.textSize(12)
          p.textFont('monospace')
          p.text(element, x + 10, ey)

          // Tags
          if (tags.size > 0) {
            const tagStr = [...tags].join(', ')
            p.fill(...CYAN)
            p.textSize(9)
            p.text(`{${tagStr}}`, x + 10, ey + 16)
          } else {
            p.fill(...RED)
            p.textSize(9)
            p.text('{ } (removed)', x + 10, ey + 16)
          }

          row++
        })

        // Set contents
        const members = orSetMembers(node)
        const footerY = nodeStartY + 185
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textFont('sans-serif')
        p.text('Contains:', x + 10, footerY)
        p.fill(...GREEN)
        p.textSize(11)
        p.textFont('monospace')
        p.text(members.length > 0 ? `{ ${members.join(', ')} }` : '{ }', x + 10, footerY + 14)
      }

      // Tombstones for Node A
      const tombY = nodeStartY + 240
      p.noStroke()
      p.fill(255)
      p.textSize(12)
      p.textFont('sans-serif')
      p.textAlign(p.LEFT, p.TOP)
      p.text('Node A Tombstones (observed-removes):', 15, tombY)

      const aTomb = tombstonesRef.current[0]
      if (aTomb.size === 0) {
        p.fill(...TEXT_C)
        p.textSize(10)
        p.text('(none yet)', 15, tombY + 20)
      } else {
        let ti = 0
        aTomb.forEach((tags, elem) => {
          p.fill(...RED)
          p.textSize(10)
          p.textFont('monospace')
          p.text(`${elem}: removed tags {${[...tags].join(', ')}}`, 15, tombY + 20 + ti * 16)
          ti++
        })
      }

      // Event log
      const events = eventsRef.current.slice(-5)
      const logY = tombY + 70
      p.fill(255)
      p.textFont('sans-serif')
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Event Log:', 15, logY)

      p.textSize(10)
      for (let i = 0; i < events.length; i++) {
        const alpha = 80 + (175 * (i + 1)) / events.length
        p.fill(148, 163, 184, alpha)
        p.text(`> ${events[i]}`, 15, logY + 18 + i * 15)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={520}
        controls={
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button
              onClick={() => {
                steps[0].action()
                setStep(0)
              }}
              className="px-3 py-1.5 rounded text-xs font-mono bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            >
              RESET
            </button>
            <button
              onClick={() => {
                if (step < steps.length - 1) {
                  const newStep = step + 1
                  steps[newStep].action()
                  setStep(newStep)
                }
              }}
              disabled={step >= steps.length - 1}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                step >= steps.length - 1
                  ? 'bg-slate-800 text-gray-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              NEXT STEP
            </button>
            <span className="text-xs text-gray-500 ml-2">
              {steps[Math.min(step + 1, steps.length - 1)]?.desc}
            </span>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Add-Wins vs Remove-Wins Comparison                      */
/* ------------------------------------------------------------------ */

function ComparisonSketch() {
  const [scenario, setScenario] = useState<'add-wins' | 'remove-wins'>('add-wins')
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  const sketch = useCallback((p: p5) => {
    const W = 780
    const H = 440

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      p.createCanvas(Math.min(pw, W), H)
    }

    p.draw = () => {
      p.background(...BG)
      const isAddWins = scenarioRef.current === 'add-wins'


      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(
        isAddWins
          ? 'OR-Set (Add-Wins) Behavior'
          : 'Remove-Wins Set Behavior',
        15, 12
      )

      // Timeline
      const timeY = 55
      const nodeAY = timeY + 30
      const nodeBY = timeY + 100

      // Labels
      p.fill(...ACCENT)
      p.textSize(12)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Node A', 55, nodeAY)
      p.fill(...PINK)
      p.text('Node B', 55, nodeBY)

      // Timelines
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      p.line(65, nodeAY, p.width - 30, nodeAY)
      p.line(65, nodeBY, p.width - 30, nodeBY)

      // Time markers
      const timeX = (frac: number) => 65 + (p.width - 95) * frac

      // Step 1: Both have "milk"
      const t1 = timeX(0.05)
      p.noStroke()
      p.fill(...GREEN)
      p.textSize(9)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('has {milk}', t1, nodeAY - 5)
      p.text('has {milk}', t1, nodeBY - 5)
      p.fill(...GREEN)
      p.ellipse(t1, nodeAY, 8, 8)
      p.ellipse(t1, nodeBY, 8, 8)

      // Step 2: A adds milk (re-add), B removes milk — CONCURRENT
      const t2a = timeX(0.35)
      const t2b = timeX(0.4)

      // A's add
      p.fill(...CYAN)
      p.ellipse(t2a, nodeAY, 10, 10)
      p.textSize(9)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.fill(...CYAN)
      p.text('add("milk")', t2a, nodeAY - 7)

      // B's remove
      p.fill(...RED)
      p.ellipse(t2b, nodeBY, 10, 10)
      p.fill(...RED)
      p.text('remove("milk")', t2b, nodeBY - 7)

      // Concurrent bracket
      p.stroke(...YELLOW)
      p.strokeWeight(1)
      const ctx = p.drawingContext as CanvasRenderingContext2D; ctx.setLineDash([3, 3])
      p.line(t2a, nodeAY + 10, t2a, nodeBY + 20)
      p.line(t2b, nodeAY + 10, t2b, nodeBY + 20)
      ctx.setLineDash([])
      p.noStroke()
      p.fill(...YELLOW)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('CONCURRENT', (t2a + t2b) / 2, nodeBY + 22)

      // Step 3: Merge
      const t3 = timeX(0.7)
      p.stroke(...GRID_C)
      p.strokeWeight(1)
      ctx.setLineDash([4, 4])
      p.line(t3, nodeAY, t3, nodeBY)
      ctx.setLineDash([])

      p.noStroke()
      p.fill(...YELLOW)
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('MERGE', t3, (nodeAY + nodeBY) / 2)

      // Result
      const t4 = timeX(0.9)
      if (isAddWins) {
        p.fill(...GREEN)
        p.ellipse(t4, nodeAY, 10, 10)
        p.ellipse(t4, nodeBY, 10, 10)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('{milk}', t4, nodeAY - 7)
        p.text('{milk}', t4, nodeBY - 7)
      } else {
        p.fill(...RED)
        p.ellipse(t4, nodeAY, 10, 10)
        p.ellipse(t4, nodeBY, 10, 10)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('{ }', t4, nodeAY - 7)
        p.text('{ }', t4, nodeBY - 7)
      }

      // Explanation box
      const boxY = nodeBY + 50
      const boxColor = isAddWins ? GREEN : RED

      p.fill(boxColor[0], boxColor[1], boxColor[2], 20)
      p.stroke(boxColor[0], boxColor[1], boxColor[2], 60)
      p.strokeWeight(1)
      p.rect(15, boxY, p.width - 30, 200, 8)

      p.noStroke()
      p.fill(...boxColor)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(isAddWins ? 'OR-Set: milk is IN the set' : 'Remove-Wins: milk is NOT in the set', 30, boxY + 15)

      p.fill(...TEXT_C)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)

      if (isAddWins) {
        const lines = [
          'Node A\'s concurrent add("milk") created a NEW tag (e.g., a_5).',
          'Node B\'s remove("milk") only removed tags it had SEEN (the original tag).',
          'The new tag a_5 was NOT observed by B\'s remove, so it survives.',
          '',
          'This is the "Observed-Remove" semantics:',
          '  - A remove only removes the specific tagged copies it has seen.',
          '  - Concurrent adds create new tags that the remover hasn\'t seen.',
          '  - Those unseen tags survive the merge. Add wins for concurrent ops.',
          '',
          'This is the right behavior for a shopping cart: if someone adds milk',
          'while someone else removes it, the add should win (you probably want milk).',
        ]
        lines.forEach((line, i) => {
          p.text(line, 30, boxY + 38 + i * 15)
        })
      } else {
        const lines = [
          'In a Remove-Wins set, ANY remove of "milk" defeats ALL concurrent adds.',
          'Even if Node A explicitly added milk at the same time, the remove wins.',
          '',
          'This can be surprising and often undesirable:',
          '  - User A adds milk to shared cart (they want milk)',
          '  - User B removes milk from shared cart (they thought they had some)',
          '  - After sync, milk is gone. User A\'s intent is silently lost.',
          '',
          'Remove-wins is simpler to implement but loses information.',
          'OR-Set\'s add-wins semantics is usually preferred in practice.',
        ]
        lines.forEach((line, i) => {
          p.text(line, 30, boxY + 38 + i * 15)
        })
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={440}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setScenario('add-wins')}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                scenario === 'add-wins'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              OR-SET (ADD-WINS)
            </button>
            <button
              onClick={() => setScenario('remove-wins')}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                scenario === 'remove-wins'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              REMOVE-WINS SET
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Merge Visualization                                     */
/* ------------------------------------------------------------------ */

function MergeSketch() {
  const [merged, setMerged] = useState(false)
  const mergedRef = useRef(merged)
  mergedRef.current = merged

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
      const isMerged = mergedRef.current

      p.noStroke()
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('OR-Set Merge: Union of Tags, Remove Tombstoned', 15, 12)

      // Node A state
      const nodeAData: { elem: string; tags: string[]; active: boolean; note?: string }[] = [
        { elem: 'milk', tags: ['a_1'], active: true },
        { elem: 'eggs', tags: ['a_2', 'b_3'], active: true },
        { elem: 'bread', tags: [], active: false, note: 'removed {a_4}' },
      ]
      const nodeATombstones = new Set(['a_4'])

      // Node B state
      const nodeBData = [
        { elem: 'milk', tags: ['b_5'], active: true },
        { elem: 'bread', tags: ['b_6'], active: true },
        { elem: 'juice', tags: ['b_7'], active: true },
      ]

      // Merged state
      const mergedData = [
        { elem: 'milk', tags: ['a_1', 'b_5'], active: true },
        { elem: 'eggs', tags: ['a_2', 'b_3'], active: true },
        { elem: 'bread', tags: ['b_6'], active: true, note: 'a_4 tombstoned, b_6 survives' },
        { elem: 'juice', tags: ['b_7'], active: true },
      ]

      const drawNode = (
        x: number, y: number, w: number, label: string,
        color: [number, number, number],
        data: typeof nodeAData,
        tombstones?: Set<string>
      ) => {
        p.fill(color[0], color[1], color[2], 20)
        p.stroke(...color)
        p.strokeWeight(1)
        p.rect(x, y, w, 280, 6)

        p.noStroke()
        p.fill(...color)
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text(label, x + w / 2, y + 8)

        p.textAlign(p.LEFT, p.TOP)
        data.forEach((item, idx) => {
          const iy = y + 35 + idx * 50

          p.fill(item.active ? 255 : 100)
          p.textSize(12)
          p.textFont('monospace')
          p.text(item.elem, x + 10, iy)

          if (item.tags.length > 0) {
            p.fill(...CYAN)
            p.textSize(9)
            p.text(`tags: {${item.tags.join(', ')}}`, x + 10, iy + 16)
          }

          if (item.note) {
            p.fill(...ORANGE)
            p.textSize(8)
            p.text(item.note, x + 10, iy + 30)
          }

          p.fill(item.active ? GREEN[0] : RED[0], item.active ? GREEN[1] : RED[1], item.active ? GREEN[2] : RED[2])
          p.textSize(9)
          p.textFont('sans-serif')
          p.text(item.active ? 'IN SET' : 'REMOVED', x + w - 60, iy + 2)
        })

        if (tombstones && tombstones.size > 0) {
          const ty = y + 35 + data.length * 50 + 10
          p.fill(...RED)
          p.textSize(9)
          p.text(`tombstones: {${[...tombstones].join(', ')}}`, x + 10, ty)
        }
      }

      if (!isMerged) {
        const nodeW = (p.width - 50) / 2
        drawNode(15, 50, nodeW, 'Node A', ACCENT, nodeAData, nodeATombstones)
        drawNode(nodeW + 35, 50, nodeW, 'Node B', PINK, nodeBData)
      } else {
        const sideW = (p.width - 60) / 3
        drawNode(10, 50, sideW, 'Node A', ACCENT, nodeAData, nodeATombstones)
        drawNode(sideW + 20, 50, sideW, 'Node B', PINK, nodeBData)

        // Arrow
        const arrowX = 2 * sideW + 30
        p.fill(...YELLOW)
        p.textSize(20)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('=', arrowX + sideW / 2, 42)

        drawNode(arrowX, 50, sideW, 'Merged', GREEN, mergedData)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setMerged(false)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                !merged
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              BEFORE MERGE
            </button>
            <button
              onClick={() => setMerged(true)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                merged
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              AFTER MERGE
            </button>
          </div>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python cells                                                        */
/* ------------------------------------------------------------------ */

const pythonORSet = `import uuid

class ORSet:
    """Observed-Remove Set (OR-Set) CRDT.

    Each add creates a unique tag. A remove only removes
    tags that the removing node has seen (observed).
    Concurrent adds with unseen tags survive removes."""

    def __init__(self, node_id="node"):
        self.node_id = node_id
        # element -> set of active (unique) tags
        self.elements: dict[str, set[str]] = {}
        # set of all tombstoned tags (removed tags)
        self.tombstones: set[str] = set()

    def add(self, element):
        """Add an element with a fresh unique tag."""
        tag = f"{self.node_id}_{uuid.uuid4().hex[:6]}"
        if element not in self.elements:
            self.elements[element] = set()
        self.elements[element].add(tag)
        return tag

    def remove(self, element):
        """Remove an element by tombstoning all OBSERVED tags.
        Only tags currently visible to this node are removed."""
        if element in self.elements:
            observed = self.elements[element].copy()
            self.tombstones |= observed
            self.elements[element] = set()
            return observed
        return set()

    def contains(self, element):
        """Element is in set if it has any active (non-tombstoned) tags."""
        return element in self.elements and len(self.elements[element]) > 0

    def value(self):
        """Return all elements currently in the set."""
        return {e for e, tags in self.elements.items() if len(tags) > 0}

    def merge(self, other):
        """Merge another OR-Set into this one.

        For each element:
          - Union of all tags from both nodes
          - Minus tags that are tombstoned in EITHER node
        """
        all_elements = set(self.elements.keys()) | set(other.elements.keys())
        merged_tombstones = self.tombstones | other.tombstones

        for elem in all_elements:
            my_tags = self.elements.get(elem, set())
            their_tags = other.elements.get(elem, set())
            # Union all tags, then remove tombstoned ones
            all_tags = (my_tags | their_tags) - merged_tombstones
            self.elements[elem] = all_tags

        self.tombstones = merged_tombstones

    def __repr__(self):
        return f"ORSet({self.value()})"

    def debug(self):
        """Show internal state for learning."""
        lines = [f"  {self.node_id} state:"]
        for elem, tags in sorted(self.elements.items()):
            status = "IN SET" if len(tags) > 0 else "REMOVED"
            lines.append(f"    {elem}: tags={tags}  [{status}]")
        if self.tombstones:
            lines.append(f"    tombstones: {self.tombstones}")
        return "\\n".join(lines)


# === Demo: Collaborative Shopping Cart ===
print("=== Collaborative Shopping Cart with OR-Set ===\\n")

alice = ORSet("alice")
bob = ORSet("bob")

# Both start by adding milk (independently)
tag_a = alice.add("milk")
tag_b = bob.add("milk")
print(f"Alice adds milk -> tag: {tag_a}")
print(f"Bob adds milk   -> tag: {tag_b}")

# Sync so both see both tags
alice.merge(bob)
bob.merge(alice)
print(f"\\nAfter sync, both have milk with 2 tags:")
print(alice.debug())

# Now: Alice REMOVES milk (removing both tags she can see)
# While Bob ADDS milk again (concurrent!)
print("\\n--- Concurrent operations ---")
removed = alice.remove("milk")
print(f"Alice removes milk, tombstoned: {removed}")

new_tag = bob.add("milk")
print(f"Bob adds milk (concurrent), new tag: {new_tag}")

print(f"\\nBefore merge:")
print(alice.debug())
print(bob.debug())

# Merge!
alice.merge(bob)
bob.merge(alice)

print(f"\\nAfter merge:")
print(alice.debug())
print(bob.debug())

print(f"\\nmilk in alice's set: {alice.contains('milk')}")
print(f"milk in bob's set:   {bob.contains('milk')}")
print("\\nBob's concurrent add survived because Alice's remove")
print("only tombstoned the tags she had SEEN. Bob's new tag was not observed!")

# === Multi-node convergence ===
print("\\n\\n=== 3-Node Convergence Demo ===")
n1 = ORSet("n1")
n2 = ORSet("n2")
n3 = ORSet("n3")

n1.add("apples")
n2.add("bananas")
n3.add("cherries")

# Sync all pairs
for a, b in [(n1, n2), (n2, n3), (n1, n3)]:
    a.merge(b)
    b.merge(a)

print(f"After full sync: {n1.value()}")
assert n1.value() == n2.value() == n3.value()
print(f"All nodes agree: {n1.value() == n2.value() == n3.value()}")`

const pythonORSetVsLWW = `import uuid

# --- LWW-Set for comparison ---
class LWWSet:
    """LWW-Element-Set: add/remove with timestamps."""
    def __init__(self, name="node"):
        self.name = name
        self.add_map = {}    # elem -> timestamp
        self.remove_map = {} # elem -> timestamp

    def add(self, elem, ts):
        self.add_map[elem] = max(self.add_map.get(elem, -1), ts)

    def remove(self, elem, ts):
        self.remove_map[elem] = max(self.remove_map.get(elem, -1), ts)

    def contains(self, elem):
        return self.add_map.get(elem, -1) > self.remove_map.get(elem, -1)

    def value(self):
        return {e for e in self.add_map if self.contains(e)}

    def merge(self, other):
        for e, ts in other.add_map.items():
            self.add_map[e] = max(self.add_map.get(e, -1), ts)
        for e, ts in other.remove_map.items():
            self.remove_map[e] = max(self.remove_map.get(e, -1), ts)

# --- OR-Set ---
class ORSet:
    def __init__(self, name="node"):
        self.name = name
        self.elements: dict[str, set[str]] = {}
        self.tombstones: set[str] = set()

    def add(self, elem):
        tag = f"{self.name}_{uuid.uuid4().hex[:4]}"
        if elem not in self.elements:
            self.elements[elem] = set()
        self.elements[elem].add(tag)

    def remove(self, elem):
        if elem in self.elements:
            self.tombstones |= self.elements[elem]
            self.elements[elem] = set()

    def contains(self, elem):
        return elem in self.elements and len(self.elements[elem]) > 0

    def value(self):
        return {e for e, t in self.elements.items() if len(t) > 0}

    def merge(self, other):
        all_elems = set(self.elements.keys()) | set(other.elements.keys())
        all_tomb = self.tombstones | other.tombstones
        for elem in all_elems:
            tags = (self.elements.get(elem, set()) | other.elements.get(elem, set())) - all_tomb
            self.elements[elem] = tags
        self.tombstones = all_tomb

# ============================================
# SCENARIO: Same concurrent operations, different results
# ============================================
print("=" * 60)
print("SAME OPERATIONS -> DIFFERENT RESULTS")
print("=" * 60)

print("\\nScenario: Shared shopping cart")
print("  1. Both nodes start with {milk, eggs}")
print("  2. Node A: adds 'milk' (re-add / refresh)")
print("  3. Node B: removes 'milk' (concurrent with A's add)")
print("  4. Merge")
print()

# --- LWW-Set version ---
print("--- LWW-Element-Set (bias: remove wins if same timestamp) ---")
lww_a = LWWSet("A")
lww_b = LWWSet("B")

# Setup: both have milk and eggs
for node in [lww_a, lww_b]:
    node.add("milk", 1)
    node.add("eggs", 2)

# Concurrent: A adds milk at t=5, B removes milk at t=5
lww_a.add("milk", 5)
lww_b.remove("milk", 5)

print(f"  A: add('milk', t=5)  -> A has: {lww_a.value()}")
print(f"  B: remove('milk', t=5) -> B has: {lww_b.value()}")

lww_a.merge(lww_b)
lww_b.merge(lww_a)
print(f"  After merge: A={lww_a.value()}, B={lww_b.value()}")
print(f"  milk in set? {lww_a.contains('milk')}")
print(f"  -> With equal timestamps, remove wins. milk is GONE.")

# --- What if A's timestamp is higher? ---
print("\\n--- LWW-Set: What if A uses t=6? ---")
lww_a2 = LWWSet("A")
lww_b2 = LWWSet("B")
for node in [lww_a2, lww_b2]:
    node.add("milk", 1)
    node.add("eggs", 2)
lww_a2.add("milk", 6)  # A has higher ts
lww_b2.remove("milk", 5)
lww_a2.merge(lww_b2)
print(f"  A: add('milk', t=6), B: remove('milk', t=5)")
print(f"  After merge: {lww_a2.value()}")
print(f"  milk in set? {lww_a2.contains('milk')} (add timestamp 6 > remove timestamp 5)")
print(f"  -> Result depends on who has the higher timestamp!")

# --- OR-Set version ---
print("\\n--- OR-Set (add-wins for concurrent ops) ---")
or_a = ORSet("A")
or_b = ORSet("B")

# Setup
or_a.add("milk")
or_a.add("eggs")
or_b.merge(or_a)
or_a.merge(or_b)

print(f"  Initial: both have {or_a.value()}")

# Concurrent: A adds milk (new tag), B removes milk (only observed tags)
or_a.add("milk")  # creates a NEW tag
or_b.remove("milk")  # tombstones only tags B has seen

print(f"  A: add('milk') [new tag] -> A has: {or_a.value()}")
print(f"  B: remove('milk') [observed tags only] -> B has: {or_b.value()}")

or_a.merge(or_b)
or_b.merge(or_a)
print(f"  After merge: A={or_a.value()}, B={or_b.value()}")
print(f"  milk in set? {or_a.contains('milk')}")
print(f"  -> A's concurrent add created a new tag that B never observed.")
print(f"  -> The new tag survives B's remove. milk stays. ADD WINS!")

print("\\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print("""
LWW-Set:
  - Conflict resolved by timestamp comparison
  - Result depends on clock values (fragile)
  - Concurrent add+remove: depends on timestamps
  - Simple but lossy

OR-Set:
  - Conflict resolved by unique tags + observation
  - No clocks needed — uses causality, not time
  - Concurrent add+remove: add ALWAYS wins
  - More complex but preserves intent
""")`

/* ------------------------------------------------------------------ */
/* Main lesson component                                               */
/* ------------------------------------------------------------------ */

export default function ORSet() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Hero ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-3">
          OR-Set: Observed-Remove Set
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          What happens when one user adds "milk" to a shared shopping cart while another user
          simultaneously removes it? With a simple set, you get a conflict. The OR-Set (Observed-Remove Set)
          resolves this by giving every add a unique tag, and letting removes only affect the specific
          adds they have observed. Concurrent adds survive. This is the gold standard CRDT for replicated sets.
        </p>
      </header>

      {/* ---- Section 1: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Concurrent Add and Remove</h2>
        <p className="text-gray-300 leading-relaxed">
          Consider a collaborative shopping cart replicated across your phone and laptop. You add
          "milk" on your phone. Your partner removes "milk" on the laptop at the same time (they
          think you already have some). When the devices sync, should milk be in the cart or not?
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is not a hypothetical edge case. It comes up constantly in:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
          <li><span className="text-yellow-400">Shared shopping lists</span> — concurrent add and remove of the same item</li>
          <li><span className="text-yellow-400">Collaborative todo apps</span> — one user marks done, another edits the task</li>
          <li><span className="text-yellow-400">Multiplayer game inventories</span> — two players pick up / drop the same item</li>
          <li><span className="text-yellow-400">Shared playlists</span> — one user adds a song, another removes it</li>
          <li><span className="text-yellow-400">Distributed caches</span> — concurrent invalidation and re-population</li>
        </ul>
      </section>

      {/* ---- Section 2: Naive Approaches ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Naive Approaches and Why They Fail</h2>
        <p className="text-gray-300 leading-relaxed">
          We saw the LWW-Element-Set in the previous lesson: use timestamps on add and remove,
          and the higher timestamp wins. But this has problems:
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-orange-400">LWW-Set (remove wins at equal timestamps)</h3>
            <p className="text-gray-400 text-sm">
              If add and remove happen at the "same time" (equal timestamps), one must win.
              If remove wins, you lose the concurrent add. If add wins, you cannot reliably remove.
              Either choice is unsatisfying.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-orange-400">Simple union / intersection</h3>
            <p className="text-gray-400 text-sm">
              Union of both replicas ignores removes entirely. Intersection loses adds.
              Neither reflects the actual intent of the operations.
            </p>
          </div>
        </div>
        <p className="text-gray-300 leading-relaxed">
          What we really want: if the add and remove are <span className="text-green-400">truly concurrent</span> (neither
          knew about the other), the add should win — because the person adding presumably has a
          reason to want the item. But if the remove happened <span className="text-red-400">after seeing</span> the
          add, the remove should succeed. OR-Set gives us exactly this distinction.
        </p>
      </section>

      {/* ---- Section 3: The OR-Set Insight ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The OR-Set Insight: Unique Tags</h2>
        <p className="text-gray-300 leading-relaxed">
          The key insight is beautifully simple: <span className="text-cyan-400 font-semibold">give every
          add operation a unique tag</span> (like a UUID). An element is in the set if it has any
          active (non-tombstoned) tags. A remove operation tombstones only the specific tags
          it has <span className="text-yellow-400">observed</span> — the ones visible on the
          removing node at the time of removal.
        </p>
        <div className="bg-slate-800/60 border border-indigo-700/50 rounded-lg p-4 font-mono text-sm space-y-2">
          <p className="text-gray-400">// Node A adds "milk" → creates tag a1</p>
          <p className="text-cyan-400">state_A: milk: {'{'} a1 {'}'}</p>
          <p className="text-gray-400 mt-2">// Node B independently adds "milk" → creates tag b2</p>
          <p className="text-pink-400">state_B: milk: {'{'} b2 {'}'}</p>
          <p className="text-gray-400 mt-2">// After sync, both have both tags</p>
          <p className="text-yellow-400">synced: milk: {'{'} a1, b2 {'}'}</p>
          <p className="text-gray-400 mt-2">// Node A removes milk → tombstones tags it has seen: {'{'} a1, b2 {'}'}</p>
          <p className="text-red-400">state_A: milk: {'{'} {'}'} (empty, removed)</p>
          <p className="text-gray-400 mt-2">// But if Node C added milk CONCURRENTLY → tag c3</p>
          <p className="text-green-400">state_C: milk: {'{'} c3 {'}'}</p>
          <p className="text-gray-400 mt-2">// After merge: c3 was NOT in A's tombstones, so it SURVIVES</p>
          <p className="text-green-400">merged: milk: {'{'} c3 {'}'} -- milk is in the set!</p>
        </div>
      </section>

      {/* ---- Interactive: Step-Through ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: OR-Set Step by Step</h2>
        <p className="text-gray-300 leading-relaxed">
          Step through a concurrent add/remove scenario across three nodes. Watch how unique tags
          are created with each add, how remove only tombstones observed tags, and how a concurrent
          add's unobserved tag survives the merge.
        </p>
        <ORSetSketch />
      </section>

      {/* ---- Section 4: Merge Operation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Merge Operation</h2>
        <p className="text-gray-300 leading-relaxed">
          Merging two OR-Sets follows a simple rule: take the union of all (element, tag) pairs
          from both nodes, then subtract any tags that appear in either node's tombstone set.
          This is commutative, associative, and idempotent — making OR-Set a true CRDT.
        </p>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 font-mono text-sm space-y-1">
          <p className="text-gray-400">// For each element e:</p>
          <p className="text-cyan-400">merged_tags[e] = (A.tags[e] UNION B.tags[e]) - (A.tombstones UNION B.tombstones)</p>
        </div>
        <MergeSketch />
      </section>

      {/* ---- Section 5: Add-Wins vs Remove-Wins ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Add-Wins vs Remove-Wins</h2>
        <p className="text-gray-300 leading-relaxed">
          The OR-Set provides <span className="text-green-400 font-semibold">add-wins</span> semantics
          for concurrent operations. This means if one node adds an element at the same time
          another node removes it, the add wins. Compare this with a Remove-Wins set where the
          remove always takes precedence. Toggle between them to see how the same operations
          produce different results.
        </p>
        <ComparisonSketch />
      </section>

      {/* ---- Section 6: Practical CRDT Composition ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">CRDT Composition: Building Bigger Structures</h2>
        <p className="text-gray-300 leading-relaxed">
          CRDTs compose naturally. Once you have an OR-Set, you can build more complex data structures:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2">OR-Map</h3>
            <p className="text-gray-400 text-sm">
              An OR-Set of (key, value) pairs. Each key maps to a nested CRDT (register, counter, or
              another set). Removing a key tombstones it; concurrent puts with new tags survive.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">Shopping Cart</h3>
            <p className="text-gray-400 text-sm">
              OR-Map where keys are product IDs and values are PN-Counters (positive-negative counters)
              for quantities. Add item = add to OR-Map. Change quantity = increment/decrement counter.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Collaborative Document</h3>
            <p className="text-gray-400 text-sm">
              Automerge and Yjs use CRDT-based sequences (RGA) for text and nested OR-Maps for
              document structure. Concurrent edits merge automatically without conflicts.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Access Control List</h3>
            <p className="text-gray-400 text-sm">
              OR-Set of (user, permission) pairs. Granting and revoking permissions across replicas.
              Concurrent grant + revoke: grant wins (add-wins), which may or may not be what you want.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 7: Real-World Usage ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">Riak</h3>
            <p className="text-gray-400 text-sm">
              Riak was the first production database to offer OR-Set as a native data type
              (<code className="text-cyan-400">set</code> bucket type). Used in production at
              Bet365, NHS, and many others for distributed counters, sets, and maps.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-pink-400 mb-2">Automerge</h3>
            <p className="text-gray-400 text-sm">
              A CRDT library for collaborative applications. Uses OpSets (a variant of OR-Set)
              internally to track document state. Powers local-first collaborative editors.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Phoenix LiveView (Elixir)</h3>
            <p className="text-gray-400 text-sm">
              The Phoenix framework's distributed PubSub layer uses CRDTs (including OR-Sets)
              to track presence information across nodes. When a user connects/disconnects, the
              presence state converges without coordination.
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">SoundCloud</h3>
            <p className="text-gray-400 text-sm">
              Used Riak CRDTs (including OR-Sets) for social features like followers and likes.
              Concurrent follow/unfollow across datacenters resolved cleanly with add-wins semantics.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python Cell 1: Full OR-Set Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation: OR-Set from Scratch</h2>
        <p className="text-gray-300 leading-relaxed">
          Build a complete OR-Set with add, remove, contains, merge, and debug inspection.
          Simulate concurrent add/remove across nodes and verify that the concurrent add
          survives because its tag was never observed by the remover.
        </p>
        <PythonCell defaultCode={pythonORSet} />
      </section>

      {/* ---- Python Cell 2: OR-Set vs LWW-Set Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Comparison: OR-Set vs LWW-Set</h2>
        <p className="text-gray-300 leading-relaxed">
          Run the exact same sequence of concurrent operations through both an OR-Set and an
          LWW-Set. See how the LWW-Set's result depends on timestamp values (fragile), while
          the OR-Set consistently preserves the concurrent add (robust).
        </p>
        <PythonCell defaultCode={pythonORSetVsLWW} />
      </section>

      {/* ---- Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
          <li>
            OR-Set gives every add a unique tag. A remove only tombstones tags the removing
            node has <span className="text-yellow-400">observed</span>. Concurrent adds with
            unseen tags survive.
          </li>
          <li>
            This provides <span className="text-green-400">add-wins semantics</span> for
            concurrent operations — if add and remove happen simultaneously, the add wins.
          </li>
          <li>
            Merge is commutative, associative, and idempotent: union of all tags minus union
            of all tombstones. OR-Set is a true CRDT.
          </li>
          <li>
            Unlike LWW-Set, OR-Set does not depend on clocks. It uses causality (what has
            been observed) rather than timestamps.
          </li>
          <li>
            The trade-off is metadata overhead: every add creates a unique tag that must be
            stored. Garbage collection of tombstones requires coordination.
          </li>
          <li>
            CRDTs compose: OR-Sets can be nested inside OR-Maps to build collaborative
            documents, shopping carts, access control lists, and more.
          </li>
          <li>
            Used in production at Riak, Automerge, Phoenix LiveView, and many distributed
            systems that need conflict-free replication without coordination.
          </li>
        </ul>
      </section>
    </div>
  )
}
