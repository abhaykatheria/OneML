import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/decision-trees',
  title: 'Decision Trees',
  description: 'Recursive partitioning, Gini impurity, and how trees carve up feature space with axis-aligned splits',
  track: 'classical',
  order: 7,
  tags: ['decision-tree', 'classification', 'gini', 'entropy', 'pruning'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function randn(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
}

interface DataPoint {
  x: number
  y: number
  label: number
}

const CLASS_COLORS: [number, number, number][] = [
  [99, 102, 241],   // indigo (class 0)
  [239, 68, 68],    // red (class 1)
  [52, 211, 153],   // emerald (class 2)
]

function generateTreeData(seed: number): DataPoint[] {
  const rng = makeRng(seed)
  const points: DataPoint[] = []
  // Class 0: top-left region
  for (let i = 0; i < 25; i++) {
    points.push({ x: 0.2 + randn(rng) * 0.12, y: 0.2 + randn(rng) * 0.12, label: 0 })
  }
  // Class 1: bottom-right region
  for (let i = 0; i < 25; i++) {
    points.push({ x: 0.75 + randn(rng) * 0.1, y: 0.7 + randn(rng) * 0.12, label: 1 })
  }
  // Class 0: some in bottom-left
  for (let i = 0; i < 12; i++) {
    points.push({ x: 0.2 + randn(rng) * 0.1, y: 0.75 + randn(rng) * 0.1, label: 0 })
  }
  // Class 1: some in top-right
  for (let i = 0; i < 12; i++) {
    points.push({ x: 0.8 + randn(rng) * 0.08, y: 0.2 + randn(rng) * 0.1, label: 1 })
  }
  return points
}

function giniImpurity(counts: number[], total: number): number {
  if (total === 0) return 0
  let sum = 0
  for (const c of counts) {
    const p = c / total
    sum += p * p
  }
  return 1 - sum
}

/* ------------------------------------------------------------------ */
/* Simple Decision Tree Implementation                                 */
/* ------------------------------------------------------------------ */

interface TreeNode {
  feature: 'x' | 'y'
  threshold: number
  left: TreeNode | TreeLeaf
  right: TreeNode | TreeLeaf
  depth: number
}

interface TreeLeaf {
  prediction: number
  counts: number[]
  depth: number
}

function isLeaf(node: TreeNode | TreeLeaf): node is TreeLeaf {
  return 'prediction' in node
}

function buildTree(
  points: DataPoint[],
  maxDepth: number,
  depth: number = 0,
  numClasses: number = 2
): TreeNode | TreeLeaf {
  // Count classes
  const counts = new Array(numClasses).fill(0)
  for (const pt of points) counts[pt.label]++

  // Stopping conditions
  const total = points.length
  if (depth >= maxDepth || total <= 2 || counts.some(c => c === total)) {
    return {
      prediction: counts.indexOf(Math.max(...counts)),
      counts,
      depth,
    }
  }

  // Find best split
  let bestGini = Infinity
  let bestFeature: 'x' | 'y' = 'x'
  let bestThreshold = 0.5

  for (const feature of ['x', 'y'] as const) {
    const values = points.map(pt => pt[feature]).sort((a, b) => a - b)
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2
      const leftCounts = new Array(numClasses).fill(0)
      const rightCounts = new Array(numClasses).fill(0)
      let leftTotal = 0, rightTotal = 0

      for (const pt of points) {
        if (pt[feature] <= threshold) {
          leftCounts[pt.label]++
          leftTotal++
        } else {
          rightCounts[pt.label]++
          rightTotal++
        }
      }

      const weightedGini =
        (leftTotal / total) * giniImpurity(leftCounts, leftTotal) +
        (rightTotal / total) * giniImpurity(rightCounts, rightTotal)

      if (weightedGini < bestGini) {
        bestGini = weightedGini
        bestFeature = feature
        bestThreshold = threshold
      }
    }
  }

  const leftPoints = points.filter(pt => pt[bestFeature] <= bestThreshold)
  const rightPoints = points.filter(pt => pt[bestFeature] > bestThreshold)

  if (leftPoints.length === 0 || rightPoints.length === 0) {
    return { prediction: counts.indexOf(Math.max(...counts)), counts, depth }
  }

  return {
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildTree(leftPoints, maxDepth, depth + 1, numClasses),
    right: buildTree(rightPoints, maxDepth, depth + 1, numClasses),
    depth,
  }
}

