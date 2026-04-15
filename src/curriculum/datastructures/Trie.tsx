import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/trie',
  title: 'Tries & Radix Trees: Prefix Matching',
  description:
    'Prefix trees for autocomplete, spell checking, and IP routing — learn how tries and radix trees enable lightning-fast prefix search',
  track: 'datastructures',
  order: 13,
  tags: ['trie', 'radix-tree', 'prefix', 'autocomplete', 'patricia', 'routing', 'search'],
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
/* Trie Data Structure for Visualization                               */
/* ------------------------------------------------------------------ */

interface TrieNode {
  children: Map<string, TrieNode>
  isEnd: boolean
  depth: number
  char: string
}

function createTrieNode(char: string, depth: number): TrieNode {
  return { children: new Map(), isEnd: false, depth, char }
}

interface TrieState {
  root: TrieNode
  words: string[]
}

function createTrie(): TrieState {
  return { root: createTrieNode('', 0), words: [] }
}

function trieInsert(trie: TrieState, word: string): void {
  let node = trie.root
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    if (!node.children.has(ch)) {
      node.children.set(ch, createTrieNode(ch, i + 1))
    }
    node = node.children.get(ch)!
  }
  node.isEnd = true
  if (!trie.words.includes(word)) {
    trie.words.push(word)
  }
}

function trieSearch(trie: TrieState, prefix: string): { path: TrieNode[]; completions: string[] } {
  const path: TrieNode[] = [trie.root]
  let node = trie.root
  for (let i = 0; i < prefix.length; i++) {
    const ch = prefix[i]
    if (!node.children.has(ch)) {
      return { path, completions: [] }
    }
    node = node.children.get(ch)!
    path.push(node)
  }
  const completions: string[] = []
  function collect(n: TrieNode, current: string): void {
    if (n.isEnd) completions.push(current)
    for (const [ch, child] of n.children) {
      collect(child, current + ch)
    }
  }
  collect(node, prefix)
  return { path, completions }
}

/* ------------------------------------------------------------------ */
/* Layout helpers for drawing tries                                    */
/* ------------------------------------------------------------------ */

interface NodeLayout {
  node: TrieNode
  x: number
  y: number
  parentX: number
  parentY: number
  label: string
}

function layoutTrie(root: TrieNode, cx: number, topY: number, width: number, levelH: number): NodeLayout[] {
  const result: NodeLayout[] = []

  function traverse(node: TrieNode, x: number, y: number, px: number, py: number, w: number, label: string): void {
    result.push({ node, x, y, parentX: px, parentY: py, label })
    const kids = Array.from(node.children.entries())
    if (kids.length === 0) return
    const slotW = w / kids.length
    let startX = x - w / 2 + slotW / 2
    for (const [ch, child] of kids) {
      traverse(child, startX, y + levelH, x, y, slotW, ch)
      startX += slotW
    }
  }

  traverse(root, cx, topY, width, 0, 0, 'root')
  return result
}

/* ------------------------------------------------------------------ */
/* Radix Tree helpers                                                  */
/* ------------------------------------------------------------------ */

interface RadixNode {
  label: string
  children: Map<string, RadixNode>
  isEnd: boolean
}

function createRadixNode(label: string, isEnd: boolean): RadixNode {
  return { label, children: new Map(), isEnd }
}

function radixInsert(root: RadixNode, word: string): void {
  if (word.length === 0) { root.isEnd = true; return }
  for (const [key, child] of root.children) {
    let common = 0
    while (common < key.length && common < word.length && key[common] === word[common]) {
      common++
    }
    if (common === 0) continue
    if (common === key.length) {
      radixInsert(child, word.slice(common))
      return
    }
    // Split the edge
    const newChild = createRadixNode(key.slice(common), child.isEnd)
    newChild.children = child.children
    root.children.delete(key)
    const splitNode = createRadixNode(key.slice(0, common), false)
    splitNode.children.set(key.slice(common), newChild)
    root.children.set(key.slice(0, common), splitNode)
    if (common < word.length) {
      const leaf = createRadixNode(word.slice(common), true)
      splitNode.children.set(word.slice(common), leaf)
    } else {
      splitNode.isEnd = true
    }
    return
  }
  root.children.set(word, createRadixNode(word, true))
}

