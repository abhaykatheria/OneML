import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'advanced/vaes',
  title: 'Variational Autoencoders',
  description: 'Learn how VAEs encode inputs as distributions, organize a smooth latent space, and generate new data through the reparameterization trick and ELBO loss',
  track: 'advanced',
  order: 4,
  tags: ['vae', 'autoencoder', 'latent-space', 'generative-model', 'elbo', 'kl-divergence'],
}

/* ================================================================== */
/*  Section 1 -- Autoencoders: Compress Then Reconstruct               */
/* ================================================================== */
function AutoencoderSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      p.background(15, 15, 25)

      const cx = p.width / 2
      const layerGap = p.width / 7

      // Define layer sizes (encoder -> bottleneck -> decoder)
      const layerSizes = [6, 4, 2, 4, 6]
      const layerLabels = ['Input', 'Enc L1', 'Latent', 'Dec L1', 'Output']
      const layerColors: [number, number, number][] = [
        [80, 160, 220],
        [60, 130, 200],
        [220, 160, 60],
        [60, 130, 200],
        [80, 160, 220],
      ]

      // Compute x positions centered
      const totalWidth = (layerSizes.length - 1) * layerGap
      const startX = cx - totalWidth / 2

      // Store node positions for connection drawing
      const nodePositions: { x: number; y: number }[][] = []

      // Draw layers and nodes
      for (let l = 0; l < layerSizes.length; l++) {
        const lx = startX + l * layerGap
        const n = layerSizes[l]
        const spacing = 40
        const startY = p.height / 2 - ((n - 1) * spacing) / 2
        const positions: { x: number; y: number }[] = []

        for (let i = 0; i < n; i++) {
          const ny = startY + i * spacing
          positions.push({ x: lx, y: ny })

          // Animate: pulse the bottleneck layer
          const isBottleneck = l === 2
          const pulse = isBottleneck ? 1 + Math.sin(t * 3) * 0.15 : 1
          const radius = 12 * pulse

          // Color based on data "flowing" through
          const flowPhase = (t * 2 - l * 0.5 + i * 0.2) % (Math.PI * 2)
          const brightness = 0.6 + 0.4 * Math.max(0, Math.sin(flowPhase))

          const c = layerColors[l]
          p.fill(c[0] * brightness, c[1] * brightness, c[2] * brightness)
          p.stroke(c[0], c[1], c[2], 150)
          p.strokeWeight(1.5)
          p.ellipse(lx, ny, radius * 2, radius * 2)
        }
        nodePositions.push(positions)
      }

      // Draw connections between adjacent layers
      for (let l = 0; l < layerSizes.length - 1; l++) {
        const from = nodePositions[l]
        const to = nodePositions[l + 1]
        for (let i = 0; i < from.length; i++) {
          for (let j = 0; j < to.length; j++) {
            const flowPhase = (t * 2 - l * 0.5) % (Math.PI * 2)
            const alpha = 20 + 30 * Math.max(0, Math.sin(flowPhase))
            p.stroke(150, 150, 200, alpha)
            p.strokeWeight(0.8)
            p.line(from[i].x + 12, from[i].y, to[j].x - 12, to[j].y)
          }
        }
      }

      // Labels
      for (let l = 0; l < layerSizes.length; l++) {
        const lx = startX + l * layerGap
        p.fill(160)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text(layerLabels[l], lx, p.height / 2 + layerSizes[l] * 20 + 18)
      }

      // Bracket labels for encoder / decoder
      p.fill(100, 200, 150)
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Encoder', startX + layerGap * 0.5, 30)
      p.text('Decoder', startX + layerGap * 3.5, 30)

      // Arrow showing compression
      p.fill(220, 160, 60)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Bottleneck (z)', startX + layerGap * 2, p.height - 30)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Autoencoder: Input -> Compressed Latent -> Reconstruction', 20, 10)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Autoencoders: Compress Then Reconstruct</h2>
      <p className="text-gray-300 leading-relaxed">
        An autoencoder is a neural network trained to copy its input to its output -- but with a
        catch. In the middle, the network narrows to a <strong className="text-white">bottleneck
        </strong> layer with far fewer neurons than the input. The network is forced to learn a
        compressed representation that captures the most important features of the data.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The first half of the network is the <strong className="text-white">encoder</strong>,
        which compresses the input into the bottleneck (also called the <strong className="text-white">
        latent space</strong> or <strong className="text-white">latent code</strong>). The second
        half is the <strong className="text-white">decoder</strong>, which reconstructs the
        original input from the compressed representation. If the reconstruction is good, the
        bottleneck must have captured the essential structure of the data. Watch the animation
        below: data flows through the encoder, squeezes into the narrow bottleneck, then expands
        back through the decoder.
      </p>
      <P5Sketch sketch={sketch} height={360} />
      <p className="text-gray-300 leading-relaxed">
        Regular autoencoders have a problem: the latent space can be chaotic. Two nearby points in
        latent space might decode to wildly different outputs, and many regions of latent space
        might not correspond to any valid data at all. This makes them poor generators. Variational
        autoencoders fix this.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- The Latent Space                                      */
