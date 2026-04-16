import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-s3',
  title: 'Design S3 (Object Storage)',
  description:
    'System design deep dive: a distributed object storage system with 11 nines durability, erasure coding, multipart uploads, and metadata at trillion-object scale',
  track: 'systems',
  order: 15,
  tags: [
    's3',
    'object-storage',
    'distributed-storage',
    'erasure-coding',
    'durability',
    'system-design',
  ],
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

function drawBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: [number, number, number],
  strokeColor: [number, number, number],
  label: string,
  labelSize = 10,
) {
  p.fill(fillColor[0], fillColor[1], fillColor[2])
  p.stroke(strokeColor[0], strokeColor[1], strokeColor[2])
  p.strokeWeight(1.5)
  p.rect(x - w / 2, y - h / 2, w, h, 6)
  p.fill(255)
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(labelSize)
  p.text(label, x, y)
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
  weight = 2,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 8
  p.stroke(color[0], color[1], color[2], color[3])
  p.strokeWeight(weight)
  p.line(x1, y1, x2, y2)
  p.fill(color[0], color[1], color[2], color[3])
  p.noStroke()
  p.triangle(
    x2,
    y2,
    x2 - headLen * Math.cos(angle - 0.35),
    y2 - headLen * Math.sin(angle - 0.35),
    x2 - headLen * Math.cos(angle + 0.35),
    y2 - headLen * Math.sin(angle + 0.35),
  )
}

function drawMovingDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
  size = 8,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

/* ================================================================== */
/*  Section 1 -- Problem Statement                                     */
/* ================================================================== */

function ProblemStatementSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a <strong className="text-white">distributed object storage system</strong> that can
        store and retrieve any amount of data with extreme durability, high availability, and low
        cost. This is Amazon S3: the backbone of the modern internet that stores trillions of objects
        for millions of customers, from startup backups to Netflix video streams.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The core tension: we want 11 nines of durability (99.999999999% -- you would lose 1 object
        out of 100 billion per year) without storing 3 full copies of everything (which triples
        cost). We want to support 5TB objects without loading them into memory. We want to index
        trillions of objects without single-node bottlenecks.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- Functional Requirements                               */
/* ================================================================== */

function FunctionalRequirementsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">2. Functional Requirements</h2>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li><strong className="text-white">Object operations:</strong> PUT, GET, DELETE, HEAD (metadata only), COPY</li>
        <li><strong className="text-white">Bucket management:</strong> create/delete buckets as namespaces, LIST objects with prefix filtering and pagination</li>
        <li><strong className="text-white">Multipart upload:</strong> split large objects into parts (up to 10,000 parts), upload in parallel, complete/abort</li>
        <li><strong className="text-white">Versioning:</strong> keep all versions of an object, retrieve any version by ID</li>
        <li><strong className="text-white">Presigned URLs:</strong> generate time-limited URLs for upload/download without credentials</li>
        <li><strong className="text-white">Lifecycle policies:</strong> auto-transition objects between storage tiers (Standard, IA, Glacier) or auto-delete after N days</li>
        <li><strong className="text-white">Server-side encryption:</strong> AES-256 encryption at rest (SSE-S3, SSE-KMS, SSE-C)</li>
        <li><strong className="text-white">Access control:</strong> bucket policies, ACLs, IAM integration</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Non-Functional Requirements                           */
/* ================================================================== */

function NonFunctionalRequirementsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">3. Non-Functional Requirements</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Dimension</th>
              <th className="py-2 px-4 text-white">Target</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Durability</td>
              <td className="py-2 px-4">99.999999999% (11 nines) -- designed to sustain loss of 2 facilities</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Availability</td>
              <td className="py-2 px-4">99.99% (Standard tier), 99.9% (IA tier)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Max object size</td>
              <td className="py-2 px-4">5 TB (via multipart upload; single PUT limited to 5 GB)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Throughput</td>
              <td className="py-2 px-4">3,500 PUT/sec and 5,500 GET/sec per prefix partition</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium">Consistency</td>
              <td className="py-2 px-4">Strong read-after-write consistency (since Dec 2020)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium">Scale</td>
              <td className="py-2 px-4">Unlimited objects per bucket, exabytes total storage</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Back-of-Envelope Calculations                         */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">4. Back-of-Envelope Calculations</h2>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-3 font-mono text-sm text-gray-300">
        <p className="text-white font-bold font-sans">Storage (hypothetical large deployment):</p>
        <p>100 PB raw data stored</p>
        <p>With erasure coding (8+4): overhead = 12/8 = 1.5x</p>
        <p>Physical storage needed: 100 PB x 1.5 = <span className="text-green-400">150 PB</span></p>
        <p>Compare 3x replication: 100 PB x 3 = 300 PB (2x more storage!)</p>

        <p className="text-white font-bold font-sans pt-2">Request throughput:</p>
        <p>100K requests/sec aggregate</p>
        <p>Average object size: 1 MB</p>
        <p>Read bandwidth: 100K x 1 MB = <span className="text-green-400">100 GB/sec</span></p>
        <p>Across 1000 storage nodes = 100 MB/sec per node (comfortable)</p>

        <p className="text-white font-bold font-sans pt-2">Metadata scale:</p>
        <p>100 trillion objects (10^14)</p>
        <p>Each metadata record: ~500 bytes (key, size, etag, timestamps, headers)</p>
        <p>Metadata storage: 10^14 x 500B = <span className="text-green-400">~50 PB</span> of metadata</p>
        <p>Sharded across thousands of metadata nodes</p>

        <p className="text-white font-bold font-sans pt-2">Durability math:</p>
        <p>11 nines = lose 1 object per 100 billion per year</p>
        <p>With 8+4 erasure coding: need 5+ simultaneous chunk losses to lose data</p>
        <p>P(5 disk failures before repair) with 4hr repair time: ~10^-12</p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- API Design                                            */
/* ================================================================== */

function APIDesignSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">5. API Design (REST)</h2>
      <p className="text-gray-300 leading-relaxed">
        S3 uses a RESTful HTTP API. Objects are addressed by bucket name and key. Authentication
        uses HMAC-SHA256 signed requests (AWS Signature V4).
      </p>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-3">
        <p className="text-white font-bold">// Object operations</p>
        <p>PUT /bucket-name/path/to/object.jpg      <span className="text-gray-500">// upload object (body = bytes)</span></p>
        <p>GET /bucket-name/path/to/object.jpg      <span className="text-gray-500">// download object</span></p>
        <p>HEAD /bucket-name/path/to/object.jpg     <span className="text-gray-500">// metadata only (size, etag, content-type)</span></p>
        <p>DELETE /bucket-name/path/to/object.jpg   <span className="text-gray-500">// delete object (or add delete marker if versioned)</span></p>

        <p className="text-white font-bold pt-2">// List objects (with prefix filtering)</p>
        <p>GET /bucket-name?prefix=photos/2024/&amp;max-keys=1000&amp;continuation-token=abc</p>
        <p><span className="text-gray-500">// returns XML with keys, sizes, etags, pagination token</span></p>

        <p className="text-white font-bold pt-2">// Multipart upload</p>
        <p>POST /bucket/key?uploads                 <span className="text-gray-500">// InitiateMultipartUpload → returns upload_id</span></p>
        <p>PUT  /bucket/key?partNumber=1&amp;uploadId=xyz  <span className="text-gray-500">// UploadPart (body = part bytes)</span></p>
        <p>PUT  /bucket/key?partNumber=2&amp;uploadId=xyz  <span className="text-gray-500">// parts uploaded in parallel</span></p>
        <p>POST /bucket/key?uploadId=xyz            <span className="text-gray-500">// CompleteMultipartUpload (body = part list + etags)</span></p>
        <p>DELETE /bucket/key?uploadId=xyz          <span className="text-gray-500">// AbortMultipartUpload (cleanup parts)</span></p>

        <p className="text-white font-bold pt-2">// Presigned URL (generated client-side)</p>
        <p>GET /bucket/key?X-Amz-Signature=...&amp;X-Amz-Expires=3600</p>
        <p><span className="text-gray-500">// anyone with this URL can download for 1 hour, no credentials needed</span></p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Data Model                                            */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">6. Data Model</h2>
      <p className="text-gray-300 leading-relaxed">
        S3 has a <strong className="text-white">flat namespace</strong> within each bucket. The &quot;/&quot;
        in keys like &quot;photos/2024/cat.jpg&quot; is just a character -- there are no real directories.
        The LIST API simulates directories using the delimiter parameter.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Entity</th>
              <th className="py-2 px-4 text-white">Key Fields</th>
              <th className="py-2 px-4 text-white">Storage</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-blue-400">Bucket</td>
              <td className="py-2 px-4">name (globally unique), region, owner, creation date, versioning status, policy</td>
              <td className="py-2 px-4">Global metadata service</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-green-400">Object Metadata</td>
              <td className="py-2 px-4">key, version_id, size, etag (MD5), content-type, last-modified, custom headers, storage class</td>
              <td className="py-2 px-4">Sharded metadata DB (partitioned by bucket + key prefix)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4 font-medium text-yellow-400">Object Data</td>
              <td className="py-2 px-4">raw bytes, split into chunks, erasure coded</td>
              <td className="py-2 px-4">Distributed data nodes (separate from metadata)</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-medium text-purple-400">Chunk Map</td>
              <td className="py-2 px-4">object_id, chunk_index, data_node_locations, checksum</td>
              <td className="py-2 px-4">Metadata service (links objects to their physical chunks)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Key insight:</strong> Metadata and data are stored
          separately and scaled independently. The metadata path (which node has my data?) and the
          data path (read/write the actual bytes) are different systems with different bottlenecks.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- High-Level Architecture (p5)                          */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 460)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('S3 Architecture: PUT Object Flow', w / 2, 10)

      const clientX = w * 0.08
      const gwX = w * 0.28
      const metaX = w * 0.52
      const dataX = w * 0.78

      // Client
      const clientY = 80
      drawBox(p, clientX, clientY, 80, 34, [20, 40, 70], [100, 180, 255], 'Client', 10)

      // API Gateway / Load Balancer
      const gwY = 80
      drawBox(p, gwX, gwY, 110, 34, [30, 50, 40], [80, 200, 120], 'API Gateway', 10)
      p.fill(150)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('auth + routing', gwX, gwY + 20)

      // Client to gateway
      drawArrow(p, clientX + 45, clientY, gwX - 60, gwY, [100, 180, 255, 180])
      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('PUT /bucket/key', (clientX + gwX) / 2, clientY - 8)

      // Metadata Service
      const metaY = 80
      drawBox(p, metaX, metaY, 120, 34, [40, 20, 50], [180, 120, 255], 'Metadata Svc', 10)
      p.fill(150)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('key → location mapping', metaX, metaY + 20)

      // Gateway to metadata
      drawArrow(p, gwX + 60, gwY, metaX - 65, metaY, [80, 200, 120, 180])
      p.fill(80, 200, 120)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('1. allocate location', (gwX + metaX) / 2, gwY - 8)

      // Data Nodes
      const dataStartY = 160
      const nodeColors: [number, number, number][] = [
        [255, 160, 80],
        [255, 160, 80],
        [255, 160, 80],
        [180, 120, 255],
        [180, 120, 255],
      ]
      const nodeLabels = ['Data 1', 'Data 2', 'Data 3', 'Parity 1', 'Parity 2']
      const chunkLabels = ['D1', 'D2', 'D3', 'P1', 'P2']

      for (let i = 0; i < 5; i++) {
        const ny = dataStartY + i * 55
        drawBox(p, dataX, ny, 100, 36, [30, 25, 20], nodeColors[i], nodeLabels[i], 9)

        // Chunk inside
        p.fill(nodeColors[i][0], nodeColors[i][1], nodeColors[i][2], 100)
        p.noStroke()
        p.rect(dataX + 20, ny - 10, 25, 20, 3)
        p.fill(255)
        p.textSize(8)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(chunkLabels[i], dataX + 32, ny)
      }

      // Gateway to data nodes (write flow)
      for (let i = 0; i < 5; i++) {
        const ny = dataStartY + i * 55
        drawArrow(p, gwX + 30, gwY + 20, dataX - 55, ny, [255, 180, 80, 80])
        const prog = ((t * 0.5 + i * 0.15) % 1)
        drawMovingDot(p, gwX + 30, gwY + 20, dataX - 55, ny, prog, nodeColors[i], 5)
      }

      // Step labels
      p.fill(255, 180, 80)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('2. write chunks (erasure coded)', (gwX + dataX) / 2, gwY + 24)

      // Metadata to data (location info)
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([3, 3])
      drawArrow(p, metaX + 20, metaY + 20, dataX - 55, dataStartY, [180, 120, 255, 100])
      ctx.setLineDash([])

      // Metadata DB
      const metaDbY = 180
      drawBox(p, metaX, metaDbY, 120, 30, [30, 20, 40], [140, 100, 200], 'Metadata DB', 9)
      p.fill(120)
      p.textSize(7)
      p.textAlign(p.CENTER, p.TOP)
      p.text('(sharded by bucket+prefix)', metaX, metaDbY + 18)
      drawArrow(p, metaX, metaY + 20, metaX, metaDbY - 18, [180, 120, 255, 150])

      // ACK flow
      const ackY = 430
      p.fill(80, 200, 120)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('3. all chunks written → metadata committed → 200 OK to client', w / 2, ackY)

      // Checksum label
      p.fill(120)
      p.textSize(8)
      p.text('Every chunk: CRC32 checksum on write, verified on every read', w / 2, ackY + 18)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">7. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        The architecture separates the <strong className="text-white">control plane</strong> (metadata:
        where is my object?) from the <strong className="text-white">data plane</strong> (actual bytes
        stored on data nodes). This separation allows each to scale independently.
      </p>
      <P5Sketch sketch={sketch} height={460} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8a -- Deep Dive: Erasure Coding                            */
