import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-robinhood',
  title: 'Design Robinhood (Stock Trading)',
  description:
    'System design case study: commission-free stock trading with real-time prices, order lifecycle, smart order routing, portfolio management, and risk checks at scale',
  track: 'systems',
  order: 22,
  tags: [
    'system-design',
    'robinhood',
    'stock-trading',
    'order-matching',
    'portfolio',
    'risk-management',
    'real-time',
    'fintech',
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
  const dir = hFirst ? (y2 > y1 ? 1 : -1) : (x2 > x1 ? 1 : -1)
  p.fill(...color, 160)
  p.noStroke()
  const aLen = 7
  if (hFirst) {
    p.triangle(x2, y2, x2 - 4, y2 - dir * aLen, x2 + 4, y2 - dir * aLen)
  } else {
    p.triangle(x2, y2, x2 - dir * aLen, y2 - 4, x2 - dir * aLen, y2 + 4)
  }
  if (label) {
    p.fill(...TEXT_C)
    p.textSize(7)
    p.textAlign(p.CENTER, p.BOTTOM)
    if (hFirst) {
      p.text(label, (x1 + x2) / 2, y1 - 3)
    } else {
      p.textAlign(p.LEFT, p.CENTER)
      p.text(label, x1 + 4, (y1 + y2) / 2)
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
        Design a commission-free stock trading platform like Robinhood. Users buy and sell
        stocks, ETFs, and options through a mobile app with zero trading fees. The system
        must handle the explosive volume at market open (9:30 AM ET) when millions of users
        place orders simultaneously, provide real-time price feeds for 10,000+ tickers,
        comply with SEC/FINRA regulations, and guarantee exactly-once order execution.
        This is a financial system where a bug can mean regulatory fines, customer losses,
        or systemic risk. The design emphasizes order lifecycle management, smart order
        routing, real-time portfolio calculations, and pre-trade risk checks.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Buy/sell stocks: market orders, limit orders, stop orders</li>
        <li>Real-time stock price feeds for 10K+ tickers</li>
        <li>Portfolio view: holdings, total value, unrealized P&L, daily change</li>
        <li>Watchlists: track favorite stocks with live prices</li>
        <li>Order history with status tracking</li>
        <li>Fractional shares: buy $5 worth of a $3,000 stock</li>
        <li>Options trading (calls/puts, basic strategies)</li>
        <li>Margin trading with borrowing limits</li>
        <li>Instant deposits: trade immediately while bank transfer clears</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Order execution latency {'\u003C'}50ms (SEC best-execution requirement)</li>
        <li>Real-time price feeds: 10K tickers {'\u00d7'} update every 100ms = 100K updates/sec</li>
        <li>99.99% availability during market hours (9:30 AM {'\u2013'} 4:00 PM ET)</li>
        <li>Handle 10M+ users placing orders at market open (8.3K orders/sec peak)</li>
        <li>SEC/FINRA compliance: audit trail, best execution, pattern day trading rules</li>
        <li>Exactly-once order execution (no duplicate fills, no lost orders)</li>
        <li>T+2 settlement reconciliation with clearing houses</li>
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
        <h4 className="text-white font-semibold">Order Volume</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10M DAU, 20% place orders on a given day = 2M orders/day</li>
          <li>Peak: first 15 minutes of market open = 500K orders/min = 8.3K/sec</li>
          <li>Average order size: ~$500 {'\u2192'} $4.15M/sec flowing through at peak</li>
          <li>Each order: ~1KB (IDs, symbol, type, quantity, limits) {'\u2192'} 2 GB/day</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Market Data</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10K tickers {'\u00d7'} price update every 100ms = 100K price updates/sec inbound</li>
          <li>Each update: ~200 bytes (symbol, bid, ask, last, volume) = 20 MB/sec raw</li>
          <li>Fanout to 10M users watching portfolios/watchlists: massive egress</li>
          <li>Smart fanout: user only receives updates for their 50 held/watched tickers</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Portfolio Computation</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10M users {'\u00d7'} avg 12 positions = 120M position records</li>
          <li>Each AAPL price tick affects ~5M users who hold AAPL</li>
          <li>Cannot recompute 5M portfolios on every tick {'\u2192'} need smart caching</li>
          <li>Position data: 120M {'\u00d7'} 100 bytes = 12 GB (fits in memory cluster)</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Storage</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Order history: 2M orders/day {'\u00d7'} 365 = 730M orders/year {'\u00d7'} 1KB = 730 GB/year</li>
          <li>Trade executions: ~4M fills/day (partial fills) = 1.5 TB/year</li>
          <li>Price history: 10K tickers {'\u00d7'} 86.4K seconds/day {'\u00d7'} 200 bytes = 17 GB/day</li>
          <li>7-year regulatory retention requirement for all records</li>
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
          <code className="text-green-400 text-sm">POST /api/v1/orders</code>
          <p className="text-gray-400 text-sm mt-1">
            Place an order. Body: {'{'} symbol, side: buy|sell, type: market|limit|stop,
            quantity, limit_price?, stop_price?, time_in_force: day|gtc, idempotency_key {'}'}
            {' \u2192 '} Returns order with id, status (pending_new), estimated fill price.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">DELETE /api/v1/orders/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Cancel an open order. Race condition: order may fill before cancel reaches exchange.
            Returns 200 if cancel accepted, 409 if already filled.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/orders/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Get order status including fills. Includes: status, filled_qty, avg_fill_price,
            remaining_qty, last_fill_timestamp.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/portfolio</code>
          <p className="text-gray-400 text-sm mt-1">
            Portfolio summary: total_value, day_change, total_gain_loss, buying_power.
            Computed from positions {'\u00d7'} latest prices.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/positions</code>
          <p className="text-gray-400 text-sm mt-1">
            All held positions: symbol, quantity, avg_cost, current_price, market_value,
            unrealized_pnl, day_change.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/quotes/:symbol</code>
          <span className="text-gray-500 text-sm ml-2">(WebSocket)</span>
          <p className="text-gray-400 text-sm mt-1">
            Subscribe to real-time quotes. Pushes bid, ask, last, volume, day_high, day_low.
            WebSocket for active trading; REST polling for background refreshes.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/watchlist</code>
          <span className="text-gray-500 mx-2">|</span>
          <code className="text-green-400 text-sm">POST /api/v1/watchlist</code>
          <p className="text-gray-400 text-sm mt-1">
            Get/update watchlist. Body for POST: {'{'} symbol, action: add|remove {'}'}.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/deposits</code>
          <p className="text-gray-400 text-sm mt-1">
            Instant deposit. Body: {'{'} amount, bank_account_id {'}'}. Immediately adds to buying
            power (up to $1K limit). Actual ACH transfer settles in 3-5 business days.
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
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Account</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  user_id: uuid,
  cash_balance: decimal,
  buying_power: decimal,
  margin_enabled: bool,
  margin_used: decimal,
  instant_deposit_limit: decimal,
  pattern_day_trader: bool,
  day_trade_count: int,
  account_type: "cash" | "margin",
  status: "active" | "restricted",
  version: int
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Order</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  user_id: uuid,
  symbol: string,
  side: "buy" | "sell",
  type: "market" | "limit" | "stop"
        | "stop_limit",
  quantity: decimal,
  filled_qty: decimal,
  limit_price: decimal | null,
  stop_price: decimal | null,
  avg_fill_price: decimal | null,
  status: "pending_new" | "new" |
    "partial" | "filled" |
    "cancelled" | "rejected",
  time_in_force: "day" | "gtc",
  idempotency_key: string,
  created_at: timestamp,
  updated_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Position</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  user_id: uuid,
  symbol: string,
  quantity: decimal,
  avg_cost: decimal,
  market_value: decimal,
  unrealized_pnl: decimal,
  realized_pnl: decimal,
  day_change: decimal,
  updated_at: timestamp
}
-- PK: (user_id, symbol)
-- Fractional: quantity can be 0.0023
-- Updated on every fill event`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Trade (Fill)</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  order_id: uuid,
  symbol: string,
  side: "buy" | "sell",
  price: decimal,
  quantity: decimal,
  exchange: string,
  executed_at: timestamp,
  settlement_date: date
}
-- An order can have multiple fills
-- (partial execution)
-- T+2 settlement: trade date + 2 days`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Quote</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  symbol: string,
  bid: decimal,
  ask: decimal,
  last: decimal,
  volume: bigint,
  day_high: decimal,
  day_low: decimal,
  prev_close: decimal,
  timestamp: timestamp
}
-- In-memory (Redis): hot path
-- Persisted to time-series DB for charts`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Watchlist</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  user_id: uuid,
  symbols: string[],
  updated_at: timestamp
}
-- Also used to determine which price
-- updates to push via WebSocket
-- Merged with positions for subscription
-- list: held symbols + watched symbols`}</pre>
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
    const H = 720

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 1000)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Robinhood \u2014 Stock Trading Platform', W / 2, 10)

      const bw = 110
      const bh = 40
      const g = 8
      const hw = bw / 2
      const hh = bh / 2

      // ─── LANE 1: ORDER FLOW (left half) ───
      const lx = W * 0.22
      const y1 = 80, y2 = 155, y3 = 230, y4 = 305, y5 = 380, y6 = 455

      p.fill(99, 102, 241)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('ORDER FLOW', lx, 38)

      drawBox(p, lx, y1, bw, bh, INDIGO, 'Client App', '')
      drawBox(p, lx, y2, bw, bh, GREEN, 'API Gateway', '')
      drawBox(p, lx, y3, bw, bh, PINK, 'Order Service', 'validate')
      drawBox(p, lx, y4, bw, bh, ORANGE, 'Risk + Router', 'pre-trade check')
      drawBox(p, lx, y5, bw, bh, CYAN, 'Exchange', 'NYSE/NASDAQ')
      drawBox(p, lx, y6, bw, bh, PURPLE, 'Position Svc', 'update holdings')

      drawArrowV(p, lx, y1 + hh + g, y2 - hh - g, INDIGO)
      drawArrowV(p, lx, y2 + hh + g, y3 - hh - g, GREEN)
      drawArrowV(p, lx, y3 + hh + g, y4 - hh - g, PINK)
      drawArrowV(p, lx, y4 + hh + g, y5 - hh - g, ORANGE)
      drawArrowV(p, lx, y5 + hh + g, y6 - hh - g, CYAN)

      // Side boxes — data stores branching right from order flow
      const sideX = lx + bw + 50
      drawBox(p, sideX, y3, bw, bh, PURPLE, 'Order Store', '(Postgres)')
      drawArrowH(p, lx + hw + g, y3, sideX - hw - g, PINK, 'persist')

      drawBox(p, sideX, y4, bw, bh, YELLOW, 'Account Store', 'buying power')
      drawArrowH(p, lx + hw + g, y4, sideX - hw - g, ORANGE, 'check')

      drawBox(p, sideX, y6, bw, bh, INDIGO, 'Position DB', '(holdings)')
      drawArrowH(p, lx + hw + g, y6, sideX - hw - g, PURPLE, 'store')

      // ─── LANE 2: MARKET DATA (right half) ───
      const rx = W * 0.72
      const my1 = 80, my2 = 155, my3 = 230, my4 = 305

      p.fill(255, 140, 50)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('MARKET DATA FLOW', rx, 38)

      drawBox(p, rx, my1, bw, bh, ORANGE, 'Exchange Feeds', 'SIP/direct')
      drawBox(p, rx, my2, bw, bh, RED, 'Market Data Svc', 'normalize')
      drawBox(p, rx, my3, bw, bh, CYAN, 'Price Cache', '(Redis)')
      drawBox(p, rx, my4, bw, bh, GREEN, 'WebSocket GW', 'push to clients')

      drawArrowV(p, rx, my1 + hh + g, my2 - hh - g, ORANGE)
      drawArrowV(p, rx, my2 + hh + g, my3 - hh - g, RED)
      drawArrowV(p, rx, my3 + hh + g, my4 - hh - g, CYAN)

      // Portfolio Svc — same row as Position Svc (y6)
      drawBox(p, rx, y6, bw, bh, YELLOW, 'Portfolio Svc', 'P&L calc')
      // Position DB → Portfolio Svc (horizontal, same row)
      drawArrowH(p, sideX + hw + g, y6, rx - hw - g, PURPLE, 'positions')
      // WebSocket GW → Portfolio Svc (vertical, from my4 to y6)
      drawArrowV(p, rx, my4 + hh + g, y6 - hh - g, GREEN, 'prices')
      // Note below Portfolio Svc
      p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 100)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('sends P&L back to clients via WebSocket', rx, y6 + hh + 6)

      // Settlement at bottom center
      const setY = 530
      drawBox(p, W * 0.35, setY, bw, bh, TEXT_C, 'Clearing House', 'T+2 settle')
      drawBox(p, W * 0.60, setY, bw, bh, PURPLE, 'Reconciliation', 'daily')
      drawArrowH(p, W * 0.35 + hw + g, setY, W * 0.60 - hw - g, TEXT_C, 'settlement')

      // ─── ANIMATED DOTS ───
      const steps1 = [y1, y2, y3, y4, y5, y6]
      const bp = (t * 0.2) % 1
      const ss = 1 / (steps1.length - 1)
      const bi = Math.min(Math.floor(bp / ss), steps1.length - 2)
      const bl = (bp - bi * ss) / ss
      drawDot(p, lx, steps1[bi] + hh, lx, steps1[bi + 1] - hh, bl, INDIGO)

      const steps2 = [my1, my2, my3, my4]
      const mp = ((t * 0.25) + 0.4) % 1
      const ms = 1 / (steps2.length - 1)
      const mi = Math.min(Math.floor(mp / ms), steps2.length - 2)
      const ml = (mp - mi * ms) / ms
      drawDot(p, rx, steps2[mi] + hh, rx, steps2[mi + 1] - hh, ml, ORANGE)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The architecture shows two main flows: the <strong className="text-indigo-400">order flow</strong> (blue
        dot) from client through risk checks and smart routing to exchanges and back, and
        the <strong className="text-orange-400">market data flow</strong> (orange dot) from exchange
        price feeds through normalization to clients via WebSocket.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Deep Dive 1: Order Lifecycle (p5)                     */
