import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/gradients',
  title: 'Partial Derivatives & Gradients',
  description: 'From single-variable derivatives to multivariable gradients — the compass that guides every ML optimizer.',
  track: 'foundations',
  order: 4,
  tags: ['gradients', 'partial-derivatives', 'gradient-descent', 'optimization', 'contour'],
}

/* ------------------------------------------------------------------ */
/* Loss surface function                                               */
/* ------------------------------------------------------------------ */

// f(x, y) = x^2 + 2*y^2  (simple bowl)
const lossFn = (x: number, y: number) => x * x + 2 * y * y
const gradX = (x: number, _y: number) => 2 * x
const gradY = (_x: number, y: number) => 4 * y

/* ------------------------------------------------------------------ */
/* Section 1 — Contour Plot with Gradient Arrows                       */
/* ------------------------------------------------------------------ */

function ContourGradientSketch() {
  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 420
    const PAD = 40
    const xMin = -4, xMax = 4, yMin = -3, yMax = 3

    function mapX(x: number) { return PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD) }
    function mapY(y: number) { return H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD) }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)

      // Contour fills
      const resolution = 4
      for (let sx = PAD; sx < W - PAD; sx += resolution) {
        for (let sy = PAD; sy < H - PAD; sy += resolution) {
          const wx = xMin + ((sx - PAD) / (W - 2 * PAD)) * (xMax - xMin)
          const wy = yMax - ((sy - PAD) / (H - 2 * PAD)) * (yMax - yMin)
          const val = lossFn(wx, wy)
          const maxVal = 30
          const t = Math.min(val / maxVal, 1)
          // Color: dark blue (low) to yellow (high)
          const r = Math.floor(15 + t * 200)
          const g = Math.floor(23 + t * 180)
          const b = Math.floor(80 - t * 40)
          p.fill(r, g, b)
          p.noStroke()
          p.rect(sx, sy, resolution, resolution)
        }
      }

      // Contour lines
      const levels = [1, 2, 4, 8, 12, 18, 25]
      p.noFill()
      p.strokeWeight(1)
      for (const level of levels) {
        p.stroke(255, 255, 255, 40)
        // March around the contour using parametric ellipse for x^2 + 2y^2 = level
        const rx = Math.sqrt(level)
        const ry = Math.sqrt(level / 2)
        p.beginShape()
        for (let angle = 0; angle <= p.TWO_PI + 0.1; angle += 0.05) {
          const wx = rx * Math.cos(angle)
          const wy = ry * Math.sin(angle)
          p.vertex(mapX(wx), mapY(wy))
        }
        p.endShape()
      }

      // Gradient arrows on a grid
      const arrowScale = 8
      for (let gx = -3; gx <= 3; gx += 1) {
        for (let gy = -2; gy <= 2; gy += 1) {
          if (gx === 0 && gy === 0) continue
          const dx = gradX(gx, gy)
          const dy = gradY(gx, gy)
          const mag = Math.sqrt(dx * dx + dy * dy)
          if (mag < 0.01) continue
          const nx = dx / mag
          const ny = dy / mag
          const len = Math.min(mag, 6) * arrowScale

          const sx = mapX(gx)
          const sy = mapY(gy)
          const ex = sx + nx * len * ((xMax - xMin) / (W - 2 * PAD)) * (W - 2 * PAD) / (xMax - xMin)
          const ey = sy - ny * len * ((yMax - yMin) / (H - 2 * PAD)) * (H - 2 * PAD) / (yMax - yMin)

          // Normalize in screen space
          const sdx = ex - sx
          const sdy = ey - sy
          const smag = Math.sqrt(sdx * sdx + sdy * sdy)
          const maxLen = 25
          const finalLen = Math.min(smag, maxLen)
          const fex = sx + (sdx / smag) * finalLen
          const fey = sy + (sdy / smag) * finalLen

          p.stroke(248, 113, 113, 200)
          p.strokeWeight(1.5)
          p.line(sx, sy, fex, fey)

          // Arrowhead
          const aAngle = Math.atan2(fey - sy, fex - sx)
          const hl = 5
          p.line(fex, fey, fex - hl * Math.cos(aAngle - 0.4), fey - hl * Math.sin(aAngle - 0.4))
          p.line(fex, fey, fex - hl * Math.cos(aAngle + 0.4), fey - hl * Math.sin(aAngle + 0.4))
        }
      }

      // Minimum marker
      p.fill(52, 211, 153)
      p.noStroke()
      p.ellipse(mapX(0), mapY(0), 10, 10)

      // Hover info
      if (p.mouseX > PAD && p.mouseX < W - PAD && p.mouseY > PAD && p.mouseY < H - PAD) {
        const wx = xMin + ((p.mouseX - PAD) / (W - 2 * PAD)) * (xMax - xMin)
        const wy = yMax - ((p.mouseY - PAD) / (H - 2 * PAD)) * (yMax - yMin)
        const val = lossFn(wx, wy)
        const gx = gradX(wx, wy)
        const gy = gradY(wx, wy)
        p.fill(255)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`(${wx.toFixed(2)}, ${wy.toFixed(2)})  f = ${val.toFixed(2)}  grad = [${gx.toFixed(2)}, ${gy.toFixed(2)}]`, 14, 14)
      }

      // Labels
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('f(x,y) = x\u00B2 + 2y\u00B2', 14, H - 8)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text('Red arrows = gradient (steepest ascent) | Green dot = minimum', W - 14, H - 8)
    }
  }, [])

  return <P5Sketch sketch={sketch} height={420} />
}

