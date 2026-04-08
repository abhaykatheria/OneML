import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/transfer-learning',
  title: 'Transfer Learning',
  description: 'Learn when and how to reuse pretrained models through feature extraction, fine-tuning, and foundation model adaptation',
  track: 'deep',
  order: 6,
  tags: ['transfer-learning', 'fine-tuning', 'feature-extraction', 'pretrained', 'foundation-models'],
}

/* ================================================================== */
/*  Section 1 -- Why Not Train From Scratch?                           */
/* ================================================================== */
function WhyTransferSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Not Train From Scratch?</h2>
      <p className="text-gray-300 leading-relaxed">
        Training a deep neural network from random initialization requires three things in
        abundance: labeled data, compute, and time. A ResNet-50 trained on ImageNet takes about a
        week on 8 GPUs and needs 1.2 million labeled images. GPT-3 required months on thousands of
        GPUs and trillions of tokens. Most practitioners have neither the data nor the compute to
        match these training runs.
      </p>
      <p className="text-gray-300 leading-relaxed">
        But there is a remarkable empirical finding: features learned on one task often transfer to
        other tasks. A CNN trained on ImageNet learns edge detectors in layer 1, texture detectors in
        layer 2, part detectors in layer 3 -- these features are useful for almost any vision task,
        from medical imaging to satellite photos. Similarly, a language model trained on web text
        learns syntax, semantics, and world knowledge that transfers to specialized domains.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Transfer learning</strong> exploits this: take a model
        pretrained on a large dataset, then adapt it to your specific (usually smaller) dataset.
        You get the benefit of features learned from millions of examples, even if your target
        dataset has only hundreds. The two main strategies are <strong className="text-white">
        feature extraction</strong> (freeze the pretrained layers, only train a new head) and
        <strong className="text-white">fine-tuning</strong> (update some or all pretrained layers
        with a small learning rate).
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Feature Extraction Visualization                      */
/* ================================================================== */
function FeatureExtractionSection() {
  const [numFrozen, setNumFrozen] = useState(5)
  const stateRef = useRef({ numFrozen })
  stateRef.current = { numFrozen }

  const totalLayers = 7

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { numFrozen: nf } = stateRef.current
      p.background(15, 15, 25)

      const layerW = 65
      const gap = 15
      const totalW = totalLayers * layerW + (totalLayers - 1) * gap + layerW + gap // +1 for new head
      const startX = (p.width - totalW) / 2
      const centerY = 200

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Feature Extraction: Frozen backbone + New head', 20, 10)

      const layerLabels = ['Conv1', 'Conv2', 'Conv3', 'Conv4', 'Conv5', 'FC1', 'FC2']
      const layerHeights = [160, 140, 120, 100, 80, 70, 50]

      for (let i = 0; i < totalLayers; i++) {
        const x = startX + i * (layerW + gap)
        const h = layerHeights[i]
        const y = centerY - h / 2
        const isFrozen = i < nf

        if (isFrozen) {
          // Frozen: blue with ice pattern
          p.fill(40, 80, 160, 200)
          p.stroke(80, 140, 220)
          p.strokeWeight(2)
          p.rect(x, y, layerW, h, 6)

          // Ice pattern
          p.stroke(100, 160, 240, 80)
          p.strokeWeight(1)
          for (let li = 0; li < 3; li++) {
            const ly = y + (h / 4) * (li + 1)
            p.line(x + 5, ly, x + layerW - 5, ly)
          }

          // Snowflake symbol
          p.fill(160, 200, 255)
          p.noStroke()
          p.textSize(16)
          p.textAlign(p.CENTER, p.CENTER)
          p.text('*', x + layerW / 2, y + 14)
        } else {
          // Trainable: warm gradient
          const t = (i - nf) / Math.max(1, totalLayers - nf - 1)
          p.fill(p.lerp(60, 180, t), p.lerp(140, 80, t), 40)
          p.stroke(p.lerp(80, 220, t), p.lerp(180, 120, t), 60)
          p.strokeWeight(2)
          p.rect(x, y, layerW, h, 6)

          // Gradient arrows (learning)
          p.stroke(255, 200, 80, 120)
          p.strokeWeight(1.5)
          const arrowX = x + layerW / 2
          p.line(arrowX, y + h - 10, arrowX, y + 10)
          p.fill(255, 200, 80, 120)
          p.noStroke()
          p.triangle(arrowX - 4, y + 14, arrowX + 4, y + 14, arrowX, y + 6)
        }

        // Label
        p.fill(isFrozen ? p.color(160, 200, 255) : p.color(255, 220, 100))
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text(layerLabels[i], x + layerW / 2, centerY + layerHeights[i] / 2 + 8)
        p.textSize(8)
        p.fill(isFrozen ? p.color(100, 140, 200) : p.color(200, 180, 80))
        p.text(isFrozen ? 'frozen' : 'trainable', x + layerW / 2, centerY + layerHeights[i] / 2 + 22)

        // Connection arrow
        if (i < totalLayers - 1) {
          const nx = startX + (i + 1) * (layerW + gap)
          p.stroke(80)
          p.strokeWeight(1)
          p.line(x + layerW, centerY, nx, centerY)
          p.fill(80)
          p.noStroke()
          p.triangle(nx, centerY - 3, nx, centerY + 3, nx + 4, centerY)
        }
      }

      // New classification head
      const headX = startX + totalLayers * (layerW + gap)
      const headH = 40
      p.fill(60, 180, 80)
      p.stroke(100, 220, 120)
      p.strokeWeight(2)
      p.rect(headX, centerY - headH / 2, layerW, headH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('New Head', headX + layerW / 2, centerY)
      p.fill(100, 220, 120)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('trainable', headX + layerW / 2, centerY + headH / 2 + 8)

      // Arrow to head
      const prevX = startX + (totalLayers - 1) * (layerW + gap)
      p.stroke(80)
      p.strokeWeight(1)
      p.line(prevX + layerW, centerY, headX, centerY)

      // Legend
      p.fill(160)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Blue = frozen (pretrained weights preserved)    Green/Yellow = trainable (updated via backprop)', 20, p.height - 8)

      // Stats
      const frozenParams = nf * 1000
      const trainableParams = (totalLayers - nf) * 1000 + 500
      p.fill(200)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Frozen: ~${frozenParams} params    Trainable: ~${trainableParams} params`, 20, 34)
    }
  }, [totalLayers])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Feature Extraction: Freeze and Attach</h2>
      <p className="text-gray-300 leading-relaxed">
        The simplest transfer strategy is <strong className="text-white">feature extraction</strong>.
        Take a pretrained network, remove the final classification head, freeze all remaining layers,
        and attach a new head for your task. The frozen backbone acts as a fixed feature extractor --
        it transforms your input images into a rich feature representation without updating its
        weights.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Adjust the slider to control how many layers are frozen (blue with ice crystals). Only the
        green/yellow layers and the new head are trained. With more frozen layers, you train fewer
        parameters and need less data, but you may sacrifice task-specific adaptation.
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Frozen Layers">
            <InteractiveSlider label="Frozen Layers" min={0} max={totalLayers} step={1} value={numFrozen} onChange={(v) => { setNumFrozen(v); stateRef.current.numFrozen = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Fine-tuning: Gradual Unfreezing                       */
/* ================================================================== */
function FineTuningSection() {
  const [epoch, setEpoch] = useState(0)
  const stateRef = useRef({ epoch })
  stateRef.current = { epoch }

  const totalLayers = 6
  const totalEpochs = 6

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      const { epoch: ep } = stateRef.current
      p.background(15, 15, 25)

      const layerW = 80
      const gap = 18
      const totalW = totalLayers * layerW + (totalLayers - 1) * gap
      const startX = (p.width - totalW) / 2
      const centerY = 180

      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Gradual Unfreezing  -  Epoch ${ep}`, 20, 10)

      const layerLabels = ['Layer 1\n(edges)', 'Layer 2\n(textures)', 'Layer 3\n(parts)', 'Layer 4\n(objects)', 'Layer 5\n(semantic)', 'Head\n(task)']
      const layerHeights = [130, 120, 100, 80, 65, 45]

      // Unfreezing schedule: last layers first, progressively unfreezing earlier layers
      // At epoch 0: only head trainable
      // At epoch 1: layer 5 + head
      // etc.
      const numTrainable = Math.min(totalLayers, ep + 1)
      const firstTrainable = totalLayers - numTrainable

      for (let i = 0; i < totalLayers; i++) {
        const x = startX + i * (layerW + gap)
        const h = layerHeights[i]
        const y = centerY - h / 2
        const isFrozen = i < firstTrainable

        // Learning rate decreases for earlier layers
        const layerLR = isFrozen ? 0 : 0.001 * Math.pow(0.5, numTrainable - 1 - (i - firstTrainable))

        if (isFrozen) {
          p.fill(40, 60, 120)
          p.stroke(60, 90, 160)
          p.strokeWeight(1.5)
        } else {
          // Color intensity based on learning rate
          const lrNorm = layerLR / 0.001
          p.fill(40 + lrNorm * 140, 100 + lrNorm * 60, 30)
          p.stroke(80 + lrNorm * 140, 140 + lrNorm * 80, 50)
          p.strokeWeight(2)
        }
        p.rect(x, y, layerW, h, 6)

        // Layer label
        p.fill(isFrozen ? 140 : 255)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        const lines = layerLabels[i].split('\n')
        p.text(lines[0], x + layerW / 2, centerY - 6)
        if (lines[1]) {
          p.fill(isFrozen ? 100 : 200)
          p.textSize(8)
          p.text(lines[1], x + layerW / 2, centerY + 8)
        }

        // LR below
        if (isFrozen) { p.fill(80) } else { p.fill(200, 180, 60) }
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(isFrozen ? 'frozen' : `lr=${layerLR.toExponential(0)}`, x + layerW / 2, centerY + h / 2 + 8)

        // Connection
        if (i < totalLayers - 1) {
          const nx = startX + (i + 1) * (layerW + gap)
          p.stroke(60)
          p.strokeWeight(1)
          p.line(x + layerW, centerY, nx, centerY)
        }
      }

      // Phase description
      const descriptions = [
        'Epoch 0: Only the new task head is trained. Backbone is fully frozen.',
        'Epoch 1: Unfreeze last layer. It gets the highest learning rate.',
        'Epoch 2: Unfreeze 2 layers. Earlier layers get smaller learning rates.',
        'Epoch 3: Unfreeze 3 layers. Discriminative learning rates: lower for general features.',
        'Epoch 4: Unfreeze 4 layers. Almost all layers adapting now.',
        'Epoch 5: All layers trainable. Layer 1 has tiny LR (preserve edge detectors).',
        'Epoch 6: Full fine-tuning with discriminative LRs across the entire network.',
      ]

      p.fill(180)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.BOTTOM)
      const desc = descriptions[Math.min(ep, descriptions.length - 1)]
      p.text(desc, 20, p.height - 30)
      p.fill(120)
      p.textSize(10)
      p.text('Brighter layers = higher learning rate. Earlier layers change slowly to preserve general features.', 20, p.height - 10)
    }
  }, [totalLayers])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Fine-Tuning: Gradual Unfreezing</h2>
      <p className="text-gray-300 leading-relaxed">
        Fine-tuning updates the pretrained weights, but carelessly updating all layers with a
        large learning rate can destroy the useful features -- a phenomenon called <strong
        className="text-white">catastrophic forgetting</strong>. The solution is <strong
        className="text-white">gradual unfreezing</strong> with <strong className="text-white">
        discriminative learning rates</strong>: start by training only the head, then progressively
        unfreeze deeper layers with exponentially smaller learning rates.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The intuition: early layers learn universal features (edges, textures) that should change
        very little, while later layers learn task-specific features that need more adaptation.
        Use the slider to step through epochs and watch layers progressively unfreeze, with brightness
        indicating learning rate magnitude.
      </p>
      <P5Sketch
        sketch={sketch}
        height={380}
        controls={
          <ControlPanel title="Training Progress">
            <InteractiveSlider label="Epoch" min={0} max={totalEpochs} step={1} value={epoch} onChange={(v) => { setEpoch(v); stateRef.current.epoch = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Decision Flowchart                                    */
/* ================================================================== */
function DecisionFlowchartSection() {
  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      p.background(15, 15, 25)

      const cx = p.width / 2

      const drawDiamond = (x: number, y: number, label: string, w: number, h: number) => {
        p.fill(60, 80, 130)
        p.stroke(100, 140, 200)
        p.strokeWeight(1.5)
        p.beginShape()
        p.vertex(x, y - h / 2)
        p.vertex(x + w / 2, y)
        p.vertex(x, y + h / 2)
        p.vertex(x - w / 2, y)
        p.endShape(p.CLOSE)
        p.fill(220)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, x, y)
      }

      const drawBox = (x: number, y: number, label: string, color: readonly [number, number, number]) => {
        const tw = Math.max(120, p.textWidth(label) + 30)
        p.fill(color[0], color[1], color[2])
        p.stroke(color[0] + 40, color[1] + 40, color[2] + 40)
        p.strokeWeight(1.5)
        p.rect(x - tw / 2, y - 18, tw, 36, 8)
        p.fill(255)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(label, x, y)
      }

      const drawEdge = (x1: number, y1: number, x2: number, y2: number, label: string) => {
        p.stroke(100)
        p.strokeWeight(1.5)
        if (x1 === x2) {
          p.line(x1, y1, x2, y2)
        } else {
          p.line(x1, y1, x1, (y1 + y2) / 2)
          p.line(x1, (y1 + y2) / 2, x2, (y1 + y2) / 2)
          p.line(x2, (y1 + y2) / 2, x2, y2)
        }
        p.fill(180, 180, 100)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        if (x1 === x2) {
          p.text(label, x1 + 25, (y1 + y2) / 2)
        } else {
          p.text(label, (x1 + x2) / 2, (y1 + y2) / 2 - 10)
        }
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Transfer Learning Decision Flowchart', 20, 10)

      // Flowchart
      // Q1: How much data?
      drawDiamond(cx, 60, 'How much\nlabeled data?', 160, 60)

      // Little data branch (left)
      drawEdge(cx - 80, 60, cx - 180, 140, 'Little')
      drawDiamond(cx - 180, 140, 'Similar to\npretrained domain?', 170, 60)

      drawEdge(cx - 180 - 85, 140, cx - 280, 210, 'Yes')
      drawBox(cx - 280, 210, 'Feature Extraction', [40, 120, 60] as const)
      p.fill(140)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Freeze all, train head only', cx - 280, 232)

      drawEdge(cx - 180 + 85, 140, cx - 80, 210, 'No')
      drawBox(cx - 80, 210, 'Fine-tune upper layers', [140, 100, 40] as const)
      p.fill(140)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Small LR, gradual unfreeze', cx - 80, 232)

      // Lots of data branch (right)
      drawEdge(cx + 80, 60, cx + 180, 140, 'Lots')
      drawDiamond(cx + 180, 140, 'Similar to\npretrained domain?', 170, 60)

      drawEdge(cx + 180 - 85, 140, cx + 80, 210, 'Yes')
      drawBox(cx + 80, 210, 'Fine-tune entire model', [160, 80, 40] as const)
      p.fill(140)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Discriminative LR, all layers', cx + 80, 232)

      drawEdge(cx + 180 + 85, 140, cx + 280, 210, 'No')
      drawBox(cx + 280, 210, 'Train from scratch\nor fine-tune heavily', [140, 50, 50] as const)
      p.fill(140)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('May need new architecture', cx + 280, 232)

      // Bottom section: foundation models
      p.fill(200)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Modern approach: Use a foundation model and adapt', cx, 290)

      const fmY = 340
      const approaches = [
        { label: 'Prompt\nEngineering', color: [80, 140, 180] as const, desc: 'No training' },
        { label: 'Few-shot\nIn-context', color: [100, 160, 120] as const, desc: 'No training' },
        { label: 'LoRA/\nAdapters', color: [160, 130, 60] as const, desc: '0.1% params' },
        { label: 'Full\nFine-tune', color: [180, 80, 60] as const, desc: '100% params' },
      ]

      const apW = 110
      const apGap = 20
      const apTotalW = approaches.length * apW + (approaches.length - 1) * apGap
      const apStartX = cx - apTotalW / 2

      for (let i = 0; i < approaches.length; i++) {
        const ax = apStartX + i * (apW + apGap)
        const a = approaches[i]
        p.fill(a.color[0], a.color[1], a.color[2])
        p.stroke(a.color[0] + 30, a.color[1] + 30, a.color[2] + 30)
        p.strokeWeight(1.5)
        p.rect(ax, fmY, apW, 50, 8)
        p.fill(255)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(a.label, ax + apW / 2, fmY + 20)
        p.fill(160)
        p.textSize(8)
        p.text(a.desc, ax + apW / 2, fmY + 42)

        // Arrow from increasing compute label
        if (i < approaches.length - 1) {
          p.stroke(80)
          p.strokeWeight(1)
          p.line(ax + apW + 2, fmY + 25, ax + apW + apGap - 2, fmY + 25)
        }
      }

      p.fill(120)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Less compute/data required  --------->  More compute/data required', cx, fmY + 58)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">When to Use Which Strategy</h2>
      <p className="text-gray-300 leading-relaxed">
        The right transfer strategy depends on two factors: how much labeled data you have, and how
        similar your target domain is to the pretraining domain. The flowchart below provides a
        decision framework. With little data and a similar domain, simple feature extraction works
        well. With lots of data and a different domain, you may need to fine-tune aggressively or
        even train from scratch.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Increasingly, foundation models (large pretrained models like GPT-4, Claude, or CLIP) offer a
        spectrum of adaptation strategies from zero-shot prompting (no training at all) to full
        fine-tuning, with parameter-efficient methods like LoRA in between.
      </p>
      <P5Sketch sketch={sketch} height={440} />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Foundation Models                                     */
/* ================================================================== */
function FoundationModelsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Foundation Models: The Modern Paradigm</h2>
      <p className="text-gray-300 leading-relaxed">
        The term "foundation model" (coined by Stanford HAI in 2021) refers to large models trained
        on broad data that can be adapted to a wide range of downstream tasks. This represents a
        paradigm shift in AI: instead of training a specialized model for each task, we train one
        massive model and adapt it many ways.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Parameter-Efficient Fine-Tuning (PEFT)</h3>
      <p className="text-gray-300 leading-relaxed">
        Full fine-tuning of a foundation model requires storing a separate copy of all billions of
        parameters for each task. PEFT methods train only a tiny fraction of parameters:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">LoRA (Low-Rank Adaptation)</strong>: decomposes weight updates into low-rank matrices, training only 0.1-1% of parameters while matching full fine-tuning performance.</li>
        <li><strong className="text-white">Adapters</strong>: inserts small trainable bottleneck layers between frozen Transformer blocks.</li>
        <li><strong className="text-white">Prefix Tuning</strong>: prepends learned continuous "prompt" vectors to the key and value sequences.</li>
        <li><strong className="text-white">Prompt Tuning</strong>: learns a small set of continuous embeddings prepended to the input.</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">In-Context Learning</h3>
      <p className="text-gray-300 leading-relaxed">
        Large language models can perform new tasks with zero gradient updates by conditioning on
        instructions and examples in the prompt. This "in-context learning" is not transfer learning
        in the traditional sense (no parameters are updated), but it leverages the same pretrained
        representations. The quality depends on model scale, prompt engineering, and the relationship
        between the task and the pretraining distribution.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Python: Transfer Learning Demo                        */
/* ================================================================== */
function PythonTransferSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Transfer Learning Concepts</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us demonstrate the core idea of transfer learning with a simple numerical experiment:
        a "pretrained" feature extractor that has already learned useful representations, adapted
        to a new task by training only a small head.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Simulate a pretrained feature extractor
# (In practice, this would be a ResNet/BERT loaded from a checkpoint)
np.random.seed(42)

# Pretrained weights (imagine these encode useful visual features)
W_pretrained_1 = np.random.randn(8, 4) * 0.5  # layer 1: 4 -> 8
W_pretrained_2 = np.random.randn(6, 8) * 0.5  # layer 2: 8 -> 6

def relu(x):
    return np.maximum(0, x)

def pretrained_backbone(X):
    """Frozen feature extractor."""
    h1 = relu(X @ W_pretrained_1.T)
    h2 = relu(h1 @ W_pretrained_2.T)
    return h2

# NEW TASK: classify with very little data (20 samples)
n_samples = 20
n_classes = 3
X_train = np.random.randn(n_samples, 4)
y_train = np.random.randint(0, n_classes, n_samples)

# Strategy 1: Feature extraction (freeze backbone, train linear head)
print("=== Strategy 1: Feature Extraction ===")
features = pretrained_backbone(X_train)
print(f"Input shape: {X_train.shape}")
print(f"Feature shape: {features.shape}")

# Train simple linear head via pseudo-inverse (closed-form)
Y_onehot = np.eye(n_classes)[y_train]
W_head = np.linalg.lstsq(features, Y_onehot, rcond=None)[0]
preds = features @ W_head
accuracy = np.mean(np.argmax(preds, axis=1) == y_train)
print(f"Training accuracy: {accuracy:.2f}")
print(f"Trainable params: {W_head.size} (head only)")
print(f"Frozen params: {W_pretrained_1.size + W_pretrained_2.size}")

# Strategy 2: Training from scratch
print("\\n=== Strategy 2: From Scratch (for comparison) ===")
W_scratch_1 = np.random.randn(8, 4) * 0.5
W_scratch_2 = np.random.randn(6, 8) * 0.5
W_scratch_head = np.random.randn(n_classes, 6) * 0.5

# Simple gradient descent
lr = 0.01
for epoch in range(200):
    # Forward
    h1 = relu(X_train @ W_scratch_1.T)
    h2 = relu(h1 @ W_scratch_2.T)
    logits = h2 @ W_scratch_head.T
    probs = np.exp(logits - logits.max(1, keepdims=True))
    probs = probs / probs.sum(1, keepdims=True)

    # Backward (simplified, just head gradient)
    grad = probs.copy()
    grad[np.arange(n_samples), y_train] -= 1
    grad /= n_samples
    W_scratch_head -= lr * grad.T @ h2

preds_scratch = h2 @ W_scratch_head.T
acc_scratch = np.mean(np.argmax(preds_scratch, axis=1) == y_train)
print(f"Training accuracy: {acc_scratch:.2f}")
total_params = W_scratch_1.size + W_scratch_2.size + W_scratch_head.size
print(f"Total trainable params: {total_params} (all layers)")

# LoRA simulation
print("\\n=== Strategy 3: LoRA-style Adaptation ===")
# Instead of updating full weight matrix, use low-rank update
rank = 2
A = np.random.randn(6, rank) * 0.01
B = np.random.randn(rank, 8) * 0.01
# Effective weight = W_pretrained_2 + A @ B
W_lora = W_pretrained_2 + A @ B
features_lora = relu(relu(X_train @ W_pretrained_1.T) @ W_lora.T)
W_lora_head = np.linalg.lstsq(features_lora, Y_onehot, rcond=None)[0]
preds_lora = features_lora @ W_lora_head
acc_lora = np.mean(np.argmax(preds_lora, axis=1) == y_train)
print(f"Training accuracy: {acc_lora:.2f}")
print(f"LoRA trainable params: {A.size + B.size + W_lora_head.size}")
print(f"Full model params: {W_pretrained_1.size + W_pretrained_2.size}")`}
        title="Transfer Learning: Feature Extraction vs From Scratch vs LoRA"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Domain Similarity                             */
/* ================================================================== */
function PythonDomainSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: When Does Transfer Help?</h2>
      <p className="text-gray-300 leading-relaxed">
        Transfer learning works best when source and target domains share structure. Let us measure
        this by comparing feature distributions between domains and see how transfer performance
        correlates with domain similarity.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(42)

def make_features(domain_center, n=50, noise=0.3):
    """Simulate features from a domain."""
    return domain_center + np.random.randn(n, len(domain_center)) * noise

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)

# Source domain (pretrained on): natural images
source_center = np.array([1.0, 0.5, 0.8, 0.3, 0.6, 0.2])

# Target domains with varying similarity
domains = {
    "Medical X-rays":  np.array([0.8, 0.4, 0.7, 0.2, 0.5, 0.1]),
    "Satellite imgs":  np.array([0.5, 0.3, 0.4, 0.8, 0.2, 0.7]),
    "Text documents":  np.array([-0.3, 0.8, -0.2, 0.5, -0.1, 0.9]),
    "Audio spectrograms": np.array([0.1, -0.2, 0.3, -0.4, 0.9, -0.1]),
}

print("=== Domain Similarity to Source (Natural Images) ===\\n")
results = []
for name, center in domains.items():
    sim = cosine_sim(source_center, center)

    # Simulate transfer accuracy based on similarity
    base_acc = 0.50  # random baseline
    transfer_boost = sim * 0.4  # transfer helps proportionally
    transfer_acc = min(0.99, base_acc + transfer_boost)
    scratch_acc = base_acc + np.random.rand() * 0.15

    results.append((name, sim, transfer_acc, scratch_acc))
    print(f"{name:22s}  sim={sim:.3f}  "
          f"transfer={transfer_acc:.2f}  scratch={scratch_acc:.2f}  "
          f"gain={transfer_acc - scratch_acc:+.2f}")

print("\\n=== Recommendation ===")
for name, sim, t_acc, s_acc in results:
    if sim > 0.8:
        rec = "Feature extraction (very similar domain)"
    elif sim > 0.5:
        rec = "Fine-tune upper layers"
    elif sim > 0.2:
        rec = "Fine-tune aggressively or train from scratch"
    else:
        rec = "Train from scratch (too different)"
    print(f"  {name:22s} -> {rec}")`}
        title="Domain Similarity and Transfer Strategy"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function TransferLearning() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Transfer Learning</h1>
        <p className="text-lg text-gray-400">
          Why training from scratch is often unnecessary, how to reuse pretrained models through
          feature extraction and fine-tuning, and the modern landscape of foundation model adaptation.
        </p>
      </header>

      <WhyTransferSection />
      <FeatureExtractionSection />
      <FineTuningSection />
      <DecisionFlowchartSection />
      <FoundationModelsSection />
      <PythonTransferSection />
      <PythonDomainSection />
    </div>
  )
}
