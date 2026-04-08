import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/random-forests',
  title: 'Random Forests & Bagging',
  description: 'Bootstrap aggregating, random feature selection, and how ensembles of weak trees outperform any single tree',
  track: 'classical',
  order: 8,
  tags: ['random-forest', 'bagging', 'ensemble', 'bootstrap', 'variance-reduction'],
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
]

function generateForestData(seed: number): DataPoint[] {
  const rng = makeRng(seed)
  const points: DataPoint[] = []
  // Two interleaving crescents (moon-like)
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI
    points.push({
      x: 0.3 + Math.cos(angle) * 0.25 + randn(rng) * 0.04,
      y: 0.4 + Math.sin(angle) * 0.25 + randn(rng) * 0.04,
      label: 0,
    })
  }
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI
    points.push({
      x: 0.55 + Math.cos(angle + Math.PI) * 0.25 + randn(rng) * 0.04,
      y: 0.55 + Math.sin(angle + Math.PI) * 0.25 + randn(rng) * 0.04,
      label: 1,
    })
  }
  return points
}

/* ------------------------------------------------------------------ */
/* Simple Decision Tree (reused from DecisionTrees lesson)             */
/* ------------------------------------------------------------------ */

interface TreeNode {
  feature: 'x' | 'y'
  threshold: number
  left: TreeNode | TreeLeaf
  right: TreeNode | TreeLeaf
}

interface TreeLeaf {
  prediction: number
}

