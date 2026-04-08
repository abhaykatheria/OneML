# oneML -- Open ML Learning Platform

An open-source, browser-native interactive machine learning education platform.
No installs. No backend. Learn ML by interacting with live visualizations and running real Python (via Pyodide / WebAssembly).

## Quick start

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Tech stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Framework       | React 18, TypeScript (strict)             |
| Build           | Vite                                      |
| Styling         | Tailwind CSS                              |
| State           | Zustand                                   |
| 2D visuals      | p5.js                                     |
| 3D visuals      | Three.js                                  |
| In-browser ML   | Pyodide (CPython compiled to WebAssembly) |
| Routing         | React Router v6                           |

## Curriculum

| Track          | Description                                       |
| -------------- | ------------------------------------------------- |
| Foundations    | Math refreshers, Python basics, core ML intuition |
| Classical ML   | Regression, classification, clustering, ensembles |
| Neural Networks| Perceptrons, back-prop, feed-forward networks     |
| Deep Learning  | CNNs, RNNs, transformers, modern architectures    |
| Advanced       | Reinforcement learning, generative models, LLMs   |
| Practical ML   | Evaluation, deployment, MLOps, best practices     |

Each lesson lives under `src/curriculum/<track>/<lesson>.tsx` and exports a default React component plus a `meta` object.

## Project structure

```
src/
  core/           -- Pyodide loader, p5 wrapper, Three.js wrapper, Zustand stores
  curriculum/     -- Lesson modules organized by track
  components/
    ui/           -- Button, Card, Badge, CodeBlock, Tabs, Progress, etc.
    layout/       -- Sidebar, TopNav, LessonShell, LessonNav
    viz/          -- Reusable visualization wrappers
  pages/          -- Top-level route pages (Home, NotFound)
  styles/         -- Design tokens (CSS custom properties)
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new lessons and general contribution workflow.

## Scripts

| Command           | Purpose                    |
| ----------------- | -------------------------- |
| `npm run dev`     | Start Vite dev server      |
| `npm run build`   | Type-check and build       |
| `npm run preview` | Preview production build   |
| `npm run lint`    | Run ESLint                 |

## License

MIT
