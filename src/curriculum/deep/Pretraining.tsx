import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/pretraining',
  title: 'Language Model Pretraining',
  description: 'How language models learn: autoregressive generation, causal masking, next-token prediction, perplexity, scaling laws, and pretraining data',
  track: 'deep',
  order: 8,
  tags: ['language-model', 'pretraining', 'autoregressive', 'perplexity', 'scaling-laws', 'next-token-prediction', 'cross-entropy'],
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Softmax over an array of numbers */
function softmax(arr: number[]): number[] {
  const max = Math.max(...arr)
  const exps = arr.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

/** Simulated next-token probabilities for demonstration */
const DEMO_PROMPT = ['The', 'cat', 'sat', 'on', 'the']
const DEMO_CONTINUATIONS: { candidates: string[]; logits: number[] }[] = [
  { candidates: ['mat', 'floor', 'roof', 'bed', 'couch'], logits: [3.2, 2.1, 1.5, 1.8, 1.0] },
  { candidates: ['and', '.', ',', 'while', 'then'], logits: [2.5, 3.0, 1.8, 1.2, 0.8] },
  { candidates: ['purred', 'looked', 'slept', 'the', 'waited'], logits: [2.8, 2.2, 1.9, 0.5, 1.6] },
  { candidates: ['softly', 'loudly', 'quietly', 'at', 'peacefully'], logits: [2.4, 1.0, 2.1, 2.6, 1.5] },
  { candidates: ['the', '.', 'while', 'in', 'and'], logits: [2.0, 2.8, 1.1, 1.5, 1.3] },
]

/* ================================================================== */
/*  Section 1 -- What is a Language Model?                             */
/* ================================================================== */
function WhatIsLMSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">What Is a Language Model?</h2>
      <p className="text-gray-300 leading-relaxed">
        At its core, a language model is a <strong className="text-white">probability distribution
        over sequences of tokens</strong>. Given a sequence of tokens that have appeared so far,
        the model assigns a probability to every possible next token. The token "mat" after
        "The cat sat on the" gets a higher probability than "quantum" because the model has learned
        from billions of text examples what plausible continuations look like.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Formally, a language model defines P(x_t | x_1, x_2, ..., x_{'{t-1}'}), the probability
        of the next token given all previous tokens. By the chain rule of probability, this lets us
        compute the probability of any complete sequence:
      </p>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm text-emerald-400">
        P(x_1, x_2, ..., x_T) = P(x_1) * P(x_2|x_1) * P(x_3|x_1,x_2) * ... * P(x_T|x_1,...,x_{'{T-1}'})
      </div>
      <p className="text-gray-300 leading-relaxed">
        This is the simplest useful thing a neural network can learn about language. Yet it turns
        out that predicting the next token well requires the model to learn grammar, facts about
        the world, reasoning patterns, and even a form of common sense. The training objective is
        deceptively simple; the capabilities that emerge from it at scale are not.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Every modern LLM -- GPT-4, Claude, LLaMA, Gemini -- is fundamentally a next-token predictor.
        The differences lie in architecture details, training data, scale, and the fine-tuning
        applied after pretraining. But the core pretraining objective is the same: learn to predict
        what comes next.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Autoregressive Generation                             */
/* ================================================================== */
function AutoregressiveSection() {
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(-1)
  const stateRef = useRef({ generatedTokens, generating, currentStepIdx })
  stateRef.current = { generatedTokens, generating, currentStepIdx }

  const generateNext = () => {
    const { generatedTokens: gt } = stateRef.current
    if (gt.length >= DEMO_CONTINUATIONS.length) return
    const stepIdx = gt.length
    const step = DEMO_CONTINUATIONS[stepIdx]
    const probs = softmax(step.logits)
    // Pick the highest probability token for demo clarity
    const maxIdx = probs.indexOf(Math.max(...probs))
    const chosen = step.candidates[maxIdx]
    const newTokens = [...gt, chosen]
    setGeneratedTokens(newTokens)
    setCurrentStepIdx(stepIdx)
    stateRef.current.generatedTokens = newTokens
    stateRef.current.currentStepIdx = stepIdx
  }

  const resetGeneration = () => {
    setGeneratedTokens([])
    setCurrentStepIdx(-1)
    setGenerating(false)
    stateRef.current.generatedTokens = []
    stateRef.current.currentStepIdx = -1
  }

  const autoGenerate = () => {
    resetGeneration()
    setGenerating(true)
    stateRef.current.generating = true
  }

  const sketch = useCallback((p: p5) => {
    let animFrame = 0
    let autoTimer = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      animFrame++
      const { generatedTokens: gt, generating: gen, currentStepIdx: csIdx } = stateRef.current
      p.background(15, 15, 25)

      // Auto-generation
      if (gen) {
        autoTimer++
        if (autoTimer % 50 === 0 && gt.length < DEMO_CONTINUATIONS.length) {
          generateNext()
        }
        if (gt.length >= DEMO_CONTINUATIONS.length) {
          stateRef.current.generating = false
          setGenerating(false)
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Autoregressive Token-by-Token Generation', 20, 10)

      // Prompt tokens
      const tokenY = 50
      let xPos = 20
      p.textSize(13)

      // Draw prompt
      for (const tok of DEMO_PROMPT) {
        const tw = p.textWidth(tok) + 14
        p.fill(30, 50, 80)
        p.stroke(60, 100, 160)
        p.strokeWeight(1)
        p.rect(xPos, tokenY, tw, 30, 4)
        p.fill(140, 180, 220)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.text(tok, xPos + tw / 2, tokenY + 15)
        xPos += tw + 4
      }

      // Draw generated tokens
      for (let i = 0; i < gt.length; i++) {
        const tok = gt[i]
        const tw = p.textWidth(tok) + 14
        const isLatest = i === gt.length - 1
        const pulse = isLatest ? Math.sin(animFrame * 0.1) * 0.3 + 0.7 : 1

        p.fill(30 * pulse, 70 * pulse, 40 * pulse)
        p.stroke(80 * pulse, 220 * pulse, 120 * pulse)
        p.strokeWeight(isLatest ? 2 : 1)
        p.rect(xPos, tokenY, tw, 30, 4)
        p.fill(80 * pulse, 220 * pulse, 120 * pulse)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.text(tok, xPos + tw / 2, tokenY + 15)
        xPos += tw + 4
      }

      // Cursor if not done
      if (gt.length < DEMO_CONTINUATIONS.length) {
        const cursorAlpha = Math.sin(animFrame * 0.08) * 127 + 128
        p.fill(255, 255, 100, cursorAlpha)
        p.noStroke()
        p.rect(xPos, tokenY, 3, 30)
      }

      // Probability bars for current/next step
      const barStepIdx = csIdx >= 0 ? csIdx : 0
      const step = DEMO_CONTINUATIONS[Math.min(barStepIdx, DEMO_CONTINUATIONS.length - 1)]
      const probs = softmax(step.logits)

      p.fill(200)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      const barLabel = csIdx >= 0
        ? `Probabilities at step ${csIdx + 1} (chose "${gt[csIdx]}"):`
        : 'Next-token probabilities (before generating):'
      p.text(barLabel, 20, 110)

      const barStartY = 135
      const barMaxW = 300
      const barH = 28
      const barGap = 6

      // Sort by probability for display
      const indexed = probs.map((pr, i) => ({ prob: pr, token: step.candidates[i], idx: i }))
      indexed.sort((a, b) => b.prob - a.prob)

      for (let i = 0; i < indexed.length; i++) {
        const { prob, token, idx: _idx } = indexed[i]
        const y = barStartY + i * (barH + barGap)
        const barW = prob * barMaxW

        // Token label
        p.fill(180)
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(token, 85, y + barH / 2)

        // Bar background
        p.fill(30, 30, 45)
        p.noStroke()
        p.rect(95, y, barMaxW, barH, 3)

        // Bar fill
        const isChosen = csIdx >= 0 && gt[csIdx] === token
        if (isChosen) {
          p.fill(80, 220, 120)
        } else {
          p.fill(60, 120, 180)
        }
        p.rect(95, y, barW, barH, 3)

        // Probability text
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${(prob * 100).toFixed(1)}%`, 95 + barW + 8, y + barH / 2)
      }

      // Explanation
      p.fill(140)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('At each step: compute probabilities over full vocabulary, sample one token, append, repeat.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Autoregressive Generation</h2>
      <p className="text-gray-300 leading-relaxed">
        Language models generate text one token at a time. Given a prompt, the model computes a
        probability distribution over all tokens in the vocabulary for the next position. A token
        is sampled from this distribution, appended to the sequence, and the process repeats. This
        is called <strong className="text-white">autoregressive generation</strong> because each
        output depends on all previous outputs.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is inherently sequential at generation time: you cannot produce token 5 until you know
        token 4, because token 4 is part of the context for predicting token 5. This is why
        generation is slow compared to training (where we know all tokens in advance).
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click "Generate Next" to watch a token appear one at a time, or "Auto-Generate" to see the
        full process animated. The probability bars show the model's top-5 candidate tokens at each
        step, with the chosen token highlighted in green.
      </p>
      <div className="flex gap-3 mb-2">
        <button
          onClick={generateNext}
          disabled={generatedTokens.length >= DEMO_CONTINUATIONS.length}
          className="px-4 py-1.5 rounded text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate Next
        </button>
        <button
          onClick={autoGenerate}
          className="px-4 py-1.5 rounded text-sm font-medium bg-blue-700 text-white hover:bg-blue-600 transition-colors"
        >
          Auto-Generate
        </button>
        <button
          onClick={resetGeneration}
          className="px-4 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>
      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Causal Masking                                        */
/* ================================================================== */
function CausalMaskingSection() {
  const [highlightPos, setHighlightPos] = useState(3)
  const posRef = useRef(highlightPos)
  posRef.current = highlightPos

  const tokens = ['The', 'cat', 'sat', 'on', 'the', 'mat']

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      const hp = posRef.current
      p.background(15, 15, 25)

      const T = tokens.length
      const cellSize = 56
      const marginLeft = 75
      const marginTop = 65

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Causal Attention Mask', 20, 10)

      // Column headers (Keys)
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Keys', marginLeft + (T * cellSize) / 2, marginTop - 24)
      for (let j = 0; j < T; j++) {
        const isVisible = j <= hp
        p.fill(isVisible ? p.color(120, 200, 255) : p.color(80))
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(tokens[j], marginLeft + j * cellSize + cellSize / 2, marginTop - 4)
        p.text(`pos ${j}`, marginLeft + j * cellSize + cellSize / 2, marginTop - 16)
      }

      // Row labels (Queries)
      for (let i = 0; i < T; i++) {
        const isHighlighted = i === hp
        p.fill(isHighlighted ? p.color(255, 200, 80) : p.color(160))
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(tokens[i], marginLeft - 8, marginTop + i * cellSize + cellSize / 2)
      }

      // Draw mask matrix
      for (let i = 0; i < T; i++) {
        for (let j = 0; j < T; j++) {
          const x = marginLeft + j * cellSize
          const y = marginTop + i * cellSize
          const canAttend = j <= i
          const isHighlightRow = i === hp

          if (canAttend) {
            const brightness = isHighlightRow ? 0.9 : 0.5
            if (isHighlightRow && j <= hp) {
              p.fill(40 * brightness, 100 * brightness, 60 * brightness)
              p.stroke(80, 220, 120)
              p.strokeWeight(1.5)
            } else {
              p.fill(30 * brightness, 50 * brightness, 80 * brightness)
              p.stroke(50)
              p.strokeWeight(1)
            }
            p.rect(x, y, cellSize, cellSize)

            // Checkmark
            p.fill(isHighlightRow ? p.color(80, 220, 120) : p.color(100, 160, 200))
            p.noStroke()
            p.textSize(16)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('\u2713', x + cellSize / 2, y + cellSize / 2)
          } else {
            // Masked (future)
            p.fill(15, 10, 20)
            p.stroke(30)
            p.strokeWeight(1)
            p.rect(x, y, cellSize, cellSize)

            // X mark
            p.fill(80, 30, 30)
            p.noStroke()
            p.textSize(16)
            p.textAlign(p.CENTER, p.CENTER)
            p.text('\u2717', x + cellSize / 2, y + cellSize / 2)
          }
        }
      }

      // Explanation for highlighted position
      const canSee = tokens.slice(0, hp + 1).join(', ')
      const cantSee = tokens.slice(hp + 1).join(', ')
      p.fill(200)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Position ${hp} ("${tokens[hp]}") can attend to: ${canSee}`, 20, p.height - 26)
      if (cantSee) {
        p.fill(120, 60, 60)
        p.text(`Cannot see future tokens: ${cantSee}`, 20, p.height - 8)
      } else {
        p.fill(120)
        p.text('(last position -- can see everything)', 20, p.height - 8)
      }
    }
  }, [tokens])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Causal Masking</h2>
      <p className="text-gray-300 leading-relaxed">
        During training and generation, the model must not look at future tokens. If it could see
        the answer when predicting, it would learn nothing. This constraint is enforced by{' '}
        <strong className="text-white">causal masking</strong> (also called the "attention mask"
        or "look-ahead mask"). Before the softmax in each attention head, the scores for all
        future positions (j {">"} i) are set to negative infinity, which softmax converts to
        exactly zero attention weight.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The result is a lower-triangular attention matrix: position 0 can only attend to itself,
        position 1 can attend to positions 0 and 1, and so on. This is exactly the masked attention
        you saw in the Self-Attention lesson. Use the slider below to highlight different positions
        and see what each one can "see."
      </p>
      <p className="text-gray-300 leading-relaxed">
        Note that this masking makes training remarkably efficient. We feed in an entire sequence
        at once, and every position simultaneously predicts its next token. Position 0 predicts
        token 1, position 1 predicts token 2, and so on. We get T training examples from a single
        sequence of length T, all computed in parallel. This is vastly more efficient than generating
        token by token at inference time.
      </p>
      <P5Sketch
        sketch={sketch}
        height={440}
        controls={
          <ControlPanel title="Highlight Position">
            <InteractiveSlider
              label="Position"
              min={0}
              max={tokens.length - 1}
              step={1}
              value={highlightPos}
              onChange={(v) => { setHighlightPos(v); posRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- The Training Objective                                */
/* ================================================================== */
function TrainingObjectiveSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Training Objective: Next-Token Prediction</h2>
      <p className="text-gray-300 leading-relaxed">
        The pretraining loss is <strong className="text-white">cross-entropy</strong> on next-token
        prediction. For a sequence of T tokens, the model produces a probability distribution at
        each position, and we measure how well that distribution matches the actual next token.
      </p>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm text-emerald-400">
        Loss = -(1/T) * sum_t log P(x_{'{t+1}'} | x_1, ..., x_t)
      </div>
      <p className="text-gray-300 leading-relaxed">
        This is the negative log probability of the correct next token, averaged over all positions.
        If the model assigns probability 0.9 to the correct token, the loss contribution is
        -log(0.9) = 0.105. If it assigns 0.01, the loss is -log(0.01) = 4.6. The loss strongly
        penalizes confident wrong predictions.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Teacher Forcing</h3>
      <p className="text-gray-300 leading-relaxed">
        During training, we always feed the model the <em>real</em> tokens, not its own predictions.
        This is called <strong className="text-white">teacher forcing</strong>. Even if the model
        predicts the wrong token at position 3, we still use the correct token at position 3 when
        computing the prediction for position 4. This prevents errors from compounding and makes
        training stable.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Teacher forcing, combined with causal masking, is what makes training massively parallel.
        We know all the "answers" in advance (they are the tokens shifted by one position), and
        each position's loss can be computed independently. A single forward pass through a
        sequence of 2048 tokens produces 2048 training signals simultaneously. This is why
        pretraining is so much faster (per token) than generation.
      </p>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 mt-4">
        <h3 className="text-lg font-semibold text-white mb-3">Training vs Generation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-400 font-semibold mb-1">Training (parallel)</p>
            <p className="text-gray-300">Input: [The, cat, sat, on, the]</p>
            <p className="text-gray-300">Target: [cat, sat, on, the, mat]</p>
            <p className="text-gray-400 text-xs mt-1">All 5 predictions computed at once via causal mask</p>
          </div>
          <div>
            <p className="text-emerald-400 font-semibold mb-1">Generation (sequential)</p>
            <p className="text-gray-300">Step 1: [The] -&gt; cat</p>
            <p className="text-gray-300">Step 2: [The, cat] -&gt; sat</p>
            <p className="text-gray-300">Step 3: [The, cat, sat] -&gt; on ...</p>
            <p className="text-gray-400 text-xs mt-1">Each step requires a full forward pass</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Perplexity                                            */
/* ================================================================== */
function PerplexitySection() {
  const [modelQuality, setModelQuality] = useState(0.7)
  const qualityRef = useRef(modelQuality)
  qualityRef.current = modelQuality

  const sentence = ['The', 'cat', 'sat', 'on', 'the', 'mat', '.']

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const quality = qualityRef.current
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Perplexity: How Surprised Is the Model?', 20, 10)

      // Generate probabilities based on quality
      // Higher quality -> higher probability for correct tokens
      const baseProbs = [0.15, 0.08, 0.12, 0.20, 0.25, 0.10, 0.30]
      const probs = baseProbs.map((bp) => {
        const adjusted = bp * quality + (1 - quality) * 0.01
        return Math.min(0.95, Math.max(0.005, adjusted))
      })

      const tokenY = 45
      let xPos = 20
      p.textSize(12)

      // Draw tokens with probability bars underneath
      const barMaxH = 120
      for (let i = 0; i < sentence.length; i++) {
        const tok = sentence[i]
        const prob = probs[i]
        const tw = Math.max(p.textWidth(tok) + 14, 55)

        // Token box
        const hue = prob > 0.15 ? [40, 80, 50] : prob > 0.05 ? [60, 60, 30] : [80, 30, 30]
        p.fill(hue[0], hue[1], hue[2])
        p.stroke(prob > 0.15 ? p.color(80, 200, 120) : prob > 0.05 ? p.color(200, 180, 60) : p.color(200, 60, 60))
        p.strokeWeight(1.5)
        p.rect(xPos, tokenY, tw, 28, 4)

        p.fill(220)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(12)
        p.text(tok, xPos + tw / 2, tokenY + 14)

        // Probability bar
        const barH = prob * barMaxH
        const barY = tokenY + 40
        p.fill(30, 30, 45)
        p.noStroke()
        p.rect(xPos + 5, barY, tw - 10, barMaxH, 2)

        const barColor = prob > 0.15 ? [80, 200, 120] : prob > 0.05 ? [200, 180, 60] : [200, 60, 60]
        p.fill(barColor[0], barColor[1], barColor[2])
        p.rect(xPos + 5, barY + barMaxH - barH, tw - 10, barH, 2)

        // Probability label
        p.fill(200)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`P=${prob.toFixed(3)}`, xPos + tw / 2, barY + barMaxH + 4)

        // -log(p) label
        const negLogP = -Math.log(prob)
        p.fill(160)
        p.textSize(8)
        p.text(`-logP=${negLogP.toFixed(2)}`, xPos + tw / 2, barY + barMaxH + 18)

        xPos += tw + 6
      }

      // Compute perplexity
      const avgNegLogP = probs.reduce((sum, pr) => sum - Math.log(pr), 0) / probs.length
      const perplexity = Math.exp(avgNegLogP)

      // Display perplexity
      const metricsY = 280
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Average cross-entropy: ${avgNegLogP.toFixed(3)}`, 20, metricsY)
      p.text(`Perplexity = exp(${avgNegLogP.toFixed(3)}) = ${perplexity.toFixed(1)}`, 20, metricsY + 24)

      // Interpretation
      p.fill(160)
      p.textSize(11)
      const interpY = metricsY + 56
      if (perplexity < 20) {
        p.fill(80, 200, 120)
        p.text('Excellent! Low perplexity = the model is confident and correct.', 20, interpY)
      } else if (perplexity < 100) {
        p.fill(200, 180, 60)
        p.text('Moderate perplexity. The model has some uncertainty.', 20, interpY)
      } else {
        p.fill(200, 80, 80)
        p.text('High perplexity! The model is very surprised by the text.', 20, interpY)
      }

      // Interpretation of perplexity value
      p.fill(140)
      p.textSize(10)
      p.text(
        `Perplexity of ${perplexity.toFixed(0)} means the model is as uncertain as choosing uniformly among ~${Math.round(perplexity)} tokens`,
        20,
        interpY + 22
      )

      // Reference values
      p.fill(120)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Typical perplexities: random (vocab_size~50K), GPT-2 (~30), GPT-3 (~20), GPT-4 (~10)', 20, p.height - 8)
    }
  }, [sentence])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Perplexity</h2>
      <p className="text-gray-300 leading-relaxed">
        Perplexity is the standard metric for language model quality. It answers the question:
        "how surprised is the model by the text?" Formally, perplexity is the exponential of the
        average cross-entropy loss:
      </p>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm text-emerald-400">
        Perplexity = exp( -(1/T) * sum_t log P(x_{'{t+1}'} | x_1, ..., x_t) )
      </div>
      <p className="text-gray-300 leading-relaxed">
        Lower perplexity is better. A perplexity of 1 means the model is perfectly certain about
        every next token. A perplexity of 50,000 (the vocabulary size) means the model is no better
        than random guessing. Intuitively, perplexity of K means the model is "as confused as if
        it were choosing uniformly among K options" at each step.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Use the slider to adjust model quality and see how perplexity changes. Green bars indicate
        tokens the model predicts well (high probability), red bars indicate surprising tokens.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Model Quality">
            <InteractiveSlider
              label="Quality"
              min={0.05}
              max={1.0}
              step={0.05}
              value={modelQuality}
              onChange={(v) => { setModelQuality(v); qualityRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Scaling Laws                                          */
/* ================================================================== */
function ScalingLawsSection() {
  const [highlightAxis, setHighlightAxis] = useState<'params' | 'data' | 'compute'>('params')
  const axisRef = useRef(highlightAxis)
  axisRef.current = highlightAxis

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      const axis = axisRef.current
      p.background(15, 15, 25)

      const marginLeft = 70
      const marginBottom = 60
      const marginTop = 50
      const marginRight = 30
      const plotW = p.width - marginLeft - marginRight
      const plotH = p.height - marginTop - marginBottom

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Neural Scaling Laws (log-log)', 20, 10)

      // Axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(marginLeft, marginTop, marginLeft, marginTop + plotH)
      p.line(marginLeft, marginTop + plotH, marginLeft + plotW, marginTop + plotH)

      // Y-axis label (Loss)
      p.fill(160)
      p.noStroke()
      p.textSize(10)
      p.push()
      p.translate(15, marginTop + plotH / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Cross-Entropy Loss', 0, 0)
      p.pop()

      // Y ticks
      const yTicks = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
      for (const yt of yTicks) {
        const yNorm = (yt - 1.5) / (4.0 - 1.5)
        const y = marginTop + plotH - yNorm * plotH
        p.stroke(35)
        p.strokeWeight(1)
        p.line(marginLeft, y, marginLeft + plotW, y)
        p.fill(100)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(yt.toFixed(1), marginLeft - 6, y)
      }

      // Define curves
      type CurveConfig = {
        label: string
        xLabel: string
        color: [number, number, number]
        key: 'params' | 'data' | 'compute'
        // Power law: loss = a * x^(-b) + c
        a: number
        b: number
        c: number
        xRange: [number, number] // log10 range
        models: { name: string; x: number; loss: number }[]
      }

      const curves: CurveConfig[] = [
        {
          label: 'Model Size (parameters)',
          xLabel: 'Parameters',
          color: [80, 180, 255],
          key: 'params',
          a: 8.0, b: 0.076, c: 1.5,
          xRange: [7, 12], // 10M to 1T
          models: [
            { name: 'GPT-2 (124M)', x: 8.09, loss: 3.3 },
            { name: 'GPT-2 (1.5B)', x: 9.18, loss: 2.85 },
            { name: 'GPT-3 (175B)', x: 11.24, loss: 2.1 },
            { name: 'LLaMA-7B', x: 9.85, loss: 2.5 },
            { name: 'LLaMA-65B', x: 10.81, loss: 2.0 },
          ],
        },
        {
          label: 'Dataset Size (tokens)',
          xLabel: 'Tokens',
          color: [255, 160, 80],
          key: 'data',
          a: 6.0, b: 0.095, c: 1.6,
          xRange: [8, 13], // 100M to 10T tokens
          models: [
            { name: '1B tokens', x: 9.0, loss: 3.5 },
            { name: '10B tokens', x: 10.0, loss: 3.0 },
            { name: '300B (GPT-3)', x: 11.48, loss: 2.3 },
            { name: '1T (LLaMA)', x: 12.0, loss: 2.1 },
            { name: '2T (Chinchilla)', x: 12.3, loss: 1.95 },
          ],
        },
        {
          label: 'Compute (FLOPs)',
          xLabel: 'FLOPs',
          color: [180, 120, 255],
          key: 'compute',
          a: 10.0, b: 0.05, c: 1.4,
          xRange: [17, 25], // 10^17 to 10^25
          models: [
            { name: 'GPT-2', x: 18.5, loss: 3.2 },
            { name: 'GPT-3', x: 23.0, loss: 2.0 },
            { name: 'Chinchilla', x: 23.5, loss: 1.85 },
            { name: 'PaLM', x: 24.0, loss: 1.75 },
          ],
        },
      ]

      // X-axis label
      const activeCurve = curves.find((c) => c.key === axis)!
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`${activeCurve.xLabel} (log10 scale)`, marginLeft + plotW / 2, marginTop + plotH + 30)

      // X ticks for active curve
      const [xMin, xMax] = activeCurve.xRange
      const xStep = Math.max(1, Math.floor((xMax - xMin) / 6))
      for (let x = xMin; x <= xMax; x += xStep) {
        const xNorm = (x - xMin) / (xMax - xMin)
        const px = marginLeft + xNorm * plotW
        p.stroke(35)
        p.strokeWeight(1)
        p.line(px, marginTop, px, marginTop + plotH)
        p.fill(100)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`10^${x}`, px, marginTop + plotH + 4)
      }

      // Draw all curves, active one highlighted
      for (const curve of curves) {
        const isActive = curve.key === axis
        const alpha = isActive ? 255 : 40

        // Draw curve line
        p.stroke(curve.color[0], curve.color[1], curve.color[2], alpha)
        p.strokeWeight(isActive ? 2.5 : 1)
        p.noFill()
        p.beginShape()
        for (let i = 0; i <= 100; i++) {
          const t = i / 100
          const logX = curve.xRange[0] + t * (curve.xRange[1] - curve.xRange[0])
          const x = Math.pow(10, logX)
          const loss = curve.a * Math.pow(x, -curve.b) + curve.c
          const xNorm = t
          const yNorm = (loss - 1.5) / (4.0 - 1.5)
          const px = marginLeft + xNorm * plotW
          const py = marginTop + plotH - yNorm * plotH
          if (py >= marginTop && py <= marginTop + plotH) {
            p.vertex(px, py)
          }
        }
        p.endShape()

        // Draw model markers if active
        if (isActive) {
          for (const model of curve.models) {
            const xNorm = (model.x - curve.xRange[0]) / (curve.xRange[1] - curve.xRange[0])
            const yNorm = (model.loss - 1.5) / (4.0 - 1.5)
            const px = marginLeft + xNorm * plotW
            const py = marginTop + plotH - yNorm * plotH

            if (px >= marginLeft && px <= marginLeft + plotW && py >= marginTop && py <= marginTop + plotH) {
              p.fill(curve.color[0], curve.color[1], curve.color[2])
              p.noStroke()
              p.ellipse(px, py, 8, 8)

              p.fill(200)
              p.textSize(8)
              p.textAlign(p.LEFT, p.BOTTOM)
              p.text(model.name, px + 6, py - 3)
            }
          }
        }
      }

      // Legend
      let legendX = marginLeft + 10
      const legendY = marginTop + 8
      for (const curve of curves) {
        const isActive = curve.key === axis
        p.fill(curve.color[0], curve.color[1], curve.color[2], isActive ? 255 : 80)
        p.noStroke()
        p.rect(legendX, legendY, 12, 12, 2)
        p.fill(isActive ? 220 : 80)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(curve.label, legendX + 16, legendY + 6)
        legendX += p.textWidth(curve.label) + 30
      }

      // Footer
      p.fill(140)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Scaling laws show smooth power-law relationships on log-log plots. More X = lower loss.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Scaling Laws</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most important empirical findings in deep learning is that language model loss
        follows <strong className="text-white">power laws</strong> as you scale up model size, data,
        and compute. On a log-log plot, the relationship between each of these quantities and the
        cross-entropy loss is approximately linear. This means you can predict performance at scale
        before actually training the full model.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The Chinchilla scaling law (Hoffmann et al., 2022) showed that previous models like GPT-3
        were under-trained: they used too many parameters relative to their training data. The
        optimal allocation is to scale model size and data roughly equally -- a 70B model trained
        on 1.4T tokens outperforms a 280B model trained on 300B tokens with the same compute budget.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click the tabs below to see how loss varies with model size, dataset size, and compute.
        Notice the labeled points showing where real models fall on these curves.
      </p>
      <div className="flex gap-2 mb-2">
        {[
          { key: 'params' as const, label: 'Model Size', color: 'blue' },
          { key: 'data' as const, label: 'Data Size', color: 'orange' },
          { key: 'compute' as const, label: 'Compute', color: 'purple' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => { setHighlightAxis(item.key); axisRef.current = item.key }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              highlightAxis === item.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <P5Sketch sketch={sketch} height={440} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Pretraining Data                                      */
/* ================================================================== */
function PretrainingDataSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Pretraining Data</h2>
      <p className="text-gray-300 leading-relaxed">
        A language model is only as good as its training data. Modern LLMs are trained on massive
        corpora assembled from diverse sources. The quality, diversity, and scale of this data
        fundamentally determine the model's capabilities.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {[
          {
            source: 'Web Text (Common Crawl)',
            pct: '~60%',
            desc: 'Filtered and deduplicated web pages. The largest source by volume, but highly variable quality. Aggressive filtering removes spam, boilerplate, and low-quality content.',
          },
          {
            source: 'Books',
            pct: '~15%',
            desc: 'Published books provide high-quality, long-form text with coherent narratives and reasoning. Especially valuable for learning complex prose and structured argumentation.',
          },
          {
            source: 'Code (GitHub)',
            pct: '~10%',
            desc: 'Source code teaches the model structured reasoning, formal logic, and precise syntax. Models trained with code score higher even on non-coding benchmarks.',
          },
          {
            source: 'Scientific Papers',
            pct: '~5%',
            desc: 'Academic papers from ArXiv, PubMed, etc. Provides factual knowledge, mathematical reasoning, and technical vocabulary.',
          },
          {
            source: 'Wikipedia',
            pct: '~5%',
            desc: 'High-quality encyclopedic text. Relatively small but very information-dense. Often upsampled (seen multiple times during training) due to quality.',
          },
          {
            source: 'Other (Forums, News, etc.)',
            pct: '~5%',
            desc: 'Stack Overflow, Reddit, news articles, and other curated sources. Provides conversational patterns and current events knowledge.',
          },
        ].map((item) => (
          <div key={item.source} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-semibold text-sm">{item.source}</span>
              <span className="text-emerald-400 text-sm font-mono">{item.pct}</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xl font-semibold text-white mt-6">Data Quality Matters</h3>
      <p className="text-gray-300 leading-relaxed">
        Raw web crawl data is extremely noisy. A typical data pipeline includes: (1){' '}
        <strong className="text-white">Language detection</strong> -- keep only the target language.
        (2) <strong className="text-white">Deduplication</strong> -- remove near-duplicate documents
        (which can be 30%+ of raw web text). (3) <strong className="text-white">Quality filtering
        </strong> -- remove low-quality text using heuristics (too short, too many special
        characters, low perplexity under a reference model). (4) <strong className="text-white">
        Safety filtering</strong> -- remove toxic, harmful, or private content.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The Chinchilla scaling laws showed that data is at least as important as model size. A
        smaller model trained on more high-quality data outperforms a larger model trained on less
        data. This has shifted the field's focus from "bigger models" to "better data."
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Bigram Language Model + Perplexity             */
/* ================================================================== */
function PythonBigramSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Bigram Language Model</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement the simplest possible language model: a bigram model that predicts the
        next token based only on the current token. Despite its extreme simplicity, it illustrates
        the core concepts: learning conditional probability distributions and computing perplexity.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# A simple bigram language model

# Training corpus (word-level tokens)
corpus = """the cat sat on the mat
the cat ate the fish
the dog sat on the rug
the dog ate the bone
the bird sat in the tree
the bird sang a song
a cat sat on a mat
a dog ran in the park""".strip().split('\\n')

# Tokenize (word-level for simplicity)
sentences = [s.split() for s in corpus]
vocab = sorted(set(w for s in sentences for w in s))
word2id = {w: i for i, w in enumerate(vocab)}
V = len(vocab)

print(f"Vocabulary ({V} tokens): {vocab}\\n")

# Count bigrams: P(next | current)
counts = np.zeros((V, V))
for sent in sentences:
    for i in range(len(sent) - 1):
        curr = word2id[sent[i]]
        nxt = word2id[sent[i + 1]]
        counts[curr, nxt] += 1

# Add-1 smoothing and normalize to get probabilities
probs = (counts + 0.1) / (counts + 0.1).sum(axis=1, keepdims=True)

print("=== Learned Bigram Probabilities ===")
print("(showing top-3 next tokens for each word)\\n")
for w in ['the', 'cat', 'sat', 'dog', 'a']:
    i = word2id[w]
    top3 = np.argsort(probs[i])[::-1][:3]
    tops = [(vocab[j], probs[i, j]) for j in top3]
    print(f"  After '{w}': {', '.join(f'{t}({p:.3f})' for t, p in tops)}")

# Compute perplexity on held-out text
test = "the cat sat on the mat".split()
print(f"\\n=== Perplexity on: '{' '.join(test)}' ===\\n")

log_prob_sum = 0
for i in range(len(test) - 1):
    curr_id = word2id[test[i]]
    next_id = word2id[test[i + 1]]
    p = probs[curr_id, next_id]
    lp = np.log(p)
    log_prob_sum += lp
    print(f"  P({test[i+1]:>6} | {test[i]:>6}) = {p:.4f}  "
          f"(-log P = {-lp:.3f})")

n = len(test) - 1
avg_nll = -log_prob_sum / n
perplexity = np.exp(avg_nll)
print(f"\\nAverage negative log-likelihood: {avg_nll:.4f}")
print(f"Perplexity: {perplexity:.2f}")
print(f"\\nInterpretation: the model is as confused as choosing")
print(f"among ~{perplexity:.0f} tokens uniformly at each step.")
print(f"(Perfect would be 1.0, random would be {V})")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Python: Autoregressive Generation with Temperature    */
/* ================================================================== */
function PythonGenerationSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Autoregressive Generation with Temperature</h2>
      <p className="text-gray-300 leading-relaxed">
        Temperature is a hyperparameter that controls the randomness of generation. Before applying
        softmax, the logits are divided by the temperature value. Temperature = 1.0 is standard
        sampling. Lower temperatures (e.g., 0.3) make the distribution sharper, so the model almost
        always picks the highest-probability token. Higher temperatures (e.g., 2.0) flatten the
        distribution, making rare tokens more likely and output more diverse (but potentially
        less coherent).
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def softmax(logits, temperature=1.0):
    """Softmax with temperature scaling."""
    scaled = logits / max(temperature, 1e-8)
    e = np.exp(scaled - scaled.max())
    return e / e.sum()

# Build a simple bigram model for generation
corpus = """the cat sat on the mat and purred softly
the dog ran in the park and played happily
the bird sang in the tree and flew away
a cat sat on the warm rug and slept
a dog sat by the door and waited patiently
the cat ate the fish and licked its paws
the dog ate the bone and wagged its tail""".strip().split('\\n')

sentences = [s.split() for s in corpus]
vocab = sorted(set(w for s in sentences for w in s))
word2id = {w: i for i, w in enumerate(vocab)}
id2word = {i: w for w, i in word2id.items()}
V = len(vocab)

# Learn bigram log-probabilities (as "logits")
counts = np.zeros((V, V))
for sent in sentences:
    for i in range(len(sent) - 1):
        counts[word2id[sent[i]], word2id[sent[i+1]]] += 1
# Use log-counts as logits (plus small smoothing)
logits_table = np.log(counts + 0.01)

def generate(start_word, max_tokens=12, temperature=1.0, seed=None):
    """Generate text autoregressively with temperature sampling."""
    if seed is not None:
        np.random.seed(seed)
    tokens = [start_word]
    curr_id = word2id[start_word]

    for _ in range(max_tokens):
        logits = logits_table[curr_id]
        probs = softmax(logits, temperature)
        next_id = np.random.choice(V, p=probs)
        tokens.append(id2word[next_id])
        curr_id = next_id

    return ' '.join(tokens)

# Generate at different temperatures
print("=== Temperature Effects on Generation ===\\n")
temperatures = [0.1, 0.5, 1.0, 1.5, 2.0]
for temp in temperatures:
    print(f"Temperature = {temp}:")
    for trial in range(3):
        text = generate('the', max_tokens=10, temperature=temp, seed=trial+int(temp*100))
        print(f"  {text}")
    print()

# Show probability distributions at different temperatures
print("=== Probability Distribution for P(next | 'the') ===\\n")
logits = logits_table[word2id['the']]
print(f"{'Token':>10} | {'T=0.1':>8} | {'T=0.5':>8} | {'T=1.0':>8} | {'T=2.0':>8}")
print("-" * 52)

# Sort by T=1.0 probability for display
probs_1 = softmax(logits, 1.0)
top_indices = np.argsort(probs_1)[::-1][:8]

for idx in top_indices:
    word = id2word[idx]
    p01 = softmax(logits, 0.1)[idx]
    p05 = softmax(logits, 0.5)[idx]
    p10 = softmax(logits, 1.0)[idx]
    p20 = softmax(logits, 2.0)[idx]
    print(f"{word:>10} | {p01:>8.4f} | {p05:>8.4f} | {p10:>8.4f} | {p20:>8.4f}")

print()
print("Low temperature -> peaked distribution (greedy, repetitive)")
print("High temperature -> flat distribution (creative, chaotic)")
print("Temperature 1.0 -> standard sampling (balanced)")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Pretraining() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Language Model Pretraining</h1>
        <p className="text-lg text-gray-400">
          How language models learn from raw text: autoregressive generation, causal masking,
          the next-token prediction objective, perplexity, scaling laws, and the data that makes
          it all work. This is how GPT, Claude, and every modern LLM gets its initial capabilities.
        </p>
      </header>

      <WhatIsLMSection />
      <AutoregressiveSection />
      <CausalMaskingSection />
      <TrainingObjectiveSection />
      <PerplexitySection />
      <ScalingLawsSection />
      <PretrainingDataSection />
      <PythonBigramSection />
      <PythonGenerationSection />
    </div>
  )
}
