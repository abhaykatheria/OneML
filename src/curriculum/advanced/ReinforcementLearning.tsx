import { useState, useCallback, useRef } from 'react'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import InteractiveSlider from '../../components/viz/InteractiveSlider'
import ControlPanel from '../../components/viz/ControlPanel'

export const meta: LessonMeta = {
  id: 'advanced/reinforcement-learning',
  title: 'Reinforcement Learning',
  description: 'Agents, environments, rewards, Q-learning, and the exploration-exploitation tradeoff',
  track: 'advanced',
  order: 1,
  tags: ['reinforcement-learning', 'q-learning', 'mdp', 'epsilon-greedy', 'td-learning'],
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const GRID_ROWS = 5
const GRID_COLS = 7
const GOAL_R = 0
const GOAL_C = 6
const WALLS: [number, number][] = [
  [1, 1], [1, 2], [2, 4], [3, 1], [3, 4], [3, 5], [4, 3],
]
const TRAP_R = 2
const TRAP_C = 2
const ACTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0]] // left, right, up, down
const ACTION_LABELS = ['\u2190', '\u2192', '\u2191', '\u2193']

function isWall(r: number, c: number): boolean {
  return WALLS.some(([wr, wc]) => wr === r && wc === c)
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS
}

/* ------------------------------------------------------------------ */
/*  Grid World Q-value helpers                                         */
/* ------------------------------------------------------------------ */
function createQTable(): number[][][] {
  const q: number[][][] = []
  for (let r = 0; r < GRID_ROWS; r++) {
    q[r] = []
    for (let c = 0; c < GRID_COLS; c++) {
      q[r][c] = [0, 0, 0, 0]
    }
  }
  return q
}

function getReward(r: number, c: number): number {
  if (r === GOAL_R && c === GOAL_C) return 10
  if (r === TRAP_R && c === TRAP_C) return -5
  return -0.1
}

function step(r: number, c: number, action: number): [number, number] {
  const [dr, dc] = ACTIONS[action]
  const nr = r + dr
  const nc = c + dc
  if (!inBounds(nr, nc) || isWall(nr, nc)) return [r, c]
  return [nr, nc]
}

