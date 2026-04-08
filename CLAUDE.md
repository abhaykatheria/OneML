# oneML — Open ML Learning Platform

## Project overview
oneML is an open-source, browser-native interactive machine learning education platform.
No installs. No backend. Learn ML by interacting with live visualizations and running real Python.

## Tech stack
- **Vite + React 18** — fast HMR dev runtime, static build output
- **p5.js** — 2D interactive sketches (decision boundaries, loss landscapes, activations)
- **Three.js** — 3D visualizations (neural network graphs, 3D loss surfaces, embeddings)
- **Pyodide** — CPython in browser via WebAssembly (runs NumPy, scikit-learn, matplotlib)
- **React Router v6** — client-side routing per lesson
- **Tailwind CSS** — utility-first styling
- **Zustand** — global state (lesson progress, Pyodide ready state)

## Directory structure
```
oneml/
├── public/
├── src/
│   ├── core/
│   │   ├── pyodide/          # Pyodide loader, worker, hook
│   │   ├── p5/               # p5 React wrapper component
│   │   ├── three/            # Three.js React wrapper component
│   │   └── store/            # Zustand stores
│   ├── curriculum/
│   │   ├── foundations/      # Math & Python modules
│   │   ├── classical/        # Classical ML modules
│   │   ├── neural/           # Neural network modules
│   │   ├── deep/             # Deep learning modules
│   │   ├── advanced/         # RL, LLMs modules
│   │   └── practical/        # Evaluation, MLOps modules
│   ├── components/
│   │   ├── ui/               # Shared UI (Button, Slider, Card, CodeBlock)
│   │   ├── layout/           # Sidebar, TopNav, LessonShell
│   │   └── viz/              # Reusable viz wrappers
│   └── App.tsx
├── CLAUDE.md
├── package.json
└── vite.config.ts
```

## Coding conventions
- All lesson modules export a default React component: `export default function LessonName()`
- Visualizations use the `<P5Sketch sketch={fn} />` or `<ThreeScene setup={fn} />` wrappers
- Pyodide code runs via `const { run } = usePyodide()` — always handle loading state
- Lesson metadata exported as `export const meta = { title, description, track, order, tags }`
- No class components. Functional components + hooks only.
- TypeScript strict mode on.

## Key patterns

### p5 sketch pattern
```tsx
const sketch = (p: p5) => {
  p.setup = () => { p.createCanvas(p.windowWidth, 400) }
  p.draw = () => { /* animation loop */ }
}
<P5Sketch sketch={sketch} controls={<MyControls />} />
```

### Pyodide run pattern
```tsx
const { run, loading } = usePyodide()
const result = await run(`
import numpy as np
arr = np.array([1,2,3])
arr.tolist()
`)
```

### Three.js scene pattern
```tsx
<ThreeScene
  setup={(scene, camera, renderer) => { /* init */ }}
  animate={(scene, camera, t) => { /* frame */ }}
  height={500}
/>
```