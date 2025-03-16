import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneContext } from "@/contexts/SceneContext";

export interface WaveformBarsProps {
  audioData: Uint8Array | null;
}

const WaveformBars = ({ audioData }: WaveformBarsProps) => {
  // Use fewer bars for better visibility
  const count = 32; // Must be even for center symmetry
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  const { colorPalette } = useSceneContext();

  // Animation values for smoother transitions
  const animatedValues = useRef(new Array(count).fill(0.1));

  // Create a simple array of indices for the frequency data
  // We'll use the first half of the audio data (typically bass/mid frequencies)
  const frequencyIndices = useMemo(() => {
    const halfCount = count / 2;
    const indices = [];

    // Create indices for half the bars (we'll mirror them)
    for (let i = 0; i < halfCount; i++) {
      // Map to lower frequencies (0-64) with emphasis on bass
      const index = Math.floor((i / halfCount) * 64);
      indices.push(index);
    }

    // Mirror the indices for symmetry
    return [...indices, ...indices.reverse()];
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current || !audioData) return;

    const halfCount = count / 2;

    for (let i = 0; i < count; i++) {
      // Get frequency data
      const freqIndex = Math.min(frequencyIndices[i], audioData.length - 1);
      const value = audioData[freqIndex] || 0;

      // Normalize value (0-1)
      const normalizedValue = value / 255;

      // Target height with base minimum
      const targetValue = normalizedValue * 4 + 0.1;

      // Smooth animation
      const easing = targetValue > animatedValues.current[i] ? 0.3 : 0.1;
      animatedValues.current[i] +=
        (targetValue - animatedValues.current[i]) * easing * (60 * delta);

      // Position calculation - start from center and expand outward
      let xPos;

      if (i < halfCount) {
        // First half goes left from center
        xPos = -((halfCount - i) * 0.3);
      } else {
        // Second half goes right from center
        xPos = (i - halfCount + 1) * 0.3;
      }

      // Position and scale the bar
      tempObject.position.set(xPos, animatedValues.current[i] / 2, 0);
      tempObject.scale.set(0.2, animatedValues.current[i], 0.2);
      tempObject.updateMatrix();

      // Apply to instanced mesh
      meshRef.current.setMatrixAt(i, tempObject.matrix);

      // Color based on position and amplitude
      const colorIndex = Math.min(
        Math.floor((i / count) * colorPalette.colors.length),
        colorPalette.colors.length - 1
      );

      const color = new THREE.Color(colorPalette.colors[colorIndex]);
      color.multiplyScalar(0.5 + animatedValues.current[i] * 0.5); // Brighten with amplitude

      meshRef.current.setColorAt(i, color);
    }

    // Update the mesh
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.2, 1, 0.2]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
};

export default WaveformBars;
