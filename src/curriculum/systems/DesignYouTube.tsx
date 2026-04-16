import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/design-youtube',
  title: 'Design YouTube (Video Platform)',
  description:
    'System design case study: video upload, transcoding pipeline, adaptive bitrate streaming, CDN delivery, and view counting at YouTube scale',
  track: 'systems',
  order: 18,
  tags: [
    'system-design',
    'video-streaming',
    'transcoding',
    'cdn',
    'adaptive-bitrate',
    'hls',
    'youtube',
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
  const lines = label.split('\n')
  for (let i = 0; i < lines.length; i++) {
    p.text(lines[i], x, y + (i - (lines.length - 1) / 2) * (labelSize + 2))
  }
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
  weight = 1.5,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 7
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

function drawDot(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: [number, number, number],
  size = 6,
) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  p.fill(color[0], color[1], color[2])
  p.noStroke()
  p.ellipse(x, y, size, size)
}

/* ================================================================== */
/*  Section 1 — Problem Statement & Requirements                       */
/* ================================================================== */

function ProblemSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">1. Problem Statement</h2>
      <p className="text-gray-300 leading-relaxed">
        Design a video sharing platform like YouTube that allows users to upload, process, store,
        and stream video content at massive global scale. The system must handle 500 hours of video
        uploaded every minute, serve over 1 billion daily video views, and deliver a smooth playback
        experience regardless of the viewer's device or network conditions.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6">Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Upload videos up to 10GB with resumable chunked uploads</li>
        <li>Transcode videos to multiple resolutions (240p, 360p, 480p, 720p, 1080p, 4K)</li>
        <li>Adaptive bitrate streaming (HLS/DASH) for smooth playback</li>
        <li>Video metadata: title, description, tags, thumbnails</li>
        <li>Full-text search across video metadata</li>
        <li>Personalized recommendation feed</li>
        <li>Comments, likes, view counts</li>
        <li>Subscriptions and notifications</li>
      </ul>

      <h3 className="text-xl font-semibold text-white mt-6">Non-Functional Requirements</h3>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>Fast upload with resume on failure (no re-uploading from scratch)</li>
        <li>Low-latency playback start: under 2 seconds to first frame</li>
        <li>Global CDN for content delivery close to viewers</li>
        <li>99.9% availability (less than 8.8 hours of downtime per year)</li>
        <li>Handle 1 billion daily views (approximately 12,000 views per second)</li>
        <li>Eventual consistency acceptable for view counts and recommendations</li>
      </ul>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 — Back-of-Envelope Calculations                          */
/* ================================================================== */

function EnvelopeSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">2. Back-of-Envelope Calculations</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Upload Volume</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>500 hours of video uploaded per minute</li>
          <li>= 30,000 hours/hour = 720,000 hours/day</li>
          <li>Average video length: 10 minutes {'\u2192'} ~4.3M videos uploaded per day</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Storage Per Video</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>Original upload: ~1GB (average for a 10-min video)</li>
          <li>Transcoded versions: 240p(50MB) + 360p(100MB) + 480p(200MB) + 720p(500MB) + 1080p(1GB) + 4K(3GB) {'\u2248'} 5GB total</li>
          <li>Thumbnails: ~500KB per video (multiple sizes)</li>
          <li>Total per video: ~5GB across all resolutions</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">Daily Storage Growth</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>4.3M videos/day x 5GB = ~21.5 PB/day of new storage</li>
          <li>Annual growth: ~7.8 EB (exabytes)</li>
        </ul>

        <h4 className="text-white font-semibold mt-4">CDN Bandwidth</h4>
        <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc list-inside">
          <li>1B views/day, average view duration 5 min at 720p (~2.5 Mbps)</li>
          <li>= 1B x 5 min x 60s x 2.5 Mbps / 8 = ~937 PB/day outbound</li>
          <li>Peak: ~12K views/sec x 2.5 Mbps = 30 Tbps aggregate bandwidth</li>
        </ul>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 3 — API Design                                             */
/* ================================================================== */

function APISection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">3. API Design</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/videos</code>
          <p className="text-gray-400 text-sm mt-1">
            Initiate a chunked upload. Returns upload_id and presigned URLs for each chunk.
            Body: {'{'} title, description, tags, file_size, content_type {'}'}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">PUT /api/v1/videos/:upload_id/chunks/:chunk_number</code>
          <p className="text-gray-400 text-sm mt-1">
            Upload a single chunk (e.g., 5MB). Idempotent {'\u2014'} safe to retry on failure.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/videos/:upload_id/complete</code>
          <p className="text-gray-400 text-sm mt-1">
            Signal all chunks uploaded. Triggers transcoding pipeline.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/videos/:id</code>
          <p className="text-gray-400 text-sm mt-1">
            Video metadata: title, description, duration, thumbnail_url, resolutions[], view_count, status.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/videos/:id/stream?quality=720p</code>
          <p className="text-gray-400 text-sm mt-1">
            Returns HLS manifest (.m3u8) with segment URLs. Client uses adaptive bitrate logic.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/search?q=term&page=1</code>
          <p className="text-gray-400 text-sm mt-1">
            Full-text search across video titles, descriptions, tags. Returns ranked results.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">GET /api/v1/feed</code>
          <p className="text-gray-400 text-sm mt-1">
            Personalized recommendation feed based on watch history, subscriptions, and trending.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <code className="text-green-400 text-sm">POST /api/v1/videos/:id/comments</code>
          <p className="text-gray-400 text-sm mt-1">
            Add a comment. Body: {'{'} text, parent_comment_id? {'}'}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 4 — Data Model                                             */
