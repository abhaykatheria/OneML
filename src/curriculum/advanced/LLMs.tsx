import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'advanced/llms',
  title: 'Large Language Models',
  description: 'Explore how LLMs work: tokenization, next-token prediction, scaling laws, temperature sampling, in-context learning, and alignment',
  track: 'advanced',
  order: 5,
  tags: ['llm', 'language-model', 'tokenization', 'bpe', 'scaling-laws', 'temperature', 'rlhf', 'alignment'],
}

/* ================================================================== */
/*  Section 1 -- What is a Language Model?                             */
/* ================================================================== */
function LanguageModelSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let currentTokenIdx = 0
    let lastAdvance = 0

    const sentence = ['The', 'cat', 'sat', 'on', 'the', 'warm', 'sunny', 'windowsill']
    const candidatesPerStep: { word: string; prob: number }[][] = [
      [{ word: 'The', prob: 0.15 }, { word: 'A', prob: 0.12 }, { word: 'In', prob: 0.08 }, { word: 'On', prob: 0.06 }, { word: 'It', prob: 0.05 }],
      [{ word: 'cat', prob: 0.18 }, { word: 'dog', prob: 0.12 }, { word: 'old', prob: 0.08 }, { word: 'big', prob: 0.07 }, { word: 'red', prob: 0.05 }],
      [{ word: 'sat', prob: 0.22 }, { word: 'slept', prob: 0.14 }, { word: 'was', prob: 0.10 }, { word: 'lay', prob: 0.08 }, { word: 'ran', prob: 0.05 }],
      [{ word: 'on', prob: 0.25 }, { word: 'in', prob: 0.15 }, { word: 'by', prob: 0.10 }, { word: 'near', prob: 0.08 }, { word: 'under', prob: 0.04 }],
      [{ word: 'the', prob: 0.35 }, { word: 'a', prob: 0.20 }, { word: 'my', prob: 0.08 }, { word: 'his', prob: 0.05 }, { word: 'her', prob: 0.04 }],
      [{ word: 'warm', prob: 0.12 }, { word: 'soft', prob: 0.10 }, { word: 'old', prob: 0.08 }, { word: 'big', prob: 0.07 }, { word: 'red', prob: 0.06 }],
      [{ word: 'sunny', prob: 0.10 }, { word: 'wooden', prob: 0.08 }, { word: 'kitchen', prob: 0.07 }, { word: 'cozy', prob: 0.06 }, { word: 'bright', prob: 0.05 }],
      [{ word: 'windowsill', prob: 0.15 }, { word: 'day', prob: 0.12 }, { word: 'afternoon', prob: 0.10 }, { word: 'spot', prob: 0.08 }, { word: 'corner', prob: 0.06 }],
    ]

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      // Advance token every 2 seconds
      if (t - lastAdvance > 2.0) {
        currentTokenIdx = (currentTokenIdx + 1) % sentence.length
        lastAdvance = t
      }

      const tokensShown = currentTokenIdx + 1

      // Draw the generated sentence so far
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Next-Token Prediction', 20, 10)

      // Sentence display
      let xPos = 30
      const sentY = 50
      p.textSize(16)
      for (let i = 0; i < tokensShown; i++) {
        const isLatest = i === currentTokenIdx
        if (isLatest) {
          // Flash the newest token
          const flash = Math.sin(t * 8) * 0.5 + 0.5
          p.fill(80 + flash * 175, 220, 80 + flash * 100)
        } else {
          p.fill(200)
        }
        p.textAlign(p.LEFT, p.TOP)
        p.text(sentence[i], xPos, sentY)
        xPos += p.textWidth(sentence[i]) + 10
      }

      // Cursor blink
      if (Math.sin(t * 6) > 0) {
        p.fill(255, 220, 60)
        p.rect(xPos, sentY, 2, 20)
      }

      // Draw probability bars for current step's candidates
      const candidates = candidatesPerStep[currentTokenIdx]
      const barAreaY = 120
      const barH = 30
      const barGap = 8
      const maxBarW = p.width * 0.5

      p.fill(160)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Predicting token ${currentTokenIdx + 1}: P(next | "${sentence.slice(0, currentTokenIdx).join(' ')}${currentTokenIdx > 0 ? ' ...' : '...'}")`, 30, barAreaY - 25)

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i]
        const by = barAreaY + i * (barH + barGap)
        const barW = c.prob * maxBarW / 0.4 // Scale to make bars visible

        const isChosen = c.word === sentence[currentTokenIdx]

        // Bar
        if (isChosen) {
          const pulse = Math.sin(t * 4) * 0.15 + 0.85
          p.fill(80 * pulse, 200 * pulse, 80 * pulse)
        } else {
          p.fill(80, 80, 140)
        }
        p.noStroke()
        p.rect(120, by, barW, barH, 4)

        // Label
        p.fill(isChosen ? 255 : 180)
        p.textSize(13)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(c.word, 110, by + barH / 2)

        // Probability
        p.fill(isChosen ? 255 : 140)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${(c.prob * 100).toFixed(1)}%`, 125 + barW, by + barH / 2)

        if (isChosen) {
          p.fill(80, 200, 80)
          p.textSize(10)
          p.text(' <-- chosen', 165 + barW, by + barH / 2)
        }
      }

      // Explanation
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('A language model assigns probabilities to every possible next token, then samples one.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">What is a Language Model?</h2>
      <p className="text-gray-300 leading-relaxed">
        At its core, a language model does one thing: given a sequence of tokens (words, subwords, or
        characters), it predicts a probability distribution over what comes next. "The cat sat on
        the" might give high probability to "mat", "floor", and "couch", and low probability to
        "bicycle" or "democracy". Generation works by sampling from this distribution, appending the
        chosen token, and repeating.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This simple objective -- predict the next token -- turns out to be extraordinarily powerful
        when combined with massive scale. To predict well, the model must learn grammar, facts,
        reasoning patterns, and even something resembling common sense. A model that can predict
        "The capital of France is <strong className="text-white">Paris</strong>" must have encoded
        geographic knowledge. One that can predict the next step in a proof must have learned
        something about logic. Watch below as a sentence is generated token by token.
      </p>
      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Tokenization                                          */
/* ================================================================== */
function TokenizationSection() {
  const [inputText, setInputText] = useState('Hello world! Tokenization is interesting.')
  const inputRef = useRef(inputText)
  inputRef.current = inputText

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)
      const text = inputRef.current

      // Simple BPE-like tokenization simulation
      // Split into common subwords
      const tokenize = (s: string): { text: string; id: number }[] => {
        const tokens: { text: string; id: number }[] = []
        let i = 0
        // Common "merged" tokens (simulating BPE)
        const merges: { [key: string]: number } = {
          'the': 100, 'The': 101, 'ing': 102, 'tion': 103, 'ment': 104,
          'Hello': 105, 'world': 106, 'is': 107, 'Token': 108, 'iza': 109,
          'inter': 110, 'est': 111, 'are': 113, 'not': 114,
          'pre': 115, 'un': 116, 'able': 117, 'ly': 118, 'er': 119,
          'ed': 120, 'al': 121, 'en': 122, 'it': 123, 'an': 124,
          'or': 125, 'at': 126, 'on': 127, 'st': 128, 'in': 129,
        }

        while (i < s.length) {
          // Skip spaces -- make them their own token
          if (s[i] === ' ') {
            tokens.push({ text: ' ', id: 32 })
            i++
            continue
          }

          // Try longest match
          let matched = false
          for (let len = Math.min(6, s.length - i); len >= 2; len--) {
            const sub = s.slice(i, i + len)
            if (merges[sub] !== undefined) {
              tokens.push({ text: sub, id: merges[sub] })
              i += len
              matched = true
              break
            }
          }
          if (!matched) {
            // Single character fallback
            tokens.push({ text: s[i], id: s.charCodeAt(i) })
            i++
          }
        }
        return tokens
      }

      const tokens = tokenize(text)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('BPE Tokenization', 20, 10)

      // Show original text
      p.fill(160)
      p.textSize(12)
      p.text('Input text:', 20, 40)
      p.fill(220)
      p.textSize(14)
      const displayText = text.length > 60 ? text.slice(0, 60) + '...' : text
      p.text(`"${displayText}"`, 20, 58)

      // Token visualization
      p.fill(160)
      p.textSize(12)
      p.text(`Tokens (${tokens.length} total):`, 20, 95)

      const colors: [number, number, number][] = [
        [80, 140, 200], [200, 120, 80], [80, 200, 120], [200, 180, 60],
        [180, 80, 200], [200, 80, 140], [80, 200, 200], [140, 200, 80],
      ]

      let tx = 20
      let ty = 120
      const tokenH = 36
      const maxWidth = p.width - 40

      for (let i = 0; i < tokens.length && i < 40; i++) {
        const tok = tokens[i]
        const displayTok = tok.text === ' ' ? '\u2423' : tok.text
        p.textSize(13)
        const tw = p.textWidth(displayTok) + 20

        if (tx + tw > maxWidth) {
          tx = 20
          ty += tokenH + 8
        }

        const c = colors[i % colors.length]
        p.fill(c[0], c[1], c[2], 50)
        p.stroke(c[0], c[1], c[2])
        p.strokeWeight(1.5)
        p.rect(tx, ty, tw, tokenH, 6)

        // Token text
        p.fill(c[0] + 60, c[1] + 60, c[2] + 60)
        p.noStroke()
        p.textSize(13)
        p.textAlign(p.CENTER, p.TOP)
        p.text(displayTok, tx + tw / 2, ty + 3)

        // Token ID
        p.fill(c[0], c[1], c[2], 180)
        p.textSize(9)
        p.text(`id:${tok.id}`, tx + tw / 2, ty + 20)

        tx += tw + 6
      }

      // BPE explanation
      const bpeY = Math.min(ty + tokenH + 30, p.height - 90)
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('BPE Merge Examples:', 20, bpeY)

      const mergeExamples = [
        { from: 't + o + k + e + n', to: 'Token', saves: '4 tokens -> 1' },
        { from: 'i + n + g', to: 'ing', saves: '3 -> 1' },
        { from: 't + i + o + n', to: 'tion', saves: '4 -> 1' },
      ]

      for (let i = 0; i < mergeExamples.length; i++) {
        const ex = mergeExamples[i]
        const ey = bpeY + 22 + i * 18
        p.fill(160)
        p.textSize(11)
        p.text(`  ${ex.from}  \u2192  "${ex.to}"  (${ex.saves})`, 20, ey)
      }

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('BPE starts with characters and iteratively merges the most frequent pairs.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Tokenization</h2>
      <p className="text-gray-300 leading-relaxed">
        Language models do not see raw text. The text must first be converted into a sequence of
        integers (token IDs) that index into a vocabulary. Modern LLMs use <strong className="text-white">
        Byte Pair Encoding (BPE)</strong> or similar subword tokenization. The idea: start with
        individual characters, then iteratively merge the most frequent adjacent pairs into new
        tokens. After enough merges, common words like "the" become single tokens, while rare
        words get split into subword pieces.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This approach handles any text -- even misspellings or code -- because it can always fall
        back to individual characters. A typical LLM vocabulary has 30,000-100,000 tokens. The
        visualization below shows a simplified BPE tokenizer splitting text into subword tokens,
        each with a numeric ID. Try editing the text to see how different words get tokenized.
      </p>

      <div className="mb-2">
        <label className="block text-sm text-gray-400 mb-1">Type text to tokenize:</label>
        <input
          type="text"
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); inputRef.current = e.target.value }}
          className="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
          maxLength={80}
        />
      </div>

      <P5Sketch sketch={sketch} height={420} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Scaling Laws                                          */
