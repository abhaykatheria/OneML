import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TRACKS } from '../curriculum/index'
import TopNav from '../components/layout/TopNav'
import type p5 from 'p5'
import P5Sketch from '../core/p5/P5Sketch'

const trackColors: Record<string, string> = {
  foundations: 'from-purple-600 to-purple-800',
  classical: 'from-teal-600 to-teal-800',
  neural: 'from-orange-600 to-orange-800',
  deep: 'from-amber-600 to-amber-800',
  advanced: 'from-blue-600 to-blue-800',
  practical: 'from-gray-600 to-gray-800',
}

/* ── Live VAE visualization for hero ── */
function HeroVizPreview() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const sigma = 0.5

    const encodedPoints = [
      { mx: -1.5, my: 1.0, label: '3' },
      { mx: 1.2, my: 1.5, label: '7' },
      { mx: -0.5, my: -1.2, label: '0' },
      { mx: 1.5, my: -0.8, label: '9' },
      { mx: 0.0, my: 0.3, label: '1' },
    ]

    const clusterColors: [number, number, number][] = [
      [100, 220, 100],
      [220, 100, 100],
      [60, 160, 220],
      [220, 180, 60],
      [180, 100, 220],
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 480
      p.createCanvas(pw, 340)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      p.background(15, 15, 25)

      const centerX = p.width / 2
      const centerY = p.height / 2
      const scale = 70

      // Axes
      p.stroke(50)
      p.strokeWeight(1)
      p.line(50, centerY, p.width - 50, centerY)
      p.line(centerX, 30, centerX, p.height - 30)

      // Draw each distribution
      for (let i = 0; i < encodedPoints.length; i++) {
        const ep = encodedPoints[i]
        const cc = clusterColors[i]
        const px = centerX + ep.mx * scale
        const py = centerY - ep.my * scale

        // Distribution rings
        const rings = 8
        for (let r = rings; r >= 0; r--) {
          const radius = sigma * scale * (r / rings) * 2.5
          const alpha = 15 + (rings - r) * 12
          p.fill(cc[0], cc[1], cc[2], alpha)
          p.noStroke()
          p.ellipse(px, py, radius * 2, radius * 2)
        }

        // Sampled point
        const sampleX = px + Math.cos(t * 1.5 + i * 2) * sigma * scale * 0.8
        const sampleY = py + Math.sin(t * 2.1 + i * 3) * sigma * scale * 0.8
        p.fill(255)
        p.stroke(cc[0], cc[1], cc[2])
        p.strokeWeight(2)
        p.ellipse(sampleX, sampleY, 7, 7)

        // Label
        p.fill(cc[0], cc[1], cc[2])
        p.noStroke()
        p.textSize(11)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`"${ep.label}"`, px, py - sigma * scale * 1.5 - 6)

        // Mu/sigma text
        p.fill(140)
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`\u03BC=(${ep.mx.toFixed(1)},${ep.my.toFixed(1)}) \u03C3=${sigma.toFixed(2)}`, px, py + sigma * scale * 1.5 + 3)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('VAE: Distributions (stochastic)', 16, 8)

      // Footer
      p.fill(120)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Stochastic encoding: each input maps to a distribution. White dots = samples.', 16, p.height - 6)
    }
  }, [])

  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-700/50 bg-gray-900 shadow-2xl shadow-purple-500/5 overflow-hidden">
      <P5Sketch sketch={sketch} height={340} />
    </div>
  )
}

