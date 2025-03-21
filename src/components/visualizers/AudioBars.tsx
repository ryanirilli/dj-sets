import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";

// Shader for gradient fade effect on the cylinders
const cylinderVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cylinderFragmentShader = `
  uniform vec3 color;
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    // Create gradient from bottom (0) to top (1)
    // Normalize y position to 0-1 range
    float normalizedY = (vPosition.y + 0.5) / 1.0;
    float fadeStrength = smoothstep(0.0, 0.9, normalizedY);
    
    // Apply gradient to opacity
    float finalOpacity = opacity * fadeStrength;
    
    // The time uniform is not used visually but forces the shader to update
    gl_FragColor = vec4(color, finalOpacity);
  }
`;

const AudioBars = ({ audioData }: VisualizerProps) => {
  const { isPlaying } = useAudio();
  const { colorPalette, transitionProgress } = useSceneContext();
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Configuration
  const NUM_CYLINDERS = 36; // Number of cylinders in the circle
  const CIRCLE_RADIUS = 3; // Radius of the circle
  const BASE_HEIGHT = 0.2; // Base height of cylinders
  const MAX_HEIGHT = 3; // Maximum height of cylinders
  const BASE_RADIUS = 0.15; // Radius of each cylinder

  // Create references for all cylinders
  const cylinderRefs = useRef<THREE.Mesh[]>([]);
  const shaderMaterialRefs = useRef<THREE.ShaderMaterial[]>([]);

  // Initialize refs arrays
  useMemo(() => {
    cylinderRefs.current = new Array(NUM_CYLINDERS);
    shaderMaterialRefs.current = new Array(NUM_CYLINDERS);
  }, [NUM_CYLINDERS]);

  // Create all cylinders
  const cylinders = useMemo(() => {
    const temp = [];
    shaderMaterialRefs.current = new Array(NUM_CYLINDERS);

    for (let i = 0; i < NUM_CYLINDERS; i++) {
      // Position each cylinder in a circle
      const angle = (i / NUM_CYLINDERS) * Math.PI * 2;
      const x = Math.cos(angle) * CIRCLE_RADIUS;
      const z = Math.sin(angle) * CIRCLE_RADIUS;

      // Choose material based on position in circle (creates color sections)
      const materialIndex = Math.floor(
        (i / NUM_CYLINDERS) * colorPalette.colors.length
      );

      // Use color directly from context palette
      const color = new THREE.Color(colorPalette.colors[materialIndex]);

      // Create cylinder mesh - positioned at the bottom (y=0) and pointing up
      const cylinder = (
        <mesh
          key={`cylinder-${i}`}
          position={[x, 0, z]}
          scale={[1, BASE_HEIGHT, 1]} // Y scale will be animated
          ref={(el) => {
            if (el) cylinderRefs.current[i] = el;
          }}
        >
          <cylinderGeometry
            args={[BASE_RADIUS, BASE_RADIUS, 1, 16, 1, false]}
          />
          <shaderMaterial
            ref={(el) => {
              if (el) {
                shaderMaterialRefs.current[i] = el;
              }
            }}
            vertexShader={cylinderVertexShader}
            fragmentShader={cylinderFragmentShader}
            uniforms={{
              color: { value: color },
              opacity: { value: 0.8 },
              time: { value: 0.0 },
            }}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      );

      temp.push(cylinder);
    }

    return temp;
  }, [NUM_CYLINDERS, CIRCLE_RADIUS, BASE_RADIUS]);

  // Helper function to create a bell curve distribution
  const bellCurveDistribute = (value: number, index: number, total: number) => {
    // Calculate position in the distribution (0 to 1)
    const position = index / total;

    // Create a bell curve effect (highest in the middle, tapering at edges)
    // Using a simplified Gaussian function
    const bellFactor = Math.exp(-Math.pow((position - 0.5) * 3.5, 2));

    // Mix the original value with the bell curve
    return value * (0.4 + bellFactor * 0.6);
  };

  // Map frequency data to cylinder positions for symmetric visualization
  const mapFrequencyToCylinders = (audioData: Uint8Array) => {
    // The number of frequency bands to use
    const numBands = Math.min(128, audioData.length);

    // Create array to hold processed frequency data
    const processedData = new Array(NUM_CYLINDERS).fill(0);

    // Calculate bass, mid, and treble average levels
    const bassEnd = Math.floor(numBands * 0.1);
    const midEnd = Math.floor(numBands * 0.5);

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    // Accumulate energy in each range
    for (let i = 0; i < numBands; i++) {
      const value = audioData[i] / 255; // Normalize to 0-1

      if (i < bassEnd) {
        bassSum += value;
      } else if (i < midEnd) {
        midSum += value;
      } else {
        trebleSum += value;
      }
    }

    // Normalize the sums
    const bassAvg = bassSum / bassEnd;
    const midAvg = midSum / (midEnd - bassEnd);
    const trebleAvg = trebleSum / (numBands - midEnd);

    // Create a mirrored frequency pattern for symmetry
    for (let i = 0; i < NUM_CYLINDERS; i++) {
      // Convert cylinder index to angle around the circle (0 to 2π)
      const normalizedPos = i / NUM_CYLINDERS;

      // Create mirror effect by transforming 0-1 range into 0-1-0 pattern
      const mirrorPos =
        normalizedPos < 0.5 ? normalizedPos * 2 : (1 - normalizedPos) * 2;

      // Mix frequencies based on position
      // Bass is strongest at 0° and 180° (front and back)
      // Treble is strongest at 90° and 270° (sides)
      // Mid covers the transitions

      let energy;

      if (mirrorPos < 0.33) {
        // Transition from bass to mid
        const t = mirrorPos / 0.33;
        energy = bassAvg * (1 - t) + midAvg * t;
      } else if (mirrorPos < 0.66) {
        // Transition from mid to treble
        const t = (mirrorPos - 0.33) / 0.33;
        energy = midAvg * (1 - t) + trebleAvg * t;
      } else {
        // Transition from treble back to mid
        const t = (mirrorPos - 0.66) / 0.34;
        energy = trebleAvg * (1 - t) + midAvg * t;
      }

      // Apply a bell curve to make the pattern more elegant
      processedData[i] = bellCurveDistribute(energy, i, NUM_CYLINDERS);
    }

    return processedData;
  };

  // Make sure the material updates continuously, especially during color transitions
  useFrame(() => {
    if (!cylinderRefs.current.length) return;

    // Update time to force material refresh
    timeRef.current += 0.01;

    // Force all materials to update their colors and time
    cylinderRefs.current.forEach((cylinder, i) => {
      if (cylinder && shaderMaterialRefs.current[i]) {
        const material = shaderMaterialRefs.current[i];

        if (material?.uniforms) {
          // Always update time to force shader refresh
          if (material.uniforms.time) {
            material.uniforms.time.value = timeRef.current;
          }

          // Always update color from the latest palette
          if (material.uniforms.color) {
            const colorIndex = Math.floor(
              (i / NUM_CYLINDERS) * colorPalette.colors.length
            );
            const color = new THREE.Color(colorPalette.colors[colorIndex]);
            material.uniforms.color.value.copy(color);
          }
        }
      }
    });

    // If audio data is available and playing, animate cylinders based on audio
    if (isPlaying && audioData && audioData.length > 0) {
      // Get symmetrically mapped audio data
      const mappedAudio = mapFrequencyToCylinders(audioData);

      // Apply the mapped audio data to the cylinders
      cylinderRefs.current.forEach((cylinder, i) => {
        if (cylinder && shaderMaterialRefs.current[i]) {
          // Get the energy for this cylinder
          const energy = mappedAudio[i];

          // Scale height by energy level with a minimum height
          const targetHeight = BASE_HEIGHT + energy * MAX_HEIGHT;

          // Smooth transition to target height (Y axis)
          const currentHeight = cylinder.scale.y;
          cylinder.scale.y = THREE.MathUtils.lerp(
            currentHeight,
            targetHeight,
            0.3
          );

          // Adjust position to keep bottom of cylinder at y=0
          cylinder.position.y = cylinder.scale.y / 2;

          // Get shader material for this cylinder
          const material = shaderMaterialRefs.current[i];

          // Change color based on height and current palette
          const colorIndex = Math.floor(
            (i / NUM_CYLINDERS) * colorPalette.colors.length
          );
          const nextColorIndex = (colorIndex + 1) % colorPalette.colors.length;

          // Apply color based on energy level
          const color = new THREE.Color(colorPalette.colors[colorIndex]);
          const nextColor = new THREE.Color(
            colorPalette.colors[nextColorIndex]
          );

          // Blend between colors based on energy
          color.lerp(nextColor, energy * 0.7);

          // Update the shader material color uniform
          if (material && material.uniforms && material.uniforms.color) {
            material.uniforms.color.value.copy(color);
            material.needsUpdate = true;
          }
        }
      });
    }
    // If audio is not playing, just update heights (colors are handled above)
    else if (!isPlaying) {
      // Reset or update all cylinders
      cylinderRefs.current.forEach((cylinder, i) => {
        if (cylinder && shaderMaterialRefs.current[i]) {
          // Smooth transition back to base height
          const currentHeight = cylinder.scale.y;
          if (currentHeight > BASE_HEIGHT) {
            cylinder.scale.y = THREE.MathUtils.lerp(
              currentHeight,
              BASE_HEIGHT,
              0.1
            );
            cylinder.position.y = cylinder.scale.y / 2;
          } else {
            cylinder.scale.y = BASE_HEIGHT;
            cylinder.position.y = BASE_HEIGHT / 2;
          }
        }
      });
    }
  });

  return <group ref={groupRef}>{cylinders}</group>;
};

export default AudioBars;
