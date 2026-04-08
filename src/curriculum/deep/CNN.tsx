import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/cnn',
  title: 'Convolutional Neural Networks',
  description: 'Learn how CNNs exploit spatial structure in images through convolution, pooling, and hierarchical feature extraction',
  track: 'deep',
  order: 1,
  tags: ['cnn', 'convolution', 'pooling', 'feature-maps', 'stride', 'padding', 'deep-learning'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function convolve2D(
  input: number[][],
  kernel: number[][],
  stride: number,
  padding: number
): number[][] {
  const h = input.length
  const w = input[0].length
  const kh = kernel.length
  const kw = kernel[0].length
  const padded: number[][] = []
  const ph = h + 2 * padding
  const pw = w + 2 * padding
  for (let i = 0; i < ph; i++) {
    padded.push([])
    for (let j = 0; j < pw; j++) {
      const oi = i - padding
      const oj = j - padding
      padded[i].push(oi >= 0 && oi < h && oj >= 0 && oj < w ? input[oi][oj] : 0)
    }
  }
  const outH = Math.floor((ph - kh) / stride) + 1
  const outW = Math.floor((pw - kw) / stride) + 1
  const result: number[][] = []
  for (let i = 0; i < outH; i++) {
    result.push([])
    for (let j = 0; j < outW; j++) {
      let sum = 0
      for (let ki = 0; ki < kh; ki++) {
        for (let kj = 0; kj < kw; kj++) {
          sum += padded[i * stride + ki][j * stride + kj] * kernel[ki][kj]
        }
      }
      result[i].push(sum)
    }
  }
  return result
}

function maxPool(input: number[][], size: number): number[][] {
  const h = input.length
  const w = input[0].length
  const outH = Math.floor(h / size)
  const outW = Math.floor(w / size)
  const result: number[][] = []
  for (let i = 0; i < outH; i++) {
    result.push([])
    for (let j = 0; j < outW; j++) {
      let maxVal = -Infinity
      for (let ki = 0; ki < size; ki++) {
        for (let kj = 0; kj < size; kj++) {
          maxVal = Math.max(maxVal, input[i * size + ki][j * size + kj])
        }
      }
      result[i].push(maxVal)
    }
  }
  return result
}

const SAMPLE_IMAGE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 50, 80, 80, 50, 0, 0],
  [0, 50, 200, 255, 255, 200, 50, 0],
  [0, 80, 255, 255, 255, 255, 80, 0],
  [0, 80, 255, 255, 255, 255, 80, 0],
  [0, 50, 200, 255, 255, 200, 50, 0],
  [0, 0, 50, 80, 80, 50, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]

