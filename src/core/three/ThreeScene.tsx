import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeSceneProps {
  setup: (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
  ) => void;
  animate?: (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    t: number,
  ) => void;
  height?: number;
}

export default function ThreeScene({
  setup,
  animate,
  height = 500,
}: ThreeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    setup(scene, camera, renderer);

    const startTime = performance.now();
    let animationId: number;

    const loop = () => {
      animationId = requestAnimationFrame(loop);
      const t = (performance.now() - startTime) / 1000;
      if (animate) {
        animate(scene, camera, t);
      }
      renderer.render(scene, camera);
    };
    loop();

    // Auto-resize via ResizeObserver
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer.setSize(w, height);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setup, animate, height]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: `${height}px`, overflow: "hidden" }}
    />
  );
}
