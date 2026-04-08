import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/vectors',
  title: 'Vectors & Spaces',
  description: 'Explore vectors as both geometric arrows and numeric arrays — the backbone of all ML data.',
  track: 'foundations',
  order: 1,
  tags: ['vectors', 'linear-algebra', 'dot-product', 'projection', 'numpy'],
}

/* ------------------------------------------------------------------ */
/* Section 1 — Draggable 2D Vector                                     */
/* ------------------------------------------------------------------ */

function DraggableVectorSketch() {
  const vecRef = useRef({ x: 3, y: -2 })
  const draggingRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const SCALE = 40
    let originX = 0
    let originY = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 400)
      originX = pw / 2
      originY = 200
    }

    function worldToScreen(wx: number, wy: number): [number, number] {
      return [originX + wx * SCALE, originY - wy * SCALE]
    }

    function screenToWorld(sx: number, sy: number): [number, number] {
      return [(sx - originX) / SCALE, -(sy - originY) / SCALE]
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const v = vecRef.current

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = -10; gx <= 10; gx++) {
        const sx = originX + gx * SCALE
        p.line(sx, 0, sx, p.height)
      }
      for (let gy = -6; gy <= 6; gy++) {
        const sy = originY - gy * SCALE
        p.line(0, sy, p.width, sy)
      }

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(0, originY, p.width, originY)
      p.line(originX, 0, originX, p.height)

      // Axis labels
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      for (let gx = -8; gx <= 8; gx++) {
        if (gx === 0) continue
        p.text(String(gx), originX + gx * SCALE, originY + 4)
      }
      p.textAlign(p.RIGHT, p.CENTER)
      for (let gy = -4; gy <= 4; gy++) {
        if (gy === 0) continue
        p.text(String(gy), originX - 6, originY - gy * SCALE)
      }

      // Draw vector arrow
      const [tipX, tipY] = worldToScreen(v.x, v.y)
      p.stroke(56, 189, 248)
      p.strokeWeight(3)
      p.line(originX, originY, tipX, tipY)

      // Arrowhead
      const angle = Math.atan2(originY - tipY, tipX - originX)
      const headLen = 12
      p.fill(56, 189, 248)
      p.noStroke()
      p.triangle(
        tipX,
        tipY,
        tipX - headLen * Math.cos(angle - 0.35),
        tipY + headLen * Math.sin(angle - 0.35),
        tipX - headLen * Math.cos(angle + 0.35),
        tipY + headLen * Math.sin(angle + 0.35)
      )

      // Label
      p.fill(255)
      p.noStroke()
      p.textSize(16)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`v = [${v.x.toFixed(1)}, ${v.y.toFixed(1)}]`, tipX + 10, tipY - 6)

      // Magnitude
      const mag = Math.sqrt(v.x * v.x + v.y * v.y)
      p.fill(148, 163, 184)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`|v| = ${mag.toFixed(2)}`, 14, 14)

      // Drag hint
      p.fill(100, 116, 139)
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Drag the arrow tip to move the vector', p.width / 2, p.height - 8)
    }

    p.mousePressed = () => {
      const [tipX, tipY] = worldToScreen(vecRef.current.x, vecRef.current.y)
      if (p.dist(p.mouseX, p.mouseY, tipX, tipY) < 20) {
        draggingRef.current = true
      }
    }

    p.mouseDragged = () => {
      if (!draggingRef.current) return
      const [wx, wy] = screenToWorld(p.mouseX, p.mouseY)
      vecRef.current = {
        x: Math.round(wx * 2) / 2,
        y: Math.round(wy * 2) / 2,
      }
    }

    p.mouseReleased = () => {
      draggingRef.current = false
    }
  }, [])

  return <P5Sketch sketch={sketch} height={400} />
}

/* ------------------------------------------------------------------ */
/* Section 2 — Vector Addition / Scalar Multiplication                 */
/* ------------------------------------------------------------------ */