/* ================================================================== */

function ErasureCodingSection() {
  const [failedNodes, setFailedNodes] = useState<number[]>([])
  const failedRef = useRef(failedNodes)
  failedRef.current = failedNodes

  const toggleNode = (idx: number) => {
    setFailedNodes(prev => {
      if (prev.includes(idx)) return prev.filter(n => n !== idx)
      if (prev.length >= 4) return prev
      return [...prev, idx]
    })
  }

  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 380)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)
      const failed = failedRef.current

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Erasure Coding: 8 Data + 4 Parity Chunks (Reed-Solomon)', w / 2, 10)

      // Original file
      const fileY = 60
      const fileW = w * 0.6
      drawBox(p, w / 2, fileY, fileW, 30, [20, 40, 60], [100, 180, 255], 'Original File (e.g., 8 MB)', 10)

      // 12 chunks
      const chunkY = 140
      const chunkW = (w - 80) / 12 - 4
      const chunkStartX = 40
      const dataColor: [number, number, number] = [100, 180, 255]
      const parityColor: [number, number, number] = [255, 160, 80]

      for (let i = 0; i < 12; i++) {
        const cx = chunkStartX + i * (chunkW + 4) + chunkW / 2
        const isParity = i >= 8
        const isFailed = failed.includes(i)
        const baseColor = isParity ? parityColor : dataColor

        if (isFailed) {
          p.fill(60, 30, 30)
          p.stroke(255, 60, 60)
          p.strokeWeight(2)
        } else {
          p.fill(baseColor[0] * 0.25, baseColor[1] * 0.25, baseColor[2] * 0.25)
          p.stroke(baseColor[0], baseColor[1], baseColor[2])
          p.strokeWeight(1.5)
        }
        p.rect(cx - chunkW / 2, chunkY - 25, chunkW, 50, 4)

        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(8)
        if (isFailed) {
          p.fill(255, 80, 80)
          p.text('LOST', cx, chunkY - 5)
        } else {
          p.text(isParity ? `P${i - 7}` : `D${i + 1}`, cx, chunkY - 5)
        }
        p.fill(150)
        p.textSize(7)
        p.text(isParity ? 'parity' : 'data', cx, chunkY + 10)

        // Arrow from file to chunk
        drawArrow(p, w / 2 + (i - 5.5) * 15, fileY + 18, cx, chunkY - 28, [80, 80, 80, 80], 1)
      }

      // Labels
      p.fill(100, 180, 255)
      p.textSize(9)
      p.textAlign(p.LEFT, p.TOP)
      p.text('8 data chunks (1 MB each)', 40, chunkY + 35)
      p.fill(255, 160, 80)
      p.text('4 parity chunks (computed from data)', 40, chunkY + 50)

      // Status
      const statusY = chunkY + 75
      const canRecover = failed.length <= 4
      const aliveChunks = 12 - failed.length

      if (failed.length === 0) {
        p.fill(80, 200, 120)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text('All 12 chunks healthy. Click nodes above to simulate failures.', w / 2, statusY)
      } else if (canRecover) {
        p.fill(255, 200, 80)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${failed.length} chunk(s) lost. ${aliveChunks} remaining >= 8 needed. FILE RECOVERABLE.`, w / 2, statusY)

        // Show reconstruction
        const reconY = statusY + 30
        p.fill(80, 200, 120, 150 + Math.sin(t * 3) * 100)
        p.textSize(10)
        p.text('Reconstructing lost chunks from remaining data + parity...', w / 2, reconY)
      } else {
        p.fill(255, 60, 60)
        p.textSize(11)
        p.textAlign(p.CENTER, p.TOP)
        p.text(`${failed.length} chunks lost. Only ${aliveChunks} remaining < 8 needed. DATA LOST!`, w / 2, statusY)
      }

      // Comparison with 3x replication
      const compY = 280
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Erasure Coding vs 3x Replication', w / 2, compY)

      // EC box
      const ecX = w * 0.3
      const repX = w * 0.7
      const compBoxY = compY + 30

      drawBox(p, ecX, compBoxY, 180, 60, [20, 30, 50], [100, 180, 255], '', 1)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Erasure Coding (8+4)', ecX, compBoxY - 15)
      p.fill(180)
      p.textSize(8)
      p.text('Storage: 1.5x (12/8)', ecX, compBoxY)
      p.text('Tolerates: 4 failures', ecX, compBoxY + 12)
      p.fill(80, 200, 120)
      p.text('Winner: storage efficiency', ecX, compBoxY + 24)

      drawBox(p, repX, compBoxY, 180, 60, [40, 20, 20], [255, 120, 80], '', 1)
      p.fill(255)
      p.noStroke()
      p.textSize(9)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('3x Replication', repX, compBoxY - 15)
      p.fill(180)
      p.textSize(8)
      p.text('Storage: 3.0x', repX, compBoxY)
      p.text('Tolerates: 2 failures', repX, compBoxY + 12)
      p.fill(80, 200, 120)
      p.text('Winner: read speed (less compute)', repX, compBoxY + 24)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: Erasure Coding</h2>
      <p className="text-gray-300 leading-relaxed">
        Instead of storing 3 full copies (3x storage overhead), S3 uses <strong className="text-white">
        Reed-Solomon erasure coding</strong>. A file is split into K data chunks and M parity chunks.
        Any K of the K+M chunks can reconstruct the original file. Click chunks to simulate failures:
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            onClick={() => toggleNode(i)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              failedNodes.includes(i)
                ? 'bg-red-700 text-white'
                : i < 8
                  ? 'bg-blue-900 text-blue-300 hover:bg-blue-800'
                  : 'bg-orange-900 text-orange-300 hover:bg-orange-800'
            }`}
          >
            {i < 8 ? `D${i + 1}` : `P${i - 7}`}
          </button>
        ))}
        <button
          onClick={() => setFailedNodes([])}
          className="px-3 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Reset
        </button>
      </div>
      <P5Sketch sketch={sketch} height={380} />
    </section>
  )
}

