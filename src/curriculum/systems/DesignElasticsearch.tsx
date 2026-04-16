import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-elasticsearch',
  title: 'Design Elasticsearch',
  description:
    'System design case study: distributed full-text search engine with inverted indices, scatter-gather queries, near-real-time indexing, and segment merging',
  track: 'systems',
  order: 19,
  tags: [
    'system-design',
    'elasticsearch',
    'search',
    'inverted-index',
    'distributed-systems',
    'full-text-search',
    'lucene',
  ],
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: [number, number, number],
  strokeColor: [number, number, number],
  label: string,
  labelSize = 10,
) {
  p.fill(fillColor[0], fillColor[1], fillColor[2])
  p.stroke(strokeColor[0], strokeColor[1], strokeColor[2])
  p.strokeWeight(1.5)
  p.rect(x - w / 2, y - h / 2, w, h, 6)
  p.fill(255)
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(labelSize)
  const lines = label.split('\n')
  for (let i = 0; i < lines.length; i++) {
    p.text(lines[i], x, y + (i - (lines.length - 1) / 2) * (labelSize + 2))
  }
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
  weight = 1.5,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 7
  p.stroke(color[0], color[1], color[2], color[3])
  p.strokeWeight(weight)
  p.line(x1, y1, x2, y2)
  p.fill(color[0], color[1], color[2], color[3])
  p.noStroke()
  p.triangle(
    x2,
    y2,
    x2 - headLen * Math.cos(angle - 0.35),
    y2 - headLen * Math.sin(angle - 0.35),
    x2 - headLen * Math.cos(angle + 0.35),
    y2 - headLen * Math.sin(angle + 0.35),
  )
}

function drawDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
  size = 6,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

/* ================================================================== */
/*  Section 1 — Problem Statement & Requirements                       */
/* ================================================================== */

function ProblemSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a distributed full-text search engine like Elasticsearch that can index billions of documents
        and return relevant search results in milliseconds. The system must support complex queries (boolean logic,
        fuzzy matching, range filters, aggregations), scale horizontally to petabytes of data, and provide
        near-real-time search where newly indexed documents become searchable within 1 second.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Index documents (arbitrary JSON) into named indices</li>
        <li>Full-text search with relevance ranking (TF-IDF / BM25)</li>
        <li>Boolean queries: must, should, must_not clauses</li>
        <li>Filters: term, range, geo, exists</li>
        <li>Aggregations: terms, histogram, date_histogram, stats</li>
        <li>Fuzzy matching and autocomplete/suggest</li>
        <li>Near-real-time indexing (searchable within 1 second)</li>
        <li>Multi-tenancy via separate indices</li>
        <li>Bulk indexing API for batch operations</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Sub-100ms search latency at p99</li>
        <li>10,000 searches per second per cluster</li>
        <li>Index 50,000 documents per second</li>
        <li>Horizontal scaling to petabytes of data</li>
        <li>High availability with automatic failover</li>
        <li>Near-real-time: indexed documents searchable within 1 second</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Back-of-Envelope Calculations                          */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">2. Back-of-Envelope Calculations</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Data Volume</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10 billion documents, average size 1KB = 10TB raw data</li>
          <li>Inverted index overhead: ~50% of raw data = 5TB</li>
          <li>Doc values (columnar store for sorting/aggregation): ~50% = 5TB</li>
          <li>Stored fields (original document): 10TB</li>
          <li>Total with 1 replica: (10 + 5 + 5 + 10) x 2 = 60TB</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Shard Sizing</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Target shard size: 30-50GB (Elasticsearch best practice)</li>
          <li>30TB primary data / 50GB per shard = 600 primary shards</li>
          <li>With 1 replica: 1,200 total shards</li>
          <li>At ~20 shards per node: 60 data nodes minimum</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Search Throughput</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10K searches/sec, each hitting ~10 shards (one index) = 100K shard-level queries/sec</li>
          <li>60 nodes handle ~1,700 shard queries/sec each {'\u2014'} well within capacity</li>
          <li>Replicas can serve reads, effectively doubling read capacity</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Indexing Throughput</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>50K docs/sec x 1KB = 50 MB/sec ingest rate</li>
          <li>With replication: 100 MB/sec total write I/O</li>
          <li>Each node handles ~1.7 MB/sec writes {'\u2014'} SSD easily handles this</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — API Design                                             */
/* ================================================================== */

