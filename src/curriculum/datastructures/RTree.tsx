import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/r-tree',
  title: 'R-Trees: Spatial Indexing',
  description:
    'Spatial indexing for geographic queries, collision detection, and nearest-neighbor search — learn how R-trees organize multi-dimensional data',
  track: 'datastructures',
  order: 14,
  tags: ['r-tree', 'spatial', 'indexing', 'bounding-box', 'postgis', 'collision', 'gis'],
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
/* R-Tree Data Structure                                               */
/* ------------------------------------------------------------------ */

interface Rect {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface RPoint {
  x: number
  y: number
  label: string
}

interface RTreeNode {
  bounds: Rect
  children: RTreeNode[]
  points: RPoint[]
  isLeaf: boolean
}

function emptyRect(): Rect {
  return { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
}

function expandRect(r: Rect, px: number, py: number): Rect {
  return {
    x1: Math.min(r.x1, px),
    y1: Math.min(r.y1, py),
    x2: Math.max(r.x2, px),
    y2: Math.max(r.y2, py),
  }
}

function mergeRects(a: Rect, b: Rect): Rect {
  return {
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  }
}

function rectArea(r: Rect): number {
  if (r.x1 > r.x2 || r.y1 > r.y2) return 0
  return (r.x2 - r.x1) * (r.y2 - r.y1)
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
}

function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x1 && px <= r.x2 && py >= r.y1 && py <= r.y2
}

const MAX_ENTRIES = 4

function createRTree(): RTreeNode {
  return { bounds: emptyRect(), children: [], points: [], isLeaf: true }
}

function recalcBounds(node: RTreeNode): void {
  let r = emptyRect()
  if (node.isLeaf) {
    for (const pt of node.points) {
      r = expandRect(r, pt.x, pt.y)
    }
  } else {
    for (const child of node.children) {
      r = mergeRects(r, child.bounds)
    }
  }
  node.bounds = r
}

function enlargementNeeded(r: Rect, px: number, py: number): number {
  const expanded = expandRect(r, px, py)
  return rectArea(expanded) - rectArea(r)
}

function rtreeInsert(node: RTreeNode, point: RPoint): RTreeNode | null {
  if (node.isLeaf) {
    node.points.push(point)
    node.bounds = expandRect(node.bounds, point.x, point.y)
    if (node.points.length > MAX_ENTRIES) {
      return splitLeaf(node)
    }
    return null
  }

  // Choose child with least enlargement
  let bestIdx = 0
  let bestEnlargement = Infinity
  for (let i = 0; i < node.children.length; i++) {
    const e = enlargementNeeded(node.children[i].bounds, point.x, point.y)
    if (e < bestEnlargement) {
      bestEnlargement = e
      bestIdx = i
    }
  }

  const newNode = rtreeInsert(node.children[bestIdx], point)
  recalcBounds(node)

  if (newNode) {
    node.children.push(newNode)
    recalcBounds(node)
    if (node.children.length > MAX_ENTRIES) {
      return splitInternal(node)
    }
  }
  return null
}

function splitLeaf(node: RTreeNode): RTreeNode {
  const sorted = [...node.points].sort((a, b) => a.x - b.x)
  const mid = Math.ceil(sorted.length / 2)
  const newNode: RTreeNode = { bounds: emptyRect(), children: [], points: sorted.slice(mid), isLeaf: true }
  node.points = sorted.slice(0, mid)
  recalcBounds(node)
  recalcBounds(newNode)
  return newNode
}

function splitInternal(node: RTreeNode): RTreeNode {
  const sorted = [...node.children].sort((a, b) => a.bounds.x1 - b.bounds.x1)
  const mid = Math.ceil(sorted.length / 2)
  const newNode: RTreeNode = { bounds: emptyRect(), children: sorted.slice(mid), points: [], isLeaf: false }
  node.children = sorted.slice(0, mid)
  recalcBounds(node)
  recalcBounds(newNode)
  return newNode
}

function rtreeRangeQuery(node: RTreeNode, query: Rect): { results: RPoint[]; checked: RTreeNode[]; pruned: RTreeNode[] } {
  const results: RPoint[] = []
  const checked: RTreeNode[] = []
  const pruned: RTreeNode[] = []

  function search(n: RTreeNode): void {
    if (!rectsOverlap(n.bounds, query)) {
      pruned.push(n)
      return
    }
    checked.push(n)
    if (n.isLeaf) {
      for (const pt of n.points) {
        if (pointInRect(pt.x, pt.y, query)) {
          results.push(pt)
        }
      }
    } else {
      for (const child of n.children) {
        search(child)
      }
    }
  }

  search(node)
  return { results, checked, pruned }
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive R-Tree Range Query                          */
/* ------------------------------------------------------------------ */

function generatePoints(count: number, w: number, h: number, margin: number): RPoint[] {
  const names = ['Cafe', 'Pizza', 'Sushi', 'Burger', 'Thai', 'Taco', 'Deli', 'Noodle', 'BBQ', 'Bakery']
  const pts: RPoint[] = []
  for (let i = 0; i < count; i++) {
    pts.push({
      x: margin + Math.random() * (w - 2 * margin),
      y: margin + Math.random() * (h - 2 * margin),
      label: names[i % names.length] + ' ' + (i + 1),
    })
  }
  return pts
}

function RangeQuerySketch() {
  const [pointCount, setPointCount] = useState(60)
  const [statusMsg, setStatusMsg] = useState('Click and drag to define a search rectangle')

  const treeRef = useRef<{ root: RTreeNode; allRoots: RTreeNode[] }>({ root: createRTree(), allRoots: [] })
  const pointsRef = useRef<RPoint[]>([])
  const queryRef = useRef<Rect | null>(null)
  const checkedRef = useRef<Set<RTreeNode>>(new Set())
  const prunedRef = useRef<Set<RTreeNode>>(new Set())
  const resultsRef = useRef<RPoint[]>([])
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const needsRebuildRef = useRef(true)
  const pointCountRef = useRef(pointCount)

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 520)
        p.textFont('monospace')
      }

