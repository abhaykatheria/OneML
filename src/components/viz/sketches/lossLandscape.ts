import type p5 from "p5";

interface LossLandscapeConfig {
  lossFn: (x: number, y: number) => number;
  learningRate?: number;
  startX?: number;
  startY?: number;
}

export function makeLossLandscapeSketch({
  lossFn,
  learningRate = 0.05,
  startX = 2,
  startY = 2,
}: LossLandscapeConfig) {
  return (p: p5) => {
    const MARGIN = 40;
    const GRID_RES = 100;
    const RANGE = 4; // parameter space from -RANGE to +RANGE
    const minVal = -RANGE;
    const maxVal = RANGE;

    let contourImage: p5.Image | null = null;
    let ballX = startX;
    let ballY = startY;
    const trail: { x: number; y: number }[] = [{ x: ballX, y: ballY }];
    let minLoss = Infinity;
    let maxLoss = -Infinity;

    function mapX(val: number): number {
      return (
        MARGIN +
        ((val - minVal) / (maxVal - minVal)) * (p.width - 2 * MARGIN)
      );
    }

    function mapY(val: number): number {
      return (
        p.height -
        MARGIN -
        ((val - minVal) / (maxVal - minVal)) * (p.height - 2 * MARGIN)
      );
    }

    function numericalGradient(
      x: number,
      y: number,
    ): { dx: number; dy: number } {
      const eps = 0.001;
      const dx = (lossFn(x + eps, y) - lossFn(x - eps, y)) / (2 * eps);
      const dy = (lossFn(x, y + eps) - lossFn(x, y - eps)) / (2 * eps);
      return { dx, dy };
    }

    function lerpColor(
      t: number,
    ): [number, number, number] {
      // Blue (low) -> Cyan -> Green -> Yellow -> Red (high)
      const stops: [number, number, number][] = [
        [30, 60, 180],
        [30, 180, 180],
        [50, 180, 50],
        [240, 220, 40],
        [220, 50, 30],
      ];
      const clamped = Math.max(0, Math.min(1, t));
      const idx = clamped * (stops.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, stops.length - 1);
      const frac = idx - lo;
      return [
        stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac,
        stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac,
        stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac,
      ];
    }

    function buildContourImage() {
      // Pre-compute loss range
      const losses: number[] = [];
      for (let gy = 0; gy < GRID_RES; gy++) {
        for (let gx = 0; gx < GRID_RES; gx++) {
          const dataX = minVal + (gx / (GRID_RES - 1)) * (maxVal - minVal);
          const dataY = maxVal - (gy / (GRID_RES - 1)) * (maxVal - minVal);
          const loss = lossFn(dataX, dataY);
          losses.push(loss);
          if (loss < minLoss) minLoss = loss;
          if (loss > maxLoss) maxLoss = loss;
        }
      }

      contourImage = p.createImage(GRID_RES, GRID_RES);
      contourImage.loadPixels();
      for (let i = 0; i < losses.length; i++) {
        const t =
          maxLoss > minLoss ? (losses[i] - minLoss) / (maxLoss - minLoss) : 0;
        const [r, g, b] = lerpColor(t);
        const idx = i * 4;
        contourImage!.pixels[idx] = r;
        contourImage!.pixels[idx + 1] = g;
        contourImage!.pixels[idx + 2] = b;
        contourImage!.pixels[idx + 3] = 220;
      }
      contourImage.updatePixels();
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode;
      const w = parent ? parent.clientWidth : 600;
      p.createCanvas(w, 400);
      p.frameRate(30);
      buildContourImage();
    };

    p.draw = () => {
      p.background(255);

      // Draw contour map
      if (contourImage) {
        p.image(
          contourImage,
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

      // Perform gradient descent step
      if (p.frameCount % 6 === 0) {
        const grad = numericalGradient(ballX, ballY);
        ballX -= learningRate * grad.dx;
        ballY -= learningRate * grad.dy;
        // Clamp to range
        ballX = Math.max(minVal, Math.min(maxVal, ballX));
        ballY = Math.max(minVal, Math.min(maxVal, ballY));
        trail.push({ x: ballX, y: ballY });
        if (trail.length > 200) trail.shift();
      }

      // Draw trail
      p.noFill();
      p.stroke(255, 255, 255, 180);
      p.strokeWeight(2);
      p.beginShape();
      for (const pt of trail) {
        p.vertex(mapX(pt.x), mapY(pt.y));
      }
      p.endShape();

      // Draw ball
      const bx = mapX(ballX);
      const by = mapY(ballY);
      p.fill(255);
      p.stroke(0);
      p.strokeWeight(2);
      p.ellipse(bx, by, 14);

      // Loss value label
      const currentLoss = lossFn(ballX, ballY);
      p.noStroke();
      p.fill(0);
      p.textSize(12);
      p.textAlign(p.LEFT, p.TOP);
      p.text(
        `Loss: ${currentLoss.toFixed(4)} | pos: (${ballX.toFixed(2)}, ${ballY.toFixed(2)})`,
        MARGIN + 5,
        MARGIN + 5,
      );
    };
  };
}
