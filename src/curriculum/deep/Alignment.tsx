import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'deep/alignment',
  title: 'Fine-Tuning & Alignment',
  description: 'Understand how pretrained language models are aligned with human intent through SFT, RLHF, DPO, and Constitutional AI',
  track: 'deep',
  order: 9,
  tags: ['alignment', 'rlhf', 'sft', 'dpo', 'reward-model', 'fine-tuning', 'constitutional-ai', 'ppo'],
}

/* ================================================================== */
/*  Section 1 -- The Alignment Problem                                 */
/* ================================================================== */
function AlignmentProblemSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Alignment Problem</h2>
      <p className="text-gray-300 leading-relaxed">
        A pretrained language model is a remarkable artifact: it can generate fluent text on virtually
        any topic. But fluency is not the same as helpfulness, and capability is not the same as safety.
        A raw pretrained model is trained to predict the next token in internet text. Ask it a question,
        and it might continue the text in any way that is statistically plausible -- it could give a
        helpful answer, repeat your question back, generate a news article, produce harmful content,
        or simply ramble incoherently.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The <strong className="text-white">alignment problem</strong> is the challenge of steering
        these powerful models so they actually do what we want: follow instructions, be helpful,
        be honest, and avoid harmful outputs. This is not a simple engineering problem. "What humans
        want" is nuanced, context-dependent, and sometimes contradictory. Different users want
        different things. Safety requirements must be balanced against helpfulness.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The modern alignment pipeline typically has three stages: (1) <strong className="text-white">
        Supervised Fine-Tuning (SFT)</strong> to teach the model to follow instructions,
        (2) <strong className="text-white">Reward Modeling</strong> to capture human preferences, and
        (3) <strong className="text-white">Reinforcement Learning from Human Feedback (RLHF)</strong> or
        <strong className="text-white"> Direct Preference Optimization (DPO)</strong> to optimize the
        model against those preferences. Let us walk through each stage.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Supervised Fine-Tuning Pipeline (p5)                  */