function APISection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">3. API Design</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">PUT /{'<index>'}/_doc/{'<id>'}</code>
          <p className="text-gray-400 text-sm mt-1">
            Index a single document. Body is JSON. If the document exists, it is replaced (versioned).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /{'<index>'}/_search</code>
          <p className="text-gray-400 text-sm mt-1">
            Search with Query DSL. Supports bool (must/should/must_not), match, term, range, fuzzy, wildcard.
            Returns hits with _score, _source, and optional aggregations.
          </p>
          <pre className="text-gray-500 text-xs mt-2 bg-gray-900 p-2 rounded">{`{
  "query": {
    "bool": {
      "must": [{ "match": { "title": "elasticsearch" } }],
      "filter": [{ "range": { "date": { "gte": "2024-01-01" } } }]
    }
  },
  "size": 10,
  "aggs": { "by_author": { "terms": { "field": "author.keyword" } } }
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /{'<index>'}/_doc/{'<id>'}</code>
          <p className="text-gray-400 text-sm mt-1">
            Retrieve a single document by ID. O(1) lookup via the doc ID {'\u2192'} shard routing.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /_bulk</code>
          <p className="text-gray-400 text-sm mt-1">
            Batch indexing. Newline-delimited JSON (NDJSON). Each pair of lines is an action + document.
            10-100x more efficient than single-document indexing due to reduced HTTP overhead.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">PUT /{'<index>'}/_mapping</code>
          <p className="text-gray-400 text-sm mt-1">
            Define or update the index mapping (schema). Field types: text (analyzed, full-text searchable),
            keyword (exact match), integer, date, geo_point, nested, object.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /{'<index>'}/_settings</code>
          <p className="text-gray-400 text-sm mt-1">
            Index settings: number_of_shards (immutable after creation), number_of_replicas (adjustable),
            refresh_interval, analysis settings (tokenizers, filters).
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Data Model                                             */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">4. Data Model</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Index</h4>
          <p className="text-gray-300 text-sm">
            Analogous to a database. Contains a set of documents that share a mapping (schema).
            An index is split into shards for distribution. Examples: "products", "logs-2024-03-15",
            "user-events".
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Mapping (Schema)</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  "properties": {
    "title": { "type": "text",
               "analyzer": "standard" },
    "author": { "type": "keyword" },
    "body":   { "type": "text" },
    "date":   { "type": "date" },
    "views":  { "type": "integer" },
    "location": { "type": "geo_point" },
    "tags":   { "type": "keyword" }
  }
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Inverted Index</h4>
          <p className="text-gray-300 text-sm">
            The core data structure for full-text search. Maps each unique term to a posting list:
            the set of document IDs containing that term, plus term frequency and field positions.
          </p>
          <pre className="text-gray-300 text-xs leading-relaxed mt-2">{`Term         Posting List
"search"  -> [doc1, doc3, doc7, doc12]
"engine"  -> [doc1, doc7, doc15]
"fast"    -> [doc3, doc7, doc12, doc20]`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Doc Values</h4>
          <p className="text-gray-300 text-sm">
            Column-oriented storage for sorting and aggregations. While the inverted index answers
            "which documents contain this term?", doc values answer "what is the value of this field
            for this document?" {'\u2014'} needed for sorting results and computing aggregations.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 border-l-4 border-indigo-500 rounded-r-lg p-4">
        <p className="text-white font-medium text-sm">Key insight: text vs. keyword fields</p>
        <p className="text-gray-300 text-sm mt-1">
          A "text" field is analyzed (tokenized, lowercased, stemmed) and stored in the inverted index
          for full-text search. A "keyword" field is stored as-is for exact matching, sorting, and aggregations.
          The string "Quick Brown Fox" as text becomes tokens ["quick", "brown", "fox"]; as keyword it stays
          "Quick Brown Fox". Most string fields need both: a "text" sub-field for search and a "keyword"
          sub-field for aggregations.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — High-Level Architecture (p5 animated)                  */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 500

    interface SearchMsg {
      progress: number
      phase: 'scatter' | 'gather'
      shardIdx: number
      color: [number, number, number]
    }
    const messages: SearchMsg[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Elasticsearch Cluster Architecture (Scatter-Gather)', canvasW / 2, 8)

      // Layout: client -> coordinating node -> 3 data nodes (each with shards)
      const clientX = canvasW * 0.08
      const coordX = canvasW * 0.30
      const clientY = 120

      // Data nodes
      const nodeXStart = canvasW * 0.55
      const nodeXEnd = canvasW * 0.95
      const nodeCount = 3
      const nodeW = (nodeXEnd - nodeXStart - 20) / nodeCount
      const nodeY = 80
      const nodeH = 350

      // Client
      drawBox(p, clientX, clientY, 70, 40, [30, 30, 50], [120, 120, 200], 'Client\nApp', 9)

      // Coordinating node
      drawBox(p, coordX, clientY, 90, 50, [30, 40, 30], [52, 211, 153], 'Coordinating\nNode', 9)

      drawArrow(p, clientX + 35, clientY, coordX - 45, clientY, [120, 120, 200, 160])

      // Data nodes with shards
      const shardColors: [number, number, number][] = [
        [99, 102, 241],
        [236, 72, 153],
        [220, 170, 60],
        [80, 200, 200],
        [150, 100, 255],
        [200, 100, 100],
      ]

      // 6 primary shards distributed across 3 nodes, plus replicas
      const shardAssignment = [
        // node 0: P0, P3, R1, R4
        [
          { id: 'P0', primary: true, color: shardColors[0] },
          { id: 'P3', primary: true, color: shardColors[3] },
          { id: 'R1', primary: false, color: shardColors[1] },
          { id: 'R4', primary: false, color: shardColors[4] },
        ],
        // node 1: P1, P4, R2, R5
        [
          { id: 'P1', primary: true, color: shardColors[1] },
          { id: 'P4', primary: true, color: shardColors[4] },
          { id: 'R2', primary: false, color: shardColors[2] },
          { id: 'R5', primary: false, color: shardColors[5] },
        ],
        // node 2: P2, P5, R0, R3
        [
          { id: 'P2', primary: true, color: shardColors[2] },
          { id: 'P5', primary: true, color: shardColors[5] },
          { id: 'R0', primary: false, color: shardColors[0] },
          { id: 'R3', primary: false, color: shardColors[3] },
        ],
      ]

      for (let n = 0; n < nodeCount; n++) {
        const nx = nodeXStart + n * (nodeW + 10) + nodeW / 2
        const ny = nodeY

        // Node box
        p.fill(20, 20, 35)
        p.stroke(80, 80, 120, 150)
        p.strokeWeight(1.5)
        p.rect(nx - nodeW / 2, ny, nodeW, nodeH, 6)

        // Node label
        p.fill(180)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Data Node ${n + 1}`, nx, ny + 6)

        // Draw shards
        const shards = shardAssignment[n]
        for (let s = 0; s < shards.length; s++) {
          const shard = shards[s]
          const sy = ny + 30 + s * 78
          const sw = nodeW - 16
          const sh = 68

          const alpha = shard.primary ? 1 : 0.4
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.globalAlpha = alpha
          p.fill(shard.color[0] * 0.15, shard.color[1] * 0.15, shard.color[2] * 0.15)
          p.stroke(shard.color[0], shard.color[1], shard.color[2], 150)
          p.strokeWeight(1)
          p.rect(nx - sw / 2, sy, sw, sh, 4)

          p.fill(255)
          p.noStroke()
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(shard.id, nx, sy + 12)
          p.textSize(7)
          p.fill(180)
          p.text(shard.primary ? 'PRIMARY' : 'REPLICA', nx, sy + 24)

          // Mini inverted index representation
          p.fill(shard.color[0], shard.color[1], shard.color[2], 80)
          for (let bar = 0; bar < 5; bar++) {
            const bw = (sw - 20) * (0.3 + 0.7 * Math.abs(Math.sin(bar * 1.7 + s * 0.5)))
            p.rect(nx - sw / 2 + 8, sy + 36 + bar * 6, bw, 4, 1)
          }
          ctx.globalAlpha = 1
        }

        // Arrow from coordinating node to data node
        drawArrow(p, coordX + 45, clientY, nx - nodeW / 2, nodeY + nodeH / 2, [52, 211, 153, 100])
      }

      // Animated search messages
      if (Math.random() < 0.02) {
        for (let s = 0; s < nodeCount; s++) {
          messages.push({
            progress: 0,
            phase: 'scatter',
            shardIdx: s,
            color: [52, 211, 153],
          })
        }
      }

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        msg.progress += 0.015
        if (msg.progress >= 1) {
          if (msg.phase === 'scatter') {
            messages[i] = { progress: 0, phase: 'gather', shardIdx: msg.shardIdx, color: [99, 102, 241] }
          } else {
            messages.splice(i, 1)
          }
          continue
        }

        const nx = nodeXStart + msg.shardIdx * (nodeW + 10) + nodeW / 2
        if (msg.phase === 'scatter') {
          drawDot(p, coordX + 45, clientY, nx - nodeW / 2, nodeY + nodeH / 2, msg.progress, msg.color, 5)
        } else {
          drawDot(p, nx - nodeW / 2, nodeY + nodeH / 2, coordX + 45, clientY, msg.progress, msg.color, 5)
        }
      }

      // Labels
      p.fill(52, 211, 153, 150)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('scatter query', (coordX + nodeXStart) / 2, clientY - 30)
      p.fill(99, 102, 241, 150)
      p.text('gather results', (coordX + nodeXStart) / 2, clientY - 18)

      // Legend
      p.fill(180)
      p.textSize(8)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('P = Primary shard (handles writes + reads)  |  R = Replica shard (handles reads, provides fault tolerance)', 10, canvasH - 10)
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        An Elasticsearch cluster consists of multiple nodes. A <strong className="text-white">coordinating node</strong> receives
        search requests and routes them to the relevant shards using scatter-gather. Each index is split into
        <strong className="text-white"> primary shards</strong> (distributed across nodes) with <strong className="text-white">replica shards</strong> on
        different nodes for fault tolerance. The coordinating node merges results from all shards and returns the final response.
      </p>
      <P5Sketch sketch={sketch} />
      <p className="text-gray-400 text-sm italic">
        Green dots: search queries scattered to shards. Blue dots: results gathered back to the coordinating node.
        Each shard contains its own inverted index (shown as colored bars).
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Deep Dive: Inverted Index Internals (p5)               */
/* ================================================================== */

