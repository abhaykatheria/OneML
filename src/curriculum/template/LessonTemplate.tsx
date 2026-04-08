// ┌───────────────────────────────────────────────────────┐
// │  oneML Lesson Template                                │
// │  Copy this file into the appropriate track folder,    │
// │  rename it, and fill in each section.                 │
// └───────────────────────────────────────────────────────┘

import type { LessonMeta } from '../../types'

// ── 1. Lesson metadata ──────────────────────────────────
// Update every field. `id` must match `<track>/<filename>`.
export const meta: LessonMeta = {
  id: 'foundations/my-lesson',
  title: 'My Lesson Title',
  description: 'A one-sentence summary of what the learner will understand.',
  track: 'foundations',
  order: 2,
  tags: ['example', 'template'],
}

// ── 2. (Optional) p5 / Three.js sketch ─────────────────
// Import the wrapper you need:
//   import { P5Sketch } from '../../core/p5/P5Sketch'
//   import { ThreeScene } from '../../core/three/ThreeScene'
//
// const sketch = (p: p5) => {
//   p.setup = () => { p.createCanvas(p.windowWidth, 400) }
//   p.draw  = () => { /* animation loop */ }
// }

// ── 3. (Optional) Pyodide code cell ────────────────────
// import { usePyodide } from '../../core/pyodide/usePyodide'
//
// Inside your component:
//   const { run, loading } = usePyodide()
//   const result = await run(`
//     import numpy as np
//     np.array([1,2,3]).tolist()
//   `)

export default function LessonTemplate() {
  return (
    <article className="prose dark:prose-invert max-w-3xl">
      {/* ── Intro prose ─────────────────────────────────── */}
      <h1>{meta.title}</h1>
      <p>
        {/* Write a 2-3 sentence introduction that motivates the topic. */}
        Replace this text with a clear, motivating introduction to the lesson.
      </p>

      {/* ── Interactive visualization ────────────────────── */}
      {/*
        <section className="my-8">
          <P5Sketch sketch={sketch} />
        </section>
      */}

      {/* ── Explanation ──────────────────────────────────── */}
      <h2>Key Concepts</h2>
      <p>Explain the core idea in plain language. Use diagrams or math sparingly.</p>

      {/* ── Python cell ──────────────────────────────────── */}
      {/*
        <CodeBlock
          code={`import numpy as np\nprint(np.dot([1,2],[3,4]))`}
          language="python"
        />
      */}

      {/* ── Exercises ────────────────────────────────────── */}
      <h2>Exercises</h2>
      <ol>
        <li>Exercise one prompt.</li>
        <li>Exercise two prompt.</li>
      </ol>
    </article>
  )
}
