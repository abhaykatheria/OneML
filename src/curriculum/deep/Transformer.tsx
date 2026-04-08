import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/transformer',
  title: 'The Transformer',
  description: 'Understand the Transformer architecture: multi-head attention, positional encoding, and the building blocks behind GPT and BERT',
  track: 'deep',
  order: 5,
  tags: ['transformer', 'multi-head-attention', 'positional-encoding', 'encoder-decoder', 'gpt', 'bert'],
}

/* ================================================================== */
/*  Section 1 -- History and Motivation                                */
/* ================================================================== */
function HistorySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">From RNNs to "Attention Is All You Need"</h2>
      <p className="text-gray-300 leading-relaxed">
        By 2017, the dominant sequence-to-sequence architecture paired an RNN encoder with an RNN
        decoder, connected by an attention bridge. It worked, but training was painfully sequential:
        each timestep depended on the previous one, making it impossible to parallelize across
        positions. GPU utilization was abysmal for long sequences.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Vaswani et al.'s landmark paper "Attention Is All You Need" made a radical proposal: remove
        recurrence entirely and build the model from nothing but attention layers. The resulting
        <strong className="text-white"> Transformer</strong> was faster to train (fully parallelizable),
        achieved state-of-the-art translation quality, and turned out to be one of the most
        versatile architectures in deep learning history. Every major language model today -- GPT,
        BERT, T5, PaLM, Claude -- is built on the Transformer.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The key ingredients beyond self-attention: <strong className="text-white">multi-head attention
        </strong> (run several attention operations in parallel to capture different relationship
        types), <strong className="text-white">positional encoding</strong> (inject order information
        since attention is permutation-equivariant), <strong className="text-white">residual
        connections</strong> (ease gradient flow through deep stacks), and <strong className="text-white">
        layer normalization</strong> (stabilize training). Let us explore each one.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Multi-Head Attention                                  */
