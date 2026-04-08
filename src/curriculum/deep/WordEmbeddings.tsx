import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/word-embeddings',
  title: 'Word Embeddings & Vector Space',
  description: 'Explore how words become vectors, why distributional semantics works, and the surprising geometry of meaning',
  track: 'deep',
  order: 3,
  tags: ['embeddings', 'word2vec', 'skip-gram', 'cosine-similarity', 'analogy', 'nlp'],
}

/* ------------------------------------------------------------------ */
/*  Data: Simulated 2D word embeddings                                 */
/* ------------------------------------------------------------------ */
interface WordVec {
  word: string
  x: number
  y: number
  cluster: string
}

const WORD_VECTORS: WordVec[] = [
  // Royalty
  { word: 'king', x: 0.72, y: 0.85, cluster: 'royalty' },
  { word: 'queen', x: 0.68, y: 0.75, cluster: 'royalty' },
  { word: 'prince', x: 0.78, y: 0.80, cluster: 'royalty' },
  { word: 'princess', x: 0.74, y: 0.70, cluster: 'royalty' },
  { word: 'throne', x: 0.65, y: 0.82, cluster: 'royalty' },
  { word: 'crown', x: 0.70, y: 0.90, cluster: 'royalty' },
  // Animals
  { word: 'cat', x: 0.20, y: 0.35, cluster: 'animals' },
  { word: 'dog', x: 0.25, y: 0.30, cluster: 'animals' },
  { word: 'kitten', x: 0.18, y: 0.28, cluster: 'animals' },
  { word: 'puppy', x: 0.23, y: 0.22, cluster: 'animals' },
  { word: 'fish', x: 0.30, y: 0.40, cluster: 'animals' },
  { word: 'bird', x: 0.15, y: 0.42, cluster: 'animals' },
  // Food
  { word: 'apple', x: 0.50, y: 0.20, cluster: 'food' },
  { word: 'banana', x: 0.55, y: 0.15, cluster: 'food' },
  { word: 'pizza', x: 0.45, y: 0.12, cluster: 'food' },
  { word: 'bread', x: 0.48, y: 0.25, cluster: 'food' },
  { word: 'rice', x: 0.52, y: 0.28, cluster: 'food' },
  // Cities
  { word: 'paris', x: 0.85, y: 0.40, cluster: 'cities' },
  { word: 'london', x: 0.80, y: 0.35, cluster: 'cities' },
  { word: 'tokyo', x: 0.90, y: 0.45, cluster: 'cities' },
  { word: 'berlin', x: 0.82, y: 0.30, cluster: 'cities' },
  // Gender axis
  { word: 'man', x: 0.42, y: 0.60, cluster: 'people' },
  { word: 'woman', x: 0.38, y: 0.50, cluster: 'people' },
  { word: 'boy', x: 0.44, y: 0.55, cluster: 'people' },
  { word: 'girl', x: 0.40, y: 0.45, cluster: 'people' },
]

const CLUSTER_COLORS: Record<string, [number, number, number]> = {
  royalty: [220, 180, 50],
  animals: [80, 200, 120],
  food: [200, 100, 80],
  cities: [100, 140, 220],
  people: [180, 100, 200],
}

interface Analogy {
  label: string
  a: string
  b: string
  c: string
  d: string
}

const ANALOGIES: Analogy[] = [
  { label: 'king - man + woman = queen', a: 'king', b: 'man', c: 'woman', d: 'queen' },
  { label: 'prince - man + woman = princess', a: 'prince', b: 'man', c: 'woman', d: 'princess' },
  { label: 'cat - kitten + puppy = dog', a: 'cat', b: 'kitten', c: 'puppy', d: 'dog' },
  { label: 'paris - london + berlin = tokyo', a: 'paris', b: 'london', c: 'berlin', d: 'tokyo' },
]

function getVec(word: string): WordVec | undefined {
  return WORD_VECTORS.find((w) => w.word === word)
}