/* ------------------------------------------------------------------ */
/* Section 2 — Gradient Descent Animation                              */
/* ------------------------------------------------------------------ */

function GradientDescentSketch() {
  const [lr, setLr] = useState(0.1)
  const [running, setRunning] = useState(false)
  const lrRef = useRef(lr)
  lrRef.current = lr
  const runningRef = useRef(running)
  runningRef.current = running
  const pathRef = useRef<{ x: number; y: number }[]>([{ x: 3.5, y: 2.5 }])

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 420
    const PAD = 40
    const xMin = -4, xMax = 4, yMin = -3, yMax = 3

    function mapX(x: number) { return PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD) }
    function mapY(y: number) { return H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD) }

    let frameCount = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frameCount++

      // Step gradient descent
      if (runningRef.current && frameCount % 8 === 0 && pathRef.current.length < 200) {
        const last = pathRef.current[pathRef.current.length - 1]
        const lr = lrRef.current
        const gx = gradX(last.x, last.y)
        const gy = gradY(last.x, last.y)
        const nx = last.x - lr * gx
        const ny = last.y - lr * gy
        pathRef.current.push({ x: nx, y: ny })
      }

      // Contour fills
      const resolution = 5
      for (let sx = PAD; sx < W - PAD; sx += resolution) {
        for (let sy = PAD; sy < H - PAD; sy += resolution) {
          const wx = xMin + ((sx - PAD) / (W - 2 * PAD)) * (xMax - xMin)
          const wy = yMax - ((sy - PAD) / (H - 2 * PAD)) * (yMax - yMin)
          const val = lossFn(wx, wy)
          const t = Math.min(val / 30, 1)
          const r = Math.floor(15 + t * 200)
          const g = Math.floor(23 + t * 180)
          const b = Math.floor(80 - t * 40)
          p.fill(r, g, b)
          p.noStroke()
          p.rect(sx, sy, resolution, resolution)
        }
      }

      // Contour lines
      const levels = [1, 2, 4, 8, 12, 18, 25]
      p.noFill()
      p.strokeWeight(1)
      for (const level of levels) {
        p.stroke(255, 255, 255, 35)
        const rx = Math.sqrt(level)
        const ry = Math.sqrt(level / 2)
        p.beginShape()
        for (let angle = 0; angle <= p.TWO_PI + 0.1; angle += 0.05) {
          p.vertex(mapX(rx * Math.cos(angle)), mapY(ry * Math.sin(angle)))
        }
        p.endShape()
      }

      // Path
      const path = pathRef.current
      if (path.length > 1) {
        p.stroke(250, 204, 21, 200)
        p.strokeWeight(2)
        for (let i = 0; i < path.length - 1; i++) {
          p.line(mapX(path[i].x), mapY(path[i].y), mapX(path[i + 1].x), mapY(path[i + 1].y))
        }
      }

      // Draw points along path
      for (let i = 0; i < path.length; i++) {
        const alpha = i === path.length - 1 ? 255 : 100
        p.fill(250, 204, 21, alpha)
        p.noStroke()
        const size = i === path.length - 1 ? 10 : 5
        p.ellipse(mapX(path[i].x), mapY(path[i].y), size, size)
      }

      // Minimum marker
      p.fill(52, 211, 153)
      p.noStroke()
      p.ellipse(mapX(0), mapY(0), 8, 8)

      // Info
      const last = path[path.length - 1]
      const val = lossFn(last.x, last.y)
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Step ${path.length - 1}   pos = (${last.x.toFixed(3)}, ${last.y.toFixed(3)})   loss = ${val.toFixed(4)}`, 14, 14)
      p.text(`Learning rate: ${lrRef.current.toFixed(3)}`, 14, 34)
    }
  }, [])

  const handleReset = useCallback(() => {
    pathRef.current = [{ x: 3.5, y: 2.5 }]
    setRunning(false)
    runningRef.current = false
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={420} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <button
          onClick={() => { setRunning(!running); runningRef.current = !running }}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={handleReset}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
        >
          Reset
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          LR: {lr.toFixed(3)}
          <input type="range" min={0.001} max={0.5} step={0.001} value={lr}
            onChange={(e) => { setLr(Number(e.target.value)); lrRef.current = Number(e.target.value) }}
            className="w-40 accent-emerald-400" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Learning Rate Comparison (3 side-by-side)               */
/* ------------------------------------------------------------------ */

function LRComparisonSketch() {
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const pathsRef = useRef<{ x: number; y: number }[][]>([
    [{ x: 3.5, y: 2.5 }],
    [{ x: 3.5, y: 2.5 }],
    [{ x: 3.5, y: 2.5 }],
  ])
  const lrs = [0.01, 0.1, 0.45]

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 280
    const PAD = 8
    const GAP = 12
    const xMin = -4, xMax = 4, yMin = -3, yMax = 3

    let frameCount = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frameCount++

      const panelW = (W - 2 * GAP - 2 * PAD) / 3

      // Step all three
      if (playingRef.current && frameCount % 6 === 0) {
        for (let i = 0; i < 3; i++) {
          const path = pathsRef.current[i]
          if (path.length >= 300) continue
          const last = path[path.length - 1]
          const lr = lrs[i]
          const gx = gradX(last.x, last.y)
          const gy = gradY(last.x, last.y)
          const nx = last.x - lr * gx
          const ny = last.y - lr * gy
          path.push({ x: nx, y: ny })
        }
      }

      for (let panel = 0; panel < 3; panel++) {
        const ox = PAD + panel * (panelW + GAP)

        const mapXp = (x: number) => ox + ((x - xMin) / (xMax - xMin)) * panelW
        const mapYp = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD - 30)

        // Background contours
        const res = 6
        for (let sx = ox; sx < ox + panelW; sx += res) {
          for (let sy = 30; sy < H - PAD; sy += res) {
            const wx = xMin + ((sx - ox) / panelW) * (xMax - xMin)
            const wy = yMax - ((sy - 30) / (H - PAD - 30)) * (yMax - yMin)
            const val = lossFn(wx, wy)
            const t = Math.min(val / 30, 1)
            p.fill(15 + t * 180, 23 + t * 160, 80 - t * 40)
            p.noStroke()
            p.rect(sx, sy, res, res)
          }
        }

        // Path
        const path = pathsRef.current[panel]
        if (path.length > 1) {
          p.stroke(250, 204, 21, 200)
          p.strokeWeight(1.5)
          for (let i = 0; i < path.length - 1; i++) {
            p.line(mapXp(path[i].x), mapYp(path[i].y), mapXp(path[i + 1].x), mapYp(path[i + 1].y))
          }
        }
        const last = path[path.length - 1]
        p.fill(250, 204, 21)
        p.noStroke()
        p.ellipse(mapXp(last.x), mapYp(last.y), 8, 8)

        // Title
        const lossVal = lossFn(last.x, last.y)
        p.fill(255)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`lr = ${lrs[panel]}`, ox + panelW / 2, 4)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.text(`step ${path.length - 1}  loss ${lossVal.toFixed(2)}`, ox + panelW / 2, 18)
      }
    }
  }, [])

  const handleReset = useCallback(() => {
    pathsRef.current = [
      [{ x: 3.5, y: 2.5 }],
      [{ x: 3.5, y: 2.5 }],
      [{ x: 3.5, y: 2.5 }],
    ]
    setPlaying(false)
    playingRef.current = false
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={280} />
      <div className="mt-2 flex items-center gap-3 px-2">
        <button
          onClick={() => { setPlaying(!playing); playingRef.current = !playing }}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleReset}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
        >
          Reset
        </button>
        <span className="text-sm text-gray-400">
          Too small = slow | Just right = fast convergence | Too large = oscillation or divergence
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const gradDescentCode = `import numpy as np