/* ── Live MLP architecture visualization for Section 2 ── */
function MLPPreview() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    const layers = [2, 4, 4, 1]
    const layerColors: [number, number, number][] = [
      [80, 200, 120],   // input — green
      [100, 140, 230],  // hidden — blue
      [100, 140, 230],  // hidden — blue
      [220, 150, 80],   // output — orange
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 500
      p.createCanvas(pw, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      p.background(15, 15, 25)

      const marginX = 80
      const marginY = 70
      const usableW = p.width - marginX * 2
      const usableH = p.height - marginY * 2 - 20

      // Compute node positions
      const positions: { x: number; y: number }[][] = []
      for (let l = 0; l < layers.length; l++) {
        const x = marginX + (l / (layers.length - 1)) * usableW
        const n = layers[l]
        const layerPositions: { x: number; y: number }[] = []
        for (let i = 0; i < n; i++) {
          const y = marginY + 20 + (i + 0.5) * (usableH / n)
          layerPositions.push({ x, y })
        }
        positions.push(layerPositions)
      }

      // Draw edges with animated pulse
      for (let l = 0; l < positions.length - 1; l++) {
        for (const from of positions[l]) {
          for (const to of positions[l + 1]) {
            p.stroke(60, 70, 100, 50)
            p.strokeWeight(1)
            p.line(from.x, from.y, to.x, to.y)

            // Animated pulse
            const pulsePhase = (t * 2 + l * 0.7) % 1
            const px = from.x + (to.x - from.x) * pulsePhase
            const py = from.y + (to.y - from.y) * pulsePhase
            const alpha = Math.sin(pulsePhase * Math.PI) * 80
            p.fill(150, 180, 255, alpha)
            p.noStroke()
            p.ellipse(px, py, 4, 4)
          }
        }
      }

      // Draw nodes
      for (let l = 0; l < positions.length; l++) {
        const [r, g, b] = layerColors[l]
        for (const node of positions[l]) {
          // Glow
          p.noStroke()
          p.fill(r, g, b, 25)
          p.ellipse(node.x, node.y, 38, 38)
          // Node
          p.fill(r, g, b, 200)
          p.ellipse(node.x, node.y, 24, 24)
        }
      }

      // Layer labels
      const labels = ['Input', 'Hidden 1', 'Hidden 2', 'Output']
      p.fill(140)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      for (let l = 0; l < positions.length; l++) {
        const x = positions[l][0].x
        p.text(labels[l], x, p.height - marginY + 10)
        p.text(`(${layers[l]})`, x, p.height - marginY + 24)
      }

      // Title
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`MLP: [${layers.join(', ')}]`, p.width / 2, 12)
      p.fill(120)
      p.textSize(11)
      const totalParams = layers.slice(0, -1).reduce((sum, n, i) => sum + n * layers[i + 1] + layers[i + 1], 0)
      p.text(`Total parameters: ${totalParams}`, p.width / 2, 30)
    }
  }, [])

  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-700/50 bg-gray-900 shadow-lg overflow-hidden">
      <P5Sketch sketch={sketch} height={380} />
    </div>
  )
}

/* ── Code editor mock for Section 3 ── */
function CodeEditorMock() {
  const lines = [
    { code: 'from sklearn import svm, datasets', color: 'text-cyan-400' },
    { code: 'import pyodide', color: 'text-cyan-400' },
    { code: '', color: '' },
    { code: '# Load dataset', color: 'text-gray-500' },
    { code: 'iris = datasets.load_iris()', color: 'text-gray-300' },
    { code: "clf = svm.SVC(gamma='scale', C=1.0)", color: 'text-gray-300' },
    { code: '', color: '' },
    { code: '# Train model in browser', color: 'text-gray-500' },
    { code: 'clf.fit(iris.data, iris.target)', color: 'text-gray-300' },
    { code: '', color: '' },
    { code: 'print(f"Model Accuracy: {clf.score(X, y):.2f}")', color: 'text-amber-400' },
  ]

  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-700/50 bg-gray-900 shadow-xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-gray-700/50 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <div className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-gray-500">main.py</span>
      </div>
      {/* Code lines */}
      <div className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 w-5 select-none text-right text-gray-600">{i + 1}</span>
            <span className={line.color}>{line.code}</span>
          </div>
        ))}
      </div>
      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-gray-700/50 px-4 py-2">
        <span className="text-xs text-gray-500">&#9889; Powered by Pyodide</span>
        <button className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500">
          RUN CODE
        </button>
      </div>
    </div>
  )
}

/* ── Feature card component ── */
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700/50 text-cyan-400">
        {icon}
      </div>
      <h4 className="mb-1 font-semibold text-white">{title}</h4>
      <p className="text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  )
}

