import type p5 from "p5";

interface Point {
  x: number;
  y: number;
  label: number;
}

interface DecisionBoundaryConfig {
  classifyFn: (x: number, y: number) => number;
  points: Point[];
}

const CLASS_COLORS: [number, number, number][] = [
  [66, 133, 244],
  [234, 67, 53],
  [52, 168, 83],
  [251, 188, 4],
  [171, 71, 188],
];

export function makeDecisionBoundarySketch({
  classifyFn,
  points,
}: DecisionBoundaryConfig) {
  return (p: p5) => {
    const MARGIN = 40;
    const GRID_RES = 100;
    let gridImage: p5.Image | null = null;

    // Compute data bounds
    const xs = points.map((pt) => pt.x);
    const ys = points.map((pt) => pt.y);
    const padX = (Math.max(...xs) - Math.min(...xs)) * 0.15 || 1;
    const padY = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 1;
    const minX = Math.min(...xs) - padX;
    const maxX = Math.max(...xs) + padX;
    const minY = Math.min(...ys) - padY;
    const maxY = Math.max(...ys) + padY;

    function mapX(val: number): number {
      return MARGIN + ((val - minX) / (maxX - minX)) * (p.width - 2 * MARGIN);
    }

    function mapY(val: number): number {
      return (
        p.height -
        MARGIN -
        ((val - minY) / (maxY - minY)) * (p.height - 2 * MARGIN)
      );
    }

    function buildGrid() {
      gridImage = p.createImage(GRID_RES, GRID_RES);
      gridImage.loadPixels();
      for (let gy = 0; gy < GRID_RES; gy++) {
        for (let gx = 0; gx < GRID_RES; gx++) {
          const dataX = minX + (gx / (GRID_RES - 1)) * (maxX - minX);
          const dataY = maxY - (gy / (GRID_RES - 1)) * (maxY - minY);
          const cls = classifyFn(dataX, dataY);
          const [r, g, b] = CLASS_COLORS[cls % CLASS_COLORS.length];
          const idx = (gy * GRID_RES + gx) * 4;
          gridImage!.pixels[idx] = r;
          gridImage!.pixels[idx + 1] = g;
          gridImage!.pixels[idx + 2] = b;
          gridImage!.pixels[idx + 3] = 100; // semi-transparent
        }
      }
      gridImage.updatePixels();
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode;
      const w = parent ? parent.clientWidth : 600;
      p.createCanvas(w, 400);
      p.noLoop(); // static scene; redraw manually if needed
      buildGrid();
      p.redraw();
    };

    p.draw = () => {
      p.background(255);

      // Draw the classification grid
      if (gridImage) {
        p.image(
          gridImage,
          MARGIN,
          MARGIN,
          p.width - 2 * MARGIN,
          p.height - 2 * MARGIN,
        );
      }

      // Axes
      p.stroke(60);
      p.strokeWeight(1);
      p.line(MARGIN, p.height - MARGIN, p.width - MARGIN, p.height - MARGIN);
      p.line(MARGIN, MARGIN, MARGIN, p.height - MARGIN);

      // Draw training points
      for (const pt of points) {
        const sx = mapX(pt.x);
        const sy = mapY(pt.y);
        const [r, g, b] = CLASS_COLORS[pt.label % CLASS_COLORS.length];
        p.fill(r, g, b);
        p.stroke(255);
        p.strokeWeight(2);
        p.ellipse(sx, sy, 10);
      }
    };
  };
}
