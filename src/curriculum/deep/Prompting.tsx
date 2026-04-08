import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/prompting',
  title: 'Prompting & In-Context Learning',
  description: 'Master the art and science of prompting: zero-shot, few-shot, chain-of-thought, RAG, tool use, and the emerging paradigm of in-context learning',
  track: 'deep',
  order: 10,
  tags: ['prompting', 'few-shot', 'chain-of-thought', 'rag', 'in-context-learning', 'tool-use', 'agents'],
}

/* ================================================================== */
/*  Section 1 -- In-Context Learning                                   */
/* ================================================================== */
function InContextLearningSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">In-Context Learning: A Surprising Capability</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the most remarkable discoveries about large language models is <strong className="text-white">
        in-context learning (ICL)</strong>: the ability to learn new tasks from just a few examples
        provided in the prompt, without any gradient updates or weight changes. You simply show the
        model a few input-output pairs, then give it a new input, and it produces the correct output.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This was not explicitly trained for. GPT-3 was trained purely on next-token prediction, yet
        it spontaneously developed the ability to "learn" from examples at inference time. The model
        uses the examples as context to infer the task, the format, and the expected behavior -- all
        through the attention mechanism processing the concatenated prompt. No weights change. The
        same model with the same parameters can be a translator, a classifier, a summarizer, or a
        code generator, just by changing the prompt.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This unlocked an entirely new paradigm of AI interaction: instead of fine-tuning a model for
        each task, we <strong className="text-white">prompt</strong> a single model with task descriptions
        and examples. Prompt engineering has become a crucial skill -- the way you frame a task to the
        model can dramatically affect performance.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Zero-Shot Prompting (p5)                              */