/* ================================================================== */
function SFTSection() {
  const [animSpeed, setAnimSpeed] = useState(1.0)
  const speedRef = useRef(animSpeed)
  speedRef.current = animSpeed

  const sftExamples = [
    { instruction: 'Summarize this article...', response: 'The article discusses...' },
    { instruction: 'Translate to French: Hello', response: 'Bonjour' },
    { instruction: 'Write a poem about rain', response: 'Drops fall softly on...' },
    { instruction: 'Explain quantum physics', response: 'Quantum physics studies...' },
    { instruction: 'Fix this Python bug:', response: 'The issue is on line 3...' },
  ]

  const sketch = useCallback((p: p5) => {
    let t = 0
    let activeExample = 0
    let dataParticles: { x: number; y: number; targetX: number; targetY: number; progress: number }[] = []

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012 * speedRef.current
      p.background(15, 15, 25)

      const w = p.width

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Supervised Fine-Tuning Pipeline', 20, 10)

      // Three stages
      const stageW = 150
      const stageH = 80
      const stageY = 60

      // Stage 1: Base Model
      const s1x = 40
      p.fill(60, 60, 120)
      p.stroke(80, 80, 160)
      p.strokeWeight(1.5)
      p.rect(s1x, stageY, stageW, stageH, 8)
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Base Model', s1x + stageW / 2, stageY + 20)
      p.fill(160)
      p.textSize(9)
      p.text('(next-token predictor)', s1x + stageW / 2, stageY + 40)
      p.text('No instruction following', s1x + stageW / 2, stageY + 55)

      // Stage 2: SFT Data
      const s2x = w / 2 - stageW / 2
      p.fill(60, 100, 60)
      p.stroke(80, 140, 80)
      p.strokeWeight(1.5)
      p.rect(s2x, stageY, stageW, stageH, 8)
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.text('SFT Dataset', s2x + stageW / 2, stageY + 20)
      p.fill(160)
      p.textSize(9)
      p.text('(instruction, response)', s2x + stageW / 2, stageY + 40)
      p.text(`${sftExamples.length} example pairs`, s2x + stageW / 2, stageY + 55)

      // Stage 3: Fine-Tuned Model
      const s3x = w - stageW - 40
      p.fill(100, 60, 120)
      p.stroke(140, 80, 160)
      p.strokeWeight(1.5)
      p.rect(s3x, stageY, stageW, stageH, 8)
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.text('SFT Model', s3x + stageW / 2, stageY + 20)
      p.fill(160)
      p.textSize(9)
      p.text('(instruction follower)', s3x + stageW / 2, stageY + 40)
      p.text('Helpful responses!', s3x + stageW / 2, stageY + 55)

      // Arrows between stages
      p.stroke(100)
      p.strokeWeight(2)
      // Arrow 1
      p.line(s1x + stageW + 5, stageY + stageH / 2, s2x - 5, stageY + stageH / 2)
      p.fill(100)
      p.noStroke()
      p.triangle(s2x - 5, stageY + stageH / 2 - 5, s2x - 5, stageY + stageH / 2 + 5, s2x + 2, stageY + stageH / 2)
      // Arrow 2
      p.stroke(100)
      p.strokeWeight(2)
      p.line(s2x + stageW + 5, stageY + stageH / 2, s3x - 5, stageY + stageH / 2)
      p.fill(100)
      p.noStroke()
      p.triangle(s3x - 5, stageY + stageH / 2 - 5, s3x - 5, stageY + stageH / 2 + 5, s3x + 2, stageY + stageH / 2)

      // Animated data particles flowing from SFT Data to Fine-Tuned Model
      if (Math.floor(t * 2) % 3 === 0 && dataParticles.length < 8) {
        dataParticles.push({
          x: s2x + stageW / 2,
          y: stageY + stageH,
          targetX: s3x + stageW / 2,
          targetY: stageY + stageH,
          progress: 0,
        })
      }
      dataParticles = dataParticles.filter(dp => dp.progress <= 1)
      for (const dp of dataParticles) {
        dp.progress += 0.008 * speedRef.current
        const px = p.lerp(dp.x, dp.targetX, dp.progress)
        const py = dp.y - Math.sin(dp.progress * Math.PI) * 30
        p.fill(120, 220, 120, 200 * (1 - dp.progress))
        p.noStroke()
        p.ellipse(px, py, 6, 6)
      }

      // Current SFT example display
      activeExample = Math.floor(t * 0.5) % sftExamples.length
      const ex = sftExamples[activeExample]
      const exY = 170

      // Before SFT (Base Model Output)
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Before SFT (Base Model):', 30, exY)

      p.fill(40, 40, 70)
      p.stroke(60, 60, 100)
      p.strokeWeight(1)
      p.rect(30, exY + 20, w / 2 - 50, 90, 6)

      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(10)
      p.text('Prompt: ' + ex.instruction, 40, exY + 30)

      p.fill(200, 100, 100)
      p.textSize(10)
      const badResponses = [
        'Once upon a time in a land far...',
        'The following is a list of...',
        '## Table of Contents\n1. Introduction...',
        'BREAKING NEWS: Scientists have...',
        'def hello():\n    # TODO:...',
      ]
      p.text('Output: ' + badResponses[activeExample], 40, exY + 55)
      p.fill(160, 80, 80)
      p.textSize(9)
      p.text('(random continuation, not actually answering)', 40, exY + 80)

      // After SFT (Fine-Tuned Output)
      const rightX = w / 2 + 10
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.text('After SFT:', rightX, exY)

      p.fill(30, 50, 40)
      p.stroke(60, 100, 70)
      p.strokeWeight(1)
      p.rect(rightX, exY + 20, w / 2 - 50, 90, 6)

      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(10)
      p.text('Prompt: ' + ex.instruction, rightX + 10, exY + 30)

      p.fill(100, 220, 100)
      p.textSize(10)
      p.text('Output: ' + ex.response, rightX + 10, exY + 55)
      p.fill(80, 160, 80)
      p.textSize(9)
      p.text('(follows instruction, helpful!)', rightX + 10, exY + 80)

      // SFT Data examples list
      const listY = 300
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Training Examples (instruction -> response):', 30, listY)

      for (let i = 0; i < sftExamples.length; i++) {
        const ey = listY + 22 + i * 18
        const isActive = i === activeExample
        p.fill(isActive ? 100 : 60, isActive ? 220 : 80, isActive ? 100 : 60)
        p.noStroke()
        p.ellipse(40, ey + 5, 8, 8)

        p.fill(isActive ? 255 : 140)
        p.textSize(10)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`"${sftExamples[i].instruction}" -> "${sftExamples[i].response}"`, 52, ey + 5)
      }
    }
  }, [sftExamples])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Supervised Fine-Tuning (SFT)</h2>
      <p className="text-gray-300 leading-relaxed">
        The first step in alignment is <strong className="text-white">Supervised Fine-Tuning</strong>.
        We take the pretrained base model and continue training it on a curated dataset of
        (instruction, response) pairs. These pairs are typically written by human annotators who
        demonstrate the kind of responses we want the model to produce: helpful, accurate, and
        well-formatted answers to user queries.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The training objective is the same as pretraining -- next-token prediction -- but now the
        training data consists entirely of high-quality instruction-following examples. After SFT,
        the model shifts from "predict any plausible continuation" to "produce a helpful response
        to the instruction." This is a dramatic behavioral change achieved with relatively little
        data (thousands to tens of thousands of examples, compared to trillions of pretraining tokens).
      </p>
      <p className="text-gray-300 leading-relaxed">
        The visualization below shows the SFT pipeline: a base model that gives random completions
        is trained on instruction-response pairs to produce a model that follows instructions. Watch
        how the same prompt gets very different outputs before and after SFT.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Animation">
            <InteractiveSlider label="Speed" min={0.2} max={3.0} step={0.2} value={animSpeed} onChange={(v) => { setAnimSpeed(v); speedRef.current = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Reward Model (Interactive p5)                         */
/* ================================================================== */
function RewardModelSection() {
  const [scores, setScores] = useState<number[]>([])
  const [pairIdx, setPairIdx] = useState(0)
  const scoresRef = useRef(scores)
  const pairIdxRef = useRef(pairIdx)
  scoresRef.current = scores
  pairIdxRef.current = pairIdx

  const pairs = [
    {
      prompt: 'Explain gravity simply',
      responseA: 'Gravity is the force that pulls objects toward each other. The more mass an object has, the stronger its pull. Earth\'s gravity keeps us on the ground.',
      responseB: 'Gravity is a fundamental interaction described by general relativity as the curvature of spacetime caused by mass-energy equivalence per E=mc^2.',
      betterLabel: 'A',
      reason: 'A is clearer for a simple explanation',
    },
    {
      prompt: 'How do I make pasta?',
      responseA: 'Pasta is a type of food. It was invented in Italy. There are many types of pasta including spaghetti, penne, and fusilli.',
      responseB: 'Boil water, add salt. Cook pasta 8-10 min until al dente. Drain. Toss with your sauce. Tip: save some pasta water to help sauce cling.',
      betterLabel: 'B',
      reason: 'B actually answers the question with actionable steps',
    },
    {
      prompt: 'What is 15 x 23?',
      responseA: 'That\'s a math problem. Math is important for everyday life.',
      responseB: '15 x 23 = 345. Quick method: 15 x 20 = 300, plus 15 x 3 = 45, total = 345.',
      betterLabel: 'B',
      reason: 'B gives the correct answer with explanation',
    },
    {
      prompt: 'Write a haiku about coding',
      responseA: 'Bugs in the midnight\nStack overflow saves the day\nShip it, call it done',
      responseB: 'Coding is fun and good and nice and you should try coding because it is great and wonderful.',
      betterLabel: 'A',
      reason: 'A is creative, follows haiku format, and is charming',
    },
  ]

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 440)
      p.textFont('monospace')
    }

    p.draw = () => {
      const currentScores = scoresRef.current
      const pi = pairIdxRef.current
      const pair = pairs[pi]
      p.background(15, 15, 25)
      const w = p.width
      const cardW = (w - 80) / 2

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Reward Model Training -- Pair ${pi + 1} of ${pairs.length}`, 20, 10)

      // Prompt
      p.fill(100, 180, 255)
      p.textSize(11)
      p.text('Prompt: ' + pair.prompt, 30, 35)

      // Response A card
      const cardY = 60
      const cardH = 140
      const hoverA = p.mouseX > 25 && p.mouseX < 25 + cardW && p.mouseY > cardY && p.mouseY < cardY + cardH
      p.fill(hoverA ? 50 : 35, hoverA ? 50 : 35, hoverA ? 70 : 50)
      p.stroke(hoverA ? 120 : 70, hoverA ? 150 : 80, hoverA ? 200 : 120)
      p.strokeWeight(hoverA ? 2 : 1)
      p.rect(25, cardY, cardW, cardH, 8)

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Response A', 35, cardY + 8)
      p.fill(200)
      p.textSize(9)
      // Word wrap
      const wrapText = (text: string, x: number, y: number, maxW: number) => {
        const words = text.split(' ')
        let line = ''
        let ly = y
        for (const word of words) {
          const test = line + word + ' '
          if (p.textWidth(test) > maxW && line.length > 0) {
            p.text(line.trim(), x, ly)
            line = word + ' '
            ly += 13
          } else {
            line = test
          }
        }
        if (line.trim()) p.text(line.trim(), x, ly)
      }
      wrapText(pair.responseA, 35, cardY + 28, cardW - 20)

      if (hoverA) {
        p.fill(180, 220, 255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Click to choose A', 25 + cardW / 2, cardY + cardH - 5)
      }

      // Response B card
      const bx = w / 2 + 15
      const hoverB = p.mouseX > bx && p.mouseX < bx + cardW && p.mouseY > cardY && p.mouseY < cardY + cardH
      p.fill(hoverB ? 50 : 35, hoverB ? 50 : 35, hoverB ? 70 : 50)
      p.stroke(hoverB ? 120 : 70, hoverB ? 150 : 80, hoverB ? 200 : 120)
      p.strokeWeight(hoverB ? 2 : 1)
      p.rect(bx, cardY, cardW, cardH, 8)

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.text('Response B', bx + 10, cardY + 8)
      p.fill(200)
      p.textSize(9)
      wrapText(pair.responseB, bx + 10, cardY + 28, cardW - 20)

      if (hoverB) {
        p.fill(180, 220, 255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.BOTTOM)
        p.text('Click to choose B', bx + cardW / 2, cardY + cardH - 5)
      }

      // Reward model scores bar chart
      const chartY = 230
      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Reward Model Accuracy Over Your Labels:', 30, chartY)

      if (currentScores.length > 0) {
        const barW = Math.min(40, (w - 100) / currentScores.length)
        const chartH = 120
        const chartBase = chartY + 150
        for (let i = 0; i < currentScores.length; i++) {
          const correct = currentScores[i]
          const bh = chartH * 0.8
          const bx2 = 50 + i * (barW + 8)
          p.fill(correct ? 80 : 200, correct ? 200 : 80, 80)
          p.noStroke()
          p.rect(bx2, chartBase - bh, barW, bh, 3)
          p.fill(180)
          p.textSize(9)
          p.textAlign(p.CENTER, p.TOP)
          p.text(correct ? 'Y' : 'N', bx2 + barW / 2, chartBase + 4)
          p.text(`#${i + 1}`, bx2 + barW / 2, chartBase + 16)
        }

        const accuracy = currentScores.filter(Boolean).length / currentScores.length
        p.fill(255)
        p.textSize(12)
        p.textAlign(p.LEFT, p.TOP)
        p.text(`Accuracy: ${(accuracy * 100).toFixed(0)}% (${currentScores.filter(Boolean).length}/${currentScores.length} agree with consensus)`, 30, chartY + 24)
      } else {
        p.fill(140)
        p.textSize(11)
        p.text('Click on the response you think is better to train the reward model!', 30, chartY + 30)
      }

      // Explanation if answered
      if (currentScores.length > 0 && currentScores.length <= pairs.length) {
        const prevPair = pairs[Math.min(currentScores.length - 1, pairs.length - 1)]
        p.fill(160)
        p.textSize(10)
        p.textAlign(p.LEFT, p.BOTTOM)
        p.text(`Previous: Consensus pick was ${prevPair.betterLabel} -- ${prevPair.reason}`, 30, p.height - 8)
      }
    }

    p.mousePressed = () => {
      const pi = pairIdxRef.current
      if (pi >= pairs.length) return
      const pair = pairs[pi]
      const w = p.width
      const cardW = (w - 80) / 2
      const cardY = 60
      const cardH = 140
      const bx = w / 2 + 15

      let choice: 'A' | 'B' | null = null
      if (p.mouseX > 25 && p.mouseX < 25 + cardW && p.mouseY > cardY && p.mouseY < cardY + cardH) {
        choice = 'A'
      } else if (p.mouseX > bx && p.mouseX < bx + cardW && p.mouseY > cardY && p.mouseY < cardY + cardH) {
        choice = 'B'
      }

      if (choice) {
        const correct = choice === pair.betterLabel
        const newScores = [...scoresRef.current, correct ? 1 : 0]
        setScores(newScores)
        scoresRef.current = newScores
        const nextIdx = Math.min(pi + 1, pairs.length - 1)
        setPairIdx(nextIdx)
        pairIdxRef.current = nextIdx
      }
    }
  }, [pairs])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Reward Models</h2>
      <p className="text-gray-300 leading-relaxed">
        SFT gives us a model that follows instructions, but how do we teach it which responses are
        <em> better</em> than others? We train a <strong className="text-white">reward model</strong> --
        a separate neural network that takes a (prompt, response) pair and outputs a scalar score
        representing how good the response is.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The reward model is trained on human preference data: annotators are shown two responses to
        the same prompt and asked to choose which one is better. The reward model learns to assign
        higher scores to preferred responses. This is fundamentally a ranking problem -- we do not
        need absolute quality scores, just correct relative ordering.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The training loss is the Bradley-Terry model: given two responses y_w (preferred) and y_l
        (rejected), we maximize <code className="text-emerald-400">log sigmoid(r(x, y_w) - r(x, y_l))</code>.
        This pushes the reward for the preferred response above the rejected one.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Try it yourself below: for each prompt, click the response you think is better. The chart
        tracks how well your preferences align with the consensus labels a reward model would learn from.
      </p>
      <P5Sketch sketch={sketch} height={440} />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- RLHF Pipeline (Animated p5)                           */
