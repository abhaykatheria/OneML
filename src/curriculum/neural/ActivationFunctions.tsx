import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'neural/activation-functions',
  title: 'Activation Functions',
  description: 'Why non-linearity matters and how different activation functions shape neural network behavior',
  track: 'neural',
  order: 4,
  tags: ['activation', 'sigmoid', 'tanh', 'relu', 'leaky-relu', 'elu', 'softmax', 'non-linearity'],
}

/* ------------------------------------------------------------------ */
/*  Activation function definitions                                    */
/* ------------------------------------------------------------------ */
function sigmoidFn(x: number): number {
  return 1 / (1 + Math.exp(-x))
}
function sigmoidDeriv(x: number): number {
  const s = sigmoidFn(x)
  return s * (1 - s)
}
function tanhFn(x: number): number {
  return Math.tanh(x)
}
function tanhDeriv(x: number): number {
  const t = Math.tanh(x)
  return 1 - t * t
}
function reluFn(x: number): number {
  return Math.max(0, x)
}
function reluDeriv(x: number): number {
  return x > 0 ? 1 : 0
}
function leakyReluFn(x: number, alpha = 0.01): number {
  return x > 0 ? x : alpha * x
}
function leakyReluDeriv(x: number, alpha = 0.01): number {
  return x > 0 ? 1 : alpha
}
function eluFn(x: number, alpha = 1.0): number {
  return x > 0 ? x : alpha * (Math.exp(x) - 1)
}
function eluDeriv(x: number, alpha = 1.0): number {
  return x > 0 ? 1 : alpha * Math.exp(x)
}

type ActivationFn = (x: number) => number

interface ActivationDef {
  name: string
  fn: ActivationFn
  deriv: ActivationFn
  color: [number, number, number]
  yRange: [number, number]
}

const ACTIVATIONS: ActivationDef[] = [
  { name: 'Sigmoid', fn: sigmoidFn, deriv: sigmoidDeriv, color: [80, 180, 220], yRange: [-0.2, 1.2] },
  { name: 'Tanh', fn: tanhFn, deriv: tanhDeriv, color: [180, 120, 220], yRange: [-1.5, 1.5] },
  { name: 'ReLU', fn: reluFn, deriv: reluDeriv, color: [220, 160, 60], yRange: [-1, 5] },
  { name: 'Leaky ReLU', fn: (x) => leakyReluFn(x, 0.1), deriv: (x) => leakyReluDeriv(x, 0.1), color: [120, 220, 80], yRange: [-1, 5] },
  { name: 'ELU', fn: eluFn, deriv: eluDeriv, color: [220, 100, 120], yRange: [-2, 5] },
]

/* ================================================================== */
/*  Section 1 — Why Non-Linearity?                                     */
/* ================================================================== */
function WhyNonLinearitySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Non-Linearity?</h2>
      <p className="text-gray-300 leading-relaxed">
        Suppose we stack two linear layers without any activation function. The first layer
        computes z1 = W1*x + b1, and the second computes z2 = W2*z1 + b2. Expanding:
        z2 = W2*W1*x + W2*b1 + b2 = W'*x + b'. This is just another linear function! No matter
        how many linear layers we stack, the result is equivalent to a single linear
        transformation. The network has no more representational power than one layer.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Activation functions inject non-linearity between layers, breaking this collapse. Each
        layer can now bend and reshape the data in ways that pure linear transformations cannot.
        This is what gives multi-layer networks their power to learn complex, non-linear decision
        boundaries and function approximations.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The choice of activation function has profound effects on training dynamics: how gradients
        flow backward, whether the network can learn quickly or gets stuck, and the kinds of
        functions it can represent efficiently. Let's explore the most important activation
        functions in deep learning.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Sigmoid Deep Dive                                      */
