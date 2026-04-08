import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/rnn',
  title: 'RNNs & LSTMs',
  description: 'Understand recurrent neural networks, the vanishing gradient problem, and how LSTMs solve it with gating mechanisms',
  track: 'deep',
  order: 2,
  tags: ['rnn', 'lstm', 'gru', 'sequential', 'vanishing-gradient', 'bptt', 'recurrent'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}


/* ================================================================== */
/*  Section 1 -- Sequential Data Motivation                            */
/* ================================================================== */
function SequentialDataSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Sequential Data Needs Special Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        Many real-world signals are inherently sequential: spoken language unfolds word by word,
        stock prices tick by tick, sensor readings sample by sample. A feedforward network can only
        process a fixed-size input -- it has no notion of time, order, or history. You could
        concatenate the last N timesteps into one big input vector, but this is clumsy: it fixes the
        context window, it ignores the ordering (timestep 3 and timestep 7 are treated identically),
        and it explodes in parameters.
      </p>
      <p className="text-gray-300 leading-relaxed">
        What we want is a network that processes one element at a time while maintaining an internal
        memory -- a <strong className="text-white">hidden state</strong> -- that summarizes
        everything it has seen so far. At each timestep, the network reads the new input, updates
        its hidden state, and optionally produces an output. This is exactly what a Recurrent
        Neural Network (RNN) does. The same weights are reused at every timestep (weight sharing
        across time), so an RNN can handle sequences of any length.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The elegant idea of a recurrent loop leads to a powerful but fragile architecture.
        In this lesson we will build up from a simple RNN cell, understand why it struggles with
        long-range dependencies, and see how LSTMs and GRUs introduce gating to solve the problem.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Unrolled RNN Visualization                            */
