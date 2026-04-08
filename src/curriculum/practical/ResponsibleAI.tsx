import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'practical/responsible-ai',
  title: 'Responsible AI',
  description: 'Fairness, bias, interpretability, SHAP values, privacy, and practical guidelines for ethical ML',
  track: 'practical',
  order: 5,
  tags: ['fairness', 'bias', 'interpretability', 'shap', 'ethics', 'responsible-ai'],
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
/* Section 1 — Bias in Data Visualization                              */
/* ------------------------------------------------------------------ */

interface DataPoint {
  group: number // 0 = Group A, 1 = Group B
  feature: number
  label: number // ground truth
  predicted: number
}

function generateBiasedData(rng: () => number, balance: number): DataPoint[] {
  // balance: 0 = heavily imbalanced (90/10), 1 = perfectly balanced (50/50)
  const n = 200
  const data: DataPoint[] = []
  const groupARatio = 0.9 - balance * 0.4 // ranges from 0.9 to 0.5

  for (let i = 0; i < n; i++) {
    const group = rng() < groupARatio ? 0 : 1

    // Feature: Group A centered at 60, Group B at 50 (historical disadvantage)
    const baseMean = group === 0 ? 60 : 50
    const feature = baseMean + randn(rng) * 12

    // True label: based on feature threshold (50) — unbiased ground truth
    const trueLabel = feature > 52 ? 1 : 0

    // Model prediction: biased by both feature AND group membership
    // Model has learned the correlation between group and outcome
    const biasTerm = group === 0 ? 5 : -5
    const score = feature + biasTerm * (1 - balance * 0.8)
    const predicted = score > 55 ? 1 : 0

    data.push({ group, feature, label: trueLabel, predicted })
  }
  return data
}