# Gradient descent from scratch on f(x, y) = x^2 + 2y^2
def f(x, y):
    return x**2 + 2*y**2

def grad_f(x, y):
    return np.array([2*x, 4*y])

# Settings
lr = 0.1
x, y = 3.5, 2.5
history = [(x, y, f(x, y))]

print(f"{'Step':>4s}  {'x':>8s}  {'y':>8s}  {'f(x,y)':>10s}  {'|grad|':>8s}")
print("-" * 48)

for step in range(1, 21):
    g = grad_f(x, y)
    x -= lr * g[0]
    y -= lr * g[1]
    loss = f(x, y)
    grad_norm = np.linalg.norm(g)
    history.append((x, y, loss))
    if step <= 10 or step % 5 == 0:
        print(f"{step:4d}  {x:8.4f}  {y:8.4f}  {loss:10.6f}  {grad_norm:8.4f}")

print(f"\\nFinal: x={x:.6f}, y={y:.6f}, loss={f(x, y):.8f}")
print(f"True minimum: x=0, y=0, loss=0")
`

const momentumCode = `import numpy as np

# Compare vanilla GD vs Momentum on a narrow valley
# f(x, y) = x^2 + 50*y^2  (much steeper in y than x)
def f(x, y):
    return x**2 + 50*y**2

