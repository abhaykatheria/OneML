import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/self-attention',
  title: 'Self-Attention',
  description: 'Understand the attention mechanism that lets every token attend to every other, enabling parallel processing of sequences',
  track: 'deep',
  order: 4,
  tags: ['attention', 'self-attention', 'query', 'key', 'value', 'transformer', 'scaled-dot-product'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function softmax(arr: number[]): number[] {
  const max = Math.max(...arr)
  const exps = arr.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

const TOKENS = ['The', 'cat', 'sat', 'on', 'the']

// Simulated Q, K, V matrices (5 tokens x 4 dims)
const Q_RAW: number[][] = [
  [0.8, 0.2, -0.1, 0.5],
  [0.3, 0.9, 0.4, -0.2],
  [-0.1, 0.4, 0.8, 0.3],
  [0.5, -0.3, 0.2, 0.7],
  [0.7, 0.1, -0.2, 0.4],
]

const K_RAW: number[][] = [
  [0.6, 0.3, 0.1, 0.4],
  [0.2, 0.8, 0.5, -0.1],
  [0.1, 0.3, 0.9, 0.2],
  [0.4, -0.2, 0.3, 0.8],
  [0.5, 0.2, 0.0, 0.3],
]

const V_RAW: number[][] = [
  [1.0, 0.0, 0.5, 0.2],
  [0.0, 1.0, 0.3, 0.8],
  [0.5, 0.3, 1.0, 0.1],
  [0.2, 0.8, 0.1, 1.0],
  [0.9, 0.1, 0.4, 0.3],
]

function computeAttention(Q: number[][], K: number[][], V: number[][], mask: boolean = false): {
  scores: number[][]
  weights: number[][]
  output: number[][]
} {
  const T = Q.length
  const dk = Q[0].length
  const scale = Math.sqrt(dk)
  const scores: number[][] = []
  const weights: number[][] = []
  const output: number[][] = []

  for (let i = 0; i < T; i++) {
    const row: number[] = []
    for (let j = 0; j < T; j++) {
      let dot = 0
      for (let k = 0; k < dk; k++) dot += Q[i][k] * K[j][k]
      let score = dot / scale
      if (mask && j > i) score = -1e9
      row.push(score)
    }
    scores.push(row)
    weights.push(softmax(row))

    // Weighted sum of values
    const out = new Array(V[0].length).fill(0)
    for (let j = 0; j < T; j++) {
      for (let k = 0; k < V[0].length; k++) {
        out[k] += weights[i][j] * V[j][k]
      }
    }
    output.push(out)
  }

  return { scores, weights, output }
}

/* ================================================================== */
/*  Section 1 -- Why Attention?                                        */
/* ================================================================== */
function WhyAttentionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Attention?</h2>
      <p className="text-gray-300 leading-relaxed">
        RNNs process sequences one step at a time, compressing all prior information into a
        fixed-size hidden state. This creates a bottleneck: by the time the model reaches the end of
        a long sentence, early information may be washed out. Attention solves this by letting
        every position directly access every other position in the sequence, bypassing the
        sequential bottleneck entirely.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The original attention mechanism (Bahdanau et al., 2014) was used in encoder-decoder models
        for machine translation. <strong className="text-white">Self-attention</strong> (Vaswani et
        al., 2017) goes further: instead of attending from decoder to encoder, each token in a
        sequence attends to all other tokens in the same sequence. This captures dependencies
        regardless of distance and allows fully parallel computation.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The mechanism is elegant: each token produces three vectors -- a <strong className="text-white">
        Query</strong> ("what am I looking for?"), a <strong className="text-white">Key</strong>
        ("what do I contain?"), and a <strong className="text-white">Value</strong> ("what
        information do I provide?"). Attention weights are computed by matching queries against keys,
        then used to produce a weighted combination of values.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Interactive Q/K/V with Attention Lines                */
/* ================================================================== */
function QKVVisualizationSection() {
  const [queryIdx, setQueryIdx] = useState(1)
  const stateRef = useRef({ queryIdx })
  stateRef.current = { queryIdx }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { queryIdx: qi } = stateRef.current
      p.background(15, 15, 25)

      const { weights } = computeAttention(Q_RAW, K_RAW, V_RAW)
      const attnRow = weights[qi]

      const tokenY = 160
      const boxW = 80
      const boxH = 44
      const totalW = TOKENS.length * (boxW + 20) - 20
      const startX = (p.width - totalW) / 2

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Select a query token to see its attention weights', 20, 12)

      // Query label
      p.fill(80, 180, 255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Query', startX + qi * (boxW + 20) + boxW / 2, tokenY - 50)

      // Draw arrow from query label
      const qx = startX + qi * (boxW + 20) + boxW / 2
      p.stroke(80, 180, 255)
      p.strokeWeight(2)
      p.line(qx, tokenY - 46, qx, tokenY - 4)

      // Draw tokens
      for (let i = 0; i < TOKENS.length; i++) {
        const x = startX + i * (boxW + 20)
        const isQuery = i === qi
        const weight = attnRow[i]

        // Attention line from query to this key
        if (!isQuery) {
          const lineAlpha = weight * 255
          const lineW = weight * 8 + 0.5
          p.stroke(255, 180, 60, lineAlpha)
          p.strokeWeight(lineW)
          p.line(qx, tokenY + boxH + 4, x + boxW / 2, tokenY + boxH + 50)
          p.line(x + boxW / 2, tokenY + boxH + 50, x + boxW / 2, tokenY + boxH + 4)
        }

        // Token box
        if (isQuery) {
          p.fill(30, 80, 140)
          p.stroke(80, 180, 255)
          p.strokeWeight(2)
        } else {
          const brightness = 30 + weight * 120
          p.fill(brightness, brightness * 0.7, 20)
          p.stroke(80 + weight * 175, 120 + weight * 60, 30)
          p.strokeWeight(1.5)
        }
        p.rect(x, tokenY, boxW, boxH, 6)

        // Token text
        p.fill(255)
        p.noStroke()
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(TOKENS[i], x + boxW / 2, tokenY + boxH / 2)

        // Weight below
        p.fill(200)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(weight.toFixed(3), x + boxW / 2, tokenY + boxH + 56)

        // Bar chart
        const barMaxH = 60
        const barH = weight * barMaxH
        const barX = x + boxW / 2 - 12
        const barY = tokenY + boxH + 76
        p.fill(255, 180, 60, 150)
        p.noStroke()
        p.rect(barX, barY + barMaxH - barH, 24, barH, 3)
      }

      // Legend
      p.fill(140)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Line thickness = attention weight. Brighter tokens receive more attention.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Query, Key, Value: Interactive Attention</h2>
      <p className="text-gray-300 leading-relaxed">
        Select a query token below. The visualization shows how strongly that token attends to
        every other token (including itself). Line thickness and color intensity represent attention
        weight magnitude. The bar chart at the bottom shows the full attention distribution -- notice
        it always sums to 1 (it is a probability distribution from softmax).
      </p>
      <p className="text-gray-300 leading-relaxed">
        In practice, Q, K, and V are produced by multiplying the input embeddings by learned weight
        matrices: <code className="text-emerald-400">Q = X @ W_Q</code>,{' '}
        <code className="text-emerald-400">K = X @ W_K</code>,{' '}
        <code className="text-emerald-400">V = X @ W_V</code>. The model learns what to query for,
        what to advertise in keys, and what information to pass in values.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Query Token">
            <div className="flex gap-2">
              {TOKENS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setQueryIdx(i); stateRef.current.queryIdx = i }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    queryIdx === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {t}
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
/*  Section 3 -- Scaled Dot-Product Step by Step                       */
/* ================================================================== */
function ScaledDotProductSection() {
  const [step, setStep] = useState(0)
  const stateRef = useRef({ step })
  stateRef.current = { step }

  const sketch = useCallback((p: p5) => {
    let animFrame = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { step: s } = stateRef.current
      p.background(15, 15, 25)
      animFrame++

      const { scores, weights, output } = computeAttention(Q_RAW, K_RAW, V_RAW)
      const cellSize = 44
      const matStartY = 60

      const steps = [
        { title: 'Step 1: Q * K^T (dot products)', matrix: scores, label: 'Raw Scores', colorScale: 'diverging' as const },
        { title: 'Step 2: Scale by sqrt(d_k)', matrix: scores.map(r => r.map(v => v)), label: 'Scaled (already shown)', colorScale: 'diverging' as const },
        { title: 'Step 3: Softmax (normalize rows)', matrix: weights, label: 'Attention Weights', colorScale: 'sequential' as const },
        { title: 'Step 4: Weights * V (weighted sum)', matrix: output, label: 'Output', colorScale: 'sequential' as const },
      ]

      const currentStep = steps[Math.min(s, steps.length - 1)]
      const mat = currentStep.matrix

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(currentStep.title, 20, 12)

      // Find range for coloring
      let matMin = Infinity
      let matMax = -Infinity
      for (const row of mat) for (const v of row) { matMin = Math.min(matMin, v); matMax = Math.max(matMax, v) }

      const matX = (p.width - mat[0].length * cellSize) / 2
      const matY = matStartY

      // Column headers (token labels for QK^T steps)
      if (s < 3) {
        for (let j = 0; j < TOKENS.length; j++) {
          p.fill(160)
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(TOKENS[j], matX + j * cellSize + cellSize / 2, matY - 4)
        }
      }

      // Row labels
      for (let i = 0; i < mat.length; i++) {
        p.fill(160)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(TOKENS[i] || `d${i}`, matX - 8, matY + i * cellSize + cellSize / 2)
      }

      // Draw matrix cells
      for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[i].length; j++) {
          const val = mat[i][j]
          const x = matX + j * cellSize
          const y = matY + i * cellSize

          let r: number, g: number, b: number
          if (currentStep.colorScale === 'diverging') {
            const t = matMax !== matMin ? (val - matMin) / (matMax - matMin) : 0.5
            r = t > 0.5 ? 60 + (t - 0.5) * 2 * 160 : 60
            g = t > 0.5 ? 60 : 60 + (0.5 - t) * 2 * 100
            b = t < 0.5 ? 60 + (0.5 - t) * 2 * 160 : 60
          } else {
            const t = matMax !== matMin ? (val - matMin) / (matMax - matMin) : 0
            r = 20 + t * 200
            g = 20 + t * 140
            b = 20 + t * 40
          }

          // Animate entry appearance
          const delay = (i * mat[0].length + j) * 2
          const alpha = Math.min(255, Math.max(0, (animFrame - delay) * 20))

          p.fill(r, g, b, alpha)
          p.stroke(50)
          p.strokeWeight(1)
          p.rect(x, y, cellSize, cellSize)

          if (alpha > 100) {
            p.fill(255, alpha)
            p.noStroke()
            p.textSize(9)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(val.toFixed(2), x + cellSize / 2, y + cellSize / 2)
          }
        }
      }

      // Formula
      p.fill(140)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Scaled Dot-Product: Step by Step</h2>
      <p className="text-gray-300 leading-relaxed">
        The attention computation happens in four clean steps. First, compute the raw dot products
        between all query-key pairs, forming a T x T score matrix. Second, scale by 1/sqrt(d_k) to
        prevent the dot products from growing too large (which would push softmax into saturated
        regions with tiny gradients). Third, apply softmax row-wise to get a probability
        distribution. Fourth, multiply the weights by the value matrix to get the final output.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Step through the computation below. Notice how each row of the attention weight matrix sums
        to 1, and how the output for each token is a weighted blend of all value vectors.
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Computation Step">
            <InteractiveSlider label="Step" min={0} max={3} step={1} value={step} onChange={(v) => { setStep(v); stateRef.current.step = v }} />
            <p className="text-xs text-gray-500">
              0: Q*K^T &nbsp; 1: Scale &nbsp; 2: Softmax &nbsp; 3: Weights*V
            </p>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Attention Heatmap (clickable)                         */
/* ================================================================== */
function AttentionHeatmapSection() {
  const [selectedRow, setSelectedRow] = useState(0)
  const stateRef = useRef({ selectedRow })
  stateRef.current = { selectedRow }

  const { weights } = computeAttention(Q_RAW, K_RAW, V_RAW)

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 500), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)
      const cellSize = 60
      const marginLeft = 80
      const marginTop = 60
      const sel = stateRef.current.selectedRow

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Attention Heatmap (click a row)', 20, 10)

      // Column headers
      for (let j = 0; j < TOKENS.length; j++) {
        p.fill(180)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(TOKENS[j], marginLeft + j * cellSize + cellSize / 2, marginTop - 4)
      }

      // Label
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Keys', marginLeft + (TOKENS.length * cellSize) / 2, marginTop - 18)

      p.push()
      p.translate(12, marginTop + (TOKENS.length * cellSize) / 2)
      p.rotate(-p.HALF_PI)
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Queries', 0, 0)
      p.pop()

      for (let i = 0; i < TOKENS.length; i++) {
        // Row label
        p.fill(i === sel ? p.color(80, 180, 255) : p.color(180))
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(TOKENS[i], marginLeft - 8, marginTop + i * cellSize + cellSize / 2)

        for (let j = 0; j < TOKENS.length; j++) {
          const w = weights[i][j]
          const x = marginLeft + j * cellSize
          const y = marginTop + i * cellSize

          // Cell color
          const intensity = w * 255
          p.fill(intensity * 0.9, intensity * 0.6, 20 + intensity * 0.2)
          p.stroke(i === sel ? p.color(80, 180, 255) : p.color(40))
          p.strokeWeight(i === sel ? 2 : 1)
          p.rect(x, y, cellSize, cellSize)

          // Value text
          p.fill(w > 0.3 ? 255 : 180)
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(w.toFixed(3), x + cellSize / 2, y + cellSize / 2)
        }
      }

      // Interpretation
      const maxIdx = weights[sel].indexOf(Math.max(...weights[sel]))
      p.fill(200)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`"${TOKENS[sel]}" attends most to "${TOKENS[maxIdx]}" (${weights[sel][maxIdx].toFixed(3)})`, 20, p.height - 8)
    }

    p.mousePressed = () => {
      const cellSize = 60
      const marginLeft = 80
      const marginTop = 60
      const row = Math.floor((p.mouseY - marginTop) / cellSize)
      if (row >= 0 && row < TOKENS.length && p.mouseX >= marginLeft) {
        stateRef.current.selectedRow = row
        setSelectedRow(row)
      }
    }
  }, [weights])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Attention Heatmap</h2>
      <p className="text-gray-300 leading-relaxed">
        The attention weight matrix is naturally visualized as a heatmap. Each row shows one query
        token's attention distribution over all key tokens. Brighter cells indicate higher attention.
        Click on different rows to highlight them and see which token each query attends to most
        strongly.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In a well-trained model, attention patterns reveal interpretable linguistic structure:
        pronouns attend to their antecedents, verbs attend to their subjects, and adjectives attend
        to the nouns they modify. The model learns these patterns purely from the training objective,
        with no explicit supervision about grammar.
      </p>
      <P5Sketch sketch={sketch} height={380} />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Masked Attention                                      */
/* ================================================================== */
function MaskedAttentionSection() {
  const [masked, setMasked] = useState(false)
  const stateRef = useRef({ masked })
  stateRef.current = { masked }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 500), 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { masked: m } = stateRef.current
      p.background(15, 15, 25)

      const { weights } = computeAttention(Q_RAW, K_RAW, V_RAW, m)
      const cellSize = 54
      const marginLeft = 80
      const marginTop = 60

      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(m ? 'Masked (Causal) Attention' : 'Bidirectional Attention', 20, 10)

      // Column headers
      for (let j = 0; j < TOKENS.length; j++) {
        p.fill(180)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(TOKENS[j], marginLeft + j * cellSize + cellSize / 2, marginTop - 4)
      }

      for (let i = 0; i < TOKENS.length; i++) {
        p.fill(180)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(TOKENS[i], marginLeft - 8, marginTop + i * cellSize + cellSize / 2)

        for (let j = 0; j < TOKENS.length; j++) {
          const w = weights[i][j]
          const x = marginLeft + j * cellSize
          const y = marginTop + i * cellSize
          const isMaskedCell = m && j > i

          if (isMaskedCell) {
            p.fill(20, 15, 25)
            p.stroke(40)
            p.strokeWeight(1)
            p.rect(x, y, cellSize, cellSize)
            p.fill(60)
            p.noStroke()
            p.textSize(14)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('X', x + cellSize / 2, y + cellSize / 2)
          } else {
            const intensity = w * 255
            p.fill(intensity * 0.9, intensity * 0.6, 20 + intensity * 0.2)
            p.stroke(40)
            p.strokeWeight(1)
            p.rect(x, y, cellSize, cellSize)
            p.fill(w > 0.3 ? 255 : 180)
            p.noStroke()
            p.textSize(10)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(w.toFixed(2), x + cellSize / 2, y + cellSize / 2)
          }
        }
      }

      p.fill(140)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(m ? 'Each token can only attend to itself and previous tokens' : 'Each token can attend to all tokens', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Masked (Causal) Attention</h2>
      <p className="text-gray-300 leading-relaxed">
        In autoregressive models like GPT, each token must only attend to tokens that came before it
        -- attending to future tokens would be cheating during generation. This is enforced by
        setting future positions to negative infinity before softmax, creating a lower-triangular
        attention pattern. Toggle between bidirectional and masked attention to see the difference.
      </p>
      <p className="text-gray-300 leading-relaxed">
        BERT-style encoders use bidirectional attention (each token sees the full context). GPT-style
        decoders use masked attention. The masked version redistributes attention mass: tokens that
        would have gone to future positions are now allocated to past positions and self-attention.
      </p>

      <div className="flex gap-3 mb-2">
        <button
          onClick={() => { setMasked(false); stateRef.current.masked = false }}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            !masked ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Bidirectional
        </button>
        <button
          onClick={() => { setMasked(true); stateRef.current.masked = true }}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            masked ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Masked (Causal)
        </button>
      </div>

      <P5Sketch sketch={sketch} height={360} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Python: Attention from Scratch                        */
/* ================================================================== */
function PythonAttentionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Self-Attention from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement the complete scaled dot-product attention in NumPy. This is the exact
        computation that runs billions of times during a single GPT forward pass.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Q: (T, d_k) queries
    K: (T, d_k) keys
    V: (T, d_v) values
    mask: optional (T, T) boolean mask (True = keep, False = mask out)
    """
    d_k = Q.shape[-1]

    # Step 1: Dot product of Q and K^T
    scores = Q @ K.T  # (T, T)
    print("Step 1 - Raw scores (Q @ K^T):")
    print(np.round(scores, 3))

    # Step 2: Scale
    scores = scores / np.sqrt(d_k)
    print(f"\\nStep 2 - Scaled by 1/sqrt({d_k}) = {1/np.sqrt(d_k):.3f}:")
    print(np.round(scores, 3))

    # Step 3: Optional masking
    if mask is not None:
        scores = np.where(mask, scores, -1e9)
        print("\\nStep 3 - After masking (future positions -> -inf):")
        print(np.round(np.where(mask, scores, float('nan')), 3))

    # Step 4: Softmax
    weights = softmax(scores)
    print("\\nStep 4 - Attention weights (softmax):")
    print(np.round(weights, 3))
    print(f"Row sums: {weights.sum(axis=1).round(3)}")

    # Step 5: Weighted sum of V
    output = weights @ V  # (T, d_v)
    print("\\nStep 5 - Output (weights @ V):")
    print(np.round(output, 3))

    return output, weights

# Example: 5 tokens, embedding dim 4
np.random.seed(42)
T, d_model, d_k = 5, 8, 4

# Simulated embeddings
X = np.random.randn(T, d_model)

# Learned projection matrices
W_Q = np.random.randn(d_model, d_k) * 0.3
W_K = np.random.randn(d_model, d_k) * 0.3
W_V = np.random.randn(d_model, d_k) * 0.3

# Project to Q, K, V
Q = X @ W_Q
K = X @ W_K
V = X @ W_V

print("=== Bidirectional Attention ===\\n")
out_bi, w_bi = scaled_dot_product_attention(Q, K, V)

# Causal mask (lower triangular)
print("\\n\\n=== Causal (Masked) Attention ===\\n")
causal_mask = np.tril(np.ones((T, T), dtype=bool))
out_causal, w_causal = scaled_dot_product_attention(Q, K, V, mask=causal_mask)`}
        title="Self-Attention from Scratch"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Multi-Query Comparison                        */
/* ================================================================== */
function PythonMultiQuerySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Attention Patterns Analysis</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us analyze what different attention patterns look like and compute some statistics to
        build intuition about how attention distributes information.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

def attention(Q, K, V):
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    weights = softmax(scores)
    return weights @ V, weights

np.random.seed(123)
T, d = 6, 8
X = np.random.randn(T, d)
tokens = ['I', 'love', 'learning', 'about', 'neural', 'nets']

# Different random heads (simulating multi-head)
print("=== Different Attention Heads See Different Patterns ===\\n")
for head in range(3):
    W_Q = np.random.randn(d, d // 2) * 0.4
    W_K = np.random.randn(d, d // 2) * 0.4
    W_V = np.random.randn(d, d // 2) * 0.4
    _, w = attention(X @ W_Q, X @ W_K, X @ W_V)

    print(f"Head {head}:")
    for i in range(T):
        top_j = np.argmax(w[i])
        entropy = -np.sum(w[i] * np.log(w[i] + 1e-8))
        bar = ''.join(['#' if w[i][j] > 0.2 else '.' for j in range(T)])
        print(f"  {tokens[i]:10s} -> {tokens[top_j]:10s} "
              f"(max={w[i][top_j]:.3f}, entropy={entropy:.2f}) [{bar}]")
    print()

# Entropy analysis
print("=== Attention Entropy (sharp vs diffuse) ===")
print("Low entropy  = focused on few tokens")
print("High entropy = attending broadly")
print(f"Uniform entropy for T={T}: {np.log(T):.3f}")`}
        title="Multi-Head Attention Patterns"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function SelfAttention() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Self-Attention</h1>
        <p className="text-lg text-gray-400">
          The mechanism that lets every token in a sequence directly attend to every other token,
          enabling parallel computation and capturing long-range dependencies without recurrence.
        </p>
      </header>

      <WhyAttentionSection />
      <QKVVisualizationSection />
      <ScaledDotProductSection />
      <AttentionHeatmapSection />
      <MaskedAttentionSection />
      <PythonAttentionSection />
      <PythonMultiQuerySection />
    </div>
  )
}