/* ================================================================== */
/*  Section 8b -- Deep Dive: Metadata at Scale                         */
/* ================================================================== */

function MetadataSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 340)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Metadata Sharding: Routing by Bucket + Key Prefix', w / 2, 10)

      // Request
      const reqY = 55
      p.fill(100, 180, 255)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('GET /photos-bucket/2024/vacation/img001.jpg', 30, reqY)

      // Router
      const routerX = w / 2
      const routerY = 100
      drawBox(p, routerX, routerY, 160, 34, [30, 45, 35], [80, 200, 120], 'Metadata Router', 10)
      drawArrow(p, w * 0.35, reqY + 10, routerX - 40, routerY - 20, [100, 180, 255, 160])

      // Hash computation
      p.fill(200)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('hash("photos-bucket/2024/") → shard 7', routerX, routerY + 22)

      // Metadata shards
      const shardY = 200
      const numShards = 8
      const shardW = (w - 80) / numShards - 6
      const activeIdx = 7

      for (let i = 0; i < numShards; i++) {
        const sx = 40 + i * (shardW + 6) + shardW / 2
        const isActive = i === activeIdx
        const pulse = isActive ? Math.sin(t * 4) * 0.3 + 0.7 : 0.5

        p.fill(isActive ? 40 : 25, isActive ? 30 : 20, isActive ? 55 : 35)
        p.stroke(
          isActive ? 180 : 80,
          isActive ? 120 : 60,
          isActive ? 255 : 120,
          pulse * 255,
        )
        p.strokeWeight(isActive ? 2 : 1)
        p.rect(sx - shardW / 2, shardY - 30, shardW, 60, 5)

        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(8)
        p.text(`Shard ${i}`, sx, shardY - 12)

        // Simulated keys inside
        p.fill(120)
        p.textSize(6)
        const keyPrefixes = ['a-c/*', 'c-f/*', 'f-h/*', 'h-l/*', 'l-n/*', 'n-p/*', 'p-s/*', 's-z/*']
        p.text(keyPrefixes[i], sx, shardY + 5)

        if (isActive) {
          drawArrow(p, routerX, routerY + 20, sx, shardY - 33, [180, 120, 255, 200])
          const prog = (t * 0.6) % 1
          drawMovingDot(p, routerX, routerY + 20, sx, shardY - 33, prog, [180, 150, 255], 6)
        }
      }

      // Each shard details
      const detailY = 270
      p.fill(180)
      p.textSize(9)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Each metadata shard is itself replicated (Raft or Paxos) for fault tolerance', w / 2, detailY)
      p.text('Shards can split when they grow too large (auto-resharding)', w / 2, detailY + 16)

      // Index
      p.fill(140)
      p.textSize(8)
      p.text('Within each shard: B-tree index on (bucket, key) for O(log N) lookups and range scans (LIST)', w / 2, detailY + 38)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">9. Deep Dive: Metadata at Scale</h2>
      <p className="text-gray-300 leading-relaxed">
        Indexing trillions of objects requires sharding the metadata layer. Requests are routed to
        the correct metadata shard based on a hash of the bucket name and key prefix. This enables
        the LIST operation to efficiently scan objects with a common prefix.
      </p>
      <P5Sketch sketch={sketch} height={340} />
      <p className="text-gray-300 leading-relaxed">
        When AWS announced <strong className="text-white">strong read-after-write consistency</strong> in
        December 2020, the metadata layer was the key change. They ensured that after a PUT succeeds,
        any subsequent GET or LIST on the same key immediately reflects the write. This required
        careful coordination within the metadata replication protocol.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8c -- Deep Dive: Multipart Upload                          */
