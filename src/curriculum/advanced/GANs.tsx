import { useState, useCallback, useRef } from 'react'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import ControlPanel from '../../components/viz/ControlPanel'

export const meta: LessonMeta = {
  id: 'advanced/gans',
  title: 'Generative Adversarial Networks',
  description: 'Generator vs. discriminator, training dynamics, mode collapse, and Wasserstein GANs',
  track: 'advanced',
  order: 3,
  tags: ['gan', 'generative', 'discriminator', 'mode-collapse', 'wasserstein'],
}

/* ------------------------------------------------------------------ */
/*  Helpers: 1D Gaussian                                               */
/* ------------------------------------------------------------------ */
function gaussianPdf(x: number, mu: number, sigma: number): number {
  const coeff = 1 / (sigma * Math.sqrt(2 * Math.PI))
  const exp = Math.exp(-0.5 * ((x - mu) / sigma) ** 2)
  return coeff * exp
}

function mixturePdf(x: number): number {
  return 0.4 * gaussianPdf(x, -2, 0.8) + 0.6 * gaussianPdf(x, 2.5, 1.0)
}

function sampleFromMixture(): number {
  if (Math.random() < 0.4) {
    return -2 + 0.8 * randn()
  }
  return 2.5 + 1.0 * randn()
}

function randn(): number {
  // Box-Muller transform
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/* ================================================================== */
/*  Section 1 -- The GAN Idea                                          */
/* ================================================================== */
function GANIdeaSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The GAN Idea: Counterfeiter vs. Detective</h2>
      <p className="text-gray-300 leading-relaxed">
        Imagine two players locked in an escalating game. The
        <span className="text-emerald-400 font-semibold"> counterfeiter</span> (generator) creates
        fake currency and tries to pass it off as real. The
        <span className="text-emerald-400 font-semibold"> detective</span> (discriminator) examines
        bills and tries to distinguish real from fake. As the detective gets better at spotting
        fakes, the counterfeiter is forced to improve. As the counterfeiter improves, the
        detective must become even more discerning. This adversarial dynamic drives both players
        to improve, and in the ideal equilibrium, the counterfeiter produces bills
        indistinguishable from real ones.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is the core idea behind Generative Adversarial Networks, introduced by Ian Goodfellow
        in 2014. A GAN consists of two neural networks trained simultaneously:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-gray-800/60 border border-emerald-800/40 rounded-lg p-4">
          <h3 className="text-lg font-bold text-emerald-400 mb-2">Generator G(z)</h3>
          <p className="text-gray-300 text-sm">
            Takes random noise z (from a simple distribution like a Gaussian) and transforms it
            into a synthetic data sample. The generator never sees real data directly -- it only
            receives gradient signals from the discriminator telling it how to improve.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-indigo-800/40 rounded-lg p-4">
          <h3 className="text-lg font-bold text-indigo-400 mb-2">Discriminator D(x)</h3>
          <p className="text-gray-300 text-sm">
            Takes a data sample (either real or generated) and outputs a probability that the
            sample is real. It is trained as a binary classifier: maximize D(x) for real samples
            and minimize D(G(z)) for fake samples.
          </p>
        </div>
      </div>
      <p className="text-gray-300 leading-relaxed mt-4">
        Training alternates between updating the discriminator (to better distinguish real from
        fake) and updating the generator (to better fool the discriminator). When training
        succeeds, the generator learns to produce samples from a distribution that matches the
        real data distribution. At that point, D(x) = 0.5 everywhere -- it cannot tell real
        from fake.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Training Dynamics: Distribution Matching               */
/* ================================================================== */
function TrainingDynamicsSection() {
  const [running, setRunning] = useState(false)
  const runRef = useRef(running)
  runRef.current = running

  // Generator: parameterized as a simple linear transform of noise
  // G(z) = mu_g + sigma_g * z, then we add a second mode
  const genParamsRef = useRef({
    mu1: -5,
    sigma1: 2.0,
    mu2: 5,
    sigma2: 2.0,
    mix: 0.5,
  })
  const epochRef = useRef(0)

  function generatorPdf(x: number): number {
    const gp = genParamsRef.current
    return gp.mix * gaussianPdf(x, gp.mu1, gp.sigma1) +
      (1 - gp.mix) * gaussianPdf(x, gp.mu2, gp.sigma2)
  }

  function sampleGenerator(): number {
    const gp = genParamsRef.current
    if (Math.random() < gp.mix) {
      return gp.mu1 + gp.sigma1 * randn()
    }
    return gp.mu2 + gp.sigma2 * randn()
  }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 380)
      p.textFont('monospace')
      p.frameRate(30)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const plotL = 60
      const plotR = W - 30
      const plotT = 55
      const plotB = H - 80
      const plotW = plotR - plotL
      const plotH = plotB - plotT

      const xMin = -7
      const xMax = 7
      const yMax = 0.45

      // Header
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text(`GAN Training: Generator Distribution Approaching Real Data  |  Epoch: ${epochRef.current}`, W / 2, 22)
      p.textSize(10)
      p.fill(150)
      p.text(runRef.current ? 'Training...' : 'Click Start to begin', W / 2, 38)

      // Axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(plotL, plotB, plotR, plotB) // x-axis
      p.line(plotL, plotT, plotL, plotB) // y-axis

      // X ticks
      p.noStroke()
      p.fill(100)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (let v = -6; v <= 6; v += 2) {
        const sx = plotL + ((v - xMin) / (xMax - xMin)) * plotW
        p.text(v.toString(), sx, plotB + 4)
        p.stroke(40)
        p.strokeWeight(0.5)
        p.line(sx, plotT, sx, plotB)
        p.noStroke()
      }

      // Y ticks
      p.textAlign(p.RIGHT, p.CENTER)
      for (let v = 0; v <= yMax; v += 0.1) {
        const sy = plotB - (v / yMax) * plotH
        p.fill(100)
        p.text(v.toFixed(1), plotL - 5, sy)
        p.stroke(40)
        p.strokeWeight(0.5)
        p.line(plotL, sy, plotR, sy)
        p.noStroke()
      }

      // Real distribution (filled area)
      p.noStroke()
      p.fill(80, 180, 120, 40)
      p.beginShape()
      p.vertex(plotL, plotB)
      const steps = 150
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin)
        const y = mixturePdf(x)
        const sx = plotL + (i / steps) * plotW
        const sy = plotB - (y / yMax) * plotH
        p.vertex(sx, sy)
      }
      p.vertex(plotR, plotB)
      p.endShape(p.CLOSE)

      // Real distribution (line)
      p.stroke(80, 200, 130)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin)
        const y = mixturePdf(x)
        const sx = plotL + (i / steps) * plotW
        const sy = plotB - (y / yMax) * plotH
        p.vertex(sx, sy)
      }
      p.endShape()

      // Generator distribution (filled area)
      p.noStroke()
      p.fill(180, 100, 255, 30)
      p.beginShape()
      p.vertex(plotL, plotB)
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin)
        const y = generatorPdf(x)
        const sx = plotL + (i / steps) * plotW
        const sy = plotB - (Math.min(y, yMax) / yMax) * plotH
        p.vertex(sx, sy)
      }
      p.vertex(plotR, plotB)
      p.endShape(p.CLOSE)

      // Generator distribution (line)
      p.stroke(180, 120, 255)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin)
        const y = generatorPdf(x)
        const sx = plotL + (i / steps) * plotW
        const sy = plotB - (Math.min(y, yMax) / yMax) * plotH
        p.vertex(sx, sy)
      }
      p.endShape()

      // Sample dots from generator
      p.noStroke()
      p.fill(180, 120, 255, 100)
      for (let i = 0; i < 30; i++) {
        const sample = sampleGenerator()
        if (sample >= xMin && sample <= xMax) {
          const sx = plotL + ((sample - xMin) / (xMax - xMin)) * plotW
          p.ellipse(sx, plotB + 16, 4, 4)
        }
      }

      // Sample dots from real
      p.fill(80, 200, 130, 100)
      for (let i = 0; i < 30; i++) {
        const sample = sampleFromMixture()
        if (sample >= xMin && sample <= xMax) {
          const sx = plotL + ((sample - xMin) / (xMax - xMin)) * plotW
          p.ellipse(sx, plotB + 26, 4, 4)
        }
      }

      // Legend
      const ly = H - 32
      p.textSize(11)
      p.textAlign(p.LEFT)
      p.noStroke()
      p.fill(80, 200, 130)
      p.rect(plotL, ly, 14, 3)
      p.fill(180); p.text('Real data distribution', plotL + 20, ly + 5)

      p.fill(180, 120, 255)
      p.rect(plotL + 200, ly, 14, 3)
      p.fill(180); p.text('Generator distribution', plotL + 220, ly + 5)

      // Training step: move generator params toward real distribution
      if (runRef.current) {
        const gp = genParamsRef.current
        const lr = 0.008

        // Simple gradient: sample from real, nudge generator means/sigmas/mix toward it
        // This is a simplified illustration (real GANs use backprop)
        for (let t = 0; t < 20; t++) {
          const realSample = sampleFromMixture()
          sampleGenerator()

          // Nudge mu1 toward real samples that are negative
          if (realSample < 0) {
            gp.mu1 += lr * (realSample - gp.mu1) * 0.1
            gp.sigma1 += lr * (Math.abs(realSample - gp.mu1) - gp.sigma1) * 0.05
          }
          // Nudge mu2 toward positive real samples
          if (realSample >= 0) {
            gp.mu2 += lr * (realSample - gp.mu2) * 0.1
            gp.sigma2 += lr * (Math.abs(realSample - gp.mu2) - gp.sigma2) * 0.05
          }

          // Nudge mix toward true mix
          gp.mix += lr * (0.4 - gp.mix) * 0.02
        }

        // Clamp parameters
        gp.sigma1 = Math.max(0.2, gp.sigma1)
        gp.sigma2 = Math.max(0.2, gp.sigma2)
        gp.mix = Math.max(0.05, Math.min(0.95, gp.mix))

        epochRef.current++
      }
    }
  }, [])

  const handleReset = () => {
    genParamsRef.current = { mu1: -5, sigma1: 2.0, mu2: 5, sigma2: 2.0, mix: 0.5 }
    epochRef.current = 0
    setRunning(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Training Dynamics: Distribution Matching</h2>
      <p className="text-gray-300 leading-relaxed">
        The goal of GAN training is for the generator's output distribution (purple) to match the
        real data distribution (green). The real distribution below is a mixture of two Gaussians
        -- a bimodal distribution that the generator must learn to reproduce. Initially, the
        generator's distribution is far from the real one. As training progresses, watch the
        purple curve morph and shift to overlap with the green curve.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The dots below the x-axis show individual samples from each distribution. When training
        converges, the two sets of dots should be intermixed -- generated samples become
        indistinguishable from real ones.
      </p>
      <P5Sketch sketch={sketch} height={380} controls={
        <ControlPanel title="GAN Training">
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${running ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
            >
              {running ? 'Pause' : 'Start Training'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 rounded text-sm font-medium bg-gray-600 text-white"
            >
              Reset
            </button>
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Mode Collapse                                         */
/* ================================================================== */
function ModeCollapseSection() {
  const [collapsed, setCollapsed] = useState(false)
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  const sketch = useCallback((p: p5) => {
    const genSamples: number[] = []
    let initialized = false

    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 320)
      p.textFont('monospace')
      p.frameRate(15)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const isCollapsed = collapsedRef.current

      // Generate samples each frame
      if (!initialized || p.frameCount % 5 === 0) {
        genSamples.length = 0
        for (let i = 0; i < 200; i++) {
          if (isCollapsed) {
            // Mode collapse: all samples from one mode
            genSamples.push(2.5 + 0.3 * randn())
          } else {
            // Healthy: samples from both modes
            genSamples.push(sampleFromMixture())
          }
        }
        initialized = true
      }

      const plotL = 60
      const plotR = W - 30
      const plotT = 55
      const plotB = H - 60
      const plotW = plotR - plotL
      const plotH = plotB - plotT
      const xMin = -6
      const xMax = 7

      // Header
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text(
        isCollapsed
          ? 'MODE COLLAPSE: Generator only produces one type of output'
          : 'HEALTHY: Generator covers the full data distribution',
        W / 2, 22
      )

      // Real distribution
      p.stroke(80, 200, 130, 120)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let i = 0; i <= 120; i++) {
        const x = xMin + (i / 120) * (xMax - xMin)
        const y = mixturePdf(x)
        p.vertex(plotL + (i / 120) * plotW, plotB - (y / 0.4) * plotH)
      }
      p.endShape()

      // Histogram of generated samples
      const nBins = 40
      const bins = new Array(nBins).fill(0)
      for (const s of genSamples) {
        const bin = Math.floor(((s - xMin) / (xMax - xMin)) * nBins)
        if (bin >= 0 && bin < nBins) bins[bin]++
      }
      const maxBin = Math.max(...bins, 1)

      p.noStroke()
      for (let i = 0; i < nBins; i++) {
        const x = plotL + (i / nBins) * plotW
        const bw = plotW / nBins
        const bh = (bins[i] / maxBin) * plotH * 0.9
        p.fill(180, 120, 255, 120)
        p.rect(x, plotB - bh, bw - 1, bh)
      }

      // Axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(plotL, plotB, plotR, plotB)
      p.line(plotL, plotT, plotL, plotB)

      // Labels
      p.noStroke()
      p.fill(100)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      for (let v = -6; v <= 6; v += 2) {
        const sx = plotL + ((v - xMin) / (xMax - xMin)) * plotW
        p.text(v.toString(), sx, plotB + 4)
      }

      // Legend
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.fill(80, 200, 130)
      p.rect(plotL, H - 30, 14, 3)
      p.fill(180)
      p.text('Real distribution', plotL + 20, H - 26)
      p.fill(180, 120, 255, 180)
      p.rect(plotL + 170, H - 30, 14, 10)
      p.fill(180)
      p.text('Generated samples (histogram)', plotL + 190, H - 26)

      // Annotation for collapsed mode
      if (isCollapsed) {
        p.fill(255, 100, 100, 180)
        p.textSize(11)
        p.textAlign(p.CENTER)
        p.text(
          '\u2193 Only one mode captured!',
          plotL + ((2.5 - xMin) / (xMax - xMin)) * plotW,
          plotT + 10
        )
        p.text(
          '\u2193 This mode is completely ignored',
          plotL + ((-2 - xMin) / (xMax - xMin)) * plotW,
          plotT + 10
        )
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Mode Collapse</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most common failure modes of GANs is <span className="text-white font-semibold">mode
        collapse</span>. This happens when the generator learns to produce only a small subset of
        the possible outputs, ignoring large parts of the real data distribution. If the real data
        has multiple "modes" (clusters), the generator might learn to produce samples from only
        one of them.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Why does this happen? Consider the generator's perspective: it is easier to fool the
        discriminator by producing one type of very convincing output than by covering the full
        diversity of the real data. If the generator stumbles on a particular output that reliably
        fools the discriminator, it has no incentive to explore other parts of the space. The
        discriminator then adapts to reject that output, the generator switches to a different
        mode, and the cycle continues -- but the generator never learns to cover all modes
        simultaneously.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Toggle between "healthy" and "collapsed" below to see the difference. In healthy training,
        the generated samples (purple histogram) cover both peaks of the real distribution (green
        curve). In mode collapse, all samples cluster around a single peak.
      </p>
      <P5Sketch sketch={sketch} height={320} controls={
        <ControlPanel title="Mode Collapse Demo">
          <div className="flex gap-2">
            <button
              onClick={() => setCollapsed(false)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${!collapsed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Healthy Training
            </button>
            <button
              onClick={() => setCollapsed(true)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${collapsed ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Mode Collapse
            </button>
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- GAN Loss Functions                                    */
/* ================================================================== */
function GANLossSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">GAN Loss Functions</h2>
      <p className="text-gray-300 leading-relaxed">
        The original GAN formulation is a minimax game. The discriminator tries to maximize, and
        the generator tries to minimize, the following objective:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        min<sub>G</sub> max<sub>D</sub> E<sub>x~p_data</sub>[log D(x)] + E<sub>z~p_z</sub>[log(1 - D(G(z)))]
      </p>
      <p className="text-gray-300 leading-relaxed">
        Breaking this down intuitively:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <span className="text-white font-semibold">E[log D(x)]</span> -- The discriminator wants
          D(x) close to 1 for real data, making log D(x) close to 0 (its maximum).
        </li>
        <li>
          <span className="text-white font-semibold">E[log(1 - D(G(z)))]</span> -- For generated
          samples, the discriminator wants D(G(z)) close to 0, making log(1 - D(G(z))) close to
          0. The generator wants D(G(z)) close to 1, making this term very negative.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        At equilibrium, the discriminator outputs D(x) = 0.5 everywhere -- it can no longer
        distinguish real from fake. This corresponds to the generator perfectly matching the
        real data distribution. The theoretical connection is to the
        <span className="text-emerald-400 font-semibold"> Jensen-Shannon (JS) divergence</span> between
        the real and generated distributions, which is zero when the two distributions are
        identical.
      </p>
      <h3 className="text-xl font-bold text-white mt-6">The Vanishing Gradient Problem</h3>
      <p className="text-gray-300 leading-relaxed">
        In practice, the original loss has a subtle problem. Early in training, the generator
        produces obvious fakes, so D(G(z)) is near 0. The gradient of log(1 - D(G(z))) with
        respect to G is very small when D(G(z)) is near 0, giving the generator almost no
        learning signal when it needs it most. A common fix is to train the generator to maximize
        log D(G(z)) instead of minimize log(1 - D(G(z))) -- this has the same fixed point but
        provides much stronger gradients early in training.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Wasserstein GAN                                       */
/* ================================================================== */
function WassersteinSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Wasserstein GAN (WGAN)</h2>
      <p className="text-gray-300 leading-relaxed">
        The Wasserstein GAN, proposed by Arjovsky et al. in 2017, addresses the fundamental
        instabilities of the original GAN by replacing the JS divergence with the
        <span className="text-emerald-400 font-semibold"> Wasserstein distance</span> (also called
        the Earth Mover's distance). Intuitively, the Wasserstein distance measures the minimum
        "work" needed to transform one distribution into another -- imagine the distributions as
        piles of dirt, and compute the minimum cost of shoveling one pile into the shape of the
        other.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The critical advantage: the Wasserstein distance provides meaningful gradients even when
        the real and generated distributions do not overlap. The JS divergence can be constant
        (and thus have zero gradient) in this case, which is exactly why the original GAN
        suffers from vanishing gradients. The WGAN objective is:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        min<sub>G</sub> max<sub>D &isin; 1-Lipschitz</sub> E<sub>x~p_data</sub>[D(x)] - E<sub>z~p_z</sub>[D(G(z))]
      </p>
      <p className="text-gray-300 leading-relaxed">
        The "1-Lipschitz" constraint on D (now called the "critic" rather than discriminator)
        is enforced either by weight clipping (original WGAN) or by a gradient penalty term
        (WGAN-GP, which works much better in practice).
      </p>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 mt-4">
        <h3 className="text-lg font-bold text-white mb-2">WGAN vs Original GAN: Key Differences</h3>
        <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
          <li>Critic outputs an unbounded score, not a probability</li>
          <li>Loss correlates with sample quality (you can monitor it!)</li>
          <li>More stable training -- less sensitivity to architecture and hyperparameters</li>
          <li>Reduces mode collapse (Wasserstein distance captures diversity better)</li>
          <li>Critic can be trained to convergence before each generator update</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Applications                                          */
/* ================================================================== */
function ApplicationsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Applications of GANs</h2>
      <p className="text-gray-300 leading-relaxed">
        GANs have found applications across an extraordinary range of domains:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-2">Image Generation</h3>
          <p className="text-gray-300 text-sm">
            StyleGAN and StyleGAN2 can generate photorealistic human faces that do not exist.
            The generator learns to control fine-grained attributes like hair color, age, and
            facial expression through a style-based architecture.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-2">Style Transfer</h3>
          <p className="text-gray-300 text-sm">
            CycleGAN performs unpaired image-to-image translation: turn horses into zebras,
            summer scenes into winter, or Monet paintings into photographs. It uses cycle
            consistency loss to learn mappings without paired training data.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-2">Super-Resolution</h3>
          <p className="text-gray-300 text-sm">
            SRGAN and ESRGAN upscale low-resolution images to high resolution with perceptually
            realistic details. Unlike traditional interpolation, GANs can hallucinate plausible
            fine textures and sharp edges.
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-2">Data Augmentation</h3>
          <p className="text-gray-300 text-sm">
            GANs can generate synthetic training data for domains where real data is scarce
            or expensive (medical imaging, autonomous driving, anomaly detection). This is
            particularly valuable in healthcare where patient data is limited and private.
          </p>
        </div>
      </div>
      <p className="text-gray-300 leading-relaxed mt-4">
        While diffusion models have largely overtaken GANs for image generation in 2023-2025
        (DALL-E, Stable Diffusion, Midjourney all use diffusion), GANs remain relevant for
        their speed (single forward pass vs. many denoising steps) and for applications where
        latency matters, like real-time video enhancement and style transfer.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Python code strings                                                */
/* ================================================================== */
const ganCode = `import numpy as np

# Simple 1D GAN: Generator learns to match a Gaussian distribution
np.random.seed(42)

# Real data: samples from N(3, 0.5)
real_mean, real_std = 3.0, 0.5

# Generator: G(z) = g_mu + g_sigma * z, where z ~ N(0,1)
g_mu = 0.0
g_sigma = 1.0

# Discriminator: simple logistic regression on 1D input
# D(x) = sigmoid(d_w * x + d_b)
d_w = 0.0
d_b = 0.0

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -10, 10)))

lr_d = 0.05
lr_g = 0.02
n_epochs = 3000
batch_size = 64

g_losses = []
d_losses = []

for epoch in range(n_epochs):
    # --- Train Discriminator ---
    # Real samples
    real = np.random.normal(real_mean, real_std, batch_size)
    # Fake samples
    z = np.random.normal(0, 1, batch_size)
    fake = g_mu + g_sigma * z

    # D predictions
    d_real = sigmoid(d_w * real + d_b)
    d_fake = sigmoid(d_w * fake + d_b)

    # Binary cross-entropy gradients for D
    # Maximize: E[log D(real)] + E[log(1 - D(fake))]
    d_loss = -np.mean(np.log(d_real + 1e-8) + np.log(1 - d_fake + 1e-8))

    # Gradients
    grad_d_w_real = np.mean((1 - d_real) * real)
    grad_d_b_real = np.mean(1 - d_real)
    grad_d_w_fake = np.mean(-d_fake * fake)
    grad_d_b_fake = np.mean(-d_fake)

    d_w += lr_d * (grad_d_w_real + grad_d_w_fake)
    d_b += lr_d * (grad_d_b_real + grad_d_b_fake)

    # --- Train Generator ---
    z = np.random.normal(0, 1, batch_size)
    fake = g_mu + g_sigma * z
    d_fake = sigmoid(d_w * fake + d_b)

    # Maximize E[log D(G(z))]
    g_loss = -np.mean(np.log(d_fake + 1e-8))

    # Gradient w.r.t. generator params (chain rule through D)
    # dG_loss/d_g_mu = d_w * mean((1 - d_fake))  (simplified)
    grad_g_mu = d_w * np.mean(1 - d_fake)
    grad_g_sigma = d_w * np.mean((1 - d_fake) * z)

    g_mu += lr_g * grad_g_mu
    g_sigma += lr_g * grad_g_sigma
    g_sigma = max(0.01, g_sigma)  # keep positive

    g_losses.append(g_loss)
    d_losses.append(d_loss)

print(f"Real distribution:      N({real_mean}, {real_std})")
print(f"Learned generator:      N({g_mu:.3f}, {abs(g_sigma):.3f})")
print(f"Error in mean:          {abs(g_mu - real_mean):.4f}")
print(f"Error in std:           {abs(abs(g_sigma) - real_std):.4f}")

# Generate and compare
gen_samples = g_mu + g_sigma * np.random.normal(0, 1, 10000)
real_samples = np.random.normal(real_mean, real_std, 10000)
print(f"\\nGenerated mean: {np.mean(gen_samples):.3f}, std: {np.std(gen_samples):.3f}")
print(f"Real mean:      {np.mean(real_samples):.3f}, std: {np.std(real_samples):.3f}")
`

const ganPlotCode = `import numpy as np
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt

np.random.seed(42)
real_mean, real_std = 3.0, 0.5
g_mu, g_sigma = 0.0, 1.0
d_w, d_b = 0.0, 0.0

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -10, 10)))

lr_d, lr_g = 0.05, 0.02
batch_size = 64
n_epochs = 3000
g_losses, d_losses = [], []
g_mus, g_sigmas = [], []

for epoch in range(n_epochs):
    real = np.random.normal(real_mean, real_std, batch_size)
    z = np.random.normal(0, 1, batch_size)
    fake = g_mu + g_sigma * z

    d_real = sigmoid(d_w * real + d_b)
    d_fake = sigmoid(d_w * fake + d_b)
    d_loss = -np.mean(np.log(d_real + 1e-8) + np.log(1 - d_fake + 1e-8))

    d_w += lr_d * (np.mean((1 - d_real) * real) + np.mean(-d_fake * fake))
    d_b += lr_d * (np.mean(1 - d_real) + np.mean(-d_fake))

    z = np.random.normal(0, 1, batch_size)
    fake = g_mu + g_sigma * z
    d_fake = sigmoid(d_w * fake + d_b)
    g_loss = -np.mean(np.log(d_fake + 1e-8))

    g_mu += lr_g * d_w * np.mean(1 - d_fake)
    g_sigma += lr_g * d_w * np.mean((1 - d_fake) * z)
    g_sigma = max(0.01, g_sigma)

    g_losses.append(g_loss)
    d_losses.append(d_loss)
    g_mus.append(g_mu)
    g_sigmas.append(abs(g_sigma))

fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# Plot 1: D loss and G loss over epochs
ax = axes[0, 0]
window = 50
sm_g = np.convolve(g_losses, np.ones(window)/window, mode='valid')
sm_d = np.convolve(d_losses, np.ones(window)/window, mode='valid')
ax.plot(sm_d, color='#6366f1', label='D loss', linewidth=1.5)
ax.plot(sm_g, color='#f59e0b', label='G loss', linewidth=1.5)
ax.set_xlabel('Epoch')
ax.set_ylabel('Loss (smoothed)')
ax.set_title('Discriminator vs Generator Loss')
ax.legend()
ax.grid(alpha=0.3)

# Plot 2: Generator parameters over time
ax = axes[0, 1]
ax.plot(g_mus, color='#10b981', label='Generator mean', linewidth=1.5)
ax.axhline(y=real_mean, color='#10b981', linestyle='--', alpha=0.5, label=f'Target mean={real_mean}')
ax.plot(g_sigmas, color='#ef4444', label='Generator std', linewidth=1.5)
ax.axhline(y=real_std, color='#ef4444', linestyle='--', alpha=0.5, label=f'Target std={real_std}')
ax.set_xlabel('Epoch')
ax.set_ylabel('Parameter value')
ax.set_title('Generator Parameters Converging to True Values')
ax.legend(fontsize=8)
ax.grid(alpha=0.3)

# Plot 3: Distribution comparison (final)
ax = axes[1, 0]
gen_samples = g_mu + g_sigma * np.random.normal(0, 1, 5000)
real_samples = np.random.normal(real_mean, real_std, 5000)
ax.hist(real_samples, bins=50, alpha=0.5, color='#10b981', label='Real data', density=True)
ax.hist(gen_samples, bins=50, alpha=0.5, color='#a78bfa', label='Generated', density=True)
x = np.linspace(-1, 6, 200)
ax.plot(x, 1/(real_std*np.sqrt(2*np.pi))*np.exp(-0.5*((x-real_mean)/real_std)**2),
        color='#10b981', linewidth=2, linestyle='--', label='True PDF')
ax.set_xlabel('Value')
ax.set_ylabel('Density')
ax.set_title('Final Distribution Comparison')
ax.legend(fontsize=8)
ax.grid(alpha=0.3)

# Plot 4: D output over input space
ax = axes[1, 1]
x = np.linspace(-2, 7, 200)
d_output = sigmoid(d_w * x + d_b)
ax.plot(x, d_output, color='#6366f1', linewidth=2, label='D(x)')
ax.axhline(y=0.5, color='gray', linestyle='--', alpha=0.5, label='D=0.5 (equilibrium)')
ax.axvline(x=real_mean, color='#10b981', linestyle=':', alpha=0.5, label=f'Real mean={real_mean}')
ax.axvline(x=g_mu, color='#a78bfa', linestyle=':', alpha=0.5, label=f'Gen mean={g_mu:.2f}')
ax.set_xlabel('Input x')
ax.set_ylabel('D(x)')
ax.set_title('Discriminator Output (Should Be ~0.5 at Convergence)')
ax.legend(fontsize=8)
ax.grid(alpha=0.3)
ax.set_ylim(-0.05, 1.05)

plt.tight_layout()
plt.savefig('/tmp/gan_training.png', dpi=100, bbox_inches='tight')
plt.show()
print("Training complete! See how D and G losses stabilize,")
print("generator parameters converge to true values,")
print("and the discriminator approaches 0.5 at the data region.")
`

/* ================================================================== */
/*  Default export                                                     */
/* ================================================================== */
export default function GANs() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Generative Adversarial Networks</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          Generative Adversarial Networks pit two neural networks against each other in a
          minimax game: a generator that creates synthetic data and a discriminator that tries
          to tell real from fake. This adversarial training produces generators capable of
          astonishing feats -- from photorealistic face synthesis to style transfer and
          super-resolution. In this lesson, we explore the GAN framework, visualize training
          dynamics and mode collapse, unpack the mathematics of the minimax objective, and
          understand why Wasserstein GANs improved stability.
        </p>
      </header>

      <GANIdeaSection />
      <TrainingDynamicsSection />
      <ModeCollapseSection />
      <GANLossSection />
      <WassersteinSection />
      <ApplicationsSection />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: A Simple 1D GAN</h2>
        <p className="text-gray-300 leading-relaxed">
          Let's implement a GAN from scratch in pure NumPy. The generator is a simple linear
          transformation G(z) = &mu; + &sigma; * z that learns to match a Gaussian distribution.
          The discriminator is a logistic regression model. Watch how the generator's parameters
          converge toward the true mean and standard deviation.
        </p>
        <PythonCell defaultCode={ganCode} title="1D GAN Implementation" />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: Visualizing GAN Training</h2>
        <p className="text-gray-300 leading-relaxed">
          The plots below show four views of GAN training: (1) discriminator and generator losses
          over time, (2) the generator's learned mean and std converging to the true values,
          (3) a histogram comparing the final generated distribution with real data, and
          (4) the discriminator's output across the input space -- at convergence, it should be
          near 0.5 everywhere, meaning it can no longer distinguish real from fake.
        </p>
        <PythonCell defaultCode={ganPlotCode} title="GAN Training Visualization" />
      </section>
    </div>
  )
}