/* ================================================================== */
function SigmoidSection() {
  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 320)
      p.textFont('monospace')
    }

    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotLeft = 70
      const plotRight = W - 30
      const plotTop = 40
      const plotBottom = H - 40
      const plotW = plotRight - plotLeft
      const xRange: [number, number] = [-6, 6]
      const yRange: [number, number] = [-0.1, 1.1]

      // Grid lines
      p.stroke(35)
      p.strokeWeight(1)
      for (let yVal = 0; yVal <= 1; yVal += 0.25) {
        const y = p.map(yVal, yRange[0], yRange[1], plotBottom, plotTop)
        p.line(plotLeft, y, plotRight, y)
        p.noStroke()
        p.fill(100)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(yVal.toFixed(2), plotLeft - 5, y)
        p.stroke(35)
      }

      // Zero line
      const zeroY = p.map(0, yRange[0], yRange[1], plotBottom, plotTop)
      p.stroke(60)
      p.line(plotLeft, zeroY, plotRight, zeroY)
      const zeroX = p.map(0, xRange[0], xRange[1], plotLeft, plotRight)
      p.line(zeroX, plotTop, zeroX, plotBottom)

      // Sigmoid curve
      p.noFill()
      p.stroke(80, 180, 220)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = p.map(px, 0, plotW, xRange[0], xRange[1])
        const y = sigmoidFn(x)
        p.vertex(plotLeft + px, p.map(y, yRange[0], yRange[1], plotBottom, plotTop))
      }
      p.endShape()

      // Sigmoid derivative
      p.stroke(220, 140, 80)
      p.strokeWeight(2)
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = p.map(px, 0, plotW, xRange[0], xRange[1])
        const y = sigmoidDeriv(x)
        p.vertex(plotLeft + px, p.map(y, yRange[0], yRange[1], plotBottom, plotTop))
      }
      p.endShape()

      // Highlight max derivative point
      const maxDerivX = p.map(0, xRange[0], xRange[1], plotLeft, plotRight)
      const maxDerivY = p.map(0.25, yRange[0], yRange[1], plotBottom, plotTop)
      p.noStroke()
      p.fill(220, 140, 80)
      p.ellipse(maxDerivX, maxDerivY, 8, 8)
      p.fill(220, 160, 100)
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text('max = 0.25', maxDerivX + 8, maxDerivY - 5)

      // Interactive cursor
      if (p.mouseX > plotLeft && p.mouseX < plotRight && p.mouseY > plotTop && p.mouseY < plotBottom) {
        const xVal = p.map(p.mouseX, plotLeft, plotRight, xRange[0], xRange[1])
        const yVal = sigmoidFn(xVal)
        const dVal = sigmoidDeriv(xVal)
        const yScreen = p.map(yVal, yRange[0], yRange[1], plotBottom, plotTop)

        p.stroke(255, 255, 255, 60)
        p.strokeWeight(1)
        p.line(p.mouseX, plotTop, p.mouseX, plotBottom)

        p.noStroke()
        p.fill(80, 180, 220)
        p.ellipse(p.mouseX, yScreen, 8, 8)

        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT)
        p.text(`x=${xVal.toFixed(2)} sig=${yVal.toFixed(3)} sig'=${dVal.toFixed(3)}`, p.mouseX + 10, yScreen - 10)
      }

      // Legend
      p.noStroke()
      p.fill(80, 180, 220)
      p.rect(plotLeft + 10, plotTop + 5, 14, 3)
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text('sigmoid(x)', plotLeft + 28, plotTop + 10)

      p.fill(220, 140, 80)
      p.rect(plotLeft + 10, plotTop + 20, 14, 3)
      p.fill(160)
      p.text("sigmoid'(x)", plotLeft + 28, plotTop + 25)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Sigmoid: \u03C3(x) = 1 / (1 + e^(-x))', W / 2, 20)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Sigmoid</h2>
      <p className="text-gray-300 leading-relaxed">
        The sigmoid function squashes any real number into the range (0, 1), making it
        historically popular for binary classification and as a "firing rate" analogy. Its formula
        is sigma(x) = 1 / (1 + e^(-x)). Hover over the plot to see the function and derivative
        values at any point.
      </p>
      <P5Sketch sketch={sketch} height={320} />
      <h3 className="text-xl font-semibold text-white mt-4">Problems with Sigmoid</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 leading-relaxed">
        <li><strong>Vanishing gradients:</strong> The maximum derivative is only 0.25 (at x=0). For |x| &gt; 4, the derivative is essentially 0, killing gradient flow.</li>
        <li><strong>Not zero-centered:</strong> Outputs are always positive (0 to 1), which means gradients on the weights are always the same sign, causing zig-zagging during optimization.</li>
        <li><strong>Expensive:</strong> Computing exp() is slower than simpler alternatives.</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Tanh vs Sigmoid                                        */
