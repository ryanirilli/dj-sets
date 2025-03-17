import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface PerformanceStats {
  fps: number;
  memory: {
    geometries: number;
    textures: number;
  };
}

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
        const memory = {
          geometries: (gl as any).info?.memory?.geometries || 0,
          textures: (gl as any).info?.memory?.textures || 0,
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

  // Use Html component from drei to render HTML content within the Three.js canvas
  return (
    <Html
      as="div"
      className="fixed top-0 left-0 bg-black/70 text-white p-2 text-xs font-mono z-50 rounded-br-md"
      style={{
        pointerEvents: "none",
        transform: "translateZ(0px)",
      }}
      position={[-100, 100, 0]}
      distanceFactor={10}
      zIndexRange={[100, 0]}
      prepend
    >
      <div>FPS: {stats.fps}</div>
      <div>Geometries: {stats.memory.geometries}</div>
      <div>Textures: {stats.memory.textures}</div>
    </Html>
  );
};

export default PerformanceMonitor;