/* ================================================================== */
function RLHFSection() {
  const [klWeight, setKlWeight] = useState(0.1)
  const klRef = useRef(klWeight)
  klRef.current = klWeight

  const sketch = useCallback((p: p5) => {
    let t = 0
    let rewardHistory: number[] = []
    let klHistory: number[] = []
    let step = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 700), 480)
      p.textFont('monospace')
      rewardHistory = []
      klHistory = []
      step = 0
    }

    p.draw = () => {
      t += 0.02
      p.background(15, 15, 25)
      const w = p.width

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('RLHF Training Loop', 20, 10)

      // Pipeline boxes
      const boxW = 120
      const boxH = 50
      const pipeY = 45

      // Prompt
      const px = 20
      p.fill(60, 80, 100)
      p.stroke(80, 110, 140)
      p.strokeWeight(1)
      p.rect(px, pipeY, boxW, boxH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Prompt', px + boxW / 2, pipeY + 15)
      p.fill(160)
      p.textSize(8)
      p.text('"Explain X simply"', px + boxW / 2, pipeY + 35)

      // LLM Policy
      const lx = px + boxW + 30
      const pulseLLM = 1 + Math.sin(t * 3) * 0.02
      p.fill(80, 60, 120)
      p.stroke(120, 80, 180)
      p.strokeWeight(1.5)
      p.rect(lx, pipeY - (boxH * pulseLLM - boxH) / 2, boxW * pulseLLM, boxH * pulseLLM, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('LLM (Policy)', lx + boxW / 2, pipeY + 15)
      p.fill(160)
      p.textSize(8)
      p.text('Generates response', lx + boxW / 2, pipeY + 35)

      // Reward Model
      const rx = lx + boxW + 30
      p.fill(100, 80, 40)
      p.stroke(160, 130, 60)
      p.strokeWeight(1)
      p.rect(rx, pipeY, boxW, boxH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.text('Reward Model', rx + boxW / 2, pipeY + 15)
      p.fill(160)
      p.textSize(8)
      p.text('Scores response', rx + boxW / 2, pipeY + 35)

      // PPO Update
      const ux = rx + boxW + 30
      p.fill(60, 100, 60)
      p.stroke(80, 140, 80)
      p.strokeWeight(1)
      p.rect(ux, pipeY, Math.min(boxW, w - ux - 20), boxH, 6)
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.text('PPO Update', ux + Math.min(boxW, w - ux - 20) / 2, pipeY + 15)
      p.fill(160)
      p.textSize(8)
      p.text('Updates LLM', ux + Math.min(boxW, w - ux - 20) / 2, pipeY + 35)

      // Arrows
      const arrowY = pipeY + boxH / 2
      p.stroke(120)
      p.strokeWeight(1.5)
      const drawArrow = (x1: number, x2: number) => {
        p.line(x1, arrowY, x2, arrowY)
        p.fill(120)
        p.noStroke()
        p.triangle(x2 - 6, arrowY - 4, x2 - 6, arrowY + 4, x2, arrowY)
        p.stroke(120)
        p.strokeWeight(1.5)
      }
      drawArrow(px + boxW, lx)
      drawArrow(lx + boxW, rx)
      drawArrow(rx + boxW, ux)

      // Feedback loop arrow back to LLM
      const loopY = pipeY + boxH + 15
      p.stroke(80, 200, 80, 150)
      p.strokeWeight(1.5)
      p.noFill()
      p.line(ux + Math.min(boxW, w - ux - 20) / 2, pipeY + boxH, ux + Math.min(boxW, w - ux - 20) / 2, loopY)
      p.line(ux + Math.min(boxW, w - ux - 20) / 2, loopY, lx + boxW / 2, loopY)
      p.line(lx + boxW / 2, loopY, lx + boxW / 2, pipeY + boxH)
      p.fill(80, 200, 80)
      p.noStroke()
      p.triangle(lx + boxW / 2 - 4, pipeY + boxH + 6, lx + boxW / 2 + 4, pipeY + boxH + 6, lx + boxW / 2, pipeY + boxH)

      // Simulate training
      if (p.frameCount % 4 === 0 && step < 100) {
        step++
        const kl = klRef.current
        // Reward increases over training, but KL penalty limits it
        const rawReward = 0.3 + 0.6 * (1 - Math.exp(-step * 0.05)) + Math.random() * 0.1
        const klDiv = 0.02 * step * (1 - kl * 3) + Math.random() * 0.05
        const adjustedReward = rawReward - kl * klDiv
        rewardHistory.push(Math.max(0, Math.min(1, adjustedReward)))
        klHistory.push(Math.max(0, klDiv))
      }

      // Reward chart
      const chartY = 140
      const chartH = 130
      const chartW = w - 80
      const chartX = 40

      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Reward Over Training Steps (KL penalty = ${klRef.current.toFixed(2)})`, 30, chartY - 5)

      // Chart background
      p.fill(20, 20, 35)
      p.stroke(40)
      p.strokeWeight(1)
      p.rect(chartX, chartY + 15, chartW, chartH, 4)

      // Grid lines
      p.stroke(35, 35, 50)
      for (let i = 0; i <= 4; i++) {
        const gy = chartY + 15 + (chartH * i) / 4
        p.line(chartX, gy, chartX + chartW, gy)
      }

      // Draw reward line
      if (rewardHistory.length > 1) {
        p.stroke(80, 200, 120)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < rewardHistory.length; i++) {
          const x = chartX + (i / 100) * chartW
          const y = chartY + 15 + chartH * (1 - rewardHistory[i])
          p.vertex(x, y)
        }
        p.endShape()
      }

      // Y axis labels
      p.fill(120)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('1.0', chartX - 4, chartY + 15)
      p.text('0.5', chartX - 4, chartY + 15 + chartH / 2)
      p.text('0.0', chartX - 4, chartY + 15 + chartH)

      // KL divergence chart
      const kChartY = chartY + chartH + 50
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('KL Divergence from Base Model:', 30, kChartY - 5)

      p.fill(20, 20, 35)
      p.stroke(40)
      p.strokeWeight(1)
      p.rect(chartX, kChartY + 15, chartW, chartH, 4)

      p.stroke(35, 35, 50)
      for (let i = 0; i <= 4; i++) {
        const gy = kChartY + 15 + (chartH * i) / 4
        p.line(chartX, gy, chartX + chartW, gy)
      }

      if (klHistory.length > 1) {
        p.stroke(220, 120, 80)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        const maxKL = Math.max(...klHistory, 0.1)
        for (let i = 0; i < klHistory.length; i++) {
          const x = chartX + (i / 100) * chartW
          const y = kChartY + 15 + chartH * (1 - klHistory[i] / maxKL)
          p.vertex(x, y)
        }
        p.endShape()
      }

      // Legend
      p.fill(80, 200, 120)
      p.noStroke()
      p.ellipse(chartX + 10, p.height - 15, 8, 8)
      p.fill(160)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Reward (higher = better)', chartX + 18, p.height - 15)

      p.fill(220, 120, 80)
      p.ellipse(chartX + 200, p.height - 15, 8, 8)
      p.fill(160)
      p.text('KL divergence (drift from base model)', chartX + 208, p.height - 15)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">RLHF: Reinforcement Learning from Human Feedback</h2>
      <p className="text-gray-300 leading-relaxed">
        With a trained reward model, we can now optimize the LLM to produce responses that score
        highly. This is the core of <strong className="text-white">RLHF</strong>: we treat the LLM
        as an RL policy, the prompt as the state, the generated response as the action, and the
        reward model score as the reward. The optimization algorithm is typically
        <strong className="text-white"> Proximal Policy Optimization (PPO)</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        A critical element is the <strong className="text-white">KL penalty</strong>: we add a term
        that penalizes the fine-tuned model for deviating too far from the original SFT model. The
        total objective is <code className="text-emerald-400">reward(x, y) - beta * KL(policy || reference)</code>.
        Without the KL penalty, the model would quickly learn to "hack" the reward model -- producing
        degenerate outputs that score highly but are not actually good responses (reward hacking).
      </p>
      <p className="text-gray-300 leading-relaxed">
        The visualization below shows the RLHF training loop in action. Adjust the KL penalty weight
        to see how it affects the reward trajectory and model drift. Low KL penalty allows higher
        reward but more drift; high KL penalty keeps the model close to the base but limits improvement.
      </p>
      <P5Sketch
        sketch={sketch}
        height={480}
        controls={
          <ControlPanel title="RLHF Parameters">
            <InteractiveSlider label="KL Penalty (beta)" min={0.0} max={0.5} step={0.02} value={klWeight} onChange={(v) => { setKlWeight(v); klRef.current = v }} />
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- DPO                                                   */
/* ================================================================== */
function DPOSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">DPO: Direct Preference Optimization</h2>
      <p className="text-gray-300 leading-relaxed">
        RLHF works, but it is complex: you need to train a separate reward model, run PPO (which is
        notoriously unstable), and manage the interplay between the policy, reward model, and reference
        model. In 2023, Rafailov et al. proposed <strong className="text-white">Direct Preference
        Optimization (DPO)</strong>, which elegantly sidesteps all of this.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The key insight is mathematical: the optimal policy under the RLHF objective has a closed-form
        relationship with the reward function. This means we can reparameterize the reward model loss
        directly in terms of the policy, eliminating the need for a separate reward model and RL
        training entirely. The DPO loss is:
      </p>
      <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
        <code className="text-emerald-400 text-sm">
          L_DPO = -log sigmoid(beta * (log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x)))
        </code>
      </div>
      <p className="text-gray-300 leading-relaxed">
        This loss directly increases the probability of preferred responses relative to rejected ones,
        while the reference model ratio acts as an implicit KL constraint. DPO has become increasingly
        popular because it is simpler, more stable, and often achieves comparable or better results than RLHF.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">RLHF vs DPO: Comparison</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="rounded-lg border border-blue-800/50 bg-blue-900/20 p-5">
          <h4 className="text-white font-semibold mb-3">RLHF (PPO)</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Battle-tested at scale (GPT-4, Claude)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Reward model can be reused and inspected</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Can do online learning (generate new responses)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>Complex pipeline: 3 models (policy, reference, reward)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>PPO is finicky to tune (hyperparameters, stability)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>High compute cost (reward model + RL training)</span>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-purple-800/50 bg-purple-900/20 p-5">
          <h4 className="text-white font-semibold mb-3">DPO</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Simple: just supervised learning on preference pairs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>No reward model needed, no RL instability</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Fewer hyperparameters, easier to implement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>Mathematically equivalent to RLHF optimal policy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>Offline only (works with fixed preference dataset)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>Less explored at frontier scale</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Constitutional AI                                     */
/* ================================================================== */
function ConstitutionalAISection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Constitutional AI</h2>
      <p className="text-gray-300 leading-relaxed">
        Gathering human preference data is expensive, slow, and sometimes exposes annotators to
        harmful content. <strong className="text-white">Constitutional AI (CAI)</strong>, developed
        by Anthropic, offers an alternative: instead of humans labeling preferences, the model
        critiques and revises its own outputs based on a set of principles (a "constitution").
      </p>
      <p className="text-gray-300 leading-relaxed">
        The CAI process has two phases. In the <strong className="text-white">critique-revision phase</strong>,
        the model generates a response, then is asked to critique it according to a principle
        (e.g., "Is this response harmful? If so, revise it to be helpful and harmless"). The revised
        responses form the SFT dataset. In the <strong className="text-white">RL phase</strong>,
        the model itself acts as the preference labeler -- choosing which of two responses better
        adheres to the constitution -- replacing human annotators.
      </p>

      <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700 mt-4">
        <h3 className="text-white font-semibold mb-3">The CAI Self-Improvement Loop</h3>
        <div className="flex flex-col gap-2">
          {[
            { step: '1', label: 'Generate', desc: 'Model produces an initial response to a prompt' },
            { step: '2', label: 'Critique', desc: 'Model evaluates its own response against a constitutional principle' },
            { step: '3', label: 'Revise', desc: 'Model rewrites the response to better follow the principle' },
            { step: '4', label: 'Train', desc: 'Use (prompt, revised response) pairs for SFT, then RLAIF for RL' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {item.step}
              </div>
              <div>
                <span className="text-white font-medium">{item.label}: </span>
                <span className="text-gray-300 text-sm">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-gray-300 leading-relaxed">
        CAI dramatically reduces the need for human feedback, makes the alignment criteria explicit
        and auditable, and can scale to address many different principles simultaneously. The term
        "RLAIF" (RL from AI Feedback) is used when the AI itself provides the preference labels.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- The Alignment Tax                                     */
/* ================================================================== */
function AlignmentTaxSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Alignment Tax</h2>
      <p className="text-gray-300 leading-relaxed">
        Alignment is not free. Fine-tuning a model to be helpful and safe can reduce its raw
        capability on some benchmarks -- this is called the <strong className="text-white">alignment
        tax</strong>. A model that refuses to help with dangerous requests is, by definition, less
        "capable" at those tasks. A model that hedges its answers with caveats may score lower on
        tasks that reward confident, direct responses.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The alignment tax manifests in several ways:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Refusal behavior:</strong> Aligned models sometimes refuse
          benign requests that superficially resemble harmful ones (over-refusal).
        </li>
        <li>
          <strong className="text-white">Verbosity:</strong> RLHF can incentivize longer, more
          hedged responses because human raters sometimes prefer thorough answers.
        </li>
        <li>
          <strong className="text-white">Sycophancy:</strong> Models trained to please human raters
          may agree with incorrect statements rather than correct them.
        </li>
        <li>
          <strong className="text-white">Reduced creativity:</strong> Safety fine-tuning can make
          models more conservative and less willing to explore unusual ideas.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The goal of alignment research is to minimize this tax: making models that are simultaneously
        maximally helpful AND safe. This is an active area of research, and the tradeoff between
        capability and alignment is one of the central challenges in AI development.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- PythonCell: Reward Model Training                     */
/* ================================================================== */
function PythonRewardModelSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Simulating Reward Model Training</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us simulate training a reward model. We have preference pairs where a human has labeled
        one response as better. The reward model learns a scoring function that assigns higher scores
        to preferred responses. We use the Bradley-Terry loss: the probability that response A is
        preferred over B is sigmoid(r(A) - r(B)).
      </p>
      <PythonCell
        defaultCode={`import numpy as np

# Simulate preference data
# Each response is represented by a simple feature vector
# Features: [helpfulness, accuracy, clarity, conciseness, safety]
np.random.seed(42)

# Generate response pairs with human preferences
n_pairs = 200
dim = 5
feature_names = ['helpful', 'accurate', 'clear', 'concise', 'safe']

# True (hidden) human preference weights
true_weights = np.array([0.35, 0.25, 0.20, 0.10, 0.10])

preferred = np.random.randn(n_pairs, dim) * 0.5 + 0.5  # generally positive
rejected = np.random.randn(n_pairs, dim) * 0.5           # generally lower

# Ensure preferred actually has higher true reward
for i in range(n_pairs):
    if true_weights @ preferred[i] < true_weights @ rejected[i]:
        preferred[i], rejected[i] = rejected[i].copy(), preferred[i].copy()

# Add noise (humans disagree ~15% of the time)
noise_mask = np.random.rand(n_pairs) < 0.15
for i in range(n_pairs):
    if noise_mask[i]:
        preferred[i], rejected[i] = rejected[i].copy(), preferred[i].copy()

print("=== Reward Model Training ===")
print(f"Training pairs: {n_pairs}")
print(f"Features: {feature_names}")
print(f"True preference weights: {dict(zip(feature_names, true_weights.round(2)))}\\n")

# Train reward model using gradient descent on Bradley-Terry loss
def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -20, 20)))

# Initialize learned weights
w = np.random.randn(dim) * 0.1
lr = 0.05
losses = []

for epoch in range(100):
    # Forward pass
    r_pref = preferred @ w     # reward for preferred
    r_rej = rejected @ w       # reward for rejected
    diff = r_pref - r_rej

    # Bradley-Terry loss: -log(sigmoid(r_pref - r_rej))
    loss = -np.mean(np.log(sigmoid(diff) + 1e-10))
    losses.append(loss)

    # Gradient
    grad = -np.mean((1 - sigmoid(diff))[:, None] * (preferred - rejected), axis=0)
    w -= lr * grad

    if epoch % 20 == 0:
        acc = np.mean(diff > 0)
        print(f"Epoch {epoch:3d}: loss={loss:.4f}, accuracy={acc:.1%}")

# Final results
r_pref_final = preferred @ w
r_rej_final = rejected @ w
final_acc = np.mean(r_pref_final > r_rej_final)
print(f"\\nFinal accuracy: {final_acc:.1%}")

# Compare learned vs true weights (normalized)
w_norm = w / np.sum(np.abs(w))
print(f"\\nLearned weights (normalized):")
for name, lw, tw in zip(feature_names, w_norm, true_weights):
    bar_l = '#' * int(abs(lw) * 30)
    bar_t = '#' * int(tw * 30)
    print(f"  {name:10s} learned: {lw:+.3f} |{bar_l}")
    print(f"  {' ':10s} true:    {tw:+.3f} |{bar_t}")

print("\\nThe reward model recovers the approximate preference ordering!")
print("Helpfulness and accuracy matter most to our simulated humans.")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- PythonCell: RLHF Simulation                           */
/* ================================================================== */
function PythonRLHFSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Simulating RLHF with KL Penalty</h2>
      <p className="text-gray-300 leading-relaxed">
        Now let us simulate the RLHF training loop. We have a policy (the LLM) that generates
        "responses" (represented as distributions over features), a reward model that scores them,
        and a KL penalty that prevents the policy from drifting too far from the reference (SFT) model.
        Watch how different KL penalty strengths affect the reward-drift tradeoff.
      </p>
      <PythonCell
        defaultCode={`import numpy as np

np.random.seed(42)

# Simplified RLHF simulation
# Policy = Gaussian distribution over response features
# We optimize the mean of this distribution to maximize reward - KL penalty

dim = 5
feature_names = ['helpful', 'accurate', 'clear', 'concise', 'safe']

# Reference policy (SFT model) -- decent but not optimal
ref_mean = np.array([0.4, 0.3, 0.3, 0.3, 0.5])
ref_std = 0.3

# Reward model weights (from previous exercise)
reward_weights = np.array([0.35, 0.25, 0.20, 0.10, 0.10])

def reward(features):
    return reward_weights @ features

def kl_divergence(mu1, mu2, std):
    """KL(N(mu1,std) || N(mu2,std)) for diagonal Gaussians."""
    return 0.5 * np.sum((mu1 - mu2)**2) / (std**2)

def simulate_rlhf(beta, n_steps=150, lr=0.02):
    """Run RLHF with given KL penalty beta."""
    mu = ref_mean.copy()  # Start from reference policy
    rewards = []
    kls = []
    objectives = []

    for step in range(n_steps):
        # Sample a response from current policy
        response = mu + np.random.randn(dim) * ref_std

        # Compute reward and KL
        r = reward(response)
        kl = kl_divergence(mu, ref_mean, ref_std)
        obj = r - beta * kl

        rewards.append(r)
        kls.append(kl)
        objectives.append(obj)

        # Policy gradient: move mean toward higher reward, away from KL increase
        grad_reward = reward_weights  # d(reward)/d(mu)
        grad_kl = (mu - ref_mean) / (ref_std**2)  # d(KL)/d(mu)
        grad = grad_reward - beta * grad_kl

        mu = mu + lr * grad

    return rewards, kls, objectives, mu

# Try different KL penalties
print("=== RLHF Simulation with Different KL Penalties ===\\n")
print(f"Reference (SFT) policy mean: {dict(zip(feature_names, ref_mean.round(2)))}\\n")

betas = [0.0, 0.05, 0.2, 1.0]
results = {}

for beta in betas:
    rewards, kls, objectives, final_mu = simulate_rlhf(beta)
    results[beta] = (rewards, kls, objectives, final_mu)

    avg_reward_last20 = np.mean(rewards[-20:])
    avg_kl_last20 = np.mean(kls[-20:])

    print(f"beta = {beta:.2f}:")
    print(f"  Final mean reward:  {avg_reward_last20:.3f}")
    print(f"  Final KL from ref:  {avg_kl_last20:.3f}")
    print(f"  Final policy mean:  {dict(zip(feature_names, final_mu.round(3)))}")
    print()

# Show the tradeoff
print("=== The KL-Reward Tradeoff ===")
print(f"{'beta':>6s} | {'Reward':>8s} | {'KL':>8s} | {'Objective':>10s}")
print("-" * 40)
for beta in betas:
    rewards, kls, objectives, _ = results[beta]
    r = np.mean(rewards[-20:])
    k = np.mean(kls[-20:])
    o = np.mean(objectives[-20:])
    print(f"{beta:6.2f} | {r:8.3f} | {k:8.3f} | {o:10.3f}")

print()
print("Key observations:")
print("- beta=0: Maximum reward but huge KL drift (reward hacking risk!)")
print("- beta=0.05: High reward with moderate drift (good balance)")
print("- beta=0.2: Moderate reward, stays close to reference")
print("- beta=1.0: Barely moves from reference (too conservative)")
print("\\nThe art of RLHF is choosing beta to maximize helpfulness")
print("while preventing the model from drifting into reward hacking.")`}
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Alignment() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Fine-Tuning & Alignment</h1>
        <p className="text-lg text-gray-400">
          Pretrained language models are powerful but not aligned with human intent by default.
          Learn how SFT, reward modeling, RLHF, DPO, and Constitutional AI steer these models
          to be helpful, honest, and safe.
        </p>
      </header>

      <AlignmentProblemSection />
      <SFTSection />
      <RewardModelSection />
      <RLHFSection />
      <DPOSection />
      <ConstitutionalAISection />
      <AlignmentTaxSection />
      <PythonRewardModelSection />
      <PythonRLHFSection />
    </div>
  )
}