function VectorOpsSketch() {
  const [scalar, setScalar] = useState(1.5)
  const [showAdd, setShowAdd] = useState(true)

  const scalarRef = useRef(scalar)
  scalarRef.current = scalar
  const showAddRef = useRef(showAdd)
  showAddRef.current = showAdd

  const sketch = useCallback((p: p5) => {
    const SCALE = 40
    let originX = 0
    let originY = 0

    const vecA = { x: 2, y: 3 }
    const vecB = { x: 3, y: -1 }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 380)
      originX = pw / 2
      originY = 200
    }

    function w2s(wx: number, wy: number): [number, number] {
      return [originX + wx * SCALE, originY - wy * SCALE]
    }

    function drawArrow(
      fx: number, fy: number, tx: number, ty: number,
      r: number, g: number, b: number, label: string
    ) {
      const [sfx, sfy] = w2s(fx, fy)
      const [stx, sty] = w2s(tx, ty)
      p.stroke(r, g, b)
      p.strokeWeight(2.5)
      p.line(sfx, sfy, stx, sty)

      const angle = Math.atan2(sfy - sty, stx - sfx)
      const hl = 10
      p.fill(r, g, b)
      p.noStroke()
      p.triangle(
        stx, sty,
        stx - hl * Math.cos(angle - 0.35), sty + hl * Math.sin(angle - 0.35),
        stx - hl * Math.cos(angle + 0.35), sty + hl * Math.sin(angle + 0.35)
      )
      p.textSize(14)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(label, stx + 6, sty - 4)
    }

    p.draw = () => {
      p.background(15, 23, 42)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = -10; gx <= 10; gx++) p.line(originX + gx * SCALE, 0, originX + gx * SCALE, p.height)
      for (let gy = -6; gy <= 6; gy++) p.line(0, originY - gy * SCALE, p.width, originY - gy * SCALE)

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(0, originY, p.width, originY)
      p.line(originX, 0, originX, p.height)

      if (showAddRef.current) {
        // Vector addition with parallelogram
        drawArrow(0, 0, vecA.x, vecA.y, 56, 189, 248, 'a')
        drawArrow(0, 0, vecB.x, vecB.y, 250, 204, 21, 'b')

        // Dashed parallelogram sides
        p.stroke(100, 116, 139, 120)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([5, 5])
        const [ax, ay] = w2s(vecA.x, vecA.y)
        const [bx, by] = w2s(vecB.x, vecB.y)
        const [sx, sy] = w2s(vecA.x + vecB.x, vecA.y + vecB.y)
        p.line(ax, ay, sx, sy)
        p.line(bx, by, sx, sy)
        ctx.setLineDash([])

        // Sum vector
        drawArrow(0, 0, vecA.x + vecB.x, vecA.y + vecB.y, 52, 211, 153, 'a + b')

        p.fill(148, 163, 184)
        p.noStroke()
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`a = [${vecA.x}, ${vecA.y}]   b = [${vecB.x}, ${vecB.y}]   a+b = [${vecA.x + vecB.x}, ${vecA.y + vecB.y}]`, 14, 14)
      } else {
        // Scalar multiplication
        const s = scalarRef.current
        drawArrow(0, 0, vecA.x, vecA.y, 56, 189, 248, 'a')
        drawArrow(0, 0, vecA.x * s, vecA.y * s, 250, 204, 21, `${s.toFixed(1)} a`)

        p.fill(148, 163, 184)
        p.noStroke()
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`a = [${vecA.x}, ${vecA.y}]   ${s.toFixed(1)}a = [${(vecA.x * s).toFixed(1)}, ${(vecA.y * s).toFixed(1)}]`, 14, 14)
      }
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={380} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <button
          onClick={() => setShowAdd(true)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            showAdd ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Addition
        </button>
        <button
          onClick={() => setShowAdd(false)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            !showAdd ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Scalar Mult
        </button>
        {!showAdd && (
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Scalar: {scalar.toFixed(1)}
            <input
              type="range"
              min={-2}
              max={3}
              step={0.1}
              value={scalar}
              onChange={(e) => setScalar(Number(e.target.value))}
              className="w-40 accent-sky-500"
            />
          </label>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Dot Product & Projection                                */
/* ------------------------------------------------------------------ */

function DotProductSketch() {
  const vecBRef = useRef({ x: 4, y: 1 })
  const draggingRef = useRef(false)

  const sketch = useCallback((p: p5) => {
    const SCALE = 45
    let originX = 0
    let originY = 0
    const vecA = { x: 3, y: 2 }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 400)
      originX = pw * 0.3
      originY = 280
    }

    function w2s(wx: number, wy: number): [number, number] {
      return [originX + wx * SCALE, originY - wy * SCALE]
    }
    function s2w(sx: number, sy: number): [number, number] {
      return [(sx - originX) / SCALE, -(sy - originY) / SCALE]
    }

    function drawArrow(
      fx: number, fy: number, tx: number, ty: number,
      r: number, g: number, b: number, weight: number
    ) {
      const [sfx, sfy] = w2s(fx, fy)
      const [stx, sty] = w2s(tx, ty)
      p.stroke(r, g, b)
      p.strokeWeight(weight)
      p.line(sfx, sfy, stx, sty)
      const angle = Math.atan2(sfy - sty, stx - sfx)
      const hl = 10
      p.fill(r, g, b)
      p.noStroke()
      p.triangle(
        stx, sty,
        stx - hl * Math.cos(angle - 0.35), sty + hl * Math.sin(angle - 0.35),
        stx - hl * Math.cos(angle + 0.35), sty + hl * Math.sin(angle + 0.35)
      )
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const b = vecBRef.current

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let gx = -4; gx <= 10; gx++) p.line(originX + gx * SCALE, 0, originX + gx * SCALE, p.height)
      for (let gy = -3; gy <= 6; gy++) p.line(0, originY - gy * SCALE, p.width, originY - gy * SCALE)

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1)
      p.line(0, originY, p.width, originY)
      p.line(originX, 0, originX, p.height)

      // Compute dot product and projection
      const dot = vecA.x * b.x + vecA.y * b.y
      const magA = Math.sqrt(vecA.x * vecA.x + vecA.y * vecA.y)
      const magB = Math.sqrt(b.x * b.x + b.y * b.y)
      const cosTheta = dot / (magA * magB + 1e-9)
      const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180) / Math.PI

      // Projection of b onto a
      const projScalar = dot / (magA * magA)
      const projX = vecA.x * projScalar
      const projY = vecA.y * projScalar

      // Draw projection dashed line
      const [psx, psy] = w2s(projX, projY)
      const [bsx, bsy] = w2s(b.x, b.y)
      p.stroke(148, 163, 184, 100)
      p.strokeWeight(1)
      const ctx2 = p.drawingContext as CanvasRenderingContext2D
      ctx2.setLineDash([4, 4])
      p.line(bsx, bsy, psx, psy)
      ctx2.setLineDash([])

      // Projection point
      p.fill(250, 204, 21)
      p.noStroke()
      p.ellipse(psx, psy, 8, 8)

      // Draw projection vector
      drawArrow(0, 0, projX, projY, 250, 204, 21, 2)

      // Draw vectors
      drawArrow(0, 0, vecA.x, vecA.y, 56, 189, 248, 3)
      drawArrow(0, 0, b.x, b.y, 52, 211, 153, 3)

      // Labels
      p.noStroke()
      p.textSize(14)
      const [atx, aty] = w2s(vecA.x, vecA.y)
      p.fill(56, 189, 248)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('a', atx + 8, aty - 4)

      p.fill(52, 211, 153)
      p.text('b (drag me)', bsx + 8, bsy - 4)

      p.fill(250, 204, 21)
      p.textAlign(p.LEFT, p.TOP)
      p.text('proj', psx + 8, psy + 4)

      // Angle arc
      const arcR = 30
      const angleA = Math.atan2(vecA.y, vecA.x)
      const angleB = Math.atan2(b.y, b.x)
      p.noFill()
      p.stroke(250, 204, 21, 180)
      p.strokeWeight(1.5)
      p.arc(originX, originY, arcR * 2, arcR * 2, -Math.max(angleA, angleB), -Math.min(angleA, angleB))

      // Info panel
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      const info = [
        `a = [${vecA.x}, ${vecA.y}]    b = [${b.x.toFixed(1)}, ${b.y.toFixed(1)}]`,
        `a . b = ${dot.toFixed(2)}`,
        `angle = ${angleDeg.toFixed(1)} degrees`,
        `proj_a(b) = [${projX.toFixed(2)}, ${projY.toFixed(2)}]`,
      ]
      info.forEach((line, i) => {
        p.fill(i === 0 ? 255 : 190)
        p.text(line, 14, 14 + i * 22)
      })
    }

    p.mousePressed = () => {
      const [bsx, bsy] = w2s(vecBRef.current.x, vecBRef.current.y)
      if (p.dist(p.mouseX, p.mouseY, bsx, bsy) < 20) {
        draggingRef.current = true
      }
    }

    p.mouseDragged = () => {
      if (!draggingRef.current) return
      const [wx, wy] = s2w(p.mouseX, p.mouseY)
      vecBRef.current = { x: Math.round(wx * 2) / 2, y: Math.round(wy * 2) / 2 }
    }

    p.mouseReleased = () => {
      draggingRef.current = false
    }
  }, [])

  return <P5Sketch sketch={sketch} height={400} />
}

