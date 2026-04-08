import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'neural/optimizers',
  title: 'Optimizers',
  description: 'From vanilla SGD to Adam: the algorithms that navigate the loss landscape',
  track: 'neural',
  order: 5,
  tags: ['sgd', 'momentum', 'rmsprop', 'adam', 'learning-rate', 'optimization'],
}

/* ------------------------------------------------------------------ */
/*  Loss landscape: elongated bowl  f(x,y) = ax^2 + by^2              */
/* ------------------------------------------------------------------ */
function lossFunction(x: number, y: number): number {
  return 5 * x * x + 0.5 * y * y
}

function lossGradient(x: number, y: number): [number, number] {
  return [10 * x, 1 * y]
}

/* ------------------------------------------------------------------ */
/*  Optimizer implementations                                          */
/* ------------------------------------------------------------------ */
interface OptimizerState {
  x: number
  y: number
  vx: number
  vy: number
  sx: number
  sy: number
  mx: number
  my: number
  t: number
  path: { x: number; y: number }[]
}

function createOptimizerState(x0: number, y0: number): OptimizerState {
  return { x: x0, y: y0, vx: 0, vy: 0, sx: 0, sy: 0, mx: 0, my: 0, t: 0, path: [{ x: x0, y: y0 }] }
}

function stepSGD(state: OptimizerState, lr: number): void {
  const [gx, gy] = lossGradient(state.x, state.y)
  state.x -= lr * gx
  state.y -= lr * gy
  state.path.push({ x: state.x, y: state.y })
}

function stepMomentum(state: OptimizerState, lr: number, beta = 0.9): void {
  const [gx, gy] = lossGradient(state.x, state.y)
  state.vx = beta * state.vx + gx
  state.vy = beta * state.vy + gy
  state.x -= lr * state.vx
  state.y -= lr * state.vy
  state.path.push({ x: state.x, y: state.y })
}

function stepRMSProp(state: OptimizerState, lr: number, beta = 0.999, eps = 1e-8): void {
  const [gx, gy] = lossGradient(state.x, state.y)
  state.sx = beta * state.sx + (1 - beta) * gx * gx
  state.sy = beta * state.sy + (1 - beta) * gy * gy
  state.x -= lr * gx / (Math.sqrt(state.sx) + eps)
  state.y -= lr * gy / (Math.sqrt(state.sy) + eps)
  state.path.push({ x: state.x, y: state.y })
}

function stepAdam(state: OptimizerState, lr: number, beta1 = 0.9, beta2 = 0.999, eps = 1e-8): void {
  state.t += 1
  const [gx, gy] = lossGradient(state.x, state.y)
  state.mx = beta1 * state.mx + (1 - beta1) * gx
  state.my = beta1 * state.my + (1 - beta1) * gy
  state.sx = beta2 * state.sx + (1 - beta2) * gx * gx
  state.sy = beta2 * state.sy + (1 - beta2) * gy * gy
  const mxHat = state.mx / (1 - Math.pow(beta1, state.t))
  const myHat = state.my / (1 - Math.pow(beta1, state.t))
  const sxHat = state.sx / (1 - Math.pow(beta2, state.t))
  const syHat = state.sy / (1 - Math.pow(beta2, state.t))
  state.x -= lr * mxHat / (Math.sqrt(sxHat) + eps)
  state.y -= lr * myHat / (Math.sqrt(syHat) + eps)
  state.path.push({ x: state.x, y: state.y })
}