      p.mousePressed = () => {
        if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
          dragStartRef.current = { x: p.mouseX, y: p.mouseY }
          queryRef.current = null
          checkedRef.current.clear()
          prunedRef.current.clear()
          resultsRef.current = []
        }
      }

      p.mouseDragged = () => {
        if (dragStartRef.current) {
          queryRef.current = {
            x1: Math.min(dragStartRef.current.x, p.mouseX),
            y1: Math.min(dragStartRef.current.y, p.mouseY),
            x2: Math.max(dragStartRef.current.x, p.mouseX),
            y2: Math.max(dragStartRef.current.y, p.mouseY),
          }
        }
      }

      p.mouseReleased = () => {
        if (dragStartRef.current && queryRef.current) {
          const q = queryRef.current
          if (Math.abs(q.x2 - q.x1) > 5 && Math.abs(q.y2 - q.y1) > 5) {
            const result = rtreeRangeQuery(treeRef.current.root, q)
            checkedRef.current = new Set(result.checked)
            prunedRef.current = new Set(result.pruned)
            resultsRef.current = result.results
            setStatusMsg(
              `Found ${result.results.length} points | Checked ${result.checked.length} nodes | Pruned ${result.pruned.length} nodes`
            )
          }
        }
        dragStartRef.current = null
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        // Rebuild tree if needed
        if (needsRebuildRef.current) {
          needsRebuildRef.current = false
          const pts = generatePoints(pointCountRef.current, p.width, p.height, 40)
          pointsRef.current = pts

          let root = createRTree()
          const allRoots: RTreeNode[] = [root]
          for (const pt of pts) {
            const split = rtreeInsert(root, pt)
            if (split) {
              const newRoot: RTreeNode = { bounds: emptyRect(), children: [root, split], points: [], isLeaf: false }
              recalcBounds(newRoot)
              root = newRoot
              allRoots.push(root)
            }
          }
          treeRef.current = { root, allRoots }
        }

        p.background(...BG)

        // Grid
        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        // Draw bounding rectangles from tree
        const drawBounds = (node: RTreeNode, depth: number): void => {
          if (node.bounds.x1 > node.bounds.x2) return
          const isChecked = checkedRef.current.has(node)
          const isPruned = prunedRef.current.has(node)

          const colors: [number, number, number][] = [ACCENT, CYAN, ORANGE, PINK, YELLOW]
          const col = colors[depth % colors.length]

          if (isPruned) {
            ctx.globalAlpha = 0.15
            p.stroke(...RED)
          } else if (isChecked) {
            ctx.globalAlpha = 0.5
            p.stroke(...GREEN)
          } else {
            ctx.globalAlpha = 0.2
            p.stroke(...col)
          }

          p.strokeWeight(1.5)
          p.noFill()
          const b = node.bounds
          const pad = 6
          p.rect(b.x1 - pad, b.y1 - pad, b.x2 - b.x1 + 2 * pad, b.y2 - b.y1 + 2 * pad, 3)
          ctx.globalAlpha = 1.0

          if (!node.isLeaf) {
            for (const child of node.children) {
              drawBounds(child, depth + 1)
            }
          }
        }
        drawBounds(treeRef.current.root, 0)

        // Draw points
        const resultSet = new Set(resultsRef.current)
        for (const pt of pointsRef.current) {
          if (resultSet.has(pt)) {
            p.fill(...GREEN)
            p.noStroke()
            p.ellipse(pt.x, pt.y, 10, 10)
          } else {
            p.fill(...TEXT_C)
            p.noStroke()
            p.ellipse(pt.x, pt.y, 6, 6)
          }
        }

        // Draw query rectangle
        const q = queryRef.current
        if (q) {
          ctx.setLineDash([5, 5])
          p.stroke(...YELLOW)
          p.strokeWeight(2)
          p.noFill()
          p.rect(q.x1, q.y1, q.x2 - q.x1, q.y2 - q.y1)
          ctx.setLineDash([])
        }

        // Title
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('R-Tree Range Query — click and drag to search', 20, 15)
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-4 items-center flex-wrap">
        <label className="text-sm text-gray-400">
          Points:
          <input
            type="range"
            min={20}
            max={150}
            value={pointCount}
            onChange={e => {
              const v = parseInt(e.target.value)
              setPointCount(v)
              pointCountRef.current = v
              needsRebuildRef.current = true
              checkedRef.current.clear()
              prunedRef.current.clear()
              resultsRef.current = []
              queryRef.current = null
            }}
            className="ml-2 align-middle"
          />
          <span className="ml-2 text-cyan-400">{pointCount}</span>
        </label>
        <span className="text-sm text-gray-400">{statusMsg}</span>
      </div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Insert Animation                                        */
/* ------------------------------------------------------------------ */

function InsertSketch() {
  const [statusMsg, setStatusMsg] = useState('Click anywhere on the map to insert a point')

  const treeRef = useRef<RTreeNode>(createRTree())
  const pointsRef = useRef<RPoint[]>([])
  const lastInsertRef = useRef<RPoint | null>(null)
  const animRef = useRef(0)
  const splitFlashRef = useRef(0)

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 420)
        p.textFont('monospace')
        // Seed some initial points
        const initial = generatePoints(10, p.width, p.height, 50)
        for (const pt of initial) {
          pointsRef.current.push(pt)
          const split = rtreeInsert(treeRef.current, pt)
          if (split) {
            const newRoot: RTreeNode = { bounds: emptyRect(), children: [treeRef.current, split], points: [], isLeaf: false }
            recalcBounds(newRoot)
            treeRef.current = newRoot
          }
        }
      }

      p.mouseClicked = () => {
        if (p.mouseX < 10 || p.mouseX > p.width - 10 || p.mouseY < 40 || p.mouseY > p.height - 10) return
        const pt: RPoint = { x: p.mouseX, y: p.mouseY, label: `P${pointsRef.current.length + 1}` }
        pointsRef.current.push(pt)
        lastInsertRef.current = pt
        animRef.current = 60

        const split = rtreeInsert(treeRef.current, pt)
        if (split) {
          const newRoot: RTreeNode = { bounds: emptyRect(), children: [treeRef.current, split], points: [], isLeaf: false }
          recalcBounds(newRoot)
          treeRef.current = newRoot
          splitFlashRef.current = 60
          setStatusMsg(`Inserted point at (${Math.round(pt.x)}, ${Math.round(pt.y)}) — node split occurred!`)
        } else {
          setStatusMsg(`Inserted point at (${Math.round(pt.x)}, ${Math.round(pt.y)}) — ${pointsRef.current.length} total points`)
        }
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        p.background(...BG)

        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        // Draw bounding rects
        const drawBounds = (node: RTreeNode, depth: number): void => {
          if (node.bounds.x1 > node.bounds.x2) return
          const colors: [number, number, number][] = [ACCENT, CYAN, ORANGE, PINK]
          const col = colors[depth % colors.length]
          ctx.globalAlpha = 0.3
          p.stroke(...col)
          p.strokeWeight(1.5)
          p.noFill()
          const b = node.bounds
          const pad = 5
          p.rect(b.x1 - pad, b.y1 - pad, b.x2 - b.x1 + 2 * pad, b.y2 - b.y1 + 2 * pad, 3)
          ctx.globalAlpha = 1.0
          if (!node.isLeaf) {
            for (const child of node.children) {
              drawBounds(child, depth + 1)
            }
          }
        }
        drawBounds(treeRef.current, 0)

        // Split flash
        if (splitFlashRef.current > 0) {
          splitFlashRef.current--
          ctx.globalAlpha = splitFlashRef.current / 60 * 0.3
          p.fill(...YELLOW)
          p.noStroke()
          p.rect(0, 0, p.width, p.height)
          ctx.globalAlpha = 1.0
        }

        // Draw points
        for (const pt of pointsRef.current) {
          const isLast = pt === lastInsertRef.current && animRef.current > 0
          if (isLast) {
            p.fill(...GREEN)
            const pulse = 8 + Math.sin(animRef.current * 0.2) * 4
            p.noStroke()
            p.ellipse(pt.x, pt.y, pulse, pulse)
          } else {
            p.fill(...TEXT_C)
            p.noStroke()
            p.ellipse(pt.x, pt.y, 6, 6)
          }
        }

        if (animRef.current > 0) animRef.current--

        // Title
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`R-Tree Insert — click to add points (${pointsRef.current.length} total)`, 20, 15)
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-400">{statusMsg}</div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Code                                                         */
/* ------------------------------------------------------------------ */