/* ------------------------------------------------------------------ */
/* Python cells                                                        */
/* ------------------------------------------------------------------ */

const numpyVectorsCode = `import numpy as np

# Create vectors
a = np.array([3, 2])
b = np.array([4, 1])

# Basic operations
print("a + b =", a + b)
print("2 * a =", 2 * a)
print("Dot product:", np.dot(a, b))
print("Magnitude of a:", np.linalg.norm(a))

# Angle between vectors (degrees)
cos_theta = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
angle_deg = np.degrees(np.arccos(cos_theta))
print(f"Angle between a and b: {angle_deg:.1f} degrees")

# Projection of b onto a
proj_scalar = np.dot(a, b) / np.dot(a, a)
proj = proj_scalar * a
print(f"Projection of b onto a: {proj}")
`

const highDimCode = `import numpy as np

# In ML, data points are high-dimensional vectors
# Example: a "feature vector" for a house
house = np.array([1500, 3, 2, 1, 2005, 0.25])
# [sqft, bedrooms, bathrooms, garage, year, lot_acres]

# Cosine similarity — used everywhere in ML
def cosine_similarity(u, v):
    return np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v))

# Two similar houses
house_a = np.array([1500, 3, 2, 1, 2005, 0.25])
house_b = np.array([1600, 3, 2, 1, 2008, 0.30])

# A very different house
house_c = np.array([5000, 6, 5, 3, 1920, 2.0])

print(f"Similarity(A, B) = {cosine_similarity(house_a, house_b):.4f}")
print(f"Similarity(A, C) = {cosine_similarity(house_a, house_c):.4f}")
print("Similar houses have cosine similarity near 1.0")

# Unit vectors — used for directions
direction = np.array([3, 4])
unit = direction / np.linalg.norm(direction)
print(f"\\nUnit vector of [3,4]: {unit}")
print(f"Its magnitude: {np.linalg.norm(unit):.1f}")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Vectors() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* ----- Title ----- */}
      <header>
        <h1 className="text-4xl font-bold text-white">Vectors &amp; Spaces</h1>
        <p className="mt-3 text-lg text-gray-300">
          Every dataset in machine learning is a collection of vectors. Images, sentences, user
          profiles — they are all represented as ordered lists of numbers that live in
          high-dimensional spaces. Before we can train models, we need to build intuition for
          what vectors <em>are</em>, how they combine, and what geometry they encode.
        </p>
      </header>

      {/* ----- Section 1: What is a Vector ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">What Is a Vector?</h2>
        <p className="text-gray-300">
          A vector is an ordered list of numbers — but it is also a geometric object: an arrow in
          space with a direction and a magnitude. The vector <code className="text-sky-400">[3, -2]</code>{' '}
          tells us &ldquo;go 3 units right and 2 units down.&rdquo; Its magnitude (length) is{' '}
          <code className="text-sky-400">&radic;(3&sup2;+2&sup2;) &asymp; 3.61</code>.
        </p>
        <p className="text-gray-300">
          Drag the tip of the vector below to see how its components and magnitude change
          in real time. Notice that the vector always starts at the origin — in linear
          algebra we typically think of vectors as displacements from the origin.
        </p>
        <DraggableVectorSketch />
      </section>

      {/* ----- Section 2: Vector Operations ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Vector Operations</h2>
        <p className="text-gray-300">
          The two fundamental operations on vectors are <strong className="text-white">addition</strong> and{' '}
          <strong className="text-white">scalar multiplication</strong>. Together they give us
          every linear combination — and linear combinations are the beating heart of linear
          algebra and machine learning.
        </p>
        <h3 className="text-lg font-medium text-white">Addition (Parallelogram Rule)</h3>
        <p className="text-gray-300">
          To add two vectors, place them tail-to-tip. The result goes from the tail of the first
          to the tip of the second. Equivalently, complete the parallelogram formed by the two
          vectors — the diagonal is the sum. Toggle between addition and scalar multiplication
          below.
        </p>
        <h3 className="text-lg font-medium text-white">Scalar Multiplication</h3>
        <p className="text-gray-300">
          Multiplying a vector by a scalar stretches or shrinks it. A negative scalar also
          reverses its direction. Move the slider to see how the vector scales continuously.
        </p>
        <VectorOpsSketch />
      </section>

      {/* ----- Section 3: Dot Product & Projections ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Dot Product &amp; Projections</h2>
        <p className="text-gray-300">
          The dot product <code className="text-sky-400">a &middot; b = a&#8321;b&#8321; + a&#8322;b&#8322;</code>{' '}
          is a single number that encodes how much two vectors &ldquo;agree.&rdquo; When the
          dot product is positive the vectors point roughly in the same direction; when it is
          negative they point in opposite directions; when it is zero they are perpendicular.
        </p>
        <p className="text-gray-300">
          The dot product also gives us the <strong className="text-white">projection</strong> —
          the shadow of one vector onto another. The projection of <strong>b</strong> onto{' '}
          <strong>a</strong> is the component of <strong>b</strong> in the direction of{' '}
          <strong>a</strong>. Drag the green vector below to explore projections and angles.
        </p>
        <DotProductSketch />
      </section>

      {/* ----- Section 4: Basis Vectors ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Basis Vectors</h2>
        <p className="text-gray-300">
          A <strong className="text-white">basis</strong> is a set of vectors that can represent
          every other vector in the space through linear combinations. In 2D the standard basis
          is <code className="text-sky-400">e&#8321; = [1, 0]</code> and{' '}
          <code className="text-sky-400">e&#8322; = [0, 1]</code>. Any 2D vector{' '}
          <code className="text-sky-400">[a, b]</code> is simply{' '}
          <code className="text-sky-400">a&middot;e&#8321; + b&middot;e&#8322;</code>.
        </p>
        <p className="text-gray-300">
          The concept scales directly to n dimensions. In machine learning, features form a
          natural basis: each feature axis is one dimension. Techniques like PCA find new bases
          that better capture the variance in data — essentially rotating the coordinate system
          to align with the most informative directions.
        </p>
        <p className="text-gray-300">
          Key properties of a basis: the vectors must be <strong className="text-white">linearly
          independent</strong> (no vector can be written as a combination of the others) and they
          must <strong className="text-white">span</strong> the entire space (any vector can be
          reached). In n-dimensional space you need exactly n basis vectors.
        </p>
      </section>

      {/* ----- Section 5: Why Vectors in ML ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Why Vectors Matter in ML</h2>
        <p className="text-gray-300">
          Machine learning models operate on numbers — and vectors are how we organize those
          numbers. Here are a few concrete examples:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-gray-300">
          <li>
            <strong className="text-white">Feature vectors:</strong> Each data point (a house, an
            image, a user) is encoded as a vector of features.
          </li>
          <li>
            <strong className="text-white">Word embeddings:</strong> NLP models map words to
            300-dimensional vectors where similar words are close together.
          </li>
          <li>
            <strong className="text-white">Gradient vectors:</strong> The gradient of a loss
            function is a vector pointing in the direction of steepest increase — we move
            opposite to it during training.
          </li>
          <li>
            <strong className="text-white">Weight vectors:</strong> Linear models learn a weight
            vector; prediction is simply a dot product between weights and input features.
          </li>
        </ul>
      </section>

      {/* ----- Python 1 ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: NumPy Vectors</h2>
        <p className="text-gray-300">
          NumPy is the standard library for numerical computing in Python. Run the cell below to
          practice vector operations — addition, scaling, dot products, magnitudes, and the angle
          between vectors.
        </p>
        <PythonCell defaultCode={numpyVectorsCode} title="NumPy Vector Operations" />
      </section>

      {/* ----- Python 2 ----- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Vectors in Practice</h2>
        <p className="text-gray-300">
          In real ML pipelines, data points are vectors with many dimensions. Cosine similarity
          is one of the most common ways to measure how &ldquo;similar&rdquo; two data points
          are — it measures the angle between them, ignoring magnitude. Run the cell below
          to see it in action.
        </p>
        <PythonCell defaultCode={highDimCode} title="High-Dimensional Vectors & Cosine Similarity" />
      </section>

      {/* ----- Summary ----- */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>A vector is an ordered list of numbers — geometrically, an arrow with magnitude and direction.</li>
          <li>Addition (parallelogram rule) and scalar multiplication produce every linear combination.</li>
          <li>The dot product measures alignment and gives projections.</li>
          <li>Basis vectors span a space; every vector is a unique combination of them.</li>
          <li>ML data is fundamentally a collection of high-dimensional vectors.</li>
        </ul>
      </section>
    </div>
  )
}
