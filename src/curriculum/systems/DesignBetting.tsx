import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-betting',
  title: 'Design a Betting Platform',
  description:
    'System design case study: real-time sports betting with live odds, atomic bet placement, settlement pipelines, cash-out mechanics, and wallet management at scale',
  track: 'systems',
  order: 21,
  tags: [
    'system-design',
    'betting',
    'real-time',
    'odds',
    'settlement',
    'wallet',
    'websocket',
    'exactly-once',
  ],
}

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

const BG: [number, number, number] = [15, 15, 25]
const INDIGO: [number, number, number] = [99, 102, 241]
const PINK: [number, number, number] = [236, 72, 153]
const GREEN: [number, number, number] = [34, 197, 94]
const YELLOW: [number, number, number] = [250, 204, 21]
const TEXT_C: [number, number, number] = [148, 163, 184]
const CYAN: [number, number, number] = [34, 211, 238]
const PURPLE: [number, number, number] = [168, 85, 247]
const ORANGE: [number, number, number] = [251, 146, 60]
const RED: [number, number, number] = [239, 68, 68]

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
  label: string,
  subLabel?: string,
) {
  p.fill(color[0], color[1], color[2], 40)
  p.stroke(...color)
  p.strokeWeight(2)
  p.rect(x - w / 2, y - h / 2, w, h, 8)
  p.noStroke()
  p.fill(255)
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(10)
  p.text(label, x, subLabel ? y - 7 : y)
  if (subLabel) {
    p.fill(...TEXT_C)
    p.textSize(8)
    p.text(subLabel, x, y + 8)
  }
}

function drawArrowH(
  p: p5,
  x1: number,
  y: number,
  x2: number,
  color: [number, number, number],
  label?: string,
) {
  const dir = x2 > x1 ? 1 : -1
  p.stroke(...color, 180)
  p.strokeWeight(2)
  p.line(x1, y, x2, y)
  p.fill(...color, 180)
  p.noStroke()
  const aLen = 7
  p.triangle(x2, y, x2 - dir * aLen, y - 4, x2 - dir * aLen, y + 4)
  if (label) {
    p.fill(...TEXT_C)
    p.textSize(7)
    p.textAlign(p.CENTER, p.BOTTOM)
    p.text(label, (x1 + x2) / 2, y - 4)
  }
}

function drawArrowV(
  p: p5,
  x: number,
  y1: number,
  y2: number,
  color: [number, number, number],
  label?: string,
) {
  const dir = y2 > y1 ? 1 : -1
  p.stroke(...color, 180)
  p.strokeWeight(2)
  p.line(x, y1, x, y2)
  p.fill(...color, 180)
  p.noStroke()
  const aLen = 7
  p.triangle(x, y2, x - 4, y2 - dir * aLen, x + 4, y2 - dir * aLen)
  if (label) {
    p.fill(...TEXT_C)
    p.textSize(7)
    p.textAlign(p.LEFT, p.CENTER)
    p.text(label, x + 5, (y1 + y2) / 2)
  }
}

function drawLArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number],
  label?: string,
  hFirst = true,
) {
  p.stroke(...color, 160)
  p.strokeWeight(2)
  if (hFirst) {
    p.line(x1, y1, x2, y1)
    p.line(x2, y1, x2, y2)
  } else {
    p.line(x1, y1, x1, y2)
    p.line(x1, y2, x2, y2)
  }
  const dir = y2 > y1 ? 1 : -1
  const endX = hFirst ? x2 : x2
  const endY = y2
  p.fill(...color, 160)
  p.noStroke()
  if (hFirst) {
    const aLen = 7
    p.triangle(endX, endY, endX - 4, endY - dir * aLen, endX + 4, endY - dir * aLen)
  } else {
    const aDir = x2 > x1 ? 1 : -1
    const aLen = 7
    p.triangle(endX, endY, endX - aDir * aLen, endY - 4, endX - aDir * aLen, endY + 4)
  }
  if (label) {
    p.fill(...TEXT_C)
    p.textSize(7)
    p.textAlign(p.CENTER, p.BOTTOM)
    if (hFirst) {
      p.text(label, (x1 + x2) / 2, y1 - 3)
    } else {
      p.text(label, x1, (y1 + y2) / 2 - 3)
    }
  }
}

function drawDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(...color)
  p.noStroke()
  p.ellipse(x, y, 6, 6)
}

function drawLDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
  hFirst = true,
) {
  const totalH = Math.abs(x2 - x1)
  const totalV = Math.abs(y2 - y1)
  const total = totalH + totalV
  const dist = progress * total
  let px: number, py: number
  if (hFirst) {
    if (dist <= totalH) {
      px = x1 + (x2 - x1) * (dist / totalH)
      py = y1
    } else {
      px = x2
      py = y1 + (y2 - y1) * ((dist - totalH) / totalV)
    }
  } else {
    if (dist <= totalV) {
      px = x1
      py = y1 + (y2 - y1) * (dist / totalV)
    } else {
      px = x1 + (x2 - x1) * ((dist - totalV) / totalH)
      py = y2
    }
  }
  p.fill(...color)
  p.noStroke()
  p.ellipse(px, py, 6, 6)
}

function drawDashedLine(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number],
) {
  const ctx = p.drawingContext as CanvasRenderingContext2D
  ctx.setLineDash([4, 4])
  p.stroke(...color, 100)
  p.strokeWeight(1)
  p.line(x1, y1, x2, y2)
  ctx.setLineDash([])
}

/* ================================================================== */
/*  Section 1 -- Problem Statement & Requirements                      */
/* ================================================================== */

function ProblemSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a real-time sports betting platform like Betfair, DraftKings, or FanDuel.
        Users place bets on live sporting events, see odds update in real time, and receive
        payouts when events settle. The platform must handle massive spikes during marquee
        events (World Cup final, Super Bowl) where millions of bets flow through the system
        simultaneously. Money is on the line for every transaction, so correctness and
        exactly-once processing are non-negotiable. This problem exercises real-time data
        push, distributed transactions, idempotency, and financial-grade reliability.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Place bets on live events (pre-match and in-play)</li>
        <li>Real-time odds updates pushed to clients during live events</li>
        <li>Bet settlement when an event concludes</li>
        <li>Wallet / balance management (deposits, withdrawals, bet debits, payout credits)</li>
        <li>Bet history and transaction log</li>
        <li>Cash out: sell back a live bet mid-game for a guaranteed payout</li>
        <li>Multi-leg parlays (accumulator bets spanning multiple events)</li>
        <li>Responsible gambling limits (deposit limits, loss limits, self-exclusion)</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Bet placement latency {'\u003C'}100ms (competitive advantage {'\u2014'} stale odds cost money)</li>
        <li>Real-time odds pushed every 100ms during live events</li>
        <li>99.999% availability (five nines {'\u2014'} money at stake)</li>
        <li>Exactly-once bet processing (no double charges, no lost bets)</li>
        <li>Regulatory compliance: complete audit trail for every transaction</li>
        <li>Handle 1M+ concurrent users during a World Cup final</li>
        <li>Strong consistency for wallet balances (no overdrafts)</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Back-of-Envelope Calculations                         */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">2. Back-of-Envelope Calculations</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Bet Volume</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Peak event (World Cup final): 50K bets/sec sustained, 100K bursts</li>
          <li>Average bet size: $25 {'\u2192'} $1.25M/sec flowing through system at peak</li>
          <li>Daily: ~10M bets on busy sports day {'\u00d7'} $25 = $250M daily handle</li>
          <li>Each bet = ~500 bytes (IDs, odds, stake, timestamps) {'\u2192'} ~5 GB/day raw bet data</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Odds Updates</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10K concurrent live markets during peak hours</li>
          <li>Each market: ~50 selections (match winner, first goal scorer, etc.)</li>
          <li>Odds update every 100ms per market {'\u2192'} 100K odds updates/sec</li>
          <li>Each update: ~200 bytes {'\u2192'} 20 MB/sec of odds data to push</li>
          <li>Fanout to 1M clients: ~20 TB/sec total egress (need multicast / shared subscriptions)</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Wallet Throughput</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>50K bets/sec = 50K wallet debit transactions/sec (bottleneck!)</li>
          <li>Plus deposits, withdrawals, payouts: ~70K wallet ops/sec total</li>
          <li>Wallet DB sharded by user_id: 100 shards = 700 ops/shard/sec (manageable)</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Settlement</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Major football match: 2M bets to settle when game ends</li>
          <li>At 10K settlements/sec batch rate: ~3.3 minutes to settle entire match</li>
          <li>Must be idempotent: safe to retry if any step fails mid-settlement</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- API Design                                            */
/* ================================================================== */

function APISection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">3. API Design</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/bets</code>
          <p className="text-gray-400 text-sm mt-1">
            Place a bet. Body: {'{'} market_id, selection, stake, odds, idempotency_key {'}'}
            {' \u2192 '} Returns bet object with id, status, placed_at. Validates odds
            have not drifted beyond tolerance.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/bets/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Get bet details including current status (pending, won, lost, cashed_out), potential payout.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/bets/:id/cashout</code>
          <p className="text-gray-400 text-sm mt-1">
            Cash out a live bet. Returns the cash-out amount based on current odds vs original odds.
            Atomically: marks bet as cashed_out, credits wallet with cash-out amount.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/markets/:id/odds</code>
          <span className="text-gray-500 text-sm ml-2">(WebSocket / SSE)</span>
          <p className="text-gray-400 text-sm mt-1">
            Subscribe to real-time odds for a market. Server pushes odds updates every 100ms
            during live events. Client receives selection + decimal odds + timestamp.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/wallet/balance</code>
          <p className="text-gray-400 text-sm mt-1">
            Returns available_balance and pending_balance (funds locked in unsettled bets).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/wallet/deposit</code>
          <p className="text-gray-400 text-sm mt-1">
            Deposit funds. Body: {'{'} amount, payment_method_id {'}'}. Integrates with payment
            gateway (Stripe, bank transfer).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/bets/history?cursor=X&limit=20</code>
          <p className="text-gray-400 text-sm mt-1">
            Paginated bet history. Cursor-based pagination. Filter by status, date range, market.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Data Model                                            */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">4. Data Model</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Market</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  event_id: uuid,
  name: string,           // "Match Winner"
  status: "pre_match" | "live" |
          "suspended" | "settled",
  selections: [
    { id, name, odds, status }
  ],
  sport: string,
  starts_at: timestamp,
  settled_at: timestamp | null,
  version: int            // optimistic lock
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Bet</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  user_id: uuid,
  market_id: uuid,
  selection_id: uuid,
  stake: decimal,
  odds_at_placement: decimal,
  potential_payout: decimal,
  status: "pending" | "won" |
          "lost" | "cashed_out" |
          "voided",
  idempotency_key: string,
  placed_at: timestamp,
  settled_at: timestamp | null,
  cashout_amount: decimal | null
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Wallet</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  user_id: uuid,          // PK
  available_balance: decimal,
  pending_balance: decimal,
  currency: string,
  version: int,           // optimistic lock
  updated_at: timestamp
}
-- available = funds free to bet
-- pending = sum of unsettled stakes
-- Invariant: available >= 0 always`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Transaction</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  user_id: uuid,
  type: "deposit" | "withdrawal" |
        "bet_debit" | "payout" |
        "cashout_credit" | "refund",
  amount: decimal,
  balance_after: decimal,
  bet_id: uuid | null,
  idempotency_key: string,
  created_at: timestamp
}
-- Double-entry: every debit has a credit`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">OddsUpdate</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  market_id: uuid,
  selection_id: uuid,
  odds: decimal,
  previous_odds: decimal,
  reason: "bet_volume" | "feed" |
          "manual" | "liability",
  timestamp: timestamp
}
-- Append-only log for audit trail
-- Partitioned by market_id + time`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Parlay</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  user_id: uuid,
  legs: [
    { market_id, selection_id,
      odds_at_placement }
  ],
  combined_odds: decimal,
  stake: decimal,
  status: "active" | "won" | "lost",
  legs_settled: int,
  total_legs: int
}
-- All legs must win for payout
-- Settled progressively as events end`}</pre>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- High-Level Architecture (p5)                          */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 1000
    const H = 580

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 1000)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(...BG)

      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Betting Platform \u2014 High-Level Architecture', W / 2, 10)

      // 3 vertical flow lanes, clearly separated
      const bw = 110
      const bh = 40
      const g = 8
      const hw = bw / 2
      const hh = bh / 2

      // ─── LANE 1: BET PLACEMENT (left third) ───
      const laneX = W * 0.22
      const y1 = 80, y2 = 155, y3 = 230, y4 = 305, y5 = 380, y6 = 455

      // Lane title
      p.fill(99, 102, 241)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('BET PLACEMENT FLOW', laneX, 38)

      drawBox(p, laneX, y1, bw, bh, INDIGO, 'Client', '')
      drawBox(p, laneX, y2, bw, bh, GREEN, 'API Gateway', '')
      drawBox(p, laneX, y3, bw, bh, PINK, 'Bet Service', 'validate odds')
      drawBox(p, laneX, y4, bw, bh, ORANGE, 'Kafka Queue', '')
      drawBox(p, laneX, y5, bw, bh, PURPLE, 'Bet Processor', 'atomic ops')
      drawBox(p, laneX, y6, bw, bh, YELLOW, 'Wallet + DB', 'debit & persist')

      drawArrowV(p, laneX, y1 + hh + g, y2 - hh - g, INDIGO)
      drawArrowV(p, laneX, y2 + hh + g, y3 - hh - g, GREEN)
      drawArrowV(p, laneX, y3 + hh + g, y4 - hh - g, PINK)
      drawArrowV(p, laneX, y4 + hh + g, y5 - hh - g, ORANGE)
      drawArrowV(p, laneX, y5 + hh + g, y6 - hh - g, PURPLE)

      // Risk Engine to the right of Bet Processor
      const riskX = laneX + bw + 50
      drawBox(p, riskX, y5, bw, bh, RED, 'Risk Engine', 'check liability')
      drawArrowH(p, laneX + hw + g, y5, riskX - hw - g, PURPLE, 'check')

      // ─── LANE 2: ODDS PUSH (center) ───
      const oddsX = W * 0.56
      const oy1 = 80, oy2 = 155, oy3 = 230, oy4 = 305

      p.fill(255, 140, 50)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('ODDS PUSH FLOW', oddsX, 38)

      drawBox(p, oddsX, oy1, bw, bh, ORANGE, 'Sports Data', 'live feed')
      drawBox(p, oddsX, oy2, bw, bh, RED, 'Odds Engine', 'recalculate')
      drawBox(p, oddsX, oy3, bw, bh, CYAN, 'WebSocket GW', 'push to clients')
      drawBox(p, oddsX, oy4, bw, bh, INDIGO, 'Client', 'live odds')

      drawArrowV(p, oddsX, oy1 + hh + g, oy2 - hh - g, ORANGE)
      drawArrowV(p, oddsX, oy2 + hh + g, oy3 - hh - g, RED)
      drawArrowV(p, oddsX, oy3 + hh + g, oy4 - hh - g, CYAN)

      // Trading desk to right of Odds Engine
      const tradingX = oddsX + bw + 50
      drawBox(p, tradingX, oy2, bw, bh, PURPLE, 'Trading Desk', 'manual adj.')
      drawArrowH(p, tradingX - hw - g, oy2, oddsX + hw + g, PURPLE, 'override')

      // ─── LANE 3: SETTLEMENT (right third) ───
      const settleX = W * 0.86
      const sy1 = 80, sy2 = 155, sy3 = 230, sy4 = 305

      p.fill(52, 211, 153)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('SETTLEMENT FLOW', settleX, 38)

      drawBox(p, settleX, sy1, bw, bh, GREEN, 'Event Result', 'match ended')
      drawBox(p, settleX, sy2, bw, bh, YELLOW, 'Settlement Svc', 'batch process')
      drawBox(p, settleX, sy3, bw, bh, PINK, 'Payout Queue', '')
      drawBox(p, settleX, sy4, bw, bh, YELLOW, 'Wallet', 'credit winners')

      drawArrowV(p, settleX, sy1 + hh + g, sy2 - hh - g, GREEN)
      drawArrowV(p, settleX, sy2 + hh + g, sy3 - hh - g, YELLOW)
      drawArrowV(p, settleX, sy3 + hh + g, sy4 - hh - g, PINK)

      // Audit log at bottom center
      const auditY = 520
      drawBox(p, W * 0.5, auditY, bw + 30, bh, TEXT_C, 'Audit Log', 'append-only')
      drawDashedLine(p, laneX, y6 + hh + g, W * 0.5, auditY - hh - g, TEXT_C)
      drawDashedLine(p, settleX, sy4 + hh + g, W * 0.5, auditY - hh - g, TEXT_C)

      // ─── ANIMATED DOTS ───
      // Blue: bet placement flow (down lane 1)
      const bp = (t * 0.2) % 1
      const betSteps = [y1,y2,y3,y4,y5,y6]
      const stepSize = 1 / (betSteps.length - 1)
      const bIdx = Math.min(Math.floor(bp / stepSize), betSteps.length - 2)
      const bLocal = (bp - bIdx * stepSize) / stepSize
      drawDot(p, laneX, betSteps[bIdx] + hh, laneX, betSteps[bIdx+1] - hh, bLocal, INDIGO)

      // Orange: odds push flow (down lane 2)
      const op = ((t * 0.25) + 0.4) % 1
      const oddsSteps = [oy1,oy2,oy3,oy4]
      const oStep = 1 / (oddsSteps.length - 1)
      const oIdx = Math.min(Math.floor(op / oStep), oddsSteps.length - 2)
      const oLocal = (op - oIdx * oStep) / oStep
      drawDot(p, oddsX, oddsSteps[oIdx] + hh, oddsX, oddsSteps[oIdx+1] - hh, oLocal, ORANGE)

      // Green: settlement flow (down lane 3)
      const sp = ((t * 0.18) + 0.7) % 1
      const setSteps = [sy1,sy2,sy3,sy4]
      const sStep = 1 / (setSteps.length - 1)
      const sIdx = Math.min(Math.floor(sp / sStep), setSteps.length - 2)
      const sLocal = (sp - sIdx * sStep) / sStep
      drawDot(p, settleX, setSteps[sIdx] + hh, settleX, setSteps[sIdx+1] - hh, sLocal, GREEN)
    }

  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The architecture has three main flows: the <strong className="text-indigo-400">bet placement path</strong> (blue
        dot) from client through validation and processing to storage, the <strong className="text-orange-400">odds
        push path</strong> (orange dot) from data providers through the odds engine to clients via
        WebSocket, and the <strong className="text-green-400">settlement path</strong> (green dot)
        that processes payouts when events conclude.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Deep Dive 1: Bet Placement (p5)                       */