const rtreeImplementation = `import math

class Rect:
    def __init__(self, x1, y1, x2, y2):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2

    def area(self):
        return max(0, self.x2 - self.x1) * max(0, self.y2 - self.y1)

    def expand(self, x, y):
        return Rect(min(self.x1, x), min(self.y1, y),
                     max(self.x2, x), max(self.y2, y))

    def merge(self, other):
        return Rect(min(self.x1, other.x1), min(self.y1, other.y1),
                     max(self.x2, other.x2), max(self.y2, other.y2))

    def overlaps(self, other):
        return (self.x1 <= other.x2 and self.x2 >= other.x1 and
                self.y1 <= other.y2 and self.y2 >= other.y1)

    def contains_point(self, x, y):
        return self.x1 <= x <= self.x2 and self.y1 <= y <= self.y2

class RTreeNode:
    MAX_ENTRIES = 4

    def __init__(self, is_leaf=True):
        self.bounds = Rect(float('inf'), float('inf'), float('-inf'), float('-inf'))
        self.children = []  # child nodes (internal) or (x,y,label) tuples (leaf)
        self.is_leaf = is_leaf

    def recalc_bounds(self):
        r = Rect(float('inf'), float('inf'), float('-inf'), float('-inf'))
        if self.is_leaf:
            for x, y, _ in self.children:
                r = r.expand(x, y)
        else:
            for child in self.children:
                r = r.merge(child.bounds)
        self.bounds = r

class RTree:
    def __init__(self):
        self.root = RTreeNode(is_leaf=True)

    def insert(self, x, y, label=""):
        split = self._insert(self.root, (x, y, label))
        if split:
            new_root = RTreeNode(is_leaf=False)
            new_root.children = [self.root, split]
            new_root.recalc_bounds()
            self.root = new_root

    def _insert(self, node, point):
        x, y, label = point
        if node.is_leaf:
            node.children.append(point)
            node.bounds = node.bounds.expand(x, y)
            if len(node.children) > RTreeNode.MAX_ENTRIES:
                return self._split_leaf(node)
            return None

        # Choose child with least enlargement
        best_idx = 0
        best_enlargement = float('inf')
        for i, child in enumerate(node.children):
            expanded = child.bounds.expand(x, y)
            enlargement = expanded.area() - child.bounds.area()
            if enlargement < best_enlargement:
                best_enlargement = enlargement
                best_idx = i

        split = self._insert(node.children[best_idx], point)
        node.recalc_bounds()

        if split:
            node.children.append(split)
            node.recalc_bounds()
            if len(node.children) > RTreeNode.MAX_ENTRIES:
                return self._split_internal(node)
        return None

    def _split_leaf(self, node):
        # Sort by x and split in half
        node.children.sort(key=lambda p: p[0])
        mid = len(node.children) // 2
        new_node = RTreeNode(is_leaf=True)
        new_node.children = node.children[mid:]
        node.children = node.children[:mid]
        node.recalc_bounds()
        new_node.recalc_bounds()
        return new_node

    def _split_internal(self, node):
        node.children.sort(key=lambda c: c.bounds.x1)
        mid = len(node.children) // 2
        new_node = RTreeNode(is_leaf=False)
        new_node.children = node.children[mid:]
        node.children = node.children[:mid]
        node.recalc_bounds()
        new_node.recalc_bounds()
        return new_node

    def range_query(self, qx1, qy1, qx2, qy2):
        query = Rect(qx1, qy1, qx2, qy2)
        results = []
        nodes_checked = [0]
        nodes_pruned = [0]
        self._search(self.root, query, results, nodes_checked, nodes_pruned)
        return results, nodes_checked[0], nodes_pruned[0]

    def _search(self, node, query, results, checked, pruned):
        if not node.bounds.overlaps(query):
            pruned[0] += 1
            return
        checked[0] += 1
        if node.is_leaf:
            for x, y, label in node.children:
                if query.contains_point(x, y):
                    results.append((x, y, label))
        else:
            for child in node.children:
                self._search(child, query, results, checked, pruned)

# --- Demo ---
import random
random.seed(42)

tree = RTree()
for i in range(30):
    x = random.uniform(0, 100)
    y = random.uniform(0, 100)
    tree.insert(x, y, f"Point_{i}")

print("R-Tree with 30 random points")
print(f"Root bounds: ({tree.root.bounds.x1:.1f}, {tree.root.bounds.y1:.1f}) to ({tree.root.bounds.x2:.1f}, {tree.root.bounds.y2:.1f})")
print()

# Range query: find points in [20,20] to [60,60]
results, checked, pruned = tree.range_query(20, 20, 60, 60)
print(f"Range query [20,20] to [60,60]:")
print(f"  Found {len(results)} points")
print(f"  Nodes checked: {checked}")
print(f"  Nodes pruned: {pruned}")
for x, y, label in results[:5]:
    print(f"    {label}: ({x:.1f}, {y:.1f})")
if len(results) > 5:
    print(f"    ... and {len(results) - 5} more")
`

