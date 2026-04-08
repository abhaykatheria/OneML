import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/tokenization',
  title: 'Tokenization Deep Dive',
  description: 'How text becomes numbers: character, word, and subword tokenization, BPE algorithm, vocabulary tradeoffs, and token embeddings',
  track: 'deep',
  order: 7,
  tags: ['tokenization', 'bpe', 'byte-pair-encoding', 'subword', 'vocabulary', 'embeddings', 'nlp'],
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Simple character-level tokenizer */
function tokenizeChars(text: string): string[] {
  return text.split('')
}

/** Simple whitespace word tokenizer */
function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** Simulated subword tokenizer using a greedy longest-match approach */
function tokenizeSubword(text: string, vocab: string[]): string[] {
  const sorted = [...vocab].sort((a, b) => b.length - a.length)
  const tokens: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    let matched = false
    for (const v of sorted) {
      if (remaining.startsWith(v)) {
        tokens.push(v)
        remaining = remaining.slice(v.length)
        matched = true
        break
      }
    }
    if (!matched) {
      tokens.push(remaining[0])
      remaining = remaining.slice(1)
    }
  }
  return tokens
}

const DEFAULT_SUBWORD_VOCAB = [
  'the', 'The', 'ing', 'tion', 'un', 'pre', 'able', 'er', 'ed', 'ly',
  'cat', 'sat', 'on', 'mat', 'to', 'ken', 'ize', 'is', 'at', 'ion',
  'in', 'qu', 'ick', 'br', 'own', 'fox', 'ju', 'mp', 'over', 'la',
  'zy', 'dog', 'he', 'she', 'we', 'it', 'an', 'and', 'or', 'of',
  'a', ' ', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '.', ',', '!', '?', "'", '"', '-', ':', ';', '(', ')', '0', '1', '2',
  '3', '4', '5', '6', '7', '8', '9',
]

/** BPE: find the most frequent adjacent pair in a list of token lists */
function findMostFrequentPair(corpus: string[][]): [string, string] | null {
  const counts = new Map<string, number>()
  for (const tokens of corpus) {
    for (let i = 0; i < tokens.length - 1; i++) {
      const key = tokens[i] + '|||' + tokens[i + 1]
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  let best: [string, string] | null = null
  let bestCount = 1 // only merge if count > 1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      const parts = key.split('|||')
      best = [parts[0], parts[1]]
    }
  }
  return best
}

/** BPE: merge a specific pair across the corpus */
function mergePair(corpus: string[][], pair: [string, string]): string[][] {
  return corpus.map((tokens) => {
    const result: string[] = []
    let i = 0
    while (i < tokens.length) {
      if (i < tokens.length - 1 && tokens[i] === pair[0] && tokens[i + 1] === pair[1]) {
        result.push(pair[0] + pair[1])
        i += 2
      } else {
        result.push(tokens[i])
        i++
      }
    }
    return result
  })
}

/* ================================================================== */
/*  Section 1 -- Why Tokenization Matters                              */
/* ================================================================== */
function WhyTokenizationSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Tokenization Matters</h2>
      <p className="text-gray-300 leading-relaxed">
        Neural networks cannot read text. They operate on numbers -- tensors of floating point values.
        Before any language model can process a sentence, that sentence must be converted into a
        sequence of integers, where each integer is a <strong className="text-white">token ID</strong>{' '}
        that indexes into a fixed vocabulary. This conversion is called{' '}
        <strong className="text-white">tokenization</strong>, and it is the very first step of every
        NLP pipeline.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Tokenization is also the <em>last</em> step: when a language model generates output, it
        produces token IDs that must be decoded back into human-readable text. The tokenizer sits at
        both ends of the pipeline, and its design has profound consequences for model behavior.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Bad tokenization leads to bad models. If the tokenizer splits a common word into too many
        pieces, the model wastes capacity reassembling it. If the vocabulary is too small, every
        sentence becomes a long sequence of tiny fragments, blowing up the context window. If the
        vocabulary is too large, the embedding matrix becomes enormous and rare tokens get poorly
        trained embeddings. The art of tokenization is finding the sweet spot.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The Transformer architecture you learned about in the previous lesson takes a sequence of
        token embeddings as input. The attention mechanism computes relationships between{' '}
        <em>tokens</em>, not characters or words. So the choice of tokenizer directly determines
        what the model's "atoms of meaning" are.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Character vs Word vs Subword                          */
