import { useState, useCallback, useRef } from 'react'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import ControlPanel from '../../components/viz/ControlPanel'

export const meta: LessonMeta = {
  id: 'advanced/policy-gradients',
  title: 'Policy Gradients & Deep RL',
  description: 'From value-based to policy-based methods: REINFORCE, actor-critic, and the challenges of deep RL',
  track: 'advanced',
  order: 2,
  tags: ['policy-gradient', 'reinforce', 'actor-critic', 'deep-rl', 'reward-shaping'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const ACTIONS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]

/* ================================================================== */
/*  Section 1 -- Value-Based vs Policy-Based                           */
/* ================================================================== */
function ValueVsPolicySection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Value-Based vs. Policy-Based Methods</h2>
      <p className="text-gray-300 leading-relaxed">
        In the previous lesson on reinforcement learning, we learned Q-learning, a
        <span className="text-emerald-400 font-semibold"> value-based</span> method. It estimates
        the value of each state-action pair and derives a policy implicitly by picking the action
        with the highest Q-value. This works well for small, discrete action spaces. But what
        if the action space is continuous -- like choosing a steering angle or the force to apply
        to a joint? You cannot enumerate all possible actions to find the argmax.
      </p>
      <p className="text-gray-300 leading-relaxed">
        <span className="text-emerald-400 font-semibold">Policy-based</span> methods solve this
        by learning the policy directly. Instead of learning Q(s, a) and then deriving a policy,
        we parameterize the policy as a neural network &pi;<sub>&theta;</sub>(a|s) that outputs
        a probability distribution over actions given a state. We then optimize the parameters
        &theta; to maximize expected reward.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-indigo-400 mb-2">Value-Based (Q-Learning, DQN)</h3>
          <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
            <li>Learn Q(s, a), pick action via argmax</li>
            <li>Works well with discrete actions</li>
            <li>Deterministic policy (always picks best)</li>
            <li>Can be more sample-efficient</li>
            <li>Struggles with continuous action spaces</li>
          </ul>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-emerald-400 mb-2">Policy-Based (REINFORCE, PPO)</h3>
          <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
            <li>Learn &pi;(a|s) directly</li>
            <li>Handles continuous actions naturally</li>
            <li>Stochastic policy (samples from distribution)</li>
            <li>Better exploration through stochasticity</li>
            <li>Often higher variance gradients</li>
          </ul>
        </div>
      </div>
      <p className="text-gray-300 leading-relaxed mt-4">
        In practice, the most successful modern RL algorithms (PPO, SAC, A3C) combine both
        ideas. They use a value function to reduce variance in the policy gradient estimate,
        giving us the best of both worlds. This is the actor-critic architecture we will explore
        later in this lesson.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- REINFORCE: Cart-Pole Visualization                    */
/* ================================================================== */
function REINFORCESection() {
  const [running, setRunning] = useState(false)
  const runRef = useRef(running)
  runRef.current = running

  // Simple cart-pole physics
  const poleRef = useRef({
    x: 0,           // cart position
    v: 0,           // cart velocity
    theta: 0.05,    // pole angle (radians)
    omega: 0,       // pole angular velocity
  })
  const policyRef = useRef([0, 0, 0, 0]) // simple linear policy weights
  const episodeRef = useRef(0)
  const bestRef = useRef(0)
  const stepRef = useRef(0)
  const rewardHistRef = useRef<number[]>([])

  function resetPole() {
    poleRef.current = {
      x: 0,
      v: 0,
      theta: (Math.random() - 0.5) * 0.1,
      omega: 0,
    }
    stepRef.current = 0
  }

  function poleStep(action: number): boolean {
    const s = poleRef.current
    const force = action === 1 ? 1.0 : -1.0
    const g = 9.8
    const mc = 1.0
    const mp = 0.1
    const l = 0.5
    const dt = 0.02

    const sinT = Math.sin(s.theta)
    const cosT = Math.cos(s.theta)
    const totalMass = mc + mp

    const thetaAcc = (g * sinT - cosT * (force + mp * l * s.omega * s.omega * sinT) / totalMass) /
      (l * (4 / 3 - mp * cosT * cosT / totalMass))
    const xAcc = (force + mp * l * (s.omega * s.omega * sinT - thetaAcc * cosT)) / totalMass

    s.x += s.v * dt
    s.v += xAcc * dt
    s.theta += s.omega * dt
    s.omega += thetaAcc * dt
    stepRef.current++

    // Terminal conditions
    return Math.abs(s.theta) < 0.3 && Math.abs(s.x) < 3.0 && stepRef.current < 300
  }

  function policyAction(): number {
    const s = poleRef.current
    const w = policyRef.current
    const logit = w[0] * s.x + w[1] * s.v + w[2] * s.theta + w[3] * s.omega
    const prob = 1 / (1 + Math.exp(-logit))
    return Math.random() < prob ? 1 : 0
  }

  const sketch = useCallback((p: p5) => {
    const trajectoryBuf: { states: number[][]; actions: number[] } = { states: [], actions: [] }

    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 420)
      p.textFont('monospace')
      p.frameRate(60)
      resetPole()
    }
    p.draw = () => {
      const W = p.width
      p.background(15, 15, 25)

      const s = poleRef.current

      // Cart-pole visualization area
      const cartY = 250
      const cartW = 60
      const cartH = 30
      const poleLen = 120
      const centerX = W / 2

      // Ground
      p.stroke(60)
      p.strokeWeight(1)
      p.line(40, cartY + cartH / 2 + 2, W - 40, cartY + cartH / 2 + 2)

      // Cart
      const cartScreenX = centerX + s.x * 40
      p.fill(80, 130, 200)
      p.noStroke()
      p.rect(cartScreenX - cartW / 2, cartY - cartH / 2, cartW, cartH, 4)

      // Wheels
      p.fill(60)
      p.ellipse(cartScreenX - cartW / 3, cartY + cartH / 2, 12, 12)
      p.ellipse(cartScreenX + cartW / 3, cartY + cartH / 2, 12, 12)

      // Pole
      const poleEndX = cartScreenX + Math.sin(s.theta) * poleLen
      const poleEndY = cartY - cartH / 2 - Math.cos(s.theta) * poleLen
      p.stroke(220, 160, 60)
      p.strokeWeight(5)
      p.line(cartScreenX, cartY - cartH / 2, poleEndX, poleEndY)
      p.noStroke()
      p.fill(255, 200, 80)
      p.ellipse(poleEndX, poleEndY, 12, 12)

      // Info
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      p.text(
        `Episode: ${episodeRef.current}   Steps alive: ${stepRef.current}   Best: ${bestRef.current}`,
        W / 2, 22
      )
      p.textSize(10)
      p.fill(150)
      p.text(
        `\u03B8 = ${s.theta.toFixed(3)} rad   x = ${s.x.toFixed(2)}`,
        W / 2, 38
      )
      p.text(
        runRef.current ? 'Training with REINFORCE...' : 'Click Start to begin training',
        W / 2, 52
      )

      // Reward history chart
      const hist = rewardHistRef.current
      if (hist.length > 1) {
        const chartX = 40
        const chartY2 = 310
        const chartW2 = W - 80
        const chartH2 = 90

        p.fill(20, 20, 35)
        p.stroke(50)
        p.strokeWeight(1)
        p.rect(chartX, chartY2, chartW2, chartH2)

        p.noStroke()
        p.fill(120)
        p.textSize(9)
        p.textAlign(p.LEFT)
        p.text('Episode reward over time', chartX + 5, chartY2 - 4)

        const maxR = Math.max(...hist, 50)
        const n = hist.length
        const startI = Math.max(0, n - 200)
        const visible = hist.slice(startI)

        p.stroke(100, 200, 150)
        p.strokeWeight(1.5)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < visible.length; i++) {
          const px = chartX + (i / Math.max(visible.length - 1, 1)) * chartW2
          const py = chartY2 + chartH2 - (visible[i] / maxR) * chartH2
          p.vertex(px, py)
        }
        p.endShape()

        // Axis labels
        p.noStroke()
        p.fill(100)
        p.textSize(8)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text('0', chartX - 3, chartY2 + chartH2)
        p.text(maxR.toFixed(0), chartX - 3, chartY2)
      }

      // Training loop
      if (runRef.current) {
        // Run a full episode quickly
        resetPole()
        trajectoryBuf.states = []
        trajectoryBuf.actions = []
        let alive = true
        while (alive) {
          const st = poleRef.current
          trajectoryBuf.states.push([st.x, st.v, st.theta, st.omega])
          const a = policyAction()
          trajectoryBuf.actions.push(a)
          alive = poleStep(a)
        }

        const epLen = trajectoryBuf.states.length
        if (epLen > bestRef.current) bestRef.current = epLen
        rewardHistRef.current.push(epLen)

        // REINFORCE update
        const gamma = 0.99
        const lr = 0.01
        const returns: number[] = new Array(epLen).fill(0)
        returns[epLen - 1] = 1
        for (let t = epLen - 2; t >= 0; t--) {
          returns[t] = 1 + gamma * returns[t + 1]
        }

        // Baseline: mean return
        const meanR = returns.reduce((a, b) => a + b, 0) / epLen

        const w = policyRef.current
        for (let t = 0; t < epLen; t++) {
          const [x, v, theta, omega] = trajectoryBuf.states[t]
          const logit = w[0] * x + w[1] * v + w[2] * theta + w[3] * omega
          const prob = 1 / (1 + Math.exp(-logit))
          const action = trajectoryBuf.actions[t]
          const advantage = returns[t] - meanR

          // Gradient of log pi(a|s) * advantage
          const gradScale = (action - prob) * advantage * lr
          w[0] += gradScale * x
          w[1] += gradScale * v
          w[2] += gradScale * theta
          w[3] += gradScale * omega
        }

        episodeRef.current++

        // Replay last episode visually (set pole to a mid-episode state)
        if (trajectoryBuf.states.length > 0) {
          const showIdx = Math.min(
            Math.floor(p.frameCount % 60),
            trajectoryBuf.states.length - 1
          )
          const [sx, sv, st2, so] = trajectoryBuf.states[showIdx]
          poleRef.current = { x: sx, v: sv, theta: st2, omega: so }
        }
      }
    }
  }, [])

  const handleReset = () => {
    policyRef.current = [0, 0, 0, 0]
    episodeRef.current = 0
    bestRef.current = 0
    rewardHistRef.current = []
    resetPole()
    setRunning(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">The REINFORCE Algorithm</h2>
      <p className="text-gray-300 leading-relaxed">
        REINFORCE is the simplest policy gradient algorithm. The idea is elegant: run the policy
        to collect a full trajectory (sequence of states, actions, and rewards), compute the
        return (cumulative discounted reward) for each time step, and then increase the
        probability of actions that led to high returns.
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        &nabla;<sub>&theta;</sub> J(&theta;) = E<sub>&tau;</sub>[ &Sigma;<sub>t</sub>
        &nabla;<sub>&theta;</sub> log &pi;<sub>&theta;</sub>(a<sub>t</sub>|s<sub>t</sub>)
        * G<sub>t</sub> ]
      </p>
      <p className="text-gray-300 leading-relaxed">
        In plain English: for each action in the trajectory, compute the gradient of the log
        probability of that action, and scale it by the return from that time step onward. Actions
        that led to high total reward get reinforced (their probability increases); actions that
        led to low reward get discouraged.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Below is a simplified cart-pole task. A pole is balanced on a cart, and the agent must
        learn to push left or right to keep the pole upright. The policy is a linear function
        of four state variables (position, velocity, angle, angular velocity). Watch the reward
        curve: it starts low (pole falls quickly) and gradually increases as the policy learns
        to balance.
      </p>
      <P5Sketch sketch={sketch} height={420} controls={
        <ControlPanel title="REINFORCE Training">
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${running ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
            >
              {running ? 'Pause' : 'Start Training'}
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
/*  Section 3 -- Actor-Critic                                          */
/* ================================================================== */
function ActorCriticSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Actor-Critic Methods</h2>
      <p className="text-gray-300 leading-relaxed">
        REINFORCE has a major flaw: high variance. Because the return G<sub>t</sub> is computed
        from a single sampled trajectory, it can fluctuate wildly between episodes. This makes
        learning slow and unstable. The solution is to introduce a
        <span className="text-emerald-400 font-semibold"> baseline</span> -- a value estimate that
        we subtract from the return to reduce variance without introducing bias.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The <span className="text-white font-semibold">actor-critic</span> architecture does exactly
        this by maintaining two networks:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <span className="text-white font-semibold">Actor (&pi;<sub>&theta;</sub>)</span> -- the
          policy network that selects actions. This is updated using the policy gradient.
        </li>
        <li>
          <span className="text-white font-semibold">Critic (V<sub>&phi;</sub>)</span> -- the value
          network that estimates V(s). This is updated using TD learning (minimizing the squared
          TD error).
        </li>
      </ul>
      <h3 className="text-xl font-bold text-white mt-6">The Advantage Function</h3>
      <p className="text-gray-300 leading-relaxed">
        Instead of scaling the policy gradient by the raw return G<sub>t</sub>, we use the
        <span className="text-emerald-400 font-semibold"> advantage</span>:
      </p>
      <p className="text-gray-300 leading-relaxed font-mono text-sm bg-gray-800/50 p-3 rounded">
        A(s, a) = Q(s, a) - V(s) &asymp; r + &gamma; V(s') - V(s)
      </p>
      <p className="text-gray-300 leading-relaxed">
        The advantage tells us how much better action a is compared to the average action in state
        s. If A &gt; 0, the action was better than expected, and we increase its probability. If
        A &lt; 0, it was worse than expected, and we decrease it. This dramatically reduces
        variance compared to using raw returns, because we are measuring relative quality rather
        than absolute.
      </p>
      <h3 className="text-xl font-bold text-white mt-6">A2C and A3C</h3>
      <p className="text-gray-300 leading-relaxed">
        <span className="text-white font-semibold">A2C</span> (Advantage Actor-Critic) is the
        synchronous version: run several parallel environments, collect batches of experience,
        compute advantages, and update both actor and critic.
        <span className="text-white font-semibold"> A3C</span> (Asynchronous Advantage
        Actor-Critic) runs each environment in a separate thread with its own copy of the
        networks, sending gradient updates asynchronously to a central parameter server. This
        was one of the first algorithms to achieve superhuman performance on Atari games using
        only raw pixels as input.
      </p>
      <h3 className="text-xl font-bold text-white mt-6">PPO: Proximal Policy Optimization</h3>
      <p className="text-gray-300 leading-relaxed">
        PPO, developed by OpenAI, is currently the most widely used policy gradient algorithm.
        Its key innovation is a clipped surrogate objective that prevents the policy from
        changing too much in a single update. This makes training much more stable without the
        complexity of trust-region methods like TRPO. PPO is the algorithm behind ChatGPT's
        RLHF (reinforcement learning from human feedback) training.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Reward Shaping Visualization                          */
/* ================================================================== */
function RewardShapingSection() {
  const [rewardType, setRewardType] = useState<'sparse' | 'shaped' | 'wrong'>('sparse')
  const rewardTypeRef = useRef(rewardType)
  rewardTypeRef.current = rewardType

  // Grid world for reward shaping demo
  const ROWS = 6
  const COLS = 8
  const GOAL = [0, 7]
  const agentRef = useRef({ r: 5, c: 0, path: [[5, 0]] as [number, number][] })
  const qRef = useRef(createRewardQ())
  const episodeRef = useRef(0)
  const frameRef = useRef(0)

  function createRewardQ(): number[][][] {
    const q: number[][][] = []
    for (let r = 0; r < ROWS; r++) {
      q[r] = []
      for (let c = 0; c < COLS; c++) {
        q[r][c] = [0, 0, 0, 0]
      }
    }
    return q
  }

  function getShapedReward(r: number, c: number, type: string): number {
    if (r === GOAL[0] && c === GOAL[1]) return 10
    if (type === 'sparse') return 0
    if (type === 'shaped') {
      // Distance-based shaping: closer to goal = more reward
      const dist = Math.abs(r - GOAL[0]) + Math.abs(c - GOAL[1])
      const maxDist = ROWS + COLS - 2
      return -dist / maxDist
    }
    // 'wrong': reward going down-left (misleading)
    const distFromBL = Math.abs(r - (ROWS - 1)) + Math.abs(c - 0)
    return -distFromBL / (ROWS + COLS - 2)
  }

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(p.windowWidth > 700 ? 700 : p.windowWidth - 40, 380)
      p.textFont('monospace')
      p.frameRate(30)
    }
    p.draw = () => {
      const W = p.width
      const H = p.height
      p.background(15, 15, 25)

      const rType = rewardTypeRef.current
      const cellW = Math.min((W - 40) / COLS, (H - 100) / ROWS)
      const offX = (W - cellW * COLS) / 2
      const offY = 50

      const Q = qRef.current
      const agent = agentRef.current

      // Header
      p.fill(200)
      p.textSize(13)
      p.textAlign(p.CENTER)
      const labels: Record<string, string> = {
        sparse: 'Sparse Reward: +10 at goal, 0 elsewhere',
        shaped: 'Shaped Reward: distance-based bonus guiding to goal',
        wrong: 'Wrong Shaping: misleading signal pointing away from goal',
      }
      p.text(`${labels[rType]}   Episode: ${episodeRef.current}`, W / 2, 22)

      // Grid
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = offX + c * cellW
          const y = offY + r * cellW

          // Color by shaped reward
          const sr = getShapedReward(r, c, rType)
          if (r === GOAL[0] && c === GOAL[1]) {
            p.fill(30, 140, 60)
          } else if (sr > -0.01) {
            p.fill(25, 25, 40)
          } else {
            const brightness = p.map(sr, -1, 0, 15, 40)
            p.fill(brightness, brightness, brightness + 15)
          }
          p.stroke(50)
          p.strokeWeight(1)
          p.rect(x, y, cellW, cellW)

          // Best action arrow
          if (cellW > 28) {
            const bestA = Q[r][c].indexOf(Math.max(...Q[r][c]))
            const arrows = ['\u2190', '\u2192', '\u2191', '\u2193']
            p.noStroke()
            p.fill(200, 200, 255, 150)
            p.textSize(Math.min(12, cellW * 0.25))
            p.textAlign(p.CENTER, p.CENTER)
            p.text(arrows[bestA], x + cellW / 2, y + cellW / 2)
          }
        }
      }

      // Agent trail
      p.noStroke()
      for (let i = 0; i < agent.path.length - 1; i++) {
        const [pr, pc] = agent.path[i]
        const alpha = p.map(i, 0, agent.path.length, 20, 100)
        p.fill(255, 180, 80, alpha)
        p.ellipse(offX + pc * cellW + cellW / 2, offY + pr * cellW + cellW / 2, cellW * 0.15)
      }

      // Agent
      p.fill(255, 180, 80)
      p.ellipse(offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2, cellW * 0.4)
      p.fill(0)
      p.textSize(10)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('A', offX + agent.c * cellW + cellW / 2, offY + agent.r * cellW + cellW / 2)

      // Legend
      const ly = offY + ROWS * cellW + 12
      p.fill(150)
      p.textSize(10)
      p.textAlign(p.LEFT)
      p.text('Arrows show learned policy direction. Brighter cells = higher shaped reward.', offX, ly)

      // Q-learning steps
      frameRef.current++
      const stepsPerFrame = 8
      for (let i = 0; i < stepsPerFrame; i++) {
        const eps = Math.max(0.05, 0.4 - episodeRef.current * 0.002)
        const lr = 0.2
        const gamma = 0.95

        let action: number
        if (Math.random() < eps) {
          action = Math.floor(Math.random() * 4)
        } else {
          action = Q[agent.r][agent.c].indexOf(Math.max(...Q[agent.r][agent.c]))
        }

        const [dr, dc] = ACTIONS[action]
        let nr = agent.r + dr
        let nc = agent.c + dc
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
          nr = agent.r
          nc = agent.c
        }

        const reward = getShapedReward(nr, nc, rType)
        const maxNext = Math.max(...Q[nr][nc])
        Q[agent.r][agent.c][action] += lr * (reward + gamma * maxNext - Q[agent.r][agent.c][action])

        agent.r = nr
        agent.c = nc
        agent.path.push([nr, nc])

        if ((nr === GOAL[0] && nc === GOAL[1]) || agent.path.length > 150) {
          episodeRef.current++
          agent.r = 5
          agent.c = 0
          agent.path = [[5, 0]]
        }
      }
    }
  }, [])

  const handleSwitch = (type: 'sparse' | 'shaped' | 'wrong') => {
    setRewardType(type)
    qRef.current = createRewardQ()
    agentRef.current = { r: 5, c: 0, path: [[5, 0]] }
    episodeRef.current = 0
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Reward Shaping</h2>
      <p className="text-gray-300 leading-relaxed">
        The reward function is arguably the most important design choice in RL. A well-shaped
        reward provides a smooth gradient toward the desired behavior; a poorly shaped one
        can lead to completely wrong policies; and a sparse reward (only at the goal) can make
        learning extremely slow because the agent gets no feedback until it accidentally stumbles
        on the goal.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Toggle between three reward signals below and watch how they affect learning. "Sparse"
        gives +10 only at the goal -- the agent wanders randomly for a long time. "Shaped" adds
        a distance-based bonus, guiding the agent smoothly toward the goal. "Wrong Shaping"
        misleads the agent by rewarding movement away from the goal, causing it to learn the
        opposite of what we want.
      </p>
      <P5Sketch sketch={sketch} height={380} controls={
        <ControlPanel title="Reward Signal">
          <div className="flex gap-2 flex-wrap">
            {(['sparse', 'shaped', 'wrong'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleSwitch(type)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  rewardType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {type === 'sparse' ? 'Sparse' : type === 'shaped' ? 'Distance-Shaped' : 'Wrong Shaping'}
              </button>
            ))}
          </div>
        </ControlPanel>
      } />
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Deep RL Challenges                                    */
/* ================================================================== */
function DeepRLChallengesSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Challenges of Deep RL</h2>
      <p className="text-gray-300 leading-relaxed">
        While deep RL has achieved spectacular results -- beating world champions at Go, Dota 2,
        and StarCraft -- it remains one of the hardest areas of machine learning. Here are the
        key challenges:
      </p>
      <h3 className="text-xl font-bold text-white mt-4">Sample Efficiency</h3>
      <p className="text-gray-300 leading-relaxed">
        Deep RL algorithms are extraordinarily data-hungry. AlphaGo played millions of games
        against itself. OpenAI Five trained for 10,000 human-equivalent years of Dota 2. A
        human child learns to walk in about a year; a simulated robot might need billions of
        simulation steps. This is because RL must learn everything from scratch through trial
        and error, whereas supervised learning benefits from curated datasets.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">Training Instability</h3>
      <p className="text-gray-300 leading-relaxed">
        Small changes in hyperparameters (learning rate, discount factor, network architecture)
        can cause performance to collapse. The non-stationarity of the training data (the policy
        changes, so the data distribution changes) makes optimization treacherous. Reward hacking
        -- where the agent finds loopholes in the reward function -- is a constant threat.
        A robot rewarded for moving forward might learn to flip over and wiggle rather than walk.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">Reward Specification</h3>
      <p className="text-gray-300 leading-relaxed">
        Specifying a reward function that captures exactly what you want is extremely difficult.
        This problem, sometimes called the "alignment problem" in the context of AI safety,
        is central to building RL systems that behave as intended. RLHF (Reinforcement Learning
        from Human Feedback), used to train ChatGPT, sidesteps this by learning a reward model
        from human preferences rather than hand-designing the reward function.
      </p>
      <h3 className="text-xl font-bold text-white mt-4">Sim-to-Real Transfer</h3>
      <p className="text-gray-300 leading-relaxed">
        Training in simulation is cheap and safe, but policies learned in simulation often fail
        in the real world due to the "reality gap" -- differences between the simulator's physics
        and actual physics. Techniques like domain randomization (varying simulation parameters
        randomly during training) help, but bridging this gap remains an active area of research.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Python code strings                                                */
/* ================================================================== */
const reinforceCode = `import numpy as np

# Multi-armed bandit with REINFORCE
# 5 arms with different true reward probabilities
np.random.seed(42)
n_arms = 5
true_probs = np.array([0.1, 0.3, 0.7, 0.2, 0.5])
print(f"True reward probabilities: {true_probs}")
print(f"Best arm: {np.argmax(true_probs)} (prob = {np.max(true_probs)})")

# Policy: softmax over logits (one logit per arm)
logits = np.zeros(n_arms)

def softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()

def sample_action(logits):
    probs = softmax(logits)
    return np.random.choice(n_arms, p=probs)

# REINFORCE training
lr = 0.1
n_episodes = 2000
batch_size = 10  # average gradient over a batch
reward_history = []

for ep in range(0, n_episodes, batch_size):
    grad = np.zeros(n_arms)

    for _ in range(batch_size):
        # Sample action from policy
        probs = softmax(logits)
        action = np.random.choice(n_arms, p=probs)

        # Get reward (Bernoulli)
        reward = 1.0 if np.random.random() < true_probs[action] else 0.0
        reward_history.append(reward)

        # REINFORCE gradient: d/d_logits log(pi(a)) * reward
        # For softmax: grad = reward * (one_hot(a) - probs)
        one_hot = np.zeros(n_arms)
        one_hot[action] = 1.0
        grad += reward * (one_hot - probs)

    grad /= batch_size
    logits += lr * grad

# Results
final_probs = softmax(logits)
print(f"\\nLearned policy (after {n_episodes} episodes):")
for i in range(n_arms):
    bar = '#' * int(final_probs[i] * 40)
    print(f"  Arm {i}: {final_probs[i]:.3f}  {bar}")

print(f"\\nChosen arm: {np.argmax(final_probs)} (correct: {np.argmax(true_probs)})")

# Smoothed reward over time
window = 100
smoothed = np.convolve(reward_history, np.ones(window)/window, mode='valid')
print(f"Average reward (first 100): {np.mean(reward_history[:100]):.3f}")
print(f"Average reward (last 100):  {np.mean(reward_history[-100:]):.3f}")
`

const rewardComparisonCode = `import numpy as np
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt

# Compare reward functions in a simple grid world
# Agent starts at (4,0), goal at (0,7), 5x8 grid
ROWS, COLS = 5, 8
GOAL = (0, 7)
ACTIONS = [(-1,0),(1,0),(0,-1),(0,1)]

def step(state, action):
    r, c = state
    dr, dc = ACTIONS[action]
    nr, nc = r+dr, c+dc
    if not (0<=nr<ROWS and 0<=nc<COLS):
        nr, nc = r, c
    return (nr, nc)

def run_qlearning(reward_fn, n_eps=300):
    Q = np.zeros((ROWS, COLS, 4))
    eps = 0.3
    alpha, gamma = 0.2, 0.95
    steps_to_goal = []

    for ep in range(n_eps):
        state = (4, 0)
        n_steps = 0
        for t in range(200):
            if np.random.random() < eps:
                a = np.random.randint(4)
            else:
                a = np.argmax(Q[state[0], state[1]])
            ns = step(state, a)
            r = reward_fn(ns[0], ns[1])
            Q[state[0], state[1], a] += alpha * (
                r + gamma * np.max(Q[ns[0], ns[1]]) - Q[state[0], state[1], a]
            )
            state = ns
            n_steps += 1
            if state == GOAL:
                break
        steps_to_goal.append(n_steps)
        eps = max(0.01, eps * 0.99)
    return steps_to_goal

# Three reward functions
def sparse(r, c):
    return 10.0 if (r,c) == GOAL else 0.0

def distance_shaped(r, c):
    if (r,c) == GOAL: return 10.0
    d = abs(r - GOAL[0]) + abs(c - GOAL[1])
    return -d / (ROWS + COLS)

def wrong_shaped(r, c):
    if (r,c) == GOAL: return 10.0
    # Rewards going toward bottom-left corner (wrong direction)
    d = abs(r - (ROWS-1)) + abs(c - 0)
    return -d / (ROWS + COLS)

fig, ax = plt.subplots(1, 1, figsize=(10, 5))

for fn, color, label in [
    (sparse, '#ef4444', 'Sparse (+10 at goal only)'),
    (distance_shaped, '#10b981', 'Distance-shaped (closer = better)'),
    (wrong_shaped, '#f59e0b', 'Wrong shaping (misleading signal)'),
]:
    results = run_qlearning(fn)
    window = 15
    smoothed = np.convolve(results, np.ones(window)/window, mode='valid')
    ax.plot(smoothed, color=color, label=label, linewidth=2)

ax.set_xlabel('Episode', fontsize=12)
ax.set_ylabel('Steps to reach goal (smoothed)', fontsize=12)
ax.set_title('Effect of Reward Shaping on Learning Speed', fontsize=14)
ax.legend(fontsize=10)
ax.grid(alpha=0.3)
ax.set_ylim(0, 210)

plt.tight_layout()
plt.savefig('/tmp/reward_shaping.png', dpi=100, bbox_inches='tight')
plt.show()
print("Sparse reward makes learning very slow (agent wanders).")
print("Distance-shaped reward guides the agent efficiently.")
print("Wrong shaping actively misleads -- the agent goes the wrong way.")
`

/* ================================================================== */
/*  Default export                                                     */
/* ================================================================== */
export default function PolicyGradients() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Policy Gradients & Deep RL</h1>
        <p className="text-lg text-gray-300 leading-relaxed">
          Q-learning works beautifully for small, discrete environments, but it struggles
          with continuous actions and high-dimensional state spaces. Policy gradient methods
          learn a policy directly, opening the door to the rich world of deep reinforcement
          learning. In this lesson, we cover the REINFORCE algorithm, the actor-critic
          architecture, reward shaping, and the real-world challenges that make deep RL
          one of the most exciting and difficult frontiers in AI.
        </p>
      </header>

      <ValueVsPolicySection />
      <REINFORCESection />
      <ActorCriticSection />
      <RewardShapingSection />
      <DeepRLChallengesSection />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: REINFORCE on a Bandit</h2>
        <p className="text-gray-300 leading-relaxed">
          Let's implement REINFORCE from scratch on a multi-armed bandit problem. The policy
          is a softmax over logit parameters (one per arm). We sample actions, observe rewards,
          and update the logits using the REINFORCE gradient. Watch how the policy converges
          to putting nearly all probability on the best arm.
        </p>
        <PythonCell defaultCode={reinforceCode} title="REINFORCE Bandit" />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Code: Reward Shaping Comparison</h2>
        <p className="text-gray-300 leading-relaxed">
          The plot below compares three reward functions on a grid world: sparse (only at goal),
          distance-shaped (guides toward goal), and wrong shaping (misleads). Distance shaping
          dramatically accelerates learning, while wrong shaping causes the agent to converge
          on the wrong behavior. This illustrates why reward design is so critical in RL.
        </p>
        <PythonCell defaultCode={rewardComparisonCode} title="Reward Function Comparison" />
      </section>
    </div>
  )
}