def grad_f(x, y):
    return np.array([2*x, 100*y])

lr = 0.01
x0, y0 = 3.0, 0.5

# Vanilla gradient descent
x, y = x0, y0
vanilla_losses = [f(x, y)]
for _ in range(50):
    g = grad_f(x, y)
    x -= lr * g[0]
    y -= lr * g[1]
    vanilla_losses.append(f(x, y))

# Gradient descent with momentum
x, y = x0, y0
vx, vy = 0.0, 0.0
beta = 0.9
momentum_losses = [f(x, y)]
for _ in range(50):
    g = grad_f(x, y)
    vx = beta * vx + lr * g[0]
    vy = beta * vy + lr * g[1]
    x -= vx
    y -= vy
    momentum_losses.append(f(x, y))

print("Step  Vanilla Loss    Momentum Loss")
print("-" * 40)
for i in [0, 1, 2, 5, 10, 20, 30, 50]:
    print(f"{i:4d}  {vanilla_losses[i]:12.4f}    {momentum_losses[i]:12.4f}")

print(f"\\nVanilla converges slowly because it oscillates")
print(f"in the steep y-direction. Momentum smooths this out.")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Gradients() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* Title */}
      <header>
        <h1 className="text-4xl font-bold text-white">Partial Derivatives &amp; Gradients</h1>
        <p className="mt-3 text-lg text-gray-300">
          Real ML loss functions depend on thousands or millions of parameters — not just one
          variable. The <strong className="text-white">gradient</strong> generalizes the derivative
          to multiple dimensions: it is a vector of partial derivatives that points in the
          direction of steepest increase. Moving opposite to the gradient is the core idea of
          gradient descent.
        </p>
      </header>

      {/* Section 1 — Contour Plot */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Multivariable Functions &amp; Contour Maps</h2>
        <p className="text-gray-300">
          A function of two variables f(x, y) defines a surface in 3D. We visualize it as a
          <strong className="text-white"> contour map</strong> — like a topographic map where
          each contour line connects points of equal height. Darker regions are lower values
          (closer to the minimum).
        </p>
        <h3 className="text-lg font-medium text-white">Partial Derivatives</h3>
        <p className="text-gray-300">
          A <strong className="text-white">partial derivative</strong> measures how f changes
          when we vary <em>one</em> variable while holding the others fixed. For f(x,y) = x&sup2; + 2y&sup2;:
          &part;f/&part;x = 2x and &part;f/&part;y = 4y.
        </p>
        <h3 className="text-lg font-medium text-white">The Gradient Vector</h3>
        <p className="text-gray-300">
          The gradient is the vector of all partial derivatives:{' '}
          <code className="text-sky-400">&nabla;f = [&part;f/&part;x, &part;f/&part;y]</code>.
          It always points in the direction of <em>steepest ascent</em>. On the contour map
          below, red arrows show the gradient at each grid point. Notice they are perpendicular
          to the contour lines and point away from the minimum.
        </p>
        <ContourGradientSketch />
      </section>

      {/* Section 2 — Gradient Descent */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Gradient Descent</h2>
        <p className="text-gray-300">
          To minimize a function, we repeatedly take a small step in the <em>opposite</em>{' '}
          direction of the gradient:
        </p>
        <div className="rounded-lg bg-gray-800 px-4 py-3 font-mono text-sm text-sky-300">
          x &larr; x - lr &middot; &nabla;f(x)
        </div>
        <p className="text-gray-300">
          The <strong className="text-white">learning rate</strong> (lr) controls step size.
          Watch the yellow ball roll downhill toward the minimum. Adjust the learning rate to
          see how it affects convergence speed.
        </p>
        <GradientDescentSketch />
      </section>

      {/* Section 3 — Learning Rate Effects */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Learning Rate Effects</h2>
        <p className="text-gray-300">
          Choosing the right learning rate is critical. Below are three gradient descent runs on
          the same loss surface, starting from the same point, with different learning rates:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-gray-300">
          <li><strong className="text-white">Too small (0.01):</strong> Converges reliably but painfully slowly.</li>
          <li><strong className="text-white">Just right (0.1):</strong> Smooth, fast convergence to the minimum.</li>
          <li><strong className="text-white">Too large (0.45):</strong> Oscillates wildly and may diverge or take forever.</li>
        </ul>
        <LRComparisonSketch />
      </section>

      {/* Python 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Gradient Descent from Scratch</h2>
        <p className="text-gray-300">
          Implement gradient descent in pure NumPy. We minimize f(x, y) = x&sup2; + 2y&sup2;
          by iteratively following the negative gradient. Watch the loss drop toward zero.
        </p>
        <PythonCell defaultCode={gradDescentCode} title="Gradient Descent Implementation" />
      </section>

      {/* Python 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Momentum</h2>
        <p className="text-gray-300">
          Vanilla gradient descent can oscillate in narrow valleys. <strong className="text-white">
          Momentum</strong> adds a velocity term that accumulates past gradients, smoothing out
          oscillations and accelerating convergence along consistent directions. This is the
          idea behind optimizers like SGD with momentum and Adam.
        </p>
        <PythonCell defaultCode={momentumCode} title="Vanilla GD vs Momentum" />
      </section>

      {/* Summary */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>Partial derivatives measure how a function changes along one variable at a time.</li>
          <li>The gradient vector collects all partial derivatives and points in the direction of steepest ascent.</li>
          <li>Gradient descent moves opposite to the gradient to minimize a loss function.</li>
          <li>The learning rate is the most important hyperparameter — too small is slow, too large diverges.</li>
          <li>Momentum and adaptive methods (Adam) improve on vanilla gradient descent in practice.</li>
        </ul>
      </section>
    </div>
  )
}