function countRadixNodes(node: RadixNode): number {
  let count = 1
  for (const child of node.children.values()) {
    count += countRadixNodes(child)
  }
  return count
}

function countTrieNodes(node: TrieNode): number {
  let count = 1
  for (const child of node.children.values()) {
    count += countTrieNodes(child)
  }
  return count
}

interface RadixLayout {
  node: RadixNode
  x: number
  y: number
  parentX: number
  parentY: number
  edgeLabel: string
}

function layoutRadix(root: RadixNode, cx: number, topY: number, width: number, levelH: number): RadixLayout[] {
  const result: RadixLayout[] = []
  function traverse(node: RadixNode, x: number, y: number, px: number, py: number, w: number, eLabel: string): void {
    result.push({ node, x, y, parentX: px, parentY: py, edgeLabel: eLabel })
    const kids = Array.from(node.children.entries())
    if (kids.length === 0) return
    const slotW = w / kids.length
    let startX = x - w / 2 + slotW / 2
    for (const [, child] of kids) {
      traverse(child, startX, y + levelH, x, y, slotW, child.label)
      startX += slotW
    }
  }
  traverse(root, cx, topY, width, 0, 0, '')
  return result
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Trie Visualization                          */
/* ------------------------------------------------------------------ */

const DEFAULT_WORDS = ['apple', 'application', 'appetite', 'apply', 'apt', 'banana', 'band', 'ban']

function TrieSketch() {
  const [searchText, setSearchText] = useState('')
  const [newWord, setNewWord] = useState('')
  const [statusMsg, setStatusMsg] = useState('Type a prefix to search the trie')
  const [completions, setCompletions] = useState<string[]>([])

  const trieRef = useRef<TrieState>((() => {
    const t = createTrie()
    DEFAULT_WORDS.forEach(w => trieInsert(t, w))
    return t
  })())
  const searchPathRef = useRef<Set<TrieNode>>(new Set())
  const matchedWordsRef = useRef<Set<string>>(new Set())
  const animRef = useRef(0)
  const searchTextRef = useRef('')

  const handleSearch = useCallback((text: string) => {
    setSearchText(text)
    searchTextRef.current = text
    if (text.length === 0) {
      searchPathRef.current.clear()
      matchedWordsRef.current.clear()
      setCompletions([])
      setStatusMsg('Type a prefix to search the trie')
      return
    }
    const result = trieSearch(trieRef.current, text.toLowerCase())
    searchPathRef.current = new Set(result.path)
    matchedWordsRef.current = new Set(result.completions)
    setCompletions(result.completions)
    animRef.current = 90
    if (result.completions.length > 0) {
      setStatusMsg(`Found ${result.completions.length} word(s) with prefix "${text}"`)
    } else {
      setStatusMsg(`No words found with prefix "${text}"`)
    }
  }, [])

  const handleInsert = useCallback(() => {
    const w = newWord.trim().toLowerCase()
    if (w.length === 0) return
    trieInsert(trieRef.current, w)
    setStatusMsg(`Inserted "${w}" into the trie`)
    setNewWord('')
    animRef.current = 90
    // Re-run search so highlight updates
    if (searchTextRef.current.length > 0) {
      const result = trieSearch(trieRef.current, searchTextRef.current)
      searchPathRef.current = new Set(result.path)
      matchedWordsRef.current = new Set(result.completions)
      setCompletions(result.completions)
    }
  }, [newWord])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 500)
        p.textFont('monospace')
      }

      p.draw = () => {
        const ctx = p.drawingContext as CanvasRenderingContext2D

        p.background(...BG)

        // Draw subtle grid
        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        // Title
        p.noStroke()
        p.fill(...TEXT_C)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Interactive Trie', 20, 15)

        // Layout trie
        const layout = layoutTrie(trieRef.current.root, p.width / 2, 60, p.width - 80, 60)

        const activeSet = searchPathRef.current
        if (animRef.current > 0) animRef.current--

        // Draw edges
        for (const item of layout) {
          if (item.label === 'root') continue
          const isActive = activeSet.has(item.node)
          if (isActive) {
            p.stroke(...GREEN)
            p.strokeWeight(2.5)
          } else {
            p.stroke(...GRID_C)
            ctx.globalAlpha = 0.6
            p.strokeWeight(1)
          }
          p.line(item.parentX, item.parentY, item.x, item.y)
          ctx.globalAlpha = 1.0
        }

        // Draw nodes
        for (const item of layout) {
          const isActive = activeSet.has(item.node)
          const isEndWord = item.node.isEnd

          let col: [number, number, number] = ACCENT
          if (isActive && isEndWord && matchedWordsRef.current.size > 0) {
            col = YELLOW
          } else if (isActive) {
            col = GREEN
          } else if (isEndWord) {
            col = PINK
          }

          p.fill(...col)
          p.noStroke()
          const rad = item.label === 'root' ? 14 : 12
          p.ellipse(item.x, item.y, rad * 2, rad * 2)

          p.fill(255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(item.label === 'root' ? '*' : item.label, item.x, item.y)
        }

        // Draw completions panel
        if (completions.length > 0) {
          const panelX = 20
          const panelY = p.height - 20 - completions.length * 20 - 30
          p.fill(30, 41, 59, 220)
          p.noStroke()
          p.rect(panelX, panelY, 180, completions.length * 20 + 30, 8)
          p.fill(...CYAN)
          p.textSize(12)
          p.textAlign(p.LEFT, p.TOP)
          p.text('Completions:', panelX + 10, panelY + 8)
          for (let i = 0; i < completions.length; i++) {
            p.fill(...GREEN)
            p.text(completions[i], panelX + 10, panelY + 28 + i * 20)
          }
        }

        // Draw word count
        p.fill(...TEXT_C)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`Words: ${trieRef.current.words.length}  |  Nodes: ${countTrieNodes(trieRef.current.root)}`, p.width - 20, 15)
      }
    },
    [completions]
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchText}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Type prefix to search..."
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-52 focus:border-indigo-500 outline-none"
        />
        <input
          type="text"
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInsert()}
          placeholder="Insert new word..."
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-44 focus:border-indigo-500 outline-none"
        />
        <button onClick={handleInsert} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          Insert
        </button>
      </div>
      <div className="text-sm text-gray-400">{statusMsg}</div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Trie vs Radix Tree Side-by-Side                         */
