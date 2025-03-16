import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

// Create a gradient texture that fades from white to transparent
const createGradientTexture = () => {
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

  return canvas;
};

const AudioBars = ({ audioData }: VisualizerProps) => {
  const groupRef = useRef<THREE.Group>(null);
  // Reduce the number of bars for better performance
  const count = 48; // Reduced from 64 to 48
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const materialRefs = useRef<THREE.ShaderMaterial[]>([]);
  const colorArrayRef = useRef<Float32Array[]>([]);

  // Get color palette
  const { getShaderColor, threeColors } = useColorPalette();

  // Create gradient texture with memoization
  const gradientTexture = useMemo(() => {
    // Only create texture in browser environment
    if (typeof window === "undefined") return null;

    const canvas = createGradientTexture();
    if (!canvas) return null;

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
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

  // Create a frequency mapping for symmetrical arrangement
  const frequencyMapping = useMemo(() => {
    // Create a mapping that places similar frequencies on opposite sides
    const mapping = new Array(count);

    // For each position in the circle
    for (let i = 0; i < count; i++) {
      // Map to a frequency index that creates symmetry
      // This creates a mirror effect where low frequencies are on opposite sides
      // and high frequencies are also on opposite sides
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

  // Convert THREE.Color to shader-compatible [r,g,b] array
  const colorToArray = useCallback(
    (color: THREE.Color): [number, number, number] => {
      return [color.r, color.g, color.b];
    },
    []
  );

  // Create shader material with gradient effect and transparency
  const createGradientMaterial = useCallback(
    (index: number) => {
      // Calculate normalized position in the gradient (0-1)
      // Map the circle position to a gradient position
      const gradientPosition = index / (count - 1);

      // Get color from gradient
      const color = getGradientColor(gradientPosition);
      const [r, g, b] = colorToArray(color);

      // Create a uniform for the color that can be updated
      const colorArray = new Float32Array([r, g, b]);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: colorArray },
          gradientMap: { value: gradientTexture },
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
        uniform sampler2D gradientMap;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          // Sample the gradient map for alpha
          vec4 gradientColor = texture2D(gradientMap, vec2(0.5, vUv.y));
          
          // Create gradient effect based on y position (0 at bottom, 1 at top)
          float normalizedY = (vPosition.y + 0.5) / 1.0;
          float gradientFactor = smoothstep(0.0, 1.0, normalizedY);
          
          // Apply gradient to color
          vec3 finalColor = color * (0.5 + gradientFactor * 0.5);
          
          // Add glow effect at the top
          float glow = 0.5 * gradientFactor;
          finalColor += color * glow;
          
          // Use the gradient map's alpha for transparency
          gl_FragColor = vec4(finalColor, gradientColor.a);
        }
      `,
        transparent: true,
        side: THREE.DoubleSide,
      });

      return { material, colorArray };
    },
    [count, getGradientColor, colorToArray, gradientTexture]
  );

  // Cleanup function to dispose resources
  const cleanupResources = useCallback(() => {
    if (meshRefs.current && meshRefs.current.length > 0) {
      meshRefs.current.forEach((mesh) => {
        if (mesh) {
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    }

    if (materialRefs.current && materialRefs.current.length > 0) {
      materialRefs.current.forEach((material) => {
        if (material) material.dispose();
      });
    }

    // Dispose gradient texture
    if (gradientTexture) {
      gradientTexture.dispose();
    }

    // Clear arrays
    meshRefs.current = [];
    materialRefs.current = [];
    colorArrayRef.current = [];

    // Clear group children
    if (groupRef.current) {
      while (groupRef.current.children.length) {
        const child = groupRef.current.children[0];
        groupRef.current.remove(child);
      }
    }
  }, [gradientTexture]);

  // Create all bars on mount
  useEffect(() => {
    if (!groupRef.current || !gradientTexture) return;

    // Clean up existing resources
    cleanupResources();

    // Create new meshes for each bar
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 3;

      // Create cylinder geometry for this bar
      // Parameters: radiusTop, radiusBottom, height, radialSegments, heightSegments
      // Reduce radial segments for better performance
      const geometry = new THREE.CylinderGeometry(0.15, 0.15, 1, 8, 1);

      // Create gradient material with color from palette
      const { material, colorArray } = createGradientMaterial(i);

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);

      // Position the bar in a circle
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      mesh.position.y = 0.5; // Default height

      // Initially hide the mesh
      mesh.visible = false;

      // Add to group
      groupRef.current.add(mesh);

      // Store references
      meshRefs.current.push(mesh);
      materialRefs.current.push(material);
      colorArrayRef.current.push(colorArray);
    }

    // Cleanup on unmount
    return () => {
      cleanupResources();
    };
  }, [count, createGradientMaterial, cleanupResources, gradientTexture]);

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

  // Update bars based on audio data - use a frame skip counter for better performance
  const frameSkipRef = useRef(0);

  useFrame(() => {
    if (
      !groupRef.current ||
      !audioData ||
      meshRefs.current.length === 0 ||
      !audioData.length
    )
      return;

    // Skip every other frame for better performance
    frameSkipRef.current = (frameSkipRef.current + 1) % 2;
    if (frameSkipRef.current !== 0) return;

    for (let i = 0; i < count; i++) {
      if (i >= meshRefs.current.length) continue;

      const mesh = meshRefs.current[i];
      const colorArray = colorArrayRef.current[i];

      // Get the corresponding frequency data using our symmetrical mapping
      const mappedIndex = frequencyMapping[i];
      const centerIndex = Math.floor(
        mappedIndex * (audioData.length / (count * 2))
      );
      const value = audioData[centerIndex] || 0;

      // Apply bell curve distribution based on the position in the circle
      // This ensures similar frequencies on opposite sides have similar bell curve factors
      const bellIndex = i < count / 2 ? i : count - 1 - i;
      const normalizedValue = (value / 255) * bellCurveDistribution[bellIndex];

      // Smooth the transition between values
      const smoothedValue = smoothInterpolate(
        prevValuesRef.current[i],
        normalizedValue,
        0.15
      );
      prevValuesRef.current[i] = smoothedValue;

      // Threshold for visibility - only show bars with significant audio data
      const threshold = 0.05;

      if (smoothedValue < threshold) {
        // Hide the cylinder if the value is below threshold
        mesh.visible = false;
      } else {
        // Show and update the cylinder if the value is above threshold
        mesh.visible = true;

        // Scale the bar based on audio intensity - cylinders are along Y axis by default
        mesh.scale.y = smoothedValue * 5 + 0.2;

        // Update position to keep the bottom of the cylinder at ground level
        // For cylinders, the origin is at the center, so we need to move it up by half its height
        mesh.position.y = mesh.scale.y / 2;

        // Update color based on audio intensity but keep the base color from the palette
        const intensity = smoothedValue;

        // Calculate normalized position in the gradient (0-1)
        const gradientPosition = i / (count - 1);

        // Get color from gradient
        const color = getGradientColor(gradientPosition);
        const [r, g, b] = colorToArray(color);

        // Adjust the color based on intensity while preserving the gradient color
        colorArray[0] = r * (0.5 + intensity * 0.5); // Adjust red component
        colorArray[1] = g * (0.5 + intensity * 0.5); // Adjust green component
        colorArray[2] = b * (0.5 + intensity * 0.5); // Adjust blue component
      }
    }
  });

  return <group ref={groupRef} />;
};

export default AudioBars;
