import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'neural/perceptron',
  title: 'The Perceptron',
  description: 'The simplest neural network: a single artificial neuron that learns to classify',
  track: 'neural',
  order: 1,
  tags: ['perceptron', 'activation', 'linear-separability', 'learning-rule'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function step(x: number): number {
  return x >= 0 ? 1 : 0
}

/* ================================================================== */
/*  Section 1 — Biological Inspiration                                 */
/* ================================================================== */
function BiologicalInspirationSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Biological Inspiration</h2>
      <p className="text-gray-300 leading-relaxed">
        The perceptron draws its inspiration from biological neurons. A real neuron receives
        electrical signals from thousands of other neurons through its dendrites. Each incoming
        connection has a different strength, or "synaptic weight." The neuron sums up all these
        weighted signals, and if the total exceeds a threshold, it fires an electrical impulse
        down its axon to the next neurons in the chain.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In 1958, Frank Rosenblatt formalized this idea into the perceptron algorithm: take some
        numeric inputs, multiply each by a learned weight, add them up, and pass the result
        through an activation function. If the total is high enough, output 1 (fire); otherwise,
        output 0 (stay silent). This single artificial neuron is the fundamental building block
        of all neural networks, from the simplest classifiers to today's billion-parameter
        language models.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The analogy is not perfect -- real neurons are far more complex, with timing-dependent
        plasticity, dendritic computation, and chemical signaling. But the core idea of
        weighted-sum-then-threshold captures the essential computation that makes neural
        networks powerful: each unit learns which inputs matter (large weights) and which to
        ignore (near-zero weights).
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — The Math: Single Neuron Diagram                        */
/* ================================================================== */
function NeuronMathSection() {
  const [w1, setW1] = useState(0.7)
  const [w2, setW2] = useState(-0.4)
  const [bias, setBias] = useState(0.1)
  const [x1, setX1] = useState(0.6)
  const [x2, setX2] = useState(0.8)

  const stateRef = useRef({ w1, w2, bias, x1, x2 })
  stateRef.current = { w1, w2, bias, x1, x2 }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 360)
      p.textFont('monospace')
    }
    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const inX = W * 0.12
      const in1Y = H * 0.28
      const in2Y = H * 0.72
      const nX = W * 0.48
      const nY = H * 0.5
      const outX = W * 0.82
      const outY = H * 0.5

      const z = s.x1 * s.w1 + s.x2 * s.w2 + s.bias
      const sigOut = sigmoid(z)

      // Draw edges with weight-colored lines
      const drawEdge = (fx: number, fy: number, tx: number, ty: number, weight: number, label: string) => {
        const intensity = p.map(Math.abs(weight), 0, 2, 80, 255)
        const col = weight >= 0 ? p.color(80, intensity, 120) : p.color(intensity, 80, 80)
        p.stroke(col)
        p.strokeWeight(p.map(Math.abs(weight), 0, 2, 1, 5))
        p.line(fx, fy, tx, ty)
        p.noStroke()
        p.fill(220)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, (fx + tx) / 2, (fy + ty) / 2 - 14)
      }

      drawEdge(inX + 22, in1Y, nX - 32, nY, s.w1, `w1=${s.w1.toFixed(2)}`)
      drawEdge(inX + 22, in2Y, nX - 32, nY, s.w2, `w2=${s.w2.toFixed(2)}`)

      // Bias arrow
      p.stroke(180, 180, 80)
      p.strokeWeight(2)
      p.line(nX, nY - 65, nX, nY - 32)
      p.noStroke()
      p.fill(180, 180, 80)
      p.textSize(11)
      p.textAlign(p.CENTER)
      p.text(`b=${s.bias.toFixed(2)}`, nX, nY - 78)

      // Output edge
      p.stroke(120, 160, 255)
      p.strokeWeight(2)
      p.line(nX + 32, nY, outX - 22, outY)

      // Input circles
      p.noStroke()
      for (const [y, val, label] of [[in1Y, s.x1, 'x1'], [in2Y, s.x2, 'x2']] as [number, number, string][]) {
        p.fill(60, 60, 90)
        p.ellipse(inX, y, 44, 44)
        p.fill(220)
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${label}`, inX, y - 8)
        p.fill(160, 200, 255)
        p.text(val.toFixed(2), inX, y + 10)
      }

      // Neuron circle
      const neuronColor = p.lerpColor(p.color(40, 40, 80), p.color(80, 200, 120), sigOut)
      p.fill(neuronColor)
      p.ellipse(nX, nY, 60, 60)
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('z=' + z.toFixed(3), nX, nY - 8)
      p.text('sig=' + sigOut.toFixed(3), nX, nY + 8)

      // Output circle
      p.fill(40, 40, 100)
      p.ellipse(outX, outY, 50, 50)
      p.fill(120, 255, 160)
      p.textSize(14)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(sigOut.toFixed(3), outX, outY)

      // Labels
      p.fill(100)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text('INPUTS', inX, H - 15)
      p.text('NEURON', nX, H - 15)
      p.text('OUTPUT', outX, H - 15)

      // Formula at top
      p.fill(200)
      p.textSize(12)
      p.textAlign(p.CENTER)
      p.text(
        `z = (${s.x1.toFixed(1)} x ${s.w1.toFixed(2)}) + (${s.x2.toFixed(1)} x ${s.w2.toFixed(2)}) + ${s.bias.toFixed(2)} = ${z.toFixed(3)}`,
        W / 2, 20
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Math: Weighted Sum and Activation</h2>
      <p className="text-gray-300 leading-relaxed">
        A perceptron computes a weighted sum of its inputs plus a bias term:
        <span className="font-mono text-emerald-400"> z = w1*x1 + w2*x2 + b</span>. This
        weighted sum is then passed through an activation function to produce the output.
        Each weight controls how much influence its corresponding input has on the output.
        A large positive weight means that input strongly pushes the output toward 1; a
        large negative weight pushes it toward 0. The bias shifts the decision threshold
        left or right, allowing the neuron to fire even when all inputs are zero.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Adjust the weights, bias, and inputs below to build intuition for how each parameter
        affects the neuron's output. Notice how the neuron circle changes color from dark
        (low activation) to green (high activation) as the sigmoid output approaches 1.
      </p>
      <P5Sketch sketch={sketch} height={360} controls={
        <ControlPanel title="Neuron Parameters">
          <InteractiveSlider label="Weight w1" min={-2} max={2} step={0.05} value={w1} onChange={setW1} />
          <InteractiveSlider label="Weight w2" min={-2} max={2} step={0.05} value={w2} onChange={setW2} />
          <InteractiveSlider label="Bias b" min={-2} max={2} step={0.05} value={bias} onChange={setBias} />
          <InteractiveSlider label="Input x1" min={0} max={1} step={0.05} value={x1} onChange={setX1} />
          <InteractiveSlider label="Input x2" min={0} max={1} step={0.05} value={x2} onChange={setX2} />
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Step Function vs Sigmoid                               */
/* ================================================================== */
function ActivationComparisonSection() {
  const [activationType, setActivationType] = useState<'step' | 'sigmoid' | 'both'>('both')
  const stateRef = useRef({ activationType })
  stateRef.current = { activationType }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 300)
      p.textFont('monospace')
    }
    p.draw = () => {
      const { activationType: aType } = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const padL = 60
      const padR = 30
      const padT = 30
      const padB = 50
      const plotW = W - padL - padR
      const plotH = H - padT - padB

      // Axes
      p.stroke(80)
      p.strokeWeight(1)
      p.line(padL, padT, padL, padT + plotH)
      p.line(padL, padT + plotH, padL + plotW, padT + plotH)

      // Axis labels
      p.noStroke()
      p.fill(150)
      p.textSize(11)
      p.textAlign(p.CENTER)
      p.text('z (weighted sum)', padL + plotW / 2, H - 8)
      p.textAlign(p.RIGHT)
      p.text('output', padL - 10, padT + plotH / 2)

      // Tick marks
      for (let z = -6; z <= 6; z += 2) {
        const x = padL + p.map(z, -6, 6, 0, plotW)
        p.fill(100)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(z.toString(), x, padT + plotH + 4)
        p.stroke(40)
        p.line(x, padT, x, padT + plotH)
      }
      for (let v = 0; v <= 1; v += 0.25) {
        const y = padT + plotH - v * plotH
        p.fill(100)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(v.toFixed(2), padL - 5, y)
        p.stroke(40)
        p.line(padL, y, padL + plotW, y)
      }

      // Draw step function
      if (aType === 'step' || aType === 'both') {
        p.stroke(255, 100, 100)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let px = 0; px < plotW; px++) {
          const z = p.map(px, 0, plotW, -6, 6)
          const val = step(z)
          p.vertex(padL + px, padT + plotH - val * plotH)
        }
        p.endShape()
      }

      // Draw sigmoid
      if (aType === 'sigmoid' || aType === 'both') {
        p.stroke(100, 200, 255)
        p.strokeWeight(2.5)
        p.noFill()
        p.beginShape()
        for (let px = 0; px < plotW; px++) {
          const z = p.map(px, 0, plotW, -6, 6)
          const val = sigmoid(z)
          p.vertex(padL + px, padT + plotH - val * plotH)
        }
        p.endShape()
      }

      // Legend
      p.noStroke()
      if (aType === 'step' || aType === 'both') {
        p.fill(255, 100, 100)
        p.rect(padL + 10, padT + 8, 20, 3)
        p.fill(200)
        p.textSize(11)
        p.textAlign(p.LEFT)
        p.text('Step function', padL + 35, padT + 14)
      }
      if (aType === 'sigmoid' || aType === 'both') {
        const legendY = aType === 'both' ? padT + 26 : padT + 8
        p.fill(100, 200, 255)
        p.rect(padL + 10, legendY, 20, 3)
        p.fill(200)
        p.textSize(11)
        p.textAlign(p.LEFT)
        p.text('Sigmoid', padL + 35, legendY + 6)
      }

      // Mouse hover crosshair
      if (p.mouseX > padL && p.mouseX < padL + plotW && p.mouseY > padT && p.mouseY < padT + plotH) {
        const z = p.map(p.mouseX, padL, padL + plotW, -6, 6)
        p.stroke(255, 255, 255, 60)
        p.strokeWeight(1)
        p.line(p.mouseX, padT, p.mouseX, padT + plotH)
        p.noStroke()
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT)
        p.text(`z=${z.toFixed(2)}  step=${step(z)}  sig=${sigmoid(z).toFixed(3)}`, p.mouseX + 8, p.mouseY - 8)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Step Function vs Sigmoid</h2>
      <p className="text-gray-300 leading-relaxed">
        The original perceptron used a step function: if the weighted sum is at least 0,
        output 1; otherwise output 0. This gives a hard binary decision, which is conceptually
        clean but has a critical flaw for learning -- the step function has zero derivative
        everywhere except at exactly z=0. This means gradient-based learning methods cannot
        figure out which direction to adjust the weights.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The sigmoid function <span className="font-mono text-emerald-400">sigma(z) = 1/(1+e^(-z))</span> solves
        this by providing a smooth, differentiable curve that transitions gradually from 0 to 1.
        It gives us a "probability-like" output and, crucially, has a well-defined gradient
        everywhere. This smooth gradient is what makes modern neural network training possible.
        Hover your mouse over the plot to compare both functions at any value of z.
      </p>
      <P5Sketch sketch={sketch} height={300} controls={
        <ControlPanel title="Activation Function">
          <div className="flex gap-3">
            {(['step', 'sigmoid', 'both'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActivationType(t)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activationType === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Perceptron Learning Rule                               */
/* ================================================================== */
function LearningRuleSection() {
  const [trainStep, setTrainStep] = useState(0)
  const [autoTrain, setAutoTrain] = useState(false)
  const stateRef = useRef({
    w1: 0.5,
    w2: -0.3,
    bias: 0.0,
    step: 0,
    autoTrain: false,
    data: [
      { x1: 0.2, x2: 0.8, label: 0 },
      { x1: 0.4, x2: 0.9, label: 0 },
      { x1: 0.1, x2: 0.6, label: 0 },
      { x1: 0.3, x2: 0.7, label: 0 },
      { x1: 0.15, x2: 0.95, label: 0 },
      { x1: 0.7, x2: 0.2, label: 1 },
      { x1: 0.9, x2: 0.3, label: 1 },
      { x1: 0.8, x2: 0.1, label: 1 },
      { x1: 0.6, x2: 0.4, label: 1 },
      { x1: 0.85, x2: 0.15, label: 1 },
    ],
    lr: 0.2,
    frameCount: 0,
    history: [] as { w1: number; w2: number; bias: number }[],
  })

  stateRef.current.autoTrain = autoTrain
  stateRef.current.step = trainStep

  const doTrainStep = useCallback(() => {
    const s = stateRef.current
    // Find a misclassified point
    for (const pt of s.data) {
      const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
      const pred = z >= 0 ? 1 : 0
      if (pred !== pt.label) {
        const error = pt.label - pred
        s.w1 += s.lr * error * pt.x1
        s.w2 += s.lr * error * pt.x2
        s.bias += s.lr * error
        s.history.push({ w1: s.w1, w2: s.w2, bias: s.bias })
        break
      }
    }
    setTrainStep(prev => prev + 1)
  }, [])

  const resetWeights = useCallback(() => {
    stateRef.current.w1 = (Math.random() - 0.5) * 2
    stateRef.current.w2 = (Math.random() - 0.5) * 2
    stateRef.current.bias = (Math.random() - 0.5) * 2
    stateRef.current.history = []
    setAutoTrain(false)
    setTrainStep(0)
  }, [])

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 400)
      p.textFont('monospace')
    }
    p.draw = () => {
      const s = stateRef.current
      s.frameCount++
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      // Auto-train every 30 frames
      if (s.autoTrain && s.frameCount % 30 === 0) {
        let anyWrong = false
        for (const pt of s.data) {
          const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
          if ((z >= 0 ? 1 : 0) !== pt.label) { anyWrong = true; break }
        }
        if (anyWrong) {
          for (const pt of s.data) {
            const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
            const pred = z >= 0 ? 1 : 0
            if (pred !== pt.label) {
              const error = pt.label - pred
              s.w1 += s.lr * error * pt.x1
              s.w2 += s.lr * error * pt.x2
              s.bias += s.lr * error
              s.history.push({ w1: s.w1, w2: s.w2, bias: s.bias })
              break
            }
          }
        }
      }

      const pad = 50
      const plotSize = Math.min(W - 100, H - 80)

      // Map data coordinates to screen
      const mapX = (v: number) => pad + v * plotSize
      const mapY = (v: number) => pad + (1 - v) * plotSize

      // Draw grid
      p.stroke(40)
      p.strokeWeight(1)
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        p.line(mapX(t), mapY(0), mapX(t), mapY(1))
        p.line(mapX(0), mapY(t), mapX(1), mapY(t))
      }

      // Axes
      p.stroke(80)
      p.strokeWeight(2)
      p.line(mapX(0), mapY(0), mapX(1), mapY(0))
      p.line(mapX(0), mapY(0), mapX(0), mapY(1))
      p.noStroke()
      p.fill(150)
      p.textSize(11)
      p.textAlign(p.CENTER)
      p.text('x1', mapX(0.5), mapY(0) + 20)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('x2', mapX(0) - 10, mapY(0.5))

      // Decision boundary: w1*x1 + w2*x2 + bias = 0  =>  x2 = -(w1*x1 + bias)/w2
      if (Math.abs(s.w2) > 0.001) {
        const x1_0 = 0
        const x2_at_0 = -(s.w1 * x1_0 + s.bias) / s.w2
        const x1_1 = 1
        const x2_at_1 = -(s.w1 * x1_1 + s.bias) / s.w2

        p.stroke(255, 200, 50)
        p.strokeWeight(2.5)
        p.line(mapX(x1_0), mapY(x2_at_0), mapX(x1_1), mapY(x2_at_1))
      } else if (Math.abs(s.w1) > 0.001) {
        const x1_val = -s.bias / s.w1
        p.stroke(255, 200, 50)
        p.strokeWeight(2.5)
        p.line(mapX(x1_val), mapY(0), mapX(x1_val), mapY(1))
      }

      // Data points
      for (const pt of s.data) {
        const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
        const pred = z >= 0 ? 1 : 0
        const correct = pred === pt.label
        p.noStroke()
        if (pt.label === 1) {
          p.fill(correct ? [80, 200, 120] : [255, 80, 80])
          p.ellipse(mapX(pt.x1), mapY(pt.x2), 14, 14)
        } else {
          p.fill(correct ? [100, 150, 255] : [255, 80, 80])
          p.rectMode(p.CENTER)
          p.rect(mapX(pt.x1), mapY(pt.x2), 12, 12)
          p.rectMode(p.CORNER)
        }
      }

      // Count misclassified
      let miscount = 0
      for (const pt of s.data) {
        const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
        if ((z >= 0 ? 1 : 0) !== pt.label) miscount++
      }

      // Status panel
      const panelX = mapX(1) + 20
      p.noStroke()
      p.fill(200)
      p.textSize(12)
      p.textAlign(p.LEFT)
      p.text(`w1: ${s.w1.toFixed(3)}`, panelX, 70)
      p.text(`w2: ${s.w2.toFixed(3)}`, panelX, 90)
      p.text(`bias: ${s.bias.toFixed(3)}`, panelX, 110)
      p.text(`Updates: ${s.history.length}`, panelX, 140)
      p.fill(miscount === 0 ? [80, 255, 120] : [255, 150, 80])
      p.text(`Errors: ${miscount}/${s.data.length}`, panelX, 165)

      // Legend
      p.fill(80, 200, 120)
      p.ellipse(panelX + 6, 200, 10, 10)
      p.fill(180)
      p.textSize(10)
      p.text('Class 1 (circle)', panelX + 16, 204)
      p.fill(100, 150, 255)
      p.rectMode(p.CENTER)
      p.rect(panelX + 6, 220, 8, 8)
      p.rectMode(p.CORNER)
      p.fill(180)
      p.text('Class 0 (square)', panelX + 16, 224)
      p.fill(255, 80, 80)
      p.ellipse(panelX + 6, 240, 10, 10)
      p.fill(180)
      p.text('Misclassified', panelX + 16, 244)

      if (miscount === 0) {
        p.fill(80, 255, 120)
        p.textSize(16)
        p.textAlign(p.CENTER)
        p.text('Converged!', W / 2, 25)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Perceptron Learning Rule</h2>
      <p className="text-gray-300 leading-relaxed">
        The perceptron learning rule is beautifully simple: present a training example, compute
        the output, and if the prediction is wrong, nudge the weights in the right direction.
        Specifically, for each misclassified point: if we predicted 0 but the true label is 1,
        increase the weights by adding the input values scaled by a learning rate. If we
        predicted 1 but the true label is 0, decrease them. The update rule is:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800 p-3 rounded">
        error = target - prediction<br/>
        w_i = w_i + lr * error * x_i<br/>
        b = b + lr * error
      </p>
      <p className="text-gray-300 leading-relaxed">
        The convergence theorem (proven by Rosenblatt) guarantees that if the data is linearly
        separable, the perceptron will eventually find a separating hyperplane in a finite number
        of steps. Watch the yellow decision boundary move as you click "Train Step" or enable
        auto-training. Red-highlighted points are currently misclassified.
      </p>
      <P5Sketch sketch={sketch} height={400} controls={
        <ControlPanel title="Training Controls">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={doTrainStep}
              className="px-4 py-2 rounded text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              Train Step
            </button>
            <button
              onClick={() => setAutoTrain(!autoTrain)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                autoTrain ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {autoTrain ? 'Stop Auto-Train' : 'Auto-Train'}
            </button>
            <button
              onClick={resetWeights}
              className="px-4 py-2 rounded text-sm font-medium bg-gray-600 text-white hover:bg-gray-500 transition-colors"
            >
              Reset
            </button>
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Linear Separability / XOR                              */
/* ================================================================== */
function LinearSeparabilitySection() {
  const [, setTrainCount] = useState(0)
  const stateRef = useRef({
    w1: 0.5,
    w2: 0.5,
    bias: -0.2,
    frameCount: 0,
    training: false,
    xorData: [
      { x1: 0, x2: 0, label: 0 },
      { x1: 0, x2: 1, label: 1 },
      { x1: 1, x2: 0, label: 1 },
      { x1: 1, x2: 1, label: 0 },
    ],
    totalUpdates: 0,
  })

  const toggleTraining = useCallback(() => {
    stateRef.current.training = !stateRef.current.training
    setTrainCount(prev => prev + 1)
  }, [])

  const resetXOR = useCallback(() => {
    stateRef.current.w1 = (Math.random() - 0.5) * 2
    stateRef.current.w2 = (Math.random() - 0.5) * 2
    stateRef.current.bias = (Math.random() - 0.5) * 2
    stateRef.current.totalUpdates = 0
    stateRef.current.training = false
    setTrainCount(prev => prev + 1)
  }, [])

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 400)
      p.textFont('monospace')
    }
    p.draw = () => {
      const s = stateRef.current
      s.frameCount++
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      // Train if enabled
      if (s.training && s.frameCount % 8 === 0) {
        const idx = s.totalUpdates % s.xorData.length
        const pt = s.xorData[idx]
        const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
        const pred = z >= 0 ? 1 : 0
        if (pred !== pt.label) {
          const error = pt.label - pred
          s.w1 += 0.1 * error * pt.x1
          s.w2 += 0.1 * error * pt.x2
          s.bias += 0.1 * error
        }
        s.totalUpdates++
      }

      const pad = 80
      const plotSize = Math.min(W - 180, H - 100)
      const ox = pad
      const oy = pad

      const mapX = (v: number) => ox + (v + 0.3) / 1.6 * plotSize
      const mapY = (v: number) => oy + plotSize - (v + 0.3) / 1.6 * plotSize

      // Background shading for decision regions
      const res = 4
      for (let px = 0; px < plotSize; px += res) {
        for (let py = 0; py < plotSize; py += res) {
          const dataX = (px / plotSize) * 1.6 - 0.3
          const dataY = ((plotSize - py) / plotSize) * 1.6 - 0.3
          const z = dataX * s.w1 + dataY * s.w2 + s.bias
          const prediction = z >= 0 ? 1 : 0
          p.noStroke()
          p.fill(prediction === 1 ? [40, 60, 40, 60] : [40, 40, 60, 60])
          p.rect(ox + px, oy + py, res, res)
        }
      }

      // Grid
      p.stroke(50)
      p.strokeWeight(1)
      for (let i = 0; i <= 1; i += 0.5) {
        p.line(mapX(i), mapY(-0.3), mapX(i), mapY(1.3))
        p.line(mapX(-0.3), mapY(i), mapX(1.3), mapY(i))
      }

      // Decision boundary
      if (Math.abs(s.w2) > 0.001) {
        const x_min = -0.3
        const x_max = 1.3
        const y_at_min = -(s.w1 * x_min + s.bias) / s.w2
        const y_at_max = -(s.w1 * x_max + s.bias) / s.w2
        p.stroke(255, 200, 50)
        p.strokeWeight(2.5)
        p.line(mapX(x_min), mapY(y_at_min), mapX(x_max), mapY(y_at_max))
      }

      // XOR data points
      for (const pt of s.xorData) {
        const z = pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias
        const pred = z >= 0 ? 1 : 0
        const correct = pred === pt.label
        p.noStroke()
        p.strokeWeight(correct ? 0 : 3)
        if (!correct) p.stroke(255, 60, 60)
        if (pt.label === 1) {
          p.fill(80, 220, 120)
          p.ellipse(mapX(pt.x1), mapY(pt.x2), 22, 22)
        } else {
          p.fill(100, 150, 255)
          p.rectMode(p.CENTER)
          p.rect(mapX(pt.x1), mapY(pt.x2), 18, 18)
          p.rectMode(p.CORNER)
        }
        p.noStroke()
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`(${pt.x1},${pt.x2})`, mapX(pt.x1), mapY(pt.x2) - 18)
      }

      // Labels
      p.noStroke()
      p.fill(150)
      p.textSize(11)
      p.textAlign(p.CENTER)
      p.text('x1', ox + plotSize / 2, oy + plotSize + 25)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('x2', ox - 15, oy + plotSize / 2)

      // Status
      const panelX = ox + plotSize + 20
      p.fill(200)
      p.textSize(12)
      p.textAlign(p.LEFT)
      p.text('XOR Problem', panelX, 90)
      p.textSize(10)
      p.fill(150)
      p.text(`Updates: ${s.totalUpdates}`, panelX, 115)
      p.text(`w1: ${s.w1.toFixed(3)}`, panelX, 135)
      p.text(`w2: ${s.w2.toFixed(3)}`, panelX, 150)
      p.text(`b: ${s.bias.toFixed(3)}`, panelX, 165)

      let errors = 0
      for (const pt of s.xorData) {
        if (((pt.x1 * s.w1 + pt.x2 * s.w2 + s.bias) >= 0 ? 1 : 0) !== pt.label) errors++
      }
      p.fill(errors > 0 ? [255, 150, 80] : [80, 255, 120])
      p.text(`Errors: ${errors}/4`, panelX, 190)

      if (s.totalUpdates > 100) {
        p.fill(255, 100, 100)
        p.textSize(13)
        p.textAlign(p.CENTER)
        p.text('XOR cannot be solved!', W / 2, 25)
        p.textSize(10)
        p.fill(200)
        p.text('No single line can separate XOR.', W / 2, 45)
        s.training = false
      }

      p.fill(s.training ? [255, 200, 50] : [120])
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text(s.training ? 'Training...' : 'Paused', panelX, 215)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Linear Separability and the XOR Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        A single perceptron can only learn linearly separable functions -- problems where a
        straight line (or hyperplane in higher dimensions) can perfectly separate the two
        classes. AND, OR, and NAND gates are all linearly separable, and a perceptron handles
        them easily. But the XOR (exclusive or) function is not linearly separable.
      </p>
      <p className="text-gray-300 leading-relaxed">
        XOR outputs 1 when exactly one input is 1, and 0 otherwise. If you plot the four XOR
        data points, you will see that no single straight line can separate the green circles
        (output 1) from the blue squares (output 0). Try training the perceptron below -- it
        will keep updating forever, cycling through the data points, never finding a solution.
        After 100+ updates, it gives up. This fundamental limitation, famously highlighted by
        Minsky and Papert in 1969, almost killed neural network research for a decade. The
        solution? Stack multiple perceptrons into layers -- which we cover in the next lesson.
      </p>
      <P5Sketch sketch={sketch} height={400} controls={
        <ControlPanel title="XOR Training">
          <div className="flex gap-3">
            <button
              onClick={toggleTraining}
              className="px-4 py-2 rounded text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              {stateRef.current.training ? 'Pause' : 'Train'}
            </button>
            <button
              onClick={resetXOR}
              className="px-4 py-2 rounded text-sm font-medium bg-gray-600 text-white hover:bg-gray-500 transition-colors"
            >
              Reset
            </button>
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Python: Perceptron from scratch                        */
/* ================================================================== */
const perceptronCode = `import numpy as np

# Perceptron implementation
class Perceptron:
    def __init__(self, n_inputs, lr=0.1):
        self.weights = np.zeros(n_inputs)
        self.bias = 0.0
        self.lr = lr

    def predict(self, x):
        z = np.dot(x, self.weights) + self.bias
        return 1 if z >= 0 else 0

    def train(self, X, y, epochs=20):
        for epoch in range(epochs):
            errors = 0
            for xi, yi in zip(X, y):
                pred = self.predict(xi)
                error = yi - pred
                if error != 0:
                    self.weights += self.lr * error * xi
                    self.bias += self.lr * error
                    errors += 1
            if errors == 0:
                print(f"Converged at epoch {epoch+1}")
                break
        return self

# AND gate
X_and = np.array([[0,0], [0,1], [1,0], [1,1]])
y_and = np.array([0, 0, 0, 1])
p_and = Perceptron(2).train(X_and, y_and)
print("AND gate predictions:", [p_and.predict(x) for x in X_and])
print(f"  weights={p_and.weights}, bias={p_and.bias:.2f}")

# OR gate
X_or = np.array([[0,0], [0,1], [1,0], [1,1]])
y_or = np.array([0, 1, 1, 1])
p_or = Perceptron(2).train(X_or, y_or)
print("OR gate predictions:", [p_or.predict(x) for x in X_or])
print(f"  weights={p_or.weights}, bias={p_or.bias:.2f}")`

/* ================================================================== */
/*  Section 7 — Python: XOR failure                                    */
/* ================================================================== */
const xorFailureCode = `import numpy as np

class Perceptron:
    def __init__(self, n_inputs, lr=0.1):
        self.weights = np.random.randn(n_inputs) * 0.5
        self.bias = 0.0
        self.lr = lr

    def predict(self, x):
        return 1 if np.dot(x, self.weights) + self.bias >= 0 else 0

    def train(self, X, y, epochs=100):
        for epoch in range(epochs):
            errors = 0
            for xi, yi in zip(X, y):
                pred = self.predict(xi)
                error = yi - pred
                if error != 0:
                    self.weights += self.lr * error * xi
                    self.bias += self.lr * error
                    errors += 1
            if errors == 0:
                return epoch + 1  # converged
        return -1  # did not converge

# XOR gate
X_xor = np.array([[0,0], [0,1], [1,0], [1,1]])
y_xor = np.array([0, 1, 1, 0])

print("Attempting to learn XOR with a single perceptron...")
print("Running 10 trials with random initial weights:\\n")

for trial in range(10):
    p = Perceptron(2)
    result = p.train(X_xor, y_xor, epochs=1000)
    preds = [p.predict(x) for x in X_xor]
    status = "CONVERGED" if result > 0 else "FAILED"
    print(f"Trial {trial+1}: {status} | predictions={preds} | expected=[0,1,1,0]")

print("\\nA single perceptron CANNOT learn XOR!")
print("This is because XOR is not linearly separable.")
print("We need hidden layers (multi-layer networks) to solve this.")`

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */
export default function Perceptron() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-extrabold text-white">The Perceptron</h1>
        <p className="text-lg text-gray-400">
          The simplest neural network -- a single artificial neuron that learns to classify
          data by adjusting its weights. The perceptron is where it all began.
        </p>
      </header>

      <BiologicalInspirationSection />
      <NeuronMathSection />
      <ActivationComparisonSection />
      <LearningRuleSection />
      <LinearSeparabilitySection />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: Perceptron from Scratch</h2>
        <p className="text-gray-300 leading-relaxed">
          Let's implement the perceptron in Python. The code below creates a Perceptron class
          with predict and train methods, then trains it on AND and OR logic gates. Both are
          linearly separable, so the perceptron converges quickly.
        </p>
        <PythonCell defaultCode={perceptronCode} title="Perceptron on AND/OR Gates" />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: The XOR Failure</h2>
        <p className="text-gray-300 leading-relaxed">
          Now watch the perceptron fail on XOR. We run 10 independent trials with random
          initial weights, each training for up to 1000 epochs. Every single trial fails to
          converge. No matter how long you train or what weights you start with, a single
          perceptron simply cannot learn XOR. This motivates multi-layer networks.
        </p>
        <PythonCell defaultCode={xorFailureCode} title="XOR: The Perceptron's Limit" />
      </section>
    </div>
  )
}
