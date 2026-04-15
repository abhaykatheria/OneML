import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/inverted-index',
  title: 'Inverted Index: Full-Text Search',
  description:
    'The data structure behind every search engine — learn how inverted indexes enable instant document retrieval and TF-IDF ranking',
  track: 'datastructures',
  order: 15,
  tags: ['inverted-index', 'search', 'tf-idf', 'elasticsearch', 'posting-list', 'full-text'],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 23, 42]
const GRID_C: [number, number, number] = [30, 41, 59]
const ACCENT: [number, number, number] = [99, 102, 241]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const PINK: [number, number, number] = [236, 72, 153]
const RED: [number, number, number] = [239, 68, 68]
const TEXT_C: [number, number, number] = [148, 163, 184]
const CYAN: [number, number, number] = [34, 211, 238]
const ORANGE: [number, number, number] = [251, 146, 60]

/* ------------------------------------------------------------------ */
/* Sample Corpus                                                       */
/* ------------------------------------------------------------------ */

interface Doc {
  id: number
  title: string
  text: string
}

const CORPUS: Doc[] = [
  { id: 0, title: 'Intro to ML', text: 'machine learning is a branch of artificial intelligence that learns from data' },
  { id: 1, title: 'Deep Learning', text: 'deep learning uses neural networks with many layers to learn complex patterns from data' },
  { id: 2, title: 'Data Science', text: 'data science combines statistics and machine learning to extract insights from data' },
  { id: 3, title: 'Neural Networks', text: 'neural networks are inspired by the brain and can learn to recognize patterns' },
  { id: 4, title: 'NLP Guide', text: 'natural language processing uses machine learning to understand human language and text' },
  { id: 5, title: 'Computer Vision', text: 'computer vision uses deep learning to analyze images and understand visual data' },
  { id: 6, title: 'Reinforcement', text: 'reinforcement learning teaches agents to make decisions by learning from rewards' },
  { id: 7, title: 'Statistics 101', text: 'statistics provides the mathematical foundation for data analysis and machine learning' },
]

/* ------------------------------------------------------------------ */
/* Inverted Index                                                      */
/* ------------------------------------------------------------------ */

interface PostingEntry {
  docId: number
  tf: number  // term frequency in this doc
  positions: number[]
}

interface InvertedIndexState {
  index: Map<string, PostingEntry[]>
  docCount: number
  docLengths: Map<number, number>
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0)
}

function buildIndex(docs: Doc[]): InvertedIndexState {
  const index = new Map<string, PostingEntry[]>()
  const docLengths = new Map<number, number>()

  for (const doc of docs) {
    const tokens = tokenize(doc.text)
    docLengths.set(doc.id, tokens.length)
    const termCounts = new Map<string, number[]>()

    tokens.forEach((t, pos) => {
      if (!termCounts.has(t)) termCounts.set(t, [])
      termCounts.get(t)!.push(pos)
    })

    for (const [term, positions] of termCounts) {
      if (!index.has(term)) index.set(term, [])
      index.get(term)!.push({
        docId: doc.id,
        tf: positions.length / tokens.length,
        positions,
      })
    }
  }

  // Sort posting lists by docId
  for (const postings of index.values()) {
    postings.sort((a, b) => a.docId - b.docId)
  }

  return { index, docCount: docs.length, docLengths }
}

interface SearchResult {
  docId: number
  score: number
  matchedTerms: string[]
}

