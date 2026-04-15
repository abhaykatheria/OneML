import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/skip-list',
  title: 'Skip Lists: Probabilistic Sorted Structure',
  description:
    'A sorted data structure with O(log n) operations using probabilistic balancing — no rotations needed, simpler than balanced BSTs',
  track: 'datastructures',
  order: 9,
  tags: ['skip-list', 'probabilistic', 'sorted', 'redis', 'linked-list', 'search'],
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

/* ------------------------------------------------------------------ */
/* Skip List Data Structure for Visualization                          */
/* ------------------------------------------------------------------ */

interface SLNode {
  value: number
  forward: (SLNode | null)[]  // pointers at each level
}

interface SkipListState {
  head: SLNode
  maxLevel: number
  level: number  // current highest level in use
  size: number
}

function createSkipList(maxLevel: number): SkipListState {
  const head: SLNode = {
    value: -Infinity,
    forward: new Array(maxLevel + 1).fill(null),
  }
  return { head, maxLevel, level: 0, size: 0 }
}

function randomLevel(maxLevel: number): number {
  let lvl = 0
  while (Math.random() < 0.5 && lvl < maxLevel) {
    lvl++
  }
  return lvl
}

function skipListInsert(sl: SkipListState, value: number): { level: number; path: { node: SLNode; level: number }[] } {
  const update: (SLNode | null)[] = new Array(sl.maxLevel + 1).fill(null)
  const path: { node: SLNode; level: number }[] = []
  let current = sl.head

  for (let i = sl.level; i >= 0; i--) {
    while (current.forward[i] !== null && current.forward[i]!.value < value) {
      path.push({ node: current, level: i })
      current = current.forward[i]!
    }
    update[i] = current
  }

  // Check if already exists
  if (current.forward[0] !== null && current.forward[0]!.value === value) {
    return { level: -1, path }
  }

  const newLevel = randomLevel(sl.maxLevel)

  if (newLevel > sl.level) {
    for (let i = sl.level + 1; i <= newLevel; i++) {
      update[i] = sl.head
    }
    sl.level = newLevel
  }

  const newNode: SLNode = {
    value,
    forward: new Array(newLevel + 1).fill(null),
  }

  for (let i = 0; i <= newLevel; i++) {
    newNode.forward[i] = update[i]!.forward[i]
    update[i]!.forward[i] = newNode
  }

  sl.size++
  return { level: newLevel, path }
}

function skipListSearch(sl: SkipListState, value: number): { found: boolean; path: { node: SLNode; level: number }[] } {
  const path: { node: SLNode; level: number }[] = []
  let current = sl.head

  for (let i = sl.level; i >= 0; i--) {
    while (current.forward[i] !== null && current.forward[i]!.value < value) {
      path.push({ node: current, level: i })
      current = current.forward[i]!
    }
    path.push({ node: current, level: i })
  }

  const found = current.forward[0] !== null && current.forward[0]!.value === value
  if (found) {
    path.push({ node: current.forward[0]!, level: 0 })
  }

  return { found, path }
}

function skipListDelete(sl: SkipListState, value: number): boolean {
  const update: (SLNode | null)[] = new Array(sl.maxLevel + 1).fill(null)
  let current = sl.head

  for (let i = sl.level; i >= 0; i--) {
    while (current.forward[i] !== null && current.forward[i]!.value < value) {
      current = current.forward[i]!
    }
    update[i] = current
  }

  const target = current.forward[0]
  if (target === null || target.value !== value) return false

  for (let i = 0; i <= sl.level; i++) {
    if (update[i]!.forward[i] !== target) break
    update[i]!.forward[i] = target.forward[i]
  }

  while (sl.level > 0 && sl.head.forward[sl.level] === null) {
    sl.level--
  }

  sl.size--
  return true
}