function treePredict(node: TreeNode | TreeLeaf, x: number, y: number): number {
  if (isLeaf(node)) return node.prediction
  const val = node.feature === 'x' ? x : y
  return val <= node.threshold
    ? treePredict(node.left, x, y)
    : treePredict(node.right, x, y)
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Gini Split                                  */
/* ------------------------------------------------------------------ */

function GiniSplitSketch() {
  const [splitPos, setSplitPos] = useState(0.5)
  const [splitAxis, setSplitAxis] = useState<'x' | 'y'>('x')

  const sketch = useCallback(
    (p: p5) => {
      const data = generateTreeData(42)
      const margin = 40

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 420)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Compute Gini for current split
        const leftCounts = [0, 0]
        const rightCounts = [0, 0]
        for (const pt of data) {
          const val = splitAxis === 'x' ? pt.x : pt.y
          if (val <= splitPos) leftCounts[pt.label]++
          else rightCounts[pt.label]++
        }
        const leftTotal = leftCounts[0] + leftCounts[1]
        const rightTotal = rightCounts[0] + rightCounts[1]
        const total = leftTotal + rightTotal
        const leftGini = giniImpurity(leftCounts, leftTotal)
        const rightGini = giniImpurity(rightCounts, rightTotal)
        const weightedGini = total > 0
          ? (leftTotal / total) * leftGini + (rightTotal / total) * rightGini
          : 0

        // Color the two regions
        const [splitSx, splitSy] = toScreen(
          splitAxis === 'x' ? splitPos : 0,
          splitAxis === 'y' ? splitPos : 0
        )

        p.noStroke()
        // Left/top region
        p.fill(99, 102, 241, 15)
        if (splitAxis === 'x') {
          p.rect(margin, margin, splitSx - margin, p.height - 2 * margin)
        } else {
          p.rect(margin, margin, p.width - 2 * margin, splitSy - margin)
        }
        // Right/bottom region
        p.fill(239, 68, 68, 15)
        if (splitAxis === 'x') {
          p.rect(splitSx, margin, p.width - margin - splitSx, p.height - 2 * margin)
        } else {
          p.rect(margin, splitSy, p.width - 2 * margin, p.height - margin - splitSy)
        }

        // Draw the split line
        p.stroke(250, 204, 21)
        p.strokeWeight(2.5)
        if (splitAxis === 'x') {
          p.line(splitSx, margin, splitSx, p.height - margin)
        } else {
          p.line(margin, splitSy, p.width - margin, splitSy)
        }

        // Data points
        for (const pt of data) {
          const [sx, sy] = toScreen(pt.x, pt.y)
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.noStroke()
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 10, 10)
        }

        // Gini info panel
        p.noStroke()
        p.fill(15, 23, 42, 200)
        p.rect(8, 8, 260, 95, 8)

        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Split: ${splitAxis} <= ${splitPos.toFixed(2)}`, 16, 14)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text(`Left:  ${leftTotal} pts  (Gini = ${leftGini.toFixed(4)})`, 16, 35)
        p.text(`Right: ${rightTotal} pts  (Gini = ${rightGini.toFixed(4)})`, 16, 52)

        p.fill(250, 204, 21)
        p.textSize(13)
        p.text(`Weighted Gini = ${weightedGini.toFixed(4)}`, 16, 75)

        // Instructions
        p.fill(100, 116, 139)
        p.textSize(11)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text('Drag the slider to find the best split position', 10, p.height - 5)
      }
    },
    [splitPos, splitAxis],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Split axis:
            <select
              value={splitAxis}
              onChange={(e) => setSplitAxis(e.target.value as 'x' | 'y')}
              className="rounded bg-gray-800 px-2 py-1 text-gray-200"
            >
              <option value="x">X (horizontal)</option>
              <option value="y">Y (vertical)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Split position:
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={splitPos}
              onChange={(e) => setSplitPos(parseFloat(e.target.value))}
              className="w-48 accent-yellow-400"
            />
            <span className="w-12 font-mono">{splitPos.toFixed(2)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Tree Depth and Decision Regions                         */
/* ------------------------------------------------------------------ */

function TreeDepthSketch() {
  const [maxDepth, setMaxDepth] = useState(3)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateTreeData(42)
      const margin = 40
      const tree = buildTree(data, maxDepth)

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      // Count tree nodes for display
      function countNodes(node: TreeNode | TreeLeaf): { splits: number; leaves: number } {
        if (isLeaf(node)) return { splits: 0, leaves: 1 }
        const left = countNodes(node.left)
        const right = countNodes(node.right)
        return { splits: 1 + left.splits + right.splits, leaves: left.leaves + right.leaves }
      }

      // Draw the tree split lines recursively
      function drawSplits(
        node: TreeNode | TreeLeaf,
        xMin: number, xMax: number,
        yMin: number, yMax: number
      ) {
        if (isLeaf(node)) return

        const threshold = node.threshold
        const alpha = 180 - node.depth * 30

        p.stroke(250, 204, 21, Math.max(alpha, 60))
        p.strokeWeight(Math.max(2.5 - node.depth * 0.4, 0.8))

        if (node.feature === 'x') {
          const [sx] = toScreen(threshold, 0)
          const [, syMin] = toScreen(0, yMin)
          const [, syMax] = toScreen(0, yMax)
          p.line(sx, syMin, sx, syMax)
          drawSplits(node.left, xMin, threshold, yMin, yMax)
          drawSplits(node.right, threshold, xMax, yMin, yMax)
        } else {
          const [, sy] = toScreen(0, threshold)
          const [sxMin] = toScreen(xMin, 0)
          const [sxMax] = toScreen(xMax, 0)
          p.line(sxMin, sy, sxMax, sy)
          drawSplits(node.left, xMin, xMax, yMin, threshold)
          drawSplits(node.right, xMin, xMax, threshold, yMax)
        }
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 440)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Draw decision regions
        const res = 6
        for (let sx = margin; sx < p.width - margin; sx += res) {
          for (let sy = margin; sy < p.height - margin; sy += res) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const pred = treePredict(tree, nx, ny)
            const [r, g, b] = CLASS_COLORS[pred]
            p.noStroke()
            p.fill(r, g, b, 30)
            p.rect(sx, sy, res, res)
          }
        }

        // Draw split lines
        drawSplits(tree, 0, 1, 0, 1)

        // Data points
        for (const pt of data) {
          const [sx, sy] = toScreen(pt.x, pt.y)
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.noStroke()
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 10, 10)
        }

        // Info
        const { splits, leaves } = countNodes(tree)

        p.noStroke()
        p.fill(15, 23, 42, 200)
        p.rect(8, 8, 200, 72, 8)

        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Max depth: ${maxDepth}`, 16, 14)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text(`Split nodes: ${splits}`, 16, 34)
        p.text(`Leaf nodes: ${leaves}`, 16, 50)

        // Overfit / underfit indicator
        p.fill(maxDepth <= 1 ? [239, 68, 68] : maxDepth <= 4 ? [52, 211, 153] : [250, 204, 21])
        p.textSize(11)
        p.textAlign(p.RIGHT, p.TOP)
        const status = maxDepth <= 1 ? 'Underfitting' : maxDepth <= 4 ? 'Good fit' : 'Overfitting risk'
        p.text(status, p.width - 10, 10)

        p.noLoop()
      }
    },
    [maxDepth],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Max depth:
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value))}
              className="w-48 accent-emerald-400"
            />
            <span className="w-6 font-mono">{maxDepth}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Animated Tree Building                                  */
