import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'neural/backpropagation',
  title: 'Backpropagation',
  description: 'The algorithm that makes deep learning possible: computing gradients through the chain rule',
  track: 'neural',
  order: 3,
  tags: ['backpropagation', 'chain-rule', 'gradients', 'vanishing-gradients', 'computation-graph'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function sigmoidDeriv(x: number): number {
  const s = sigmoid(x)
  return s * (1 - s)
}

/* ================================================================== */
/*  Section 1 — The Training Problem                                   */
/* ================================================================== */
function TrainingProblemSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Training Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        In the previous lesson we saw that a multi-layer network can represent complex functions.
        But how do we find the right weights? A network with thousands of parameters lives in a
        vast, high-dimensional space. We need a systematic way to adjust every weight so the
        network's output gets closer to the desired target.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The answer is gradient descent: compute the gradient of the loss function with respect
        to every weight, then nudge each weight in the direction that reduces the loss. For a
        single neuron, the gradient is straightforward. But for a deep network with many layers,
        we need a way to propagate the error signal backward from the output through every layer
        to every weight. This is backpropagation.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Backpropagation is not a separate learning algorithm -- it is simply the chain rule of
        calculus applied systematically to a computation graph. It was popularized by Rumelhart,
        Hinton, and Williams in 1986, and it remains the workhorse of all neural network training
        today.
      </p>
      <h3 className="text-xl font-semibold text-white mt-6">The Key Insight</h3>
      <p className="text-gray-300 leading-relaxed">
        The loss depends on the output, the output depends on the last layer's weights, which
        depend on the second-to-last layer's activations, which depend on earlier weights, and
        so on. The chain rule lets us decompose this long dependency into a product of local
        derivatives, each of which is easy to compute. We just need to be organized about it.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Chain Rule Computation Graph                           */
/* ================================================================== */
function ChainRuleSection() {
  const [showBackward, setShowBackward] = useState(false)
  const stateRef = useRef({ showBackward })
  stateRef.current = { showBackward }

  const sketch = useCallback((p: p5) => {
    // Computation graph: x -> (*w) -> (+b) -> sigmoid -> L
    // With concrete values
    const x = 2.0
    const w = 0.5
    const b = -0.3
    const target = 1.0

    // Forward values
    const mult = x * w        // 1.0
    const add = mult + b      // 0.7
    const sig = sigmoid(add)  // ~0.668
    const loss = (sig - target) ** 2  // ~0.110

    // Backward gradients
    const dL_dsig = 2 * (sig - target)         // ~-0.664
    const dsig_dadd = sigmoidDeriv(add)         // ~0.222
    const dL_dadd = dL_dsig * dsig_dadd        // ~-0.147
    const dL_dmult = dL_dadd * 1               // ~-0.147
    const dL_db = dL_dadd * 1                  // ~-0.147
    const dL_dw = dL_dmult * x                 // ~-0.295
    const dL_dx = dL_dmult * w                 // ~-0.074

    let animT = 0

    p.setup = () => {
      p.createCanvas(p.windowWidth > 760 ? 760 : p.windowWidth - 40, 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      if (s.showBackward) {
        animT = Math.min(animT + 0.008, 1)
      } else {
        animT = Math.max(animT - 0.02, 0)
      }

      // Node positions (left to right)
      const nodes = [
        { label: 'x', val: x, x: 60, y: 100 },
        { label: 'w', val: w, x: 60, y: 260 },
        { label: '*', val: mult, x: 200, y: 180 },
        { label: 'b', val: b, x: 200, y: 320 },
        { label: '+', val: add, x: 360, y: 220 },
        { label: '\u03C3', val: sig, x: 500, y: 220 },
        { label: 'L', val: loss, x: 640, y: 220 },
      ]

      // Edges: [from, to, forward_label, backward_gradient]
      const edges: [number, number, string, number][] = [
        [0, 2, `x=${x}`, dL_dx],
        [1, 2, `w=${w}`, dL_dw],
        [2, 4, `${mult.toFixed(2)}`, dL_dmult],
        [3, 4, `b=${b}`, dL_db],
        [4, 5, `${add.toFixed(2)}`, dL_dadd],
        [5, 6, `${sig.toFixed(3)}`, dL_dsig],
      ]

      // Draw edges
      for (const [fi, ti, fLabel, bGrad] of edges) {
        const from = nodes[fi]
        const to = nodes[ti]

        // Forward edge (blue)
        p.stroke(80, 140, 220, 180)
        p.strokeWeight(2)
        p.line(from.x + 22, from.y, to.x - 22, to.y)

        // Forward label
        p.noStroke()
        p.fill(120, 170, 240)
        p.textSize(9)
        p.textAlign(p.CENTER)
        const mx = (from.x + to.x) / 2
        const my = (from.y + to.y) / 2 - 12
        p.text(fLabel, mx, my)

        // Backward edge (red, animated)
        if (animT > 0) {
          const alpha = animT * 200
          p.stroke(240, 100, 80, alpha)
          p.strokeWeight(2)
          // Draw slightly offset below
          const dx = to.x - from.x
          const dy = to.y - from.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const nx = -dy / len * 8
          const ny = dx / len * 8
          p.line(to.x - 22 + nx, to.y + ny, from.x + 22 + nx, from.y + ny)

          // Arrowhead
          const ax = from.x + 22 + nx
          const ay = from.y + ny
          const angle = Math.atan2(from.y + ny - (to.y + ny), from.x + 22 + nx - (to.x - 22 + nx))
          p.fill(240, 100, 80, alpha)
          p.noStroke()
          p.triangle(
            ax, ay,
            ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4),
            ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4)
          )

          // Gradient label
          p.fill(240, 140, 120, alpha)
          p.textSize(9)
          p.textAlign(p.CENTER)
          p.text(`\u2202L = ${bGrad.toFixed(3)}`, mx + nx, my + ny + 26)
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isOp = ['*', '+', '\u03C3', 'L'].includes(node.label)
        p.noStroke()
        if (isOp) {
          p.fill(60, 60, 90)
        } else {
          p.fill(40, 80, 60)
        }
        p.ellipse(node.x, node.y, 44, 44)

        p.fill(255)
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(node.label, node.x, node.y - 3)

        p.fill(180, 200, 180)
        p.textSize(9)
        p.text(node.val.toFixed(3), node.x, node.y + 13)
      }

      // Legend
      p.fill(80, 140, 220)
      p.noStroke()
      p.rect(20, H - 40, 12, 3)
      p.fill(160)
      p.textSize(11)
      p.textAlign(p.LEFT)
      p.text('Forward', 38, H - 36)

      p.fill(240, 100, 80)
      p.rect(110, H - 40, 12, 3)
      p.fill(160)
      p.text('Backward (gradients)', 128, H - 36)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Computation Graph: Forward & Backward Pass', W / 2, 25)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Chain Rule on a Computation Graph</h2>
      <p className="text-gray-300 leading-relaxed">
        Every neural network computation can be represented as a directed acyclic graph (DAG).
        Each node is an operation (multiply, add, sigmoid) and each edge carries a value. During
        the forward pass, values flow left to right. During the backward pass, gradients flow
        right to left, each edge carrying the partial derivative of the loss with respect to the
        value on that edge.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Toggle the backward pass to see the gradients flow in red. Notice how each gradient
        is the product of local derivatives along the path from the loss back to that variable.
        This is the chain rule in action: dL/dw = dL/dsig * dsig/dadd * dadd/dmult * dmult/dw.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Computation Graph">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBackward(!showBackward)}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                  showBackward
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {showBackward ? 'Hide Backward Pass' : 'Show Backward Pass'}
              </button>
              <span className="text-sm text-gray-400">
                {showBackward ? 'Red arrows show gradient flow' : 'Blue arrows show forward data flow'}
              </span>
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Backprop on a Full Network                             */
/* ================================================================== */
function BackpropNetworkSection() {
  const [animProgress, setAnimProgress] = useState(0.0)
  const stateRef = useRef({ animProgress })
  stateRef.current = { animProgress }

  const sketch = useCallback((p: p5) => {
    // [2, 3, 1] network with pre-set weights
    const arch = [2, 3, 1]
    const w1 = [
      [0.5, -0.3, 0.8],
      [0.2, 0.7, -0.4],
    ]
    const b1 = [0.1, -0.2, 0.3]
    const w2 = [[0.6], [-0.5], [0.9]]
    const b2 = [-0.1]

    const input = [0.8, 0.4]
    const target = 1.0

    // Forward pass
    const z1: number[] = []
    const a1: number[] = []
    for (let j = 0; j < 3; j++) {
      const z = input[0] * w1[0][j] + input[1] * w1[1][j] + b1[j]
      z1.push(z)
      a1.push(sigmoid(z))
    }
    const z2 = a1[0] * w2[0][0] + a1[1] * w2[1][0] + a1[2] * w2[2][0] + b2[0]
    const a2 = sigmoid(z2)

    // Backward pass
    const dL_da2 = 2 * (a2 - target)
    const da2_dz2 = sigmoidDeriv(z2)
    const delta2 = dL_da2 * da2_dz2

    const delta1: number[] = []
    for (let j = 0; j < 3; j++) {
      delta1.push(delta2 * w2[j][0] * sigmoidDeriv(z1[j]))
    }

    // Gradient magnitudes for coloring
    const gradMags = [
      ...delta1.map(Math.abs),
      Math.abs(delta2),
    ]
    const maxGrad = Math.max(...gradMags, 0.001)

    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const layerX = [100, W / 2, W - 100]
      const layerY: number[][] = [
        [H * 0.35, H * 0.65],
        [H * 0.2, H * 0.5, H * 0.8],
        [H * 0.5],
      ]

      const allActivations = [input, a1, [a2]]
      const allDeltas = [
        delta1.map((d) => d * 0), // input "gradients" (not used, show 0)
        delta1,
        [delta2],
      ]

      // Determine backward animation progress
      const prog = s.animProgress

      // Draw connections
      for (let l = 0; l < arch.length - 1; l++) {
        for (let i = 0; i < arch[l]; i++) {
          for (let j = 0; j < arch[l + 1]; j++) {
            const from = { x: layerX[l], y: layerY[l][i] }
            const to = { x: layerX[l + 1], y: layerY[l + 1][j] }

            // Forward connections (faint)
            p.stroke(70, 120, 180, 50)
            p.strokeWeight(1.5)
            p.line(from.x + 18, from.y, to.x - 18, to.y)

            // Backward gradient flow
            if (prog > 0) {
              const layerProg = l === arch.length - 2
                ? p.constrain(prog * 2, 0, 1)
                : p.constrain(prog * 2 - 1, 0, 1)
              if (layerProg > 0) {
                const gradMag = l === 0
                  ? Math.abs(delta1[j]) / maxGrad
                  : Math.abs(delta2) / maxGrad
                const alpha = layerProg * 200
                const red = p.lerp(80, 255, gradMag)
                p.stroke(red, 60, 60, alpha)
                p.strokeWeight(p.lerp(1, 3, gradMag))
                // Draw from right to left
                const endX = p.lerp(to.x - 18, from.x + 18, layerProg)
                const endY = p.lerp(to.y, from.y, layerProg)
                p.line(to.x - 18, to.y, endX, endY)
              }
            }
          }
        }
      }

      // Draw neurons
      for (let l = 0; l < arch.length; l++) {
        for (let i = 0; i < arch[l]; i++) {
          const x = layerX[l]
          const y = layerY[l][i]
          const act = allActivations[l][i]
          const delta = allDeltas[l][i]

          // Color by gradient magnitude during backward
          let nodeColor: [number, number, number]
          if (prog > 0 && l > 0) {
            const gradNorm = Math.abs(delta) / maxGrad
            nodeColor = [
              p.lerp(60, 255, gradNorm * prog),
              p.lerp(60, 80, gradNorm * prog),
              p.lerp(100, 60, gradNorm * prog),
            ]
          } else if (l === 0) {
            nodeColor = [80, 180, 120]
          } else if (l === arch.length - 1) {
            nodeColor = [220, 160, 80]
          } else {
            nodeColor = [80, 140, 220]
          }

          // Glow
          p.noStroke()
          p.fill(nodeColor[0], nodeColor[1], nodeColor[2], 40)
          p.ellipse(x, y, 50, 50)

          p.fill(nodeColor[0], nodeColor[1], nodeColor[2])
          p.ellipse(x, y, 36, 36)

          // Activation value
          p.fill(255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(act.toFixed(3), x, y)

          // Gradient label below
          if (prog > 0 && l > 0) {
            p.fill(240, 120, 100, prog * 255)
            p.textSize(9)
            p.text(`\u03B4=${delta.toFixed(4)}`, x, y + 26)
          }
        }
      }

      // Layer labels
      p.fill(160)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER)
      p.text('Input', layerX[0], 30)
      p.text('Hidden (3)', layerX[1], 30)
      p.text('Output', layerX[2], 30)

      // Target and loss
      p.fill(180)
      p.textSize(11)
      p.text(`Target: ${target}`, layerX[2], H - 35)
      p.text(`Loss: ${((a2 - target) ** 2).toFixed(4)}`, layerX[2], H - 20)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Backpropagation: Gradient Flow Through a [2,3,1] Network', W / 2, 18)

      // Direction indicator
      if (prog > 0) {
        p.fill(240, 100, 80)
        p.textSize(12)
        p.text('\u2190 Gradients flow backward', W / 2, H - 10)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Backprop on a Real Network</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's see backpropagation in action on a [2, 3, 1] network. During the forward pass,
        data flows from input to output and we compute the loss. During the backward pass,
        error signals (deltas) flow from right to left. Each neuron is colored by its gradient
        magnitude -- brighter red means a larger gradient, indicating that weight has more
        influence on the current error.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Slide the "Backward progress" slider to animate the gradient flowing backward layer by
        layer. Notice how the output neuron's delta propagates back through the weights, getting
        split and scaled as it passes through each connection.
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Backpropagation">
            <InteractiveSlider
              label="Backward progress"
              min={0}
              max={1}
              step={0.01}
              value={animProgress}
              onChange={setAnimProgress}
            />
          </ControlPanel>
        }
      />
      <h3 className="text-xl font-semibold text-white mt-6">The Backprop Algorithm Step by Step</h3>
      <ol className="list-decimal list-inside text-gray-300 space-y-2 leading-relaxed">
        <li>
          <strong>Forward pass:</strong> Compute all activations from input to output and store
          the intermediate values (z and a for each layer). We need them for the backward pass.
        </li>
        <li>
          <strong>Compute output delta:</strong> delta_L = dLoss/da_L * f'(z_L). For MSE loss
          and sigmoid output: delta = 2(a - target) * sigmoid'(z).
        </li>
        <li>
          <strong>Propagate backward:</strong>{' '}For each earlier layer l: delta_l = (W_{'{'}l+1{'}'}^T *
          delta_{'{'}l+1{'}'}) * f&apos;(z_l). The weight matrix transposes the error, and the activation
          derivative gates it.
        </li>
        <li>
          <strong>Compute weight gradients:</strong>{' '}dL/dW_l = delta_l * a_{'{'}l-1{'}'}^T. Each weight
          gradient is the product of the upstream delta and the downstream activation.
        </li>
        <li>
          <strong>Update weights:</strong> W -= learning_rate * dL/dW for all layers.
        </li>
      </ol>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Vanishing Gradients                                    */
/* ================================================================== */
function VanishingGradientsSection() {
  const [numLayers, setNumLayers] = useState(5)
  const stateRef = useRef({ numLayers })
  stateRef.current = { numLayers }

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

      const nLayers = s.numLayers
      // Simulate gradient magnitudes through a deep sigmoid network
      // Sigmoid derivative max = 0.25, so gradients shrink by ~0.25 per layer
      const gradients: number[] = [1.0] // output gradient = 1
      for (let i = 1; i < nLayers; i++) {
        // Each layer multiplies by sigmoid' (~0.25) times a weight (~0.5 to 1)
        gradients.push(gradients[i - 1] * 0.25 * 0.7)
      }
      gradients.reverse() // Now index 0 is first layer (farthest from output)

      const maxGrad = gradients[gradients.length - 1]
      const minGrad = gradients[0]

      // Draw bar chart
      const plotLeft = 80
      const plotRight = W - 40
      const plotTop = 60
      const plotBottom = H - 60
      const plotW = plotRight - plotLeft
      const plotH = plotBottom - plotTop

      const barWidth = Math.min(60, (plotW - 20) / nLayers - 10)
      const barSpacing = (plotW - barWidth) / (nLayers - 1 || 1)

      // Log scale for visualization
      const logMin = Math.log10(Math.max(minGrad, 1e-10))
      const logMax = Math.log10(maxGrad)

      for (let i = 0; i < nLayers; i++) {
        const x = plotLeft + i * barSpacing
        const grad = gradients[i]
        const logGrad = Math.log10(Math.max(grad, 1e-10))
        const barH = p.map(logGrad, logMin - 0.5, logMax + 0.5, 10, plotH)

        // Color: red if vanishing, green if healthy
        const healthRatio = p.constrain(p.map(logGrad, logMin, logMax, 0, 1), 0, 1)
        const r = p.lerp(220, 60, healthRatio)
        const g = p.lerp(60, 200, healthRatio)
        const b = p.lerp(60, 100, healthRatio)

        p.noStroke()
        p.fill(r, g, b, 200)
        p.rect(x, plotBottom - barH, barWidth, barH, 3, 3, 0, 0)

        // Value on top
        p.fill(200)
        p.textSize(9)
        p.textAlign(p.CENTER)
        const gradStr = grad < 0.001 ? grad.toExponential(1) : grad.toFixed(4)
        p.text(gradStr, x + barWidth / 2, plotBottom - barH - 8)

        // Layer label
        p.fill(160)
        p.textSize(10)
        p.text(`Layer ${i + 1}`, x + barWidth / 2, plotBottom + 16)
      }

      // Axis
      p.stroke(80)
      p.strokeWeight(1)
      p.line(plotLeft - 10, plotBottom, plotRight + 10, plotBottom)

      // Y axis label
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.push()
      p.translate(20, H / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER)
      p.text('Gradient magnitude (log scale)', 0, 0)
      p.pop()

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text(`Vanishing Gradients in a ${nLayers}-Layer Sigmoid Network`, W / 2, 25)

      // Annotation
      if (nLayers >= 5) {
        p.fill(240, 120, 80)
        p.textSize(11)
        p.text(
          `Layer 1 gradient is ${(gradients[0] / gradients[nLayers - 1] * 100).toFixed(1)}% ` +
          `of Layer ${nLayers} gradient`,
          W / 2, H - 12
        )
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Vanishing Gradient Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        Sigmoid's derivative has a maximum value of 0.25 (at z=0) and rapidly approaches 0 for
        large |z|. When you backpropagate through many sigmoid layers, the gradient gets multiplied
        by these small derivatives at each step. After just a few layers, the gradient reaching
        the earliest layers can be astronomically small -- this is the vanishing gradient problem.
      </p>
      <p className="text-gray-300 leading-relaxed">
        When gradients vanish, the early layers learn extremely slowly (or not at all), because
        the weight updates are proportional to the gradient magnitude. This is why deep sigmoid
        networks were nearly impossible to train before modern techniques. Increase the number
        of layers below and watch the first layer's gradient shrink exponentially.
      </p>
      <P5Sketch
        sketch={sketch}
        controls={
          <ControlPanel title="Vanishing Gradients">
            <InteractiveSlider
              label="Number of layers"
              min={2}
              max={10}
              step={1}
              value={numLayers}
              onChange={setNumLayers}
            />
          </ControlPanel>
        }
      />
      <p className="text-gray-300 leading-relaxed">
        The solutions to vanishing gradients include: (1) using ReLU activations whose derivative
        is either 0 or 1, (2) careful weight initialization (He, Xavier), (3) batch normalization,
        (4) residual connections (skip connections). We'll explore activation functions in depth
        in the next lesson.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — Python: Backprop from Scratch on XOR                   */
/* ================================================================== */
function BackpropCodeSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Backprop from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Let's implement backpropagation step by step on the XOR problem. This code makes every
        gradient computation explicit so you can see exactly how the chain rule unfolds. Each
        gradient is computed as a local derivative times the upstream gradient.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

def sigmoid_deriv(x):
    s = sigmoid(x)
    return s * (1.0 - s)

# XOR data
X = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
Y = np.array([[0],[1],[1],[0]], dtype=float)

# Initialize [2, 3, 1] network
np.random.seed(7)
W1 = np.random.randn(2, 3) * 0.8   # (2, 3)
b1 = np.zeros((1, 3))               # (1, 3)
W2 = np.random.randn(3, 1) * 0.8   # (3, 1)
b2 = np.zeros((1, 1))               # (1, 1)

lr = 2.0
N = len(X)

for epoch in range(3000):
    # ===== FORWARD PASS =====
    z1 = X @ W1 + b1          # (4, 3) - pre-activation hidden
    a1 = sigmoid(z1)           # (4, 3) - hidden activations
    z2 = a1 @ W2 + b2         # (4, 1) - pre-activation output
    a2 = sigmoid(z2)           # (4, 1) - output

    # ===== LOSS (MSE) =====
    loss = np.mean((a2 - Y) ** 2)

    # ===== BACKWARD PASS (chain rule, step by step) =====
    # Step 1: dLoss/da2 = 2/N * (a2 - Y)
    dL_da2 = 2.0 / N * (a2 - Y)          # (4, 1)

    # Step 2: da2/dz2 = sigmoid'(z2)
    da2_dz2 = sigmoid_deriv(z2)            # (4, 1)

    # Step 3: dLoss/dz2 = dL/da2 * da2/dz2 (element-wise)
    delta2 = dL_da2 * da2_dz2             # (4, 1)

    # Step 4: dLoss/dW2 = a1^T @ delta2 (chain rule: local * upstream)
    dL_dW2 = a1.T @ delta2                # (3, 1)
    dL_db2 = np.sum(delta2, axis=0, keepdims=True)  # (1, 1)

    # Step 5: Propagate to hidden layer
    # dLoss/da1 = delta2 @ W2^T
    dL_da1 = delta2 @ W2.T                # (4, 3)

    # Step 6: da1/dz1 = sigmoid'(z1)
    da1_dz1 = sigmoid_deriv(z1)            # (4, 3)

    # Step 7: dLoss/dz1 = dL/da1 * da1/dz1
    delta1 = dL_da1 * da1_dz1             # (4, 3)

    # Step 8: dLoss/dW1 = X^T @ delta1
    dL_dW1 = X.T @ delta1                 # (2, 3)
    dL_db1 = np.sum(delta1, axis=0, keepdims=True)  # (1, 3)

    # ===== UPDATE WEIGHTS =====
    W2 -= lr * dL_dW2
    b2 -= lr * dL_db2
    W1 -= lr * dL_dW1
    b1 -= lr * dL_db1

    if epoch % 500 == 0:
        print(f"Epoch {epoch:4d}  Loss: {loss:.6f}")

# Final predictions
a1 = sigmoid(X @ W1 + b1)
a2 = sigmoid(a1 @ W2 + b2)
print("\\nFinal predictions:")
for i in range(4):
    print(f"  {X[i]} -> {a2[i,0]:.4f}  (target: {Y[i,0]:.0f})")
print(f"\\nAll gradients at final step:")
print(f"  |dL/dW1| max: {np.abs(dL_dW1).max():.6f}")
print(f"  |dL/dW2| max: {np.abs(dL_dW2).max():.6f}")`}
        title="Backpropagation from scratch -- step by step on XOR"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Numerical Gradient Check                               */
/* ================================================================== */
function GradientCheckSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Gradient Checking: Verify Your Backprop</h2>
      <p className="text-gray-300 leading-relaxed">
        How do we know our backprop implementation is correct? We can verify it with numerical
        gradient checking: for each weight, nudge it by a tiny epsilon, recompute the loss, and
        estimate the gradient as (L(w+eps) - L(w-eps)) / (2*eps). If the analytical gradient
        from backprop matches the numerical gradient, our implementation is correct.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

def sigmoid_deriv(x):
    s = sigmoid(x)
    return s * (1.0 - s)

X = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
Y = np.array([[0],[1],[1],[0]], dtype=float)

np.random.seed(42)
W1 = np.random.randn(2, 3) * 0.5
b1 = np.zeros((1, 3))
W2 = np.random.randn(3, 1) * 0.5
b2 = np.zeros((1, 1))

def forward_loss(W1, b1, W2, b2):
    a1 = sigmoid(X @ W1 + b1)
    a2 = sigmoid(a1 @ W2 + b2)
    return np.mean((a2 - Y) ** 2)

def backprop_gradients(W1, b1, W2, b2):
    N = len(X)
    z1 = X @ W1 + b1;  a1 = sigmoid(z1)
    z2 = a1 @ W2 + b2; a2 = sigmoid(z2)
    dL_da2 = 2.0/N * (a2 - Y)
    delta2 = dL_da2 * sigmoid_deriv(z2)
    dW2 = a1.T @ delta2
    db2 = np.sum(delta2, axis=0, keepdims=True)
    delta1 = (delta2 @ W2.T) * sigmoid_deriv(z1)
    dW1 = X.T @ delta1
    db1 = np.sum(delta1, axis=0, keepdims=True)
    return dW1, db1, dW2, db2

def numerical_gradient(param_name, param, eps=1e-5):
    grad = np.zeros_like(param)
    for idx in np.ndindex(param.shape):
        old = param[idx]
        param[idx] = old + eps
        loss_plus = forward_loss(W1, b1, W2, b2)
        param[idx] = old - eps
        loss_minus = forward_loss(W1, b1, W2, b2)
        param[idx] = old
        grad[idx] = (loss_plus - loss_minus) / (2 * eps)
    return grad

# Compute both
dW1_bp, db1_bp, dW2_bp, db2_bp = backprop_gradients(W1, b1, W2, b2)
dW1_num = numerical_gradient("W1", W1)
dW2_num = numerical_gradient("W2", W2)

# Compare
diff_W1 = np.abs(dW1_bp - dW1_num).max()
diff_W2 = np.abs(dW2_bp - dW2_num).max()

print("Gradient Check Results:")
print(f"  Max |backprop - numerical| for W1: {diff_W1:.2e}")
print(f"  Max |backprop - numerical| for W2: {diff_W2:.2e}")
print(f"\\n  {'PASS' if max(diff_W1, diff_W2) < 1e-6 else 'FAIL'}: " +
      f"Gradients match within tolerance 1e-6")
print(f"\\nBackprop W1 gradient:\\n{dW1_bp}")
print(f"Numerical W1 gradient:\\n{dW1_num}")`}
        title="Gradient checking -- verifying backprop correctness"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Key Takeaways                                          */
/* ================================================================== */
function KeyTakeawaysSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Key Takeaways</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
        <li>
          Backpropagation is the chain rule applied systematically to a computation graph. It
          computes the gradient of the loss with respect to every weight by propagating error
          signals backward through the network.
        </li>
        <li>
          The algorithm has two phases: a forward pass (compute all activations and loss) and a
          backward pass (compute all gradients from output to input).
        </li>
        <li>
          Each weight's gradient is the product of the local derivative and the upstream gradient.
          We cache the forward pass values (z, a) to use during the backward pass.
        </li>
        <li>
          The vanishing gradient problem occurs when many small derivatives (like sigmoid's max
          of 0.25) are multiplied together, causing gradients in early layers to shrink
          exponentially. This makes deep sigmoid networks hard to train.
        </li>
        <li>
          Gradient checking (comparing analytical gradients to numerical finite-difference
          estimates) is a crucial debugging tool for validating backprop implementations.
        </li>
        <li>
          Modern solutions to vanishing gradients include ReLU activations, batch normalization,
          skip connections, and careful initialization -- we'll cover these next.
        </li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Backpropagation() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white">Backpropagation</h1>
        <p className="text-lg text-gray-400">
          The algorithm that makes deep learning possible: computing gradients through the chain rule.
        </p>
      </header>

      <TrainingProblemSection />
      <ChainRuleSection />
      <BackpropNetworkSection />
      <VanishingGradientsSection />
      <BackpropCodeSection />
      <GradientCheckSection />
      <KeyTakeawaysSection />
    </div>
  )
}