function getNodes(sl: SkipListState): SLNode[] {
  const nodes: SLNode[] = []
  let current = sl.head.forward[0]
  while (current !== null) {
    nodes.push(current)
    current = current.forward[0]
  }
  return nodes
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Skip List Visualization                     */
/* ------------------------------------------------------------------ */

function SkipListSketch() {
  const MAX_LEVEL = 6

  const [inputValue, setInputValue] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const slRef = useRef<SkipListState>(createSkipList(MAX_LEVEL))
  const searchPathRef = useRef<Set<string>>(new Set())
  const highlightValueRef = useRef<number | null>(null)
  const highlightTypeRef = useRef<'insert' | 'search' | 'delete' | null>(null)
  const animTimerRef = useRef(0)
  const insertLevelRef = useRef(-1)

  const handleInsert = useCallback(() => {
    const val = parseInt(inputValue.trim())
    if (isNaN(val)) return
    const result = skipListInsert(slRef.current, val)
    if (result.level === -1) {
      setStatusMsg(`${val} already exists in the skip list`)
    } else {
      const coinFlips = result.level + 1
      setStatusMsg(`Inserted ${val} at level ${result.level} (${coinFlips} coin flip${coinFlips > 1 ? 's' : ''}: ${'H'.repeat(result.level)}T)`)
      insertLevelRef.current = result.level
    }
    highlightValueRef.current = val
    highlightTypeRef.current = 'insert'
    animTimerRef.current = 120
    searchPathRef.current.clear()
    result.path.forEach(p => searchPathRef.current.add(`${p.node.value}:${p.level}`))
    setInputValue('')
  }, [inputValue])

  const handleSearch = useCallback(() => {
    const val = parseInt(inputValue.trim())
    if (isNaN(val)) return
    const result = skipListSearch(slRef.current, val)
    searchPathRef.current.clear()
    result.path.forEach(p => searchPathRef.current.add(`${p.node.value}:${p.level}`))
    highlightValueRef.current = val
    highlightTypeRef.current = 'search'
    animTimerRef.current = 120
    insertLevelRef.current = -1
    setStatusMsg(result.found ? `Found ${val}! Search path highlighted in yellow` : `${val} not found. Search terminated.`)
    setInputValue('')
  }, [inputValue])

  const handleDelete = useCallback(() => {
    const val = parseInt(inputValue.trim())
    if (isNaN(val)) return
    const deleted = skipListDelete(slRef.current, val)
    highlightValueRef.current = val
    highlightTypeRef.current = 'delete'
    animTimerRef.current = 90
    searchPathRef.current.clear()
    insertLevelRef.current = -1
    setStatusMsg(deleted ? `Deleted ${val}. Pointers updated.` : `${val} not found in skip list.`)
    setInputValue('')
  }, [inputValue])

  const handleRandomInsert = useCallback(() => {
    const val = Math.floor(Math.random() * 100) + 1
    const result = skipListInsert(slRef.current, val)
    if (result.level === -1) {
      setStatusMsg(`${val} already exists`)
    } else {
      setStatusMsg(`Inserted ${val} at level ${result.level}`)
      insertLevelRef.current = result.level
    }
    highlightValueRef.current = val
    highlightTypeRef.current = 'insert'
    animTimerRef.current = 120
    searchPathRef.current.clear()
    result.path.forEach(p => searchPathRef.current.add(`${p.node.value}:${p.level}`))
  }, [])

  const handleReset = useCallback(() => {
    slRef.current = createSkipList(MAX_LEVEL)
    searchPathRef.current.clear()
    highlightValueRef.current = null
    highlightTypeRef.current = null
    animTimerRef.current = 0
    insertLevelRef.current = -1
    setStatusMsg('')
    setInputValue('')
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 480

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(...BG)
      const W = p.width
      const sl = slRef.current
      const nodes = getNodes(sl)
      const ctx = p.drawingContext as CanvasRenderingContext2D

      // Decrement timer
      if (animTimerRef.current > 0) {
        animTimerRef.current--
        if (animTimerRef.current <= 0) {
          highlightValueRef.current = null
          highlightTypeRef.current = null
          searchPathRef.current.clear()
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Skip List  |  ${sl.size} elements  |  ${sl.level + 1} levels`, 16, 12)

      if (nodes.length === 0) {
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Empty skip list. Insert some values (1-100) to begin!', W / 2, 200)

        // Draw the analogy
        p.fill(...TEXT_C)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Think of it like a train system:', 16, 340)
        p.fill(...GREEN)
        p.text('Level 0: Local train — stops at EVERY station', 30, 362)
        p.fill(...YELLOW)
        p.text('Level 1: Express train — stops at ~half the stations', 30, 380)
        p.fill(...ORANGE)
        p.text('Level 2: Super express — stops at ~quarter of stations', 30, 398)
        p.fill(...PINK)
        p.text('Level 3+: Bullet train — only major hubs', 30, 416)

        p.fill(...TEXT_C)
        p.textSize(10)
        p.text('Search starts on the fastest train, drops down when it overshoots.', 16, 445)
        return
      }

      // Layout: levels go from top (highest) to bottom (level 0)
      const maxDisplayLevel = Math.max(sl.level, 3)
      const levelH = 50
      const topMargin = 50
      const nodeW = Math.min(48, (W - 120) / (nodes.length + 1))
      const startX = 70
      const headX = 20

      // Level labels
      for (let lvl = 0; lvl <= maxDisplayLevel; lvl++) {
        const y = topMargin + (maxDisplayLevel - lvl) * levelH
        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`L${lvl}`, headX + 28, y)

        // Level description
        const labels = ['Local', 'Express', 'Super Exp.', 'Bullet', 'Ultra', 'Hyper', 'Max']
        p.fill(60, 70, 90)
        p.textSize(7)
        p.text(labels[Math.min(lvl, labels.length - 1)] ?? '', headX + 28, y + 12)
      }

      // Draw head sentinel column
      for (let lvl = 0; lvl <= sl.level; lvl++) {
        const y = topMargin + (maxDisplayLevel - lvl) * levelH
        p.fill(...GRID_C)
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.rect(headX, y - 12, 30, 24, 4)
        p.fill(...TEXT_C)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('HEAD', headX + 15, y)
      }

      // Draw nodes at each level
      const searchPath = searchPathRef.current
      const hlValue = highlightValueRef.current
      const hlType = highlightTypeRef.current

      for (let ni = 0; ni < nodes.length; ni++) {
        const node = nodes[ni]
        const x = startX + ni * nodeW
        const nodeLevel = node.forward.length - 1

        for (let lvl = 0; lvl <= nodeLevel; lvl++) {
          const y = topMargin + (maxDisplayLevel - lvl) * levelH
          const isOnPath = searchPath.has(`${node.value}:${lvl}`)
          const isHighlighted = node.value === hlValue

          // Node box
          if (isHighlighted && hlType === 'insert') {
            const pulse = Math.sin(animTimerRef.current * 0.1) * 30 + 200
            p.fill(GREEN[0], GREEN[1], GREEN[2], pulse)
          } else if (isHighlighted && hlType === 'search') {
            p.fill(CYAN[0], CYAN[1], CYAN[2], 200)
          } else if (isOnPath) {
            p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 140)
          } else {
            const levelColor = [ACCENT, GREEN, ORANGE, PINK, RED, CYAN, YELLOW][lvl % 7]
            p.fill(levelColor[0], levelColor[1], levelColor[2], 120)
          }

          p.stroke(isOnPath ? 255 : 51, isOnPath ? 255 : 65, isOnPath ? 255 : 85)
          p.strokeWeight(isOnPath ? 2 : 1)
          p.rect(x, y - 12, nodeW - 4, 24, 4)

          // Value text
          p.fill(255)
          p.noStroke()
          p.textSize(nodeW > 35 ? 11 : 9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${node.value}`, x + (nodeW - 4) / 2, y)
        }

        // Draw forward pointers (arrows)
        for (let lvl = 0; lvl <= nodeLevel; lvl++) {
          const y = topMargin + (maxDisplayLevel - lvl) * levelH
          const nextNode = node.forward[lvl]

          if (nextNode !== null) {
            const nextIdx = nodes.indexOf(nextNode)
            if (nextIdx >= 0) {
              const nextX = startX + nextIdx * nodeW
              const isOnPath = searchPath.has(`${node.value}:${lvl}`)

              if (isOnPath) {
                p.stroke(YELLOW[0], YELLOW[1], YELLOW[2], 200)
                p.strokeWeight(2)
              } else {
                p.stroke(70, 80, 100)
                p.strokeWeight(1)
              }

              // Arrow line
              const fromX = x + nodeW - 4
              const toX = nextX
              ctx.setLineDash(isOnPath ? [] : [3, 3])
              p.line(fromX, y, toX, y)
              ctx.setLineDash([])

              // Arrowhead
              p.fill(isOnPath ? YELLOW[0] : 70, isOnPath ? YELLOW[1] : 80, isOnPath ? YELLOW[2] : 100)
              p.noStroke()
              p.triangle(toX, y, toX - 6, y - 3, toX - 6, y + 3)
            }
          } else {
            // Arrow to null (end)
            const y2 = topMargin + (maxDisplayLevel - lvl) * levelH
            const isOnPath2 = searchPath.has(`${node.value}:${lvl}`)
            p.stroke(isOnPath2 ? YELLOW[0] : 50, isOnPath2 ? YELLOW[1] : 55, isOnPath2 ? YELLOW[2] : 65)
            p.strokeWeight(1)
            ctx.setLineDash([2, 4])
            p.line(x + nodeW - 4, y2, x + nodeW + 12, y2)
            ctx.setLineDash([])
            p.fill(isOnPath2 ? YELLOW[0] : 80, isOnPath2 ? YELLOW[1] : 85, isOnPath2 ? YELLOW[2] : 95)
            p.noStroke()
            p.textSize(7)
            p.textAlign(p.LEFT, p.CENTER)
            if (ni === nodes.length - 1) {
              p.text('null', x + nodeW + 2, y2)
            }
          }
        }
      }

      // Draw head forward pointers
      for (let lvl = 0; lvl <= sl.level; lvl++) {
        const y = topMargin + (maxDisplayLevel - lvl) * levelH
        const firstAtLevel = sl.head.forward[lvl]
        if (firstAtLevel !== null) {
          const firstIdx = nodes.indexOf(firstAtLevel)
          if (firstIdx >= 0) {
            const targetX = startX + firstIdx * nodeW
            const isOnPath = searchPath.has(`${-Infinity}:${lvl}`)
            p.stroke(isOnPath ? YELLOW[0] : 60, isOnPath ? YELLOW[1] : 70, isOnPath ? YELLOW[2] : 80)
            p.strokeWeight(isOnPath ? 2 : 1)
            p.line(headX + 30, y, targetX, y)
            p.fill(isOnPath ? YELLOW[0] : 60, isOnPath ? YELLOW[1] : 70, isOnPath ? YELLOW[2] : 80)
            p.noStroke()
            p.triangle(targetX, y, targetX - 5, y - 3, targetX - 5, y + 3)
          }
        }
      }

      // Coin flip visualization for last insert
      if (insertLevelRef.current >= 0 && animTimerRef.current > 60) {
        const coinY = topMargin + (maxDisplayLevel + 1) * levelH + 20
        p.fill(255)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Coin flips:', 16, coinY)

        for (let i = 0; i <= insertLevelRef.current + 1 && i <= MAX_LEVEL; i++) {
          const isHeads = i < insertLevelRef.current + 1
          const cx = 110 + i * 32
          p.fill(isHeads ? GREEN[0] : RED[0], isHeads ? GREEN[1] : RED[1], isHeads ? GREEN[2] : RED[2], 180)
          p.ellipse(cx, coinY + 8, 24, 24)
          p.fill(255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(isHeads ? 'H' : 'T', cx, coinY + 8)
        }

        p.fill(...TEXT_C)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        const totalFlips = insertLevelRef.current + 2
        p.text(`= level ${insertLevelRef.current} (${totalFlips > MAX_LEVEL + 1 ? MAX_LEVEL + 1 : totalFlips} flips)`, 110 + (insertLevelRef.current + 2) * 32 + 8, coinY + 8)
      }

      // Info
      const infoY = canvasH - 40
      p.fill(...TEXT_C)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Search: start at HEAD top level, skip right while next < target, drop down at each level', 16, infoY)
      p.text('Expected height: O(log n). Each level has ~half the elements of the level below.', 16, infoY + 14)
    }
  }, [])

  return (
    <div>
      <P5Sketch
        sketch={sketch}
        height={480}
        controls={
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert() }}
              placeholder="Enter number (1-100)"
              className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm w-40"
            />
            <button onClick={handleInsert} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
              Insert
            </button>
            <button onClick={handleSearch} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
              Search
            </button>
            <button onClick={handleDelete} className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-medium">
              Delete
            </button>
            <button onClick={handleRandomInsert} className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">
              +Random
            </button>
            <button onClick={handleReset} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">
              Reset
            </button>
          </div>
        }
      />
      {statusMsg && (
        <p className={`mt-2 text-sm font-mono ${statusMsg.includes('not found') || statusMsg.includes('already') ? 'text-yellow-400' : statusMsg.includes('Deleted') ? 'text-red-400' : 'text-emerald-400'}`}>
          {statusMsg}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Search Path Animation                                   */
/* ------------------------------------------------------------------ */

function SearchAnimationSketch() {
  const [targetValue, setTargetValue] = useState(42)
  const targetRef = useRef(targetValue)
  targetRef.current = targetValue

  const slRef = useRef<SkipListState | null>(null)
  const nodesRef = useRef<SLNode[]>([])
  const searchStepRef = useRef(0)
  const searchPathRef = useRef<{ nodeIdx: number; level: number }[]>([])
  const runningRef = useRef(false)
  const [running, setRunning] = useState(false)
  runningRef.current = running
  const frameCountRef = useRef(0)
  const foundRef = useRef(false)

  const initSkipList = useCallback(() => {
    const sl = createSkipList(5)
    const values = [3, 7, 12, 18, 25, 30, 35, 42, 50, 55, 62, 70, 78, 85, 92]
    for (const v of values) {
      skipListInsert(sl, v)
    }
    slRef.current = sl
    nodesRef.current = getNodes(sl)
    searchStepRef.current = 0
    searchPathRef.current = []
    foundRef.current = false
  }, [])

  const startSearch = useCallback(() => {
    if (!slRef.current) initSkipList()
    const sl = slRef.current!
    const target = targetRef.current

    // Precompute the full search path step by step
    const path: { nodeIdx: number; level: number }[] = []
    const nodes = nodesRef.current
    let current = sl.head
    let currentIdx = -1 // -1 = head

    for (let lvl = sl.level; lvl >= 0; lvl--) {
      path.push({ nodeIdx: currentIdx, level: lvl })
      while (current.forward[lvl] !== null && current.forward[lvl]!.value < target) {
        current = current.forward[lvl]!
        currentIdx = nodes.indexOf(current)
        path.push({ nodeIdx: currentIdx, level: lvl })
      }
      if (current.forward[lvl] !== null && current.forward[lvl]!.value === target) {
        currentIdx = nodes.indexOf(current.forward[lvl]!)
        path.push({ nodeIdx: currentIdx, level: lvl })
        foundRef.current = true
        break
      }
    }

    if (!foundRef.current && current.forward[0] !== null && current.forward[0]!.value === target) {
      currentIdx = nodes.indexOf(current.forward[0]!)
      path.push({ nodeIdx: currentIdx, level: 0 })
      foundRef.current = true
    }

    searchPathRef.current = path
    searchStepRef.current = 0
    setRunning(true)
  }, [initSkipList])

  const sketch = useCallback((p: p5) => {
    const canvasH = 380

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 780
      p.createCanvas(Math.min(pw, 780), canvasH)
      p.textFont('monospace')
      initSkipList()
    }

    p.draw = () => {
      p.background(...BG)
      const W = p.width
      const sl = slRef.current
      if (!sl) return
      const nodes = nodesRef.current
      const ctx = p.drawingContext as CanvasRenderingContext2D

      // Advance search animation
      if (runningRef.current) {
        frameCountRef.current++
        if (frameCountRef.current % 15 === 0) {
          if (searchStepRef.current < searchPathRef.current.length - 1) {
            searchStepRef.current++
          } else {
            runningRef.current = false
            setRunning(false)
          }
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Search Animation  |  Looking for: ${targetRef.current}`, 16, 12)

      // Layout
      const maxDisplayLevel = Math.max(sl.level, 3)
      const levelH = 45
      const topMargin = 45
      const nodeW = Math.min(44, (W - 100) / (nodes.length + 1))
      const startX = 60
      const headX = 10

      // Current search position
      const currentStep = searchStepRef.current
      const visitedSteps = new Set<string>()
      const currentPos = searchPathRef.current[currentStep]

      for (let i = 0; i <= currentStep && i < searchPathRef.current.length; i++) {
        const step = searchPathRef.current[i]
        visitedSteps.add(`${step.nodeIdx}:${step.level}`)
      }

      // Draw levels
      for (let lvl = 0; lvl <= maxDisplayLevel; lvl++) {
        const y = topMargin + (maxDisplayLevel - lvl) * levelH
        p.fill(...TEXT_C)
        p.textSize(8)
        p.noStroke()
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`L${lvl}`, headX + 22, y)

        // Horizontal guide line
        p.stroke(25, 35, 55)
        p.strokeWeight(1)
        ctx.setLineDash([2, 4])
        p.line(headX + 30, y, W - 10, y)
        ctx.setLineDash([])
      }

      // Draw head
      for (let lvl = 0; lvl <= sl.level; lvl++) {
        const y = topMargin + (maxDisplayLevel - lvl) * levelH
        const isVisited = visitedSteps.has(`-1:${lvl}`)
        const isCurrent = currentPos && currentPos.nodeIdx === -1 && currentPos.level === lvl

        p.fill(isCurrent ? YELLOW[0] : isVisited ? YELLOW[0] : GRID_C[0],
          isCurrent ? YELLOW[1] : isVisited ? YELLOW[1] : GRID_C[1],
          isCurrent ? YELLOW[2] : isVisited ? YELLOW[2] : GRID_C[2],
          isCurrent ? 240 : isVisited ? 100 : 255)
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.rect(headX, y - 10, 24, 20, 3)
        p.fill(isCurrent || isVisited ? 0 : 150)
        p.noStroke()
        p.textSize(6)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('HD', headX + 12, y)
      }

      // Draw nodes
      for (let ni = 0; ni < nodes.length; ni++) {
        const node = nodes[ni]
        const x = startX + ni * nodeW
        const nodeLevel = node.forward.length - 1

        for (let lvl = 0; lvl <= nodeLevel; lvl++) {
          const y = topMargin + (maxDisplayLevel - lvl) * levelH
          const isVisited = visitedSteps.has(`${ni}:${lvl}`)
          const isCurrent = currentPos && currentPos.nodeIdx === ni && currentPos.level === lvl
          const isTarget = node.value === targetRef.current

          if (isCurrent && isTarget && foundRef.current) {
            const pulse = Math.sin(p.frameCount * 0.15) * 40 + 200
            p.fill(GREEN[0], GREEN[1], GREEN[2], pulse)
          } else if (isCurrent) {
            p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 220)
          } else if (isVisited) {
            p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 80)
          } else {
            p.fill(ACCENT[0], ACCENT[1], ACCENT[2], 100)
          }

          p.stroke(isCurrent ? 255 : 51, isCurrent ? 255 : 65, isCurrent ? 255 : 85)
          p.strokeWeight(isCurrent ? 2 : 1)
          p.rect(x, y - 10, nodeW - 3, 20, 3)

          p.fill(255)
          p.noStroke()
          p.textSize(nodeW > 35 ? 10 : 8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${node.value}`, x + (nodeW - 3) / 2, y)
        }

        // Forward pointers at level 0
        if (node.forward[0]) {
          const nextIdx = nodes.indexOf(node.forward[0])
          if (nextIdx >= 0) {
            const fromX = startX + ni * nodeW + nodeW - 3
            const toX = startX + nextIdx * nodeW
            const y = topMargin + maxDisplayLevel * levelH
            p.stroke(50, 55, 70)
            p.strokeWeight(1)
            p.line(fromX, y, toX, y)
          }
        }
      }

      // Search status
      const statusY = topMargin + (maxDisplayLevel + 1) * levelH + 15
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)

      if (currentPos) {
        const nodeName = currentPos.nodeIdx === -1 ? 'HEAD' : `${nodes[currentPos.nodeIdx]?.value}`
        p.text(`Step ${currentStep + 1}/${searchPathRef.current.length}: at node ${nodeName}, level ${currentPos.level}`, 16, statusY)

        if (!runningRef.current && searchStepRef.current === searchPathRef.current.length - 1) {
          p.fill(foundRef.current ? GREEN[0] : RED[0], foundRef.current ? GREEN[1] : RED[1], foundRef.current ? GREEN[2] : RED[2])
          p.text(foundRef.current ? `Found ${targetRef.current}!` : `${targetRef.current} not in list`, 16, statusY + 20)
          p.fill(...TEXT_C)
          p.textSize(10)
          p.text(`Total steps: ${searchPathRef.current.length} (vs ${nodes.length} in linear scan = ${((1 - searchPathRef.current.length / nodes.length) * 100).toFixed(0)}% fewer)`, 16, statusY + 40)
        }
      } else {
        p.fill(...TEXT_C)
        p.text('Click "Search" to animate the lookup path', 16, statusY)
      }
    }
  }, [initSkipList])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Target:
            <input type="range" min={1} max={100} value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))} className="w-32" />
            <span className="text-white font-mono w-8">{targetValue}</span>
          </label>
          <button onClick={startSearch}
            className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
            Search
          </button>
          <button onClick={() => { initSkipList(); searchPathRef.current = []; searchStepRef.current = 0; foundRef.current = false; setRunning(false) }}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">
            Rebuild
          </button>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const skipListImplementation = `import random
import math

class SkipListNode:
    """A node in the skip list with multiple levels of forward pointers."""
    def __init__(self, value, level):
        self.value = value
        self.forward = [None] * (level + 1)

    def __repr__(self):
        return f"Node({self.value}, levels={len(self.forward)})"


class SkipList:
    """
    Skip List: a probabilistic sorted data structure.

    Like a linked list with "express lanes" at multiple levels.
    - Level 0: all elements (the local train)
    - Level 1: ~half the elements (the express)
    - Level 2: ~quarter of elements (the super express)
    ...and so on.

    Search starts at the top level and skips ahead quickly,
    dropping down to lower levels for finer-grained search.
    No rotations needed (unlike AVL / Red-Black trees)!
    """

    def __init__(self, max_level=16, p=0.5):
        """
        Args:
            max_level: maximum height of a node
            p: probability of promoting to next level (0.5 = flip a coin)
        """
        self.max_level = max_level
        self.p = p
        self.header = SkipListNode(-float('inf'), max_level)
        self.level = 0  # current highest level in use
        self.size = 0

    def _random_level(self) -> int:
        """Generate random level using coin flips."""
        lvl = 0
        while random.random() < self.p and lvl < self.max_level:
            lvl += 1
        return lvl

    def insert(self, value) -> bool:
        """Insert a value. Returns True if inserted, False if duplicate."""
        update = [None] * (self.max_level + 1)
        current = self.header

        # Find insertion position at each level
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
            update[i] = current

        # Check for duplicate
        if current.forward[0] and current.forward[0].value == value:
            return False

        # Random level for new node
        new_level = self._random_level()

        # If new level exceeds current, update header
        if new_level > self.level:
            for i in range(self.level + 1, new_level + 1):
                update[i] = self.header
            self.level = new_level

        # Create and wire up new node
        new_node = SkipListNode(value, new_level)
        for i in range(new_level + 1):
            new_node.forward[i] = update[i].forward[i]
            update[i].forward[i] = new_node

        self.size += 1
        return True

    def search(self, value) -> bool:
        """Search for a value. Returns True if found."""
        current = self.header
        comparisons = 0

        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
                comparisons += 1
            comparisons += 1  # comparison that caused us to stop

        current = current.forward[0]
        comparisons += 1

        found = current is not None and current.value == value
        return found

    def search_with_stats(self, value):
        """Search and return comparison count."""
        current = self.header
        comparisons = 0
        path = []

        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
                comparisons += 1
                path.append((current.value, i))
            comparisons += 1

        current = current.forward[0]
        comparisons += 1
        found = current is not None and current.value == value

        return found, comparisons, path

    def delete(self, value) -> bool:
        """Delete a value. Returns True if found and removed."""
        update = [None] * (self.max_level + 1)
        current = self.header

        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
            update[i] = current

        target = current.forward[0]
        if target is None or target.value != value:
            return False

        for i in range(self.level + 1):
            if update[i].forward[i] != target:
                break
            update[i].forward[i] = target.forward[i]

        while self.level > 0 and self.header.forward[self.level] is None:
            self.level -= 1

        self.size -= 1
        return True

    def range_query(self, low, high):
        """Return all values in [low, high]."""
        result = []
        current = self.header

        # Find start position
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < low:
                current = current.forward[i]

        # Collect values in range
        current = current.forward[0]
        while current and current.value <= high:
            result.append(current.value)
            current = current.forward[0]

        return result

    def display(self):
        """Print the skip list structure."""
        for lvl in range(self.level, -1, -1):
            line = f"L{lvl}: HEAD"
            node = self.header.forward[lvl]
            while node:
                line += f" -> {node.value}"
                node = node.forward[lvl]
            line += " -> None"
            print(line)


# === Demo ===
random.seed(42)
sl = SkipList(max_level=6)

# Insert values
values = [3, 7, 12, 18, 25, 30, 35, 42, 50, 55, 62, 70, 78, 85, 92]
for v in values:
    sl.insert(v)

print("=== Skip List Structure ===")
sl.display()
print(f"\\nSize: {sl.size}, Levels: {sl.level + 1}")
print()

# Search demo
print("=== Search Demo ===")
for target in [42, 55, 99, 3]:
    found, comparisons, path = sl.search_with_stats(target)
    status = "FOUND" if found else "NOT FOUND"
    print(f"  search({target}): {status} in {comparisons} comparisons")
    if path:
        path_str = " -> ".join(f"({v},L{l})" for v, l in path[-5:])
        print(f"    path: ...{path_str}")

print(f"\\n  Linear scan would need up to {sl.size} comparisons")
print(f"  Skip list: O(log {sl.size}) = ~{math.log2(sl.size):.1f} expected")
print()

# Range query
print("=== Range Query ===")
for low, high in [(20, 60), (1, 15), (70, 100)]:
    result = sl.range_query(low, high)
    print(f"  range({low}, {high}): {result}")

print()

# Delete demo
print("=== Delete Demo ===")
print(f"Before: size={sl.size}")
sl.delete(42)
sl.delete(25)
sl.delete(78)
print(f"After deleting 42, 25, 78: size={sl.size}")
print(f"  search(42): {sl.search(42)}")
print(f"  search(25): {sl.search(25)}")
print(f"  search(50): {sl.search(50)}")
print()
sl.display()
`