/* ================================================================== */

function BetPlacementSection() {
  const [showRace, setShowRace] = useState(false)
  const showRaceRef = useRef(showRace)
  showRaceRef.current = showRace

  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 780
    const H = 460

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 780)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(...BG)
      const racing = showRaceRef.current

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(
        racing
          ? 'Bet Placement \u2014 Race Condition (Odds Change Mid-Bet)'
          : 'Bet Placement \u2014 Happy Path (Atomic Transaction)',
        W / 2,
        8,
      )

      // Columns for sequence diagram
      const colUser = W * 0.10
      const colBetSvc = W * 0.28
      const colOddsV = W * 0.44
      const colWallet = W * 0.60
      const colStore = W * 0.76
      const colResult = W * 0.90

      const topY = 50

      // Lifelines
      const entities = [
        { x: colUser, label: 'Client', color: INDIGO },
        { x: colBetSvc, label: 'Bet Service', color: PINK },
        { x: colOddsV, label: 'Odds Validator', color: CYAN },
        { x: colWallet, label: 'Wallet', color: YELLOW },
        { x: colStore, label: 'Bet Store', color: PURPLE },
      ]

      for (const ent of entities) {
        drawBox(p, ent.x, topY, 80, 26, ent.color, ent.label)
        p.stroke(ent.color[0], ent.color[1], ent.color[2], 60)
        p.strokeWeight(1)
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.line(ent.x, topY + 13, ent.x, H - 30)
        ctx.setLineDash([])
      }

      if (!racing) {
        // Happy path sequence
        const steps = [
          { from: colUser, to: colBetSvc, y: 95, label: '1. POST /bets (market, selection, stake, odds, idem_key)', color: INDIGO },
          { from: colBetSvc, to: colOddsV, y: 130, label: '2. Validate: are odds still valid? (version check)', color: PINK },
          { from: colOddsV, to: colBetSvc, y: 155, label: '3. OK: odds match (version=42)', color: CYAN },
          { from: colBetSvc, to: colWallet, y: 190, label: '4. Debit $25 from available balance', color: PINK },
          { from: colWallet, to: colBetSvc, y: 215, label: '5. OK: new balance=$175, version++', color: YELLOW },
          { from: colBetSvc, to: colStore, y: 250, label: '6. Persist bet (status=pending)', color: PINK },
          { from: colStore, to: colBetSvc, y: 275, label: '7. Bet created (id=abc-123)', color: PURPLE },
          { from: colBetSvc, to: colUser, y: 310, label: '8. 201 Created: bet confirmed!', color: GREEN },
        ]

        for (const step of steps) {
          drawArrowH(p, step.from, step.y, step.to, step.color, step.label)
        }

        // Atomic transaction box
        p.stroke(...GREEN, 80)
        p.strokeWeight(1)
        p.noFill()
        p.rect(colBetSvc - 45, 120, colStore - colBetSvc + 90, 170, 6)
        p.fill(...GREEN)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text('ATOMIC TRANSACTION', colBetSvc - 40, 124)

        // Version number highlight
        p.fill(...YELLOW, 200)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Optimistic locking: wallet.version prevents double-debit', W / 2, 340)
        p.text('Idempotency key: re-submitting same bet returns original result', W / 2, 356)

        // Animated dot along the happy path
        const cycle = (t * 0.15) % 1
        const stepIdx = Math.floor(cycle * steps.length)
        const stepProg = (cycle * steps.length) - stepIdx
        if (stepIdx < steps.length) {
          const s = steps[stepIdx]
          drawDot(p, s.from, s.y, s.to, s.y, stepProg, GREEN)
        }
      } else {
        // Race condition: odds change mid-placement
        const steps = [
          { from: colUser, to: colBetSvc, y: 95, label: '1. POST /bets (odds=2.50, version=42)', color: INDIGO },
          { from: colBetSvc, to: colOddsV, y: 130, label: '2. Validate odds version=42', color: PINK },
        ]

        for (const step of steps) {
          drawArrowH(p, step.from, step.y, step.to, step.color, step.label)
        }

        // Meanwhile arrow: odds changed!
        p.fill(...RED, 200)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        const flashAlpha = Math.floor(t * 3) % 2 === 0 ? 255 : 150
        p.fill(RED[0], RED[1], RED[2], flashAlpha)
        p.text('\u26A0 MEANWHILE: Odds Engine updates odds to 2.10 (version=43)', W / 2, 165)

        const steps2 = [
          { from: colOddsV, to: colBetSvc, y: 195, label: '3. REJECT: version mismatch (42 != 43)', color: RED },
          { from: colBetSvc, to: colUser, y: 230, label: '4. 409 Conflict: odds have changed', color: RED },
        ]

        for (const step of steps2) {
          drawArrowH(p, step.from, step.y, step.to, step.color, step.label)
        }

        // Client retry
        p.fill(...YELLOW, 200)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Client shows updated odds (2.10), user accepts or cancels', W / 2, 265)

        const steps3 = [
          { from: colUser, to: colBetSvc, y: 295, label: '5. Retry: POST /bets (odds=2.10, version=43)', color: INDIGO },
          { from: colBetSvc, to: colOddsV, y: 325, label: '6. Validate: version=43 matches!', color: PINK },
          { from: colOddsV, to: colBetSvc, y: 348, label: '7. OK', color: CYAN },
          { from: colBetSvc, to: colWallet, y: 373, label: '8. Debit wallet', color: PINK },
          { from: colBetSvc, to: colUser, y: 403, label: '9. 201 Created at new odds', color: GREEN },
        ]

        for (const step of steps3) {
          drawArrowH(p, step.from, step.y, step.to, step.color, step.label)
        }

        // Animation
        const allSteps = [...steps, ...steps2, ...steps3]
        const cycle = (t * 0.12) % 1
        const stepIdx = Math.floor(cycle * allSteps.length)
        const stepProg = (cycle * allSteps.length) - stepIdx
        if (stepIdx < allSteps.length) {
          const s = allSteps[stepIdx]
          const dotColor = stepIdx >= 2 && stepIdx <= 3 ? RED : GREEN
          drawDot(p, s.from, s.y, s.to, s.y, stepProg, dotColor)
        }
      }
    }
  }, [showRace])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: Bet Placement (The Critical Path)</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Bet placement is the most critical operation. It must be <strong>atomic</strong>:
        validate that the odds have not changed, verify the user has sufficient balance,
        debit the wallet, and record the bet {'\u2014'} all in a single transaction. If any
        step fails, everything rolls back. Optimistic locking with version numbers prevents
        double-debits and stale-odds acceptance.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowRace(false)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            !showRace ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Happy Path
        </button>
        <button
          onClick={() => setShowRace(true)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            showRace ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Race Condition
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Deep Dive 2: Real-Time Odds Engine (p5)               */
/* ================================================================== */

function OddsEngineSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 780
    const H = 420

    // Simulated odds data
    const baseOdds = [
      { name: 'Home Win', odds: 2.10 },
      { name: 'Draw', odds: 3.40 },
      { name: 'Away Win', odds: 3.20 },
    ]
    const oddsHistory: number[][] = [[], [], []]
    const MAX_HIST = 120

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 780)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(...BG)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Real-Time Odds Engine \u2014 Football Match', W / 2, 8)

      // Architecture section on left
      const archW = W * 0.40
      const boxW = 80
      const boxH = 28

      // Input sources (column 1)
      const srcX = 50
      const engX = archW * 0.55
      const outX = archW * 0.88

      drawBox(p, srcX, 70, boxW, boxH, ORANGE, 'Data Feeds', 'external')
      drawBox(p, srcX, 120, boxW, boxH, PINK, 'Bet Volume', 'incoming bets')
      drawBox(p, srcX, 170, boxW, boxH, PURPLE, 'Trading Team', 'manual adj.')

      // Odds engine
      drawBox(p, engX, 120, boxW + 10, boxH + 8, RED, 'Odds Engine', 'recalculate')

      // Output
      drawBox(p, outX, 80, boxW - 10, boxH, CYAN, 'WebSocket', 'push')
      drawBox(p, outX, 160, boxW - 10, boxH, INDIGO, 'Odds Store', 'persist')

      // Arrows (all horizontal or vertical)
      drawArrowH(p, srcX + boxW / 2 + 3, 70, engX - (boxW + 10) / 2 - 3, ORANGE)
      drawArrowH(p, srcX + boxW / 2 + 3, 120, engX - (boxW + 10) / 2 - 3, PINK)
      drawArrowH(p, srcX + boxW / 2 + 3, 170, engX - (boxW + 10) / 2 - 3, PURPLE)
      drawArrowH(p, engX + (boxW + 10) / 2 + 3, 100, outX - (boxW - 10) / 2 - 3, RED)
      drawArrowH(p, engX + (boxW + 10) / 2 + 3, 140, outX - (boxW - 10) / 2 - 3, RED)

      // L-shape from Engine up to WebSocket
      drawLArrow(p, engX + (boxW + 10) / 2 + 3, 110, outX, 80 - boxH / 2 - 3, RED, '', true)

      // Animated dot: data feed to engine
      const dp = (t * 0.4) % 1
      if (dp < 0.5) {
        drawDot(p, srcX + boxW / 2, 120, engX - (boxW + 10) / 2, 120, dp * 2, PINK)
      }

      // Right side: live odds chart
      const chartL = archW + 30
      const chartR = W - 20
      const chartT = 45
      const chartB = 200
      const chartW = chartR - chartL
      const chartH = chartB - chartT

      // Update odds every few frames
      if (p.frameCount % 4 === 0) {
        for (let i = 0; i < 3; i++) {
          const drift = (Math.sin(t * (0.8 + i * 0.3) + i * 2) * 0.15) +
            (Math.cos(t * (1.5 + i * 0.5)) * 0.08)
          const newOdds = Math.max(1.1, baseOdds[i].odds + drift)
          oddsHistory[i].push(newOdds)
          if (oddsHistory[i].length > MAX_HIST) oddsHistory[i].shift()
        }
      }

      // Chart background
      p.fill(20, 20, 35)
      p.stroke(40, 40, 60)
      p.strokeWeight(1)
      p.rect(chartL, chartT, chartW, chartH, 4)

      // Y-axis labels
      p.fill(...TEXT_C)
      p.textSize(8)
      p.textAlign(p.RIGHT, p.CENTER)
      const minO = 1.0
      const maxO = 4.5
      for (let o = 1.5; o <= 4.0; o += 0.5) {
        const yy = chartB - ((o - minO) / (maxO - minO)) * chartH
        p.text(o.toFixed(1), chartL - 4, yy)
        p.stroke(40, 40, 60)
        p.strokeWeight(0.5)
        p.line(chartL, yy, chartR, yy)
      }

      // Draw odds lines
      const colors: [number, number, number][] = [GREEN, YELLOW, RED]
      for (let i = 0; i < 3; i++) {
        const hist = oddsHistory[i]
        if (hist.length < 2) continue
        p.stroke(...colors[i])
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let j = 0; j < hist.length; j++) {
          const xx = chartL + (j / MAX_HIST) * chartW
          const yy = chartB - ((hist[j] - minO) / (maxO - minO)) * chartH
          p.vertex(xx, yy)
        }
        p.endShape()

        // Current value
        const cur = hist[hist.length - 1]
        const curY = chartB - ((cur - minO) / (maxO - minO)) * chartH
        p.fill(...colors[i])
        p.noStroke()
        p.ellipse(chartR - 2, curY, 6, 6)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`${baseOdds[i].name}: ${cur.toFixed(2)}`, chartR + 6, curY)
      }

      p.fill(255)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Live Odds \u2014 Match Winner Market', (chartL + chartR) / 2, chartT - 15)

      // Supply/demand explanation below chart
      const exY = 225
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('How Odds Shift:', 20, exY)

      p.fill(...TEXT_C)
      p.textSize(9)
      const explanations = [
        { text: 'Large bet on Home Win \u2192 odds shorten (2.10 \u2192 1.90) to limit liability', color: GREEN },
        { text: 'External feed: goal scored by Away team \u2192 Away Win odds drop sharply', color: RED },
        { text: 'Trading team spots value \u2192 manual adjustment to Draw odds', color: YELLOW },
        { text: 'Liability too high on one outcome \u2192 odds lengthen to attract bets elsewhere', color: ORANGE },
      ]

      for (let i = 0; i < explanations.length; i++) {
        p.fill(explanations[i].color[0], explanations[i].color[1], explanations[i].color[2])
        p.ellipse(28, exY + 22 + i * 18, 6, 6)
        p.fill(...TEXT_C)
        p.text(explanations[i].text, 38, exY + 16 + i * 18)
      }

      // WebSocket push architecture at bottom
      const pushY = 320
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Push Architecture:', 20, pushY)

      const pushBoxY = pushY + 30
      drawBox(p, W * 0.12, pushBoxY, 80, 28, RED, 'Odds Engine')
      drawBox(p, W * 0.30, pushBoxY, 80, 28, ORANGE, 'Kafka Topic', 'per market')
      drawBox(p, W * 0.48, pushBoxY, 80, 28, CYAN, 'WS Gateway', 'cluster')

      // Fan out to clients
      const clientStartX = W * 0.66
      for (let i = 0; i < 4; i++) {
        const cy = pushBoxY - 24 + i * 16
        drawBox(p, clientStartX + 50, cy, 60, 14, INDIGO, `Client ${i + 1}`)
        drawArrowH(p, W * 0.48 + 43, pushBoxY, clientStartX + 50 - 33, cy, CYAN)
      }

      drawArrowH(p, W * 0.12 + 43, pushBoxY, W * 0.30 - 43, pushBoxY, RED)
      drawArrowH(p, W * 0.30 + 43, pushBoxY, W * 0.48 - 43, pushBoxY, ORANGE)

      // Shared subscription note
      p.fill(...TEXT_C)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Shared subscriptions: 1M clients watching same market share one Kafka consumer', W / 2, pushBoxY + 30)
      p.text('Only distinct market subscriptions consume engine resources', W / 2, pushBoxY + 42)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: Real-Time Odds Engine</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The Odds Engine continuously recalculates odds based on three inputs: incoming bet
        volume (liability management), external market data feeds from sports data providers,
        and manual adjustments from the trading team. Odds are pushed to clients via WebSocket
        every 100ms during live events. A large bet on one outcome shifts odds via
        supply/demand mechanics, just like a stock price.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Deep Dive 3: Settlement Pipeline (p5)                 */
