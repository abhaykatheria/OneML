import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/storage-engines',
  title: 'Storage Engines',
  description: 'How databases store and retrieve data: log-structured (LSM-trees) vs page-oriented (B-trees) storage engines',
  track: 'systems',
  order: 3,
  tags: ['lsm-tree', 'b-tree', 'sstable', 'storage', 'compaction', 'write-amplification'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/* ------------------------------------------------------------------ */
/* Section 1 — Log-Structured Storage with Compaction                  */
/* ------------------------------------------------------------------ */

interface LogEntry {
  key: string
  value: string
  segment: number
  tombstone?: boolean
}

function LogStorageSketch() {
  const [autoWrite, setAutoWrite] = useState(true)
  const autoWriteRef = useRef(autoWrite)
  autoWriteRef.current = autoWrite

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    let animT = 0
    const rng = makeRng(99)

    const log: LogEntry[] = []
    const keys = ['user:1', 'user:2', 'user:3', 'order:1', 'order:2', 'prod:1']
    const vals = ['Alice', 'Bob', 'Carol', '{qty:2}', '{qty:5}', 'Widget']
    let segment = 0
    let compacting = false
    let compactProgress = 0

    // Pre-populate
    for (let i = 0; i < 8; i++) {
      const ki = Math.floor(rng() * keys.length)
      log.push({ key: keys[ki], value: vals[ki] + '_v' + i, segment })
      if (log.length % 6 === 0) segment++
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.02
      p.background(15, 23, 42)

      // Auto-write new entries
      if (autoWriteRef.current && p.frameCount % 40 === 0 && log.length < 30) {
        const ki = Math.floor(rng() * keys.length)
        log.push({ key: keys[ki], value: vals[ki] + '_v' + log.length, segment })
        if (log.length % 6 === 0) segment++
      }

      // Compaction animation
      if (compacting) {
        compactProgress += 0.01
        if (compactProgress >= 1) {
          // Actually compact: keep only latest value per key
          const latest = new Map<string, LogEntry>()
          for (const entry of log) {
            latest.set(entry.key, entry)
          }
          log.length = 0
          let newSeg = 0
          let count = 0
          for (const entry of latest.values()) {
            log.push({ ...entry, segment: newSeg })
            count++
            if (count % 4 === 0) newSeg++
          }
          segment = newSeg + 1
          compacting = false
          compactProgress = 0
        }
      }

      const margin = { left: 20, right: 20, top: 50, bottom: 40 }
      const entryH = 24
      const entryW = 140

      // Title
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Append-Only Log with Segments', p.width / 2, 10)

      // Draw log entries
      const cols = Math.floor((p.width - margin.left - margin.right) / (entryW + 8))
      const maxVisible = Math.min(log.length, cols * 12)
      const startIdx = Math.max(0, log.length - maxVisible)

      let currentSeg = -1
      for (let i = startIdx; i < log.length; i++) {
        const entry = log[i]
        const localIdx = i - startIdx
        const col = localIdx % cols
        const row = Math.floor(localIdx / cols)

        const x = margin.left + col * (entryW + 8)
        const y = margin.top + row * (entryH + 4)

        // Segment separator
        if (entry.segment !== currentSeg) {
          currentSeg = entry.segment
        }

        // Compaction fade effect
        let alpha = 255
        if (compacting) {
          // Check if this is a stale entry (not the latest for its key)
          const isLatest = log.findLastIndex(e => e.key === entry.key) === i
          if (!isLatest) {
            alpha = 255 * (1 - compactProgress)
          }
        }

        // Background
        const segColors = [
          [45, 55, 72], [38, 50, 70], [50, 45, 65], [40, 55, 60],
        ]
        const sc = segColors[entry.segment % segColors.length]
        p.fill(sc[0], sc[1], sc[2], alpha)
        p.noStroke()
        p.rect(x, y, entryW, entryH, 4)

        // Key
        p.fill(99, 102, 241, alpha)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(entry.key, x + 4, y + entryH / 2)

        // Value
        p.fill(52, 211, 153, alpha)
        p.textAlign(p.RIGHT, p.CENTER)
        const valDisplay = entry.value.length > 10 ? entry.value.slice(0, 10) + '..' : entry.value
        p.text(valDisplay, x + entryW - 4, y + entryH / 2)

        // Append arrow for latest entry
        if (i === log.length - 1) {
          const pulse = Math.sin(animT * 3) * 0.3 + 0.7
          p.fill(250, 204, 21, 200 * pulse)
          p.noStroke()
          p.triangle(x + entryW + 4, y + 4, x + entryW + 4, y + entryH - 4, x + entryW + 14, y + entryH / 2)
        }
      }

      // Read path annotation
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Read: scan backward from end to find latest value for key', margin.left, canvasH - 12)

      p.fill(250, 204, 21)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text(`Entries: ${log.length} | Segments: ${segment + 1}`, p.width - margin.right, canvasH - 12)

      if (compacting) {
        p.fill(244, 63, 94)
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Compacting... ${(compactProgress * 100).toFixed(0)}%`, p.width / 2, canvasH - 30)
      }
    }

    p.mousePressed = () => {
      // Trigger compaction on click in canvas
      if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < canvasH) {
        if (!compacting && log.length > 6) {
          compacting = true
          compactProgress = 0
        }
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setAutoWrite(!autoWrite)}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            {autoWrite ? 'Pause Writes' : 'Resume Writes'}
          </button>
          <span className="text-gray-500 text-xs">Click the canvas to trigger compaction (merges duplicate keys)</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — LSM-Tree Visualization                                  */
/* ------------------------------------------------------------------ */

function LSMTreeSketch() {
  const [writeKey] = useState('')
  const writeKeyRef = useRef(writeKey)
  writeKeyRef.current = writeKey

  const sketch = useCallback((p: p5) => {
    const canvasH = 440
    let animT = 0
    const rng = makeRng(42)

    // Memtable: sorted in-memory buffer
    let memtable: { key: number; val: string }[] = []
    const memtableMax = 5

    // SSTable levels
    const levels: { key: number; val: string }[][] = [
      [], // L0
      [], // L1
      [], // L2
    ]

    // Animation states
    let flushAnim = 0
    let flushing = false
    let compactAnim = 0
    let compactingLevel = -1
    let readKey = -1
    let readLevel = -1

    const addToMemtable = (key: number) => {
      memtable.push({ key, val: `v${Math.floor(rng() * 100)}` })
      memtable.sort((a, b) => a.key - b.key)

      if (memtable.length >= memtableMax) {
        flushing = true
        flushAnim = 0
      }
    }

    // Pre-populate some data
    levels[1] = [
      { key: 5, val: 'v12' }, { key: 12, val: 'v44' }, { key: 20, val: 'v67' },
      { key: 28, val: 'v31' }, { key: 35, val: 'v89' },
    ]
    levels[2] = [
      { key: 3, val: 'v5' }, { key: 8, val: 'v22' }, { key: 15, val: 'v38' },
      { key: 22, val: 'v55' }, { key: 30, val: 'v71' }, { key: 40, val: 'v90' },
      { key: 45, val: 'v99' }, { key: 50, val: 'v15' },
    ]
    memtable = [{ key: 10, val: 'v77' }, { key: 25, val: 'v33' }]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.02
      p.background(15, 23, 42)

      // Auto-write
      if (p.frameCount % 60 === 0 && !flushing && memtable.length < memtableMax) {
        addToMemtable(Math.floor(rng() * 50) + 1)
      }

      // Flush animation
      if (flushing) {
        flushAnim += 0.015
        if (flushAnim >= 1) {
          // Move memtable to L0
          levels[0] = [...levels[0], ...memtable].sort((a, b) => a.key - b.key)
          memtable = []
          flushing = false
          flushAnim = 0

          // Trigger compaction if L0 is too big
          if (levels[0].length > 6) {
            compactingLevel = 0
            compactAnim = 0
          }
        }
      }

      // Compaction animation
      if (compactingLevel >= 0) {
        compactAnim += 0.01
        if (compactAnim >= 1) {
          const src = compactingLevel
          const dst = src + 1
          if (dst < levels.length) {
            // Merge src into dst, keeping latest values
            const merged = new Map<number, string>()
            for (const entry of levels[dst]) merged.set(entry.key, entry.val)
            for (const entry of levels[src]) merged.set(entry.key, entry.val) // src overwrites
            levels[dst] = Array.from(merged.entries())
              .map(([key, val]) => ({ key, val }))
              .sort((a, b) => a.key - b.key)
            levels[src] = []
          }
          compactingLevel = -1
          compactAnim = 0
        }
      }

      const margin = { left: 30, right: 30, top: 15, bottom: 30 }
      const rowH = 80
      const cellW = 50
      const cellH = 36

      // Draw memtable (red-black tree representation)
      const memY = margin.top + 10
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Memtable (in-memory, sorted)', margin.left, memY)

      p.fill(244, 63, 94, 30)
      p.rect(margin.left, memY + 18, p.width - margin.left - margin.right, cellH + 10, 6)

      for (let i = 0; i < memtable.length; i++) {
        const x = margin.left + 10 + i * (cellW + 4)
        const y = memY + 23
        const pulse = flushing ? (1 - flushAnim) : 1

        p.fill(244, 63, 94, 180 * pulse)
        p.noStroke()
        p.rect(x, y, cellW, cellH, 4)

        p.fill(255, 255, 255, 230 * pulse)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${memtable[i].key}`, x + cellW / 2, y + cellH / 2 - 6)
        p.fill(200, 200, 200, 180 * pulse)
        p.textSize(8)
        p.text(memtable[i].val, x + cellW / 2, y + cellH / 2 + 8)
      }

      if (memtable.length === 0 && !flushing) {
        p.fill(100, 116, 139)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('(empty — flushed to L0)', p.width / 2, memY + 23 + cellH / 2)
      }

      // Flush arrow
      if (flushing) {
        const arrowY = memY + 23 + cellH + 5
        const arrowLen = 20 * flushAnim
        p.stroke(244, 63, 94, 200)
        p.strokeWeight(2)
        p.line(p.width / 2, arrowY, p.width / 2, arrowY + arrowLen + 15)
        p.noStroke()
        p.fill(244, 63, 94, 200)
        p.triangle(p.width / 2 - 5, arrowY + arrowLen + 15, p.width / 2 + 5, arrowY + arrowLen + 15, p.width / 2, arrowY + arrowLen + 22)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('FLUSH', p.width / 2 + 10, arrowY + arrowLen / 2 + 8)
      }

      // Draw SSTable levels
      const levelNames = ['L0 (recent)', 'L1', 'L2 (oldest)']
      const levelColors: [number, number, number][] = [
        [250, 204, 21],
        [99, 102, 241],
        [52, 211, 153],
      ]

      for (let lvl = 0; lvl < levels.length; lvl++) {
        const ly = margin.top + 90 + lvl * (rowH + 20)
        const c = levelColors[lvl]
        const isCompacting = compactingLevel === lvl

        p.noStroke()
        p.fill(c[0], c[1], c[2])
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`SSTable ${levelNames[lvl]}`, margin.left, ly)

        // Level background
        const bgAlpha = isCompacting ? 20 * (1 - compactAnim) : 20
        p.fill(c[0], c[1], c[2], bgAlpha)
        p.rect(margin.left, ly + 16, p.width - margin.left - margin.right, cellH + 10, 6)

        const entries = levels[lvl]
        for (let i = 0; i < entries.length; i++) {
          const x = margin.left + 10 + i * (cellW + 4)
          const y = ly + 21

          let alpha = 180
          if (isCompacting) alpha = 180 * (1 - compactAnim)
          if (readLevel === lvl && entries[i].key === readKey) {
            alpha = 255
            // Highlight found key
            p.fill(255, 255, 255, 40)
            p.rect(x - 2, y - 2, cellW + 4, cellH + 4, 6)
          }

          p.fill(c[0], c[1], c[2], alpha)
          p.noStroke()
          p.rect(x, y, cellW, cellH, 4)

          p.fill(255, 255, 255, 220 * (alpha / 180))
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`${entries[i].key}`, x + cellW / 2, y + cellH / 2 - 6)
          p.fill(200, 200, 200, 160 * (alpha / 180))
          p.textSize(8)
          p.text(entries[i].val, x + cellW / 2, y + cellH / 2 + 8)
        }

        if (entries.length === 0) {
          p.fill(100, 116, 139, 100)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('(empty)', p.width / 2, ly + 21 + cellH / 2)
        }

        // Compaction arrow between levels
        if (isCompacting && lvl < levels.length - 1) {
          const arrowX = p.width / 2
          const arrowStartY = ly + 21 + cellH + 8
          const arrowEndY = arrowStartY + 15
          p.stroke(c[0], c[1], c[2], 200)
          p.strokeWeight(2)
          p.line(arrowX, arrowStartY, arrowX, arrowEndY)
          p.noStroke()
          p.fill(c[0], c[1], c[2])
          p.textSize(9)
          p.text('COMPACT', arrowX + 10, arrowStartY + 5)
        }
      }

      // Read path description
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Read path: Memtable -> L0 -> L1 -> L2 (stop at first match)', margin.left, canvasH - 8)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <span className="text-gray-500 text-xs">
            Writes go to memtable; when full it flushes to L0. Compaction merges L0 into L1, etc.
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — B-Tree Insertion Visualization                          */
/* ------------------------------------------------------------------ */