/* ================================================================== */
function TanhSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Tanh: A Better Sigmoid</h2>
      <p className="text-gray-300 leading-relaxed">
        Tanh (hyperbolic tangent) is closely related to sigmoid: tanh(x) = 2*sigmoid(2x) - 1.
        It squashes values to the range (-1, 1) instead of (0, 1). This zero-centering makes
        optimization smoother because gradients can be both positive and negative.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Tanh has a steeper gradient than sigmoid (max derivative = 1.0 vs 0.25), so it suffers
        less from vanishing gradients -- but the problem still exists for large |x|. Tanh was the
        default activation for recurrent networks (LSTMs, GRUs) for many years and remains
        commonly used inside attention mechanisms.
      </p>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Sigmoid vs Tanh Comparison</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <p className="font-medium text-blue-400 mb-1">Sigmoid</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Range: (0, 1)</li>
              <li>Max derivative: 0.25</li>
              <li>Not zero-centered</li>
              <li>Good for: output probabilities</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-purple-400 mb-1">Tanh</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Range: (-1, 1)</li>
              <li>Max derivative: 1.0</li>
              <li>Zero-centered</li>
              <li>Good for: hidden layers, RNNs</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — ReLU and Dying ReLU                                    */
/* ================================================================== */
function ReLUSection() {
  const [biasValue, setBiasValue] = useState(0.0)
  const stateRef = useRef({ biasValue })
  stateRef.current = { biasValue }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 340)
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
      const plotBottom = H - 50
      const plotW = plotRight - plotLeft
      const plotH = plotBottom - plotTop
      const xRange: [number, number] = [-5, 5]
      const yRange: [number, number] = [-1, 5]

      // Grid
      p.stroke(35)
      p.strokeWeight(1)
      const zeroY = p.map(0, yRange[0], yRange[1], plotBottom, plotTop)
      const zeroX = p.map(0, xRange[0], xRange[1], plotLeft, plotRight)
      p.stroke(60)
      p.line(plotLeft, zeroY, plotRight, zeroY)
      p.line(zeroX, plotTop, zeroX, plotBottom)

      // ReLU curve
      p.noFill()
      p.stroke(220, 160, 60)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = p.map(px, 0, plotW, xRange[0], xRange[1])
        const y = reluFn(x + s.biasValue)
        p.vertex(plotLeft + px, p.map(y, yRange[0], yRange[1], plotBottom, plotTop))
      }
      p.endShape()

      // ReLU derivative
      p.stroke(220, 100, 60)
      p.strokeWeight(1.5)
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = p.map(px, 0, plotW, xRange[0], xRange[1])
        const y = reluDeriv(x + s.biasValue)
        p.vertex(plotLeft + px, p.map(y, yRange[0], yRange[1], plotBottom, plotTop))
      }
      p.endShape()

      // "Dead zone" shading
      const deadRight = p.map(-s.biasValue, xRange[0], xRange[1], plotLeft, plotRight)
      if (deadRight > plotLeft) {
        p.noStroke()
        p.fill(220, 60, 60, 25)
        p.rect(plotLeft, plotTop, Math.min(deadRight - plotLeft, plotW), plotH)
        p.fill(220, 100, 80, 150)
        p.textSize(11)
        p.textAlign(p.CENTER)
        p.text('DEAD ZONE', (plotLeft + Math.min(deadRight, plotRight)) / 2, plotTop + 20)
        p.textSize(9)
        p.text('gradient = 0', (plotLeft + Math.min(deadRight, plotRight)) / 2, plotTop + 34)
      }

      // Legend
      p.noStroke()
      p.fill(220, 160, 60)
      p.rect(plotLeft + 10, plotTop + 50, 14, 3)
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text('ReLU(x)', plotLeft + 28, plotTop + 55)

      p.fill(220, 100, 60)
      p.rect(plotLeft + 10, plotTop + 65, 14, 3)
      p.fill(160)
      p.text("ReLU'(x)", plotLeft + 28, plotTop + 70)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('ReLU: max(0, x) and the Dying ReLU Problem', W / 2, 25)

      // Axis labels
      p.fill(120)
      p.textSize(9)
      p.textAlign(p.CENTER)
      for (let xVal = -4; xVal <= 4; xVal += 2) {
        const x = p.map(xVal, xRange[0], xRange[1], plotLeft, plotRight)
        p.text(String(xVal), x, plotBottom + 14)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">ReLU: Rectified Linear Unit</h2>
      <p className="text-gray-300 leading-relaxed">
        ReLU (Rectified Linear Unit) is the most widely used activation function in modern deep
        learning. Its formula is dead simple: f(x) = max(0, x). For positive inputs it's the
        identity function (derivative = 1), and for negative inputs it outputs zero (derivative
        = 0). This simplicity brings three major advantages:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-1 leading-relaxed">
        <li><strong>No vanishing gradient for positive inputs:</strong> the derivative is exactly 1, so gradients pass through unchanged.</li>
        <li><strong>Sparse activation:</strong> only a subset of neurons fire (output &gt; 0), which is computationally efficient and provides a form of regularization.</li>
        <li><strong>Computationally fast:</strong> no exponentials, just a comparison and a max.</li>
      </ul>
      <P5Sketch
        sketch={sketch}
        height={340}
        controls={
          <ControlPanel title="ReLU Parameters">
            <InteractiveSlider
              label="Bias shift"
              min={-3}
              max={3}
              step={0.1}
              value={biasValue}
              onChange={setBiasValue}
            />
          </ControlPanel>
        }
      />
      <h3 className="text-xl font-semibold text-white mt-4">The Dying ReLU Problem</h3>
      <p className="text-gray-300 leading-relaxed">
        The red "dead zone" in the plot shows where ReLU outputs zero and has zero gradient. If
        a neuron's weighted sum becomes consistently negative (perhaps due to a large negative
        bias or a big gradient update), it will always output zero and receive zero gradient. It
        is effectively "dead" and can never recover. Shift the bias left to see the dead zone
        grow. In practice, a poorly initialized or too-high learning rate can kill 10-40% of
        neurons in a network.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Leaky ReLU & ELU                                       */