/* ================================================================== */
function LatentSpaceSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const points: { x: number; y: number; cluster: number; vx: number; vy: number }[] = []
    let initialized = false

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 400)
      p.textFont('monospace')

      // Generate clustered points
      const clusterCenters = [
        { x: -1.5, y: 1.0 },
        { x: 1.2, y: 1.5 },
        { x: -0.5, y: -1.2 },
        { x: 1.5, y: -0.8 },
        { x: 0.0, y: 0.3 },
      ]
      const clusterLabels = ['Digit 0', 'Digit 1', 'Digit 3', 'Digit 7', 'Digit 9']

      for (let c = 0; c < clusterCenters.length; c++) {
        for (let i = 0; i < 20; i++) {
          points.push({
            x: clusterCenters[c].x + (Math.random() - 0.5) * 1.8,
            y: clusterCenters[c].y + (Math.random() - 0.5) * 1.8,
            cluster: c,
            vx: (clusterCenters[c].x - (clusterCenters[c].x + (Math.random() - 0.5) * 1.8)) * 0.002,
            vy: (clusterCenters[c].y - (clusterCenters[c].y + (Math.random() - 0.5) * 1.8)) * 0.002,
          })
        }
      }

      // Set velocity toward cluster centers
      for (const pt of points) {
        const center = clusterCenters[pt.cluster]
        pt.vx = (center.x - pt.x) * 0.003
        pt.vy = (center.y - pt.y) * 0.003
      }

      initialized = true
      void clusterLabels // used in draw
    }

    p.draw = () => {
      if (!initialized) return
      t += 0.01
      p.background(15, 15, 25)

      const margin = 60
      const plotW = p.width - margin * 2
      const plotH = p.height - margin * 2
      const centerX = p.width / 2
      const centerY = p.height / 2

      const scale = Math.min(plotW, plotH) / 5

      // Move points toward cluster centers (training animation)
      const clusterCenters = [
        { x: -1.5, y: 1.0 },
        { x: 1.2, y: 1.5 },
        { x: -0.5, y: -1.2 },
        { x: 1.5, y: -0.8 },
        { x: 0.0, y: 0.3 },
      ]
      const clusterLabelsArr = ['0', '1', '3', '7', '9']

      for (const pt of points) {
        const center = clusterCenters[pt.cluster]
        const dx = center.x - pt.x
        const dy = center.y - pt.y
        pt.x += dx * 0.003 + Math.sin(t * 2 + pt.x) * 0.002
        pt.y += dy * 0.003 + Math.cos(t * 2 + pt.y) * 0.002
      }

      // Draw axes
      p.stroke(60)
      p.strokeWeight(1)
      p.line(margin, centerY, p.width - margin, centerY)
      p.line(centerX, margin, centerX, p.height - margin)
      p.fill(100)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('z1', p.width - margin + 10, centerY + 4)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('z2', centerX + 4, margin - 10)

      // Draw cluster ellipses (background)
      const clusterColors: [number, number, number][] = [
        [60, 160, 220],
        [220, 100, 100],
        [100, 220, 100],
        [220, 180, 60],
        [180, 100, 220],
      ]

      for (let c = 0; c < clusterCenters.length; c++) {
        // Compute cluster extent
        const cPts = points.filter(pt => pt.cluster === c)
        let sumX = 0, sumY = 0
        for (const pt of cPts) { sumX += pt.x; sumY += pt.y }
        const mx = sumX / cPts.length
        const my = sumY / cPts.length
        let varX = 0, varY = 0
        for (const pt of cPts) { varX += (pt.x - mx) ** 2; varY += (pt.y - my) ** 2 }
        varX = Math.sqrt(varX / cPts.length) * scale * 2
        varY = Math.sqrt(varY / cPts.length) * scale * 2

        const cc = clusterColors[c]
        p.fill(cc[0], cc[1], cc[2], 20)
        p.stroke(cc[0], cc[1], cc[2], 50)
        p.strokeWeight(1)
        p.ellipse(centerX + mx * scale, centerY - my * scale, varX * 2, varY * 2)

        // Cluster label
        p.fill(cc[0], cc[1], cc[2])
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Digit ${clusterLabelsArr[c]}`, centerX + mx * scale, centerY - my * scale - varY - 10)
      }

      // Draw points
      for (const pt of points) {
        const sx = centerX + pt.x * scale
        const sy = centerY - pt.y * scale
        const cc = clusterColors[pt.cluster]
        p.fill(cc[0], cc[1], cc[2], 200)
        p.noStroke()
        p.ellipse(sx, sy, 8, 8)
      }

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('2D Latent Space: Points Cluster by Class Over Training', 20, 10)

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Each dot = one encoded input. Similar inputs cluster together.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Latent Space</h2>
      <p className="text-gray-300 leading-relaxed">
        The bottleneck layer of an autoencoder defines a <strong className="text-white">latent space
        </strong> -- a low-dimensional space where each point represents a compressed version of some
        input. If the autoencoder is trained on handwritten digits, for example, each digit image gets
        mapped to a single point in this space. The decoder can then take any point and reconstruct an
        image from it.
      </p>
      <p className="text-gray-300 leading-relaxed">
        As training progresses, the encoder learns to place similar inputs close together. All the
        "3"s cluster in one region, all the "7"s in another. This organization happens automatically
        because the decoder needs to be able to reconstruct accurately -- it is easier to decode a
        region if all the points there represent similar inputs. Watch below as training progresses
        and clusters form.
      </p>
      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- The "Variational" Part                                */
/* ================================================================== */
function VariationalSection() {
  const [spread, setSpread] = useState(0.5)
  const spreadRef = useRef(spread)
  spreadRef.current = spread

  const sketch = useCallback((p: p5) => {
    let t = 0

    // Fixed points with means
    const encodedPoints = [
      { mx: -1.5, my: 1.0, label: '3' },
      { mx: 1.2, my: 1.5, label: '7' },
      { mx: -0.5, my: -1.2, label: '0' },
      { mx: 1.5, my: -0.8, label: '9' },
      { mx: 0.0, my: 0.3, label: '1' },
    ]

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      const sigma = spreadRef.current
      p.background(15, 15, 25)

      const centerX = p.width / 2
      const centerY = p.height / 2
      const scale = 80

      const clusterColors: [number, number, number][] = [
        [100, 220, 100],
        [220, 100, 100],
        [60, 160, 220],
        [220, 180, 60],
        [180, 100, 220],
      ]

      // Draw axes
      p.stroke(50)
      p.strokeWeight(1)
      p.line(60, centerY, p.width - 60, centerY)
      p.line(centerX, 40, centerX, p.height - 40)

      // For each encoded point, draw the distribution
      for (let i = 0; i < encodedPoints.length; i++) {
        const ep = encodedPoints[i]
        const cc = clusterColors[i]
        const px = centerX + ep.mx * scale
        const py = centerY - ep.my * scale

        if (sigma < 0.15) {
          // Nearly deterministic: just a point
          p.fill(cc[0], cc[1], cc[2])
          p.noStroke()
          p.ellipse(px, py, 14, 14)
        } else {
          // Draw distribution as blurry circle
          const rings = 8
          for (let r = rings; r >= 0; r--) {
            const radius = sigma * scale * (r / rings) * 2.5
            const alpha = 15 + (rings - r) * 12
            p.fill(cc[0], cc[1], cc[2], alpha)
            p.noStroke()
            p.ellipse(px, py, radius * 2, radius * 2)
          }

          // Draw a sampled point (moves around the distribution)
          const sampleX = px + Math.cos(t * 1.5 + i * 2) * sigma * scale * 0.8
          const sampleY = py + Math.sin(t * 2.1 + i * 3) * sigma * scale * 0.8
          p.fill(255)
          p.stroke(cc[0], cc[1], cc[2])
          p.strokeWeight(2)
          p.ellipse(sampleX, sampleY, 8, 8)
        }

        // Label
        p.fill(cc[0], cc[1], cc[2])
        p.noStroke()
        p.textSize(12)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`"${ep.label}"`, px, py - sigma * scale * 1.5 - 8)

        // Show mu and sigma text
        p.fill(160)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`\u03BC=(${ep.mx.toFixed(1)},${ep.my.toFixed(1)}) \u03C3=${sigma.toFixed(2)}`, px, py + sigma * scale * 1.5 + 4)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(sigma < 0.15 ? 'Regular AE: Points (deterministic)' : 'VAE: Distributions (stochastic)', 20, 10)

      // Explanation
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(
        sigma < 0.15
          ? 'Deterministic encoding: each input maps to exactly one point.'
          : 'Stochastic encoding: each input maps to a distribution. White dots = samples.',
        20, p.height - 8
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The "Variational" Part</h2>
      <p className="text-gray-300 leading-relaxed">
        A regular autoencoder encodes each input to a single point in latent space. A <strong
        className="text-white">Variational Autoencoder (VAE)</strong> makes a crucial change:
        instead of encoding to a point, it encodes to a <strong className="text-white">probability
        distribution</strong> -- specifically a Gaussian with a learned mean (<em>mu</em>) and
        standard deviation (<em>sigma</em>). The latent code is then <em>sampled</em> from this
        distribution.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Why distributions instead of points? Because it forces the latent space to be
        <strong className="text-white"> smooth and continuous</strong>. If every "3" maps to a
        slightly different region of a cloud rather than a single point, the decoder must learn to
        handle all points in that region. This fills in gaps in the latent space and makes
        interpolation between classes meaningful. Use the slider below to see the transition from
        deterministic points (regular AE) to stochastic distributions (VAE).
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Distribution Spread">
            <InteractiveSlider
              label="Sigma (\u03C3)"
              min={0.05}
              max={1.0}
              step={0.05}
              value={spread}
              onChange={(v) => { setSpread(v); spreadRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- The ELBO Loss                                         */
/* ================================================================== */
function ELBOSection() {
  const [klWeight, setKlWeight] = useState(0.5)
  const klWeightRef = useRef(klWeight)
  klWeightRef.current = klWeight

  const sketch = useCallback((p: p5) => {
    let t = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 650), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      const beta = klWeightRef.current
      p.background(15, 15, 25)

      const cx = p.width / 2
      const halfW = p.width * 0.35

      // Left side: reconstruction loss visualization
      const lx = cx - halfW / 2 - 20
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Reconstruction Loss', lx, 20)

      // Draw "input" vs "reconstruction" as bar patterns
      const barY = 60
      const barH = 120
      const barCount = 8

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Original', lx - 50, barY - 4)
      p.text('Reconstructed', lx + 50, barY - 4)

      for (let i = 0; i < barCount; i++) {
        const origVal = Math.sin(i * 0.8 + 1) * 0.5 + 0.5
        // Reconstruction quality depends on how much we focus on it (low beta = better reconstruction)
        const noise = (1 - beta) * 0.02 + beta * 0.15
        const reconVal = origVal + Math.sin(t + i) * noise
        const by = barY + (i * barH) / barCount
        const bh = barH / barCount - 2

        // Original
        p.fill(60, 160, 220)
        p.noStroke()
        p.rect(lx - 80, by, origVal * 50, bh)

        // Reconstructed
        p.fill(60, 220, 160)
        p.rect(lx + 20, by, Math.max(0, reconVal) * 50, bh)
      }

      const reconLoss = beta * 0.6 + 0.1
      p.fill(220, 100, 100)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`L_recon = ${reconLoss.toFixed(2)}`, lx, barY + barH + 20)

      // Right side: KL divergence visualization
      const rx = cx + halfW / 2 + 20
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('KL Divergence', rx, 20)

      // Draw learned distribution vs prior
      const distY = barY + barH / 2
      const distW = halfW * 0.8

      // Prior: standard normal
      p.stroke(180, 100, 220)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let x = -3; x <= 3; x += 0.1) {
        const gx = rx + (x / 3) * (distW / 2)
        const gy = distY - Math.exp(-x * x / 2) * 60
        p.vertex(gx, gy)
      }
      p.endShape()

      // Learned distribution: shifted/scaled based on beta
      const learnedMu = (1 - beta) * 1.5
      const learnedSigma = (1 - beta) * 0.5 + beta * 1.0
      p.stroke(60, 220, 160)
      p.strokeWeight(2)
      p.noFill()
      p.beginShape()
      for (let x = -3; x <= 3; x += 0.1) {
        const gx = rx + (x / 3) * (distW / 2)
        const z = (x - learnedMu) / learnedSigma
        const gy = distY - Math.exp(-z * z / 2) / learnedSigma * 60
        p.vertex(gx, gy)
      }
      p.endShape()

      // Legend
      p.fill(180, 100, 220)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('-- Prior N(0,1)', rx - distW / 2, distY + 40)
      p.fill(60, 220, 160)
      p.text(`-- Learned N(${learnedMu.toFixed(1)}, ${learnedSigma.toFixed(1)})`, rx - distW / 2, distY + 55)

      const klLoss = (1 - beta) * 1.5 + 0.05
      p.fill(220, 100, 100)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`L_KL = ${klLoss.toFixed(2)}`, rx, barY + barH + 20)

      // Total loss at bottom
      const total = reconLoss + beta * klLoss
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`ELBO Loss = L_recon + \u03B2 \u00B7 L_KL = ${reconLoss.toFixed(2)} + ${beta.toFixed(2)} \u00D7 ${klLoss.toFixed(2)} = ${total.toFixed(2)}`, cx, p.height - 70)

      // Explanation
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(
        beta < 0.3
          ? 'Low \u03B2: good reconstruction but messy latent space (distributions drift from prior)'
          : beta > 0.7
            ? 'High \u03B2: smooth latent space but blurry reconstruction'
            : 'Balanced \u03B2: decent reconstruction with organized latent space',
        cx, p.height - 8
      )
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The ELBO Loss</h2>
      <p className="text-gray-300 leading-relaxed">
        The VAE loss (called the <strong className="text-white">Evidence Lower Bound</strong> or ELBO)
        has two terms that pull in opposite directions:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Reconstruction loss</strong> -- how well the decoder
          reconstructs the original input from the sampled latent code. This pushes the encoder to be
          as informative as possible (encode everything about the input).
        </li>
        <li>
          <strong className="text-white">KL divergence</strong> -- how far the encoder's distributions
          deviate from a standard normal N(0,1) prior. This pushes all distributions toward the same
          shape, forcing the latent space to be smooth and organized.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The tension between these two terms is key. Without the KL term, you get a regular autoencoder
        with a chaotic latent space. Without the reconstruction term, every input maps to the same
        meaningless distribution. The balance produces a latent space that is both informative and smooth.
        The weight <em>beta</em> on the KL term can be tuned -- this is called a <strong className="text-white">beta-VAE</strong>.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Loss Balance">
            <InteractiveSlider
              label="KL Weight (\u03B2)"
              min={0.0}
              max={1.0}
              step={0.05}
              value={klWeight}
              onChange={(v) => { setKlWeight(v); klWeightRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Latent Space Interpolation                            */
/* ================================================================== */
function InterpolationSection() {
  const [interpT, setInterpT] = useState(0.0)
  const interpRef = useRef(interpT)
  interpRef.current = interpT

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 650), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const alpha = interpRef.current
      p.background(15, 15, 25)

      const cx = p.width / 2
      const latentCenterY = 160
      const outputY = 320
      const scale = 80

      // Two points in latent space
      const p1 = { x: -1.8, y: 0.5 }
      const p2 = { x: 1.5, y: -0.8 }
      const interp = { x: p1.x + (p2.x - p1.x) * alpha, y: p1.y + (p2.y - p1.y) * alpha }

      // Draw latent space grid
      p.stroke(35)
      p.strokeWeight(0.5)
      for (let gx = -3; gx <= 3; gx++) {
        p.line(cx + gx * scale, latentCenterY - 2.5 * scale, cx + gx * scale, latentCenterY + 2.5 * scale)
      }
      for (let gy = -2; gy <= 2; gy++) {
        p.line(cx - 3 * scale, latentCenterY + gy * scale, cx + 3 * scale, latentCenterY + gy * scale)
      }

      // Draw interpolation path
      p.stroke(100, 100, 200)
      p.strokeWeight(2)
      const sx1 = cx + p1.x * scale
      const sy1 = latentCenterY - p1.y * scale
      const sx2 = cx + p2.x * scale
      const sy2 = latentCenterY - p2.y * scale
      p.line(sx1, sy1, sx2, sy2)

      // Draw dots along path
      for (let i = 0; i <= 10; i++) {
        const dt = i / 10
        const dx = cx + (p1.x + (p2.x - p1.x) * dt) * scale
        const dy = latentCenterY - (p1.y + (p2.y - p1.y) * dt) * scale
        p.fill(80, 80, 160, 100)
        p.noStroke()
        p.ellipse(dx, dy, 6, 6)
      }

      // Point A
      p.fill(60, 200, 120)
      p.stroke(60, 200, 120)
      p.strokeWeight(2)
      p.ellipse(sx1, sy1, 18, 18)
      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('"3"', sx1, sy1 - 14)

      // Point B
      p.fill(200, 80, 120)
      p.stroke(200, 80, 120)
      p.strokeWeight(2)
      p.ellipse(sx2, sy2, 18, 18)
      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('"7"', sx2, sy2 - 14)

      // Current interpolated point
      const interpSx = cx + interp.x * scale
      const interpSy = latentCenterY - interp.y * scale
      p.fill(255, 220, 60)
      p.stroke(255, 220, 60)
      p.strokeWeight(2)
      p.ellipse(interpSx, interpSy, 14, 14)

      // Draw the decoded "shape" at bottom
      // Morph between a "3"-like and "7"-like shape using the interpolation parameter
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Decoded Output', cx, outputY - 50)

      // Draw morphing shape: 3 -> something -> 7
      const shapeX = cx
      const shapeY = outputY + 10
      const shapeSize = 60

      // Color interpolation
      const r = 60 + (200 - 60) * alpha
      const g = 200 + (80 - 200) * alpha
      const b = 120

      p.stroke(r, g, b)
      p.strokeWeight(3)
      p.noFill()

      // Morph between "3" shape and "7" shape using bezier curves
      // "3" has two bumps on the right; "7" is a horizontal line + diagonal
      const a = alpha

      // Top part: "3" curves -> "7" horizontal bar
      p.beginShape()
      const topLeftX = shapeX - shapeSize * 0.4
      const topRightX = shapeX + shapeSize * 0.5
      const topY = shapeY - shapeSize * 0.5

      // Starting point interpolates from mid-left (3) to left (7)
      const startX = topLeftX - shapeSize * 0.1 * (1 - a)
      p.vertex(startX, topY)

      // Control points morph between curve (3) and straight line (7)
      const cp1x = topLeftX + shapeSize * 0.5
      const cp1y = topY - shapeSize * 0.3 * (1 - a)
      const cp2x = topRightX
      const cp2y = topY + shapeSize * 0.1 * (1 - a)
      p.bezierVertex(cp1x, cp1y)
      p.bezierVertex(cp2x, cp2y)
      p.bezierVertex(topRightX, topY + shapeSize * 0.1 * (1 - a))
      p.endShape()

      // Middle/bottom part
      p.beginShape()
      // For "3": curve back and around. For "7": diagonal line down
      const midY = shapeY
      const botY = shapeY + shapeSize * 0.5

      p.vertex(
        topRightX * (1 - a) + (topRightX) * a,
        (topY + shapeSize * 0.1 * (1 - a)) * (1 - a) + topY * a
      )
      p.bezierVertex(shapeX + shapeSize * 0.3, midY - shapeSize * 0.1 * (1 - a))
      p.bezierVertex(shapeX + shapeSize * 0.4 * (1 - a) + shapeX * a, midY + shapeSize * 0.2)
      p.bezierVertex(shapeX + shapeSize * 0.1 * (1 - a), botY)
      p.endShape()

      // Alpha label
      p.fill(255, 220, 60)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`t = ${alpha.toFixed(2)}`, cx, outputY + shapeSize + 20)

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Latent Space Interpolation', 20, 10)

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Slide t from 0 to 1 to smoothly morph between two encoded inputs.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Latent Space Interpolation</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most striking properties of a well-trained VAE is <strong className="text-white">
        smooth interpolation</strong>. If you take two points in latent space -- say, the encodings
        of a "3" and a "7" -- and walk along a straight line between them, the decoded outputs
        transition smoothly. There are no sudden jumps or gibberish in between, because the KL
        divergence term ensures the latent space is densely packed with valid decodings.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This is qualitatively different from a regular autoencoder, where the space between two
        encoded points might contain "dead zones" that decode to noise. The VAE's smooth latent
        space is what makes it useful as a generative model: you can sample new points and be
        confident they decode to something meaningful.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Interpolation">
            <InteractiveSlider
              label="t (0 = digit 3, 1 = digit 7)"
              min={0.0}
              max={1.0}
              step={0.02}
              value={interpT}
              onChange={(v) => { setInterpT(v); interpRef.current = v }}
            />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Generating New Data                                   */
/* ================================================================== */
function GenerationSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let samplePoints: { x: number; y: number; age: number; hue: number }[] = []

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      p.background(15, 15, 25)

      const cx = p.width / 2
      const cy = p.height / 2 - 20
      const scale = 70

      // Draw the prior distribution as concentric circles
      for (let r = 5; r >= 1; r--) {
        const radius = r * scale * 0.5
        const alpha = 10 + (5 - r) * 6
        p.fill(100, 100, 200, alpha)
        p.noStroke()
        p.ellipse(cx, cy, radius * 2, radius * 2)
      }

      // Draw cluster labels at known positions
      const clusters = [
        { x: -1.3, y: 0.9, label: '0', color: [60, 160, 220] as [number, number, number] },
        { x: 0.8, y: 1.2, label: '1', color: [220, 100, 100] as [number, number, number] },
        { x: -0.8, y: -0.5, label: '3', color: [100, 220, 100] as [number, number, number] },
        { x: 1.2, y: -0.6, label: '7', color: [220, 180, 60] as [number, number, number] },
        { x: 0.0, y: -1.3, label: '9', color: [180, 100, 220] as [number, number, number] },
      ]

      for (const cl of clusters) {
        const sx = cx + cl.x * scale
        const sy = cy - cl.y * scale
        p.fill(cl.color[0], cl.color[1], cl.color[2], 60)
        p.noStroke()
        p.ellipse(sx, sy, 50, 50)
        p.fill(cl.color[0], cl.color[1], cl.color[2])
        p.textSize(14)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(cl.label, sx, sy)
      }

      // Periodically spawn new sample from prior
      if (Math.random() < 0.03) {
        // Sample from 2D standard normal (Box-Muller)
        const u1 = Math.random()
        const u2 = Math.random()
        const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
        samplePoints.push({ x: z1, y: z2, age: 0, hue: Math.random() * 360 })
      }

      // Draw and age sample points
      for (const sp of samplePoints) {
        sp.age += 0.01
        const sx = cx + sp.x * scale
        const sy = cy - sp.y * scale
        const fadeAlpha = Math.max(0, 255 - sp.age * 80)

        // Pulsing glow
        const pulseR = 8 + Math.sin(sp.age * 5) * 2

        p.fill(255, 255, 255, fadeAlpha)
        p.stroke(255, 220, 60, fadeAlpha * 0.7)
        p.strokeWeight(2)
        p.ellipse(sx, sy, pulseR * 2, pulseR * 2)

        // Thin connecting line to nearest cluster center
        let nearestDist = Infinity
        let nearestCluster = clusters[0]
        for (const cl of clusters) {
          const d = Math.sqrt((sp.x - cl.x) ** 2 + (sp.y - cl.y) ** 2)
          if (d < nearestDist) { nearestDist = d; nearestCluster = cl }
        }
        p.stroke(nearestCluster.color[0], nearestCluster.color[1], nearestCluster.color[2], fadeAlpha * 0.3)
        p.strokeWeight(0.5)
        p.line(sx, sy, cx + nearestCluster.x * scale, cy - nearestCluster.y * scale)
      }

      // Remove old points
      samplePoints = samplePoints.filter(sp => sp.age < 3)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Generation: Sample from Prior, Decode', 20, 10)

      // Labels
      p.fill(180, 100, 220)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Prior: N(0, I)', cx, cy + 2.8 * scale)

      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('White dots = new samples from the prior. Decoded output depends on which cluster they land near.', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Generating New Data</h2>
      <p className="text-gray-300 leading-relaxed">
        Here is the payoff: because the KL divergence term pushes the encoder's distributions toward
        a standard normal, the overall latent space is approximately N(0, I). To generate new data,
        we simply <strong className="text-white">sample from this prior</strong> and pass it through
        the decoder. No encoder needed at generation time.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Where the sample lands determines what gets generated. A sample near the "3" cluster decodes
        to a 3-like image. A sample between "3" and "7" produces something in between. Samples far
        from any cluster center (in the tails of the Gaussian) tend to produce unusual or blurry
        outputs, since few training examples encoded there. Watch new samples appear below.
      </p>
      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: VAE Encoder/Decoder + Reparameterization      */
/* ================================================================== */
function PythonVAESection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: VAE with the Reparameterization Trick</h2>
      <p className="text-gray-300 leading-relaxed">
        The encoder outputs <em>mu</em> and <em>log_sigma</em> for each input, and we sample using
        the <strong className="text-white">reparameterization trick</strong>: instead of sampling z
        directly from N(mu, sigma), we sample epsilon from N(0, 1) and compute z = mu + sigma *
        epsilon. This makes the sampling operation differentiable with respect to mu and sigma,
        enabling backpropagation through the stochastic layer.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(42)

# --- Simple VAE with NumPy ---
# Dimensions: input=8, hidden=4, latent=2

d_in, d_hid, d_lat = 8, 4, 2

# Encoder weights
W_enc1 = np.random.randn(d_in, d_hid) * 0.3
b_enc1 = np.zeros(d_hid)
W_mu = np.random.randn(d_hid, d_lat) * 0.3
b_mu = np.zeros(d_lat)
W_logvar = np.random.randn(d_hid, d_lat) * 0.3
b_logvar = np.zeros(d_lat)

# Decoder weights
W_dec1 = np.random.randn(d_lat, d_hid) * 0.3
b_dec1 = np.zeros(d_hid)
W_dec2 = np.random.randn(d_hid, d_in) * 0.3
b_dec2 = np.zeros(d_in)

def relu(x):
    return np.maximum(0, x)

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def encode(x):
    """Encoder: input -> (mu, log_var)"""
    h = relu(x @ W_enc1 + b_enc1)
    mu = h @ W_mu + b_mu
    log_var = h @ W_logvar + b_logvar
    return mu, log_var

def reparameterize(mu, log_var):
    """The reparameterization trick: z = mu + sigma * epsilon"""
    sigma = np.exp(0.5 * log_var)   # convert log-variance to std
    epsilon = np.random.randn(*mu.shape)  # sample from N(0,1)
    z = mu + sigma * epsilon         # shift and scale
    return z, epsilon

def decode(z):
    """Decoder: latent -> reconstruction"""
    h = relu(z @ W_dec1 + b_dec1)
    x_recon = sigmoid(h @ W_dec2 + b_dec2)
    return x_recon

def kl_divergence(mu, log_var):
    """KL(q(z|x) || p(z)) for Gaussian q and standard normal p"""
    # = -0.5 * sum(1 + log_var - mu^2 - exp(log_var))
    return -0.5 * np.sum(1 + log_var - mu**2 - np.exp(log_var))

def recon_loss(x, x_recon):
    """Binary cross-entropy reconstruction loss"""
    eps = 1e-8
    return -np.sum(x * np.log(x_recon + eps) + (1 - x) * np.log(1 - x_recon + eps))

# --- Forward pass with a batch of inputs ---
print("=== VAE Forward Pass ===\\n")

# Create 4 fake input vectors (values in [0,1])
X = sigmoid(np.random.randn(4, d_in))
print(f"Input shape: {X.shape}")
print(f"Input[0]: [{', '.join(f'{v:.2f}' for v in X[0])}]\\n")

# Encode
mu, log_var = encode(X)
print(f"Encoded mu shape: {mu.shape}")
print(f"  mu[0] = ({mu[0,0]:.3f}, {mu[0,1]:.3f})")
print(f"  log_var[0] = ({log_var[0,0]:.3f}, {log_var[0,1]:.3f})")
print(f"  sigma[0] = ({np.exp(0.5*log_var[0,0]):.3f}, {np.exp(0.5*log_var[0,1]):.3f})\\n")

# Reparameterization trick
z, eps = reparameterize(mu, log_var)
print("Reparameterization trick:")
print(f"  epsilon[0] = ({eps[0,0]:.3f}, {eps[0,1]:.3f})")
print(f"  z[0] = mu + sigma * eps = ({z[0,0]:.3f}, {z[0,1]:.3f})\\n")

# Decode
X_recon = decode(z)
print(f"Reconstruction[0]: [{', '.join(f'{v:.2f}' for v in X_recon[0])}]\\n")

# Compute losses
r_loss = recon_loss(X, X_recon) / X.shape[0]
kl_loss = kl_divergence(mu, log_var) / X.shape[0]
total = r_loss + kl_loss
print(f"Reconstruction loss: {r_loss:.3f}")
print(f"KL divergence:       {kl_loss:.3f}")
print(f"Total ELBO loss:     {total:.3f}")

# --- Generation: sample from prior and decode ---
print("\\n=== Generation from Prior ===")
z_new = np.random.randn(3, d_lat)
generated = decode(z_new)
for i in range(3):
    print(f"  z={z_new[i].round(2)} -> [{', '.join(f'{v:.2f}' for v in generated[i])}]")

print("\\nKey insight: reparameterization lets gradients flow through")
print("the sampling step, since d(mu + sigma*eps)/d(mu) = 1")`}
        title="VAE Encoder, Decoder & Reparameterization Trick"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Latent Space Organization                     */
/* ================================================================== */
function PythonLatentSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Latent Space Organization</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us see how the KL divergence shapes the latent space. We will compare encodings with
        and without the KL penalty, and observe how the KL term pushes distributions toward the
        standard normal prior, creating a more organized and generative-friendly space.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(0)

# Simulate encoding 5 "classes" of data into 2D latent space
# Without KL penalty: encoder places them wherever minimizes reconstruction
# With KL penalty: distributions get pulled toward N(0,1)

n_classes = 5
n_per_class = 20
labels = ['Zero', 'One', 'Three', 'Seven', 'Nine']

print("=== Without KL Penalty (Regular Autoencoder) ===\\n")
print("Encoder is free to place points anywhere:")
for c in range(n_classes):
    # Random cluster centers (could be far apart, arbitrary)
    center = np.random.randn(2) * 3
    sigma = 0.1  # Very tight clusters
    points = center + np.random.randn(n_per_class, 2) * sigma
    mean = points.mean(axis=0)
    std = points.std(axis=0)
    print(f"  {labels[c]:6s}: center=({mean[0]:+.2f}, {mean[1]:+.2f}), "
          f"spread=({std[0]:.3f}, {std[1]:.3f})")

print("\\nProblem: gaps between clusters decode to garbage.")
print("Points are deterministic -- no distribution overlap.\\n")

print("=" * 50)
print("\\n=== With KL Penalty (VAE) ===\\n")
print("KL pulls distributions toward N(0,1):")

vae_mus = []
vae_sigmas = []
for c in range(n_classes):
    # KL penalty pulls mu toward 0 and sigma toward 1
    mu = np.random.randn(2) * 0.8  # closer to origin
    sigma = 0.4 + np.random.rand(2) * 0.4  # closer to 1.0
    points = mu + np.random.randn(n_per_class, 2) * sigma
    mean = points.mean(axis=0)
    std = points.std(axis=0)
    print(f"  {labels[c]:6s}: mu=({mu[0]:+.2f}, {mu[1]:+.2f}), "
          f"sigma=({sigma[0]:.2f}, {sigma[1]:.2f})")
    vae_mus.append(mu)
    vae_sigmas.append(sigma)

# Compute KL divergence for each class
print("\\nKL divergence per class (lower = closer to N(0,1)):")
for c in range(n_classes):
    mu = vae_mus[c]
    sig = vae_sigmas[c]
    log_var = 2 * np.log(sig)
    kl = -0.5 * np.sum(1 + log_var - mu**2 - sig**2)
    print(f"  {labels[c]:6s}: KL = {kl:.3f}")

# Show interpolation quality
print("\\n=== Interpolation Test ===")
print("Walk from 'Three' (class 2) to 'Seven' (class 3):\\n")
mu_start = vae_mus[2]
mu_end = vae_mus[3]
for alpha in [0.0, 0.25, 0.5, 0.75, 1.0]:
    z = mu_start * (1 - alpha) + mu_end * alpha
    # Distance to each class center
    dists = [np.linalg.norm(z - vae_mus[c]) for c in range(n_classes)]
    nearest = labels[np.argmin(dists)]
    print(f"  t={alpha:.2f}: z=({z[0]:+.2f}, {z[1]:+.2f}) "
          f"-> nearest class: {nearest} "
          f"(dist={min(dists):.2f})")

print("\\nSmooth interpolation: every point along the path is")
print("close to some class -- no dead zones!")`}
        title="Latent Space: With vs Without KL Divergence"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function VAEs() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Variational Autoencoders</h1>
        <p className="text-lg text-gray-400">
          Learn how VAEs turn autoencoders into powerful generative models by encoding inputs as
          probability distributions, organizing a smooth latent space with the ELBO loss, and
          enabling generation through sampling from a learned prior.
        </p>
      </header>

      <AutoencoderSection />
      <LatentSpaceSection />
      <VariationalSection />
      <ELBOSection />
      <InterpolationSection />
      <GenerationSection />
      <PythonVAESection />
      <PythonLatentSection />
    </div>
  )
}