function searchWithTfIdf(idx: InvertedIndexState, query: string): SearchResult[] {
  const terms = tokenize(query)
  if (terms.length === 0) return []

  const scores = new Map<number, { score: number; terms: string[] }>()

  for (const term of terms) {
    const postings = idx.index.get(term)
    if (!postings) continue

    const idf = Math.log(idx.docCount / postings.length)

    for (const entry of postings) {
      const tfidf = entry.tf * idf
      if (!scores.has(entry.docId)) {
        scores.set(entry.docId, { score: 0, terms: [] })
      }
      const s = scores.get(entry.docId)!
      s.score += tfidf
      if (!s.terms.includes(term)) s.terms.push(term)
    }
  }

  const results: SearchResult[] = []
  for (const [docId, { score, terms: matchedTerms }] of scores) {
    results.push({ docId, score, matchedTerms })
  }
  results.sort((a, b) => b.score - a.score)
  return results
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Search Visualization                        */
/* ------------------------------------------------------------------ */

function SearchSketch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [statusMsg, setStatusMsg] = useState('Type a search query to see the inverted index in action')

  const idxRef = useRef<InvertedIndexState>(buildIndex(CORPUS))
  const queryTermsRef = useRef<string[]>([])
  const matchedDocsRef = useRef<Set<number>>(new Set())
  const animRef = useRef(0)

  const handleSearch = useCallback((text: string) => {
    setQuery(text)
    const terms = tokenize(text)
    queryTermsRef.current = terms
    const searchResults = searchWithTfIdf(idxRef.current, text)
    setResults(searchResults)
    matchedDocsRef.current = new Set(searchResults.map(r => r.docId))
    animRef.current = 90

    if (terms.length === 0) {
      setStatusMsg('Type a search query to see the inverted index in action')
    } else {
      const found = searchResults.length
      const termsInIndex = terms.filter(t => idxRef.current.index.has(t))
      setStatusMsg(`${termsInIndex.length}/${terms.length} terms found in index | ${found} document(s) matched`)
    }
  }, [])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 520)
        p.textFont('monospace')
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        p.background(...BG)

        // Grid
        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        if (animRef.current > 0) animRef.current--

        const idx = idxRef.current
        const terms = queryTermsRef.current
        const matched = matchedDocsRef.current

        // Left panel: Documents
        const docPanelX = 20
        const docPanelY = 50

        p.noStroke()
        p.fill(...CYAN)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Documents', docPanelX, 15)

        for (let i = 0; i < CORPUS.length; i++) {
          const doc = CORPUS[i]
          const y = docPanelY + i * 52
          const isMatch = matched.has(doc.id)

          // Background
          if (isMatch) {
            p.fill(34, 197, 94, 30)
          } else {
            p.fill(30, 41, 59, 150)
          }
          p.noStroke()
          p.rect(docPanelX, y, 230, 46, 4)

          // Doc title
          p.fill(isMatch ? GREEN : TEXT_C)
          p.textSize(10)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`[${doc.id}] ${doc.title}`, docPanelX + 6, y + 4)

          // Doc text (truncated)
          p.fill(...TEXT_C)
          p.textSize(8)
          const preview = doc.text.length > 40 ? doc.text.slice(0, 40) + '...' : doc.text
          p.text(preview, docPanelX + 6, y + 18)

          // Score badge
          if (isMatch) {
            const result = results.find(r => r.docId === doc.id)
            if (result) {
              p.fill(...YELLOW)
              p.textSize(9)
              p.textAlign(p.RIGHT, p.TOP)
              p.text(`score: ${result.score.toFixed(3)}`, docPanelX + 224, y + 32)
            }
          }
        }

        // Right panel: Inverted Index (show terms from query + some extra)
        const idxPanelX = 290
        const idxPanelY = 50

        p.fill(...ORANGE)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Inverted Index', idxPanelX, 15)

        // Pick which terms to show
        const displayTerms: string[] = [...terms]
        // Add a few extra terms for context
        const allTerms = Array.from(idx.index.keys()).sort()
        for (const t of allTerms) {
          if (!displayTerms.includes(t) && displayTerms.length < 14) {
            displayTerms.push(t)
          }
        }

        for (let i = 0; i < Math.min(displayTerms.length, 14); i++) {
          const term = displayTerms[i]
          const y = idxPanelY + i * 32
          const postings = idx.index.get(term)
          const isQueryTerm = terms.includes(term)

          // Term label
          p.noStroke()
          p.fill(isQueryTerm ? YELLOW : TEXT_C)
          p.textSize(11)
          p.textAlign(p.LEFT, p.TOP)
          p.text(term, idxPanelX, y + 2)

          // Arrow
          p.fill(...TEXT_C)
          p.text('\u2192', idxPanelX + 85, y + 2)

          // Posting list
          if (postings) {
            for (let j = 0; j < postings.length; j++) {
              const entry = postings[j]
              const bx = idxPanelX + 105 + j * 38
              const isDocMatch = isQueryTerm && matched.has(entry.docId)

              if (isDocMatch) {
                p.fill(...GREEN)
                ctx.globalAlpha = 0.3
                p.noStroke()
                p.rect(bx - 2, y - 1, 34, 20, 3)
                ctx.globalAlpha = 1.0
              }

              p.fill(isDocMatch ? GREEN : ACCENT)
              p.noStroke()
              p.textSize(10)
              p.textAlign(p.LEFT, p.TOP)
              p.text(`d${entry.docId}`, bx + 2, y + 2)

              // Draw connecting line for matched query terms
              if (isDocMatch && animRef.current > 0) {
                const docY = docPanelY + entry.docId * 52 + 23
                ctx.globalAlpha = animRef.current / 90 * 0.4
                p.stroke(...GREEN)
                p.strokeWeight(1)
                ctx.setLineDash([3, 3])
                p.line(bx + 10, y + 15, docPanelX + 230, docY)
                ctx.setLineDash([])
                ctx.globalAlpha = 1.0
              }
            }
          } else {
            p.fill(...RED)
            p.textSize(10)
            p.text('(not found)', idxPanelX + 105, y + 2)
          }
        }

        // Intersection / scoring panel
        if (results.length > 0) {
          const panelX = idxPanelX
          const panelY = p.height - 60
          p.fill(30, 41, 59, 220)
          p.noStroke()
          p.rect(panelX, panelY, 490, 50, 6)
          p.fill(...GREEN)
          p.textSize(11)
          p.textAlign(p.LEFT, p.TOP)
          p.text('Ranked Results:', panelX + 10, panelY + 6)
          const topResults = results.slice(0, 4)
          for (let i = 0; i < topResults.length; i++) {
            const r = topResults[i]
            const doc = CORPUS[r.docId]
            p.fill(...TEXT_C)
            p.textSize(9)
            p.text(
              `#${i + 1}: [${doc.id}] ${doc.title} (score: ${r.score.toFixed(3)}, terms: ${r.matchedTerms.join(', ')})`,
              panelX + 10,
              panelY + 22 + i * 12
            )
          }
        }
      }
    },
    [results]
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search: try 'machine learning' or 'neural data'..."
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-96 focus:border-indigo-500 outline-none"
        />
        <span className="text-sm text-gray-400">{statusMsg}</span>
      </div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — TF-IDF Scoring Breakdown                                */