/* ================================================================== */
function MultiHeadSection() {
  const [activeHead, setActiveHead] = useState(0)
  const stateRef = useRef({ activeHead })
  stateRef.current = { activeHead }

  // Simulated attention patterns for 4 heads
  const headPatterns: number[][][] = [
    // Head 0: positional (attend to adjacent)
    [
      [0.5, 0.3, 0.1, 0.05, 0.05],
      [0.25, 0.4, 0.25, 0.05, 0.05],
      [0.05, 0.25, 0.4, 0.25, 0.05],
      [0.05, 0.05, 0.25, 0.4, 0.25],
      [0.05, 0.05, 0.1, 0.3, 0.5],
    ],
    // Head 1: syntactic (verb attends to subject)
    [
      [0.6, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.6, 0.1, 0.1, 0.1],
      [0.3, 0.1, 0.3, 0.1, 0.2],
      [0.05, 0.05, 0.4, 0.4, 0.1],
      [0.2, 0.1, 0.1, 0.1, 0.5],
    ],
    // Head 2: copy/identity
    [
      [0.8, 0.05, 0.05, 0.05, 0.05],
      [0.05, 0.8, 0.05, 0.05, 0.05],
      [0.05, 0.05, 0.8, 0.05, 0.05],
      [0.05, 0.05, 0.05, 0.8, 0.05],
      [0.05, 0.05, 0.05, 0.05, 0.8],
    ],
    // Head 3: broad context
    [
      [0.22, 0.20, 0.20, 0.19, 0.19],
      [0.20, 0.22, 0.20, 0.19, 0.19],
      [0.20, 0.20, 0.22, 0.19, 0.19],
      [0.19, 0.19, 0.20, 0.22, 0.20],
      [0.19, 0.19, 0.20, 0.20, 0.22],
    ],
  ]

  const headLabels = ['Adjacent', 'Syntactic', 'Identity', 'Broad']
  const tokens = ['The', 'cat', 'sat', 'on', 'mat']

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { activeHead: ah } = stateRef.current
      const pattern = headPatterns[ah]
      p.background(15, 15, 25)

      const cellSize = 52
      const marginLeft = 70
      const marginTop = 70

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Head ${ah}: ${headLabels[ah]} pattern`, 20, 10)

      // Column headers
      for (let j = 0; j < tokens.length; j++) {
        p.fill(180)
        p.textSize(11)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(tokens[j], marginLeft + j * cellSize + cellSize / 2, marginTop - 4)
      }

      for (let i = 0; i < tokens.length; i++) {
        // Row label
        p.fill(180)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(tokens[i], marginLeft - 8, marginTop + i * cellSize + cellSize / 2)

        for (let j = 0; j < tokens.length; j++) {
          const w = pattern[i][j]
          const x = marginLeft + j * cellSize
          const y = marginTop + i * cellSize

          const headColors: [number, number, number][] = [
            [60, 180, 220],
            [220, 140, 60],
            [100, 220, 100],
            [200, 100, 200],
          ]
          const hc = headColors[ah]

          p.fill(hc[0] * w, hc[1] * w, hc[2] * w)
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

      // Description
      const descriptions = [
        'Adjacent: tokens attend mainly to their neighbors (local context)',
        'Syntactic: captures grammatical dependencies (e.g., verb->subject)',
        'Identity: each token attends mostly to itself (residual-like)',
        'Broad: diffuse attention, gathering global context from all positions',
      ]
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(descriptions[ah], 20, p.height - 8)
    }
  }, [headPatterns, headLabels, tokens])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Multi-Head Attention</h2>
      <p className="text-gray-300 leading-relaxed">
        A single attention head can only capture one type of relationship at a time. Multi-head
        attention runs <em>h</em> independent attention operations in parallel, each with its own
        learned W_Q, W_K, W_V projection matrices. The outputs are concatenated and projected back
        to the model dimension. Each head is free to learn a different attention pattern: one might
        focus on local neighbors, another on syntactic dependencies, another on semantic similarity.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The formula is: <code className="text-emerald-400">MultiHead(Q, K, V) = Concat(head_1, ..., head_h) @ W_O</code>
        where each head uses smaller projections (d_k = d_model / h), so the total cost is the same
        as a single full-dimensional attention. Click the tabs below to see four distinct patterns
        that different heads might learn.
      </p>

      <div className="flex gap-2 mb-2">
        {headLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => { setActiveHead(i); stateRef.current.activeHead = i }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeHead === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Head {i}: {label}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} height={380} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Positional Encoding Heatmap                           */
/* ================================================================== */
function PositionalEncodingSection() {
  const [maxLen, setMaxLen] = useState(32)
  const [dModel, setDModel] = useState(64)
  const stateRef = useRef({ maxLen, dModel })
  stateRef.current = { maxLen, dModel }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { maxLen: ml, dModel: dm } = stateRef.current
      p.background(15, 15, 25)

      const marginLeft = 50
      const marginTop = 50
      const plotW = p.width - marginLeft - 30
      const plotH = p.height - marginTop - 50

      const cellW = plotW / dm
      const cellH = plotH / ml

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Sinusoidal Positional Encoding', 20, 10)

      // Axis labels
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Embedding Dimension', marginLeft + plotW / 2, marginTop - 8)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Pos', marginLeft - 8, marginTop + plotH / 2)

      // Draw heatmap
      for (let pos = 0; pos < ml; pos++) {
        for (let i = 0; i < dm; i++) {
          const denom = Math.pow(10000, (2 * Math.floor(i / 2)) / dm)
          const val = i % 2 === 0 ? Math.sin(pos / denom) : Math.cos(pos / denom)
          const x = marginLeft + i * cellW
          const y = marginTop + pos * cellH

          // Map [-1, 1] to color
          const r = val > 0 ? 40 + val * 180 : 40
          const g = 30
          const b = val < 0 ? 40 + Math.abs(val) * 180 : 40

          p.noStroke()
          p.fill(r, g, b)
          p.rect(x, y, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1)
        }
      }

      // Tick labels
      p.fill(120)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      for (let i = 0; i < dm; i += Math.max(1, Math.floor(dm / 8))) {
        p.text(String(i), marginLeft + i * cellW + cellW / 2, marginTop + plotH + 4)
      }
      p.textAlign(p.RIGHT, p.CENTER)
      for (let pos = 0; pos < ml; pos += Math.max(1, Math.floor(ml / 8))) {
        p.text(String(pos), marginLeft - 4, marginTop + pos * cellH + cellH / 2)
      }

      // Color scale
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Red = positive, Blue = negative. Low dims change slowly, high dims change fast.', 20, p.height - 4)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Positional Encoding</h2>
      <p className="text-gray-300 leading-relaxed">
        Self-attention treats its input as a set -- it is permutation-equivariant, meaning
        rearranging the tokens produces the same rearrangement in the output. But word order matters
        in language! Positional encodings inject position information by adding a position-dependent
        vector to each token embedding before attention.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The original Transformer uses sinusoidal encodings: for position <em>pos</em> and dimension
        <em>i</em>, the encoding is sin(pos/10000^(2i/d)) for even dimensions and cos for odd.
        Each dimension oscillates at a different frequency, creating a unique "fingerprint" for each
        position. The heatmap below shows these encodings -- low-frequency dimensions (left)
        distinguish distant positions, while high-frequency dimensions (right) distinguish adjacent
        positions.
      </p>
      <P5Sketch
        sketch={sketch}
        height={360}
        controls={
          <ControlPanel title="Parameters">
            <InteractiveSlider label="Sequence Length" min={8} max={64} step={8} value={maxLen} onChange={(v) => { setMaxLen(v); stateRef.current.maxLen = v }} />
            <InteractiveSlider label="Model Dimension" min={16} max={128} step={16} value={dModel} onChange={(v) => { setDModel(v); stateRef.current.dModel = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Transformer Block Diagram (Animated)                  */
/* ================================================================== */
function TransformerBlockSection() {
  const sketch = useCallback((p: p5) => {
    let animT = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 500), 520)
      p.textFont('monospace')
    }

    p.draw = () => {
      animT += 0.015
      p.background(15, 15, 25)

      const cx = p.width / 2
      const blockW = 200
      const blockH = 40
      let y = 470

      const drawBlock = (label: string, color: readonly [number, number, number], yPos: number, pulse: boolean = false) => {
        const pulseScale = pulse ? 1 + Math.sin(animT * 3) * 0.03 : 1
        const bw = blockW * pulseScale
        const bh = blockH * pulseScale
        p.fill(color[0], color[1], color[2])
        p.stroke(color[0] + 40, color[1] + 40, color[2] + 40)
        p.strokeWeight(1.5)
        p.rect(cx - bw / 2, yPos - bh / 2, bw, bh, 8)
        p.fill(255)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, cx, yPos)
        return yPos
      }

      const drawArrow = (y1: number, y2: number) => {
        p.stroke(100)
        p.strokeWeight(1.5)
        p.line(cx, y1, cx, y2)
        p.fill(100)
        p.noStroke()
        p.triangle(cx - 4, y2, cx + 4, y2, cx, y2 - 6)
      }

      const drawResidual = (yFrom: number, yTo: number, side: 'left' | 'right') => {
        const xOff = side === 'left' ? -blockW / 2 - 25 : blockW / 2 + 25
        p.stroke(120, 200, 120, 100)
        p.strokeWeight(1.5)
        p.noFill()
        p.line(cx + xOff, yFrom, cx + xOff, yTo)
        p.line(cx + xOff, yTo, cx - blockW / 2 + (side === 'left' ? -2 : blockW + 2), yTo)
        // "+" label
        p.fill(120, 200, 120)
        p.noStroke()
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('+', cx + xOff, (yFrom + yTo) / 2)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Transformer Encoder Block', 20, 10)

      // Input
      y = 480
      drawBlock('Input Embeddings + Pos Enc', [60, 60, 100] as const, y)

      // Arrow up
      drawArrow(y - blockH / 2, y - 55)

      // Layer Norm 1
      y -= 70
      drawBlock('Layer Norm', [100, 80, 60] as const, y)
      const ln1Y = y

      drawArrow(y - blockH / 2, y - 55)

      // Multi-Head Attention
      y -= 70
      const pulseAttn = Math.sin(animT * 2) > 0
      drawBlock('Multi-Head Attention', [50, 100, 160] as const, y, pulseAttn)
      const mhaY = y

      // Residual around attention
      drawResidual(ln1Y, mhaY - blockH / 2 - 15, 'left')

      drawArrow(y - blockH / 2, y - 55)

      // Add & Norm
      y -= 70
      drawBlock('Add & Layer Norm', [100, 80, 60] as const, y)
      const ln2Y = y

      drawArrow(y - blockH / 2, y - 55)

      // FFN
      y -= 70
      drawBlock('Feed-Forward Network', [120, 60, 80] as const, y)
      const ffnY = y

      // Residual around FFN
      drawResidual(ln2Y, ffnY - blockH / 2 - 15, 'right')

      drawArrow(y - blockH / 2, y - 55)

      // Add & Norm 2
      y -= 70
      drawBlock('Add & Layer Norm', [100, 80, 60] as const, y)

      drawArrow(y - blockH / 2, y - 35)

      // Output
      y -= 50
      drawBlock('Output', [60, 100, 60] as const, y)

      // Legend
      p.fill(140)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Green lines = residual connections (skip connections)', 20, p.height - 4)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Transformer Block</h2>
      <p className="text-gray-300 leading-relaxed">
        A single Transformer block has two sub-layers, each wrapped with a residual connection and
        layer normalization. The first sub-layer is multi-head self-attention; the second is a
        position-wise feed-forward network (two linear layers with a ReLU or GELU activation).
      </p>
      <p className="text-gray-300 leading-relaxed">
        The residual connections (green lines) are critical: they let gradients flow directly
        through the block without passing through the attention or FFN computation, enabling very
        deep stacks (GPT-3 has 96 blocks). Layer normalization stabilizes the hidden state
        magnitudes, preventing training instabilities. A full Transformer stacks N of these blocks
        (typically 6-96 depending on model size).
      </p>
      <P5Sketch sketch={sketch} height={520} />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Encoder-Decoder vs Decoder-Only                       */
/* ================================================================== */
function ArchitectureVariantsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Architecture Variants</h2>

      <h3 className="text-xl font-semibold text-white">Encoder-Decoder (Original Transformer, T5)</h3>
      <p className="text-gray-300 leading-relaxed">
        The original Transformer has an <strong className="text-white">encoder</strong> that
        processes the full input with bidirectional attention, and a <strong className="text-white">
        decoder</strong> that generates the output autoregressively with masked attention. The
        decoder also has <strong className="text-white">cross-attention</strong> layers that attend
        from decoder states to encoder outputs. This is ideal for sequence-to-sequence tasks like
        translation, summarization, and question answering. T5 and BART use this architecture.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Encoder-Only (BERT)</h3>
      <p className="text-gray-300 leading-relaxed">
        BERT uses only the encoder stack with bidirectional attention. Every token can see every
        other token, making it excellent for understanding tasks: classification, named entity
        recognition, question answering (extractive). It is trained with masked language modeling
        (predict randomly masked tokens) and next sentence prediction. The bidirectional context
        gives BERT a deep understanding of each token's role in the sentence.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Decoder-Only (GPT, Claude)</h3>
      <p className="text-gray-300 leading-relaxed">
        GPT and its successors use only the decoder stack with causal (masked) attention. Each token
        can only attend to previous tokens, making it naturally suited for text generation. The
        training objective is simple: predict the next token. Despite this simplicity, scaling
        decoder-only Transformers to billions of parameters and trillions of training tokens has
        produced remarkably capable language models. The key insight is that next-token prediction,
        at scale, requires the model to learn compression, reasoning, and world knowledge.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Encoder-Decoder', examples: 'T5, BART, mBART', attention: 'Bidirectional + Cross + Causal', use: 'Translation, Summarization' },
          { title: 'Encoder-Only', examples: 'BERT, RoBERTa, DeBERTa', attention: 'Bidirectional', use: 'Classification, NER, QA' },
          { title: 'Decoder-Only', examples: 'GPT, Claude, LLaMA', attention: 'Causal (masked)', use: 'Generation, Chat, Reasoning' },
        ].map((arch) => (
          <div key={arch.title} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h4 className="text-white font-semibold mb-2">{arch.title}</h4>
            <p className="text-gray-400 text-sm"><strong className="text-gray-300">Models:</strong> {arch.examples}</p>
            <p className="text-gray-400 text-sm"><strong className="text-gray-300">Attention:</strong> {arch.attention}</p>
            <p className="text-gray-400 text-sm"><strong className="text-gray-300">Best for:</strong> {arch.use}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Python: Transformer Block from Scratch                */
/* ================================================================== */
function PythonTransformerSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Transformer Block from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Below we implement a complete (single-head for clarity) Transformer block: self-attention,
        residual connection, layer normalization, and a feed-forward network. This is the fundamental
        repeated unit of every Transformer model.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

def layer_norm(x, eps=1e-5):
    mean = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    return (x - mean) / np.sqrt(var + eps)

def self_attention(X, W_Q, W_K, W_V):
    Q, K, V = X @ W_Q, X @ W_K, X @ W_V
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    weights = softmax(scores)
    return weights @ V, weights

def feed_forward(X, W1, b1, W2, b2):
    # Two-layer FFN with GELU approximation
    hidden = X @ W1 + b1
    hidden = hidden * 0.5 * (1 + np.tanh(np.sqrt(2/np.pi) * (hidden + 0.044715 * hidden**3)))
    return hidden @ W2 + b2

def transformer_block(X, W_Q, W_K, W_V, W1, b1, W2, b2):
    # Sub-layer 1: Self-attention + residual + layer norm
    attn_out, weights = self_attention(X, W_Q, W_K, W_V)
    X = layer_norm(X + attn_out)  # residual + norm

    # Sub-layer 2: FFN + residual + layer norm
    ffn_out = feed_forward(X, W1, b1, W2, b2)
    X = layer_norm(X + ffn_out)  # residual + norm

    return X, weights

# Setup
np.random.seed(42)
T, d_model = 5, 16
d_ff = 32  # FFN hidden dim

# Input (simulated token embeddings)
X = np.random.randn(T, d_model) * 0.5

# Initialize weights
W_Q = np.random.randn(d_model, d_model) * 0.1
W_K = np.random.randn(d_model, d_model) * 0.1
W_V = np.random.randn(d_model, d_model) * 0.1
W1 = np.random.randn(d_model, d_ff) * 0.1
b1 = np.zeros(d_ff)
W2 = np.random.randn(d_ff, d_model) * 0.1
b2 = np.zeros(d_model)

tokens = ['The', 'cat', 'sat', 'on', 'mat']

print("=== Single Transformer Block ===\\n")
print(f"Input shape: {X.shape} ({T} tokens x {d_model} dims)")
print(f"Input norms: {[f'{np.linalg.norm(X[i]):.3f}' for i in range(T)]}")

output, attn_weights = transformer_block(X, W_Q, W_K, W_V, W1, b1, W2, b2)

print(f"\\nOutput shape: {output.shape}")
print(f"Output norms: {[f'{np.linalg.norm(output[i]):.3f}' for i in range(T)]}")

print("\\nAttention weights (who attends to whom):")
for i in range(T):
    top = np.argmax(attn_weights[i])
    print(f"  {tokens[i]:5s} -> {tokens[top]:5s} ({attn_weights[i][top]:.3f})")

# Stack multiple blocks
print("\\n=== Stacking 4 Blocks ===")
X_deep = X.copy()
for block_idx in range(4):
    X_deep, _ = transformer_block(
        X_deep,
        np.random.randn(d_model, d_model) * 0.1,
        np.random.randn(d_model, d_model) * 0.1,
        np.random.randn(d_model, d_model) * 0.1,
        np.random.randn(d_model, d_ff) * 0.1,
        np.zeros(d_ff),
        np.random.randn(d_ff, d_model) * 0.1,
        np.zeros(d_model),
    )
    norms = [np.linalg.norm(X_deep[i]) for i in range(T)]
    print(f"  Block {block_idx}: norms = {[f'{n:.3f}' for n in norms]}")

print("\\nLayer norm keeps norms stable through deep stacks!")`}
        title="Transformer Block from Scratch"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Positional Encoding                           */