const rtreeBenchmark = `import random
import time

# Simple brute-force range query for comparison
def brute_force_range(points, qx1, qy1, qx2, qy2):
    return [(x, y, l) for x, y, l in points
            if qx1 <= x <= qx2 and qy1 <= y <= qy2]

# R-Tree classes (compact version)
class Rect:
    def __init__(self, x1, y1, x2, y2):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2
    def area(self):
        return max(0, self.x2-self.x1) * max(0, self.y2-self.y1)
    def expand(self, x, y):
        return Rect(min(self.x1,x), min(self.y1,y), max(self.x2,x), max(self.y2,y))
    def merge(self, o):
        return Rect(min(self.x1,o.x1), min(self.y1,o.y1), max(self.x2,o.x2), max(self.y2,o.y2))
    def overlaps(self, o):
        return self.x1<=o.x2 and self.x2>=o.x1 and self.y1<=o.y2 and self.y2>=o.y1
    def contains(self, x, y):
        return self.x1<=x<=self.x2 and self.y1<=y<=self.y2

class Node:
    MAX = 8
    def __init__(self, leaf=True):
        self.bounds = Rect(1e9,1e9,-1e9,-1e9)
        self.children = []
        self.leaf = leaf
    def recalc(self):
        r = Rect(1e9,1e9,-1e9,-1e9)
        if self.leaf:
            for x,y,_ in self.children: r = r.expand(x,y)
        else:
            for c in self.children: r = r.merge(c.bounds)
        self.bounds = r

class FastRTree:
    def __init__(self):
        self.root = Node()

    def insert(self, x, y, label=""):
        s = self._ins(self.root, (x,y,label))
        if s:
            nr = Node(leaf=False)
            nr.children = [self.root, s]
            nr.recalc()
            self.root = nr

    def _ins(self, node, pt):
        x,y,l = pt
        if node.leaf:
            node.children.append(pt)
            node.bounds = node.bounds.expand(x,y)
            if len(node.children) > Node.MAX:
                return self._split(node)
            return None
        best_i, best_e = 0, float('inf')
        for i,c in enumerate(node.children):
            e = c.bounds.expand(x,y).area() - c.bounds.area()
            if e < best_e: best_e, best_i = e, i
        s = self._ins(node.children[best_i], pt)
        node.recalc()
        if s:
            node.children.append(s)
            node.recalc()
            if len(node.children) > Node.MAX:
                return self._split_int(node)
        return None

    def _split(self, node):
        node.children.sort(key=lambda p:p[0])
        m = len(node.children)//2
        nn = Node()
        nn.children = node.children[m:]
        node.children = node.children[:m]
        node.recalc(); nn.recalc()
        return nn

    def _split_int(self, node):
        node.children.sort(key=lambda c:c.bounds.x1)
        m = len(node.children)//2
        nn = Node(leaf=False)
        nn.children = node.children[m:]
        node.children = node.children[:m]
        node.recalc(); nn.recalc()
        return nn

    def query(self, qx1, qy1, qx2, qy2):
        q = Rect(qx1,qy1,qx2,qy2)
        res = []
        self._q(self.root, q, res)
        return res

    def _q(self, n, q, res):
        if not n.bounds.overlaps(q): return
        if n.leaf:
            for x,y,l in n.children:
                if q.contains(x,y): res.append((x,y,l))
        else:
            for c in n.children: self._q(c, q, res)

# --- Benchmark ---
random.seed(123)
N = 1000
points = [(random.uniform(0,1000), random.uniform(0,1000), f"R{i}") for i in range(N)]

# Build R-Tree
tree = FastRTree()
t0 = time.time()
for x,y,l in points:
    tree.insert(x,y,l)
build_time = time.time() - t0
print(f"Built R-Tree with {N} points in {build_time*1000:.1f} ms")

# Range queries of varying sizes
for size in [50, 100, 200, 400]:
    # Query centered on (500, 500)
    qx1, qy1 = 500 - size/2, 500 - size/2
    qx2, qy2 = 500 + size/2, 500 + size/2

    # R-Tree query
    t0 = time.time()
    for _ in range(100):
        r_results = tree.query(qx1, qy1, qx2, qy2)
    rtree_time = (time.time() - t0) / 100

    # Brute force
    t0 = time.time()
    for _ in range(100):
        bf_results = brute_force_range(points, qx1, qy1, qx2, qy2)
    bf_time = (time.time() - t0) / 100

    speedup = bf_time / rtree_time if rtree_time > 0 else float('inf')
    print(f"Query [{size}x{size}]: R-Tree {rtree_time*1e6:.0f}us, Brute {bf_time*1e6:.0f}us, "
          f"Speedup {speedup:.1f}x, Found {len(r_results)} pts")

print()
print("R-Tree wins most when the query area is small relative to the total space.")
print("For queries covering most of the space, brute force can be competitive.")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function RTree() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      {/* ---- Hero ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          &quot;Find all restaurants within 2 km of my location.&quot; With 10 million restaurants in a database,
          checking every single one is hopelessly slow. An <strong className="text-indigo-400">R-tree</strong> organizes
          spatial data into a hierarchy of bounding rectangles, allowing you to skip entire regions of the map
          that cannot possibly contain results.
        </p>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-sm">
            <strong>The spatial indexing problem:</strong> standard indexes (B-trees, hash maps) work for 1D data.
            But spatial queries involve 2D (or 3D) regions. You cannot sort points in a way that preserves
            spatial proximity in all dimensions. R-trees solve this by grouping nearby objects into bounding
            rectangles that form a balanced tree, enabling O(log n) range queries instead of O(n) scans.
          </p>
        </div>
      </section>

      {/* ---- Section 1: Range Query ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Range Query</h2>
        <p className="text-gray-300 leading-relaxed">
          The visualization shows scattered points (restaurants) organized by an R-tree. The colored
          rectangles are bounding boxes at different levels of the tree hierarchy. Click and drag to
          define a search rectangle.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Watch how the R-tree prunes entire subtrees:{' '}
          <span className="text-green-400">green rectangles</span> were checked (overlapped the query),
          while <span className="text-red-400">red rectangles</span> were pruned (no overlap, so their
          entire subtree was skipped). The more you prune, the faster the query.
        </p>
        <RangeQuerySketch />
      </section>

      {/* ---- Section 2: How R-Trees Work ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How R-Trees Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-green-400 mb-2">Structure</h3>
            <p className="text-gray-300 text-sm">
              Each internal node stores a bounding rectangle that encloses all objects in its subtree.
              Leaf nodes store the actual data points (or object bounding boxes). The tree is balanced —
              all leaves are at the same depth, like a B-tree.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Search</h3>
            <p className="text-gray-300 text-sm">
              Given a query rectangle, start at the root. If the query does not overlap a node&apos;s
              bounding rectangle, prune the entire subtree. Otherwise, recurse into children. At leaves,
              check individual points. Pruning makes this much faster than O(n).
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-yellow-400 mb-2">Insert</h3>
            <p className="text-gray-300 text-sm">
              Find the leaf whose bounding rectangle needs the least enlargement to include the new point.
              Add the point. If the leaf overflows (too many entries), split it into two nodes. Splitting
              may cascade up the tree, just like in a B-tree.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-pink-400 mb-2">Nearest Neighbor</h3>
            <p className="text-gray-300 text-sm">
              Start with an initial guess (e.g., the first point found). Use the bounding rectangles
              to compute a minimum possible distance to each subtree. If the minimum distance exceeds
              the current best, prune it. This priority-search finds the nearest neighbor efficiently.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 3: Insert Animation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Insert Animation</h2>
        <p className="text-gray-300 leading-relaxed">
          Click on the map to insert new points into the R-tree. Watch the bounding rectangles expand
          to accommodate new points. When a node overflows (more than {MAX_ENTRIES} entries), it splits
          — you will see a yellow flash when a split occurs and new bounding rectangles form.
        </p>
        <InsertSketch />
      </section>

      {/* ---- Section 4: Real World ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">PostGIS / Spatial Databases</h3>
            <p className="text-gray-300 text-sm">
              PostGIS (the spatial extension for PostgreSQL) uses R-trees (via GiST indexes) for all
              spatial queries. When you run <code className="text-cyan-400">ST_DWithin(geom, point, 5000)</code>,
              an R-tree prunes regions of the table that are more than 5km away.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Game Collision Detection</h3>
            <p className="text-gray-300 text-sm">
              Game engines use spatial indexes (R-trees, quadtrees, BVH) to avoid checking every pair
              of objects for collision. With 1000 objects, brute force is 500K checks per frame.
              A spatial index reduces this to a few hundred checks.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Map Applications</h3>
            <p className="text-gray-300 text-sm">
              Google Maps, OpenStreetMap, and Uber use R-tree variants to quickly find map features
              within the current viewport. As you pan and zoom, the visible bounding box changes
              and the R-tree returns only relevant features.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">CAD Systems</h3>
            <p className="text-gray-300 text-sm">
              CAD software with millions of geometric primitives uses R-trees for selection tools
              (select all objects in a region), snapping (find the nearest vertex), and
              visibility culling (only render objects in the viewport).
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: R-Tree Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: R-Tree Implementation</h2>
        <p className="text-gray-300 leading-relaxed">
          A simplified R-tree with insert and range query. Points are stored as (x, y, label) tuples.
          The implementation demonstrates the core ideas: bounding rectangle management, least-enlargement
          insertion, and range query with pruning.
        </p>
        <PythonCell defaultCode={rtreeImplementation} />
      </section>

      {/* ---- Python: Benchmark ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Benchmark: R-Tree vs Brute Force</h2>
        <p className="text-gray-300 leading-relaxed">
          Generate 1000 random points and compare R-tree range queries against brute-force linear scan.
          Notice how the R-tree advantage grows as the query area shrinks — a small query prunes most
          of the tree, while a large query has less to prune.
        </p>
        <PythonCell defaultCode={rtreeBenchmark} />
      </section>

      {/* ---- Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">R-Tree</th>
                <th className="text-left py-2 pr-4 text-white">Brute Force</th>
                <th className="text-left py-2 text-white">k-d Tree</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Range query</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n + k)</td>
                <td className="py-2 pr-4 text-red-400">O(n)</td>
                <td className="py-2 text-emerald-400">O(sqrt(n) + k)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n)</td>
                <td className="py-2 pr-4 text-emerald-400">O(1)</td>
                <td className="py-2 text-yellow-400">O(log n) or rebuild</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Nearest neighbor</td>
                <td className="py-2 pr-4 text-emerald-400">O(log n)</td>
                <td className="py-2 pr-4 text-red-400">O(n)</td>
                <td className="py-2 text-emerald-400">O(log n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Bulk loading</td>
                <td className="py-2 pr-4 text-emerald-400">O(n log n) STR</td>
                <td className="py-2 pr-4 text-emerald-400">O(1)</td>
                <td className="py-2 text-emerald-400">O(n log n)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Dynamic updates</td>
                <td className="py-2 pr-4 text-emerald-400">Good</td>
                <td className="py-2 pr-4 text-emerald-400">Trivial</td>
                <td className="py-2 text-red-400">Poor</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-sm italic">k = number of results returned, n = total number of points</p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>R-trees group spatial objects into nested bounding rectangles, enabling subtree pruning during search</li>
          <li>Range queries skip entire subtrees whose bounding rectangle does not overlap the query area</li>
          <li>Insert chooses the child with least enlargement, splitting nodes when they overflow (like B-trees)</li>
          <li>R-trees excel at dynamic datasets — unlike k-d trees, they handle insertions and deletions gracefully</li>
          <li>Real-world impact: PostGIS, Google Maps, game engines, and CAD systems all rely on R-tree variants</li>
          <li>The smaller the query area relative to total space, the more pruning the R-tree achieves</li>
        </ul>
      </section>
    </div>
  )
}
