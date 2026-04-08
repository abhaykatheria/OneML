import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'neural/multi-layer',
  title: 'Multi-Layer Networks',
  description: 'Stack layers of neurons to solve problems a single perceptron never could',
  track: 'neural',
  order: 2,
  tags: ['mlp', 'hidden-layers', 'forward-pass', 'universal-approximation', 'xor'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function randomWeight(): number {
  return (Math.random() - 0.5) * 2
}

/* ================================================================== */
/*  Section 1 — Why Stack Layers?                                      */
/* ================================================================== */
function WhyStackLayersSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Stack Layers?</h2>
      <p className="text-gray-300 leading-relaxed">
        In the previous lesson we saw that a single perceptron can only learn a linear decision
        boundary -- a straight line (or hyperplane) dividing the input space in two. This is a
        severe limitation. Many real-world problems, from recognizing handwritten digits to
        understanding language, require non-linear boundaries that curve, twist, and wrap around
        regions of the input space.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The key insight behind multi-layer networks is compositionality: when you chain
        non-linear transformations together, each layer re-represents the data in a new coordinate
        system that makes the next layer's job easier. The first hidden layer might learn simple
        features (edges, thresholds). The second layer combines those into more complex features
        (corners, curves). By the time data reaches the output, a once-inseparable problem may
        have become linearly separable in the learned representation.
      </p>
      <p className="text-gray-300 leading-relaxed">
        A multi-layer perceptron (MLP) is the simplest deep architecture: an input layer, one or
        more hidden layers, and an output layer. Every neuron in one layer connects to every
        neuron in the next -- hence "fully connected" or "dense" layers. Despite its simplicity,
        the MLP is a universal function approximator: with enough hidden neurons and a single
        hidden layer, it can approximate any continuous function to arbitrary precision.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Interactive MLP Architecture Builder                    */
/* ================================================================== */
function ArchitectureBuilderSection() {
  const [numHiddenLayers, setNumHiddenLayers] = useState(2)
  const [neuronsPerLayer, setNeuronsPerLayer] = useState(4)

  const stateRef = useRef({ numHiddenLayers, neuronsPerLayer })
  stateRef.current = { numHiddenLayers, neuronsPerLayer }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 400)
      p.textFont('monospace')
    }
    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      // Build layer sizes: [2, hidden..., 1]
      const layers: number[] = [2]
      for (let i = 0; i < s.numHiddenLayers; i++) {
        layers.push(s.neuronsPerLayer)
      }
      layers.push(1)

      const numLayers = layers.length
      const marginX = 80
      const layerSpacing = (W - 2 * marginX) / (numLayers - 1)

      // Compute node positions
      const positions: { x: number; y: number }[][] = []
      for (let l = 0; l < numLayers; l++) {
        const n = layers[l]
        const x = marginX + l * layerSpacing
        const totalH = Math.min(n * 50, H - 80)
        const spacing = n > 1 ? totalH / (n - 1) : 0
        const startY = H / 2 - totalH / 2
        const layerPositions: { x: number; y: number }[] = []
        for (let i = 0; i < n; i++) {
          layerPositions.push({ x, y: startY + i * spacing })
        }
        positions.push(layerPositions)
      }

      // Draw connections
      for (let l = 0; l < numLayers - 1; l++) {
        for (const from of positions[l]) {
          for (const to of positions[l + 1]) {
            p.stroke(60, 130, 200, 40)
            p.strokeWeight(1)
            p.line(from.x, from.y, to.x, to.y)
          }
        }
      }

      // Draw neurons
      for (let l = 0; l < numLayers; l++) {
        const isInput = l === 0
        const isOutput = l === numLayers - 1
        for (const pos of positions[l]) {
          const r = 18
          if (isInput) {
            p.fill(80, 180, 120)
          } else if (isOutput) {
            p.fill(220, 120, 80)
          } else {
            p.fill(80, 140, 220)
          }
          p.noStroke()
          p.ellipse(pos.x, pos.y, r * 2, r * 2)
        }

        // Layer label
        const centerX = positions[l][0].x
        p.fill(180)
        p.noStroke()
        p.textAlign(p.CENTER)
        p.textSize(11)
        if (isInput) {
          p.text('Input', centerX, H - 15)
          p.text(`(${layers[l]})`, centerX, H - 2)
        } else if (isOutput) {
          p.text('Output', centerX, H - 15)
          p.text(`(${layers[l]})`, centerX, H - 2)
        } else {
          p.text(`Hidden ${l}`, centerX, H - 15)
          p.text(`(${layers[l]})`, centerX, H - 2)
        }
      }

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text(`MLP: [${layers.join(', ')}]`, W / 2, 25)

      // Parameter count
      let params = 0
      for (let l = 0; l < numLayers - 1; l++) {
        params += layers[l] * layers[l + 1] + layers[l + 1] // weights + biases
      }
      p.fill(160)
      p.textSize(12)
      p.text(`Total parameters: ${params}`, W / 2, 45)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Architecture: Building an MLP</h2>
      <p className="text-gray-300 leading-relaxed">
        Use the sliders below to change the number of hidden layers and the number of neurons in
        each hidden layer. Watch how the network topology changes and notice how quickly the
        parameter count grows -- this is why deep learning requires so much compute.
      </p>
      <P5Sketch
        sketch={sketch}
        controls={
          <ControlPanel title="Architecture">
            <InteractiveSlider
              label="Hidden layers"
              min={1}
              max={5}
              step={1}
              value={numHiddenLayers}
              onChange={setNumHiddenLayers}
            />
            <InteractiveSlider
              label="Neurons per hidden layer"
              min={1}
              max={8}
              step={1}
              value={neuronsPerLayer}
              onChange={setNeuronsPerLayer}
            />
          </ControlPanel>
        }
      />
      <p className="text-gray-300 leading-relaxed">
        Each connection carries a weight, and each neuron (except inputs) has a bias. For a
        layer with <em>m</em> inputs and <em>n</em> neurons, there are <em>m x n</em> weights
        plus <em>n</em> biases. A modest [2, 4, 4, 1] network already has (2x4+4) + (4x4+4) +
        (4x1+1) = 12 + 20 + 5 = 37 parameters. Modern language models have billions.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — Forward Pass Animation                                 */