const PRESET_FILTERS: Record<string, number[][]> = {
  'Edge H': [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
  'Edge V': [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
  'Sharpen': [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
  'Blur': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  'Emboss': [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
}

/* ================================================================== */
/*  Section 1 -- Why Not Fully Connected?                              */
/* ================================================================== */
function WhyNotFCSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Not Fully Connected Layers for Images?</h2>
      <p className="text-gray-300 leading-relaxed">
        Imagine a modest 256x256 grayscale image. That is 65,536 pixels. If the first hidden layer
        has just 1,000 neurons, you already need over 65 million weights -- and that is for a single
        layer on a small image. A color image triples the count. The parameter explosion is not just
        computationally wasteful; it invites severe overfitting because the model has far more
        capacity than structure to learn from.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Worse, fully connected layers are oblivious to spatial structure. A pixel at the top-left
        corner is treated identically to one at the bottom-right. If the network learns to detect a
        vertical edge in one location, it must relearn that same pattern for every other location.
        There is no built-in notion that nearby pixels are related, that local patches form textures,
        or that objects can appear anywhere in the frame.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Convolutional Neural Networks solve both problems with two key ideas: <strong className="text-white">
        weight sharing</strong> (the same small filter scans the entire image, so one set of
        weights detects a feature everywhere) and <strong className="text-white">local connectivity
        </strong> (each output neuron only looks at a small patch of the input). This slashes
        parameters by orders of magnitude while baking in translational equivariance -- if a cat
        moves within the frame, the same filters still detect its ears, eyes, and whiskers.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Animated Convolution Operation                        */
/* ================================================================== */
function ConvolutionAnimationSection() {
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const sketch = useCallback((p: p5) => {
    let filterRow = 0
    let filterCol = 0
    let frameCounter = 0
    const grid = SAMPLE_IMAGE
    const kernel = PRESET_FILTERS['Edge H']
    const gridSize = grid.length
    const kSize = kernel.length
    const maxPos = gridSize - kSize

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)
      const cellSize = Math.min(36, (p.width * 0.35) / gridSize)
      const gridStartX = 30
      const gridStartY = 40

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Input Image', gridStartX, 14)

      // Draw input grid
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const val = grid[r][c]
          const x = gridStartX + c * cellSize
          const y = gridStartY + r * cellSize
          p.fill(val)
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(x, y, cellSize, cellSize)
        }
      }

      // Highlight the sliding window
      p.noFill()
      p.stroke(0, 200, 255)
      p.strokeWeight(3)
      p.rect(
        gridStartX + filterCol * cellSize,
        gridStartY + filterRow * cellSize,
        kSize * cellSize,
        kSize * cellSize
      )

      // Draw kernel
      const kernelStartX = gridStartX + gridSize * cellSize + 40
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.text('3x3 Filter', kernelStartX, 14)

      for (let r = 0; r < kSize; r++) {
        for (let c = 0; c < kSize; c++) {
          const x = kernelStartX + c * cellSize
          const y = gridStartY + r * cellSize
          const kv = kernel[r][c]
          p.fill(kv > 0 ? p.color(60, 180, 80) : kv < 0 ? p.color(200, 60, 60) : p.color(60))
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(x, y, cellSize, cellSize)
          p.fill(255)
          p.noStroke()
          p.textSize(11)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(String(kv), x + cellSize / 2, y + cellSize / 2)
        }
      }

      // Compute and draw output
      const output = convolve2D(grid, kernel, 1, 0)
      const outSize = output.length
      const outStartX = kernelStartX + kSize * cellSize + 40
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Feature Map', outStartX, 14)

      let outMax = 1
      for (const row of output) for (const v of row) outMax = Math.max(outMax, Math.abs(v))

      for (let r = 0; r < outSize; r++) {
        for (let c = 0; c < outSize; c++) {
          const val = output[r][c]
          const mapped = p.map(val, -outMax, outMax, 0, 255)
          const x = outStartX + c * cellSize
          const y = gridStartY + r * cellSize
          const isActive = r === filterRow && c === filterCol
          p.fill(mapped)
          p.stroke(isActive ? p.color(0, 200, 255) : p.color(40))
          p.strokeWeight(isActive ? 3 : 1)
          p.rect(x, y, cellSize, cellSize)
        }
      }

      // Computation text
      let dotProduct = 0
      for (let kr = 0; kr < kSize; kr++) {
        for (let kc = 0; kc < kSize; kc++) {
          dotProduct += grid[filterRow + kr][filterCol + kc] * kernel[kr][kc]
        }
      }
      p.fill(200)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      const compY = gridStartY + gridSize * cellSize + 20
      p.text(`Position (${filterRow}, ${filterCol})  =>  sum = ${dotProduct}`, gridStartX, compY)

      // Animate
      frameCounter++
      const framesPerStep = Math.max(1, Math.round(30 / speedRef.current))
      if (frameCounter >= framesPerStep) {
        frameCounter = 0
        filterCol++
        if (filterCol > maxPos) {
          filterCol = 0
          filterRow++
          if (filterRow > maxPos) {
            filterRow = 0
          }
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Convolution Operation</h2>
      <p className="text-gray-300 leading-relaxed">
        A convolution slides a small filter (also called a kernel) across the input, computing a dot
        product at every position. The filter has learned weights -- in the animation below, green
        cells are positive weights and red cells are negative. At each location, the filter
        element-wise multiplies the overlapping input patch and sums the results into a single output
        value. The collection of all these outputs forms a <strong className="text-white">feature map</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Watch the cyan window slide across the 8x8 input image. The same 3x3 filter visits every
        valid position, computing a weighted sum each time. This is why convolutions are so parameter
        efficient: 9 weights produce a full 6x6 output feature map. The horizontal edge filter below
        responds strongly wherever the image transitions from dark to light vertically.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Animation">
            <InteractiveSlider label="Speed" min={0.5} max={5} step={0.5} value={speed} onChange={setSpeed} unit="x" />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Editable Filter                                       */
/* ================================================================== */
function EditableFilterSection() {
  const [filterName, setFilterName] = useState<string>('Edge H')
  const [kernel, setKernel] = useState<number[][]>(PRESET_FILTERS['Edge H'])
  const kernelRef = useRef(kernel)
  kernelRef.current = kernel

  const handleCellChange = (r: number, c: number, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const next = kernel.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? num : v)))
    setKernel(next)
  }

  const output = convolve2D(SAMPLE_IMAGE, kernel, 1, 0)
  let outMax = 1
  for (const row of output) for (const v of row) outMax = Math.max(outMax, Math.abs(v))

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 600), 300)
      p.textFont('monospace')
      p.noLoop()
    }
    p.draw = () => {
      const k = kernelRef.current
      const out = convolve2D(SAMPLE_IMAGE, k, 1, 0)
      let mx = 1
      for (const row of out) for (const v of row) mx = Math.max(mx, Math.abs(v))

      p.background(15, 15, 25)
      const cellSize = Math.min(32, (p.width * 0.4) / SAMPLE_IMAGE.length)
      const startX = 20
      const startY = 40

      // Input
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Input', startX, 12)
      for (let r = 0; r < SAMPLE_IMAGE.length; r++) {
        for (let c = 0; c < SAMPLE_IMAGE[0].length; c++) {
          p.fill(SAMPLE_IMAGE[r][c])
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize)
        }
      }

      // Arrow
      const arrowX = startX + SAMPLE_IMAGE[0].length * cellSize + 20
      const arrowY = startY + (SAMPLE_IMAGE.length * cellSize) / 2
      p.stroke(100)
      p.strokeWeight(2)
      p.line(arrowX, arrowY, arrowX + 30, arrowY)
      p.line(arrowX + 22, arrowY - 6, arrowX + 30, arrowY)
      p.line(arrowX + 22, arrowY + 6, arrowX + 30, arrowY)

      // Output
      const outX = arrowX + 50
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.text('Output', outX, 12)
      for (let r = 0; r < out.length; r++) {
        for (let c = 0; c < out[0].length; c++) {
          const mapped = p.map(out[r][c], -mx, mx, 0, 255)
          p.fill(mapped)
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(outX + c * cellSize, startY + r * cellSize, cellSize, cellSize)
        }
      }
    }
  }, [])

  // Trigger redraw when kernel changes
  const sketchWithRedraw = useCallback((p: p5) => {
    sketch(p)
    const origSetup = p.setup
    p.setup = () => {
      if (origSetup) origSetup()
    }
    p.draw = () => {
      const k = kernelRef.current
      const out = convolve2D(SAMPLE_IMAGE, k, 1, 0)
      let mx = 1
      for (const row of out) for (const v of row) mx = Math.max(mx, Math.abs(v))

      p.background(15, 15, 25)
      const cellSize = Math.min(32, (p.width * 0.4) / SAMPLE_IMAGE.length)
      const startX = 20
      const startY = 40

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Input', startX, 12)
      for (let r = 0; r < SAMPLE_IMAGE.length; r++) {
        for (let c = 0; c < SAMPLE_IMAGE[0].length; c++) {
          p.fill(SAMPLE_IMAGE[r][c])
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize)
        }
      }

      const arrowX = startX + SAMPLE_IMAGE[0].length * cellSize + 20
      const arrowY = startY + (SAMPLE_IMAGE.length * cellSize) / 2
      p.stroke(100)
      p.strokeWeight(2)
      p.line(arrowX, arrowY, arrowX + 30, arrowY)
      p.line(arrowX + 22, arrowY - 6, arrowX + 30, arrowY)
      p.line(arrowX + 22, arrowY + 6, arrowX + 30, arrowY)

      const outX = arrowX + 50
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.text('Output', outX, 12)
      for (let r = 0; r < out.length; r++) {
        for (let c = 0; c < out[0].length; c++) {
          const mapped = p.map(out[r][c], -mx, mx, 0, 255)
          p.fill(mapped)
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(outX + c * cellSize, startY + r * cellSize, cellSize, cellSize)
        }
      }
    }
  }, [sketch])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Learned Filters: Edit and Explore</h2>
      <p className="text-gray-300 leading-relaxed">
        In a trained CNN, filter weights are learned via backpropagation. Early layers typically
        learn low-level features like edges and gradients, while deeper layers combine those into
        textures, parts, and eventually whole objects. Below you can pick a preset filter or edit
        individual weights to see how the output feature map changes. Try switching between edge
        detectors, sharpening, blurring, and embossing to build intuition for what different filters
        extract from an image.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {Object.keys(PRESET_FILTERS).map((name) => (
          <button
            key={name}
            onClick={() => { setFilterName(name); setKernel(PRESET_FILTERS[name]) }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              filterName === name
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <div>
          <p className="text-sm text-gray-400 mb-2">Filter weights (editable):</p>
          <div className="grid grid-cols-3 gap-1">
            {kernel.map((row, r) =>
              row.map((val, c) => (
                <input
                  key={`${r}-${c}`}
                  type="number"
                  value={val}
                  onChange={(e) => handleCellChange(r, c, e.target.value)}
                  className="w-16 h-10 bg-gray-800 border border-gray-600 rounded text-center text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              ))
            )}
          </div>
        </div>
      </div>

      <P5Sketch sketch={sketchWithRedraw} height={300} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Stride, Padding, and Pooling                          */
/* ================================================================== */
function StrideAndPoolingSection() {
  const [stride, setStride] = useState(1)
  const [padding, setPadding] = useState(0)
  const [poolSize, setPoolSize] = useState(2)
  const stateRef = useRef({ stride, padding, poolSize })
  stateRef.current = { stride, padding, poolSize }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 320)
      p.textFont('monospace')
    }
    p.draw = () => {
      const { stride: s, padding: pad, poolSize: ps } = stateRef.current
      p.background(15, 15, 25)

      const kernel = PRESET_FILTERS['Edge V']
      const convOut = convolve2D(SAMPLE_IMAGE, kernel, s, pad)
      const poolOut = maxPool(convOut, ps)

      const cellSize = 28
      let x = 20

      // Input
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Input 8x8`, x, 10)
      for (let r = 0; r < SAMPLE_IMAGE.length; r++) {
        for (let c = 0; c < SAMPLE_IMAGE[0].length; c++) {
          p.fill(SAMPLE_IMAGE[r][c])
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(x + c * cellSize, 30 + r * cellSize, cellSize, cellSize)
        }
      }

      // Arrow
      x += SAMPLE_IMAGE[0].length * cellSize + 10
      const midY = 30 + (SAMPLE_IMAGE.length * cellSize) / 2
      p.stroke(100)
      p.strokeWeight(2)
      p.line(x, midY, x + 20, midY)
      p.fill(100)
      p.noStroke()
      p.triangle(x + 20, midY - 4, x + 20, midY + 4, x + 26, midY)

      // Conv output
      x += 36
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.text(`Conv ${convOut.length}x${convOut[0]?.length ?? 0}`, x, 10)
      let convMax = 1
      for (const row of convOut) for (const v of row) convMax = Math.max(convMax, Math.abs(v))
      for (let r = 0; r < convOut.length; r++) {
        for (let c = 0; c < convOut[0].length; c++) {
          const mapped = p.map(convOut[r][c], -convMax, convMax, 0, 255)
          p.fill(mapped)
          p.stroke(40)
          p.strokeWeight(1)
          p.rect(x + c * cellSize, 30 + r * cellSize, cellSize, cellSize)
        }
      }

      // Arrow
      const convW = (convOut[0]?.length ?? 0) * cellSize
      x += convW + 10
      p.stroke(100)
      p.strokeWeight(2)
      p.line(x, midY, x + 20, midY)
      p.fill(100)
      p.noStroke()
      p.triangle(x + 20, midY - 4, x + 20, midY + 4, x + 26, midY)

      // Pool output
      x += 36
      if (poolOut.length > 0 && poolOut[0].length > 0) {
        p.fill(255)
        p.noStroke()
        p.textSize(12)
        p.text(`Pool ${poolOut.length}x${poolOut[0].length}`, x, 10)
        let poolMax = 1
        for (const row of poolOut) for (const v of row) poolMax = Math.max(poolMax, Math.abs(v))
        for (let r = 0; r < poolOut.length; r++) {
          for (let c = 0; c < poolOut[0].length; c++) {
            const mapped = p.map(poolOut[r][c], -poolMax, poolMax, 0, 255)
            p.fill(mapped)
            p.stroke(40)
            p.strokeWeight(1)
            p.rect(x + c * cellSize, 30 + r * cellSize, cellSize, cellSize)
          }
        }
      } else {
        p.fill(200, 80, 80)
        p.noStroke()
        p.textSize(12)
        p.text('Pool too large for this output', x, midY)
      }

      // Info
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`stride=${stateRef.current.stride}  padding=${stateRef.current.padding}  pool=${stateRef.current.poolSize}x${stateRef.current.poolSize}`, 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Stride, Padding, and Pooling</h2>
      <p className="text-gray-300 leading-relaxed">
        Two hyperparameters control the convolution output size. <strong className="text-white">Stride</strong> is
        how many pixels the filter jumps between positions -- stride 2 halves each spatial
        dimension. <strong className="text-white">Padding</strong> adds zeros around the border so
        the output can remain the same size as the input (or larger). The output dimension formula
        is: <code className="text-emerald-400">out = floor((input + 2*padding - kernel) / stride) + 1</code>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        After convolution, <strong className="text-white">pooling</strong> further reduces spatial
        dimensions. Max pooling takes the maximum value in each non-overlapping window, preserving
        the strongest activations while providing a degree of translational invariance. Average
        pooling takes the mean instead. Together, strided convolutions and pooling progressively
        shrink the spatial resolution while increasing the channel depth through the network.
      </p>
      <P5Sketch
        sketch={sketch}
        height={320}
        controls={
          <ControlPanel title="Parameters">
            <InteractiveSlider label="Stride" min={1} max={3} step={1} value={stride} onChange={setStride} />
            <InteractiveSlider label="Padding" min={0} max={2} step={1} value={padding} onChange={setPadding} />
            <InteractiveSlider label="Pool Size" min={1} max={3} step={1} value={poolSize} onChange={setPoolSize} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Full CNN Pipeline Diagram                             */
/* ================================================================== */
function CNNPipelineSection() {
  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 750), 300)
      p.textFont('monospace')
    }
    p.draw = () => {
      p.background(15, 15, 25)
      const W = p.width
      const layers = [
        { name: 'Input\n32x32x3', w: 50, h: 120, color: p.color(80, 80, 180) },
        { name: 'Conv1\n30x30x16', w: 45, h: 105, color: p.color(60, 160, 100) },
        { name: 'Pool1\n15x15x16', w: 35, h: 80, color: p.color(180, 140, 50) },
        { name: 'Conv2\n13x13x32', w: 30, h: 65, color: p.color(60, 160, 100) },
        { name: 'Pool2\n6x6x32', w: 22, h: 45, color: p.color(180, 140, 50) },
        { name: 'Flatten\n1152', w: 12, h: 120, color: p.color(160, 80, 160) },
        { name: 'FC\n128', w: 12, h: 80, color: p.color(200, 80, 80) },
        { name: 'Output\n10', w: 12, h: 40, color: p.color(200, 80, 80) },
      ]

      const totalGap = W - 60
      const spacing = totalGap / (layers.length - 1)
      const centerY = 150

      for (let i = 0; i < layers.length; i++) {
        const lx = 30 + i * spacing
        const ly = centerY - layers[i].h / 2
        p.fill(layers[i].color)
        p.stroke(255, 40)
        p.strokeWeight(1)
        p.rect(lx - layers[i].w / 2, ly, layers[i].w, layers[i].h, 4)

        // Connect to next
        if (i < layers.length - 1) {
          const nx = 30 + (i + 1) * spacing
          p.stroke(100)
          p.strokeWeight(1)
          p.line(lx + layers[i].w / 2, centerY, nx - layers[i + 1].w / 2, centerY)
        }

        // Label
        p.fill(220)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        const lines = layers[i].name.split('\n')
        p.text(lines[0], lx, ly + layers[i].h + 6)
        if (lines[1]) {
          p.fill(140)
          p.textSize(9)
          p.text(lines[1], lx, ly + layers[i].h + 20)
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Full CNN Pipeline', 20, 10)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Full CNN Pipeline</h2>
      <p className="text-gray-300 leading-relaxed">
        A complete CNN interleaves convolutional layers and pooling layers to progressively extract
        higher-level features at coarser spatial resolutions. The spatial dimensions shrink while the
        number of channels (feature maps) grows -- the network trades spatial detail for semantic
        richness. Finally, the 3D feature volume is flattened into a 1D vector and passed through
        one or more fully connected layers that map features to class probabilities.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The diagram below shows a simple CNN for classifying 32x32 color images into 10 classes.
        Each block's height represents the spatial resolution, and green blocks are convolutional
        layers, yellow blocks are pooling layers, and red blocks are fully connected layers.
      </p>
      <P5Sketch sketch={sketch} height={300} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Python: 2D Convolution From Scratch                   */
/* ================================================================== */
function PythonConvSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: 2D Convolution from Scratch</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement the core convolution operation in pure NumPy. This is exactly what happens
        inside a Conv2D layer -- for each output position, we extract the overlapping patch, multiply
        element-wise by the kernel, and sum. Modern frameworks use highly optimized implementations
        (im2col + GEMM, Winograd transforms, or FFT-based convolution), but the mathematical
        operation is identical.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def convolve2d(image, kernel, stride=1, padding=0):
    """2D convolution from scratch using NumPy."""
    h, w = image.shape
    kh, kw = kernel.shape

    # Add zero padding
    if padding > 0:
        image = np.pad(image, padding, mode='constant', constant_values=0)
        h, w = image.shape

    # Output dimensions
    out_h = (h - kh) // stride + 1
    out_w = (w - kw) // stride + 1
    output = np.zeros((out_h, out_w))

    for i in range(out_h):
        for j in range(out_w):
            patch = image[i*stride:i*stride+kh, j*stride:j*stride+kw]
            output[i, j] = np.sum(patch * kernel)

    return output

# Create a simple 8x8 "image" with a bright center
image = np.array([
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 50, 80, 80, 50, 0, 0],
    [0, 50, 200, 255, 255, 200, 50, 0],
    [0, 80, 255, 255, 255, 255, 80, 0],
    [0, 80, 255, 255, 255, 255, 80, 0],
    [0, 50, 200, 255, 255, 200, 50, 0],
    [0, 0, 50, 80, 80, 50, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
], dtype=float)

# Horizontal edge detector
kernel_h = np.array([[-1, -1, -1],
                     [ 0,  0,  0],
                     [ 1,  1,  1]], dtype=float)

# Vertical edge detector
kernel_v = np.array([[-1, 0, 1],
                     [-1, 0, 1],
                     [-1, 0, 1]], dtype=float)

out_h = convolve2d(image, kernel_h)
out_v = convolve2d(image, kernel_v)

print("Horizontal edges (6x6):")
print(np.round(out_h, 1))
print("\\nVertical edges (6x6):")
print(np.round(out_v, 1))
print(f"\\nWith stride=2: shape = {convolve2d(image, kernel_h, stride=2).shape}")
print(f"With padding=1: shape = {convolve2d(image, kernel_h, padding=1).shape}")`}
        title="2D Convolution from Scratch"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: CNN Concepts with NumPy                       */
/* ================================================================== */
function PythonPoolingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Pooling and the Full Forward Pass</h2>
      <p className="text-gray-300 leading-relaxed">
        Below we add max pooling and ReLU activation to build a minimal but complete convolutional
        forward pass. Notice how each operation transforms the spatial dimensions and how pooling
        aggressively reduces the data volume -- a 2x2 max pool cuts the number of values by 75%.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

def relu(x):
    return np.maximum(0, x)

def max_pool2d(feature_map, pool_size=2):
    h, w = feature_map.shape
    out_h, out_w = h // pool_size, w // pool_size
    output = np.zeros((out_h, out_w))
    for i in range(out_h):
        for j in range(out_w):
            patch = feature_map[i*pool_size:(i+1)*pool_size,
                                j*pool_size:(j+1)*pool_size]
            output[i, j] = np.max(patch)
    return output

def convolve2d(image, kernel):
    h, w = image.shape
    kh, kw = kernel.shape
    out_h, out_w = h - kh + 1, w - kw + 1
    output = np.zeros((out_h, out_w))
    for i in range(out_h):
        for j in range(out_w):
            output[i, j] = np.sum(image[i:i+kh, j:j+kw] * kernel)
    return output

# Simulate a mini CNN forward pass
np.random.seed(42)
image = np.random.rand(16, 16)  # 16x16 grayscale image
kernel1 = np.random.randn(3, 3) * 0.5  # learned filter

print("Input shape:", image.shape)

# Conv layer 1
conv_out = convolve2d(image, kernel1)
print("After Conv (3x3):", conv_out.shape)

# ReLU
relu_out = relu(conv_out)
print("After ReLU:", relu_out.shape)

# Max pool
pool_out = max_pool2d(relu_out, 2)
print("After MaxPool (2x2):", pool_out.shape)

# Flatten for FC layer
flat = pool_out.flatten()
print("After Flatten:", flat.shape)

# Simple FC layer -> 10 classes
W_fc = np.random.randn(10, flat.shape[0]) * 0.1
logits = W_fc @ flat
# Softmax
probs = np.exp(logits - logits.max()) / np.exp(logits - logits.max()).sum()
print("\\nClass probabilities:")
for i, p in enumerate(probs):
    bar = '#' * int(p * 50)
    print(f"  class {i}: {p:.4f} {bar}")`}
        title="Pooling + Full CNN Forward Pass"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function CNN() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Convolutional Neural Networks</h1>
        <p className="text-lg text-gray-400">
          How CNNs exploit spatial structure through local connectivity, weight sharing, and
          hierarchical feature extraction -- the architecture that revolutionized computer vision.
        </p>
      </header>

      <WhyNotFCSection />
      <ConvolutionAnimationSection />
      <EditableFilterSection />
      <StrideAndPoolingSection />
      <CNNPipelineSection />
      <PythonConvSection />
      <PythonPoolingSection />
    </div>
  )
}