/* ------------------------------------------------------------------ */

function TreeBuildingSketch() {
  const sketch = useCallback((p: p5) => {
    const data = generateTreeData(42)
    const margin = 40
    let animStep = 0
    const maxAnimSteps = 7

    // Pre-build trees at each depth for animation
    const trees: (TreeNode | TreeLeaf)[] = []
    for (let d = 0; d <= maxAnimSteps; d++) {
      trees.push(buildTree(data, d))
    }

    function toScreen(nx: number, ny: number): [number, number] {
      return [
        margin + nx * (p.width - 2 * margin),
        margin + ny * (p.height - 2 * margin),
      ]
    }

    function drawSplits(
      node: TreeNode | TreeLeaf,
      xMin: number, xMax: number,
      yMin: number, yMax: number
    ) {
      if (isLeaf(node)) return
      p.stroke(250, 204, 21, 180 - node.depth * 25)
      p.strokeWeight(Math.max(2.5 - node.depth * 0.3, 0.8))

      if (node.feature === 'x') {
        const [sx] = toScreen(node.threshold, 0)
        const [, syMin] = toScreen(0, yMin)
        const [, syMax] = toScreen(0, yMax)
        p.line(sx, syMin, sx, syMax)
        drawSplits(node.left, xMin, node.threshold, yMin, yMax)
        drawSplits(node.right, node.threshold, xMax, yMin, yMax)
      } else {
        const [, sy] = toScreen(0, node.threshold)
        const [sxMin] = toScreen(xMin, 0)
        const [sxMax] = toScreen(xMax, 0)
        p.line(sxMin, sy, sxMax, sy)
        drawSplits(node.left, xMin, xMax, yMin, node.threshold)
        drawSplits(node.right, xMin, xMax, node.threshold, yMax)
      }
    }

    let frameCount = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 600
      p.createCanvas(pw, 420)
      p.frameRate(30)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frameCount++

      // Advance animation every 60 frames
      if (frameCount % 60 === 0 && animStep < maxAnimSteps) {
        animStep++
      }

      const currentTree = trees[animStep]

      // Draw regions
      const res = 8
      for (let sx = margin; sx < p.width - margin; sx += res) {
        for (let sy = margin; sy < p.height - margin; sy += res) {
          const nx = (sx - margin) / (p.width - 2 * margin)
          const ny = (sy - margin) / (p.height - 2 * margin)
          const pred = treePredict(currentTree, nx, ny)
          const [r, g, b] = CLASS_COLORS[pred]
          p.noStroke()
          p.fill(r, g, b, 25)
          p.rect(sx, sy, res, res)
        }
      }

      // Draw splits
      drawSplits(currentTree, 0, 1, 0, 1)

      // Data points
      for (const pt of data) {
        const [sx, sy] = toScreen(pt.x, pt.y)
        const [r, g, b] = CLASS_COLORS[pt.label]
        p.noStroke()
        p.fill(r, g, b, 220)
        p.ellipse(sx, sy, 10, 10)
      }

      // Info
      p.noStroke()
      p.fill(226, 232, 240)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Building tree... Depth: ${animStep}`, 10, 10)

      // Progress bar
      p.fill(30, 41, 59)
      p.rect(10, 32, 200, 6, 3)
      p.fill(52, 211, 153)
      p.rect(10, 32, 200 * (animStep / maxAnimSteps), 6, 3)

      if (animStep >= maxAnimSteps) {
        p.fill(148, 163, 184)
        p.textSize(11)
        p.text('Animation complete. Click to restart.', 10, 44)
      }
    }

    p.mousePressed = () => {
      if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
        animStep = 0
        frameCount = 0
      }
    }
  }, [])

  return <P5Sketch sketch={sketch} height={420} />
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function DecisionTrees() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1 — The Flowchart Metaphor ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">1. The Flowchart Metaphor</h2>
        <p className="mb-4 leading-relaxed">
          A decision tree is exactly what it sounds like: a flowchart that asks a series of yes/no
          questions about your data, each time narrowing down the possibilities until it arrives at a
          prediction. You have probably used decision trees your entire life without knowing it.
          &ldquo;Is it raining? If yes, take an umbrella. If no, is it cloudy? If yes, bring a jacket...&rdquo;
        </p>
        <p className="mb-4 leading-relaxed">
          In machine learning, decision trees formalize this intuition. Each internal node tests a
          <span className="text-white font-semibold"> feature</span> against a
          <span className="text-white font-semibold"> threshold</span> (e.g., &ldquo;Is age &gt; 30?&rdquo;).
          Each branch represents the outcome of that test. Each leaf node contains a
          <span className="text-white font-semibold"> prediction</span> — the most common class
          among the training samples that reached that leaf.
        </p>
        <p className="mb-4 leading-relaxed">
          The beauty of decision trees is their <span className="text-white font-semibold">interpretability</span>.
          Unlike neural networks or SVMs, you can look at a decision tree and understand exactly why
          it made a particular prediction. This transparency makes them the gold standard in domains
          like medicine, law, and finance where explainability is required.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Key Terminology</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Root node:</span> The first split at the top of the tree</li>
            <li><span className="text-white">Internal node:</span> A node that tests a feature and branches into children</li>
            <li><span className="text-white">Leaf node:</span> A terminal node that holds a prediction</li>
            <li><span className="text-white">Depth:</span> The length of the longest path from root to leaf</li>
            <li><span className="text-white">Split:</span> The feature + threshold combination at each internal node</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 2 — How Splits Are Chosen ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">2. How Splits Are Chosen: Gini Impurity</h2>
        <p className="mb-4 leading-relaxed">
          The algorithm must decide, at each node, which feature and which threshold to split on.
          The goal is to make each child node as <span className="text-white font-semibold">pure</span> as
          possible — ideally containing only one class. But how do we measure purity?
        </p>
        <p className="mb-4 leading-relaxed">
          <span className="text-white font-semibold">Gini impurity</span> is the most common criterion.
          For a node with class proportions p<sub>1</sub>, p<sub>2</sub>, ..., p<sub>k</sub>, the Gini
          impurity is: G = 1 - &sum; p<sub>i</sub>&sup2;. A pure node (all one class) has G = 0. A maximally
          impure node (50/50 split in binary) has G = 0.5.
        </p>
        <p className="mb-4 leading-relaxed">
          At each step, the tree tries every possible feature and every possible threshold, computes
          the <span className="text-white font-semibold">weighted average Gini</span> of the two resulting
          child nodes, and picks the split that minimizes this value. This is a greedy algorithm — it
          makes the locally optimal choice at each step without backtracking.
        </p>
        <p className="mb-4 leading-relaxed">
          In the visualization below, drag the split line and watch the Gini impurity update in real time.
          Try to find the position that minimizes the weighted Gini. Notice how the best split cleanly
          separates the two classes.
        </p>
        <GiniSplitSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Gini vs. Entropy</h3>
          <p className="text-gray-300">
            An alternative to Gini is <span className="text-white">information gain</span> (entropy reduction):
            H = -&sum; p<sub>i</sub> log<sub>2</sub>(p<sub>i</sub>). In practice, Gini and entropy produce
            nearly identical trees. Gini is slightly faster to compute (no logarithm), which is why
            scikit-learn uses it as the default. The key insight is the same: we want child nodes to be
            as pure as possible.
          </p>
        </div>
      </section>

      {/* ========== Section 3 — Building the Tree ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">3. Building the Tree: Recursive Partitioning</h2>
        <p className="mb-4 leading-relaxed">
          A decision tree is built top-down by recursively partitioning the data. At each node, we
          find the best split, divide the data into two groups, and repeat the process on each group.
          This creates a hierarchy of axis-aligned splits that carve the feature space into rectangular
          regions, each assigned to a class.
        </p>
        <p className="mb-4 leading-relaxed">
          Watch the animation below as the tree grows from depth 0 (a single leaf predicting the
          majority class) through deeper splits. At each depth level, new split lines appear and the
          decision regions become more refined. Click the canvas to restart the animation.
        </p>
        <TreeBuildingSketch />
        <p className="mt-4 leading-relaxed text-gray-400">
          Notice the key limitation: decision trees can only make <span className="text-white">axis-aligned</span> splits.
          Each split is a horizontal or vertical line. This means trees need many splits to approximate
          a diagonal boundary, which is why they tend to produce &ldquo;staircase&rdquo; patterns.
          Ensembles like random forests overcome this by averaging many such staircase boundaries.
        </p>
      </section>

      {/* ========== Section 4 — Controlling Depth ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">4. Controlling Depth: The Bias-Variance Trade-Off</h2>
        <p className="mb-4 leading-relaxed">
          A decision tree with unlimited depth will keep splitting until every leaf is pure — perfectly
          classifying every training point. But this means the tree has memorized the training data,
          including its noise. This is <span className="text-white font-semibold">overfitting</span> at
          its most extreme.
        </p>
        <p className="mb-4 leading-relaxed">
          The <span className="text-white font-semibold">max_depth</span> hyperparameter is the primary
          control against overfitting. A shallow tree (depth 1-2) is a &ldquo;decision stump&rdquo; — it
          makes very few distinctions and likely underfits. A deep tree (depth 10+) fits every quirk
          of the training data. The sweet spot is usually depth 3-6 for most datasets.
        </p>
        <p className="mb-4 leading-relaxed">
          Use the slider below to explore how depth affects the decision regions. At depth 1, you see
          a single split line. As depth increases, the regions become more complex and the tree can
          capture finer patterns — but eventually it starts fitting noise.
        </p>
        <TreeDepthSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Other Regularization Methods</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">min_samples_split:</span> Minimum samples required to split a node (default: 2)</li>
            <li><span className="text-white">min_samples_leaf:</span> Minimum samples required in a leaf node</li>
            <li><span className="text-white">max_leaf_nodes:</span> Maximum number of leaf nodes</li>
            <li><span className="text-white">max_features:</span> Maximum features to consider per split (crucial for random forests)</li>
            <li><span className="text-white">Pruning:</span> Grow a full tree, then remove splits that do not improve validation accuracy</li>
          </ul>
        </div>
      </section>

      {/* ========== Section 5 — Feature Importance ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">5. Feature Importance</h2>
        <p className="mb-4 leading-relaxed">
          One of the most valuable outputs of a decision tree is a ranking of
          <span className="text-white font-semibold"> feature importances</span>. The importance of a
          feature is computed as the total reduction in impurity (Gini or entropy) that the feature
          provides across all splits in the tree, weighted by the number of samples reaching each node.
        </p>
        <p className="mb-4 leading-relaxed">
          Features that appear higher in the tree (closer to the root) and split large numbers of
          samples have higher importance. Features that are never used in a split have zero importance.
          This gives us a simple and powerful tool for understanding which variables drive the model&apos;s
          predictions.
        </p>
        <p className="mb-4 leading-relaxed">
          The code below trains a decision tree on the Iris dataset and displays feature importances.
          It also prints the text representation of the tree so you can trace the decision logic.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import train_test_split

# Load Iris dataset
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.3, random_state=42
)

# Train decision tree
tree = DecisionTreeClassifier(max_depth=3, random_state=42)
tree.fit(X_train, y_train)

# Feature importance
print("Feature Importances:")
for name, imp in sorted(
    zip(iris.feature_names, tree.feature_importances_),
    key=lambda x: -x[1]
):
    bar = "#" * int(imp * 40)
    print(f"  {name:>20}: {imp:.4f} {bar}")

print(f"\\nTrain accuracy: {tree.score(X_train, y_train):.4f}")
print(f"Test accuracy:  {tree.score(X_test, y_test):.4f}")

print("\\nDecision Tree Rules:")
print(export_text(tree, feature_names=iris.feature_names, max_depth=3))
`}
          title="Decision Tree on Iris Dataset"
        />
      </section>

      {/* ========== Section 6 — Overfitting in Action ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">6. Overfitting in Action</h2>
        <p className="mb-4 leading-relaxed">
          Decision trees are notorious for overfitting. Without depth limits, they achieve 100% training
          accuracy by creating a leaf for every single training sample. But this perfect training
          performance does not transfer to new data. The code below demonstrates this dramatically:
          as max_depth increases, training accuracy reaches 1.0 while test accuracy peaks and then drops.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import make_moons
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split

X, y = make_moons(n_samples=300, noise=0.3, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

print(f"{'Depth':>6} | {'Train Acc':>10} | {'Test Acc':>10} | {'Leaves':>8}")
print("-" * 45)

for depth in [1, 2, 3, 4, 5, 7, 10, 15, None]:
    tree = DecisionTreeClassifier(max_depth=depth, random_state=42)
    tree.fit(X_train, y_train)
    train_acc = tree.score(X_train, y_train)
    test_acc = tree.score(X_test, y_test)
    label = str(depth) if depth else "None"
    print(f"{label:>6} | {train_acc:>10.4f} | {test_acc:>10.4f} | {tree.get_n_leaves():>8}")

print("\\nNotice: unlimited depth gives 100% train accuracy")
print("but test accuracy is LOWER than depth=4-5!")
`}
          title="Depth vs. Overfitting"
        />
      </section>

      {/* ========== Section 7 — Strengths and Weaknesses ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">7. Strengths and Weaknesses</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Strengths</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Interpretable:</span> You can read and explain the decision rules to a non-technical audience</li>
            <li><span className="text-white">No feature scaling:</span> Trees are invariant to monotonic transformations of features</li>
            <li><span className="text-white">Handles mixed types:</span> Numeric and categorical features coexist naturally</li>
            <li><span className="text-white">Fast:</span> Training is O(n &times; m &times; log n) where n is samples and m is features</li>
            <li><span className="text-white">Feature selection built-in:</span> Unimportant features are simply not used in splits</li>
          </ul>
        </div>
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Weaknesses</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">High variance:</span> Small changes in data can produce completely different trees</li>
            <li><span className="text-white">Axis-aligned only:</span> Cannot efficiently capture diagonal or curved boundaries</li>
            <li><span className="text-white">Greedy:</span> Each split is locally optimal but the overall tree may not be globally optimal</li>
            <li><span className="text-white">Overfitting prone:</span> Without careful regularization, trees memorize noise</li>
            <li><span className="text-white">Instability:</span> The root cause of why ensembles (random forests, boosting) exist</li>
          </ul>
        </div>
        <p className="mt-4 leading-relaxed text-gray-400">
          The high variance of individual trees is actually a feature, not a bug — it is the foundation
          of ensemble methods. In the next lesson, we will see how random forests exploit this instability
          by training many diverse trees and averaging their predictions, dramatically reducing variance
          while maintaining the low bias of deep trees.
        </p>
      </section>
    </article>
  )
}