/* ================================================================== */
function LeakyReLUSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Leaky ReLU and ELU</h2>
      <p className="text-gray-300 leading-relaxed">
        To fix the dying ReLU problem, several variants have been proposed that allow a small
        gradient when the input is negative.
      </p>
      <h3 className="text-xl font-semibold text-white mt-4">Leaky ReLU</h3>
      <p className="text-gray-300 leading-relaxed">
        Leaky ReLU uses a small slope alpha (typically 0.01 or 0.1) for negative inputs:
        f(x) = x if x &gt; 0, else alpha * x. This ensures no neuron ever has a zero gradient,
        solving the dying ReLU problem. Parametric ReLU (PReLU) makes alpha a learnable parameter.
      </p>
      <h3 className="text-xl font-semibold text-white mt-4">ELU (Exponential Linear Unit)</h3>
      <p className="text-gray-300 leading-relaxed">
        ELU uses an exponential curve for negative inputs: f(x) = x if x &gt; 0, else
        alpha * (e^x - 1). Unlike Leaky ReLU, ELU saturates to -alpha for very negative inputs,
        which pushes the mean activation closer to zero and can speed up learning. However, it
        requires computing exp(), making it slower than ReLU variants.
      </p>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">When to Use What</h3>
        <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm leading-relaxed">
          <li><strong>ReLU:</strong> Default choice. Start here. Works well for most tasks.</li>
          <li><strong>Leaky ReLU:</strong> If you suspect dying neurons. Almost no downside over ReLU.</li>
          <li><strong>ELU:</strong> When you want zero-centered activations without batch normalization.</li>
          <li><strong>GELU/SiLU:</strong> Popular in transformers (BERT, GPT). Smooth approximation of ReLU.</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Softmax                                                */