/* ================================================================== */
function PythonPositionalSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Positional Encoding</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement the sinusoidal positional encoding and verify its key property: the dot
        product between position encodings depends only on the relative distance, giving the model
        a natural notion of proximity.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def sinusoidal_encoding(max_len, d_model):
    """Generate sinusoidal positional encodings."""
    PE = np.zeros((max_len, d_model))
    position = np.arange(max_len)[:, np.newaxis]  # (max_len, 1)
    div_term = np.exp(np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model))

    PE[:, 0::2] = np.sin(position * div_term)  # even dimensions
    PE[:, 1::2] = np.cos(position * div_term)  # odd dimensions
    return PE

# Generate encodings
max_len, d_model = 50, 32
PE = sinusoidal_encoding(max_len, d_model)

print(f"Positional encoding shape: {PE.shape}")
print(f"PE[0] first 8 dims: {np.round(PE[0, :8], 3)}")
print(f"PE[1] first 8 dims: {np.round(PE[1, :8], 3)}")

# Key property: dot product depends on relative distance
print("\\n=== Dot products between position encodings ===")
print("(showing that similarity depends on relative distance)")
print()
for ref_pos in [0, 10, 25]:
    dps = []
    for offset in [0, 1, 2, 5, 10, 20]:
        other = ref_pos + offset
        if other < max_len:
            dp = np.dot(PE[ref_pos], PE[other])
            dps.append(f"  d={offset:2d}: {dp:.3f}")
    print(f"From position {ref_pos}:")
    print("\\n".join(dps))
    print()

print("Notice: the dot product pattern is similar regardless of")
print("absolute position -- it depends mainly on the distance.")`}
        title="Sinusoidal Positional Encoding"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Transformer() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">The Transformer</h1>
        <p className="text-lg text-gray-400">
          The architecture that powers modern AI: multi-head attention, positional encoding,
          residual connections, and the variants behind GPT, BERT, and every major language model.
        </p>
      </header>

      <HistorySection />
      <MultiHeadSection />
      <PositionalEncodingSection />
      <TransformerBlockSection />
      <ArchitectureVariantsSection />
      <PythonTransformerSection />
      <PythonPositionalSection />
    </div>
  )
}
