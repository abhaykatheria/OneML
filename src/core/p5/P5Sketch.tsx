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
  className = "",
  controls,
}: P5SketchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous instance
    if (instanceRef.current) {
      try { instanceRef.current.noLoop(); } catch { /* */ }
      try { instanceRef.current.remove(); } catch { /* */ }
      instanceRef.current = null;
    }
    containerRef.current.innerHTML = "";

    const instance = new p5(sketch, containerRef.current);
    instanceRef.current = instance;

    return () => {
      if (instanceRef.current) {
        try { instanceRef.current.noLoop(); } catch { /* */ }
        try { instanceRef.current.remove(); } catch { /* */ }
        instanceRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [sketch]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={containerRef} style={{ width: "100%" }} />
      {controls && <div className="mt-2">{controls}</div>}
    </div>
  );
}
