import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/distributions',
  title: 'Probability Distributions',
  description: 'From coin flips to Gaussians — understand the probability distributions that underpin every ML model.',
  track: 'foundations',
  order: 5,
  tags: ['probability', 'distributions', 'gaussian', 'central-limit-theorem', 'statistics'],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */


function randn(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2)
}

// Binomial coefficient
function binomCoeff(n: number, k: number): number {
  if (k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

// Gaussian PDF
function gaussPDF(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z)
}

/* ------------------------------------------------------------------ */
/* Section 1 — Discrete Distributions (animated coin flips histogram)  */
/* ------------------------------------------------------------------ */

function DiscreteDistSketch() {
  const [n, setN] = useState(10)
  const [prob, setProb] = useState(0.5)
  const [flipping, setFlipping] = useState(false)

  const nRef = useRef(n)
  nRef.current = n
  const probRef = useRef(prob)
  probRef.current = prob
  const flippingRef = useRef(flipping)
  flippingRef.current = flipping

  const countsRef = useRef<number[]>(new Array(21).fill(0))
  const totalRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 400
    const PAD = 50
    let frameCount = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frameCount++

      const currentN = nRef.current
      const currentP = probRef.current

      // Flip coins each frame
      if (flippingRef.current && frameCount % 2 === 0) {
        for (let batch = 0; batch < 10; batch++) {
          let successes = 0
          for (let i = 0; i < currentN; i++) {
            if (Math.random() < currentP) successes++
          }
          if (successes <= 20) {
            countsRef.current[successes]++
          }
          totalRef.current++
        }
      }

      const counts = countsRef.current
      const total = totalRef.current
      const maxCount = Math.max(...counts.slice(0, currentN + 1), 1)
      const barW = Math.min(30, (W - 2 * PAD) / (currentN + 1) - 2)
      const plotH = H - 2 * PAD - 40

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1)
      p.line(PAD, H - PAD, W - PAD, H - PAD)

      // Draw histogram bars
      for (let k = 0; k <= currentN; k++) {
        const x = PAD + (k / (currentN + 1)) * (W - 2 * PAD) + barW / 2
        const barH = (counts[k] / maxCount) * plotH
        p.fill(56, 189, 248, 200)
        p.noStroke()
        p.rect(x, H - PAD - barH, barW, barH, 2, 2, 0, 0)

        // Label
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        if (currentN <= 15 || k % 2 === 0) {
          p.text(String(k), x + barW / 2, H - PAD + 4)
        }
      }

      // Theoretical PMF overlay
      if (total > 0) {
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let k = 0; k <= currentN; k++) {
          const x = PAD + (k / (currentN + 1)) * (W - 2 * PAD) + barW
          const theorProb = binomCoeff(currentN, k) * Math.pow(currentP, k) * Math.pow(1 - currentP, currentN - k)
          const theorCount = theorProb * total
          const barH = (theorCount / maxCount) * plotH
          p.vertex(x, H - PAD - barH)
        }
        p.endShape()
      }

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Binomial(n=${currentN}, p=${currentP.toFixed(2)})`, 14, 14)
      p.fill(148, 163, 184)
      p.textSize(12)
      p.text(`Total flips: ${total}`, 14, 36)
      p.text(`Mean = np = ${(currentN * currentP).toFixed(1)}`, 14, 54)
      p.text(`Var = np(1-p) = ${(currentN * currentP * (1 - currentP)).toFixed(2)}`, 14, 72)

      // Legend
      p.fill(56, 189, 248)
      p.text('Blue bars: simulated', W - 200, 14)
      p.fill(250, 204, 21)
      p.text('Yellow line: theoretical', W - 200, 30)
    }
  }, [])

  const handleReset = useCallback(() => {
    countsRef.current = new Array(21).fill(0)
    totalRef.current = 0
    setFlipping(false)
    flippingRef.current = false
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={400} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <button
          onClick={() => { setFlipping(!flipping); flippingRef.current = !flipping }}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {flipping ? 'Pause' : 'Flip Coins'}
        </button>
        <button onClick={handleReset}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600">
          Reset
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          n = {n}
          <input type="range" min={1} max={20} step={1} value={n}
            onChange={(e) => { setN(Number(e.target.value)); handleReset() }}
            className="w-28 accent-sky-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          p = {prob.toFixed(2)}
          <input type="range" min={0.05} max={0.95} step={0.05} value={prob}
            onChange={(e) => { setProb(Number(e.target.value)); handleReset() }}
            className="w-28 accent-sky-500" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Gaussian with sliders, 68-95-99.7 rule                  */
/* ------------------------------------------------------------------ */

function GaussianSketch() {
  const [mu, setMu] = useState(0)
  const [sigma, setSigma] = useState(1)
  const [showRule, setShowRule] = useState(true)

  const muRef = useRef(mu)
  muRef.current = mu
  const sigmaRef = useRef(sigma)
  sigmaRef.current = sigma
  const showRuleRef = useRef(showRule)
  showRuleRef.current = showRule

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 380
    const PAD = 50
    const xMin = -6, xMax = 6, yMin = 0, yMax = 0.85

    function mapX(x: number) { return PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD) }
    function mapY(y: number) { return H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD) }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const m = muRef.current
      const s = sigmaRef.current

      // Grid
      p.stroke(30, 41, 59)
      p.strokeWeight(1)
      for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) p.line(mapX(x), 0, mapX(x), H)

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1.5)
      p.line(PAD, mapY(0), W - PAD, mapY(0))
      p.line(mapX(0), PAD, mapX(0), H - PAD)

      // x-axis labels
      p.fill(100, 116, 139)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
        p.text(String(x), mapX(x), mapY(0) + 4)
      }

      // 68-95-99.7 shaded regions
      if (showRuleRef.current) {
        const bands: { n: number; color: [number, number, number, number]; label: string }[] = [
          { n: 3, color: [56, 189, 248, 20], label: '99.7%' },
          { n: 2, color: [56, 189, 248, 35], label: '95%' },
          { n: 1, color: [56, 189, 248, 55], label: '68%' },
        ]

        for (const band of bands) {
          const lo = m - band.n * s
          const hi = m + band.n * s
          p.fill(band.color[0], band.color[1], band.color[2], band.color[3])
          p.noStroke()
          p.beginShape()
          p.vertex(mapX(lo), mapY(0))
          for (let x = lo; x <= hi; x += 0.05) {
            p.vertex(mapX(x), mapY(gaussPDF(x, m, s)))
          }
          p.vertex(mapX(hi), mapY(0))
          p.endShape(p.CLOSE)

          // Label
          p.fill(148, 163, 184)
          p.textSize(10)
          p.textAlign(p.CENTER, p.BOTTOM)
          const labelY = gaussPDF(m + band.n * s * 0.5, m, s) * 0.3
          p.text(band.label, mapX(m), mapY(labelY + band.n * 0.08))
        }
      }

      // Gaussian curve
      p.noFill()
      p.stroke(56, 189, 248)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let sx = PAD; sx <= W - PAD; sx += 2) {
        const x = xMin + ((sx - PAD) / (W - 2 * PAD)) * (xMax - xMin)
        const y = gaussPDF(x, m, s)
        p.vertex(sx, mapY(y))
      }
      p.endShape()

      // Mean line
      p.stroke(250, 204, 21)
      p.strokeWeight(1.5)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.line(mapX(m), mapY(0), mapX(m), mapY(gaussPDF(m, m, s)))
      ctx.setLineDash([])

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`N(\u03BC=${m.toFixed(1)}, \u03C3=${s.toFixed(1)})`, 14, 14)
      p.fill(148, 163, 184)
      p.textSize(12)
      p.text(`Peak height = ${gaussPDF(m, m, s).toFixed(3)}`, 14, 36)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={380} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Mean (&mu;): {mu.toFixed(1)}
          <input type="range" min={-3} max={3} step={0.1} value={mu}
            onChange={(e) => setMu(Number(e.target.value))} className="w-32 accent-yellow-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Std (&sigma;): {sigma.toFixed(1)}
          <input type="range" min={0.3} max={3} step={0.1} value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))} className="w-32 accent-sky-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={showRule}
            onChange={(e) => setShowRule(e.target.checked)} className="accent-sky-500" />
          68-95-99.7 rule
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Central Limit Theorem                                   */
/* ------------------------------------------------------------------ */

function CLTSketch() {
  const [sourceType, setSourceType] = useState<'uniform' | 'exponential' | 'bimodal'>('uniform')
  const [sampleSize, setSampleSize] = useState(30)
  const [running, setRunning] = useState(false)

  const sourceRef = useRef(sourceType)
  sourceRef.current = sourceType
  const sampleSizeRef = useRef(sampleSize)
  sampleSizeRef.current = sampleSize
  const runningRef = useRef(running)
  runningRef.current = running

  const meansRef = useRef<number[]>([])
  const totalRef = useRef(0)

  function sampleFrom(type: string): number {
    switch (type) {
      case 'exponential': return -Math.log(1 - Math.random())
      case 'bimodal': return Math.random() < 0.5 ? randn(Math.random) - 3 : randn(Math.random) + 3
      default: return Math.random()
    }
  }

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 400
    const PAD = 50
    let frameCount = 0
    const numBins = 50

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      frameCount++

      // Generate sample means
      if (runningRef.current && frameCount % 2 === 0) {
        for (let batch = 0; batch < 20; batch++) {
          let sum = 0
          const n = sampleSizeRef.current
          for (let i = 0; i < n; i++) {
            sum += sampleFrom(sourceRef.current)
          }
          meansRef.current.push(sum / n)
          totalRef.current++
        }
      }

      const means = meansRef.current

      // Determine range
      let xMin: number, xMax: number
      switch (sourceRef.current) {
        case 'exponential': xMin = -0.5; xMax = 3; break
        case 'bimodal': xMin = -6; xMax = 6; break
        default: xMin = -0.2; xMax = 1.2; break
      }

      // Bin the means
      const bins = new Array(numBins).fill(0)
      for (const m of means) {
        const binIdx = Math.floor(((m - xMin) / (xMax - xMin)) * numBins)
        if (binIdx >= 0 && binIdx < numBins) bins[binIdx]++
      }

      const maxBin = Math.max(...bins, 1)
      const plotH = H - 2 * PAD - 40
      const barW = (W - 2 * PAD) / numBins

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1)
      p.line(PAD, H - PAD, W - PAD, H - PAD)

      // Histogram
      for (let i = 0; i < numBins; i++) {
        const x = PAD + i * barW
        const barH = (bins[i] / maxBin) * plotH
        p.fill(56, 189, 248, 180)
        p.noStroke()
        p.rect(x, H - PAD - barH, barW - 1, barH)
      }

      // Overlay Gaussian fit if we have data
      if (means.length > 10) {
        const meanOfMeans = means.reduce((a, b) => a + b, 0) / means.length
        const variance = means.reduce((a, b) => a + (b - meanOfMeans) ** 2, 0) / means.length
        const stdOfMeans = Math.sqrt(variance)

        if (stdOfMeans > 0.001) {
          p.noFill()
          p.stroke(250, 204, 21)
          p.strokeWeight(2)
          p.beginShape()
          for (let sx = PAD; sx <= W - PAD; sx += 2) {
            const x = xMin + ((sx - PAD) / (W - 2 * PAD)) * (xMax - xMin)
            const density = gaussPDF(x, meanOfMeans, stdOfMeans)
            const scaledH = density * means.length * ((xMax - xMin) / numBins)
            const barH = (scaledH / maxBin) * plotH
            p.vertex(sx, H - PAD - barH)
          }
          p.endShape()
        }
      }

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Central Limit Theorem`, 14, 14)
      p.fill(148, 163, 184)
      p.textSize(12)
      p.text(`Source: ${sourceRef.current} | Sample size: ${sampleSizeRef.current} | Means collected: ${means.length}`, 14, 36)
      p.fill(56, 189, 248)
      p.text('Blue: histogram of sample means', 14, 54)
      p.fill(250, 204, 21)
      p.text('Yellow: fitted Gaussian', 14, 70)
    }
  }, [])

  const handleReset = useCallback(() => {
    meansRef.current = []
    totalRef.current = 0
    setRunning(false)
    runningRef.current = false
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={400} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <button
          onClick={() => { setRunning(!running); runningRef.current = !running }}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {running ? 'Pause' : 'Sample'}
        </button>
        <button onClick={handleReset}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600">
          Reset
        </button>
        <div className="flex gap-2">
          {(['uniform', 'exponential', 'bimodal'] as const).map((t) => (
            <button key={t}
              onClick={() => { setSourceType(t); sourceRef.current = t; handleReset() }}
              className={`rounded px-3 py-1 text-sm ${sourceType === t ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          n = {sampleSize}
          <input type="range" min={2} max={100} step={1} value={sampleSize}
            onChange={(e) => { setSampleSize(Number(e.target.value)); sampleSizeRef.current = Number(e.target.value); handleReset() }}
            className="w-28 accent-sky-500" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const statsCode = `import numpy as np

# --- Discrete Distributions ---
np.random.seed(42)

# Bernoulli: single coin flip
p = 0.7
flips = np.random.binomial(1, p, size=10)
print(f"Bernoulli(p={p}): {flips}")
print(f"  Mean: {flips.mean():.2f} (expected: {p})")

# Binomial: number of successes in n trials
n, p = 10, 0.3
samples = np.random.binomial(n, p, size=1000)
print(f"\\nBinomial(n={n}, p={p}):")
print(f"  Mean: {samples.mean():.2f} (expected: {n*p})")
print(f"  Std:  {samples.std():.2f} (expected: {np.sqrt(n*p*(1-p)):.2f})")

# Poisson: rare events per unit time
lam = 4.0
samples = np.random.poisson(lam, size=1000)
print(f"\\nPoisson(lambda={lam}):")
print(f"  Mean: {samples.mean():.2f} (expected: {lam})")
print(f"  Std:  {samples.std():.2f} (expected: {np.sqrt(lam):.2f})")

# --- Continuous Distributions ---
# Gaussian / Normal
mu, sigma = 5.0, 2.0
samples = np.random.normal(mu, sigma, size=10000)
print(f"\\nGaussian(mu={mu}, sigma={sigma}):")
print(f"  Mean: {samples.mean():.3f}")
print(f"  Std:  {samples.std():.3f}")

# 68-95-99.7 rule verification
within_1 = np.mean(np.abs(samples - mu) < sigma)
within_2 = np.mean(np.abs(samples - mu) < 2*sigma)
within_3 = np.mean(np.abs(samples - mu) < 3*sigma)
print(f"  Within 1 sigma: {within_1*100:.1f}% (expected ~68%)")
print(f"  Within 2 sigma: {within_2*100:.1f}% (expected ~95%)")
print(f"  Within 3 sigma: {within_3*100:.1f}% (expected ~99.7%)")
`

const cltCode = `import numpy as np

# Central Limit Theorem demonstration
# Take means of samples from NON-normal distributions
# The means will be approximately normal!

np.random.seed(42)
n_experiments = 5000
sample_sizes = [1, 2, 5, 30]

print("Source: Exponential(lambda=1) -- very skewed, not normal at all!")
print(f"True mean = 1.0, true std = 1.0\\n")

for n in sample_sizes:
    # Generate n_experiments sample means, each from n draws
    means = [np.random.exponential(1.0, size=n).mean() for _ in range(n_experiments)]
    means = np.array(means)

    # The CLT predicts: mean of means ≈ true mean
    # std of means ≈ true_std / sqrt(n)
    expected_std = 1.0 / np.sqrt(n)

    print(f"Sample size n={n:3d}:")
    print(f"  Mean of means: {means.mean():.4f} (expected: 1.0)")
    print(f"  Std of means:  {means.std():.4f} (expected: {expected_std:.4f})")
    print(f"  Skewness:      {float(np.mean(((means - means.mean())/means.std())**3)):.4f} (normal = 0)")
    print()

print("Notice: as n grows, skewness -> 0 (more normal)")
print("and std shrinks by 1/sqrt(n) -- exactly as CLT predicts!")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Distributions() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* Title */}
      <header>
        <h1 className="text-4xl font-bold text-white">Probability Distributions</h1>
        <p className="mt-3 text-lg text-gray-300">
          A probability distribution describes how likely different outcomes are. ML is built on
          probability — from noise modeling and Bayesian inference to generative models and
          loss functions. Understanding distributions gives you the vocabulary to reason about
          uncertainty, randomness, and data.
        </p>
      </header>

      {/* Section 1 — Discrete Distributions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Discrete Distributions</h2>
        <p className="text-gray-300">
          A <strong className="text-white">discrete distribution</strong> assigns probabilities
          to countable outcomes (0, 1, 2, ...). The three most common discrete distributions
          in ML are:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-gray-300">
          <li>
            <strong className="text-white">Bernoulli:</strong> A single coin flip with probability
            p of success. Used in binary classification.
          </li>
          <li>
            <strong className="text-white">Binomial:</strong> The number of successes in n
            independent Bernoulli trials. The histogram below simulates this.
          </li>
          <li>
            <strong className="text-white">Poisson:</strong> Counts of rare events per unit time
            (e.g., clicks per hour). Parameterized by rate &lambda;.
          </li>
        </ul>
        <p className="text-gray-300">
          Hit <em>Flip Coins</em> to simulate Binomial experiments. Each experiment flips n coins
          with probability p, counts successes, and adds to the histogram. The yellow curve is
          the theoretical distribution — watch the histogram converge to it.
        </p>
        <DiscreteDistSketch />
      </section>

      {/* Section 2 — Gaussian */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Gaussian (Normal) Distribution</h2>
        <p className="text-gray-300">
          The Gaussian is the most important distribution in statistics and ML. Its bell-shaped
          curve is fully described by two parameters: the <strong className="text-white">mean</strong>{' '}
          (&mu;) which centers the peak, and the <strong className="text-white">standard
          deviation</strong> (&sigma;) which controls the width.
        </p>
        <h3 className="text-lg font-medium text-white">The 68-95-99.7 Rule</h3>
        <p className="text-gray-300">
          For any Gaussian distribution, approximately 68% of data falls within 1 standard
          deviation of the mean, 95% within 2, and 99.7% within 3. This rule gives instant
          intuition about how &ldquo;unusual&rdquo; an observation is.
        </p>
        <p className="text-gray-300">
          Drag the sliders below to see how &mu; shifts the bell curve and &sigma; spreads or
          concentrates it. The shaded regions visualize the 68-95-99.7 rule.
        </p>
        <GaussianSketch />
      </section>

      {/* Section 3 — CLT */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Central Limit Theorem</h2>
        <p className="text-gray-300">
          The Central Limit Theorem (CLT) is one of the most profound results in statistics:
          <strong className="text-white"> the mean of a sufficiently large sample from any
          distribution will be approximately normally distributed</strong>, regardless of the
          original distribution&apos;s shape.
        </p>
        <p className="text-gray-300">
          Choose a source distribution below — even a highly non-normal one like exponential
          or bimodal. Then click <em>Sample</em> to repeatedly draw samples of size n and plot
          their means. Watch as the histogram of means converges to a perfect bell curve.
        </p>
        <p className="text-gray-300">
          The CLT is why the Gaussian appears everywhere: test statistics, confidence intervals,
          and even the noise in stochastic gradient descent all become approximately normal for
          large enough samples.
        </p>
        <CLTSketch />
      </section>

      {/* Python 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Distributions with NumPy</h2>
        <p className="text-gray-300">
          NumPy&apos;s <code className="text-sky-400">random</code> module can sample from all
          major distributions. Run the cell below to generate samples and verify theoretical
          properties like the 68-95-99.7 rule.
        </p>
        <PythonCell defaultCode={statsCode} title="Sampling from Distributions" />
      </section>

      {/* Python 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Central Limit Theorem</h2>
        <p className="text-gray-300">
          Verify the CLT numerically: take means of increasingly large samples from a skewed
          exponential distribution. Watch the skewness drop toward zero and the standard
          deviation of means shrink by exactly 1/&radic;n.
        </p>
        <PythonCell defaultCode={cltCode} title="CLT Verification" />
      </section>

      {/* Summary */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>Discrete distributions (Bernoulli, Binomial, Poisson) model countable outcomes.</li>
          <li>The Gaussian is parameterized by mean and std; the 68-95-99.7 rule quantifies spread.</li>
          <li>The Central Limit Theorem says sample means become Gaussian regardless of the source distribution.</li>
          <li>Most ML loss functions assume Gaussian noise; understanding distributions helps you choose the right model.</li>
        </ul>
      </section>
    </div>
  )
}
