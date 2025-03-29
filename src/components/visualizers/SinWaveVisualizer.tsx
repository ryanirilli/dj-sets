import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";

const SinWaveVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying, onBeat, beatTime, avgAudioLevel } = useAudio();
  const { colorPalette } = useSceneContext();
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const lastBeatTimeRef = useRef(0);
  const beatPulseRef = useRef(0);
  const frequencyBandsRef = useRef<number[]>([0, 0, 0]); // [bass, mid, high]

  // Configuration
  const NUM_WAVES = 4; // Number of sine waves
  const POINTS_PER_WAVE = 100; // Points per sine wave
  const WAVE_WIDTH = 20; // Width of the sine wave - increased to provide more space for fading
  const WAVE_HEIGHT_BASE = 0.5; // Base height of sine wave
  const MAX_WAVE_HEIGHT = 2; // Maximum height of sine wave
  const WAVE_SPACING = 0.7; // Vertical spacing between waves
  const FADE_PERCENT = 0.15; // Percentage of the wave that fades out at each end
  const FLOW_SPEED = 0.8; // Speed of the flowing movement
  const BEAT_PULSE_STRENGTH = 0.6; // Strength of the beat pulse (0-1)
  const BEAT_PULSE_DECAY = 5; // How quickly the beat pulse decays
  const AUDIO_LEVEL_THRESHOLD = 25; // Minimum audio level to trigger beat pulse effects
  const HORIZONTAL_OFFSET = 4; // Amount of horizontal offset between waves
  const BAND_INFLUENCE = 0.7; // How much the frequency bands influence wave behavior

  const flowOffsetRef = useRef(0);
  // Create individual flow speeds for each wave - but keep them consistent
  const waveFlowSpeeds = useRef<number[]>(
    new Array(NUM_WAVES)
      .fill(0)
      .map(() => FLOW_SPEED * (0.85 + Math.random() * 0.3)) // Smaller range for more consistency
  );
  // Create fixed horizontal offsets for each wave to prevent glitchiness
  const waveHorizontalOffsets = useRef<number[]>(
    new Array(NUM_WAVES).fill(0).map((_, i) => i * HORIZONTAL_OFFSET)
  );

  // Assign each wave to respond to a specific frequency band - but keep it fixed
  const waveBandAssignments = useRef<number[]>(
    new Array(NUM_WAVES).fill(0).map((_, i) => {
      // Distribute waves across frequency bands evenly
      return i % 3; // 0 = low, 1 = mid, 2 = high
    })
  );

  // Create references for all wave lines
  const lineRefs = useRef<THREE.Line[]>([]);
  const waveAmplitudes = useRef<number[]>(
    new Array(NUM_WAVES).fill(WAVE_HEIGHT_BASE)
  );
  // Individual flow offsets for each wave for more varied movement
  const waveFlowPositions = useRef<number[]>(new Array(NUM_WAVES).fill(0));

  // Create sine wave geometry with fade-out on edges
  const createSineWaveGeometry = (
    frequency: number,
    phase: number,
    amplitude: number,
    horizontalOffset: number = 0,
    distortion: number = 0 // Add distortion parameter
  ) => {
    const points = [];
    const step = WAVE_WIDTH / (POINTS_PER_WAVE - 1);
    const colors = []; // For vertex colors to create fade effect
    const fadeWidth = WAVE_WIDTH * FADE_PERCENT; // Width of the fade area on each side

    for (let i = 0; i < POINTS_PER_WAVE; i++) {
      const x = -WAVE_WIDTH / 2 + i * step;

      // Apply horizontal offset to the wave by shifting the x-coordinate in the sine calculation
      let y = Math.sin(frequency * (x + horizontalOffset) + phase) * amplitude;

      // Apply distortion to the wave if distortion value is provided, but keep it subtle
      if (distortion > 0) {
        // Add higher harmonics based on distortion amount
        y +=
          Math.sin(frequency * 2 * (x + horizontalOffset) + phase * 1.5) *
          amplitude *
          0.2 *
          distortion;

        // Add minimal noise/fragmentation for high distortion to prevent glitchiness
        if (distortion > 0.5) {
          const noiseAmount = 0.1; // Lower noise amount
          const noise =
            (Math.sin(x * 50 + phase * 10) * 0.5 + 0.5) *
            noiseAmount *
            (distortion - 0.5);
          y += noise * amplitude;
        }
      }

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

  // Analyze the audio data into bass, mid, and high frequency bands
  const analyzeFrequencyBands = (audioData: Uint8Array) => {
    if (!audioData || audioData.length === 0) {
      frequencyBandsRef.current = [0, 0, 0];
      return [0, 0, 0];
    }

    // Analyze the audio data into bass, mid, and high frequency bands
    const bass = getFrequencyBand(audioData, 0, 0.1); // First 10% - low frequencies
    const mid = getFrequencyBand(audioData, 0.1, 0.5); // 10%-50% - mid frequencies
    const high = getFrequencyBand(audioData, 0.5, 1.0); // 50%-100% - high frequencies

    frequencyBandsRef.current = [bass, mid, high];
    return [bass, mid, high];
  };

  // Update waves based on audio data
  useFrame((_, delta) => {
    if (!lineRefs.current.length) return;

    // Update time to force material refresh with smooth increment
    timeRef.current += 0.01;

    // Update flow offset for continuous movement - always smooth, not affected by audio
    flowOffsetRef.current += delta * FLOW_SPEED;

    // Analyze audio data into frequency bands if playing
    const [bass, mid, high] =
      isPlaying && audioData
        ? analyzeFrequencyBands(audioData)
        : frequencyBandsRef.current;

    // Update individual flow positions for each wave with smooth, consistent motion
    // NOT influenced by audio data for horizontal flow
    for (let i = 0; i < NUM_WAVES; i++) {
      waveFlowPositions.current[i] += delta * waveFlowSpeeds.current[i];
    }

    // Handle beat pulse - only if audio level is above threshold
    const shouldApplyBeatEffects = avgAudioLevel > AUDIO_LEVEL_THRESHOLD;

    if (
      onBeat &&
      beatTime !== lastBeatTimeRef.current &&
      shouldApplyBeatEffects
    ) {
      beatPulseRef.current = 1.0; // Set pulse to max on new beat
      lastBeatTimeRef.current = beatTime;

      // No random horizontal offset changes on beats - this caused glitchiness
    } else {
      // Decay the pulse over time
      beatPulseRef.current = Math.max(
        0,
        beatPulseRef.current - delta * BEAT_PULSE_DECAY
      );
    }

    // REMOVED: Random phase offset variations that caused glitchiness
    // Instead use fixed phase offsets that only change smoothly over time

    // Update material colors from the palette with enhanced brightness based on frequency bands
    materialInstances.forEach((material, i) => {
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);

      // Enhance brightness based on the wave's assigned frequency band
      const bandIndex = waveBandAssignments.current[i];
      const bandEnergy = [bass, mid, high][bandIndex];
      const brightnessMultiplier = 1.5 + bandEnergy * 0.5;

      // Make the color more vibrant, influenced by frequency energy
      color.multiplyScalar(brightnessMultiplier);
      (material as THREE.LineBasicMaterial).color = color;
    });

    // Update glow materials
    glowMaterialInstances.forEach((material, i) => {
      const colorIndex = Math.floor(
        (i / NUM_WAVES) * colorPalette.colors.length
      );
      const color = new THREE.Color(colorPalette.colors[colorIndex]);

      // Enhance brightness based on the wave's assigned frequency band
      const bandIndex = waveBandAssignments.current[i];
      const bandEnergy = [bass, mid, high][bandIndex];
      const brightnessMultiplier = 1.5 + bandEnergy * 0.3; // Less variation

      // Make the color more vibrant, influenced by frequency energy
      color.multiplyScalar(brightnessMultiplier);
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

          // Get the assigned frequency band for this wave
          const bandIndex = waveBandAssignments.current[i];
          const bandEnergy = [bass, mid, high][bandIndex];

          // Add beat pulse to the amplitude calculation only if above threshold
          const beatAmplification = shouldApplyBeatEffects
            ? 1 + beatPulseRef.current * BEAT_PULSE_STRENGTH * (1 + i * 0.1)
            : 1;

          // Calculate target amplitude based on:
          // 1. The general energy in the wave's section of the spectrum
          // 2. The energy in the wave's assigned frequency band
          // 3. The beat pulse
          const bandAmplification = 1 + bandEnergy * BAND_INFLUENCE;
          const targetAmplitude =
            (WAVE_HEIGHT_BASE + energy * MAX_WAVE_HEIGHT) *
            beatAmplification *
            bandAmplification;

          // Smoother transition to target amplitude
          waveAmplitudes.current[i] = THREE.MathUtils.lerp(
            waveAmplitudes.current[i],
            targetAmplitude,
            0.1 // Slower lerp for smoother transitions
          );

          // Calculate wave parameters - each wave has different frequency and phase
          const baseFrequency = 0.3 + i * 0.1; // Lower base frequency for smoother waves

          // Subtle frequency variation based on bands - much less than before
          const frequencyMultiplier =
            bandIndex === 2
              ? 1 + high * 0.1 // High frequencies make waves more rippled (subtle)
              : bandIndex === 0
              ? 1 - bass * 0.05 // Bass makes waves smoother (subtle)
              : 1; // Mid range stays neutral

          const frequency = baseFrequency * frequencyMultiplier;

          // Add movement based on time with flowing offset - SMOOTH, NOT AUDIO-REACTIVE
          // Phase is now much more predictable and smooth
          const phase =
            i * (Math.PI / NUM_WAVES) + // Fixed offset based on wave index
            timeRef.current * 0.4 + // Smooth time-based movement
            waveFlowPositions.current[i]; // Individual flow speed, but no reactive multiplier

          // Apply horizontal offset - fixed per wave, no randomness
          const horizontalOffset = waveHorizontalOffsets.current[i];

          // Calculate distortion based on frequency bands - but much more subtle
          const distortion =
            bandIndex === 2
              ? high * 0.3 // High frequencies create more distortion (reduced)
              : bandIndex === 1
              ? mid * 0.1 // Mid range creates minimal distortion
              : 0; // Bass stays clean

          // Update geometry with new parameters
          const newGeometry = createSineWaveGeometry(
            frequency,
            phase,
            waveAmplitudes.current[i],
            horizontalOffset,
            distortion
          );
          // Access the geometry property of the line (Line object)
          (line as THREE.Line).geometry.dispose();
          (line as THREE.Line).geometry = newGeometry;

          // Update material opacity based on energy and beat
          const material = materialInstances[i] as THREE.LineBasicMaterial;
          // More energy and beat pulse = more opacity (if above threshold)
          const beatOpacityEffect = shouldApplyBeatEffects
            ? beatPulseRef.current * 0.3
            : 0;
          // Band-specific opacity multiplier
          const bandOpacityMultiplier =
            bandIndex === 2
              ? 1 + high * 0.2 // High frequencies are more visible
              : bandIndex === 0
              ? 1 + bass * 0.3 // Bass is more visible
              : 1 + mid * 0.1; // Mid is slightly more visible

          const targetOpacity =
            (0.6 + energy * 0.4) *
            (1 + beatOpacityEffect) *
            bandOpacityMultiplier;

          material.opacity = THREE.MathUtils.lerp(
            material.opacity || 0,
            targetOpacity,
            0.1 // Slower lerp for smoother transitions
          );

          // Update the glow tube to match the line
          const tube = groupRef.current?.children[i * 2 + 1] as THREE.Mesh;
          if (tube) {
            // Dispose old geometry
            tube.geometry.dispose();

            // Create new curve based on the new sine wave with distortion
            const newCurve = new THREE.CatmullRomCurve3(
              Array.from({ length: POINTS_PER_WAVE }).map((_, j) => {
                const x =
                  -WAVE_WIDTH / 2 + (j * WAVE_WIDTH) / (POINTS_PER_WAVE - 1);

                // Apply the same distortion logic as in createSineWaveGeometry
                let y =
                  Math.sin(frequency * (x + horizontalOffset) + phase) *
                  waveAmplitudes.current[i];

                // Apply distortion to the wave - same smooth approach as above
                if (distortion > 0) {
                  y +=
                    Math.sin(
                      frequency * 2 * (x + horizontalOffset) + phase * 1.5
                    ) *
                    waveAmplitudes.current[i] *
                    0.2 *
                    distortion;

                  if (distortion > 0.5) {
                    const noiseAmount = 0.1;
                    const noise =
                      (Math.sin(x * 50 + phase * 10) * 0.5 + 0.5) *
                      noiseAmount *
                      (distortion - 0.5);
                    y += noise * waveAmplitudes.current[i];
                  }
                }

                return new THREE.Vector3(x, y, 0);
              })
            );

            // Create and assign new tube geometry with fade effect
            const beatRadiusEffect = shouldApplyBeatEffects
              ? beatPulseRef.current * 0.05
              : 0;
            // Band-specific radius
            const bandRadiusMultiplier =
              bandIndex === 2
                ? 1 + high * 0.1 // High frequencies have thinner tubes (subtle)
                : bandIndex === 0
                ? 1 + bass * 0.2 // Bass has thicker tubes (subtle)
                : 1 + mid * 0.1; // Mid has moderate tubes (subtle)

            tube.geometry = createTubeGeometryWithFade(
              newCurve,
              POINTS_PER_WAVE,
              (0.05 + energy * 0.05 + beatRadiusEffect) * bandRadiusMultiplier
            );

            // Update glow opacity
            const glowMaterial = glowMaterialInstances[
              i
            ] as THREE.MeshBasicMaterial;
            const beatGlowEffect = shouldApplyBeatEffects
              ? beatPulseRef.current * 0.2
              : 0;

            // Band-specific glow
            const bandGlowMultiplier =
              bandIndex === 2
                ? 1 + high * 0.2 // High frequencies have stronger glow (reduced)
                : bandIndex === 0
                ? 1 + bass * 0.15 // Bass has moderate glow (reduced)
                : 1 + mid * 0.1; // Mid has subtle glow (reduced)

            glowMaterial.opacity = THREE.MathUtils.lerp(
              glowMaterial.opacity || 0,
              (0.2 + energy * 0.3 + beatGlowEffect) * bandGlowMultiplier,
              0.1 // Slower lerp for smoother transitions
            );
          }
        }
      });
    }
    // If audio is not playing, animate with subtle movement
    else {
      lineRefs.current.forEach((line, i) => {
        if (line) {
          // Get the assigned frequency band for this wave (for consistent behavior)
          const bandIndex = waveBandAssignments.current[i];

          // Add beat pulse even when not playing (for visualizing beat)
          const beatEffect = shouldApplyBeatEffects
            ? beatPulseRef.current * 0.5
            : 0;
          const idleAmplitude = WAVE_HEIGHT_BASE * (1 + beatEffect);

          // Gradually return to base amplitude
          waveAmplitudes.current[i] = THREE.MathUtils.lerp(
            waveAmplitudes.current[i],
            idleAmplitude,
            0.05
          );

          // Keep some movement even when not playing
          const baseFrequency = 0.3 + i * 0.1; // Lower base frequency for smoother waves
          const frequency =
            baseFrequency *
            (bandIndex === 2 ? 1.05 : bandIndex === 0 ? 0.95 : 1.0); // Very subtle differences

          // Add more flowing movement when idle - smooth and consistent
          const phase =
            timeRef.current * 0.4 +
            i * (Math.PI / NUM_WAVES) +
            waveFlowPositions.current[i] * 0.5;

          // Apply fixed horizontal offset - no randomness
          const horizontalOffset = waveHorizontalOffsets.current[i];

          // Update geometry - no distortion when idle
          const newGeometry = createSineWaveGeometry(
            frequency,
            phase,
            waveAmplitudes.current[i],
            horizontalOffset,
            0 // No distortion when idle
          );
          // Access the geometry property of the line (Line object)
          (line as THREE.Line).geometry.dispose();
          (line as THREE.Line).geometry = newGeometry;

          // Fade out opacity with beat pulse
          const material = materialInstances[i] as THREE.LineBasicMaterial;
          const beatOpacityEffect = shouldApplyBeatEffects
            ? beatPulseRef.current * 0.2
            : 0;

          // Keep consistent band-based opacity variations even when idle
          const bandOpacityMultiplier =
            bandIndex === 2 ? 1.05 : bandIndex === 0 ? 1.1 : 1.02; // Reduced variation

          material.opacity = THREE.MathUtils.lerp(
            material.opacity || 0,
            (0.6 + beatOpacityEffect) * bandOpacityMultiplier,
            0.05
          );

          // Update the glow tube
          const tube = groupRef.current?.children[i * 2 + 1] as THREE.Mesh;
          if (tube) {
            // Dispose old geometry
            tube.geometry.dispose();

            // Create new curve based on the new sine wave - no distortion when idle
            const newCurve = new THREE.CatmullRomCurve3(
              Array.from({ length: POINTS_PER_WAVE }).map((_, j) => {
                const x =
                  -WAVE_WIDTH / 2 + (j * WAVE_WIDTH) / (POINTS_PER_WAVE - 1);
                const y =
                  Math.sin(frequency * (x + horizontalOffset) + phase) *
                  waveAmplitudes.current[i];
                return new THREE.Vector3(x, y, 0);
              })
            );

            // Band-specific radius - subtle differences
            const bandRadiusMultiplier =
              bandIndex === 2 ? 0.95 : bandIndex === 0 ? 1.1 : 1.0;

            // Create and assign new tube geometry with fade effect
            tube.geometry = createTubeGeometryWithFade(
              newCurve,
              POINTS_PER_WAVE,
              0.05 * bandRadiusMultiplier // Base radius varies by band
            );

            // Update glow opacity with beat pulse
            const glowMaterial = glowMaterialInstances[
              i
            ] as THREE.MeshBasicMaterial;
            const beatGlowEffect = shouldApplyBeatEffects
              ? beatPulseRef.current * 0.15
              : 0;

            // Keep consistent band-based glow variations even when idle
            const bandGlowMultiplier =
              bandIndex === 2 ? 1.05 : bandIndex === 0 ? 1.05 : 1.0; // Reduced variation

            glowMaterial.opacity = THREE.MathUtils.lerp(
              glowMaterial.opacity || 0,
              (0.2 + beatGlowEffect) * bandGlowMultiplier,
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