/* ================================================================== */
function CompareTokenizersSection() {
  const [inputText, setInputText] = useState('The quick brown fox jumps over the lazy dog')
  const inputRef = useRef(inputText)
  inputRef.current = inputText

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const text = inputRef.current
      p.background(15, 15, 25)

      const charTokens = tokenizeChars(text)
      const wordTokens = tokenizeWords(text)
      const subwordTokens = tokenizeSubword(text, DEFAULT_SUBWORD_VOCAB)

      const methods: { name: string; tokens: string[]; color: [number, number, number]; desc: string }[] = [
        { name: 'Character', tokens: charTokens, color: [220, 80, 80], desc: 'Every character is a token' },
        { name: 'Word', tokens: wordTokens, color: [80, 180, 80], desc: 'Split on whitespace' },
        { name: 'Subword (BPE-like)', tokens: subwordTokens, color: [80, 140, 220], desc: 'Frequent substrings merge' },
      ]

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Three Tokenization Strategies', 20, 10)

      let yOffset = 40
      for (const method of methods) {
        // Method header
        p.fill(method.color[0], method.color[1], method.color[2])
        p.noStroke()
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${method.name} (${method.tokens.length} tokens)`, 20, yOffset)

        p.fill(120)
        p.textSize(10)
        p.text(method.desc, 300, yOffset + 2)

        yOffset += 22

        // Draw tokens as colored boxes
        let xPos = 20
        const maxX = p.width - 30
        p.textSize(10)
        for (let i = 0; i < method.tokens.length; i++) {
          const tok = method.tokens[i]
          const displayTok = tok === ' ' ? '\u2423' : tok
          const tw = p.textWidth(displayTok) + 10
          if (xPos + tw > maxX) {
            xPos = 20
            yOffset += 24
          }

          // Box
          p.fill(method.color[0] * 0.3, method.color[1] * 0.3, method.color[2] * 0.3)
          p.stroke(method.color[0] * 0.6, method.color[1] * 0.6, method.color[2] * 0.6)
          p.strokeWeight(1)
          p.rect(xPos, yOffset, tw, 20, 3)

          // Text
          p.fill(method.color[0], method.color[1], method.color[2])
          p.noStroke()
          p.textAlign(p.CENTER, p.CENTER)
          p.text(displayTok, xPos + tw / 2, yOffset + 10)

          xPos += tw + 3
        }

        yOffset += 36
      }

      // Summary
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(
        `Char: ${charTokens.length} tokens  |  Word: ${wordTokens.length} tokens  |  Subword: ${subwordTokens.length} tokens`,
        20,
        p.height - 8
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Character vs Word vs Subword Tokenization</h2>
      <p className="text-gray-300 leading-relaxed">
        There are three fundamental approaches to tokenization, each with distinct tradeoffs.{' '}
        <strong className="text-white">Character-level</strong> tokenization uses a tiny vocabulary
        (just 256 bytes or ~100 characters) but produces very long sequences -- a 500-word article
        might become 3000+ tokens, straining the context window.{' '}
        <strong className="text-white">Word-level</strong> tokenization produces short sequences but
        cannot handle unseen words, misspellings, or morphological variants ("running" vs "runner"
        share nothing).{' '}
        <strong className="text-white">Subword</strong> tokenization (used by virtually every modern
        LLM) finds the sweet spot: common words stay whole, rare words are split into meaningful
        pieces, and the vocabulary size is tunable.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Type a sentence below and see how all three strategies tokenize it. Notice how character
        tokenization always has the most tokens, word tokenization the fewest, and subword lands in
        between.
      </p>
      <div className="mb-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-200 text-sm font-mono focus:border-blue-500 focus:outline-none"
          placeholder="Type a sentence to tokenize..."
        />
      </div>
      <P5Sketch sketch={sketch} height={420} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- BPE Step by Step                                      */
/* ================================================================== */
function BPEStepByStepSection() {
  const exampleWords = ['low', 'lower', 'newest', 'widest', 'low', 'newest', 'low']
  const initialCorpus: string[][] = exampleWords.map((w) => w.split(''))

  const [mergeHistory, setMergeHistory] = useState<{
    corpus: string[][]
    pair: [string, string] | null
    vocab: string[]
    step: number
  }[]>([{
    corpus: initialCorpus,
    pair: null,
    vocab: [...new Set(initialCorpus.flat())].sort(),
    step: 0,
  }])

  const [currentStep, setCurrentStep] = useState(0)
  const stateRef = useRef({ mergeHistory, currentStep })
  stateRef.current = { mergeHistory, currentStep }

  const doNextMerge = () => {
    const history = stateRef.current.mergeHistory
    const latest = history[history.length - 1]
    const pair = findMostFrequentPair(latest.corpus)
    if (!pair) return // no more merges possible
    const newCorpus = mergePair(latest.corpus, pair)
    const newVocab = [...new Set(newCorpus.flat())].sort()
    const newEntry = {
      corpus: newCorpus,
      pair,
      vocab: newVocab,
      step: latest.step + 1,
    }
    const newHistory = [...history, newEntry]
    setMergeHistory(newHistory)
    setCurrentStep(newHistory.length - 1)
    stateRef.current.mergeHistory = newHistory
    stateRef.current.currentStep = newHistory.length - 1
  }

  const resetBPE = () => {
    const initial = [{
      corpus: initialCorpus,
      pair: null as [string, string] | null,
      vocab: [...new Set(initialCorpus.flat())].sort(),
      step: 0,
    }]
    setMergeHistory(initial)
    setCurrentStep(0)
    stateRef.current.mergeHistory = initial
    stateRef.current.currentStep = 0
  }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { mergeHistory: history, currentStep: cs } = stateRef.current
      const entry = history[Math.min(cs, history.length - 1)]
      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`BPE Step ${entry.step}: Vocabulary size = ${entry.vocab.length}`, 20, 10)

      // Merge info
      if (entry.pair) {
        p.fill(80, 220, 140)
        p.textSize(12)
        p.text(`Merged: "${entry.pair[0]}" + "${entry.pair[1]}" -> "${entry.pair[0] + entry.pair[1]}"`, 20, 32)
      } else {
        p.fill(160)
        p.textSize(12)
        p.text('Initial character-level tokenization', 20, 32)
      }

      // Display tokenized words
      p.fill(200)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Tokenized corpus:', 20, 60)

      let yOff = 82
      const totalTokens = entry.corpus.reduce((sum, word) => sum + word.length, 0)
      for (let w = 0; w < entry.corpus.length; w++) {
        const tokens = entry.corpus[w]
        let xPos = 40
        p.fill(120)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`"${exampleWords[w]}":`, 20, yOff + 10)
        xPos = 110

        for (const tok of tokens) {
          const tw = p.textWidth(tok) + 12
          // Highlight newly merged tokens
          const isNew = entry.pair && tok === entry.pair[0] + entry.pair[1]
          if (isNew) {
            p.fill(30, 80, 50)
            p.stroke(80, 220, 140)
          } else {
            p.fill(30, 40, 60)
            p.stroke(60, 100, 160)
          }
          p.strokeWeight(1)
          p.rect(xPos, yOff, tw, 22, 3)

          p.fill(isNew ? p.color(80, 220, 140) : p.color(140, 180, 220))
          p.noStroke()
          p.textSize(11)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(tok, xPos + tw / 2, yOff + 11)
          xPos += tw + 3
        }
        yOff += 30
      }

      // Total tokens count
      p.fill(200)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Total tokens: ${totalTokens}`, 20, yOff + 8)

      // Vocabulary display
      yOff += 32
      p.fill(200)
      p.textSize(12)
      p.text('Vocabulary:', 20, yOff)
      yOff += 20

      let vx = 20
      for (const v of entry.vocab) {
        const vw = p.textWidth(v) + 10
        if (vx + vw > p.width - 20) {
          vx = 20
          yOff += 22
        }
        const isMultiChar = v.length > 1
        p.fill(isMultiChar ? 40 : 25, isMultiChar ? 35 : 25, isMultiChar ? 55 : 40)
        p.stroke(isMultiChar ? 100 : 50, isMultiChar ? 80 : 50, isMultiChar ? 160 : 80)
        p.strokeWeight(1)
        p.rect(vx, yOff, vw, 18, 2)
        p.fill(isMultiChar ? p.color(160, 180, 255) : p.color(120))
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(v, vx + vw / 2, yOff + 9)
        vx += vw + 3
      }

      // Footer
      p.fill(140)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Each merge: vocab grows by 1, total token count shrinks', 20, p.height - 8)
    }
  }, [exampleWords])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Byte-Pair Encoding (BPE) Step by Step</h2>
      <p className="text-gray-300 leading-relaxed">
        Byte-Pair Encoding is the most widely used subword tokenization algorithm. GPT-2, GPT-3,
        GPT-4, and many other models use BPE or close variants. The idea is beautifully simple:
        start with a character-level vocabulary, then repeatedly merge the most frequent adjacent
        pair of tokens into a single new token.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The algorithm: (1) Initialize the vocabulary with all individual characters in the training
        data. (2) Count all adjacent token pairs across the corpus. (3) Merge the most frequent pair
        into a new token. (4) Repeat steps 2-3 until the desired vocabulary size is reached or no
        more merges are possible.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click "Next Merge" below to watch BPE in action on a small corpus. Notice how common
        substrings like "est" and "low" get merged first, and how the total token count decreases
        with each merge while the vocabulary grows by exactly one entry.
      </p>
      <div className="flex gap-3 mb-2">
        <button
          onClick={doNextMerge}
          className="px-4 py-1.5 rounded text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-600 transition-colors"
        >
          Next Merge
        </button>
        <button
          onClick={resetBPE}
          className="px-4 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        {currentStep > 0 && (
          <button
            onClick={() => {
              const prev = Math.max(0, currentStep - 1)
              setCurrentStep(prev)
              stateRef.current.currentStep = prev
            }}
            className="px-4 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Previous Step
          </button>
        )}
        <span className="text-gray-500 text-sm self-center">
          Step {currentStep} of {mergeHistory.length - 1}
        </span>
      </div>
      <P5Sketch sketch={sketch} height={440} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Vocabulary Size Tradeoff                              */
