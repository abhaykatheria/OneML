import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/data-models',
  title: 'Data Models & Query Languages',
  description: 'Relational, document, and graph data models — how the way you structure data shapes everything you can do with it',
  track: 'systems',
  order: 2,
  tags: ['relational', 'document', 'graph', 'sql', 'nosql', 'data-modeling'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/* makeRng removed — unused */

/* ------------------------------------------------------------------ */
/* Section 1 — Relational ER Diagram with Animated Joins               */
/* ------------------------------------------------------------------ */

function RelationalSketch() {
  const [showJoin, setShowJoin] = useState(false)
  const showJoinRef = useRef(showJoin)
  showJoinRef.current = showJoin

  const sketch = useCallback((p: p5) => {
    const canvasH = 420
    let animT = 0

    // Table data
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Carol' },
    ]
    const orders = [
      { id: 101, userId: 1, productId: 'P1' },
      { id: 102, userId: 1, productId: 'P3' },
      { id: 103, userId: 2, productId: 'P2' },
      { id: 104, userId: 3, productId: 'P1' },
    ]
    const products = [
      { id: 'P1', name: 'Widget', price: 29 },
      { id: 'P2', name: 'Gadget', price: 49 },
      { id: 'P3', name: 'Gizmo', price: 19 },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.015
      p.background(15, 23, 42)

      const colW = p.width / 3
      const tableTop = 55
      const rowH = 28
      const tableW = colW - 30
      const joining = showJoinRef.current

      // Draw a table
      const drawTable = (
        title: string,
        headers: string[],
        rows: string[][],
        x: number,
        highlight?: Set<number>
      ) => {
        const tx = x + 15
        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(title, tx + tableW / 2, tableTop - 25)

        // Header
        p.fill(51, 65, 85)
        p.noStroke()
        p.rect(tx, tableTop, tableW, rowH, 4, 4, 0, 0)
        p.fill(226, 232, 240)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        const cellW = tableW / headers.length
        for (let i = 0; i < headers.length; i++) {
          p.text(headers[i], tx + cellW * i + 6, tableTop + rowH / 2)
        }

        // Rows
        for (let r = 0; r < rows.length; r++) {
          const ry = tableTop + rowH * (r + 1)
          const isHighlighted = highlight?.has(r)

          if (isHighlighted && joining) {
            const pulse = Math.sin(animT * 3) * 0.3 + 0.7
            p.fill(99, 102, 241, 60 * pulse)
          } else {
            p.fill(30, 41, 59, r % 2 === 0 ? 200 : 150)
          }
          p.noStroke()
          p.rect(tx, ry, tableW, rowH, r === rows.length - 1 ? 0 : 0, r === rows.length - 1 ? 0 : 0,
            r === rows.length - 1 ? 4 : 0, r === rows.length - 1 ? 4 : 0)

          p.fill(isHighlighted && joining ? 165 : 148, isHighlighted && joining ? 180 : 163, isHighlighted && joining ? 255 : 184)
          p.textSize(11)
          for (let i = 0; i < rows[r].length; i++) {
            p.text(rows[r][i], tx + cellW * i + 6, ry + rowH / 2)
          }
        }

        return { x: tx, y: tableTop, w: tableW, h: rowH * (rows.length + 1) }
      }

      // Draw tables
      // usersHighlight removed — unused
      const t1 = drawTable('Users', ['id', 'name'],
        users.map(u => [u.id.toString(), u.name]),
        0, joining ? new Set([0, 1, 2]) : undefined
      )

      const t2 = drawTable('Orders', ['id', 'user_id', 'product_id'],
        orders.map(o => [o.id.toString(), o.userId.toString(), o.productId]),
        colW, joining ? new Set([0, 1, 2, 3]) : undefined
      )

      const t3 = drawTable('Products', ['id', 'name', 'price'],
        products.map(pr => [pr.id, pr.name, '$' + pr.price]),
        colW * 2, joining ? new Set([0, 1, 2]) : undefined
      )

      // Draw foreign key relationships
      if (joining) {
        // Users -> Orders (user_id)
        for (const order of orders) {
          const userIdx = users.findIndex(u => u.id === order.userId)
          const orderIdx = orders.indexOf(order)

          const fromX = t1.x + t1.w
          const fromY = tableTop + rowH * (userIdx + 1) + rowH / 2
          const toX = t2.x
          const toY = tableTop + rowH * (orderIdx + 1) + rowH / 2

          // Animated data flow
          const progress = ((animT * 0.8 + orderIdx * 0.3) % 1)
          const cx1 = fromX + (toX - fromX) * 0.3
          const cx2 = fromX + (toX - fromX) * 0.7

          p.stroke(99, 102, 241, 80)
          p.strokeWeight(1)
          p.noFill()
          p.bezier(fromX, fromY, cx1, fromY, cx2, toY, toX, toY)

          // Animated dot
          const bx = p.bezierPoint(fromX, cx1, cx2, toX, progress)
          const by = p.bezierPoint(fromY, fromY, toY, toY, progress)
          p.noStroke()
          p.fill(99, 102, 241, 220)
          p.ellipse(bx, by, 6, 6)
        }

        // Orders -> Products (product_id)
        for (const order of orders) {
          const prodIdx = products.findIndex(pr => pr.id === order.productId)
          const orderIdx = orders.indexOf(order)

          const fromX = t2.x + t2.w
          const fromY = tableTop + rowH * (orderIdx + 1) + rowH / 2
          const toX = t3.x
          const toY = tableTop + rowH * (prodIdx + 1) + rowH / 2

          const progress = ((animT * 0.6 + orderIdx * 0.4) % 1)
          const cx1 = fromX + (toX - fromX) * 0.3
          const cx2 = fromX + (toX - fromX) * 0.7

          p.stroke(52, 211, 153, 80)
          p.strokeWeight(1)
          p.noFill()
          p.bezier(fromX, fromY, cx1, fromY, cx2, toY, toX, toY)

          p.noStroke()
          p.fill(52, 211, 153, 220)
          const bx = p.bezierPoint(fromX, cx1, cx2, toX, progress)
          const by = p.bezierPoint(fromY, fromY, toY, toY, progress)
          p.ellipse(bx, by, 6, 6)
        }

        // Join result table at bottom
        const joinTop = tableTop + rowH * 6
        p.noStroke()
        p.fill(250, 204, 21, 180)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('JOIN Result: Users -> Orders -> Products', p.width / 2, joinTop - 5)

        const joinHeaders = ['user', 'order_id', 'product', 'price']
        const joinRows = orders.map(o => {
          const user = users.find(u => u.id === o.userId)!
          const prod = products.find(pr => pr.id === o.productId)!
          return [user.name, o.id.toString(), prod.name, '$' + prod.price]
        })

        const joinX = p.width / 2 - tableW * 0.7
        const joinW = tableW * 1.4
        const jCellW = joinW / joinHeaders.length

        // Header
        p.fill(71, 55, 15)
        p.rect(joinX, joinTop + 15, joinW, rowH, 4, 4, 0, 0)
        p.fill(250, 204, 21)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        for (let i = 0; i < joinHeaders.length; i++) {
          p.text(joinHeaders[i], joinX + jCellW * i + 6, joinTop + 15 + rowH / 2)
        }

        // Rows
        for (let r = 0; r < joinRows.length; r++) {
          const ry = joinTop + 15 + rowH * (r + 1)
          const pulse = Math.max(0, Math.sin(animT * 2 - r * 0.5))
          p.fill(30, 41, 59, 180 + pulse * 40)
          p.noStroke()
          p.rect(joinX, ry, joinW, rowH,
            r === joinRows.length - 1 ? 0 : 0, r === joinRows.length - 1 ? 0 : 0,
            r === joinRows.length - 1 ? 4 : 0, r === joinRows.length - 1 ? 4 : 0)

          p.fill(226, 232, 240)
          p.textSize(11)
          for (let i = 0; i < joinRows[r].length; i++) {
            p.text(joinRows[r][i], joinX + jCellW * i + 6, ry + rowH / 2)
          }
        }
      }

      // Legend
      p.noStroke()
      p.fill(99, 102, 241)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('FK: user_id', colW + 15, canvasH - 8)
      p.fill(52, 211, 153)
      p.text('FK: product_id', colW * 2 + 15, canvasH - 8)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setShowJoin(!showJoin)}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            {showJoin ? 'Hide JOIN' : 'Show JOIN Operation'}
          </button>
          <span className="text-gray-500 text-xs">
            {showJoin ? 'Data flows through foreign keys to build the joined result' : 'Click to see how SQL JOIN combines data across tables'}
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Document vs Relational Side-by-Side                     */
/* ------------------------------------------------------------------ */

function DocumentVsRelationalSketch() {
  const [mode, setMode] = useState<'relational' | 'document'>('relational')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sketch = useCallback((p: p5) => {
    const canvasH = 400
    let animT = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.02
      p.background(15, 23, 42)

      const isDoc = modeRef.current === 'document'
      const halfW = p.width / 2

      // Title
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(isDoc ? 'Document Model (Denormalized)' : 'Relational Model (Normalized)', p.width / 2, 10)

      if (!isDoc) {
        // Relational: Show 3 normalized tables
        const tables = [
          { title: 'users', rows: [['1', 'Alice', 'SF'], ['2', 'Bob', 'NYC']], headers: ['id', 'name', 'city'] },
          { title: 'positions', rows: [['1', '1', 'Engineer'], ['2', '1', 'Lead'], ['3', '2', 'Manager']], headers: ['id', 'user_id', 'title'] },
          { title: 'education', rows: [['1', '1', 'MIT', 'CS'], ['2', '2', 'Stanford', 'MBA']], headers: ['id', 'user_id', 'school', 'degree'] },
        ]

        const margin = 20
        const tableW = (p.width - margin * 4) / 3
        const rowH = 24
        const startY = 45

        for (let t = 0; t < tables.length; t++) {
          const tbl = tables[t]
          const tx = margin + t * (tableW + margin)

          // Table name
          p.fill(99, 102, 241)
          p.textSize(12)
          p.textAlign(p.CENTER, p.TOP)
          p.text(tbl.title, tx + tableW / 2, startY)

          // Header
          p.fill(51, 65, 85)
          p.rect(tx, startY + 18, tableW, rowH, 4, 4, 0, 0)
          p.fill(200, 210, 220)
          p.textSize(9)
          p.textAlign(p.LEFT, p.CENTER)
          const cellW = tableW / tbl.headers.length
          for (let h = 0; h < tbl.headers.length; h++) {
            p.text(tbl.headers[h], tx + cellW * h + 4, startY + 18 + rowH / 2)
          }

          // Rows
          for (let r = 0; r < tbl.rows.length; r++) {
            const ry = startY + 18 + rowH * (r + 1)
            p.fill(30, 41, 59, r % 2 === 0 ? 200 : 150)
            p.noStroke()
            p.rect(tx, ry, tableW, rowH)
            p.fill(148, 163, 184)
            p.textSize(9)
            for (let c = 0; c < tbl.rows[r].length; c++) {
              p.text(tbl.rows[r][c], tx + cellW * c + 4, ry + rowH / 2)
            }
          }
        }

        // Pros/Cons
        const infoY = startY + 18 + rowH * 5 + 20
        p.fill(52, 211, 153)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Pros:', margin, infoY)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text('- No data duplication', margin + 10, infoY + 16)
        p.text('- Easy to update (change city in one place)', margin + 10, infoY + 30)
        p.text('- Strong consistency via foreign keys', margin + 10, infoY + 44)
        p.text('- Flexible querying via JOINs', margin + 10, infoY + 58)

        p.fill(244, 63, 94)
        p.textSize(11)
        p.text('Cons:', halfW + 20, infoY)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text('- Requires JOINs (can be slow)', halfW + 30, infoY + 16)
        p.text('- Data spread across tables (poor locality)', halfW + 30, infoY + 30)
        p.text('- Schema must be defined upfront', halfW + 30, infoY + 44)
        p.text('- Impedance mismatch with object models', halfW + 30, infoY + 58)

      } else {
        // Document: Show nested JSON
        const margin = 30
        const startY = 40
        const lineH = 18

        const lines = [
          { text: '{', indent: 0, color: [148, 163, 184] as const },
          { text: '"users": [', indent: 1, color: [99, 102, 241] as const },
          { text: '{', indent: 2, color: [148, 163, 184] as const },
          { text: '"id": 1,', indent: 3, color: [250, 204, 21] as const },
          { text: '"name": "Alice",', indent: 3, color: [250, 204, 21] as const },
          { text: '"city": "SF",', indent: 3, color: [250, 204, 21] as const },
          { text: '"positions": [', indent: 3, color: [52, 211, 153] as const },
          { text: '{ "title": "Engineer" },', indent: 4, color: [52, 211, 153] as const },
          { text: '{ "title": "Lead" }', indent: 4, color: [52, 211, 153] as const },
          { text: '],', indent: 3, color: [148, 163, 184] as const },
          { text: '"education": [', indent: 3, color: [236, 72, 153] as const },
          { text: '{ "school": "MIT", "degree": "CS" }', indent: 4, color: [236, 72, 153] as const },
          { text: ']', indent: 3, color: [148, 163, 184] as const },
          { text: '},', indent: 2, color: [148, 163, 184] as const },
          { text: '{ "id": 2, "name": "Bob", ... }', indent: 2, color: [148, 163, 184] as const },
          { text: ']', indent: 1, color: [148, 163, 184] as const },
          { text: '}', indent: 0, color: [148, 163, 184] as const },
        ]

        // JSON background
        p.fill(20, 27, 45)
        p.noStroke()
        p.rect(margin, startY, halfW - margin * 1.5, lines.length * lineH + 16, 8)

        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const y = startY + 8 + i * lineH
          const x = margin + 12 + line.indent * 16

          // Highlight animation
          const pulse = Math.max(0, Math.sin(animT * 2 - i * 0.3)) * 0.4
          p.fill(line.color[0], line.color[1], line.color[2], 180 + pulse * 75)
          p.text(line.text, x, y)
        }

        // Data locality bracket
        p.stroke(250, 204, 21, 100)
        p.strokeWeight(1.5)
        p.noFill()
        const bracketX = halfW - margin * 1.5 + margin + 8
        const bracketTop = startY + 8 + 2 * lineH
        const bracketBottom = startY + 8 + 13 * lineH
        p.line(bracketX, bracketTop, bracketX + 8, bracketTop)
        p.line(bracketX + 8, bracketTop, bracketX + 8, bracketBottom)
        p.line(bracketX, bracketBottom, bracketX + 8, bracketBottom)
        p.noStroke()
        p.fill(250, 204, 21, 180)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('single', bracketX + 12, (bracketTop + bracketBottom) / 2 - 6)
        p.text('document', bracketX + 12, (bracketTop + bracketBottom) / 2 + 6)

        // Pros/Cons on the right
        const infoX = halfW + 10
        const infoY = startY + 10

        p.fill(52, 211, 153)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Pros:', infoX, infoY)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text('- Great data locality (one fetch)', infoX + 10, infoY + 18)
        p.text('- No JOINs needed', infoX + 10, infoY + 34)
        p.text('- Schema flexibility', infoX + 10, infoY + 50)
        p.text('- Natural fit for 1:many relationships', infoX + 10, infoY + 66)

        p.fill(244, 63, 94)
        p.textSize(11)
        p.text('Cons:', infoX, infoY + 100)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text('- Data duplication (denormalized)', infoX + 10, infoY + 118)
        p.text('- Hard to update shared data', infoX + 10, infoY + 134)
        p.text('- Poor support for many:many', infoX + 10, infoY + 150)
        p.text('- Document can get very large', infoX + 10, infoY + 166)

        // When to use
        p.fill(250, 204, 21)
        p.textSize(11)
        p.text('Best for:', infoX, infoY + 200)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text('- Self-contained documents', infoX + 10, infoY + 218)
        p.text('- Tree-structured data', infoX + 10, infoY + 234)
        p.text('- Schema-on-read use cases', infoX + 10, infoY + 250)
      }
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={() => setMode(mode === 'relational' ? 'document' : 'relational')}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            Show {mode === 'relational' ? 'Document' : 'Relational'} Model
          </button>
          <span className="text-gray-500 text-xs">
            Same data, different structure — compare the tradeoffs
          </span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Interactive Graph Visualization                         */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: number
  label: string
  x: number
  y: number
  vx: number
  vy: number
  type: string
}

interface GraphEdge {
  from: number
  to: number
  label: string
}

function GraphModelSketch() {
  const [traversing, setTraversing] = useState(false)
  const [traversalPath, setTraversalPath] = useState<number[]>([])
  const traversingRef = useRef(traversing)
  const pathRef = useRef(traversalPath)
  traversingRef.current = traversing
  pathRef.current = traversalPath

  const nodesRef = useRef<GraphNode[]>([
    { id: 0, label: 'Alice', x: 200, y: 120, vx: 0, vy: 0, type: 'person' },
    { id: 1, label: 'Bob', x: 400, y: 100, vx: 0, vy: 0, type: 'person' },
    { id: 2, label: 'Carol', x: 350, y: 280, vx: 0, vy: 0, type: 'person' },
    { id: 3, label: 'SF', x: 100, y: 260, vx: 0, vy: 0, type: 'location' },
    { id: 4, label: 'NYC', x: 500, y: 250, vx: 0, vy: 0, type: 'location' },
    { id: 5, label: 'Acme Co', x: 300, y: 50, vx: 0, vy: 0, type: 'company' },
  ])

  const edgesRef = useRef<GraphEdge[]>([
    { from: 0, to: 1, label: 'KNOWS' },
    { from: 1, to: 2, label: 'KNOWS' },
    { from: 0, to: 2, label: 'KNOWS' },
    { from: 0, to: 3, label: 'LIVES_IN' },
    { from: 1, to: 4, label: 'LIVES_IN' },
    { from: 2, to: 3, label: 'LIVES_IN' },
    { from: 0, to: 5, label: 'WORKS_AT' },
    { from: 1, to: 5, label: 'WORKS_AT' },
  ])

  const dragRef = useRef<number | null>(null)

  const startTraversal = useCallback(() => {
    // BFS from Alice (node 0)
    const edges = edgesRef.current
    const visited: number[] = [0]
    const queue = [0]

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const edge of edges) {
        let neighbor = -1
        if (edge.from === current) neighbor = edge.to
        if (edge.to === current) neighbor = edge.from
        if (neighbor >= 0 && !visited.includes(neighbor)) {
          visited.push(neighbor)
          queue.push(neighbor)
        }
      }
    }

    setTraversalPath(visited)
    setTraversing(true)
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 380
    let animT = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, canvasH)
    }

    p.draw = () => {
      animT += 0.02
      p.background(15, 23, 42)

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const tPath = pathRef.current
      const isTrav = traversingRef.current

      // Simple force-directed layout
      const damping = 0.92
      const repulsion = 5000
      const springLen = 150
      const springK = 0.003

      for (let i = 0; i < nodes.length; i++) {
        let fx = 0, fy = 0

        // Repulsion from other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy))
          fx += (dx / dist) * repulsion / (dist * dist)
          fy += (dy / dist) * repulsion / (dist * dist)
        }

        // Spring attraction along edges
        for (const edge of edges) {
          let other = -1
          if (edge.from === i) other = edge.to
          if (edge.to === i) other = edge.from
          if (other < 0) continue

          const dx = nodes[other].x - nodes[i].x
          const dy = nodes[other].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = (dist - springLen) * springK
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }

        // Center gravity
        fx += (p.width / 2 - nodes[i].x) * 0.0005
        fy += (canvasH / 2 - nodes[i].y) * 0.0005

        if (dragRef.current !== i) {
          nodes[i].vx = (nodes[i].vx + fx) * damping
          nodes[i].vy = (nodes[i].vy + fy) * damping
          nodes[i].x += nodes[i].vx
          nodes[i].y += nodes[i].vy

          // Keep in bounds
          nodes[i].x = Math.max(40, Math.min(p.width - 40, nodes[i].x))
          nodes[i].y = Math.max(40, Math.min(canvasH - 40, nodes[i].y))
        }
      }

      // Draw edges
      for (const edge of edges) {
        const from = nodes[edge.from]
        const to = nodes[edge.to]

        // Check if edge is in traversal path
        let edgeActive = false
        if (isTrav && tPath.length > 1) {
          const animIdx = Math.floor(animT * 1.5) % tPath.length
          for (let k = 0; k < Math.min(animIdx, tPath.length - 1); k++) {
            if ((tPath[k] === edge.from && tPath[k + 1] === edge.to) ||
                (tPath[k] === edge.to && tPath[k + 1] === edge.from)) {
              edgeActive = true
            }
          }
          // Also check non-sequential edges that connect visited nodes
          const visitedSoFar = tPath.slice(0, animIdx + 1)
          if (visitedSoFar.includes(edge.from) && visitedSoFar.includes(edge.to)) {
            edgeActive = true
          }
        }

        p.stroke(edgeActive ? 250 : 71, edgeActive ? 204 : 85, edgeActive ? 21 : 105, edgeActive ? 255 : 120)
        p.strokeWeight(edgeActive ? 2.5 : 1.5)
        p.line(from.x, from.y, to.x, to.y)

        // Edge label
        p.noStroke()
        p.fill(100, 116, 139, edgeActive ? 255 : 150)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(edge.label, (from.x + to.x) / 2, (from.y + to.y) / 2 - 8)
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        let nodeActive = false
        if (isTrav) {
          const animIdx = Math.floor(animT * 1.5) % tPath.length
          nodeActive = tPath.slice(0, animIdx + 1).includes(i)
        }

        const radius = node.type === 'person' ? 24 : 20
        const colors: Record<string, [number, number, number]> = {
          person: [99, 102, 241],
          location: [52, 211, 153],
          company: [250, 204, 21],
        }
        const c = colors[node.type] || [148, 163, 184]

        // Glow for active nodes
        if (nodeActive) {
          p.noStroke()
          p.fill(c[0], c[1], c[2], 40)
          p.ellipse(node.x, node.y, radius * 3, radius * 3)
        }

        p.stroke(c[0], c[1], c[2])
        p.strokeWeight(nodeActive ? 3 : 2)
        p.fill(30, 41, 59)
        p.ellipse(node.x, node.y, radius * 2, radius * 2)

        p.noStroke()
        p.fill(c[0], c[1], c[2])
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(node.label, node.x, node.y)
      }

      // Legend
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      const legendY = canvasH - 20
      p.fill(99, 102, 241)
      p.ellipse(10, legendY, 8, 8)
      p.text('Person', 18, legendY)
      p.fill(52, 211, 153)
      p.ellipse(80, legendY, 8, 8)
      p.text('Location', 88, legendY)
      p.fill(250, 204, 21)
      p.ellipse(160, legendY, 8, 8)
      p.text('Company', 168, legendY)

      if (isTrav) {
        p.fill(250, 204, 21)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.BOTTOM)
        p.text('BFS traversal from Alice', p.width - 10, canvasH - 8)
      }
    }

    p.mousePressed = () => {
      const nodes = nodesRef.current
      for (let i = 0; i < nodes.length; i++) {
        const d = p.dist(p.mouseX, p.mouseY, nodes[i].x, nodes[i].y)
        if (d < 25) {
          dragRef.current = i
          return
        }
      }
    }

    p.mouseDragged = () => {
      if (dragRef.current !== null) {
        nodesRef.current[dragRef.current].x = p.mouseX
        nodesRef.current[dragRef.current].y = p.mouseY
        nodesRef.current[dragRef.current].vx = 0
        nodesRef.current[dragRef.current].vy = 0
      }
    }

    p.mouseReleased = () => {
      dragRef.current = null
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300 mt-2">
          <button
            onClick={startTraversal}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            Run BFS Traversal
          </button>
          <button
            onClick={() => { setTraversing(false); setTraversalPath([]) }}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          >
            Reset
          </button>
          <span className="text-gray-500 text-xs">Drag nodes to rearrange. Click BFS to see graph traversal.</span>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function DataModels() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: Relational Model ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Relational Model</h2>

        <p className="mb-4">
          The relational model, proposed by Edgar Codd in 1970, is the most successful data model in
          history. Data is organized into <strong className="text-white">relations</strong> (tables), where
          each relation is an unordered collection of <strong className="text-white">tuples</strong> (rows).
          The key insight: you declare the structure of your data, and the query optimizer figures out
          the best way to execute your query.
        </p>

        <p className="mb-4">
          Relationships between entities are expressed through <strong className="text-white">foreign
          keys</strong> — a column in one table that references the primary key of another. To combine
          data from multiple tables, you use <strong className="text-white">JOIN</strong> operations.
          This is the fundamental operation of the relational model.
        </p>

        <p className="mb-4">
          The visualization below shows three tables: Users, Orders, and Products. Click
          &quot;Show JOIN&quot; to see how a SQL JOIN operation combines data by following foreign key
          relationships. Watch the animated data flow from Users through Orders to Products, producing
          a denormalized result.
        </p>

        <RelationalSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Normalization</h3>

        <p className="mb-4">
          The relational model encourages <strong className="text-white">normalization</strong> — structuring
          data to reduce redundancy. In the example above, the city &quot;SF&quot; is stored once in the
          Users table. If Alice moves to LA, we update one row. In a denormalized model, we would
          need to find and update every occurrence — risky and error-prone.
        </p>

        <p className="mb-4">
          The tradeoff: normalization requires JOINs to reassemble data for queries. JOINs are well
          understood and highly optimized in modern databases, but they do add overhead. When
          read performance is critical and the data rarely changes, strategic denormalization
          (duplicating some data) can be worthwhile.
        </p>
      </section>

      {/* ========== Section 2: Document Model ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Document Model</h2>

        <p className="mb-4">
          Document databases (MongoDB, CouchDB, Firestore) store data as self-contained
          <strong className="text-white"> documents</strong>, typically JSON or BSON. Instead of splitting
          data across multiple tables, a document contains all the information about an entity in one
          place — including nested sub-objects and arrays.
        </p>

        <p className="mb-4">
          The main argument in favor of the document model is <strong className="text-white">schema
          flexibility</strong> (also called schema-on-read): the database does not enforce a schema;
          the structure is implicit in the application code. This is useful when different records
          have different structures, or when the schema evolves frequently.
        </p>

        <p className="mb-4">
          The other major advantage is <strong className="text-white">data locality</strong>. If your
          application needs the entire document at once (a user profile with all their posts, for
          example), a document store can fetch it in a single read. In a relational database, you would
          need multiple queries or a complex JOIN.
        </p>

        <p className="mb-4">
          Toggle between the two models below to see the same data represented both ways:
        </p>

        <DocumentVsRelationalSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">The Convergence</h3>

        <p className="mb-4">
          Relational and document databases are becoming more similar over time. PostgreSQL has excellent
          JSON support (JSONB). MongoDB added multi-document transactions. The choice between them
          increasingly depends on your specific access patterns rather than fundamental capabilities.
        </p>
      </section>

      {/* ========== Section 3: Graph Model ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Graph Model</h2>

        <p className="mb-4">
          When your data has many <strong className="text-white">many-to-many relationships</strong>,
          graphs are the most natural model. A graph consists of <strong className="text-white">vertices</strong>
          (nodes) and <strong className="text-white">edges</strong> (relationships). Both can have properties.
          This is called a <em>property graph</em> model.
        </p>

        <p className="mb-4">
          Graphs excel at answering questions like: &quot;Find all people who live in the same city as
          Alice and work at the same company as Bob.&quot; In a relational database, the number of JOINs
          needed for such traversals is unpredictable — it depends on the data. In a graph database,
          you simply follow edges.
        </p>

        <p className="mb-4">
          The visualization below shows a property graph with people, locations, and companies.
          Drag nodes to rearrange the layout. Click &quot;Run BFS Traversal&quot; to see how a
          breadth-first search visits all reachable nodes from Alice.
        </p>

        <GraphModelSketch />
      </section>

      {/* ========== Section 4: Comparison Table ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">When to Use Each Model</h2>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-white">Criterion</th>
                <th className="text-left py-3 px-4 text-indigo-400">Relational</th>
                <th className="text-left py-3 px-4 text-emerald-400">Document</th>
                <th className="text-left py-3 px-4 text-yellow-400">Graph</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Data relationships', 'Many-to-many via JOINs', '1-to-many (nested)', 'Many-to-many (edges)'],
                ['Schema', 'Schema-on-write (rigid)', 'Schema-on-read (flexible)', 'Flexible'],
                ['Query flexibility', 'Very high (SQL)', 'Good for doc access', 'Great for traversals'],
                ['Data locality', 'Spread across tables', 'Single document', 'Follows edges'],
                ['Transactions', 'Strong (ACID)', 'Single-doc atomic', 'Varies'],
                ['Best for', 'Business data, analytics', 'Content, catalogs, events', 'Social, fraud, knowledge'],
                ['Example DBs', 'PostgreSQL, MySQL', 'MongoDB, CouchDB', 'Neo4j, DGraph'],
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-2.5 px-4 text-white font-medium">{row[0]}</td>
                  <td className="py-2.5 px-4">{row[1]}</td>
                  <td className="py-2.5 px-4">{row[2]}</td>
                  <td className="py-2.5 px-4">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========== Section 5: Query Languages ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Query Languages</h2>

        <p className="mb-4">
          Each data model comes with corresponding query languages. The most important distinction is
          between <strong className="text-white">declarative</strong> and <strong className="text-white">
          imperative</strong> approaches. In a declarative language (SQL, Cypher), you specify <em>what</em>
          you want, and the database figures out <em>how</em> to get it. In an imperative approach,
          you write the algorithm step by step.
        </p>

        <p className="mb-4">
          Here is the same query — &quot;find all people who live in SF&quot; — expressed in three
          different query languages:
        </p>

        <div className="space-y-4 my-6">
          <div className="rounded-lg bg-gray-800/60 border border-indigo-800/40 px-5 py-4">
            <div className="text-indigo-400 text-xs font-semibold mb-2">SQL (Relational)</div>
            <code className="text-sm text-gray-200 font-mono whitespace-pre">{
`SELECT u.name, u.city
FROM users u
WHERE u.city = 'SF';`
            }</code>
          </div>

          <div className="rounded-lg bg-gray-800/60 border border-emerald-800/40 px-5 py-4">
            <div className="text-emerald-400 text-xs font-semibold mb-2">MongoDB Query (Document)</div>
            <code className="text-sm text-gray-200 font-mono whitespace-pre">{
`db.users.find(
  { city: "SF" },
  { name: 1, city: 1 }
)`
            }</code>
          </div>

          <div className="rounded-lg bg-gray-800/60 border border-yellow-800/40 px-5 py-4">
            <div className="text-yellow-400 text-xs font-semibold mb-2">Cypher (Graph — Neo4j)</div>
            <code className="text-sm text-gray-200 font-mono whitespace-pre">{
`MATCH (person:Person)-[:LIVES_IN]->(city:City {name: 'SF'})
RETURN person.name, city.name`
            }</code>
          </div>
        </div>

        <p className="mb-4">
          The declarative approach has a huge advantage: because you only specify the result, not the
          algorithm, the database is free to change the implementation. It can add indexes, reorder
          joins, use parallel execution — all without changing your query. This is why SQL has
          survived for 50+ years while most imperative APIs have not.
        </p>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">MapReduce</h3>

        <p className="mb-4">
          MapReduce is a programming model for processing large amounts of data in bulk across many
          machines. It is neither fully declarative nor fully imperative — it is somewhere in between.
          You write two functions: <code className="text-pink-400">map</code> (extract key-value pairs
          from each record) and <code className="text-pink-400">reduce</code> (combine all values for
          the same key). The framework handles partitioning and distribution.
        </p>

        <p className="mb-4">
          MapReduce has largely been superseded by higher-level declarative query engines (Spark SQL,
          Presto, BigQuery) that compile to distributed execution plans automatically. The principle
          remains important: separate <em>what</em> to compute from <em>how</em> to distribute it.
        </p>
      </section>

      {/* ========== Section 6: Python — Data Modeling Comparison ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Relational vs Document Modeling</h2>

        <p className="mb-4">
          Let us model the same data in both relational (normalized) and document (denormalized) form,
          then compare how different query patterns perform on each.
        </p>

        <PythonCell
          title="Relational vs Document Data Modeling"
          defaultCode={`# Model the same data two ways: relational (normalized) vs document (denormalized)
import json

# === RELATIONAL MODEL (normalized) ===
users = {1: {"name": "Alice", "city": "SF"}, 2: {"name": "Bob", "city": "NYC"}, 3: {"name": "Carol", "city": "SF"}}
positions = [
    {"id": 1, "user_id": 1, "title": "Engineer", "company": "Acme"},
    {"id": 2, "user_id": 1, "title": "Lead", "company": "Acme"},
    {"id": 3, "user_id": 2, "title": "Manager", "company": "Beta"},
    {"id": 4, "user_id": 3, "title": "CTO", "company": "Gamma"},
]
education = [
    {"id": 1, "user_id": 1, "school": "MIT", "degree": "CS"},
    {"id": 2, "user_id": 2, "school": "Stanford", "degree": "MBA"},
    {"id": 3, "user_id": 3, "school": "MIT", "degree": "EE"},
]

print("=== RELATIONAL MODEL ===")
print(f"Tables: users ({len(users)} rows), positions ({len(positions)} rows), education ({len(education)} rows)")

# Query: get Alice's full profile (requires JOIN)
def get_profile_relational(user_id):
    user = users[user_id]
    user_positions = [p for p in positions if p["user_id"] == user_id]
    user_education = [e for e in education if e["user_id"] == user_id]
    return {**user, "positions": user_positions, "education": user_education}

profile = get_profile_relational(1)
print(f"\\nAlice's profile (3 table lookups/JOINs):")
print(json.dumps(profile, indent=2))

# Query: find all MIT graduates (scan education table)
mit_grads = [users[e["user_id"]]["name"] for e in education if e["school"] == "MIT"]
print(f"\\nMIT graduates: {mit_grads}")

# Update: Alice moves to LA (one update)
print(f"\\nUpdate Alice's city: 1 row update")
users[1]["city"] = "LA"

# === DOCUMENT MODEL (denormalized) ===
documents = [
    {"id": 1, "name": "Alice", "city": "SF",
     "positions": [{"title": "Engineer", "company": "Acme"}, {"title": "Lead", "company": "Acme"}],
     "education": [{"school": "MIT", "degree": "CS"}]},
    {"id": 2, "name": "Bob", "city": "NYC",
     "positions": [{"title": "Manager", "company": "Beta"}],
     "education": [{"school": "Stanford", "degree": "MBA"}]},
    {"id": 3, "name": "Carol", "city": "SF",
     "positions": [{"title": "CTO", "company": "Gamma"}],
     "education": [{"school": "MIT", "degree": "EE"}]},
]

print("\\n=== DOCUMENT MODEL ===")
print(f"Collection: {len(documents)} documents")

# Query: get Alice's profile (single document fetch!)
alice_doc = next(d for d in documents if d["name"] == "Alice")
print(f"\\nAlice's profile (1 document fetch):")
print(json.dumps(alice_doc, indent=2))

# Query: find all MIT graduates (must scan all documents)
mit_grads_doc = [d["name"] for d in documents if any(e["school"] == "MIT" for e in d["education"])]
print(f"\\nMIT graduates: {mit_grads_doc}")

# Problem: if company "Acme" renames to "AcmeCorp", must update every document that references it
acme_refs = sum(1 for d in documents for p in d["positions"] if p["company"] == "Acme")
print(f"\\nRename 'Acme' -> 'AcmeCorp': must update {acme_refs} embedded references across documents")
print("In relational model: just 1 update to the companies table")

print("\\n=== KEY TRADEOFF ===")
print("Relational: normalize -> no duplication, but JOIN for reads")
print("Document:   denormalize -> fast reads, but update anomalies")`}
        />
      </section>

      {/* ========== Section 7: Python — Graph Traversal ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Graph Traversal (BFS & DFS)</h2>

        <p className="mb-4">
          Graph databases shine at traversal queries — finding paths, connected components, shortest
          routes. Here we implement both BFS (breadth-first) and DFS (depth-first) on a social graph
          represented as an adjacency list.
        </p>

        <PythonCell
          title="Graph Traversal: BFS & DFS"
          defaultCode={`from collections import deque

# Build a social graph as an adjacency list (property graph style)
graph = {
    "Alice":  {"knows": ["Bob", "Carol", "Dave"], "lives_in": ["SF"], "works_at": ["Acme"]},
    "Bob":    {"knows": ["Alice", "Eve"], "lives_in": ["NYC"], "works_at": ["Acme"]},
    "Carol":  {"knows": ["Alice", "Frank"], "lives_in": ["SF"], "works_at": ["Beta"]},
    "Dave":   {"knows": ["Alice", "Eve", "Frank"], "lives_in": ["LA"], "works_at": ["Gamma"]},
    "Eve":    {"knows": ["Bob", "Dave"], "lives_in": ["NYC"], "works_at": ["Beta"]},
    "Frank":  {"knows": ["Carol", "Dave"], "lives_in": ["LA"], "works_at": ["Gamma"]},
}

print("=== Social Graph ===")
for person, rels in graph.items():
    print(f"  {person}: knows={rels['knows']}, lives_in={rels['lives_in'][0]}, works_at={rels['works_at'][0]}")

# BFS: Find shortest path between two people
def bfs_shortest_path(graph, start, target):
    queue = deque([(start, [start])])
    visited = {start}

    while queue:
        current, path = queue.popleft()
        if current == target:
            return path

        for neighbor in graph.get(current, {}).get("knows", []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))

    return None  # not reachable

print("\\n=== BFS: Shortest Paths ===")
for target in ["Bob", "Eve", "Frank"]:
    path = bfs_shortest_path(graph, "Alice", target)
    print(f"  Alice -> {target}: {' -> '.join(path)} (distance: {len(path)-1})")

# DFS: Find all people within N hops
def dfs_within_hops(graph, start, max_hops):
    result = {}
    stack = [(start, 0)]
    visited = set()

    while stack:
        current, depth = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        result[current] = depth

        if depth < max_hops:
            for neighbor in graph.get(current, {}).get("knows", []):
                if neighbor not in visited:
                    stack.append((neighbor, depth + 1))

    return result

print("\\n=== DFS: People within N hops of Alice ===")
for hops in [1, 2, 3]:
    reachable = dfs_within_hops(graph, "Alice", hops)
    people = [f"{name}(d={d})" for name, d in sorted(reachable.items(), key=lambda x: x[1]) if name != "Alice"]
    print(f"  {hops} hop(s): {', '.join(people)}")

# Graph query: "Find people who live in the same city as Alice and work at a different company"
alice_city = graph["Alice"]["lives_in"][0]
alice_company = graph["Alice"]["works_at"][0]
matches = [
    name for name, rels in graph.items()
    if name != "Alice"
    and rels["lives_in"][0] == alice_city
    and rels["works_at"][0] != alice_company
]
print(f"\\n=== Graph Query ===")
print(f"People in {alice_city} who don't work at {alice_company}: {matches}")
print("In SQL this would require: SELECT + JOIN users, locations, companies + WHERE")
print("In Cypher: MATCH (a)-[:LIVES_IN]->(c)<-[:LIVES_IN]-(b) WHERE ... RETURN b")

# Connected components
def find_components(graph):
    visited = set()
    components = []
    for node in graph:
        if node not in visited:
            component = []
            stack = [node]
            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                component.append(current)
                for neighbor in graph.get(current, {}).get("knows", []):
                    if neighbor not in visited:
                        stack.append(neighbor)
            components.append(component)
    return components

components = find_components(graph)
print(f"\\nConnected components: {len(components)}")
for i, comp in enumerate(components):
    print(f"  Component {i}: {comp}")`}
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
                The <strong className="text-white">relational model</strong> organizes data into tables
                with foreign key relationships. It excels at complex queries, many-to-many relationships,
                and data consistency through normalization.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>
                The <strong className="text-white">document model</strong> stores self-contained nested
                documents. It offers schema flexibility and data locality but struggles with many-to-many
                relationships and cross-document consistency.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>
                The <strong className="text-white">graph model</strong> represents entities as nodes and
                relationships as edges. It is the natural choice when relationships are the primary
                object of interest — social networks, fraud detection, knowledge graphs.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">4.</span>
              <span>
                <strong className="text-white">Declarative query languages</strong> (SQL, Cypher) let
                the database optimize execution. This separation of &quot;what&quot; from &quot;how&quot;
                is one of the most powerful ideas in computer science.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">5.</span>
              <span>
                The boundaries are blurring: relational databases add JSON support, document databases
                add JOINs and transactions. Choose based on your primary <strong className="text-white">
                access patterns</strong>, not ideology.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </article>
  )
}