/* ================================================================== */

function MultipartSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let w = 800

    p.setup = () => {
      w = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(w, 360)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.012
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textAlign(p.CENTER, p.TOP)
      p.textSize(13)
      p.text('Multipart Upload: 5 GB File in 50 x 100 MB Parts', w / 2, 10)

      // Source file
      const fileX = w * 0.1
      const fileY = 60
      drawBox(p, fileX, fileY, 100, 30, [20, 40, 60], [100, 180, 255], '5 GB File', 10)

      // Split into parts
      const partsStartX = w * 0.25
      const partsEndX = w * 0.55
      const partY = 60
      const numPartsShown = 8
      const partW = (partsEndX - partsStartX) / numPartsShown - 2

      for (let i = 0; i < numPartsShown; i++) {
        const px = partsStartX + i * (partW + 2) + partW / 2
        const progress = ((t * 0.8 + i * 0.1) % 1)
        const uploading = progress < 0.8

        p.fill(uploading ? 40 : 25, uploading ? 50 : 45, uploading ? 30 : 35)
        p.stroke(uploading ? 80 : 80, uploading ? 200 : 200, uploading ? 120 : 120)
        p.strokeWeight(1)
        p.rect(px - partW / 2, partY - 12, partW, 24, 3)

        p.fill(255)
        p.noStroke()
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(7)
        p.text(`P${i + 1}`, px, partY)
      }

      // Ellipsis
      p.fill(150)
      p.textSize(12)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('...', partsEndX + 5, partY)
      p.textSize(8)
      p.text('x50 parts', partsEndX + 25, partY)

      // Arrow from file to parts
      drawArrow(p, fileX + 55, fileY, partsStartX - 5, partY, [100, 180, 255, 150])
      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(7)
      p.textAlign(p.CENTER, p.BOTTOM)
      p.text('split', (fileX + partsStartX) / 2 + 20, partY - 16)

      // Data nodes (upload targets)
      const nodeStartY = 140
      const nodeX = w * 0.78
      const numNodes = 5

      for (let i = 0; i < numNodes; i++) {
        const ny = nodeStartY + i * 44
        drawBox(p, nodeX, ny, 110, 30, [30, 25, 20], [255, 160, 80], `Data Node ${i + 1}`, 9)
      }

      // Parallel upload arrows
      for (let i = 0; i < numPartsShown; i++) {
        const px = partsStartX + i * (partW + 2) + partW / 2
        const targetNode = i % numNodes
        const ny = nodeStartY + targetNode * 44
        const prog = ((t * 0.5 + i * 0.12) % 1)

        drawArrow(p, px, partY + 14, nodeX - 60, ny, [80, 200, 120, 60], 1)
        drawMovingDot(p, px, partY + 14, nodeX - 60, ny, prog, [80, 255, 120], 5)
      }

      // Upload label
      p.fill(80, 200, 120)
      p.noStroke()
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('parallel upload to different nodes', (partsEndX + nodeX) / 2 - 30, 110)

      // Completion step
      const completeY = 330
      p.fill(255)
      p.textSize(10)
      p.textAlign(p.CENTER, p.TOP)
      p.text('CompleteMultipartUpload: assemble parts into final object', w / 2, completeY - 40)

      // Retry scenario
      p.fill(255, 130, 80)
      p.textSize(8)
      p.text('Failed part? Retry only that part (not entire file). Each part has its own ETag for verification.', w / 2, completeY - 20)

      // Benefits
      p.fill(140)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Benefits: parallel throughput, resumable uploads, 5 TB max (10K parts x 5 GB each)', w / 2, completeY)
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">10. Deep Dive: Multipart Upload</h2>
      <p className="text-gray-300 leading-relaxed">
        For large objects, S3 supports splitting a file into parts (each 5MB-5GB), uploading them in
        parallel to different data nodes, and then assembling them into a single object. This maximizes
        throughput and enables resumable uploads.
      </p>
      <P5Sketch sketch={sketch} height={360} />
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Practical tip:</strong> Any upload over 100 MB should use
          multipart. AWS SDKs do this automatically. The maximum number of parts is 10,000, so with
          5 GB parts, the maximum object size is ~50 TB (though S3 caps at 5 TB). Incomplete multipart
          uploads consume storage until aborted -- always set lifecycle policies to auto-abort stale uploads.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 -- Scaling Strategy                                      */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">11. Scaling Strategy</h2>

      <h3 className="text-lg font-semibold text-blue-400">Data Plane Scaling</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li>Add more data nodes for storage capacity (linear scaling)</li>
        <li>Each node stores chunks independently -- no node needs to know about other nodes</li>
        <li>When a node is added, existing data is <em>not</em> rebalanced (new objects go to new nodes)</li>
        <li>Background repair process re-replicates chunks from failed nodes</li>
      </ul>

      <h3 className="text-lg font-semibold text-green-400 pt-4">Metadata Plane Scaling</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
        <li>Shard metadata by bucket + key prefix hash</li>
        <li>Automatic shard splitting when a shard grows too large</li>
        <li>Each shard replicated via Raft/Paxos for durability</li>
        <li>Hot partitions (popular prefixes) can be further split</li>
      </ul>

      <h3 className="text-lg font-semibold text-yellow-400 pt-4">Request Scaling</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-4 text-white">Dimension</th>
              <th className="py-2 px-4 text-white">How It Scales</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">GET throughput</td>
              <td className="py-2 px-4">CDN (CloudFront) for hot objects; more data nodes for cold reads</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">PUT throughput</td>
              <td className="py-2 px-4">S3 auto-partitions by key prefix; randomize prefixes to avoid hotspots</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-4">LIST throughput</td>
              <td className="py-2 px-4">Metadata sharding; parallel prefix scans within shards</td>
            </tr>
            <tr>
              <td className="py-2 px-4">Cross-region</td>
              <td className="py-2 px-4">Cross-Region Replication (CRR): async copy objects to another region</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 -- Fault Tolerance                                      */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">12. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Data node fails</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            With 8+4 erasure coding, the system can tolerate up to 4 simultaneous chunk losses per object.
            When a node fails, the repair process reads the remaining chunks from healthy nodes,
            reconstructs the missing chunks, and writes them to new nodes. Repair must complete before
            additional failures occur -- this is why repair speed is critical.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Entire availability zone fails</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Chunks are distributed across at least 3 AZs within a region. If one AZ goes down (1/3 of
            chunks), the object is still readable from the remaining 2/3 of chunks (8 of 12, which is
            exactly enough for 8+4 coding). The system continues serving reads while repairing.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-red-900/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold text-sm mb-2">Scenario: Silent data corruption (bit rot)</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Every chunk has a CRC32 checksum verified on every read. If a checksum fails, the chunk is
            treated as lost and reconstructed from other chunks. Background scrubbing periodically reads
            and verifies all chunks even when they are not being accessed by users.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-green-900/50 rounded-lg p-4">
          <h3 className="text-green-400 font-semibold text-sm mb-2">Durability math</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            With 8+4 erasure coding across 3 AZs, 4-hour repair time, and 0.1% annual disk failure rate:
            the probability of losing 5+ chunks simultaneously before repair completes is approximately
            10^-12 per object per year. With 100 billion objects, you expect to lose about 0.1 objects
            per year. This is 11 nines of durability.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 -- Tradeoffs & Design Choices                           */
/* ================================================================== */

function TradeoffsSection() {
  const tradeoffs = [
    {
      chose: 'Erasure coding (Reed-Solomon)',
      over: '3x replication',
      because: 'Erasure coding uses 1.5x storage instead of 3x, saving petabytes at scale. The cost is CPU overhead for encoding/decoding and higher read latency (must read from K nodes instead of 1). At S3 scale, the storage savings dominate.',
      color: 'border-blue-600',
    },
    {
      chose: 'Strong read-after-write consistency',
      over: 'Eventual consistency (pre-2020)',
      because: 'Eventual consistency caused bugs: PUT an object, immediately GET it, get 404. Strong consistency eliminates this entire class of bugs. The cost was significant engineering effort in the metadata layer, but no measurable performance impact.',
      color: 'border-green-600',
    },
    {
      chose: 'Flat namespace within buckets',
      over: 'Hierarchical filesystem',
      because: 'A flat namespace is simpler to shard (hash the key), simpler to replicate, and avoids directory locking. The "/" in keys is just a convention. LIST with prefix+delimiter simulates directories when needed.',
      color: 'border-yellow-600',
    },
    {
      chose: 'Separate metadata and data planes',
      over: 'Co-located metadata and data',
      because: 'Metadata operations (LIST, HEAD) have very different access patterns than data operations (GET, PUT large objects). Separating them allows independent scaling and optimization. Metadata nodes use SSDs with B-trees; data nodes use high-density HDDs.',
      color: 'border-purple-600',
    },
    {
      chose: 'Immutable objects (replace = new version)',
      over: 'Mutable objects (in-place update)',
      because: 'Immutability simplifies everything: no partial updates, no write locks, no inconsistent reads during updates. Want to change an object? Upload a new version. This also enables versioning naturally.',
      color: 'border-red-600',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">13. Tradeoffs and Design Choices</h2>
      <div className="space-y-4">
        {tradeoffs.map((tr, i) => (
          <div key={i} className={`bg-gray-800/60 border-l-4 ${tr.color} rounded-r-lg p-4`}>
            <p className="text-white font-semibold text-sm">
              Chose: <span className="text-green-400">{tr.chose}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Over: <span className="text-red-400">{tr.over}</span>
            </p>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              {tr.because}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-yellow-400">Final thought:</strong> S3 succeeds because it makes a
          simple promise and keeps it: <em>store any bytes, get them back, never lose them</em>. The
          interface is trivially simple (PUT/GET/DELETE over HTTP), but the machinery behind it --
          erasure coding, metadata sharding, cross-AZ replication, background repair, checksum
          verification -- is extraordinarily complex. The best infrastructure is invisible.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignS3() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Design S3 (Object Storage)</h1>
        <p className="text-lg text-gray-400">
          A system design deep dive into distributed object storage. How to achieve 11 nines of
          durability with erasure coding, index trillions of objects with sharded metadata, and
          handle 5 TB uploads with multipart parallelism.
        </p>
      </header>

      <ProblemStatementSection />
      <FunctionalRequirementsSection />
      <NonFunctionalRequirementsSection />
      <EnvelopeSection />
      <APIDesignSection />
      <DataModelSection />
      <ArchitectureSection />
      <ErasureCodingSection />
      <MetadataSection />
      <MultipartSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
    </div>
  )
}