/* ================================================================== */
function SoftmaxSection() {
  const [logit1, setLogit1] = useState(2.0)
  const [logit2, setLogit2] = useState(1.0)
  const [logit3, setLogit3] = useState(-1.0)

  const stateRef = useRef({ logit1, logit2, logit3 })
  stateRef.current = { logit1, logit2, logit3 }

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

      const logits = [s.logit1, s.logit2, s.logit3]
      const labels = ['Cat', 'Dog', 'Bird']
      const colors: [number, number, number][] = [
        [80, 180, 220],
        [220, 160, 60],
        [120, 220, 80],
      ]

      // Compute softmax
      const maxLogit = Math.max(...logits)
      const exps = logits.map((l) => Math.exp(l - maxLogit))
      const sumExps = exps.reduce((a, b) => a + b, 0)
      const probs = exps.map((e) => e / sumExps)

      // Left side: logits as bars
      const barLeft = 60
      const barW = 100
      const barTop = 60
      const barSpacing = 65
      const logitScale = 30

      p.fill(160)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text('Logits (raw)', barLeft + barW / 2, 30)

      for (let i = 0; i < 3; i++) {
        const y = barTop + i * barSpacing
        const barH = 30
        const valW = Math.abs(logits[i]) * logitScale
        const startX = logits[i] >= 0 ? barLeft + barW / 2 : barLeft + barW / 2 - valW

        p.fill(colors[i][0], colors[i][1], colors[i][2], 100)
        p.rect(startX, y, valW, barH, 3)

        // Zero line
        p.stroke(80)
        p.strokeWeight(1)
        p.line(barLeft + barW / 2, y, barLeft + barW / 2, y + barH)
        p.noStroke()

        // Label
        p.fill(200)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(labels[i], barLeft - 5, y + barH / 2)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(logits[i].toFixed(1), barLeft + barW + 8, y + barH / 2)
      }

      // Arrow
      const arrowX = barLeft + barW + 60
      p.stroke(120)
      p.strokeWeight(2)
      p.line(arrowX, H / 2, arrowX + 50, H / 2)
      p.line(arrowX + 40, H / 2 - 8, arrowX + 50, H / 2)
      p.line(arrowX + 40, H / 2 + 8, arrowX + 50, H / 2)
      p.noStroke()
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text('softmax', arrowX + 25, H / 2 - 14)

      // Right side: probability bars
      const probLeft = arrowX + 70
      const probMaxW = W - probLeft - 80

      p.fill(160)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text('Probabilities', probLeft + probMaxW / 2, 30)

      for (let i = 0; i < 3; i++) {
        const y = barTop + i * barSpacing
        const barH = 30
        const valW = probs[i] * probMaxW

        p.fill(colors[i][0], colors[i][1], colors[i][2], 180)
        p.rect(probLeft, y, valW, barH, 3)

        p.fill(200)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(labels[i], probLeft - 5, y + barH / 2)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${(probs[i] * 100).toFixed(1)}%`, probLeft + valW + 8, y + barH / 2)
      }

      // Sum = 1 check
      p.fill(100)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text(`Sum: ${probs.reduce((a, b) => a + b, 0).toFixed(4)}`, probLeft + probMaxW / 2, H - 15)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Softmax: Logits to Probabilities', W / 2, 18)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Softmax: From Logits to Probabilities</h2>
      <p className="text-gray-300 leading-relaxed">
        Softmax is not used as a hidden layer activation -- it's the standard output activation
        for multi-class classification. Given a vector of raw scores (logits), softmax converts
        them into a probability distribution: softmax(z_i) = e^(z_i) / sum(e^(z_j)). The outputs
        are always positive and sum to 1, making them interpretable as class probabilities.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Adjust the logit sliders below to see how changing raw scores affects the probability
        distribution. Notice that increasing one logit decreases the others' probabilities --
        softmax is a "soft" version of argmax that creates competition between classes.
      </p>
      <P5Sketch
        sketch={sketch}
        height={300}
        controls={
          <ControlPanel title="Logit Values">
            <InteractiveSlider label="Cat logit" min={-4} max={4} step={0.1} value={logit1} onChange={setLogit1} />
            <InteractiveSlider label="Dog logit" min={-4} max={4} step={0.1} value={logit2} onChange={setLogit2} />
            <InteractiveSlider label="Bird logit" min={-4} max={4} step={0.1} value={logit3} onChange={setLogit3} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Comparison Gallery                                     */
/* ================================================================== */
function ComparisonGallerySection() {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const stateRef = useRef({ selectedIdx })
  stateRef.current = { selectedIdx }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 360)
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
      const plotBottom = H - 50
      const plotW = plotRight - plotLeft
      const xRange: [number, number] = [-5, 5]

      // Draw all activations faintly, selected one brightly
      for (let ai = 0; ai < ACTIVATIONS.length; ai++) {
        const act = ACTIVATIONS[ai]
        const isSelected = ai === s.selectedIdx
        const yR = act.yRange

        // Function
        p.noFill()
        p.stroke(
          act.color[0],
          act.color[1],
          act.color[2],
          isSelected ? 255 : 40
        )
        p.strokeWeight(isSelected ? 3 : 1)
        p.beginShape()
        for (let px = 0; px <= plotW; px += 2) {
          const x = p.map(px, 0, plotW, xRange[0], xRange[1])
          const y = act.fn(x)
          const sy = p.map(y, isSelected ? yR[0] : -2, isSelected ? yR[1] : 6, plotBottom, plotTop)
          p.vertex(plotLeft + px, p.constrain(sy, plotTop, plotBottom))
        }
        p.endShape()

        // Derivative (only for selected)
        if (isSelected) {
          p.stroke(act.color[0], act.color[1], act.color[2], 120)
          p.strokeWeight(1.5)
          const dashLen = 6
          for (let px = 0; px <= plotW; px += 2) {
            const x = p.map(px, 0, plotW, xRange[0], xRange[1])
            const y = act.deriv(x)
            const sy = p.map(y, yR[0], yR[1], plotBottom, plotTop)
            if (Math.floor(px / dashLen) % 2 === 0) {
              p.point(plotLeft + px, p.constrain(sy, plotTop, plotBottom))
            }
          }
        }
      }

      // Axes
      const selAct = ACTIVATIONS[s.selectedIdx]
      const zeroY = p.map(0, selAct.yRange[0], selAct.yRange[1], plotBottom, plotTop)
      const zeroX = p.map(0, xRange[0], xRange[1], plotLeft, plotRight)
      p.stroke(60)
      p.strokeWeight(1)
      p.line(plotLeft, zeroY, plotRight, zeroY)
      p.line(zeroX, plotTop, zeroX, plotBottom)

      // Legend
      for (let ai = 0; ai < ACTIVATIONS.length; ai++) {
        const act = ACTIVATIONS[ai]
        const isSelected = ai === s.selectedIdx
        const ly = plotTop + 10 + ai * 18
        p.noStroke()
        p.fill(act.color[0], act.color[1], act.color[2], isSelected ? 255 : 80)
        p.rect(plotRight - 120, ly, 12, 12, 2)
        p.fill(isSelected ? 255 : 100)
        p.textSize(10)
        p.textAlign(p.LEFT)
        p.text(act.name, plotRight - 104, ly + 10)
      }

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text(`Activation Functions -- ${selAct.name} (solid: f, dashed: f')`, W / 2, 25)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Comparison Gallery</h2>
      <p className="text-gray-300 leading-relaxed">
        Select an activation function to see it highlighted along with its derivative (dashed).
        All other functions are shown faintly for comparison. Notice the different shapes,
        ranges, and derivative behaviors. Each has trade-offs that affect training dynamics.
      </p>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <ControlPanel title="Select Activation">
            <div className="flex flex-wrap gap-2">
              {ACTIVATIONS.map((act, i) => (
                <button
                  key={act.name}
                  onClick={() => setSelectedIdx(i)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedIdx === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {act.name}
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
/*  Section 8 — Python: Implement All Activations                      */
/* ================================================================== */
function PythonActivationsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Implement All Activations</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's implement every activation function and its derivative in NumPy, then compare
        their behavior on a range of inputs. Understanding the numerical properties of each
        function is essential for debugging training issues.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

x = np.linspace(-5, 5, 1000)

# === Activation functions ===
def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def sigmoid_deriv(x):
    s = sigmoid(x)
    return s * (1 - s)

def tanh(x):
    return np.tanh(x)

def tanh_deriv(x):
    return 1 - np.tanh(x)**2

def relu(x):
    return np.maximum(0, x)

def relu_deriv(x):
    return (x > 0).astype(float)

def leaky_relu(x, alpha=0.01):
    return np.where(x > 0, x, alpha * x)

def leaky_relu_deriv(x, alpha=0.01):
    return np.where(x > 0, 1.0, alpha)

def elu(x, alpha=1.0):
    return np.where(x > 0, x, alpha * (np.exp(x) - 1))

def elu_deriv(x, alpha=1.0):
    return np.where(x > 0, 1.0, alpha * np.exp(x))

def softmax(logits):
    e = np.exp(logits - np.max(logits))
    return e / e.sum()

# === Compare properties ===
activations = {
    'Sigmoid': (sigmoid, sigmoid_deriv),
    'Tanh':    (tanh, tanh_deriv),
    'ReLU':    (relu, relu_deriv),
    'Leaky ReLU': (leaky_relu, leaky_relu_deriv),
    'ELU':     (elu, elu_deriv),
}

print(f"{'Function':>12}  {'Range':>15}  {'Max Deriv':>10}  {'Zero-centered':>14}")
print("-" * 58)
for name, (fn, deriv_fn) in activations.items():
    vals = fn(x)
    derivs = deriv_fn(x)
    range_str = f"[{vals.min():.2f}, {vals.max():.2f}]"
    max_d = derivs.max()
    centered = "Yes" if vals.min() < -0.01 else "No"
    print(f"{name:>12}  {range_str:>15}  {max_d:>10.3f}  {centered:>14}")

# === Softmax example ===
print("\\n--- Softmax ---")
logits = np.array([2.0, 1.0, -1.0])
probs = softmax(logits)
print(f"Logits:       {logits}")
print(f"Probabilities:{probs}")
print(f"Sum:          {probs.sum():.6f}")

# === Gradient flow simulation ===
print("\\n--- Gradient flow through 10 layers ---")
for name, (fn, deriv_fn) in activations.items():
    grad = 1.0
    # Use derivative at x=0.5 (typical activation region)
    d = deriv_fn(np.array([0.5]))[0]
    for _ in range(10):
        grad *= d * 0.7  # weight factor ~0.7
    print(f"{name:>12}: gradient after 10 layers = {grad:.2e}")`}
        title="All activation functions -- implementation and comparison"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 — Python: Effect on Training                             */
/* ================================================================== */
function TrainingEffectSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Experiment: Activation Choice Affects Training</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's train the same network architecture on XOR using different activation functions
        and compare convergence speed. This makes the practical difference concrete.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

X = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
Y = np.array([[0],[1],[1],[0]], dtype=float)

def train_with_activation(act_name, epochs=2000, lr=1.0):
    np.random.seed(42)
    W1 = np.random.randn(2, 4) * 0.5
    b1 = np.zeros((1, 4))
    W2 = np.random.randn(4, 1) * 0.5
    b2 = np.zeros((1, 1))

    def forward_act(x):
        if act_name == 'sigmoid':
            return 1/(1+np.exp(-np.clip(x,-500,500)))
        elif act_name == 'tanh':
            return np.tanh(x)
        elif act_name == 'relu':
            return np.maximum(0, x)
        elif act_name == 'leaky_relu':
            return np.where(x > 0, x, 0.01*x)

    def backward_act(x):
        if act_name == 'sigmoid':
            s = 1/(1+np.exp(-np.clip(x,-500,500)))
            return s*(1-s)
        elif act_name == 'tanh':
            return 1 - np.tanh(x)**2
        elif act_name == 'relu':
            return (x > 0).astype(float)
        elif act_name == 'leaky_relu':
            return np.where(x > 0, 1.0, 0.01)

    losses = []
    for ep in range(epochs):
        z1 = X @ W1 + b1
        a1 = forward_act(z1)
        z2 = a1 @ W2 + b2
        # Always use sigmoid for output (binary classification)
        a2 = 1/(1+np.exp(-np.clip(z2,-500,500)))

        loss = np.mean((a2 - Y)**2)
        losses.append(loss)

        dz2 = 2/4 * (a2 - Y) * a2 * (1 - a2)
        dW2 = a1.T @ dz2
        db2 = np.sum(dz2, axis=0, keepdims=True)
        da1 = dz2 @ W2.T
        dz1 = da1 * backward_act(z1)
        dW1 = X.T @ dz1
        db1 = np.sum(dz1, axis=0, keepdims=True)

        W2 -= lr * dW2; b2 -= lr * db2
        W1 -= lr * dW1; b1 -= lr * db1

    return losses

results = {}
for name in ['sigmoid', 'tanh', 'relu', 'leaky_relu']:
    lr = 1.0 if name in ['sigmoid', 'tanh'] else 0.1
    results[name] = train_with_activation(name, epochs=2000, lr=lr)

print(f"{'Activation':>12}  {'Loss@100':>10}  {'Loss@500':>10}  {'Loss@2000':>10}")
print("-" * 48)
for name, losses in results.items():
    print(f"{name:>12}  {losses[99]:>10.6f}  {losses[499]:>10.6f}  {losses[-1]:>10.6f}")`}
        title="Training comparison with different activations on XOR"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 10 — Key Takeaways                                         */
/* ================================================================== */
function KeyTakeawaysSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Key Takeaways</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
        <li>
          Non-linear activation functions are essential: without them, stacking layers gives no
          additional representational power over a single linear layer.
        </li>
        <li>
          Sigmoid squashes to (0,1) but suffers from vanishing gradients (max derivative 0.25)
          and non-zero-centering. Best used for output layers in binary classification.
        </li>
        <li>
          Tanh squashes to (-1,1) with a stronger gradient (max 1.0) and zero-centering.
          Better than sigmoid for hidden layers, still popular in RNNs.
        </li>
        <li>
          ReLU (max(0,x)) is the default for modern networks: no vanishing gradient for positive
          inputs, sparse activations, computationally simple. Watch out for dying neurons.
        </li>
        <li>
          Leaky ReLU and ELU fix the dying ReLU problem by allowing small gradients for
          negative inputs. Good alternatives when dying neurons are a concern.
        </li>
        <li>
          Softmax converts logits to a probability distribution for multi-class classification.
          It is used at the output layer, not in hidden layers.
        </li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function ActivationFunctions() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white">Activation Functions</h1>
        <p className="text-lg text-gray-400">
          Why non-linearity matters and how different activation functions shape neural network behavior.
        </p>
      </header>

      <WhyNonLinearitySection />
      <SigmoidSection />
      <TanhSection />
      <ReLUSection />
      <LeakyReLUSection />
      <SoftmaxSection />
      <ComparisonGallerySection />
      <PythonActivationsSection />
      <TrainingEffectSection />
      <KeyTakeawaysSection />
    </div>
  )
}