function isLeaf(node: TreeNode | TreeLeaf): node is TreeLeaf {
  return 'prediction' in node
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

function buildTree(
  points: DataPoint[],
  maxDepth: number,
  rng: () => number,
  maxFeatures: number = 2,
  depth: number = 0,
): TreeNode | TreeLeaf {
  const counts = [0, 0]
  for (const pt of points) counts[pt.label]++
  const total = points.length

  if (depth >= maxDepth || total <= 2 || counts[0] === 0 || counts[1] === 0) {
    return { prediction: counts[0] >= counts[1] ? 0 : 1 }
  }

  // Random feature selection
  const features: ('x' | 'y')[] = ['x', 'y']
  const selectedFeatures: ('x' | 'y')[] = []
  const available = [...features]
  for (let i = 0; i < Math.min(maxFeatures, features.length); i++) {
    const idx = Math.floor(rng() * available.length)
    selectedFeatures.push(available[idx])
    available.splice(idx, 1)
  }

  let bestGini = Infinity
  let bestFeature: 'x' | 'y' = 'x'
  let bestThreshold = 0.5

  for (const feature of selectedFeatures) {
    const values = points.map(pt => pt[feature]).sort((a, b) => a - b)
    // Sample a subset of thresholds for speed
    const step = Math.max(1, Math.floor(values.length / 15))
    for (let i = 0; i < values.length - 1; i += step) {
      const threshold = (values[i] + values[i + 1]) / 2
      const lc = [0, 0], rc = [0, 0]
      let lt = 0, rt = 0

      for (const pt of points) {
        if (pt[feature] <= threshold) { lc[pt.label]++; lt++ }
        else { rc[pt.label]++; rt++ }
      }

      const wg = (lt / total) * giniImpurity(lc, lt) + (rt / total) * giniImpurity(rc, rt)
      if (wg < bestGini) {
        bestGini = wg
        bestFeature = feature
        bestThreshold = threshold
      }
    }
  }

  const leftPts = points.filter(pt => pt[bestFeature] <= bestThreshold)
  const rightPts = points.filter(pt => pt[bestFeature] > bestThreshold)

  if (leftPts.length === 0 || rightPts.length === 0) {
    return { prediction: counts[0] >= counts[1] ? 0 : 1 }
  }

  return {
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildTree(leftPts, maxDepth, rng, maxFeatures, depth + 1),
    right: buildTree(rightPts, maxDepth, rng, maxFeatures, depth + 1),
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
/* Bootstrap sampling                                                  */
/* ------------------------------------------------------------------ */

function bootstrapSample(data: DataPoint[], rng: () => number): DataPoint[] {
  const sample: DataPoint[] = []
  for (let i = 0; i < data.length; i++) {
    const idx = Math.floor(rng() * data.length)
    sample.push(data[idx])
  }
  return sample
}

/* ------------------------------------------------------------------ */
/* Section 1 — Bootstrap Samples Visualization                         */
/* ------------------------------------------------------------------ */

function BootstrapSketch() {
  const [sampleIdx, setSampleIdx] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateForestData(42)
      const margin = 40
      const rng = makeRng(100 + sampleIdx * 37)
      const sample = bootstrapSample(data, rng)

      // Track which original points are in the sample
      const inSample = new Set<number>()
      for (const spt of sample) {
        for (let i = 0; i < data.length; i++) {
          if (data[i].x === spt.x && data[i].y === spt.y) {
            inSample.add(i)
            break
          }
        }
      }

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 400)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Draw all original points (dimmed if not in sample)
        for (let i = 0; i < data.length; i++) {
          const [sx, sy] = toScreen(data[i].x, data[i].y)
          const [r, g, b] = CLASS_COLORS[data[i].label]
          const inBag = inSample.has(i)

          p.noStroke()
          if (inBag) {
            p.fill(r, g, b, 220)
            p.ellipse(sx, sy, 11, 11)
            // Small ring to indicate selected
            p.stroke(255, 255, 255, 100)
            p.strokeWeight(1)
            p.noFill()
            p.ellipse(sx, sy, 16, 16)
          } else {
            p.fill(r, g, b, 40)
            p.ellipse(sx, sy, 8, 8)
          }
        }

        // Info
        const oobCount = data.length - inSample.size
        const oobPct = ((oobCount / data.length) * 100).toFixed(1)

        p.noStroke()
        p.fill(15, 23, 42, 200)
        p.rect(8, 8, 280, 72, 8)

        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Bootstrap Sample #${sampleIdx + 1}`, 16, 14)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text(`Sampled: ${sample.length} points (with replacement)`, 16, 34)
        p.text(`Unique in bag: ${inSample.size} | Out-of-bag: ${oobCount} (${oobPct}%)`, 16, 50)

        // Legend
        p.fill(226, 232, 240)
        p.textSize(10)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text('Bright = in sample | Dim = out-of-bag (OOB)', 10, p.height - 5)

        p.noLoop()
      }
    },
    [sampleIdx],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Bootstrap sample:
            <input
              type="range"
              min={0}
              max={9}
              step={1}
              value={sampleIdx}
              onChange={(e) => setSampleIdx(parseInt(e.target.value))}
              className="w-48 accent-indigo-400"
            />
            <span className="w-6 font-mono">#{sampleIdx + 1}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Trees Voting One by One                                 */
/* ------------------------------------------------------------------ */

function VotingSketch() {
  const [numTrees, setNumTrees] = useState(1)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateForestData(42)
      const margin = 40

      // Build multiple trees on bootstrap samples
      const trees: (TreeNode | TreeLeaf)[] = []
      for (let t = 0; t < 20; t++) {
        const treeRng = makeRng(200 + t * 53)
        const sample = bootstrapSample(data, treeRng)
        const fitRng = makeRng(300 + t * 71)
        trees.push(buildTree(sample, 4, fitRng, 1))
      }

      // Ensemble prediction: majority vote of first numTrees trees
      function ensemblePredict(x: number, y: number): { pred: number; votes: number[] } {
        const votes = [0, 0]
        for (let t = 0; t < numTrees; t++) {
          votes[treePredict(trees[t], x, y)]++
        }
        return { pred: votes[0] >= votes[1] ? 0 : 1, votes }
      }

      function toScreen(nx: number, ny: number): [number, number] {
        return [
          margin + nx * (p.width - 2 * margin),
          margin + ny * (p.height - 2 * margin),
        ]
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 600
        p.createCanvas(pw, 440)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Draw ensemble decision regions
        const res = 8
        for (let sx = margin; sx < p.width - margin; sx += res) {
          for (let sy = margin; sy < p.height - margin; sy += res) {
            const nx = (sx - margin) / (p.width - 2 * margin)
            const ny = (sy - margin) / (p.height - 2 * margin)
            const { pred, votes } = ensemblePredict(nx, ny)
            const [r, g, b] = CLASS_COLORS[pred]
            // Confidence based on vote margin
            const confidence = Math.max(...votes) / numTrees
            p.noStroke()
            p.fill(r, g, b, 15 + confidence * 30)
            p.rect(sx, sy, res, res)
          }
        }

        // Data points
        for (const pt of data) {
          const [sx, sy] = toScreen(pt.x, pt.y)
          const [r, g, b] = CLASS_COLORS[pt.label]
          p.noStroke()
          p.fill(r, g, b, 220)
          p.ellipse(sx, sy, 9, 9)
        }

        // Compute training accuracy
        let correct = 0
        for (const pt of data) {
          if (ensemblePredict(pt.x, pt.y).pred === pt.label) correct++
        }
        const accuracy = correct / data.length

        // Info panel
        p.noStroke()
        p.fill(15, 23, 42, 200)
        p.rect(8, 8, 240, 72, 8)

        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Trees voting: ${numTrees} / 20`, 16, 14)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.text(`Training accuracy: ${(accuracy * 100).toFixed(1)}%`, 16, 34)

        p.fill(numTrees === 1 ? [239, 68, 68] : [52, 211, 153])
        p.textSize(11)
        p.text(
          numTrees === 1
            ? 'Single tree: high variance boundary'
            : numTrees < 5
              ? 'Few trees: boundary stabilizing...'
              : 'Many trees: smooth, stable boundary',
          16, 52
        )

        // Draw tree icons
        const iconX = p.width - margin - 10
        const iconY = margin + 10
        for (let t = 0; t < Math.min(numTrees, 20); t++) {
          const row = Math.floor(t / 5)
          const col = t % 5
          const ix = iconX - col * 18
          const iy = iconY + row * 22
          p.fill(52, 211, 153, 180)
          p.noStroke()
          // Simple tree icon: triangle + rect
          p.triangle(ix, iy - 6, ix - 5, iy + 3, ix + 5, iy + 3)
          p.rect(ix - 1.5, iy + 3, 3, 5)
        }

        p.noLoop()
      }
    },
    [numTrees],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Number of trees:
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={numTrees}
              onChange={(e) => setNumTrees(parseInt(e.target.value))}
              className="w-48 accent-emerald-400"
            />
            <span className="w-8 font-mono">{numTrees}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Error vs Number of Trees                                */
/* ------------------------------------------------------------------ */

function ErrorVsTreesSketch() {
  const sketch = useCallback((p: p5) => {
    // Pre-compute error at different ensemble sizes
    const data = generateForestData(42)

    // Build 50 trees
    const trees: (TreeNode | TreeLeaf)[] = []
    for (let t = 0; t < 50; t++) {
      const treeRng = makeRng(500 + t * 41)
      const sample = bootstrapSample(data, treeRng)
      const fitRng = makeRng(600 + t * 67)
      trees.push(buildTree(sample, 4, fitRng, 1))
    }

    // Hold-out "test" data
    const testData = generateForestData(999)

    // Compute error for each ensemble size
    const treeCounts = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50]
    const trainErrors: number[] = []
    const testErrors: number[] = []

    for (const nTrees of treeCounts) {
      let trainCorrect = 0
      let testCorrect = 0

      for (const pt of data) {
        const votes = [0, 0]
        for (let t = 0; t < nTrees; t++) votes[treePredict(trees[t], pt.x, pt.y)]++
        if ((votes[0] >= votes[1] ? 0 : 1) === pt.label) trainCorrect++
      }

      for (const pt of testData) {
        const votes = [0, 0]
        for (let t = 0; t < nTrees; t++) votes[treePredict(trees[t], pt.x, pt.y)]++
        if ((votes[0] >= votes[1] ? 0 : 1) === pt.label) testCorrect++
      }

      trainErrors.push(1 - trainCorrect / data.length)
      testErrors.push(1 - testCorrect / testData.length)
    }

    let animProgress = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 600
      p.createCanvas(pw, 380)
      animProgress = 0
    }

    p.draw = () => {
      p.background(15, 23, 42)
      animProgress = Math.min(1, animProgress + 0.008)

      const plotMargin = 60
      const plotW = p.width - plotMargin * 2
      const plotH = p.height - plotMargin * 2

      const maxTrees = 55
      const maxError = 0.35

      function mx(n: number): number {
        return plotMargin + (n / maxTrees) * plotW
      }
      function my(err: number): number {
        return p.height - plotMargin - (err / maxError) * plotH
      }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(plotMargin, p.height - plotMargin, p.width - plotMargin, p.height - plotMargin)
      p.line(plotMargin, plotMargin, plotMargin, p.height - plotMargin)

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(0.5)
      for (let e = 0.05; e <= 0.3; e += 0.05) {
        p.line(plotMargin, my(e), p.width - plotMargin, my(e))
      }

      // Labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Number of Trees', p.width / 2, p.height - 18)

      p.push()
      p.translate(16, p.height / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Error Rate', 0, 0)
      p.pop()

      // Y ticks
      p.textSize(10)
      p.textAlign(p.RIGHT, p.CENTER)
      p.fill(100, 116, 139)
      for (let e = 0; e <= 0.3; e += 0.05) {
        p.text(e.toFixed(2), plotMargin - 6, my(e))
      }

      // X ticks
      p.textAlign(p.CENTER, p.TOP)
      for (const n of [1, 5, 10, 20, 30, 40, 50]) {
        p.text(n.toString(), mx(n), p.height - plotMargin + 6)
      }

      const nVisible = Math.ceil(treeCounts.length * animProgress)

      // Train error curve
      p.noFill()
      p.stroke(99, 102, 241)
      p.strokeWeight(2)
      p.beginShape()
      for (let i = 0; i < nVisible; i++) {
        p.vertex(mx(treeCounts[i]), my(trainErrors[i]))
      }
      p.endShape()

      // Test error curve
      p.stroke(239, 68, 68)
      p.strokeWeight(2)
      p.beginShape()
      for (let i = 0; i < nVisible; i++) {
        p.vertex(mx(treeCounts[i]), my(testErrors[i]))
      }
      p.endShape()

      // Points
      p.noStroke()
      for (let i = 0; i < nVisible; i++) {
        p.fill(99, 102, 241)
        p.ellipse(mx(treeCounts[i]), my(trainErrors[i]), 6, 6)
        p.fill(239, 68, 68)
        p.ellipse(mx(treeCounts[i]), my(testErrors[i]), 6, 6)
      }

      // Legend
      const lx = p.width - plotMargin - 120
      const ly = plotMargin + 10
      p.fill(99, 102, 241)
      p.ellipse(lx, ly, 8, 8)
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Train error', lx + 10, ly)
      p.fill(239, 68, 68)
      p.ellipse(lx, ly + 18, 8, 8)
      p.fill(148, 163, 184)
      p.text('Test error', lx + 10, ly + 18)

      // Annotation
      if (animProgress > 0.7) {
        p.fill(52, 211, 153, Math.min(255, (animProgress - 0.7) * 600))
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text('More trees = lower error, diminishing returns', plotMargin + 10, plotMargin + 5)
        p.text('Random forests do NOT overfit with more trees!', plotMargin + 10, plotMargin + 20)
      }
    }
  }, [])

  return <P5Sketch sketch={sketch} height={380} />
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function RandomForests() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1 — The Wisdom of Crowds ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">1. The Wisdom of Crowds</h2>
        <p className="mb-4 leading-relaxed">
          In 1906, Francis Galton observed that the median guess of a crowd at a county fair for the
          weight of an ox was within 1% of the true weight — better than any individual expert. This
          phenomenon, the <span className="text-white font-semibold">wisdom of crowds</span>, is
          the core insight behind ensemble methods in machine learning.
        </p>
        <p className="mb-4 leading-relaxed">
          A single decision tree is like a single person&apos;s guess — it might be good, but it is
          unreliable. It has <span className="text-white font-semibold">high variance</span>: small
          changes in the training data can produce completely different trees. But if we train many
          different trees and let them vote, the errors of individual trees cancel out, and the
          collective prediction becomes remarkably stable and accurate.
        </p>
        <p className="mb-4 leading-relaxed">
          This is the idea behind <span className="text-white font-semibold">Random Forests</span>,
          introduced by Leo Breiman in 2001. It combines two powerful techniques:
          <span className="text-white font-semibold"> bootstrap aggregating</span> (bagging) to create
          diverse training sets, and <span className="text-white font-semibold">random feature selection</span> to
          ensure the trees are different from each other. The result is one of the most reliable and
          widely-used algorithms in all of machine learning.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Why Ensembles Work: The Math</h3>
          <p className="text-gray-300 mb-2">
            If you have N independent estimators, each with variance &sigma;&sup2;, the variance of their
            average is &sigma;&sup2;/N. More trees = lower variance. The key requirement is that the
            trees must be <span className="text-white">diverse</span> — if they all make the same
            errors, averaging does not help.
          </p>
          <p className="text-gray-300">
            Random forests achieve diversity through (1) training each tree on a different bootstrap
            sample, and (2) considering only a random subset of features at each split.
          </p>
        </div>
      </section>

      {/* ========== Section 2 — Bootstrap Aggregating (Bagging) ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">2. Bootstrap Aggregating (Bagging)</h2>
        <p className="mb-4 leading-relaxed">
          <span className="text-white font-semibold">Bootstrapping</span> is a statistical technique
          where you create a new dataset by sampling <span className="text-white">with replacement</span> from
          the original data. Each bootstrap sample has the same size as the original, but some points
          appear multiple times while others are left out entirely.
        </p>
        <p className="mb-4 leading-relaxed">
          On average, each bootstrap sample contains about 63.2% of the unique original data points.
          The remaining 36.8% are called the <span className="text-white font-semibold">out-of-bag (OOB)</span> samples.
          This is not a bug — it is a feature. The OOB samples serve as a free validation set for each
          tree, allowing us to estimate generalization error without a separate test split.
        </p>
        <p className="mb-4 leading-relaxed">
          In the visualization below, cycle through different bootstrap samples. Bright points are
          &ldquo;in the bag&rdquo; (selected for this sample). Dim points are out-of-bag. Notice how
          each sample creates a different view of the data, which means each tree trained on a
          bootstrap sample will learn slightly different patterns.
        </p>
        <BootstrapSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Why 63.2%?</h3>
          <p className="text-gray-300">
            For a dataset of n points, the probability that a specific point is NOT chosen in any
            single draw is (1 - 1/n). Over n draws with replacement, the probability it is never
            chosen is (1 - 1/n)<sup>n</sup>, which converges to 1/e &asymp; 0.368 as n grows.
            So about 36.8% of points are out-of-bag, and 63.2% are in-bag.
          </p>
        </div>
      </section>

      {/* ========== Section 3 — Random Feature Selection ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">3. Random Feature Selection</h2>
        <p className="mb-4 leading-relaxed">
          Bagging alone is not enough. If there is one dominant feature (say, &ldquo;income&rdquo; in a
          credit risk dataset), every tree will use that feature for the first split, making all trees
          highly correlated. Correlated estimators averaging together does not reduce variance much.
        </p>
        <p className="mb-4 leading-relaxed">
          Random forests add a second source of randomness: at each split, instead of considering all
          features, the algorithm randomly selects a <span className="text-white font-semibold">subset</span> of
          features and finds the best split only among those. The typical rule of thumb is
          <span className="text-white"> sqrt(m)</span> features for classification and
          <span className="text-white"> m/3</span> for regression, where m is the total number of features.
        </p>
        <p className="mb-4 leading-relaxed">
          This forces trees to explore different aspects of the data. Some trees might split on feature
          A first, while others split on feature B. The result is a collection of diverse trees that,
          when combined, capture the full structure of the data from multiple angles.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">The Two Sources of Randomness</h3>
          <ol className="list-decimal space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Bootstrap sampling:</span> Each tree sees a different subset of training examples</li>
            <li><span className="text-white">Feature subsampling:</span> Each split considers a different subset of features</li>
          </ol>
          <p className="mt-2 text-gray-300">
            Together, these ensure that individual trees are <span className="text-white">de-correlated</span>,
            which is the mathematical requirement for averaging to reduce variance effectively.
          </p>
        </div>
      </section>

      {/* ========== Section 4 — Voting: Trees Unite ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">4. Voting: Trees Unite</h2>
        <p className="mb-4 leading-relaxed">
          Once all trees are trained, prediction is simple: present the new data point to every tree,
          collect their individual predictions, and take a <span className="text-white font-semibold">majority vote</span> for
          classification (or average for regression). No single tree needs to be perfect — the
          ensemble&apos;s strength comes from the collective wisdom.
        </p>
        <p className="mb-4 leading-relaxed">
          In the visualization below, start with 1 tree and slowly increase the count. With a single
          tree, the decision boundary is jagged and unstable. As more trees vote, the boundary smooths
          out and becomes more robust. The accuracy improves and the variance drops. This is the
          fundamental magic of ensembles.
        </p>
        <VotingSketch />
        <p className="mt-4 leading-relaxed text-gray-400">
          Pay attention to the boundary near the overlap region between classes. A single tree makes
          sharp, arbitrary cuts there. The ensemble produces a smoother, more confident boundary that
          better reflects the true decision surface. Each additional tree contributes a slightly
          different &ldquo;opinion,&rdquo; and the consensus emerges through voting.
        </p>
      </section>

      {/* ========== Section 5 — Error vs. Number of Trees ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">5. Error vs. Number of Trees</h2>
        <p className="mb-4 leading-relaxed">
          One of the most remarkable properties of random forests is that they
          <span className="text-white font-semibold"> do not overfit as you add more trees</span>.
          Unlike a single decision tree where more depth = more overfitting, adding more trees to a
          random forest always either helps or has no effect. The error converges to a stable value.
        </p>
        <p className="mb-4 leading-relaxed">
          This is because each new tree is an independent estimator trained on a different bootstrap
          sample. Adding it to the ensemble can only reduce the variance of the collective prediction.
          There is a point of diminishing returns (usually around 100-500 trees), but never a point
          where more trees hurt performance.
        </p>
        <p className="mb-4 leading-relaxed">
          The animation below shows how both training and test error decrease as the forest grows.
          The test error drops rapidly at first, then plateaus — more trees provide diminishing
          improvements but never increase the error.
        </p>
        <ErrorVsTreesSketch />
      </section>

      {/* ========== Section 6 — Random Forest with scikit-learn ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">6. Random Forests in Practice</h2>
        <p className="mb-4 leading-relaxed">
          Let us train a real random forest with scikit-learn. The code below compares a single
          decision tree against a random forest on a noisy dataset, demonstrating the variance
          reduction that ensembles provide. We also examine feature importances and OOB score.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.datasets import make_moons
from sklearn.model_selection import cross_val_score

# Generate noisy non-linear data
X, y = make_moons(n_samples=500, noise=0.3, random_state=42)

# Single decision tree
tree = DecisionTreeClassifier(max_depth=None, random_state=42)
tree_scores = cross_val_score(tree, X, y, cv=10, scoring='accuracy')

# Random forest
rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=None,
    max_features='sqrt',
    oob_score=True,
    random_state=42
)
rf_scores = cross_val_score(rf, X, y, cv=10, scoring='accuracy')

# Fit RF on full data for OOB score
rf.fit(X, y)

print("=== Single Decision Tree ===")
print(f"CV Accuracy: {tree_scores.mean():.4f} (+/- {tree_scores.std():.4f})")
print(f"Variance of scores: {tree_scores.var():.6f}")

print("\\n=== Random Forest (100 trees) ===")
print(f"CV Accuracy: {rf_scores.mean():.4f} (+/- {rf_scores.std():.4f})")
print(f"Variance of scores: {rf_scores.var():.6f}")
print(f"OOB Score: {rf.oob_score_:.4f}")

print(f"\\nVariance reduction: {tree_scores.var() / rf_scores.var():.1f}x")
print("\\nThe forest is both more accurate AND more stable!")
`}
          title="Decision Tree vs. Random Forest"
        />
      </section>

      {/* ========== Section 7 — Feature Importance and OOB Error ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">7. Feature Importance and OOB Error</h2>
        <p className="mb-4 leading-relaxed">
          Random forests provide two powerful tools for free: <span className="text-white font-semibold">feature importances</span> and
          <span className="text-white font-semibold"> out-of-bag error estimates</span>. Feature importance is computed
          by averaging the impurity reduction from each feature across all trees. The OOB error uses the
          fact that each tree has about 37% of the data that it never saw during training — we can predict
          on those OOB samples and get an unbiased estimate of generalization error without needing a
          separate validation set.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split

# Load wine dataset (13 features)
wine = load_wine()
X_train, X_test, y_train, y_test = train_test_split(
    wine.data, wine.target, test_size=0.3, random_state=42
)

# Train random forest
rf = RandomForestClassifier(
    n_estimators=200,
    max_features='sqrt',
    oob_score=True,
    random_state=42
)
rf.fit(X_train, y_train)

print(f"Test accuracy: {rf.score(X_test, y_test):.4f}")
print(f"OOB score:     {rf.oob_score_:.4f}")
print(f"(OOB is a free validation estimate!)\\n")

print("Feature Importances (top 8):")
importances = sorted(
    zip(wine.feature_names, rf.feature_importances_),
    key=lambda x: -x[1]
)
for name, imp in importances[:8]:
    bar = "#" * int(imp * 60)
    print(f"  {name:>25}: {imp:.4f} {bar}")

print(f"\\nTotal features: {len(wine.feature_names)}")
print(f"Features with importance > 0.05: {sum(1 for _, i in importances if i > 0.05)}")
`}
          title="Feature Importance on Wine Dataset"
        />
      </section>

      {/* ========== Section 8 — Hyperparameters and Practical Tips ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">8. Hyperparameters and Practical Tips</h2>
        <p className="mb-4 leading-relaxed">
          Random forests are famously easy to use — they work well out of the box with minimal tuning.
          But understanding the key hyperparameters helps you squeeze out the last bit of performance.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Key Hyperparameters</h3>
          <ul className="list-disc space-y-2 pl-5 text-gray-300">
            <li>
              <span className="text-white">n_estimators (number of trees):</span> More is almost always better.
              Start with 100, increase to 500 or 1000 if compute allows. There is no overfitting risk,
              only diminishing returns and longer training time.
            </li>
            <li>
              <span className="text-white">max_features:</span> The number of features to consider at each split.
              sqrt(m) for classification, m/3 for regression. Lower values increase diversity but reduce
              each tree&apos;s individual accuracy.
            </li>
            <li>
              <span className="text-white">max_depth:</span> Usually left unlimited (None) for random forests.
              Individual trees are allowed to overfit because the ensemble averages out the variance.
              Set it only if training time is a concern.
            </li>
            <li>
              <span className="text-white">min_samples_leaf:</span> Minimum samples per leaf. Setting this to
              5-10 can prevent individual trees from memorizing noise, giving a slight accuracy boost.
            </li>
            <li>
              <span className="text-white">class_weight:</span> Set to &ldquo;balanced&rdquo; for imbalanced datasets
              to give minority classes higher weight.
            </li>
          </ul>
        </div>

        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">When to Use Random Forests</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Tabular data:</span> Random forests are often the best first model to try</li>
            <li><span className="text-white">Mixed feature types:</span> Handles numeric and categorical features naturally</li>
            <li><span className="text-white">No scaling needed:</span> Tree-based models are invariant to feature scales</li>
            <li><span className="text-white">Feature selection:</span> Built-in feature importance ranking</li>
            <li><span className="text-white">Missing values:</span> Some implementations handle them natively</li>
          </ul>
        </div>

        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-lg font-semibold text-white">Limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-300">
            <li><span className="text-white">Interpretability:</span> A forest of 500 trees is a black box — use SHAP values for explanations</li>
            <li><span className="text-white">Extrapolation:</span> Trees cannot extrapolate beyond the range of training data</li>
            <li><span className="text-white">Memory:</span> Storing hundreds of deep trees can be memory-intensive</li>
            <li><span className="text-white">Gradient boosting often wins:</span> XGBoost/LightGBM typically outperform random forests on structured competitions, at the cost of more tuning</li>
          </ul>
        </div>

        <p className="mt-4 leading-relaxed text-gray-400">
          Random forests remain one of the most important algorithms in the machine learning toolkit.
          They are the go-to baseline for tabular data, they require almost no preprocessing, and
          they provide interpretable feature importances. When you need a reliable model fast, random
          forests are hard to beat. In the next lesson, we will explore gradient boosting — a different
          ensemble strategy that builds trees sequentially to correct each other&apos;s mistakes.
        </p>
      </section>
    </article>
  )
}