/* ------------------------------------------------------------------ */

function TfIdfSketch() {
  const [query, setQuery] = useState('machine learning data')

  const idxRef = useRef<InvertedIndexState>(buildIndex(CORPUS))
  const queryRef = useRef(query)

  const handleQuery = useCallback((text: string) => {
    setQuery(text)
    queryRef.current = text
  }, [])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 440)
        p.textFont('monospace')
      }

      p.draw = () => {
        p.background(...BG)

        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('TF-IDF Score Breakdown', 20, 15)

        const idx = idxRef.current
        const terms = tokenize(queryRef.current)
        const results = searchWithTfIdf(idx, queryRef.current)

        if (terms.length === 0 || results.length === 0) {
          p.fill(...TEXT_C)
          p.textSize(12)
          p.text('Enter a query to see score breakdown', 20, 60)
          return
        }

        // Show IDF for each term
        const idfY = 45
        p.fill(...CYAN)
        p.textSize(12)
        p.text('Term IDF (rarer words score higher):', 20, idfY)

        for (let i = 0; i < terms.length; i++) {
          const term = terms[i]
          const postings = idx.index.get(term)
          const df = postings ? postings.length : 0
          const idf = df > 0 ? Math.log(idx.docCount / df) : 0

          const y = idfY + 22 + i * 20
          p.fill(idf > 1 ? YELLOW : TEXT_C)
          p.textSize(11)
          p.text(`"${term}": df=${df}/${idx.docCount}, idf=ln(${idx.docCount}/${df})=${idf.toFixed(3)}`, 30, y)

          // Bar
          const barW = idf * 80
          p.fill(idf > 1 ? YELLOW : ACCENT)
          p.noStroke()
          p.rect(420, y, barW, 14, 3)
        }

        // Show top results with score breakdown
        const resY = idfY + 30 + terms.length * 20 + 10
        p.fill(...GREEN)
        p.textSize(12)
        p.text('Ranked Results (TF * IDF per term, summed):', 20, resY)

        const maxScore = results.length > 0 ? results[0].score : 1

        for (let i = 0; i < Math.min(results.length, 6); i++) {
          const r = results[i]
          const doc = CORPUS[r.docId]
          const y = resY + 22 + i * 48

          // Doc info
          p.fill(...TEXT_C)
          p.textSize(10)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`#${i + 1} [${doc.id}] ${doc.title}`, 30, y)

          // Score bar
          const barW = (r.score / maxScore) * 350
          p.fill(...GREEN)
          p.noStroke()
          p.rect(30, y + 14, barW, 10, 3)

          // Term-by-term breakdown
          let bx = 30
          for (const term of r.matchedTerms) {
            const postings = idx.index.get(term)
            if (!postings) continue
            const entry = postings.find(e => e.docId === r.docId)
            if (!entry) continue
            const idf = Math.log(idx.docCount / postings.length)
            const tfidf = entry.tf * idf

            const segW = (tfidf / maxScore) * 350
            p.fill(terms.indexOf(term) === 0 ? ACCENT : terms.indexOf(term) === 1 ? ORANGE : PINK)
            p.noStroke()
            p.rect(bx, y + 14, Math.max(segW, 2), 10, 1)
            bx += segW
          }

          // Score text
          p.fill(...YELLOW)
          p.textSize(9)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`score=${r.score.toFixed(4)} [${r.matchedTerms.join('+')}]`, 30 + barW + 10, y + 13)
        }
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder="TF-IDF query..."
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-72 focus:border-indigo-500 outline-none"
        />
        <span className="text-sm text-gray-400">Higher IDF = rarer term = more discriminative</span>
      </div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Code                                                         */
