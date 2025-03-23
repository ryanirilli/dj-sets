import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { WebGLRenderer } from "three";

interface PerformanceStats {
  fps: number;
  memory: {
    geometries: number;
    textures: number;
  };
}

// Using a type assertion to avoid type incompatibility issues
type RendererWithInfo = WebGLRenderer & {
  info: {
    memory: {
      geometries: number;
      textures: number;
    };
  };
};

const PerformanceMonitor = ({ visible = true }: { visible?: boolean }) => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    memory: {
      geometries: 0,
      textures: 0,
    },
  });
  const { gl } = useThree();

  useEffect(() => {
    if (!visible) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let frameId: number;

    const updateStats = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      // Update stats every second
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);

        // Get memory info from renderer
        const renderer = gl as RendererWithInfo;
        const memory = {
          geometries: renderer.info.memory.geometries || 0,
          textures: renderer.info.memory.textures || 0,
        };

        setStats({ fps, memory });

        // Reset counters
        frameCount = 0;
        lastTime = currentTime;
      }

      frameId = requestAnimationFrame(updateStats);
    };

    frameId = requestAnimationFrame(updateStats);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [gl, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 bg-black/70 text-white p-2 text-xs font-mono z-50 rounded-br-md"
      style={{
        pointerEvents: "none",
      }}
    >
      <div>FPS: {stats.fps}</div>
      <div>GEO: {stats.memory.geometries}</div>
      <div>TEX: {stats.memory.textures}</div>
    </div>
  );
};

export default PerformanceMonitor;