function BiasSketch() {
  const [balance, setBalance] = useState(0)
  const balanceRef = useRef(balance)
  balanceRef.current = balance

  const sketch = useCallback((p: p5) => {
    const rng = makeRng(42)

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 480)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const cw = p.width
      const bal = balanceRef.current

      // Regenerate data with current balance
      const localRng = makeRng(42)
      const data = generateBiasedData(localRng, bal)

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Bias from Imbalanced Training Data', cw / 2, 10)

      // Draw dataset composition (top left)
      const groupA = data.filter(d => d.group === 0)
      const groupB = data.filter(d => d.group === 1)

      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Dataset Composition', 40, 40)

      const barX = 40
      const barY = 58
      const barW = 200
      const barH = 18

      p.fill(30, 41, 59)
      p.rect(barX, barY, barW, barH, 4)

      const ratioA = groupA.length / data.length
      p.fill(99, 102, 241, 180)
      p.rect(barX, barY, barW * ratioA, barH, 4, 0, 0, 4)
      p.fill(250, 204, 21, 180)
      p.rect(barX + barW * ratioA, barY, barW * (1 - ratioA), barH, 0, 4, 4, 0)

      p.fill(99, 102, 241)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Group A: ${groupA.length} (${(ratioA * 100).toFixed(0)}%)`, barX, barY + barH + 4)
      p.fill(250, 204, 21)
      p.text(`Group B: ${groupB.length} (${((1 - ratioA) * 100).toFixed(0)}%)`, barX + 130, barY + barH + 4)

      // Scatter plot of features by group
      const scatterX = 40
      const scatterY = 110
      const scatterW = cw / 2 - 60
      const scatterH = 160

      p.fill(20, 27, 45)
      p.noStroke()
      p.rect(scatterX, scatterY, scatterW, scatterH, 4)

      // Grid
      p.stroke(40, 50, 70)
      p.strokeWeight(0.5)
      for (let g = 0; g <= 4; g++) {
        const gy = scatterY + (g / 4) * scatterH
        p.line(scatterX, gy, scatterX + scatterW, gy)
      }

      // Plot points
      const fMin = 10
      const fMax = 100
      for (const d of data) {
        const px = scatterX + ((d.feature - fMin) / (fMax - fMin)) * scatterW
        const py = scatterY + scatterH / 2 + (d.group === 0 ? -20 : 20) + (rng() - 0.5) * 30

        if (py < scatterY || py > scatterY + scatterH) continue

        const col = d.group === 0 ? [99, 102, 241] : [250, 204, 21]
        const shape = d.predicted === d.label

        p.noStroke()
        p.fill(col[0], col[1], col[2], shape ? 160 : 80)
        p.circle(px, py, shape ? 6 : 8)
        if (!shape) {
          // Mark misclassifications with an X
          p.stroke(239, 68, 68, 180)
          p.strokeWeight(1.5)
          p.line(px - 4, py - 4, px + 4, py + 4)
          p.line(px - 4, py + 4, px + 4, py - 4)
        }
      }

      p.noStroke()
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('Feature Distribution by Group', scatterX + scatterW / 2, scatterY - 4)
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(9)
      p.text('Feature Value', scatterX + scatterW / 2, scatterY + scatterH + 4)

      // Fairness metrics (right side)
      const metricsX = cw / 2 + 20
      const metricsY = 110
      const metricsW = cw / 2 - 60

      // Compute per-group metrics
      const computeGroupMetrics = (group: DataPoint[]) => {
        let tp = 0, fp = 0, tn = 0, fn = 0
        for (const d of group) {
          if (d.predicted === 1 && d.label === 1) tp++
          else if (d.predicted === 1 && d.label === 0) fp++
          else if (d.predicted === 0 && d.label === 0) tn++
          else fn++
        }
        const accuracy = (tp + tn) / Math.max(1, group.length)
        const fpr = fp / Math.max(1, fp + tn)
        const tpr = tp / Math.max(1, tp + fn)
        const posRate = (tp + fp) / Math.max(1, group.length)
        return { accuracy, fpr, tpr, posRate, tp, fp, tn, fn }
      }

      const metricsA = computeGroupMetrics(groupA)
      const metricsB = computeGroupMetrics(groupB)

      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Fairness Metrics by Group', metricsX, metricsY - 20)

      const metrics = [
        { name: 'Accuracy', a: metricsA.accuracy, b: metricsB.accuracy },
        { name: 'True Positive Rate', a: metricsA.tpr, b: metricsB.tpr },
        { name: 'False Positive Rate', a: metricsA.fpr, b: metricsB.fpr },
        { name: 'Positive Rate', a: metricsA.posRate, b: metricsB.posRate },
      ]

      const mBarW = metricsW - 20
      const mBarH = 14

      for (let i = 0; i < metrics.length; i++) {
        const my = metricsY + i * 60
        const m = metrics[i]

        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(m.name, metricsX, my)

        // Group A bar
        p.fill(30, 41, 59)
        p.rect(metricsX, my + 16, mBarW, mBarH, 3)
        p.fill(99, 102, 241, 180)
        p.rect(metricsX, my + 16, mBarW * Math.min(1, m.a), mBarH, 3)

        // Group B bar
        p.fill(30, 41, 59)
        p.rect(metricsX, my + 33, mBarW, mBarH, 3)
        p.fill(250, 204, 21, 180)
        p.rect(metricsX, my + 33, mBarW * Math.min(1, m.b), mBarH, 3)

        // Values
        p.fill(99, 102, 241)
        p.textSize(9)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`A: ${(m.a * 100).toFixed(1)}%`, metricsX + mBarW + 2, my + 16 + mBarH / 2)
        p.fill(250, 204, 21)
        p.text(`B: ${(m.b * 100).toFixed(1)}%`, metricsX + mBarW + 2, my + 33 + mBarH / 2)

        // Disparity indicator
        const disparity = Math.abs(m.a - m.b)
        const disparityColor = disparity < 0.05 ? [52, 211, 153] : disparity < 0.15 ? [250, 204, 21] : [239, 68, 68]
        p.fill(disparityColor[0], disparityColor[1], disparityColor[2])
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`gap: ${(disparity * 100).toFixed(1)}%`, metricsX + mBarW + 5, my + 25 + mBarH / 2)
      }

      // Demographic parity assessment
      const dpDiff = Math.abs(metricsA.posRate - metricsB.posRate)
      const eoTPRDiff = Math.abs(metricsA.tpr - metricsB.tpr)

      const assessY = 370
      p.fill(148, 163, 184)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Fairness Assessment:', 40, assessY)

      const dpOk = dpDiff < 0.1
      const eoOk = eoTPRDiff < 0.1
      p.fill(dpOk ? 52 : 239, dpOk ? 211 : 68, dpOk ? 153 : 68)
      p.textSize(11)
      p.text(
        `Demographic Parity: ${dpOk ? 'PASS' : 'FAIL'} (positive rate gap = ${(dpDiff * 100).toFixed(1)}%)`,
        40, assessY + 22,
      )
      p.fill(eoOk ? 52 : 239, eoOk ? 211 : 68, eoOk ? 153 : 68)
      p.text(
        `Equalized Odds (TPR): ${eoOk ? 'PASS' : 'FAIL'} (TPR gap = ${(eoTPRDiff * 100).toFixed(1)}%)`,
        40, assessY + 42,
      )

      p.fill(100, 116, 139)
      p.textSize(10)
      p.text(
        'Adjust the dataset balance slider to see how representation affects fairness.',
        40, assessY + 70,
      )
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={480}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Dataset Balance:
            <input type="range" min={0} max={100} step={1} value={balance * 100}
              onChange={(e) => setBalance(parseInt(e.target.value) / 100)} className="w-48" />
            <span className="w-24 font-mono text-xs">
              {balance < 0.3 ? 'Imbalanced' : balance < 0.7 ? 'Moderate' : 'Balanced'}
            </span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — Fairness Metrics Comparison                             */
/* ------------------------------------------------------------------ */

function FairnessMetricsSketch() {
  const [criterion, setCriterion] = useState<'demographic' | 'equalized' | 'predictive'>('demographic')
  const criterionRef = useRef(criterion)
  criterionRef.current = criterion

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 400)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const cw = p.width
      const crit = criterionRef.current

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Fairness Criteria Comparison', cw / 2, 10)

      // Three groups with different model behavior
      const groups = [
        {
          name: 'Group A',
          color: [99, 102, 241],
          accuracy: 0.92,
          tpr: 0.90,
          fpr: 0.08,
          posRate: 0.45,
          ppv: 0.88,
          n: 500,
        },
        {
          name: 'Group B',
          color: [250, 204, 21],
          accuracy: 0.78,
          tpr: 0.65,
          fpr: 0.18,
          posRate: 0.30,
          ppv: 0.72,
          n: 120,
        },
        {
          name: 'Group C',
          color: [52, 211, 153],
          accuracy: 0.85,
          tpr: 0.80,
          fpr: 0.12,
          posRate: 0.38,
          ppv: 0.82,
          n: 80,
        },
      ]

      // Determine which metrics to show based on criterion
      let metricNames: string[]
      let metricKeys: string[]
      let explanation: string
      let thresholdDesc: string

      if (crit === 'demographic') {
        metricNames = ['Positive Rate', 'Selection Rate']
        metricKeys = ['posRate', 'posRate']
        explanation = 'Demographic Parity: each group should receive positive predictions at equal rates.'
        thresholdDesc = 'Fair if all groups have similar positive prediction rates (within 10%)'
      } else if (crit === 'equalized') {
        metricNames = ['True Positive Rate', 'False Positive Rate']
        metricKeys = ['tpr', 'fpr']
        explanation = 'Equalized Odds: each group should have equal TPR and FPR.'
        thresholdDesc = 'Fair if TPR and FPR are similar across groups (within 10%)'
      } else {
        metricNames = ['Positive Predictive Value', 'Accuracy']
        metricKeys = ['ppv', 'accuracy']
        explanation = 'Predictive Parity: positive predictions should be equally correct across groups.'
        thresholdDesc = 'Fair if PPV (precision) is similar across groups (within 10%)'
      }

      // Explanation
      p.fill(148, 163, 184)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text(explanation, cw / 2, 36)
      p.textSize(9)
      p.fill(100, 116, 139)
      p.text(thresholdDesc, cw / 2, 52)

      // Draw bar charts for each metric
      const chartStartY = 80
      const chartH = 120
      const barGroupW = (cw - 120) / metricNames.length
      const barW = 50

      for (let m = 0; m < metricNames.length; m++) {
        const chartX = 60 + m * barGroupW
        const key = metricKeys[m]

        // Metric name
        p.fill(200, 200, 200)
        p.textSize(12)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text(metricNames[m], chartX + barGroupW / 2, chartStartY - 4)

        // Background
        p.fill(20, 27, 45)
        p.noStroke()
        p.rect(chartX, chartStartY, barGroupW - 20, chartH, 4)

        // Grid lines
        p.stroke(40, 50, 70)
        p.strokeWeight(0.5)
        for (let g = 0; g <= 4; g++) {
          const gy = chartStartY + chartH - (g / 4) * chartH
          p.line(chartX, gy, chartX + barGroupW - 20, gy)
        }

        // Bars for each group
        const groupBarW = barW
        const totalBarSpace = groups.length * groupBarW + (groups.length - 1) * 10
        const startX = chartX + (barGroupW - 20 - totalBarSpace) / 2

        const values = groups.map(g => (g as unknown as Record<string, number>)[key] as number)
        const maxDisparity = Math.max(...values) - Math.min(...values)
        const isFair = maxDisparity < 0.1

        for (let g = 0; g < groups.length; g++) {
          const bx = startX + g * (groupBarW + 10)
          const val = values[g]
          const bh = val * chartH

          p.noStroke()
          p.fill(groups[g].color[0], groups[g].color[1], groups[g].color[2], 180)
          p.rect(bx, chartStartY + chartH - bh, groupBarW, bh, 3, 3, 0, 0)

          // Value label
          p.fill(255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text((val * 100).toFixed(1) + '%', bx + groupBarW / 2, chartStartY + chartH - bh - 2)
        }

        // Fairness verdict
        p.fill(isFair ? 52 : 239, isFair ? 211 : 68, isFair ? 153 : 68)
        p.textSize(10)
        p.textAlign(p.CENTER, p.TOP)
        p.text(
          isFair ? 'FAIR' : `UNFAIR (gap: ${(maxDisparity * 100).toFixed(1)}%)`,
          chartX + barGroupW / 2 - 10,
          chartStartY + chartH + 8,
        )
      }

      // Legend
      const legendY = chartStartY + chartH + 40
      for (let g = 0; g < groups.length; g++) {
        const lx = 60 + g * 160
        p.fill(groups[g].color[0], groups[g].color[1], groups[g].color[2], 180)
        p.noStroke()
        p.rect(lx, legendY, 12, 12, 2)
        p.fill(200, 200, 200)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${groups[g].name} (n=${groups[g].n})`, lx + 18, legendY)
      }

      // Key insight box
      const insightY = legendY + 35
      p.fill(30, 41, 59)
      p.rect(40, insightY, cw - 80, 70, 8)
      p.fill(168, 85, 247)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Key Insight:', 55, insightY + 10)
      p.fill(200, 200, 200)
      p.textSize(10)
      const insightText = crit === 'demographic'
        ? 'Demographic parity focuses on equal selection rates regardless of ground truth.\nA model can satisfy this by selecting randomly, so it is often too weak alone.'
        : crit === 'equalized'
          ? 'Equalized odds requires equal error rates. This is stronger than demographic parity\nbut may conflict with it — satisfying both simultaneously is often impossible.'
          : 'Predictive parity means a positive prediction is equally reliable across groups.\nThis matters in high-stakes settings like criminal justice or lending.'
      p.text(insightText, 55, insightY + 28)
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={400}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <span>Fairness Criterion:</span>
          {(['demographic', 'equalized', 'predictive'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCriterion(c)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                criterion === c
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {c === 'demographic' ? 'Demographic Parity' : c === 'equalized' ? 'Equalized Odds' : 'Predictive Parity'}
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 3 — SHAP Values Visualization                               */
/* ------------------------------------------------------------------ */

function SHAPSketch() {
  const [predIdx, setPredIdx] = useState(0)
  const predRef = useRef(predIdx)
  predRef.current = predIdx

  const sketch = useCallback((p: p5) => {
    // Simulate SHAP values for different predictions
    const predictions = [
      {
        label: 'Loan Approved',
        baseValue: 0.5,
        prediction: 0.82,
        features: [
          { name: 'Income', value: '$85k', shap: 0.15 },
          { name: 'Credit Score', value: '720', shap: 0.12 },
          { name: 'Employment', value: '5 years', shap: 0.08 },
          { name: 'Debt Ratio', value: '0.25', shap: -0.03 },
          { name: 'Age', value: '35', shap: 0.04 },
          { name: 'Education', value: 'Masters', shap: 0.03 },
          { name: 'Zip Code', value: '90210', shap: -0.02 },
          { name: 'Loan Amount', value: '$200k', shap: -0.05 },
        ],
      },
      {
        label: 'Loan Denied',
        baseValue: 0.5,
        prediction: 0.23,
        features: [
          { name: 'Income', value: '$32k', shap: -0.12 },
          { name: 'Credit Score', value: '580', shap: -0.18 },
          { name: 'Employment', value: '6 months', shap: -0.08 },
          { name: 'Debt Ratio', value: '0.65', shap: -0.10 },
          { name: 'Age', value: '22', shap: -0.02 },
          { name: 'Education', value: 'High School', shap: 0.01 },
          { name: 'Zip Code', value: '48201', shap: 0.03 },
          { name: 'Loan Amount', value: '$15k', shap: 0.19 },
        ],
      },
      {
        label: 'Borderline Case',
        baseValue: 0.5,
        prediction: 0.51,
        features: [
          { name: 'Income', value: '$55k', shap: 0.03 },
          { name: 'Credit Score', value: '650', shap: -0.04 },
          { name: 'Employment', value: '2 years', shap: 0.02 },
          { name: 'Debt Ratio', value: '0.40', shap: -0.06 },
          { name: 'Age', value: '28', shap: 0.01 },
          { name: 'Education', value: 'Bachelors', shap: 0.02 },
          { name: 'Zip Code', value: '10001', shap: 0.01 },
          { name: 'Loan Amount', value: '$50k', shap: 0.02 },
        ],
      },
    ]

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : 700
      p.createCanvas(pw, 460)
    }

    p.draw = () => {
      p.background(15, 23, 42)
      const cw = p.width
      const idx = predRef.current % predictions.length
      const pred = predictions[idx]

      // Title
      p.noStroke()
      p.fill(255)
      p.textSize(16)
      p.textAlign(p.CENTER, p.TOP)
      p.text('SHAP Feature Attribution', cw / 2, 10)

      // Prediction info
      const isApproved = pred.prediction >= 0.5
      p.fill(isApproved ? 52 : 239, isApproved ? 211 : 68, isApproved ? 153 : 68)
      p.textSize(13)
      p.text(`Prediction: ${pred.label} (score: ${pred.prediction.toFixed(2)})`, cw / 2, 34)

      // Sort features by absolute SHAP value
      const sorted = [...pred.features].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap))

      // Draw horizontal bar chart
      const chartX = 180
      const chartY = 70
      const chartW = cw - 240
      const barH = 32
      const maxShap = Math.max(...sorted.map(f => Math.abs(f.shap)), 0.01)
      const centerX = chartX + chartW / 2

      // Center line (base value)
      p.stroke(100, 116, 139, 100)
      p.strokeWeight(1)
      p.line(centerX, chartY, centerX, chartY + sorted.length * (barH + 8))
      p.noStroke()
      p.fill(100, 116, 139)
      p.textSize(9)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text(`Base: ${pred.baseValue.toFixed(2)}`, centerX, chartY - 2)

      for (let i = 0; i < sorted.length; i++) {
        const f = sorted[i]
        const by = chartY + i * (barH + 8)

        // Feature name and value
        p.fill(200, 200, 200)
        p.textSize(11)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(f.name, chartX - 8, by + barH / 2)
        p.fill(100, 116, 139)
        p.textSize(9)
        p.text(f.value, chartX - 8, by + barH / 2 + 13)

        // Bar
        const barWidth = (Math.abs(f.shap) / maxShap) * (chartW / 2 - 20)
        const isPositive = f.shap >= 0

        if (isPositive) {
          // Positive contribution (pushes prediction higher) — green/teal
          p.fill(52, 211, 153, 180)
          p.rect(centerX, by + 4, barWidth, barH - 8, 0, 4, 4, 0)
        } else {
          // Negative contribution (pushes prediction lower) — red/pink
          p.fill(244, 114, 182, 180)
          p.rect(centerX - barWidth, by + 4, barWidth, barH - 8, 4, 0, 0, 4)
        }

        // SHAP value label
        p.fill(255)
        p.textSize(10)
        if (isPositive) {
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`+${f.shap.toFixed(3)}`, centerX + barWidth + 5, by + barH / 2)
        } else {
          p.textAlign(p.RIGHT, p.CENTER)
          p.text(f.shap.toFixed(3), centerX - barWidth - 5, by + barH / 2)
        }
      }

      // Legend at bottom
      const legY = chartY + sorted.length * (barH + 8) + 15
      p.fill(52, 211, 153, 180)
      p.rect(centerX - 180, legY, 14, 12, 2)
      p.fill(200, 200, 200)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Pushes prediction higher', centerX - 162, legY + 6)

      p.fill(244, 114, 182, 180)
      p.rect(centerX + 20, legY, 14, 12, 2)
      p.fill(200, 200, 200)
      p.text('Pushes prediction lower', centerX + 38, legY + 6)

      // Waterfall summary
      const wmY = legY + 30
      p.fill(100, 116, 139)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      const totalPos = sorted.filter(f => f.shap > 0).reduce((s, f) => s + f.shap, 0)
      const totalNeg = sorted.filter(f => f.shap < 0).reduce((s, f) => s + f.shap, 0)
      p.text(
        `Base (${pred.baseValue.toFixed(2)}) + positive contributions (+${totalPos.toFixed(3)}) + negative contributions (${totalNeg.toFixed(3)}) = ${pred.prediction.toFixed(2)}`,
        cw / 2, wmY,
      )
    }
  }, [])

  return (
    <P5Sketch
      sketch={sketch}
      height={460}
      controls={
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <span>Example Prediction:</span>
          {['Loan Approved', 'Loan Denied', 'Borderline'].map((label, i) => (
            <button
              key={label}
              onClick={() => setPredIdx(i)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                predIdx === i
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const fairnessCode = `import numpy as np

# Compute fairness metrics on a simulated hiring dataset

np.random.seed(42)

# Simulate hiring data: two demographic groups
n_a, n_b = 500, 200  # Group A is majority

# Features: skill score (0-100)
skills_a = np.random.normal(65, 12, n_a).clip(0, 100)
skills_b = np.random.normal(60, 15, n_b).clip(0, 100)

# Ground truth: qualified if skill > 55
qualified_a = (skills_a > 55).astype(int)
qualified_b = (skills_b > 55).astype(int)

# Model predictions — biased model that penalizes Group B
# (learned from historically biased data)
bias_penalty = 8  # Group B needs 8 more points to be predicted positive
pred_a = (skills_a > 50).astype(int)
pred_b = (skills_b > 50 + bias_penalty).astype(int)

def compute_metrics(y_true, y_pred):
    tp = np.sum((y_pred == 1) & (y_true == 1))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    tn = np.sum((y_pred == 0) & (y_true == 0))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    return {
        'accuracy': (tp + tn) / len(y_true),
        'tpr': tp / max(1, tp + fn),
        'fpr': fp / max(1, fp + tn),
        'positive_rate': (tp + fp) / len(y_true),
        'ppv': tp / max(1, tp + fp),
    }

m_a = compute_metrics(qualified_a, pred_a)
m_b = compute_metrics(qualified_b, pred_b)

print("=== Fairness Analysis: Hiring Model ===\\n")
print(f"{'Metric':<25} {'Group A':>10} {'Group B':>10} {'Gap':>10} {'Fair?':>8}")
print("-" * 65)

fairness_checks = []
for name, key in [('Accuracy', 'accuracy'), ('True Positive Rate', 'tpr'),
                   ('False Positive Rate', 'fpr'), ('Positive Rate', 'positive_rate'),
                   ('Precision (PPV)', 'ppv')]:
    gap = abs(m_a[key] - m_b[key])
    fair = gap < 0.1
    fairness_checks.append(fair)
    print(f"{name:<25} {m_a[key]:>10.3f} {m_b[key]:>10.3f} {gap:>10.3f} {'PASS' if fair else 'FAIL':>8}")

print(f"\\n--- Fairness Criteria ---")
print(f"Demographic Parity:  {'PASS' if abs(m_a['positive_rate'] - m_b['positive_rate']) < 0.1 else 'FAIL'}")
print(f"  Group A positive rate: {m_a['positive_rate']:.3f}")
print(f"  Group B positive rate: {m_b['positive_rate']:.3f}")

print(f"\\nEqualized Odds:")
print(f"  TPR gap: {abs(m_a['tpr'] - m_b['tpr']):.3f} {'PASS' if abs(m_a['tpr'] - m_b['tpr']) < 0.1 else 'FAIL'}")
print(f"  FPR gap: {abs(m_a['fpr'] - m_b['fpr']):.3f} {'PASS' if abs(m_a['fpr'] - m_b['fpr']) < 0.1 else 'FAIL'}")

print(f"\\nPredictive Parity:")
print(f"  PPV gap: {abs(m_a['ppv'] - m_b['ppv']):.3f} {'PASS' if abs(m_a['ppv'] - m_b['ppv']) < 0.1 else 'FAIL'}")

# Disparate Impact Ratio (4/5 rule from US law)
di_ratio = m_b['positive_rate'] / max(0.001, m_a['positive_rate'])
print(f"\\nDisparate Impact Ratio: {di_ratio:.3f}")
print(f"  (Legal threshold: >= 0.8, also known as the 4/5 rule)")
print(f"  Status: {'COMPLIANT' if di_ratio >= 0.8 else 'VIOLATION'}")

if not all(fairness_checks):
    print("\\n*** WARNING: Model shows significant bias against Group B ***")
    print("Recommended actions:")
    print("  1. Audit training data for historical bias")
    print("  2. Apply bias mitigation (reweighting, adversarial debiasing)")
    print("  3. Use fairness-aware thresholds per group")
    print("  4. Consider removing or transforming proxy features")
`

const shapCode = `import numpy as np

# SHAP-like feature importance for individual predictions
# Simplified Shapley value approximation using permutation method

np.random.seed(42)

def logistic_predict(features, weights, bias):
    """Simple logistic regression prediction."""
    logit = np.dot(features, weights) + bias
    return 1 / (1 + np.exp(-logit))

def estimate_shap_values(model_fn, instance, background, n_samples=200):
    """
    Estimate SHAP values using the Kernel SHAP approximation.
    For each feature, we measure the average marginal contribution
    across random coalitions of other features.
    """
    n_features = len(instance)
    shap_values = np.zeros(n_features)

    for _ in range(n_samples):
        # Random permutation of features
        perm = np.random.permutation(n_features)
        # Random background sample
        bg = background[np.random.randint(len(background))]

        x_before = bg.copy()
        x_after = bg.copy()

        for idx in perm:
            x_after[idx] = instance[idx]
            pred_with = model_fn(x_after)
            pred_without = model_fn(x_before)
            shap_values[idx] += (pred_with - pred_without)
            x_before[idx] = instance[idx]

    return shap_values / n_samples

# Setup: loan approval model
feature_names = ['Income ($k)', 'Credit Score', 'Years Employed',
                 'Debt-to-Income', 'Loan Amount ($k)', 'Age']

# Model weights (trained weights)
weights = np.array([0.04, 0.008, 0.15, -2.5, -0.01, 0.02])
bias = -4.5

# Background dataset (reference population)
n_bg = 200
background = np.column_stack([
    np.random.normal(60, 20, n_bg),    # Income
    np.random.normal(680, 50, n_bg),    # Credit score
    np.random.exponential(5, n_bg),     # Years employed
    np.random.uniform(0.1, 0.6, n_bg), # Debt ratio
    np.random.normal(150, 80, n_bg),    # Loan amount
    np.random.normal(40, 12, n_bg),     # Age
])

model = lambda x: logistic_predict(x, weights, bias)
base_prediction = np.mean([model(bg) for bg in background])

# Analyze two specific applicants
applicants = [
    np.array([85, 740, 8, 0.22, 200, 35]),   # Strong applicant
    np.array([35, 590, 1, 0.55, 300, 24]),    # Weak applicant
]

for i, applicant in enumerate(applicants):
    pred = model(applicant)
    shap_vals = estimate_shap_values(model, applicant, background, n_samples=500)

    print(f"\\n{'='*60}")
    print(f"Applicant {i+1}: {'APPROVED' if pred >= 0.5 else 'DENIED'} (score: {pred:.3f})")
    print(f"{'='*60}")
    print(f"Base rate (average prediction): {base_prediction:.3f}")
    print(f"\\n{'Feature':<20} {'Value':>10} {'SHAP':>10} {'Direction':>12}")
    print("-" * 55)

    # Sort by absolute SHAP
    order = np.argsort(-np.abs(shap_vals))
    for j in order:
        direction = "higher (+)" if shap_vals[j] > 0 else "lower (-)"
        print(f"{feature_names[j]:<20} {applicant[j]:>10.1f} {shap_vals[j]:>+10.4f} {direction:>12}")

    total_shap = np.sum(shap_vals)
    print(f"\\nSum of SHAP values: {total_shap:+.4f}")
    print(f"Base + SHAP sum:    {base_prediction + total_shap:.3f}")
    print(f"Actual prediction:  {pred:.3f}")
    print(f"(Small difference due to sampling approximation)")

print("\\n--- Interpretation Guide ---")
print("SHAP values show each feature's contribution to THIS specific prediction.")
print("Positive SHAP = pushes prediction toward approval.")
print("Negative SHAP = pushes prediction toward denial.")
print("The sum of all SHAP values equals the difference from the base rate.")
print("\\nThis is crucial for explainability: if a loan is denied, SHAP tells")
print("the applicant exactly which factors drove the decision and by how much.")
`

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function ResponsibleAI() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      {/* ---- Intro ---- */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Responsible AI</h2>
        <p className="mb-3 text-gray-300">
          Machine learning models increasingly make decisions that affect people&apos;s lives &mdash;
          who gets a loan, who gets hired, who gets released on bail, what medical treatment is
          recommended. When these models encode bias or operate as inscrutable black boxes, the
          consequences are real and often fall disproportionately on marginalized groups.
        </p>
        <p className="text-gray-300">
          This is not a theoretical concern. Amazon scrapped an AI recruiting tool that
          systematically downranked women. A healthcare algorithm used by major US hospitals
          gave Black patients lower risk scores than equally sick white patients because it used
          healthcare spending (a proxy for access, not need) as the target variable. Facial
          recognition systems have error rates 10-100x higher for dark-skinned women than
          light-skinned men. Responsible AI is not optional &mdash; it is an engineering requirement.
        </p>
      </section>

      {/* ---- Bias in Data ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Bias in Data Leads to Bias in Models</h2>
        <p className="mb-4 text-gray-300">
          Models learn patterns from data. If the training data reflects historical inequities
          &mdash; fewer examples from certain groups, labels that encode past discrimination,
          features that serve as proxies for protected characteristics &mdash; the model will
          faithfully reproduce and amplify those biases.
        </p>
        <p className="mb-4 text-gray-300">
          The visualization below demonstrates this directly. With an imbalanced dataset, the
          model sees far more examples from Group A, learns Group A&apos;s patterns better, and
          performs worse on Group B. Slide the balance control toward &ldquo;Balanced&rdquo; and
          watch the fairness gap shrink. This is the simplest form of bias &mdash; representation
          bias &mdash; and it is also the most common.
        </p>
        <BiasSketch />
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Sources of Bias in ML</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
            <li><span className="text-purple-400">Representation bias</span>: underrepresented groups in training data</li>
            <li><span className="text-blue-400">Measurement bias</span>: features measured differently across groups (e.g., income proxied by zip code)</li>
            <li><span className="text-green-400">Label bias</span>: historical labels encode past discrimination (e.g., past hiring decisions)</li>
            <li><span className="text-yellow-400">Aggregation bias</span>: single model forced to fit groups with genuinely different patterns</li>
            <li><span className="text-pink-400">Evaluation bias</span>: benchmarks that do not represent all use-case populations</li>
          </ul>
        </div>
      </section>

      {/* ---- Fairness Metrics ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Fairness Metrics</h2>
        <p className="mb-4 text-gray-300">
          &ldquo;Fairness&rdquo; sounds simple, but there are multiple mathematically incompatible
          definitions. Choosing which fairness criterion to optimize is an ethical decision, not a
          technical one, and depends on the specific application context.
        </p>
        <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-indigo-400">Demographic Parity</span> &mdash;
              Each group should receive positive predictions at equal rates, regardless of ground
              truth. Simple but can conflict with accuracy: if base rates genuinely differ, enforcing
              equal rates means accepting more errors.
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Equalized Odds</span> &mdash;
              Each group should have equal true positive and false positive rates. Stronger than
              demographic parity because it conditions on the true label. Used when both types of
              errors matter (e.g., criminal justice).
            </div>
            <div>
              <span className="font-semibold text-green-400">Predictive Parity</span> &mdash;
              When the model says &ldquo;positive,&rdquo; it should be equally correct across
              groups (equal precision). Important when the positive prediction triggers a costly
              action (e.g., further investigation, surgery).
            </div>
          </div>
        </div>
        <p className="mb-4 text-gray-300">
          Toggle between the three criteria below. Notice that the same model can appear fair under
          one criterion and unfair under another. This is not a bug &mdash; Chouldechova (2017) and
          Kleinberg et al. (2016) proved that except in trivial cases, it is mathematically
          impossible to satisfy all fairness criteria simultaneously.
        </p>
        <FairnessMetricsSketch />
      </section>

      {/* ---- Interpretability ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Interpretability vs Accuracy</h2>
        <p className="mb-3 text-gray-300">
          There is a well-known tradeoff between model complexity and interpretability. A linear
          regression is fully transparent &mdash; you can read the coefficients and understand
          exactly why any prediction was made. A deep neural network with millions of parameters
          is effectively a black box. The question is: when does the extra accuracy of a complex
          model justify the loss of interpretability?
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">The Interpretability Spectrum</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-center gap-3">
              <span className="inline-block w-28 rounded bg-green-500/20 px-2 py-1 text-center text-xs font-bold text-green-400">
                High
              </span>
              <span>
                <span className="font-semibold text-white">Linear models, decision rules, small trees</span> &mdash;
                coefficients directly map to feature importance. Required in regulated industries
                (finance, healthcare) where decisions must be explainable.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block w-28 rounded bg-yellow-500/20 px-2 py-1 text-center text-xs font-bold text-yellow-400">
                Medium
              </span>
              <span>
                <span className="font-semibold text-white">GAMs, attention-based models, ensemble + SHAP</span> &mdash;
                not inherently interpretable, but can be explained with post-hoc methods. Good
                balance for many applications.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block w-28 rounded bg-red-500/20 px-2 py-1 text-center text-xs font-bold text-red-400">
                Low
              </span>
              <span>
                <span className="font-semibold text-white">Deep networks, large ensembles, LLMs</span> &mdash;
                maximum expressiveness but minimal inherent interpretability. Post-hoc explanations
                (SHAP, LIME, attention maps) approximate what is happening but may not capture the
                full picture.
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-gray-300">
          The key insight: in many domains, interpretable models perform nearly as well as black-box
          models. Cynthia Rudin&apos;s research demonstrates that for structured/tabular data, the
          accuracy gap is often negligible. Before reaching for a complex model, try the simple one
          first &mdash; you might not need to sacrifice interpretability at all.
        </p>
      </section>

      {/* ---- SHAP ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">SHAP & Feature Attribution</h2>
        <p className="mb-4 text-gray-300">
          SHAP (SHapley Additive exPlanations) is based on Shapley values from cooperative game
          theory. The idea: each feature is a &ldquo;player&rdquo; in a coalition game, and its
          SHAP value is its average marginal contribution to the prediction across all possible
          feature orderings. This is the only method that satisfies three desirable properties:
          local accuracy, missingness, and consistency.
        </p>
        <p className="mb-4 text-gray-300">
          The visualization below shows SHAP values for individual loan decisions. Each bar
          represents one feature&apos;s contribution: green bars push the prediction toward
          approval, pink bars push toward denial. Click between examples to see how the same
          features can have very different impacts for different applicants.
        </p>
        <SHAPSketch />
        <p className="mt-4 text-gray-300">
          SHAP gives local explanations &mdash; why this specific prediction was made for this
          specific input. Aggregating SHAP values across many predictions gives global feature
          importance. This dual capability makes SHAP the most widely used interpretability method
          in industry.
        </p>
      </section>

      {/* ---- Privacy & Security ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Privacy & Security</h2>
        <p className="mb-3 text-gray-300">
          Models can leak information about their training data in subtle ways. This creates real
          privacy and security risks, especially when models are trained on sensitive data.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-purple-400">Differential Privacy</span> &mdash;
              Add carefully calibrated noise to training so that no single data point significantly
              influences the model. Formal guarantee: an adversary cannot determine whether any
              specific individual was in the training set. Used by Apple, Google, and the US Census.
              Cost: some accuracy loss proportional to the privacy budget (epsilon).
            </div>
            <div>
              <span className="font-semibold text-blue-400">Model Inversion Attacks</span> &mdash;
              Given a model&apos;s predictions, an attacker can partially reconstruct training
              data. Demonstrated on facial recognition (reconstructing faces from prediction scores)
              and medical models (inferring diagnoses). Mitigated by limiting prediction precision
              and access frequency.
            </div>
            <div>
              <span className="font-semibold text-red-400">Adversarial Examples</span> &mdash;
              Tiny, imperceptible input perturbations that cause wild misclassification. A stop
              sign with a few stickers that a neural network reads as a speed limit sign. Not just
              an academic curiosity &mdash; a real security concern for any model that processes
              untrusted inputs.
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Membership Inference</span> &mdash;
              Determining whether a specific data point was used in training. Models tend to be more
              confident on training data, which leaks membership information. Particularly concerning
              for medical and financial models.
            </div>
          </div>
        </div>
      </section>

      {/* ---- Checklist ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Responsible AI Checklist</h2>
        <p className="mb-4 text-gray-300">
          Responsible AI is not a one-time checkbox &mdash; it is a continuous practice throughout
          the ML lifecycle. Here is a practical checklist organized by project phase.
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-indigo-400">1. Data Collection & Preparation</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Audit dataset for representation across demographic groups</li>
              <li>Document data sources, collection methodology, and known limitations</li>
              <li>Check labels for historical bias (e.g., past decisions that were unfair)</li>
              <li>Identify proxy features that correlate with protected attributes</li>
              <li>Apply appropriate privacy protections (anonymization, differential privacy)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-yellow-400">2. Model Development</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Evaluate accuracy on each subgroup, not just overall</li>
              <li>Compute multiple fairness metrics and document the chosen criterion</li>
              <li>Consider fairness-accuracy tradeoffs explicitly with stakeholders</li>
              <li>Start with interpretable models; justify complexity with real gains</li>
              <li>Run adversarial testing to identify failure modes</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-green-400">3. Deployment & Monitoring</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Create a model card documenting intended use, limitations, and ethical considerations</li>
              <li>Monitor fairness metrics in production continuously, not just at launch</li>
              <li>Provide recourse: if someone is affected by a decision, they should understand why and how to appeal</li>
              <li>Implement human-in-the-loop for high-stakes decisions</li>
              <li>Plan for regular audits and retraining as distributions shift</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Python: Fairness Metrics ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Hands-On: Computing Fairness Metrics</h2>
        <p className="mb-4 text-gray-300">
          The code below simulates a hiring model and computes a full suite of fairness metrics.
          Notice how the biased model passes some criteria but fails others. It also computes
          the disparate impact ratio used in US employment law &mdash; the &ldquo;4/5 rule&rdquo;
          that flags selection rates below 80% of the majority group.
        </p>
        <PythonCell defaultCode={fairnessCode} />
      </section>

      {/* ---- Python: SHAP ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Hands-On: SHAP-Style Feature Attribution</h2>
        <p className="mb-4 text-gray-300">
          This code implements a simplified Shapley value estimator using the permutation method.
          It explains individual loan predictions by decomposing the model output into per-feature
          contributions. Run it to see exactly which features drive approval or denial for each
          applicant.
        </p>
        <PythonCell defaultCode={shapCode} />
      </section>

      {/* ---- Summary ---- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-white">Key Takeaways</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <ul className="list-disc space-y-2 pl-5 text-gray-300">
            <li>
              <span className="font-semibold text-white">Bias is a data problem first</span>:
              models learn from data. If the data is biased, the model will be biased. Fixing
              the algorithm is not enough &mdash; you must fix the data.
            </li>
            <li>
              <span className="font-semibold text-white">Fairness is not a single metric</span>:
              multiple mathematically incompatible definitions exist. The choice depends on context
              and stakeholder values.
            </li>
            <li>
              <span className="font-semibold text-white">Interpretability is often achievable</span>:
              for tabular data, simple models often match complex ones. When complexity is needed,
              SHAP provides principled explanations.
            </li>
            <li>
              <span className="font-semibold text-white">Privacy is an engineering requirement</span>:
              models can leak training data. Differential privacy and access controls are not optional
              for sensitive applications.
            </li>
            <li>
              <span className="font-semibold text-white">Responsible AI is continuous</span>:
              audit before deployment, monitor after deployment, and plan for regular reassessment
              as the world changes.
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
