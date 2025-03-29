import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";

const SinWaveVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying } = useAudio();
  const { colorPalette } = useSceneContext();
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Configuration
  const NUM_WAVES = 6; // Number of sine waves
  const POINTS_PER_WAVE = 100; // Points per sine wave
  const WAVE_WIDTH = 16; // Width of the sine wave - increased to provide more space for fading
  const WAVE_HEIGHT_BASE = 0.5; // Base height of sine wave
  const MAX_WAVE_HEIGHT = 3; // Maximum height of sine wave
  const WAVE_SPACING = 0.7; // Vertical spacing between waves
  const FADE_PERCENT = 0.15; // Percentage of the wave that fades out at each end

  // Create references for all wave lines
  const lineRefs = useRef<THREE.Line[]>([]);
  const waveAmplitudes = useRef<number[]>(
    new Array(NUM_WAVES).fill(WAVE_HEIGHT_BASE)
  );

  // Create sine wave geometry with fade-out on edges
  const createSineWaveGeometry = (
    frequency: number,
    phase: number,
    amplitude: number
  ) => {
    const points = [];
    const step = WAVE_WIDTH / (POINTS_PER_WAVE - 1);
    const colors = []; // For vertex colors to create fade effect
    const fadeWidth = WAVE_WIDTH * FADE_PERCENT; // Width of the fade area on each side

    for (let i = 0; i < POINTS_PER_WAVE; i++) {
      const x = -WAVE_WIDTH / 2 + i * step;
      const y = Math.sin(frequency * x + phase) * amplitude;
      points.push(new THREE.Vector3(x, y, 0));

      // Calculate fade factor for this point
      let fade = 1.0;
      const distFromLeft = x + WAVE_WIDTH / 2;
      const distFromRight = WAVE_WIDTH / 2 - x;

      // Apply fade on the left edge
      if (distFromLeft < fadeWidth) {
        fade = Math.pow(distFromLeft / fadeWidth, 2);
      }

      // Apply fade on the right edge
      if (distFromRight < fadeWidth) {
        fade = Math.min(fade, Math.pow(distFromRight / fadeWidth, 2));
      }

      // Add color with alpha for fading
      colors.push(fade, fade, fade);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Add vertex colors for opacity fading
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    return geometry;
  };

  // Create fade-capable tube geometry
  const createTubeGeometryWithFade = (
    curve: THREE.CatmullRomCurve3,
    segments: number,
    radius: number
  ) => {
    // Create standard tube geometry
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      segments,
      radius,
      8,
      false
    );

    // Create colors array for fading
    const colors = [];
    const positions = tubeGeometry.attributes.position;
    const count = positions.count;
    const fadeWidth = WAVE_WIDTH * FADE_PERCENT;

    // For each vertex in the tube
    for (let i = 0; i < count; i++) {
      // Extract position
      const x = positions.getX(i);

      // Calculate fade based on position
      let fade = 1.0;
      const distFromLeft = x + WAVE_WIDTH / 2;
      const distFromRight = WAVE_WIDTH / 2 - x;

      // Apply fade on the left edge
      if (distFromLeft < fadeWidth) {
        fade = Math.pow(distFromLeft / fadeWidth, 2);
      }

      // Apply fade on the right edge
      if (distFromRight < fadeWidth) {
        fade = Math.min(fade, Math.pow(distFromRight / fadeWidth, 2));
      }

      // Add color with alpha for fading
      colors.push(fade, fade, fade);
    }

    // Add color attribute for fading
    tubeGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    return tubeGeometry;
  };

  // Update material for line to use vertex colors for fading
  const materialInstances = useMemo(() => {
    const instances = [];

    for (let i = 0; i < NUM_WAVES; i++) {
      // Calculate color based on position in the palette
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);

      // Make the color more vibrant for fluorescent effect
      color.multiplyScalar(1.5);

      // Create a material with emissive glow that reads vertex colors
      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        linewidth: 3, // Thicker lines (note: only works in WebGPU)
        toneMapped: false, // Better color brightness
        vertexColors: true, // Use vertex colors for fading
      });

      instances.push(material);
    }

    return instances;
  }, [NUM_WAVES, colorPalette]);

  // Add a glowing tube around each line with fade effect
  const glowMaterialInstances = useMemo(() => {
    const instances = [];

    for (let i = 0; i < NUM_WAVES; i++) {
      // Calculate color based on position in the palette
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);

      // Create a material with glow effect that reads vertex colors
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        toneMapped: false,
        vertexColors: true, // Use vertex colors for fading
      });

      instances.push(material);
    }

    return instances;
  }, [NUM_WAVES, colorPalette]);

  // Initialize refs array
  useMemo(() => {
    lineRefs.current = new Array(NUM_WAVES);
  }, [NUM_WAVES]);

  // Create all wave meshes
  const waves = useMemo(() => {
    const temp = [];

    for (let i = 0; i < NUM_WAVES; i++) {
      // Different frequency and phase for each wave
      const frequency = 0.5 + i * 0.2;
      const phase = (i * Math.PI) / 4;
      const zPos = i * WAVE_SPACING - (NUM_WAVES * WAVE_SPACING) / 2;

      // Initial sine wave geometry
      const geometry = createSineWaveGeometry(
        frequency,
        phase,
        WAVE_HEIGHT_BASE
      );

      // Create main line - using Line for solid lines instead of LineSegments which can appear dashed
      const line = (
        <primitive
          key={`wave-${i}`}
          object={new THREE.Line(geometry, materialInstances[i])}
          position={[0, 0, zPos]}
          ref={(el: THREE.Line | null) => {
            if (el) lineRefs.current[i] = el;
          }}
        />
      );

      // Add a glow tube around each line for better visibility
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: POINTS_PER_WAVE }).map((_, j) => {
          const x = -WAVE_WIDTH / 2 + (j * WAVE_WIDTH) / (POINTS_PER_WAVE - 1);
          const y = Math.sin(frequency * x + phase) * WAVE_HEIGHT_BASE;
          return new THREE.Vector3(x, y, 0);
        })
      );

      // Create tube with fading
      const tubeGeometry = createTubeGeometryWithFade(
        curve,
        POINTS_PER_WAVE,
        0.05
      );

      const tube = (
        <mesh key={`glow-${i}`} position={[0, 0, zPos]}>
          <primitive object={tubeGeometry} attach="geometry" />
          <primitive object={glowMaterialInstances[i]} attach="material" />
        </mesh>
      );

      temp.push(line);
      temp.push(tube);
    }

    return temp;
  }, [NUM_WAVES, WAVE_SPACING, materialInstances, glowMaterialInstances]);

  // Helper function to create a frequency distribution
  const getFrequencyBand = (
    audioData: Uint8Array,
    startPercent: number,
    endPercent: number
  ) => {
    if (!audioData || audioData.length === 0) return 0;

    const start = Math.floor(audioData.length * startPercent);
    const end = Math.floor(audioData.length * endPercent);
    let sum = 0;

    for (let i = start; i < end; i++) {
      sum += audioData[i] / 255; // Normalize to 0-1
    }

    return sum / (end - start); // Average
  };

  // Update waves based on audio data
  useFrame(() => {
    if (!lineRefs.current.length) return;

    // Update time to force material refresh
    timeRef.current += 0.01;

    // Update material colors from the palette with enhanced brightness for fluorescent effect
    materialInstances.forEach((material, i) => {
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);
      // Make the color more vibrant
      color.multiplyScalar(1.5);
      (material as THREE.LineBasicMaterial).color = color;
    });

    // Update glow materials
    glowMaterialInstances.forEach((material, i) => {
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);
      // Make the color more vibrant
      color.multiplyScalar(1.5);
      (material as THREE.MeshBasicMaterial).color = color;
    });

    // If audio is playing and we have data
    if (isPlaying && audioData && audioData.length > 0) {
      // Divide audio spectrum into bands for different waves
      const bandSize = 1 / NUM_WAVES;

      // Update each wave based on its frequency band
      lineRefs.current.forEach((line, i) => {
        if (line) {
          // Get frequency energy for this wave (divided into bands)
          const startPercent = i * bandSize;
          const endPercent = (i + 1) * bandSize;
          const energy = getFrequencyBand(audioData, startPercent, endPercent);

          // Calculate target amplitude with some additional variation
          const targetAmplitude = WAVE_HEIGHT_BASE + energy * MAX_WAVE_HEIGHT;

          // Smooth transition to target amplitude
          waveAmplitudes.current[i] = THREE.MathUtils.lerp(
            waveAmplitudes.current[i],
            targetAmplitude,
            0.15
          );

          // Calculate wave parameters - each wave has different frequency and phase
          const frequency = 0.5 + i * 0.2;
          // Add movement based on time
          const phase = i * (Math.PI / 4) + timeRef.current * (1 + i * 0.2);

          // Update geometry with new parameters
          const newGeometry = createSineWaveGeometry(
            frequency,
            phase,
            waveAmplitudes.current[i]
          );
          // Access the geometry property of the line (Line object)
          (line as THREE.Line).geometry.dispose();
          (line as THREE.Line).geometry = newGeometry;

          // Update material opacity based on energy
          const material = materialInstances[i] as THREE.LineBasicMaterial;
          // More energy = more opacity
          const targetOpacity = 0.6 + energy * 0.4;
          material.opacity = THREE.MathUtils.lerp(
            material.opacity || 0,
            targetOpacity,
            0.2
          );

          // Update the glow tube to match the line
          const tube = groupRef.current?.children[i * 2 + 1] as THREE.Mesh;
          if (tube) {
            // Dispose old geometry
            tube.geometry.dispose();

            // Create new curve based on the new sine wave
            const newCurve = new THREE.CatmullRomCurve3(
              Array.from({ length: POINTS_PER_WAVE }).map((_, j) => {
                const x =
                  -WAVE_WIDTH / 2 + (j * WAVE_WIDTH) / (POINTS_PER_WAVE - 1);
                const y =
                  Math.sin(frequency * x + phase) * waveAmplitudes.current[i];
                return new THREE.Vector3(x, y, 0);
              })
            );

            // Create and assign new tube geometry with fade effect
            tube.geometry = createTubeGeometryWithFade(
              newCurve,
              POINTS_PER_WAVE,
              0.05 + energy * 0.05 // Increase radius with energy
            );

            // Update glow opacity
            const glowMaterial = glowMaterialInstances[
              i
            ] as THREE.MeshBasicMaterial;
            glowMaterial.opacity = THREE.MathUtils.lerp(
              glowMaterial.opacity || 0,
              0.2 + energy * 0.3,
              0.2
            );
          }
        }
      });
    }
    // If audio is not playing, animate with subtle movement
    else {
      lineRefs.current.forEach((line, i) => {
        if (line) {
          // Gradually return to base amplitude
          waveAmplitudes.current[i] = THREE.MathUtils.lerp(
            waveAmplitudes.current[i],
            WAVE_HEIGHT_BASE,
            0.05
          );

          // Keep some movement even when not playing
          const frequency = 0.5 + i * 0.2;
          const phase = timeRef.current * 0.2 + i * (Math.PI / 4);

          // Update geometry
          const newGeometry = createSineWaveGeometry(
            frequency,
            phase,
            waveAmplitudes.current[i]
          );
          // Access the geometry property of the line (Line object)
          (line as THREE.Line).geometry.dispose();
          (line as THREE.Line).geometry = newGeometry;

          // Fade out opacity
          const material = materialInstances[i] as THREE.LineBasicMaterial;
          material.opacity = THREE.MathUtils.lerp(
            material.opacity || 0,
            0.6,
            0.05
          );

          // Update the glow tube
          const tube = groupRef.current?.children[i * 2 + 1] as THREE.Mesh;
          if (tube) {
            // Dispose old geometry
            tube.geometry.dispose();

            // Create new curve based on the new sine wave
            const newCurve = new THREE.CatmullRomCurve3(
              Array.from({ length: POINTS_PER_WAVE }).map((_, j) => {
                const x =
                  -WAVE_WIDTH / 2 + (j * WAVE_WIDTH) / (POINTS_PER_WAVE - 1);
                const y =
                  Math.sin(frequency * x + phase) * waveAmplitudes.current[i];
                return new THREE.Vector3(x, y, 0);
              })
            );

            // Create and assign new tube geometry with fade effect
            tube.geometry = createTubeGeometryWithFade(
              newCurve,
              POINTS_PER_WAVE,
              0.05 // Base radius
            );

            // Update glow opacity
            const glowMaterial = glowMaterialInstances[
              i
            ] as THREE.MeshBasicMaterial;
            glowMaterial.opacity = THREE.MathUtils.lerp(
              glowMaterial.opacity || 0,
              0.2,
              0.05
            );
          }
        }
      });
    }
  });

  return <group ref={groupRef}>{waves}</group>;
};

export default SinWaveVisualizer;
