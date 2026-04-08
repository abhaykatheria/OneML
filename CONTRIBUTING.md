# Contributing to oneML

Thanks for your interest in contributing! This guide explains how to add a new lesson and general contribution guidelines.

## Adding a new lesson

### 1. Copy the template

```bash
cp src/curriculum/template/LessonTemplate.tsx src/curriculum/<track>/<my-lesson>.tsx
```

Replace `<track>` with one of: `foundations`, `classical`, `neural`, `deep`, `advanced`, `practical`.

### 2. Fill in the metadata

Every lesson must export a `meta` object:

```ts
export const meta: LessonMeta = {
  id: '<track>/<filename>',      // must match the file path
  title: 'Lesson Title',
  description: 'One-sentence summary.',
  track: '<track>',
  order: 3,                       // position within the track
  tags: ['regression', 'linear'],
}
```

### 3. Write the lesson content

- Start with a motivating introduction (2-3 sentences).
- Include at least one interactive visualization using `<P5Sketch>` or `<ThreeScene>`.
- Add a Python code cell via `usePyodide()` when the learner should run code.
- End with 2-3 exercises.

### 4. Register the lesson

Add the lesson's meta to the `allLessons` array in `src/curriculum/index.ts` so it appears in navigation and the home page.

### 5. Test locally

```bash
npm run dev
```

Navigate to `/learn/<track>/<filename>` and verify:

- The lesson renders without errors.
- Visualizations are responsive and performant.
- Python cells run correctly.
- Previous/Next navigation works.

## Visualization quality guidelines

- Canvases should be responsive -- use `p.windowWidth` or container-relative sizing.
- Keep frame rates smooth (target 60 fps). Avoid heavy computation in `draw()`.
- Provide interactive controls (sliders, buttons) so the learner can explore.
- Include axis labels and legends where appropriate.
- Support dark mode by reading `data-theme` or using CSS variables.

## Code style

- Functional components and hooks only -- no class components.
- TypeScript strict mode. Fix all type errors before opening a PR.
- Use Tailwind CSS for styling. Avoid inline styles except for dynamic values.
- Follow existing naming conventions: `PascalCase` for components, `camelCase` for functions and variables.

## Pull request process

1. Fork the repo and create a branch: `git checkout -b add-lesson-<name>`.
2. Make your changes and ensure `npm run build` passes.
3. Open a pull request with a clear title and description.
4. A maintainer will review and provide feedback.

## Code of conduct

Be respectful and constructive. We are building an educational resource -- clarity and helpfulness matter above all.
