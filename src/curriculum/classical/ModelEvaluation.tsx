import { useState, useCallback } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/model-evaluation',
  title: 'Model Evaluation',
  description: 'Confusion matrices, precision, recall, ROC curves, and cross-validation for rigorous model assessment',
  track: 'classical',
  order: 12,
  tags: ['evaluation', 'confusion-matrix', 'roc', 'cross-validation', 'precision', 'recall'],
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

// Generate a simulated classification dataset with predicted probabilities
function generateClassificationData(seed: number) {
  const rng = makeRng(seed)
  const N = 200
  const data: { trueLabel: number; score: number }[] = []
  for (let i = 0; i < N; i++) {
    const isPositive = rng() < 0.3 // 30% positive rate
    const label = isPositive ? 1 : 0
    // Scores overlap but positives tend to have higher scores
    const score = isPositive
      ? 0.5 + randn(rng) * 0.2
      : 0.3 + randn(rng) * 0.2
    data.push({ trueLabel: label, score: Math.max(0, Math.min(1, score)) })
  }
  return data
}

/* ------------------------------------------------------------------ */
/* Section 1 — Confusion Matrix                                        */
/* ------------------------------------------------------------------ */

function ConfusionMatrixSketch() {
  const [threshold, setThreshold] = useState(0.5)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateClassificationData(42)

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 450)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        // Compute confusion matrix
        let tp = 0, fp = 0, tn = 0, fn = 0
        for (const d of data) {
          const pred = d.score >= threshold ? 1 : 0
          if (pred === 1 && d.trueLabel === 1) tp++
          else if (pred === 1 && d.trueLabel === 0) fp++
          else if (pred === 0 && d.trueLabel === 0) tn++
          else fn++
        }

        const total = data.length
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0
        const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
        const accuracy = (tp + tn) / total

        // Draw confusion matrix
        const matSize = 180
        const matX = 60
        const matY = 80
        const cellW = matSize / 2
        const cellH = matSize / 2

        // Matrix cells
        const cells = [
          { row: 0, col: 0, value: tp, label: 'TP', color: [52, 211, 153] as const },
          { row: 0, col: 1, value: fp, label: 'FP', color: [234, 67, 53] as const },
          { row: 1, col: 0, value: fn, label: 'FN', color: [250, 204, 21] as const },
          { row: 1, col: 1, value: tn, label: 'TN', color: [99, 102, 241] as const },
        ]

        for (const cell of cells) {
          const cx = matX + cell.col * cellW
          const cy = matY + cell.row * cellH
          const intensity = Math.min(200, 30 + (cell.value / total) * 600)
          p.noStroke()
          p.fill(cell.color[0], cell.color[1], cell.color[2], intensity)
          p.rect(cx, cy, cellW - 2, cellH - 2, 4)

          // Value
          p.fill(255)
          p.textSize(24)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(cell.value.toString(), cx + cellW / 2, cy + cellH / 2 - 8)
          p.textSize(11)
          p.fill(200, 200, 200)
          p.text(cell.label, cx + cellW / 2, cy + cellH / 2 + 16)
        }

        // Labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Predicted Positive', matX + cellW / 2, matY - 20)
        p.text('Predicted Negative', matX + cellW + cellW / 2, matY - 20)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Predicted', matX + matSize / 2, matY - 38)

        p.push()
        p.translate(matX - 25, matY + matSize / 2)
        p.rotate(-p.HALF_PI)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Actual', 0, -10)
        p.pop()

        p.textAlign(p.RIGHT, p.CENTER)
        p.text('Positive', matX - 5, matY + cellH / 2)
        p.text('Negative', matX - 5, matY + cellH + cellH / 2)

        // Score distribution on the right
        const distX = matX + matSize + 80
        const distW = p.width - distX - 40
        const distY = 80
        const distH = 150

        // Draw histogram of scores for each class
        const bins = 20
        const posHist = Array(bins).fill(0)
        const negHist = Array(bins).fill(0)
        for (const d of data) {
          const bin = Math.min(bins - 1, Math.floor(d.score * bins))
          if (d.trueLabel === 1) posHist[bin]++
          else negHist[bin]++
        }
        const maxCount = Math.max(...posHist, ...negHist, 1)

        const binW = distW / bins
        for (let b = 0; b < bins; b++) {
          const bx = distX + b * binW
          // Negative class
          p.noStroke()
          p.fill(99, 102, 241, 120)
          const negH = (negHist[b] / maxCount) * distH
          p.rect(bx, distY + distH - negH, binW - 1, negH)
          // Positive class
          p.fill(52, 211, 153, 120)
          const posH = (posHist[b] / maxCount) * distH
          p.rect(bx, distY + distH - posH, binW - 1, posH)
        }

        // Threshold line
        const threshX = distX + threshold * distW
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.line(threshX, distY, threshX, distY + distH)
        p.noStroke()
        p.fill(250, 204, 21)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(`threshold=${threshold.toFixed(2)}`, threshX, distY - 4)

        // X-axis for distribution
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text('0.0', distX, distY + distH + 4)
        p.text('0.5', distX + distW / 2, distY + distH + 4)
        p.text('1.0', distX + distW, distY + distH + 4)
        p.textSize(11)
        p.text('Predicted Score Distribution', distX + distW / 2, distY - 20)

        // Legend for distribution
        p.fill(52, 211, 153, 180)
        p.rect(distX, distY + distH + 22, 12, 10, 2)
        p.fill(148, 163, 184)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Positive class', distX + 16, distY + distH + 22)
        p.fill(99, 102, 241, 180)
        p.rect(distX + 110, distY + distH + 22, 12, 10, 2)
        p.fill(148, 163, 184)
        p.text('Negative class', distX + 126, distY + distH + 22)

        // Metrics panel at bottom
        const metricsY = matY + matSize + 30
        const metrics = [
          { name: 'Accuracy', value: accuracy, color: [200, 200, 200] as const },
          { name: 'Precision', value: precision, color: [52, 211, 153] as const },
          { name: 'Recall', value: recall, color: [250, 204, 21] as const },
          { name: 'F1 Score', value: f1, color: [168, 85, 247] as const },
        ]

        const barMaxW = 200
        for (let i = 0; i < metrics.length; i++) {
          const my = metricsY + i * 28
          p.noStroke()
          p.fill(metrics[i].color[0], metrics[i].color[1], metrics[i].color[2])
          p.textSize(12)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(metrics[i].name, 60, my + 8)

          // Bar
          p.fill(30, 41, 59)
          p.rect(170, my, barMaxW, 16, 3)
          p.fill(metrics[i].color[0], metrics[i].color[1], metrics[i].color[2], 180)
          p.rect(170, my, barMaxW * metrics[i].value, 16, 3)

          // Value
          p.fill(255)
          p.textSize(11)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(metrics[i].value.toFixed(3), 170 + barMaxW + 10, my + 8)
        }

        // Formulas
        p.fill(100, 116, 139)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        const fmY = metricsY + 8
        p.text('Precision = TP / (TP + FP)', distX, fmY)
        p.text('Recall = TP / (TP + FN)', distX, fmY + 18)
        p.text('F1 = 2 * P * R / (P + R)', distX, fmY + 36)
        p.text(`Accuracy = (TP+TN) / N = ${(accuracy * 100).toFixed(1)}%`, distX, fmY + 54)
      }
    },
    [threshold],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={450}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Classification Threshold:
            <input type="range" min={0.05} max={0.95} step={0.01} value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-48" />
            <span className="w-12 font-mono">{threshold.toFixed(2)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Precision-Recall Tradeoff                               */
/* ------------------------------------------------------------------ */

function PrecisionRecallSketch() {
  const [threshold, setThreshold] = useState(0.5)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateClassificationData(42)

      // Compute precision & recall for many thresholds
      const thresholds = Array.from({ length: 100 }, (_, i) => i / 99)
      const precisions: number[] = []
      const recalls: number[] = []
      for (const th of thresholds) {
        let tp = 0, fp = 0, fn = 0
        for (const d of data) {
          const pred = d.score >= th ? 1 : 0
          if (pred === 1 && d.trueLabel === 1) tp++
          else if (pred === 1 && d.trueLabel === 0) fp++
          else if (pred === 0 && d.trueLabel === 1) fn++
        }
        precisions.push(tp + fp > 0 ? tp / (tp + fp) : 1)
        recalls.push(tp + fn > 0 ? tp / (tp + fn) : 0)
      }

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 400)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 60
        const plotW = p.width - margin * 2
        const plotH = p.height - margin * 2

        function mx(v: number): number { return margin + v * plotW }
        function my(v: number): number { return p.height - margin - v * plotH }

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
        p.text('Threshold', p.width / 2, p.height - 18)

        // Y-axis ticks
        p.textSize(10)
        for (let v = 0; v <= 1; v += 0.2) {
          p.fill(100, 116, 139)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(v.toFixed(1), margin - 8, my(v))
          p.textAlign(p.CENTER, p.TOP)
          p.text(v.toFixed(1), mx(v), p.height - margin + 6)
        }

        // Precision curve
        p.noFill()
        p.stroke(52, 211, 153)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < thresholds.length; i++) {
          p.vertex(mx(thresholds[i]), my(precisions[i]))
        }
        p.endShape()

        // Recall curve
        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < thresholds.length; i++) {
          p.vertex(mx(thresholds[i]), my(recalls[i]))
        }
        p.endShape()

        // F1 curve
        p.stroke(168, 85, 247, 150)
        p.strokeWeight(1.5)
        p.beginShape()
        for (let i = 0; i < thresholds.length; i++) {
          const prec = precisions[i]
          const rec = recalls[i]
          const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0
          p.vertex(mx(thresholds[i]), my(f1))
        }
        p.endShape()

        // Current threshold line
        p.stroke(234, 67, 53, 180)
        p.strokeWeight(2)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([5, 5])
        p.line(mx(threshold), margin, mx(threshold), p.height - margin)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

        // Current values
        const idx = Math.round(threshold * 99)
        const curP = precisions[idx]
        const curR = recalls[idx]
        const curF1 = curP + curR > 0 ? 2 * curP * curR / (curP + curR) : 0

        // Dots at current threshold
        p.noStroke()
        p.fill(52, 211, 153)
        p.ellipse(mx(threshold), my(curP), 10, 10)
        p.fill(250, 204, 21)
        p.ellipse(mx(threshold), my(curR), 10, 10)
        p.fill(168, 85, 247)
        p.ellipse(mx(threshold), my(curF1), 10, 10)

        // Legend & values
        p.noStroke()
        const lx = p.width - 200
        let ly = 20
        const items = [
          { label: `Precision: ${curP.toFixed(3)}`, color: [52, 211, 153] as const },
          { label: `Recall: ${curR.toFixed(3)}`, color: [250, 204, 21] as const },
          { label: `F1: ${curF1.toFixed(3)}`, color: [168, 85, 247] as const },
        ]
        for (const item of items) {
          p.fill(item.color[0], item.color[1], item.color[2])
          p.rect(lx, ly, 14, 3, 1)
          p.fill(200, 200, 200)
          p.textSize(11)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(item.label, lx + 20, ly + 2)
          ly += 20
        }

        // Title
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Precision, Recall & F1 vs Threshold', margin, 6)
      }
    },
    [threshold],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Threshold:
            <input type="range" min={0.05} max={0.95} step={0.01} value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-48" />
            <span className="w-12 font-mono">{threshold.toFixed(2)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — ROC Curve                                               */
/* ------------------------------------------------------------------ */

function ROCCurveSketch() {
  const [sweepProgress, setSweepProgress] = useState(1)

  const sketch = useCallback(
    (p: p5) => {
      const data = generateClassificationData(42)

      // Also generate a "good model" and "random model"
      const rng = makeRng(99)
      const goodData = data.map((d) => ({
        ...d,
        score: d.trueLabel === 1
          ? 0.7 + randn(rng) * 0.12
          : 0.2 + randn(rng) * 0.12,
      })).map((d) => ({ ...d, score: Math.max(0, Math.min(1, d.score)) }))

      function computeROC(dataset: typeof data) {
        const sorted = [...dataset].sort((a, b) => b.score - a.score)
        const totalP = dataset.filter((d) => d.trueLabel === 1).length
        const totalN = dataset.filter((d) => d.trueLabel === 0).length
        const points: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }]
        let tp = 0, fp = 0
        for (const d of sorted) {
          if (d.trueLabel === 1) tp++
          else fp++
          points.push({ fpr: fp / totalN, tpr: tp / totalP })
        }
        return points
      }

      function computeAUC(rocPoints: { fpr: number; tpr: number }[]) {
        let auc = 0
        for (let i = 1; i < rocPoints.length; i++) {
          auc += (rocPoints[i].fpr - rocPoints[i - 1].fpr) * (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2
        }
        return auc
      }

      const rocCurve = computeROC(data)
      const goodROC = computeROC(goodData)
      const aucBaseline = computeAUC(rocCurve)
      const aucGood = computeAUC(goodROC)

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, 430)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 60
        const plotW = p.width * 0.6 - margin
        const plotH = p.height - margin * 2

        function mx(v: number): number { return margin + v * plotW }
        function my(v: number): number { return p.height - margin - v * plotH }

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, p.height - margin, margin + plotW, p.height - margin)
        p.line(margin, margin, margin, p.height - margin)

        // Labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(12)
        p.textAlign(p.CENTER, p.TOP)
        p.text('False Positive Rate (FPR)', margin + plotW / 2, p.height - 18)
        p.push()
        p.translate(16, margin + plotH / 2)
        p.rotate(-p.HALF_PI)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('True Positive Rate (TPR)', 0, 0)
        p.pop()

        // Ticks
        p.textSize(10)
        for (let v = 0; v <= 1; v += 0.2) {
          p.fill(100, 116, 139)
          p.textAlign(p.CENTER, p.TOP)
          p.text(v.toFixed(1), mx(v), p.height - margin + 6)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(v.toFixed(1), margin - 8, my(v))
        }

        // Random classifier diagonal
        p.stroke(51, 65, 85, 150)
        p.strokeWeight(1)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([4, 4])
        p.line(mx(0), my(0), mx(1), my(1))
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])

        // Visible portion of curves
        const nVisibleBaseline = Math.ceil(rocCurve.length * sweepProgress)
        const nVisibleGood = Math.ceil(goodROC.length * sweepProgress)

        // Good model ROC
        p.noFill()
        p.stroke(52, 211, 153)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < nVisibleGood; i++) {
          p.vertex(mx(goodROC[i].fpr), my(goodROC[i].tpr))
        }
        p.endShape()

        // Baseline model ROC
        p.stroke(99, 102, 241)
        p.strokeWeight(2)
        p.beginShape()
        for (let i = 0; i < nVisibleBaseline; i++) {
          p.vertex(mx(rocCurve[i].fpr), my(rocCurve[i].tpr))
        }
        p.endShape()

        // AUC shading for good model
        if (sweepProgress >= 1) {
          p.fill(52, 211, 153, 20)
          p.noStroke()
          p.beginShape()
          for (const pt of goodROC) {
            p.vertex(mx(pt.fpr), my(pt.tpr))
          }
          p.vertex(mx(1), my(0))
          p.vertex(mx(0), my(0))
          p.endShape(p.CLOSE)
        }

        // Legend on right side
        const legendX = margin + plotW + 40
        let ly = 50
        p.noStroke()

        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text('ROC Curve', legendX, ly)
        ly += 30

        // Good model
        p.fill(52, 211, 153)
        p.rect(legendX, ly, 20, 3, 1)
        p.fill(200, 200, 200)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Good Model`, legendX + 28, ly - 4)
        p.fill(148, 163, 184)
        p.text(`AUC = ${aucGood.toFixed(3)}`, legendX + 28, ly + 12)
        ly += 40

        // Baseline model
        p.fill(99, 102, 241)
        p.rect(legendX, ly, 20, 3, 1)
        p.fill(200, 200, 200)
        p.textSize(11)
        p.text(`Baseline Model`, legendX + 28, ly - 4)
        p.fill(148, 163, 184)
        p.text(`AUC = ${aucBaseline.toFixed(3)}`, legendX + 28, ly + 12)
        ly += 40

        // Random
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([4, 4])
        p.line(legendX, ly + 2, legendX + 20, ly + 2)
        ;(p.drawingContext as CanvasRenderingContext2D).setLineDash([])
        p.noStroke()
        p.fill(200, 200, 200)
        p.textSize(11)
        p.text('Random (AUC=0.5)', legendX + 28, ly - 4)
        ly += 40

        // Explanation
        p.fill(148, 163, 184)
        p.textSize(10)
        const explanations = [
          'AUC = 1.0: perfect classifier',
          'AUC = 0.5: random guessing',
          'AUC < 0.5: worse than random',
          '',
          'Higher AUC = better model',
          'Curve hugs top-left = good',
        ]
        for (const line of explanations) {
          p.text(line, legendX, ly)
          ly += 16
        }
      }
    },
    [sweepProgress],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={430}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Threshold Sweep:
            <input type="range" min={0.02} max={1} step={0.02} value={sweepProgress}
              onChange={(e) => setSweepProgress(parseFloat(e.target.value))} className="w-44" />
            <span className="w-12 font-mono">{(sweepProgress * 100).toFixed(0)}%</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 — Cross-Validation                                        */
/* ------------------------------------------------------------------ */

function CrossValidationSketch() {
  const [kFolds, setKFolds] = useState(5)
  const [activeFold, setActiveFold] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const N = 100 // total samples

      // Simulated fold scores
      const rng = makeRng(42)
      const foldScores = Array.from({ length: kFolds }, () => 0.82 + randn(rng) * 0.04)
      const meanScore = foldScores.reduce((a, b) => a + b, 0) / kFolds
      const stdScore = Math.sqrt(foldScores.reduce((s, v) => s + (v - meanScore) ** 2, 0) / kFolds)

      const foldH = 35
      const foldGap = 8
      const canvasH = 60 + kFolds * (foldH + foldGap) + 100 // header + folds + summary

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)
        const margin = 40
        const totalFoldH = kFolds * (foldH + foldGap)
        const startY = 60

        const samplesPerFold = Math.floor(N / kFolds)
        const barW = (p.width - margin * 2) * 0.6
        const segW = barW / kFolds

        // Title
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${kFolds}-Fold Cross-Validation`, margin, 15)
        p.fill(148, 163, 184)
        p.textSize(11)
        p.text(`${N} samples split into ${kFolds} folds of ~${samplesPerFold} samples each`, margin, 35)

        // Draw each fold configuration
        for (let fold = 0; fold < kFolds; fold++) {
          const y = startY + fold * (foldH + foldGap)
          const isActive = fold === activeFold

          // Fold label
          p.noStroke()
          p.fill(isActive ? 226 : 148, isActive ? 232 : 163, isActive ? 240 : 184)
          p.textSize(11)
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(`Fold ${fold + 1}`, margin - 8, y + foldH / 2)

          // Draw segments
          for (let seg = 0; seg < kFolds; seg++) {
            const sx = margin + seg * segW
            const isVal = seg === fold
            p.noStroke()
            if (isVal) {
              p.fill(234, 67, 53, isActive ? 220 : 120) // validation = red
            } else {
              p.fill(66, 133, 244, isActive ? 180 : 80) // training = blue
            }
            p.rect(sx + 1, y, segW - 2, foldH, 3)

            // Label inside segment
            if (isActive) {
              p.fill(255, 255, 255, 200)
              p.textSize(9)
              p.textAlign(p.CENTER, p.CENTER)
              p.text(isVal ? 'VAL' : 'TRAIN', sx + segW / 2, y + foldH / 2)
            }
          }

          // Score
          p.noStroke()
          const scoreX = margin + barW + 20
          p.fill(isActive ? 255 : 148, isActive ? 255 : 163, isActive ? 255 : 184)
          p.textSize(12)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`Score: ${foldScores[fold].toFixed(3)}`, scoreX, y + foldH / 2)

          // Score bar
          const barStartX = scoreX + 110
          const scoreBarW = 120
          p.fill(30, 41, 59)
          p.rect(barStartX, y + 8, scoreBarW, foldH - 16, 3)
          const col = isActive ? [52, 211, 153] : [71, 85, 105]
          p.fill(col[0], col[1], col[2], isActive ? 220 : 120)
          p.rect(barStartX, y + 8, scoreBarW * foldScores[fold], foldH - 16, 3)
        }

        // Summary
        const summaryY = startY + totalFoldH + 15
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(13)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Summary', margin, summaryY)

        p.fill(52, 211, 153)
        p.textSize(16)
        p.text(`Mean: ${meanScore.toFixed(3)}`, margin, summaryY + 24)
        p.fill(148, 163, 184)
        p.textSize(12)
        p.text(`Std: ${stdScore.toFixed(3)}`, margin + 160, summaryY + 27)
        p.text(`(${meanScore.toFixed(3)} +/- ${stdScore.toFixed(3)})`, margin + 250, summaryY + 27)

        // Legend
        const legY = summaryY + 55
        p.fill(66, 133, 244, 180)
        p.rect(margin, legY, 16, 12, 2)
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Training data', margin + 22, legY + 6)

        p.fill(234, 67, 53, 180)
        p.rect(margin + 120, legY, 16, 12, 2)
        p.fill(148, 163, 184)
        p.text('Validation data', margin + 148, legY + 6)
      }
    },
    [kFolds, activeFold],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={60 + kFolds * (35 + 8) + 100}
      controls={
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            K Folds:
            <input type="range" min={3} max={10} step={1} value={kFolds}
              onChange={(e) => { setKFolds(parseInt(e.target.value)); setActiveFold(0) }} className="w-28" />
            <span className="w-6 font-mono">{kFolds}</span>
          </label>
          <label className="flex items-center gap-2">
            Highlight Fold:
            <input type="range" min={0} max={kFolds - 1} step={1} value={activeFold}
              onChange={(e) => setActiveFold(parseInt(e.target.value))} className="w-28" />
            <span className="w-10 font-mono">Fold {activeFold + 1}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                              */
/* ------------------------------------------------------------------ */

export default function ModelEvaluation() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-200">
      {/* ---------- Section 1: Why Accuracy Isn't Enough ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">1. Why Accuracy Is Not Enough</h2>
        <p className="mb-4 text-gray-300">
          Accuracy — the fraction of predictions that are correct — seems like the obvious metric.
          But it can be deeply misleading with <strong className="text-white">imbalanced
          classes</strong>. Consider fraud detection: only 1% of transactions are fraudulent. A
          model that always predicts "not fraud" achieves 99% accuracy while being completely
          useless — it catches zero frauds.
        </p>
        <p className="mb-4 text-gray-300">
          This is not an edge case. Most real-world classification problems have class imbalance:
          disease diagnosis (most patients are healthy), spam detection (most emails are legitimate),
          manufacturing defects (most products are fine). In all these cases, accuracy rewards the
          model for predicting the majority class and ignoring the minority class.
        </p>
        <p className="mb-4 text-gray-300">
          To properly evaluate a classifier, we need metrics that separately measure performance
          on positive and negative classes. This leads us to the <strong className="text-white">
          confusion matrix</strong> and the metrics derived from it: precision, recall, F1, and the
          ROC curve.
        </p>
      </section>

      {/* ---------- Section 2: Confusion Matrix ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">2. The Confusion Matrix</h2>
        <p className="mb-4 text-gray-300">
          The confusion matrix is a 2x2 table that breaks down predictions into four categories:
        </p>
        <ul className="mb-4 list-disc pl-6 space-y-1 text-gray-300">
          <li><strong className="text-emerald-400">True Positive (TP):</strong> Predicted positive, actually positive. We got it right.</li>
          <li><strong className="text-red-400">False Positive (FP):</strong> Predicted positive, actually negative. A false alarm (Type I error).</li>
          <li><strong className="text-yellow-400">False Negative (FN):</strong> Predicted negative, actually positive. A miss (Type II error).</li>
          <li><strong className="text-indigo-400">True Negative (TN):</strong> Predicted negative, actually negative. Correctly ignored.</li>
        </ul>
        <p className="mb-4 text-gray-300">
          Most classifiers output a continuous <strong className="text-white">score</strong>
          (probability) rather than a hard 0/1 prediction. The <strong className="text-white">
          classification threshold</strong> converts scores into predictions: if score greater than or equal to threshold,
          predict positive. Moving the threshold changes the balance between the four cells.
        </p>
        <p className="mb-6 text-gray-300">
          The visualization shows the confusion matrix on the left and the score distributions on
          the right. Drag the threshold slider to see how all four cells, precision, recall, F1,
          and accuracy update in real time.
        </p>
        <ConfusionMatrixSketch />
      </section>

      {/* ---------- Section 3: Precision & Recall ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">3. Precision & Recall</h2>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">Precision</strong> answers: "Of all items I flagged as
          positive, what fraction actually were positive?" It measures the quality of positive
          predictions. High precision means few false alarms.
        </p>
        <p className="mb-4 text-gray-300">
          <strong className="text-white">Recall</strong> answers: "Of all truly positive items, what
          fraction did I catch?" It measures completeness. High recall means few missed positives.
        </p>
        <p className="mb-4 text-gray-300">
          There is a fundamental <strong className="text-white">tradeoff</strong>: increasing the
          threshold makes the model more selective — precision goes up (fewer false positives) but
          recall goes down (more missed positives). Decreasing the threshold catches more positives
          (recall up) but also flags more negatives (precision down).
        </p>
        <p className="mb-6 text-gray-300">
          The plot below shows precision (green), recall (yellow), and F1 (purple) as functions of
          the threshold. Notice how they trade off — the optimal threshold depends on whether
          false positives or false negatives are more costly for your application.
        </p>
        <PrecisionRecallSketch />
      </section>

      {/* ---------- Section 4: F1 Score ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">4. The F1 Score</h2>
        <p className="mb-4 text-gray-300">
          The <strong className="text-white">F1 score</strong> is the harmonic mean of precision
          and recall: F1 = 2 * P * R / (P + R). It is high only when both precision and recall are
          high — a model cannot get a good F1 by sacrificing one for the other.
        </p>
        <p className="mb-4 text-gray-300">
          Why the harmonic mean instead of the arithmetic mean? Because the harmonic mean penalizes
          extreme imbalances. If precision is 1.0 and recall is 0.01, the arithmetic mean would be
          0.505 (misleadingly high), but the harmonic mean is 0.02 (correctly low).
        </p>
        <p className="mb-4 text-gray-300">
          Use F1 when you care equally about precision and recall. For different tradeoffs, use the
          <strong className="text-white"> F-beta score</strong>: F_beta = (1 + beta^2) * P * R /
          (beta^2 * P + R). Setting beta=2 weighs recall twice as much as precision (good for
          medical diagnosis where missing a case is worse than a false alarm). Setting beta=0.5
          weighs precision more (good for spam filtering where false positives annoy users).
        </p>
      </section>

      {/* ---------- Section 5: ROC Curve & AUC ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">5. ROC Curve & AUC</h2>
        <p className="mb-4 text-gray-300">
          The <strong className="text-white">ROC curve</strong> (Receiver Operating Characteristic)
          plots the True Positive Rate (TPR = recall) against the False Positive Rate (FPR = FP /
          (FP + TN)) as the classification threshold sweeps from 1 to 0. Each point on the curve
          represents a different threshold.
        </p>
        <p className="mb-4 text-gray-300">
          A perfect classifier's ROC curve goes straight up to (0, 1) and then right to (1, 1) —
          it catches all positives before any false positives. A random classifier follows the
          diagonal from (0, 0) to (1, 1). A good classifier's curve hugs the top-left corner.
        </p>
        <p className="mb-4 text-gray-300">
          The <strong className="text-white">AUC</strong> (Area Under the Curve) summarizes the
          ROC curve as a single number from 0 to 1. AUC = 1.0 is perfect, AUC = 0.5 is random.
          AUC has a beautiful interpretation: it equals the probability that a randomly chosen
          positive example scores higher than a randomly chosen negative example.
        </p>
        <p className="mb-6 text-gray-300">
          The visualization shows two models: a "good" model (green) with well-separated score
          distributions and a "baseline" model (blue) with more overlap. Sweep the threshold to
          trace out the ROC curves and see how AUC differs.
        </p>
        <ROCCurveSketch />
      </section>

      {/* ---------- Section 6: Cross-Validation ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">6. K-Fold Cross-Validation</h2>
        <p className="mb-4 text-gray-300">
          A single train/test split can give misleading results — you might get lucky (or unlucky)
          with which examples end up in the test set. <strong className="text-white">K-Fold
          Cross-Validation</strong> provides a more robust estimate by using every data point for
          both training and validation.
        </p>
        <h3 className="mb-2 text-lg font-semibold text-white">How it works</h3>
        <ol className="mb-4 list-decimal pl-6 space-y-1 text-gray-300">
          <li>Split the data into K equal-sized folds (typically K=5 or K=10).</li>
          <li>For each fold: train the model on K-1 folds, validate on the remaining fold.</li>
          <li>Collect K validation scores and report the mean and standard deviation.</li>
        </ol>
        <p className="mb-4 text-gray-300">
          The mean score is a less biased estimate of true performance than a single split. The
          standard deviation tells you how stable the model is — high variance across folds
          suggests the model is sensitive to the specific training data.
        </p>
        <p className="mb-6 text-gray-300">
          The visualization below shows how data is split into K folds. Each row is one "round" —
          the red segment is validation, the blue segments are training. Use the sliders to change
          K and highlight individual folds.
        </p>
        <CrossValidationSketch />
      </section>

      {/* ---------- Section 7: Python - Full Evaluation ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">7. Python: Full Evaluation Pipeline</h2>
        <p className="mb-4 text-gray-300">
          A complete evaluation using scikit-learn: confusion matrix, precision, recall, F1, and ROC
          AUC on a real classification task.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    confusion_matrix, classification_report,
    roc_auc_score, precision_recall_fscore_support
)

# Imbalanced dataset (30% positive)
X, y = make_classification(n_samples=500, n_features=10, n_informative=6,
                           weights=[0.7, 0.3], random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Train model
rf = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_train, y_train)
y_pred = rf.predict(X_test)
y_proba = rf.predict_proba(X_test)[:, 1]

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
tn, fp, fn, tp = cm.ravel()
print("Confusion Matrix:")
print(f"  TP={tp}  FP={fp}")
print(f"  FN={fn}  TN={tn}")

# Classification Report
print("\\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Negative', 'Positive']))

# ROC AUC
auc = roc_auc_score(y_test, y_proba)
print(f"ROC AUC: {auc:.3f}")

# Per-class metrics
prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
print(f"\\nPrecision: {prec:.3f}")
print(f"Recall:    {rec:.3f}")
print(f"F1 Score:  {f1:.3f}")
`}
        />
      </section>

      {/* ---------- Section 8: Python - Cross-Validation ---------- */}
      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">8. Python: Cross-Validation Model Comparison</h2>
        <p className="mb-4 text-gray-300">
          Use K-fold cross-validation to compare multiple models on the same data. This gives a
          statistically robust comparison rather than relying on a single train/test split.
        </p>
        <PythonCell
          defaultCode={`import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

# Generate dataset
X, y = make_classification(n_samples=500, n_features=12, n_informative=8,
                           weights=[0.6, 0.4], random_state=42)

# Use stratified K-fold (preserves class proportions in each fold)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

models = {
    "Logistic Regression": LogisticRegression(max_iter=1000),
    "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5),
    "Random Forest":       RandomForestClassifier(n_estimators=100, random_state=42),
    "Gradient Boosting":   GradientBoostingClassifier(n_estimators=100, random_state=42),
    "SVM (RBF)":           SVC(kernel='rbf', probability=True, random_state=42),
}

# Compare with multiple metrics
for metric in ['accuracy', 'f1', 'roc_auc']:
    print(f"\\n{'='*55}")
    print(f"Metric: {metric}")
    print(f"{'Model':<25} {'Mean':>8} {'Std':>8} {'Scores'}")
    print(f"{'-'*55}")

    for name, model in models.items():
        scores = cross_val_score(model, X, y, cv=cv, scoring=metric)
        scores_str = ', '.join(f'{s:.3f}' for s in scores)
        print(f"{name:<25} {scores.mean():>8.3f} {scores.std():>8.3f} [{scores_str}]")
`}
        />
      </section>
    </article>
  )
}