/* ================================================================== */
function VocabSizeTradeoffSection() {
  const [vocabSize, setVocabSize] = useState(32000)
  const vocabRef = useRef(vocabSize)
  vocabRef.current = vocabSize

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const vs = vocabRef.current
      p.background(15, 15, 25)

      const marginLeft = 70
      const marginBottom = 60
      const marginTop = 50
      const marginRight = 40
      const plotW = p.width - marginLeft - marginRight
      const plotH = p.height - marginTop - marginBottom

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Vocabulary Size Tradeoffs', 20, 10)

      // Axes
      p.stroke(80)
      p.strokeWeight(1)
      p.line(marginLeft, marginTop, marginLeft, marginTop + plotH)
      p.line(marginLeft, marginTop + plotH, marginLeft + plotW, marginTop + plotH)

      // X-axis label
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Vocabulary Size', marginLeft + plotW / 2, marginTop + plotH + 30)

      // X ticks
      const vocabTicks = [256, 1000, 4000, 16000, 32000, 64000, 128000, 256000]
      for (const vt of vocabTicks) {
        const x = marginLeft + (Math.log(vt) - Math.log(256)) / (Math.log(256000) - Math.log(256)) * plotW
        p.stroke(40)
        p.strokeWeight(1)
        p.line(x, marginTop, x, marginTop + plotH)
        p.fill(120)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        p.text(vt >= 1000 ? `${vt / 1000}K` : String(vt), x, marginTop + plotH + 4)
      }

      // Curves
      // Tokens per sentence (decreases with vocab size)
      const tokensPerSentence = (v: number) => 200 / Math.pow(v / 256, 0.35)
      // Embedding matrix size (increases with vocab size) -- in millions of params
      const embeddingSize = (v: number) => (v * 768) / 1e6

      // Draw tokens-per-sentence curve (left y-axis)
      p.stroke(80, 180, 255)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= 200; i++) {
        const logV = Math.log(256) + (i / 200) * (Math.log(256000) - Math.log(256))
        const v = Math.exp(logV)
        const x = marginLeft + (i / 200) * plotW
        const tps = tokensPerSentence(v)
        const y = marginTop + plotH - (tps / 200) * plotH
        p.vertex(x, Math.max(marginTop, y))
      }
      p.endShape()

      // Draw embedding size curve (right y-axis)
      p.stroke(255, 140, 60)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      const maxEmb = embeddingSize(256000)
      for (let i = 0; i <= 200; i++) {
        const logV = Math.log(256) + (i / 200) * (Math.log(256000) - Math.log(256))
        const v = Math.exp(logV)
        const x = marginLeft + (i / 200) * plotW
        const emb = embeddingSize(v)
        const y = marginTop + plotH - (emb / maxEmb) * plotH
        p.vertex(x, Math.max(marginTop, y))
      }
      p.endShape()

      // Current vocab size marker
      const vsX = marginLeft + (Math.log(vs) - Math.log(256)) / (Math.log(256000) - Math.log(256)) * plotW
      p.stroke(255, 255, 100, 150)
      p.strokeWeight(2)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([5, 5])
      p.line(vsX, marginTop, vsX, marginTop + plotH)
      ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

      const tpsNow = tokensPerSentence(vs)
      const embNow = embeddingSize(vs)

      // Marker dots
      const tpsY = marginTop + plotH - (tpsNow / 200) * plotH
      p.fill(80, 180, 255)
      p.noStroke()
      p.ellipse(vsX, Math.max(marginTop, tpsY), 10, 10)

      const embY = marginTop + plotH - (embNow / maxEmb) * plotH
      p.fill(255, 140, 60)
      p.noStroke()
      p.ellipse(vsX, Math.max(marginTop, embY), 10, 10)

      // Y-axis labels
      p.fill(80, 180, 255)
      p.textSize(10)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Tokens/Sentence', marginLeft - 6, marginTop + 10)

      p.fill(255, 140, 60)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Embedding Size (M params)', marginLeft + plotW + 4, marginTop + 10)

      // Current values display
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.BOTTOM)
      const vsLabel = vs >= 1000 ? `${(vs / 1000).toFixed(0)}K` : String(vs)
      p.text(`Vocab: ${vsLabel}`, 20, p.height - 32)
      p.fill(80, 180, 255)
      p.text(`~${tpsNow.toFixed(1)} tokens per avg sentence`, 20, p.height - 16)
      p.fill(255, 140, 60)
      p.text(`~${embNow.toFixed(1)}M embedding params (d=768)`, 250, p.height - 16)

      // Legend
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Smaller vocab = more tokens (longer context). Larger vocab = bigger model.', 20, p.height - 2)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Vocabulary Size Tradeoff</h2>
      <p className="text-gray-300 leading-relaxed">
        Choosing the vocabulary size is a critical design decision. A small vocabulary (like 256
        bytes for character-level) means every sentence becomes a very long sequence of tokens. Since
        Transformer self-attention is O(n^2) in sequence length, this is expensive and wastes the
        finite context window. A large vocabulary (say 256K tokens) means sentences are short, but
        the embedding matrix -- which maps each token ID to a dense vector -- becomes enormous.
        With d_model=768, a 256K vocabulary needs 196 million parameters just for embeddings.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In practice, most modern LLMs use vocabularies between 32K and 128K tokens. GPT-2 used
        50,257 tokens. LLaMA uses 32,000. GPT-4 reportedly uses around 100K. The slider below
        lets you explore how vocabulary size affects both sequence length and embedding matrix size.
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Parameters">
            <InteractiveSlider
              label="Vocabulary Size"
              min={256}
              max={256000}
              step={256}
              value={vocabSize}
              onChange={(v) => { setVocabSize(v); vocabRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Special Tokens                                        */
/* ================================================================== */
function SpecialTokensSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Special Tokens</h2>
      <p className="text-gray-300 leading-relaxed">
        Beyond the "content" tokens that represent pieces of text, every tokenizer reserves a set
        of <strong className="text-white">special tokens</strong> with specific structural meanings.
        These are never produced by BPE merges -- they are manually added to the vocabulary and
        inserted by the tokenizer at specific positions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {[
          {
            token: '[BOS] / <s>',
            name: 'Beginning of Sequence',
            desc: 'Marks the start of an input sequence. Gives the model a consistent starting signal. GPT models use this to begin generation.',
          },
          {
            token: '[EOS] / </s>',
            name: 'End of Sequence',
            desc: 'Signals that the sequence is complete. During generation, producing this token means "stop." Critical for knowing when output is finished.',
          },
          {
            token: '[PAD]',
            name: 'Padding',
            desc: 'Fills shorter sequences in a batch to equal length. Attention masks ensure the model ignores these positions. Has no semantic meaning.',
          },
          {
            token: '[CLS]',
            name: 'Classification',
            desc: 'Used by BERT-style models at the start of every input. The final hidden state at this position is used as the "sentence representation" for classification tasks.',
          },
          {
            token: '[SEP]',
            name: 'Separator',
            desc: 'Separates two segments in BERT inputs (e.g., question and passage in QA). Lets the model distinguish between the two input parts.',
          },
          {
            token: '[MASK]',
            name: 'Mask',
            desc: 'Used in BERT\'s masked language modeling: random tokens are replaced with [MASK] and the model must predict the original. This is how BERT learns bidirectional context.',
          },
        ].map((item) => (
          <div key={item.token} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <code className="text-emerald-400 font-bold text-sm">{item.token}</code>
              <span className="text-gray-400 text-xs">({item.name})</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-gray-300 leading-relaxed mt-4">
        Different model families use different special tokens. BERT uses [CLS], [SEP], [MASK], and
        [PAD]. GPT uses only BOS and EOS (and sometimes a PAD token for batching). The choice of
        special tokens reflects the model's training objective: BERT needs [MASK] for masked language
        modeling, while GPT has no use for it since it never masks tokens during training.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Token Embeddings                                      */
/* ================================================================== */
function TokenEmbeddingsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Token Embeddings: From IDs to Vectors</h2>
      <p className="text-gray-300 leading-relaxed">
        Once text is tokenized into a sequence of integer IDs, each ID must be converted into a
        dense vector before the Transformer can process it. This is done by the{' '}
        <strong className="text-white">embedding matrix</strong>, a learned weight matrix of shape
        (V x d_model) where V is the vocabulary size and d_model is the model's hidden dimension.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Token ID 4721 simply looks up row 4721 of the embedding matrix -- there is no computation,
        just a table lookup. But this matrix is <em>learned</em> during training. The model adjusts
        these vectors via backpropagation so that tokens with similar meanings end up near each other
        in the embedding space, exactly like the Word2Vec embeddings from the Word Embeddings lesson.
      </p>
      <p className="text-gray-300 leading-relaxed">
        In fact, the embedding matrix IS the first layer of the model. Before any attention
        computation happens, before any positional encoding is added, the raw token IDs are converted
        to dense vectors through this lookup. The quality of these embeddings directly affects
        everything downstream.
      </p>
      <p className="text-gray-300 leading-relaxed">
        One important consequence: rare tokens get fewer gradient updates during training (because
        they appear less often), so their embeddings are noisier and less well-trained. This is
        another reason to choose vocabulary size carefully -- a huge vocabulary will have many
        rare tokens with poor embeddings.
      </p>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 mt-4">
        <h3 className="text-lg font-semibold text-white mb-3">The Embedding Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
          <span className="px-3 py-1 rounded bg-gray-700 text-gray-300">"The cat sat"</span>
          <span className="text-gray-500">--tokenize--&gt;</span>
          <span className="px-3 py-1 rounded bg-gray-700 text-emerald-400">[464, 3797, 3332]</span>
          <span className="text-gray-500">--lookup--&gt;</span>
          <span className="px-3 py-1 rounded bg-gray-700 text-blue-400">[v_464, v_3797, v_3332]</span>
          <span className="text-gray-500">--+pos_enc--&gt;</span>
          <span className="px-3 py-1 rounded bg-gray-700 text-amber-400">Transformer input</span>
        </div>
        <p className="text-gray-400 text-xs mt-2">
          Each v is a d_model-dimensional vector (e.g., 768 dims for GPT-2, 4096 for LLaMA-7B).
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: BPE from Scratch                              */
/* ================================================================== */
function PythonBPESection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: BPE from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement the full BPE algorithm. We start with a character-level vocabulary and
        iteratively merge the most frequent adjacent pair. Watch the vocabulary grow and the
        token count shrink at each step.
      </p>
      <PythonCell
        defaultCode={`# Byte-Pair Encoding from scratch

def get_pair_counts(corpus):
    """Count adjacent token pairs across the corpus."""
    counts = {}
    for word in corpus:
        for i in range(len(word) - 1):
            pair = (word[i], word[i+1])
            counts[pair] = counts.get(pair, 0) + 1
    return counts

def merge_pair(corpus, pair):
    """Merge all occurrences of a pair into a single token."""
    merged = pair[0] + pair[1]
    new_corpus = []
    for word in corpus:
        new_word = []
        i = 0
        while i < len(word):
            if i < len(word) - 1 and word[i] == pair[0] and word[i+1] == pair[1]:
                new_word.append(merged)
                i += 2
            else:
                new_word.append(word[i])
                i += 1
        new_corpus.append(new_word)
    return new_corpus

def run_bpe(words, num_merges):
    """Run BPE for a given number of merges."""
    # Start with character-level tokenization
    corpus = [list(w) for w in words]
    vocab = sorted(set(c for w in corpus for c in w))

    print(f"Initial vocabulary ({len(vocab)} tokens): {vocab}")
    print(f"Initial corpus: {corpus}")
    total = sum(len(w) for w in corpus)
    print(f"Total tokens: {total}\\n")

    merges = []
    for step in range(num_merges):
        pairs = get_pair_counts(corpus)
        if not pairs:
            print("No more pairs to merge!")
            break

        # Find most frequent pair
        best_pair = max(pairs, key=pairs.get)
        best_count = pairs[best_pair]

        if best_count < 2:
            print(f"No pair appears more than once. Stopping.")
            break

        # Merge it
        corpus = merge_pair(corpus, best_pair)
        new_token = best_pair[0] + best_pair[1]
        vocab.append(new_token)
        merges.append(best_pair)

        total = sum(len(w) for w in corpus)
        print(f"Step {step+1}: merge '{best_pair[0]}' + '{best_pair[1]}' "
              f"-> '{new_token}' (count={best_count})")
        print(f"  Vocab size: {len(vocab)}, Total tokens: {total}")
        print(f"  Corpus: {corpus}")
        print()

    print(f"\\nFinal vocabulary ({len(vocab)} tokens):")
    # Show multi-char tokens
    multi = [t for t in vocab if len(t) > 1]
    single = [t for t in vocab if len(t) == 1]
    print(f"  Base chars: {single}")
    print(f"  Merged tokens: {multi}")
    print(f"\\nMerge rules (in order):")
    for i, (a, b) in enumerate(merges):
        print(f"  {i+1}. '{a}' + '{b}' -> '{a}{b}'")

    return corpus, vocab, merges

# Example corpus (with repeated words to show frequency-based merging)
words = ['low', 'lower', 'newest', 'widest', 'low', 'newest', 'low']
print("=== BPE on example corpus ===")
print(f"Words: {words}\\n")
corpus, vocab, merges = run_bpe(words, num_merges=10)`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Tokenization Stats                            */
/* ================================================================== */
function PythonTokenStatsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Tokenization & Compression</h2>
      <p className="text-gray-300 leading-relaxed">
        How much does BPE compress text? Let us tokenize a paragraph and measure the compression
        ratio (characters per token) at different vocabulary sizes. Higher compression means fewer
        tokens, which means faster inference and more text fits in the context window.
      </p>
      <PythonCell
        defaultCode={`# Measuring tokenization compression at different vocab sizes

def get_pair_counts(corpus):
    counts = {}
    for word in corpus:
        for i in range(len(word) - 1):
            pair = (word[i], word[i+1])
            counts[pair] = counts.get(pair, 0) + 1
    return counts

def merge_pair(corpus, pair):
    merged = pair[0] + pair[1]
    new_corpus = []
    for word in corpus:
        new_word = []
        i = 0
        while i < len(word):
            if i < len(word)-1 and word[i]==pair[0] and word[i+1]==pair[1]:
                new_word.append(merged)
                i += 2
            else:
                new_word.append(word[i])
                i += 1
        new_corpus.append(new_word)
    return new_corpus

# Training text (longer for better statistics)
text = """the cat sat on the mat the cat ate the rat
the dog sat on the log the dog ate the frog
the bird sat in the tree the bird sang a song
the fish swam in the sea the fish ate some algae
the cat and the dog played in the yard all day
the bird and the fish watched from far away"""

# Split into words (keeping spaces as tokens)
words = text.replace('\\n', ' ').split(' ')
words = [w for w in words if w]

# Character-level start
corpus = [list(w) for w in words]
total_chars = sum(len(w) for w in words)

print(f"Text: {len(words)} words, {total_chars} characters")
print(f"\\n{'Merges':>8} | {'Vocab':>6} | {'Tokens':>7} | {'Chars/Token':>11} | {'Compression':>11}")
print("-" * 60)

# Track compression at each step
total_tokens = sum(len(w) for w in corpus)
vocab_size = len(set(c for w in corpus for c in w))
ratio = total_chars / total_tokens
print(f"{'0':>8} | {vocab_size:>6} | {total_tokens:>7} | {ratio:>11.2f} | {'1.00x':>11}")

for step in range(1, 51):
    pairs = get_pair_counts(corpus)
    if not pairs:
        break
    best = max(pairs, key=pairs.get)
    if pairs[best] < 2:
        break
    corpus = merge_pair(corpus, best)
    total_tokens = sum(len(w) for w in corpus)
    vocab_size = len(set(c for w in corpus for c in w))
    ratio = total_chars / total_tokens
    baseline_tokens = total_chars  # character level
    compression = baseline_tokens / total_tokens

    if step <= 10 or step % 5 == 0:
        print(f"{step:>8} | {vocab_size:>6} | {total_tokens:>7} | {ratio:>11.2f} | {compression:>10.2f}x")

print()
print("Key insight: early merges give the biggest compression gains.")
print("Each merge saves fewer tokens as common pairs get consumed.")
print()

# Show final top tokens by frequency
token_counts = {}
for w in corpus:
    for t in w:
        token_counts[t] = token_counts.get(t, 0) + 1

sorted_tokens = sorted(token_counts.items(), key=lambda x: -x[1])
print("Top 15 tokens by frequency:")
for tok, count in sorted_tokens[:15]:
    bar = '#' * min(count, 40)
    print(f"  '{tok:>6s}': {count:>3} {bar}")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Tokenization() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Tokenization Deep Dive</h1>
        <p className="text-lg text-gray-400">
          How text becomes numbers: the critical first step of every language model. Character, word,
          and subword strategies, the BPE algorithm, vocabulary tradeoffs, and the embedding matrix
          that turns token IDs into the dense vectors Transformers actually process.
        </p>
      </header>

      <WhyTokenizationSection />
      <CompareTokenizersSection />
      <BPEStepByStepSection />
      <VocabSizeTradeoffSection />
      <SpecialTokensSection />
      <TokenEmbeddingsSection />
      <PythonBPESection />
      <PythonTokenStatsSection />
    </div>
  )
}