function InvertedIndexSection() {
  const [searchTerm, setSearchTerm] = useState('search')
  const termRef = useRef(searchTerm)
  termRef.current = searchTerm

  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 520

    // Sample documents
    const docs = [
      { id: 1, text: 'Elasticsearch is a distributed search engine' },
      { id: 2, text: 'Search engines use inverted indices for fast lookup' },
      { id: 3, text: 'Distributed systems scale horizontally across nodes' },
      { id: 4, text: 'Full text search with relevance ranking is fast' },
      { id: 5, text: 'The engine indexes documents in near real time' },
    ]

    // Simple tokenizer: lowercase + split
    const stopWords = new Set(['is', 'a', 'the', 'for', 'in', 'with', 'use', 'across'])
    function tokenize(text: string): string[] {
      return text.toLowerCase().split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1)
    }

    // Build inverted index
    const invertedIndex: Record<string, number[]> = {}
    for (const doc of docs) {
      const tokens = tokenize(doc.text)
      for (const token of tokens) {
        if (!invertedIndex[token]) invertedIndex[token] = []
        if (!invertedIndex[token].includes(doc.id)) invertedIndex[token].push(doc.id)
      }
    }

    const allTerms = Object.keys(invertedIndex).sort()

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      const term = termRef.current.toLowerCase()

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Inverted Index: Document Indexing & Search', canvasW / 2, 8)

      // ---- Left: Documents ----
      const docX = canvasW * 0.02
      const docW = canvasW * 0.30
      p.fill(180)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Documents', docX, 35)

      const matchedDocIds = invertedIndex[term] || []

      for (let i = 0; i < docs.length; i++) {
        const dy = 55 + i * 56
        const isMatch = matchedDocIds.includes(docs[i].id)
        p.fill(isMatch ? 30 : 20, isMatch ? 40 : 20, isMatch ? 30 : 35)
        p.stroke(isMatch ? 52 : 60, isMatch ? 211 : 60, isMatch ? 153 : 60, isMatch ? 200 : 80)
        p.strokeWeight(1)
        p.rect(docX, dy, docW, 46, 4)

        p.fill(isMatch ? 52 : 100, isMatch ? 211 : 100, isMatch ? 153 : 100)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Doc ${docs[i].id}`, docX + 6, dy + 4)

        // Highlight matching terms in the text
        const words = docs[i].text.split(' ')
        let wx = docX + 6
        const wy = dy + 18
        p.textSize(7)
        for (const word of words) {
          const isTermMatch = word.toLowerCase().replace(/[^a-z]/g, '').startsWith(term)
          p.fill(isTermMatch ? 255 : 160, isTermMatch ? 255 : 160, isTermMatch ? 100 : 160)
          if (isTermMatch) {
            p.fill(255, 220, 50)
          }
          p.text(word, wx, wy)
          wx += p.textWidth(word) + 4
          if (wx > docX + docW - 10) { wx = docX + 6 }
        }
      }

      // ---- Middle: Analyzer pipeline ----
      const analyzerX = docX + docW + 20
      const analyzerW = canvasW * 0.15
      p.fill(180)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Analyzer Pipeline', analyzerX, 35)

      const analyzerSteps = ['Tokenize', 'Lowercase', 'Stop Words', 'Stemming']
      const analyzerColors: [number, number, number][] = [
        [99, 102, 241],
        [80, 160, 255],
        [220, 170, 60],
        [236, 72, 153],
      ]
      for (let i = 0; i < analyzerSteps.length; i++) {
        const ay = 60 + i * 70
        drawBox(p, analyzerX + analyzerW / 2, ay + 20, analyzerW - 8, 32,
          [analyzerColors[i][0] * 0.15, analyzerColors[i][1] * 0.15, analyzerColors[i][2] * 0.15],
          analyzerColors[i], analyzerSteps[i], 8)
        if (i < analyzerSteps.length - 1) {
          drawArrow(p, analyzerX + analyzerW / 2, ay + 36, analyzerX + analyzerW / 2, ay + 58,
            [analyzerColors[i][0], analyzerColors[i][1], analyzerColors[i][2], 120])
        }
      }

      // Example: show analyzer on search term
      p.fill(120)
      p.textSize(7)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`"${term}" ${'\u2192'} ["${term}"]`, analyzerX + 4, 348)

      // ---- Right: Inverted Index ----
      const indexX = analyzerX + analyzerW + 20
      p.fill(180)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Inverted Index', indexX, 35)

      const maxVisible = Math.min(allTerms.length, 16)
      const rowH = 26
      for (let i = 0; i < maxVisible; i++) {
        const iy = 55 + i * rowH
        const t2 = allTerms[i]
        const postings = invertedIndex[t2]
        const isMatch = t2 === term || t2.startsWith(term)

        // Term
        p.fill(isMatch ? 40 : 25, isMatch ? 35 : 25, isMatch ? 20 : 35)
        p.stroke(isMatch ? 220 : 50, isMatch ? 170 : 50, isMatch ? 60 : 50, isMatch ? 200 : 80)
        p.strokeWeight(1)
        p.rect(indexX, iy, 80, rowH - 4, 3)
        p.fill(isMatch ? 255 : 140, isMatch ? 220 : 140, isMatch ? 100 : 140)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(t2, indexX + 4, iy + (rowH - 4) / 2)

        // Arrow
        p.fill(80)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2192', indexX + 86, iy + (rowH - 4) / 2)

        // Posting list
        for (let j = 0; j < postings.length; j++) {
          const px = indexX + 96 + j * 30
          p.fill(isMatch ? 52 : 40, isMatch ? 211 : 40, isMatch ? 153 : 60, isMatch ? 200 : 80)
          p.noStroke()
          p.rect(px, iy + 2, 24, rowH - 8, 3)
          p.fill(255)
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`d${postings[j]}`, px + 12, iy + (rowH - 4) / 2)
        }
      }

      // Pulsing highlight on matched postings
      if (matchedDocIds.length > 0) {
        const pulseAlpha = 80 + 40 * Math.sin(t * 4)
        p.fill(52, 211, 153, pulseAlpha)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text(`"${term}" ${'\u2192'} documents: [${matchedDocIds.map(d => `d${d}`).join(', ')}]`, indexX, canvasH - 12)
      }
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: Inverted Index Internals</h2>
      <p className="text-gray-300 leading-relaxed">
        The inverted index is the heart of full-text search. When a document is indexed, it passes through an
        analyzer pipeline (tokenize {'\u2192'} lowercase {'\u2192'} remove stop words {'\u2192'} stem). The resulting tokens
        are added to the inverted index: a mapping from each term to the list of documents containing it.
        Search queries go through the same analyzer, then look up the posting lists to find matching documents.
      </p>
      <div className="flex items-center gap-4 mb-2">
        <label className="text-gray-300 text-sm">Search term:</label>
        {['search', 'fast', 'engine', 'distributed', 'index'].map(term => (
          <button key={term}
            onClick={() => setSearchTerm(term)}
            className={`px-3 py-1 rounded text-sm ${searchTerm === term ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {term}
          </button>
        ))}
      </div>
      <P5Sketch sketch={sketch} />
      <p className="text-gray-400 text-sm italic">
        Click different search terms to see how the inverted index looks up matching documents.
        Highlighted terms in documents match the search. The posting list shows which document IDs contain each term.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Deep Dive: Near-Real-Time Search (p5)                  */