/* ================================================================== */
function UnrolledRNNSection() {
  const [timesteps, setTimesteps] = useState(5)
  const [activeStep, _setActiveStep] = useState(0)
  const stateRef = useRef({ timesteps, activeStep })
  stateRef.current = { timesteps, activeStep }

  const sketch = useCallback((p: p5) => {
    let frame = 0
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 360)
      p.textFont('monospace')
    }
    p.draw = () => {
      const { timesteps: T, activeStep: _active } = stateRef.current
      p.background(15, 15, 25)

      const cellW = 70
      const cellH = 50
      const gap = Math.min(30, (p.width - 80 - T * cellW) / Math.max(1, T - 1))
      const startX = 40
      const cellY = 140
      const inputY = cellY + 100
      const outputY = cellY - 90

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Unrolled RNN', 20, 12)

      // Animate active step
      frame++
      if (frame % 40 === 0) {
        stateRef.current.activeStep = (stateRef.current.activeStep + 1) % T
      }

      for (let t = 0; t < T; t++) {
        const cx = startX + t * (cellW + gap)
        const isActive = t === stateRef.current.activeStep
        const isPast = t < stateRef.current.activeStep

        // RNN cell box
        p.fill(isActive ? p.color(50, 130, 220) : isPast ? p.color(40, 80, 120) : p.color(40, 50, 70))
        p.stroke(isActive ? p.color(80, 180, 255) : p.color(60, 70, 90))
        p.strokeWeight(isActive ? 2 : 1)
        p.rect(cx, cellY, cellW, cellH, 6)

        // Cell label
        p.fill(isActive ? 255 : 180)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`h${t}`, cx + cellW / 2, cellY + cellH / 2)

        // Input arrow (from below)
        p.stroke(isActive ? p.color(100, 220, 140) : p.color(70, 100, 80))
        p.strokeWeight(isActive ? 2 : 1)
        p.line(cx + cellW / 2, inputY, cx + cellW / 2, cellY + cellH)
        p.fill(isActive ? p.color(100, 220, 140) : p.color(70, 100, 80))
        p.noStroke()
        p.triangle(
          cx + cellW / 2 - 4, cellY + cellH,
          cx + cellW / 2 + 4, cellY + cellH,
          cx + cellW / 2, cellY + cellH - 6
        )

        // Input label
        p.fill(isActive ? p.color(100, 220, 140) : p.color(100, 140, 110))
        p.textSize(11)
        p.text(`x${t}`, cx + cellW / 2, inputY + 14)

        // Output arrow (up)
        p.stroke(isActive ? p.color(220, 160, 80) : p.color(100, 80, 60))
        p.strokeWeight(isActive ? 2 : 1)
        p.line(cx + cellW / 2, cellY, cx + cellW / 2, outputY + 20)
        p.fill(isActive ? p.color(220, 160, 80) : p.color(100, 80, 60))
        p.noStroke()
        p.triangle(
          cx + cellW / 2 - 4, outputY + 20,
          cx + cellW / 2 + 4, outputY + 20,
          cx + cellW / 2, outputY + 14
        )

        // Output label
        p.fill(isActive ? p.color(220, 160, 80) : p.color(140, 110, 80))
        p.textSize(11)
        p.text(`y${t}`, cx + cellW / 2, outputY + 4)

        // Hidden state arrow (right)
        if (t < T - 1) {
          const nextX = startX + (t + 1) * (cellW + gap)
          const arrowAlpha = isPast || isActive ? 220 : 80
          p.stroke(isPast || isActive ? p.color(80, 180, 255, arrowAlpha) : p.color(60, 80, 100))
          p.strokeWeight(isPast || isActive ? 2.5 : 1)
          p.line(cx + cellW, cellY + cellH / 2, nextX, cellY + cellH / 2)
          p.fill(isPast || isActive ? p.color(80, 180, 255) : p.color(60, 80, 100))
          p.noStroke()
          p.triangle(
            nextX, cellY + cellH / 2 - 5,
            nextX, cellY + cellH / 2 + 5,
            nextX + 7, cellY + cellH / 2
          )
        }
      }

      // Formula
      p.fill(180)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('h_t = tanh(W_hh * h_{t-1} + W_xh * x_t + b)', 20, p.height - 12)
      p.text('y_t = W_hy * h_t', 20, p.height + 4)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Recurrent Neuron, Unrolled</h2>
      <p className="text-gray-300 leading-relaxed">
        An RNN cell maintains a hidden state vector <code className="text-emerald-400">h</code> that
        gets updated at each timestep. The blue boxes below are the <em>same</em> cell shown at
        different times -- the weights <code className="text-emerald-400">W_hh</code>,{' '}
        <code className="text-emerald-400">W_xh</code>, and{' '}
        <code className="text-emerald-400">W_hy</code> are shared. The horizontal arrows represent
        the hidden state flowing from one timestep to the next, carrying the network's "memory."
      </p>
      <p className="text-gray-300 leading-relaxed">
        At each step, the cell reads the current input x_t and the previous hidden state h_{'{t-1}'},
        combines them with a tanh nonlinearity, and produces both a new hidden state and an output.
        Watch the animation: the active cell (bright blue) processes its input while its hidden
        state streams rightward to inform future predictions.
      </p>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <ControlPanel title="Sequence">
            <InteractiveSlider label="Timesteps" min={3} max={8} step={1} value={timesteps} onChange={setTimesteps} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Vanishing Gradients                                   */
/* ================================================================== */
function VanishingGradientSection() {
  const [gradientDecay, setGradientDecay] = useState(0.6)
  const stateRef = useRef({ gradientDecay })
  stateRef.current = { gradientDecay }

  const sketch = useCallback((p: p5) => {
    let frame = 0
    const T = 8

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 340)
      p.textFont('monospace')
    }
    p.draw = () => {
      const { gradientDecay: decay } = stateRef.current
      p.background(15, 15, 25)

      const cellW = 60
      const cellH = 40
      const gap = Math.min(25, (p.width - 80 - T * cellW) / Math.max(1, T - 1))
      const startX = 30
      const cellY = 80

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Backpropagation Through Time (BPTT)', 20, 12)

      // Animate which step the gradient originates from
      frame++
      const originStep = T - 1 // gradient flows back from last step

      for (let t = 0; t < T; t++) {
        const cx = startX + t * (cellW + gap)

        // Gradient magnitude at this step
        const stepsBack = originStep - t
        const gradMag = Math.pow(decay, stepsBack)

        // Cell
        const r = p.lerp(40, 220, gradMag)
        const g = p.lerp(40, 60, gradMag)
        const b = p.lerp(40, 60, gradMag)
        p.fill(r, g, b)
        p.stroke(80)
        p.strokeWeight(1)
        p.rect(cx, cellY, cellW, cellH, 5)

        // Label
        p.fill(255)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`t=${t}`, cx + cellW / 2, cellY + cellH / 2)

        // Gradient bar below
        const barMaxH = 100
        const barH = Math.max(2, gradMag * barMaxH)
        const barY = cellY + cellH + 30
        const barX = cx + cellW / 2 - 12

        p.fill(220 * gradMag, 80 * gradMag + 40, 60)
        p.noStroke()
        p.rect(barX, barY + barMaxH - barH, 24, barH, 3)

        // Gradient value text
        p.fill(180)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(gradMag.toFixed(3), cx + cellW / 2, barY + barMaxH + 4)

        // Backward arrow (red, flowing left)
        if (t > 0) {
          const prevCx = startX + (t - 1) * (cellW + gap)
          const gradColor = p.lerpColor(p.color(60, 40, 40), p.color(255, 80, 60), gradMag)
          p.stroke(gradColor)
          p.strokeWeight(p.lerp(0.5, 3, gradMag))
          const ay = cellY - 15
          p.line(cx, ay, prevCx + cellW, ay)
          // arrowhead
          p.fill(gradColor)
          p.noStroke()
          p.triangle(
            prevCx + cellW, ay - 4,
            prevCx + cellW, ay + 4,
            prevCx + cellW - 6, ay
          )
        }
      }

      // Labels
      p.fill(255, 80, 60)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('gradient flow', startX + (T - 1) * (cellW + gap) + cellW, cellY - 15)

      p.fill(160)
      p.textSize(12)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Gradient multiplied by ${decay} at each step. After ${T - 1} steps: ${Math.pow(decay, T - 1).toFixed(6)}`, 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">BPTT and the Vanishing Gradient Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        Training an RNN uses <strong className="text-white">Backpropagation Through Time (BPTT)
        </strong>: we unroll the network for T steps, compute the loss, and backpropagate gradients
        through every timestep. The chain rule means the gradient at timestep t must pass through
        all the steps between t and the loss, multiplying by the recurrent weight matrix W_hh at
        each step.
      </p>
      <p className="text-gray-300 leading-relaxed">
        If the largest eigenvalue of W_hh is less than 1, gradients shrink exponentially -- the
        <strong className="text-white"> vanishing gradient</strong> problem. The red arrows below
        show gradient magnitude flowing backward. Adjust the decay factor: at 0.6, the gradient
        reaching the first timestep is only 0.028 of its original value. The early timesteps
        receive almost no learning signal, so the network cannot learn long-range dependencies.
        If the eigenvalue exceeds 1, gradients explode instead (mitigated by gradient clipping).
      </p>
      <P5Sketch
        sketch={sketch}
        height={340}
        controls={
          <ControlPanel title="Gradient Decay">
            <InteractiveSlider label="Decay Factor" min={0.2} max={1.0} step={0.05} value={gradientDecay} onChange={setGradientDecay} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- LSTM Gates Animation                                  */
/* ================================================================== */
function LSTMGatesSection() {
  const [forgetBias, setForgetBias] = useState(0.8)
  const [inputBias, setInputBias] = useState(0.5)
  const [outputBias, setOutputBias] = useState(0.7)
  const stateRef = useRef({ forgetBias, inputBias, outputBias })
  stateRef.current = { forgetBias, inputBias, outputBias }

  const sketch = useCallback((p: p5) => {
    let animT = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { forgetBias: fb, inputBias: ib, outputBias: ob } = stateRef.current
      p.background(15, 15, 25)
      animT += 0.02

      const W = p.width
      const H = p.height
      const centerX = W / 2
      const cellY = H * 0.45

      // Cell state pipe (horizontal line)
      const pipeLeft = centerX - 180
      const pipeRight = centerX + 180
      const pipeY = cellY - 60
      p.stroke(180, 160, 60)
      p.strokeWeight(4)
      p.line(pipeLeft, pipeY, pipeRight, pipeY)

      // Cell state label
      p.fill(180, 160, 60)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Cell State (C_t)', centerX, pipeY - 8)

      // Flowing particles on cell state
      const particleSpeed = 0.5
      for (let i = 0; i < 8; i++) {
        const px = pipeLeft + ((animT * 80 * particleSpeed + i * 45) % (pipeRight - pipeLeft))
        const alpha = p.map(sigmoid(fb * 3 - 1.5), 0, 1, 40, 255)
        p.fill(220, 200, 80, alpha)
        p.noStroke()
        p.ellipse(px, pipeY, 6, 6)
      }

      // Gate drawing helper
      const drawGate = (x: number, y: number, label: string, value: number, color: readonly [number, number, number]) => {
        const gateW = 60
        const gateH = 40
        const openness = value

        p.fill(color[0], color[1], color[2], 40 + openness * 180)
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(2)
        p.rect(x - gateW / 2, y - gateH / 2, gateW, gateH, 8)

        // Gate fill (openness)
        p.noStroke()
        p.fill(color[0], color[1], color[2], openness * 150)
        p.rect(x - gateW / 2 + 2, y - gateH / 2 + 2, (gateW - 4) * openness, gateH - 4, 6)

        p.fill(255)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, x, y)
        p.textSize(9)
        p.fill(200)
        p.text(`${(value * 100).toFixed(0)}%`, x, y + gateH / 2 + 12)
      }

      // Forget gate
      const fgX = centerX - 120
      const fgY = cellY + 20
      drawGate(fgX, fgY, 'Forget', sigmoid(fb * 4 - 2), [220, 80, 80] as const)

      // Input gate
      const igX = centerX
      const igY = cellY + 20
      drawGate(igX, igY, 'Input', sigmoid(ib * 4 - 2), [80, 180, 80] as const)

      // Output gate
      const ogX = centerX + 120
      const ogY = cellY + 20
      drawGate(ogX, ogY, 'Output', sigmoid(ob * 4 - 2), [80, 120, 220] as const)

      // Connection lines from gates to cell state
      p.stroke(160, 60, 60, 150)
      p.strokeWeight(1.5)
      p.line(fgX, fgY - 20, fgX, pipeY)

      p.stroke(60, 140, 60, 150)
      p.strokeWeight(1.5)
      p.line(igX, igY - 20, igX, pipeY)

      p.stroke(60, 100, 200, 150)
      p.strokeWeight(1.5)
      p.line(ogX, ogY - 20, ogX, pipeY)

      // Hidden state output
      p.stroke(80, 120, 220)
      p.strokeWeight(2)
      p.line(ogX, pipeY, ogX + 60, pipeY)
      p.line(ogX + 60, pipeY, ogX + 60, pipeY - 30)
      p.fill(80, 120, 220)
      p.noStroke()
      p.triangle(ogX + 60 - 4, pipeY - 30, ogX + 60 + 4, pipeY - 30, ogX + 60, pipeY - 38)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('h_t', ogX + 60, pipeY - 40)

      // Input arrows from below
      const inputY = cellY + 80
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('x_t, h_{t-1}', centerX, inputY + 10)

      for (const gx of [fgX, igX, ogX]) {
        p.stroke(100)
        p.strokeWeight(1)
        p.line(gx, inputY, gx, fgY + 20)
      }

      // Legend
      p.fill(200)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Forget gate: what to discard from memory', 20, H - 80)
      p.text('Input gate: what new info to store', 20, H - 62)
      p.text('Output gate: what to expose as hidden state', 20, H - 44)
      p.fill(140)
      p.textSize(10)
      p.text('Adjust sliders to open/close each gate', 20, H - 20)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">LSTM: Gated Memory</h2>
      <p className="text-gray-300 leading-relaxed">
        The Long Short-Term Memory (LSTM) cell, introduced by Hochreiter and Schmidhuber in 1997,
        solves the vanishing gradient problem by introducing a <strong className="text-white">cell
        state</strong> -- a highway that runs through the entire sequence with only linear
        interactions. Three learned gates control information flow:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-red-400">Forget gate (f_t)</strong>: decides what fraction of the previous cell state to keep. A sigmoid output of 0 means "completely forget"; 1 means "remember everything."</li>
        <li><strong className="text-green-400">Input gate (i_t)</strong>: decides how much of the new candidate values to add to the cell state. Combined with a tanh-generated candidate, it controls what new information gets stored.</li>
        <li><strong className="text-blue-400">Output gate (o_t)</strong>: decides what part of the cell state to expose as the hidden state output. This filters the memory to produce a relevant representation.</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Adjust the gate biases below and watch the particles flow along the cell state. When the
        forget gate is nearly closed (low value), old information is erased. When the input gate
        opens, new data is written. The output gate controls what downstream layers see.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Gate Biases">
            <InteractiveSlider label="Forget Gate" min={0} max={1} step={0.05} value={forgetBias} onChange={setForgetBias} />
            <InteractiveSlider label="Input Gate" min={0} max={1} step={0.05} value={inputBias} onChange={setInputBias} />
            <InteractiveSlider label="Output Gate" min={0} max={1} step={0.05} value={outputBias} onChange={setOutputBias} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- GRU                                                   */
/* ================================================================== */
function GRUSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">GRU: A Simpler Alternative</h2>
      <p className="text-gray-300 leading-relaxed">
        The Gated Recurrent Unit (GRU), introduced by Cho et al. in 2014, achieves similar
        performance to the LSTM with a simpler design. It merges the cell state and hidden state
        into a single vector and uses only two gates:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">Update gate (z_t)</strong>: controls how much of the old hidden state to retain versus the new candidate. It combines the roles of the LSTM's forget and input gates.</li>
        <li><strong className="text-white">Reset gate (r_t)</strong>: determines how much of the previous hidden state to expose when computing the candidate. When fully closed, the cell acts like a standard feedforward unit, ignoring history.</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The update equation is: <code className="text-emerald-400">h_t = (1 - z_t) * h_{'{t-1}'} + z_t * candidate</code>.
        This linear interpolation is the key to gradient flow -- when z_t is near 0, the gradient
        passes through almost unmodified, just like the LSTM's cell state highway. In practice,
        GRUs and LSTMs perform comparably on most tasks, but GRUs have fewer parameters (two gates
        vs. three) and can be faster to train.
      </p>
      <h3 className="text-xl font-semibold text-white mt-6">When to choose which?</h3>
      <p className="text-gray-300 leading-relaxed">
        Use LSTMs when you have plenty of data and the task requires precise long-range memory
        (e.g., machine translation, speech recognition). Use GRUs for smaller datasets or when
        training speed matters. In practice, both have been largely superseded by Transformer-based
        architectures for most NLP tasks, but they remain important for time series forecasting,
        audio processing, and resource-constrained settings where attention's quadratic cost is
        prohibitive.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Python: RNN Cell From Scratch                         */
/* ================================================================== */
function PythonRNNSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: RNN Cell from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Below we implement a vanilla RNN cell and run it over a short sequence. Notice how the
        hidden state evolves at each timestep, incorporating both the new input and the previous
        hidden state. This is the core recurrence that gives RNNs their power -- and their weakness,
        as the same weight matrix W_hh is multiplied at every step.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def rnn_cell(x_t, h_prev, W_xh, W_hh, b_h):
    """Single RNN cell forward pass."""
    return np.tanh(W_xh @ x_t + W_hh @ h_prev + b_h)

# Dimensions
input_dim = 3
hidden_dim = 4
seq_len = 6

# Initialize weights
np.random.seed(42)
W_xh = np.random.randn(hidden_dim, input_dim) * 0.5
W_hh = np.random.randn(hidden_dim, hidden_dim) * 0.5
b_h = np.zeros(hidden_dim)

# Create a simple sequence
sequence = np.random.randn(seq_len, input_dim)
print("Input sequence shape:", sequence.shape)
print()

# Forward pass through time
h = np.zeros(hidden_dim)  # initial hidden state
hidden_states = [h.copy()]

for t in range(seq_len):
    h = rnn_cell(sequence[t], h, W_xh, W_hh, b_h)
    hidden_states.append(h.copy())
    print(f"t={t}: x={np.round(sequence[t], 2)}")
    print(f"      h={np.round(h, 3)}")
    print()

# Show how hidden state norms evolve
norms = [np.linalg.norm(hs) for hs in hidden_states]
print("Hidden state norms over time:")
for t, n in enumerate(norms):
    bar = '#' * int(n * 10)
    print(f"  t={t}: {n:.3f} {bar}")`}
        title="Vanilla RNN Cell"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: LSTM Cell From Scratch                        */
/* ================================================================== */
function PythonLSTMSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: LSTM Cell from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Now let us implement the full LSTM equations. Each gate is a small neural network (linear
        transform + sigmoid), and the candidate value uses tanh. The cell state is updated via
        element-wise operations, creating that crucial linear gradient highway.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def lstm_cell(x_t, h_prev, c_prev, Wf, Wi, Wc, Wo, bf, bi, bc, bo):
    """Full LSTM cell forward pass."""
    # Concatenate input and previous hidden state
    combined = np.concatenate([h_prev, x_t])

    # Forget gate: what to erase from cell state
    f_t = sigmoid(Wf @ combined + bf)

    # Input gate: what new info to write
    i_t = sigmoid(Wi @ combined + bi)

    # Candidate values
    c_hat = np.tanh(Wc @ combined + bc)

    # Update cell state
    c_t = f_t * c_prev + i_t * c_hat

    # Output gate: what to expose
    o_t = sigmoid(Wo @ combined + bo)

    # Hidden state
    h_t = o_t * np.tanh(c_t)

    return h_t, c_t, {'f': f_t, 'i': i_t, 'o': o_t}

# Setup
input_dim = 3
hidden_dim = 4
combined_dim = hidden_dim + input_dim

np.random.seed(42)
# Initialize all gate weights
init = lambda: (np.random.randn(hidden_dim, combined_dim) * 0.3,
                np.zeros(hidden_dim))
Wf, bf = init()
Wi, bi = init()
Wc, bc = init()
Wo, bo = init()

# Bias forget gate high (common initialization trick)
bf += 1.0

# Run on a sequence
seq = np.random.randn(8, input_dim)
h = np.zeros(hidden_dim)
c = np.zeros(hidden_dim)

print("LSTM forward pass over 8 timesteps:\\n")
for t in range(8):
    h, c, gates = lstm_cell(seq[t], h, c, Wf, Wi, Wc, Wo, bf, bi, bc, bo)
    print(f"t={t}: forget={np.mean(gates['f']):.3f}  "
          f"input={np.mean(gates['i']):.3f}  "
          f"output={np.mean(gates['o']):.3f}  "
          f"|h|={np.linalg.norm(h):.3f}  "
          f"|c|={np.linalg.norm(c):.3f}")

print("\\nNotice how the cell state norm grows steadily")
print("(forget gate is biased high, retaining info).")`}
        title="LSTM Cell with Gates"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function RNN() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">RNNs &amp; LSTMs</h1>
        <p className="text-lg text-gray-400">
          How recurrent architectures model sequential data, why vanilla RNNs struggle with long
          sequences, and how gating mechanisms in LSTMs and GRUs solve the vanishing gradient problem.
        </p>
      </header>

      <SequentialDataSection />
      <UnrolledRNNSection />
      <VanishingGradientSection />
      <LSTMGatesSection />
      <GRUSection />
      <PythonRNNSection />
      <PythonLSTMSection />
    </div>
  )
}
