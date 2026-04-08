import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'classical/logistic-regression',
  title: 'Logistic Regression',
  description: 'Classification with the sigmoid function, decision boundaries, cross-entropy loss, and multi-class extension',
  track: 'classical',
  order: 3,
  tags: ['classification', 'logistic', 'sigmoid', 'cross-entropy', 'decision-boundary'],
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

function sigmoid(z: number): number {
  if (z > 500) return 1
  if (z < -500) return 0
  return 1 / (1 + Math.exp(-z))
}

/* ------------------------------------------------------------------ */
/* Section 1 — Interactive Sigmoid Curve                               */
/* ------------------------------------------------------------------ */

function SigmoidSketch() {
  const [steepness, setSteepness] = useState(1)
  const [bias, setBias] = useState(0)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 380

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const margin = 50
        const plotW = p.width - margin * 2
        const plotH = canvasH - margin * 2
        const xMin = -8, xMax = 8
        const yMin = -0.1, yMax = 1.1

        const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * plotW
        const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * plotH

        // Grid
        p.stroke(30, 41, 59)
        p.strokeWeight(1)
        for (let x = -8; x <= 8; x += 2) p.line(mapX(x), margin, mapX(x), canvasH - margin)
        for (let y = 0; y <= 1; y += 0.25) p.line(margin, mapY(y), p.width - margin, mapY(y))

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1.5)
        p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Axis labels
        p.noStroke()
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        for (let x = -8; x <= 8; x += 2) {
          p.text(String(x), mapX(x), canvasH - margin + 5)
        }
        p.textAlign(p.RIGHT, p.CENTER)
        for (let y = 0; y <= 1; y += 0.25) {
          p.text(y.toFixed(2), margin - 5, mapY(y))
        }

        // Threshold lines at 0.5
        p.stroke(250, 204, 21, 60)
        p.strokeWeight(1)
        p.line(margin, mapY(0.5), p.width - margin, mapY(0.5))

        // The sigmoid curve
        p.stroke(236, 72, 153)
        p.strokeWeight(3)
        p.noFill()
        p.beginShape()
        const steps = 300
        for (let i = 0; i <= steps; i++) {
          const z = xMin + (i / steps) * (xMax - xMin)
          const val = sigmoid(steepness * (z - bias))
          p.vertex(mapX(z), mapY(val))
        }
        p.endShape()

        // Decision boundary vertical line
        p.stroke(99, 102, 241, 100)
        p.strokeWeight(2)
        p.line(mapX(bias), margin, mapX(bias), canvasH - margin)

        // Labels
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('The Sigmoid Function', p.width / 2, 10)

        // Color zones
        p.fill(244, 63, 94, 15)
        p.noStroke()
        p.rect(margin, margin, mapX(bias) - margin, plotH)
        p.fill(52, 211, 153, 15)
        p.rect(mapX(bias), margin, p.width - margin - mapX(bias), plotH)

        // Zone labels
        p.textSize(12)
        p.textAlign(p.CENTER, p.CENTER)
        p.fill(244, 63, 94, 120)
        p.text('Class 0', (margin + mapX(bias)) / 2, mapY(0.9))
        p.fill(52, 211, 153, 120)
        p.text('Class 1', (mapX(bias) + p.width - margin) / 2, mapY(0.9))

        // Formula
        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text(`sigma(z) = 1 / (1 + e^(-z))`, margin + 5, canvasH - margin - 5)
        p.text(`z = ${steepness.toFixed(1)} * (x - ${bias.toFixed(1)})`, margin + 5, canvasH - margin - 20)

        // Mouse hover info
        if (p.mouseX >= margin && p.mouseX <= p.width - margin && p.mouseY >= margin && p.mouseY <= canvasH - margin) {
          const hoverZ = xMin + ((p.mouseX - margin) / plotW) * (xMax - xMin)
          const hoverY = sigmoid(steepness * (hoverZ - bias))
          p.fill(226, 232, 240)
          p.noStroke()
          p.ellipse(mapX(hoverZ), mapY(hoverY), 8, 8)
          p.textSize(10)
          p.textAlign(p.LEFT, p.BOTTOM)
          p.text(`z=${hoverZ.toFixed(1)}, p=${hoverY.toFixed(3)}`, mapX(hoverZ) + 10, mapY(hoverY) - 5)
        }
      }
    },
    [steepness, bias],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={380}
      controls={
        <div className="flex flex-col gap-2 mt-2 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Steepness:
            <input
              type="range" min={0.1} max={5} step={0.1} value={steepness}
              onChange={(e) => setSteepness(parseFloat(e.target.value))}
              className="w-40 accent-pink-500"
            />
            <span className="w-12 font-mono">{steepness.toFixed(1)}</span>
          </label>
          <label className="flex items-center gap-2">
            Bias (shift):
            <input
              type="range" min={-4} max={4} step={0.1} value={bias}
              onChange={(e) => setBias(parseFloat(e.target.value))}
              className="w-40 accent-indigo-500"
            />
            <span className="w-12 font-mono">{bias.toFixed(1)}</span>
          </label>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Section 2 — 2D Decision Boundary                                    */
/* ------------------------------------------------------------------ */

function DecisionBoundarySketch() {
  const [w1, setW1] = useState(1.5)
  const [w2, setW2] = useState(1.0)
  const [b, setB] = useState(0)

  const pointsRef = useRef<{ x: number; y: number; label: 0 | 1 }[]>([])
  const initRef = useRef(false)

  const sketch = useCallback(
    (p: p5) => {
      const canvasH = 440
      const pts = pointsRef.current

      p.setup = () => {
        const parent = (p as unknown as Record<string, HTMLElement>)._userNode
        const pw = parent ? parent.clientWidth : 700
        p.createCanvas(pw, canvasH)

        if (!initRef.current) {
          initRef.current = true
          const rng = makeRng(42)
          // Class 0: centered around (-1, -1)
          for (let i = 0; i < 25; i++) {
            pts.push({
              x: -1.2 + randn(rng) * 0.8,
              y: -1.0 + randn(rng) * 0.8,
              label: 0,
            })
          }
          // Class 1: centered around (1.2, 1)
          for (let i = 0; i < 25; i++) {
            pts.push({
              x: 1.2 + randn(rng) * 0.8,
              y: 1.0 + randn(rng) * 0.8,
              label: 1,
            })
          }
        }
      }

      p.draw = () => {
        p.background(15, 23, 42)

        const margin = 50
        const plotW = p.width - margin * 2
        const plotH = canvasH - margin * 2
        const xMin = -4, xMax = 4
        const yMin = -4, yMax = 4

        const mapX = (v: number) => margin + ((v - xMin) / (xMax - xMin)) * plotW
        const mapY = (v: number) => canvasH - margin - ((v - yMin) / (yMax - yMin)) * plotH

        // Probability heatmap
        const cellSize = 8
        for (let px = margin; px < p.width - margin; px += cellSize) {
          for (let py = margin; py < canvasH - margin; py += cellSize) {
            const vx = xMin + ((px - margin) / plotW) * (xMax - xMin)
            const vy = yMax - ((py - margin) / plotH) * (yMax - yMin)
            const z = w1 * vx + w2 * vy + b
            const prob = sigmoid(z)
            // Blend from rose to emerald
            const r = Math.round(244 * (1 - prob) + 52 * prob)
            const g = Math.round(63 * (1 - prob) + 211 * prob)
            const bl = Math.round(94 * (1 - prob) + 153 * prob)
            p.noStroke()
            p.fill(r, g, bl, 35)
            p.rect(px, py, cellSize, cellSize)
          }
        }

        // Decision boundary line: w1*x + w2*y + b = 0 => y = -(w1*x + b) / w2
        if (Math.abs(w2) > 0.01) {
          p.stroke(250, 204, 21)
          p.strokeWeight(2.5)
          const bx1 = xMin
          const by1 = -(w1 * bx1 + b) / w2
          const bx2 = xMax
          const by2 = -(w1 * bx2 + b) / w2
          p.line(mapX(bx1), mapY(by1), mapX(bx2), mapY(by2))
        } else {
          // Vertical boundary
          const bx = -b / (w1 || 0.01)
          p.stroke(250, 204, 21)
          p.strokeWeight(2.5)
          p.line(mapX(bx), margin, mapX(bx), canvasH - margin)
        }

        // Data points
        let correct = 0
        for (const pt of pts) {
          const z = w1 * pt.x + w2 * pt.y + b
          const pred = z >= 0 ? 1 : 0
          if (pred === pt.label) correct++

          p.noStroke()
          if (pt.label === 0) {
            p.fill(244, 63, 94)
            p.ellipse(mapX(pt.x), mapY(pt.y), 10, 10)
          } else {
            p.fill(52, 211, 153)
            p.ellipse(mapX(pt.x), mapY(pt.y), 10, 10)
          }

          // Misclassified: add ring
          if (pred !== pt.label) {
            p.stroke(250, 204, 21)
            p.strokeWeight(2)
            p.noFill()
            p.ellipse(mapX(pt.x), mapY(pt.y), 16, 16)
          }
        }

        const accuracy = pts.length > 0 ? (correct / pts.length) * 100 : 0

        // Axes
        p.stroke(51, 65, 85)
        p.strokeWeight(1)
        p.line(margin, canvasH - margin, p.width - margin, canvasH - margin)
        p.line(margin, margin, margin, canvasH - margin)

        // Labels
        p.noStroke()
        p.fill(226, 232, 240)
        p.textSize(14)
        p.textAlign(p.CENTER, p.TOP)
        p.text('2D Decision Boundary', p.width / 2, 8)

        p.fill(148, 163, 184)
        p.textSize(11)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Accuracy: ${accuracy.toFixed(1)}%  (${correct}/${pts.length})`, margin + 5, margin + 5)
        p.text(`Boundary: ${w1.toFixed(1)}*x1 + ${w2.toFixed(1)}*x2 + ${b.toFixed(1)} = 0`, margin + 5, margin + 20)

        // Legend
        p.fill(244, 63, 94)
        p.ellipse(p.width - margin - 80, margin + 12, 8, 8)
        p.fill(148, 163, 184)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Class 0', p.width - margin - 72, margin + 12)

        p.fill(52, 211, 153)
        p.ellipse(p.width - margin - 80, margin + 28, 8, 8)
        p.fill(148, 163, 184)
        p.text('Class 1', p.width - margin - 72, margin + 28)

        p.stroke(250, 204, 21)
        p.strokeWeight(2)
        p.noFill()
        p.ellipse(p.width - margin - 80, margin + 44, 10, 10)
        p.fill(148, 163, 184)
        p.noStroke()
        p.text('Misclassified', p.width - margin - 72, margin + 44)
      }
    },
    [w1, w2, b],
  )

  return (
    <P5Sketch
      sketch={sketch}
      height={440}
      controls={
        <div className="flex flex-col gap-2 mt-2 text-sm text-gray-300">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              w1:
              <input
                type="range" min={-3} max={3} step={0.1} value={w1}
                onChange={(e) => setW1(parseFloat(e.target.value))}
                className="w-32 accent-pink-500"
              />
              <span className="w-10 font-mono">{w1.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-2">
              w2:
              <input
                type="range" min={-3} max={3} step={0.1} value={w2}
                onChange={(e) => setW2(parseFloat(e.target.value))}
                className="w-32 accent-emerald-500"
              />
              <span className="w-10 font-mono">{w2.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-2">
              bias:
              <input
                type="range" min={-3} max={3} step={0.1} value={b}
                onChange={(e) => setB(parseFloat(e.target.value))}
                className="w-32 accent-yellow-500"
              />
              <span className="w-10 font-mono">{b.toFixed(1)}</span>
            </label>
          </div>
        </div>
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* Python Cells                                                        */
/* ------------------------------------------------------------------ */

const logregScratchCode = `import numpy as np

# === Logistic Regression from Scratch ===

np.random.seed(42)

# Generate 2-class data
n = 100
X0 = np.random.randn(n // 2, 2) + np.array([-1, -1])
X1 = np.random.randn(n // 2, 2) + np.array([1.5, 1])
X = np.vstack([X0, X1])
y = np.array([0] * (n // 2) + [1] * (n // 2), dtype=float)

# Shuffle
idx = np.random.permutation(n)
X, y = X[idx], y[idx]

# Sigmoid function
def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

# Initialize weights
w = np.zeros(2)
b = 0.0
lr = 0.1

# Training loop
print("Gradient Descent Training:")
print(f"{'Epoch':>5} | {'Loss':>8} | {'Accuracy':>8}")
print("-" * 30)

for epoch in range(201):
    # Forward pass
    z = X @ w + b
    y_hat = sigmoid(z)

    # Cross-entropy loss
    eps = 1e-8
    loss = -np.mean(y * np.log(y_hat + eps) + (1 - y) * np.log(1 - y_hat + eps))

    # Accuracy
    preds = (y_hat >= 0.5).astype(float)
    acc = np.mean(preds == y) * 100

    if epoch % 40 == 0:
        print(f"{epoch:5d} | {loss:8.4f} | {acc:7.1f}%")

    # Backward pass (gradients)
    dz = y_hat - y                      # (n,)
    dw = (1 / n) * (X.T @ dz)           # (2,)
    db = (1 / n) * np.sum(dz)           # scalar

    # Update
    w -= lr * dw
    b -= lr * db

print()
print(f"Final weights: w1={w[0]:.3f}, w2={w[1]:.3f}, bias={b:.3f}")
print(f"Decision boundary: {w[0]:.2f}*x1 + {w[1]:.2f}*x2 + {b:.2f} = 0")
`

const logregSklearnCode = `import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Generate 2-class data
np.random.seed(42)
n = 200
X0 = np.random.randn(n // 2, 2) + np.array([-1.0, -0.8])
X1 = np.random.randn(n // 2, 2) + np.array([1.2, 1.0])
X = np.vstack([X0, X1])
y = np.array([0] * (n // 2) + [1] * (n // 2))

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

# Fit logistic regression
model = LogisticRegression()
model.fit(X_train, y_train)

# Predictions
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)

print("=== Logistic Regression with scikit-learn ===")
print()
print(f"Train accuracy: {accuracy_score(y_train, model.predict(X_train)):.1%}")
print(f"Test accuracy:  {accuracy_score(y_test, y_pred):.1%}")
print()
print(f"Coefficients: w1={model.coef_[0][0]:.3f}, w2={model.coef_[0][1]:.3f}")
print(f"Intercept:    b={model.intercept_[0]:.3f}")
print()
print("Sample predictions with probabilities:")
print(f"{'x1':>6} {'x2':>6} | {'P(0)':>6} {'P(1)':>6} | {'Pred':>4} {'True':>4}")
print("-" * 48)
for i in range(min(8, len(X_test))):
    print(f"{X_test[i,0]:6.2f} {X_test[i,1]:6.2f} | "
          f"{y_prob[i,0]:6.3f} {y_prob[i,1]:6.3f} | "
          f"{y_pred[i]:4d} {y_test[i]:4d}")

print()
print("Classification Report:")
print(classification_report(y_test, y_pred, target_names=["Class 0", "Class 1"]))
`

/* ------------------------------------------------------------------ */
/* Main Lesson Component                                               */
/* ------------------------------------------------------------------ */

export default function LogisticRegression() {
  return (
    <article className="mx-auto max-w-4xl space-y-16 px-4 py-10 text-gray-300">
      {/* ========== Section 1: From Regression to Classification ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">From Regression to Classification</h2>

        <p className="mb-4">
          So far we have predicted continuous values: house prices, temperatures, test scores. But many
          real-world problems ask a different question: <em>which category does this belong to?</em>
          Is this email spam or not? Does this patient have a disease? Will a customer churn?
        </p>

        <p className="mb-4">
          These are <strong className="text-white">classification</strong> problems. The output is not a
          number but a category (or class). The simplest case is <strong className="text-white">binary
          classification</strong>: two classes, often labeled 0 and 1.
        </p>

        <p className="mb-4">
          You might think: &ldquo;Just use linear regression and round the output.&rdquo; If the prediction
          is above 0.5, predict class 1; otherwise, predict class 0. This actually works sometimes, but it
          has serious problems. Linear regression can output values far below 0 or far above 1, which makes
          no sense as probabilities. And the least-squares loss function is not well suited for classification
          — it penalizes confident correct predictions that happen to be far from 0 or 1.
        </p>

        <p className="mb-4">
          <strong className="text-white">Logistic regression</strong> solves these problems elegantly. Despite
          its name, it is a classification algorithm. It wraps the linear function inside a
          <strong className="text-white"> sigmoid</strong> (logistic) function that squashes any real number
          into the range (0, 1), giving us a proper probability.
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            P(y=1 | x) = sigmoid(w*x + b) = 1 / (1 + e^(-(w*x + b)))
          </code>
        </div>
      </section>

      {/* ========== Section 2: The Sigmoid Function ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Sigmoid Function</h2>

        <p className="mb-4">
          The sigmoid function is the heart of logistic regression. It takes any real number and maps it to
          a value between 0 and 1. Negative inputs produce values close to 0. Positive inputs produce values
          close to 1. The transition happens smoothly around zero.
        </p>

        <p className="mb-4">
          In the visualization below, adjust the <strong className="text-white">steepness</strong> to see
          how it controls the sharpness of the transition. A steep sigmoid acts almost like a step function,
          while a gentle one transitions slowly. The <strong className="text-white">bias</strong> shifts the
          curve left or right, moving where the decision threshold falls. Hover over the curve to see exact
          probability values.
        </p>

        <SigmoidSketch />

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Why Sigmoid?</h3>

        <p className="mb-4">
          The sigmoid has several elegant properties that make it perfect for classification:
        </p>

        <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
          <li>
            <strong className="text-white">Output is always between 0 and 1</strong> — we can interpret it
            directly as a probability.
          </li>
          <li>
            <strong className="text-white">Smooth and differentiable</strong> — we can use gradient descent
            to learn the weights.
          </li>
          <li>
            <strong className="text-white">Simple derivative</strong>: sigmoid&apos;(z) = sigmoid(z) * (1 - sigmoid(z)).
            This makes gradient computation very efficient.
          </li>
          <li>
            <strong className="text-white">Connected to odds</strong>: the inverse sigmoid (logit) gives
            log-odds, which has a natural probabilistic interpretation.
          </li>
        </ul>
      </section>

      {/* ========== Section 3: Decision Boundary ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">The Decision Boundary</h2>

        <p className="mb-4">
          With two input features, logistic regression draws a <strong className="text-white">linear
          decision boundary</strong> — a straight line that separates the two classes in 2D space. On
          one side of the line, the model predicts class 0; on the other side, class 1.
        </p>

        <p className="mb-4">
          The boundary is defined by the equation <code className="text-emerald-400">w1*x1 + w2*x2 + b = 0
          </code>. Points where this expression is positive get classified as class 1 (the model assigns
          probability greater than 0.5). Points where it is negative get classified as class 0.
        </p>

        <p className="mb-4">
          In the visualization below, the background color shows the probability gradient — darker rose for
          strong class-0 predictions, darker green for strong class-1 predictions. The yellow line is the
          decision boundary. Points with yellow rings are misclassified. Adjust the weights and bias to
          maximize accuracy.
        </p>

        <DecisionBoundarySketch />

        <p className="mt-4">
          Notice that logistic regression can only draw a straight boundary. If the classes are arranged in
          a pattern that requires a curved boundary (like one class surrounding the other), logistic
          regression will struggle. This is a fundamental limitation — and one motivation for learning about
          neural networks, which can learn nonlinear boundaries.
        </p>
      </section>

      {/* ========== Section 4: Cross-Entropy Loss ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Cross-Entropy Loss</h2>

        <p className="mb-4">
          In linear regression, we minimized Mean Squared Error. For classification, we need a different loss
          function. MSE has an issue here: if the true label is 1 and the model predicts 0.99, the gradient
          is tiny (nearly zero). But if the model predicts 0.01, the gradient is also relatively small
          compared to what we want. MSE does not create strong enough gradients for wrong predictions.
        </p>

        <p className="mb-4">
          <strong className="text-white">Cross-entropy loss</strong> (also called log loss) fixes this by
          applying a logarithm:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center space-y-2">
          <code className="text-lg text-emerald-400">
            L = -(1/n) * sum[ y_i * log(p_i) + (1 - y_i) * log(1 - p_i) ]
          </code>
        </div>

        <p className="mb-4">
          Let us build intuition for why this works. Consider a single data point:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="font-semibold text-emerald-400 mb-2">When y = 1 (true class is 1)</h3>
            <p className="text-sm mb-2">
              Loss = <code className="text-emerald-400">-log(p)</code>
            </p>
            <p className="text-sm">
              If p is close to 1 (correct), -log(1) is near 0 — low loss. If p is close to 0 (very wrong),
              -log(0) approaches infinity — enormous loss. The logarithm creates a huge penalty for
              confident wrong predictions.
            </p>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <h3 className="font-semibold text-rose-400 mb-2">When y = 0 (true class is 0)</h3>
            <p className="text-sm mb-2">
              Loss = <code className="text-rose-400">-log(1 - p)</code>
            </p>
            <p className="text-sm">
              If p is close to 0 (correct), -log(1) is near 0 — low loss. If p is close to 1 (very wrong),
              -log(0) approaches infinity. Same principle: confident wrong answers are harshly penalized.
            </p>
          </div>
        </div>

        <h3 className="mt-8 mb-3 text-xl font-semibold text-white">Gradient Descent for Logistic Regression</h3>

        <p className="mb-4">
          The gradient of cross-entropy loss with respect to the weights turns out to be remarkably elegant:
        </p>

        <div className="my-4 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 font-mono text-sm space-y-2">
          <p className="text-emerald-400">dL/dw = (1/n) * sum((sigmoid(w*x_i + b) - y_i) * x_i)</p>
          <p className="text-emerald-400">dL/db = (1/n) * sum(sigmoid(w*x_i + b) - y_i)</p>
          <p className="text-gray-400 mt-3">This is identical in form to linear regression gradients!</p>
          <p className="text-gray-400">The only difference: y_hat is sigmoid(w*x + b) instead of w*x + b.</p>
        </div>

        <p className="mb-4">
          This beautiful simplicity is not a coincidence. It arises because the sigmoid is the
          &ldquo;canonical link function&rdquo; for Bernoulli-distributed outcomes — a deep result
          from the theory of generalized linear models.
        </p>
      </section>

      {/* ========== Section 5: Multi-Class Extension ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Multi-Class Classification</h2>

        <p className="mb-4">
          Binary classification handles two classes, but many problems have more. Handwritten digit recognition
          has 10 classes (0-9). Image classification might have thousands. How do we extend logistic regression?
        </p>

        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">One-vs-Rest (OvR)</h3>

        <p className="mb-4">
          The simplest approach: train K separate binary classifiers, one for each class. Classifier k learns
          to distinguish &ldquo;is it class k or not?&rdquo; At prediction time, run all K classifiers and
          pick the one with the highest probability. This works but can produce inconsistent probabilities
          (they may not sum to 1).
        </p>

        <h3 className="mt-6 mb-3 text-xl font-semibold text-white">Softmax Regression</h3>

        <p className="mb-4">
          The more principled approach is <strong className="text-white">softmax regression</strong>
          (multinomial logistic regression). Instead of one weight vector, we have K weight vectors — one
          per class. For each class k, we compute a score:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-pink-400">
            z_k = w_k * x + b_k
          </code>
        </div>

        <p className="mb-4">
          Then the <strong className="text-white">softmax function</strong> converts these scores into
          probabilities that sum to 1:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-emerald-400">
            P(y=k | x) = exp(z_k) / sum_j(exp(z_j))
          </code>
        </div>

        <p className="mb-4">
          Softmax is a generalization of the sigmoid. With K=2 classes, softmax reduces exactly to the
          sigmoid function. The loss generalizes to <strong className="text-white">categorical
          cross-entropy</strong>:
        </p>

        <div className="my-6 rounded-lg bg-gray-800/60 border border-gray-700 px-6 py-4 text-center">
          <code className="text-lg text-yellow-400">
            L = -(1/n) * sum_i[ sum_k( y_ik * log(p_ik) ) ]
          </code>
        </div>

        <p className="mb-4">
          Where y_ik is 1 if sample i belongs to class k, and 0 otherwise (one-hot encoding).
          Softmax regression is the foundation of the output layer in neural network classifiers —
          you will encounter it repeatedly in the deep learning modules.
        </p>
      </section>

      {/* ========== Section 6: Python — From Scratch ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Logistic Regression from Scratch</h2>

        <p className="mb-4">
          Let us implement logistic regression with gradient descent using only NumPy. We will generate
          two-class data, implement the sigmoid function and cross-entropy loss, and watch the model
          learn to separate the classes.
        </p>

        <PythonCell defaultCode={logregScratchCode} title="Logistic Regression — From Scratch with NumPy" />

        <p className="mt-4">
          Study the gradient computation carefully. The key line is <code className="text-emerald-400">
          dz = y_hat - y</code> — the difference between the predicted probability and the true label.
          This error signal is then used to compute the gradient for each weight. The simplicity of this
          gradient is what makes logistic regression so elegant and efficient.
        </p>
      </section>

      {/* ========== Section 7: Python — scikit-learn ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Python: Logistic Regression with scikit-learn</h2>

        <p className="mb-4">
          In practice, you will use a library like scikit-learn rather than coding gradient descent by hand.
          Let us see how much simpler the code becomes while also getting access to useful features like
          probability estimates and classification reports.
        </p>

        <PythonCell defaultCode={logregSklearnCode} title="scikit-learn — LogisticRegression" />

        <p className="mt-4">
          Compare the learned coefficients from scikit-learn with our from-scratch implementation. They
          should be similar (not identical, because sklearn uses slightly different optimization and adds
          L2 regularization by default). Notice how <code className="text-emerald-400">predict_proba</code>
          gives us the probability for each class — this is more informative than just the class label,
          because it tells us how confident the model is.
        </p>
      </section>

      {/* ========== Section 8: Key Takeaways ========== */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-white">Key Takeaways</h2>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Sigmoid maps linear output to probability</h3>
            <p className="text-sm">
              Logistic regression is a linear model wrapped in a sigmoid. The output is a probability
              between 0 and 1, making it directly interpretable.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Linear decision boundaries</h3>
            <p className="text-sm">
              In 2D, the decision boundary is a straight line. In higher dimensions, it is a hyperplane.
              This is a strength (simplicity, interpretability) and a limitation (cannot capture nonlinear
              patterns without feature engineering).
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Cross-entropy is the right loss for classification</h3>
            <p className="text-sm">
              Cross-entropy creates strong gradients for confident wrong predictions, making training
              efficient. It is the standard loss for classification tasks at every scale, from logistic
              regression to large language models.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
            <h3 className="font-semibold text-white mb-1">Softmax generalizes to multiple classes</h3>
            <p className="text-sm">
              For K classes, softmax regression assigns a probability to each class. The probabilities
              sum to 1. This is the foundation of the output layer in modern neural network classifiers.
            </p>
          </div>
        </div>
      </section>
    </article>
  )
}