const skipListBenchmark = `import random
import time
import bisect
import math

class SkipListNode:
    __slots__ = ('value', 'forward')
    def __init__(self, value, level):
        self.value = value
        self.forward = [None] * (level + 1)

class SkipList:
    def __init__(self, max_level=20, p=0.5):
        self.max_level = max_level
        self.p = p
        self.header = SkipListNode(-float('inf'), max_level)
        self.level = 0
        self.size = 0

    def _random_level(self):
        lvl = 0
        while random.random() < self.p and lvl < self.max_level:
            lvl += 1
        return lvl

    def insert(self, value):
        update = [None] * (self.max_level + 1)
        current = self.header
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
            update[i] = current
        if current.forward[0] and current.forward[0].value == value:
            return False
        new_level = self._random_level()
        if new_level > self.level:
            for i in range(self.level + 1, new_level + 1):
                update[i] = self.header
            self.level = new_level
        new_node = SkipListNode(value, new_level)
        for i in range(new_level + 1):
            new_node.forward[i] = update[i].forward[i]
            update[i].forward[i] = new_node
        self.size += 1
        return True

    def search(self, value):
        current = self.header
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
        current = current.forward[0]
        return current is not None and current.value == value

    def delete(self, value):
        update = [None] * (self.max_level + 1)
        current = self.header
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < value:
                current = current.forward[i]
            update[i] = current
        target = current.forward[0]
        if not target or target.value != value:
            return False
        for i in range(self.level + 1):
            if update[i].forward[i] != target:
                break
            update[i].forward[i] = target.forward[i]
        while self.level > 0 and self.header.forward[self.level] is None:
            self.level -= 1
        self.size -= 1
        return True

    def range_query(self, low, high):
        current = self.header
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].value < low:
                current = current.forward[i]
        result = []
        current = current.forward[0]
        while current and current.value <= high:
            result.append(current.value)
            current = current.forward[0]
        return result


def benchmark(n):
    """Benchmark skip list vs sorted list vs bisect."""
    random.seed(42)
    data = random.sample(range(n * 10), n)
    search_targets = random.sample(data, min(1000, n))
    delete_targets = random.sample(data, min(500, n))

    results = {}

    # === Skip List ===
    sl = SkipList()
    t0 = time.time()
    for v in data:
        sl.insert(v)
    results['SkipList insert'] = time.time() - t0

    t0 = time.time()
    for v in search_targets:
        sl.search(v)
    results['SkipList search'] = time.time() - t0

    t0 = time.time()
    rq = sl.range_query(n * 2, n * 4)
    results['SkipList range'] = time.time() - t0
    results['SkipList range_count'] = len(rq)

    t0 = time.time()
    for v in delete_targets:
        sl.delete(v)
    results['SkipList delete'] = time.time() - t0

    # === Sorted List + bisect ===
    sorted_list = []
    t0 = time.time()
    for v in data:
        bisect.insort(sorted_list, v)
    results['bisect insert'] = time.time() - t0

    t0 = time.time()
    for v in search_targets:
        idx = bisect.bisect_left(sorted_list, v)
        _ = idx < len(sorted_list) and sorted_list[idx] == v
    results['bisect search'] = time.time() - t0

    t0 = time.time()
    lo = bisect.bisect_left(sorted_list, n * 2)
    hi = bisect.bisect_right(sorted_list, n * 4)
    rq2 = sorted_list[lo:hi]
    results['bisect range'] = time.time() - t0
    results['bisect range_count'] = len(rq2)

    t0 = time.time()
    for v in delete_targets:
        idx = bisect.bisect_left(sorted_list, v)
        if idx < len(sorted_list) and sorted_list[idx] == v:
            sorted_list.pop(idx)
    results['bisect delete'] = time.time() - t0

    # === Plain sorted() ===
    t0 = time.time()
    plain = sorted(data)
    results['sorted() build'] = time.time() - t0

    return results


# === Run benchmarks ===
print("=== Skip List vs Sorted List + bisect ===")
print()

for n in [1000, 5000, 10000]:
    print(f"--- N = {n:,} ---")
    res = benchmark(n)

    print(f"  {'Operation':<22} {'Skip List':>12} {'bisect':>12} {'Winner':>10}")
    print(f"  {'-'*58}")

    pairs = [
        ('insert', f'SkipList insert', f'bisect insert'),
        ('search (1000)', f'SkipList search', f'bisect search'),
        ('range query', f'SkipList range', f'bisect range'),
        ('delete (500)', f'SkipList delete', f'bisect delete'),
    ]

    for name, sk, bi in pairs:
        st = res[sk]
        bt = res[bi]
        winner = "SkipList" if st < bt else "bisect"
        print(f"  {name:<22} {st*1000:>9.2f} ms {bt*1000:>9.2f} ms {winner:>10}")

    print(f"  Range results: SkipList={res['SkipList range_count']}, bisect={res['bisect range_count']}")
    print()

print("=== Why Redis Uses Skip Lists ===")
print()
print("Redis chose skip lists for sorted sets (ZADD, ZRANGE, etc.) because:")
print()
print("1. SIMPLICITY: Skip lists are much simpler to implement and debug")
print("   than balanced BSTs (AVL, Red-Black). Fewer edge cases.")
print()
print("2. RANGE QUERIES: Once you find the start position, you just follow")
print("   level-0 pointers. O(k) for k results. Same as BST in-order,")
print("   but with better cache locality (sequential pointer chasing).")
print()
print("3. CONCURRENT ACCESS: Easier to make lock-free. Insertions only")
print("   need local pointer updates, no global rebalancing.")
print()
print("4. CACHE FRIENDLY: Nodes are allocated independently, but the")
print("   level-0 traversal is sequential (good for prefetching).")
print()
print("5. SPACE: O(n) expected space with ~2n total pointers (same as BST).")
print()
print(f"Expected comparisons for search in N=10000: {math.log2(10000):.1f}")
print(f"Expected height: {math.log2(10000):.1f} levels")
print(f"Expected total pointers: ~{10000 * 2} (2 per node on average)")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function SkipList() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
      {/* ---- Header ---- */}
      <header>
        <h1 className="text-4xl font-bold text-white mb-4">
          Skip Lists: Probabilistic Sorted Structure
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          Need a sorted data structure with O(log n) insert, search, and delete? Balanced binary
          search trees (AVL, Red-Black) work, but they are complex — rotations, color tracking,
          subtle edge cases. Skip lists achieve the same performance with a beautifully simple
          idea: a linked list with express lanes.
        </p>
      </header>

      {/* ---- Section: The Problem ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Sorted Data with Fast Operations</h2>
        <p className="text-gray-300 leading-relaxed">
          You need a data structure that supports these operations efficiently:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1">
          <li><strong className="text-white">Insert</strong> a new element while maintaining sorted order</li>
          <li><strong className="text-white">Search</strong> for an element</li>
          <li><strong className="text-white">Delete</strong> an element</li>
          <li><strong className="text-white">Range query</strong> — find all elements between A and B</li>
        </ul>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Why not just use...</h3>
          <div className="text-gray-300 text-sm space-y-1">
            <p><strong className="text-yellow-400">Sorted array + binary search?</strong> O(log n) search, but O(n) insert/delete (shifting elements).</p>
            <p><strong className="text-yellow-400">Linked list?</strong> O(1) insert (if you have the position), but O(n) search.</p>
            <p><strong className="text-yellow-400">Balanced BST?</strong> O(log n) everything, but complex to implement (AVL rotations, Red-Black recoloring).</p>
            <p><strong className="text-emerald-400">Skip list?</strong> O(log n) everything expected, and dead simple to implement. Just flip coins!</p>
          </div>
        </div>
      </section>

      {/* ---- Section: The Idea ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Idea: Linked List with Express Lanes</h2>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-lg font-medium">
            A skip list is a multi-level linked list. Level 0 contains all elements in sorted order.
            Each higher level is a "fast lane" containing roughly half the elements of the level
            below. Search starts at the top and skips ahead, dropping down to finer-grained levels
            as needed — like switching from a bullet train to a local train.
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          The key insight: instead of carefully balancing the structure (like AVL or Red-Black
          trees), just flip a coin for each new element. Heads? Promote it to the next level.
          Keep flipping. The result is a structure that is balanced{' '}
          <strong className="text-white">in expectation</strong>, without any rotations or rebalancing.
        </p>
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 font-mono text-sm space-y-1">
          <p className="text-gray-400"># Probabilistic level assignment</p>
          <p className="text-emerald-400">INSERT(value):</p>
          <p className="text-gray-300">&nbsp;&nbsp;level = 0</p>
          <p className="text-gray-300">&nbsp;&nbsp;while coin_flip() == HEADS and level &lt; MAX_LEVEL:</p>
          <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;level += 1</p>
          <p className="text-gray-300">&nbsp;&nbsp;# Insert at levels 0 through 'level'</p>
          <p className="text-gray-300">&nbsp;&nbsp;# Update forward pointers at each level</p>
          <p className="text-gray-300">&nbsp;</p>
          <p className="text-cyan-400">SEARCH(target):</p>
          <p className="text-gray-300">&nbsp;&nbsp;start at HEAD, top level</p>
          <p className="text-gray-300">&nbsp;&nbsp;while not found:</p>
          <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;skip right while next &lt; target</p>
          <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;drop down one level</p>
        </div>
      </section>

      {/* ---- Section: Interactive Skip List ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Skip List</h2>
        <p className="text-gray-300 leading-relaxed">
          Insert values and watch the skip list grow. Each node's level is determined by coin
          flips (shown during insertion). Search to see the path from the top level down to the
          target. Delete to see pointers being rewired.
        </p>
        <SkipListSketch />
        <p className="text-gray-400 text-sm">
          Try: insert 10, 20, 30, 40, 50, 60 one by one. Watch the levels build up. Then search
          for 50 to see the express-lane path. Try inserting many values with +Random to see the
          probabilistic balance emerge.
        </p>
      </section>

      {/* ---- Section: Search Animation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Search Path: Express Lanes in Action</h2>
        <p className="text-gray-300 leading-relaxed">
          Watch the search algorithm step by step. It starts at the top-left corner (HEAD, highest
          level) and skips right along express lanes, dropping down to lower levels when the next
          node overshoots the target. The yellow-highlighted path shows every comparison made.
        </p>
        <SearchAnimationSketch />
        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="text-lg font-medium text-white">Expected performance</h3>
          <p className="text-gray-300 text-sm">
            With n elements and promotion probability p = 0.5:
          </p>
          <div className="font-mono text-sm text-emerald-400 space-y-1">
            <p>Expected levels: O(log n)</p>
            <p>Expected search time: O(log n) comparisons</p>
            <p>Expected space: O(n) total pointers (~2n with p=0.5)</p>
          </div>
          <p className="text-gray-400 text-sm">
            Each level has ~half the elements of the level below, so the search skips
            about half the remaining elements at each level — just like binary search.
          </p>
        </div>
      </section>

      {/* ---- Section: Redis ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Redis Sorted Sets: Skip Lists in Production</h2>
        <p className="text-gray-300 leading-relaxed">
          Redis, one of the most widely-used in-memory databases, uses skip lists as the core
          data structure for its sorted sets (the <code className="text-cyan-400">ZADD</code>,{' '}
          <code className="text-cyan-400">ZRANGE</code>,{' '}
          <code className="text-cyan-400">ZRANGEBYSCORE</code> family of commands). Why did Redis
          choose skip lists over balanced BSTs?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Simplicity</h3>
            <p className="text-gray-300 text-sm">
              Skip list implementation is significantly simpler than balanced BSTs. The insert
              code is about 50 lines of C. AVL or Red-Black tree insertion with all rotation
              cases is 2-3x longer and much harder to get right.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Range Queries</h3>
            <p className="text-gray-300 text-sm">
              <code>ZRANGEBYSCORE key 10 50</code> finds the start position in O(log n), then
              follows level-0 pointers sequentially. This is cache-friendly and efficient,
              matching BST in-order traversal performance.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Concurrency</h3>
            <p className="text-gray-300 text-sm">
              Skip lists are easier to make lock-free. Insertions only update local pointers
              at each level, without global rebalancing. This is important for Redis's
              single-threaded event loop and concurrent variants.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Space Efficiency</h3>
            <p className="text-gray-300 text-sm">
              Expected ~2 pointers per node (with p=0.5), same as a BST (left + right pointers).
              Redis also stores a backward pointer for reverse traversal, using 3 pointers
              per node total.
            </p>
          </div>
        </div>
        <div className="bg-cyan-900/20 border border-cyan-700 rounded-lg p-4">
          <p className="text-cyan-300 text-sm font-medium">
            Antirez (Redis creator): "Skip lists are simpler to implement, debug, and understand.
            They also allow for O(log N) ZRANGEBYSCORE operations and a simpler implementation
            of ZREVRANGE." Skip lists are one of those cases where the "theoretically equivalent"
            choice wins in practice due to implementation simplicity.
          </p>
        </div>
      </section>

      {/* ---- Python: Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete skip list with insert, search, delete, and range query operations. The demo
          builds a skip list, displays its level structure, performs searches with comparison
          counts, and demonstrates range queries and deletion.
        </p>
        <PythonCell defaultCode={skipListImplementation} />
      </section>

      {/* ---- Python: Benchmark ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Benchmark: Skip List vs Sorted List</h2>
        <p className="text-gray-300 leading-relaxed">
          How does a pure-Python skip list compare to Python's built-in <code className="text-cyan-400">bisect</code> module
          (which maintains a sorted list with binary search)? The results also explain why Redis
          chose skip lists for its sorted set implementation.
        </p>
        <PythonCell defaultCode={skipListBenchmark} />
      </section>

      {/* ---- Section: Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">Skip List</th>
                <th className="text-left py-2 pr-4 text-white">Balanced BST</th>
                <th className="text-left py-2 text-white">Sorted Array</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Search</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) expected</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) worst</td>
                <td className="py-2 text-emerald-400">O(log n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) expected</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) worst</td>
                <td className="py-2 text-red-400">O(n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Delete</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) expected</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n) worst</td>
                <td className="py-2 text-red-400">O(n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Range query</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n + k)</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n + k)</td>
                <td className="py-2 text-emerald-400">O(log n + k)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space</td>
                <td className="py-2 pr-4">O(n) expected</td>
                <td className="py-2 pr-4">O(n)</td>
                <td className="py-2">O(n)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Implementation</td>
                <td className="py-2 pr-4 text-emerald-400">Simple</td>
                <td className="py-2 pr-4 text-yellow-400">Complex</td>
                <td className="py-2 text-emerald-400">Trivial</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Skip lists are multi-level sorted linked lists with probabilistic balancing via coin flips</li>
          <li>Level 0 has all elements; each higher level has roughly half the elements below it</li>
          <li>Search starts at the top-left and skips right, dropping down — like express-to-local trains</li>
          <li>No rotations or rebalancing needed. Insert is just: flip coins for level, update local pointers</li>
          <li>Expected O(log n) for insert, search, delete, and O(log n + k) for range queries</li>
          <li>Redis uses skip lists for sorted sets because of their simplicity, range query efficiency, and concurrency-friendliness</li>
          <li>Trade-off: O(log n) is expected, not guaranteed. Worst case is O(n), but exponentially unlikely</li>
        </ul>
      </section>
    </div>
  )
}