/* ------------------------------------------------------------------ */

const RADIX_WORDS = ['apple', 'application', 'appetite', 'apply', 'apt', 'banana', 'band', 'ban']

function RadixCompareSketch() {
  const trieRef = useRef<TrieState>((() => {
    const t = createTrie()
    RADIX_WORDS.forEach(w => trieInsert(t, w))
    return t
  })())
  const radixRef = useRef<RadixNode>((() => {
    const r = createRadixNode('', false)
    RADIX_WORDS.forEach(w => radixInsert(r, w))
    return r
  })())

  const trieCount = countTrieNodes(trieRef.current.root)
  const radixCount = countRadixNodes(radixRef.current)

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 480)
        p.textFont('monospace')
      }

      p.draw = () => {
        p.background(...BG)

        p.stroke(...GRID_C)
        p.strokeWeight(0.5)
        for (let x = 0; x < p.width; x += 40) p.line(x, 0, x, p.height)
        for (let y = 0; y < p.height; y += 40) p.line(0, y, p.width, y)

        // Divider
        p.stroke(...GRID_C)
        p.strokeWeight(2)
        p.line(p.width / 2, 30, p.width / 2, p.height - 10)

        // Headers
        p.noStroke()
        p.fill(...CYAN)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`Standard Trie  (${trieCount} nodes)`, p.width / 4, 10)
        p.fill(...ORANGE)
        p.text(`Radix Tree  (${radixCount} nodes)`, (p.width * 3) / 4, 10)

        // Savings badge
        const saved = trieCount - radixCount
        p.fill(...GREEN)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${saved} nodes saved (${((saved / trieCount) * 100).toFixed(0)}% reduction)`, p.width / 2, p.height - 25)

        // Draw trie side
        const trieLayout = layoutTrie(trieRef.current.root, p.width / 4, 55, p.width / 2 - 60, 50)
        for (const item of trieLayout) {
          if (item.label !== 'root') {
            p.stroke(...ACCENT)
            p.strokeWeight(1)
            p.line(item.parentX, item.parentY, item.x, item.y)
          }
        }
        for (const item of trieLayout) {
          p.noStroke()
          p.fill(item.node.isEnd ? [...PINK] : [...ACCENT])
          p.ellipse(item.x, item.y, 18, 18)
          p.fill(255)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(item.label === 'root' ? '*' : item.label, item.x, item.y)
        }

        // Draw radix side
        const radixLayout = layoutRadix(radixRef.current, (p.width * 3) / 4, 55, p.width / 2 - 60, 70)
        for (const item of radixLayout) {
          if (item.edgeLabel !== '') {
            p.stroke(...ORANGE)
            p.strokeWeight(1.5)
            p.line(item.parentX, item.parentY, item.x, item.y)
            // Edge label
            p.noStroke()
            p.fill(...YELLOW)
            p.textSize(9)
            p.textAlign(p.CENTER, p.CENTER)
            const mx = (item.parentX + item.x) / 2
            const my = (item.parentY + item.y) / 2
            p.text(item.edgeLabel, mx, my - 8)
          }
        }
        for (const item of radixLayout) {
          p.noStroke()
          p.fill(item.node.isEnd ? [...PINK] : [...ORANGE])
          p.ellipse(item.x, item.y, 18, 18)
          p.fill(255)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(item.node.isEnd ? '\u2713' : '\u25CF', item.x, item.y)
        }
      }
    },
    [trieCount, radixCount]
  )

  return <P5Sketch sketch={sketch} />
}

/* ------------------------------------------------------------------ */
/* Section 3 — IP Routing Longest Prefix Match                         */
/* ------------------------------------------------------------------ */

interface BinaryTrieNode {
  children: [BinaryTrieNode | null, BinaryTrieNode | null]
  route: string | null
}

function createBinaryTrieNode(): BinaryTrieNode {
  return { children: [null, null], route: null }
}

interface RoutingEntry {
  prefix: string
  mask: number
  binary: string
  route: string
}

function ipToBinary(ip: string): string {
  return ip
    .split('.')
    .map(o => parseInt(o).toString(2).padStart(8, '0'))
    .join('')
}

function insertRoute(root: BinaryTrieNode, entry: RoutingEntry): void {
  let node = root
  const bits = entry.binary.slice(0, entry.mask)
  for (let i = 0; i < bits.length; i++) {
    const bit = parseInt(bits[i])
    if (node.children[bit] === null) {
      node.children[bit] = createBinaryTrieNode()
    }
    node = node.children[bit]!
  }
  node.route = entry.route
}

function longestPrefixMatch(root: BinaryTrieNode, ip: string): { matchedRoute: string | null; path: number[]; matchDepth: number } {
  const bits = ipToBinary(ip)
  let node = root
  const path: number[] = []
  let matchedRoute: string | null = null
  let matchDepth = 0
  if (node.route) { matchedRoute = node.route; matchDepth = 0 }
  for (let i = 0; i < bits.length; i++) {
    const bit = parseInt(bits[i])
    path.push(bit)
    if (node.children[bit] === null) break
    node = node.children[bit]!
    if (node.route !== null) {
      matchedRoute = node.route
      matchDepth = i + 1
    }
  }
  return { matchedRoute, path, matchDepth }
}

const ROUTING_TABLE: RoutingEntry[] = [
  { prefix: '10.0.0.0', mask: 8, binary: ipToBinary('10.0.0.0'), route: 'Gateway A' },
  { prefix: '10.1.0.0', mask: 16, binary: ipToBinary('10.1.0.0'), route: 'Gateway B' },
  { prefix: '10.1.1.0', mask: 24, binary: ipToBinary('10.1.1.0'), route: 'Gateway C' },
  { prefix: '192.168.0.0', mask: 16, binary: ipToBinary('192.168.0.0'), route: 'Gateway D' },
]

function IPRoutingSketch() {
  const [lookupIP, setLookupIP] = useState('10.1.1.42')
  const [matchResult, setMatchResult] = useState('')

  const rootRef = useRef<BinaryTrieNode>((() => {
    const root = createBinaryTrieNode()
    ROUTING_TABLE.forEach(e => insertRoute(root, e))
    return root
  })())
  const pathRef = useRef<number[]>([])
  const matchDepthRef = useRef(0)
  const animTickRef = useRef(0)

  const handleLookup = useCallback(() => {
    const result = longestPrefixMatch(rootRef.current, lookupIP)
    pathRef.current = result.path
    matchDepthRef.current = result.matchDepth
    animTickRef.current = 0
    if (result.matchedRoute) {
      setMatchResult(`IP ${lookupIP} → ${result.matchedRoute} (matched ${result.matchDepth} bits)`)
    } else {
      setMatchResult(`IP ${lookupIP} → No route found`)
    }
  }, [lookupIP])

  const sketch = useCallback(
    (p: p5) => {
      p.setup = () => {
        p.createCanvas(800, 400)
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
        p.text('IP Routing: Longest Prefix Match', 20, 15)

        // Draw routing table
        p.fill(...CYAN)
        p.textSize(11)
        p.text('Routing Table:', 20, 45)
        for (let i = 0; i < ROUTING_TABLE.length; i++) {
          const e = ROUTING_TABLE[i]
          p.fill(...TEXT_C)
          p.text(`${e.prefix}/${e.mask}  →  ${e.route}`, 30, 65 + i * 18)
        }

        // Draw the binary trie path
        const path = pathRef.current
        if (path.length === 0) return

        // Animate traversal
        if (animTickRef.current < path.length) {
          animTickRef.current += 0.3
        }
        const showBits = Math.min(Math.floor(animTickRef.current), path.length)

        const startX = 350
        const startY = 50
        let x = startX
        let y = startY
        const stepX = 25
        const stepY = 40

        for (let i = 0; i < showBits; i++) {
          const bit = path[i]
          const nextX = x + (bit === 1 ? stepX : -stepX)
          const nextY = y + stepY

          const isMatched = i < matchDepthRef.current
          p.stroke(isMatched ? GREEN : RED)
          p.strokeWeight(2)
          p.line(x, y, nextX, nextY)

          // Bit label
          p.noStroke()
          p.fill(isMatched ? GREEN : TEXT_C)
          p.textSize(9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(bit.toString(), (x + nextX) / 2 + (bit === 1 ? 8 : -8), (y + nextY) / 2)

          // Node circle
          p.fill(...BG)
          p.stroke(isMatched ? GREEN : ACCENT)
          p.strokeWeight(1.5)
          p.ellipse(nextX, nextY, 10, 10)

          x = nextX
          y = nextY

          // Wrap if too far down
          if (y > p.height - 60) {
            x = startX + (i + 1) * 3
            y = startY
          }
        }

        // Show match indicator
        if (showBits >= matchDepthRef.current && matchDepthRef.current > 0) {
          p.noStroke()
          p.fill(...GREEN)
          p.textSize(12)
          p.textAlign(p.LEFT, p.TOP)
          p.text(`Matched at bit ${matchDepthRef.current}`, 350, p.height - 50)
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
          value={lookupIP}
          onChange={e => setLookupIP(e.target.value)}
          placeholder="Enter IP address..."
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-44 focus:border-indigo-500 outline-none"
        />
        <button onClick={handleLookup} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded">
          Lookup
        </button>
        <span className="text-sm text-gray-400">{matchResult}</span>
      </div>
      <P5Sketch sketch={sketch} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Code                                                         */
/* ------------------------------------------------------------------ */

const trieImplementation = `class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_end = True

    def search(self, word):
        node = self._find_node(word)
        return node is not None and node.is_end

    def starts_with(self, prefix):
        return self._find_node(prefix) is not None

    def autocomplete(self, prefix, limit=10):
        node = self._find_node(prefix)
        if node is None:
            return []
        results = []
        self._collect(node, prefix, results, limit)
        return results

    def _find_node(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node

    def _collect(self, node, current, results, limit):
        if len(results) >= limit:
            return
        if node.is_end:
            results.append(current)
        for ch in sorted(node.children):
            self._collect(node.children[ch], current + ch, results, limit)

    def count_nodes(self):
        def _count(node):
            return 1 + sum(_count(c) for c in node.children.values())
        return _count(self.root)

# --- Demo ---
trie = Trie()
words = [
    "apple", "application", "appetite", "apply", "apt",
    "banana", "band", "ban", "bath", "bat",
    "car", "card", "care", "carpet", "cart"
]
for w in words:
    trie.insert(w)

print(f"Inserted {len(words)} words into trie")
print(f"Total nodes: {trie.count_nodes()}")
print()

# Search
for test in ["apple", "app", "xyz", "ban", "banana"]:
    print(f"search('{test}') = {trie.search(test)}")
print()

# Autocomplete
for prefix in ["app", "ba", "car", "z"]:
    completions = trie.autocomplete(prefix)
    print(f"autocomplete('{prefix}') = {completions}")
`

const radixImplementation = `class RadixNode:
    def __init__(self, label="", is_end=False):
        self.label = label
        self.children = {}
        self.is_end = is_end

class RadixTree:
    def __init__(self):
        self.root = RadixNode()

    def insert(self, word):
        self._insert(self.root, word)

    def _insert(self, node, remaining):
        if not remaining:
            node.is_end = True
            return

        for key in list(node.children):
            child = node.children[key]
            # Find common prefix
            common = 0
            while common < len(key) and common < len(remaining) and key[common] == remaining[common]:
                common += 1

            if common == 0:
                continue

            if common == len(key):
                # Full match on edge, continue with child
                self._insert(child, remaining[common:])
                return

            # Partial match: need to split edge
            # Create new internal node for common prefix
            split_node = RadixNode(key[:common])
            # Move old child under new label
            old_child = node.children.pop(key)
            old_child.label = key[common:]
            split_node.children[key[common:]] = old_child
            node.children[key[:common]] = split_node

            if common < len(remaining):
                new_leaf = RadixNode(remaining[common:], is_end=True)
                split_node.children[remaining[common:]] = new_leaf
            else:
                split_node.is_end = True
            return

        # No matching edge found
        node.children[remaining] = RadixNode(remaining, is_end=True)

    def count_nodes(self):
        def _count(node):
            return 1 + sum(_count(c) for c in node.children.values())
        return _count(self.root)

    def display(self, node=None, indent=0, prefix=""):
        if node is None:
            node = self.root
            print("(root)")
        for key, child in sorted(node.children.items()):
            marker = " *" if child.is_end else ""
            print("  " * indent + f"--[{key}]-->{marker}")
            self.display(child, indent + 1, prefix + key)

# --- Compare Trie vs Radix Tree ---
words = [
    "apple", "application", "appetite", "apply", "apt",
    "banana", "band", "ban", "bath", "bat",
    "car", "card", "care", "carpet", "cart",
    "internet", "internal", "international", "inter"
]

# Build standard trie (count nodes)
class SimpleTrie:
    def __init__(self):
        self.children = {}
        self.is_end = False

def trie_insert(root, word):
    node = root
    for ch in word:
        if ch not in node.children:
            node.children[ch] = SimpleTrie()
        node = node.children[ch]
    node.is_end = True

def count_trie(node):
    return 1 + sum(count_trie(c) for c in node.children.values())

trie_root = SimpleTrie()
for w in words:
    trie_insert(trie_root, w)

rtree = RadixTree()
for w in words:
    rtree.insert(w)

trie_nodes = count_trie(trie_root)
radix_nodes = rtree.count_nodes()

print(f"Words: {len(words)}")
print(f"Standard Trie nodes: {trie_nodes}")
print(f"Radix Tree nodes:    {radix_nodes}")
print(f"Nodes saved:         {trie_nodes - radix_nodes} ({(trie_nodes - radix_nodes) / trie_nodes * 100:.1f}% reduction)")
print()
print("Radix Tree structure:")
rtree.display()
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function Trie() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      {/* ---- Hero ---- */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          How does Google autocomplete your search query before you finish typing?
          How does a router match an IP address to the correct gateway in nanoseconds?
          Both problems are solved by <strong className="text-indigo-400">tries</strong> (prefix trees) —
          a data structure where words sharing common prefixes share the same path in the tree.
        </p>
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <p className="text-indigo-300 text-sm">
            <strong>The prefix problem:</strong> given millions of strings, find all strings that start with a given prefix.
            Hash maps fail here — you would have to hash every possible prefix. Sorted arrays need O(log n) binary search
            plus scanning. Tries answer prefix queries in O(k) time where k is the prefix length, regardless of how many
            strings are stored.
          </p>
        </div>
      </section>

      {/* ---- Section 1: Interactive Trie ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive Trie: Autocomplete in Action</h2>
        <p className="text-gray-300 leading-relaxed">
          The trie below is pre-loaded with words. Type a prefix to see the search path light up in green
          and matching words highlighted. Insert new words and watch the tree grow as new branches form.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Each node represents a single character. A word like &quot;apple&quot; creates a path through nodes
          a → p → p → l → e. The <span className="text-pink-400">pink nodes</span> mark the end of a word.
          Notice how &quot;apple&quot; and &quot;application&quot; share the prefix &quot;appl&quot; — they follow the same
          path until they diverge.
        </p>
        <TrieSketch />
      </section>

      {/* ---- Section 2: How Tries Work ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">How Tries Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-green-400 mb-2">Insert O(k)</h3>
            <p className="text-gray-300 text-sm">
              Walk down from the root. For each character, follow the existing edge or create a new one.
              Mark the final node as a word-end. Time is O(k) where k is the word length — independent
              of how many words the trie contains.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Search O(k)</h3>
            <p className="text-gray-300 text-sm">
              Follow the path character by character. If you reach the end and the node is marked as a word-end,
              the word exists. If any edge is missing, the word is not in the trie.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-yellow-400 mb-2">Prefix Search O(k + m)</h3>
            <p className="text-gray-300 text-sm">
              Navigate to the node representing the prefix (O(k)), then collect all words in that subtree (O(m)
              where m is the number of matching words). This is what makes autocomplete fast.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-pink-400 mb-2">Delete O(k)</h3>
            <p className="text-gray-300 text-sm">
              Unmark the word-end flag. Optionally, remove nodes that no longer serve as prefixes
              for other words. Walk back up and prune empty branches.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Section 3: Radix Tree Comparison ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Radix Trees: Compressing the Trie</h2>
        <p className="text-gray-300 leading-relaxed">
          A standard trie can waste space with long chains of single-child nodes. The word
          &quot;application&quot; creates 11 nodes even if no other word shares its suffix. A{' '}
          <strong className="text-orange-400">radix tree</strong> (also called a Patricia trie) compresses
          these chains: instead of one node per character, an edge can carry an entire substring.
          The path &quot;a&quot; → &quot;p&quot; → &quot;p&quot; → &quot;l&quot; → &quot;i&quot; → &quot;c&quot; → &quot;a&quot; → &quot;t&quot; → &quot;i&quot; → &quot;o&quot; → &quot;n&quot;
          becomes a single edge labeled &quot;lication&quot; after the shared prefix &quot;app&quot;.
        </p>
        <RadixCompareSketch />
        <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
          <p className="text-orange-300 text-sm">
            <strong>Trade-off:</strong> radix trees use far fewer nodes (often 50-70% reduction), but
            edge splitting on insert is more complex. The compressed representation is also more
            cache-friendly because fewer pointer dereferences are needed during traversal.
          </p>
        </div>
      </section>

      {/* ---- Section 4: IP Routing ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Longest Prefix Match: IP Routing</h2>
        <p className="text-gray-300 leading-relaxed">
          Network routers face a classic trie problem: given an IP address, find the most specific
          (longest) matching prefix in the routing table. The IP address is converted to binary and
          the router walks a binary trie. At each bit, it goes left (0) or right (1). The deepest
          node with a route entry is the match.
        </p>
        <p className="text-gray-300 leading-relaxed">
          For example, 10.1.1.42 matches 10.0.0.0/8 (Gateway A), 10.1.0.0/16 (Gateway B), and
          10.1.1.0/24 (Gateway C). The <strong className="text-green-400">longest prefix match</strong>{' '}
          selects Gateway C because /24 is the most specific route.
        </p>
        <IPRoutingSketch />
      </section>

      {/* ---- Section 5: Real World ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Autocomplete</h3>
            <p className="text-gray-300 text-sm">
              Google Search, IDE code completion, phone keyboards — all use trie variants.
              Google indexes trillions of queries and returns suggestions in under 100ms.
              Tries make this possible because prefix lookup is O(k), not O(n).
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Spell Checkers</h3>
            <p className="text-gray-300 text-sm">
              Tries support efficient fuzzy matching. Given a misspelled word, walk the trie
              allowing substitutions, insertions, and deletions. This bounded edit-distance search
              is much faster than comparing against every dictionary word.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">IP Routing</h3>
            <p className="text-gray-300 text-sm">
              The Linux kernel uses a compressed trie (LC-trie) for its routing table. Every IP
              packet your computer sends passes through this trie to determine the next hop.
              High-speed routers process billions of lookups per second using TCAM hardware that
              implements trie logic in parallel.
            </p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-2">Compression</h3>
            <p className="text-gray-300 text-sm">
              LZW compression (used in GIF images) builds a trie of previously seen substrings.
              Each new pattern extends an existing trie path. The Aho-Corasick algorithm builds
              a trie of all search patterns for multi-pattern matching in O(n + m + z) time.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Python: Trie Implementation ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: Trie with Autocomplete</h2>
        <p className="text-gray-300 leading-relaxed">
          A complete trie implementation with insert, search, starts_with, and autocomplete.
          The autocomplete method collects all words in a subtree using depth-first traversal.
        </p>
        <PythonCell defaultCode={trieImplementation} />
      </section>

      {/* ---- Python: Radix Tree ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Python: Radix Tree vs Trie Node Count</h2>
        <p className="text-gray-300 leading-relaxed">
          Build both a standard trie and a radix tree from the same word set and compare node counts.
          The radix tree displays its compressed structure showing multi-character edge labels.
        </p>
        <PythonCell defaultCode={radixImplementation} />
      </section>

      {/* ---- Complexity Summary ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-white">Operation</th>
                <th className="text-left py-2 pr-4 text-white">Trie</th>
                <th className="text-left py-2 pr-4 text-white">Radix Tree</th>
                <th className="text-left py-2 text-white">Hash Map</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Insert</td>
                <td className="py-2 pr-4 text-emerald-400">O(k)</td>
                <td className="py-2 pr-4 text-emerald-400">O(k)</td>
                <td className="py-2 text-emerald-400">O(k) amortized</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Search</td>
                <td className="py-2 pr-4 text-emerald-400">O(k)</td>
                <td className="py-2 pr-4 text-emerald-400">O(k)</td>
                <td className="py-2 text-emerald-400">O(k)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Prefix search</td>
                <td className="py-2 pr-4 text-emerald-400">O(k + m)</td>
                <td className="py-2 pr-4 text-emerald-400">O(k + m)</td>
                <td className="py-2 text-red-400">O(n)</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-4">Space</td>
                <td className="py-2 pr-4 text-yellow-400">O(n * k)</td>
                <td className="py-2 pr-4 text-emerald-400">O(n)</td>
                <td className="py-2 text-emerald-400">O(n * k)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Ordered iteration</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2 text-red-400">No</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-sm italic">k = key length, n = number of keys, m = number of matches</p>
      </section>

      {/* ---- Key Takeaways ---- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Tries store strings as paths from root to leaf, sharing common prefixes across words</li>
          <li>Autocomplete is a prefix search: navigate to the prefix node, then collect all descendants</li>
          <li>Radix trees compress single-child chains into multi-character edges, reducing node count by 50-70%</li>
          <li>IP routing uses binary tries for longest-prefix match — every packet you send hits one</li>
          <li>Time complexity depends on key length, not on the number of stored keys</li>
          <li>Trade-off vs hash maps: tries support prefix queries and ordered iteration; hash maps are simpler for exact lookup</li>
        </ul>
      </section>
    </div>
  )
}