/* ------------------------------------------------------------------ */
/*  Shared contour drawing                                             */
/* ------------------------------------------------------------------ */
function drawContours(
  p: p5,
  plotLeft: number,
  plotTop: number,
  plotW: number,
  plotH: number,
  xRange: [number, number],
  yRange: [number, number],
) {
  // Heatmap
  const step = 4
  for (let px = 0; px < plotW; px += step) {
    for (let py = 0; py < plotH; py += step) {
      const x = p.map(px, 0, plotW, xRange[0], xRange[1])
      const y = p.map(py, 0, plotH, yRange[0], yRange[1])
      const loss = lossFunction(x, y)
      const intensity = p.constrain(p.map(Math.log(loss + 1), 0, 4, 10, 80), 10, 80)
      p.noStroke()
      p.fill(intensity, intensity * 1.2, intensity * 1.8)
      p.rect(plotLeft + px, plotTop + py, step, step)
    }
  }

  // Contour lines
  const levels = [0.5, 1, 2, 5, 10, 20, 40]
  for (const level of levels) {
    p.noFill()
    p.stroke(60, 80, 120, 60)
    p.strokeWeight(1)
    p.beginShape()
    for (let angle = 0; angle <= p.TWO_PI + 0.1; angle += 0.05) {
      // For ax^2 + by^2 = level, parametric: x = sqrt(level/a)*cos, y = sqrt(level/b)*sin
      const cx = Math.sqrt(level / 5) * Math.cos(angle)
      const cy = Math.sqrt(level / 0.5) * Math.sin(angle)
      if (cx >= xRange[0] && cx <= xRange[1] && cy >= yRange[0] && cy <= yRange[1]) {
        const sx = p.map(cx, xRange[0], xRange[1], plotLeft, plotLeft + plotW)
        const sy = p.map(cy, yRange[0], yRange[1], plotTop, plotTop + plotH)
        p.vertex(sx, sy)
      }
    }
    p.endShape()
  }
}

function drawPath(
  p: p5,
  path: { x: number; y: number }[],
  plotLeft: number,
  plotTop: number,
  plotW: number,
  plotH: number,
  xRange: [number, number],
  yRange: [number, number],
  color: [number, number, number],
) {
  if (path.length < 2) return
  p.noFill()
  p.stroke(color[0], color[1], color[2], 200)
  p.strokeWeight(2)
  p.beginShape()
  for (const pt of path) {
    const sx = p.map(pt.x, xRange[0], xRange[1], plotLeft, plotLeft + plotW)
    const sy = p.map(pt.y, yRange[0], yRange[1], plotTop, plotTop + plotH)
    p.vertex(sx, sy)
  }
  p.endShape()

  // Current position
  const last = path[path.length - 1]
  const sx = p.map(last.x, xRange[0], xRange[1], plotLeft, plotLeft + plotW)
  const sy = p.map(last.y, yRange[0], yRange[1], plotTop, plotTop + plotH)
  p.noStroke()
  p.fill(color[0], color[1], color[2])
  p.ellipse(sx, sy, 8, 8)
}

/* ================================================================== */
/*  Section 1 — Beyond Vanilla SGD                                     */
/* ================================================================== */
function BeyondSGDSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Beyond Vanilla SGD</h2>
      <p className="text-gray-300 leading-relaxed">
        Stochastic gradient descent (SGD) is the simplest optimization algorithm: compute the
        gradient of the loss with respect to the parameters, then take a step in the opposite
        direction. W = W - lr * gradient. It works, but it has serious limitations.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The loss landscape of a neural network is rarely a smooth, symmetric bowl. It's typically
        an elongated, asymmetric surface with saddle points, flat regions, and sharp ravines. In
        such landscapes, vanilla SGD oscillates in steep directions (where the gradient is large)
        and makes slow progress in shallow directions (where the gradient is small). The result
        is zig-zagging toward the minimum instead of taking a direct path.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Over the past decade, researchers have developed a family of adaptive optimizers that
        address these issues. They all share a common structure: maintain some moving statistics
        of past gradients and use them to modulate the current update. Let's explore the most
        important ones.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — SGD vs Momentum                                        */
