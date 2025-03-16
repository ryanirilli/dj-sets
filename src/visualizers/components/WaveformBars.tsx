import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

const WaveformBars = ({ audioData }: VisualizerProps) => {
  const groupRef = useRef<THREE.Group>(null);
  // Reduce the number of bars for better performance
  const count = 48; // Reduced from 64 to 48
  const { getThreeColor, threeColors } = useColorPalette();

  // Animation state references
  const timeRef = useRef(0);
  const materialRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const meshRefs = useRef<THREE.Mesh[]>([]);

  // Store previous values for smooth transitions
  const prevHeightsRef = useRef<number[]>(Array(count).fill(0.1));
  const prevEmissiveRef = useRef<number[]>(Array(count).fill(0.2));

  // Frame skip counter for better performance
  const frameSkipRef = useRef(0);

  // Create a symmetrical distribution for the frequencies
  const symmetricalDistribution = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create a symmetrical factor (0-1) with peak in the middle
      const x = (i - count / 2) / (count / 4); // Normalize to [-2, 2]
      const factor = Math.exp(-0.5 * x * x); // Gaussian distribution
      return factor;
    });
  }, [count]);

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

  // Create geometry with fewer segments for better performance
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(0.2, 1, 0.2);
  }, []);

  // Create a base platform for the equalizer
  const basePlatformGeometry = useMemo(() => {
    return new THREE.BoxGeometry(count * 0.4 + 1, 0.1, 0.6);
  }, [count]);

  // Cleanup function to dispose resources
  const cleanupResources = useCallback(() => {
    if (groupRef.current) {
      while (groupRef.current.children.length > 0) {
        const child = groupRef.current.children[0] as THREE.Mesh;
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
        groupRef.current.remove(child);
      }
    }

    // Dispose materials
    materialRefs.current.forEach((material) => {
      if (material) material.dispose();
    });
    materialRefs.current = [];
    meshRefs.current = [];

    // Dispose geometry
    if (geometry) geometry.dispose();
    if (basePlatformGeometry) basePlatformGeometry.dispose();
  }, [geometry, basePlatformGeometry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Create bars on mount
  useEffect(() => {
    if (!groupRef.current) return;

    // Clean up existing resources
    cleanupResources();

    // Create base platform for equalizer
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#222222",
      metalness: 0.5,
      roughness: 0.8,
    });

    const basePlatform = new THREE.Mesh(basePlatformGeometry, baseMaterial);
    basePlatform.position.y = 0;
    groupRef.current.add(basePlatform);

    // Pre-create all materials for each bar position
    const materials: THREE.MeshStandardMaterial[] = [];

    // Create materials for each bar with gradient colors
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

    materialRefs.current = materials;

    // Create individual meshes for each bar in a line
    for (let i = 0; i < count; i++) {
      // Position bars in a line
      const xPos = (i - count / 2) * 0.4;

      // Create mesh with its dedicated material
      const mesh = new THREE.Mesh(geometry, materials[i]);

      // Position in a line - start at y=0.1 (just above the platform)
      mesh.position.x = xPos;
      mesh.position.z = 0;
      mesh.position.y = 0.55; // Position at half height of minimum bar (0.1 platform + 0.5 min height)

      // Set initial scale - minimum height of 0.1
      mesh.scale.y = 0.1;

      // Add to group
      groupRef.current.add(mesh);
      meshRefs.current.push(mesh);
    }

    // Initialize previous heights array
    prevHeightsRef.current = Array(count).fill(0.1);
    prevEmissiveRef.current = Array(count).fill(0.2);
  }, [
    count,
    geometry,
    basePlatformGeometry,
    getGradientColor,
    cleanupResources,
  ]);

  // Smoothly interpolate between values to prevent flickering
  const smoothInterpolate = (
    current: number,
    target: number,
    factor: number = 0.3
  ): number => {
    return current + (target - current) * factor;
  };

  useFrame((state) => {
    if (!groupRef.current || !audioData || meshRefs.current.length === 0)
      return;

    // Skip every other frame for better performance
    frameSkipRef.current = (frameSkipRef.current + 1) % 2;
    if (frameSkipRef.current !== 0) return;

    // Update time reference for animations - slower to reduce flickering
    timeRef.current += 0.005;

    // Update each bar based on audio data
    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      // Get the corresponding frequency data
      const centerIndex = Math.floor(i * (audioData.length / count));
      const value = audioData[centerIndex] || 0;

      // Apply symmetrical distribution
      const normalizedValue = (value / 255) * symmetricalDistribution[i];

      // Add subtle pulse effect but ensure it never goes below minimum height
      // Reduce pulse effect to minimize flickering
      const pulseEffect = Math.max(
        0,
        Math.sin(i * 0.05 + timeRef.current) * 0.02
      );

      // Ensure minimum height of 0.1 and add audio-reactive scaling
      const targetHeight = Math.max(0.1, normalizedValue * 5 + pulseEffect);

      // Smooth the transition between heights
      const smoothedHeight = smoothInterpolate(
        prevHeightsRef.current[i],
        targetHeight,
        0.15
      );
      prevHeightsRef.current[i] = smoothedHeight;

      mesh.scale.y = smoothedHeight;

      // Position the bar so it grows upward from the base
      mesh.position.y = smoothedHeight / 2 + 0.05; // Half height + half platform height

      // Get the material - each bar has its own dedicated material
      const material = materialRefs.current[i];

      if (material) {
        // Calculate target emissive intensity
        const targetEmissive = 0.2 + normalizedValue * 0.8;

        // Smooth the transition for emissive intensity
        const smoothedEmissive = smoothInterpolate(
          prevEmissiveRef.current[i],
          targetEmissive,
          0.15
        );
        prevEmissiveRef.current[i] = smoothedEmissive;

        // Update emissive intensity while maintaining the gradient color
        material.emissive.copy(material.color).multiplyScalar(smoothedEmissive);
      }
    }
  });

  return <group ref={groupRef} />;
};

export default WaveformBars;
