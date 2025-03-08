import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface WaveformBarsProps {
  audioData: Uint8Array | null;
}

const WaveformBars = ({ audioData }: WaveformBarsProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  const count = 64; // Number of bars

  useFrame(() => {
    if (!meshRef.current || !audioData) return;

    // Update each bar based on audio data
    for (let i = 0; i < count; i++) {
      const value = audioData[i] || 0;
      const normalizedValue = value / 255;

      // Position bars in a line
      tempObject.position.x = (i - count / 2) * 0.4;
      tempObject.position.z = 0;

      // Scale bars based on audio frequency data
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