/* ================================================================== */
function MomentumSection() {
  const [steps, setSteps] = useState(0)
  const [lr, setLr] = useState(0.02)

  const stateRef = useRef({
    steps,
    lr,
    sgd: createOptimizerState(-1.8, 3.5),
    mom: createOptimizerState(-1.8, 3.5),
    prevSteps: 0,
    prevLr: 0.02,
  })

  // Reset when lr changes
  if (lr !== stateRef.current.prevLr) {
    stateRef.current.sgd = createOptimizerState(-1.8, 3.5)
    stateRef.current.mom = createOptimizerState(-1.8, 3.5)
    stateRef.current.prevSteps = 0
    stateRef.current.prevLr = lr
  }

  // Step forward
  while (stateRef.current.prevSteps < steps) {
    stepSGD(stateRef.current.sgd, lr)
    stepMomentum(stateRef.current.mom, lr, 0.9)
    stateRef.current.prevSteps++
  }
  // Step backward (reset and replay)
  if (stateRef.current.prevSteps > steps) {
    stateRef.current.sgd = createOptimizerState(-1.8, 3.5)
    stateRef.current.mom = createOptimizerState(-1.8, 3.5)
    for (let i = 0; i < steps; i++) {
      stepSGD(stateRef.current.sgd, lr)
      stepMomentum(stateRef.current.mom, lr, 0.9)
    }
    stateRef.current.prevSteps = steps
  }

  stateRef.current.steps = steps
  stateRef.current.lr = lr

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotLeft = 40
      const plotTop = 50
      const plotW = W - 80
      const plotH = H - 100
      const xRange: [number, number] = [-3, 3]
      const yRange: [number, number] = [-5, 5]

      drawContours(p, plotLeft, plotTop, plotW, plotH, xRange, yRange)

      // Draw paths
      const sgdColor: [number, number, number] = [220, 80, 80]
      const momColor: [number, number, number] = [80, 220, 120]

      drawPath(p, s.sgd.path, plotLeft, plotTop, plotW, plotH, xRange, yRange, sgdColor)
      drawPath(p, s.mom.path, plotLeft, plotTop, plotW, plotH, xRange, yRange, momColor)

      // Legend
      p.noStroke()
      p.fill(220, 80, 80)
      p.ellipse(W - 160, 15, 8, 8)
      p.fill(180)
      p.textSize(11)
      p.textAlign(p.LEFT)
      p.text(`SGD  loss=${lossFunction(s.sgd.x, s.sgd.y).toFixed(3)}`, W - 150, 19)

      p.fill(80, 220, 120)
      p.noStroke()
      p.ellipse(W - 160, 33, 8, 8)
      p.fill(180)
      p.text(`Momentum  loss=${lossFunction(s.mom.x, s.mom.y).toFixed(3)}`, W - 150, 37)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('SGD vs Momentum on Elongated Valley', W / 2, 25)

      // Minimum marker
      const minX = p.map(0, xRange[0], xRange[1], plotLeft, plotLeft + plotW)
      const minY = p.map(0, yRange[0], yRange[1], plotTop, plotTop + plotH)
      p.stroke(255)
      p.strokeWeight(2)
      p.noFill()
      p.line(minX - 6, minY - 6, minX + 6, minY + 6)
      p.line(minX + 6, minY - 6, minX - 6, minY + 6)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Momentum</h2>
      <p className="text-gray-300 leading-relaxed">
        Momentum adds a "velocity" term that accumulates past gradients. Think of a ball rolling
        down a hill: it builds up speed in consistent directions and smooths out oscillations.
        The update rule is: v = beta * v + gradient, then W = W - lr * v. The hyperparameter beta
        (typically 0.9) controls how much past gradients influence the current step.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In the elongated valley below, SGD (red) oscillates wildly across the steep dimension
        while making slow progress along the shallow dimension. Momentum (green) dampens the
        oscillations and accelerates along the consistent downhill direction. Increase the steps
        to see how their trajectories diverge.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="SGD vs Momentum">
            <InteractiveSlider label="Steps" min={0} max={100} step={1} value={steps} onChange={setSteps} />
            <InteractiveSlider label="Learning rate" min={0.005} max={0.05} step={0.001} value={lr} onChange={setLr} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — RMSProp                                                */
/* ================================================================== */
function RMSPropSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">RMSProp</h2>
      <p className="text-gray-300 leading-relaxed">
        RMSProp (Root Mean Square Propagation), proposed by Geoffrey Hinton in a 2012 Coursera
        lecture, takes a different approach: instead of accumulating gradient history for
        momentum, it maintains a running average of squared gradients and divides the update by
        their root mean square.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The update rule is: s = beta * s + (1-beta) * g^2, then W = W - lr * g / sqrt(s + eps).
        This adaptive scaling means that parameters with large gradients get smaller effective
        learning rates (reducing oscillation), while parameters with small gradients get larger
        effective learning rates (accelerating progress). It's particularly effective in the
        elongated valley scenario because it automatically equalizes the scale across dimensions.
      </p>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">RMSProp Intuition</h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          Imagine you're walking on a tilted surface where the slope is very steep in one
          direction and very gentle in another. Vanilla SGD would take tiny steps to avoid
          overshooting in the steep direction, but those tiny steps make progress painfully slow
          in the gentle direction. RMSProp normalizes each dimension by its typical gradient
          magnitude, effectively walking with equal confidence in all directions.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Adam: All Optimizers Racing                            */
/* ================================================================== */
function AdamRaceSection() {
  const [steps, setSteps] = useState(0)

  const stateRef = useRef({
    steps,
    sgd: createOptimizerState(-2.0, 4.0),
    mom: createOptimizerState(-2.0, 4.0),
    rms: createOptimizerState(-2.0, 4.0),
    adam: createOptimizerState(-2.0, 4.0),
    prevSteps: 0,
  })

  // Always reset and replay to the current step count for consistency
  if (stateRef.current.prevSteps !== steps) {
    stateRef.current.sgd = createOptimizerState(-2.0, 4.0)
    stateRef.current.mom = createOptimizerState(-2.0, 4.0)
    stateRef.current.rms = createOptimizerState(-2.0, 4.0)
    stateRef.current.adam = createOptimizerState(-2.0, 4.0)
    for (let i = 0; i < steps; i++) {
      stepSGD(stateRef.current.sgd, 0.02)
      stepMomentum(stateRef.current.mom, 0.02, 0.9)
      stepRMSProp(stateRef.current.rms, 0.1)
      stepAdam(stateRef.current.adam, 0.1)
    }
    stateRef.current.prevSteps = steps
  }
  stateRef.current.steps = steps

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 460)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotLeft = 40
      const plotTop = 50
      const plotW = W - 80
      const plotH = H - 120
      const xRange: [number, number] = [-3, 3]
      const yRange: [number, number] = [-5, 5]

      drawContours(p, plotLeft, plotTop, plotW, plotH, xRange, yRange)

      const optimizers: { name: string; state: OptimizerState; color: [number, number, number] }[] = [
        { name: 'SGD', state: s.sgd, color: [220, 80, 80] },
        { name: 'Momentum', state: s.mom, color: [80, 220, 120] },
        { name: 'RMSProp', state: s.rms, color: [80, 180, 220] },
        { name: 'Adam', state: s.adam, color: [220, 180, 60] },
      ]

      for (const opt of optimizers) {
        drawPath(p, opt.state.path, plotLeft, plotTop, plotW, plotH, xRange, yRange, opt.color)
      }

      // Legend
      for (let i = 0; i < optimizers.length; i++) {
        const opt = optimizers[i]
        const ly = 10 + i * 18
        p.noStroke()
        p.fill(opt.color[0], opt.color[1], opt.color[2])
        p.ellipse(W - 220, ly + 4, 8, 8)
        p.fill(180)
        p.textSize(10)
        p.textAlign(p.LEFT)
        const loss = lossFunction(opt.state.x, opt.state.y)
        p.text(`${opt.name}: loss=${loss.toFixed(4)}`, W - 210, ly + 8)
      }

      // Minimum marker
      const minX = p.map(0, xRange[0], xRange[1], plotLeft, plotLeft + plotW)
      const minY = p.map(0, yRange[0], yRange[1], plotTop, plotTop + plotH)
      p.stroke(255)
      p.strokeWeight(2)
      p.noFill()
      p.line(minX - 6, minY - 6, minX + 6, minY + 6)
      p.line(minX + 6, minY - 6, minX - 6, minY + 6)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Optimizer Race: SGD vs Momentum vs RMSProp vs Adam', W / 2, 25)

      // Step counter
      p.fill(140)
      p.textSize(12)
      p.text(`Step: ${s.steps}`, W / 2, H - 15)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Adam: The Best of Both Worlds</h2>
      <p className="text-gray-300 leading-relaxed">
        Adam (Adaptive Moment Estimation) combines momentum and RMSProp. It maintains both a
        running average of gradients (first moment, like momentum) and a running average of
        squared gradients (second moment, like RMSProp). It also includes bias correction to
        account for the initialization at zero.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The update rule: m = beta1*m + (1-beta1)*g (momentum), s = beta2*s + (1-beta2)*g^2
        (scaling), then bias-correct both, and update W = W - lr * m_hat / sqrt(s_hat + eps).
        Default hyperparameters (beta1=0.9, beta2=0.999, eps=1e-8) work well across most problems.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Use the slider to advance all four optimizers simultaneously on the same elongated valley
        and compare their convergence behavior.
      </p>
      <P5Sketch
        sketch={sketch}
        height={460}
        controls={
          <ControlPanel title="Optimizer Race">
            <InteractiveSlider label="Steps" min={0} max={150} step={1} value={steps} onChange={setSteps} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Learning Rate Schedules                                */
/* ================================================================== */
function LRScheduleSection() {
  const [scheduleType, setScheduleType] = useState<'constant' | 'step' | 'cosine' | 'warmup'>('constant')
  const stateRef = useRef({ scheduleType })
  stateRef.current = { scheduleType }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 300)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotLeft = 70
      const plotRight = W - 30
      const plotTop = 50
      const plotBottom = H - 40
      const plotH = plotBottom - plotTop
      const totalEpochs = 100
      const baseLR = 0.01

      function getLR(epoch: number): number {
        switch (s.scheduleType) {
          case 'constant':
            return baseLR
          case 'step':
            if (epoch < 30) return baseLR
            if (epoch < 60) return baseLR * 0.1
            return baseLR * 0.01
          case 'cosine':
            return baseLR * 0.5 * (1 + Math.cos(Math.PI * epoch / totalEpochs))
          case 'warmup': {
            const warmupEpochs = 10
            if (epoch < warmupEpochs) return baseLR * (epoch / warmupEpochs)
            return baseLR * 0.5 * (1 + Math.cos(Math.PI * (epoch - warmupEpochs) / (totalEpochs - warmupEpochs)))
          }
          default:
            return baseLR
        }
      }

      // Axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(plotLeft, plotBottom, plotRight, plotBottom)
      p.line(plotLeft, plotTop, plotLeft, plotBottom)

      // Grid
      p.stroke(35)
      for (let i = 0; i <= 4; i++) {
        const y = plotTop + (plotH * i) / 4
        p.line(plotLeft, y, plotRight, y)
      }

      // LR curve
      p.noFill()
      p.stroke(80, 180, 220)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let epoch = 0; epoch <= totalEpochs; epoch++) {
        const lr = getLR(epoch)
        const x = p.map(epoch, 0, totalEpochs, plotLeft, plotRight)
        const y = p.map(lr, 0, baseLR * 1.1, plotBottom, plotTop)
        p.vertex(x, y)
      }
      p.endShape()

      // Simulate loss curve with this schedule
      p.stroke(220, 120, 80)
      p.strokeWeight(2)
      p.beginShape()
      let loss = 10
      for (let epoch = 0; epoch <= totalEpochs; epoch++) {
        const lr = getLR(epoch)
        // Simplified loss decay model
        loss *= (1 - lr * 8)
        loss = Math.max(loss, 0.01 + Math.random() * 0.005 * lr / baseLR)
        const x = p.map(epoch, 0, totalEpochs, plotLeft, plotRight)
        const y = p.map(loss, 0, 10, plotBottom, plotTop)
        p.vertex(x, p.constrain(y, plotTop, plotBottom))
      }
      p.endShape()

      // Labels
      p.noStroke()
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text('Epoch', (plotLeft + plotRight) / 2, plotBottom + 18)
      for (let e = 0; e <= totalEpochs; e += 25) {
        const x = p.map(e, 0, totalEpochs, plotLeft, plotRight)
        p.text(String(e), x, plotBottom + 12)
      }

      // Y axis
      p.textAlign(p.RIGHT, p.CENTER)
      p.text(baseLR.toFixed(3), plotLeft - 5, plotTop)
      p.text('0', plotLeft - 5, plotBottom)

      // Legend
      p.noStroke()
      p.fill(80, 180, 220)
      p.rect(plotRight - 150, plotTop + 5, 12, 3)
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text('Learning rate', plotRight - 134, plotTop + 10)

      p.fill(220, 120, 80)
      p.rect(plotRight - 150, plotTop + 20, 12, 3)
      p.fill(160)
      p.text('Loss (simulated)', plotRight - 134, plotTop + 25)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      const titles: Record<string, string> = {
        constant: 'Constant Learning Rate',
        step: 'Step Decay (drop at epoch 30, 60)',
        cosine: 'Cosine Annealing',
        warmup: 'Linear Warmup + Cosine Decay',
      }
      p.text(titles[s.scheduleType], W / 2, 25)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Learning Rate Schedules</h2>
      <p className="text-gray-300 leading-relaxed">
        The learning rate is arguably the most important hyperparameter. Too large and training
        diverges. Too small and it takes forever. Learning rate schedules adjust the learning
        rate during training, typically starting high for fast initial progress and decaying to
        fine-tune near the minimum.
      </p>
      <P5Sketch
        sketch={sketch}
        height={300}
        controls={
          <ControlPanel title="Schedule Type">
            <div className="flex flex-wrap gap-2">
              {(['constant', 'step', 'cosine', 'warmup'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setScheduleType(type)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    scheduleType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {type === 'warmup' ? 'Warmup + Cosine' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </ControlPanel>
        }
      />
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Common Schedules</h3>
        <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm leading-relaxed">
          <li><strong>Constant:</strong> Simple, but rarely optimal. Good for quick experiments.</li>
          <li><strong>Step decay:</strong> Reduce LR by a factor (e.g., 10x) at fixed epochs. Classic in CNNs.</li>
          <li><strong>Cosine annealing:</strong> Smooth decay following a cosine curve. Popular in modern training.</li>
          <li><strong>Warmup + decay:</strong> Start small, ramp up, then decay. Essential for transformers (avoids early instability with Adam).</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — The LR Hyperparameter                                  */
/* ================================================================== */
function LRHyperparamSection() {
  const [lrChoice, setLrChoice] = useState<'too_small' | 'right' | 'too_large'>('right')
  const stateRef = useRef({ lrChoice })
  stateRef.current = { lrChoice }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 300)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotLeft = 70
      const plotRight = W - 30
      const plotTop = 50
      const plotBottom = H - 40
      const totalSteps = 200

      const lrMap = { too_small: 0.0005, right: 0.01, too_large: 0.5 }
      const lr = lrMap[s.lrChoice]

      // Simulate training loss
      const losses: number[] = []
      let loss = 5.0
      let vel = 0
      for (let t = 0; t < totalSteps; t++) {
        const grad = loss * 2 + (Math.random() - 0.5) * 0.5
        vel = 0.9 * vel + grad
        loss -= lr * vel
        if (s.lrChoice === 'too_large') {
          loss += Math.abs(loss) * 0.1 * (Math.random() - 0.3)
          if (loss > 100) loss = 50 + Math.random() * 50
        }
        loss = Math.max(loss, 0.01)
        losses.push(loss)
      }

      const maxLoss = Math.max(...losses) * 1.1

      // Axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(plotLeft, plotBottom, plotRight, plotBottom)
      p.line(plotLeft, plotTop, plotLeft, plotBottom)

      // Loss curve
      p.noFill()
      const color = s.lrChoice === 'right'
        ? [80, 220, 120]
        : s.lrChoice === 'too_small'
        ? [80, 140, 220]
        : [220, 80, 80]
      p.stroke(color[0], color[1], color[2])
      p.strokeWeight(2)
      p.beginShape()
      for (let t = 0; t < totalSteps; t++) {
        const x = p.map(t, 0, totalSteps, plotLeft, plotRight)
        const y = p.map(losses[t], 0, maxLoss, plotBottom, plotTop)
        p.vertex(x, p.constrain(y, plotTop, plotBottom))
      }
      p.endShape()

      // Labels
      p.noStroke()
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text('Training step', (plotLeft + plotRight) / 2, plotBottom + 18)

      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Loss', plotLeft - 8, (plotTop + plotBottom) / 2)

      // Title and annotation
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      const descriptions: Record<string, string> = {
        too_small: `LR = ${lr} -- Too small: painfully slow convergence`,
        right: `LR = ${lr} -- Just right: steady, fast convergence`,
        too_large: `LR = ${lr} -- Too large: unstable, may diverge`,
      }
      p.text(descriptions[s.lrChoice], W / 2, 25)

      // Final loss
      p.fill(160)
      p.textSize(11)
      p.text(`Final loss: ${losses[losses.length - 1].toFixed(4)}`, W / 2, plotTop + 15)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Learning Rate Hyperparameter</h2>
      <p className="text-gray-300 leading-relaxed">
        Choosing the right learning rate is critical. Too small: the optimizer makes tiny updates
        and training takes forever, potentially getting stuck in a local minimum. Just right: fast,
        steady convergence to a good solution. Too large: the optimizer overshoots, oscillates
        wildly, and may diverge (loss goes to infinity).
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click the buttons below to see the effect of each learning rate on the training loss curve.
        In practice, finding a good learning rate often involves: (1) trying a few orders of
        magnitude (0.1, 0.01, 0.001), (2) using a learning rate finder that sweeps across values,
        or (3) using an adaptive optimizer like Adam which is more robust to the initial choice.
      </p>
      <P5Sketch
        sketch={sketch}
        height={300}
        controls={
          <ControlPanel title="Learning Rate">
            <div className="flex gap-2">
              {(['too_small', 'right', 'too_large'] as const).map((choice) => (
                <button
                  key={choice}
                  onClick={() => setLrChoice(choice)}
                  className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                    lrChoice === choice
                      ? choice === 'right'
                        ? 'bg-green-600 text-white'
                        : choice === 'too_small'
                        ? 'bg-blue-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {choice === 'too_small' ? 'Too Small' : choice === 'right' ? 'Just Right' : 'Too Large'}
                </button>
              ))}
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Python: Implement SGD + Momentum + Adam                */
/* ================================================================== */
function PythonOptimizersSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Implement SGD, Momentum, and Adam</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's implement all three optimizers from scratch and compare them on a simple optimization
        problem. The code is self-contained -- each optimizer is a class that maintains its own
        state and implements the update rule.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Elongated quadratic: f(x,y) = 5x^2 + 0.5y^2
def loss_fn(params):
    return 5 * params[0]**2 + 0.5 * params[1]**2

def grad_fn(params):
    return np.array([10 * params[0], 1.0 * params[1]])

class SGD:
    def __init__(self, lr=0.01):
        self.lr = lr

    def step(self, params, grad):
        return params - self.lr * grad

class SGDMomentum:
    def __init__(self, lr=0.01, beta=0.9):
        self.lr = lr
        self.beta = beta
        self.velocity = None

    def step(self, params, grad):
        if self.velocity is None:
            self.velocity = np.zeros_like(params)
        self.velocity = self.beta * self.velocity + grad
        return params - self.lr * self.velocity

class Adam:
    def __init__(self, lr=0.01, beta1=0.9, beta2=0.999, eps=1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grad):
        if self.m is None:
            self.m = np.zeros_like(params)
            self.v = np.zeros_like(params)
        self.t += 1
        self.m = self.beta1 * self.m + (1 - self.beta1) * grad
        self.v = self.beta2 * self.v + (1 - self.beta2) * grad**2
        m_hat = self.m / (1 - self.beta1**self.t)
        v_hat = self.v / (1 - self.beta2**self.t)
        return params - self.lr * m_hat / (np.sqrt(v_hat) + self.eps)

# Run all optimizers
start = np.array([-2.0, 4.0])
n_steps = 100

optimizers = {
    'SGD (lr=0.02)':      SGD(lr=0.02),
    'Momentum (lr=0.02)': SGDMomentum(lr=0.02, beta=0.9),
    'Adam (lr=0.1)':      Adam(lr=0.1),
}

print(f"{'Step':>5} | ", end="")
for name in optimizers:
    print(f"{name:>20}", end=" | ")
print()
print("-" * 80)

all_params = {name: start.copy() for name in optimizers}

for step in range(n_steps):
    if step % 10 == 0:
        print(f"{step:>5} | ", end="")
        for name in optimizers:
            loss = loss_fn(all_params[name])
            print(f"{loss:>20.6f}", end=" | ")
        print()

    for name, opt in optimizers.items():
        g = grad_fn(all_params[name])
        all_params[name] = opt.step(all_params[name], g)

print(f"\\nFinal positions and losses:")
for name in optimizers:
    p = all_params[name]
    print(f"  {name}: ({p[0]:.6f}, {p[1]:.6f})  loss={loss_fn(p):.8f}")`}
        title="SGD vs Momentum vs Adam -- from scratch"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Python: Training a Network                             */
/* ================================================================== */
function PythonTrainNetworkSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Experiment: Optimizers on a Real Network</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's see how different optimizers perform when training an actual neural network on
        the circle classification problem. Each optimizer uses the same initialization and
        architecture, so differences come purely from the optimization algorithm.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

# Circle dataset
np.random.seed(0)
N = 200
X = np.random.randn(N, 2) * 0.8
Y = ((X[:,0]**2 + X[:,1]**2) < 0.5).astype(float).reshape(-1, 1)

def train(optimizer_name, epochs=500, lr=0.5):
    np.random.seed(42)
    W1 = np.random.randn(2, 6) * 0.5
    b1 = np.zeros((1, 6))
    W2 = np.random.randn(6, 1) * 0.5
    b2 = np.zeros((1, 1))

    # Adam/Momentum state
    params = [W1, b1, W2, b2]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    vel = [np.zeros_like(p) for p in params]
    t = 0

    losses = []
    for ep in range(epochs):
        # Forward
        z1 = X @ W1 + b1
        a1 = sigmoid(z1)
        z2 = a1 @ W2 + b2
        a2 = sigmoid(z2)

        loss = np.mean((a2 - Y)**2)
        losses.append(loss)

        # Backward
        dz2 = 2/N * (a2 - Y) * a2 * (1 - a2)
        grads = [
            X.T @ ((dz2 @ W2.T) * a1 * (1 - a1)),     # dW1
            np.sum((dz2 @ W2.T) * a1 * (1 - a1), axis=0, keepdims=True),  # db1
            a1.T @ dz2,                                  # dW2
            np.sum(dz2, axis=0, keepdims=True),          # db2
        ]

        t += 1
        for i in range(4):
            if optimizer_name == 'sgd':
                params[i] -= lr * grads[i]
            elif optimizer_name == 'momentum':
                vel[i] = 0.9 * vel[i] + grads[i]
                params[i] -= lr * vel[i]
            elif optimizer_name == 'adam':
                m[i] = 0.9 * m[i] + 0.1 * grads[i]
                v[i] = 0.999 * v[i] + 0.001 * grads[i]**2
                mh = m[i] / (1 - 0.9**t)
                vh = v[i] / (1 - 0.999**t)
                params[i] -= lr * mh / (np.sqrt(vh) + 1e-8)

        W1, b1, W2, b2 = params

    # Final accuracy
    a1 = sigmoid(X @ W1 + b1)
    a2 = sigmoid(a1 @ W2 + b2)
    acc = np.mean((a2 > 0.5).astype(float) == Y) * 100
    return losses, acc

print(f"{'Optimizer':>12}  {'Loss@50':>10}  {'Loss@200':>10}  {'Loss@500':>10}  {'Accuracy':>8}")
print("-" * 60)
for name, lr in [('sgd', 1.0), ('momentum', 0.5), ('adam', 0.5)]:
    losses, acc = train(name, epochs=500, lr=lr)
    print(f"{name:>12}  {losses[49]:>10.6f}  {losses[199]:>10.6f}  {losses[-1]:>10.6f}  {acc:>7.1f}%")`}
        title="Optimizers compared on circle classification with [2,6,1] MLP"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 — Key Takeaways                                          */
/* ================================================================== */
function KeyTakeawaysSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Key Takeaways</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
        <li>
          Vanilla SGD struggles with elongated loss landscapes, oscillating in steep directions
          while making slow progress in shallow ones.
        </li>
        <li>
          Momentum accumulates past gradients to build "velocity," smoothing oscillations and
          accelerating convergence in consistent directions.
        </li>
        <li>
          RMSProp maintains per-parameter learning rates by dividing by the root mean square of
          recent gradients, equalizing progress across dimensions.
        </li>
        <li>
          Adam combines momentum and RMSProp with bias correction. It is the default optimizer
          for most deep learning tasks thanks to its robustness and good default hyperparameters
          (lr=0.001, beta1=0.9, beta2=0.999).
        </li>
        <li>
          Learning rate schedules (step decay, cosine annealing, warmup) further improve training
          by adapting the learning rate over time. Warmup is especially important for transformers.
        </li>
        <li>
          The learning rate is the single most impactful hyperparameter. Always tune it first,
          even when using adaptive optimizers.
        </li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Optimizers() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white">Optimizers</h1>
        <p className="text-lg text-gray-400">
          From vanilla SGD to Adam: the algorithms that navigate the loss landscape.
        </p>
      </header>

      <BeyondSGDSection />
      <MomentumSection />
      <RMSPropSection />
      <AdamRaceSection />
      <LRScheduleSection />
      <LRHyperparamSection />
      <PythonOptimizersSection />
      <PythonTrainNetworkSection />
      <KeyTakeawaysSection />
    </div>
  )
}
