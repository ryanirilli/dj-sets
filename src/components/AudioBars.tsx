import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface AudioBarsProps {
  audioData: Uint8Array | null;
}

const AudioBars = ({ audioData }: AudioBarsProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 64; // Number of bars

  // Create geometries and materials only once
  const geometry = useMemo(() => new THREE.BoxGeometry(0.3, 1, 0.3), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#00a3ff" }),
    []
  );
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const matrices = useMemo(
    () => new Array(count).fill(0).map(() => new THREE.Matrix4()),
    [count]
  );

  useEffect(() => {
    if (meshRef.current) {
      // Initialize all bars
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 3;

        tempObject.position.x = Math.cos(angle) * radius;
        tempObject.position.z = Math.sin(angle) * radius;
        tempObject.position.y = 0.5; // Default height
        tempObject.scale.set(1, 1, 1);
        tempObject.updateMatrix();

        meshRef.current.setMatrixAt(i, tempObject.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [count, tempObject]);

  useFrame(() => {
    if (!meshRef.current || !audioData) return;

    // Update each bar based on audio data
    for (let i = 0; i < count; i++) {
      const value = audioData[i] || 0;
      const normalizedValue = value / 255;
      const angle = (i / count) * Math.PI * 2;
      const radius = 3;

      tempObject.position.x = Math.cos(angle) * radius;
      tempObject.position.z = Math.sin(angle) * radius;
      tempObject.scale.y = normalizedValue * 5 + 0.2;
      tempObject.position.y = tempObject.scale.y / 2;
      tempObject.updateMatrix();

      matrices[i].copy(tempObject.matrix);
      meshRef.current.setMatrixAt(i, matrices[i]);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
    />
  );
};

export default AudioBars;
