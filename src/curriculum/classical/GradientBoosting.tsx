import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/gradient-boosting',
  title: 'Gradient Boosting',
  description: 'Sequential ensemble learning that reduces bias by fitting residuals',
  track: 'classical',
  order: 9,
  tags: ['gradient-boosting', 'adaboost', 'xgboost', 'ensemble'],
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

/* ------------------------------------------------------------------ */
/* Section 1 — AdaBoost Visualization                                  */
/* ------------------------------------------------------------------ */

function AdaBoostSketch() {
  const [round, setRound] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const rng = makeRng(42)
      const N = 40
      const points: { x: number; y: number; label: number }[] = []
      // Two overlapping clusters
      for (let i = 0; i < N / 2; i++) {
        points.push({ x: randn(rng) * 0.8 + 2, y: randn(rng) * 0.8 + 3, label: 0 })
        points.push({ x: randn(rng) * 0.8 + 4, y: randn(rng) * 0.8 + 3, label: 1 })
      }

      // Simulate AdaBoost: decision stumps
      const maxRounds = 10
      const weights: number[][] = [Array(N).fill(1 / N)]
      const stumps: { feature: 'x' | 'y'; threshold: number; polarity: number; alpha: number }[] = []

      for (let r = 0; r < maxRounds; r++) {
        const w = weights[r]
        let bestErr = Infinity
        let bestFeature: 'x' | 'y' = 'x'
        let bestTh = 3
        let bestPolarity = 1

        for (const feat of ['x', 'y'] as const) {
          const vals = points.map((pt) => pt[feat]).sort((a, b) => a - b)
          for (let i = 0; i < vals.length - 1; i++) {
            const th = (vals[i] + vals[i + 1]) / 2
            for (const pol of [1, -1]) {
              let err = 0
              for (let j = 0; j < N; j++) {
                const pred = (points[j][feat] <= th ? -1 : 1) * pol > 0 ? 1 : 0
                if (pred !== points[j].label) err += w[j]
              }
              if (err < bestErr) {
                bestErr = err
                bestFeature = feat
                bestTh = th
                bestPolarity = pol
              }
            }
          }
        }

        bestErr = Math.max(bestErr, 1e-10)
        const alpha = 0.5 * Math.log((1 - bestErr) / bestErr)
        stumps.push({ feature: bestFeature, threshold: bestTh, polarity: bestPolarity, alpha })

        // Update weights
        const newW = w.slice()
        for (let j = 0; j < N; j++) {
          const pred = (points[j][bestFeature] <= bestTh ? -1 : 1) * bestPolarity > 0 ? 1 : 0
          if (pred !== points[j].label) {
            newW[j] *= Math.exp(alpha)
          } else {
            newW[j] *= Math.exp(-alpha)
          }
        }
        const sumW = newW.reduce((a, b) => a + b, 0)
        for (let j = 0; j < N; j++) newW[j] /= sumW
        weights.push(newW)
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 420)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 50
        const plotW = p.width - margin * 2
        const plotH = p.height - margin * 2
        const xMin = 0
        const xMax = 6
        const yMin = 0
        const yMax = 6

        function mx(v: number): number { return margin + ((v - xMin) / (xMax - xMin)) * plotW }
        function my(v: number): number { return p.height - margin - ((v - yMin) / (yMax - yMin)) * plotH }

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, p.height - margin, p.width - margin, p.height - margin)
        p.line(margin, margin, margin, p.height - margin)

        // Draw decision stumps up to current round
        for (let r = 0; r <= Math.min(round, stumps.length - 1); r++) {
          const s = stumps[r]
          const alpha = Math.min(200, 80 + r * 15)
          p.stroke(250, 204, 21, alpha)
          p.strokeWeight(1.5)
          if (s.feature === 'x') {
            p.line(mx(s.threshold), margin, mx(s.threshold), p.height - margin)
          } else {
            p.line(margin, my(s.threshold), p.width - margin, my(s.threshold))
          }
          // Label the stump
          p.noStroke()
          p.fill(250, 204, 21, alpha)
          p.textSize(9)
          p.textAlign(p.CENTER, p.TOP)
          if (s.feature === 'x') {
            p.text(`R${r + 1}`, mx(s.threshold), margin - 14)
          } else {
            p.text(`R${r + 1}`, p.width - margin + 5, my(s.threshold) - 5)
          }
        }

        // Draw data points with weight proportional to size
        const currentWeights = weights[Math.min(round, weights.length - 1)]
        const maxW = Math.max(...currentWeights)
        p.noStroke()
        for (let j = 0; j < N; j++) {
          const sz = 6 + (currentWeights[j] / maxW) * 28
          if (points[j].label === 0) {
            p.fill(66, 133, 244, 210)
          } else {
            p.fill(234, 67, 53, 210)
          }
          p.ellipse(mx(points[j].x), my(points[j].y), sz, sz)
        }

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`AdaBoost  |  Round ${round} / ${maxRounds}`, margin, 10)
        p.fill(148, 163, 184)
        p.textSize(11)
        p.text('Point size = sample weight (bigger = harder to classify)', margin, 28)
      }
    },
    [round],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={420}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            AdaBoost Round:
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={round}
              onChange={(e) => setRound(parseInt(e.target.value))}
              className="w-40"
            />
            <span className="w-8 font-mono">{round}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Gradient Boosting Step by Step (1D regression)          */