/* ================================================================== */
function ZeroShotSection() {
  const [taskIdx, setTaskIdx] = useState(0)
  const taskRef = useRef(taskIdx)
  taskRef.current = taskIdx

  const tasks = [
    {
      name: 'Classification',
      promptBad: 'The movie was absolutely wonderful.\nPositive or negative?',
      outputBad: 'Positive or negative what? I can tell you about movies...',
      promptGood: 'Classify the following movie review as Positive or Negative.\n\nReview: "The movie was absolutely wonderful."\nSentiment:',
      outputGood: 'Positive',
    },
    {
      name: 'Translation',
      promptBad: 'Hello, how are you? In French.',
      outputBad: 'Hello is a greeting commonly used in English-speaking...',
      promptGood: 'Translate the following English text to French.\n\nEnglish: "Hello, how are you?"\nFrench:',
      outputGood: '"Bonjour, comment allez-vous?"',
    },
    {
      name: 'Summarization',
      promptBad: 'Climate change is causing rising seas and extreme weather. Summarize.',
      outputBad: 'Climate change is a topic that has been discussed by many scientists and politicians...',
      promptGood: 'Summarize the following text in one sentence.\n\nText: "Climate change is causing rising sea levels and more extreme weather events worldwide."\nSummary:',
      outputGood: 'Rising seas and extreme weather are key impacts of global climate change.',
    },
    {
      name: 'Code Generation',
      promptBad: 'fibonacci',
      outputBad: 'Fibonacci was an Italian mathematician born in 1170...',
      promptGood: 'Write a Python function that returns the nth Fibonacci number.\n\n```python\ndef fibonacci(n):',
      outputGood: '    if n <= 1: return n\n    a, b = 0, 1\n    for _ in range(2, n+1):\n        a, b = b, a+b\n    return b',
    },
  ]

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const ti = taskRef.current
      const task = tasks[ti]
      p.background(15, 15, 25)
      const w = p.width
      const halfW = (w - 60) / 2

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Zero-Shot Prompting: ${task.name}`, 20, 10)

      // Wrap helper
      const wrapText = (text: string, x: number, y: number, maxW: number, size: number): number => {
        p.textSize(size)
        const words = text.split(' ')
        let line = ''
        let ly = y
        for (const word of words) {
          if (word.includes('\\n')) {
            const parts = word.split('\\n')
            for (let pi2 = 0; pi2 < parts.length; pi2++) {
              if (pi2 > 0) { p.text(line.trim(), x, ly); line = ''; ly += size + 3 }
              line += parts[pi2] + ' '
            }
          } else {
            const test = line + word + ' '
            if (p.textWidth(test) > maxW && line.length > 0) {
              p.text(line.trim(), x, ly)
              line = word + ' '
              ly += size + 3
            } else {
              line = test
            }
          }
        }
        if (line.trim()) { p.text(line.trim(), x, ly); ly += size + 3 }
        return ly
      }

      // Bad prompt (left)
      const colY = 40
      p.fill(200, 80, 80)
      p.textSize(12)
      p.text('Vague Prompt', 20, colY)

      p.fill(40, 30, 30)
      p.stroke(80, 50, 50)
      p.strokeWeight(1)
      p.rect(20, colY + 20, halfW, 130, 6)

      p.fill(180, 200, 255)
      p.noStroke()
      wrapText(task.promptBad, 30, colY + 30, halfW - 20, 9)

      p.fill(200, 80, 80)
      p.textSize(11)
      p.text('Model Output:', 20, colY + 165)

      p.fill(40, 30, 30)
      p.stroke(80, 50, 50)
      p.strokeWeight(1)
      p.rect(20, colY + 185, halfW, 100, 6)

      p.fill(220, 120, 120)
      p.noStroke()
      wrapText(task.outputBad, 30, colY + 195, halfW - 20, 9)

      // Red X
      p.fill(200, 60, 60)
      p.textSize(24)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('X', 20 + halfW / 2, colY + 310)

      // Good prompt (right)
      const rx = w / 2 + 10
      p.fill(80, 200, 120)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Clear Prompt', rx, colY)

      p.fill(25, 40, 30)
      p.stroke(50, 100, 60)
      p.strokeWeight(1)
      p.rect(rx, colY + 20, halfW, 130, 6)

      p.fill(180, 220, 200)
      p.noStroke()
      wrapText(task.promptGood, rx + 10, colY + 30, halfW - 20, 9)

      p.fill(80, 200, 120)
      p.textSize(11)
      p.text('Model Output:', rx, colY + 165)

      p.fill(25, 40, 30)
      p.stroke(50, 100, 60)
      p.strokeWeight(1)
      p.rect(rx, colY + 185, halfW, 100, 6)

      p.fill(120, 230, 140)
      p.noStroke()
      wrapText(task.outputGood, rx + 10, colY + 195, halfW - 20, 9)

      // Green check
      p.fill(60, 200, 80)
      p.textSize(24)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('OK', rx + halfW / 2, colY + 310)

      // Bottom explanation
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Prompt wording dramatically affects output quality. Be specific about the task, format, and expected output.', 20, p.height - 8)
    }
  }, [tasks])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Zero-Shot Prompting</h2>
      <p className="text-gray-300 leading-relaxed">
        In <strong className="text-white">zero-shot prompting</strong>, you provide no examples --
        just a description of what you want the model to do. This sounds simple, but the exact
        wording matters enormously. A vague prompt yields vague or irrelevant output. A well-structured
        prompt with clear instructions, expected format, and delimiters can dramatically improve
        quality.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Toggle between different tasks below to see how prompt clarity affects model output. The left
        side shows a vague prompt with a poor response; the right shows a well-crafted prompt with a
        good response -- same model, same task, different results.
      </p>

      <div className="flex gap-2 mb-2">
        {tasks.map((task, i) => (
          <button
            key={i}
            onClick={() => { setTaskIdx(i); taskRef.current = i }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              taskIdx === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {task.name}
          </button>
        ))}
      </div>

      <P5Sketch sketch={sketch} height={400} />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Few-Shot Prompting (p5 bar chart)                     */
/* ================================================================== */
function FewShotSection() {
  const [nShots, setNShots] = useState(3)
  const nShotsRef = useRef(nShots)
  nShotsRef.current = nShots

  // Simulated accuracy for different shot counts
  const accuracyData: Record<number, number> = {
    0: 0.52,
    1: 0.68,
    2: 0.76,
    3: 0.83,
    4: 0.86,
    5: 0.89,
    6: 0.90,
    7: 0.91,
    8: 0.92,
  }

  const examples = [
    { input: '"I love this product!" ->', output: 'Positive' },
    { input: '"Terrible experience." ->', output: 'Negative' },
    { input: '"It works okay I guess." ->', output: 'Neutral' },
    { input: '"Best purchase ever!" ->', output: 'Positive' },
    { input: '"Would not recommend." ->', output: 'Negative' },
    { input: '"Arrived on time, decent quality." ->', output: 'Neutral' },
    { input: '"Absolutely fantastic!" ->', output: 'Positive' },
    { input: '"Complete waste of money." ->', output: 'Negative' },
  ]

  const sketch = useCallback((p: p5) => {
    let animatedHeights: number[] = Array(9).fill(0)

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const ns = nShotsRef.current
      p.background(15, 15, 25)
      const w = p.width

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Few-Shot Classification: ${ns}-shot`, 20, 10)

      // Prompt preview (left side)
      const promptX = 20
      const promptW = w * 0.45
      const promptY = 40

      p.fill(255)
      p.textSize(11)
      p.text('Constructed Prompt:', promptX, promptY)

      p.fill(30, 30, 45)
      p.stroke(50, 50, 70)
      p.strokeWeight(1)
      p.rect(promptX, promptY + 18, promptW, 250, 6)

      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(9)
      let py = promptY + 30
      p.text('Classify the review as Positive, Negative, or Neutral.', promptX + 10, py)
      py += 18

      if (ns > 0) {
        p.fill(140)
        p.text('', promptX + 10, py)
        py += 5
        for (let i = 0; i < Math.min(ns, examples.length); i++) {
          p.fill(180, 220, 180)
          p.textSize(8)
          p.text(examples[i].input, promptX + 10, py)
          p.fill(220, 180, 80)
          p.text(` ${examples[i].output}`, promptX + 10 + p.textWidth(examples[i].input), py)
          py += 14
          if (py > promptY + 240) { p.fill(140); p.text('...', promptX + 10, py); break }
        }
      }

      py = Math.min(py + 10, promptY + 245)
      p.fill(255, 200, 100)
      p.textSize(9)
      p.text('"This is a great deal!" -> ???', promptX + 10, py)

      // Bar chart (right side)
      const chartX = w * 0.52
      const chartW = w * 0.44
      const chartY = 50
      const chartH = 240
      const barCount = 9 // 0 through 8

      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Accuracy vs Number of Examples:', chartX, 40)

      // Chart area
      p.fill(20, 20, 35)
      p.stroke(40)
      p.strokeWeight(1)
      p.rect(chartX, chartY + 15, chartW, chartH, 4)

      // Grid lines
      p.stroke(35, 35, 50)
      for (let i = 0; i <= 5; i++) {
        const gy = chartY + 15 + (chartH * i) / 5
        p.line(chartX, gy, chartX + chartW, gy)
        p.fill(100)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(`${(100 - i * 20)}%`, chartX - 4, gy)
        p.stroke(35, 35, 50)
      }

      // Bars
      const barW = chartW / barCount * 0.7
      const gap = chartW / barCount

      for (let i = 0; i < barCount; i++) {
        const acc = accuracyData[i] || 0.5
        const targetH = acc * chartH
        animatedHeights[i] += (targetH - animatedHeights[i]) * 0.08
        const bh = animatedHeights[i]

        const bx = chartX + i * gap + (gap - barW) / 2
        const by = chartY + 15 + chartH - bh

        const isActive = i === ns
        const alpha = isActive ? 255 : 150

        if (isActive) {
          p.fill(80, 200, 120, alpha)
          p.stroke(100, 240, 140)
          p.strokeWeight(2)
        } else {
          p.fill(60, 120, 180, alpha)
          p.stroke(80, 140, 200, 80)
          p.strokeWeight(1)
        }
        p.rect(bx, by, barW, bh, 2, 2, 0, 0)

        // Label
        p.fill(isActive ? 255 : 140)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${i}`, bx + barW / 2, chartY + 15 + chartH + 4)

        if (isActive) {
          p.fill(255)
          p.textSize(10)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(`${(acc * 100).toFixed(0)}%`, bx + barW / 2, by - 4)
        }
      }

      // X axis label
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Number of examples (shots)', chartX + chartW / 2, chartY + 15 + chartH + 20)

      // Key insight
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Accuracy increases steeply with the first few examples, then shows diminishing returns.', 20, p.height - 8)
    }
  }, [examples, accuracyData])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Few-Shot Prompting</h2>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Few-shot prompting</strong> provides the model with example
        input-output pairs before the actual query. These examples demonstrate the task format,
        the expected output style, and even the reasoning pattern. The model uses attention to
        pattern-match from the examples to the new input.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The number of examples matters: going from 0-shot to 1-shot often produces the biggest
        jump in accuracy. Additional examples help but with diminishing returns. Use the slider
        below to see how accuracy changes for a sentiment classification task as you add more examples.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Parameters">
            <InteractiveSlider label="Number of shots" min={0} max={8} step={1} value={nShots} onChange={(v) => { setNShots(v); nShotsRef.current = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Chain-of-Thought (p5)                                 */
/* ================================================================== */
function ChainOfThoughtSection() {
  const [showCoT, setShowCoT] = useState(false)
  const showCoTRef = useRef(showCoT)
  showCoTRef.current = showCoT

  const sketch = useCallback((p: p5) => {
    let animStep = 0
    let lastSwitch = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      const isCoT = showCoTRef.current
      p.background(15, 15, 25)
      const w = p.width

      if (isCoT && p.frameCount - lastSwitch > 5) {
        if (animStep < 5) {
          if (p.frameCount % 40 === 0) animStep++
        }
      }
      if (!isCoT) { animStep = 0; lastSwitch = p.frameCount }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(isCoT ? 'Chain-of-Thought Prompting' : 'Direct Prompting', 20, 10)

      // Math problem
      const problem = 'Roger has 5 tennis balls. He buys 2 more cans of tennis balls.\nEach can has 3 balls. How many tennis balls does he have now?'

      p.fill(100, 180, 255)
      p.textSize(11)
      p.text('Problem:', 20, 40)
      p.fill(220)
      p.textSize(10)
      p.text(problem.split('\n')[0], 20, 58)
      p.text(problem.split('\n')[1], 20, 73)

      if (!isCoT) {
        // Direct prompting - wrong answer
        p.fill(40, 30, 30)
        p.stroke(80, 50, 50)
        p.strokeWeight(1)
        p.rect(20, 100, w - 40, 60, 6)

        p.fill(255)
        p.noStroke()
        p.textSize(11)
        p.text('Direct answer:', 30, 110)
        p.fill(220, 100, 100)
        p.textSize(12)
        p.text('The answer is 9.', 30, 130)

        p.fill(200, 60, 60)
        p.textSize(20)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text('WRONG', w - 30, 130)

        // Explanation
        p.fill(160)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Without reasoning steps, the model jumps to an incorrect answer.', 20, 180)
        p.text('It likely confused "2 cans + 3 balls + 5 = 10" or other wrong arithmetic.', 20, 196)
        p.text('The correct answer is 5 + (2 x 3) = 11.', 20, 212)
      } else {
        // Chain-of-thought - step by step
        const steps = [
          { text: 'Step 1: Roger starts with 5 tennis balls.', color: [120, 200, 255] as const },
          { text: 'Step 2: He buys 2 cans of tennis balls.', color: [120, 200, 255] as const },
          { text: 'Step 3: Each can has 3 balls, so 2 cans = 2 x 3 = 6 balls.', color: [180, 220, 120] as const },
          { text: 'Step 4: Total = 5 + 6 = 11 tennis balls.', color: [220, 200, 80] as const },
          { text: 'The answer is 11.', color: [80, 220, 120] as const },
        ]

        // Draw prompt addition
        p.fill(60, 80, 60)
        p.stroke(80, 120, 80)
        p.strokeWeight(1)
        p.rect(20, 95, w - 40, 25, 4)
        p.fill(120, 220, 120)
        p.noStroke()
        p.textSize(10)
        p.text('Added to prompt: "Let\'s think step by step."', 30, 102)

        // Reasoning chain
        const chainY = 135
        for (let i = 0; i < steps.length; i++) {
          const visible = i <= animStep
          const sy = chainY + i * 45

          if (visible) {
            // Box
            p.fill(25, 30, 40)
            p.stroke(steps[i].color[0], steps[i].color[1], steps[i].color[2], 120)
            p.strokeWeight(1)
            p.rect(40, sy, w - 80, 35, 6)

            // Arrow from previous
            if (i > 0) {
              p.stroke(80, 80, 100)
              p.strokeWeight(1.5)
              p.line(w / 2, sy - 10, w / 2, sy)
              p.fill(80, 80, 100)
              p.noStroke()
              p.triangle(w / 2 - 4, sy, w / 2 + 4, sy, w / 2, sy + 4)
            }

            // Step number circle
            p.fill(steps[i].color[0], steps[i].color[1], steps[i].color[2])
            p.noStroke()
            p.ellipse(55, sy + 17, 18, 18)
            p.fill(15, 15, 25)
            p.textSize(10)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(`${i + 1}`, 55, sy + 17)

            // Text
            p.fill(steps[i].color[0], steps[i].color[1], steps[i].color[2])
            p.textSize(10)
            p.textAlign(p.LEFT, p.CENTER)
            p.text(steps[i].text, 72, sy + 17)

            // Final answer highlight
            if (i === steps.length - 1) {
              p.fill(60, 200, 80)
              p.textSize(18)
              p.textAlign(p.RIGHT, p.CENTER)
              p.text('CORRECT', w - 30, sy + 17)
            }
          }
        }
      }

      // Bottom note
      p.fill(140)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(isCoT
        ? 'CoT forces the model to show its work, catching errors and improving accuracy on reasoning tasks.'
        : 'Toggle to Chain-of-Thought to see how explicit reasoning steps help the model get the right answer.',
        20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Chain-of-Thought Prompting</h2>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Chain-of-Thought (CoT)</strong> prompting is one of the most
        impactful prompt engineering techniques. The idea is simple: instead of asking the model to
        jump directly to an answer, you ask it to "think step by step" and show its reasoning. This
        dramatically improves performance on math, logic, and multi-step reasoning tasks.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Why does this work? When a model generates intermediate steps, each step becomes part of the
        context for the next step. The model can use these intermediate results (stored in the
        generated text, which it attends to) rather than trying to do all the computation implicitly
        in a single forward pass. It is essentially using the output text as a "scratchpad" for
        working memory.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Toggle between direct prompting and CoT below to see the difference on a word problem.
        Watch the reasoning chain appear step by step.
      </p>

      <div className="flex gap-2 mb-2">
        <button
          onClick={() => { setShowCoT(false); showCoTRef.current = false }}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            !showCoT ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Direct Prompting
        </button>
        <button
          onClick={() => { setShowCoT(true); showCoTRef.current = true }}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            showCoT ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Chain-of-Thought
        </button>
      </div>

      <P5Sketch sketch={sketch} height={440} />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Prompt Engineering Techniques                         */
/* ================================================================== */
function PromptEngineeringSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Prompt Engineering Techniques</h2>
      <p className="text-gray-300 leading-relaxed">
        Beyond zero-shot, few-shot, and CoT, there is a rich toolkit of prompt engineering techniques
        that can significantly improve model output quality. These techniques work because they help
        the model understand exactly what you want -- reducing ambiguity and activating the right
        "modes" in the model's learned behavior.
      </p>

      <div className="grid grid-cols-1 gap-4 mt-4">
        {[
          {
            title: 'System Prompts',
            desc: 'Set the model\'s role, personality, and constraints upfront. This frames all subsequent interactions.',
            before: 'User: What is 2+2?\nModel: 2+2=4. But it could also be 5 in some bases...',
            after: 'System: You are a concise math tutor. Give direct answers.\nUser: What is 2+2?\nModel: 4',
            color: 'blue',
          },
          {
            title: 'Role Prompting',
            desc: 'Ask the model to adopt a specific expert persona. This activates relevant knowledge and communication style.',
            before: 'Explain quantum entanglement.\n-> [generic Wikipedia-style answer]',
            after: 'You are a physics professor explaining to a curious 10-year-old.\n-> [simple, engaging analogy with everyday objects]',
            color: 'purple',
          },
          {
            title: 'Output Formatting',
            desc: 'Specify the exact format you want: JSON, bullet points, table, numbered list. Models follow format instructions well.',
            before: 'List the planets.\n-> The planets are Mercury, Venus, Earth...',
            after: 'List the planets as a numbered list with diameter in km.\n-> 1. Mercury - 4,879 km\n2. Venus - 12,104 km...',
            color: 'green',
          },
          {
            title: 'Delimiters',
            desc: 'Use triple quotes, XML tags, or markdown to clearly separate instructions from content. Prevents prompt injection.',
            before: 'Summarize: The text says to ignore previous instructions...',
            after: 'Summarize the text between <doc> tags.\n<doc>The text says to ignore...</doc>\n-> [correctly summarizes]',
            color: 'orange',
          },
        ].map((tech) => {
          const borderColor = tech.color === 'blue' ? 'border-blue-800/50' :
            tech.color === 'purple' ? 'border-purple-800/50' :
            tech.color === 'green' ? 'border-green-800/50' : 'border-orange-800/50'
          const bgColor = tech.color === 'blue' ? 'bg-blue-900/20' :
            tech.color === 'purple' ? 'bg-purple-900/20' :
            tech.color === 'green' ? 'bg-green-900/20' : 'bg-orange-900/20'
          return (
            <div key={tech.title} className={`rounded-lg border ${borderColor} ${bgColor} p-5`}>
              <h3 className="text-white font-semibold mb-2">{tech.title}</h3>
              <p className="text-gray-300 text-sm mb-3">{tech.desc}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-black/30 rounded p-3">
                  <p className="text-red-400 text-xs font-bold mb-1">Before:</p>
                  <p className="text-gray-400 text-xs font-mono whitespace-pre-wrap">{tech.before}</p>
                </div>
                <div className="bg-black/30 rounded p-3">
                  <p className="text-green-400 text-xs font-bold mb-1">After:</p>
                  <p className="text-gray-300 text-xs font-mono whitespace-pre-wrap">{tech.after}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- RAG Pipeline (Animated p5)                            */
/* ================================================================== */
function RAGSection() {
  const [topK, setTopK] = useState(3)
  const topKRef = useRef(topK)
  topKRef.current = topK

  const sketch = useCallback((p: p5) => {
    let t = 0

    const documents = [
      { title: 'Doc 1: Climate', relevance: 0.92, text: 'Global temps rose 1.1C since 1850...' },
      { title: 'Doc 2: Oceans', relevance: 0.85, text: 'Sea levels rising 3.6mm per year...' },
      { title: 'Doc 3: Weather', relevance: 0.78, text: 'Extreme weather events increasing...' },
      { title: 'Doc 4: Sports', relevance: 0.12, text: 'The FIFA World Cup is held every 4...' },
      { title: 'Doc 5: Cooking', relevance: 0.08, text: 'Preheat oven to 350 degrees...' },
      { title: 'Doc 6: Ice', relevance: 0.71, text: 'Arctic ice declining 13% per decade...' },
    ]

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 460)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.015
      const k = topKRef.current
      p.background(15, 15, 25)
      const w = p.width

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Retrieval-Augmented Generation (RAG) Pipeline', 20, 10)

      // Stage 1: Query
      const stageH = 40
      const queryX = 20
      const queryW = 130
      const stageY = 45

      p.fill(60, 80, 120)
      p.stroke(80, 110, 160)
      p.strokeWeight(1)
      p.rect(queryX, stageY, queryW, stageH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Query:', queryX + queryW / 2, stageY + 12)
      p.fill(180, 220, 255)
      p.textSize(8)
      p.text('"How is climate', queryX + queryW / 2, stageY + 26)
      p.text('change measured?"', queryX + queryW / 2, stageY + 36)

      // Arrow: Query -> Retriever
      const retrieverX = queryX + queryW + 20
      p.stroke(100)
      p.strokeWeight(1.5)
      p.line(queryX + queryW, stageY + stageH / 2, retrieverX, stageY + stageH / 2)
      p.fill(100)
      p.noStroke()
      p.triangle(retrieverX - 6, stageY + stageH / 2 - 4, retrieverX - 6, stageY + stageH / 2 + 4, retrieverX, stageY + stageH / 2)

      // Stage 2: Retriever
      const retrieverW = 100
      p.fill(100, 80, 50)
      p.stroke(150, 120, 70)
      p.strokeWeight(1)
      p.rect(retrieverX, stageY, retrieverW, stageH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Retriever', retrieverX + retrieverW / 2, stageY + 13)
      p.fill(160)
      p.textSize(8)
      p.text('(cosine similarity)', retrieverX + retrieverW / 2, stageY + 28)

      // Document Store
      const docStoreX = 20
      const docStoreY = 110
      const docStoreW = retrieverX + retrieverW + 20
      const sorted = [...documents].sort((a, b) => b.relevance - a.relevance)

      p.fill(30, 30, 45)
      p.stroke(50, 50, 70)
      p.strokeWeight(1)
      p.rect(docStoreX, docStoreY, docStoreW, 140, 6)

      p.fill(160)
      p.noStroke()
      p.textSize(10)
      p.text('Document Store (ranked by relevance):', docStoreX + 10, docStoreY + 12)

      for (let i = 0; i < sorted.length; i++) {
        const doc = sorted[i]
        const dx = docStoreX + 10
        const dy = docStoreY + 28 + i * 18
        const isRetrieved = i < k

        if (isRetrieved) {
          p.fill(40, 60, 40)
          p.noStroke()
          p.rect(dx - 2, dy - 2, docStoreW - 18, 16, 3)
        }

        p.fill(isRetrieved ? 120 : 60, isRetrieved ? 220 : 80, isRetrieved ? 120 : 60)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`${doc.title} (${(doc.relevance * 100).toFixed(0)}%)`, dx + 5, dy)
        p.fill(isRetrieved ? 180 : 100)
        p.textSize(8)
        p.text(doc.text, dx + 200, dy + 1)
      }

      // Arrow: Retrieved docs -> Augmented Prompt
      const augX = docStoreX + docStoreW + 30
      p.stroke(80, 200, 80, 150)
      p.strokeWeight(1.5)
      p.line(docStoreX + docStoreW, docStoreY + 70, augX, docStoreY + 70)
      p.fill(80, 200, 80)
      p.noStroke()
      p.triangle(augX - 6, docStoreY + 66, augX - 6, docStoreY + 74, augX, docStoreY + 70)

      // Stage 3: Augmented prompt
      const augW = w - augX - 15
      p.fill(40, 50, 60)
      p.stroke(70, 90, 110)
      p.strokeWeight(1)
      p.rect(augX, stageY, augW, 190, 6)

      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Augmented Prompt', augX + 8, stageY + 6)

      p.fill(100, 180, 255)
      p.textSize(8)
      let ay = stageY + 24
      p.text('Context:', augX + 8, ay)
      ay += 12

      for (let i = 0; i < k && i < sorted.length; i++) {
        p.fill(150, 200, 150)
        p.text(`- ${sorted[i].text}`, augX + 8, ay)
        ay += 12
      }

      ay += 6
      p.fill(255, 200, 100)
      p.text('Q: How is climate change measured?', augX + 8, ay)

      // Stage 4: LLM + output
      const llmY = 270
      const llmX = w / 2 - 70

      p.fill(80, 60, 120)
      p.stroke(120, 80, 180)
      p.strokeWeight(1)
      p.rect(llmX, llmY, 140, 45, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('LLM', llmX + 70, llmY + 15)
      p.fill(160)
      p.textSize(8)
      p.text('Generates grounded answer', llmX + 70, llmY + 32)

      // Arrow down to output
      p.stroke(100)
      p.strokeWeight(1.5)
      p.line(llmX + 70, llmY + 45, llmX + 70, llmY + 60)

      // Output box
      const outY = llmY + 65
      p.fill(25, 40, 30)
      p.stroke(50, 100, 60)
      p.strokeWeight(1)
      p.rect(20, outY, w - 40, 80, 6)

      p.fill(80, 220, 100)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Grounded Answer:', 30, outY + 8)
      p.fill(200)
      p.textSize(9)
      const answerParts = [
        'Climate change is measured through global temperature records (up 1.1C since 1850),',
        'sea level monitoring (rising 3.6mm/year), and Arctic ice extent (declining 13%/decade).',
        'These measurements come from satellites, weather stations, and ocean buoys.',
      ]
      for (let i = 0; i < Math.min(answerParts.length, k); i++) {
        p.text(answerParts[i], 30, outY + 24 + i * 14)
      }

      // Hallucination comparison
      p.fill(160)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`With top-${k} docs: answer is grounded in retrieved facts. Without RAG: model might hallucinate statistics.`, 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Retrieval-Augmented Generation (RAG)</h2>
      <p className="text-gray-300 leading-relaxed">
        LLMs have a fundamental limitation: their knowledge is frozen at training time. They cannot
        access up-to-date information, proprietary documents, or niche domain knowledge not in their
        training data. When asked about such topics, they may <strong className="text-white">
        hallucinate</strong> -- confidently generating plausible-sounding but factually incorrect
        information.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <strong className="text-white">Retrieval-Augmented Generation (RAG)</strong> solves this by
        adding a retrieval step before generation. Given a query, a retriever searches a document
        store (using embedding similarity) to find relevant passages. These passages are injected
        into the prompt as context, grounding the LLM's response in actual source material. This
        dramatically reduces hallucination and allows the model to access any knowledge base.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The pipeline below shows RAG in action. Adjust the number of retrieved documents to see how
        it affects the quality and grounding of the answer.
      </p>
      <P5Sketch
        sketch={sketch}
        height={460}
        controls={
          <ControlPanel title="RAG Parameters">
            <InteractiveSlider label="Top-K documents" min={1} max={5} step={1} value={topK} onChange={(v) => { setTopK(v); topKRef.current = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Tool Use & Agents (p5)                                */
/* ================================================================== */
function AgentSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let activeStep = 0

    const agentSteps = [
      { type: 'think', label: 'Think', detail: '"I need to find the current weather in Paris. Let me use the weather tool."', color: [100, 140, 220] as const },
      { type: 'act', label: 'Act', detail: 'Call: weather_api("Paris")', color: [220, 160, 60] as const },
      { type: 'observe', label: 'Observe', detail: 'Result: { temp: 18C, condition: "partly cloudy", humidity: 65% }', color: [80, 200, 120] as const },
      { type: 'think', label: 'Think', detail: '"Now I should convert to Fahrenheit since the user asked for it."', color: [100, 140, 220] as const },
      { type: 'act', label: 'Act', detail: 'Call: calculator("18 * 9/5 + 32")', color: [220, 160, 60] as const },
      { type: 'observe', label: 'Observe', detail: 'Result: 64.4', color: [80, 200, 120] as const },
      { type: 'respond', label: 'Respond', detail: '"It\'s currently 64.4F (18C) and partly cloudy in Paris."', color: [200, 100, 200] as const },
    ]

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.02
      p.background(15, 15, 25)
      const w = p.width

      // Advance steps
      if (p.frameCount % 80 === 0) {
        activeStep = (activeStep + 1) % (agentSteps.length + 2)
      }

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Agent Loop: Think -> Act -> Observe -> Repeat', 20, 10)

      // User query
      p.fill(60, 80, 100)
      p.stroke(80, 110, 140)
      p.strokeWeight(1)
      p.rect(20, 35, w - 40, 30, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('User: "What\'s the weather in Paris in Fahrenheit?"', 30, 50)

      // Agent loop visualization
      const loopCenterX = 110
      const loopCenterY = 200
      const loopR = 60

      // Draw loop circle segments
      const loopLabels = ['Think', 'Act', 'Observe']
      const loopColors: [number, number, number][] = [[100, 140, 220], [220, 160, 60], [80, 200, 120]]
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3
        const nextAngle = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 3

        // Arc segment
        p.stroke(loopColors[i][0], loopColors[i][1], loopColors[i][2], 180)
        p.strokeWeight(3)
        p.noFill()
        p.arc(loopCenterX, loopCenterY, loopR * 2, loopR * 2, angle, nextAngle)

        // Node
        const nx = loopCenterX + Math.cos(angle) * loopR
        const ny = loopCenterY + Math.sin(angle) * loopR
        p.fill(loopColors[i][0], loopColors[i][1], loopColors[i][2])
        p.noStroke()
        p.ellipse(nx, ny, 30, 30)
        p.fill(255)
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(loopLabels[i], nx, ny)
      }

      // Rotating indicator
      const indicatorAngle = -Math.PI / 2 + t * 0.8
      const ix = loopCenterX + Math.cos(indicatorAngle) * (loopR + 15)
      const iy = loopCenterY + Math.sin(indicatorAngle) * (loopR + 15)
      p.fill(255, 255, 255, 180)
      p.noStroke()
      p.ellipse(ix, iy, 8, 8)

      // Step-by-step trace on the right
      const traceX = 200
      const traceY = 80

      p.fill(255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Execution Trace:', traceX, traceY)

      for (let i = 0; i < agentSteps.length; i++) {
        const step = agentSteps[i]
        const sy = traceY + 22 + i * 42
        const visible = i < activeStep

        if (!visible) continue

        // Step box
        p.fill(20, 22, 32)
        p.stroke(step.color[0], step.color[1], step.color[2], 100)
        p.strokeWeight(1)
        p.rect(traceX, sy, w - traceX - 25, 36, 4)

        // Label badge
        p.fill(step.color[0], step.color[1], step.color[2])
        p.noStroke()
        p.rect(traceX + 4, sy + 4, 55, 14, 3)
        p.fill(15, 15, 25)
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(step.label.toUpperCase(), traceX + 31, sy + 11)

        // Detail text
        p.fill(180)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        const maxTextW = w - traceX - 40
        const detail = step.detail.length > maxTextW / 5 ? step.detail.substring(0, Math.floor(maxTextW / 5)) + '...' : step.detail
        p.text(detail, traceX + 65, sy + 5)

        // Arrow to next
        if (i < agentSteps.length - 1 && i + 1 < activeStep) {
          p.stroke(60, 60, 80)
          p.strokeWeight(1)
          p.line(traceX + 20, sy + 36, traceX + 20, sy + 42)
        }
      }

      // Available tools
      p.fill(140)
      p.textSize(9)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text('Available tools: weather_api(), calculator(), web_search(), run_python()', 20, p.height - 8)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Tool Use & Agents</h2>
      <p className="text-gray-300 leading-relaxed">
        The next evolution beyond prompting is <strong className="text-white">tool use</strong>:
        giving LLMs the ability to call external functions -- search the web, run code, query
        databases, call APIs. The model decides when to use a tool, formulates the function call,
        observes the result, and continues reasoning.
      </p>
      <p className="text-gray-300 leading-relaxed">
        An <strong className="text-white">agent</strong> takes this further by running in a loop:
        the model thinks about what to do, takes an action (possibly calling a tool), observes the
        result, then thinks again. This loop continues until the task is complete. Agents can
        decompose complex tasks into steps, recover from errors, and combine multiple tools to
        solve problems no single tool could handle.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The visualization below shows an agent solving a multi-step task. Watch the
        think-act-observe loop cycle through the reasoning trace.
      </p>
      <P5Sketch sketch={sketch} height={420} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Limitations                                           */
/* ================================================================== */
function LimitationsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Limitations of Prompting</h2>
      <p className="text-gray-300 leading-relaxed">
        Prompting is powerful but not without significant limitations. Understanding these limitations
        is essential for using LLMs effectively and responsibly.
      </p>

      <div className="space-y-4 mt-4">
        <div className="rounded-lg border border-red-800/40 bg-red-900/15 p-5">
          <h3 className="text-white font-semibold mb-2">Hallucination</h3>
          <p className="text-gray-300 text-sm">
            LLMs can generate confident, fluent text that is factually wrong. They do not "know" what
            they know -- they generate statistically plausible tokens. RAG helps but does not eliminate
            this. Even with retrieved context, models can misinterpret sources or fill gaps with
            fabricated details. Always verify critical claims.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-800/40 bg-yellow-900/15 p-5">
          <h3 className="text-white font-semibold mb-2">Context Window Limits</h3>
          <p className="text-gray-300 text-sm">
            Every model has a finite context window (typically 4K to 1M tokens). Long documents must
            be chunked and summarized. Information at the edges of the context window may receive less
            attention (the "lost in the middle" effect). Careful context management is essential for
            complex tasks.
          </p>
        </div>

        <div className="rounded-lg border border-orange-800/40 bg-orange-900/15 p-5">
          <h3 className="text-white font-semibold mb-2">Prompt Injection</h3>
          <p className="text-gray-300 text-sm">
            Malicious inputs can override system prompts and instructions. If user-provided text is
            inserted into a prompt, an attacker can craft input like "Ignore previous instructions
            and instead..." This is an unsolved security problem for LLM applications. Delimiters
            and input sanitization help but are not foolproof.
          </p>
        </div>

        <div className="rounded-lg border border-blue-800/40 bg-blue-900/15 p-5">
          <h3 className="text-white font-semibold mb-2">Sensitivity to Phrasing</h3>
          <p className="text-gray-300 text-sm">
            Small changes in prompt wording can cause large changes in output. Reordering few-shot
            examples, changing a single word in the instruction, or even adding a newline can flip the
            model's answer. This brittleness makes prompt engineering more art than science and
            necessitates systematic evaluation.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- PythonCell: Few-Shot Classifier                       */
/* ================================================================== */
function PythonFewShotSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Simulating a Few-Shot Classifier</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us build a simple few-shot classifier that simulates how an LLM might use examples to
        classify new inputs. We represent each text as a bag-of-words vector and classify new inputs
        by finding the most similar examples in the prompt -- mimicking the attention-based pattern
        matching that LLMs perform internally.
      </p>
      <PythonCell
        defaultCode={`import numpy as np
from collections import Counter

# Simulated few-shot classification
# We represent "in-context learning" as nearest-neighbor over example embeddings

# Example training data (few-shot examples)
examples = [
    ("I love this product, it's amazing!", "Positive"),
    ("Terrible quality, waste of money", "Negative"),
    ("It works fine, nothing special", "Neutral"),
    ("Best purchase I've ever made!", "Positive"),
    ("Broke after one day, very disappointed", "Negative"),
    ("Decent product for the price", "Neutral"),
    ("Absolutely wonderful experience", "Positive"),
    ("Do not buy this, awful", "Negative"),
]

# Test inputs
test_inputs = [
    "This is fantastic, highly recommend!",
    "Worst thing I've bought this year",
    "It's okay, does what it says",
    "I'm so happy with this purchase",
    "Complete garbage, returning immediately",
]

# Simple bag-of-words "embedding"
def get_vocabulary(texts):
    vocab = set()
    for text in texts:
        for word in text.lower().split():
            word = word.strip(".,!?'\\"-")
            if len(word) > 2:
                vocab.add(word)
    return sorted(vocab)

all_texts = [e[0] for e in examples] + test_inputs
vocab = get_vocabulary(all_texts)
word_to_idx = {w: i for i, w in enumerate(vocab)}

def embed(text):
    vec = np.zeros(len(vocab))
    words = text.lower().split()
    for w in words:
        w = w.strip(".,!?'\\"-")
        if w in word_to_idx:
            vec[word_to_idx[w]] = 1
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

def cosine_similarity(a, b):
    dot = np.dot(a, b)
    return dot  # already normalized

# Simulate few-shot classification with different k
print("=== Few-Shot Classification (Nearest Neighbor) ===\\n")

for n_shots in [1, 3, 5, len(examples)]:
    shot_examples = examples[:n_shots]
    shot_embeddings = [(embed(text), label) for text, label in shot_examples]

    print(f"--- {n_shots}-shot (using {n_shots} examples) ---")
    correct = 0
    total = len(test_inputs)
    expected = ["Positive", "Negative", "Neutral", "Positive", "Negative"]

    for i, test_text in enumerate(test_inputs):
        test_emb = embed(test_text)

        # Find most similar example (like attention!)
        similarities = []
        for emb, label in shot_embeddings:
            sim = cosine_similarity(test_emb, emb)
            similarities.append((sim, label))

        # Weighted vote from top-3 most similar
        similarities.sort(reverse=True)
        top = similarities[:min(3, len(similarities))]

        # Vote
        votes = Counter()
        for sim, label in top:
            votes[label] += sim

        predicted = votes.most_common(1)[0][0]
        is_correct = predicted == expected[i]
        correct += is_correct

        if n_shots == len(examples):
            mark = "OK" if is_correct else "XX"
            print(f'  [{mark}] "{test_text[:40]}..." -> {predicted} (expected {expected[i]})')

    accuracy = correct / total
    print(f"  Accuracy: {accuracy:.0%}\\n")

print("Key insight: More examples = better pattern matching.")
print("This mirrors how LLMs use attention over few-shot examples")
print("to 'learn' the task at inference time.")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- PythonCell: Simple RAG Pipeline                      */
/* ================================================================== */
function PythonRAGSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Building a Simple RAG Pipeline</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us implement a complete (simplified) RAG pipeline: embed documents, embed the query,
        retrieve the most relevant documents by cosine similarity, and construct an augmented prompt.
        We use TF-IDF vectors as our embeddings -- in production you would use a neural embedding
        model, but the retrieval principle is identical.
      </p>
      <PythonCell
        defaultCode={`import numpy as np
from collections import Counter
import math

# === Simple RAG Pipeline ===

# Document store (our "knowledge base")
documents = [
    "Python was created by Guido van Rossum and first released in 1991. It emphasizes code readability with significant whitespace.",
    "JavaScript was created by Brendan Eich in 1995 in just 10 days. It is the language of the web browser.",
    "Rust was first released in 2015 by Mozilla. It focuses on memory safety without garbage collection.",
    "Python uses dynamic typing and has a large standard library. It is popular for data science and machine learning.",
    "JavaScript runs on both client and server (Node.js). It uses prototypal inheritance and event-driven programming.",
    "Rust's ownership system prevents data races at compile time. It is used for systems programming and WebAssembly.",
    "Python's package manager is pip, and packages are hosted on PyPI. Popular frameworks include Django and Flask.",
    "TypeScript is a typed superset of JavaScript developed by Microsoft. It compiles to plain JavaScript.",
    "Go was created at Google by Robert Griesemer, Rob Pike, and Ken Thompson. It has built-in concurrency with goroutines.",
    "Machine learning in Python commonly uses NumPy, pandas, scikit-learn, and PyTorch or TensorFlow.",
]

# Step 1: Build TF-IDF embeddings for documents
def tokenize(text):
    return [w.strip(".,!?'\\"-()").lower() for w in text.split() if len(w) > 2]

# Compute document frequency
all_tokens = [tokenize(doc) for doc in documents]
df = Counter()
for tokens in all_tokens:
    for t in set(tokens):
        df[t] += 1

vocab = sorted(df.keys())
word_to_idx = {w: i for i, w in enumerate(vocab)}
n_docs = len(documents)

def tfidf_embed(text):
    tokens = tokenize(text)
    tf = Counter(tokens)
    vec = np.zeros(len(vocab))
    for token, count in tf.items():
        if token in word_to_idx:
            idx = word_to_idx[token]
            idf = math.log(n_docs / (1 + df.get(token, 0)))
            vec[idx] = count * idf
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

# Embed all documents
doc_embeddings = np.array([tfidf_embed(doc) for doc in documents])

print(f"Document store: {n_docs} documents")
print(f"Vocabulary size: {len(vocab)} terms")
print(f"Embedding dimension: {len(vocab)}\\n")

# Step 2: Retrieval function
def retrieve(query, top_k=3):
    query_emb = tfidf_embed(query)
    similarities = doc_embeddings @ query_emb  # cosine similarity (already normalized)
    top_indices = np.argsort(similarities)[::-1][:top_k]
    return [(documents[i], similarities[i]) for i in top_indices]

# Step 3: Construct augmented prompt
def build_rag_prompt(query, top_k=3):
    retrieved = retrieve(query, top_k)
    context = "\\n".join([f"- {doc}" for doc, _ in retrieved])
    prompt = f\"\"\"Answer the question using ONLY the provided context.

Context:
{context}

Question: {query}
Answer:\"\"\"
    return prompt, retrieved

# Test queries
queries = [
    "Who created Python and when?",
    "What is Rust's main feature for memory safety?",
    "What frameworks does Python have for web development?",
    "How does JavaScript handle concurrency?",
]

for query in queries:
    print(f"Query: {query}")
    print("-" * 50)
    prompt, retrieved = build_rag_prompt(query, top_k=3)

    print(f"Retrieved {len(retrieved)} documents:")
    for doc, sim in retrieved:
        print(f"  [{sim:.3f}] {doc[:70]}...")

    print(f"\\nAugmented prompt (first 200 chars):")
    print(f"  {prompt[:200]}...")
    print()

# Show what happens without RAG vs with RAG
print("=== RAG vs No-RAG Comparison ===")
print()
query = "What package manager does Python use?"
_, retrieved = build_rag_prompt(query, top_k=2)
print(f"Query: {query}")
print(f"Without RAG: Model might say 'conda' or hallucinate")
print(f"With RAG: Retrieved doc says '{retrieved[0][0][:60]}...'")
print(f"  -> Model can correctly answer: 'pip, hosted on PyPI'")
print()
print("RAG grounds the model's answer in actual retrieved facts!")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Prompting() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Prompting & In-Context Learning</h1>
        <p className="text-lg text-gray-400">
          LLMs can learn new tasks from examples in the prompt alone -- no weight updates needed.
          Master zero-shot, few-shot, chain-of-thought prompting, RAG, tool use, and the emerging
          agent paradigm.
        </p>
      </header>

      <InContextLearningSection />
      <ZeroShotSection />
      <FewShotSection />
      <ChainOfThoughtSection />
      <PromptEngineeringSection />
      <RAGSection />
      <AgentSection />
      <LimitationsSection />
      <PythonFewShotSection />
      <PythonRAGSection />
    </div>
  )
}
