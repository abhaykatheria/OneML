import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import p5 from "p5";

interface P5SketchProps {
  sketch: (p: p5) => void;
  height?: number;
  className?: string;
  controls?: ReactNode;
}

export default function P5Sketch({
  sketch,
  height = 400,
  className = "",
  controls,
}: P5SketchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<p5 | null>(null);

  function cleanup() {
    if (instanceRef.current) {
      try { instanceRef.current.remove(); } catch { /* ignore */ }
      instanceRef.current = null;
    }
    // Force-clear any leftover canvases from the container
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }

  useEffect(() => {
    if (!containerRef.current) return;

    cleanup();

    const instance = new p5(sketch, containerRef.current);
    instanceRef.current = instance;

    const handleResize = () => {
      if (instanceRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth;
        instanceRef.current.resizeCanvas(width, height);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cleanup();
    };
  }, [sketch, height]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: `${height}px`,
          overflow: "hidden",
          position: "relative",
        }}
      />
      {controls && <div className="mt-2">{controls}</div>}
    </div>
  );
}