/* ================================================================== */
/*  Section 1 -- Words as Numbers                                      */
/* ================================================================== */
function WordsAsNumbersSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Problem: Words Are Not Numbers</h2>
      <p className="text-gray-300 leading-relaxed">
        Neural networks operate on numbers, but language is made of discrete symbols. The most naive
        approach is <strong className="text-white">one-hot encoding</strong>: represent each word as
        a vector with a single 1 and the rest 0s. With a vocabulary of 50,000 words, each word
        becomes a 50,000-dimensional sparse vector. This has two fatal problems:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">Dimensionality explosion</strong>: every word needs its own dimension. The vectors are enormous and wasteful -- 49,999 of the 50,000 entries are always zero.</li>
        <li><strong className="text-white">No similarity</strong>: the dot product between any two different one-hot vectors is exactly zero. "cat" and "kitten" are just as different as "cat" and "democracy." The representation encodes no meaning whatsoever.</li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        What we want is a <strong className="text-white">dense, low-dimensional</strong> representation
        where similar words have similar vectors. A 300-dimensional embedding can capture rich
        semantic relationships: synonyms cluster together, analogies emerge as parallel vector
        offsets, and the geometry of the space reflects the structure of meaning.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Distributional Hypothesis                             */
/* ================================================================== */
function DistributionalSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Distributional Hypothesis</h2>
      <p className="text-gray-300 leading-relaxed">
        "You shall know a word by the company it keeps" -- J.R. Firth, 1957. This is the core
        insight behind all modern word embeddings. Words that appear in similar contexts tend to
        have similar meanings. "Dog" and "cat" both appear near "pet," "food," "vet," and "cute,"
        so their learned vectors end up close together.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Word2Vec (Mikolov et al., 2013) operationalized this by training a shallow neural network
        on a simple prediction task: given a word, predict its neighbors (skip-gram), or given
        neighbors, predict the word (CBOW). The network's hidden layer weights become the word
        embeddings. The genius is that learning to predict context forces the network to encode
        meaning -- words with similar contexts get pushed into similar regions of vector space.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Skip-gram Sliding Window                              */