/* ================================================================== */
function ForwardPassSection() {
  const [animSpeed, setAnimSpeed] = useState(1.0)
  const stateRef = useRef({ animSpeed })
  stateRef.current = { animSpeed }

  const sketch = useCallback((p: p5) => {
    // Fixed [2, 4, 1] architecture
    const arch = [2, 4, 1]
    // Pre-generate random weights
    const weights: number[][][] = [] // weights[l][from][to]
    const biases: number[][] = []
    for (let l = 0; l < arch.length - 1; l++) {
      const layerWeights: number[][] = []
      for (let i = 0; i < arch[l]; i++) {
        const neuronWeights: number[] = []
        for (let j = 0; j < arch[l + 1]; j++) {
          neuronWeights.push(randomWeight())
        }
        layerWeights.push(neuronWeights)
      }
      weights.push(layerWeights)
      const layerBiases: number[] = []
      for (let j = 0; j < arch[l + 1]; j++) {
        layerBiases.push(randomWeight() * 0.5)
      }
      biases.push(layerBiases)
    }

    let t = 0
    const inputValues = [0.8, 0.3]

    // Compute activations
    function computeActivations(): number[][] {
      const acts: number[][] = [inputValues]
      let current = inputValues
      for (let l = 0; l < weights.length; l++) {
        const next: number[] = []
        for (let j = 0; j < arch[l + 1]; j++) {
          let sum = biases[l][j]
          for (let i = 0; i < current.length; i++) {
            sum += current[i] * weights[l][i][j]
          }
          next.push(sigmoid(sum))
        }
        acts.push(next)
        current = next
      }
      return acts
    }

    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      t += 0.005 * s.animSpeed
      if (t > 1.5) t = 0

      const activations = computeActivations()
      const marginX = 100
      const layerSpacing = (W - 2 * marginX) / (arch.length - 1)

      // Node positions
      const positions: { x: number; y: number }[][] = []
      for (let l = 0; l < arch.length; l++) {
        const n = arch[l]
        const x = marginX + l * layerSpacing
        const totalH = n * 55
        const spacing = n > 1 ? totalH / (n - 1) : 0
        const startY = H / 2 - totalH / 2
        const layerPos: { x: number; y: number }[] = []
        for (let i = 0; i < n; i++) {
          layerPos.push({ x, y: startY + i * spacing })
        }
        positions.push(layerPos)
      }

      // Animation progress per layer
      const layerProgress = arch.map((_, l) => {
        const layerStart = l / arch.length
        return p.constrain((t - layerStart) * arch.length, 0, 1)
      })

      // Draw connections with flowing pulse
      for (let l = 0; l < arch.length - 1; l++) {
        for (let i = 0; i < arch[l]; i++) {
          for (let j = 0; j < arch[l + 1]; j++) {
            const from = positions[l][i]
            const to = positions[l + 1][j]
            const w = weights[l][i][j]
            const alpha = p.map(Math.abs(w), 0, 1, 30, 100)
            p.stroke(100, 150, 220, alpha)
            p.strokeWeight(p.map(Math.abs(w), 0, 1, 0.5, 2.5))
            p.line(from.x, from.y, to.x, to.y)

            // Flowing signal dot
            const prog = layerProgress[l]
            if (prog > 0 && prog < 1) {
              const px = p.lerp(from.x, to.x, prog)
              const py = p.lerp(from.y, to.y, prog)
              const dotAlpha = p.map(Math.abs(activations[l][i] * w), 0, 1, 100, 255)
              p.noStroke()
              p.fill(120, 220, 160, dotAlpha)
              p.ellipse(px, py, 6, 6)
            }
          }
        }
      }

      // Draw neurons with activation values
      for (let l = 0; l < arch.length; l++) {
        for (let i = 0; i < arch[l]; i++) {
          const pos = positions[l][i]
          const act = activations[l][i]
          const brightness = p.map(act, 0, 1, 40, 255)

          // Glow
          if (layerProgress[l] > 0.5) {
            p.noStroke()
            p.fill(80, 180, 140, brightness * 0.3)
            p.ellipse(pos.x, pos.y, 44, 44)
          }

          p.noStroke()
          p.fill(brightness, brightness, brightness)
          p.ellipse(pos.x, pos.y, 30, 30)

          // Value label
          p.fill(200, 220, 255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(act.toFixed(2), pos.x, pos.y + 24)
        }
      }

      // Layer labels
      const labels = ['Input', 'Hidden', 'Output']
      for (let l = 0; l < arch.length; l++) {
        p.fill(180)
        p.textSize(12)
        p.textAlign(p.CENTER)
        p.text(labels[Math.min(l, 2)], positions[l][0].x, 20)
      }

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Forward Pass: data flows left to right', W / 2, H - 15)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Forward Pass</h2>
      <p className="text-gray-300 leading-relaxed">
        During a forward pass, data enters the input layer and flows through each hidden layer
        to the output. At every neuron, the incoming values are multiplied by weights, summed
        with a bias, and passed through an activation function (here, sigmoid). The green dots
        represent the signal flowing through the network. Each neuron displays its activation
        value after the non-linearity.
      </p>
      <P5Sketch
        sketch={sketch}
        controls={
          <ControlPanel title="Forward Pass">
            <InteractiveSlider
              label="Animation speed"
              min={0.2}
              max={3.0}
              step={0.1}
              value={animSpeed}
              onChange={setAnimSpeed}
            />
          </ControlPanel>
        }
      />
      <p className="text-gray-300 leading-relaxed">
        Mathematically, the forward pass for layer <em>l</em> is: <strong>z = W * a_prev + b</strong>,
        then <strong>a = f(z)</strong>, where <em>f</em> is the activation function. We repeat
        this from layer 1 through to the output. The entire network is one big composed function:
        <strong> f_L(...f_2(f_1(x)))</strong>.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Universal Approximation                                */
/* ================================================================== */
function UniversalApproximationSection() {
  const [numNeurons, setNumNeurons] = useState(4)
  const stateRef = useRef({ numNeurons })
  stateRef.current = { numNeurons }

  const sketch = useCallback((p: p5) => {
    // Generate random network weights for a [1, N, 1] network
    let hiddenWeights: number[] = []
    let hiddenBiases: number[] = []
    let outputWeights: number[] = []
    let outputBias = 0
    let prevN = 0

    function initWeights(n: number) {
      hiddenWeights = []
      hiddenBiases = []
      outputWeights = []
      // Use structured initialization to approximate sin
      for (let i = 0; i < n; i++) {
        hiddenWeights.push(2 + Math.random() * 3)
        hiddenBiases.push(-Math.PI + (2 * Math.PI * i) / n + (Math.random() - 0.5) * 0.5)
        outputWeights.push(((i % 2 === 0 ? 1 : -1) * (1.5 + Math.random() * 0.5)) / Math.sqrt(n))
      }
      outputBias = Math.random() * 0.2 - 0.1
    }

    function forward(x: number, n: number): number {
      let output = outputBias
      for (let i = 0; i < n; i++) {
        const h = sigmoid(hiddenWeights[i] * x + hiddenBiases[i])
        output += h * outputWeights[i]
      }
      return output
    }

    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 380)
      p.textFont('monospace')
      initWeights(stateRef.current.numNeurons)
      prevN = stateRef.current.numNeurons
    }

    p.draw = () => {
      const s = stateRef.current
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      if (s.numNeurons !== prevN) {
        initWeights(s.numNeurons)
        prevN = s.numNeurons
      }

      const plotLeft = 60
      const plotRight = W - 30
      const plotTop = 50
      const plotBottom = H - 50
      const plotW = plotRight - plotLeft
      const plotH = plotBottom - plotTop

      // Grid
      p.stroke(40)
      p.strokeWeight(1)
      for (let i = 0; i <= 4; i++) {
        const y = plotTop + (plotH * i) / 4
        p.line(plotLeft, y, plotRight, y)
      }

      // Axes
      p.stroke(80)
      p.strokeWeight(1)
      p.line(plotLeft, plotBottom, plotRight, plotBottom)
      p.line(plotLeft, plotTop, plotLeft, plotBottom)

      // Target: sin(x)
      p.stroke(80, 180, 220)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = (px / plotW) * 2 * Math.PI - Math.PI
        const y = Math.sin(x)
        const screenX = plotLeft + px
        const screenY = p.map(y, -1.5, 1.5, plotBottom, plotTop)
        p.vertex(screenX, screenY)
      }
      p.endShape()

      // Network approximation
      p.stroke(220, 120, 80)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let px = 0; px <= plotW; px += 2) {
        const x = (px / plotW) * 2 * Math.PI - Math.PI
        const y = forward(x, s.numNeurons)
        const screenX = plotLeft + px
        const screenY = p.map(y, -1.5, 1.5, plotBottom, plotTop)
        p.vertex(screenX, screenY)
      }
      p.endShape()

      // Legend
      p.noStroke()
      p.fill(80, 180, 220)
      p.rect(W - 200, 12, 12, 12, 2)
      p.fill(180)
      p.textSize(11)
      p.textAlign(p.LEFT)
      p.text('sin(x) -- target', W - 182, 23)

      p.fill(220, 120, 80)
      p.rect(W - 200, 30, 12, 12, 2)
      p.fill(180)
      p.text(`MLP [1,${s.numNeurons},1]`, W - 182, 41)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('Universal Approximation: can an MLP learn sin(x)?', W / 2, 25)

      // Axis labels
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.text('-\u03C0', plotLeft, plotBottom + 15)
      p.text('0', plotLeft + plotW / 2, plotBottom + 15)
      p.text('\u03C0', plotRight, plotBottom + 15)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Universal Approximation</h2>
      <p className="text-gray-300 leading-relaxed">
        The Universal Approximation Theorem (Cybenko, 1989; Hornik, 1991) states that a
        feedforward network with a single hidden layer containing a finite number of neurons
        can approximate any continuous function on a compact subset of R^n, provided the
        activation function is non-constant, bounded, and monotonically increasing (like sigmoid).
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is a powerful existence result, but it does not tell us how many neurons we need
        or how to find the right weights. In practice, deeper networks with fewer neurons per
        layer tend to learn more efficiently than wide shallow ones, because depth enables
        hierarchical feature composition.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Slide the "Hidden neurons" slider below to see how a single-hidden-layer MLP (with random
        structured weights) tries to approximate sin(x). More neurons means more "bumps" that can
        be combined, yielding a closer fit.
      </p>
      <P5Sketch
        sketch={sketch}
        controls={
          <ControlPanel title="Universal Approximation">
            <InteractiveSlider
              label="Hidden neurons"
              min={1}
              max={20}
              step={1}
              value={numNeurons}
              onChange={setNumNeurons}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — XOR Solved                                             */
/* ================================================================== */
function XORSection() {
  const sketch = useCallback((p: p5) => {
    // Train a tiny [2, 2, 1] network to solve XOR
    const data = [
      { x: [0, 0], y: 0 },
      { x: [0, 1], y: 1 },
      { x: [1, 0], y: 1 },
      { x: [1, 1], y: 0 },
    ]

    // Manually set weights that solve XOR
    // Hidden layer: neuron 0 computes OR-like, neuron 1 computes AND-like
    const w1 = [[5.0, 5.0], [7.0, 7.0]]   // [neuron][input]
    const b1 = [-2.0, -10.0]
    const w2 = [[10.0, -10.0]]  // output neuron
    const b2 = [-3.0]

    function forward(x: number[]): { hidden: number[]; out: number } {
      const h: number[] = []
      for (let j = 0; j < 2; j++) {
        h.push(sigmoid(w1[j][0] * x[0] + w1[j][1] * x[1] + b1[j]))
      }
      const o = sigmoid(w2[0][0] * h[0] + w2[0][1] * h[1] + b2[0])
      return { hidden: h, out: o }
    }

    p.setup = () => {
      p.createCanvas(p.windowWidth > 720 ? 720 : p.windowWidth - 40, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      // Draw decision boundary as heatmap
      const gridSize = 4
      const plotLeft = 40
      const plotTop = 50
      const plotSize = Math.min(280, W / 2 - 60)
      for (let px = 0; px < plotSize; px += gridSize) {
        for (let py = 0; py < plotSize; py += gridSize) {
          const x0 = px / plotSize
          const x1 = 1 - py / plotSize
          const { out } = forward([x0, x1])
          const r = p.lerp(30, 220, 1 - out)
          const g = p.lerp(30, 120, 1 - out)
          const b = p.lerp(60, 80, out)
          p.noStroke()
          p.fill(r, g, b)
          p.rect(plotLeft + px, plotTop + py, gridSize, gridSize)
        }
      }

      // Draw data points
      for (const d of data) {
        const px = plotLeft + d.x[0] * plotSize
        const py = plotTop + (1 - d.x[1]) * plotSize
        p.stroke(255)
        p.strokeWeight(2)
        if (d.y === 1) {
          p.fill(80, 220, 120)
        } else {
          p.fill(220, 80, 80)
        }
        p.ellipse(px, py, 18, 18)
        p.noStroke()
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(String(d.y), px, py)
      }

      // Labels
      p.fill(180)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER)
      p.text('x1', plotLeft + plotSize / 2, plotTop + plotSize + 18)
      p.push()
      p.translate(plotLeft - 18, plotTop + plotSize / 2)
      p.rotate(-p.HALF_PI)
      p.text('x2', 0, 0)
      p.pop()

      // Network diagram on the right
      const netLeft = plotLeft + plotSize + 60
      const netCenterY = H / 2
      const layerX = [netLeft, netLeft + 90, netLeft + 180]
      const nodeY = [
        [netCenterY - 35, netCenterY + 35],
        [netCenterY - 35, netCenterY + 35],
        [netCenterY],
      ]

      // Connections
      for (let l = 0; l < 2; l++) {
        for (const fy of nodeY[l]) {
          for (const ty of nodeY[l + 1]) {
            p.stroke(100, 150, 220, 60)
            p.strokeWeight(1.5)
            p.line(layerX[l], fy, layerX[l + 1], ty)
          }
        }
      }

      // Compute values for display
      const { hidden, out } = forward([1, 0])
      const allValues = [[1, 0], hidden, [out]]

      // Nodes
      for (let l = 0; l < 3; l++) {
        for (let i = 0; i < nodeY[l].length; i++) {
          const val = allValues[l][i]
          const brightness = p.map(val, 0, 1, 60, 240)
          p.noStroke()
          p.fill(brightness)
          p.ellipse(layerX[l], nodeY[l][i], 28, 28)
          p.fill(val > 0.5 ? 0 : 255)
          p.textSize(9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(val.toFixed(2), layerX[l], nodeY[l][i])
        }
      }

      // Network labels
      p.fill(160)
      p.textSize(10)
      p.noStroke()
      p.textAlign(p.CENTER)
      p.text('Input', layerX[0], netCenterY + 60)
      p.text('Hidden', layerX[1], netCenterY + 60)
      p.text('Output', layerX[2], netCenterY + 60)
      p.text('Showing: [1, 0] -> 1', layerX[1], netCenterY + 78)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER)
      p.text('XOR Solved by a Multi-Layer Network', W / 2, 25)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">XOR: The Classic Non-Linear Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        XOR (exclusive or) is the canonical example of a problem that a single perceptron cannot
        solve. The outputs are: (0,0) → 0, (0,1) → 1, (1,0) → 1, (1,1) → 0. No single
        straight line can separate the 1s from the 0s. This was the devastating critique in
        Minsky and Papert's 1969 book "Perceptrons," which contributed to the first "AI winter."
      </p>
      <p className="text-gray-300 leading-relaxed">
        But a network with just one hidden layer of 2 neurons solves XOR easily. The first hidden
        neuron learns something like "at least one input is on" (OR-like), while the second learns
        "both inputs are on" (AND-like). The output neuron then computes "OR but not AND" -- which
        is exactly XOR. The heatmap below shows the learned decision boundary, and the network on
        the right shows the activations for the input [1, 0].
      </p>
      <P5Sketch sketch={sketch} height={380} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Python: MLP from Scratch                               */
/* ================================================================== */
function MLPFromScratchSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: MLP from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Now let's implement a simple multi-layer perceptron in pure Python (using NumPy). This
        network will learn to solve XOR through gradient descent. We'll build the forward pass,
        compute the loss, and use backpropagation to update the weights. Run the cell to see
        the network converge.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Sigmoid and its derivative
def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def sigmoid_deriv(x):
    s = sigmoid(x)
    return s * (1 - s)

# XOR dataset
X = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
Y = np.array([[0],[1],[1],[0]], dtype=float)

# Network: [2, 4, 1]
np.random.seed(42)
W1 = np.random.randn(2, 4) * 0.5
b1 = np.zeros((1, 4))
W2 = np.random.randn(4, 1) * 0.5
b2 = np.zeros((1, 1))

lr = 2.0
losses = []

for epoch in range(2000):
    # Forward pass
    z1 = X @ W1 + b1
    a1 = sigmoid(z1)
    z2 = a1 @ W2 + b2
    a2 = sigmoid(z2)

    # Binary cross-entropy loss
    loss = -np.mean(Y * np.log(a2 + 1e-8) + (1-Y) * np.log(1-a2 + 1e-8))
    losses.append(loss)

    # Backward pass
    dz2 = a2 - Y                  # (4, 1)
    dW2 = a1.T @ dz2 / 4          # (4, 1)
    db2 = np.mean(dz2, axis=0, keepdims=True)

    da1 = dz2 @ W2.T              # (4, 4)
    dz1 = da1 * sigmoid_deriv(z1)  # (4, 4)
    dW1 = X.T @ dz1 / 4           # (2, 4)
    db1 = np.mean(dz1, axis=0, keepdims=True)

    # Update
    W2 -= lr * dW2
    b2 -= lr * db2
    W1 -= lr * dW1
    b1 -= lr * db1

# Test predictions
preds = sigmoid(sigmoid(X @ W1 + b1) @ W2 + b2)
print("XOR predictions after training:")
for i in range(4):
    print(f"  {X[i]} -> {preds[i,0]:.4f}  (target: {Y[i,0]:.0f})")
print(f"\\nFinal loss: {losses[-1]:.6f}")
print(f"Loss went from {losses[0]:.4f} to {losses[-1]:.6f}")`}
        title="MLP from scratch -- solving XOR"
      />
      <p className="text-gray-300 leading-relaxed">
        Notice how the network learns to map each XOR input to the correct output. The key
        ingredients are: (1) at least one hidden layer with a non-linear activation, (2) a loss
        function that measures how wrong we are, and (3) gradient descent to adjust the weights.
        We'll dive deep into the backpropagation algorithm in the next lesson.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Python: Architecture Experiments                       */
/* ================================================================== */
function ArchitectureExperimentsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Experiment: Architecture Matters</h2>
      <p className="text-gray-300 leading-relaxed">
        Try different architectures and see how they affect learning. A network that is too small
        may not have enough capacity to learn the function (underfitting), while a very large
        one might learn faster but uses more parameters. The cell below lets you experiment
        with different hidden layer sizes on a circle classification problem.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

# Circle dataset: points inside radius 0.5 -> class 1, outside -> class 0
np.random.seed(0)
N = 200
X = np.random.randn(N, 2) * 0.8
Y = ((X[:,0]**2 + X[:,1]**2) < 0.5).astype(float).reshape(-1, 1)

# Try different architectures
architectures = {
    "[2, 2, 1]": [2, 1],      # too small?
    "[2, 4, 1]": [4, 1],      # just right?
    "[2, 8, 4, 1]": [8, 4, 1] # overkill?
}

for name, hidden_sizes in architectures.items():
    # Build layers
    layer_sizes = [2] + hidden_sizes
    weights = []
    biases = []
    np.random.seed(42)
    for i in range(len(layer_sizes) - 1):
        w = np.random.randn(layer_sizes[i], layer_sizes[i+1]) * np.sqrt(2.0 / layer_sizes[i])
        b = np.zeros((1, layer_sizes[i+1]))
        weights.append(w)
        biases.append(b)

    # Train
    lr = 1.0
    for epoch in range(1000):
        # Forward
        a = X
        activations = [a]
        for w, b in zip(weights, biases):
            z = a @ w + b
            a = sigmoid(z)
            activations.append(a)

        # Backward
        delta = activations[-1] - Y
        for i in range(len(weights) - 1, -1, -1):
            dw = activations[i].T @ delta / N
            db = np.mean(delta, axis=0, keepdims=True)
            if i > 0:
                delta = (delta @ weights[i].T) * activations[i] * (1 - activations[i])
            weights[i] -= lr * dw
            biases[i] -= lr * db

    # Evaluate
    a = X
    for w, b in zip(weights, biases):
        a = sigmoid(a @ w + b)
    acc = np.mean((a > 0.5).astype(float) == Y) * 100
    params = sum(w.size + b.size for w, b in zip(weights, biases))
    print(f"{name:18s} -> accuracy: {acc:.1f}%  params: {params}")`}
        title="Architecture comparison on circle classification"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Key Takeaways                                          */
/* ================================================================== */
function KeyTakeawaysSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Key Takeaways</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
        <li>
          A multi-layer perceptron (MLP) chains multiple layers of neurons, each applying a
          linear transformation followed by a non-linear activation function.
        </li>
        <li>
          Hidden layers transform the input into representations where previously inseparable
          patterns become separable -- this is why MLPs can solve XOR while single perceptrons
          cannot.
        </li>
        <li>
          The forward pass computes the output by propagating data through each layer:
          z = Wa + b, then a = f(z).
        </li>
        <li>
          The Universal Approximation Theorem guarantees that a single hidden layer with enough
          neurons can approximate any continuous function, but deeper networks are often more
          parameter-efficient.
        </li>
        <li>
          Architecture choice (number of layers, neurons per layer) is a design decision that
          balances capacity, training speed, and generalization.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        In the next lesson, we'll learn how to actually train these networks using
        backpropagation -- the algorithm that computes the gradient of the loss with respect to
        every weight in the network, enabling gradient descent to find good parameters.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function MultiLayerNetworks() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white">Multi-Layer Networks</h1>
        <p className="text-lg text-gray-400">
          Stack layers of neurons to solve problems a single perceptron never could.
        </p>
      </header>

      <WhyStackLayersSection />
      <ArchitectureBuilderSection />
      <ForwardPassSection />
      <UniversalApproximationSection />
      <XORSection />
      <MLPFromScratchSection />
      <ArchitectureExperimentsSection />
      <KeyTakeawaysSection />
    </div>
  )
}
