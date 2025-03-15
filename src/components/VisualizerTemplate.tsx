import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";

/**
 * Template for creating a new visualizer
 *
 * To create a new visualizer:
 * 1. Copy this file and rename it (e.g., MyNewVisualizer.tsx)
 * 2. Implement your visualization logic
 * 3. Register it in src/visualizers/index.tsx
 */
const VisualizerTemplate = ({ audioData }: VisualizerProps) => {
  // Create refs for Three.js objects
  const meshRef = useRef<THREE.Mesh>(null);

  // Create geometries and materials only once with useMemo
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#00a3ff" }),
    []
  );

  // Animation frame - this runs on every frame
  useFrame((state, delta) => {
    if (!meshRef.current || !audioData) return;

    // Example: Get average audio level
    const averageLevel =
      audioData.reduce((sum, value) => sum + value, 0) / audioData.length / 255;

    // Example: Scale the mesh based on audio level
    meshRef.current.scale.set(
      1 + averageLevel * 2,
      1 + averageLevel * 2,
      1 + averageLevel * 2
    );

    // Example: Rotate the mesh
    meshRef.current.rotation.x += delta;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
};

export default VisualizerTemplate;