/* ------------------------------------------------------------------ */

const indexImplementation = `import re
from collections import defaultdict

class InvertedIndex:
    def __init__(self):
        self.index = defaultdict(list)  # term -> sorted list of doc_ids
        self.doc_store = {}  # doc_id -> text
        self.doc_count = 0

    def tokenize(self, text):
        return re.findall(r'[a-z0-9]+', text.lower())

    def add_document(self, doc_id, text):
        self.doc_store[doc_id] = text
        self.doc_count += 1
        seen = set()
        for token in self.tokenize(text):
            if token not in seen:
                self.index[token].append(doc_id)
                seen.add(token)

    def boolean_and(self, terms):
        """Intersect posting lists for AND search."""
        posting_lists = []
        for term in terms:
            term = term.lower()
            if term not in self.index:
                return []  # If any term is missing, AND returns empty
            posting_lists.append(self.index[term])

        if not posting_lists:
            return []

        # Sort by length (optimization: start with shortest list)
        posting_lists.sort(key=len)
        result = posting_lists[0]
        for pl in posting_lists[1:]:
            result = self._intersect(result, pl)
        return result

    def boolean_or(self, terms):
        """Union posting lists for OR search."""
        result = []
        for term in terms:
            term = term.lower()
            if term in self.index:
                result = self._union(result, self.index[term])
        return result

    def _intersect(self, a, b):
        """Merge-intersect two sorted lists in O(n+m)."""
        result = []
        i = j = 0
        while i < len(a) and j < len(b):
            if a[i] == b[j]:
                result.append(a[i])
                i += 1
                j += 1
            elif a[i] < b[j]:
                i += 1
            else:
                j += 1
        return result

    def _union(self, a, b):
        """Merge-union two sorted lists in O(n+m)."""
        result = []
        i = j = 0
        while i < len(a) and j < len(b):
            if a[i] == b[j]:
                result.append(a[i])
                i += 1
                j += 1
            elif a[i] < b[j]:
                result.append(a[i])
                i += 1
            else:
                result.append(b[j])
                j += 1
        result.extend(a[i:])
        result.extend(b[j:])
        return result

    def stats(self):
        total_postings = sum(len(pl) for pl in self.index.values())
        return {
            'documents': self.doc_count,
            'unique_terms': len(self.index),
            'total_postings': total_postings,
            'avg_postings_per_term': total_postings / len(self.index) if self.index else 0,
        }

# --- Demo ---
idx = InvertedIndex()
documents = {
    0: "machine learning is a branch of artificial intelligence",
    1: "deep learning uses neural networks with many layers",
    2: "data science combines statistics and machine learning",
    3: "neural networks are inspired by the brain",
    4: "natural language processing uses machine learning",
    5: "computer vision uses deep learning for images",
    6: "reinforcement learning teaches agents to make decisions",
    7: "statistics provides the foundation for data analysis",
}

for doc_id, text in documents.items():
    idx.add_document(doc_id, text)

print("=== Inverted Index Stats ===")
for k, v in idx.stats().items():
    print(f"  {k}: {v}")
print()

# Show some posting lists
print("=== Sample Posting Lists ===")
for term in ["machine", "learning", "neural", "data", "deep"]:
    print(f'  "{term}" -> {idx.index[term]}')
print()

# Boolean AND search
print("=== Boolean AND Search ===")
for query in [["machine", "learning"], ["neural", "networks"], ["deep", "learning", "images"]]:
    results = idx.boolean_and(query)
    print(f"  AND({query}) -> docs {results}")
    for doc_id in results:
        print(f"    [{doc_id}] {documents[doc_id]}")
print()

# Boolean OR search
print("=== Boolean OR Search ===")
for query in [["neural", "statistics"], ["deep", "reinforcement"]]:
    results = idx.boolean_or(query)
    print(f"  OR({query}) -> docs {results}")
`