/* ================================================================== */

function DataModelSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">4. Data Model</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Video</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: UUID,
  uploader_id: UUID,
  title: string,
  description: text,
  tags: string[],
  status: "uploading" | "processing"
        | "ready" | "failed",
  duration_sec: int,
  resolutions: [
    { quality: "720p",
      url: "s3://bucket/vid/720p/",
      size_bytes: int }
  ],
  thumbnail_url: string,
  view_count: bigint,
  like_count: int,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">User</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: UUID,
  username: string,
  email: string,
  channel_name: string,
  subscriber_count: int,
  created_at: timestamp
}`}</pre>
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2 mt-4">Subscription</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  subscriber_id: UUID,
  channel_id: UUID,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">Comment</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  id: UUID,
  video_id: UUID,
  user_id: UUID,
  text: string,
  parent_id: UUID | null,
  like_count: int,
  created_at: timestamp
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-mono text-sm font-semibold mb-2">ViewEvent</h4>
          <pre className="text-gray-300 text-xs leading-relaxed">{`{
  video_id: UUID,
  user_id: UUID | null,
  watch_duration_sec: int,
  quality: string,
  timestamp: datetime,
  country: string,
  device: string
}`}</pre>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 — High-Level Architecture (p5 animated)                  */
/* ================================================================== */

function ArchitectureSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 520

    interface Packet {
      progress: number
      fromX: number
      fromY: number
      toX: number
      toY: number
      color: [number, number, number]
      speed: number
    }
    const packets: Packet[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('YouTube High-Level Architecture', canvasW / 2, 8)

      // Layout positions
      const clientX = canvasW * 0.08
      const lbX = canvasW * 0.22
      const uploadX = canvasW * 0.38
      const queueX = canvasW * 0.54
      const transcodeX = canvasW * 0.72
      const storageX = canvasW * 0.90

      const uploadY = 100
      const streamY = 250
      const metaY = 400

      // ---- Upload path (top row) ----
      drawBox(p, clientX, uploadY, 70, 36, [30, 30, 50], [120, 120, 200], 'Client\n(Upload)', 9)
      drawBox(p, lbX, uploadY, 70, 36, [30, 40, 30], [100, 200, 100], 'Load\nBalancer', 9)
      drawBox(p, uploadX, uploadY, 76, 36, [30, 30, 50], [99, 102, 241], 'Upload\nService', 9)
      drawBox(p, queueX, uploadY, 76, 36, [50, 40, 20], [220, 170, 60], 'Message\nQueue', 9)
      drawBox(p, transcodeX, uploadY, 80, 36, [50, 20, 20], [236, 72, 153], 'Transcode\nWorkers', 9)
      drawBox(p, storageX, uploadY, 76, 36, [20, 40, 50], [52, 211, 153], 'Object\nStorage (S3)', 9)

      // Arrows for upload path
      drawArrow(p, clientX + 35, uploadY, lbX - 35, uploadY, [120, 120, 200, 160])
      drawArrow(p, lbX + 35, uploadY, uploadX - 38, uploadY, [100, 200, 100, 160])
      drawArrow(p, uploadX + 38, uploadY, queueX - 38, uploadY, [99, 102, 241, 160])
      drawArrow(p, queueX + 38, uploadY, transcodeX - 40, uploadY, [220, 170, 60, 160])
      drawArrow(p, transcodeX + 40, uploadY, storageX - 38, uploadY, [236, 72, 153, 160])

      // Label
      p.fill(180)
      p.textSize(8)
      p.textAlign(p.CENTER, p.TOP)
      p.text('chunked upload', (clientX + lbX) / 2, uploadY + 22)
      p.text('enqueue job', (uploadX + queueX) / 2, uploadY + 22)
      p.text('parallel transcode', (queueX + transcodeX) / 2, uploadY + 22)
      p.text('store segments', (transcodeX + storageX) / 2, uploadY + 22)

      // ---- Streaming path (middle row) ----
      const cdnX = canvasW * 0.54
      const streamSvcX = canvasW * 0.72
      drawBox(p, clientX, streamY, 70, 36, [30, 30, 50], [120, 120, 200], 'Client\n(Player)', 9)
      drawBox(p, lbX, streamY, 70, 36, [30, 40, 30], [100, 200, 100], 'CDN\nEdge', 9)
      drawBox(p, cdnX, streamY, 76, 36, [40, 30, 50], [180, 100, 220], 'CDN\nOrigin', 9)
      drawBox(p, streamSvcX, streamY, 80, 36, [30, 30, 50], [99, 102, 241], 'Streaming\nService', 9)
      drawBox(p, storageX, streamY, 76, 36, [20, 40, 50], [52, 211, 153], 'Object\nStorage (S3)', 9)

      drawArrow(p, clientX + 35, streamY, lbX - 35, streamY, [120, 120, 200, 160])
      drawArrow(p, lbX + 35, streamY, cdnX - 38, streamY, [100, 200, 100, 160])
      drawArrow(p, cdnX + 38, streamY, streamSvcX - 40, streamY, [180, 100, 220, 120])
      drawArrow(p, streamSvcX + 40, streamY, storageX - 38, streamY, [99, 102, 241, 120])

      p.fill(180)
      p.textSize(8)
      p.text('cache hit (99%)', (lbX + cdnX) / 2, streamY + 22)
      p.text('cache miss', (cdnX + streamSvcX) / 2, streamY + 22)

      // ---- Metadata path (bottom row) ----
      const metaDbX = canvasW * 0.54
      const searchX = canvasW * 0.72
      const recoX = canvasW * 0.90
      drawBox(p, clientX, metaY, 70, 36, [30, 30, 50], [120, 120, 200], 'Client\n(App)', 9)
      drawBox(p, lbX, metaY, 70, 36, [30, 40, 30], [100, 200, 100], 'API\nGateway', 9)
      drawBox(p, uploadX, metaY, 76, 36, [30, 30, 50], [99, 102, 241], 'Metadata\nService', 9)
      drawBox(p, metaDbX, metaY, 76, 36, [40, 30, 20], [200, 160, 80], 'PostgreSQL\n(sharded)', 9)
      drawBox(p, searchX, metaY, 76, 36, [20, 40, 40], [80, 200, 200], 'Elastic\nsearch', 9)
      drawBox(p, recoX, metaY, 76, 36, [40, 20, 40], [200, 100, 200], 'Reco\nService', 9)

      drawArrow(p, clientX + 35, metaY, lbX - 35, metaY, [120, 120, 200, 160])
      drawArrow(p, lbX + 35, metaY, uploadX - 38, metaY, [100, 200, 100, 160])
      drawArrow(p, uploadX + 38, metaY, metaDbX - 38, metaY, [99, 102, 241, 160])
      drawArrow(p, uploadX, metaY - 18, searchX, metaY - 18, [80, 200, 200, 120])
      drawArrow(p, lbX, metaY + 18, recoX, metaY + 18, [200, 100, 200, 100])

      p.fill(180)
      p.textSize(8)
      p.text('search index', (uploadX + searchX) / 2, metaY - 30)

      // Row labels
      p.fill(100)
      p.textSize(9)
      p.textAlign(p.LEFT, p.CENTER)
      p.text('UPLOAD PATH', 10, uploadY - 30)
      p.text('STREAMING PATH', 10, streamY - 30)
      p.text('METADATA PATH', 10, metaY - 30)

      // Dashed separators
      const ctx = p.drawingContext as CanvasRenderingContext2D
      ctx.setLineDash([4, 4])
      p.stroke(60)
      p.strokeWeight(1)
      p.line(0, (uploadY + streamY) / 2 - 10, canvasW, (uploadY + streamY) / 2 - 10)
      p.line(0, (streamY + metaY) / 2 - 10, canvasW, (streamY + metaY) / 2 - 10)
      ctx.setLineDash([])

      // Animated packets on upload path
      if (Math.random() < 0.03) {
        packets.push({
          progress: 0,
          fromX: clientX + 35, fromY: uploadY,
          toX: storageX - 38, toY: uploadY,
          color: [99, 102, 241],
          speed: 0.004 + Math.random() * 0.003,
        })
      }
      // Animated packets on streaming path
      if (Math.random() < 0.06) {
        packets.push({
          progress: 0,
          fromX: storageX - 38, fromY: streamY,
          toX: clientX + 35, toY: streamY,
          color: [52, 211, 153],
          speed: 0.006 + Math.random() * 0.004,
        })
      }

      for (let i = packets.length - 1; i >= 0; i--) {
        const pkt = packets[i]
        pkt.progress += pkt.speed
        if (pkt.progress > 1) {
          packets.splice(i, 1)
          continue
        }
        drawDot(p, pkt.fromX, pkt.fromY, pkt.toX, pkt.toY, pkt.progress, pkt.color, 5)
      }
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">5. High-Level Architecture</h2>
      <p className="text-gray-300 leading-relaxed">
        The system splits into three major paths: the <strong className="text-white">upload path</strong> (write-heavy,
        asynchronous), the <strong className="text-white">streaming path</strong> (read-heavy, latency-critical),
        and the <strong className="text-white">metadata path</strong> (search, recommendations, social features).
        The upload path is 1,000x less traffic than the streaming path {'\u2014'} the system is overwhelmingly read-heavy.
      </p>
      <P5Sketch sketch={sketch} />
      <p className="text-gray-400 text-sm italic">
        Blue dots: video chunks flowing through the upload pipeline. Green dots: video segments streaming to clients via CDN.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 6 — Deep Dive: Transcoding Pipeline (p5)                   */
/* ================================================================== */

function TranscodingSection() {
  const [workers, setWorkers] = useState(4)
  const workersRef = useRef(workers)
  workersRef.current = workers

  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 480

    const resolutions = ['240p', '360p', '480p', '720p', '1080p']
    const resColors: [number, number, number][] = [
      [100, 200, 100],
      [80, 160, 255],
      [220, 170, 60],
      [236, 72, 153],
      [150, 100, 255],
    ]

    interface Chunk {
      resIdx: number
      progress: number
      workerIdx: number
      done: boolean
    }
    const chunks: Chunk[] = []
    let pipelineStage = 0 // 0=waiting, 1=splitting, 2=transcoding, 3=assembling, 4=done
    let stageTimer = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
      resetPipeline()
    }

    function resetPipeline() {
      chunks.length = 0
      pipelineStage = 0
      stageTimer = 0
      for (let r = 0; r < resolutions.length; r++) {
        chunks.push({ resIdx: r, progress: 0, workerIdx: r % workersRef.current, done: false })
      }
    }

    p.draw = () => {
      t += 0.016
      stageTimer += 0.016
      p.background(15, 15, 25)

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Video Transcoding Pipeline (DAG)', canvasW / 2, 8)

      const numWorkers = workersRef.current
      const stageNames = ['Upload Complete', 'Split into Segments', 'Parallel Transcode', 'Reassemble + Thumbnails', 'Ready to Stream']

      // Auto-advance stages
      if (pipelineStage === 0 && stageTimer > 1.5) { pipelineStage = 1; stageTimer = 0 }
      if (pipelineStage === 1 && stageTimer > 2) { pipelineStage = 2; stageTimer = 0 }
      if (pipelineStage === 3 && stageTimer > 2) { pipelineStage = 4; stageTimer = 0 }
      if (pipelineStage === 4 && stageTimer > 2) { resetPipeline() }

      // During transcoding, advance progress
      if (pipelineStage === 2) {
        let allDone = true
        for (const c of chunks) {
          if (!c.done) {
            c.progress += 0.008 + (c.workerIdx < numWorkers ? 0.004 : 0)
            if (c.progress >= 1) { c.done = true; c.progress = 1 }
            else { allDone = false }
          }
        }
        if (allDone) { pipelineStage = 3; stageTimer = 0 }
      }

      // Draw DAG stages as columns
      const colX = [0.08, 0.26, 0.52, 0.76, 0.93]
      const stageY = 60

      for (let i = 0; i < 5; i++) {
        const x = colX[i] * canvasW
        const isActive = i === pipelineStage
        const isPast = i < pipelineStage
        const alpha = isActive ? 255 : isPast ? 180 : 80
        p.fill(255, 255, 255, alpha)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(stageNames[i], x, stageY)

        // Stage indicator
        p.fill(isActive ? 52 : isPast ? 52 : 60, isActive ? 211 : isPast ? 211 : 60, isActive ? 153 : isPast ? 153 : 60, alpha)
        p.ellipse(x, stageY + 16, 8, 8)

        if (i < 4) {
          const ctx = p.drawingContext as CanvasRenderingContext2D
          ctx.setLineDash([3, 3])
          p.stroke(80, 80, 80, alpha)
          p.strokeWeight(1)
          p.line(x + 30, stageY + 16, colX[i + 1] * canvasW - 30, stageY + 16)
          ctx.setLineDash([])
          p.noStroke()
        }
      }

      // Draw the input video
      const inputX = colX[0] * canvasW
      const inputY = 130
      p.fill(40, 40, 60)
      p.stroke(99, 102, 241)
      p.strokeWeight(1.5)
      p.rect(inputX - 30, inputY, 60, 40, 4)
      p.fill(99, 102, 241)
      p.noStroke()
      p.textSize(8)
      p.text('Original', inputX, inputY + 14)
      p.text('Video', inputX, inputY + 26)

      // Draw worker pods
      const workerY0 = 120
      const workerH = Math.min(60, (canvasH - workerY0 - 80) / resolutions.length)
      const workerX = colX[2] * canvasW

      for (let r = 0; r < resolutions.length; r++) {
        const wy = workerY0 + r * workerH
        const c = chunks[r]
        const col = resColors[r]

        // Worker box
        p.fill(col[0] * 0.15, col[1] * 0.15, col[2] * 0.15)
        p.stroke(col[0], col[1], col[2], 150)
        p.strokeWeight(1)
        const boxW = canvasW * 0.22
        p.rect(workerX - boxW / 2, wy, boxW, workerH - 6, 4)

        // Progress bar
        if (pipelineStage >= 2) {
          p.fill(col[0], col[1], col[2], 60)
          p.noStroke()
          p.rect(workerX - boxW / 2 + 2, wy + 2, (boxW - 4) * c.progress, workerH - 10, 3)
        }

        // Label
        p.fill(255)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`Worker ${c.workerIdx} ${'\u2192'} ${resolutions[r]}`, workerX, wy + (workerH - 6) / 2)

        // Arrow from input to worker
        if (pipelineStage >= 1) {
          drawArrow(p, inputX + 30, inputY + 20, workerX - boxW / 2, wy + (workerH - 6) / 2, [col[0], col[1], col[2], 100])
        }

        // Arrow from worker to output
        if (pipelineStage >= 3) {
          const outputX = colX[3] * canvasW
          drawArrow(p, workerX + boxW / 2, wy + (workerH - 6) / 2, outputX - 35, 150 + r * 30, [col[0], col[1], col[2], 100])
        }
      }

      // Output / reassembled
      if (pipelineStage >= 3) {
        const outputX = colX[3] * canvasW
        for (let r = 0; r < resolutions.length; r++) {
          const oy = 140 + r * 30
          p.fill(resColors[r][0] * 0.2, resColors[r][1] * 0.2, resColors[r][2] * 0.2)
          p.stroke(resColors[r][0], resColors[r][1], resColors[r][2], 120)
          p.strokeWeight(1)
          p.rect(outputX - 28, oy, 56, 22, 3)
          p.fill(255)
          p.noStroke()
          p.textSize(8)
          p.text(resolutions[r], outputX, oy + 11)
        }

        // Thumbnail
        p.fill(40, 40, 60)
        p.stroke(200, 200, 100, 120)
        p.strokeWeight(1)
        p.rect(outputX - 20, 140 + resolutions.length * 30 + 5, 40, 24, 3)
        p.fill(200, 200, 100)
        p.noStroke()
        p.textSize(7)
        p.text('Thumbnail', outputX, 140 + resolutions.length * 30 + 17)
      }

      // Final storage
      if (pipelineStage >= 4) {
        const finalX = colX[4] * canvasW
        drawBox(p, finalX, 200, 60, 40, [20, 40, 50], [52, 211, 153], 'S3\nBucket', 9)
        p.fill(52, 211, 153)
        p.textSize(8)
        p.text('READY', finalX, 230)
      }

      // Status text
      p.fill(180)
      p.textSize(10)
      p.textAlign(p.LEFT, p.BOTTOM)
      p.text(`Stage: ${stageNames[pipelineStage]}  |  Workers: ${numWorkers}`, 10, canvasH - 10)
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">6. Deep Dive: Transcoding Pipeline</h2>
      <p className="text-gray-300 leading-relaxed">
        When a video upload completes, it enters a DAG (directed acyclic graph) processing pipeline.
        The video is split into segments, and each segment is transcoded to all target resolutions in parallel
        by worker pods. A thumbnail is extracted, and all outputs are uploaded to object storage. The DAG ensures
        that the video status only transitions to "ready" when every resolution has been processed.
      </p>
      <div className="flex items-center gap-4 mb-2">
        <label className="text-gray-300 text-sm">Worker count:</label>
        <input
          type="range" min={1} max={5} value={workers}
          onChange={e => setWorkers(Number(e.target.value))}
          className="w-32"
        />
        <span className="text-white text-sm font-mono">{workers}</span>
      </div>
      <P5Sketch sketch={sketch} />
      <div className="bg-gray-800 border-l-4 border-indigo-500 rounded-r-lg p-4">
        <p className="text-white font-medium text-sm">Why parallel transcoding matters</p>
        <p className="text-gray-300 text-sm mt-1">
          A 10-minute 4K video takes ~30 minutes to transcode on a single core. With parallel workers processing
          each resolution independently, total wall-clock time drops to the slowest resolution (4K). Auto-scaling
          workers based on queue depth ensures upload spikes (e.g., after a major event) don't create a processing backlog.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 — Deep Dive: Adaptive Bitrate Streaming (p5)             */
/* ================================================================== */

function ABRSection() {
  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 420

    // Simulate bandwidth over time
    let bandwidth = 8 // Mbps
    const segments: { quality: string; color: [number, number, number]; x: number }[] = []
    let nextSegmentTime = 0

    const qualityLevels = [
      { name: '240p', minBw: 0, color: [100, 100, 100] as [number, number, number] },
      { name: '480p', minBw: 2, color: [220, 170, 60] as [number, number, number] },
      { name: '720p', minBw: 4, color: [80, 160, 255] as [number, number, number] },
      { name: '1080p', minBw: 8, color: [52, 211, 153] as [number, number, number] },
      { name: '4K', minBw: 15, color: [236, 72, 153] as [number, number, number] },
    ]

    // Bandwidth history for graph
    const bwHistory: number[] = []

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    function pickQuality(bw: number): typeof qualityLevels[0] {
      let best = qualityLevels[0]
      for (const q of qualityLevels) {
        if (bw >= q.minBw) best = q
      }
      return best
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      // Simulate fluctuating bandwidth
      bandwidth = 8 + 6 * Math.sin(t * 0.5) + 4 * Math.sin(t * 1.3) + 2 * Math.sin(t * 3.1)
      bandwidth = Math.max(0.5, bandwidth)
      bwHistory.push(bandwidth)
      if (bwHistory.length > 300) bwHistory.shift()

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Adaptive Bitrate Streaming (HLS/DASH)', canvasW / 2, 8)

      // ---- Bandwidth graph (top half) ----
      const graphX = 60
      const graphY = 40
      const graphW = canvasW - 120
      const graphH = 140

      // Background
      p.fill(20, 20, 35)
      p.noStroke()
      p.rect(graphX, graphY, graphW, graphH, 4)

      // Threshold lines
      for (const q of qualityLevels) {
        if (q.minBw === 0) continue
        const y = graphY + graphH - (q.minBw / 20) * graphH
        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([3, 3])
        p.stroke(q.color[0], q.color[1], q.color[2], 60)
        p.strokeWeight(1)
        p.line(graphX, y, graphX + graphW, y)
        ctx.setLineDash([])
        p.fill(q.color[0], q.color[1], q.color[2], 120)
        p.noStroke()
        p.textSize(7)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(q.name, graphX - 4, y)
      }

      // Bandwidth line
      p.noFill()
      p.strokeWeight(2)
      const currentQ = pickQuality(bandwidth)
      for (let i = 1; i < bwHistory.length; i++) {
        const x1 = graphX + ((i - 1) / 300) * graphW
        const x2 = graphX + (i / 300) * graphW
        const y1 = graphY + graphH - (bwHistory[i - 1] / 20) * graphH
        const y2 = graphY + graphH - (bwHistory[i] / 20) * graphH
        const bw = bwHistory[i]
        const col = bw > 8 ? [52, 211, 153] : bw > 4 ? [80, 160, 255] : bw > 2 ? [220, 170, 60] : [236, 72, 100]
        p.stroke(col[0], col[1], col[2], 200)
        p.line(x1, y1, x2, y2)
      }

      // Current bandwidth label
      p.fill(255)
      p.noStroke()
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Bandwidth: ${bandwidth.toFixed(1)} Mbps`, graphX, graphY + graphH + 6)
      p.fill(currentQ.color[0], currentQ.color[1], currentQ.color[2])
      p.text(`Selected: ${currentQ.name}`, graphX + 200, graphY + graphH + 6)

      // ---- Segment timeline (bottom half) ----
      const segY = graphY + graphH + 40
      const segH = 50

      p.fill(255, 200)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Video segments requested over time:', graphX, segY - 14)

      // Generate segments
      if (t > nextSegmentTime) {
        const q = pickQuality(bandwidth)
        segments.push({ quality: q.name, color: q.color, x: graphX + graphW })
        nextSegmentTime = t + 0.5
      }

      // Draw and scroll segments
      const segW = 24
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i]
        seg.x -= 1.2
        if (seg.x < graphX - segW) { segments.splice(i, 1); continue }
        p.fill(seg.color[0], seg.color[1], seg.color[2], 180)
        p.noStroke()
        p.rect(seg.x, segY, segW - 2, segH, 3)
        p.fill(255)
        p.textSize(7)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(seg.quality, seg.x + segW / 2 - 1, segY + segH / 2)
      }

      // ---- HLS Manifest concept ----
      const manifestY = segY + segH + 30
      p.fill(255, 200)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('HLS Master Manifest (.m3u8):', graphX, manifestY)

      p.fill(30, 30, 45)
      p.noStroke()
      p.rect(graphX, manifestY + 16, graphW, 90, 4)

      p.fill(150, 150, 180)
      p.textSize(8)
      p.textAlign(p.LEFT, p.TOP)
      const manifest = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=426x240',
        '  /stream/video_id/240p/playlist.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=854x480',
        '  /stream/video_id/480p/playlist.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1280x720',
        '  /stream/video_id/720p/playlist.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080',
        '  /stream/video_id/1080p/playlist.m3u8',
      ]
      for (let i = 0; i < manifest.length; i++) {
        const line = manifest[i]
        p.fill(line.startsWith('#') ? 120 : line.startsWith('  ') ? 80 : 150, line.startsWith('#') ? 150 : 200, line.startsWith('#') ? 180 : 150)
        p.text(line, graphX + 8, manifestY + 20 + i * 10)
      }
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">7. Deep Dive: Adaptive Bitrate Streaming</h2>
      <p className="text-gray-300 leading-relaxed">
        The client does not download the entire video at one quality. Instead, it requests small segments (2-10 seconds each)
        and dynamically switches quality based on current bandwidth. When bandwidth is high, it fetches 1080p or 4K segments.
        When bandwidth drops, it falls back to 480p or 240p to avoid buffering. This is the core idea behind
        HLS (HTTP Live Streaming) and DASH (Dynamic Adaptive Streaming over HTTP).
      </p>
      <P5Sketch sketch={sketch} />
      <p className="text-gray-400 text-sm italic">
        Watch the bandwidth fluctuate (top graph) and see how the client adapts its quality selection (colored segments below).
        The master manifest lists all available quality levels with their bandwidth requirements.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 8 — Deep Dive: View Counting at Scale (p5)                 */
