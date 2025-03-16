import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useColorPalette } from "@/hooks/useColorPalette";

export interface AudioBarsProps {
  audioData: Uint8Array | null;
}

const AudioBars = ({ audioData }: AudioBarsProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 64; // Number of bars
  const { threeColors } = useColorPalette();

  // Create geometries only once
  const geometry = useMemo(() => new THREE.BoxGeometry(0.3, 1, 0.3), []);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const matrices = useMemo(
    () => new Array(count).fill(0).map(() => new THREE.Matrix4()),
    [count]
  );

  // Store materials for each bar
  const materialRefs = useRef<THREE.MeshStandardMaterial[]>([]);

  // Interpolate between two colors
  const lerpColor = useCallback(
    (colorA: THREE.Color, colorB: THREE.Color, t: number): THREE.Color => {
      return new THREE.Color(
        colorA.r + (colorB.r - colorA.r) * t,
        colorA.g + (colorB.g - colorA.g) * t,
        colorA.b + (colorB.b - colorA.b) * t
      );
    },
    []
  );

  // Get color from palette gradient based on position (0-1)
  const getGradientColor = useCallback(
    (position: number): THREE.Color => {
      // Ensure position is between 0 and 1
      const t = Math.max(0, Math.min(1, position));

      // Map position to palette segment
      // For 4 colors, we have 3 segments: [0-0.333], [0.333-0.667], [0.667-1]
      const segmentCount = threeColors.length - 1;
      const segmentPosition = t * segmentCount;
      const segmentIndex = Math.min(
        Math.floor(segmentPosition),
        segmentCount - 1
      );

      // Calculate interpolation factor within this segment
      const segmentT = segmentPosition - segmentIndex;

      // Get the two colors to interpolate between
      const colorA = threeColors[segmentIndex];
      const colorB = threeColors[segmentIndex + 1];

      // Interpolate between the two colors
      return lerpColor(colorA, colorB, segmentT);
    },
    [threeColors, lerpColor]
  );

  // Create a bell curve distribution for the frequencies
  const bellCurveDistribution = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create a bell curve factor (0-1) with peak in the middle
      const x = (i - count / 2) / (count / 4); // Normalize to [-2, 2]
      const bellFactor = Math.exp(-0.5 * x * x); // Gaussian distribution
      return bellFactor;
    });
  }, [count]);

  // Create materials for each bar
  const createMaterials = useCallback(() => {
    const materials: THREE.MeshStandardMaterial[] = [];

    for (let i = 0; i < count; i++) {
      // Calculate normalized position in the gradient (0-1)
      const gradientPosition = i / (count - 1);

      // Get color from gradient
      const color = getGradientColor(gradientPosition);

      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.3),
        metalness: 0.3,
        roughness: 0.7,
      });

      materials.push(material);
    }

    return materials;
  }, [count, getGradientColor]);

  // Initialize bars and materials
  useEffect(() => {
    if (!meshRef.current) return;

    // Create materials
    materialRefs.current = createMaterials();

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

    // Apply materials to each instance
    if (meshRef.current.material instanceof THREE.Material) {
      meshRef.current.material.dispose();
    }

    meshRef.current.material = materialRefs.current;
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Cleanup function
    return () => {
      materialRefs.current.forEach((material) => {
        if (material) material.dispose();
      });
    };
  }, [count, tempObject, createMaterials]);

  // Store previous values for smooth transitions
  const prevValuesRef = useRef<number[]>(Array(count).fill(0));

  // Smoothly interpolate between values to prevent flickering
  const smoothInterpolate = (
    current: number,
    target: number,
    factor: number = 0.3
  ): number => {
    return current + (target - current) * factor;
  };

  useFrame(() => {
    if (!meshRef.current || !audioData) return;

    // Update each bar based on audio data
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 3;

      // Get the corresponding frequency data
      // Map the index to the audio data array with bell curve influence
      const centerIndex = Math.floor(i * (audioData.length / count));
      const value = audioData[centerIndex] || 0;
      const normalizedValue = (value / 255) * bellCurveDistribution[i];

      // Smooth the transition between values
      const smoothedValue = smoothInterpolate(
        prevValuesRef.current[i],
        normalizedValue,
        0.15
      );
      prevValuesRef.current[i] = smoothedValue;

      // Position and scale the bar
      tempObject.position.x = Math.cos(angle) * radius;
      tempObject.position.z = Math.sin(angle) * radius;
      tempObject.scale.y = smoothedValue * 5 + 0.2;
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
      args={[geometry, undefined, count]}
      castShadow
      receiveShadow
    />
  );
};

export default AudioBars;
