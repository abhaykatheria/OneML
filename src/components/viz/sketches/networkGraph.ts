import type p5 from "p5";

interface NetworkGraphConfig {
  layers: number[];
}

interface Node {
  x: number;
  y: number;
  layer: number;
  index: number;
  activation: number;
}

interface Edge {
  from: Node;
  to: Node;
  weight: number;
  pulseProgress: number; // 0..1, -1 means no active pulse
}

export function makeNetworkGraphSketch({ layers }: NetworkGraphConfig) {
  return (p: p5) => {
    const MARGIN_X = 60;
    const MARGIN_Y = 40;
    const NODE_RADIUS = 16;

    let nodes: Node[][] = [];
    let edges: Edge[] = [];
    let forwardPassActive = false;
    let currentPulseLayer = 0;

    function layoutNodes() {
      nodes = [];
      const layerSpacing =
        (p.width - 2 * MARGIN_X) / Math.max(layers.length - 1, 1);

      for (let l = 0; l < layers.length; l++) {
        const layerNodes: Node[] = [];
        const count = layers[l];
        const totalHeight = p.height - 2 * MARGIN_Y;
        const nodeSpacing = totalHeight / Math.max(count + 1, 2);

        for (let n = 0; n < count; n++) {
          layerNodes.push({
            x: MARGIN_X + l * layerSpacing,
            y: MARGIN_Y + (n + 1) * nodeSpacing,
            layer: l,
            index: n,
            activation: 0,
          });
        }
        nodes.push(layerNodes);
      }
    }

    function buildEdges() {
      edges = [];
      for (let l = 0; l < nodes.length - 1; l++) {
        for (const from of nodes[l]) {
          for (const to of nodes[l + 1]) {
            edges.push({
              from,
              to,
              weight: p.random(-1, 1),
              pulseProgress: -1,
            });
          }
        }
      }
    }

    function startForwardPass() {
      forwardPassActive = true;
      currentPulseLayer = 0;

      // Set input activations to random values
      for (const node of nodes[0]) {
        node.activation = p.random(0.2, 1);
      }

      // Reset all pulse progress
      for (const edge of edges) {
        edge.pulseProgress = -1;
      }

      // Start pulses for first layer edges
      for (const edge of edges) {
        if (edge.from.layer === 0) {
          edge.pulseProgress = 0;
        }
      }
    }

    p.setup = () => {
      const parent = (p as unknown as Record<string, HTMLElement>)._userNode;
      const w = parent ? parent.clientWidth : 700;
      p.createCanvas(w, 400);
      p.frameRate(30);
      layoutNodes();
      buildEdges();
      startForwardPass();
    };

    p.draw = () => {
      p.background(250, 250, 255);

      // Update pulse animations
      if (forwardPassActive) {
        let anyActive = false;
        let layerComplete = true;

        for (const edge of edges) {
          if (edge.pulseProgress >= 0 && edge.pulseProgress < 1) {
            edge.pulseProgress += 0.025;
            anyActive = true;
            if (edge.pulseProgress < 1) {
              layerComplete = false;
            }
          }
        }

        // When current layer pulses complete, compute activations and start next layer
        if (layerComplete && anyActive && currentPulseLayer < layers.length - 2) {
          const nextLayerIdx = currentPulseLayer + 1;
          // Compute activations for arrived layer using sigmoid
          for (const node of nodes[nextLayerIdx]) {
            let sum = 0;
            for (const edge of edges) {
              if (
                edge.to === node &&
                edge.from.layer === currentPulseLayer
              ) {
                sum += edge.from.activation * edge.weight;
              }
            }
            node.activation = 1 / (1 + Math.exp(-sum)); // sigmoid
          }

          currentPulseLayer++;

          // Start next layer pulses
          for (const edge of edges) {
            if (edge.from.layer === currentPulseLayer) {
              edge.pulseProgress = 0;
            }
          }
        }

        // When all done, compute final layer and restart after a delay
        if (!anyActive && currentPulseLayer >= layers.length - 2) {
          const lastIdx = layers.length - 1;
          for (const node of nodes[lastIdx]) {
            let sum = 0;
            for (const edge of edges) {
              if (edge.to === node && edge.from.layer === lastIdx - 1) {
                sum += edge.from.activation * edge.weight;
              }
            }
            node.activation = 1 / (1 + Math.exp(-sum));
          }
          forwardPassActive = false;
          // Restart after a pause
          setTimeout(() => startForwardPass(), 1500);
        }
      }

      // Draw edges
      for (const edge of edges) {
        const alpha = 40;
        p.stroke(150, 150, 180, alpha);
        p.strokeWeight(1);
        p.line(edge.from.x, edge.from.y, edge.to.x, edge.to.y);

        // Draw pulse
        if (edge.pulseProgress >= 0 && edge.pulseProgress <= 1) {
          const t = Math.min(edge.pulseProgress, 1);
          const px = p.lerp(edge.from.x, edge.to.x, t);
          const py = p.lerp(edge.from.y, edge.to.y, t);
          const intensity = edge.from.activation;
          p.noStroke();
          p.fill(
            66 + intensity * 180,
            100 + intensity * 100,
            244,
            200,
          );
          p.ellipse(px, py, 6);
        }
      }

      // Draw nodes
      for (const layer of nodes) {
        for (const node of layer) {
          const a = node.activation;
          // Color: blue (low) to orange (high)
          const r = 60 + a * 195;
          const g = 100 + a * 80;
          const b = 220 - a * 150;
          p.fill(r, g, b);
          p.stroke(60);
          p.strokeWeight(2);
          p.ellipse(node.x, node.y, NODE_RADIUS * 2);

          // Show activation value
          p.fill(255);
          p.noStroke();
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(9);
          p.text(a.toFixed(1), node.x, node.y);
        }
      }

      // Layer labels
      p.noStroke();
      p.fill(80);
      p.textSize(11);
      p.textAlign(p.CENTER, p.TOP);
      for (let l = 0; l < nodes.length; l++) {
        const x = nodes[l][0].x;
        let label: string;
        if (l === 0) label = "Input";
        else if (l === nodes.length - 1) label = "Output";
        else label = `Hidden ${l}`;
        p.text(label, x, p.height - MARGIN_Y + 10);
      }
    };
  };
}