const tfidfImplementation = `import re
import math
from collections import defaultdict

class TfIdfSearchEngine:
    def __init__(self):
        self.index = defaultdict(list)     # term -> [(doc_id, tf, positions)]
        self.doc_store = {}
        self.doc_lengths = {}
        self.doc_count = 0

    def tokenize(self, text):
        return re.findall(r'[a-z0-9]+', text.lower())

    def add_document(self, doc_id, text):
        self.doc_store[doc_id] = text
        self.doc_count += 1
        tokens = self.tokenize(text)
        self.doc_lengths[doc_id] = len(tokens)

        term_positions = defaultdict(list)
        for pos, token in enumerate(tokens):
            term_positions[token].append(pos)

        for term, positions in term_positions.items():
            tf = len(positions) / len(tokens)
            self.index[term].append((doc_id, tf, positions))

    def search(self, query, top_k=5):
        terms = self.tokenize(query)
        if not terms:
            return []

        scores = defaultdict(float)
        term_matches = defaultdict(list)

        for term in terms:
            postings = self.index.get(term, [])
            if not postings:
                continue

            # IDF: log(N / df)
            df = len(postings)
            idf = math.log(self.doc_count / df)

            for doc_id, tf, _ in postings:
                tfidf = tf * idf
                scores[doc_id] += tfidf
                term_matches[doc_id].append((term, tf, idf, tfidf))

        # Sort by score
        ranked = sorted(scores.items(), key=lambda x: -x[1])
        return [(doc_id, score, term_matches[doc_id]) for doc_id, score in ranked[:top_k]]

# --- Demo ---
engine = TfIdfSearchEngine()
documents = {
    0: "machine learning is a branch of artificial intelligence that learns from data",
    1: "deep learning uses neural networks with many layers to learn patterns from data",
    2: "data science combines statistics and machine learning to extract insights",
    3: "neural networks are inspired by the human brain and can learn patterns",
    4: "natural language processing uses machine learning to understand text",
    5: "computer vision uses deep learning to analyze images and visual data",
    6: "reinforcement learning teaches agents to make optimal decisions from rewards",
    7: "statistics provides the mathematical foundation for data analysis and learning",
}

for doc_id, text in documents.items():
    engine.add_document(doc_id, text)

print("=== TF-IDF Search Results ===\\n")

queries = ["machine learning data", "neural networks brain", "deep learning images", "statistics analysis"]
for query in queries:
    print(f'Query: "{query}"')
    print("-" * 50)
    results = engine.search(query)
    for rank, (doc_id, score, breakdown) in enumerate(results, 1):
        print(f"  #{rank} [doc {doc_id}] score={score:.4f}")
        print(f"       {documents[doc_id][:60]}...")
        for term, tf, idf, tfidf in breakdown:
            print(f"       - '{term}': tf={tf:.3f} * idf={idf:.3f} = {tfidf:.4f}")
    print()

# Show IDF values (rarity ranking)
print("=== Term Rarity (IDF) ===")
idf_values = {}
for term in engine.index:
    df = len(engine.index[term])
    idf_values[term] = math.log(engine.doc_count / df)
for term, idf in sorted(idf_values.items(), key=lambda x: -x[1])[:15]:
    df = len(engine.index[term])
    bar = "#" * int(idf * 10)
    print(f"  {term:20s} df={df} idf={idf:.3f} {bar}")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function InvertedIndex() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      {/* ---- Hero ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          When you search &quot;machine learning tutorial&quot; on Google, it returns results from
          billions of documents in under 200 milliseconds. The secret is the{' '}
          <strong className="text-indigo-400">inverted index</strong> — instead of scanning every document
          for your search terms, the engine has pre-built a map from every word to the list of documents
          containing that word.
        </p>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-sm">
            <strong>Forward index vs inverted index:</strong> a forward index maps document {'\u2192'} words
            (what you would get by reading each document). An inverted index maps word {'\u2192'} documents
            (the reverse). This inversion is what makes search fast: instead of scanning 10 million
            documents, look up 2-3 words and intersect their posting lists.
          </p>
        </div>
      </section>

      {/* ---- Section 1: Interactive Search ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Search: Index in Action</h2>
        <p className="text-gray-300 leading-relaxed">
          The left panel shows 8 documents. The right panel shows the inverted index — each term maps to
          a posting list of document IDs. Type a query and watch: the matching terms light up in{' '}
          <span className="text-yellow-400">yellow</span>, matched document IDs turn{' '}
          <span className="text-green-400">green</span>, and connecting lines show which documents
          are returned as results, ranked by TF-IDF score.
        </p>
        <SearchSketch />
      </section>

      {/* ---- Section 2: How It Works ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How Inverted Indexes Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-green-400 mb-2">Building the Index</h3>
            <p className="text-gray-300 text-sm">
              For each document: tokenize the text into words, normalize (lowercase, stem), and append
              the document ID to each word&apos;s posting list. Keep posting lists sorted by document ID
              for efficient intersection.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Posting List Intersection</h3>
            <p className="text-gray-300 text-sm">
              For AND queries, intersect posting lists using a merge algorithm. Two sorted lists of
              length m and n can be intersected in O(m+n). For &quot;machine AND learning&quot;, walk both lists
              simultaneously, outputting document IDs that appear in both.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-yellow-400 mb-2">TF-IDF Scoring</h3>
            <p className="text-gray-300 text-sm">
              Not all matches are equal. TF (term frequency) rewards documents that mention the term often.
              IDF (inverse document frequency) rewards rare terms. &quot;the&quot; appears in every document
              (low IDF), while &quot;reinforcement&quot; appears in one (high IDF, more informative).
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-pink-400 mb-2">Skip Pointers</h3>
            <p className="text-gray-300 text-sm">
              For very long posting lists, skip pointers allow jumping ahead. If intersecting
              [1,3,5,7,9,11,...] with [8,10,...], skip pointers on the first list jump directly
              from 7 to 9 without checking 5 and 3. This reduces intersection time on long lists.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 3: TF-IDF Visualization ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">TF-IDF Score Breakdown</h2>
        <p className="text-gray-300 leading-relaxed">
          TF-IDF ranks documents by relevance. The score for document d and query q is:
          <span className="text-yellow-400"> score(d,q) = sum of TF(t,d) * IDF(t) for each term t in q</span>.
          Rare terms get high IDF, boosting their influence. Common terms get low IDF. The visualization
          below shows the per-term contribution to each document&apos;s score.
        </p>
        <TfIdfSketch />
      </section>

      {/* ---- Section 4: Real World ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Elasticsearch / Lucene</h3>
            <p className="text-gray-300 text-sm">
              Elasticsearch (built on Apache Lucene) is the most popular search engine library.
              It stores inverted indexes as immutable segments on disk, using skip lists for
              fast posting list intersection. Powers Wikipedia, GitHub code search, and Stack Overflow.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Google Search</h3>
            <p className="text-gray-300 text-sm">
              Google&apos;s index spans hundreds of billions of web pages. The inverted index is
              distributed across thousands of machines. Each shard holds a portion of the index,
              and results are merged. PageRank and ML models layer on top of the base TF-IDF scoring.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Database Full-Text Search</h3>
            <p className="text-gray-300 text-sm">
              PostgreSQL&apos;s <code className="text-cyan-400">tsvector</code> and{' '}
              <code className="text-cyan-400">tsquery</code> types implement an inverted index.
              MySQL has FULLTEXT indexes. Both use posting lists with position information for
              phrase queries like &quot;machine learning&quot; (words must be adjacent).
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Code Search</h3>
            <p className="text-gray-300 text-sm">
              GitHub&apos;s code search indexes 200M+ repositories using a trigram-based inverted index.
              Instead of indexing whole words, it indexes 3-character sequences. This supports
              substring matching and regex-like patterns across all public code.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: Inverted Index ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: Inverted Index with Boolean Search</h2>
        <p className="text-gray-300 leading-relaxed">
          Build an inverted index from scratch. The implementation includes posting list construction,
          sorted-merge intersection (AND), and union (OR) operations. The intersection algorithm
          runs in O(m+n) by walking both sorted lists simultaneously.
        </p>
        <PythonCell defaultCode={indexImplementation} />
      </section>

      {/* ---- Python: TF-IDF ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: TF-IDF Ranking Engine</h2>
        <p className="text-gray-300 leading-relaxed">
          Extend the inverted index with TF-IDF scoring. Each posting entry stores term frequency
          and position information. Search results are ranked by the sum of TF*IDF across all
          query terms, with per-term breakdown showing how rare terms contribute more to the score.
        </p>
        <PythonCell defaultCode={tfidfImplementation} />
      </section>

      {/* ---- Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">Inverted Index</th>
                <th className="text-left py-2 text-white">Full Scan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Index build</td>
                <td className="py-2 pr-4 text-yellow-400">O(n * L) one-time</td>
                <td className="py-2 text-emerald-400">None needed</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Single term lookup</td>
                <td className="py-2 pr-4 text-emerald-400">O(1) + O(k) for k results</td>
                <td className="py-2 text-red-400">O(n * L)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">AND of 2 terms</td>
                <td className="py-2 pr-4 text-emerald-400">O(p1 + p2) merge</td>
                <td className="py-2 text-red-400">O(n * L)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Ranked search (TF-IDF)</td>
                <td className="py-2 pr-4 text-emerald-400">O(sum of posting lengths)</td>
                <td className="py-2 text-red-400">O(n * L)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Space</td>
                <td className="py-2 pr-4 text-yellow-400">O(total tokens)</td>
                <td className="py-2 text-emerald-400">O(n * L)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-sm italic">n = number of documents, L = average document length, p = posting list length, k = results returned</p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>An inverted index maps each term to a sorted list of document IDs (posting list)</li>
          <li>Boolean AND search intersects posting lists in O(m+n) using a merge algorithm</li>
          <li>TF-IDF scoring ranks documents: rare terms (high IDF) carry more weight than common ones</li>
          <li>Skip pointers on posting lists accelerate intersection of very long lists</li>
          <li>Real engines (Elasticsearch, Google) add positional indexes for phrase queries, compression for disk efficiency, and ML for ranking</li>
          <li>The inverted index is the most important data structure in information retrieval — every search engine uses one</li>
        </ul>
      </section>
    </div>
  )
}
