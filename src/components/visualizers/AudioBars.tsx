import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

// Create a singleton gradient texture that can be reused across component instances
let globalGradientTexture: THREE.CanvasTexture | null = null;
let globalGeometry: THREE.CylinderGeometry | null = null;

// Create a gradient texture that fades from white to transparent
const createGradientTexture = () => {
  // Return the existing texture if already created
  if (globalGradientTexture) return globalGradientTexture;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Create a vertical gradient from transparent at bottom to white at top
  const gradient = ctx.createLinearGradient(0, size, 0, 0);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.0)"); // Transparent at bottom
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.7)"); // Start becoming solid at 30%
  gradient.addColorStop(1, "rgba(255, 255, 255, 1.0)"); // Solid at top

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  globalGradientTexture = new THREE.CanvasTexture(canvas);
  globalGradientTexture.needsUpdate = true;
  return globalGradientTexture;
};

// Create a shared cylinder geometry
const getSharedGeometry = () => {
  if (globalGeometry) return globalGeometry;

  // Use lower segment count for better performance
  globalGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1, 6, 1);
  return globalGeometry;
};

const AudioBars = ({ audioData }: VisualizerProps) => {
  const groupRef = useRef<THREE.Group>(null);

  // Further reduce the number of bars for better performance
  const count = 36; // Reduced from 48 to 36

  const meshRefs = useRef<THREE.Mesh[]>([]);
  const materialRefs = useRef<THREE.ShaderMaterial[]>([]);
  const colorArrayRef = useRef<Float32Array[]>([]);

  // Flag to track whether bars have been initialized
  const initializedRef = useRef(false);

  // Get color palette
  const { threeColors } = useColorPalette();

  // Get gradient texture - now using the singleton
  const gradientTexture = useMemo(() => {
    // Only create texture in browser environment
    if (typeof window === "undefined") return null;
    return createGradientTexture();
  }, []);

  // Create a bell curve distribution for the frequencies
  const bellCurveDistribution = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create a bell curve factor (0-1) with peak in the middle
      const x = (i - count / 2) / (count / 4); // Normalize to [-2, 2]
      const bellFactor = Math.exp(-0.5 * x * x); // Gaussian distribution
      return bellFactor;
    });
  }, [count]);

  // Create a frequency mapping for symmetrical arrangement - only compute once
  const frequencyMapping = useMemo(() => {
    // Create a mapping that places similar frequencies on opposite sides
    const mapping = new Array(count);

    // For each position in the circle
    for (let i = 0; i < count; i++) {
      // Map to a frequency index that creates symmetry
      if (i < count / 2) {
        // First half of the circle gets frequencies from low to mid
        mapping[i] = Math.floor(i * 2);
      } else {
        // Second half of the circle gets frequencies from low to mid in reverse
        mapping[i] = Math.floor((count - 1 - i) * 2);
      }
    }

    return mapping;
  }, [count]);

  // Cached color arrays for each color in the palette to avoid recreating
  const colorArrayCache = useMemo(() => {
    return threeColors.map(
      (color) => new Float32Array([color.r, color.g, color.b])
    );
  }, [threeColors]);

  // Pre-compute color arrays for each position in the gradient
  const positionColorArrays = useMemo(() => {
    // Create 36 pre-computed color arrays (one for each bar)
    return Array(count)
      .fill(0)
      .map((_, i) => {
        const gradientPosition = i / (count - 1);

        // Get the segment in the color palette
        const segmentCount = threeColors.length - 1;
        const segmentPosition = gradientPosition * segmentCount;
        const segmentIndex = Math.min(
          Math.floor(segmentPosition),
          segmentCount - 1
        );
        const segmentT = segmentPosition - segmentIndex;

        // Get the two colors to interpolate between
        const colorA = threeColors[segmentIndex];
        const colorB = threeColors[segmentIndex + 1];

        // Pre-compute the interpolated color
        const r = colorA.r + (colorB.r - colorA.r) * segmentT;
        const g = colorA.g + (colorB.g - colorA.g) * segmentT;
        const b = colorA.b + (colorB.b - colorA.b) * segmentT;

        // Store as a Float32Array for direct use in shader
        return new Float32Array([r, g, b]);
      });
  }, [count, threeColors]);

  // Create shader material with gradient effect and transparency
  const createGradientMaterial = useCallback(
    (index: number) => {
      // Get pre-computed color array for this position
      const colorArray = new Float32Array(positionColorArrays[index]);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: colorArray },
          gradientMap: { value: gradientTexture },
          intensity: { value: 0.0 }, // Add an intensity uniform to avoid recreating color array
        },
        vertexShader: `
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        uniform sampler2D gradientMap;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          // Sample the gradient map for alpha
          vec4 gradientColor = texture2D(gradientMap, vec2(0.5, vUv.y));
          
          // Create gradient effect based on y position
          float normalizedY = (vPosition.y + 0.5) / 1.0;
          float gradientFactor = smoothstep(0.0, 1.0, normalizedY);
          
          // Apply gradient to color with intensity boost
          vec3 finalColor = color * (0.5 + gradientFactor * 0.5) * (1.0 + intensity * 0.5);
          
          // Use the gradient map's alpha for transparency
          gl_FragColor = vec4(finalColor, gradientColor.a);
        }
      `,
        transparent: true,
        side: THREE.DoubleSide,
      });

      return { material, colorArray };
    },
    [gradientTexture, positionColorArrays]
  );

  // Initialize all bars once
  useEffect(() => {
    if (!groupRef.current || !gradientTexture || initializedRef.current) return;

    const geometry = getSharedGeometry();

    // Create new meshes for each bar only if not already initialized
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 3;

      // Create gradient material with color from palette
      const { material, colorArray } = createGradientMaterial(i);

      // Create mesh using shared geometry
      const mesh = new THREE.Mesh(geometry, material);

      // Position the bar in a circle
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      mesh.position.y = 0.5; // Default height

      // All bars are created with a minimal scale rather than being hidden
      // This avoids the expensive show/hide operations
      mesh.scale.y = 0.01;

      // Add to group
      groupRef.current.add(mesh);

      // Store references
      meshRefs.current.push(mesh);
      materialRefs.current.push(material);
      colorArrayRef.current.push(colorArray);
    }

    initializedRef.current = true;

    // No cleanup - we keep the objects around for reuse
  }, [count, createGradientMaterial, gradientTexture]);

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

  // Update bars based on audio data
  // Use a consistent frame rate for animation
  const frameSkipRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animationSpeedRef = useRef(1 / 30); // Target 30fps for animations

  useFrame(({ clock }) => {
    const currentTime = clock.getElapsedTime();
    if (currentTime - lastTimeRef.current < animationSpeedRef.current) return;
    lastTimeRef.current = currentTime;

    if (
      !groupRef.current ||
      !audioData ||
      meshRefs.current.length === 0 ||
      !audioData.length ||
      !initializedRef.current
    )
      return;

    for (let i = 0; i < count; i++) {
      if (i >= meshRefs.current.length) continue;

      const mesh = meshRefs.current[i];
      const material = materialRefs.current[i];

      // Get the corresponding frequency data using our symmetrical mapping
      const mappedIndex = frequencyMapping[i];
      const centerIndex = Math.floor(
        mappedIndex * (audioData.length / (count * 2))
      );
      const value = audioData[centerIndex] || 0;

      // Apply bell curve distribution
      const bellIndex = i < count / 2 ? i : count - 1 - i;
      const normalizedValue = (value / 255) * bellCurveDistribution[bellIndex];

      // Smooth the transition between values - use a smaller factor for smoother transitions
      const smoothedValue = smoothInterpolate(
        prevValuesRef.current[i],
        normalizedValue,
        0.1 // Reduced from 0.15 for smoother transitions
      );
      prevValuesRef.current[i] = smoothedValue;

      // Never hide bars - just make them very small when below threshold
      const minScale = 0.01; // Minimum scale instead of hiding
      const maxScale = 5; // Maximum scale factor

      // Scale the bar based on audio intensity
      mesh.scale.y = Math.max(minScale, smoothedValue * maxScale + 0.2);

      // Update position to keep the bottom of the cylinder at ground level
      mesh.position.y = mesh.scale.y / 2;

      // Update intensity uniform instead of recreating color arrays
      if (material.uniforms.intensity) {
        material.uniforms.intensity.value = smoothedValue;
      }
    }
  });

  // Return the group without any rotation or positioning
  return <group ref={groupRef} />;
};

export default AudioBars;
