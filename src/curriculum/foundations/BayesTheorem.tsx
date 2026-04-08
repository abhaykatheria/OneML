import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'foundations/bayes',
  title: "Bayes' Theorem & Statistical Thinking",
  description: 'Learn conditional probability, Bayes theorem, and how to update beliefs with evidence.',
  track: 'foundations',
  order: 6,
  tags: ['bayes', 'probability', 'conditional', 'prior', 'posterior', 'bayesian'],
}

/* ------------------------------------------------------------------ */
/* Section 1 — Venn Diagram (conditional probability)                  */
/* ------------------------------------------------------------------ */

function VennDiagramSketch() {
  const [pA, setPa] = useState(0.4)
  const [pB, setPb] = useState(0.5)
  const [pAB, setPab] = useState(0.2)

  const paRef = useRef(pA)
  paRef.current = pA
  const pbRef = useRef(pB)
  pbRef.current = pB
  const pabRef = useRef(pAB)
  pabRef.current = pAB

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 360

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const ctx = p.drawingContext as CanvasRenderingContext2D

      const cx = W / 2
      const cy = H / 2
      const r = 100

      const pa = paRef.current
      const pb = pbRef.current
      const pab = pabRef.current

      // Adjust overlap distance based on pAB
      const overlapRatio = pab / Math.min(pa, pb, 0.99)
      const dist = r * 2 * (1 - overlapRatio * 0.7)

      const aX = cx - dist * 0.25
      const bX = cx + dist * 0.25

      // Draw circles with blend
      ctx.globalCompositeOperation = 'screen'

      // Circle A
      p.fill(56, 100, 248, 80)
      p.stroke(56, 189, 248)
      p.strokeWeight(2)
      p.ellipse(aX, cy, r * 2 * Math.sqrt(pa), r * 2 * Math.sqrt(pa))

      // Circle B
      p.fill(248, 100, 56, 80)
      p.stroke(248, 113, 113)
      p.strokeWeight(2)
      p.ellipse(bX, cy, r * 2 * Math.sqrt(pb), r * 2 * Math.sqrt(pb))

      ctx.globalCompositeOperation = 'source-over'

      // Labels
      p.fill(56, 189, 248)
      p.noStroke()
      p.textSize(16)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('A', aX - r * Math.sqrt(pa) * 0.5, cy - r * Math.sqrt(pa) * 0.6)

      p.fill(248, 113, 113)
      p.text('B', bX + r * Math.sqrt(pb) * 0.5, cy - r * Math.sqrt(pb) * 0.6)

      // Intersection label
      if (pab > 0.01) {
        p.fill(255, 200, 100)
        p.textSize(14)
        p.text('A\u2229B', (aX + bX) / 2, cy)
      }

      // Probability readouts
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      const pBgivenA = pab / (pa || 0.001)
      const pAgivenB = pab / (pb || 0.001)

      const lines = [
        `P(A) = ${pa.toFixed(2)}`,
        `P(B) = ${pb.toFixed(2)}`,
        `P(A\u2229B) = ${pab.toFixed(2)}`,
        ``,
        `P(B|A) = P(A\u2229B) / P(A) = ${pBgivenA.toFixed(3)}`,
        `P(A|B) = P(A\u2229B) / P(B) = ${pAgivenB.toFixed(3)}`,
      ]

      lines.forEach((line, i) => {
        if (i < 3) { p.fill(255) } else if (i === 3) { p.fill(0) } else { p.fill(52, 211, 153) }
        p.text(line, 14, 14 + i * 20)
      })

      // Rectangle boundary (sample space)
      p.noFill()
      p.stroke(71, 85, 105)
      p.strokeWeight(1)
      p.rect(30, 30, W - 60, H - 60, 8)
      p.fill(71, 85, 105)
      p.textSize(11)
      p.textAlign(p.RIGHT, p.TOP)
      p.text('\u03A9 (sample space)', W - 40, 36)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={360} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          P(A): {pA.toFixed(2)}
          <input type="range" min={0.05} max={0.9} step={0.05} value={pA}
            onChange={(e) => { const v = Number(e.target.value); setPa(v); setPab(Math.min(pAB, v, pB)) }}
            className="w-24 accent-sky-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          P(B): {pB.toFixed(2)}
          <input type="range" min={0.05} max={0.9} step={0.05} value={pB}
            onChange={(e) => { const v = Number(e.target.value); setPb(v); setPab(Math.min(pAB, pA, v)) }}
            className="w-24 accent-red-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          P(A&cap;B): {pAB.toFixed(2)}
          <input type="range" min={0} max={Math.min(pA, pB)} step={0.01} value={pAB}
            onChange={(e) => setPab(Number(e.target.value))}
            className="w-24 accent-yellow-400" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Medical Test (Bayes' Theorem interactive)               */
/* ------------------------------------------------------------------ */

function MedicalTestSketch() {
  const [prevalence, setPrevalence] = useState(0.01)
  const [sensitivity, setSensitivity] = useState(0.95)
  const [specificity, setSpecificity] = useState(0.95)

  const prevRef = useRef(prevalence)
  prevRef.current = prevalence
  const sensRef = useRef(sensitivity)
  sensRef.current = sensitivity
  const specRef = useRef(specificity)
  specRef.current = specificity

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 440

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)

      const prev = prevRef.current
      const sens = sensRef.current
      const spec = specRef.current

      // Bayes calculation
      const pPos = sens * prev + (1 - spec) * (1 - prev)
      const posterior = (sens * prev) / (pPos || 0.001)

      // Confusion matrix values (per 10000 people)
      const N = 10000
      const sick = Math.round(N * prev)
      const healthy = N - sick
      const truePos = Math.round(sick * sens)
      const falseNeg = sick - truePos
      const trueNeg = Math.round(healthy * spec)
      const falsePos = healthy - trueNeg

      // Draw confusion matrix
      const mX = 60
      const mY = 60
      const cellW = 140
      const cellH = 70

      // Headers
      p.fill(148, 163, 184)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Actually Sick', mX + cellW * 0.5, mY - 15)
      p.text('Actually Healthy', mX + cellW * 1.5, mY - 15)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Test +', mX - 10, mY + cellH * 0.5)
      p.text('Test \u2013', mX - 10, mY + cellH * 1.5)

      // Cells
      const cells = [
        { val: truePos, label: 'True Pos', r: 52, g: 211, b: 153 },
        { val: falsePos, label: 'False Pos', r: 248, g: 113, b: 113 },
        { val: falseNeg, label: 'False Neg', r: 250, g: 204, b: 21 },
        { val: trueNeg, label: 'True Neg', r: 56, g: 189, b: 248 },
      ]

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const idx = row * 2 + col
          const c = cells[idx]
          const x = mX + col * cellW
          const y = mY + row * cellH
          p.fill(c.r, c.g, c.b, 25)
          p.stroke(c.r, c.g, c.b, 80)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellH, 4)
          p.fill(c.r, c.g, c.b)
          p.noStroke()
          p.textSize(20)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(String(c.val), x + cellW / 2, y + cellH / 2 - 8)
          p.textSize(11)
          p.fill(c.r, c.g, c.b, 180)
          p.text(c.label, x + cellW / 2, y + cellH / 2 + 16)
        }
      }

      // Results panel on the right
      const rx = mX + cellW * 2 + 40
      p.fill(255)
      p.noStroke()
      p.textSize(15)
      p.textAlign(p.LEFT, p.TOP)
      p.text("Bayes' Theorem:", rx, 60)

      p.textSize(12)
      p.fill(148, 163, 184)
      const formula = [
        '',
        'P(sick | test+) =',
        '  P(test+ | sick) \u00D7 P(sick)',
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        '         P(test+)',
        '',
        `  = ${sens.toFixed(2)} \u00D7 ${prev.toFixed(4)}`,
        `    \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `    ${pPos.toFixed(4)}`,
      ]
      formula.forEach((line, i) => {
        p.text(line, rx, 84 + i * 18)
      })

      // Big posterior result
      p.textSize(24)
      p.fill(posterior > 0.5 ? [52, 211, 153] : [248, 113, 113])
      p.text(`= ${(posterior * 100).toFixed(1)}%`, rx, 260)

      p.textSize(13)
      p.fill(255)
      p.text('Probability you are actually sick', rx, 290)
      p.text('given a positive test result', rx, 308)

      // Interpretation
      p.fill(148, 163, 184)
      p.textSize(12)
      const interp = prev < 0.05 && posterior < 0.5
        ? 'Even with a positive test, you are likely healthy!'
        : posterior > 0.8
        ? 'High prevalence makes the positive test reliable.'
        : 'Moderate confidence. Consider a second test.'

      p.text(interp, rx, 340)

      // Bar visualization of prior vs posterior
      const barY = H - 80
      const barW = W - 120
      const barH = 24

      p.fill(71, 85, 105)
      p.noStroke()
      p.rect(60, barY, barW, barH, 4)

      // Prior bar
      p.fill(250, 204, 21)
      p.rect(60, barY, Math.max(2, barW * prev), barH / 2, 2)
      p.textSize(11)
      p.textAlign(p.LEFT, p.CENTER)
      p.text(`Prior: ${(prev * 100).toFixed(2)}%`, 60 + barW * prev + 8, barY + barH / 4)

      // Posterior bar
      p.fill(52, 211, 153)
      p.rect(60, barY + barH / 2, Math.max(2, barW * posterior), barH / 2, 2)
      p.text(`Posterior: ${(posterior * 100).toFixed(1)}%`, 60 + Math.max(barW * posterior, 20) + 8, barY + 3 * barH / 4)

      // Labels
      p.fill(100, 116, 139)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('0%', 60, barY + barH + 4)
      p.text('100%', 60 + barW, barY + barH + 4)
    }
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={440} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Prevalence: {(prevalence * 100).toFixed(1)}%
          <input type="range" min={0.001} max={0.3} step={0.001} value={prevalence}
            onChange={(e) => setPrevalence(Number(e.target.value))} className="w-28 accent-yellow-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Sensitivity: {(sensitivity * 100).toFixed(0)}%
          <input type="range" min={0.5} max={0.99} step={0.01} value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))} className="w-28 accent-emerald-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Specificity: {(specificity * 100).toFixed(0)}%
          <input type="range" min={0.5} max={0.999} step={0.001} value={specificity}
            onChange={(e) => setSpecificity(Number(e.target.value))} className="w-28 accent-sky-500" />
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — Prior → Posterior (Beta distribution updating)           */
/* ------------------------------------------------------------------ */

function BetaUpdatingSketch() {
  const [alpha, setAlpha] = useState(1)
  const [beta, setBeta] = useState(1)
  const [totalH, setTotalH] = useState(0)
  const [totalT, setTotalT] = useState(0)

  const alphaRef = useRef(alpha)
  alphaRef.current = alpha
  const betaRef = useRef(beta)
  betaRef.current = beta
  const totalHRef = useRef(totalH)
  totalHRef.current = totalH
  const totalTRef = useRef(totalT)
  totalTRef.current = totalT

  // Beta PDF (unnormalized is fine since we normalize for display)
  function betaPDF(x: number, a: number, b: number): number {
    if (x <= 0 || x >= 1) return 0
    return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1)
  }

  const sketch = useCallback((p: p5) => {
    let W = 700
    const H = 360
    const PAD = 50

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      W = parent ? parent.clientWidth : 700
      p.createCanvas(W, H)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const ctx = p.drawingContext as CanvasRenderingContext2D

      const a0 = alphaRef.current
      const b0 = betaRef.current
      const h = totalHRef.current
      const t = totalTRef.current
      const aPost = a0 + h
      const bPost = b0 + t

      // Compute max y for scaling
      const steps = 200
      let maxPrior = 0
      let maxPost = 0
      for (let i = 1; i < steps; i++) {
        const x = i / steps
        const prior = betaPDF(x, a0, b0)
        const post = betaPDF(x, aPost, bPost)
        if (prior > maxPrior) maxPrior = prior
        if (post > maxPost) maxPost = post
      }
      const maxY = Math.max(maxPrior, maxPost, 0.01) * 1.1

      const mapX = (x: number) => PAD + x * (W - 2 * PAD)
      const mapY = (y: number) => H - PAD - (y / maxY) * (H - 2 * PAD - 20)

      // Axes
      p.stroke(100, 116, 139)
      p.strokeWeight(1)
      p.line(PAD, H - PAD, W - PAD, H - PAD)

      // x-axis labels
      p.fill(100, 116, 139)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      for (let x = 0; x <= 1; x += 0.2) {
        p.text(x.toFixed(1), mapX(x), H - PAD + 4)
      }
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('p (probability of heads)', W / 2, H - 4)

      // Prior curve
      p.noFill()
      p.stroke(148, 163, 184)
      p.strokeWeight(1.5)
      ctx.setLineDash([6, 4])
      p.beginShape()
      for (let i = 1; i < steps; i++) {
        const x = i / steps
        p.vertex(mapX(x), mapY(betaPDF(x, a0, b0)))
      }
      p.endShape()
      ctx.setLineDash([])

      // Posterior curve
      p.noFill()
      p.stroke(56, 189, 248)
      p.strokeWeight(2.5)
      p.beginShape()
      for (let i = 1; i < steps; i++) {
        const x = i / steps
        p.vertex(mapX(x), mapY(betaPDF(x, aPost, bPost)))
      }
      p.endShape()

      // Fill posterior
      p.fill(56, 189, 248, 30)
      p.noStroke()
      p.beginShape()
      p.vertex(mapX(1 / steps), mapY(0))
      for (let i = 1; i < steps; i++) {
        const x = i / steps
        p.vertex(mapX(x), mapY(betaPDF(x, aPost, bPost)))
      }
      p.vertex(mapX((steps - 1) / steps), mapY(0))
      p.endShape(p.CLOSE)

      // True mean line
      const postMean = aPost / (aPost + bPost)
      p.stroke(250, 204, 21)
      p.strokeWeight(1.5)
      ctx.setLineDash([4, 3])
      p.line(mapX(postMean), mapY(0), mapX(postMean), mapY(maxY * 0.9))
      ctx.setLineDash([])

      // Info
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Bayesian Updating with Beta Distribution', 14, 14)

      p.fill(148, 163, 184)
      p.textSize(12)
      p.text(`Prior: Beta(${a0}, ${b0})`, 14, 38)
      p.fill(56, 189, 248)
      p.text(`Posterior: Beta(${aPost}, ${bPost})`, 14, 56)
      p.fill(250, 204, 21)
      p.text(`Posterior mean: ${postMean.toFixed(3)}`, 14, 74)
      p.fill(148, 163, 184)
      p.text(`Data: ${h} heads, ${t} tails (${h + t} flips)`, 14, 92)

      // Legend
      p.textSize(11)
      p.fill(148, 163, 184)
      p.textAlign(p.RIGHT, p.TOP)
      p.text('Dashed gray = prior | Solid blue = posterior | Yellow = posterior mean', W - 14, 14)
    }
  }, [])

  const flipCoins = useCallback((numFlips: number) => {
    let h = 0
    for (let i = 0; i < numFlips; i++) {
      if (Math.random() < 0.6) h++ // biased coin (0.6)
    }
    setTotalH((prev) => prev + h)
    totalHRef.current += h
    setTotalT((prev) => prev + (numFlips - h))
    totalTRef.current += (numFlips - h)
  }, [])

  const handleReset = useCallback(() => {
    setTotalH(0)
    setTotalT(0)
    totalHRef.current = 0
    totalTRef.current = 0
  }, [])

  return (
    <div>
      <P5Sketch sketch={sketch} height={360} />
      <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
        <button onClick={() => flipCoins(1)}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
          Flip 1
        </button>
        <button onClick={() => flipCoins(10)}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
          Flip 10
        </button>
        <button onClick={() => flipCoins(100)}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
          Flip 100
        </button>
        <button onClick={handleReset}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600">
          Reset
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Prior &alpha;: {alpha}
          <input type="range" min={1} max={20} step={1} value={alpha}
            onChange={(e) => { setAlpha(Number(e.target.value)); alphaRef.current = Number(e.target.value) }}
            className="w-20 accent-gray-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Prior &beta;: {beta}
          <input type="range" min={1} max={20} step={1} value={beta}
            onChange={(e) => { setBeta(Number(e.target.value)); betaRef.current = Number(e.target.value) }}
            className="w-20 accent-gray-400" />
        </label>
      </div>
      <p className="mt-2 px-2 text-xs text-gray-500">
        The hidden coin has p=0.6 (biased). Watch the posterior concentrate around 0.6 as you collect more data.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const bayesCode = `import numpy as np

# Bayes' Theorem: Medical Test Example
# P(sick | test+) = P(test+ | sick) * P(sick) / P(test+)

def bayes_medical_test(prevalence, sensitivity, specificity):
    """Calculate posterior probability of being sick given positive test."""
    p_pos_given_sick = sensitivity
    p_pos_given_healthy = 1 - specificity
    p_pos = p_pos_given_sick * prevalence + p_pos_given_healthy * (1 - prevalence)
    posterior = (p_pos_given_sick * prevalence) / p_pos
    return posterior

# Scenario 1: Rare disease
print("=== Rare Disease (1% prevalence) ===")
prev = 0.01
post = bayes_medical_test(prev, sensitivity=0.95, specificity=0.95)
print(f"Prevalence: {prev*100:.1f}%")
print(f"Sensitivity: 95%, Specificity: 95%")
print(f"P(sick | test+) = {post*100:.1f}%")
print(f"Surprise! Only ~{post*100:.0f}% chance of being sick despite 95% accurate test!")
print(f"Why? Most positives are false positives from the large healthy population.\\n")

# Scenario 2: Common disease
prev2 = 0.20
post2 = bayes_medical_test(prev2, sensitivity=0.95, specificity=0.95)
print(f"=== Common Disease (20% prevalence) ===")
print(f"P(sick | test+) = {post2*100:.1f}%\\n")

# Scenario 3: Two tests
print("=== Two Independent Tests ===")
# Use posterior from first test as prior for second
post_after_2 = bayes_medical_test(post, sensitivity=0.95, specificity=0.95)
print(f"After 1st positive test: {post*100:.1f}%")
print(f"After 2nd positive test: {post_after_2*100:.1f}%")
print("A second test dramatically increases confidence!")
`

const bayesianUpdatingCode = `import numpy as np

# Bayesian updating: estimating a coin's bias
# Prior: Beta(alpha, beta)
# After observing h heads and t tails:
# Posterior: Beta(alpha + h, beta + t)

np.random.seed(42)
true_p = 0.7  # the actual bias
alpha, beta_param = 1, 1  # uniform prior (no initial belief)

print(f"True coin bias: {true_p}")
print(f"Prior: Beta({alpha}, {beta_param})")
print(f"Prior mean: {alpha/(alpha+beta_param):.3f}\\n")

print(f"{'Flips':>6s}  {'Heads':>6s}  {'Post Alpha':>10s}  {'Post Beta':>10s}  {'Post Mean':>10s}  {'95% CI':>20s}")
print("-" * 70)

total_h, total_t = 0, 0
for n_new in [1, 4, 5, 10, 30, 50]:
    # Simulate flips
    flips = np.random.binomial(1, true_p, size=n_new)
    h = flips.sum()
    total_h += h
    total_t += (n_new - h)

    a_post = alpha + total_h
    b_post = beta_param + total_t
    post_mean = a_post / (a_post + b_post)

    # 95% credible interval using Beta quantiles
    from scipy import stats as sp_stats
    ci_lo = sp_stats.beta.ppf(0.025, a_post, b_post)
    ci_hi = sp_stats.beta.ppf(0.975, a_post, b_post)

    total = total_h + total_t
    print(f"{total:6d}  {total_h:6d}  {a_post:10d}  {b_post:10d}  {post_mean:10.3f}  [{ci_lo:.3f}, {ci_hi:.3f}]")

print(f"\\nWith more data, the posterior concentrates around the true value {true_p}")
print(f"and the credible interval narrows — we become more certain.")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function BayesTheorem() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* Title */}
      <header>
        <h1 className="text-4xl font-bold text-white">Bayes&apos; Theorem &amp; Statistical Thinking</h1>
        <p className="mt-3 text-lg text-gray-300">
          Bayes&apos; theorem tells us how to update our beliefs when we observe new evidence.
          It is the mathematical foundation of Bayesian statistics, spam filters, medical
          diagnosis, and a growing portion of modern ML including Bayesian neural networks
          and probabilistic programming.
        </p>
      </header>

      {/* Section 1 — Conditional Probability */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Conditional Probability</h2>
        <p className="text-gray-300">
          The probability of A given that B has occurred is written{' '}
          <code className="text-sky-400">P(A|B) = P(A&cap;B) / P(B)</code>. It answers: &ldquo;If
          I already know B happened, how likely is A?&rdquo;
        </p>
        <p className="text-gray-300">
          In the Venn diagram below, the intersection region represents outcomes where both A
          and B occur. Conditional probability zooms into the B circle and asks what fraction
          of it is also in A. Adjust the sliders to see how changing overlap affects conditional
          probabilities.
        </p>
        <VennDiagramSketch />
      </section>

      {/* Section 2 — Bayes' Theorem Derivation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Bayes&apos; Theorem</h2>
        <p className="text-gray-300">
          Since P(A|B) = P(A&cap;B)/P(B) and P(B|A) = P(A&cap;B)/P(A), we can rearrange:
        </p>
        <div className="rounded-lg bg-gray-800 px-6 py-4 text-center font-mono text-lg text-sky-300">
          P(A|B) = P(B|A) &middot; P(A) / P(B)
        </div>
        <p className="text-gray-300">
          In words: the <strong className="text-white">posterior</strong> P(A|B) equals the{' '}
          <strong className="text-white">likelihood</strong> P(B|A) times the{' '}
          <strong className="text-white">prior</strong> P(A), divided by the{' '}
          <strong className="text-white">evidence</strong> P(B). This formula lets us reverse
          the direction of conditioning — going from &ldquo;how likely is the evidence given
          the hypothesis&rdquo; to &ldquo;how likely is the hypothesis given the evidence.&rdquo;
        </p>
      </section>

      {/* Section 3 — Medical Test Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">The Medical Test Paradox</h2>
        <p className="text-gray-300">
          A test that is 95% accurate sounds excellent — but if the disease is rare (say 1%
          prevalence), a positive result means you probably <em>don&apos;t</em> have the disease!
          This counterintuitive result is the base rate fallacy, and Bayes&apos; theorem explains it.
        </p>
        <p className="text-gray-300">
          Adjust the prevalence, sensitivity (true positive rate), and specificity (true negative
          rate) below. The confusion matrix shows how 10,000 people would be classified. Watch
          how the posterior probability (bottom bar) changes — low prevalence means most
          positives are false positives.
        </p>
        <MedicalTestSketch />
      </section>

      {/* Section 4 — Bayesian Updating */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Prior &rarr; Posterior Updating</h2>
        <p className="text-gray-300">
          Bayesian inference is an iterative process: start with a <strong className="text-white">
          prior belief</strong> (what you believe before seeing data), observe data, then
          compute the <strong className="text-white">posterior</strong> (updated belief). The
          posterior becomes your new prior for the next batch of data.
        </p>
        <p className="text-gray-300">
          The Beta distribution is the natural prior for a probability parameter. Below, the
          hidden coin has a bias of 0.6. Start with a flat prior (Beta(1,1) = uniform) and
          click to flip coins. Watch the posterior concentrate around the true value as
          evidence accumulates. Try changing the prior strength with the &alpha; and &beta;
          sliders — a strong prior resists change.
        </p>
        <BetaUpdatingSketch />
      </section>

      {/* Python 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Bayes&apos; Theorem</h2>
        <p className="text-gray-300">
          Implement Bayes&apos; theorem for the medical test scenario. Explore how prevalence
          affects the posterior, and see why a second independent test dramatically increases
          confidence.
        </p>
        <PythonCell defaultCode={bayesCode} title="Bayes' Theorem Calculator" />
      </section>

      {/* Python 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hands-On: Bayesian Updating</h2>
        <p className="text-gray-300">
          Use the Beta-Binomial conjugate model to track how our belief about a coin&apos;s bias
          evolves as we observe more flips. The 95% credible interval narrows with more data,
          giving us quantified uncertainty.
        </p>
        <PythonCell defaultCode={bayesianUpdatingCode} title="Bayesian Coin Estimation" />
      </section>

      {/* Summary */}
      <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="text-xl font-semibold text-white">Key Takeaways</h2>
        <ul className="list-disc space-y-1 pl-5 text-gray-300">
          <li>Conditional probability P(A|B) restricts attention to outcomes where B is true.</li>
          <li>Bayes&apos; theorem inverts conditioning: posterior = likelihood x prior / evidence.</li>
          <li>Base rates (priors) matter enormously — a rare disease makes most positives false.</li>
          <li>Bayesian updating treats probability as a state of belief that refines with data.</li>
          <li>The Beta distribution is a natural conjugate prior for probability parameters.</li>
        </ul>
      </section>
    </div>
  )
}