/* ================================================================== */
/*  Section 1 -- Agent-Environment Loop                                */
/* ================================================================== */
function AgentEnvironmentSection() {
  const frameRef = useRef(0)
  const agentRef = useRef({ r: 4, c: 0, path: [[4, 0]] as [number, number][] })
  const phaseRef = useRef<'move' | 'pause'>('move')
  const pauseCountRef = useRef(0)
  const rewardFlashRef = useRef<{ r: number; c: number; val: number; t: number } | null>(null)

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 340)
      p.textFont('monospace')
      p.frameRate(8)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const cellW = Math.min((W - 40) / GRID_COLS, (H - 70) / GRID_ROWS)
      const offX = (W - cellW * GRID_COLS) / 2
      const offY = 40

      // Title
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text('Agent-Environment Loop: Watch the agent explore the grid world', W / 2, 22)

      // Grid
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const x = offX + c * cellW
          const y = offY + r * cellW
          if (isWall(r, c)) {
            p.fill(50, 50, 60)
          } else if (r === GOAL_R && c === GOAL_C) {
            p.fill(30, 120, 60)
          } else if (r === TRAP_R && c === TRAP_C) {
            p.fill(120, 30, 30)
          } else {
            p.fill(25, 25, 40)
          }
          p.stroke(60)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellW)

          // Labels
          p.noStroke()
          p.textSize(10)
          p.textAlign(p.CENTER, p.CENTER)
          if (r === GOAL_R && c === GOAL_C) {
            p.fill(200, 255, 200)
            p.text('+10', x + cellW / 2, y + cellW / 2)
          } else if (r === TRAP_R && c === TRAP_C) {
            p.fill(255, 150, 150)
            p.text('-5', x + cellW / 2, y + cellW / 2)
          }
        }
      }

      // Agent path trail
      const agent = agentRef.current
      p.noStroke()
      for (let i = 0; i < agent.path.length - 1; i++) {
        const [pr, pc] = agent.path[i]
        const alpha = p.map(i, 0, agent.path.length - 1, 30, 120)
        p.fill(100, 180, 255, alpha)
        p.ellipse(offX + pc * cellW + cellW / 2, offY + pr * cellW + cellW / 2, cellW * 0.2)
      }

      // Agent
      p.fill(100, 180, 255)
      p.ellipse(offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2, cellW * 0.55)
      p.fill(255)
      p.textSize(14)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('A', offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2)

      // Reward flash
      if (rewardFlashRef.current) {
        const rf = rewardFlashRef.current
        const alpha = p.map(rf.t, 0, 6, 255, 0)
        p.fill(rf.val > 0 ? p.color(100, 255, 100, alpha) : p.color(255, 100, 100, alpha))
        p.textSize(16)
        p.textAlign(p.CENTER, p.CENTER)
        p.text((rf.val > 0 ? '+' : '') + rf.val, offX + rf.c * cellW + cellW / 2, offY + rf.r * cellW - 8)
        rf.t++
        if (rf.t > 6) rewardFlashRef.current = null
      }

      // Legend
      const ly = offY + GRID_ROWS * cellW + 14
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.fill(100, 180, 255); p.text('\u25CF Agent', offX, ly)
      p.fill(80, 200, 120); p.text('\u25A0 Goal (+10)', offX + 80, ly)
      p.fill(200, 80, 80); p.text('\u25A0 Trap (-5)', offX + 180, ly)
      p.fill(100); p.text('\u25A0 Wall', offX + 270, ly)

      // Move agent
      frameRef.current++
      if (phaseRef.current === 'pause') {
        pauseCountRef.current++
        if (pauseCountRef.current > 3) {
          phaseRef.current = 'move'
          agentRef.current = { r: 4, c: 0, path: [[4, 0]] }
        }
        return
      }

      if (frameRef.current % 1 === 0) {
        const a = Math.floor(Math.random() * 4)
        const [nr, nc] = step(agent.r, agent.c, a) as [number, number]
        const rwd = getReward(nr, nc)
        agent.r = nr
        agent.c = nc
        agent.path.push([nr, nc])

        if (rwd !== -0.1) {
          rewardFlashRef.current = { r: nr, c: nc, val: rwd, t: 0 }
        }
        if ((nr === GOAL_R && nc === GOAL_C) || agent.path.length > 40) {
          phaseRef.current = 'pause'
          pauseCountRef.current = 0
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The Agent-Environment Loop</h2>
      <p className="text-gray-300 leading-relaxed">
        Reinforcement learning is fundamentally different from supervised learning. Instead of
        learning from labeled examples, an <span className="text-emerald-400 font-semibold">agent</span> learns
        by interacting with an <span className="text-emerald-400 font-semibold">environment</span>. At each
        time step, the agent observes its current state, takes an action, receives a reward, and
        transitions to a new state. The goal is to learn a policy -- a mapping from states to
        actions -- that maximizes the cumulative reward over time.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Below, watch a random agent explore a grid world. The green cell is the goal (+10 reward),
        the red cell is a trap (-5 reward), and gray cells are impassable walls. Every other move
        costs -0.1 to encourage reaching the goal quickly. Right now the agent acts randomly,
        bumbling around without any strategy. Later, we will teach it to find the optimal path.
      </p>
      <P5Sketch sketch={sketch} height={340} />
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Markov Decision Processes                             */
/* ================================================================== */
function MDPSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Markov Decision Processes</h2>
      <p className="text-gray-300 leading-relaxed">
        The mathematical framework behind reinforcement learning is the Markov Decision Process
        (MDP). An MDP is defined by five components:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <span className="text-white font-semibold">States (S)</span> -- all possible situations
          the agent can be in. In our grid world, each cell is a state.
        </li>
        <li>
          <span className="text-white font-semibold">Actions (A)</span> -- the moves the agent can
          make. Here: up, down, left, right.
        </li>
        <li>
          <span className="text-white font-semibold">Transition function T(s, a, s')</span> -- the
          probability of ending up in state s' after taking action a in state s. Our grid world is
          deterministic (actions always succeed), but many real environments are stochastic.
        </li>
        <li>
          <span className="text-white font-semibold">Reward function R(s, a, s')</span> -- the
          immediate reward received after transitioning. The agent's objective is to maximize the
          sum of future rewards, not just the immediate one.
        </li>
        <li>
          <span className="text-white font-semibold">Discount factor (&gamma;)</span> -- a value
          between 0 and 1 that determines how much the agent values future rewards versus immediate
          ones. &gamma; = 0 means the agent is completely myopic (only cares about the next
          reward); &gamma; = 1 means it values all future rewards equally.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        The "Markov" property states that the future depends only on the current state, not on the
        history of how the agent got there. This simplifies the problem enormously: the agent does
        not need to remember its entire trajectory, only its current position.
      </p>
      <h3 className="text-xl font-bold text-white mt-6">Value Functions</h3>
      <p className="text-gray-300 leading-relaxed">
        A <span className="text-emerald-400 font-semibold">state-value function V(s)</span> tells
        us the expected cumulative reward starting from state s and following a particular policy.
        The <span className="text-emerald-400 font-semibold">action-value function Q(s, a)</span> tells
        us the expected cumulative reward of taking action a in state s and then following the
        policy. The optimal policy selects the action with the highest Q-value in every state.
        This is the key idea behind Q-learning.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The Bellman equation relates the value of a state to the values of its successor states:
        <span className="font-mono text-emerald-400"> Q(s, a) = R(s, a) + &gamma; * max_a' Q(s', a')</span>.
        This recursive structure is what makes dynamic programming and Q-learning possible: we can
        iteratively improve our estimates by bootstrapping from the estimates of neighboring states.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Q-Learning Visualization                              */
/* ================================================================== */
function QLearningSection() {
  const [learningRate, setLearningRate] = useState(0.3)
  const [epsilon, setEpsilon] = useState(0.3)
  const [running, setRunning] = useState(false)

  const lrRef = useRef(learningRate)
  const epsRef = useRef(epsilon)
  const runRef = useRef(running)
  lrRef.current = learningRate
  epsRef.current = epsilon
  runRef.current = running

  const qTableRef = useRef(createQTable())
  const agentStateRef = useRef({ r: 4, c: 0 })
  const episodeRef = useRef(0)
  const stepCountRef = useRef(0)
  const totalRewardRef = useRef(0)

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 420)
      p.textFont('monospace')
      p.frameRate(30)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const cellW = Math.min((W - 40) / GRID_COLS, (H - 100) / GRID_ROWS)
      const offX = (W - cellW * GRID_COLS) / 2
      const offY = 50

      const Q = qTableRef.current
      const agent = agentStateRef.current

      // Header
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text(
        `Episode: ${episodeRef.current}   Steps: ${stepCountRef.current}   Total reward: ${totalRewardRef.current.toFixed(1)}`,
        W / 2, 22
      )
      p.textSize(10)
      p.text(running ? 'Training... (toggle off to pause)' : 'Press "Start Training" to begin', W / 2, 38)

      // Grid with Q-values
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const x = offX + c * cellW
          const y = offY + r * cellW

          if (isWall(r, c)) {
            p.fill(50, 50, 60)
            p.stroke(60)
            p.strokeWeight(1)
            p.rect(x, y, cellW, cellW)
            continue
          }

          // Cell background based on max Q-value
          const maxQ = Math.max(...Q[r][c])
          if (r === GOAL_R && c === GOAL_C) {
            p.fill(30, 120, 60)
          } else if (r === TRAP_R && c === TRAP_C) {
            p.fill(120, 30, 30)
          } else {
            const g = p.map(maxQ, -5, 10, 20, 60)
            p.fill(20, g, 35)
          }
          p.stroke(60)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellW)

          // Q-value arrows: show best action direction
          if (cellW > 35) {
            const bestA = Q[r][c].indexOf(Math.max(...Q[r][c]))
            p.noStroke()
            p.fill(200, 200, 255, 180)
            p.textSize(Math.min(14, cellW * 0.25))
            p.textAlign(p.CENTER, p.CENTER)
            p.text(ACTION_LABELS[bestA], x + cellW / 2, y + cellW * 0.3)

            // Show max Q value
            p.fill(180)
            p.textSize(Math.min(9, cellW * 0.16))
            p.text(maxQ.toFixed(1), x + cellW / 2, y + cellW * 0.65)
          }
        }
      }

      // Agent
      p.noStroke()
      p.fill(100, 180, 255)
      p.ellipse(offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2, cellW * 0.45)
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('A', offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2)

      // Legend
      const ly = offY + GRID_ROWS * cellW + 14
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.fill(200, 200, 255)
      p.text('Arrow = best action   Number = max Q(s,a)', offX, ly)
      p.fill(130)
      p.text(`\u03B1=${lrRef.current.toFixed(2)}  \u03B5=${epsRef.current.toFixed(2)}  \u03B3=0.95`, offX, ly + 14)

      // Run Q-learning steps
      if (runRef.current) {
        const stepsPerFrame = 5
        for (let i = 0; i < stepsPerFrame; i++) {
          const lr = lrRef.current
          const eps = epsRef.current
          const gamma = 0.95
          const sr = agent.r
          const sc = agent.c

          // Epsilon-greedy action selection
          let action: number
          if (Math.random() < eps) {
            action = Math.floor(Math.random() * 4)
          } else {
            const qVals = Q[sr][sc]
            action = qVals.indexOf(Math.max(...qVals))
          }

          const [nr, nc] = step(sr, sc, action) as [number, number]
          const reward = getReward(nr, nc)
          totalRewardRef.current += reward
          stepCountRef.current++

          // Q-learning update: Q(s,a) += alpha * (r + gamma * max Q(s',a') - Q(s,a))
          const maxNextQ = Math.max(...Q[nr][nc])
          Q[sr][sc][action] += lr * (reward + gamma * maxNextQ - Q[sr][sc][action])

          agent.r = nr
          agent.c = nc

          // Episode termination
          if ((nr === GOAL_R && nc === GOAL_C) || stepCountRef.current > 200) {
            episodeRef.current++
            agent.r = 4
            agent.c = 0
            stepCountRef.current = 0
            totalRewardRef.current = 0
          }
        }
      }
    }
  }, [running])

  const handleReset = () => {
    qTableRef.current = createQTable()
    agentStateRef.current = { r: 4, c: 0 }
    episodeRef.current = 0
    stepCountRef.current = 0
    totalRewardRef.current = 0
    setRunning(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Q-Learning in Action</h2>
      <p className="text-gray-300 leading-relaxed">
        Q-learning is a model-free algorithm that learns the optimal action-value function directly
        from experience. The agent does not need to know the transition probabilities or the reward
        function in advance -- it discovers them by trial and error. The update rule is:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        Q(s, a) &larr; Q(s, a) + &alpha; * [r + &gamma; * max<sub>a'</sub> Q(s', a') - Q(s, a)]
      </p>
      <p className="text-gray-300 leading-relaxed">
        The visualization below shows the agent learning in real time. Each cell displays an arrow
        pointing in the direction of the best action (highest Q-value) and the numeric value of
        that Q-value. Watch how the Q-values propagate backward from the goal as the agent
        discovers rewarding paths. Cells near the goal develop high values first; then that
        information slowly spreads through the grid.
      </p>
      <P5Sketch sketch={sketch} height={420} controls={
        <ControlPanel title="Q-Learning Parameters">
          <InteractiveSlider label="Learning Rate (\u03B1)" min={0.01} max={0.9} step={0.01} value={learningRate} onChange={setLearningRate} />
          <InteractiveSlider label="Epsilon (\u03B5)" min={0.01} max={1.0} step={0.01} value={epsilon} onChange={setEpsilon} />
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${running ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
            >
              {running ? 'Pause Training' : 'Start Training'}
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
/*  Section 4 -- Exploration vs Exploitation                           */
/* ================================================================== */
function ExplorationSection() {
  const [epsValue, setEpsValue] = useState(0.5)
  const epsRef = useRef(epsValue)
  epsRef.current = epsValue

  const countsRef = useRef<number[]>([0, 0, 0, 0, 0])
  const totalRef = useRef(0)
  const trueProbs = useRef([0.1, 0.3, 0.7, 0.2, 0.5])
  const estimatedRef = useRef([0, 0, 0, 0, 0])

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 350)
      p.textFont('monospace')
      p.frameRate(20)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const eps = epsRef.current
      const counts = countsRef.current
      const est = estimatedRef.current
      const trueP = trueProbs.current
      const nArms = 5

      // Run some pulls per frame
      for (let t = 0; t < 3; t++) {
        let arm: number
        if (Math.random() < eps) {
          arm = Math.floor(Math.random() * nArms)
        } else {
          arm = est.indexOf(Math.max(...est))
        }
        counts[arm]++
        totalRef.current++
        const reward = Math.random() < trueP[arm] ? 1 : 0
        est[arm] += (reward - est[arm]) / counts[arm]
      }

      const barW = (W - 120) / nArms
      const barMaxH = H - 140
      const offX = 60
      const offY = 50
      const baseY = offY + barMaxH

      // Title
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text(`Epsilon-Greedy Bandit  |  \u03B5 = ${eps.toFixed(2)}  |  Pulls: ${totalRef.current}`, W / 2, 25)

      // Labels
      p.textSize(10)
      p.textAlign(p.CENTER)
      p.fill(150)
      p.text('True reward probability (hidden)', W / 2, 42)

      for (let i = 0; i < nArms; i++) {
        const x = offX + i * barW + barW * 0.1
        const bw = barW * 0.35

        // True probability bar
        const trueH = trueP[i] * barMaxH
        p.fill(60, 60, 100)
        p.noStroke()
        p.rect(x, baseY - trueH, bw, trueH)

        // Estimated bar
        const estH = Math.max(0, est[i]) * barMaxH
        p.fill(100, 180, 255, 200)
        p.rect(x + bw + 4, baseY - estH, bw, estH)

        // Arm label
        p.fill(200)
        p.textSize(10)
        p.textAlign(p.CENTER)
        p.text(`Arm ${i + 1}`, x + bw, baseY + 14)
        p.fill(130)
        p.textSize(9)
        p.text(`n=${counts[i]}`, x + bw, baseY + 26)

        // Greedy indicator
        if (est.indexOf(Math.max(...est)) === i) {
          p.fill(255, 220, 80)
          p.textSize(10)
          p.text('\u2605', x + bw, baseY + 38)
        }
      }

      // Axis
      p.stroke(80)
      p.strokeWeight(1)
      p.line(offX - 5, baseY, offX + nArms * barW, baseY)

      // Y-axis labels
      p.noStroke()
      p.fill(120)
      p.textSize(9)
      p.textAlign(p.RIGHT, p.CENTER)
      for (let v = 0; v <= 1; v += 0.25) {
        const y = baseY - v * barMaxH
        p.text(v.toFixed(2), offX - 10, y)
        p.stroke(40)
        p.strokeWeight(0.5)
        p.line(offX, y, offX + nArms * barW, y)
        p.noStroke()
      }

      // Legend
      p.textAlign(p.LEFT)
      p.textSize(10)
      p.fill(60, 60, 100); p.rect(offX, baseY + 42, 12, 10)
      p.fill(180); p.text('True probability', offX + 18, baseY + 51)
      p.fill(100, 180, 255); p.rect(offX + 140, baseY + 42, 12, 10)
      p.fill(180); p.text('Estimated (by agent)', offX + 158, baseY + 51)
    }
  }, [])

  const handleReset = () => {
    countsRef.current = [0, 0, 0, 0, 0]
    totalRef.current = 0
    estimatedRef.current = [0, 0, 0, 0, 0]
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Exploration vs. Exploitation</h2>
      <p className="text-gray-300 leading-relaxed">
        One of the central challenges in RL is the exploration-exploitation dilemma. Should the
        agent <span className="text-emerald-400 font-semibold">exploit</span> what it already knows
        (pick the action it thinks is best) or <span className="text-emerald-400 font-semibold">explore</span> (try
        something new that might turn out to be better)?
      </p>
      <p className="text-gray-300 leading-relaxed">
        The simplest strategy is <span className="text-white font-semibold">epsilon-greedy</span>: with
        probability &epsilon; the agent picks a random action (explore), and with probability
        1 - &epsilon; it picks the action with the highest estimated value (exploit). A high
        &epsilon; means lots of exploration but slow convergence. A low &epsilon; means the agent
        commits early to what it thinks is best -- but if its initial estimates are wrong, it may
        get stuck on a suboptimal action.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The visualization below shows a 5-armed bandit problem. Each arm has a hidden true reward
        probability. The agent pulls arms using epsilon-greedy and updates its estimates. Try
        setting &epsilon; high (0.8+) vs low (0.05) and watch how the sampling pattern changes.
      </p>
      <P5Sketch sketch={sketch} height={350} controls={
        <ControlPanel title="Exploration Settings">
          <InteractiveSlider label="Epsilon (\u03B5)" min={0.0} max={1.0} step={0.01} value={epsValue} onChange={setEpsValue} />
          <button
            onClick={handleReset}
            className="px-4 py-1.5 rounded text-sm font-medium bg-gray-600 text-white"
          >
            Reset Estimates
          </button>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Temporal Difference Learning                          */
/* ================================================================== */
function TDLearningSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Temporal Difference Learning</h2>
      <p className="text-gray-300 leading-relaxed">
        Q-learning is a specific instance of <span className="text-white font-semibold">Temporal
        Difference (TD) learning</span>, one of the most important ideas in RL. The key insight
        is that we do not need to wait until the end of an episode to update our value estimates.
        Instead, we can update after every single step, using the observed reward plus our
        current estimate of the next state's value as a "bootstrap" target.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">TD(0): One-Step Bootstrapping</h3>
      <p className="text-gray-300 leading-relaxed">
        The simplest TD method, TD(0), updates the state-value function after each step:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        V(s) &larr; V(s) + &alpha; * [r + &gamma; * V(s') - V(s)]
      </p>
      <p className="text-gray-300 leading-relaxed">
        The quantity <span className="font-mono text-emerald-400">r + &gamma; * V(s') - V(s)</span> is
        called the <span className="text-white font-semibold">TD error</span> (or temporal
        difference). It measures how surprised the agent is: if the reward plus the estimated
        future value is higher than expected, the TD error is positive and the value estimate
        increases. If it is lower, the estimate decreases.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">Why Bootstrapping Works</h3>
      <p className="text-gray-300 leading-relaxed">
        This is remarkable: TD methods update an estimate using another estimate. This seems
        circular, yet it converges to the true values under mild conditions. The intuition is
        that the observed reward r is ground truth -- it anchors the bootstrap. Over many
        updates, error in V(s') gets corrected, and the correction propagates backward through
        the state space. This is much more sample-efficient than Monte Carlo methods, which
        must wait for complete episodes.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">SARSA vs Q-Learning</h3>
      <p className="text-gray-300 leading-relaxed">
        Two important variants of TD control differ in a subtle but significant way.
        <span className="text-white font-semibold"> SARSA</span> (State-Action-Reward-State-Action)
        is an <span className="text-emerald-400">on-policy</span> method: it updates Q(s, a) using
        the action a' that the agent actually takes in the next state.
        <span className="text-white font-semibold"> Q-learning</span> is
        <span className="text-emerald-400"> off-policy</span>: it updates using the maximum Q-value
        in the next state, regardless of what action the agent actually takes. Q-learning learns
        the optimal policy even while following an exploratory policy; SARSA learns the policy
        that the agent is currently following. In practice, SARSA can be safer in dangerous
        environments because it accounts for the exploration that might lead the agent into
        bad states.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Python code strings                                                */
/* ================================================================== */
const qLearningCode = `import numpy as np

# Grid world setup
ROWS, COLS = 5, 7
GOAL = (0, 6)
TRAP = (2, 2)
WALLS = {(1,1),(1,2),(2,4),(3,1),(3,4),(3,5),(4,3)}
ACTIONS = [(-1,0),(1,0),(0,-1),(0,1)]  # up, down, left, right
ACTION_NAMES = ['up','down','left','right']

def step(state, action):
    r, c = state
    dr, dc = ACTIONS[action]
    nr, nc = r + dr, c + dc
    if not (0 <= nr < ROWS and 0 <= nc < COLS) or (nr,nc) in WALLS:
        nr, nc = r, c
    reward = -0.1
    if (nr, nc) == GOAL: reward = 10.0
    elif (nr, nc) == TRAP: reward = -5.0
    done = (nr, nc) == GOAL
    return (nr, nc), reward, done

# Q-Learning
alpha = 0.2    # learning rate
gamma = 0.95   # discount factor
epsilon = 0.3  # exploration rate
Q = np.zeros((ROWS, COLS, 4))
rewards_per_episode = []

for ep in range(500):
    state = (4, 0)
    total_reward = 0
    for t in range(200):
        # Epsilon-greedy action
        if np.random.random() < epsilon:
            action = np.random.randint(4)
        else:
            action = np.argmax(Q[state[0], state[1]])

        next_state, reward, done = step(state, action)
        total_reward += reward

        # Q-learning update
        best_next = np.max(Q[next_state[0], next_state[1]])
        Q[state[0], state[1], action] += alpha * (
            reward + gamma * best_next - Q[state[0], state[1], action]
        )
        state = next_state
        if done:
            break

    rewards_per_episode.append(total_reward)
    # Decay epsilon
    epsilon = max(0.01, epsilon * 0.995)

# Show learned policy
print("Learned policy (best action per cell):")
for r in range(ROWS):
    row = []
    for c in range(COLS):
        if (r,c) in WALLS:
            row.append('####')
        elif (r,c) == GOAL:
            row.append('GOAL')
        else:
            best = ACTION_NAMES[np.argmax(Q[r, c])]
            row.append(f'{best:>5}')
    print('  '.join(row))

print(f"\\nFinal epsilon: {epsilon:.4f}")
print(f"Average reward (last 50 eps): {np.mean(rewards_per_episode[-50:]):.2f}")
`

const convergencePlotCode = `import numpy as np
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt

# Re-run Q-learning to capture reward curves with different learning rates
ROWS, COLS = 5, 7
GOAL = (0, 6)
TRAP = (2, 2)
WALLS = {(1,1),(1,2),(2,4),(3,1),(3,4),(3,5),(4,3)}
ACTIONS = [(-1,0),(1,0),(0,-1),(0,1)]

def step(state, action):
    r, c = state
    dr, dc = ACTIONS[action]
    nr, nc = r + dr, c + dc
    if not (0 <= nr < ROWS and 0 <= nc < COLS) or (nr,nc) in WALLS:
        nr, nc = r, c
    reward = -0.1
    if (nr, nc) == GOAL: reward = 10.0
    elif (nr, nc) == TRAP: reward = -5.0
    done = (nr, nc) == GOAL
    return (nr, nc), reward, done

def run_qlearning(alpha, n_episodes=500):
    Q = np.zeros((ROWS, COLS, 4))
    epsilon = 0.3
    gamma = 0.95
    rewards = []
    for ep in range(n_episodes):
        state = (4, 0)
        total = 0
        for t in range(200):
            if np.random.random() < epsilon:
                a = np.random.randint(4)
            else:
                a = np.argmax(Q[state[0], state[1]])
            ns, r, done = step(state, a)
            total += r
            best_next = np.max(Q[ns[0], ns[1]])
            Q[state[0], state[1], a] += alpha * (r + gamma * best_next - Q[state[0], state[1], a])
            state = ns
            if done: break
        rewards.append(total)
        epsilon = max(0.01, epsilon * 0.995)
    return rewards

fig, axes = plt.subplots(1, 2, figsize=(12, 4))

# Plot 1: Reward over episodes for different learning rates
for alpha, color, label in [(0.05, '#6366f1', 'alpha=0.05'), (0.2, '#10b981', 'alpha=0.2'), (0.6, '#f59e0b', 'alpha=0.6')]:
    rewards = run_qlearning(alpha)
    # Smooth with moving average
    window = 20
    smoothed = np.convolve(rewards, np.ones(window)/window, mode='valid')
    axes[0].plot(smoothed, color=color, label=label, linewidth=1.5)

axes[0].set_xlabel('Episode')
axes[0].set_ylabel('Total Reward (smoothed)')
axes[0].set_title('Q-Learning Convergence: Effect of Learning Rate')
axes[0].legend()
axes[0].grid(alpha=0.3)

# Plot 2: Steps to reach goal
for alpha, color, label in [(0.05, '#6366f1', 'alpha=0.05'), (0.2, '#10b981', 'alpha=0.2'), (0.6, '#f59e0b', 'alpha=0.6')]:
    Q = np.zeros((ROWS, COLS, 4))
    epsilon = 0.3
    gamma = 0.95
    steps_list = []
    for ep in range(500):
        state = (4, 0)
        steps = 0
        for t in range(200):
            if np.random.random() < epsilon:
                a = np.random.randint(4)
            else:
                a = np.argmax(Q[state[0], state[1]])
            ns, r, done = step(state, a)
            steps += 1
            best_next = np.max(Q[ns[0], ns[1]])
            Q[state[0], state[1], a] += alpha * (r + gamma * best_next - Q[state[0], state[1], a])
            state = ns
            if done: break
        steps_list.append(steps)
        epsilon = max(0.01, epsilon * 0.995)
    window = 20
    smoothed = np.convolve(steps_list, np.ones(window)/window, mode='valid')
    axes[1].plot(smoothed, color=color, label=label, linewidth=1.5)

axes[1].set_xlabel('Episode')
axes[1].set_ylabel('Steps to Goal (smoothed)')
axes[1].set_title('Steps to Reach Goal Over Training')
axes[1].legend()
axes[1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig('/tmp/rl_convergence.png', dpi=100, bbox_inches='tight')
plt.show()
print("Plots generated successfully!")
`

/* ================================================================== */
/*  Default export                                                     */
/* ================================================================== */
export default function ReinforcementLearning() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Reinforcement Learning</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          In supervised learning, we tell the model the right answer for every example. In
          reinforcement learning, the agent must discover the right behavior through trial and
          error -- receiving only sparse reward signals as feedback. This lesson introduces the
          foundational concepts of RL: agents, environments, Markov decision processes, Q-learning,
          and the exploration-exploitation tradeoff. By the end, you will have trained an agent to
          navigate a grid world and understand the algorithms that power game-playing AIs and
          robotic controllers.
        </p>
      </header>

      <AgentEnvironmentSection />
      <MDPSection />
      <QLearningSection />
      <ExplorationSection />
      <TDLearningSection />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: Q-Learning from Scratch</h2>
        <p className="text-gray-300 leading-relaxed">
          Let's implement Q-learning in Python. The code below creates the same grid world from
          the visualizations above, runs 500 episodes of Q-learning with epsilon decay, and
          prints the learned policy. Each cell shows the best action the agent learned. You
          should see arrows pointing toward the goal and away from the trap.
        </p>
        <PythonCell defaultCode={qLearningCode} title="Q-Learning Implementation" />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: Convergence Analysis</h2>
        <p className="text-gray-300 leading-relaxed">
          How does the learning rate affect convergence? The code below runs Q-learning with
          three different learning rates and plots (1) total reward per episode and (2) steps
          to reach the goal over training. A moderate learning rate (&alpha; = 0.2) typically
          converges fastest: too small is slow; too large overshoots and oscillates.
        </p>
        <PythonCell defaultCode={convergencePlotCode} title="Convergence Plots" />
      </section>
    </div>
  )
}
