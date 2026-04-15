import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'datastructures/merkle-tree',
  title: 'Merkle Trees: Tamper-Proof Data Verification',
  description:
    'Efficiently detect differences between massive datasets using cryptographic hash trees — the backbone of Git, blockchains, and distributed databases',
  track: 'datastructures',
  order: 10,
  tags: ['merkle-tree', 'hashing', 'verification', 'blockchain', 'git', 'cassandra'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Simple deterministic hash — returns a short hex string */
function simpleHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const u = h >>> 0
  return u.toString(16).padStart(8, '0')
}

/** Build a Merkle tree from leaf data blocks. Returns array of levels (bottom-up). */
function buildMerkleTree(leaves: string[]): string[][] {
  if (leaves.length === 0) return [['empty']]
  const levels: string[][] = []
  // Hash leaves
  const leafHashes = leaves.map((d) => simpleHash(d))
  levels.push(leafHashes)
  let current = leafHashes
  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = i + 1 < current.length ? current[i + 1] : current[i]
      next.push(simpleHash(left + right))
    }
    levels.push(next)
    current = next
  }
  return levels
}

/** Find which leaf indices differ between two trees */
function findDifferences(tree1: string[][], tree2: string[][]): number[] {
  if (tree1.length === 0 || tree2.length === 0) return []
  const topLevel = tree1.length - 1
  if (tree1[topLevel][0] === tree2[topLevel][0]) return []
  const diffs: number[] = []
  function traverse(level: number, index: number) {
    if (level === 0) {
      if (tree1[0][index] !== tree2[0][index]) diffs.push(index)
      return
    }
    const leftIdx = index * 2
    const rightIdx = index * 2 + 1
    if (leftIdx < tree1[level - 1].length && tree1[level - 1][leftIdx] !== tree2[level - 1][leftIdx]) {
      traverse(level - 1, leftIdx)
    }
    if (rightIdx < tree1[level - 1].length && tree1[level - 1][rightIdx] !== tree2[level - 1][rightIdx]) {
      traverse(level - 1, rightIdx)
    }
  }
  traverse(topLevel, 0)
  return diffs
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Merkle Tree Visualization                   */
/* ------------------------------------------------------------------ */

function MerkleTreeSketch() {
  const numLeaves = 8
  const initData = Array.from({ length: numLeaves }, (_, i) => `Block ${i}`)
  const [leafData, setLeafData] = useState<string[]>(initData)
  const [selectedLeaf, setSelectedLeaf] = useState<number | null>(null)
  const [modifiedLeaves, setModifiedLeaves] = useState<Set<number>>(new Set())
  const [verifyPath, setVerifyPath] = useState<Set<string> | null>(null)

  const leafDataRef = useRef(leafData)
  leafDataRef.current = leafData
  const modifiedRef = useRef(modifiedLeaves)
  modifiedRef.current = modifiedLeaves
  const verifyPathRef = useRef(verifyPath)
  verifyPathRef.current = verifyPath
  const origTreeRef = useRef(buildMerkleTree(initData))
  const animTimerRef = useRef(0)
  const propagatingRef = useRef<{ level: number; timer: number } | null>(null)

  const handleModifyLeaf = useCallback((index: number) => {
    setSelectedLeaf(index)
    const newData = [...leafDataRef.current]
    newData[index] = `Modified ${index} (v${Date.now() % 1000})`
    setLeafData(newData)
    leafDataRef.current = newData
    const newMod = new Set(modifiedRef.current)
    newMod.add(index)
    setModifiedLeaves(newMod)
    modifiedRef.current = newMod
    // Start propagation animation
    propagatingRef.current = { level: 0, timer: 30 }
    animTimerRef.current = 120
  }, [])

  const handleShowVerifyPath = useCallback((index: number) => {
    const tree = buildMerkleTree(leafDataRef.current)
    const path = new Set<string>()
    // Add leaf node
    path.add(`0-${index}`)
    let curIdx = index
    for (let level = 0; level < tree.length - 1; level++) {
      const sibIdx = curIdx % 2 === 0 ? curIdx + 1 : curIdx - 1
      if (sibIdx >= 0 && sibIdx < tree[level].length) {
        path.add(`${level}-${sibIdx}`)
      }
      const parentIdx = Math.floor(curIdx / 2)
      path.add(`${level + 1}-${parentIdx}`)
      curIdx = parentIdx
    }
    setVerifyPath(path)
    verifyPathRef.current = path
    animTimerRef.current = 180
  }, [])

  const handleReset = useCallback(() => {
    const fresh = Array.from({ length: numLeaves }, (_, i) => `Block ${i}`)
    setLeafData(fresh)
    leafDataRef.current = fresh
    setModifiedLeaves(new Set())
    modifiedRef.current = new Set()
    setSelectedLeaf(null)
    setVerifyPath(null)
    verifyPathRef.current = null
    origTreeRef.current = buildMerkleTree(fresh)
    propagatingRef.current = null
    animTimerRef.current = 0
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 480

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 800
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width

      const data = leafDataRef.current
      const tree = buildMerkleTree(data)
      const origTree = origTreeRef.current
      const modified = modifiedRef.current
      const vPath = verifyPathRef.current

      // Update propagation animation
      const prop = propagatingRef.current
      if (prop && prop.timer > 0) {
        prop.timer--
        if (prop.timer <= 0 && prop.level < tree.length - 1) {
          propagatingRef.current = { level: prop.level + 1, timer: 30 }
        }
      }
      const propLevel = prop ? prop.level : -1

      if (animTimerRef.current > 0) animTimerRef.current--

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Merkle Tree — Click a data block to modify it, watch hashes propagate', 16, 12)

      // Draw tree top-down
      const levels = tree.length
      const nodeW = 78
      const nodeH = 36
      const levelGap = 70
      const treeTop = 44

      // Positions for each node: [level][index] = { x, y }
      const positions: { x: number; y: number }[][] = []
      for (let lvl = levels - 1; lvl >= 0; lvl--) {
        const count = tree[lvl].length
        const displayLvl = levels - 1 - lvl
        const y = treeTop + displayLvl * levelGap
        const totalWidth = count * (nodeW + 8) - 8
        const startX = (W - totalWidth) / 2
        const row: { x: number; y: number }[] = []
        for (let i = 0; i < count; i++) {
          row.push({ x: startX + i * (nodeW + 8), y })
        }
        positions.push(row)
      }
      positions.reverse() // Now positions[level][index]

      // Draw edges first
      for (let lvl = 1; lvl < levels; lvl++) {
        for (let i = 0; i < tree[lvl].length; i++) {
          const parentPos = positions[lvl][i]
          const leftIdx = i * 2
          const rightIdx = i * 2 + 1
          const parentCx = parentPos.x + nodeW / 2
          const parentBy = parentPos.y + nodeH

          if (leftIdx < tree[lvl - 1].length) {
            const childPos = positions[lvl - 1][leftIdx]
            const childCx = childPos.x + nodeW / 2
            const childTy = childPos.y

            // Color edge based on whether hash changed
            const changed = origTree[lvl] && tree[lvl][i] !== (origTree[lvl]?.[i] ?? '')
            const onVerifyPath = vPath && vPath.has(`${lvl}-${i}`) && vPath.has(`${lvl - 1}-${leftIdx}`)
            if (onVerifyPath) {
              p.stroke(250, 204, 21, 200)
              p.strokeWeight(2.5)
            } else if (changed && propLevel >= lvl) {
              p.stroke(239, 68, 68, 180)
              p.strokeWeight(2)
            } else {
              p.stroke(71, 85, 105)
              p.strokeWeight(1)
            }
            p.line(parentCx, parentBy, childCx, childTy)
          }
          if (rightIdx < tree[lvl - 1].length) {
            const childPos = positions[lvl - 1][rightIdx]
            const childCx = childPos.x + nodeW / 2
            const childTy = childPos.y

            const changed = origTree[lvl] && tree[lvl][i] !== (origTree[lvl]?.[i] ?? '')
            const onVerifyPath = vPath && vPath.has(`${lvl}-${i}`) && vPath.has(`${lvl - 1}-${rightIdx}`)
            if (onVerifyPath) {
              p.stroke(250, 204, 21, 200)
              p.strokeWeight(2.5)
            } else if (changed && propLevel >= lvl) {
              p.stroke(239, 68, 68, 180)
              p.strokeWeight(2)
            } else {
              p.stroke(71, 85, 105)
              p.strokeWeight(1)
            }
            p.line(parentCx, parentBy, childCx, childTy)
          }
        }
      }

      // Draw nodes
      for (let lvl = 0; lvl < levels; lvl++) {
        for (let i = 0; i < tree[lvl].length; i++) {
          const pos = positions[lvl][i]
          const hash = tree[lvl][i]
          const origHash = origTree[lvl]?.[i] ?? ''
          const changed = hash !== origHash
          const isLeaf = lvl === 0
          const isRoot = lvl === levels - 1
          const onPath = vPath && vPath.has(`${lvl}-${i}`)
          const isModifiedLeaf = isLeaf && modified.has(i)
          const showChange = changed && propLevel >= lvl

          // Node background
          if (onPath) {
            p.fill(250, 204, 21, 40)
            p.stroke(250, 204, 21)
            p.strokeWeight(2)
          } else if (showChange) {
            p.fill(239, 68, 68, 40)
            p.stroke(239, 68, 68)
            p.strokeWeight(2)
          } else if (isRoot) {
            p.fill(30, 58, 82)
            p.stroke(56, 189, 248)
            p.strokeWeight(1.5)
          } else if (isLeaf) {
            p.fill(30, 41, 59)
            p.stroke(99, 102, 241, 150)
            p.strokeWeight(1)
          } else {
            p.fill(30, 41, 59)
            p.stroke(71, 85, 105)
            p.strokeWeight(1)
          }

          p.rect(pos.x, pos.y, nodeW, nodeH, 5)

          // Hash text
          if (showChange) {
            p.fill(239, 68, 68)
          } else if (onPath) {
            p.fill(250, 204, 21)
          } else {
            p.fill(200, 210, 220)
          }
          p.noStroke()
          p.textSize(9)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(hash.slice(0, 8), pos.x + nodeW / 2, pos.y + nodeH / 2 - 4)

          // Level label
          p.fill(100, 116, 139)
          p.textSize(7)
          if (isRoot) {
            p.text('ROOT', pos.x + nodeW / 2, pos.y + nodeH / 2 + 10)
          } else if (isLeaf) {
            p.text(`leaf ${i}`, pos.x + nodeW / 2, pos.y + nodeH / 2 + 10)
          } else {
            p.text(`L${lvl}[${i}]`, pos.x + nodeW / 2, pos.y + nodeH / 2 + 10)
          }

          // Modified indicator
          if (isModifiedLeaf) {
            p.fill(239, 68, 68)
            p.noStroke()
            p.ellipse(pos.x + nodeW - 4, pos.y + 4, 8, 8)
          }
        }
      }

      // Data blocks below leaves
      const dataY = treeTop + (levels) * levelGap - 16
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Data Blocks (click to modify):', W / 2, dataY)

      for (let i = 0; i < data.length; i++) {
        const pos = positions[0][i]
        const cx = pos.x + nodeW / 2
        const by = dataY + 18
        const bw = nodeW - 4
        const bh = 24

        if (modified.has(i)) {
          p.fill(239, 68, 68, 30)
          p.stroke(239, 68, 68, 150)
        } else {
          p.fill(15, 23, 42)
          p.stroke(71, 85, 105)
        }
        p.strokeWeight(1)
        p.rect(cx - bw / 2, by, bw, bh, 3)

        p.fill(modified.has(i) ? p.color(239, 130, 130) : p.color(148, 163, 184))
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        const label = data[i].length > 12 ? data[i].slice(0, 12) + '..' : data[i]
        p.text(label, cx, by + bh / 2)
      }

      // Legend
      const legY = canvasH - 36
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.noStroke()

      p.fill(239, 68, 68)
      p.rect(16, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Changed hash', 30, legY)

      p.fill(250, 204, 21)
      p.rect(130, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Verification path', 144, legY)

      p.fill(56, 189, 248)
      p.rect(268, legY - 4, 10, 10, 2)
      p.fill(148, 163, 184)
      p.text('Root hash', 282, legY)

      // Comparison info
      if (modified.size > 0) {
        p.fill(239, 68, 68)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.TOP)
        const diffs = findDifferences(origTree, tree)
        p.text(`${modified.size} block(s) modified | O(log n) = ${tree.length} levels checked`, W - 16, 12)
        void diffs
      }
    }

    p.mousePressed = () => {
      const data = leafDataRef.current
      const tree = buildMerkleTree(data)
      const levels = tree.length
      const W = p.width
      const treeTop = 44
      const nodeW = 78
      const levelGap = 70
      const dataY = treeTop + levels * levelGap - 16 + 18
      const bh = 24

      // Check if clicked on a data block
      for (let i = 0; i < data.length; i++) {
        const count = tree[0].length
        const totalWidth = count * (nodeW + 8) - 8
        const startX = (W - totalWidth) / 2
        const cx = startX + i * (nodeW + 8) + nodeW / 2
        const bw = nodeW - 4
        if (p.mouseX > cx - bw / 2 && p.mouseX < cx + bw / 2 && p.mouseY > dataY && p.mouseY < dataY + bh) {
          handleModifyLeaf(i)
          return
        }
      }

      // Check if clicked on a leaf node (for verify path)
      for (let i = 0; i < tree[0].length; i++) {
        const count = tree[0].length
        const totalWidth = count * (nodeW + 8) - 8
        const startX = (W - totalWidth) / 2
        const displayLvl = levels - 1
        const y = treeTop + displayLvl * levelGap
        const x = startX + i * (nodeW + 8)
        if (p.mouseX > x && p.mouseX < x + nodeW && p.mouseY > y && p.mouseY < y + 36) {
          handleShowVerifyPath(i)
        }
      }
    }
  }, [handleModifyLeaf, handleShowVerifyPath])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={480} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Reset All
        </button>
        <span className="text-gray-500 text-xs">
          Click data blocks to modify | Click leaf nodes to show verification path
        </span>
        {selectedLeaf !== null && (
          <span className="text-red-400 text-xs font-mono">
            Last modified: Block {selectedLeaf}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Anti-Entropy Comparison Visualization                   */
/* ------------------------------------------------------------------ */

function AntiEntropySketch() {
  const numLeaves = 8
  const [replicaA] = useState<string[]>(
    Array.from({ length: numLeaves }, (_, i) => `Row ${i}`)
  )
  const [replicaB, setReplicaB] = useState<string[]>(
    Array.from({ length: numLeaves }, (_, i) => `Row ${i}`)
  )
  const [diffIndices, setDiffIndices] = useState<number[]>([])
  const [nodesChecked, setNodesChecked] = useState(0)
  const [synced, setSynced] = useState(false)

  const replicaARef = useRef(replicaA)
  replicaARef.current = replicaA
  const replicaBRef = useRef(replicaB)
  replicaBRef.current = replicaB
  const diffRef = useRef(diffIndices)
  diffRef.current = diffIndices
  const syncedRef = useRef(synced)
  syncedRef.current = synced
  const checkedRef = useRef(nodesChecked)
  checkedRef.current = nodesChecked

  const handleIntroduceDiffs = useCallback(() => {
    const b = [...replicaARef.current]
    // Modify 2-3 random rows in replica B
    const numDiffs = 2 + Math.floor(Math.random() * 2)
    const indices = new Set<number>()
    while (indices.size < numDiffs) {
      indices.add(Math.floor(Math.random() * numLeaves))
    }
    for (const idx of indices) {
      b[idx] = `Changed ${idx} (v${Date.now() % 100})`
    }
    setReplicaB(b)
    replicaBRef.current = b
    setDiffIndices([])
    diffRef.current = []
    setSynced(false)
    syncedRef.current = false
    setNodesChecked(0)
    checkedRef.current = 0
  }, [])

  const handleFindDiffs = useCallback(() => {
    const treeA = buildMerkleTree(replicaARef.current)
    const treeB = buildMerkleTree(replicaBRef.current)
    const diffs = findDifferences(treeA, treeB)
    // Count nodes checked (O(log n) per diff path)
    let checked = 1 // root
    if (treeA[treeA.length - 1][0] !== treeB[treeB.length - 1][0]) {
      for (let lvl = treeA.length - 2; lvl >= 0; lvl--) {
        for (let i = 0; i < treeA[lvl].length; i++) {
          if (treeA[lvl][i] !== treeB[lvl][i]) checked++
        }
      }
    }
    setDiffIndices(diffs)
    diffRef.current = diffs
    setNodesChecked(checked)
    checkedRef.current = checked
  }, [])

  const handleSync = useCallback(() => {
    const a = [...replicaARef.current]
    const b = [...replicaBRef.current]
    for (const idx of diffRef.current) {
      b[idx] = a[idx]
    }
    setReplicaB(b)
    replicaBRef.current = b
    setSynced(true)
    syncedRef.current = true
    setDiffIndices([])
    diffRef.current = []
  }, [])

  const sketch = useCallback((p: p5) => {
    const canvasH = 360

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 800
      p.createCanvas(pw, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const W = p.width
      const dataA = replicaARef.current
      const dataB = replicaBRef.current
      const diffs = diffRef.current
      const isSynced = syncedRef.current
      const checked = checkedRef.current

      const treeA = buildMerkleTree(dataA)
      const treeB = buildMerkleTree(dataB)

      const rootA = treeA[treeA.length - 1][0]
      const rootB = treeB[treeB.length - 1][0]
      const rootsMatch = rootA === rootB

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Anti-Entropy: Compare Replicas via Merkle Tree Roots', 16, 12)

      // Draw two replicas side by side
      const replicaW = W / 2 - 30
      const replicaTop = 50
      const cellH = 28
      const cellW = replicaW - 20

      const drawReplica = (data: string[], label: string, rootHash: string, startX: number) => {
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(label, startX, replicaTop - 20)

        // Root hash
        const rootColor = rootsMatch ? p.color(52, 211, 153) : p.color(239, 68, 68)
        p.fill(rootColor)
        p.textSize(10)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`Root: ${rootHash.slice(0, 8)}`, startX + cellW, replicaTop - 20)

        for (let i = 0; i < data.length; i++) {
          const y = replicaTop + i * (cellH + 3)
          const isDiff = diffs.includes(i)
          const isActualDiff = dataA[i] !== dataB[i]

          if (isDiff) {
            p.fill(239, 68, 68, 40)
            p.stroke(239, 68, 68)
          } else if (isSynced) {
            p.fill(52, 211, 153, 20)
            p.stroke(52, 211, 153, 100)
          } else if (isActualDiff) {
            p.fill(30, 41, 59)
            p.stroke(250, 204, 21, 80)
          } else {
            p.fill(30, 41, 59)
            p.stroke(71, 85, 105)
          }
          p.strokeWeight(1)
          p.rect(startX, y, cellW, cellH, 3)

          p.fill(isDiff ? p.color(239, 130, 130) : p.color(180, 190, 200))
          p.noStroke()
          p.textSize(9)
          p.textAlign(p.LEFT, p.CENTER)
          const txt = data[i].length > 20 ? data[i].slice(0, 20) + '..' : data[i]
          p.text(`[${i}] ${txt}`, startX + 8, y + cellH / 2)

          // Show leaf hash
          p.fill(100, 116, 139)
          p.textSize(7)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(simpleHash(data[i]).slice(0, 6), startX + cellW - 4, y + cellH / 2)
        }
      }

      drawReplica(dataA, 'Replica A (source of truth)', rootA, 20)
      drawReplica(dataB, 'Replica B (may have drifted)', rootB, W / 2 + 10)

      // Connection arrow between root hashes
      const arrowY = replicaTop - 14
      const arrowLx = 20 + cellW + 10
      const arrowRx = W / 2 + 10 - 10
      p.stroke(rootsMatch ? p.color(52, 211, 153) : p.color(239, 68, 68))
      p.strokeWeight(2)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.line(arrowLx, arrowY, arrowRx, arrowY)
      ctx.setLineDash([])

      p.fill(rootsMatch ? p.color(52, 211, 153) : p.color(239, 68, 68))
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(rootsMatch ? 'Roots match! Data identical.' : 'Roots differ! Drill down...', (arrowLx + arrowRx) / 2, arrowY - 4)

      // Stats
      const statsY = replicaTop + numLeaves * (cellH + 3) + 10
      p.fill(148, 163, 184)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      if (diffs.length > 0) {
        p.fill(239, 68, 68)
        p.text(`Found ${diffs.length} differing row(s): [${diffs.join(', ')}]`, 20, statsY)
        p.fill(148, 163, 184)
        p.text(`Nodes checked: ${checked} out of ${dataA.length + treeA.flat().length} total (O(log n) efficiency)`, 20, statsY + 16)
        p.text(`Naive approach: would compare all ${dataA.length} rows = O(n)`, 20, statsY + 32)
      } else if (isSynced) {
        p.fill(52, 211, 153)
        p.text('Replicas synced! All rows now identical.', 20, statsY)
      } else if (!rootsMatch) {
        p.fill(250, 204, 21)
        p.text('Roots differ — click "Find Differences" to locate divergent rows', 20, statsY)
      } else {
        p.fill(100, 116, 139)
        p.text('Both replicas are identical. Click "Introduce Differences" to simulate drift.', 20, statsY)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <P5Sketch sketch={sketch} height={360} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={handleIntroduceDiffs}
          className="px-3 py-1.5 rounded bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-500 transition-colors"
        >
          Introduce Differences
        </button>
        <button
          onClick={handleFindDiffs}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          Find Differences (Merkle)
        </button>
        <button
          onClick={handleSync}
          disabled={diffIndices.length === 0}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sync Only Diffs
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const merkleImplementation = `import hashlib

class MerkleTree:
    """
    Merkle Tree: a hash tree where every leaf node is a hash of a data block,
    and every non-leaf node is a hash of its children's hashes.

    Used in: Git (commit trees), Bitcoin (transaction verification),
    Cassandra (anti-entropy repair), IPFS, Certificate Transparency.
    """

    def __init__(self, data_blocks: list):
        self.data_blocks = list(data_blocks)
        self.levels = []  # levels[0] = leaf hashes, levels[-1] = [root_hash]
        self._build()

    def _hash(self, data: str) -> str:
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _build(self):
        """Build the Merkle tree from leaf data."""
        if not self.data_blocks:
            self.levels = [["empty"]]
            return
        # Hash each data block to create leaf level
        leaf_hashes = [self._hash(block) for block in self.data_blocks]
        self.levels = [leaf_hashes]

        current = leaf_hashes
        while len(current) > 1:
            next_level = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else current[i]
                next_level.append(self._hash(left + right))
            self.levels.append(next_level)
            current = next_level

    @property
    def root(self) -> str:
        return self.levels[-1][0]

    def get_proof(self, index: int) -> list:
        """
        Get the Merkle proof (authentication path) for a leaf at index.
        Returns list of (hash, direction) tuples needed to verify.
        """
        proof = []
        for level in range(len(self.levels) - 1):
            sibling_idx = index ^ 1  # XOR flips last bit: 0->1, 1->0, 2->3, etc.
            if sibling_idx < len(self.levels[level]):
                direction = "right" if index % 2 == 0 else "left"
                proof.append((self.levels[level][sibling_idx], direction))
            index //= 2
        return proof

    def verify_proof(self, data: str, index: int, proof: list) -> bool:
        """Verify a Merkle proof for a data block."""
        current_hash = self._hash(data)
        for sibling_hash, direction in proof:
            if direction == "right":
                current_hash = self._hash(current_hash + sibling_hash)
            else:
                current_hash = self._hash(sibling_hash + current_hash)
        return current_hash == self.root

    def display(self):
        """Pretty-print the tree."""
        for i, level in enumerate(reversed(self.levels)):
            depth = len(self.levels) - 1 - i
            indent = "  " * depth
            if i == 0:
                label = "Root"
            elif depth == 0:
                label = "Leaves"
            else:
                label = f"Level {depth}"
            hashes = " | ".join(h[:8] for h in level)
            print(f"{indent}{label}: [{hashes}]")


# --- Build and explore a Merkle tree ---
data = ["tx_alice_bob_50", "tx_carol_dave_30", "tx_eve_frank_10",
        "tx_grace_heidi_25", "tx_ivan_judy_15", "tx_karl_lily_40",
        "tx_mike_nina_60", "tx_oscar_pat_20"]

tree = MerkleTree(data)
print("=== Merkle Tree Structure ===")
tree.display()

print(f"\\nRoot hash: {tree.root}")
print(f"Tree depth: {len(tree.levels) - 1} levels")
print(f"Number of leaves: {len(data)}")

# --- Verify a specific transaction ---
idx = 3
proof = tree.get_proof(idx)
print(f"\\n=== Merkle Proof for '{data[idx]}' (index {idx}) ===")
for h, d in proof:
    print(f"  Sibling: {h[:8]}... ({d})")
print(f"Proof size: {len(proof)} hashes (log2({len(data)}) = {len(proof)})")

valid = tree.verify_proof(data[idx], idx, proof)
print(f"Verification: {'VALID' if valid else 'INVALID'}")

# --- Tamper with data and detect ---
print("\\n=== Tamper Detection ===")
tampered_data = list(data)
tampered_data[3] = "tx_grace_heidi_99999"  # Modified!
tampered_tree = MerkleTree(tampered_data)

print(f"Original root:  {tree.root}")
print(f"Tampered root:  {tampered_tree.root}")
print(f"Roots match: {tree.root == tampered_tree.root}")

# The proof for the original data no longer validates against tampered tree
old_proof = tree.get_proof(3)
still_valid = tampered_tree.verify_proof(data[3], 3, old_proof)
print(f"Original data with tampered tree: {'VALID' if still_valid else 'INVALID (tamper detected!)'}")
`

const antiEntropySimulation = `import hashlib
import random

class MerkleTree:
    """Compact Merkle tree for anti-entropy comparison."""
    def __init__(self, data):
        self.data = list(data)
        self.levels = []
        self._build()

    def _hash(self, s):
        return hashlib.sha256(s.encode()).hexdigest()[:12]

    def _build(self):
        hashes = [self._hash(str(d)) for d in self.data]
        self.levels = [hashes]
        current = hashes
        while len(current) > 1:
            nxt = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else current[i]
                nxt.append(self._hash(left + right))
            self.levels.append(nxt)
            current = nxt

    @property
    def root(self):
        return self.levels[-1][0]


def find_differences(tree_a, tree_b):
    """
    Find differing leaf indices by traversing the Merkle tree top-down.
    Only examines branches where hashes differ => O(d * log n) where d = # diffs.
    Returns (differing_indices, nodes_checked).
    """
    diffs = []
    nodes_checked = 0

    def traverse(level, index):
        nonlocal nodes_checked
        nodes_checked += 1

        if level == 0:
            if tree_a.levels[0][index] != tree_b.levels[0][index]:
                diffs.append(index)
            return

        left_idx = index * 2
        right_idx = index * 2 + 1

        if left_idx < len(tree_a.levels[level - 1]):
            if tree_a.levels[level - 1][left_idx] != tree_b.levels[level - 1][left_idx]:
                traverse(level - 1, left_idx)

        if right_idx < len(tree_a.levels[level - 1]):
            if tree_a.levels[level - 1][right_idx] != tree_b.levels[level - 1][right_idx]:
                traverse(level - 1, right_idx)

    top = len(tree_a.levels) - 1
    if tree_a.root != tree_b.root:
        traverse(top, 0)

    return diffs, nodes_checked


# --- Simulate two database replicas ---
NUM_ROWS = 256
random.seed(42)

# Source of truth
replica_a = [f"row_{i}_data_{random.randint(100, 999)}" for i in range(NUM_ROWS)]
replica_b = list(replica_a)  # Start identical

# Introduce random drift in replica B
NUM_DIFFS = 5
drift_indices = random.sample(range(NUM_ROWS), NUM_DIFFS)
for idx in drift_indices:
    replica_b[idx] = f"row_{idx}_DRIFTED_{random.randint(100, 999)}"

print(f"=== Anti-Entropy Simulation ===")
print(f"Total rows: {NUM_ROWS}")
print(f"Rows that drifted: {sorted(drift_indices)}")

# Build Merkle trees
tree_a = MerkleTree(replica_a)
tree_b = MerkleTree(replica_b)

print(f"\\nReplica A root: {tree_a.root}")
print(f"Replica B root: {tree_b.root}")
print(f"Roots match: {tree_a.root == tree_b.root}")

# Find differences using Merkle tree
found_diffs, nodes_checked = find_differences(tree_a, tree_b)
print(f"\\n--- Merkle Tree Comparison ---")
print(f"Differences found at indices: {sorted(found_diffs)}")
print(f"Nodes checked: {nodes_checked} out of {sum(len(l) for l in tree_a.levels)} total nodes")
print(f"Naive comparison would check: {NUM_ROWS} rows")
print(f"Efficiency gain: {NUM_ROWS / max(nodes_checked, 1):.1f}x fewer comparisons")
print(f"Correctly found all diffs: {sorted(found_diffs) == sorted(drift_indices)}")

# Sync only the differing rows
print(f"\\n--- Syncing {len(found_diffs)} rows ---")
for idx in found_diffs:
    print(f"  Row {idx}: '{replica_b[idx][:30]}' => '{replica_a[idx][:30]}'")
    replica_b[idx] = replica_a[idx]

# Verify sync
tree_b_after = MerkleTree(replica_b)
print(f"\\nAfter sync:")
print(f"Replica A root: {tree_a.root}")
print(f"Replica B root: {tree_b_after.root}")
print(f"Roots match: {tree_a.root == tree_b_after.root}")
print(f"Data transferred: {len(found_diffs)} rows (not all {NUM_ROWS})")

# --- Scale analysis ---
print(f"\\n=== Scaling Analysis ===")
for n in [256, 1024, 65536, 1048576]:
    import math
    log_n = int(math.log2(n))
    d = 5  # assume 5 diffs
    checked = d * log_n  # approximate
    print(f"  n={n:>10,}: naive={n:>10,} comparisons, merkle~={checked:>4} checks ({n/checked:.0f}x faster)")
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function MerkleTreeLesson() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16 text-gray-200">
      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-4xl font-bold text-white">{meta.title}</h1>
        <p className="text-lg text-gray-400 leading-relaxed max-w-3xl">
          Two database replicas hold billions of rows. Something went wrong and they are out of sync.
          How do you find <em>which</em> rows differ? Comparing every row is O(n) and would take hours.
          A Merkle tree does it in O(log n) by hashing data into a tree and comparing just the roots.
        </p>
      </header>

      {/* Section: The Problem */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Problem: Efficient Data Verification</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-3">
          <p>
            Imagine you have two copies of a massive dataset — maybe two Cassandra replicas, two Git repositories,
            or two nodes in a blockchain network. You need to answer: <strong>are they identical?</strong> And if not,
            <strong> which parts differ?</strong>
          </p>
          <p>
            <strong>Naive approach:</strong> Compare every single item, one by one. For a billion rows, that means
            a billion comparisons across the network. This is O(n) and brutally slow.
          </p>
          <p>
            <strong>Merkle tree approach:</strong> Hash every data block (leaf). Pair up hashes and hash them
            together. Repeat until you get a single root hash. Now just compare the two root hashes. If they
            match, the entire datasets are identical. If they differ, walk down the tree to find exactly which
            branches diverge — checking only O(log n) nodes.
          </p>
        </div>
      </section>

      {/* Section: Interactive Merkle Tree */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Build and Tamper with a Merkle Tree</h2>
        <p className="text-gray-400">
          Click any <strong>data block</strong> below the tree to modify it. Watch how the hash change propagates
          upward through every ancestor node all the way to the root. Click a <strong>leaf node</strong> to see
          its verification path (the minimal set of hashes needed to prove that leaf is part of the tree).
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <MerkleTreeSketch />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400 space-y-2">
          <p><strong>Key insight:</strong> Changing even one byte in one data block changes every hash on
            the path from that leaf to the root. This is the &quot;tamper-evident&quot; property that makes Merkle
            trees the backbone of Git, blockchains, and certificate transparency.</p>
          <p><strong>Verification path:</strong> To prove a specific data block is part of the tree, you
            only need log(n) sibling hashes — not the entire dataset. This is how Bitcoin SPV
            (Simplified Payment Verification) works: a lightweight client can verify a transaction exists
            in a block by checking just ~20 hashes instead of downloading the entire block.</p>
        </div>
      </section>

      {/* Section: Real-World Applications */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Real-World Applications</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-sky-400">Cassandra Anti-Entropy</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Apache Cassandra uses Merkle trees for <strong>anti-entropy repair</strong>. Each replica builds a
              Merkle tree over its data ranges. Replicas exchange only root hashes. If roots differ, they
              drill down the tree to identify the exact key ranges that diverged, then sync only those rows.
              This turns a potentially massive data transfer into a lightweight tree comparison.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-emerald-400">Git Object Model</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every Git commit is essentially a Merkle tree. Files are hashed into &quot;blob&quot; objects, directories
              into &quot;tree&quot; objects (hashes of their children), and commits point to a root tree hash. Changing
              one file changes all parent tree hashes up to the root commit. This is why Git can instantly
              detect if two repositories are identical — just compare commit hashes.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-yellow-400">Blockchain / Bitcoin</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Transactions in a Bitcoin block form a Merkle tree. The root hash goes into the block header.
              <strong> SPV clients</strong> (e.g., mobile wallets) can verify a transaction exists in a block by
              requesting only the Merkle proof (~log(n) hashes) from a full node, without downloading the
              entire block. A block with 4,000 transactions needs only ~12 hashes for verification.
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800 space-y-3">
            <h3 className="text-lg font-semibold text-purple-400">Certificate Transparency</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Certificate Transparency logs use Merkle trees to create an append-only, tamper-evident log
              of all TLS certificates issued by certificate authorities. Anyone can verify that a certificate
              is included in the log (inclusion proof) or that the log has not been tampered with
              (consistency proof) — both using only O(log n) hashes.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Anti-Entropy Visualization */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Interactive: Anti-Entropy Replica Sync</h2>
        <p className="text-gray-400">
          Simulate two database replicas. Introduce differences in Replica B, then use Merkle tree comparison
          to efficiently locate and sync only the divergent rows.
        </p>
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <AntiEntropySketch />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
          <p><strong>How it works:</strong> (1) Both replicas build a Merkle tree over their data.
            (2) Exchange root hashes. If identical, done. (3) If different, exchange child hashes at
            the next level down. (4) Only descend into branches where hashes differ. (5) At the leaf
            level, you know exactly which rows diverged. (6) Sync only those rows. With 1 billion rows
            and 10 differences, you check ~300 nodes instead of 1 billion.</p>
        </div>
      </section>

      {/* Section: Python Implementation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implement: Merkle Tree with Proofs</h2>
        <p className="text-gray-400">
          Build a complete Merkle tree with construction, proof generation, verification, and tamper detection.
          This implementation mirrors how blockchains verify transactions.
        </p>
        <PythonCell defaultCode={merkleImplementation} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Simulate: Anti-Entropy Repair</h2>
        <p className="text-gray-400">
          Simulate two replicas with 256 rows where 5 have drifted. Use Merkle tree comparison to find
          divergent rows efficiently, then sync only those rows. Compare the number of nodes checked versus
          a naive full scan.
        </p>
        <PythonCell defaultCode={antiEntropySimulation} />
      </section>

      {/* Section: Complexity Analysis */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complexity Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-2 text-gray-300">Operation</th>
                <th className="px-4 py-2 text-gray-300">Time</th>
                <th className="px-4 py-2 text-gray-300">Space</th>
                <th className="px-4 py-2 text-gray-300">Notes</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Build tree</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(n)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(n)</td>
                <td className="px-4 py-2">Hash all leaves + build internal nodes</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Verify root</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(1)</td>
                <td className="px-4 py-2">Compare two root hashes</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Generate proof</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(log n)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(log n)</td>
                <td className="px-4 py-2">Collect sibling hashes from leaf to root</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Verify proof</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(log n)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(log n)</td>
                <td className="px-4 py-2">Recompute hashes along proof path</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="px-4 py-2">Find d differences</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(d log n)</td>
                <td className="px-4 py-2 font-mono text-emerald-400">O(log n)</td>
                <td className="px-4 py-2">Traverse only divergent branches</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Naive comparison</td>
                <td className="px-4 py-2 font-mono text-red-400">O(n)</td>
                <td className="px-4 py-2 font-mono text-red-400">O(1)</td>
                <td className="px-4 py-2">Check every single item</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section: Key Takeaways */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Key Takeaways</h2>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">1.</span>
            <span>Merkle trees reduce data verification from O(n) to O(log n) by hashing data into a binary tree. Comparing roots is O(1).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">2.</span>
            <span>Changing any leaf changes every hash on the path to the root, making tampering immediately detectable.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">3.</span>
            <span>Merkle proofs allow verifying a single item without the full dataset — critical for blockchain SPV and certificate transparency.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">4.</span>
            <span>Anti-entropy repair (Cassandra, DynamoDB) uses Merkle tree comparison to sync only divergent data ranges between replicas.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 font-bold shrink-0">5.</span>
            <span>Git&apos;s entire object model is a Merkle DAG — commits, trees, and blobs are all content-addressed by their hashes.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