/* ================================================================== */

function NRTSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 460

    interface DocEvent {
      x: number
      y: number
      targetX: number
      targetY: number
      progress: number
      label: string
      color: [number, number, number]
    }
    const docEvents: DocEvent[] = []

    // Segments
    const segments: { age: number; size: number; y: number; merged: boolean }[] = []
    let bufferCount = 0
    let refreshTimer = 0
    let flushTimer = 0
    let segmentMergeTimer = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      refreshTimer += 0.016
      flushTimer += 0.016
      segmentMergeTimer += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Near-Real-Time Search: Write Path', canvasW / 2, 8)

      // Layout
      const writeX = canvasW * 0.06
      const bufferX = canvasW * 0.25
      const segmentX = canvasW * 0.50
      const diskX = canvasW * 0.75
      const translogX = canvasW * 0.25
      const pipeY = 100
      const translogY = 280
      const segmentAreaY = 80

      // ---- Write path ----
      drawBox(p, writeX, pipeY, 60, 36, [30, 30, 50], [120, 120, 200], 'Index\nRequest', 9)
      drawBox(p, bufferX, pipeY, 80, 50, [30, 40, 30], [52, 211, 153],
        `In-Memory\nBuffer\n(${bufferCount} docs)`, 8)
      drawBox(p, translogX, translogY, 80, 40, [50, 30, 20], [220, 170, 60], 'Translog\n(WAL)', 9)

      // Arrow: request -> buffer
      drawArrow(p, writeX + 30, pipeY, bufferX - 40, pipeY, [120, 120, 200, 160])
      // Arrow: request -> translog
      drawArrow(p, writeX + 30, pipeY + 18, translogX - 40, translogY, [220, 170, 60, 120])

      p.fill(180)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('write-ahead log\n(durability)', (writeX + translogX) / 2 - 20, (pipeY + translogY) / 2)

      // ---- Refresh: buffer -> new segment ----
      if (refreshTimer >= 2 && bufferCount > 0) {
        segments.push({
          age: 0,
          size: bufferCount,
          y: segmentAreaY + segments.length * 45,
          merged: false,
        })
        bufferCount = 0
        refreshTimer = 0
      }

      // Refresh label
      const refreshProgress = Math.min(1, refreshTimer / 2)
      p.fill(52, 211, 153, 120)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text(`Refresh in ${(2 - refreshTimer).toFixed(1)}s`, bufferX, pipeY + 35)

      // Refresh progress bar
      p.fill(40, 40, 40)
      p.rect(bufferX - 30, pipeY + 44, 60, 4, 2)
      p.fill(52, 211, 153)
      p.rect(bufferX - 30, pipeY + 44, 60 * refreshProgress, 4, 2)

      // ---- Segments (searchable) ----
      p.fill(180)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Segments (searchable)', segmentX - 20, 38)

      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i]
        seg.age += 0.016
        const sy = 60 + i * 45
        const segW = Math.min(120, 40 + seg.size * 15)

        if (seg.merged) {
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.globalAlpha = Math.max(0, 1 - seg.age * 0.5)
          if (ctx.globalAlpha <= 0) { segments.splice(i, 1); continue }
        }

        p.fill(seg.merged ? 50 : 25, 25, seg.merged ? 25 : 40)
        p.stroke(seg.merged ? 100 : 99, seg.merged ? 60 : 102, seg.merged ? 60 : 241, 150)
        p.strokeWeight(1)
        p.rect(segmentX, sy, segW, 36, 4)

        p.fill(255)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Seg ${i} (${seg.size} docs)`, segmentX + segW / 2, sy + 12)

        if (seg.merged) {
          p.fill(236, 72, 153)
          p.text('MERGING...', segmentX + segW / 2, sy + 26)
        } else {
          p.fill(52, 211, 153)
          p.text('SEARCHABLE', segmentX + segW / 2, sy + 26)
        }

        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.globalAlpha = 1
      }

      // ---- Segment merge ----
      if (segmentMergeTimer > 8 && segments.filter(s => !s.merged).length >= 3) {
        // Merge the 2 oldest non-merged segments
        let merged = 0
        let totalSize = 0
        for (const seg of segments) {
          if (!seg.merged && merged < 2) {
            seg.merged = true
            seg.age = 0
            totalSize += seg.size
            merged++
          }
        }
        if (totalSize > 0) {
          segments.push({
            age: 0,
            size: totalSize,
            y: segmentAreaY + segments.length * 45,
            merged: false,
          })
        }
        segmentMergeTimer = 0
      }

      // ---- Flush to disk ----
      const diskY = translogY
      drawBox(p, diskX, diskY, 80, 40, [40, 30, 50], [150, 100, 255], 'Disk\n(Lucene files)', 9)

      if (flushTimer > 6) {
        // Flash to indicate flush
        const flashAlpha = Math.max(0, 1 - (flushTimer - 6) * 2)
        p.fill(150, 100, 255, flashAlpha * 100)
        p.noStroke()
        p.rect(diskX - 50, diskY - 30, 100, 60, 6)
        if (flushTimer > 7) flushTimer = 0
      }

      drawArrow(p, segmentX + 60, 60 + segments.length * 20, diskX - 40, diskY - 10, [150, 100, 255, 80])

      p.fill(150, 100, 255, 120)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('flush (periodic)', (segmentX + diskX) / 2, diskY - 40)

      // ---- Spawn doc events ----
      if (Math.random() < 0.04) {
        bufferCount++
        docEvents.push({
          x: writeX + 30, y: pipeY,
          targetX: bufferX - 40, targetY: pipeY,
          progress: 0,
          label: 'doc',
          color: [99, 102, 241],
        })
      }

      for (let i = docEvents.length - 1; i >= 0; i--) {
        const ev = docEvents[i]
        ev.progress += 0.03
        if (ev.progress >= 1) { docEvents.splice(i, 1); continue }
        drawDot(p, ev.x, ev.y, ev.targetX, ev.targetY, ev.progress, ev.color, 5)
      }

      // Timeline labels
      p.fill(120)
      p.textSize(8)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Documents are NOT searchable until the next refresh (every 1s in production, 2s here for visibility)', 10, canvasH - 28)
      p.text('Translog provides durability: if the node crashes, uncommitted docs are replayed from the translog', 10, canvasH - 12)
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: Near-Real-Time Search</h2>
      <p className="text-gray-300 leading-relaxed">
        Elasticsearch achieves "near-real-time" search through a clever write path. Documents are first written to an
        in-memory buffer and a translog (write-ahead log for durability). Every 1 second, a <strong className="text-white">refresh</strong> operation
        creates a new Lucene segment from the buffer, making those documents searchable. Periodically, segments are
        merged in the background to reduce the number of files and reclaim space from deleted documents.
      </p>
      <P5Sketch sketch={sketch} />
      <div className="bg-gray-800 border-l-4 border-yellow-500 rounded-r-lg p-4">
        <p className="text-white font-medium text-sm">Why not flush to disk on every write?</p>
        <p className="text-gray-300 text-sm mt-1">
          An fsync to disk takes 10-30ms. At 50K docs/sec, synchronous flushing would be impossibly slow.
          Instead, Elasticsearch batches writes in memory and relies on the translog for crash recovery.
          The translog is append-only (sequential I/O, very fast) while segment creation involves building
          inverted index data structures. The refresh interval is the tradeoff knob: shorter = faster search
          visibility, longer = better indexing throughput.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Deep Dive: Distributed Search (p5)                     */
/* ================================================================== */

function DistributedSearchSection() {
  const [phase, setPhase] = useState<'idle' | 'query' | 'fetch'>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 460
    let autoPhase: 'idle' | 'query' | 'fetch' = 'idle'
    let phaseTimer = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      phaseTimer += 0.016
      p.background(15, 15, 25)

      // Use external phase or auto-cycle
      const externalPhase = phaseRef.current
      if (externalPhase !== 'idle') {
        autoPhase = externalPhase
        phaseTimer = 0.5
      } else {
        // Auto-cycle
        if (phaseTimer > 4) {
          if (autoPhase === 'idle') { autoPhase = 'query'; phaseTimer = 0 }
          else if (autoPhase === 'query') { autoPhase = 'fetch'; phaseTimer = 0 }
          else { autoPhase = 'idle'; phaseTimer = 0 }
        }
      }

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Two-Phase Distributed Search (Scatter-Gather)', canvasW / 2, 8)

      // Layout
      const coordX = canvasW * 0.12
      const coordY = 200
      const shardXStart = canvasW * 0.35
      const shardSpacing = canvasW * 0.22
      const shardY = 120
      const numShards = 3

      // Coordinating node
      drawBox(p, coordX, coordY, 80, 50, [30, 40, 30], [52, 211, 153], 'Coordinating\nNode', 9)

      // Shard results
      const shardResults = [
        ['doc7 (0.95)', 'doc3 (0.82)', 'doc1 (0.71)'],
        ['doc12 (0.91)', 'doc8 (0.78)', 'doc5 (0.65)'],
        ['doc15 (0.88)', 'doc9 (0.74)', 'doc2 (0.60)'],
      ]

      for (let s = 0; s < numShards; s++) {
        const sx = shardXStart + s * shardSpacing
        drawBox(p, sx, shardY, 100, 40, [25, 25, 40], [99, 102, 241], `Shard ${s}\n(inverted index)`, 8)

        // Show local results during query phase
        if (autoPhase === 'query' || autoPhase === 'fetch') {
          p.fill(30, 30, 45)
          p.stroke(60)
          p.strokeWeight(1)
          p.rect(sx - 55, shardY + 30, 110, 80, 4)

          p.fill(180)
          p.noStroke()
          p.textSize(7)
          p.textAlign(p.LEFT, p.TOP)
          p.text('Local top-3:', sx - 50, shardY + 34)
          for (let r = 0; r < shardResults[s].length; r++) {
            const isGlobalTop = (s === 0 && r === 0) || (s === 1 && r === 0) || (s === 2 && r === 0)
            p.fill(isGlobalTop && autoPhase === 'fetch' ? 52 : 140,
                   isGlobalTop && autoPhase === 'fetch' ? 211 : 140,
                   isGlobalTop && autoPhase === 'fetch' ? 153 : 140)
            p.text(shardResults[s][r], sx - 50, shardY + 48 + r * 14)
          }
        }

        // Arrows
        if (autoPhase === 'query' && phaseTimer < 2) {
          const prog = Math.min(1, phaseTimer * 0.8)
          drawDot(p, coordX + 40, coordY, sx, shardY + 20, prog, [52, 211, 153], 6)
        }
        if (autoPhase === 'query' && phaseTimer > 1.5) {
          const prog = Math.min(1, (phaseTimer - 1.5) * 0.8)
          drawDot(p, sx, shardY + 20, coordX + 40, coordY, prog, [99, 102, 241], 6)
        }
      }

      // Fetch phase
      if (autoPhase === 'fetch') {
        // Global merge result at coordinating node
        const mergeY = coordY + 60
        p.fill(30, 40, 30)
        p.stroke(52, 211, 153, 100)
        p.strokeWeight(1)
        p.rect(coordX - 55, mergeY, 110, 100, 4)

        p.fill(52, 211, 153)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Global top-3:', coordX - 50, mergeY + 4)
        const globalTop = ['doc7 (0.95)', 'doc12 (0.91)', 'doc15 (0.88)']
        for (let r = 0; r < globalTop.length; r++) {
          p.fill(255)
          p.text(`${r + 1}. ${globalTop[r]}`, coordX - 50, mergeY + 20 + r * 16)
        }

        p.fill(180)
        p.textSize(7)
        p.text('Fetch full docs from\nrelevant shards', coordX - 50, mergeY + 72)

        // Fetch arrows
        if (phaseTimer > 1) {
          for (let s = 0; s < numShards; s++) {
            const sx = shardXStart + s * shardSpacing
            const prog = Math.min(1, (phaseTimer - 1) * 0.6)
            drawDot(p, coordX + 40, mergeY + 30, sx, shardY + 50, prog, [220, 170, 60], 5)
          }
        }
        if (phaseTimer > 2.5) {
          for (let s = 0; s < numShards; s++) {
            const sx = shardXStart + s * shardSpacing
            const prog = Math.min(1, (phaseTimer - 2.5) * 0.6)
            drawDot(p, sx, shardY + 50, coordX + 40, mergeY + 30, prog, [52, 211, 153], 5)
          }
        }
      }

      // Phase indicator
      const phases = [
        { name: 'Idle', desc: 'Waiting for query' },
        { name: 'Query Phase', desc: 'Scatter query to shards, each returns top-N doc IDs + scores' },
        { name: 'Fetch Phase', desc: 'Merge scores globally, fetch full documents from relevant shards' },
      ]
      const activeIdx = autoPhase === 'idle' ? 0 : autoPhase === 'query' ? 1 : 2

      const phaseBarY = canvasH - 60
      for (let i = 0; i < phases.length; i++) {
        const px = canvasW * 0.1 + i * canvasW * 0.3
        const isActive = i === activeIdx
        p.fill(isActive ? 52 : 40, isActive ? 211 : 40, isActive ? 153 : 40)
        p.noStroke()
        p.ellipse(px, phaseBarY, 10, 10)
        p.fill(isActive ? 255 : 120)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(phases[i].name, px, phaseBarY + 8)
        if (isActive) {
          p.fill(180)
          p.textSize(7)
          p.text(phases[i].desc, px, phaseBarY + 22)
        }
        if (i < 2) {
          p.stroke(60)
          p.strokeWeight(1)
          p.line(px + 20, phaseBarY, px + canvasW * 0.3 - 20, phaseBarY)
          p.noStroke()
        }
      }
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Distributed Search</h2>
      <p className="text-gray-300 leading-relaxed">
        A search across a sharded index uses a two-phase scatter-gather pattern.
        In the <strong className="text-white">query phase</strong>, the coordinating node sends the query to every relevant shard.
        Each shard searches its local inverted index and returns the top-N document IDs with their scores (not the full documents).
        In the <strong className="text-white">fetch phase</strong>, the coordinating node merges scores to find the global top-N,
        then fetches the full documents only from the shards that hold those winning documents. This avoids transferring
        full document data from every shard.
      </p>
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setPhase('idle')}
          className={`px-3 py-1 rounded text-sm ${phase === 'idle' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
          Auto-cycle
        </button>
        <button onClick={() => setPhase('query')}
          className={`px-3 py-1 rounded text-sm ${phase === 'query' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
          Query Phase
        </button>
        <button onClick={() => setPhase('fetch')}
          className={`px-3 py-1 rounded text-sm ${phase === 'fetch' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
          Fetch Phase
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 — Scaling Strategy                                       */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">9. Scaling Strategy</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Horizontal Scaling: Add Nodes, Rebalance Shards</h4>
          <p className="text-gray-300 text-sm mt-1">
            When you add a new node to the cluster, Elasticsearch automatically rebalances shards.
            Some shards migrate from existing nodes to the new node, distributing data and query load
            more evenly. This is seamless {'\u2014'} no downtime, no manual intervention.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Time-Based Indices for Log Data</h4>
          <p className="text-gray-300 text-sm mt-1">
            For time-series data (logs, metrics), create one index per time period (e.g., logs-2024-03-15).
            Searches only hit indices within the queried time range. Old indices can be force-merged to a single
            segment (optimal read performance) since they receive no more writes.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Index Lifecycle Management (ILM)</h4>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Hot tier:</strong> NVMe SSDs, recent data, full replicas. Handles all writes and most searches.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Warm tier:</strong> SSD, read-only older data, reduced replicas. Force-merged for efficiency.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Cold tier:</strong> HDD or shared storage, rarely queried data. Searchable snapshots reduce cost further.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            ILM automates transitions: hot (7 days) {'\u2192'} warm (30 days) {'\u2192'} cold (90 days) {'\u2192'} delete (365 days).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Dedicated Node Roles</h4>
          <p className="text-gray-300 text-sm mt-1">
            Separate master-eligible nodes (cluster coordination, lightweight), coordinating-only nodes
            (query routing and result merging), and data nodes (heavy lifting: indexing and searching).
            This prevents a heavy search from starving cluster management operations.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 — Fault Tolerance                                       */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">10. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Replica Shards on Different Nodes</p>
          <p className="text-gray-300 text-sm mt-1">
            Every primary shard has one or more replicas placed on different nodes. If a node fails,
            the replica is promoted to primary. The cluster automatically creates new replicas on surviving
            nodes to maintain the configured replica count. Search availability is maintained throughout.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Translog for Crash Recovery</p>
          <p className="text-gray-300 text-sm mt-1">
            Every index operation is written to a translog (write-ahead log) before acknowledgement.
            On node restart, uncommitted operations are replayed from the translog to rebuild the
            in-memory buffer. This ensures zero data loss even if the node crashes before flushing
            segments to disk.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Split-Brain Prevention</p>
          <p className="text-gray-300 text-sm mt-1">
            In earlier versions, minimum_master_nodes prevented split-brain (two masters in a network partition).
            Elasticsearch 7+ uses a new cluster coordination layer that automatically determines quorum based
            on the known set of master-eligible nodes. A majority of master-eligible nodes must agree on the
            elected master, preventing split-brain by design.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Cluster Health Monitoring</p>
          <p className="text-gray-300 text-sm mt-1">
            Cluster health is reported as green (all shards allocated), yellow (all primaries allocated,
            some replicas missing), or red (some primaries unallocated). Yellow is degraded but functional.
            Red means data loss risk and requires immediate attention. The _cluster/health API is the
            first thing to check during an incident.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 — Tradeoffs                                             */
/* ================================================================== */

function TradeoffsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">11. Key Tradeoffs</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Indexing Speed vs. Search Speed</h4>
          <p className="text-gray-300 text-sm mt-1">
            More replicas = slower indexing (each document must be written to all replicas) but faster searches
            (more shards can serve reads in parallel). For write-heavy workloads (log ingestion), use
            fewer replicas during bulk loading, then increase replicas after. The refresh_interval setting
            also trades search freshness for indexing throughput: set to 30s or -1 during bulk loads.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Precision vs. Recall in Text Analysis</h4>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Aggressive stemming</strong> (e.g., "running" {'\u2192'} "run") increases recall (finds more results)
            but decreases precision (more false positives). A search for "running shoes" might match "run away from home."
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Conservative analysis</strong> preserves precision but misses related forms.
            The choice depends on the use case: e-commerce search favors precision; knowledge base search favors recall.
            Use synonyms, custom analyzers, and boosting to tune the balance.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Shard Count: Too Few vs. Too Many</h4>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Too few shards:</strong> Each shard is very large (100GB+). Recovery after node failure
            takes a long time. Cannot parallelize search across many shards. Hard to rebalance.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Too many shards:</strong> Each shard has overhead (file handles, memory for metadata,
            thread pool entries). Thousands of tiny shards waste resources and slow down cluster state management.
            The coordinating node must merge results from every shard, adding latency.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Sweet spot:</strong> 30-50GB per shard, plan for growth. Number of shards is immutable
            after index creation (requires reindexing to change), so plan carefully.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Denormalization vs. Joins</h4>
          <p className="text-gray-300 text-sm mt-1">
            Elasticsearch has no real joins. For related data (e.g., blog posts and comments), you either
            denormalize (embed comments inside the post document) or use nested/parent-child types.
            Denormalization is fast for reads but requires updating the entire document when a comment changes.
            Nested types add indexing overhead. Parent-child allows independent updates but is slower to query.
            The right choice depends on update frequency vs. query frequency.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignElasticsearch() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">
          Design Elasticsearch
        </h1>
        <p className="text-lg text-gray-400">
          A complete system design case study for a distributed full-text search engine {'\u2014'}
          covering inverted indices, scatter-gather distributed search, near-real-time indexing,
          segment merging, and scaling to petabytes of searchable data.
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <InvertedIndexSection />
      <NRTSection />
      <DistributedSearchSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
    </div>
  )
}
