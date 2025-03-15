import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";

const WaveformBars = ({ audioData }: VisualizerProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  const count = 64; // Number of bars

  // Create a symmetrical distribution for the frequencies
  const symmetricalDistribution = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create a symmetrical factor (0-1) with peak in the middle
      const x = (i - count / 2) / (count / 4); // Normalize to [-2, 2]
      const factor = Math.exp(-0.5 * x * x); // Gaussian distribution
      return factor;
    });
  }, [count]);

  useFrame(() => {
    if (!meshRef.current || !audioData) return;

    // Update each bar based on audio data
    for (let i = 0; i < count; i++) {
      // Get the corresponding frequency data
      const centerIndex = Math.floor(i * (audioData.length / count));
      const value = audioData[centerIndex] || 0;

      // Apply symmetrical distribution
      const normalizedValue = (value / 255) * symmetricalDistribution[i];

      // Position bars in a line
      tempObject.position.x = (i - count / 2) * 0.4;
      tempObject.position.z = 0;

      // Scale bars based on audio frequency data with symmetrical distribution
      tempObject.scale.y = normalizedValue * 5 + 0.2;

      // Center the bars vertically
      tempObject.position.y = tempObject.scale.y / 2;

      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.2, 1, 0.2]} />
      <meshStandardMaterial color="#ff0066" />
    </instancedMesh>
  );
};

export default WaveformBars;