/* ── Main page ── */
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav />

      {/* ─── Section 1: Hero ─── */}
      <section className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-12 px-6 pb-20 pt-16 md:flex-row md:pt-24">
        {/* Left */}
        <div className="flex-1 space-y-6">
          <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Open Source ML Education
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Machine Learning,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Democratized.
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-gray-400">
            Learn ML through interactive visualizations and live Python code — all in your browser.
            Open-source, free, and built for everyone.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to={`/learn/foundations/${TRACKS[0].firstLesson}`}
              className="inline-flex items-center rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500"
            >
              Start Learning &rarr;
            </Link>
            <a
              href="https://github.com/oneml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:border-gray-400 hover:text-white"
            >
              <span className="text-sm">&lt;&gt;</span> View on GitHub
            </a>
          </div>
        </div>
        {/* Right */}
        <div className="flex flex-1 justify-center">
          <HeroVizPreview />
        </div>
      </section>

      {/* ─── Section 2: See the Math in Motion ─── */}
      <section className="border-y border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-gray-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 lg:flex-row">
          {/* Left: Live MLP architecture */}
          <div className="flex flex-1 justify-center">
            <MLPPreview />
          </div>
          {/* Right */}
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-bold md:text-4xl">See the Math in Motion</h2>
            <p className="max-w-lg text-gray-400">
              Static diagrams are a thing of the past. Interact with complex algorithms in real-time.
            </p>
            <div className="space-y-4">
              <FeatureCard
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                }
                title="Interactive Visualizations"
                description="Drag data points, adjust hyperparameters with sliders, and watch models learn in real-time."
              />
              <FeatureCard
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                }
                title="43 Comprehensive Lessons"
                description="From linear algebra to transformers and LLMs — each topic gets the depth it deserves."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Python in Your Browser ─── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">No Setup Required</p>
          <h2 className="text-3xl font-bold md:text-4xl">Python in Your Browser</h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Forget complex environments and Jupyter notebooks. One ML runs actual Scikit-Learn, NumPy, and Pandas
            directly in your browser using WebAssembly.
          </p>
        </div>
        <div className="flex flex-col items-center gap-12 lg:flex-row">
          {/* Left: code editor */}
          <div className="flex flex-1 justify-center">
            <CodeEditorMock />
          </div>
          {/* Right: checkmarks */}
          <div className="flex-1 space-y-5">
            {[
              'Zero installation or dependencies',
              'Works on any device, even mobile',
              'Privacy-first: code never leaves your computer',
            ].map((text) => (
              <div key={text} className="flex items-start gap-3">
                <svg className="mt-1 h-5 w-5 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-lg text-gray-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 4: Born from Innovation ─── */}
      <section className="border-y border-gray-800/50 bg-gradient-to-b from-gray-900/30 to-gray-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 lg:flex-row">
          {/* Left: team photo */}
          <div className="flex flex-1 justify-center">
            <img
              src="/team.jpg"
              alt="One ML team"
              className="h-72 w-full max-w-md rounded-xl object-cover shadow-lg grayscale"
            />
          </div>
          {/* Right */}
          <div className="flex-1 space-y-5">
            <h2 className="text-3xl font-bold md:text-4xl">Born from Innovation</h2>
            <p className="leading-relaxed text-gray-400">
              One ML began its journey in <strong className="text-gray-200">2020-2021</strong> as a flagship project at
              the <strong className="text-gray-200">Cisco thingQbator</strong>. What started as an experiment in
              simplifying data science grew into a platform mentored by India's top VCs and industry veterans.
            </p>
            <p className="leading-relaxed text-gray-400">
              Our legacy is built on the belief that high-level technical education shouldn't be gated. After years of
              refinement, we have fully transitioned to an <strong className="text-gray-200">open-source model</strong>.
            </p>
            <p className="leading-relaxed text-gray-400">
              Today, One ML is community-driven, maintained by passionate contributors from around the globe who believe
              in democratizing intelligence.
            </p>
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Proudly supported by <span className="ml-1 italic text-gray-500">Cisco thingQbator</span>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section 5: Join the Mission (CTA) ─── */}
      <section className="bg-blue-600">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Join the Mission</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100/80">
            We are building the future of ML education, one line of code at a time. Whether you're a student,
            researcher, or developer, there's a place for you in our community.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/oneml"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-800 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Star on GitHub
            </a>
          </div>
          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-6">
            {[
              { value: '5k+', label: 'Learners' },
              { value: '40+', label: 'Modules' },
              { value: '100%', label: 'Free' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-extrabold text-white">{stat.value}</p>
                <p className="mt-1 text-sm uppercase tracking-wider text-blue-200/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 6: Track Cards ─── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-10 text-center text-3xl font-bold md:text-4xl">Choose Your Learning Path</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((track) => (
            <Link
              key={track.id}
              to={`/learn/${track.id}/${track.firstLesson}`}
              className={`group rounded-xl bg-gradient-to-br ${trackColors[track.id] ?? 'from-gray-600 to-gray-800'} p-6 transition hover:scale-[1.02] hover:shadow-xl`}
            >
              <h3 className="mb-2 text-xl font-bold">{track.name}</h3>
              <p className="text-sm text-white/80">{track.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-white/60 transition group-hover:text-white">
                Explore &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Section 7: Footer ─── */}
      <footer className="border-t border-gray-800/50 bg-gray-950">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-lg font-bold text-purple-500">oneML</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            &copy; 2024 One ML &mdash; Open Source ML Education. Proudly supported by Cisco thingQbator.
          </p>
        </div>
      </footer>
    </div>
  )
}