/* ================================================================== */

function ViewCountSection() {
  const [batchMode, setBatchMode] = useState(true)
  const batchRef = useRef(batchMode)
  batchRef.current = batchMode

  const sketch = useCallback((p: p5) => {
    let t = 0
    let canvasW = 800
    const canvasH = 340

    interface ViewEvent {
      x: number
      y: number
      targetX: number
      targetY: number
      progress: number
      active: boolean
    }
    const events: ViewEvent[] = []

    let memCounter = 0
    let dbCounter = 0
    let flushTimer = 0
    let dbWriteFlash = 0

    p.setup = () => {
      canvasW = Math.min(p.windowWidth - 40, 800)
      p.createCanvas(canvasW, canvasH)
      p.textFont('monospace')
    }

    p.draw = () => {
      t += 0.016
      p.background(15, 15, 25)

      const useBatch = batchRef.current

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text(useBatch ? 'Batched View Counting (Aggregated Writes)' : 'Naive View Counting (Write Per View)', canvasW / 2, 8)

      const eventsX = canvasW * 0.10
      const counterX = canvasW * 0.45
      const dbX = canvasW * 0.80
      const pipeY = 170

      // Event sources
      for (let i = 0; i < 5; i++) {
        const ey = 60 + i * 45
        drawBox(p, eventsX, ey, 60, 28, [30, 30, 50], [120, 120, 200], `Viewer ${i + 1}`, 8)
      }

      if (useBatch) {
        // In-memory counter
        drawBox(p, counterX, pipeY, 100, 60, [30, 40, 30], [52, 211, 153], `In-Memory\nCounter\n${memCounter}`, 9)
        // DB
        const flashAlpha = Math.max(0, dbWriteFlash * 255)
        p.fill(40 + flashAlpha * 0.3, 30, 20)
        p.stroke(200, 160, 80, 150 + flashAlpha)
        p.strokeWeight(1.5)
        p.rect(dbX - 50, pipeY - 30, 100, 60, 6)
        p.fill(255)
        p.noStroke()
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`PostgreSQL\nview_count: ${dbCounter}`, dbX, pipeY)

        // Periodic flush arrow
        flushTimer += 0.016
        if (flushTimer > 3 && memCounter > 0) {
          dbCounter += memCounter
          memCounter = 0
          flushTimer = 0
          dbWriteFlash = 1
        }
        dbWriteFlash = Math.max(0, dbWriteFlash - 0.02)

        const ctx = p.drawingContext as CanvasRenderingContext2D
        ctx.setLineDash([4, 4])
        p.stroke(52, 211, 153, 100)
        p.strokeWeight(1)
        p.line(counterX + 50, pipeY, dbX - 50, pipeY)
        ctx.setLineDash([])
        p.fill(180)
        p.noStroke()
        p.textSize(8)
        p.textAlign(p.CENTER, p.TOP)
        p.text('flush every 3s', (counterX + dbX) / 2, pipeY + 10)

        // Rate label
        p.fill(52, 211, 153)
        p.textSize(9)
        p.text('~1 DB write / 3 sec', dbX, pipeY + 40)
      } else {
        // Naive: write directly to DB per view
        drawBox(p, dbX, pipeY, 100, 60, [50, 30, 20], [236, 72, 100], `PostgreSQL\nview_count: ${dbCounter}\n${'\u26A0'} 12K writes/s`, 8)
        dbWriteFlash = Math.max(0, dbWriteFlash - 0.01)
      }

      // Spawn events
      if (Math.random() < 0.08) {
        const srcIdx = Math.floor(Math.random() * 5)
        const srcY = 60 + srcIdx * 45
        events.push({
          x: eventsX + 30, y: srcY,
          targetX: useBatch ? counterX - 50 : dbX - 50,
          targetY: pipeY,
          progress: 0,
          active: true,
        })
      }

      // Update and draw events
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i]
        ev.progress += 0.02
        if (ev.progress >= 1) {
          if (useBatch) { memCounter++ } else { dbCounter++; dbWriteFlash = 1 }
          events.splice(i, 1)
          continue
        }
        drawDot(p, ev.x, ev.y, ev.targetX, ev.targetY, ev.progress, useBatch ? [52, 211, 153] : [236, 72, 100], 5)
      }

      // Annotations
      p.fill(120)
      p.textSize(8)
      p.textAlign(p.LEFT, p.BOTTOM)
      if (!useBatch) {
        p.fill(236, 72, 100)
        p.text('Problem: 1B views/day = 12K writes/sec to a single row = hot partition + lock contention', 10, canvasH - 10)
      } else {
        p.fill(52, 211, 153)
        p.text('Solution: aggregate in memory, flush periodically. Trade exact count for massive write reduction.', 10, canvasH - 10)
      }
    }
  }, [])

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">8. Deep Dive: View Counting at Scale</h2>
      <p className="text-gray-300 leading-relaxed">
        At 1 billion daily views, the naive approach of incrementing a database counter per view means
        ~12,000 writes per second to a single row {'\u2014'} guaranteed to create a hot partition and lock contention.
        The solution is to batch view events in memory and flush aggregated counts periodically.
      </p>
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => setBatchMode(false)}
          className={`px-3 py-1 rounded text-sm ${!batchMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Naive (per-view write)
        </button>
        <button
          onClick={() => setBatchMode(true)}
          className={`px-3 py-1 rounded text-sm ${batchMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Batched (aggregated)
        </button>
      </div>
      <P5Sketch sketch={sketch} />
      <div className="bg-gray-800 border-l-4 border-yellow-500 rounded-r-lg p-4">
        <p className="text-white font-medium text-sm">Production pattern: multi-tier counting</p>
        <p className="text-gray-300 text-sm mt-1">
          In production, YouTube uses a multi-tier approach: (1) View events go to a Kafka topic,
          (2) Stream processors aggregate counts per video per minute, (3) Aggregated counts are flushed
          to a distributed counter service (like Google's Zanzibar), (4) The counter service batches writes
          to the database. The displayed count may lag the real count by a few minutes, which is acceptable.
        </p>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 9 — Scaling Strategy                                       */
/* ================================================================== */

function ScalingSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">9. Scaling Strategy</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">CDN for Read-Heavy Workload</h4>
          <p className="text-gray-300 text-sm mt-1">
            99% of traffic is reads (viewers watching videos). Popular videos are cached at CDN edge nodes
            around the world. Cache hit ratios above 95% mean only 5% of requests reach the origin.
            The CDN network (e.g., Google's global edge network, or Cloudflare/Akamai for others)
            has PoPs in 100+ cities globally.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Transcoding Workers Auto-Scale</h4>
          <p className="text-gray-300 text-sm mt-1">
            The transcoding queue depth is the scaling signal. When upload volume spikes (e.g., after a
            major event), the queue grows, triggering auto-scaling of worker pods. Workers are stateless
            and horizontally scalable. Each worker pulls a job from the queue, transcodes, and uploads results.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Metadata DB Sharded by video_id</h4>
          <p className="text-gray-300 text-sm mt-1">
            With billions of videos, a single database instance cannot hold all metadata. Shard by video_id
            using consistent hashing. Each shard holds a subset of video metadata. The API layer routes queries
            to the correct shard. User metadata is in a separate, smaller database sharded by user_id.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-indigo-400 font-semibold text-sm">Search Index</h4>
          <p className="text-gray-300 text-sm mt-1">
            Video metadata is indexed in Elasticsearch for full-text search. The search index is updated
            asynchronously via a change data capture (CDC) pipeline from the metadata database.
            Search queries hit the Elasticsearch cluster, not the primary database.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 10 — Fault Tolerance                                       */
/* ================================================================== */

function FaultToleranceSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">10. Fault Tolerance</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Chunked Upload with Resume</p>
          <p className="text-gray-300 text-sm mt-1">
            Large video uploads are split into 5MB chunks. Each chunk is uploaded independently with a
            chunk number. If the connection drops, the client queries which chunks are already received
            and resumes from the last missing chunk. No data is re-uploaded.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">Transcoding Retry on Failure</p>
          <p className="text-gray-300 text-sm mt-1">
            If a transcoding worker crashes mid-job, the message remains in the queue (visibility timeout).
            After the timeout expires, another worker picks up the job. The system retries up to 3 times
            before marking the video as "failed" and alerting the uploader.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">CDN Failover to Origin</p>
          <p className="text-gray-300 text-sm mt-1">
            If a CDN edge node goes down, requests are automatically routed to the next nearest edge node
            or fall back to the CDN origin. Multi-CDN strategies (using multiple CDN providers) provide
            additional resilience against provider-level outages.
          </p>
        </div>
        <div className="bg-gray-800 border-l-4 border-green-500 rounded-r-lg p-4">
          <p className="text-white font-medium text-sm">View Count Eventual Consistency</p>
          <p className="text-gray-300 text-sm mt-1">
            View counts are eventually consistent by design. If an aggregation node crashes, the in-memory
            count is lost, but this only means a slight undercount (acceptable). The Kafka topic retains
            all events, so counts can be recomputed from the event log if needed.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 11 — Tradeoffs                                             */
/* ================================================================== */

function TradeoffsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">11. Key Tradeoffs</h2>

      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">
            Eager Transcoding vs. Lazy Transcoding
          </h4>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Eager (transcode on upload):</strong> All resolutions are ready before
            anyone watches. Better viewer experience. Used by YouTube.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Lazy (transcode on first play):</strong> Save storage for videos nobody
            watches (most videos get very few views). Risk: first viewer waits for transcoding.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Hybrid:</strong> Transcode 720p immediately (covers most devices), add
            higher resolutions lazily when view count exceeds a threshold. Best of both worlds.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">CDN Cost vs. Latency</h4>
          <p className="text-gray-300 text-sm mt-1">
            More CDN edge locations = lower latency for viewers but higher cost. Long-tail videos
            (rare views) should be evicted from CDN quickly to save cost. Popular videos should be
            pinned at every edge. Use tiered caching: hot tier (SSD at edge), warm tier (HDD at regional PoP),
            cold tier (origin only).
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Exact vs. Approximate View Counts</h4>
          <p className="text-gray-300 text-sm mt-1">
            Exact counting requires serialized writes to a single counter {'\u2014'} impossible at 12K/sec.
            Approximate counting (batch aggregation, eventual consistency) trades precision for throughput.
            The displayed count may lag by minutes, which users accept. For billing/monetization, use
            a separate, more accurate pipeline with deduplication.
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold text-sm">Push vs. Pull for Subscription Notifications</h4>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Push:</strong> When a creator uploads, notify all subscribers immediately.
            Problem: a creator with 100M subscribers means 100M push notifications per upload.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Pull:</strong> When a subscriber opens the app, check for new videos
            from their subscriptions. Lower peak load but higher latency for notifications.
          </p>
          <p className="text-gray-300 text-sm mt-1">
            <strong className="text-white">Hybrid:</strong> Push for creators with fewer than 10K subscribers.
            Pull (or batched push) for mega-creators. This is the pattern YouTube actually uses.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */

export default function DesignYouTube() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">
          Design YouTube (Video Platform)
        </h1>
        <p className="text-lg text-gray-400">
          A complete system design case study covering video upload, transcoding pipeline,
          adaptive bitrate streaming, CDN delivery, and view counting at YouTube scale {'\u2014'}
          handling 500 hours of uploads per minute and 1 billion daily views.
        </p>
      </header>

      <ProblemSection />
      <EnvelopeSection />
      <APISection />
      <DataModelSection />
      <ArchitectureSection />
      <TranscodingSection />
      <ABRSection />
      <ViewCountSection />
      <ScalingSection />
      <FaultToleranceSection />
      <TradeoffsSection />
    </div>
  )
}