/* ================================================================== */

function SettlementSection() {
  const [phase, setPhase] = useState(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const sketch = useCallback((p: p5) => {
    let W = 780
    const H = 400
    let t = 0

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 780)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(...BG)
      const ph = phaseRef.current

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Settlement Pipeline \u2014 Event Completion', W / 2, 8)

      const phases = [
        'Event finishes \u2192 result published',
        'Settlement Service reads open bets for market',
        'Batch process: mark winners, compute payouts',
        'Credit winning wallets, mark bets as settled',
        'Generate payout transactions (idempotent)',
      ]
      p.fill(...YELLOW)
      p.textSize(11)
      p.text(phases[Math.min(ph, phases.length - 1)], W / 2, 28)

      // Pipeline boxes in a grid
      const bw = 100
      const bh = 36

      const c1 = W * 0.12
      const c2 = W * 0.32
      const c3 = W * 0.52
      const c4 = W * 0.72
      const c5 = W * 0.90

      const r1 = 80
      const r2 = 160
      const r3 = 250
      const r4 = 330

      // Row 1: Event result arrives
      drawBox(p, c1, r1, bw, bh, GREEN, 'Event Result', 'Provider')
      drawBox(p, c2, r1, bw, bh, YELLOW, 'Settlement', 'Service')
      drawBox(p, c3, r1, bw, bh, INDIGO, 'Bet Store', '(read open bets)')

      if (ph >= 0) {
        drawArrowH(p, c1 + bw / 2 + 4, r1, c2 - bw / 2 - 4, GREEN, 'result: Home Win')
      }
      if (ph >= 1) {
        drawArrowH(p, c2 + bw / 2 + 4, r1, c3 - bw / 2 - 4, YELLOW, 'query bets')
      }

      // Row 2: Batch processing
      if (ph >= 2) {
        drawBox(p, c1, r2, bw, bh, PINK, 'Bet Classifier', 'won/lost/void')
        drawBox(p, c2, r2, bw, bh, ORANGE, 'Payout Calc', 'stake x odds')
        drawBox(p, c3, r2, bw + 20, bh, CYAN, 'Batch Processor', '10K bets/sec')

        drawArrowV(p, c2, r1 + bh / 2 + 4, r2 - bh / 2 - 4, YELLOW, 'classify')
        drawArrowH(p, c1 + bw / 2 + 4, r2, c2 - bw / 2 - 4, PINK)
        drawArrowH(p, c2 + bw / 2 + 4, r2, c3 - (bw + 20) / 2 - 4, ORANGE)

        // Show sample bets being classified
        const sampleBets = [
          { sel: 'Home Win', status: 'WON', color: GREEN },
          { sel: 'Draw', status: 'LOST', color: RED },
          { sel: 'Home Win', status: 'WON', color: GREEN },
          { sel: 'Away Win', status: 'LOST', color: RED },
        ]

        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        for (let i = 0; i < sampleBets.length; i++) {
          const by = r2 - 12 + i * 11
          const bx = c4
          p.fill(...sampleBets[i].color)
          p.text(`Bet #${i + 1}: ${sampleBets[i].sel} \u2192 ${sampleBets[i].status}`, bx, by)
        }
      }

      // Row 3: Credit wallets
      if (ph >= 3) {
        drawBox(p, c1, r3, bw, bh, YELLOW, 'Wallet Service', 'credit wins')
        drawBox(p, c2, r3, bw, bh, PURPLE, 'Bet Store', 'mark settled')
        drawBox(p, c3, r3, bw + 20, bh, GREEN, 'Notification', 'push: "You won!"')

        drawArrowV(p, c3, r2 + bh / 2 + 4, r3 - bh / 2 - 4, CYAN)
        drawArrowH(p, c3 - (bw + 20) / 2 - 4, r3, c2 + bw / 2 + 4, GREEN)
        drawArrowH(p, c2 - bw / 2 - 4, r3, c1 + bw / 2 + 4, PURPLE)

        // Payout examples
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.fill(...GREEN)
        p.text('Bet #1: $25 x 2.10 = $52.50 payout', c4, r3 - 8)
        p.fill(...GREEN)
        p.text('Bet #3: $50 x 2.10 = $105.00 payout', c4, r3 + 8)
      }

      // Row 4: Idempotency
      if (ph >= 4) {
        drawBox(p, c1, r4, bw, bh, TEXT_C, 'Audit Log', 'append-only')
        drawBox(p, c2, r4, bw + 20, bh, ORANGE, 'Transaction Log', 'double-entry')

        drawArrowV(p, c1, r3 + bh / 2 + 4, r4 - bh / 2 - 4, YELLOW)
        drawArrowV(p, c2, r3 + bh / 2 + 4, r4 - bh / 2 - 4, PURPLE)

        // Idempotency note
        p.fill(...CYAN)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text('IDEMPOTENCY: Each settlement carries a unique settlement_id.', c3 - 20, r4 - 10)
        p.text('If the pipeline crashes and restarts, already-settled bets', c3 - 20, r4 + 4)
        p.text('are skipped (dedup by settlement_id). Safe to retry infinitely.', c3 - 20, r4 + 18)
      }

      // Animated progress dots
      if (ph >= 0 && ph < 2) {
        const dp = (t * 0.3) % 1
        if (dp < 0.5) {
          drawDot(p, c1 + bw / 2, r1, c2 - bw / 2, r1, dp * 2, GREEN)
        } else if (ph >= 1) {
          drawDot(p, c2 + bw / 2, r1, c3 - bw / 2, r1, (dp - 0.5) * 2, YELLOW)
        }
      }
      if (ph >= 2 && ph < 4) {
        const dp = (t * 0.25) % 1
        if (dp < 0.33) {
          drawDot(p, c1 + bw / 2, r2, c2 - bw / 2, r2, dp * 3, PINK)
        } else if (dp < 0.66) {
          drawDot(p, c2 + bw / 2, r2, c3 - (bw + 20) / 2, r2, (dp - 0.33) * 3, ORANGE)
        }
      }
      if (ph >= 3) {
        const dp = (t * 0.2) % 1
        if (dp < 0.5) {
          drawDot(p, c3 - (bw + 20) / 2, r3, c1 + bw / 2, r3, dp * 2, GREEN)
        }
      }

      // Phase indicator dots at bottom
      const dotY = H - 12
      const dotSpacing = 60
      const startX = W / 2 - (phases.length - 1) * dotSpacing / 2
      for (let i = 0; i < phases.length; i++) {
        const dx = startX + i * dotSpacing
        p.fill(i <= ph ? GREEN[0] : 50, i <= ph ? GREEN[1] : 50, i <= ph ? GREEN[2] : 50)
        p.noStroke()
        p.ellipse(dx, dotY, 10, 10)
        if (i < phases.length - 1) {
          p.stroke(i < ph ? 80 : 40)
          p.strokeWeight(2)
          p.line(dx + 5, dotY, dx + dotSpacing - 5, dotY)
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Settlement Pipeline</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        When a sporting event finishes, the Settlement Service must process potentially
        millions of bets. This is done in batches for throughput, with idempotency
        guarantees so that a crash mid-settlement does not result in double payouts or
        missed payouts. Each settlement operation carries a unique settlement_id;
        already-processed bets are skipped on retry.
      </p>
      <P5Sketch
        sketch={sketch}
        controls={
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPhase(s => Math.max(0, s - 1))}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Prev
            </button>
            <button
              onClick={() => setPhase(s => Math.min(4, s + 1))}
              className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500"
            >
              Next
            </button>
            <button
              onClick={() => setPhase(0)}
              className="px-3 py-1 rounded bg-slate-700 text-gray-300 text-xs hover:bg-slate-600"
            >
              Reset
            </button>
          </div>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Deep Dive 4: Cash-Out Mechanics (p5)                  */
/* ================================================================== */

function CashOutSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 780
    const H = 440

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 780)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(...BG)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Cash-Out Mechanics \u2014 Sell Back a Live Bet', W / 2, 8)

      // Left panel: the math
      const leftW = W * 0.45
      const rightStart = leftW + 20

      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Cash-Out Formula:', 20, 38)

      p.fill(...TEXT_C)
      p.textSize(9)
      p.text('Original bet: $100 on Home Win at odds 3.00', 20, 58)
      p.text('Potential payout if Home wins: $300', 20, 74)

      // Simulated current odds shifting
      const currentOdds = 1.50 + Math.sin(t * 0.5) * 0.40
      const cashOutOffer = (100 * 3.00) / currentOdds
      const profit = cashOutOffer - 100

      p.fill(...YELLOW)
      p.textSize(10)
      p.text(`Current odds (Home Win): ${currentOdds.toFixed(2)}`, 20, 98)
      p.text(`(Odds shortened because Home is winning)`, 20, 114)

      // Formula
      p.fill(...CYAN)
      p.textSize(10)
      p.text('Cash-out = (stake \u00d7 original_odds) / current_odds', 20, 140)
      p.fill(255)
      p.textSize(10)
      p.text(`Cash-out = (100 \u00d7 3.00) / ${currentOdds.toFixed(2)}`, 20, 158)

      p.fill(profit > 0 ? GREEN[0] : RED[0], profit > 0 ? GREEN[1] : RED[1], profit > 0 ? GREEN[2] : RED[2])
      p.textSize(14)
      p.text(`= $${cashOutOffer.toFixed(2)}`, 20, 178)
      p.textSize(10)
      p.text(profit > 0 ? `Profit: +$${profit.toFixed(2)}` : `Loss: -$${Math.abs(profit).toFixed(2)}`, 20, 200)

      // Visual bar comparing options
      const barY = 235
      const barH = 18
      const maxPayout = 300
      const barScale = (leftW - 40) / maxPayout

      p.fill(40, 40, 60)
      p.rect(20, barY, maxPayout * barScale, barH, 3)

      // Original stake
      p.fill(...RED, 180)
      p.rect(20, barY, 100 * barScale, barH, 3)
      p.fill(255)
      p.textSize(7)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Stake: $100', 20 + 50 * barScale, barY + barH / 2)

      // Cash-out amount
      p.fill(...YELLOW, 180)
      p.rect(20, barY + barH + 4, Math.min(cashOutOffer, maxPayout) * barScale, barH, 3)
      p.fill(255)
      p.textSize(7)
      p.text(`Cash out: $${cashOutOffer.toFixed(0)}`, 20 + Math.min(cashOutOffer, maxPayout) * barScale / 2, barY + barH + 4 + barH / 2)

      // Full payout if wins
      p.fill(...GREEN, 180)
      p.rect(20, barY + (barH + 4) * 2, maxPayout * barScale, barH, 3)
      p.fill(255)
      p.textSize(7)
      p.text('If wins: $300', 20 + maxPayout * barScale / 2, barY + (barH + 4) * 2 + barH / 2)

      // Risk labels
      p.textAlign(p.LEFT, p.CENTER)
      p.fill(...TEXT_C)
      p.textSize(7)
      p.text('GUARANTEED', leftW - 50, barY + barH + 4 + barH / 2)
      p.text('IF WINS', leftW - 30, barY + (barH + 4) * 2 + barH / 2)

      // Right panel: cash-out flow
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Cash-Out Transaction Flow:', rightStart, 38)

      const flowSteps = [
        { label: '1. User taps Cash Out', color: INDIGO },
        { label: '2. Lock bet (prevent settlement race)', color: PINK },
        { label: '3. Verify current odds still valid', color: CYAN },
        { label: '4. Mark bet as cashed_out', color: PURPLE },
        { label: '5. Credit wallet: +$' + cashOutOffer.toFixed(2), color: YELLOW },
        { label: '6. Release pending balance', color: GREEN },
        { label: '7. Log transaction (audit trail)', color: TEXT_C },
      ]

      for (let i = 0; i < flowSteps.length; i++) {
        const fy = 62 + i * 28
        p.fill(flowSteps[i].color[0], flowSteps[i].color[1], flowSteps[i].color[2], 40)
        p.stroke(flowSteps[i].color[0], flowSteps[i].color[1], flowSteps[i].color[2])
        p.strokeWeight(1)
        p.rect(rightStart, fy, W - rightStart - 20, 22, 4)
        p.noStroke()
        p.fill(255)
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(flowSteps[i].label, rightStart + 8, fy + 11)

        // Progress indicator
        const stepProgress = (t * 0.15) % 1
        const activeStep = Math.floor(stepProgress * flowSteps.length)
        if (i === activeStep) {
          p.fill(flowSteps[i].color[0], flowSteps[i].color[1], flowSteps[i].color[2])
          p.ellipse(rightStart - 8, fy + 11, 8, 8)
        }
      }

      // Key insight at bottom
      const bottomY = 340
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Key Insights:', 20, bottomY)

      const insights = [
        { text: 'Cash-out offer changes every 100ms as odds update \u2014 user sees live counter', color: YELLOW },
        { text: 'Must be atomic: if odds change between tap and execution, recalculate or reject', color: PINK },
        { text: 'Bookmaker margin: actual cash-out is slightly less than fair value (house edge)', color: ORANGE },
        { text: 'Partial cash-out: user can sell back 50% of the bet, keep 50% riding', color: CYAN },
        { text: 'Race condition: event could settle between cash-out request and execution', color: RED },
      ]

      for (let i = 0; i < insights.length; i++) {
        p.fill(insights[i].color[0], insights[i].color[1], insights[i].color[2])
        p.ellipse(28, bottomY + 22 + i * 17, 6, 6)
        p.fill(...TEXT_C)
        p.textSize(8)
        p.text(insights[i].text, 38, bottomY + 17 + i * 17)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Cash-Out Mechanics</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Cash-out lets users sell back their bet mid-game for a guaranteed payout.
        The offer is calculated from the ratio of original odds to current odds.
        When a user{'\u2019'}s selection is winning, current odds shorten, making the
        cash-out offer higher than the original stake (but less than the full payout).
        This must be atomic {'\u2014'} the cash-out price can shift between tap and execution.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Scaling Strategy                                     */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">10. Scaling Strategy</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-pink-400 font-semibold mb-2">Bet Processing: Partition by Market</h4>
          <p className="text-gray-300 text-sm">
            Kafka topic for bets is partitioned by market_id. All bets for the same
            market go to the same partition, ensuring ordered processing per market.
            During a World Cup final, that single market partition gets very hot {'\u2014'}
            scale the partition count and consumer group for that specific topic.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">Wallet: Sharded by User ID</h4>
          <p className="text-gray-300 text-sm">
            The wallet database is the primary bottleneck. Shard by user_id so that
            wallet operations for different users hit different database shards.
            With 100 shards and 70K ops/sec, each shard handles ~700 ops/sec {'\u2014'}
            well within PostgreSQL capabilities. Cross-shard transactions are never
            needed since a bet only touches one user{'\u2019'}s wallet.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-red-400 font-semibold mb-2">Odds Engine: Dedicated Compute</h4>
          <p className="text-gray-300 text-sm">
            The odds engine is CPU-intensive (recalculating probabilities, liability models).
            Run on dedicated instances with high CPU allocation. Each instance handles
            a subset of markets. Hot markets (Champions League final) get dedicated
            engines. Stateless: can scale horizontally by assigning market ranges.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-cyan-400 font-semibold mb-2">Read Path: Separate Replicas</h4>
          <p className="text-gray-300 text-sm">
            Bet history and market browsing are read-heavy. Use read replicas of the
            bet store for history queries. Cache popular markets and their odds in
            Redis. The read path never touches the critical write path {'\u2014'} complete
            isolation prevents slow history queries from affecting bet placement latency.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-green-400 font-semibold mb-2">WebSocket: Horizontal Fan-out</h4>
          <p className="text-gray-300 text-sm">
            1M concurrent WebSocket connections require a cluster of WebSocket gateways.
            Each gateway subscribes to a Kafka topic for odds updates. Shared subscription
            pattern: if 100K users watch the same market, each gateway gets one copy of
            the update and fans out locally. This reduces Kafka load from O(clients)
            to O(gateways).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-orange-400 font-semibold mb-2">Settlement: Burst Capacity</h4>
          <p className="text-gray-300 text-sm">
            Settlement is bursty: idle during events, then a flood when events end.
            Use auto-scaling worker pools or serverless functions. The settlement queue
            absorbs the burst; workers drain it at 10K settlements/sec. Multiple
            events ending simultaneously (end of Saturday fixtures) can cause a
            settlement storm {'\u2014'} pre-provision for known schedules.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Fault Tolerance                                      */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">11. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-green-400 font-semibold mb-2">Exactly-Once Bet Processing</h4>
          <p className="text-gray-300 text-sm">
            Every bet request includes an idempotency_key (client-generated UUID).
            The bet processor checks if this key has been seen before. If so, it
            returns the original result without re-processing. This handles network
            retries, duplicate submissions, and crash recovery. The idempotency key
            is stored with the bet record and indexed for O(1) lookup.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold mb-2">Wallet Double-Entry Bookkeeping</h4>
          <p className="text-gray-300 text-sm">
            Every wallet mutation is recorded as a double-entry transaction: a debit
            to one account and a credit to another (house account). The wallet balance
            is always the sum of all transactions. This makes the system fully
            auditable and enables reconciliation. If a debit exists without a
            corresponding bet record, the reconciliation job detects and fixes it.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold mb-2">Dead Letter Queue for Failed Settlements</h4>
          <p className="text-gray-300 text-sm">
            If a bet fails to settle (e.g., wallet service is temporarily down), the
            settlement message goes to a dead letter queue after 3 retries with exponential
            backoff. A separate process monitors the DLQ and alerts operations. Failed
            settlements are retried manually or automatically once the underlying issue
            is resolved. No payout is ever lost.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-purple-400 font-semibold mb-2">Complete Audit Trail</h4>
          <p className="text-gray-300 text-sm">
            Regulatory requirement: every transaction, odds change, bet placement,
            settlement, and cash-out must be logged in an append-only audit log.
            This log is immutable (write-once, never delete). Stored in a separate
            database with different retention policies. Enables full reconstruction
            of any dispute or regulatory inquiry.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-cyan-400 font-semibold mb-2">Market Suspension</h4>
          <p className="text-gray-300 text-sm">
            If the odds engine detects anomalous data (feed outage, suspicious betting
            patterns), it can instantly suspend a market. All bet placement attempts
            for that market are rejected until the trading team reviews and reopens.
            This is the kill switch that prevents massive losses from corrupted data.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- Tradeoffs                                            */
/* ================================================================== */

function TradeoffsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">12. Tradeoffs</h2>

      <div className="space-y-4">
        {[
          {
            left: 'Accept Bet Instantly (Optimistic)',
            right: 'Validate Fully Before Accepting',
            leftPros: 'Lower latency, better UX, competitive advantage',
            rightPros: 'No risk of accepting bets at stale odds (protects house)',
            tension:
              'Most platforms accept with a small odds-drift tolerance (e.g., 2% drift OK). Reject only if odds moved significantly. This balances UX with risk.',
          },
          {
            left: 'In-Memory Odds (Redis/Cache)',
            right: 'Persisted Odds (Database)',
            leftPros: 'Sub-ms reads, can push 100K updates/sec easily',
            rightPros: 'Durable, full history for audit, no data loss on crash',
            tension:
              'Hybrid: odds engine writes to both Redis (for serving) and append-only log (for audit). Redis is the source of truth for current odds; the log is the source of truth for history.',
          },
          {
            left: 'Push Odds via WebSocket',
            right: 'Poll Odds via HTTP',
            leftPros: 'True real-time (100ms updates), lower total bandwidth',
            rightPros: 'Simpler infrastructure, no connection state to manage',
            tension:
              'Push for live events (where real-time matters), poll for pre-match markets (where staleness is acceptable). Reduces WebSocket connection count by ~80%.',
          },
          {
            left: 'Synchronous Bet Processing',
            right: 'Async via Queue',
            leftPros: 'User gets instant confirmation, simpler flow',
            rightPros: 'Better throughput, handles bursts, decouples services',
            tension:
              'Synchronous for the critical path (validate + debit + store in one request). Async for downstream effects (notifications, analytics, risk recalculation).',
          },
          {
            left: 'Single Global Wallet DB',
            right: 'Sharded Wallet by User ID',
            leftPros: 'Simpler, no cross-shard concerns, easy consistency',
            rightPros: 'Horizontal scale, no single point of bottleneck',
            tension:
              'Shard when you exceed single-DB throughput (~10K TPS). Since a bet only touches one user wallet, sharding by user_id has zero cross-shard transactions.',
          },
        ].map((tradeoff, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-green-400 font-semibold text-sm">{tradeoff.left}</span>
              <span className="text-gray-500 text-sm">vs.</span>
              <span className="text-blue-400 font-semibold text-sm">{tradeoff.right}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <p className="text-gray-400 text-xs">
                <span className="text-green-400">+</span> {tradeoff.leftPros}
              </p>
              <p className="text-gray-400 text-xs">
                <span className="text-blue-400">+</span> {tradeoff.rightPros}
              </p>
            </div>
            <p className="text-yellow-400 text-xs italic">{tradeoff.tension}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignBetting() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold text-white">
          Design a Betting Platform
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          How do you build a real-time sports betting platform that handles 50K bets/sec,
          pushes odds every 100ms, guarantees exactly-once processing with money on every
          transaction, and stays up during the World Cup final?
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <BetPlacementSection />
      <OddsEngineSection />
      <SettlementSection />
      <CashOutSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />

      <footer className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
        System Design Case Study {'\u2014'} oneML Learning Platform
      </footer>
    </div>
  )
}