/* ================================================================== */
function SkipGramSection() {
  const [windowSize, setWindowSize] = useState(2)
  const [activeIdx, _setActiveIdx] = useState(3)
  const stateRef = useRef({ windowSize, activeIdx })
  stateRef.current = { windowSize, activeIdx }

  const sentence = ['the', 'cat', 'sat', 'on', 'the', 'warm', 'mat', 'today']

  const sketch = useCallback((p: p5) => {
    let frame = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 200)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { windowSize: ws, activeIdx: _ai } = stateRef.current
      p.background(15, 15, 25)

      frame++
      if (frame % 60 === 0) {
        stateRef.current.activeIdx = (stateRef.current.activeIdx + 1) % sentence.length
      }

      const boxW = 70
      const boxH = 40
      const gap = 6
      const totalW = sentence.length * (boxW + gap) - gap
      const startX = (p.width - totalW) / 2
      const y = 80

      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Skip-gram: predict context from center word', 20, 14)

      const currentActive = stateRef.current.activeIdx

      for (let i = 0; i < sentence.length; i++) {
        const x = startX + i * (boxW + gap)
        const dist = Math.abs(i - currentActive)
        const isCenter = i === currentActive
        const isContext = dist > 0 && dist <= ws

        if (isCenter) {
          p.fill(50, 130, 220)
          p.stroke(80, 180, 255)
          p.strokeWeight(2)
        } else if (isContext) {
          p.fill(50, 140, 80)
          p.stroke(80, 220, 120)
          p.strokeWeight(2)
        } else {
          p.fill(35, 40, 55)
          p.stroke(60, 65, 80)
          p.strokeWeight(1)
        }

        p.rect(x, y, boxW, boxH, 6)

        p.fill(isCenter || isContext ? 255 : 120)
        p.noStroke()
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(sentence[i], x + boxW / 2, y + boxH / 2)

        if (isCenter) {
          p.fill(80, 180, 255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.TOP)
          p.text('center', x + boxW / 2, y + boxH + 6)
        } else if (isContext) {
          p.fill(80, 220, 120)
          p.textSize(10)
          p.textAlign(p.CENTER, p.TOP)
          p.text('context', x + boxW / 2, y + boxH + 6)
        }
      }

      // Training pair info
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      const centerWord = sentence[currentActive]
      const contextWords = sentence.filter((_, i) => {
        const d = Math.abs(i - currentActive)
        return d > 0 && d <= ws
      })
      p.text(`Training pairs: (${centerWord}, ${contextWords.join('), (' + centerWord + ', ')})`, 20, p.height - 8)
    }
  }, [sentence])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Word2Vec: The Skip-gram Window</h2>
      <p className="text-gray-300 leading-relaxed">
        In skip-gram, we slide a window across the text. The center word (blue) is the input, and
        each context word (green) within the window is a separate training target. For each pair,
        the model learns to predict the context word from the center word's embedding. Over millions
        of such pairs, the embeddings converge to capture distributional similarity.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The window size controls how broad the context is. A small window (1-2) captures syntactic
        similarity (words that are grammatically interchangeable), while a larger window (5-10)
        captures more topical/semantic similarity.
      </p>
      <P5Sketch
        sketch={sketch}
        height={200}
        controls={
          <ControlPanel title="Skip-gram">
            <InteractiveSlider label="Window Size" min={1} max={4} step={1} value={windowSize} onChange={setWindowSize} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- 2D Embedding Space (Clickable)                        */
/* ================================================================== */
function EmbeddingSpaceSection() {
  const [selectedWord, _setSelectedWord] = useState<string | null>(null)
  const selectedRef = useRef(selectedWord)
  selectedRef.current = selectedWord

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 650), 450)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)
      const margin = 50
      const plotW = p.width - 2 * margin
      const plotH = p.height - 2 * margin - 20

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('2D Word Embedding Space (click a word)', 20, 10)

      // Grid
      p.stroke(30, 35, 50)
      p.strokeWeight(1)
      for (let i = 0; i <= 10; i++) {
        const gx = margin + (plotW * i) / 10
        const gy = margin + (plotH * i) / 10
        p.line(gx, margin, gx, margin + plotH)
        p.line(margin, gy, margin + plotW, gy)
      }

      const sel = selectedRef.current
      const selVec = sel ? getVec(sel) : null

      // Draw connections to nearest neighbors if selected
      if (selVec) {
        const distances = WORD_VECTORS
          .filter((w) => w.word !== sel)
          .map((w) => ({
            word: w,
            dist: Math.sqrt((w.x - selVec.x) ** 2 + (w.y - selVec.y) ** 2),
          }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5)

        for (const { word: w, dist } of distances) {
          const alpha = p.map(dist, 0, 0.4, 200, 30)
          p.stroke(180, 180, 255, alpha)
          p.strokeWeight(p.map(dist, 0, 0.4, 3, 0.5))
          p.line(
            margin + selVec.x * plotW,
            margin + (1 - selVec.y) * plotH,
            margin + w.x * plotW,
            margin + (1 - w.y) * plotH
          )
        }
      }

      // Draw words
      for (const wv of WORD_VECTORS) {
        const wx = margin + wv.x * plotW
        const wy = margin + (1 - wv.y) * plotH
        const col = CLUSTER_COLORS[wv.cluster] || [180, 180, 180]
        const isSelected = wv.word === sel

        p.fill(col[0], col[1], col[2], isSelected ? 255 : 180)
        p.noStroke()
        p.ellipse(wx, wy, isSelected ? 14 : 10, isSelected ? 14 : 10)

        p.fill(isSelected ? 255 : 200)
        p.textSize(isSelected ? 12 : 10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(wv.word, wx + 9, wy)
      }

      // Legend
      const legendY = p.height - 18
      let legendX = 20
      p.textSize(10)
      for (const [cluster, col] of Object.entries(CLUSTER_COLORS)) {
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.ellipse(legendX, legendY, 8, 8)
        p.fill(160)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(cluster, legendX + 8, legendY)
        legendX += p.textWidth(cluster) + 24
      }
    }

    p.mousePressed = () => {
      const margin = 50
      const plotW = p.width - 2 * margin
      const plotH = p.height - 2 * margin - 20
      let closest: string | null = null
      let closestDist = 20

      for (const wv of WORD_VECTORS) {
        const wx = margin + wv.x * plotW
        const wy = margin + (1 - wv.y) * plotH
        const d = Math.sqrt((p.mouseX - wx) ** 2 + (p.mouseY - wy) ** 2)
        if (d < closestDist) {
          closestDist = d
          closest = wv.word
        }
      }

      selectedRef.current = closest
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Embedding Space</h2>
      <p className="text-gray-300 leading-relaxed">
        Once trained, word embeddings live in a continuous vector space where distances and
        directions encode meaning. The visualization below shows words projected to 2D (in practice,
        embeddings have 100-300 dimensions, reduced via t-SNE or PCA for visualization). Words
        naturally cluster by semantic category: animals group together, royalty words form another
        cluster, cities another.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click on any word to see its 5 nearest neighbors connected by lines. Thicker, brighter lines
        mean closer neighbors. Notice that neighbors tend to share semantic or functional similarity.
      </p>
      <P5Sketch sketch={sketch} height={450} />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Vector Arithmetic / Analogies                         */
/* ================================================================== */
function AnalogySection() {
  const [analogyIdx, setAnalogyIdx] = useState(0)
  const stateRef = useRef({ analogyIdx })
  stateRef.current = { analogyIdx }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { analogyIdx: ai } = stateRef.current
      const analogy = ANALOGIES[ai]
      const va = getVec(analogy.a)
      const vb = getVec(analogy.b)
      const vc = getVec(analogy.c)
      const vd = getVec(analogy.d)
      if (!va || !vb || !vc || !vd) return

      p.background(15, 15, 25)
      const margin = 60
      const plotW = p.width - 2 * margin
      const plotH = p.height - 2 * margin - 40

      // Map coordinates
      const allX = [va.x, vb.x, vc.x, vd.x]
      const allY = [va.y, vb.y, vc.y, vd.y]
      const minX = Math.min(...allX) - 0.05
      const maxX = Math.max(...allX) + 0.05
      const minY = Math.min(...allY) - 0.05
      const maxY = Math.max(...allY) + 0.05

      const mapX = (v: number) => margin + ((v - minX) / (maxX - minX)) * plotW
      const mapY = (v: number) => margin + plotH - ((v - minY) / (maxY - minY)) * plotH

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text(analogy.label, 20, 12)

      // Parallelogram
      p.stroke(100, 100, 200, 80)
      p.strokeWeight(1)
      p.noFill()
      p.beginShape()
      p.vertex(mapX(vb.x), mapY(vb.y))
      p.vertex(mapX(va.x), mapY(va.y))
      p.vertex(mapX(vd.x), mapY(vd.y))
      p.vertex(mapX(vc.x), mapY(vc.y))
      p.endShape(p.CLOSE)

      // Arrows: a->b (relationship 1)
      const drawArrow = (x1: number, y1: number, x2: number, y2: number, col: readonly [number, number, number], label: string) => {
        p.stroke(col[0], col[1], col[2])
        p.strokeWeight(2.5)
        p.line(x1, y1, x2, y2)

        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const headLen = 10
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.triangle(
          x2, y2,
          x2 - headLen * Math.cos(angle - 0.3), y2 - headLen * Math.sin(angle - 0.3),
          x2 - headLen * Math.cos(angle + 0.3), y2 - headLen * Math.sin(angle + 0.3)
        )

        // Label at midpoint
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, mx + 15, my - 10)
      }

      // a - b vector
      drawArrow(mapX(vb.x), mapY(vb.y), mapX(va.x), mapY(va.y), [220, 160, 60] as const, `+${analogy.a}`)
      // c - d vector (parallel)
      drawArrow(mapX(vc.x), mapY(vc.y), mapX(vd.x), mapY(vd.y), [220, 160, 60] as const, `+${analogy.d}`)
      // b -> c (the offset)
      drawArrow(mapX(vb.x), mapY(vb.y), mapX(vc.x), mapY(vc.y), [80, 200, 120] as const, `-${analogy.b}+${analogy.c}`)
      // a -> d (same offset)
      drawArrow(mapX(va.x), mapY(va.y), mapX(vd.x), mapY(vd.y), [80, 200, 120] as const, '')

      // Draw points
      const drawPoint = (v: WordVec, highlight: boolean) => {
        const px = mapX(v.x)
        const py = mapY(v.y)
        const col = CLUSTER_COLORS[v.cluster] || [200, 200, 200]
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.ellipse(px, py, highlight ? 16 : 12, highlight ? 16 : 12)
        p.fill(255)
        p.textSize(13)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(v.word, px, py - 12)
      }

      drawPoint(va, true)
      drawPoint(vb, true)
      drawPoint(vc, true)
      drawPoint(vd, true)

      // Explanation
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('The same vector offset (green arrows) encodes the relationship', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Vector Arithmetic and Analogies</h2>
      <p className="text-gray-300 leading-relaxed">
        The most stunning property of word embeddings is that relationships are encoded as
        consistent vector offsets. The vector from "man" to "king" is approximately the same as the
        vector from "woman" to "queen." This means you can solve analogies algebraically:
        <code className="text-emerald-400"> king - man + woman = queen</code>. The four words form a
        parallelogram in embedding space.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Select different analogies below. The green arrows show the relationship offset (e.g.,
        the gender direction) while the yellow arrows connect the pairs. When these arrows are
        parallel, the analogy holds perfectly. In high-dimensional space, this works remarkably
        well across many types of relationships: gender, country-capital, tense, and more.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {ANALOGIES.map((a, i) => (
          <button
            key={i}
            onClick={() => { setAnalogyIdx(i); stateRef.current.analogyIdx = i }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              analogyIdx === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} height={380} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Cosine Similarity                                     */
/* ================================================================== */
function CosineSimilaritySection() {
  const [word1Idx, setWord1Idx] = useState(0)
  const [word2Idx, setWord2Idx] = useState(1)
  const stateRef = useRef({ word1Idx, word2Idx })
  stateRef.current = { word1Idx, word2Idx }

  const wordList = WORD_VECTORS.map((w) => w.word)

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 500), 350)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { word1Idx: w1i, word2Idx: w2i } = stateRef.current
      const v1 = WORD_VECTORS[w1i]
      const v2 = WORD_VECTORS[w2i]

      p.background(15, 15, 25)
      const cx = p.width / 2
      const cy = p.height / 2 + 20
      const scale = 160

      // Origin
      p.fill(60)
      p.noStroke()
      p.ellipse(cx, cy, 6, 6)

      // Draw vectors as arrows from origin
      const drawVecArrow = (vx: number, vy: number, col: readonly [number, number, number], label: string) => {
        const ex = cx + vx * scale
        const ey = cy - vy * scale
        p.stroke(col[0], col[1], col[2])
        p.strokeWeight(3)
        p.line(cx, cy, ex, ey)

        const angle = Math.atan2(cy - ey, ex - cx)
        const headLen = 12
        p.fill(col[0], col[1], col[2])
        p.noStroke()
        p.triangle(
          ex, ey,
          ex - headLen * Math.cos(angle - 0.3), ey + headLen * Math.sin(angle - 0.3),
          ex - headLen * Math.cos(angle + 0.3), ey + headLen * Math.sin(angle + 0.3)
        )

        p.fill(col[0], col[1], col[2])
        p.textSize(13)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, ex + 20 * Math.cos(angle), ey - 20 * Math.sin(angle))
      }

      // Normalize for display
      const norm1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
      const norm2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
      const n1x = v1.x / norm1
      const n1y = v1.y / norm1
      const n2x = v2.x / norm2
      const n2y = v2.y / norm2

      // Draw angle arc
      const angle1 = Math.atan2(n1y, n1x)
      const angle2 = Math.atan2(n2y, n2x)
      const startAngle = -Math.max(angle1, angle2)
      const endAngle = -Math.min(angle1, angle2)
      p.noFill()
      p.stroke(200, 200, 100, 120)
      p.strokeWeight(2)
      p.arc(cx, cy, 80, 80, startAngle, endAngle)

      // Cosine similarity
      const dot = v1.x * v2.x + v1.y * v2.y
      const cosine = dot / (norm1 * norm2)
      const angleDeg = (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI

      drawVecArrow(n1x, n1y, [100, 180, 255] as const, v1.word)
      drawVecArrow(n2x, n2y, [255, 140, 80] as const, v2.word)

      // Info text
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Cosine Similarity', 20, 12)

      p.fill(200)
      p.textSize(13)
      p.text(`cos(${v1.word}, ${v2.word}) = ${cosine.toFixed(4)}`, 20, 34)
      p.text(`Angle: ${angleDeg.toFixed(1)} degrees`, 20, 54)

      p.fill(140)
      p.textSize(11)
      const interp = cosine > 0.95 ? 'Very similar' : cosine > 0.7 ? 'Similar' : cosine > 0.3 ? 'Somewhat related' : 'Different'
      p.text(interp, 20, 76)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Cosine Similarity: Measuring Meaning</h2>
      <p className="text-gray-300 leading-relaxed">
        We measure word similarity using <strong className="text-white">cosine similarity</strong>:
        the cosine of the angle between two vectors. It ranges from -1 (opposite) through 0
        (orthogonal/unrelated) to 1 (identical direction). Unlike Euclidean distance, cosine
        similarity is insensitive to vector magnitude -- it only cares about direction, which is
        where the semantic information lives.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The two arrows below represent word vectors (normalized to unit length). The yellow arc
        shows the angle between them. Select different word pairs and observe how the angle
        reflects semantic similarity.
      </p>

      <div className="flex gap-4 mb-2">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Word 1</label>
          <select
            value={word1Idx}
            onChange={(e) => { const v = Number(e.target.value); setWord1Idx(v); stateRef.current.word1Idx = v }}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
          >
            {wordList.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Word 2</label>
          <select
            value={word2Idx}
            onChange={(e) => { const v = Number(e.target.value); setWord2Idx(v); stateRef.current.word2Idx = v }}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
          >
            {wordList.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        </div>
      </div>

      <P5Sketch sketch={sketch} height={350} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Cosine Similarity & Analogies                 */
/* ================================================================== */
function PythonEmbeddingsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Cosine Similarity and Analogies</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement cosine similarity and analogy solving from scratch. We will use a small
        set of pretend embeddings (in practice, you would load GloVe or Word2Vec vectors) to
        demonstrate the core operations.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Simulated 50-dim word embeddings (in practice, use GloVe/Word2Vec)
np.random.seed(42)

# Create embeddings with intentional structure
base = np.random.randn(50) * 0.1
gender_dir = np.random.randn(50) * 0.3
royal_dir = np.random.randn(50) * 0.3

embeddings = {
    'man':      base + gender_dir * 1,
    'woman':    base - gender_dir * 1,
    'king':     base + gender_dir * 1 + royal_dir * 1,
    'queen':    base - gender_dir * 1 + royal_dir * 1,
    'prince':   base + gender_dir * 0.8 + royal_dir * 0.6,
    'princess': base - gender_dir * 0.8 + royal_dir * 0.6,
    'boy':      base + gender_dir * 0.5 + np.random.randn(50) * 0.05,
    'girl':     base - gender_dir * 0.5 + np.random.randn(50) * 0.05,
}

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def solve_analogy(a, b, c, vocab):
    """a is to b as c is to ?"""
    target = embeddings[b] - embeddings[a] + embeddings[c]
    best_word, best_sim = None, -1
    for word, vec in vocab.items():
        if word in (a, b, c):
            continue
        sim = cosine_sim(target, vec)
        if sim > best_sim:
            best_sim = sim
            best_word = word
    return best_word, best_sim

# Cosine similarities
print("=== Cosine Similarities ===")
pairs = [('king', 'queen'), ('king', 'man'), ('man', 'woman'),
         ('king', 'boy'), ('queen', 'princess')]
for w1, w2 in pairs:
    sim = cosine_sim(embeddings[w1], embeddings[w2])
    print(f"  cos({w1:10s}, {w2:10s}) = {sim:.4f}")

# Analogies
print("\\n=== Analogies ===")
analogies = [
    ('man', 'king', 'woman'),      # woman -> ?
    ('man', 'prince', 'woman'),    # woman -> ?
    ('king', 'man', 'queen'),      # queen -> ?
]
for a, b, c in analogies:
    result, sim = solve_analogy(a, b, c, embeddings)
    print(f"  {a} : {b} :: {c} : {result} (sim={sim:.4f})")`}
        title="Cosine Similarity & Analogy Solving"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Building a Simple Embedding                   */
/* ================================================================== */
function PythonWord2VecSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Training a Tiny Skip-gram</h2>
      <p className="text-gray-300 leading-relaxed">
        Below is a minimal skip-gram implementation. We train on a tiny corpus to show the core
        mechanism: for each (center, context) pair, push the embeddings closer together via gradient
        descent on a dot-product objective. With enough data, this simple procedure produces
        remarkably rich representations.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Tiny corpus
corpus = "the cat sat on the mat the dog sat on the rug".split()
vocab = sorted(set(corpus))
word2idx = {w: i for i, w in enumerate(vocab)}
V = len(vocab)
print(f"Vocabulary ({V} words): {vocab}")

# Skip-gram training pairs (window=1)
pairs = []
for i in range(1, len(corpus) - 1):
    center = word2idx[corpus[i]]
    for offset in [-1, 1]:
        context = word2idx[corpus[i + offset]]
        pairs.append((center, context))

print(f"Training pairs: {len(pairs)}")

# Initialize embeddings
dim = 8
np.random.seed(42)
W_center = np.random.randn(V, dim) * 0.1   # center word embeddings
W_context = np.random.randn(V, dim) * 0.1  # context word embeddings

# Simple sigmoid skip-gram training
lr = 0.5
losses = []
for epoch in range(200):
    epoch_loss = 0
    np.random.shuffle(pairs)
    for c_idx, ctx_idx in pairs:
        # Positive pair: sigmoid(dot product) should be high
        dot = np.dot(W_center[c_idx], W_context[ctx_idx])
        sig = 1 / (1 + np.exp(-np.clip(dot, -10, 10)))
        loss = -np.log(sig + 1e-8)
        epoch_loss += loss

        # Gradient
        grad = sig - 1  # d/d(dot) of -log(sigmoid(dot))
        W_center[c_idx] -= lr * grad * W_context[ctx_idx]
        W_context[ctx_idx] -= lr * grad * W_center[c_idx]

    losses.append(epoch_loss / len(pairs))

print(f"\\nFinal loss: {losses[-1]:.4f}")

# Show learned similarities
print("\\nLearned cosine similarities:")
def cos(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)

for w1 in vocab:
    sims = [(w2, cos(W_center[word2idx[w1]], W_center[word2idx[w2]]))
            for w2 in vocab if w2 != w1]
    sims.sort(key=lambda x: -x[1])
    top = sims[0]
    print(f"  {w1:6s} -> nearest: {top[0]:6s} (cos={top[1]:.3f})")`}
        title="Mini Skip-gram Training"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function WordEmbeddings() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Word Embeddings &amp; Vector Space</h1>
        <p className="text-lg text-gray-400">
          How words become dense vectors that encode meaning, why similar words cluster together,
          and the remarkable algebra of analogy.
        </p>
      </header>

      <WordsAsNumbersSection />
      <DistributionalSection />
      <SkipGramSection />
      <EmbeddingSpaceSection />
      <AnalogySection />
      <CosineSimilaritySection />
      <PythonEmbeddingsSection />
      <PythonWord2VecSection />
    </div>
  )
}
