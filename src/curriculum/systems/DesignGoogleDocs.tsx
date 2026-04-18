import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-google-docs',
  title: 'Design Google Docs',
  description:
    'System design case study: real-time collaborative document editing with operational transformation, WebSocket fan-out, cursor presence, revision history, offline sync, and conflict resolution at scale',
  track: 'systems',
  order: 23,
  tags: [
    'system-design',
    'google-docs',
    'collaboration',
    'real-time',
    'operational-transformation',
    'websocket',
    'conflict-resolution',
    'crdt',
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
  p.stroke(color[0], color[1], color[2])
  p.strokeWeight(2)
  p.rect(x - w / 2, y - h / 2, w, h, 8)
  p.noStroke()
  p.fill(255)
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(10)
  p.text(label, x, subLabel ? y - 7 : y)
  if (subLabel) {
    p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
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
  p.stroke(color[0], color[1], color[2], 180)
  p.strokeWeight(2)
  p.line(x1, y, x2, y)
  p.fill(color[0], color[1], color[2], 180)
  p.noStroke()
  const aLen = 7
  p.triangle(x2, y, x2 - dir * aLen, y - 4, x2 - dir * aLen, y + 4)
  if (label) {
    p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
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
  p.stroke(color[0], color[1], color[2], 180)
  p.strokeWeight(2)
  p.line(x, y1, x, y2)
  p.fill(color[0], color[1], color[2], 180)
  p.noStroke()
  const aLen = 7
  p.triangle(x, y2, x - 4, y2 - dir * aLen, x + 4, y2 - dir * aLen)
  if (label) {
    p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
    p.textSize(7)
    p.textAlign(p.LEFT, p.CENTER)
    p.text(label, x + 5, (y1 + y2) / 2)
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
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, 6, 6)
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
  p.stroke(color[0], color[1], color[2], 100)
  p.strokeWeight(1)
  p.line(x1, y1, x2, y2)
  ctx.setLineDash([])
}

function drawPulse(
  p: p5,
  x: number,
  y: number,
  t: number,
  color: [number, number, number],
) {
  const pulse = (Math.sin(t * 3) + 1) / 2
  const r = 4 + pulse * 4
  p.fill(color[0], color[1], color[2], 100 + pulse * 100)
  p.noStroke()
  p.ellipse(x, y, r, r)
}

/* ================================================================== */
/*  Section 1 -- Problem Statement & Requirements                      */
/* ================================================================== */

function ProblemSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a real-time collaborative document editor like Google Docs. Multiple users
        simultaneously edit the same document, see each other&apos;s cursors and changes in
        real time, with full revision history, commenting, and offline support. This is one
        of the most complex distributed systems problems because every keystroke from every
        user must be consistently ordered and merged without conflicts {'\u2014'} all while
        feeling instantaneous. The core challenge is <strong className="text-indigo-400">
        Operational Transformation (OT)</strong>: how do you reconcile concurrent edits from
        multiple users so everyone converges to the same document state?
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Create, open, and delete documents</li>
        <li>Real-time collaborative editing {'\u2014'} multiple cursors, live text changes visible to all users</li>
        <li>Rich text formatting: bold, italic, headings, lists, tables, embedded images</li>
        <li>Comments and suggestions {'\u2014'} threaded discussions, resolve/reopen</li>
        <li>Revision history {'\u2014'} view any past version, restore, see who changed what</li>
        <li>Sharing and permissions: view, comment, edit, and owner roles</li>
        <li>Offline editing with automatic sync on reconnect</li>
        <li>Search across all documents owned by or shared with a user</li>
        <li>Export to PDF, DOCX, and HTML formats</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Real-time latency {'\u003C'}100ms for edit propagation between users</li>
        <li>Support 100+ concurrent editors per document</li>
        <li>99.99% availability (52 min downtime/year)</li>
        <li>Strong consistency for document state {'\u2014'} all users must converge to the same text</li>
        <li>Handle documents up to 1M characters (~500 pages)</li>
        <li>1B+ documents stored, 100M+ daily active users</li>
        <li>Graceful degradation: if collaboration service is down, users can still read documents</li>
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
        <h4 className="text-white font-semibold">Edit Operations</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>100M DAU {'\u00d7'} avg 5 edits/min active session {'\u00d7'} 30 min/day = 15B ops/day</li>
          <li>Peak: 500M ops/min = 8.3M ops/sec</li>
          <li>Each op: ~200 bytes (type, position, content, revision, user_id, timestamp)</li>
          <li>Raw op throughput: 8.3M {'\u00d7'} 200 = 1.66 GB/sec at peak</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Document Storage</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Average document: 10KB text + 50KB formatting metadata = 60KB</li>
          <li>1B documents {'\u00d7'} 60KB = 60TB raw document storage</li>
          <li>Revision history: avg 10 snapshots per active doc {'\u2192'} 600TB snapshot storage</li>
          <li>Operation log: 100K ops per active doc {'\u00d7'} 200 bytes = 20MB/doc {'\u2192'} petabytes total</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">WebSocket Connections</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>10M concurrent editing sessions at peak</li>
          <li>Each WebSocket: ~20KB memory on server {'\u2192'} 10M {'\u00d7'} 20KB = 200GB connection state</li>
          <li>At 100K connections per gateway server {'\u2192'} need 100 gateway servers</li>
          <li>Cursor/presence updates: 10M users {'\u00d7'} heartbeat every 5s = 2M msgs/sec</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Collaboration Service</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>OT transform: CPU-bound, ~10{'\u00b5'}s per transform</li>
          <li>8.3M ops/sec {'\u00d7'} avg 2 transforms each = 16.6M transforms/sec</li>
          <li>Single core handles ~100K transforms/sec {'\u2192'} need 166 cores minimum</li>
          <li>Partition by document_id: each doc handled by one server for ordering</li>
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

      <h3 className="text-lg font-semibold text-indigo-400 mt-2">REST APIs</h3>
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/documents</code>
          <p className="text-gray-400 text-sm mt-1">
            Create a new document. Body: {'{'} title, content?: string {'}'}.
            Returns document object with id, owner_id, revision=0.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/documents/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Fetch document content and metadata. Returns current snapshot, revision number,
            list of active collaborators, and permission level for the requesting user.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">DELETE /api/v1/documents/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Soft-delete a document. Only the owner can delete. Moves to trash for 30-day recovery.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/documents/:id/revisions</code>
          <p className="text-gray-400 text-sm mt-1">
            List revision history. Returns array of {'{'} revision_number, timestamp, user_id,
            summary {'}'}. Paginated with cursor. Used to power the &ldquo;Version History&rdquo; UI.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/documents/:id/revisions/:rev</code>
          <p className="text-gray-400 text-sm mt-1">
            Get the full document content at a specific revision. Server reconstructs
            from nearest snapshot + replaying ops.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/documents/:id/share</code>
          <p className="text-gray-400 text-sm mt-1">
            Share a document. Body: {'{'} user_email, role: &ldquo;viewer&rdquo; | &ldquo;commenter&rdquo; | &ldquo;editor&rdquo; {'}'}.
            Sends notification email. Owner can also set link sharing (anyone with link).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/documents/:id/comments</code>
          <p className="text-gray-400 text-sm mt-1">
            Add a comment. Body: {'{'} anchor_start, anchor_end, text, thread_id? {'}'}.
            Comments anchor to character ranges. thread_id links replies.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/documents/:id/export</code>
          <p className="text-gray-400 text-sm mt-1">
            Export document. Body: {'{'} format: &ldquo;pdf&rdquo; | &ldquo;docx&rdquo; | &ldquo;html&rdquo; {'}'}.
            Returns download URL. Async for large documents.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-pink-400 mt-6">WebSocket Protocol (Real-Time Editing)</h3>
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-cyan-400 text-sm">Client {'\u2192'} Server</code>
          <pre className="text-gray-300 text-xs mt-2 leading-relaxed">{`{
  type: "op",
  document_id: "doc-123",
  revision: 42,           // client's last known server revision
  ops: [
    { type: "insert", pos: 15, content: "Hello" },
    { type: "delete", pos: 20, count: 3 },
    { type: "format", pos: 10, len: 5, attrs: { bold: true } }
  ]
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-cyan-400 text-sm">Server {'\u2192'} Client (ack)</code>
          <pre className="text-gray-300 text-xs mt-2 leading-relaxed">{`{
  type: "ack",
  revision: 43             // new server revision after applying op
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-cyan-400 text-sm">Server {'\u2192'} Client (broadcast to other clients)</code>
          <pre className="text-gray-300 text-xs mt-2 leading-relaxed">{`{
  type: "remote_op",
  user_id: "user-456",
  revision: 43,
  ops: [...]               // transformed ops to apply locally
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-cyan-400 text-sm">Presence / Cursors (bidirectional)</code>
          <pre className="text-gray-300 text-xs mt-2 leading-relaxed">{`{
  type: "presence",
  user_id: "user-456",
  name: "Alice",
  color: "#6366f1",
  cursor: { position: 142, selection_end: 158 },
  status: "editing"        // or "viewing", "idle"
}`}</pre>
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
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Document</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  title: string,
  owner_id: uuid,
  content: text,           // current snapshot
  revision: int,           // monotonic counter
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp | null,
  word_count: int,
  last_snapshot_rev: int   // revision of latest snapshot
}
-- Partition key: id
-- content is the latest materialized state
-- Rebuild from ops if needed`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Operation</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  document_id: uuid,
  user_id: uuid,
  revision: int,           // server-assigned
  ops: [                   // array of atomic ops
    { type: "insert", pos: int,
      content: string },
    { type: "delete", pos: int,
      count: int },
    { type: "format", pos: int,
      len: int, attrs: object }
  ],
  timestamp: timestamp
}
-- Partition: document_id
-- Sort: revision (ascending)
-- Append-only log, never mutated`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Revision (Snapshot)</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  document_id: uuid,
  revision_number: int,
  snapshot: text,          // full document at this point
  user_id: uuid,           // who triggered the snapshot
  timestamp: timestamp,
  op_count_since_prev: int
}
-- Taken every 100 ops or every 5 min
-- Enables fast version history lookups
-- Old snapshots archived to cold storage`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Permission</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  document_id: uuid,
  user_id: uuid,
  role: "owner" | "editor" |
        "commenter" | "viewer",
  granted_by: uuid,
  granted_at: timestamp,
  link_sharing: "off" | "viewer" |
                "commenter" | "editor"
}
-- Composite PK: (document_id, user_id)
-- link_sharing: anyone with the URL
-- Check on every WebSocket connect
   and REST request`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Comment</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: uuid,
  document_id: uuid,
  user_id: uuid,
  thread_id: uuid,         // groups replies
  anchor_start: int,       // char offset
  anchor_end: int,
  text: string,
  resolved: boolean,
  resolved_by: uuid | null,
  created_at: timestamp
}
-- Anchors shift when text is edited
-- Anchor transform: same as cursor transform
-- Resolved threads collapse in UI`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Cursor / Presence</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  document_id: uuid,
  user_id: uuid,
  name: string,
  color: string,           // assigned per-doc
  position: int,           // char offset
  selection_start: int | null,
  selection_end: int | null,
  status: "editing" | "viewing" | "idle",
  last_seen: timestamp
}
-- Stored in-memory only (Redis)
-- TTL: 30s (expire = user left)
-- Updated via WebSocket heartbeat`}</pre>
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
    const H = 650

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
      p.text('Google Docs \u2014 High-Level Architecture', W / 2, 10)

      const bw = 110
      const bh = 40
      const g = 8
      const hh = bh / 2

      /* ---- LANE 1: EDIT FLOW (left) ---- */
      const laneX = W * 0.18
      const ey1 = 80, ey2 = 155, ey3 = 230, ey4 = 310, ey5 = 390, ey6 = 470

      p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('EDIT FLOW', laneX, 40)

      drawBox(p, laneX, ey1, bw, bh, INDIGO, 'Client', 'browser')
      drawBox(p, laneX, ey2, bw, bh, GREEN, 'WebSocket GW', 'load balanced')
      drawBox(p, laneX, ey3, bw + 20, bh + 4, PINK, 'Collab Service', 'OT engine')
      drawBox(p, laneX, ey4, bw, bh, ORANGE, 'Operation Log', 'append-only')
      drawBox(p, laneX, ey5, bw, bh, CYAN, 'Snapshot Svc', 'periodic')
      drawBox(p, laneX, ey6, bw, bh, PURPLE, 'Document Store', 'sharded')

      drawArrowV(p, laneX, ey1 + hh + g, ey2 - hh - g, INDIGO, 'WebSocket')
      drawArrowV(p, laneX, ey2 + hh + g, ey3 - (hh + 2) - g, GREEN)
      drawArrowV(p, laneX, ey3 + (hh + 2) + g, ey4 - hh - g, PINK, 'persist op')
      drawArrowV(p, laneX, ey4 + hh + g, ey5 - hh - g, ORANGE, 'every 100 ops')
      drawArrowV(p, laneX, ey5 + hh + g, ey6 - hh - g, CYAN, 'save snapshot')

      /* ---- LANE 2: REAL-TIME SYNC (center) ---- */
      const syncX = W * 0.50
      const sy1 = 80, sy2 = 155, sy3 = 265, sy4 = 370, sy5 = 465, sy6 = 540

      p.fill(PINK[0], PINK[1], PINK[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('REAL-TIME SYNC', syncX, 40)

      drawBox(p, syncX - 70, sy1, bw - 10, bh, INDIGO, 'Client A', 'types "Hi"')
      drawBox(p, syncX + 70, sy1, bw - 10, bh, CYAN, 'Client B', 'types "Go"')
      drawBox(p, syncX, sy2, bw, bh, GREEN, 'WebSocket GW', '')
      drawBox(p, syncX, sy3, bw + 20, bh + 4, PINK, 'Collab Service', 'OT transform')
      drawBox(p, syncX, sy4, bw + 20, bh, YELLOW, 'Redis Pub/Sub', 'doc:123 channel')
      drawBox(p, syncX - 70, sy5, bw - 10, bh, INDIGO, 'Client A', 'sees "Go"')
      drawBox(p, syncX + 70, sy5, bw - 10, bh, CYAN, 'Client B', 'sees "Hi"')

      // Arrows: both clients down to gateway
      drawArrowV(p, syncX - 70, sy1 + hh + g, sy2 - hh - g, INDIGO, 'send op')
      drawArrowV(p, syncX + 70, sy1 + hh + g, sy2 - hh - g, CYAN, 'send op')
      drawArrowV(p, syncX, sy2 + hh + g, sy3 - (hh + 2) - g, GREEN, 'forward')
      drawArrowV(p, syncX, sy3 + (hh + 2) + g, sy4 - hh - g, PINK, 'broadcast')
      drawArrowV(p, syncX - 70, sy4 + hh + g, sy5 - hh - g, YELLOW)
      drawArrowV(p, syncX + 70, sy4 + hh + g, sy5 - hh - g, YELLOW)

      // Transform label
      p.fill(PINK[0], PINK[1], PINK[2], 200)
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('transforms concurrent ops', syncX, sy3 + 30)
      p.text('so both clients converge', syncX, sy3 + 40)

      // Convergence label
      p.fill(GREEN[0], GREEN[1], GREEN[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Both see "HiGo" \u2014 converged!', syncX, sy6)

      /* ---- LANE 3: SUPPORTING SERVICES (right) ---- */
      const svcX = W * 0.84
      const sv1 = 80, sv2 = 145, sv3 = 210, sv4 = 275, sv5 = 340, sv6 = 405, sv7 = 470

      p.fill(ORANGE[0], ORANGE[1], ORANGE[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('SUPPORTING SERVICES', svcX, 40)

      drawBox(p, svcX, sv1, bw, bh - 4, YELLOW, 'Auth Service', '')
      drawBox(p, svcX, sv2, bw, bh - 4, GREEN, 'Permission Svc', '')
      drawBox(p, svcX, sv3, bw, bh - 4, PURPLE, 'Comment Svc', '')
      drawBox(p, svcX, sv4, bw, bh - 4, CYAN, 'Search (ES)', 'Elasticsearch')
      drawBox(p, svcX, sv5, bw, bh - 4, PINK, 'Revision Svc', 'snapshots')
      drawBox(p, svcX, sv6, bw, bh - 4, ORANGE, 'Media Svc', 'images / S3')
      drawBox(p, svcX, sv7, bw, bh - 4, RED, 'Export Svc', 'PDF / DOCX')

      // Dashed lines from collab service to supporting services
      drawDashedLine(p, laneX + (bw + 20) / 2 + 4, ey3, svcX - bw / 2 - 4, sv2, TEXT_C)
      drawDashedLine(p, laneX + (bw + 20) / 2 + 4, ey3 + 10, svcX - bw / 2 - 4, sv3, TEXT_C)

      // CDC arrow from document store to search
      drawDashedLine(p, laneX + bw / 2 + 4, ey6, svcX - bw / 2 - 4, sv4, TEXT_C)
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(7)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('CDC async index', (laneX + svcX) / 2, (ey6 + sv4) / 2 - 2)

      /* ---- ANIMATED DOTS ---- */
      // Blue: edit flow (down lane 1)
      const editSteps = [ey1, ey2, ey3, ey4, ey5, ey6]
      const bp = (t * 0.18) % 1
      const bStepSize = 1 / (editSteps.length - 1)
      const bIdx = Math.min(Math.floor(bp / bStepSize), editSteps.length - 2)
      const bLocal = (bp - bIdx * bStepSize) / bStepSize
      drawDot(p, laneX, editSteps[bIdx] + hh, laneX, editSteps[bIdx + 1] - hh, bLocal, INDIGO)

      // Pink: sync flow (down center lane)
      const syncSteps = [sy1, sy2, sy3, sy4, sy5]
      const sp = ((t * 0.22) + 0.3) % 1
      const sStepSize = 1 / (syncSteps.length - 1)
      const sIdx = Math.min(Math.floor(sp / sStepSize), syncSteps.length - 2)
      const sLocal = (sp - sIdx * sStepSize) / sStepSize
      drawDot(p, syncX, syncSteps[sIdx] + hh, syncX, syncSteps[sIdx + 1] - hh, sLocal, PINK)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The architecture has three core concerns: the <strong className="text-indigo-400">edit
        flow</strong> (blue dot) from client through the collaboration engine to persistent storage,
        the <strong className="text-pink-400">real-time sync flow</strong> (pink dot) where
        concurrent edits from multiple clients are transformed and broadcast, and the{' '}
        <strong className="text-orange-400">supporting services</strong> handling auth, comments,
        search, media, and exports. The Collaboration Service is the beating heart {'\u2014'} it
        serializes all edits per document via Operational Transformation.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Deep Dive 1: The Collaboration Engine (OT)            */
/* ================================================================== */

function OTSection() {
  const [step, setStep] = useState(0)
  const stepRef = useRef(step)
  stepRef.current = step
  const maxSteps = 7

  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 620

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      const curStep = stepRef.current
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Operational Transformation \u2014 Step-by-Step', W / 2, 8)

      // Three lifelines: Client A, Server, Client B
      const colA = W * 0.18
      const colS = W * 0.50
      const colB = W * 0.82

      const topY = 55
      drawBox(p, colA, topY, 100, 30, INDIGO, 'Client A (Alice)')
      drawBox(p, colS, topY, 120, 30, PINK, 'Collab Server')
      drawBox(p, colB, topY, 100, 30, CYAN, 'Client B (Bob)')

      // Lifelines
      const entities = [
        { x: colA, color: INDIGO },
        { x: colS, color: PINK },
        { x: colB, color: CYAN },
      ]
      for (const ent of entities) {
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.stroke(ent.color[0], ent.color[1], ent.color[2], 60)
        p.strokeWeight(1)
        p.line(ent.x, topY + 15, ent.x, H - 20)
        ctx.setLineDash([])
      }

      // Document state boxes
      const drawDocState = (x: number, y: number, text: string, color: [number, number, number]) => {
        p.fill(color[0], color[1], color[2], 30)
        p.stroke(color[0], color[1], color[2], 100)
        p.strokeWeight(1)
        const tw = Math.max(p.textWidth(text) + 20, 100)
        p.rect(x - tw / 2, y - 12, tw, 24, 4)
        p.noStroke()
        p.fill(255)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(text, x, y)
      }

      // Step 0: Initial state
      const baseY = 100
      drawDocState(colA, baseY, 'doc: "ABCD" (rev 5)', INDIGO)
      drawDocState(colS, baseY, 'doc: "ABCD" (rev 5)', PINK)
      drawDocState(colB, baseY, 'doc: "ABCD" (rev 5)', CYAN)

      if (curStep >= 1) {
        // Step 1: Alice types "X" at position 1
        const y1 = 150
        p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Alice types "X" at pos 1', colA, y1 - 15)
        drawDocState(colA, y1 + 5, 'local: "AXBCD"', INDIGO)

        // Arrow from A to Server
        const sendY = 180
        drawArrowH(p, colA, sendY, colS, INDIGO, 'op(insert "X", pos=1, rev=5)')
      }

      if (curStep >= 2) {
        // Step 2: Meanwhile, Bob deletes char at position 3 ("D")
        const y2 = 150
        p.fill(CYAN[0], CYAN[1], CYAN[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Bob deletes pos 3 ("D")', colB, y2 - 15)
        drawDocState(colB, y2 + 5, 'local: "ABC"', CYAN)

        const sendY2 = 210
        drawArrowH(p, colB, sendY2, colS, CYAN, 'op(delete pos=3, rev=5)')

        // Flashing "CONCURRENT!" label
        const flash = Math.sin(t * 4) > 0 ? 255 : 140
        p.fill(RED[0], RED[1], RED[2], flash)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u26A0 CONCURRENT EDITS!', colS, 195)
      }

      if (curStep >= 3) {
        // Step 3: Server receives Alice's op first (arrives first)
        const y3 = 250
        p.fill(PINK[0], PINK[1], PINK[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text("Server receives Alice's op first", colS, y3 - 10)
        p.text('rev 5 matches server rev \u2192 apply directly', colS, y3 + 2)
        drawDocState(colS, y3 + 25, 'server: "AXBCD" (rev 6)', PINK)
      }

      if (curStep >= 4) {
        // Step 4: Server receives Bob's op (rev 5, but server is at rev 6!)
        const y4 = 310
        p.fill(RED[0], RED[1], RED[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text("Bob's op: delete pos=3, rev=5", colS, y4 - 10)
        p.text('Server is at rev 6! Must TRANSFORM', colS, y4 + 2)

        // Transform explanation
        p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
        p.textSize(8)
        p.text('Alice inserted at pos 1 (before pos 3)', colS, y4 + 20)
        p.text('So Bob\'s pos 3 shifts to pos 4', colS, y4 + 32)
        p.text('transform(delete pos=3, insert pos=1) \u2192 delete pos=4', colS, y4 + 44)

        // Highlight the transform
        p.noFill()
        p.stroke(YELLOW[0], YELLOW[1], YELLOW[2], 100)
        p.strokeWeight(1)
        p.rect(colS - 170, y4 + 12, 340, 40, 4)
      }

      if (curStep >= 5) {
        // Step 5: Server applies transformed op
        const y5 = 395
        p.fill(GREEN[0], GREEN[1], GREEN[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Server applies transformed op: delete pos=4', colS, y5 - 10)
        drawDocState(colS, y5 + 10, 'server: "AXBC" (rev 7)', GREEN)
      }

      if (curStep >= 6) {
        // Step 6: Server broadcasts to both clients
        const y6 = 440
        // Broadcast Alice's op to Bob (already transformed)
        drawArrowH(p, colS, y6, colB, PINK, "send Alice's op to Bob")
        // Broadcast Bob's transformed op to Alice
        drawArrowH(p, colS, y6 + 25, colA, PINK, "send Bob's transformed op to Alice")

        // Final states
        const y7 = 510
        drawDocState(colA, y7, 'Alice: "AXBC" (rev 7)', INDIGO)
        drawDocState(colS, y7, 'Server: "AXBC" (rev 7)', GREEN)
        drawDocState(colB, y7, 'Bob: "AXBC" (rev 7)', CYAN)
      }

      if (curStep >= 7) {
        // Convergence celebration
        const y8 = 555
        p.fill(GREEN[0], GREEN[1], GREEN[2])
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2713 ALL THREE CONVERGED TO "AXBC" \u2014 OT SUCCESS', W / 2, y8)

        // Pulsing success indicators
        drawPulse(p, colA, y8 + 25, t, GREEN)
        drawPulse(p, colS, y8 + 25, t, GREEN)
        drawPulse(p, colB, y8 + 25, t, GREEN)
      }

      // Step indicator
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(9)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text(`Step ${curStep} / ${maxSteps}`, W - 15, H - 5)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: The Collaboration Engine (OT)</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Operational Transformation is the algorithm that makes real-time collaboration possible.
        When two users edit simultaneously, their operations may conflict {'\u2014'} OT{' '}
        <strong className="text-pink-400">transforms</strong> one operation against the other so
        both can be applied and the document converges to the same state. The server is the single
        source of truth for operation ordering: it assigns a monotonic revision number to each
        operation. If a client sends an op based on a stale revision, the server transforms it
        against all ops that happened since that revision.
      </p>
      <p className="text-gray-300 text-sm leading-relaxed">
        Click <strong>Next</strong> to walk through a concrete example: Alice inserts a character
        while Bob simultaneously deletes one. Watch how OT resolves the conflict.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStep(0)}
          className="px-4 py-2 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Reset
        </button>
        <button
          onClick={() => setStep(s => Math.min(s + 1, maxSteps))}
          className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500"
        >
          Next Step
        </button>
        <button
          onClick={() => setStep(maxSteps)}
          className="px-4 py-2 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Show All
        </button>
      </div>
      <P5Sketch sketch={sketch} />

      <div className="bg-gray-800 rounded-lg p-5 space-y-3">
        <h4 className="text-white font-semibold text-sm">OT Transform Rules (for text operations)</h4>
        <ul className="text-gray-300 text-xs space-y-2 ml-4 list-disc list-inside">
          <li>
            <strong className="text-yellow-400">insert vs insert:</strong> If both insert at the
            same position, break the tie by user_id ordering. The &ldquo;losing&rdquo; insert shifts right.
          </li>
          <li>
            <strong className="text-yellow-400">insert vs delete:</strong> If insert position is
            before delete position, shift delete position right by insert length. If after, no change.
          </li>
          <li>
            <strong className="text-yellow-400">delete vs delete:</strong> If both delete the same
            character, one becomes a no-op. If positions differ, adjust based on which comes first.
          </li>
          <li>
            <strong className="text-yellow-400">format vs insert/delete:</strong> Format ranges must
            expand or shift when text is inserted/deleted within or before them.
          </li>
        </ul>
        <p className="text-gray-400 text-xs italic mt-2">
          Google Docs uses a proprietary OT implementation derived from the Jupiter collaboration
          system. The key invariant: transform(op1, op2) and transform(op2, op1) must produce
          operations that, when applied in opposite order, yield the same document state.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Deep Dive 2: WebSocket Management at Scale            */
/* ================================================================== */

function WebSocketSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 600

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('WebSocket Fan-Out via Redis Pub/Sub', W / 2, 8)

      const bw = 100
      const bh = 36

      // --- TOP ROW: Clients editing doc:123 ---
      const clientY = 65
      const clients = [
        { x: W * 0.08, label: 'Alice', color: INDIGO },
        { x: W * 0.20, label: 'Bob', color: CYAN },
        { x: W * 0.32, label: 'Carol', color: PURPLE },
        { x: W * 0.52, label: 'Dave', color: ORANGE },
        { x: W * 0.64, label: 'Eve', color: GREEN },
        { x: W * 0.80, label: 'Frank', color: YELLOW },
        { x: W * 0.92, label: 'Grace', color: PINK },
      ]

      for (const c of clients) {
        drawBox(p, c.x, clientY, 68, 30, c.color, c.label, '')
      }

      // --- SECOND ROW: Gateway servers ---
      const gwY = 160
      const gw1X = W * 0.20
      const gw2X = W * 0.50
      const gw3X = W * 0.80

      drawBox(p, gw1X, gwY, bw + 10, bh, GREEN, 'Gateway 1', '100K conns')
      drawBox(p, gw2X, gwY, bw + 10, bh, GREEN, 'Gateway 2', '100K conns')
      drawBox(p, gw3X, gwY, bw + 10, bh, GREEN, 'Gateway 3', '100K conns')

      // Connect clients to gateways (vertical only)
      // Alice, Bob, Carol -> GW1
      drawArrowV(p, clients[0].x, clientY + 15 + 4, gwY - bh / 2 - 4, INDIGO)
      drawArrowV(p, clients[1].x, clientY + 15 + 4, gwY - bh / 2 - 4, CYAN)
      drawArrowV(p, clients[2].x, clientY + 15 + 4, gwY - bh / 2 - 4, PURPLE)
      // Dave, Eve -> GW2
      drawArrowV(p, clients[3].x, clientY + 15 + 4, gwY - bh / 2 - 4, ORANGE)
      drawArrowV(p, clients[4].x, clientY + 15 + 4, gwY - bh / 2 - 4, GREEN)
      // Frank, Grace -> GW3
      drawArrowV(p, clients[5].x, clientY + 15 + 4, gwY - bh / 2 - 4, YELLOW)
      drawArrowV(p, clients[6].x, clientY + 15 + 4, gwY - bh / 2 - 4, PINK)

      // --- THIRD ROW: Collab service ---
      const collabY = 255
      drawBox(p, W * 0.50, collabY, bw + 30, bh + 6, PINK, 'Collab Service', 'OT + ordering')

      drawArrowV(p, gw1X, gwY + bh / 2 + 4, collabY - (bh + 6) / 2 - 4, GREEN)
      drawArrowV(p, gw2X, gwY + bh / 2 + 4, collabY - (bh + 6) / 2 - 4, GREEN)
      drawArrowV(p, gw3X, gwY + bh / 2 + 4, collabY - (bh + 6) / 2 - 4, GREEN)

      // --- FOURTH ROW: Redis Pub/Sub ---
      const redisY = 345
      drawBox(p, W * 0.50, redisY, bw + 40, bh + 6, RED, 'Redis Pub/Sub', 'channel: doc:123')

      drawArrowV(p, W * 0.50, collabY + (bh + 6) / 2 + 4, redisY - (bh + 6) / 2 - 4, PINK, 'publish transformed op')

      // --- FIFTH ROW: Fan-out back to gateways ---
      const fanY = 435
      drawBox(p, gw1X, fanY, bw + 10, bh, GREEN, 'Gateway 1', 'subscribed')
      drawBox(p, gw2X, fanY, bw + 10, bh, GREEN, 'Gateway 2', 'subscribed')
      drawBox(p, gw3X, fanY, bw + 10, bh, GREEN, 'Gateway 3', 'subscribed')

      drawArrowV(p, gw1X, redisY + (bh + 6) / 2 + 4, fanY - bh / 2 - 4, RED)
      drawArrowV(p, gw2X, redisY + (bh + 6) / 2 + 4, fanY - bh / 2 - 4, RED)
      drawArrowV(p, gw3X, redisY + (bh + 6) / 2 + 4, fanY - bh / 2 - 4, RED)

      // --- SIXTH ROW: Clients receive ---
      const rcvY = 520
      for (const c of clients) {
        drawBox(p, c.x, rcvY, 68, 30, c.color, c.label, 'updated')
      }

      drawArrowV(p, clients[0].x, fanY + bh / 2 + 4, rcvY - 15 - 4, INDIGO)
      drawArrowV(p, clients[1].x, fanY + bh / 2 + 4, rcvY - 15 - 4, CYAN)
      drawArrowV(p, clients[2].x, fanY + bh / 2 + 4, rcvY - 15 - 4, PURPLE)
      drawArrowV(p, clients[3].x, fanY + bh / 2 + 4, rcvY - 15 - 4, ORANGE)
      drawArrowV(p, clients[4].x, fanY + bh / 2 + 4, rcvY - 15 - 4, GREEN)
      drawArrowV(p, clients[5].x, fanY + bh / 2 + 4, rcvY - 15 - 4, YELLOW)
      drawArrowV(p, clients[6].x, fanY + bh / 2 + 4, rcvY - 15 - 4, PINK)

      // Animated dots: op from Alice flowing through the whole pipeline
      const phase = (t * 0.15) % 1
      const waypoints = [
        { x: clients[0].x, y: clientY + 15 },
        { x: clients[0].x, y: gwY },
        { x: gw1X, y: collabY - 10 },
        { x: W * 0.50, y: collabY + 10 },
        { x: W * 0.50, y: redisY },
      ]
      const segSize = 1 / (waypoints.length - 1)
      const segIdx = Math.min(Math.floor(phase / segSize), waypoints.length - 2)
      const segProg = (phase - segIdx * segSize) / segSize
      drawDot(
        p,
        waypoints[segIdx].x, waypoints[segIdx].y,
        waypoints[segIdx + 1].x, waypoints[segIdx + 1].y,
        segProg,
        INDIGO,
      )

      // Fan-out dots from Redis to all gateways
      const fanPhase = ((t * 0.15) + 0.6) % 1
      if (fanPhase < 0.5) {
        const fp = fanPhase * 2
        drawDot(p, W * 0.50, redisY + 20, gw1X, fanY - 18, fp, RED)
        drawDot(p, W * 0.50, redisY + 20, gw2X, fanY - 18, fp, RED)
        drawDot(p, W * 0.50, redisY + 20, gw3X, fanY - 18, fp, RED)
      }

      // Labels
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Sticky sessions by document_id: clients editing same doc route to same gateway when possible', W / 2, 560)
      p.text('If gateway crashes, clients reconnect to another gateway and fetch missed ops by revision', W / 2, 575)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: WebSocket Management at Scale</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        With 10M concurrent WebSocket connections, a single server cannot handle the load.
        The architecture uses a tier of <strong className="text-green-400">WebSocket Gateway
        servers</strong>, each handling ~100K connections. When the Collaboration Service
        processes an operation, it publishes the transformed result to a{' '}
        <strong className="text-red-400">Redis Pub/Sub channel</strong> for that document.
        All gateways subscribed to that channel receive the broadcast and push it to their
        local clients. This decouples &ldquo;who is connected where&rdquo; from &ldquo;who
        needs this update.&rdquo;
      </p>
      <P5Sketch sketch={sketch} />

      <div className="bg-gray-800 rounded-lg p-5 space-y-3">
        <h4 className="text-white font-semibold text-sm">Optimization: Sticky Sessions</h4>
        <p className="text-gray-300 text-xs">
          Ideally, all clients editing the same document connect to the <strong>same gateway
          server</strong>. The load balancer uses consistent hashing on document_id to achieve
          this. Benefits: the gateway can broadcast locally without going through Redis at all
          for most operations, reducing latency and pub/sub traffic by 90%+. Only when clients
          span multiple gateways does Redis fan-out activate.
        </p>
        <h4 className="text-white font-semibold text-sm mt-3">Catch-Up Protocol</h4>
        <p className="text-gray-300 text-xs">
          When a client reconnects (after network blip or gateway crash), it sends its last known
          revision number. The server responds with all operations since that revision. The client
          applies them sequentially, transforming any local pending ops against the missed remote
          ops. This makes the system resilient to transient connection failures.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Deep Dive 3: Presence and Cursors                     */
/* ================================================================== */

function PresenceSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 550

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Cursor Presence & Transform', W / 2, 8)

      // Simulated document text
      const docX = W * 0.08
      const docW = W * 0.84
      const docY = 50
      const lineH = 28

      // Document background
      p.fill(25, 25, 40)
      p.stroke(50, 50, 70)
      p.strokeWeight(1)
      p.rect(docX, docY, docW, lineH * 7 + 20, 6)

      // Document lines
      const lines = [
        'The quick brown fox jumps over the lazy dog.',
        'System design interviews test your ability to',
        'think about large-scale distributed systems and',
        'make reasonable tradeoffs under constraints.',
        'Google Docs is a great example because it requires',
        'real-time collaboration at massive scale.',
        'Every keystroke must be synced in under 100ms.',
      ]

      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)

      for (let i = 0; i < lines.length; i++) {
        p.fill(220, 220, 230)
        p.noStroke()
        p.text(lines[i], docX + 12, docY + 10 + i * lineH)
      }

      // Simulated cursors for 3 users
      // Alice: cursor position oscillates (she's typing)
      const alicePos = 10 + Math.floor(Math.sin(t * 0.8) * 3 + 3)
      const aliceLine = 0
      const aliceX = docX + 12 + alicePos * 6.6
      const aliceY = docY + 10 + aliceLine * lineH

      // Blinking cursor for Alice
      if (Math.sin(t * 6) > 0) {
        p.stroke(INDIGO[0], INDIGO[1], INDIGO[2])
        p.strokeWeight(2)
        p.line(aliceX, aliceY - 2, aliceX, aliceY + 16)
      }
      // Alice name tag
      p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
      p.noStroke()
      p.rect(aliceX - 2, aliceY - 14, 38, 12, 3)
      p.fill(255)
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Alice', aliceX + 2, aliceY - 8)

      // Bob: selection on line 3
      const bobStart = 5
      const bobEnd = 16
      const bobLine = 3
      const bobSX = docX + 12 + bobStart * 6.6
      const bobEX = docX + 12 + bobEnd * 6.6
      const bobY = docY + 10 + bobLine * lineH

      // Selection highlight
      p.fill(CYAN[0], CYAN[1], CYAN[2], 50)
      p.noStroke()
      p.rect(bobSX, bobY - 2, bobEX - bobSX, 18, 2)
      // Cursor at end
      if (Math.sin(t * 5 + 1) > 0) {
        p.stroke(CYAN[0], CYAN[1], CYAN[2])
        p.strokeWeight(2)
        p.line(bobEX, bobY - 2, bobEX, bobY + 16)
      }
      // Bob name tag
      p.fill(CYAN[0], CYAN[1], CYAN[2])
      p.noStroke()
      p.rect(bobEX - 2, bobY - 14, 28, 12, 3)
      p.fill(255)
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Bob', bobEX + 2, bobY - 8)

      // Carol: cursor on line 5
      const carolPos = 20
      const carolLine = 5
      const carolX = docX + 12 + carolPos * 6.6
      const carolY = docY + 10 + carolLine * lineH

      if (Math.sin(t * 4.5 + 2) > 0) {
        p.stroke(PURPLE[0], PURPLE[1], PURPLE[2])
        p.strokeWeight(2)
        p.line(carolX, carolY - 2, carolX, carolY + 16)
      }
      p.fill(PURPLE[0], PURPLE[1], PURPLE[2])
      p.noStroke()
      p.rect(carolX - 2, carolY - 14, 34, 12, 3)
      p.fill(255)
      p.textSize(8)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('Carol', carolX + 2, carolY - 8)

      // --- CURSOR TRANSFORM DIAGRAM ---
      const txY = docY + lineH * 7 + 40
      p.fill(255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Cursor Transform When Remote Op Arrives', W / 2, txY)

      // Before/After comparison
      const befX = W * 0.25
      const aftX = W * 0.75
      const compY = txY + 35

      // Before box
      p.fill(30, 30, 45)
      p.stroke(60, 60, 80)
      p.strokeWeight(1)
      p.rect(befX - 130, compY, 260, 100, 6)
      p.noStroke()
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('BEFORE: Alice inserts "XX" at pos 5', befX, compY + 5)

      p.textAlign(p.LEFT, p.TOP)
      p.fill(200, 200, 210)
      p.textSize(11)
      p.text('The q|uick brown fox', befX - 110, compY + 30)
      // Show cursor positions
      p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
      p.textSize(8)
      p.text('Alice cursor: pos 5', befX - 110, compY + 52)
      p.fill(CYAN[0], CYAN[1], CYAN[2])
      p.text('Bob cursor: pos 15', befX - 110, compY + 66)
      p.fill(PURPLE[0], PURPLE[1], PURPLE[2])
      p.text('Carol cursor: pos 25', befX - 110, compY + 80)

      // Arrow between
      drawArrowH(p, befX + 135, compY + 50, aftX - 135, YELLOW, 'transform cursors')

      // After box
      p.fill(30, 30, 45)
      p.stroke(60, 60, 80)
      p.strokeWeight(1)
      p.rect(aftX - 130, compY, 260, 100, 6)
      p.noStroke()
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('AFTER: "XX" inserted, cursors shifted', aftX, compY + 5)

      p.textAlign(p.LEFT, p.TOP)
      p.fill(200, 200, 210)
      p.textSize(11)
      p.text('The qXX|uick brown fox', aftX - 110, compY + 30)
      // Updated cursor positions
      p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
      p.textSize(8)
      p.text('Alice cursor: pos 7 (+2)', aftX - 110, compY + 52)
      p.fill(CYAN[0], CYAN[1], CYAN[2])
      p.text('Bob cursor: pos 17 (+2)', aftX - 110, compY + 66)
      p.fill(PURPLE[0], PURPLE[1], PURPLE[2])
      p.text('Carol cursor: pos 27 (+2)', aftX - 110, compY + 80)

      // Rule explanation
      p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Rule: if insert_pos <= cursor_pos, shift cursor right by insert_length', W / 2, compY + 115)
      p.text('Rule: if delete_pos < cursor_pos, shift cursor left by min(delete_count, cursor_pos - delete_pos)', W / 2, compY + 130)

      // Presence info
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Presence heartbeat every 5s: { user_id, cursor_pos, status, last_active }', W / 2, compY + 155)
      p.text('If no heartbeat for 30s, user is considered disconnected and removed from presence list', W / 2, compY + 168)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Presence and Cursors</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Each collaborator sees colored cursors and selections for every other user. Cursor positions
        are stored as character offsets within the document. The critical insight: when a remote
        operation is applied (text inserted or deleted), <strong className="text-yellow-400">all
        cursor positions must be transformed</strong> using the same logic as OT {'\u2014'} if
        text is inserted before your cursor, your cursor shifts right by the insertion length.
        Presence data (who is online, their status) is stored in Redis with a short TTL and
        refreshed via WebSocket heartbeats.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Deep Dive 4: Revision History and Snapshots           */
/* ================================================================== */

function RevisionSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 580

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Revision History \u2014 Snapshots + Operation Log', W / 2, 8)

      // --- TIMELINE ---
      const tlY = 70
      const tlLeft = W * 0.06
      const tlRight = W * 0.94
      const tlWidth = tlRight - tlLeft

      // Timeline line
      p.stroke(TEXT_C[0], TEXT_C[1], TEXT_C[2], 100)
      p.strokeWeight(2)
      p.line(tlLeft, tlY, tlRight, tlY)

      // Operation ticks along the timeline
      const totalOps = 30
      const opSpacing = tlWidth / totalOps
      for (let i = 0; i <= totalOps; i++) {
        const ox = tlLeft + i * opSpacing
        const isSnapshot = i === 0 || i === 10 || i === 20
        if (isSnapshot) {
          // Snapshot marker (larger, colored)
          p.fill(GREEN[0], GREEN[1], GREEN[2])
          p.noStroke()
          p.rect(ox - 6, tlY - 12, 12, 24, 3)
          p.fill(255)
          p.textSize(7)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`S${i}`, ox, tlY)
          // Label
          p.fill(GREEN[0], GREEN[1], GREEN[2])
          p.textSize(7)
          p.textAlign(p.CENTER, p.BOTTOM)
          p.text(`rev ${i}`, ox, tlY - 16)
          p.text('snapshot', ox, tlY - 24)
        } else {
          // Regular op tick
          p.stroke(TEXT_C[0], TEXT_C[1], TEXT_C[2], 60)
          p.strokeWeight(1)
          p.line(ox, tlY - 5, ox, tlY + 5)
        }
      }

      // Current position marker
      const curOp = 27
      const curX = tlLeft + curOp * opSpacing
      p.fill(PINK[0], PINK[1], PINK[2])
      p.noStroke()
      p.triangle(curX, tlY + 12, curX - 5, tlY + 20, curX + 5, tlY + 20)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text(`current (rev ${curOp})`, curX, tlY + 22)

      // Legend
      p.textSize(8)
      p.textAlign(p.LEFT, p.TOP)
      p.fill(GREEN[0], GREEN[1], GREEN[2])
      p.rect(tlLeft, tlY + 38, 8, 8, 2)
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.text('= Snapshot (full document)', tlLeft + 12, tlY + 38)
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.text('| = Operation (insert/delete/format)', tlLeft + 12, tlY + 52)

      // --- RECONSTRUCTION DIAGRAM ---
      const reconY = 160
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Reconstructing Document at Revision 15', W / 2, reconY)

      // Step 1: Find nearest snapshot
      const stepY = reconY + 30
      const step1X = W * 0.15
      const step2X = W * 0.50
      const step3X = W * 0.85

      drawBox(p, step1X, stepY + 20, 130, 44, GREEN, 'Find Nearest', 'Snapshot <= rev 15')
      drawBox(p, step2X, stepY + 20, 130, 44, ORANGE, 'Replay Ops', 'rev 10 \u2192 rev 15')
      drawBox(p, step3X, stepY + 20, 130, 44, INDIGO, 'Return Doc', 'at revision 15')

      drawArrowH(p, step1X + 70, stepY + 20, step2X - 70, GREEN, 'snapshot at rev 10')
      drawArrowH(p, step2X + 70, stepY + 20, step3X - 70, ORANGE, 'apply 5 ops')

      // Show the replay in detail
      const replayY = stepY + 75
      p.fill(25, 25, 40)
      p.stroke(50, 50, 70)
      p.strokeWeight(1)
      p.rect(W * 0.10, replayY, W * 0.80, 95, 6)

      p.noStroke()
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Snapshot (rev 10): "The quick brown fox"', W * 0.14, replayY + 8)

      const ops = [
        'op 11: insert(" jumps", pos=19)',
        'op 12: insert(" over", pos=25)',
        'op 13: insert(" the", pos=30)',
        'op 14: insert(" lazy", pos=34)',
        'op 15: insert(" dog", pos=39)',
      ]

      for (let i = 0; i < ops.length; i++) {
        // Animate: highlight current op being replayed
        const replayProgress = (t * 0.5) % (ops.length + 1)
        const isActive = Math.floor(replayProgress) === i
        if (isActive) {
          p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
        } else if (i < Math.floor(replayProgress)) {
          p.fill(GREEN[0], GREEN[1], GREEN[2])
        } else {
          p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
        }
        p.textSize(9)
        p.text(ops[i], W * 0.14 + (i % 3) * (W * 0.26), replayY + 30 + Math.floor(i / 3) * 18)
      }

      p.fill(GREEN[0], GREEN[1], GREEN[2])
      p.textSize(10)
      p.text('Result (rev 15): "The quick brown fox jumps over the lazy dog"', W * 0.14, replayY + 72)

      // --- SNAPSHOT STRATEGY ---
      const stratY = replayY + 120
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Snapshot Strategy', W / 2, stratY)

      const strategies = [
        { label: 'Every 100 ops', desc: 'Max 100 ops to replay', color: GREEN },
        { label: 'Every 5 minutes', desc: 'Bound reconstruction time', color: CYAN },
        { label: 'On user request', desc: '"Name this version"', color: PURPLE },
        { label: 'On share/export', desc: 'Ensure consistent state', color: ORANGE },
      ]

      const stratSpacing = W / (strategies.length + 1)
      for (let i = 0; i < strategies.length; i++) {
        const sx = stratSpacing * (i + 1)
        drawBox(p, sx, stratY + 40, 120, 44, strategies[i].color, strategies[i].label, strategies[i].desc)
      }

      // --- STORAGE OPTIMIZATION ---
      const storY = stratY + 95
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Storage Tiering for Revision Data', W / 2, storY)

      const tierY = storY + 35
      const tierW = W * 0.25

      drawBox(p, W * 0.20, tierY, tierW - 10, 50, GREEN, 'Hot (SSD)', 'Last 24h of ops + snapshots')
      drawBox(p, W * 0.50, tierY, tierW - 10, 50, YELLOW, 'Warm (HDD)', '30-day ops + weekly snapshots')
      drawBox(p, W * 0.80, tierY, tierW - 10, 50, RED, 'Cold (S3)', 'Archive: monthly snapshots only')

      drawArrowH(p, W * 0.20 + (tierW - 10) / 2 + 4, tierY, W * 0.50 - (tierW - 10) / 2 - 4, YELLOW, 'age out')
      drawArrowH(p, W * 0.50 + (tierW - 10) / 2 + 4, tierY, W * 0.80 - (tierW - 10) / 2 - 4, RED, 'archive')

      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Op log is the source of truth. Between any two snapshots, the full op sequence is preserved.', W / 2, tierY + 38)
      p.text('On cold tier, only snapshots kept \u2014 individual ops discarded after 90 days to save space.', W / 2, tierY + 52)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Revision History and Snapshots</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Every operation is appended to an immutable <strong className="text-orange-400">operation
        log</strong> {'\u2014'} this is the source of truth for the document. Periodically (every
        100 ops or every 5 minutes), the system takes a <strong className="text-green-400">
        snapshot</strong> of the full document. To reconstruct the document at any revision R:
        find the nearest snapshot before R, then replay all operations from that snapshot to R.
        This is how the &ldquo;Version History&rdquo; feature works {'\u2014'} you can view any
        past state without storing a full copy for every revision.
      </p>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Deep Dive 5: Offline Editing                         */
/* ================================================================== */

function OfflineSection() {
  const [phase, setPhase] = useState<'online' | 'offline' | 'reconnect' | 'synced'>('online')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 600

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      const curPhase = phaseRef.current
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Offline Editing & Reconnection Sync', W / 2, 8)

      // Three lifelines
      const colClient = W * 0.20
      const colServer = W * 0.50
      const colOther = W * 0.80

      const topY = 50
      drawBox(p, colClient, topY, 110, 30, INDIGO, 'Client (You)')
      drawBox(p, colServer, topY, 120, 30, PINK, 'Collab Server')
      drawBox(p, colOther, topY, 110, 30, CYAN, 'Other Clients')

      // Lifelines
      const entitiesOff = [
        { x: colClient, color: INDIGO },
        { x: colServer, color: PINK },
        { x: colOther, color: CYAN },
      ]
      for (const ent of entitiesOff) {
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.stroke(ent.color[0], ent.color[1], ent.color[2], 60)
        p.strokeWeight(1)
        p.line(ent.x, topY + 15, ent.x, H - 20)
        ctx.setLineDash([])
      }

      // Phase: ONLINE
      const y1 = 95
      p.fill(GREEN[0], GREEN[1], GREEN[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('CONNECTED (rev 42)', (colClient + colServer) / 2, y1 - 8)
      drawArrowH(p, colClient, y1, colServer, INDIGO, 'normal editing ops...')
      drawArrowH(p, colServer, y1 + 15, colClient, GREEN, 'ack + remote ops')

      if (curPhase === 'online') {
        drawPulse(p, colClient, y1 + 35, t, GREEN)
        p.fill(GREEN[0], GREEN[1], GREEN[2])
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2713 Online', colClient, y1 + 55)
      }

      if (curPhase === 'offline' || curPhase === 'reconnect' || curPhase === 'synced') {
        // Disconnect event
        const dcY = 140
        const flash = Math.sin(t * 5) > 0 ? 255 : 140
        p.fill(RED[0], RED[1], RED[2], flash)
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2716 DISCONNECTED', colClient, dcY)

        // Client makes local edits
        const localOps = [
          { y: 175, label: 'Local edit 1: insert "Hello" at pos 10' },
          { y: 195, label: 'Local edit 2: delete 3 chars at pos 50' },
          { y: 215, label: 'Local edit 3: format bold pos 0-5' },
          { y: 235, label: 'Local edit 4: insert "World" at pos 20' },
          { y: 255, label: 'Local edit 5: delete 2 chars at pos 30' },
        ]

        // Pending queue
        p.fill(INDIGO[0], INDIGO[1], INDIGO[2], 30)
        p.stroke(INDIGO[0], INDIGO[1], INDIGO[2], 80)
        p.strokeWeight(1)
        p.rect(colClient - 120, 162, 240, 108, 4)
        p.noStroke()
        p.fill(INDIGO[0], INDIGO[1], INDIGO[2])
        p.textSize(7)
        p.textAlign(p.LEFT, p.TOP)
        p.text('PENDING QUEUE (stored in IndexedDB)', colClient - 115, 164)

        for (const op of localOps) {
          p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(op.label, colClient, op.y)
        }

        // Meanwhile on server, other users edit
        const remoteOps = [
          { y: 185, label: 'Remote op A: insert at pos 5 (rev 43)' },
          { y: 210, label: 'Remote op B: delete at pos 40 (rev 44)' },
          { y: 235, label: 'Remote op C: insert at pos 60 (rev 45)' },
        ]

        p.fill(CYAN[0], CYAN[1], CYAN[2], 30)
        p.stroke(CYAN[0], CYAN[1], CYAN[2], 80)
        p.strokeWeight(1)
        p.rect(colServer - 10, 172, (colOther - colServer) + 20, 80, 4)
        p.noStroke()

        for (const op of remoteOps) {
          drawArrowH(p, colOther, op.y, colServer, CYAN, op.label)
        }
      }

      if (curPhase === 'reconnect' || curPhase === 'synced') {
        // Reconnect
        const rcY = 300
        p.fill(GREEN[0], GREEN[1], GREEN[2])
        p.textSize(10)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2713 RECONNECTED', colClient, rcY)

        // Step 1: Send last known revision
        drawArrowH(p, colClient, rcY + 25, colServer, INDIGO, 'sync_request: last_rev=42, pending_ops=[5 ops]')

        // Step 2: Server sends missed ops
        drawArrowH(p, colServer, rcY + 50, colClient, PINK, 'missed_ops: [rev 43, 44, 45]')

        // Step 3: Transform
        p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Server transforms 5 pending ops against 3 remote ops', colServer, rcY + 75)

        // Transform box
        p.noFill()
        p.stroke(YELLOW[0], YELLOW[1], YELLOW[2], 100)
        p.strokeWeight(1)
        p.rect(colServer - 170, rcY + 85, 340, 55, 4)
        p.noStroke()

        p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('for each pending_op:', colServer, rcY + 95)
        p.text('  transformed_op = transform(pending_op, each missed_remote_op)', colServer, rcY + 107)
        p.text('  apply transformed_op, increment revision', colServer, rcY + 119)

        // Step 4: Ack
        drawArrowH(p, colServer, rcY + 150, colClient, GREEN, 'ack: all 5 ops applied (now at rev 48)')

        // Step 5: Broadcast to others
        drawArrowH(p, colServer, rcY + 170, colOther, PINK, "broadcast transformed ops to other clients")
      }

      if (curPhase === 'synced') {
        const syncY = 510
        p.fill(GREEN[0], GREEN[1], GREEN[2])
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('\u2713 ALL CLIENTS SYNCED AT REV 48', W / 2, syncY)

        drawPulse(p, colClient, syncY + 25, t, GREEN)
        drawPulse(p, colServer, syncY + 25, t, GREEN)
        drawPulse(p, colOther, syncY + 25, t, GREEN)

        p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        p.text('No edits were lost. Offline edits were transformed against concurrent remote edits.', W / 2, syncY + 42)
      }

      // Phase label
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(9)
      p.textAlign(p.RIGHT, p.BOTTOM)
      p.text(`Phase: ${curPhase.toUpperCase()}`, W - 15, H - 5)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Deep Dive: Offline Editing</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        When a user goes offline (loses network, airplane mode), they can continue editing locally.
        Edits are queued as <strong className="text-indigo-400">pending operations</strong> in
        IndexedDB. When the connection is restored, the client sends all pending ops with its
        last known revision. The server transforms the pending ops against all operations that
        happened while the user was offline, applies them, and broadcasts to other clients.
        This is the same OT mechanism {'\u2014'} offline is just a &ldquo;very long delay&rdquo;
        between sending an op and receiving an ack.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setPhase('online')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            phase === 'online' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Online
        </button>
        <button
          onClick={() => setPhase('offline')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            phase === 'offline' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Go Offline
        </button>
        <button
          onClick={() => setPhase('reconnect')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            phase === 'reconnect' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Reconnect
        </button>
        <button
          onClick={() => setPhase('synced')}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            phase === 'synced' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Synced
        </button>
      </div>
      <P5Sketch sketch={sketch} />
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Scaling Strategy                                     */
/* ================================================================== */

function ScalingSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let W = 900
    const H = 580

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode
      const pw = parent ? parent.clientWidth : W
      W = Math.min(pw, 900)
      p.createCanvas(W, H)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(BG[0], BG[1], BG[2])

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Scaling Strategy \u2014 Partition by Document ID', W / 2, 8)

      const bw = 105
      const bh = 38

      // --- ROW 1: Incoming requests ---
      const row1Y = 60
      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('INCOMING REQUESTS', W * 0.15, row1Y - 15)

      drawBox(p, W * 0.08, row1Y + 15, 70, 28, INDIGO, 'doc:A ops', '')
      drawBox(p, W * 0.22, row1Y + 15, 70, 28, CYAN, 'doc:B ops', '')
      drawBox(p, W * 0.08, row1Y + 50, 70, 28, INDIGO, 'doc:A ops', '')
      drawBox(p, W * 0.22, row1Y + 50, 70, 28, PURPLE, 'doc:C ops', '')

      // --- ROW 2: Load balancer ---
      const row2Y = 155
      drawBox(p, W * 0.50, row2Y, bw + 30, bh, YELLOW, 'Load Balancer', 'hash(doc_id)')

      drawArrowV(p, W * 0.15, row1Y + 70, row2Y - bh / 2 - 4, TEXT_C)

      // --- ROW 3: Collab service partitions ---
      const row3Y = 245
      p.fill(PINK[0], PINK[1], PINK[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('COLLABORATION SERVICE (partitioned by doc_id)', W * 0.50, row3Y - 25)

      const partitions = [
        { x: W * 0.15, label: 'Partition 0', docs: 'doc:A, doc:D...', color: PINK },
        { x: W * 0.38, label: 'Partition 1', docs: 'doc:B, doc:E...', color: PINK },
        { x: W * 0.62, label: 'Partition 2', docs: 'doc:C, doc:F...', color: PINK },
        { x: W * 0.85, label: 'Partition 3', docs: 'doc:G, doc:H...', color: PINK },
      ]

      for (const part of partitions) {
        drawBox(p, part.x, row3Y + 10, bw + 10, bh + 4, part.color, part.label, part.docs)
      }

      // Arrows from LB to partitions
      drawArrowV(p, W * 0.50, row2Y + bh / 2 + 4, row3Y + 10 - (bh + 4) / 2 - 4, YELLOW)

      // Horizontal dashed lines to show routing
      drawDashedLine(p, W * 0.50, row2Y + bh / 2 + 4, W * 0.15, row3Y + 10 - (bh + 4) / 2 - 4, YELLOW)
      drawDashedLine(p, W * 0.50, row2Y + bh / 2 + 4, W * 0.85, row3Y + 10 - (bh + 4) / 2 - 4, YELLOW)

      // Key insight box
      p.fill(YELLOW[0], YELLOW[1], YELLOW[2], 30)
      p.stroke(YELLOW[0], YELLOW[1], YELLOW[2], 80)
      p.strokeWeight(1)
      p.rect(W * 0.05, row3Y + 45, W * 0.90, 35, 4)
      p.noStroke()
      p.fill(YELLOW[0], YELLOW[1], YELLOW[2])
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('KEY: Each document is owned by exactly ONE partition. This guarantees total ordering', W * 0.50, row3Y + 55)
      p.text('of operations per document without distributed consensus. Single-writer pattern.', W * 0.50, row3Y + 68)

      // --- ROW 4: Storage layers ---
      const row4Y = 350
      p.fill(255)
      p.textSize(11)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Storage Layer (also sharded by doc_id)', W * 0.50, row4Y - 10)

      drawBox(p, W * 0.15, row4Y + 25, bw + 10, bh, ORANGE, 'Op Log Shard 0', 'append-only')
      drawBox(p, W * 0.38, row4Y + 25, bw + 10, bh, ORANGE, 'Op Log Shard 1', 'append-only')
      drawBox(p, W * 0.62, row4Y + 25, bw + 10, bh, ORANGE, 'Op Log Shard 2', 'append-only')
      drawBox(p, W * 0.85, row4Y + 25, bw + 10, bh, ORANGE, 'Op Log Shard 3', 'append-only')

      // Arrows from partitions to op log shards
      for (const part of partitions) {
        drawArrowV(p, part.x, row3Y + 10 + (bh + 4) / 2 + 4, row4Y + 25 - bh / 2 - 4, ORANGE)
      }

      // --- ROW 5: Document store + replicas ---
      const row5Y = 430
      drawBox(p, W * 0.25, row5Y, bw + 20, bh, PURPLE, 'Doc Store', 'primary (write)')
      drawBox(p, W * 0.50, row5Y, bw + 20, bh, PURPLE, 'Read Replica 1', 'serving reads')
      drawBox(p, W * 0.75, row5Y, bw + 20, bh, PURPLE, 'Read Replica 2', 'serving reads')

      drawArrowH(p, W * 0.25 + (bw + 20) / 2 + 4, row5Y, W * 0.50 - (bw + 20) / 2 - 4, PURPLE, 'async repl')
      drawArrowH(p, W * 0.50 + (bw + 20) / 2 + 4, row5Y, W * 0.75 - (bw + 20) / 2 - 4, PURPLE, 'async repl')

      // --- ROW 6: Async services ---
      const row6Y = 500
      drawBox(p, W * 0.15, row6Y, bw - 5, bh - 4, CYAN, 'Search (ES)', 'async CDC')
      drawBox(p, W * 0.38, row6Y, bw - 5, bh - 4, GREEN, 'Media (S3)', 'CDN cache')
      drawBox(p, W * 0.62, row6Y, bw - 5, bh - 4, YELLOW, 'Export Svc', 'PDF/DOCX')
      drawBox(p, W * 0.85, row6Y, bw - 5, bh - 4, RED, 'Notification', 'email/push')

      drawDashedLine(p, W * 0.25, row5Y + bh / 2 + 4, W * 0.15, row6Y - (bh - 4) / 2 - 4, TEXT_C)
      drawDashedLine(p, W * 0.25, row5Y + bh / 2 + 4, W * 0.38, row6Y - (bh - 4) / 2 - 4, TEXT_C)
      drawDashedLine(p, W * 0.25, row5Y + bh / 2 + 4, W * 0.62, row6Y - (bh - 4) / 2 - 4, TEXT_C)
      drawDashedLine(p, W * 0.25, row5Y + bh / 2 + 4, W * 0.85, row6Y - (bh - 4) / 2 - 4, TEXT_C)

      // Animated dot through the partition path
      const pp = (t * 0.18) % 1
      const pathY = [row1Y + 35, row2Y, row3Y + 10, row4Y + 25]
      const pathX = W * 0.15
      const pStep = 1 / (pathY.length - 1)
      const pIdx = Math.min(Math.floor(pp / pStep), pathY.length - 2)
      const pLocal = (pp - pIdx * pStep) / pStep
      drawDot(p, pathX, pathY[pIdx], pathX, pathY[pIdx + 1], pLocal, INDIGO)

      p.fill(TEXT_C[0], TEXT_C[1], TEXT_C[2])
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Scaling: add more partitions. Rebalance via consistent hashing. Hot documents can have dedicated servers.', W / 2, row6Y + 30)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Scaling Strategy</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        The fundamental scaling principle: <strong className="text-yellow-400">partition by
        document_id</strong>. Each document is handled by exactly one Collaboration Service
        instance, which provides the total ordering guarantee that OT requires without distributed
        consensus. The operation log, document store, and WebSocket routing are all sharded on
        the same key. This allows independent scaling of each layer.
      </p>
      <P5Sketch sketch={sketch} />

      <div className="bg-gray-800 rounded-lg p-5 space-y-3">
        <h4 className="text-white font-semibold text-sm">Scaling Each Component</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-indigo-400 text-xs font-semibold">Collaboration Service</p>
            <p className="text-gray-300 text-xs">
              Stateful per-document. Partition by document_id using consistent hashing.
              Hot documents (1000+ concurrent editors) get dedicated servers. Rebalance
              by migrating document ownership to new partitions.
            </p>
          </div>
          <div>
            <p className="text-green-400 text-xs font-semibold">WebSocket Gateways</p>
            <p className="text-gray-300 text-xs">
              Stateless except for connection state. Scale horizontally. Use sticky sessions
              by document_id to minimize Redis pub/sub fan-out. Add gateways as connection
              count grows.
            </p>
          </div>
          <div>
            <p className="text-orange-400 text-xs font-semibold">Operation Log</p>
            <p className="text-gray-300 text-xs">
              Append-only, sharded by document_id. Each shard handles sequential writes for
              its documents. Use LSM-tree storage engines (Cassandra, ScyllaDB) for high write
              throughput.
            </p>
          </div>
          <div>
            <p className="text-purple-400 text-xs font-semibold">Document Store</p>
            <p className="text-gray-300 text-xs">
              Sharded by document_id, read replicas for serving GET requests. Primary handles
              snapshot writes. Async replication acceptable since snapshots are periodic, not
              real-time critical.
            </p>
          </div>
          <div>
            <p className="text-cyan-400 text-xs font-semibold">Search (Elasticsearch)</p>
            <p className="text-gray-300 text-xs">
              Async indexing via Change Data Capture (CDC) from document store. Separate cluster.
              Index updates are eventually consistent {'\u2014'} search results may lag a few seconds behind edits.
            </p>
          </div>
          <div>
            <p className="text-yellow-400 text-xs font-semibold">Media / Images</p>
            <p className="text-gray-300 text-xs">
              Images uploaded to S3, served via CDN. Document stores a reference URL, not the
              image itself. Resize and optimize on upload. CDN handles global distribution.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 12 -- Fault Tolerance                                      */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">12. Fault Tolerance</h2>

      <div className="space-y-4">
        {[
          {
            title: 'WebSocket Gateway Crash',
            icon: '\u26A1',
            color: 'text-yellow-400',
            description:
              'Clients detect the dropped connection and reconnect to another gateway via the load balancer. On reconnection, the client sends its last known revision number. The new gateway fetches missed operations from the op log and sends them to the client. The client applies them locally, transforming any pending unacknowledged ops. No data is lost because the op log is the durable source of truth.',
          },
          {
            title: 'Collaboration Service Crash',
            icon: '\uD83D\uDD04',
            color: 'text-pink-400',
            description:
              'A new Collaboration Service instance takes ownership of the affected document partition. It loads the latest snapshot from the document store and replays all operations since that snapshot from the op log. In-flight operations that were received but not yet acknowledged may be lost. Clients resend any unacknowledged operations (they buffer until ack), so these are automatically retried. Recovery time: typically under 2 seconds.',
          },
          {
            title: 'Redis Pub/Sub Failure',
            icon: '\uD83D\uDCE1',
            color: 'text-red-400',
            description:
              'If Redis fails, the real-time broadcast channel breaks. Fallback: gateways poll the Collaboration Service via HTTP at short intervals (200ms) to fetch new operations for their subscribed documents. This increases latency from ~50ms to ~200ms but maintains correctness. Redis Sentinel or Redis Cluster provides automatic failover for most cases.',
          },
          {
            title: 'Operation Log Partition Failure',
            icon: '\uD83D\uDCBE',
            color: 'text-orange-400',
            description:
              'The op log uses replication factor 3 (e.g., Cassandra with RF=3). If one replica fails, writes continue to the other two. If the partition is fully unavailable, the Collaboration Service queues operations in memory (bounded buffer) and retries. If the buffer fills, the document is temporarily set to read-only mode until the partition recovers.',
          },
          {
            title: 'Document Store Outage',
            icon: '\uD83D\uDDC3',
            color: 'text-purple-400',
            description:
              'Documents can always be reconstructed from the op log (it is the ultimate source of truth). Read replicas can serve document content for opening existing documents. Snapshot creation pauses but editing continues uninterrupted since real-time editing only depends on the op log and the in-memory Collaboration Service state.',
          },
          {
            title: 'Full Region Failure',
            icon: '\uD83C\uDF0D',
            color: 'text-cyan-400',
            description:
              'Multi-region deployment with active-passive failover per document partition. The op log is replicated cross-region asynchronously. On failover, the passive region promotes to active, replays any un-replicated ops (small gap, typically < 1s of ops), and resumes. Clients reconnect to the new region via DNS failover. Some operations in the gap may need manual reconciliation.',
          },
        ].map((item, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-5">
            <h4 className={`${item.color} font-semibold text-sm flex items-center gap-2`}>
              <span>{item.icon}</span> {item.title}
            </h4>
            <p className="text-gray-300 text-xs mt-2 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg p-5">
        <h4 className="text-white font-semibold text-sm">The Recovery Invariant</h4>
        <p className="text-gray-300 text-xs mt-2 leading-relaxed">
          The system is designed around one principle: the <strong className="text-orange-400">
          operation log is the source of truth</strong>. The document can always be rebuilt by
          replaying operations from the beginning (or from the nearest snapshot). Snapshots are
          an optimization, not a requirement. The in-memory state of the Collaboration Service
          is a cache that can be reconstructed. As long as the op log survives, no data is lost.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 13 -- Tradeoffs                                            */
/* ================================================================== */

function TradeoffsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">13. Key Tradeoffs</h2>

      <div className="space-y-4">
        {[
          {
            left: 'Operational Transformation (OT)',
            right: 'Conflict-Free Replicated Data Types (CRDTs)',
            leftPros: 'Simpler with centralized server, smaller operation size, well-proven (Google\'s original choice), easier to implement formatting operations',
            rightPros: 'No central server needed (true P2P), better for offline-heavy use cases, mathematically guaranteed convergence, no transform function complexity',
            tension:
              'OT is the right choice here because we have a centralized server anyway (for permissions, storage, etc.). CRDTs shine in P2P or offline-first apps (e.g., Apple Notes, Figma). OT operations are smaller on the wire. Google Docs uses OT; newer tools like Figma use CRDTs.',
          },
          {
            left: 'Single-Writer per Document',
            right: 'Multi-Writer with Consensus',
            leftPros: 'Simple total ordering, no distributed locking, fast (one server decides order), deterministic',
            rightPros: 'No single point of failure per doc, higher throughput for extremely hot documents, better availability',
            tension:
              'Single-writer is vastly simpler and sufficient for 99.9% of documents. Even a viral shared doc rarely needs >100K ops/sec, which one server handles easily. Multi-writer adds Raft/Paxos complexity for marginal benefit. Use single-writer with fast failover.',
          },
          {
            left: 'Operation Log (Event Sourcing)',
            right: 'Full Document Snapshots Only',
            leftPros: 'Space efficient for active docs, enables fine-grained version history, supports undo/redo, enables any-revision reconstruction',
            rightPros: 'Faster reads (no replay needed), simpler implementation, no reconstruction cost, easier to understand',
            tension:
              'The hybrid approach is best: operation log as source of truth with periodic snapshots as optimization checkpoints. This gives us fine-grained history and fast reads. Pure snapshot approach would use 100x more storage for active documents.',
          },
          {
            left: 'Real-Time Cursor Sharing',
            right: 'Periodic Cursor Updates',
            leftPros: 'Smooth, responsive collaborative experience, users feel co-present, immediate awareness of others\' actions',
            rightPros: 'Much less bandwidth, fewer messages to process, sufficient for most awareness needs',
            tension:
              'Real-time cursors are a key UX differentiator for Google Docs. The bandwidth cost is manageable: cursor updates are tiny (~50 bytes each) and can be throttled to 10-20fps. For documents with 100+ editors, switch to periodic updates to avoid cursor-update storms.',
          },
          {
            left: 'Strong Consistency (Edits)',
            right: 'Eventual Consistency (Comments/Presence)',
            leftPros: 'All users see the same document text at all times, no divergence, correctness guarantee',
            rightPros: 'Lower latency, higher availability, simpler infrastructure for non-critical data',
            tension:
              'Document text requires strong consistency (the whole point of OT). But comments, presence, and search can be eventually consistent. A comment appearing 500ms late is fine. A missing character is not. This mixed consistency model lets us optimize each subsystem independently.',
          },
        ].map((tradeoff, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-green-400 font-semibold text-sm">{tradeoff.left}</span>
              <span className="text-gray-500 text-sm">vs.</span>
              <span className="text-blue-400 font-semibold text-sm">{tradeoff.right}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
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
/*  Section 14 -- Interview Tips                                       */
/* ================================================================== */

function InterviewTipsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">14. Interview Tips</h2>

      <div className="bg-gray-800 rounded-lg p-5 space-y-4">
        <h4 className="text-indigo-400 font-semibold text-sm">What Interviewers Look For</h4>
        <ul className="text-gray-300 text-xs space-y-2 ml-4 list-disc list-inside">
          <li>
            <strong className="text-white">Can you explain OT clearly?</strong> Most candidates
            hand-wave here. Walk through a concrete example with two concurrent edits. Show the
            transform function. Explain why a centralized server makes ordering simple.
          </li>
          <li>
            <strong className="text-white">Do you understand the WebSocket scaling challenge?</strong> 10M
            connections means distributed gateways + pub/sub. Show you understand the fan-out problem
            and how Redis (or Kafka) solves it.
          </li>
          <li>
            <strong className="text-white">Can you reason about consistency?</strong> What exactly
            is consistent (document text) vs. eventually consistent (comments, search, presence)?
            Why? What are the implications?
          </li>
          <li>
            <strong className="text-white">What happens during failures?</strong> Gateway crash,
            Collab Service crash, network partition. Show you have a recovery story for each.
            The op log as source of truth is the anchor.
          </li>
          <li>
            <strong className="text-white">Offline support.</strong> Many candidates forget this.
            Offline is just &ldquo;long-delayed OT.&rdquo; Show you understand the reconciliation
            protocol.
          </li>
        </ul>

        <h4 className="text-pink-400 font-semibold text-sm mt-4">Common Mistakes</h4>
        <ul className="text-gray-300 text-xs space-y-2 ml-4 list-disc list-inside">
          <li>Saying &ldquo;just use a database with locking&rdquo; {'\u2014'} this does not scale to real-time</li>
          <li>Confusing OT with simple merge conflict resolution (OT is much more nuanced)</li>
          <li>Ignoring the cursor/presence problem {'\u2014'} it is surprisingly complex at scale</li>
          <li>Treating all data the same consistency level {'\u2014'} mixed model is the right answer</li>
          <li>Not partitioning by document_id {'\u2014'} this is the single most important scaling decision</li>
        </ul>

        <h4 className="text-green-400 font-semibold text-sm mt-4">Bonus Points</h4>
        <ul className="text-gray-300 text-xs space-y-2 ml-4 list-disc list-inside">
          <li>Mention Google&apos;s Jupiter OT system and how it evolved</li>
          <li>Compare OT vs CRDT with specific tradeoffs (not just &ldquo;CRDTs are newer&rdquo;)</li>
          <li>Discuss how comment anchors are transformed (same as cursor transforms)</li>
          <li>Explain how the export service works (render to PDF server-side, return signed S3 URL)</li>
          <li>Talk about rate limiting: what if a malicious client sends 10K ops/sec?</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignGoogleDocs() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold text-white">
          Design Google Docs
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          How do you build a real-time collaborative document editor where every keystroke
          from 100+ concurrent users is merged in under 100ms, with full version history,
          offline support, and 99.99% availability at the scale of 1B+ documents?
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <OTSection />
      <WebSocketSection />
      <PresenceSection />
      <RevisionSection />
      <OfflineSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
      <InterviewTipsSection />

      <footer className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
        System Design Case Study {'\u2014'} oneML Learning Platform
      </footer>
    </div>
  )
}
