import type p5 from "p5";

interface Point {
  x: number;
  y: number;
  label: number;
}

interface ScatterPlotConfig {
  points: Point[];
  colorFn?: (label: number) => [number, number, number];
  onHover?: (point: Point | null) => void;
}

const DEFAULT_COLORS: [number, number, number][] = [
  [66, 133, 244],
  [234, 67, 53],
  [52, 168, 83],
  [251, 188, 4],
  [171, 71, 188],
];

function defaultColorFn(label: number): [number, number, number] {
  return DEFAULT_COLORS[label % DEFAULT_COLORS.length];
}

export function makeScatterSketch({
  points,
  colorFn = defaultColorFn,
  onHover,
}: ScatterPlotConfig) {
  return (p: p5) => {
    const MARGIN = 50;
    let offsetX = 0;
    let offsetY = 0;
    let zoom = 1;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let hoveredPoint: Point | null = null;

    // Data bounds
    const xs = points.map((pt) => pt.x);
    const ys = points.map((pt) => pt.y);
    const dataMinX = Math.min(...xs);
    const dataMaxX = Math.max(...xs);
    const dataMinY = Math.min(...ys);
    const dataMaxY = Math.max(...ys);
    const rangeX = dataMaxX - dataMinX || 1;
    const rangeY = dataMaxY - dataMinY || 1;
    const padX = rangeX * 0.1;
    const padY = rangeY * 0.1;
    const minX = dataMinX - padX;
    const maxX = dataMaxX + padX;
    const minY = dataMinY - padY;
    const maxY = dataMaxY + padY;

    function mapX(val: number): number {
      return (
        MARGIN +
        ((val - minX) / (maxX - minX)) *
          (p.width - 2 * MARGIN) *
          zoom +
        offsetX
      );
    }

    function mapY(val: number): number {
      return (
        p.height -
        MARGIN -
        ((val - minY) / (maxY - minY)) *
          (p.height - 2 * MARGIN) *
          zoom -
        offsetY
      );
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode;
      const w = parent ? parent.clientWidth : 600;
      p.createCanvas(w, 400);
    };

    p.draw = () => {
      p.background(255);

      // Draw axes
      p.stroke(200);
      p.strokeWeight(1);
      p.line(MARGIN, p.height - MARGIN, p.width - MARGIN, p.height - MARGIN);
      p.line(MARGIN, MARGIN, MARGIN, p.height - MARGIN);

      // Tick marks on x axis
      p.fill(100);
      p.noStroke();
      p.textSize(10);
      p.textAlign(p.CENTER, p.TOP);
      const tickCountX = 5;
      for (let i = 0; i <= tickCountX; i++) {
        const val = minX + (i / tickCountX) * (maxX - minX);
        const sx = mapX(val);
        if (sx >= MARGIN && sx <= p.width - MARGIN) {
          p.stroke(220);
          p.line(sx, MARGIN, sx, p.height - MARGIN);
          p.noStroke();
          p.fill(100);
          p.text(val.toFixed(1), sx, p.height - MARGIN + 5);
        }
      }

      // Tick marks on y axis
      p.textAlign(p.RIGHT, p.CENTER);
      const tickCountY = 5;
      for (let i = 0; i <= tickCountY; i++) {
        const val = minY + (i / tickCountY) * (maxY - minY);
        const sy = mapY(val);
        if (sy >= MARGIN && sy <= p.height - MARGIN) {
          p.stroke(220);
          p.line(MARGIN, sy, p.width - MARGIN, sy);
          p.noStroke();
          p.fill(100);
          p.text(val.toFixed(1), MARGIN - 5, sy);
        }
      }

      // Draw points
      hoveredPoint = null;
      for (const pt of points) {
        const sx = mapX(pt.x);
        const sy = mapY(pt.y);
        const [r, g, b] = colorFn(pt.label);
        const d = p.dist(p.mouseX, p.mouseY, sx, sy);
        const isHovered = d < 8;
        if (isHovered) {
          hoveredPoint = pt;
        }
        p.fill(r, g, b, isHovered ? 255 : 200);
        p.stroke(r, g, b);
        p.strokeWeight(isHovered ? 2 : 1);
        p.ellipse(sx, sy, isHovered ? 12 : 8);
      }

      // Tooltip
      if (hoveredPoint) {
        if (onHover) onHover(hoveredPoint);
        const tx = p.mouseX + 12;
        const ty = p.mouseY - 20;
        const label = `(${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)}) label: ${hoveredPoint.label}`;
        p.noStroke();
        p.fill(0, 0, 0, 200);
        p.rect(tx - 4, ty - 12, p.textWidth(label) + 8, 18, 4);
        p.fill(255);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(11);
        p.text(label, tx, ty - 10);
      } else {
        if (onHover) onHover(null);
      }
    };

    p.mousePressed = () => {
      if (
        p.mouseX > MARGIN &&
        p.mouseX < p.width - MARGIN &&
        p.mouseY > MARGIN &&
        p.mouseY < p.height - MARGIN
      ) {
        dragging = true;
        dragStartX = p.mouseX;
        dragStartY = p.mouseY;
        dragOffsetX = offsetX;
        dragOffsetY = offsetY;
      }
    };

    p.mouseDragged = () => {
      if (dragging) {
        offsetX = dragOffsetX + (p.mouseX - dragStartX);
        offsetY = dragOffsetY - (p.mouseY - dragStartY);
      }
    };

    p.mouseReleased = () => {
      dragging = false;
    };

    p.mouseWheel = (event: WheelEvent) => {
      if (
        p.mouseX > MARGIN &&
        p.mouseX < p.width - MARGIN &&
        p.mouseY > MARGIN &&
        p.mouseY < p.height - MARGIN
      ) {
        const delta = -event.deltaY * 0.001;
        zoom = Math.max(0.1, Math.min(10, zoom + delta));
        event.preventDefault();
      }
    };
  };
}