/* ------------------------------------------------------------------ */

function GradientBoostingStepSketch() {
  const [nTrees, setNTrees] = useState(1)
  const [learningRate, setLearningRate] = useState(0.3)

  const sketch = useCallback(
    (p: p5) => {
      const rng = makeRng(77)
      const N = 35
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i < N; i++) {
        const x = 0.3 + rng() * 5.4
        const y = Math.sin(x) * 2 + 0.5 * Math.cos(2 * x) + randn(rng) * 0.25
        xs.push(x)
        ys.push(y)
      }

      // Build stumps greedily on residuals
      function fitStump(targets: number[]): { threshold: number; leftVal: number; rightVal: number } {
        let bestTh = 3
        let bestErr = Infinity
        for (let ti = 0; ti < xs.length; ti++) {
          const th = xs[ti]
          let lS = 0, lN = 0, rS = 0, rN = 0
          for (let i = 0; i < xs.length; i++) {
            if (xs[i] <= th) { lS += targets[i]; lN++ }
            else { rS += targets[i]; rN++ }
          }
          if (lN === 0 || rN === 0) continue
          const lM = lS / lN
          const rM = rS / rN
          let err = 0
          for (let i = 0; i < xs.length; i++) {
            const pred = xs[i] <= th ? lM : rM
            err += (targets[i] - pred) ** 2
          }
          if (err < bestErr) { bestErr = err; bestTh = th }
        }
        let lS = 0, lN = 0, rS = 0, rN = 0
        for (let i = 0; i < xs.length; i++) {
          if (xs[i] <= bestTh) { lS += targets[i]; lN++ }
          else { rS += targets[i]; rN++ }
        }
        return { threshold: bestTh, leftVal: lN > 0 ? lS / lN : 0, rightVal: rN > 0 ? rS / rN : 0 }
      }

      // Pre-compute stumps for many rounds
      const maxTrees = 20
      const stumps: { threshold: number; leftVal: number; rightVal: number }[] = []
      let residuals = [...ys]
      for (let r = 0; r < maxTrees; r++) {
        const stump = fitStump(residuals)
        stumps.push(stump)
        residuals = residuals.map((res, i) => {
          const pred = xs[i] <= stump.threshold ? stump.leftVal : stump.rightVal
          return res - learningRate * pred
        })
      }

      function predict(x: number, rounds: number): number {
        let pred = 0
        for (let r = 0; r < rounds; r++) {
          const s = stumps[r]
          pred += learningRate * (x <= s.threshold ? s.leftVal : s.rightVal)
        }
        return pred
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 440)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 55
        const topH = (p.height - 20) * 0.55
        const botH = (p.height - 20) * 0.45 - margin
        const plotW = p.width - margin * 2
        const xMin = 0
        const xMax = 6
        const yMin = -3.5
        const yMax = 3.5

        function mx(v: number): number { return margin + ((v - xMin) / (xMax - xMin)) * plotW }

        // Top panel: data + prediction
        function myTop(v: number): number { return 20 + topH - ((v - yMin) / (yMax - yMin)) * topH }

        // Axes top
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, 20 + topH, p.width - margin, 20 + topH)
        p.line(margin, 20, margin, 20 + topH)

        // Data points
        p.noStroke()
        for (let i = 0; i < N; i++) {
          p.fill(99, 102, 241, 200)
          p.ellipse(mx(xs[i]), myTop(ys[i]), 7, 7)
        }

        // Prediction curve
        p.stroke(52, 211, 153)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let px = xMin; px <= xMax; px += 0.04) {
          p.vertex(mx(px), myTop(predict(px, nTrees)))
        }
        p.endShape()

        // Title top
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Combined Prediction (${nTrees} tree${nTrees !== 1 ? 's' : ''}, lr=${learningRate})`, margin, 4)

        // Bottom panel: current residuals
        const botTop = 20 + topH + 25
        const resYMin = -3
        const resYMax = 3
        function myBot(v: number): number { return botTop + botH - ((v - resYMin) / (resYMax - resYMin)) * botH }

        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, botTop + botH, p.width - margin, botTop + botH)
        p.line(margin, botTop, margin, botTop + botH)
        // Zero line
        p.stroke(51, 65, 85, 120)
        p.line(margin, myBot(0), p.width - margin, myBot(0))

        // Compute current residuals
        p.noStroke()
        for (let i = 0; i < N; i++) {
          const pred = predict(xs[i], nTrees)
          const res = ys[i] - pred
          const col = res > 0 ? p.color(234, 67, 53, 200) : p.color(66, 133, 244, 200)
          p.fill(col)
          p.ellipse(mx(xs[i]), myBot(res), 6, 6)
        }

        // Title bottom
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Residuals (next tree will fit these)', margin, botTop - 16)

        // MSE display
        let mse = 0
        for (let i = 0; i < N; i++) {
          const pred = predict(xs[i], nTrees)
          mse += (ys[i] - pred) ** 2
        }
        mse /= N
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.TOP)
        p.text(`MSE: ${mse.toFixed(4)}`, p.width - margin, 4)
      }
    },
    [nTrees, learningRate],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Trees:
            <input type="range" min={1} max={20} step={1} value={nTrees}
              onChange={(e) => setNTrees(parseInt(e.target.value))} className="w-36" />
            <span className="w-8 font-mono">{nTrees}</span>
          </label>
          <label className="flex items-center gap-2">
            Learning Rate:
            <input type="range" min={0.05} max={1.0} step={0.05} value={learningRate}
              onChange={(e) => setLearningRate(parseFloat(e.target.value))} className="w-36" />
            <span className="w-12 font-mono">{learningRate.toFixed(2)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Learning Rate Comparison                                */
/* ------------------------------------------------------------------ */

function LearningRateSketch() {
  const sketch = useCallback((p: p5) => {
    // Simulated train/test error for different learning rates
    const rounds = Array.from({ length: 50 }, (_, i) => i + 1)

    function errorCurve(lr: number, type: 'train' | 'test'): number[] {
      return rounds.map((r) => {
        const decay = 1 - Math.exp(-lr * r * 0.08)
        const trainErr = 0.45 * Math.exp(-lr * r * 0.06) + 0.02
        if (type === 'train') return trainErr
        // Test error has a floor then rises for high lr
        const overfit = lr > 0.5 ? 0.003 * lr * Math.max(0, r - 15) : 0
        return trainErr + 0.03 + overfit + 0.01 * (1 - decay)
      })
    }

    const lrs = [
      { lr: 1.0, color: [234, 67, 53] as const, label: 'lr=1.0' },
      { lr: 0.3, color: [250, 204, 21] as const, label: 'lr=0.3' },
      { lr: 0.1, color: [52, 211, 153] as const, label: 'lr=0.1' },
    ]

    let animFrame = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 380)
      animFrame = 0
    }

    p.draw = () => {
      p.background(15, 23, 42)
      animFrame++
      const visibleRounds = Math.min(50, Math.floor(animFrame / 2) + 1)

      const margin = 55
      const plotW = p.width - margin * 2
      const plotH = p.height - margin * 2

      function mx(r: number): number { return margin + ((r - 1) / 49) * plotW }
      function my(e: number): number { return p.height - margin - (e / 0.5) * plotH }

      // Axes
      p.stroke(51, 65, 85)
      p.strokeWeight(1)
      p.line(margin, p.height - margin, p.width - margin, p.height - margin)
      p.line(margin, margin, margin, p.height - margin)

      // Labels
      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Boosting Round', p.width / 2, p.height - 18)
      p.push()
      p.translate(16, p.height / 2)
      p.rotate(-p.HALF_PI)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Test Error', 0, 0)
      p.pop()

      // Ticks
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      for (const r of [1, 10, 20, 30, 40, 50]) {
        p.fill(100, 116, 139)
        p.text(r.toString(), mx(r), p.height - margin + 6)
      }

      // Draw test error curves
      for (const { lr, color, label: _label } of lrs) {
        const errs = errorCurve(lr, 'test')
        p.noFill()
        p.stroke(color[0], color[1], color[2])
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < visibleRounds; i++) {
          p.vertex(mx(rounds[i]), my(errs[i]))
        }
        p.endShape()
      }

      // Legend
      let ly = 25
      for (const { color, label } of lrs) {
        p.noStroke()
        p.fill(color[0], color[1], color[2])
        p.rect(p.width - 130, ly, 14, 3, 1)
        p.fill(200, 200, 200)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(label, p.width - 112, ly + 2)
        ly += 20
      }

      // Title
      p.fill(226, 232, 240)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Test Error vs Boosting Round', margin, 6)
    }
  }, [])

  return <P5Sketch sketch={sketch} height={380} />
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function GradientBoosting() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-200">
      {/* ---------- Section 1: Boosting vs Bagging ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">1. Boosting vs Bagging</h2>
        <p className="mb-4 text-gray-300">
          Ensemble methods combine multiple weak learners into a strong one, but they do so in
          fundamentally different ways. <strong className="text-white">Bagging</strong> (Bootstrap
          Aggregating) trains many models <em>in parallel</em> on random subsets of the data and
          averages their predictions. Each model sees a slightly different view of the data, so
          their errors are somewhat uncorrelated. Averaging uncorrelated errors reduces
          <strong className="text-white"> variance</strong> without increasing bias.
          Random Forest is the canonical bagging algorithm.
        </p>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">Boosting</strong>, by contrast, trains models
          <em> sequentially</em>. Each new model specifically targets the mistakes of the previous
          ensemble. This iterative error correction reduces <strong className="text-white">bias</strong> —
          the ensemble gradually learns the patterns that any single weak learner would miss.
          However, because each model depends on the previous one, boosting cannot be parallelized
          as easily as bagging, and it carries a greater risk of overfitting if run for too many
          rounds.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-300">
          <p className="mb-2"><strong className="text-yellow-400">Bagging</strong> = parallel, reduces variance, decorrelates errors</p>
          <p><strong className="text-yellow-400">Boosting</strong> = sequential, reduces bias, corrects errors iteratively</p>
        </div>
      </section>

      {/* ---------- Section 2: AdaBoost ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">2. AdaBoost Intuition</h2>
        <p className="mb-4 text-gray-300">
          AdaBoost (Adaptive Boosting) was the first practical boosting algorithm. The idea is
          beautifully simple: maintain a weight for every training sample. Initially, all weights
          are equal. After each round, <em>increase</em> the weights of misclassified samples and
          <em> decrease</em> the weights of correctly classified ones. The next weak learner is then
          trained on this reweighted distribution, forcing it to focus on the hard examples that
          previous learners got wrong.
        </p>
        <p className="mb-4 text-gray-300">
          Each weak learner also receives a coefficient alpha proportional to its accuracy. The
          final prediction is a weighted vote of all learners. Learners that performed well get a
          louder voice; those that barely beat random get a whisper.
        </p>
        <p className="mb-6 text-gray-300">
          In the visualization below, drag the slider to advance through AdaBoost rounds. Watch how
          misclassified points <strong className="text-white">grow larger</strong> (higher weight),
          and new decision stumps (yellow lines) are placed to handle the hardest examples. At round
          0 all points have equal weight.
        </p>
        <AdaBoostSketch />
      </section>

      {/* ---------- Section 3: Gradient Boosting Step by Step ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">3. Gradient Boosting Step by Step</h2>
        <p className="mb-4 text-gray-300">
          Gradient Boosting generalizes AdaBoost by framing boosting as gradient descent in function
          space. Instead of reweighting samples, each new tree fits the <strong className="text-white">
          negative gradient of the loss function</strong> — for squared-error loss, this is simply
          the <strong className="text-white">residuals</strong> (errors) of the current ensemble.
        </p>
        <h3 className="mb-2 text-lg font-semibold text-white">The algorithm</h3>
        <ol className="mb-4 list-decimal pl-6 space-y-1 text-gray-300">
          <li>Initialize with a constant prediction (e.g., the mean of y).</li>
          <li>Compute residuals: r_i = y_i - F(x_i) for each data point.</li>
          <li>Fit a new shallow tree to predict these residuals.</li>
          <li>Update the ensemble: F(x) = F(x) + lr * h(x), where h is the new tree and lr is the learning rate.</li>
          <li>Repeat from step 2 for the desired number of rounds.</li>
        </ol>
        <p className="mb-6 text-gray-300">
          The top panel shows the original data (purple dots) and the combined prediction (green
          curve). The bottom panel shows the residuals — the errors the next tree will try to fit.
          As you add more trees, the residuals shrink toward zero and the green curve captures
          the true pattern. Adjust the learning rate to see how it controls how aggressively each
          tree corrects the ensemble.
        </p>
        <GradientBoostingStepSketch />
      </section>

      {/* ---------- Section 4: Learning Rate ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">4. Learning Rate (Shrinkage)</h2>
        <p className="mb-4 text-gray-300">
          The learning rate (also called shrinkage) scales each tree's contribution to the ensemble.
          A learning rate of 1.0 means each tree's prediction is added in full; a learning rate of
          0.1 means only 10% of the tree's prediction is used. This parameter is crucial for
          preventing overfitting.
        </p>
        <p className="mb-4 text-gray-300">
          With a <strong className="text-white">high learning rate</strong> (e.g., 1.0), the model
          converges quickly but overshoots — it memorizes training noise and test error rises after
          a few rounds. With a <strong className="text-white">low learning rate</strong> (e.g., 0.1),
          convergence is slower but smoother, and the model generalizes better. The tradeoff is that
          you need more trees to compensate for the slower learning, which increases training time.
        </p>
        <p className="mb-4 text-gray-300">
          In practice, the best strategy is to set a small learning rate (0.01-0.1) and use early
          stopping to choose the optimal number of rounds based on validation error.
        </p>
        <p className="mb-6 text-gray-300">
          The plot below shows test error curves for three learning rates. Notice how lr=1.0 (red)
          overfits quickly, lr=0.3 (yellow) finds a good balance, and lr=0.1 (green) converges
          slowly but achieves the lowest final error.
        </p>
        <LearningRateSketch />
      </section>

      {/* ---------- Section 5: XGBoost / LightGBM ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">5. Modern Implementations: XGBoost & LightGBM</h2>
        <p className="mb-4 text-gray-300">
          The vanilla gradient boosting algorithm we described above is powerful but slow for large
          datasets. Two libraries have become the workhorses of applied machine learning by adding
          engineering optimizations on top of the core algorithm.
        </p>
        <h3 className="mb-2 text-lg font-semibold text-white">XGBoost (eXtreme Gradient Boosting)</h3>
        <ul className="mb-4 list-disc pl-6 space-y-1 text-gray-300">
          <li><strong className="text-white">Regularization:</strong> Adds L1 and L2 penalties on leaf weights, reducing overfitting.</li>
          <li><strong className="text-white">Approximate split finding:</strong> Uses quantile sketches to find split points without sorting all values.</li>
          <li><strong className="text-white">Sparsity-aware:</strong> Handles missing values natively by learning a default direction at each split.</li>
          <li><strong className="text-white">Column subsampling:</strong> Like Random Forest, randomly selects features for each tree, decorrelating them.</li>
        </ul>
        <h3 className="mb-2 text-lg font-semibold text-white">LightGBM</h3>
        <ul className="mb-4 list-disc pl-6 space-y-1 text-gray-300">
          <li><strong className="text-white">Leaf-wise growth:</strong> Grows the leaf with the highest gain instead of level-by-level, producing deeper but more efficient trees.</li>
          <li><strong className="text-white">Gradient-based One-Side Sampling (GOSS):</strong> Keeps all instances with large gradients and samples from small-gradient ones, focusing computation on hard examples.</li>
          <li><strong className="text-white">Exclusive Feature Bundling (EFB):</strong> Bundles mutually exclusive sparse features to reduce dimensionality.</li>
          <li><strong className="text-white">Speed:</strong> Often 5-10x faster than XGBoost on large datasets.</li>
        </ul>
        <p className="mb-4 text-gray-300">
          Both libraries support GPU training, categorical feature handling, and early stopping
          out of the box. For most tabular data problems, gradient boosting (via XGBoost or
          LightGBM) is the first algorithm to try — it dominates Kaggle competitions and
          production ML systems alike.
        </p>
      </section>

      {/* ---------- Section 6: Python - GradientBoosting ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">6. Python: Gradient Boosting with Scikit-Learn</h2>
        <p className="mb-4 text-gray-300">
          Train a GradientBoostingClassifier and tune the two most important hyperparameters:
          <code className="text-emerald-400"> n_estimators</code> (number of trees) and
          <code className="text-emerald-400"> learning_rate</code>. Watch how they interact — more
          trees with a smaller learning rate typically gives the best generalization.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score

# Generate a moderately hard dataset
X, y = make_classification(n_samples=500, n_features=10, n_informative=6,
                           n_redundant=2, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Try different hyperparameter combos
configs = [
    {"n_estimators": 50,  "learning_rate": 1.0,  "max_depth": 3},
    {"n_estimators": 100, "learning_rate": 0.3,  "max_depth": 3},
    {"n_estimators": 200, "learning_rate": 0.1,  "max_depth": 3},
    {"n_estimators": 500, "learning_rate": 0.05, "max_depth": 3},
]

print("n_estimators | lr   | train_acc | test_acc")
print("-" * 48)
for cfg in configs:
    gb = GradientBoostingClassifier(**cfg, random_state=42)
    gb.fit(X_train, y_train)
    train_acc = accuracy_score(y_train, gb.predict(X_train))
    test_acc = accuracy_score(y_test, gb.predict(X_test))
    print(f"{cfg['n_estimators']:>12} | {cfg['learning_rate']:.2f} | {train_acc:.3f}     | {test_acc:.3f}")
`}
        />
      </section>

      {/* ---------- Section 7: Python - Comparison ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">7. Python: Tree vs Forest vs Boosting</h2>
        <p className="mb-4 text-gray-300">
          Compare a single decision tree, a random forest, and gradient boosting on the same
          dataset. This demonstrates the progression from a single weak learner to variance-reducing
          bagging to bias-reducing boosting.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

# Generate dataset
X, y = make_classification(n_samples=600, n_features=12, n_informative=8,
                           n_redundant=2, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

models = {
    "Decision Tree (depth=5)": DecisionTreeClassifier(max_depth=5, random_state=42),
    "Random Forest (100 trees)": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
    "Gradient Boosting (200 trees, lr=0.1)": GradientBoostingClassifier(
        n_estimators=200, learning_rate=0.1, max_depth=3, random_state=42),
}

print(f"{'Model':<40} {'CV Mean':>8} {'CV Std':>8} {'Test':>8}")
print("-" * 68)
for name, model in models.items():
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
    model.fit(X_train, y_train)
    test_acc = model.score(X_test, y_test)
    print(f"{name:<40} {cv_scores.mean():>8.3f} {cv_scores.std():>8.3f} {test_acc:>8.3f}")

# Show feature importances from gradient boosting
gb = models["Gradient Boosting (200 trees, lr=0.1)"]
importances = gb.feature_importances_
top_feats = np.argsort(importances)[::-1][:5]
print(f"\\nTop 5 features (GB): {list(top_feats)}")
print(f"Importances:         {[round(importances[i], 3) for i in top_feats]}")
`}
        />
      </section>
    </article>
  )
}