interface BTreeNode {
  keys: number[]
  children: BTreeNode[]
  isLeaf: boolean
  x: number
  y: number
  targetX: number
  targetY: number
}

function BTreeSketch() {
  const [insertValue, setInsertValue] = useState(0)
  const insertRef = useRef(insertValue)
  insertRef.current = insertValue

  const treeRef = useRef<BTreeNode | null>(null)
  const highlightRef = useRef<number[]>([])

  // B-tree operations (order 3 = max 2 keys per node)
  const ORDER = 3

  function createNode(isLeaf: boolean): BTreeNode {
    return { keys: [], children: [], isLeaf, x: 0, y: 0, targetX: 0, targetY: 0 }
  }

  function insertKey(root: BTreeNode | null, key: number): BTreeNode {
    if (!root) {
      const node = createNode(true)
      node.keys = [key]
      return node
    }

    if (root.keys.length === ORDER - 1) {
      const newRoot = createNode(false)
      newRoot.children = [root]
      splitChild(newRoot, 0)
      insertNonFull(newRoot, key)
      return newRoot
    }

    insertNonFull(root, key)
    return root
  }

  function insertNonFull(node: BTreeNode, key: number) {
    if (node.isLeaf) {
      // Insert key in sorted order
      let i = node.keys.length - 1
      while (i >= 0 && key < node.keys[i]) i--
      node.keys.splice(i + 1, 0, key)
    } else {
      let i = node.keys.length - 1
      while (i >= 0 && key < node.keys[i]) i--
      i++
      if (node.children[i].keys.length === ORDER - 1) {
        splitChild(node, i)
        if (key > node.keys[i]) i++
      }
      insertNonFull(node.children[i], key)
    }
  }

  function splitChild(parent: BTreeNode, index: number) {
    const child = parent.children[index]
    const mid = Math.floor((ORDER - 1) / 2)
    const newChild = createNode(child.isLeaf)

    newChild.keys = child.keys.splice(mid + 1)
    const midKey = child.keys.pop()!

    if (!child.isLeaf) {
      newChild.children = child.children.splice(mid + 1)
    }

    parent.keys.splice(index, 0, midKey)
    parent.children.splice(index + 1, 0, newChild)
  }

  function layoutTree(node: BTreeNode | null, x: number, y: number, width: number) {
    if (!node) return
    node.targetX = x
    node.targetY = y
    if (!node.isLeaf) {
      const childWidth = width / node.children.length
      for (let i = 0; i < node.children.length; i++) {
        const cx = x - width / 2 + childWidth * i + childWidth / 2
        layoutTree(node.children[i], cx, y + 80, childWidth)
      }
    }
  }

  function animatePositions(node: BTreeNode | null) {
    if (!node) return
    node.x += (node.targetX - node.x) * 0.1
    node.y += (node.targetY - node.y) * 0.1
    for (const child of node.children) animatePositions(child)
  }

  // Initialize tree with some values
  if (!treeRef.current) {
    let root: BTreeNode | null = null
    for (const v of [10, 20, 5, 15, 25, 8, 12]) {
      root = insertKey(root, v)
    }
    treeRef.current = root
  }

  const doInsert = useCallback(() => {
    const val = insertRef.current
    if (val > 0 && val < 100) {
      treeRef.current = insertKey(treeRef.current, val)
      highlightRef.current = [val]
    }
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 400

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      p.background(15, 23, 42)

      const root = treeRef.current
      if (!root) return

      // Layout and animate
      layoutTree(root, p.width / 2, 60, p.width * 0.8)
      animatePositions(root)

      const highlighted = highlightRef.current

      // Draw the tree
      function drawNode(node: BTreeNode) {
        const keyW = 36
        const nodeW = node.keys.length * keyW + 8
        const nodeH = 36

        // Draw edges to children first
        if (!node.isLeaf) {
          for (const child of node.children) {
            p.stroke(71, 85, 105, 120)
            p.strokeWeight(1.5)
            p.line(node.x, node.y + nodeH / 2, child.x, child.y - nodeH / 2)
          }
        }

        // Node background
        p.fill(30, 41, 59)
        p.stroke(99, 102, 241)
        p.strokeWeight(2)
        p.rect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, 6)

        // Keys
        for (let i = 0; i < node.keys.length; i++) {
          const kx = node.x - nodeW / 2 + 4 + i * keyW
          const ky = node.y - nodeH / 2 + 4
          const isHighlight = highlighted.includes(node.keys[i])

          if (isHighlight) {
            p.fill(250, 204, 21, 60)
            p.noStroke()
            p.rect(kx, ky, keyW - 2, nodeH - 8, 3)
          }

          p.fill(isHighlight ? 250 : 226, isHighlight ? 204 : 232, isHighlight ? 21 : 240)
          p.noStroke()
          p.textSize(13)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(node.keys[i].toString(), kx + keyW / 2 - 1, node.y)

          // Separator line between keys
          if (i < node.keys.length - 1) {
            p.stroke(71, 85, 105)
            p.strokeWeight(1)
            p.line(kx + keyW - 1, node.y - nodeH / 2 + 6, kx + keyW - 1, node.y + nodeH / 2 - 6)
          }
        }

        // Draw children recursively
        if (!node.isLeaf) {
          for (const child of node.children) {
            drawNode(child)
          }
        }
      }

      drawNode(root)

      // Title and info
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('B-Tree (Order 3: max 2 keys per node)', p.width / 2, 10)

      // Depth info
      function getDepth(node: BTreeNode): number {
        if (node.isLeaf) return 1
        return 1 + Math.max(...node.children.map(getDepth))
      }
      function countKeys(node: BTreeNode): number {
        let n = node.keys.length
        for (const child of node.children) n += countKeys(child)
        return n
      }

      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Depth: ${getDepth(root)} | Keys: ${countKeys(root)}`, 20, canvasH - 8)

      p.fill(250, 204, 21, 180)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text('Nodes split when full (>2 keys)', p.width - 20, canvasH - 8)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <label className="flex items-center gap-2">
            Insert key:
            <input
              type="range" min={1} max={99} step={1} value={insertValue}
              onChange={(e) => setInsertValue(parseInt(e.target.value))}
              className="w-32 accent-yellow-500"
            />
            <span className="w-8 font-mono">{insertValue}</span>
          </label>
          <button
            onClick={doInsert}
            className="px-4 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-sm font-medium text-white"
          >
            Insert
          </button>
          <span className="text-gray-500 text-xs">Watch nodes split when they overflow</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function StorageEngines() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: Two Families ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Two Families of Storage Engines</h2>

        <p className="mb-4">
          At the heart of every database is a <strong className="text-white">storage engine</strong> —
          the component that manages how data is stored on disk and retrieved. There are two dominant
          families, and understanding their tradeoffs is fundamental to choosing the right database
          for your workload.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-lg bg-gray-800/60 border border-yellow-800/40 p-5">
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Log-Structured (LSM-Trees)</h3>
            <p className="text-sm mb-2">
              Writes are always appended sequentially. Data is organized into sorted, immutable files
              (SSTables) at multiple levels. Background compaction merges and garbage-collects.
            </p>
            <p className="text-xs text-gray-400">
              Used by: LevelDB, RocksDB, Cassandra, HBase, ScyllaDB
            </p>
          </div>
          <div className="rounded-lg bg-gray-800/60 border border-indigo-800/40 p-5">
            <h3 className="text-lg font-semibold text-indigo-400 mb-2">Page-Oriented (B-Trees)</h3>
            <p className="text-sm mb-2">
              Data is organized into fixed-size pages (typically 4KB). Reads and writes go to specific
              pages. Updates modify pages in-place. A balanced tree structure keeps lookups logarithmic.
            </p>
            <p className="text-xs text-gray-400">
              Used by: PostgreSQL, MySQL/InnoDB, SQL Server, Oracle, SQLite
            </p>
          </div>
        </div>

        <p className="mb-4">
          The key insight: <strong className="text-white">LSM-trees optimize for writes</strong> (sequential
          I/O, no in-place updates) while <strong className="text-white">B-trees optimize for reads</strong>
          (one tree traversal to find any key). This fundamental tradeoff shapes the entire landscape of
          modern databases.
        </p>
      </section>

      {/* ========== Section 2: Log-Structured Storage ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Log-Structured Storage</h2>

        <p className="mb-4">
          The simplest possible storage engine is an append-only log: every write appends a record to
          the end of a file. This is incredibly fast for writes — sequential disk I/O can be 100x
          faster than random I/O on spinning disks, and still significantly faster on SSDs.
        </p>

        <p className="mb-4">
          The problem is reads: to find a value, you must scan the entire log from the end. To solve
          this, we use <strong className="text-white">hash indexes</strong> — an in-memory hash map
          that maps each key to the byte offset of its most recent value in the log.
        </p>

        <p className="mb-4">
          Over time, the log accumulates many old values for the same key. <strong className="text-white">
          Compaction</strong> is the process of merging log segments, keeping only the latest value for
          each key, and discarding stale entries. The visualization below shows this process — watch
          writes being appended, then click to trigger compaction.
        </p>

        <LogStorageSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Limitations of Hash Indexes</h3>

        <p className="mb-4">
          Hash indexes work well when the number of distinct keys fits in memory. But they have limitations:
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>The hash table must fit in memory — if you have billions of keys, this becomes impractical.</li>
          <li>Range queries are not efficient — to find all keys between <code className="text-pink-400">user:100</code> and <code className="text-pink-400">user:200</code>, you would need to look up each key individually.</li>
        </ul>

        <p className="mb-4">
          This is where SSTables and LSM-trees come in, solving both problems elegantly.
        </p>
      </section>

      {/* ========== Section 3: SSTables and LSM-Trees ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">SSTables and LSM-Trees</h2>

        <p className="mb-4">
          A <strong className="text-white">Sorted String Table (SSTable)</strong> is a log segment where
          the key-value pairs are sorted by key. This simple change has profound consequences:
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong className="text-white">Efficient merging:</strong> merging multiple SSTables is like
            merge sort — you read each file sequentially and produce a sorted output. This is fast and
            uses minimal memory.
          </li>
          <li>
            <strong className="text-white">Sparse index:</strong> you do not need an index entry for every
            key. If you know that <code className="text-pink-400">key:100</code> is at offset X and <code className="text-pink-400">key:200</code> is at offset Y, you know <code className="text-pink-400">key:150</code> must
            be somewhere between X and Y.
          </li>
          <li>
            <strong className="text-white">Range queries:</strong> since keys are sorted, scanning a range
            is a sequential read — very fast.
          </li>
        </ul>

        <p className="mb-4">
          The <strong className="text-white">LSM-tree</strong> (Log-Structured Merge-Tree) is the data
          structure that ties everything together. The write path:
        </p>

        <div className="my-4 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 font-mono text-sm space-y-2">
          <p className="text-yellow-400">1. Write goes to the memtable (in-memory sorted tree, e.g., red-black tree)</p>
          <p className="text-yellow-400">2. When memtable exceeds threshold, flush to disk as a new SSTable at Level 0</p>
          <p className="text-indigo-400">3. Background compaction merges L0 SSTables into L1</p>
          <p className="text-indigo-400">4. When L1 gets too large, merge into L2, and so on</p>
          <p className="text-emerald-400">5. Each level is ~10x larger than the previous</p>
        </div>

        <p className="mb-4">
          The read path checks each level in order: memtable first (most recent writes), then L0, L1,
          L2, etc. A <strong className="text-white">Bloom filter</strong> — a memory-efficient probabilistic
          data structure — can quickly tell you that a key definitely does not exist at a given level,
          avoiding unnecessary disk reads.
        </p>

        <LSMTreeSketch />
      </section>

      {/* ========== Section 4: B-Trees ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">B-Trees</h2>

        <p className="mb-4">
          The <strong className="text-white">B-tree</strong> is the most widely used indexing structure,
          standard in almost all relational databases. Like SSTables, B-trees keep key-value pairs
          sorted by key, enabling efficient lookups and range queries. But the implementation is
          fundamentally different.
        </p>

        <p className="mb-4">
          B-trees break the database into fixed-size <strong className="text-white">pages</strong>
          (traditionally 4KB), organized as a tree. Each page can be individually read or written.
          The tree has a branching factor — typically several hundred — meaning each internal node
          points to many children. A B-tree with a branching factor of 500 and 4 levels can store
          up to 256 TB of data!
        </p>

        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">How B-Tree Insertion Works</h3>

        <p className="mb-4">
          To insert a key: traverse from the root to the appropriate leaf page. If the leaf has room,
          insert the key. If the leaf is full, <strong className="text-white">split</strong> it into two
          halves and promote the middle key to the parent. If the parent overflows, it splits too — this
          can cascade up to the root, increasing the tree&rsquo;s depth by one.
        </p>

        <p className="mb-4">
          Use the slider to pick a value, then click Insert to add it to the B-tree. Watch how nodes
          split when they exceed their capacity (2 keys per node in this simplified visualization).
        </p>

        <BTreeSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Write-Ahead Log (WAL)</h3>

        <p className="mb-4">
          Since B-trees modify pages in-place, a crash during a write could leave the tree in a
          corrupted state (e.g., a page is half-written). To prevent this, B-tree databases maintain a
          <strong className="text-white">write-ahead log</strong> (WAL, also called redo log): before
          modifying any page, the intended change is appended to an append-only log file. After a crash,
          the WAL is replayed to restore the tree to a consistent state.
        </p>
      </section>

      {/* ========== Section 5: LSM-Tree vs B-Tree ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">LSM-Tree vs B-Tree</h2>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-white">Aspect</th>
                <th className="text-left py-3 px-4 text-yellow-400">LSM-Tree</th>
                <th className="text-left py-3 px-4 text-indigo-400">B-Tree</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Write throughput', 'Higher (sequential I/O)', 'Lower (random I/O, in-place updates)'],
                ['Read latency', 'Can be slower (check multiple levels)', 'Faster (one tree traversal)'],
                ['Write amplification', 'Due to compaction (write data multiple times)', 'Due to WAL + page writes'],
                ['Space amplification', 'Lower (compaction reclaims space)', 'Higher (pages can be partially empty)'],
                ['Predictability', 'Compaction can cause latency spikes', 'More predictable latencies'],
                ['Range queries', 'Efficient (sorted SSTables)', 'Efficient (sorted pages)'],
                ['Concurrency', 'Simpler (immutable files)', 'Needs latches/locks on pages'],
                ['Compression', 'Better (compact files, no fragmentation)', 'Worse (page-level, internal fragmentation)'],
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-2.5 px-4 text-white font-medium">{row[0]}</td>
                  <td className="py-2.5 px-4">{row[1]}</td>
                  <td className="py-2.5 px-4">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4">
          As a rule of thumb: <strong className="text-white">LSM-trees are better for write-heavy
          workloads</strong> (logs, time-series, messaging), while <strong className="text-white">B-trees
          are better for read-heavy workloads</strong> with many point lookups (OLTP, relational queries).
          But benchmarks on your specific workload are the only way to know for sure.
        </p>
      </section>

      {/* ========== Section 6: Other Indexing Structures ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Other Indexing Structures</h2>

        <p className="mb-4">
          Beyond the primary key index, databases support several other indexing strategies:
        </p>

        <div className="space-y-4 my-6">
          <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-5 py-4">
            <h4 className="text-white font-semibold mb-1">Secondary Indexes</h4>
            <p className="text-sm">
              An index on a non-primary column. Crucial for query performance. The index maps column
              values to row locations (either direct or via primary key). A table can have multiple
              secondary indexes.
            </p>
          </div>

          <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-5 py-4">
            <h4 className="text-white font-semibold mb-1">Covering Indexes (Index-Only Scans)</h4>
            <p className="text-sm">
              An index that includes additional columns beyond the indexed column. If a query only needs
              columns that are in the index, the database can answer without accessing the main table at
              all — a significant performance win.
            </p>
          </div>

          <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-5 py-4">
            <h4 className="text-white font-semibold mb-1">Multi-Column (Composite) Indexes</h4>
            <p className="text-sm">
              Index on multiple columns, e.g., (last_name, first_name). The order matters: this index
              is useful for queries filtering by last_name alone, or by (last_name, first_name) together,
              but not for first_name alone.
            </p>
          </div>

          <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-5 py-4">
            <h4 className="text-white font-semibold mb-1">Full-Text Search Indexes</h4>
            <p className="text-sm">
              Specialized structures (inverted indexes) that map words to the documents containing them.
              Support fuzzy matching, stemming, ranking by relevance. Used by Elasticsearch, Lucene, and
              PostgreSQL&apos;s tsvector.
            </p>
          </div>
        </div>
      </section>

      {/* ========== Section 7: Python — Simple LSM-Tree ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Implementing a Simple LSM-Tree</h2>

        <p className="mb-4">
          Let us build a minimal LSM-tree with an in-memory memtable, SSTable flush to &quot;disk&quot;
          (simulated as sorted lists), and a compaction step that merges SSTables.
        </p>

        <PythonCell
          title="Simple LSM-Tree Implementation"
          defaultCode={`import bisect

class SSTable:
    """Immutable sorted key-value store (simulates a file on disk)."""
    def __init__(self, data: list):
        # data is a sorted list of (key, value) tuples
        self.data = sorted(data, key=lambda x: x[0])
        self.keys = [d[0] for d in self.data]

    def get(self, key):
        idx = bisect.bisect_left(self.keys, key)
        if idx < len(self.keys) and self.keys[idx] == key:
            return self.data[idx][1]
        return None

    def __len__(self):
        return len(self.data)

    def __repr__(self):
        return f"SSTable({len(self.data)} entries: {self.keys[:5]}{'...' if len(self.keys) > 5 else ''})"


class LSMTree:
    """Minimal LSM-tree: memtable + multi-level SSTables + compaction."""

    def __init__(self, memtable_threshold=4, level_ratio=4):
        self.memtable = {}  # key -> value (in-memory, mutable)
        self.threshold = memtable_threshold
        self.level_ratio = level_ratio
        self.levels = [[], [], []]  # L0, L1, L2 — each is a list of SSTables
        self.stats = {"writes": 0, "reads": 0, "flushes": 0, "compactions": 0}

    def put(self, key, value):
        """Write: always goes to memtable first."""
        self.memtable[key] = value
        self.stats["writes"] += 1

        if len(self.memtable) >= self.threshold:
            self._flush()

    def get(self, key):
        """Read: check memtable, then L0, L1, L2."""
        self.stats["reads"] += 1

        # 1. Check memtable
        if key in self.memtable:
            return self.memtable[key]

        # 2. Check each level (newest to oldest)
        for level in self.levels:
            for sstable in reversed(level):  # newest SSTable first
                val = sstable.get(key)
                if val is not None:
                    return val

        return None  # key not found

    def _flush(self):
        """Flush memtable to L0 as a new SSTable."""
        if not self.memtable:
            return
        sstable = SSTable(list(self.memtable.items()))
        self.levels[0].append(sstable)
        self.memtable = {}
        self.stats["flushes"] += 1

        # Compact if L0 has too many SSTables
        if len(self.levels[0]) >= self.level_ratio:
            self._compact(0)

    def _compact(self, level):
        """Merge all SSTables at 'level' into 'level + 1'."""
        if level + 1 >= len(self.levels):
            return

        # Merge all SSTables at this level
        merged = {}
        for sst in self.levels[level + 1]:
            for k, v in sst.data:
                merged[k] = v
        for sst in self.levels[level]:
            for k, v in sst.data:
                merged[k] = v  # newer overwrites older

        self.levels[level] = []
        self.levels[level + 1] = [SSTable(list(merged.items()))]
        self.stats["compactions"] += 1

        # Cascade if next level is too big
        if len(self.levels[level + 1][0]) > self.threshold * (self.level_ratio ** (level + 2)):
            if level + 2 < len(self.levels):
                self._compact(level + 1)

    def debug(self):
        print(f"  Memtable: {dict(list(self.memtable.items())[:5])} ({len(self.memtable)} entries)")
        for i, level in enumerate(self.levels):
            print(f"  L{i}: {level}")
        print(f"  Stats: {self.stats}")


# Demo
lsm = LSMTree(memtable_threshold=4, level_ratio=3)

print("=== Writing 20 key-value pairs ===")
for i in range(20):
    key = f"key:{i:03d}"
    lsm.put(key, f"value_{i}")
    if (i + 1) % 5 == 0:
        print(f"\\nAfter {i+1} writes:")
        lsm.debug()

print("\\n=== Reading keys ===")
for key in ["key:000", "key:010", "key:019", "key:099"]:
    val = lsm.get(key)
    print(f"  {key} -> {val}")

print(f"\\n=== Final Stats ===")
lsm.debug()

# Demonstrate write amplification
total_entries_written = sum(len(sst) for level in lsm.levels for sst in level) + len(lsm.memtable)
print(f"\\nWrite amplification: {total_entries_written} total entries stored for {lsm.stats['writes']} logical writes")
print(f"Ratio: {total_entries_written / lsm.stats['writes']:.2f}x")`}
        />
      </section>

      {/* ========== Section 8: Python — B-Tree Implementation ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: B-Tree with Node Splitting</h2>

        <p className="mb-4">
          Now let us implement a B-tree with insert and search operations. The key operation is
          <strong className="text-white"> node splitting</strong>: when a node exceeds its maximum
          capacity, it splits into two and promotes the median key to the parent.
        </p>

        <PythonCell
          title="B-Tree Insert & Search"
          defaultCode={`class BTreeNode:
    def __init__(self, order, is_leaf=True):
        self.order = order          # max children per node
        self.keys = []
        self.children = []
        self.is_leaf = is_leaf

    def __repr__(self):
        return f"Node(keys={self.keys}, leaf={self.is_leaf})"


class BTree:
    def __init__(self, order=3):
        self.order = order          # order 3 = max 2 keys per node
        self.root = BTreeNode(order)
        self.stats = {"splits": 0, "comparisons": 0}

    def search(self, key, node=None):
        """Search for a key, returning (node, index) or None."""
        node = node or self.root
        i = 0
        while i < len(node.keys) and key > node.keys[i]:
            self.stats["comparisons"] += 1
            i += 1

        if i < len(node.keys) and node.keys[i] == key:
            return (node, i)

        if node.is_leaf:
            return None

        return self.search(key, node.children[i])

    def insert(self, key):
        root = self.root
        if len(root.keys) == self.order - 1:
            # Root is full — create new root
            new_root = BTreeNode(self.order, is_leaf=False)
            new_root.children.append(root)
            self._split_child(new_root, 0)
            self.root = new_root

        self._insert_non_full(self.root, key)

    def _insert_non_full(self, node, key):
        i = len(node.keys) - 1
        if node.is_leaf:
            # Insert key in sorted position
            node.keys.append(None)
            while i >= 0 and key < node.keys[i]:
                node.keys[i + 1] = node.keys[i]
                i -= 1
            node.keys[i + 1] = key
        else:
            while i >= 0 and key < node.keys[i]:
                i -= 1
            i += 1
            if len(node.children[i].keys) == self.order - 1:
                self._split_child(node, i)
                if key > node.keys[i]:
                    i += 1
            self._insert_non_full(node.children[i], key)

    def _split_child(self, parent, index):
        self.stats["splits"] += 1
        child = parent.children[index]
        mid = (self.order - 1) // 2

        new_child = BTreeNode(self.order, is_leaf=child.is_leaf)
        new_child.keys = child.keys[mid + 1:]
        mid_key = child.keys[mid]
        child.keys = child.keys[:mid]

        if not child.is_leaf:
            new_child.children = child.children[mid + 1:]
            child.children = child.children[:mid + 1]

        parent.keys.insert(index, mid_key)
        parent.children.insert(index + 1, new_child)

    def print_tree(self, node=None, level=0, prefix="Root"):
        node = node or self.root
        print(f"{'  ' * level}{prefix}: {node.keys}")
        if not node.is_leaf:
            for i, child in enumerate(node.children):
                self.print_tree(child, level + 1, f"Child[{i}]")


# Build a B-tree of order 3 (max 2 keys per node)
bt = BTree(order=3)
insert_order = [10, 20, 5, 15, 25, 8, 12, 30, 3, 7, 18, 22, 35, 1, 40]

print("=== B-Tree Insertions (Order 3) ===")
print(f"Max keys per node: {bt.order - 1}")
print(f"Inserting: {insert_order}\\n")

for i, key in enumerate(insert_order):
    bt.insert(key)
    if (i + 1) % 5 == 0 or i == len(insert_order) - 1:
        print(f"After inserting {insert_order[:i+1][-5:]} ({i+1} total):")
        bt.print_tree()
        print()

print(f"Stats: {bt.stats}")
print(f"Total keys: {len(insert_order)}, Splits needed: {bt.stats['splits']}")

# Search
print("\\n=== Searching ===")
for key in [12, 25, 99, 1, 40]:
    result = bt.search(key)
    if result:
        node, idx = result
        print(f"  search({key}): FOUND in node {node.keys}")
    else:
        print(f"  search({key}): NOT FOUND")

# Build a larger tree to show scaling
print("\\n=== B-Tree Scaling (Order 5) ===")
bt5 = BTree(order=5)
for i in range(100):
    bt5.insert(i)

def tree_depth(node):
    if node.is_leaf:
        return 1
    return 1 + tree_depth(node.children[0])

def count_nodes(node):
    n = 1
    for child in node.children:
        n += count_nodes(child)
    return n

print(f"100 keys with order 5:")
print(f"  Depth: {tree_depth(bt5.root)}")
print(f"  Nodes: {count_nodes(bt5.root)}")
print(f"  Splits: {bt5.stats['splits']}")
print(f"  Max lookups per search: {tree_depth(bt5.root)} (logarithmic!)")
print(f"\\nWith branching factor 500 and depth 4:")
print(f"  Max keys: 500^4 = {500**4:,} = ~62 billion")`}
        />
      </section>

      {/* ========== Summary ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-5">
          <ul className="space-y-3">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">1.</span>
              <span>
                <strong className="text-white">Log-structured storage</strong> (LSM-trees) turns random
                writes into sequential writes. The write path goes through an in-memory memtable,
                flushes to sorted SSTables, and background compaction keeps things organized.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>
                <strong className="text-white">B-trees</strong> are the standard indexing structure for
                relational databases. Fixed-size pages, in-place updates, and a balanced tree structure
                provide consistent read performance with logarithmic lookups.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>
                The core tradeoff is <strong className="text-white">write amplification</strong> vs
                <strong className="text-white"> read amplification</strong>. LSM-trees write data multiple
                times during compaction but have faster writes. B-trees may read fewer levels but have
                more expensive writes.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">4.</span>
              <span>
                <strong className="text-white">SSTables</strong> are the building block of LSM-trees:
                sorted, immutable files that can be efficiently merged. Bloom filters optimize the read
                path by quickly ruling out levels that do not contain a key.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">5.</span>
              <span>
                Beyond primary indexes, databases use <strong className="text-white">secondary indexes</strong>,
                covering indexes, composite indexes, and full-text indexes to accelerate different query
                patterns. Choosing the right indexes is one of the most impactful performance decisions.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </article>
  )
}