/* ================================================================== */
function ScalingLawsSection() {
  const sketch = useCallback((p: p5) => {
    let hoverIdx = -1

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 650), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)

      const margin = { left: 80, right: 40, top: 50, bottom: 60 }
      const plotW = p.width - margin.left - margin.right
      const plotH = p.height - margin.top - margin.bottom

      // Data points: (params in billions, loss)
      const models: { name: string; params: number; loss: number; year: number; color: [number, number, number] }[] = [
        { name: 'GPT-1', params: 0.117, loss: 3.3, year: 2018, color: [100, 160, 220] },
        { name: 'BERT-L', params: 0.34, loss: 3.0, year: 2018, color: [80, 180, 180] },
        { name: 'GPT-2', params: 1.5, loss: 2.5, year: 2019, color: [120, 200, 100] },
        { name: 'T5-11B', params: 11, loss: 2.0, year: 2019, color: [200, 200, 80] },
        { name: 'GPT-3', params: 175, loss: 1.6, year: 2020, color: [200, 140, 80] },
        { name: 'PaLM', params: 540, loss: 1.35, year: 2022, color: [220, 100, 100] },
        { name: 'GPT-4*', params: 1800, loss: 1.1, year: 2023, color: [200, 80, 200] },
        { name: 'Claude 3*', params: 2000, loss: 1.05, year: 2024, color: [180, 100, 220] },
      ]

      // Log scale mapping
      const logMinP = Math.log10(0.05)
      const logMaxP = Math.log10(5000)
      const lossMin = 0.8
      const lossMax = 3.8

      const toScreenX = (params: number) => margin.left + ((Math.log10(params) - logMinP) / (logMaxP - logMinP)) * plotW
      const toScreenY = (loss: number) => margin.top + ((loss - lossMax) / (lossMin - lossMax)) * plotH

      // Grid lines
      p.stroke(35)
      p.strokeWeight(0.5)
      for (const lp of [-1, 0, 1, 2, 3]) {
        const x = toScreenX(Math.pow(10, lp))
        p.line(x, margin.top, x, margin.top + plotH)
      }
      for (const l of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
        const y = toScreenY(l)
        p.line(margin.left, y, margin.left + plotW, y)
      }

      // Axes
      p.stroke(80)
      p.strokeWeight(1)
      p.line(margin.left, margin.top, margin.left, margin.top + plotH)
      p.line(margin.left, margin.top + plotH, margin.left + plotW, margin.top + plotH)

      // Axis labels
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Parameters (billions, log scale)', margin.left + plotW / 2, p.height - 20)
      for (const lp of [-1, 0, 1, 2, 3]) {
        const x = toScreenX(Math.pow(10, lp))
        const label = lp < 0 ? '0.1B' : lp === 0 ? '1B' : lp === 1 ? '10B' : lp === 2 ? '100B' : '1T'
        p.text(label, x, margin.top + plotH + 8)
      }

      p.textAlign(p.RIGHT, p.CENTER)
      for (const l of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
        p.text(l.toFixed(1), margin.left - 8, toScreenY(l))
      }

      // Y-axis label (rotated via manual positioning)
      p.fill(160)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.push()
      p.translate(20, margin.top + plotH / 2)
      p.rotate(-p.HALF_PI)
      p.text('Test Loss', 0, 0)
      p.pop()

      // Draw the scaling law curve (power law fit)
      p.stroke(80, 80, 160)
      p.strokeWeight(1.5)
      p.noFill()
      p.beginShape()
      for (let lp = logMinP; lp <= logMaxP; lp += 0.05) {
        const params = Math.pow(10, lp)
        // Approximate scaling law: L ~ C * N^(-alpha)
        const loss = 4.5 * Math.pow(params, -0.08)
        if (loss > lossMin && loss < lossMax) {
          p.vertex(toScreenX(params), toScreenY(loss))
        }
      }
      p.endShape()

      // Check hover
      hoverIdx = -1
      for (let i = 0; i < models.length; i++) {
        const m = models[i]
        const sx = toScreenX(m.params)
        const sy = toScreenY(m.loss)
        if (p.dist(p.mouseX, p.mouseY, sx, sy) < 15) {
          hoverIdx = i
        }
      }

      // Draw data points
      for (let i = 0; i < models.length; i++) {
        const m = models[i]
        const sx = toScreenX(m.params)
        const sy = toScreenY(m.loss)
        const isHover = i === hoverIdx

        p.fill(m.color[0], m.color[1], m.color[2])
        p.stroke(m.color[0] + 40, m.color[1] + 40, m.color[2] + 40)
        p.strokeWeight(isHover ? 3 : 1.5)
        p.ellipse(sx, sy, isHover ? 16 : 12, isHover ? 16 : 12)

        // Label
        p.fill(m.color[0], m.color[1], m.color[2])
        p.noStroke()
        p.textSize(isHover ? 11 : 9)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(m.name, sx, sy - 10)
      }

      // Hover tooltip
      if (hoverIdx >= 0) {
        const m = models[hoverIdx]
        const tx = Math.min(p.mouseX + 15, p.width - 160)
        const ty = Math.max(p.mouseY - 50, 10)
        p.fill(30, 30, 50, 240)
        p.stroke(100)
        p.strokeWeight(1)
        p.rect(tx, ty, 150, 55, 6)
        p.fill(255)
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(m.name, tx + 8, ty + 6)
        p.fill(180)
        p.textSize(10)
        p.text(`${m.params >= 1 ? m.params + 'B' : (m.params * 1000).toFixed(0) + 'M'} params`, tx + 8, ty + 22)
        p.text(`Loss: ${m.loss.toFixed(2)} (${m.year})`, tx + 8, ty + 36)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Scaling Laws: More Parameters = Lower Loss', 20, 10)

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('* Estimated parameters. Hover over points for details. Blue line = power-law fit.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Scaling Laws</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most important discoveries in modern AI is that language model performance follows
        remarkably predictable <strong className="text-white">scaling laws</strong>. On a log-log
        plot, test loss decreases as a smooth power law of model size, dataset size, and compute.
        Double the parameters and you get a predictable improvement. This relationship holds over
        many orders of magnitude.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The Chinchilla scaling laws (Hoffmann et al., 2022) showed that for a fixed compute budget,
        you should scale model size and training data equally. Earlier models like GPT-3 were
        "undertrained" -- they were large but saw too little data. This insight led to models like
        LLaMA that are smaller but trained on much more data, achieving similar performance at
        lower inference cost. Hover over the points below to see details.
      </p>
      <P5Sketch sketch={sketch} height={420} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Temperature & Sampling                                */
/* ================================================================== */
function TemperatureSection() {
  const [temperature, setTemperature] = useState(0.7)
  const tempRef = useRef(temperature)
  tempRef.current = temperature

  const sketch = useCallback((p: p5) => {
    let t = 0

    // Base logits for candidate tokens
    const tokens = ['Paris', 'London', 'Berlin', 'Tokyo', 'Rome', 'Madrid', 'Vienna', 'Other']
    const logits = [3.5, 2.1, 1.8, 1.5, 1.2, 0.8, 0.5, -0.5]

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 650), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      const temp = tempRef.current
      p.background(15, 15, 25)

      // Apply temperature to logits and compute softmax
      const scaledLogits = logits.map(l => l / Math.max(temp, 0.01))
      const maxL = Math.max(...scaledLogits)
      const exps = scaledLogits.map(l => Math.exp(l - maxL))
      const sumExp = exps.reduce((a, b) => a + b, 0)
      const probs = exps.map(e => e / sumExp)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Prompt: "The capital of France is ___"    Temperature = ${temp.toFixed(2)}`, 20, 10)

      // Temperature description
      p.fill(160)
      p.textSize(11)
      const desc = temp < 0.3
        ? 'Very low: nearly deterministic, always picks the top token'
        : temp < 0.6
          ? 'Low: mostly picks top tokens, occasional variety'
          : temp < 1.0
            ? 'Medium: balanced between quality and diversity'
            : temp < 1.3
              ? 'High: more random, creative but sometimes off-topic'
              : 'Very high: nearly uniform, chaotic output'
      p.text(desc, 20, 32)

      // Draw probability bars
      const barAreaX = 100
      const barAreaY = 65
      const barH = 32
      const barGap = 6
      const maxBarW = p.width - barAreaX - 100

      for (let i = 0; i < tokens.length; i++) {
        const by = barAreaY + i * (barH + barGap)
        const prob = probs[i]
        const barW = prob * maxBarW

        // Color: hotter for higher probability
        const heatR = 60 + prob * 200
        const heatG = 60 + (1 - prob) * 100
        const heatB = 200 - prob * 150

        // Animate slightly
        const animW = barW + Math.sin(t * 3 + i) * 2 * temp

        p.fill(heatR, heatG, heatB)
        p.noStroke()
        p.rect(barAreaX, by, Math.max(0, animW), barH, 4)

        // Token label
        p.fill(220)
        p.textSize(12)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(tokens[i], barAreaX - 8, by + barH / 2)

        // Probability value
        p.fill(180)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${(prob * 100).toFixed(1)}%`, barAreaX + Math.max(0, animW) + 8, by + barH / 2)
      }

      // Draw the probability distribution shape on the right
      const distX = p.width - 120
      const distY = barAreaY + 40
      const distH = 200

      p.fill(180)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Distribution', distX, distY - 5)

      // Vertical bar chart view of the distribution
      const miniBarW = 10
      const miniGap = 3
      const miniStartX = distX - (tokens.length * (miniBarW + miniGap)) / 2

      for (let i = 0; i < tokens.length; i++) {
        const bx = miniStartX + i * (miniBarW + miniGap)
        const bh = probs[i] * distH

        const heatR = 60 + probs[i] * 200
        const heatG = 60 + (1 - probs[i]) * 100
        const heatB = 200 - probs[i] * 150

        p.fill(heatR, heatG, heatB)
        p.noStroke()
        p.rect(bx, distY + distH - bh, miniBarW, bh, 2)
      }

      // Entropy indicator
      const entropy = -probs.reduce((sum, pr) => sum + (pr > 1e-10 ? pr * Math.log2(pr) : 0), 0)
      const maxEntropy = Math.log2(tokens.length)
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`Entropy: ${entropy.toFixed(2)} / ${maxEntropy.toFixed(2)}`, distX, distY + distH + 10)

      // Explanation
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Temperature divides logits before softmax: P = softmax(logits / T)', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Temperature and Sampling</h2>
      <p className="text-gray-300 leading-relaxed">
        The model outputs raw scores (<strong className="text-white">logits</strong>) for each token,
        which are converted to probabilities via softmax. <strong className="text-white">Temperature
        </strong> is a parameter that controls the sharpness of this distribution. It divides the
        logits before applying softmax: <code className="text-emerald-400">P = softmax(logits / T)</code>.
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">T close to 0</strong>: the distribution collapses to a spike on the most likely token. Deterministic, repetitive output.</li>
        <li><strong className="text-white">T = 1.0</strong>: the original distribution as the model learned it.</li>
        <li><strong className="text-white">T &gt; 1.0</strong>: the distribution flattens, giving low-probability tokens a higher chance. More random, more "creative", but also more errors.</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        In practice, other sampling strategies like <strong className="text-white">top-k</strong>
        (only consider the k most likely tokens) and <strong className="text-white">top-p / nucleus
        sampling</strong> (consider tokens until cumulative probability reaches p) are combined
        with temperature. Adjust the temperature slider below to see its effect on the distribution.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Sampling">
            <InteractiveSlider
              label="Temperature"
              min={0.05}
              max={2.0}
              step={0.05}
              value={temperature}
              onChange={(v) => { setTemperature(v); tempRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Context Window & Attention                            */
/* ================================================================== */
function ContextSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Context Window and Attention</h2>
      <p className="text-gray-300 leading-relaxed">
        When a language model predicts the next token, it can "see" a fixed number of previous
        tokens -- this is the <strong className="text-white">context window</strong>. Early GPT
        models had a 2,048-token window. GPT-4 extended this to 128K tokens. Claude supports up to
        200K tokens of context. The entire prompt, conversation history, and any documents you
        paste in must fit within this window.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The mechanism that lets the model "remember" earlier tokens is <strong className="text-white">
        self-attention</strong>, which we covered in the Transformer lesson. Each token computes
        attention weights over all previous tokens (using causal masking so it cannot see the
        future), producing a weighted mix of their representations. This is how the model
        resolves pronouns ("she" refers to whom?), tracks logical arguments, and maintains
        coherence over long passages.
      </p>
      <p className="text-gray-300 leading-relaxed">
        A key challenge is that standard self-attention scales as O(n^2) with sequence length,
        making very long contexts expensive. Techniques like <strong className="text-white">
        rotary positional embeddings (RoPE)</strong>, <strong className="text-white">FlashAttention
        </strong> (more efficient GPU kernels), <strong className="text-white">sparse attention
        </strong>, and <strong className="text-white">sliding window attention</strong> help manage
        this cost. Some architectures like Mamba replace attention entirely with state-space models
        that scale linearly in sequence length.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="text-white font-semibold mb-2">Context Window Sizes</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li><strong className="text-gray-300">GPT-2 (2019):</strong> 1,024 tokens</li>
            <li><strong className="text-gray-300">GPT-3 (2020):</strong> 2,048 tokens</li>
            <li><strong className="text-gray-300">GPT-4 (2023):</strong> 8K / 128K tokens</li>
            <li><strong className="text-gray-300">Claude 3 (2024):</strong> 200K tokens</li>
            <li><strong className="text-gray-300">Gemini 1.5 (2024):</strong> 1M tokens</li>
          </ul>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="text-white font-semibold mb-2">Attention Optimizations</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li><strong className="text-gray-300">FlashAttention:</strong> memory-efficient GPU kernels</li>
            <li><strong className="text-gray-300">RoPE:</strong> relative position encoding that extrapolates</li>
            <li><strong className="text-gray-300">KV Cache:</strong> reuse key/value from previous tokens</li>
            <li><strong className="text-gray-300">Grouped Query Attention:</strong> share KV heads</li>
            <li><strong className="text-gray-300">Ring Attention:</strong> distribute across devices</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Prompting & In-Context Learning                       */
/* ================================================================== */
function PromptingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Prompting and In-Context Learning</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most remarkable capabilities of large language models is <strong className="text-white">
        in-context learning</strong>: the ability to learn new tasks at inference time, just from
        examples provided in the prompt. No gradient updates, no fine-tuning -- the model reads
        the examples and generalizes. This phenomenon emerges at scale and is still not fully understood.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Zero-Shot</h3>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm">
        <p className="text-gray-400">Prompt:</p>
        <p className="text-emerald-400 mt-1">Classify the sentiment of this review as positive or negative:</p>
        <p className="text-emerald-400">"The food was incredible and the service was top notch!"</p>
        <p className="text-emerald-400">Sentiment:</p>
        <p className="text-yellow-300 mt-1">Positive</p>
      </div>
      <p className="text-gray-300 leading-relaxed">
        The model has never seen this specific task instruction during training, but it understands
        what is being asked because it has seen similar patterns in its training data.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Few-Shot</h3>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm">
        <p className="text-gray-400">Prompt:</p>
        <p className="text-emerald-400">"Happy" -&gt; positive</p>
        <p className="text-emerald-400">"Terrible" -&gt; negative</p>
        <p className="text-emerald-400">"Wonderful" -&gt; positive</p>
        <p className="text-emerald-400">"Awful food" -&gt;</p>
        <p className="text-yellow-300 mt-1">negative</p>
      </div>
      <p className="text-gray-300 leading-relaxed">
        Providing a few input-output examples lets the model infer the pattern. For many tasks,
        just 3-5 examples is sufficient. The model does not "learn" in the traditional sense --
        it pattern-matches within its context window.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Chain-of-Thought</h3>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 font-mono text-sm">
        <p className="text-gray-400">Prompt:</p>
        <p className="text-emerald-400">Q: If a store has 45 apples and sells 3/5 of them, how many remain?</p>
        <p className="text-emerald-400">Let's think step by step.</p>
        <p className="text-yellow-300 mt-1">Step 1: Calculate 3/5 of 45 = 27 apples sold.</p>
        <p className="text-yellow-300">Step 2: Remaining = 45 - 27 = 18 apples.</p>
        <p className="text-yellow-300">Answer: 18 apples remain.</p>
      </div>
      <p className="text-gray-300 leading-relaxed">
        Adding "let's think step by step" or providing examples with explicit reasoning dramatically
        improves performance on math, logic, and multi-step reasoning tasks. The intermediate tokens
        serve as a "scratchpad", allowing the model to break complex problems into manageable steps.
        Each step's output provides context for the next step through the attention mechanism.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Alignment: RLHF & Instruction Tuning                 */
/* ================================================================== */
function AlignmentSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Alignment: Making Models Helpful and Safe</h2>
      <p className="text-gray-300 leading-relaxed">
        A raw language model trained purely on next-token prediction is not inherently helpful. It
        might continue your prompt in any direction -- mimicking toxic content from training data,
        generating fiction instead of answering questions, or confidently stating falsehoods.
        <strong className="text-white"> Alignment</strong> is the process of making the model
        behave in ways humans actually want: being helpful, honest, and harmless.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Stage 1: Supervised Fine-Tuning (SFT)</h3>
      <p className="text-gray-300 leading-relaxed">
        The base model is fine-tuned on a dataset of high-quality (prompt, response) pairs written
        by humans. This teaches the model the format of helpful responses -- how to answer
        questions, follow instructions, decline harmful requests, and acknowledge uncertainty.
        Thousands to tens of thousands of carefully curated examples can dramatically change the
        model's behavior.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Stage 2: RLHF (Reinforcement Learning from Human Feedback)</h3>
      <p className="text-gray-300 leading-relaxed">
        Humans compare pairs of model responses and indicate which is better. These preferences
        train a <strong className="text-white">reward model</strong> that predicts a scalar score
        for any response. The language model is then fine-tuned with reinforcement learning (typically
        PPO) to maximize this reward -- essentially learning to produce the kind of responses humans
        prefer. This process is remarkably effective at improving helpfulness, reducing toxicity,
        and decreasing hallucination.
      </p>

      <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        <h4 className="text-white font-semibold mb-3">The Alignment Pipeline</h4>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-sm">
          <div className="rounded bg-blue-900/50 border border-blue-700 px-4 py-2 text-blue-300 text-center">
            <div className="font-semibold">Pre-training</div>
            <div className="text-xs text-blue-400">Next-token prediction on trillions of tokens</div>
          </div>
          <div className="text-gray-500 text-lg">&rarr;</div>
          <div className="rounded bg-emerald-900/50 border border-emerald-700 px-4 py-2 text-emerald-300 text-center">
            <div className="font-semibold">SFT</div>
            <div className="text-xs text-emerald-400">Fine-tune on human-written examples</div>
          </div>
          <div className="text-gray-500 text-lg">&rarr;</div>
          <div className="rounded bg-purple-900/50 border border-purple-700 px-4 py-2 text-purple-300 text-center">
            <div className="font-semibold">RLHF / RLAIF</div>
            <div className="text-xs text-purple-400">Optimize for human preferences</div>
          </div>
          <div className="text-gray-500 text-lg">&rarr;</div>
          <div className="rounded bg-yellow-900/50 border border-yellow-700 px-4 py-2 text-yellow-300 text-center">
            <div className="font-semibold">Deployed Model</div>
            <div className="text-xs text-yellow-400">Helpful, harmless, honest</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6">Constitutional AI and RLAIF</h3>
      <p className="text-gray-300 leading-relaxed">
        An alternative to RLHF is <strong className="text-white">RLAIF (RL from AI Feedback)
        </strong>, used in Anthropic's Constitutional AI approach. Instead of relying entirely on
        human raters, the model critiques and revises its own responses according to a set of
        principles (a "constitution"). Another AI model then provides the preference signal. This
        scales better than human annotation while maintaining strong alignment properties.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Bigram Language Model                         */
/* ================================================================== */
function PythonBigramSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Bigram Language Model from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        The simplest language model: for each token, predict the next based only on the current
        token (no longer context). We count bigram frequencies from a corpus and normalize to get
        conditional probabilities. Despite its simplicity, this illustrates the core language
        modeling concept: learning P(next | context).
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(42)

# Training corpus
corpus = """the cat sat on the mat
the dog sat on the rug
the cat chased the dog
the dog chased the cat
a cat sat on a mat
a dog sat on a rug
the cat and the dog sat on the mat together"""

# Tokenize (simple word-level)
words = corpus.lower().split()
vocab = sorted(set(words))
word_to_id = {w: i for i, w in enumerate(vocab)}
id_to_word = {i: w for w, i in word_to_id.items()}
V = len(vocab)

print(f"Vocabulary ({V} tokens): {vocab}\\n")

# Build bigram count matrix
counts = np.zeros((V, V))
for i in range(len(words) - 1):
    curr = word_to_id[words[i]]
    nxt = word_to_id[words[i + 1]]
    counts[curr][nxt] += 1

# Normalize to probabilities (add smoothing)
probs = (counts + 0.1)  # Laplace smoothing
probs = probs / probs.sum(axis=1, keepdims=True)

# Show some bigram probabilities
print("=== Bigram Probabilities ===\\n")
for context in ['the', 'cat', 'sat', 'on', 'dog']:
    ctx_id = word_to_id[context]
    top_indices = np.argsort(-probs[ctx_id])[:5]
    print(f'P(next | "{context}"):')
    for idx in top_indices:
        if probs[ctx_id][idx] > 0.02:
            print(f'  {id_to_word[idx]:10s} {probs[ctx_id][idx]:.3f}')
    print()

# Generate text
def generate(start_word, length=10, temperature=1.0):
    tokens = [start_word]
    curr_id = word_to_id[start_word]
    for _ in range(length):
        # Apply temperature
        logits = np.log(probs[curr_id] + 1e-10) / temperature
        exp_logits = np.exp(logits - logits.max())
        p = exp_logits / exp_logits.sum()
        next_id = np.random.choice(V, p=p)
        tokens.append(id_to_word[next_id])
        curr_id = next_id
    return ' '.join(tokens)

print("=== Generated Sentences ===\\n")
for temp in [0.5, 1.0, 1.5]:
    text = generate('the', length=8, temperature=temp)
    print(f"T={temp}: {text}")

# Compute perplexity on the corpus
log_prob = 0
n = 0
for i in range(len(words) - 1):
    curr_id = word_to_id[words[i]]
    next_id = word_to_id[words[i + 1]]
    log_prob += np.log2(probs[curr_id][next_id])
    n += 1
perplexity = 2 ** (-log_prob / n)
print(f"\\nCorpus perplexity: {perplexity:.2f}")
print("(Lower = model assigns higher probability to the actual text)")`}
        title="Bigram Language Model"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Python: Temperature Sampling                          */
/* ================================================================== */
function PythonTemperatureSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Temperature Sampling</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement temperature sampling from scratch and see exactly how dividing logits
        by temperature reshapes the probability distribution. We will also implement top-k and
        top-p (nucleus) sampling.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(42)

def softmax(logits):
    e = np.exp(logits - logits.max())
    return e / e.sum()

# Simulated model output: logits for candidate next tokens
tokens = ['Paris', 'London', 'Berlin', 'Tokyo', 'Rome', 'Madrid', 'Vienna', 'Oslo']
logits = np.array([3.5, 2.1, 1.8, 1.5, 1.2, 0.8, 0.5, -0.5])

print("=== Temperature Sampling ===")
print(f"Raw logits: {logits}\\n")

print(f"{'Token':>10s} | T=0.1   T=0.5   T=1.0   T=1.5   T=2.0")
print("-" * 58)
for temp in [0.1, 0.5, 1.0, 1.5, 2.0]:
    probs = softmax(logits / temp)
    if temp == 0.1:  # First column
        for i, tok in enumerate(tokens):
            row = f"{tok:>10s} |"
            for t2 in [0.1, 0.5, 1.0, 1.5, 2.0]:
                p = softmax(logits / t2)[i]
                row += f" {p:6.3f}"
            print(row)
    break

# Entropy at each temperature
print("\\n=== Entropy (bits) ===")
for temp in [0.1, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0]:
    probs = softmax(logits / temp)
    entropy = -np.sum(probs * np.log2(probs + 1e-10))
    max_ent = np.log2(len(tokens))
    bar = '#' * int(entropy / max_ent * 30)
    print(f"  T={temp:4.1f}: {entropy:.3f} / {max_ent:.2f}  {bar}")

# Top-k sampling
def sample_top_k(logits, k, temperature=1.0):
    scaled = logits / temperature
    top_k_idx = np.argsort(-scaled)[:k]
    top_k_logits = scaled[top_k_idx]
    probs = softmax(top_k_logits)
    chosen = np.random.choice(top_k_idx, p=probs)
    return chosen

# Top-p (nucleus) sampling
def sample_top_p(logits, p_threshold, temperature=1.0):
    scaled = logits / temperature
    probs = softmax(scaled)
    sorted_idx = np.argsort(-probs)
    sorted_probs = probs[sorted_idx]
    cumulative = np.cumsum(sorted_probs)
    # Find cutoff
    cutoff = np.searchsorted(cumulative, p_threshold) + 1
    top_idx = sorted_idx[:cutoff]
    top_probs = probs[top_idx]
    top_probs = top_probs / top_probs.sum()  # renormalize
    chosen = np.random.choice(top_idx, p=top_probs)
    return chosen

print("\\n=== Sampling Strategies (1000 samples each) ===\\n")

for strategy, label in [
    (lambda: np.random.choice(len(logits), p=softmax(logits / 0.3)), "Temp=0.3"),
    (lambda: np.random.choice(len(logits), p=softmax(logits / 1.0)), "Temp=1.0"),
    (lambda: np.random.choice(len(logits), p=softmax(logits / 2.0)), "Temp=2.0"),
    (lambda: sample_top_k(logits, k=3, temperature=1.0), "Top-k=3, T=1"),
    (lambda: sample_top_p(logits, p_threshold=0.9, temperature=1.0), "Top-p=0.9, T=1"),
]:
    counts = np.zeros(len(tokens))
    for _ in range(1000):
        idx = strategy()
        counts[idx] += 1
    freqs = counts / 1000
    top3 = np.argsort(-freqs)[:3]
    result = ", ".join(f"{tokens[i]}:{freqs[i]:.2f}" for i in top3)
    print(f"  {label:18s} -> {result}")

print("\\nKey insight: temperature controls exploration vs exploitation.")
print("Top-k and top-p clip the tail to avoid unlikely tokens.")`}
        title="Temperature, Top-k, and Top-p Sampling"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function LLMs() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Large Language Models</h1>
        <p className="text-lg text-gray-400">
          How LLMs work from the ground up: tokenization, next-token prediction, scaling laws,
          temperature sampling, in-context learning, and the alignment techniques that make
          models helpful, harmless, and honest.
        </p>
      </header>

      <LanguageModelSection />
      <TokenizationSection />
      <ScalingLawsSection />
      <TemperatureSection />
      <ContextSection />
      <PromptingSection />
      <AlignmentSection />
      <PythonBigramSection />
      <PythonTemperatureSection />
    </div>
  )
}