/* ================================================================== */

function OrderLifecycleSection() {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'cancel'>('market')
  const orderTypeRef = useRef(orderType)
  orderTypeRef.current = orderType

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
      const oType = orderTypeRef.current

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      const titles: Record<string, string> = {
        market: 'Order Lifecycle \u2014 Market Order (Immediate Execution)',
        limit: 'Order Lifecycle \u2014 Limit Order (Wait for Price)',
        cancel: 'Order Lifecycle \u2014 Cancel Race Condition',
      }
      p.text(titles[oType], W / 2, 8)

      // State machine nodes
      const stateY = 55
      const stateH = 30
      const stateW = 80

      // Common states
      const states = [
        { x: W * 0.08, label: 'CREATED', color: TEXT_C },
        { x: W * 0.24, label: 'VALIDATED', color: INDIGO },
        { x: W * 0.40, label: 'ROUTED', color: ORANGE },
        { x: W * 0.56, label: 'PARTIAL', color: YELLOW },
        { x: W * 0.72, label: 'FILLED', color: GREEN },
        { x: W * 0.88, label: 'CANCELLED', color: RED },
      ]

      for (const st of states) {
        drawBox(p, st.x, stateY, stateW, stateH, st.color, st.label)
      }

      // State transitions
      drawArrowH(p, states[0].x + stateW / 2 + 3, stateY, states[1].x - stateW / 2 - 3, INDIGO)
      drawArrowH(p, states[1].x + stateW / 2 + 3, stateY, states[2].x - stateW / 2 - 3, ORANGE)
      drawArrowH(p, states[2].x + stateW / 2 + 3, stateY, states[3].x - stateW / 2 - 3, YELLOW)
      drawArrowH(p, states[3].x + stateW / 2 + 3, stateY, states[4].x - stateW / 2 - 3, GREEN)
      // Cancel transition from ROUTED or PARTIAL
      drawLArrow(p, states[2].x, stateY + stateH / 2 + 3, states[5].x, stateY + stateH / 2 + 3, RED, '', false)

      if (oType === 'market') {
        // Market order: goes straight through
        const seqTop = 110
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Market order executes immediately at the best available price:', 20, seqTop)

        const steps = [
          'User taps "Buy 10 shares AAPL at Market"',
          'Risk engine: check buying power ($10 x ~$175 = $1,750 needed)',
          'Smart Order Router: NASDAQ has best ask at $174.98',
          'Order sent to NASDAQ',
          'NASDAQ matches with a resting sell order',
          'Fill received: 10 shares @ $174.98',
          'Position updated: AAPL qty += 10, avg_cost recalculated',
          'Account debited: $1,749.80',
          'Confirmation pushed to client via WebSocket',
        ]

        for (let i = 0; i < steps.length; i++) {
          const sy = seqTop + 22 + i * 28
          const isActive = Math.floor((t * 0.8) % steps.length) === i
          p.fill(isActive ? GREEN[0] : 60, isActive ? GREEN[1] : 60, isActive ? GREEN[2] : 60, isActive ? 40 : 20)
          p.noStroke()
          p.rect(20, sy, W - 40, 24, 4)
          if (isActive) { p.fill(255) } else { p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2]) }
          p.textSize(9)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`${i + 1}. ${steps[i]}`, 30, sy + 12)

          if (isActive) {
            p.fill(...GREEN)
            p.ellipse(15, sy + 12, 6, 6)
          }
        }

        // Timing note
        p.fill(...CYAN)
        p.textSize(9)
        p.textAlign(p.CENTER, p.TOP)
        p.text('Total time: ~30-50ms from submit to fill confirmation', W / 2, seqTop + 22 + steps.length * 28 + 8)

      } else if (oType === 'limit') {
        // Limit order: sits in order book
        const seqTop = 100

        // Order book visualization
        const obLeft = 30
        const obW = W * 0.40
        const obTop = seqTop + 10

        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Limit Order: Buy 10 AAPL @ $170.00 (market price: $174.98)', 20, seqTop - 8)

        // Order book header
        p.fill(...TEXT_C)
        p.textSize(9)
        p.text('   Price      Qty     Side', obLeft, obTop)

        const book = [
          { price: '175.50', qty: '200', side: 'ASK', color: RED },
          { price: '175.20', qty: '450', side: 'ASK', color: RED },
          { price: '174.98', qty: '1,200', side: 'ASK', color: RED },
          { price: '------', qty: '---', side: 'SPREAD', color: YELLOW },
          { price: '174.50', qty: '800', side: 'BID', color: GREEN },
          { price: '174.00', qty: '1,500', side: 'BID', color: GREEN },
          { price: '170.00', qty: '10', side: 'BID \u2190 YOUR ORDER', color: CYAN },
          { price: '169.50', qty: '3,000', side: 'BID', color: GREEN },
        ]

        for (let i = 0; i < book.length; i++) {
          const by = obTop + 18 + i * 20
          const entry = book[i]
          const isYours = i === 6
          if (isYours) {
            const flash = Math.sin(t * 3) > 0 ? 40 : 20
            p.fill(CYAN[0], CYAN[1], CYAN[2], flash)
            p.noStroke()
            p.rect(obLeft - 5, by - 3, obW, 18, 3)
          }
          p.fill(...entry.color)
          p.textSize(9)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`  $${entry.price}    ${entry.qty}     ${entry.side}`, obLeft, by + 6)
        }

        // Right side: explanation
        const exLeft = obLeft + obW + 30
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('What happens:', exLeft, obTop)

        const events = [
          { text: 'Order sits in book at $170.00', color: CYAN },
          { text: 'Market price is $174.98 (above limit)', color: YELLOW },
          { text: 'Your order waits for price to drop', color: TEXT_C },
          { text: 'If AAPL drops to $170.00, order fills', color: GREEN },
          { text: 'Time-in-force: "day" = cancel at 4:00 PM', color: ORANGE },
          { text: 'Time-in-force: "GTC" = stays until filled', color: PURPLE },
          { text: 'Partial fills possible (only 7 of 10 available)', color: PINK },
        ]

        for (let i = 0; i < events.length; i++) {
          const ey = obTop + 22 + i * 24
          p.fill(events[i].color[0], events[i].color[1], events[i].color[2])
          p.ellipse(exLeft, ey + 4, 6, 6)
          p.fill(...TEXT_C)
          p.textSize(9)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(events[i].text, exLeft + 10, ey + 4)
        }

        // Price simulation at bottom
        const simY = obTop + 210
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Simulated price movement:', 20, simY)

        const simChartL = 30
        const simChartR = W - 30
        const simChartT = simY + 18
        const simChartH = 80
        const simChartW = simChartR - simChartL

        p.fill(20, 20, 35)
        p.stroke(40, 40, 60)
        p.strokeWeight(1)
        p.rect(simChartL, simChartT, simChartW, simChartH, 4)

        // Limit price line
        const limitY = simChartT + simChartH * 0.7
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([4, 4])
        p.stroke(CYAN[0], CYAN[1], CYAN[2], 150)
        p.strokeWeight(1)
        p.line(simChartL, limitY, simChartR, limitY)
        ctx.setLineDash([])
        p.fill(...CYAN)
        p.textSize(7)
        p.textAlign(p.LEFT, p.CENTER)
        p.text('Limit: $170.00', simChartL + 4, limitY - 8)

        // Price line
        p.stroke(...GREEN)
        p.strokeWeight(2)
        p.noFill()
        p.beginShape()
        for (let i = 0; i < 100; i++) {
          const xx = simChartL + (i / 100) * simChartW
          const phase = (t * 0.3 + i * 0.05) % (Math.PI * 2)
          const price = 174.98 - Math.sin(phase) * 3 - i * 0.05
          const yy = simChartT + simChartH * (1 - (price - 168) / 10)
          p.vertex(xx, Math.max(simChartT, Math.min(simChartT + simChartH, yy)))
        }
        p.endShape()

      } else {
        // Cancel race condition
        const seqTop = 100
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Cancel Race Condition: order may fill before cancel reaches exchange', 20, seqTop)

        // Two timelines side by side
        const tlW = (W - 60) / 2

        // Timeline 1: Cancel succeeds
        const t1Left = 20
        p.fill(...GREEN)
        p.textSize(10)
        p.text('Scenario A: Cancel Succeeds', t1Left, seqTop + 22)

        const stepsA = [
          { label: 'Limit order sitting on NASDAQ', color: INDIGO, time: 't=0' },
          { label: 'User taps Cancel', color: PINK, time: 't=1' },
          { label: 'Cancel request sent to NASDAQ', color: ORANGE, time: 't=2' },
          { label: 'NASDAQ removes from book', color: GREEN, time: 't=3' },
          { label: 'Cancel confirmed to client', color: GREEN, time: 't=4' },
        ]

        for (let i = 0; i < stepsA.length; i++) {
          const sy = seqTop + 44 + i * 30
          p.fill(stepsA[i].color[0], stepsA[i].color[1], stepsA[i].color[2], 30)
          p.noStroke()
          p.rect(t1Left, sy, tlW, 24, 4)
          p.fill(255)
          p.textSize(8)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`[${stepsA[i].time}] ${stepsA[i].label}`, t1Left + 8, sy + 12)
        }

        // Timeline 2: Cancel fails (filled first)
        const t2Left = 20 + tlW + 20
        p.fill(...RED)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Scenario B: Already Filled', t2Left, seqTop + 22)

        const stepsB = [
          { label: 'Limit order sitting on NASDAQ', color: INDIGO, time: 't=0' },
          { label: 'User taps Cancel', color: PINK, time: 't=1' },
          { label: 'MEANWHILE: price hits limit, order fills', color: YELLOW, time: 't=1.5' },
          { label: 'Cancel arrives at NASDAQ: "order not found"', color: RED, time: 't=2' },
          { label: 'Client receives: fill + cancel-reject', color: RED, time: 't=3' },
        ]

        for (let i = 0; i < stepsB.length; i++) {
          const sy = seqTop + 44 + i * 30
          p.fill(stepsB[i].color[0], stepsB[i].color[1], stepsB[i].color[2], 30)
          p.noStroke()
          p.rect(t2Left, sy, tlW, 24, 4)
          p.fill(255)
          p.textSize(8)
          p.textAlign(p.LEFT, p.CENTER)
          p.text(`[${stepsB[i].time}] ${stepsB[i].label}`, t2Left + 8, sy + 12)
        }

        // Key insight
        const insightY = seqTop + 44 + 5 * 30 + 20
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.LEFT, p.TOP)
        p.text('Handling the race condition:', 20, insightY)

        const insights = [
          'Cancel is "best effort" \u2014 never guarantee a cancel will succeed',
          'Client must handle both outcomes: cancel_confirmed OR filled',
          'If cancel-reject received, check for fills and update position',
          'Never assume cancel succeeded without confirmation from exchange',
          'UI shows "Cancel Pending..." until exchange responds',
        ]

        for (let i = 0; i < insights.length; i++) {
          p.fill(...TEXT_C)
          p.textSize(8)
          p.text(`\u2022 ${insights[i]}`, 28, insightY + 18 + i * 16)
        }

        // Animated highlight on active step
        const activeA = Math.floor((t * 0.6) % stepsA.length)
        const activeB = Math.floor((t * 0.6) % stepsB.length)
        p.fill(GREEN[0], GREEN[1], GREEN[2], 120)
        p.noStroke()
        p.ellipse(t1Left - 6, seqTop + 44 + activeA * 30 + 12, 6, 6)
        p.fill(RED[0], RED[1], RED[2], 120)
        p.ellipse(t2Left - 6, seqTop + 44 + activeB * 30 + 12, 6, 6)
      }
    }
  }, [orderType])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: Order Lifecycle</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        An order goes through a state machine: CREATED {'\u2192'} VALIDATED {'\u2192'} ROUTED {'\u2192'}
        PARTIAL {'\u2192'} FILLED (or CANCELLED at any point). Market orders execute immediately
        at the best price; limit orders sit in the order book waiting for the price to match;
        cancel requests race against fills.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setOrderType('market')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            orderType === 'market' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Market Order
        </button>
        <button
          onClick={() => setOrderType('limit')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            orderType === 'limit' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Limit Order
        </button>
        <button
          onClick={() => setOrderType('cancel')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            orderType === 'cancel' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Cancel Race
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Deep Dive 2: Smart Order Routing (p5)                 */
/* ================================================================== */

function SmartOrderRoutingSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0 // SOR
    let W = 780
    const H = 540

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
      p.text('Smart Order Router (SOR) \u2014 Best Execution', W / 2, 8)

      // Explanation
      p.fill(...TEXT_C)
      p.textSize(9)
      p.text('NBBO: National Best Bid and Offer \u2014 must execute at the best price across all exchanges', W / 2, 28)

      // User order
      const orderX = W * 0.12
      const orderY = 80
      drawBox(p, orderX, orderY, 100, 40, INDIGO, 'Buy 100 AAPL', 'Market Order')

      // SOR
      const sorX = W * 0.35
      const sorY = 80
      drawBox(p, sorX, sorY, 100, 40, ORANGE, 'Smart Order', 'Router')
      drawArrowH(p, orderX + 50 + 4, orderY, sorX - 50 - 4, INDIGO)

      // Exchanges with different bid/ask
      const exchanges = [
        { name: 'NYSE', bid: 174.95, ask: 175.02, vol: '2,400', x: W * 0.62, y: 60, best: false },
        { name: 'NASDAQ', bid: 174.97, ask: 174.98, vol: '3,800', x: W * 0.62, y: 120, best: true },
        { name: 'BATS', bid: 174.96, ask: 175.00, vol: '1,200', x: W * 0.62, y: 180, best: false },
        { name: 'IEX', bid: 174.94, ask: 175.01, vol: '800', x: W * 0.62, y: 240, best: false },
      ]

      for (const ex of exchanges) {
        const highlight = ex.best
        const color: [number, number, number] = highlight ? GREEN : CYAN
        drawBox(p, ex.x, ex.y, 80, 34, color, ex.name, highlight ? 'BEST ASK' : '')

        // Price info
        if (highlight) { p.fill(255) } else { p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2]) }
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(`Ask: $${ex.ask.toFixed(2)}`, ex.x + 50, ex.y - 8)
        p.text(`Bid: $${ex.bid.toFixed(2)}`, ex.x + 50, ex.y + 4)
        p.fill(...TEXT_C)
        p.textSize(7)
        p.text(`Vol: ${ex.vol}`, ex.x + 50, ex.y + 16)

        // Arrow from SOR to exchange
        if (highlight) {
          drawArrowH(p, sorX + 50 + 4, ex.y, ex.x - 40 - 4, GREEN, 'ROUTE HERE')
        } else {
          drawDashedLine(p, sorX + 54, sorY, ex.x - 44, ex.y, TEXT_C)
        }
      }

      // NBBO computation
      const nbboY = 290
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('NBBO Computation:', 20, nbboY)

      p.fill(20, 20, 35)
      p.stroke(40, 40, 60)
      p.strokeWeight(1)
      p.rect(20, nbboY + 18, W - 40, 50, 4)

      p.noStroke()
      p.fill(...GREEN)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Best Ask (lowest): $174.98 @ NASDAQ', 32, nbboY + 32)
      p.fill(...CYAN)
      p.text('Best Bid (highest): $174.97 @ NASDAQ', 32, nbboY + 50)
      p.fill(...YELLOW)
      p.textAlign(p.RIGHT, p.CENTER)
      p.text('Spread: $0.01 (tight \u2192 liquid stock)', W - 32, nbboY + 41)

      // PFOF section
      const pfofY = nbboY + 82
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Payment for Order Flow (PFOF):', 20, pfofY)

      // PFOF diagram
      const pfofBoxY = pfofY + 24
      drawBox(p, W * 0.15, pfofBoxY, 90, 30, INDIGO, 'Robinhood', '')
      drawBox(p, W * 0.40, pfofBoxY, 90, 30, PURPLE, 'Citadel / Virtu', 'Market Maker')
      drawBox(p, W * 0.65, pfofBoxY, 90, 30, ORANGE, 'Exchange', 'NASDAQ')

      drawArrowH(p, W * 0.15 + 48, pfofBoxY, W * 0.40 - 48, INDIGO, 'orders')
      drawArrowH(p, W * 0.40 - 48, pfofBoxY + 10, W * 0.15 + 48, PINK, '$$$ PFOF')
      drawArrowH(p, W * 0.40 + 48, pfofBoxY, W * 0.65 - 48, PURPLE)

      // PFOF explanation
      p.fill(...TEXT_C)
      p.textSize(8)
      p.textAlign(p.LEFT, p.TOP)
      const pfofExY = pfofBoxY + 28

      p.fill(...PINK)
      p.text('Revenue model: Robinhood routes orders to market makers, who pay ~$0.002/share for the flow', 20, pfofExY)
      p.fill(...TEXT_C)
      p.text('Market makers profit from the bid-ask spread; Robinhood gets paid per order', 20, pfofExY + 14)
      p.fill(...YELLOW)
      p.text('Controversy: Are users getting "best execution" or is Robinhood selling their orders for worse prices?', 20, pfofExY + 28)
      p.fill(...GREEN)
      p.text('SEC requirement: must demonstrate execution quality is equal to or better than NBBO', 20, pfofExY + 42)

      // Animated dot
      const dp = (t * 0.3) % 1
      if (dp < 0.3) {
        drawDot(p, orderX + 50, orderY, sorX - 50, orderY, dp / 0.3, INDIGO)
      } else if (dp < 0.7) {
        const bestEx = exchanges.find(e => e.best)
        if (bestEx) {
          drawDot(p, sorX + 50, bestEx.y, bestEx.x - 40, bestEx.y, (dp - 0.3) / 0.4, GREEN)
        }
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: Smart Order Routing</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        When a user places an order, the Smart Order Router (SOR) must find the best price
        across all exchanges. The NBBO (National Best Bid and Offer) is the best available
        price across NYSE, NASDAQ, BATS, and IEX. SEC regulations require brokers to execute
        at or better than NBBO. Robinhood{'\u2019'}s revenue comes from PFOF (Payment for Order Flow),
        where market makers pay Robinhood to route orders to them.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Deep Dive 3: Real-Time Portfolio (p5)                 */
/* ================================================================== */

function PortfolioSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 780
    const H = 460

    // Simulated portfolio
    const holdings = [
      { symbol: 'AAPL', qty: 50, avgCost: 165.00, basePrice: 174.98 },
      { symbol: 'GOOGL', qty: 10, avgCost: 140.00, basePrice: 155.20 },
      { symbol: 'TSLA', qty: 25, avgCost: 210.00, basePrice: 245.50 },
      { symbol: 'AMZN', qty: 15, avgCost: 178.00, basePrice: 185.30 },
      { symbol: 'MSFT', qty: 30, avgCost: 370.00, basePrice: 415.00 },
    ]

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
      p.text('Real-Time Portfolio \u2014 Live P&L Updates', W / 2, 8)

      // Portfolio table
      const tableX = 20
      const tableY = 40
      const colW = [70, 50, 70, 75, 85, 85, 80]
      const headers = ['Symbol', 'Qty', 'Avg Cost', 'Price', 'Mkt Value', 'P&L', 'Day %']

      // Header row
      p.fill(40, 40, 60)
      p.noStroke()
      p.rect(tableX, tableY, W - 40, 22, 4)

      let cx = tableX + 8
      p.fill(...TEXT_C)
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      for (let i = 0; i < headers.length; i++) {
        p.text(headers[i], cx, tableY + 11)
        cx += colW[i]
      }

      // Data rows with live prices
      let totalValue = 0
      let totalPnl = 0
      let totalCost = 0

      for (let i = 0; i < holdings.length; i++) {
        const h = holdings[i]
        const rowY = tableY + 26 + i * 28
        const drift = Math.sin(t * (0.5 + i * 0.2) + i * 1.5) * (h.basePrice * 0.005)
        const currentPrice = h.basePrice + drift
        const mktValue = h.qty * currentPrice
        const cost = h.qty * h.avgCost
        const pnl = mktValue - cost
        const dayChange = (drift / h.basePrice) * 100

        totalValue += mktValue
        totalPnl += pnl
        totalCost += cost

        // Row background
        const rowAlpha = i % 2 === 0 ? 15 : 5
        p.fill(255, 255, 255, rowAlpha)
        p.noStroke()
        p.rect(tableX, rowY, W - 40, 24, 2)

        cx = tableX + 8
        p.textSize(9)
        p.textAlign(p.LEFT, p.CENTER)
        const ry = rowY + 12

        // Symbol
        p.fill(255)
        p.text(h.symbol, cx, ry)
        cx += colW[0]

        // Qty
        p.fill(...TEXT_C)
        p.text(h.qty.toString(), cx, ry)
        cx += colW[1]

        // Avg cost
        p.text(`$${h.avgCost.toFixed(2)}`, cx, ry)
        cx += colW[2]

        // Current price (ticking)
        p.fill(...CYAN)
        p.text(`$${currentPrice.toFixed(2)}`, cx, ry)
        cx += colW[3]

        // Market value
        p.fill(255)
        p.text(`$${mktValue.toFixed(0)}`, cx, ry)
        cx += colW[4]

        // P&L
        const pnlColor = pnl >= 0 ? GREEN : RED
        p.fill(...pnlColor)
        p.text(`${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}`, cx, ry)
        cx += colW[5]

        // Day change %
        p.fill(dayChange >= 0 ? GREEN[0] : RED[0], dayChange >= 0 ? GREEN[1] : RED[1], dayChange >= 0 ? GREEN[2] : RED[2])
        p.text(`${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%`, cx, ry)
      }

      // Total row
      const totalY = tableY + 26 + holdings.length * 28 + 4
      p.fill(40, 40, 60)
      p.noStroke()
      p.rect(tableX, totalY, W - 40, 26, 4)

      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('TOTAL', tableX + 8, totalY + 13)
      p.fill(...CYAN)
      p.text(`$${totalValue.toFixed(0)}`, tableX + 8 + colW[0] + colW[1] + colW[2] + colW[3], totalY + 13)
      const totalPnlColor = totalPnl >= 0 ? GREEN : RED
      p.fill(...totalPnlColor)
      p.text(`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, tableX + 8 + colW[0] + colW[1] + colW[2] + colW[3] + colW[4], totalY + 13)
      const totalPct = (totalPnl / totalCost) * 100
      p.text(`${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%`, tableX + 8 + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5], totalY + 13)

      // Architecture diagram below
      const archY = totalY + 50

      p.fill(255)
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Fan-Out Problem: Price Change Affects Millions of Portfolios', 20, archY)

      const boxY = archY + 28
      drawBox(p, W * 0.10, boxY, 80, 30, ORANGE, 'AAPL Tick', '$174.98')
      drawBox(p, W * 0.30, boxY, 80, 30, RED, 'Market Data', 'Service')
      drawBox(p, W * 0.50, boxY, 90, 30, PURPLE, 'Portfolio Fan-out', 'Service')

      drawArrowH(p, W * 0.10 + 43, boxY, W * 0.30 - 43, ORANGE)
      drawArrowH(p, W * 0.30 + 43, boxY, W * 0.50 - 48, RED)

      // Fan-out to users
      const users = ['User A (50 AAPL)', 'User B (10 AAPL)', 'User C (5 AAPL)', '...5M more users']
      for (let i = 0; i < users.length; i++) {
        const uy = boxY - 20 + i * 16
        const ux = W * 0.75
        drawBox(p, ux, uy, 90, 14, i < 3 ? INDIGO : TEXT_C, users[i])
        drawArrowH(p, W * 0.50 + 48, uy, ux - 48, PURPLE)
      }

      // Solution strategies
      const solY = boxY + 42
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Scaling Strategies:', 20, solY)

      const strategies = [
        { text: 'Client-side recalc: push raw price, client computes P&L locally (reduces server fan-out)', color: GREEN },
        { text: 'Batched updates: aggregate price changes, push portfolio updates every 500ms (not every tick)', color: YELLOW },
        { text: 'Symbol-based pub/sub: each price topic has subscriber list, WebSocket GW fans out locally', color: CYAN },
        { text: 'CQRS: portfolio is a read model projected from order/fill events + price stream', color: PURPLE },
      ]

      for (let i = 0; i < strategies.length; i++) {
        const sy = solY + 18 + i * 16
        p.fill(strategies[i].color[0], strategies[i].color[1], strategies[i].color[2])
        p.ellipse(28, sy + 4, 6, 6)
        p.fill(...TEXT_C)
        p.textSize(8)
        p.text(strategies[i].text, 38, sy)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Real-Time Portfolio</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        A user with 50 positions sees each position{'\u2019'}s P&L update in real time as prices tick.
        The challenge is the fan-out: when AAPL{'\u2019'}s price changes, ~5M users who hold AAPL need
        their portfolio recalculated. This cannot be done server-side for every tick {'\u2014'} the
        solution is client-side computation with batched price pushes.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Deep Dive 4: Risk Management (p5)                     */
/* ================================================================== */

function RiskManagementSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 780
    const H = 420

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
      p.text('Pre-Trade Risk Engine \u2014 Order Validation Pipeline', W / 2, 8)

      // Order enters from left
      const startX = W * 0.07
      const startY = 60
      drawBox(p, startX, startY, 80, 34, INDIGO, 'Buy Order', '100 AAPL')

      // Risk checks as a vertical pipeline on left, result on right
      const checkX = W * 0.30
      const resultX = W * 0.55
      const checks = [
        { label: 'Buying Power Check', detail: 'balance >= qty x price ($17,498)', pass: true, color: GREEN },
        { label: 'Margin Limit Check', detail: 'margin_used + order_value <= margin_limit', pass: true, color: GREEN },
        { label: 'Pattern Day Trader', detail: 'day_trades < 4 in rolling 5 business days', pass: true, color: GREEN },
        { label: 'Position Concentration', detail: 'single stock <= 30% of portfolio', pass: true, color: GREEN },
        { label: 'Market Hours Check', detail: 'market is open (9:30 AM - 4:00 PM ET)', pass: true, color: GREEN },
        { label: 'Restricted Stock', detail: 'not on restricted/halted list', pass: true, color: GREEN },
      ]

      drawArrowH(p, startX + 40 + 4, startY, checkX - 60 - 4, INDIGO)

      const activeCheck = Math.floor((t * 0.6) % (checks.length + 1))

      for (let i = 0; i < checks.length; i++) {
        const cy = 50 + i * 50
        const isActive = activeCheck === i
        const isPassed = activeCheck > i

        // Check box
        const boxColor: [number, number, number] = isPassed ? GREEN : isActive ? YELLOW : [50, 50, 70]
        p.fill(boxColor[0], boxColor[1], boxColor[2], isPassed ? 40 : isActive ? 60 : 20)
        p.stroke(...boxColor)
        p.strokeWeight(isPassed || isActive ? 2 : 1)
        p.rect(checkX - 60, cy - 18, 120, 36, 6)

        // Label
        p.noStroke()
        if (isPassed || isActive) { p.fill(255) } else { p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2]) }
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(checks[i].label, checkX, cy - 4)

        // Pass/fail indicator
        if (isPassed) {
          p.fill(...GREEN)
          p.textSize(12)
          p.text('\u2713', checkX + 50, cy - 4)
        } else if (isActive) {
          p.fill(...YELLOW)
          p.textSize(8)
          p.text('\u27F3', checkX + 50, cy - 4)
        }

        // Detail text on the right
        if (isPassed) { p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2]) } else { p.fill(60, 60, 80) }
        p.textSize(8)
        p.textAlign(p.LEFT, p.CENTER)
        p.text(checks[i].detail, resultX, cy - 4)

        // Arrow to next check
        if (i < checks.length - 1) {
          const nextY = 50 + (i + 1) * 50
          p.stroke(isPassed ? GREEN[0] : 50, isPassed ? GREEN[1] : 50, isPassed ? GREEN[2] : 50, isPassed ? 120 : 40)
          p.strokeWeight(1)
          p.line(checkX, cy + 18, checkX, nextY - 18)
        }
      }

      // Final result
      const finalY = 50 + checks.length * 50
      if (activeCheck >= checks.length) {
        drawBox(p, checkX, finalY, 120, 34, GREEN, 'APPROVED', 'Route to Exchange')
        const flash = Math.sin(t * 4) * 0.5 + 0.5
        p.fill(GREEN[0], GREEN[1], GREEN[2], flash * 60)
        p.noStroke()
        p.rect(checkX - 62, finalY - 19, 124, 38, 8)
      }

      // Rejection scenarios on right
      const rejX = W * 0.75
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Rejection Scenarios:', rejX - 20, 40)

      const rejections = [
        { check: 'Buying Power', reason: 'Insufficient funds: need $17,498, have $5,200', color: RED },
        { check: 'Day Trader', reason: '4+ day trades in 5 days with <$25K account', color: ORANGE },
        { check: 'Market Hours', reason: 'Market closed (after 4:00 PM ET)', color: YELLOW },
        { check: 'Stock Halted', reason: 'Trading halted by exchange (volatility)', color: PINK },
        { check: 'Concentration', reason: 'Would exceed 100% of buying power', color: PURPLE },
      ]

      for (let i = 0; i < rejections.length; i++) {
        const ry = 62 + i * 46
        p.fill(rejections[i].color[0], rejections[i].color[1], rejections[i].color[2], 30)
        p.noStroke()
        p.rect(rejX - 20, ry, W - rejX, 38, 4)
        p.fill(...rejections[i].color)
        p.textSize(8)
        p.textAlign(p.LEFT, p.TOP)
        p.text(rejections[i].check, rejX - 14, ry + 4)
        p.fill(...TEXT_C)
        p.textSize(7)
        p.text(rejections[i].reason, rejX - 14, ry + 18)
      }

      // Pattern Day Trader explanation at bottom
      const pdtY = H - 60
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Pattern Day Trader (PDT) Rule:', 20, pdtY)

      p.fill(...TEXT_C)
      p.textSize(8)
      p.text('If account < $25,000 and user makes 4+ day trades in 5 business days \u2192 account restricted for 90 days', 20, pdtY + 16)
      p.text('Day trade = buy + sell same stock same day. Robinhood shows "day trades remaining" counter in the UI.', 20, pdtY + 30)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Risk Management</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Every order passes through a pre-trade risk engine before being routed to an exchange.
        The engine runs a pipeline of checks: buying power, margin limits, pattern day trading
        rules (PDT), position concentration, market hours, and stock restrictions. Any failure
        immediately rejects the order with a specific reason. This must execute in under 5ms
        to not add latency to the critical order path.
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
          <h4 className="text-orange-400 font-semibold mb-2">Market Data: The Hottest Path</h4>
          <p className="text-gray-300 text-sm">
            100K price updates/sec inbound from SIP feeds. Normalize, deduplicate, and
            write to Redis. Multicast pattern: each Market Data Service instance handles
            a shard of tickers. WebSocket gateways subscribe to the tickers their connected
            clients care about (union of all positions + watchlists).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-pink-400 font-semibold mb-2">Order Service: Partitioned by User</h4>
          <p className="text-gray-300 text-sm">
            Order processing partitioned by user_id. One user{'\u2019'}s orders are always
            handled by the same partition {'\u2014'} ensures sequential processing per user
            (no race conditions between their own orders). 8.3K orders/sec across 100
            partitions = 83 orders/partition/sec.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-purple-400 font-semibold mb-2">Position Updates: CQRS Pattern</h4>
          <p className="text-gray-300 text-sm">
            Write to the Order/Fill store as the source of truth. Async projection builds
            the Position read model (current holdings). Portfolio view reads from the
            projection, not the source. This decouples the write-heavy order path from
            the read-heavy portfolio queries.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-cyan-400 font-semibold mb-2">WebSocket Fan-out</h4>
          <p className="text-gray-300 text-sm">
            10M concurrent WebSocket connections across ~1,000 gateway servers (~10K
            connections per server). Shared subscription: all gateways interested in AAPL
            form a consumer group on the AAPL price topic. Each gateway gets one copy and
            fans out to its local connections. Reduces backbone traffic by 1000x.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-green-400 font-semibold mb-2">Market Open Surge</h4>
          <p className="text-gray-300 text-sm">
            9:30 AM is predictable peak load. Pre-warm instances starting at 9:00 AM.
            Order queue absorbs the burst {'\u2014'} rate-limit individual users (no human
            submits 100 orders/sec). Connection pooling to exchanges is pre-established.
            Auto-scale based on pending queue depth, not CPU.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">Historical Data: Tiered Storage</h4>
          <p className="text-gray-300 text-sm">
            Hot data (last 30 days): PostgreSQL with read replicas. Warm data (30 days
            to 1 year): columnar store (Parquet on S3). Cold data (1-7 years): compressed
            archive. 7-year retention per SEC regulations. Query router determines which
            tier to hit based on date range.
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
          <h4 className="text-green-400 font-semibold mb-2">Order Idempotency</h4>
          <p className="text-gray-300 text-sm">
            Every order carries an idempotency_key. If the same key is submitted twice
            (network retry, client bug), the system returns the original order without
            re-execution. The key is indexed in the order store for O(1) dedup. This
            prevents the nightmare scenario of a double-buy because the client retried
            after a timeout.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-yellow-400 font-semibold mb-2">Exchange Reconciliation</h4>
          <p className="text-gray-300 text-sm">
            End-of-day, reconcile every order and fill with exchange records. If there is
            a discrepancy (Robinhood thinks an order was cancelled but the exchange filled it),
            the reconciliation job detects it and creates corrective entries. T+2 settlement
            means there is a 2-day window where positions are tentative until the clearing
            house confirms.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-red-400 font-semibold mb-2">Circuit Breakers During Volatility</h4>
          <p className="text-gray-300 text-sm">
            When markets are extremely volatile (flash crash, meme stock surge), exchanges
            themselves halt trading. Robinhood must detect halts and prevent order submission
            for halted stocks. Additionally, internal circuit breakers throttle order rates
            if the exchange gateway is overloaded, queuing orders rather than dropping them.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-purple-400 font-semibold mb-2">Market Hours Failover</h4>
          <p className="text-gray-300 text-sm">
            During market hours (6.5 hours/day), any downtime costs users real money.
            Active-active across two data centers with real-time replication of order
            state. If one DC fails, the other takes over within seconds. Connections
            to exchanges are maintained from both DCs. Out-of-hours: reduced redundancy
            to save costs (only pre-market/after-hours orders).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <h4 className="text-cyan-400 font-semibold mb-2">Instant Deposit Risk Management</h4>
          <p className="text-gray-300 text-sm">
            Instant deposits let users trade before their bank transfer clears (3-5 days).
            If the bank transfer fails (insufficient funds), Robinhood is on the hook.
            Mitigation: cap instant deposits at $1K for new users, $5K for established.
            If a user{'\u2019'}s deposit fails and they{'\u2019'}ve already lost money trading,
            Robinhood absorbs the loss and restricts the account.
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
            left: 'Real-Time Portfolio Recalc (Server)',
            right: 'Client-Side Computation',
            leftPros: 'Always accurate, no client-side logic needed',
            rightPros: 'Eliminates massive server-side fan-out (5M users per AAPL tick)',
            tension:
              'Push raw prices to client, let the app compute P&L locally. Server sends periodic snapshots to correct drift. Best of both worlds: responsive UI + manageable server load.',
          },
          {
            left: 'PFOF (Payment for Order Flow)',
            right: 'Direct Exchange Access',
            leftPros: 'Revenue source: $0.002/share, enables commission-free model',
            rightPros: 'Guaranteed best execution, no conflict of interest',
            tension:
              'Robinhood chose PFOF for revenue. SEC requires proving execution quality. Some argue market makers can still provide NBBO or better. The debate is ongoing and may be regulated away.',
          },
          {
            left: 'Fractional Shares',
            right: 'Whole Shares Only',
            leftPros: 'Democratizes investing ($5 buys some AAPL), better UX',
            rightPros: 'Much simpler: standard exchange orders, no internal matching',
            tension:
              'Fractional shares require Robinhood to hold inventory (buy 1 share, distribute fractions to users). Adds complexity: internal order book, reconciliation, tax lot tracking per fractional unit.',
          },
          {
            left: 'Pre-Market / After-Hours Trading',
            right: 'Regular Hours Only',
            leftPros: 'React to earnings, news before/after market opens',
            rightPros: 'Higher liquidity, tighter spreads, simpler infrastructure',
            tension:
              'Extended hours have thin liquidity and wide spreads. Users may get worse prices. Robinhood supports it with prominent warnings. Infrastructure must stay up from 7AM-8PM ET instead of 9:30-4:00.',
          },
          {
            left: 'Synchronous Risk Checks',
            right: 'Async Risk with Rollback',
            leftPros: 'Order never reaches exchange if invalid, clean UX',
            rightPros: 'Lower latency: send to exchange, check in parallel, cancel if fails',
            tension:
              'Synchronous is safer and simpler. At ~5ms per risk check pipeline, the latency is acceptable. Async-with-rollback risks a fill on a rejected order, creating complex cleanup.',
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

export default function DesignRobinhood() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold text-white">
          Design Robinhood (Stock Trading)
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          How do you build a commission-free stock trading platform that handles 8.3K
          orders/sec at market open, streams 100K price updates/sec, complies with SEC
          regulations, and serves 10M daily active users?
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <OrderLifecycleSection />
      <SmartOrderRoutingSection />
      <PortfolioSection />
      <RiskManagementSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />

      <footer className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
        System Design Case Study {'\u2014'} oneML Learning Platform
      </footer>
    </div>
  )
}
